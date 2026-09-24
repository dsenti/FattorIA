// Minigame 1: La stazione di pesatura (the weighing station).
// Owns the weighing screen: plot canvas, scene canvas (truck, farmer, belt, scanner),
// the two sliders and the result panel.
import { CONFIG } from '../config.js';
import { Slider } from '../slider.js';
import { xLabel, yLabel } from './farmers.js';
import { makeRound, takeUnit, measure, scoreLine, sliderToLine, startSliders } from './round.js';
import { clamp } from '../stats.js';

const C = {
  soil: '#5B3A29', olive: '#6B7F2A', wheat: '#E9D8A6', cream: '#FBF7EF',
  tomato: '#D9502B', sky: '#4A8FA3', harvest: '#B89A5E', grid: 'rgba(91,58,41,0.08)',
};
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"';

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
      controls: $('w-controls'), lock: $('w-lock'),
      result: $('w-result'), resTitle: $('w-res-title'), resCoins: $('w-res-coins'),
      barMe: $('w-bar-me'), barBest: $('w-bar-best'), resNote: $('w-res-note'), next: $('w-next'),
    };
    const s0 = startSliders();
    this.slope = new Slider($('w-slope'), { value: s0.slope, label: 'pendenza', onInput: () => this.onSlider() });
    this.intercept = new Slider($('w-intercept'), { value: s0.intercept, label: 'intercetta', onInput: () => this.onSlider() });

    this.el.lock.addEventListener('click', () => this.lock());
    this.el.next.addEventListener('click', () => this.nextFarmer());
    this.el.scene.addEventListener('pointerdown', (e) => this.onSceneTap(e));

    this.round = null;
    this.phase = 'idle';
    this.active = false;
    this.units = [];       // units on the belt: { idx, x, spawnAt, measured, gone }
    this.carry = null;     // { t0 }
    this.scanFlash = 0;
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
    this.carry = { t0: now, boxes };
    this.cooldownUntil = now + CONFIG.CARRY_MS + CONFIG.RETURN_MS;
    this.updateInfo();
  }

  dropCrate(now) {
    const n = this.carry.boxes * this.round.unitsPerBox;
    const W = this.sceneW || 390;
    const spacing = 26 / W;                       // in scene-width units
    const interval = Math.min(spacing / CONFIG.BELT_SPEED * 1000, CONFIG.TRIP_UNLOAD_MS / n);
    let t = Math.max(now, this.nextSpawnAt || 0);
    for (let i = 0; i < n; i++) {
      const idx = takeUnit(this.round);
      if (idx < 0) break;
      this.units.push({ idx, spawnAt: t, x: this.geo().beltStart, measured: false, gone: false });
      t += interval;
    }
    this.nextSpawnAt = t;
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
    const titles = ['Proprio no…', 'Mah…', 'Così così', 'Bene!', 'Ottimo!', 'Perfetto!'];
    this.el.resTitle.textContent = `${CONFIG.REACTIONS[res.coins]} ${titles[res.coins]}`;
    this.el.face.textContent = CONFIG.REACTIONS[res.coins];
    const says = [
      'Questa retta non mi aiuta proprio.',
      'Mmh, sul mio raccolto sbaglia parecchio.',
      'Qualcosa indovina, ma non tanto.',
      'Buona! Sul raccolto intero funziona bene.',
      'Ottima retta, quasi come la migliore!',
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
    const tick = () => {
      if (k >= target) return;
      k++;
      this.el.resCoins.textContent = `+${k} 🪙`;
      this.el.resCoins.classList.remove('pop');
      void this.el.resCoins.offsetWidth;
      this.el.resCoins.classList.add('pop');
      setTimeout(tick, CONFIG.COIN_COUNT_MS);
    };
    setTimeout(tick, CONFIG.COIN_COUNT_MS);
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
      ? `🚚 ${f.unit} ${r.cratesLeft * k}/${r.cratesTotal * k} · ${r.perTrip * k} per viaggio`
      : `📦 cassette: ${r.cratesLeft}/${r.cratesTotal} · ${r.perTrip} per viaggio`;
    this.el.count.innerHTML = `dati <em>(data)</em>: ${r.sample.length}`;
    this.el.lock.disabled = !(this.phase === 'collect' && this.canLock());
  }

  // ------------------------------------------------------------ simulation + drawing
  geo() {
    return { truckRear: 0.33, farmerIdle: 0.385, beltStart: 0.44, beltEnd: 0.99, scanner: 0.7, pick: 0.31 };
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
    if (this.carry && now - this.carry.t0 >= CONFIG.CARRY_MS && !this.carry.dropped) {
      this.carry.dropped = true;
      this.dropCrate(now);
    }
    if (this.carry && now - this.carry.t0 >= CONFIG.CARRY_MS + CONFIG.RETURN_MS) {
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
    const L = 16, R = W - 12, T = 28, B = H - 26;
    const px = (x) => L + x * (R - L);
    const py = (y) => B - y * (B - T);

    // grid (no numbers)
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(px(i / 5), T); ctx.lineTo(px(i / 5), B); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L, py(i / 5)); ctx.lineTo(R, py(i / 5)); ctx.stroke();
    }
    // axes with arrows
    ctx.strokeStyle = C.soil; ctx.fillStyle = C.soil; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(L, T - 8); ctx.lineTo(L, B); ctx.lineTo(R + 4, B); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L, T - 14); ctx.lineTo(L - 5, T - 5); ctx.lineTo(L + 5, T - 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R + 10, B); ctx.lineTo(R + 1, B - 5); ctx.lineTo(R + 1, B + 5); ctx.fill();
    ctx.font = `600 13px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(yLabel(f), L + 10, T - 12);
    ctx.textAlign = 'right';
    ctx.fillText(xLabel(f), R, B + 15);

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

  drawScene(now) {
    const { ctx, W, H } = fitCanvas(this.el.scene);
    this.sceneW = W;
    const r = this.round;
    const f = r.farmer;
    const g = this.geo();
    const ground = H * 0.86;
    ctx.clearRect(0, 0, W, H);

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

    // units on the belt
    const us = Math.min(26, H * 0.24);
    ctx.font = `${us}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const u of this.units) {
      if (now < u.spawnAt || u.gone) continue;
      const bob = f.animal ? Math.abs(Math.sin(now / 90 + u.idx)) * 3 : 0;
      ctx.fillText(f.unit, u.x * W, by - 1 - bob);
    }

    // scanner arch
    const sx = g.scanner * W, sw = Math.max(40, W * 0.12), sh = H * 0.62;
    const flash = clamp(1 - (now - this.scanFlash) / 250, 0, 1);
    if (flash > 0) {
      ctx.fillStyle = `rgba(217,80,43,${0.35 * flash})`;
      ctx.fillRect(sx - 3, ground - sh + 14, 6, sh - 26);
    }
    ctx.fillStyle = C.sky;
    ctx.fillRect(sx - sw / 2, ground - sh, 8, sh);
    ctx.fillRect(sx + sw / 2 - 8, ground - sh, 8, sh);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(sx - sw / 2, ground - sh - 4, sw, 18, 6) : ctx.rect(sx - sw / 2, ground - sh - 4, sw, 18);
    ctx.fill();
    ctx.fillStyle = flash > 0 ? C.tomato : C.wheat;
    ctx.beginPath(); ctx.arc(sx, ground - sh + 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.cream;
    ctx.font = `700 9px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SCANNER', sx, ground - sh - 8);

    // truck: drives in from the left, and drives back out to the left when sent away
    let tOff = 0;
    if (this.phase === 'arriving') tOff = -(1 - easeOut(clamp((now - this.phaseT0) / CONFIG.TRUCK_ARRIVE_MS, 0, 1))) * W * 0.5;
    if (this.truckLeave) {
      const t = clamp((now - this.truckLeave.t0) / CONFIG.TRUCK_LEAVE_MS, 0, 1);
      tOff = -(t * t * t) * W * 0.6;
      if (t >= 1) { this.truckGone = true; this.truckLeave = null; }
    }
    if (!this.truckGone) this.drawTruck(ctx, W, H, ground, tOff, now);

    // farmer
    let fx = g.farmerIdle, carrying = false;
    if (this.carry) {
      const t = now - this.carry.t0;
      if (t < CONFIG.CARRY_MS) {
        const p = t / CONFIG.CARRY_MS;
        if (p < 0.35) fx = g.farmerIdle + (g.pick - g.farmerIdle) * easeInOut(p / 0.35);
        else { fx = g.pick + (g.beltStart + 0.01 - g.pick) * easeInOut((p - 0.35) / 0.65); carrying = true; }
      } else {
        const p = (t - CONFIG.CARRY_MS) / CONFIG.RETURN_MS;
        fx = g.beltStart + 0.01 + (g.farmerIdle - g.beltStart - 0.01) * easeInOut(clamp(p, 0, 1));
      }
    }
    if (this.phase !== 'arriving') {
      const fs = Math.min(38, H * 0.34);
      const walking = this.carry && now - this.carry.t0 < CONFIG.CARRY_MS + CONFIG.RETURN_MS;
      const bob = walking ? Math.abs(Math.sin(now / 70)) * 3 : 0;
      ctx.font = `${fs}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(f.face, fx * W, ground - 2 - bob);
      if (carrying) {
        if (f.animal) {
          // The animals of this trip follow the farmer in a line.
          const count = this.carry.boxes * r.unitsPerBox;
          const drawn = Math.min(count, 3);
          ctx.font = `${us}px ${FONT}`;
          for (let i = 0; i < drawn; i++) {
            const b2 = Math.abs(Math.sin(now / 90 + i)) * 2;
            ctx.fillText(f.unit, fx * W - fs * 0.75 - i * us * 0.55, ground - 2 - b2);
          }
          if (count > drawn) {
            ctx.font = `800 12px ${FONT}`;
            ctx.lineWidth = 3; ctx.strokeStyle = C.cream; ctx.fillStyle = C.soil;
            ctx.strokeText(`+${count - drawn}`, fx * W, ground - fs - 6);
            ctx.fillText(`+${count - drawn}`, fx * W, ground - fs - 6);
          }
        } else {
          this.drawCarryStack(ctx, fx * W, ground - fs * 0.85 - bob, this.carry.boxes, f.unit);
        }
      }
    }

    // hint
    // hints (to the right of the pile, which can be tall)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (this.truckTappable(now) && r.sample.length === 0 && this.units.length === 0) {
      const a = 0.6 + 0.4 * Math.sin(now / 250);
      ctx.fillStyle = `rgba(217,80,43,${a})`;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText('👈 Tocca il camion!', W * 0.4, 11);
    } else if (this.truckCanLeave() && this.units.length === 0) {
      const a = 0.65 + 0.35 * Math.sin(now / 300);
      ctx.fillStyle = `rgba(91,58,41,${a})`;
      ctx.font = `700 12px ${FONT}`;
      const msg = '👈 Camion vuoto: tocca per mandarlo via';
      const room = W * 0.62;
      const wide = ctx.measureText(msg).width;
      if (wide > room) ctx.font = `700 ${Math.max(9, Math.floor(12 * room / wide))}px ${FONT}`;
      ctx.fillText(msg, W * 0.36, 11);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Pseudo-3D pile: `cols` wide, `depth` rows deep (back rows drawn up and to the right),
  // and as many layers (crates) or decks (animals) as needed. The layout depends only on the
  // truck's capacity (capped at PILE_VISIBLE_MAX), so the pile doesn't jump as it shrinks.
  // Crates are filled front row first (bottom to top), so the farmer takes them from the back
  // row first, top to bottom, and the front of the pile stays full until the end.
  // Animals are filled back row first, so the front-most ones are led out first.
  pileLayout(capacity, animal, bx, bw, floorY, maxH) {
    const n = Math.max(1, Math.min(capacity, CONFIG.PILE_VISIBLE_MAX));
    const cols = 3;
    const depth = n <= 3 ? 1 : n <= 12 ? 2 : 3;
    const layers = Math.max(1, Math.ceil(n / (cols * depth)));
    const perRow = cols * layers;
    let cw = (bw - 2) / (cols + (depth - 1) * 0.4);
    let ch = animal ? cw * 0.95 : cw * 0.62;
    let dx = cw * 0.4, dy = animal ? ch * 0.28 : ch * 0.5;
    // Total height including the top faces of the top layer and the produce lying on top.
    const full = layers * ch + depth * dy + (animal ? 0 : ch * 0.8);
    const k = Math.min(1, maxH / full);
    cw *= k; ch *= k; dx *= k; dy *= k;
    const pos = (i) => {
      const r = Math.floor(i / perRow), j = i % perRow;
      const row = animal ? depth - 1 - r : r;   // 0 = front
      const layer = Math.floor(j / cols), col = j % cols;
      return { layer, row, col, x: bx + 1 + col * cw + row * dx, y: floorY - layer * ch - row * dy };
    };
    return { cap: n, cols, depth, layers, cw, ch, dx, dy, pos, height: layers * ch + (depth - 1) * dy };
  }

  // capacity and shown are counted in drawn items: boxes for crops, animals for livestock.
  drawPile(ctx, f, capacity, shown, bx, bw, floorY, maxH) {
    const L = this.pileLayout(capacity, f.animal, bx, bw, floorY, maxH);
    const vis = Math.min(shown, L.cap);
    const items = [];
    const occupied = new Set();
    for (let i = 0; i < vis; i++) {
      const p = { i, ...L.pos(i) };
      items.push(p);
      occupied.add(`${p.layer},${p.row},${p.col}`);
    }
    // Painter's order: back rows first, then bottom to top, then left to right.
    items.sort((p, q) => q.row - p.row || p.layer - q.layer || p.col - q.col);
    const right = bx + L.cols * L.cw + (L.depth - 1) * L.dx + 2;
    const topY = floorY - L.height - (f.animal ? 4 : L.dy + L.ch * 0.8);

    if (f.animal) {
      // Multi-deck livestock trailer: back wall, animals, then slats and deck floors in front.
      const top = floorY - L.height - 4;
      ctx.fillStyle = C.wheat;
      ctx.fillRect(bx, top, right - bx, floorY - top);
      ctx.font = `${L.ch * 0.92}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (const p of items) ctx.fillText(f.unit, p.x + L.cw / 2, p.y - L.ch * 0.08);
      ctx.strokeStyle = C.soil;
      for (let d = 0; d <= L.layers; d++) {
        const yy = floorY - d * L.ch;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(right, yy); ctx.stroke();
        if (d < L.layers) {
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.moveTo(bx, yy - L.ch * 0.5); ctx.lineTo(right, yy - L.ch * 0.5); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, top, right - bx, floorY - top);
    } else {
      // Open bed with low side walls, then the crates.
      ctx.strokeStyle = C.soil; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, floorY); ctx.lineTo(bx, floorY - 10);
      ctx.moveTo(bx + bw, floorY); ctx.lineTo(bx + bw, floorY - 10);
      ctx.stroke();
      for (const p of items) {
        const onTop = !occupied.has(`${p.layer + 1},${p.row},${p.col}`);
        this.drawBox(ctx, p.x, p.y, L.cw, L.ch, L.dx, L.dy, onTop ? f.unit : null);
      }
    }

    // What doesn't fit in the drawing is shown as a count.
    if (shown > L.cap) {
      const txt = `+${shown - L.cap}`;
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const tx = Math.min(right + 2, bx + bw + 14), ty = Math.max(9, topY + 2);
      ctx.lineWidth = 3.5; ctx.strokeStyle = C.cream; ctx.lineJoin = 'round';
      ctx.strokeText(txt, tx, ty);
      ctx.fillStyle = C.soil;
      ctx.fillText(txt, tx, ty);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // The farmer's load: boxes stacked in his arms (two columns for big loads), bottom at `bottomY`.
  drawCarryStack(ctx, cx, bottomY, n, unit) {
    const cols = n > 5 ? 2 : 1;
    const rows = Math.ceil(n / cols);
    const bh = Math.max(4, Math.min(16, (bottomY - 4) / (rows + 0.8)));
    const bw = bh * 1.6;
    for (let i = 0; i < n; i++) {
      const c = i % cols, rr = Math.floor(i / cols);
      const x = cx - (cols * bw) / 2 + c * bw;
      const y = bottomY - rr * bh;
      this.drawBox(ctx, x, y, bw - 1, bh - 1, bw * 0.2, bh * 0.25, rr === rows - 1 ? unit : null);
    }
  }

  // One crate in pseudo-3D: front face, top face, right side. (x, y) = bottom-left of the front face.
  drawBox(ctx, x, y, w, h, dx, dy, unit) {
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

  drawTruck(ctx, W, H, ground, off, now) {
    const r = this.round;
    const f = r.farmer;
    const x0 = W * 0.01 + off;
    const x1 = W * this.geo().truckRear + off;
    const wheelR = Math.max(7, H * 0.075);
    const bodyB = ground - wheelR * 1.1;
    const cabW = (x1 - x0) * 0.25;
    const bedH = H * 0.36;
    const tappable = this.truckTappable(now);
    const pulse = (tappable && r.sample.length === 0) || this.truckCanLeave() ? 1 + 0.03 * Math.sin(now / 160) : 1;

    ctx.save();
    ctx.translate((x0 + x1) / 2, bodyB);
    ctx.scale(pulse, pulse);
    ctx.translate(-(x0 + x1) / 2, -bodyB);

    // cab (left)
    ctx.fillStyle = C.tomato;
    ctx.beginPath();
    ctx.moveTo(x0, bodyB); ctx.lineTo(x0, bodyB - bedH * 0.75);
    ctx.lineTo(x0 + cabW * 0.35, bodyB - bedH * 1.05); ctx.lineTo(x0 + cabW, bodyB - bedH * 1.05);
    ctx.lineTo(x0 + cabW, bodyB); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#CFE3E8';
    ctx.beginPath();
    ctx.moveTo(x0 + cabW * 0.2, bodyB - bedH * 0.72); ctx.lineTo(x0 + cabW * 0.42, bodyB - bedH * 0.95);
    ctx.lineTo(x0 + cabW * 0.85, bodyB - bedH * 0.95); ctx.lineTo(x0 + cabW * 0.85, bodyB - bedH * 0.72);
    ctx.closePath(); ctx.fill();

    // bed
    const bx = x0 + cabW + 2, bw = x1 - bx;
    ctx.fillStyle = C.soil;
    ctx.fillRect(bx, bodyB - 6, bw, 6);
    // How many units are still in the truck: while the farmer walks to the truck,
    // the unit being fetched is still on the pile (it disappears when it is picked up).
    let shown = r.cratesLeft;
    if (this.carry && now - this.carry.t0 < CONFIG.CARRY_MS * 0.35) shown += this.carry.boxes;
    const per = f.animal ? r.unitsPerBox : 1;   // animals are drawn one by one
    this.drawPile(ctx, f, r.cratesTotal * per, shown * per, bx, bw, bodyB - 6, bodyB - 8);
    // wheels
    ctx.fillStyle = '#2E2A26';
    for (const wx of [x0 + cabW * 0.5, x1 - bw * 0.25]) {
      ctx.beginPath(); ctx.arc(wx, bodyB + wheelR * 0.1, wheelR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9A9189';
      ctx.beginPath(); ctx.arc(wx, bodyB + wheelR * 0.1, wheelR * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2E2A26';
    }
    ctx.restore();
  }
}
