// Pixel-art drawing of the weighing scene: the shed, the belt, vehicles with their load, the
// scanner and its beam, the products on the belt, and whoever unloads (people, tools, herders).
// Inputs are CSS px (as everywhere in the game); drawing happens in backing pixels = art pixels
// (see sprites.js), so every sprite is crisp. Text (counts like "+12") is collected and drawn
// afterwards in CSS px by drawLabels(), on the sharp text layer.
import { CONFIG } from '../config.js';
import { withPixels, blit, meta, size, blitShed } from './sprites.js';

const FARMER_KIND = { mele: 'man', carote: 'woman', mucche: 'person', castagne: 'man', uva: 'woman', galline: 'woman', zucche: 'person' };
export const farmerKind = (f) => FARMER_KIND[f && f.id] || 'man';
export const unitSprite = (f, frame = 0) => (f.animal ? `unit_${f.id}_${frame}` : `unit_${f.id}`);
export const crateSprite = (f) => `crate_${f.id}`;

const OL = '#2c3639';
let labels = [];
const label = (txt, x, y, align = 'center') => labels.push({ txt, x, y, align });

function rect(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// A thick pixel line with a dark outline (booms, arms).
function thick(ctx, x0, y0, x1, y1, w, col) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (const [ww, cc] of [[w + 2, OL], [w, col]]) {
    ctx.fillStyle = cc;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n - ww / 2), y = Math.round(y0 + (y1 - y0) * i / n - ww / 2);
      ctx.fillRect(x, y, ww, ww);
    }
  }
}

// ------------------------------------------------------------------ shed and belt
export function drawShed(ctx, W, H, ground, xoff = 0) {
  withPixels(ctx, (k) => {
    if (!blitShed(ctx, Math.ceil(W * k) + 2, Math.round(ground * k), xoff)) {
      rect(ctx, 0, 0, W * k + 2, H * k + 2, '#b8a282');
      rect(ctx, 0, ground * k, W * k + 2, (H - ground) * k + 2, '#a29d92');
    }
  });
}

export function drawBelt(ctx, x0, x1, beltY, ground, now, W) {
  withPixels(ctx, (k) => {
    const X0 = Math.round(x0 * k), X1 = Math.round(x1 * k), Y = Math.round(beltY * k), G = Math.round(ground * k);
    for (let x = X0 + 6; x < X1 - 2; x += 22) {
      rect(ctx, x - 1, Y + 5, 4, G - Y - 5, OL);
      rect(ctx, x, Y + 5, 2, G - Y - 5, '#7d8b92');
      rect(ctx, x - 2, G - 1, 6, 1, OL);
    }
    rect(ctx, X0 - 1, Y - 1, X1 - X0 + 2, 7, OL);
    rect(ctx, X0, Y, X1 - X0, 3, '#2a3034');
    rect(ctx, X0, Y, X1 - X0, 1, '#4a545a');
    rect(ctx, X0, Y + 3, X1 - X0, 2, '#7d8b92');
    rect(ctx, X0, Y + 4, X1 - X0, 1, '#5a6870');
    const off = Math.floor((now / 1000) * CONFIG.BELT_SPEED * W * k) % 6;
    ctx.fillStyle = '#55626a';
    for (let x = X0 + off; x < X1; x += 6) ctx.fillRect(x, Y + 1, 2, 1);
    for (const x of [X0, X1 - 4]) { rect(ctx, x, Y - 1, 4, 6, OL); rect(ctx, x + 1, Y, 2, 4, '#a6b2b8'); }
  });
}

