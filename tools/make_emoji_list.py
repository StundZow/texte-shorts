"""Génère `assets/emojis.js` : tous les emojis qui ont une image Apple, rangés par catégorie dans
l'ordre du clavier iPhone, avec leur nom et leurs mots-clés en français (pour la recherche).

Sources (versions figées) : la liste et l'ordre viennent d'emoji-datasource-apple, les noms
français d'emojibase-data. À relancer quand on monte de version :

    python tools/make_emoji_list.py
"""
from __future__ import annotations

import json
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "emojis.js"

APPLE = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/emoji.json"
FRENCH = "https://cdn.jsdelivr.net/npm/emojibase-data@18.0.0/fr/compact.json"

# Même ordre que les icônes des onglets (EMOJI_TAB_ICONS dans assets/app.js).
CATEGORIES = [
    ("Smileys & Emotion", "Smileys et émotions"),
    ("People & Body", "Personnes"),
    ("Animals & Nature", "Animaux et nature"),
    ("Food & Drink", "Nourriture et boissons"),
    ("Travel & Places", "Voyages et lieux"),
    ("Activities", "Activités"),
    ("Objects", "Objets"),
    ("Symbols", "Symboles"),
    ("Flags", "Drapeaux"),
]


def fetch(url: str):
    with urllib.request.urlopen(url) as resp:
        return json.load(resp)


def key(hexcode: str) -> str:
    """Identifiant commun aux deux sources : codes en minuscules, sans sélecteur de variante."""
    return "-".join(c for c in hexcode.lower().split("-") if c != "fe0f")


def plain(text: str) -> str:
    """Minuscules sans accents, pour une recherche qui pardonne « crane » pour « crâne »."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def main() -> None:
    apple = fetch(APPLE)
    french = {key(e["hexcode"]): e for e in fetch(FRENCH)}

    groups = []
    total = 0
    for source, label in CATEGORIES:
        items = []
        for e in sorted((e for e in apple if e["category"] == source and e.get("has_img_apple")),
                        key=lambda e: e["sort_order"]):
            char = "".join(chr(int(c, 16)) for c in e["unified"].split("-"))
            fr = french.get(key(e["unified"]), {})
            name = fr.get("label") or e["short_names"][0].replace("_", " ")
            words = [name, *fr.get("tags", []), *(n.replace("_", " ") for n in e["short_names"])]
            search = " ".join(dict.fromkeys(plain(w) for w in words))
            item = [char, name, search]
            # L'image s'appelle presque toujours comme les codes de l'emoji : on ne note que les exceptions.
            derived = "-".join(f"{ord(c):04x}" for c in char)
            if e["image"][:-4] != derived:
                item.append(e["image"][:-4])
            items.append(item)
        total += len(items)
        groups.append([label, items])

    body = json.dumps(groups, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "// Généré par tools/make_emoji_list.py : [catégorie, [[emoji, nom, mots-clés, image?], …]]\n"
        f"const EMOJI_GROUPS = {body};\n",
        encoding="utf-8",
    )
    print(f"{OUT.relative_to(ROOT)} : {total} emojis, {OUT.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
