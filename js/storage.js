// Progress saved in the browser only (localStorage). No accounts, no personal data.
import { CONFIG } from './config.js';
import { isValidName } from './names.js';
import { LEVELS, LEVELS_VERSION } from './sorting/levels.js';
import { SENSORS, QUESTION_IDS } from './sorting/questions.js';
import { compile } from './sorting/tree.js';
import { LAB_LEVELS, LAB_LEVELS_VERSION } from './lab/levels.js';
import { compileLab } from './lab/model.js';

const MAX_HISTORY = 50;

function newPlayerId() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* not a secure context */ }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function defaultState() {
  return {
    version: 1,
    playerId: newPlayerId(),
    name: null,            // { e, n, a, num } indices, see names.js
    coins: 0,              // coins in the wallet
    totalEarned: 0,        // all coins ever earned (leaderboard "Più ricchi")
    farmersServed: 0,      // number of finished rounds
    levels: { scanner: 0, belt: 0, truck: 0 },   // scanner 0..10, or 100 (secret level)
    day: 1,
    dayFarmers: 0,
    dayCoins: 0,
    fits: [],              // last rounds: { f: farmer id, c: coins, r: error ratio }
    seenHelp: false,       // "how to play" shown once
    seenFlip: false,       // "axis reversed" warning shown once
    lineMode: 'sliders',   // how the line is moved: 'sliders' or 'drag' (a setting; kept on restart)
    sort: defaultSort(),   // minigame 2 (Lo smistamento)
    lab: defaultLab(),     // minigame 3 (Il laboratorio)
  };
}

// Minigame 2 progress. Old saves without it get this.
export function defaultSort() {
  return {
    levelsVersion: LEVELS_VERSION,  // saved progress belongs to this version of the levels
    unlocked: false,       // the place was bought on the map
    solved: [],            // level ids delivered at least once (first delivery paid in full)
    current: null,         // level id being played
    sensors: [],           // bought sensor ids (see sorting/questions.js)
    hints: 0,              // hints in stock
    hintsBought: 0,        // hints bought so far (the price rises)
    lente: false,          // magnifying glass bought
    fast: false,           // nastro veloce bought
    boards: {},            // level id -> the question on each gate (null = empty)
    hinted: {},            // level id -> gate indices revealed by a hint
    fails: {},             // level id -> failed Provas since it was last solved (3 -> wrong gates marked)
    seenHelp: false,
  };
}

// Minigame 3 progress. Old saves without it get this.
export function defaultLab() {
  return {
    levelsVersion: LAB_LEVELS_VERSION,  // saved progress belongs to this version of the levels
    unlocked: false,       // the place was bought on the map
    passed: [],            // level ids passed at least once (a Prova paid >= CONFIG.LAB.PASS_COINS)
    current: null,         // level id being played
    boards: {},            // level id -> { nodes: [spec or null], best: coins (record of this tree), replay }
    hinted: {},            // level id -> node indices shown by a hint
    hints: 0,              // hints in stock
    hintsBought: 0,        // hints bought so far (the price rises)
    samples: 0,            // "Più campioni" level 0..10
    precision: 0,          // "Strumento più preciso" level 0..10
    seenHelp: false,
    seenOverfit: false,    // the "imparare a memoria" toast was shown once
  };
}

const LAB_NODES = new Map(LAB_LEVELS.map((lv) => [lv.id, compileLab(lv.tree).nodes.length]));
const LAB_CLASSES = new Map(LAB_LEVELS.map((lv) => [lv.id, lv.classes.length]));

// A node spec from a save, or null if it is not valid for a level with K classes.
function cleanSpec(s, K) {
  if (!s || typeof s !== 'object') return null;
  const u = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
  if (![s.x1, s.y1, s.x2, s.y2].every(u)) return null;
  if (!Array.isArray(s.c) || s.c.length !== 2) return null;
  if (!s.c.every((c) => Number.isInteger(c) && c >= 0 && c < K) || s.c[0] === s.c[1]) return null;
  if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 0.01) return null;
  return { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, c: [s.c[0], s.c[1]], flip: s.flip === true };
}

// Returns the cleaned minigame 3 progress. If the save is from an older version of the levels,
// the level progress (passed, boards, hints on nodes) starts over, but the place, the upgrades
// and the hints in stock stay.
export function sanitizeLab(raw) {
  const d = defaultLab();
  if (!raw || typeof raw !== 'object') return d;
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  const lvl = (v) => Math.max(0, Math.min(CONFIG.MAX_LEVEL, n(v)));
  const same = raw.levelsVersion === LAB_LEVELS_VERSION;
  const boards = {}, hinted = {};
  if (same) {
    for (const [id, N] of LAB_NODES) {
      const b = raw.boards && raw.boards[id];
      if (b && Array.isArray(b.nodes) && b.nodes.length === N) {
        boards[id] = {
          nodes: b.nodes.map((s) => cleanSpec(s, LAB_CLASSES.get(id))),
          best: Math.min(CONFIG.MAX_PAY, n(b.best)),
          replay: b.replay === true,
        };
      }
      const h = raw.hinted && raw.hinted[id];
      if (Array.isArray(h)) hinted[id] = [...new Set(h.filter((i) => Number.isInteger(i) && i >= 0 && i < N))];
    }
  }
  return {
    levelsVersion: LAB_LEVELS_VERSION,
    unlocked: raw.unlocked === true,
    passed: same && Array.isArray(raw.passed) ? [...new Set(raw.passed.filter((id) => LAB_NODES.has(id)))] : [],
    current: same && LAB_NODES.has(raw.current) ? raw.current : null,
    boards,
    hinted,
    hints: n(raw.hints),
    hintsBought: n(raw.hintsBought),
    samples: lvl(raw.samples),
    precision: lvl(raw.precision),
    seenHelp: raw.seenHelp === true,
    seenOverfit: raw.seenOverfit === true,
  };
}

