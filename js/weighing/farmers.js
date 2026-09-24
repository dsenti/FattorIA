// The valley's farmers for "La stazione di pesatura".
// x = caratteristica (feature), y = obiettivo da prevedere (target).
// noise: multiplier on the natural spread of this farmer's harvest.
// TODO(Dominik): check names, questions and add Matese crops or animals the students would enjoy.

export const FARMERS = [
  {
    id: 'mele', person: 'Gennaro', role: 'frutticoltore', face: '👨‍🌾',
    unit: '🍎', unitName: 'mela annurca', animal: false,
    x: 'grandezza', y: 'peso',
    question: 'Voglio sapere quanto pesa una mela annurca dalla sua grandezza.',
    noise: 1.0,
  },
  {
    id: 'carote', person: 'Rosaria', role: 'orticoltrice', face: '👩‍🌾',
    unit: '🥕', unitName: 'carota', animal: false,
    x: 'lunghezza', y: 'peso',
    question: 'Se so quanto è lunga una carota, posso sapere quanto pesa?',
    noise: 1.0,
  },
  {
    id: 'mucche', person: 'Tonino', role: 'allevatore', face: '🧑‍🌾',
    unit: '🐄', unitName: 'mucca', animal: true,
    x: 'mangime al giorno', xIcon: '🌾', y: 'latte al giorno', yIcon: '🥛',
    question: 'Se do più mangime alle mie mucche, quanto latte fanno al giorno?',
    noise: 1.2,
  },
  {
    id: 'castagne', person: 'Pasquale', role: 'castanicoltore', face: '👨‍🌾',
    unit: '🌰', unitName: 'castagna', animal: false,
    x: 'grandezza', y: 'peso',
    question: 'Dalla grandezza di una castagna voglio prevedere il suo peso.',
    noise: 0.9,
  },
  {
    id: 'uva', person: 'Filomena', role: 'vignaiola', face: '👩‍🌾',
    unit: '🍇', unitName: 'grappolo di Pallagrello', animal: false,
    x: 'lunghezza', y: 'peso',
    question: 'Quanto pesa un grappolo di Pallagrello, se ne misuro la lunghezza?',
    noise: 1.1,
  },
  {
    id: 'galline', person: 'Assunta', role: 'allevatrice di galline', face: '👩‍🌾',
    unit: '🐔', unitName: 'gallina', animal: true,
    x: 'ore di luce', xIcon: '☀️', y: 'uova a settimana', yIcon: '🥚',
    question: 'Con più ore di luce, quante uova fanno le mie galline a settimana?',
    noise: 1.3,
  },
  {
    id: 'zucche', person: 'Michele', role: 'coltivatore di zucche', face: '🧑‍🌾',
    unit: '🎃', unitName: 'zucca', animal: false,
    x: 'circonferenza', y: 'peso',
    question: 'Dalla circonferenza di una zucca voglio sapere quanto pesa.',
    noise: 1.0,
  },
];

export const xLabel = (f) => `${f.x} ${f.xIcon || f.unit}`;
export const yLabel = (f) => `${f.y} ${f.yIcon || f.unit}`;
