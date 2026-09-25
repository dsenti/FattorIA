// Minigame 2: all drawings as inline SVG strings in the course palette (no emoji).
// Items, question icons and truck symbols are drawn in a 40 x 40 box.
import { itemKey } from './questions.js';

export const P = {
  soil: '#5B3A29', olive: '#6B7F2A', wheat: '#E9D8A6', cream: '#FBF7EF', tomato: '#D9502B', sky: '#4A8FA3',
  ink: '#3A2519', leaf: '#6B7F2A', worm: '#E58E78', gold: '#F4C95D',
};

// Fill colours per item type and colour token (shades of the palette).
const FILL = {
  mela: { rosso: '#D9502B', verde: '#9DB23E', giallo: '#E9BE4C', marrone: '#9C6B43' },
  pera: { rosso: '#C9573A', verde: '#A9B94A', giallo: '#E4C455', marrone: '#A97B4B' },
  patata: { rosso: '#B5503E', verde: '#98A45A', giallo: '#DDBE72', marrone: '#B08556' },
  pomodoro: { rosso: '#DB4A2A', verde: '#86A33A', giallo: '#EAB83E', marrone: '#8F5A3A' },
  lumaca: { rosso: '#C9573A', verde: '#8FA53A', giallo: '#E2B84E', marrone: '#9C6B43' },
  coccinella: { rosso: '#D9402B', verde: '#8FA53A', giallo: '#E9B949', marrone: '#8F5A3A' },
};
export const DROP = { rosso: '#D9502B', verde: '#8FA53A', giallo: '#E9B949', marrone: '#8C5E3C' };

const SHAPE = {
  mela: 'M20 11C24 7 33 8 34 18C35 28 28 36 20 34C12 36 5 28 6 18C7 8 16 7 20 11Z',
  pera: 'M20 7C24 7 25 12 25 15C26 19 32 22 32 28C32 34 26 37 20 37C14 37 8 34 8 28C8 22 14 19 15 15C15 12 16 7 20 7Z',
  patata: 'M6 21C5 13 13 9 22 10C31 11 36 16 35 23C34 30 26 33 17 32C10 31 6 27 6 21Z',
  pomodoro: 'M20 12C29 11 35 16 35 23C35 31 28 35 20 35C12 35 5 31 5 23C5 16 11 11 20 12Z',
};
const S = `stroke="${P.soil}" stroke-width="1.5" stroke-linejoin="round"`;

function body(it, fill) {
  switch (it.t) {
    case 'mela': return `<path d="${SHAPE.mela}" fill="${fill}" ${S}/><path d="M20 11Q20 6 22 3" fill="none" stroke="${P.soil}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M21 7Q27 2 31 5Q26 9 21 7Z" fill="${P.leaf}"/><ellipse cx="13" cy="19" rx="2.6" ry="5" fill="#fff" opacity=".3"/>`;
    case 'pera': return `<path d="${SHAPE.pera}" fill="${fill}" ${S}/><path d="M20 7Q20 4 22 2" fill="none" stroke="${P.soil}" stroke-width="2" stroke-linecap="round"/>` +
      `<ellipse cx="14" cy="27" rx="2.4" ry="4.5" fill="#fff" opacity=".3"/>`;
    case 'patata': return `<path d="${SHAPE.patata}" fill="${fill}" ${S}/>` +
      `<g fill="none" stroke="${P.soil}" stroke-width="1.3" stroke-linecap="round" opacity=".55"><path d="M13 17q2 1 3 0M25 15q2 1 3 0M21 26q2 1 3 0M11 25q1 1 2 0"/></g>`;
    case 'pomodoro': return `<path d="${SHAPE.pomodoro}" fill="${fill}" ${S}/>` +
      '<path d="M20 14L15 10L19 11L20 6L22 11L27 9L23 14L28 16L21 15L17 18L18 14Z" fill="#5E7D2A" stroke="#4B6420" stroke-width=".8" stroke-linejoin="round"/>' +
      '<ellipse cx="12" cy="22" rx="2.4" ry="4" fill="#fff" opacity=".3"/>';
    case 'lumaca': return `<path d="M3 34C3 30 9 29 15 29L33 29C37 29 38 33 35 34Z" fill="#D8C9A3" ${S}/>` +
      `<path d="M33 29L35 20M30 29L29 21" stroke="${P.soil}" stroke-width="1.5" stroke-linecap="round"/><circle cx="35" cy="20" r="1.8" fill="${P.soil}"/><circle cx="29" cy="21" r="1.8" fill="${P.soil}"/>` +
      `<circle cx="19" cy="20" r="11" fill="${fill}" ${S}/><path d="M19 20m0-6a6 6 0 1 1-6 6a4 4 0 1 1 4 4a2 2 0 1 1-2-2" fill="none" stroke="${P.soil}" stroke-width="1.4"/>`;
    case 'coccinella': return `<g stroke="${P.ink}" stroke-width="1.6" stroke-linecap="round"><path d="M14 30l-3 4M21 32v4M28 30l3 4M14 16l-3-4M28 16l3-4M8 20l-4-5M8 20l-5 0"/></g>` +
      `<circle cx="9" cy="22" r="5" fill="${P.ink}"/><circle cx="22" cy="23" r="12" fill="${fill}" ${S}/><path d="M11 23H34" stroke="${P.ink}" stroke-width="1.4"/>` +
      `<g fill="${P.ink}"><circle cx="17" cy="17" r="2.4"/><circle cx="27" cy="17" r="2.4"/><circle cx="17" cy="29" r="2.2"/><circle cx="27" cy="29" r="2.2"/><circle cx="22" cy="12.8" r="1.6"/></g>`;
    default: return '';
  }
}

