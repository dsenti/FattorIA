// Minigame 4: Il pascolo. High in the mountains, every herd only listens to the sheepdog with its
// colour. Drag each dog to the middle of its herd, then blow the whistle: around every dog a
// circle shows how far it is from the middle of its herd (not in which direction). The level is
// passed when every dog is close enough; fewer whistles, more stars. The middle of a group is
// what k-means calls the centre (centroide).
import { CONFIG } from '../config.js';
import { fitPixelCanvas } from '../pixel.js';
import { withPixels, blit, size, onSpritesReady, spriteImgHTML } from '../weighing/sprites.js';
import { HERD_LEVELS } from './levels.js';
import { makeSheep, centres, whistle, payFor, starsFor, levelOpen } from './model.js';

const TRAY = 62;          // the dogs' tray at the bottom of the canvas, CSS px
const TOP = 0.24;         // the mountains take the top of the picture
const HIT = 26;
const COL = { r: '#d8604c', b: '#4f78b0', y: '#e0ac3c', p: '#7a62a4' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - t) ** 3;

export function helpHTML() {
  return '<h2>Il pascolo</h2>' +
    '<p>In montagna ogni gregge ascolta solo il cane con il suo colore. Trascina ogni cane <b>nel mezzo</b> del suo gregge.</p>' +
    '<p>Poi fischia: intorno a ogni cane un cerchio mostra quanto è lontano dal mezzo del gregge (non da che parte). Verde: ci sei!</p>' +
    '<p>Il mezzo di un gruppo è il suo <b>centro</b> <em>(centroid)</em>: la media delle posizioni.</p>';
}

