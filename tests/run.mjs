// Model checks, no browser needed:  node tests/run.mjs   (from Game/)
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { EMOJIS, NOUNS, ADJECTIVES, formatName, nameChoices, isValidName } from '../js/names.js';
import { FARMERS } from '../js/weighing/farmers.js';
import { makeRound, takeUnit, measure, scoreLine, coinsForRatio, sliderToLine, startSliders, dataSlope } from '../js/weighing/round.js';
import { leastSquares } from '../js/stats.js';

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
    assert.ok(dataSlope(r.best, r.axes) > 0, `${r.farmer.id}: best line positive in data space`);
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
  for (const belt of [0, 10]) {
    const r = makeRound({ visitNo: 3, lastFarmerId: null, levels: { scanner: 0, belt, truck: 0 } });
    assert.equal(r.perTrip, CONFIG.BELT_BOXES[belt]);
    assert.equal(r.unitsPerBox, CONFIG.UNITS_PER_BOX);
    assert.equal(r.cratesTotal * r.unitsPerBox, 3, 'level-0 truck gives 3 data points');
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
});

console.log(`\n${passed} checks passed`);