// ------------------------------------------------------------------ vehicle and load
// o = { level, xRear, ground, now, off, hop }. Returns the bed (CSS px) and lip() to draw the
// near side board over the load.
export function drawVehicleS(ctx, o) {
  const name = `veh_${o.level}`;
  const m = meta(name);
  if (!m) return null;
  let g = null;
  withPixels(ctx, (k) => {
    const [, , w, h] = m.r;
    const left = Math.round((o.xRear + (o.off || 0)) * k) - w;
    const top = Math.round(o.ground * k) - h - Math.round(o.hop || 0);
    blit(ctx, name, left, top);
    const fr = ((Math.floor(-(o.off || 0) * k / 3) % 4) + 4) % 4;
    for (const [cx, cy, r] of m.wheels) blit(ctx, `wheel_${r}_${fr}`, left + cx - r, top + cy - r);
    g = { left, top, k };
  });
  const [b0, b1, fl] = m.bed;
  const { left, top, k } = g;
  return {
    k, bxA: left + b0, bwA: b1 - b0, floorA: top + fl,
    bx: (left + b0) / k, bw: (b1 - b0) / k, floorY: (top + fl) / k, maxH: 46 / k,
    lip: () => withPixels(ctx, () => blit(ctx, `${name}_lip`, left + m.lipAt[0], top + m.lipAt[1])),
  };
}

const CW = 10, CH = 8, DX = 3, DY = 3, MAX_LAYERS = 5;

// The load in the bed: crates (crops) or animals, capacity and shown counted in drawn items.
export function drawPileS(ctx, f, capacity, shown, bed) {
  if (!bed) return;
  withPixels(ctx, () => {
    if (f.animal) return animals(ctx, f, capacity, shown, bed);
    const n = Math.max(1, Math.min(capacity, CONFIG.PILE_VISIBLE_MAX));
    const cols = Math.max(1, Math.floor((bed.bwA - DX) / CW));
    const depth = n <= cols ? 1 : n <= cols * 3 ? 2 : 3;
    let layers = Math.max(1, Math.ceil(n / (cols * depth)));
    layers = Math.min(layers, MAX_LAYERS);
    const cap = Math.min(n, cols * depth * layers);
    const vis = Math.min(shown, cap);
    const perRow = cols * layers;
    const items = [];
    const occ = new Set();
    for (let i = 0; i < vis; i++) {
      const row = Math.floor(i / perRow), j = i % perRow;
      const p = { row, layer: Math.floor(j / cols), col: j % cols };
      items.push(p);
      occ.add(`${p.layer},${p.row},${p.col}`);
    }
    items.sort((p, q) => q.row - p.row || p.layer - q.layer || p.col - q.col);
    for (const p of items) {
      const x = bed.bxA + p.col * CW + p.row * DX;
      const yb = bed.floorA - p.layer * CH - p.row * DY;
      blit(ctx, occ.has(`${p.layer + 1},${p.row},${p.col}`) ? 'crate' : crateSprite(f), x, yb - 11);
    }
    if (shown > cap) {
      const topY = bed.floorA - layers * CH - depth * DY - 6;
      label(`+${shown - cap}`, (bed.bxA + bed.bwA - 4) / bed.k, Math.max(9, topY / bed.k));
    }
  });
}

function animals(ctx, f, capacity, shown, bed) {
  const [w, h] = size(unitSprite(f));
  const cell = w - 4;
  const n = Math.max(1, Math.min(capacity, CONFIG.PILE_VISIBLE_MAX));
  const cols = Math.max(1, Math.floor((bed.bwA - 4) / cell));
  const decks = Math.max(1, Math.min(Math.floor(44 / (h + 1)), Math.ceil(n / (cols * 2))));
  const depth = Math.min(2, Math.ceil(n / (cols * decks)));
  const cap = Math.min(n, cols * decks * depth);
  const vis = Math.min(shown, cap);
  const top = bed.floorA - decks * (h + 1) - 2;
  rect(ctx, bed.bxA, top, bed.bwA, bed.floorA - top, '#8b6849');          // pen back wall
  for (let y = top + 3; y < bed.floorA; y += 4) rect(ctx, bed.bxA, y, bed.bwA, 1, '#6b4b33');
  const items = [];
  for (let i = 0; i < vis; i++) {
    const r = Math.floor(i / (cols * decks)), j = i % (cols * decks);
    items.push({ row: depth - 1 - r, deck: Math.floor(j / cols), col: j % cols, i });
  }
  items.sort((p, q) => q.row - p.row || p.deck - q.deck || p.col - q.col);
  for (const p of items) {
    const x = bed.bxA + 2 + p.col * cell + p.row * 4;
    const yb = bed.floorA - p.deck * (h + 1) - p.row * 2;
    blit(ctx, unitSprite(f, p.i % 2), x, yb - h, p.i % 3 === 1);
  }
  for (let d = 0; d <= decks; d++) rect(ctx, bed.bxA - 1, bed.floorA - d * (h + 1), bed.bwA + 2, 2, '#4a3424');
  for (let x = bed.bxA; x < bed.bxA + bed.bwA; x += 7) rect(ctx, x, top, 1, bed.floorA - top, '#4a3424');
  if (shown > cap) label(`+${shown - cap}`, (bed.bxA + bed.bwA - 4) / bed.k, Math.max(9, (top - 6) / bed.k));
}

