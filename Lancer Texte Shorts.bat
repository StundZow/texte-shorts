@echo off
rem Lance Texte Shorts et cree le raccourci "Texte Shorts" (avec l'icone) dans ce dossier.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\launch.ps1"
