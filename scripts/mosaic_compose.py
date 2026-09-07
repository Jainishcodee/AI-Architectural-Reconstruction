"""
mosaic_compose.py — build a silhouette photo-mosaic poster (like the profile
collage reference: a big silhouette shape filled with a masonry grid of photos,
plain background outside the shape).

Usage:
  python mosaic_compose.py --mask silhouette.png --photos ./photos --out mosaic.png
      [--width 4960] [--height 6613]      final canvas px (default ~3:4 at print res)
      [--cols 4]                          number of photo columns
      [--gutter 0.010]                    gutter as fraction of canvas width
      [--bg "#F6F3DF"]                    background color outside silhouette
      [--red-ratio 0.25]                  fraction of cells tinted red duotone
      [--mono | --color]                  grayscale cells (default) or keep color
      [--seed 42]

Mask: an image where the silhouette is DARK on a LIGHT background (or pass
--mask-invert if it's the other way). Easiest way to make one: remove the
background from a side-profile photo (remove.bg / Canva BG remover), then fill
the person solid black on white in any editor. The mask is resized to the
canvas, so rough edges are fine.

Requires: pip install pillow
"""

import argparse
import random
import sys
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def load_mask(path: str, size: tuple[int, int], invert: bool, feather_px: int) -> Image.Image:
    m = Image.open(path).convert("L").resize(size, Image.LANCZOS)
    # silhouette assumed dark-on-light -> we want inside = white (255)
    m = ImageOps.invert(m)
    if invert:
        m = ImageOps.invert(m)
    m = m.point(lambda p: 255 if p >= 128 else 0)
    if feather_px > 0:
        m = m.filter(ImageFilter.GaussianBlur(feather_px))
    return m


def cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Scale + center-crop img to exactly (w, h)."""
    sw, sh = img.size
    scale = max(w / sw, h / sh)
    img = img.resize((max(1, round(sw * scale)), max(1, round(sh * scale))), Image.LANCZOS)
    sw, sh = img.size
    left = (sw - w) // 2
    top = (sh - h) // 2
    return img.crop((left, top, left + w, top + h))


def _blend(hex_color: str, toward: tuple[int, int, int], t: float) -> str:
    c = Image.new("RGB", (1, 1), hex_color).getpixel((0, 0))
    mixed = tuple(round(a + (b - a) * t) for a, b in zip(c, toward))
    return "#{:02x}{:02x}{:02x}".format(*mixed)


TINT_PRESETS = {
    "blue": "#1f4460",   # deep steel blue (Branson-reference look)
    "red": "#6e1a1f",
    "teal": "#155e5a",
    "saffron": "#8a4a12",
}


def stylize(img: Image.Image, mode: str, tint_dark: str) -> Image.Image:
    gray = ImageOps.autocontrast(img.convert("L"), cutoff=1)
    if mode == "tint":
        mid = _blend(tint_dark, (255, 255, 255), 0.45)
        light = _blend(tint_dark, (255, 255, 255), 0.92)
        return ImageOps.colorize(gray, black=tint_dark, white=light, mid=mid)
    if mode == "color":
        return img
    return gray.convert("RGB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mask", required=True)
    ap.add_argument("--photos", required=True)
    ap.add_argument("--out", default="mosaic.png")
    ap.add_argument("--width", type=int, default=4960)
    ap.add_argument("--height", type=int, default=6613)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--gutter", type=float, default=0.010)
    ap.add_argument("--bg", default="#F6F3DF")
    ap.add_argument("--tint-ratio", type=float, default=0.3,
                    help="fraction of cells given the duotone tint")
    ap.add_argument("--tint", default="blue",
                    help="tint preset (blue/red/teal/saffron) or a hex like #1f4460")
    ap.add_argument("--color", action="store_true", help="keep photos in color")
    ap.add_argument("--mask-invert", action="store_true")
    ap.add_argument("--feather", type=int, default=3, help="mask edge feather px")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    W, H = args.width, args.height

    photo_paths = sorted(
        p for p in Path(args.photos).iterdir() if p.suffix.lower() in PHOTO_EXTS
    )
    if not photo_paths:
        print(f"No photos found in {args.photos}", file=sys.stderr)
        return 1
    photos = [Image.open(p).convert("RGB") for p in photo_paths]
    print(f"Loaded {len(photos)} photos.")

    mask = load_mask(args.mask, (W, H), args.mask_invert, args.feather)

    gutter = max(2, round(W * args.gutter))
    col_w = (W - gutter * (args.cols + 1)) // args.cols

    # Masonry fill: each column stacks photos of varied heights until full.
    grid = Image.new("RGB", (W, H), args.bg)
    order = photos[:]
    rng.shuffle(order)
    idx = 0
    for c in range(args.cols):
        x = gutter + c * (col_w + gutter)
        y = gutter + rng.randint(0, col_w // 3)  # stagger column starts
        while y < H - gutter:
            cell_h = round(col_w * rng.uniform(0.75, 1.55))
            cell_h = min(cell_h, H - gutter - y)
            if cell_h < col_w // 3:
                break
            photo = order[idx % len(order)]
            idx += 1
            tint_dark = TINT_PRESETS.get(args.tint.lower(), args.tint)
            mode = "color" if args.color else ("tint" if rng.random() < args.tint_ratio else "mono")
            cell = stylize(cover_crop(photo, col_w, cell_h), mode, tint_dark)
            grid.paste(cell, (x, y))
            y += cell_h + gutter

    # Composite: photo grid visible only inside the silhouette.
    canvas = Image.new("RGB", (W, H), args.bg)
    canvas.paste(grid, (0, 0), mask)
    canvas.save(args.out, quality=95)
    print(f"Saved {args.out} ({W}x{H}). Cells placed: {idx}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
