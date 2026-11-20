"""Pixel-art sprites for lo smistamento (produce, animals, overlays, question icons, truck symbols,
trucks), il laboratorio (axis icons, tool icons) and the shared UI icons; plus the wall tiles.

Run:  .venv/bin/python Game/tools/pixelart/uigen.py
Writes Game/assets/ui/sprites.png + sprites.json, barnwall.png, machine.png, road.png, alpine.png, orchard.png."""
import math, os, json, random
from px import Cv, H, R, mix, pick, bay, hsh, vnoise, pip
from weighgen import (OL, INK, WHITE, RED, GRN, TEAL, BLUE, YEL, ORG, WOOD, DWOOD, METAL, DARK, CREAM, PURP,
                      GLASS, box, hline, vline, outline, fill_poly)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'ui')
UI = {}
BROWN = R('#4a2f22', '#6b4530', '#8c5e3c', '#b07e54', '#d0a47a')
COL = {'rosso': RED, 'verde': GRN, 'giallo': YEL, 'arancione': ORG, 'marrone': BROWN}
PINK = R('#a8455a', '#d0607a', '#ec8aa0', '#f8b8c8')


def new(name, w, h, meta=None):
    c = Cv(w, h)
    UI[name] = (c, meta or {})
    return c


def shade_blob(c, cx, cy, rx, ry, ramp, spec=True):
    c.blob(cx, cy, rx, ry, ramp[1:], None, dither=False, spec=WHITE if (spec and rx >= 4) else None)


# ======================================================================== PRODUCE (20 x 20 box)
def produce(t, colour, big, odd):
    S = 20
    c = Cv(S, S)
    k = 1.0 if big else 0.7
    ramp = COL[colour]
    cx, cy = S / 2, S / 2 + 1
    if t == 'mela':
        rx, ry = 7.5 * k, 7 * k
        if odd:
            shade_blob(c, cx - 1.5 * k, cy + 0.5, rx * 0.8, ry, ramp)
            shade_blob(c, cx + 2.5 * k, cy + 1.5, rx * 0.6, ry * 0.75, ramp, spec=False)
        else:
            shade_blob(c, cx, cy + 0.5, rx, ry, ramp)
            c.set(int(cx), int(cy + 0.5 - ry + 1), ramp[0])
        vline(c, cx, cy - ry - 1.5, cy - ry + 0.5, WOOD[0])
        c.blob(cx + 2.2 * k, cy - ry - 0.8, max(1.3, 2.2 * k), max(0.9, 1.2 * k), GRN[2:], None, dither=False)
    elif t == 'pera':
        if odd:
            shade_blob(c, cx + 1.5 * k, cy + 2.5 * k, 6 * k, 5.5 * k, ramp)
            shade_blob(c, cx - 1.5 * k, cy - 2.8 * k, 3.4 * k, 4 * k, ramp, spec=False)
        else:
            shade_blob(c, cx, cy + 2.5 * k, 6.3 * k, 5.8 * k, ramp)
            shade_blob(c, cx, cy - 3 * k, 3.6 * k, 4.2 * k, ramp, spec=False)
        vline(c, cx, cy - 7.5 * k - 1, cy - 6.5 * k, WOOD[0])
        c.set(int(cx + 1), int(cy - 7.5 * k), GRN[3])
    elif t == 'patata':
        rx, ry = 8 * k, 5.5 * k
        shade_blob(c, cx, cy + 1, rx, ry, ramp, spec=False)
        if odd:
            shade_blob(c, cx + 4 * k, cy - 2.5 * k, 3.4 * k, 3 * k, ramp, spec=False)
            shade_blob(c, cx - 5 * k, cy + 3 * k, 2.6 * k, 2.4 * k, ramp, spec=False)
        for (ox, oy) in ((-3, -1), (2, 1), (4, -2), (-1, 3)):
            c.set(int(cx + ox * k), int(cy + 1 + oy * k), ramp[0])
    elif t == 'pomodoro':
        rx, ry = 8 * k, 6.5 * k
        shade_blob(c, cx, cy + 1, rx, ry, ramp)
        if odd:
            shade_blob(c, cx + 5 * k, cy - 2 * k, 3 * k, 3 * k, ramp, spec=False)
        cyc = cy + 1 - ry
        for (dx, dy) in ((0, 0), (-1, 0), (1, 0), (-2, 1), (2, 1), (0, -1)):
            c.set(int(cx + dx), int(cyc + dy), GRN[2] if dy >= 0 else GRN[3])
    else:  # carota, diagonal
        def cone(x0, y0, x1, y1, w):
            L = math.hypot(x1 - x0, y1 - y0)
            ux, uy = (x1 - x0) / L, (y1 - y0) / L
            px_, py_ = -uy, ux

            def ins(X, Y):
                tt = ((X - x0) * ux + (Y - y0) * uy) / L
                d = (X - x0) * px_ + (Y - y0) * py_
                return 0 <= tt <= 1 and abs(d) <= w * max(0.12, tt)

            def sh(X, Y):
                d = (X + 0.5 - x0) * px_ + (Y + 0.5 - y0) * py_
                tt = ((X - x0) * ux + (Y - y0) * uy) / L
                v = 0.62 - d / w * 0.4 - (0.3 if int(tt * 5) != int((tt + 0.08) * 5) else 0)
                return pick(ramp[1:], v, X, Y, False)
            c.shape(ins, (0, 0, S, S), sh, None)
        if odd:
            cone(4 * k + 1, 17, 12, 7, 3.2 * k)
            cone(9 * k + 2, 18, 13, 7, 3 * k)
        else:
            cone(3, 17 - (1 - k) * 4, 13, 7, 3.6 * k)
        for (a, b) in ((13, 3), (15, 4), (16, 6)):
            c.line(13, 7, a, b, GRN[2])
            c.set(a, b, GRN[3])
    outline(c)
    return c


def produce_all():
    for t in ('mela', 'pera', 'patata', 'pomodoro', 'carota'):
        for colour in COL:
            for big in (0, 1):
                for odd in (0, 1):
                    UI['p_%s_%s_%d%d' % (t, colour, big, odd)] = (produce(t, colour, big, odd), {})


# overlays (drawn over the produce; rot and dirt are clipped to it at runtime)
def overlays():
    c = new('ov_rot', 20, 20)
    ROT = R('#2a2018', '#3e2e22', '#55402e')
    for (x, y, r) in ((8, 10, 2.6), (12.5, 13, 2.0), (6.5, 14, 1.5)):
        c.blob(x, y, r + 1, r + 0.8, [H('#a8a080')], None, dither=False)
    for (x, y, r) in ((8, 10, 2.6), (12.5, 13, 2.0), (6.5, 14, 1.5)):
        c.blob(x, y, r, r * 0.9, ROT, None, dither=False)
    c = new('ov_dirt', 20, 20)
    SOIL = R('#4a3424', '#6b4b33', '#8b6849')
    for y in range(12, 20):
        for x in range(20):
            if hsh(x, y, 3) < 0.55 + (y - 12) * 0.06:
                c.set(x, y, pick(SOIL, hsh(x, y, 5), x, y, False))
    for (x, y) in ((5, 9), (12, 8), (15, 11), (8, 7)):
        c.set(x, y, SOIL[1])
    c = new('ov_worm', 20, 20)
    hole = (13, 9)
    c.blob(hole[0], hole[1], 1.4, 1.2, [H('#2a2018')], None, dither=False)
    pts = [(13, 9), (14, 7), (16, 6), (17, 4), (18, 3)]
    for (x, y) in pts:
        c.set(x, y, PINK[2]); c.set(x + 1, y, PINK[1])
    c.set(18, 2, INK)
    outline(c)
    c = new('ov_snail', 20, 20)
    c.blob(14.5, 4.5, 3, 3, BROWN[1:], OL, dither=False)
    for i in range(8):
        a = i / 8 * 5
        c.set(int(14.5 + math.cos(a) * 1.6 * (1 - i / 10)), int(4.5 + math.sin(a) * 1.6 * (1 - i / 10)), BROWN[0])
    hline(c, 12, 19, 7, CREAM[2]); hline(c, 13, 19, 8, CREAM[1])
    c.set(19, 5, CREAM[2]); c.set(19, 6, CREAM[2]); c.set(18, 4, CREAM[2])
    outline(c)


