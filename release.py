"""Construit TexteShorts.exe, tague la version et publie la release sur GitHub.

Usage :
    python release.py 1.2 "- Nouveauté\n- Correction"
    python release.py --build      (construit seulement l'exe, sans publier)

Nécessite PyInstaller et pywebview (`pip install -r requirements.txt`), et GitHub CLI (`gh`)
installé et authentifié (`gh auth login`) pour publier.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
EXE = ROOT / "dist" / "TexteShorts.exe"

# Les fichiers de la page, embarqués dans l'exe (chemin source, dossier dans l'exe).
DATA = [
    ("index.html", "."),
    ("assets/app.js", "assets"),
    ("assets/emojis.js", "assets"),
    ("assets/style.css", "assets"),
    ("assets/fonts.css", "assets"),
    ("assets/icon.ico", "assets"),
    ("assets/icon.png", "assets"),
    ("assets/fonts/OFL.txt", "assets/fonts"),
]

# pywebview n'utilise ici que WinForms + WebView2 : les autres moteurs n'ont rien à faire dans l'exe.
EXCLUDED_MODULES = ["tkinter", "numpy", "PIL", "PySide6", "PyQt5", "PyQt6", "qtpy", "gi", "cefpython3"]

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
    cmd = [
        sys.executable, "-m", "PyInstaller", "main.py",
        "--noconfirm", "--clean", "--onefile", "--windowed",
        "--name", EXE.stem,
        "--icon", str(ROOT / "assets" / "icon.ico"),
        "--distpath", str(EXE.parent), "--workpath", str(ROOT / "build"), "--specpath", str(ROOT / "build"),
    ]
    for src, dest in DATA:
        cmd += ["--add-data", f"{ROOT / src};{dest}"]
    for module in EXCLUDED_MODULES:
        cmd += ["--exclude-module", module]
    run(cmd)
    print(f"{EXE.relative_to(ROOT)} : {EXE.stat().st_size / 1e6:.1f} Mo")
    return EXE


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == "--build":
        build()
        return
    tag = "v" + sys.argv[1].lstrip("v")
    notes = sys.argv[2].replace("\\n", "\n") if len(sys.argv) > 2 else f"Texte Shorts {tag}"
    gh = find_gh()

    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True).stdout
    if dirty.strip():
        print("Des modifications ne sont pas commitées : commite-les avant de publier.")
        sys.exit(1)

    exe = build()
    run(["git", "tag", tag])
    run(["git", "push", "origin", "HEAD", tag])
    run([gh, "release", "create", tag, str(exe), "--title", f"Texte Shorts {tag}", "--notes", notes])


if __name__ == "__main__":
    main()
