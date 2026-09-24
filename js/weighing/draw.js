// Small shared canvas helpers for the weighing station.

export const C = {
  soil: '#5B3A29', olive: '#6B7F2A', wheat: '#E9D8A6', cream: '#FBF7EF',
  tomato: '#D9502B', sky: '#4A8FA3', sun: '#F4C95D', ink: '#2E2A26', glass: '#CFE3E8',
  wood: '#A0703F', harvest: '#B89A5E', grid: 'rgba(91,58,41,0.08)',
};
export const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"';

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

// One crate in pseudo-3D: front face, top face, right side. (x, y) = bottom-left of the front face.
export function drawBox(ctx, x, y, w, h, dx, dy, unit) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.soil;
  ctx.fillStyle = '#C08A52'; // top
  ctx.beginPath();
  ctx.moveTo(x, y - h); ctx.lineTo(x + dx, y - h - dy); ctx.lineTo(x + w + dx, y - h - dy); ctx.lineTo(x + w, y - h);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7E5530'; // side
  ctx.beginPath();
  ctx.moveTo(x + w, y); ctx.lineTo(x + w, y - h); ctx.lineTo(x + w + dx, y - h - dy); ctx.lineTo(x + w + dx, y - dy);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#A0703F'; // front
  ctx.fillRect(x, y - h, w, h);
  ctx.strokeRect(x, y - h, w, h);
  ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w, y - h / 2); ctx.stroke();
  if (unit) {
    const sz = Math.max(8, h * 0.95);
    ctx.font = `${sz}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(unit, x + w / 2 + dx / 2, y - h - dy * 0.3);
  }
}

// n boxes stacked `cols` wide, bottom-centre at (cx, bottomY), each box bw x bh.
export function drawStack(ctx, cx, bottomY, n, unit, cols, bw, bh) {
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = cx - (cols * bw) / 2 + c * bw;
    const y = bottomY - r * bh;
    const top = r === rows - 1 || i + cols >= n;
    drawBox(ctx, x, y, bw - 1, bh - 1, bw * 0.2, bh * 0.25, top ? unit : null);
  }
}

export function emoji(ctx, ch, x, y, size) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(ch, x, y);
}

export function wheel(ctx, x, y, r, rot = 0) {
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#9A9189';
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 7); ctx.fill();
  if (r > 4) {
    ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(rot) * r * 0.42, y - Math.sin(rot) * r * 0.42);
    ctx.lineTo(x + Math.cos(rot) * r * 0.42, y + Math.sin(rot) * r * 0.42);
    ctx.stroke();
  }
}
