// The scanner, drawn on canvas for every upgrade level 0..10.
// Everything is drawn in "design units": the arch is 100 units tall and (70 + 2*level) wide,
// then scaled to pixels by SCANNER_SCALE[level] (see config.js). No image files.
//
//   level 0     homemade: crooked wooden frame, tape, a dim flickering bulb
//   levels 1-3  metal arch, working lamp, small display, rivets
//   levels 4-6  taller, side screen with a little graph, visible beam, control panel, beam curtain
//   levels 7-9  polished, several beams / laser grid, antennas, blinking lights, dish
//   level 10    huge and glowing, gold trim, pulse and sparkles
import { CONFIG } from '../config.js';

const C = {
  soil: '#5B3A29', olive: '#6B7F2A', wheat: '#E9D8A6', cream: '#FBF7EF',
  tomato: '#D9502B', sky: '#4A8FA3', sun: '#F4C95D', ink: '#2E2A26', wood: '#8B5A2B',
};
const METAL = ['#8B5A2B', '#8E9AA0', '#7F99A2', '#4A8FA3', '#4A8FA3', '#3F7F92', '#3F7F92', '#357487', '#2F6B7D', '#2B6273', '#2B6273'];

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

// Pixel size of the scanner at a level, for a scene of height H.
export function scannerMetrics(level, H) {
  const u = (CONFIG.SCANNER_SCALE[level] * CONFIG.SCANNER_HEIGHT_FRACTION * H) / 100; // px per design unit
  const w = 70 + 2 * level;
  return { u, w, heightPx: 100 * u, halfWidthPx: (w / 2) * u };
}

function sparkle(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.3;
    const a = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Pop-and-grow after an upgrade: 0.8 -> slight overshoot -> 1.
export function upgradePop(age, ms = 900) {
  if (!(age < ms)) return 1;
  const t = age / ms;
  const c1 = 1.70158, c3 = c1 + 1;
  const back = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; // easeOutBack
  return 0.8 + 0.2 * back;
}

// Sparkle burst plus a floating label, drawn in pixels (not scaled).
export function drawUpgradeFx(ctx, x, y, age, label, ms = 1100) {
  if (!(age < ms)) return;
  const t = age / ms;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.fillStyle = C.sun;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const d = 10 + 34 * t;
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 4 * (1 - t) + 1.5, t * 4 + i);
  }
  if (label) {
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5; ctx.strokeStyle = C.cream; ctx.lineJoin = 'round';
    const ly = y - 12 - 22 * t;
    ctx.strokeText(label, x, ly);
    ctx.fillStyle = C.tomato;
    ctx.fillText(label, x, ly);
  }
  ctx.restore();
}

