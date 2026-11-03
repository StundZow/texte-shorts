"""Texte Shorts en appli Windows : la page de l'appli dans une vraie fenêtre (WebView2, le moteur
d'Edge fourni avec Windows), avec son icône et sans dépendre d'un navigateur.

Python ne fait que ce qu'une page web ne sait pas bien faire ici : enregistrer les PNG dans un
dossier (choisi avec la boîte de dialogue Windows, retenu d'une fois sur l'autre) et ouvrir ce
dossier. Tout le rendu reste dans la page.

    python main.py
"""
from __future__ import annotations

import base64
import json
import os
import re
import sys
import winreg
from pathlib import Path

import webview

APP_NAME = "Texte Shorts"
# Dans l'exe, les fichiers de l'appli sont décompressés dans un dossier temporaire (_MEIPASS).
ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
DATA = Path(os.environ.get("APPDATA", Path.home())) / APP_NAME
SETTINGS = DATA / "settings.json"


def downloads_dir() -> Path:
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders") as key:
            return Path(winreg.QueryValueEx(key, "{374DE290-123F-4565-9164-39C4925E467B}")[0])
    except OSError:
        return Path.home() / "Downloads"


def load_settings() -> dict:
    try:
        return json.loads(SETTINGS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_settings(settings: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    SETTINGS.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")


class Api:
    """Appelée depuis la page via window.pywebview.api.*"""

    def __init__(self) -> None:
        self._settings = load_settings()
        self._window = None

    def _folder(self) -> Path:
        custom = self._settings.get("folder")
        return Path(custom) if custom and Path(custom).is_dir() else downloads_dir()

    def get_folder(self) -> dict:
        folder = self._folder()
        is_default = folder == downloads_dir()
        return {"name": "Téléchargements" if is_default else folder.name, "path": str(folder), "isDefault": is_default}

    def choose_folder(self) -> dict | None:
        result = self._window.create_file_dialog(webview.FileDialog.FOLDER, directory=str(self._folder()))
        if not result:
            return None
        self._settings["folder"] = result[0]
        save_settings(self._settings)
        return self.get_folder()

    def reset_folder(self) -> dict:
        self._settings.pop("folder", None)
        save_settings(self._settings)
        return self.get_folder()

    def open_folder(self) -> None:
        os.startfile(self._folder())

    def save_png(self, name: str, data: str) -> dict:
        folder = self._folder()
        folder.mkdir(parents=True, exist_ok=True)
        stem = re.sub(r'[\\/:*?"<>|\r\n\t]+', " ", Path(name).stem).strip() or "titre"
        path = folder / f"{stem}.png"
        n = 2
        while path.exists():
            path = folder / f"{stem} ({n}).png"
            n += 1
        path.write_bytes(base64.b64decode(data))
        return {"name": path.name, "folder": self.get_folder()["name"], "path": str(path)}


def main() -> None:
    api = Api()
    window = webview.create_window(
        APP_NAME,
        (ROOT / "index.html").as_uri(),
        js_api=api,
        width=1440,
        height=920,
        min_size=(900, 620),
        background_color="#0E0E10",
    )
    api._window = window
    icon = ROOT / "assets" / "icon.ico"
    webview.start(
        gui="edgechromium",
        private_mode=False,
        storage_path=str(DATA / "WebView2"),
        icon=None if getattr(sys, "frozen", False) else str(icon),
    )


if __name__ == "__main__":
    main()
