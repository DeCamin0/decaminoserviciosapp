import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationContext } from './LocationContextBase';

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const geocodeThrottleRef = useRef(0);

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

  // Funcție pentru gestionarea erorilor de geolocație
  const handleLocationError = useCallback((locationError) => {
    console.error('Location error:', locationError);
    setError(locationError.message);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocația nu este suportată de acest browser');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Configurare pentru geolocație de înaltă precizie
    const options = {
      enableHighAccuracy: true,
      maximumAge: 5000, // 5 secunde
      timeout: 10000,   // 10 secunde timeout
    };

    // Obține locația inițială
    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleLocationError,
      options
    );

    // Urmărește schimbările de locație în timp real
    const watchId = navigator.geolocation.watchPosition(
      updateLocation,
      handleLocationError,
      options
    );

    setIsLoading(false);

    // Cleanup la unmount
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [updateLocation, handleLocationError]);

  const value = {
    currentLocation,
    currentAddress,
    isLoading,
    error,
    // Funcție pentru refresh manual
    refreshLocation: () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          updateLocation,
          handleLocationError,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
    }
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};
