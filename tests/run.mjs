// Model checks, no browser needed:  node tests/run.mjs   (from Game/)
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { EMOJIS, NOUNS, ADJECTIVES, formatName, nameChoices, isValidName } from '../js/names.js';
import { FARMERS } from '../js/weighing/farmers.js';
import { makeRound, takeUnit, measure, scoreLine, coinsForRatio, sliderToLine, startSliders, dataSlope, autoFit, lineToSliders, scannerOffer, isSmartScanner, scannerIndex, lineToEnds, endsToLine, clampEnds } from '../js/weighing/round.js';
import { sanitize } from '../js/storage.js';
import { leastSquares } from '../js/stats.js';
import { readFileSync, readdirSync } from 'node:fs';
import { LEVELS, TRUCKS } from '../js/sorting/levels.js';
import { QUESTIONS, QUESTION_IDS, SENSORS, parseItem, itemKey, questionUnlocked } from '../js/sorting/questions.js';
import { compile, solutionOf, trainingBatch, testBatch, runBatch, countSolutions, bruteForce, layoutTree, treeDepth, rng, route, wrongGates } from '../js/sorting/tree.js';
import { levelStatus, requiredSensors, startLevel } from '../js/sorting/progress.js';
import { truckSpec, PIPE_COLOUR } from '../js/sorting/trucks.js';
import { defaultSort, sanitizeSort, defaultLab, sanitizeLab } from '../js/storage.js';
import { LAB_LEVELS, CLASS_COLOURS, cut } from '../js/lab/levels.js';
import {
  emptyNode, listNodes, countNodes, isComplete, nodeAt, route as labRoute, reaches, regions, trueRegions, makeSamples,
  accuracy, scoreTest, coinsForAccRatio, payFor, looksOverfit, polyArea, clipPoly, lineInPoly, UNIT_SQUARE, labNoise,
  labSamples, labLevelStatus, labStartLevel, layoutLab, applyNode, deleteNode, removedBy, addedBy, subtreeSize,
  majority, cleanTree, copyTree, inPoly, sideCount, defaultLine,
} from '../js/lab/model.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ', name); };

