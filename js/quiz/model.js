// Minigame "La piazza": pure model. Draw the 10 cards of a round (5 AI, 5 not AI, the round's own
// level first), score the answers, stars and coins.
import { CONFIG } from '../config.js';
import { CARDS, ROUNDS } from './cards.js';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function shuffle(list, r) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 10 cards: 5 AI and 5 not AI. From each side, cards of the round's first level come first (in a
// random order), then the next level fills up.
export function drawRound(ri, seed = 1, per = CONFIG.QUIZ.CARDS / 2) {
  const r = rng(seed * 2654435761 + ri * 97);
  const round = ROUNDS[ri];
  const pick = (ai) => {
    let out = [];
    for (const lv of round.levels) out = out.concat(shuffle(CARDS.filter((c) => c.ai === ai && c.lvl === lv), r));
    return out.slice(0, per);
  };
  return shuffle([...pick(true), ...pick(false)], r);
}

// answers: true (said AI), false (said not AI) or null (time ran out)
export function score(cards, answers) {
  let right = 0, streak = 0, best = 0;
  cards.forEach((c, i) => {
    if (answers[i] === c.ai) { right += 1; streak += 1; best = Math.max(best, streak); } else streak = 0;
  });
  return { right, best };
}

export const starsFor = (right, n = CONFIG.QUIZ.CARDS) => (right >= n ? 3 : right >= n - 2 ? 2 : right >= CONFIG.QUIZ.PASS ? 1 : 0);

export function payFor(right, replay) {
  if (right < CONFIG.QUIZ.PASS) return 0;
  return replay ? Math.round(right * CONFIG.QUIZ.REPLAY_FACTOR) : right;
}

export function levelOpen(st, i, levels) {
  return i === 0 || st.passed.includes(levels[i - 1].id) || st.passed.includes(levels[i].id);
}
