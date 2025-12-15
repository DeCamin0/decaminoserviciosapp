/**
 * Utilități pentru notificări push native
 * Suportă notificări native ale browser-ului (ca la Facebook)
 */

/**
 * Cere permisiunea pentru notificări push
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('🔔 Browser-ul nu suportă notificări native');
    return false;
  }

  if (Notification.permission === 'granted') {
    console.log('✅ Permisiune pentru notificări deja acordată');
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('❌ Permisiune pentru notificări refuzată');
    return false;
  }

  // Cere permisiunea
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    console.log('✅ Permisiune pentru notificări acordată');
    return true;
  } else {
    console.warn('❌ Permisiune pentru notificări refuzată');
    return false;
  }
};

/**
 * Verifică dacă notificările sunt permise
 */
export const isNotificationPermissionGranted = () => {
  return 'Notification' in window && Notification.permission === 'granted';
};

/**
 * Afișează o notificare push nativă
 */
export const showPushNotification = (notification) => {
  if (!isNotificationPermissionGranted()) {
    console.warn('🔔 Permisiune pentru notificări nu este acordată');
    return null;
  }

  const options = {
    body: notification.message || notification.content,
    // Folosește base path-ul din environment pentru path-uri relative
    icon: `${import.meta.env.VITE_BASE_PATH || '/'}logo.svg`.replace(/\/+/g, '/'), // Iconița aplicației
    badge: `${import.meta.env.VITE_BASE_PATH || '/'}logo.svg`.replace(/\/+/g, '/'), // Badge pentru notificări
    image: notification.image, // Imagine opțională
    // Folosește ID-ul unic pentru fiecare notificare, nu tag comun - astfel toate notificările rămân separate
    tag: notification.id ? `notification-${notification.id}` : `notification-${Date.now()}-${Math.random()}`, // Tag unic pentru fiecare notificare
    requireInteraction: true, // Rămâne pe ecran până când utilizatorul o închide manual (ca la WhatsApp)
    silent: false, // Sunet activat
    vibrate: [200, 100, 200], // Vibrație pe telefon (dacă e suportat)
    data: notification.data || {}, // Date suplimentare
    timestamp: notification.timestamp ? new Date(notification.timestamp).getTime() : Date.now(),
    actions: notification.actions || [], // Acțiuni (ex: "Vizualizează", "Ignoră")
  };

  const nativeNotification = new Notification(
    notification.title || 'Nouă notificare',
    options
  );

  // Click pe notificare - deschide aplicația
  nativeNotification.onclick = (event) => {
    event.preventDefault();
    window.focus(); // Focus pe aplicație
    
    // Navighează la o pagină specifică dacă e specificată
    if (notification.url) {
      window.location.href = notification.url;
    }
    
    // Nu închide notificarea automat la click - lasă utilizatorul să o închidă manual
    // nativeNotification.close(); // Comentat pentru a rămâne în centrul de notificări
  };

  // NU mai închidem automat notificarea - rămâne pe telefon ca la WhatsApp
  // setTimeout(() => {
  //   nativeNotification.close();
  // }, 5000);

  return nativeNotification;
};

/**
 * Înregistrează service worker pentru notificări push (pentru notificări când aplicația este închisă)
 */
export const registerPushServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready pentru push notifications');
      return registration;
    } catch (error) {
      console.error('❌ Eroare la înregistrarea Service Worker pentru push:', error);
      return null;
    }
  }
  return null;
};

/**
 * Înregistrează Push subscription pentru notificări când aplicația este închisă
 * Returnează subscription-ul sau null dacă nu se poate înregistra
 */
export const subscribeToPushNotifications = async (userId) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('🔔 Browser-ul nu suportă Push API');
    return null;
  }

  if (!isNotificationPermissionGranted()) {
    console.warn('🔔 Permisiune pentru notificări nu este acordată');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Verifică dacă există deja un subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Creează un subscription nou
      // VAPID public key - trebuie să fie generat în backend
      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3000' 
        : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
      
      // Obține VAPID public key de la backend
      const token = localStorage.getItem('auth_token');
      const vapidResponse = await fetch(`${baseUrl}/api/push/vapid-public-key`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!vapidResponse.ok) {
        console.warn('⚠️ Nu s-a putut obține VAPID public key. Push notifications nu vor funcționa când aplicația este închisă.');
        return null;
      }
      
      const { publicKey } = await vapidResponse.json();
      
      // Converteste VAPID key din base64 URL-safe în Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });
      
      console.log('✅ Push subscription creat:', subscription);
    } else {
      console.log('✅ Push subscription deja există');
    }

    // Salvează subscription-ul în backend
    if (userId && subscription) {
      await savePushSubscription(userId, subscription);
    }

    return subscription;
  } catch (error) {
    console.error('❌ Eroare la înregistrarea Push subscription:', error);
    return null;
  }
};

/**
 * Convertește VAPID key din base64 URL-safe în Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Salvează Push subscription în backend
 */
async function savePushSubscription(userId, subscription) {
  try {
    const baseUrl = import.meta.env.DEV 
      ? 'http://localhost:3000' 
      : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
    
    const token = localStorage.getItem('auth_token');
    
    await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth')),
          },
        },
      }),
    });
    
    console.log('✅ Push subscription salvat în backend');
  } catch (error) {
    console.error('❌ Eroare la salvarea Push subscription:', error);
  }
}

/**
 * Convertește ArrayBuffer în base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