// ------------------------------------------------------------------ products on the belt
export function drawUnitS(ctx, f, x, beltY, now, idx) {
  withPixels(ctx, (k) => {
    const name = unitSprite(f, f.animal ? Math.floor(now / 160 + idx) % 2 : 0);
    const [w, h] = size(name);
    const hopY = f.animal ? (Math.floor(now / 160 + idx) % 2) : 0;
    blit(ctx, name, Math.round(x * k) - Math.floor(w / 2), Math.round(beltY * k) - h - hopY);
  });
}

// ------------------------------------------------------------------ scanner
// sc = { cx, ground, level, smart, now, flashAge, hop }. Returns the opening (CSS px).
export function drawScannerS(ctx, sc) {
  const name = sc.smart ? 'scanner_100' : `scanner_${sc.level}`;
  const m = meta(name);
  if (!m) return null;
  let geo = null;
  withPixels(ctx, (k) => {
    const [, , w, h] = m.r;
    const left = Math.round(sc.cx * k) - m.cx, top = Math.round(sc.ground * k) - h - Math.round(sc.hop || 0);
    blit(ctx, name, left, top);
    const [ix0, ix1, it, ib] = m.inner;
    geo = { k, left, top, x0: left + ix0, x1: left + ix1, t: top + it, b: top + ib, m };
    // a status light under the top beam that blinks while idle
    const on = Math.floor(sc.now / 600) % 2;
    rect(ctx, left + m.cx, top + it, 1, 1, on ? '#a4e8b0' : '#5a8f99');
  });
  return geo;
}

// The scan: a bright line sweeping through the opening plus a flash on the emitters.
export function drawBeamS(ctx, sc, geo) {
  if (!geo || !(sc.flashAge < 480)) return;
  withPixels(ctx, () => {
    const t = sc.flashAge / 480;
    const x = Math.round(geo.x0 + (geo.x1 - geo.x0 - 2) * t);
    rect(ctx, x, geo.t + 1, 2, geo.b - geo.t - 1, '#d6f2f4');
    ctx.fillStyle = '#86d0d6';
    for (let y = geo.t + 2; y < geo.b; y += 2) {
      ctx.fillRect(x - 2, y, 1, 1);
      ctx.fillRect(x + 3, y + 1, 1, 1);
    }
    rect(ctx, geo.x0, geo.t, geo.x1 - geo.x0, 1, '#d6f2f4');
  });
}

// Scanner 100: the little computer's screen; fitting (0..1 or null) animates a line settling.
export function drawFitterS(ctx, sc, geo, fitting) {
  if (!geo || !geo.m.screen) return;
  withPixels(ctx, () => {
    const [sx, sy, sw, sh] = geo.m.screen;
    const x0 = geo.left + sx, y0 = geo.top + sy;
    rect(ctx, x0, y0, sw, sh, '#1e2427');
    ctx.fillStyle = '#c2e0a4';
    for (let i = 0; i < 5; i++) ctx.fillRect(x0 + 1 + i * 2 + (i % 2), y0 + sh - 2 - i, 1, 1);
    const wob = fitting == null ? 0 : Math.round(Math.sin(fitting * Math.PI * 4) * 1.5 * (1 - fitting));
    ctx.fillStyle = '#f5ca63';
    for (let i = 0; i < sw; i++) ctx.fillRect(x0 + i, Math.round(y0 + sh - 1 - i * (sh - 2) / sw + (i < sw / 2 ? wob : -wob)), 1, 1);
  });
}

