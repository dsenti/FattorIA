// Minigame 2 (Lo smistamento): the hand-designed levels. EDIT HERE.
//
// Each level:
//   id      stable id (saved progress refers to it; don't rename a level that players have solved)
//   title   short Italian title
//   story   one sentence shown above the batch (should not give away the rule)
//   trucks  truck ids, drawn left to right at the bottom (see TRUCKS). Pipes may cross.
//   tree    the tree SHAPE and its SOLUTION: ask(question, { no: ..., yes: ... }) for a gate,
//           a truck id for a leaf. The game shows the shape and hides the questions.
//           ✗ (no) is drawn on the left, ✓ (yes) on the right.
//   items   the training batch: [item, truck id (the etichetta), count = 1]
//           item = tokens, see js/sorting/questions.js: type, colour, grande, pesante/leggero,
//           marcio, verme. Default: small; heavy if big.
//   testSize (optional) size of the test batch for "Consegna" (default: training size)
//
// RULE (checked by `node tests/run.mjs`): exactly ONE assignment of questions (out of all 13)
// sorts the training batch 100% correctly, and every leaf gets at least one training item.
// If you change a level, run the tests: they print any other assignment that also works.
// The sensors a level needs follow from the questions in its tree.
// TODO(Dominik): check that the item combinations and trucks make agricultural sense.
import { ask } from './tree.js';

// Trucks: the symbol painted on the truck is its etichetta (label). `sym` is drawn by art.js.
export const TRUCKS = {
  rosse: { name: 'Mele rosse', sym: 'rosse' },
  verdi: { name: 'Mele verdi', sym: 'verdi' },
  mele: { name: 'Mele sane', sym: 'mele' },
  patate: { name: 'Patate', sym: 'patate' },
  pomodori: { name: 'Pomodori', sym: 'pomodori' },
  compost: { name: 'Compost', sym: 'compost' },
  prato: { name: 'Prato (per chi è vivo)', sym: 'prato' },
  galline: { name: 'Mangime per le galline', sym: 'galline' },
  succo: { name: 'Succo', sym: 'succo' },
  mercato: { name: 'Mercato, prima scelta', sym: 'mercato' },
  grandi: { name: 'Mele grandi', sym: 'grandi' },
  piccole: { name: 'Mele piccole', sym: 'piccole' },
  passata: { name: 'Passata di pomodoro', sym: 'passata' },
};

