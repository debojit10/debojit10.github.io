#!/usr/bin/env python3
"""
Generate the Open Graph card and the PNG favicon fallback.

    pip install pillow "fonttools[woff]" brotli
    python tools/og.py

Writes:
    assets/img/og.png        1200x630 social card
    assets/favicon-32.png    32x32 fallback for engines that ignore SVG favicons

The card is the hero, cropped: a reader who sees the link preview in Slack has
already seen the name, the one-sentence claim and the four numbers before
deciding to click — the same twenty-second contract the page makes. It obeys
the site's zero-imagery rule too, so the preview and the page are visibly the
same artefact.

Fonts are instanced straight out of assets/fonts/, so the card can never drift
from what the site renders. Re-run only when the headline figures change.
"""

from __future__ import annotations

import datetime
import io
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow is required:  pip install pillow")

try:
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
except ImportError:
    sys.exit('fonttools is required:  pip install "fonttools[woff]" brotli')

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "assets" / "fonts"

# Always the LIGHT palette. Social platforms composite previews over their own
# chrome and a dark card fights it.
PAPER = "#FBF8F3"
INK = "#16130F"
INK_2 = "#4A443B"
MUTED = "#595248"
RULE = "#777065"
ACCENT = "#B4302A"

W, H = 1200, 630
L, R = 80, 1120  # left and right margins

METRICS = [
    ("Response-quality gain", "26", "%"),
    ("Inference cost cut", "60", "%"),
    ("Chats analysed", "30", "K+"),
    ("Tenants in production", "7", ""),
]

DECK = [
    "I build LLM agents, RAG systems, and the evaluation",
    "pipelines that keep them honest in production.",
]


# --------------------------------------------------------------------------- #
# font loading
# --------------------------------------------------------------------------- #
def static_face(woff2: Path, **axes) -> io.BytesIO:
    """Instance a variable woff2 down to a static TTF that FreeType can use."""
    font = TTFont(woff2)
    if "fvar" in font and axes:
        font = instancer.instantiateVariableFont(font, axes, inplace=False)
    buf = io.BytesIO()
    font.flavor = None  # write plain TTF, not woff2
    font.save(buf)
    buf.seek(0)
    return buf


def load(woff2: Path, size: int, **axes) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(static_face(woff2, **axes), size)


# --------------------------------------------------------------------------- #
# drawing helpers — PIL has no letter-spacing, so we do it a glyph at a time
# --------------------------------------------------------------------------- #
def tracked_width(draw, text, font, track):
    return sum(draw.textlength(c, font=font) for c in text) + track * max(len(text) - 1, 0)


def tracked(draw, xy, text, font, fill, track=0.0, anchor="ls"):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor=anchor)
        x += draw.textlength(ch, font=font) + track
    return x


def tracked_right(draw, xy, text, font, fill, track=0.0, anchor="ls"):
    x, y = xy
    tracked(draw, (x - tracked_width(draw, text, font, track), y), text, font, fill, track, anchor)


def rule(draw, x0, y0, x1, thickness, colour):
    draw.rectangle([x0, y0, x1 - 1, y0 + thickness - 1], fill=colour)


def fit_tracked(draw, xy, text, load_font, fill, avail, track=2.4, size=16, floor=13):
    """Draw tracked text that fits `avail` px, giving up tracking before size.

    The cell labels vary from 14 to 21 characters; at a fixed size the longest
    of them collides with the next cell's divider.
    """
    while True:
        font = load_font(size)
        w = tracked_width(draw, text, font, track)
        if w <= avail:
            return tracked(draw, xy, text, font, fill, track)
        if track > 1.0:
            track = max(1.0, track - 0.2)
            continue
        if size > floor:
            size -= 1
            continue
        return tracked(draw, xy, text, font, fill, track)


# --------------------------------------------------------------------------- #
def build_og() -> Path:
    roman = FONTS / "newsreader-roman-var.woff2"
    italic = FONTS / "newsreader-italic.woff2"
    mono = FONTS / "plex-mono-500.woff2"

    f_masthead = load(roman, 150, wght=300, opsz=72)
    f_fig = load(roman, 76, wght=300, opsz=72)
    f_unit = load(roman, 25, wght=300, opsz=48)
    f_deck = load(italic, 34, wght=300)
    f_micro = load(mono, 17)

    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # 1. eyebrow
    tracked(d, (L, 58), "SELECTED WORK & SYSTEMS", f_micro, MUTED, 2.6)
    # Computed, not hard-coded: the page derives this from the build date and
    # the card must not drift away from it.
    span = "2022 — %d" % datetime.date.today().year
    tracked_right(d, (R, 58), span, f_micro, MUTED, 2.6)

    # 2. chapter rule
    rule(d, L, 96, R, 3, INK)

    # 3. masthead
    d.text((L, 258), "Debojit Nath", font=f_masthead, fill=INK, anchor="ls")

    # 4. deck
    for i, line in enumerate(DECK):
        d.text((L, 330 + i * 46), line, font=f_deck, fill=INK_2, anchor="ls")

    # 5-6. the ledger
    rule(d, L, 424, R, 1, RULE)
    cell_w = (R - L) // 4
    for i, (label, value, unit) in enumerate(METRICS):
        x = L + i * cell_w
        inset = 0 if i == 0 else 24
        if i:
            d.rectangle([x, 425, x, 556], fill=RULE)
        avail = cell_w - inset - (0 if i == 3 else 24)
        fit_tracked(d, (x + inset, 456), label.upper(),
                    lambda sz: load(mono, sz), MUTED, avail)
        end = d.text((x + inset, 536), value, font=f_fig, fill=INK, anchor="ls")
        if unit:
            vw = d.textlength(value, font=f_fig)
            d.text((x + inset + vw + 4, 536), unit, font=f_unit, fill=INK, anchor="ls")
        del end

    # 7-8. foot
    rule(d, L, 566, R, 1, RULE)
    tracked(d, (L, 596), "NATHDEBOJIT2000@GMAIL.COM", f_micro, MUTED, 2.6)
    tracked_right(d, (R, 596), "DEBOJIT10.GITHUB.IO", f_micro, MUTED, 2.6)

    out = ROOT / "assets" / "img" / "og.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, optimize=True)
    return out


# The SVG favicon inverts with the OS theme; a PNG cannot. Engines that fall
# back to the PNG (notably Safari) show it on a light tab strip in light mode
# and a dark one in dark mode, so the ink rules are drawn in a mid value that
# is legible against both rather than in the page's near-black.
FAVICON_INK = "#8A8377"


def build_favicon() -> Path:
    """The same three marks as assets/favicon.svg, so the two cannot drift."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([3, 7, 28, 10], fill=FAVICON_INK)
    d.rectangle([3, 13, 28, 14], fill=FAVICON_INK)
    d.rectangle([3, 21, 28, 24], fill=ACCENT)
    out = ROOT / "assets" / "favicon-32.png"
    img.save(out, optimize=True)
    return out


if __name__ == "__main__":
    for path in (build_og(), build_favicon()):
        print(f"{path.relative_to(ROOT).as_posix():28s} {os.path.getsize(path) / 1024:6.1f} KB")
