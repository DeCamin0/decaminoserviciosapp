/*
  Simplified Service Worker for DeCamino PWA
  - Minimal functionality to avoid InvalidStateError
  - Provides basic offline fallback
  - Safe update handling
  - Push notifications support
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
  event.waitUntil

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
