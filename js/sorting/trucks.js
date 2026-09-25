// Minigame 2: what each truck's symbol shows in a given level, and its pipe colour. Pure, no DOM.
//
// Symbols are built from the items that really go into the truck in that level, so a symbol never
// shows produce that can't go in (tests/run.mjs checks this): the "mele" truck shows apples in the
// colours of that level, the scale trucks (grandi / piccole) show the level's produce on the scale,
// "lavaggio" shows a dirty item of a type that is washed there, "brutti ma buoni" a misshapen one.
import { parseItem } from './questions.js';

// Pipe tint per truck (the downpipe from each leaf to its truck), tied to the truck's symbol.
// Trucks that meet in the same level must have clearly different colours (tested).
export const PIPE_COLOUR = {
  compost: '#5E8C31',   // green bin
  lavaggio: '#4FA3D1',  // water blue
  galline: '#F2DE8C',   // cream / yellow hen
  orto: '#EE9BB5',      // flower pink
  mercato: '#E0503A',   // red awning
  brutti: '#EF9A3C',    // carrot orange
  rosse: '#D23A2A',     // red apple
  verdi: '#B5CF45',     // light green apple
  mele: '#9E3B2E',      // dark apple red
  patate: '#C9A36B',    // potato tan
  carote: '#F08A24',    // carrot orange
  pomodori: '#C0301F',  // tomato red
  pere: '#E7C84F',      // pear yellow
  grandi: '#6F7FA0',    // slate (heavy scale)
  piccole: '#B7A3D6',   // lavender (light scale)
};

// Which kind of symbol each truck has.
const KIND = {
  rosse: 'produce', verdi: 'produce', mele: 'produce', patate: 'produce', carote: 'produce', pomodori: 'produce', pere: 'produce',
  grandi: 'scale', piccole: 'scale', lavaggio: 'wash', brutti: 'odd',
  compost: 'fixed', galline: 'fixed', orto: 'fixed', mercato: 'fixed',
};
const PREFER = ['carota', 'patata', 'mela', 'pera', 'pomodoro'];
const order = (a, b) => PREFER.indexOf(a.t) - PREFER.indexOf(b.t);

// spec = { truck, kind, show: [{ t, c, big, dirty, odd }] } for the truck `id`, given the level's items.
export function truckSpec(id, levelItems) {
  const kind = KIND[id] || 'fixed';
  const routed = levelItems.filter(([, label]) => label === id).map(([str]) => parseItem(str)).filter((it) => !it.alive);
  let show = [];
  if (kind === 'produce') {
    // one sample per colour (at most 3), the plainest items first
    const seen = new Set();
    for (const it of [...routed].sort((a, b) => (+a.dirty + +a.odd + +a.rot) - (+b.dirty + +b.odd + +b.rot))) {
      if (seen.has(`${it.t}-${it.c}`) || show.length >= 3) continue;
      seen.add(`${it.t}-${it.c}`);
      show.push({ t: it.t, c: it.c, big: true });
    }
  } else if (kind === 'scale') {
    // one sample per type (at most 2)
    const types = new Map();
    for (const it of routed) if (!types.has(it.t)) types.set(it.t, it.c);
    show = [...types].sort((a, b) => PREFER.indexOf(a[0]) - PREFER.indexOf(b[0])).slice(0, 2).map(([t, c]) => ({ t, c, big: id === 'grandi' }));
  } else if (kind === 'wash') {
    const it = routed.filter((x) => x.dirty).sort(order)[0];
    if (it) show = [{ t: it.t, c: it.c, big: true, dirty: true }];
  } else if (kind === 'odd') {
    const it = routed.filter((x) => x.odd).sort(order)[0];
    if (it) show = [{ t: it.t, c: it.c, big: true, odd: true }];
  }
  return { truck: id, kind, show };
}
