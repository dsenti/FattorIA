"""Contact sheet of sprites from weighgen (dev helper): preview.py prefix... -> scratch png"""
import sys
from PIL import Image
import weighgen as W

def sheet(names, path, k=5, bg=(85, 117, 121, 255), maxw=1400):
    ims = [(n, W.SPR[n][0].im) for n in names]
    x = y = rowh = 0
    pos = []
    for n, im in ims:
        w, h = im.width * k, im.height * k
        if x + w > maxw:
            x, y, rowh = 0, y + rowh + 8, 0
        pos.append((n, im, x, y)); x += w + 8; rowh = max(rowh, h)
    out = Image.new('RGBA', (maxw, y + rowh + 8), bg)
    for n, im, x, y in pos:
        out.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST), (x, y))
    out.save(path)

if __name__ == '__main__':
    steps = sys.argv[2].split(',')
    for s in steps: getattr(W, s)()
    pref = sys.argv[3].split(',') if len(sys.argv) > 3 else ['']
    names = [n for n in W.SPR if any(n.startswith(p) for p in pref)]
    sheet(names, sys.argv[1], int(sys.argv[4]) if len(sys.argv) > 4 else 5)

def scene_vehicles(path):
    """each vehicle with wheels, a full crate pile and the lip, as in the game"""
    from px import Cv
    W.make_vehicles(); W.make_wheels(); W.make_crates()
    out = Image.new('RGBA', (1400, 900), (85, 117, 121, 255))
    k = 4; x = 8; y = 8; rowh = 0
    for i in range(11):
        c, m = W.SPR['veh_%d' % i]
        im = Image.new('RGBA', (c.w + 2, c.h + 30), (0, 0, 0, 0))
        im.alpha_composite(c.im, (1, 30))
        cr = W.SPR['crate_mele'][0].im
        bx0, bx1, fl = m['bed']
        for layer in range(3):
            for col in range(int((bx1 - bx0 - 3) // 10)):
                im.alpha_composite(cr, (1 + bx0 + col * 10, 30 + fl - 11 - layer * 8))
        lip = W.SPR['veh_%d_lip' % i][0].im
        im.alpha_composite(lip, (1 + m['lipAt'][0], 30 + m['lipAt'][1]))
        for (wx, wy, wr) in m['wheels']:
            wim = W.SPR['wheel_%d_0' % wr][0].im
            im.alpha_composite(wim, (1 + int(wx - wr), 30 + int(wy - wr)))
        big = im.resize((im.width * k, im.height * k), Image.NEAREST)
        if x + big.width > 1390:
            x, y, rowh = 8, y + rowh + 8, 0
        out.alpha_composite(big, (x, y)); x += big.width + 8; rowh = max(rowh, big.height)
    out.save(path)
