# Game spec

**Status:** DRAFT. Minigames 1, 2 and 3 are built (minigame 3 as a first version, to be corrected by Dominik). The game-dev agent builds from this file.

## Concept
The game is a small farm valley in the Matese called **FattorIA** (fattoria + IA). The player runs a data lab that serves the valley's farmers. The main screen is a **map**. Each place on the map (the weighing station, the orchard, the barn, …) opens one **minigame**. Each minigame reinforces one lesson (L2–L4). Coins from the minigames buy upgrades, and as the course goes on, more places on the map unlock.

The minigames are small and quick: one round takes 1–3 minutes, so a student can play a few rounds at the end of a lesson or on the bus.

## Platform and hosting (decided)
- **Phone first, in the browser.** Portrait orientation. It must also work on the school computers (the same layout, centred). Keep touch targets ≥ 44 px, put the controls in the bottom half where the thumb reaches, and use no hover-only interactions.
- **No build step, no framework:** plain HTML, CSS and JavaScript (ES modules). Draw the minigames with `<canvas>` or SVG, and build the map and menus in HTML/SVG. Reasons: the minigames are simple, there is nothing to install or compile, and any Claude session or student can open the files and understand them. A game engine such as Phaser would add weight without adding anything we need.
- **Hosting:** GitHub Pages at https://dsenti.github.io/FattorIA/ (public repo `dsenti/FattorIA`, pushed from `Game/` with `git subtree`). Every push deploys automatically. To run it locally, use `python3 -m http.server` in `Game/`.
- **Offline:** once loaded, it should keep working without network access (a small service worker caches the files). The school Wi-Fi may be poor.
- **Progress:** saved only in the phone's browser (`localStorage`): coins, upgrades, unlocked places. There are no accounts and no personal data. Add a "Ricomincia" (restart) button. The only thing that leaves the phone is the leaderboard entry (see below).
- **Assets:** simple flat vector art in the course palette (`course/STYLE.md`: soil `#5B3A29`, olive `#6B7F2A`, wheat `#E9D8A6`, cream `#FBF7EF`, tomato `#D9502B`, sky `#4A8FA3`). Keep the total download small (target < 2 MB).
- **Language:** the UI is in Italian. Technical terms use the same Italian words as `course/CONCEPTS.md`, with the English in brackets the first time they appear.

## Leaderboard (class classifica)
GitHub Pages only serves files, so the leaderboard needs a small free hosted database. The proposal is **Supabase** (free tier). The game stays a static site and talks to the database directly from the browser. There is no server of our own.

**Names: players pick, they never type.** There is no free-text field anywhere, so nobody can enter an insult or their real name. When a student first opens the game, it offers three random names, and the student can reroll for three new ones or pick one:
- **name = emoji + noun + adjective**, e.g. "🐄 Mucca Coraggiosa", "🌰 Castagna Veloce", "🥕 Carota Saggia". The lists are hand-curated so that no combination is rude (check every noun–adjective pair once). Nouns are farm animals, crops and tools. Adjectives are positive or funny.
- a **2-digit number** is added (e.g. "🐄 Mucca Coraggiosa 27") so that two students can't end up with the same name.
- the name is stored as **list indices** (emoji 4, noun 12, adjective 7, number 27), not as text. The database only accepts indices within the list sizes, so even someone who tampers with the page can't write a free-text name.
- To know who is who, students tell Dominik their game name in class. The database never learns a real name.

**What is stored per player:** a random player ID (generated on the phone), the name indices, and the score. Nothing else: no email, no login, no IP address kept by us. This avoids personal data, but TODO(Dominik): tell the school anyway, since the students are minors.

**Score:** TODO(Dominik): total coins earned (rewards playing a lot) or the average pay per farmer (rewards fitting well)? The proposal: show both as two tabs, "Più ricchi" (richest) and "Più precisi" (most precise).

**Cheating:** a determined student could post a fake score from the browser console. That is acceptable for a class game. Dominik can delete entries in the Supabase dashboard, and the database caps scores at plausible values.

