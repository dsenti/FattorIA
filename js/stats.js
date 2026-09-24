// Small maths helpers. Lines are y = a + b * x (a = intercept, b = slope).

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// Standard normal random number (Box-Muller).
export function randn() {
  let u = 0;
  while (u === 0) u = Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ordinary least squares fit. pts: [{x, y}]
export function leastSquares(pts) {
  const n = pts.length;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

export function meanAbsError(pts, line) {
  let s = 0;
  for (const p of pts) s += Math.abs(p.y - (line.a + line.b * p.x));
  return s / pts.length;
}
