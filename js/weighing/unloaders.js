// How the farmer unloads the truck, for every "Scarico" level 0..10 (config: BELT_BOXES).
// Crops: first more people, then one farmer with better and better tools.
// Livestock: more people, then dogs, a horse, a quad, an off-road car, a drone, a robot.
// Everything is canvas shapes plus a few emoji. Sizes scale with the scene height.
import { C, rrect, drawStack, emoji, wheel } from './draw.js';

export const UNLOADER_NAMES = [
  'A mano', 'Con Ciro, il figlio', 'Con Ciro e nonna Titina', 'Carrello', 'Carriola', 'Transpallet',
  'Muletto', 'Trattore con pala', 'Sollevatore telescopico', 'Braccio robotico', 'Robot autonomo',
];
export const HERDER_NAMES = [
  'A piedi', 'Con Ciro, il figlio', 'Con Ciro e nonna Titina', 'Con il cane pastore', 'Con due cani',
  'A cavallo', 'In quad', 'In quad con il cane', 'In fuoristrada', 'Con il drone', 'Robot pastore',
];

const HELPERS = [{ face: '👦', name: 'Ciro' }, { face: '👵', name: 'Titina' }];

// o = { level, animal, x, ground, H, now, carrying, walking, boxes, unit, face,
//       tripP (0..1 over carry + return, or null), pickX, dropX, idleX, lift (0..1) }
export function drawUnloader(ctx, o) {
  if (o.animal) drawHerder(ctx, o); else drawCarrier(ctx, o);
}

function bobOf(o, phase = 0) {
  return o.walking ? Math.abs(Math.sin(o.now / 70 + phase)) * 3 : 0;
}

function person(ctx, face, x, ground, size, bob) {
  emoji(ctx, face, x, ground - 2 - bob, size);
}