// ------------------------------------------------------------------ people and machines
function personAt(ctx, kind, x, g, pose, flip) {
  const name = `${kind}_${pose}`;
  const m = meta(name);
  if (!m) return null;
  const [w, h] = m.r.slice(2);
  const left = x - Math.floor(w / 2), top = g - h;
  blit(ctx, name, left, top, flip);
  const hx = flip ? w - 1 - m.hand[0] : m.hand[0];
  return { left, top, w, h, handX: left + hx, handY: top + m.hand[1] };
}

// a stack of crates: bottom-left at (x, yb), `cols` wide; the top crate of each column shows produce
function crates(ctx, f, n, x, yb, cols) {
  const layers = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const top = r === layers - 1 || i + cols >= n;
    blit(ctx, top ? crateSprite(f) : 'crate', x + c * CW, yb - 11 - r * CH);
  }
}

function bust(ctx, kind, sx, sy, flip) {
  const m = meta(`${kind}_bust`);
  if (!m) return;
  const [w] = m.r.slice(2);
  blit(ctx, `${kind}_bust`, sx - (flip ? w - 1 - m.seat[0] : m.seat[0]), sy - m.seat[1], flip);
}

function wheels(ctx, name, left, top, xCss, k) {
  const m = meta(name);
  if (!m || !m.wheels) return;
  const fr = ((Math.floor(xCss * k / 3) % 4) + 4) % 4;
  for (const [cx, cy, r] of m.wheels) blit(ctx, `wheel_${r}_${fr}`, left + cx - r, top + cy - r);
}

// o = { level, f (the farmer), x, ground, now, carrying, walking, boxes, unitsPerBox, tripP,
//       pickX, dropX, idleX, hop }
export function drawUnloaderS(ctx, o) {
  withPixels(ctx, (k) => (o.f.animal ? herder(ctx, o, k) : carrier(ctx, o, k)));
}

const stepOf = (o, ph = 0) => Math.floor(o.now / 140 + ph) % 2;
const poseOf = (o, ph = 0) => (o.carrying ? (o.walking ? `carry${stepOf(o, ph) + 1}` : 'carry') : (o.walking ? `walk${stepOf(o, ph) + 1}` : 'stand'));

