// Minigame 3 (Il laboratorio): the model. Pure functions, no DOM (tested in tests/run.mjs).
//
// A tree of boundary lines. Every node is a line at any angle through the field (the unit
// square); each side of it goes to a branch: another node, or a leaf that predicts one class.
// The player's tree has the level's shape; each node's state is a "spec":
//   { x1, y1, x2, y2, c: [colour of branch 0, colour of branch 1], flip }
// The line runs through (x1, y1) and (x2, y2). Walking from the first point to the second, the
// LEFT side goes to branch 0 (flip = false) or to branch 1 (flip = true). Branch 0 is drawn on
// the left of the tree, branch 1 on the right. A node that has no spec yet is null.
// The level's true tree uses the same specs (flip = false), built from levels.js.
import { CONFIG } from '../config.js';

// ------------------------------------------------------------------ geometry
export const UNIT_SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]];   // counter-clockwise

// > 0 on the left of the line (walking from point 1 to point 2), < 0 on the right.
export const sideValue = (s, x, y) => (s.x2 - s.x1) * (y - s.y1) - (s.y2 - s.y1) * (x - s.x1);
// Branch number of the left side.
const leftBranch = (s) => (s.flip ? 1 : 0);
export const branchOf = (s, x, y) => (sideValue(s, x, y) > 0 ? leftBranch(s) : 1 - leftBranch(s));

// Keeps the part of a convex polygon on one side of the line (Sutherland-Hodgman, one edge).
// keepLeft: true keeps the left side. Returns a (possibly empty) polygon.
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

// The part of polygon `poly` that goes to branch b of node spec s.
export const clipBranch = (poly, s, b) => clipPoly(poly, s, b === leftBranch(s));

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
export function inPoly(poly, x, y) {
  let pos = false, neg = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c > 1e-12) pos = true; else if (c < -1e-12) neg = true;
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

// ------------------------------------------------------------------ compile
// Returns { nodes, leaves, truth } for a level tree written with cut() in levels.js:
//   node: { idx, depth, parent (idx or -1), pbranch (branch of the parent), kids: [kid, kid] }
//         kid = { node: idx } or { leaf: leaf idx }
//   leaf: { idx, node, branch, cls (the true class), depth }   (numbered left to right)
//   truth: the true specs, one per node
// Nodes are numbered in pre-order (root = 0), shown to the player as 1, 2, 3, ...
export function compileLab(tree) {
  const nodes = [], leaves = [], truth = [];
  const walk = (n, depth, parent, pbranch) => {
    const idx = nodes.length;
    const node = { idx, depth, parent, pbranch, kids: [null, null] };
    nodes.push(node);
    truth.push({ ...n.line, flip: false, c: [null, null] });
    ['left', 'right'].forEach((side, b) => {
      const k = n[side];
      if (typeof k === 'number') {
        node.kids[b] = { leaf: -1, cls: k };
        truth[idx].c[b] = k;
      } else node.kids[b] = { node: walk(k, depth + 1, idx, b) };
    });
    return idx;
  };
  walk(tree, 0, -1, 0);
  // number the leaves left to right (branch 0 before branch 1)
  const inorder = (i) => {
    for (let b = 0; b < 2; b++) {
      const k = nodes[i].kids[b];
      if (k.node != null) inorder(k.node);
      else { k.leaf = leaves.length; leaves.push({ idx: leaves.length, node: i, branch: b, cls: k.cls, depth: nodes[i].depth + 1 }); }
    }
  };
  inorder(0);
  // A true branch that goes on to another node gets a colour too (only a label, as the player's:
  // the prediction always comes from the leaves): the most frequent class among its leaves that
  // differs from the other branch's colour.
  const leafClasses = (i) => nodes[i].kids.flatMap((k) => (k.node != null ? leafClasses(k.node) : [k.cls]));
  const K = Math.max(...leaves.map((l) => l.cls)) + 1;
  nodes.forEach((n, i) => n.kids.forEach((k, b) => {
    if (k.node == null) return;
    const other = truth[i].c[1 - b];
    const cl = leafClasses(k.node);
    const order = [...new Set(cl)].sort((p, q) => cl.filter((x) => x === q).length - cl.filter((x) => x === p).length);
    truth[i].c[b] = order.find((c) => c !== other) ?? [...Array(K).keys()].find((c) => c !== other);
  }));
  return { nodes, leaves, truth };
}

export const isSet = (s) => !!(s && s.c && s.c[0] != null && s.c[1] != null);

