// App shell: map, shop, leaderboard, settings, name picker, day summary.
import { CONFIG } from './config.js';
import { loadState, saveState, clearState, defaultState, averageCoins } from './storage.js';
import { nameChoices, formatName } from './names.js';
import { submitScore, fetchBoard } from './leaderboard.js';
import { WeighingGame } from './weighing/game.js';
import { drawPreview } from './weighing/previews.js';
import { scannerOffer, scannerIndex, isSmartScanner } from './weighing/round.js';
import { VEHICLE_NAMES } from './weighing/vehicles.js';
import { UNLOADER_NAMES } from './weighing/unloaders.js';
import { installDebugButton } from './debug.js'; // TODO(Dominik): remove before the course

let state = loadState();
const $ = (sel) => document.querySelector(sel);
const fmt1 = (v) => v.toFixed(1).replace('.', ',');

// ------------------------------------------------------------ coins
let shownCoins = state.coins;
function renderCoins(animate) {
  const to = state.coins;
  const els = document.querySelectorAll('.coin-value');
  if (!animate || to <= shownCoins) {
    shownCoins = to;
    els.forEach((e) => { e.textContent = String(to); });
    return;
  }
  const step = () => {
    shownCoins++;
    els.forEach((e) => {
      e.textContent = String(shownCoins);
      const pill = e.parentElement;
      pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    });
    if (shownCoins < to) setTimeout(step, delay);
  };
  const delay = Math.min(CONFIG.COIN_COUNT_MS, CONFIG.COIN_COUNT_TOTAL_MS / Math.max(1, to - shownCoins));
  setTimeout(step, delay);
}

function save() {
  if (!saveState(state)) toast('Attenzione: non riesco a salvare i progressi su questo browser.');
}

function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

function pushScore() {
  if (!state.name) return;
  submitScore({
    playerId: state.playerId, name: state.name, totalCoins: state.totalEarned,
    avgCoins: averageCoins(state), farmers: state.farmersServed,
  }).catch(() => {});
}

// ------------------------------------------------------------ modal
function modal(html, buttons) {
  return new Promise((resolve) => {
    const m = $('#modal');
    $('#modal-body').innerHTML = html;
    const acts = $('#modal-actions');
    acts.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = `btn ${b.cls || ''}`;
      el.textContent = b.label;
      el.addEventListener('click', () => { m.hidden = true; resolve(b.value); });
      acts.appendChild(el);
    }
    m.hidden = false;
    acts.querySelector('button')?.focus({ preventScroll: true });
  });
}

// ------------------------------------------------------------ sheet
let sheetOnClose = null;
function openSheet(title, render, onClose) {
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  body.innerHTML = '';
  render(body);
  $('#sheet').hidden = false;
  sheetOnClose = onClose || null;
}
function closeSheet() {
  $('#sheet').hidden = true;
  const cb = sheetOnClose; sheetOnClose = null;
  if (cb) cb();
}
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

// ------------------------------------------------------------ name picker
function pickName(canCancel) {
  return new Promise((resolve) => {
    const m = $('#modal');
    const render = () => {
      const choices = nameChoices(3);
      $('#modal-body').innerHTML =
        '<h2>Scegli il tuo nome</h2>' +
        '<p>Nel gioco non usi il tuo vero nome. Scegline uno: lo vedrà la classe nella classifica.</p>';
      const acts = $('#modal-actions');
      acts.innerHTML = '';
      for (const c of choices) {
        const b = document.createElement('button');
        b.className = 'btn name-choice';
        b.textContent = formatName(c);
        b.addEventListener('click', () => { m.hidden = true; resolve(c); });
        acts.appendChild(b);
      }
      const re = document.createElement('button');
      re.className = 'btn olive';
      re.textContent = '🎲 Altri nomi';
      re.addEventListener('click', render);
      acts.appendChild(re);
      if (canCancel) {
        const x = document.createElement('button');
        x.className = 'btn';
        x.textContent = 'Annulla';
        x.addEventListener('click', () => { m.hidden = true; resolve(null); });
        acts.appendChild(x);
      }
    };
    render();
    m.hidden = false;
  });
}

