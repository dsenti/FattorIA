// Minigame 3: Il laboratorio (the analysis lab). The player builds a decision tree of boundary
// lines at any angle to classify farm samples measured on two properties.
// Owns the #screen-lab screen: the field (canvas) with the training samples and the tree's
// regions, the tree (SVG), the node pop-up (drag a line, choose a colour or "+" for each side,
// Applica), "Prova" (new test samples fall into the field, pay), "Avanti", the level list.
// Little text on purpose: colours, shapes, bars and icons carry the game.
import { CONFIG } from '../config.js';
import { LAB_LEVELS, CLASS_COLOURS } from './levels.js';
import {
  UNIT_SQUARE, emptyNode, isNode, isApplied, isComplete, listNodes, countNodes, nodeAt, reaches, regions,
  nodeSegments, accuracy, majority, defaultLine, sideCount, removedBy, addedBy, applyNode, deleteNode,
  subtreeSize, makeSamples, labNoise, labSamples, scoreTest, payFor, looksOverfit, clipBranch, polyArea,
  polyCentroid, lineInPoly, labLevelStatus, labStartLevel, layoutLab,
} from './model.js';
import {
  C, FONT, fitCanvas, fieldGeom, tracePoly, drawBackground, drawAxes, drawPoints, drawRegions, drawCut,
  drawHandle, drawMark, roundRect, colourOf, shapeOf, shapePath, muted, rgba, shapeSVG, shapeIcon, thumbSVG,
  sidesOf, LAB_ICON,
} from './draw.js';
import { ICON, svg40 } from '../sorting/art.js';

const NS = 21;           // half size of a node box in the tree
const ES = 18;           // half size of an empty node ("?")
const ROW_H = 66;        // vertical distance between tree rows
const LEAF_R = 13;       // leaf circle
const HANDLE_HIT = 28;   // px: grab radius of a line handle (a 56 px touch target)
const LINE_HIT = 16;     // px: grab the line itself to slide it
const MIN_LEN = 0.06;    // the two handles never get closer than this (field units)

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const coinSvg = (size = 16) => svg40(ICON.coin, size, 'coin-ic');
const easeIn = (t) => t * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function helpHTML() {
  return '<h2>Il laboratorio</h2>' +
    '<p>Ogni punto è un campione di una fattoria, misurato due volte (i due assi). Il colore è la sua <b>etichetta</b> <em>(label)</em>. Il tuo compito: una <b>classificazione</b> <em>(classification)</em>.</p>' +
    '<ol>' +
    '<li>Tocca <b>?</b> e trascina la linea: è un <b>confine di decisione</b> <em>(decision boundary)</em>.</li>' +
    '<li>Per ogni lato scegli un colore, oppure <b>+</b> per un nuovo nodo che divide ancora quel lato. Poi il tasto verde. Così cresce il tuo <b>albero di decisione</b> <em>(decision tree)</em>.</li>' +
    '<li><b>Prova</b>: arrivano campioni nuovi, il <b>test</b>. Più ne indovini, più monete. La tacca verde sulla barra è l\'albero migliore.</li>' +
    '</ol>' +
    '<p>A volte basta una linea, a volte ne servono tante. Troppe linee su dati rumorosi? L\'albero <b>impara a memoria</b> <em>(overfitting)</em>: bene sull\'<b>addestramento</b> <em>(training)</em>, male sul test.</p>';
}

