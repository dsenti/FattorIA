// Minigame 4: Il pascolo. THE LEVELS. Edit here.
//
// The pasture is a unit square (x to the right, y down). Each herd has a colour (the paint mark on
// its sheep and the bandana of its dog: r red, b blue, y yellow, p purple), a size n, a centre
// (x, y), a spread (sx, sy) and a turn (rot, radians), plus a few `strays` far away that pull the
// middle of the herd. The player drags each dog to the middle (the mean) of its herd; a dog
// counts when it is within `tol` of it. Easy at the start, overlapping herds at the end.
// Level ids are saved in the players' progress: don't rename a played level.
export const HERD_LEVELS_VERSION = 1;

const h = (c, n, x, y, sx, sy, rot = 0, strays = 0) => ({ c, n, x, y, sx, sy, rot, strays });

export const HERD_LEVELS = [
  { id: 'primo', tol: 0.075, herds: [h('r', 10, 0.5, 0.5, 0.07, 0.06)] },
  { id: 'due', tol: 0.07, herds: [h('r', 10, 0.28, 0.32, 0.07, 0.06), h('b', 10, 0.72, 0.7, 0.07, 0.06)] },
  { id: 'lunghi', tol: 0.065, herds: [h('r', 11, 0.3, 0.62, 0.14, 0.035, 0.5), h('b', 11, 0.7, 0.32, 0.035, 0.14)] },
  { id: 'tre', tol: 0.065, herds: [h('r', 10, 0.25, 0.28, 0.07, 0.06), h('b', 10, 0.75, 0.3, 0.07, 0.06), h('y', 10, 0.5, 0.75, 0.07, 0.06)] },
  { id: 'fuggiasche', tol: 0.06, herds: [h('r', 11, 0.3, 0.4, 0.06, 0.06, 0, 3), h('b', 10, 0.72, 0.72, 0.07, 0.06)] },
  { id: 'vicini', tol: 0.06, herds: [h('r', 10, 0.32, 0.35, 0.08, 0.07), h('b', 10, 0.62, 0.45, 0.08, 0.07), h('y', 10, 0.45, 0.72, 0.08, 0.06)] },
  { id: 'misti', tol: 0.055, herds: [h('r', 12, 0.42, 0.5, 0.12, 0.08), h('b', 12, 0.58, 0.48, 0.1, 0.11)] },
  { id: 'quattro', tol: 0.055, herds: [h('r', 14, 0.27, 0.27, 0.08, 0.07), h('b', 6, 0.73, 0.3, 0.05, 0.05), h('y', 9, 0.3, 0.74, 0.07, 0.07), h('p', 12, 0.7, 0.72, 0.09, 0.06)] },
  { id: 'nebbia', tol: 0.05, herds: [h('r', 12, 0.4, 0.42, 0.12, 0.1), h('b', 12, 0.56, 0.52, 0.12, 0.1), h('y', 10, 0.46, 0.64, 0.1, 0.08, 0, 2)] },
  { id: 'tempesta', tol: 0.05, herds: [h('r', 12, 0.38, 0.4, 0.15, 0.05, 0.6, 2), h('b', 11, 0.6, 0.42, 0.05, 0.15, 0.2), h('y', 10, 0.45, 0.62, 0.13, 0.06, -0.4, 1), h('p', 12, 0.58, 0.6, 0.1, 0.1)] },
];