def animals():
    for colour in COL:
        c = new('a_farfalla_%s' % colour, 20, 20)
        ramp = COL[colour]
        for (x, y, rx, ry) in ((6, 7, 4.5, 4.5), (14, 7, 4.5, 4.5), (7, 13.5, 3.2, 3), (13, 13.5, 3.2, 3)):
            c.blob(x, y, rx, ry, ramp[1:], None, dither=False)
        for (x, y) in ((5, 6), (15, 6)):
            c.set(x, y, CREAM[3])
        vline(c, 10, 5, 16, DARK[1]); vline(c, 9, 6, 15, DARK[2])
        c.set(8, 3, DARK[1]); c.set(12, 3, DARK[1]); c.set(9, 4, DARK[1]); c.set(11, 4, DARK[1])
        outline(c)
        c = new('a_lumaca_%s' % colour, 20, 20)
        hline(c, 2, 17, 15, CREAM[2]); hline(c, 3, 18, 16, CREAM[1]); hline(c, 2, 16, 14, CREAM[3])
        vline(c, 16, 9, 14, CREAM[2]); vline(c, 17, 10, 14, CREAM[2]); c.set(16, 8, CREAM[3]); c.set(18, 8, CREAM[3])
        c.set(17, 11, INK)
        c.blob(9, 10, 5.2, 5, ramp[1:], None, dither=False)
        for i in range(14):
            a = i / 14 * 6
            c.set(int(round(9 + math.cos(a) * 3.2 * (1 - i / 18))), int(round(10 + math.sin(a) * 3.2 * (1 - i / 18))), ramp[0])
        outline(c)
    c = new('a_ape', 20, 20)
    c.blob(9, 11, 6, 4.5, YEL[1:], None, dither=False)
    for x in (7, 10, 13):
        vline(c, x, 7, 15, DARK[1])
    c.blob(16, 10, 2.4, 2.4, DARK[1:], None, dither=False)
    c.blob(8, 5, 3, 2.4, GLASS, None, dither=False); c.blob(12, 5, 2.6, 2, GLASS, None, dither=False)
    c.set(3, 11, DARK[0]); c.set(17, 9, WHITE)
    outline(c)
    c = new('a_coccinella', 20, 20)
    c.blob(10, 11.5, 6.5, 5.5, RED[1:], None, dither=False)
    vline(c, 10, 7, 16, DARK[1])
    for (x, y) in ((7, 9), (13, 9), (6, 13), (14, 13), (8, 15), (12, 15)):
        c.set(x, y, DARK[0])
    c.blob(10, 5.5, 3, 2.2, DARK[1:], None, dither=False)
    c.set(9, 5, WHITE); c.set(11, 5, WHITE)
    outline(c)
    c = new('a_verme', 20, 20)
    pts = [(3, 14), (4, 13), (5, 12), (6, 12), (7, 13), (8, 14), (9, 14), (10, 13), (11, 12), (12, 11), (13, 11), (14, 12), (15, 12), (16, 11), (17, 10)]
    for (x, y) in pts:
        c.set(x, y, PINK[2]); c.set(x, y + 1, PINK[1])
    c.set(17, 9, INK)
    for (x, y) in pts[3::3]:
        c.set(x, y, PINK[3])
    outline(c)


# ======================================================================== QUESTION ICONS (20 x 20)
def mono(src, col):
    c = Cv(src.w, src.h)
    for y in range(src.h):
        for x in range(src.w):
            if src.get(x, y)[3]:
                c.set(x, y, col)
    return c


def questions():
    for colour, ramp in COL.items():
        c = new('q_%s' % colour, 20, 20)
        pts = []
        for i in range(16):
            a = i / 16 * math.tau
            r = 7.5 if i % 2 == 0 else 5.6
            pts.append((10 + math.cos(a) * r, 10 + math.sin(a) * r))
        fill_poly(c, pts, ramp[1:], 0.9, 0.35, 'v', None)
        c.blob(10, 10, 4.5, 4.5, ramp[2:], None, dither=False, spec=WHITE)
        for (x, y) in ((3, 4), (17, 15), (16, 3)):
            c.set(x, y, ramp[2])
        outline(c)
    for t in ('mela', 'pera', 'patata', 'pomodoro', 'carota'):
        UI['q_%s' % t] = (mono(produce(t, 'verde', 1, 0), H('#3a4850')), {})
    src = UI['a_farfalla_giallo'][0]
    UI['q_farfalla'] = (mono(src, H('#3a4850')), {})
    # sporco: a potato with soil
    c = produce('patata', 'giallo', 1, 0)
    ov = UI['ov_dirt'][0]
    for y in range(20):
        for x in range(20):
            if c.get(x, y)[3] and ov.get(x, y)[3]:
                c.set(x, y, ov.get(x, y))
    UI['q_sporco'] = (c, {})
    c = Cv(20, 20)
    src = UI['a_lumaca_marrone'][0]
    for y in range(20):
        for x in range(20):
            if src.get(x, y)[3]:
                c.set(x, y, src.get(x, y))
    UI['q_lumaca'] = (c, {})
    c = produce('mela', 'rosso', 1, 0)
    ov = UI['ov_rot'][0]
    for y in range(20):
        for x in range(20):
            if c.get(x, y)[3] and ov.get(x, y)[3]:
                c.set(x, y, ov.get(x, y))
    for (x, y) in ((3, 3), (5, 2), (16, 2)):
        c.set(x, y, DARK[0])                                   # flies
    UI['q_marcio'] = (c, {})
    UI['q_verme'] = (UI['a_verme'][0], {})
    c = new('q_pesante', 20, 20)                                 # a kettlebell weight
    fill_poly(c, [(4, 17), (5, 9), (15, 9), (16, 17)], DARK, 0.85, 0.35, 'h')
    for x in range(7, 14):
        c.set(x, 6, DARK[2]); c.set(x, 4, DARK[2])
    vline(c, 6, 4, 9, DARK[2]); vline(c, 14, 4, 9, DARK[2])
    hline(c, 7, 13, 13, YEL[3]); c.set(8, 12, YEL[3]); c.set(12, 12, YEL[3])
    outline(c)
    UI['q_strano'] = (produce('carota', 'arancione', 1, 1), {})
    c = new('q_vivo', 20, 20)
    src = UI['a_coccinella'][0]
    for y in range(20):
        for x in range(20):
            if src.get(x, y)[3]:
                c.set(x, y, src.get(x, y))
    for (x, y) in ((15, 2), (17, 2), (14, 3), (18, 3), (14, 4), (18, 4), (15, 5), (17, 5), (16, 6), (16, 3), (15, 3), (17, 3), (15, 4), (16, 4), (17, 4), (16, 5)):
        c.set(x, y, RED[3])                                      # a little heart: "alive"
    UI['q_vivo'] = (c, {})


