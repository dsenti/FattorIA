// Minigame "Il bosco": pure model. The guide board (known mushrooms), the next mushroom on the
// trail, its k nearest neighbours on the board, and the coins and stars of a trail.
import { CONFIG } from '../config.js';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function gaussFrom(r) {
  return () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
}

function sampleFrom(p, g) {
  const a = g() * p.sx, b = g() * p.sy, c = Math.cos(p.rot), s = Math.sin(p.rot);
  return { x: clamp(p.x + a * c - b * s, 0.04, 0.96), y: clamp(p.y + a * s + b * c, 0.04, 0.96), c: p.c };
}

// The k nearest mushrooms on the board to (x, y): [{ i, d }], nearest first.
export function nearest(board, x, y, k = CONFIG.FOREST.K) {
  return board.map((m, i) => ({ i, d: Math.hypot(m.x - x, m.y - y) })).sort((a, b) => a.d - b.d).slice(0, k);
}

// What the neighbours say: 'good' or 'bad' (the majority of the k nearest).
export function vote(board, x, y, k = CONFIG.FOREST.K) {
  const nn = nearest(board, x, y, k);
  const good = nn.filter((n) => board[n.i].c === 'good').length;
  return good * 2 > nn.length ? 'good' : 'bad';
}

// A trail: the board and a generator for the mushrooms found on the way.
export function makeTrail(lv, seed = 1) {
  const r = rng(seed * 40503 + lv.id.length * 7);
  const g = gaussFrom(r);
  const board = [];
  for (const p of lv.patches) for (let i = 0; i < lv.known; i++) board.push(sampleFrom(p, g));
  const goods = lv.patches.filter((p) => p.c === 'good'), bads = lv.patches.filter((p) => p.c === 'bad');
  let tricks = lv.tricks || 0;
  let lastGood = r() < 0.5;
  // the next mushroom, about half porcini; it agrees with its neighbours unless a trick is left
  const next = (b) => {
    const wantGood = r() < (lastGood ? 0.4 : 0.6);   // fewer long runs of the same kind
    const from = wantGood ? goods : bads;
    for (let t = 0; t < 80; t++) {
      const m = sampleFrom(from[Math.floor(r() * from.length)], g);
      if (b.some((o) => Math.hypot(o.x - m.x, o.y - m.y) < 0.02)) continue;   // not on top of another
      if (vote(b, m.x, m.y) === m.c) { lastGood = wantGood; return m; }
      if (tricks > 0 && t > 20) { tricks -= 1; lastGood = wantGood; return { ...m, trick: true }; }
    }
    const m = sampleFrom(from[0], g);
    return { ...m, c: vote(b, m.x, m.y) };
  };
  return { board, next };
}

// One decision: picked (true) or left (false / null). good picked: +1 in the basket; bad picked:
// a stomach ache (a heart); good left: a porcino missed.
export function judge(m, picked) {
  if (picked) return m.c === 'good' ? 'basket' : 'ache';
  return m.c === 'good' ? 'missed' : 'safe';
}

export function starsFor(t) {
  if (t.hearts <= 0 || t.basket * 2 < t.goods) return 0;
  const mistakes = t.aches + t.missed;
  return mistakes === 0 ? 3 : mistakes <= 1 ? 2 : 1;
}

export function payFor(t, replay) {
  if (starsFor(t) === 0) return 0;
  const coins = Math.min(CONFIG.FOREST.MAX_PAY, t.basket);
  return replay ? Math.round(coins * CONFIG.FOREST.REPLAY_FACTOR) : coins;
}

export function levelOpen(st, i, levels) {
  return i === 0 || st.passed.includes(levels[i - 1].id) || st.passed.includes(levels[i].id);
}
