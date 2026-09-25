// Minigame 2: the decision-tree model. Pure functions, no DOM (tested in tests/run.mjs).
//
// A tree in levels.js is written as ask(question, { no, yes }) for a gate, and a truck id
// (a string) for a leaf. The question in ask() is the level's solution; the game hides it.
// Gates are numbered in pre-order (root = 0); the player's assignment is an array of
// question ids (or null), one per gate.
import { Q, QUESTION_IDS, parseItem } from './questions.js';

export const ask = (q, { no, yes }) => ({ q, no, yes });

// Small seeded random generator (mulberry32), so each level's batch looks the same every time.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ compile
// Returns { root, gates: [gate], leaves: [leaf] } with nodes:
//   gate: { kind: 'gate', idx, q, no, yes, depth, parent }
//   leaf: { kind: 'leaf', idx, truck, depth, parent }   (leaves numbered left to right)
export function compile(tree) {
  const gates = [], leaves = [];
  const walk = (n, depth, parent) => {
    if (typeof n === 'string') {
      const leaf = { kind: 'leaf', idx: -1, truck: n, depth, parent };
      return leaf;
    }
    const g = { kind: 'gate', idx: gates.length, q: n.q, depth, parent, no: null, yes: null };
    gates.push(g);
    g.no = walk(n.no, depth + 1, g);
    g.yes = walk(n.yes, depth + 1, g);
    return g;
  };
  const root = walk(tree, 0, null);
  // number the leaves in left-to-right order (no before yes)
  const inorder = (n) => { if (n.kind === 'leaf') { n.idx = leaves.length; leaves.push(n); } else { inorder(n.no); inorder(n.yes); } };
  inorder(root);
  return { root, gates, leaves };
}

export const solutionOf = (compiled) => compiled.gates.map((g) => g.q);
export const treeDepth = (n) => (n.kind === 'leaf' ? 0 : 1 + Math.max(treeDepth(n.no), treeDepth(n.yes)));

// ------------------------------------------------------------------ items
// Training batch: the level's items, expanded by count and mixed up (seeded by the level number).
// Each item: { ...features, label (truck id), key, spin (visual only) }
export function trainingBatch(level, seed = 1) {
  const r = rng(seed * 7919 + 17);
  const out = [];
  for (const [str, label, count = 1] of level.items) {
    for (let i = 0; i < count; i++) out.push({ ...parseItem(str), label, src: str });
  }
  return shuffleWith(out, r).map((it) => ({ ...it, spin: Math.round((r() - 0.5) * 36) }));
}

// Test batch: new items of the same kinds as the training batch (never seen before by the
// player: a new random mix). Default size: the training size.
export function testBatch(level, random = Math.random) {
  const kinds = [];
  for (const [str, label] of level.items) kinds.push({ ...parseItem(str), label, src: str });
  const n = level.testSize || level.items.reduce((s, x) => s + (x[2] || 1), 0);
  const out = [];
  // every kind at least once (while there is room), the rest at random
  const order = shuffleWith(kinds, random);
  for (let i = 0; i < n; i++) {
    const k = i < order.length ? order[i] : kinds[Math.floor(random() * kinds.length)];
    out.push({ ...k, spin: Math.round((random() - 0.5) * 36) });
  }
  return shuffleWith(out, random);
}

// ------------------------------------------------------------------ running the tree
export function route(compiled, assign, item) {
  let n = compiled.root;
  const path = [];
  while (n.kind === 'gate') {
    const qid = assign[n.idx];
    const ans = qid ? Q[qid].f(item) : false;
    path.push({ gate: n, ans });
    n = ans ? n.yes : n.no;
  }
  return { path, leaf: n };
}

const reachable = (n, truck) => (n.kind === 'leaf' ? n.truck === truck : reachable(n.no, truck) || reachable(n.yes, truck));

