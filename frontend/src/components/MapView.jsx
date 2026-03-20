import { useRef, useCallback, useMemo } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

// Suprimă avertismentul de deprecation pentru Marker și elementele duplicate
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && 
      (args[0].includes('google.maps.Marker is deprecated') || 
       args[0].includes('Element with name') ||
       args[0].includes('already defined'))) {
    return; // Ignoră avertismentul de deprecation și elementele duplicate
  }
  originalWarn.apply(console, args);
};

const MapView = ({ lat, lng, clientName, className = "h-64 w-full", clients = null }) => {
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef(null);

  // Normalizează coordonatele (înlocuiește virgula cu punct)
  const normalizeCoordinate = (coord) => {
    if (!coord || coord === '') return null;
    
    // Convertim la string și eliminăm spațiile
    const coordStr = coord.toString().replace(/\s/g, '');
    
    // Verificăm dacă este gol sau null
    if (coordStr === '' || coordStr === 'null' || coordStr === 'undefined') return null;
    
    // Înlocuim virgula cu punct pentru format spaniol
    const normalized = coordStr.replace(',', '.');
    
    // Parsăm ca float
    const parsed = parseFloat(normalized);
    
    // Verificăm dacă este un număr valid
    if (isNaN(parsed)) {
      console.warn('⚠️ Coordonată invalidă:', coord, '->', normalized, '->', parsed);
      return null;
    }
    
    return parsed;
  };

  // Funcție pentru fitBounds - memoizată pentru a evita re-render-urile
  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Determină centrul hărții și markerii
  let center = null;
  let markers = [];

  if (clients && clients.length > 0) {
    // Pentru mai mulți clienți
    const clientsWithCoords = clients.filter(c => c.LATITUD && c.LONGITUD);
    
    // Debug: verifică coordonatele
    console.log('🗺️ MapView - Total clients received:', clients.length);
    console.log('📍 MapView - Clients with coordinates:', clientsWithCoords.length);
    console.log('❌ MapView - Clients without coordinates:', clients.length - clientsWithCoords.length);
    
    if (clientsWithCoords.length > 0) {
      // Calculează centrul mediu pentru a centra harta pe zona cu cei mai mulți clienți
      const totalLat = clientsWithCoords.reduce((sum, client) => {
        const lat = normalizeCoordinate(client.LATITUD);
        return sum + (lat || 0);
      }, 0);
      
      const totalLng = clientsWithCoords.reduce((sum, client) => {
        const lng = normalizeCoordinate(client.LONGITUD);
        return sum + (lng || 0);
      }, 0);
      
      const avgLat = totalLat / clientsWithCoords.length;
      const avgLng = totalLng / clientsWithCoords.length;
      
      center = { lat: avgLat, lng: avgLng };
      
      // Creează markeri pentru toți clienții
      markers = clientsWithCoords.map((client) => {
        const clientLat = normalizeCoordinate(client.LATITUD);
        const clientLng = normalizeCoordinate(client.LONGITUD);
        
        // Debug: verifică coordonatele individuale
        console.log('📍 Processing client:', {
          nombre: client['NOMBRE O RAZON SOCIAL'],
          latOriginal: client.LATITUD,
          lngOriginal: client.LONGITUD,
          latNormalized: clientLat,
          lngNormalized: clientLng,
          isValid: clientLat && clientLng && !isNaN(clientLat) && !isNaN(clientLng)
        });
        
        if (clientLat && clientLng && !isNaN(clientLat) && !isNaN(clientLng)) {
          const marker = {
            position: { lat: clientLat, lng: clientLng },
            title: client['NOMBRE O RAZON SOCIAL'] || 'Client',
            info: `NIF: ${client.NIF || 'N/A'}`
          };
          return marker;
        }
        return null;
      }).filter(Boolean);
      
      console.log('🗺️ MapView - Total markers created:', markers.length);
      
    }
    
  } else if (lat && lng) {
    // Pentru un singur client
    const normalizedLat = normalizeCoordinate(lat);
    const normalizedLng = normalizeCoordinate(lng);
    
    if (normalizedLat && normalizedLng && !isNaN(normalizedLat) && !isNaN(normalizedLng)) {
      center = { lat: normalizedLat, lng: normalizedLng };
      markers = [{
        position: { lat: normalizedLat, lng: normalizedLng },
        title: clientName || 'Client',
        info: `${normalizedLat}, ${normalizedLng}`
      }];
    }
  }

  const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '20px',
    border: '4px solid #e5e7eb'
  };

  // Opțiuni pentru harta Google Maps - memoizate pentru a evita re-render-urile
  const mapOptions = useMemo(() => ({
    zoomControl: true,
    scrollwheel: true,
    streetViewControl: true,
    mapTypeControl: true,
    fullscreenControl: true,
    gestureHandling: 'cooperative'
  }), []);

  if (!center || !center.lat || !center.lng || isNaN(center.lat) || isNaN(center.lng)) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center min-h-[800px]`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🗺️</div>
          <p>Nu sunt coordonate disponibile</p>
          <p className="text-xs mt-2">Coordonate: {lat}, {lng}</p>
          {clients && (
            <p className="text-xs mt-1">Clientes con coordenadas: {clients.filter(c => c.LATITUD && c.LONGITUD).length}</p>
          )}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${className} bg-red-50 rounded-lg flex items-center justify-center min-h-[800px]`}>
        <div className="text-center text-red-600">
          <div className="text-4xl mb-2">❌</div>
          <p>Error al cargar el mapa</p>
          <p className="text-xs mt-2">Google Maps API error</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center min-h-[800px]`}>
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-xl overflow-hidden border-2 border-gray-200 bg-white shadow-lg`}>
      <div className="p-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">📍 Ubicación en el mapa</h3>
        <p className="text-sm text-gray-600">
          {clients ? 
            `Usa zoom y navega para explorar la zona con ${markers.length} clientes` :
            'Usa zoom y navega para explorar la zona en detalle'
          }
        </p>
      </div>
      <div className="p-1">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={clients && clients.length > 1 ? 10 : 15}
          options={mapOptions}
          onLoad={onLoad}
        >
          {markers.map((marker, index) => {
            const labelText = (marker.title || 'Client');
            const trimmedText = labelText.length > 25 ? labelText.substring(0, 25) + '...' : labelText;
            return (
              <Marker
                key={index}
                position={marker.position}
                title={labelText}
                label={{ text: trimmedText }}
              />
            );
          })}
        </GoogleMap>
      </div>
    </div>
  );
};

export default MapView; 