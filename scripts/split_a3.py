#!/usr/bin/env python3
"""
split_a3.py - Split an A3 image into two A3 pages (plus a 2-page PDF) that join
back into the full picture after printing.

Print-ready layout (default):
  * both pages use the SAME scale, so the halves match exactly
  * a safe margin keeps the picture inside every printer's printable area
  * page 2 carries an overlap strip beyond the seam
  * crop marks in the margins show the seam on both pages
  * a 100 mm check bar lets you confirm the print came out at 100 %

Assembly:
  1. Print the PDF on A3 at 100 % / "Actual size" (NOT "fit to page").
  2. Cut page 1 straight along its seam crop marks (the edge of the picture).
  3. Lay page 1's cut edge on page 2 so it sits exactly on page 2's seam marks.
     Page 2's overlap strip is hidden underneath. Tape on the back.

Usage:
    python split_a3.py poster.jpg
    python split_a3.py poster.jpg --axis vertical    # left/right instead of top/bottom
    python split_a3.py poster.jpg --margin 8 --overlap 10 --dpi 300
    python split_a3.py poster.jpg --no-marks --margin 0 --overlap 0   # raw edge-to-edge halves
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

A3_MM = (297.0, 420.0)
MM_PER_INCH = 25.4


def mm_px(mm: float, dpi: int) -> int:
    return int(round(mm / MM_PER_INCH * dpi))


def get_font(px: int):
    try:
        return ImageFont.truetype("arial.ttf", px)
    except OSError:
        return ImageFont.load_default(px)


def draw_marks(page: Image.Image, seam: int, axis: str, m: int, dpi: int, label: str, note: str):
    """Crop marks at `seam` (a y for horizontal axis, x for vertical) plus labels and a check bar."""
    d = ImageDraw.Draw(page)
    W, H = page.size
    lw = max(2, mm_px(0.3, dpi))
    gap = mm_px(2, dpi)         # keep marks clear of the picture
    if axis == "horizontal":
        d.line([(0, seam), (m - gap, seam)], fill="black", width=lw)
        d.line([(W - m + gap, seam), (W, seam)], fill="black", width=lw)
    else:
        d.line([(seam, 0), (seam, m - gap)], fill="black", width=lw)
        d.line([(seam, H - m + gap), (seam, H)], fill="black", width=lw)

    font = get_font(mm_px(3, dpi))
    small = get_font(mm_px(2.2, dpi))
    pad = mm_px(1.5, dpi)
    d.text((pad, pad), label, fill="black", font=font)
    d.text((pad, pad + mm_px(4, dpi)), note, fill="black", font=small)

    # 100 mm check bar, bottom-left corner inside the margin
    bar = mm_px(100, dpi)
    y = H - pad - mm_px(1, dpi)
    x0 = pad
    d.line([(x0, y), (x0 + bar, y)], fill="black", width=lw)
    for i in range(0, 101, 10):
        x = x0 + mm_px(i, dpi)
        d.line([(x, y - mm_px(1.5, dpi)), (x, y)], fill="black", width=lw)
    d.text((x0, y - mm_px(4.5, dpi)), "100 mm check bar - measure to confirm 100% print",
           fill="black", font=small)


def main() -> int:
    p = argparse.ArgumentParser(description="Split an A3 image into two print-ready A3 pages + PDF.")
    p.add_argument("image")
    p.add_argument("--axis", choices=["horizontal", "vertical"], default="horizontal",
                   help="horizontal = top/bottom halves (default), vertical = left/right halves")
    p.add_argument("--dpi", type=int, default=300)
    p.add_argument("--margin", type=float, default=8.0, help="safe margin in mm on all sides (default 8)")
    p.add_argument("--overlap", type=float, default=10.0, help="overlap strip on page 2 in mm (default 10)")
    p.add_argument("--no-marks", action="store_true", help="omit crop marks, labels and check bar")
    p.add_argument("--out", help="output folder (default: <image>_split next to the image)")
    p.add_argument("--format", choices=["png", "jpg"], default="png")
    a = p.parse_args()

    src = Path(a.image)
    if not src.is_file():
        print(f"error: file not found: {src}", file=sys.stderr)
        return 1
    out = Path(a.out) if a.out else src.with_name(src.stem + "_split")
    out.mkdir(parents=True, exist_ok=True)

    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    sw, sh = img.size
    horiz = a.axis == "horizontal"
    print(f"source: {src.name}  {sw}x{sh}px")

    # --- where to cut, and which way the pages face ------------------------------
    if horiz:
        mid = sh // 2
        half_landscape = sw > mid
        big = max(mid, sh - mid)
    else:
        mid = sw // 2
        half_landscape = mid > sh
        big = max(mid, sw - mid)

    # --- page geometry -------------------------------------------------------------
    pw_mm, ph_mm = (A3_MM[1], A3_MM[0]) if half_landscape else A3_MM
    W, H = mm_px(pw_mm, a.dpi), mm_px(ph_mm, a.dpi)
    m = mm_px(a.margin, a.dpi)
    ov = mm_px(a.overlap, a.dpi)
    avail_w, avail_h = W - 2 * m, H - 2 * m
    print(f"page:   A3 {'landscape' if half_landscape else 'portrait'} {W}x{H}px @ {a.dpi}dpi, "
          f"margin {a.margin:g}mm, overlap {a.overlap:g}mm")

    # ONE scale for the whole picture so both pages match exactly.
    # The larger page (bigger half + overlap strip) must fit inside the safe area.
    if horiz:
        scale = min(avail_w / sw, (avail_h - ov) / big)
    else:
        scale = min(avail_h / sh, (avail_w - ov) / big)
    if scale <= 0:
        print("error: margin/overlap too large for the page", file=sys.stderr)
        return 1

    # Scale the whole picture once, then cut, so both halves share identical scale.
    full = img.resize((max(1, round(sw * scale)), max(1, round(sh * scale))), Image.LANCZOS)
    fw, fh = full.size
    cut = round(mid * scale)
    if horiz:
        s1 = full.crop((0, 0, fw, cut))
        s2 = full.crop((0, max(0, cut - ov), fw, fh))        # overlap strip on top of page 2
    else:
        s1 = full.crop((0, 0, cut, fh))
        s2 = full.crop((max(0, cut - ov), 0, fw, fh))        # overlap strip on left of page 2

    page1 = Image.new("RGB", (W, H), "white")
    page2 = Image.new("RGB", (W, H), "white")
    if horiz:
        x = (W - fw) // 2
        y1 = H - m - s1.height            # page 1 sits at the bottom of the safe area
        page1.paste(s1, (x, y1))
        seam1 = y1 + s1.height            # seam = bottom edge of page 1's picture
        y2 = m                            # page 2 sits at the top of the safe area
        page2.paste(s2, (x, y2))
        seam2 = y2 + (s2.height - (fh - cut))   # seam = top edge + overlap strip
    else:
        y = (H - fh) // 2
        x1 = W - m - s1.width
        page1.paste(s1, (x1, y))
        seam1 = x1 + s1.width
        x2 = m
        page2.paste(s2, (x2, y))
        seam2 = x2 + (s2.width - (fw - cut))

    if not a.no_marks:
        where1 = "bottom" if horiz else "right"
        where2 = "top" if horiz else "left"
        draw_marks(page1, seam1, a.axis, m, a.dpi,
                   f"PAGE 1 of 2  ({'TOP' if horiz else 'LEFT'} half)",
                   f"Print at 100% / Actual size. Cut straight along the {where1} crop marks "
                   f"(edge of picture).")
        draw_marks(page2, seam2, a.axis, m, a.dpi,
                   f"PAGE 2 of 2  ({'BOTTOM' if horiz else 'RIGHT'} half)",
                   f"Print at 100% / Actual size. Do NOT cut. Lay page 1's cut edge on the {where2} "
                   f"crop marks; {a.overlap:g} mm overlap sits underneath.")

    ext = a.format
    kw = {"dpi": (a.dpi, a.dpi)}
    if ext == "jpg":
        kw.update(quality=95, subsampling=0)
    f1, f2 = out / f"{src.stem}_page1.{ext}", out / f"{src.stem}_page2.{ext}"
    page1.save(f1, **kw)
    page2.save(f2, **kw)
    pdf = out / f"{src.stem}_A3_2pages.pdf"
    page1.save(pdf, "PDF", resolution=a.dpi, save_all=True, append_images=[page2])

    print(f"scale:  picture prints at {fw / a.dpi * MM_PER_INCH:.1f} x {fh / a.dpi * MM_PER_INCH:.1f} mm total")
    print("wrote:")
    for f in (f1, f2, pdf):
        print(f"  {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