// ------------------------------------------------------------ screens
const game = new WeighingGame($('#screen-weigh'), {
  getState: () => state,
  onRoundDone: ({ farmerId, coins, ratio }) => {
    state.coins += coins;
    state.totalEarned += coins;
    state.farmersServed += 1;
    state.dayFarmers += 1;
    state.dayCoins += coins;
    state.fits.push({ f: farmerId, c: coins, r: Math.round(ratio * 100) / 100 });
    save();
    const wait = CONFIG.REVEAL_HARVEST_MS + CONFIG.REVEAL_RESIDUALS_MS + 200;
    setTimeout(() => renderCoins(true), wait);
    pushScore();
  },
  overlayOpen: () => !$('#sheet').hidden || !$('#modal').hidden,
  onAxesFlipped: (axes) => {
    if (state.seenFlip) return;
    state.seenFlip = true;
    save();
    const which = axes.flipX && axes.flipY ? 'entrambi gli assi sono al contrario'
      : axes.flipX ? 'l\'asse orizzontale è al contrario' : 'l\'asse verticale è al contrario';
    toast(`⚠️ Attenzione: ${which}! Guarda dove sono il − e il +.`, 4500);
  },
  beforeNextFarmer: async () => {
    if (state.dayFarmers < CONFIG.FARMERS_PER_DAY) return;
    await daySummary();
  },
});

async function daySummary() {
  const recent = state.fits.slice(-state.dayFarmers);
  const perfect = recent.filter((r) => r.c === CONFIG.MAX_PAY).length;
  const avg = state.dayFarmers ? state.dayCoins / state.dayFarmers : 0;
  const tip = state.levels.scanner + state.levels.belt + state.levels.truck === 0
    ? 'Consiglio: nel negozio 🛒 puoi migliorare scanner, scarico e camion.'
    : 'Dati migliori o più dati? Nel negozio 🛒 decidi tu.';
  const html =
    `<h2>🌅 Giornata finita!</h2><p>Giorno ${state.day}: ecco com'è andata.</p>` +
    '<div class="stat-grid">' +
    `<div class="stat"><b>${state.dayFarmers}</b><span>agricoltori serviti</span></div>` +
    `<div class="stat"><b>${state.dayCoins} 🪙</b><span>monete guadagnate</span></div>` +
    `<div class="stat"><b>${fmt1(avg)}</b><span>monete per agricoltore</span></div>` +
    `<div class="stat"><b>${perfect}</b><span>rette perfette</span></div>` +
    '</div>' +
    `<p>${tip}</p>`;
  state.day += 1;
  state.dayFarmers = 0;
  state.dayCoins = 0;
  save();
  const choice = await modal(html, [
    { label: 'Nuova giornata ☀️', value: 'go', cls: 'primary' },
    { label: '🛒 Negozio', value: 'shop' },
  ]);
  if (choice === 'shop') await new Promise((res) => openShop(res));
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'screen-weigh') game.show(); else game.hide();
  if (id === 'screen-map') renderMap();
}

function renderMap() {
  const who = state.name ? formatName(state.name) : '';
  const stats = state.farmersServed > 0
    ? ` · ${state.farmersServed} agricoltori · media ${fmt1(averageCoins(state))} 🪙`
    : '';
  $('#map-player').textContent = who + stats;
  renderCoins(false);
}

