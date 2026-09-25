// Minigame 1: La stazione di pesatura (the weighing station).
// Owns the weighing screen: plot canvas, scene canvas (truck, farmer, belt, scanner),
// the two sliders and the result panel.
import { CONFIG } from '../config.js';
import { Slider } from '../slider.js';
import { xLabel, yLabel } from './farmers.js';
import { makeRound, takeUnit, measure, scoreLine, sliderToLine, startSliders, applyLiveLevels, autoFit, lineToSliders } from './round.js';
import { clamp } from '../stats.js';
import { C, FONT } from './draw.js';
import { drawScanner, drawScannerBeam, drawFitter, drawUpgradeFx, upgradePop, scannerMetrics } from './scanner.js';
import { drawVehicle, VEHICLE_NAMES } from './vehicles.js';
import { drawUnloader, UNLOADER_NAMES, HERDER_NAMES } from './unloaders.js';
import { drawPile } from './pile.js';

const UNLOADER_LABEL = (animal, level) => `${(animal ? HERDER_NAMES : UNLOADER_NAMES)[level]}!`;


const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: r.width, H: r.height };
}

export class WeighingGame {
  // app: { getState(), onRoundDone({farmerId, coins, ratio}), beforeNextFarmer() -> Promise }
  constructor(root, app) {
    this.root = root;
    this.app = app;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      plot: $('w-plot'), scene: $('w-scene'),
      face: $('w-face'), who: $('w-who'), text: $('w-text'), sub: $('w-sub'),
      crates: $('w-crates'), count: $('w-count'),
      controls: $('w-controls'), lock: $('w-lock'), fit: $('w-fit'),
      result: $('w-result'), resTitle: $('w-res-title'), resCoins: $('w-res-coins'),
      barMe: $('w-bar-me'), barBest: $('w-bar-best'), resNote: $('w-res-note'), next: $('w-next'),
    };
    const s0 = startSliders();
    this.slope = new Slider($('w-slope'), { value: s0.slope, label: 'pendenza', onInput: () => this.onSlider() });
    this.intercept = new Slider($('w-intercept'), { value: s0.intercept, label: 'intercetta', onInput: () => this.onSlider() });

    this.el.lock.addEventListener('click', () => this.lock());
    if (!this.el.fit) {
      // An older cached index.html (e.g. right after a deploy) may not have the button yet.
      const b = document.createElement('button');
      b.className = 'btn olive big'; b.id = 'w-fit'; b.hidden = true; b.disabled = true;
      b.textContent = '🤖 Trova la retta';
      this.el.lock.parentNode.insertBefore(b, this.el.lock);
      this.el.fit = b;
    }
    this.el.fit.addEventListener('click', () => this.startAutoFit());
    this.el.next.addEventListener('click', () => this.nextFarmer());
    this.el.scene.addEventListener('pointerdown', (e) => this.onSceneTap(e));

