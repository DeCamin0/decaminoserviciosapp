/*
  Minimal Service Worker for version checking and offline fallback.
  - Keeps PWA update checks via postMessage
  - Avoids heavy workbox bundle to reduce lint noise
*/

const CACHE_NAME = 'decamino-cache-v1';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))))
      .then(() => self.clients.claim())
  );
});

// Network-first for navigations with offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
  }
});

// Version check: UI can ask for a check and we'll broadcast result
self.addEventListener('message', async (event) => {
  const data = event.data || {};
  if (data.type === 'CHECK_VERSION') {
    try {
      const res = await fetch(`/manifest.webmanifest?ts=${Date.now()}`);
      const ok = !!(res && res.ok);
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: 'VERSION_CHECKED', ok }));
    } catch (e) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: 'VERSION_CHECKED', ok: false }));
    }
  }
});
