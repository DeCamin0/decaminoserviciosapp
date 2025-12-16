import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationContext } from './LocationContextBase';

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const geocodeThrottleRef = useRef(0);
  const locationRequestedRef = useRef(false);
  const retryCountRef = useRef(0); // Contor pentru retry-uri
  const MAX_RETRIES = 2; // Maxim 2 retry-uri

  // Funcție pentru reverse geocoding folosind OpenStreetMap
  // Notă: Nominatim API nu include header-ul X-Content-Type-Options în răspunsuri
  // Aceasta este o limitare a serverului extern, nu a aplicației
  const getAddressFromCoords = useCallback(async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'DeCamino-WebApp/1.0'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        // Extrag doar partea relevantă din adresa completă
        const addressParts = data.display_name.split(', ');
        // Preiau primele 3-4 părți pentru o adresă mai curată
        const cleanAddress = addressParts.slice(0, 4).join(', ');
        return cleanAddress;
      }
      return '';
    } catch (error) {
      console.error('Error getting address:', error);
      return '';
    }
  }, []);

  // Funcție pentru actualizarea locației
  const updateLocation = useCallback(async (position) => {
    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    
    setCurrentLocation(coords);
    
    // Throttle geocodarea inversă pentru a evita prea multe cereri
    const nowTs = Date.now();
    if (nowTs - geocodeThrottleRef.current < 10000) return; // 10 secunde între cereri
    
    geocodeThrottleRef.current = nowTs;
    
    try {
      const address = await getAddressFromCoords(coords.latitude, coords.longitude);
      if (address) {
        setCurrentAddress(address);
      }
    } catch (err) {
      console.error('Error updating address:', err);
    }
  }, [getAddressFromCoords]);

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

    if (token && savedUser && !locationRequestedRef.current && !currentLocation) {
      locationRequestedRef.current = true;
      setIsLoading(true);
      setError(null);

      console.log('📍 Requesting location automatically (user authenticated)');
      
      // Reset retry counter la fiecare nouă cerere
      if (retryCountRef.current === 0) {
        retryCountRef.current = 0; // Asigură-te că e 0 la prima încercare
      }

      // Opțiuni de geolocație - folosim setări mai permissive pentru toate browserele
      // Timeout mai mare și maximumAge mai mare pentru a evita timeout-urile
      const geolocationOptions = {
        enableHighAccuracy: false, // False pentru toate - mai rapid și mai sigur
        maximumAge: 300000, // 5 minute cache - permite folosirea locației cache-uite
        timeout: 30000, // 30 secunde timeout - mai mult timp pentru toate browserele
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
            }, 3000); // Așteaptă 3 secunde înainte de retry
            return; // Nu afișa eroarea încă, mai încercăm
          }
          
          // Dacă e permisiune refuzată, permite retry când utilizatorul dă permisiunea
          if (error.code === 1) { // PERMISSION_DENIED
            console.log('⚠️ Location permission denied - user needs to grant permission');
            locationRequestedRef.current = false; // Permite retry când utilizatorul dă permisiunea
            retryCountRef.current = 0; // Reset retry counter
          } else {
            // Pentru alte erori, resetăm contorul după un timp
            retryCountRef.current = 0;
          }
          
          handleLocationError(error);
        },
        geolocationOptions
      );
    } else if (!token || !savedUser) {
      // Utilizatorul nu este autentificat, resetăm
      setCurrentLocation(null);
      setCurrentAddress('');
      setError(null);
      locationRequestedRef.current = false;
      setIsLoading(false);
    }
  }, [currentLocation, getAddressFromCoords, handleLocationError]);

  // Cerem geolocația automat când utilizatorul este autentificat
  useEffect(() => {
    // Verificare inițială
    requestLocationIfAuthenticated();

    // Polling pentru a detecta autentificarea în același tab (storage event nu funcționează în același tab)
    const checkInterval = setInterval(() => {
      requestLocationIfAuthenticated();
    }, 2000); // Verifică la fiecare 2 secunde

    // Listener pentru schimbări de autentificare între tab-uri
    const handleStorageChange = (e) => {
      if (e.key === 'auth_token' || e.key === 'user') {
        locationRequestedRef.current = false;
        requestLocationIfAuthenticated();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [requestLocationIfAuthenticated]);

  // Funcție pentru a obține locația curentă (returnează Promise)
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocația nu este suportată de acest browser'));
        return;
      }

      setIsLoading(true);
      setError(null);

      // Opțiuni optimizate pentru Edge
      const geolocationOptions = isEdge()
        ? {
            enableHighAccuracy: false,
            maximumAge: 300000,
            timeout: 20000,
          }
        : {
            enableHighAccuracy: true,
            maximumAge: 60000,
            timeout: 15000,
          };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          setCurrentLocation(coords);
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
  }, [getAddressFromCoords, handleLocationError, isEdge]);

  // Funcție pentru refresh manual (actualizează state-ul global)
  const refreshLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      setIsLoading(true);
      setError(null);
      
      // Opțiuni optimizate pentru Edge
      const geolocationOptions = isEdge()
        ? {
            enableHighAccuracy: false,
            maximumAge: 300000,
            timeout: 20000,
          }
        : {
            enableHighAccuracy: true,
            maximumAge: 60000,
            timeout: 15000,
          };
      
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        handleLocationError,
        geolocationOptions
      );
    }
  }, [updateLocation, handleLocationError, isEdge]);

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
