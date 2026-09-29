// Minigame 3 (Il laboratorio): the hand-designed levels. EDIT HERE.
//
// The field is the unit square: x runs 0 (left, "−") to 1 (right, "+"), y runs 0 (bottom, "−")
// to 1 (top, "+"). The axes show no numbers.
//
// Each level:
//   id       stable id (saved progress refers to it; don't rename a level that players have passed)
//   title    short Italian title
//   story    one or two sentences shown above the field
//   x, y     the two measured properties (caratteristiche): { name, icon } (icon: an emoji, as in
//            the pesatura; drawn small at "−" and big at "+")
//   classes  the etichette (labels): names; class k is drawn in colour k of CLASS_COLOURS
//   tree     the TRUE tree: its shape is the tree the player fills in, its lines make the data.
//            cut(x1, y1, x2, y2, { left, right }) is a node: the boundary line through (x1, y1) and
//            (x2, y2). Walk from the first point to the second: `left` is what lies on your left,
//            `right` what lies on your right. Each side is another cut(...) or a leaf: a class
//            number. The left side is drawn as the left branch of the tree.
//            A "spare" node (overfitting level) has its line outside its region: every point of
//            the region lies on one side, so the node does nothing in the true tree.
//   noise    measurement noise of the level (field units, standard deviation), before the
//            "Strumento più preciso" upgrade (CONFIG.LAB.NOISE_FACTOR)
//   gap      (optional) no noiseless sample lies closer than this to another class: clean levels
//   overfit  (optional) the overfitting level: more nodes than the true boundary needs
//   samplesFactor (optional) training samples x this (fewer samples make learning by heart easier)
//
// The data: a sample picks a region of the true tree (weighted, see CONFIG.LAB.REGION_WEIGHT_POWER),
// a noiseless position inside it, and the region's class as its etichetta; then the instrument
// adds measurement noise to the position. So the classes overlap a little near the boundaries.
// `node tests/run.mjs` checks every level (true tree passes, enough points per region, the tree
// fits 360 px).
// TODO(Dominik): all themes, classes and axes are placeholders; pick the real ones per level.

// Bump when the levels change so much that saved progress no longer fits (see storage.js).
export const LAB_LEVELS_VERSION = 1;

export const cut = (x1, y1, x2, y2, { left, right }) => ({ line: { x1, y1, x2, y2 }, left, right });

// Colour-blind-friendly (Okabe-Ito) colours, each with its own point shape as a second cue.
export const CLASS_COLOURS = [
  { fill: '#0072B2', shape: 'circle' },     // blue
  { fill: '#E69F00', shape: 'triangle' },   // orange
  { fill: '#009E73', shape: 'square' },     // bluish green
  { fill: '#CC79A7', shape: 'diamond' },    // reddish purple
];

// Corners of the tilted square (level 6) and the triangle (level 4), counter-clockwise.
const SQ = [[0.377, 0.192], [0.828, 0.357], [0.664, 0.808], [0.212, 0.644]];
const TRI = [[0.25, 0.2], [0.8, 0.3], [0.45, 0.85]];
// cut() along a polygon edge from corner j to corner i: `left` is outside, `right` inside.
const edge = (P, i, j, sides) => cut(P[j][0], P[j][1], P[i][0], P[i][1], sides);

