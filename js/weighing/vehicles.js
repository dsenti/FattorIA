// The farmer's vehicle for every truck level 0..10, drawn on canvas (no image files).
// The rear of the vehicle is anchored at xRear, next to the belt; bigger vehicles grow to the
// left (the biggest ones may stick out of the scene a little) and upwards.
// drawVehicle returns the bed rectangle, so the 3D pile (game.js) sits in it.
import { CONFIG } from '../config.js';

const C = {
  soil: '#5B3A29', olive: '#6B7F2A', wheat: '#E9D8A6', cream: '#FBF7EF',
  tomato: '#D9502B', sky: '#4A8FA3', sun: '#F4C95D', ink: '#2E2A26', glass: '#CFE3E8',
  wood: '#A0703F', steel: '#8E9AA0',
};

// Italian names shown in the shop and in the upgrade moment.
export const VEHICLE_NAMES = [
  'Motocarro', 'Pickup', 'Pickup con sponde', 'Furgone cassonato', 'Camioncino', 'Camion',
  'Trattore con rimorchio', 'Trattore grande con rimorchio', 'Camion grande', 'Autoarticolato',
  'Camion del futuro',
];

// Per level: kind, colour, share of the length used by the cab/tractor, wheel radius and bed
// floor height (in px for a 130 px tall scene, scaled by TRUCK_HEIGHT_SCALE), cab height, rear axles.
const SPECS = [
  { kind: 'ape', color: C.sky, front: 0.38, wheel: 7, floor: 15, cab: 40, axles: 1 },
  { kind: 'pickup', color: C.tomato, front: 0.44, wheel: 8.5, floor: 19, cab: 38, axles: 1 },
  { kind: 'pickup2', color: C.olive, front: 0.46, wheel: 9, floor: 20, cab: 41, axles: 1, sides: 9 },
  { kind: 'van', color: C.wheat, stripe: C.sky, front: 0.3, wheel: 9.5, floor: 22, cab: 48, axles: 1, sides: 6 },
  { kind: 'truck', color: C.tomato, front: 0.28, wheel: 10.5, floor: 25, cab: 54, axles: 1, sides: 8 },
  { kind: 'truck', color: C.sky, front: 0.26, wheel: 11, floor: 26, cab: 58, axles: 2, sides: 9, stack: true },
  { kind: 'tractor', color: C.olive, front: 0.42, wheel: 9, floor: 24, cab: 56, axles: 1, sides: 10 },
  { kind: 'tractor', color: C.tomato, front: 0.4, wheel: 10, floor: 26, cab: 62, axles: 2, sides: 11, beacon: true },
  { kind: 'truck', color: C.olive, front: 0.22, wheel: 11, floor: 27, cab: 62, axles: 3, sides: 10, stack: true, big: true },
  { kind: 'semi', color: C.tomato, front: 0.26, wheel: 11, floor: 28, cab: 66, axles: 3, sides: 8, stack: true },
  { kind: 'future', color: '#EDE8DD', front: 0.25, wheel: 11.5, floor: 28, cab: 66, axles: 3, sides: 6 },
];

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function wheel(ctx, x, y, r, rot, future, now) {
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (future) {
    ctx.strokeStyle = `rgba(74,143,163,${0.7 + 0.3 * Math.sin(now / 200)})`; ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, 7); ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 7); ctx.fill();
    return;
  }
  ctx.fillStyle = '#9A9189';
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 7); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * Math.PI) / 3;
    ctx.moveTo(x - Math.cos(a) * r * 0.42, y - Math.sin(a) * r * 0.42);
    ctx.lineTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42);
  }
  ctx.stroke();
}

function windowPane(ctx, x, y, w, h, r = 2) {
  ctx.fillStyle = C.glass; rrect(ctx, x, y, w, h, r); ctx.fill();
  ctx.fillStyle = 'rgba(251,247,239,0.7)';
  ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h); ctx.lineTo(x + w * 0.45, y); ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.35, y + h); ctx.fill();
}

export function vehicleMetrics(level, W, H) {
  const s = SPECS[level];
  const k = (CONFIG.TRUCK_HEIGHT_SCALE[level] * H) / 130;
  return { spec: s, k, len: CONFIG.TRUCK_LENGTH[level] * W };
}

