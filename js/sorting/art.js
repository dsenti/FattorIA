// Minigame 2: all drawings as inline SVG strings in the course palette (no emoji).
// Items, question icons and truck symbols are drawn in a 40 x 40 box.
import { itemKey } from './questions.js';

export const P = {
  soil: '#5B3A29', olive: '#6B7F2A', wheat: '#E9D8A6', cream: '#FBF7EF', tomato: '#D9502B', sky: '#4A8FA3',
  ink: '#3A2519', leaf: '#6B7F2A', worm: '#CC2F24', wormDark: '#7E1A14', gold: '#F4C95D', mud: '#6E4A30',
};

// Fill colours per item type and colour token (shades of the palette).
const FILL = {
  mela: { rosso: '#D9502B', verde: '#9DB23E', giallo: '#E9BE4C', arancione: '#E8893A', marrone: '#9C6B43' },
  pera: { rosso: '#C9573A', verde: '#A9B94A', giallo: '#E4C455', arancione: '#E0913F', marrone: '#A97B4B' },
  patata: { rosso: '#B5503E', verde: '#98A45A', giallo: '#DDBE72', arancione: '#D29555', marrone: '#B08556' },
  pomodoro: { rosso: '#DB4A2A', verde: '#86A33A', giallo: '#EAB83E', arancione: '#E8812F', marrone: '#8F5A3A' },
  carota: { rosso: '#C9452E', verde: '#9DB23E', giallo: '#E9BB45', arancione: '#EC8A2E', marrone: '#9C6B43' },
  animal: { rosso: '#D9402B', verde: '#8FA53A', giallo: '#EBBE3C', arancione: '#EC8A2E', marrone: '#9C6B43' },
};
export const PAINT = { rosso: '#D9502B', verde: '#8FA53A', giallo: '#E9B949', arancione: '#EC8A2E', marrone: '#8C5E3C' };

// Body outlines: normal and misshapen ("strano") for each kind of produce.
const SHAPE = {
  mela: 'M20 11C24 7 33 8 34 18C35 28 28 36 20 34C12 36 5 28 6 18C7 8 16 7 20 11Z',
  pera: 'M20 7C24 7 25 12 25 15C26 19 32 22 32 28C32 34 26 37 20 37C14 37 8 34 8 28C8 22 14 19 15 15C15 12 16 7 20 7Z',
  patata: 'M6 21C5 13 13 9 22 10C31 11 36 16 35 23C34 30 26 33 17 32C10 31 6 27 6 21Z',
  pomodoro: 'M20 12C29 11 35 16 35 23C35 31 28 35 20 35C12 35 5 31 5 23C5 16 11 11 20 12Z',
  carota: 'M12 10C16 8 24 8 28 10C29 18 24 29 20 38C16 29 11 18 12 10Z',
};
const ODD = {
  mela: 'M20 11C24 7 33 8 35 15C39 18 37 29 29 33C24 36 20 35 15 35C6 34 3 25 7 18C4 12 13 6 20 11Z',
  pera: 'M25 6C29 7 28 12 27 15C28 20 34 23 32 29C31 35 24 37 18 36C11 35 6 31 9 25C10 20 17 19 19 15C20 11 21 5 25 6Z',
  patata: 'M6 21C4 15 9 12 12 13C12 8 18 7 21 10C25 7 32 10 31 15C36 15 38 23 33 26C35 31 27 35 22 31C18 35 10 34 10 29C5 29 4 24 6 21Z',
  pomodoro: 'M20 12C29 11 35 16 35 22C38 24 37 30 32 30C31 34 26 36 20 35C12 35 5 31 5 23C3 19 6 13 11 14C13 12 16 12 20 12Z',
  carota: 'M11 10C15 8 25 8 29 10C30 16 28 21 25 24C25 30 24 34 23 38C21 34 21 29 20 26C19 29 19 34 17 38C16 34 15 30 15 24C12 21 10 16 11 10Z',
};
// Height where the caked soil starts on each kind of produce ("sporco").
const MUD_LINE = { mela: 25, pera: 27, patata: 21, pomodoro: 26, carota: 23 };
// Where the rot patches sit on each kind of produce (x, y, radius).
const ROT_SPOTS = {
  mela: [[24, 23, 6.5], [14.5, 27, 4.6], [18, 17.5, 3.6], [26.5, 30.5, 3]],
  pera: [[24, 28, 6], [14, 30, 4.4], [19, 20, 3.2]],
  patata: [[24, 21, 6.2], [14, 24, 4.6], [19, 15, 3.4], [28, 27, 3]],
  pomodoro: [[24, 24, 6.4], [13.5, 27, 4.6], [18, 19, 3.4]],
  carota: [[20, 16, 5.2], [22, 24, 4], [19, 31, 3]],
};
const WORM_HOLE = { mela: [27, 21], pera: [26, 27], patata: [27, 19], pomodoro: [27, 22], carota: [22, 19] };