test('per-level arrays have 11 entries', () => {
  for (const k of ['BELT_BOXES', 'TRUCK_CRATES', 'SCANNER_NOISE', 'SCANNER_GLITCH']) assert.equal(CONFIG[k].length, CONFIG.MAX_LEVEL + 1, k);
  assert.ok(CONFIG.SCANNER_NOISE.every((v) => v > 0), 'scanner noise never zero');
  for (let i = 1; i < CONFIG.SCANNER_NOISE.length; i++) assert.ok(CONFIG.SCANNER_NOISE[i] < CONFIG.SCANNER_NOISE[i - 1], 'noise falls with every level');
  assert.ok(CONFIG.SCANNER_NOISE[10] <= 0.002, 'practically no noise at level 10');
  assert.equal(CONFIG.SCANNER_GLITCH[10], 0);
  assert.ok(CONFIG.HARVEST_SIZE > CONFIG.UNITS_PER_BOX * CONFIG.TRUCK_CRATES[10], 'harvest bigger than max sample');
  assert.deepEqual(CONFIG.TRUCK_CRATES, [3, 5, 7, 10, 15, 23, 34, 51, 77, 115, 173]);
  assert.deepEqual(CONFIG.BELT_BOXES, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('shop costs: each track 55, total 165', () => {
  let s = 0; for (let n = 1; n <= CONFIG.MAX_LEVEL; n++) s += CONFIG.levelCost(n);
  assert.equal(s, 55);
});

test('every name combination formats, with gender agreement', () => {
  for (const a of ADJECTIVES) assert.equal(a.length, 2);
  for (const n of NOUNS) assert.ok(n.g === 'm' || n.g === 'f');
  const nouns = new Set(NOUNS.map((n) => n.w));
  assert.equal(nouns.size, NOUNS.length, 'no duplicate nouns');
  for (let e = 0; e < EMOJIS.length; e++) for (let n = 0; n < NOUNS.length; n++) for (let a = 0; a < ADJECTIVES.length; a++) {
    const s = formatName({ e, n, a, num: 42 });
    assert.ok(s.length > 5);
  }
  assert.equal(formatName({ e: 0, n: NOUNS.findIndex((x) => x.w === 'Mucca'), a: 0, num: 27 }), '🐄 Mucca Coraggiosa 27');
  assert.equal(formatName({ e: 16, n: NOUNS.findIndex((x) => x.w === 'Trattore'), a: 0, num: 27 }), '🚜 Trattore Coraggioso 27');
  for (let i = 0; i < 200; i++) { const c = nameChoices(3); assert.equal(c.length, 3); c.forEach((x) => assert.ok(isValidName(x))); }
  assert.ok(!isValidName({ e: 0, n: 0, a: 0, num: 9 }));
  assert.ok(!isValidName({ e: EMOJIS.length, n: 0, a: 0, num: 10 }));
});

test('coins thresholds', () => {
  assert.equal(coinsForRatio(0.9), 10);
  assert.equal(coinsForRatio(1.0), 10);
  assert.equal(coinsForRatio(1.002), 10);
  assert.equal(coinsForRatio(1.005), 9);
  assert.equal(coinsForRatio(1.02), 8);
  assert.equal(coinsForRatio(1.05), 7);
  assert.equal(coinsForRatio(1.08), 6);
  assert.equal(coinsForRatio(1.15), 5);
  assert.equal(coinsForRatio(1.3), 4);
  assert.equal(coinsForRatio(1.4), 3);
  assert.equal(coinsForRatio(1.9), 2);
  assert.equal(coinsForRatio(2.9), 1);
  assert.equal(coinsForRatio(3.1), 0);
  assert.equal(CONFIG.REACTIONS.length, CONFIG.MAX_PAY + 1);
  // thresholds strictly increasing, coins strictly decreasing
  const t = CONFIG.SCORE_THRESHOLDS;
  for (let i = 1; i < t.length; i++) assert.ok(t[i].maxRatio > t[i - 1].maxRatio && t[i].coins < t[i - 1].coins);
});

test('true lines: positive in reality, axis flips give the visible sign, inside the plot, all farmers', () => {
  const seen = new Set();
  const combos = new Map();
  const lv = { scanner: 0, belt: 0, truck: 0 };
  let last = null, neg = 0, flat = 0, steep = 0, n = 0;
  for (let v = 0; v < 4000; v++) {
    const visit = v % 40;
    const r = makeRound({ visitNo: visit, lastFarmerId: last, levels: lv });
    if (visit !== 0) assert.notEqual(r.farmer.id, last, 'no farmer twice in a row');
    last = r.farmer.id;
    seen.add(r.farmer.id);
    const { a, b } = r.trueLine;
    const m = CONFIG.LINE_MARGIN - 1e-9;
    assert.ok(a >= m && a <= 1 - m && a + b >= m && a + b <= 1 - m, `line ends in plot: a=${a} b=${b}`);
    for (const p of r.harvest) assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1, 'harvest dot in plot');
    assert.equal(r.harvest.length, CONFIG.HARVEST_SIZE);
    // The real relation is always "more x -> more y", for every farmer.
    assert.ok(dataSlope(r.trueLine, r.axes) > 0, `${r.farmer.id}: real relation positive`);
    // The harvest's best line agrees too, except when the true line is almost flat: then a noisy
    // 240-unit harvest can, rarely, tilt the other way.
    if (Math.abs(r.trueLine.b) > 0.15) assert.ok(dataSlope(r.best, r.axes) > 0, `${r.farmer.id}: best line positive in data space`);
    // Visible sign = flipX xor flipY.
    assert.equal(b < 0, r.axes.flipX !== r.axes.flipY, 'visible slope sign matches the axis flips');
    if (visit === 0) { assert.ok(!r.axes.flipX && !r.axes.flipY, 'first farmer: normal axes'); continue; }
    const key = `${r.axes.flipX ? 'X-' : 'X+'} ${r.axes.flipY ? 'Y-' : 'Y+'}`;
    combos.set(key, (combos.get(key) || 0) + 1);
    n++;
    if (b < 0) neg++;
    if (Math.abs(b) < 0.1) flat++;
    if (Math.abs(b) > 0.7) steep++;
  }
  assert.equal(seen.size, FARMERS.length);
  assert.equal(combos.size, 4, 'all 4 axis-direction combinations appear');
  for (const [k, c] of combos) assert.ok(c / n > 0.2, `combo ${k} share ${c / n}`);
  assert.ok(Math.abs(neg / n - 0.5) < 0.05, `falling-line share ${neg / n}`);
  assert.ok(flat / n > 0.03, `almost-flat share ${flat / n}`);
  assert.ok(steep / n > 0.1, `steep share ${steep / n}`);
  const r0 = makeRound({ visitNo: 0, lastFarmerId: null, levels: lv });
  assert.equal(r0.farmer.id, 'mele');
  assert.equal(r0.glitchProb, 0);
  assert.ok(r0.trueLine.b > 0, 'first farmer: fixed easy positive line');
});

test('sliders reach every true line; start is flat, in the middle', () => {
  const s0 = startSliders();
  assert.ok(Math.abs(s0.slope - 0.5) < 1e-9);
  const flat = sliderToLine(s0.slope, s0.intercept);
  assert.ok(Math.abs(flat.b) < 1e-9 && Math.abs(flat.a - CONFIG.START_INTERCEPT) < 1e-9);
  const lo = sliderToLine(0, 0), hi = sliderToLine(1, 1);
  const maxB = CONFIG.SLOPE_ABS_RANGE[1];
  assert.ok(lo.b < -maxB - 0.1 && hi.b > maxB + 0.1, 'slope range covers both signs with slack');
  assert.ok(lo.a < CONFIG.LINE_MARGIN - 0.1 && hi.a > 1 - CONFIG.LINE_MARGIN + 0.1, 'intercept range with slack');
});

test('scoring: best line pays 10 for any slope; ratios sane for flat and negative lines', () => {
  const lv = { scanner: 0, belt: 0, truck: 0 };
  let flatSeen = 0, negSeen = 0;
  for (let i = 0; i < 600; i++) {
    const r = makeRound({ visitNo: 7, lastFarmerId: null, levels: lv });
    assert.equal(scoreLine(r, r.best).coins, CONFIG.MAX_PAY);
    assert.ok(r.bestError > 0.01, `best error not tiny: ${r.bestError}`);
    // Shifting the line up makes it worse, monotonically, whatever the slope.
    const s1 = scoreLine(r, { a: r.best.a + 0.05, b: r.best.b }).ratio;
    const s2 = scoreLine(r, { a: r.best.a + 0.15, b: r.best.b }).ratio;
    assert.ok(s1 > 1 && s2 > s1 && Number.isFinite(s2));
    // The mirrored line (same middle, opposite slope) is clearly bad unless the line is nearly flat.
    if (Math.abs(r.trueLine.b) > 0.4) assert.ok(scoreLine(r, { a: r.best.a + r.best.b, b: -r.best.b }).coins <= 1);
    if (Math.abs(r.trueLine.b) < 0.1) flatSeen++;
    if (r.trueLine.b < 0) negSeen++;
  }
  assert.ok(flatSeen > 0 && negSeen > 0);
});

test('belt changes boxes per trip, not the amount of data', () => {
  for (const belt of [0, 5, 9, 10]) {
    const r = makeRound({ visitNo: 3, lastFarmerId: null, levels: { scanner: 0, belt, truck: 0 } });
    if (belt >= CONFIG.UNLOAD_ALL_LEVEL) assert.ok(r.unloadAll && r.perTrip >= CONFIG.TRUCK_CRATES[10], 'top level empties the truck in one tap');
    else assert.equal(r.perTrip, CONFIG.BELT_BOXES[belt]);
    assert.equal(r.unitsPerBox, CONFIG.UNITS_PER_BOX);
    assert.equal(r.cratesTotal * r.unitsPerBox, 3, 'level-0 truck gives 3 data points');
  }
});

// Collect the whole truck into round.sample, like the game does.
function collectAll(r) {
  for (let c = 0; c < r.cratesTotal * r.unitsPerBox; c++) {
    const idx = takeUnit(r);
    if (idx < 0) break;
    r.sample.push(measure(r, idx));
  }
}
// What the level-100 scanner does at the end: its fit, through the sliders (clamped), then score.
function fitterCoins(r) {
  const s = lineToSliders(autoFit(r));
  return scoreLine(r, sliderToLine(s.slope, s.intercept));
}

test('scanner 100 fit: least squares on the measured points only, never the harvest', () => {
  const lv = { scanner: 100, belt: 0, truck: 3 };
  for (let i = 0; i < 300; i++) {
    const r = makeRound({ visitNo: 8, lastFarmerId: null, levels: lv });
    assert.ok(r.smart, 'level 100 is the smart scanner');
    assert.equal(r.scannerNoise, CONFIG.SCANNER_NOISE[10], 'noise as at level 10');
    assert.equal(r.glitchProb, CONFIG.SCANNER_GLITCH[10]);
    assert.equal(autoFit(r), null, 'no fit without points');
    r.sample.push(measure(r, takeUnit(r)));
    assert.equal(autoFit(r), null, 'no fit with one point');
    collectAll(r);
    const fit = autoFit(r), ls = leastSquares(r.sample);
    assert.ok(Math.abs(fit.a - ls.a) < 1e-12 && Math.abs(fit.b - ls.b) < 1e-12, 'equals least squares on the sample');
    // Replacing the whole harvest must not change the fit.
    const saved = r.harvest;
    r.harvest = saved.map((p) => ({ x: p.x, y: 1 - p.y }));
    const fit2 = autoFit(r);
    assert.ok(fit2.a === fit.a && fit2.b === fit.b, 'the harvest is never used');
    r.harvest = saved;
    // The slider round trip keeps the line (when it is inside the slider ranges).
    const s = lineToSliders(fit), back = sliderToLine(s.slope, s.intercept);
    if (s.slope > 0 && s.slope < 1 && s.intercept > 0 && s.intercept < 1) assert.ok(Math.abs(back.a - fit.a) < 1e-9 && Math.abs(back.b - fit.b) < 1e-9);
  }
});

test('scanner 100 with everything else maxed scores 10 most of the time', () => {
  const lv = { scanner: 100, belt: 10, truck: 10 };
  let tens = 0; const N = 400;
  for (let i = 0; i < N; i++) {
    const r = makeRound({ visitNo: 20, lastFarmerId: null, levels: lv });
    collectAll(r);
    if (fitterCoins(r).coins === 10) tens++;
  }
  console.log(`      scanner 100 + all 10: ${((100 * tens) / N).toFixed(0)}% of farmers pay 10`);
  assert.ok(tens / N > 0.5, `share of 10s: ${tens / N}`);
});

test('secret scanner level 100: offered only after level 10; old saves migrate', () => {
  for (let lv = 0; lv < 10; lv++) {
    const o = scannerOffer(lv);
    assert.equal(o.kind, 'level'); assert.equal(o.level, lv + 1); assert.equal(o.cost, lv + 1);
  }
  const o10 = scannerOffer(10);
  assert.deepEqual(o10, { kind: 'secret', level: 100, cost: CONFIG.SECRET_SCANNER_COST });
  assert.equal(CONFIG.SECRET_SCANNER_COST, 100);
  assert.equal(scannerOffer(100), null, 'nothing after 100');
  assert.ok(!isSmartScanner(10) && isSmartScanner(100));
  assert.equal(scannerIndex(100), 10);
  // saves
  const base = { playerId: '11111111-2222-4333-8444-555555555555', coins: 3, levels: { scanner: 10, belt: 2, truck: 4 } };
  assert.equal(sanitize({ ...base, levels: { ...base.levels, fitter: 1 } }).levels.scanner, 100, 'fitter -> scanner 100');
  assert.equal(sanitize({ ...base, levels: { ...base.levels, scanner: 4, fitter: 1 } }).levels.scanner, 100, 'fitter at any scanner level -> 100');
  assert.equal(sanitize({ ...base, levels: { ...base.levels, fitter: 0 } }).levels.scanner, 10);
  assert.equal(sanitize({ ...base, levels: { ...base.levels, scanner: 100 } }).levels.scanner, 100);
  assert.equal(sanitize({ ...base, levels: { ...base.levels, scanner: 55 } }).levels.scanner, 10, 'other values clamp to 0..10');
  assert.ok(!('fitter' in sanitize(base).levels), 'no fitter key any more');
});

test('drag mode: end points <-> slope/intercept round-trip; every true line reachable', () => {
  const close = (u, v) => Math.abs(u - v) < 1e-9;
  for (let i = 0; i < 2000; i++) {
    const ends = { left: Math.random(), right: Math.random() };
    const line = endsToLine(ends);
    const back = lineToEnds(line);
    assert.ok(close(back.left, ends.left) && close(back.right, ends.right), 'ends -> line -> ends');
    // ...and through the sliders (the game keeps the sliders as the source of truth)
    const s = lineToSliders(line);
    assert.ok(s.slope > 0 && s.slope < 1 && s.intercept > 0 && s.intercept < 1, 'every drag line is inside the slider ranges');
    const viaSliders = lineToEnds(sliderToLine(s.slope, s.intercept));
    assert.ok(close(viaSliders.left, ends.left) && close(viaSliders.right, ends.right), 'ends -> sliders -> ends');
    const l2 = { a: Math.random() * 1.2 - 0.1, b: Math.random() * 2 - 1 };
    const l3 = endsToLine(lineToEnds(l2));
    assert.ok(close(l3.a, l2.a) && close(l3.b, l2.b), 'line -> ends -> line');
  }
  const c = clampEnds({ left: -0.3, right: 1.7 });
  assert.ok(c.left === 0 && c.right === 1);
  // every hidden true line has both ends inside the plot, so clamping never changes it
  const lv = { scanner: 0, belt: 0, truck: 0 };
  for (let v = 0; v < 2000; v++) {
    const r = makeRound({ visitNo: v % 30, lastFarmerId: null, levels: lv });
    for (const line of [r.trueLine, r.best]) {
      const e = lineToEnds(line), ce = clampEnds(e);
      if (line === r.trueLine) assert.ok(ce.left === e.left && ce.right === e.right, 'true line reachable by dragging');
      else assert.ok(Math.abs(ce.left - e.left) < 0.05 && Math.abs(ce.right - e.right) < 0.05, 'best line (almost) reachable');
    }
  }
});

test('glitch rate at scanner level 0 is about 1/8', () => {
  const r = makeRound({ visitNo: 5, lastFarmerId: null, levels: { scanner: 0, belt: 0, truck: 0 } });
  let g = 0; const N = 40000;
  for (let i = 0; i < N; i++) if (measure(r, i % r.harvest.length).glitch) g++;
  assert.ok(Math.abs(g / N - 0.125) < 0.01, `rate ${g / N}`);
});

// Tuning report: a player who fits the sample perfectly (least squares on the measured dots).
function simulate(levels, visitNo, n = 800) {
  let coins = 0;
  for (let i = 0; i < n; i++) {
    const r = makeRound({ visitNo, lastFarmerId: null, levels });
    const pts = [];
    // The belt only changes how many taps this takes, not how many dots there are.
    for (let c = 0; c < r.cratesTotal * r.unitsPerBox; c++) pts.push(measure(r, takeUnit(r)));
    coins += scoreLine(r, leastSquares(pts)).coins;
  }
  return coins / n;
}
test('tuning report (sample-perfect player)', () => {
  const rows = [
    ['level 0 all, first farmer', { scanner: 0, belt: 0, truck: 0 }, 0],
    ['level 0 all, farmer 20', { scanner: 0, belt: 0, truck: 0 }, 20],
    ['unloading 10 only, farmer 20', { scanner: 0, belt: 10, truck: 0 }, 20],
    ['scanner 5 only, farmer 20', { scanner: 5, belt: 0, truck: 0 }, 20],
    ['scanner 10 only, farmer 20', { scanner: 10, belt: 0, truck: 0 }, 20],
    ['truck 3 only (10 boxes), farmer 20', { scanner: 0, belt: 0, truck: 3 }, 20],
    ['truck 5 only (23 boxes), farmer 20', { scanner: 0, belt: 0, truck: 5 }, 20],
    ['truck 10 only, farmer 20', { scanner: 0, belt: 0, truck: 10 }, 20],
    ['scanner 5 + truck 5, farmer 20', { scanner: 5, belt: 0, truck: 5 }, 20],
    ['level 5 all, farmer 20', { scanner: 5, belt: 5, truck: 5 }, 20],
    ['level 10 all, farmer 20', { scanner: 10, belt: 10, truck: 10 }, 20],
  ];

  for (const [name, lv, v] of rows) console.log(`      avg coins ${simulate(lv, v).toFixed(2)}  ${name}`);
  let sum = 0; const n = 800;
  for (let i = 0; i < n; i++) {
    const r = makeRound({ visitNo: 20, lastFarmerId: null, levels: { scanner: 100, belt: 10, truck: 10 } });
    collectAll(r);
    sum += fitterCoins(r).coins;
  }
  console.log(`      avg coins ${(sum / n).toFixed(2)}  scanner 100 + all 10 (automatic fit), farmer 20`);
});

// ------------------------------------------------------------------ minigame 2: Lo smistamento
const ALLQ = QUESTION_IDS;
function otherSolutions(c, items) {
  // list up to 5 perfect assignments (for a helpful failure message)
  const rec = (n, its) => {
    if (n.kind === 'leaf') return its.every((i) => i.label === n.truck) ? [[]] : [];
    const out = [];
    for (const q of ALLQ) {
      const f = QUESTIONS.find((x) => x.id === q).f;
      const y = [], no = []; for (const it of its) (f(it) ? y : no).push(it);
      const sn = rec(n.no, no); if (!sn.length) continue;
      const sy = rec(n.yes, y); if (!sy.length) continue;
      for (const a of sn.slice(0, 5)) for (const b of sy.slice(0, 5)) out.push([[n.idx, q], ...a, ...b]);
    }
    return out;
  };
  return rec(c.root, items).slice(0, 5).map((sol) => { const m = Object.fromEntries(sol); return c.gates.map((g) => m[g.idx] ?? '*').join(' '); });
}

test('smistamento: 12-15 levels, well formed (items, trucks, leaves, limits)', () => {
  assert.ok(LEVELS.length >= 12 && LEVELS.length <= 15, `${LEVELS.length} levels`);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length, 'unique ids');
  assert.equal(QUESTIONS.length, 18);
  assert.ok(!QUESTIONS.some((q) => q.id === 'grande'), 'size is not a feature any more');
  let prevGates = 0, maxGates = 0;
  LEVELS.forEach((lv, i) => {
    const c = compile(lv.tree);
    for (const t of lv.trucks) assert.ok(TRUCKS[t], `${lv.id}: unknown truck ${t}`);
    assert.equal(new Set(lv.trucks).size, lv.trucks.length, `${lv.id}: truck listed twice`);
    for (const leaf of c.leaves) assert.ok(lv.trucks.includes(leaf.truck), `${lv.id}: leaf truck ${leaf.truck} not in trucks`);
    for (const t of lv.trucks) assert.ok(c.leaves.some((l) => l.truck === t), `${lv.id}: truck ${t} has no pipe`);
    for (const g of c.gates) assert.ok(ALLQ.includes(g.q), `${lv.id}: unknown question ${g.q}`);
    for (const [str, label, n = 1] of lv.items) {
      parseItem(str);
      assert.ok(lv.trucks.includes(label), `${lv.id}: item label ${label} is not a truck of the level`);
      assert.ok(Number.isInteger(n) && n >= 1);
    }
    assert.ok(c.gates.length <= 9, `${lv.id}: at most 9 gates`);
    assert.ok(treeDepth(c.root) <= 5, `${lv.id}: depth at most 5`);
    assert.ok(lv.trucks.length <= 6, `${lv.id}: at most 6 trucks`);
    const perRow = {};
    for (const g of c.gates) perRow[g.depth] = (perRow[g.depth] || 0) + 1;
    assert.ok(Math.max(...Object.values(perRow)) <= 5, `${lv.id}: at most 5 gates per row`);
    assert.ok(c.gates.length >= prevGates - 2, `${lv.id}: no big drop in size`);
    prevGates = c.gates.length; maxGates = Math.max(maxGates, c.gates.length);
    if (i === 0) assert.equal(c.gates.length, 1, 'level 1 has one gate');
  });
  assert.ok(maxGates >= 7, 'the biggest level has 7-9 gates');
  assert.ok(LEVELS.some((lv) => treeDepth(compile(lv.tree).root) >= 4), 'some deep trees');
});

test('smistamento: item model (big = heavy, lone animals, attached worm/snail)', () => {
  const q = (id, str) => QUESTIONS.find((x) => x.id === id).f(parseItem(str));
  assert.ok(q('pesante', 'mela rosso grande') && !q('pesante', 'mela rosso'), 'big means heavy');
  for (const a of ['ape giallo', 'farfalla arancione', 'coccinella rosso', 'lumaca marrone', 'verme rosso']) {
    assert.ok(q('vivo', a), `${a} is alive`);
    for (const t of ['mela', 'pera', 'patata', 'pomodoro', 'carota']) assert.ok(!q(t, a), `${a} is not a ${t}`);
  }
  assert.ok(!q('vivo', 'mela rosso verme') && !q('vivo', 'patata marrone lumaca'), 'produce with an animal is not alive');
  assert.ok(q('verme', 'verme rosso') && q('verme', 'mela rosso verme') && !q('verme', 'lumaca marrone'));
  assert.ok(q('lumaca', 'lumaca marrone') && q('lumaca', 'carota arancione lumaca') && !q('lumaca', 'verme rosso'));
  assert.ok(q('carota', 'carota giallo strano sporco') && q('strano', 'carota giallo strano sporco') && q('sporco', 'carota giallo strano sporco'));
  assert.throws(() => parseItem('ape giallo sporco'), /lone animal/);
  assert.throws(() => parseItem('mela rosso leggero'), /unknown token/);
  // every animal and every flag appears in some level
  const all = LEVELS.flatMap((lv) => lv.items.map(([str]) => parseItem(str)));
  for (const t of ['ape', 'farfalla', 'coccinella', 'lumaca', 'verme', 'carota']) assert.ok(all.some((it) => it.t === t), `${t} appears`);
  for (const f of ['dirty', 'odd', 'worm', 'snail', 'rot']) assert.ok(all.some((it) => it[f] && !it.alive), `produce with ${f} appears`);
  // helpers go to the orto, worms and snails to the hens (the story behind the trucks)
  for (const lv of LEVELS) for (const [str, label] of lv.items) {
    const it = parseItem(str);
    if (['ape', 'farfalla', 'coccinella'].includes(it.t)) assert.equal(label, 'orto', `${lv.id}: ${str}`);
    if (it.t === 'verme' || it.t === 'lumaca') assert.equal(label, 'galline', `${lv.id}: ${str}`);
  }
  for (const gone of ['succo', 'passata', 'prato']) assert.ok(!TRUCKS[gone], `${gone} truck removed`);
  for (const t of ['lavaggio', 'brutti', 'orto', 'mercato', 'compost', 'galline']) assert.ok(TRUCKS[t], `${t} truck`);
});

test('smistamento: the solution sorts the training batch 100% and every leaf gets an item', () => {
  LEVELS.forEach((lv, i) => {
    const c = compile(lv.tree);
    const items = trainingBatch(lv, i + 1);
    const r = runBatch(c, solutionOf(c), items);
    assert.equal(r.right, r.total, `${lv.id}: solution ${r.right}/${r.total}`);
    for (const leaf of c.leaves) assert.ok(r.results.some((x) => x.leaf === leaf), `${lv.id}: leaf ${leaf.idx} (${leaf.truck}) gets no training item`);
  });
});

test('smistamento: EXACTLY ONE question assignment (of all 18 questions) sorts each training batch perfectly', () => {
  let literal = 0;
  LEVELS.forEach((lv, i) => {
    const c = compile(lv.tree);
    const items = trainingBatch(lv, i + 1);
    // exhaustive over all 18^gates assignments, factorised per subtree
    const n = countSolutions(c, items, ALLQ);
    assert.equal(n, 1, `${lv.id}: ${n} perfect assignments, e.g.\n        ${otherSolutions(c, items).join('\n        ')}\n        (gates in pre-order; solution: ${solutionOf(c).join(' ')})`);
    // literal brute force, one assignment at a time, where it is fast enough (18^5 = 1.9 million)
    if (c.gates.length <= 5) {
      const bf = bruteForce(c, items, ALLQ);
      assert.equal(bf.tried, ALLQ.length ** c.gates.length);
      assert.equal(bf.found.length, 1, `${lv.id}: brute force found ${bf.found.length}`);
      assert.deepEqual(bf.found[0], solutionOf(c));
      literal++;
    }
  });
  // the factorised count agrees with the literal brute force on small synthetic trees too
  const c3 = compile(LEVELS.find((l) => l.id === 'verme').tree);
  const items = trainingBatch(LEVELS.find((l) => l.id === 'verme'), 7).slice(0, 3);
  assert.equal(countSolutions(c3, items, ALLQ), bruteForce(c3, items, ALLQ, 1e9).found.length, 'count = brute force');
  console.log(`      literal brute force on ${literal} levels, factorised exhaustive count on all ${LEVELS.length}`);
});

test('smistamento: the correct tree scores 100% on generated test batches (same kinds, new mix)', () => {
  LEVELS.forEach((lv, i) => {
    const c = compile(lv.tree);
    const kinds = new Set(lv.items.map(([str, label]) => `${itemKey(parseItem(str))}>${label}`));
    const size = lv.items.reduce((s, x) => s + (x[2] || 1), 0);
    const r = rng(1000 + i);
    for (let k = 0; k < 300; k++) {
      const batch = testBatch(lv, r);
      assert.equal(batch.length, lv.testSize || size);
      for (const it of batch) assert.ok(kinds.has(`${itemKey(it)}>${it.label}`), `${lv.id}: test item of a new kind`);
      const res = runBatch(c, solutionOf(c), batch);
      assert.equal(res.right, res.total, `${lv.id}: test ${res.right}/${res.total}`);
    }
  });
});

test('smistamento: wrong items always have a gate to blame; accuracy counts', () => {
  const r = rng(7);
  LEVELS.forEach((lv, i) => {
    const c = compile(lv.tree);
    const items = trainingBatch(lv, i + 1);
    for (let k = 0; k < 200; k++) {
      const assign = c.gates.map(() => ALLQ[Math.floor(r() * ALLQ.length)]);
      const res = runBatch(c, assign, items);
      assert.equal(res.right, res.results.filter((x) => x.ok).length);
      for (const x of res.results) {
        if (x.ok) continue;
        assert.ok(x.blame >= 0, `${lv.id}: wrong item without a guilty gate`);
        assert.ok(x.path.some((p) => p.gate.idx === x.blame), 'the guilty gate is on the path');
      }
    }
  });
});

test('smistamento: every truck symbol shows only what goes into that truck', () => {
  for (const lv of LEVELS) {
    for (const id of lv.trucks) {
      const spec = truckSpec(id, lv.items);
      const routed = lv.items.filter(([, l]) => l === id).map(([str]) => parseItem(str));
      const produce = routed.filter((it) => !it.alive);
      if (['produce', 'scale', 'wash', 'odd'].includes(spec.kind)) assert.ok(spec.show.length > 0, `${lv.id}/${id}: symbol shows something`);
      for (const x of spec.show) {
        const match = produce.filter((it) => it.t === x.t && it.c === x.c && (!x.dirty || it.dirty) && (!x.odd || it.odd));
        assert.ok(match.length > 0, `${lv.id}/${id}: symbol shows ${x.t} ${x.c}${x.dirty ? ' sporco' : ''}${x.odd ? ' strano' : ''}, but none goes in`);
      }
      if (spec.kind === 'produce') {
        // single-type trucks: every type that goes in is shown, with its colours (up to 3)
        const types = new Set(produce.map((it) => it.t));
        for (const t of types) assert.ok(spec.show.some((x) => x.t === t), `${lv.id}/${id}: ${t} goes in but isn't shown`);
        const colours = new Set(produce.map((it) => it.c));
        assert.ok(spec.show.length === Math.min(3, colours.size), `${lv.id}/${id}: shows ${spec.show.length} of ${colours.size} colours`);
      }
      if (spec.kind === 'scale') {
        const types = new Set(produce.map((it) => it.t));
        assert.ok(spec.show.length === Math.min(2, types.size), `${lv.id}/${id}: scale shows the level's produce types`);
        for (const it of produce) assert.equal(it.heavy, id === 'grandi', `${lv.id}/${id}: ${it.t} weight fits the scale`);
      }
      if (spec.kind === 'fixed') assert.equal(spec.show.length, 0);
    }
  }
});

test('smistamento: pipe colours differ within every level; lone animals look like their colour', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  for (const lv of LEVELS) {
    for (const t of lv.trucks) assert.ok(PIPE_COLOUR[t], `${t}: pipe colour`);
    for (const a of lv.trucks) for (const b of lv.trucks) {
      if (a < b) assert.ok(dist(PIPE_COLOUR[a], PIPE_COLOUR[b]) > 45, `${lv.id}: pipes ${a} and ${b} too similar`);
    }
  }
  // the drawings: a bee is yellow, a ladybird and a lone worm are red; butterflies and snails are
  // drawn in their own colour, so any colour is fine for them
  const DRAWN = { ape: 'giallo', coccinella: 'rosso', verme: 'rosso' };
  for (const lv of LEVELS) for (const [str] of lv.items) {
    const it = parseItem(str);
    if (DRAWN[it.t]) assert.equal(it.c, DRAWN[it.t], `${lv.id}: ${str} must be ${DRAWN[it.t]}`);
  }
});

