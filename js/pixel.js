// The pixel look: everything is drawn on a grid of "art pixels" PX CSS px wide (1.5 = style 3,
// "fine"), then shown scaled up without smoothing.
//
// - Canvases: fitPixelCanvas(canvas) replaces the usual devicePixelRatio setup. The drawing code
//   keeps working in CSS px; the backing store has one pixel per art pixel, and right after the
//   (synchronous) drawing a microtask cleans the frame: hard alpha, and anti-aliasing blends snapped
//   to the frame's real colours (or the palette), so edges come out crisp.
// - Vector art (the 40 x 40 SVG icons, items, trucks): pxArt() rasterises it once into a small
//   cleaned PNG and returns an <img>; until that is ready it returns the vector art, which is swapped
//   in place when the PNG arrives. pxSymbolHTML() does the same for <symbol> defs inside an <svg>.

export const PX = 1.5;

// Style E palette, plus the colours the drawing code uses (so snapping never shifts a hue).
const PALETTE = [
  '#22313a', '#3a4850', '#55626a', '#6f7f84', '#8f9ca3', '#b8c2c6', '#dfe5e7', '#ffffff',
  '#fbf7ef', '#efe6d6', '#d9cdb8', '#b8a98f',
  '#8f4536', '#b85a47', '#e07a63', '#f2a48f',
  '#3f7a52', '#5f9c6a', '#8fc28a', '#c2e0a4',
  '#a8612c', '#c97c3f', '#f0a45e', '#f8c890',
  '#b8862d', '#d8a443', '#f5ca63', '#fbe3a0',
  '#6b4f38', '#8b6849', '#a9825c', '#c9a074', '#e2c39a',
  '#36606a', '#46737d', '#5e909b', '#8fc0c8', '#c4e3e8', '#557579',
  '#c99a7a', '#f1c9aa', '#f8dcc4', '#efe2c4', '#14121f', '#2b2842', '#5c587a',
  // drawing code
  '#d9502b', '#4a8fa3', '#e69f00', '#9bc53d', '#6b7f2a', '#0072b2', '#f4c95d', '#e9d8a6', '#6e4a2c',
  '#5b3a29', '#ec8a2e', '#9db23e', '#9a9189', '#cfe6ec', '#b8892b', '#a0703f', '#9c6b43', '#8fa53a',
  '#8c5e3c', '#3f2a1e', '#2e2a26', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#000000',
].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

const dist = (r, g, b, c) => 2 * (r - c[0]) ** 2 + 4 * (g - c[1]) ** 2 + 3 * (b - c[2]) ** 2;

// Clean an RGBA buffer in place: alpha 0/255; colours used by only a few pixels (anti-aliasing,
// blends) snap to the nearest frequent colour of this image or of the palette.
export function cleanPixels(data, total) {
  const freq = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 110) { data[i + 3] = 0; continue; }
    data[i + 3] = 255;
    const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  const thr = Math.max(4, Math.round(total * 0.0025));
  const keep = [];
  for (const [k, n] of freq) if (n >= thr) keep.push([k >> 16, (k >> 8) & 255, k & 255]);
  const cands = keep.length > 96 ? keep.slice(0, 96).concat(PALETTE) : keep.concat(PALETTE);
  const map = new Map();
  for (const [k, n] of freq) {
    if (n >= thr) continue;
    const r = k >> 16, g = (k >> 8) & 255, b = k & 255;
    let best = 0, bd = Infinity;
    for (let j = 0; j < cands.length; j++) {
      const d = dist(r, g, b, cands[j]);
      if (d < bd) { bd = d; best = j; }
    }
    map.set(k, cands[best]);
  }
  if (!map.size) return;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const c = map.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (c) { data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; }
  }
}

function cleanCanvas(canvas) {
  const w = canvas.width, h = canvas.height;
  if (w < 1 || h < 1) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  cleanPixels(img.data, w * h);
  ctx.putImageData(img, 0, 0);
}

const pending = new Set();
function schedule(canvas) {
  if (pending.has(canvas)) return;
  pending.add(canvas);
  queueMicrotask(() => { pending.delete(canvas); cleanCanvas(canvas); });
}

// Text stays sharp: fillText / strokeText on a pixel canvas draw on a full-resolution overlay
// canvas laid over it (same position and transform), so words are never pixelated.
function textLayer(canvas, r) {
  let ov = canvas.__txt;
  if (!ov && canvas.parentElement) {
    ov = document.createElement('canvas');
    ov.className = 'px-text';
    ov.setAttribute('aria-hidden', 'true');
    canvas.insertAdjacentElement('afterend', ov);
    canvas.__txt = ov;
  }
  if (!ov) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }
  const st = ov.style;
  st.left = `${canvas.offsetLeft}px`; st.top = `${canvas.offsetTop}px`;
  st.width = `${r.width}px`; st.height = `${r.height}px`;
  const o = ov.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, w, h);
  return ov;
}

