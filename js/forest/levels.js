// Minigame "Il bosco": the trails. Every trail has patches of porcini (good) and of poisonous
// mushrooms (bad) on the guide board: x = how wide the cap is, y = how thick the stem is (0..1).
// A patch: { c: 'good' | 'bad', x, y, sx, sy, rot }. known = mushrooms already on the board per
// patch; n = mushrooms you find on the trail; seconds = time for each; tricks = how many found
// mushrooms may disagree with their neighbours (bad luck: the neighbours can be wrong).
// TODO(Dominik): the features (cap and stem) are made up for the game; real foragers check more.
export const FOREST_VERSION = 1;

const P = (c, x, y, sx, sy = sx, rot = 0) => ({ c, x, y, sx, sy, rot });

export const FOREST_LEVELS = [
  { id: 'sentiero', n: 8, known: 7, seconds: 7, tricks: 0, patches: [P('good', 0.7, 0.66, 0.08), P('bad', 0.3, 0.32, 0.08)] },
  { id: 'radura', n: 10, known: 7, seconds: 6, tricks: 0, patches: [P('good', 0.64, 0.6, 0.1), P('bad', 0.36, 0.4, 0.1)] },
  { id: 'faggeta', n: 10, known: 8, seconds: 5.5, tricks: 0, patches: [P('good', 0.58, 0.42, 0.2, 0.06, 0.8), P('bad', 0.42, 0.62, 0.2, 0.06, 0.8)] },
  { id: 'macchie', n: 10, known: 5, seconds: 5, tricks: 0, patches: [P('good', 0.25, 0.72, 0.08), P('good', 0.75, 0.28, 0.08), P('bad', 0.5, 0.5, 0.09), P('bad', 0.8, 0.8, 0.07)] },
  { id: 'nebbia', n: 12, known: 9, seconds: 4.5, tricks: 1, patches: [P('good', 0.58, 0.56, 0.13), P('bad', 0.4, 0.42, 0.13)] },
  { id: 'notte', n: 12, known: 5, seconds: 4, tricks: 1, patches: [P('good', 0.2, 0.3, 0.07), P('good', 0.55, 0.75, 0.08), P('good', 0.82, 0.4, 0.07), P('bad', 0.45, 0.35, 0.08), P('bad', 0.8, 0.78, 0.07), P('bad', 0.2, 0.72, 0.07)] },
];