// ------------------------------------------------------------ help
function showHelp() {
  return modal(
    '<h2>⚖️ La stazione di pesatura</h2>' +
    '<p>Gli agricoltori della valle vogliono una regola per prevedere una cosa da un\'altra.</p>' +
    '<ol>' +
    '<li><b>Tocca il camion 🚚.</b> L\'agricoltore porta una cassetta sul nastro. Lo scanner misura ogni pezzo: ogni misura è un dato <em>(data)</em>, un puntino nel grafico. Quando il camion è vuoto, riparte da solo.</li>' +
    '<li><b>Muovi i cursori</b> pendenza <em>(slope)</em> e intercetta <em>(intercept)</em> finché la retta passa vicino ai puntini.</li>' +
    '<li><b>Blocca la retta 🔒.</b> L\'agricoltore la prova sul suo raccolto intero. Più piccolo è l\'errore <em>(error)</em>, più monete ti dà (fino a 10 🪙).</li>' +
    '</ol>' +
    '<p>Attenzione: lo scanner a volte sbaglia. Con le monete puoi migliorarlo.</p>',
    [{ label: 'Capito, si parte!', value: 'ok', cls: 'primary' }],
  );
}

// ------------------------------------------------------------ shop
const normalOffer = (lv) => (lv < CONFIG.MAX_LEVEL ? { kind: 'level', level: lv + 1, cost: CONFIG.levelCost(lv + 1) } : null);
const SHOP = [
  {
    // Levels 0..10, then (only after 10) a surprise: the secret level 100 "Scanner intelligente".
    key: 'scanner', icon: '📡', name: (lv) => (isSmartScanner(lv) ? 'Scanner intelligente' : 'Scanner'),
    desc: (lv) => (isSmartScanner(lv)
      ? 'Lo scanner impara da solo la retta migliore dai punti che misura: la retta si sistema mentre arrivano i dati, poi si blocca da sola. Il raccolto intero non lo vede.'
      : 'Misure con meno rumore e meno valori anomali <em>(outlier)</em>: migliore qualità dei dati <em>(data quality)</em>.'),
    offer: scannerOffer,
    levelText: (lv) => (isSmartScanner(lv) ? 'Livello 100' : `Livello ${lv}/${CONFIG.MAX_LEVEL}`),
    effect: (lv) => {
      if (isSmartScanner(lv)) return 'Trova e blocca la retta da solo';
      const p = CONFIG.SCANNER_GLITCH[scannerIndex(lv)];
      const glitch = p > 0 ? `sbaglia di grosso circa 1 misura su ${Math.round(1 / p)}` : 'non sbaglia più di grosso';
      return glitch.charAt(0).toUpperCase() + glitch.slice(1);
    },
  },
  {
    // Stored as "belt" in the save file (the old name); shown as "Scarico" (unloading).
    key: 'belt', icon: '🦾', name: () => 'Scarico',
    desc: () => 'Chi scarica il camion: prima aiutanti, poi attrezzi e macchine. Più cassette (o più animali) a ogni viaggio: scarichi più in fretta. Non dà più dati, fa risparmiare tempo.',
    offer: normalOffer,
    effect: (lv) => (lv >= CONFIG.UNLOAD_ALL_LEVEL
      ? 'Robot: svuota tutto il camion in un colpo'
      : `${UNLOADER_NAMES[lv]}: ${CONFIG.BELT_BOXES[lv]} ${CONFIG.BELT_BOXES[lv] === 1 ? 'cassetta' : 'cassette'} per viaggio`),
  },
  {
    key: 'truck', icon: '🚚', name: () => 'Camion',
    desc: () => 'Un mezzo più grande porta più cassette: più dati <em>(data)</em> per ogni agricoltore.',
    offer: normalOffer,
    effect: (lv) => `${VEHICLE_NAMES[lv]}: ${CONFIG.TRUCK_CRATES[lv]} cassette = ${CONFIG.TRUCK_CRATES[lv] * CONFIG.UNITS_PER_BOX} dati`,
  },
];

