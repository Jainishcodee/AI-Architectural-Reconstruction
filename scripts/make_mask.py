"""
make_mask.py — build a black-on-white silhouette mask from a photo whose
background is plain/light, by flood-filling the background from the corners.

Usage: python make_mask.py --image source.png --out mask.png [--tol 40] [--grow 2]
"""

import argparse
import sys

from PIL import Image, ImageDraw, ImageFilter


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--out", default="mask.png")
    ap.add_argument("--tol", type=int, default=40, help="flood-fill color tolerance")
    ap.add_argument("--grow", type=int, default=2, help="shrink silhouette edge px")
    args = ap.parse_args()

    img = Image.open(args.image).convert("RGB")
    img = img.filter(ImageFilter.GaussianBlur(1))
    w, h = img.size

    work = img.copy()
    MARK = (255, 0, 255)
    # Seed only where we are confident it's background: top corners, top edge,
    # and the upper part of the side edges (a bust/portrait subject touches the
    # bottom edge, so never seed from below).
    seeds = [(1, 1), (w - 2, 1), (w // 4, 1), (w // 2, 1), (3 * w // 4, 1),
             (1, h // 4), (w - 2, h // 4), (1, h // 2), (w - 2, h // 2)]
    for seed in seeds:
        if work.getpixel(seed) != MARK:
            ImageDraw.floodfill(work, seed, MARK, thresh=args.tol)

    raw = Image.new("L", (w, h), 0)
    px_work, px_raw = work.load(), raw.load()
    for y in range(h):
        for x in range(w):
            px_raw[x, y] = 255 if px_work[x, y] == MARK else 0

    # Fill interior holes (e.g. a white kurta the flood leaked into): flood the
    # raw bg-mask from a guaranteed-background corner; anything the flood can't
    # reach is inside the person.
    hole = raw.convert("RGB")
    ImageDraw.floodfill(hole, (1, 1), (0, 255, 0), thresh=10)
    px_hole = hole.load()
    mask = Image.new("L", (w, h), 0)
    px_mask = mask.load()
    for y in range(h):
        for x in range(w):
            px_mask[x, y] = 255 if px_hole[x, y] == (0, 255, 0) else 0

    # mask: background=255(white), person=0(black) -> dark-on-light, as
    # mosaic_compose expects. Clean small specks:
    mask = mask.filter(ImageFilter.MaxFilter(3)) if args.grow > 0 else mask
    mask = mask.filter(ImageFilter.MedianFilter(5))
    mask.save(args.out)
    print(f"saved {args.out} ({w}x{h})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