    this.round = null;
    this.phase = 'idle';
    this.active = false;
    this.units = [];       // units on the belt: { idx, x, spawnAt, measured, gone }
    this.carry = null;     // { t0 }
    this.scanFlash = 0;
    this.fx = {};          // start times of upgrade moments: { scanner, belt, truck }
    this.shown = null;     // levels the scene last showed
    this.lastFarmerId = null;
    this.raf = 0;
    this.loop = (t) => this.frame(t);
  }

  // ------------------------------------------------------------ lifecycle
  show() {
    this.active = true;
    if (!this.round) this.newRound();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  hide() {
    this.active = false;
    cancelAnimationFrame(this.raf);
  }

  // Called after "Ricomincia".
  reset() {
    this.round = null;
    this.lastFarmerId = null;
    this.phase = 'idle';
  }

  newRound() {
    const st = this.app.getState();
    this.round = makeRound({ visitNo: st.farmersServed, lastFarmerId: this.lastFarmerId, levels: st.levels });
    this.lastFarmerId = this.round.farmer.id;
    this.units = [];
    this.carry = null;
    this.truckLeave = null;   // { t0 } while the empty truck drives away
    this.fitting = null;      // { t0, from, to } while the auto-fitter moves the sliders
    this.truckGone = false;
    this.result = null;
    this.phase = 'arriving';
    this.phaseT0 = performance.now();
    const s0 = startSliders();
    this.slope.set(s0.slope, false);
    this.intercept.set(s0.intercept, false);
    this.slope.setEnabled(true);
    this.intercept.setEnabled(true);
    this.el.result.hidden = true;
    this.el.controls.hidden = false;

    const f = this.round.farmer;
    this.el.face.textContent = f.face;
    this.el.who.textContent = `${f.person}, ${f.role}`;
    this.el.text.textContent = f.question;
    this.el.sub.innerHTML =
      `<span class="chip">caratteristica <em>(feature)</em>: ${xLabel(f)}</span>` +
      `<span class="chip">obiettivo da prevedere <em>(target)</em>: ${yLabel(f)}</span>`;
    this.updateInfo();
    const ax = this.round.axes;
    if ((ax.flipX || ax.flipY) && this.app.onAxesFlipped) this.app.onAxesFlipped(ax);
  }

  // ------------------------------------------------------------ input
  onSlider() {
    // The plot is redrawn every frame from the slider values; nothing else to do.
  }

  get line() {
    return sliderToLine(this.slope.value, this.intercept.value);
  }

  truckTappable(now) {
    return this.phase === 'collect' && this.round.cratesLeft > 0 && !this.carry &&
      now >= (this.cooldownUntil || 0);
  }

  // The empty truck can be sent away with one more tap.
  truckCanLeave() {
    return this.phase === 'collect' && this.round.cratesLeft === 0 && !this.carry &&
      !this.truckLeave && !this.truckGone;
  }

  onSceneTap(e) {
    const r = this.el.scene.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    // Generous hit area: the whole left part of the scene (truck + farmer).
    if (x > 0.46) return;
    const now = performance.now();
    if (this.truckCanLeave()) { this.truckLeave = { t0: now }; return; }
    if (!this.truckTappable(now)) return;
    const boxes = Math.min(this.round.perTrip, this.round.cratesLeft);
    this.round.cratesLeft -= boxes;
    if (this.round.unloadAll) {
      // One continuous animation: the robot shuttles a few times and drops a share each time.
      const trips = Math.max(1, Math.min(CONFIG.UNLOAD_ALL_MAX_TRIPS, Math.ceil(boxes / CONFIG.BELT_BOXES[CONFIG.MAX_LEVEL])));
      const shares = Array.from({ length: trips }, (_, i) => Math.floor(boxes / trips) + (i < boxes % trips ? 1 : 0));
      this.carry = { t0: now, boxes, all: true, trips, shares, period: CONFIG.UNLOAD_ALL_MS / trips, dropped: 0 };
      this.cooldownUntil = now + CONFIG.UNLOAD_ALL_MS;
    } else {
      this.carry = { t0: now, boxes };
      this.cooldownUntil = now + CONFIG.CARRY_MS + CONFIG.RETURN_MS;
    }
    this.updateInfo();
  }

  dropCrate(now, boxes = this.carry.boxes) {
    const n = boxes * this.round.unitsPerBox;
    const W = this.sceneW || 390;
    const spacing = 26 / W;                       // in scene-width units
    const span = this.carry && this.carry.all ? this.carry.period : CONFIG.TRIP_UNLOAD_MS;
    const interval = Math.min(spacing / CONFIG.BELT_SPEED * 1000, span / n);
    let t = Math.max(now, this.nextSpawnAt || 0);
    for (let i = 0; i < n; i++) {
      const idx = takeUnit(this.round);
      if (idx < 0) break;
      this.units.push({ idx, spawnAt: t, x: this.geo().beltStart, measured: false, gone: false });
      t += interval;
    }
    this.nextSpawnAt = t;
  }

  // "🤖 Trova la retta": move both sliders to the least-squares line of the measured points,
  // then lock. Only with the fitter bought and at least 2 measured points.
  startAutoFit() {
    if (!this.app.getState().levels.fitter || this.fitting || this.phase !== 'collect' || !this.canLock()) return;
    const fit = autoFit(this.round);
    if (!fit) return;
    const to = lineToSliders(fit);
    this.fitting = { t0: performance.now(), from: { slope: this.slope.value, intercept: this.intercept.value }, to };
    this.slope.setEnabled(false);
    this.intercept.setEnabled(false);
    this.updateInfo();
  }

  stepAutoFit(now) {
    const f = this.fitting;
    if (!f) return;
    const t = clamp((now - f.t0) / CONFIG.FITTER_ANIM_MS, 0, 1);
    const e = easeInOut(t);
    this.slope.set(f.from.slope + (f.to.slope - f.from.slope) * e, false);
    this.intercept.set(f.from.intercept + (f.to.intercept - f.from.intercept) * e, false);
    if (t >= 1) {
      this.slope.set(f.to.slope, false);
      this.intercept.set(f.to.intercept, false);
      this.fitting = null;
      this.lock();
    }
  }

  lock() {
    if (this.phase !== 'collect' || !this.canLock()) return;
    const line = this.line;
    this.lockedLine = line;
    this.result = scoreLine(this.round, line);
    this.phase = 'reveal';
    this.phaseT0 = performance.now();
    this.slope.setEnabled(false);
    this.intercept.setEnabled(false);
    this.el.lock.disabled = true;
    // Award immediately so nothing is lost if the page closes during the animation.
    this.app.onRoundDone({ farmerId: this.round.farmer.id, coins: this.result.coins, ratio: this.result.ratio });
  }

  canLock() {
    return this.round.sample.length >= 2 && this.units.every((u) => u.measured) && !this.carry;
  }

  showResult() {
    const res = this.result;
    const f = this.round.farmer;
    this.phase = 'result';
    this.el.controls.hidden = true;
    this.el.result.hidden = false;
    const titles = ['Proprio no…', 'Mah…', 'Così così', 'Meglio', 'Discreta', 'Bene!', 'Molto bene!',
      'Ottimo!', 'Quasi perfetta!', 'Bravissimo!', 'Perfetta!'];
    this.el.resTitle.textContent = `${CONFIG.REACTIONS[res.coins]} ${titles[res.coins]}`;
    this.el.face.textContent = CONFIG.REACTIONS[res.coins];
    const says = [
      'Questa retta non mi aiuta proprio.',
      'Mmh, sul mio raccolto sbaglia parecchio.',
      'Qualcosa indovina, ma sbaglia ancora tanto.',
      'Va un po\' meglio, ma si può fare di più.',
      'Discreta, però sul raccolto intero sbaglia.',
      'Buona! Sul raccolto intero funziona bene.',
      'Molto buona, ci siamo quasi.',
      'Ottima retta, vicina alla migliore!',
      'Quasi uguale alla retta migliore!',
      'Bravissimo, praticamente perfetta!',
      'Perfetta! Proprio quello che mi serviva.',
    ];
    this.el.text.textContent = says[res.coins];

    const maxErr = Math.max(res.playerError, res.bestError);
    this.el.barMe.style.width = `${(res.playerError / maxErr) * 100}%`;
    this.el.barBest.style.width = `${(res.bestError / maxErr) * 100}%`;

    // One short note (the most useful one), so the panel fits on small phones.
    const glitches = this.round.sample.filter((d) => d.glitch).length;
    const left = this.round.cratesLeft;
    let note;
    if (glitches > 0) {
      note = glitches === 1
        ? '⚠️ Lo scanner ha sbagliato una misura: è un valore anomalo <em>(outlier)</em>, cerchiato in rosso.'
        : `⚠️ Lo scanner ha sbagliato ${glitches} misure: sono valori anomali <em>(outlier)</em>, cerchiati in rosso.`;
    } else if (left > 0) {
      if (f.animal) {
        note = `Nel camion sono rimasti ${left * this.round.unitsPerBox} animali: più dati <em>(data)</em>, retta più sicura.`;
      } else {
        note = `Nel camion ${left === 1 ? 'è rimasta 1 cassetta' : `sono rimaste ${left} cassette`}: più dati <em>(data)</em>, retta più sicura.`;
      }
    } else {
      note = 'I puntini chiari sono il raccolto intero: la paga dipende da quelli, non solo dai tuoi dati.';
    }
    this.el.resNote.innerHTML = note;

    // Count the coins up.
    const target = res.coins;
    this.el.resCoins.textContent = '+0 🪙';
    let k = 0;
    const step = Math.min(CONFIG.COIN_COUNT_MS, CONFIG.COIN_COUNT_TOTAL_MS / Math.max(1, target));
    const tick = () => {
      if (k >= target) return;
      k++;
      this.el.resCoins.textContent = `+${k} 🪙`;
      this.el.resCoins.classList.remove('pop');
      void this.el.resCoins.offsetWidth;
      this.el.resCoins.classList.add('pop');
      setTimeout(tick, step);
    };
    setTimeout(tick, step);
    this.el.next.focus({ preventScroll: true });
  }

  async nextFarmer() {
    if (this.phase !== 'result') return;
    this.phase = 'leaving';
    try { await this.app.beforeNextFarmer(); } catch (e) { /* ignore */ }
    if (this.phase === 'leaving') this.newRound();
  }

  updateInfo() {
    const r = this.round;
    if (!r) return;
    const f = r.farmer;
    const k = r.unitsPerBox;
    this.el.crates.textContent = f.animal
      ? `🚚 ${f.unit} ${r.cratesLeft * k}/${r.cratesTotal * k} · ${r.unloadAll ? 'tutti in un colpo' : `${r.perTrip * k} per viaggio`}`
      : `📦 cassette: ${r.cratesLeft}/${r.cratesTotal} · ${r.unloadAll ? 'tutte in un colpo' : `${r.perTrip} per viaggio`}`;
    this.el.count.innerHTML = `dati <em>(data)</em>: ${r.sample.length}`;
    this.el.lock.disabled = !(this.phase === 'collect' && this.canLock()) || !!this.fitting;
    const hasFitter = !!this.app.getState().levels.fitter;
    this.el.fit.hidden = !hasFitter;
    this.el.fit.disabled = this.el.lock.disabled;
  }

  // ------------------------------------------------------------ simulation + drawing
  geo() {
    return { truckRear: 0.37, farmerIdle: 0.42, beltStart: 0.48, beltEnd: 0.99, scanner: 0.75, pick: 0.36 };
  }

  frame(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    const r = this.round;
    if (!r) return;
    if (this.phase === 'arriving' && now - this.phaseT0 >= CONFIG.TRUCK_ARRIVE_MS) {
      this.phase = 'collect';
      this.updateInfo();
    }
    // Carry animation: drop the crate at the end.
    if (this.carry && this.carry.all) {
      // unload-all: trip i drops its share half-way through its period
      const c = this.carry;
      while (c.dropped < c.trips && now - c.t0 >= (c.dropped + 0.5) * c.period) {
        this.dropCrate(now, c.shares[c.dropped]);
        c.dropped++;
      }
      if (now - c.t0 >= CONFIG.UNLOAD_ALL_MS) { this.carry = null; this.updateInfo(); }
    } else if (this.carry && now - this.carry.t0 >= CONFIG.CARRY_MS && !this.carry.dropped) {
      this.carry.dropped = true;
      this.dropCrate(now);
    }
    if (this.carry && !this.carry.all && now - this.carry.t0 >= CONFIG.CARRY_MS + CONFIG.RETURN_MS) {
      this.carry = null;
      this.updateInfo();
    }
    // Belt.
    const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000);
    this.lastNow = now;
    const g = this.geo();
    let changed = false;
    for (const u of this.units) {
      if (now < u.spawnAt || u.gone) continue;
      u.x += CONFIG.BELT_SPEED * dt;
      if (!u.measured && u.x >= g.scanner) {
        u.measured = true;
        const d = measure(r, u.idx);
        d.born = now;
        r.sample.push(d);
        this.scanFlash = now;
        changed = true;
      }
      if (u.x > g.beltEnd + 0.05) u.gone = true;
    }
    if (this.units.length && this.units.every((u) => u.gone)) this.units = [];
    if (changed) this.updateInfo();

    this.stepAutoFit(now);
    if (this.phase === 'reveal') {
      const total = CONFIG.REVEAL_HARVEST_MS + CONFIG.REVEAL_RESIDUALS_MS + 200;
      if (now - this.phaseT0 >= total) this.showResult();
    }
    this.drawPlot(now);
    this.drawScene(now);
  }

  drawPlot(now) {
    const { ctx, W, H } = fitCanvas(this.el.plot);
    const r = this.round;
    const f = r.farmer;
    ctx.clearRect(0, 0, W, H);
    // Plot area; the axes sit just outside it, with a gutter on the left for the y-axis markers.
    const L = 42, R = W - 16, T = 26, B = H - 32;
    const px = (x) => L + x * (R - L);
    const py = (y) => B - y * (B - T);

    // grid (no numbers)
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(px(i / 5), T); ctx.lineTo(px(i / 5), B); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L, py(i / 5)); ctx.lineTo(R, py(i / 5)); ctx.stroke();
    }
    this.drawAxes(ctx, { L, R, T, B, W }, f, r.axes || { flipX: false, flipY: false });

    const revealing = this.phase === 'reveal' || this.phase === 'result' || this.phase === 'leaving';
    const tr = revealing ? now - this.phaseT0 : 0;
    const line = revealing ? this.lockedLine : this.line;

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T - 6, R - L, B - T + 6); ctx.clip();

    if (revealing) {
      const aH = clamp(tr / CONFIG.REVEAL_HARVEST_MS, 0, 1);
      // residuals to the player's line: flash, then stay faint
      const tRes = tr - CONFIG.REVEAL_HARVEST_MS;
      if (tRes > 0) {
        let a;
        if (tRes < CONFIG.REVEAL_RESIDUALS_MS) a = 0.25 + 0.45 * (0.5 - 0.5 * Math.cos((tRes / CONFIG.REVEAL_RESIDUALS_MS) * 4 * Math.PI));
        else a = 0.18;
        ctx.strokeStyle = `rgba(217,80,43,${a})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const p of r.harvest) {
          ctx.moveTo(px(p.x), py(p.y));
          ctx.lineTo(px(p.x), py(line.a + line.b * p.x));
        }
        ctx.stroke();
      }
      ctx.fillStyle = C.harvest;
      ctx.globalAlpha = 0.5 * aH;
      ctx.beginPath();
      for (const p of r.harvest) {
        const X = px(p.x), Y = py(p.y);
        ctx.moveTo(X + 2.6, Y);
        ctx.arc(X, Y, 2.6, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // measured dots (smaller when there are many)
    const dotR = r.sample.length > 150 ? 3.5 : r.sample.length > 60 ? 4.2 : 5;
    for (const d of r.sample) {
      const t = clamp((now - d.born) / 260, 0, 1);
      const s = t < 1 ? 1 + 0.6 * Math.sin(t * Math.PI) : 1;
      const rad = dotR * s * (t < 0.15 ? t / 0.15 : 1);
      ctx.fillStyle = C.soil;
      ctx.beginPath(); ctx.arc(px(d.x), py(d.y), rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.cream; ctx.lineWidth = 1.2; ctx.stroke();
      if (revealing && d.glitch && tr > CONFIG.REVEAL_HARVEST_MS) {
        ctx.strokeStyle = C.tomato; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(px(d.x), py(d.y), 11, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // best line, drawn from left to right
    if (revealing) {
      const tb = clamp((tr - CONFIG.REVEAL_HARVEST_MS - 400) / CONFIG.REVEAL_BEST_LINE_MS, 0, 1);
      if (tb > 0) {
        const b = r.best;
        const xe = easeOut(tb);
        ctx.strokeStyle = C.olive; ctx.lineWidth = 3.5; ctx.setLineDash([10, 6]);
        ctx.beginPath(); ctx.moveTo(px(0), py(b.a)); ctx.lineTo(px(xe), py(b.a + b.b * xe)); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // player's line
    ctx.strokeStyle = C.tomato; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px(0), py(line.a)); ctx.lineTo(px(1), py(line.a + line.b)); ctx.stroke();
    ctx.restore();

    // intercept marker on the y axis
    if (line.a >= -0.02 && line.a <= 1.02) {
      // dotted link to the vertical axis, which sits a little left of the plot
      ctx.strokeStyle = 'rgba(217,80,43,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(L - 16, py(line.a)); ctx.lineTo(px(0), py(line.a)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.tomato; ctx.strokeStyle = C.cream; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(0), py(line.a), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    if (r.sample.length === 0 && this.phase === 'collect') {
      ctx.fillStyle = 'rgba(91,58,41,0.55)';
      ctx.font = `500 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Ancora nessun dato: tocca il camion 🚚', (L + R) / 2, (T + B) / 2 - 30);
    }
  }

  // Axes without numbers: "−" and a small emoji at the low end, "+" and a big emoji at the high
  // end, and an arrowhead pointing to "+". A reversed axis ("+" on the left / at the bottom) is
  // drawn in tomato so it stands out.
  drawAxes(ctx, { L, R, T, B }, f, axes) {
    const ax = L - 16;            // x of the vertical axis
    const ay = B + 10;            // y of the horizontal axis
    const xIcon = f.xIcon || f.unit, yIcon = f.yIcon || f.unit;
    const arrow = (x, y, dx, dy) => {   // arrowhead with its tip at (x, y), pointing along (dx, dy)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx * 9 - dy * 5, y - dy * 9 - dx * 5);
      ctx.lineTo(x - dx * 9 + dy * 5, y - dy * 9 + dx * 5);
      ctx.closePath(); ctx.fill();
    };
    const sign = (txt, x, y) => { ctx.font = `800 15px ${FONT}`; ctx.fillText(txt, x, y); };
    const icon = (big, ch, x, y) => { ctx.font = `${big ? 18 : 11}px ${FONT}`; ctx.fillText(ch, x, y); };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;

    // vertical axis
    const yCol = axes.flipY ? C.tomato : C.soil;
    ctx.strokeStyle = yCol; ctx.fillStyle = yCol;
    ctx.beginPath(); ctx.moveTo(ax, T - 4); ctx.lineTo(ax, B + 2); ctx.stroke();
    if (!axes.flipY) arrow(ax, T - 12, 0, -1); else arrow(ax, B + 8, 0, 1);
    const gx = 12;                // gutter column for the markers
    const topPlus = !axes.flipY;
    sign(topPlus ? '+' : '−', gx, T - 6);
    icon(topPlus, yIcon, gx, T + 12);
    icon(!topPlus, yIcon, gx, B - 12);
    sign(topPlus ? '−' : '+', gx, B + 6);

    // horizontal axis
    const xCol = axes.flipX ? C.tomato : C.soil;
    ctx.strokeStyle = xCol; ctx.fillStyle = xCol;
    ctx.beginPath(); ctx.moveTo(L - 2, ay); ctx.lineTo(R + 2, ay); ctx.stroke();
    if (!axes.flipX) arrow(R + 10, ay, 1, 0); else arrow(L - 10, ay, -1, 0);
    const row = ay + 13;
    const rightPlus = !axes.flipX;
    sign(rightPlus ? '−' : '+', L + 2, row);
    icon(!rightPlus, xIcon, L + 18, row);
    icon(rightPlus, xIcon, R - 14, row);
    sign(rightPlus ? '+' : '−', R + 4, row);

    // quantity names (unchanged): y at the top, x centred under the axis
    ctx.fillStyle = C.soil;
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(yLabel(f), L + 2, T - 14);
    ctx.textAlign = 'center';
    ctx.fillText(xLabel(f), (L + R) / 2, row);
    ctx.textBaseline = 'alphabetic';
  }

  drawScene(now) {
    const { ctx, W, H } = fitCanvas(this.el.scene);
    this.sceneW = W;
    const r = this.round;
    const f = r.farmer;
    const g = this.geo();
    const lv = this.app.getState().levels;
    const ground = H * 0.86;
    ctx.clearRect(0, 0, W, H);
    this.checkUpgrades(now, lv);

    // ground
    ctx.fillStyle = '#DCC792';
    ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = 'rgba(107,127,42,0.35)';
    ctx.fillRect(0, ground, W, 3);

    // belt
    const bx0 = g.beltStart * W, bx1 = g.beltEnd * W, by = ground - 14;
    ctx.fillStyle = '#3F2A1E';
    ctx.fillRect(bx0, by, bx1 - bx0, 9);
    ctx.strokeStyle = 'rgba(233,216,166,0.55)'; ctx.lineWidth = 2;
    const off = ((now / 1000) * CONFIG.BELT_SPEED * W) % 14;
    ctx.save(); ctx.beginPath(); ctx.rect(bx0, by, bx1 - bx0, 9); ctx.clip();
    for (let x = bx0 - 14 + off; x < bx1; x += 14) { ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + 5, by + 9); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = C.soil;
    for (let x = bx0 + 8; x < bx1; x += 30) { ctx.fillRect(x, by + 9, 4, ground - by - 9); }

    // scanner body, then the products passing through it, then the scan beam on top
    const sc = {
      cx: g.scanner * W, ground, H, level: lv.scanner, now, beltY: by,
      flashAge: now - (this.scanFlash || -1e9), upgradeAge: now - (this.fx.scanner ?? -1e9),
    };
    drawScanner(ctx, sc);
    const us = Math.min(26, H * 0.24);
    ctx.font = `${us}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const u of this.units) {
      if (now < u.spawnAt || u.gone) continue;
      const bob = f.animal ? Math.abs(Math.sin(now / 90 + u.idx)) * 3 : 0;
      ctx.fillText(f.unit, u.x * W, by - 1 - bob);
    }
    drawScannerBeam(ctx, sc);
    if (lv.fitter) {
      drawFitter(ctx, {
        ...sc, scannerUpgradeAge: sc.upgradeAge, upgradeAge: now - (this.fx.fitter ?? -1e9),
        fitting: this.fitting ? clamp((now - this.fitting.t0) / CONFIG.FITTER_ANIM_MS, 0, 1) : null,
      });
    }

    // vehicle: drives in from the left, and drives back out to the left when sent away
    let tOff = 0;
    if (this.phase === 'arriving') tOff = -(1 - easeOut(clamp((now - this.phaseT0) / CONFIG.TRUCK_ARRIVE_MS, 0, 1))) * W * 0.6;
    if (this.truckLeave) {
      const t = clamp((now - this.truckLeave.t0) / CONFIG.TRUCK_LEAVE_MS, 0, 1);
      tOff = -(t * t * t) * W * 0.75;
      if (t >= 1) { this.truckGone = true; this.truckLeave = null; }
    }
    if (!this.truckGone) {
      const tappable = (this.truckTappable(now) && r.sample.length === 0) || this.truckCanLeave();
      const pulse = tappable ? 1 + 0.025 * Math.sin(now / 160) : 1;
      const tPop = upgradePop(now - (this.fx.truck ?? -1e9));
      ctx.save();
      const ax = g.truckRear * W + tOff;
      ctx.translate(ax, ground); ctx.scale(pulse * tPop, pulse * tPop); ctx.translate(-ax, -ground);
      const bed = drawVehicle(ctx, { level: r.truckLevel, xRear: g.truckRear * W, ground, W, H, now, off: tOff });
      // While the farmer walks to the truck, the boxes being fetched are still on the pile.
      let shown = r.cratesLeft;
      if (this.carry && this.carry.all) {
        // shares of trips that haven't been picked up yet are still on the pile
        const c = this.carry, started = Math.min(c.trips, Math.floor((now - c.t0) / c.period) + 1);
        for (let i = started; i < c.trips; i++) shown += c.shares[i];
      } else if (this.carry && now - this.carry.t0 < CONFIG.CARRY_MS * 0.35) shown += this.carry.boxes;
      const per = f.animal ? r.unitsPerBox : 1;   // animals are drawn one by one
      drawPile(ctx, f.unit, f.animal, r.cratesTotal * per, shown * per, bed.bx, bed.bw, bed.floorY, bed.maxH);
      ctx.restore();
    }

    // unloading: farmer, helpers or tools, moving between truck and belt
    const idleX = g.farmerIdle * W, pickX = g.pick * W, dropX = (g.beltStart + 0.01) * W;
    let x = idleX, carrying = false, tripP = null, walking = false, load = this.carry ? this.carry.boxes : 0;
    if (this.carry && this.carry.all) {
      // shuttle: truck -> belt (carrying) -> truck ...; the last run ends back at the idle spot
      const c = this.carry, t = now - c.t0;
      const i = Math.min(c.trips - 1, Math.floor(t / c.period));
      const q = clamp((t - i * c.period) / c.period, 0, 1);
      walking = true;
      load = c.shares[i];
      tripP = q;
      if (q < 0.5) { x = pickX + (dropX - pickX) * easeInOut(q / 0.5); carrying = true; }
      else { const back = i === c.trips - 1 ? idleX : pickX; x = dropX + (back - dropX) * easeInOut((q - 0.5) / 0.5); }
    } else if (this.carry) {
      const t = now - this.carry.t0;
      tripP = clamp(t / (CONFIG.CARRY_MS + CONFIG.RETURN_MS), 0, 1);
      walking = true;
      if (t < CONFIG.CARRY_MS) {
        const p = t / CONFIG.CARRY_MS;
        if (p < 0.35) x = idleX + (pickX - idleX) * easeInOut(p / 0.35);
        else { x = pickX + (dropX - pickX) * easeInOut((p - 0.35) / 0.65); carrying = true; }
      } else {
        const p = (t - CONFIG.CARRY_MS) / CONFIG.RETURN_MS;
        x = dropX + (idleX - dropX) * easeInOut(clamp(p, 0, 1));
      }
    }
    if (this.phase !== 'arriving') {
      const uPop = upgradePop(now - (this.fx.belt ?? -1e9));
      ctx.save();
      ctx.translate(x, ground); ctx.scale(uPop, uPop); ctx.translate(-x, -ground);
      drawUnloader(ctx, {
        level: lv.belt, animal: f.animal, x, ground, H, now, carrying, walking,
        boxes: load, unitsPerBox: r.unitsPerBox, unit: f.unit, face: f.face,
        tripP, pickX, dropX, idleX,
      });
      ctx.restore();
    }

    // upgrade moments: sparkles and a label
    drawUpgradeFx(ctx, sc.cx, ground - scannerMetrics(lv.scanner, H).heightPx * 0.6, now - (this.fx.scanner ?? -1e9), `Scanner ${lv.scanner}!`);
    drawUpgradeFx(ctx, sc.cx, ground - scannerMetrics(lv.scanner, H).heightPx - 8, now - (this.fx.fitter ?? -1e9), 'Adattatore automatico!');
    drawUpgradeFx(ctx, idleX, ground - H * 0.45, now - (this.fx.belt ?? -1e9), UNLOADER_LABEL(f.animal, lv.belt));
    if (!this.truckGone) drawUpgradeFx(ctx, g.truckRear * W * 0.55, H * 0.3, now - (this.fx.truck ?? -1e9), `${VEHICLE_NAMES[r.truckLevel]}!`);

    // hints (to the right of the pile, which can be tall), outlined so they read over anything
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const hint = (msg, color, size) => {
      ctx.font = `700 ${size}px ${FONT}`;
      const room = W * 0.6;
      const wide = ctx.measureText(msg).width;
      if (wide > room) ctx.font = `700 ${Math.max(9, Math.floor(size * room / wide))}px ${FONT}`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(251,247,239,0.9)';
      ctx.strokeText(msg, W * 0.38, 11);
      ctx.fillStyle = color;
      ctx.fillText(msg, W * 0.38, 11);
    };
    if (this.truckTappable(now) && r.sample.length === 0 && this.units.length === 0) {
      hint('👈 Tocca il camion!', `rgba(217,80,43,${0.6 + 0.4 * Math.sin(now / 250)})`, 14);
    } else if (this.truckCanLeave() && this.units.length === 0) {
      hint('👈 Camion vuoto: tocca per mandarlo via', `rgba(91,58,41,${0.65 + 0.35 * Math.sin(now / 300)})`, 12);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Detect bought upgrades and start their "upgrade moment" (only while no sheet covers the scene).
  // Scanner and unloading apply at once; a new truck arrives with the next farmer.
  checkUpgrades(now, lv) {
    if (!this.shown) {
      this.shown = { scanner: lv.scanner, belt: lv.belt, fitter: lv.fitter, truck: this.round.truckLevel };
      return;
    }
    if (this.app.overlayOpen && this.app.overlayOpen()) return;
    for (const key of ['scanner', 'belt', 'fitter']) {
      if (lv[key] !== this.shown[key]) {
        if (lv[key] > this.shown[key]) this.fx[key] = now;
        this.shown[key] = lv[key];
        applyLiveLevels(this.round, lv);
        this.updateInfo();
      }
    }
    if (this.round.truckLevel !== this.shown.truck && this.phase !== 'arriving') {
      if (this.round.truckLevel > this.shown.truck) this.fx.truck = now;
      this.shown.truck = this.round.truckLevel;
    }
  }
}
