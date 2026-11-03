"""Génère l'icône de l'appli à partir de son dessin vectoriel : `assets/icon.ico` (toutes les
tailles qu'utilise Windows, pour le raccourci), `assets/icon.png` (onglet et en-tête de l'appli)
et `icon.png` à la racine (README).

Le dessin : une tuile sombre et un « T » d'outil texte blanc posé sur un sticker rouge, soit
exactement un titre TikTok (texte blanc sur fond rouge). Le contour du sticker reprend la forme
en escalier que dessine l'appli : une ligne large, une plus courte, raccords arrondis. Le tout
penche un peu, avec deux étincelles jaunes. Jusqu'à 24 px, une variante simplifiée (droite, plus
grande, sans étincelles, tuile bord à bord) reste nette. À relancer après toute retouche :

    python tools/make_icon.py
"""
from __future__ import annotations

import math
import struct
import sys
from pathlib import Path

from PySide6.QtCore import QBuffer, QByteArray, QIODevice, QRectF, Qt
from PySide6.QtGui import QGuiApplication, QImage, QPainter
from PySide6.QtSvg import QSvgRenderer

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

TILE_TOP, TILE_BOTTOM = "#2B2B33", "#141418"
RED_TOP, RED_BOTTOM = "#FF6A4D", "#E8304F"
SPARK, SPARK_SOFT = "#FFD54A", "#FFE9A6"
ICO_SIZES = (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)
SMALL_MAX = 24
PNG_SIZE = 512


def rounded(points: list[tuple[float, float]], r: float) -> str:
    """Chemin SVG d'un polygone dont chaque angle, saillant ou rentrant, est arrondi (même
    principe que le contour des titres dans l'appli)."""
    n = len(points)
    first, last = points[0], points[-1]
    d = [f"M{(first[0] + last[0]) / 2:.1f} {(first[1] + last[1]) / 2:.1f}"]
    for i, (x, y) in enumerate(points):
        px, py = points[i - 1]
        nx, ny = points[(i + 1) % n]
        lp, ln = math.dist((x, y), (px, py)), math.dist((x, y), (nx, ny))
        rad = min(r, lp / 2, ln / 2)
        t1 = (x + (px - x) / lp * rad, y + (py - y) / lp * rad)
        t2 = (x + (nx - x) / ln * rad, y + (ny - y) / ln * rad)
        sweep = 1 if (x - px) * (ny - y) - (y - py) * (nx - x) > 0 else 0
        d.append(f"L{t1[0]:.1f} {t1[1]:.1f}A{rad:.1f} {rad:.1f} 0 0 {sweep} {t2[0]:.1f} {t2[1]:.1f}")
    return "".join(d) + "Z"


def t_outline(cx: float, top: float, bar_w: float, bar_h: float, stem_w: float, height: float, pad: float) -> list:
    """Silhouette d'un T, élargie de `pad` tout autour (pad = 0 : le T lui-même)."""
    x0, x1 = cx - bar_w / 2 - pad, cx + bar_w / 2 + pad
    s0, s1 = cx - stem_w / 2 - pad, cx + stem_w / 2 + pad
    y0, y1, y2 = top - pad, top + bar_h + pad, top + height + pad
    return [(x0, y0), (x1, y0), (x1, y1), (s1, y1), (s1, y2), (s0, y2), (s0, y1), (x0, y1)]


def sticker(cx: float, cy: float, scale: float, rot: float) -> str:
    bar_w, bar_h, stem_w, height = 520 * scale, 160 * scale, 180 * scale, 470 * scale
    pad = 64 * scale
    top = cy - height / 2
    letter = rounded(t_outline(cx, top, bar_w, bar_h, stem_w, height, 0), 24 * scale)
    badge = rounded(t_outline(cx, top, bar_w, bar_h, stem_w, height, pad), 80 * scale)
    return (
        f'<g transform="rotate({rot} {cx} {cy})">'
        f'<path d="{badge}" fill="#000" fill-opacity="0.22" transform="translate(0 {26 * scale})"/>'
        f'<path d="{badge}" fill="url(#red)"/><path d="{letter}" fill="#fff"/></g>'
    )


def sparkle(cx: float, cy: float, size: float) -> str:
    """Étoile à quatre branches aux flancs incurvés."""
    k = size * 0.16
    return (
        f"M{cx} {cy - size}Q{cx + k} {cy - k} {cx + size} {cy}"
        f"Q{cx + k} {cy + k} {cx} {cy + size}Q{cx - k} {cy + k} {cx - size} {cy}"
        f"Q{cx - k} {cy - k} {cx} {cy - size}Z"
    )


