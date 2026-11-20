// Minigame 3: Il frutteto. THE LEVELS. Edit here.
//
// The orchard is a unit square (x to the right, y down). Each level has fruit trees and goats.
// zone(x, y) says where the trees belong ('tree') and where the goats graze ('goat'); `lines` are
// the true fence lines (x1, y1, x2, y2): fences along them always solve the level, and items keep
// a `gap` away from them. `fences`: how many fences the player may swipe; `noise`: animals or
// trees on the "wrong" side that no fence can fix; `pass`: share of the orchard that must be
// right. Level ids are saved in the players' progress: don't rename a played level.
export const ORCHARD_LEVELS_VERSION = 1;

const V = (x) => [x, 0, x, 1];
const Hz = (y) => [0, y, 1, y];
const above = (l, x, y) => (l[2] - l[0]) * (y - l[1]) - (l[3] - l[1]) * (x - l[0]) < 0;   // left of l (y down)

export const ORCHARD_LEVELS = [
  { id: 'meta', n: 14, fences: 1, noise: 0, pass: 0.9, lines: [V(0.5)], zone: (x) => (x < 0.5 ? 'tree' : 'goat') },
  { id: 'sopra', n: 14, fences: 1, noise: 0, pass: 0.9, lines: [Hz(0.45)], zone: (x, y) => (y < 0.45 ? 'tree' : 'goat') },
  { id: 'storto', n: 16, fences: 1, noise: 0, pass: 0.9, lines: [[0, 0.15, 1, 0.85]], zone: (x, y) => (y < 0.15 + 0.7 * x ? 'tree' : 'goat') },
  { id: 'ripido', n: 16, fences: 1, noise: 1, pass: 0.88, lines: [[0.25, 0, 0.7, 1]], zone: (x, y) => (x < 0.25 + 0.45 * y ? 'tree' : 'goat') },
  { id: 'angolo', n: 18, fences: 2, noise: 0, pass: 0.9, lines: [V(0.55), Hz(0.5)], zone: (x, y) => (x < 0.55 && y < 0.5 ? 'tree' : 'goat') },
  { id: 'striscia', n: 18, fences: 2, noise: 0, pass: 0.9, lines: [Hz(0.33), Hz(0.67)], zone: (x, y) => (y > 0.33 && y < 0.67 ? 'tree' : 'goat') },
  {
    id: 'cuneo', n: 20, fences: 2, noise: 1, pass: 0.88, lines: [[0.2, 0, 0.65, 1], [0, 0.75, 1, 0.3]],
    zone: (x, y) => (x < 0.2 + 0.45 * y && y < 0.75 - 0.45 * x ? 'tree' : 'goat'),
  },
  { id: 'vento', n: 22, fences: 1, noise: 3, pass: 0.84, lines: [[0, 0.8, 1, 0.2]], zone: (x, y) => (y > 0.8 - 0.6 * x ? 'tree' : 'goat') },
  {
    id: 'triangolo', n: 20, fences: 3, noise: 0, pass: 0.88, gap: 0.04,
    lines: [[0.5, 0.12, 0.12, 0.88], [0.12, 0.88, 0.88, 0.88], [0.88, 0.88, 0.5, 0.12]],
    zone: (x, y) => {
      const L = [[0.5, 0.12, 0.12, 0.88], [0.12, 0.88, 0.88, 0.88], [0.88, 0.88, 0.5, 0.12]];
      return L.every((l) => above(l, x, y)) ? 'tree' : 'goat';
    },
  },
  { id: 'scacchi', n: 22, fences: 2, noise: 1, pass: 0.86, lines: [V(0.5), Hz(0.5)], zone: (x, y) => ((x < 0.5) === (y < 0.5) ? 'tree' : 'goat') },
];