function carrier(ctx, o, k) {
  const L = o.level, f = o.f;
  const kind = farmerKind(f);
  const X = Math.round(o.x * k), G = Math.round(o.ground * k) - Math.round(o.hop || 0);
  const dir = o.carrying ? 1 : -1;
  const flip = dir < 0;
  const n = o.boxes;
  if (L <= 2) {
    const crew = [kind, 'boy', 'nonna'].slice(0, L + 1);
    crew.forEach((who, i) => {
      const px = X - dir * i * 13;
      const p = personAt(ctx, who, px, G, poseOf(o, i * 0.5), flip);
      if (o.carrying && p) {
        const share = Math.floor(n / crew.length) + (i < n % crew.length ? 1 : 0);
        if (share > 0) crates(ctx, f, share, p.handX - 5, p.handY + 1, 1);
      }
    });
    return;
  }
  if (L === 3 || L === 4 || L === 5) {
    const tool = ['tool_cart', 'tool_barrow', 'tool_palletjack'][L - 3];
    const m = meta(tool);
    const [w, h] = m.r.slice(2);
    const left = X - Math.floor(w / 2), top = G - h;
    blit(ctx, tool, left, top);
    wheels(ctx, tool, left, top, o.x, k);
    if (o.carrying) {
      const [lx, ly, cols] = m.load;
      crates(ctx, f, n, left + lx, top + ly + (L === 4 ? 4 : 0), cols);
    }
    personAt(ctx, kind, left + m.handle[0] + 4, G, o.walking ? `push${stepOf(o) + 1}` : 'stand', true);
    return;
  }
  if (L === 6) {
    const m = meta('tool_forklift');
    const [w, h] = m.r.slice(2);
    const left = X - 6, top = G - h;
    bust(ctx, kind, left + m.seat[0], top + m.seat[1], true);
    blit(ctx, 'tool_forklift', left, top);
    const lift = o.carrying ? 10 : 0;
    blit(ctx, 'tool_forklift_forks', left - 6, top + 25 - lift);
    if (o.carrying) crates(ctx, f, n, left - 5, top + 28 - lift, 2);
    wheels(ctx, 'tool_forklift', left, top, o.x, k);
    return;
  }
  if (L === 7) {
    const m = meta('tool_loader');
    const [w, h] = m.r.slice(2);
    const left = X - 4, top = G - h;
    blit(ctx, 'tool_loader', left, top);
    bust(ctx, kind, left + m.seat[0], top + m.seat[1] - 6, true);
    const lift = o.carrying ? 14 : 0;
    thick(ctx, left + m.pivot[0], top + m.pivot[1], left + 2, top + 26 - lift, 2, '#477f4f');
    blit(ctx, 'tool_loader_bucket', left - 12, top + 23 - lift);
    if (o.carrying) crates(ctx, f, n, left - 10, top + 30 - lift, 3);
    wheels(ctx, 'tool_loader', left, top, o.x, k);
    return;
  }
  if (L === 8) {
    const m = meta('tool_telehandler');
    const [w, h] = m.r.slice(2);
    const left = X - 2, top = G - h;
    const lift = o.carrying ? 18 : 4;
    const ax = left - 1, ay = top + 14 - lift;
    thick(ctx, left + m.pivot[0], top + m.pivot[1], ax, ay, 3, '#e0ac3c');
    blit(ctx, 'tool_telehandler', left, top);
    bust(ctx, kind, left + m.seat[0], top + m.seat[1] - 3, true);
    blit(ctx, 'tool_telehandler_forks', ax - 11, ay - 2);
    if (o.carrying) crates(ctx, f, n, ax - 10, ay + 6, 3);
    wheels(ctx, 'tool_telehandler', left, top, o.x, k);
    return;
  }
  if (L === 9) {
    const base = Math.round((o.pickX + o.dropX) / 2 * k);
    const m = meta('tool_robotarm');
    const [w, h] = m.r.slice(2);
    const left = base - Math.floor(w / 2), top = G - h;
    personAt(ctx, kind, Math.round((o.dropX + 10) * k), G, 'tablet', true);
    const p = o.tripP;
    const rest = { x: base + 2, y: top - 10 };
    const pick = { x: Math.round(o.pickX * k) - 2, y: G - 34 };
    const drop = { x: Math.round(o.dropX * k) + 2, y: G - 30 };
    let e = rest;
    if (p != null) {
      if (p < 0.3) { const t = p / 0.3; e = { x: rest.x + (pick.x - rest.x) * t, y: rest.y + (pick.y - rest.y) * t }; }
      else if (p < 0.75) { const t = (p - 0.3) / 0.45; e = { x: pick.x + (drop.x - pick.x) * t, y: pick.y + (drop.y - pick.y) * t - Math.sin(t * Math.PI) * 14 }; }
      else { const t = (p - 0.75) / 0.25; e = { x: drop.x + (rest.x - drop.x) * t, y: drop.y + (rest.y - drop.y) * t }; }
    }
    const sx = left + m.shoulder[0], sy = top + m.shoulder[1];
    const mx = Math.round((sx + e.x) / 2), my = Math.round(Math.min(sy, e.y) - 12);
    blit(ctx, 'tool_robotarm', left, top);
    thick(ctx, sx, sy, mx, my, 3, '#5a8f99');
    thick(ctx, mx, my, e.x, e.y, 2, '#86b6bd');
    rect(ctx, mx - 1, my - 1, 3, 3, '#f7f1e2');
    blit(ctx, 'tool_robotarm_grip', Math.round(e.x) - 8, Math.round(e.y));
    if (o.carrying && p != null && p >= 0.3 && p < 0.75) {
      const shown = Math.min(n, 9);
      crates(ctx, f, shown, Math.round(e.x) - 15, Math.round(e.y) + 5 + Math.ceil(shown / 3) * CH + 3, 3);
      if (n > shown) label(`+${n - shown}`, (e.x + 18) / k, (e.y + 2) / k, 'left');
    }
    return;
  }
  // level 10: the autonomous robot; the farmer supervises with a tablet
  personAt(ctx, kind, Math.round((o.dropX + 10) * k), G, 'tablet', true);
  const name = `tool_agv_${Math.floor(o.now / 1700) % 6 === 0 ? 1 : 0}`;
  const m = meta('tool_agv_0');
  const [w, h] = m.r.slice(2);
  const left = X - Math.floor(w / 2), top = G - h;
  blit(ctx, name, left, top);
  wheels(ctx, 'tool_agv_0', left, top, o.x, k);
  if (o.carrying) {
    const shown = Math.min(n, 12);
    crates(ctx, f, shown, left + 1, top + 1, 3);
    if (n > shown) label(`+${n - shown}`, (left + w / 2) / k, (top - 4 * CH - 8) / k);
  }
}

