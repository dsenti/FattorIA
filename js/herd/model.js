// Minigame 4: Il pascolo. Pure model: the sheep of each herd, the middle of a herd (the mean of
// its sheep's positions), and the whistle: how far each dog is from the middle of its herd.
import { CONFIG } from '../config.js';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The sheep of a level: [{ x, y, h (herd index) }], the same seed giving the same pasture.
export function makeSheep(lv, seed = 1) {
  const r = rng(seed * 104729 + lv.id.length * 17);
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const sheep = [];
  lv.herds.forEach((hd, hi) => {
    const c = Math.cos(hd.rot || 0), s = Math.sin(hd.rot || 0);
    for (let i = 0; i < hd.n; i++) {
      const a = gauss() * hd.sx, b = gauss() * hd.sy;
      sheep.push({ x: clamp(hd.x + a * c - b * s, 0.05, 0.95), y: clamp(hd.y + a * s + b * c, 0.05, 0.95), h: hi });
    }
    for (let k = 0; k < (hd.strays || 0); k++) {
      const ang = r() * Math.PI * 2, d = 0.28 + r() * 0.12;
      sheep.push({ x: clamp(hd.x + Math.cos(ang) * d, 0.05, 0.95), y: clamp(hd.y + Math.sin(ang) * d, 0.05, 0.95), h: hi });
    }
  });
  return sheep;
}

// The middle of each herd: the mean x and the mean y of its sheep.
export function centres(lv, sheep) {
  return lv.herds.map((_, hi) => {
    const mine = sheep.filter((s) => s.h === hi);
    return { x: mine.reduce((t, s) => t + s.x, 0) / mine.length, y: mine.reduce((t, s) => t + s.y, 0) / mine.length };
  });
}

// The whistle. dogs[i] = { x, y } or null (still in the tray); w, h scale the unit square to the
// screen (distances are measured on screen, tol is a share of the shorter side).
export function whistle(lv, sheep, dogs, w = 1, h = 1) {
  const C = centres(lv, sheep);
  const unit = Math.min(w, h);
  const res = C.map((c, i) => {
    const d = dogs[i];
    if (!d) return { placed: false, ok: false, dist: Infinity };
    const dist = Math.hypot((d.x - c.x) * w, (d.y - c.y) * h) / unit;
    return { placed: true, ok: dist <= lv.tol, dist, near: dist <= lv.tol * 2.2 };
  });
  return { res, pass: res.every((r) => r.ok) };
}

export function payFor(whistles, replay) {
  const P = CONFIG.HERD.PAY;
  const coins = P[Math.min(P.length - 1, Math.max(0, whistles - 1))];
  return replay ? Math.round(coins * CONFIG.HERD.REPLAY_FACTOR) : coins;
}
export const starsFor = (whistles) => (whistles <= 1 ? 3 : whistles === 2 ? 2 : 1);

export function levelOpen(herd, i, levels) {
  return i === 0 || herd.passed.includes(levels[i - 1].id) || herd.passed.includes(levels[i].id);
}
