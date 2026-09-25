// Minigame 2: Lo smistamento (the sorting station). A decision tree sorts a batch into trucks.
// Owns the #screen-sort screen: the hopper with the batch, the tree (gates, branches, pipes),
// the trucks, the question palette, the Prova / Consegna runs and the level list.
// Everything is one inline SVG, rebuilt on each level/run; only moving items change per frame.
import { CONFIG } from '../config.js';
import { LEVELS, TRUCKS } from './levels.js';
import { QUESTIONS, Q, SENSOR_BY_ID, questionUnlocked } from './questions.js';
import { COMPILED, levelStatus, startLevel, hintCost } from './progress.js';
import { layoutTree, runBatch, trainingBatch, testBatch, solutionOf, treeDepth } from './tree.js';
import { P, questionArt, truckArt, truckSymbolArt, ICON, svg40, itemArt, itemSymbolId, ensureItemSymbols } from './art.js';

const GS = 23;           // half size of a gate square
const ROW_H = 76;        // vertical distance between tree rows
const MANIFOLD = 70;     // height of the zone where pipes bend (and cross) towards the trucks
const CELL_W = 42;       // hopper grid cell
const PILE = 15;         // item size in a truck pile

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const coinSvg = (size = 16) => svg40(ICON.coin, size, 'coin-ic');
export const yesSvg = (size = 16) => svg40(ICON.yes, size, 'yn-ic');
export const noSvg = (size = 16) => svg40(ICON.no, size, 'yn-ic');

export function helpHTML() {
  return '<h2>Lo smistamento</h2>' +
    '<p>Il raccolto arriva tutto mescolato. Una macchina lo divide nei camion: è una <b>classificazione</b> <em>(classification)</em>, ogni pezzo va nella sua classe.</p>' +
    `<p>La macchina è un <b>albero di decisione</b> <em>(decision tree)</em>: ogni cancello fa una domanda con risposta sì o no. ${yesSvg()} sì: il pezzo va a destra. ${noSvg()} no: va a sinistra. In fondo un tubo lo porta a un camion.</p>` +
    '<ol>' +
    '<li>In alto c\'è il <b>lotto di addestramento</b> <em>(training)</em>. Sotto ogni pezzo c\'è la sua <b>etichetta</b> <em>(label)</em>: il camion giusto. Tocca un pezzo per vedere le sue caratteristiche <em>(features)</em>.</li>' +
    '<li>Tocca un cancello <b>?</b> e scegli una domanda.</li>' +
    '<li><b>Prova l\'albero</b> quante volte vuoi: vedi l\'<b>accuratezza</b> <em>(accuracy)</em>, cioè quanti pezzi finiscono nel camion giusto. Tocca un pezzo cerchiato di rosso per vedere la sua strada.</li>' +
    '<li>Quando è tutto giusto, <b>Consegna</b>: arriva un lotto nuovo, mai visto, il <b>test</b>. Se l\'albero funziona anche lì, guadagni monete.</li>' +
    '</ol>' +
    '<p>Nel negozio ci sono i sensori: ognuno aggiunge una domanda nuova.</p>';
}

