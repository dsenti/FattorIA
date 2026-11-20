"""FattorIA valley map as 3/4-view pixel art, at day and at dusk, for every unlock state.

Run:  .venv/bin/python Game/tools/pixelart/mapgen.py
Writes Game/assets/map/map-{day,night}-{s0,s1}{l0,l1}.png (260 x 467 art pixels, shown at 1.5x
= 390 x 700 CSS px) and Game/assets/map/places.json (where the places sit, in % of the image).
All layout coordinates below are CSS px of the 390 x 700 map; S = art pixels per CSS px."""
import math, random, os, json
from px import Cv, H, R, mix, pick, bay, hsh, vnoise, pip

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'map')
EX = (1.0, -0.5)
EY = (-1.0, -0.5)

NIGHT = dict(
    OL=H('#14121f'),
    SKY=R('#15132a', '#1b1930', '#221f3a', '#2b2646', '#3a3054', '#523d5f', '#6e4c66'),
    MOON=R('#c9b98f', '#e8d9b0', '#fff1d0'), HALO=H('#cfc6ef'), CLOUD=H('#5a4870'),
    MFAR={'lit': R('#3f3a5e', '#4f4870', '#5f5884'), 'dark': R('#24213a', '#2e2a48'), 'snow': R('#9f98c2', '#c9c2e0', '#ece6f7')},
    MNEAR={'lit': R('#2f2c4a', '#3a3758'), 'dark': R('#1c1a2e', '#242138'), 'snow': R('#8f88b2', '#b3acd2')},
    FOREST=R('#132522', '#183230', '#1f3f3b'),
    GRASS=R('#15292a', '#1b3634', '#21423e', '#294f49', '#335f55', '#3f6f5f'),
    FOG=H('#2b2842'), MIST=H('#6a6290'),
    PATH=R('#34304a', '#57526f', '#6a6584', '#7f7a9a'),
    WATER=R('#1a2d4c', '#22395e', '#2f4f7f', '#3b5f8f'), WHL=H('#8ecae6'), BANK=H('#112321'),
    SOIL=R('#251d27', '#2e2430', '#3a2e3c'), CROP=R('#245a48', '#2f7a5f', '#4f9f7f'), VINE=R('#1d4a3c', '#2f6f5a'),
    WIN=H('#ffe08a'), WIN2=H('#ffb26b'), WINDARK=H('#23203a'), GLOW=H('#ffb26b'),
    PINE=R('#0f2e29', '#174438', '#22604c', '#368a68', '#6fcf97'),
    OAK=R('#11332c', '#1b4c3e', '#2a6a54', '#3f8f6f', '#7fd8a6'),
    OLIVE=R('#2a3a36', '#3c524a', '#566f62', '#7f9a88'),
    TRUNK=R('#2e1f22', '#4a3330'),
    WALLS={
        'cream': (R('#9a8a72', '#b9a68c', '#cdbb9f'), R('#cfc0a5', '#e9dcc3', '#f6ecd8')),
        'peach': (R('#9e7a66', '#bf967c', '#d2aa90'), R('#d9b096', '#f0c7a8', '#fad8bd')),
        'lilac': (R('#827ba6', '#a49dc6', '#b8b1d8'), R('#c4bee2', '#d8d3ee', '#e9e5f7')),
        'barn': (R('#6e2b36', '#8f3a45', '#a3454f'), R('#a8434d', '#c4525a', '#d4656b')),
        'stone': (R('#6f6a86', '#8a85a3', '#9d98b5'), R('#a8a3c0', '#bdb8d3', '#cfcae2')),
        'wood': (R('#4a3026', '#5e3d30', '#714a39'), R('#7a5040', '#8f6048', '#a06a4a')),
    },
    ROOFS={
        'red': (R('#5e2232', '#7a2c3c', '#8f3445'), R('#a63f4e', '#c04c5c', '#d4606e')),
        'wood': (R('#4a3026', '#5e3d30', '#714a39'), R('#8a5a3e', '#a06a4a', '#b47c58')),
        'slate': (R('#262338', '#2f2b44', '#3a3654'), R('#4a4565', '#5c587a', '#6e6a8c')),
        'green': (R('#1d3f3a', '#25504a', '#2f6058'), R('#3a6e64', '#4a8072', '#5a9282')),
    },
    TRIM=H('#e9e3f2'), FLOWERS=[H('#ffaec9'), H('#ffe08a'), H('#fff4e6')], LEAF=H('#2f6f5a'),
    METAL=R('#3a3654', '#5c587a', '#7d78a0', '#a9a4c9', '#d0cce6'),
    GLASS=H('#6fa8c8'), SHADOW=H('#0c0b16'), SMOKE=R('#3a3654', '#4a4565', '#5c587a'),
    COW=(H('#e9e3f2'), H('#2b2842')),
    night=True,
)

DAY = dict(
    OL=H('#2e3a3c'),
    SKY=R('#79b4d4', '#86bdd9', '#95c6de', '#a6cfe2', '#b8d9e6', '#cbe3e9', '#dcebea'),
    MOON=R('#f0b84a', '#f8d070', '#fff3c4'), HALO=H('#fff6d8'), CLOUD=H('#ffffff'),
    MFAR={'lit': R('#93a8bb', '#a5b9ca', '#b6c8d6'), 'dark': R('#6f849a', '#7d92a7'), 'snow': R('#cfdbe6', '#e8eff5', '#ffffff')},
    MNEAR={'lit': R('#6a8c8a', '#7b9c97'), 'dark': R('#4f706d', '#5b7c78'), 'snow': R('#c8d8dc', '#e2ecee')},
    FOREST=R('#2c5a3e', '#356948', '#407850'),
    GRASS=R('#5f9450', '#699e57', '#74a85f', '#7fb267', '#8bbc71', '#9bc67f'),
    FOG=H('#b5d1d4'), MIST=H('#eef5f2'),
    PATH=R('#9e8060', '#c3a37a', '#d4b68a', '#e3c99d'),
    WATER=R('#3a78a2', '#4a8cb6', '#5ea2c8', '#78b8d8'), WHL=H('#e8f7fc'), BANK=H('#4a6e3a'),
    SOIL=R('#76563c', '#8a6748', '#9c7854'), CROP=R('#4a8a38', '#64a448', '#86c05c'), VINE=R('#3c7838', '#58984a'),
    WIN=H('#bfe1ea'), WIN2=H('#f2fbfd'), WINDARK=H('#5c7882'), GLOW=None,
    PINE=R('#1d4630', '#2a5f3e', '#3c7b4c', '#57975c', '#89c278'),
    OAK=R('#2c5a2c', '#3c7638', '#559646', '#76b458', '#a6d278'),
    OLIVE=R('#55694a', '#6b8459', '#859f6c', '#a4bb87'),
    TRUNK=R('#5a3e2e', '#7a5440'),
    WALLS={
        'cream': (R('#c4ae8a', '#d8c39e', '#e6d3ae'), R('#ecdcbc', '#f7ebd2', '#fff7e6')),
        'peach': (R('#c99c7c', '#dcb090', '#e8c0a0'), R('#efc6a6', '#f8d6ba', '#ffe4cc')),
        'lilac': (R('#a8a2c4', '#bab4d4', '#c8c3de'), R('#d6d2ea', '#e4e1f2', '#f0eef8')),
        'barn': (R('#963830', '#b0443a', '#c05046'), R('#cc5648', '#dc6856', '#e87a66')),
        'stone': (R('#8f8a9c', '#a4a0b0', '#b4b0be'), R('#c2bfcc', '#d2cfda', '#e0dee6')),
        'wood': (R('#6b4a34', '#80583e', '#946848'), R('#a07050', '#b8845e', '#c8966c')),
    },
    ROOFS={
        'red': (R('#8c3a2c', '#a44632', '#b4523e'), R('#c45842', '#d66a50', '#e48062')),
        'wood': (R('#6b4a34', '#80583e', '#946848'), R('#a87452', '#bc865e', '#cc9a6e')),
        'slate': (R('#4a5a6a', '#586a7a', '#687a8a'), R('#7a8ea0', '#8ca0b2', '#9eb2c2')),
        'green': (R('#3a6a50', '#477a5c', '#548a68'), R('#5e9a72', '#6eaa80', '#80ba90')),
    },
    TRIM=H('#ffffff'), FLOWERS=[H('#f27aa0'), H('#f5ca63'), H('#ffffff')], LEAF=H('#3c7838'),
    METAL=R('#6f7f84', '#8f9ca3', '#b0bcc2', '#d0d8dc', '#eef2f4'),
    GLASS=H('#cfeaf2'), SHADOW=H('#24402a'), SMOKE=R('#c8ccd0', '#dcdfe2', '#eef0f2'),
    COW=(H('#ffffff'), H('#3a3a3a')),
    night=False,
)