ICON = (
    sticker(470, 500, 1, -8)
    + f'<path d="{sparkle(790, 740, 92)}" fill="{SPARK}"/>'
    + f'<path d="{sparkle(880, 612, 38)}" fill="{SPARK_SOFT}"/>'
)

SMALL = sticker(512, 500, 1.22, 0)


def gradient(gid: str, start: str, end: str, a: int, b: int) -> str:
    return (
        f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{a}" y1="{a}" x2="{b}" y2="{b}">'
        f'<stop offset="0" stop-color="{start}"/><stop offset="1" stop-color="{end}"/></linearGradient>'
    )


def svg(glyph: str, inset: int = 32) -> str:
    """La tuile (carré arrondi, dégradé en diagonale), le glyphe, puis un halo discret en
    haut à gauche posé par-dessus le tout."""
    side = 1024 - 2 * inset
    radius = round(side * 0.233)
    tile = f'<rect x="{inset}" y="{inset}" width="{side}" height="{side}" rx="{radius}"'
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>
{gradient("bg", TILE_TOP, TILE_BOTTOM, inset, 1024 - inset)}{gradient("red", RED_TOP, RED_BOTTOM, 200, 800)}
<radialGradient id="sheen" gradientUnits="userSpaceOnUse" cx="260" cy="120" r="900">
<stop offset="0" stop-color="#fff" stop-opacity="0.10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</radialGradient></defs>
{tile} fill="url(#bg)"/>{glyph}{tile} fill="url(#sheen)"/></svg>"""


def render(svg_text: str, size: int) -> QImage:
    image = QImage(size, size, QImage.Format_ARGB32_Premultiplied)
    image.fill(Qt.transparent)
    painter = QPainter(image)
    painter.setRenderHint(QPainter.Antialiasing)
    QSvgRenderer(QByteArray(svg_text.encode())).render(painter, QRectF(0, 0, size, size))
    painter.end()
    return image.convertToFormat(QImage.Format_ARGB32)


def png_bytes(image: QImage) -> bytes:
    buffer = QBuffer()
    buffer.open(QIODevice.WriteOnly)
    image.save(buffer, "PNG")
    return bytes(buffer.data())


def dib_bytes(image: QImage) -> bytes:
    """Bitmap 32 bits BGRA (lignes de bas en haut) suivi du masque AND : le format historique
    des .ico, lu par tout ce qui sait lire une icône."""
    size = image.width()
    stride = size * 4
    pixels = bytes(image.constBits())[: stride * size]
    rows = [pixels[y * stride:(y + 1) * stride] for y in reversed(range(size))]
    mask_stride = (size + 31) // 32 * 4
    mask = bytearray()
    for row in rows:
        bits = bytearray(mask_stride)
        for x in range(size):
            if row[x * 4 + 3] == 0:
                bits[x // 8] |= 0x80 >> (x % 8)
        mask += bits
    header = struct.pack("<IiiHHIIiiII", 40, size, size * 2, 1, 32, 0, stride * size + len(mask), 0, 0, 0, 0)
    return header + b"".join(rows) + bytes(mask)


def write_ico(path: Path, frames: list[QImage]) -> None:
    # 256 px en PNG (seul format que Windows attend à cette taille), le reste en bitmap
    blobs = [png_bytes(f) if f.width() >= 256 else dib_bytes(f) for f in frames]
    offset = 6 + 16 * len(frames)
    entries = b""
    for frame, blob in zip(frames, blobs):
        side = frame.width() % 256  # 256 s'écrit 0
        entries += struct.pack("<BBBBHHII", side, side, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    path.write_bytes(struct.pack("<HHH", 0, 1, len(frames)) + entries + b"".join(blobs))


def main():
    QGuiApplication(sys.argv)
    icon, small = svg(ICON), svg(SMALL, inset=0)
    frames = [render(small if size <= SMALL_MAX else icon, size) for size in ICO_SIZES]
    write_ico(ASSETS / "icon.ico", frames)
    print(f"icon.ico: {', '.join(map(str, ICO_SIZES))} px")
    image = render(icon, PNG_SIZE)
    for path in (ASSETS / "icon.png", ROOT / "icon.png"):
        image.save(str(path))
        print(f"{path.relative_to(ROOT)}: {PNG_SIZE}x{PNG_SIZE}")


if __name__ == "__main__":
    main()