export class SortingGame {
  // app: { getState(), save(), onDeliver({ levelIdx, coins, first }), openSheet(title, render, onClose),
  //        closeSheet(), toast(msg), openShop(), overlayOpen() }
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      scroll: $('s-scroll'), svg: $('s-svg'), caption: $('s-caption'),
      result: $('s-result'), tryBtn: $('s-try'), deliver: $('s-deliver'),
      levels: $('s-levels'), levelNo: $('s-level-no'), title: $('s-title'), story: $('s-story'),
      card: $('s-card'),
    };
    this.li = -1;
    this.phase = 'edit';   // edit | run | result | delivered
    this.active = false;
    this.follow = false;
    this.raf = 0;
    this.loop = (t) => this.frame(t);

    this.el.svg.addEventListener('click', (e) => this.onSvgClick(e));
    this.el.tryBtn.addEventListener('click', () => this.onTry());
    this.el.deliver.addEventListener('click', () => this.onDeliverBtn());
    this.el.levels.addEventListener('click', () => this.openLevels());
    const stopFollow = () => { this.follow = false; };
    for (const ev of ['pointerdown', 'wheel', 'touchstart']) this.el.scroll.addEventListener(ev, stopFollow, { passive: true });
    this.el.card.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.closeCard(); });
    window.addEventListener('resize', () => { if (this.active && this.phase !== 'run') this.render(); });
  }

  get sort() { return this.app.getState().sort; }
  get level() { return LEVELS[this.li]; }

  // ------------------------------------------------------------ lifecycle
  show() {
    this.active = true;
    const want = startLevel(this.sort);
    if (this.li < 0 || !levelStatus(this.sort, this.li).open) this.load(want);
    else if (this.phase !== 'run') this.render();
    this.updateUI();
  }

  hide() {
    this.active = false;
    if (this.phase === 'run') this.finishRunNow();
    cancelAnimationFrame(this.raf);
    this.closeCard();
  }

  reset() { this.li = -1; this.phase = 'edit'; }

  // Something outside changed (shop purchase): refresh without losing the level.
  refresh() {
    if (!this.active || this.li < 0) return;
    if (this.phase !== 'run') this.render();
    this.updateUI();
  }

  load(li) {
    cancelAnimationFrame(this.raf);
    this.li = li;
    this.c = COMPILED[li];
    const lv = this.level;
    const s = this.sort;
    s.current = lv.id;
    const saved = s.boards[lv.id];
    this.board = saved && saved.length === this.c.gates.length ? saved.slice() : new Array(this.c.gates.length).fill(null);
    this.training = trainingBatch(lv, li + 1);
    this.batch = this.training;
    this.mode = 'train';
    this.run = null;
    this.perfectKey = null;
    this.phase = 'edit';
    this.overlay = null;
    this.closeCard();
    this.app.save();
    this.el.levelNo.textContent = `${li + 1}/${LEVELS.length}`;
    this.el.title.textContent = lv.title;
    this.el.story.textContent = lv.story;
    this.render();
    this.updateUI();
    this.el.scroll.scrollTop = 0;
  }

  boardKey() { return this.board.join('|'); }

  setGate(g, qid, hinted = false) {
    this.board[g] = qid;
    const s = this.sort;
    s.boards[this.level.id] = this.board.slice();
    const h = new Set(s.hinted[this.level.id] || []);
    if (hinted) h.add(g); else h.delete(g);
    s.hinted[this.level.id] = [...h];
    this.app.save();
    if (this.mode === 'test' || this.phase !== 'edit') this.backToTraining();
    else { this.run = null; this.render(); }
    this.updateUI();
  }

  backToTraining() {
    this.mode = 'train';
    this.batch = this.training;
    this.run = null;
    this.phase = 'edit';
    this.overlay = null;
    this.render();
  }

  // ------------------------------------------------------------ bottom bar
  updateUI() {
    if (this.li < 0) return;
    const st = levelStatus(this.sort, this.li);
    const full = this.board.every((q) => q);
    const running = this.phase === 'run';
    const perfectNow = this.perfectKey === this.boardKey();
    const T = this.el.tryBtn, D = this.el.deliver, R = this.el.result;
    this.el.caption.innerHTML = this.mode === 'test'
      ? `<b>Lotto di test</b>: ${this.batch.length} pezzi nuovi, mai visti. Niente etichette: le conosce solo l'agricoltore.`
      : `<b>Lotto di addestramento</b> <em>(training)</em>: ${this.batch.length} pezzi. Sotto ognuno, la sua etichetta <em>(label)</em>: il camion giusto.`;
    T.textContent = 'Prova l\'albero';
    D.textContent = 'Consegna';
    T.disabled = running || !full || !st.playable;
    D.disabled = running || !perfectNow || !st.playable;
    D.classList.toggle('ready', !D.disabled);

    if (!st.playable) {
      const names = st.missing.map((id) => `${svg40(questionArt(SENSOR_BY_ID[id].q), 20)} <b>${SENSOR_BY_ID[id].name}</b>`).join(', ');
      R.innerHTML = st.open
        ? `<div class="s-msg">Per questo livello serve: ${names}. Lo trovi nel negozio.</div><button class="btn" id="s-go-shop">Vai al negozio</button>`
        : `<div class="s-msg">${svg40(ICON.lock, 18)} Prima risolvi il livello ${this.li}.</div>`;
      const b = R.querySelector('#s-go-shop');
      if (b) b.addEventListener('click', () => this.app.openShop());
      return;
    }
    if (running) { R.innerHTML = `<div class="s-msg">${this.mode === 'test' ? 'Test in corso…' : 'L\'albero smista…'}</div>`; return; }
    if (this.phase === 'delivered' && this.run) {
      const r = this.run;
      const next = this.li + 1 < LEVELS.length ? levelStatus(this.sort, this.li + 1) : null;
      R.innerHTML = accLine(r, 'Test') +
        `<div class="s-msg">${r.right === r.total ? 'L\'albero funziona anche su pezzi mai visti.' : 'Qualcosa è andato storto sui pezzi nuovi.'} ` +
        `<b class="s-pay">+${this.lastPay} ${coinSvg(16)}</b></div>`;
      if (next && next.open) { D.textContent = 'Prossimo livello'; D.disabled = false; D.classList.add('ready'); }
      else if (!next) { D.textContent = 'Tutti i livelli'; D.disabled = false; }
      else D.disabled = true;
      return;
    }
    if (this.phase === 'result' && this.run) {
      const r = this.run;
      const wrong = r.total - r.right;
      R.innerHTML = accLine(r, 'Addestramento') + `<div class="s-msg">${wrong === 0
        ? 'Tutto giusto! Ora <b>Consegna</b>: arriva un lotto nuovo, il test.'
        : `${wrong} ${wrong === 1 ? 'pezzo è finito' : 'pezzi sono finiti'} nel camion sbagliato: toccali (cerchio rosso) per vedere la strada.`}</div>`;
      return;
    }
    const empty = this.board.filter((q) => !q).length;
    R.innerHTML = `<div class="s-msg">${empty
      ? `Tocca i cancelli <b>?</b> e scegli una domanda (${empty} ${empty === 1 ? 'cancello vuoto' : 'cancelli vuoti'}).`
      : 'Pronto: prova l\'albero sul lotto di addestramento.'}</div>`;
  }

  onTry() {
    if (this.phase === 'run') return;
    this.closeCard();
    this.startRun('train');
  }

  onDeliverBtn() {
    if (this.phase === 'delivered') {
      if (this.li + 1 < LEVELS.length) this.load(this.li + 1); else this.openLevels();
      return;
    }
    if (this.perfectKey !== this.boardKey()) return;
    this.closeCard();
    this.startRun('test');
  }

  // ------------------------------------------------------------ SVG
  render() {
    if (this.li < 0) return;
    const W = Math.max(280, Math.floor(this.el.scroll.clientWidth || 360));
    const lv = this.level, c = this.c, items = this.batch;
    const tags = this.mode === 'train';
    const g = {};
    g.W = W;
    const cellH = tags ? 58 : 42;
    const perRow = Math.max(4, Math.floor((W - 16) / CELL_W));
    const rows = Math.ceil(items.length / perRow);
    const gridW = Math.min(items.length, perRow) * CELL_W;
    const gx0 = (W - gridW) / 2;
    g.hopTop = 6;
    g.hopH = rows * cellH + 8;
    g.hop = items.map((_, i) => ({ x: gx0 + (i % perRow) * CELL_W + CELL_W / 2, y: g.hopTop + 6 + Math.floor(i / perRow) * cellH + 17 }));
    g.funnelTop = g.hopTop + g.hopH;
    g.funnelBot = g.funnelTop + 24;
    g.treeTop = g.funnelBot + 36;
    layoutTree(c, W, { top: g.treeTop, rowH: ROW_H, pad: 6 });
    g.pipesTop = g.treeTop + treeDepth(c.root) * ROW_H + 12;
    g.pipeEnd = g.pipesTop + MANIFOLD;
    // trucks
    const T = lv.trucks.length;
    const slotW = (W - 12) / T;
    const truckAt = Object.fromEntries(lv.trucks.map((id, k) => [id, 6 + (k + 0.5) * slotW]));
    const ta = truckArt('rosse', slotW);
    const perPile = Math.max(2, Math.floor((ta.bedW - 4) / PILE));
    const counts = {};
    if (this.run) for (const r of this.run.results) counts[r.truck] = (counts[r.truck] || 0) + 1;
    else for (const it of items) counts[it.label] = (counts[it.label] || 0) + 1;
    const pileRows = Math.max(1, ...Object.values(counts).map((n) => Math.ceil(n / perPile)));
    g.pileH = pileRows * (PILE - 1) + 10;
    g.bedTop = g.pipeEnd + g.pileH;
    g.H = g.bedTop + 48;
    g.truckAt = truckAt; g.slotW = slotW; g.perPile = perPile; g.bedX = ta.bedX; g.bedW = ta.bedW;
    // pipe end points: leaves sharing a truck get side-by-side inlets
    const byTruck = {};
    for (const leaf of c.leaves) (byTruck[leaf.truck] ||= []).push(leaf);
    for (const [tid, ls] of Object.entries(byTruck)) {
      ls.forEach((leaf, k) => { leaf.tx = truckAt[tid] + (k - (ls.length - 1) / 2) * 9; });
    }
    this.geo = g;

    const st = this.app.getState();
    const hinted = new Set(this.sort.hinted[lv.id] || []);
    const lente = this.sort.lente;
    const blamed = this.run && this.phase !== 'run' && this.mode === 'train' ? this.run.blamed : new Set();
    const wrongPerGate = {};
    if (blamed.size) for (const r of this.run.results) if (!r.ok && r.blame >= 0) wrongPerGate[r.blame] = (wrongPerGate[r.blame] || 0) + 1;

    let s = `<defs id="s-defs">`;
    for (const q of QUESTIONS) s += `<symbol id="q-${q.id}" viewBox="0 0 40 40">${questionArt(q.id)}</symbol>`;
    for (const id of new Set(lv.trucks)) s += `<symbol id="tr-${TRUCKS[id].sym}" viewBox="0 0 40 40">${truckSymbolArt(TRUCKS[id].sym)}</symbol>`;
    s += `<symbol id="ic-yes" viewBox="0 0 40 40">${ICON.yes}</symbol><symbol id="ic-no" viewBox="0 0 40 40">${ICON.no}</symbol><symbol id="ic-hint" viewBox="0 0 40 40">${ICON.hint}</symbol>`;
    s += '</defs>';
    // hopper and funnel
    const rx = c.root.x;
    s += `<rect x="6" y="${g.hopTop}" width="${W - 12}" height="${g.hopH}" rx="12" fill="#F4ECD8" stroke="${P.wheat}" stroke-width="2"/>`;
    s += `<path d="M16 ${g.funnelTop}H${W - 16}L${rx + 13} ${g.funnelBot}H${rx - 13}Z" fill="${P.wheat}" stroke="${P.soil}" stroke-opacity=".35" stroke-width="1.5"/>`;
    s += `<rect x="${rx - 8}" y="${g.funnelBot}" width="16" height="${g.treeTop - GS - g.funnelBot}" fill="#D6C595" stroke="${P.soil}" stroke-opacity=".35"/>`;
    // pipes (under the tree edges)
    s += '<g class="s-pipes">';
    for (const leaf of c.leaves) {
      const d = pipePath(leaf, g);
      s += `<path d="${d}" fill="none" stroke="${P.soil}" stroke-width="11" stroke-linecap="round" opacity=".8"/><path d="${d}" fill="none" stroke="#A9C2C8" stroke-width="7" stroke-linecap="round"/>`;
    }
    s += '</g>';
    // branches with the no/yes markers
    s += '<g class="s-edges">';
    for (const gate of c.gates) {
      for (const side of ['no', 'yes']) {
        const ch = gate[side];
        const x0 = gate.x + (side === 'yes' ? 13 : -13), y0 = gate.y + GS;
        const x1 = ch.x, y1 = ch.kind === 'gate' ? ch.y - GS : ch.y - 8;
        s += `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${P.soil}" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
        const mx = x0 + (x1 - x0) * 0.42, my = y0 + (y1 - y0) * 0.42;
        s += `<circle cx="${mx}" cy="${my}" r="9" fill="${P.cream}" stroke="${side === 'yes' ? P.olive : P.soil}" stroke-width="1.5"/>` +
          `<use href="#ic-${side}" x="${mx - 6.5}" y="${my - 6.5}" width="13" height="13"/>`;
      }
    }
    s += '</g>';
    // leaves (pipe mouths)
    for (const leaf of c.leaves) {
      s += `<path d="M${leaf.x - 12} ${leaf.y - 9}H${leaf.x + 12}L${leaf.x + 6} ${leaf.y + 2}H${leaf.x - 6}Z" fill="#A9C2C8" stroke="${P.soil}" stroke-width="1.8" stroke-linejoin="round"/>`;
    }
    // gates
    for (const gate of c.gates) {
      const q = this.board[gate.idx];
      const cls = ['s-gate', q ? 'filled' : 'empty'];
      const wrongN = wrongPerGate[gate.idx] || 0;
      if (wrongN) cls.push(lente ? 'blamed-lente' : 'blamed');
      s += `<g class="${cls.join(' ')}" data-g="${gate.idx}" transform="translate(${gate.x} ${gate.y})" role="button" aria-label="Cancello ${gate.idx + 1}${q ? ': ' + esc(Q[q].text) : ', vuoto'}">` +
        `<rect x="-29" y="-29" width="58" height="58" fill="transparent"/>` +
        `<rect class="box" x="${-GS}" y="${-GS}" width="${2 * GS}" height="${2 * GS}" rx="8"/>` +
        (q ? `<use href="#q-${q}" x="-18" y="-18" width="36" height="36"/>` : '<text class="qmark" y="9" text-anchor="middle">?</text>') +
        (hinted.has(gate.idx) && q ? '<use href="#ic-hint" x="12" y="-33" width="18" height="18"/>' : '') +
        (wrongN && !lente ? `<circle cx="${-GS + 3}" cy="${-GS + 3}" r="5" fill="${P.tomato}"/>` : '') +
        (wrongN && lente ? `<g transform="translate(${-GS - 2} ${-GS - 4})"><circle r="10" fill="${P.tomato}"/><text class="badge" y="4.5" text-anchor="middle">${wrongN}</text></g>` : '') +
        `<g class="f-yes"><circle cx="${GS + 5}" cy="${-GS + 2}" r="11" fill="${P.cream}" stroke="${P.olive}" stroke-width="2"/><use href="#ic-yes" x="${GS - 3}" y="${-GS - 6}" width="16" height="16"/></g>` +
        `<g class="f-no"><circle cx="${-GS - 5}" cy="${-GS + 2}" r="11" fill="${P.cream}" stroke="${P.soil}" stroke-width="2"/><use href="#ic-no" x="${-GS - 13}" y="${-GS - 6}" width="16" height="16"/></g>` +
        '</g>';
    }
    // trucks
    for (const id of lv.trucks) {
      const x = truckAt[id];
      const t = truckArt(TRUCKS[id].sym, slotW);
      s += `<g class="s-truck" data-truck="${id}" transform="translate(${x} ${g.bedTop})" aria-label="${esc(TRUCKS[id].name)}">${t.svg}</g>`;
    }
    s += '<g id="s-overlay"></g><g id="s-piles"></g><g id="s-hopper"></g><g id="s-movers"></g>';
    this.el.svg.setAttribute('viewBox', `0 0 ${W} ${g.H}`);
    this.el.svg.setAttribute('width', W);
    this.el.svg.setAttribute('height', g.H);
    this.el.svg.innerHTML = s;
    const defs = this.el.svg.querySelector('#s-defs');
    ensureItemSymbols(defs, items);

    // hopper items
    let h = '';
    items.forEach((it, i) => {
      const p = g.hop[i];
      const res = this.run && this.run.results[i];
      const gone = this.phase === 'run' && res && this.spawned && this.spawned[i];
      h += `<g class="s-item${gone ? ' gone' : ''}${res && !res.ok && this.phase !== 'run' ? ' wrong' : ''}" data-i="${i}" transform="translate(${p.x} ${p.y})">` +
        `<rect x="${-CELL_W / 2}" y="-19" width="${CELL_W}" height="${cellH - 2}" fill="transparent"/>` +
        `<circle class="ring" r="17" fill="none" stroke="${P.tomato}" stroke-width="3"/>` +
        `<use href="#${itemSymbolId(it)}" x="-16" y="-16" width="32" height="32" transform="rotate(${it.spin})"/>` +
        (tags ? `<rect x="-12" y="18" width="24" height="18" rx="5" fill="#fff" stroke="${P.wheat}" stroke-width="1.5"/><use href="#tr-${TRUCKS[it.label].sym}" x="-8" y="19" width="16" height="16"/>` : '') +
        '</g>';
    });
    this.el.svg.querySelector('#s-hopper').innerHTML = h;
    // truck piles (from the last run)
    if (this.run && this.run.results.every((r) => r.slot !== undefined)) this.renderPiles(this.phase === 'run');
    if (this.overlay != null) this.drawOverlay(this.overlay);
  }

  renderPiles(hidden) {
    const g = this.geo;
    let p = '';
    this.run.results.forEach((r, i) => {
      const pos = this.slotPos(r.truck, r.slot);
      p += `<g class="s-pile${hidden ? ' hidden' : ''}${!r.ok && this.phase !== 'run' ? ' wrong' : ''}" data-p="${i}" transform="translate(${pos.x} ${pos.y})">` +
        '<rect x="-9" y="-9" width="18" height="18" fill="transparent"/>' +
        `<circle class="ring" r="${PILE / 2 + 1}" fill="none" stroke="${P.tomato}" stroke-width="2.5"/>` +
        `<use href="#${itemSymbolId(r.item)}" x="${-PILE / 2}" y="${-PILE / 2}" width="${PILE}" height="${PILE}"/></g>`;
    });
    this.el.svg.querySelector('#s-piles').innerHTML = p;
    void g;
  }

  slotPos(truck, j) {
    const g = this.geo;
    const col = j % g.perPile, row = Math.floor(j / g.perPile);
    return { x: g.truckAt[truck] + g.bedX + 3 + PILE / 2 + col * PILE, y: g.bedTop - PILE / 2 + 3 - row * (PILE - 1) };
  }

  // Waypoints of an item from the hopper to its truck: [{ x, y, pause?, gate?, ans? }]
  waypoints(i, r, withHopper = true) {
    const g = this.geo, c = this.c;
    const pts = [];
    if (withHopper) pts.push({ x: g.hop[i].x, y: g.hop[i].y });
    pts.push({ x: c.root.x, y: g.funnelBot - 4 });
    for (const step of r.path) {
      const gt = step.gate;
      pts.push({ x: gt.x, y: gt.y - GS });
      pts.push({ x: gt.x, y: gt.y, pause: true, gate: gt.idx, ans: step.ans });
      pts.push({ x: gt.x + (step.ans ? 13 : -13), y: gt.y + GS });
    }
    const leaf = r.leaf;
    pts.push({ x: leaf.x, y: leaf.y - 8 });
    for (const q of pipePoints(leaf, g)) pts.push(q);
    return pts;
  }

  // Timeline: keyframes [{ t, x, y }] and gate events [{ t, gate, ans }], times in ms from start.
  timeline(pts, factor) {
    const cfg = CONFIG.SORT;
    const speed = cfg.SPEED * factor / 1000;
    const pause = cfg.GATE_PAUSE_MS / factor;
    const keys = [{ t: 0, x: pts[0].x, y: pts[0].y }];
    const events = [];
    let t = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      t += Math.hypot(b.x - a.x, b.y - a.y) / speed;
      keys.push({ t, x: b.x, y: b.y });
      if (b.pause) {
        events.push({ t, gate: b.gate, ans: b.ans, dur: pause + 60 });
        t += pause;
        keys.push({ t, x: b.x, y: b.y });
      }
    }
    return { keys, events, dur: t };
  }

  // ------------------------------------------------------------ runs
  startRun(mode) {
    const lv = this.level;
    this.mode = mode;
    this.batch = mode === 'train' ? this.training : testBatch(lv);
    this.overlay = null;
    const run = runBatch(this.c, this.board, this.batch);
    this.run = run;
    this.phase = 'run';
    this.spawned = [];
    this.render();   // layout for this batch (pile space)
    const fast = this.sort.fast ? CONFIG.SORT.FAST_FACTOR : 1;
    const spawnGap = CONFIG.SORT.SPAWN_MS / fast;
    // timelines up to the pipe end, then slots in arrival order per truck
    const tls = run.results.map((r, i) => {
      const tl = this.timeline(this.waypoints(i, r), fast);
      return { i, r, tl, start: i * spawnGap };
    });
    const arrivals = {};
    for (const x of [...tls].sort((a, b) => (a.start + a.tl.dur) - (b.start + b.tl.dur))) {
      const n = arrivals[x.r.truck] || 0;
      arrivals[x.r.truck] = n + 1;
      x.r.slot = n;
    }
    for (const x of tls) {
      const last = x.tl.keys[x.tl.keys.length - 1];
      const pos = this.slotPos(x.r.truck, x.r.slot);
      const d = Math.hypot(pos.x - last.x, pos.y - last.y) / (CONFIG.SORT.SPEED * fast / 1000);
      x.tl.keys.push({ t: last.t + d, x: pos.x, y: pos.y });
      x.tl.dur = last.t + d;
    }
    this.renderPiles(true);
    this.movers = tls.map((x) => ({ ...x, el: null, ev: 0, done: false }));
    this.flashes = [];
    this.t0 = performance.now();
    this.follow = this.el.scroll.scrollHeight > this.el.scroll.clientHeight + 20;
    this.updateUI();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  frame(now) {
    if (this.phase !== 'run' && !this.replay) return;
    if (this.replay) { this.replayFrame(now); return; }
    const t = now - this.t0;
    const layer = this.el.svg.querySelector('#s-movers');
    let active = 0, sumY = 0, left = 0;
    for (const m of this.movers) {
      if (m.done) continue;
      left++;
      const lt = t - m.start;
      if (lt < 0) continue;
      if (!m.el) {
        m.el = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        m.el.setAttribute('href', `#${itemSymbolId(m.r.item)}`);
        m.el.setAttribute('width', 24); m.el.setAttribute('height', 24);
        m.el.setAttribute('x', -12); m.el.setAttribute('y', -12);
        layer.appendChild(m.el);
        this.spawned[m.i] = true;
        const hi = this.el.svg.querySelector(`.s-item[data-i="${m.i}"]`);
        if (hi) hi.classList.add('gone');
        m.k = 0;
      }
      while (m.ev < m.tl.events.length && m.tl.events[m.ev].t <= lt) {
        const e = m.tl.events[m.ev++];
        this.flash(e.gate, e.ans, now + e.dur);
      }
      if (lt >= m.tl.dur) {
        m.done = true;
        m.el.remove();
        const pe = this.el.svg.querySelector(`.s-pile[data-p="${m.i}"]`);
        if (pe) pe.classList.remove('hidden');
        continue;
      }
      const pos = posAt(m, lt);
      m.el.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
      active++; sumY += pos.y;
    }
    // gate flashes
    this.flashes = this.flashes.filter((f) => {
      if (f.until > now) return true;
      const ge = this.el.svg.querySelector(`.s-gate[data-g="${f.gate}"]`);
      if (ge && !this.flashes.some((o) => o !== f && o.gate === f.gate && o.until > now)) ge.classList.remove('lit-yes', 'lit-no');
      return false;
    });
    if (this.follow && active) {
      const sc = this.el.scroll;
      const target = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, sumY / active - sc.clientHeight * 0.45));
      sc.scrollTop += (target - sc.scrollTop) * 0.08;
    }
    if (left === 0) { this.endRun(); return; }
    this.raf = requestAnimationFrame(this.loop);
  }

  flash(gate, ans, until) {
    const ge = this.el.svg.querySelector(`.s-gate[data-g="${gate}"]`);
    if (!ge) return;
    ge.classList.remove('lit-yes', 'lit-no');
    ge.classList.add(ans ? 'lit-yes' : 'lit-no');
    this.flashes.push({ gate, until });
  }

  finishRunNow() {
    if (this.phase !== 'run') return;
    for (const m of this.movers) m.done = true;
    this.endRun(true);
  }

  endRun(silent) {
    const run = this.run;
    this.movers = [];
    this.follow = false;
    if (this.mode === 'train') {
      this.phase = 'result';
      this.perfectKey = run.right === run.total ? this.boardKey() : null;
    } else {
      this.phase = 'delivered';
      this.lastPay = 0;
      const lv = this.level;
      const first = !this.sort.solved.includes(lv.id);
      const acc = run.accuracy;
      const coins = first ? Math.round(CONFIG.SORT.pay(this.li + 1) * acc) : (acc === 1 ? CONFIG.SORT.REPLAY_PAY : 0);
      this.lastPay = coins;
      if (acc === 1 || coins > 0) this.app.onDeliver({ levelIdx: this.li, coins, first: first && acc === 1 });
    }
    this.render();
    this.updateUI();
    if (!silent) {
      const sc = this.el.scroll;
      sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
    }
  }

  // ------------------------------------------------------------ taps
  onSvgClick(e) {
    if (this.app.overlayOpen()) return;
    const gateEl = e.target.closest('[data-g]');
    if (gateEl) {
      if (this.phase === 'run') return;
      if (!levelStatus(this.sort, this.li).playable) { this.app.toast('Per questo livello serve un sensore del negozio.'); return; }
      this.openPalette(Number(gateEl.dataset.g));
      return;
    }
    const itemEl = e.target.closest('[data-i]') || e.target.closest('[data-p]');
    if (itemEl) {
      const i = Number(itemEl.dataset.i ?? itemEl.dataset.p);
      if (this.phase === 'run') return;
      this.showItem(i);
    }
  }

  showItem(i) {
    const it = this.batch[i];
    const res = this.run && this.phase !== 'run' ? this.run.results[i] : null;
    const sensors = this.sort.sensors;
    const test = this.mode === 'test';
    let feats = '';
    for (const q of QUESTIONS) {
      const known = questionUnlocked(q.id, sensors);
      const ans = q.f(it);
      if (known && q.group === 'colore' && !ans) continue;   // only the item's own colour
      if (known && q.group === 'tipo' && !ans && it.t !== 'lumaca' && it.t !== 'coccinella') continue;
      feats += `<span class="s-feat${known ? '' : ' unknown'}" title="${esc(q.text)}" aria-label="${esc(q.text)} ${known ? (ans ? 'sì' : 'no') : 'non misurato'}">` +
        svg40(questionArt(q.id), 30) + (known ? (ans ? yesSvg(15) : noSvg(15)) : svg40(ICON.lock, 15)) + '</span>';
    }
    const label = res || !test
      ? `<div class="s-label"><span>Etichetta <em>(label)</em>:</span> ${svg40(truckSymbolArt(TRUCKS[it.label].sym), 30, 'lbl')}` +
        (res && !res.ok ? ` <span class="s-wrong">finito qui: ${svg40(truckSymbolArt(TRUCKS[res.truck].sym), 30, 'lbl')}</span>` : '') + '</div>'
      : '';
    this.el.card.innerHTML =
      '<button class="btn icon s-card-x" data-close aria-label="Chiudi">' + svg40(ICON.no, 22) + '</button>' +
      `<div class="s-card-top">${svg40(itemArt(it), 56)}<div><div class="s-card-title">Caratteristiche <em>(features)</em></div><div class="s-feats">${feats}</div></div></div>` + label +
      (res && !res.ok ? `<div class="s-msg">${this.sort.lente ? 'La lente ripercorre la sua strada, piano piano.' : 'In rosso la sua strada nell\'albero.'}</div>` : '');
    this.el.card.style.bottom = `${this.root.querySelector('.s-bottom').offsetHeight + 6}px`;
    this.el.card.hidden = false;
    if (res && !res.ok) {
      this.overlay = i;
      this.drawOverlay(i);
      if (this.sort.lente) this.startReplay(i);
    } else {
      this.overlay = null;
      this.drawOverlay(null);
    }
  }

  closeCard() {
    if (this.el.card) this.el.card.hidden = true;
    if (this.overlay != null) { this.overlay = null; this.drawOverlay(null); }
    this.stopReplay();
  }

  drawOverlay(i) {
    const layer = this.el.svg.querySelector('#s-overlay');
    if (!layer) return;
    if (i == null || !this.run) { layer.innerHTML = ''; return; }
    const r = this.run.results[i];
    const pts = this.waypoints(i, r, false);
    const d = 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L');
    const g = this.geo;
    const tx = g.truckAt[r.item.label];
    layer.innerHTML =
      `<path d="${d}" fill="none" stroke="${P.tomato}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 8" opacity=".9"/>` +
      `<rect x="${tx - g.slotW / 2 + 3}" y="${g.pipeEnd - 4}" width="${g.slotW - 6}" height="${g.bedTop - g.pipeEnd + 46}" rx="10" fill="none" stroke="${P.olive}" stroke-width="3" stroke-dasharray="6 4"/>`;
  }

  startReplay(i) {
    this.stopReplay();
    const r = this.run.results[i];
    const tl = this.timeline(this.waypoints(i, r), CONFIG.SORT.REPLAY_FACTOR);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    el.setAttribute('href', `#${itemSymbolId(r.item)}`);
    el.setAttribute('width', 28); el.setAttribute('height', 28); el.setAttribute('x', -14); el.setAttribute('y', -14);
    this.el.svg.querySelector('#s-movers').appendChild(el);
    this.flashes = [];
    this.replay = { el, tl, ev: 0, t0: performance.now() + 250, k: 0 };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  stopReplay() {
    if (!this.replay) return;
    this.replay.el.remove();
    this.replay = null;
    for (const ge of this.el.svg.querySelectorAll('.s-gate')) ge.classList.remove('lit-yes', 'lit-no');
  }

  replayFrame(now) {
    const R = this.replay;
    const lt = Math.max(0, now - R.t0);
    while (R.ev < R.tl.events.length && R.tl.events[R.ev].t <= lt) {
      const e = R.tl.events[R.ev++];
      this.flash(e.gate, e.ans, now + e.dur);
    }
    this.flashes = this.flashes.filter((f) => {
      if (f.until > now) return true;
      const ge = this.el.svg.querySelector(`.s-gate[data-g="${f.gate}"]`);
      if (ge) ge.classList.remove('lit-yes', 'lit-no');
      return false;
    });
    if (lt >= R.tl.dur + 600) { this.stopReplay(); return; }
    const pos = posAt({ tl: R.tl, k: R.k }, Math.min(lt, R.tl.dur), R);
    R.el.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ question palette
  openPalette(gi) {
    const s = this.sort;
    const cur = this.board[gi];
    this.app.openSheet('Che cosa chiede il cancello?', (body) => {
      const st = this.app.getState();
      let html = `<p class="sheet-note">Scegli una domanda. ${yesSvg(15)} sì: il pezzo va a destra. ${noSvg(15)} no: va a sinistra.</p><div class="s-palette">`;
      const locked = [];
      for (const q of QUESTIONS) {
        if (!questionUnlocked(q.id, s.sensors)) { locked.push(q); continue; }
        html += `<button class="btn s-q${cur === q.id ? ' on' : ''}" data-q="${q.id}" aria-label="${esc(q.text)}">${svg40(questionArt(q.id), 40)}</button>`;
      }
      html += '</div>';
      if (locked.length) {
        html += `<p class="sheet-note s-locked">Altre domande, con i sensori del negozio: ${locked.map((q) => svg40(questionArt(q.id), 22, 'dim')).join(' ')}</p>`;
      }
      const hinted = (s.hinted[this.level.id] || []).includes(gi) && cur === this.c.gates[gi].q;
      const cost = hintCost(s, CONFIG);
      const hintLabel = s.hints > 0 ? `Suggerimento <em>(hint)</em> · ne hai ${s.hints}` : `Suggerimento <em>(hint)</em> · ${cost} ${coinSvg(16)}`;
      html += '<div class="s-pal-actions">' +
        `<button class="btn" id="s-clear" ${cur ? '' : 'disabled'}>${svg40(ICON.clear, 22)} Svuota</button>` +
        `<button class="btn" id="s-hint" ${hinted || (s.hints === 0 && st.coins < cost) ? 'disabled' : ''}>${svg40(ICON.hint, 22)} ${hintLabel}</button>` +
        '</div>';
      body.innerHTML = html;
      body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
        this.app.closeSheet();
        this.setGate(gi, b.dataset.q, false);
      }));
      body.querySelector('#s-clear').addEventListener('click', () => { this.app.closeSheet(); this.setGate(gi, null); });
      body.querySelector('#s-hint').addEventListener('click', () => {
        const st2 = this.app.getState();
        const c2 = hintCost(s, CONFIG);
        if (s.hints > 0) s.hints -= 1;
        else if (st2.coins >= c2) { st2.coins -= c2; s.hintsBought += 1; this.app.coinsChanged(); }
        else return;
        this.app.closeSheet();
        this.setGate(gi, this.c.gates[gi].q, true);
        this.app.toast('Suggerimento: questa è la domanda giusta per il cancello.');
      });
    });
  }

  // ------------------------------------------------------------ level list
  openLevels() {
    this.app.openSheet('Livelli', (body) => {
      let html = '<p class="sheet-note">I livelli si aprono uno dopo l\'altro. Alcuni hanno bisogno di un sensore del negozio.</p><div class="s-levels-grid">';
      LEVELS.forEach((lv, i) => {
        const st = levelStatus(this.sort, i);
        const gates = COMPILED[i].gates.length;
        const badge = st.solved ? svg40(ICON.yes, 20) : !st.open ? svg40(ICON.lock, 20)
          : st.missing.length ? st.missing.map((id) => svg40(questionArt(SENSOR_BY_ID[id].q), 18, 'dim')).join('') + svg40(ICON.lock, 16) : '';
        html += `<button class="btn s-lv${i === this.li ? ' on' : ''}${st.open ? '' : ' closed'}" data-lv="${i}">` +
          `<span class="s-lv-no">${i + 1}</span><span class="s-lv-t">${esc(lv.title)}</span>` +
          `<span class="s-lv-g">${gates} ${gates === 1 ? 'cancello' : 'cancelli'}</span><span class="s-lv-b">${badge}</span></button>`;
      });
      body.innerHTML = html + '</div>';
      body.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.lv);
        const st = levelStatus(this.sort, i);
        if (!st.open) { this.app.toast(`Prima risolvi il livello ${i}.`); return; }
        this.app.closeSheet();
        if (this.phase === 'run') this.finishRunNow();
        this.load(i);
      }));
    });
  }
}

