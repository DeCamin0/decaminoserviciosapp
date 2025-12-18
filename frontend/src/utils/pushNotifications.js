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
    const baseUrl = import.meta.env.DEV 
      ? 'http://localhost:3000' 
      : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
    
    const migrationKey = `push_migration_done_v1_${userId}`;
    const token = localStorage.getItem('auth_token');

    // 🔁 MIGRARE ONE-TIME: șterge toate subscription-urile vechi pentru utilizatorii existenți
    // Scop: să curățăm tot ce a fost creat cu VAPID keys vechi, fără pași manuali pentru angajați.
    if (!localStorage.getItem(migrationKey)) {
      console.log('🔁 [PushMigration] Rulez migrarea v1 pentru utilizatorul', userId);

      try {
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          try {
            await existingSubscription.unsubscribe();
            console.log('✅ [PushMigration] Subscription vechi dezabonat din browser');
          } catch (unsubError) {
            console.warn('⚠️ [PushMigration] Eroare la dezabonarea subscription-ului vechi:', unsubError);
          }
        }

        if (token) {
          try {
            await fetch(`${baseUrl}/api/push/reset-subscriptions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            console.log('✅ [PushMigration] Subscription-uri vechi șterse din backend');
          } catch (resetError) {
            console.warn('⚠️ [PushMigration] Eroare la resetarea subscription-urilor în backend:', resetError);
          }
        }

        localStorage.setItem(migrationKey, '1');
        // Șterge și vechiul VAPID key local, dacă există
        localStorage.removeItem(`vapid_public_key_${userId}`);
      } catch (migrationError) {
        console.warn('⚠️ [PushMigration] Eroare în timpul migrației push v1:', migrationError);
      }
    }
    
    // Obține VAPID public key de la backend (întotdeauna, pentru verificare)
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
    
    const { publicKey: backendPublicKey } = await vapidResponse.json();
    
    // Verifică dacă există deja un subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Verifică dacă VAPID key se potrivește cu cel din backend
      // Comparăm VAPID public key-ul stocat în localStorage cu cel din backend.
      // Dacă nu avem key stocat (utilizatori vechi) sau nu se potrivește, forțăm recrearea.
      const storedVapidKey = localStorage.getItem(`vapid_public_key_${userId}`);
      
      console.log('✅ Push subscription deja există, verific compatibilitatea VAPID keys...');
      
      if (!storedVapidKey || storedVapidKey !== backendPublicKey) {
        console.warn('⚠️ VAPID public key NU se potrivește sau nu este salvat local (utilizator vechi). Recreez subscription-ul...');
        
        // Șterge subscription-ul vechi din browser
        try {
          await subscription.unsubscribe();
        } catch (unsubError) {
          console.warn('⚠️ Eroare la unsubscribing subscription vechi:', unsubError);
        }
        
        // Șterge și din backend toate subscription-urile pentru acest user
        try {
          await fetch(`${baseUrl}/api/push/reset-subscriptions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          console.log('✅ Subscription-uri invalide șterse din backend');
        } catch (resetError) {
          console.warn('⚠️ Eroare la resetarea subscription-urilor din backend:', resetError);
        }
        
        subscription = null;
      } else {
        // VAPID keys se potrivesc - verifică dacă subscription-ul este valid
        try {
          await savePushSubscription(userId, subscription);
          console.log('✅ Push subscription valid și sincronizat cu backend');
        } catch (error) {
          console.warn('⚠️ Push subscription existent pare invalid:', error);
          console.log('🔄 Șterg subscription-ul vechi și creez unul nou...');
          
          try {
            await subscription.unsubscribe();
          } catch (unsubError) {
            console.warn('⚠️ Eroare la unsubscribing subscription vechi:', unsubError);
          }
          
          subscription = null;
        }
      }
    }
    
    if (!subscription) {
      // Creează un subscription nou
      console.log('📝 Creez Push subscription nou...');
      
      // Converteste VAPID key din base64 URL-safe în Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(backendPublicKey);
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });
      
      console.log('✅ Push subscription creat:', subscription);
      
      // Salvează VAPID public key în localStorage pentru verificări viitoare
      localStorage.setItem(`vapid_public_key_${userId}`, backendPublicKey);
      
      // Salvează subscription-ul în backend
      if (userId && subscription) {
        await savePushSubscription(userId, subscription);
      }
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
