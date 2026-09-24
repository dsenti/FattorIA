// Leaderboard names: emoji + noun + adjective + 2-digit number, picked from curated lists.
// Names are stored (locally and online) ONLY as list indices, never as text.
// IMPORTANT: never reorder or delete entries once the online leaderboard is live
// (stored indices would change meaning). Append new entries at the end only, and
// update the range checks in SUPABASE_SETUP.md.
//
// Curation rules: nouns are farm animals, crops and tools; adjectives are positive or funny.
// Words with a common insulting or double meaning in Italian slang are deliberately left out
// (e.g. vacca, maiale, asino, oca, capra, pollo, gallina, coniglio, patata, cetriolo, fico,
// pera, uccello, passera, carciofo, bufala). Every noun works with every adjective.

export const EMOJIS = [
  '🐄', '🐓', '🐝', '🐞', '🦊', '🐺', '🐴', '🐿️', '🌰', '🍎',
  '🥕', '🍇', '🎃', '🫒', '🌻', '🌾', '🚜', '🍓', '🦉', '🌽',
];

// g: 'm' (maschile) or 'f' (femminile)
export const NOUNS = [
  { w: 'Mucca', g: 'f' },
  { w: 'Carota', g: 'f' },
  { w: 'Castagna', g: 'f' },
  { w: 'Oliva', g: 'f' },
  { w: 'Ape', g: 'f' },
  { w: 'Coccinella', g: 'f' },
  { w: 'Rondine', g: 'f' },
  { w: 'Aquila', g: 'f' },
  { w: 'Volpe', g: 'f' },
  { w: 'Nocciola', g: 'f' },
  { w: 'Spiga', g: 'f' },
  { w: 'Fragola', g: 'f' },
  { w: 'Vanga', g: 'f' },
  { w: 'Carriola', g: 'f' },
  { w: 'Mela', g: 'f' },
  { w: 'Lucciola', g: 'f' },
  { w: 'Ghianda', g: 'f' },
  { w: 'Trattore', g: 'm' },
  { w: 'Girasole', g: 'm' },
  { w: 'Pomodoro', g: 'm' },
  { w: 'Lupo', g: 'm' },
  { w: 'Falco', g: 'm' },
  { w: 'Cavallo', g: 'm' },
  { w: 'Toro', g: 'm' },
  { w: 'Riccio', g: 'm' },
  { w: 'Scoiattolo', g: 'm' },
  { w: 'Capriolo', g: 'm' },
  { w: 'Grappolo', g: 'm' },
  { w: 'Ulivo', g: 'm' },
  { w: 'Rastrello', g: 'm' },
  { w: 'Fagiolo', g: 'm' },
  { w: 'Basilico', g: 'm' },
  { w: 'Castagno', g: 'm' },
  { w: 'Mirtillo', g: 'm' },
  { w: 'Aratro', g: 'm' },
  { w: 'Covone', g: 'm' },
];

// [maschile, femminile]
export const ADJECTIVES = [
  ['Coraggioso', 'Coraggiosa'],
  ['Veloce', 'Veloce'],
  ['Saggio', 'Saggia'],
  ['Allegro', 'Allegra'],
  ['Curioso', 'Curiosa'],
  ['Gentile', 'Gentile'],
  ['Brillante', 'Brillante'],
  ['Instancabile', 'Instancabile'],
  ['Astuto', 'Astuta'],
  ['Tranquillo', 'Tranquilla'],
  ['Luminoso', 'Luminosa'],
  ['Fortunato', 'Fortunata'],
  ['Paziente', 'Paziente'],
  ['Elegante', 'Elegante'],
  ['Geniale', 'Geniale'],
  ['Audace', 'Audace'],
  ['Vivace', 'Vivace'],
  ['Sorridente', 'Sorridente'],
  ['Leggendario', 'Leggendaria'],
  ['Magnifico', 'Magnifica'],
  ['Preciso', 'Precisa'],
  ['Generoso', 'Generosa'],
  ['Canterino', 'Canterina'],
  ['Ballerino', 'Ballerina'],
  ['Cosmico', 'Cosmica'],
  ['Supersonico', 'Supersonica'],
  ['Epico', 'Epica'],
  ['Misterioso', 'Misteriosa'],
  ['Intrepido', 'Intrepida'],
  ['Sereno', 'Serena'],
  ['Energico', 'Energica'],
  ['Sognatore', 'Sognatrice'],
  ['Rapido', 'Rapida'],
  ['Volante', 'Volante'],
  ['Ottimista', 'Ottimista'],
  ['Sapiente', 'Sapiente'],
];

export const NUMBER_MIN = 10;
export const NUMBER_MAX = 99;

const randInt = (n) => Math.floor(Math.random() * n);

export function randomName() {
  return {
    e: randInt(EMOJIS.length),
    n: randInt(NOUNS.length),
    a: randInt(ADJECTIVES.length),
    num: NUMBER_MIN + randInt(NUMBER_MAX - NUMBER_MIN + 1),
  };
}

// Three distinct names (different nouns) to choose from.
export function nameChoices(count = 3) {
  const out = [];
  const usedNouns = new Set();
  while (out.length < count) {
    const nm = randomName();
    if (usedNouns.has(nm.n)) continue;
    usedNouns.add(nm.n);
    out.push(nm);
  }
  return out;
}

export function isValidName(nm) {
  return !!nm &&
    Number.isInteger(nm.e) && nm.e >= 0 && nm.e < EMOJIS.length &&
    Number.isInteger(nm.n) && nm.n >= 0 && nm.n < NOUNS.length &&
    Number.isInteger(nm.a) && nm.a >= 0 && nm.a < ADJECTIVES.length &&
    Number.isInteger(nm.num) && nm.num >= NUMBER_MIN && nm.num <= NUMBER_MAX;
}

export function formatName(nm) {
  if (!isValidName(nm)) return '';
  const noun = NOUNS[nm.n];
  const adj = ADJECTIVES[nm.a][noun.g === 'f' ? 1 : 0];
  return `${EMOJIS[nm.e]} ${noun.w} ${adj} ${nm.num}`;
}