const S = `stroke="${P.soil}" stroke-width="1.5" stroke-linejoin="round"`;
// Soft rot patch: dark centre, feathered edge with a pale mould halo. Same id everywhere (identical).
const ROT_GRAD = '<radialGradient id="rotg"><stop offset="0" stop-color="#3A2618" stop-opacity=".95"/><stop offset=".42" stop-color="#4A3322" stop-opacity=".85"/>' +
  '<stop offset=".7" stop-color="#D2CCA2" stop-opacity=".6"/><stop offset="1" stop-color="#D2CCA2" stop-opacity="0"/></radialGradient>';
const outline = (it) => (it.odd ? ODD : SHAPE)[it.t];

function produceBody(it, fill) {
  const d = outline(it);
  switch (it.t) {
    case 'mela': return `<path d="${d}" fill="${fill}" ${S}/><path d="M20 11Q20 6 22 3" fill="none" stroke="${P.soil}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M21 7Q27 2 31 5Q26 9 21 7Z" fill="${P.leaf}"/><ellipse cx="13" cy="19" rx="2.6" ry="5" fill="#fff" opacity=".3"/>`;
    case 'pera': return `<path d="${d}" fill="${fill}" ${S}/><path d="${it.odd ? 'M25 6Q26 3 28 1' : 'M20 7Q20 4 22 2'}" fill="none" stroke="${P.soil}" stroke-width="2" stroke-linecap="round"/>` +
      `<ellipse cx="14" cy="28" rx="2.4" ry="4.5" fill="#fff" opacity=".3"/>`;
    case 'patata': return `<path d="${d}" fill="${fill}" ${S}/>` +
      `<g fill="none" stroke="${P.soil}" stroke-width="1.3" stroke-linecap="round" opacity=".55"><path d="M13 18q2 1 3 0M25 15q2 1 3 0M21 26q2 1 3 0M11 25q1 1 2 0"/></g>`;
    case 'pomodoro': return `<path d="${d}" fill="${fill}" ${S}/>` +
      '<path d="M20 14L15 10L19 11L20 6L22 11L27 9L23 14L28 16L21 15L17 18L18 14Z" fill="#5E7D2A" stroke="#4B6420" stroke-width=".8" stroke-linejoin="round"/>' +
      '<ellipse cx="12" cy="22" rx="2.4" ry="4" fill="#fff" opacity=".3"/>';
    case 'carota': return `<path d="M16 10L11 1M20 9L20 0M24 10L29 2" stroke="#5E7D2A" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="${d}" fill="${fill}" ${S}/><g fill="none" stroke="${P.soil}" stroke-width="1.1" stroke-linecap="round" opacity=".45"><path d="M14 15h4M22 19h4M16 24h3M21 29h2"/></g>`;
    default: return '';
  }
}

