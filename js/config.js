// All tunable numbers for the game live here.
// Plot coordinates are normalised: x and y both run from 0 (left/bottom) to 1 (right/top).
// Arrays indexed by level have 11 entries: level 0 ... level 10.

export const CONFIG = {
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
  SCORE_THRESHOLDS: [
    { maxRatio: 1.05, coins: 5 },
    { maxRatio: 1.2, coins: 4 },
    { maxRatio: 1.5, coins: 3 },
    { maxRatio: 2.0, coins: 2 },
    { maxRatio: 3.0, coins: 1 },
  ],

  // Farmer reaction emoji by coins paid (index = coins 0..5).
  REACTIONS: ['😐', '😐', '🙂', '🙂', '😄', '😄'],

  // A "day done" summary appears after this many farmers.
  FARMERS_PER_DAY: 5,

  // ---------------------------------------------------------------- upgrades
  // Belt: units (crates' content / animals) per tap on the truck, per level.
  BELT_UNITS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  // Truck: crates (or trips for animals) per farmer, per level.
  TRUCK_CRATES: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
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
  // Number of units in the farmer's whole harvest (larger than the max sample 13 x 11).
  HARVEST_SIZE: 200,
  // x values of the harvest are uniform in this range.
  HARVEST_X_RANGE: [0.06, 0.94],
  // Natural spread of the harvest around the hidden true line (plot units).
  // Interpolated from easy to hard as the player serves more farmers.
  NATURAL_NOISE_EASY: 0.035,
  NATURAL_NOISE_HARD: 0.07,
  // Number of farmers served until the difficulty reaches "hard".
  DIFFICULTY_RAMP_FARMERS: 15,
  // Probability of a "tricky" line (very small intercept + steep, or very shallow) at full difficulty.
  TRICKY_LINE_PROB: 0.5,
  // The very first farmer: easy, fixed line, no glitches, scanner noise scaled down.
  FIRST_FARMER: { intercept: 0.2, rightEnd: 0.8, scannerNoiseScale: 0.3, glitches: false },

  // ---------------------------------------------------------------- sliders
  // Slope slider maps linearly to the line's angle (in plot units), in degrees.
  SLOPE_ANGLE_RANGE: [-35, 70],
  // Intercept slider range (value of the line at the left edge, x = 0).
  INTERCEPT_RANGE: [-0.3, 1.1],
  // Starting position of the player's line for every farmer.
  START_ANGLE: 0,
  START_INTERCEPT: 0.5,

  // ---------------------------------------------------------------- timing (ms)
  TRUCK_ARRIVE_MS: 900,
  // Farmer walks to the truck and carries a crate to the belt. The truck can't be tapped meanwhile.
  CARRY_MS: 1000,
  // Farmer walks back from the belt; the truck becomes tappable again after this.
  RETURN_MS: 350,
  // Belt speed as a fraction of the scene width per second.
  BELT_SPEED: 0.38,
  // Reveal animation.
  REVEAL_HARVEST_MS: 600,
  REVEAL_RESIDUALS_MS: 1600,
  REVEAL_BEST_LINE_MS: 700,
  COIN_COUNT_MS: 280,

  // ---------------------------------------------------------------- leaderboard
  // Leave empty to use the local stub. See SUPABASE_SETUP.md.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Minimum farmers served before a player appears on the "most precise" board.
  MIN_FARMERS_FOR_PRECISION: 5,
};
