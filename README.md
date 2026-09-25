# FattorIA: the FATE-AI game

A small browser game for the FATE-AI course. The spec is in `GAME_SPEC.md`. It has the map, **minigame 1, "La stazione di pesatura"** (L2: data, feature, target, linear regression, line of best fit, error, outliers, data quality) and **minigame 2, "Lo smistamento"** (L3: classification, label, decision tree, training vs test, accuracy).

Plain HTML, CSS and JavaScript ES modules. No build step, no npm packages, no framework. It works offline after the first load (service worker) and keeps progress only in the browser's `localStorage`.

## Run locally
```sh
cd Game
python3 -m http.server 8000
```
Then open http://localhost:8000. To try it on a phone on the same Wi-Fi, run `python3 -m http.server 8000 --bind 0.0.0.0` and open `http://<your-mac-ip>:8000`. The service worker only works on `localhost` or HTTPS, so on the phone over plain HTTP the game runs but is not cached offline. It is cached on GitHub Pages.

Opening `index.html` straight from the file system (`file://`) does **not** work: browsers block ES modules there.

Model checks (no browser needed): `node tests/run.mjs` from `Game/`. It also prints a small tuning report: the average coins that a player who fits the measured dots perfectly would earn at different upgrade levels. For minigame 2 it checks that **every level has exactly one question assignment that sorts its training batch 100%** (exhaustive over all 17 questions on every gate), that the correct tree scores 100% on generated test batches, that the trees fit 360 px, and that saves migrate.

## Deploy to GitHub Pages
Live at **https://dsenti.github.io/FattorIA/**, from the public repo `dsenti/FattorIA`.

`Game/` in the FATE-AI repo is the source. The FattorIA repo holds just the contents of this folder. To publish, commit in FATE-AI and then run, from the FATE-AI root:

```bash
git subtree push --prefix Game fattoria main
```

(`fattoria` is the git remote for `https://github.com/dsenti/FattorIA.git`.) Every push to `main` runs `.github/workflows/pages.yml`, which stamps `sw.js` with the commit hash and deploys. The service worker loads network-first, so phones see the new version on the next load while online, and fall back to the cache offline. If you add a file, add it to `FILES` in `sw.js`.

## Files
```
index.html              all screens (map, weighing station, sorting station, sheets, modals)
css/style.css           layout and palette (course/STYLE.md colours)
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
js/sorting/questions.js item features (produce, lone animals, soil, shape, worm, snail), the 17 yes/no questions, the sensors
js/sorting/tree.js      pure model: compile a tree, route items, accuracy, guilty gate, solution count, test batches, layout
js/sorting/progress.js  which levels are open, which sensors a level needs
js/sorting/art.js       all minigame 2 drawings as inline SVG (items, question icons, truck symbols, trucks, icons)
js/sorting/game.js      the minigame: hopper, tree, pipes, trucks, question palette, Prova animation, Avanti (test, pay, trucks drive off), level list
js/sorting/shop.js      the "Smistamento" tab of the shop (sensors, lente, nastro veloce, suggerimenti)
sw.js                   service worker (offline cache, VERSION constant)
manifest.webmanifest    "add to home screen" metadata
assets/                 icons
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

Minigame 2 (`CONFIG.SORT`): `UNLOCK_COST` (100 coins to open the place on the map), `pay(n)` (first perfect run of level n: 5 + 2n coins × test accuracy), `REPLAY_PAY`, `SENSOR_COST` per sensor, `CALIBRO_REFUND` (the removed size sensor), `LENTE_COST`, `FAST_COST`, `hintCost(k)` (the k-th hint), and the animation timing (`SPEED`, `GATE_PAUSE_MS`, `SPAWN_MS`, `FAST_FACTOR`, `REPLAY_FACTOR`, `DRIVE_OFF_MS`).

## Minigame 2: editing levels
Levels are in `js/sorting/levels.js`. A tree is written as `ask(question, { no: ..., yes: ... })`, and a leaf is a truck id; the questions in `ask()` are the solution (hidden in the game). Items are token strings such as `'patata marrone grande sporco'` or `'mela verde lumaca'` (an apple with a snail on it) or `'lumaca marrone'` (a lone snail), with their truck (the etichetta). After any change run `node tests/run.mjs`: if another assignment also sorts the batch perfectly, the test prints it (gates in pre-order), and you add an item that tells the two apart. Level ids are saved in the players' progress, so don't rename a level that has been played. If you change the levels a lot, bump `LEVELS_VERSION` in `levels.js`: saves from an older version then start the levels again (keeping coins and sensors).

## Moving the line
Two modes, a setting in ⚙️ Impostazioni ("Come muovi la retta", `state.lineMode`: `'sliders'` default or `'drag'`; kept by Ricomincia). In drag mode the two handles sit at x = 0 and x = 1 and move only vertically inside the plot (`lineToEnds` / `endsToLine` / `clampEnds` in `round.js`); the sliders remain the internal source of truth, so Blocca, scanner 100 and scoring work the same in both modes.

## How the scoring works
Plot units are normalised (0–1 on both axes; the axes show no numbers). Each farmer has a hidden true line and a harvest of `HARVEST_SIZE` units spread around it. The truck carries a random subset. The scanner adds noise, and sometimes a glitch (an outlier), to each measured unit. On "Blocca la retta", the game computes the mean absolute error of the player's line and of the least-squares line, both on the **whole harvest** (without scanner noise). The ratio of the two goes through `SCORE_THRESHOLDS`.

## Debugging
**Temporary 🐞 +100 button** (TODO(Dominik): remove before the course): on the weighing station and on Lo smistamento (there labelled "DEBUG +100", since minigame 2 has no emoji), adds 100 coins to the wallet without counting them as earned, so the leaderboard is unaffected. Turn it off with `DEBUG_COINS_BUTTON = false` in `js/config.js`, or delete `js/debug.js` and its two lines in `js/main.js`.

Open the game with `?debug` (e.g. `http://localhost:8000/?debug`) to get `window.fattoriaDebug` in the console: `fattoriaDebug.game.round` (hidden line, harvest, sample), `fattoriaDebug.game.newRound()`, `fattoriaDebug.getState().levels.truck = 10`. For minigame 2: `fattoriaDebug.sortGame.load(14)` (jump to level 15), `fattoriaDebug.getState().sort.sensors = ['naso','vermi','bilancia','forma','vita']`, then `fattoriaDebug.sortGame.refresh()`.

## Reset during testing
In-game: ⚙️ → Ricomincia (also closes Lo smistamento again and clears its levels, sensors and hints). Or in the browser console: `localStorage.clear()`. To drop the offline cache: DevTools → Application → Service workers → Unregister.
