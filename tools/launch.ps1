# Ouvre Texte Shorts dans sa propre fenetre (Chrome, sinon Edge, en mode application)
# et cree ou actualise le raccourci "Texte Shorts.lnk" a cote, avec l'icone de l'appli.
# Le raccourci contient le chemin du dossier : le recreer ici le garde valable meme si
# le dossier est deplace.

$root = Split-Path -Parent $PSScriptRoot
$url = ([Uri](Join-Path $root 'index.html')).AbsoluteUri

$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browser) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('Il faut Google Chrome ou Microsoft Edge pour lancer Texte Shorts.', 'Texte Shorts') | Out-Null
    exit 1
}

$arguments = "--app=`"$url`" --window-size=1440,920"

$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $root 'Texte Shorts.lnk'))
$shortcut.TargetPath = $browser
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = (Join-Path $root 'assets\icon.ico') + ',0'
$shortcut.Description = 'Titres facon TikTok en PNG transparent'
$shortcut.Save()

Start-Process -FilePath $browser -ArgumentList $arguments
