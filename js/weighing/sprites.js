// The pixel-art sprite sheet of the weighing station (made by tools/pixelart/weighgen.py).
// Sprites are drawn 1:1 in the pixel canvas's backing pixels (one art pixel each), so they stay
// crisp: blit() takes integer backing coordinates; withPixels() switches a context to them.
import { VERSION } from '../version.js';

let img = null, shedImg = null, M = null;
let ready = false;
const waiting = [];

export function loadSprites() {
  if (img) return;
  img = new Image();
  shedImg = new Image();
  const v = `?v=${VERSION}`;
  const pic = (im, src) => new Promise((res) => { im.onload = res; im.onerror = res; im.src = src; });
  Promise.all([
    fetch(`assets/weigh/sprites.json${v}`).then((r) => r.json()),
    pic(img, `assets/weigh/sprites.png${v}`),
    pic(shedImg, `assets/weigh/shed.png${v}`),
  ]).then(([m]) => { M = m; ready = true; waiting.splice(0).forEach((f) => f()); }).catch(() => {});
}

export const spritesReady = () => ready;
export const onSpritesReady = (f) => { if (ready) f(); else waiting.push(f); };
export const meta = (name) => (M ? M[name] : null);
export const has = (name) => !!(M && M[name]);
export const size = (name) => (M && M[name] ? M[name].r.slice(2) : [0, 0]);

// Run fn(k) with the context in backing pixels (k = backing px per CSS px).
export function withPixels(ctx, fn) {
  const m = ctx.getTransform();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  try { return fn(m.a, m); } finally { ctx.restore(); }
}

// Draw a sprite with its top-left at integer backing pixel (x, y); mirrored if flip; scale 1 or 2.
export function blit(ctx, name, x, y, flip = false, scale = 1) {
  const s = M && M[name];
  if (!s || !ready) return;
  const [sx, sy, sw, sh] = s.r;
  x = Math.round(x); y = Math.round(y);
  if (flip) {
    ctx.save();
    ctx.translate(x + sw * scale, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
    ctx.restore();
  } else ctx.drawImage(img, sx, sy, sw, sh, x, y, sw * scale, sh * scale);
}

// The shed interior, floor line at backing y = floorY; repeats the plank wall to the right.
export function blitShed(ctx, widthB, floorY, xoff = 0) {
  const s = M && M._shed;
  if (!s || !ready) return false;
  const y0 = Math.round(floorY - s.floor);
  if (y0 > 0) {
    ctx.fillStyle = '#a58e6e';
    ctx.fillRect(0, 0, widthB, y0);
    ctx.fillStyle = '#6e5848';
    ctx.fillRect(0, y0, widthB, 1);
  }
  ctx.drawImage(shedImg, -xoff, y0);
  for (let x = s.w - xoff; x < widthB; x += s.w - 124) ctx.drawImage(shedImg, 124, 0, s.w - 124, s.h, x, y0, s.w - 124, s.h);
  return true;
}

// A small portrait (data URL) of a sprite, scaled up `k` times without smoothing.
const portraits = new Map();
export function portrait(name, k = 3) {
  const key = `${name}@${k}`;
  if (portraits.has(key)) return portraits.get(key);
  const s = M && M[name];
  if (!s || !ready) return null;
  const [sx, sy, sw, sh] = s.r;
  const c = document.createElement('canvas');
  c.width = sw * k; c.height = sh * k;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw * k, sh * k);
  const url = c.toDataURL('image/png');
  portraits.set(key, url);
  return url;
}