function animalBody(it) {
  const f = FILL.animal[it.c];
  switch (it.t) {
    case 'lumaca': return `<path d="M3 34C3 30 9 29 15 29L33 29C37 29 38 33 35 34Z" fill="#D8C9A3" ${S}/>` +
      `<path d="M33 29L35 20M30 29L29 21" stroke="${P.soil}" stroke-width="1.5" stroke-linecap="round"/><circle cx="35" cy="20" r="1.8" fill="${P.soil}"/><circle cx="29" cy="21" r="1.8" fill="${P.soil}"/>` +
      `<circle cx="19" cy="20" r="11" fill="${f}" ${S}/><path d="M19 20m0-6a6 6 0 1 1-6 6a4 4 0 1 1 4 4a2 2 0 1 1-2-2" fill="none" stroke="${P.soil}" stroke-width="1.4"/>`;
    case 'coccinella': return `<g stroke="${P.ink}" stroke-width="1.6" stroke-linecap="round"><path d="M14 30l-3 4M21 32v4M28 30l3 4M14 16l-3-4M28 16l3-4M8 20l-4-5M8 20l-5 0"/></g>` +
      `<circle cx="9" cy="22" r="5" fill="${P.ink}"/><circle cx="22" cy="23" r="12" fill="${f}" ${S}/><path d="M11 23H34" stroke="${P.ink}" stroke-width="1.4"/>` +
      `<g fill="${P.ink}"><circle cx="17" cy="17" r="2.4"/><circle cx="27" cy="17" r="2.4"/><circle cx="17" cy="29" r="2.2"/><circle cx="27" cy="29" r="2.2"/><circle cx="22" cy="12.8" r="1.6"/></g>`;
    case 'ape': return `<g fill="#fff" fill-opacity=".85" stroke="${P.sky}" stroke-width="1.3"><ellipse cx="17" cy="11" rx="6" ry="8" transform="rotate(-25 17 11)"/><ellipse cx="25" cy="11" rx="5" ry="7" transform="rotate(20 25 11)"/></g>` +
      `<ellipse cx="21" cy="24" rx="12" ry="8.5" fill="${f}" ${S}/><g fill="${P.ink}"><path d="M15 16.5C13 20 13 28 15 31.5L18.5 32C16.5 28 16.5 20 18.5 16Z"/><path d="M23 15.6C21 20 21 28 23 32.4L26.3 31.8C24.3 28 24.3 20 26.3 16.2Z"/></g>` +
      `<circle cx="7" cy="23" r="4.8" fill="${P.ink}"/><circle cx="5.6" cy="21.6" r="1.1" fill="#fff"/><path d="M5 19L2 14M8 18.5L8 13" stroke="${P.ink}" stroke-width="1.3" stroke-linecap="round"/><path d="M33 24L37 24" stroke="${P.ink}" stroke-width="2" stroke-linecap="round"/>`;
    case 'farfalla': return `<g ${S}><path d="M20 19C14 6 3 5 4 13C5 19 12 21 20 20Z" fill="${f}"/><path d="M20 19C26 6 37 5 36 13C35 19 28 21 20 20Z" fill="${f}"/>` +
      `<path d="M20 21C13 22 8 27 10 32C12 36 18 31 20 24Z" fill="${f}"/><path d="M20 21C27 22 32 27 30 32C28 36 22 31 20 24Z" fill="${f}"/></g>` +
      `<g fill="#fff" opacity=".6"><circle cx="11" cy="12" r="2.4"/><circle cx="29" cy="12" r="2.4"/></g><rect x="18.6" y="12" width="2.8" height="17" rx="1.4" fill="${P.ink}"/>` +
      `<path d="M19.5 12.5L16 5M20.5 12.5L24 5" stroke="${P.ink}" stroke-width="1.2" stroke-linecap="round"/>`;
    case 'verme': return `<path d="M5 30C9 20 15 34 20 25C24 17 29 29 34 20" fill="none" stroke="${P.wormDark}" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="M5 30C9 20 15 34 20 25C24 17 29 29 34 20" fill="none" stroke="${P.worm}" stroke-width="6" stroke-linecap="round"/>` +
      `<g stroke="${P.wormDark}" stroke-width="1.2"><path d="M8.5 24.5l2 2.5M13 28.6l1.6-2.6M22.3 21.6l2.3 1.8M26.8 24l1.5-2.6"/></g>` +
      `<circle cx="34.2" cy="19.6" r="3.6" fill="${P.worm}" stroke="${P.wormDark}" stroke-width="1"/><circle cx="35.3" cy="18.4" r="1" fill="#fff"/>`;
    default: return '';
  }
}

