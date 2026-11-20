// Minigame "La piazza": IA o no? (lesson 1). The cards of the quiz: a farm (or everyday) machine,
// whether it is AI, and why in one short line. AI here means: it learned from examples (data) to
// recognise, predict or decide. Not AI: it follows fixed rules written by a person, or only measures.
// lvl 1 = clear, 2 = needs a thought, 3 = tricky. icon = sprite qz_<icon> (tools/pixelart/uigen.py).
// TODO(Dominik): check every verdict and reason, above all the lvl 3 cards (gps, mungitrice, collare).
export const QUIZ_VERSION = 1;

export const CARDS = [
  // ---- level 1
  { id: 'vite', ai: true, lvl: 1, icon: 'phone_leaf', title: 'App che riconosce la malattia della vite da una foto', why: 'Ha imparato da migliaia di foto di foglie, con l’etichetta giusta.' },
  { id: 'drone', ai: true, lvl: 1, icon: 'drone', title: 'Drone che trova le piante malate nel campo', why: 'Riconosce le piante malate nelle immagini: ha imparato da esempi.' },
  { id: 'chat', ai: true, lvl: 1, icon: 'chat', title: 'Chatbot che risponde alle domande sul trattore', why: 'Ha imparato a scrivere leggendo tantissimi testi.' },
  { id: 'erbacce', ai: true, lvl: 1, icon: 'robot', title: 'Robot che distingue le erbacce dalle piantine e le toglie', why: 'Ha imparato da tante foto di erbacce e di piantine.' },
  { id: 'traduttore', ai: true, lvl: 1, icon: 'bubbles', title: 'Traduttore automatico dall’olandese all’italiano', why: 'Ha imparato da milioni di frasi già tradotte.' },
  { id: 'timer', ai: false, lvl: 1, icon: 'sprinkler', title: 'Irrigazione che si accende ogni giorno alle 6', why: 'Segue un orario fisso: non impara niente.' },
  { id: 'calcolatrice', ai: false, lvl: 1, icon: 'calc', title: 'Calcolatrice', why: 'Fa i calcoli sempre con le stesse regole.' },
  { id: 'bilancia', ai: false, lvl: 1, icon: 'scale', title: 'Bilancia elettronica per il formaggio', why: 'Misura il peso. Non impara e non decide.' },
  { id: 'recinto', ai: false, lvl: 1, icon: 'fence_bolt', title: 'Recinto elettrico per le mucche', why: 'Dà la scossa sempre, a tutti: nessuna decisione.' },
  { id: 'allarme', ai: false, lvl: 1, icon: 'bell', title: 'Allarme della stalla che suona se si apre la porta', why: 'Una regola sola, scritta da una persona: porta aperta, suona.' },
  // ---- level 2
  { id: 'zoppia', ai: true, lvl: 2, icon: 'camera_cow', title: 'Telecamera che capisce se una mucca zoppica', why: 'Ha imparato da video di mucche sane e di mucche zoppe.' },
  { id: 'trappola', ai: true, lvl: 2, icon: 'trap', title: 'Trappola che fotografa gli insetti e conta le cimici da sola', why: 'Riconosce gli insetti nelle foto: ha imparato da esempi.' },
  { id: 'satellite', ai: true, lvl: 2, icon: 'satellite', title: 'Previsione del raccolto dalle immagini dei satelliti', why: 'Ha imparato dai campi e dai raccolti degli anni passati.' },
  { id: 'viso', ai: true, lvl: 2, icon: 'phone_face', title: 'Telefono che si sblocca con il tuo viso', why: 'Ha imparato a riconoscere i volti da moltissime foto.' },
  { id: 'serra', ai: false, lvl: 2, icon: 'thermo', title: 'Serra che apre le finestre sopra i 30 °C', why: 'Una regola fissa: sopra 30 °C apri. Non impara.' },
  { id: 'meteo', ai: false, lvl: 2, icon: 'weather', title: 'Stazione meteo che misura la pioggia', why: 'Raccoglie dati, ma da sola non impara. I suoi dati però servono all’IA!' },
  { id: 'semaforo', ai: false, lvl: 2, icon: 'traffic', title: 'Semaforo a tempo in paese', why: 'Cambia colore con un orario fisso.' },
  // ---- level 3
  { id: 'gps', ai: false, lvl: 3, icon: 'tractor_gps', title: 'Trattore con guida GPS che segue la linea che hai tracciato', why: 'Segue la tua linea con il GPS: è automatico, ma non ha imparato da esempi.' },
  { id: 'tastiera', ai: true, lvl: 3, icon: 'keyboard', title: 'Tastiera del telefono che suggerisce la parola dopo', why: 'Ha imparato da tanti testi quale parola viene di solito dopo.' },
  { id: 'mungitrice', ai: false, lvl: 3, icon: 'milk', title: 'Mungitrice che si stacca quando il latte smette di scendere', why: 'Un sensore e una regola fissa: poco latte, stop.' },
  { id: 'musica', ai: true, lvl: 3, icon: 'music', title: 'App che ti consiglia le canzoni', why: 'Impara dalle canzoni che tu e altri ascoltate.' },
  { id: 'collare', ai: false, lvl: 3, icon: 'collar', title: 'Collare che conta i passi della mucca', why: 'Conta e basta. Ma con i suoi dati un’IA potrebbe capire se la mucca sta male.' },
  { id: 'spam', ai: true, lvl: 3, icon: 'mail', title: 'Posta che sposta lo spam in una cartella da sola', why: 'Ha imparato da messaggi che le persone hanno segnato come spam.' },
];

// The three rounds: which card levels they draw from (first the round's own level) and the time per card.
export const ROUNDS = [
  { id: 'giro1', levels: [1], seconds: 9 },
  { id: 'giro2', levels: [2, 1], seconds: 8 },
  { id: 'giro3', levels: [3, 2], seconds: 7 },
];
