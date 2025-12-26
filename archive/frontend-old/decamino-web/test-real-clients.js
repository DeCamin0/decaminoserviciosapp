// Test pentru datele reale ale clienților
const testRealClients = async () => {
  try {
    // Simulează răspunsul de la API
    const mockClients = [
      {
        'NOMBRE O RAZON SOCIAL': 'Test Client 1',
        'LATITUD': '40.4168',
        'LONGITUD': '-3.7038',
        'NIF': '12345678A',
        'tipo': 'cliente'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Test Client 2',
        'LATITUD': '40.4168,',
        'LONGITUD': '-3.7038,',
        'NIF': '87654321B',
        'tipo': 'cliente'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Test Client 3',
        'LATITUD': '40,4168',
        'LONGITUD': '-3,7038',
        'NIF': '11111111C',
        'tipo': 'cliente'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Test Client 4',
        'LATITUD': null,
        'LONGITUD': null,
        'NIF': '22222222D',
        'tipo': 'cliente'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Test Client 5',
        'LATITUD': '',
        'LONGITUD': '',
        'NIF': '33333333E',
        'tipo': 'cliente'
      }
    ];

    console.log('=== TEST DATE REALE CLIENTI ===');
    console.log('Total clienți:', mockClients.length);
    
    // Filtrează doar clienții (nu furnizorii)
    const soloClientes = mockClients.filter(item => item.tipo !== 'proveedor');
    console.log('Clienți după filtrare:', soloClientes.length);
    
    // Funcția de normalizare din MapView
    const normalizeCoordinate = (coord) => {
      if (!coord) return null;
      const normalized = coord.toString().replace(',', '.').replace(/\s/g, '');
      const parsed = parseFloat(normalized);
      return parsed;
    };

    // Test pentru coordonate
    const clientsWithCoords = soloClientes.filter(c => c.LATITUD && c.LONGITUD);
    console.log('\nClienți cu coordonate:', clientsWithCoords.length);
    
    clientsWithCoords.forEach((client, index) => {
      console.log(`\nClient ${index + 1}: ${client['NOMBRE O RAZON SOCIAL']}`);
      console.log('LATITUD original:', client.LATITUD);
      console.log('LONGITUD original:', client.LONGITUD);
      
      const lat = normalizeCoordinate(client.LATITUD);
      const lng = normalizeCoordinate(client.LONGITUD);
      
      console.log('LATITUD normalizat:', lat);
      console.log('LONGITUD normalizat:', lng);
      console.log('Coordonate valide:', lat && lng && !isNaN(lat) && !isNaN(lng));
      
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        console.log('✅ Marker va fi creat');
      } else {
        console.log('❌ Marker NU va fi creat');
      }
    });

    // Test pentru centrul hărții
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
      
      console.log('\n=== CENTRU HARTĂ ===');
      console.log('Centru calculat:', { lat: avgLat, lng: avgLng });
      console.log('Centru valid:', avgLat && avgLng && !isNaN(avgLat) && !isNaN(avgLng));
    }

    // Test pentru bounds
    if (clientsWithCoords.length > 0) {
      console.log('\n=== TEST BOUNDS ===');
      const bounds = {
        north: -90,
        south: 90,
        east: -180,
        west: 180
      };
      
      clientsWithCoords.forEach(client => {
        const lat = normalizeCoordinate(client.LATITUD);
        const lng = normalizeCoordinate(client.LONGITUD);
        
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          bounds.north = Math.max(bounds.north, lat);
          bounds.south = Math.min(bounds.south, lat);
          bounds.east = Math.max(bounds.east, lng);
          bounds.west = Math.min(bounds.west, lng);
        }
      });
      
      console.log('Bounds calculat:', bounds);
      console.log('Bounds valid:', bounds.north > bounds.south && bounds.east > bounds.west);
    }

  } catch (error) {
    console.error('Eroare la testare:', error);
  }
};

testRealClients(); 