// One item kind drawn in a 40 x 40 box. Small items are scaled down around the centre.
export function itemArt(it) {
  const fill = (FILL[it.t] || FILL.mela)[it.c];
  let s = body(it, fill);
  const shape = SHAPE[it.t];
  if (it.big && !it.heavy && shape) {
    // big but light: dried out, wrinkled
    s += `<g fill="none" stroke="${P.soil}" stroke-width="1.2" stroke-linecap="round" opacity=".55"><path d="M13 16q3 3 0 6M24 14q3 4 0 8M16 27q4 2 8 0M27 25q2 2 5 1"/></g>`;
  }
  if (it.rot && shape) {
    s += `<path d="${shape}" fill="${P.soil}" opacity=".2"/><g fill="${P.soil}" opacity=".85"><circle cx="24" cy="23" r="4.2"/><circle cx="14" cy="27" r="2.8"/><circle cx="17" cy="18" r="2"/><circle cx="28" cy="30" r="1.6"/></g>`;
  }
  if (it.worm && shape) {
    s += `<circle cx="27" cy="21" r="2.8" fill="${P.ink}"/><path d="M27 21C31 17 33 22 36 18" fill="none" stroke="${P.worm}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<circle cx="36.3" cy="17.6" r="2.3" fill="${P.worm}"/><circle cx="37" cy="17" r=".7" fill="${P.ink}"/>`;
  }
  return it.big ? s : `<g transform="translate(20 21) scale(.72) translate(-20 -21)">${s}</g>`;
}