export const LEVELS = [
  {
    id: 'rosse-verdi', title: 'Rosse o verdi',
    story: 'Il frutticoltore ha raccolto due varietà di mele. Ogni camion vuole la sua.',
    trucks: ['verdi', 'rosse'],
    tree: ask('rosso', { no: 'verdi', yes: 'rosse' }),
    items: [
      ['mela rosso', 'rosse', 2], ['mela rosso grande', 'rosse', 2],
      ['mela verde', 'verdi', 2], ['mela verde grande', 'verdi', 2],
    ],
  },
  {
    id: 'mele-patate', title: 'Mele e patate',
    story: 'Nella stessa cassetta sono finite mele e patate. Attenzione: non tutte le patate sono marroni.',
    trucks: ['mele', 'patate'],
    tree: ask('patata', { no: 'mele', yes: 'patate' }),
    items: [
      ['mela rosso', 'mele'], ['mela rosso grande', 'mele'], ['mela verde grande', 'mele'], ['mela verde', 'mele'], ['mela giallo grande', 'mele'],
      ['patata marrone', 'patate', 2], ['patata marrone grande', 'patate'], ['patata rosso', 'patate'], ['patata giallo grande', 'patate'],
    ],
  },
  {
    id: 'marce', title: 'Via le marce',
    story: 'Una mela marcia rovina tutta la cassetta. Tienile lontane da quelle sane.',
    trucks: ['mele', 'compost'],
    tree: ask('marcio', { no: 'mele', yes: 'compost' }),
    items: [
      ['mela rosso', 'mele'], ['mela rosso grande', 'mele'], ['mela verde', 'mele'], ['mela verde grande', 'mele'],
      ['mela rosso marcio', 'compost'], ['mela verde grande marcio', 'compost'], ['mela verde marcio', 'compost'], ['mela rosso grande marcio', 'compost'],
    ],
  },
  {
    id: 'tre-camion', title: 'Tre camion',
    story: 'Adesso i camion sono tre. Due cancelli: chi fa la prima domanda?',
    trucks: ['verdi', 'rosse', 'compost'],
    tree: ask('marcio', { no: ask('rosso', { no: 'verdi', yes: 'rosse' }), yes: 'compost' }),
    items: [
      ['mela rosso', 'rosse'], ['mela rosso grande', 'rosse', 2], ['mela verde', 'verdi', 2], ['mela verde grande', 'verdi'],
      ['mela rosso marcio', 'compost'], ['mela verde grande marcio', 'compost'], ['mela verde marcio', 'compost'],
    ],
  },
  {
    id: 'verme', title: 'Il verme',
    story: 'Le mele col verme piacciono alle galline. Le marce vanno nel compost.',
    trucks: ['compost', 'verdi', 'rosse', 'galline'],
    tree: ask('rosso', {
      no: ask('marcio', { no: 'verdi', yes: 'compost' }),
      yes: ask('verme', { no: 'rosse', yes: 'galline' }),
    }),
    items: [
      ['mela rosso', 'rosse'], ['mela rosso grande', 'rosse'], ['mela rosso verme', 'galline'], ['mela rosso grande verme', 'galline'],
      ['mela verde', 'verdi'], ['mela verde grande', 'verdi'], ['mela verde marcio', 'compost'], ['mela verde grande marcio', 'compost'],
    ],
  },
  {
    id: 'grandezza', title: 'Grandi e piccole',
    story: 'Il mercato paga di più le mele grandi. Le patate vanno tutte insieme.',
    trucks: ['piccole', 'grandi', 'patate'],
    tree: ask('patata', { no: ask('grande', { no: 'piccole', yes: 'grandi' }), yes: 'patate' }),
    items: [
      ['mela rosso', 'piccole'], ['mela verde', 'piccole'], ['mela verde pesante', 'piccole'],
      ['mela rosso grande', 'grandi'], ['mela verde grande', 'grandi'], ['mela rosso grande leggero', 'grandi'],
      ['patata marrone', 'patate'], ['patata marrone grande', 'patate'], ['patata rosso grande', 'patate'],
    ],
  },
  {
    id: 'peso', title: 'Il peso',
    story: 'Le mele secche sono grandi ma leggere. Il mercato le vuole pesanti.',
    trucks: ['succo', 'mercato', 'compost'],
    tree: ask('marcio', { no: ask('pesante', { no: 'succo', yes: 'mercato' }), yes: 'compost' }),
    items: [
      ['mela rosso grande', 'mercato'], ['mela verde grande', 'mercato'], ['mela verde pesante', 'mercato'], ['mela rosso pesante', 'mercato'],
      ['mela rosso grande leggero', 'succo'], ['mela giallo grande leggero', 'succo'], ['mela rosso', 'succo'], ['mela verde', 'succo'],
      ['mela rosso grande marcio', 'compost'], ['mela verde marcio', 'compost'],
    ],
  },
  {
    id: 'compost', title: 'Tutto nel compost',
    story: 'Quest\'anno i vermi hanno attaccato solo le mele rosse. Marce o col verme: compost.',
    trucks: ['compost', 'verdi', 'rosse'],
    tree: ask('marcio', {
      no: ask('rosso', { no: 'verdi', yes: ask('verme', { no: 'rosse', yes: 'compost' }) }),
      yes: 'compost',
    }),
    items: [
      ['mela rosso', 'rosse'], ['mela rosso grande', 'rosse'], ['mela rosso verme', 'compost'], ['mela rosso grande verme', 'compost'],
      ['mela verde', 'verdi'], ['mela verde grande', 'verdi'], ['mela verde marcio', 'compost'], ['mela rosso grande marcio', 'compost'],
    ],
  },
  {
    id: 'lumaca', title: 'Chi è vivo?',
    story: 'Nelle cassette si sono nascosti una lumaca e una coccinella. Riportali sul prato!',
    trucks: ['verdi', 'rosse', 'patate', 'prato'],
    tree: ask('vivo', {
      no: ask('patata', { no: ask('rosso', { no: 'verdi', yes: 'rosse' }), yes: 'patate' }),
      yes: 'prato',
    }),
    items: [
      ['mela rosso', 'rosse'], ['mela rosso grande', 'rosse'], ['mela verde', 'verdi'], ['mela verde grande', 'verdi'],
      ['patata marrone', 'patate'], ['patata rosso grande', 'patate'], ['patata marrone grande', 'patate'],
      ['lumaca marrone', 'prato'], ['coccinella rosso', 'prato'], ['lumaca giallo', 'prato'],
    ],
  },
  {
    id: 'orto', title: 'Il carretto dell\'orto',
    story: 'Dall\'orto arriva di tutto: mele, pomodori, patate, e qualche ospite.',
    trucks: ['compost', 'patate', 'pomodori', 'mele', 'prato'],
    tree: ask('vivo', {
      no: ask('marcio', {
        no: ask('mela', { no: ask('pomodoro', { no: 'patate', yes: 'pomodori' }), yes: 'mele' }),
        yes: 'compost',
      }),
      yes: 'prato',
    }),
    items: [
      ['mela rosso', 'mele'], ['mela verde grande', 'mele'],
      ['pomodoro rosso', 'pomodori'], ['pomodoro rosso grande', 'pomodori'], ['pomodoro verde', 'pomodori'],
      ['patata marrone', 'patate'], ['patata rosso grande', 'patate'], ['patata giallo', 'patate'],
      ['mela rosso marcio', 'compost'], ['pomodoro rosso marcio', 'compost'], ['patata marrone grande marcio', 'compost'],
      ['lumaca marrone', 'prato'], ['coccinella rosso', 'prato'],
    ],
  },
  {
    id: 'succo', title: 'Succo o mercato?',
    story: 'Al mercato vanno solo le mele grandi e pesanti. Le piccole diventano succo.',
    trucks: ['succo', 'mercato', 'galline', 'compost'],
    tree: ask('marcio', {
      no: ask('verme', {
        no: ask('grande', { no: 'succo', yes: ask('pesante', { no: 'galline', yes: 'mercato' }) }),
        yes: 'galline',
      }),
      yes: 'compost',
    }),
    items: [
      ['mela rosso', 'succo'], ['mela verde', 'succo'], ['mela rosso pesante', 'succo'],
      ['mela rosso grande', 'mercato'], ['mela verde grande', 'mercato'],
      ['mela giallo grande leggero', 'galline'], ['mela rosso grande leggero', 'galline'],
      ['mela verde verme', 'galline'], ['mela rosso grande verme', 'galline'],
      ['mela rosso marcio', 'compost'], ['mela verde grande marcio', 'compost'],
    ],
  },
  {
    id: 'patate-lumache', title: 'Patate e lumache',
    story: 'Mele e patate, sane e marce, e le lumache dell\'orto.',
    trucks: ['verdi', 'rosse', 'compost', 'patate', 'prato'],
    tree: ask('vivo', {
      no: ask('patata', {
        no: ask('marcio', { no: ask('rosso', { no: 'verdi', yes: 'rosse' }), yes: 'compost' }),
        yes: ask('marcio', { no: 'patate', yes: 'compost' }),
      }),
      yes: 'prato',
    }),
    items: [
      ['mela rosso', 'rosse'], ['mela rosso grande', 'rosse'], ['mela verde', 'verdi'], ['mela verde grande', 'verdi'],
      ['mela rosso marcio', 'compost'], ['mela verde grande marcio', 'compost'],
      ['patata marrone', 'patate'], ['patata rosso grande', 'patate'], ['patata giallo', 'patate'],
      ['patata marrone grande marcio', 'compost'], ['patata rosso marcio', 'compost'],
      ['lumaca marrone', 'prato'], ['coccinella rosso', 'prato'],
    ],
  },
  {
    id: 'pere', title: 'Pere e mele',
    story: 'Per le pere il mercato guarda il peso, per tutto il resto la grandezza. I pomodori piccoli diventano succo.',
    trucks: ['succo', 'mercato', 'prato', 'galline', 'compost'],
    tree: ask('marcio', {
      no: ask('verme', {
        no: ask('pera', {
          no: ask('vivo', { no: ask('grande', { no: 'succo', yes: 'mercato' }), yes: 'prato' }),
          yes: ask('pesante', { no: 'succo', yes: 'mercato' }),
        }),
        yes: 'galline',
      }),
      yes: 'compost',
    }),
    items: [
      ['mela rosso', 'succo'], ['mela verde pesante', 'succo'], ['mela rosso grande', 'mercato'], ['mela verde grande leggero', 'mercato'],
      ['pera giallo grande', 'mercato'], ['pera verde pesante', 'mercato'], ['pera giallo grande leggero', 'succo'], ['pera verde', 'succo'],
      ['mela rosso verme', 'galline'], ['pera giallo grande verme', 'galline'],
      ['mela verde marcio', 'compost'], ['pera giallo marcio', 'compost'],
      ['mela giallo grande', 'mercato'], ['pomodoro rosso pesante', 'succo'], ['pomodoro rosso grande', 'mercato'],
      ['lumaca giallo', 'prato'],
    ],
  },
  {
    id: 'cooperativa', title: 'La cooperativa',
    story: 'Alla cooperativa arriva il raccolto di tutta la valle. Ogni prodotto ha le sue regole.',
    trucks: ['succo', 'mercato', 'passata', 'galline', 'prato', 'compost'],
    tree: ask('marcio', {
      no: ask('vivo', {
        no: ask('patata', {
          no: ask('pomodoro', {
            no: ask('grande', { no: 'succo', yes: 'mercato' }),
            yes: ask('rosso', { no: 'mercato', yes: 'passata' }),
          }),
          yes: ask('grande', { no: 'galline', yes: 'mercato' }),
        }),
        yes: 'prato',
      }),
      yes: 'compost',
    }),
    items: [
      ['mela rosso', 'succo'], ['mela verde pesante', 'succo'], ['mela rosso grande', 'mercato'], ['mela verde grande leggero', 'mercato'],
      ['pomodoro rosso', 'passata'], ['pomodoro rosso grande', 'passata'], ['pomodoro verde', 'mercato'], ['pomodoro verde grande', 'mercato'],
      ['patata marrone', 'galline'], ['patata rosso pesante', 'galline'], ['patata marrone grande', 'mercato'], ['patata giallo grande leggero', 'mercato'],
      ['lumaca marrone', 'prato'], ['coccinella rosso', 'prato'],
      ['mela rosso marcio', 'compost'], ['pomodoro rosso grande marcio', 'compost'], ['patata marrone marcio', 'compost'],
    ],
  },
  {
    id: 'finale', title: 'Il gran finale',
    story: 'L\'ultimo carico della stagione: mele, pere e patate, tutto insieme. Buona fortuna!',
    trucks: ['succo', 'mercato', 'galline', 'compost'],
    tree: ask('patata', {
      no: ask('pera', {
        no: ask('marcio', {
          no: ask('verme', { no: ask('grande', { no: 'succo', yes: 'mercato' }), yes: 'galline' }),
          yes: 'compost',
        }),
        yes: ask('marcio', { no: ask('pesante', { no: 'succo', yes: 'mercato' }), yes: 'compost' }),
      }),
      yes: ask('marcio', { no: ask('grande', { no: 'galline', yes: 'mercato' }), yes: 'compost' }),
    }),
    items: [
      ['mela rosso', 'succo'], ['mela verde pesante', 'succo'], ['mela rosso grande', 'mercato'], ['mela verde grande leggero', 'mercato'],
      ['mela rosso verme', 'galline'], ['mela verde grande verme', 'galline'], ['mela rosso grande marcio', 'compost'],
      ['pera giallo grande', 'mercato'], ['pera verde pesante', 'mercato'], ['pera giallo grande leggero', 'succo'], ['pera verde', 'succo'],
      ['pera giallo marcio', 'compost'],
      ['patata marrone', 'galline'], ['patata rosso pesante', 'galline'], ['patata marrone grande', 'mercato'], ['patata giallo grande leggero', 'mercato'],
      ['patata marrone grande marcio', 'compost'],
    ],
  },
];