test('smistamento: after failed tries only the truly wrong (or empty) gates are marked', () => {
  const c = compile(LEVELS.find((l) => l.id === 'verme').tree);   // rosso, marcio, verme
  assert.deepEqual(wrongGates(c, ['rosso', 'marcio', 'verme']), []);
  assert.deepEqual(wrongGates(c, ['rosso', 'verme', 'verme']), [1]);
  assert.deepEqual(wrongGates(c, ['verde', 'marcio', null]), [0, 2]);
  // the failure counter is saved per level and survives a reload
  const base = { playerId: '11111111-2222-4333-8444-555555555555', coins: 0 };
  const s = sanitize({ ...base, sort: { ...defaultSort(), fails: { verme: 3, nope: 2, marce: -1, lumache: 'x' } } }).sort;
  assert.deepEqual(s.fails, { verme: 3 });
});

test('smistamento: layout fits 360 px without horizontal scrolling', () => {
  for (const W of [344, 360, 468]) {
    LEVELS.forEach((lv) => {
      const c = compile(lv.tree);
      layoutTree(c, W, { top: 0, rowH: 76, pad: 6 });
      for (const n of [...c.gates, ...c.leaves]) assert.ok(n.x >= 6 && n.x <= W - 6, `${lv.id}: node inside ${W}px`);
      for (const a of c.gates) for (const b of c.gates) {
        if (a !== b && a.depth === b.depth) assert.ok(Math.abs(a.x - b.x) >= 54, `${lv.id}: gates overlap at ${W}px`);
      }
      for (const a of c.gates) for (const l of c.leaves) {
        if (l.depth === a.depth) assert.ok(Math.abs(a.x - l.x) >= 30, `${lv.id}: gate and pipe mouth overlap`);
      }
      const xs = c.leaves.map((l) => l.x);
      for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] >= 30, `${lv.id}: pipes too close at ${W}px`);
      // a pipe goes straight down from its leaf: it must not pass through a gate below it
      for (const l of c.leaves) for (const g of c.gates) {
        if (g.depth > l.depth) assert.ok(Math.abs(g.x - l.x) > 23 + 6, `${lv.id}: pipe through a gate`);
      }
    });
  }
});

