// Minigame 2 (Lo smistamento): item features, the yes/no questions a gate can ask, and the
// sensors that unlock questions. Pure data and functions, no DOM.
//
// An item is written in levels.js as a short string of tokens, e.g. 'patata marrone grande sporco'.
//   type (first token):
//     produce:      mela, pera, patata, pomodoro, carota
//     lone animals: ape (bee), farfalla (butterfly), coccinella (ladybird), lumaca (snail), verme (worm)
//   colour:  rosso, verde, giallo, arancione, marrone   (masculine form, whatever the item)
//   flags (produce only):
//     grande   big (and therefore heavy; default small and light)
//     marcio   rotten
//     sporco   covered in soil
//     strano   misshapen (a twin carrot, a lumpy potato, a crooked pear)
//     verme    with a worm in it
//     lumaca   with a snail on it
// Lone animals are alive; produce is not (even with a worm or a snail on it).

export const PRODUCE = ['mela', 'pera', 'patata', 'pomodoro', 'carota'];
export const ANIMALS = ['ape', 'farfalla', 'coccinella', 'lumaca', 'verme'];
export const TYPES = [...PRODUCE, ...ANIMALS];
export const COLOURS = ['rosso', 'verde', 'giallo', 'arancione', 'marrone'];
const FLAGS = new Set(['grande', 'marcio', 'sporco', 'strano', 'verme', 'lumaca']);

export function parseItem(str) {
  const tok = str.trim().split(/\s+/);
  const t = tok[0];
  if (!TYPES.includes(t)) throw new Error(`unknown item type "${t}" in "${str}"`);
  const it = { t, c: null, big: false, rot: false, dirty: false, odd: false, worm: false, snail: false, alive: ANIMALS.includes(t) };
  for (const w of tok.slice(1)) {
    if (COLOURS.includes(w)) { if (it.c) throw new Error(`two colours in "${str}"`); it.c = w; continue; }
    if (!FLAGS.has(w)) throw new Error(`unknown token "${w}" in "${str}"`);
    if (it.alive) throw new Error(`a lone animal takes no flags: "${str}"`);
    if (w === 'grande') it.big = true;
    else if (w === 'marcio') it.rot = true;
    else if (w === 'sporco') it.dirty = true;
    else if (w === 'strano') it.odd = true;
    else if (w === 'verme') it.worm = true;
    else if (w === 'lumaca') it.snail = true;
  }
  if (!it.c) throw new Error(`no colour in "${str}"`);
  if (t === 'verme') it.worm = true;     // a lone worm "has a worm"
  if (t === 'lumaca') it.snail = true;   // a lone snail "is a snail"
  it.heavy = it.big;                     // big always means heavy
  return it;
}

// A stable key for an item kind (used for drawing and for "same kind" checks).
export const itemKey = (it) => `${it.t}-${it.c}-${+it.big}${+it.rot}${+it.dirty}${+it.odd}${+it.worm}${+it.snail}`;

// Sensors: each unlocks one question. Prices are in config.js (CONFIG.SORT.SENSOR_COST).
export const SENSORS = [
  { id: 'naso', name: 'Naso elettronico', en: 'electronic nose', q: 'marcio', desc: 'Annusa la frutta e la verdura e sente se sono marce.' },
  { id: 'vermi', name: 'Rilevatore di vermi', en: 'worm detector', q: 'verme', desc: 'Guarda anche dentro: trova i vermi, nei frutti e da soli.' },
  { id: 'bilancia', name: 'Bilancia', en: 'scale', q: 'pesante', desc: 'Pesa ogni pezzo: separa i grandi (pesanti) dai piccoli.' },
  { id: 'forma', name: 'Occhio delle forme', en: 'shape camera', q: 'strano', desc: 'Una telecamera che riconosce le forme strane: carote gemelle, patate bitorzolute.' },
  { id: 'vita', name: 'Sensore di vita', en: 'life sensor', q: 'vivo', desc: 'Riconosce gli animali da soli: api, farfalle, coccinelle, lumache e vermi senza frutta né verdura. Una mela con una lumaca sopra non conta.' },
];
export const SENSOR_BY_ID = Object.fromEntries(SENSORS.map((s) => [s.id, s]));

// The questions, in palette order. Colour, type, soil and snail are free (sensor: null): you can
// see them. "text" is only used for screen readers (aria-label): on screen the questions are pictures.
export const QUESTIONS = [
  { id: 'rosso', group: 'colore', sensor: null, text: 'È rosso?', f: (it) => it.c === 'rosso' },
  { id: 'verde', group: 'colore', sensor: null, text: 'È verde?', f: (it) => it.c === 'verde' },
  { id: 'giallo', group: 'colore', sensor: null, text: 'È giallo?', f: (it) => it.c === 'giallo' },
  { id: 'arancione', group: 'colore', sensor: null, text: 'È arancione?', f: (it) => it.c === 'arancione' },
  { id: 'marrone', group: 'colore', sensor: null, text: 'È marrone?', f: (it) => it.c === 'marrone' },
  { id: 'mela', group: 'tipo', sensor: null, text: 'È una mela?', f: (it) => it.t === 'mela' },
  { id: 'pera', group: 'tipo', sensor: null, text: 'È una pera?', f: (it) => it.t === 'pera' },
  { id: 'patata', group: 'tipo', sensor: null, text: 'È una patata?', f: (it) => it.t === 'patata' },
  { id: 'pomodoro', group: 'tipo', sensor: null, text: 'È un pomodoro?', f: (it) => it.t === 'pomodoro' },
  { id: 'carota', group: 'tipo', sensor: null, text: 'È una carota?', f: (it) => it.t === 'carota' },
  { id: 'sporco', group: 'sporco', sensor: null, text: 'È sporco di terra?', f: (it) => it.dirty },
  { id: 'lumaca', group: 'lumaca', sensor: null, text: 'C\'è una lumaca?', f: (it) => it.snail },
  { id: 'marcio', group: 'marcio', sensor: 'naso', text: 'È marcio?', f: (it) => it.rot },
  { id: 'verme', group: 'verme', sensor: 'vermi', text: 'C\'è un verme?', f: (it) => it.worm },
  { id: 'pesante', group: 'peso', sensor: 'bilancia', text: 'È pesante?', f: (it) => it.heavy },
  { id: 'strano', group: 'forma', sensor: 'forma', text: 'Ha una forma strana?', f: (it) => it.odd },
  // True only for lone animals; produce with a worm or a snail on it answers no.
  { id: 'vivo', group: 'vivo', sensor: 'vita', text: 'È un animale da solo?', f: (it) => it.alive },
];
export const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);

export const questionUnlocked = (qid, sensors) => {
  const s = Q[qid].sensor;
  return !s || sensors.includes(s);
};
