// Pixel pictures built from the UI sprite sheet (tools/pixelart/uigen.py): the sorting items with
// their states (rotten, muddy, worm, snail), the truck symbols, and the trucks.
import { blit, composeURL, meta, spritesReady } from './weighing/sprites.js';

const S = 20;   // item box, art px

export function itemBase(it) {
  if (it.alive) {
    if (it.t === 'farfalla' || it.t === 'lumaca') return `a_${it.t}_${it.c}`;
    return `a_${it.t}`;
  }
  return `p_${it.t}_${it.c}_${+it.big}${+it.odd}`;
}

function drawItem(ctx, it, x = 0, y = 0, small = false) {
  const base = small && !it.alive ? `p_${it.t}_${it.c}_0${+it.odd}` : itemBase(it);
  if (!it.alive && (it.rot || it.dirty)) {
    // clip rot and soil to the shape of the produce
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const t = c.getContext('2d');
    t.imageSmoothingEnabled = false;
    blit(t, base, 0, 0);
    t.globalCompositeOperation = 'source-atop';
    if (it.rot) blit(t, 'ov_rot', 0, 0);
    if (it.dirty) blit(t, 'ov_dirt', 0, 0);
    ctx.drawImage(c, x, y);
  } else blit(ctx, base, x, y);
  if (!it.alive && it.worm) blit(ctx, 'ov_worm', x, y);
  if (!it.alive && it.snail) blit(ctx, 'ov_snail', x, y);
}

export const itemKeyOf = (it) => `${it.t}-${it.c}-${+it.big}${+it.rot}${+it.dirty}${+it.odd}${+it.worm}${+it.snail}`;
export const itemURL = (it) => composeURL(`it:${itemKeyOf(it)}`, S, S, (ctx) => drawItem(ctx, it));

// ------------------------------------------------------------------ truck symbols (28 x 28 art px)
const SY = 28;
const FIXED = { compost: 's_bin', galline: 's_hen', orto: 's_orto', mercato: 's_mercato' };
const SINGLE = {
  rosse: { t: 'mela', c: 'rosso' }, verdi: { t: 'mela', c: 'verde' }, patate: { t: 'patata', c: 'marrone' },
  carote: { t: 'carota', c: 'arancione' }, pomodori: { t: 'pomodoro', c: 'rosso' }, pere: { t: 'pera', c: 'giallo' },
};
const DEFAULT_SHOW = {
  lavaggio: [{ t: 'patata', c: 'giallo', dirty: true }], brutti: [{ t: 'carota', c: 'arancione', odd: true }],
  grandi: [{ t: 'mela', c: 'rosso' }], piccole: [{ t: 'mela', c: 'rosso' }], mele: [{ t: 'mela', c: 'rosso' }, { t: 'mela', c: 'verde' }],
};
const asItem = (x, big = true) => ({ t: x.t, c: x.c, big, odd: !!x.odd, dirty: !!x.dirty, rot: false, worm: false, snail: false, alive: false });

function drawSymbol(ctx, spec) {
  const show = spec.show && spec.show.length ? spec.show : (DEFAULT_SHOW[spec.truck] || []);
  const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  switch (spec.kind) {
    case 'produce':
      if (show.length === 1) drawItem(ctx, asItem(show[0]), 4, 4);
      else if (show.length === 2) { drawItem(ctx, asItem(show[0], false), 0, 1, true); drawItem(ctx, asItem(show[1], false), 8, 8, true); }
      else { drawItem(ctx, asItem(show[0], false), -1, -1, true); drawItem(ctx, asItem(show[1], false), 9, -1, true); drawItem(ctx, asItem(show[2], false), 4, 9, true); }
      return;
    case 'scale': {
      const heavy = spec.truck === 'grandi';
      px(13, 8, 2, 18, '#3f4b52'); px(9, 26, 10, 2, '#3f4b52');
      const yl = heavy ? 18 : 10, yr = heavy ? 10 : 18;
      for (let i = 0; i <= 20; i++) px(4 + i, Math.round(yl + (yr - yl) * i / 20), 1, 1, '#2c3639');
      blit(ctx, 's_pan', -3, yl, false);
      blit(ctx, 's_pan', 11, yr, false);
      show.slice(0, 2).forEach((x, n) => drawItem(ctx, asItem(x, false), -2 + n * 5, yl - 15 + n, true));
      return;
    }
    case 'wash':
      blit(ctx, 's_tap', 14, 1);
      drawItem(ctx, asItem(show[0]), 0, 8);
      px(22, 14, 1, 2, '#7da2d0'); px(24, 18, 1, 2, '#7da2d0'); px(21, 21, 1, 2, '#7da2d0');
      return;
    case 'odd':
      drawItem(ctx, asItem(show[0]), 0, 6);
      blit(ctx, 's_heart', 17, 2);
      return;
    default:
      if (FIXED[spec.truck]) { blit(ctx, FIXED[spec.truck], 4, 4); return; }
      if (SINGLE[spec.truck]) drawItem(ctx, asItem(SINGLE[spec.truck]), 4, 4);
  }
}

const specKey = (spec) => `${spec.truck}:${spec.kind}:${(spec.show || []).map((x) => `${x.t}${x.c}${x.dirty ? 'd' : ''}${x.odd ? 'o' : ''}`).join(',')}`;
export const symbolURL = (spec) => composeURL(`sy:${specKey(spec)}`, SY, SY, (ctx) => drawSymbol(ctx, spec));

// ------------------------------------------------------------------ trucks for the sorting machine
// The truck centred at x = 0 with its box top at y = 0 (CSS px), the symbol on the box panel.
// Returns { svg, bedX, bedW, height } like art.js truckArt, or null before the sheet has loaded.
export function truckPix(symURL, slotW) {
  if (!spritesReady()) return null;
  const name = slotW >= 84 ? 'st_l' : 'st_s';
  const m = meta(name);
  if (!m) return null;
  const P = 1.5;
  const [, , w, h] = m.r;
  const url = composeURL(`tr:${name}`, w, h, (ctx) => blit(ctx, name, 0, 0));
  const [bx0, by0, bw] = m.box;
  const left = -(w * P) / 2, top = -by0 * P;
  const [px0, py0, pw, ph] = m.panel;
  const sz = Math.min(pw, ph) * P + 2;
  const sx = left + (px0 + pw / 2) * P - sz / 2, sy = top + (py0 + ph / 2) * P - sz / 2;
  const svg = `<image href="${url}" x="${left}" y="${top}" width="${w * P}" height="${h * P}" preserveAspectRatio="none" style="image-rendering:pixelated"/>` +
    (symURL ? `<image href="${symURL}" x="${sx}" y="${sy}" width="${sz}" height="${sz}" preserveAspectRatio="none" style="image-rendering:pixelated"/>` : '');
  return { svg, bedX: left + bx0 * P, bedW: bw * P, height: (h - by0) * P, pixel: true };
}
