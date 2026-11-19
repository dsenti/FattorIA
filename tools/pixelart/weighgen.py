"""Pixel-art sprites for "La stazione di pesatura": people, produce, animals, crates, wheels,
vehicles, scanners, unloading tools and the shed interior. One art pixel = 1.5 CSS px.

Run:  .venv/bin/python Game/tools/pixelart/weighgen.py
Writes Game/assets/weigh/sprites.png + sprites.json (atlas: name -> [x, y, w, h] plus meta)
and Game/assets/weigh/shed.png (the background)."""
import math, os, json, random
from px import Cv, H, R, mix, pick, bay, hsh, vnoise, pip

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'weigh')

OL = H('#2c3639')
INK = H('#22313a')
WHITE = H('#ffffff')
RED = R('#7a3328', '#a8473a', '#d8604c', '#ee8a72', '#f8b8a4')
GRN = R('#2f5e3c', '#477f4f', '#66a061', '#93c27f', '#c2e0a4')
TEAL = R('#2d5058', '#3f6c76', '#5a8f99', '#86b6bd', '#bcdde0')
BLUE = R('#273f63', '#36578a', '#4f78b0', '#7da2d0', '#b4cbe8')
YEL = R('#8a6420', '#b8862d', '#e0ac3c', '#f5ca63', '#fbe3a0')
ORG = R('#8a4a1c', '#b8642a', '#e08a3c', '#f2ad62', '#f8d09a')
WOOD = R('#4a3424', '#6b4b33', '#8b6849', '#ad8a62', '#cfae84')
DWOOD = R('#3a2a20', '#4d382a', '#614736', '#775a44')
METAL = R('#3f4b52', '#5a6870', '#7d8b92', '#a6b2b8', '#d2dadd', '#f2f5f6')
DARK = R('#1e2427', '#2c3639', '#3f4b52', '#55626a')
SKIN = R('#a8745a', '#cf9a7c', '#efc4a4', '#f8dcc4')
CREAM = R('#a89a80', '#cfc2a6', '#e8dfc8', '#f7f1e2', '#ffffff')
PURP = R('#3e2f52', '#56427a', '#7a62a4', '#a490cc')
HAIR = R('#2a1d18', '#4a3226', '#6b4a36')
GREYH = R('#8a8f96', '#b8bcc2', '#e2e4e8')
GLASS = R('#6fa0b4', '#9cc8d8', '#d4eef6')
RUBBER = R('#1a1e20', '#2a3034', '#3c4448')

SPR = {}   # name -> (Cv, meta)


def new(name, w, h, meta=None):
    c = Cv(w, h)
    SPR[name] = (c, meta or {})
    return c


def box(c, x, y, w, h, ramp, ol=OL, light='v', t0=0.85, t1=0.35):
    """filled rect with outline; shaded top->bottom ('v') or left->right ('h')."""
    x, y, w, h = int(round(x)), int(round(y)), int(round(w)), int(round(h))
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            f = ((yy - y) / max(1, h - 1)) if light == 'v' else ((xx - x) / max(1, w - 1))
            c.set(xx, yy, pick(ramp, t0 + (t1 - t0) * f, xx, yy, False))
    if ol is not None:
        for xx in range(x - 1, x + w + 1):
            c.set(xx, y - 1, ol); c.set(xx, y + h, ol)
        for yy in range(y, y + h):
            c.set(x - 1, yy, ol); c.set(x + w, yy, ol)


def hline(c, x0, x1, y, col):
    for x in range(int(round(x0)), int(round(x1)) + 1):
        c.set(x, int(round(y)), col)


def vline(c, x, y0, y1, col):
    for y in range(int(round(y0)), int(round(y1)) + 1):
        c.set(int(round(x)), y, col)


def outline(c, col=OL):
    """1 px outline around every opaque pixel (outside)."""
    m = set((x, y) for y in range(c.h) for x in range(c.w) if c.get(x, y)[3])
    for (x, y) in m:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p not in m and c.ok(*p):
                c.set(p[0], p[1], col)


def flipped(c):
    o = Cv(c.w, c.h)
    for y in range(c.h):
        for x in range(c.w):
            o.set(c.w - 1 - x, y, c.get(x, y))
    return o


# ======================================================================== PEOPLE
# Adults 15 x 25, children 12 x 20; facing right. Frames: stand, walk1, walk2, carry, carry1, carry2,
# push1, push2, tablet. meta.hand = [x, y] where a carried load sits (top of the head / hands).
PEOPLE = {
    'man': dict(skin=SKIN, hat=('straw', YEL), top=CREAM, pants=BLUE, overall=True, shoes=WOOD, hair=HAIR, beard=True),
    'woman': dict(skin=SKIN, hat=('scarf', RED), top=CREAM, pants=GRN, skirt=True, shoes=WOOD, hair=HAIR),
    'person': dict(skin=SKIN, hat=('cap', TEAL), top=RED, check=True, pants=BLUE, shoes=DWOOD, hair=HAIR),
    'boy': dict(skin=SKIN, hat=('cap', RED), top=YEL, pants=BLUE, shorts=True, shoes=METAL, hair=HAIR, kid=True),
    'nonna': dict(skin=SKIN, hat=('bun', GREYH), top=PURP, pants=PURP, skirt=True, shoes=DARK, hair=GREYH, glasses=True, shawl=True),
}