**Setup:** Dominik creates a free Supabase project. The public key goes into the game code (safe, since row-level security allows only insert and update of one's own row, plus reading the board). If the database is unreachable, the game still works and just hides the leaderboard.

## Map
TODO(Dominik): sketch it. The proposal is one illustrated valley (mountains, river, fields, a village) that you can scroll or pan. Places are tappable icons, and locked places are greyed out with "Si sblocca nella lezione X" (unlocks in lesson X). The coin counter is always visible at the top.

---

## Minigame 1: La stazione di pesatura (the weighing station)
**Lesson:** L2. **Concepts:** dato, dataset; caratteristica (feature); obiettivo da prevedere (target); regressione lineare, retta migliore (line of best fit); errore (error); valore anomalo (outlier); qualità dei dati (data quality).

**Story.** Farmers from the valley drive up to your station, one after another, each with a truck full of their harvest. Each farmer wants a rule to predict one thing from another, for example "how heavy is an apple of this size?" You measure a sample of their crop and draw the straight line that describes it. The better your line fits their **whole** harvest, the more they pay you.

**Farmers and their data.** Each farmer brings one kind of unit. Each visit has its own hidden true line and its own noise. In reality every relationship stays sensible and positive (bigger → heavier, more feed → more milk, more daylight → more eggs). To keep students from guessing the line from the labels, each visit randomly decides the **direction of each axis**: the x-axis runs small → large or large → small, and the y-axis low → high or high → low. The line on the plot therefore falls in about half the rounds, but it always agrees with the axes. The steepness on the plot (almost flat to steep) and the height of the line are also random. Each axis shows a "−" and a small icon at its low end, and a "+", a big icon and an arrowhead at its high end; a reversed axis is drawn in tomato red, and a one-time message warns about it the first time. The sliders, the reveal and the scoring all work on the plot as drawn. Only the first farmer has normal axes and a fixed easy line. The numbers don't need to be realistic, and **the axes have no numbers**: they show only the quantity with a small icon (e.g. "lunghezza 🥕" → "peso 🥕"). Every unit goes through the scanner, which measures x and y.
| Farmer | Unit on the truck | x (caratteristica) | y (obiettivo) |
|---|---|---|---|
| Frutticoltore (fruit grower) | mela annurca (Annurca apple) | grandezza (size) | peso (weight) |
| Orticoltore (vegetable grower) | carota (carrot) | lunghezza (length) | peso (weight) |
| Allevatore (dairy farmer) | mucca (cow): walks off a livestock trailer and through the scanner | mangime al giorno (feed per day) | latte al giorno (milk per day) |
| Castanicoltore (chestnut grower) | castagna (chestnut) | grandezza | peso |
| Vignaiolo (winegrower) | grappolo (bunch of grapes) | lunghezza | peso |
| Allevatrice di galline (poultry farmer) | gallina (hen) | ore di luce (hours of daylight) | uova a settimana (eggs per week) |
| Zucche (pumpkin grower) | zucca (pumpkin) | circonferenza (circumference) | peso |

TODO(Dominik): check the list and add any Matese crops or animals the students would enjoy. Animals are single units rather than crates, so "units per tap" means "animals per trip".

**Round flow**
1. **A farmer arrives.** The truck drives in, and a speech bubble says what they want to know ("Voglio sapere quanto pesa una mela dal suo diametro").
2. **Collect data.** Tap the truck. The farmer walks to it, lifts crates from the pile in the truck bed (back row first, top to bottom, then the next row forward) and puts them on the conveyor belt (about 1 s animation). The fruit rolls through the **scanner**, and each fruit pops out as a dot on the scatter plot above. While the farmer is carrying a crate, the truck can't be tapped again. This cooldown makes getting data cost something, so you can't spam it. The truck holds a limited number of crates, stacked in 3D (3 at the start; see Upgrades), and each crate holds a fixed number of units (`UNITS_PER_BOX` = 1: one object is one data point, so a level-0 truck gives 3 dots). A crate counter shows how many are left. When the truck is empty, the data runs out: once the last load has left the bed and the farmer is clear, the truck drives away by itself after a short pause (about 0.5 s) and stays gone until the next farmer. Blocca still works after it has left. The farmer's whole harvest is larger than what fits in the truck, and the rest is never measured.
3. **Fit the line.** Two ways, chosen in Impostazioni ("Come muovi la retta"; default: sliders; kept on Ricomincia, applies at once). **Cursori:** two big sliders under the plot, **pendenza (slope)** and **intercetta (intercept)**, with no numbers. **Trascina la retta:** the line has two big round handles at the left and right edges of the plot; dragging one moves that end up or down, so the line pivots around the other. The sliders are hidden, and a short line under the plot names the two quantities in words only (e.g. "pendenza (slope): ↗ in salita · intercetta (intercept): in alto"). Either way the line moves live, and you can collect more crates and adjust the line in any order. At scanner level 100 both are automatic.
4. **Lock it in.** Tap "Blocca la retta" (lock the line).
5. **Reveal.** The whole harvest appears on the plot as faint dots, the best line (retta migliore) is drawn next to yours, and the vertical gaps from each dot to *your* line flash briefly. This is the errore. The farmer reacts (😐 / 🙂 / 😄, and 🤩 for a perfect fit), and the coins count up (0–10).
6. **Next farmer.**

**Scoring.** Compare the average error of the player's line on the whole harvest with the average error of the best line on the whole harvest (ratio = player's error ÷ best error). The farmer pays **0–10 coins**, and only a truly perfect fit pays 10. Bad fits pay about what they did on the first 0–5 scale, but close fits pay much more, and anything even slightly off drops quickly to 9 or 8. Starting thresholds (to tune, in `config.js`): ratio ≤ 1.002 → 10, ≤ 1.01 → 9, ≤ 1.03 → 8, ≤ 1.05 → 7, ≤ 1.10 → 6, ≤ 1.20 → 5, ≤ 1.35 → 4, ≤ 1.5 → 3, ≤ 2 → 2, ≤ 3 → 1, otherwise 0. TODO(Dominik): the big payouts are meant to fund unlocking the next place on the map later. Scoring uses the whole harvest, not only the sample, so a line that hugs a small, unlucky sample earns less. In L2, the UI calls this "il raccolto intero" (the whole harvest). After L3 the reveal screen also names it: "addestramento" for the measured sample and "test" for the whole harvest (see CONCEPTS: training vs test is introduced in L3).

