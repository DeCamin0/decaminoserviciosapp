/*
  Service Worker for DeCamino
  - Offline fallback
  - Push notifications
  - Avatar cache via Cache API (AVATAR_CACHE)
*/

const CACHE_NAME = 'decamino-cache-v3';
const AVATAR_CACHE = 'avatar-cache-v1';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches except current app cache and avatar cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (k === CACHE_NAME || k === AVATAR_CACHE) return Promise.resolve();
            return caches.delete(k);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ===== PUSH NOTIFICATIONS =====
// Gestionează notificări push când aplicația este închisă
self.addEventListener('push', (event) => {
  console.log('🔔 [SW] Push notification received:', event);
  
  let notificationData = {
    title: 'Nouă notificare',
    body: 'Ai primit o notificare nouă',
    icon: '/logo.svg',
    badge: '/logo.svg',
  };

  // Încearcă să parseze datele din push event
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.message || data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        image: data.image,
        tag: data.id || 'notification',
        data: data.data || {},
        requireInteraction: false,
        vibrate: [200, 100, 200],
      };
    } catch (e) {
      // Dacă nu e JSON, folosește text
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Afișează notificarea
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      image: notificationData.image,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      vibrate: notificationData.vibrate,
      actions: [
        {
          action: 'open',
          title: 'Deschide',
        },
        {
          action: 'close',
          title: 'Închide',
        },
      ],
    })
  );
});

// Gestionează click-ul pe notificare
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Deschide aplicația
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Dacă există deja o fereastră deschisă, o focusăm
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Dacă nu, deschidem o fereastră nouă
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))))
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET for avatar cache; let POST/others pass through (e.g., uploads)
  if (request.method !== 'GET') {
    return;
  }

  const isAvatar =
    request.url.includes('/avatar') ||
    request.url.includes('/avatars/');

  if (isAvatar) {
    event.respondWith(
      caches.open(AVATAR_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            // Cache only successful avatar responses
            cache.put(request, response.clone());
          }
          return response;
        } catch (e) {
          // Let the page handle fallback; do not cache fallback here
          throw e;
        }
      })
    );
    return;
  }

  // Network-first for navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Invalidate avatar cache entry for a given URL/pattern
  if (data.type === 'avatarUpdated' || data.type === 'avatarDeleted') {
    const targetUrl = data.url;
    if (!targetUrl) return;
    event.waitUntil(
      caches.open(AVATAR_CACHE).then(async (cache) => {
        const requests = await cache.keys();
        await Promise.all(
          requests
            .filter((req) => req.url.includes(targetUrl))
            .map((req) => cache.delete(req))
        );
      })
    );
  }
});