export class HerdGame {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      canvas: $('h-field'), levels: $('h-levels'), levelNo: $('h-level-no'), count: $('h-count'),
      result: $('h-result'), whistle: $('h-whistle'), next: $('h-next'), restart: $('h-restart'),
    };
    this.loop = (t) => this.frame(t);
    this.li = 0;
    const c = this.el.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', () => this.up());
    c.addEventListener('pointercancel', () => this.up());
    this.el.whistle.addEventListener('click', () => this.blow());
    this.el.next.addEventListener('click', () => this.load(Math.min(this.li + 1, HERD_LEVELS.length - 1)));
    this.el.restart.addEventListener('click', () => this.load(this.li));
    this.el.levels.addEventListener('click', () => this.openLevels());
    onSpritesReady(() => this.renderBar());
  }

  get herd() { return this.app.getState().herd; }

  show() {
    this.active = true;
    let i = HERD_LEVELS.findIndex((l) => l.id === this.herd.current);
    if (i < 0) i = this.firstUnpassed();
    this.load(i);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }
  hide() { this.active = false; cancelAnimationFrame(this.raf); }
  refresh() { this.renderBar(); }
  reset() { this.li = 0; this.sheep = null; }
  firstUnpassed() {
    const i = HERD_LEVELS.findIndex((l) => !this.herd.passed.includes(l.id));
    return i < 0 ? 0 : i;
  }

  load(i) {
    if (!levelOpen(this.herd, i, HERD_LEVELS)) i = this.firstUnpassed();
    this.li = i;
    this.lv = HERD_LEVELS[i];
    this.herd.current = this.lv.id;
    this.app.save();
    this.sheep = makeSheep(this.lv, i + 1);
    this.centres = centres(this.lv, this.sheep);
    this.dogs = this.lv.herds.map(() => null);
    this.rings = this.lv.herds.map(() => null);
    this.whistles = 0;
    this.drag = null;
    this.outcome = null;
    this.gatherT0 = null;
    this.renderBar();
    this.renderResult();
  }

  // ------------------------------------------------------------ geometry
  geo() {
    const r = this.el.canvas.getBoundingClientRect();
    const top = r.height * TOP, bottom = r.height - TRAY - 8;
    return { r, x0: 14, y0: top, w: r.width - 28, h: bottom - top, trayY: r.height - TRAY };
  }
  unitToPx(g, p) { return { x: g.x0 + p.x * g.w, y: g.y0 + p.y * g.h }; }
  trayPos(g, i) {
    const n = this.lv.herds.length;
    return { x: g.r.width / 2 + (i - (n - 1) / 2) * 56, y: g.trayY + TRAY / 2 + 4 };
  }
  dogPx(g, i) {
    if (this.drag && this.drag.i === i) return { x: this.drag.x, y: this.drag.y };
    return this.dogs[i] ? this.unitToPx(g, this.dogs[i]) : this.trayPos(g, i);
  }

  // ------------------------------------------------------------ dragging the dogs
  down(e) {
    if (this.outcome && this.outcome.pass) return;
    const g = this.geo();
    const x = e.clientX - g.r.left, y = e.clientY - g.r.top;
    let best = -1, bd = HIT;
    this.lv.herds.forEach((_, i) => {
      const p = this.dogPx(g, i);
      const d = Math.hypot(p.x - x, p.y - 4 - y);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return;
    this.el.canvas.setPointerCapture(e.pointerId);
    this.drag = { i: best, x, y };
    this.rings[best] = null;
  }
  move(e) {
    if (!this.drag) return;
    const g = this.geo();
    this.drag.x = e.clientX - g.r.left;
    this.drag.y = e.clientY - g.r.top;
  }
  up() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const g = this.geo();
    if (d.y > g.trayY - 4) this.dogs[d.i] = null;   // back into the tray
    else this.dogs[d.i] = { x: clamp((d.x - g.x0) / g.w, 0, 1), y: clamp((d.y - g.y0) / g.h, 0, 1) };
    this.renderBar();
  }

  // ------------------------------------------------------------ the whistle
  blow() {
    if (this.dogs.some((d) => !d) || (this.outcome && this.outcome.pass)) return;
    this.whistles += 1;
    this.blowT0 = performance.now();
    const g = this.geo();
    const w = whistle(this.lv, this.sheep, this.dogs, g.w, g.h);
    this.rings = w.res.map((r) => ({ ...r, t: performance.now() }));
    if (w.pass) {
      const replay = this.herd.passed.includes(this.lv.id);
      const coins = payFor(this.whistles, replay);
      const stars = starsFor(this.whistles);
      if (!replay) this.herd.passed.push(this.lv.id);
      this.herd.stars[this.lv.id] = Math.max(this.herd.stars[this.lv.id] || 0, stars);
      this.app.save();
      this.app.earn({ coins });
      this.outcome = { pass: true, coins, stars };
      this.gatherT0 = performance.now();
    } else {
      this.outcome = { pass: false, ok: w.res.filter((r) => r.ok).length, n: w.res.length };
    }
    this.renderBar();
    this.renderResult();
  }

  // ------------------------------------------------------------ drawing
  frame(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    this.draw(now);
  }

  draw(now) {
    const { ctx, W, H } = fitPixelCanvas(this.el.canvas);
    ctx.clearRect(0, 0, W, H);
    if (!this.sheep) return;
    const g = this.geo();
    const gp = this.gatherT0 ? ease(clamp((now - this.gatherT0) / CONFIG.HERD.GATHER_MS, 0, 1)) : 0;
    withPixels(ctx, (k) => {
      // the tray
      ctx.fillStyle = '#6b4b33'; ctx.fillRect(0, Math.round(g.trayY * k), Math.ceil(W * k), Math.ceil(TRAY * k) + 2);
      ctx.fillStyle = '#8b6849'; ctx.fillRect(0, Math.round(g.trayY * k), Math.ceil(W * k), 2);
      ctx.fillStyle = '#4a3424';
      for (let x = 0; x < W * k; x += 22) ctx.fillRect(x, Math.round(g.trayY * k) + 2, 1, Math.ceil(TRAY * k));
      // the rings from the last whistle (radius = distance to the middle of the herd)
      this.rings.forEach((r, i) => {
        if (!r || !this.dogs[i]) return;
        const p = this.unitToPx(g, this.dogs[i]);
        const rad = r.dist * Math.min(g.w, g.h);
        const grow = clamp((now - r.t) / 400, 0, 1);
        const col = r.ok ? '#5f9c6a' : r.near ? '#e0ac3c' : '#d8604c';
        this.circle(ctx, p.x * k, p.y * k, Math.max(3, rad * k * grow), col);
      });
      // the sheep, back to front (after a passing whistle they run to their dog)
      const order = this.sheep.map((s, i) => i).sort((a, b) => this.sheep[a].y - this.sheep[b].y);
      for (const i of order) {
        const s = this.sheep[i];
        let p = this.unitToPx(g, s);
        if (gp > 0) {
          const d = this.unitToPx(g, this.dogs[s.h]);
          const ang = (i * 2.399) % (Math.PI * 2), rr = 10 + (i % 4) * 5;
          p = { x: p.x + (d.x + Math.cos(ang) * rr - p.x) * gp, y: p.y + (d.y + Math.sin(ang) * rr * 0.6 - p.y) * gp };
        }
        const tag = this.lv.herds[s.h].c;
        const fr = Math.floor(now / 500 + i * 0.7) % 2;
        const name = `sheep_${tag}_${fr}`;
        const [sw, sh] = size(name);
        blit(ctx, name, Math.round(p.x * k - sw / 2), Math.round(p.y * k - sh + 2), (i % 3) === 0);
      }
      // the dogs
      this.lv.herds.forEach((hd, i) => {
        const p = this.dogPx(g, i);
        const ok = this.rings[i] && this.rings[i].ok;
        const name = `sdog_${hd.c}_${ok || !this.dogs[i] ? 'sit' : 'stand'}`;
        const [sw, sh] = size(name);
        const lift = this.drag && this.drag.i === i ? 6 : 0;
        // a disc in the herd's colour under the dog: which herd listens to it
        const sc = this.dogs[i] && !lift ? 1 : 2;   // bigger in the tray and in the hand
        const cx = Math.round(p.x * k), cy = Math.round(p.y * k);
        const rx = 11 * sc, ry = 3 * sc;
        for (let dy = -ry; dy <= ry; dy++) {
          const half = Math.round(Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.6)) ** 2)) * rx);
          ctx.fillStyle = '#22313a'; ctx.fillRect(cx - half - 1, cy + dy, 2 * half + 2, 1);
          ctx.fillStyle = COL[hd.c]; ctx.fillRect(cx - half, cy + dy, 2 * half, 1);
        }
        ctx.fillStyle = '#22313a';
        ctx.fillRect(cx - Math.round(rx * 0.7), cy - ry - 1, Math.round(rx * 1.4), 1); ctx.fillRect(cx - Math.round(rx * 0.7), cy + ry + 1, Math.round(rx * 1.4), 1);
        blit(ctx, name, cx - Math.round(sw * sc / 2), cy - sh * sc + 2 - lift, false, sc);
      });
    });
    // ticks over the dogs that are in the middle
    ctx.font = '700 15px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.rings.forEach((r, i) => {
      if (!r || !r.ok || !this.dogs[i]) return;
      const p = this.unitToPx(g, this.dogs[i]);
      ctx.lineWidth = 3; ctx.strokeStyle = '#fbf7ef'; ctx.strokeText('✓', p.x + 10, p.y - 22);
      ctx.fillStyle = '#3f7a52'; ctx.fillText('✓', p.x + 10, p.y - 22);
    });
  }

  // a dotted pixel circle, backing pixels
  circle(ctx, cx, cy, r, col) {
    const n = Math.max(24, Math.round(r * 1.6));
    for (let i = 0; i < n; i++) {
      if (i % 3 === 2) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
    }
  }

  // ------------------------------------------------------------ bars
  renderBar() {
    if (!this.lv) return;
    this.el.levelNo.textContent = `${this.li + 1}/${HERD_LEVELS.length}`;
    this.el.count.innerHTML = `${spriteImgHTML('u_whistle', 22, 22)}<b>${this.whistles}</b>`;
    const all = this.dogs.every((d) => d);
    this.el.whistle.disabled = !all || !!(this.outcome && this.outcome.pass);
    const last = this.li === HERD_LEVELS.length - 1;
    this.el.next.disabled = !(this.herd.passed.includes(this.lv.id) && !last);
    this.el.next.classList.toggle('ready', !!(this.outcome && this.outcome.pass && !last));
  }

  renderResult() {
    const R = this.el.result;
    const o = this.outcome;
    if (!o) {
      const dots = this.lv.herds.map((hd) => `<span class="h-dot" style="background:${COL[hd.c]}"></span>`).join('');
      R.innerHTML = `<div class="o-hint">${dots}<span>→ ${spriteImgHTML('u_sheep', 22, 22)} · ${spriteImgHTML('u_whistle', 22, 22)}</span></div>`;
      return;
    }
    if (o.pass) {
      const stars = [0, 1, 2].map((i) => `<span class="o-star${i < o.stars ? ' on' : ''}"></span>`).join('');
      R.innerHTML = `<div class="o-row"><span class="o-stars">${stars}</span><b class="o-coins">+${o.coins} ${spriteImgHTML('u_coin', 18, 18)}</b><span class="o-mark">${spriteImgHTML('u_yes', 22, 22)}</span></div>`;
    } else {
      R.innerHTML = `<div class="o-row"><b class="h-okn">${o.ok}/${o.n}</b><span class="o-mark">${spriteImgHTML('u_noRed', 22, 22)}</span></div>`;
    }
  }

  openLevels() {
    this.app.openSheet('Il pascolo', (body) => {
      let html = '<div class="s-levels-grid">';
      HERD_LEVELS.forEach((lv, i) => {
        const open = levelOpen(this.herd, i, HERD_LEVELS);
        const st = this.herd.stars[lv.id] || 0;
        const stars = [0, 1, 2].map((k) => `<span class="o-star small${k < st ? ' on' : ''}"></span>`).join('');
        const dots = lv.herds.map((hd) => `<span class="h-dot small" style="background:${COL[hd.c]}"></span>`).join('');
        html += `<button class="btn s-lv${i === this.li ? ' on' : ''}${open ? '' : ' closed'}" data-i="${i}" ${open ? '' : 'disabled'}>` +
          `<span class="s-lv-no">${i + 1}</span><span class="o-lv-f">${dots}</span><span class="s-lv-b">${open ? stars : spriteImgHTML('u_lock', 16, 16)}</span></button>`;
      });
      body.innerHTML = html + '</div>';
      body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { this.app.closeSheet(); this.load(Number(b.dataset.i)); }));
    });
  }
}