# ======================================================================== TRUCK SYMBOL PARTS AND TRUCKS
def symbol_parts():
    c = new('s_bin', 20, 20)
    box(c, 4, 6, 12, 12, GRN, OL, 'h', 0.8, 0.35)
    box(c, 3, 4, 14, 2, GRN, OL, 'v', 0.9, 0.6)
    for x in (7, 10, 13):
        vline(c, x, 8, 16, GRN[1])
    box(c, 8, 2, 4, 1, GRN, OL, 'v', 0.8, 0.6)
    c = new('s_hen', 20, 20)
    HEN = R('#c8b8a0', '#e6dcc8', '#f7f1e2', '#ffffff')
    c.blob(10, 12, 6.5, 5, HEN, None, dither=False)
    c.blob(14.5, 6.5, 3, 3, HEN[1:], None, dither=False)
    fill_poly(c, [(3, 11), (2, 5), (6, 8)], HEN[1:], 0.8, 0.5, 'v', None)
    c.set(14, 3, RED[2]); c.set(15, 3, RED[2]); c.set(16, 8, RED[2]); c.set(17, 6, YEL[3]); c.set(15, 6, INK)
    vline(c, 9, 17, 19, YEL[1]); vline(c, 12, 17, 19, YEL[1])
    outline(c)
    c = new('s_orto', 20, 20)
    box(c, 1, 13, 18, 5, BROWN, OL, 'v', 0.8, 0.4)
    for x in (4, 9, 14):
        c.blob(x + 0.5, 11, 2.2, 2, GRN[1:], None, dither=False)
    vline(c, 10, 4, 11, GRN[1])
    c.blob(10, 4, 2.4, 2.4, PINK[1:], None, dither=False); c.set(10, 4, YEL[3])
    outline(c)
    c = new('s_mercato', 20, 20)
    for x in range(1, 19):
        for y in range(3, 8):
            c.set(x, y, RED[2] if (x // 3) % 2 == 0 else CREAM[3])
    for x in range(1, 19, 3):
        c.set(x + 1, 8, RED[2])
    vline(c, 2, 8, 18, WOOD[1]); vline(c, 17, 8, 18, WOOD[1])
    box(c, 2, 13, 16, 3, WOOD, OL, 'v', 0.8, 0.5)
    for x in (5, 9, 13):
        c.blob(x, 12, 1.7, 1.5, ORG[2:] if x != 9 else GRN[2:], None, dither=False)
    outline(c)
    c = new('s_pan', 20, 8)                                      # a scale pan
    fill_poly(c, [(1, 1), (19, 1), (16, 6), (4, 6)], METAL, 0.95, 0.4, 'v')
    c = new('s_tap', 12, 12)
    box(c, 1, 2, 8, 3, METAL, OL, 'v', 0.9, 0.5)
    box(c, 7, 5, 2, 3, METAL, OL, 'h', 0.9, 0.5)
    box(c, 3, 0, 3, 2, BLUE, OL, 'v', 0.9, 0.6)
    for y in (9, 11):
        c.set(8, y, BLUE[3])
    c = new('s_heart', 10, 9)
    for (x, y) in ((2, 1), (3, 1), (6, 1), (7, 1)):
        c.set(x, y, RED[2])
    for y in range(2, 5):
        hline(c, 1, 8, y, RED[2])
    hline(c, 2, 7, 5, RED[2]); hline(c, 3, 6, 6, RED[1]); hline(c, 4, 5, 7, RED[1]); c.set(3, 2, RED[4])
    outline(c)


def trucks():
    # facing left: cab on the left, the load box on the right with a white panel for the symbol
    for name, L, box_w, box_h in (('st_l', 52, 36, 24), ('st_s', 36, 26, 20)):
        r = 4 if name == 'st_l' else 3
        Hh = box_h + 2 * r + 4
        c = new(name, L, Hh)
        g = Hh - 1
        fl = g - 2 * r - 1
        x0 = L - box_w
        box(c, x0, 1, box_w - 1, fl - 1, CREAM, OL, 'v', 0.98, 0.65)
        box(c, x0 + 2, 3, box_w - 5, fl - 5, [WHITE, WHITE], OL, 'v', 0.5, 0.5)
        cab_w = x0 - 2
        fill_poly(c, [(1, fl + 1), (1, fl - 7), (3, fl - 11), (cab_w, fl - 11), (cab_w, fl + 1)], TEAL)
        box(c, 3, fl - 9, max(3, cab_w - 6), 4, GLASS, OL, 'v', 0.9, 0.4)
        box(c, 0, fl - 2, 2, 2, YEL, None, 'v', 0.9, 0.7)
        box(c, 0, fl + 1, L - 1, 2, DARK, OL, 'v', 0.7, 0.4)
        for wx in (max(r + 1, cab_w // 2), L - r - 4):
            c.blob(wx, g - r + 0.5, r + 0.4, r + 0.4, [H('#1a1e20'), H('#2a3034'), H('#3c4448')], OL, dither=False)
            c.blob(wx, g - r + 0.5, r * 0.4, r * 0.4, METAL[2:], None, dither=False)
        UI[name][1].update({'panel': [x0 + 2, 3, box_w - 5, fl - 5], 'box': [x0, 1, box_w - 1]})


# ======================================================================== LAB AXIS ICONS (12 x 12) AND UI ICONS
def lab_icons():
    c = new('i_olive', 12, 12)
    c.blob(6, 7, 3.6, 4.2, R('#2f4a24', '#4a6a2c', '#6e8f3a', '#98b45a'), None, dither=False, spec=WHITE)
    c.line(6, 3, 9, 0, WOOD[1]); c.set(9, 1, GRN[3]); c.set(10, 1, GRN[2])
    outline(c)
    c = new('i_drop', 12, 12)
    fill_poly(c, [(6, 0), (9.5, 6), (9.5, 8), (8, 10.5), (4, 10.5), (2.5, 8), (2.5, 6)], BLUE[1:], 0.95, 0.4, 'h', None)
    c.set(4, 7, WHITE); c.set(4, 6, BLUE[4])
    outline(c)
    c = new('i_butter', 12, 12)
    fill_poly(c, [(1, 6), (4, 3), (11, 3), (8, 6)], YEL[2:], 0.9, 0.9, 'v', None)
    box(c, 1, 6, 7, 4, YEL, OL, 'v', 0.85, 0.55)
    fill_poly(c, [(8, 6), (11, 3), (11, 7), (8, 10)], YEL[1:], 0.4, 0.4, 'v', None)
    outline(c)
    c = new('i_cheese', 12, 12)
    fill_poly(c, [(1, 10), (1, 5), (10, 2), (10, 10)], YEL, 0.85, 0.45, 'h', None)
    for (x, y) in ((4, 7), (7, 5), (7, 8)):
        c.set(x, y, YEL[1])
    outline(c)
    c = new('i_sugar', 12, 12)
    box(c, 2, 3, 7, 7, CREAM, OL, 'v', 0.98, 0.6)
    hline(c, 2, 8, 3, WHITE); c.set(4, 5, CREAM[1]); c.set(6, 7, CREAM[1])
    c = new('i_lemon', 12, 12)
    c.blob(6, 6.5, 4.6, 3.6, YEL[1:], None, dither=False, spec=WHITE)
    c.set(1, 6, YEL[2]); c.set(11, 6, YEL[2]); c.set(8, 2, GRN[2]); c.set(9, 2, GRN[3])
    outline(c)
    c = new('i_thermo', 12, 12)
    box(c, 5, 0, 2, 8, CREAM, OL, 'v', 0.95, 0.7)
    vline(c, 5, 4, 8, RED[2])
    c.blob(6, 9, 2.2, 2.2, RED[1:], OL, dither=False)
    c = new('i_tube', 12, 12)
    box(c, 4, 0, 4, 10, GLASS, OL, 'v', 0.95, 0.6)
    for y in range(5, 10):
        hline(c, 4, 7, y, GRN[2] if y > 5 else GRN[3])
    hline(c, 3, 8, 0, METAL[2])
    c = new('i_honey', 12, 12)
    fill_poly(c, [(2, 3), (10, 3), (10, 10), (2, 10)], YEL[1:], 0.8, 0.35, 'h')
    box(c, 2, 1, 8, 2, CREAM, OL, 'v', 0.9, 0.6)
    hline(c, 3, 9, 6, YEL[0])
    c = new('i_bee', 12, 12)
    c.blob(5.5, 7, 4, 3, YEL[1:], None, dither=False)
    vline(c, 4, 4, 10, DARK[1]); vline(c, 7, 4, 10, DARK[1])
    c.blob(5, 3, 2, 1.5, GLASS, None, dither=False); c.blob(9.5, 6.5, 1.5, 1.5, DARK[1:], None, dither=False)
    outline(c)
    c = new('i_salt', 12, 12)
    box(c, 3, 3, 6, 8, CREAM, OL, 'h', 0.98, 0.65)
    box(c, 3, 1, 6, 2, METAL, OL, 'v', 0.9, 0.5)
    for x in (4, 6, 8):
        c.set(x, 1, DARK[1])


def ui_icons():
    S = 16
    def ic(name):
        return new('u_' + name, S, S)
    c = ic('coin'); c.blob(7.5, 7.5, 7, 7, YEL, OL, dither=False); c.blob(7.5, 7.5, 4, 4, YEL[1:3], None, dither=False); vline(c, 7, 4, 11, YEL[4]); c.set(4, 3, WHITE)
    c = ic('yes')
    for (x, y) in ((2, 8), (3, 9), (4, 10), (5, 11), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5), (12, 4), (13, 3)):
        box(c, x, y, 2, 2, GRN[1:], None, 'v', 0.6, 0.6)
    outline(c)
    for name, col in (('no', DARK), ('noRed', RED)):
        c = ic(name)
        for i in range(10):
            box(c, 3 + i, 3 + i, 2, 2, col, None, 'v', 0.6, 0.6); box(c, 12 - i, 3 + i, 2, 2, col, None, 'v', 0.6, 0.6)
        outline(c)
    c = ic('lock')
    for y in range(1, 8):
        c.set(4, y, METAL[1]); c.set(11, y, METAL[1])
    hline(c, 5, 10, 1, METAL[1]); hline(c, 5, 10, 0, METAL[2])
    box(c, 2, 7, 12, 8, YEL, OL, 'v', 0.9, 0.45); c.set(7, 10, DARK[0]); c.set(8, 10, DARK[0]); c.set(7, 11, DARK[0])
    c = ic('map')
    fill_poly(c, [(1, 3), (5, 1), (10, 3), (15, 1), (15, 13), (10, 15), (5, 13), (1, 15)], CREAM, 0.95, 0.65, 'v')
    vline(c, 5, 2, 13, CREAM[0]); vline(c, 10, 3, 14, CREAM[0])
    c.line(2, 11, 6, 7, GRN[2]); c.line(6, 7, 9, 10, GRN[2]); c.line(9, 10, 14, 5, GRN[2]); c.set(12, 9, RED[2])
    c = ic('help'); c.blob(7.5, 7.5, 7, 7, TEAL[1:], OL, dither=False)
    for (x, y) in ((6, 4), (7, 3), (8, 3), (9, 4), (9, 5), (8, 6), (7, 7), (7, 8), (7, 11)):
        c.set(x, y, WHITE)
    c = ic('shop')
    hline(c, 0, 2, 2, DARK[1]); c.line(2, 2, 4, 10, DARK[1])
    fill_poly(c, [(3, 4), (15, 4), (13, 10), (5, 10)], YEL, 0.95, 0.5, 'v')
    for x in (6, 9, 12):
        vline(c, x, 5, 9, YEL[1])
    hline(c, 4, 13, 11, DARK[1])
    c.blob(6, 13.5, 1.6, 1.6, DARK[1:], None, dither=False); c.blob(12, 13.5, 1.6, 1.6, DARK[1:], None, dither=False)
    c = ic('levels')
    for (x, y, o) in ((1, 1, 1), (9, 1, 1), (1, 9, 1), (9, 9, 0)):
        box(c, x, y, 6, 6, TEAL if o else CREAM, OL, 'v', 0.9, 0.45)
    c = ic('hint'); c.blob(7.5, 6, 5, 5.2, YEL[1:], OL, dither=False, spec=WHITE)
    box(c, 5, 11, 6, 2, METAL, OL, 'v', 0.9, 0.5); hline(c, 6, 9, 14, DARK[1])
    c = ic('lente'); c.blob(6, 6, 5, 5, GLASS, OL, dither=False)
    c.set(4, 4, WHITE); c.set(4, 5, WHITE)
    for i in range(5):
        box(c, 9 + i, 9 + i, 2, 2, WOOD[1:], None, 'v', 0.5, 0.5)
    outline(c)
    c = ic('fast')
    box(c, 1, 10, 14, 3, DARK, OL, 'v', 0.6, 0.4)
    for x in (3, 6, 9, 12):
        c.set(x, 11, METAL[3])
    c.blob(10, 6, 3.4, 3.2, RED[1:], OL, dither=False)
    for y, x0 in ((4, 1), (6, 2), (8, 1)):
        hline(c, x0, x0 + 3, y, TEAL[3])
    c = ic('clear')
    for i in range(0, 14, 2):
        c.set(1 + i, 1, DARK[2]); c.set(1 + i, 14, DARK[2]); c.set(1, 1 + i, DARK[2]); c.set(14, 1 + i, DARK[2])
    for i in range(6):
        c.set(5 + i, 5 + i, RED[2]); c.set(10 - i, 5 + i, RED[2]); c.set(5 + i, 6 + i, RED[1]); c.set(10 - i, 6 + i, RED[1])
    c = ic('trophy')
    fill_poly(c, [(3, 1), (13, 1), (12, 7), (9, 9), (7, 9), (4, 7)], YEL, 0.95, 0.45, 'h')
    c.set(1, 3, YEL[1]); c.set(1, 4, YEL[1]); c.set(2, 5, YEL[1]); c.set(14, 3, YEL[1]); c.set(14, 4, YEL[1]); c.set(13, 5, YEL[1])
    box(c, 7, 9, 2, 3, YEL, None, 'v', 0.7, 0.5); box(c, 4, 12, 8, 3, WOOD, OL, 'v', 0.8, 0.5)
    outline(c)
    c = ic('cog')
    for i in range(16):
        a = i / 16 * math.tau
        r = 7 if i % 2 == 0 else 5.4
        c.blob(7.5 + math.cos(a) * (r - 1.5), 7.5 + math.sin(a) * (r - 1.5), 1.6, 1.6, METAL[1:4], None, dither=False)
    c.blob(7.5, 7.5, 5, 5, METAL[1:4], None, dither=False)
    c.blob(7.5, 7.5, 2, 2, [DARK[1]], None, dither=False)
    outline(c)
    c = ic('sun'); c.blob(7.5, 7.5, 4, 4, YEL[2:], None, dither=False)
    for (dx, dy) in ((0, -7), (0, 7), (-7, 0), (7, 0), (-5, -5), (5, 5), (-5, 5), (5, -5)):
        box(c, 7 + dx * 0.9, 7 + dy * 0.9, 2, 2, YEL[2:], None, 'v', 0.5, 0.5)
    outline(c)
    c = ic('moon'); c.blob(7.5, 7.5, 6.5, 6.5, R('#c9b98f', '#e8d9b0', '#fff1d0'), None, dither=False)
    for y in range(16):
        for x in range(16):
            if math.hypot(x - 11, y - 5) < 5.5:
                c.set(x, y, (0, 0, 0, 0))
    c.set(5, 9, CREAM[1]); c.set(7, 12, CREAM[1])
    outline(c)
    c = ic('place')
    box(c, 1, 1, 14, 5, WOOD, OL, 'v', 0.9, 0.5); box(c, 5, 8, 6, 4, CREAM, OL, 'v', 0.9, 0.5)
    c.set(3, 13, RED[2]); c.set(12, 13, GRN[2]); c.line(6, 12, 3, 13, DARK[1]); c.line(9, 12, 12, 13, DARK[1])
    # lab tools
    c = ic('train')
    for (x, y) in ((3, 4), (6, 11), (3, 13)):
        c.blob(x, y, 2, 2, BLUE[1:], None, dither=False)
    for (x, y) in ((11, 3), (13, 9)):
        fill_poly(c, [(x, y - 2), (x + 2.5, y + 2), (x - 2.5, y + 2)], ORG[1:], 0.9, 0.5, 'v', None)
    outline(c)
    c = ic('test')
    c.blob(5, 10, 3, 3, BLUE[1:], None, dither=False)
    fill_poly(c, [(11, 3), (14.5, 9), (7.5, 9)], ORG[1:], 0.9, 0.5, 'v', None)
    outline(c)
    for i in range(4):
        c.set(10 + i, 13 - i, GRN[1]); c.set(8 + i // 2, 11 + i // 2, GRN[1])
    c = ic('restart')
    for i in range(26):
        a = math.radians(20 + i * 11)
        x, y = 7.5 + math.cos(a) * 5.2, 8 + math.sin(a) * 5.2
        box(c, x - 0.5, y - 0.5, 2, 2, DARK[1:3], None, 'v', 0.5, 0.5)
    fill_poly(c, [(10, 0), (15, 3), (10, 7)], DARK[1:3], 0.6, 0.6, 'v', None)
    c = ic('trash')
    box(c, 3, 5, 10, 10, METAL, OL, 'h', 0.9, 0.4)
    box(c, 1, 3, 14, 2, METAL, OL, 'v', 0.9, 0.5)
    box(c, 6, 1, 4, 1, METAL, OL, 'v', 0.8, 0.6)
    for x in (5, 8, 11):
        vline(c, x, 7, 13, METAL[1])
    c = ic('plus')
    box(c, 6, 1, 4, 14, DARK, OL, 'v', 0.7, 0.5); box(c, 1, 6, 14, 4, DARK, OL, 'v', 0.7, 0.5)
    c = ic('apply')
    for (x, y) in ((2, 8), (3, 9), (4, 10), (5, 11), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5), (12, 4), (13, 3)):
        box(c, x, y, 2, 2, [WHITE, WHITE], None, 'v', 0.5, 0.5)
    c = ic('samples')
    box(c, 1, 10, 14, 3, DARK, OL, 'v', 0.6, 0.4)
    for (x, y, col) in ((4, 6, BLUE), (8, 4, ORG), (12, 7, GRN)):
        c.blob(x, y, 2, 2, col[1:], OL, dither=False)
    c = ic('precision')
    c.blob(6.5, 6.5, 5.5, 5.5, GLASS, OL, dither=False)
    c.blob(6.5, 6.5, 2.5, 2.5, RED[2:], None, dither=False); c.set(6, 6, RED[1])
    for i in range(4):
        box(c, 10 + i, 10 + i, 2, 2, DARK[1:], None, 'v', 0.5, 0.5)


# ======================================================================== WALL TILES
def walls():
    c = Cv(36, 36)                                   # barn planks (darker, so light text reads on it)
    PL = R('#4f3d30', '#5c483a', '#6a5444', '#76604e')
    for x in range(36):
        plank = (x // 9) % 4
        for y in range(36):
            t = 0.3 + [0, 0.25, 0.1, 0.35][plank] + (vnoise(x / 3.0, y / 12.0, 3) - 0.5) * 0.3
            c.set(x, y, PL[0] if x % 9 == 0 else pick(PL, t, x, y, True))
    for (x, y) in ((4, 7), (22, 25), (31, 12)):
        c.set(x, y, PL[0])
    c.im.save(os.path.join(OUT, 'barnwall.png'))


def build_all():
    produce_all(); overlays(); animals(); questions(); symbol_parts(); trucks(); lab_icons(); ui_icons(); farm_sprites(); fun_sprites()


def pack():
    from PIL import Image
    items = sorted(UI.items(), key=lambda kv: (-kv[1][0].h, kv[0]))
    W = 512
    x = y = rowh = 0
    pos = {}
    for name, (c, meta) in items:
        if x + c.w + 1 > W:
            x, y, rowh = 0, y + rowh + 1, 0
        pos[name] = (x, y)
        x += c.w + 1
        rowh = max(rowh, c.h)
    at = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    out = {}
    for name, (c, meta) in items:
        at.paste(c.im, pos[name])
        out[name] = dict(meta, r=[pos[name][0], pos[name][1], c.w, c.h])
    return at, out




def machine_tiles():
    """the sorting machine's steel panels and the road (tiles)"""
    c = Cv(48, 48)
    ST = R('#3f4b52', '#4a575e', '#55626a', '#5f6d74', '#6a7880')
    for y in range(48):
        for x in range(48):
            t = 0.45 + (vnoise(x / 9.0, y / 9.0, 11) - 0.5) * 0.25 - (y % 24) / 24 * 0.15
            col = pick(ST, t, x, y, True)
            if y % 24 == 0:
                col = ST[0]
            elif y % 24 == 1:
                col = ST[4]
            if x % 48 == 0:
                col = ST[0]
            elif x % 48 == 1:
                col = ST[3]
            c.set(x, y, col)
    for (x, y) in ((4, 4), (44, 4), (4, 20), (44, 20), (4, 28), (44, 28), (4, 44), (44, 44)):
        c.set(x, y, ST[4]); c.set(x + 1, y + 1, ST[0])
    for y in range(8, 16, 2):                      # a vent
        hline(c, 18, 30, y, ST[0]); hline(c, 18, 30, y + 1, ST[3])
    c.im.save(os.path.join(OUT, 'machine.png'))
    c = Cv(32, 32)
    AS = R('#3a3f42', '#454b4e', '#50575a', '#5c6366')
    for y in range(32):
        for x in range(32):
            c.set(x, y, pick(AS, 0.45 + (hsh(x, y, 2) - 0.5) * 0.7, x, y, True))
    c.im.save(os.path.join(OUT, 'road.png'))


# ======================================================================== IL FRUTTETO AND IL PASCOLO
TAG = {'r': R('#a8473a', '#d8604c', '#ee8a72'), 'b': R('#36578a', '#4f78b0', '#7da2d0'),
       'y': R('#b8862d', '#e0ac3c', '#f5ca63'), 'p': R('#56427a', '#7a62a4', '#a490cc')}


def farm_sprites():
    GOAT = R('#7a6a58', '#a8957c', '#cfbfa4', '#efe4cc')
    for f in range(3):                          # 0, 1: walking, 2: eating (head down)
        c = new('goat_%d' % f, 16, 13)
        c.blob(7, 7, 5, 3.2, GOAT, None, dither=False)
        hx, hy = (12.5, 4.5) if f < 2 else (13, 8.5)
        c.blob(hx, hy, 2.2, 2, GOAT[1:], None, dither=False)
        c.set(int(hx) - 1, int(hy) - 3, DARK[1]); c.set(int(hx) + 1, int(hy) - 3, DARK[1])     # horns
        c.set(int(hx) + 1, int(hy), INK)
        c.set(int(hx), int(hy) + 2, GOAT[3])                                                  # beard
        legs = (3, 6, 9, 11) if f != 1 else (4, 5, 10, 10)
        for lx in legs:
            vline(c, lx, 10, 12, GOAT[0])
        c.set(1, 6, GOAT[2])
        outline(c)
    for kind in ('ftree', 'ftree_bare'):
        c = new(kind, 20, 24)
        box(c, 9, 14, 2, 9, WOOD, OL, 'h', 0.8, 0.4)
        if kind == 'ftree':
            for (x, y, r) in ((10, 9, 6.5), (5.5, 11, 4.2), (14.5, 11, 4.2), (10, 4.5, 4)):
                c.blob(x, y, r, r * 0.9, GRN[1:], None, dither=False)
            outline(c)
            for (x, y) in ((6, 9), (12, 6), (14, 12), (9, 12), (4, 13), (11, 3)):
                c.set(x, y, RED[2]); c.set(x + 1, y, RED[3]); c.set(x, y + 1, RED[1]); c.set(x + 1, y + 1, RED[2])
        else:
            for (x0, y0, x1, y1) in ((10, 14, 5, 8), (10, 13, 15, 7), (10, 12, 10, 4)):
                c.line(x0, y0, x1, y1, WOOD[1])
            for (x, y) in ((5, 8), (15, 7), (10, 4), (7, 10)):
                c.set(x, y, GRN[2])
            outline(c)
            for (x, y) in ((4, 22), (14, 21)):
                c.set(x, y, RED[1])                                                         # a core on the ground
    for t, ramp in TAG.items():
        for f in (0, 1):
            c = new('sheep_%s_%d' % (t, f), 14, 11)
            WOOL = R('#c8c2b4', '#e6e0d2', '#f7f3ea', '#ffffff')
            for (x, y, r) in ((5, 5, 3.4), (8, 4.5, 3.4), (6.5, 6.5, 3.6), (9.5, 6.5, 3)):
                c.blob(x, y, r, r * 0.85, WOOL, None, dither=False)
            c.blob(12, 5 + f * 0.5, 1.8, 1.8, DARK[1:], None, dither=False)                    # face
            c.set(12, 3, ramp[2]); c.set(11, 3, ramp[1])                                    # ear tag
            for lx in ((4, 9) if f == 0 else (5, 8)):
                vline(c, lx, 9, 10, DARK[1])
            hline(c, 9, 10, 8, ramp[1]); c.set(10, 9, YEL[3])                                # collar + bell
            for (mx, my) in ((5, 3), (6, 3), (7, 3), (5, 4), (6, 4), (7, 4), (8, 4), (6, 5), (7, 5)):
                c.set(mx, my, ramp[2] if (mx + my) % 3 else ramp[1])                         # the herd's paint mark
            outline(c)
        for pose in ('stand', 'sit'):
            c = new('sdog_%s_%s' % (t, pose), 16, 13)
            DOG = R('#2a2420', '#3e342c', '#5a4a3c')
            WHT = R('#d8d0c4', '#f2ece2')
            if pose == 'stand':
                c.blob(7, 7, 5, 2.4, DOG, None, dither=False)
                for lx in (3, 5, 9, 11):
                    vline(c, lx, 9, 12, DOG[1])
                c.set(1, 5, DOG[1]); c.set(0, 4, DOG[2])
                hx, hy = 13, 4.5
            else:
                c.blob(7, 8, 4, 3.4, DOG, None, dither=False)
                hline(c, 4, 10, 12, DOG[1])
                hx, hy = 10.5, 3.5
            c.blob(hx, hy, 2.4, 2.2, DOG[1:], None, dither=False)
            c.set(int(hx) + 1, int(hy), INK); c.set(int(hx) - 1, int(hy) - 2, DOG[0])
            c.set(int(hx) + 2, int(hy) + 1, WHT[1])
            c.set(int(hx) - 2, int(hy) + 2, WHT[1]); c.set(int(hx) - 1, int(hy) + 2, WHT[1])
            for dx in range(-3, 1):
                c.set(int(hx) + dx, int(hy) + 3, ramp[1] if dx % 2 else ramp[2])               # bandana
            outline(c)
    c = new('u_whistle', 16, 16)
    box(c, 2, 6, 10, 6, METAL, OL, 'v', 0.95, 0.45)
    box(c, 11, 6, 4, 3, METAL, OL, 'v', 0.95, 0.5)
    c.blob(6, 9, 2, 2, DARK[1:], None, dither=False)
    hline(c, 0, 2, 9, RED[2]); c.set(0, 8, RED[2]); c.set(0, 10, RED[2])
    for (x, y) in ((13, 2), (15, 4), (11, 1)):
        c.set(x, y, YEL[3])
    c = new('u_timer', 16, 16)
    box(c, 3, 0, 10, 2, WOOD, OL, 'v', 0.9, 0.5); box(c, 3, 14, 10, 2, WOOD, OL, 'v', 0.9, 0.5)
    fill_poly(c, [(4, 2), (12, 2), (8.5, 8), (12, 14), (4, 14), (7.5, 8)], GLASS, 0.9, 0.5, 'v')
    fill_poly(c, [(6, 12), (10, 12), (11, 14), (5, 14)], YEL, 0.9, 0.6, 'v', None)
    c.set(8, 9, YEL[3]); c.set(8, 10, YEL[3])
    c = new('u_fence', 16, 16)
    for x in (2, 7, 12):
        box(c, x, 3, 2, 12, WOOD, OL, 'h', 0.9, 0.5)
    hline(c, 1, 14, 6, WOOD[3]); hline(c, 1, 14, 11, WOOD[3])
    c = new('u_sheep', 16, 16)
    src = UI['sheep_r_0'][0]
    for y in range(src.h):
        for x in range(src.w):
            c.set(x + 1, y + 3, src.get(x, y))


def farm_backgrounds():
    from px import vnoise as vn
    W, Hh = 260, 360
    c = Cv(W, Hh)
    SKY = R('#9cc8dc', '#b4d6e4', '#cde4ea', '#e2eeec')
    for y in range(Hh):
        for x in range(W):
            if y < 70:
                c.set(x, y, pick(SKY, y / 70, x, y, True))
    for (px_, top, hw, col, snow) in ((40, 8, 70, R('#7d93a5', '#93a8bb', '#a5b9ca'), 0.28), (150, 0, 90, R('#8aa0b2', '#9fb3c4', '#b6c8d6'), 0.3),
                                       (240, 14, 70, R('#7d93a5', '#93a8bb', '#a5b9ca'), 0.26), (100, 30, 80, R('#6a8c8a', '#7b9c97', '#8eaca4'), 0.0),
                                       (210, 36, 80, R('#6a8c8a', '#7b9c97', '#8eaca4'), 0.0)):
        for y in range(top, 96):
            f = (y - top) / (96 - top)
            half = f * hw + (vn(y * 0.4, px_, 3) - 0.5) * 4
            for x in range(int(px_ - half), int(px_ + half) + 1):
                if 0 <= x < W:
                    lit = x < px_
                    col_ = R('#e8eff5', '#ffffff') if f < snow else col
                    c.set(x, y, pick(col_, (0.85 if lit else 0.3) - f * 0.2, x, y, True))
    GR = R('#5f9450', '#699e57', '#74a85f', '#7fb267', '#8bbc71', '#9bc67f')
    for y in range(80, Hh):
        for x in range(W):
            if y < 92 and c.get(x, y)[3]:
                continue
            t = 0.25 + (y - 80) / (Hh - 80) * 0.45 + (vn(x / 20.0, y / 14.0, 4) - 0.5) * 0.5
            col = pick(GR, t, x, y, True)
            if hsh(x, y, 6) < 0.012:
                col = [H('#f5ca63'), H('#ffffff'), H('#e07a63'), H('#a490cc')][int(hsh(x, y, 7) * 4)]
            c.set(x, y, col)
    for (x, y) in ((20, 300), (230, 140), (40, 160), (200, 320)):
        c.blob(x, y, 4, 2.6, METAL[1:4], OL, dither=False)                                   # rocks
    c.im.save(os.path.join(OUT, 'alpine.png'))
    t = Cv(48, 48)
    for y in range(48):
        for x in range(48):
            col = pick(GR, 0.5 + (vn(x / 7.0, y / 7.0, 9) - 0.5) * 0.5, x, y, True)
            if hsh(x, y, 2) < 0.02:
                col = GR[5]
            t.set(x, y, col)
    t.im.save(os.path.join(OUT, 'orchard.png'))
    # the village square: warm cobbles (La piazza)
    CB = R('#7a6650', '#9a846a', '#b39d80', '#c9b496', '#dccaa8')
    t = Cv(32, 32)
    for y in range(32):
        for x in range(32):
            row = y // 8
            ox = (x + (4 if row % 2 else 0)) % 32
            bx, by = ox % 8, y % 8
            if bx == 0 or by == 0:
                col = CB[0]
            else:
                tt = 0.55 + (vn(x / 5.0, y / 5.0, 13) - 0.5) * 0.5 + (0.15 if by == 1 or bx == 1 else 0) - (0.15 if by == 7 or bx == 7 else 0)
                col = pick(CB[1:], tt, x, y, True)
            t.set(x, y, col)
    t.im.save(os.path.join(OUT, 'cobbles.png'))


# ======================================================================== LA PIAZZA (quiz) AND IL BOSCO (mushrooms)
def fun_sprites():
    from weighgen import SKIN, HAIR, GLASS
    S = 24
    def q(name):
        return new('qz_' + name, S, S)
    def phone(c, x=6, y=2, w=12, h=20, screen=GLASS):
        box(c, x, y, w, h, DARK, OL, 'v', 0.7, 0.4)
        box(c, x + 1, y + 2, w - 2, h - 5, screen, None, 'v', 0.9, 0.5)
        hline(c, x + w // 2 - 1, x + w // 2, y + h - 2, METAL[3])
    def leaf(c, cx, cy, r, ramp=GRN):
        c.blob(cx, cy, r, r * 0.7, ramp[1:], OL, dither=False)
        c.line(cx - r + 1, cy + 1, cx + r - 1, cy - 1, ramp[0])
    def bubble(c, x, y, w, h, ramp, tail_left=True):
        box(c, x, y, w, h, ramp, OL, 'v', 0.95, 0.6)
        tx = x + 2 if tail_left else x + w - 4
        for i in range(3):
            hline(c, tx, tx + 2 - i, y + h + i, ramp[3] if i < 2 else OL)
    # ---- AI
    c = q('phone_leaf'); phone(c); leaf(c, 12, 10, 4)
    c.set(13, 9, RED[1]); c.set(12, 10, RED[2]); c.set(11, 12, RED[1])
    box(c, 13, 15, 5, 4, GRN[1:], OL, 'v', 0.9, 0.6); c.set(14, 17, WHITE); c.set(15, 18, WHITE); c.set(16, 16, WHITE)
    c = q('drone')
    for x0 in (1, 15):
        hline(c, x0, x0 + 7, 3, METAL[3]); hline(c, x0 + 1, x0 + 6, 4, METAL[2])
    vline(c, 5, 4, 7, DARK[1]); vline(c, 18, 4, 7, DARK[1])
    box(c, 4, 7, 16, 4, RED, OL, 'v', 0.95, 0.5); box(c, 10, 11, 4, 2, DARK, OL, 'v', 0.8, 0.5)
    for i in range(8):
        c.blend(12 - i, 13 + i, (255, 240, 160, 255), 0.5); c.blend(12 + i, 13 + i, (255, 240, 160, 255), 0.5)
    for x in (4, 9, 14, 19):
        leaf(c, x, 21, 2)
    c.set(14, 20, RED[2]); c.set(15, 21, RED[2])
    c = q('chat'); bubble(c, 2, 3, 20, 12, CREAM)
    for x in (7, 11, 15):
        box(c, x, 8, 2, 2, TEAL[1:], None)
    box(c, 13, 18, 9, 4, GRN, OL, 'v', 0.9, 0.5); c.blob(15, 22, 1.6, 1.6, DARK[1:], None, dither=False); c.blob(20, 22, 1.6, 1.6, DARK[1:], None, dither=False)
    c = q('robot')
    box(c, 5, 6, 12, 8, YEL, OL, 'v', 0.95, 0.5); box(c, 7, 8, 3, 2, GLASS, None); box(c, 12, 8, 3, 2, GLASS, None)
    vline(c, 11, 3, 5, DARK[1]); c.set(11, 2, RED[2])
    c.line(17, 11, 20, 15, METAL[1]); c.line(20, 15, 19, 18, METAL[1])
    for x in (6, 15):
        c.blob(x, 16, 2.4, 2.4, DARK[1:], OL, dither=False)
    for (x, y) in ((3, 21), (4, 20), (5, 21)):
        c.set(x, y, GRN[2])
    for (x, y) in ((19, 20), (18, 21), (20, 21), (19, 22), (21, 19)):
        c.set(x, y, YEL[1])
    hline(c, 0, 23, 23, WOOD[1])
    c = q('bubbles'); bubble(c, 1, 2, 13, 9, ORG); bubble(c, 10, 11, 13, 9, BLUE, False)
    for (x, y) in ((5, 5), (6, 4), (7, 5), (5, 6), (7, 6), (6, 6), (8, 7), (4, 7)):
        c.set(x, y, WHITE)
    for x in range(13, 21, 2):
        c.set(x, 14, WHITE); c.set(x, 16, WHITE)
    hline(c, 13, 20, 15, BLUE[4])
    c = q('camera_cow')
    vline(c, 3, 2, 22, METAL[1]); box(c, 3, 3, 9, 5, METAL, OL, 'v', 0.95, 0.5); c.set(11, 5, GLASS[2]); c.set(4, 2, RED[2])
    c.blob(16, 15, 6, 4, CREAM[1:], OL, dither=False); c.blob(21, 12, 2.6, 2.2, CREAM[1:], OL, dither=False)
    for (x, y) in ((14, 14), (15, 14), (17, 16), (18, 15)):
        c.set(x, y, DARK[1])
    for x in (12, 14, 18):
        vline(c, x, 19, 22, DARK[1])
    c.line(20, 19, 22, 22, DARK[1])                                     # the sore leg
    c.set(23, 17, RED[2]); c.set(23, 19, RED[2])
    c = q('trap')
    vline(c, 11, 14, 23, WOOD[1]); box(c, 4, 3, 15, 12, YEL, OL, 'v', 0.95, 0.75)
    for (x, y) in ((7, 6), (12, 9), (15, 5), (8, 11), (16, 12)):
        c.set(x, y, DARK[0]); c.set(x + 1, y, DARK[1]); c.set(x, y + 1, DARK[1])
    c.blob(19, 17, 3.2, 3.2, DARK[1:], OL, dither=False); c.blob(19, 17, 1.6, 1.6, GLASS, None, dither=False)
    c = q('satellite')
    box(c, 1, 4, 7, 4, BLUE, OL, 'v', 0.9, 0.5); box(c, 14, 4, 7, 4, BLUE, OL, 'v', 0.9, 0.5)
    box(c, 9, 3, 4, 6, METAL, OL, 'v', 0.95, 0.5); vline(c, 11, 9, 10, DARK[1])
    for i in range(6):
        c.blend(11 - i, 11 + i, (255, 240, 160, 255), 0.5); c.blend(11 + i, 11 + i, (255, 240, 160, 255), 0.5)
    for y in range(18, 24):
        for x in range(24):
            c.set(x, y, pick(GRN if (x // 6 + (y > 20)) % 2 else YEL, 0.6, x, y, True))
    c = q('phone_face'); phone(c)
    c.blob(12, 10, 3.4, 4, SKIN[1:], None, dither=False); hline(c, 9, 15, 6, HAIR[1]); hline(c, 9, 14, 7, HAIR[1])
    c.set(11, 10, INK); c.set(13, 10, INK); hline(c, 11, 13, 12, SKIN[0])
    for (x, y) in ((7, 4), (8, 4), (7, 5), (16, 4), (17, 4), (17, 5), (7, 15), (7, 16), (8, 16), (17, 15), (17, 16), (16, 16)):
        c.set(x, y, YEL[3])
    c = q('keyboard'); phone(c, 5, 1, 14, 22)
    box(c, 7, 4, 10, 3, CREAM, None, 'v', 1, 1)
    for x in (8, 10, 12):
        c.set(x, 5, DARK[1])
    box(c, 7, 9, 10, 3, YEL, None, 'v', 0.9, 0.9); hline(c, 9, 14, 10, YEL[0])
    for y in (14, 16, 18):
        for x in range(7, 17, 2):
            c.set(x, y, METAL[3])
    c = q('music'); phone(c)
    vline(c, 13, 6, 13, WHITE); vline(c, 14, 6, 7, WHITE); c.set(15, 7, WHITE); c.set(15, 8, WHITE)
    c.blob(11.5, 13.5, 1.8, 1.4, PURP[2:], None, dither=False)
    hline(c, 8, 16, 16, PURP[2]); hline(c, 8, 12, 16, PURP[3])
    c = q('mail')
    box(c, 2, 6, 20, 13, CREAM, OL, 'v', 1, 0.75)
    c.line(2, 6, 12, 13, CREAM[0]); c.line(21, 6, 12, 13, CREAM[0])
    c.blob(18, 17, 4, 4, RED[1:], OL, dither=False)
    for i in range(5):
        c.set(16 + i, 15 + i, WHITE); c.set(20 - i, 15 + i, WHITE)
    # ---- not AI
    c = q('sprinkler')
    vline(c, 7, 12, 22, METAL[1]); box(c, 5, 10, 5, 3, METAL, OL, 'v', 0.9, 0.5)
    for (dx, dy) in ((-4, -4), (-2, -6), (0, -7), (2, -6), (4, -4), (-5, -1), (5, -1)):
        c.set(7 + dx, 9 + dy, BLUE[3]); c.set(7 + dx, 10 + dy, BLUE[2])
    c.blob(17, 15, 6, 6, CREAM[2:], OL, dither=False)
    vline(c, 17, 11, 15, INK); hline(c, 17, 20, 15, INK)
    hline(c, 0, 23, 23, GRN[1])
    c = q('calc')
    box(c, 5, 2, 14, 20, METAL[1:], OL, 'v', 0.7, 0.4); box(c, 7, 4, 10, 4, GRN[3:], None, 'v', 1, 1)
    for (x, y) in ((14, 5), (15, 5), (15, 6), (14, 7), (15, 7)):
        c.set(x, y, GRN[0])
    for y in (10, 13, 16, 19):
        for x in (7, 10, 13, 16):
            box(c, x, y, 2, 2, ORG if (x == 16) else CREAM, None, 'v', 0.9, 0.7)
    c = q('scale')
    box(c, 3, 18, 18, 4, METAL, OL, 'v', 0.95, 0.5); box(c, 9, 19, 6, 2, GRN[3:], None, 'v', 1, 1)
    hline(c, 2, 21, 16, METAL[3]); hline(c, 2, 21, 17, METAL[1])
    c.blob(12, 11, 6, 4.4, YEL[1:], OL, dither=False)
    for (x, y) in ((10, 10), (14, 12), (9, 13)):
        c.set(x, y, YEL[1])
    c = q('fence_bolt')
    for x in (3, 12, 21):
        vline(c, x, 8, 22, WOOD[1]); vline(c, x + 1, 8, 22, WOOD[2])
    for y in (11, 16):
        hline(c, 3, 22, y, YEL[2])
    for (x, y) in ((14, 1), (13, 2), (12, 3), (11, 4), (12, 5), (13, 5), (12, 6), (11, 7), (10, 8)):
        c.set(x, y, YEL[3]); c.set(x + 1, y, YEL[2])
    outline(c)
    c = q('bell')
    c.blob(12, 11, 7, 8, YEL[1:], OL, dither=False)
    for x in range(4, 21):
        for y in range(15, 20):
            if c.get(x, y)[3] == 0 and abs(x - 12) <= 3 + (y - 14):
                c.set(x, y, YEL[2])
    hline(c, 3, 21, 19, YEL[0]); c.blob(12, 21, 2, 1.6, DARK[1:], None, dither=False)
    for (x, y) in ((1, 8), (1, 10), (2, 12), (22, 8), (22, 10), (21, 12)):
        c.set(x, y, RED[2])
    outline(c)
    c = q('thermo')
    box(c, 1, 12, 14, 10, GLASS, OL, 'v', 0.95, 0.6)
    c.line(1, 11, 8, 5, OL); c.line(8, 5, 15, 11, OL)
    for y in range(6, 12):
        hline(c, 8 - (y - 5) + 1, 8 + (y - 5) - 1, y, GLASS[2])
    vline(c, 8, 12, 21, OL)
    for (x, y) in ((4, 18), (5, 17), (11, 18), (12, 17)):
        c.set(x, y, GRN[2])
    box(c, 18, 2, 3, 16, CREAM, OL, 'v', 1, 0.8); vline(c, 19, 7, 18, RED[2]); c.blob(19.5, 19.5, 2.6, 2.6, RED[1:], OL, dither=False)
    c = q('weather')
    vline(c, 12, 6, 23, METAL[1])
    hline(c, 6, 18, 6, METAL[2])
    for x in (6, 18):
        c.blob(x, 7, 1.8, 1.4, RED[1:], OL, dither=False)
    c.blob(12, 4, 1.6, 1.6, METAL[2:], OL, dither=False)
    box(c, 15, 14, 5, 8, GLASS, OL, 'v', 0.95, 0.6); box(c, 15, 18, 5, 4, BLUE[2:], None, 'v', 0.9, 0.6)
    for (x, y) in ((3, 12), (4, 15), (2, 18), (6, 19)):
        c.set(x, y, BLUE[3]); c.set(x, y + 1, BLUE[2])
    c = q('traffic')
    vline(c, 12, 18, 23, METAL[1]); box(c, 8, 1, 8, 18, DARK, OL, 'v', 0.6, 0.4)
    for (y, col) in ((4, RED), (9, YEL), (14, GRN)):
        c.blob(12, y, 2.2, 2.2, col[1:] if y == 14 else DARK[2:], None, dither=False)
    c.blob(12, 14, 2.2, 2.2, GRN[2:], None, dither=False)
    c = q('tractor_gps')
    for x in range(0, 24, 3):
        c.set(x, 20, CREAM[3]); c.set(x + 1, 20, CREAM[3])
    box(c, 6, 11, 11, 5, RED, OL, 'v', 0.95, 0.5); box(c, 12, 7, 5, 4, GLASS, OL, 'v', 0.95, 0.6)
    c.blob(9, 17, 3.6, 3.6, DARK[1:], OL, dither=False); c.blob(17, 18, 2.4, 2.4, DARK[1:], OL, dither=False)
    vline(c, 14, 3, 6, METAL[1]); c.blob(14, 2.5, 2, 1.2, METAL[2:], OL, dither=False)
    for (x, y) in ((18, 1), (20, 2), (21, 4)):
        c.set(x, y, TEAL[3])
    c = q('milk')
    box(c, 5, 8, 14, 14, METAL[1:], OL, 'h', 0.95, 0.45); box(c, 7, 5, 10, 3, METAL[2:], OL, 'v', 0.9, 0.6)
    box(c, 7, 12, 10, 7, CREAM[2:], None, 'v', 1, 0.8)
    for (x, y) in ((11, 13), (12, 14), (13, 13)):
        c.set(x, y, BLUE[2])
    c.line(18, 4, 22, 1, DARK[1]); c.line(18, 5, 22, 2, DARK[2])
    c = q('collar')
    c.blob(12, 12, 9, 8, CREAM[1:], OL, dither=False)
    for (x, y) in ((8, 9), (15, 9)):
        c.set(x, y, INK); c.set(x, y - 1, INK)
    c.blob(12, 15, 4, 2.4, SKIN[2:], OL, dither=False); c.set(10, 15, SKIN[0]); c.set(14, 15, SKIN[0])
    hline(c, 3, 21, 20, BLUE[2]); hline(c, 3, 21, 21, BLUE[1]); box(c, 10, 19, 5, 4, METAL[2:], OL, 'v', 0.9, 0.6)
    # ---- the forest: mushrooms (scene and board), the forager, a pine, basket and hearts
    BRN = R('#4a2c1c', '#6e4128', '#94603a', '#b8844e')
    STEM = R('#b8a88a', '#dcd0b4', '#f2ead8', '#ffffff')
    GREYM = R('#4a5056', '#6a7278', '#8c949a', '#b0b6ba')
    for name, cap, stem, dots in (('mush_good', BRN, STEM, False), ('mush_bad', RED, STEM, True), ('mush_unk', GREYM, GREYM, False)):
        c = new(name, 16, 16)
        box(c, 5, 9, 6, 6, stem, None, 'h', 0.95, 0.5) if name != 'mush_bad' else box(c, 6, 8, 4, 7, stem, None, 'h', 0.95, 0.5)
        if name == 'mush_bad':
            hline(c, 5, 10, 11, stem[1])
        c.blob(8, 7, 7, 4.6, cap[1:], None, dither=False)
        for x in range(1, 15):
            if c.get(x, 9)[3] and c.get(x, 10)[3] == 0:
                c.set(x, 10, cap[0])
        if dots:
            for (x, y) in ((5, 5), (9, 4), (11, 7), (6, 8), (8, 6)):
                c.set(x, y, WHITE)
        c.set(5, 4, cap[-1]); c.set(6, 4, cap[-1])
        outline(c)
    for name, cap, dots in (('mdot_good', BRN, False), ('mdot_bad', RED, True), ('mdot_unk', GREYM, False)):
        c = new(name, 8, 7)
        vline(c, 3, 3, 6, STEM[2] if name != 'mdot_unk' else GREYM[3]); vline(c, 4, 3, 6, STEM[1] if name != 'mdot_unk' else GREYM[2])
        c.blob(3.5, 2.5, 3.4, 2.2, cap[1:], None, dither=False)
        if dots:
            c.set(2, 1, WHITE); c.set(5, 2, WHITE)
        outline(c)
    COAT = R('#2d4a3a', '#3f6650', '#568a6a')
    for f in range(3):
        c = new('forager_%d' % f, 16, 24)
        legs = ((6, 9), (5, 10), (7, 8))[f]
        for i, lx in enumerate(legs):
            vline(c, lx, 17, 22, DWOOD[1] if i else DWOOD[2]); c.set(lx, 23, DARK[0]); c.set(lx + 1, 23, DARK[0])
        box(c, 5, 9, 6, 9, COAT, None, 'h', 0.95, 0.4)
        c.blob(8, 6, 2.6, 2.8, SKIN[1:], None, dither=False); c.set(9, 6, INK)
        hline(c, 4, 12, 3, RED[1]); box(c, 6, 1, 5, 2, RED, None, 'v', 0.95, 0.6)
        arm = (11, 12, 11)[f]
        vline(c, arm, 10, 14, COAT[0])
        box(c, arm - 1, 14, 5, 3, WOOD, None, 'v', 0.95, 0.5); c.line(arm - 1, 14, arm + 1, 12, WOOD[0]); c.line(arm + 1, 12, arm + 3, 14, WOOD[0])
        c.set(4, 12, COAT[0]); c.set(4, 13, SKIN[1])
        outline(c)
    for name, ramp in (('fpine', GRN), ('fpine_d', R('#1e3a32', '#2a4c40', '#3a6050', '#4c7462'))):
        c = new(name, 14, 26)
        box(c, 6, 21, 2, 5, WOOD, None, 'h', 0.8, 0.4)
        for k, (y, w) in enumerate(((3, 2), (7, 3), (11, 4.5), (15, 5.5), (19, 6.5))):
            for yy in range(y - 3, y + 3):
                half = w * (yy - (y - 4)) / 6
                for xx in range(int(7 - half), int(7 + half) + 1):
                    c.set(xx, yy, pick(ramp[1:], 0.75 - (xx - 7 + half) / (2 * half + 0.01) * 0.5, xx, yy, True))
        outline(c, ramp[0])
    c = new('u_basket', 16, 16)
    c.line(3, 7, 7, 2, WOOD[0]); c.line(7, 2, 9, 2, WOOD[0]); c.line(9, 2, 13, 7, WOOD[0])
    box(c, 2, 7, 12, 7, WOOD, OL, 'v', 0.95, 0.45)
    for y in (9, 11):
        hline(c, 2, 13, y, WOOD[1])
    for x in (5, 8, 11):
        vline(c, x, 7, 13, WOOD[2])
    for name, ramp in (('u_heart', RED), ('u_heart_off', DARK)):
        c = new(name, 16, 16)
        c.blob(5, 6, 3.6, 3.4, ramp[1:], None, dither=False); c.blob(11, 6, 3.6, 3.4, ramp[1:], None, dither=False)
        for y in range(7, 15):
            hline(c, 2 + (y - 7) + (1 if y > 8 else 0), 13 - (y - 7) - (1 if y > 8 else 0), y, ramp[2] if y < 10 else ramp[1])
        if name == 'u_heart':
            c.set(4, 4, WHITE); c.set(5, 4, WHITE); c.set(4, 5, WHITE)
        outline(c)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    build_all()
    at, meta = pack()
    at.save(os.path.join(OUT, 'sprites.png'), optimize=True)
    json.dump(meta, open(os.path.join(OUT, 'sprites.json'), 'w'), separators=(',', ':'))
    walls()
    machine_tiles()
    farm_backgrounds()
    print('ui sprites', at.size, len(meta))
