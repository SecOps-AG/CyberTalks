#!/usr/bin/env python3
"""
Regenerates the brand images in public/: favicon, touch icons, and the default
social card. Needs Pillow and the Orbitron and IBM Plex Mono font files.

  python3 scripts/make-brand-assets.py <orbitron.ttf> <plex-mono.ttf>

The outputs are committed, so this only needs to run when the artwork changes.
"""
import sys

from PIL import Image, ImageDraw, ImageFont

VOID = (5, 8, 5)
ACID = (57, 255, 20)
MINT = (200, 255, 192)
CYAN = (0, 240, 255)
OUT = "public"


def grid(draw, w, h, step, alpha_color):
    for x in range(0, w, step):
        draw.line([(x, 0), (x, h)], fill=alpha_color, width=1)
    for y in range(0, h, step):
        draw.line([(0, y), (w, y)], fill=alpha_color, width=1)


def prompt_glyph(draw, box, width):
    """A ">_" prompt: acid chevron with a cyan cursor."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    chevron = [
        (x0 + 0.05 * w, y0 + 0.10 * h),
        (x0 + 0.50 * w, y0 + 0.50 * h),
        (x0 + 0.05 * w, y0 + 0.90 * h),
    ]
    draw.line(chevron, fill=ACID, width=width, joint="curve")
    for p in (chevron[0], chevron[2]):
        draw.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=ACID)
    cy = y0 + 0.90 * h
    draw.line([(x0 + 0.58 * w, cy), (x0 + 0.98 * w, cy)], fill=CYAN, width=width)


def icon(size):
    img = Image.new("RGB", (size, size), VOID)
    d = ImageDraw.Draw(img)
    grid(d, size, size, max(size // 8, 4), (14, 34, 12))
    b = max(size // 32, 1)
    d.rectangle([b, b, size - 1 - b, size - 1 - b], outline=(30, 110, 18), width=b)
    pad = size * 0.24
    prompt_glyph(d, (pad, pad, size - pad, size - pad), max(int(size * 0.09), 2))
    return img


def og(orbitron, plex):
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), VOID)
    d = ImageDraw.Draw(img)
    grid(d, w, h, 32, (13, 30, 12))
    d.rectangle([24, 24, w - 25, h - 25], outline=(30, 110, 18), width=2)
    prompt_glyph(d, (96, 150, 256, 310), 16)
    title = ImageFont.truetype(orbitron, 120)
    title.set_variation_by_axes([700])
    d.text((96, 320), "CYBER TALKS", font=title, fill=ACID)
    sub = ImageFont.truetype(plex, 40)
    d.text((100, 462), "Conference talk archive", font=sub, fill=MINT)
    small = ImageFont.truetype(plex, 26)
    d.text((100, 530), "DEF CON · Black Hat · BSides · and more", font=small, fill=CYAN)
    d.text((100, 566), "Unofficial. Not affiliated with any conference.", font=small, fill=(110, 150, 106))
    return img


def main():
    orbitron, plex = sys.argv[1], sys.argv[2]
    icon(512).save(f"{OUT}/icon-512.png")
    icon(192).save(f"{OUT}/icon-192.png")
    icon(180).save(f"{OUT}/apple-touch-icon.png")
    icon(64).save(f"{OUT}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    og(orbitron, plex).save(f"{OUT}/og-default.png", optimize=True)


main()