function herd(ctx, o, k, fromX, G, dir) {
  if (!o.carrying) return fromX;
  const f = o.f;
  const count = o.boxes * (o.unitsPerBox || 3);
  const drawn = Math.min(count, 3);
  const [w] = size(unitSprite(f));
  let x = fromX;
  for (let i = 0; i < drawn; i++) {
    const fr = Math.floor(o.now / 160 + i) % 2;
    const [ww, hh] = size(unitSprite(f, fr));
    blit(ctx, unitSprite(f, fr), x - Math.floor(ww / 2), G - hh - fr, dir < 0);
    x -= dir * (w - 3);
  }
  if (count > drawn) label(`+${count - drawn}`, (fromX - dir * (w - 3)) / k, (G - 26) / k);
  return x;
}

function herder(ctx, o, k) {
  const L = o.level, f = o.f;
  const kind = farmerKind(f);
  const X = Math.round(o.x * k), G = Math.round(o.ground * k) - Math.round(o.hop || 0);
  const dir = o.carrying ? 1 : -1;
  const flip = dir < 0;
  const dog = (x, ph) => {
    const fr = (Math.floor(o.now / 120 + ph) % 2);
    blit(ctx, `dog_${fr}`, x - 6, G - 10 - (o.walking ? fr : 0), flip);
  };
  if (L <= 4) {
    let end = herd(ctx, o, k, X - dir * 12, G, dir);
    personAt(ctx, kind, X, G, o.walking ? `walk${stepOf(o) + 1}` : 'stand', flip);
    if (L >= 1 && L <= 2) { personAt(ctx, 'boy', end - dir * 4, G, o.walking ? `walk${stepOf(o, 0.5) + 1}` : 'stand', flip); end -= dir * 12; }
    if (L === 2) personAt(ctx, 'nonna', end - dir * 4, G, o.walking ? `walk${stepOf(o, 0.3) + 1}` : 'stand', flip);
    if (L >= 3) dog(end - dir * 6, 0.7);
    if (L === 4) dog(X + dir * 12, 2.2);
    return;
  }
  if (L === 5) {
    herd(ctx, o, k, X - dir * 20, G, dir);
    const fr = o.walking ? Math.floor(o.now / 130) % 2 : 0;
    const m = meta(`horse_${fr}`);
    const [w, h] = m.r.slice(2);
    const left = X - Math.floor(w / 2), top = G - h;
    bust(ctx, kind, flip ? left + w - 1 - m.seat[0] : left + m.seat[0], top + m.seat[1] + 1, flip);
    blit(ctx, `horse_${fr}`, left, top, flip);
    return;
  }
  if (L === 6 || L === 7 || L === 8) {
    const veh = L === 8 ? 'offroad' : 'quad';
    const end = herd(ctx, o, k, X - dir * (L === 8 ? 24 : 16), G, dir);
    const m = meta(veh);
    const [w, h] = m.r.slice(2);
    const left = X - Math.floor(w / 2), top = G - h;
    if (L === 8) {
      blit(ctx, veh, left, top, flip);
      bust(ctx, kind, flip ? left + w - 1 - m.seat[0] : left + m.seat[0], top + m.seat[1], flip);
    } else {
      bust(ctx, kind, flip ? left + w - 1 - m.seat[0] : left + m.seat[0], top + m.seat[1] + 2, flip);
      blit(ctx, veh, left, top, flip);
    }
    const fr = ((Math.floor(o.x * k / 3) % 4) + 4) % 4;
    for (const [cx, cy, r] of m.wheels) blit(ctx, `wheel_${r}_${fr}`, (flip ? left + w - 1 - cx : left + cx) - r, top + cy - r);
    if (L >= 7) dog(end - dir * 6, 0.7);
    return;
  }
  if (L === 9) {
    const end = herd(ctx, o, k, X - dir * 12, G, dir);
    personAt(ctx, kind, X, G, o.walking ? `walk${stepOf(o) + 1}` : 'stand', flip);
    const dx = Math.round((X + end) / 2), dy = G - 34 + Math.round(Math.sin(o.now / 150) * 2);
    blit(ctx, `drone_${Math.floor(o.now / 60) % 2}`, dx - 9, dy, flip);
    return;
  }
  personAt(ctx, kind, Math.round((o.dropX + 10) * k), G, 'tablet', true);
  herd(ctx, o, k, X - dir * 16, G, dir);
  const m = meta('robot_herder');
  const [w, h] = m.r.slice(2);
  const left = X - Math.floor(w / 2), top = G - h;
  blit(ctx, 'robot_herder', left, top, flip);
  const fr = ((Math.floor(o.x * k / 3) % 4) + 4) % 4;
  for (const [cx, cy, r] of m.wheels) blit(ctx, `wheel_${r}_${fr}`, (flip ? left + w - 1 - cx : left + cx) - r, top + cy - r);
}