function openShop(onClose) {
  openSheet('🛒 Negozio', (body) => {
    const draw = () => {
      body.innerHTML =
        `<p class="sheet-note">Hai <b>${state.coins} 🪙</b>. Il livello <i>n</i> costa <i>n</i> monete. ` +
        'Scanner e scarico valgono subito; il mezzo nuovo arriva con il prossimo agricoltore.</p>';
      for (const it of SHOP) {
        const lv = state.levels[it.key] || 0;
        const offer = it.offer(lv);
        const secret = offer && offer.kind === 'secret';
        const box = document.createElement('div');
        box.className = 'shop-item';
        const pips = Array.from({ length: CONFIG.MAX_LEVEL }, (_, i) => `<span class="pip ${i < lv ? 'on' : ''}"></span>`).join('');
        const next = !offer ? '' : secret ? ' → <b>Una sorpresa… 🎁</b>' : ` → <b>${it.effect(offer.level)}</b>`;
        const levelText = it.levelText ? it.levelText(lv) : `Livello ${lv}/${CONFIG.MAX_LEVEL}`;
        box.innerHTML =
          `<div class="shop-top"><span class="shop-icon">${it.icon}</span><div><div class="shop-name">${it.name(lv)}</div>` +
          `<div>${levelText}${secret ? ' · <b>Livello ???</b>' : ''}</div></div></div>` +
          `<div class="pips">${pips}</div>` +
          `<div class="preview-row"><canvas class="preview" data-key="${it.key}" data-lv="${lv}" aria-hidden="true"></canvas>` +
          (!offer ? '' : `<span class="preview-arrow">➜</span><canvas class="preview" data-key="${it.key}" data-lv="${secret ? 'secret' : offer.level}" aria-hidden="true"></canvas>`) +
          '</div>' +
          `<div class="shop-desc">${it.desc(lv)}</div>` +
          `<div class="shop-effect">${it.effect(lv)}${next}</div>`;
        const btn = document.createElement('button');
        btn.className = 'btn primary';
        if (!offer) { btn.textContent = isSmartScanner(lv) && it.key === 'scanner' ? 'Livello massimo (100) ✔' : 'Livello massimo ✔'; btn.disabled = true; }
        else {
          btn.textContent = secret ? `Compra ??? · ${offer.cost} 🪙` : `Compra livello ${offer.level} · ${offer.cost} 🪙`;
          btn.disabled = state.coins < offer.cost;
          btn.addEventListener('click', () => {
            const o2 = it.offer(state.levels[it.key] || 0);
            if (!o2 || state.coins < o2.cost) return;
            state.coins -= o2.cost;
            state.levels[it.key] = o2.level;
            save();
            renderCoins(false);
            draw();
          });
        }
        box.appendChild(btn);
        body.appendChild(box);
      }
    };
    draw();
    // Animate the previews while the shop is open.
    const tick = (now) => {
      if ($('#sheet').hidden) return;
      for (const c of body.querySelectorAll('canvas.preview')) drawPreview(c, c.dataset.key, c.dataset.lv === 'secret' ? 'secret' : Number(c.dataset.lv), now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, onClose);
}

// ------------------------------------------------------------ leaderboard
function openBoard() {
  pushScore();
  openSheet('🏆 Classifica', (body) => {
    let kind = 'rich';
    const draw = async () => {
      body.innerHTML =
        '<div class="tabs" role="tablist">' +
        `<button class="btn" role="tab" data-k="rich" aria-selected="${kind === 'rich'}">Più ricchi</button>` +
        `<button class="btn" role="tab" data-k="precise" aria-selected="${kind === 'precise'}">Più precisi</button>` +
        '</div>' +
        `<p class="sheet-note">${kind === 'rich' ? 'Monete guadagnate in tutto.' : 'Monete medie per agricoltore (dopo almeno ' + CONFIG.MIN_FARMERS_FOR_PRECISION + ' agricoltori).'}</p>` +
        '<div id="board-content">…</div>';
      body.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.k; draw(); }));
      let res;
      try { res = await fetchBoard(kind); } catch (e) { res = { online: false, note: 'Classifica non raggiungibile', rows: [] }; }
      const box = body.querySelector('#board-content');
      if (!box) return;
      let html = res.note ? `<div class="banner">📡 ${res.note}. Per ora vedi solo te.</div>` : '';
      if (!res.rows.length) {
        html += kind === 'precise'
          ? `<p class="sheet-note">Servi almeno ${CONFIG.MIN_FARMERS_FOR_PRECISION} agricoltori per entrare in questa classifica.</p>`
          : '<p class="sheet-note">Servi il primo agricoltore per entrare in classifica.</p>';
      } else {
        html += '<ol class="board">' + res.rows.map((r, i) =>
          `<li class="${r.isMe ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="who">${formatName(r.name)}</span>` +
          `<span class="val">${kind === 'precise' ? fmt1(r.value) : r.value} 🪙</span></li>`).join('') + '</ol>';
      }
      box.innerHTML = html;
    };
    draw();
  });
}

