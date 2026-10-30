#!/usr/bin/env python3
"""Figures for 'Optimizing blant-clusters.sh.md'.

SVG is the source; PNG at 2x is what the markdown embeds.
    python3 build_figures.py            # writes fig*.svg and fig*.png next to this file
Needs python3-pillow (text metrics) and rsvg-convert (librsvg) for the PNGs.

Colour carries meaning throughout: orange is master (the old, expensive path),
blue is the branch, grey is neutral. Text is measured with a metric-compatible
font (Nimbus Sans == Helvetica/Arial, DejaVu Sans Mono >= Consolas), so a
figure that passes the fit check here will not overflow on the viewer's machine.

Text rule: a figure holds only what a reader must see in the picture - names on
the boxes, axis labels, legends. No captions, no sub-labels, no footnote prose;
that belongs in the surrounding document.
"""

import os
import subprocess
import sys

from PIL import ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- palette
INK = "#17202B"
INK2 = "#3C4654"
MUTE = "#6A7179"
RULE = "#D9D6CE"
CARD = "#F4F2EC"
CARD2 = "#E9E6DE"
PAPER = "#FFFFFF"
OR = "#D9712B"      # master, stroke
OR_FILL = "#F7E3D3"  # master, tint
OR_TXT = "#8A3F10"   # master, text on tint
BL = "#2F6BD6"      # branch, stroke
BL_FILL = "#DCE7FA"  # branch, tint
BL_TXT = "#23539F"   # branch, text on tint
BAND = "#EFEDE7"

SANS = "Helvetica,Arial,Nimbus Sans,sans-serif"
MONO = "DejaVu Sans Mono,Consolas,Menlo,monospace"

REG = "/usr/share/fonts/gsfonts/NimbusSans-Regular.otf"
BOLD = "/usr/share/fonts/gsfonts/NimbusSans-Bold.otf"
MONOF = "/usr/share/fonts/TTF/DejaVuSansMono.ttf"

SCALE = 1.15   # every font size is multiplied by this; the layout is tuned in these units

_fonts = {}
_problems = []


def _measure(s, size, weight, mono):
    key = (round(size * 10), weight, mono)
    if key not in _fonts:
        path = MONOF if mono else (BOLD if weight in ("600", "700") else REG)
        _fonts[key] = ImageFont.truetype(path, int(round(size * 10)))
    return _fonts[key].getlength(s) / 10.0


def tw(s, size, weight="400", mono=False):
    """Rendered width of s at the given (pre-SCALE) size."""
    return _measure(s, size * SCALE, weight, mono)


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


