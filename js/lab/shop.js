// Minigame 3 shop cards: Più campioni, Strumento più preciso, Suggerimento. Rendered into the
// shared shop sheet by main.js (tab "Laboratorio"). No emoji: icons are SVG.
import { CONFIG } from '../config.js';
import { ICON, svg40 } from '../sorting/art.js';
import { LAB_ICON } from './draw.js';

const coin = () => svg40(ICON.coin, 16, 'coin-ic');
const noisePct = (lv) => `${Math.round(CONFIG.LAB.NOISE_FACTOR[lv] * 100)}%`;

// ctx: { state, buy(cost, apply) -> bool, redraw() }
export function renderLabShop(body, ctx) {
  const lab = ctx.state.lab;
  const max = CONFIG.MAX_LEVEL;
  const tracks = [
    {
      key: 'samples', icon: LAB_ICON.samples, name: 'Più campioni',
      desc: 'Più campioni di addestramento <em>(training)</em> in ogni livello: più dati <em>(data)</em>, confini più sicuri.',
      effect: (lv) => `${CONFIG.LAB.SAMPLES[lv]} campioni`,
    },
    {
      key: 'precision', icon: LAB_ICON.precision, name: 'Strumento più preciso',
      desc: 'Misure con meno rumore: i colori si mescolano meno lungo i confini. Vale per l\'addestramento e per il test.',
      effect: (lv) => `rumore ${noisePct(lv)}`,
    },
  ];
  body.insertAdjacentHTML('beforeend', `<p class="sheet-note">Hai <b>${ctx.state.coins}</b> ${coin()}. Le migliorie valgono subito: arrivano campioni nuovi, il tuo albero resta.</p>`);
  for (const t of tracks) {
    const lv = lab[t.key];
    const next = lv < max ? lv + 1 : null;
    const cost = next ? CONFIG.LAB.upgradeCost(next) : 0;
    const box = document.createElement('div');
    box.className = 'shop-item';
    const pips = Array.from({ length: max }, (_, i) => `<span class="pip ${i < lv ? 'on' : ''}"></span>`).join('');
    box.innerHTML =
      `<div class="shop-top">${svg40(t.icon, 40, 'shop-svg')}<div><div class="shop-name">${t.name}</div><div>Livello ${lv}/${max}</div></div></div>` +
      `<div class="pips">${pips}</div>` +
      `<div class="shop-desc">${t.desc}</div>` +
      `<div class="shop-effect">${t.effect(lv)}${next ? ` → <b>${t.effect(next)}</b>` : ''}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    if (!next) { btn.textContent = 'Livello massimo'; btn.disabled = true; }
    else {
      btn.innerHTML = `Compra livello ${next} · ${cost} ${coin()}`;
      btn.disabled = ctx.state.coins < cost;
      btn.addEventListener('click', () => { if (lab[t.key] === lv && ctx.buy(cost, () => { lab[t.key] = next; })) ctx.redraw(); });
    }
    box.appendChild(btn);
    body.appendChild(box);
  }
  const hc = CONFIG.LAB.hintCost(lab.hintsBought);
  const box = document.createElement('div');
  box.className = 'shop-item';
  box.innerHTML =
    `<div class="shop-top">${svg40(ICON.hint, 40, 'shop-svg')}<div><div class="shop-name">Suggerimento <em>(hint)</em></div><div>${hc} ${coin()}</div></div></div>` +
    `<div class="shop-desc">In un livello mostra più o meno dove passano i confini veri (lo usi in un nodo). Ogni suggerimento costa un po' di più. Ne hai: <b>${lab.hints}</b>.</div>`;
  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.innerHTML = `Compra · ${hc} ${coin()}`;
  btn.disabled = ctx.state.coins < hc;
  btn.addEventListener('click', () => { if (ctx.buy(hc, () => { lab.hints += 1; lab.hintsBought += 1; })) ctx.redraw(); });
  box.appendChild(btn);
  body.appendChild(box);
}
