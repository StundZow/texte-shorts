"""Génère l'icône de l'appli à partir de son dessin vectoriel : `assets/icon.ico` (toutes les
tailles qu'utilise Windows, pour l'exe et le raccourci), `assets/icon.png` (onglet et en-tête de
l'appli) et `icon.png` à la racine (README).

Le dessin : une tuile pleine en dégradé orange → rouge (les couleurs des titres) et, posé un peu
de travers, un badge blanc en escalier comme ceux que dessine l'appli (une ligne large, une plus
courte, raccords arrondis). Dedans, deux lignes de « texte » et un point jaune pour l'emoji de fin ;
deux étincelles en haut à droite. Jusqu'à 24 px, une variante simplifiée (droite, plus grande,
sans étincelles, tuile bord à bord) reste nette. À relancer après toute retouche du dessin :

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

TOP_LEFT, BOTTOM_RIGHT = "#FF8A3D", "#E8304F"
EMOJI = "#FFC93C"
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


def title_badge(cx: float, cy: float, top_w: float, bottom_w: float, row_h: float, r: float,
                top_line: tuple[float, float], bottom_line: tuple[float, float], line_h: float,
                dot_x: float, dot_r: float, rot: float) -> str:
    """Le badge à deux lignes centré en (cx, cy), une ligne de « texte » dans chaque rangée
    (bornes x données) et le point emoji au bout de la seconde, le tout tourné de `rot` degrés."""
    y0, y1, y2 = cy - row_h, cy, cy + row_h
    badge = rounded([
        (cx - top_w / 2, y0), (cx + top_w / 2, y0), (cx + top_w / 2, y1),
        (cx + bottom_w / 2, y1), (cx + bottom_w / 2, y2), (cx - bottom_w / 2, y2),
        (cx - bottom_w / 2, y1), (cx - top_w / 2, y1),
    ], r)

    def line(x0: float, x1: float, y: float) -> str:
        return f'<rect x="{x0}" y="{y - line_h / 2}" width="{x1 - x0}" height="{line_h}" rx="{line_h / 2}" fill="url(#bg)"/>'

    return (
        f'<g transform="rotate({rot} {cx} {cy})"><path d="{badge}" fill="#fff"/>'
        f'{line(*top_line, cy - row_h / 2)}{line(*bottom_line, cy + row_h / 2)}'
        f'<circle cx="{dot_x}" cy="{cy + row_h / 2}" r="{dot_r}" fill="{EMOJI}"/></g>'
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
    title_badge(500, 530, 700, 440, 176, 62, (250, 750), (345, 545), 62, 608, 40, -6)
    + f'<path d="{sparkle(836, 236, 86)}" fill="#fff"/>'
    + f'<path d="{sparkle(700, 168, 36)}" fill="url(#w45)"/>'
)

SMALL = title_badge(512, 512, 900, 600, 230, 70, (170, 854), (300, 600), 92, 682, 58, 0)


def lighten(color: str, amount: float) -> str:
    rgb = [int(color[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(c + (255 - c) * amount):02x}" for c in rgb)


def gradient(gid: str, start: str, end: str, inset: int) -> str:
    far = 1024 - inset
    return (
        f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{inset}" y1="{inset}" x2="{far}" y2="{far}">'
        f'<stop offset="0" stop-color="{start}"/><stop offset="1" stop-color="{end}"/></linearGradient>'
    )


def svg(glyph: str, inset: int = 32) -> str:
    """La tuile (carré arrondi, dégradé en diagonale), le glyphe, puis un halo discret en
    haut à gauche posé par-dessus le tout."""
    side = 1024 - 2 * inset
    radius = round(side * 0.233)
    tile = f'<rect x="{inset}" y="{inset}" width="{side}" height="{side}" rx="{radius}"'
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>
{gradient("bg", TOP_LEFT, BOTTOM_RIGHT, inset)}{gradient("w45", lighten(TOP_LEFT, .45), lighten(BOTTOM_RIGHT, .45), inset)}
<radialGradient id="sheen" gradientUnits="userSpaceOnUse" cx="260" cy="120" r="900">
<stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
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
