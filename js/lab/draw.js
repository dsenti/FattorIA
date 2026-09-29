// Minigame 3: canvas drawing of the field (axes, regions, points, lines, handles) and the small
// SVG pieces (class shapes, node thumbnails, icons). No emoji in the SVG art; the axes use emoji
// icons like the pesatura.
import { CLASS_COLOURS } from './levels.js';
import { UNIT_SQUARE, clipBranch, isSet, lineInPoly } from './model.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const C = {
  soil: '#5B3A29', olive: '#6B7F2A', wheat: '#E9D8A6', cream: '#FBF7EF', tomato: '#D9502B', sky: '#4A8FA3',
  ink: '#3A2519', grid: 'rgba(91,58,41,0.08)', ok: '#3E7D32', gold: '#F4C95D',
};

export const colourOf = (cls) => (cls == null ? '#B9AE9A' : CLASS_COLOURS[cls].fill);
export const shapeOf = (cls) => (cls == null ? 'circle' : CLASS_COLOURS[cls].shape);

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
// A desaturated, lighter version of a colour: still readable, clearly "not picked".
export function muted(hex) {
  const [r, g, b] = hexRgb(hex);
  const grey = 0.3 * r + 0.59 * g + 0.11 * b;
  const m = (v) => Math.round(0.35 * v + 0.35 * grey + 0.3 * 200);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: r.width, H: r.height };
}

// Field geometry in CSS pixels: the plot area, with room for the axes (as in the pesatura).
export function fieldGeom(W, H) {
  const L = 42, R = W - 16, T = 24, B = H - 32;
  return {
    L, R, T, B, W, H,
    px: (x) => L + x * (R - L), py: (y) => B - y * (B - T),
    fx: (X) => (X - L) / (R - L), fy: (Y) => (B - Y) / (B - T),
  };
}

export function tracePoly(ctx, g, poly) {
  poly.forEach((p, i) => (i ? ctx.lineTo(g.px(p[0]), g.py(p[1])) : ctx.moveTo(g.px(p[0]), g.py(p[1]))));
  ctx.closePath();
}

export function drawBackground(ctx, g) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(g.L, g.T, g.R - g.L, g.B - g.T);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(g.px(i / 5), g.T); ctx.lineTo(g.px(i / 5), g.B); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.L, g.py(i / 5)); ctx.lineTo(g.R, g.py(i / 5)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(91,58,41,0.25)';
  ctx.strokeRect(g.L + 0.5, g.T + 0.5, g.R - g.L - 1, g.B - g.T - 1);
}