test('smistamento: sensors, level locks, prices', () => {
  const free = QUESTIONS.filter((q) => !q.sensor).map((q) => q.group);
  assert.deepEqual([...new Set(free)], ['colore', 'tipo', 'sporco', 'lumaca'], 'colour, type, soil and snail are free');
  for (const s of SENSORS) {
    assert.ok(QUESTIONS.some((q) => q.id === s.q && q.sensor === s.id));
    assert.ok(Number.isInteger(CONFIG.SORT.SENSOR_COST[s.id]) && CONFIG.SORT.SENSOR_COST[s.id] > 0, `price for ${s.id}`);
  }
  assert.ok(questionUnlocked('rosso', []) && questionUnlocked('patata', []) && !questionUnlocked('vivo', []));
  assert.deepEqual(requiredSensors(0), []);
  assert.deepEqual(requiredSensors(1), []);
  let s = defaultSort();
  assert.ok(levelStatus(s, 0).playable && !levelStatus(s, 1).open, 'only level 1 open at the start');
  s.solved = LEVELS.slice(0, 2).map((l) => l.id);
  assert.ok(levelStatus(s, 2).open && !levelStatus(s, 2).playable, 'level 3 needs the rot detector');
  assert.deepEqual(levelStatus(s, 2).missing, ['naso']);
  s.sensors = ['naso'];
  assert.ok(levelStatus(s, 2).playable);
  assert.equal(startLevel(s), 2);
  // every sensor is needed by some level
  for (const sen of SENSORS) assert.ok(LEVELS.some((_, i) => requiredSensors(i).includes(sen.id)), `${sen.id} is used`);
  assert.equal(CONFIG.SORT.UNLOCK_COST, 100);
  assert.ok(CONFIG.SORT.hintCost(1) > CONFIG.SORT.hintCost(0), 'hint price rises');
  assert.equal(CONFIG.SORT.pay(1), 7);
});

