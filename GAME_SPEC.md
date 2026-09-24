# Game spec

**Status:** DRAFT. Minigame 1 is designed; minigames 2 and 3 are waiting for Dominik's sketches. The game-dev agent builds from this file.

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
2. **Collect data.** Tap the truck. The farmer walks to it, lifts crates from the pile in the truck bed (back row first, top to bottom, then the next row forward) and puts them on the conveyor belt (about 1 s animation). The fruit rolls through the **scanner**, and each fruit pops out as a dot on the scatter plot above. While the farmer is carrying a crate, the truck can't be tapped again. This cooldown makes getting data cost something, so you can't spam it. The truck holds a limited number of crates, stacked in 3D (3 at the start; see Upgrades), and each crate holds a fixed number of units (`UNITS_PER_BOX` = 1: one object is one data point, so a level-0 truck gives 3 dots). A crate counter shows how many are left. When the truck is empty, the data runs out: tapping the empty truck makes it drive away until the next farmer. The farmer's whole harvest is larger than what fits in the truck, and the rest is never measured.
3. **Fit the line.** Two big sliders under the plot: **pendenza (slope)** and **intercetta (intercept)**. The line moves live. The sliders show no numbers. You can collect more crates and adjust the line in any order.
4. **Lock it in.** Tap "Blocca la retta" (lock the line).
5. **Reveal.** The whole harvest appears on the plot as faint dots, the best line (retta migliore) is drawn next to yours, and the vertical gaps from each dot to *your* line flash briefly. This is the errore. The farmer reacts (😐 / 🙂 / 😄), and the coins count up (0–5).
6. **Next farmer.**

**Scoring.** Compare the average error of the player's line on the whole harvest with the average error of the best line on the whole harvest (ratio = player's error ÷ best error). The farmer pays **0–5 coins**, and 5 is a perfect fit. Starting thresholds (to tune): ratio ≤ 1.05 → 5, ≤ 1.2 → 4, ≤ 1.5 → 3, ≤ 2 → 2, ≤ 3 → 1, otherwise 0. Scoring uses the whole harvest, not only the sample, so a line that hugs a small, unlucky sample earns less. In L2, the UI calls this "il raccolto intero" (the whole harvest). After L3 the reveal screen also names it: "addestramento" for the measured sample and "test" for the whole harvest (see CONCEPTS: training vs test is introduced in L3).

**Upgrades (the shop).** There is one scanner, one truck and one unloading setup (scarico). Each machine looks bigger and better at every level: the scanner goes from a crooked wooden frame to a "MEGA SCANNER", and the truck from a motocarro to a futuristic truck. Each starts at level 0 and has **10 levels**. **Buying level *n* costs *n* coins**, so each track costs 55 coins in total, 165 for all three, which is roughly 35–50 farmers. The tracks compete for the same coins, so the player keeps choosing between **better data** (scanner) and **more data** (truck). Scarico only saves time:
| Upgrade | Effect from level 0 to level 10 (starting values, to tune) | Teaches |
|---|---|---|
| Scanner | less noise (the dots sit closer to the true line) and fewer outliers. At level 0 about 1 dot in 8 is a glitch; at level 10 there are none. Some noise always remains | qualità dei dati, valore anomalo |
| Camion (truck) | crates per truck: 3, ×1.5 per level, rounded (3, 5, 7, 10, 15, 23, 34, 51, 77, 115, 173) | more data → more reliable line |
| Scarico (unloading) | objects carried per trip: 1 → 11. First more people (the farmer, then with his son Ciro, then with nonna Titina), then tools (carrello, carriola, transpallet, muletto, trattore con pala, sollevatore telescopico, robot arm, autonomous robot). The data stays the same; the truck just empties faster | (speed) |

**Outliers.** At low scanner levels, the scanner glitches and produces dots far from the others (a stone in the crate, a double reading). They look like normal dots. If the player follows them with the line, they earn less. Upgrading the scanner removes them gradually. There is **no outlier-detection tool** in the first version (see Extensions).

**Difficulty curve.** The first farmer: low noise, no outliers, and a line that is easy to see. Later farmers: more noise, glitches, and trickier slopes, e.g. a small intercept or a steep slope.

**Mobile layout (portrait, top to bottom):** coins and farmer bubble → scatter plot (about 45% of the height) → truck, belt and scanner strip → two sliders and the "Blocca" button.

**Win condition.** None: it is endless, even after all upgrades are maxed. Farmers keep coming, and coins keep buying upgrades. A "Giornata finita" (day done) summary appears every 5 farmers.

**Decided**
- The sliders are called **pendenza (slope)** and **intercetta (intercept)**, not "bias" (bias is the L6 concept). Change request filed to add both to L2 in `CONCEPTS.md`.
- The minigame stays in L2. The words addestramento / test appear only after L3 (see Scoring).
- The numbers don't need to be realistic, and there are no numbers on the axes or sliders.
- The game is endless.
- 10 levels per upgrade, level *n* costs *n* coins, and a perfect fit pays 5 coins. These are starting values to tune.
- No outlier detection in the first version.

**Extensions (later, after the base minigame works)**
Both unlock once the scanner, belt and truck are all at level 10:
1. **Demo: regressione.** A short guided demo with plenty of clean data: the computer finds the best line by itself, so students see that "a machine learns the trend from data".
2. **Demo: valori anomali.** The scanner can be switched back to "broken" mode. Glitch dots appear, and the player taps them to remove them and sees the best line jump back into place.

TODO(Dominik): details once the base minigame is play-tested.

**Open questions**
- TODO(Dominik): the sketch mentions "good vs bad labels". Labels are an L3 concept. Is that for minigame 2?

---

## Minigame 2
TODO(Dominik): sketch coming.

## Minigame 3
TODO(Dominik): sketch coming.

---

| Minigame | Lesson | Concepts | Status |
|---|---|---|---|
| 1. La stazione di pesatura | L2 | regressione lineare, errore, valore anomalo, qualità dei dati | designed |
| 2. | | | waiting for sketch |
| 3. | | | waiting for sketch |
