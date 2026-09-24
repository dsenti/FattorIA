// The pseudo-3D pile of boxes (or animals) in the vehicle's bed.
// `cols` wide (3..6, from the bed width), `depth` rows deep (back rows drawn up and to the right),
// and as many layers (crates) or decks (animals) as needed. The layout depends only on the
// capacity (capped at PILE_VISIBLE_MAX), so the pile doesn't jump as it shrinks.
// Crates are filled front row first (bottom to top), so the farmer takes them from the back
// row first, top to bottom, and the front of the pile stays full until the end.
// Animals are filled back row first, so the front-most ones are led out first.
import { CONFIG } from '../config.js';
import { C, FONT, drawBox } from './draw.js';

export function pileLayout(capacity, animal, bx, bw, floorY, maxH) {
  const n = Math.max(1, Math.min(capacity, CONFIG.PILE_VISIBLE_MAX));
  const cols = n <= 3 ? Math.max(2, n) : Math.max(3, Math.min(6, Math.round(bw / 24)));
  const depth = n <= cols ? 1 : n <= cols * 4 ? 2 : 3;
  const layers = Math.max(1, Math.ceil(n / (cols * depth)));
  const perRow = cols * layers;
  let cw = (bw - 2) / (cols + (depth - 1) * 0.4);
  let ch = animal ? cw * 0.95 : cw * 0.62;
  let dx = cw * 0.4, dy = animal ? ch * 0.28 : ch * 0.5;
  // Total height including the top faces of the top layer and the produce lying on top.
  const full = layers * ch + depth * dy + (animal ? 0 : ch * 0.8);
  const k = Math.min(1, maxH / full);
  cw *= k; ch *= k; dx *= k; dy *= k;
  const pos = (i) => {
    const r = Math.floor(i / perRow), j = i % perRow;
    const row = animal ? depth - 1 - r : r;   // 0 = front
    const layer = Math.floor(j / cols), col = j % cols;
    return { layer, row, col, x: bx + 1 + col * cw + row * dx, y: floorY - layer * ch - row * dy };
  };
  return { cap: n, cols, depth, layers, cw, ch, dx, dy, pos, height: layers * ch + (depth - 1) * dy };
}

// capacity and shown are counted in drawn items: boxes for crops, animals for livestock.
export function drawPile(ctx, unit, animal, capacity, shown, bx, bw, floorY, maxH) {
  const L = pileLayout(capacity, animal, bx, bw, floorY, maxH);
  const vis = Math.min(shown, L.cap);
  const items = [];
  const occupied = new Set();
  for (let i = 0; i < vis; i++) {
    const p = { i, ...L.pos(i) };
    items.push(p);
    occupied.add(`${p.layer},${p.row},${p.col}`);
  }
  // Painter's order: back rows first, then bottom to top, then left to right.
  items.sort((p, q) => q.row - p.row || p.layer - q.layer || p.col - q.col);
  const right = bx + L.cols * L.cw + (L.depth - 1) * L.dx + 2;
  const topY = floorY - L.height - (animal ? 4 : L.dy + L.ch * 0.8);

  if (animal) {
    // Livestock box: back wall, animals, then slats and deck floors in front.
    const top = floorY - L.height - 4;
    ctx.fillStyle = C.wheat;
    ctx.fillRect(bx, top, right - bx, floorY - top);
    ctx.font = `${L.ch * 0.92}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const p of items) ctx.fillText(unit, p.x + L.cw / 2, p.y - L.ch * 0.08);
    ctx.strokeStyle = C.soil;
    for (let d = 0; d <= L.layers; d++) {
      const yy = floorY - d * L.ch;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(right, yy); ctx.stroke();
      if (d < L.layers) {
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(bx, yy - L.ch * 0.5); ctx.lineTo(right, yy - L.ch * 0.5); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx, top, right - bx, floorY - top);
  } else {
    for (const p of items) {
      const onTop = !occupied.has(`${p.layer + 1},${p.row},${p.col}`);
      drawBox(ctx, p.x, p.y, L.cw, L.ch, L.dx, L.dy, onTop ? unit : null);
    }
  }

  // What doesn't fit in the drawing is shown as a count.
  if (shown > L.cap) {
    const txt = `+${shown - L.cap}`;
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tx = Math.min(right + 2, bx + bw + 14), ty = Math.max(9, topY + 2);
    ctx.lineWidth = 3.5; ctx.strokeStyle = C.cream; ctx.lineJoin = 'round';
    ctx.strokeText(txt, tx, ty);
    ctx.fillStyle = C.soil;
    ctx.fillText(txt, tx, ty);
    ctx.textBaseline = 'alphabetic';
  }
}
