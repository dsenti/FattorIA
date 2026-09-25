// Minigame 2 (Lo smistamento): the hand-designed levels. EDIT HERE.
//
// Each level:
//   id      stable id (saved progress refers to it; don't rename a level that players have solved)
//   title   short Italian title
//   story   one or two sentences shown above the batch (may tell the story, not the tree)
//   trucks  truck ids, drawn left to right at the bottom (see TRUCKS). Pipes may cross.
//   tree    the tree SHAPE and its SOLUTION: ask(question, { no: ..., yes: ... }) for a gate,
//           a truck id for a leaf. The game shows the shape and hides the questions.
//           ✗ (no) is drawn on the left, ✓ (yes) on the right.
//   items   the training batch: [item, truck id (the etichetta), count = 1]
//           item = tokens, see js/sorting/questions.js: type, colour, then grande, marcio, sporco,
//           strano, verme (a worm in it), lumaca (a snail on it). Default: small, healthy, clean.
//   testSize (optional) size of the test batch (default: training size)
//
// The story behind the trucks: helpers (bees, butterflies, ladybirds) are released in the orto;
// worms and snails go to the hens (galline), alone or on produce; rotten -> compost;
// covered in soil -> lavaggio; misshapen -> "brutti ma buoni".
//
// RULE (checked by `node tests/run.mjs`): exactly ONE assignment of questions (out of all 17)
// sorts the training batch 100% correctly, and every leaf gets at least one training item.
// If you change a level, run the tests: they print any other assignment that also works.
// The sensors a level needs follow from the questions in its tree.
// TODO(Dominik): check that the item combinations and trucks make agricultural sense.
import { ask } from './tree.js';

// Bump when the levels change so much that saved "solved" progress no longer fits (see storage.js).
export const LEVELS_VERSION = 2;

// Trucks: the symbol painted on the truck is its etichetta (label). `sym` is drawn by art.js.
export const TRUCKS = {
  rosse: { name: 'Mele rosse', sym: 'rosse' },
  verdi: { name: 'Mele verdi', sym: 'verdi' },
  mele: { name: 'Mele', sym: 'mele' },
  patate: { name: 'Patate', sym: 'patate' },
  carote: { name: 'Carote', sym: 'carote' },
  pomodori: { name: 'Pomodori', sym: 'pomodori' },
  pere: { name: 'Pere', sym: 'pere' },
  compost: { name: 'Compost', sym: 'compost' },
  orto: { name: 'L\'orto (per gli insetti amici)', sym: 'orto' },
  galline: { name: 'Le galline (vermi e lumache)', sym: 'galline' },
  mercato: { name: 'Il mercato', sym: 'mercato' },
  lavaggio: { name: 'Lavaggio', sym: 'lavaggio' },
  brutti: { name: 'Brutti ma buoni', sym: 'brutti' },
  grandi: { name: 'Grandi (pesanti)', sym: 'grandi' },
  piccole: { name: 'Piccoli (leggeri)', sym: 'piccole' },
};