// ------------------------------------------------------------------ question icons
const drop = (c) => `<path d="M20 5C26 14 31 20 31 26A11 11 0 0 1 9 26C9 20 14 14 20 5Z" fill="${DROP[c]}" ${S}/><ellipse cx="15.5" cy="26" rx="2" ry="3.5" fill="#fff" opacity=".35"/>`;
const silhouette = (t) => {
  if (t === 'mela') return `<path d="${SHAPE.mela}" fill="${P.soil}"/><path d="M20 11Q20 6 22 3" fill="none" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/><path d="M21 7Q27 2 31 5Q26 9 21 7Z" fill="${P.soil}"/>`;
  if (t === 'pera') return `<path d="${SHAPE.pera}" fill="${P.soil}"/><path d="M20 7Q20 4 22 2" fill="none" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/>`;
  if (t === 'patata') return `<path d="${SHAPE.patata}" fill="${P.soil}"/><g fill="none" stroke="${P.cream}" stroke-width="1.3" stroke-linecap="round" opacity=".6"><path d="M13 17q2 1 3 0M25 15q2 1 3 0M21 26q2 1 3 0"/></g>`;
  if (t === 'pomodoro') return `<path d="${SHAPE.pomodoro}" fill="${P.soil}"/><path d="M20 14L15 10L19 11L20 6L22 11L27 9L23 14L28 16L21 15L17 18L18 14Z" fill="${P.cream}" opacity=".75"/>`;
  return '';
};
const QICON = {
  grande: `<circle cx="9" cy="25" r="4" fill="${P.wheat}" ${S}/><circle cx="27" cy="21" r="10.5" fill="${P.wheat}" ${S}/>` +
    `<path d="M13.5 25H19M16.5 22.5L19 25L16.5 27.5" fill="none" stroke="${P.tomato}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  pesante: `<path d="M20 9V33M12 35H28" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/><path d="M6 20L34 11" stroke="${P.soil}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M6 20L3 28H11ZM34 11L31 19H37Z" fill="${P.wheat}" ${S}/><rect x="3.5" y="21" width="7" height="6.5" rx="1" fill="${P.soil}"/><circle cx="20" cy="15.5" r="2" fill="${P.soil}"/>`,
  marcio: `<circle cx="20" cy="24" r="12" fill="${P.wheat}" ${S}/><g fill="${P.soil}"><circle cx="24" cy="24" r="4"/><circle cx="14" cy="28" r="2.6"/><circle cx="16" cy="19" r="2"/></g>` +
    `<g fill="none" stroke="${P.olive}" stroke-width="1.6" stroke-linecap="round"><path d="M13 3q2 2 0 4q-2 2 0 4M20 2q2 2 0 4q-2 2 0 4M27 3q2 2 0 4q-2 2 0 4"/></g>`,
  verme: `<path d="M5 27C9 17 15 32 20 23C24 15 29 27 33 18" fill="none" stroke="${P.worm}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="33.5" cy="17" r="3.6" fill="${P.worm}"/><circle cx="34.6" cy="16" r="1" fill="${P.ink}"/><path d="M9 21l1 3M14 25l1-3M24 18l1 3" stroke="#C06C5A" stroke-width="1.2"/>`,
  vivo: `<path d="M20 34C8 25 4 19 4 13.5C4 8.5 8 5.5 12 5.5C15.5 5.5 18.5 8 20 11C21.5 8 24.5 5.5 28 5.5C32 5.5 36 8.5 36 13.5C36 19 32 25 20 34Z" fill="${P.tomato}" ${S}/>` +
    '<path d="M7 18H14L16.5 13L20 23L23 16L25 18H33" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function questionArt(qid) {
  if (DROP[qid]) return drop(qid);
  if (SHAPE[qid]) return silhouette(qid);
  return QICON[qid] || '';
}

