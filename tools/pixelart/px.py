"""Small pixel-art toolkit: canvas, dithering, shaded shapes, bitmap digits."""
import math
from PIL import Image

B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bay(x, y):
    return (B4[y & 3][x & 3] + 0.5) / 16.0


def H(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def R(*hs):
    return [H(h) for h in hs]


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3)) + (255,)


def pick(ramp, t, x=0, y=0, dither=True):
    t = max(0.0, min(1.0, t))
    f = t * (len(ramp) - 1)
    i = int(f)
    fr = f - i
    if dither:
        if fr > bay(x, y):
            i += 1
    elif fr > 0.5:
        i += 1
    return ramp[min(i, len(ramp) - 1)]


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def vnoise(x, y, s=0):
    xi, yi = math.floor(x), math.floor(y)
    xf, yf = x - xi, y - yi
    a, b = hsh(xi, yi, s), hsh(xi + 1, yi, s)
    c, d = hsh(xi, yi + 1, s), hsh(xi + 1, yi + 1, s)
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def pip(x, y, pts):
    ins = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            ins = not ins
        j = i
    return ins


class Cv:
    def __init__(s, w, h, bg=(0, 0, 0, 0)):
        s.w, s.h = w, h
        s.im = Image.new('RGBA', (w, h), bg)
        s.p = s.im.load()

    def ok(s, x, y):
        return 0 <= x < s.w and 0 <= y < s.h

    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.p[x, y] = c

    def get(s, x, y):
        return s.p[x, y]

    def blend(s, x, y, c, t):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.p[x, y] = mix(s.p[x, y], c, t)

    def rect(s, x, y, w, h, c):
        for yy in range(int(round(y)), int(round(y + h))):
            for xx in range(int(round(x)), int(round(x + w))):
                s.set(xx, yy, c)

    def shape(s, inside, bbox, shader, outline=None, sides=4):
        x0, y0, x1, y1 = [int(math.floor(v)) for v in bbox]
        m = set()
        for y in range(y0 - 1, y1 + 2):
            for x in range(x0 - 1, x1 + 2):
                if inside(x + 0.5, y + 0.5):
                    m.add((x, y))
        if outline is not None:
            nb = [(1, 0), (-1, 0), (0, 1), (0, -1)]
            if sides == 8:
                nb += [(1, 1), (-1, 1), (1, -1), (-1, -1)]
            for (x, y) in m:
                for dx, dy in nb:
                    if (x + dx, y + dy) not in m:
                        s.set(x + dx, y + dy, outline)
        for (x, y) in m:
            c = shader(x, y)
            if c is not None:
                s.set(x, y, c)
        return m

    def poly(s, pts, shader, outline=None):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        if callable(shader):
            sh = shader
        else:
            sh = (lambda x, y, c=shader: c)
        return s.shape(lambda x, y: pip(x, y, pts), (min(xs), min(ys), max(xs), max(ys)), sh, outline)

    def line(s, x0, y0, x1, y1, c, w=1):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            for a in range(w):
                for b in range(w):
                    s.set(x0 + a - w // 2, y0 + b - w // 2, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def blob(s, cx, cy, rx, ry, ramp, outline=None, light=(-0.55, -0.75), dither=True, spec=None, amb=0.0):
        lx, ly = light
        ln = math.hypot(lx, ly)
        lx, ly = lx / ln, ly / ln

        def ins(x, y):
            return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0

        def sh(x, y):
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = min(1.0, nx * nx + ny * ny)
            nz = math.sqrt(1 - d)
            l = (-(nx * lx + ny * ly)) * 0.55 + nz * 0.45 + amb
            return pick(ramp, (l + 0.25) / 1.15, x, y, dither)
        m = s.shape(ins, (cx - rx, cy - ry, cx + rx, cy + ry), sh, outline)
        if spec is not None and rx >= 4:
            s.set(int(cx - rx * 0.45), int(cy - ry * 0.5), spec)
            if rx >= 7:
                s.set(int(cx - rx * 0.45) + 1, int(cy - ry * 0.5), spec)
        return m

    def save(s, path, scale=1):
        im = s.im
        if scale != 1:
            im = im.resize((s.w * scale, s.h * scale), Image.NEAREST)
        im.save(path)


# bitmap digits and '?'
F35 = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
    '?': ['111', '001', '011', '000', '010']
}
F57 = {
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100']
}


def text(cv, x, y, s, c, big=False):
    F = F57 if big else F35
    for ch in s:
        g = F.get(ch, F35.get(ch))
        for j, row in enumerate(g):
            for i, b in enumerate(row):
                if b == '1':
                    cv.set(x + i, y + j, c)
        x += len(g[0]) + 1
