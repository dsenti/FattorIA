// Small shop previews of the scanner, the vehicle and the unloading, at a given level.
import { CONFIG } from '../config.js';
import { drawScanner, drawScannerBeam, drawFitter } from './scanner.js';
import { drawVehicle } from './vehicles.js';
import { drawUnloader } from './unloaders.js';
import { drawPile } from './pile.js';

// Draw one preview. key: 'scanner' | 'truck' | 'belt'.
export function drawPreview(canvas, key, level, now, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = canvas.getBoundingClientRect();
  const w = r.width, h = r.height;
  if (w < 2 || h < 2) return;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const ground = h * 0.9;
  ctx.fillStyle = '#DCC792';
  ctx.fillRect(0, ground, w, h - ground);

  if (key === 'fitter') {
    // the scanner at the player's current level, with (level 1) or without (level 0) the fitter
    const beltY = ground - 10;
    ctx.fillStyle = '#3F2A1E';
    ctx.fillRect(0, beltY, w, 7);
    const o = { cx: w / 2, ground, H: h, level: opts.scannerLevel || 0, now, beltY, flashAge: Infinity };
    drawScanner(ctx, o);
    if (level > 0) drawFitter(ctx, { ...o, fitting: (now % 2400) < 1200 ? (now % 1200) / 1200 : null });
  } else if (key === 'scanner') {
    const beltY = ground - 10;
    ctx.fillStyle = '#3F2A1E';
    ctx.fillRect(0, beltY, w, 7);
    const o = { cx: w / 2, ground, H: h, level, now, beltY, flashAge: now % 1500 };
    drawScanner(ctx, o);
    drawScannerBeam(ctx, o);
  } else if (key === 'truck') {
    const Weff = (w - 6) / (CONFIG.TRUCK_LENGTH[CONFIG.MAX_LEVEL] + 0.01);
    const bed = drawVehicle(ctx, { level, xRear: w - 4, ground, W: Weff, H: h, now, off: 0 });
    const n = CONFIG.TRUCK_CRATES[level];
    drawPile(ctx, '🍎', false, n, n, bed.bx, bed.bw, bed.floorY, bed.maxH);
  } else {
    const H = h * 1.15;
    drawUnloader(ctx, {
      level, animal: false, x: w * 0.42, ground, H, now, carrying: true, walking: false,
      boxes: CONFIG.BELT_BOXES[level], unitsPerBox: CONFIG.UNITS_PER_BOX, unit: '🍎', face: '🧑‍🌾',
      tripP: 0.5, pickX: w * 0.12, dropX: w * 0.72, idleX: w * 0.42,
    });
  }
}
