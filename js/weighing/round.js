// Pure model for one farmer visit: hidden true line, whole harvest, scanner, scoring.
// No DOM here, so it can be tested with node (see tests/run.mjs).
import { CONFIG } from '../config.js';
import { FARMERS } from './farmers.js';
import { lerp, clamp, rand, randn, shuffle, leastSquares, meanAbsError } from '../stats.js';

// Pick the next farmer: the first visit is always the apple grower, then never the same twice in a row.
export function pickFarmer(visitNo, lastId) {
  if (visitNo === 0) return FARMERS[0];
  const pool = FARMERS.filter((f) => f.id !== lastId);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Everything (dots, sliders, lines, scoring) works in plot space: x and y in 0..1 as drawn,
// left to right and bottom to top. The farmer's real relationship is always positive; an axis
// that is drawn reversed (flipX: "+" on the left, flipY: "+" at the bottom) mirrors it, so the
// visible slope sign = flipX xor flipY. Data value <-> plot position: v = flip ? 1 - p : p.
export function randomAxes(visitNo) {
  if (visitNo === 0) return { flipX: false, flipY: false };
  return { flipX: Math.random() < CONFIG.AXIS_FLIP_PROB, flipY: Math.random() < CONFIG.AXIS_FLIP_PROB };
}

// The real (data-space) slope of a plot-space line: positive means "more x -> more y".
export function dataSlope(line, axes) {
  return line.b * (axes.flipX ? -1 : 1) * (axes.flipY ? -1 : 1);
}

// Hidden true line on the plot: y = a + b x. Steepness and height are random, the sign follows
// the axis directions, and both ends (x = 0 and x = 1) stay inside the plot.
function makeTrueLine(visitNo, axes) {
  if (visitNo === 0) {
    const a = CONFIG.FIRST_FARMER.intercept;
    return { a, b: CONFIG.FIRST_FARMER.rightEnd - a };
  }
  const m = CONFIG.LINE_MARGIN;
  const [s0, s1] = CONFIG.SLOPE_ABS_RANGE;
  const size = Math.min(rand(s0, s1), 1 - 2 * m);
  const b = axes.flipX !== axes.flipY ? -size : size;
  // Height of the line in the middle of the plot, chosen so that both ends fit.
  const mid = rand(m + size / 2, 1 - m - size / 2);
  return { a: mid - b / 2, b };
}

export function makeRound({ visitNo, lastFarmerId, levels }) {
  const farmer = pickFarmer(visitNo, lastFarmerId);
  const first = visitNo === 0;
  const difficulty = first ? 0 : clamp(visitNo / CONFIG.DIFFICULTY_RAMP_FARMERS, 0, 1);
  const axes = randomAxes(visitNo);
  const trueLine = makeTrueLine(visitNo, axes);
  const naturalNoise = lerp(CONFIG.NATURAL_NOISE_EASY, CONFIG.NATURAL_NOISE_HARD, difficulty) * (first ? 1 : farmer.noise);

  const [x0, x1] = CONFIG.HARVEST_X_RANGE;
  const harvest = [];
  for (let i = 0; i < CONFIG.HARVEST_SIZE; i++) {
    const x = rand(x0, x1);
    // Resample instead of clamping, so no dots pile up on the plot edges.
    let y;
    do { y = trueLine.a + trueLine.b * x + naturalNoise * randn(); } while (y < 0.02 || y > 0.98);
    harvest.push({ x, y });
  }
  const best = leastSquares(harvest);
  const bestError = meanAbsError(harvest, best);


  const round = {
    farmer,
    visitNo,
    trueLine,
    axes,
    harvest,
    best,
    bestError,
    order: shuffle(harvest.map((_, i) => i)), // which harvest units go on the truck, in order
    next: 0,
    cratesTotal: CONFIG.TRUCK_CRATES[levels.truck],
    cratesLeft: CONFIG.TRUCK_CRATES[levels.truck],
    truckLevel: levels.truck,                  // the vehicle is fixed for the whole visit
    unitsPerBox: CONFIG.UNITS_PER_BOX,
    first,
    sample: [],   // measured dots: { x, y, glitch, born }
  };
  applyLiveLevels(round, levels);
  return round;
}

// The secret scanner level 100 behaves like level 10 for noise, glitches and drawing.
export function isSmartScanner(level) {
  return level >= CONFIG.SECRET_SCANNER_LEVEL;
}
export function scannerIndex(level) {
  return Math.min(level, CONFIG.MAX_LEVEL);
}

// What the shop offers next for the scanner: a normal level, the secret level (only once level 10
// is bought), or nothing.
export function scannerOffer(level) {
  if (level < CONFIG.MAX_LEVEL) return { kind: 'level', level: level + 1, cost: CONFIG.levelCost(level + 1) };
  if (!isSmartScanner(level)) return { kind: 'secret', level: CONFIG.SECRET_SCANNER_LEVEL, cost: CONFIG.SECRET_SCANNER_COST };
  return null;
}

// Scanner and unloading ("Scarico") upgrades apply at once, even during a visit.
export function applyLiveLevels(round, levels) {
  const si = scannerIndex(levels.scanner);
  round.scannerLevel = levels.scanner;
  round.smart = isSmartScanner(levels.scanner);
  round.scannerNoise = CONFIG.SCANNER_NOISE[si] * (round.first ? CONFIG.FIRST_FARMER.scannerNoiseScale : 1);
  round.glitchProb = round.first && !CONFIG.FIRST_FARMER.glitches ? 0 : CONFIG.SCANNER_GLITCH[si];
  // boxes carried per tap; at the top unloading level one tap empties the whole truck
  round.unloadAll = levels.belt >= CONFIG.UNLOAD_ALL_LEVEL;
  round.perTrip = round.unloadAll ? Infinity : CONFIG.BELT_BOXES[levels.belt];
}

// Mirror values that fall outside the plot back inside (keeps the spread, avoids a pile-up on the edge).
function reflect(v, lo = 0.02, hi = 0.98) {
  if (v < lo) v = lo + (lo - v);
  if (v > hi) v = hi - (v - hi);
  return clamp(v, lo, hi);
}

// Take the next unit off the truck (index into harvest), or -1 if none left.
export function takeUnit(round) {
  if (round.next >= round.order.length) return -1;
  return round.order[round.next++];
}

// The scanner measures one harvest unit. Returns a dot.
export function measure(round, idx) {
  const u = round.harvest[idx];
  const s = round.scannerNoise;
  const x = reflect(u.x + s * CONFIG.SCANNER_X_NOISE_FRACTION * randn());
  let y = u.y + s * randn();
  let glitch = false;
  if (Math.random() < round.glitchProb) {
    glitch = true;
    const [lo, hi] = CONFIG.GLITCH_OFFSET;
    let dir = Math.random() < 0.5 ? -1 : 1;
    if (u.y + dir * lo > 0.98 || u.y + dir * lo < 0.02) dir = -dir;
    const room = dir > 0 ? 0.98 - u.y : u.y - 0.02;
    y = u.y + dir * rand(lo, Math.max(lo, Math.min(hi, room)));
  }
  return { x, y: reflect(y), glitch };
}

export function coinsForRatio(ratio) {
  for (const row of CONFIG.SCORE_THRESHOLDS) if (ratio <= row.maxRatio) return row.coins;
  return 0;
}

// Score the player's line on the whole harvest.
export function scoreLine(round, playerLine) {
  const playerError = meanAbsError(round.harvest, playerLine);
  const ratio = playerError / Math.max(1e-9, round.bestError);
  return { playerError, bestError: round.bestError, ratio, coins: coinsForRatio(ratio) };
}

// The level-100 scanner's fit: least squares on the points measured so far, never on the whole harvest.
// Returns null with fewer than 2 points.
export function autoFit(round) {
  if (round.sample.length < 2) return null;
  return leastSquares(round.sample);
}

// Line -> slider positions (0..1), clamped to the slider ranges.
export function lineToSliders(line) {
  const [g0, g1] = CONFIG.SLOPE_ANGLE_RANGE;
  const [i0, i1] = CONFIG.INTERCEPT_RANGE;
  const angle = (Math.atan(line.b) * 180) / Math.PI;
  return {
    slope: clamp((angle - g0) / (g1 - g0), 0, 1),
    intercept: clamp((line.a - i0) / (i1 - i0), 0, 1),
  };
}

// Drag mode: the line's two end points on the left and right edges of the plot (x = 0 and x = 1).
// Each handle moves only vertically, inside the plot (0..1). Every such line is also reachable with
// the sliders (intercept 0..1 is inside INTERCEPT_RANGE, |slope| <= 1 is inside the angle range),
// and every hidden true line has both ends inside the plot, so it is reachable by dragging.
export function lineToEnds(line) {
  return { left: line.a, right: line.a + line.b };
}
export function endsToLine(ends) {
  return { a: ends.left, b: ends.right - ends.left };
}
export function clampEnds(ends) {
  return { left: clamp(ends.left, 0, 1), right: clamp(ends.right, 0, 1) };
}

// Slider positions (0..1) <-> line.
export function sliderToLine(tSlope, tIntercept) {
  const [g0, g1] = CONFIG.SLOPE_ANGLE_RANGE;
  const [i0, i1] = CONFIG.INTERCEPT_RANGE;
  const angle = lerp(g0, g1, tSlope) * Math.PI / 180;
  return { a: lerp(i0, i1, tIntercept), b: Math.tan(angle) };
}

export function startSliders() {
  const [g0, g1] = CONFIG.SLOPE_ANGLE_RANGE;
  const [i0, i1] = CONFIG.INTERCEPT_RANGE;
  return {
    slope: (CONFIG.START_ANGLE - g0) / (g1 - g0),
    intercept: (CONFIG.START_INTERCEPT - i0) / (i1 - i0),
  };
}