function drawCarrier(ctx, o) {
  const { level: L, x, ground, H, now, carrying, unit } = o;
  const k = H / 100; // tools are drawn a bit larger than the scene scale so they read next to the emoji
  const fs = Math.min(38, H * 0.34);
  const b = bobOf(o);
  const n = o.boxes;
  const bw = 15 * k, bh = 10 * k;

  if (L <= 2) {
    // people carrying boxes in their arms
    const people = [{ face: o.face, x, size: fs }];
    if (L >= 1) people.push({ face: HELPERS[0].face, x: x - fs * 0.75, size: fs * 0.85 });
    if (L >= 2) people.push({ face: HELPERS[1].face, x: x - fs * 1.45, size: fs * 0.85 });
    people.forEach((p, i) => {
      const bb = bobOf(o, i * 1.7);
      person(ctx, p.face, p.x, ground, p.size, bb);
      if (carrying) {
        const share = Math.floor(n / people.length) + (i < n % people.length ? 1 : 0);
        if (share > 0) drawStack(ctx, p.x, ground - p.size * 0.85 - bb, share, unit, 1, bw * 1.1, bh * 1.1);
      }
    });
    return;
  }

  if (L === 3) {
    // hand truck (carrello): load at x, farmer pushing from the right
    const fx = x + 16 * k;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2 * k;
    ctx.beginPath(); ctx.moveTo(x - 6 * k, ground - 3 * k); ctx.lineTo(x + 8 * k, ground - 3 * k); ctx.lineTo(x + 10 * k, ground - 46 * k); ctx.lineTo(fx - 4 * k, ground - 50 * k); ctx.stroke();
    wheel(ctx, x + 6 * k, ground - 4 * k, 4 * k, -x / 4);
    if (carrying) drawStack(ctx, x + 1 * k, ground - 5 * k, n, unit, 1, bw, bh);
    person(ctx, o.face, fx, ground, fs, b);
    return;
  }
  if (L === 4) {
    // wheelbarrow (carriola): wheel on the truck side, handles to the farmer
    const fx = x + 20 * k;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(x - 12 * k, ground - 5 * k); ctx.lineTo(fx - 3 * k, ground - 20 * k); ctx.stroke();
    ctx.fillStyle = C.tomato;
    ctx.beginPath(); ctx.moveTo(x - 14 * k, ground - 18 * k); ctx.lineTo(x + 12 * k, ground - 18 * k); ctx.lineTo(x + 6 * k, ground - 8 * k); ctx.lineTo(x - 9 * k, ground - 8 * k); ctx.closePath(); ctx.fill();
    wheel(ctx, x - 12 * k, ground - 5 * k, 5 * k, -x / 5);
    if (carrying) drawStack(ctx, x - 1 * k, ground - 17 * k, n, unit, 2, bw, bh);
    person(ctx, o.face, fx, ground, fs, b);
    return;
  }
  if (L === 5) {
    // pallet jack (transpallet)
    const fx = x + 22 * k;
    ctx.fillStyle = C.wood; ctx.fillRect(x - 17 * k, ground - 7 * k, 34 * k, 4 * k);
    ctx.fillStyle = C.soil; for (const dx of [-15, -2, 11]) ctx.fillRect(x + dx * k, ground - 4 * k, 4 * k, 3 * k);
    ctx.strokeStyle = C.tomato; ctx.lineWidth = 2.2 * k;
    ctx.beginPath(); ctx.moveTo(x + 15 * k, ground - 5 * k); ctx.lineTo(fx - 4 * k, ground - 28 * k); ctx.stroke();
    ctx.fillStyle = C.tomato; ctx.fillRect(fx - 7 * k, ground - 30 * k, 6 * k, 3 * k);
    if (carrying) drawStack(ctx, x, ground - 7 * k, n, unit, 3, bw * 0.95, bh);
    person(ctx, o.face, fx, ground, fs, b);
    return;
  }
  if (L === 6) {
    // small forklift (muletto): forks on the truck side, driver in the seat
    const bx = x + 12 * k;
    const lift = carrying ? 8 * k : 0;
    ctx.fillStyle = C.ink; ctx.fillRect(x + 7 * k, ground - 44 * k, 3 * k, 42 * k); // mast
    ctx.fillRect(x - 12 * k, ground - 5 * k - lift, 21 * k, 2.5 * k); // forks
    ctx.fillStyle = C.sun; rrect(ctx, bx, ground - 22 * k, 26 * k, 16 * k, 3 * k); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8 * k;
    ctx.beginPath(); ctx.moveTo(bx + 2 * k, ground - 22 * k); ctx.lineTo(bx + 4 * k, ground - 42 * k); ctx.lineTo(bx + 22 * k, ground - 42 * k); ctx.lineTo(bx + 24 * k, ground - 22 * k); ctx.stroke();
    person(ctx, o.face, bx + 13 * k, ground - 16 * k, fs * 0.62, 0);
    wheel(ctx, bx + 5 * k, ground - 5 * k, 5 * k, -x / 5);
    wheel(ctx, bx + 21 * k, ground - 5 * k, 5 * k, -x / 5);
    if (carrying) drawStack(ctx, x - 3 * k, ground - 7 * k - lift, n, unit, 2, bw * 0.95, bh * 0.9);
    return;
  }
  if (L === 7) {
    // tractor with a front loader: bucket on the truck side
    const tx = x + 16 * k;
    const lift = carrying ? 12 * k : 0;
    ctx.fillStyle = C.olive;
    rrect(ctx, tx, ground - 26 * k, 30 * k, 13 * k, 3 * k); ctx.fill();
    ctx.fillRect(tx + 14 * k, ground - 46 * k, 2.5 * k, 22 * k); ctx.fillRect(tx + 28 * k, ground - 46 * k, 2.5 * k, 22 * k);
    rrect(ctx, tx + 12 * k, ground - 48 * k, 20 * k, 3 * k, 1.5 * k); ctx.fill();
    ctx.fillStyle = 'rgba(207,227,232,0.7)'; ctx.fillRect(tx + 16.5 * k, ground - 45 * k, 11.5 * k, 12 * k);
    person(ctx, o.face, tx + 22 * k, ground - 25 * k, fs * 0.55, 0);
    ctx.strokeStyle = C.olive; ctx.lineWidth = 3 * k;
    ctx.beginPath(); ctx.moveTo(tx + 8 * k, ground - 22 * k); ctx.lineTo(x + 4 * k, ground - 10 * k - lift); ctx.stroke();
    ctx.fillStyle = C.tomato;
    ctx.beginPath(); ctx.moveTo(x - 16 * k, ground - 18 * k - lift); ctx.lineTo(x - 14 * k, ground - 4 * k - lift); ctx.lineTo(x + 8 * k, ground - 4 * k - lift); ctx.lineTo(x + 8 * k, ground - 12 * k - lift); ctx.closePath(); ctx.fill();
    wheel(ctx, tx + 5 * k, ground - 6 * k, 6 * k, -x / 6);
    wheel(ctx, tx + 24 * k, ground - 10 * k, 10 * k, -x / 10);
    if (carrying) drawStack(ctx, x - 4 * k, ground - 5 * k - lift, n, unit, 3, bw * 0.85, bh * 0.85);
    return;
  }
  if (L === 8) {
    // telehandler: long boom reaching over to the truck side
    const tx = x + 18 * k;
    const lift = carrying ? 16 * k : 4 * k;
    ctx.fillStyle = C.tomato; rrect(ctx, tx, ground - 20 * k, 36 * k, 13 * k, 3 * k); ctx.fill();
    ctx.fillStyle = C.ink; rrect(ctx, tx + 18 * k, ground - 36 * k, 14 * k, 17 * k, 2 * k); ctx.fill();
    ctx.fillStyle = 'rgba(207,227,232,0.8)'; ctx.fillRect(tx + 20 * k, ground - 34 * k, 10 * k, 9 * k);
    person(ctx, o.face, tx + 25 * k, ground - 21 * k, fs * 0.5, 0);
    ctx.strokeStyle = C.sun; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx + 20 * k, ground - 22 * k); ctx.lineTo(x + 6 * k, ground - 22 * k - lift); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = C.ink; ctx.fillRect(x + 4 * k, ground - 30 * k - lift, 2.5 * k, 12 * k); ctx.fillRect(x - 14 * k, ground - 19 * k - lift, 20 * k, 2 * k);
    wheel(ctx, tx + 7 * k, ground - 7 * k, 7 * k, -x / 7);
    wheel(ctx, tx + 30 * k, ground - 7 * k, 7 * k, -x / 7);
    if (carrying) drawStack(ctx, x - 5 * k, ground - 19 * k - lift, n, unit, 3, bw * 0.8, bh * 0.8);
    return;
  }
  if (L === 9) {
    // robot arm on a fixed base between truck and belt; the farmer watches
    const baseX = (o.pickX + o.dropX) / 2, baseY = ground - 6 * k;
    person(ctx, o.face, o.dropX + 8 * k, ground, fs * 0.9, 0);
    let ex, ey;
    const p = o.tripP;
    const rest = { x: baseX + 4 * k, y: ground - 44 * k };
    const pick = { x: o.pickX - 2 * k, y: ground - 32 * k };
    const drop = { x: o.dropX + 2 * k, y: ground - 30 * k };
    if (p == null) { ex = rest.x; ey = rest.y; }
    else if (p < 0.3) { const t = p / 0.3; ex = rest.x + (pick.x - rest.x) * t; ey = rest.y + (pick.y - rest.y) * t; }
    else if (p < 0.75) { const t = (p - 0.3) / 0.45; ex = pick.x + (drop.x - pick.x) * t; ey = pick.y + (drop.y - pick.y) * t - Math.sin(t * Math.PI) * 18 * k; }
    else { const t = (p - 0.75) / 0.25; ex = drop.x + (rest.x - drop.x) * t; ey = drop.y + (rest.y - drop.y) * t; }
    // two-segment arm: elbow above the midpoint
    const ux = baseX, uy = ground - 20 * k;
    const mx = (ux + ex) / 2, my = Math.min(uy, ey) - 16 * k;
    ctx.fillStyle = C.ink; rrect(ctx, baseX - 9 * k, baseY, 18 * k, 6 * k, 2 * k); ctx.fill();
    ctx.fillStyle = C.sky; rrect(ctx, baseX - 5 * k, ground - 20 * k, 10 * k, 16 * k, 3 * k); ctx.fill();
    ctx.strokeStyle = C.sky; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = C.cream; for (const [jx, jy] of [[ux, uy], [mx, my]]) { ctx.beginPath(); ctx.arc(jx, jy, 2.5 * k, 0, 7); ctx.fill(); }
    ctx.fillStyle = Math.floor(now / 250) % 2 ? C.tomato : C.sun; ctx.beginPath(); ctx.arc(baseX, ground - 14 * k, 1.8 * k, 0, 7); ctx.fill();
    // gripper and load
    ctx.fillStyle = C.ink; ctx.fillRect(ex - 9 * k, ey, 18 * k, 2.5 * k);
    if (carrying && p != null && p >= 0.3 && p < 0.75) drawStack(ctx, ex, ey + 2.5 * k + Math.ceil(n / 3) * bh * 0.8, n, unit, 3, bw * 0.8, bh * 0.8);
    return;
  }
  // level 10: autonomous robot, farmer supervising with a tablet
  person(ctx, o.face, o.dropX + 8 * k, ground, fs * 0.9, 0);
  emoji(ctx, '📱', o.dropX + 18 * k, ground - fs * 0.35, fs * 0.4);
  const rx = x, ry = ground - 8 * k;
  ctx.fillStyle = C.cream; rrect(ctx, rx - 16 * k, ry - 16 * k, 32 * k, 14 * k, 5 * k); ctx.fill();
  ctx.strokeStyle = C.sky; ctx.lineWidth = 1.5 * k; rrect(ctx, rx - 16 * k, ry - 16 * k, 32 * k, 14 * k, 5 * k); ctx.stroke();
  ctx.fillStyle = C.ink; rrect(ctx, rx + 4 * k, ry - 13 * k, 10 * k, 8 * k, 2 * k); ctx.fill();
  const blink = Math.floor(now / 1700) % 6 === 0;
  ctx.fillStyle = C.sky;
  if (!blink) { ctx.beginPath(); ctx.arc(rx + 7 * k, ry - 9 * k, 1.3 * k, 0, 7); ctx.arc(rx + 11 * k, ry - 9 * k, 1.3 * k, 0, 7); ctx.fill(); }
  else ctx.fillRect(rx + 6 * k, ry - 9 * k, 6 * k, 1 * k);
  ctx.fillStyle = `rgba(74,143,163,${0.5 + 0.4 * Math.sin(now / 200)})`; ctx.fillRect(rx - 14 * k, ry - 4 * k, 28 * k, 1.5 * k);
  for (const dx of [-11, -3, 5, 12]) wheel(ctx, rx + dx * k, ground - 3.5 * k, 3.5 * k, -x / 3.5);
  ctx.fillStyle = '#9A9189'; ctx.fillRect(rx - 15 * k, ry - 18 * k, 30 * k, 2 * k);
  if (carrying) {
    const shown = Math.min(n, 12);   // big loads: draw 12 boxes and a count
    drawStack(ctx, rx, ry - 18 * k, shown, unit, 3, bw * 0.8, bh * 0.75);
    if (n > shown) {
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = C.cream; ctx.fillStyle = C.soil;
      const ty = ry - 18 * k - Math.ceil(shown / 3) * bh * 0.75 - 10;
      ctx.strokeText(`+${n - shown}`, rx, ty);
      ctx.fillText(`+${n - shown}`, rx, ty);
    }
  }
}