const miniSnail = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${animalBody({ t: 'lumaca', c: 'marrone' })}</g>`;

// One item kind drawn in a 40 x 40 box. Small produce is scaled down around the centre.
export function itemArt(it) {
  if (it.alive) return animalBody(it);
  const fill = (FILL[it.t] || FILL.mela)[it.c];
  let s = produceBody(it, fill);
  const d = outline(it);
  if (it.rot) {
    // rot: dark soft spots with a pale ring of mould
    // rot: soft, blurry-edged dark patches fading into a pale mould halo (radial gradients: cheap)
    const rid = `rot-${it.t}-${+it.odd}`;
    s += `${ROT_GRAD}<clipPath id="${rid}"><path d="${d}"/></clipPath><path d="${d}" fill="${P.soil}" opacity=".16"/><g fill="url(#rotg)" clip-path="url(#${rid})">` +
      ROT_SPOTS[it.t].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('') + '</g>';
  }
  if (it.dirty) {
    // soil: a caked, wavy layer of earth on the lower part (clipped to the outline), crumbs falling off
    const y0 = MUD_LINE[it.t];
    const cid = `mud-${it.t}-${+it.odd}`;
    s += `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">` +
      `<path d="M0 ${y0}q3.3-3 6.6 0t6.6 0t6.6 0t6.6 0t6.6 0t6.6 0V40H0Z" fill="#6E4A2C" opacity=".9"/>` +
      `<g fill="#B2926A">${[4, 11, 17, 24, 30, 35].map((x, k) => `<circle cx="${x}" cy="${y0 + 3 + (k % 3) * 2.6}" r="${k % 2 ? 0.8 : 1.1}"/>`).join('')}</g></g>` +
      `<path d="M0 ${y0}q3.3-3 6.6 0t6.6 0t6.6 0t6.6 0t6.6 0t6.6 0" fill="none" stroke="${P.ink}" stroke-width=".8" opacity=".5" clip-path="url(#${cid})"/>` +
      `<g fill="#6E4A2C"><circle cx="13" cy="38.5" r="1.2"/><circle cx="19" cy="39.3" r=".9"/><circle cx="26" cy="38.7" r="1.1"/></g>`;
  }
  if (it.worm) {
    const [x, y] = WORM_HOLE[it.t];
    const w = `M${x} ${y}C${x + 4} ${y - 4} ${x + 6} ${y + 1} ${x + 9} ${y - 3}`;
    s += `<circle cx="${x}" cy="${y}" r="2.8" fill="${P.ink}"/><path d="${w}" fill="none" stroke="${P.wormDark}" stroke-width="4.8" stroke-linecap="round"/><path d="${w}" fill="none" stroke="${P.worm}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<circle cx="${x + 9.3}" cy="${y - 3.4}" r="2.4" fill="${P.worm}" stroke="${P.wormDark}" stroke-width=".8"/><circle cx="${x + 10}" cy="${y - 4}" r=".7" fill="#fff"/>`;
  }
  const body = it.big ? s : `<g transform="translate(20 21) scale(.72) translate(-20 -21)">${s}</g>`;
  // the snail sits on the produce, the same size whatever the produce's size
  return it.snail ? body + miniSnail(it.big ? 17 : 15, it.big ? 18 : 17, 0.55) : body;
}

// ------------------------------------------------------------------ question icons
// Colour: a paint splat with droplets.
const splat = (c) => `<path d="M20 7C23 7 23 11 26 10C29 9 31 12 29 15C33 15 35 19 32 22C35 25 32 29 28 28C28 32 24 34 21 31C18 34 13 32 13 28C9 29 6 25 9 22C5 20 7 15 11 15C9 12 12 8 15 10C16 8 18 7 20 7Z" fill="${PAINT[c]}" ${S}/>` +
  `<circle cx="34" cy="8" r="2.4" fill="${PAINT[c]}" ${S}/><circle cx="6" cy="33" r="2" fill="${PAINT[c]}" ${S}/><circle cx="31" cy="35" r="1.4" fill="${PAINT[c]}"/>` +
  '<ellipse cx="16.5" cy="17" rx="2.5" ry="1.6" fill="#fff" opacity=".45" transform="rotate(-30 16.5 17)"/>';