// Axes without numbers: "−" and a small icon at the low end, "+", a big icon and an arrowhead at
// the high end; the quantity names at the top (y) and under the axis (x). Like the pesatura.
export function drawAxes(ctx, g, level) {
  const { L, R, T, B } = g;
  const ax = L - 16, ay = B + 10;
  const arrow = (x, y, dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * 9 - dy * 5, y - dy * 9 - dx * 5);
    ctx.lineTo(x - dx * 9 + dy * 5, y - dy * 9 + dx * 5);
    ctx.closePath(); ctx.fill();
  };
  const sign = (txt, x, y) => { ctx.font = `800 15px ${FONT}`; ctx.fillText(txt, x, y); };
  const icon = (big, ch, x, y) => { ctx.font = `${big ? 18 : 11}px ${FONT}`; ctx.fillText(ch, x, y); };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.soil; ctx.fillStyle = C.soil;
  // vertical axis
  ctx.beginPath(); ctx.moveTo(ax, T - 4); ctx.lineTo(ax, B + 2); ctx.stroke();
  arrow(ax, T - 12, 0, -1);
  const gx = 12;
  sign('+', gx, T - 6);
  icon(true, level.y.icon, gx, T + 12);
  icon(false, level.y.icon, gx, B - 12);
  sign('−', gx, B + 6);
  // horizontal axis
  ctx.beginPath(); ctx.moveTo(L - 2, ay); ctx.lineTo(R + 2, ay); ctx.stroke();
  arrow(R + 10, ay, 1, 0);
  const row = ay + 13;
  sign('−', L + 2, row);
  icon(false, level.x.icon, L + 18, row);
  icon(true, level.x.icon, R - 14, row);
  sign('+', R + 4, row);
  // quantity names
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${level.y.name} ${level.y.icon}`, L + 2, T - 13);
  ctx.textAlign = 'center';
  ctx.fillText(`${level.x.name} ${level.x.icon}`, (L + R) / 2, row);
  ctx.textBaseline = 'alphabetic';
}

// A class shape (circle, triangle, square, diamond) of about radius r.
export function shapePath(ctx, shape, x, y, r) {
  ctx.beginPath();
  if (shape === 'triangle') {
    const k = r * 1.3;
    ctx.moveTo(x, y - k); ctx.lineTo(x + k * 0.866, y + k * 0.5); ctx.lineTo(x - k * 0.866, y + k * 0.5); ctx.closePath();
  } else if (shape === 'square') {
    const k = r * 0.88;
    ctx.rect(x - k, y - k, 2 * k, 2 * k);
  } else if (shape === 'diamond') {
    const k = r * 1.25;
    ctx.moveTo(x, y - k); ctx.lineTo(x + k, y); ctx.lineTo(x, y + k); ctx.lineTo(x - k, y); ctx.closePath();
  } else ctx.arc(x, y, r, 0, Math.PI * 2);
}

// Points. opts: { r, style(p) -> { fill, alpha, outline } | null (skip) }
export function drawPoints(ctx, g, pts, { r = 4.5, style } = {}) {
  ctx.lineJoin = 'round';
  for (const p of pts) {
    const st = style ? style(p) : {};
    if (!st) continue;
    const X = g.px(p.x), Y = g.py(p.y);
    ctx.globalAlpha = st.alpha ?? 1;
    shapePath(ctx, shapeOf(p.cls), X, Y, st.r ?? r);
    ctx.fillStyle = st.fill || colourOf(p.cls);
    ctx.fill();
    ctx.strokeStyle = st.outline || '#fff';
    ctx.lineWidth = st.outlineW || 1.2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Soft regions in the colour they predict.
export function drawRegions(ctx, g, regs, alpha = 0.2) {
  for (const r of regs) {
    if (r.cls == null) continue;
    ctx.fillStyle = rgba(colourOf(r.cls), r.done ? alpha : alpha * 0.55);
    ctx.beginPath(); tracePoly(ctx, g, r.poly); ctx.fill();
  }
}

// A node's line piece with its number in a small round label.
export function drawCut(ctx, g, seg, label, { colour = C.soil, width = 2.5, dash = null, labelAt = 0.5 } = {}) {
  const [a, b] = seg;
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(g.px(a[0]), g.py(a[1])); ctx.lineTo(g.px(b[0]), g.py(b[1])); ctx.stroke();
  ctx.setLineDash([]);
  if (label == null) return;
  const X = g.px(a[0] + (b[0] - a[0]) * labelAt), Y = g.py(a[1] + (b[1] - a[1]) * labelAt);
  numberBadge(ctx, X, Y, label, colour);
}

export function numberBadge(ctx, X, Y, label, colour = C.soil) {
  ctx.fillStyle = C.cream; ctx.strokeStyle = colour; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X, Y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = colour; ctx.font = `800 11px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(label), X, Y + 0.5);
  ctx.textBaseline = 'alphabetic';
}

