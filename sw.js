// Offline support: cache the app shell on install, serve cache-first,
// refresh in the background.
const CACHE = 'musicdogs-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'assets/fonts/Fredoka.woff2', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'src/main.js', 'src/util.js', 'src/storage.js',
  'src/audio/engine.js', 'src/audio/songs.js', 'src/audio/compile.js',
  'src/game/play.js', 'src/render/renderer.js', 'src/render/dogs.js', 'src/render/backgrounds.js',
  'src/ui/ui.js', 'src/ui/calibrate.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
