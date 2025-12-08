// Test pentru coordonatele clienților
const testCoordinates = () => {
  // Simulează datele clienților
  const sampleClients = [
    {
      'NOMBRE O RAZON SOCIAL': 'Client Test 1',
      'LATITUD': '40.4168',
      'LONGITUD': '-3.7038',
      'NIF': '12345678A'
    },
    {
      'NOMBRE O RAZON SOCIAL': 'Client Test 2',
      'LATITUD': '40.4168,',
      'LONGITUD': '-3.7038,',
      'NIF': '87654321B'
    },
    {
      'NOMBRE O RAZON SOCIAL': 'Client Test 3',
      'LATITUD': '40,4168',
      'LONGITUD': '-3,7038',
      'NIF': '11111111C'
    },
    {
      'NOMBRE O RAZON SOCIAL': 'Client Test 4',
      'LATITUD': null,
      'LONGITUD': null,
      'NIF': '22222222D'
    }
  ];

  // Funcția de normalizare din MapView
  const normalizeCoordinate = (coord) => {
    if (!coord) return null;
    const normalized = coord.toString().replace(',', '.').replace(/\s/g, '');
    const parsed = parseFloat(normalized);
    console.log('Normalize coordinate:', coord, '->', normalized, '->', parsed);
    return parsed;
  };

  console.log('=== TEST COORDONATE ===');
  
  sampleClients.forEach((client, index) => {
    console.log(`\nClient ${index + 1}: ${client['NOMBRE O RAZON SOCIAL']}`);
    console.log('LATITUD original:', client.LATITUD);
    console.log('LONGITUD original:', client.LONGITUD);
    
    const lat = normalizeCoordinate(client.LATITUD);
    const lng = normalizeCoordinate(client.LONGITUD);
    
    console.log('LATITUD normalizat:', lat);
    console.log('LONGITUD normalizat:', lng);
    console.log('Coordonate valide:', lat && lng && !isNaN(lat) && !isNaN(lng));
  });

  // Test pentru centrul hărții
  const clientsWithCoords = sampleClients.filter(c => c.LATITUD && c.LONGITUD);
  console.log('\n=== TEST CENTRU HARTĂ ===');
  console.log('Clienți cu coordonate:', clientsWithCoords.length);
  
  if (clientsWithCoords.length > 0) {
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
    
    console.log('Centru calculat:', { lat: avgLat, lng: avgLng });
  }
};

testCoordinates(); 