// Round draggable handle at the end of the player's line.
export function drawHandle(ctx, X, Y, active) {
  const rad = active ? 13 : 11;
  if (active) { ctx.fillStyle = 'rgba(217,80,43,0.22)'; ctx.beginPath(); ctx.arc(X, Y, 24, 0, 7); ctx.fill(); }
  ctx.fillStyle = C.tomato; ctx.strokeStyle = '#fff'; ctx.lineWidth = active ? 4 : 3;
  ctx.beginPath(); ctx.arc(X, Y, rad, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.soil; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(X, Y, rad + 2, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(X, Y, 3, 0, 7); ctx.fill();
}

// A test sample's mark: a tick (right) or a cross (wrong), next to the point.
export function drawMark(ctx, X, Y, ok, s = 1) {
  const x = X + 6, y = Y - 6;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, 5.5 * s, 0, 7); ctx.fill();
  ctx.strokeStyle = ok ? C.ok : C.tomato; ctx.lineWidth = 2 * s;
  ctx.beginPath();
  if (ok) { ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 0.8 * s, y + 2.4 * s); ctx.lineTo(x + 3.2 * s, y - 2.6 * s); }
  else { ctx.moveTo(x - 2.6 * s, y - 2.6 * s); ctx.lineTo(x + 2.6 * s, y + 2.6 * s); ctx.moveTo(x + 2.6 * s, y - 2.6 * s); ctx.lineTo(x - 2.6 * s, y + 2.6 * s); }
  ctx.stroke();
}

// A small pill label drawn on the field (e.g. "foglia" or "nodo 3" on a side of the line).
export function pill(ctx, X, Y, cls, text) {
  ctx.font = `700 12px ${FONT}`;
  const w = ctx.measureText(text).width + 30, h = 22;
  const x = X - w / 2, y = Y - h / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = colourOf(cls); ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 11); ctx.fill(); ctx.stroke();
  shapePath(ctx, shapeOf(cls), x + 12, Y, 5);
  ctx.fillStyle = colourOf(cls); ctx.fill();
  ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 21, Y + 0.5);
  ctx.textBaseline = 'alphabetic';
}

// Rounded rectangle path (plain rectangle on browsers without roundRect).
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// ------------------------------------------------------------------ SVG pieces
const S = `stroke="${C.soil}" stroke-width="1.6" stroke-linejoin="round"`;

// A class shape as SVG, centred at (x, y).
export function shapeSVG(cls, x, y, r, extra = '') {
  const f = colourOf(cls), sh = shapeOf(cls);
  const n = (v) => v.toFixed(1);
  if (sh === 'triangle') { const k = r * 1.3; return `<path d="M${n(x)} ${n(y - k)}L${n(x + k * 0.866)} ${n(y + k * 0.5)}L${n(x - k * 0.866)} ${n(y + k * 0.5)}Z" fill="${f}" ${extra}/>`; }
  if (sh === 'square') { const k = r * 0.88; return `<rect x="${n(x - k)}" y="${n(y - k)}" width="${n(2 * k)}" height="${n(2 * k)}" fill="${f}" ${extra}/>`; }
  if (sh === 'diamond') { const k = r * 1.25; return `<path d="M${n(x)} ${n(y - k)}L${n(x + k)} ${n(y)}L${n(x)} ${n(y + k)}L${n(x - k)} ${n(y)}Z" fill="${f}" ${extra}/>`; }
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${f}" ${extra}/>`;
}

// A standalone inline <svg> with one class shape (for chips, legends and counts).
export const shapeIcon = (cls, size = 14) =>
  `<svg class="l-shape" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${shapeSVG(cls, 10, 10.6, 6.2, 'stroke="#fff" stroke-width="1"')}</svg>`;

// Node thumbnail: the node's region inside the field (the rest greyed), the two sides tinted
// with the node's colours, and its line. `size` px square, top-left at (x, y).
export function thumbSVG(region, spec, x, y, size) {
  const P = (p) => `${(x + p[0] * size).toFixed(1)} ${(y + (1 - p[1]) * size).toFixed(1)}`;
  const path = (poly) => (poly.length ? `M${poly.map(P).join('L')}Z` : '');
  let s = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="3" fill="#D9D2C3"/>`;
  const poly = region || UNIT_SQUARE;
  s += `<path d="${path(poly)}" fill="#fff"/>`;
  if (isSet(spec)) {
    for (let b = 0; b < 2; b++) {
      const p = clipBranch(poly, spec, b);
      if (p.length) s += `<path d="${path(p)}" fill="${colourOf(spec.c[b])}" fill-opacity=".38"/>`;
    }
    const seg = lineInPoly(spec, poly);
    if (seg) s += `<path d="M${P(seg[0])}L${P(seg[1])}" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>`;
  }
  s += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="3" fill="none" stroke="${C.soil}" stroke-opacity=".35"/>`;
  return s;
}