export const LAB_LEVELS = [
  {
    id: 'olive', title: 'Due olive',
    story: 'Al frantoio arrivano due varietà di olive. Ogni punto è un\'oliva misurata: una linea basta.',
    x: { name: 'grandezza', icon: '🫒' }, y: { name: 'olio nel frutto', icon: '💧' },
    classes: ['Caiazzana', 'Leccino'],
    tree: cut(0.12, 0.95, 0.86, 0.05, { left: 1, right: 0 }),
    noise: 0.022, gap: 0.075,
  },
  {
    id: 'uve', title: 'Pallagrello o Casavecchia?',
    story: 'Grappoli di due vitigni. Qui si mescolano un po\': nessuna linea li separa tutti.',
    x: { name: 'zucchero', icon: '🍬' }, y: { name: 'acidità', icon: '🍋' },
    classes: ['Pallagrello', 'Casavecchia'],
    tree: cut(0.05, 0.28, 0.95, 0.78, { left: 1, right: 0 }),
    noise: 0.055,
  },
  {
    id: 'latte', title: 'Tre latti',
    story: 'Latte di mucca, di capra e di bufala al caseificio. Due linee, tre strisce.',
    x: { name: 'grasso', icon: '🧈' }, y: { name: 'proteine', icon: '🧀' },
    classes: ['Mucca', 'Capra', 'Bufala'],
    tree: cut(0.58, 0.02, 0.04, 0.62, {
      left: 0,
      right: cut(0.98, 0.33, 0.33, 0.98, { left: 1, right: 2 }),
    }),
    noise: 0.03, gap: 0.035,
  },
  {
    id: 'castagno', title: 'Il triangolo del castagno',
    story: 'Campioni di terreno dal bosco. Il castagno cresce bene solo in un triangolo: tre linee.',
    x: { name: 'umidità', icon: '💧' }, y: { name: 'acidità del terreno', icon: '🧪' },
    classes: ['Non adatto', 'Adatto al castagno'],
    tree: edge(TRI, 0, 1, {
      left: 0,
      right: edge(TRI, 1, 2, { left: 0, right: edge(TRI, 2, 0, { left: 0, right: 1 }) }),
    }),
    noise: 0.028, gap: 0.03,
  },
  {
    id: 'castagne', title: 'Castagne in tre angoli',
    story: 'Castagne da farina, da mercato e marroni. La prima linea divide in due, poi ogni metà ha la sua.',
    x: { name: 'grandezza', icon: '🌰' }, y: { name: 'dolcezza', icon: '🍬' },
    classes: ['Da farina', 'Da mercato', 'Marroni'],
    tree: cut(0.52, 0.0, 0.44, 1.0, {
      left: cut(0.4, 0.0, 0.0, 0.58, { left: 0, right: 1 }),
      right: cut(1.0, 0.42, 0.56, 1.0, { left: 1, right: 2 }),
    }),
    noise: 0.032, gap: 0.02,
  },
  {
    id: 'grotta', title: 'La grotta del caciocavallo',
    story: 'Il caciocavallo stagiona bene solo in un quadrato un po\' storto: quattro linee.',
    x: { name: 'temperatura', icon: '🌡️' }, y: { name: 'umidità', icon: '💧' },
    classes: ['Si rovina', 'Stagiona bene'],
    tree: edge(SQ, 0, 1, {
      left: 0,
      right: edge(SQ, 1, 2, {
        left: 0,
        right: edge(SQ, 2, 3, { left: 0, right: edge(SQ, 3, 0, { left: 0, right: 1 }) }),
      }),
    }),
    noise: 0.026, gap: 0.03,
  },
  {
    id: 'api', title: 'Le arnie a forma di L',
    story: 'L\'apicoltore pesa le arnie e ne misura la temperatura. Quelle da controllare formano una L.',
    x: { name: 'peso dell\'arnia', icon: '🐝' }, y: { name: 'temperatura', icon: '🌡️' },
    classes: ['Sana', 'Da controllare'],
    tree: cut(0.86, 1.0, 0.79, 0.0, {
      left: 0,
      right: cut(1.0, 0.43, 0.0, 0.36, {
        left: 1,
        right: cut(0.38, 0.0, 0.46, 1.0, { left: 1, right: 0 }),
      }),
    }),
    noise: 0.028, gap: 0.03,
  },
  {
    id: 'mieli', title: 'Quattro mieli',
    story: 'Quattro mieli del Matese. Una linea divide i chiari dagli scuri, poi ogni metà si divide ancora.',
    x: { name: 'colore', icon: '🍯' }, y: { name: 'umidità', icon: '💧' },
    classes: ['Acacia', 'Millefiori', 'Castagno', 'Sulla'],
    tree: cut(0.55, 0.0, 0.45, 1.0, {
      left: cut(0.0, 0.62, 0.5, 0.44, { left: 1, right: 0 }),
      right: cut(0.5, 0.34, 1.0, 0.6, { left: 3, right: 2 }),
    }),
    noise: 0.03, gap: 0.025,
  },
  {
    id: 'mosca', title: 'La mosca dell\'olivo',
    story: 'Ogni punto è una giornata nell\'uliveto: la trappola ha preso la mosca? Misure rumorose, e più nodi del necessario: non tutti devono tagliare.',
    x: { name: 'temperatura', icon: '🌡️' }, y: { name: 'umidità', icon: '💧' },
    classes: ['Niente mosca', 'Mosca'],
    // One true line; the other four nodes are spare (their lines lie in a corner outside their
    // region). Few, noisy samples: lines around stray points look good on training only.
    tree: cut(0.12, 0.0, 0.78, 1.0, {
      left: cut(0.9, 0.0, 1.0, 0.12, { left: cut(0.95, 0.0, 1.0, 0.06, { left: 1, right: 0 }), right: 0 }),
      right: cut(0.0, 0.88, 0.12, 1.0, { left: 1, right: cut(0.0, 0.94, 0.06, 1.0, { left: 1, right: 0 }) }),
    }),
    noise: 0.1, overfit: true, samplesFactor: 0.6,
  },
  {
    id: 'cooperativa', title: 'Il gran finale',
    story: 'Quattro uve della cooperativa. A sinistra una L, a destra un angolo e una striscia: cinque linee.',
    x: { name: 'zucchero', icon: '🍬' }, y: { name: 'acidità', icon: '🍋' },
    classes: ['Pallagrello bianco', 'Pallagrello nero', 'Casavecchia', 'Aglianico'],
    tree: cut(0.52, 0.0, 0.46, 1.0, {
      left: cut(0.5, 0.33, 0.0, 0.27, {
        left: 0,
        right: cut(0.2, 0.0, 0.25, 1.0, { left: 0, right: 1 }),
      }),
      right: cut(0.5, 0.47, 1.0, 0.36, {
        left: cut(0.6, 1.0, 1.0, 0.6, { left: 2, right: 1 }),
        right: 3,
      }),
    }),
    noise: 0.026, gap: 0.025,
  },
];
