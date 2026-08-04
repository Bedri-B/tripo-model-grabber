"""Generates the extension's icon set from a single vector-like design.

Design: a rounded-square gradient badge (indigo -> blue) with a white
hexagon outline (the classic "3D object" glyph, per Webpack/Feather "box"
convention) and a small amber download-arrow badge in the corner.
Not a copy of any third-party logo.
"""
import math
from PIL import Image, ImageDraw, ImageOps

SIZE = 1024  # supersample, then downscale for anti-aliasing
OUT_SIZES = [16, 32, 48, 128]

COLOR_TOP = (79, 70, 229)      # indigo-600
COLOR_BOTTOM = (37, 99, 235)   # blue-600
GLYPH_COLOR = (255, 255, 255, 255)
BADGE_BG = (245, 158, 11, 255)  # amber-500
BADGE_ARROW = (255, 255, 255, 255)


def make_background(size):
    grad = Image.linear_gradient("L").resize((size, size))
    bg = ImageOps.colorize(grad, black=COLOR_TOP, white=COLOR_BOTTOM).convert("RGBA")

    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    radius = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0), mask)
    return canvas


def hexagon_points(cx, cy, r, flat_top=True):
    pts = []
    offset = 0 if flat_top else math.pi / 6
    for i in range(6):
        angle = offset + i * math.pi / 3
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return pts


def draw_glyph(canvas, size):
    d = ImageDraw.Draw(canvas)
    cx, cy = size * 0.5, size * 0.44
    r = size * 0.26
    stroke = max(2, int(size * 0.045))

    pts = hexagon_points(cx, cy, r, flat_top=True)
    d.line(pts + [pts[0]], fill=GLYPH_COLOR, width=stroke, joint="curve")

    # small inner accent line (top-left to center) to hint a 3D facet
    d.line([pts[5], (cx, cy)], fill=(255, 255, 255, 160), width=max(1, stroke // 2))
    d.line([pts[1], (cx, cy)], fill=(255, 255, 255, 160), width=max(1, stroke // 2))

    # download badge, bottom-right
    badge_r = size * 0.155
    bx, by = size * 0.76, size * 0.78
    d.ellipse(
        [bx - badge_r, by - badge_r, bx + badge_r, by + badge_r],
        fill=BADGE_BG,
        outline=(255, 255, 255, 255),
        width=max(2, int(size * 0.012)),
    )

    aw = badge_r * 0.55
    ah = badge_r * 0.75
    d.line([(bx, by - ah * 0.6), (bx, by + ah * 0.15)], fill=BADGE_ARROW, width=max(2, int(size * 0.02)))
    d.polygon(
        [
            (bx - aw * 0.55, by),
            (bx + aw * 0.55, by),
            (bx, by + ah * 0.55),
        ],
        fill=BADGE_ARROW,
    )
    return canvas


def main():
    master = make_background(SIZE)
    master = draw_glyph(master, SIZE)

    import os
    out_dir = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)

    for s in OUT_SIZES:
        resized = master.resize((s, s), Image.LANCZOS)
        resized.save(os.path.join(out_dir, f"icon{s}.png"))
        print(f"wrote icon{s}.png")

    store_dir = os.path.join(os.path.dirname(__file__), "..", "store")
    os.makedirs(store_dir, exist_ok=True)
    master.resize((128, 128), Image.LANCZOS).save(os.path.join(store_dir, "store_icon_128.png"))
    print("wrote store/store_icon_128.png")


if __name__ == "__main__":
    main()
