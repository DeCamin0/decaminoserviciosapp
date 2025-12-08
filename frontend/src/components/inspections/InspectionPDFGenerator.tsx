import React, { useState } from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  pdf,
  Image,
  Font
} from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { routes } from '../../utils/routes';

// Înregistrează fonturile
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfB.ttf', fontWeight: 'bold' }
  ]
});

// Stiluri pentru PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
    position: 'relative'
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    zIndex: 0
  },
  content: {
    position: 'relative',
    zIndex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderBottom: '2 solid #e53e3e',
    paddingBottom: 10
  },
  logo: {
    width: 120,
    height: 60
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e53e3e',
    textAlign: 'center'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 20,
    textAlign: 'center'
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e53e3e',
    marginBottom: 8,
    borderBottom: '1 solid #e53e3e',
    paddingBottom: 4
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4a5568',
    width: '30%'
  },
  value: {
    fontSize: 10,
    color: '#2d3748',
    width: '70%'
  },
  observations: {
    fontSize: 10,
    color: '#2d3748',
    marginTop: 8,
    lineHeight: 1.4
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#718096'
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  signatureBox: {
    width: '45%',
    borderTop: '1 solid #cbd5e0',
    paddingTop: 10
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 20
  }
});

// Componenta PDF
const InspectionPDF = ({ inspectionData }: { inspectionData: any }) => {
  const { t } = useTranslation();
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Imagine de fundal */}
        <Image 
          src={window.location.hostname.includes('ngrok') 
            ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo='
            : './logo.svg'
          }
          style={styles.backgroundImage}
        />
        
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Image src={window.location.hostname.includes('ngrok') 
              ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo='
              : './logo.svg'
            } style={styles.logo} />
            <Text style={styles.headerText}>DeCamino Servicios Auxiliares SL</Text>
          </View>
          
          {/* Titlu */}
          <Text style={styles.title}>
            Foaie de Inspecție - {inspectionData.fecha}
          </Text>
          
          {/* Informații angajat */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informații Angajat</Text>
            <View style={styles.row}>
              <Text style={styles.label}>ID:</Text>
              <Text style={styles.value}>{inspectionData.empleado.id}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Nume:</Text>
              <Text style={styles.value}>{inspectionData.empleado.nombre}</Text>
            </View>
          </View>
          
          {/* Informații supervisor */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informații Supervisor</Text>
            <View style={styles.row}>
              <Text style={styles.label}>ID:</Text>
              <Text style={styles.value}>{inspectionData.supervisor.id}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Nume:</Text>
              <Text style={styles.value}>{inspectionData.supervisor.nombre}</Text>
            </View>
          </View>
          
          {/* Detalii inspecție */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalii Inspecție</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Data:</Text>
              <Text style={styles.value}>{inspectionData.fecha}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Locație:</Text>
              <Text style={styles.value}>{inspectionData.ubicacion}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Stare:</Text>
              <Text style={styles.value}>{inspectionData.estado || 'În curs'}</Text>
            </View>
          </View>
          
          {/* Observații */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observații</Text>
            <Text style={styles.observations}>
              {inspectionData.observaciones || 'Nu există observații specifice.'}
            </Text>
          </View>
          
          {/* Semnături */}
          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Semnătura Angajat</Text>
              <View style={{ height: 40, borderBottom: '1 solid #cbd5e0' }} />
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Semnătura Supervisor</Text>
              <View style={{ height: 40, borderBottom: '1 solid #cbd5e0' }} />
            </View>
          </View>
        </View>
        
        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generat automat de sistemul DeCamino</Text>
          <Text>Pagina 1 din 1</Text>
        </View>
      </Page>
    </Document>
  );
};

// Componenta principală
export const InspectionPDFGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Date de test pentru inspecție
  const generateInspectionData = () => ({
    empleado: {
      id: 123,
      nombre: "Juan Pérez"
    },
    supervisor: {
      id: 456,
      nombre: "Marta García"
    },
    fecha: "2025-08-05",
    ubicacion: "Obra Madrid Norte",
    observaciones: "Todo correcto, excepto señalización de zona 3",
    estado: "Completada"
  });

  const generateAndSendPDF = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Generează datele inspecției
      const inspectionData = generateInspectionData();
      
      // Generează PDF-ul
      const pdfDoc = <InspectionPDF inspectionData={inspectionData} />;
      const pdfBlob = await pdf(pdfDoc).toBlob();
      
      // Convertește în Base64
      const base64 = await blobToBase64(pdfBlob);
      
      // Generează numele fișierului
      const fileName = `inspeccion_${inspectionData.fecha.replace(/-/g, '_')}.pdf`;
      
      // Pregătește payload-ul pentru n8n
      const payload = {
        fileName,
        base64pdf: base64,
        empleado: inspectionData.empleado,
        supervisor: inspectionData.supervisor,
        fecha: inspectionData.fecha,
        ubicacion: inspectionData.ubicacion,
        observaciones: inspectionData.observaciones
      };

      // Trimite la webhook n8n
      const response = await fetch(routes.generateInspectionPDF, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('PDF enviado con éxito:', result);
      setSuccess(true);
      
    } catch (err) {
      console.error('Error al generar/enviar el PDF:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Funcție helper pentru conversia Blob în Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Elimină prefixul "data:application/pdf;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Generador de Hoja de Inspección PDF
        </h2>
        <p className="text-gray-600">
          Genera y envía automáticamente la hoja de inspección en formato PDF al sistema n8n.
        </p>
      </div>

      <div className="space-y-4">
        {/* Informații despre funcționalitate */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Funcionalidades
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Genera PDF con logo y encabezado DeCamino</li>
            <li>• Incluye imagen de fondo con logo</li>
            <li>• Convierte automáticamente a Base64</li>
            <li>• Envía al webhook n8n</li>
            <li>• Incluye todos los datos necesarios</li>
          </ul>
        </div>

        {/* Buton de generare */}
        <div className="flex justify-center">
          <Button
            onClick={generateAndSendPDF}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generando PDF...
              </div>
            ) : (
              'Generar y Enviar PDF'
            )}
          </Button>
        </div>

        {/* Mesaje de feedback */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-800 mb-2">
              Eroare
            </h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-2">
              ¡Éxito!
            </h4>
            <p className="text-sm text-green-700">
              El PDF ha sido generado y enviado con éxito al sistema n8n.
            </p>
          </div>
        )}

        {/* Exemplu payload */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Ejemplo Payload Enviado
          </h3>
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
{`{
  "fileName": "inspeccion_2025_08_05.pdf",
  "base64pdf": "JVBERi0xLjQKJcOkw7zDtsO...",
  "empleado": {
    "id": 123,
    "nombre": "Juan Pérez"
  },
  "supervisor": {
    "id": 456,
    "nombre": "Marta García"
  },
  "fecha": "2025-08-05",
  "ubicacion": "Obra Madrid Norte",
  "observaciones": "Todo correcto, excepto señalización de zona 3"
}`}
          </pre>
        </div>
      </div>
    </Card>
  );
}; 
          <View style={styles.signatureSection}>

            <View style={styles.signatureBox}>

              <Text style={styles.signatureLabel}>Semnătura Angajat</Text>

              <View style={{ height: 40, borderBottom: '1 solid #cbd5e0' }} />

            </View>

            <View style={styles.signatureBox}>

              <Text style={styles.signatureLabel}>Semnătura Supervisor</Text>

              <View style={{ height: 40, borderBottom: '1 solid #cbd5e0' }} />

            </View>

          </View>

        </View>

        

        {/* Footer */}

        <View style={styles.footer}>

          <Text>Generat automat de sistemul DeCamino</Text>

          <Text>Pagina 1 din 1</Text>

        </View>

      </Page>

    </Document>

  );

};



