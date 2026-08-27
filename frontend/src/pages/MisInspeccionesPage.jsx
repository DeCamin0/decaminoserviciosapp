import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button, LoadingSpinner, PageHeader, AlertBanner } from '../components/ui';
import { routes } from '../utils/routes.js';
import { API_ENDPOINTS } from '../utils/constants';
import activityLogger from '../utils/activityLogger';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import MisInspeccionesList from '../components/inspections/MisInspeccionesList';
import InspectionPdfPreviewModal from '../components/inspections/InspectionPdfPreviewModal';
import { MessageCircle, RefreshCw } from 'lucide-react';

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

  // Cleanup pentru blob URL-uri când se schimbă previewData sau se închide modalul
  useEffect(() => {
    return () => {
      // Revocă blob URL-urile când componenta se unmount sau când previewData se schimbă
      if (previewData?.pdfUrl && typeof previewData.pdfUrl === 'string' && previewData.pdfUrl.startsWith('blob:')) {
        window.URL.revokeObjectURL(previewData.pdfUrl);
        console.log('🧹 Blob URL revocat pentru cleanup');
      }
    };
  }, [previewData]);

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
      
      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${productionEndpoint}?codigo_empleado=${codigoEmpleado}`, {
        method: 'GET',
        headers: fetchHeaders,
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
          } catch {
            return 'N/A';
          }
        };

          // Procesează doar inspecțiile valide
          const processedInspections = validInspections.map(inspection => ({
          id: inspection.id || inspection.id_inspeccion,
          type: inspection.type || inspection.tipo_inspeccion,
          date: formatDate(inspection.date || inspection.fecha || inspection.fecha_subida),
          originalDate: inspection.date || inspection.fecha || inspection.fecha_subida, // Păstrează data originală pentru filtrare
            inspector: inspection.inspector || inspection.inspector_nombre || inspection.Nombre_Supervisor || inspection['Nombre Supervisor'] || null,
            trabajador: inspection.trabajador || inspection.nombre_empleado || null,
            employeeCode: inspection.employeeCode || inspection.codigo_empleado || null,
            location: inspection.location || inspection.ubicacion || inspection.lugar || inspection.sitio || inspection.direccion || inspection.Locacion || null,
            centro: inspection.centro || inspection.Centro || null,
          status: inspection.status || inspection.estado || inspection.estado_inspeccion || 'completada',
            pdfUrl: (() => {
              const url = inspection.pdfUrl || inspection.archivo?.url || inspection.archivo || inspection.url_pdf;
              // Asigură-te că pdfUrl este întotdeauna string sau null
              return typeof url === 'string' ? url : (url ? String(url) : null);
            })(),
            scor_total: inspection.scor_total || null
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
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
          'Accept': 'application/pdf, application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
        }
      const response = await fetch(`${API_ENDPOINTS.DOWNLOAD_INSPECTION_DOCUMENT}?id=${inspection.id}`, {
        method: 'GET',
        headers: fetchHeaders,
      });

      if (response.ok) {
        // Verifică dacă răspunsul este PDF direct
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/pdf')) {
          // Pentru PDF direct, creează un blob URL pentru preview
          const blob = await response.blob();
          
          if (blob.size === 0) {
            setPreviewData({ ...inspection, error: 'PDF-ul este gol (0 bytes)' });
            setPreviewLoading(false);
            return;
          }
          
          // Pentru iOS, folosim base64 (mai stabil pentru PDF-uri pe mobil)
          // Pentru Android, folosim blob URL
          // Pentru desktop, folosim blob URL
          const url = isIOS 
            ? `data:application/pdf;base64,${await blobToBase64(blob)}`
            : (isAndroid 
              ? window.URL.createObjectURL(blob)
              : window.URL.createObjectURL(blob));
          console.log('✅ URL creado para inspección PDF:', isIOS ? 'base64' : 'blob');
          setPreviewData({ ...inspection, pdfUrl: url });
        } else {
          // Încearcă să proceseze JSON pentru a obține URL-ul PDF
          try {
            const data = await response.json();
            
            if (data.success && data.pdfUrl) {
              // Asigură-te că pdfUrl este string
              const pdfUrl = typeof data.pdfUrl === 'string' ? data.pdfUrl : String(data.pdfUrl);
              setPreviewData({ ...inspection, pdfUrl });
            } else {
              setPreviewData({ ...inspection, error: 'El PDF no está disponible para la vista previa' });
            }
          } catch {
            // Fallback: încearcă să creeze un blob URL
            const blob = await response.blob();
            if (blob.size > 0) {
              // Pentru iOS, folosim base64 (mai stabil pentru PDF-uri pe mobil)
              // Pentru Android, folosim blob URL
              const url = isIOS 
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : window.URL.createObjectURL(blob);
              console.log('✅ Fallback URL creado para inspección PDF:', isIOS ? 'base64' : 'blob');
              setPreviewData({ ...inspection, pdfUrl: url });
            } else {
              setPreviewData({ ...inspection, error: 'No se pudo cargar el PDF para la vista previa (blob vacío)' });
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
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
          'Accept': 'application/pdf, application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
        }
      const response = await fetch(`${API_ENDPOINTS.DOWNLOAD_INSPECTION_DOCUMENT}?id=${inspection.id}`, {
        method: 'GET',
        headers: fetchHeaders,
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
            alert('No se encontró el PDF para esta inspección');
            return;
          }
          
          if (Array.isArray(data) && data.length > 0 && Object.keys(data[0]).length === 0) {
            alert('El PDF no está disponible para esta inspección');
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
              alert('Error al descargar el PDF desde la URL');
            }
          } else {
            alert('El PDF no está disponible para esta inspección');
          }
        } catch {
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
        alert('Error al descargar el PDF');
      }
    } catch (error) {
      console.error('❌ Error downloading PDF:', error);
      alert('Error al descargar el PDF');
    }
  };

  const weekCount = inspections.filter((inspection) => {
    const d = new Date(inspection.originalDate);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && !Number.isNaN(d.getTime());
  }).length;
  const monthCount = inspections.filter((inspection) => {
    const d = new Date(inspection.originalDate);
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    return d >= monthAgo && !Number.isNaN(d.getTime());
  }).length;
  const closePreviewModal = () => {
    if (previewData?.pdfUrl?.startsWith?.('blob:')) window.URL.revokeObjectURL(previewData.pdfUrl);
    setShowPreviewModal(false); setPreviewData(null);
  };

  return (
    <div className="mis-inspecciones-page app-page space-y-4">
      <PageHeader title="Mis Inspecciones" subtitle="Revisa y descarga tus inspecciones" backTo="/inicio"
        actions={(<><Button type="button" variant="secondary" size="sm" onClick={() => openWhatsAppErrorReport(buildErrorReportMessage({ authUser, pageName: 'Mis Inspecciones', pageData: {} }))}><MessageCircle className="w-4 h-4" /></Button><Button type="button" variant="secondary" size="sm" onClick={fetchInspections} disabled={loadingInspections}><RefreshCw className={`w-4 h-4${loadingInspections ? ' animate-spin' : ''}`} /></Button></>)} />
      {!loadingInspections && !errorInspections ? (
        <div className="solicitud-admin-stat-grid">
          <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Total</p><p className="solicitud-admin-stat__value">{inspections.length}</p></div>
          <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Semana</p><p className="solicitud-admin-stat__value">{weekCount}</p></div>
          <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Mes</p><p className="solicitud-admin-stat__value">{monthCount}</p></div>
        </div>
      ) : null}
      {loadingInspections ? <div className="app-card app-card--pad flex justify-center py-10"><LoadingSpinner size="lg" text="Cargando..." /></div>
      : errorInspections ? <AlertBanner variant="danger" title="Error">{errorInspections}<div className="mt-2"><Button size="sm" onClick={fetchInspections}>Reintentar</Button></div></AlertBanner>
      : <MisInspeccionesList items={inspections} onPreview={handlePreview} onDownload={handleDownload} />}
      <InspectionPdfPreviewModal isOpen={showPreviewModal} previewData={previewData} previewLoading={previewLoading} isIOS={isIOS} isAndroid={isAndroid} onClose={closePreviewModal} onDownload={handleDownload} />
    </div>
  );
}