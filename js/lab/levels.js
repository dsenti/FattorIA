// Minigame 3 (Il laboratorio): the hand-designed levels. EDIT HERE.
//
// The field is the unit square: x runs 0 (left, "−") to 1 (right, "+"), y runs 0 (bottom, "−")
// to 1 (top, "+"). The axes show no numbers.
//
// Each level:
//   id       stable id (saved progress refers to it; don't rename a level that players have passed)
//   title    short Italian title (the only text of the level, next to the legend)
//   x, y     the two measured properties (caratteristiche): { name, icon } (icon: an emoji, as in
//            the pesatura; drawn small at "−" and big at "+")
//   classes  the etichette (labels): names; class k is drawn in colour k of CLASS_COLOURS
//   tree     the TRUE tree, which makes the data. The player builds their own tree from scratch;
//            this one is only the benchmark ("l'albero migliore") and shows as the dashed
//            "confine vero" after a passing Prova.
//            cut(x1, y1, x2, y2, { left, right }) is a node: the boundary line through (x1, y1) and
//            (x2, y2). Walk from the first point to the second: `left` is what lies on your left,
//            `right` what lies on your right. Each side is another cut(...) or a class number.
//   noise    measurement noise of the level (field units, standard deviation), before the
//            "Strumento più preciso" upgrade (CONFIG.LAB.NOISE_FACTOR)
//   gap      (optional) no noiseless sample lies closer than this to another class: clean levels
//   samplesFactor (optional) training samples x this
//
// The data: a sample picks a region of the true tree (weighted, see CONFIG.LAB.REGION_WEIGHT_POWER),
// a noiseless position inside it, and the region's class as its etichetta; then the instrument
// adds measurement noise. `node tests/run.mjs` checks every level (the true tree passes, a careful
// copy of it passes, enough points per region, at most CONFIG.LAB.MAX_NODES - 1 lines).
// The mix is deliberate: some levels need one line only (1, 3, 7), others many (4, 6, 9, 10).
// TODO(Dominik): all themes, classes and axes are placeholders; pick the real ones per level.

// Bump when the levels change so much that saved progress no longer fits (see storage.js).
// 2: the player builds the tree (round 2); the fixed-shape boards of version 1 are dropped.
export const LAB_LEVELS_VERSION = 2;

// A node of a tree: { line, kids: [left side, right side] }. The player's tree uses the same shape.
export const cut = (x1, y1, x2, y2, { left, right }) => ({ line: { x1, y1, x2, y2 }, kids: [left, right] });

// Colour-blind-friendly (Okabe-Ito) colours, each with its own point shape as a second cue.
export const CLASS_COLOURS = [
  { fill: '#0072B2', shape: 'circle' },     // blue
  { fill: '#E69F00', shape: 'triangle' },   // orange
  { fill: '#009E73', shape: 'square' },     // bluish green
  { fill: '#CC79A7', shape: 'diamond' },    // reddish purple
  { fill: '#D55E00', shape: 'pentagon' },   // vermillion
];

// Corners (counter-clockwise) of the triangle (level 4) and the tilted square (level 6).
const TRI = [[0.18, 0.15], [0.86, 0.28], [0.44, 0.9]];
const SQ = [[0.351, 0.18], [0.82, 0.351], [0.649, 0.82], [0.18, 0.649]];
// cut() along a polygon edge from corner j to corner i: `left` is outside, `right` inside.
const edge = (P, i, j, sides) => cut(P[j][0], P[j][1], P[i][0], P[i][1], sides);