// ------------------------------------------------------------ settings
function openSettings() {
  openSheet('⚙️ Impostazioni', (body) => {
    body.innerHTML =
      `<div class="settings-row">Il tuo nome nel gioco:<br><b>${formatName(state.name)}</b>` +
      '<button class="btn" id="set-name">Cambia nome</button></div>' +
      '<div class="settings-row">I progressi restano solo su questo telefono (o computer). ' +
      'Nella classifica vanno solo il nome del gioco e il punteggio: niente nome vero, niente email.</div>' +
      '<div class="settings-row">Ricomincia da zero: monete, migliorie e agricoltori serviti tornano a 0.' +
      '<button class="btn danger" id="set-reset">Ricomincia</button></div>';
    body.querySelector('#set-name').addEventListener('click', async () => {
      const nm = await pickName(true);
      if (nm) { state.name = nm; save(); pushScore(); renderMap(); closeSheet(); openSettings(); }
    });
    body.querySelector('#set-reset').addEventListener('click', async () => {
      const ok = await modal('<h2>Ricominciare?</h2><p>Perdi tutte le monete e le migliorie. Il tuo nome resta lo stesso.</p>', [
        { label: 'Sì, ricomincia', value: true, cls: 'primary' },
        { label: 'No, annulla', value: false },
      ]);
      if (!ok) return;
      const keep = { playerId: state.playerId, name: state.name };
      clearState();
      state = { ...defaultState(), ...keep };
      save();
      pushScore();
      game.reset();
      closeSheet();
      renderMap();
      toast('Si ricomincia! 🌱');
    });
  });
}

// ------------------------------------------------------------ wiring
$('#place-weigh').addEventListener('click', async () => {
  showScreen('screen-weigh');
  if (!state.seenHelp) { await showHelp(); state.seenHelp = true; save(); }
});
document.querySelectorAll('.place.locked').forEach((p) => p.addEventListener('click', () => {
  toast(`🔒 Questo posto si sblocca nella lezione ${p.dataset.lesson}.`);
}));
$('#btn-shop').addEventListener('click', () => openShop(() => renderMap()));
$('#btn-board').addEventListener('click', openBoard);
$('#btn-settings').addEventListener('click', openSettings);
$('#w-back').addEventListener('click', () => showScreen('screen-map'));
$('#w-shop').addEventListener('click', () => openShop());
$('#w-help').addEventListener('click', showHelp);

// Block pinch-zoom gestures on iOS Safari (it ignores user-scalable=no).
document.addEventListener('gesturestart', (e) => e.preventDefault());

async function boot() {
  showScreen('screen-map');
  if (!state.name) {
    state.name = await pickName(false);
    save();
    renderMap();
  }
  pushScore();
}
boot();
installDebugButton({ getState: () => state, save, renderCoins }); // TODO(Dominik): remove before the course

// Debug handle for play-testing from the browser console: open the game with ?debug
if (new URLSearchParams(location.search).has('debug')) window.fattoriaDebug = { game, getState: () => state };

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}