T = NIGHT


def use(theme):
    global T
    T = theme


class Map:
    def __init__(s, S, detail, sort_open=True, lab_open=True):
        s.S, s.D = S, detail
        s.sort_open, s.lab_open = sort_open, lab_open
        s.W, s.Hh = int(round(390 * S)), int(round(700 * S))
        s.c = Cv(s.W, s.Hh, T['SKY'][0])
        s.glows = []

    def P(s, x, y):
        return (x * s.S, y * s.S)

    # ---------------- sky ----------------
    def sky(s):
        c = s.c
        hz = 236 * s.S
        for y in range(int(hz) + 2):
            t = (y / hz) ** (1.6 if T['night'] else 1.1)
            for x in range(s.W):
                c.set(x, y, pick(T['SKY'], t, x, y))
        mx, my, mr = 312 * s.S, 54 * s.S, max(3.5, 13 * s.S)
        if T['night']:
            rnd = random.Random(3)
            for i in range(int(60 * (1 + s.D))):
                x, y = rnd.random() * s.W, rnd.random() * hz * 0.7
                col = H('#fff4e6') if rnd.random() < 0.35 else H('#a9a4c9')
                c.set(int(x), int(y), col)
                if s.D >= 2 and rnd.random() < 0.08:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        c.set(int(x) + dx, int(y) + dy, H('#a9a4c9'))
            s.glows.append((mx, my, mr * 4.2, T['HALO'], 0.22))
            c.blob(mx, my, mr, mr, T['MOON'], None, light=(-0.9, -0.4), dither=True, amb=0.25)
            if s.D >= 2:
                for (ox, oy, rr) in ((0.25, -0.1, 0.22), (-0.2, 0.3, 0.16), (0.35, 0.4, 0.12)):
                    c.blob(mx + ox * mr, my + oy * mr, rr * mr + 0.6, rr * mr + 0.6, T['MOON'][:2], None, dither=False)
            for (cx, cy, w) in ((70, 120, 120), (230, 150, 150), (160, 95, 80)):
                s.wisp(cx, cy, w, T['CLOUD'], 0.45)
        else:
            s.glows.append((mx, my, mr * 3.6, T['HALO'], 0.35))
            c.blob(mx, my, mr * 1.1, mr * 1.1, T['MOON'], None, light=(-0.6, -0.6), dither=False, amb=0.4)
            for (cx, cy, w) in ((60, 110, 70), (200, 70, 90), (120, 160, 60), (300, 130, 80)):
                s.cloud(cx, cy, w)
            if s.D >= 1:
                for (bx, by) in ((150, 120), (162, 114), (172, 124)):
                    x, y = int(bx * s.S), int(by * s.S)
                    for dx, dy in ((-2, -1), (-1, 0), (0, 0), (1, 0), (2, -1)):
                        c.set(x + dx, y + dy, H('#4a5a66'))

    def wisp(s, cx, cy, w, col, a):
        c = s.c
        for y in range(int((cy - 4) * s.S), int((cy + 4) * s.S) + 1):
            for x in range(int((cx - w / 2) * s.S), int((cx + w / 2) * s.S)):
                dx = (x / s.S - cx) / (w / 2)
                dy = (y / s.S - cy) / 4
                f = 1 - dx * dx - dy * dy
                if f > 0 and f * 0.8 > bay(x, y):
                    c.blend(x, y, col, a)

    def cloud(s, cx, cy, w):
        S = s.S
        puffs = [(-0.35, 0.1, 0.28), (-0.1, -0.12, 0.34), (0.2, -0.05, 0.3), (0.42, 0.12, 0.22)]
        ramp = R('#c9dbe6', '#e6f0f5', '#ffffff')
        for (ox, oy, r) in puffs:
            s.c.blob((cx + ox * w) * S, (cy + oy * w * 0.5) * S, r * w * S, r * w * 0.62 * S, ramp, None, light=(-0.3, -1), dither=True, amb=0.2)
        s.c.rect(int((cx - 0.5 * w) * S), int((cy + 0.12 * w * 0.5) * S), int(w * S), max(1, int(2 * S)), ramp[1])

    # ---------------- mountains ----------------
    def range_(s, peaks, base, pal, seed, snowline):
        c = s.c
        for k, (px_, top, hw) in enumerate(peaks):
            for y in range(int(top * s.S), int(base * s.S) + 1):
                yy = y / s.S
                f = (yy - top) / (base - top)
                jag = (vnoise(y * 0.35, k * 7, seed) - 0.5) * 6 * min(1, f * 4)
                half = f * hw + jag
                xl, xr = (px_ - half) * s.S, (px_ + half) * s.S
                ridge = px_ + (vnoise(y * 0.08, k, seed + 5) - 0.5) * 10 * f
                sn = snowline + (vnoise(y * 0.2, k * 3, seed + 9) - 0.5) * 0.12
                for x in range(int(math.floor(xl)), int(math.ceil(xr)) + 1):
                    if not (0 <= x < s.W):
                        continue
                    xx = x / s.S
                    lit = xx < ridge
                    gul = hsh(int((xx - ridge) * 0.25 + yy * 0.18), k, seed) < 0.18
                    if f < sn + (abs(xx - ridge) / max(hw, 1)) * 0.25 * (vnoise(x * 0.3, y * 0.3, seed) - 0.3):
                        ramp, t = pal['snow'], (0.95 if lit else 0.15)
                    else:
                        ramp = pal['lit'] if lit else pal['dark']
                        t = 0.9 - f * 0.6 if lit else 0.7 - f * 0.4
                        if gul and s.D >= 2:
                            t -= 0.4
                    c.set(x, y, pick(ramp, t, x, y))
                c.set(int(math.floor(xl)) - 1, y, pal['dark'][0])
                c.set(int(math.ceil(xr)) + 1, y, pal['dark'][0])

    def forest(s, ybase, seed):
        rnd = random.Random(seed)
        x = -6
        while x < 396:
            h = 10 + rnd.random() * 12
            w = h * 0.45
            yb = ybase + rnd.random() * 10
            col = T['FOREST'][rnd.randrange(3)]
            s.c.poly([s.P(x, yb - h), s.P(x + w, yb), s.P(x - w, yb)], col)
            x += 3.5 + rnd.random() * 4

    def mist(s, y0, y1):
        c = s.c
        for y in range(int(y0 * s.S), int(y1 * s.S)):
            f = 1 - abs((y / s.S - (y0 + y1) / 2) / ((y1 - y0) / 2))
            for x in range(s.W):
                n = vnoise(x / (18 * s.S + 1), y / (5 * s.S + 1), 21)
                if f * n * 1.4 > bay(x, y) + 0.15:
                    c.blend(x, y, T['MIST'], 0.28 if T['night'] else 0.4)

    # ---------------- ground ----------------
    RIVER = [(204, 244), (210, 288), (198, 334), (182, 380), (178, 430), (168, 478), (157, 528), (164, 584), (156, 640), (146, 712)]

    def river_x(s, y):
        P = s.RIVER
        if y <= P[0][1]:
            return P[0][0]
        for i in range(len(P) - 1):
            if P[i][1] <= y <= P[i + 1][1]:
                t = (y - P[i][1]) / (P[i + 1][1] - P[i][1])
                p0 = P[max(0, i - 1)][0]; p1 = P[i][0]; p2 = P[i + 1][0]; p3 = P[min(len(P) - 1, i + 2)][0]
                return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
        return P[-1][0]

    def river_w(s, y):
        return 3 + max(0, y - 244) * 0.056

    def field_scale(s, y):
        """fields shrink faster than trees towards the horizon (strong perspective)"""
        f = max(0.0, min(1.0, (y - 262) / 440.0))
        return 0.32 + 0.68 * f ** 0.85

    def depth(s, y):
        """perspective: 0.5 at the forest edge, 1 at the front"""
        return 0.5 + 0.5 * max(0.0, min(1.0, (y - 250) / 450.0))

    def ground(s):
        c = s.c
        G = T['GRASS']
        for y in range(int(232 * s.S), s.Hh):
            yy = y / s.S
            depth = (yy - 232) / (700 - 232)
            for x in range(s.W):
                xx = x / s.S
                n = vnoise(xx / 34, yy / 22, 1) * 0.7 + vnoise(xx / 9, yy / 7, 2) * 0.3
                col = pick(G, 0.18 + depth * 0.5 + (n - 0.5) * 0.9, x, y)
                if depth < 0.25:
                    col = mix(col, T['FOG'], (0.25 - depth) * 1.6)
                c.set(x, y, col)
                if hsh(x, y, 4) < 0.024 and depth > 0.15:
                    c.set(x, y, G[5])
                    c.set(x, y - 1, G[4])

    def river(s):
        c = s.c
        night = T['night']
        sand = R('#3a4846', '#46544f') if night else R('#b8a77e', '#cdbd92')
        reed = R('#1f4a3c', '#2f6a52') if night else R('#4f8a3a', '#6aa84a')
        for y in range(int(244 * s.S), s.Hh):
            yy = y / s.S
            cx, w = s.river_x(yy), s.river_w(yy)
            half = w / 2
            for x in range(int((cx - half - 3) * s.S), int((cx + half + 3) * s.S) + 1):
                xx = x / s.S
                d = abs(xx - cx)
                if d <= half:
                    edge = d > half - 1.0 / s.S
                    if edge:
                        c.set(x, y, T['BANK'])
                        continue
                    f = d / half
                    col = pick(T['WATER'], 0.8 - f * 0.55 + (vnoise(xx / 5, (yy - x * 0.3) / 2.2, 7) - 0.5) * 0.5, x, y)
                    if hsh(x // 2, y, 9) < 0.05 + 0.04 * (1 - f):
                        col = T['WHL']
                    if abs(xx - 312) < 22 and hsh(x, y // 2, 12) < 0.16:
                        col = T['WHL']
                    c.set(x, y, col)
                elif d <= half + 1.6 and yy > 270:
                    if hsh(x, y, 31) < 0.7:
                        c.set(x, y, pick(sand, hsh(x, y, 33), x, y, False))
        # stones and reeds along the banks
        rnd = random.Random(17)
        for k in range(110):
            yy = rnd.uniform(285, 700)
            side = rnd.choice((-1, 1))
            cx, w = s.river_x(yy), s.river_w(yy)
            xx = cx + side * (w / 2 + rnd.uniform(0.5, 2.5))
            ds = s.depth(yy)
            if rnd.random() < 0.35:
                r = max(0.8, rnd.uniform(0.9, 1.8) * ds)
                c.blob(xx * s.S, yy * s.S, r * s.S + 0.4, r * 0.7 * s.S + 0.4, T['METAL'][1:4] if not night else R('#3a3654', '#4a4565', '#5c587a'), None, dither=False)
            else:
                hgt = rnd.uniform(3, 6) * ds
                for j in range(rnd.randint(2, 4)):
                    bx = xx + j * 0.9 * side
                    for t in range(int(hgt * s.S)):
                        c.set(int(bx * s.S + (t // 3) * 0 + (1 if (t > hgt * s.S * 0.6 and j % 2) else 0)), int(yy * s.S) - t, reed[t % 2])
                    if not night and rnd.random() < 0.4:
                        c.set(int(bx * s.S), int((yy - hgt) * s.S) - 1, H('#8b6849'))

    def iso_rows(s, x, y, w, d, colors, rowsx=True, step=3.0, scale=1.0):
        w, d, step = w * scale, d * scale, max(1.6, step * scale)
        p0 = (x, y)
        pr = (x + w * EX[0], y + w * EX[1])
        pb = (pr[0] + d * EY[0], pr[1] + d * EY[1])
        pl = (x + d * EY[0], y + d * EY[1])
        S = s.S

        def sh(px_, py_):
            X, Y = px_ / S - x, py_ / S - y
            a = (X - 2 * Y) / 2
            b = (-X - 2 * Y) / 2
            k = int(math.floor((b if rowsx else a) / step))
            return colors[k % len(colors)] if (k % 2 == 0) else pick(colors[1:] if len(colors) > 2 else colors, hsh(px_, py_, 3) * 0.6 + 0.2, px_, py_)
        s.c.poly([s.P(*p0), s.P(*pr), s.P(*pb), s.P(*pl)], sh, T['SOIL'][0])

    def path(s, pts, width):
        from PIL import Image, ImageDraw
        m = Image.new('L', (s.W, s.Hh), 0)
        dr = ImageDraw.Draw(m)
        sp = [s.P(*p) for p in pts]
        wpx = max(2, int(round(width * s.S)))
        dr.line(sp, fill=255, width=wpx, joint='curve')
        for p in sp:
            r = wpx / 2
            dr.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)
        mp = m.load()
        PA = T['PATH']
        for y in range(s.Hh):
            for x in range(s.W):
                if mp[x, y]:
                    edge = any(not (0 <= x + dx < s.W and 0 <= y + dy < s.Hh) or not mp[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    s.c.set(x, y, PA[0] if edge else pick(PA[1:], 0.5 + (vnoise(x / 3.0, y / 3.0, 5) - 0.5) * 0.9, x, y))

    # ---------------- drawing helpers ----------------
    def shadow(s, pts, a=0.45):
        sp = [s.P(*p) for p in pts]
        xs = [p[0] for p in sp]
        ys = [p[1] for p in sp]
        a = a if T['night'] else a * 0.6
        for y in range(int(min(ys)), int(max(ys)) + 1):
            for x in range(int(min(xs)), int(max(xs)) + 1):
                if s.c.ok(x, y) and pip(x + 0.5, y + 0.5, sp):
                    s.c.blend(x, y, T['SHADOW'], a)

    def face(s, pts, ramp, top_y, bot_y, shade=0.6, outline=True):
        sp = [s.P(*p) for p in pts]
        S = s.S

        def sh(x, y):
            return pick(ramp, shade - ((y / S - top_y) / max(1, bot_y - top_y)) * 0.45, x, y)
        return s.c.poly(sp, sh, T['OL'] if outline else None)

    def seg(s, a, b, col):
        s.c.line(a[0] * s.S, a[1] * s.S, b[0] * s.S, b[1] * s.S, col)

    def add(s, z, fn):
        s.items.append((z, len(s.items), fn))

    def glow(s, x, y, r, a=0.38):
        if T['GLOW'] is not None:
            s.glows.append((x * s.S, y * s.S, max(5, r * s.S), T['GLOW'], a))

    def window(s, base, along, w, hb, hw, lit, flowers=False, shutters=False):
        bx, by = base
        a0 = (bx - along[0] * w / 2, by - along[1] * w / 2)
        a1 = (bx + along[0] * w / 2, by + along[1] * w / 2)
        pts = [(a0[0], a0[1] - hb), (a1[0], a1[1] - hb), (a1[0], a1[1] - hb - hw), (a0[0], a0[1] - hb - hw)]
        on = lit and T['night']
        col = T['WIN'] if (on or not T['night']) else T['WINDARK']
        if not lit and not T['night']:
            col = T['WINDARK']
        s.c.poly([s.P(*p) for p in pts], lambda x, y: col, T['OL'])
        mx = (pts[0][0] + pts[1][0]) / 2
        s.seg((mx, (pts[0][1] + pts[1][1]) / 2), (mx, (pts[2][1] + pts[3][1]) / 2), T['WIN2'] if on else T['OL'])
        if not T['night'] and lit:
            s.c.set(int(pts[3][0] * s.S) + 1, int(pts[3][1] * s.S) + 1, T['WIN2'])
        if shutters:
            for (p, q, sgn) in ((pts[0], pts[3], -1), (pts[1], pts[2], 1)):
                sw = 1.6
                sh_ = [(p[0] + sgn * along[0] * 0.2, p[1] + sgn * along[1] * 0.2), (p[0] + sgn * along[0] * sw, p[1] + sgn * along[1] * sw),
                       (q[0] + sgn * along[0] * sw, q[1] + sgn * along[1] * sw), (q[0] + sgn * along[0] * 0.2, q[1] + sgn * along[1] * 0.2)]
                s.c.poly([s.P(*v) for v in sh_], lambda x, y: T['ROOFS']['green'][1][1], None)
        if flowers:
            b0 = (pts[0][0] - along[0] * 0.8, pts[0][1] - along[1] * 0.8 + 0.5)
            b1 = (pts[1][0] + along[0] * 0.8, pts[1][1] + along[1] * 0.8 + 0.5)
            box = [b0, b1, (b1[0], b1[1] + 1.8), (b0[0], b0[1] + 1.8)]
            s.c.poly([s.P(*v) for v in box], lambda x, y: T['WALLS']['wood'][1][1], T['OL'])
            n = max(2, int(w * s.S / 1.5))
            for i in range(n + 1):
                t = i / n
                fx, fy = b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t
                s.c.set(int(fx * s.S), int(fy * s.S) - 1, T['LEAF'])
                s.c.set(int(fx * s.S), int(fy * s.S) - 2, T['FLOWERS'][i % 3])
        if on:
            s.glow(sum(p[0] for p in pts) / 4, sum(p[1] for p in pts) / 4, 18)

    def house(s, x, y, w, d, h, hr, wall='cream', roof='red', lit=True, nwin=None, door=True, chimney=False, kind='gable',
              trim=False, flowers=False, shutters=False, round_win=False, door_face='gable', awning=False, smoke=True):
        S = s.S
        wr, wl = T['WALLS'][wall]
        rn, rf = T['ROOFS'][roof]
        P0 = (x, y)
        Rr = (x + w, y - w / 2)
        Lc = (x - d, y - d / 2)
        Bk = (x + w - d, y - w / 2 - d / 2)
        up = lambda p, k=h: (p[0], p[1] - k)
        s.shadow([P0, Rr, (Rr[0] + h * 0.7, Rr[1] + h * 0.25), (P0[0] + h * 0.7, P0[1] + h * 0.25)], 0.42)
        s.shadow([P0, (P0[0] - 2, P0[1] + 1), (P0[0] + h * 0.6, P0[1] + h * 0.3), (P0[0] + h * 0.7, P0[1] + h * 0.25)], 0.4)
        s.face([P0, Rr, up(Rr), up(P0)], wr, y - h - w / 2, y, 0.75)
        s.face([P0, Lc, up(Lc), up(P0)], wl, y - h - d / 2, y, 0.95)
        M0 = M1 = None
        if kind == 'gable':
            M0 = (x - d / 2, y - d / 4 - h - hr)
            M1 = (M0[0] + w, M0[1] - w / 2)
            ov = 1.6
            s.face([up(Lc), up(Bk), M1, M0], rf, M1[1], y - h, 0.9)
            nr = [(up(P0)[0] + ov * 0.3, up(P0)[1] + ov), (up(Rr)[0] + ov, up(Rr)[1] + ov * 0.6), M1, M0]
            s.face(nr, rn, M1[1], y - h + ov, 0.85)
            s.face([up(P0), up(Lc), M0], wl, M0[1], y - h, 1.0)
            for k in range(1, 6):
                f = k / 6.0
                a = (up(P0)[0] + (M0[0] - up(P0)[0]) * f, up(P0)[1] + (M0[1] - up(P0)[1]) * f)
                b = (up(Rr)[0] + (M1[0] - up(Rr)[0]) * f, up(Rr)[1] + (M1[1] - up(Rr)[1]) * f)
                s.c.line(a[0] * S + 1, a[1] * S, b[0] * S - 1, b[1] * S, rn[0])
            s.seg(M0, M1, rf[2])
            if trim:
                s.seg(up(P0), M0, T['TRIM'])
                s.seg(up(Lc), M0, T['TRIM'])
            if round_win:
                cx_, cy_ = M0[0] + 0.0, M0[1] + hr * 0.55
                r = max(1.6, hr * 0.22)
                on = lit and T['night']
                s.c.blob(cx_ * S, cy_ * S, r * S + 0.6, r * S + 0.6, [T['WIN'] if (on or not T['night']) else T['WINDARK']], T['OL'], dither=False)
                if on:
                    s.glow(cx_, cy_, 14, 0.3)
            if chimney:
                cx_, cy_ = M0[0] + w * 0.7 + d * 0.15, M0[1] - w * 0.35 + d * 0.07
                cw = 3.0
                st = T['WALLS']['stone']
                s.face([(cx_, cy_ + 4), (cx_ + cw, cy_ + 4 - cw / 2), (cx_ + cw, cy_ - 6 - cw / 2), (cx_, cy_ - 6)], st[0], cy_ - 8, cy_ + 4, 0.8)
                s.face([(cx_, cy_ + 4), (cx_ - cw * 0.7, cy_ + 4 - cw * 0.35), (cx_ - cw * 0.7, cy_ - 6 - cw * 0.35), (cx_, cy_ - 6)], st[1], cy_ - 8, cy_ + 4, 0.9)
                if smoke and lit:
                    rnd = random.Random(int(x * 7 + y))
                    for k in range(5):
                        sx = (cx_ + 1 + k * 1.6 + rnd.random()) * S
                        sy = (cy_ - 9 - k * 3.2) * S
                        r = (1.2 + k * 0.5) * S + 0.6
                        s.c.blob(sx, sy, r, r * 0.8, T['SMOKE'], None, dither=True)
        elif kind == 'flat':
            s.face([up(P0), up(Rr), up(Bk), up(Lc)], T['ROOFS']['slate'][1], y - h - w / 2 - d / 2, y - h, 0.8)
        elif kind == 'pyramid':
            C = (x + w / 2 - d / 2, y - w / 4 - d / 4 - h - hr)
            s.face([up(Rr), up(Bk), C], rf, C[1], y - h, 0.9)
            s.face([up(Lc), up(Bk), C], rf, C[1], y - h, 0.9)
            s.face([up(P0), up(Rr), C], rn, C[1], y - h, 0.8)
            s.face([up(P0), up(Lc), C], rf, C[1], y - h, 1.0)
        if trim:
            for p in (P0, Rr, Lc):
                s.seg(p, up(p), T['TRIM'])
        n = nwin if nwin is not None else max(1, int(w / 9))
        dpos = 0.5 if door_face == 'side' else None
        for i in range(n):
            t = (i + 0.5) / n
            if dpos is not None and abs(t - dpos) < 0.2:
                continue
            base = (x + w * t, y - w * t / 2)
            ww = min(4.2, w / n * 0.45)
            s.window(base, EX, ww, h * 0.4, h * 0.34, lit, flowers=flowers, shutters=shutters)
        if door:
            if door_face == 'side':
                base = (x + w * 0.5, y - w * 0.25)
                along = EX
            else:
                base = (x - d / 2, y - d / 4)
                along = (-1, -0.5)
            dw = min(5.0, (w if door_face == 'side' else d) * 0.3)
            a0 = (base[0] - along[0] * dw / 2, base[1] - along[1] * dw / 2)
            a1 = (base[0] + along[0] * dw / 2, base[1] + along[1] * dw / 2)
            dh = min(h * 0.6, 9)
            pts = [a0, a1, (a1[0], a1[1] - dh), (a0[0], a0[1] - dh)]
            dcol = T['WALLS']['wood'][1][1] if lit else T['WALLS']['wood'][0][0]
            s.c.poly([s.P(*p) for p in pts], lambda xx, yy: dcol, T['OL'])
            if not lit:
                s.seg((pts[3][0], pts[3][1] + dh * 0.3), (pts[2][0], pts[2][1] + dh * 0.5), T['WALLS']['wood'][1][2])
                s.seg((pts[3][0], pts[3][1] + dh * 0.6), (pts[2][0], pts[2][1] + dh * 0.4), T['WALLS']['wood'][1][2])
            else:
                s.c.set(int(pts[2][0] * S) - 1, int((pts[2][1] + dh * 0.55) * S), T['WIN'] if T['night'] else H('#f5ca63'))
                if T['night']:
                    s.glow(base[0], base[1] - dh / 2, 10, 0.25)
            if awning:
                ah = dh + 1.2
                aw = dw + 2.4
                b0 = (base[0] - along[0] * aw / 2, base[1] - along[1] * aw / 2 - ah)
                b1 = (base[0] + along[0] * aw / 2, base[1] + along[1] * aw / 2 - ah)
                out = (2.6, 1.6) if door_face == 'side' else (-2.6, 1.6)
                q = [b0, b1, (b1[0] + out[0], b1[1] + out[1] + 2.2), (b0[0] + out[0], b0[1] + out[1] + 2.2)]
                red, crm = T['ROOFS']['red'][1][1], T['WALLS']['cream'][1][2]

                def stripe(xx, yy, b0=b0, along=along):
                    t = ((xx / S - b0[0]) * along[0] + (yy / S - b0[1]) * along[1])
                    return red if int(t / 1.4) % 2 == 0 else crm
                s.c.poly([s.P(*v) for v in q], stripe, T['OL'])
        return (P0, Rr, Lc, Bk, M0, M1)

    def silo(s, x, y, r, h, cap='red'):
        S = s.S
        s.shadow([(x - r, y), (x + r, y), (x + r + h * 0.6, y + h * 0.22), (x - r + h * 0.6, y + h * 0.22)], 0.42)
        M = T['METAL']

        def ins(px_, py_):
            X, Y = px_ / S, py_ / S
            if abs(X - x) > r:
                return False
            e = math.sqrt(max(0, 1 - ((X - x) / r) ** 2)) * r / 2
            return (y - h - e) <= Y <= (y + e)

        def sh(px_, py_):
            X, Y = px_ / S, py_ / S
            u = (X - x) / r
            t = 0.85 - (u + 1) * 0.38
            e = math.sqrt(max(0, 1 - u * u)) * r / 2
            for band in (0.3, 0.62):
                if abs(Y - (y - h * band + e)) < 0.6 / S + 0.3:
                    t -= 0.35
            return pick(M, t, px_, py_)
        s.c.shape(ins, ((x - r) * S, (y - h - r) * S, (x + r) * S, (y + r) * S), sh, T['OL'])
        rr = T['ROOFS'][cap]
        s.c.blob(x * S, (y - h) * S, r * S + 0.5, r * S * 0.85, rr[0][1:] + rr[1], T['OL'], dither=True)
        s.c.set(int(x * S), int((y - h - r * 0.85) * S) - 1, T['OL'])

    def tree(s, x, y, size, kind='oak'):
        S = s.S
        c = s.c
        rnd = random.Random(int(x * 31 + y * 17))
        s.shadow([(x - size * 0.15, y), (x + size * 0.8, y + size * 0.08), (x + size * 0.9, y + size * 0.3), (x, y + size * 0.26)], 0.33)
        if kind in ('pine', 'cypress'):
            if kind == 'cypress':
                th = size * 0.12
                hgt, hw = size * 1.9, size * 0.2
            else:
                th = size * 0.18
                hgt, hw = size * 1.55, size * 0.46
            top = y - th - hgt
            c.rect(int((x - 0.5) * S), int((y - th - 1) * S), max(1, int(1.2 * S + 0.5)), int((th + 1) * S) + 1, T['TRUNK'][0])
            tiers = 1 if kind == 'cypress' else 4

            def ins(px_, py_):
                X, Y = px_ / S, py_ / S
                if Y < top or Y > y - th:
                    return False
                f = (Y - top) / hgt
                if kind == 'cypress':
                    wdt = hw * math.sin(min(1.0, f * 1.15) * math.pi * 0.92) ** 0.8 + 0.3
                    return abs(X - x) <= wdt
                ft = (f * tiers) % 1.0
                k = min(tiers - 1, int(f * tiers))
                jag = (hsh(int(px_), int(py_ / 2), 5) - 0.5) * 0.12
                wdt = hw * (0.35 + 0.65 * (k + ft) / tiers) * (0.5 + 0.5 * ft + jag)
                return abs(X - x) <= wdt

            def sh(px_, py_):
                X, Y = px_ / S, py_ / S
                f = (Y - top) / hgt
                ft = (f * tiers) % 1.0 if kind == 'pine' else 0.5
                t = 0.78 - ((X - x) / max(hw, 1) + 1) * 0.32 - ft * 0.18 + (hsh(int(px_), int(py_), 2) - 0.5) * 0.18
                return pick(T['PINE'], t, px_, py_)
            c.shape(ins, ((x - hw - 1) * S, top * S, (x + hw + 1) * S, (y - th) * S), sh, T['OL'])
            return
        # broadleaf and olive: a trunk with forks and an irregular crown of clumps
        olive = kind == 'olive'
        ramp = T['OLIVE'] if olive else T['OAK']
        th = size * (0.35 if olive else 0.42)
        tw = max(1, int(round((1.6 if olive else 1.3) * S)))
        trunk = T['TRUNK']
        c.rect(int((x - 0.6) * S), int((y - th) * S), tw, int(th * S) + 1, trunk[1])
        if olive and S * size > 8:
            c.set(int((x + 0.8) * S), int((y - th * 0.5) * S), trunk[0])
        r = size * (0.42 if olive else 0.5)
        cy = y - th - r * 0.7
        n = 4 if olive else 6
        blobs = [(0, 0, r * 0.75)]
        for k in range(n):
            a = k / n * math.tau + rnd.uniform(-0.4, 0.4)
            d = r * rnd.uniform(0.45, 0.7)
            blobs.append((math.cos(a) * d * 1.15, math.sin(a) * d * 0.75 - r * 0.05, r * rnd.uniform(0.38, 0.55)))
        for (bx, by, br) in blobs[1:3]:
            c.line(x * S, (y - th) * S, (x + bx * 0.6) * S, (cy + by * 0.6 + br * 0.4) * S, trunk[0])

        def ins(px_, py_):
            X, Y = px_ / S - x, py_ / S - cy
            return any((X - bx) ** 2 + (Y - by) ** 2 <= br * br for (bx, by, br) in blobs)

        def sh(px_, py_):
            X, Y = px_ / S - x, py_ / S - cy
            best, t = None, 0.5
            for (bx, by, br) in blobs:
                dd = math.hypot(X - bx, Y - by) / br
                if dd <= 1 and (best is None or dd < best):
                    best = dd
                    nx, ny = (X - bx) / br, (Y - by) / br
                    t = 0.55 + (-nx * 0.5 - ny * 0.7) * 0.45 + (1 - dd) * 0.15
            t += (hsh(int(px_ / 2), int(py_ / 2), 8) - 0.5) * 0.3
            return pick(ramp, t, px_, py_)
        c.shape(ins, ((x - r * 1.6) * S, (cy - r * 1.3) * S, (x + r * 1.6) * S, (cy + r * 1.3) * S), sh, T['OL'])
        if kind == 'apple':
            for k in range(5):
                c.set(int((x + rnd.uniform(-0.6, 0.6) * r) * S), int((cy + rnd.uniform(-0.4, 0.5) * r) * S), H('#e05a4a') if not T['night'] else H('#c24a5a'))

    def bush(s, x, y, r, col=None):
        S = s.S
        s.c.blob(x * S, y * S, r * S + 0.5, r * 0.75 * S + 0.5, T['OAK'][1:4], T['OL'], dither=True)
        if col is not None:
            rnd = random.Random(int(x * 13 + y * 7))
            for k in range(4):
                s.c.set(int((x + rnd.uniform(-r, r) * 0.6) * S), int((y + rnd.uniform(-r, r) * 0.4) * S), col)

    def lantern(s, x, y):
        S = s.S
        s.c.rect(int(x * S), int((y - 9) * S), 1, int(9 * S) + 1, T['OL'])
        s.c.set(int(x * S), int((y - 9) * S) - 1, T['WIN'] if T['night'] else H('#f5ca63'))
        s.c.set(int(x * S) + 1, int((y - 9) * S) - 1, T['WIN2'] if T['night'] else H('#d8a443'))
        s.glow(x, y - 9, 16, 0.4)

    def slab(s, x, y, w, d, t, top, side):
        P0, Rr = (x, y), (x + w, y - w / 2)
        Lc, Bk = (x - d, y - d / 2), (x + w - d, y - w / 2 - d / 2)
        up = lambda p: (p[0], p[1] - t)
        s.face([P0, Rr, up(Rr), up(P0)], side, y - t, y, 0.4)
        s.face([P0, Lc, up(Lc), up(P0)], side, y - t, y, 0.7)
        s.face([up(P0), up(Rr), up(Bk), up(Lc)], top, y - t - w / 2 - d / 2, y - t, 0.9)

    def bench(s, x, y):
        wd = T['WALLS']['wood']
        s.slab(x, y, 9, 3, 1.2, wd[1], wd[0])
        S = s.S
        for (lx, ly) in ((x + 1, y), (x + 8, y - 3.5)):
            s.c.rect(int(lx * S), int((ly - 0.5) * S), 1, max(1, int(2 * S)), wd[0][0])

    def hay(s, x, y):
        s.slab(x, y, 5, 4, 4, R('#c99a3a', '#e0b44e', '#f2cc6a'), R('#a8781e', '#c4922c'))

    def truck(s, x, y):
        S = s.S
        bx, by = x + 9, y - 4.5
        s.shadow([(x, y), (bx + 20, by - 10), (bx + 26, by - 6), (x + 6, y + 4)], 0.4)
        wd = T['ROOFS']['wood']
        s.slab(bx, by, 18, 10, 5, wd[1], wd[0])
        for k in range(3):
            s.slab(bx + 2 + k * 5, by - 5 - k * 2.5 - 1, 4, 4, 3.5, R('#c84a3a', '#e06050', '#f07a66') if k != 1 else R('#5a9a48', '#76b458', '#9ad078'), wd[0])
        P0, Rr, Lc, Bk, h = (x, y), (x + 9, y - 4.5), (x - 10, y - 5), (x - 1, y - 9.5), 10
        up = lambda p, k=h: (p[0], p[1] - k)
        red = T['WALLS']['barn']
        s.face([P0, Rr, up(Rr), up(P0)], red[0], y - h, y, 0.8)
        s.face([P0, Lc, up(Lc), up(P0)], red[1], y - h, y, 0.95)
        s.face([up(P0), up(Rr), up(Bk), up(Lc)], red[1], y - h - 10, y - h, 1.0)
        f = lambda a, b, t: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        w0, w1 = f(P0, Lc, 0.15), f(P0, Lc, 0.85)
        s.c.poly([s.P(*p) for p in [(w0[0], w0[1] - h + 2), (w1[0], w1[1] - h + 2), (w1[0], w1[1] - h + 5.5), (w0[0], w0[1] - h + 5.5)]], lambda a, b: T['WIN'], T['OL'])
        for (wx, wy) in (f(P0, Rr, 0.5), (bx + 13, by - 6.5 + 1)):
            r = max(1.2, 2.4 * S)
            s.c.blob(wx * S, (wy + 0.5) * S, r, r, R('#14121f', '#2b2842', '#5c587a'), T['OL'], dither=False)

    def fence(s, x0, y0, x1, y1, n, col=None):
        S = s.S
        wd = T['WALLS']['wood'][1]
        rail = col or wd[2]
        for k in (4.0, 2.0):
            s.c.line(x0 * S, (y0 - k) * S, x1 * S, (y1 - k) * S, rail)
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            s.c.rect(int(x * S), int((y - 6) * S), max(1, int(round(1.2 * S))), int(6 * S) + 1, wd[0])
            s.c.set(int(x * S), int((y - 6) * S), rail)

    def picket(s, x0, y0, x1, y1, n):
        S = s.S
        white = T['TRIM']
        s.c.line(x0 * S, (y0 - 2.5) * S, x1 * S, (y1 - 2.5) * S, white)
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            s.c.rect(int(x * S), int((y - 4.5) * S), 1, int(4.5 * S) + 1, white)
            s.c.set(int(x * S), int((y - 4.5) * S) + 1, T['OL'])

    def cow(s, x, y, flip=False):
        S = s.S
        w, b = T['COW']
        s.shadow([(x - 3, y), (x + 4, y), (x + 6, y + 1.5), (x - 1, y + 1.5)], 0.3)
        s.c.blob(x * S, (y - 3) * S, 3.4 * S, 2.0 * S, [w], T['OL'], dither=False)
        hx = x + (-3.6 if flip else 3.6)
        s.c.blob(hx * S, (y - 4) * S, 1.4 * S + 0.3, 1.2 * S + 0.3, [w], T['OL'], dither=False)
        s.c.set(int((x - 1) * S), int((y - 3.2) * S), b)
        s.c.set(int((x + 1) * S), int((y - 2.6) * S), b)
        for lx in (-2, 2):
            s.c.set(int((x + lx) * S), int((y - 0.6) * S), T['OL'])

    def greenhouse(s, x, y, w, d, h, hr, lit):
        S = s.S
        P0, Rr = (x, y), (x + w, y - w / 2)
        Lc, Bk = (x - d, y - d / 2), (x + w - d, y - w / 2 - d / 2)
        up = lambda p, k=h: (p[0], p[1] - k)
        s.shadow([P0, Rr, (Rr[0] + h * 0.7, Rr[1] + h * 0.25), (P0[0] + h * 0.7, P0[1] + h * 0.25)], 0.3)
        # plants inside first
        rnd = random.Random(5)
        for k in range(12):
            px_ = x + rnd.uniform(-d * 0.8, w * 0.9)
            py_ = y - rnd.uniform(1, w * 0.45)
            if pip(px_, py_, [P0, Rr, Bk, Lc]):
                s.c.blob(px_ * S, (py_ - 2) * S, 2.2 * S, 2.6 * S, T['OAK'][2:], None, dither=True)
                if k % 3 == 0:
                    s.c.set(int(px_ * S), int((py_ - 3) * S), T['FLOWERS'][k % 3])
        M0 = (x - d / 2, y - d / 4 - h - hr)
        M1 = (M0[0] + w, M0[1] - w / 2)
        glass = T['GLASS']
        frame = T['TRIM']
        faces = [[P0, Rr, up(Rr), up(P0)], [P0, Lc, up(Lc), up(P0)], [up(P0), up(Rr), M1, M0], [up(P0), up(Lc), M0]]
        for f_ in faces:
            sp = [s.P(*p) for p in f_]
            xs = [p[0] for p in sp]
            ys = [p[1] for p in sp]
            for yy in range(int(min(ys)), int(max(ys)) + 1):
                for xx in range(int(min(xs)), int(max(xs)) + 1):
                    if s.c.ok(xx, yy) and pip(xx + 0.5, yy + 0.5, sp):
                        s.c.blend(xx, yy, glass, 0.42 if not T['night'] else 0.3)
                        if (xx + yy) % 7 == 0:
                            s.c.blend(xx, yy, H('#ffffff'), 0.35)
        for k in range(5):
            t = k / 4
            a = (P0[0] + (Rr[0] - P0[0]) * t, P0[1] + (Rr[1] - P0[1]) * t)
            s.seg(a, up(a), frame)
            m = (M0[0] + (M1[0] - M0[0]) * t, M0[1] + (M1[1] - M0[1]) * t)
            s.seg(up(a), m, frame)
        for k in range(4):
            t = k / 3
            a = (P0[0] + (Lc[0] - P0[0]) * t, P0[1] + (Lc[1] - P0[1]) * t)
            s.seg(a, up(a), frame)
        for p, q in ((P0, Rr), (P0, Lc), (up(P0), up(Rr)), (up(P0), up(Lc)), (M0, M1), (up(P0), M0), (up(Lc), M0), (up(Rr), M1)):
            s.seg(p, q, frame)
        if lit and T['night']:
            s.glow(x + w * 0.4, y - h * 0.6 - w * 0.2, 26, 0.3)

    # ---------------- glow pass ----------------
    def glowpass(s):
        c = s.c
        for (gx, gy, r, col, a) in s.glows:
            for y in range(int(gy - r), int(gy + r) + 1):
                for x in range(int(gx - r), int(gx + r) + 1):
                    if not c.ok(x, y):
                        continue
                    d = math.hypot(x + 0.5 - gx, y + 0.5 - gy) / r
                    if d < 1:
                        f = (1 - d) ** 1.6
                        if f > bay(x, y) * 0.9:
                            c.blend(x, y, col, a * (0.5 + f * 0.5))

    # ---------------- compose ----------------
    def field_poly(s, x, y, w, d, scale=1.0):
        w, d = w * scale, d * scale
        return [(x, y), (x + w, y - w / 2), (x + w - d, y - w / 2 - d / 2), (x - d, y - d / 2)]

    def free(s, x, y, pad=0.0):
        """no trees in fields, on paths, in the river or on buildings"""
        for poly in s.blocked:
            if pip(x, y, poly):
                return False
        if abs(x - s.river_x(y)) < s.river_w(y) / 2 + 5 + pad:
            return False
        for (px_, py_, w) in s.road_pts:
            if (x - px_) ** 2 + (y - py_) ** 2 < (w / 2 + 3 + pad) ** 2:
                return False
        return True

    def road(s, pts, width):
        s.path(pts, width)
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            n = int(math.hypot(x1 - x0, y1 - y0) / 2) + 1
            for k in range(n + 1):
                t = k / n
                s.road_pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width))

    def render(s):
        S, D = s.S, s.D
        so, lo = s.sort_open, s.lab_open
        night = T['night']
        WHEAT = R('#3e3a30', '#4e4a38', '#5e5840') if night else R('#c09c44', '#d6b456', '#e6c86c')
        s.blocked = []
        s.road_pts = []
        s.sky()
        s.range_([(40, 92, 110), (150, 58, 125), (268, 82, 118), (372, 66, 108)], 228, T['MFAR'], 1, 0.3)
        s.range_([(-25, 150, 95), (105, 146, 92), (228, 156, 84), (345, 140, 94)], 236, T['MNEAR'], 2, 0.12)
        s.ground()
        s.river()                       # drawn before the forest, so it comes out of the trees
        s.forest(238, 5)
        s.forest(247, 6)
        s.forest(254, 9)
        s.mist(236, 280)
        # fields: smaller towards the back (perspective); kinds: crop rows, wheat, ploughed soil, vegetables, vines
        KINDS = {
            'crop': ([T['SOIL'][1], T['CROP'][1], T['CROP'][2]], True, 3.0),
            'wheat': ([WHEAT[0], WHEAT[1], WHEAT[2]], True, 2.4),
            'soil': ([T['SOIL'][0], T['SOIL'][1], T['SOIL'][2]], False, 2.6),
            'veg': ([T['SOIL'][1], T['CROP'][2], T['CROP'][0]], False, 3.4),
            'vine': ([T['GRASS'][1], T['VINE'][1], T['VINE'][0]], True, 3.0),
        }
        FIELDS = [
            (226, 274, 52, 20, 'wheat'), (282, 282, 60, 22, 'crop'), (338, 278, 50, 20, 'soil'), (372, 292, 40, 18, 'wheat'),
            (16, 278, 56, 20, 'crop'), (66, 288, 44, 18, 'wheat'), (234, 322, 40, 20, 'soil'), (300, 332, 56, 24, 'vine'),
            (352, 356, 38, 20, 'wheat'), (14, 366, 40, 22, 'veg'), (98, 374, 30, 16, 'wheat'), (226, 376, 30, 18, 'crop'),
            (238, 418, 34, 20, 'veg'), (336, 472, 44, 24, 'crop'), (320, 500, 60, 32, 'vine'), (10, 528, 36, 22, 'soil'),
            (196, 592, 36, 20, 'veg'), (300, 566, 44, 26, 'wheat'), (350, 600, 34, 22, 'crop'), (8, 616, 44, 28, 'crop'),
            (96, 670, 32, 18, 'wheat'), (24, 700, 76, 44, 'crop'), (186, 702, 52, 30, 'wheat'), (312, 706, 64, 36, 'soil'),
        ]
        for (x, y, w, d, k) in FIELDS:
            cols, rows, step = KINDS[k]
            sc = s.field_scale(y)
            s.iso_rows(x, y, w, d, cols, rows, step, sc)
            p = s.field_poly(x, y, w, d, sc)
            s.blocked.append([(px_ + (px_ - p[0][0]) * 0.05, py_) for (px_, py_) in p])
        # roads: farm tracks and the village streets
        s.road([(148, 336), (126, 398), (108, 488)], 8)
        s.road([(70, 420), (100, 446), (126, 430)], 6)
        s.road([(108, 488), (180, 500), (236, 478), (262, 436)], 8)
        s.road([(236, 478), (250, 548), (252, 628)], 7)
        s.road([(148, 336), (156, 316), (170, 300), (186, 292)], 5)
        s.road([(104, 324), (130, 318), (156, 316), (190, 326)], 4.5)
        s.road([(130, 318), (126, 296), (138, 284)], 4)
        s.road([(108, 488), (98, 520), (100, 536)], 5)
        by = 497
        bx, bw = s.river_x(by), s.river_w(by)
        s.slab(bx - bw / 2 - 5, by + 4, bw + 10, 10, 2, T['ROOFS']['wood'][1], T['ROOFS']['wood'][0])
        n = int((bw + 10) / 3)
        for k in range(n + 1):
            px_ = bx - bw / 2 - 5 + k * 3
            s.c.line(px_ * S, (by + 4 - k * 1.5 - 2) * S, px_ * S, (by + 4 - k * 1.5 - 6) * S, T['WALLS']['wood'][0][0])
        s.c.line((bx - bw / 2 - 5) * S, (by - 2) * S, (bx + bw / 2 + 5) * S, (by - 2 - (bw + 10) / 2) * S, T['ROOFS']['wood'][1][2])
        s.items = []
        # the village, a little smaller (it is further away), with streets between the houses
        k = 0.84
        V = [(112, 312, 23, 17, 16, 10, 'cream', 'red', True), (142, 302, 19, 16, 15, 9, 'peach', 'red', False),
             (178, 318, 25, 16, 17, 10, 'lilac', 'slate', True), (94, 336, 19, 15, 14, 9, 'peach', 'red', False),
             (124, 284, 17, 13, 13, 8, 'cream', 'slate', False), (150, 346, 17, 13, 13, 8, 'cream', 'red', True), (198, 300, 15, 12, 12, 8, 'peach', 'red', False)]
        for (x, y, w, d, h, hr, wl, rf, ch) in V:
            s.blocked.append(s.field_poly(x + 2, y + 4, w * k + 4, d * k + 6))
            s.add(y, (lambda x=x, y=y, w=w, d=d, h=h, hr=hr, wl=wl, rf=rf, ch=ch: s.house(x, y, w * k, d * k, h * k, hr * k, wl, rf, chimney=ch, flowers=True)))
        s.add(292, lambda: s.house(162, 292, 10, 10, 32, 13, 'stone', 'red', nwin=1, door=False, kind='pyramid'))
        s.blocked.append(s.field_poly(164, 296, 16, 16))

        # La stalla (lesson 4)
        s.add(410, lambda: s.house(54, 410, 30, 20, 15, 11, 'wood', 'red', lit=False, nwin=2, door_face='gable', trim=True))
        s.add(436, lambda: s.fence(20, 424, 50, 439, 6))
        s.add(446, lambda: s.fence(50, 439, 84, 422, 6))
        s.add(432, lambda: s.cow(38, 432))
        s.add(428, lambda: s.cow(64, 428, True))
        s.add(436, lambda: s.hay(80, 436))
        s.blocked.append(s.field_poly(20, 446, 70, 40))

        # La pesatura: farmhouse, a little vegetable patch, the scale and the truck beside it (not in the river)
        s.add(488, lambda: s.house(94, 488, 40, 26, 20, 14, 'cream', 'red', nwin=3, chimney=True, flowers=True, shutters=True,
                                   door_face='side', awning=True, trim=True, round_win=True))
        s.add(540, lambda: s.slab(84, 548, 24, 16, 2, T['METAL'][1:4], T['METAL'][0:2]))
        s.add(542, lambda: s.truck(88, 550))
        s.add(494, lambda: s.hay(66, 494))
        s.add(498, lambda: s.hay(72, 500))
        s.add(500, lambda: s.picket(52, 492, 76, 504, 6))
        s.add(512, lambda: s.bench(116, 508))
        s.blocked.append(s.field_poly(60, 500, 80, 50))
        s.blocked.append(s.field_poly(70, 560, 50, 30))

        # Lo smistamento
        s.add(392, lambda: s.silo(332, 394, 8, 38, 'red'))
        s.add(424, lambda: s.house(282, 424, 40, 28, 21, 15, 'barn', 'slate', lit=so, nwin=3, trim=True, round_win=True,
                                   door_face='gable', smoke=False))
        if not so:
            s.add(446, lambda: s.fence(240, 436, 282, 457, 7))
        for kk in range(3):
            s.add(430 + kk, (lambda kk=kk: s.slab(300 + kk * 6, 438 - kk * 3, 4, 4, 3.5, R('#c84a3a', '#e06050', '#f07a66'), T['ROOFS']['wood'][0])))
        s.blocked.append(s.field_poly(250, 440, 100, 50))

        # Il laboratorio
        s.add(630, lambda: s.house(258, 630, 24, 22, 18, 13, 'lilac', 'green', lit=lo, nwin=2, chimney=True, door_face='gable',
                                   trim=True, flowers=lo, smoke=lo))
        s.add(620, lambda: s.greenhouse(282, 618, 30, 20, 14, 8, lo))
        if not lo:
            s.add(668, lambda: s.fence(224, 642, 278, 669, 9))
            s.add(672, lambda: s.fence(278, 669, 346, 635, 11))
        s.blocked.append(s.field_poly(224, 676, 130, 60))

        # an olive grove in rows, front left
        for row in range(3):
            for col in range(4):
                x, y = 58 + col * 15 - row * 9, 600 + row * 11 - col * 5
                if s.free(x, y):
                    s.add(y, (lambda x=x, y=y: s.tree(x, y, 13 * s.depth(y) * 1.25, 'olive')))
                    s.blocked.append([(x - 5, y - 5), (x + 5, y - 5), (x + 5, y + 3), (x - 5, y + 3)])
        # trees: pines (more at the back and on the edges), chestnuts, oaks, cypresses near the village
        rnd = random.Random(42)
        placed = []
        tries = 0
        while len(placed) < 95 and tries < 4000:
            tries += 1
            x, y = rnd.uniform(4, 386), rnd.uniform(266, 712)
            ds = s.depth(y)
            if not s.free(x, y, 2 * ds):
                continue
            if any((x - px_) ** 2 + ((y - py_) * 1.6) ** 2 < (11 * ds) ** 2 for (px_, py_) in placed):
                continue
            near_village = 80 < x < 215 and 270 < y < 360
            u = rnd.random()
            if near_village:
                kind = 'cypress' if u < 0.6 else 'oak'
            elif y < 330 or x < 24 or x > 364:
                kind = 'pine' if u < 0.7 else ('oak' if u < 0.9 else 'cypress')
            else:
                kind = 'pine' if u < 0.38 else ('oak' if u < 0.72 else ('cypress' if u < 0.86 else 'apple'))
            size = {'pine': 20, 'cypress': 18, 'oak': 18, 'apple': 14}[kind] * ds * rnd.uniform(0.85, 1.15)
            placed.append((x, y))
            s.add(y, (lambda x=x, y=y, size=size, kind=kind: s.tree(x, y, size, kind)))
        flowers = T['FLOWERS'] + [None]
        nb = 0
        while nb < 26 and tries < 8000:
            tries += 1
            x, y = rnd.uniform(10, 380), rnd.uniform(300, 700)
            if not s.free(x, y, 1):
                continue
            nb += 1
            s.add(y, (lambda x=x, y=y, r=rnd.uniform(2.5, 4) * s.depth(y), col=flowers[nb % 4]: s.bush(x, y, r, col)))
        for (x, y) in ((130, 404), (118, 462), (160, 498), (218, 490), (246, 514), (254, 590), (256, 450)):
            s.add(y, (lambda x=x, y=y: s.lantern(x, y)))
        for z, _, fn in sorted(s.items):
            fn()
        if night:
            rnd = random.Random(8)
            for i in range(26):
                x, y = rnd.uniform(10, 380) * S, rnd.uniform(330, 690) * S
                s.c.set(int(x), int(y), T['WIN'])
                s.glows.append((x, y, 3, T['WIN'], 0.3))
        s.glowpass()
        return s.c


# where the places are (CSS px of the 390 x 700 map) -> % for the HTML buttons
PLACES = {
    'weigh': {'x': 100, 'y': 454, 'w': 92, 'h': 76, 'label': 494},
    'sort': {'x': 296, 'y': 392, 'w': 96, 'h': 78, 'label': 438},
    'lab': {'x': 282, 'y': 604, 'w': 104, 'h': 60, 'label': 644},
    'barn': {'x': 56, 'y': 400, 'w': 80, 'h': 50, 'label': 448},
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for tname, theme in (('night', NIGHT), ('day', DAY)):
        use(theme)
        for so in (0, 1):
            for lo in (0, 1):
                m = Map(2 / 3, 2, bool(so), bool(lo))
                c = m.render()
                fn = 'map-%s-s%dl%d.png' % (tname, so, lo)
                c.im.convert('RGB').save(os.path.join(OUT, fn), optimize=True)
                print(fn, c.w, c.h)
    pl = {k: {'left': round(v['x'] / 390 * 100, 2), 'top': round(v['y'] / 700 * 100, 2),
              'w': round(v['w'] / 390 * 100, 2), 'h': round(v['h'] / 700 * 100, 2), 'label': round(v['label'] / 700 * 100, 2)} for k, v in PLACES.items()}
    json.dump(pl, open(os.path.join(OUT, 'places.json'), 'w'), indent=1)
