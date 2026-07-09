import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Modal, Button } from '../ui';
import EmployeePDF from './EmployeePDF';
import { routes } from '../../utils/routes';
import { config } from '../../config/env';

const EmployeePDFGenerator = ({ 
  employeeData, 
  createdBy,
  enviarAGestoria = false,
  mensajeAdicional = '',
  archivosAdicionales = [],
  isRetrimitere = false, // Flag pentru retrimitere ficha (nu adaugă în BD)
  onSuccess, 
  onError,
  showModal,
  setShowModal 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Generare și previzualizare PDF
  const generateAndPreviewPDF = async () => {
    if (!employeeData) {
      onError?.('No hay datos del empleado para generar el PDF');
      return;
    }

    try {
      setIsGenerating(true);
      
      const blob = await pdf(<EmployeePDF employeeData={employeeData} createdBy={createdBy} />).toBlob();
      const url = URL.createObjectURL(blob);
      
      setPreviewUrl(url);
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      onError?.('Error al generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  // Trimitere PDF către backend
  const sendPDFToBackend = async () => {
    if (!employeeData) {
      onError?.('No hay datos del empleado para enviar');
      return;
    }

    try {
      setIsGenerating(true);
      
      // Generează PDF-ul
      const blob = await pdf(<EmployeePDF employeeData={employeeData} createdBy={createdBy} />).toBlob();
      
      // Numele fișierului
      const employeeName = (employeeData['NOMBRE / APELLIDOS'] || 'Sin_Nombre').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const fileName = `Ficha_${employeeName}.pdf`;

      // Creează FormData pentru trimiterea fișierului
      const formData = new FormData();
      
      // Adaugă PDF-ul ca fișier
      formData.append('pdf', blob, fileName);
      
      // Trimite câmpurile individual (fără JSON în interiorul FormData)
      const fieldsToSend = {
        CODIGO: employeeData.CODIGO,
        'NOMBRE / APELLIDOS': employeeData['NOMBRE / APELLIDOS'],
        'CORREO ELECTRONICO': employeeData['CORREO ELECTRONICO'],
        NACIONALIDAD: employeeData.NACIONALIDAD,
        DIRECCION: employeeData.DIRECCION,
        'D.N.I. / NIE': employeeData['D.N.I. / NIE'],
        'SEG. SOCIAL': employeeData['SEG. SOCIAL'],
        'Nº Cuenta': employeeData['Nº Cuenta'],
        TELEFONO: employeeData.TELEFONO,
        'FECHA NACIMIENTO': employeeData['FECHA NACIMIENTO'],
        'FECHA DE ALTA': employeeData['FECHA DE ALTA'],
        'FECHA DE BAJA': employeeData['FECHA DE BAJA'],
        'Fecha Antigüedad': employeeData['Fecha Antigüedad'],
        'Antigüedad': employeeData['Antigüedad'],
        'CENTRO TRABAJO': employeeData['CENTRO TRABAJO'],
        'TIPO DE CONTRATO': employeeData['TIPO DE CONTRATO'],
        'SUELDO BRUTO MENSUAL': employeeData['SUELDO BRUTO MENSUAL'],
        'HORAS DE CONTRATO': employeeData['HORAS DE CONTRATO'],
        EMPRESA: employeeData.EMPRESA,
        GRUPO: employeeData.GRUPO,
        ESTADO: employeeData.ESTADO,
        DerechoPedidos: employeeData.DerechoPedidos || 'NO',
        TrabajaFestivos: employeeData.TrabajaFestivos || 'NO'
      };

      Object.entries(fieldsToSend).forEach(([key, value]) => {
        formData.append(key, value ?? '');
      });
      
      // Adaugă metadatele (exact ca înainte)
      formData.append('createdBy', JSON.stringify({
          nombre: createdBy || 'Sistema',
          fecha: new Date().toISOString()
      }));
      formData.append('fecha', new Date().toISOString().split('T')[0]);
      formData.append('tipo', 'ficha_empleado');
      formData.append('enviarAGestoria', enviarAGestoria ? 'true' : 'false');
      
      // Adaugă mesajul adițional dacă există
      if (mensajeAdicional && mensajeAdicional.trim() !== '') {
        formData.append('mensajeAdicionalGestoria', mensajeAdicional);
      }
      
      // Adaugă fișierele adiționale dacă există
      if (archivosAdicionales && archivosAdicionales.length > 0) {
        archivosAdicionales.forEach((file) => {
          formData.append('archivosGestoria', file);
        });
      }

      // Trimite la backend-ul nou
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0'
        // Nu setăm Content-Type pentru FormData, browser-ul o setează automat cu boundary
      };
      
      // Adăugăm token-ul JWT pentru autentificare
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Folosește endpoint-ul de retrimitere dacă este cazul
      const endpoint = isRetrimitere ? routes.retrimiteFicha : routes.addUser;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      
      // Închide modalul de preview
      setShowPreview(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      
      onSuccess?.('Empleado añadido correctamente con PDF generado.');
      
    } catch (error) {
      console.error('Error sending PDF to backend:', error);
      onError?.('Error al enviar los datos del empleado.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Închide preview și eliberează memoria
  const closePreview = () => {
    setShowPreview(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Descarcă PDF-ul
  const downloadPDF = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = `ficha_empleado_${employeeData.CODIGO}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`;
      link.click();
    }
  };


  return (
    <>
      {/* Modal principal pentru generare PDF */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
        }}
        title="📄 Generar PDF del Empleado"
        size="lg"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📄</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generar PDF de Empleado
              </h3>
              <p className="text-sm text-gray-600">
                Se generará un PDF profesional con toda la información del empleado.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-700">
                <p><strong>Empleado:</strong> {employeeData?.['NOMBRE / APELLIDOS'] || 'N/A'}</p>
                <p><strong>Código:</strong> {employeeData?.CODIGO || 'N/A'}</p>
                <p><strong>Email:</strong> {employeeData?.['CORREO ELECTRONICO'] || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={generateAndPreviewPDF}
              loading={isGenerating}
              disabled={isGenerating || !employeeData}
              className="flex items-center justify-center gap-2"
            >
              <span>👁️</span>
              Previsualizar PDF
            </Button>
            
            <Button
              onClick={() => setShowModal(false)}
              variant="secondary"
              className="flex items-center justify-center gap-2"
            >
              <span>❌</span>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de preview PDF */}
      <Modal
        isOpen={showPreview}
        onClose={closePreview}
        title="📄 Previsualización del PDF"
        size="xl"
      >
        <div className="space-y-4">
          {previewUrl && (
            <div className="space-y-4">
              {/* PDF Viewer */}
              <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <iframe
                  src={previewUrl}
                  width="100%"
                  height="100%"
                  className="border-0"
                  title="PDF Preview"
                />
              </div>

              {/* Acțiuni */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="flex gap-3">
                  <Button
                    onClick={downloadPDF}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <span>💾</span>
                    Descargar PDF
                  </Button>
                  
                  <Button
                    onClick={closePreview}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <span>❌</span>
                    Cerrar Preview
                  </Button>
                </div>

                <Button
                  onClick={sendPDFToBackend}
                  loading={isGenerating}
                  disabled={isGenerating || !employeeData}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <span>✅</span>
                  Confirmar y Enviar
                </Button>
              </div>

              {/* Informații */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Información:</strong> Al confirmar, se enviarán tanto los datos del empleado
                  como el PDF generado al backend. El PDF incluye toda la información del formulario
                  con diseño profesional y branding de {config.COMPANY_NAME || config.APP_NAME || 'la empresa'}.
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default EmployeePDFGenerator;