const silhouette = (t) => {
  if (t === 'mela') return `<path d="${SHAPE.mela}" fill="${P.soil}"/><path d="M20 11Q20 6 22 3" fill="none" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/><path d="M21 7Q27 2 31 5Q26 9 21 7Z" fill="${P.soil}"/>`;
  if (t === 'pera') return `<path d="${SHAPE.pera}" fill="${P.soil}"/><path d="M20 7Q20 4 22 2" fill="none" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/>`;
  if (t === 'patata') return `<path d="${SHAPE.patata}" fill="${P.soil}"/><g fill="none" stroke="${P.cream}" stroke-width="1.3" stroke-linecap="round" opacity=".6"><path d="M13 17q2 1 3 0M25 15q2 1 3 0M21 26q2 1 3 0"/></g>`;
  if (t === 'pomodoro') return `<path d="${SHAPE.pomodoro}" fill="${P.soil}"/><path d="M20 14L15 10L19 11L20 6L22 11L27 9L23 14L28 16L21 15L17 18L18 14Z" fill="${P.cream}" opacity=".75"/>`;
  if (t === 'carota') return `<path d="M16 10L11 1M20 9L20 0M24 10L29 2" stroke="${P.soil}" stroke-width="3" stroke-linecap="round"/><path d="${SHAPE.carota}" fill="${P.soil}"/><g fill="none" stroke="${P.cream}" stroke-width="1.1" stroke-linecap="round" opacity=".6"><path d="M14 15h4M22 19h4M16 24h3"/></g>`;
  return '';
};
const HEART = (x, y, k) => `<path transform="translate(${x} ${y}) scale(${k})" d="M8 14C2 10 0 7 0 4.5C0 2 2 0 4 0C5.8 0 7.2 1.2 8 2.7C8.8 1.2 10.2 0 12 0C14 0 16 2 16 4.5C16 7 14 10 8 14Z" fill="${P.tomato}" ${S}/>`;
const QICON = {
  sporco: `<clipPath id="q-mud"><circle cx="20" cy="18" r="13"/></clipPath><circle cx="20" cy="18" r="13" fill="${P.wheat}" ${S}/>` +
    '<g clip-path="url(#q-mud)"><path d="M0 19q3.3-3.5 6.6 0t6.6 0t6.6 0t6.6 0t6.6 0t6.6 0V40H0Z" fill="#6E4A2C"/>' +
    '<g fill="#B2926A"><circle cx="12" cy="24" r="1.2"/><circle cx="20" cy="27" r="1"/><circle cx="27" cy="23" r="1.2"/><circle cx="16" cy="29" r=".9"/></g></g>' +
    `<circle cx="20" cy="18" r="13" fill="none" ${S}/><g fill="#6E4A2C"><circle cx="12" cy="36" r="1.8"/><circle cx="20" cy="38" r="1.4"/><circle cx="28" cy="35.5" r="1.7"/></g>`,
  lumaca: animalBody({ t: 'lumaca', c: 'marrone' }),
  strano: `<path d="${ODD.patata}" fill="${P.wheat}" ${S}/><path d="M13 20q2-3 4 0t4 0" fill="none" stroke="${P.soil}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M24 18q1.5-2 3 0M26 25q1.5-2 3 0" fill="none" stroke="${P.soil}" stroke-width="1.4" stroke-linecap="round"/>` + HEART(29, 3, 0.55),
  pesante: `<path d="M20 9V33M12 35H28" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/><path d="M6 20L34 11" stroke="${P.soil}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M6 20L3 28H11ZM34 11L31 19H37Z" fill="${P.wheat}" ${S}/><rect x="3.5" y="21" width="7" height="6.5" rx="1" fill="${P.soil}"/><circle cx="20" cy="15.5" r="2" fill="${P.soil}"/>`,
  marcio: `${ROT_GRAD}<circle cx="20" cy="24" r="12" fill="${P.wheat}" ${S}/><g fill="url(#rotg)"><circle cx="24" cy="24" r="6.5"/><circle cx="14" cy="28" r="4.4"/><circle cx="16" cy="19" r="3.4"/></g>` +
    `<g fill="none" stroke="${P.olive}" stroke-width="1.6" stroke-linecap="round"><path d="M13 3q2 2 0 4q-2 2 0 4M20 2q2 2 0 4q-2 2 0 4M27 3q2 2 0 4q-2 2 0 4"/></g>`,
  verme: `<path d="M5 27C9 17 15 32 20 23C24 15 29 27 33 18" fill="none" stroke="${P.worm}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="33.5" cy="17" r="3.6" fill="${P.worm}"/><circle cx="34.6" cy="16" r="1" fill="${P.ink}"/><path d="M9 21l1 3M14 25l1-3M24 18l1 3" stroke="#B85A4E" stroke-width="1.2"/>`,
  // "È un animale da solo?": a beetle standing alone on bare ground, next to a crossed-out fruit
  vivo: `<path d="M2 33Q20 30 38 33V38H2Z" fill="#8C5E3C" ${S}/><g fill="#6E4A2C"><circle cx="8" cy="35.5" r=".9"/><circle cx="30" cy="35.8" r="1"/></g>` +
    `<g stroke="${P.ink}" stroke-width="1.4" stroke-linecap="round"><path d="M9 27l-2 5M14 28v4.5M19 27l2 5M6 20l-3-3M6 18.5l-1-4"/></g>` +
    `<circle cx="7" cy="21" r="3.6" fill="${P.ink}"/><path d="M5 26A9 8 0 0 1 23 26Z" fill="${P.olive}" ${S}/><path d="M14 18.2V26" stroke="${P.ink}" stroke-width="1.2"/>` +
    `<g fill="${P.ink}"><circle cx="10.5" cy="22.5" r="1.3"/><circle cx="17.5" cy="22.5" r="1.3"/></g>` +
    `<g transform="translate(22 1) scale(.42)"><path d="${SHAPE.mela}" fill="#D9502B" ${S}/><path d="M20 11Q20 6 22 3" fill="none" stroke="${P.soil}" stroke-width="2.4"/></g>` +
    `<path d="M23 3L38 18" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M23 3L38 18" stroke="${P.ink}" stroke-width="2.6" stroke-linecap="round"/>`,
};

