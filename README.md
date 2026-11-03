<div align="center">

<img src="icon.png" width="96" alt="Icône Texte Shorts">

# Texte Shorts

Crée tes titres **façon TikTok** (fond coloré, emojis Apple, petite ombre portée) et exporte-les en **PNG transparent** pour tes Shorts.

[**⬇ Télécharger pour Windows**](https://github.com/StundZow/texte-shorts/releases/latest/download/TexteShorts.exe) · [Releases](https://github.com/StundZow/texte-shorts/releases)

<img src="screenshots/01_main.png" width="720" alt="Fenêtre principale">

</div>

## Ce que ça fait

Texte Shorts s'adresse aux créateurs qui montent leurs vidéos verticales sur PC mais veulent garder le titre « signature » de TikTok : le texte blanc sur son bloc rouge (ou bleu, orange…), un bloc par ligne, coins arrondis, et deux emojis à la fin.

Tu tapes ton titre, tu choisis la couleur et tes emojis, et l'appli sort un PNG transparent prêt à poser sur ta timeline (Premiere, CapCut, DaVinci, peu importe).

## Pourquoi pas juste écrire le titre dans TikTok ?

Parce que le texte ajouté dans l'appli TikTok reste dans TikTok : impossible de le récupérer pour YouTube Shorts, Reels ou ton montage sur PC. Le refaire à la main dans un logiciel de montage, c'est retrouver la police, recaler les marges et redessiner les raccords arrondis entre les lignes, à chaque vidéo. Ici, c'est un champ texte et un bouton.

## Fonctionnalités

- 🔤 **La vraie police TikTok** (TikTok Sans), avec les proportions mesurées sur de vrais titres : interligne, marges, arrondis, raccords entre les lignes
- 😳 **Tous les emojis Apple**, comme sur iPhone : une barre de récents, la liste complète rangée par catégorie, et une recherche en français (« crâne », « je suis mort », « drapeau france »…). Ils restent toujours collés au dernier mot
- 🎨 **Couleurs TikTok** (rouge, bleu, orange…) ou une couleur perso, avec un texte blanc ou noir choisi automatiquement selon le fond
- 🌫️ **Ombre portée réglable** : opacité, flou, distance, direction, couleur
- 📐 **Deux formats d'export** : recadré au plus juste, ou **1080×1920** avec le titre déjà placé à la bonne hauteur (posé sur ta timeline, il est aligné)
- 🔍 **Qualité 1×, 2× ou 3×** pour rester net même en 4K
- 💾 **Export en un clic** (<kbd>Ctrl</kbd>+<kbd>S</kbd>) dans le dossier de ton choix (Téléchargements par défaut), bouton **Ouvrir** pour y aller direct, ou copie dans le presse-papiers
- 🖼️ **Aperçu sur ta vidéo** : glisse une capture de ton Short derrière le titre pour juger du rendu
- 🕘 **Titres récents** et réglages mémorisés d'une session à l'autre

<div align="center">
<img src="screenshots/02_vertical.png" width="520" alt="Format 1080×1920 et réglages">
&nbsp;&nbsp;
<img src="screenshots/03_exemples.png" width="250" alt="Exemples de titres exportés">
</div>

## Prise en main

1. [Télécharge `TexteShorts.exe`](https://github.com/StundZow/texte-shorts/releases/latest/download/TexteShorts.exe) et lance-le : rien à installer, pas besoin d'être administrateur. Range-le où tu veux et épingle-le à la barre des tâches.
2. Au premier lancement, Windows peut afficher « Windows a protégé votre ordinateur » (l'exe n'est pas signé) : clique **Informations complémentaires** puis **Exécuter quand même**.
3. Tape ton titre, choisis tes emojis et ta couleur, règle l'ombre.
4. Choisis une fois pour toutes le dossier d'export (bouton **Dossier**), puis clique **Exporter PNG** et pose le PNG sur ta vidéo.

## Comment ça marche

L'exe ouvre la page de l'appli dans une vraie fenêtre Windows grâce à WebView2, le moteur d'Edge déjà présent sur Windows 10 et 11 (via [pywebview](https://pywebview.flowrl.com/)). Tout le rendu se fait dans un `<canvas>` sur ton PC, rien n'est envoyé nulle part ; Python ne sert qu'à enregistrer les PNG et à retenir ton dossier d'export. Tes réglages sont gardés dans `%APPDATA%\Texte Shorts`.

La police TikTok Sans (licence libre SIL OFL, publiée par TikTok) est embarquée dans l'appli. Les images des emojis Apple viennent du CDN jsDelivr ([iamcal/emoji-data](https://github.com/iamcal/emoji-data)) : il faut donc une connexion internet pour elles, et hors ligne l'appli bascule sur les emojis Windows. La liste des emojis et leurs noms français (pour la recherche) sont embarqués dans l'appli, générés par `tools/make_emoji_list.py` à partir d'emoji-data et d'[emojibase](https://emojibase.dev/).

Le fond suit le même principe que TikTok : un rectangle par ligne, centrés, et quand deux lignes n'ont pas la même largeur, la plus large recouvre la zone où elles se chevauchent. Chaque angle du contour, saillant ou rentrant, est ensuite arrondi. Les apostrophes deviennent typographiques (’) comme sur iPhone, et une espace insécable empêche un « ? » ou les emojis de partir seuls à la ligne.

## Lancer depuis les sources

```bash
pip install -r requirements.txt
python main.py
```

Sans Python, `Lancer Texte Shorts.bat` ouvre aussi l'appli, dans une fenêtre Chrome ou Edge en mode application (et crée un raccourci **Texte Shorts** avec l'icône à côté).

Pour régénérer l'icône après une retouche du dessin :

```bash
pip install PySide6
python tools/make_icon.py
```

## Publier une nouvelle version (pour les mainteneurs)

```bash
python release.py 1.1 "Description des changements"
```

Ce script construit `TexteShorts.exe` avec PyInstaller, tague la version et publie la release sur GitHub (`python release.py --build` construit seulement l'exe). Nécessite [GitHub CLI](https://cli.github.com/) authentifié.
