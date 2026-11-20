# FattorIA: the FATE-AI game

A small browser game for the FATE-AI course. The spec is in `GAME_SPEC.md`. It has the map, **minigame 1, "La stazione di pesatura"** (L2: data, feature, target, linear regression, line of best fit, error, outliers, data quality) **minigame 2, "Lo smistamento"** (L3: classification, label, decision tree, training vs test, accuracy) **minigame 3, "Il frutteto"** (L3: swipe fences, quickly, so every piece of the orchard holds only trees or only goats; a fence is a decision boundary) and **minigame 4, "Il pascolo"** (L4 preview, unlocked by coins: drag each sheepdog to the middle of its herd in the mountains; the whistle shows how far each dog is from the middle, not in which direction; the centroid of k-means), plus **"La piazza: IA o no?"** (L1, open from the start: a swipe quiz on farm machines, AI or not, with a clock, combos and a one-line reason per card) and **"Il bosco"** (L4 preview, unlocked by coins: a forest runner at dusk; every mushroom found is pinned on the guide board among known porcini and poisonous ones; pick it or leave it, then its 3 nearest neighbours are shown: k-nearest neighbours).

Plain HTML, CSS and JavaScript ES modules. No build step, no npm packages, no framework. It works offline after the first load (service worker) and keeps progress only in the browser's `localStorage`.

## Run locally
```sh
cd Game
python3 -m http.server 8000
```
Then open http://localhost:8000. To try it on a phone on the same Wi-Fi, run `python3 -m http.server 8000 --bind 0.0.0.0` and open `http://<your-mac-ip>:8000`. The service worker only works on `localhost` or HTTPS, so on the phone over plain HTTP the game runs but is not cached offline. It is cached on GitHub Pages.

Opening `index.html` straight from the file system (`file://`) does **not** work: browsers block ES modules there.

Model checks (no browser needed): `node tests/run.mjs` from `Game/`. It also prints a small tuning report: the average coins that a player who fits the measured dots perfectly would earn at different upgrade levels. For minigame 2 it checks that **every level has exactly one question assignment that sorts its training batch 100%** (exhaustive over all 18 questions on every gate), that the correct tree scores 100% on generated test batches, that every truck symbol shows only what goes in, that pipe colours differ within a level, that the trees fit 360 px, and that saves migrate. For minigames 3 and 4 it checks the levels (easy to hard), that every orchard is half trees and half goats, that the true fences pass and no fence fails, the pieces / majority / pay / stars, that dogs on the herd centres pass and dogs 1.3 × the tolerance off fail, the saves (the old laboratorio progress is dropped, the bought place stays), that there is little text and no emoji, that no L4 word appears in the orchard, and that `sw.js` caches every JS file. For La piazza: every card has its icon and short texts, every round has 5 AI and 5 not-AI cards from the right levels. For Il bosco: the found mushrooms agree with their 3 nearest neighbours (except the few allowed tricks), about half are porcini, and the stars and pay.

## Deploy to GitHub Pages
Live at **https://dsenti.github.io/FattorIA/**, from the public repo `dsenti/FattorIA`.

`Game/` in the FATE-AI repo is the source. The FattorIA repo holds just the contents of this folder. To publish, commit in FATE-AI and then run, from the FATE-AI root:

```bash
git subtree push --prefix Game fattoria main
```

(`fattoria` is the git remote for `https://github.com/dsenti/FattorIA.git`.) Every push to `main` runs `.github/workflows/pages.yml`, which stamps `sw.js` with the commit hash and deploys. The service worker loads network-first, so phones see the new version on the next load while online, and fall back to the cache offline. If you add a file, add it to `FILES` in `sw.js`.