export function questionArt(qid) {
  if (PAINT[qid]) return splat(qid);
  if (SHAPE[qid]) return silhouette(qid);
  return QICON[qid] || '';
}

// ------------------------------------------------------------------ truck symbols (etichette)
const produce = (t, c, extra = {}) => itemArt({ t, c, big: true, heavy: true, ...extra });
const at = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const drawIt = (x) => produce(x.t, x.c, { dirty: !!x.dirty, odd: !!x.odd });
// A balance with one pan down (heavy) or up (light); the level's produce sits on that pan.
const scale = (heavy, show) => {
  const beam = heavy ? 'M5 18L35 10' : 'M5 10L35 18';
  const lp = heavy ? 18 : 10, rp = heavy ? 10 : 18;
  const k = heavy ? 0.5 : 0.3;
  const items = show.map((x, n) => at(heavy ? -3 + n * 9 : 1 + n * 5, heavy ? lp - 12 - n * 2 : lp - 6 - n, k, drawIt(x))).join('');
  return `<path d="M20 12V36M13 37H27" stroke="${P.soil}" stroke-width="2.2" stroke-linecap="round"/><path d="${beam}" stroke="${P.soil}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M5 ${lp}L1 ${lp + 8}H11ZM35 ${rp}L31 ${rp + 8}H39Z" fill="${P.wheat}" ${S}/><circle cx="20" cy="14" r="2" fill="${P.soil}"/>` + items;
};
// One, two or three samples of the produce that goes in.
const group = (show) => {
  if (show.length === 1) return drawIt(show[0]);
  if (show.length === 2) return at(-5, -3, 0.8, drawIt(show[0])) + at(12, 8, 0.72, drawIt(show[1]));
  return at(-4, -3, 0.62, drawIt(show[0])) + at(15, -2, 0.6, drawIt(show[1])) + at(5, 14, 0.64, drawIt(show[2]));
};
const heartBig = `<path d="M31 22C25 18 23 15 23 12.5C23 10 25 8.5 27 8.5C28.8 8.5 30.2 9.7 31 11.2C31.8 9.7 33.2 8.5 35 8.5C37 8.5 39 10 39 12.5C39 15 37 18 31 22Z" fill="${P.tomato}" ${S}/>`;
const SYM = {
  rosse: () => produce('mela', 'rosso'),
  verdi: () => produce('mela', 'verde'),
  patate: () => produce('patata', 'marrone'),
  carote: () => produce('carota', 'arancione'),
  pomodori: () => produce('pomodoro', 'rosso'),
  pere: () => produce('pera', 'giallo'),
  compost: () => `<path d="M9 13H31L28 36H12Z" fill="${P.olive}" ${S}/><rect x="7" y="8" width="26" height="5" rx="2" fill="#56681F" ${S}/><path d="M17 8V6H23V8" fill="none" stroke="${P.soil}" stroke-width="1.5"/>` +
    `<path d="M20 31C14 29 14 21 20 17C26 21 26 29 20 31Z" fill="${P.wheat}"/><path d="M20 31V21" stroke="${P.olive}" stroke-width="1.4"/>`,
  // the vegetable garden: a raised bed with sprouts and a flower
  orto: () => `<path d="M2 30C2 26 6 25 20 25C34 25 38 26 38 30V36H2Z" fill="#8C5E3C" ${S}/><path d="M6 30H34M8 33H32" stroke="#6E4A30" stroke-width="1.2"/>` +
    `<g fill="none" stroke="#6B8F2A" stroke-width="2" stroke-linecap="round"><path d="M8 25V20M8 21Q5 18 4 19M8 21Q11 18 12 19M16 25V21M16 22Q14 19 12.5 20M16 22Q18 19 19.5 20"/></g>` +
    `<path d="M28 25V13" stroke="#6B8F2A" stroke-width="2"/><path d="M28 19Q33 16 34 18Q31 21 28 19Z" fill="#8FA53A"/>` +
    `<g transform="translate(28 10)"><g fill="#fff" stroke="${P.soil}" stroke-width=".8"><circle cx="0" cy="-4.2" r="3.2"/><circle cx="4.2" cy="0" r="3.2"/><circle cx="0" cy="4.2" r="3.2"/><circle cx="-4.2" cy="0" r="3.2"/></g><circle r="2.6" fill="${P.gold}"/></g>`,
  galline: () => `<path d="M8 22C8 13 16 10 23 12C27 8 33 10 32 15C35 17 34 22 31 23C31 31 24 35 17 34C11 33 8 28 8 22Z" fill="#FBF3E4" ${S}/>` +
    `<path d="M26 10C26 6 29 5 30 8C31 5 34 6 33 10Z" fill="${P.tomato}"/><path d="M33 15L38 17L33 19Z" fill="${P.gold}" ${S}/><circle cx="29" cy="14.5" r="1.5" fill="${P.ink}"/>` +
    `<path d="M31 19C33 21 33 24 31 24" fill="${P.tomato}"/><path d="M11 21C14 27 20 28 24 24" fill="none" stroke="${P.soil}" stroke-width="1.3" opacity=".6"/>` +
    `<path d="M16 34V38M21 34V38" stroke="${P.gold}" stroke-width="2" stroke-linecap="round"/>`,
  // a market stall with a striped awning
  mercato: () => `<path d="M7 15V36M33 15V36" stroke="${P.soil}" stroke-width="2.2"/>` +
    `<path d="M3 6H37L38 15H2Z" fill="#fff" ${S}/><path d="M9.5 6L8.3 15H2.7L3 6ZM21.5 6V15H15.5L16 6ZM33.5 6L34.3 15H28.3L28 6Z" fill="${P.tomato}"/>` +
    `<path d="M2 15Q5 19 8 15Q11 19 14 15Q17 19 20 15Q23 19 26 15Q29 19 32 15Q35 19 38 15" fill="${P.tomato}" ${S}/>` +
    `<rect x="4" y="26" width="32" height="7" rx="1.5" fill="#C99A5B" ${S}/>` +
    `<g ${S}><circle cx="11" cy="24" r="3.4" fill="#D9502B"/><circle cx="17.5" cy="24" r="3.4" fill="#9DB23E"/><circle cx="24" cy="24" r="3.4" fill="#EC8A2E"/><circle cx="30" cy="24" r="3.4" fill="#E9BE4C"/></g>`,
};
const DEFAULT_SHOW = {
  lavaggio: [{ t: 'patata', c: 'giallo', dirty: true }], brutti: [{ t: 'carota', c: 'arancione', odd: true }],
  grandi: [{ t: 'mela', c: 'rosso' }], piccole: [{ t: 'mela', c: 'rosso' }], mele: [{ t: 'mela', c: 'rosso' }, { t: 'mela', c: 'verde' }],
};
// The symbol of a truck from its spec (see trucks.js): exactly the produce that goes in.
export function truckSpecArt(spec) {
  const show = spec.show.length ? spec.show : (DEFAULT_SHOW[spec.truck] || []);
  switch (spec.kind) {
    case 'produce': return group(show);
    case 'scale': return scale(spec.truck === 'grandi', show);
    // washing: a tap pouring water onto a dirty item, with bubbles
    case 'wash': return `<path d="M6 7H22Q27 7 27 12V14H23V12Q23 11 22 11H6Z" fill="#9FB3B8" ${S}/><rect x="10" y="3" width="6" height="4" rx="1" fill="#9FB3B8" ${S}/>` +
      `<g fill="${P.sky}"><path d="M25 16Q27 19 25 21Q23 19 25 16Z"/><path d="M22 20Q24 23 22 25Q20 23 22 20Z"/><path d="M28 21Q30 24 28 26Q26 24 28 21Z"/></g>` +
      at(5, 13, 0.68, drawIt(show[0])) +
      `<g fill="#fff" stroke="${P.sky}" stroke-width="1.1"><circle cx="34" cy="31" r="3"/><circle cx="32" cy="24.5" r="1.6"/><circle cx="5" cy="22" r="1.6"/></g>`;
    // ugly but good: a misshapen item with a heart
    case 'odd': return at(-2, 3, 0.9, drawIt(show[0])) + heartBig;
    default: return SYM[spec.truck] ? SYM[spec.truck]() : '';
  }
}
// Symbol without a level (e.g. docs, gallery): the default samples.
const KIND_OF = { grandi: 'scale', piccole: 'scale', lavaggio: 'wash', brutti: 'odd', mele: 'produce' };
export const truckSymbolArt = (sym) => truckSpecArt({ truck: sym, kind: KIND_OF[sym] || 'fixed', show: [] });

// A truck in a slot `w` px wide, centred at x = 0, with its bed top at y = 0 (the pipe ends there).
// symInner: the symbol markup (40 x 40) painted on its side.
// Returns { svg, bedW, height }.
export function truckArt(symInner, w) {
  const tw = Math.min(w - 6, 76);
  const bedW = Math.round(tw * 0.66), cabW = tw - bedW - 2;
  const x0 = -tw / 2;
  const bedH = 28;
  const panel = Math.min(bedH - 4, bedW - 8);
  const svg =
    `<rect x="${x0}" y="0" width="${bedW}" height="${bedH}" rx="3" fill="${P.wheat}" stroke="${P.soil}" stroke-width="2"/>` +
    `<rect x="${x0 + (bedW - panel) / 2}" y="2" width="${panel}" height="${panel}" rx="4" fill="#fff" stroke="${P.soil}" stroke-width="1"/>` +
    `<svg x="${x0 + (bedW - panel) / 2 + 1}" y="3" width="${panel - 2}" height="${panel - 2}" viewBox="0 0 40 40">${symInner}</svg>` +
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
  noRed: `<path d="M11 11L29 29M29 11L11 29" fill="none" stroke="${P.tomato}" stroke-width="5" stroke-linecap="round"/>`,
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