// ------------------------------------------------------------------ truck symbols (etichette)
const apple = (c, tr = '') => `<g transform="${tr}">${itemArt({ t: 'mela', c, big: true, heavy: true })}</g>`;
const SYM = {
  rosse: () => apple('rosso'),
  verdi: () => apple('verde'),
  mele: () => apple('rosso', 'translate(-5 -3) scale(.8)') + apple('verde', 'translate(12 8) scale(.72)'),
  patate: () => itemArt({ t: 'patata', c: 'marrone', big: true, heavy: true }),
  pomodori: () => itemArt({ t: 'pomodoro', c: 'rosso', big: true, heavy: true }),
  compost: () => `<path d="M9 13H31L28 36H12Z" fill="${P.olive}" ${S}/><rect x="7" y="8" width="26" height="5" rx="2" fill="#56681F" ${S}/><path d="M17 8V6H23V8" fill="none" stroke="${P.soil}" stroke-width="1.5"/>` +
    `<path d="M20 31C14 29 14 21 20 17C26 21 26 29 20 31Z" fill="${P.wheat}"/><path d="M20 31V21" stroke="${P.olive}" stroke-width="1.4"/>`,
  prato: () => `<path d="M2 36C6 26 14 25 20 27C27 25 34 27 38 36Z" fill="#8FA53A" ${S}/>` +
    `<g fill="none" stroke="${P.olive}" stroke-width="1.8" stroke-linecap="round"><path d="M8 31l-2-6M10 31l1-7M29 31l-1-6M31 31l3-6M20 27l-1-5"/></g>` +
    `<g transform="translate(24 15)"><g fill="#fff" stroke="${P.soil}" stroke-width=".8"><circle cx="0" cy="-4" r="3"/><circle cx="4" cy="0" r="3"/><circle cx="0" cy="4" r="3"/><circle cx="-4" cy="0" r="3"/></g><circle r="2.4" fill="${P.gold}"/></g>` +
    `<path d="M24 19V28" stroke="${P.olive}" stroke-width="1.6"/>`,
  galline: () => `<path d="M8 22C8 13 16 10 23 12C27 8 33 10 32 15C35 17 34 22 31 23C31 31 24 35 17 34C11 33 8 28 8 22Z" fill="#FBF3E4" ${S}/>` +
    `<path d="M26 10C26 6 29 5 30 8C31 5 34 6 33 10Z" fill="${P.tomato}"/><path d="M33 15L38 17L33 19Z" fill="${P.gold}" ${S}/><circle cx="29" cy="14.5" r="1.5" fill="${P.ink}"/>` +
    `<path d="M31 19C33 21 33 24 31 24" fill="${P.tomato}"/><path d="M11 21C14 27 20 28 24 24" fill="none" stroke="${P.soil}" stroke-width="1.3" opacity=".6"/>` +
    `<path d="M16 34V38M21 34V38" stroke="${P.gold}" stroke-width="2" stroke-linecap="round"/>`,
  succo: () => `<path d="M16 3H24V9C24 11 29 13 29 18V35C29 37 27 38 25 38H15C13 38 11 37 11 35V18C11 13 16 11 16 9Z" fill="#fff" fill-opacity=".6" ${S}/>` +
    `<path d="M12 20H28V35C28 36.5 26.5 37 25 37H15C13.5 37 12 36.5 12 35Z" fill="${P.gold}"/><rect x="15" y="1.5" width="10" height="4" rx="1" fill="${P.olive}"/>` +
    `<g transform="translate(20 28) scale(.36) translate(-20 -21)">${itemArt({ t: 'mela', c: 'rosso', big: true, heavy: true })}</g>`,
  passata: () => `<path d="M16 3H24V9C24 11 29 13 29 18V35C29 37 27 38 25 38H15C13 38 11 37 11 35V18C11 13 16 11 16 9Z" fill="#fff" fill-opacity=".6" ${S}/>` +
    `<path d="M12 17H28V35C28 36.5 26.5 37 25 37H15C13.5 37 12 36.5 12 35Z" fill="#C63D24"/><rect x="15" y="1.5" width="10" height="4" rx="1" fill="${P.olive}"/>` +
    '<path d="M20 22C24 22 26 24 26 27C26 30 23 32 20 32C17 32 14 30 14 27C14 24 16 22 20 22Z" fill="#E86A48"/><path d="M20 22L18 20M20 22L22 20" stroke="#5E7D2A" stroke-width="1.5"/>',
  mercato: () => `<rect x="4" y="18" width="32" height="18" rx="2" fill="#D9B77A" ${S}/><path d="M4 24H36M4 30H36" stroke="${P.soil}" stroke-width="1.2" opacity=".6"/>` +
    `<path d="M15 12L11 24L16 21L17 26L20 14ZM25 12L29 24L24 21L23 26L20 14Z" fill="${P.sky}"/>` +
    `<circle cx="20" cy="12" r="8.5" fill="${P.tomato}" ${S}/><path d="M20 6.5L21.6 10L25.3 10.3L22.5 12.7L23.4 16.3L20 14.4L16.6 16.3L17.5 12.7L14.7 10.3L18.4 10Z" fill="${P.gold}"/>`,
  grandi: () => `<g transform="translate(20 22) scale(1.02) translate(-20 -21)">${itemArt({ t: 'mela', c: 'rosso', big: true, heavy: true })}</g>` +
    `<g fill="none" stroke="${P.soil}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8L6 12M2 8H6M2 8V12M38 8L34 12M38 8H34M38 8V12M2 37L6 33M2 37H6M2 37V33M38 37L34 33M38 37H34M38 37V33"/></g>`,
  piccole: () => `<g transform="translate(20 21) scale(.5) translate(-20 -21)">${itemArt({ t: 'mela', c: 'rosso', big: true, heavy: true })}</g>` +
    `<g fill="none" stroke="${P.soil}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5L10 11M10 11H6M10 11V7M36 5L30 11M30 11H34M30 11V7M4 37L10 31M10 31H6M10 31V35M36 37L30 31M30 31H34M30 31V35"/></g>`,
};
export const truckSymbolArt = (sym) => (SYM[sym] ? SYM[sym]() : '');