const LEVEL_GATES = new Map(LEVELS.map((lv) => [lv.id, compile(lv.tree).gates.length]));
const SENSOR_IDS = new Set(SENSORS.map((x) => x.id));
const QIDS = new Set(QUESTION_IDS);

// Returns the cleaned minigame 2 progress. If the save is from an older version of the levels,
// the level progress (solved, boards, hints on gates) starts over, but the place, bought sensors,
// hints in stock, lente and nastro stay. `refund` gets coins back for removed sensors.
export function sanitizeSort(raw, refund = () => {}) {
  const d = defaultSort();
  if (!raw || typeof raw !== 'object') return d;
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  const sameLevels = raw.levelsVersion === LEVELS_VERSION;
  const boards = {}, hinted = {}, fails = {};
  if (sameLevels) {
    for (const [id, G] of LEVEL_GATES) {
      const b = raw.boards && raw.boards[id];
      if (Array.isArray(b) && b.length === G) boards[id] = b.map((q) => (QIDS.has(q) ? q : null));
      const h = raw.hinted && raw.hinted[id];
      if (Array.isArray(h)) hinted[id] = [...new Set(h.filter((i) => Number.isInteger(i) && i >= 0 && i < G))];
      const f = raw.fails && raw.fails[id];
      if (Number.isInteger(f) && f > 0) fails[id] = Math.min(f, 999);
    }
  }
  const rawSensors = Array.isArray(raw.sensors) ? raw.sensors : [];
  if (rawSensors.includes('calibro')) refund(CONFIG.SORT.CALIBRO_REFUND);
  return {
    levelsVersion: LEVELS_VERSION,
    unlocked: raw.unlocked === true,
    solved: sameLevels && Array.isArray(raw.solved) ? [...new Set(raw.solved.filter((id) => LEVEL_GATES.has(id)))] : [],
    current: sameLevels && LEVEL_GATES.has(raw.current) ? raw.current : null,
    sensors: [...new Set(rawSensors.filter((id) => SENSOR_IDS.has(id)))],
    hints: n(raw.hints),
    hintsBought: n(raw.hintsBought),
    lente: raw.lente === true,
    fast: raw.fast === true,
    boards,
    hinted,
    fails,
    seenHelp: raw.seenHelp === true,
  };
}

function clampLevel(v) {
  const n = Number.isInteger(v) ? v : 0;
  return Math.max(0, Math.min(CONFIG.MAX_LEVEL, n));
}

export function sanitize(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const num = (v, def) => (Number.isFinite(v) && v >= 0 ? v : def);
  let refund = 0;   // coins back for removed sensors (the calibro)
  const sort = sanitizeSort(raw.sort, (c) => { refund += c; });
  return {
    version: 1,
    playerId: typeof raw.playerId === 'string' && raw.playerId.length >= 32 ? raw.playerId : d.playerId,
    name: isValidName(raw.name) ? raw.name : null,
    coins: num(raw.coins, 0) + refund,
    totalEarned: num(raw.totalEarned, 0),
    farmersServed: num(raw.farmersServed, 0),
    levels: {
      // Secret level 100. Old saves that had the "Adattatore automatico" (levels.fitter) get it too.
      scanner: raw.levels?.scanner === CONFIG.SECRET_SCANNER_LEVEL || raw.levels?.fitter === 1 || raw.levels?.fitter === true
        ? CONFIG.SECRET_SCANNER_LEVEL : clampLevel(raw.levels?.scanner),
      belt: clampLevel(raw.levels?.belt),
      truck: clampLevel(raw.levels?.truck),
    },
    day: Math.max(1, num(raw.day, 1)),
    dayFarmers: num(raw.dayFarmers, 0),
    dayCoins: num(raw.dayCoins, 0),
    fits: Array.isArray(raw.fits) ? raw.fits.slice(-MAX_HISTORY) : [],
    seenHelp: raw.seenHelp === true,
    seenFlip: raw.seenFlip === true,
    lineMode: raw.lineMode === 'drag' ? 'drag' : 'sliders',
    sort,
    lab: sanitizeLab(raw.lab),
  };
}

export function loadState() {
  try {
    const txt = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!txt) return defaultState();
    return sanitize(JSON.parse(txt));
  } catch (e) {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    state.fits = state.fits.slice(-MAX_HISTORY);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false; // private mode or storage full: the game still works for this session
  }
}

export function clearState() {
  try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (e) { /* ignore */ }
}

export function averageCoins(state) {
  return state.farmersServed > 0 ? state.totalEarned / state.farmersServed : 0;
}