export const LAB_LEVELS = [
  {
    id: 'olive', title: 'Due olive',
    x: { name: 'grandezza', icon: '🫒' }, y: { name: 'olio nel frutto', icon: '💧' },
    classes: ['Caiazzana', 'Leccino'],
    tree: cut(0.12, 0.95, 0.86, 0.05, { left: 1, right: 0 }),
    noise: 0.02, gap: 0.075,
  },
  {
    id: 'latte', title: 'Tre latti',
    x: { name: 'grasso', icon: '🧈' }, y: { name: 'proteine', icon: '🧀' },
    classes: ['Mucca', 'Capra', 'Bufala'],
    tree: cut(0.58, 0.02, 0.04, 0.62, {
      left: 0,
      right: cut(0.98, 0.33, 0.33, 0.98, { left: 1, right: 2 }),
    }),
    noise: 0.022, gap: 0.05,
  },
  {
    id: 'uve', title: 'Pallagrello o Casavecchia?',
    x: { name: 'zucchero', icon: '🍬' }, y: { name: 'acidità', icon: '🍋' },
    classes: ['Pallagrello', 'Casavecchia'],
    tree: cut(0.05, 0.28, 0.95, 0.78, { left: 1, right: 0 }),
    noise: 0.055,
  },
  {
    id: 'castagno', title: 'Il triangolo del castagno',
    x: { name: 'umidità', icon: '💧' }, y: { name: 'acidità del terreno', icon: '🧪' },
    classes: ['Non adatto', 'Adatto al castagno'],
    tree: edge(TRI, 0, 1, {
      left: 0,
      right: edge(TRI, 1, 2, { left: 0, right: edge(TRI, 2, 0, { left: 0, right: 1 }) }),
    }),
    noise: 0.014, gap: 0.06,
  },
  {
    id: 'mieli', title: 'Quattro mieli',
    x: { name: 'colore', icon: '🍯' }, y: { name: 'umidità', icon: '💧' },
    classes: ['Acacia', 'Millefiori', 'Castagno', 'Sulla'],
    tree: cut(0.55, 0.0, 0.45, 1.0, {
      left: cut(0.0, 0.62, 0.5, 0.44, { left: 1, right: 0 }),
      right: cut(0.5, 0.34, 1.0, 0.6, { left: 3, right: 2 }),
    }),
    noise: 0.024, gap: 0.035,
  },
  {
    id: 'grotta', title: 'La grotta del caciocavallo',
    x: { name: 'temperatura', icon: '🌡️' }, y: { name: 'umidità', icon: '💧' },
    classes: ['Si rovina', 'Stagiona bene'],
    tree: edge(SQ, 0, 1, {
      left: 0,
      right: edge(SQ, 1, 2, {
        left: 0,
        right: edge(SQ, 2, 3, { left: 0, right: edge(SQ, 3, 0, { left: 0, right: 1 }) }),
      }),
    }),
    noise: 0.014, gap: 0.06,
  },
  {
    id: 'mosca', title: 'La mosca dell\'olivo',
    x: { name: 'temperatura', icon: '🌡️' }, y: { name: 'umidità', icon: '💧' },
    classes: ['Niente mosca', 'Mosca'],
    // One line is enough, but the data is noisy: extra lines around stray points only look good
    // on the training samples (imparare a memoria).
    tree: cut(0.12, 0.0, 0.78, 1.0, { left: 1, right: 0 }),
    noise: 0.085, samplesFactor: 0.8,
  },
  {
    id: 'api', title: 'Le arnie a forma di L',
    x: { name: 'peso dell\'arnia', icon: '🐝' }, y: { name: 'temperatura', icon: '🌡️' },
    classes: ['Sana', 'Da controllare', 'Piena di miele'],
    tree: cut(0.86, 1.0, 0.79, 0.0, {
      left: 2,
      right: cut(1.0, 0.43, 0.0, 0.36, {
        left: 1,
        right: cut(0.38, 0.0, 0.46, 1.0, { left: 1, right: 0 }),
      }),
    }),
    noise: 0.024, gap: 0.04,
  },
  {
    id: 'formaggi', title: 'Cinque formaggi',
    x: { name: 'stagionatura', icon: '🧀' }, y: { name: 'sale', icon: '🧂' },
    classes: ['Ricotta', 'Mozzarella', 'Caciocavallo', 'Pecorino', 'Provolone'],
    tree: cut(0.5, 0.0, 0.46, 1.0, {
      left: cut(0.5, 0.36, 0.0, 0.3, {
        left: 0,
        right: cut(0.5, 0.72, 0.0, 0.66, { left: 1, right: 2 }),
      }),
      right: cut(0.5, 0.1, 1.0, 0.6, {
        left: cut(0.62, 1.0, 1.0, 0.66, { left: 4, right: 1 }),
        right: 3,
      }),
    }),
    noise: 0.02, gap: 0.03, samplesFactor: 1.2,
  },
  {
    id: 'cooperativa', title: 'Il gran finale',
    x: { name: 'zucchero', icon: '🍬' }, y: { name: 'acidità', icon: '🍋' },
    classes: ['Pallagrello', 'Falanghina', 'Casavecchia', 'Aglianico', 'Piedirosso'],
    tree: cut(0.36, 0.0, 0.3, 1.0, {
      left: cut(0.36, 0.32, 0.0, 0.28, { left: 0, right: 1 }),
      right: cut(1.0, 0.34, 0.3, 0.3, {
        left: 0,
        right: cut(0.62, 1.0, 1.0, 0.58, {
          left: 2,
          right: cut(0.62, 0.3, 0.7, 1.0, {
            left: 3,
            right: cut(0.84, 0.3, 0.84, 1.0, { left: 4, right: 1 }),
          }),
        }),
      }),
    }),
    noise: 0.02, gap: 0.03, samplesFactor: 1.3,
  },
];
