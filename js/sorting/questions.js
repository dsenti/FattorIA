// Minigame 2 (Lo smistamento): item features, the yes/no questions a gate can ask, and the
// sensors that unlock questions. Pure data and functions, no DOM.
//
// An item is written in levels.js as a short string of tokens, e.g. 'mela rosso grande marcio'.
//   type (first token): mela, pera, patata, pomodoro, lumaca, coccinella
//   colour:             rosso, verde, giallo, marrone   (masculine form, whatever the item)
//   flags:              grande (big; default small), pesante / leggero (default: heavy if big),
//                       marcio (rotten), verme (has a worm)
// Snails (lumaca) and ladybirds (coccinella) are alive; everything else is not.

export const TYPES = ['mela', 'pera', 'patata', 'pomodoro', 'lumaca', 'coccinella'];
export const COLOURS = ['rosso', 'verde', 'giallo', 'marrone'];
const ALIVE = new Set(['lumaca', 'coccinella']);
const FLAGS = new Set(['grande', 'piccolo', 'pesante', 'leggero', 'marcio', 'verme']);

export function parseItem(str) {
  const tok = str.trim().split(/\s+/);
  const t = tok[0];
  if (!TYPES.includes(t)) throw new Error(`unknown item type "${t}" in "${str}"`);
  let c = null, big = false, heavy = null, rot = false, worm = false;
  for (const w of tok.slice(1)) {
    if (COLOURS.includes(w)) { if (c) throw new Error(`two colours in "${str}"`); c = w; }
    else if (!FLAGS.has(w)) throw new Error(`unknown token "${w}" in "${str}"`);
    else if (w === 'grande') big = true;
    else if (w === 'piccolo') big = false;
    else if (w === 'pesante') heavy = true;
    else if (w === 'leggero') heavy = false;
    else if (w === 'marcio') rot = true;
    else if (w === 'verme') worm = true;
  }
  if (!c) throw new Error(`no colour in "${str}"`);
  return { t, c, big, heavy: heavy === null ? big : heavy, rot, worm, alive: ALIVE.has(t) };
}

// A stable key for an item kind (used for drawing and for "same kind" checks).
export const itemKey = (it) => `${it.t}-${it.c}-${+it.big}${+it.heavy}${+it.rot}${+it.worm}`;

// Sensors: each unlocks one question. Prices are in config.js (CONFIG.SORT.SENSOR_COST).
export const SENSORS = [
  { id: 'naso', name: 'Naso elettronico', en: 'electronic nose', q: 'marcio', desc: 'Annusa la frutta e sente se è marcia.' },
  { id: 'vermi', name: 'Rilevatore di vermi', en: 'worm detector', q: 'verme', desc: 'Guarda dentro il frutto e trova i vermi.' },
  { id: 'calibro', name: 'Calibro', en: 'size gauge', q: 'grande', desc: 'Misura la grandezza di ogni pezzo.' },
  { id: 'bilancia', name: 'Bilancia', en: 'scale', q: 'pesante', desc: 'Pesa ogni pezzo: grande non vuol dire sempre pesante.' },
  { id: 'vita', name: 'Sensore di vita', en: 'life sensor', q: 'vivo', desc: 'Sente il battito: capisce se qualcosa è vivo.' },
];
export const SENSOR_BY_ID = Object.fromEntries(SENSORS.map((s) => [s.id, s]));

// The questions, in palette order. Colour and type are free (sensor: null).
// "text" is only used for screen readers (aria-label): on screen the questions are pictures.
export const QUESTIONS = [
  { id: 'rosso', group: 'colore', sensor: null, text: 'È rosso?', f: (it) => it.c === 'rosso' },
  { id: 'verde', group: 'colore', sensor: null, text: 'È verde?', f: (it) => it.c === 'verde' },
  { id: 'giallo', group: 'colore', sensor: null, text: 'È giallo?', f: (it) => it.c === 'giallo' },
  { id: 'marrone', group: 'colore', sensor: null, text: 'È marrone?', f: (it) => it.c === 'marrone' },
  { id: 'mela', group: 'tipo', sensor: null, text: 'È una mela?', f: (it) => it.t === 'mela' },
  { id: 'pera', group: 'tipo', sensor: null, text: 'È una pera?', f: (it) => it.t === 'pera' },
  { id: 'patata', group: 'tipo', sensor: null, text: 'È una patata?', f: (it) => it.t === 'patata' },
  { id: 'pomodoro', group: 'tipo', sensor: null, text: 'È un pomodoro?', f: (it) => it.t === 'pomodoro' },
  { id: 'grande', group: 'grandezza', sensor: 'calibro', text: 'È grande?', f: (it) => it.big },
  { id: 'pesante', group: 'peso', sensor: 'bilancia', text: 'È pesante?', f: (it) => it.heavy },
  { id: 'marcio', group: 'marcio', sensor: 'naso', text: 'È marcio?', f: (it) => it.rot },
  { id: 'verme', group: 'verme', sensor: 'vermi', text: 'Ha un verme?', f: (it) => it.worm },
  { id: 'vivo', group: 'vivo', sensor: 'vita', text: 'È vivo?', f: (it) => it.alive },
];
export const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);

export const questionUnlocked = (qid, sensors) => {
  const s = Q[qid].sensor;
  return !s || sensors.includes(s);
};