def person(name, pose):
    p = PEOPLE[name]
    kid = p.get('kid')
    W, Hh = (12, 20) if kid else (15, 25)
    if name == 'nonna':
        W, Hh = 14, 23
    c = Cv(W, Hh)
    s = Hh / 25.0
    cx = W // 2
    head_top = int(round(4 * s)) if not kid else 3
    head_h = int(round(6 * s)) + (1 if kid else 0)
    sh_y = head_top + head_h          # shoulders
    hip_y = sh_y + int(round(7 * s))
    foot_y = Hh - 1
    walk = {'walk1': 1, 'walk2': -1, 'carry1': 1, 'carry2': -1, 'push1': 1, 'push2': -1}.get(pose, 0)
    carry = pose.startswith('carry')
    push = pose.startswith('push')
    # ---- legs
    legc = p['pants']
    for side, off in ((-1, 0), (1, 0)):
        lx = cx + (-2 if side < 0 else 1)
        sw = walk * side
        for y in range(hip_y, foot_y):
            t = (y - hip_y) / max(1, foot_y - hip_y)
            xx = lx + int(round(sw * 1.6 * t))
            col = pick(legc, 0.7 if side < 0 else 0.45, xx, y, False)
            if p.get('shorts') and t > 0.45:
                col = pick(p['skin'], 0.6, xx, y, False)
            c.set(xx, y, col); c.set(xx + 1, y, pick(legc, 0.5 if side < 0 else 0.3, xx, y, False) if not (p.get('shorts') and t > 0.45) else pick(p['skin'], 0.4, xx, y, False))
        fx = lx + int(round(sw * 1.6))
        for dx in (0, 1, 2):
            c.set(fx + dx - (0 if True else 1), foot_y, pick(p['shoes'], 0.5, 0, 0, False))
    # ---- skirt
    if p.get('skirt'):
        for y in range(hip_y - 1, foot_y - 1):
            t = (y - hip_y) / max(1, foot_y - hip_y)
            half = 3 + int(t * 2.2)
            for x in range(cx - half, cx + half + 1):
                cc = pick(p['pants'], 0.62 - (x - cx + half) / (2 * half + 1) * 0.4, x, y, False)
                if name == 'woman' and abs(x - cx - 1) <= 1 and y > hip_y and y < foot_y - 3:
                    cc = pick(CREAM, 0.75 - (x - cx + half) / (2 * half) * 0.3, x, y, False)   # apron
                c.set(x, y, cc)
    # ---- torso
    for y in range(sh_y, hip_y + 1):
        half = 3 if not kid else 3
        for x in range(cx - half, cx + half + 1):
            t = (x - cx + half) / (2 * half)
            cc = pick(p['top'], 0.85 - t * 0.5, x, y, False)
            if p.get('check') and (x + y) % 2 == 0:
                cc = pick(p['top'], 0.95, x, y, False) if (x // 2 + y // 2) % 2 else pick(CREAM, 0.8, x, y, False)
            if p.get('overall') and y > sh_y + 1:
                if abs(x - cx) <= 2:
                    cc = pick(p['pants'], 0.8 - t * 0.5, x, y, False)
            if p.get('shawl') and y < sh_y + 3:
                cc = pick(PURP, 0.95 - t * 0.4, x, y, False)
            c.set(x, y, cc)
    if p.get('overall'):
        c.set(cx - 2, sh_y, pick(p['pants'], 0.6)); c.set(cx + 2, sh_y, pick(p['pants'], 0.6))
        c.set(cx - 2, sh_y + 1, pick(p['pants'], 0.6)); c.set(cx + 2, sh_y + 1, pick(p['pants'], 0.6))
        c.set(cx - 1, sh_y + 3, YEL[3]); c.set(cx + 1, sh_y + 3, YEL[3])
    # ---- arms
    armc = p['top'] if not p.get('check') else RED
    skin = p['skin']
    def arm(points, sleeve=0.6):
        for i, (x, y) in enumerate(points):
            col = pick(skin, 0.55) if i >= len(points) - 2 else pick(armc, sleeve)
            c.set(x, y, col)
    if carry:
        # both arms raised to steady the load on the head
        for side in (-1, 1):
            ax = cx + side * 4
            pts = [(ax, y) for y in range(sh_y + 2, head_top - 3, -1)]
            arm(pts, 0.75 if side < 0 else 0.45)
    elif push:
        for side in (-1, 1):
            ax = cx + side * 4
            pts = [(ax, sh_y + 1), (ax + 1, sh_y + 2), (ax + 2, sh_y + 3), (ax + 3, sh_y + 3), (ax + 4, sh_y + 3)]
            arm(pts, 0.7 if side < 0 else 0.45)
    elif pose == 'tablet':
        pts = [(cx - 4, sh_y + 1), (cx - 4, sh_y + 2), (cx - 4, sh_y + 3), (cx - 4, sh_y + 4), (cx - 4, sh_y + 5)]
        arm(pts, 0.75)
        pts = [(cx + 4, sh_y + 1), (cx + 4, sh_y + 2), (cx + 4, sh_y + 3), (cx + 5, sh_y + 3), (cx + 6, sh_y + 3)]
        arm(pts, 0.45)
        box(c, cx + 5, sh_y + 1, 3, 4, DARK, OL, 'v', 0.6, 0.4)
        c.set(cx + 6, sh_y + 2, GLASS[2]); c.set(cx + 6, sh_y + 3, GLASS[1])
    else:
        for side in (-1, 1):
            ax = cx + side * 4
            sw = walk * side
            pts = [(ax, sh_y + 1), (ax, sh_y + 2), (ax, sh_y + 3), (ax + (sw if True else 0), sh_y + 4), (ax + sw, sh_y + 5), (ax + sw, sh_y + 6)]
            arm(pts, 0.75 if side < 0 else 0.45)
    # ---- head
    hx0, hx1 = cx - 3, cx + 3
    for y in range(head_top, head_top + head_h):
        for x in range(hx0, hx1 + 1):
            corner = (y in (head_top, head_top + head_h - 1)) and x in (hx0, hx1)
            if corner:
                continue
            c.set(x, y, pick(skin, 0.85 - (x - hx0) / 6 * 0.45, x, y, False))
    ey = head_top + head_h // 2 - 1 + (1 if kid else 0)
    c.set(cx + 1, ey, INK); c.set(cx + 3, ey, INK)              # eyes (facing right)
    c.set(cx + 3, ey + 2, pick(skin, 0.3))                     # nose shadow
    if p.get('beard'):
        hline(c, cx + 1, cx + 3, ey + 2, HAIR[1])
    if p.get('glasses'):
        c.set(cx + 1, ey, INK); c.set(cx + 2, ey, METAL[3]); c.set(cx + 3, ey, INK)
    c.set(cx + 2, ey + 3, pick(skin, 0.25)) if not p.get('beard') else None
    # hair at the back
    for y in range(head_top, head_top + head_h - 2):
        c.set(hx0, y, pick(p['hair'], 0.5)); c.set(hx0 + 1, y, pick(p['hair'], 0.6)) if y < head_top + 2 else None
    # ---- hats
    kind, hr = p['hat']
    if kind == 'straw':
        hline(c, hx0 - 2, hx1 + 2, head_top, pick(hr, 0.55))
        hline(c, hx0 - 2, hx1 + 2, head_top + 1, pick(hr, 0.35)) if False else None
        for y in range(head_top - 3, head_top):
            hline(c, hx0, hx1, y, pick(hr, 0.8 - (head_top - y) * 0.05))
        hline(c, hx0, hx1, head_top - 1, RED[2])                # hat band
        hline(c, hx0 - 2, hx1 + 2, head_top, pick(hr, 0.6))
    elif kind == 'scarf':
        for y in range(head_top - 2, head_top + 2):
            hline(c, hx0 - (1 if y > head_top - 2 else 0), hx1 - (1 if y >= head_top else 0), y, pick(hr, 0.75 - (y - head_top) * 0.08))
        for y in range(head_top + 2, head_top + head_h - 1):
            c.set(hx0 - 1, y, pick(hr, 0.5)); c.set(hx0, y, pick(hr, 0.6))
        c.set(hx0 - 2, head_top + head_h - 1, pick(hr, 0.5)); c.set(hx0 - 1, head_top + head_h, pick(hr, 0.4))
        for x in range(hx0 + 1, hx1, 2):
            c.set(x, head_top - 1, CREAM[3])                    # polka dots
    elif kind == 'cap':
        for y in range(head_top - 2, head_top + 1):
            hline(c, hx0, hx1 - 1, y, pick(hr, 0.8 - (head_top - y) * 0.05))
        hline(c, hx1 - 1, hx1 + 2, head_top, pick(hr, 0.45))    # visor to the front
    elif kind == 'bun':
        for y in range(head_top - 1, head_top + 2):
            hline(c, hx0, hx1 - (1 if y > head_top else 0), y, pick(hr, 0.85 - (y - head_top + 1) * 0.15))
        c.blob(hx0 + 0.5, head_top - 1.5, 1.8, 1.6, hr, None, dither=False)
    if carry:
        for side in (-1, 1):
            ax = cx + side * 4
            for y in range(sh_y + 2, head_top - 3, -1):
                c.set(ax, y, pick(skin, 0.55) if y < head_top else pick(armc, 0.75 if side < 0 else 0.45))
    outline(c)
    hand = [cx - 1, head_top - 3 if kind in ('straw', 'cap', 'scarf') else head_top - 2]
    return c, {'foot': [cx, Hh - 1], 'hand': hand}


def make_people():
    for nm in PEOPLE:
        for pose in ('stand', 'walk1', 'walk2', 'carry', 'carry1', 'carry2', 'push1', 'push2', 'tablet'):
            c, meta = person(nm, pose)
            SPR['%s_%s' % (nm, pose)] = (c, meta)
    # drivers: head and shoulders, for seats
    for nm in ('man', 'woman', 'person'):
        c, meta = person(nm, 'stand')
        bust = Cv(c.w, 13)
        for y in range(13):
            for x in range(c.w):
                bust.set(x, y, c.get(x, y))
        SPR['%s_bust' % nm] = (bust, {'seat': [c.w // 2, 12]})


# ======================================================================== PRODUCE, ANIMALS, CRATES
def apple(c, x, y, s=1.0, ramp=RED):
    r = 3.4 * s
    c.blob(x + r + 0.5, y + r + 1.5, r, r * 0.95, ramp[1:], OL, dither=False, spec=WHITE if s >= 1 else None)
    c.set(int(x + r + 0.5), int(y + 1), WOOD[0])
    c.set(int(x + r + 1.5), int(y + 0.5), GRN[3]); c.set(int(x + r + 2.5), int(y + 0.5), GRN[2])


def make_units():
    c = new('unit_mele', 9, 9); apple(c, 0.5, 0)
    c = new('unit_carote', 12, 6)
    pts = [(0.5, 3), (2, 1.6), (8.5, 1.2), (8.5, 4.8), (2, 4.4)]
    c.poly(pts, lambda x, y: pick(ORG[1:], 0.9 - (y - 1) / 4 * 0.6, x, y, False), OL)
    for x in (3, 5, 7):
        c.set(x, 2, ORG[1])
    for (x, y) in ((9, 2), (10, 1), (10, 3), (11, 2), (11, 0), (11, 4)):
        c.set(x, y, GRN[3] if (x + y) % 2 else GRN[2])
    c = new('unit_castagne', 8, 7)
    c.poly([(0.5, 6.5), (1, 3), (4, 0.5), (7, 3), (7.5, 6.5)], lambda x, y: pick(WOOD[:4], 0.8 - (x) / 7 * 0.5, x, y, False), OL)
    hline(c, 1, 6, 5, CREAM[1]); hline(c, 1, 6, 6, CREAM[1])
    c.set(2, 2, WOOD[4]); c.set(4, 0, DWOOD[1])
    c = new('unit_uva', 9, 11)
    GR = R('#7a8a2a', '#a4b440', '#cad466', '#e6ec9a')
    for (bx, by) in ((2, 3), (5, 3), (3.5, 5), (6.5, 5), (1.5, 5.5), (2.5, 7), (5, 7), (3.8, 9)):
        c.blob(bx + 1, by + 1, 1.6, 1.6, GR, None, dither=False)
    outline(c)
    vline(c, 4, 0, 2, WOOD[1]); c.set(5, 1, GRN[2]); c.set(6, 1, GRN[3])
    c = new('unit_zucche', 13, 11)
    for (ox, r) in ((3, 3.6), (9, 3.6), (6, 4.4)):
        c.blob(ox + 0.5, 6.5, r, 3.8, ORG[1:], None, dither=False, spec=None)
    outline(c)
    vline(c, 4, 4, 9, ORG[1]); vline(c, 8, 4, 9, ORG[1])
    box(c, 6, 1, 1, 2, GRN, OL, 'v', 0.5, 0.4)
    # animals (2 walk frames each), facing right
    for f in (0, 1):
        c = new('unit_mucche_%d' % f, 22, 16)
        # Podolica: grey-white Matese cattle with curved horns
        COW = R('#8f9296', '#b9bcc0', '#dcdee0', '#f2f3f4')
        c.blob(10, 7.5, 7.5, 4.5, COW, None, dither=False)
        legs = [(5, 0), (8, 1), (13, 0), (16, 1)] if f == 0 else [(5, 1), (8, 0), (13, 1), (16, 0)]
        for (lx, ph) in legs:
            vline(c, lx + ph, 11, 14, COW[1]); c.set(lx + ph, 15, DARK[1])
        c.blob(18.5, 6.5, 2.6, 2.4, COW[1:], None, dither=False)
        box(c, 19, 7, 2, 2, SKIN, None, 'v', 0.4, 0.3)
        c.set(19, 5, INK)
        hline(c, 17, 18, 3, CREAM[3]); c.set(16, 2, CREAM[2]); c.set(19, 2, CREAM[2]); c.set(20, 2, CREAM[3])
        vline(c, 2, 7, 10, COW[1]); c.set(1, 11, DARK[1])
        c.set(12, 11, SKIN[2])
        outline(c)
    for f in (0, 1):
        c = new('unit_galline_%d' % f, 10, 10)
        HEN = R('#a8673a', '#cc8a4e', '#e8b070', '#f6d6a0')
        c.blob(4.5, 5.5, 3.6, 2.8, HEN, None, dither=False)
        c.poly([(1, 5), (0, 2), (2.5, 3.5)], lambda x, y: HEN[1], None)
        c.blob(7.3, 3.2, 1.8, 1.8, HEN[1:], None, dither=False)
        c.set(7, 1, RED[2]); c.set(8, 1, RED[2]); c.set(8, 5, RED[2])
        c.set(9, 3, YEL[3]); c.set(8, 3, INK)
        c.set(3, 5, HEN[0]); c.set(4, 6, HEN[0])
        for lx in ((3, 6) if f == 0 else (4, 5)):
            vline(c, lx, 8, 9, YEL[1])
        outline(c)


def crate(name, unit=None):
    """crate with a slanted top (3D), produce heaped inside; 12 x 11."""
    c = new(name, 13, 11)
    # top (back) face
    c.poly([(0, 3), (3, 0), (12.5, 0), (9.5, 3)], lambda x, y: WOOD[1], None)
    # side face
    c.poly([(9.5, 3), (12.5, 0), (12.5, 7.5), (9.5, 10.5)], lambda x, y: pick(WOOD[:3], 0.5, x, y, False), None)
    # front
    box(c, 0, 3, 10, 8, WOOD[1:], None, 'v', 0.85, 0.5)
    hline(c, 0, 9, 6, WOOD[1]); hline(c, 0, 9, 3, WOOD[4])
    vline(c, 0, 3, 10, WOOD[4])
    if unit:
        rnd = random.Random(hash(unit) & 0xffff)
        col = {'mele': RED, 'carote': ORG, 'castagne': WOOD, 'uva': R('#7a8a2a', '#a4b440', '#cad466', '#e6ec9a'), 'zucche': ORG}[unit]
        for k in range(14):
            px_, py_ = 1.5 + rnd.random() * 9.5, 0.6 + rnd.random() * 2.6
            if pip(px_, py_, [(0, 3.2), (3, 0.2), (12.5, 0.2), (9.5, 3.2)]):
                rr = 1.3 if unit != 'zucche' else 1.8
                c.blob(px_, py_, rr, rr * 0.8, col[1:4], None, dither=False)
        if unit == 'carote':
            for k in range(4):
                c.set(3 + k * 2, 0, GRN[3])
    outline(c)


def make_crates():
    crate('crate')
    for u in ('mele', 'carote', 'castagne', 'uva', 'zucche'):
        crate('crate_' + u, u)


def wheel(r, frame):
    s = int(2 * r + 1)
    c = new('wheel_%d_%d' % (r, frame), s, s)
    cc = r
    for y in range(s):
        for x in range(s):
            d = math.hypot(x - cc, y - cc)
            if d <= r + 0.3:
                if d > r - max(1.2, r * 0.32):
                    c.set(x, y, pick(RUBBER, 0.8 - (x + y) / (2 * s) * 0.8, x, y, False))
                elif d > r * 0.3:
                    c.set(x, y, pick(METAL[1:], 0.75 - (x + y) / (2 * s) * 0.5, x, y, False))
                else:
                    c.set(x, y, METAL[1])
    # spokes / bolts that turn with the frame
    for k in range(3 if r < 6 else 4):
        a = frame * math.pi / (6 if r < 6 else 8) + k * 2 * math.pi / (3 if r < 6 else 4)
        for t in (0.35, 0.5, 0.62):
            c.set(int(round(cc + math.cos(a) * r * t)), int(round(cc + math.sin(a) * r * t)), METAL[0])
    outline(c)


def make_wheels():
    for r in (3, 4, 5, 6, 7, 8):
        for f in range(4):
            wheel(r, f)



# ======================================================================== VEHICLES
# Facing left (front at x = 0), rear at the right edge, wheels drawn separately (meta.wheels).
# meta: ground (y of the road), bed [x0, x1, floorY], wheels [[cx, cy, r]], lip (sprite drawn over
# the load: the near side board), lipAt [x, y].
VEH = [
    dict(kind='ape', L=50, color=TEAL),
    dict(kind='pickup', L=58, color=RED),
    dict(kind='pickup', L=62, color=GRN, slats=True),
    dict(kind='cabover', L=68, color=CREAM, stripe=BLUE, side=6),
    dict(kind='cabover', L=72, color=RED, side=7, tall=True),
    dict(kind='cabover', L=78, color=BLUE, side=7, tall=True, axles=2, stack=True),
    dict(kind='tractor', L=86, color=GRN, side=7),
    dict(kind='tractor', L=92, color=RED, side=8, axles=2, beacon=True, big=True),
    dict(kind='cabover', L=94, color=GRN, side=8, tall=True, axles=3, stack=True, big=True),
    dict(kind='semi', L=100, color=RED, side=7, axles=3, stack=True),
    dict(kind='future', L=104, color=CREAM, side=6),
]


def fill_poly(c, pts, ramp, t0=0.85, t1=0.4, axis='v', ol=OL):
    ys = [p[1] for p in pts]; xs = [p[0] for p in pts]
    y0, y1, x0, x1 = min(ys), max(ys), min(xs), max(xs)

    def sh(x, y):
        f = (y - y0) / max(1, y1 - y0) if axis == 'v' else (x - x0) / max(1, x1 - x0)
        return pick(ramp, t0 + (t1 - t0) * f, x, y, False)
    c.poly(pts, sh, ol)


def window(c, x, y, w, h):
    box(c, x, y, w, h, GLASS, OL, 'v', 0.9, 0.3)
    for k in range(min(w, h)):
        if 1 + k < w and 1 + k < h:
            c.set(x + 1 + k, y + h - 2 - k, GLASS[2]) if k < 2 else None


def bed_parts(c, x0, x1, floor, side, ramp, slats=False, wood=False, lip_h=None):
    """platform + front/rear boards; returns the lip sprite (near side board)."""
    br = WOOD if wood else ramp
    box(c, x0, floor, x1 - x0, 3, DARK, OL, 'v', 0.7, 0.3)                    # platform
    box(c, x0, floor - side, 2, side, br, OL, 'h', 0.8, 0.5)                  # front board
    box(c, x1 - 2, floor - side, 2, side, br, OL, 'h', 0.6, 0.3)              # tailgate
    lh = lip_h if lip_h is not None else max(3, side // 2)
    lip = Cv(x1 - x0 + 2, lh + 2)
    box(lip, 1, 1, x1 - x0, lh, br, OL, 'v', 0.85, 0.45)
    if slats or wood:
        for xx in range(4, x1 - x0 - 2, 5):
            vline(lip, xx, 1, lh, pick(br, 0.3))
    hline(lip, 1, x1 - x0, 1, pick(br, 0.95))
    return lip


def vehicle(i):
    v = VEH[i]
    L = v['L']
    kind = v['kind']
    col = v['color']
    Hh = {'ape': 32, 'pickup': 34, 'cabover': 40 if not v.get('tall') else 46, 'tractor': 48, 'semi': 50, 'future': 46}[kind]
    if v.get('big'):
        Hh += 4
    c = Cv(L, Hh)
    g = Hh - 1          # road
    meta = {'ground': g}
    wheels = []
    if kind == 'ape':
        r = 4
        floor = g - 2 * r - 1
        cab_w = 18
        # cabin: rounded front, door, windscreen
        pts = [(1, floor + 2), (1, floor - 9), (3, floor - 15), (7, floor - 18), (cab_w, floor - 18), (cab_w, floor + 2)]
        fill_poly(c, pts, col)
        window(c, 3, floor - 15, 6, 6)
        window(c, 11, floor - 15, 5, 6)
        hline(c, 2, cab_w - 1, floor - 5, pick(col, 0.2))
        c.set(2, floor - 3, YEL[3]); c.set(2, floor - 2, YEL[2])               # headlight
        box(c, 8, floor - 18, 9, 1, col, OL, 'v', 0.95, 0.9)                    # roof
        lip = bed_parts(c, cab_w + 1, L - 1, floor, 5, WOOD, wood=True)
        meta['bed'] = [cab_w + 3, L - 3, floor]
        wheels = [[7, g - r, r], [L - 10, g - r, r]]
    elif kind == 'pickup':
        r = 5
        floor = g - 2 * r
        hood_x, cab_x1 = 13, 27
        fill_poly(c, [(1, floor + 3), (1, floor - 5), (hood_x - 1, floor - 7), (hood_x + 2, floor - 16), (cab_x1, floor - 16), (cab_x1, floor + 3)], col)
        window(c, hood_x + 3, floor - 14, 9, 6)
        hline(c, 1, cab_x1 - 1, floor - 2, pick(col, 0.25))
        box(c, 1, floor - 1, 3, 2, YEL, None, 'v', 0.9, 0.7)
        box(c, 0, floor + 1, 4, 2, METAL, OL, 'v', 0.8, 0.4)                    # bumper
        side = 7 if v.get('slats') else 4
        lip = bed_parts(c, cab_x1 + 1, L - 1, floor, side, col, slats=v.get('slats'), wood=v.get('slats'))
        meta['bed'] = [cab_x1 + 3, L - 3, floor]
        wheels = [[8, g - r, r], [L - 11, g - r, r]]
    elif kind == 'cabover':
        r = 6 if not v.get('big') else 7
        floor = g - 2 * r - 1
        cab_w = 20 if not v.get('tall') else 22
        top = floor - (20 if not v.get('tall') else 25) - (3 if v.get('big') else 0)
        fill_poly(c, [(1, floor + 3), (1, top + 3), (3, top), (cab_w, top), (cab_w, floor + 3)], col)
        window(c, 3, top + 3, 8, 8)
        window(c, 13, top + 3, cab_w - 15, 6)
        if v.get('stripe'):
            hline(c, 1, cab_w - 1, floor - 4, pick(v['stripe'], 0.5)); hline(c, 1, cab_w - 1, floor - 3, pick(v['stripe'], 0.7))
        box(c, 0, floor, 4, 3, METAL, OL, 'v', 0.8, 0.4)
        box(c, 1, floor - 6, 2, 2, YEL, None, 'v', 0.9, 0.7)
        hline(c, 2, cab_w - 2, top + 13, pick(col, 0.2))                       # door line
        vline(c, cab_w - 3, top + 12, floor, pick(col, 0.2))
        if v.get('stack'):
            box(c, cab_w + 1, top - 4, 2, floor - top + 2, METAL, OL, 'h', 0.9, 0.4)
        side = v.get('side', 6)
        lip = bed_parts(c, cab_w + (4 if v.get('stack') else 1), L - 1, floor, side, col)
        meta['bed'] = [cab_w + (6 if v.get('stack') else 3), L - 3, floor]
        ax = v.get('axles', 1)
        wheels = [[9, g - r, r]] + [[L - 12 - k * (2 * r + 2), g - r, r] for k in range(ax)]
    elif kind == 'tractor':
        big = v.get('big')
        rr, rf = (8, 5) if not big else (9, 6)
        rr = min(rr, 8)
        tw = 34 if not big else 38
        floor_t = g - 2 * rf - 2
        # hood and body
        fill_poly(c, [(1, g - 2 * rf - 1), (1, g - 2 * rf - 10), (14, g - 2 * rf - 12), (tw - 12, g - 2 * rf - 12), (tw - 12, g - 2 * rf - 1)], col)
        for xx in range(3, 13, 2):
            vline(c, xx, g - 2 * rf - 9, g - 2 * rf - 5, pick(col, 0.2))          # grille slats
        box(c, 1, g - 2 * rf - 11, 2, 2, YEL, None, 'v', 0.9, 0.7)
        # cab frame and roof
        cx0, cx1 = tw - 16, tw - 2
        top = g - 2 * rr - 26 if not big else g - 2 * rr - 30
        box(c, cx0, top, cx1 - cx0, 2, col, OL, 'v', 0.9, 0.6)
        for xx in (cx0, cx1 - 2):
            box(c, xx, top + 2, 2, g - 2 * rf - 12 - top - 2 + 6, DARK, OL, 'h', 0.6, 0.3)
        window(c, cx0 + 2, top + 3, cx1 - cx0 - 4, 9)
        box(c, cx0 - 1, g - 2 * rr - 3, cx1 - cx0 + 2, 4, col, OL, 'v', 0.8, 0.4)   # fender over the big wheel
        if v.get('beacon'):
            box(c, cx0 + 6, top - 2, 3, 2, ORG, OL, 'v', 0.95, 0.7)
        box(c, 6, g - 2 * rf - 17, 2, 6, METAL, OL, 'h', 0.9, 0.4)               # exhaust
        # drawbar + trailer
        tr0 = tw + 2
        floor = g - 2 * 6 - 2
        box(c, tw - 4, floor + 2, tr0 - tw + 6, 2, DARK, OL, 'v', 0.6, 0.4)
        lip = bed_parts(c, tr0, L - 1, floor, v.get('side', 7), col if big else WOOD, wood=not big)
        meta['bed'] = [tr0 + 2, L - 3, floor]
        ax = v.get('axles', 1)
        wheels = [[8, g - rf, rf], [cx0 + 6, g - rr, rr]] + [[L - 12 - k * 14, g - 6, 6] for k in range(ax)]
        meta['driver'] = [cx0 + 7, g - 2 * rf - 12]
    elif kind == 'semi':
        r = 6
        floor = g - 2 * r - 2
        cab_w = 24
        top = floor - 28
        fill_poly(c, [(1, floor + 3), (1, top + 4), (4, top), (cab_w, top), (cab_w, floor + 3)], col)
        box(c, 6, top - 4, cab_w - 8, 4, col, OL, 'v', 0.9, 0.6)                 # sleeper roof
        window(c, 3, top + 4, 9, 9)
        window(c, 14, top + 4, 7, 7)
        box(c, 0, floor, 5, 3, METAL, OL, 'v', 0.8, 0.4)
        box(c, 1, floor - 7, 2, 2, YEL, None, 'v', 0.9, 0.7)
        hline(c, 2, cab_w - 2, top + 15, pick(col, 0.2))
        box(c, cab_w + 1, top - 6, 2, floor - top + 4, METAL, OL, 'h', 0.9, 0.4)
        lip = bed_parts(c, cab_w + 5, L - 1, floor, v.get('side', 7), RED[1:] + [RED[4]])
        meta['bed'] = [cab_w + 7, L - 3, floor]
        wheels = [[10, g - r, r], [cab_w - 4 + 12, g - r, r]] + [[L - 12 - k * 14, g - r, r] for k in range(3)]
    else:  # future
        r = 6
        floor = g - 2 * r - 2
        cab_w = 26
        top = floor - 24
        pts = [(1, floor + 2), (1, floor - 6), (6, top + 6), (12, top), (cab_w, top), (cab_w, floor + 2)]
        fill_poly(c, pts, CREAM)
        window(c, 8, top + 3, 15, 8)
        for xx in range(2, cab_w - 1):
            c.set(xx, floor - 3, TEAL[3] if (xx // 2) % 2 else TEAL[2])            # LED strip
        box(c, 0, floor - 1, 3, 2, TEAL, None, 'v', 0.95, 0.8)
        lip = bed_parts(c, cab_w + 2, L - 1, floor, v.get('side', 6), CREAM)
        for xx in range(1, lip.w - 1):
            lip.set(xx, lip.h - 2, TEAL[3] if (xx // 2) % 2 else TEAL[2])
        meta['bed'] = [cab_w + 4, L - 3, floor]
        wheels = [[10, g - r, r]] + [[L - 12 - k * 14, g - r, r] for k in range(3)]
    # dark wheel arches
    for (wx, wy, wr) in wheels:
        for y in range(int(wy - wr - 1), int(wy) + 1):
            for x in range(int(wx - wr - 1), int(wx + wr + 2)):
                if math.hypot(x - wx, y - wy) <= wr + 1.2 and c.ok(x, y) and c.get(x, y)[3]:
                    c.set(x, y, DARK[0])
    meta['wheels'] = wheels
    meta['lipAt'] = [meta['bed'][0] - 3, meta['bed'][2] - lip.h + 1]
    SPR['veh_%d' % i] = (c, meta)
    SPR['veh_%d_lip' % i] = (lip, {})


def make_vehicles():
    for i in range(len(VEH)):
        vehicle(i)


# ======================================================================== SCANNERS
# Anchor: centre bottom (on the floor). meta.inner = [x0, x1, top, bottom]: the opening the
# produce rides through (the belt passes at the bottom), for the scan beam.
SC_H = [42, 45, 48, 51, 55, 58, 62, 66, 70, 75, 81]
SC_W = [28, 28, 30, 30, 32, 34, 36, 38, 40, 42, 46]


def scanner(i, smart=False):
    Hh = SC_H[i]
    W = SC_W[i] + (4 if i >= 6 else 0)
    TOP = 14 if smart else 6               # headroom for beacons, dials, the computer
    c = Cv(W + 4, Hh + TOP + 1)
    g = Hh + TOP
    cx = (W + 4) // 2
    x0, x1 = 2, W + 1
    wood = i <= 2
    ramps = [WOOD, WOOD, WOOD, METAL, TEAL, TEAL, BLUE, BLUE, GRN, YEL, CREAM]
    ramp = ramps[i]
    pw = 3 if i < 3 else 4 if i < 6 else 5 if i < 9 else 6
    bh = 4 if i < 3 else 6 if i < 6 else 8 if i < 9 else 10
    top = g - Hh + (2 if i < 3 else 0)
    glow = [None, None, None, YEL, GRN, GRN, TEAL, TEAL, TEAL, RED, TEAL][i]
    lean = 2 if i == 0 else 0
    # ---- columns
    for (px_, side) in ((x0, -1), (x1 - pw + 1, 1)):
        for y in range(top + bh, g - 1):
            t = (y - top) / max(1, g - top)
            off = int(round(lean * (1 - t))) if side < 0 else 0
            for xx in range(pw):
                col = pick(ramp, 0.9 - xx / max(1, pw - 1) * 0.5, px_ + xx, y, False)
                if i == 9 and ((y + xx) // 3) % 2 == 0 and 1 <= xx < pw - 1:
                    col = DARK[1]                                                     # hazard stripes
                c.set(px_ + xx + off, y, col)
            c.set(px_ - 1 + off, y, OL); c.set(px_ + pw + off, y, OL)
        if glow and not wood:
            ex = px_ + pw - 1 if side < 0 else px_                                      # emitter strip faces inside
            for y in range(top + bh + 2, g - 4):
                c.set(ex, y, glow[4] if (y % 3) else glow[3])
        if i >= 4 and not wood:
            for y in range(top + bh + 4, top + bh + 10, 2):                            # vents
                hline(c, px_ + 1, px_ + pw - 2, y, pick(ramp, 0.2))
    # ---- housing / beam
    ov = 0 if i < 3 else 1 if i < 6 else 2
    box(c, x0 - ov, top, x1 - x0 + 1 + 2 * ov, bh, ramp, OL, 'v', 0.95, 0.45)
    if wood:
        for xx in range(x0 + 2, x1, 5):
            c.set(xx, top + 1, DARK[0])                                                # nails
        if i == 0:
            vline(c, cx, top + bh, top + bh + 5, CREAM[1])
            c.blob(cx, top + bh + 7, 1.7, 1.9, YEL[2:], OL, dither=False)
            for yy in range(top + bh + 9, g - 12, 2):
                c.set(x1 - pw - 2, yy, YEL[3])
            c.set(x1 - pw - 2, g - 12, RED[2])
        else:
            box(c, cx - 2, top + bh, 4, 2, DARK, OL, 'v', 0.6, 0.4)
            c.blob(cx, top + bh + 3.5, 1.7, 1.5, YEL[2:], None, dither=False)
        if i == 2:
            c.blob(cx, top - 3, 4.5, 4.5, CREAM[1:], OL, dither=False)                 # dial on top
            c.set(cx, top - 6, INK); c.set(cx + 1, top - 5, RED[2]); c.set(cx + 2, top - 4, RED[2]); c.set(cx, top - 3, INK)
            box(c, cx - 1, top, 2, 1, DARK, None, 'v', 0.5, 0.5)
    else:
        # display with a readout
        sw = min(x1 - x0 - 6, 6 + i)
        sh = max(2, bh - 3)
        box(c, cx - sw // 2, top + 1, sw, sh, DARK, OL, 'v', 0.6, 0.35)
        for k in range(sw - 2):
            hgt = 1 + ((k * 5 + i * 3) % max(1, sh - 1))
            for yy in range(hgt):
                c.set(cx - sw // 2 + 1 + k, top + sh - yy, (glow or GRN)[3] if yy < hgt - 1 else (glow or GRN)[4])
        # lights under the housing
        for k in range(2 + i // 3):
            lx = x0 + pw + 1 + int((x1 - x0 - 2 * pw - 2) * (k + 0.5) / (2 + i // 3))
            c.set(lx, top + bh, (glow or GRN)[4])
        if i >= 6:
            box(c, x0 + 2, top - 2, 3, 2, ORG, OL, 'v', 0.95, 0.7)                      # beacon
        if i >= 7:
            vline(c, x1 - 3, top - 5, top - 1, METAL[2]); c.set(x1 - 3, top - 6, RED[3])  # antenna
        if i == 10:
            ring_r = (x1 - x0 - 2 * pw) / 2 - 1
            cy_ = top + bh + ring_r * 0.55
            for a in range(0, 181, 4):
                rad = math.radians(180 + a)
                c.set(int(round(cx + math.cos(rad) * ring_r)), int(round(cy_ + math.sin(rad) * ring_r * 0.55)), TEAL[4])
            hline(c, x0 - 1, x1 + 1, top + bh - 1, YEL[3])                              # gold trim
            for (dx, dy) in ((0, 0), (0, 1), (0, 2), (1, 0), (2, 1), (3, 0), (4, 0), (4, 1), (4, 2)):
                c.set(x0 + 2 + dx, top + 2 + dy, YEL[4])                                # "M" badge
    # ---- base plates
    box(c, x0 - 2, g - 1, pw + 3, 1, DARK, OL, 'v', 0.7, 0.4)
    box(c, x1 - pw, g - 1, pw + 3, 1, DARK, OL, 'v', 0.7, 0.4)
    if smart:
        box(c, cx - 8, 1, 16, 9, CREAM, OL, 'v', 0.95, 0.6)
        box(c, cx - 6, 2, 12, 6, DARK, None, 'v', 0.6, 0.4)
        box(c, cx - 3, 10, 6, top - 10, METAL, OL, 'v', 0.7, 0.4)
    meta = {'inner': [x0 + pw, x1 - pw + 1, top + bh, g - 2], 'ground': g, 'cx': cx}
    if smart:
        meta['screen'] = [cx - 6, 2, 12, 6]
    SPR['scanner_%s' % ('100' if smart else i)] = (c, meta)


def make_scanners():
    for i in range(11):
        scanner(i)
    scanner(10, smart=True)


# ======================================================================== UNLOADING TOOLS AND HERDERS
# Tools carry the crates on their left (truck) side; meta.load = [x, y, cols]: bottom-left of the
# crate stack. Seats: meta.seat = [x, y] (where a driver bust's seat point goes), meta.face = -1 if
# the machine faces left. Wheels are in meta.wheels like vehicles.
def tool_cart():
    c = new('tool_cart', 12, 24)
    vline(c, 8, 1, 21, DARK[2]); vline(c, 9, 1, 21, DARK[1])           # frame
    hline(c, 9, 11, 1, DARK[1]); hline(c, 9, 11, 2, RED[2])             # handle grip
    hline(c, 1, 9, 21, DARK[2]); hline(c, 1, 9, 22, DARK[1])           # nose plate
    for y in (7, 14):
        hline(c, 7, 9, y, DARK[1])
    outline(c)
    SPR['tool_cart'] = (c, {'load': [1, 21, 1], 'wheels': [[8, 20, 3]], 'handle': [11, 2]})


def tool_barrow():
    c = new('tool_barrow', 28, 14)
    fill_poly(c, [(2, 3), (20, 3), (17, 9), (5, 9)], RED)                 # tub
    hline(c, 2, 20, 3, RED[4])
    for y in (10, 11):
        c.set(18, y, DARK[2])                                             # leg
    c.line(14, 8, 27, 4, DARK[2])                                         # handles
    c.line(14, 9, 27, 5, DARK[1])
    hline(c, 25, 27, 4, WOOD[3])
    outline(c)
    SPR['tool_barrow'] = (c, {'load': [4, 4, 2], 'wheels': [[4, 10, 3]], 'handle': [27, 4]})


def tool_palletjack():
    c = new('tool_palletjack', 34, 22)
    box(c, 1, 16, 26, 2, WOOD, OL, 'v', 0.9, 0.6)                          # pallet top
    for xx in (1, 12, 23):
        box(c, xx, 18, 4, 2, WOOD, OL, 'v', 0.6, 0.4)
    box(c, 3, 20, 26, 1, METAL, OL, 'v', 0.7, 0.5)                         # forks
    c.line(28, 19, 32, 3, RED[2]); c.line(29, 19, 33, 3, RED[1])         # tiller
    box(c, 30, 1, 3, 2, DARK, OL, 'v', 0.6, 0.4)
    box(c, 26, 16, 4, 4, RED, OL, 'v', 0.9, 0.5)                           # pump
    outline(c)
    SPR['tool_palletjack'] = (c, {'load': [2, 16, 3], 'wheels': [[28, 19, 3]], 'handle': [33, 2]})


def tool_forklift():
    c = new('tool_forklift', 30, 34)
    # body faces left (mast and forks on the left)
    fill_poly(c, [(8, 18), (26, 18), (28, 22), (28, 28), (8, 28)], YEL)
    box(c, 24, 14, 5, 6, DARK, OL, 'v', 0.6, 0.4)                          # counterweight
    for xx in (9, 25):
        vline(c, xx, 3, 18, DARK[2]); vline(c, xx + 1, 3, 18, DARK[1])    # overhead guard posts
    hline(c, 9, 26, 3, DARK[1]); hline(c, 9, 26, 2, DARK[2])
    box(c, 4, 1, 3, 29, DARK, OL, 'h', 0.7, 0.4)                           # mast
    hline(c, 9, 27, 21, YEL[4])
    outline(c)
    f = new('tool_forklift_forks', 12, 4)
    box(f, 0, 0, 2, 3, DARK, OL, 'h', 0.7, 0.4)
    hline(f, 0, 11, 3, METAL[2]); outline(f)
    SPR['tool_forklift'] = (c, {'face': -1, 'seat': [17, 18], 'wheels': [[12, 29, 4], [24, 30, 3]], 'forks': [-6, 28], 'load': [-6, 28, 2]})


def tool_loader():
    c = new('tool_loader', 40, 34)
    # tractor facing left with front-loader arms
    fill_poly(c, [(8, 19), (8, 13), (20, 12), (24, 12), (24, 22), (8, 22)], GRN)
    for xx in range(10, 19, 2):
        vline(c, xx, 14, 18, GRN[1])
    for xx in (24, 37):
        vline(c, xx, 2, 21, DARK[2]); vline(c, xx + 1, 2, 21, DARK[1])
    box(c, 24, 1, 14, 2, GRN, OL, 'v', 0.9, 0.6)
    box(c, 26, 4, 10, 8, GLASS, OL, 'v', 0.9, 0.4)
    box(c, 23, 21, 16, 4, GRN, OL, 'v', 0.8, 0.4)                          # fender
    box(c, 14, 7, 2, 6, METAL, OL, 'h', 0.9, 0.4)                          # exhaust
    outline(c)
    b = new('tool_loader_bucket', 16, 10)
    fill_poly(b, [(0, 0), (3, 9), (15, 9), (15, 3), (13, 3), (12, 7), (3, 7), (2, 0)], RED)
    outline(b)
    SPR['tool_loader'] = (c, {'face': -1, 'seat': [31, 20], 'wheels': [[13, 28, 5], [31, 26, 7]], 'pivot': [22, 15], 'bucket': [-12, 24], 'load': [-11, 31, 3]})


def tool_telehandler():
    c = new('tool_telehandler', 44, 26)
    fill_poly(c, [(4, 12), (40, 12), (42, 15), (42, 20), (4, 20)], RED)
    box(c, 22, 2, 14, 11, DARK, OL, 'v', 0.6, 0.35)
    box(c, 24, 4, 10, 6, GLASS, OL, 'v', 0.9, 0.4)
    hline(c, 5, 41, 13, RED[4])
    outline(c)
    f = new('tool_telehandler_forks', 12, 9)
    box(f, 0, 0, 2, 8, DARK, OL, 'h', 0.7, 0.4)
    hline(f, 0, 11, 8, METAL[2]); outline(f)
    SPR['tool_telehandler'] = (c, {'face': -1, 'seat': [29, 12], 'wheels': [[10, 20, 5], [34, 20, 5]], 'pivot': [26, 9], 'forks': [-12, 24]})


def tool_robotarm():
    c = new('tool_robotarm', 16, 24)
    box(c, 2, 20, 12, 3, DARK, OL, 'v', 0.7, 0.4)                          # base plate
    box(c, 4, 9, 8, 11, TEAL, OL, 'h', 0.9, 0.4)                           # body
    c.set(8, 12, RED[3]); c.set(8, 14, GRN[3])
    box(c, 5, 5, 6, 4, TEAL, OL, 'v', 0.9, 0.6)                            # shoulder
    outline(c)
    g = new('tool_robotarm_grip', 16, 5)
    box(g, 6, 0, 4, 2, DARK, OL, 'v', 0.7, 0.4)
    hline(g, 0, 15, 3, DARK[2]); vline(g, 0, 3, 4, DARK[2]); vline(g, 15, 3, 4, DARK[2]); outline(g)
    SPR['tool_robotarm'] = (c, {'shoulder': [8, 6]})


def tool_agv():
    for f in (0, 1):
        c = new('tool_agv_%d' % f, 30, 16)
        box(c, 1, 3, 28, 9, CREAM, OL, 'v', 0.95, 0.55)
        hline(c, 1, 28, 3, CREAM[4])
        box(c, 19, 5, 8, 5, DARK, OL, 'v', 0.6, 0.4)                       # face screen
        if f == 0:
            c.set(21, 7, TEAL[4]); c.set(25, 7, TEAL[4]); c.set(21, 6, TEAL[3]); c.set(25, 6, TEAL[3])
        else:
            hline(c, 21, 22, 7, TEAL[4]); hline(c, 24, 25, 7, TEAL[4])
        for xx in range(3, 18):
            c.set(xx, 10, TEAL[3] if (xx // 2) % 2 else TEAL[2])
        box(c, 0, 1, 30, 2, METAL, OL, 'v', 0.8, 0.5)                      # deck
        outline(c)
    SPR['tool_agv_0'][1].update({'load': [2, 0, 3], 'wheels': [[6, 13, 3], [15, 13, 3], [24, 13, 3]]})


def herders():
    for f in (0, 1):
        c = new('dog_%d' % f, 13, 10)
        DOG = R('#4a3226', '#7a5236', '#a8774c', '#d8b08a')
        c.blob(6, 5, 4.5, 2.3, DOG, None, dither=False)
        c.blob(10.5, 3.2, 1.9, 1.8, DOG[1:], None, dither=False)
        c.set(12, 4, INK); c.set(10, 1, DOG[0]); c.set(11, 3, INK)
        c.set(1, 3, DOG[1]); c.set(0, 2, DOG[2])                             # tail up
        c.set(7, 5, CREAM[3]); c.set(8, 5, CREAM[3])                         # white chest
        legs = (3, 8) if f == 0 else (4, 7)
        for lx in legs:
            vline(c, lx, 7, 9, DOG[1])
        vline(c, legs[0] + 2, 7, 9, DOG[0])
        outline(c)
    for f in (0, 1):
        c = new('horse_%d' % f, 28, 22)
        HO = R('#3e2a20', '#6b4530', '#94633e', '#c08a5a')
        c.blob(13, 11, 9, 4.5, HO, None, dither=False)
        fill_poly(c, [(17, 11), (19, 6), (22, 2), (26, 2), (27, 5), (24, 6), (22, 9), (21, 13)], HO, 0.85, 0.45, 'h', None)
        c.set(25, 4, INK)
        for y in range(2, 9):
            c.set(20 - (y - 2) // 3, y + 1, DARK[0])                          # mane
        vline(c, 4, 9, 14, DARK[0]); c.set(3, 15, DARK[0])                     # tail
        legs = [(7, 0), (10, 1), (17, 0), (20, 1)] if f == 0 else [(7, 1), (10, 0), (17, 1), (20, 0)]
        for (lx, ph) in legs:
            vline(c, lx + ph, 15, 20, HO[1]); c.set(lx + ph, 21, DARK[0])
        box(c, 9, 7, 7, 2, RED, None, 'v', 0.7, 0.5)                            # saddle
        outline(c)
        SPR['horse_%d' % f][1].update({'seat': [12, 8]})
    c = new('quad', 24, 16)
    fill_poly(c, [(2, 6), (8, 4), (16, 4), (22, 6), (22, 9), (2, 9)], RED)
    box(c, 9, 2, 7, 2, DARK, OL, 'v', 0.6, 0.4)                                # seat
    c.line(18, 4, 20, 0, DARK[2]); hline(c, 19, 22, 0, DARK[1])                # handlebar
    outline(c)
    SPR['quad'] = (c, {'seat': [12, 4], 'wheels': [[5, 11, 4], [19, 11, 4]]})
    c = new('offroad', 36, 24)
    fill_poly(c, [(1, 10), (6, 9), (8, 3), (24, 2), (27, 9), (35, 10), (35, 17), (1, 17)], GRN)
    box(c, 10, 4, 6, 5, GLASS, OL, 'v', 0.9, 0.4); box(c, 18, 4, 6, 5, GLASS, OL, 'v', 0.9, 0.4)
    box(c, 0, 13, 3, 3, METAL, OL, 'v', 0.8, 0.4); c.set(34, 11, YEL[3]); c.set(34, 12, YEL[2])
    hline(c, 2, 34, 12, GRN[1])
    outline(c)
    SPR['offroad'] = (c, {'seat': [21, 9], 'wheels': [[8, 18, 5], [28, 18, 5]]})
    for f in (0, 1):
        c = new('drone_%d' % f, 18, 7)
        box(c, 6, 3, 6, 2, DARK, OL, 'v', 0.6, 0.4)
        c.set(9, 5, RED[3] if f else GRN[3])
        hline(c, 2, 15, 2, DARK[2])
        w = 3 if f == 0 else 1
        for px_ in (2, 15):
            hline(c, px_ - w, px_ + w, 0, METAL[3])
        outline(c)
    c = new('robot_herder', 24, 22)
    box(c, 2, 9, 20, 8, CREAM, OL, 'v', 0.95, 0.55)
    box(c, 12, 10, 8, 5, DARK, OL, 'v', 0.6, 0.4); c.set(14, 12, TEAL[4]); c.set(18, 12, TEAL[4])
    vline(c, 5, 1, 9, DARK[2]); fill_poly(c, [(5, 1), (11, 3), (5, 5)], RED, 0.9, 0.6, 'v', None)
    outline(c)
    SPR['robot_herder'] = (c, {'wheels': [[6, 18, 3], [12, 18, 3], [18, 18, 3]]})


def make_tools():
    tool_cart(); tool_barrow(); tool_palletjack(); tool_forklift(); tool_loader(); tool_telehandler(); tool_robotarm(); tool_agv(); herders()



# ======================================================================== THE SHED (background)
SHED_W, SHED_H, SHED_FLOOR = 340, 140, 122     # floor line at y = SHED_FLOOR


def shed():
    c = Cv(SHED_W, SHED_H)
    PL = R('#8f7a5e', '#a58e6e', '#b8a282', '#c8b494')         # wall planks (muted)
    BEAM = R('#5e4a3a', '#6e5848', '#7e6656')
    FL = R('#8e8a80', '#a29d92', '#b3aea2')                    # concrete floor
    door1 = 118                                                # open barn door from x = 0 to door1
    # wall planks
    for x in range(SHED_W):
        plank = (x // 9) % 4
        for y in range(SHED_FLOOR):
            t = 0.35 + plank * 0.12 + (vnoise(x / 3.0, y / 18.0, 3) - 0.5) * 0.25 - (y / SHED_FLOOR) * 0.08
            col = pick(PL, t, x, y, True)
            if x % 9 == 0:
                col = PL[0]
            c.set(x, y, col)
    # knots
    rnd = random.Random(4)
    for k in range(40):
        c.set(rnd.randrange(SHED_W), rnd.randrange(SHED_FLOOR), PL[0])
    # beams: top beam, posts
    for y in range(0, 7):
        hline(c, 0, SHED_W - 1, y, pick(BEAM, 0.8 - y * 0.08))
    hline(c, 0, SHED_W - 1, 7, OL)
    for px_ in (door1, 236, 330):
        for x in range(px_, px_ + 6):
            vline(c, x, 8, SHED_FLOOR - 1, pick(BEAM, 0.9 - (x - px_) / 5 * 0.6))
        vline(c, px_ - 1, 8, SHED_FLOOR - 1, OL); vline(c, px_ + 6, 8, SHED_FLOOR - 1, OL)
    # open barn door: outside daylight (sky, hills, field) in the doorway
    for y in range(8, SHED_FLOOR):
        for x in range(0, door1 - 1):
            if y < 70:
                col = pick(R('#bcdde6', '#cfe6ec', '#e2f0f2'), 1 - y / 70, x, y, True)
            elif y < 86:
                col = pick(R('#8fbf86', '#a9cf8d'), 0.5 + (vnoise(x / 9.0, 1, 2) - 0.5), x, y, True)
                if y < 74 + 6 * math.sin(x / 15.0):
                    col = pick(R('#bcdde6', '#cfe6ec'), 0.5, x, y, True)
            else:
                col = pick(R('#9cc78f', '#b5d69a', '#c4dca8'), 0.3 + (y - 86) / 40, x, y, True)
            c.set(x, y, col)
    # distant trees through the door
    for (tx, ty, r) in ((20, 74, 6), (34, 72, 8), (86, 75, 5), (100, 73, 7)):
        c.blob(tx, ty, r, r * 0.9, R('#5f9c6a', '#76b07a', '#93c27f'), None, dither=False)
    # door frame and the slid-open door leaf on the left
    for x in range(0, 5):
        vline(c, x, 8, SHED_FLOOR - 1, pick(R('#8a3e30', '#a84c3a', '#c05e48'), 0.9 - x * 0.15))
    vline(c, 5, 8, SHED_FLOOR - 1, OL)
    hline(c, 0, door1, 8, OL); hline(c, 0, door1, 9, BEAM[0])
    # window with outside view, above the belt
    wx, wy, ww, wh = 150, 22, 30, 22
    box(c, wx, wy, ww, wh, R('#bcdde6', '#cfe6ec', '#e2f0f2'), OL, 'v', 0.9, 0.3)
    c.blob(wx + 8, wy + wh - 2, 7, 4, R('#8fbf86', '#a9cf8d'), None, dither=False)
    c.blob(wx + 22, wy + wh - 1, 9, 5, R('#8fbf86', '#a9cf8d'), None, dither=False)
    vline(c, wx + ww // 2, wy, wy + wh - 1, BEAM[1]); hline(c, wx, wx + ww - 1, wy + wh // 2, BEAM[1])
    box(c, wx - 2, wy + wh, ww + 4, 2, BEAM, OL, 'v', 0.9, 0.6)
    # hanging lamps
    for lx in (138, 214, 290):
        vline(c, lx, 8, 26, DARK[1])
        fill_poly(c, [(lx - 5, 31), (lx - 3, 27), (lx + 3, 27), (lx + 5, 31)], TEAL, 0.8, 0.4, 'v')
        c.set(lx, 32, YEL[4]); c.set(lx - 1, 32, YEL[3]); c.set(lx + 1, 32, YEL[3])
    # tools on the wall between door and belt
    for (x0, kind) in ((124, 'fork'), (130, 'rake')):
        vline(c, x0, 30, 70, WOOD[2]); vline(c, x0 + 1, 30, 70, WOOD[1])
        for k in range(4 if kind == 'fork' else 6):
            vline(c, x0 - 2 + k * (2 if kind == 'fork' else 1), 70, 75 if kind == 'fork' else 72, METAL[2])
        hline(c, x0 - 2, x0 + 4, 70, METAL[1])
    # shelf with sacks and crates on the right
    hline(c, 246, 328, 46, BEAM[0]); hline(c, 246, 328, 47, BEAM[1]); hline(c, 246, 328, 48, OL)
    for (sx, col) in ((250, CREAM), (262, CREAM), (274, CREAM)):
        c.blob(sx + 4, 40, 5, 6, col[1:4], OL, dither=False)
        hline(c, sx + 2, sx + 6, 36, DARK[2])
    for k in range(3):
        cr = SPR['crate'][0] if 'crate' in SPR else None
        if cr:
            for y in range(cr.h):
                for x in range(cr.w):
                    p = cr.get(x, y)
                    if p[3]:
                        c.set(292 + k * 12 + x, 35 + y, p)
    # floor
    for y in range(SHED_FLOOR, SHED_H):
        for x in range(SHED_W):
            t = 0.6 - (y - SHED_FLOOR) / (SHED_H - SHED_FLOOR) * 0.3 + (vnoise(x / 7.0, y / 3.0, 9) - 0.5) * 0.25
            col = pick(FL, t, x, y, True)
            if (x + (y - SHED_FLOOR) * 3) % 40 == 0:
                col = FL[0]
            c.set(x, y, col)
    hline(c, 0, SHED_W - 1, SHED_FLOOR, BEAM[0]); hline(c, 0, SHED_W - 1, SHED_FLOOR + 1, FL[0])
    # doorway: the floor continues outside as a dirt track
    for y in range(SHED_FLOOR + 2, SHED_H):
        for x in range(0, door1 - 1):
            c.set(x, y, pick(R('#a98a62', '#c3a37a', '#d4b68a'), 0.5 + (vnoise(x / 4.0, y / 2.0, 5) - 0.5) * 0.8, x, y, True))
    return c


# ======================================================================== small icons for the plot axes
def make_icons():
    c = new('ic_feed', 9, 10)                                   # wheat sheaf
    for x in (2, 4, 6):
        vline(c, x, 3, 9, YEL[2])
        c.blob(x, 2, 1.2, 2, YEL[2:], None, dither=False)
    hline(c, 2, 6, 6, WOOD[1])
    outline(c)
    c = new('ic_milk', 7, 10)                                   # milk bottle
    box(c, 2, 0, 3, 2, BLUE, None, 'v', 0.7, 0.5)
    fill_poly(c, [(2, 2), (4.5, 2), (6, 4), (6, 9.5), (1, 9.5), (1, 4)], CREAM, 0.95, 0.6, 'h')
    hline(c, 1, 5, 6, BLUE[3])
    outline(c)
    c = new('ic_sun', 10, 10)
    c.blob(5, 5, 2.6, 2.6, YEL[2:], None, dither=False)
    for (dx, dy) in ((0, -4), (0, 4), (-4, 0), (4, 0), (-3, -3), (3, 3), (-3, 3), (3, -3)):
        c.set(5 + dx, 5 + dy, YEL[3])
    outline(c)
    c = new('ic_egg', 7, 9)
    c.blob(3.5, 5, 2.8, 3.4, CREAM[1:], None, dither=False, spec=WHITE)
    outline(c)


def build_all():
    make_people(); make_units(); make_crates(); make_wheels(); make_vehicles(); make_scanners(); make_tools(); make_icons()


def pack():
    from PIL import Image
    items = sorted(SPR.items(), key=lambda kv: (-kv[1][0].h, kv[0]))
    W = 512
    x = y = rowh = 0
    pos = {}
    for name, (c, meta) in items:
        if x + c.w + 1 > W:
            x, y, rowh = 0, y + rowh + 1, 0
        pos[name] = (x, y)
        x += c.w + 1
        rowh = max(rowh, c.h)
    Ht = y + rowh
    at = Image.new('RGBA', (W, Ht), (0, 0, 0, 0))
    out = {}
    for name, (c, meta) in items:
        px_, py_ = pos[name]
        at.paste(c.im, (px_, py_))
        out[name] = dict(meta, r=[px_, py_, c.w, c.h])
    return at, out


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    build_all()
    at, meta = pack()
    at.save(os.path.join(OUT, 'sprites.png'), optimize=True)
    s = shed()
    s.im.save(os.path.join(OUT, 'shed.png'), optimize=True)
    meta['_shed'] = {'w': SHED_W, 'h': SHED_H, 'floor': SHED_FLOOR, 'door': 118}
    json.dump(meta, open(os.path.join(OUT, 'sprites.json'), 'w'), separators=(',', ':'))
    print('sprites', at.size, len(meta), 'shed', s.w, s.h)