// Icons (40 x 40 art, like the smistamento's ICON).
export const LAB_ICON = {
  // map place: a small field with two colours of points and a boundary line
  place: `<rect x="3" y="3" width="34" height="34" rx="5" fill="#fff" ${S}/>` +
    `<path d="M4 30L36 9V36H4Z" fill="#E69F00" fill-opacity=".25"/><path d="M4 4H36V9L4 30Z" fill="#0072B2" fill-opacity=".22"/>` +
    `<path d="M4 30L36 9" stroke="${C.soil}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<g fill="#0072B2"><circle cx="10" cy="11" r="2.6"/><circle cx="17" cy="15" r="2.6"/><circle cx="9" cy="20" r="2.6"/><circle cx="24" cy="9" r="2.6"/></g>` +
    `<g fill="#E69F00"><path d="M27 20L30 25H24Z"/><path d="M19 27L22 32H16Z"/><path d="M30 29L33 34H27Z"/><path d="M12 31L15 36H9Z"/></g>`,
  // swap the two colours: a circle and a triangle trading places
  swap: `<circle cx="8" cy="20" r="5.5" fill="#0072B2"/><path d="M32 14L38 24H26Z" fill="#E69F00"/>` +
    `<path d="M13 12Q20 5 27 11M24 7.5L27.5 11.5L22.5 12.5" fill="none" stroke="${C.soil}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M27 29Q20 36 13 30M16 33.5L12.5 29.5L17.5 28.5" fill="none" stroke="${C.soil}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  // the next nodes trade sides: two small node boxes and arrows across a dashed line
  turn: `<path d="M20 3V37" stroke="${C.soil}" stroke-width="2" stroke-dasharray="3 3"/>` +
    `<rect x="2" y="14" width="12" height="12" rx="3" fill="#fff" stroke="${C.soil}" stroke-width="2"/><rect x="26" y="14" width="12" height="12" rx="3" fill="#fff" stroke="${C.soil}" stroke-width="2"/>` +
    `<path d="M8 11Q20 1 32 11M28 6.5L32.5 11L27 12" fill="none" stroke="${C.tomato}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M32 29Q20 39 8 29M12 33.5L7.5 29L13 28" fill="none" stroke="${C.tomato}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  // start the level again: a circular arrow
  restart: `<path d="M31 21A11 11 0 1 1 27.5 12.5" fill="none" stroke="${C.soil}" stroke-width="3.4" stroke-linecap="round"/><path d="M29 5L28.5 13.5L20 13" fill="none" stroke="${C.soil}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  // more samples: a rack of test tubes
  samples: `<rect x="4" y="22" width="32" height="5" rx="2" fill="${C.soil}"/>` +
    [8, 16, 24, 32].map((x, i) => `<rect x="${x - 3}" y="6" width="6" height="26" rx="3" fill="#fff" ${S}/><rect x="${x - 2}" y="${16 + (i % 2) * 3}" width="4" height="${14 - (i % 2) * 3}" rx="2" fill="${['#0072B2', '#E69F00', '#009E73', '#CC79A7'][i]}"/>`).join('') +
    `<rect x="4" y="32" width="32" height="4" rx="2" fill="${C.soil}"/>`,
  // a more precise instrument: a lens over a sharp target
  precision: `<circle cx="17" cy="17" r="11" fill="#CFE6EC" stroke="${C.soil}" stroke-width="3.2"/><circle cx="17" cy="17" r="5.5" fill="none" stroke="${C.tomato}" stroke-width="2"/><circle cx="17" cy="17" r="1.8" fill="${C.tomato}"/>` +
    `<path d="M25 25L35 35" stroke="${C.soil}" stroke-width="5" stroke-linecap="round"/>`,
};
