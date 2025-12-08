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
    icon: '/logo.svg', // Iconița aplicației
    badge: '/logo.svg', // Badge pentru notificări
    image: notification.image, // Imagine opțională
    tag: notification.id || 'notification', // Tag pentru a înlocui notificări vechi
    requireInteraction: false, // Se închide automat
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
    
    nativeNotification.close();
  };

  // Auto-close după 5 secunde
  setTimeout(() => {
    nativeNotification.close();
  }, 5000);

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