export class LabGame {
  // app: { getState(), save(), earn({ levelIdx, coins }), openSheet(title, render, onClose), closeSheet(),
  //        toast(msg, ms), openShop(), overlayOpen(), coinsChanged(), confirm(html, yes, no) -> Promise<bool> }
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      scroll: $('l-scroll'), legend: $('l-legend'), fieldWrap: $('l-field-wrap'), field: $('l-field'), tree: $('l-tree'),
      score: $('l-score'), tryBtn: $('l-try'), next: $('l-next'),
      levels: $('l-levels'), restart: $('l-restart'), levelNo: $('l-level-no'), title: $('l-title'),
      pop: $('l-pop'), card: $('l-card'), popTitle: $('l-pop-title'), popN: $('l-pop-n'), popOk: $('l-pop-ok'),
      popCanvas: $('l-pop-canvas'), sides: $('l-sides'),
      hint: $('l-hint'), del: $('l-del'), apply: $('l-apply'), popX: $('l-pop-x'),
    };
    this.li = -1;
    this.phase = 'edit';   // edit | drop (test samples falling) | result
    this.active = false;
    this.pop = null;       // the open node pop-up: { path, num, poly, ancestors, pts, line, choice, touched, drag }
    this.raf = 0;

    this.el.tryBtn.addEventListener('click', () => this.onTry());
    this.el.next.addEventListener('click', () => this.onNext());
    this.el.levels.addEventListener('click', () => this.openLevels());
    this.el.restart.addEventListener('click', () => this.onRestart());
    this.el.tree.addEventListener('click', (e) => {
      const n = e.target.closest('[data-path]');
      if (n && !this.app.overlayOpen()) this.openPop(n.dataset.path ? n.dataset.path.split('.').map(Number) : []);
    });
    // pop-up: a tap outside the card closes it without applying. On "click", not "pointerdown":
    // otherwise the same tap would go on to the button under the backdrop (e.g. "Prova").
    this.el.pop.addEventListener('click', (e) => { if (e.target === this.el.pop) this.closePop(); });
    this.el.popX.addEventListener('click', () => this.closePop());
    this.el.apply.addEventListener('click', () => this.applyPop());
    this.el.del.addEventListener('click', () => this.deletePop());
    this.el.hint.addEventListener('click', () => this.useHint());
    this.el.sides.addEventListener('click', (e) => {
      const b = e.target.closest('[data-side]');
      if (b && !b.disabled) this.choose(Number(b.dataset.side), b.dataset.c === '+' ? '+' : Number(b.dataset.c));
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.pop) this.closePop(); });
    const cv = this.el.popCanvas;
    cv.addEventListener('pointerdown', (e) => this.onPopDown(e));
    cv.addEventListener('pointermove', (e) => { if (this.pop && this.pop.drag) { e.preventDefault(); this.onPopMove(e); } });
    const end = () => { if (this.pop && this.pop.drag) { this.pop.drag = null; this.renderPop(); } };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('lostpointercapture', end);
    window.addEventListener('resize', () => {
      if (!this.active || this.li < 0) return;
      if (this.pop) { this.sizePopCanvas(); this.renderPop(); }
      if (this.phase !== 'drop') this.render();
    });
  }

  get lab() { return this.app.getState().lab; }
  get level() { return LAB_LEVELS[this.li]; }
  get tree() { return this.board.tree; }

  // ------------------------------------------------------------ lifecycle
  show() {
    this.active = true;
    if (this.li < 0 || !labLevelStatus(this.lab, LAB_LEVELS, this.li).open) this.load(labStartLevel(this.lab, LAB_LEVELS));
    else this.refresh();
  }

  hide() {
    this.active = false;
    if (this.pop) this.closePop();
    cancelAnimationFrame(this.raf);
    if (this.phase === 'drop') this.phase = 'result';
  }

  reset() { this.li = -1; this.phase = 'edit'; this.pop = null; }

  // Something outside changed (shop purchase): new samples if the upgrades changed.
  refresh() {
    if (this.li < 0) return;
    if (this.dataKey !== this.currentDataKey()) {
      this.newTraining();
      this.test = null;
      this.phase = 'edit';
    }
    if (this.active) this.render();
  }

  currentDataKey() { return `${this.lab.samples}|${this.lab.precision}`; }

  load(li) {
    cancelAnimationFrame(this.raf);
    this.li = li;
    const lab = this.lab;
    lab.current = this.level.id;
    if (!lab.boards[this.level.id]) lab.boards[this.level.id] = this.freshBoard();
    this.board = lab.boards[this.level.id];
    this.newTraining();
    this.test = null;
    this.score = null;
    this.phase = 'edit';
    this.app.save();
    this.render();
    this.el.scroll.scrollTop = 0;
  }

  freshBoard() {
    return { tree: emptyNode(), best: 0, replay: this.lab.passed.includes(this.level.id) };
  }

  // A new tree from scratch and new samples: the tree's record starts again at 0.
  restartLevel() {
    this.lab.boards[this.level.id] = this.freshBoard();
    this.board = this.lab.boards[this.level.id];
    this.newTraining();
    this.test = null;
    this.score = null;
    this.phase = 'edit';
    this.app.save();
    this.render();
  }

  newTraining() {
    const lab = this.lab;
    this.train = makeSamples(this.level, labSamples(this.level, lab.samples), labNoise(this.level, lab.precision));
    this.dataKey = this.currentDataKey();
  }

  // ------------------------------------------------------------ rendering
  render() {
    if (this.li < 0) return;
    const lv = this.level;
    this.el.levelNo.textContent = `${this.li + 1}/${LAB_LEVELS.length}`;
    this.el.title.textContent = lv.title;
    this.el.legend.innerHTML = lv.classes.map((name, k) => `<span class="l-leg">${shapeIcon(k, 14)}${esc(name)}</span>`).join('');
    // field height: whatever the tree leaves free, from a short field on small phones (then the
    // tree scrolls) up to an almost square one
    const w = this.el.fieldWrap.clientWidth || 360;
    const lay = layoutLab(this.tree, 300);
    const treeH = NS + 8 + lay.depth * ROW_H + LEAF_R + 12;
    const free = this.el.scroll.clientHeight - treeH - 10;
    this.el.fieldWrap.style.height = `${Math.round(Math.max(200, Math.min(w * 0.9, free)))}px`;
    this.drawField(performance.now());
    this.renderTree();
    this.updateUI();
  }

  // The main field: regions, lines, training samples; after "Prova" the test samples on top.
  drawField(now) {
    const { ctx, W, H } = fitCanvas(this.el.field);
    const g = fieldGeom(W, H);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, g);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.L, g.T, g.R - g.L, g.B - g.T); ctx.clip();
    drawRegions(ctx, g, regions(this.tree).filter((r) => r.cls != null).map((r) => ({ ...r, done: true })), 0.2);
    const showTest = this.test && this.phase !== 'edit';
    const r = Math.max(3.4, Math.min(4.8, 5.3 - this.train.length / 100));
    drawPoints(ctx, g, this.train, { r, style: () => (showTest ? { alpha: 0.28, r: r * 0.85 } : {}) });
    const segs = nodeSegments(this.tree);
    for (const s of segs) drawCut(ctx, g, s.seg, null);
    if (showTest && this.revealTrue) {
      for (const s of nodeSegments(this.level.tree)) drawCut(ctx, g, s.seg, null, { colour: C.olive, width: 2.5, dash: [8, 6] });
    }
    let busy = false;
    if (showTest) {
      const cfg = CONFIG.LAB;
      this.test.forEach((p, i) => {
        const t = this.phase === 'drop' ? (now - this.dropT0 - i * cfg.DROP_STAGGER_MS) / cfg.DROP_MS : 2;
        if (t < 0) { busy = true; return; }
        const f = Math.min(1, t);
        if (t < 1.4) busy = true;
        const X = g.px(p.x), Y0 = g.T - 14, Y1 = g.py(p.y);
        const Y = Y0 + (Y1 - Y0) * easeIn(f);
        const pop = t >= 1 ? 1 + 0.5 * Math.max(0, 1 - (t - 1) / 0.35) : 1;
        drawPoints(ctx, { px: () => X, py: () => Y }, [p], { r: 5.2 * (t >= 1 ? pop : 1), style: () => ({ outline: C.ink, outlineW: 1.6 }) });
        if (t >= 1) drawMark(ctx, X, Y1, this.score.player.ok[i], Math.min(1, (t - 1) / 0.2 + 0.4));
      });
    }
    ctx.restore();
    if (showTest && this.revealTrue) {
      // the true boundary, and how many lines it needs
      const n = listNodes(this.level.tree).length;
      const txt = `confine vero · ${n} ${n === 1 ? 'linea' : 'linee'}`;
      ctx.font = `700 11.5px ${FONT}`;
      const tw = ctx.measureText(txt).width;
      const x = g.R - tw - 40, y = g.T + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, x - 6, y, tw + 42, 20, 10); ctx.fill();
      ctx.strokeStyle = C.olive; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + 26, y + 10); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.olive; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, x + 32, y + 10.5); ctx.textBaseline = 'alphabetic';
    }
    // node numbers on top of everything, so they are never hidden by points
    for (const s of segs) {
      const [a, b] = s.seg;
      drawNumber(ctx, g.px((a[0] + b[0]) / 2), g.py((a[1] + b[1]) / 2), s.num);
    }
    drawAxes(ctx, g, this.level);
    if (!isApplied(this.tree)) {
      // the first time: where to start (and the key term, once)
      const msg = 'Tocca ? e traccia un confine di decisione';
      const sub = '(decision boundary)';
      ctx.font = `700 14px ${FONT}`;
      const tw = Math.max(ctx.measureText(msg).width, 60) + 24, cx = (g.L + g.R) / 2, cy = (g.T + g.B) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      roundRect(ctx, cx - tw / 2, cy - 22, tw, 44, 14); ctx.fill();
      ctx.fillStyle = C.soil; ctx.textAlign = 'center';
      ctx.fillText(msg, cx, cy - 2);
      ctx.font = `500 12px ${FONT}`; ctx.fillStyle = 'rgba(91,58,41,0.7)';
      ctx.fillText(sub, cx, cy + 14);
    }
    return busy;
  }

  // ------------------------------------------------------------ the tree (SVG)
  renderTree() {
    const W = Math.max(280, Math.floor(this.el.scroll.clientWidth || 360));
    const lay = layoutLab(this.tree, W, { top: NS + 8, rowH: ROW_H, pad: 6 });
    const H = lay.bottom + LEAF_R + 12;
    const nodes = listNodes(this.tree);
    let s = '';
    for (const it of lay.items) {
      if (!it.parent) continue;
      const p = it.parent;
      const x0 = p.x + (it.x > p.x ? 10 : -10), y0 = p.y + NS;
      const y1 = it.y - (it.kind === 'leaf' ? LEAF_R : it.kind === 'empty' ? ES : NS);
      s += `<path d="M${x0} ${y0}L${it.x} ${y1}" stroke="${C.soil}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`;
    }
    for (const it of lay.items) {
      const path = it.path.join('.');
      if (it.kind === 'leaf') {
        // tapping a leaf opens its node
        s += `<g class="l-leaf" data-path="${it.path.slice(0, -1).join('.')}"><circle cx="${it.x}" cy="${it.y}" r="${LEAF_R}" fill="${rgba(colourOf(it.cls), 0.25)}" stroke="${colourOf(it.cls)}" stroke-width="2.5"/>` +
          shapeSVG(it.cls, it.x, it.y + 0.6, 6.2, 'stroke="#fff" stroke-width="1"') + '</g>';
        continue;
      }
      const e = nodes.find((q) => q.path.join('.') === path);
      if (it.kind === 'empty') {
        s += `<g class="l-node empty" data-path="${path}" transform="translate(${it.x} ${it.y})" role="button" aria-label="Nodo ${it.num}, vuoto">` +
          `<rect x="-26" y="-26" width="52" height="52" fill="transparent"/>` +
          `<rect class="box" x="${-ES}" y="${-ES}" width="${2 * ES}" height="${2 * ES}" rx="8"/><text class="qmark" y="8" text-anchor="middle">?</text>` +
          `<circle cx="${-ES}" cy="${-ES}" r="8.5" fill="${C.soil}"/><text class="num" x="${-ES}" y="${-ES + 4}" text-anchor="middle">${it.num}</text></g>`;
        continue;
      }
      s += `<g class="l-node filled" data-path="${path}" transform="translate(${it.x} ${it.y})" role="button" aria-label="Nodo ${it.num}">` +
        `<rect x="-28" y="-28" width="56" height="56" fill="transparent"/>` +
        `<rect class="box" x="${-NS}" y="${-NS}" width="${2 * NS}" height="${2 * NS}" rx="8"/>` +
        thumbSVG(e.poly, it.node.line, sidesOf(it.node), -16, -16, 32) +
        `<circle cx="${-NS + 1}" cy="${-NS + 1}" r="8.5" fill="${C.soil}"/><text class="num" x="${-NS + 1}" y="${-NS + 5}" text-anchor="middle">${it.num}</text></g>`;
    }
    this.el.tree.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.el.tree.setAttribute('width', W);
    this.el.tree.setAttribute('height', H);
    this.el.tree.innerHTML = s;
  }

  // ------------------------------------------------------------ bottom: score and buttons
  updateUI() {
    if (this.li < 0) return;
    const st = labLevelStatus(this.lab, LAB_LEVELS, this.li);
    const T = this.el.tryBtn, N = this.el.next;
    N.textContent = this.li + 1 < LAB_LEVELS.length ? 'Avanti' : 'Fine';
    T.disabled = this.phase === 'drop' || !isComplete(this.tree);
    N.disabled = this.phase === 'drop' || !st.passed;
    N.classList.toggle('ready', !N.disabled && this.phase === 'result');
    this.renderScore();
  }

  // Two bars: training accuracy (live) and test accuracy (after Prova), with a green notch where
  // the best tree is, the pay, and a tick or cross for the pass mark.
  renderScore() {
    const tr = accuracy(this.tree, this.train);
    const bar = (acc, cls = '', best = null) => `<span class="s-accbar ${cls}"><span style="width:${(100 * acc).toFixed(1)}%" class="full"></span>` +
      (best != null ? `<i class="l-best" style="left:${(100 * best).toFixed(1)}%"></i>` : '') + '</span>';
    let test = `${bar(0, 'off')}<b class="l-num">–</b><span class="l-pay"></span>`;
    const sc = this.score;
    if (sc && this.phase !== 'edit') {
      const done = this.phase === 'result';
      const passed = sc.coins >= CONFIG.LAB.PASS_COINS;
      test = `${bar(done ? sc.player.acc : 0, done ? (passed ? 'pass' : 'fail') : '', done ? sc.best.acc : null)}` +
        `<b class="l-num">${done ? `${sc.player.right}/${sc.player.total}` : '…'}</b>` +
        `<span class="l-pay">${done ? `<b class="l-coins">+${this.lastPay} ${coinSvg(16)}</b>${svg40(passed ? ICON.yes : ICON.noRed, 20)}` : ''}</span>`;
    }
    this.el.score.innerHTML =
      '<div class="l-shead">accuratezza <em>(accuracy)</em> · addestramento <em>(training)</em> e test</div>' +
      `<div class="l-srow">${svg40(LAB_ICON.train, 20)}<span class="l-slab">addestramento</span>${bar(isApplied(this.tree) ? tr.acc : 0)}<b class="l-num">${isApplied(this.tree) ? `${tr.right}/${tr.total}` : tr.total}</b><span class="l-pay"></span></div>` +
      `<div class="l-srow">${svg40(LAB_ICON.test, 20)}<span class="l-slab">test</span>${test}</div>`;
    const coins = this.el.score.querySelector('.l-coins');
    if (coins && this.phase === 'result' && this.countUp) {
      // count the coins up, like the other stations
      this.countUp = false;
      const target = this.lastPay;
      let k = 0;
      coins.firstChild.textContent = '+0 ';
      const step = Math.min(CONFIG.COIN_COUNT_MS, CONFIG.COIN_COUNT_TOTAL_MS / Math.max(1, target));
      const tick = () => {
        if (k >= target || !coins.isConnected) return;
        k++;
        coins.firstChild.textContent = `+${k} `;
        coins.classList.remove('pop'); void coins.offsetWidth; coins.classList.add('pop');
        setTimeout(tick, step);
      };
      setTimeout(tick, step);
    }
  }

  // "Ricomincia il livello": after a confirmation, an empty tree and new samples.
  async onRestart() {
    if (this.phase === 'drop') return;
    const ok = await this.app.confirm(`<div class="l-confirm">${svg40(LAB_ICON.restart, 44)}<span>Albero nuovo, campioni nuovi?</span></div>`, 'Sì', 'No');
    if (ok) this.restartLevel();
  }

  // ------------------------------------------------------------ Prova
  onTry() {
    if (this.phase === 'drop' || !isComplete(this.tree)) return;
    const cfg = CONFIG.LAB, lab = this.lab, lv = this.level;
    this.test = makeSamples(lv, cfg.TEST_SIZE, labNoise(lv, lab.precision));
    const sc = scoreTest(this.tree, lv.tree, this.test);
    this.score = sc;
    this.lastPay = payFor(sc.coins, this.board);
    this.board.best = Math.max(this.board.best, sc.coins);
    const passedNow = sc.coins >= cfg.PASS_COINS;
    if (passedNow && !lab.passed.includes(lv.id)) lab.passed.push(lv.id);
    this.revealTrue = passedNow;
    const overfit = looksOverfit(accuracy(this.tree, this.train).acc, accuracy(lv.tree, this.train).acc, sc.player.acc, sc.best.acc);
    // award at once, so nothing is lost if the page closes during the animation
    this.app.earn({ levelIdx: this.li, coins: this.lastPay });
    this.app.save();
    this.phase = 'drop';
    this.dropT0 = performance.now();
    this.updateUI();
    const tick = (now) => {
      if (!this.active) return;
      const busy = this.drawField(now);
      if (busy && this.phase === 'drop') { this.raf = requestAnimationFrame(tick); return; }
      this.phase = 'result';
      this.countUp = true;
      this.drawField(now);
      this.updateUI();
      if (overfit && !lab.seenOverfit) {
        lab.seenOverfit = true;
        this.app.save();
        this.app.toast('Imparato a memoria (overfitting): bene sull\'addestramento, male sul test.', 5000);
      }
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  onNext() {
    if (!labLevelStatus(this.lab, LAB_LEVELS, this.li).passed || this.phase === 'drop') return;
    if (this.li + 1 < LAB_LEVELS.length) this.load(this.li + 1);
    else this.openLevels();
  }

  // Back from the test view to editing (the test samples go away; the next Prova draws new ones).
  toEdit() {
    if (this.phase === 'edit') return;
    cancelAnimationFrame(this.raf);
    this.phase = 'edit';
    this.test = null;
    this.render();
  }

  // ------------------------------------------------------------ node pop-up
  openPop(path) {
    if (this.phase === 'drop') return;
    const nodes = listNodes(this.tree);
    const idx = nodes.findIndex((e) => e.path.join('.') === path.join('.'));
    if (idx < 0) return;
    this.toEdit();
    const e = nodes[idx];
    const pts = this.train.filter((p) => reaches(this.tree, path, p.x, p.y));
    const ancestors = nodes.filter((q) => q.path.length < path.length && q.path.every((b, i) => b === path[i]));
    const n = e.node;
    const line = n.line ? { ...n.line } : defaultLine(e.poly);
    const choice = n.line ? sidesOf(n) : [0, 1].map((b) => majority(pts, line, b, majority(pts, null, 0)));
    this.pop = { path, num: idx + 1, poly: e.poly, ancestors, pts, line, choice, touched: [!!n.line, !!n.line], drag: null };
    this.el.popTitle.textContent = `Nodo ${idx + 1}`;
    this.el.pop.hidden = false;
    this.renderPop();
    this.sizePopCanvas();
    this.renderPop();
  }

  closePop() {
    if (!this.pop) return;
    this.pop = null;
    this.el.pop.hidden = true;
    this.render();
  }

  sizePopCanvas() {
    const w = this.el.card.clientWidth - 20;
    const chrome = this.el.card.scrollHeight - this.el.popCanvas.offsetHeight;
    const avail = this.root.clientHeight - 24 - chrome;
    const h = Math.round(Math.max(170, Math.min(w * 0.86, avail, 440)));
    this.el.popCanvas.style.height = `${h}px`;
  }

  // Choose a colour or '+' for one side.
  choose(b, c) {
    const P = this.pop;
    if (!P) return;
    P.choice[b] = c;
    P.touched[b] = true;
    this.renderPop();
  }

  // Nodes the tree would have after applying the pop-up's choices.
  nodesAfter() {
    const P = this.pop, n = nodeAt(this.tree, P.path);
    return countNodes(this.tree) - removedBy(n, P.choice) + addedBy(n, P.choice);
  }

  async applyPop() {
    const P = this.pop;
    if (!P) return;
    const n = nodeAt(this.tree, P.path);
    const gone = n.line ? removedBy(n, P.choice) : 0;
    if (gone > 0 && !(await this.confirmRemove(gone))) return;
    if (this.nodesAfter() > CONFIG.LAB.MAX_NODES) return;
    applyNode(this.tree, P.path, P.line, P.choice);
    this.app.save();
    this.closePop();
  }

  // Delete this node: it becomes a leaf of its majority colour (the root becomes empty again).
  async deletePop() {
    const P = this.pop;
    if (!P) return;
    const n = nodeAt(this.tree, P.path);
    if (!n.line && !P.path.length) return;
    const size = subtreeSize(n);
    if (size > 1 && !(await this.confirmRemove(size))) return;
    this.board.tree = deleteNode(this.tree, P.path, majority(P.pts, null, 0));
    this.app.save();
    this.closePop();
  }

  // Small, icon-first confirmation before nodes disappear.
  confirmRemove(k) {
    return this.app.confirm(`<div class="l-confirm">${svg40(LAB_ICON.trash, 44)}<span class="l-confirm-n">−${k}</span>` +
      `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="6" width="28" height="28" rx="6" fill="#fff" stroke="${C.soil}" stroke-width="3"/><path d="M11 29L29 11" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/></svg>` +
      `<span>${k === 1 ? 'nodo' : 'nodi'}</span></div>`, 'Sì', 'No');
  }

  useHint() {
    const lab = this.lab, st = this.app.getState(), id = this.level.id;
    if (lab.hinted.includes(id)) return;
    const cost = CONFIG.LAB.hintCost(lab.hintsBought);
    if (lab.hints > 0) lab.hints -= 1;
    else if (st.coins >= cost) { st.coins -= cost; lab.hintsBought += 1; this.app.coinsChanged(); }
    else return;
    lab.hinted.push(id);
    this.app.save();
    this.renderPop();
  }

  renderPop() {
    const P = this.pop;
    if (!P) return;
    const lv = this.level, max = CONFIG.LAB.MAX_NODES;
    const n = nodeAt(this.tree, P.path);
    // untouched sides follow the majority colour while the line moves
    for (let b = 0; b < 2; b++) if (!P.touched[b]) P.choice[b] = majority(P.pts, P.line, b, P.choice[b]);
    const sc = sideCount(P.line, P.choice, P.pts);
    this.el.popN.innerHTML = `${svg40(LAB_ICON.train, 18)} ${P.pts.length}`;
    this.el.popOk.innerHTML = sc.total ? `${svg40(ICON.yes, 18)} ${sc.right}/${sc.total}` : '';
    // one row per side: a small picture of that side, then its choices
    // how many points of each colour lie on each side (small numbers on the colour buttons)
    const counts = [0, 1].map((b) => lv.classes.map((_, k) => P.pts.filter((p) => p.cls === k && this.sideOf(p) === b).length));
    let html = '';
    for (let b = 0; b < 2; b++) {
      const plusOk = P.choice[b] === '+' || isNode(n.kids[b]) || this.nodesAfterWith(b) <= max;
      html += `<div class="l-side"><svg class="l-side-pic" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">${thumbSVG(P.poly, P.line, P.choice, 2, 2, 36, b)}</svg>`;
      html += lv.classes.map((name, k) =>
        `<button class="btn l-pick${P.choice[b] === k ? ' on' : ''}" data-side="${b}" data-c="${k}" aria-label="${esc(name)}" aria-pressed="${P.choice[b] === k}" style="--cc:${CLASS_COLOURS[k].fill}">` +
        `${shapeIcon(k, 20)}${counts[b][k] ? `<span class="l-pick-n">${counts[b][k]}</span>` : ''}</button>`).join('');
      html += `<button class="btn l-pick plus${P.choice[b] === '+' ? ' on' : ''}" data-side="${b}" data-c="+" aria-label="Nuovo nodo" aria-pressed="${P.choice[b] === '+'}" ${plusOk ? '' : 'disabled'}>${svg40(LAB_ICON.plus, 22)}</button></div>`;
    }
    this.el.sides.innerHTML = html;
    const lab = this.lab, st = this.app.getState();
    const hinted = lab.hinted.includes(lv.id);
    const cost = CONFIG.LAB.hintCost(lab.hintsBought);
    this.el.hint.hidden = hinted;
    this.el.hint.innerHTML = `${svg40(ICON.hint, 22)}<span>${lab.hints > 0 ? `×${lab.hints}` : `${cost} ${coinSvg(14)}`}</span>`;
    this.el.hint.disabled = lab.hints === 0 && st.coins < cost;
    this.el.del.disabled = !n.line && !P.path.length;
    this.el.apply.innerHTML = `${svg40(LAB_ICON.apply, 26)}<span>Applica</span>`;
    this.el.apply.disabled = this.nodesAfter() > max;
    this.drawPop();
  }

  sideOf(p) {
    const s = this.pop.line;
    return (s.x2 - s.x1) * (p.y - s.y1) - (s.y2 - s.y1) * (p.x - s.x1) > 0 ? 0 : 1;
  }

  nodesAfterWith(b) {
    const P = this.pop, keep = P.choice[b];
    P.choice[b] = '+';
    const k = this.nodesAfter();
    P.choice[b] = keep;
    return k;
  }

  popGeom() {
    const r = this.el.popCanvas.getBoundingClientRect();
    return fieldGeom(r.width, r.height);
  }

  drawPop() {
    const P = this.pop;
    const { ctx, W, H } = fitCanvas(this.el.popCanvas);
    const g = fieldGeom(W, H);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, g);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.L, g.T, g.R - g.L, g.B - g.T); ctx.clip();
    // the two sides: tinted with their colour; a "+" side stays white with a big plus
    const sides = [0, 1].map((b) => clipBranch(P.poly, P.line, b));
    sides.forEach((p, b) => {
      if (!p.length || P.choice[b] === '+') return;
      ctx.fillStyle = rgba(colourOf(P.choice[b]), 0.2); ctx.beginPath(); tracePoly(ctx, g, p); ctx.fill();
    });
    // everything cut away by the nodes above: shaded out
    if (P.ancestors.length) {
      ctx.beginPath();
      ctx.rect(g.L, g.T, g.R - g.L, g.B - g.T);
      tracePoly(ctx, g, P.poly);
      ctx.fillStyle = 'rgba(120,104,86,0.30)';
      ctx.fill('evenodd');
      ctx.save();
      ctx.clip('evenodd');
      ctx.strokeStyle = 'rgba(91,58,41,0.13)'; ctx.lineWidth = 1;
      for (let x = -H; x < W; x += 9) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
      ctx.restore();
    }
    for (const a of P.ancestors) {
      const seg = lineInPoly(a.node.line, a.poly);
      if (seg) drawCut(ctx, g, seg, null, { width: 2.2 });
    }
    // hint: bands roughly where the true lines lie, inside this node's region
    if (this.lab.hinted.includes(this.level.id)) {
      ctx.save();
      ctx.beginPath(); tracePoly(ctx, g, P.poly); ctx.clip();
      ctx.strokeStyle = 'rgba(244,201,93,0.55)'; ctx.lineCap = 'butt';
      ctx.lineWidth = CONFIG.LAB.HINT_BAND * (g.R - g.L);
      for (const s of nodeSegments(this.level.tree)) {
        ctx.beginPath(); ctx.moveTo(g.px(s.seg[0][0]), g.py(s.seg[0][1])); ctx.lineTo(g.px(s.seg[1][0]), g.py(s.seg[1][1])); ctx.stroke();
      }
      ctx.restore();
    }
    // the points that reach this node: vivid where they match their side's colour (or on a "+" side)
    const vivid = (p) => { const c = P.choice[this.sideOf(p)]; return c === '+' || c === p.cls; };
    drawPoints(ctx, g, P.pts.filter((p) => !vivid(p)), { r: 4, style: (p) => ({ fill: muted(colourOf(p.cls)), outline: '#fff' }) });
    drawPoints(ctx, g, P.pts.filter(vivid), { r: 5.2 });
    // the line: solid where it matters (inside the region), dashed outside
    const full = lineInPoly(P.line, UNIT_SQUARE);
    if (full) drawCut(ctx, g, full, null, { colour: 'rgba(58,37,25,0.45)', width: 1.6, dash: [5, 5] });
    const seg = lineInPoly(P.line, P.poly);
    if (seg) drawCut(ctx, g, seg, null, { colour: C.ink, width: 3.5 });
    // a round marker in the middle of each side: its colour, or "+"
    sides.forEach((p, b) => {
      if (!p.length || polyArea(p) < 0.01) return;
      const m = polyCentroid(p);
      const X = Math.max(g.L + 16, Math.min(g.R - 16, g.px(m.x))), Y = Math.max(g.T + 16, Math.min(g.B - 16, g.py(m.y)));
      const c = P.choice[b];
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = c === '+' ? C.soil : colourOf(c); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X, Y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (c === '+') {
        ctx.strokeStyle = C.soil; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(X - 6, Y); ctx.lineTo(X + 6, Y); ctx.moveTo(X, Y - 6); ctx.lineTo(X, Y + 6); ctx.stroke();
      } else { shapePath(ctx, shapeOf(c), X, Y + 0.5, 6); ctx.fillStyle = colourOf(c); ctx.fill(); }
    });
    ctx.restore();
    for (const a of P.ancestors) {
      const seg2 = lineInPoly(a.node.line, a.poly);
      if (seg2) drawNumber(ctx, g.px((seg2[0][0] + seg2[1][0]) / 2), g.py((seg2[0][1] + seg2[1][1]) / 2), listNodes(this.tree).findIndex((q) => q.node === a.node) + 1);
    }
    const act = P.drag && P.drag.end;
    drawHandle(ctx, g.px(P.line.x1), g.py(P.line.y1), act === 1 || P.drag?.line);
    drawHandle(ctx, g.px(P.line.x2), g.py(P.line.y2), act === 2 || P.drag?.line);
    drawAxes(ctx, g, this.level);
  }

  // Drag: grab a handle to move that end (the line pivots on the other one), or grab the line
  // itself to slide it. Pointer events with capture; the canvas has touch-action: none.
  onPopDown(e) {
    const P = this.pop;
    if (!P) return;
    const sp = P.line;
    const g = this.popGeom();
    const r = this.el.popCanvas.getBoundingClientRect();
    const X = e.clientX - r.left, Y = e.clientY - r.top;
    const d1 = Math.hypot(g.px(sp.x1) - X, g.py(sp.y1) - Y), d2 = Math.hypot(g.px(sp.x2) - X, g.py(sp.y2) - Y);
    let drag = null;
    if (Math.min(d1, d2) <= HANDLE_HIT) drag = { end: d1 <= d2 ? 1 : 2 };
    else {
      const ax = g.px(sp.x1), ay = g.py(sp.y1), bx = g.px(sp.x2), by = g.py(sp.y2);
      const dist = Math.abs((bx - ax) * (ay - Y) - (ax - X) * (by - ay)) / Math.hypot(bx - ax, by - ay);
      if (dist <= LINE_HIT && X >= g.L && X <= g.R && Y >= g.T && Y <= g.B) drag = { line: true, fx: g.fx(X), fy: g.fy(Y), start: { ...sp } };
    }
    if (!drag) return;
    e.preventDefault();
    this.el.popCanvas.setPointerCapture(e.pointerId);
    P.drag = drag;
    this.drawPop();
  }

  onPopMove(e) {
    const P = this.pop, sp = P.line;
    const g = this.popGeom();
    const r = this.el.popCanvas.getBoundingClientRect();
    const x = clamp01(g.fx(e.clientX - r.left)), y = clamp01(g.fy(e.clientY - r.top));
    if (P.drag.end) {
      const ox = P.drag.end === 1 ? sp.x2 : sp.x1, oy = P.drag.end === 1 ? sp.y2 : sp.y1;
      if (Math.hypot(x - ox, y - oy) < MIN_LEN) return;
      if (P.drag.end === 1) { sp.x1 = x; sp.y1 = y; } else { sp.x2 = x; sp.y2 = y; }
    } else {
      const s0 = P.drag.start;
      let dx = x - P.drag.fx, dy = y - P.drag.fy;
      dx = Math.max(-Math.min(s0.x1, s0.x2), Math.min(1 - Math.max(s0.x1, s0.x2), dx));
      dy = Math.max(-Math.min(s0.y1, s0.y2), Math.min(1 - Math.max(s0.y1, s0.y2), dy));
      sp.x1 = s0.x1 + dx; sp.y1 = s0.y1 + dy; sp.x2 = s0.x2 + dx; sp.y2 = s0.y2 + dy;
    }
    if (this.livePending) return;
    this.livePending = true;
    requestAnimationFrame(() => { this.livePending = false; this.renderPop(); });
  }

  // ------------------------------------------------------------ level list
  openLevels() {
    this.app.openSheet('Livelli', (body) => {
      let html = '<div class="s-levels-grid">';
      LAB_LEVELS.forEach((lv, i) => {
        const st = labLevelStatus(this.lab, LAB_LEVELS, i);
        const badge = st.passed ? svg40(ICON.yes, 20) : !st.open ? svg40(ICON.lock, 20) : '';
        html += `<button class="btn s-lv${i === this.li ? ' on' : ''}${st.open ? '' : ' closed'}" data-lv="${i}">` +
          `<span class="s-lv-no">${i + 1}</span><span class="s-lv-t">${esc(lv.title)}</span>` +
          `<span class="s-lv-g l-lv-dots">${lv.classes.map((_, k) => shapeIcon(k, 11)).join('')}</span><span class="s-lv-b">${badge}</span></button>`;
      });
      body.innerHTML = html + '</div>';
      body.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.lv);
        if (!labLevelStatus(this.lab, LAB_LEVELS, i).open) return;
        this.app.closeSheet();
        this.load(i);
      }));
    });
  }
}

// A node number on the field, drawn on top of the points.
function drawNumber(ctx, X, Y, n) {
  ctx.fillStyle = C.soil; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X, Y, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `800 11.5px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), X, Y + 0.5);
  ctx.textBaseline = 'alphabetic';
}