class Fig:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.body = [f'<rect width="{w}" height="{h}" fill="{PAPER}"/>']

    def raw(self, s):
        self.body.append(s)

    def rect(self, x, y, w, h, fill="none", stroke=None, rx=0, sw=1.2, dash=None, op=None):
        a = [f'x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"',
             f'fill="{fill}"']
        if rx:
            a.append(f'rx="{rx}"')
        if stroke:
            a.append(f'stroke="{stroke}" stroke-width="{sw}"')
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if op is not None:
            a.append(f'opacity="{op}"')
        self.body.append(f'<rect {" ".join(a)}/>')
        return self

    def line(self, x1, y1, x2, y2, stroke=RULE, sw=1.2, dash=None, cap="round", op=None):
        a = [f'x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"',
             f'stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}"']
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if op is not None:
            a.append(f'opacity="{op}"')
        self.body.append(f'<line {" ".join(a)}/>')
        return self

    def path(self, d, stroke=RULE, sw=1.4, fill="none", dash=None, op=None):
        a = [f'd="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"',
             'stroke-linecap="round" stroke-linejoin="round"']
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if op is not None:
            a.append(f'opacity="{op}"')
        self.body.append(f'<path {" ".join(a)}/>')
        return self

    def text(self, x, y, s, size=12, fill=INK, weight="400", anchor="start",
             mono=False, spacing=None, op=None):
        fam = MONO if mono else SANS
        size = round(size * SCALE, 1)
        a = [f'x="{x:.1f}" y="{y:.1f}"', f'font-family="{fam}"', f'font-size="{size}"',
             f'fill="{fill}"', f'font-weight="{weight}"', f'text-anchor="{anchor}"']
        if spacing:
            a.append(f'letter-spacing="{spacing}"')
        if op is not None:
            a.append(f'opacity="{op}"')
        self.body.append(f'<text {" ".join(a)}>{esc(s)}</text>')
        return self

    def arrow(self, x1, y1, x2, y2, color=MUTE, sw=1.4, head=5.0):
        import math
        ang = math.atan2(y2 - y1, x2 - x1)
        bx, by = x2 - head * math.cos(ang), y2 - head * math.sin(ang)
        self.line(x1, y1, bx, by, color, sw)
        p = [(x2, y2),
             (bx - 3.2 * math.sin(ang), by + 3.2 * math.cos(ang)),
             (bx + 3.2 * math.sin(ang), by - 3.2 * math.cos(ang))]
        pts = " ".join(f"{px:.1f},{py:.1f}" for px, py in p)
        self.body.append(f'<polygon points="{pts}" fill="{color}"/>')
        return self

    def card(self, x, y, w, h, lines, fill=CARD, stroke=None, rx=7, align="left",
             pad=12, sw=1.2, dash=None):
        """lines: list of (text, size, weight, mono, colour) tuples."""
        self.rect(x, y, w, h, fill, stroke, rx=rx, sw=sw, dash=dash)
        sizes = [l[1] * SCALE for l in lines]
        block = sum(z * 1.34 for z in sizes)
        if block > h - 2:
            _problems.append(
                f"vertical overflow in card at ({x:.0f},{y:.0f}): block {block:.0f}px > "
                f"{h:.0f}px for {lines[0][0]!r}")
        cur = y + (h - block) / 2
        for (s, size, weight, mono, colour), z in zip(lines, sizes):
            cur += z * 1.34
            base = cur - z * 0.34
            tx = x + pad if align == "left" else x + w / 2
            self.text(tx, base, s, size, colour, weight,
                      anchor="start" if align == "left" else "middle", mono=mono)
            room = w - 2 * pad
            need = _measure(s, z, weight, mono)
            if need > room + 0.5:
                _problems.append(
                    f"overflow in card at ({x:.0f},{y:.0f}): {need:.0f}px > {room:.0f}px "
                    f"for {s!r}")
        return self

    def chip(self, x, y, w, h, s, fill=CARD2, stroke=None, colour=INK, size=10.5,
             weight="600", mono=False, rx=5):
        self.card(x, y, w, h, [(s, size, weight, mono, colour)], fill, stroke, rx=rx,
                  align="center", pad=6)
        return self

    def save(self, name, scale=2):
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" '
               f'height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
               + "".join(self.body) + "</svg>")
        sp = os.path.join(HERE, name + ".svg")
        with open(sp, "w", encoding="utf8") as f:
            f.write(svg)
        subprocess.run(["rsvg-convert", "-w", str(self.w * scale), "-o",
                        os.path.join(HERE, name + ".png"), sp], check=True)
        print(f"  {name}.svg + {name}.png")


# ---------------------------------------------------------------- helpers
def scopes(fig, items, y=52):
    """items: [(x0, x1, label)] - a scope ruler: a bracket with centred label."""
    for x0, x1, label in items:
        fig.line(x0, y, x1, y, RULE, 1.2)
        fig.line(x0, y, x0, y + 7, RULE, 1.2)
        fig.line(x1, y, x1, y + 7, RULE, 1.2)
        fig.text((x0 + x1) / 2, y - 8, label, 14, MUTE, "600", anchor="middle")


def panel_label(fig, x, y, s, colour):
    fig.text(x, y, s.upper(), 13, colour, "700", spacing=1.1)


def badge_num(fig, cx, cy, s, fill=INK, colour=PAPER):
    fig.raw(f'<circle cx="{cx}" cy="{cy}" r="8.5" fill="{fill}"/>')
    fig.text(cx, cy + 3.6, s, 10, colour, "700", anchor="middle")


