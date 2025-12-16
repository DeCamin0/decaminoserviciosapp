import { useState, useEffect } from 'react';

const GeocodingAddress = ({ lat, lng, className = "" }) => {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_KEY = 'AIzaSyCT_ckrENZ9ULTwQ5Ys8y0hzqFLtkEIB6E';

  useEffect(() => {
    const getAddressFromCoords = async () => {
      if (!lat || !lng) {
        setError('Coordonatele lipsesc');
        return;
      }

      setLoading(true);
      setError('');
      setAddress('');

      try {
        // Normalizează coordonatele (înlocuiește virgula cu punct)
        const normalizedLat = lat.toString().replace(',', '.');
        const normalizedLng = lng.toString().replace(',', '.');

        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${normalizedLat},${normalizedLng}&key=${API_KEY}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
          // Extrage adresa completă din primul rezultat
          const fullAddress = data.results[0].formatted_address;
          setAddress(fullAddress);
        } else if (data.status === 'ZERO_RESULTS') {
          setError('Nu s-a găsit nicio adresă pentru aceste coordonate');
        } else {
          setError(`Eroare API: ${data.status} - ${data.error_message || 'Eroare necunoscută'}`);
        }
      } catch (error) {
        console.error('Eroare la obținerea adresei:', error);
        setError('Eroare la conectarea cu Google Maps API');
      } finally {
        setLoading(false);
      }
    };

    getAddressFromCoords();
  }, [lat, lng]);

  if (loading) {
    return (
      <div className={`${className} flex items-center space-x-2 text-gray-600`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span>Se încarcă adresa...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} text-red-600 text-sm`}>
        <span className="font-medium">Eroare:</span> {error}
      </div>
    );
  }

  if (!address) {
    return (
      <div className={`${className} text-gray-500 text-sm`}>
        Nu s-a putut obține adresa
      </div>
    );
  }

  return (
    <div className={`${className} text-sm`}>
      <p className="text-gray-700">
        <span className="font-medium">Adresa:</span> {address}
      </p>
    </div>
  );
};

export default GeocodingAddress; 