## Files
```
index.html              all screens (map, weighing, sorting, orchard, pasture, sheets, modals)
css/style.css           layout; the pixel theme (style E / map day+dusk) is the last section
js/pixel.js             the pixel look: fitPixelCanvas() for canvases, pxArt() / pxSymbolHTML() to turn SVG art into pixel images
js/config.js            ALL tunable numbers (see below)
js/main.js              app shell: map, shop, leaderboard screen, settings, name picker, day summary
js/storage.js           localStorage save/load (wrapped in try/catch)
js/names.js             curated name lists (emoji, nouns with gender, adjective pairs)
js/leaderboard.js       leaderboard interface: STUB for now (see SUPABASE_SETUP.md)
js/slider.js            big touch slider without numbers (pointer events)
js/stats.js             least squares, mean absolute error, random helpers
js/weighing/farmers.js  the 7 farmers: crop, axes, question, noise
js/weighing/round.js    pure model: hidden line, harvest, scanner, glitches, scoring
js/weighing/game.js     the minigame: plot, scene loop, truck/unloading/scanner animation, reveal
js/weighing/scanner.js  the scanner at levels 0-10 (homemade -> MEGA SCANNER), scan beam, upgrade sparkle
js/weighing/vehicles.js the vehicle at truck levels 0-10 (motocarro -> camion del futuro)
js/weighing/unloaders.js unloading at levels 0-10 (by hand, helpers, tools, robot; herding version for animals)
js/weighing/pile.js     the pseudo-3D pile in the bed
js/weighing/previews.js shop previews (current -> next level)
js/weighing/draw.js     shared canvas helpers (palette, crate, stack, wheel)
js/sorting/levels.js    minigame 2: THE LEVELS (tree shape + solution, trucks, training items). Edit here.
js/sorting/questions.js item features (produce, lone animals, soil, shape, worm, snail), the 18 yes/no questions, the sensors
js/sorting/tree.js      pure model: compile a tree, route items, accuracy, guilty gate, solution count, test batches, layout
js/sorting/progress.js  which levels are open, which sensors a level needs
js/sorting/trucks.js    per level: what each truck symbol shows (from the items that go in), and the pipe colours
js/sorting/art.js       all minigame 2 drawings as inline SVG (items, question icons, truck symbols, trucks, icons)
js/sorting/game.js      the minigame: hopper, tree, pipes, trucks, question palette, Prova animation, Avanti (test, pay, trucks drive off), level list
js/sorting/shop.js      the "Smistamento" tab of the shop (sensors, lente, nastro veloce, suggerimenti)
js/orchard/levels.js    minigame 3: THE LEVELS (number of trees + goats, fences, noise, pass mark, true fences, zone). Edit here.
js/orchard/model.js     pure model: the orchard (makeItems), pieces and majority (evaluate), time, stars, pay, clipping a swipe to the orchard
js/orchard/game.js      the minigame: swipe fences, countdown, goats eating trees, result, level list
js/herd/levels.js       minigame 4: THE LEVELS (herds: colour, size, middle, spread, angle, strays; tolerance). Edit here.
js/herd/model.js        pure model: the sheep, the middle of each herd (mean), the whistle (distance of each dog), pay, stars
js/herd/game.js         the minigame: drag dogs from the tray, whistle rings, sheep running to their dog, level list
js/quiz/cards.js        La piazza: THE CARDS (machine, AI or not, level 1-3, icon, one-line reason) and the 3 rounds. Edit here.
js/quiz/model.js        pure model: draw a round (5 AI + 5 not AI), score, stars, pay
js/quiz/game.js         the quiz: swipe or tap, card clock, combo, reason, end of round, round list
js/forest/levels.js     Il bosco: THE TRAILS (patches of porcini and poisonous mushrooms on the board, time, tricks). Edit here.
js/forest/model.js      pure model: the board, the next mushroom (agrees with its neighbours), nearest / vote, judging, stars, pay
js/forest/game.js       the runner: dusk forest scene, the guide board, pick / leave, the k nearest shown, trail list
sw.js                   service worker (offline cache, VERSION constant)
manifest.webmanifest    "add to home screen" metadata
assets/                 icons; fonts/ (Chakra Petch, OFL: titles, buttons, numbers); map/ (valley pictures, day and dusk, per unlock state; places.json)
tools/pixelart/         Python + Pillow generators (dev only, not shipped): mapgen.py (map pictures), weighgen.py (weighing sprites + shed), uigen.py (sorting, orchard, pasture and UI sprites + backgrounds), preview.py (contact sheets)
assets/ui/              sprites.png + sprites.json (produce, animals, overlays, question icons, truck symbols, trucks, goats, fruit trees, sheep, sheepdogs, UI icons), barnwall.png, machine.png, road.png, orchard.png (grass tile), alpine.png (the mountain pasture), cobbles.png (the village square)
js/uiart.js             builds sorting items (with rot / soil / worm / snail), truck symbols and trucks from the UI sprites; art.js registers which SVG art has a pixel sprite (svg40, symbolHTML, truckArt use it)
assets/weigh/           sprites.png + sprites.json (atlas with meta: wheels, beds, seats...) and shed.png, made by weighgen.py
js/weighing/sprites.js  loads the weighing sprite sheet; blit() draws a sprite 1:1 in a pixel canvas's backing pixels
js/weighing/scene.js    the pixel-art weighing scene: shed, belt, vehicles + load, scanner + beam, products, people/tools/herders
tests/run.mjs           node checks for the model and the name lists
```

