import { useState, useEffect, useMemo } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { GoogleMapsContext } from './GoogleMapsContextBase';

// Error handler pentru Google Maps vendor bundle errors
window.addEventListener('error', function(event) {
  const msg = event.message || '';
  if (msg.includes('Cannot read properties of undefined') && 
      (msg.includes('reading \'CJ\'') || msg.includes('reading \'get\''))) {
    console.warn('⚠️ Suppressed Google Maps vendor bundle error');
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

window.addEventListener('unhandledrejection', function(event) {
  const msg = event.reason?.message || '';
  if (msg.includes('Cannot read properties of undefined') && 
      (msg.includes('reading \'CJ\'') || msg.includes('reading \'get\''))) {
    console.warn('⚠️ Suppressed Google Maps vendor bundle promise rejection');
    event.preventDefault();
    return false;
  }
});

// Constante statice pentru a evita re-render-urile
const GOOGLE_MAPS_LIBRARIES = ['places'];
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || null; // Dezactivat temporar

// Flag global pentru a preveni încărcarea multiplă
let isGoogleMapsLoaded = false;

// Funcție pentru a verifica dacă Google Maps este încărcat
const checkGoogleMapsLoaded = () => {
  return window.google && 
         window.google.maps && 
         window.google.maps.places;
};

export const GoogleMapsProvider = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(isGoogleMapsLoaded);
  const [loadError, setLoadError] = useState(null);
  
  // Ignore ALL Google Maps errors completely
  useEffect(() => {
    // Wrap Google Maps with try-catch to suppress all errors
    const errorHandler = (e) => {
      const msg = e.message || e.toString() || '';
      if (msg.includes('CJ') || msg.includes('get')) {
        return false; // Prevent default
      }
    };
    
    window.addEventListener('error', errorHandler, true);
    window.addEventListener('unhandledrejection', errorHandler, true);
    
    return () => {
      window.removeEventListener('error', errorHandler, true);
      window.removeEventListener('unhandledrejection', errorHandler, true);
    };
  }, []);
  
  // Verifică dacă Google Maps este deja încărcat
  useEffect(() => {
    if (checkGoogleMapsLoaded()) {
      isGoogleMapsLoaded = true;
      setIsLoaded(true);
    }
  }, []);
  
  // Memoizează handler-ele pentru a evita re-render-urile
  const handleLoad = useMemo(() => () => {
    if (!isGoogleMapsLoaded) {
      // Verifică dacă Google Maps este complet încărcat
      const checkGoogleMapsComplete = () => {
        try {
          return window.google && 
                 window.google.maps && 
                 window.google.maps.places &&
                 window.google.maps.places.PlacesService;
        } catch (e) {
          return false;
        }
      };

      if (checkGoogleMapsComplete()) {
        isGoogleMapsLoaded = true;
        setIsLoaded(true);
        console.log('Google Maps API loaded successfully');
      } else {
        // Retry după 100ms dacă nu e complet încărcat
        setTimeout(() => {
          if (checkGoogleMapsComplete()) {
            isGoogleMapsLoaded = true;
            setIsLoaded(true);
            console.log('Google Maps API loaded successfully (retry)');
          }
        }, 100);
      }
    }
  }, []);

  const handleError = useMemo(() => (error) => {
    setLoadError(error);
    console.error('Google Maps API load error:', error);
    
    // Dacă e eroarea CJ sau 'get', doar loghează, nu reîncărca
    if (error && error.message && (error.message.includes('CJ') || error.message.includes('get'))) {
      console.warn('⚠️ Google Maps vendor bundle error detected, suppressing...');
      // NU reîncărca pagina - doar ignora eroarea
      return;
    }
  }, []);

  // Memoizează loading element-ul
  const loadingElement = useMemo(() => (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span className="ml-2 text-gray-600">Loading Google Maps...</span>
    </div>
  ), []);

  // Verifică dacă Google Maps este deja încărcat
  const isAlreadyLoaded = isGoogleMapsLoaded || checkGoogleMapsLoaded();

  // Dacă nu există API key, nu încărca Google Maps
  if (!API_KEY) {
    // În development/demo, nu mai afișăm warning-ul pentru a evita zgomotul în consolă
    if (import.meta?.env?.PROD) {
      console.warn('Google Maps API key not found. Maps functionality disabled.');
    }
    return (
      <GoogleMapsContext.Provider value={{ isLoaded: false, loadError: 'API key not configured' }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  // Dacă Google Maps este deja încărcat (obiectul global există), nu mai încărca din nou
  if (isAlreadyLoaded) {
    return (
      <GoogleMapsContext.Provider value={{ isLoaded: true, loadError: null }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      <LoadScript
        googleMapsApiKey={API_KEY}
        onLoad={handleLoad}
        onError={handleError}
        libraries={GOOGLE_MAPS_LIBRARIES}
        preventGoogleFontsLoading={true}
        loadingElement={loadingElement}
        id="google-maps-script"
      >
        {children}
      </LoadScript>
    </GoogleMapsContext.Provider>
  );
}; 