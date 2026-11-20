// Minigame 3: Il frutteto. Pure model: the orchard's items, fences as lines, and the score.
// A fence is an infinite straight line (it runs across the whole orchard). The fences cut the
// orchard into pieces; in each piece the majority wins (a tie goes to the goats); every tree or
// goat in a piece won by the other kind is a mistake: the goats eat those trees.
import { CONFIG } from '../config.js';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const lineDist = (l, x, y) => {
  const [x1, y1, x2, y2] = l;
  const dx = x2 - x1, dy = y2 - y1;
  return Math.abs(dy * (x - x1) - dx * (y - y1)) / Math.hypot(dx, dy);
};

// Trees and goats for a level (the same seed gives the same orchard).
export function makeItems(lv, seed = 1) {
  const r = rng(seed * 7919 + lv.id.length * 31);
  const items = [];
  const gap = lv.gap ?? 0.06;
  let tries = 0;
  while (items.length < lv.n && tries < 5000) {
    tries++;
    const x = 0.07 + r() * 0.86, y = 0.07 + r() * 0.86;
    if (lv.lines.some((l) => lineDist(l, x, y) < gap)) continue;
    const minD = tries < 2000 ? 0.1 : tries < 3500 ? 0.08 : 0.06;   // closer together if a small zone is full
    if (items.some((it) => Math.hypot(it.x - x, it.y - y) < minD)) continue;
    const c = lv.zone(x, y);
    if (items.filter((it) => it.c === c).length >= Math.ceil(lv.n / 2)) continue;   // about half trees, half goats
    items.push({ x, y, c });
  }
  // both kinds must be there
  const kinds = new Set(items.map((it) => it.c));
  if (kinds.size < 2 && items.length) items[0].c = items[0].c === 'tree' ? 'goat' : 'tree';
  // noise: a few on the wrong side, far from the true lines (a tree, then a goat: the mix stays even)
  const far = items.map((it, i) => ({ i, c: it.c, d: Math.min(...lv.lines.map((l) => lineDist(l, it.x, it.y))) })).sort((a, b) => b.d - a.d);
  for (let k = 0; k < (lv.noise || 0); k++) {
    const of = far.filter((f) => f.c === (k % 2 ? 'goat' : 'tree'));
    const pick = of[Math.floor(k / 2) * 2];
    if (pick) items[pick.i].c = pick.c === 'tree' ? 'goat' : 'tree';
  }
  return items;
}

// Which side of each fence a point is on: the key of its piece.
export const sideOf = (l, x, y) => ((l[2] - l[0]) * (y - l[1]) - (l[3] - l[1]) * (x - l[0]) < 0 ? 1 : 0);
export const pieceKey = (fences, x, y) => fences.map((l) => sideOf(l, x, y)).join('');

export function evaluate(items, fences) {
  const pieces = new Map();
  items.forEach((it, i) => {
    const k = pieceKey(fences, it.x, it.y);
    if (!pieces.has(k)) pieces.set(k, { tree: [], goat: [] });
    pieces.get(k)[it.c].push(i);
  });
  const winner = new Map();
  const wrong = [];
  for (const [k, p] of pieces) {
    const w = p.tree.length > p.goat.length ? 'tree' : 'goat';
    winner.set(k, w);
    for (const i of (w === 'tree' ? p.goat : p.tree)) wrong.push(i);
  }
  return { pieces, winner, wrong, score: items.length ? 1 - wrong.length / items.length : 1 };
}

// The best score any player can reach on these items (the true fences).
export const bestScore = (lv, items) => evaluate(items, lv.lines).score;

export const timeFor = (lv) => CONFIG.ORCHARD.TIME_BASE + CONFIG.ORCHARD.TIME_PER_FENCE * (lv.fences - 1);

export function starsFor(lv, score, best) {
  if (score < lv.pass) return 0;
  if (score >= best - 1e-9) return 3;
  return score >= (lv.pass + best) / 2 ? 2 : 1;
}

export function payFor(lv, score, best, replay) {
  if (score < lv.pass) return 0;
  const O = CONFIG.ORCHARD;
  const f = best > lv.pass ? Math.min(1, (score - lv.pass) / (best - lv.pass)) : 1;
  const coins = Math.round(O.MIN_PAY + (O.MAX_PAY - O.MIN_PAY) * f);
  return replay ? Math.round(coins * O.REPLAY_FACTOR) : coins;
}

// A swipe from (x1, y1) to (x2, y2), unit coordinates, as a fence line.
export const fenceFrom = (x1, y1, x2, y2) => [x1, y1, x2, y2];

// The part of a line inside the unit square, or null.
export function clipToSquare(l) {
  const [x1, y1, x2, y2] = l;
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = -1e9, t1 = 1e9;
  const test = (p, q) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  if (!(test(-dx, x1) && test(dx, 1 - x1) && test(-dy, y1) && test(dy, 1 - y1))) return null;
  if (t1 < t0) return null;
  return [x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1];
}

// Level progress: the first level, and every level after a passed one, is open.
export function levelOpen(lab, i, levels) {
  return i === 0 || lab.passed.includes(levels[i - 1].id) || lab.passed.includes(levels[i].id);
}
