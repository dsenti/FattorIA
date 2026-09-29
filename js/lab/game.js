// Minigame 3: Il laboratorio (the analysis lab). A decision tree of boundary lines at any angle
// classifies farm samples measured on two properties.
// Owns the #screen-lab screen: the field (canvas) with the training samples and the tree's
// regions, the tree (SVG), the node pop-up (pick two colours, drag the line), "Prova" (a new test
// batch falls into the field, pay), "Avanti", the level list.
import { CONFIG } from '../config.js';
import { LAB_LEVELS, CLASS_COLOURS } from './levels.js';
import {
  compileLab, isSet, regions, nodeRegion, nodeSegments, reaches, accuracy, nodeCount, defaultSpec,
  makeSamples, labNoise, labSamples, scoreTest, payFor, looksOverfit, isSpare, clipBranch, polyArea,
  polyCentroid, lineInPoly, labLevelStatus, labStartLevel, layoutLab, UNIT_SQUARE,
} from './model.js';
import {
  C, FONT, fitCanvas, fieldGeom, tracePoly, drawBackground, drawAxes, drawPoints, drawRegions, drawCut,
  drawHandle, drawMark, pill, roundRect, colourOf, muted, rgba, shapeSVG, shapeIcon, thumbSVG, LAB_ICON,
} from './draw.js';
import { ICON, svg40 } from '../sorting/art.js';

export const LAB_COMPILED = LAB_LEVELS.map((lv) => compileLab(lv.tree));

const NS = 21;           // half size of a node box in the tree
const ROW_H = 72;        // vertical distance between tree rows
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
    '<p>Dalle fattorie della valle arrivano campioni: olive, uva, latte, miele… Il laboratorio ne misura due caratteristiche <em>(features)</em>, i due assi. Ogni punto è un campione, e il suo colore è la sua <b>etichetta</b> <em>(label)</em>: la classe vera.</p>' +
    '<p>Il tuo compito è una <b>classificazione</b> <em>(classification)</em>: riconoscere la classe dalle sole misure.</p>' +
    '<ol>' +
    '<li>Sotto il campo c\'è un <b>albero di decisione</b> <em>(decision tree)</em>. Ogni nodo è una linea, un <b>confine di decisione</b> <em>(decision boundary)</em>. Tocca un nodo <b>?</b>.</li>' +
    '<li>Scegli i due colori da separare e trascina i due pallini della linea, in qualsiasi direzione. Ogni lato della linea va a una <b>foglia</b>, che dà il suo colore, oppure al nodo seguente, che vede solo i punti di quel lato.</li>' +
    '<li>Il campo si colora con le zone dell\'albero. L\'<b>accuratezza</b> <em>(accuracy)</em> dice quanti campioni di <b>addestramento</b> <em>(training)</em> cadono nella zona del loro colore.</li>' +
    '<li><b>Prova</b>: arrivano campioni nuovi, mai visti, il <b>test</b>. Ti pagano per il test, fino a 10 monete, a confronto con l\'albero migliore. Con 7 monete o più passi al livello seguente.</li>' +
    '</ol>' +
    '<p>Le misure hanno un po\' di rumore: lungo i confini i colori si mescolano. Un albero che insegue ogni punto di addestramento sbaglia sul test: ha <b>imparato a memoria</b> <em>(overfitting)</em>.</p>' +
    '<p>Un albero guadagna al massimo 10 monete per livello: una Prova migliore paga solo la differenza. Per guadagnare ancora, ricomincia il livello da zero.</p>';
}