test('smistamento: saves migrate (no "sort"; older levels; calibro refund) and are sanitised', () => {
  const base = { playerId: '11111111-2222-4333-8444-555555555555', coins: 3, levels: { scanner: 2, belt: 2, truck: 4 } };
  const old = sanitize(base);
  assert.deepEqual(old.sort, defaultSort(), 'save without minigame 2 gets an empty progress');
  assert.equal(old.coins, 3);
  // a save from the first version of the levels (no levelsVersion), with the removed calibro
  const v1 = { unlocked: true, solved: ['rosse-verdi', 'marce'], current: 'marce', sensors: ['naso', 'calibro', 'bilancia'], hints: 2, hintsBought: 3,
    lente: true, fast: true, boards: { 'rosse-verdi': ['rosso'] }, hinted: { 'rosse-verdi': [0] }, seenHelp: true };
  const m = sanitize({ ...base, sort: v1 });
  assert.equal(m.coins, 3 + CONFIG.SORT.CALIBRO_REFUND, 'calibro refunded');
  assert.deepEqual(m.sort.sensors, ['naso', 'bilancia'], 'other sensors kept');
  assert.deepEqual(m.sort.solved, [], 'level progress starts over');
  assert.equal(m.sort.current, null);
  assert.deepEqual(m.sort.boards, {});
  assert.ok(m.sort.unlocked && m.sort.lente && m.sort.fast && m.sort.seenHelp && m.sort.hints === 2 && m.sort.hintsBought === 3);
  const again = sanitize(JSON.parse(JSON.stringify(m)));
  assert.equal(again.coins, m.coins, 'refund only once');
  assert.deepEqual(again.sort, m.sort, 'round trip');
  // a current save is kept and cleaned
  const good = { ...defaultSort(), unlocked: true, solved: ['rosse-verdi', 'nope'], current: 'marce', sensors: ['naso', 'laser'],
    fast: 'yes', boards: { 'rosse-verdi': ['rosso'], 'tre-camion': ['marcio', 'xx'], marce: ['a', 'b'] }, hinted: { 'rosse-verdi': [0, 5] } };
  const s = sanitize({ ...base, sort: good }).sort;
  assert.deepEqual(s.solved, ['rosse-verdi']);
  assert.equal(s.current, 'marce');
  assert.deepEqual(s.sensors, ['naso']);
  assert.equal(s.fast, false);
  assert.deepEqual(s.boards, { 'rosse-verdi': ['rosso'], 'tre-camion': ['marcio', null] }, 'boards of the wrong length are dropped');
  assert.deepEqual(s.hinted, { 'rosse-verdi': [0] });
  assert.deepEqual(sanitizeSort('garbage'), defaultSort());
});

test('smistamento: no emoji in minigame 2; no L3 words in minigame 1; no "bias"', () => {
  const emoji = /\p{Extended_Pictographic}/u;
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  for (const f of ['js/sorting/trucks.js', 'js/sorting/questions.js', 'js/sorting/levels.js', 'js/sorting/tree.js', 'js/sorting/progress.js', 'js/sorting/art.js', 'js/sorting/game.js', 'js/sorting/shop.js']) {
    const src = read(f);
    const m = src.match(emoji);
    assert.ok(!m, `${f}: emoji ${m && m[0]}`);
    assert.ok(!/\bbias\b/i.test(src), `${f}: says "bias"`);
  }
  const html = read('index.html');
  const sortHtml = html.slice(html.indexOf('id="screen-sort"'), html.indexOf('SHEETS AND MODALS'));
  assert.ok(sortHtml.length > 100 && !emoji.test(sortHtml), 'sorting screen HTML has no emoji');
  const weighHtml = html.slice(html.indexOf('id="screen-weigh"'), html.indexOf('SORTING STATION'));
  const L3 = /classificazione|etichett|albero di decisione|addestramento|accuratezza/i;
  assert.ok(!L3.test(weighHtml), 'weighing screen HTML');
  for (const f of ['js/weighing/game.js', 'js/weighing/farmers.js', 'js/weighing/round.js']) assert.ok(!L3.test(read(f)), `${f} uses an L3 word`);
  // the weighing help text in main.js
  const main = read('js/main.js');
  const help = main.slice(main.indexOf('function showHelp'), main.indexOf('// ------------------------------------------------------------ shop'));
  assert.ok(help.length > 100 && !L3.test(help), 'weighing help');
});