// Componenta principală

export const InspectionPDFGenerator: React.FC = () => {

  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);



  // Date de test pentru inspecție

  const generateInspectionData = () => ({

    empleado: {

      id: 123,

      nombre: "Juan Pérez"

    },

    supervisor: {

      id: 456,

      nombre: "Marta García"

    },

    fecha: "2025-08-05",

    ubicacion: "Obra Madrid Norte",

    observaciones: "Todo correcto, excepto señalización de zona 3",

    estado: "Completada"

  });



  const generateAndSendPDF = async () => {

    setLoading(true);

    setError(null);

    setSuccess(false);



    try {

      // Generează datele inspecției

      const inspectionData = generateInspectionData();

      

      // Generează PDF-ul

      const pdfDoc = <InspectionPDF inspectionData={inspectionData} />;

      const pdfBlob = await pdf(pdfDoc).toBlob();

      

      // Convertește în Base64

      const base64 = await blobToBase64(pdfBlob);

      

      // Generează numele fișierului

      const fileName = `inspeccion_${inspectionData.fecha.replace(/-/g, '_')}.pdf`;

      

      // Pregătește payload-ul pentru n8n

      const payload = {

        fileName,

        base64pdf: base64,

        empleado: inspectionData.empleado,

        supervisor: inspectionData.supervisor,

        fecha: inspectionData.fecha,

        ubicacion: inspectionData.ubicacion,

        observaciones: inspectionData.observaciones

      };



      // Trimite la webhook n8n

      const response = await fetch(routes.generateInspectionPDF, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

        },

        body: JSON.stringify(payload)

      });



      if (!response.ok) {

        throw new Error(`HTTP error! status: ${response.status}`);

      }



      const result = await response.json();

      console.log('PDF enviado con éxito:', result);

      setSuccess(true);

      

    } catch (err) {

      console.error('Eroare la generarea/trimiterea PDF:', err);

      setError(err instanceof Error ? err.message : 'Eroare necunoscută');

    } finally {

      setLoading(false);

    }

  };



  // Funcție helper pentru conversia Blob în Base64

  const blobToBase64 = (blob: Blob): Promise<string> => {

    return new Promise((resolve, reject) => {

      const reader = new FileReader();

      reader.onload = () => {

        const result = reader.result as string;

        // Elimină prefixul "data:application/pdf;base64,"

        const base64 = result.split(',')[1];

        resolve(base64);

      };

      reader.onerror = reject;

      reader.readAsDataURL(blob);

    });

  };



  return (

    <Card className="p-6">

      <div className="mb-6">

        <h2 className="text-2xl font-bold text-gray-800 mb-2">

          Generador de Hoja de Inspección PDF

        </h2>

        <p className="text-gray-600">

          Genera y envía automáticamente la hoja de inspección en formato PDF al sistema n8n.

        </p>

      </div>



      <div className="space-y-4">

        {/* Informații despre funcționalitate */}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">

          <h3 className="text-lg font-semibold text-blue-800 mb-2">

            Funcionalidades

          </h3>

          <ul className="text-sm text-blue-700 space-y-1">

            <li>• Generează PDF cu logo și antet DeCamino</li>

            <li>• Include imagine de fundal cu logo</li>

            <li>• Convertește automat în Base64</li>

            <li>• Trimite la webhook n8n</li>

            <li>• Include toate datele necesare</li>

          </ul>

        </div>



        {/* Buton de generare */}

        <div className="flex justify-center">

          <Button

            onClick={generateAndSendPDF}

            disabled={loading}

            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg"

          >

            {loading ? (

              <div className="flex items-center gap-2">

                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>

                Generando PDF...

              </div>

            ) : (

              'Generar y Enviar PDF'

            )}

          </Button>

        </div>



        {/* Mesaje de feedback */}

        {error && (

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">

            <h4 className="text-sm font-medium text-red-800 mb-2">

              Eroare

            </h4>

            <p className="text-sm text-red-700">{error}</p>

          </div>

        )}



        {success && (

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">

            <h4 className="text-sm font-medium text-green-800 mb-2">

              ¡Éxito!

            </h4>

            <p className="text-sm text-green-700">

              El PDF ha sido generado y enviado con éxito al sistema n8n.

            </p>

          </div>

        )}



        {/* Exemplu payload */}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">

          <h3 className="text-lg font-semibold text-gray-800 mb-2">

            Ejemplo Payload Enviado

          </h3>

          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">

{`{

  "fileName": "inspeccion_2025_08_05.pdf",

  "base64pdf": "JVBERi0xLjQKJcOkw7zDtsO...",

  "empleado": {

    "id": 123,

    "nombre": "Juan Pérez"

  },

  "supervisor": {

    "id": 456,

    "nombre": "Marta García"

  },

  "fecha": "2025-08-05",

  "ubicacion": "Obra Madrid Norte",

  "observaciones": "Todo correcto, excepto señalización de zona 3"

}`}

          </pre>

        </div>

      </div>

    </Card>

  );

}; 