// A truck in a slot `w` px wide, centred at x = 0, with its bed top at y = 0 (the pipe ends there).
// Returns { svg, bedW, height }.
export function truckArt(sym, w) {
  const tw = Math.min(w - 6, 76);
  const bedW = Math.round(tw * 0.66), cabW = tw - bedW - 2;
  const x0 = -tw / 2;
  const bedH = 28;
  const panel = Math.min(bedH - 4, bedW - 8);
  const svg =
    `<rect x="${x0}" y="0" width="${bedW}" height="${bedH}" rx="3" fill="${P.wheat}" stroke="${P.soil}" stroke-width="2"/>` +
    `<rect x="${x0 + (bedW - panel) / 2}" y="2" width="${panel}" height="${panel}" rx="4" fill="#fff" stroke="${P.soil}" stroke-width="1"/>` +
    `<svg x="${x0 + (bedW - panel) / 2 + 1}" y="3" width="${panel - 2}" height="${panel - 2}" viewBox="0 0 40 40">${truckSymbolArt(sym)}</svg>` +
    `<path d="M${x0 + bedW + 2} ${bedH}V8Q${x0 + bedW + 2} 5 ${x0 + bedW + 5} 5H${x0 + tw - 5}Q${x0 + tw} 5 ${x0 + tw} 12V${bedH}Z" fill="${P.sky}" stroke="${P.soil}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="${x0 + bedW + 5}" y="8" width="${Math.max(4, cabW - 8)}" height="8" rx="1.5" fill="#CFE6EC"/>` +
    `<rect x="${x0 - 1}" y="${bedH}" width="${tw + 2}" height="5" rx="2" fill="${P.soil}"/>` +
    `<circle cx="${x0 + bedW * 0.28}" cy="${bedH + 6}" r="5.5" fill="${P.ink}"/><circle cx="${x0 + bedW * 0.28}" cy="${bedH + 6}" r="2" fill="${P.wheat}"/>` +
    `<circle cx="${x0 + tw - cabW / 2}" cy="${bedH + 6}" r="5.5" fill="${P.ink}"/><circle cx="${x0 + tw - cabW / 2}" cy="${bedH + 6}" r="2" fill="${P.wheat}"/>`;
  return { svg, bedX: x0, bedW, height: bedH + 12 };
}