function hookText(ctx, canvas) {
  if (ctx.__pxText) return;
  ctx.__pxText = true;
  const via = (method) => function (t, x, y, maxW) {
    const ov = canvas.__txt;
    if (!ov) return;
    const o = ov.getContext('2d');
    const k = ov.width / canvas.width;
    const m = ctx.getTransform();
    o.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k);
    o.font = ctx.font; o.fillStyle = ctx.fillStyle; o.strokeStyle = ctx.strokeStyle;
    o.lineWidth = ctx.lineWidth; o.lineJoin = ctx.lineJoin; o.globalAlpha = ctx.globalAlpha;
    o.textAlign = ctx.textAlign; o.textBaseline = ctx.textBaseline;
    if (maxW === undefined) o[method](t, x, y); else o[method](t, x, y, maxW);
  };
  ctx.fillText = via('fillText');
  ctx.strokeText = via('strokeText');
}

// A sharp canvas at the screen's resolution (charts, the lab field): drawing in CSS px.
export function fitSharpCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  canvas.classList.add('sharp');
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { ctx, W: r.width, H: r.height };
}

// Size a canvas to its CSS box at one backing pixel per art pixel; drawing stays in CSS px.
export function fitPixelCanvas(canvas) {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width / PX));
  const h = Math.max(1, Math.round(r.height / PX));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(w / Math.max(1, r.width), 0, 0, h / Math.max(1, r.height), 0, 0);
  ctx.imageSmoothingEnabled = false;
  textLayer(canvas, r);
  hookText(ctx, canvas);
  schedule(canvas);
  return { ctx, W: r.width, H: r.height };
}

// ------------------------------------------------------------------ vector art -> pixel images
const done = new Map();     // key -> data URL
const working = new Map();  // key -> Promise
let uid = 0;
const keys = new Map();     // markup -> short key

function keyOf(inner, w, h, vb) {
  const m = `${w}x${h}|${vb}|${inner}`;
  let k = keys.get(m);
  if (!k) { k = `p${(uid++).toString(36)}`; keys.set(m, k); }
  return k;
}

function rasterise(k, inner, w, h, vb) {
  if (working.has(k)) return working.get(k);
  const pw = Math.max(1, Math.round(w / PX)), ph = Math.max(1, Math.round(h / PX));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pw}" height="${ph}" viewBox="${vb}" preserveAspectRatio="none">${inner}</svg>`;
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = pw; c.height = ph;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, pw, ph);
        const id = ctx.getImageData(0, 0, pw, ph);
        cleanPixels(id.data, pw * ph);
        ctx.putImageData(id, 0, 0);
        const url = c.toDataURL('image/png');
        done.set(k, url);
        swapIn(k, url);
        resolve(url);
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  working.set(k, p);
  return p;
}

function imgHTML(url, w, h, cls) {
  return `<img class="px ${cls}" src="${url}" width="${w}" height="${h}" alt="" aria-hidden="true" draggable="false">`;
}

function swapIn(k, url) {
  for (const el of document.querySelectorAll(`[data-pxk="${k}"]`)) {
    if (el.tagName.toLowerCase() === 'symbol') {
      const vb = (el.getAttribute('viewBox') || '0 0 40 40').split(/\s+/).map(Number);
      el.innerHTML = `<image href="${url}" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
      el.removeAttribute('data-pxk');
    } else if (el.tagName.toLowerCase() === 'g') {
      const d = el.dataset;
      el.innerHTML = `<image href="${url}" x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
      el.removeAttribute('data-pxk');
    } else {
      const w = Number(el.dataset.w), h = Number(el.dataset.h);
      el.outerHTML = imgHTML(url, w, h, el.dataset.cls || '');
    }
  }
}

// HTML for a piece of vector art (inner markup of a viewBox) shown at w x h CSS px.
export function pxArt(inner, w, h = w, cls = '', vb = '0 0 40 40') {
  const k = keyOf(inner, w, h, vb);
  const url = done.get(k);
  if (url) return imgHTML(url, w, h, cls);
  rasterise(k, inner, w, h, vb);
  return `<span class="px-wait ${cls}" data-pxk="${k}" data-w="${w}" data-h="${h}" data-cls="${cls}" style="width:${w}px;height:${h}px">` +
    `<svg width="${w}" height="${h}" viewBox="${vb}" aria-hidden="true" focusable="false">${inner}</svg></span>`;
}

// A <symbol> whose content becomes a pixel image (drawn at `size` CSS px) once ready.
export function pxSymbolHTML(id, inner, size, vb = '0 0 40 40') {
  const k = keyOf(inner, size, size, vb);
  const url = done.get(k);
  if (url) {
    const v = vb.split(/\s+/).map(Number);
    return `<symbol id="${id}" viewBox="${vb}"><image href="${url}" x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}" preserveAspectRatio="none" style="image-rendering:pixelated"/></symbol>`;
  }
  rasterise(k, inner, size, size, vb);
  return `<symbol id="${id}" viewBox="${vb}" data-pxk="${k}">${inner}</symbol>`;
}

// Inline pixel image for an <svg> drawing (e.g. a truck), placed at x, y with size w x h.
export function pxImageSVG(inner, x, y, w, h, vb) {
  const k = keyOf(inner, w, h, vb);
  const url = done.get(k);
  if (url) return `<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
  rasterise(k, inner, w, h, vb);
  return `<g data-pxk="${k}" data-x="${x}" data-y="${y}" data-w="${w}" data-h="${h}"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="none">${inner}</svg></g>`;
}

// Resolves when every rasterisation started so far is finished (for redraws after load).
export function pxSettled() {
  return Promise.all([...working.values()]);
}
