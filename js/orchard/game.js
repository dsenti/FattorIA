// Minigame 3: Il frutteto. The goats want the fruit: swipe fences across the orchard, quickly,
// so every piece of it holds only trees or only goats. When the time is up, goats left in a piece
// of trees walk to a tree and eat it (and trees left among goats get eaten). Pass with a good
// share of the orchard right. A fence is a decision boundary (confine di decisione).
import { CONFIG } from '../config.js';
import { fitPixelCanvas } from '../pixel.js';
import { withPixels, blit, size, onSpritesReady, spriteImgHTML } from '../weighing/sprites.js';
import { ORCHARD_LEVELS } from './levels.js';
import { makeItems, evaluate, bestScore, timeFor, starsFor, payFor, clipToSquare, pieceKey, levelOpen } from './model.js';

const MARGIN = 16;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - t) ** 3;

export function helpHTML() {
  return '<h2>Il frutteto</h2>' +
    '<p>Le capre vogliono la frutta! Striscia il dito sul frutteto: nasce un recinto dritto, anche storto. Hai pochi secondi.</p>' +
    '<p>Ogni pezzo di frutteto va a chi è di più. Se in un pezzo di alberi resta una capra, mangia un albero.</p>' +
    '<p>Il recinto è un <b>confine di decisione</b> <em>(decision boundary)</em>: divide lo spazio in zone, una per tipo.</p>';
}

