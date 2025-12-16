import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button, Card, LoadingSpinner } from '../components/ui';
import PDFViewerAndroid from '../components/PDFViewerAndroid';
import { routes } from '../utils/routes.js';
import { API_ENDPOINTS } from '../utils/constants';
import activityLogger from '../utils/activityLogger';
import Back3DButton from '../components/Back3DButton.jsx';

// Funcție pentru conversia Blob în Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function MisInspeccionesPage() {
  const { user: authUser } = useAuth();
  
  // State pentru inspecții
  const [inspections, setInspections] = useState([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [errorInspections, setErrorInspections] = useState(null);

  // State pentru preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Detectare mobile pentru PDF preview
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);

  // Demo data for MisInspeccionesPage
  const setDemoInspecciones = () => {
    const demoInspecciones = [
      {
        id: 'DEMO_INSP_001',
        id_inspeccion: 'INS-2024-001',
        tipo_inspeccion: 'Limpieza General',
        fecha: '2024-12-01T10:30:00Z',
        fecha_subida: '2024-12-01T10:30:00Z',
        inspector_nombre: 'María González López',
        Nombre_Supervisor: 'María González López',
        nombre_empleado: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro - Planta Baja',
        lugar: 'Madrid Centro',
        sitio: 'Planta Baja',
        direccion: 'Calle Gran Vía, 123, Madrid',
        Locacion: 'Madrid Centro',
        centro: 'Madrid Centro',
        Centro: 'Madrid Centro',
        estado: 'Completada',
        resultado: 'Aprobada',
        observaciones: 'Limpieza correcta en todas las áreas. Todos los puntos verificados.',
        puntuacion: 95,
        items_verificados: 15,
        items_aprobados: 15
      },
      {
        id: 'DEMO_INSP_002',
        id_inspeccion: 'INS-2024-002',
        tipo_inspeccion: 'Seguridad',
        fecha: '2024-11-28T14:15:00Z',
        fecha_subida: '2024-11-28T14:15:00Z',
        inspector_nombre: 'Juan Pérez Martín',
        Nombre_Supervisor: 'Juan Pérez Martín',
        nombre_empleado: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro - Planta Primera',
        lugar: 'Madrid Centro',
        sitio: 'Planta Primera',
        direccion: 'Calle Gran Vía, 123, Madrid',
        Locacion: 'Madrid Centro',
        centro: 'Madrid Centro',
        Centro: 'Madrid Centro',
        estado: 'Completada',
        resultado: 'Aprobada con observaciones',
        observaciones: 'Se requiere revisión del sistema de alarmas en el área A.',
        puntuacion: 85,
        items_verificados: 12,
        items_aprobados: 11
      },
      {
        id: 'DEMO_INSP_003',
        id_inspeccion: 'INS-2024-003',
        tipo_inspeccion: 'Mantenimiento',
        fecha: '2024-11-25T09:00:00Z',
        fecha_subida: '2024-11-25T09:00:00Z',
        inspector_nombre: 'Ana Sánchez Ruiz',
        Nombre_Supervisor: 'Ana Sánchez Ruiz',
        nombre_empleado: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro - Sala de Servidores',
        lugar: 'Madrid Centro',
        sitio: 'Sala de Servidores',
        direccion: 'Calle Gran Vía, 123, Madrid',
        Locacion: 'Madrid Centro',
        centro: 'Madrid Centro',
        Centro: 'Madrid Centro',
        estado: 'Completada',
        resultado: 'Aprobada',
        observaciones: 'Todos los equipos funcionando correctamente. Mantenimiento preventivo realizado.',
        puntuacion: 98,
        items_verificados: 8,
        items_aprobados: 8
      },
      {
        id: 'DEMO_INSP_004',
        id_inspeccion: 'INS-2024-004',
        tipo_inspeccion: 'Calidad',
        fecha: '2024-11-22T16:45:00Z',
        fecha_subida: '2024-11-22T16:45:00Z',
        inspector_nombre: 'Pedro Martínez García',
        Nombre_Supervisor: 'Pedro Martínez García',
        nombre_empleado: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro - Oficinas',
        lugar: 'Madrid Centro',
        sitio: 'Oficinas',
        direccion: 'Calle Gran Vía, 123, Madrid',
        Locacion: 'Madrid Centro',
        centro: 'Madrid Centro',
        Centro: 'Madrid Centro',
        estado: 'Completada',
        resultado: 'Aprobada',
        observaciones: 'Calidad de servicio excelente. Cumplimiento de todos los estándares.',
        puntuacion: 92,
        items_verificados: 20,
        items_aprobados: 20
      },
      {
        id: 'DEMO_INSP_005',
        id_inspeccion: 'INS-2024-005',
        tipo_inspeccion: 'Limpieza Especializada',
        fecha: '2024-11-20T11:30:00Z',
        fecha_subida: '2024-11-20T11:30:00Z',
        inspector_nombre: 'Laura Fernández Torres',
        Nombre_Supervisor: 'Laura Fernández Torres',
        nombre_empleado: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro - Cocina',
        lugar: 'Madrid Centro',
        sitio: 'Cocina',
        direccion: 'Calle Gran Vía, 123, Madrid',
        Locacion: 'Madrid Centro',
        centro: 'Madrid Centro',
        Centro: 'Madrid Centro',
        estado: 'Completada',
        resultado: 'Aprobada',
        observaciones: 'Limpieza especializada completada. Áreas críticas verificadas.',
        puntuacion: 96,
        items_verificados: 18,
        items_aprobados: 18
      }
    ];

    setInspections(demoInspecciones);
  };

  const fetchInspections = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchInspections in MisInspeccionesPage');
      return;
    }

    console.log('🔍 Fetching inspections...');
    setLoadingInspections(true);
    setErrorInspections(null);
    
    // Timeout de siguranță pentru a evita blocarea infinită
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout de seguridad - forzando fin de loading');
      setLoadingInspections(false);
      setErrorInspections('Timeout: La carga de inspecciones tomó demasiado tiempo');
    }, 10000); // 10 secunde
    
    try {
      // Folosește endpoint-ul specific pentru "Mis Inspecciones" (usuario actual)
      const productionEndpoint = routes.getMisInspecciones;
      const codigoEmpleado = authUser?.CODIGO;
      
      console.log('📡 Calling production endpoint via proxy:', productionEndpoint);
      console.log('👤 Codigo empleado:', codigoEmpleado);
      
      const response = await fetch(`${productionEndpoint}?codigo_empleado=${codigoEmpleado}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📡 Raw inspections data:', data);
        
          // Verifică dacă datele sunt valide inspecții sau doar un mesaj de succes
          const isValidInspection = (item) => {
            console.log('🔍 Validando item:', item);
            
            // Verifică dacă obiectul conține câmpuri reale de inspecție
            const hasValidFields = item && (
              item.id || item.id_inspeccion ||
              item.type || item.tipo_inspeccion ||
              item.date || item.fecha || item.fecha_subida ||
              item.inspector || item.inspector_nombre || item['Nombre Supervisor'] ||
              item.trabajador || item.nombre_empleado ||
              item.location || item.ubicacion || item.lugar || item.sitio || item.direccion || item.Locacion ||
              item.centro || item.Centro
            );
            
            console.log('🔍 Item válido?', hasValidFields);
            return hasValidFields;
          };
          
          // Filtrează doar inspecțiile valide
          const validInspections = Array.isArray(data) ? data.filter(isValidInspection) : [];
          
          console.log('🔍 Inspecciones válidas encontradas:', validInspections.length);
          console.log('🔍 Data original:', data);
          console.log('🔍 Data filtrada:', validInspections);
          
          if (validInspections.length === 0) {
            console.log('ℹ️ No se encontraron inspecciones válidas');
            setInspections([]);
            setLoadingInspections(false);
            return;
          }
        
        // Funcție pentru formatarea datei
        const formatDate = (dateString) => {
          if (!dateString || dateString === 'N/A') return 'N/A';
          try {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-ES', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
          } catch (error) {
            return 'N/A';
          }
        };

          // Procesează doar inspecțiile valide
          const processedInspections = validInspections.map(inspection => ({
          id: inspection.id || inspection.id_inspeccion,
          type: inspection.type || inspection.tipo_inspeccion,
          date: formatDate(inspection.date || inspection.fecha || inspection.fecha_subida),
          originalDate: inspection.date || inspection.fecha || inspection.fecha_subida, // Păstrează data originală pentru filtrare
            inspector: inspection.inspector || inspection.inspector_nombre || inspection['Nombre Supervisor'] || null,
            trabajador: inspection.trabajador || inspection.nombre_empleado || null,
            employeeCode: inspection.employeeCode || inspection.codigo_empleado || null,
            location: inspection.location || inspection.ubicacion || inspection.lugar || inspection.sitio || inspection.direccion || inspection.Locacion || null,
            centro: inspection.centro || inspection.Centro || null,
          status: inspection.status || inspection.estado || inspection.estado_inspeccion || 'completada',
            pdfUrl: inspection.pdfUrl || inspection.archivo?.url || inspection.archivo || inspection.url_pdf || null
        }));
        
        setInspections(processedInspections);
        console.log('✅ Inspecciones procesadas:', processedInspections);
      } else {
        console.error('❌ Response not ok:', response.status, response.statusText);
        setErrorInspections('No se pudieron cargar las inspecciones.');
      }
    } catch (error) {
      console.error('❌ Error fetching inspections:', error);
      setErrorInspections('Error al cargar las inspecciones.');
    } finally {
      // Cleanup timeout și setare loading false
      clearTimeout(timeoutId);
      setLoadingInspections(false);
    }
  }, [authUser?.isDemo, authUser?.CODIGO]);

  useEffect(() => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo inspecciones data instead of fetching from backend');
      setDemoInspecciones();
      setLoadingInspections(false);
      return;
    }

    fetchInspections();
    activityLogger.logPageAccess('mis-inspecciones', authUser);
  }, [authUser, authUser?.isDemo, fetchInspections]);

  const handlePreview = async (inspection) => {
    setShowPreviewModal(true);
    setPreviewData(inspection);
    setPreviewLoading(true);
    
    try {
      // Folosește același endpoint ca la download
      const response = await fetch(`${API_ENDPOINTS.DOWNLOAD_INSPECTION_DOCUMENT}?id=${inspection.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf, application/json',
        }
      });

      if (response.ok) {
        // Verifică dacă răspunsul este PDF direct
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/pdf')) {
          // Pentru PDF direct, creează un blob URL pentru preview
          const blob = await response.blob();
          // Pentru mobile (iOS/Android), folosim base64 direct
          const url = (isIOS || isAndroid) 
            ? `data:application/pdf;base64,${await blobToBase64(blob)}`
            : window.URL.createObjectURL(blob);
          setPreviewData({ ...inspection, pdfUrl: url });
        } else {
          // Încearcă să proceseze JSON pentru a obține URL-ul PDF
          try {
            const data = await response.json();
            
            if (data.success && data.pdfUrl) {
              setPreviewData({ ...inspection, pdfUrl: data.pdfUrl });
            } else {
              setPreviewData({ ...inspection, error: 'PDF-ul nu este disponibil pentru preview' });
            }
          } catch (jsonError) {
            // Fallback: încearcă să creeze un blob URL
            const blob = await response.blob();
            if (blob.size > 0) {
              // Pentru mobile (iOS/Android), folosim base64 direct
              const url = (isIOS || isAndroid) 
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : window.URL.createObjectURL(blob);
              setPreviewData({ ...inspection, pdfUrl: url });
            } else {
              setPreviewData({ ...inspection, error: 'Nu s-a putut încărca PDF-ul pentru preview' });
            }
          }
        }
      } else {
        setPreviewData({ ...inspection, error: 'Error al cargar el PDF para preview' });
      }
    } catch (error) {
      console.error('❌ Error previewing PDF:', error);
      setPreviewData({ ...inspection, error: 'Error al preview del PDF' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (inspection) => {
    try {
      // Request către webhook-ul n8n pentru descărcare document
      const response = await fetch(`${API_ENDPOINTS.DOWNLOAD_INSPECTION_DOCUMENT}?id=${inspection.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf, application/json',
        }
      });

      if (response.ok) {
        // Verifică dacă răspunsul este PDF direct
        const contentType = response.headers.get('content-type');
        
        // Dacă este PDF direct, descarcă imediat
        if (contentType && contentType.includes('application/pdf')) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${inspection.id}.pdf`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          return;
        }
        
        // Încearcă să descarce direct ca PDF chiar dacă primește JSON
        const blob = await response.blob();
        
        if (blob.size > 0) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${inspection.id}.pdf`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          return;
        }
        
        // Dacă nu s-a descărcat, încearcă JSON
        try {
          const data = await response.json();
          
          // Verifică dacă răspunsul este array gol sau obiect gol
          if (Array.isArray(data) && data.length === 0) {
            alert('Nu s-a găsit PDF-ul pentru această inspecție');
            return;
          }
          
          if (Array.isArray(data) && data.length > 0 && Object.keys(data[0]).length === 0) {
            alert('PDF-ul nu este disponibil pentru această inspecție');
            return;
          }
          
          if (data.success && data.pdfUrl && typeof data.pdfUrl === 'string') {
            // Descarcă PDF-ul din URL-ul primit
            const pdfResponse = await fetch(data.pdfUrl);
            if (pdfResponse.ok) {
              const blob = await pdfResponse.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${inspection.id}.pdf`;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } else {
              alert('Eroare la descărcarea PDF-ului din URL');
            }
          } else {
            alert('PDF-ul nu este disponibil pentru această inspecție');
          }
        } catch (jsonError) {
          // Încearcă să descarce direct ca PDF (fallback)
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${inspection.id}.pdf`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        alert('Eroare la descărcarea PDF-ului');
      }
    } catch (error) {
      console.error('❌ Error downloading PDF:', error);
      alert('Eroare la descărcarea PDF-ului');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header modernizado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar al Dashboard" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Mis Inspecciones
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              Revisa y gestiona tus inspecciones realizadas
            </p>
          </div>
        </div>
        
        {/* Butoane header - refresh și reportar error */}
        <div className="flex gap-3">
          {/* Buton Reportar error */}
          <button
            onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de inspecciones', '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            title="Reportar error"
          >
            <span className="text-lg">📱</span>
            <span>Reportar error</span>
          </button>

          {/* Buton refresh */}
          <button
            onClick={fetchInspections}
            disabled={loadingInspections}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg ${
              loadingInspections 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            title="Actualizar lista de inspecciones"
          >
            {loadingInspections ? (
              <div className="w-4 h-4 border-2 border-gray-200 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="text-lg">🔄</span>
            )}
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Conținut principal */}
      <Card>
        {loadingInspections ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" text="Cargando inspecciones..." />
          </div>
        ) : errorInspections ? (
          <div className="text-center py-8">
            <div className="text-red-600 text-6xl mb-4">❌</div>
            <p className="text-red-600 font-bold text-lg mb-4">{errorInspections}</p>
            <Button
              onClick={fetchInspections}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              🔄 Reintentar
            </Button>
          </div>
        ) : (
          <>
            {/* Statistici ULTRA COMPACT pe mobil - Glassmorphism */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 mb-6">
              {/* Card 1 - Total Inspecciones */}
              <div className="relative group">
                <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-xl lg:rounded-2xl border border-white/30 shadow-lg lg:shadow-xl group-hover:shadow-2xl transition-all duration-300"></div>
                
                <div className="relative p-3 lg:p-6">
                  <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:gap-0">
                    <div className="w-8 h-8 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 lg:mb-3">
                      <span className="text-white text-base lg:text-2xl">🔍</span>
                    </div>
                    <div className="flex-1 lg:w-full">
                      <div className="text-xl lg:text-3xl font-bold text-gray-800">{inspections.length}</div>
                      <div className="text-xs lg:text-sm text-gray-600 truncate">Total</div>
                  </div>
                </div>
                  <div className="hidden lg:block mt-3 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>

                <div className="absolute inset-0 rounded-xl lg:rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                  </div>

              {/* Card 2 - Última Semana */}
              <div className="relative group">
                <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-xl lg:rounded-2xl border border-white/30 shadow-lg lg:shadow-xl group-hover:shadow-2xl transition-all duration-300"></div>
                
                <div className="relative p-3 lg:p-6">
                  <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:gap-0">
                    <div className="w-8 h-8 lg:w-14 lg:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 lg:mb-3">
                      <span className="text-white text-base lg:text-2xl">📅</span>
                    </div>
                    <div className="flex-1 lg:w-full">
                      <div className="text-xl lg:text-3xl font-bold text-gray-800">
                      {inspections.filter(inspection => {
                        const inspectionDate = new Date(inspection.originalDate);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        weekAgo.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        return inspectionDate >= weekAgo && inspectionDate <= today && !isNaN(inspectionDate.getTime());
                      }).length}
                      </div>
                      <div className="text-xs lg:text-sm text-gray-600 truncate">Semana</div>
                  </div>
                </div>
                  <div className="hidden lg:block mt-3 h-1 bg-gradient-to-r from-green-400 to-green-600 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>

                <div className="absolute inset-0 rounded-xl lg:rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                  </div>

              {/* Card 3 - Último Mes */}
              <div className="relative group">
                <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-xl lg:rounded-2xl border border-white/30 shadow-lg lg:shadow-xl group-hover:shadow-2xl transition-all duration-300"></div>
                
                <div className="relative p-3 lg:p-6">
                  <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:gap-0">
                    <div className="w-8 h-8 lg:w-14 lg:h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 lg:mb-3">
                      <span className="text-white text-base lg:text-2xl">📊</span>
                    </div>
                    <div className="flex-1 lg:w-full">
                      <div className="text-xl lg:text-3xl font-bold text-gray-800">
                      {inspections.filter(inspection => {
                        const inspectionDate = new Date(inspection.originalDate);
                        const monthAgo = new Date();
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        monthAgo.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        return inspectionDate >= monthAgo && inspectionDate <= today && !isNaN(inspectionDate.getTime());
                      }).length}
                      </div>
                      <div className="text-xs lg:text-sm text-gray-600 truncate">Mes</div>
                  </div>
                </div>
                  <div className="hidden lg:block mt-3 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                
                <div className="absolute inset-0 rounded-xl lg:rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                </div>
              </div>
            </div>

            {/* Lista modernizada de inspecții */}
            <div className="card">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-2xl">🔍</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Lista de Inspecciones</h3>
                  <p className="text-gray-600 text-sm">Total: {inspections.length} inspecciones registradas</p>
                </div>
              </div>
              
              {inspections.length === 0 ? (
                 <div className="text-center py-12">
                   <div className="text-gray-300 text-8xl mb-6">🔍</div>
                   <h3 className="text-2xl font-bold text-gray-600 mb-3">No se encontraron inspecciones</h3>
                   <p className="text-gray-500 text-lg mb-2">No hay inspecciones disponibles para tu usuario</p>
                   <p className="text-gray-400 text-sm">Las inspecciones aparecerán aquí cuando estén disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inspections.map((inspection, index) => (
                    <div key={index} className="group relative bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-200 hover:border-blue-300 overflow-hidden">
                      {/* Header card */}
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                            <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">
                              {inspection.type === 'limpieza' ? '🧹' : '🔧'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900 group-hover:text-blue-800 transition-colors duration-300">
                              {inspection.id}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                ✅ {inspection.status}
                              </span>
                              {inspection.employeeCode && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium border border-blue-200">
                                  👤 {inspection.employeeCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-3 sm:p-4">
                        <div className="space-y-3 mb-4">
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">🏷️ Tipo de Inspección:</label>
                            <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                              {inspection.type === 'limpieza' ? '🧹 Limpieza' : '🔧 Servicios Auxiliares'}
                            </p>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">📅 Fecha de Inspección:</label>
                            <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                              {inspection.date}
                            </p>
                          </div>
                          
                          {inspection.inspector && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">👷‍♂️ Inspector:</label>
                              <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                                {inspection.inspector}
                              </p>
                            </div>
                          )}
                          
                          {inspection.trabajador && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">👤 Trabajador:</label>
                              <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                                {inspection.trabajador}
                              </p>
                            </div>
                          )}
                          
                          {inspection.location && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">📍 Ubicación:</label>
                              <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                                {inspection.location}
                              </p>
                            </div>
                          )}
                          
                          {inspection.centro && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">🏢 Centro:</label>
                              <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                                {inspection.centro}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Actions - Responsive pentru mobil */}
                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                          <button
                            onClick={() => handlePreview(inspection)}
                            className="flex-1 group relative px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                          >
                            <div className="absolute inset-0 rounded-lg bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                            <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                              <span className="text-sm">👁️</span>
                              <span className="text-xs sm:text-sm">Preview</span>
                            </div>
                          </button>
                          
                          <button
                            onClick={() => handleDownload(inspection)}
                            className="flex-1 group relative px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                          >
                            <div className="absolute inset-0 rounded-lg bg-red-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                            <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                              <span className="text-sm">📥</span>
                              <span className="text-xs sm:text-sm">Descargar</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      
      {/* Modal de Preview pentru PDF */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] h-[95vh] flex flex-col border-4 border-red-100">
            {/* Header modal */}
            <div className="flex items-center justify-between p-6 border-b-2 border-red-200 bg-gradient-to-r from-red-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">🔍</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Preview Inspección
                  </h3>
                  <p className="text-sm text-red-600 font-medium">
                    {previewData?.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                  // Cleanup blob URL dacă există
                  if (previewData?.pdfUrl && previewData.pdfUrl.startsWith('blob:')) {
                    window.URL.revokeObjectURL(previewData.pdfUrl);
                  }
                }}
                className="w-10 h-10 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 hover:scale-110"
              >
                ×
              </button>
            </div>
            
            {/* Conținut modal */}
            <div className="flex-1 p-6 overflow-hidden bg-gray-50">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-200 border-t-red-600 mx-auto mb-6"></div>
                    <p className="text-red-600 font-semibold text-lg">Cargando PDF...</p>
                    <p className="text-gray-500 text-sm mt-2">Preparando la vista previa</p>
                  </div>
                </div>
              ) : previewData?.error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="text-red-600 text-4xl">❌</span>
                    </div>
                    <p className="text-red-600 font-semibold text-lg mb-2">Error de Vista Previa</p>
                    <p className="text-gray-600 text-sm max-w-md">{previewData.error}</p>
                  </div>
                </div>
                             ) : previewData?.pdfUrl ? (
                 <div className="h-full bg-white rounded-xl shadow-lg p-2">
                   {(isAndroid || isIOS) ? (
                     <PDFViewerAndroid 
                       pdfUrl={previewData.pdfUrl}
                       className="w-full h-full"
                     />
                   ) : (
                     <iframe
                       src={previewData.pdfUrl}
                       className="w-full h-full border-0 rounded-lg"
                       title={`Preview ${previewData.id}`}
                     />
                   )}
                 </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="text-gray-500 text-4xl">📄</span>
                    </div>
                    <p className="text-gray-600 font-semibold text-lg mb-2">PDF no disponible</p>
                    <p className="text-gray-500 text-sm">No se puede mostrar la vista previa</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer modal cu butoane */}
            <div className="flex justify-between items-center p-6 border-t-2 border-red-200 bg-gradient-to-r from-white to-red-50">
              <div className="text-sm text-gray-500">
                <span className="font-medium">Inspección:</span> {previewData?.id}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewData(null);
                    // Cleanup blob URL dacă există
                    if (previewData?.pdfUrl && previewData.pdfUrl.startsWith('blob:')) {
                      window.URL.revokeObjectURL(previewData.pdfUrl);
                    }
                  }}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                >
                  ✕ Cerrar
                </Button>
                {previewData?.pdfUrl && !previewData.error && (
                  <Button
                    onClick={() => handleDownload(previewData)}
                    className="bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    📥 Descargar PDF
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 