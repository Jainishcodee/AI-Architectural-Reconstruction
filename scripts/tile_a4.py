"""
tile_a4.py — slice a big poster image into printable A4 tiles for a wall mural.

Each tile is a full A4 page (210x297 mm) at the chosen DPI, with a small
overlap strip on shared edges (so you can glue tiles over each other without
white gaps), plus a corner label like B2 and an assembly map image.

Usage:
  python tile_a4.py --image mosaic.png --cols 3 --rows 4
      [--dpi 200] [--overlap-mm 6] [--outdir tiles] [--landscape] [--pdf]

Wall size ends up: cols * 210mm x rows * 297mm (minus overlaps), e.g.
3x4 portrait tiles ~= 62 x 117 cm. Requires: pip install pillow
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

A4_MM = (210.0, 297.0)


def mm_to_px(mm: float, dpi: int) -> int:
    return round(mm / 25.4 * dpi)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--overlap-mm", type=float, default=6.0)
    ap.add_argument("--outdir", default="tiles")
    ap.add_argument("--landscape", action="store_true")
    ap.add_argument("--pdf", action="store_true", help="also write one multi-page PDF")
    args = ap.parse_args()

    page_mm = (A4_MM[1], A4_MM[0]) if args.landscape else A4_MM
    tile_w = mm_to_px(page_mm[0], args.dpi)
    tile_h = mm_to_px(page_mm[1], args.dpi)
    ov = mm_to_px(args.overlap_mm, args.dpi)

    # Content advances by (tile - overlap) each step; total wall pixel size:
    total_w = args.cols * tile_w - (args.cols - 1) * ov
    total_h = args.rows * tile_h - (args.rows - 1) * ov

    src = Image.open(args.image).convert("RGB")
    src = src.resize((total_w, total_h), Image.LANCZOS)
    print(f"Wall size: {total_w/args.dpi*25.4/10:.1f} x {total_h/args.dpi*25.4/10:.1f} cm "
          f"({args.cols}x{args.rows} A4 @ {args.dpi}dpi, overlap {args.overlap_mm}mm)")

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", size=max(18, args.dpi // 8))
    except OSError:
        font = ImageFont.load_default()

    pages = []
    for r in range(args.rows):
        for c in range(args.cols):
            x = c * (tile_w - ov)
            y = r * (tile_h - ov)
            tile = src.crop((x, y, x + tile_w, y + tile_h))
            d = ImageDraw.Draw(tile)
            label = f"{chr(ord('A') + r)}{c + 1}"
            # small label + overlap guide ticks (top-left corner area)
            d.rectangle([8, 8, 8 + args.dpi, 8 + args.dpi // 3], fill="white", outline="black")
            d.text((16, 12), label, fill="black", font=font)
            if c > 0:   # left edge shares overlap with previous column
                d.line([(ov, 0), (ov, tile_h)], fill=(255, 0, 0), width=1)
            if r > 0:   # top edge shares overlap with previous row
                d.line([(0, ov), (tile_w, ov)], fill=(255, 0, 0), width=1)
            path = outdir / f"tile_{label}.png"
            tile.save(path, dpi=(args.dpi, args.dpi))
            pages.append(tile)
            print(f"  wrote {path}")

    # Assembly map
    thumb = src.copy()
    thumb.thumbnail((1200, 1200))
    sx, sy = thumb.size[0] / total_w, thumb.size[1] / total_h
    d = ImageDraw.Draw(thumb)
    for r in range(args.rows):
        for c in range(args.cols):
            x = c * (tile_w - ov) * sx
            y = r * (tile_h - ov) * sy
            d.rectangle([x, y, x + tile_w * sx, y + tile_h * sy], outline="red", width=2)
            d.text((x + 8, y + 6), f"{chr(ord('A') + r)}{c + 1}", fill="red", font=font)
    map_path = outdir / "assembly_map.png"
    thumb.save(map_path)
    print(f"  wrote {map_path}")

    if args.pdf:
        pdf_path = outdir / "tiles_A4.pdf"
        pages[0].save(pdf_path, save_all=True, append_images=pages[1:],
                      resolution=args.dpi)
        print(f"  wrote {pdf_path} (print at 100% / 'Actual size' — NOT fit-to-page)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