// ------------------------------------------------------------ helpers
function accLine(r, what) {
  const pct = Math.round((100 * r.right) / Math.max(1, r.total));
  return `<div class="s-acc"><span><b>${what}</b> · accuratezza <em>(accuracy)</em>: <b>${r.right}/${r.total}</b> giusti</span>` +
    `<span class="s-accbar"><span style="width:${pct}%" class="${pct === 100 ? 'full' : ''}"></span></span></div>`;
}

function pipePath(leaf, g) {
  const x = leaf.x, tx = leaf.tx;
  const y1 = g.pipesTop, y2 = g.pipeEnd;
  return `M${x} ${leaf.y}V${y1}C${x} ${y1 + MANIFOLD * 0.62} ${tx} ${y2 - MANIFOLD * 0.62} ${tx} ${y2}`;
}

function pipePoints(leaf, g) {
  const x = leaf.x, tx = leaf.tx;
  const y1 = g.pipesTop, y2 = g.pipeEnd;
  const pts = [{ x, y: y1 }];
  const c1 = { x, y: y1 + MANIFOLD * 0.62 }, c2 = { x: tx, y: y2 - MANIFOLD * 0.62 };
  for (let k = 1; k <= 12; k++) {
    const t = k / 12, u = 1 - t;
    pts.push({
      x: u * u * u * x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * tx,
      y: u * u * u * y1 + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * y2,
    });
  }
  return pts;
}

// Position on a timeline at local time lt (keeps a moving index in m.k / store.k).
function posAt(m, lt, store = m) {
  const keys = m.tl.keys;
  let k = store.k || 0;
  while (k < keys.length - 2 && keys[k + 1].t <= lt) k++;
  store.k = k;
  const a = keys[k], b = keys[k + 1] || a;
  const f = b.t > a.t ? Math.min(1, Math.max(0, (lt - a.t) / (b.t - a.t))) : 1;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export { accLine };
