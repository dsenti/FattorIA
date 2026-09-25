// All tunable numbers for the game live here.
// Plot coordinates are normalised: x and y both run from 0 (left/bottom) to 1 (right/top).
// Arrays indexed by level have 11 entries: level 0 ... level 10.

// Truck capacity: TRUCK_BASE boxes at level 0, times TRUCK_FACTOR per level (rounded).
// 3, 5, 7, 10, 15, 23, 34, 51, 77, 115, 173
const TRUCK_BASE = 3;
const TRUCK_FACTOR = 1.5;

export const CONFIG = {
  // TODO(Dominik): remove before the course. Shows a "🐞 +100" coins button on the weighing
  // station (see js/debug.js). Those coins don't count for the leaderboard.
  DEBUG_COINS_BUTTON: true,

  // Bump when the saved-state format changes in an incompatible way.
  STORAGE_KEY: 'fateai-valle-v1',

  // ---------------------------------------------------------------- economy
  MAX_LEVEL: 10,
  // Cost in coins to buy level n (n = 1..10). Default: level n costs n coins.
  levelCost: (n) => n,

  // Coins paid by a farmer, from the error ratio
  //   ratio = mean absolute error of the player's line on the whole harvest
  //         / mean absolute error of the best (least-squares) line on the whole harvest.
  // First matching row wins; anything above the last row pays 0.
  // Pays 0..10: bad fits pay about what they did on the old 0..5 scale, close fits pay much more,
  // and only a truly perfect fit pays 10.
  SCORE_THRESHOLDS: [
    { maxRatio: 1.002, coins: 10 },
    { maxRatio: 1.01, coins: 9 },
    { maxRatio: 1.03, coins: 8 },
    { maxRatio: 1.05, coins: 7 },
    { maxRatio: 1.10, coins: 6 },
    { maxRatio: 1.20, coins: 5 },
    { maxRatio: 1.35, coins: 4 },
    { maxRatio: 1.50, coins: 3 },
    { maxRatio: 2.0, coins: 2 },
    { maxRatio: 3.0, coins: 1 },
  ],
  MAX_PAY: 10,

  // Farmer reaction emoji by coins paid (index = coins 0..10).
  REACTIONS: ['😐', '😐', '😐', '🙂', '🙂', '🙂', '😄', '😄', '😄', '😄', '🤩'],

  // A "day done" summary appears after this many farmers.
  FARMERS_PER_DAY: 5,

  // ---------------------------------------------------------------- upgrades
  // Products (= data points) per object on the truck. One object = one data point: a crate with
  // one fruit or vegetable, or one animal. A level-0 truck holds 3 objects = 3 data points.
  // TODO(Dominik): the early coins dropped with this change; retune if needed.
  UNITS_PER_BOX: 1,
  // Unloading ("Scarico", stored as "belt"): objects carried per trip (per tap on the truck), per
  // level. It adds no data; it only unloads the truck faster.
  BELT_BOXES: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  // Truck: boxes per farmer, per level (from TRUCK_BASE and TRUCK_FACTOR above).
  TRUCK_BASE,
  TRUCK_FACTOR,
  TRUCK_CRATES: Array.from({ length: 11 }, (_, n) => Math.round(TRUCK_BASE * TRUCK_FACTOR ** n)),
  // Drawing only (the machines grow with their level). Scanner height = SCANNER_SCALE[level] *
  // SCANNER_HEIGHT_FRACTION * scene height. Vehicle length = TRUCK_LENGTH[level] * scene width
  // (the rear stays next to the belt, the front grows to the left); TRUCK_HEIGHT_SCALE scales
  // wheels, bed height and cab.
  SCANNER_SCALE: [0.72, 0.77, 0.82, 0.87, 0.93, 0.99, 1.05, 1.12, 1.19, 1.27, 1.38],
  SCANNER_HEIGHT_FRACTION: 0.52,
  TRUCK_LENGTH: [0.22, 0.25, 0.27, 0.29, 0.3, 0.31, 0.33, 0.34, 0.35, 0.36, 0.37],
  TRUCK_HEIGHT_SCALE: [0.8, 0.84, 0.88, 0.92, 0.95, 1.0, 1.0, 1.04, 1.08, 1.12, 1.16],
  // Drawing only: at most this many boxes (or animals) are drawn in the truck; the rest is shown as "+N".
  PILE_VISIBLE_MAX: 36,
  // Scanner: standard deviation of the measurement noise on y (plot units), per level.
  // Never zero: some noise always remains.
  SCANNER_NOISE: [0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.043, 0.036, 0.03, 0.025, 0.02],
  // Noise on x is this fraction of the y noise.
  SCANNER_X_NOISE_FRACTION: 0.3,
  // Scanner: probability that a single measured unit is a glitch (outlier), per level.
  SCANNER_GLITCH: [0.125, 0.11, 0.095, 0.08, 0.066, 0.053, 0.04, 0.028, 0.017, 0.008, 0],
  // How far a glitch dot lands from its true value (plot units, random in this range).
  GLITCH_OFFSET: [0.22, 0.45],

  // ---------------------------------------------------------------- harvest
  // Number of units in the farmer's whole harvest (larger than the max sample 173 x 3 = 519).
  HARVEST_SIZE: 1000,
  // x values of the harvest are uniform in this range.
  HARVEST_X_RANGE: [0.06, 0.94],
  // Natural spread of the harvest around the hidden true line (plot units).
  // Interpolated from easy to hard as the player serves more farmers.
  NATURAL_NOISE_EASY: 0.035,
  NATURAL_NOISE_HARD: 0.07,
  // Number of farmers served until the difficulty reaches "hard".
  DIFFICULTY_RAMP_FARMERS: 15,
  // Hidden true line of each visit (except the first farmer). In reality every relationship is
  // positive (bigger -> heavier, more feed -> more milk). Each axis is drawn the normal way or
  // reversed ("+" on the left / at the bottom) with this probability, independently, so the line
  // on the plot falls in about half the rounds but always agrees with the axes.
  AXIS_FLIP_PROB: 0.5,
  // Steepness on the plot is uniform in this range (plot units: 1 = the line crosses the full plot
  // height across the plot), plus a random height, so the line can't be guessed from the labels.
  SLOPE_ABS_RANGE: [0.05, 0.84],
  // Both ends of the true line (x = 0 and x = 1) stay at least this far from the bottom/top of the plot.
  LINE_MARGIN: 0.08,
  // The very first farmer: easy, fixed line, no glitches, scanner noise scaled down.
  FIRST_FARMER: { intercept: 0.2, rightEnd: 0.8, scannerNoiseScale: 0.3, glitches: false },

  // ---------------------------------------------------------------- sliders
  // Slope slider maps linearly to the line's angle (in plot units), in degrees. Symmetric, so the
  // middle of the slider is a flat line. tan(50 deg) = 1.19 covers the steepest true line (0.84).
  SLOPE_ANGLE_RANGE: [-50, 50],
  // Intercept slider range (value of the line at the left edge, x = 0). True intercepts are in 0.08..0.92.
  INTERCEPT_RANGE: [-0.25, 1.25],
  // Starting position of the player's line for every farmer.
  START_ANGLE: 0,
  START_INTERCEPT: 0.5,

  // ---------------------------------------------------------------- timing (ms)
  TRUCK_ARRIVE_MS: 900,
  // The empty truck drives away when tapped.
  TRUCK_LEAVE_MS: 900,
  // Farmer walks to the truck and carries a crate to the belt. The truck can't be tapped meanwhile.
  CARRY_MS: 1000,
  // Farmer walks back from the belt; the truck becomes tappable again after this.
  RETURN_MS: 350,
  // Belt speed as a fraction of the scene width per second.
  BELT_SPEED: 0.38,
  // All products of one trip are put on the belt within this time (they bunch up on big trips).
  TRIP_UNLOAD_MS: 1200,
  // Reveal animation.
  REVEAL_HARVEST_MS: 600,
  REVEAL_RESIDUALS_MS: 1600,
  REVEAL_BEST_LINE_MS: 700,
  COIN_COUNT_MS: 280,          // per coin at most...
  COIN_COUNT_TOTAL_MS: 1400,   // ...and the whole count-up takes at most this long

  // ---------------------------------------------------------------- leaderboard
  // Leave empty to use the local stub. See SUPABASE_SETUP.md.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Minimum farmers served before a player appears on the "most precise" board.
  MIN_FARMERS_FOR_PRECISION: 5,
};
