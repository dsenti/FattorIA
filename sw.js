// Service worker: caches every game file so the game keeps working offline.
// VERSION is replaced with the commit hash by the GitHub Pages workflow on every deploy.
// If you add a file, add it to FILES.
const VERSION = 'dev';
const CACHE = `fattoria-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/config.js',
  'js/main.js',
  'js/names.js',
  'js/storage.js',
  'js/leaderboard.js',
  'js/debug.js',
  'js/slider.js',
  'js/stats.js',
  'js/weighing/farmers.js',
  'js/weighing/round.js',
  'js/weighing/game.js',
  'js/weighing/draw.js',
  'js/weighing/pile.js',
  'js/weighing/scanner.js',
  'js/weighing/vehicles.js',
  'js/weighing/unloaders.js',
  'js/weighing/previews.js',
  'js/sorting/questions.js',
  'js/sorting/levels.js',
  'js/sorting/tree.js',
  'js/sorting/progress.js',
  'js/sorting/art.js',
  'js/sorting/game.js',
  'js/sorting/shop.js',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fattoria-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first: when online, always load the newest files (so a push shows up on the next
// load) and update the cache. When offline or the network is too slow, answer from the cache.
const NETWORK_TIMEOUT_MS = 3000;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const fromNetwork = fetch(req, { cache: 'no-cache' }).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      });
      const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
      try {
        const res = await Promise.race([fromNetwork, timeout]);
        if (res) return res;
      } catch { /* offline: fall through to the cache */ }
      const cached = await cache.match(req, { ignoreSearch: true });
      return cached || fromNetwork.catch(() => Response.error());
    }),
  );
});
