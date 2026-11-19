import { fitPixelCanvas } from '../pixel.js';
// Small shop previews of the scanner, the vehicle and the unloading, at a given level.
import { CONFIG } from '../config.js';
import { drawScanner, drawScannerBeam, drawFitter } from './scanner.js';
import { drawVehicle } from './vehicles.js';
import { drawUnloader } from './unloaders.js';
import { drawShed, drawBelt, drawVehicleS, drawPileS, drawUnitS, drawScannerS, drawBeamS, drawFitterS, drawUnloaderS, drawLabels } from './scene.js';
import { loadSprites } from './sprites.js';
loadSprites();
import { FONT } from './draw.js';
import { scannerIndex, isSmartScanner } from './round.js';

// Draw one preview. key: 'scanner' | 'truck' | 'belt'.
export function drawPreview(canvas, key, level, now) {
  const r = canvas.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  const { ctx, W: w, H: h } = fitPixelCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const ground = Math.round(h * 0.9);
  drawShed(ctx, w, h, ground, key === 'truck' ? 0 : 128);
  const farmer = { id: 'mele', animal: false };

  if (key === 'scanner' && level === 'secret') {
    // the surprise: a gift box with question marks
    ctx.font = `900 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const bob = Math.sin(now / 300) * 3;
    ctx.lineWidth = 4; ctx.strokeStyle = '#fbf7ef'; ctx.lineJoin = 'round';
    ctx.strokeText('???', w / 2, h * 0.45 + bob);
    ctx.fillStyle = '#D9502B';
    ctx.fillText('???', w / 2, h * 0.45 + bob);
  } else if (key === 'scanner') {
    const smart = level !== 'secret' && isSmartScanner(level);
    const beltY = ground - 14;
    drawBelt(ctx, 2, w - 2, beltY, ground, now, w);
    const sc = { cx: w / 2, ground, level: smart ? 10 : level, smart, now, flashAge: now % 1500 };
    const geo = drawScannerS(ctx, sc);
    drawUnitS(ctx, farmer, ((now / 1500) % 1) * w, beltY, now, 0);
    drawBeamS(ctx, sc, geo);
    if (smart) drawFitterS(ctx, sc, geo, (now % 1500) < 600 ? (now % 600) / 600 : null);
  } else if (key === 'truck') {
    const bed = drawVehicleS(ctx, { level, xRear: w - 4, ground, now, off: 0 });
    const n = CONFIG.TRUCK_CRATES[level];
    drawPileS(ctx, farmer, n, n, bed);
    if (bed) bed.lip();
  } else {
    drawUnloaderS(ctx, {
      level, f: farmer, x: w * 0.42, ground, now, carrying: true, walking: false,
      boxes: CONFIG.BELT_BOXES[level], unitsPerBox: CONFIG.UNITS_PER_BOX,
      tripP: 0.5, pickX: w * 0.12, dropX: w * 0.72, idleX: w * 0.42,
    });
  }
  drawLabels(ctx);
}