// ------------------------------------------------------------------ labels (sharp text)
export function drawLabels(ctx) {
  if (!labels.length) return;
  ctx.font = '800 12px "Chakra Petch", system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const l of labels) {
    ctx.textAlign = l.align;
    ctx.lineWidth = 3; ctx.strokeStyle = '#fbf7ef';
    ctx.strokeText(l.txt, l.x, l.y);
    ctx.fillStyle = '#22313a';
    ctx.fillText(l.txt, l.x, l.y);
  }
  ctx.textBaseline = 'alphabetic';
  labels = [];
}

// ------------------------------------------------------------------ axis icons for the plot
const AXIS_ICON = { '🌾': 'ic_feed', '🥛': 'ic_milk', '☀️': 'ic_sun', '🥚': 'ic_egg' };
export function axisIcon(f, which) {
  const ch = which === 'x' ? f.xIcon : f.yIcon;
  return ch ? (AXIS_ICON[ch] || unitSprite(f)) : unitSprite(f);
}
// Draw a small (1x) or big (2x) icon centred at CSS (x, y).
export function drawIcon(ctx, name, x, y, big) {
  withPixels(ctx, (k) => {
    const [w, h] = size(name);
    const s = Math.max(1, Math.round(k * 1.5)) * (big ? 2 : 1);
    blit(ctx, name, Math.round(x * k - (w * s) / 2), Math.round(y * k - (h * s) / 2), false, s);
  });
}
