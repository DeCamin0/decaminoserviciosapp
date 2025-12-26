// Test pentru pdfMake
import { generateInspectionPDF } from './inspectionExporter.js';

// Date de test pentru o inspecție
const testInspectionData = {
  type: 'limpieza',
  fecha: '2024-01-15',
  hora: '10:30',
  supervisor: 'Test Supervisor',
  centro: 'Test Center',
  trabajador: 'Test Worker',
  servicio: 'Limpieza General',
  uniforme: true,
  enHorarioTrabajo: true,
  confirmandoCliente: false,
  zones: {
    'Zona 1': {
      rango: 4,
      observaciones: 'Test observation'
    }
  },
  calidadDeCamino: 4,
  calidadEmpleada: 5,
  mejoras: 'Test improvements',
  seguiriaDeCamino: true,
  recomendariaDeCamino: true,
  mailContacto: 'test@example.com',
  telefonoContacto: '123456789',
  signatures: {
    trabajador: null,
    cliente: null
  }
};

// Funcție de test
export const testPdfGeneration = async () => {
  try {
    console.log('🧪 Testing PDF generation...');
    const pdfDoc = await generateInspectionPDF(testInspectionData);
    console.log('✅ PDF generated successfully:', pdfDoc);
    return true;
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    return false;
  }
};

// Test automat la încărcare
if (typeof window !== 'undefined') {
  window.testPdfGeneration = testPdfGeneration;
  console.log('🧪 PDF test function available as window.testPdfGeneration()');
} 