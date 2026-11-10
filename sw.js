// Offline support: cache the app shell on install, serve cache-first,
// refresh in the background.
const CACHE = 'musicdogs-3d-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'vendor/three.module.min.js',
  'assets/fonts/Fredoka.woff2', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'src/main.js', 'src/world.js', 'src/game.js', 'src/ui.js',
  'src/dog/build.js', 'src/dog/parts.js', 'src/dog/dog.js',
  'src/audio/orchestra.js', 'src/audio/score.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('musicdogs-3d') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/classic/')) return;
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
