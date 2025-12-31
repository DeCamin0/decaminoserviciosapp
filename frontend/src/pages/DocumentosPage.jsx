import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import Back3DButton from '../components/Back3DButton.jsx';
import { Button, LoadingSpinner, Notification } from '../components/ui';
import ContractSigner from '../components/ContractSigner';
import PDFViewerAndroid from '../components/PDFViewerAndroid';
import { routes } from '../utils/routes.js';
import activityLogger from '../utils/activityLogger';

// Funcție pentru conversia Blob în Base64 (exact ca la MisInspeccionesPage)
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

// Funcție pentru formatarea datelor în format frumos și consistent
const formatDate = (dateString) => {
  if (!dateString) return 'Sin fecha';
  
  try {
    // Încearcă să parsezi data în diferite formate
    let date;
    
    // Verifică dacă este deja un obiect Date
    if (dateString instanceof Date) {
      date = dateString;
    } else if (typeof dateString === 'string') {
      // Verifică dacă este un timestamp ISO
      if (dateString.includes('T') && dateString.includes('Z')) {
        date = new Date(dateString);
      } else if (dateString.includes('-') && dateString.includes(':')) {
        // Format: "2025-07-31 15:12:49"
        date = new Date(dateString.replace(' ', 'T'));
      } else {
        // Încearcă să parsezi ca Date normal
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }
    
    // Verifică dacă data este validă
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    // Formatează data în format românesc: dd/MM/yyyy HH:mm
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Fecha inválida';
  }
};

export default function DocumentosPage() {
  const { user: authUser } = useAuth();

  // Detectare platformă pentru PDF preview
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);
  
  const [nominas, setNominas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('nominas'); // 'nominas', 'mis-documentos' o 'upload-documentos'
  const [documentType, setDocumentType] = useState(''); // Estado para el tipo de documento seleccionado
  const [customDocumentType, setCustomDocumentType] = useState(''); // Estado para el tipo de documento personalizado
  const fileInputRefs = useRef({});
  const customFileInputRef = useRef(null);
  const customCameraInputRef = useRef(null);
  
  // Estado para preview
  const [previewDocument, setPreviewDocument] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  
  const [autoFirmaUrl, setAutoFirmaUrl] = useState(null); // URL para click manual

  // Estado para notificaciones
  const [notification, setNotification] = useState(null);

  // Estado para el modal de tipo personalizado
  const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);
  const [showCustomTypeSourceModal, setShowCustomTypeSourceModal] = useState(false);

  // Estado para documentos oficiales
  const [documentosOficiales, setDocumentosOficiales] = useState([]);
  const [documentosOficialesLoading, setDocumentosOficialesLoading] = useState(false);
  const [documentosOficialesError, setDocumentosOficialesError] = useState(null);

  // Estado para loading de documentos personales
  const [documentosLoading, setDocumentosLoading] = useState(false);

  // Estado para loading de nóminas
  const [nominasLoading, setNominasLoading] = useState(false);

  const email = authUser?.['CORREO ELECTRONICO'] || authUser?.email;

  // Demo documentos data
  const setDemoDocumentos = () => {
    const demoNominas = [
      {
        id: 'DEMO_NOMINA_001',
        fileName: 'Nomina_Enero_2024.pdf',
        fileSize: 245760,
        uploadDate: '2024-01-31T10:00:00Z',
        status: 'disponible',
        tipo: 'Nómina',
        empleadoEmail: 'admin@demo.com',
        uploadedBy: 'Sistema',
        uploadedDate: '2024-01-31T10:00:00Z'
      },
      {
        id: 'DEMO_NOMINA_002',
        fileName: 'Nomina_Febrero_2024.pdf',
        fileSize: 251392,
        uploadDate: '2024-02-29T10:00:00Z',
        status: 'disponible',
        tipo: 'Nómina',
        empleadoEmail: 'admin@demo.com',
        uploadedBy: 'Sistema',
        uploadedDate: '2024-02-29T10:00:00Z'
      }
    ];

    const demoDocumentos = [
      {
        id: 'DEMO_DOC_001',
        fileName: 'Contrato_Indefinido.pdf',
        fileSize: 156789,
        uploadDate: '2023-01-15T09:30:00Z',
        status: 'firmado',
        tipo: 'Contrato',
        empleadoEmail: 'admin@demo.com',
        uploadedBy: 'RRHH',
        uploadedDate: '2023-01-15T09:30:00Z'
      },
      {
        id: 'DEMO_DOC_002',
        fileName: 'Certificado_Medico.pdf',
        fileSize: 98765,
        uploadDate: '2024-06-15T14:20:00Z',
        status: 'pendiente',
        tipo: 'Certificado Médico',
        empleadoEmail: 'admin@demo.com',
        uploadedBy: 'Admin Demo',
        uploadedDate: '2024-06-15T14:20:00Z'
      }
    ];

    const demoDocumentosOficiales = [
      {
        id: 'DEMO_OFICIAL_001',
        fileName: 'Alta_SS.pdf',
        fileSize: 123456,
        uploadDate: '2023-01-15T08:00:00Z',
        status: 'disponible',
        tipo: 'Alta Seguridad Social',
        empleadoEmail: 'admin@demo.com',
        uploadedBy: 'Administración',
        uploadedDate: '2023-01-15T08:00:00Z'
      }
    ];

    setNominas(demoNominas);
    setDocumentos(demoDocumentos);
    setDocumentosOficiales(demoDocumentosOficiales);
  };

  // Función para obtener nóminas usando la misma lógica robusta que DocumentosEmpleadosPage
  const fetchNominas = useCallback(async () => {
    if (!email) {
      setError('¡Email faltante!');
      setNominasLoading(false);
      return;
    }

    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchNominas');
      setNominasLoading(false);
      return;
    }

    setNominasLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Obteniendo nóminas para:', authUser?.['NOMBRE / APELLIDOS'], 'ID:', authUser?.CODIGO);
      
      // Usar la misma lógica robusta que DocumentosEmpleadosPage
      const queryParams = new URLSearchParams({
        nombre: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre',
        codigo: authUser?.CODIGO || authUser?.id || 'N/A'
      });

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${routes.getNominas}?${queryParams}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Respuesta nóminas:', data);
      
      // Log detallado de la primera nómina para debugging
      if (Array.isArray(data) && data.length > 0) {
        console.log('🔍 Primera nómina del array:', data[0]);
        console.log('🔍 Campos disponibles:', Object.keys(data[0]));
        console.log('🔍 Valor de mes:', data[0].mes);
        console.log('🔍 Valor de periodo:', data[0].periodo);
        console.log('🔍 Valor de año:', data[0].año);
        console.log('🔍 Valor de an:', data[0].an);
        console.log('🔍 Valor de year:', data[0].year);
        console.log('🔍 Valor de luna:', data[0].luna);
        console.log('🔍 Valor de month:', data[0].month);
        console.log('🔍 Valor de fecha:', data[0].fecha);
        console.log('🔍 Valor de uploadDate:', data[0].uploadDate);
        console.log('🔍 Valor de created_at:', data[0].created_at);
      } else if (data.success && data.nominas && data.nominas.length > 0) {
        console.log('🔍 Primera nómina de success.nominas:', data.nominas[0]);
        console.log('🔍 Campos disponibles:', Object.keys(data.nominas[0]));
        console.log('🔍 Valor de mes:', data.nominas[0].mes);
        console.log('🔍 Valor de periodo:', data.nominas[0].periodo);
        console.log('🔍 Valor de año:', data.nominas[0].año);
        console.log('🔍 Valor de an:', data.nominas[0].an);
        console.log('🔍 Valor de year:', data.nominas[0].year);
        console.log('🔍 Valor de luna:', data.nominas[0].luna);
        console.log('🔍 Valor de month:', data.nominas[0].month);
        console.log('🔍 Valor de fecha:', data.nominas[0].fecha);
        console.log('🔍 Valor de uploadDate:', data.nominas[0].uploadDate);
        console.log('🔍 Valor de created_at:', data.nominas[0].created_at);
      }

      // Verificar si las nóminas son válidas o solo mensajes de éxito
      const isValidNomina = (item) => {
        console.log('🔍 Validando nómina:', item);
        
        // Verificar si el objeto contiene campos reales de nómina
        const hasValidFields = item && (
          item.id || item.nomina_id || item.documento_id ||
          item.mes || item.periodo || item.año || item.ano || item.an || item.year ||
          item.fecha_subida || item.uploadDate || item.created_at || item.fecha ||
          item.salario || item.importe || item.cantidad
        );
        
        console.log('🔍 Nómina válida?', hasValidFields);
        return hasValidFields;
      };
      
      // Filtrar solo las nóminas válidas
      let nominasValidas = [];
      
      if (Array.isArray(data)) {
        nominasValidas = data.filter(isValidNomina);
      } else if (data.success && data.nominas) {
        nominasValidas = data.nominas.filter(isValidNomina);
      }
      
      console.log('🔍 Nóminas válidas encontradas:', nominasValidas.length);
      console.log('🔍 Data original:', data);
      console.log('🔍 Data filtrada:', nominasValidas);
      
      if (nominasValidas.length === 0) {
        console.log('ℹ️ No se encontraron nóminas válidas');
        setNominas([]);
        setNominasLoading(false);
        return;
      }
      
      // Procesar solo las nóminas válidas
      let nominasProcesadas = nominasValidas.map((nomina, idx) => ({
        id: nomina.id || nomina.nomina_id || nomina.documento_id || `nomina_${idx}`,
        fileName: `nómina_${nomina.mes || 'sin_mes'}_${nomina.ano || nomina.año || 'sin_año'}.pdf`,
        fileSize: nomina.fileSize || nomina.tamaño || nomina.size || 0,
        uploadDate: nomina.fecha_subida || nomina.uploadDate || nomina.created_at || nomina.fecha || new Date().toISOString(),
        tipo: nomina.tipo || 'Nómina',
        empleadoId: authUser?.CODIGO || authUser?.id,
        empleadoEmail: email,
        periodo: nomina.mes || nomina.periodo || nomina.año || 'Sin especificar',
        // Extraer mes y año del periodo si existe
        mes: nomina.mes || nomina.luna || nomina.month || (nomina.periodo && nomina.periodo.includes(' ') ? nomina.periodo.split(' ')[0] : null),
        año: nomina.año || nomina.ano || nomina.an || nomina.year || (nomina.periodo && nomina.periodo.includes(' ') ? nomina.periodo.split(' ')[1] : null),
        salario: nomina.salario || nomina.importe || nomina.cantidad || 0,
        status: 'disponible'
      }));

      // Ordenar nóminas de más reciente a más antigua
      const nominasOrdenadas = nominasProcesadas.sort((a, b) => {
        const fechaA = new Date(a.uploadDate || 0);
        const fechaB = new Date(b.uploadDate || 0);
        return fechaB - fechaA; // Orden descendente (más reciente primero)
      });
      
      setNominas(nominasOrdenadas);
      console.log('✅ Nóminas procesadas y ordenadas:', nominasOrdenadas);
      
      // Log detallado de la primera nómina procesada
      if (nominasOrdenadas.length > 0) {
        const primera = nominasOrdenadas[0];
        console.log('🔍 Primera nómina procesada:', primera);
        console.log('🔍 Mes procesado:', primera.mes);
        console.log('🔍 Año procesado:', primera.año);
        console.log('🔍 Campos finales:', Object.keys(primera));
      }
      
    } catch (e) {
      console.error('❌ Error obteniendo nóminas:', e);
      setNominas([]);
      setError('¡Error al cargar las nóminas!');
    } finally {
      setNominasLoading(false);
    }
  }, [email, authUser]);

  // Función para obtener documentos oficiales del usuario
  const fetchDocumentosOficiales = useCallback(async () => {
    if (!email) {
      console.log('❌ No hay email del usuario para documentos oficiales');
      return;
    }

    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchDocumentosOficiales');
      setDocumentosOficialesLoading(false);
      return;
    }

    setDocumentosOficialesLoading(true);
    setDocumentosOficialesError(null);

    try {
      console.log('🏢 Obteniendo documentos oficiales para:', authUser?.['NOMBRE / APELLIDOS'], 'ID:', authUser?.CODIGO);
      
      const requestBody = {
        nombre: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre',
        codigo: authUser?.CODIGO || authUser?.id || 'N/A'
      };

      console.log('🔍 URL para documentos oficiales:', routes.getDocumentosOficiales);
      console.log('🔍 Request body:', requestBody);
      console.log('🔍 Endpoint base:', routes.getDocumentosOficiales);
      console.log('🔍 BASE_URL de routes:', routes.getDocumentosOficiales.includes('https://') ? 'DIRECT URL' : 'PROXY URL');
      
      // Use the correct URL based on environment
      const finalUrl = routes.getDocumentosOficiales;
      
      console.log('🔍 Final fetch URL:', finalUrl);
      console.log('🔍 Will use proxy?', !finalUrl.includes('https://'));

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log('🏢 Respuesta documentos oficiales:', data);
      
      // Verificar si los documentos oficiales son válidos o solo mensajes de éxito
      const isValidDocumentoOficial = (item) => {
        console.log('🔍 Validando documento oficial:', item);
        
        // Verificar si el objeto contiene campos reales de documento oficial
        const hasValidFields = item && (
          item.id || item.documento_id || item.documentoId ||
          item.nombre_archivo || item.fileName || item.archivo || item.nombre ||
          item.fecha_creacion || item.uploadDate || item.created_at || item.fecha ||
          item.tipo_documento || item.tipo
        );
        
        console.log('🔍 Documento oficial válido?', hasValidFields);
        return hasValidFields;
      };
      
      // Filtrar solo los documentos oficiales válidos
      let documentosOficialesValidos = [];
      
      if (Array.isArray(data)) {
        documentosOficialesValidos = data.filter(isValidDocumentoOficial);
      } else if (data.success && data.documentos) {
        documentosOficialesValidos = data.documentos.filter(isValidDocumentoOficial);
      }
      
      console.log('🔍 Documentos oficiales válidos encontrados:', documentosOficialesValidos.length);
      console.log('🔍 Data original:', data);
      console.log('🔍 Data filtrada:', documentosOficialesValidos);
      
      if (documentosOficialesValidos.length === 0) {
        console.log('ℹ️ No se encontraron documentos oficiales válidos');
        setDocumentosOficiales([]);
        setDocumentosOficialesLoading(false);
        return;
      }
      
      // Procesar solo los documentos oficiales válidos
      let documentosOficialesProcesados = [];
      
      if (Array.isArray(data)) {
        // Si la respuesta es directamente un array
        documentosOficialesProcesados = documentosOficialesValidos.map((doc, idx) => ({
          id: doc.id || `doc_oficial_${idx}`,
          doc_id: doc.doc_id,
          fileName: doc.nombre_archivo || doc.fileName || doc.archivo || doc.nombre || `Documento Oficial ${idx + 1}`,
          fileSize: doc.fileSize || doc.tamaño || doc.size || 0,
          uploadDate: doc.fecha_creacion || doc.uploadDate || doc.created_at || doc.fecha || new Date().toISOString(),
          tipo: doc.tipo_documento || doc.tipo || 'Documento Oficial',
          empleadoId: authUser?.CODIGO || authUser?.id,
          empleadoEmail: email,
          status: 'disponible'
        }));
      } else if (data.success && data.documentos) {
        // Si la respuesta tiene estructura {success: true, documentos: [...]}
        documentosOficialesProcesados = documentosOficialesValidos.map((doc, idx) => ({
          id: doc.id || `doc_oficial_${idx}`,
          doc_id: doc.doc_id,
          fileName: doc.nombre_archivo || doc.fileName || doc.archivo || doc.nombre || `Documento Oficial ${idx + 1}`,
          fileSize: doc.fileSize || doc.tamaño || doc.size || 0,
          uploadDate: doc.uploadDate || doc.fecha_creacion || doc.created_at || doc.fecha || new Date().toISOString(),
          tipo: doc.tipo_documento || doc.tipo || 'Documento Oficial',
          empleadoId: authUser?.CODIGO || authUser?.id,
          empleadoEmail: email,
          status: 'disponible'
        }));
      }

      // Ordenar documentos oficiales de más reciente a más antiguo
      const documentosOficialesOrdenados = documentosOficialesProcesados.sort((a, b) => {
        const fechaA = new Date(a.uploadDate || 0);
        const fechaB = new Date(b.uploadDate || 0);
        return fechaB - fechaA; // Orden descendente (más reciente primero)
      });
      
      setDocumentosOficiales(documentosOficialesOrdenados);
      console.log('✅ Documentos oficiales procesados y ordenados:', documentosOficialesOrdenados);
      
    } catch (error) {
      console.error('❌ Error obteniendo documentos oficiales:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setDocumentosOficialesError(error.message);
      setDocumentosOficiales([]);
    } finally {
      setDocumentosOficialesLoading(false);
    }
  }, [email, authUser]);

  const fetchDocumentos = useCallback(async () => {
    if (!email) {
      return;
    }

    if (!routes.getDocumentos) {
      return;
    }

    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchDocumentos');
      setDocumentosLoading(false);
      return;
    }

    setDocumentosLoading(true);
    
    try {
      // Usar el mismo endpoint que DocumentosEmpleadosPage para obtener todos los documentos
      // Enviar tanto ID como email al backend para mayor robustez
      const empleadoId = authUser?.CODIGO || authUser?.id;
      const empleadoEmail = email;
      
      let url;
      if (empleadoId && empleadoEmail) {
        // Enviar ambos parámetros si están disponibles
        url = `${routes.getDocumentos}?empleadoId=${encodeURIComponent(empleadoId)}&email=${encodeURIComponent(empleadoEmail)}`;
      } else if (empleadoId) {
        // Solo ID si no hay email
        url = `${routes.getDocumentos}?empleadoId=${encodeURIComponent(empleadoId)}`;
      } else if (empleadoEmail) {
        // Solo email si no hay ID
        url = `${routes.getDocumentos}?email=${encodeURIComponent(empleadoEmail)}`;
      } else {
        // No hay ni ID ni email
        console.warn('No se puede obtener documentos: falta ID y email del empleado');
        setDocumentos([]);
        return;
      }
      
      console.log('🌐 Obteniendo documentos desde endpoint de PRODUCCIÓN:', url);
      console.log('📋 Parámetros enviados:', {
        empleadoId: empleadoId || 'No disponible',
        empleadoEmail: empleadoEmail || 'No disponible',
        url: url
      });

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // No hay documentos
        setDocumentos([]);
        return;
        }
        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📥 Documentos obtenidos del backend de PRODUCCIÓN:', data);
      
      // Verificar si la respuesta tiene estructura {success: true, documentos: [...]}
      let documentosArray = [];
      if (data.success && data.documentos && Array.isArray(data.documentos)) {
        // Si la respuesta tiene estructura {success: true, documentos: [...]}
        documentosArray = data.documentos;
        console.log('🔍 Estructura success con documentos:', documentosArray);
      } else if (Array.isArray(data)) {
        // Si la respuesta es directamente un array
        documentosArray = data;
        console.log('🔍 Respuesta directa como array:', documentosArray);
      } else if (data.success && data.data && Array.isArray(data.data)) {
        // Si la respuesta tiene estructura {success: true, data: [...]}
        documentosArray = data.data;
        console.log('🔍 Estructura success con data:', documentosArray);
      } else {
        // Si no hay estructura esperada, intentar usar data directamente
        documentosArray = Array.isArray(data) ? data : [];
        console.log('🔍 Usando data directamente:', documentosArray);
      }
      
      // DEBUG: Ver estructura real de cada documento
      if (documentosArray.length > 0) {
        console.log('🔍 Estructura del primer documento:', documentosArray[0]);
        console.log('🔍 Campos disponibles:', Object.keys(documentosArray[0]));
        
        // DEBUG DETALLADO: Mostrar todos los campos para el primer documento
        console.log('🔍 DEBUG DETALLADO - Primer documento del backend:');
        Object.entries(documentosArray[0]).forEach(([key, value]) => {
          console.log(`  ${key}:`, value, `(tip: ${typeof value})`);
        });
      }
      
      // Procesar los documentos recibidos usando la misma lógica que DocumentosEmpleadosPage
      const documentosProcesados = documentosArray;
      
      // Mapear los campos del backend a nuestro formato local
      console.log('🔍 Documentos antes del filtrado:', documentosProcesados);
      
      const documentosMapeados = documentosProcesados
        .filter(doc => {
          // Solo incluir documentos que tengan un ID real del backend y al menos un nombre de archivo
          const hasRealId = doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId;
          const hasFileName = doc.fileName || doc.nombre_archivo || doc.archivo || doc.nombre || doc.nombreArchivo || doc.file_name || doc.filename || doc.nombre_documento;
          
          console.log('🔍 Filtrando documento:', {
            doc: doc,
            hasRealId: hasRealId,
            hasFileName: hasFileName,
            id: doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId,
            fileName: doc.fileName || doc.nombre_archivo || doc.archivo || doc.nombre || doc.nombreArchivo || doc.file_name || doc.filename || doc.nombre_documento
          });
          
          return hasRealId && hasFileName;
        })
        .map(doc => ({
          id: doc.id,
          doc_id: doc.doc_id,
          fileName: doc.nombre_archivo,
          fileSize: doc.fileSize || doc.tamaño || doc.size || doc.file_size || doc.tamano || doc.tamanio || doc.filesize || doc.size_bytes,
          uploadDate: doc.fecha_creacion,
          status: doc.status || doc.estado || doc.state || doc.estado_documento,
          tipo: doc.tipo_documento,
          empleadoEmail: doc.correo_electronico,
          uploadedBy: doc.uploaded_by || doc.subido_por || doc.uploadedBy || doc.subidoPor || doc.user || doc.usuario || doc.autor || doc.creador,
          uploadedDate: doc.fecha_creacion
        }));
      
      // Ordenar documentos de más reciente a más antiguo
      const documentosOrdenados = documentosMapeados.sort((a, b) => {
        const fechaA = new Date(a.uploadDate || 0);
        const fechaB = new Date(b.uploadDate || 0);
        return fechaB - fechaA; // Orden descendente (más reciente primero)
      });
      
      setDocumentos(documentosOrdenados);
      console.log('✅ Documentos procesados y ordenados:', documentosOrdenados);
    } catch (e) {
      console.error('❌ Error obteniendo documentos:', e);
      setDocumentos([]);
    } finally {
      setDocumentosLoading(false);
    }
  }, [email, authUser?.CODIGO, authUser?.id, authUser?.isDemo]);

  // Función para abrir el preview de un documento
  const handlePreviewDocument = async (documento) => {
    setPreviewDocument(documento);
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewError(null);
    
    try {
      // Construir URL para obtener el contenido del documento
      // Usar endpoint correcto según el tipo de documento
      let previewUrl;
      
      if (documento.tipo === 'Nómina') {
        // Para nóminas, usar el endpoint específico de preview (que loghează accesul)
        previewUrl = `${routes.previewNomina(documento.id)}?nombre=${encodeURIComponent(authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || '')}`;
        console.log('📄 Preview para nómina:', previewUrl);
        console.log('🔍 Endpoint usado:', routes.previewNomina(documento.id));
        console.log('🔍 ID nómina:', documento.id);
        console.log('🔍 Nombre:', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name);
        console.log('🔍 Parámetros enviados:', { id: documento.id, nombre: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name });
        
        // Para nóminas, siempre hacer fetch con headers para obtener blob y crear blob URL local
        // (iframe no puede enviar headers custom, así que necesitamos blob URL)
        try {
          const token = localStorage.getItem('auth_token');
          const fetchHeaders = {
            'Accept': 'application/pdf, application/json',
          };
          if (token) {
            fetchHeaders['Authorization'] = `Bearer ${token}`;
          }
          
          console.log('📥 Fetching nómina con headers para crear blob URL...');
          const response = await fetch(previewUrl, { headers: fetchHeaders });
          console.log('📥 Respuesta del endpoint PDF:', response);
          console.log('Status:', response.status);
          console.log('OK:', response.ok);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ El endpoint no retorna OK:', response.status, errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
          }
          
          const blob = await response.blob();
          const contentType = response.headers.get('content-type') || blob.type;
          console.log('✅ Blob obtenido, tamaño:', blob.size, 'tipo:', blob.type, 'Content-Type:', contentType);
          
          if (blob.size > 0) {
            // Detectăm tipul real al fișierului
            const isImage = contentType && contentType.startsWith('image/');
            const isPdf = contentType && contentType.includes('application/pdf');
            
            if (isImage) {
              // Dacă este imagine, folosim base64 pentru a evita probleme CORB
              console.log('🖼️ Nómina detectada como imagen, convirtiendo a base64...');
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = reader.result;
                if (base64String && typeof base64String === 'string') {
                  console.log('✅ Data URL creado para nómina (imagen base64)');
                  setPreviewDocument({ ...documento, previewUrl: base64String, isPdf: false });
                } else {
                  // Fallback a blob URL
                  const url = URL.createObjectURL(blob);
                  console.log('✅ Blob URL creado para nómina (imagen fallback):', url);
                  setPreviewDocument({ ...documento, previewUrl: url, isPdf: false });
                }
                setPreviewLoading(false);
              };
              reader.onerror = () => {
                console.warn('⚠️ Error al convertir imagen a base64, usando blob URL');
                const url = URL.createObjectURL(blob);
                setPreviewDocument({ ...documento, previewUrl: url, isPdf: false });
                setPreviewLoading(false);
              };
              reader.readAsDataURL(blob);
              return; // Salir aquí, el callback se encargará de setPreviewLoading
            } else if (isPdf) {
              // Pentru iOS, folosim base64 (mai stabil pentru PDF-uri pe mobil)
              // Pentru Android, folosim blob URL
              const url = isIOS 
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : URL.createObjectURL(blob);
              console.log('✅ URL creado para nómina PDF:', isIOS ? 'base64' : 'blob');
              setPreviewDocument({ ...documento, previewUrl: url, isPdf: true });
              setPreviewLoading(false);
              return; // Salir temprano, ya tenemos el blob URL
            } else {
              // Tip necunoscut, încercăm ca PDF (fallback)
              console.warn('⚠️ Tipo desconocido para nómina, tratando como PDF:', contentType);
              const url = isIOS 
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : URL.createObjectURL(blob);
              setPreviewDocument({ ...documento, previewUrl: url, isPdf: true });
              setPreviewLoading(false);
              return;
            }
          } else {
            console.warn('⚠️ Blob vacío, usando URL directa');
          }
        } catch (error) {
          console.error('❌ Error obteniendo blob de nómina:', error);
          setPreviewError(`Error al cargar la nómina: ${error.message}`);
          setPreviewLoading(false);
          return;
        }
      } else if (
        // Sólo tratar como oficial si viene marcado o si estamos en el tab de oficiales
        documento.esOficial === true || (
          activeTab === 'contrato-documentos' &&
          documento.tipo && (
            documento.tipo.toLowerCase().includes('contrato') ||
            documento.tipo.toLowerCase().includes('alta') ||
            documento.tipo.toLowerCase().includes('baja') ||
            documento.tipo.toLowerCase().includes('otro') ||
            documento.tipo.toLowerCase().includes('certificado')
          )
        )
      ) {
        // Para documentos oficiales, usar el endpoint específico
        previewUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}`;
        console.log('📄 Preview para documento oficial:', previewUrl);
        console.log('🔍 Endpoint usado:', routes.downloadDocumentoOficial);
        console.log('🔍 ID documento oficial (id del backend):', documento.id);
        console.log('🔍 Doc ID documento oficial (doc_id del backend):', documento.doc_id);
        console.log('🔍 Email:', email);
        console.log('🔍 FileName:', documento.fileName);
      } else {
        // Para documentos normales, usar el endpoint estándar
        previewUrl = `${routes.downloadDocumento}?id=${documento.id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}`;
        console.log('📄 Preview para documento normal:', previewUrl);
        console.log('🔍 DEBUG DOWNLOAD - Valores enviados:');
        console.log('  documento.id (empleado_id):', documento.id);
        console.log('  documento.doc_id (document_id):', documento.doc_id);
        console.log('  documento.fileName:', documento.fileName);
        console.log('  email:', email);
      }
      
      console.log('🔍 Abriendo preview del documento:', previewUrl);
      console.log('🔍 Documento completo:', documento);
      console.log('🔍 Tipo de documento:', documento.tipo);
      
      // Helper function pentru a obține headers cu JWT token
      const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Accept': 'application/pdf, application/json, image/*, */*',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      };
      
      // Pentru PDF-uri pe mobil, procesăm imediat ca blob/base64 (nu setăm URL direct)
      // Pentru imagini și alte tipuri, setăm URL direct și procesăm mai jos
      const isPdfFile = documento.fileName?.toLowerCase().endsWith('.pdf');
      
      if (!isPdfFile) {
        // Pentru non-PDF, setăm URL direct (va fi procesat mai jos pentru imagini)
        setPreviewDocument({ ...documento, previewUrl });
      }
      
      // Si es PDF y estamos en móvil (iOS/Android), cargar como data URL base64 pentru iOS sau blob URL pentru Android
      if (
        (isIOS || isAndroid) &&
        isPdfFile
      ) {
        try {
          // Add JWT token for backend API calls
          const token = localStorage.getItem('auth_token');
          const fetchHeaders = {};
          if (token) {
            fetchHeaders['Authorization'] = `Bearer ${token}`;
          }
          const response = await fetch(previewUrl, { headers: fetchHeaders });
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              // Pentru iOS, folosim base64 (mai stabil pentru PDF-uri pe mobil)
              // Pentru Android, folosim blob URL
              const url = isIOS 
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : URL.createObjectURL(blob);
              setPreviewDocument({ ...documento, previewUrl: url, isPdf: true });
              setPreviewLoading(false);
              console.log('📱 Mobile PDF procesat:', isIOS ? 'base64' : 'blob');
              return; // Ieșim aici pentru PDF-uri pe mobil
            } else {
              console.warn('⚠️ Blob vacío, se usará URL directa');
            }
          } else {
            console.warn('⚠️ No se pudo obtener blob del PDF, se usará URL directa');
          }
        } catch (e) {
          console.warn('⚠️ Error procesando PDF para móvil:', e);
        }
      }

      // Para archivos de texto, intentar obtener el contenido
      if (documento.fileName?.toLowerCase().endsWith('.txt')) {
        const response = await fetch(previewUrl, { headers: getAuthHeaders() });
        if (response.ok) {
          const textContent = await response.text();
          setPreviewDocument({ ...documento, content: textContent, previewUrl });
        } else {
          throw new Error('No se pudo cargar el contenido del archivo');
        }
      }
      
      // Para archivos de imagen, crear blob URL local
      if (documento.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        console.log('🖼️ Archivo de imagen detectado, creando blob URL local...');
        try {
          const response = await fetch(previewUrl, { headers: getAuthHeaders() });
          console.log('🔍 Respuesta para imagen:', response.status, response.ok);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('🔍 Content-Type:', contentType);
            
            // Verificar si el backend retorna JSON en lugar de imagen
            if (contentType && contentType.includes('application/json')) {
              console.log('📦 Backend retorna JSON, procesando...');
              try {
                const responseText = await response.text();
                console.log('🔍 Texto de respuesta:', responseText);
                
                if (responseText && responseText.trim().length > 0) {
                  const jsonData = JSON.parse(responseText);
                  console.log('🔍 JSON recibido:', jsonData);
                  
                  // Intentar extraer URL de imagen del JSON
                  const imageUrl = jsonData.url || jsonData.imageUrl || jsonData.pdfUrl || jsonData.archivo || jsonData.file;
                  
                  if (imageUrl) {
                    console.log('✅ URL de imagen encontrado en JSON:', imageUrl);
                    setPreviewDocument({ ...documento, previewUrl: imageUrl });
                  } else if (jsonData && (jsonData.base64 || jsonData.imageBase64)) {
                    const base64 = jsonData.base64 || jsonData.imageBase64;
                    const dataUrl = `data:image/png;base64,${base64}`;
                    console.log('✅ Imagen en base64 recibida, usando data URL');
                    setPreviewDocument({ ...documento, previewUrl: dataUrl });
                  } else {
                    // Si no hay datos útiles en el JSON, intenta obtener el blob directamente forzando Accept: image/*
                    console.log('ℹ️ JSON sin URL. Intentando segundo fetch como imagen...');
                    try {
                      const imgHeaders = getAuthHeaders();
                      imgHeaders['Accept'] = 'image/*';
                      const imgResponse = await fetch(previewUrl, { headers: imgHeaders });
                      if (imgResponse.ok) {
                        const imgBlob = await imgResponse.blob();
                        console.log('🔍 Imagen (segundo fetch) blob size:', imgBlob.size, 'type:', imgBlob.type);
                        if (imgBlob.size > 0) {
                          const blobUrl = URL.createObjectURL(imgBlob);
                          console.log('✅ Blob URL creado para imagen tras segundo fetch:', blobUrl);
                          setPreviewDocument({ ...documento, previewUrl: blobUrl });
                        } else {
                          console.warn('⚠️ Blob vacío tras segundo fetch. Usando URL directa');
                          setPreviewDocument({ ...documento, previewUrl });
                        }
                      } else {
                        console.warn('⚠️ Segundo fetch no OK:', imgResponse.status);
                        setPreviewDocument({ ...documento, previewUrl });
                      }
                    } catch (secondErr) {
                      console.error('❌ Error en segundo fetch de imagen:', secondErr);
                      setPreviewDocument({ ...documento, previewUrl });
                    }
                  }
                } else {
                  // Respuesta JSON vacía: intentar segundo fetch directamente como imagen
                  console.log('⚠️ Respuesta JSON vacía, intentando segundo fetch como imagen');
                  try {
                    const imgHeaders = getAuthHeaders();
                    imgHeaders['Accept'] = 'image/*';
                    const imgResponse = await fetch(previewUrl, { headers: imgHeaders });
                    if (imgResponse.ok) {
                      const imgBlob = await imgResponse.blob();
                      console.log('🔍 Imagen (segundo fetch) blob size:', imgBlob.size, 'type:', imgBlob.type);
                      if (imgBlob.size > 0) {
                        const blobUrl = URL.createObjectURL(imgBlob);
                        console.log('✅ Blob URL creado para imagen tras segundo fetch:', blobUrl);
                        setPreviewDocument({ ...documento, previewUrl: blobUrl });
                      } else {
                        console.warn('⚠️ Blob vacío tras segundo fetch. Usando URL directa');
                        setPreviewDocument({ ...documento, previewUrl });
                      }
                    } else {
                      console.warn('⚠️ Segundo fetch no OK:', imgResponse.status);
                      setPreviewDocument({ ...documento, previewUrl });
                    }
                  } catch (secondErr) {
                    console.error('❌ Error en segundo fetch de imagen:', secondErr);
                    setPreviewDocument({ ...documento, previewUrl });
                  }
                }
              } catch (parseError) {
                console.error('❌ Error al parsear JSON:', parseError);
                // Ante error de parseo, intenta segundo fetch como imagen
                try {
                  const imgHeaders = getAuthHeaders();
                  imgHeaders['Accept'] = 'image/*';
                  const imgResponse = await fetch(previewUrl, { headers: imgHeaders });
                  if (imgResponse.ok) {
                    const imgBlob = await imgResponse.blob();
                    console.log('🔍 Imagen (segundo fetch) blob size:', imgBlob.size, 'type:', imgBlob.type);
                    if (imgBlob.size > 0) {
                      const blobUrl = URL.createObjectURL(imgBlob);
                      console.log('✅ Blob URL creado para imagen tras segundo fetch:', blobUrl);
                      setPreviewDocument({ ...documento, previewUrl: blobUrl });
                    } else {
                      console.warn('⚠️ Blob vacío tras segundo fetch. Usando URL directa');
                      setPreviewDocument({ ...documento, previewUrl });
                    }
                  } else {
                    console.warn('⚠️ Segundo fetch no OK:', imgResponse.status);
                    setPreviewDocument({ ...documento, previewUrl });
                  }
                } catch (secondErr) {
                  console.error('❌ Error en segundo fetch de imagen:', secondErr);
                  setPreviewDocument({ ...documento, previewUrl });
                }
              }
            } else {
              // Si retorna la imagen directamente como blob
              const blob = await response.blob();
              console.log('🔍 Imagen blob size:', blob.size, 'type:', blob.type);
              
              if (blob.size > 0) {
                // Convertir blob a base64 pentru evitar problemas CORB/CORS
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64String = reader.result;
                  if (base64String && typeof base64String === 'string') {
                    const dataUrl = base64String;
                    console.log('✅ Data URL creado para imagen (base64)');
                    setPreviewDocument({ ...documento, previewUrl: dataUrl });
                  } else {
                    // Fallback a blob URL si base64 falla
                    const blobUrl = URL.createObjectURL(blob);
                    console.log('✅ Blob URL creado para imagen (fallback):', blobUrl);
                    setPreviewDocument({ ...documento, previewUrl: blobUrl });
                  }
                  setPreviewLoading(false);
                };
                reader.onerror = () => {
                  console.warn('⚠️ Error al convertir blob a base64, usando blob URL');
                  const blobUrl = URL.createObjectURL(blob);
                  setPreviewDocument({ ...documento, previewUrl: blobUrl });
                  setPreviewLoading(false);
                };
                reader.readAsDataURL(blob);
                return; // Salir aquí, el callback se encargará de setPreviewLoading
              } else {
                console.warn('⚠️ El blob de imagen está vacío! Usando URL directa');
                setPreviewDocument({ ...documento, previewUrl });
              }
            }
            
            setPreviewLoading(false);
            return; // Salir aquí
          } else {
            console.error('❌ Error al cargar imagen:', response.status);
            // Intentar con URL directa como fallback
            setPreviewDocument({ ...documento, previewUrl });
            setPreviewLoading(false);
            return;
          }
        } catch (error) {
          console.error('❌ Error al procesar imagen:', error);
          // Intentar con URL directa como fallback
          setPreviewDocument({ ...documento, previewUrl });
          setPreviewLoading(false);
          return;
        }
      }
      
      // Pentru imagini, asigură-te că sunt procesate corect pentru iOS
      if (documento.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        console.log('🖼️ Archivo de imagen detectado, procesando para iOS...');
        
        try {
          const response = await fetch(previewUrl, { headers: getAuthHeaders() });
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('🔍 Content-Type imagen:', contentType);
            
            if (contentType && contentType.startsWith('image/')) {
              const blob = await response.blob();
              console.log('🔍 Blob imagen size:', blob.size);
              
              if (blob.size > 0) {
                // Pentru iOS, folosim blob URL direct (nu base64 pentru imagini)
                const url = URL.createObjectURL(blob);
                console.log('✅ URL imagen creado para iOS:', url);
                setPreviewDocument({ ...documento, previewUrl: url });
                setPreviewLoading(false);
                return;
              }
            }
          }
        } catch (error) {
          console.error('❌ Error procesando imagen para iOS:', error);
        }
      }
      
      // Para PDFs (doar pentru desktop, pentru mobil s-a procesat deja mai sus)
      if (documento.fileName?.toLowerCase().endsWith('.pdf') && !(isIOS || isAndroid)) {
        console.log('📄 Archivo PDF detectado, creando blob URL local...');
        
        try {
          const response = await fetch(previewUrl, { headers: getAuthHeaders() });
          console.log('🔍 Respuesta del endpoint PDF:', response);
          console.log('🔍 Status:', response.status);
          console.log('🔍 OK:', response.ok);
          
          if (response.ok) {
            // Verificar Content-Type para detectar si retorna JSON en lugar de PDF
            const contentType = response.headers.get('content-type');
            console.log('🔍 Content-Type detectado:', contentType);
            
            if (contentType && contentType.includes('application/pdf')) {
              // Para PDF direct, creează un blob URL pentru preview
              const blob = await response.blob();
              console.log('🔍 Blob size:', blob.size);
              console.log('🔍 Blob type:', blob.type);
              
              if (blob.size > 0) {
                // Pentru Android, folosim blob URL (mai stabil decât base64)
                // Pentru iOS, încă folosim base64 pentru compatibilitate
                const url = isIOS 
                  ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                  : URL.createObjectURL(blob);
                console.log('✅ URL creado para PDF:', isIOS ? 'base64' : 'blob');
                setPreviewDocument({ ...documento, previewUrl: url });
                setPreviewLoading(false);
                return;
              } else {
                console.warn('⚠️ El blob está vacío! El endpoint no retorna el archivo!');
              }
            } else if (contentType && contentType.includes('application/json')) {
              console.warn('⚠️ El endpoint retorna JSON en lugar de PDF!');
              // Încearcă să proceseze JSON pentru a obține URL-ul PDF
              try {
                const data = await response.json();
                if (data.success && data.pdfUrl) {
                  setPreviewDocument({ ...documento, previewUrl: data.pdfUrl });
                  setPreviewLoading(false);
                  return;
                }
              } catch (jsonError) {
                console.error('❌ Error parsing JSON:', jsonError);
              }
            } else {
              // Fallback: încearcă să creeze un blob URL
              const blob = await response.blob();
              if (blob.size > 0) {
                // Pentru Android, folosim blob URL (mai stabil decât base64)
                // Pentru iOS, încă folosim base64 pentru compatibilitate
                const url = isIOS 
                  ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                  : URL.createObjectURL(blob);
                console.log('✅ Fallback URL creado para PDF:', isIOS ? 'base64' : 'blob');
                setPreviewDocument({ ...documento, previewUrl: url });
                setPreviewLoading(false);
                return;
              }
            }
          } else {
            console.error('❌ El endpoint no retorna OK:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('❌ Error al verificar el endpoint PDF:', error);
        }
      }
      
      // Log adicional para debugging
      console.log('🔍 Tipo de archivo:', documento.fileName?.split('.').pop()?.toLowerCase());
      console.log('🔍 Es imagen?', documento.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'SÍ' : 'NO');
      console.log('🔍 Es PDF?', documento.fileName?.toLowerCase().endsWith('.pdf') ? 'SÍ' : 'NO');
      
      setPreviewLoading(false);
    } catch (error) {
      console.error('❌ Error cargando preview:', error);
      setPreviewError(error.message);
      setPreviewLoading(false);
    }
  };

  // Cleanup pentru blob URL-uri când se schimbă previewDocument sau se închide modalul
  useEffect(() => {
    return () => {
      // Revocă blob URL-urile când componenta se unmount sau când previewDocument se schimbă
      if (previewDocument?.previewUrl && typeof previewDocument.previewUrl === 'string' && previewDocument.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewDocument.previewUrl);
        console.log('🧹 Blob URL revocat pentru cleanup');
      }
    };
  }, [previewDocument]);

  // Función para cerrar el modal de preview
  const handleClosePreview = () => {
    // Revocă blob URL dacă există
    if (previewDocument?.previewUrl && typeof previewDocument.previewUrl === 'string' && previewDocument.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewDocument.previewUrl);
      console.log('🧹 Blob URL revocat la închiderea modalului');
    }
    setShowPreviewModal(false);
    setPreviewDocument(null);
    setPreviewLoading(false);
    setPreviewError(null);
  };

  // Función para descargar documentos oficiales
  const handleDownloadDocumentOficial = async (documento) => {
    try {
      console.log('📥 Descargando documento oficial:', documento);
      
      // Construir URL para descarga
      const downloadUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}`;
      
      console.log('🔗 URL de descarga:', downloadUrl);
      console.log('🔍 Parámetros:', { 
        id: documento.id, 
        documentId: documento.doc_id,
        nombre: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name 
      });
      
      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Accept': 'application/pdf, application/json, */*',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }
      
      // Descargar documento
      const response = await fetch(downloadUrl, { headers: fetchHeaders });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = documento.fileName || `documento_oficial_${documento.id}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Log de la acción
        await activityLogger.logAction('documento_oficial_downloaded', {
          documento_id: documento.id,
          fileName: documento.fileName,
          tipo: documento.tipo,
          user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name,
          email: email
        });
        
        setNotification({
          type: 'success',
          title: 'Descarga Exitosa',
          message: 'Documento oficial descargado correctamente'
        });
      } else {
        throw new Error(`Error HTTP: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error descargando documento oficial:', error);
      setNotification({
        type: 'error',
        title: 'Error de Descarga',
        message: 'No se pudo descargar el documento oficial'
      });
    }
  };

  // Función para abrir el preview de un documento oficial
  const handlePreviewDocumentOficial = async (documento) => {
    try {
      console.log('📄 Abriendo preview para documento oficial:', documento);
      
      // Construir URL para preview
      const previewUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}`;
      
      console.log('🔍 URL de preview:', previewUrl);
      
      // Helper function pentru a obține headers cu JWT token
      const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Accept': 'application/pdf, application/json, image/*, */*',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      };
      
      setShowPreviewModal(true);
      setPreviewLoading(true);
      setPreviewError(null);
      
      // Para archivos de imagen, crear blob URL local (igual que en handlePreviewDocument)
      if (documento.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        console.log('🖼️ Archivo de imagen detectado en documento oficial, creando blob URL local...');
        try {
          const response = await fetch(previewUrl, { headers: getAuthHeaders() });
          console.log('🔍 Respuesta para imagen oficial:', response.status, response.ok);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('🔍 Content-Type:', contentType);
            
            if (contentType && contentType.startsWith('image/')) {
              const blob = await response.blob();
              console.log('🔍 Blob imagen oficial size:', blob.size);
              
              if (blob.size > 0) {
                // Convertir blob a base64 para evitar problemas CORB/CORS
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64String = reader.result;
                  if (base64String && typeof base64String === 'string') {
                    console.log('✅ Data URL creado para imagen oficial (base64)');
                    setPreviewDocument({ ...documento, previewUrl: base64String, esOficial: true });
                  } else {
                    // Fallback a blob URL si base64 falla
                    const url = URL.createObjectURL(blob);
                    console.log('✅ Blob URL creado para imagen oficial (fallback):', url);
                    setPreviewDocument({ ...documento, previewUrl: url, esOficial: true });
                  }
                  setPreviewLoading(false);
                };
                reader.onerror = () => {
                  console.warn('⚠️ Error al convertir blob a base64, usando blob URL');
                  const url = URL.createObjectURL(blob);
                  setPreviewDocument({ ...documento, previewUrl: url, esOficial: true });
                  setPreviewLoading(false);
                };
                reader.readAsDataURL(blob);
                return; // Salir aquí, el callback se encargará de setPreviewLoading
              } else {
                throw new Error('Blob vacío para imagen oficial');
              }
            } else {
              throw new Error('Content-Type no es imagen para documento oficial');
            }
          } else {
            throw new Error(`HTTP ${response.status} para imagen oficial`);
          }
        } catch (imgError) {
          console.error('❌ Error procesando imagen oficial:', imgError);
          // Fallback: usar URL directa
          setPreviewDocument({ ...documento, previewUrl, esOficial: true });
        }
      } else if (documento.fileName?.toLowerCase().endsWith('.pdf')) {
        // Para PDFs oficiales, hacer fetch con headers y crear blob URL local
        console.log('📄 Archivo PDF oficial detectado, creando blob URL local...');
        try {
          const response = await fetch(previewUrl, { headers: getAuthHeaders() });
          console.log('🔍 Respuesta para PDF oficial:', response.status, response.ok);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('🔍 Content-Type PDF oficial:', contentType);
            
            if (contentType && contentType.includes('application/pdf')) {
              const blob = await response.blob();
              console.log('🔍 Blob PDF oficial size:', blob.size);
              
              if (blob.size > 0) {
                // Pentru iOS, folosim base64 (mai stabil pentru PDF-uri pe mobil)
                // Pentru Android, folosim blob URL
                const url = isIOS 
                  ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                  : URL.createObjectURL(blob);
                console.log('✅ URL creado para PDF oficial:', isIOS ? 'base64' : 'blob');
                setPreviewDocument({ ...documento, previewUrl: url, esOficial: true, isPdf: true });
              } else {
                throw new Error('Blob vacío para PDF oficial');
              }
            } else {
              throw new Error('Content-Type no es PDF para documento oficial');
            }
          } else {
            const errorText = await response.text();
            console.error('❌ El endpoint no retorna OK para PDF oficial:', response.status, errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
          }
        } catch (pdfError) {
          console.error('❌ Error procesando PDF oficial:', pdfError);
          // Fallback: usar URL directa
          setPreviewDocument({ ...documento, previewUrl, esOficial: true });
        }
      } else {
        // Para otros archivos, hacer fetch con headers y crear blob URL local
        console.log('📄 Otro tipo de archivo oficial, creando blob URL local...');
        try {
          const response = await fetch(previewUrl, { headers: getAuthHeaders() });
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const blobUrl = URL.createObjectURL(blob);
              setPreviewDocument({ ...documento, previewUrl: blobUrl, esOficial: true });
            } else {
              setPreviewDocument({ ...documento, previewUrl, esOficial: true });
            }
          } else {
            setPreviewDocument({ ...documento, previewUrl, esOficial: true });
          }
        } catch (otherError) {
          console.error('❌ Error procesando otro archivo oficial:', otherError);
          setPreviewDocument({ ...documento, previewUrl, esOficial: true });
        }
      }
      
      setPreviewLoading(false);
      
    } catch (error) {
      console.error('❌ Error abriendo preview:', error);
      setPreviewError('Error al abrir el preview del documento');
      setPreviewLoading(false);
    }
  };



  // Función para firmar con AutoFirma para documentos oficiales (SIMPLIFICADA)
  // Función para detectar dispositivo móvil
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Función para firmar con AutoScript
  const handleSignWithAutoScript = async (documento) => {
    // Verificar si es dispositivo móvil
    if (isMobileDevice()) {
      setNotification({
        type: 'info',
        title: '📱 Dispositivo Móvil Detectado',
        message: 'Para firmar digitalmente con AutoFirma, te recomendamos usar un ordenador o la versión móvil de la aplicación. AutoFirma funciona mejor en dispositivos de escritorio.'
      });
      return;
    }

    // ✅ INICIALIZAR AutoScript INMEDIATAMENTE después del click del usuario
    // Esto asegura que Chrome considere la conexión WebSocket como iniciada por acción directa del usuario
    console.log('🔧 Inicializando AutoScript (antes de fetch)...');
    if (typeof AutoScript === 'undefined' || typeof window === 'undefined' || !window.AutoScript) {
      console.error('❌ AutoScript no está disponible');
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'AutoScript no está disponible. Por favor, recarga la página.'
      });
      return;
    }

    try {
      window.AutoScript.cargarAppAfirma();
      console.log('✅ AutoScript.cargarAppAfirma() inicializado correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar AutoScript:', error);
      setNotification({
        type: 'error',
        title: 'Error al inicializar AutoFirma',
        message: 'No se pudo inicializar AutoFirma. Por favor, asegúrate de que AutoFirma esté instalado correctamente.'
      });
      return;
    }

    setLoading(true); // Mostrar loading
    
    // ✅ Usar requestAnimationFrame para preservar el contexto de "user gesture"
    // Esto permite que Chrome considere que la conexión WebSocket es iniciada por acción directa del usuario
    // incluso después de operaciones asíncronas
    // requestAnimationFrame se ejecuta en el mismo frame de renderizado, preservando el contexto
    requestAnimationFrame(async () => {
      try {
      console.log('🚀 Firmar con AutoScript para:', documento.fileName);
      
      // Descargar el PDF directamente usando el sistema de rutare centralizat
      // Usar el mismo formato de email que en el resto del código
      const email = authUser?.['CORREO ELECTRONICO'] || authUser?.email || authUser?.CORREO_ELECTRONICO || '';
      const downloadUrl = `${routes.downloadDocumentoOficial}?id=${authUser?.CODIGO}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName)}`;
      console.log('📥 Descargando PDF desde:', downloadUrl);
      console.log('📧 Email usado:', email);
      
      // Obtener token JWT para autenticación
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });
      
      // Verificar si la respuesta es OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error al descargar PDF:', response.status, errorText);
        setNotification({
          type: 'error',
          title: 'Error al descargar documento',
          message: `No se pudo descargar el documento. Error ${response.status}: ${response.statusText}`
        });
        setLoading(false);
        return;
      }
      
      // Verificar Content-Type
      const contentType = response.headers.get('content-type');
      console.log('📄 Content-Type recibido:', contentType);
      
      if (!contentType || !contentType.includes('application/pdf')) {
        console.warn('⚠️ Advertencia: Content-Type no es PDF:', contentType);
      }
      
      const blob = await response.blob();
      console.log('📦 Blob descargado, tamaño:', blob.size, 'bytes');
      
      // Validar que el blob no esté vacío
      if (blob.size === 0) {
        console.error('❌ El PDF descargado está vacío');
        setNotification({
          type: 'error',
          title: 'Error al descargar documento',
          message: 'El documento descargado está vacío. Por favor, contacta con el administrador.'
        });
        setLoading(false);
        return;
      }
      
      // Validar tamaño mínimo (un PDF válido debe tener al menos algunos KB)
      if (blob.size < 100) {
        console.error('❌ El PDF descargado es demasiado pequeño:', blob.size, 'bytes');
        setNotification({
          type: 'error',
          title: 'Error al descargar documento',
          message: 'El documento descargado parece estar corrupto o vacío. Por favor, intenta descargarlo manualmente primero.'
        });
        setLoading(false);
        return;
      }
      
      // Convertir el blob a Base64
      const pdfBase64 = await blobToBase64(blob);
      console.log('📄 PDF convertido a Base64, longitud:', pdfBase64.length, 'caracteres');
      
      // Validar que Base64 no esté vacío
      if (!pdfBase64 || pdfBase64.length < 100) {
        console.error('❌ El Base64 generado es demasiado pequeño:', pdfBase64?.length);
        setNotification({
          type: 'error',
          title: 'Error al procesar documento',
          message: 'No se pudo convertir el documento a Base64 correctamente. Por favor, intenta nuevamente.'
        });
        setLoading(false);
        return;
      }
      
      // === FIRMA VISIBLE PAdES ===
      // La página es 1-based. Las coordenadas están en puntos PDF (72 dpi).
      // Para abajo derecha: X grande (derecha), Y pequeño (abajo)
      // No especificamos signaturePage para permitir que AutoFirma decida
      const extraParamsString = 
        "signaturePositionOnPageLowerLeftX=400\n" +
        "signaturePositionOnPageLowerLeftY=50\n" +
        "signaturePositionOnPageUpperRightX=600\n" +
        "signaturePositionOnPageUpperRightY=150\n" +
        "layer2Text=Firmado por $$SUBJECTCN$$ el día $$SIGNDATE=dd/MM/yyyy$$ con un certificado emitido por $$ISSUERCN$$\n" +
        "layer2FontSize=11\n" +
        "layer2FontColorRGB=255,0,0\n";
      
      console.log('⚙️ Parámetros AutoScript:', {
        fileName: documento.fileName,
        base64Length: pdfBase64.length,
        format: "PAdES",
        algorithm: "SHA256withRSA",
        extraParams: extraParamsString
      });
      
      // ✅ Usar setTimeout con delay 0 para preservar el contexto de "user gesture"
      // cuando se llama a AutoScript.sign(), que internamente inicia el WebSocket
      // Esto asegura que Chrome considere la conexión WebSocket como iniciada por acción directa del usuario
      setTimeout(() => {
        // Llamar AutoScript.sign() con parámetros separados
        if (typeof window !== 'undefined' && window.AutoScript) {
          window.AutoScript.sign(
          pdfBase64,           // dataB64 - string Base64
          "SHA256withRSA",     // algorithm
          "PAdES",             // format
          extraParamsString,   // extraParams - string
          (result) => {
        console.log("✅ Documento firmado:", result);
        
        // Descargar el documento firmado
        const blob = new Blob([Uint8Array.from(atob(result), c => c.charCodeAt(0))], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = documento.fileName.replace('.pdf', '_SIGNED.pdf');
        a.click();
        URL.revokeObjectURL(url);
        
        // Skip real backend call in DEMO mode
        if (authUser?.isDemo) {
          console.log('🎭 DEMO mode: Skipping AutoFirma webhook call');
          setNotification({
            type: 'success',
            title: 'Document Semnat (DEMO)',
            message: 'El documento ha sido firmado con éxito, descargado y enviado al servidor! (Simulación DEMO)'
          });
          setLoading(false);
          return;
        }
        
        // 🚀 ENVIAR AUTOMÁTICAMENTE AL BACKEND
        console.log('🚀 Documento firmado, enviando automáticamente al backend...');
        const payload = {
          "doc_id": documento.doc_id,
          "id": authUser?.CODIGO,
          "correo_electronico": authUser?.['CORREO ELECTRONICO'] || authUser?.email || authUser?.CORREO_ELECTRONICO || '',
          "tipo_documento": documento.tipo_documento || documento.tipo || 'Documento',
          "nombre_archivo": documento.fileName.replace('.pdf', '_FIRMADO_DIGITAL.pdf'),
          "nombre_empleado": authUser?.['NOMBRE / APELLIDOS'],
          "fecha_creacion": new Date().toISOString(),
          "mime": "application/pdf",
          "signed_b64": result
        };
        
        // Obtener token JWT para autenticación
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        fetch(routes.autofirmaWebhook, {
          method: 'POST',
          headers: headers,
          credentials: 'include',
          body: JSON.stringify(payload)
        })
        .then(response => {
          console.log('📥 Răspuns de la backend:', response.status, response.statusText);
          return response.json();
        })
        .then(data => {
          console.log('✅ Document trimis cu succes la backend:', data);
        setNotification({
          type: 'success',
            title: 'Document Semnat și Trimis',
            message: 'El documento ha sido firmado con éxito, descargado y enviado al servidor!'
          });
        })
        .catch(error => {
          console.error('❌ Error al enviar al backend:', error);
          setNotification({
            type: 'warning',
            title: 'Documento Firmado',
            message: 'El documento ha sido firmado y descargado, pero hubo un error al enviarlo al servidor.'
          });
        })
        .finally(() => {
          // Ocultar loading solo después de que termine el envío
          setLoading(false);
        });
        }, (error) => {
          console.error('❌ Error al firmar:', error);
          console.error('❌ Error details:', {
            error,
            errorType: typeof error,
            errorString: String(error),
            errorStack: error?.stack
          });
          
          // Detectăm dacă eroarea este legată de conexiunea la AutoFirma
          const errorMessage = String(error || '');
          const errorLower = errorMessage.toLowerCase();
          
          const isConnectionError = errorLower.includes('java.lang.exception') || 
                                   errorLower.includes('websocket') ||
                                   errorLower.includes('connection') ||
                                   errorLower.includes('failed') ||
                                   errorLower.includes('applicationnotfoundexception') ||
                                   errorLower.includes('timeout') ||
                                   errorLower.includes('econnrefused');
          
          const isWebSocketError = errorLower.includes('websocket') || errorLower.includes('wss://');
          const isJavaException = errorLower.includes('java.lang');
          
          if (isConnectionError || isWebSocketError) {
            let detailedMessage = 'No se pudo conectar con AutoFirma.\n\n';
            
            if (isWebSocketError) {
              detailedMessage += '🔌 Error de conexión WebSocket detectado.\n\n';
            }
            
            if (isJavaException) {
              detailedMessage += '⚠️ AutoFirma se abrió pero no pudo procesar la solicitud.\n\n';
            }
            
            detailedMessage += 'Por favor:\n';
            detailedMessage += '1. Verifica que AutoFirma esté instalado correctamente\n';
            detailedMessage += '2. Cierra AutoFirma si está abierto y vuelve a intentar\n';
            detailedMessage += '3. Verifica que no haya bloqueadores de ventanas emergentes\n';
            detailedMessage += '4. Si el problema persiste, reinicia AutoFirma desde el menú Inicio\n';
            detailedMessage += '5. Asegúrate de que el firewall no esté bloqueando AutoFirma';
            
            setNotification({
              type: 'error',
              title: 'Error de conexión con AutoFirma',
              message: detailedMessage
            });
          } else {
            setNotification({
              type: 'error',
              title: 'Error al Firmar',
              message: `Hubo un error al firmar el documento.\n\nDetalles: ${errorMessage}\n\nPor favor, intenta nuevamente o contacta con el administrador si el problema persiste.`
            });
          }
          setLoading(false); // Ocultar loading también en caso de error
        }
        );
        } else {
          console.error('❌ window.AutoScript no está disponible después de fetch');
          setNotification({
            type: 'error',
            title: 'Error',
            message: 'AutoScript no está disponible. Por favor, recarga la página.'
          });
          setLoading(false);
        }
      }, 0); // ✅ setTimeout con delay 0 preserva el contexto de "user gesture" para WebSocket
      
      setNotification({
        type: 'info',
        title: 'Firma en Progreso',
        message: 'Se está abriendo AutoFirma para firmar...'
      });
      
      } catch (error) {
        console.error('❌ Error al firmar con AutoScript:', error);
        setNotification({
          type: 'error',
          title: 'Error',
          message: 'Hubo un error al descargar el PDF.'
        });
        setLoading(false);
      }
    }); // ✅ requestAnimationFrame preserva el contexto de "user gesture" para WebSocket
  };

  // Función helper legacy para firmar con AutoFirma (ahora noop)
  const handleSignAutoFirma = useCallback(async () => {
    console.warn('handleSignAutoFirma legacy ya no se utiliza');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__documentosAutoFirma = handleSignAutoFirma;
    return () => {
      if (window.__documentosAutoFirma === handleSignAutoFirma) {
        delete window.__documentosAutoFirma;
      }
    };
  }, [handleSignAutoFirma]);

  const handleSignWithAutoFirmaOficial = async (documento) => {
    console.log('🚀 FUNCIÓN handleSignWithAutoFirmaOficial HA SIDO LLAMADA!');
    console.log('📄 Documento recibido:', documento);
    
    // Verificar si es dispositivo móvil
    if (isMobileDevice()) {
      setNotification({
        type: 'info',
        title: '📱 Dispositivo Móvil Detectado',
        message: 'Para firmar digitalmente con AutoFirma, te recomendamos usar un ordenador o la versión móvil de la aplicación. AutoFirma funciona mejor en dispositivos de escritorio.'
      });
      return;
    }
    
    // Usar la nueva función AutoScript
    await handleSignWithAutoScript(documento);
    return;
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Skip real data fetch in DEMO mode
        if (authUser?.isDemo) {
          console.log('🎭 DEMO mode: Using demo documentos data instead of fetching from backend');
          setDemoDocumentos();
          setLoading(false);
          return;
        }
        
        await Promise.all([
          fetchNominas(),
          fetchDocumentos(),
          fetchDocumentosOficiales()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
    
    // Log acceso a la página
    activityLogger.logPageAccess('documentos', authUser);
  }, [email, authUser, fetchNominas, fetchDocumentos, fetchDocumentosOficiales, authUser?.isDemo]);

  const handleUpload = (tip) => {
    // Establecer el tipo de documento
    setDocumentType(tip);
    
    // Siempre abrir el modal para elegir la fuente (cámara, galería, archivo)
    setShowCustomTypeSourceModal(true);
  };

  const handleWebFileChange = async (event, tip) => {
    if (!event || !event.target || !event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    if (file) {
      setUploading(true);
      
      // Genera un ID único para el documento
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Crear FormData con el mismo formato que usa el supervisor
      const formData = new FormData();
      
      // Agregar el archivo
      formData.append('archivo_0', file);
      
      // Agregar metadatos del empleado (usando los datos del usuario autenticado)
      formData.append('empleado_id', authUser?.CODIGO || authUser?.id || 'N/A');
      formData.append('empleado_nombre', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre');
      formData.append('empleado_email', authUser?.['CORREO ELECTRONICO'] || authUser?.email || '');
      formData.append('tipo_documento', tip); // Usar el tipo recibido como parámetro
      formData.append('fecha_upload', new Date().toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Madrid'
      }));
      formData.append('status', 'pendiente');
      formData.append('uploaded_by', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Empleado');
      formData.append('uploaded_by_id', authUser?.CODIGO || authUser?.id || 'N/A');
      formData.append('uploaded_by_role', authUser?.GRUPO || authUser?.role || 'EMPLEADOS');
      
      // Agregar información adicional del empleado
      formData.append('empleado_grupo', authUser?.GRUPO || '');
      formData.append('empleado_centro', authUser?.['CENTRO TRABAJO'] || authUser?.CENTRO || '');
      formData.append('empleado_departamento', authUser?.DEPARTAMENTO || '');
      
      // Agregar metadatos del archivo
      formData.append('total_archivos', '1');
      formData.append('archivo_0_nombre', file.name);
      formData.append('archivo_0_tamaño', file.size.toString());
      formData.append('archivo_0_tipo', file.type);
      formData.append('archivo_0_ultima_modificacion', new Date(file.lastModified).toISOString());
      
      try {
        // Skip real upload in DEMO mode
        if (authUser?.isDemo) {
          console.log('🎭 DEMO mode: Simulating document upload instead of sending to backend');
          
          // Simulate successful upload
          setNotification({
            type: 'success',
            title: '¡Éxito! (DEMO)',
            message: '¡Documento subido correctamente! (Simulación DEMO)'
          });
          
          setUploading(false);
          return;
        }
        
        console.log('🌐 Enviando documento al endpoint de PRODUCCIÓN:', routes.uploadDocumento);
        console.log('📤 Datos enviados:', {
          empleado: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name,
          tipo: tip,
          archivo: file.name,
          empleado_id: authUser?.CODIGO || authUser?.id,
          empleado_email: authUser?.['CORREO ELECTRONICO'] || authUser?.email
        });
        
        // Enviamos el documento al endpoint principal
        const response = await fetch(routes.uploadDocumento, {
          method: 'POST',
          body: formData,
          // No incluir Content-Type header, dejar que el navegador lo establezca automáticamente para FormData
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Respuesta del backend:', result);
          
          // Log cargar el documento
          await activityLogger.logDocumentoUploaded({
            id: documentId,
            tip: tip,
            fileName: file.name,
            fileSize: file.size,
            email: email
          }, authUser);
          
          setNotification({
            type: 'success',
            title: '¡Éxito!',
            message: '¡Documento subido correctamente!'
          });
        } else {
          // Mensaje de error más amigable
          if (response.status === 500) {
            setNotification({
              type: 'error',
              title: 'Error del Servidor',
              message: 'Error del servidor. Por favor, inténtalo más tarde.'
            });
          } else if (response.status === 0 || response.statusText.includes('CORS')) {
            setNotification({
              type: 'error',
              title: 'Error de Conexión',
              message: 'Error de conexión. Verifica tu conexión a internet.'
            });
          } else {
            setNotification({
              type: 'error',
              title: 'Error',
              message: `Error al subir el documento: ${response.status}`
            });
          }
        }
      } catch (e) {
        console.error('❌ Error subiendo documento:', e);
        
        // Mensaje de error específico para CORS
        if (e.message.includes('CORS') || e.message.includes('blocked')) {
          setNotification({
            type: 'error',
            title: 'Error de CORS',
            message: 'Error de CORS. El servidor no permite esta operación.'
          });
        } else {
          setNotification({
            type: 'error',
            title: 'Error de Conexión',
            message: `Error de conexión: ${e.message}`
          });
        }
      }
      setUploading(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Error: ¡email faltante!
          </h1>
          <p className="text-gray-600">
            No se pudo identificar al usuario.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-6xl">✍️</span>
          </div>
          <div className="animate-pulse">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">AutoFirma</h2>
            <p className="text-gray-500">Preparando documentos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            {error}
          </h1>
          <Button
            onClick={fetchNominas}
            variant="primary"
            size="lg"
          >
            Inténtalo de nuevo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar al Dashboard" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Gestión de Documentos
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              Administra nóminas, contratos y documentos personales
            </p>
          </div>
        </div>
      </div>

      {/* Botón Reportar Error */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de documentos', '_blank')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <span className="text-base">📱</span>
          Reportar error
        </button>
      </div>

      {/* Tabs de navegación - Modernos */}
      <div className="card">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-6">
          <button
            onClick={() => setActiveTab('nominas')}
            className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'nominas'
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:bg-green-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'nominas' 
                ? 'bg-green-400 opacity-30 blur-md animate-pulse' 
                : 'bg-green-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="relative flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span>Nóminas</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('mis-documentos')}
            className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'mis-documentos'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'mis-documentos' 
                ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="relative flex items-center gap-2">
              <span className="text-xl">📁</span>
              <span>Mis Documentos</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('contrato-documentos')}
            className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'contrato-documentos'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'contrato-documentos' 
                ? 'bg-purple-400 opacity-30 blur-md animate-pulse' 
                : 'bg-purple-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="relative flex items-center gap-2">
              <span className="text-xl">📋</span>
              <span>Documentos Oficiales</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('upload-documentos')}
            className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'upload-documentos'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200'
                : 'bg-white text-orange-600 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'upload-documentos' 
                ? 'bg-orange-400 opacity-30 blur-md animate-pulse' 
                : 'bg-orange-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="relative flex items-center gap-2">
              <span className="text-xl">📤</span>
              <span>Upload Documentos</span>
            </div>
          </button>
        </div>

                 {/* Contenido de tabs */}
         <div className="p-4 sm:p-6">
           {activeTab === 'nominas' && (
             <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl sm:text-2xl">💰</span>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Nóminas Disponibles</h2>
                    <p className="text-gray-600 text-xs sm:text-sm">Recibos de sueldo y documentos salariales</p>
                  </div>
                </div>
                
                {/* Text legal pentru livrarea nóminelor */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>📋 Información Legal:</strong> Esta aplicación es el canal oficial 
                    de entrega de nóminas. Al acceder a tu cuenta, aceptas que las nóminas 
                    están disponibles y puestas a tu disposición. Todas las acciones de acceso 
                    y descarga son registradas para cumplimiento legal.
                  </p>
                </div>
                
                 <button
                   onClick={fetchNominas}
                   disabled={nominasLoading}
                   className="group relative px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                 >
                   {/* Glow effect */}
                   <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                   <div className="relative flex items-center gap-2">
                     {nominasLoading ? (
                       <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                     ) : (
                       <span className="text-lg">🔄</span>
                     )}
                     <span>Actualizar</span>
                   </div>
                 </button>
               </div>
              
              {nominasLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" text="Cargando nóminas..." />
                </div>
              ) : nominas.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-300 text-8xl mb-6">💰</div>
                  <h3 className="text-2xl font-bold text-gray-600 mb-3">No se encontraron nóminas</h3>
                  <p className="text-gray-500 text-lg mb-2">No hay nóminas disponibles para tu usuario</p>
                  <p className="text-gray-400 text-sm">Las nóminas aparecerán aquí cuando estén disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {nominas.map((item, idx) => (
                    <div key={item.id || idx} 
                         className="group relative bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-200 hover:border-green-300 overflow-hidden">
                      {/* Header card */}
                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 sm:p-4 border-b border-green-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                            <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">💰</span>
                          </div>
                          <div className="flex-1">
                            {(item.mes || item.luna || item.month || item.periodo) && (item.año || item.ano || item.an || item.year) ? (
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-800 transition-colors duration-300 truncate overflow-hidden" title={`${item.mes || item.luna || item.month || item.periodo} / ${item.año || item.ano || item.an || item.year}`}>
                                {item.mes || item.luna || item.month || item.periodo} / {item.año || item.ano || item.an || item.year}
                            </h3>
                            ) : (
                              <h3 className="text-lg font-bold text-gray-700 group-hover:text-green-800 transition-colors duration-300">
                                Nómina Disponible
                              </h3>
                            )}
                            <p className="text-sm text-green-600 font-medium">Recibo de sueldo</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-3 sm:p-4">
                        {item.fileName && (
                          <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-600 mb-1">📄 Archivo:</label>
                            <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                              {item.fileName}
                            </p>
                          </div>
                        )}
                        
                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => handlePreviewDocument(item)}
                              className="flex-1 group relative px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                            >
                              <div className="absolute inset-0 rounded-lg bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                              <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                                <span className="text-xs sm:text-sm">👁️</span>
                                <span className="text-xs sm:text-sm">Preview</span>
                              </div>
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('auth_token');
                                  const userEmail = authUser?.email || authUser?.['CORREO ELECTRONICO'] || '';
                                  const userName = authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || '';
                                  
                                  if (!userEmail) {
                                    setNotification({
                                      type: 'error',
                                      title: 'Error',
                                      message: 'No se encontró tu email. Por favor, contacta con RRHH.'
                                    });
                                    return;
                                  }

                                  setNotification({
                                    type: 'info',
                                    title: 'Enviando...',
                                    message: 'Enviando nómina por correo electrónico...'
                                  });

                                  const response = await fetch(routes.sendNominaByEmail(item.id), {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': token ? `Bearer ${token}` : '',
                                    },
                                    body: JSON.stringify({
                                      email: userEmail,
                                      nombre: userName,
                                    }),
                                  });

                                  if (!response.ok) {
                                    const errorData = await response.json();
                                    throw new Error(errorData.message || 'Error al enviar email');
                                  }

                                  await response.json();
                                  setNotification({
                                    type: 'success',
                                    title: '✅ Email Enviado',
                                    message: `Tu nómina ha sido enviada a ${userEmail}`
                                  });
                                } catch (error) {
                                  console.error('❌ Error enviando nómina por email:', error);
                                  setNotification({
                                    type: 'error',
                                    title: 'Error',
                                    message: error.message || 'Error al enviar la nómina por email'
                                  });
                                }
                              }}
                              className="flex-1 group relative px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200"
                            >
                              <div className="absolute inset-0 rounded-lg bg-purple-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                              <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                                <span className="text-xs sm:text-sm">📧</span>
                                <span className="text-xs sm:text-sm">Enviar por correo</span>
                              </div>
                            </button>
                            <button
                            onClick={async () => {
                            try {
                            // Log descargar nómina
                            await activityLogger.logAction('nomina_downloaded', {
                                luna: item.mes,
                                an: item.año || item.ano || item.an || item.year,
                                fileName: item.fileName,
                              user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
                              email: authUser?.email
                            });
                            
                              // Construir URL para descarga con parámetros correctos
                              const downloadUrl = `${routes.downloadNomina}?id=${item.id}&nombre=${encodeURIComponent(authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || '')}`;
                              
                              console.log('📥 Download para nómina:', downloadUrl);
                              console.log('🔍 Parámetros enviados:', { 
                                id: item.id, 
                                nombre: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name 
                              });
                              
                              // Add JWT token for backend API calls
                              const token = localStorage.getItem('auth_token');
                              const fetchHeaders = {};
                              if (token) {
                                fetchHeaders['Authorization'] = `Bearer ${token}`;
                              }
                              
                              // Descarga directamente
                              const response = await fetch(downloadUrl, { headers: fetchHeaders });
                              if (response.ok) {
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = item.fileName || `nómina_${item.mes}_${item.año || item.ano || item.an || item.year}.pdf`;
                                a.style.display = 'none';
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } else {
                                setNotification({
                                  type: 'error',
                                  title: 'Error de Descarga',
                                  message: 'No se pudo descargar la nómina'
                                });
                              }
                            } catch (error) {
                              console.error('❌ Error descargando nómina:', error);
                              setNotification({
                                type: 'error',
                                title: 'Error de Descarga',
                                message: 'Error al descargar la nómina'
                              });
                            }
                          }}
                            className="flex-1 group relative px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                          >
                            <div className="absolute inset-0 rounded-lg bg-red-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                            <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                              <span className="text-xs sm:text-sm">📄</span>
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
          )}

                               {activeTab === 'mis-documentos' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl sm:text-2xl">📁</span>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Mis Documentos</h2>
                    <p className="text-gray-600 text-xs sm:text-sm">Archivos y documentos personales</p>
                  </div>
                </div>
                <button
                  onClick={fetchDocumentos}
                  disabled={documentosLoading}
                  className="group relative px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  <div className="relative flex items-center gap-2">
                    {documentosLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span className="text-lg">🔄</span>
                    )}
                    <span>Actualizar</span>
                  </div>
                </button>
              </div>
              
              {documentosLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" text="Cargando documentos..." />
                </div>
              ) : documentos.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <div className="text-gray-300 text-8xl mb-6">📁</div>
                  <h3 className="text-2xl font-bold text-gray-600 mb-3">No hay documentos</h3>
                  <p className="text-gray-500 text-lg mb-2">No tienes documentos subidos en la base de datos</p>
                  <p className="text-gray-400 text-sm">Los documentos aparecerán aquí cuando los subas</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {documentos.map((documento, idx) => {
                    return (
                      <div key={`${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} 
                           className="group relative bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-200 hover:border-blue-300 overflow-hidden">
                        {/* Header card */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 sm:p-4 border-b border-blue-200">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                              <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">📄</span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-800 transition-colors duration-300 break-all overflow-wrap-anywhere leading-tight max-w-full" style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}} title={documento.fileName || `Documento ${idx + 1}`}>
                                {documento.fileName || `Documento ${idx + 1}`}
                              </h3>
                              <p className="text-sm text-blue-600 font-medium">{documento.tipo || 'Documento personal'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-4">
                          <div className="space-y-3 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">📅 Fecha de subida:</label>
                              <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                                {formatDate(documento.uploadDate)}
                              </p>
                            </div>
                            
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">🆔 ID:</label>
                                <p className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border">
                                  {documento.id || 'N/A'}
                                </p>
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">📋 Doc ID:</label>
                                <p className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border">
                                  {documento.doc_id || 'N/A'}
                                </p>
                              </div>
                            </div>
                            
                            {documento.status && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">⚡ Estado:</label>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  documento.status === 'aprobado' 
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : documento.status === 'rechazado'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                }`}>
                                  {documento.status === 'aprobado' ? '✅ Aprobado' : 
                                   documento.status === 'rechazado' ? '❌ Rechazado' : '⏳ Pendiente'}
                                </span>
                              </div>
                            )}
                          </div>
                           
                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePreviewDocument(documento)}
                              className="flex-1 group relative px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                            >
                              <div className="absolute inset-0 rounded-lg bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                              <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                                <span className="text-xs sm:text-sm">👁️</span>
                                <span className="text-xs sm:text-sm">Preview</span>
                              </div>
                            </button>
                            
                            <button
                                 onClick={async () => {
                                   try {
                                     // Log descargar documento
                                     await activityLogger.logAction('documento_downloaded', {
                                       documento_id: documento.id,
                                       nombre_archivo: documento.fileName,
                                       tipo_documento: documento.tipo,
                                       user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
                                       email: authUser?.email
                                     });
                                     
                                     // Hacemos GET request con el ID del documento, email y nombre del archivo
                                     const downloadUrl = `${routes.downloadDocumento}?id=${documento.id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}`;
                                     
                                     console.log('🔍 DEBUG DOWNLOAD LISTA - Valores enviados:');
                                     console.log('  documento.id (empleado_id):', documento.id);
                                     console.log('  documento.doc_id (document_id):', documento.doc_id);
                                     console.log('  documento.fileName:', documento.fileName);
                                     console.log('  email:', email);
                                     console.log('  downloadUrl:', downloadUrl);
                                     
                                                                            // Add JWT token for backend API calls
                                     const token = localStorage.getItem('auth_token');
                                     const fetchHeaders = {
                                       'Accept': 'application/pdf, application/json',
                                     };
                                     if (token) {
                                       fetchHeaders['Authorization'] = `Bearer ${token}`;
                                     }
                                     
                                     // Descargar directamente en lugar de abrir en nueva pestaña
                                     try {
                                       const response = await fetch(downloadUrl, {
                                         method: 'GET',
                                         headers: fetchHeaders
                                       });

                                       if (response.ok) {
                                         const blob = await response.blob();
                                         const url = window.URL.createObjectURL(blob);
                                         const a = document.createElement('a');
                                         a.href = url;
                                         a.download = documento.fileName || `${documento.tipo || 'documento'}_${documento.id}.pdf`;
                                         a.style.display = 'none';
                                         document.body.appendChild(a);
                                         a.click();
                                         window.URL.revokeObjectURL(url);
                                         document.body.removeChild(a);
                                       } else {
                                         setNotification({
                                           type: 'error',
                                           title: 'Error de Descarga',
                                           message: 'Error al descargar el documento. Por favor, inténtalo más tarde.'
                                         });
                                       }
                                     } catch (downloadError) {
                                       console.error('❌ Error downloading document:', downloadError);
                                       setNotification({
                                         type: 'error',
                                         title: 'Error de Descarga',
                                         message: 'Error al descargar el documento. Por favor, inténtalo más tarde.'
                                       });
                                     }
                                   } catch (error) {
                                     console.error('❌ Error logging document download:', error);
                                     // Continúa con la descarga aunque el logging falle
                                     try {
                                       const downloadUrl = `${routes.downloadDocumento}?id=${documento.id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}`;
                                       
                                       console.log('🔍 DEBUG DOWNLOAD LISTA 2 - Valores enviados:');
                                       console.log('  documento.id (empleado_id):', documento.id);
                                       console.log('  documento.doc_id (document_id):', documento.doc_id);
                                       console.log('  documento.fileName:', documento.fileName);
                                       console.log('  email:', email);
                                       console.log('  downloadUrl:', downloadUrl);
                                       
                                       // Add JWT token for backend API calls
                                       const token = localStorage.getItem('auth_token');
                                       const fetchHeaders = {
                                         'Accept': 'application/pdf, application/json',
                                       };
                                       if (token) {
                                         fetchHeaders['Authorization'] = `Bearer ${token}`;
                                       }
                                       
                                       const response = await fetch(downloadUrl, {
                                         method: 'GET',
                                         headers: fetchHeaders
                                       });

                                       if (response.ok) {
                                         const blob = await response.blob();
                                         const url = window.URL.createObjectURL(blob);
                                         const a = document.createElement('a');
                                         a.href = url;
                                         a.download = documento.fileName || `${documento.tipo || 'documento'}_${documento.id}.pdf`;
                                         a.style.display = 'none';
                                         document.body.appendChild(a);
                                         a.click();
                                         window.URL.revokeObjectURL(url);
                                         document.body.removeChild(a);
                                       } else {
                                         setNotification({
                                           type: 'error',
                                           title: 'Error de Descarga',
                                           message: 'Error al descargar el documento. Por favor, inténtalo más tarde.'
                                         });
                                       }
                                     } catch (downloadError) {
                                       console.error('❌ Error downloading document:', downloadError);
                                       setNotification({
                                         type: 'error',
                                         title: 'Error de Descarga',
                                         message: 'Error al descargar el documento. Por favor, inténtalo más tarde.'
                                       });
                                     }
                                   }
                                 }}
                              className="flex-1 group relative px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                            >
                              <div className="absolute inset-0 rounded-lg bg-red-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                              <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                                <span className="text-xs sm:text-sm">📥</span>
                                <span className="text-xs sm:text-sm">Descargar</span>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                       );
                     })}
                    

                  </div>
                )}
            </div>
          )}

          {activeTab === 'contrato-documentos' && (
            <div>
              {/* Header pentru Documentos Oficiales */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-2xl">📋</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Documentos Oficiales</h2>
                  <p className="text-gray-600 text-sm">Contratos, certificados y documentos legales</p>
                </div>
              </div>
              
              {/* Buton Actualizar separat, deasupra listei */}
              <div className="flex justify-center mb-6">
                <button
                  onClick={fetchDocumentosOficiales}
                  disabled={documentosOficialesLoading}
                  className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  <div className="relative flex items-center gap-2">
                    {documentosOficialesLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span className="text-lg">🔄</span>
                    )}
                    <span>Actualizar</span>
                  </div>
                </button>
              </div>
              
              {documentosOficialesLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" text="Cargando documentos oficiales..." />
                </div>
              ) : documentosOficialesError ? (
                <div className="text-center py-12">
                  <div className="text-red-300 text-8xl mb-6">❌</div>
                  <h3 className="text-2xl font-bold text-red-600 mb-3">Error al cargar documentos oficiales</h3>
                  <p className="text-gray-600 text-lg mb-4">{documentosOficialesError}</p>
                  <button
                    onClick={fetchDocumentosOficiales}
                    className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                  >
                    <div className="absolute inset-0 rounded-xl bg-red-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                    <div className="relative flex items-center gap-2">
                      <span className="text-lg">🔄</span>
                      <span>Reintentar</span>
                    </div>
                  </button>
                </div>
              ) : documentosOficiales.filter(documento => {
                  const tipo = (documento.tipo || '').toLowerCase();
                  return tipo.includes('contrato') || tipo.includes('certificado');
                }).length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-300 text-8xl mb-6">📋</div>
                  <h3 className="text-2xl font-bold text-gray-600 mb-3">No se encontraron documentos oficiales</h3>
                  <p className="text-gray-500 text-lg mb-2">No hay documentos de tipo contrato o certificado disponibles</p>
                  <p className="text-gray-400 text-sm">Los documentos oficiales aparecerán aquí cuando estén disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

                    {documentosOficiales
                      .filter(documento => {
                        const tipo = (documento.tipo || '').toLowerCase();
                        return tipo.includes('contrato') || tipo.includes('certificado');
                      })
                      .map((documento, idx) => (
                      <div key={`${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} 
                           className="group relative bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-200 hover:border-purple-300 overflow-hidden">
                        {/* Header card */}
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 border-b border-purple-200">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                              <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">📋</span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-bold text-gray-900 group-hover:text-purple-800 transition-colors duration-300 break-all overflow-wrap-anywhere leading-tight max-w-full" style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}} title={documento.fileName || `Documento Oficial ${idx + 1}`}>
                                {documento.fileName || `Documento Oficial ${idx + 1}`}
                              </h3>
                              <p className="text-sm text-purple-600 font-medium">{documento.tipo || 'Documento oficial'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-4">
                          <div className="space-y-3 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">📅 Fecha:</label>
                              <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                                {formatDate(documento.uploadDate)}
                              </p>
                            </div>
                            
                            {documento.fileSize > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">📊 Tamaño:</label>
                                <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border">
                                  {(documento.fileSize / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">🆔 ID:</label>
                                <p className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border">
                                  {documento.id || 'N/A'}
                                </p>
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">📋 Doc ID:</label>
                                <p className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border">
                                  {documento.doc_id || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex gap-2 mb-2">
                            <button
                              onClick={() => handlePreviewDocumentOficial(documento)}
                              className="flex-1 group relative px-3 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                            >
                              <div className="absolute inset-0 rounded-lg bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                              <div className="relative flex items-center justify-center gap-1">
                                <span className="text-xs">👁️</span>
                                <span className="text-xs">Preview</span>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => handleDownloadDocumentOficial(documento)}
                              className="flex-1 group relative px-3 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200"
                            >
                              <div className="absolute inset-0 rounded-lg bg-green-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                              <div className="relative flex items-center justify-center gap-1">
                                <span className="text-xs">⬇️</span>
                                <span className="text-xs">Descargar</span>
                              </div>
                            </button>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                console.log('🖱️ BOTÓN AUTOFIRMA HA SIDO PRESIONADO!');
                                console.log('📄 Documento para AutoFirma:', documento);
                                handleSignWithAutoFirmaOficial(documento);
                              }}
                              className="flex-1 group relative px-3 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200"
                            >
                              <div className="absolute inset-0 rounded-lg bg-purple-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                              <div className="relative flex items-center justify-center gap-1">
                                <span className="text-xs">✍️</span>
                                <span className="text-xs">AutoFirma</span>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

           {activeTab === 'upload-documentos' && (
             <div>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
                 <div className="flex items-center gap-3 sm:gap-4">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                     <span className="text-white text-xl sm:text-2xl">📤</span>
                   </div>
                   <div>
                     <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Upload Documentos</h2>
                     <p className="text-gray-600 text-xs sm:text-sm">Sube tus documentos personales de forma segura</p>
                   </div>
                 </div>
               </div>
               
               {/* FORMULAR ÚNICO ULTRA MODERN */}
               <div className="max-w-3xl mx-auto">
                 <div className="relative group">
                   {/* Glow effect */}
                   <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl opacity-20 group-hover:opacity-30 blur-xl transition-all duration-500"></div>
                   
                   <div className="relative bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-gray-200/50 rounded-3xl p-6 sm:p-8"
                        style={{ backdropFilter: 'blur(20px)' }}>
                     
                     {/* Header con icon */}
                     <div className="flex items-center gap-4 mb-8">
                       <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                         <span className="text-3xl">📄</span>
                           </div>
                       <div>
                         <h3 className="text-2xl font-black text-gray-900">Subir Documento Personal</h3>
                         <p className="text-sm text-gray-600 font-medium">Completa el formulario y sube tu documento</p>
                           </div>
                             </div>
                     
                     {/* Tipo de Documento */}
                     <div className="mb-6">
                       <label className="block text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                         <span className="text-xl">📋</span>
                         <span>Tipo de Documento *</span>
                       </label>
                       <select
                         value={documentType}
                         onChange={(e) => setDocumentType(e.target.value)}
                         className="w-full px-5 py-4 text-lg border-2 border-gray-300 rounded-2xl text-gray-800 bg-gradient-to-br from-white to-orange-50/30 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-300 hover:border-orange-300 shadow-lg focus:shadow-2xl focus:shadow-orange-500/30 font-medium cursor-pointer"
                       >
                         <option value="">Selecciona un tipo de documento...</option>
                         <option value="justificante_medico">🏥 Justificante Médico</option>
                         <option value="certificado_matrimonio">💍 Certificado de Matrimonio</option>
                         <option value="justificante_ausencia">📅 Justificante de Ausencia</option>
                         <option value="certificado_residencia">🏠 Certificado de Residencia</option>
                         <option value="certificado_trabajo">💼 Certificado de Trabajo</option>
                         <option value="otro">📎 Otro Documento</option>
                       </select>
                         </div>
                     
                     {/* Campo de texto personalizado si selecciona "Otro" */}
                     {documentType === 'otro' && (
                       <div className="mb-6">
                         <label className="block text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                           <span className="text-xl">✍️</span>
                           <span>Especifica el Tipo de Documento *</span>
                         </label>
                         <input
                           type="text"
                           value={customDocumentType}
                           onChange={(e) => setCustomDocumentType(e.target.value)}
                           placeholder="Ej: Certificado de Estudios, Carta de Recomendación..."
                           className="w-full px-5 py-4 text-lg border-2 border-gray-300 rounded-2xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 hover:border-purple-300 shadow-lg focus:shadow-2xl focus:shadow-purple-500/30 font-medium"
                         />
                       </div>
                     )}
                     
                     {/* Formatos aceptados */}
                     <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                       <label className="block text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                         <span className="text-lg">📎</span>
                         <span>Formatos Aceptados</span>
                       </label>
                       <div className="flex flex-wrap gap-2">
                         {['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp'].map(format => (
                           <span key={format} className="px-3 py-2 bg-white text-blue-700 text-sm font-bold rounded-lg border-2 border-blue-300 shadow-sm">
                                 {format}
                           </span>
                         ))}
                           </div>
                         </div>
                         
                     {/* Botón MEGA WOW para subir */}
                         <button
                       onClick={() => {
                         if (!documentType) {
                           setNotification({
                             type: 'warning',
                             title: 'Campo Requerido',
                             message: 'Por favor, selecciona un tipo de documento'
                           });
                           return;
                         }
                         if (documentType === 'otro' && !customDocumentType.trim()) {
                           setNotification({
                             type: 'warning',
                             title: 'Campo Requerido',
                             message: 'Por favor, especifica el tipo de documento'
                           });
                           return;
                         }
                         handleUpload(documentType);
                       }}
                       disabled={uploading || !documentType}
                       className="group relative w-full px-8 py-5 rounded-2xl font-black text-white transition-all duration-700 transform hover:scale-110 hover:-translate-y-2 shadow-2xl hover:shadow-orange-500/50 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                       style={{
                         background: 'linear-gradient(135deg, #f97316 0%, #ea580c 30%, #c2410c 60%, #9a3412 100%)',
                         boxShadow: '0 20px 50px rgba(249, 115, 22, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.2)'
                       }}
                     >
                       {/* Animated glow ultra potente */}
                       <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 opacity-60 group-hover:opacity-90 blur-2xl transition-all duration-700 animate-pulse"></div>
                       
                       {/* Shimmer mega effect */}
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                       
                       {/* Particles effect */}
                       {!uploading && (
                         <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                           <div className="absolute top-2 left-8 w-2 h-2 bg-white rounded-full animate-ping"></div>
                           <div className="absolute bottom-3 right-10 w-1.5 h-1.5 bg-white rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                           <div className="absolute top-4 right-16 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                         </div>
                       )}
                       
                       {/* Content */}
                       <div className="relative flex items-center justify-center gap-3">
                             {uploading ? (
                               <>
                             <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                             <span className="text-lg">Subiendo Documento...</span>
                               </>
                             ) : (
                               <>
                             <span className="text-3xl transform group-hover:scale-125 group-hover:-rotate-12 transition-all duration-500">📤</span>
                             <div className="flex flex-col items-start">
                               <span className="text-xl tracking-wide">SUBIR DOCUMENTO</span>
                               <span className="text-xs opacity-90">Clic para seleccionar archivo</span>
                             </div>
                               </>
                             )}
                           </div>
                       
                       {/* Borde brillante animado */}
                       <div className="absolute inset-0 rounded-2xl border-2 border-white/30 group-hover:border-white/60 transition-all duration-700"></div>
                         </button>
                         
                         <input
                       ref={el => (fileInputRefs.current[documentType || 'default'] = el)}
                           type="file"
                           className="hidden"
                       onChange={e => handleWebFileChange(e, documentType)}
                           accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                         />
                       </div>
                 </div>
               </div>
             </div>
           )}
        </div>
      </div>


      {/* Componente de Notificaciones */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Modal para selecția sursei de fișier personalizat */}
      {showCustomTypeSourceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-200 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b border-orange-200 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-lg">📤</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Subir Documento</h3>
                    <p className="text-sm text-orange-600 font-medium">Selecciona una opción</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomTypeSourceModal(false)}
                  className="w-8 h-8 bg-white hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-lg flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
                >
                  <span className="text-gray-400 group-hover:text-orange-500 text-lg">✕</span>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Opțiunea pentru galerie */}
                <button
                  onClick={() => {
                    customFileInputRef.current?.click();
                    setShowCustomTypeSourceModal(false);
                  }}
                  className="w-full group relative px-6 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                >
                  <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  <div className="relative flex items-center justify-center gap-3">
                    <span className="text-2xl">📁</span>
                    <div className="text-left">
                      <div className="text-lg font-bold">Fototeca</div>
                      <div className="text-sm opacity-90">Seleccionar foto existente</div>
                    </div>
                  </div>
                </button>

                {/* Opțiunea pentru cameră */}
                <button
                  onClick={() => {
                    customCameraInputRef.current?.click();
                    setShowCustomTypeSourceModal(false);
                  }}
                  className="w-full group relative px-6 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200"
                >
                  <div className="absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  <div className="relative flex items-center justify-center gap-3">
                    <span className="text-2xl">📸</span>
                    <div className="text-left">
                      <div className="text-lg font-bold">Hacer foto</div>
                      <div className="text-sm opacity-90">Tomar nueva foto con cámara</div>
                    </div>
                  </div>
                </button>

                {/* Opțiunea pentru selecție fișier */}
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp';
                    input.onchange = (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const tipoFinal = documentType === 'otro' ? customDocumentType : documentType;
                        handleWebFileChange(e, tipoFinal);
                      }
                    };
                    input.click();
                    setShowCustomTypeSourceModal(false);
                  }}
                  className="w-full group relative px-6 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200"
                >
                  <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  <div className="relative flex items-center justify-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div className="text-left">
                      <div className="text-lg font-bold">Seleccionar Archivo</div>
                      <div className="text-sm opacity-90">Elegir archivo del dispositivo</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input-uri ascunse pentru modalul personalizat */}
      <input
        ref={customFileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            const tipoFinal = documentType === 'otro' ? customDocumentType : documentType;
            handleWebFileChange(e, tipoFinal);
            if (documentType === 'otro') {
            setCustomDocumentType('');
            }
          }
        }}
        className="hidden"
      />
      <input
        ref={customCameraInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        capture="environment"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            const tipoFinal = documentType === 'otro' ? customDocumentType : documentType;
            handleWebFileChange(e, tipoFinal);
            if (documentType === 'otro') {
            setCustomDocumentType('');
            }
          }
        }}
        className="hidden"
      />

      {/* Modal para Tipo Personalizado de Documento */}
      {showCustomTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                📝 Tipo de Documento Personalizado
              </h3>
              <button
                onClick={() => {
                  setShowCustomTypeModal(false);
                  setCustomDocumentType('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📋 Especificar Tipo de Documento *
                       </label>
                         <input
                           type="text"
                           placeholder="Ej: Certificado de Residencia, Certificado de Trabajo, etc."
                           value={customDocumentType}
                           onChange={(e) => setCustomDocumentType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                           required
                  autoFocus
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📁 Seleccionar Archivo
                </label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-red-400 transition-colors cursor-pointer"
                  onClick={() => {
                    if (customDocumentType && customDocumentType.trim()) {
                      setShowCustomTypeModal(false);
                      setShowCustomTypeSourceModal(true);
                    } else {
                      setNotification({
                        type: 'warning',
                        title: 'Campo Requerido',
                        message: 'Por favor, especifica el tipo de documento'
                      });
                    }
                  }}
                >
                  <div className="text-gray-400 mb-2">
                    <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Haz clic aquí para seleccionar un archivo
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, DOC, DOCX, JPG, PNG (máx. 10MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setShowCustomTypeModal(false);
                  setCustomDocumentType('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (customDocumentType && customDocumentType.trim()) {
                    if (fileInputRefs.current.customFile) {
                      fileInputRefs.current.customFile.click();
                    }
                  } else {
                    setNotification({
                      type: 'warning',
                      title: 'Campo Requerido',
                      message: 'Por favor, especifica el tipo de documento'
                    });
                  }
                }}
                disabled={!customDocumentType || !customDocumentType.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                📁 Seleccionar Archivo
              </button>
                 </div>
               </div>
             </div>
           )}

      {/* Modal de Preview - Modernizado */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in duration-300 relative">
            {/* Header moderno */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">👁️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 break-all leading-tight">
                      Vista Previa: {previewDocument?.fileName}
                    </h3>
                    <p className="text-sm text-blue-600 font-medium">Visualización de documento</p>
                  </div>
                </div>
                <button
                  onClick={handleClosePreview}
                  className="w-10 h-10 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
                >
                  <span className="text-gray-400 group-hover:text-red-500 text-xl">✕</span>
                </button>
              </div>
            </div>

            {previewLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50">
                <LoadingSpinner />
                <p className="text-gray-600 text-sm font-medium">Cargando vista previa...</p>
              </div>
            )}

            {previewError && (
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-red-600 text-sm font-semibold">
                {previewError}
              </div>
            )}

            <div className="p-4">

              {/* Contenido del documento */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {previewDocument?.fileName?.toLowerCase().endsWith('.txt') && previewDocument?.content ? (
                  <div className="p-4 bg-gray-50 max-h-[75vh] overflow-y-auto">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{previewDocument.content}</pre>
        </div>
                ) : previewDocument?.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <div className="p-4 bg-gray-50 max-h-[75vh] overflow-y-auto">
                    <img 
                      src={previewDocument?.previewUrl || ''}
                      alt={previewDocument.fileName}
                      className={`max-w-full h-auto mx-auto ${
                        isIOS ? 'brightness-100 contrast-100' : ''
                      }`}
                      style={{
                        ...(isIOS && {
                          filter: 'none',
                          WebkitFilter: 'none',
                          imageRendering: 'auto',
                          WebkitImageRendering: 'auto'
                        })
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div className="hidden text-center">
                      <p className="text-gray-600 mb-4">🖼️ Error al cargar la imagen</p>
                      <p className="text-sm text-gray-500">La imagen no se pudo cargar, usa el botón de descarga</p>
                    </div>
                  </div>
                ) : previewDocument?.fileName?.toLowerCase().endsWith('.pdf') && previewDocument?.esOficial && previewDocument?.tipo && (
                  previewDocument.tipo.toLowerCase().includes('contrato') || 
                  previewDocument.tipo.toLowerCase().includes('certificado') ||
                  previewDocument.tipo.toLowerCase().includes('oficial')
                ) ? (
                  <div className="pdf-preview-container">
                    <ContractSigner
                      pdfUrl={previewDocument?.previewUrl || ''}
                      docId={previewDocument?.id || ''}
                      fileName={previewDocument?.fileName || ''}
                      onClose={() => {
                        setShowPreviewModal(false);
                        setPreviewDocument(null);
                      }}
                      onSignComplete={async () => {
                        // Actualizar lista de documentos oficiales
                        await fetchDocumentosOficiales();
                        setShowPreviewModal(false);
                        setPreviewDocument(null);
                        setNotification({
                          type: 'success',
                          title: 'Documento Firmado',
                          message: 'El documento oficial ha sido firmado exitosamente'
                        });
                      }}
                    />
                  </div>
                ) : (previewDocument?.fileName?.toLowerCase().endsWith('.pdf') && previewDocument?.isPdf !== false) ? (
                  <div className="p-4 bg-gray-50 h-[75vh] pdf-preview-container">
                    {/* Android: PDF.js rendering | iOS: <object> | Desktop: <iframe> */}
                    {isAndroid || isIOS ? (
                      <PDFViewerAndroid 
                        pdfUrl={previewDocument?.previewUrl || ''} 
                        className="w-full h-full"
                      />
                    ) : (
                      <iframe
                        src={previewDocument?.previewUrl || ''}
                        className="w-full h-full border-0 rounded-lg"
                        title={previewDocument.fileName}
                      />
                    )}
                  </div>
                ) : (previewDocument?.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) || previewDocument?.isPdf === false) ? (
                  <div className="p-4 bg-gray-50 flex items-center justify-center min-h-[60vh]">
                    <div className="max-w-full max-h-[70vh] overflow-auto">
                      <img
                        src={previewDocument?.previewUrl || ''}
                        alt={previewDocument?.fileName}
                        className={`max-w-full h-auto rounded-lg shadow-2xl ${
                          isIOS ? 'brightness-100 contrast-100' : ''
                        }`}
                        style={{
                          ...(isIOS && {
                            filter: 'none',
                            WebkitFilter: 'none',
                            imageRendering: 'auto',
                            WebkitImageRendering: 'auto',
                            backgroundColor: 'transparent'
                          })
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const container = e.target.parentElement;
                          if (container) {
                            container.innerHTML = `
                              <div class="text-center py-12">
                                <div class="text-6xl mb-4">🖼️</div>
                                <p class="text-gray-600 mb-4">Error al cargar la imagen</p>
                                <p class="text-sm text-gray-500">Usa el botón de descarga para ver el archivo</p>
                              </div>
                            `;
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : previewDocument?.fileName?.toLowerCase().match(/\.(doc|docx)$/i) ? (
                  <div className="p-4 bg-gray-50 text-center py-12">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-gray-600 mb-4 font-bold">Documento Word disponible para descarga</p>
                    <p className="text-sm text-gray-500">Los archivos .doc/.docx se abren mejor con Microsoft Word o LibreOffice</p>
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Consejo:</strong> Descarga el archivo y ábrelo con tu aplicación de procesamiento de texto preferida
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 text-center py-12">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-gray-600 mb-4 font-bold">Documento disponible para descarga</p>
                    <p className="text-sm text-gray-500">Este tipo de archivo se muestra mejor al descargarlo</p>
                  </div>
                )}
              </div>



              {/* Butoanele de jos eliminate - se folosește doar X-ul din dreapta sus */}
            </div>
          </div>
        </div>
      )}

      {/* Buton pentru AutoFirma - click manual necesar */}
      {autoFirmaUrl && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-lg">✍️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">AutoFirma</h3>
                <p className="text-xs text-gray-600">Haz clic en 🚀 para abrir AutoFirma o en 📋 para copiar la URL</p>
              </div>
            </div>
            <div className="mt-3 flex space-x-2">
              <a
                href={autoFirmaUrl}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-md text-center transition-colors"
              >
                🚀 Semnează cu AutoFirma
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(autoFirmaUrl).then(() => {
                    alert('URL-ul AutoFirma a fost copiat în clipboard! Poți să-l deschizi manual în browser.');
                  }).catch(() => {
                    alert('URL-ul AutoFirma: ' + autoFirmaUrl);
                  });
                }}
                className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm transition-colors"
                title="Copiază URL-ul"
              >
                📋
              </button>
              <button
                onClick={() => setAutoFirmaUrl(null)}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 