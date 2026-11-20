// Minigame "Il bosco": funghi al crepuscolo. The forager walks the woods at dusk; in this light
// every mushroom looks grey. Each one found is measured and pinned on the guide board, among the
// known porcini (good) and poisonous mushrooms (bad). Quick: pick it or leave it. Then the board
// shows its 3 nearest neighbours and the truth. A poisonous one in the basket: a stomach ache (a
// heart). The idea is k-nearest neighbours: you are like your neighbours.
import { CONFIG } from '../config.js';
import { fitPixelCanvas } from '../pixel.js';
import { withPixels, blit, size, onSpritesReady, spriteImgHTML } from '../weighing/sprites.js';
import { FOREST_LEVELS } from './levels.js';
import { makeTrail, nearest, judge, starsFor, payFor, levelOpen } from './model.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - t) ** 3;
const MB = { l: 30, r: 12, t: 12, b: 28 };   // board margins, CSS px

export function helpHTML() {
  return '<h2>Il bosco</h2>' +
    '<p>Al crepuscolo tutti i funghi sembrano grigi. Ogni fungo che trovi va sulla guida: più a destra = cappello più largo, più in alto = gambo più spesso.</p>' +
    '<p>Guarda i funghi <b>vicini</b> sulla guida: porcini o velenosi? Raccogli o lascia, in fretta! Un fungo velenoso nel cestino: mal di pancia.</p>' +
    '<p>È l’idea dei <b>k vicini più prossimi</b> <em>(k-nearest neighbours)</em>: sei simile ai tuoi vicini. Qui k = 3.</p>';
}