// o = { cx, ground, H, level, now, flashAge, upgradeAge, beltY }
// Draws the body. Call drawScannerBeam after the products so the beam is on top of them.
export function drawScanner(ctx, o) {
  const { cx, ground, H, level: L, now } = o;
  const { u, w } = scannerMetrics(L, H);
  const flashAge = o.flashAge ?? Infinity;
  const fl = flashAge < 260 ? 1 - flashAge / 260 : 0;
  let pop = upgradePop(o.upgradeAge);
  if (L === 10) pop *= 1 + 0.012 * Math.sin(now / 300);
  const half = w / 2;
  const legT = L === 0 ? 8 : 6.5 + L * 0.35;
  const barH = 13 + L * 0.7;
  const top = -100, barB = top + barH;

  ctx.save();
  ctx.translate(cx, ground);
  ctx.scale(u * pop, u * pop);
  if (L === 0) ctx.rotate(-0.04);

  // level 10: glow aura behind everything
  if (L === 10) {
    for (let i = 3; i >= 1; i--) {
      ctx.fillStyle = `rgba(244,201,93,${0.07 + 0.03 * Math.sin(now / 250 + i)})`;
      rrect(ctx, -half - 6 * i, top - 18 - 5 * i, w + 12 * i, 118 + 5 * i, 14 + 4 * i);
      ctx.fill();
    }
  }
  // beam curtain (level 6+), behind the products
  if (L >= 6) {
    ctx.fillStyle = `rgba(74,143,163,${0.1 + 0.05 * Math.sin(now / 400)})`;
    ctx.fillRect(-half + legT, barB, w - 2 * legT, -barB);
  }

  const metal = METAL[L];
  if (L === 0) {
    // crooked wooden legs with grain, the right one a bit shorter
    ctx.fillStyle = C.wood;
    ctx.fillRect(-half, top + 2, legT, 98);
    ctx.fillRect(half - legT, top + 6, legT, 94);
    ctx.strokeStyle = 'rgba(46,42,38,0.35)'; ctx.lineWidth = 1;
    for (const x0 of [-half, half - legT]) {
      ctx.beginPath(); ctx.moveTo(x0 + 3, top + 12); ctx.lineTo(x0 + 3, -8); ctx.moveTo(x0 + 5.5, top + 30); ctx.lineTo(x0 + 5.5, -20); ctx.stroke();
    }
    // top plank, tilted, with nails
    ctx.save(); ctx.rotate(0.05);
    ctx.fillStyle = '#9C6B3A';
    ctx.fillRect(-half - 5, top, w + 10, barH);
    ctx.fillStyle = C.ink;
    for (const x0 of [-half + 3, half - 4]) { ctx.beginPath(); ctx.arc(x0, top + barH / 2, 1.3, 0, 7); ctx.fill(); }
    // cardboard sign
    ctx.fillStyle = C.wheat;
    ctx.fillRect(-15, top + 2, 30, barH - 4);
    ctx.fillStyle = C.soil;
    ctx.font = 'italic 700 7px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('scanner', 0, top + barH / 2 + 0.5);
    ctx.restore();
    // tape X on the left leg
    ctx.strokeStyle = 'rgba(233,216,166,0.95)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-half - 2, -60); ctx.lineTo(-half + legT + 2, -48); ctx.moveTo(-half + legT + 2, -60); ctx.lineTo(-half - 2, -48); ctx.stroke();
    // bulb on a wire, dim and flickering
    const flick = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(now / 67) * Math.sin(now / 23)) + 0.45 * fl;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4, barB); ctx.lineTo(6, barB + 9); ctx.stroke();
    ctx.fillStyle = `rgba(244,201,93,${flick * 0.5})`;
    ctx.beginPath(); ctx.arc(6, barB + 13, 9, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(244,201,93,${0.4 + flick})`;
    ctx.beginPath(); ctx.arc(6, barB + 13, 4, 0, 7); ctx.fill();
  } else {
    // feet
    ctx.fillStyle = C.ink;
    ctx.fillRect(-half - 3, -4, legT + 6, 4);
    ctx.fillRect(half - legT - 3, -4, legT + 6, 4);
    if (L >= 6) {
      // hazard stripes on the feet
      ctx.fillStyle = C.sun;
      for (const x0 of [-half - 3, half - legT - 3]) for (let i = 0; i < legT + 6; i += 4) ctx.fillRect(x0 + i, -4, 2, 4);
    }
    // legs
    ctx.fillStyle = metal;
    rrect(ctx, -half, top + 2, legT, 96, 2); ctx.fill();
    rrect(ctx, half - legT, top + 2, legT, 96, 2); ctx.fill();
    if (L >= 7) {
      // polished highlight
      ctx.fillStyle = 'rgba(251,247,239,0.35)';
      ctx.fillRect(-half + 1.5, top + 6, 1.8, 88);
      ctx.fillRect(half - legT + 1.5, top + 6, 1.8, 88);
    }
    if (L >= 3) {
      ctx.fillStyle = 'rgba(251,247,239,0.6)';
      for (let y = top + 22; y < -6; y += 16) for (const x0 of [-half + legT / 2, half - legT / 2]) { ctx.beginPath(); ctx.arc(x0, y, 1, 0, 7); ctx.fill(); }
    }
    // top bar
    ctx.fillStyle = metal;
    rrect(ctx, -half - 3, top, w + 6, barH, L >= 3 ? 5 : 3); ctx.fill();
    if (L === 10) { ctx.strokeStyle = C.sun; ctx.lineWidth = 2; rrect(ctx, -half - 3, top, w + 6, barH, 5); ctx.stroke(); }
    // label
    ctx.fillStyle = C.cream;
    ctx.font = `800 ${L >= 7 ? 7.5 : 7}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(L === 10 ? 'MEGA SCANNER' : L >= 3 ? 'SCANNER' : 'scanner', L >= 2 ? -6 : 0, top + barH / 2 + 0.5);
    // lamp
    const lampX = L >= 2 ? -half + 5 : half - 6;
    ctx.fillStyle = fl > 0 ? C.tomato : (L >= 4 ? '#9BC53D' : C.wheat);
    ctx.beginPath(); ctx.arc(lampX, top + barH / 2, 2.6, 0, 7); ctx.fill();
    // small display with a blinking cursor (level 2+)
    if (L >= 2) {
      ctx.fillStyle = C.ink;
      rrect(ctx, half - 20, top + 3, 16, barH - 6, 1.5); ctx.fill();
      ctx.fillStyle = '#9BC53D';
      const n = Math.min(4, 1 + Math.floor(L / 2));
      for (let i = 0; i < n; i++) ctx.fillRect(half - 18 + i * 3.4, top + barH / 2 - 1.5, 2.4, 3);
      if (Math.floor(now / 450) % 2 === 0) ctx.fillRect(half - 18 + n * 3.4, top + barH / 2 - 1.5, 2.4, 3);
    }
    // side screen with a little graph (level 4+), on the right leg
    if (L >= 4) {
      const sw = 22 + (L - 4) * 1.2, sh = 17 + (L - 4);
      const x0 = half + 2, y0 = -62;
      ctx.fillStyle = metal; ctx.fillRect(x0, y0 + sh / 2 - 2, 4, 4);
      ctx.fillStyle = C.ink; rrect(ctx, x0 + 3, y0, sw, sh, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(155,197,61,0.8)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x0 + 6, y0 + 3); ctx.lineTo(x0 + 6, y0 + sh - 3); ctx.lineTo(x0 + sw, y0 + sh - 3); ctx.stroke();
      ctx.fillStyle = C.wheat;
      const pts = [[0.15, 0.25], [0.3, 0.45], [0.5, 0.4], [0.65, 0.65], [0.85, 0.75]];
      pts.forEach(([a, b2], i) => {
        const on = fl > 0 && i === pts.length - 1 ? 1.8 : 1;
        ctx.beginPath(); ctx.arc(x0 + 6 + a * (sw - 7), y0 + sh - 3 - b2 * (sh - 7), 0.9 * on, 0, 7); ctx.fill();
      });
      ctx.strokeStyle = C.tomato; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x0 + 7, y0 + sh - 5); ctx.lineTo(x0 + sw - 1, y0 + 5); ctx.stroke();
    }
    // control panel with moving bar meters (level 5+), on the left leg
    if (L >= 5) {
      const x0 = -half - 16, y0 = -48;
      ctx.fillStyle = metal; rrect(ctx, x0, y0, 14, 22, 2); ctx.fill();
      ctx.fillStyle = C.ink; ctx.fillRect(x0 + 2, y0 + 2, 10, 12);
      const cols = ['#9BC53D', C.sun, C.tomato];
      for (let i = 0; i < 3; i++) {
        const hh = 3 + 7 * (0.5 + 0.5 * Math.sin(now / (180 + i * 70) + i));
        ctx.fillStyle = cols[i]; ctx.fillRect(x0 + 3 + i * 3, y0 + 13 - hh, 2, hh);
      }
      ctx.fillStyle = C.tomato; ctx.beginPath(); ctx.arc(x0 + 7, y0 + 18, 1.8, 0, 7); ctx.fill();
    }
    // antennas with blinking lights (level 7+: one, 8+: two), dish (9+)
    if (L >= 7) {
      const ants = L >= 8 ? [-half + 4, -half + 12] : [-half + 6];
      ants.forEach((x0, i) => {
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, top - 10 - i * 3); ctx.stroke();
        const on = Math.floor(now / 380 + i) % 2 === 0;
        ctx.fillStyle = on ? C.tomato : 'rgba(217,80,43,0.3)';
        ctx.beginPath(); ctx.arc(x0, top - 11 - i * 3, 1.8, 0, 7); ctx.fill();
      });
    }
    if (L >= 9) {
      ctx.fillStyle = C.cream; ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(half - 8, top - 6, 7, 3.5, -0.4, 0, Math.PI); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(half - 8, top - 3); ctx.lineTo(half - 8, top); ctx.stroke();
      // row of chasing lights under the bar
      for (let i = 0; i < 7; i++) {
        const on = (Math.floor(now / 120) + i) % 7 < 2;
        ctx.fillStyle = on ? C.sun : 'rgba(244,201,93,0.3)';
        ctx.beginPath(); ctx.arc(-half + legT + 4 + i * ((w - 2 * legT - 8) / 6), barB + 2.5, 1.3, 0, 7); ctx.fill();
      }
    }
    if (L === 10) {
      ctx.fillStyle = C.sun;
      for (let i = 0; i < 5; i++) {
        const t = (now / 1300 + i / 5) % 1;
        const a = i * 1.3 + now / 2000;
        const r = 0.5 + Math.sin(t * Math.PI) * 2.6;
        sparkle(ctx, Math.cos(a) * (half + 12), top + 10 + ((i * 23) % 80), r, now / 500 + i);
      }
    }
  }
  ctx.restore();
}

