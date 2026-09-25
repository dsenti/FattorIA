// Minigame 2 shop cards: sensors, lente, nastro veloce, suggerimenti. Rendered into the shared
// shop sheet by main.js (tab "Smistamento"). No emoji: icons are SVG.
import { CONFIG } from '../config.js';
import { SENSORS } from './questions.js';
import { LEVELS } from './levels.js';
import { requiredSensors } from './progress.js';
import { questionArt, ICON, svg40 } from './art.js';

const coin = () => svg40(ICON.coin, 16, 'coin-ic');

// ctx: { state, buy(cost, apply) -> bool, redraw() }
export function renderSortShop(body, ctx) {
  const s = ctx.state.sort;
  const firstLevel = (id) => LEVELS.findIndex((_, i) => requiredSensors(i).includes(id)) + 1;
  const cards = [];
  for (const sen of SENSORS) {
    const cost = CONFIG.SORT.SENSOR_COST[sen.id];
    const owned = s.sensors.includes(sen.id);
    cards.push({
      icon: questionArt(sen.q), name: `${sen.name} <em>(${sen.en})</em>`,
      desc: `${sen.desc} Aggiunge una domanda nuova ai cancelli${firstLevel(sen.id) ? `; serve dal livello ${firstLevel(sen.id)}` : ''}.`,
      owned, cost, buy: () => { s.sensors.push(sen.id); },
    });
  }
  cards.push({
    icon: ICON.lente, name: 'Lente d\'ingrandimento',
    desc: 'Dopo una prova segna chiaramente i cancelli che hanno sbagliato strada, con il numero di errori. Tocca un pezzo sbagliato: lo rivedi scendere piano piano.',
    owned: s.lente, cost: CONFIG.SORT.LENTE_COST, buy: () => { s.lente = true; },
  });
  cards.push({
    icon: ICON.fast, name: 'Nastro veloce',
    desc: 'I pezzi scendono più in fretta nell\'albero. Non cambia niente altro.',
    owned: s.fast, cost: CONFIG.SORT.FAST_COST, buy: () => { s.fast = true; },
  });
  const hc = CONFIG.SORT.hintCost(s.hintsBought);
  cards.push({
    icon: ICON.hint, name: 'Suggerimento <em>(hint)</em>',
    desc: `Mostra la domanda giusta di un cancello (lo usi toccando il cancello). Ogni suggerimento costa un po' di più. Ne hai: <b>${s.hints}</b>.`,
    owned: false, cost: hc, repeat: true, buy: () => { s.hints += 1; s.hintsBought += 1; },
  });

  body.insertAdjacentHTML('beforeend', `<p class="sheet-note">Hai <b>${ctx.state.coins}</b> ${coin()}. I sensori misurano nuove caratteristiche <em>(features)</em>: più domande per i cancelli.</p>`);
  for (const c of cards) {
    const box = document.createElement('div');
    box.className = 'shop-item';
    box.innerHTML =
      `<div class="shop-top">${svg40(c.icon, 40, 'shop-svg')}<div><div class="shop-name">${c.name}</div>` +
      `${c.owned ? '' : `<div>${c.cost} ${coin()}</div>`}</div></div>` +
      `<div class="shop-desc">${c.desc}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    if (c.owned) { btn.textContent = 'Comprato'; btn.disabled = true; }
    else {
      btn.innerHTML = `Compra · ${c.cost} ${coin()}`;
      btn.disabled = ctx.state.coins < c.cost;
      btn.addEventListener('click', () => { if (ctx.buy(c.cost, c.buy)) ctx.redraw(); });
    }
    box.appendChild(btn);
    body.appendChild(box);
  }
}