export class OrchardGame {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      canvas: $('o-field'), levels: $('o-levels'), levelNo: $('o-level-no'), fences: $('o-fences'),
      timer: $('o-timer'), result: $('o-result'), retry: $('o-retry'), next: $('o-next'),
    };
    this.loop = (t) => this.frame(t);
    this.li = 0;
    this.attempt = 0;
    const c = this.el.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', () => { this.swipe = null; });
    this.el.retry.addEventListener('click', () => this.load(this.li));
    this.el.next.addEventListener('click', () => this.load(Math.min(this.li + 1, ORCHARD_LEVELS.length - 1)));
    this.el.levels.addEventListener('click', () => this.openLevels());
    onSpritesReady(() => this.renderBar());
  }

  get lab() { return this.app.getState().lab; }

  show() {
    this.active = true;
    const id = this.lab.current;
    let i = ORCHARD_LEVELS.findIndex((l) => l.id === id);
    if (i < 0) i = this.firstUnpassed();
    this.load(i);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  hide() { this.active = false; cancelAnimationFrame(this.raf); }
  refresh() { this.renderBar(); }
  reset() { this.li = 0; this.items = null; }

  firstUnpassed() {
    const i = ORCHARD_LEVELS.findIndex((l) => !this.lab.passed.includes(l.id));
    return i < 0 ? 0 : i;
  }

  load(i) {
    if (!levelOpen(this.lab, i, ORCHARD_LEVELS)) i = this.firstUnpassed();
    this.li = i;
    this.lv = ORCHARD_LEVELS[i];
    this.lab.current = this.lv.id;
    this.app.save();
    this.attempt += 1;
    this.items = makeItems(this.lv, this.attempt * 13 + i);
    this.best = bestScore(this.lv, this.items);
    this.fences = [];
    this.eaten = new Set();
    this.eats = [];
    this.swipe = null;
    this.phase = 'ready';
    this.t0 = performance.now();
    this.total = timeFor(this.lv);
    this.left = this.total;
    this.outcome = null;
    this.renderBar();
    this.renderResult();
  }

  // ------------------------------------------------------------ the swipe
  geo() {
    const r = this.el.canvas.getBoundingClientRect();
    return { r, x0: MARGIN, y0: MARGIN, w: r.width - 2 * MARGIN, h: r.height - 2 * MARGIN };
  }
  toUnit(e) {
    const g = this.geo();
    return { x: (e.clientX - g.r.left - g.x0) / g.w, y: (e.clientY - g.r.top - g.y0) / g.h, px: e.clientX - g.r.left, py: e.clientY - g.r.top };
  }
  canSwipe() { return (this.phase === 'ready' || this.phase === 'play') && this.fences.length < this.lv.fences; }
  down(e) {
    if (!this.canSwipe()) return;
    this.el.canvas.setPointerCapture(e.pointerId);
    const p = this.toUnit(e);
    this.swipe = { a: p, b: p };
  }
  move(e) { if (this.swipe) this.swipe.b = this.toUnit(e); }
  up(e) {
    const s = this.swipe;
    this.swipe = null;
    if (!s || !this.canSwipe()) return;
    s.b = this.toUnit(e);
    if (Math.hypot(s.b.px - s.a.px, s.b.py - s.a.py) < CONFIG.ORCHARD.MIN_SWIPE) return;
    const line = [s.a.x, s.a.y, s.b.x, s.b.y];
    if (!clipToSquare(line)) return;
    this.fences.push({ line, t: performance.now() });
    if (this.phase === 'ready') { this.phase = 'play'; this.tStart = performance.now(); }
    this.renderBar();
  }

  // ------------------------------------------------------------ time and the result
  frame(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = now - (this.lastNow || now);
    this.lastNow = now;
    if (this.app.overlayOpen && this.app.overlayOpen()) {   // help or level list open: the clock waits
      this.t0 += dt; if (this.tStart) this.tStart += dt; if (this.eatT0) this.eatT0 += dt;
      this.draw(now);
      return;
    }
    if (this.phase === 'ready' && now - this.t0 > CONFIG.ORCHARD.START_DELAY_MS) { this.phase = 'play'; this.tStart = now; }
    if (this.phase === 'play') {
      this.left = Math.max(0, this.total - (now - this.tStart) / 1000);
      const allUsed = this.fences.length >= this.lv.fences && now - this.fences[this.fences.length - 1].t > 500;
      if (this.left <= 0 || allUsed) this.finish(now);
      this.el.timer.style.width = `${(this.left / this.total) * 100}%`;
      this.el.timer.classList.toggle('low', this.left < 1.6);
    }
    if (this.phase === 'eat' && now - this.eatT0 > CONFIG.ORCHARD.EAT_MS + 300) this.settle();
    this.draw(now);
  }

  finish(now) {
    this.swipe = null;
    const lines = this.fences.map((f) => f.line);
    const ev = evaluate(this.items, lines);
    this.ev = ev;
    // who eats whom: a goat in a piece of trees walks to the nearest tree there; a tree in a
    // piece of goats is eaten by the nearest goat there
    const taken = new Set();
    this.eats = [];
    for (const i of ev.wrong) {
      const it = this.items[i];
      const key = pieceKey(lines, it.x, it.y);
      const p = ev.pieces.get(key);
      const near = (list) => list.filter((j) => !taken.has(j)).sort((a, b) => Math.hypot(this.items[a].x - it.x, this.items[a].y - it.y) - Math.hypot(this.items[b].x - it.x, this.items[b].y - it.y))[0];
      if (it.c === 'goat') {
        const t = near(p.tree);
        if (t !== undefined) { taken.add(t); this.eats.push({ goat: i, tree: t }); }
      } else {
        const g = near(p.goat.filter((j) => !this.eats.some((e) => e.goat === j)));
        this.eats.push({ goat: g, tree: i });
      }
    }
    this.phase = 'eat';
    this.eatT0 = now;
    this.el.timer.style.width = `${(this.left / this.total) * 100}%`;
  }

  settle() {
    this.phase = 'done';
    const lv = this.lv;
    const score = this.ev.score;
    const stars = starsFor(lv, score, this.best);
    const replay = this.lab.passed.includes(lv.id);
    const coins = payFor(lv, score, this.best, replay);
    if (stars > 0) {
      if (!replay) this.lab.passed.push(lv.id);
      this.lab.stars[lv.id] = Math.max(this.lab.stars[lv.id] || 0, stars);
      this.app.save();
      if (coins > 0) this.app.earn({ coins });
    }
    this.outcome = { score, stars, coins, pass: stars > 0 };
    this.renderBar();
    this.renderResult();
  }

  // ------------------------------------------------------------ drawing
  draw(now) {
    const { ctx, W, H } = fitPixelCanvas(this.el.canvas);
    ctx.clearRect(0, 0, W, H);
    if (!this.items) return;
    const x0 = MARGIN, y0 = MARGIN, w = W - 2 * MARGIN, h = H - 2 * MARGIN;
    const P = (x, y) => [x0 + x * w, y0 + y * h];
    const eatP = this.phase === 'eat' || this.phase === 'done' ? clamp((now - this.eatT0) / CONFIG.ORCHARD.EAT_MS, 0, 1) : 0;
    const bare = new Set(eatP >= 0.65 ? this.eats.map((e) => e.tree) : []);
    withPixels(ctx, (k) => {
      // fences
      for (const f of this.fences) {
        const seg = clipToSquare(f.line);
        if (!seg) continue;
        const [ax, ay] = P(seg[0], seg[1]), [bx, by] = P(seg[2], seg[3]);
        const grow = clamp((now - f.t) / 260, 0, 1);
        this.fence(ctx, ax * k, ay * k, (ax + (bx - ax) * grow) * k, (ay + (by - ay) * grow) * k);
      }
      // trees and goats, back to front
      const order = this.items.map((it, i) => i).sort((a, b) => this.items[a].y - this.items[b].y);
      for (const i of order) {
        const it = this.items[i];
        let [X, Y] = P(it.x, it.y);
        if (it.c === 'tree') {
          const name = bare.has(i) ? 'ftree_bare' : 'ftree';
          const [sw, sh] = size(name);
          blit(ctx, name, Math.round(X * k - sw / 2), Math.round(Y * k - sh + 4));
        } else {
          const e = this.eats.find((q) => q.goat === i);
          let name = `goat_${Math.floor(now / 240 + i) % 2}`;
          let flip = (i % 2) === 1;
          if (e && eatP > 0) {
            const [tx, ty] = P(this.items[e.tree].x, this.items[e.tree].y);
            const q = ease(Math.min(1, eatP / 0.6));
            flip = tx < X;
            X += (tx + (flip ? 9 : -9) - X) * q;
            Y += (ty + 2 - Y) * q;
            if (eatP > 0.6) name = 'goat_2';
          }
          const [sw, sh] = size(name);
          blit(ctx, name, Math.round(X * k - sw / 2), Math.round(Y * k - sh + 3), flip);
        }
      }
      // the swipe being drawn
      if (this.swipe) {
        const a = this.swipe.a, b = this.swipe.b;
        this.trail(ctx, a.px * k, a.py * k, b.px * k, b.py * k);
      }
    });
    // marks after the result: a cross over every eaten tree
    if (this.phase === 'done') {
      ctx.font = '700 15px "Chakra Petch", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const e of this.eats) {
        const [X, Y] = P(this.items[e.tree].x, this.items[e.tree].y);
        ctx.lineWidth = 3; ctx.strokeStyle = '#fbf7ef'; ctx.strokeText('✗', X + 9, Y - 20);
        ctx.fillStyle = '#b85a47'; ctx.fillText('✗', X + 9, Y - 20);
      }
    }
  }

  // a wooden fence from (ax, ay) to (bx, by), backing pixels: two rails and posts
  fence(ctx, ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len));
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      px(x, y - 2, '#8b6849'); px(x, y - 5, '#ad8a62'); px(x, y - 1, '#4a3424');
    }
    const step = 7;
    for (let d = 0; d <= len; d += step) {
      const x = ax + (bx - ax) * d / Math.max(1, len), y = ay + (by - ay) * d / Math.max(1, len);
      ctx.fillStyle = '#2c3639'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 8, 4, 9);
      ctx.fillStyle = '#8b6849'; ctx.fillRect(Math.round(x), Math.round(y) - 7, 2, 7);
      ctx.fillStyle = '#cfae84'; ctx.fillRect(Math.round(x), Math.round(y) - 7, 1, 1);
    }
  }

  trail(ctx, ax, ay, bx, by) {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t);
      ctx.fillStyle = 'rgba(245,202,99,0.55)'; ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#fbf7ef'; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  // ------------------------------------------------------------ the bars
  renderBar() {
    if (!this.lv) return;
    this.el.levelNo.textContent = `${this.li + 1}/${ORCHARD_LEVELS.length}`;
    let f = '';
    for (let i = 0; i < this.lv.fences; i++) f += `<span class="o-fence${i < this.fences.length ? ' used' : ''}">${spriteImgHTML('u_fence', 24, 24)}</span>`;
    this.el.fences.innerHTML = f;
    if (this.phase === 'ready') { this.el.timer.style.width = '100%'; this.el.timer.classList.remove('low'); }
    const last = this.li === ORCHARD_LEVELS.length - 1;
    this.el.next.disabled = !(this.lab.passed.includes(this.lv.id) && !last);
    this.el.next.classList.toggle('ready', !!(this.outcome && this.outcome.pass && !last));
  }

  renderResult() {
    const R = this.el.result;
    if (!this.outcome) {
      R.innerHTML = `<div class="o-hint">${spriteImgHTML('u_timer', 22, 22)}<span>${this.lv.fences === 1 ? '1 recinto' : `${this.lv.fences} recinti`} · ${this.total} s</span></div>`;
      return;
    }
    const o = this.outcome;
    const pct = Math.round(o.score * 100);
    const stars = [0, 1, 2].map((i) => `<span class="o-star${i < o.stars ? ' on' : ''}"></span>`).join('');
    R.innerHTML =
      `<div class="o-score"><div class="o-sbar"><span style="width:${pct}%" class="${o.pass ? 'pass' : 'fail'}"></span><i style="left:${Math.round(this.lv.pass * 100)}%"></i></div><b>${pct}%</b></div>` +
      `<div class="o-row"><span class="o-stars">${stars}</span>${o.coins ? `<b class="o-coins">+${o.coins} ${spriteImgHTML('u_coin', 18, 18)}</b>` : ''}` +
      `<span class="o-mark">${spriteImgHTML(o.pass ? 'u_yes' : 'u_noRed', 22, 22)}</span></div>`;
  }

  openLevels() {
    this.app.openSheet('Il frutteto', (body) => {
      let html = '<div class="s-levels-grid">';
      ORCHARD_LEVELS.forEach((lv, i) => {
        const open = levelOpen(this.lab, i, ORCHARD_LEVELS);
        const st = this.lab.stars[lv.id] || 0;
        const stars = [0, 1, 2].map((k) => `<span class="o-star small${k < st ? ' on' : ''}"></span>`).join('');
        html += `<button class="btn s-lv${i === this.li ? ' on' : ''}${open ? '' : ' closed'}" data-i="${i}" ${open ? '' : 'disabled'}>` +
          `<span class="s-lv-no">${i + 1}</span><span class="o-lv-f">${'▮'.repeat(lv.fences)}</span><span class="s-lv-b">${open ? stars : spriteImgHTML('u_lock', 16, 16)}</span></button>`;
      });
      body.innerHTML = html + '</div>';
      body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { this.app.closeSheet(); this.load(Number(b.dataset.i)); }));
    });
  }
}
