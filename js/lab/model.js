// Minigame 3 (Il laboratorio): the model. Pure functions, no DOM (tested in tests/run.mjs).
//
// A tree of boundary lines, built by the player. A node is { line, kids: [kid, kid] }:
//   line  { x1, y1, x2, y2 }: the boundary through two points of the field (the unit square),
//         or null while the node is still empty ("?")
//   kids  one per side of the line. Walking from (x1, y1) to (x2, y2), kid 0 is the LEFT side,
//         kid 1 the right side. A kid is a class number (a leaf that predicts that colour) or
//         another node. An empty node has kids [null, null].
// The level's true tree (levels.js) has the same shape. Nodes are numbered in pre-order
// (root = 1) and found by their path: the list of kid indices from the root, e.g. [1, 0].
import { CONFIG } from '../config.js';

// ------------------------------------------------------------------ geometry
export const UNIT_SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]];   // counter-clockwise

// > 0 on the left of the line (walking from point 1 to point 2), < 0 on the right.
export const sideValue = (s, x, y) => (s.x2 - s.x1) * (y - s.y1) - (s.y2 - s.y1) * (x - s.x1);
export const branchOf = (s, x, y) => (sideValue(s, x, y) > 0 ? 0 : 1);

// Keeps the part of a convex polygon on one side of the line (Sutherland-Hodgman, one edge).
export function clipPoly(poly, s, keepLeft) {
  const sg = keepLeft ? 1 : -1;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = sg * sideValue(s, a[0], a[1]), fb = sg * sideValue(s, b[0], b[1]);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out.length >= 3 ? out : [];
}

// The part of polygon `poly` on side b (0 = left, 1 = right) of the line.
export const clipBranch = (poly, s, b) => clipPoly(poly, s, b === 0);

export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

export function polyCentroid(poly) {
  if (!poly.length) return null;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const k = p[0] * q[1] - q[0] * p[1];
    a += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k;
  }
  if (Math.abs(a) < 1e-12) return { x: poly[0][0], y: poly[0][1] };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

// Point inside a convex polygon (either orientation, boundary counts as inside).
export function inPoly(poly, x, y, eps = 1e-12) {
  let pos = false, neg = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c > eps) pos = true; else if (c < -eps) neg = true;
    if (pos && neg) return false;
  }
  return poly.length >= 3;
}