// o = { level, xRear, ground, W, H, now, off (drive offset px) }
// Returns { bx, bw, floorY, maxH } for the pile.
export function drawVehicle(ctx, o) {
  const { level, ground, W, H, now } = o;
  const off = o.off || 0;
  const { spec: s, k, len } = vehicleMetrics(level, W, H);
  const x1 = o.xRear + off, x0 = x1 - len;
  const wr = s.wheel * k, floorY = ground - s.floor * k, cabH = s.cab * k;
  const frontLen = len * s.front;
  const bedX = x0 + frontLen + 2 * k, bedW = x1 - bedX;
  const rot = -off / Math.max(4, wr);
  const future = s.kind === 'future';
  const wheelY = ground - wr;

  // ---- chassis / bed platform
  ctx.fillStyle = C.soil;
  if (s.kind === 'tractor') {
    // drawbar between tractor and trailer
    ctx.fillRect(x0 + frontLen - 4 * k, floorY + 3 * k, 8 * k, 2.5 * k);
  }
  ctx.fillStyle = future ? '#D8D2C6' : C.soil;
  rrect(ctx, bedX, floorY, bedW, 5 * k, future ? 3 * k : 1); ctx.fill();
  if (future) {
    // LED underglow
    ctx.fillStyle = `rgba(74,143,163,${0.35 + 0.25 * Math.sin(now / 220)})`;
    ctx.fillRect(bedX + 4 * k, floorY + 5 * k, bedW - 8 * k, 2 * k);
  }
  // bed walls (back and front boards; low side boards show as a darker lip)
  const sideH = (s.sides || 5) * k;
  ctx.fillStyle = s.kind === 'ape' || s.kind === 'pickup' ? C.wood : s.kind === 'future' ? C.cream : s.color;
  ctx.fillRect(bedX, floorY - sideH, 2.5 * k, sideH);
  ctx.fillRect(x1 - 2.5 * k, floorY - sideH, 2.5 * k, sideH);

  // ---- front: cab or tractor
  const cx0 = x0, cw = frontLen;
  ctx.fillStyle = s.color;
  switch (s.kind) {
    case 'ape': {
      // rounded bubble cab, single front wheel
      ctx.beginPath();
      ctx.moveTo(cx0 + cw, floorY + 4 * k);
      ctx.lineTo(cx0 + cw, ground - cabH);
      ctx.quadraticCurveTo(cx0 + cw * 0.2, ground - cabH - 2 * k, cx0 + 2 * k, ground - cabH * 0.45);
      ctx.lineTo(cx0 + 2 * k, floorY + 4 * k);
      ctx.closePath(); ctx.fill();
      windowPane(ctx, cx0 + cw * 0.2, ground - cabH * 0.9, cw * 0.55, cabH * 0.32, 4 * k);
      ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(cx0 + 4 * k, ground - cabH * 0.35, 2.2 * k, 0, 7); ctx.fill();
      ctx.fillStyle = C.cream; ctx.fillRect(cx0 + cw * 0.3, ground - cabH * 0.42, cw * 0.4, 1.5 * k);
      wheel(ctx, cx0 + cw * 0.35, wheelY, wr * 0.85, rot, false, now);
      break;
    }
    case 'pickup':
    case 'pickup2': {
      const hoodH = cabH * 0.55;
      rrect(ctx, cx0, ground - hoodH - wr * 0.6, cw, hoodH, 3 * k); ctx.fill();
      rrect(ctx, cx0 + cw * 0.3, ground - cabH - wr * 0.2, cw * 0.7, cabH * 0.6, 4 * k); ctx.fill();
      windowPane(ctx, cx0 + cw * 0.36, ground - cabH - wr * 0.2 + 3 * k, cw * (s.kind === 'pickup2' ? 0.26 : 0.5), cabH * 0.3);
      if (s.kind === 'pickup2') windowPane(ctx, cx0 + cw * 0.66, ground - cabH - wr * 0.2 + 3 * k, cw * 0.28, cabH * 0.3);
      ctx.fillStyle = C.sun; ctx.fillRect(cx0, ground - hoodH - wr * 0.6 + 3 * k, 3 * k, 3 * k);
      wheel(ctx, cx0 + cw * 0.28, wheelY, wr, rot, false, now);
      break;
    }
    case 'van':
    case 'truck':
    case 'semi': {
      // cab-over cab
      const cabTop = ground - cabH;
      rrect(ctx, cx0 + 1, cabTop, cw, cabH - wr * 0.7, 4 * k); ctx.fill();
      if (s.stripe) { ctx.fillStyle = s.stripe; ctx.fillRect(cx0 + 1, cabTop + cabH * 0.55, cw, 3 * k); }
      windowPane(ctx, cx0 + cw * 0.12, cabTop + 4 * k, cw * 0.6, cabH * 0.28);
      ctx.fillStyle = C.sun; ctx.fillRect(cx0 + 1, ground - wr * 1.6, 3 * k, 3 * k);
      ctx.fillStyle = C.ink; ctx.fillRect(cx0 + 1, ground - wr * 1.05, cw, 2.5 * k);
      if (s.stack) { ctx.fillStyle = '#9A9189'; ctx.fillRect(cx0 + cw - 3 * k, cabTop - 8 * k, 2.5 * k, 12 * k); }
      if (s.kind === 'semi') {
        // sleeper box and air deflector
        ctx.fillStyle = s.color; rrect(ctx, cx0 + cw * 0.55, cabTop - 7 * k, cw * 0.45, 8 * k, 3 * k); ctx.fill();
      }
      if (s.big) { ctx.fillStyle = C.cream; ctx.font = `800 ${6 * k}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('FATTORIA', cx0 + cw / 2, cabTop + cabH * 0.55); }
      wheel(ctx, cx0 + cw * 0.45, wheelY, wr, rot, false, now);
      break;
    }
    case 'tractor': {
      // hood, cabin frame with glass, big rear wheel, small front wheel
      const bigR = wr * 1.7, smallR = wr * 0.95;
      const hoodTop = ground - cabH * 0.5;
      rrect(ctx, cx0 + 2 * k, hoodTop, cw * 0.55, cabH * 0.28, 3 * k); ctx.fill();
      ctx.fillStyle = C.ink; ctx.fillRect(cx0 + cw * 0.2, hoodTop - 7 * k, 2 * k, 7 * k); // exhaust
      ctx.fillStyle = s.color;
      const cabX = cx0 + cw * 0.5, cabW = cw * 0.45, cabTop = ground - cabH;
      ctx.fillRect(cabX, cabTop, 2.5 * k, cabH * 0.6);
      ctx.fillRect(cabX + cabW - 2.5 * k, cabTop, 2.5 * k, cabH * 0.6);
      rrect(ctx, cabX - 2 * k, cabTop - 2 * k, cabW + 4 * k, 4 * k, 2 * k); ctx.fill();
      ctx.fillStyle = 'rgba(207,227,232,0.7)'; ctx.fillRect(cabX + 2.5 * k, cabTop + 2 * k, cabW - 5 * k, cabH * 0.35);
      ctx.fillStyle = s.color; ctx.fillRect(cabX - 2 * k, ground - cabH * 0.45, cabW + 4 * k, cabH * 0.2);
      if (s.beacon) {
        const on = Math.floor(now / 300) % 2 === 0;
        ctx.fillStyle = on ? C.sun : '#B98A2E'; ctx.beginPath(); ctx.arc(cabX + cabW / 2, cabTop - 4 * k, 2.5 * k, 0, 7); ctx.fill();
      }
      wheel(ctx, cx0 + cw * 0.18, ground - smallR, smallR, rot, false, now);
      wheel(ctx, cabX + cabW * 0.5, ground - bigR, bigR, rot, false, now);
      break;
    }
    case 'future': {
      // sleek wedge cab with a light strip
      const cabTop = ground - cabH;
      ctx.beginPath();
      ctx.moveTo(cx0 + cw, ground - wr * 0.6);
      ctx.lineTo(cx0 + cw, cabTop);
      ctx.lineTo(cx0 + cw * 0.45, cabTop + 2 * k);
      ctx.lineTo(cx0 + 2 * k, ground - cabH * 0.35);
      ctx.lineTo(cx0 + 2 * k, ground - wr * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.sky; ctx.lineWidth = 2 * k; ctx.stroke();
      ctx.fillStyle = C.tomato; ctx.fillRect(cx0 + cw * 0.55, ground - cabH * 0.25, cw * 0.4, 3 * k);
      ctx.fillStyle = '#9CC9D6';
      ctx.beginPath();
      ctx.moveTo(cx0 + cw * 0.92, cabTop + 4 * k); ctx.lineTo(cx0 + cw * 0.5, cabTop + 5 * k);
      ctx.lineTo(cx0 + cw * 0.15, ground - cabH * 0.42); ctx.lineTo(cx0 + cw * 0.92, ground - cabH * 0.42);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(74,143,163,${0.7 + 0.3 * Math.sin(now / 220)})`;
      ctx.fillRect(cx0 + 3 * k, ground - cabH * 0.3, cw - 3 * k, 2 * k);
      ctx.fillStyle = C.tomato; ctx.fillRect(cx0 + 2 * k, ground - cabH * 0.36, 4 * k, 2 * k);
      wheel(ctx, cx0 + cw * 0.45, wheelY, wr, rot, true, now);
      break;
    }
  }

  // ---- rear wheels
  const n = s.axles;
  for (let i = 0; i < n; i++) {
    const wx = x1 - bedW * 0.18 - i * wr * 2.15;
    wheel(ctx, wx, wheelY, wr, rot, future, now);
  }
  if (s.kind === 'tractor') wheel(ctx, bedX + bedW * 0.25, wheelY, wr, rot, false, now);

  const maxH = Math.max(20, floorY - 14); // leave room for the "+N" count above the pile
  return { bx: bedX + 1 * k, bw: bedW - 2 * k, floorY, maxH, k, frontX: x0 };
}
