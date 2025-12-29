import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes';

/**
 * Component pentru autocompletare adrese
 * Folosește Nominatim (OpenStreetMap) - gratuit
 */
const AddressAutocomplete = ({ value, onChange, placeholder, id, name, className = '' }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const { callApi } = useApi();
  const debounceTimerRef = useRef(null);

  // Căutare adrese folosind Nominatim (gratuit)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const url = routes.searchAddresses(value.trim(), 5);
        const response = await callApi(url);
        
        if (response?.success && response?.data?.results) {
          setSuggestions(response.data.results);
          setShowSuggestions(response.data.results.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.warn('Error fetching address suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, callApi]);

  // Închide sugestiile când se face click în afara componentului
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Extrage numărul din text (ex: "silvio abad 16" -> "16")
  const extractNumber = (text) => {
    if (!text) return null;
    // Caută numere la sfârșitul textului sau după un spațiu
    const match = text.match(/\b(\d+)\b(?:\s*$|\s*[^\d])/);
    return match ? match[1] : null;
  };

  // Verifică dacă adresa conține deja numărul
  const addressContainsNumber = (address, number) => {
    if (!address || !number) return false;
    // Caută numărul în adresă (poate fi "16", "nº 16", "número 16", etc.)
    const regex = new RegExp(`\\b${number}\\b`, 'i');
    return regex.test(address);
  };

  // Adaugă numărul în adresă dacă nu există deja
  const addNumberToAddress = (address, number) => {
    if (!number || addressContainsNumber(address, number)) {
      return address;
    }

    // Încearcă să găsească numele străzii (de obicei la început, până la prima virgulă)
    // Format tipic: "Calle de Silvio Abad, ..." sau "Calle Silvio Abad, ..."
    const parts = address.split(',');
    
    if (parts.length > 0) {
      // Prima parte este de obicei numele străzii
      const streetName = parts[0].trim();
      const rest = parts.slice(1).join(',').trim();
      
      // Adaugă numărul după numele străzii
      if (rest) {
        return `${streetName}, ${number}, ${rest}`;
      } else {
        return `${streetName}, ${number}`;
      }
    } else {
      // Dacă nu găsim virgule, adăugăm numărul la sfârșit
      return `${address}, ${number}`;
    }
  };

  const handleInputChange = (e) => {
    onChange(e);
    setSelectedIndex(-1);
  };

  const handleSelectSuggestion = async (suggestion) => {
    // Extrage numărul din query-ul curent (value)
    const numberFromQuery = extractNumber(value);
    let finalAddress = suggestion.display_name;
    
    // Folosim reverse geocoding cu coordonatele exacte pentru a obține adresa completă cu codul poștal corect
    if (suggestion.lat && suggestion.lon) {
      try {
        setIsLoading(true);
        const url = routes.getAddressFromCoords(suggestion.lat, suggestion.lon);
        const response = await callApi(url);
        
        if (response?.success && response?.data?.address?.display_name) {
          // Folosim adresa obținută prin reverse geocoding (are codul poștal corect)
          finalAddress = response.data.address.display_name;
        }
      } catch (error) {
        console.warn('Error getting precise address:', error);
        // Continuăm cu adresa din sugestie dacă reverse geocoding eșuează
      } finally {
        setIsLoading(false);
      }
    }
    
    // Dacă există un număr în query, îl adăugăm în adresă
    if (numberFromQuery) {
      finalAddress = addNumberToAddress(finalAddress, numberFromQuery);
    }

    onChange({ target: { value: finalAddress, name } });
    setShowSuggestions(false);
    setSuggestions([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        value={value || ''}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.lat}-${suggestion.lon}-${index}`}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${
                selectedIndex === index ? 'bg-blue-50' : ''
              }`}
            >
              <div className="text-sm text-gray-800">
                {suggestion.display_name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;

