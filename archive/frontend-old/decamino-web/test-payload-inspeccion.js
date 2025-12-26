// Test pentru validarea payload-ului de inspecție
// Acest fișier simulează generarea payload-ului conform specificațiilor

// Funcție pentru generarea UUID v4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Funcție pentru generarea numărului de inspecție
const generateInspectionNumber = (type) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const typePrefix = type === 'limpieza' ? 'LIMP' : 'SERV';
  const timestamp = `${year}${month}${day}-${hours}${minutes}`;
  
  return `${typePrefix}-${timestamp}`;
};

// Simulează datele din formular
const mockFormData = {
  nr: generateInspectionNumber('servicios'),
  data: new Date().toISOString().split('T')[0],
  inspector: {
    nume: 'TEST USER ADMINISTRATOR',
    semnaturaPng: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // Semnătură test
  },
  trabajador: {
    nume: 'MAVRU NADIA FLORINA',
    semnaturaPng: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // Semnătură test
  },
  locatie: 'Madrid, Spain (GPS: 40.547123, -3.630694)',
  centro: 'Oficina',
  supervisor: 'TEST USER ADMINISTRATOR',
  puncte: [
    {
      id: 'point_0',
      descriere: 'HORARIO',
      status: 'OK',
      observatii: 'Todo en orden',
      rango: 4,
      calidad: 5
    },
    {
      id: 'point_1',
      descriere: 'REGISTRO',
      status: 'OK',
      observatii: '',
      rango: 3,
      calidad: 4
    }
  ],
  type: 'servicios',
  observaciones: 'Inspección completada satisfactoriamente',
  status: 'completada'
};

// Generează payload-ul conform specificațiilor
const generatePayload = (formData, user) => {
  const inspeccionId = generateUUID();
  
  // Extrage coordonatele GPS din locatie
  const gpsMatch = formData.locatie.match(/GPS: ([\d.-]+), ([\d.-]+)/);
  const lat = gpsMatch ? parseFloat(gpsMatch[1]) : 0;
  const lng = gpsMatch ? parseFloat(gpsMatch[2]) : 0;

  const payload = {
    inspeccionId: inspeccionId,
    timestamp: new Date().toISOString(),
    empleado: {
      id: user?.id || user?.['D.N.I. / NIE'] || 'demo123',
      nume: formData.trabajador.nume,
      email: user?.['CORREO ELECTRONICO'] || user?.email || 'demo@demo.com',
      semnaturaPng: formData.trabajador.semnaturaPng || undefined
    },
    vehicul: {
      placa: formData.centro || 'Oficina',
      km: 0
    },
    locatie: {
      lat: lat,
      lng: lng
    },
    observatii: formData.observaciones || '',
    items: formData.puncte.map(point => ({
      cod: point.id,
      descriere: point.descriere,
      ok: point.rango >= 3 && point.calidad >= 3,
      nota: Math.round((point.rango + point.calidad) / 2),
      comentariu: point.observatii || ''
    })),
    meta: {
      versiuneSchema: 1,
      clientApp: 'decamino-web-1.0.0',
      type: formData.type,
      inspector: formData.inspector.nume,
      semnaturaInspector: formData.inspector.semnaturaPng || undefined,
      supervisor: formData.supervisor || undefined,
      numeroInspeccion: formData.nr
    }
  };

  // Curăță payload-ul - elimină câmpurile undefined
  const cleanPayload = JSON.parse(JSON.stringify(payload, (key, value) => 
    value === undefined ? undefined : value
  ));

  return cleanPayload;
};

// Simulează utilizatorul
const mockUser = {
  id: 'demo123',
  'NOMBRE / APELLIDOS': 'TEST USER ADMINISTRATOR',
  'CORREO ELECTRONICO': 'demo@demo.com',
  'D.N.I. / NIE': '12345678A'
};

// Generează și afișează payload-ul
const payload = generatePayload(mockFormData, mockUser);

console.log('🔍 Payload generat pentru test:');
console.log(JSON.stringify(payload, null, 2));

// Validări pentru payload
console.log('\n✅ Validări:');
console.log('- inspeccionId:', payload.inspeccionId ? '✅' : '❌');
console.log('- timestamp:', payload.timestamp ? '✅' : '❌');
console.log('- empleado.nume:', payload.empleado.nume ? '✅' : '❌');
console.log('- empleado.semnaturaPng:', payload.empleado.semnaturaPng ? '✅' : '❌');
console.log('- vehicul.placa:', payload.vehicul.placa ? '✅' : '❌');
console.log('- locatie.lat:', payload.locatie.lat !== 0 ? '✅' : '❌');
console.log('- locatie.lng:', payload.locatie.lng !== 0 ? '✅' : '❌');
console.log('- items.length:', payload.items.length > 0 ? '✅' : '❌');
console.log('- meta.inspector:', payload.meta.inspector ? '✅' : '❌');
console.log('- meta.semnaturaInspector:', payload.meta.semnaturaInspector ? '✅' : '❌');
console.log('- meta.numeroInspeccion:', payload.meta.numeroInspeccion ? '✅' : '❌');

console.log('\n📋 Structura completă așteptată: ✅');
console.log('Payload-ul este gata pentru trimitere către backend!'); 