# ================================================================ Fig 1
def fig1_pipeline():
    f = Fig(1200, 380)
    scopes(f, [(40, 180, "once per k"),
               (200, 990, "once per (k, ED)"),
               (1040, 1160, "once")], y=52)

    f.card(40, 178, 140, 84, [("Sample", 15, "700", False, INK)], CARD, None,
           align="center")
    f.rect(200, 92, 790, 250, "#FBFAF7", RULE, rx=10)

    stages = ["Aggregate", "Sort", "Grow", "Dedupe"]
    xs = [322, 494, 666, 838]
    for ly, ed in zip([110, 184, 258], ["ED 1", "ED 0.9", "ED 0.8"]):
        cy = ly + 29
        f.arrow(180, 220, 202, cy, RULE, 1.3)
        f.chip(206, cy - 17, 78, 34, ed, CARD2, None, INK2, 14, "600", mono=True)
        f.arrow(286, cy, 314, cy, MUTE, 1.3)
        for i, (x, name) in enumerate(zip(xs, stages)):
            f.card(x, ly, 130, 58, [(name, 15, "600", False, INK)], CARD, None, pad=11)
            if i:
                f.arrow(x - 36, cy, x - 8, cy, MUTE, 1.3)
        f.line(968, cy, 986, cy, MUTE, 1.3)

    f.line(986, 139, 986, 287, MUTE, 1.3)
    f.arrow(986, 213, 1036, 213, MUTE, 1.3)
    f.card(1040, 183, 120, 60, [("Merge", 15, "700", False, INK)], CARD, None)
    return f


# ================================================================ Fig 2
def fig2_time():
    f = Fig(1200, 300)
    X0, PPM, AX = 150, 24.0, 250
    x = lambda m: X0 + m * PPM

    for t in (0, 10, 20, 30, 40):
        f.line(x(t), 56, x(t), AX, "#EDEDE8", 1)

    rows = [(60, "ED 1", 0.0, 2.2, "2.2 min"),
            (102, "ED 0.9", 2.2, 5.5, "3.3 min"),
            (144, "ED 0.8", 5.5, 28.2, "22.7 min"),
            (186, "merge", 28.2, 41.4, "13.2 min")]

    for y, label, t0, t1, dur in rows:
        last = label == "merge"
        f.text(138, y + 23, label, 14, INK, "600", anchor="end", mono=not last)
        f.rect(x(t0), y, x(t1) - x(t0), 36, OR if last else OR_FILL, None, rx=5)
        if x(t1) - x(t0) > 190:
            f.text(x(t1) - 12, y + 23, dur, 14, PAPER if last else OR_TXT, "600",
                   anchor="end")
        else:
            f.text(x(t1) + 12, y + 23, dur, 14, OR_TXT, "600")

    f.line(X0, AX, x(41.4), AX, MUTE, 1.2)
    for t in (0, 10, 20, 30, 40):
        f.line(x(t), AX, x(t), AX + 5, MUTE, 1.2)
        f.text(x(t), AX + 24, str(t), 14, MUTE, anchor="middle")
    f.text(X0 - 14, AX + 24, "minutes", 14, MUTE, anchor="end")
    return f


# ================================================================ Fig 3
def fig3_aggregate():
    f = Fig(1200, 240)
    f.line(600, 40, 600, 216, RULE, 1)
    rows = [(96, "ED 1"), (144, "ED 0.9"), (192, "ED 0.8")]

    panel_label(f, 40, 46, "master", OR)
    f.card(40, 116, 140, 52, [("blant5.out", 13, "400", True, INK)], CARD, None, pad=10)
    for y, ed in rows:
        f.card(200, y - 20, 170, 40, [("aggregate " + ed, 14, "600", False, INK)],
               PAPER, RULE, pad=10)
        f.arrow(180, 142, 192, y, OR, 1.2)

    panel_label(f, 630, 46, "branch", BL)
    f.card(630, 116, 140, 52, [("blant5.out", 13, "400", True, INK)], CARD, None, pad=10)
    f.chip(806, 124, 80, 36, "split", BL_FILL, BL, BL_TXT, 14)
    f.arrow(770, 142, 802, 142, BL, 1.2)
    for y, ed in rows:
        f.card(920, y - 20, 130, 40, [("counts " + ed, 14, "600", False, INK)],
               PAPER, BL, pad=10)
        f.arrow(886, 142, 912, y, BL, 1.2)
    return f