// ------------------------------------------------------------------ minigame 3: Il laboratorio
// seeded random numbers, so the statistical checks below give the same answer every run
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a careful copy of a tree: every line end moved by up to +-j
const jitter = (tree, R, j) => { const t = copyTree(tree); for (const e of listNodes(t)) for (const q of ['x1', 'y1', 'x2', 'y2']) e.node.line[q] += (R() - 0.5) * 2 * j; return t; };
// a random line, at least as long as the game allows (two handles apart)
function randLine(R) {
  for (;;) { const l = { x1: R(), y1: R(), x2: R(), y2: R() }; if (Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 0.06) return l; }
}
// a random player tree with up to `max` nodes
function randomTree(R, K, max) {
  const t = emptyNode();
  for (let k = 0; k < 40 && countNodes(t) <= max; k++) {
    const open = listNodes(t).filter((e) => !e.node.line);
    if (!open.length) break;
    const e = open[Math.floor(R() * open.length)];
    const room = max - countNodes(t);
    const choice = [0, 1].map(() => (R() < 0.45 && room > 0 ? '+' : Math.floor(R() * K)));
    if (choice[0] === '+' && choice[1] === '+' && room < 2) choice[1] = 0;
    applyNode(t, e.path, randLine(R), choice);
  }
  // close the rest with colours
  for (const e of listNodes(t)) if (!e.node.line) applyNode(t, e.path, randLine(R), [0, K - 1]);
  return t;
}

test('laboratorio: config (upgrades 0..10, pay thresholds, prices, node cap)', () => {
  const L = CONFIG.LAB;
  assert.equal(L.SAMPLES.length, CONFIG.MAX_LEVEL + 1);
  assert.equal(L.NOISE_FACTOR.length, CONFIG.MAX_LEVEL + 1);
  assert.ok(L.SAMPLES[0] >= 60 && L.SAMPLES[0] <= 80 && L.SAMPLES[10] >= 140 && L.SAMPLES[10] <= 160, 'about 70 -> 150 samples');
  for (let i = 1; i <= 10; i++) {
    assert.ok(L.SAMPLES[i] > L.SAMPLES[i - 1], 'more samples every level');
    assert.ok(L.NOISE_FACTOR[i] < L.NOISE_FACTOR[i - 1], 'less noise every level');
  }
  assert.ok(L.NOISE_FACTOR[10] > 0, 'noise never zero');
  const t = L.SCORE_THRESHOLDS;
  for (let i = 1; i < t.length; i++) assert.ok(t[i].minRatio < t[i - 1].minRatio && t[i].coins < t[i - 1].coins);
  assert.equal(coinsForAccRatio(1), 10);
  assert.equal(coinsForAccRatio(1.2), 10, 'beating the true tree by luck pays 10');
  assert.equal(coinsForAccRatio(0.3), 0);
  assert.equal(coinsForAccRatio(39 / 40), 9, '1 more mistake than the true tree on 40');
  assert.equal(coinsForAccRatio(37 / 40), 7, '3 more mistakes');
  assert.equal(L.UNLOCK_COST, 200);
  assert.ok(L.hintCost(1) > L.hintCost(0), 'hint price rises');
  assert.ok(L.MAX_NODES >= 6 && L.MAX_NODES <= 8, 'node cap');
  assert.ok(CLASS_COLOURS.length >= 5 && new Set(CLASS_COLOURS.map((c) => c.shape)).size === CLASS_COLOURS.length, 'a shape per colour');
});

test('laboratorio: about 10 levels, easy -> hard; one-line levels mixed in; triangle, square, 5 colours', () => {
  assert.ok(LAB_LEVELS.length >= 9 && LAB_LEVELS.length <= 12);
  assert.equal(new Set(LAB_LEVELS.map((l) => l.id)).size, LAB_LEVELS.length, 'unique ids');
  const lines = LAB_LEVELS.map((lv) => countNodes(lv.tree));
  LAB_LEVELS.forEach((lv) => {
    assert.ok(lv.title && lv.title.length <= 30 && lv.x.name && lv.x.icon && lv.y.name && lv.y.icon, `${lv.id}: short title, axes`);
    assert.ok(lv.classes.length >= 2 && lv.classes.length <= CLASS_COLOURS.length, `${lv.id}: 2-5 classes`);
    assert.ok(countNodes(lv.tree) <= CONFIG.LAB.MAX_NODES - 1, `${lv.id}: the player has room for the true tree and one more line`);
    assert.ok(isComplete(lv.tree), `${lv.id}: complete true tree`);
    assert.ok(lv.noise > 0 && lv.noise < 0.15, `${lv.id}: noise`);
    for (const e of listNodes(lv.tree)) {
      const t = e.node.line;
      for (const v of [t.x1, t.y1, t.x2, t.y2]) assert.ok(v >= 0 && v <= 1, `${lv.id}: line points inside the field`);
      assert.ok(lineInPoly(t, e.poly), `${lv.id}: every true line cuts its region (no spare nodes)`);
      assert.ok(e.node.kids.every((k) => typeof k === 'object' || (Number.isInteger(k) && k >= 0 && k < lv.classes.length)), `${lv.id}: leaves`);
    }
    const rs = trueRegions(lv.tree);
    for (let k = 0; k < lv.classes.length; k++) assert.ok(rs.some((r) => r.cls === k && r.area > 0.03), `${lv.id}: class ${k} has a region`);
    assert.ok(Math.abs(rs.reduce((a, r) => a + r.area, 0) - 1) < 1e-9, `${lv.id}: regions cover the field once`);
    // the true tree survives a save, so it is a tree the player could build
    assert.deepEqual(cleanTree(copyTree(lv.tree), lv.classes.length), lv.tree, `${lv.id}: the true tree is a valid player tree`);
  });
  assert.equal(lines[0], 1, 'level 1: one line');
  assert.ok(lines.filter((n) => n === 1).length >= 3, 'several levels need one line only');
  assert.ok(lines.slice(3).some((n) => n === 1), 'a one-line level among the harder ones');
  assert.ok(lines[lines.length - 1] >= 5 && LAB_LEVELS[LAB_LEVELS.length - 1].classes.length >= 5, 'a hard final level');
  assert.ok(LAB_LEVELS.filter((lv) => lv.classes.length >= 5).length >= 2, 'two 5-colour levels');
  // a clean triangle and a clean square (a region with 3 / 4 sides away from the border, a gap, little noise)
  const shape = (k) => LAB_LEVELS.find((lv) => lv.gap >= 0.05 && lv.noise <= 0.02 &&
    trueRegions(lv.tree).some((r) => r.poly.length === k && r.poly.every((p) => p[0] > 1e-6 && p[0] < 1 - 1e-6 && p[1] > 1e-6 && p[1] < 1 - 1e-6)));
  assert.ok(shape(3), 'a clean triangle level');
  assert.ok(shape(4), 'a clean square level');
  // non-convex classes: one colour in two leaves
  assert.ok(LAB_LEVELS.filter((lv) => lv.classes.some((_, k) => regions(lv.tree).filter((r) => r.cls === k).length >= 2)).length >= 3, 'non-convex classes');
});