// ------------------------------------------------------------------ running a tree
// Where a point ends up: { cls (predicted class or null), node (last node), branch, done }.
// done = false if the path stops at a node without a spec; cls is then the colour of the branch
// that led there (a provisional prediction), or null at the root.
export function route(comp, specs, x, y) {
  let i = 0, cls = null, branch = -1;
  for (;;) {
    const s = specs[i];
    if (!isSet(s)) return { cls, node: i, branch: -1, done: false };
    branch = branchOf(s, x, y);
    cls = s.c[branch];
    const k = comp.nodes[i].kids[branch];
    if (k.node == null) return { cls, node: i, branch, done: true };
    i = k.node;
  }
}

export const predict = (comp, specs, x, y) => route(comp, specs, x, y).cls;

// Does the point reach node idx (every node above it has a spec)?
export function reaches(comp, specs, idx, x, y) {
  let i = 0;
  while (i !== idx) {
    const s = specs[i];
    if (!isSet(s)) return false;
    const k = comp.nodes[i].kids[branchOf(s, x, y)];
    if (k.node == null) return false;
    i = k.node;
  }
  return true;
}

// Share of points predicted as their own class. { right, total, acc, ok: [bool per point] }
export function accuracy(comp, specs, pts) {
  const ok = pts.map((p) => predict(comp, specs, p.x, p.y) === p.cls);
  const right = ok.filter(Boolean).length;
  return { right, total: pts.length, acc: pts.length ? right / pts.length : 0, ok };
}

// The field cut into regions: [{ poly, cls, node, branch, done }], one per leaf that is reached
// (an unfinished node gives one region, with the provisional colour of its branch).
export function regions(comp, specs) {
  const out = [];
  const walk = (i, poly, cls) => {
    if (!poly.length) return;
    const s = specs[i];
    if (!isSet(s)) { out.push({ poly, cls, node: i, branch: -1, done: false }); return; }
    for (let b = 0; b < 2; b++) {
      const p = clipBranch(poly, s, b);
      const k = comp.nodes[i].kids[b];
      if (k.node == null) { if (p.length) out.push({ poly: p, cls: s.c[b], node: i, branch: b, done: true }); }
      else walk(k.node, p, s.c[b]);
    }
  };
  walk(0, UNIT_SQUARE, null);
  return out;
}

// The region that reaches node idx (clipped by all its ancestors), or null if an ancestor has
// no spec yet. Also returns the ancestors, root first: [{ idx, branch }].
export function nodeRegion(comp, specs, idx) {
  const chain = [];
  for (let i = idx; comp.nodes[i].parent >= 0; i = comp.nodes[i].parent) chain.unshift({ idx: comp.nodes[i].parent, branch: comp.nodes[i].pbranch });
  let poly = UNIT_SQUARE;
  for (const a of chain) {
    if (!isSet(specs[a.idx])) return null;
    poly = clipBranch(poly, specs[a.idx], a.branch);
  }
  return { poly, ancestors: chain };
}

// The drawn piece of every node's line: its part inside the node's own region.
// [{ idx, seg: [[x, y], [x, y]] }] for the nodes that have a spec.
export function nodeSegments(comp, specs) {
  const out = [];
  for (const n of comp.nodes) {
    if (!isSet(specs[n.idx])) continue;
    const r = nodeRegion(comp, specs, n.idx);
    const seg = r && lineInPoly(specs[n.idx], r.poly);
    if (seg) out.push({ idx: n.idx, seg });
  }
  return out;
}

// For one node: how many points of the two picked colours are on their own side.
// pts: the points that reach the node. { right, total, per: { cls: [right, total] } }
export function nodeCount(s, pts) {
  const per = {};
  let right = 0, total = 0;
  if (!isSet(s)) return { right, total, per };
  for (const c of s.c) per[c] = [0, 0];
  for (const p of pts) {
    if (!(p.cls in per)) continue;
    total++; per[p.cls][1]++;
    if (s.c[branchOf(s, p.x, p.y)] === p.cls) { right++; per[p.cls][0]++; }
  }
  return { right, total, per };
}

// A starting line for a node: horizontal through the middle of its region, with the two colours
// put on the sides where more of their points are (only the orientation is chosen; the line is
// not fitted, that is the player's job).
export function defaultSpec(poly, colours, pts) {
  const m = polyCentroid(poly.length ? poly : UNIT_SQUARE);
  const y = Math.max(0.08, Math.min(0.92, m.y));
  const x1 = Math.max(0.04, m.x - 0.32), x2 = Math.min(0.96, m.x + 0.32);
  const a = { x1, y1: y, x2, y2: y, flip: false, c: [colours[0], colours[1]] };
  const b = { ...a, c: [colours[1], colours[0]] };
  return nodeCount(b, pts).right > nodeCount(a, pts).right ? b : a;
}