export class ForestGame {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      scene: $('f-scene'), board: $('f-board'), levels: $('f-levels'), levelNo: $('f-level-no'), hearts: $('f-hearts'),
      basket: $('f-basket'), timer: $('f-timer'), result: $('f-result'), play: $('f-play'), done: $('f-done'),
      pick: $('f-pick'), leave: $('f-leave'), retry: $('f-retry'), next: $('f-next'),
    };
    this.loop = (t) => this.frame(t);
    this.li = 0;
    this.attempt = 0;
    this.el.pick.addEventListener('click', () => this.decide(true));
    this.el.leave.addEventListener('click', () => this.decide(false));
    this.el.retry.addEventListener('click', () => this.load(this.li));
    this.el.next.addEventListener('click', () => this.load(Math.min(this.li + 1, FOREST_LEVELS.length - 1)));
    this.el.levels.addEventListener('click', () => this.openLevels());
    onSpritesReady(() => this.renderBar());
  }

  get st() { return this.app.getState().forest; }

  show() {
    this.active = true;
    let i = FOREST_LEVELS.findIndex((l) => l.id === this.st.current);
    if (i < 0) i = this.firstUnpassed();
    this.load(i);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }
  hide() { this.active = false; cancelAnimationFrame(this.raf); }
  refresh() { this.renderBar(); }
  reset() { this.li = 0; this.trail = null; }
  firstUnpassed() {
    const i = FOREST_LEVELS.findIndex((l) => !this.st.passed.includes(l.id));
    return i < 0 ? 0 : i;
  }

  load(i) {
    if (!levelOpen(this.st, i, FOREST_LEVELS)) i = this.firstUnpassed();
    this.li = i;
    this.lv = FOREST_LEVELS[i];
    this.st.current = this.lv.id;
    this.app.save();
    this.attempt += 1;
    const tr = makeTrail(this.lv, this.attempt * 17 + i);
    this.board = tr.board;
    this.nextMush = tr.next;
    this.t = { hearts: CONFIG.FOREST.LIVES, basket: 0, goods: 0, aches: 0, missed: 0, found: 0 };
    this.cur = null;       // the mushroom being decided
    this.prev = null;      // the last one, still on screen (left behind or flying into the basket)
    this.phase = 'start';
    this.phaseT = performance.now();
    this.scroll = 0;
    this.outcome = null;
    this.el.play.hidden = false;
    this.el.done.hidden = true;
    this.renderBar();
    this.renderResult();
  }

  // ------------------------------------------------------------ the trail
  setPhase(p, now) { this.phase = p; this.phaseT = now; this.renderBar(); }

  frame(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(50, now - (this.last || now));
    this.last = now;
    if (this.app.overlayOpen && this.app.overlayOpen()) { this.phaseT += now - (this.lastRaw || now); this.lastRaw = now; this.draw(now); return; }
    this.lastRaw = now;
    const el = now - this.phaseT;
    const F = CONFIG.FOREST;
    if (this.phase === 'start' && el > 600) this.walk(now);
    if (this.phase === 'walk') {
      this.scroll += dt * this.speed;
      if (this.prev) this.prev.x -= dt * this.speed;
      if (el >= F.WALK_MS) { this.cur.on = true; this.setPhase('decide', now); }
    }
    if (this.phase === 'decide') {
      const left = 1 - el / (this.lv.seconds * 1000);
      this.el.timer.style.width = `${clamp(left, 0, 1) * 100}%`;
      this.el.timer.classList.toggle('low', left < 0.3);
      if (left <= 0) this.decide(null);
    }
    if (this.phase === 'reveal' && el >= F.REVEAL_MS + (this.cur && this.cur.res === 'ache' ? 500 : 0)) {
      this.board.push({ x: this.cur.x, y: this.cur.y, c: this.cur.c, fresh: true });
      this.prev = { ...this.cur, x: this.curX, gone: this.cur.res === 'basket' || this.cur.res === 'ache' };
      this.cur = null;
      if (this.t.hearts <= 0 || this.t.found >= this.lv.n) this.finish(now); else this.walk(now);
    }
    this.draw(now);
  }

  walk(now) {
    const m = this.nextMush(this.board);
    if (m.c === 'good') this.t.goods += 1;
    this.t.found += 1;
    this.cur = { ...m, on: false };
    const r = this.el.scene.getBoundingClientRect();
    this.fx = r.width * 0.26;
    this.speed = (r.width + 30 - (this.fx + 34)) / CONFIG.FOREST.WALK_MS;
    this.setPhase('walk', now);
  }

  decide(picked) {
    if (this.phase !== 'decide') return;
    const res = judge(this.cur, picked === true);
    this.cur.res = res;
    this.cur.nn = nearest(this.board, this.cur.x, this.cur.y);
    if (res === 'basket') this.t.basket += 1;
    if (res === 'ache') { this.t.aches += 1; this.t.hearts -= 1; }
    if (res === 'missed') this.t.missed += 1;
    this.el.timer.style.width = '0%';
    this.setPhase('reveal', performance.now());
  }

  finish(now) {
    this.setPhase('done', now);
    const stars = starsFor(this.t);
    const replay = this.st.passed.includes(this.lv.id);
    const coins = payFor(this.t, replay);
    if (stars > 0) {
      if (!replay) this.st.passed.push(this.lv.id);
      this.st.stars[this.lv.id] = Math.max(this.st.stars[this.lv.id] || 0, stars);
      this.app.save();
      if (coins > 0) this.app.earn({ coins });
    }
    this.outcome = { stars, coins, pass: stars > 0 };
    this.el.play.hidden = true;
    this.el.done.hidden = false;
    const last = this.li === FOREST_LEVELS.length - 1;
    this.el.next.disabled = !(this.st.passed.includes(this.lv.id) && !last);
    this.el.next.classList.toggle('ready', stars > 0 && !last);
    this.renderBar();
    this.renderResult();
  }

  // ------------------------------------------------------------ drawing
  draw(now) {
    this.drawScene(now);
    this.drawBoard(now);
  }

  drawScene(now) {
    const { ctx, W, H } = fitPixelCanvas(this.el.scene);
    ctx.clearRect(0, 0, W, H);
    if (!this.lv) return;
    const hor = H * 0.6, path = H * 0.86;
    const fx = this.fx || W * 0.26;
    const ache = this.phase === 'reveal' && this.cur && this.cur.res === 'ache' ? now - this.phaseT : -1;
    const shake = ache >= 0 && ache < 400 ? Math.round(Math.sin(ache / 25) * 3) : 0;
    withPixels(ctx, (k) => {
      const w = Math.ceil(W * k), h = Math.ceil(H * k), sc = this.scroll * k;
      // dusk sky, a hill line, far pines
      const sky = [[0x2b, 0x35, 0x58], [0x4d, 0x4f, 0x7e], [0x9a, 0x6a, 0x84], [0xe0, 0x93, 0x70]];
      for (let y = 0; y < hor * k; y++) {
        const t = y / (hor * k) * (sky.length - 1), i = Math.min(sky.length - 2, Math.floor(t)), f = t - i;
        const c = sky[i].map((v, j) => Math.round(v + (sky[i + 1][j] - v) * f));
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(0, y, w, 1);
      }
      const sx = Math.round(w * 0.78), sy = Math.round(hor * k * 0.28);   // the evening star
      ctx.fillStyle = '#f7e9c0'; ctx.fillRect(sx - 2, sy, 5, 1); ctx.fillRect(sx, sy - 2, 1, 5);
      for (let x = 0; x < w; x++) {
        const X = x + sc * 0.15;
        const top = hor * k - 10 - Math.sin(X / 37) * 5 - Math.sin(X / 13 + 1) * 2;
        ctx.fillStyle = '#3a4a5e'; ctx.fillRect(x, Math.round(top), 1, Math.ceil(hor * k - top) + 2);
      }
      const [pw, ph] = size('fpine_d');
      const span = 15;
      for (let i = -1; i < w / span + 2; i++) {
        const X = Math.round(i * span - (sc * 0.4) % span);
        const jitter = Math.floor((i + Math.floor(sc * 0.4 / span)) * 7.3) % 5;
        blit(ctx, 'fpine_d', X, Math.round(hor * k - ph + 4 + jitter));
      }
      // the ground and the path
      ctx.fillStyle = '#2f4a3a'; ctx.fillRect(0, Math.round(hor * k), w, h);
      ctx.fillStyle = '#5a4634'; ctx.fillRect(0, Math.round((path - 9) * k), w, Math.round(12 * k));
      ctx.fillStyle = '#6e5640'; ctx.fillRect(0, Math.round((path - 9) * k), w, 1);
      for (let i = 0; i < w / 9 + 2; i++) {
        const X = Math.round(i * 9 - sc % 9);
        ctx.fillStyle = i % 3 ? '#3e5c46' : '#7a4a30';
        ctx.fillRect(X, Math.round((path + 4) * k) + (i % 4), 2, 1);
      }
      // near pines (bigger, faster)
      const nspan = 46;
      for (let i = -1; i < w / nspan + 2; i++) {
        const n = i + Math.floor(sc / nspan);
        if (n % 3 === 1) continue;
        const X = Math.round(i * nspan - sc % nspan + (n % 2) * 13);
        blit(ctx, 'fpine', X, Math.round((path - 12) * k - 52), false, 2);
      }
      // fireflies
      for (let i = 0; i < 9; i++) {
        if ((Math.floor(now / 300) + i * 3) % 5 === 0) continue;
        const x = ((i * 53 + now * 0.01 * (i % 3 + 1)) % w), y = hor * k + 4 + ((i * 29) % Math.max(1, (path - hor) * k - 12));
        ctx.fillStyle = '#f5e27a'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      // the mushrooms on the path
      const mush = (m, x, y, sc2 = 2) => {
        const name = m.revealed ? (m.c === 'good' ? 'mush_good' : 'mush_bad') : 'mush_unk';
        const [mw, mh] = size(name);
        blit(ctx, name, Math.round(x * k - mw * sc2 / 2), Math.round(y * k - mh * sc2 + 2), false, sc2);
      };
      if (this.prev && !this.prev.gone && this.prev.x > -30) mush({ ...this.prev, revealed: true }, this.prev.x, path);
      if (this.cur) {
        const el = now - this.phaseT;
        let x = this.phase === 'walk' ? W + 30 - el * this.speed : fx + 34;
        let y = path;
        const rev = this.phase === 'reveal';
        if (rev && (this.cur.res === 'basket' || this.cur.res === 'ache')) {       // into the basket
          const q = ease(clamp((el - 250) / 450, 0, 1));
          x += (fx + 14 - x) * q; y += (path - 28 - y) * q - Math.sin(q * Math.PI) * 18;
        }
        this.curX = x;
        if (!(rev && (this.cur.res === 'basket' || this.cur.res === 'ache') && el > 700)) mush({ ...this.cur, revealed: rev }, x + shake, y);
      }
      // the forager
      const walking = this.phase === 'walk';
      const fr = walking ? 1 + Math.floor(now / 170) % 2 : 0;
      const [gw, gh] = size(`forager_${fr}`);
      blit(ctx, `forager_${fr}`, Math.round((fx + shake) * k - gw), Math.round(path * k - gh * 2 + 3), false, 2);
      if (ache >= 0 && ache < 500) { ctx.fillStyle = `rgba(216,96,76,${0.35 * (1 - ache / 500)})`; ctx.fillRect(0, 0, w, h); }
    });
    // the question mark over the grey mushroom
    if (this.cur && (this.phase === 'decide')) {
      ctx.font = '700 18px "Chakra Petch", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const bob = Math.round(Math.sin(now / 160) * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = '#22313a'; ctx.strokeText('?', fx + 34, path - 34 + bob);
      ctx.fillStyle = '#f5ca63'; ctx.fillText('?', fx + 34, path - 34 + bob);
    }
  }

  boardGeo() {
    const r = this.el.board.getBoundingClientRect();
    return { W: r.width, H: r.height, x0: MB.l, y0: MB.t, w: r.width - MB.l - MB.r, h: r.height - MB.t - MB.b };
  }
  bp(g, m) { return { x: g.x0 + m.x * g.w, y: g.y0 + (1 - m.y) * g.h }; }

  drawBoard(now) {
    const { ctx, W, H } = fitPixelCanvas(this.el.board);
    ctx.clearRect(0, 0, W, H);
    if (!this.board) return;
    const g = this.boardGeo();
    const showCur = this.cur && this.cur.on && (this.phase === 'decide' || this.phase === 'reveal');
    const rev = this.phase === 'reveal';
    withPixels(ctx, (k) => {
      // axes: a line and an arrow for each
      ctx.fillStyle = '#3a4850';
      ctx.fillRect(Math.round(g.x0 * k) - 2, Math.round(g.y0 * k), 2, Math.round(g.h * k) + 2);
      ctx.fillRect(Math.round(g.x0 * k) - 2, Math.round((g.y0 + g.h) * k), Math.round(g.w * k) + 2, 2);
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(Math.round((g.x0 + g.w) * k) - i, Math.round((g.y0 + g.h) * k) - i, 1, 2 * i + 2);
        ctx.fillRect(Math.round(g.x0 * k) - 1 - i, Math.round(g.y0 * k) + i, 2 * i + 2, 1);
      }
      // the k nearest and the circle that holds them
      if (rev && this.cur.nn) {
        const c = this.bp(g, this.cur);
        const grow = clamp((now - this.phaseT) / 350, 0, 1);
        for (const n of this.cur.nn) {
          const p = this.bp(g, this.board[n.i]);
          this.dash(ctx, c.x * k, c.y * k, (c.x + (p.x - c.x) * grow) * k, (c.y + (p.y - c.y) * grow) * k, this.board[n.i].c === 'good' ? '#94603a' : '#d8604c');
        }
        const far = this.cur.nn[this.cur.nn.length - 1];
        const fp = this.bp(g, this.board[far.i]);
        this.circle(ctx, c.x * k, c.y * k, Math.hypot(fp.x - c.x, fp.y - c.y) * k * grow + 6, '#f5ca63');
      }
      // the known mushrooms
      for (const m of this.board) {
        const name = m.c === 'good' ? 'mdot_good' : 'mdot_bad';
        const [mw, mh] = size(name);
        const p = this.bp(g, m);
        blit(ctx, name, Math.round(p.x * k - mw), Math.round(p.y * k - mh), false, 2);
      }
      // the one just found: grey, pulsing, until the truth
      if (showCur) {
        const p = this.bp(g, this.cur);
        const pulse = rev ? 0 : (Math.sin(now / 140) + 1) * 2;
        this.circle(ctx, p.x * k, p.y * k, 9 + pulse, rev ? '#fbf7ef' : '#f5ca63');
        const name = rev ? (this.cur.c === 'good' ? 'mdot_good' : 'mdot_bad') : 'mdot_unk';
        const [mw, mh] = size(name);
        blit(ctx, name, Math.round(p.x * k - mw * 1.5), Math.round(p.y * k - mh * 1.5), false, 3);
      }
    });
    // axis words, and the verdict mark
    ctx.font = '600 12px "Chakra Petch", system-ui, sans-serif';
    ctx.fillStyle = '#5f5a50';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('cappello →', g.x0 + g.w, g.y0 + g.h + 7);
    ctx.save(); ctx.translate(g.x0 - 9, g.y0 + g.h); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('gambo →', 0, 0); ctx.restore();
    if (rev && this.cur.res) {
      const p = this.bp(g, this.cur);
      const ok = this.cur.res === 'basket' || this.cur.res === 'safe';
      ctx.font = '700 18px "Chakra Petch", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const mark = ok ? '✓' : '✗';
      ctx.lineWidth = 3; ctx.strokeStyle = '#fbf7ef'; ctx.strokeText(mark, p.x + 15, p.y - 18);
      ctx.fillStyle = ok ? '#3f7a52' : '#b85a47'; ctx.fillText(mark, p.x + 15, p.y - 18);
    }
  }

  dash(ctx, ax, ay, bx, by, col) {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    ctx.fillStyle = col;
    for (let i = 0; i <= n; i++) if (i % 4 < 3) ctx.fillRect(Math.round(ax + (bx - ax) * i / n), Math.round(ay + (by - ay) * i / n), 2, 2);
  }
  circle(ctx, cx, cy, r, col) {
    const n = Math.max(24, Math.round(r * 1.6));
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      if (i % 3 === 2) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
    }
  }

  // ------------------------------------------------------------ bars
  renderBar() {
    if (!this.lv) return;
    this.el.levelNo.textContent = `${this.li + 1}/${FOREST_LEVELS.length}`;
    let h = '';
    for (let i = 0; i < CONFIG.FOREST.LIVES; i++) h += spriteImgHTML(i < this.t.hearts ? 'u_heart' : 'u_heart_off', 22, 22);
    this.el.hearts.innerHTML = h;
    this.el.basket.innerHTML = `${spriteImgHTML('u_basket', 24, 24)}<b>${this.t.basket}</b><span>${Math.min(this.t.found, this.lv.n)}/${this.lv.n}</span>`;
    const can = this.phase === 'decide';
    this.el.pick.disabled = this.el.leave.disabled = !can;
    if (this.phase !== 'decide') this.el.timer.style.width = this.phase === 'walk' || this.phase === 'start' ? '100%' : '0%';
  }

  renderResult() {
    const R = this.el.result;
    const o = this.outcome;
    if (!o) {
      R.innerHTML = `<div class="o-hint"><span>${spriteImgHTML('mdot_good', 16, 14)} porcino</span><span>${spriteImgHTML('mdot_bad', 16, 14)} velenoso</span><span>k = ${CONFIG.FOREST.K}</span></div>`;
      return;
    }
    const stars = [0, 1, 2].map((i) => `<span class="o-star${i < o.stars ? ' on' : ''}"></span>`).join('');
    R.innerHTML = `<div class="o-row"><span class="o-stars">${stars}</span>${o.coins ? `<b class="o-coins">+${o.coins} ${spriteImgHTML('u_coin', 18, 18)}</b>` : ''}` +
      `<span class="o-mark">${spriteImgHTML(o.pass ? 'u_yes' : 'u_noRed', 22, 22)}</span></div>`;
  }

  openLevels() {
    this.app.openSheet('Il bosco', (body) => {
      let html = '<div class="s-levels-grid">';
      FOREST_LEVELS.forEach((lv, i) => {
        const open = levelOpen(this.st, i, FOREST_LEVELS);
        const s = this.st.stars[lv.id] || 0;
        const stars = [0, 1, 2].map((k) => `<span class="o-star small${k < s ? ' on' : ''}"></span>`).join('');
        html += `<button class="btn s-lv${i === this.li ? ' on' : ''}${open ? '' : ' closed'}" data-i="${i}" ${open ? '' : 'disabled'}>` +
          `<span class="s-lv-no">${i + 1}</span><span class="o-lv-f">${spriteImgHTML('mush_unk', 16, 16)} ${lv.n}</span><span class="s-lv-b">${open ? stars : spriteImgHTML('u_lock', 16, 16)}</span></button>`;
      });
      body.innerHTML = html + '</div>';
      body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { this.app.closeSheet(); this.load(Number(b.dataset.i)); }));
    });
  }
}
