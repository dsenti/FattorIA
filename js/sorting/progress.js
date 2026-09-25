// Minigame 2: which levels are open, which sensors a level needs. Pure functions.
import { LEVELS } from './levels.js';
import { Q } from './questions.js';
import { compile, solutionOf } from './tree.js';

export const COMPILED = LEVELS.map((lv) => compile(lv.tree));

// Sensors needed by a level = the sensors of the questions in its solution.
export function requiredSensors(i) {
  const s = new Set();
  for (const q of solutionOf(COMPILED[i])) if (Q[q].sensor) s.add(Q[q].sensor);
  return [...s];
}

// { solved, open (previous level solved), missing: [sensor ids not bought], playable }
export function levelStatus(sort, i) {
  const solved = sort.solved.includes(LEVELS[i].id);
  const open = i === 0 || sort.solved.includes(LEVELS[i - 1].id) || solved;
  const missing = requiredSensors(i).filter((s) => !sort.sensors.includes(s));
  return { solved, open, missing, playable: open && missing.length === 0 };
}

// The level to show when entering: the saved one if it is open, else the first open unsolved one.
export function startLevel(sort) {
  const saved = LEVELS.findIndex((lv) => lv.id === sort.current);
  if (saved >= 0 && levelStatus(sort, saved).open) return saved;
  for (let i = 0; i < LEVELS.length; i++) {
    const st = levelStatus(sort, i);
    if (st.open && !st.solved) return i;
  }
  return 0;
}

export const hintCost = (sort, cfg) => cfg.SORT.hintCost(sort.hintsBought);