# ================================================================ Fig 4
def fig4_growth():
    f = Fig(1200, 280)
    W, GAP = 196, 40
    x = lambda i: 40 + i * (W + GAP)

    panel_label(f, 40, 44, "master", OR)
    for i, name in enumerate(["candidate u", "scan S twice", "insert u",
                              "dense enough?", "remove u"]):
        f.card(x(i), 60, W, 64, [(name, 15, "600", False, INK)], CARD, None, pad=12)
        if i:
            f.arrow(x(i) - GAP + 4, 92, x(i) - 8, 92, MUTE, 1.3)

    panel_label(f, 40, 176, "branch", BL)
    BW, BG = 240, 44
    bx = lambda i: 40 + i * (BW + BG)
    for i, name in enumerate(["candidate u", "inD(u)", "density with u?"]):
        f.card(bx(i), 192, BW, 64, [(name, 15, "600", False, INK)], PAPER, BL, pad=12)
        if i:
            f.arrow(bx(i) - BG + 4, 224, bx(i) - 8, 224, MUTE, 1.3)
    ax = bx(3)
    f.arrow(ax - BG + 4, 224, ax - 8, 224, MUTE, 1.3)
    f.card(ax, 192, BW, 64,
           [("YES \u2192 insert u", 14, "600", False, BL_TXT),
            ("NO \u2192 skip u", 14, "600", False, INK2)], PAPER, BL, pad=12)
    return f


# ================================================================ Fig 5
def fig5_merge():
    f = Fig(1200, 320)
    f.line(600, 40, 600, 292, RULE, 1)
    rows = [68 + i * 38 for i in range(6)]
    cy = [y + 17 for y in rows]
    names = ["cluster 1", "cluster 2", "cluster 3", "cluster 4", "cluster 5", "\u2026"]

    panel_label(f, 40, 46, "master", OR)
    f.card(60, 150, 140, 60, [("new cluster", 15, "600", False, INK)], CARD, None, pad=10)
    for y, n, c in zip(rows, names, cy):
        f.card(380, y, 150, 34, [(n, 14, "400", False, INK2)], PAPER, OR, rx=5, pad=10)
        f.arrow(204, 180, 372, c, OR, 1.1, head=4)

    panel_label(f, 630, 46, "branch", BL)
    f.card(650, 150, 140, 60, [("new cluster", 15, "600", False, INK)], CARD, None, pad=10)
    f.card(820, 155, 150, 50, [("index", 15, "700", False, INK)], BL_FILL, BL, pad=12)
    f.arrow(790, 180, 812, 180, MUTE, 1.3)
    for i, (y, n, c) in enumerate(zip(rows, names, cy)):
        if i in (1, 4):
            f.card(1020, y, 150, 34, [(n, 14, "600", False, BL_TXT)], BL_FILL, BL,
                   rx=5, pad=10)
            f.arrow(970, 180, 1012, c, BL, 1.3, head=4)
        else:
            f.card(1020, y, 150, 34, [(n, 14, "400", False, MUTE)], PAPER, CARD2,
                   rx=5, pad=10)
    return f


