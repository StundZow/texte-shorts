"""Prépare l'archive de l'appli, tague la version et publie la release sur GitHub.

Usage :
    python release.py 1.1 "- Nouveauté\n- Correction"

Nécessite GitHub CLI (`gh`) installé et authentifié (`gh auth login`).
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
ARCHIVE = ROOT / "dist" / "TexteShorts.zip"

# Ce que reçoit l'utilisateur : l'appli, son lanceur, et la police avec sa licence.
CONTENT = [
    "index.html",
    "Lancer Texte Shorts.bat",
    "tools/launch.ps1",
    "assets/app.js",
    "assets/style.css",
    "assets/fonts.css",
    "assets/icon.ico",
    "assets/icon.png",
    "assets/fonts/OFL.txt",
]

GH_FALLBACKS = [r"C:\Program Files\GitHub CLI\gh.exe"]


def find_gh() -> str:
    found = shutil.which("gh")
    if found:
        return found
    for path in GH_FALLBACKS:
        if Path(path).exists():
            return path
    print("GitHub CLI ('gh') introuvable. Installe-le puis authentifie-toi avec 'gh auth login'.")
    sys.exit(1)


def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=ROOT)


def build() -> Path:
    ARCHIVE.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in CONTENT:
            zf.write(ROOT / rel, f"Texte Shorts/{rel}")
    print(f"{ARCHIVE.relative_to(ROOT)} : {ARCHIVE.stat().st_size // 1024} Ko")
    return ARCHIVE


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    tag = "v" + sys.argv[1].lstrip("v")
    notes = sys.argv[2].replace("\\n", "\n") if len(sys.argv) > 2 else f"Texte Shorts {tag}"
    gh = find_gh()

    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True).stdout
    if dirty.strip():
        print("Des modifications ne sont pas commitées : commite-les avant de publier.")
        sys.exit(1)

    archive = build()
    run(["git", "tag", tag])
    run(["git", "push", "origin", "HEAD", tag])
    run([gh, "release", "create", tag, str(archive), "--title", f"Texte Shorts {tag}", "--notes", notes])


if __name__ == "__main__":
    main()