// ------------------------------------------------------------------ data
// Standard normal random number from a uniform generator.
export function gauss(random = Math.random) {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

// The true regions of a level with their sampling weights.
export function trueRegions(comp) {
  const rs = regions(comp, comp.truth).map((r) => ({ ...r, area: polyArea(r.poly) }));
  const pw = CONFIG.LAB.REGION_WEIGHT_POWER;
  const tot = rs.reduce((s, r) => s + r.area ** pw, 0);
  return rs.map((r) => ({ ...r, weight: (r.area ** pw) / tot }));
}

// n samples of a level: { x, y (measured, as drawn), tx, ty (noiseless), cls (the etichetta) }.
// noise: standard deviation of the measurement noise (field units).
export function makeSamples(level, comp, n, noise, random = Math.random) {
  const rs = trueRegions(comp);
  const gap = level.gap || 0;
  const pts = [];
  for (let i = 0; i < n; i++) {
    // pick a region by weight
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

// Measurement noise for a level at an instrument level (0..10).
export const labNoise = (level, precision) => level.noise * CONFIG.LAB.NOISE_FACTOR[precision];
// Training samples for a level at a "Più campioni" level (0..10).
export const labSamples = (level, samples) => Math.round(CONFIG.LAB.SAMPLES[samples] * (level.samplesFactor || 1));

// ------------------------------------------------------------------ scoring
// Coins (0..10) from ratio = player's test accuracy / true tree's accuracy on the same samples.
export function coinsForAccRatio(ratio) {
  for (const row of CONFIG.LAB.SCORE_THRESHOLDS) if (ratio >= row.minRatio) return row.coins;
  return 0;
}

// Scores a finished tree on a test batch. { player, best (the true tree), ratio, coins }
export function scoreTest(comp, specs, test) {
  const player = accuracy(comp, specs, test);
  const best = accuracy(comp, comp.truth, test);
  const ratio = best.acc > 0 ? player.acc / best.acc : 1;
  return { player, best, ratio, coins: coinsForAccRatio(ratio) };
}

// Coins paid for a Prova: only the part above the record of this tree (see CONFIG.LAB), halved
// (REPLAY_FACTOR) if the tree was started on a level that was already passed.
export function payFor(coins, board) {
  const gain = Math.max(0, coins - (board.best || 0));
  return board.replay ? Math.round(gain * CONFIG.LAB.REPLAY_FACTOR) : gain;
}

// The tree learnt the training samples by heart: better than the true tree on training, worse
// on test (accuracy shares on the same samples).
export const looksOverfit = (trainAcc, trainBest, testAcc, testBest) =>
  trainAcc - trainBest >= CONFIG.LAB.OVERFIT_TRAIN_GAIN && testBest - testAcc >= CONFIG.LAB.OVERFIT_TEST_LOSS;

// A spare node of the true tree: its line does not cross its region.
export function isSpare(comp, idx) {
  const r = nodeRegion(comp, comp.truth, idx);
  return !r || !lineInPoly(comp.truth[idx], r.poly);
}

// ------------------------------------------------------------------ progress
// { passed, open (first level, or the previous one passed) }
export function labLevelStatus(lab, levels, i) {
  const passed = lab.passed.includes(levels[i].id);
  const open = i === 0 || passed || lab.passed.includes(levels[i - 1].id);
  return { passed, open };
}

// The level to show when entering: the saved one if open, else the first open one not passed.
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
// Tree positions in a box `width` px wide: leaves get equal slots left to right, a node sits in
// the middle of its leaves. Row r is at y = top + r * rowH. Sets x, y on nodes and leaves.
export function layoutLab(comp, width, { top = 0, rowH = 64, pad = 8 } = {}) {
  const slot = (width - 2 * pad) / comp.leaves.length;
  const span = (i) => {
    const n = comp.nodes[i];
    const xs = n.kids.map((k, b) => {
      if (k.node != null) { const s = span(k.node); return s; }
      const leaf = comp.leaves[k.leaf];
      leaf.x = pad + (leaf.idx + 0.5) * slot; leaf.y = top + leaf.depth * rowH;
      return { lo: leaf.x, hi: leaf.x };
    });
    n.lo = xs[0].lo; n.hi = xs[1].hi; n.x = (n.lo + n.hi) / 2; n.y = top + n.depth * rowH;
    return { lo: n.lo, hi: n.hi };
  };
  span(0);
  const depth = Math.max(...comp.leaves.map((l) => l.depth));
  return { slot, depth, bottom: top + depth * rowH };
}