# ================================================================ Fig 6
def fig6_speedup():
    import math
    f = Fig(1200, 472)
    X0, X1, Y0, Y1 = 150, 1140, 110, 330
    lg = math.log10
    x = lambda v: X0 + (lg(v) - 1) / lg(30000) * (X1 - X0)
    y = lambda v: Y1 - (lg(v) / lg(60)) * (Y1 - Y0)

    f.text(X0, 94, "speedup over master (log scale)", 14, MUTE)
    for t in (1, 2, 5, 10, 20, 50):
        f.line(X0, y(t), X1, y(t), "#EDEDE8", 1)
        f.text(X0 - 14, y(t) + 5, f"{t}\u00d7", 14, MUTE, anchor="end")
    f.line(X0, Y1, X1, Y1, MUTE, 1.1, dash="4 4")

    # the PPI networks: the report gives a range, not per-network cluster counts
    f.rect(x(10), y(2.1), x(1100) - x(10), y(1.4) - y(2.1), BAND, None, rx=4)
    f.text(x(10) + 14, y(2.1) - 12, "14 PPI networks \u00b7 1.4\u20132.1\u00d7", 14, INK2,
           "600")

    for t, lbl in [(10, "10"), (100, "100"), (1000, "1,000"), (10000, "10,000"),
                   (30000, "30,000")]:
        f.text(x(t), Y1 + 24, lbl, 14, MUTE, anchor="middle")
    f.text((X0 + X1) / 2, Y1 + 50, "clusters produced by the run (log scale)", 14, MUTE)

    pts = [(14796, 42.8, "1", "com-DBLP", "42.8\u00d7", 130, 412),
           (13988, 33.2, "2", "com-Amazon", "33.2\u00d7", 640, 412),
           (19821, 28.8, "3", "com-Amazon", "28.8\u00d7", 130, 442),
           (1494, 1.7, "4", "com-Youtube", "1.7\u00d7", 640, 442)]
    for cl, sp, num, name, dur, kx, ky in pts:
        cx, cy = x(cl), y(sp)
        f.raw(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="8" fill="{BL}"/>')
        f.text(cx, cy + 3.8, num, 13, PAPER, "700", anchor="middle")
        f.raw(f'<circle cx="{kx+9}" cy="{ky-5}" r="9" fill="{BL}"/>')
        f.text(kx + 9, ky - 1, num, 13, PAPER, "700", anchor="middle")
        f.text(kx + 26, ky, name, 14, INK, "600")
        f.text(kx + 300, ky, dur, 14, BL_TXT, "600", anchor="end")
    return f


# ================================================================ Fig 7
def fig7_memory():
    f = Fig(1200, 230)
    X0, GB, CAP = 320, 26.7, 8.0
    x = lambda g: X0 + g * GB

    f.line(x(CAP), 48, x(CAP), 168, OR, 1.2, dash="5 4")
    f.text(x(CAP), 40, "8 GB RAM", 14, OR_TXT, "700", anchor="middle")

    f.text(40, 86, "all 9 pipelines at once", 14, INK, "600")
    f.rect(X0, 60, x(21) - X0, 40, OR, None, rx=5)
    f.text(X0 + 14, 86, "3 copies \u00d7 >7 GB", 14, PAPER, "600")
    f.text(x(21) + 14, 86, "> 21 GB", 14, INK2, "600")

    f.text(40, 146, "one ED at a time", 14, INK, "600")
    f.rect(X0, 120, x(7.5) - X0, 40, BL_FILL, None, rx=5)
    f.text(X0 + 14, 146, "one copy, >7 GB", 14, BL_TXT, "600")

    f.line(X0, 180, x(24), 180, MUTE, 1.1)
    for g in (0, 8, 16, 24):
        f.line(x(g), 180, x(g), 185, MUTE, 1.1)
        f.text(x(g), 206, f"{g} GB", 14, MUTE, anchor="middle")
    return f


# ================================================================ main
def main():
    print("figures ->", HERE)
    for fn, name in [(fig1_pipeline, "fig1-pipeline"),
                     (fig2_time, "fig2-time"),
                     (fig3_aggregate, "fig3-aggregate"),
                     (fig4_growth, "fig4-growth"),
                     (fig5_merge, "fig5-merge"),
                     (fig6_speedup, "fig6-speedup"),
                     (fig7_memory, "fig7-memory")]:
        fn().save(name)

    if _problems:
        print("\nTEXT DOES NOT FIT:")
        for p in _problems:
            print("  " + p)
        sys.exit(1)
    print("all text fits its box")


if __name__ == "__main__":
    main()
