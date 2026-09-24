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

// Hidden true line: y = a + b x. Sign, steepness and height are random, and both ends
// (x = 0 and x = 1) stay inside the plot, so the whole line and point cloud are visible.
function makeTrueLine(visitNo) {
  if (visitNo === 0) {
    const a = CONFIG.FIRST_FARMER.intercept;
    return { a, b: CONFIG.FIRST_FARMER.rightEnd - a };
  }
  const m = CONFIG.LINE_MARGIN;
  const [s0, s1] = CONFIG.SLOPE_ABS_RANGE;
  const size = Math.min(rand(s0, s1), 1 - 2 * m);
  const b = Math.random() < CONFIG.NEGATIVE_SLOPE_PROB ? -size : size;
  // Height of the line in the middle of the plot, chosen so that both ends fit.
  const mid = rand(m + size / 2, 1 - m - size / 2);
  return { a: mid - b / 2, b };
}

export function makeRound({ visitNo, lastFarmerId, levels }) {
  const farmer = pickFarmer(visitNo, lastFarmerId);
  const first = visitNo === 0;
  const difficulty = first ? 0 : clamp(visitNo / CONFIG.DIFFICULTY_RAMP_FARMERS, 0, 1);
  const trueLine = makeTrueLine(visitNo);
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

// Scanner and unloading ("Scarico") upgrades apply at once, even during a visit.
export function applyLiveLevels(round, levels) {
  round.scannerLevel = levels.scanner;
  round.scannerNoise = CONFIG.SCANNER_NOISE[levels.scanner] * (round.first ? CONFIG.FIRST_FARMER.scannerNoiseScale : 1);
  round.glitchProb = round.first && !CONFIG.FIRST_FARMER.glitches ? 0 : CONFIG.SCANNER_GLITCH[levels.scanner];
  round.perTrip = CONFIG.BELT_BOXES[levels.belt];   // boxes carried per tap
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
