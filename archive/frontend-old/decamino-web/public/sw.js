/*
  Simplified Service Worker for DeCamino PWA
  - Minimal functionality to avoid InvalidStateError
  - Provides basic offline fallback
  - Safe update handling
*/

const CACHE_NAME = 'decamino-cache-v3';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))))
      .then(() => self.clients.claim())
  );
});

// Network-first for navigations with offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const data = event.data || {};
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