// The scan flash. It gets thinner, crisper and more complex with the level.
export function drawScannerBeam(ctx, o) {
  const { cx, ground, H, level: L, now } = o;
  const { u, w } = scannerMetrics(L, H);
  const flashAge = o.flashAge ?? Infinity;
  const dur = L === 0 ? 420 : 280 - L * 10;
  const pop = upgradePop(o.upgradeAge) * (L === 10 ? 1 + 0.012 * Math.sin(now / 300) : 1);
  const half = w / 2, legT = L === 0 ? 8 : 6.5 + L * 0.35, barB = -100 + 13 + L * 0.7;
  const beltTop = o.beltY != null ? -(ground - o.beltY) / (u * pop) : -14;
  const idle = L >= 4 ? 0.12 + 0.04 * Math.sin(now / 300) : 0;
  const a = flashAge < dur ? 1 - flashAge / dur : 0;
  if (a <= 0 && idle <= 0) return;

  ctx.save();
  ctx.translate(cx, ground);
  ctx.scale(u * pop, u * pop);
  if (L === 0) ctx.rotate(-0.04);
  const yTop = barB + (L === 0 ? 18 : 1);
  const beam = (x, alpha, width, color) => {
    ctx.strokeStyle = color.replace('A', String(alpha)); ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, beltTop); ctx.stroke();
  };
  if (L === 0) {
    // wobbly, uneven light from the bulb
    if (a > 0) {
      const flick = Math.random() < 0.3 ? 0.3 : 1;
      ctx.fillStyle = `rgba(244,201,93,${0.45 * a * flick})`;
      ctx.beginPath();
      ctx.moveTo(6, yTop - 4);
      ctx.lineTo(-10 + Math.random() * 4, beltTop);
      ctx.lineTo(20 + Math.random() * 4, beltTop);
      ctx.closePath(); ctx.fill();
    }
  } else {
    const xs = L >= 8 ? [-w * 0.2, 0, w * 0.2] : L >= 7 ? [-w * 0.12, w * 0.12] : [0];
    const width = L >= 7 ? 1.2 : L >= 4 ? 1.8 : 2.8;
    for (const x of xs) {
      if (idle > 0) beam(x, idle, width, 'rgba(217,80,43,A)');
      if (a > 0) {
        if (L === 10) beam(x, 0.25 * a, 6, 'rgba(244,201,93,A)');
        beam(x, 0.9 * a, width, 'rgba(217,80,43,A)');
      }
    }
    // sweeping horizontal line (4+) and laser grid (8+)
    if (a > 0 && L >= 4) {
      const y = yTop + (beltTop - yTop) * (1 - a);
      ctx.strokeStyle = `rgba(217,80,43,${0.8 * a})`; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(-half + legT, y); ctx.lineTo(half - legT, y); ctx.stroke();
    }
    if (a > 0 && L >= 8) {
      ctx.strokeStyle = `rgba(217,80,43,${0.35 * a})`; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let y = yTop + 8; y < beltTop; y += 8) { ctx.moveTo(-half + legT, y); ctx.lineTo(half - legT, y); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