function segDist(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

// Distance from a point to a convex polygon (0 inside).
export function polyDist(poly, x, y) {
  if (inPoly(poly, x, y)) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(x, y, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

// The piece of the (infinite) line that lies inside a convex polygon: [[x, y], [x, y]] or null.
export function lineInPoly(s, poly) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const L = dx * dx + dy * dy;
  if (!poly.length || L < 1e-12) return null;
  let t0 = Infinity, t1 = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = sideValue(s, a[0], a[1]), fb = sideValue(s, b[0], b[1]);
    if ((fa > 0 && fb > 0) || (fa < 0 && fb < 0)) continue;
    const pts = fa === fb ? [a, b] : [[a[0] + (b[0] - a[0]) * (fa / (fa - fb)), a[1] + (b[1] - a[1]) * (fa / (fa - fb))]];
    for (const p of pts) {
      const t = ((p[0] - s.x1) * dx + (p[1] - s.y1) * dy) / L;
      t0 = Math.min(t0, t); t1 = Math.max(t1, t);
    }
  }
  if (!(t1 - t0 > 1e-6)) return null;
  return [[s.x1 + t0 * dx, s.y1 + t0 * dy], [s.x1 + t1 * dx, s.y1 + t1 * dy]];
}

// ------------------------------------------------------------------ trees
export const emptyNode = () => ({ line: null, kids: [null, null] });
export const isNode = (k) => !!k && typeof k === 'object';
export const isApplied = (n) => isNode(n) && !!n.line;

// Every node in pre-order: [{ node, path, depth, poly (its region), parent, branch }].
export function listNodes(tree) {
  const out = [];
  const walk = (n, path, poly, parent, branch) => {
    out.push({ node: n, path, depth: path.length, poly, parent, branch });
    if (!n.line) return;
    n.kids.forEach((k, b) => { if (isNode(k)) walk(k, [...path, b], clipBranch(poly, n.line, b), n, b); });
  };
  walk(tree, [], UNIT_SQUARE, null, -1);
  return out;
}

export const countNodes = (tree) => listNodes(tree).length;
export const isComplete = (tree) => listNodes(tree).every((e) => isApplied(e.node));
export const nodeAt = (tree, path) => path.reduce((n, b) => n.kids[b], tree);
export const samePath = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Nodes in a subtree (the node itself included).
export const subtreeSize = (k) => (isNode(k) ? 1 + (k.line ? subtreeSize(k.kids[0]) + subtreeSize(k.kids[1]) : 0) : 0);

// Where a point ends up: { cls (predicted class, or null if it stops at an empty node), done }.
export function route(tree, x, y) {
  let n = tree;
  for (;;) {
    if (!isApplied(n)) return { cls: null, done: false };
    const k = n.kids[branchOf(n.line, x, y)];
    if (!isNode(k)) return { cls: k, done: true };
    n = k;
  }
}

export const predict = (tree, x, y) => route(tree, x, y).cls;

// Does the point reach the node at `path`?
export function reaches(tree, path, x, y) {
  let n = tree;
  for (const b of path) {
    if (!isApplied(n) || branchOf(n.line, x, y) !== b) return false;
    n = n.kids[b];
  }
  return true;
}

// Share of points predicted as their own class. { right, total, acc, ok: [bool per point] }
export function accuracy(tree, pts) {
  const ok = pts.map((p) => predict(tree, p.x, p.y) === p.cls);
  const right = ok.filter(Boolean).length;
  return { right, total: pts.length, acc: pts.length ? right / pts.length : 0, ok };
}

// The field cut into regions: [{ poly, cls (null: an empty node's region), path }].
export function regions(tree) {
  const out = [];
  for (const e of listNodes(tree)) {
    const n = e.node;
    if (!n.line) { if (e.poly.length) out.push({ poly: e.poly, cls: null, path: e.path }); continue; }
    n.kids.forEach((k, b) => {
      if (isNode(k)) return;
      const p = clipBranch(e.poly, n.line, b);
      if (p.length) out.push({ poly: p, cls: k, path: [...e.path, b] });
    });
  }
  return out;
}

// The drawn piece of every node's line: its part inside the node's own region.
// [{ num (1, 2, ...), path, seg }]
export function nodeSegments(tree) {
  const out = [];
  listNodes(tree).forEach((e, i) => {
    if (!e.node.line) return;
    const seg = lineInPoly(e.node.line, e.poly);
    if (seg) out.push({ num: i + 1, path: e.path, seg });
  });
  return out;
}

// Majority class of the points on side b of a line (or of all points if line is null).
export function majority(pts, line, b, fallback = 0) {
  const n = {};
  for (const p of pts) if (!line || branchOf(line, p.x, p.y) === b) n[p.cls] = (n[p.cls] || 0) + 1;
  const best = Object.keys(n).sort((a, c) => n[c] - n[a] || a - c)[0];
  return best == null ? fallback : Number(best);
}

// A starting line for an empty node: horizontal through the middle of its region.
export function defaultLine(poly) {
  const m = polyCentroid(poly.length ? poly : UNIT_SQUARE);
  const y = Math.max(0.08, Math.min(0.92, m.y));
  return { x1: Math.max(0.04, m.x - 0.32), y1: y, x2: Math.min(0.96, m.x + 0.32), y2: y };
}

// Points of the node that end up right if every coloured side were a leaf ("+" sides don't count).
// choice[b] is a class number or '+'. { right, total }
export function sideCount(line, choice, pts) {
  let right = 0, total = 0;
  for (const p of pts) {
    const c = choice[branchOf(line, p.x, p.y)];
    if (c === '+') continue;
    total++;
    if (c === p.cls) right++;
  }
  return { right, total };
}

// How many nodes applying `choice` to the node would remove (sides that were nodes and become colours).
export const removedBy = (node, choice) => [0, 1].reduce((s, b) => s + (choice[b] !== '+' ? subtreeSize(node.kids[b]) : 0), 0);

// How many new nodes applying `choice` would add ("+" sides that were not nodes yet).
export const addedBy = (node, choice) => [0, 1].filter((b) => choice[b] === '+' && !isNode(node.kids[b])).length;

// Apply a line and the two side choices to the node at `path` (in place). A "+" side keeps its
// node or gets a new empty one; a colour side becomes a leaf (dropping any subtree there).
// The line is then turned so that side 0 is the one more to the left (then lower) in its region,
// so the tree reads left to right like the field.
export function applyNode(tree, path, line, choice) {
  const n = nodeAt(tree, path);
  const kids = [0, 1].map((b) => (choice[b] === '+' ? (isNode(n.kids[b]) ? n.kids[b] : emptyNode()) : choice[b]));
  n.line = { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 };
  n.kids = kids;
  const e = listNodes(tree).find((q) => samePath(q.path, path));
  const m = [0, 1].map((b) => polyCentroid(clipBranch(e.poly, n.line, b)));
  if (m[0] && m[1] && (m[0].x > m[1].x + 1e-6 || (Math.abs(m[0].x - m[1].x) <= 1e-6 && m[0].y > m[1].y))) {
    n.line = { x1: line.x2, y1: line.y2, x2: line.x1, y2: line.y1 };
    n.kids = [kids[1], kids[0]];
  }
  return tree;
}

// Delete the node at `path`: the root becomes empty again; any other node becomes a leaf of
// class `cls` (the majority of its points).
export function deleteNode(tree, path, cls) {
  if (!path.length) return emptyNode();
  const parent = nodeAt(tree, path.slice(0, -1));
  parent.kids[path[path.length - 1]] = cls;
  return tree;
}

// A cleaned copy of a saved tree for a level with K classes, or null if it is not valid.
export function cleanTree(raw, K, maxNodes = CONFIG.LAB.MAX_NODES) {
  let count = 0;
  const u = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
  const node = (n, depth) => {
    if (!n || typeof n !== 'object' || depth > maxNodes || ++count > maxNodes) return null;
    if (n.line == null) return emptyNode();
    const s = n.line;
    if (![s.x1, s.y1, s.x2, s.y2].every(u) || Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 0.01) return null;
    if (!Array.isArray(n.kids) || n.kids.length !== 2) return null;
    const kids = n.kids.map((k) => (Number.isInteger(k) && k >= 0 && k < K ? k : isNode(k) ? node(k, depth + 1) : null));
    if (kids.some((k) => k === null)) return null;
    return { line: { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }, kids };
  };
  return node(raw, 0);
}

export const copyTree = (t) => JSON.parse(JSON.stringify(t));

// ------------------------------------------------------------------ data
// Standard normal random number from a uniform generator.
export function gauss(random = Math.random) {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

// The true regions of a level with their sampling weights.
export function trueRegions(truth) {
  const rs = regions(truth).map((r) => ({ ...r, area: polyArea(r.poly) }));
  const pw = CONFIG.LAB.REGION_WEIGHT_POWER;
  const tot = rs.reduce((s, r) => s + r.area ** pw, 0);
  return rs.map((r) => ({ ...r, weight: (r.area ** pw) / tot }));
}

// n samples of a level: { x, y (measured, as drawn), tx, ty (noiseless), cls (the etichetta) }.
export function makeSamples(level, n, noise, random = Math.random) {
  const rs = trueRegions(level.tree);
  const gap = level.gap || 0;
  const pts = [];
  for (let i = 0; i < n; i++) {
    let u = random(), r = rs[rs.length - 1];
    for (const q of rs) { if ((u -= q.weight) <= 0) { r = q; break; } }
    const xs = r.poly.map((p) => p[0]), ys = r.poly.map((p) => p[1]);
    const bx0 = Math.max(0.02, Math.min(...xs)), bx1 = Math.min(0.98, Math.max(...xs));
    const by0 = Math.max(0.02, Math.min(...ys)), by1 = Math.min(0.98, Math.max(...ys));
    let tx = (bx0 + bx1) / 2, ty = (by0 + by1) / 2;
    for (let k = 0; k < 400; k++) {
      const x = bx0 + random() * (bx1 - bx0), y = by0 + random() * (by1 - by0);
      if (!inPoly(r.poly, x, y)) continue;
      if (gap > 0 && rs.some((o) => o.cls !== r.cls && polyDist(o.poly, x, y) < gap)) continue;
      tx = x; ty = y; break;
    }
    // measurement noise: resample instead of clamping, so no points pile up on the edges
    let x = tx, y = ty;
    for (let k = 0; k < 30; k++) {
      x = tx + noise * gauss(random); y = ty + noise * gauss(random);
      if (x > 0.012 && x < 0.988 && y > 0.012 && y < 0.988) break;
      x = Math.min(0.988, Math.max(0.012, x)); y = Math.min(0.988, Math.max(0.012, y));
    }
    pts.push({ x, y, tx, ty, cls: r.cls });
  }
  return pts;
}

// Measurement noise and training samples for a level at the upgrade levels (0..10).
export const labNoise = (level, precision) => level.noise * CONFIG.LAB.NOISE_FACTOR[precision];
export const labSamples = (level, samples) => Math.round(CONFIG.LAB.SAMPLES[samples] * (level.samplesFactor || 1));

// ------------------------------------------------------------------ scoring
// Coins (0..10) from ratio = player's test accuracy / true tree's accuracy on the same samples.
export function coinsForAccRatio(ratio) {
  for (const row of CONFIG.LAB.SCORE_THRESHOLDS) if (ratio >= row.minRatio) return row.coins;
  return 0;
}

// Scores a finished tree on a test batch. { player, best (the true tree), ratio, coins }
export function scoreTest(tree, truth, test) {
  const player = accuracy(tree, test);
  const best = accuracy(truth, test);
  const ratio = best.acc > 0 ? player.acc / best.acc : 1;
  return { player, best, ratio, coins: coinsForAccRatio(ratio) };
}

// Coins paid for a Prova: only the part above the record of this tree, times REPLAY_FACTOR if the
// tree was started on a level that was already passed.
export function payFor(coins, board) {
  const gain = Math.max(0, coins - (board.best || 0));
  return board.replay ? Math.round(gain * CONFIG.LAB.REPLAY_FACTOR) : gain;
}

// The tree learnt the training samples by heart: better than the true tree on training, worse
// on test (accuracy shares on the same samples).
export const looksOverfit = (trainAcc, trainBest, testAcc, testBest) =>
  trainAcc - trainBest >= CONFIG.LAB.OVERFIT_TRAIN_GAIN && testBest - testAcc >= CONFIG.LAB.OVERFIT_TEST_LOSS;

// ------------------------------------------------------------------ progress
export function labLevelStatus(lab, levels, i) {
  const passed = lab.passed.includes(levels[i].id);
  const open = i === 0 || passed || lab.passed.includes(levels[i - 1].id);
  return { passed, open };
}

export function labStartLevel(lab, levels) {
  const saved = levels.findIndex((lv) => lv.id === lab.current);
  if (saved >= 0 && labLevelStatus(lab, levels, saved).open) return saved;
  for (let i = 0; i < levels.length; i++) {
    const st = labLevelStatus(lab, levels, i);
    if (st.open && !st.passed) return i;
  }
  return 0;
}

// ------------------------------------------------------------------ layout
// Tree layout in a box `width` px wide. Every leaf and every empty node gets one slot, left to
// right; an applied node sits in the middle of its slots. Row r is at y = top + r * rowH.
// Returns { items: [{ kind: 'node' | 'empty' | 'leaf', x, y, path, num, cls, parent: item }],
// slot, depth, bottom }.
export function layoutLab(tree, width, { top = 0, rowH = 70, pad = 6 } = {}) {
  const items = [];
  let slots = 0;
  const count = (k) => (isApplied(k) ? count(k.kids[0]) + count(k.kids[1]) : 1);
  const total = count(tree);
  const slot = (width - 2 * pad) / total;
  let num = 0;
  const walk = (k, path, parent) => {
    const y = top + path.length * rowH;
    if (!isNode(k)) {
      const it = { kind: 'leaf', x: pad + (slots++ + 0.5) * slot, y, path, cls: k, parent };
      items.push(it);
      return it;
    }
    const it = { kind: k.line ? 'node' : 'empty', x: 0, y, path, num: ++num, node: k, parent };
    items.push(it);
    if (!k.line) { it.x = pad + (slots++ + 0.5) * slot; return it; }
    const a = walk(k.kids[0], [...path, 0], it), b = walk(k.kids[1], [...path, 1], it);
    it.lo = a.lo ?? a.x; it.hi = b.hi ?? b.x;
    it.x = (it.lo + it.hi) / 2;
    return it;
  };
  walk(tree, [], null);
  const depth = Math.max(...items.map((it) => it.path.length));
  return { items, slot, depth, bottom: top + depth * rowH };
}
