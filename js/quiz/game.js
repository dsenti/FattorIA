// Minigame "La piazza": IA o no? It's market day in the village and everybody shows off a new
// machine. A card for each: swipe right (or tap IA) if it is artificial intelligence, left (or tap
// Non IA) if it is not. Quick: every card has a clock. In a row right answers make a combo.
import { CONFIG } from '../config.js';
import { spriteImgHTML, onSpritesReady } from '../weighing/sprites.js';
import { ROUNDS } from './cards.js';
import { drawRound, score, starsFor, payFor, levelOpen } from './model.js';

const SWIPE = 80;   // px to count a swipe

export function helpHTML() {
  return '<h2>La piazza: IA o no?</h2>' +
    '<p>È giorno di mercato: tutti mostrano una macchina nuova. È intelligenza artificiale <em>(artificial intelligence)</em> o no?</p>' +
    '<p><b>IA</b>: ha imparato da tanti esempi (dati) a riconoscere, prevedere o decidere. <b>Non IA</b>: segue regole fisse scritte da una persona, oppure misura e basta.</p>' +
    '<p>Scorri la carta a destra (IA) o a sinistra (non IA), o tocca i bottoni. Hai pochi secondi!</p>';
}

export class QuizGame {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      stage: $('q-stage'), levels: $('q-levels'), levelNo: $('q-level-no'), dots: $('q-dots'), combo: $('q-combo'),
      yes: $('q-yes'), no: $('q-no'), result: $('q-result'), actions: $('q-actions'), retry: $('q-retry'), next: $('q-next'),
    };
    this.ri = 0;
    this.attempt = 0;
    this.el.yes.addEventListener('click', () => this.answer(true));
    this.el.no.addEventListener('click', () => this.answer(false));
    this.el.retry.addEventListener('click', () => this.load(this.ri));
    this.el.next.addEventListener('click', () => this.load(Math.min(this.ri + 1, ROUNDS.length - 1)));
    this.el.levels.addEventListener('click', () => this.openLevels());
    this.el.stage.addEventListener('pointerdown', (e) => this.down(e));
    this.el.stage.addEventListener('pointermove', (e) => this.move(e));
    this.el.stage.addEventListener('pointerup', (e) => this.up(e));
    this.el.stage.addEventListener('pointercancel', () => this.snapBack());
    this.tick = () => this.frame();
    onSpritesReady(() => { if (this.cards) this.renderCard(); });
  }

  get st() { return this.app.getState().quiz; }

  show() {
    this.active = true;
    let i = ROUNDS.findIndex((r) => r.id === this.st.current);
    if (i < 0) i = this.firstUnpassed();
    this.load(i);
  }
  hide() { this.active = false; cancelAnimationFrame(this.raf); clearTimeout(this.after); }
  refresh() {}
  reset() { this.ri = 0; this.cards = null; }
  firstUnpassed() {
    const i = ROUNDS.findIndex((r) => !this.st.passed.includes(r.id));
    return i < 0 ? 0 : i;
  }

  load(i) {
    if (!levelOpen(this.st, i, ROUNDS)) i = this.firstUnpassed();
    clearTimeout(this.after);
    this.ri = i;
    this.round = ROUNDS[i];
    this.st.current = this.round.id;
    this.app.save();
    this.attempt += 1;
    this.cards = drawRound(i, this.attempt * 31 + i);
    this.answers = [];
    this.ci = 0;
    this.combo = 0;
    this.phase = 'card';
    this.el.levelNo.textContent = `${i + 1}/${ROUNDS.length}`;
    this.el.actions.hidden = false;
    this.el.result.hidden = true;
    this.renderCard();
    this.renderDots();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }

  // ------------------------------------------------------------ one card
  renderCard() {
    if (this.phase === 'done') return;
    const c = this.cards[this.ci];
    this.el.stage.innerHTML =
      `<div class="q-side q-side-no">Non IA</div><div class="q-side q-side-yes">IA</div>` +
      `<div class="q-card" id="q-card"><div class="q-ic">${spriteImgHTML(`qz_${c.icon}`, 96, 96)}</div>` +
      `<div class="q-title">${c.title}</div><div class="q-why" hidden></div>` +
      '<div class="q-clock"><span></span></div></div>';
    this.card = this.el.stage.querySelector('#q-card');
    this.clock = this.card.querySelector('.q-clock span');
    this.t0 = performance.now();
    this.el.yes.disabled = this.el.no.disabled = false;
  }

  frame() {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now(), dt = now - (this.lastNow || now);
    this.lastNow = now;
    if (this.app.overlayOpen && this.app.overlayOpen()) { this.t0 += dt; return; }   // help open: the clock waits
    if (this.phase !== 'card' || !this.clock) return;
    const total = this.round.seconds * 1000;
    const left = Math.max(0, 1 - (performance.now() - this.t0) / total);
    this.clock.style.width = `${left * 100}%`;
    this.clock.classList.toggle('low', left < 0.3);
    if (left <= 0) this.answer(null);
  }

  answer(said) {
    if (this.phase !== 'card') return;
    this.phase = 'why';
    const c = this.cards[this.ci];
    this.answers[this.ci] = said;
    const ok = said === c.ai;
    this.combo = ok ? this.combo + 1 : 0;
    this.el.yes.disabled = this.el.no.disabled = true;
    this.drag = null;
    const card = this.card;
    card.style.transform = '';
    card.classList.add(ok ? 'right' : 'wrong', c.ai ? 'is-ai' : 'not-ai');
    const why = card.querySelector('.q-why');
    why.hidden = false;
    why.innerHTML = `<span class="q-verdict">${spriteImgHTML(ok ? 'u_yes' : 'u_noRed', 22, 22)}<b>${c.ai ? 'IA' : 'Non IA'}</b></span>${c.why}`;
    this.renderDots();
    // read the reason, then the next card (a tap on the card skips)
    const wait = CONFIG.QUIZ.FEEDBACK_MS + (ok ? 0 : 900);
    this.after = setTimeout(() => this.nextCard(), wait);
  }

  nextCard() {
    clearTimeout(this.after);
    if (this.phase !== 'why') return;
    this.ci += 1;
    if (this.ci >= this.cards.length) { this.finish(); return; }
    this.phase = 'card';
    this.renderCard();
  }

  finish() {
    this.phase = 'done';
    const { right, best } = score(this.cards, this.answers);
    const stars = starsFor(right);
    const replay = this.st.passed.includes(this.round.id);
    const coins = payFor(right, replay);
    if (stars > 0) {
      if (!replay) this.st.passed.push(this.round.id);
      this.st.stars[this.round.id] = Math.max(this.st.stars[this.round.id] || 0, stars);
      this.app.save();
      if (coins > 0) this.app.earn({ coins });
    }
    const st = [0, 1, 2].map((i) => `<span class="o-star big${i < stars ? ' on' : ''}"></span>`).join('');
    this.el.stage.innerHTML =
      `<div class="q-card q-end"><div class="q-big">${right}/${this.cards.length}</div><div class="o-stars">${st}</div>` +
      `${coins ? `<div class="o-coins q-endcoins">+${coins} ${spriteImgHTML('u_coin', 22, 22)}</div>` : ''}` +
      `<div class="q-best">combo ×${best}</div></div>`;
    this.el.actions.hidden = true;
    this.el.result.hidden = false;
    const last = this.ri === ROUNDS.length - 1;
    this.el.next.disabled = !(this.st.passed.includes(this.round.id) && !last);
    this.el.next.classList.toggle('ready', stars > 0 && !last);
    this.renderDots();
  }

  renderDots() {
    let h = '';
    this.cards.forEach((c, i) => {
      const a = this.answers[i];
      const cls = i >= this.answers.length || a === undefined ? (i === this.ci && this.phase !== 'done' ? 'now' : '') : a === c.ai ? 'ok' : 'ko';
      h += `<span class="q-dot ${cls}"></span>`;
    });
    this.el.dots.innerHTML = h;
    this.el.combo.textContent = this.combo >= 2 ? `×${this.combo}` : '';
    this.el.combo.classList.toggle('hot', this.combo >= 2);
    if (this.combo >= 2) { this.el.combo.classList.remove('pop'); void this.el.combo.offsetWidth; this.el.combo.classList.add('pop'); }
  }

  // ------------------------------------------------------------ swipe the card
  down(e) {
    if (this.phase === 'why' && e.target.closest('.q-card')) { this.nextCard(); return; }
    if (this.phase !== 'card' || !e.target.closest('.q-card')) return;
    this.drag = { x0: e.clientX, dx: 0 };
    this.el.stage.setPointerCapture(e.pointerId);
    this.card.classList.add('dragging');
  }
  move(e) {
    if (!this.drag) return;
    this.drag.dx = e.clientX - this.drag.x0;
    const dx = this.drag.dx;
    this.card.style.transform = `translateX(${dx}px) rotate(${dx * 0.06}deg)`;
    this.el.stage.classList.toggle('lean-yes', dx > SWIPE / 2);
    this.el.stage.classList.toggle('lean-no', dx < -SWIPE / 2);
  }
  up() {
    if (!this.drag) return;
    const dx = this.drag.dx;
    this.drag = null;
    this.card.classList.remove('dragging');
    this.el.stage.classList.remove('lean-yes', 'lean-no');
    if (Math.abs(dx) >= SWIPE) this.answer(dx > 0); else this.snapBack();
  }
  snapBack() {
    this.drag = null;
    if (this.card) { this.card.classList.remove('dragging'); this.card.style.transform = ''; }
    this.el.stage.classList.remove('lean-yes', 'lean-no');
  }

  openLevels() {
    this.app.openSheet('La piazza', (body) => {
      let html = '<div class="s-levels-grid">';
      ROUNDS.forEach((r, i) => {
        const open = levelOpen(this.st, i, ROUNDS);
        const s = this.st.stars[r.id] || 0;
        const stars = [0, 1, 2].map((k) => `<span class="o-star small${k < s ? ' on' : ''}"></span>`).join('');
        html += `<button class="btn s-lv${i === this.ri ? ' on' : ''}${open ? '' : ' closed'}" data-i="${i}" ${open ? '' : 'disabled'}>` +
          `<span class="s-lv-no">${i + 1}</span><span class="o-lv-f">${'●'.repeat(i + 1)}</span><span class="s-lv-b">${open ? stars : spriteImgHTML('u_lock', 16, 16)}</span></button>`;
      });
      body.innerHTML = html + '</div>';
      body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { this.app.closeSheet(); this.load(Number(b.dataset.i)); }));
    });
  }
}
