// Service Worker entry point pentru VitePWA injectManifest
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';

// Precache assets
precacheAndRoute(self.__WB_MANIFEST);

// Activează automat noul Service Worker când se instalează (fără a aștepta)
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new Service Worker...');
  // Skip waiting pentru a activa automat noul Service Worker
  self.skipWaiting();
});

// Șterge cache-urile vechi automat când se activează noul Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Șterge cache-urile API vechi automat
      caches.delete('n8n-api-cache'),
      caches.delete('backend-api-cache'),
      // Șterge toate cache-urile care nu sunt în lista curentă
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Păstrează doar cache-urile curente (precache)
              return !cacheName.startsWith('decamino-cache') && 
                     !cacheName.startsWith('avatar-cache');
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Claim clients imediat pentru a activa noul Service Worker
      self.clients.claim(),
    ]).then(() => {
      console.log('[SW] Service Worker activated, old caches cleared');
    })
  );
});

// SOLUȚIE PROFESIONALĂ: NU interceptăm deloc request-urile către backend-ul nostru
// Toate request-urile către api.decaminoservicios.com sau localhost:3000 trec direct la backend
// Astfel, nu există probleme de cache pentru niciun endpoint
// Interceptăm doar:
// 1. Asset-urile statice (JS, CSS, imagini) - deja acoperite de precacheAndRoute
// 2. Request-urile către n8n (pentru endpoint-urile nemigrate)

// Helper pentru a verifica dacă un URL este către backend-ul nostru
const isOurBackend = (url) => {
  const origin = url.origin;
  return origin === 'https://api.decaminoservicios.com' || 
         origin === 'http://localhost:3000' ||
         origin.includes('api.decaminoservicios.com');
};

// IMPORTANT: Nu adăugăm niciun route pentru backend-ul nostru
// Astfel, toate request-urile către backend trec direct, fără interceptare
// Aceasta este soluția profesională - funcționează pentru TOATE endpoint-urile, nu doar pentru cele pe care le adăugăm manual

// Cache pentru n8n (pentru endpoint-urile nemigrate: EmpleadoPedidosPage, etc.)
registerRoute(
  ({ url }) => {
    return url.origin === 'https://n8n.decaminoservicios.com';
  },
  new NetworkFirst({
    cacheName: 'n8n-api-cache',
    networkTimeoutSeconds: 10,
  })
);

// Handler pentru mesaje de la aplicație (clear cache, etc.)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    // Șterge cache-urile API când e necesar (ex: la logout, la login nou)
    event.waitUntil(
      Promise.all([
        caches.delete('n8n-api-cache'),
        caches.delete('backend-api-cache'),
      ]).then(() => {
        console.log('[SW] API caches cleared');
        event.ports[0]?.postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Gestionează evenimentele push (când aplicația este închisă)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  
  const basePath = self.location.pathname.replace(/\/sw\.js$/, '') || '/';
  
  let notificationData = {
    title: 'Nouă notificare',
    body: 'Ai primit o notificare nouă',
    icon: `${basePath}logo.svg`,
    badge: `${basePath}logo.svg`,
    tag: 'notification',
    requireInteraction: true,
    data: {}
  };

  // Încearcă să parseze datele din push event
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.message || data.body || notificationData.body,
        icon: data.icon || `${basePath}logo.svg`,
        badge: data.badge || `${basePath}logo.svg`,
        tag: data.id ? `notification-${data.id}` : `notification-${Date.now()}-${Math.random()}`,
        requireInteraction: true, // Rămâne pe ecran ca la WhatsApp
        data: data.data || {},
        timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
        vibrate: [200, 100, 200],
        silent: false,
      };
    } catch (e) {
      // Dacă nu e JSON, folosește text
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Afișează notificarea
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Gestionează click-ul pe notificare
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  // Deschide aplicația
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const basePath = self.location.pathname.replace(/\/sw\.js$/, '') || '/';
      
      // Dacă există deja o fereastră deschisă, o focusează
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Dacă nu există, deschide o fereastră nouă
      // Verifică URL din data sau din notification direct
      const urlFromData = event.notification.data?.url;
      const urlToOpen = urlFromData
        ? `${self.location.origin}${basePath}${urlFromData.replace(/^\//, '')}`
        : `${self.location.origin}${basePath}`;
      
      return clients.openWindow(urlToOpen);
    })
  );
});

