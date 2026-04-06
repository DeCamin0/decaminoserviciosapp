import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationContext } from './LocationContextBase';
import { config } from '../config/env';

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const geocodeThrottleRef = useRef(0);
  const locationRequestedRef = useRef(false);
  const retryCountRef = useRef(0); // Contor pentru retry-uri
  const MAX_RETRIES = 2; // Maxim 2 retry-uri

  /** Fallback vizibil mereu când geocodarea eșuează sau întârzie — evită UI blocat la „Obteniendo dirección…”. */
  const coordsAsFallback = useCallback((latitude, longitude) => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
    return '';
  }, []);

  // Reverse geocoding prin backend (Nominatim). Timeout client + fallback la coordonate la orice eșec.
  const getAddressFromCoords = useCallback(
    async (latitude, longitude) => {
      const fallback = coordsAsFallback(latitude, longitude);
      const BASE_URL = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
      if (!BASE_URL) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ Geocoding: BACKEND_BASE lipsă, folosim doar coordonate');
        }
        return fallback;
      }

      const url = `${BASE_URL}/api/geocoding/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;

      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const GEOCODE_CLIENT_MS = 22000; // > worst-case backend (~2×8s Nominatim + retry)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEOCODE_CLIENT_MS);

      try {
        if (import.meta.env.DEV) {
          console.log(`🌍 Geocoding reverse: ${url}`);
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Geocoding HTTP', response.status, result);
          }
          return fallback;
        }

        if (result.success && result.address && String(result.address).trim() !== '') {
          if (import.meta.env.DEV) {
            console.log('✅ Address from backend:', result.address);
          }
          return String(result.address).trim();
        }

        if (result.coordinates) {
          const c = result.coordinates;
          return coordsAsFallback(c.latitude, c.longitude) || fallback;
        }

        return fallback;
      } catch (error) {
        if (error?.name === 'AbortError') {
          console.warn('⚠️ Geocoding reverse: timeout client, usando coordenadas');
        } else {
          console.error('❌ Error getting address from backend:', error);
        }
        return fallback;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [coordsAsFallback],
  );

  // Funcție pentru actualizarea locației
  const updateLocation = useCallback(async (position) => {
    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    
    setCurrentLocation(coords);
    // Afișăm imediat coordonatele; dacă vine adresa de la backend, o înlocuim după.
    setCurrentAddress(coordsAsFallback(coords.latitude, coords.longitude));
    
    // Throttle geocodarea inversă pentru a evita prea multe cereri
    const nowTs = Date.now();
    if (nowTs - geocodeThrottleRef.current < 5000) return; // 5 secunde între cereri (mai rapid)
    
    geocodeThrottleRef.current = nowTs;
    
    try {
      const address = await getAddressFromCoords(coords.latitude, coords.longitude);
      if (address) {
        setCurrentAddress(address);
      }
    } catch (err) {
      console.error('Error updating address:', err);
    }
  }, [coordsAsFallback, getAddressFromCoords]);

  // Detectare browser pentru ajustarea opțiunilor de geolocație
  const isEdge = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return /Edg/.test(navigator.userAgent);
  }, []);

  // Funcție pentru gestionarea erorilor de geolocație
  const handleLocationError = useCallback((locationError) => {
    console.error('Location error:', locationError);
    console.error('Error code:', locationError.code);
    console.error('Error message:', locationError.message);
    
    // Pentru Edge, dacă e timeout, încercăm din nou cu setări mai puțin stricte
    if (locationError.code === 3 && isEdge()) { // TIMEOUT pe Edge
      console.log('⚠️ Edge timeout detected, will retry with relaxed settings');
    }
    
    setError(locationError.message);
    setIsLoading(false);
  }, [isEdge]);

  // Funcție pentru a cere locația dacă utilizatorul este autentificat
  const requestLocationIfAuthenticated = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocația nu este suportată de acest browser');
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');

    // Cerem locația dacă utilizatorul este autentificat și nu avem deja locație
    // Permitem retry-uri dacă cererea anterioară a eșuat (locationRequestedRef poate fi resetat)
    if (token && savedUser && !currentLocation) {
      // Dacă deja am cerut și încă așteptăm, nu mai cerem (evită cereri duplicate)
      if (locationRequestedRef.current && isLoading) {
        console.log('📍 Location request already in progress, skipping...');
        return;
      }
      
      // Dacă nu avem locație și nu am cerut deja (sau cererea anterioară a eșuat și s-a resetat)
      if (!locationRequestedRef.current || (!isLoading && !currentLocation)) {
      locationRequestedRef.current = true;
      setIsLoading(true);
      setError(null);

      console.log('📍 Requesting location automatically (user authenticated)');
      
      // Reset retry counter la fiecare nouă cerere
        retryCountRef.current = 0;

        // Opțiuni de geolocație - optimizate pentru viteză (desktop și mobile)
        // maximumAge mare = folosește cache-ul browser-ului cât mai mult timp posibil
        // enableHighAccuracy: false = mai rapid pe mobile (nu așteaptă GPS precis)
      const geolocationOptions = {
          enableHighAccuracy: false, // False pentru toate - mai rapid pe mobile și desktop
          maximumAge: 600000, // 10 minute cache - reduce warning-urile și apelurile GPS
          timeout: 15000, // 15 secunde timeout - mai generos pentru mobile (GPS poate fi mai lent)
      };

      console.log(`📍 Requesting location (retry: ${retryCountRef.current}/${MAX_RETRIES}), options:`, geolocationOptions);

      // Cerem geolocația automat
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          console.log('✅ Location obtained:', coords);
          setCurrentLocation(coords);
          setCurrentAddress(coordsAsFallback(coords.latitude, coords.longitude));
          setIsLoading(false);
          retryCountRef.current = 0; // Reset retry counter la succes

          try {
            const address = await getAddressFromCoords(coords.latitude, coords.longitude);
            if (address) {
              console.log('✅ Address obtained:', address);
              setCurrentAddress(address);
            }
          } catch (err) {
            console.error('Error getting address:', err);
          }
        },
        (error) => {
          console.error('❌ Location error:', error);
          console.error('Error code:', error.code, 'Message:', error.message);
          
          // Dacă e timeout și nu am depășit numărul maxim de retry-uri
          if (error.code === 3 && retryCountRef.current < MAX_RETRIES) { // TIMEOUT
            retryCountRef.current += 1;
            console.log(`🔄 Retrying location request (${retryCountRef.current}/${MAX_RETRIES})...`);
            locationRequestedRef.current = false; // Permite retry
            setTimeout(() => {
              requestLocationIfAuthenticated();
            }, 1500); // Așteaptă 1.5 secunde înainte de retry (mai rapid)
            return; // Nu afișa eroarea încă, mai încercăm
          }
          
          // Dacă e permisiune refuzată, permite retry când utilizatorul dă permisiunea
          if (error.code === 1) { // PERMISSION_DENIED
            console.log('⚠️ Location permission denied - user needs to grant permission');
            locationRequestedRef.current = false; // Permite retry când utilizatorul dă permisiunea
            retryCountRef.current = 0; // Reset retry counter
          } else if (error.code === 3) { // TIMEOUT
            // Pentru timeout, permitem retry după un timp (dacă nu am depășit MAX_RETRIES)
            console.log('⚠️ Location request timeout - will retry later');
            locationRequestedRef.current = false; // Permite retry
            retryCountRef.current = 0; // Reset retry counter
          } else {
            // Pentru alte erori, resetăm contorul și permitem retry după un timp
            console.log('⚠️ Location request failed - will retry later');
            locationRequestedRef.current = false; // Permite retry
            retryCountRef.current = 0;
          }
          
          handleLocationError(error);
        },
        geolocationOptions
      );
      } // End if (!locationRequestedRef.current || (!isLoading && !currentLocation))
    } else if (!token || !savedUser) {
      // Utilizatorul nu este autentificat, resetăm
      setCurrentLocation(null);
      setCurrentAddress('');
      setError(null);
      locationRequestedRef.current = false;
      setIsLoading(false);
    }
  }, [coordsAsFallback, currentLocation, getAddressFromCoords, handleLocationError, isLoading]);

  // Cerem geolocația automat când utilizatorul este autentificat
  // Folosim maximumAge mare (10 minute) pentru a folosi cache-ul browser-ului cât mai mult
  // Asta reduce warning-urile pentru că browser-ul poate returna locația cached fără să activeze GPS-ul
  useEffect(() => {
    // Listener pentru schimbări de autentificare între tab-uri
    const handleStorageChange = (e) => {
      if (e.key === 'auth_token' || e.key === 'user') {
        // La login în alt tab, cerem locația
        locationRequestedRef.current = false;
        requestLocationIfAuthenticated();
      }
    };

    // Verificare inițială - cerem imediat dacă utilizatorul este autentificat și nu avem locație
    // Aceasta se întâmplă la login (în același tab) sau la refresh-ul paginii
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser && !currentLocation) {
      // Cerem locația doar o dată la mount dacă utilizatorul este autentificat
      // Folosim maximumAge mare pentru a evita warning-urile (browser-ul folosește cache-ul)
      requestLocationIfAuthenticated();
    }

    // Polling discret pentru a detecta login-ul în același tab (doar dacă nu avem locație)
    // Verificăm la fiecare 2 secunde, dar doar dacă utilizatorul este autentificat și nu avem locație
    // Oprim polling-ul după 30 de secunde pentru a evita warning-urile pe paginile unde nu este necesar
    let pollingAttempts = 0;
    const maxPollingAttempts = 15; // 15 * 2 secunde = 30 secunde maxim
    const checkInterval = setInterval(() => {
      pollingAttempts++;
      
      // Oprim polling-ul după un număr maxim de încercări
      if (pollingAttempts > maxPollingAttempts) {
        clearInterval(checkInterval);
        return;
      }
      
      const currentToken = localStorage.getItem('auth_token');
      const currentUser = localStorage.getItem('user');
      // Dacă utilizatorul este autentificat și nu avem locație, verificăm dacă trebuie să cerem
      if (currentToken && currentUser && !currentLocation && !locationRequestedRef.current) {
        requestLocationIfAuthenticated();
      } else if (currentLocation) {
        // Dacă am obținut locația, oprim polling-ul
        clearInterval(checkInterval);
      }
    }, 2000); // Verifică la fiecare 2 secunde (mai discret decât 5 secunde)

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [requestLocationIfAuthenticated, currentLocation]);

  // Funcție pentru a obține locația curentă (returnează Promise)
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocația nu este suportată de acest browser'));
        return;
      }

      setIsLoading(true);
      setError(null);

      // Opțiuni optimizate pentru toate browserele (inclusiv mobile)
      // enableHighAccuracy: false = mai rapid pe mobile (nu așteaptă GPS precis)
      const geolocationOptions = {
        enableHighAccuracy: false, // False pentru toate - mai rapid pe mobile
        maximumAge: 600000, // 10 minute cache - reduce apelurile GPS
        timeout: 15000, // 15 secunde timeout - generos pentru mobile
          };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          setCurrentLocation(coords);
          setCurrentAddress(coordsAsFallback(coords.latitude, coords.longitude));
          setIsLoading(false);

          // Obține adresa automat
          try {
            const address = await getAddressFromCoords(coords.latitude, coords.longitude);
            if (address) {
              setCurrentAddress(address);
            }
          } catch (err) {
            console.error('Error getting address:', err);
          }

          resolve(coords);
        },
        (error) => {
          handleLocationError(error);
          reject(error);
        },
        geolocationOptions
      );
    });
  }, [coordsAsFallback, getAddressFromCoords, handleLocationError]);

  // Funcție pentru refresh manual (actualizează state-ul global)
  const refreshLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      setIsLoading(true);
      setError(null);
      
      // Opțiuni optimizate pentru toate browserele (inclusiv mobile)
      // enableHighAccuracy: false = mai rapid pe mobile (nu așteaptă GPS precis)
      const geolocationOptions = {
        enableHighAccuracy: false, // False pentru toate - mai rapid pe mobile
        maximumAge: 600000, // 10 minute cache - reduce apelurile GPS
        timeout: 15000, // 15 secunde timeout - generos pentru mobile
          };
      
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        handleLocationError,
        geolocationOptions
      );
    }
  }, [updateLocation, handleLocationError]);

  const value = {
    currentLocation,
    currentAddress,
    isLoading,
    error,
    // Funcții pentru utilizare globală
    refreshLocation,
    getCurrentLocation, // Promise-based pentru când ai nevoie de locație imediat
    getAddressFromCoords, // Funcție publică pentru reverse geocoding
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};