const HENS = 'Le galline mangiano volentieri vermi e lumache.';
const HELPERS = 'Api, farfalle e coccinelle aiutano l\'orto: liberale lì.';

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
    id: 'lavare', title: 'Da lavare',
    story: 'Carote e patate appena tolte dalla terra. Quelle sporche vanno prima al lavaggio.',
    trucks: ['patate', 'carote', 'lavaggio'],
    tree: ask('sporco', { no: ask('carota', { no: 'patate', yes: 'carote' }), yes: 'lavaggio' }),
    items: [
      ['carota arancione', 'carote'], ['carota arancione grande', 'carote'], ['carota giallo', 'carote'],
      ['patata marrone', 'patate'], ['patata rosso grande', 'patate'], ['patata giallo', 'patate'],
      ['carota arancione sporco', 'lavaggio'], ['patata marrone grande sporco', 'lavaggio'], ['patata giallo sporco', 'lavaggio'], ['mela rosso sporco', 'lavaggio'],
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
    id: 'lumache', title: 'Lumache!',
    story: `Nelle cassette dell'orto ci sono lumache, da sole o attaccate alle verdure. ${HENS}`,
    trucks: ['carote', 'patate', 'galline'],
    tree: ask('lumaca', { no: ask('patata', { no: 'carote', yes: 'patate' }), yes: 'galline' }),
    items: [
      ['lumaca marrone', 'galline'], ['lumaca giallo', 'galline'], ['patata marrone lumaca', 'galline'], ['carota arancione grande lumaca', 'galline'],
      ['patata marrone', 'patate'], ['patata rosso grande', 'patate'], ['patata giallo', 'patate'],
      ['carota arancione', 'carote'], ['carota giallo grande', 'carote'], ['carota arancione grande', 'carote'],
    ],
  },
  {
    id: 'verme', title: 'Il verme',
    story: `Le mele rosse hanno i vermi, e qualche verme è uscito dalla mela. ${HENS} Le marce vanno nel compost.`,
    trucks: ['compost', 'verdi', 'rosse', 'galline'],
    tree: ask('rosso', {
      no: ask('marcio', { no: 'verdi', yes: 'compost' }),
      yes: ask('verme', { no: 'rosse', yes: 'galline' }),
    }),
    items: [
      ['mela rosso', 'rosse'], ['mela rosso grande', 'rosse'], ['mela rosso verme', 'galline'], ['mela rosso grande verme', 'galline'], ['verme rosso', 'galline'],
      ['mela verde', 'verdi'], ['mela verde grande', 'verdi'], ['mela verde marcio', 'compost'], ['mela verde grande marcio', 'compost'],
    ],
  },
  {
    id: 'peso', title: 'Il peso',
    story: 'Le mele si vendono a peso: grandi e pesanti da una parte, piccole e leggere dall\'altra. Le patate vanno tutte insieme.',
    trucks: ['piccole', 'grandi', 'patate', 'compost'],
    tree: ask('marcio', {
      no: ask('patata', { no: ask('pesante', { no: 'piccole', yes: 'grandi' }), yes: 'patate' }),
      yes: 'compost',
    }),
    items: [
      ['mela rosso', 'piccole'], ['mela verde', 'piccole'], ['mela rosso grande', 'grandi'], ['mela verde grande', 'grandi'],
      ['patata marrone', 'patate'], ['patata marrone grande', 'patate'], ['patata rosso grande', 'patate'],
      ['mela rosso grande marcio', 'compost'], ['patata marrone marcio', 'compost'], ['mela verde marcio', 'compost'],
    ],
  },
  {
    id: 'brutti', title: 'Brutti ma buoni',
    story: 'Una carota gemella è buona come le altre: non si butta! Le verdure strane hanno il loro camion.',
    trucks: ['mercato', 'lavaggio', 'brutti', 'compost'],
    tree: ask('marcio', {
      no: ask('strano', { no: ask('sporco', { no: 'mercato', yes: 'lavaggio' }), yes: 'brutti' }),
      yes: 'compost',
    }),
    items: [
      ['carota arancione', 'mercato'], ['patata marrone grande', 'mercato'], ['pera verde', 'mercato'], ['mela rosso', 'mercato'],
      ['carota arancione sporco', 'lavaggio'], ['patata giallo sporco', 'lavaggio'],
      ['carota arancione strano', 'brutti'], ['patata marrone strano', 'brutti'], ['pera giallo grande strano', 'brutti'], ['carota giallo strano sporco', 'brutti'],
      ['pomodoro rosso marcio', 'compost'], ['carota arancione marcio', 'compost'],
    ],
  },
  {
    id: 'orto', title: 'Gli amici dell\'orto',
    story: `${HELPERS} ${HENS}`,
    trucks: ['verdi', 'rosse', 'orto', 'galline'],
    tree: ask('lumaca', {
      no: ask('vivo', {
        no: ask('rosso', { no: 'verdi', yes: 'rosse' }),
        yes: ask('verme', { no: 'orto', yes: 'galline' }),
      }),
      yes: 'galline',
    }),
    items: [
      ['mela rosso', 'rosse'], ['mela rosso grande', 'rosse'], ['mela verde', 'verdi'], ['mela verde grande', 'verdi'],
      ['mela verde lumaca', 'galline'], ['lumaca marrone', 'galline'], ['verme rosso', 'galline'],
      ['ape giallo', 'orto'], ['farfalla arancione', 'orto'], ['coccinella rosso', 'orto'], ['farfalla giallo', 'orto'],
    ],
  },
  {
    id: 'carretto', title: 'Il carretto dell\'orto',
    story: 'Carote e pomodori appena raccolti, sporchi, marci, e qualche ape curiosa.',
    trucks: ['carote', 'pomodori', 'lavaggio', 'compost', 'orto'],
    tree: ask('vivo', {
      no: ask('marcio', {
        no: ask('sporco', { no: ask('pomodoro', { no: 'carote', yes: 'pomodori' }), yes: 'lavaggio' }),
        yes: 'compost',
      }),
      yes: 'orto',
    }),
    items: [
      ['carota arancione', 'carote'], ['carota giallo grande', 'carote'], ['carota arancione grande', 'carote'],
      ['pomodoro rosso', 'pomodori'], ['pomodoro rosso grande', 'pomodori'], ['pomodoro verde', 'pomodori'],
      ['carota arancione sporco', 'lavaggio'], ['pomodoro rosso sporco', 'lavaggio'],
      ['pomodoro rosso marcio', 'compost'], ['carota arancione grande marcio', 'compost'],
      ['ape giallo', 'orto'], ['farfalla arancione', 'orto'], ['coccinella rosso', 'orto'],
    ],
  },
  {
    id: 'pere', title: 'Pere a peso',
    story: `Le pere si vendono a peso. Le mele stanno tutte insieme. Via prima le lumache: ${HENS.toLowerCase()}`,
    trucks: ['piccole', 'grandi', 'mele', 'galline', 'compost'],
    tree: ask('lumaca', {
      no: ask('marcio', {
        no: ask('verme', {
          no: ask('pera', { no: 'mele', yes: ask('pesante', { no: 'piccole', yes: 'grandi' }) }),
          yes: 'galline',
        }),
        yes: 'compost',
      }),
      yes: 'galline',
    }),
    items: [
      ['pera giallo', 'piccole'], ['pera verde', 'piccole'], ['pera giallo grande', 'grandi'], ['pera verde grande', 'grandi'],
      ['mela rosso', 'mele'], ['mela verde grande', 'mele'], ['mela giallo', 'mele'],
      ['pera giallo grande verme', 'galline'], ['mela rosso verme', 'galline'], ['verme rosso', 'galline'],
      ['mela rosso marcio lumaca', 'galline'], ['lumaca giallo', 'galline'], ['pera verde lumaca', 'galline'],
      ['pera giallo marcio', 'compost'], ['mela verde grande marcio', 'compost'],
    ],
  },
  {
    id: 'mercato', title: 'Al mercato',
    story: `Al mercato solo verdura pulita e bella. ${HELPERS} ${HENS}`,
    trucks: ['mercato', 'lavaggio', 'brutti', 'compost', 'orto', 'galline'],
    tree: ask('lumaca', {
      no: ask('vivo', {
        no: ask('marcio', {
          no: ask('strano', { no: ask('sporco', { no: 'mercato', yes: 'lavaggio' }), yes: 'brutti' }),
          yes: 'compost',
        }),
        yes: ask('verme', { no: 'orto', yes: 'galline' }),
      }),
      yes: 'galline',
    }),
    items: [
      ['carota arancione', 'mercato'], ['patata marrone grande', 'mercato'], ['pomodoro rosso', 'mercato'],
      ['carota arancione sporco', 'lavaggio'], ['patata marrone sporco', 'lavaggio'],
      ['carota arancione grande strano', 'brutti'], ['patata giallo strano sporco', 'brutti'], ['pomodoro rosso strano', 'brutti'],
      ['pomodoro rosso marcio', 'compost'], ['patata marrone marcio sporco', 'compost'],
      ['ape giallo', 'orto'], ['farfalla giallo', 'orto'], ['coccinella rosso', 'orto'],
      ['verme rosso', 'galline'], ['lumaca marrone', 'galline'], ['patata marrone sporco lumaca', 'galline'],
    ],
  },
  {
    id: 'cooperativa', title: 'La cooperativa',
    story: `Alla cooperativa arriva il raccolto di tutta la valle. ${HENS} ${HELPERS}`,
    trucks: ['mele', 'galline', 'patate', 'lavaggio', 'compost', 'orto'],
    tree: ask('lumaca', {
      no: ask('vivo', {
        no: ask('marcio', {
          no: ask('patata', {
            no: ask('verme', { no: 'mele', yes: 'galline' }),
            yes: ask('sporco', { no: 'patate', yes: 'lavaggio' }),
          }),
          yes: 'compost',
        }),
        yes: ask('verme', { no: 'orto', yes: 'galline' }),
      }),
      yes: 'galline',
    }),
    items: [
      ['mela rosso', 'mele'], ['mela verde grande', 'mele'], ['mela giallo', 'mele'],
      ['mela rosso verme', 'galline'], ['mela verde grande verme', 'galline'],
      ['patata marrone', 'patate'], ['patata rosso grande', 'patate'], ['patata marrone sporco', 'lavaggio'], ['patata giallo grande sporco', 'lavaggio'],
      ['mela rosso marcio', 'compost'], ['patata marrone marcio', 'compost'],
      ['ape giallo', 'orto'], ['farfalla arancione', 'orto'], ['coccinella rosso', 'orto'],
      ['verme rosso', 'galline'], ['lumaca marrone', 'galline'], ['patata marrone sporco lumaca', 'galline'], ['mela verde lumaca', 'galline'],
    ],
  },
  {
    id: 'finale', title: 'Il gran finale',
    story: 'L\'ultimo carico della stagione: le carote hanno le loro regole, mele e patate le loro. Arrivano anche gli ospiti dell\'orto.',
    trucks: ['mercato', 'lavaggio', 'brutti', 'compost', 'galline', 'orto'],
    tree: ask('carota', {
      no: ask('vivo', {
        no: ask('verme', { no: ask('sporco', { no: 'mercato', yes: 'lavaggio' }), yes: 'galline' }),
        yes: ask('verme', { no: 'orto', yes: 'galline' }),
      }),
      yes: ask('lumaca', {
        no: ask('marcio', {
          no: ask('strano', { no: ask('sporco', { no: 'mercato', yes: 'lavaggio' }), yes: 'brutti' }),
          yes: 'compost',
        }),
        yes: 'galline',
      }),
    }),
    items: [
      ['mela rosso', 'mercato'], ['mela verde grande', 'mercato'], ['mela rosso verme', 'galline'], ['mela verde grande verme', 'galline'],
      ['patata marrone', 'mercato'], ['patata rosso grande', 'mercato'], ['patata marrone sporco', 'lavaggio'], ['patata giallo grande sporco', 'lavaggio'],
      ['patata marrone sporco verme', 'galline'],
      ['carota arancione', 'mercato'], ['carota giallo grande', 'mercato'], ['carota arancione sporco', 'lavaggio'],
      ['carota arancione strano', 'brutti'], ['carota giallo strano sporco', 'brutti'],
      ['carota arancione marcio', 'compost'], ['carota giallo grande marcio strano', 'compost'],
      ['carota arancione lumaca', 'galline'], ['carota arancione grande marcio lumaca', 'galline'],
      ['ape giallo', 'orto'], ['farfalla arancione', 'orto'], ['coccinella rosso', 'orto'], ['verme rosso', 'galline'],
    ],
  },
];