export class LabGame {
  // app: { getState(), save(), earn({ levelIdx, coins }), openSheet(title, render, onClose), closeSheet(),
  //        toast(msg, ms), openShop(), overlayOpen(), coinsChanged(), confirm(html, yes, no) -> Promise<bool> }
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      scroll: $('l-scroll'), legend: $('l-legend'), fieldWrap: $('l-field-wrap'), field: $('l-field'), acc: $('l-acc'), tree: $('l-tree'),
      result: $('l-result'), tryBtn: $('l-try'), next: $('l-next'),
      levels: $('l-levels'), restart: $('l-restart'), levelNo: $('l-level-no'), title: $('l-title'), story: $('l-story'),
      pop: $('l-pop'), card: $('l-card'), popTitle: $('l-pop-title'), popSub: $('l-pop-sub'), chips: $('l-chips'),
      step2: $('l-step2'), popCanvas: $('l-pop-canvas'), count: $('l-count'),
      swap: $('l-swap'), turn: $('l-turn'), hint: $('l-hint'), done: $('l-done'), popX: $('l-pop-x'),
    };
    this.li = -1;
    this.phase = 'edit';   // edit | drop (test samples falling) | result
    this.active = false;
    this.pop = null;       // the open node pop-up: { idx, poly, ancestors, pts, order, drag }
    this.raf = 0;

    this.el.tryBtn.addEventListener('click', () => this.onTry());
    this.el.next.addEventListener('click', () => this.onNext());
    this.el.levels.addEventListener('click', () => this.openLevels());
    this.el.restart.addEventListener('click', () => this.onRestart());
    this.el.tree.addEventListener('click', (e) => {
      const n = e.target.closest('[data-n]');
      if (n && !this.app.overlayOpen()) this.openPop(Number(n.dataset.n));
    });
    // pop-up: a tap outside the card closes it. On "click", not "pointerdown": otherwise the
    // same tap would go on to the button under the backdrop (e.g. "Prova").
    this.el.pop.addEventListener('click', (e) => { if (e.target === this.el.pop) this.closePop(); });
    this.el.done.addEventListener('click', () => this.closePop());
    this.el.popX.addEventListener('click', () => this.closePop());
    this.el.swap.addEventListener('click', () => this.swapColours());
    this.el.turn.addEventListener('click', () => this.turnSides());
    this.el.hint.addEventListener('click', () => this.useHint());
    this.el.chips.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) this.pickColour(Number(b.dataset.c)); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.pop) this.closePop(); });
    const cv = this.el.popCanvas;
    cv.addEventListener('pointerdown', (e) => this.onPopDown(e));
    cv.addEventListener('pointermove', (e) => { if (this.pop && this.pop.drag) { e.preventDefault(); this.onPopMove(e); } });
    const end = () => { if (this.pop && this.pop.drag) { this.pop.drag = null; this.app.save(); this.renderPop(); } };
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
  get specs() { return this.board.nodes; }

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
    this.comp = LAB_COMPILED[li];
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
    return { nodes: new Array(this.comp.nodes.length).fill(null), best: 0, replay: this.lab.passed.includes(this.level.id) };
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
    this.train = makeSamples(this.level, this.comp, labSamples(this.level, lab.samples), labNoise(this.level, lab.precision));
    this.dataKey = this.currentDataKey();
  }

  // ------------------------------------------------------------ rendering
  render() {
    if (this.li < 0) return;
    const lv = this.level;
    this.el.levelNo.textContent = `${this.li + 1}/${LAB_LEVELS.length}`;
    this.el.title.textContent = lv.title;
    this.el.story.textContent = lv.story;
    this.el.legend.innerHTML = lv.classes.map((name, k) => `<span class="l-leg">${shapeIcon(k, 14)}${esc(name)}</span>`).join('');
    // field height: whatever the tree leaves free, from a short field on small phones (then the
    // tree scrolls) up to an almost square one
    const w = this.el.fieldWrap.clientWidth || 360;
    const depth = Math.max(...this.comp.leaves.map((l) => l.depth));
    const treeH = NS + 8 + depth * ROW_H + LEAF_R + 12;
    const free = this.el.scroll.clientHeight - treeH - this.el.legend.offsetHeight - 78;
    this.el.fieldWrap.style.height = `${Math.round(Math.max(200, Math.min(w * 0.9, free)))}px`;
    this.drawField(performance.now());
    this.renderAcc();
    this.renderTree();
    this.updateUI();
  }

  renderAcc() {
    const n = this.train.length;
    if (!isSet(this.specs[0])) {
      this.el.acc.innerHTML = `<span><b>Addestramento</b> <em>(training)</em>: ${n} campioni. Il colore di ogni punto è la sua etichetta <em>(label)</em>.</span>`;
      return;
    }
    const a = accuracy(this.comp, this.specs, this.train);
    this.el.acc.innerHTML = `<span><b>Addestramento</b> <em>(training)</em> · accuratezza <em>(accuracy)</em>: <b>${a.right}/${a.total}</b> giusti</span>` +
      `<span class="s-accbar"><span style="width:${(100 * a.acc).toFixed(1)}%" class="full"></span></span>`;
  }

  // The main field: regions, lines, training samples; after "Prova" the test samples on top.
  drawField(now) {
    const { ctx, W, H } = fitCanvas(this.el.field);
    const g = fieldGeom(W, H);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, g);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.L, g.T, g.R - g.L, g.B - g.T); ctx.clip();
    drawRegions(ctx, g, regions(this.comp, this.specs), 0.2);
    const showTest = this.test && this.phase !== 'edit';
    const r = Math.max(3.6, Math.min(4.8, 5.3 - this.train.length / 100));
    drawPoints(ctx, g, this.train, { r, style: () => (showTest ? { alpha: 0.28, r: r * 0.85 } : {}) });
    const segs = nodeSegments(this.comp, this.specs);
    for (const s of segs) drawCut(ctx, g, s.seg, null);
    if (showTest && this.revealTrue) {
      for (const s of nodeSegments(this.comp, this.comp.truth)) drawCut(ctx, g, s.seg, null, { colour: C.olive, width: 2.5, dash: [8, 6] });
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
      // small legend for the dashed true boundary
      ctx.font = `700 11.5px ${FONT}`;
      const tw = ctx.measureText('confine vero').width;
      const x = g.R - tw - 40, y = g.T + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      roundRect(ctx, x - 6, y, tw + 42, 20, 10); ctx.fill();
      ctx.strokeStyle = C.olive; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + 26, y + 10); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.olive; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('confine vero', x + 32, y + 10.5); ctx.textBaseline = 'alphabetic';
    }
    // node numbers on top of everything, so they are never hidden by points
    for (const s of segs) {
      const [a, b] = s.seg;
      const X = g.px((a[0] + b[0]) / 2), Y = g.py((a[1] + b[1]) / 2);
      drawNumber(ctx, X, Y, s.idx + 1);
    }
    drawAxes(ctx, g, this.level);
    if (!isSet(this.specs[0])) {
      ctx.fillStyle = 'rgba(91,58,41,0.7)';
      ctx.font = `600 14px ${FONT}`;
      ctx.textAlign = 'center';
      const msg = 'Tocca il nodo 1 qui sotto';
      const tw = ctx.measureText(msg).width + 20, cx = (g.L + g.R) / 2, cy = (g.T + g.B) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      roundRect(ctx, cx - tw / 2, cy - 15, tw, 30, 15); ctx.fill();
      ctx.fillStyle = C.soil;
      ctx.fillText(msg, cx, cy + 5);
    }
    return busy;
  }

  // ------------------------------------------------------------ the tree (SVG)
  renderTree() {
    const comp = this.comp, specs = this.specs;
    const W = Math.max(280, Math.floor(this.el.scroll.clientWidth || 360));
    const lay = layoutLab(comp, W, { top: NS + 8, rowH: ROW_H, pad: 6 });
    const H = lay.bottom + LEAF_R + 12;
    // A node whose two sides are both leaves: draw its leaves in the field's left-to-right order
    // (by the middle of each side), so the tree and the field read the same way.
    const leafAt = comp.leaves.map((l) => ({ x: l.x, y: l.y }));
    for (const n of comp.nodes) {
      const sp = specs[n.idx];
      if (!isSet(sp) || n.kids.some((k) => k.node != null)) continue;
      const reg = nodeRegion(comp, specs, n.idx);
      const m = reg && [0, 1].map((b) => polyCentroid(clipBranch(reg.poly, sp, b)));
      if (m && m[0] && m[1] && m[0].x > m[1].x + 0.02) {
        const [a, b] = n.kids.map((k) => k.leaf);
        leafAt[a] = { x: comp.leaves[b].x, y: comp.leaves[b].y };
        leafAt[b] = { x: comp.leaves[a].x, y: comp.leaves[a].y };
      }
    }
    let s = '';
    // branches with the colour of each side
    for (const n of comp.nodes) {
      const sp = specs[n.idx];
      n.kids.forEach((k, b) => {
        const ch = k.node != null ? comp.nodes[k.node] : leafAt[k.leaf];
        const x0 = n.x + (ch.x > n.x ? 11 : -11), y0 = n.y + NS;
        const x1 = ch.x, y1 = k.node != null ? ch.y - NS : ch.y - LEAF_R;
        s += `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${C.soil}" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
        const mx = x0 + (x1 - x0) * 0.5, my = y0 + (y1 - y0) * 0.5;
        if (isSet(sp)) s += `<circle cx="${mx}" cy="${my}" r="9" fill="#fff" stroke="${colourOf(sp.c[b])}" stroke-width="2.2"/>` + shapeSVG(sp.c[b], mx, my + 0.4, 4.6);
        else s += `<circle cx="${mx}" cy="${my}" r="5" fill="${C.cream}" stroke="${C.soil}" stroke-opacity=".35" stroke-width="1.5"/>`;
      });
    }
    // leaves: the class they predict
    for (const leaf of comp.leaves) {
      const sp = specs[leaf.node];
      const cls = isSet(sp) ? sp.c[leaf.branch] : null;
      const { x, y } = leafAt[leaf.idx];
      s += cls == null
        ? `<circle cx="${x}" cy="${y}" r="${LEAF_R}" fill="${C.cream}" stroke="${C.soil}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 3"/>`
        : `<circle cx="${x}" cy="${y}" r="${LEAF_R}" fill="${rgba(colourOf(cls), 0.25)}" stroke="${colourOf(cls)}" stroke-width="2.5"/>` + shapeSVG(cls, x, y + 0.6, 6.2, 'stroke="#fff" stroke-width="1"');
    }
    // nodes
    for (const n of comp.nodes) {
      const sp = specs[n.idx];
      const reg = nodeRegion(comp, specs, n.idx);
      const ready = !!reg;
      const cls = ['l-node', isSet(sp) ? 'filled' : 'empty', ready ? 'ready' : 'waiting'];
      s += `<g class="${cls.join(' ')}" data-n="${n.idx}" transform="translate(${n.x} ${n.y})" role="button" aria-label="Nodo ${n.idx + 1}${isSet(sp) ? '' : ', vuoto'}">` +
        `<rect x="-28" y="-28" width="56" height="56" fill="transparent"/>` +
        `<rect class="box" x="${-NS}" y="${-NS}" width="${2 * NS}" height="${2 * NS}" rx="8"/>` +
        (isSet(sp) ? thumbSVG(reg && reg.poly, sp, -16, -16, 32) : `<text class="qmark" y="9" text-anchor="middle">?</text>`) +
        `<circle cx="${-NS + 1}" cy="${-NS + 1}" r="9" fill="${C.soil}"/><text class="num" x="${-NS + 1}" y="${-NS + 5}" text-anchor="middle">${n.idx + 1}</text>` +
        ((this.lab.hinted[this.level.id] || []).includes(n.idx) ? `<g transform="translate(${NS - 9} ${-NS - 9})">${hintMini()}</g>` : '') +
        '</g>';
    }
    this.el.tree.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.el.tree.setAttribute('width', W);
    this.el.tree.setAttribute('height', H);
    this.el.tree.innerHTML = s;
  }

  // ------------------------------------------------------------ bottom bar
  updateUI() {
    if (this.li < 0) return;
    const st = labLevelStatus(this.lab, LAB_LEVELS, this.li);
    const full = this.specs.every(isSet);
    const T = this.el.tryBtn, N = this.el.next, R = this.el.result;
    N.textContent = this.li + 1 < LAB_LEVELS.length ? 'Avanti' : 'Fine';
    T.disabled = this.phase === 'drop' || !full;
    N.disabled = this.phase === 'drop' || !st.passed;
    N.classList.toggle('ready', !N.disabled && this.phase === 'result');
    if (this.phase === 'drop') { R.innerHTML = '<div class="s-msg">Arrivano campioni nuovi, mai visti…</div>'; return; }
    if (this.phase === 'result' && this.score) {
      const sc = this.score, cfg = CONFIG.LAB;
      const note = this.overfitNote ? 'Meglio dell\'albero migliore sull\'addestramento, peggio sul test: ha <b>imparato a memoria</b> <em>(overfitting)</em>.'
        : sc.coins >= cfg.PASS_COINS ? 'Livello superato!'
          : `Per passare servono ${cfg.PASS_COINS}/10: sposta le linee e riprova.`;
      // why the pay can be less than the score
      const why = [];
      if (this.prevBest > 0 && sc.coins > 0) why.push(sc.coins > this.prevBest ? `questo albero aveva già ${this.prevBest}` : `record di questo albero: ${this.prevBest}`);
      if (this.board.replay && sc.coins > this.prevBest) why.push('livello già superato: metà paga');
      R.innerHTML =
        `<div class="s-msg"><b>Test</b> su ${sc.player.total} campioni nuovi: <b>${sc.player.right}/${sc.player.total}</b> giusti · albero migliore: ${sc.best.right}/${sc.best.total}</div>` +
        `<div class="s-msg"><b class="s-pay">${sc.coins}/${CONFIG.MAX_PAY} · +${this.lastPay} ${coinSvg(16)}</b> ${note}${why.length ? ` <span class="l-small">(${why.join('; ')})</span>` : ''}</div>`;
      return;
    }
    const empty = this.specs.filter((x) => !isSet(x)).length;
    const maxed = this.board.best >= CONFIG.MAX_PAY;
    R.innerHTML = `<div class="s-msg">${empty
      ? `Tocca i nodi <b>?</b> e metti i confini (${empty} ${empty === 1 ? 'nodo vuoto' : 'nodi vuoti'}).`
      : maxed ? `Questo albero ha già guadagnato il massimo. Per altre monete, ricomincia il livello (${svg40(LAB_ICON.restart, 16)} in alto).`
        : 'Pronto: fai la Prova su campioni nuovi, mai visti (il test).'}</div>`;
  }

  // "Ricomincia il livello": after a confirmation, an empty tree and new samples.
  async onRestart() {
    if (this.phase === 'drop') return;
    const ok = await this.app.confirm('<h2>Ricominciare il livello?</h2><p>L\'albero si svuota e arrivano campioni nuovi. Un albero nuovo può guadagnare di nuovo fino a 10 monete' +
      (this.lab.passed.includes(this.level.id) ? ' (metà paga, perché il livello è già superato).' : '.') + '</p>', 'Sì, albero nuovo', 'No');
    if (ok) this.restartLevel();
  }

  // ------------------------------------------------------------ Prova
  onTry() {
    if (this.phase === 'drop' || !this.specs.every(isSet)) return;
    const cfg = CONFIG.LAB, lab = this.lab, lv = this.level;
    this.test = makeSamples(lv, this.comp, cfg.TEST_SIZE, labNoise(lv, lab.precision));
    const sc = scoreTest(this.comp, this.specs, this.test);
    this.score = sc;
    const pay = payFor(sc.coins, this.board);
    this.lastPay = pay;
    this.prevBest = this.board.best;
    this.board.best = Math.max(this.board.best, sc.coins);
    const passedNow = sc.coins >= cfg.PASS_COINS;
    if (passedNow && !lab.passed.includes(lv.id)) lab.passed.push(lv.id);
    this.revealTrue = passedNow;
    this.overfitNote = looksOverfit(accuracy(this.comp, this.specs, this.train).acc, accuracy(this.comp, this.comp.truth, this.train).acc,
      sc.player.acc, sc.best.acc);
    // award at once, so nothing is lost if the page closes during the animation
    this.app.earn({ levelIdx: this.li, coins: pay });
    if (this.overfitNote && !lab.seenOverfit) {
      lab.seenOverfit = true;
      this.app.toast('Sui campioni di addestramento il tuo albero batte l\'albero migliore, sui campioni nuovi no: ha imparato a memoria (overfitting). Confini più semplici funzionano meglio.', 6000);
    }
    this.app.save();
    this.phase = 'drop';
    this.dropT0 = performance.now();
    this.updateUI();
    const tick = (now) => {
      if (!this.active) return;
      const busy = this.drawField(now);
      if (busy && this.phase === 'drop') { this.raf = requestAnimationFrame(tick); return; }
      this.phase = 'result';
      this.drawField(now);
      this.updateUI();
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  onNext() {
    if (!labLevelStatus(this.lab, LAB_LEVELS, this.li).passed || this.phase === 'drop') return;
    if (this.li + 1 < LAB_LEVELS.length) this.load(this.li + 1);
    else {
      this.app.toast('Hai finito tutti i livelli del laboratorio. Bravissimi!', 3500);
      this.openLevels();
    }
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
  openPop(idx) {
    if (this.phase === 'drop') return;
    const reg = nodeRegion(this.comp, this.specs, idx);
    if (!reg) {
      const up = this.comp.nodes[idx].parent;
      this.app.toast(`Prima sistema il nodo ${up + 1}: questo nodo vede solo i punti di un suo lato.`);
      return;
    }
    this.toEdit();
    const pts = this.train.filter((p) => reaches(this.comp, this.specs, idx, p.x, p.y));
    const sp = this.specs[idx];
    this.pop = { idx, poly: reg.poly, ancestors: reg.ancestors, pts, order: isSet(sp) ? [...sp.c] : [], drag: null };
    // only two colours here: both are picked at once
    const present = this.presentColours();
    if (!isSet(sp) && present.length === 2) this.setSpec(defaultSpec(reg.poly, present, pts), present);
    this.el.popTitle.textContent = `Nodo ${idx + 1}`;
    this.el.popSub.textContent = `${pts.length} ${pts.length === 1 ? 'campione arriva' : 'campioni arrivano'} qui`;
    this.el.pop.hidden = false;
    this.sizePopCanvas();
    this.renderPop();
  }

  closePop() {
    if (!this.pop) return;
    this.pop = null;
    this.el.pop.hidden = true;
    this.app.save();
    this.render();
  }

  presentColours() {
    const n = this.level.classes.map(() => 0);
    for (const p of this.pop.pts) n[p.cls]++;
    return n.map((v, k) => (v > 0 ? k : -1)).filter((k) => k >= 0);
  }

  setSpec(spec, order) {
    this.board.nodes[this.pop.idx] = spec;
    if (order) this.pop.order = [...order];
  }

  sizePopCanvas() {
    const card = this.el.card;
    const w = card.clientWidth - 20;
    const avail = this.root.clientHeight - 300 - (this.el.chips.offsetHeight > 50 ? 44 : 0);
    const h = Math.round(Math.max(180, Math.min(w * 0.86, avail, 440)));
    this.el.popCanvas.style.height = `${h}px`;
  }

  // Step 1: tap a colour. Once two are picked, a new tap replaces the older of the two (on the
  // same side of the line).
  pickColour(k) {
    const P = this.pop;
    if (!P) return;
    const sp = this.specs[P.idx];
    if (isSet(sp)) {
      if (sp.c.includes(k)) return;
      const old = P.order[0];
      sp.c[sp.c.indexOf(old)] = k;
      P.order = [P.order[1], k];
    } else {
      if (P.order.includes(k)) P.order = P.order.filter((c) => c !== k);
      else P.order.push(k);
      if (P.order.length === 2) this.setSpec(defaultSpec(P.poly, P.order, P.pts));
    }
    this.afterNodeChange();
  }

  // The two colours trade sides (the line stays).
  swapColours() {
    const sp = this.pop && this.specs[this.pop.idx];
    if (!isSet(sp)) return;
    sp.c = [sp.c[1], sp.c[0]];
    this.afterNodeChange();
  }

  // The next node(s) get the other side (the colours stay where they are).
  turnSides() {
    const sp = this.pop && this.specs[this.pop.idx];
    if (!isSet(sp)) return;
    sp.flip = !sp.flip;
    sp.c = [sp.c[1], sp.c[0]];
    this.afterNodeChange();
  }

  afterNodeChange() {
    this.app.save();
    this.renderPop();
  }

  useHint() {
    const P = this.pop;
    if (!P) return;
    const lab = this.lab, st = this.app.getState(), id = this.level.id;
    const hinted = lab.hinted[id] || [];
    if (hinted.includes(P.idx)) return;
    const cost = CONFIG.LAB.hintCost(lab.hintsBought);
    if (lab.hints > 0) lab.hints -= 1;
    else if (st.coins >= cost) { st.coins -= cost; lab.hintsBought += 1; this.app.coinsChanged(); }
    else return;
    lab.hinted[id] = [...hinted, P.idx];
    this.app.save();
    this.renderPop();
  }

  renderPop() {
    const P = this.pop;
    if (!P) return;
    const lv = this.level, sp = this.specs[P.idx], set = isSet(sp);
    const counts = lv.classes.map(() => 0);
    for (const p of P.pts) counts[p.cls]++;
    const picked = set ? sp.c : P.order;
    this.el.chips.innerHTML = lv.classes.map((name, k) =>
      `<button class="btn l-chip${picked.includes(k) ? ' on' : ''}${counts[k] ? '' : ' none'}" data-c="${k}" aria-pressed="${picked.includes(k)}" style="--cc:${CLASS_COLOURS[k].fill}">` +
      `${shapeIcon(k, 16)}<span>${esc(name)}</span><span class="l-chip-n">${counts[k]}</span></button>`).join('');
    this.el.step2.classList.toggle('off', !set);
    this.drawPop();
    // live count
    if (set) {
      const nc = nodeCount(sp, P.pts);
      const per = sp.c.map((c) => `${shapeIcon(c, 13)}${nc.per[c][0]}/${nc.per[c][1]}`).join(' · ');
      this.el.count.innerHTML = `Dalla parte giusta: <b>${nc.right} su ${nc.total}</b> <span class="l-per">(${per})</span>`;
      if ((this.lab.hinted[lv.id] || []).includes(P.idx)) {
        this.el.count.innerHTML += `<div class="l-hint-note">${svg40(ICON.hint, 16)} ${isSpare(this.comp, P.idx)
          ? 'Questo nodo quasi non serve: il confine vero passa fuori dai punti. Mettilo dove non taglia niente.'
          : 'Il confine vero passa più o meno nella fascia gialla.'}</div>`;
      }
    } else {
      this.el.count.innerHTML = P.order.length ? 'Scegli il secondo colore.' : 'Scegli i due colori da separare con la linea.';
    }
    const node = this.comp.nodes[P.idx];
    const kids = node.kids.filter((k) => k.node != null).map((k) => k.node + 1);
    this.el.swap.disabled = !set;
    this.el.turn.hidden = kids.length === 0;
    this.el.turn.disabled = !set;
    this.el.turn.innerHTML = `${svg40(LAB_ICON.turn, 22)}<span>${kids.length === 2 ? 'Scambia i nodi' : `Nodo ${kids[0]}: altro lato`}</span>`;
    const lab = this.lab, st = this.app.getState();
    const hinted = (lab.hinted[lv.id] || []).includes(P.idx);
    const cost = CONFIG.LAB.hintCost(lab.hintsBought);
    this.el.hint.innerHTML = `${svg40(ICON.hint, 20)}<span>${hinted ? 'Suggerimento usato' : lab.hints > 0 ? `Suggerimento <em>(hint)</em> · ne hai ${lab.hints}` : `Suggerimento <em>(hint)</em> · ${cost} ${coinSvg(15)}`}</span>`;
    this.el.hint.disabled = hinted || (lab.hints === 0 && st.coins < cost);
  }

  popGeom() {
    const r = this.el.popCanvas.getBoundingClientRect();
    return fieldGeom(r.width, r.height);
  }

  drawPop() {
    const P = this.pop;
    const { ctx, W, H } = fitCanvas(this.el.popCanvas);
    const g = fieldGeom(W, H);
    const sp = this.specs[P.idx], set = isSet(sp);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, g);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.L, g.T, g.R - g.L, g.B - g.T); ctx.clip();
    // the two sides of the line, faintly tinted with their colours
    if (set) {
      for (let b = 0; b < 2; b++) {
        const p = clipBranch(P.poly, sp, b);
        if (p.length) { ctx.fillStyle = rgba(colourOf(sp.c[b]), 0.2); ctx.beginPath(); tracePoly(ctx, g, p); ctx.fill(); }
      }
    }
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
    // the nodes above: their lines stay visible
    for (const a of P.ancestors) {
      const r = nodeRegion(this.comp, this.specs, a.idx);
      const seg = r && lineInPoly(this.specs[a.idx], r.poly);
      if (seg) drawCut(ctx, g, seg, null, { width: 2.2 });
    }
    // hint: a band roughly where the true line lies
    if ((this.lab.hinted[this.level.id] || []).includes(P.idx)) {
      const seg = lineInPoly(this.comp.truth[P.idx], UNIT_SQUARE);
      if (seg) {
        ctx.strokeStyle = 'rgba(244,201,93,0.55)'; ctx.lineCap = 'butt';
        ctx.lineWidth = CONFIG.LAB.HINT_BAND * (g.R - g.L);
        ctx.beginPath(); ctx.moveTo(g.px(seg[0][0]), g.py(seg[0][1])); ctx.lineTo(g.px(seg[1][0]), g.py(seg[1][1])); ctx.stroke();
      }
    }
    // the points that reach this node; the two picked colours vivid, the others muted
    const picked = set ? sp.c : P.order;
    const vivid = (p) => picked.length === 0 || picked.includes(p.cls);
    drawPoints(ctx, g, P.pts.filter((p) => !vivid(p)), { r: 4, style: (p) => ({ fill: muted(colourOf(p.cls)), outline: '#fff' }) });
    drawPoints(ctx, g, P.pts.filter(vivid), { r: 5.2 });
    // the player's line: solid where it matters (inside the region), dashed outside
    if (set) {
      const full = lineInPoly(sp, UNIT_SQUARE);
      if (full) drawCut(ctx, g, full, null, { colour: 'rgba(58,37,25,0.45)', width: 1.6, dash: [5, 5] });
      const seg = lineInPoly(sp, P.poly);
      if (seg) drawCut(ctx, g, seg, null, { colour: C.ink, width: 3.5 });
      // where each side goes: a leaf (its colour) or the next node
      const node = this.comp.nodes[P.idx];
      for (let b = 0; b < 2; b++) {
        const p = clipBranch(P.poly, sp, b);
        if (!p.length || polyArea(p) < 0.012) continue;
        const m = polyCentroid(p);
        const k = node.kids[b];
        const X = Math.max(g.L + 50, Math.min(g.R - 50, g.px(m.x))), Y = Math.max(g.T + 14, Math.min(g.B - 14, g.py(m.y)));
        pill(ctx, X, Y, sp.c[b], k.node != null ? `al nodo ${k.node + 1}` : 'foglia');
      }
    }
    ctx.restore();
    for (const a of P.ancestors) {
      const r = nodeRegion(this.comp, this.specs, a.idx);
      const seg = r && lineInPoly(this.specs[a.idx], r.poly);
      if (seg) drawNumber(ctx, g.px((seg[0][0] + seg[1][0]) / 2), g.py((seg[0][1] + seg[1][1]) / 2), a.idx + 1);
    }
    if (set) {
      const act = P.drag && P.drag.end;
      drawHandle(ctx, g.px(sp.x1), g.py(sp.y1), act === 1 || P.drag?.line);
      drawHandle(ctx, g.px(sp.x2), g.py(sp.y2), act === 2 || P.drag?.line);
    }
    drawAxes(ctx, g, this.level);
  }

  // Drag: grab a handle to move that end (the line pivots on the other one), or grab the line
  // itself to slide it. Pointer events with capture; the canvas has touch-action: none.
  onPopDown(e) {
    const P = this.pop;
    const sp = P && this.specs[P.idx];
    if (!isSet(sp)) return;
    const g = this.popGeom();
    const r = this.el.popCanvas.getBoundingClientRect();
    const X = e.clientX - r.left, Y = e.clientY - r.top;
    const d1 = Math.hypot(g.px(sp.x1) - X, g.py(sp.y1) - Y), d2 = Math.hypot(g.px(sp.x2) - X, g.py(sp.y2) - Y);
    let drag = null;
    if (Math.min(d1, d2) <= HANDLE_HIT) drag = { end: d1 <= d2 ? 1 : 2 };
    else {
      // distance to the line (in px), measured inside the field only
      const ax = g.px(sp.x1), ay = g.py(sp.y1), bx = g.px(sp.x2), by = g.py(sp.y2);
      const L = Math.hypot(bx - ax, by - ay);
      const dist = Math.abs((bx - ax) * (ay - Y) - (ax - X) * (by - ay)) / L;
      if (dist <= LINE_HIT && X >= g.L && X <= g.R && Y >= g.T && Y <= g.B) drag = { line: true, fx: g.fx(X), fy: g.fy(Y), start: { ...sp } };
    }
    if (!drag) return;
    e.preventDefault();
    this.el.popCanvas.setPointerCapture(e.pointerId);
    P.drag = drag;
    this.drawPop();
  }

  onPopMove(e) {
    const P = this.pop, sp = this.specs[P.idx];
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
      // keep both handles inside the field
      dx = Math.max(-Math.min(s0.x1, s0.x2), Math.min(1 - Math.max(s0.x1, s0.x2), dx));
      dy = Math.max(-Math.min(s0.y1, s0.y2), Math.min(1 - Math.max(s0.y1, s0.y2), dy));
      sp.x1 = s0.x1 + dx; sp.y1 = s0.y1 + dy; sp.x2 = s0.x2 + dx; sp.y2 = s0.y2 + dy;
    }
    this.renderPopLive();
  }

  // While dragging: only the canvas and the count change.
  renderPopLive() {
    if (this.livePending) return;
    this.livePending = true;
    requestAnimationFrame(() => {
      this.livePending = false;
      if (!this.pop) return;
      this.drawPop();
      const sp = this.specs[this.pop.idx];
      const nc = nodeCount(sp, this.pop.pts);
      const per = sp.c.map((c) => `${shapeIcon(c, 13)}${nc.per[c][0]}/${nc.per[c][1]}`).join(' · ');
      const head = this.el.count.firstChild;
      const note = this.el.count.querySelector('.l-hint-note');
      this.el.count.innerHTML = `Dalla parte giusta: <b>${nc.right} su ${nc.total}</b> <span class="l-per">(${per})</span>`;
      if (note && head) this.el.count.appendChild(note);
    });
  }

  // ------------------------------------------------------------ level list
  openLevels() {
    this.app.openSheet('Livelli', (body) => {
      let html = '<p class="sheet-note">I livelli si aprono uno dopo l\'altro: con 7 monete o più in una Prova passi al livello seguente.</p><div class="s-levels-grid">';
      LAB_LEVELS.forEach((lv, i) => {
        const st = labLevelStatus(this.lab, LAB_LEVELS, i);
        const nodes = LAB_COMPILED[i].nodes.length;
        const badge = st.passed ? svg40(ICON.yes, 20) : !st.open ? svg40(ICON.lock, 20) : '';
        html += `<button class="btn s-lv${i === this.li ? ' on' : ''}${st.open ? '' : ' closed'}" data-lv="${i}">` +
          `<span class="s-lv-no">${i + 1}</span><span class="s-lv-t">${esc(lv.title)}</span>` +
          `<span class="s-lv-g">${nodes} ${nodes === 1 ? 'nodo' : 'nodi'} · ${lv.classes.length} colori</span><span class="s-lv-b">${badge}</span></button>`;
      });
      body.innerHTML = html + '</div>';
      body.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.lv);
        if (!labLevelStatus(this.lab, LAB_LEVELS, i).open) { this.app.toast(`Prima supera il livello ${i}.`); return; }
        this.app.closeSheet();
        this.load(i);
      }));
    });
  }
}

// ------------------------------------------------------------ helpers
// A node number on the field, drawn on top of the points.
function drawNumber(ctx, X, Y, n) {
  ctx.fillStyle = C.soil; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X, Y, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `800 11.5px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), X, Y + 0.5);
  ctx.textBaseline = 'alphabetic';
}

const hintMini = () => `<svg width="18" height="18" viewBox="0 0 40 40">${ICON.hint}</svg>`;