// The gate to blame for a wrongly sorted item: the first gate after which the item's right
// truck can no longer be reached.
export function blameGate(pathInfo, label) {
  for (const step of pathInfo.path) {
    const next = step.ans ? step.gate.yes : step.gate.no;
    if (!reachable(next, label)) return step.gate;
  }
  return null;
}

// Sorts a batch. Returns { results: [{ item, path, leaf, truck, ok, blame }], right, total, accuracy, blamed: Set(gate idx) }
export function runBatch(compiled, assign, items) {
  const results = items.map((item) => {
    const p = route(compiled, assign, item);
    const ok = p.leaf.truck === item.label;
    const b = ok ? null : blameGate(p, item.label);
    return { item, path: p.path, leaf: p.leaf, truck: p.leaf.truck, ok, blame: b ? b.idx : -1 };
  });
  const right = results.filter((r) => r.ok).length;
  const blamed = new Set(results.filter((r) => !r.ok && r.blame >= 0).map((r) => r.blame));
  return { results, right, total: items.length, accuracy: items.length ? right / items.length : 0, blamed };
}

// ------------------------------------------------------------------ uniqueness checks
// Number of question assignments (over `qids`) that sort `items` 100% correctly.
// Exhaustive, but factorised: the two subtrees of a gate are independent, so the count for a gate
// is the sum over its questions of (count for the yes side) x (count for the no side).
export function countSolutions(compiled, items, qids = QUESTION_IDS) {
  const count = (n, its) => {
    if (n.kind === 'leaf') return its.every((it) => it.label === n.truck) ? 1 : 0;
    let s = 0;
    for (const q of qids) {
      const f = Q[q].f;
      const yes = [], no = [];
      for (const it of its) (f(it) ? yes : no).push(it);
      const cy = count(n.yes, yes);
      if (cy) s += cy * count(n.no, no);
    }
    return s;
  };
  return count(compiled.root, items);
}

// Literal brute force: tries every assignment of `qids` to the gates, one by one.
// Returns the list of perfect assignments (stops collecting after `limit`).
export function bruteForce(compiled, items, qids = QUESTION_IDS, limit = 50) {
  const G = compiled.gates.length;
  const idx = new Array(G).fill(0);
  const found = [];
  let tried = 0;
  for (;;) {
    const assign = idx.map((i) => qids[i]);
    tried++;
    let ok = true;
    for (const it of items) { if (route(compiled, assign, it).leaf.truck !== it.label) { ok = false; break; } }
    if (ok && found.length < limit) found.push(assign);
    else if (ok) found.length++;
    let k = G - 1;
    while (k >= 0 && ++idx[k] === qids.length) { idx[k] = 0; k--; }
    if (k < 0) break;
  }
  return { found, tried };
}

// ------------------------------------------------------------------ layout
// Positions for a tree drawn in a box `width` px wide. Leaves get equal slots left to right; a
// gate sits in the middle of the span of its leaves. Row r is at y = top + r * rowH.
export function layoutTree(compiled, width, { top = 0, rowH = 76, pad = 10 } = {}) {
  const L = compiled.leaves.length;
  const slot = (width - 2 * pad) / L;
  const span = (n) => {
    if (n.kind === 'leaf') { n.x = pad + (n.idx + 0.5) * slot; n.lo = n.hi = n.x; }
    else { span(n.no); span(n.yes); n.lo = n.no.lo; n.hi = n.yes.hi; n.x = (n.lo + n.hi) / 2; }
    n.y = top + n.depth * rowH;
  };
  span(compiled.root);
  const depth = treeDepth(compiled.root);
  return { slot, rows: depth + 1, bottom: top + depth * rowH };
}

// Gates whose question differs from the level's one correct tree, or that are empty.
// Shown in red after a few failed Provas (see game.js).
export const wrongGates = (compiled, board) => compiled.gates.filter((g) => board[g.idx] !== g.q).map((g) => g.idx);
