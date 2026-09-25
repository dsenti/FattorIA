// Small shop previews of the scanner, the vehicle and the unloading, at a given level.
import { CONFIG } from '../config.js';
import { drawScanner, drawScannerBeam, drawFitter } from './scanner.js';
import { drawVehicle } from './vehicles.js';
import { drawUnloader } from './unloaders.js';
import { drawPile } from './pile.js';
import { FONT } from './draw.js';
import { scannerIndex, isSmartScanner } from './round.js';

// Draw one preview. key: 'scanner' | 'truck' | 'belt'.
export function drawPreview(canvas, key, level, now) {
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

  if (key === 'scanner' && level === 'secret') {
    // the surprise: a gift box with question marks
    ctx.font = `${Math.round(h * 0.5)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const bob = Math.sin(now / 300) * 3;
    ctx.fillText('🎁', w / 2, h * 0.45 + bob);
    ctx.font = `900 ${Math.round(h * 0.2)}px system-ui, sans-serif`;
    ctx.fillStyle = '#D9502B';
    ctx.fillText('???', w / 2 + h * 0.42, h * 0.22 - bob);
  } else if (key === 'scanner' && isSmartScanner(level)) {
    const beltY = ground - 10;
    ctx.fillStyle = '#3F2A1E';
    ctx.fillRect(0, beltY, w, 7);
    const o = { cx: w / 2, ground, H: h, level: scannerIndex(level), smart: true, now, beltY, flashAge: now % 1500 };
    drawScanner(ctx, o);
    drawScannerBeam(ctx, o);
    drawFitter(ctx, { ...o, fitting: (now % 1500) < 600 ? (now % 600) / 600 : null });
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