**Upgrades (the shop).** There is one scanner, one truck and one unloading setup (scarico). Each machine looks bigger and better at every level: the scanner goes from a crooked wooden frame to a "MEGA SCANNER", and the truck from a motocarro to a futuristic truck. Each starts at level 0 and has **10 levels**. **Buying level *n* costs *n* coins**, so each track costs 55 coins in total, 165 for all three, which is roughly 35–50 farmers. The tracks compete for the same coins, so the player keeps choosing between **better data** (scanner) and **more data** (truck). Scarico only saves time:
| Upgrade | Effect from level 0 to level 10 (starting values, to tune) | Teaches |
|---|---|---|
| Scanner | less noise (the dots sit closer to the true line) and fewer outliers. At level 0 about 1 dot in 8 is a glitch; at level 10 there are none. The noise halves from level 0 to level 5 and keeps falling after that; at level 10 there is practically none (the measured dots sit on the true values within a hair). Each scanned object is still a real, varied object, so the dots still spread around the line. **Secret level 100** ("Scanner intelligente"): only after level 10 is bought, the scanner card shows a surprise (🎁, "Livello ???", 100 coins). Buying it plays a finale and reveals "Livello 100": the MEGA SCANNER with a small computer on top. Same noise as level 10, but it fits by itself: while dots arrive, the line keeps following the least-squares line of **the points measured so far** (never the whole harvest), the sliders move with it, and once the truck is empty and the belt is clear it locks by itself. Manual sliders and Blocca are off at level 100 | qualità dei dati, valore anomalo |
| Camion (truck) | crates per truck: 3, ×1.5 per level, rounded (3, 5, 7, 10, 15, 23, 34, 51, 77, 115, 173) | more data → more reliable line |
| Scarico (unloading) | objects carried per trip: 1 → 11. First more people (the farmer, then with his son Ciro, then with nonna Titina), then tools (carrello, carriola, transpallet, muletto, trattore con pala, sollevatore telescopico, robot arm, autonomous robot). The data stays the same; the truck just empties faster. At level 10 one tap empties the whole truck: the robot shuttles in one continuous animation of about 2.5 s, whatever the truck size | (speed) |

**Outliers.** At low scanner levels, the scanner glitches and produces dots far from the others (a stone in the crate, a double reading). They look like normal dots. If the player follows them with the line, they earn less. Upgrading the scanner removes them gradually. There is **no outlier-detection tool** in the first version (see Extensions).

**Difficulty curve.** The first farmer: low noise, no outliers, and a line that is easy to see. Later farmers: more noise, glitches, and trickier slopes, e.g. a small intercept or a steep slope.

**Mobile layout (portrait, top to bottom):** coins and farmer bubble → scatter plot (about 45% of the height) → truck, belt and scanner strip → two sliders and the "Blocca" button.

**Win condition.** None: it is endless, even after all upgrades are maxed. Farmers keep coming, and coins keep buying upgrades. A "Giornata finita" (day done) summary appears every 5 farmers.

**Decided**
- The sliders are called **pendenza (slope)** and **intercetta (intercept)**, not "bias" (bias is the L6 concept). Change request filed to add both to L2 in `CONCEPTS.md`.
- The minigame stays in L2. The words addestramento / test appear only after L3 (see Scoring).
- The numbers don't need to be realistic, and there are no numbers on the axes or sliders.
- The game is endless.
- 10 levels per upgrade, level *n* costs *n* coins, and a perfect fit pays 10 coins (0–10 scale). These are starting values to tune.
- No outlier detection in the first version.

**Extensions (later, after the base minigame works)**
Both unlock once the scanner, belt and truck are all at level 10:
1. **Demo: regressione.** Partly replaced by the secret scanner level 100 (see Upgrades): the scanner already finds the best line of the measured points by itself, and students watch it settle as data arrives, so students see that "a machine learns the trend from data". A guided demo could still show it step by step. TODO(Dominik): keep the demo or drop it?
2. **Demo: valori anomali.** The scanner can be switched back to "broken" mode. Glitch dots appear, and the player taps them to remove them and sees the best line jump back into place.

TODO(Dominik): details once the base minigame is play-tested.

**Open questions**
- Labels ("good vs bad labels" in the sketch) are covered by minigame 2 (the truck symbols).

---

## Minigame 2: Lo smistamento (the sorting station)
**Lesson:** L3. **Concepts:** classificazione (classification); etichetta (label): the truck an item belongs in; albero di decisione (decision tree); caratteristica (feature), from L2; addestramento vs test (training vs test); accuratezza (accuracy). Overfitting is not a mechanic here (see the open questions).

**Story.** Harvest arrives at the valley's sorting station all mixed up: red and green apples, pears, potatoes, carrots, tomatoes, rotten produce, produce covered in soil or oddly shaped, and the garden's animals: bees, butterflies and ladybirds, snails and worms, either alone or sitting on (or in) the produce. A sorting machine, the decision tree, drops each item from a hopper at the top through pipes and gates into the right truck at the bottom. The pipes are already built. The player decides **which question each gate asks**.