## Tuning
Everything is in `js/config.js`, with comments:
- **Economy:** `levelCost` (level n costs n), `SCORE_THRESHOLDS` (error ratio → 0–10 coins), `MAX_PAY`, `REACTIONS`, `FARMERS_PER_DAY`.
- **Data per object:** `UNITS_PER_BOX` (1: one crate or one animal = one data point).
- **Upgrades, per level 0–10:** `BELT_BOXES` ("Scarico" in the shop, stored as `belt`: objects per trip, 1→11; faster, not more data), `TRUCK_BASE` × `TRUCK_FACTOR`^level → `TRUCK_CRATES` (3, 5, 7, 10, 15, 23, 34, 51, 77, 115, 173), `SCANNER_NOISE` (never zero), `SCANNER_GLITCH` (1/8 → 0), `GLITCH_OFFSET`. `PILE_VISIBLE_MAX` caps how many boxes are drawn (the rest shows as "+N").
- **Secret scanner level 100** ("Scanner intelligente"): `SECRET_SCANNER_LEVEL`, `SECRET_SCANNER_COST` (100), `SMART_FOLLOW_RATE`, `SMART_LOCK_DELAY_MS`. Offered only after scanner 10 (`scannerOffer` in `round.js`); fits least squares on the measured points only (`autoFit`) and locks by itself. Old saves with the former "Adattatore automatico" (`levels.fitter`) are migrated to scanner 100.
- **Machine sizes (drawing only):** `SCANNER_SCALE`, `SCANNER_HEIGHT_FRACTION`, `TRUCK_LENGTH`, `TRUCK_HEIGHT_SCALE`, per level.
- **Harvest and difficulty:** `HARVEST_SIZE`, `NATURAL_NOISE_EASY/HARD`, `DIFFICULTY_RAMP_FARMERS`, `FIRST_FARMER`.
- **Hidden true line and axes:** `AXIS_FLIP_PROB` (each axis drawn normal or reversed, so the real relation stays positive but the line on the plot falls in about half the rounds), `SLOPE_ABS_RANGE`, `LINE_MARGIN` (random steepness and height, always inside the plot).
- **Sliders:** `SLOPE_ANGLE_RANGE`, `INTERCEPT_RANGE`, start position.
- **Timing:** `CARRY_MS` + `RETURN_MS` (the truck cooldown), `BELT_SPEED`, `TRIP_UNLOAD_MS`, `TRUCK_AUTO_LEAVE_MS` (pause before the empty truck drives off by itself), `TRUCK_LEAVE_MS`, reveal durations.
- **Leaderboard:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MIN_FARMERS_FOR_PRECISION`.

Farmers (names, questions, per-farmer noise) are in `js/weighing/farmers.js`.

Minigame 3 (`CONFIG.ORCHARD`): `UNLOCK_COST` (200), `TIME_BASE` (5 s for one fence) + `TIME_PER_FENCE` (1.5 s), `START_DELAY_MS` (the clock starts after this or at the first fence), `MIN_SWIPE` (px), `MIN_PAY` / `MAX_PAY` (4–10 coins from the pass mark to the true fences' score), `REPLAY_FACTOR`, `EAT_MS`. Per level: `pass`, `noise`, `gap`, `n`, `fences`. Minigame 4 (`CONFIG.HERD`): `UNLOCK_COST` (300), `PAY` ([10, 7, 4] for 1, 2, 3+ whistles), `REPLAY_FACTOR`, `GATHER_MS`. Per level: `tol` (share of the shorter side of the pasture). La piazza (`CONFIG.QUIZ`): `CARDS` (10), `PASS` (6), `FEEDBACK_MS`, `REPLAY_FACTOR`; time per card per round in `js/quiz/cards.js` (`ROUNDS`). Il bosco (`CONFIG.FOREST`): `UNLOCK_COST` (400), `K` (3), `LIVES` (3), `WALK_MS`, `REVEAL_MS`, `MAX_PAY`, `REPLAY_FACTOR`; per trail `seconds`, `n`, `known`, `tricks`.

Minigame 2 (`CONFIG.SORT`): `UNLOCK_COST` (100 coins to open the place on the map), `pay(n)` (first perfect run of level n: 5 + 2n coins × test accuracy), `REPLAY_PAY`, `SENSOR_COST` per sensor, `CALIBRO_REFUND` (the removed size sensor), `LENTE_COST`, `FAST_COST`, `hintCost(k)` (the k-th hint), and the animation timing (`SPEED`, `GATE_PAUSE_MS`, `SPAWN_MS`, `FAST_FACTOR`, `REPLAY_FACTOR`, `DRIVE_OFF_MS`).

## Minigame 2: editing levels
Levels are in `js/sorting/levels.js`. A tree is written as `ask(question, { no: ..., yes: ... })`, and a leaf is a truck id; the questions in `ask()` are the solution (hidden in the game). Items are token strings such as `'patata marrone grande sporco'` or `'mela verde lumaca'` (an apple with a snail on it) or `'lumaca marrone'` (a lone snail), with their truck (the etichetta). After any change run `node tests/run.mjs`: if another assignment also sorts the batch perfectly, the test prints it (gates in pre-order), and you add an item that tells the two apart. Level ids are saved in the players' progress, so don't rename a level that has been played. If you change the levels a lot, bump `LEVELS_VERSION` in `levels.js`: saves from an older version then start the levels again (keeping coins and sensors).

## Minigames 3 and 4: editing levels
Orchard levels are in `js/orchard/levels.js`: `lines` are the true fences (`[x1, y1, x2, y2]` in 0..1, y down), `zone(x, y)` says what grows where (`'tree'` or `'goat'`), `fences` how many the player gets, `noise` how many items stand on the wrong side, `pass` the share that must be right. Pasture levels are in `js/herd/levels.js`: `h(colour, sheep, x, y, spreadX, spreadY, angle, strays)` and `tol`. Run `node tests/run.mjs` after a change. Level ids are saved; if you change the levels a lot, bump `ORCHARD_LEVELS_VERSION` / `HERD_LEVELS_VERSION`.

## Moving the line
Two modes, a setting in ⚙️ Impostazioni ("Come muovi la retta", `state.lineMode`: `'sliders'` default or `'drag'`; kept by Ricomincia). In drag mode the two handles sit at x = 0 and x = 1 and move only vertically inside the plot (`lineToEnds` / `endsToLine` / `clampEnds` in `round.js`); the sliders remain the internal source of truth, so Blocca, scanner 100 and scoring work the same in both modes.

## How the scoring works
Plot units are normalised (0–1 on both axes; the axes show no numbers). Each farmer has a hidden true line and a harvest of `HARVEST_SIZE` units spread around it. The truck carries a random subset. The scanner adds noise, and sometimes a glitch (an outlier), to each measured unit. On "Blocca la retta", the game computes the mean absolute error of the player's line and of the least-squares line, both on the **whole harvest** (without scanner noise). The ratio of the two goes through `SCORE_THRESHOLDS`.

## Debugging
**Temporary 🐞 +100 button** (TODO(Dominik): remove before the course): on the weighing station and in minigames 2–4 (there labelled "DEBUG +100", since they have no emoji in their chrome), adds 100 coins to the wallet without counting them as earned, so the leaderboard is unaffected. Turn it off with `DEBUG_COINS_BUTTON = false` in `js/config.js`, or delete `js/debug.js` and its two lines in `js/main.js`.

Open the game with `?debug` (e.g. `http://localhost:8000/?debug`) to get `window.fattoriaDebug` in the console: `fattoriaDebug.game.round` (hidden line, harvest, sample), `fattoriaDebug.game.newRound()`, `fattoriaDebug.getState().levels.truck = 10`. For minigame 2: `fattoriaDebug.sortGame.load(14)` (jump to level 15), `fattoriaDebug.getState().sort.sensors = ['naso','vermi','bilancia','forma','vita']`, then `fattoriaDebug.sortGame.refresh()`. For minigame 3: `fattoriaDebug.labGame.load(8)` (level 9; open levels need the one before passed: `fattoriaDebug.labGame.lab.passed`), `fattoriaDebug.labGame.lv.lines` (the true fences). For minigame 4: `fattoriaDebug.herdGame.load(7)`, `fattoriaDebug.herdGame.centres` (the middles). La piazza: `fattoriaDebug.quizGame.cards`. Il bosco: `fattoriaDebug.forestGame.cur` (the mushroom being decided, with its true class `c`).

## Reset during testing
In-game: ⚙️ → Ricomincia (also closes Lo smistamento, Il frutteto, Il pascolo and Il bosco again and clears their levels, upgrades and hints). Or in the browser console: `localStorage.clear()`. To drop the offline cache: DevTools → Application → Service workers → Unregister.
