# FattorIA: the FATE-AI game

A small browser game for the FATE-AI course. The spec is in `GAME_SPEC.md`. For now it has the map and **minigame 1, "La stazione di pesatura"** (L2: data, feature, target, linear regression, line of best fit, error, outliers, data quality).

Plain HTML, CSS and JavaScript ES modules. No build step, no npm packages, no framework. It works offline after the first load (service worker) and keeps progress only in the browser's `localStorage`.

## Run locally
```sh
cd Game
python3 -m http.server 8000
```
Then open http://localhost:8000. To try it on a phone on the same Wi-Fi, run `python3 -m http.server 8000 --bind 0.0.0.0` and open `http://<your-mac-ip>:8000`. The service worker only works on `localhost` or HTTPS, so on the phone over plain HTTP the game runs but is not cached offline. It is cached on GitHub Pages.

Opening `index.html` straight from the file system (`file://`) does **not** work: browsers block ES modules there.

Model checks (no browser needed): `node tests/run.mjs` from `Game/`. It also prints a small tuning report: the average coins that a player who fits the measured dots perfectly would earn at different upgrade levels.

## Deploy to GitHub Pages
Live at **https://dsenti.github.io/FattorIA/**, from the public repo `dsenti/FattorIA`.

`Game/` in the FATE-AI repo is the source. The FattorIA repo holds just the contents of this folder. To publish, commit in FATE-AI and then run, from the FATE-AI root:

```bash
git subtree push --prefix Game fattoria main
```

(`fattoria` is the git remote for `https://github.com/dsenti/FattorIA.git`.) Every push to `main` runs `.github/workflows/pages.yml`, which stamps `sw.js` with the commit hash and deploys. The service worker loads network-first, so phones see the new version on the next load while online, and fall back to the cache offline. If you add a file, add it to `FILES` in `sw.js`.

## Files
```
index.html              all screens (map, weighing station, sheets, modals)
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
js/weighing/game.js     the minigame: canvas drawing, truck/belt/scanner animation, reveal
sw.js                   service worker (offline cache, VERSION constant)
manifest.webmanifest    "add to home screen" metadata
assets/                 icons
tests/run.mjs           node checks for the model and the name lists
```

## Tuning
Everything is in `js/config.js`, with comments:
- **Economy:** `levelCost` (level n costs n), `SCORE_THRESHOLDS` (error ratio → coins), `FARMERS_PER_DAY`.
- **Upgrades, per level 0–10:** `BELT_UNITS` (1→11), `TRUCK_CRATES` (3→13), `SCANNER_NOISE` (never zero), `SCANNER_GLITCH` (1/8 → 0), `GLITCH_OFFSET`.
- **Harvest and difficulty:** `HARVEST_SIZE`, `NATURAL_NOISE_EASY/HARD`, `DIFFICULTY_RAMP_FARMERS`, `TRICKY_LINE_PROB`, `FIRST_FARMER`.
- **Sliders:** `SLOPE_ANGLE_RANGE`, `INTERCEPT_RANGE`, start position.
- **Timing:** `CARRY_MS` + `RETURN_MS` (the truck cooldown), `BELT_SPEED`, reveal durations.
- **Leaderboard:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MIN_FARMERS_FOR_PRECISION`.

Farmers (names, questions, per-farmer noise) are in `js/weighing/farmers.js`.

## How the scoring works
Plot units are normalised (0–1 on both axes; the axes show no numbers). Each farmer has a hidden true line and a harvest of `HARVEST_SIZE` units spread around it. The truck carries a random subset. The scanner adds noise, and sometimes a glitch (an outlier), to each measured unit. On "Blocca la retta", the game computes the mean absolute error of the player's line and of the least-squares line, both on the **whole harvest** (without scanner noise). The ratio of the two goes through `SCORE_THRESHOLDS`.

## Reset during testing
In-game: ⚙️ → Ricomincia. Or in the browser console: `localStorage.clear()`. To drop the offline cache: DevTools → Application → Service workers → Unregister.