The story behind the trucks:
- **helpers** (bee, butterfly, ladybird) are released in the **orto** (vegetable garden);
- **worms and snails** go to the **galline** (hens eat them), whether alone or on produce ("Le galline mangiano volentieri vermi e lumache." in the level intros);
- **rotten** → compost; **covered in soil** → lavaggio (washing); **misshapen** → "brutti ma buoni" (ugly but good: no food waste);
- the rest goes to the single-type or single-colour trucks (mele rosse, carote, …), to the scale trucks (grandi / piccoli), or to the market.

**Screen (portrait, top to bottom, following Dominik's sketch):**
1. **Hopper and batch:** the training batch as a grid at the top. Under every item a small tag shows its truck symbol: its **etichetta (label)**, as in a real labelled training set. Tapping an item shows its features as question icons with ✓/✗ (features whose sensor isn't bought show a lock).
2. **The tree:**
   - Every internal node is a square gate. Each gate has two exits: ✓ (sì) to the right and ✗ (no) to the left, drawn as icons, not text.
   - The **shape of the tree is fixed** per level. Empty gates show a "?" and pulse gently.
   - Each leaf ends in a **pipe** that runs down to a truck. Several leaves can pipe into the same truck, and pipes may cross, as in the sketch.
   - At most 5 gates per row, up to 6 trucks. Big trees scroll vertically; nothing needs horizontal scrolling on 360 px.
3. **Trucks:** a row of trucks at the bottom, each with a big symbol painted on it saying what it wants. The symbol is the **etichetta (label)**. Symbols are built per level from the items that go into the truck (`js/sorting/trucks.js`), so they always show exactly what goes in, without needing the level text:
   - type trucks show that type in every colour that goes in (e.g. "mele": red, green and yellow apples; "carote": orange and yellow);
   - the scale trucks (grandi / piccoli) show that level's produce on a heavy or light pan (pears in "Pere a peso");
   - lavaggio shows a dirty item that is washed there under a tap; brutti ma buoni a misshapen one with a heart;
   - compost (bin), galline (hen), orto (garden bed with a flower) and mercato (market stall with a striped awning) are fixed.
   A test checks that no symbol shows produce that can't go into its truck.
4. **Pipes:** the connectors between gates are metal pipes; the ✗ (no) marker on the left branch is red, the ✓ (yes) on the right green. Each downpipe from a leaf to its truck is tinted like its truck (compost green, lavaggio blue, galline cream, orto pink, mercato red, brutti orange, …), so crossing pipes can be told apart; leaves going to the same truck share its colour. Colours differ clearly within every level (tested).
5. **Buttons:** "Prova l'albero" (try the tree; free, as often as you like) and "Avanti" (next), enabled after a perfect Prova.

**No emoji in this minigame:** every item, question icon, truck symbol and pipe is drawn as SVG in the course palette. (Minigame 1 still uses emoji; TODO(Dominik): convert it later for a uniform look?)

**Items.** Produce: mela, pera, patata, pomodoro, carota, drawn small or big (big always means heavy; there is no separate size feature), in five colours (rosso, verde, giallo, arancione, marrone). Produce can be marcio (soft, feathered dark patches with a pale mould halo), sporco di terra (a crisp caked layer of soil with crumbs), strano (a twin carrot, a lumpy potato, a crooked pear, a lopsided apple, a tomato with a bump), with a worm in it, or with a snail on it. Lone animals: ape (yellow), farfalla (wings in its colour), coccinella (red), lumaca (shell in its colour), verme (a saturated earthworm red). Every lone animal's drawing shows the colour the colour questions use (tested for bee, ladybird and worm).

**Choosing a question.** Tap a gate → a bottom sheet with a grid of question icons (only the ones that are free or unlocked by a bought sensor). Tap one to place it. Tap a filled gate to change it. Every question is binary and shown as a picture:
| Question | Icon | Unlocked by |
|---|---|---|
| È rosso? / verde? / giallo? / arancione? / marrone? (colour) | a paint splat in that colour | free |
| È una mela? / pera? / patata? / pomodoro? / carota? (type) | the item's dark silhouette | free |
| È una farfalla? (a distractor: no level needs it) | a butterfly silhouette | free |
| È sporco di terra? (covered in soil) | a fruit with caked soil and falling crumbs | free |
| C'è una lumaca? (a snail, alone or on produce) | a snail, drawn in colour | free |
| È marcio? (rotten) | a fruit with soft rot patches and a smell | naso elettronico |
| C'è un verme? (a worm, alone or in produce) | a red worm | rilevatore di vermi |
| È pesante? (heavy = big) | a scale tipping down | bilancia |
| Ha una forma strana? (misshapen) | a lumpy potato outline with a small heart (like the brutti ma buoni truck) | occhio delle forme |
| È un animale da solo? (only lone animals; produce with a worm or snail is not) | a beetle alone on bare ground next to a crossed-out apple | sensore di vita |

Lone animals are not produce: no produce type question is true for them. So a lone snail answers ✓ to "C'è una lumaca?" and "È un animale da solo?", while an apple with a snail answers ✓ only to "C'è una lumaca?" (and "È una mela?"). Both appear in the levels, which makes the trees harder.

**Run (Prova).** Items fall one by one from the hopper. At each gate the gate lights up and shows ✓ or ✗ for that item, the item slides down the matching branch, through the pipe, and into a truck. The view scrolls down once as the items travel, then stays at the bottom with the trucks until every item has landed. It never scrolls back up by itself, and scrolling by hand stops the auto-scroll. Afterwards:
- each wrongly sorted item gets a red ring in its truck, and tapping it (or the item in the hopper) draws its path in red and frames the right truck;
- a result bar shows "accuratezza (accuracy): 9/12 giusti";
- gates are not flagged at first. From the **3rd failed Prova on a level** (counted per level, saved, reset when the level is solved), the gates whose question differs from the level's one correct tree, and empty gates, are framed in red, with the line "Dopo 3 tentativi: i cancelli con la domanda sbagliata sono segnati in rosso." A gate the player changes loses its mark until the next failed Prova. This is for everyone, not only with the lente.
- tapping an item opens its card; tapping anywhere outside the card closes it.

**Training vs test, and "Avanti".** The batch at the top is the **addestramento (training)** batch: the player can Prova on it again and again. As soon as a Prova sorts everything right (once the last item has left the hopper, while the last items are still sliding), the tree is checked on a **new batch of the same kinds of items** that the player has not seen, the **test**. This happens instantly, without replaying the pipeline. The result bar shows "Test su 13 pezzi nuovi, mai visti: 13/13 giusti · +N" and the coins are paid at once. "Avanti" then sends the loaded trucks driving off (the last items are put into their trucks at once if they are still sliding), and the next level's trucks drive in. On the last level the button reads "Fine" and opens the level list. Because each level has exactly one correct tree, and the test only contains the training kinds, a perfect tree always scores 100% on the test. The point is that students see the tree judged on new items.

**Levels (15, hand-designed, in `js/sorting/levels.js`).** Every level has **exactly one** assignment of questions that sorts the training batch 100% correctly, out of all 18 questions on every gate. `node tests/run.mjs` checks this exhaustively (a factorised count for all levels, and a literal one-by-one brute force for the levels with up to 5 gates). It also checks that every leaf gets a training item, that the correct tree scores 100% on generated test batches, and that the story rules above hold (helpers → orto, lone worms and snails → galline).
| # | Level | Gates | Trucks | Solution questions | Sensors needed |
|---|---|---|---|---|---|
| 1 | Rosse o verdi | 1 | verdi, rosse | rosso | – |
| 2 | Mele e patate | 1 | mele, patate | patata | – |
| 3 | Via le marce | 1 | mele, compost | marcio | naso |
| 4 | Da lavare | 2 | patate, carote, lavaggio | sporco, carota | – |
| 5 | Tre camion | 2 | verdi, rosse, compost | marcio, rosso | naso |
| 6 | Lumache! | 2 | carote, patate, galline | lumaca, patata | – |
| 7 | Il verme | 3 | compost, verdi, rosse, galline | rosso, marcio, verme | naso, vermi |
| 8 | Il peso | 3 | piccole, grandi, patate, compost | marcio, patata, pesante | naso, bilancia |
| 9 | Brutti ma buoni | 3 | mercato, lavaggio, brutti, compost | marcio, strano, sporco | naso, forma |
| 10 | Gli amici dell'orto | 4 | verdi, rosse, orto, galline | lumaca, vivo, rosso, verme | vermi, vita |
| 11 | Il carretto dell'orto | 4 | carote, pomodori, lavaggio, compost, orto | vivo, marcio, sporco, pomodoro | naso, vita |
| 12 | Pere a peso | 5 | piccole, grandi, mele, galline, compost | lumaca, marcio, verme, pera, pesante | naso, vermi, bilancia |
| 13 | Al mercato | 6 | mercato, lavaggio, brutti, compost, orto, galline | lumaca, vivo, marcio, strano, sporco, verme | naso, vermi, forma, vita |
| 14 | La cooperativa | 7 | mele, galline, patate, lavaggio, compost, orto | lumaca, vivo, marcio, patata, verme, sporco, verme | naso, vermi, vita |
| 15 | Il gran finale | 9 (depth 5) | mercato, lavaggio, brutti, compost, galline, orto | carota, vivo, verme, sporco, verme, lumaca, marcio, strano, sporco | naso, vermi, forma, vita |

TODO(Dominik): check the level list, especially that the item combinations make agricultural sense (e.g. level 15: carrots are checked for shape and soil, apples for worms, potatoes for soil).

**Pay.** Coins go into the same wallet as minigame 1. The first perfect run of a level pays according to test accuracy, up to 5 + 2 × level number (in config). Replaying a solved level pays 1 coin. Levels unlock in order. The coins count for the "Più ricchi" leaderboard, but not as farmers served. Minigame 1 is the money engine, and minigame 2 mostly spends money on sensors.

**Upgrades (the minigame 2 shop, tab "Smistamento"):**
| Upgrade | Price (config) | Effect | Teaches |
|---|---|---|---|
| Naso elettronico (electronic nose) | 15 | question "È marcio?"; needed from level 3 | caratteristica: measuring a feature costs something |
| Rilevatore di vermi (worm detector) | 20 | question "C'è un verme?"; from level 7 | " |
| Bilancia (scale) | 25 | question "È pesante?"; from level 8 | " |
| Occhio delle forme (shape camera) | 25 | question "Ha una forma strana?"; from level 9 | " |
| Sensore di vita (life sensor) | 35 | question "È un animale da solo?" (lone animals, not produce with an animal on it); from level 10 | " |
| Lente d'ingrandimento (magnifying glass) | 20 | tapping a wrongly sorted item replays its path slowly, gate by gate (it no longer marks gates) | reading an error back to its cause |
| Suggerimento (hint), consumable | 3, 6, 9, … | reveals the correct question of one gate. Bought in the shop (kept in stock) or bought and used at once from the gate sheet | — |
| Nastro veloce (fast belt) | 15 | faster Prova animations | (comfort) |

Colour, type (including the butterfly distractor), soil and snail questions are free: you can see them. The former "calibro" (size gauge) is gone with the size feature; saves that had bought it get its 30 coins back.

TODO(Dominik): prices, once it has been play-tested.

**Map.** The weighing station is joined by "Lo smistamento" (the place previously shown as "Il frutteto", lesson 3). It unlocks by **paying coins** (100, in config) instead of by lesson, so the money from minigame 1 buys the next place. TODO(Dominik): or unlock by a teacher code in class? Once it is open, the shop has two tabs, "Pesatura" and "Smistamento".

**Saves.** Minigame 2 progress is stored under `sort` with a `levelsVersion`, and `fails` (failed Provas per level since it was last solved). The levels were redesigned in version 2, so older saves start the levels again but keep the place, bought sensors, hints, lente and nastro veloce (and get the calibro refund).

**Open questions**
- TODO(Dominik): overfitting (L3). A later extension could give a level with a tiny training batch where a wrong tree also scores 100% on training but fails the test. This would deliberately break the "one correct tree" rule for that level only.
- TODO(Dominik): an endless mode with randomly generated trees after the fixed levels?

## Minigame 3: Il laboratorio (the analysis lab), working title
**Lesson:** L3, as a second classification station next to the smistamento (it does not replace it). **Concepts:** classificazione (classification); etichetta (label): the colour of a point; albero di decisione (decision tree); confine di decisione (decision boundary), see the change request; caratteristica (feature), from L2; addestramento vs test (training vs test); accuratezza (accuracy); overfitting (imparare a memoria). Nothing from L4 (no distanza/somiglianza, KNN, clustering; a test checks the words).

**Idea (Dominik, 2026-09-29).** The smistamento shows a tree as questions. The laboratorio shows the same thing as a picture: every node of the tree is a **boundary line through a point cloud**, and each child node only sees the points on its side of its parent's line. Together the lines cut the field into coloured regions.

**Story.** Samples from the valley's farms come into the lab, and each one is measured on two properties. Each point is one sample, its colour (the class) is its **etichetta (label)**, and the lab has to learn to tell the classes apart from the measurements alone. The themes per level are placeholders (see the level table). TODO(Dominik): pick the themes, classes and axes per level.

**Map.** A new place "Il laboratorio" (bottom right of the valley), unlocked with coins (`CONFIG.LAB.UNLOCK_COST` = 200), like the smistamento. "La stalla" stays locked for L4. Once it is open, the shop has a third tab "Laboratorio". The day summary suggests the next place to unlock once the player has 60% of its price. TODO(Dominik): the name of the station and its place on the map.

**Screen (portrait, top to bottom), as built:**
1. **Level bar:** the levels button ("4/10", opens the level list), the title and a one-line story, and a round "ricomincia il livello" button (empty tree and new samples, after a confirmation).
2. **Legend:** each class with its colour and shape.
3. **Field (canvas):** the training samples. Axes like the pesatura's: the quantity name with its emoji, "−" and a small icon at the low end, "+", a big icon and an arrowhead at the high end, no numbers. The tree's regions are tinted softly in the colour they predict (live while editing; a branch whose node is still empty shows its colour faintly), and each line is drawn only inside its node's region, with the node number in a dark badge on top. Before the first line: "Tocca il nodo 1 qui sotto". The field takes the height the tree leaves free (at least 200 px; on small phones the tree scrolls).
4. **Training accuracy:** "Addestramento (training) · accuratezza (accuracy): 64/70 giusti" with a bar, live.
5. **Tree (SVG):** a fixed shape per level (1 to 5 nodes). A node is a rounded square with its number and a thumbnail: its region (the rest greyed), the two sides tinted with its two colours, and its line. Each branch carries a dot with its colour and shape; a leaf is a circle in the colour it predicts. Empty nodes show "?"; the ones that can be opened pulse, the ones whose parent is still empty are faded. Where both sides of a node are leaves, the leaves are drawn in the field's left-to-right order, so the tree and the field read the same way.
6. **Bottom bar:** a message line, "Prova" (enabled when every node has a line) and "Avanti" (enabled once the level is passed; "Fine" on the last level).

**Colours.** Okabe-Ito colour-blind-friendly colours, each with its own point shape as a second cue: blue circle, orange triangle, bluish green square, reddish purple diamond (`CLASS_COLOURS` in `js/lab/levels.js`).

**Node pop-up.** Tapping a node opens a card over the screen with a larger field:
- **Only the points that reach this node are shown.** Everything cut away by the parent lines is shaded out (grey with hatching), and the parent lines stay visible with their numbers. The header says how many samples arrive.
- **Step 1, pick two colours:** one chip per class, with its count in this region (colours absent here are faded but can still be picked). The two picked colours are drawn vivid; the others are desaturated and a little smaller, still readable by their shape. With only two colours in the region both are picked at once. Once two are picked, tapping a third replaces the older pick, on the same side of the line.
- **Step 2, place the line:** it starts horizontal through the middle of the region, with the colours on the sides where more of their points are (only the orientation is chosen, the line is not fitted). Two round handles at its ends move freely, at any angle (the line pivots on the other handle); grabbing the line itself slides it. The two sides are tinted with their colours; the line is solid inside the region and dashed outside it. Each side has a label: "foglia" (leaf, predicts its colour) or "al nodo N".
- A live count: "Dalla parte giusta: 31 su 34 (● 17/18 · ▲ 14/16)".
- Buttons: **Scambia i colori** (the colours trade sides, the line stays); for a node with children **Nodo N: altro lato** or **Scambia i nodi** (the next node(s) get the other side, the colours stay); **Suggerimento** (hint, see below); **Fatto**. A tap outside the card (on click, so the tap does not go on to the button underneath), ✕ or Escape also close it.
- Touch: pointer events with capture, `touch-action: none` on the pop-up; the page does not scroll while dragging (checked at 390 × 844 and 360 × 640). Grab radius 28 px for a handle, 16 px for the line.
- Lines at any angle are a deliberate choice (Dominik, 2026-09-29): this tree is "less standard" than a textbook tree, which asks about one measurement at a time and only cuts straight across. Angled lines let the regions become triangles, squares and L shapes.

**Data.** Each level has a true tree with its true lines (`js/lab/levels.js`, field coordinates 0..1). A sample picks a region (leaf) of the true tree with probability ∝ area^0.5 (`REGION_WEIGHT_POWER`, so a small triangle still gets points), a noiseless position inside it, and the region's class as its etichetta; then the instrument adds Gaussian measurement noise (the level's `noise` × `NOISE_FACTOR[precision]`; resampled, not clamped, at the edges). Clean levels also keep noiseless positions at least `gap` away from any other class. Training samples are drawn when a level is entered, after "ricomincia il livello" and after an upgrade (the tree stays); they are not saved.

**Training vs test and scoring, as built.**
- "Prova" draws `TEST_SIZE` = 40 new samples from the same distribution. They fall into the field one after another (about 1.5 s), each lands with a ✓ or ✗; the training points fade behind them. Editing a node afterwards removes the test samples; the next Prova draws new ones.
- Pay: ratio = player's test accuracy ÷ the true tree's accuracy on the same 40 samples ("albero migliore: 37/40"). Coins by thresholds like the pesatura's: ≥ 0.999 → 10, ≥ 0.97 → 9, ≥ 0.94 → 8, ≥ 0.91 → 7, ≥ 0.87 → 6, ≥ 0.82 → 5, ≥ 0.76 → 4, ≥ 0.70 → 3, ≥ 0.62 → 2, ≥ 0.50 → 1. With 40 samples: one more mistake than the true tree → 9, two → 8, three → 7. Beating the true tree by luck pays 10.
- **Pass:** a Prova worth ≥ 7 (`PASS_COINS`) passes the level and opens the next one; after a passing Prova the true lines are shown dashed in green ("confine vero").
- **No farming with the same tree:** a tree (from empty until "ricomincia il livello") earns at most 10 coins per level: each Prova pays only what it adds to the tree's record ("questo albero aveva già 6"). A tree started on a level that was already passed pays half (`REPLAY_FACTOR`, "livello già superato: metà paga"). So replaying for coins means building a new tree on new samples, about as much work as a pesatura farmer. TODO(Dominik): pay per level, replay pay, pass mark.
- **Overfitting (imparare a memoria):** after a Prova, if the player's tree beats the true tree on the training samples by ≥ 2% (`OVERFIT_TRAIN_GAIN`) and loses to it on the test by ≥ 2.5% (`OVERFIT_TEST_LOSS`), the result says "Meglio dell'albero migliore sull'addestramento, peggio sul test: ha imparato a memoria (overfitting)", and a toast explains it once per save. Measured in the tests: a tree that carves lines around stray training points on level 9 triggers it about half the time, a careful player practically never.

**Economy.**
- Unlock: 200 coins (`UNLOCK_COST`).
- Upgrades (shop tab "Laboratorio", level n costs 2n, `upgradeCost`; each applies at once with new samples, the tree stays):
  - *Più campioni* (more training samples): 70 → 150 over levels 0..10 (`SAMPLES`), times the level's `samplesFactor`.
  - *Strumento più preciso* (a more precise instrument): measurement noise × 1 → × 0.4 (`NOISE_FACTOR`, never zero), so less class overlap.
  - *Suggerimento* (hint): consumable, 3, 6, 9, … coins (`hintCost`, shared stock bought in the shop or at once in the pop-up). It shows a yellow band (`HINT_BAND` wide) roughly where one node's true line lies, and a note in the pop-up. For a spare node: "Questo nodo quasi non serve: il confine vero passa fuori dai punti."
- Coins go to the shared wallet and count for the "Più ricchi" leaderboard (pushed after each Prova, like the smistamento), not as farmers served. TODO(Dominik): tune after play-testing.

**Levels (10, in `js/lab/levels.js`).** Placeholder themes. "Nodes" is the tree shape; accuracy is the true tree's average on test samples at instrument level 0 (from `node tests/run.mjs`).
| # | Level | Theme (x · y) | Classes | Nodes, shape | True tree |
|---|---|---|---|---|---|
| 1 | Due olive | olive: grandezza · olio nel frutto | Caiazzana, Leccino | 1, one tilted line, clean (`gap`) | 100% |
| 2 | Pallagrello o Casavecchia? | uva: zucchero · acidità | Pallagrello, Casavecchia | 1, one line, overlap | 95% |
| 3 | Tre latti | latte: grasso · proteine | Mucca, Capra, Bufala | 2 in a chain, three bands | 99% |
| 4 | Il triangolo del castagno | terreno: umidità · acidità | Non adatto, Adatto al castagno | 3 in a chain, a triangle | 99% |
| 5 | Castagne in tre angoli | castagne: grandezza · dolcezza | Da farina, Da mercato, Marroni | 3, root + two children, two corners and a middle band | 98% |
| 6 | La grotta del caciocavallo | temperatura · umidità | Si rovina, Stagiona bene | 4 in a chain, a tilted square | 99% |
| 7 | Le arnie a forma di L | peso dell'arnia · temperatura | Sana, Da controllare | 3 in a chain, an L (the class in two leaves) | 100% |
| 8 | Quattro mieli | miele: colore · umidità | Acacia, Millefiori, Castagno, Sulla | 3, root + two children, four tilted quadrants | 99% |
| 9 | La mosca dell'olivo | giornate: temperatura · umidità | Niente mosca, Mosca | 5: one true line and 4 spare nodes; noise 0.1, 60% of the samples | 90% |
| 10 | Il gran finale | uva: zucchero · acidità | Pallagrello bianco, Pallagrello nero, Casavecchia, Aglianico | 5: an L on the left, a corner and a band on the right | 98% |

A spare node (level 9) has its true line in a corner outside its region: the best answer is to put the line where it cuts nothing. `node tests/run.mjs` checks: every level is well formed (2–4 classes, 1–6 nodes, lines inside the field, two different true colours per node, the regions cover the field once); there is a triangle, a square, an L, a 4-colour and an overfitting level; every true region expects ≥ 7 training points at the base sample count; the true tree scores ≥ 85% and always pays 10; a careful player (line ends within about 0.015) passes in ≥ 90% of Provas on every level, one colour everywhere in ≤ 2%; the overfitting check above; the trees fit 360 px; saves migrate; no L4 words; no emoji outside the axis icons; `sw.js` caches every JS file.

**Saves.** Under `lab`: `levelsVersion` (bump `LAB_LEVELS_VERSION` when the levels change a lot: the level progress starts over, the place, upgrades and hints stay), `unlocked`, `passed`, `current`, `boards` (level id → `{ nodes: [spec or null], best, replay }`, a spec being `{ x1, y1, x2, y2, c: [colour of branch 0, colour of branch 1], flip }`), `hinted`, `hints`, `hintsBought`, `samples`, `precision`, `seenHelp`, `seenOverfit`. Old saves get an empty lab; invalid specs are dropped. "Ricomincia" in Impostazioni closes the laboratorio again and clears it.

**Tech.** `js/lab/levels.js` (levels, colours), `model.js` (pure: geometry with convex polygon clipping, tree routing and regions, sampling, scoring, progress, layout; tested in node), `draw.js` (canvas field, SVG pieces and icons), `game.js` (the screen, pop-up, Prova), `shop.js`. The field is a canvas; the tree and the pop-up chrome are SVG and HTML. All tunables in `CONFIG.LAB`. No emoji in the lab's chrome or SVG art; the axes use emoji icons like the pesatura.

**Open questions**
- TODO(Dominik): the name of the station and its place on the map. ("La stalla" stays reserved for L4.)
- TODO(Dominik): the themes, classes and axes of every level; whether the class names should match the lesson's examples.
- TODO(Dominik): should MG3 later use SVG icons instead of emoji for the axes, like the smistamento?
- TODO(Dominik): is the "Nodo N: altro lato" button clear enough, or should the side that goes on be chosen by tapping its label on the field?
- TODO(Dominik): pay, pass mark, replay share and prices (all in `CONFIG.LAB`).

---

| Minigame | Lesson | Concepts | Status |
|---|---|---|---|
| 1. La stazione di pesatura | L2 | regressione lineare, errore, valore anomalo, qualità dei dati | designed |
| 2. Lo smistamento | L3 | classificazione, etichetta, albero di decisione, addestramento vs test, accuratezza | built (first version) |
| 3. Il laboratorio (working title) | L3 | classificazione, confine di decisione, albero di decisione, addestramento vs test, accuratezza, overfitting | built (first version) |
