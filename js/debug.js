// TEMPORARY debug helper for play-testing: a "+100" button on the weighing station and on Lo smistamento that adds
// 100 coins to the wallet. These coins do NOT count as earned (no effect on the leaderboard:
// total earned and average per farmer stay the same).
// TODO(Dominik): remove before the course. To remove: delete this file, the import and the
// installDebugButton() call in main.js, and DEBUG_COINS_BUTTON in config.js.
import { CONFIG } from './config.js';

export function installDebugButton({ getState, save, renderCoins }) {
  if (!CONFIG.DEBUG_COINS_BUTTON) return;
  // Minigame 1 keeps its bug emoji; minigame 2 uses no emoji at all.
  for (const [sel, label] of [['#screen-weigh .topbar', '🐞 +100'], ['#screen-sort .topbar', 'DEBUG +100']]) {
    const bar = document.querySelector(sel);
    const coins = bar && bar.querySelector('.coins');
    if (!coins) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'debug-coins';
    b.textContent = label;
    b.title = 'Debug: +100 monete (non contano per la classifica)';
    b.style.cssText = 'flex:none;min-height:36px;padding:0 6px;margin-right:2px;white-space:nowrap;' +
      'border:2px dashed #D9502B;border-radius:10px;background:#FBF7EF;color:#D9502B;font:700 12px system-ui,sans-serif;';
    b.addEventListener('click', () => {
      const st = getState();
      st.coins += 100;   // wallet only, never totalEarned
      save();
      renderCoins(false);
    });
    bar.insertBefore(b, coins);   // in the top bar, left of the coin counter
  }
}