test('laboratorio: tree model (apply, "+" nodes, replace, delete, cap, orientation, routing)', () => {
  const t = emptyNode();
  assert.equal(countNodes(t), 1);
  assert.ok(!isComplete(t));
  assert.equal(labRoute(t, 0.5, 0.5).cls, null, 'an empty root predicts nothing');
  // a vertical line: side "+" on the right, colour 2 on the left
  applyNode(t, [], { x1: 0.5, y1: 1, x2: 0.5, y2: 0 }, ['+', 2]);
  // turned so that kid 0 is the left part of the field
  assert.equal(t.kids[0], 2, 'the left side comes first after apply');
  assert.ok(typeof t.kids[1] === 'object' && t.kids[1].line === null, 'a "+" side gets an empty node');
  assert.equal(countNodes(t), 2);
  assert.ok(!isComplete(t));
  assert.equal(labRoute(t, 0.2, 0.5).cls, 2);
  assert.equal(labRoute(t, 0.8, 0.5).cls, null, 'stops at the empty node');
  assert.ok(reaches(t, [1], 0.8, 0.5) && !reaches(t, [1], 0.2, 0.5));
  // a horizontal line in node 2, "+" above: turned so that the lower side comes first
  applyNode(t, [1], { x1: 0.5, y1: 0.5, x2: 1, y2: 0.5 }, ['+', 0]);
  assert.equal(nodeAt(t, [1]).kids[0], 0, 'lower side first');
  applyNode(t, [1, 1], { x1: 0.75, y1: 0, x2: 0.75, y2: 1 }, [1, 3]);
  assert.equal(countNodes(t), 3);
  assert.ok(isComplete(t));
  assert.equal(labRoute(t, 0.6, 0.2).cls, 0);
  assert.equal(labRoute(t, 0.6, 0.8).cls, 1);
  assert.equal(labRoute(t, 0.9, 0.8).cls, 3);
  // changing a "+" side of node 2 to a colour removes its subtree
  const n2 = nodeAt(t, [1]);
  assert.equal(removedBy(n2, [0, 1]), subtreeSize(n2.kids[1]));
  assert.equal(removedBy(n2, [0, '+']), 0);
  assert.equal(addedBy(t, ['+', '+']), 1, 'one new node on the colour side');
  applyNode(t, [1], n2.line, [0, 1]);
  assert.equal(countNodes(t), 2);
  assert.equal(labRoute(t, 0.9, 0.8).cls, 1);
  // delete: node 2 becomes a leaf; the root becomes empty
  deleteNode(t, [1], 3);
  assert.equal(countNodes(t), 1);
  assert.equal(labRoute(t, 0.9, 0.8).cls, 3);
  assert.deepEqual(deleteNode(t, [], 0), emptyNode());
  // the regions of any tree cover the field once and agree with route(); layout within 348 px
  const R = seeded(7);
  for (let k = 0; k < 200; k++) {
    const tr = randomTree(R, 5, CONFIG.LAB.MAX_NODES);
    assert.ok(countNodes(tr) <= CONFIG.LAB.MAX_NODES, 'cap');
    const rs = regions(tr);
    assert.ok(Math.abs(rs.reduce((a, q) => a + polyArea(q.poly), 0) - 1) < 1e-9, 'cover');
    for (let j = 0; j < 10; j++) {
      const x = R(), y = R();
      const inside = rs.filter((q) => inPoly(q.poly, x, y, 1e-9));
      if (inside.length === 1) assert.equal(inside[0].cls, labRoute(tr, x, y).cls);
    }
    const W = 348;
    const lay = layoutLab(tr, W, { top: 29, rowH: 66, pad: 6 });
    const size = (it) => (it.kind === 'leaf' ? 13 : it.kind === 'empty' ? 18 : 21);
    for (const a of lay.items) assert.ok(a.x - size(a) >= 0 && a.x + size(a) <= W, 'inside the width');
    for (let p = 0; p < lay.items.length; p++) for (let q = p + 1; q < lay.items.length; q++) {
      const a = lay.items[p], b = lay.items[q];
      if (a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= size(a) + size(b) + 3, 'tree pieces overlap');
    }
    assert.deepEqual(cleanTree(copyTree(tr), 5), tr, 'saves round trip');
  }
  // majority and the live count
  const pts = [{ x: 0.2, y: 0.5, cls: 1 }, { x: 0.3, y: 0.5, cls: 1 }, { x: 0.8, y: 0.5, cls: 0 }];
  const vline = { x1: 0.5, y1: 0, x2: 0.5, y2: 1 };   // left side = x < 0.5
  assert.equal(majority(pts, vline, 0), 1);
  assert.equal(majority(pts, vline, 1), 0);
  assert.deepEqual(sideCount(vline, [1, 0], pts), { right: 3, total: 3 });
  assert.deepEqual(sideCount(vline, ['+', 1], pts), { right: 0, total: 1 }, '"+" sides do not count');
  assert.ok(defaultLine(UNIT_SQUARE).y1 === defaultLine(UNIT_SQUARE).y2, 'a new line starts horizontal');
});

test('laboratorio: every true region holds enough training points to be seen', () => {
  const R = seeded(11);
  LAB_LEVELS.forEach((lv) => {
    const rs = trueRegions(lv.tree).filter((r) => r.area > 0);
    for (const r of rs) assert.ok(r.weight * labSamples(lv, 0) >= 7, `${lv.id}: region of class ${r.cls} expects ${(r.weight * labSamples(lv, 0)).toFixed(1)} points`);
    const pts = makeSamples(lv, 400, labNoise(lv, 0), R);
    const counts = rs.map((r) => pts.filter((p) => inPoly(r.poly, p.tx, p.ty, 1e-9)).length);
    counts.forEach((n, k) => assert.ok(n / 400 * labSamples(lv, 0) >= 5, `${lv.id}: region ${k} got ${n}/400`));
    for (const p of pts) assert.equal(labRoute(lv.tree, p.tx, p.ty).cls, p.cls, `${lv.id}: label = true tree at the noiseless position`);
    for (const p of pts) assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1, 'measured inside the field');
  });
});

test('laboratorio: the true tree passes reliably on fresh samples; a careful copy passes; one colour fails', () => {
  const R = seeded(23);
  const cfg = CONFIG.LAB;
  const report = [];
  LAB_LEVELS.forEach((lv) => {
    const N = 300;
    let acc = 0, near = 0, flat = 0;
    for (let k = 0; k < N; k++) {
      const test2 = makeSamples(lv, cfg.TEST_SIZE, labNoise(lv, 0), R);
      const t = scoreTest(lv.tree, lv.tree, test2);
      assert.equal(t.coins, 10, `${lv.id}: the true tree always pays 10`);
      acc += t.best.acc;
      if (scoreTest(jitter(lv.tree, R, 0.015), lv.tree, test2).coins >= cfg.PASS_COINS) near++;
      const counts = lv.classes.map((_, q) => test2.filter((p) => p.cls === q).length);
      const top = counts.indexOf(Math.max(...counts));
      if (scoreTest(cut(0, 0, 1, 0.001, { left: top, right: top }), lv.tree, test2).coins >= cfg.PASS_COINS) flat++;
    }
    acc /= N;
    report.push(`${lv.id} ${(100 * acc).toFixed(0)}%`);
    assert.ok(acc >= 0.85, `${lv.id}: true tree accuracy ${acc.toFixed(3)}`);
    assert.ok(near / N >= 0.9, `${lv.id}: careful copy passes ${near}/${N}`);
    assert.ok(flat / N <= 0.02, `${lv.id}: one colour passes ${flat}/${N}`);
  });
  console.log('      true tree test accuracy:', report.join(', '));
});