// ------------------------------------------------------------------ small UI icons
export const ICON = {
  yes: `<path d="M9 21L17 29L31 12" fill="none" stroke="${P.olive}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  no: `<path d="M11 11L29 29M29 11L11 29" fill="none" stroke="${P.soil}" stroke-width="5" stroke-linecap="round"/>`,
  coin: `<circle cx="20" cy="20" r="16" fill="${P.gold}" stroke="#B8892B" stroke-width="2.5"/><circle cx="20" cy="20" r="10.5" fill="none" stroke="#B8892B" stroke-width="2"/><path d="M20 13V27" stroke="#B8892B" stroke-width="2.5" stroke-linecap="round"/>`,
  lock: `<rect x="9" y="18" width="22" height="17" rx="3" fill="${P.soil}"/><path d="M13 18V13A7 7 0 0 1 27 13V18" fill="none" stroke="${P.soil}" stroke-width="3.5"/><circle cx="20" cy="26" r="2.6" fill="${P.wheat}"/>`,
  map: `<path d="M5 9L14 6L26 10L35 7V31L26 34L14 30L5 33Z" fill="${P.cream}" stroke="${P.cream}" stroke-width="2" stroke-linejoin="round"/><path d="M14 6V30M26 10V34" stroke="${P.olive}" stroke-width="2"/>`,
  help: `<circle cx="20" cy="20" r="15" fill="none" stroke="${P.cream}" stroke-width="3"/><path d="M15 16A5 5 0 1 1 21.5 20.8C20.5 21.3 20 22 20 23.5V24.5" fill="none" stroke="${P.cream}" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="29.5" r="2" fill="${P.cream}"/>`,
  shop: `<path d="M4 8H9L13 27H31L35 13H11" fill="none" stroke="${P.cream}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="15" cy="32" r="2.6" fill="${P.cream}"/><circle cx="29" cy="32" r="2.6" fill="${P.cream}"/>`,
  levels: `<g fill="${P.soil}"><rect x="5" y="5" width="12" height="12" rx="2"/><rect x="23" y="5" width="12" height="12" rx="2"/><rect x="5" y="23" width="12" height="12" rx="2"/><rect x="23" y="23" width="12" height="12" rx="2" opacity=".45"/></g>`,
  hint: `<path d="M20 4A11 11 0 0 1 27 23.5C25.5 25 25 26.5 25 28H15C15 26.5 14.5 25 13 23.5A11 11 0 0 1 20 4Z" fill="${P.gold}" ${S}/><rect x="15" y="29.5" width="10" height="3.5" rx="1" fill="${P.soil}"/><rect x="16.5" y="34" width="7" height="3" rx="1" fill="${P.soil}"/><path d="M17 18L20 22L23 18" fill="none" stroke="${P.soil}" stroke-width="1.5"/>`,
  lente: `<circle cx="17" cy="17" r="11" fill="#CFE6EC" stroke="${P.soil}" stroke-width="3.5"/><path d="M25 25L35 35" stroke="${P.soil}" stroke-width="5" stroke-linecap="round"/><path d="M11 14A7 7 0 0 1 16 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
  fast: `<rect x="3" y="24" width="34" height="9" rx="4.5" fill="${P.soil}"/><g fill="${P.wheat}"><circle cx="8" cy="28.5" r="2"/><circle cx="16" cy="28.5" r="2"/><circle cx="24" cy="28.5" r="2"/><circle cx="32" cy="28.5" r="2"/></g>` +
    `<circle cx="25" cy="15" r="7" fill="${P.tomato}" ${S}/><path d="M4 11H14M7 16H15M4 21H13" stroke="${P.sky}" stroke-width="2.4" stroke-linecap="round"/>`,
  clear: `<rect x="7" y="7" width="26" height="26" rx="4" fill="none" stroke="${P.soil}" stroke-width="2.5" stroke-dasharray="4 3"/><path d="M14 14L26 26M26 14L14 26" stroke="${P.tomato}" stroke-width="3" stroke-linecap="round"/>`,
  place: `<rect x="3" y="3" width="34" height="11" rx="2" fill="${P.wheat}" stroke="${P.soil}" stroke-width="1.6"/><rect x="15" y="17" width="10" height="9" rx="1.5" fill="${P.cream}" stroke="${P.soil}" stroke-width="1.6"/>` +
    `<path d="M20 14V17M17 26L9 32M23 26L31 32" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/><circle cx="9" cy="34" r="4" fill="${P.tomato}"/><circle cx="31" cy="34" r="4" fill="#9DB23E"/><circle cx="20" cy="8.5" r="3.4" fill="${P.tomato}"/>`,
};

// Wraps 40 x 40 art into a standalone inline <svg>.
export const svg40 = (inner, size = 40, cls = '') =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${inner}</svg>`;

// <symbol> definitions for every item kind in a batch, so moving items can be cheap <use> elements.
export const itemSymbolId = (it) => `it-${itemKey(it)}`;
export function ensureItemSymbols(defs, items) {
  const have = new Set([...defs.querySelectorAll('symbol')].map((s) => s.id));
  let add = '';
  for (const it of items) {
    const id = itemSymbolId(it);
    if (have.has(id)) continue;
    have.add(id);
    add += `<symbol id="${id}" viewBox="0 0 40 40">${itemArt(it)}</symbol>`;
  }
  if (add) defs.insertAdjacentHTML('beforeend', add);
}
