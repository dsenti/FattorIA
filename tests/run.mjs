// Model checks, no browser needed:  node tests/run.mjs   (from Game/)
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { EMOJIS, NOUNS, ADJECTIVES, formatName, nameChoices, isValidName } from '../js/names.js';
import { FARMERS } from '../js/weighing/farmers.js';
import { makeRound, takeUnit, measure, scoreLine, coinsForRatio, sliderToLine, startSliders } from '../js/weighing/round.js';
import { leastSquares } from '../js/stats.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ', name); };

test('per-level arrays have 11 entries', () => {
  for (const k of ['BELT_UNITS', 'TRUCK_CRATES', 'SCANNER_NOISE', 'SCANNER_GLITCH']) assert.equal(CONFIG[k].length, CONFIG.MAX_LEVEL + 1, k);
  assert.ok(CONFIG.SCANNER_NOISE.every((v) => v > 0), 'scanner noise never zero');
  assert.equal(CONFIG.SCANNER_GLITCH[10], 0);
  assert.ok(CONFIG.HARVEST_SIZE > CONFIG.BELT_UNITS[10] * CONFIG.TRUCK_CRATES[10], 'harvest bigger than max sample');
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
  assert.equal(coinsForRatio(0.9), 5);
  assert.equal(coinsForRatio(1.05), 5);
  assert.equal(coinsForRatio(1.1), 4);
  assert.equal(coinsForRatio(1.4), 3);
  assert.equal(coinsForRatio(1.9), 2);
  assert.equal(coinsForRatio(2.9), 1);
  assert.equal(coinsForRatio(3.1), 0);
});

test('true lines always inside the plot, all farmers appear', () => {
  const seen = new Set();
  const lv = { scanner: 0, belt: 0, truck: 0 };
  let last = null;
  for (let v = 0; v < 3000; v++) {
    const r = makeRound({ visitNo: v % 40, lastFarmerId: last, levels: lv });
    if (v % 40 !== 0) assert.notEqual(r.farmer.id, last, 'no farmer twice in a row');
    last = r.farmer.id;
    seen.add(r.farmer.id);
    const { a, b } = r.trueLine;
    assert.ok(a >= 0 && a <= 1 && a + b >= 0 && a + b <= 1, `line ends in plot: ${a} ${b}`);
    assert.ok(b >= 0.09, 'visible positive slope');
    assert.equal(r.harvest.length, CONFIG.HARVEST_SIZE);
  }
  assert.equal(seen.size, FARMERS.length);
  const r0 = makeRound({ visitNo: 0, lastFarmerId: null, levels: lv });
  assert.equal(r0.farmer.id, 'mele');
  assert.equal(r0.glitchProb, 0);
});

test('best line scores 5, flat start line scores low', () => {
  const lv = { scanner: 0, belt: 0, truck: 0 };
  for (let i = 0; i < 200; i++) {
    const r = makeRound({ visitNo: 5, lastFarmerId: null, levels: lv });
    assert.equal(scoreLine(r, r.best).coins, 5);
  }
  const s0 = startSliders();
  const flat = sliderToLine(s0.slope, s0.intercept);
  assert.ok(Math.abs(flat.b) < 1e-9 && Math.abs(flat.a - CONFIG.START_INTERCEPT) < 1e-9);
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
    for (let c = 0; c < r.cratesTotal * r.perCrate; c++) pts.push(measure(r, takeUnit(r)));
    coins += scoreLine(r, leastSquares(pts)).coins;
  }
  return coins / n;
}
test('tuning report (sample-perfect player)', () => {
  const rows = [
    ['level 0 all, first farmer', { scanner: 0, belt: 0, truck: 0 }, 0],
    ['level 0 all, farmer 20', { scanner: 0, belt: 0, truck: 0 }, 20],
    ['scanner 10 only, farmer 20', { scanner: 10, belt: 0, truck: 0 }, 20],
    ['belt+truck 10, farmer 20', { scanner: 0, belt: 10, truck: 10 }, 20],
    ['level 5 all, farmer 20', { scanner: 5, belt: 5, truck: 5 }, 20],
    ['level 10 all, farmer 20', { scanner: 10, belt: 10, truck: 10 }, 20],
  ];
  for (const [name, lv, v] of rows) console.log(`      avg coins ${simulate(lv, v).toFixed(2)}  ${name}`);
});

console.log(`\n${passed} checks passed`);