test('laboratorio: pay, overfitting on a noisy one-line level, progression', () => {
  assert.equal(payFor(8, { best: 0, replay: false }), 8);
  assert.equal(payFor(8, { best: 6, replay: false }), 2, 'only the part above the record');
  assert.equal(payFor(5, { best: 6, replay: false }), 0);
  assert.equal(payFor(10, { best: 0, replay: true }), Math.round(10 * CONFIG.LAB.REPLAY_FACTOR));
  assert.ok(looksOverfit(0.95, 0.9, 0.85, 0.92), 'better on training, worse on test');
  assert.ok(!looksOverfit(0.95, 0.9, 0.92, 0.92), 'as good on test: fine');
  assert.ok(!looksOverfit(0.7, 0.9, 0.6, 0.9), 'a bad tree is not "learnt by heart"');
  // a noisy one-line level: a player who grows the tree to the cap around stray training points
  // (best of many random lines, greedily) beats the true tree on training and loses on test
  const lv = LAB_LEVELS.find((l) => l.id === 'mosca');
  assert.equal(countNodes(lv.tree), 1);
  const R = seeded(5);
  let gainTrain = 0, lossTest = 0, notes = 0;
  const N = 20;
  for (let k = 0; k < N; k++) {
    const train = makeSamples(lv, labSamples(lv, 0), labNoise(lv, 0), R);
    // the true line, then "+" on both sides, and so on, until the cap
    const t = copyTree(lv.tree);
    applyNode(t, [], t.line, ['+', '+']);
    for (let guard = 0; guard < 20; guard++) {
      const open = listNodes(t).filter((e) => !e.node.line);
      if (!open.length) break;
      const e = open[0];
      const pts = train.filter((p) => reaches(t, e.path, p.x, p.y));
      const room = CONFIG.LAB.MAX_NODES - countNodes(t);
      let best = null, bestRight = -1;
      for (let j = 0; j < 400; j++) {
        const line = { x1: R(), y1: R(), x2: R(), y2: R() };
        const ch = [0, 1].map((b) => majority(pts, line, b, majority(pts, null, 0)));
        const r = sideCount(line, ch, pts).right;
        if (r > bestRight) { bestRight = r; best = { line, ch }; }
      }
      const ch = best.ch.map((c, b) => (room >= 2 && b === 0 && bestRight < pts.length ? '+' : c));
      applyNode(t, e.path, best.line, ch);
    }
    const test2 = makeSamples(lv, CONFIG.LAB.TEST_SIZE, labNoise(lv, 0), R);
    const [trP, trB, teP, teB] = [accuracy(t, train).acc, accuracy(lv.tree, train).acc, accuracy(t, test2).acc, accuracy(lv.tree, test2).acc];
    gainTrain += (trP - trB) / N; lossTest += (teB - teP) / N;
    if (looksOverfit(trP, trB, teP, teB)) notes++;
  }
  assert.ok(gainTrain > 0.03 && lossTest > 0.01, `learning by heart: training +${gainTrain.toFixed(3)}, test -${lossTest.toFixed(3)}`);
  assert.ok(notes >= N * 0.3, `the note appears for a tree learnt by heart (${notes}/${N})`);
  let careful = 0;
  LAB_LEVELS.forEach((l2) => {
    for (let k = 0; k < 40; k++) {
      const tr = makeSamples(l2, labSamples(l2, 0), labNoise(l2, 0), R), te = makeSamples(l2, 40, labNoise(l2, 0), R);
      const sp = jitter(l2.tree, R, 0.015);
      if (looksOverfit(accuracy(sp, tr).acc, accuracy(l2.tree, tr).acc, accuracy(sp, te).acc, accuracy(l2.tree, te).acc)) careful++;
    }
  });
  assert.ok(careful <= 4, `careful players get the note ${careful}/400 times`);
  // progression: level by level
  const lab = defaultLab();
  assert.ok(labLevelStatus(lab, LAB_LEVELS, 0).open && !labLevelStatus(lab, LAB_LEVELS, 1).open);
  lab.passed = [LAB_LEVELS[0].id];
  assert.equal(labStartLevel(lab, LAB_LEVELS), 1);
  lab.current = LAB_LEVELS[5].id;
  assert.equal(labStartLevel(lab, LAB_LEVELS), 1, 'never a closed level');
});

test('laboratorio: saves (no "lab"; garbage; version 1 fixed shapes dropped; trees cleaned)', () => {
  const base = { playerId: '11111111-2222-4333-8444-555555555555', coins: 3, levels: { scanner: 2, belt: 2, truck: 4 } };
  assert.deepEqual(sanitize(base).lab, defaultLab(), 'old save without the lab gets an empty progress');
  assert.deepEqual(sanitizeLab('garbage'), defaultLab());
  // a save from round 1 (fixed shapes): progress starts over, place, upgrades and hints stay
  const v1 = { levelsVersion: 1, unlocked: true, passed: ['olive', 'uve'], current: 'uve', samples: 3, precision: 4, hints: 2, hintsBought: 1, seenHelp: true,
    boards: { olive: { nodes: [{ x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.8, c: [1, 0], flip: true }], best: 7 } }, hinted: { olive: [0] } };
  const m1 = sanitize({ ...base, coins: 50, lab: v1 });
  assert.equal(m1.coins, 50, 'coins kept');
  assert.ok(m1.lab.unlocked && m1.lab.samples === 3 && m1.lab.precision === 4 && m1.lab.hints === 2 && m1.lab.hintsBought === 1 && m1.lab.seenHelp);
  assert.deepEqual([m1.lab.passed, m1.lab.boards, m1.lab.hinted, m1.lab.current], [[], {}, [], null]);
  const t = copyTree(LAB_LEVELS[1].tree);
  const good = {
    ...defaultLab(), unlocked: true, passed: ['olive', 'nope'], current: 'latte', precision: 14, hinted: ['latte', 'x'],
    boards: {
      latte: { tree: t, best: 7, replay: false },
      olive: { tree: { line: { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.8 }, kids: [1, 1] }, best: 99 },
      uve: { tree: { line: { x1: -1, y1: 0.2, x2: 0.9, y2: 0.8 }, kids: [0, 1] } },
      castagno: { tree: { line: { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.8 }, kids: [0, 7] } },
      mieli: { tree: emptyNode() },
    },
  };
  const m = sanitize({ ...base, lab: good }).lab;
  assert.deepEqual(m.passed, ['olive']);
  assert.equal(m.current, 'latte');
  assert.equal(m.precision, CONFIG.MAX_LEVEL, 'upgrade levels clamped');
  assert.deepEqual(m.hinted, ['latte']);
  assert.deepEqual(m.boards.latte, { tree: t, best: 7, replay: false });
  assert.equal(m.boards.olive.best, CONFIG.MAX_PAY, 'record clamped');
  assert.equal(m.boards.uve, undefined, 'a line outside the field is dropped');
  assert.equal(m.boards.castagno, undefined, 'an unknown colour is dropped');
  assert.deepEqual(m.boards.mieli.tree, emptyNode());
  // too many nodes: dropped
  let big = emptyNode();
  for (let k = 0; k < CONFIG.LAB.MAX_NODES + 2; k++) big = { line: { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.8 }, kids: [0, big.line ? big : 1] };
  assert.equal(cleanTree(big, 2), null, 'more than MAX_NODES nodes');
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify({ ...base, lab: m }))).lab, m, 'round trip');
});

test('laboratorio: little text; no L4 words, no "bias", emoji only as axis icons; sw.js caches every file', () => {
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const emoji = /\p{Extended_Pictographic}/u;
  const L4 = /distanz|somiglian|simil|vicin|\bknn\b|k-means|cluster|raggrupp|supervisionat/i;
  const files = ['js/lab/levels.js', 'js/lab/model.js', 'js/lab/draw.js', 'js/lab/game.js', 'js/lab/shop.js'];
  for (const f of files) {
    const src = read(f);
    assert.ok(!L4.test(src), `${f}: L4 word "${(src.match(L4) || [])[0]}"`);
    assert.ok(!/\bbias\b/i.test(src), `${f}: says "bias"`);
    if (f !== 'js/lab/levels.js') assert.ok(!emoji.test(src), `${f}: emoji ${(src.match(emoji) || [])[0]}`);
  }
  const noIcons = read('js/lab/levels.js').replace(/icon: '[^']*'/g, '');
  assert.ok(!emoji.test(noIcons), 'levels.js: emoji outside the axis icons');
  assert.ok(LAB_LEVELS.every((lv) => !lv.story), 'no level stories: title and legend only');
  // the pop-up and the screen: no sentences, only a few words
  const html = read('index.html');
  const labHtml = html.slice(html.indexOf('id="screen-lab"'), html.indexOf('SHEETS AND MODALS'));
  assert.ok(labHtml.length > 100 && !emoji.test(labHtml) && !L4.test(labHtml), 'lab screen HTML');
  const visible = labHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(visible.split(' ').length <= 12, `lab screen text: "${visible}"`);
  const main = read('js/main.js');
  const labMain = main.slice(main.indexOf('async function onLabPlace'), main.indexOf('// ------------------------------------------------------------ help'));
  assert.ok(labMain.length > 100 && !L4.test(labMain), 'lab texts in main.js');
  // the key terms appear (once each on screen, in Italian with the English)
  const game = read('js/lab/game.js');
  for (const term of ['addestramento <em>(training)</em>', 'accuratezza <em>(accuracy)</em>', 'confine di decisione', '(decision boundary)']) assert.ok(game.includes(term), `key term ${term}`);
  const sw = read('sw.js');
  const walk = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
  for (const f of walk('js').filter((x) => x.endsWith('.js'))) assert.ok(sw.includes(`'${f}'`), `sw.js FILES misses ${f}`);
});

console.log(`\n${passed} checks passed`);
