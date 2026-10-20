#!/usr/bin/env python3
"""Draws the app icons (icons/*.png) used by the home-screen install (docs/pwa.md).

    python3 tools/make-icons.py        needs Pillow (pip install pillow)

The art is the game's flat tank on the shell's dark blue. Everything is drawn on a 100-unit grid, kept inside the
central 60 units so one picture works as a plain icon, an Android maskable icon (safe zone: the central 80%) and an
iPhone home-screen icon (iOS rounds the corners itself, so the picture must be a full-bleed square with no transparency).
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'icons'
BG, TRACK, HULL, TURRET, BARREL, HILITE = '#1d2436', '#0e1322', '#e8712c', '#9a3f0e', '#f3ecd6', '#f59a5b'
SS = 4  # supersampling factor, for smooth edges


def draw(size):
    big = size * SS
    img = Image.new('RGB', (big, big), BG)
    d = ImageDraw.Draw(img)
    k = big / 100

    def rr(x0, y0, x1, y1, r, fill):
        d.rounded_rectangle((x0 * k, y0 * k, x1 * k, y1 * k), radius=r * k, fill=fill)

    rr(20, 54, 80, 72, 9, TRACK)                       # tracks
    for i, cx in enumerate((28, 39, 50, 61, 72)):      # road wheels
        d.ellipse(((cx - 3.6) * k, (63 - 3.6) * k, (cx + 3.6) * k, (63 + 3.6) * k), fill=HILITE if i % 2 else HULL)
    rr(24, 44, 76, 58, 6, HULL)                        # hull
    rr(24, 44, 76, 49, 3, HILITE)                      # light top edge
    rr(36, 29, 62, 46, 6, TURRET)                      # turret
    rr(58, 34, 86, 39, 1.5, BARREL)                    # barrel
    rr(84, 32.5, 88, 40.5, 1.2, BARREL)                # muzzle brake
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    for name, size in (('icon-192.png', 192), ('icon-512.png', 512), ('icon-maskable-512.png', 512), ('apple-touch-icon.png', 180)):
        draw(size).save(OUT / name, optimize=True)
        print('wrote', OUT / name)


if __name__ == '__main__':
    main()
