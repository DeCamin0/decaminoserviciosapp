// Service Worker entry point pentru VitePWA injectManifest
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Precache assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache API calls
// Cache pentru n8n (pentru endpoint-urile nemigrate: EmpleadoPedidosPage, etc.)
registerRoute(
  ({ url }) => url.origin === 'https://n8n.decaminoservicios.com',
  new NetworkFirst({
    cacheName: 'n8n-api-cache',
    networkTimeoutSeconds: 10,
  })
);

// Cache pentru backend-ul nostru (api.decaminoservicios.com sau localhost:3000)
registerRoute(
  ({ url }) => {
    const origin = url.origin;
    return origin === 'https://api.decaminoservicios.com' || 
           origin === 'http://localhost:3000' ||
           origin.includes('api.decaminoservicios.com');
  },
  new NetworkFirst({
    cacheName: 'backend-api-cache',
    networkTimeoutSeconds: 10,
  })
);

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

