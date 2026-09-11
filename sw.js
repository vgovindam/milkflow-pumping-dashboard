// MilkFlow service worker.
// Strategy: network-first for the app shell so a new deploy is always picked up on the next
// online load, with the cache used only as an offline fallback. Firebase traffic is never
// intercepted - Firestore manages its own offline persistence.
const VERSION = 'milkflow-stable12';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './config.js',
  './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      // addAll fails the whole install if any single file 404s, so warm entries individually.
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only same-origin app assets. Firebase/Firestore/fonts go straight to the network.
  if (url.origin !== self.location.origin) return;
  // Never cache the worker script itself - a stale copy could pin an old version.
  if (url.pathname.endsWith('/sw.js')) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        // Offline deep link (e.g. #baby-home): fall back to the cached shell.
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html', { ignoreSearch: true });
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