function drawHerder(ctx, o) {
  const { level: L, x, ground, H, now, carrying, unit } = o;
  const k = H / 100;
  const fs = Math.min(38, H * 0.34);
  const us = Math.min(26, H * 0.24);
  const b = bobOf(o);
  const count = o.boxes * (o.unitsPerBox || 3);

  // the animals of this trip follow the leader in a line (to the left)
  const herd = (fromX) => {
    if (!carrying) return fromX;
    const drawn = Math.min(count, 3);
    for (let i = 0; i < drawn; i++) {
      const bb = Math.abs(Math.sin(now / 90 + i)) * 2;
      emoji(ctx, unit, fromX - i * us * 0.55, ground - 2 - bb, us);
    }
    if (count > drawn) {
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = C.cream; ctx.fillStyle = C.soil;
      ctx.strokeText(`+${count - drawn}`, fromX - us * 0.5, ground - us - 4);
      ctx.fillText(`+${count - drawn}`, fromX - us * 0.5, ground - us - 4);
    }
    return fromX - drawn * us * 0.55 - us * 0.3;
  };

  if (L <= 2) {
    person(ctx, o.face, x, ground, fs, b);
    let end = herd(x - fs * 0.7);
    if (L >= 1) { person(ctx, HELPERS[0].face, end - 2 * k, ground, fs * 0.8, bobOf(o, 1.3)); end -= 16 * k; }
    if (L >= 2) person(ctx, HELPERS[1].face, end - 6 * k, ground, fs * 0.8, bobOf(o, 2.1));
    return;
  }
  if (L === 3 || L === 4) {
    person(ctx, o.face, x, ground, fs, b);
    const end = herd(x - fs * 0.7);
    emoji(ctx, '🐕', end - 2 * k, ground - 2 - bobOf(o, 0.7), us * 0.9);
    if (L === 4) emoji(ctx, '🐕', x + fs * 0.55, ground - 2 - bobOf(o, 2.2), us * 0.8);
    return;
  }
  if (L === 5) {
    // on horseback
    emoji(ctx, '🐎', x, ground - 2 - b, fs * 1.1);
    person(ctx, o.face, x - 2 * k, ground - fs * 0.62 - b, fs * 0.65, 0);
    herd(x - fs * 0.85);
    return;
  }
  if (L === 6 || L === 7) {
    // quad bike
    ctx.fillStyle = C.tomato; rrect(ctx, x - 14 * k, ground - 17 * k, 28 * k, 8 * k, 3 * k); ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillRect(x + 8 * k, ground - 24 * k, 2 * k, 8 * k); ctx.fillRect(x + 5 * k, ground - 25 * k, 8 * k, 2 * k);
    wheel(ctx, x - 9 * k, ground - 6 * k, 6 * k, -x / 6); wheel(ctx, x + 9 * k, ground - 6 * k, 6 * k, -x / 6);
    person(ctx, o.face, x, ground - 13 * k, fs * 0.7, 0);
    const end = herd(x - 18 * k);
    if (L === 7) emoji(ctx, '🐕', end - 2 * k, ground - 2 - bobOf(o, 0.7), us * 0.9);
    return;
  }
  if (L === 8) {
    // off-road car
    ctx.fillStyle = C.olive; rrect(ctx, x - 20 * k, ground - 22 * k, 40 * k, 13 * k, 3 * k); ctx.fill();
    rrect(ctx, x - 12 * k, ground - 34 * k, 22 * k, 13 * k, 3 * k); ctx.fill();
    ctx.fillStyle = C.glass; ctx.fillRect(x - 9 * k, ground - 31 * k, 16 * k, 7 * k);
    person(ctx, o.face, x - 1 * k, ground - 22 * k, fs * 0.45, 0);
    wheel(ctx, x - 12 * k, ground - 7 * k, 7 * k, -x / 7); wheel(ctx, x + 12 * k, ground - 7 * k, 7 * k, -x / 7);
    const end = herd(x - 24 * k);
    emoji(ctx, '🐕', end - 2 * k, ground - 2 - bobOf(o, 0.7), us * 0.9);
    return;
  }
  if (L === 9) {
    // farmer with a herding drone hovering over the animals
    person(ctx, o.face, x, ground, fs, b);
    herd(x - fs * 0.7);
    const dx = x - fs * 0.7 - us * 0.5, dy = ground - us - 22 * k + Math.sin(now / 150) * 2 * k;
    ctx.fillStyle = C.ink; rrect(ctx, dx - 6 * k, dy - 2 * k, 12 * k, 4 * k, 2 * k); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2 * k;
    ctx.beginPath(); ctx.moveTo(dx - 11 * k, dy - 3 * k); ctx.lineTo(dx + 11 * k, dy - 3 * k); ctx.stroke();
    const spin = Math.abs(Math.sin(now / 30));
    ctx.fillStyle = 'rgba(46,42,38,0.35)';
    for (const px of [-11, 11]) { ctx.beginPath(); ctx.ellipse(dx + px * k, dy - 4 * k, 6 * k * spin + 1, 1.2 * k, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = Math.floor(now / 300) % 2 ? C.tomato : '#9BC53D'; ctx.beginPath(); ctx.arc(dx, dy + 3 * k, 1.3 * k, 0, 7); ctx.fill();
    return;
  }
  // level 10: robot herder leading the animals, farmer with a tablet
  person(ctx, o.face, o.dropX + 8 * k, ground, fs * 0.9, 0);
  emoji(ctx, '📱', o.dropX + 18 * k, ground - fs * 0.35, fs * 0.4);
  ctx.fillStyle = C.cream; rrect(ctx, x - 12 * k, ground - 20 * k, 24 * k, 13 * k, 5 * k); ctx.fill();
  ctx.strokeStyle = C.sky; ctx.lineWidth = 1.5 * k; rrect(ctx, x - 12 * k, ground - 20 * k, 24 * k, 13 * k, 5 * k); ctx.stroke();
  ctx.fillStyle = C.ink; rrect(ctx, x - 1 * k, ground - 18 * k, 10 * k, 7 * k, 2 * k); ctx.fill();
  ctx.fillStyle = C.sky; ctx.beginPath(); ctx.arc(x + 2 * k, ground - 14.5 * k, 1.2 * k, 0, 7); ctx.arc(x + 6 * k, ground - 14.5 * k, 1.2 * k, 0, 7); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1 * k; ctx.beginPath(); ctx.moveTo(x - 6 * k, ground - 20 * k); ctx.lineTo(x - 6 * k, ground - 30 * k); ctx.stroke();
  ctx.fillStyle = C.tomato; ctx.beginPath(); ctx.moveTo(x - 6 * k, ground - 30 * k); ctx.lineTo(x + 2 * k, ground - 27 * k); ctx.lineTo(x - 6 * k, ground - 24 * k); ctx.fill();
  for (const dx of [-8, 0, 8]) wheel(ctx, x + dx * k, ground - 3.5 * k, 3.5 * k, -x / 3.5);
  herd(x - 16 * k);
}
