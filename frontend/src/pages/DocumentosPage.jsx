import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { PageHeader, AlertBanner, SegmentedControl, Modal, Notification } from '../components/ui';
import {
  RefreshCw,
  Eye,
  Download,
  Mail,
  Upload,
  FileText,
  PenLine,
  MessageCircleWarning,
  Camera,
  Image as ImageIcon,
  Replace,
  X,
} from 'lucide-react';
import ContractSigner from '../components/ContractSigner';
import PRLDocumentSigner from '../components/PRLDocumentSigner';
import PRLAutoevaluacionModal from '../components/PRLAutoevaluacionModal';
import PRLAutoevaluacionResultModal from '../components/PRLAutoevaluacionResultModal';
import {
  resolvePrlManualFooterLayout,
  buildPrlManualFooterFields,
} from '../constants/prlManualPdfFooterFields.js';
import { isContratoDocumento } from '../constants/contratoPdfSignatureLayout.js';
import PDFViewerAndroid from '../components/PDFViewerAndroid';
import { routes } from '../utils/routes.js';
import { config } from '../config/env';
import activityLogger from '../utils/activityLogger';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';

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
  const [activeTab, setActiveTab] = useState('nominas'); // 'nominas', 'mis-documentos', 'contrato-documentos', 'prl-documentos', 'diplomas'
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

  // Estado para firmar documento oficial
  const [documentoOficialToSign, setDocumentoOficialToSign] = useState(null);
  const [documentoOficialPdfUrl, setDocumentoOficialPdfUrl] = useState(null);
  const [showOficialSigner, setShowOficialSigner] = useState(false);

  // Estado para notificaciones
  const [notification, setNotification] = useState(null);

  // Estado para el modal de tipo personalizado
  const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);
  const [showCustomTypeSourceModal, setShowCustomTypeSourceModal] = useState(false);
  
  // Estado para el modal de confirmación de reemplazo
  const [showReplaceConfirmModal, setShowReplaceConfirmModal] = useState(false);
  const [documentToReplace, setDocumentToReplace] = useState(null);

  // Estado para documentos oficiales
  const [documentosOficiales, setDocumentosOficiales] = useState([]);
  const [documentosOficialesLoading, setDocumentosOficialesLoading] = useState(false);
  const [documentosOficialesError, setDocumentosOficialesError] = useState(null);
  const [documentosOficialesNecesitanFirmaCount, setDocumentosOficialesNecesitanFirmaCount] = useState(0);

  // Estado para loading de documentos personales
  const [documentosLoading, setDocumentosLoading] = useState(false);

  // Estado para loading de nóminas
  const [nominasLoading, setNominasLoading] = useState(false);

  // Estado para documentos solicitados
  const [documentosSolicitados, setDocumentosSolicitados] = useState([]);

  // Estado para documentos PRL
  const [documentosPRL, setDocumentosPRL] = useState([]);
  const [documentosPRLLoading, setDocumentosPRLLoading] = useState(false);
  const [documentosPRLError, setDocumentosPRLError] = useState(null);
  const [showPRLSigner, setShowPRLSigner] = useState(false);
  const [prlDocumentToSign, setPrlDocumentToSign] = useState(null);
  const [prlPdfUrl, setPrlPdfUrl] = useState(null);
  const [showPRLAutoevaluacion, setShowPRLAutoevaluacion] = useState(false);
  const [prlDocumentForTest, setPrlDocumentForTest] = useState(null);
  const [showPRLAutoevaluacionResult, setShowPRLAutoevaluacionResult] = useState(false);
  const [prlDocumentForResult, setPrlDocumentForResult] = useState(null);

  // Estado para diplomas (solo visualización)
  const [diplomas, setDiplomas] = useState([]);
  const [diplomasLoading, setDiplomasLoading] = useState(false);
  const [diplomasError, setDiplomasError] = useState(null);

  const email = authUser?.['CORREO ELECTRONICO'] || authUser?.email;
  const empleadoId = authUser?.CODIGO || authUser?.id || authUser?.userId;

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
      setError(`¡Error al cargar las ${config.NOMINAS_LABEL.toLowerCase()}!`);
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
        // Verificar si el objeto contiene campos reales de documento oficial
        const hasValidFields = item && (
          item.id || item.documento_id || item.documentoId ||
          item.nombre_archivo || item.fileName || item.archivo || item.nombre ||
          item.fecha_creacion || item.uploadDate || item.created_at || item.fecha ||
          item.tipo_documento || item.tipo
        );
        
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

      // Procesar solo los documentos oficiales válidos
      // Filtrar solo los documentos visibles para el empleado (Permisso_Para_Empleado = 'SI')
      // + dacă există versiune _FIRMADO, ascunde originalul nesemnat din listă
      let documentosVisibles = documentosOficialesValidos.filter(doc => 
        doc.permisso_para_empleado === 'SI' || doc.permisso_para_empleado === 'YES' || doc.permisso_para_empleado === '1'
      );

      const baseNameKey = (name) =>
        String(name || '')
          .trim()
          .toLowerCase()
          .replace(/_firmado(?=\.[^.]+$)/i, '')
          .replace(/\s+_firmado(?=\.[^.]+$)/i, '');

      const firmadoBases = new Set(
        documentosVisibles
          .filter((doc) => {
            const name = String(doc.nombre_archivo || doc.fileName || '');
            const tipo = String(doc.tipo_documento || doc.tipo || '').toLowerCase();
            return /_firmado/i.test(name) || /firmado/i.test(tipo);
          })
          .map((doc) => baseNameKey(doc.nombre_archivo || doc.fileName))
          .filter(Boolean)
      );

      if (firmadoBases.size > 0) {
        documentosVisibles = documentosVisibles.filter((doc) => {
          const name = String(doc.nombre_archivo || doc.fileName || '');
          const tipo = String(doc.tipo_documento || doc.tipo || '').toLowerCase();
          const isFirmado = /_firmado/i.test(name) || /firmado/i.test(tipo);
          if (isFirmado) return true;
          const base = baseNameKey(name);
          return !firmadoBases.has(base);
        });
      }
      
      let documentosOficialesProcesados = [];
      
      if (Array.isArray(data)) {
        // Si la respuesta es directamente un array
        documentosOficialesProcesados = documentosVisibles.map((doc, idx) => ({
          id: doc.id || `doc_oficial_${idx}`,
          doc_id: doc.doc_id,
          fileName: doc.nombre_archivo || doc.fileName || doc.archivo || doc.nombre || `Documento Oficial ${idx + 1}`,
          fileSize: doc.fileSize || doc.tamaño || doc.size || 0,
          uploadDate: doc.fecha_creacion || doc.uploadDate || doc.created_at || doc.fecha || new Date().toISOString(),
          tipo: doc.tipo_documento || doc.tipo || 'Documento Oficial',
          empleadoId: authUser?.CODIGO || authUser?.id,
          empleadoEmail: email,
          status: 'disponible',
          necesita_firma: doc.necesita_firma === true || doc.necesita_firma === 1 || doc.necesita_firma === '1'
        }));
      } else if (data.success && data.documentos) {
        // Si la respuesta tiene estructura {success: true, documentos: [...]}
        documentosOficialesProcesados = documentosVisibles.map((doc, idx) => ({
          id: doc.id || `doc_oficial_${idx}`,
          doc_id: doc.doc_id,
          fileName: doc.nombre_archivo || doc.fileName || doc.archivo || doc.nombre || `Documento Oficial ${idx + 1}`,
          fileSize: doc.fileSize || doc.tamaño || doc.size || 0,
          uploadDate: doc.uploadDate || doc.fecha_creacion || doc.created_at || doc.fecha || new Date().toISOString(),
          tipo: doc.tipo_documento || doc.tipo || 'Documento Oficial',
          empleadoId: authUser?.CODIGO || authUser?.id,
          empleadoEmail: email,
          status: 'disponible',
          necesita_firma: doc.necesita_firma === true || doc.necesita_firma === 1 || doc.necesita_firma === '1'
        }));
      }

      // Certificados de retenciones (IRPF): mismos PDF que sube gestoría, visibles aquí como documento oficial
      const codigoEmpleado = authUser?.CODIGO || authUser?.id;
      if (codigoEmpleado) {
        try {
          const tokenCr = localStorage.getItem('auth_token');
          const headersCr = {};
          if (tokenCr) {
            headersCr['Authorization'] = `Bearer ${tokenCr}`;
          }
          const crRes = await fetch(
            routes.certificadosRetencionesListarEmpleado(String(codigoEmpleado)),
            { headers: headersCr },
          );
          if (crRes.ok) {
            const crData = await crRes.json();
            if (crData.success && Array.isArray(crData.certificados)) {
              crData.certificados.forEach((c) => {
                documentosOficialesProcesados.push({
                  id: `cr-${c.id}`,
                  certificadoRetencionId: c.id,
                  es_certificado_retencion: true,
                  doc_id: null,
                  fileName: c.nombre_archivo || `certificado_retenciones_${c.id}.pdf`,
                  fileSize: 0,
                  uploadDate: c.fecha_subida || new Date().toISOString(),
                  tipo: c.notas
                    ? `Certificado de retenciones (IRPF) · ${c.notas}`
                    : 'Certificado de retenciones (IRPF)',
                  empleadoId: codigoEmpleado,
                  empleadoEmail: email,
                  status: 'disponible',
                  necesita_firma: false,
                });
              });
            }
          }
        } catch (crErr) {
          console.warn('Certificados retenciones (empleado):', crErr);
        }
      }

      if (documentosOficialesProcesados.length === 0) {
        console.log('ℹ️ No hay documentos oficiales ni certificados de retenciones');
        setDocumentosOficiales([]);
        setDocumentosOficialesNecesitanFirmaCount(0);
        setDocumentosOficialesLoading(false);
        return;
      }

      // Ordenar documentos oficiales de más reciente a más antiguo
      const documentosOficialesOrdenados = documentosOficialesProcesados.sort((a, b) => {
        const fechaA = new Date(a.uploadDate || 0);
        const fechaB = new Date(b.uploadDate || 0);
        return fechaB - fechaA; // Orden descendente (más reciente primero)
      });
      
      setDocumentosOficiales(documentosOficialesOrdenados);
      console.log('✅ Documentos oficiales procesados y ordenados:', documentosOficialesOrdenados);
      
      // Calcula numărul de documente care necesită firmă
      const count = documentosOficialesOrdenados.filter(
        (doc) => doc.necesita_firma === true || doc.necesita_firma === 1 || doc.necesita_firma === '1'
      ).length;
      setDocumentosOficialesNecesitanFirmaCount(count);
      
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

  // Fetch documentos solicitados
  const fetchDocumentosSolicitados = useCallback(async () => {
    if (!empleadoId) {
      console.log('⚠️ No hay empleadoId para obtener documentos solicitados');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.getDocumentosSolicitados(empleadoId);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      // Dacă endpoint-ul nu există încă (404), doar logăm și continuăm fără eroare
      if (response.status === 404) {
        console.log('ℹ️ Endpoint documentos-solicitados nu este disponibil încă (tabelul poate nu este creat)');
        setDocumentosSolicitados([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log('📄 Documentos solicitados obtenidos:', data);
      
      if (data.success && data.data) {
        // Filtrează doar cererile pendiente
        const pendientes = data.data.filter(s => s.estado === 'pendiente');
        setDocumentosSolicitados(pendientes);
      } else {
        setDocumentosSolicitados([]);
      }
    } catch (error) {
      // Nu logăm ca eroare dacă este 404 (endpoint nu există încă)
      if (error.message && error.message.includes('404')) {
        console.log('ℹ️ Endpoint documentos-solicitados nu este disponibil încă');
      } else {
        console.error('❌ Error obteniendo documentos solicitados:', error);
      }
      setDocumentosSolicitados([]);
    }
  }, [empleadoId]);

  // Función para obtener documentos PRL
  const fetchDocumentosPRL = useCallback(async () => {
    if (!empleadoId) {
      setDocumentosPRLError('No se pudo identificar al empleado');
      setDocumentosPRLLoading(false);
      return;
    }

    setDocumentosPRLLoading(true);
    setDocumentosPRLError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.prlMisDocumentos, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 Documentos PRL obtenidos:', data);

      if (data.success && data.documentos) {
        setDocumentosPRL(data.documentos);
      } else {
        setDocumentosPRL([]);
      }
    } catch (error) {
      console.error('❌ Error obteniendo documentos PRL:', error);
      setDocumentosPRLError(error.message);
      setDocumentosPRL([]);
    } finally {
      setDocumentosPRLLoading(false);
    }
  }, [empleadoId]);

  const handleOpenPRLSigner = useCallback(async (doc) => {
    if (doc.es_manual_test && !doc.test_completado) {
      setNotification({
        type: 'info',
        title: 'Autoevaluación pendiente',
        message: 'Completa la autoevaluación antes de firmar el manual.',
      });
      return;
    }

    const fileName = doc.nombre_archivo_original || doc.nombre_archivo || '';
    const isDocx = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');
    const isPdf = fileName.toLowerCase().endsWith('.pdf');

    if (!isPdf && !isDocx) {
      setNotification({
        type: 'info',
        title: 'Tipo de archivo no soportado',
        message:
          'Solo se pueden firmar documentos PDF y DOCX directamente. Para otros tipos de archivo, descárgalos, fírmalos manualmente y súbelos usando "Subir Firmado".',
      });
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.prlDescargarMiDocumento(doc.id), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error al descargar documento: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('El documento descargado está vacío');
      }

      const url = window.URL.createObjectURL(blob);
      setPrlDocumentToSign({ ...doc, isDocx });
      setPrlPdfUrl(url);
      setShowPRLSigner(true);
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: `Error al cargar documento para firmar: ${error.message}`,
      });
    }
  }, []);

  const handleOpenPRLAutoevaluacion = useCallback((doc) => {
    setPrlDocumentForTest(doc);
    setShowPRLAutoevaluacion(true);
  }, []);

  // Cargar documentos PRL cuando se accede a la página (para badge) y cuando se abre el tab
  useEffect(() => {
    // Cargar siempre para tener el badge actualizado
    fetchDocumentosPRL();
  }, [fetchDocumentosPRL]);

  // Función para cargar diplomas del empleado
  const fetchDiplomas = useCallback(async () => {
    if (!empleadoId) {
      setDiplomasError('No se pudo identificar al empleado');
      setDiplomasLoading(false);
      return;
    }

    setDiplomasLoading(true);
    setDiplomasError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.diplomasListarEmpleado(empleadoId), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al cargar diplomas' }));
        throw new Error(errorData.message || 'Error al cargar diplomas');
      }

      const data = await response.json();
      setDiplomas(Array.isArray(data.diplomas) ? data.diplomas : []);
    } catch (error) {
      console.error('Error cargando diplomas:', error);
      setDiplomasError(error.message);
      setDiplomas([]);
    } finally {
      setDiplomasLoading(false);
    }
  }, [empleadoId]);

  // Cargar diplomas cuando se accede al tab
  useEffect(() => {
    if (activeTab === 'diplomas' && empleadoId) {
      fetchDiplomas();
    }
  }, [activeTab, empleadoId, fetchDiplomas]);

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
          setPreviewError(`Error al cargar la ${config.NOMINAS_LABEL_SINGULAR}: ${error.message}`);
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
        previewUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}&preview=true`;
        console.log('📄 Preview para documento oficial:', previewUrl);
        console.log('🔍 Endpoint usado:', routes.downloadDocumentoOficial);
        console.log('🔍 ID documento oficial (id del backend):', documento.id);
        console.log('🔍 Doc ID documento oficial (doc_id del backend):', documento.doc_id);
        console.log('🔍 Email:', email);
        console.log('🔍 FileName:', documento.fileName);
      } else {
        // Para documentos normales, usar el endpoint estándar
        previewUrl = `${routes.downloadDocumento}?id=${documento.id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}&preview=true`;
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
      // Pentru imagini, nu setăm URL direct - vor fi procesate mai jos ca blob/base64
      const isPdfFile = documento.fileName?.toLowerCase().endsWith('.pdf');
      
      // Nu setăm previewUrl direct pentru non-PDF - vor fi procesate mai jos
      
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
          const headers = getAuthHeaders();
          console.log('🔍 Headers para imagen:', headers);
          console.log('🔍 Token presente:', !!headers['Authorization']);
          const response = await fetch(previewUrl, { headers });
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
                          console.warn('⚠️ Blob vacío tras segundo fetch');
                          setPreviewError('El archivo de imagen está vacío');
                          setPreviewDocument({ ...documento, previewUrl: null });
                        }
                      } else {
                        console.warn('⚠️ Segundo fetch no OK:', imgResponse.status);
                        setPreviewError(`Error al cargar la imagen: ${imgResponse.status}`);
                        setPreviewDocument({ ...documento, previewUrl: null });
                      }
                    } catch (secondErr) {
                      console.error('❌ Error en segundo fetch de imagen:', secondErr);
                      setPreviewError(`Error al cargar la imagen: ${secondErr.message}`);
                      setPreviewDocument({ ...documento, previewUrl: null });
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
                        console.warn('⚠️ Blob vacío tras segundo fetch');
                        setPreviewError('El archivo de imagen está vacío');
                        setPreviewDocument({ ...documento, previewUrl: null });
                      }
                    } else {
                      console.warn('⚠️ Segundo fetch no OK:', imgResponse.status);
                      setPreviewError(`Error al cargar la imagen: ${imgResponse.status}`);
                      setPreviewDocument({ ...documento, previewUrl: null });
                    }
                  } catch (secondErr) {
                    console.error('❌ Error en segundo fetch de imagen:', secondErr);
                    setPreviewError(`Error al cargar la imagen: ${secondErr.message}`);
                    setPreviewDocument({ ...documento, previewUrl: null });
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
                      console.warn('⚠️ Blob vacío tras segundo fetch');
                      setPreviewError('El archivo de imagen está vacío');
                      setPreviewDocument({ ...documento, previewUrl: null });
                    }
                  } else {
                    console.warn('⚠️ Segundo fetch no OK:', imgResponse.status);
                    setPreviewError(`Error al cargar la imagen: ${imgResponse.status}`);
                    setPreviewDocument({ ...documento, previewUrl: null });
                  }
                } catch (secondErr) {
                  console.error('❌ Error en segundo fetch de imagen:', secondErr);
                  setPreviewError(`Error al cargar la imagen: ${secondErr.message}`);
                  setPreviewDocument({ ...documento, previewUrl: null });
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
                    console.log('🔍 Data URL length:', dataUrl.length);
                    console.log('🔍 Data URL preview (first 100 chars):', dataUrl.substring(0, 100));
                    setPreviewDocument({ ...documento, previewUrl: dataUrl });
                    console.log('🔍 previewDocument actualizado con previewUrl');
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
                console.warn('⚠️ El blob de imagen está vacío! Mostrando error');
                setPreviewError('El archivo de imagen está vacío o no se pudo cargar');
                setPreviewDocument({ ...documento, previewUrl: null });
              }
            }
            
            setPreviewLoading(false);
            return; // Salir aquí
          } else {
            console.error('❌ Error al cargar imagen:', response.status);
            setPreviewError(`Error al cargar la imagen: ${response.status} ${response.statusText}`);
            setPreviewDocument({ ...documento, previewUrl: null });
            setPreviewLoading(false);
            return;
          }
        } catch (error) {
          console.error('❌ Error al procesar imagen:', error);
          setPreviewError(`Error al procesar la imagen: ${error.message}`);
          setPreviewDocument({ ...documento, previewUrl: null });
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

  // Funcție pentru preview diploma
  const handlePreviewDiploma = async (diploma) => {
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewError(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.diplomasDescargar(diploma.id), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar diploma para preview');
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || blob.type;
      
      // Detectăm tipul fișierului
      const isImage = contentType && contentType.startsWith('image/');
      const isPdf = contentType && contentType.includes('application/pdf');
      
      let previewUrl;
      if (isImage) {
        // Pentru imagini, folosim base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result;
          if (base64String && typeof base64String === 'string') {
            setPreviewDocument({ 
              fileName: diploma.nombre_archivo, 
              previewUrl: base64String, 
              isPdf: false 
            });
            setPreviewLoading(false);
          }
        };
        reader.onerror = () => {
          const url = URL.createObjectURL(blob);
          setPreviewDocument({ 
            fileName: diploma.nombre_archivo, 
            previewUrl: url, 
            isPdf: false 
          });
          setPreviewLoading(false);
        };
        reader.readAsDataURL(blob);
        return;
      } else if (isPdf) {
        // Pentru PDF-uri
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        previewUrl = isIOS 
          ? `data:application/pdf;base64,${await blobToBase64(blob)}`
          : URL.createObjectURL(blob);
        setPreviewDocument({ 
          fileName: diploma.nombre_archivo, 
          previewUrl: previewUrl, 
          isPdf: true 
        });
        setPreviewLoading(false);
      } else {
        // Fallback - tratăm ca PDF
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        previewUrl = isIOS 
          ? `data:application/pdf;base64,${await blobToBase64(blob)}`
          : URL.createObjectURL(blob);
        setPreviewDocument({ 
          fileName: diploma.nombre_archivo, 
          previewUrl: previewUrl, 
          isPdf: true 
        });
        setPreviewLoading(false);
      }
    } catch (error) {
      console.error('Error al cargar diploma para preview:', error);
      setPreviewError(`Error al cargar diploma: ${error.message}`);
      setPreviewLoading(false);
    }
  };

  // Función para descargar documentos oficiales
  const handleDownloadDocumentOficial = async (documento) => {
    try {
      console.log('📥 Descargando documento oficial:', documento);

      if (documento.es_certificado_retencion && documento.certificadoRetencionId != null) {
        const downloadUrl = routes.certificadosRetencionesDescargar(
          documento.certificadoRetencionId,
        );
        const token = localStorage.getItem('auth_token');
        const fetchHeaders = { Accept: 'application/pdf, application/json, */*' };
        if (token) {
          fetchHeaders['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(downloadUrl, { headers: fetchHeaders });
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = documento.fileName || `certificado_retenciones_${documento.certificadoRetencionId}.pdf`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          await activityLogger.logAction('certificado_retencion_downloaded', {
            certificado_id: documento.certificadoRetencionId,
            fileName: documento.fileName,
            user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.name,
            email,
          });
          setNotification({
            type: 'success',
            title: 'Descarga exitosa',
            message: 'Certificado de retenciones descargado',
          });
        } else {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        return;
      }
      
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

      const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const headers = {
          Accept: 'application/pdf, application/json, image/*, */*',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      };

      if (documento.es_certificado_retencion && documento.certificadoRetencionId != null) {
        const pdfUrl = routes.certificadosRetencionesDescargar(
          documento.certificadoRetencionId,
        );
        setShowPreviewModal(true);
        setPreviewLoading(true);
        setPreviewError(null);
        try {
          const response = await fetch(pdfUrl, { headers: getAuthHeaders() });
          if (response.ok && response.headers.get('content-type')?.includes('application/pdf')) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const url = isIOS
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : URL.createObjectURL(blob);
              setPreviewDocument({
                ...documento,
                previewUrl: url,
                esOficial: true,
                isPdf: true,
              });
            } else {
              throw new Error('PDF vacío');
            }
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (e) {
          console.error('Preview certificado retenciones:', e);
          setPreviewError('No se pudo cargar el certificado de retenciones');
        }
        setPreviewLoading(false);
        return;
      }
      
      // Construir URL para preview
      const previewUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}`;
      
      console.log('🔍 URL de preview:', previewUrl);
      
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

  // Funcție pentru deschiderea sistemului de firmă pentru documente oficiale
  const handleFirmarDocumentoOficial = async (documento) => {
    try {
      console.log('✍️ Abriendo sistema de firma para documento oficial:', documento);

      if (documento.es_certificado_retencion) {
        setNotification({
          type: 'info',
          title: 'No aplica',
          message: 'Los certificados de retenciones no se firman desde esta pantalla.',
        });
        return;
      }
      
      if (!documento.fileName?.toLowerCase().endsWith('.pdf')) {
        setNotification({
          type: 'error',
          title: 'Error',
          message: 'Solo se pueden firmar documentos PDF'
        });
        return;
      }

      // Construir URL para descargar PDF
      const downloadUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(documento.fileName || '')}`;
      
      console.log('🔍 URL para firmar:', downloadUrl);
      
      // Helper function pentru a obține headers cu JWT token
      const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Accept': 'application/pdf, application/json, */*',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      };

      setShowOficialSigner(true);
      
      try {
        const response = await fetch(downloadUrl, { headers: getAuthHeaders() });
        console.log('🔍 Respuesta para PDF oficial a firmar:', response.status, response.ok);
        
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
              console.log('✅ URL creado para PDF oficial a firmar:', isIOS ? 'base64' : 'blob');
              setDocumentoOficialToSign(documento);
              setDocumentoOficialPdfUrl(url);
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
        console.error('❌ Error procesando PDF oficial para firmar:', pdfError);
        setShowOficialSigner(false);
        setNotification({
          type: 'error',
          title: 'Error',
          message: `Error al cargar documento para firmar: ${pdfError.message}`
        });
      }
    } catch (error) {
      console.error('❌ Error abriendo sistema de firma:', error);
      setShowOficialSigner(false);
      setNotification({
        type: 'error',
        title: 'Error',
        message: `Error al abrir el sistema de firma: ${error.message}`
      });
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
            title: 'Documento firmado (DEMO)',
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
            title: 'Documento firmado y enviado',
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

    if (documento.es_certificado_retencion) {
      setNotification({
        type: 'info',
        title: 'No aplica',
        message: 'Los certificados de retenciones no se firman con AutoFirma desde aquí.',
      });
      return;
    }
    
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
          fetchDocumentosOficiales(),
          fetchDocumentosSolicitados()
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
  }, [email, authUser, fetchNominas, fetchDocumentos, fetchDocumentosOficiales, fetchDocumentosSolicitados, authUser?.isDemo]);

  // Funcție pentru ștergerea unui document existent
  const handleDeleteDocumento = async (documentoId, docId, fileName) => {
    try {
      // Validare: fileName este obligatoriu
      if (!fileName) {
        console.error('❌ handleDeleteDocumento: fileName este lipsă!', { documentoId, docId, fileName });
        throw new Error('El nombre del archivo es requerido para eliminar el documento');
      }
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const requestBody = {
        id: documentoId,
        doc_id: docId,
        email: email,
        fileName: fileName,
        filename: fileName,
        nombre_archivo: fileName
      };
      
      console.log('🔍 [handleDeleteDocumento] Request body:', requestBody);
      
      const response = await fetch(routes.deleteDocumento, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('🔍 [handleDeleteDocumento] Response result:', result);
      
      // Backend returnează {ok: true, mensaje: ...} sau {success: true, message: ...}
      if (result.ok === true || result.success === true) {
        // Reîncarcă lista de documente
        setTimeout(() => fetchDocumentos(), 500);
        return true;
      } else {
        throw new Error(result.mensaje || result.message || 'Error al eliminar documento');
      }
    } catch (error) {
      console.error('Error deleting documento:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: `No se pudo eliminar el documento: ${error.message}`
      });
      return false;
    }
  };

  const handleWebFileChange = async (event, tip, isReplacement = false) => {
    if (!event || !event.target || !event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    if (file) {
      setUploading(true);
      
      // Genera un ID único para el documento
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Si tip es vacío, intentamos obtenerlo de las solicitudes pendientes
      let tipoFinal = tip || '';
      if (!tipoFinal || tipoFinal.trim() === '') {
        // Buscar en documentos solicitados pendientes
        const solicitudPendiente = Array.isArray(documentosSolicitados) && documentosSolicitados.length > 0
          ? documentosSolicitados.find(s => s.estado === 'pendiente' || !s.estado)
          : null;
        if (solicitudPendiente && solicitudPendiente.tipo_documento) {
          tipoFinal = solicitudPendiente.tipo_documento;
          console.log('🔍 [Upload] Tip gol, folosim tip din solicitare:', tipoFinal);
        }
      }
      
      // Crear FormData con el mismo formato que usa el supervisor
      const formData = new FormData();
      
      // Agregar el archivo
      formData.append('archivo_0', file);
      
      // Agregar metadatos del empleado (usando los datos del usuario autenticado)
      formData.append('empleado_id', authUser?.CODIGO || authUser?.id || 'N/A');
      formData.append('empleado_nombre', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre');
      formData.append('empleado_email', authUser?.['CORREO ELECTRONICO'] || authUser?.email || '');
      // Trimitem tipo_documento cu index pentru primul fișier (archivo_0)
      formData.append('tipo_documento_0', tipoFinal); // Usar el tipo final (con fallback a solicitud si es necesario)
      // Trimitem și fără index pentru compatibilitate
      formData.append('tipo_documento', tipoFinal);
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
        
        // Obținem token-ul JWT pentru autentificare
        const token = localStorage.getItem('auth_token');
        
        // Enviamos el documento al endpoint principal
        const response = await fetch(routes.uploadDocumento, {
          method: 'POST',
          headers: {
            // Nu includem Content-Type - browser-ul îl setează automat pentru FormData cu boundary
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Respuesta del backend:', result);
          
          // Log cargar el documento
          await activityLogger.logDocumentoUploaded({
            id: documentId,
            tip: tipoFinal,
            fileName: file.name,
            fileSize: file.size,
            email: email
          }, authUser);
          
          // Verificăm dacă tipul documentului este unul dintre cele solicitate
          // și reîncărcăm lista de cereri pentru a actualiza UI-ul
          const tipoDocLower = (tipoFinal || '').toLowerCase().trim();
          const tiposSolicitados = ['dni', 'certificado de titularidad', 'certificado de titularidad'];
          const esTipoSolicitado = tiposSolicitados.some(tipo => 
            tipoDocLower === tipo || tipoDocLower.includes(tipo) || tipo.includes(tipoDocLower)
          );
          
          if (esTipoSolicitado) {
            // Reîncărcăm lista de cereri pentru a elimina cererea completată
            setTimeout(() => {
              fetchDocumentosSolicitados();
              fetchDocumentos(); // Reîncărcăm și lista de documente
            }, 500);
          } else {
            // Reîncărcăm doar lista de documente
            setTimeout(() => fetchDocumentos(), 500);
          }
          
          setNotification({
            type: 'success',
            title: '¡Éxito!',
            message: isReplacement ? '¡Documento reemplazado correctamente!' : '¡Documento subido correctamente!'
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

  const prlPendingFirmaCount = documentosPRL.filter((d) => d.estado === 'PENDIENTE' && d.requiere_firma).length;

  const handleReportError = () => {
    const tabNames = {
      nominas: config.NOMINAS_LABEL,
      'mis-documentos': 'Mis Documentos',
      'contrato-documentos': 'Documentos Oficiales',
      'prl-documentos': 'Documentos PRL',
      diplomas: 'Diplomas',
    };

    const pageData = {
      additionalInfo: [
        `[TAB ACTIVO] ${tabNames[activeTab] || activeTab}`,
        nominas?.length > 0 ? `[${config.NOMINAS_LABEL.toUpperCase()}] ${nominas.length} disponibles` : null,
        documentos?.length > 0 ? `[DOCUMENTOS] ${documentos.length} disponibles` : null,
      ].filter(Boolean),
    };

    const message = buildErrorReportMessage({
      authUser,
      pageName: 'Documentos',
      pageData,
    });

    openWhatsAppErrorReport(message);
  };

  if (!email) {
    return (
      <div className="app-page documentos-page">
        <PageHeader title="Documentos" backTo="/inicio" />
        <AlertBanner variant="danger" title="Error: email faltante">
          No se pudo identificar al usuario.
        </AlertBanner>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-page documentos-page">
        <PageHeader title="Documentos" subtitle={`${config.NOMINAS_LABEL}, contratos y documentos personales`} backTo="/inicio" />
        <AlertBanner variant="loading" loading>Preparando documentos...</AlertBanner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page documentos-page">
        <PageHeader title="Documentos" backTo="/inicio" />
        <AlertBanner variant="danger" title="Error">{error}</AlertBanner>
        <button type="button" onClick={fetchNominas} className="solicitud-admin-btn solicitud-admin-btn--primary mt-2">
          <RefreshCw className="w-4 h-4" aria-hidden />
          <span>Inténtalo de nuevo</span>
        </button>
      </div>
    );
  }

  return (
    <div className="app-page documentos-page">
      <PageHeader
        title="Documentos"
        subtitle={`${config.NOMINAS_LABEL}, contratos y documentos personales`}
        backTo="/inicio"
        actions={(
          <button type="button" onClick={handleReportError} className="solicitud-admin-btn" title="Reportar error">
            <MessageCircleWarning className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">Reportar error</span>
          </button>
        )}
      />

      <SegmentedControl
        layout="grid"
        value={activeTab}
        onChange={setActiveTab}
        className="documentos-tabs solicitud-admin-tabs"
        items={[
          { id: 'nominas', label: `${config.NOMINAS_LABEL} (${nominas.length})`, shortLabel: `Nom. (${nominas.length})` },
          { id: 'mis-documentos', label: `Mis Docs (${documentosSolicitados.length})`, shortLabel: `Docs (${documentosSolicitados.length})` },
          { id: 'contrato-documentos', label: `Oficiales (${documentosOficialesNecesitanFirmaCount})`, shortLabel: `Ofic. (${documentosOficialesNecesitanFirmaCount})` },
          { id: 'prl-documentos', label: `PRL (${prlPendingFirmaCount})`, shortLabel: `PRL (${prlPendingFirmaCount})` },
          { id: 'diplomas', label: 'Diplomas', shortLabel: 'Dipl.' },
        ]}
      />

      <div className="app-card app-card--pad">
        {activeTab === 'nominas' && (
            <div>
              <div className="solicitud-admin-toolbar">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{config.NOMINAS_LABEL} Disponibles</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Recibos de sueldo y documentos salariales</p>
                </div>
                <button type="button" onClick={fetchNominas} disabled={nominasLoading} className="solicitud-admin-btn" title="Actualizar">
                  <RefreshCw className={`w-4 h-4 ${nominasLoading ? 'animate-spin' : ''}`} aria-hidden />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>

              <AlertBanner variant="info" className="mt-3" title="Información Legal">
                Esta aplicación es el canal oficial de entrega de {config.NOMINAS_LABEL.toLowerCase()}. Al acceder a tu cuenta, aceptas que {config.NOMINAS_LABEL.toLowerCase()} están disponibles y puestas a tu disposición. Todas las acciones de acceso y descarga son registradas para cumplimiento legal.
              </AlertBanner>

              {nominasLoading ? (
                <AlertBanner variant="loading" loading className="mt-3">Cargando {config.NOMINAS_LABEL.toLowerCase()}...</AlertBanner>
              ) : nominas.length === 0 ? (
                <AlertBanner variant="info" title={`No se encontraron ${config.NOMINAS_LABEL.toLowerCase()}`} className="mt-3">
                  Las {config.NOMINAS_LABEL.toLowerCase()} aparecerán aquí cuando estén disponibles.
                </AlertBanner>
              ) : (
                <div className="solicitud-admin-mobile-list mt-3">
                  {nominas.map((item, idx) => (
                    <article key={item.id || idx} className="solicitud-admin-mobile-card">
                      <div className="solicitud-admin-mobile-card__head">
                        <div className="min-w-0">
                          <h3 className="solicitud-admin-mobile-card__title">
                            {(item.mes || item.luna || item.month || item.periodo) && (item.año || item.ano || item.an || item.year)
                              ? `${item.mes || item.luna || item.month || item.periodo} / ${item.año || item.ano || item.an || item.year}`
                              : `${config.NOMINAS_LABEL_SINGULAR.charAt(0).toUpperCase() + config.NOMINAS_LABEL_SINGULAR.slice(1)} Disponible`}
                          </h3>
                          {item.fileName && <p className="text-xs text-gray-500 truncate">{item.fileName}</p>}
                        </div>
                      </div>
                      <div className="solicitud-admin-toolbar documentos-actions mt-2">
                        <button type="button" onClick={() => handlePreviewDocument(item)} className="solicitud-admin-btn">
                          <Eye className="w-4 h-4" aria-hidden />
                          <span>Ver</span>
                        </button>
                        <button
                          type="button"
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
                                message: `Enviando ${config.NOMINAS_LABEL_SINGULAR} por correo electrónico...`
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
                                title: 'Email Enviado',
                                message: `Tu ${config.NOMINAS_LABEL_SINGULAR} ha sido enviada a ${userEmail}`
                              });
                            } catch (error) {
                              console.error('❌ Error enviando nómina por email:', error);
                              setNotification({
                                type: 'error',
                                title: 'Error',
                                message: error.message || `Error al enviar la ${config.NOMINAS_LABEL_SINGULAR} por email`
                              });
                            }
                          }}
                          className="solicitud-admin-btn"
                        >
                          <Mail className="w-4 h-4" aria-hidden />
                          <span>Email</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await activityLogger.logAction('nomina_downloaded', {
                                luna: item.mes,
                                an: item.año || item.ano || item.an || item.year,
                                fileName: item.fileName,
                                user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
                                email: authUser?.email
                              });

                              const downloadUrl = `${routes.downloadNomina}?id=${item.id}&nombre=${encodeURIComponent(authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || '')}`;

                              const token = localStorage.getItem('auth_token');
                              const fetchHeaders = {};
                              if (token) {
                                fetchHeaders['Authorization'] = `Bearer ${token}`;
                              }

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
                                  message: `No se pudo descargar la ${config.NOMINAS_LABEL_SINGULAR}`
                                });
                              }
                            } catch (error) {
                              console.error('❌ Error descargando nómina:', error);
                              setNotification({
                                type: 'error',
                                title: 'Error de Descarga',
                                message: `Error al descargar la ${config.NOMINAS_LABEL_SINGULAR}`
                              });
                            }
                          }}
                          className="solicitud-admin-btn"
                        >
                          <Download className="w-4 h-4" aria-hidden />
                          <span>Descargar</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

                               {activeTab === 'mis-documentos' && (
            <div>
              <div className="solicitud-admin-toolbar">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Mis Documentos</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Archivos y documentos personales</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fetchDocumentos();
                    fetchDocumentosSolicitados();
                  }}
                  disabled={documentosLoading}
                  className="solicitud-admin-btn"
                  title="Actualizar"
                >
                  <RefreshCw className={`w-4 h-4 ${documentosLoading ? 'animate-spin' : ''}`} aria-hidden />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>

              {documentosSolicitados.length > 0 && (
                <div className="mt-3">
                  <AlertBanner variant="warning" title="Documentos Solicitados" className="mb-3">
                    Tienes documentos pendientes de subir. Los documentos se solicitan exclusivamente para la verificación de identidad y cuenta bancaria, con fines contractuales y fiscales.
                  </AlertBanner>
                  <div className="solicitud-admin-mobile-list">
                      {documentosSolicitados.map((solicitud) => (
                        <article key={solicitud.id} className="solicitud-admin-mobile-card">
                          <div className="solicitud-admin-mobile-card__head">
                            <div className="min-w-0">
                              <h3 className="solicitud-admin-mobile-card__title">{solicitud.tipo_documento}</h3>
                              {solicitud.notas && <p className="text-xs text-gray-500">{solicitud.notas}</p>}
                              <p className="text-xs text-gray-500">Solicitado el {formatDate(solicitud.fecha_solicitud)}</p>
                            </div>
                            <span className="solicitud-status solicitud-status--pendiente">Pendiente</span>
                          </div>
                          <div className="solicitud-admin-toolbar documentos-actions mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDocumentType(solicitud.tipo_documento);
                                setShowCustomTypeSourceModal(true);
                              }}
                              className="solicitud-admin-btn solicitud-admin-btn--primary"
                            >
                              <Upload className="w-4 h-4" aria-hidden />
                              <span>Subir Documento</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                </div>
              )}

              {documentosLoading ? (
                <AlertBanner variant="loading" loading className="mt-3">Cargando documentos...</AlertBanner>
              ) : documentos.length === 0 ? (
                <AlertBanner variant="info" title="No hay documentos" className="mt-3">
                  Los documentos aparecerán aquí cuando los subas.
                </AlertBanner>
              ) : (
                <div className="solicitud-admin-mobile-list mt-3">
                  {documentos.map((documento, idx) => (
                      <article key={`${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} className="solicitud-admin-mobile-card">
                        <div className="solicitud-admin-mobile-card__head">
                          <div className="min-w-0">
                            <h3 className="solicitud-admin-mobile-card__title break-all" title={documento.fileName || `Documento ${idx + 1}`}>
                              {documento.fileName || `Documento ${idx + 1}`}
                            </h3>
                            <p className="text-xs text-gray-500">{documento.tipo || 'Documento personal'}</p>
                            <p className="text-xs text-gray-500">Subido: {formatDate(documento.uploadDate)}</p>
                          </div>
                          {documento.status && (
                            <span className={`solicitud-status ${
                              documento.status === 'aprobado' ? 'solicitud-status--ok'
                                : documento.status === 'rechazado' ? 'solicitud-status--rechazada'
                                : 'solicitud-status--pendiente'
                            }`}>
                              {documento.status === 'aprobado' ? 'Aprobado' : documento.status === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                            </span>
                          )}
                        </div>
                        <div className="solicitud-admin-toolbar documentos-actions mt-2 flex-wrap">
                              <button type="button" onClick={() => handlePreviewDocument(documento)} className="solicitud-admin-btn">
                                <Eye className="w-4 h-4" aria-hidden />
                                <span>Ver</span>
                              </button>
                              <button
                                type="button"
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
                              className="solicitud-admin-btn"
                            >
                              <Download className="w-4 h-4" aria-hidden />
                              <span>Descargar</span>
                            </button>
                            {(documento.tipo === 'DNI' || documento.tipo === 'Certificado de titularidad') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDocumentToReplace(documento);
                                  setShowReplaceConfirmModal(true);
                                }}
                                disabled={uploading}
                                className="solicitud-admin-btn"
                              >
                                {uploading ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                                ) : (
                                  <Replace className="w-4 h-4" aria-hidden />
                                )}
                                <span>{uploading ? 'Eliminando...' : 'Reemplazar'}</span>
                              </button>
                            )}
                        </div>
                      </article>
                     ))}
                    

                  </div>
                )}
            </div>
          )}

          {activeTab === 'contrato-documentos' && (
            <div>
              <div className="solicitud-admin-toolbar">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Documentos Oficiales</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Contratos, certificados y documentos legales</p>
                </div>
                <button type="button" onClick={fetchDocumentosOficiales} disabled={documentosOficialesLoading} className="solicitud-admin-btn" title="Actualizar">
                  <RefreshCw className={`w-4 h-4 ${documentosOficialesLoading ? 'animate-spin' : ''}`} aria-hidden />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>

              {documentosOficialesLoading ? (
                <AlertBanner variant="loading" loading className="mt-3">Cargando documentos oficiales...</AlertBanner>
              ) : documentosOficialesError ? (
                <AlertBanner variant="danger" title="Error al cargar documentos oficiales" className="mt-3">
                  {documentosOficialesError}
                  <button type="button" onClick={fetchDocumentosOficiales} className="solicitud-admin-btn mt-2">
                    <RefreshCw className="w-4 h-4" aria-hidden />
                    <span>Reintentar</span>
                  </button>
                </AlertBanner>
              ) : documentosOficiales.length === 0 ? (
                <AlertBanner variant="info" title="No se encontraron documentos oficiales" className="mt-3">
                  Los documentos oficiales aparecerán aquí cuando estén disponibles.
                </AlertBanner>
              ) : (
                <div className="solicitud-admin-mobile-list mt-3">
                    {documentosOficiales.map((documento, idx) => (
                      <article key={`${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} className="solicitud-admin-mobile-card">
                        <div className="solicitud-admin-mobile-card__head">
                          <div className="min-w-0">
                            <h3 className="solicitud-admin-mobile-card__title break-all" title={documento.fileName || `Documento Oficial ${idx + 1}`}>
                              {documento.fileName || `Documento Oficial ${idx + 1}`}
                            </h3>
                            <p className="text-xs text-gray-500">{documento.tipo || 'Documento oficial'}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(documento.uploadDate)}
                              {documento.fileSize > 0 ? ` · ${(documento.fileSize / 1024).toFixed(1)} KB` : ''}
                            </p>
                          </div>
                          <span className={`solicitud-status ${documento.necesita_firma === true ? 'solicitud-status--pendiente' : 'solicitud-status--ok'}`}>
                            {documento.necesita_firma === true ? 'Firma pendiente' : 'Sin firma'}
                          </span>
                        </div>
                        <div className="solicitud-admin-toolbar documentos-actions mt-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handlePreviewDocumentOficial(documento)}
                              disabled={documento.necesita_firma === true}
                              className="solicitud-admin-btn"
                              title={documento.necesita_firma === true ? 'Este documento requiere firma antes de poder visualizarlo' : 'Vista previa del documento'}
                            >
                              <Eye className="w-4 h-4" aria-hidden />
                              <span>Ver</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadDocumentOficial(documento)}
                              disabled={documento.necesita_firma === true}
                              className="solicitud-admin-btn"
                              title={documento.necesita_firma === true ? 'Este documento requiere firma antes de poder descargarlo' : 'Descargar documento'}
                            >
                              <Download className="w-4 h-4" aria-hidden />
                              <span>Descargar</span>
                            </button>
                          {!documento.es_certificado_retencion && (
                            <>
                            <button
                              type="button"
                              onClick={() => handleFirmarDocumentoOficial(documento)}
                              className="solicitud-admin-btn solicitud-admin-btn--primary"
                            >
                              <PenLine className="w-4 h-4" aria-hidden />
                              <span>Firmar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('🖱️ BOTÓN AUTOFIRMA HA SIDO PRESIONADO!');
                                console.log('📄 Documento para AutoFirma:', documento);
                                handleSignWithAutoFirmaOficial(documento);
                              }}
                              className="solicitud-admin-btn"
                            >
                              <PenLine className="w-4 h-4" aria-hidden />
                              <span>AutoFirma</span>
                            </button>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
            </div>
          )}

      {/* Tab Documentos PRL */}
      {activeTab === 'prl-documentos' && (
        <div>
          <div className="solicitud-admin-toolbar">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Documentos PRL</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prevención de Riesgos Laborales — documentos asignados</p>
            </div>
            <button type="button" onClick={fetchDocumentosPRL} disabled={documentosPRLLoading} className="solicitud-admin-btn" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${documentosPRLLoading ? 'animate-spin' : ''}`} aria-hidden />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {documentosPRLLoading ? (
            <AlertBanner variant="loading" loading className="mt-3">Cargando documentos PRL...</AlertBanner>
          ) : documentosPRLError ? (
            <AlertBanner variant="danger" className="mt-3">{documentosPRLError}</AlertBanner>
          ) : documentosPRL.length === 0 ? (
            <AlertBanner variant="info" title="No hay documentos PRL asignados" className="mt-3">
              Los documentos PRL aparecerán aquí cuando te sean asignados.
            </AlertBanner>
          ) : (
            <div className="solicitud-admin-mobile-list mt-3">
              {prlPendingFirmaCount > 0 && (
                <AlertBanner variant="warning" title="Documentos pendientes de firma" className="mb-3">
                  Tienes {prlPendingFirmaCount} documento(s) que requieren firma y deben ser devueltos.
                </AlertBanner>
              )}
              {documentosPRL.map((doc) => {
                const getEstadoBadge = () => {
                  switch (doc.estado) {
                    case 'PENDIENTE':
                      return (
                        <span className={`solicitud-status ${doc.requiere_firma ? 'solicitud-status--pendiente' : 'solicitud-status--neutral'}`}>
                          {doc.requiere_firma ? 'Pendiente de firma' : 'Pendiente'}
                        </span>
                      );
                    case 'FIRMADO':
                      return <span className="solicitud-status solicitud-status--ok">Firmado</span>;
                    case 'INFORMATIVO':
                      return <span className="solicitud-status solicitud-status--neutral">Informativo</span>;
                    case 'NO_APLICA':
                      return <span className="solicitud-status solicitud-status--neutral">No aplica</span>;
                    default:
                      return <span className="solicitud-status solicitud-status--neutral">{doc.estado}</span>;
                  }
                };

                const getTipoLabel = (tipo) => {
                  const tipos = {
                    'EVALUACION_RIESGOS': 'Evaluación de Riesgos Laborales',
                    'ACTA_INFORMATIVA': 'Acta Informativa del Puesto',
                    'ENTREGA_EPIS': 'Entrega de EPIs',
                    'RENUNCIA_RM': 'Renuncia Reconocimiento Médico',
                    'MANUAL_TEST': 'Manual del Puesto + Test',
                  };
                  return tipos[tipo] || tipo;
                };

                return (
                  <article
                    key={doc.id}
                    className={`solicitud-admin-mobile-card ${doc.estado === 'PENDIENTE' && doc.requiere_firma ? 'border-yellow-300' : ''}`}
                  >
                    <div className="solicitud-admin-mobile-card__head">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="solicitud-admin-mobile-card__title">{doc.template_nombre}</h3>
                          {getEstadoBadge()}
                        </div>
                        <p className="text-xs text-gray-500">{getTipoLabel(doc.tipo_documento)}</p>
                        <p className="text-xs text-gray-500">Asignado: {formatDate(doc.asignado_en)}</p>
                        {doc.fecha_firma && (
                          <p className="text-xs text-gray-500">Firmado: {formatDate(doc.fecha_firma)}</p>
                        )}
                        {doc.es_manual_test && doc.estado === 'PENDIENTE' && !doc.test_completado && (
                          <p className="text-xs text-amber-700 mt-1">Autoevaluación pendiente — completa el test para poder firmar</p>
                        )}
                        {doc.es_manual_test && doc.test_completado && (
                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-gray-500">
                              Test completado: {doc.test_puntuacion !== null ? `${doc.test_puntuacion} puntos` : 'Completado'}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setPrlDocumentForResult(doc);
                                setShowPRLAutoevaluacionResult(true);
                              }}
                              className="text-xs text-blue-700 hover:underline font-medium"
                            >
                              Ver mis respuestas del test
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {doc.requiere_firma && doc.estado === 'PENDIENTE' && (
                      <AlertBanner variant="warning" className="mt-2 text-xs">
                        {doc.es_manual_test && !doc.test_completado
                          ? 'Completa la autoevaluación y después firma el manual en la última página.'
                          : 'Este documento requiere firma. Debes descargarlo, firmarlo y devolverlo.'}
                      </AlertBanner>
                    )}
                    {doc.es_renuncia_rm && (
                      <div className="solicitud-admin-callout mt-2 text-xs">
                        Este documento se firma únicamente si rechazas el Reconocimiento Médico.
                        {doc.estado === 'NO_APLICA' && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`renuncia-rm-${doc.id}`}
                              onChange={async (e) => {
                                if (e.target.checked) {
                                  try {
                                    const token = localStorage.getItem('auth_token');
                                    const response = await fetch(routes.prlRenunciarRM(doc.id), {
                                      method: 'POST',
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': 'application/json',
                                      },
                                    });

                                    if (!response.ok) {
                                      const errorData = await response.json();
                                      throw new Error(errorData.message || 'Error al renunciar a RM');
                                    }

                                    await fetchDocumentosPRL();

                                    setNotification({
                                      type: 'success',
                                      title: 'Renuncia registrada',
                                      message: 'Debes descargar el documento, firmarlo y subirlo.',
                                    });
                                  } catch (error) {
                                    e.target.checked = false;
                                    setNotification({
                                      type: 'error',
                                      title: 'Error',
                                      message: `Error al renunciar a RM: ${error.message}`,
                                    });
                                  }
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <label htmlFor={`renuncia-rm-${doc.id}`} className="cursor-pointer font-medium">
                              Renuncio al Reconocimiento Médico
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="solicitud-admin-toolbar documentos-actions mt-2 flex-wrap">
                        {/* Buton de descărcare - ascuns pentru RENUNCIA_RM cu status NO_APLICA */}
                        {!(doc.es_renuncia_rm && doc.estado === 'NO_APLICA') && (
                          <button
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('auth_token');
                                const response = await fetch(routes.prlDescargarMiDocumento(doc.id), {
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                  },
                                });

                                if (!response.ok) {
                                  throw new Error('Error al descargar documento');
                                }

                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = doc.nombre_archivo_original;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);

                                setNotification({
                                  type: 'success',
                                  title: 'Descarga exitosa',
                                  message: `Documento "${doc.template_nombre}" descargado correctamente`,
                                });
                              } catch (error) {
                                setNotification({
                                  type: 'error',
                                  title: 'Error',
                                  message: `Error al descargar documento: ${error.message}`,
                                });
                              }
                            }}
                            className="solicitud-admin-btn"
                          >
                            <Download className="w-4 h-4" aria-hidden />
                            <span>Descargar</span>
                          </button>
                        )}
                        {doc.es_renuncia_rm && doc.estado === 'NO_APLICA' && (
                          <p className="text-xs text-gray-500 w-full">Marca la casilla arriba para descargar</p>
                        )}
                        {doc.requiere_firma && doc.estado === 'PENDIENTE' && (
                          <>
                            {doc.es_manual_test && (
                              <button
                                type="button"
                                onClick={() => handleOpenPRLAutoevaluacion(doc)}
                                className="solicitud-admin-btn"
                              >
                                <FileText className="w-4 h-4" aria-hidden />
                                <span>Autoevaluación</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenPRLSigner(doc)}
                              disabled={doc.es_manual_test && !doc.test_completado}
                              className="solicitud-admin-btn solicitud-admin-btn--primary"
                            >
                              <PenLine className="w-4 h-4" aria-hidden />
                              <span>Firmar</span>
                            </button>
                            <label
                              className={`solicitud-admin-btn ${doc.es_manual_test && !doc.test_completado ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <Upload className="w-4 h-4" aria-hidden />
                              <span>Subir firmado</span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.doc"
                                className="hidden"
                                disabled={doc.es_manual_test && !doc.test_completado}
                                onChange={async (e) => {
                                  if (doc.es_manual_test && !doc.test_completado) {
                                    setNotification({
                                      type: 'info',
                                      title: 'Autoevaluación pendiente',
                                      message: 'Completa la autoevaluación antes de subir el manual firmado.',
                                    });
                                    e.target.value = '';
                                    return;
                                  }
                                  const file = e.target.files?.[0];
                                  if (!file) return;

                                  try {
                                    const token = localStorage.getItem('auth_token');
                                    const formData = new FormData();
                                    formData.append('archivo', file);

                                    const response = await fetch(routes.prlSubirDocumentoFirmado(doc.id), {
                                      method: 'POST',
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: formData,
                                    });

                                    if (!response.ok) {
                                      const errorData = await response.json();
                                      throw new Error(errorData.message || 'Error al subir documento');
                                    }

                                    // Reîncarcă documentele pentru a actualiza statusul
                                    await fetchDocumentosPRL();

                                    setNotification({
                                      type: 'success',
                                      title: 'Documento subido',
                                      message: 'El documento firmado ha sido subido exitosamente.',
                                    });
                                  } catch (error) {
                                    setNotification({
                                      type: 'error',
                                      title: 'Error',
                                      message: `Error al subir documento: ${error.message}`,
                                    });
                                  } finally {
                                    // Reset input
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </>
                        )}
                        {/* Buton de descărcare pentru documentul firmat (când există) */}
                        {doc.estado === 'FIRMADO' && (
                          <button
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('auth_token');
                                const response = await fetch(routes.prlDescargarDocumentoFirmado(doc.id), {
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                  },
                                });

                                if (!response.ok) {
                                  throw new Error('Error al descargar documento firmado');
                                }

                                // Detectează tipul fișierului din Content-Type
                                const contentType = response.headers.get('Content-Type') || '';
                                const isDocx = contentType.includes('wordprocessingml') || contentType.includes('msword');
                                const isPdf = contentType.includes('pdf');
                                
                                const contentDisposition = response.headers.get('Content-Disposition');
                                let filename = contentDisposition
                                  ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || null
                                  : null;
                                
                                console.log('🔍 [DocumentosPage] Descargando documento firmado:', {
                                  documentoId: doc.id,
                                  contentType,
                                  isDocx,
                                  isPdf,
                                  contentDisposition,
                                  filenameFromHeader: filename,
                                  nombreOriginal: doc.nombre_archivo_original || doc.nombre_archivo
                                });
                                
                                // Fallback bazat pe tipul detectat
                                if (!filename) {
                                  if (isDocx) {
                                    filename = `documento_firmado_${doc.id}.docx`;
                                  } else if (isPdf) {
                                    filename = `documento_firmado_${doc.id}.pdf`;
                                  } else {
                                    // Încearcă să detecteze din numele documentului original
                                    const originalName = doc.nombre_archivo_original || doc.nombre_archivo || '';
                                    if (originalName.toLowerCase().endsWith('.docx') || originalName.toLowerCase().endsWith('.doc')) {
                                      filename = `documento_firmado_${doc.id}.docx`;
                                    } else {
                                      filename = `documento_firmado_${doc.id}.pdf`;
                                    }
                                  }
                                }
                                
                                console.log('📥 [DocumentosPage] Filename final para descarga:', filename);
                                
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);

                                setNotification({
                                  type: 'success',
                                  title: 'Descarga exitosa',
                                  message: `Documento firmado "${doc.template_nombre}" descargado correctamente`,
                                });
                              } catch (error) {
                                setNotification({
                                  type: 'error',
                                  title: 'Error',
                                  message: `Error al descargar documento firmado: ${error.message}`,
                                });
                              }
                            }}
                            className="solicitud-admin-btn"
                          >
                            <Download className="w-4 h-4" aria-hidden />
                            <span>Descargar firmado</span>
                          </button>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Diplomas */}
      {activeTab === 'diplomas' && (
        <div>
          <div className="solicitud-admin-toolbar">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Diplomas</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tus diplomas y certificados</p>
            </div>
            <button type="button" onClick={fetchDiplomas} disabled={diplomasLoading} className="solicitud-admin-btn" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${diplomasLoading ? 'animate-spin' : ''}`} aria-hidden />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {diplomasLoading ? (
            <AlertBanner variant="loading" loading className="mt-3">Cargando diplomas...</AlertBanner>
          ) : diplomasError ? (
            <AlertBanner variant="danger" className="mt-3">{diplomasError}</AlertBanner>
          ) : diplomas.length === 0 ? (
            <AlertBanner variant="info" title="No se encontraron diplomas" className="mt-3">
              Los diplomas aparecerán aquí cuando estén disponibles.
            </AlertBanner>
          ) : (
            <div className="solicitud-admin-mobile-list mt-3">
              {diplomas.map((diploma) => (
                <article key={diploma.id} className="solicitud-admin-mobile-card">
                  <div className="solicitud-admin-mobile-card__head">
                    <div className="min-w-0">
                      <h3 className="solicitud-admin-mobile-card__title">{diploma.nombre_archivo}</h3>
                      <p className="text-xs text-gray-500">
                        Subido el: {new Date(diploma.uploaded_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="solicitud-admin-toolbar documentos-actions mt-2">
                    <button type="button" onClick={() => handlePreviewDiploma(diploma)} className="solicitud-admin-btn">
                      <Eye className="w-4 h-4" aria-hidden />
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('auth_token');
                          const response = await fetch(routes.diplomasDescargar(diploma.id), {
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          });

                          if (!response.ok) {
                            throw new Error('Error al descargar diploma');
                          }

                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          const contentDisposition = response.headers.get('Content-Disposition');
                          const filename = contentDisposition
                            ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || diploma.nombre_archivo
                            : diploma.nombre_archivo;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          setNotification({
                            type: 'error',
                            title: 'Error',
                            message: `Error al descargar diploma: ${error.message}`,
                          });
                        }
                      }}
                      className="solicitud-admin-btn"
                    >
                      <Download className="w-4 h-4" aria-hidden />
                      <span>Descargar</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      </div>

      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showCustomTypeSourceModal}
          onClose={() => setShowCustomTypeSourceModal(false)}
          title="Subir Documento"
          className="app-modal--form"
          showCloseButton={false}
        >
          <p className="text-sm text-gray-500 mb-3">Selecciona una opción</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                customFileInputRef.current?.click();
                setShowCustomTypeSourceModal(false);
              }}
              className="solicitud-admin-btn w-full justify-start"
            >
              <ImageIcon className="w-5 h-5" aria-hidden />
              <div className="text-left">
                <div className="font-semibold">Fototeca</div>
                <div className="text-xs text-gray-500">Seleccionar foto existente</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                customCameraInputRef.current?.click();
                setShowCustomTypeSourceModal(false);
              }}
              className="solicitud-admin-btn w-full justify-start"
            >
              <Camera className="w-5 h-5" aria-hidden />
              <div className="text-left">
                <div className="font-semibold">Hacer foto</div>
                <div className="text-xs text-gray-500">Tomar nueva foto con cámara</div>
              </div>
            </button>
            <button
              type="button"
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
              className="solicitud-admin-btn w-full justify-start"
            >
              <FileText className="w-5 h-5" aria-hidden />
              <div className="text-left">
                <div className="font-semibold">Seleccionar Archivo</div>
                <div className="text-xs text-gray-500">Elegir archivo del dispositivo</div>
              </div>
            </button>
          </div>
        </Modal>,
        document.body
      )}

      <input
        id="custom-file-input"
        name="customFileInput"
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
        aria-label="Seleccionar archivo desde galería"
      />
      <input
        id="custom-camera-input"
        name="customCameraInput"
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
        aria-label="Tomar foto con cámara"
      />

      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showCustomTypeModal}
        onClose={() => { setShowCustomTypeModal(false); setCustomDocumentType(''); }}
        title="Tipo de documento personalizado"
        showCloseButton={false}
        className="app-modal--form"
        footer={(
          <div className="app-modal__actions">
            <button type="button" onClick={() => { setShowCustomTypeModal(false); setCustomDocumentType(''); }} className="app-modal__btn">Cancelar</button>
            <button
              type="button"
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
              className="app-modal__btn app-modal__btn--primary"
            >
              Seleccionar archivo
            </button>
          </div>
        )}
      >
        <div className="app-modal__field">
          <label htmlFor="custom-document-type-modal-input" className="app-modal__label">Especificar tipo de documento</label>
          <input
            id="custom-document-type-modal-input"
            name="customDocumentTypeModal"
            type="text"
            placeholder="Ej: Certificado de Residencia, Certificado de Trabajo..."
            value={customDocumentType}
            onChange={(e) => setCustomDocumentType(e.target.value)}
            className="app-modal__input"
            required
            autoFocus
          />
        </div>
        <button
          type="button"
          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
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
          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" aria-hidden />
          <p className="text-sm text-gray-600">Haz clic para seleccionar un archivo</p>
          <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, JPG, PNG (máx. 10MB)</p>
        </button>
      </Modal>,
      document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showPreviewModal}
          onClose={handleClosePreview}
          title={`Vista Previa: ${previewDocument?.fileName || ''}`}
          size="xl"
          className="app-modal--preview"
          showCloseButton={false}
          footer={(
            <button type="button" onClick={handleClosePreview} className="app-modal__btn">
              Cerrar
            </button>
          )}
        >
          <div className="documentos-preview-body relative">
            {previewLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-500" aria-hidden />
                <p className="text-gray-600 text-sm font-medium">Cargando vista previa...</p>
              </div>
            )}

            {previewError && (
              <AlertBanner variant="danger" className="mb-3">{previewError}</AlertBanner>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
                {previewDocument?.fileName?.toLowerCase().endsWith('.txt') && previewDocument?.content ? (
                  <div className="p-4 bg-gray-50 max-h-[75vh] overflow-y-auto">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{previewDocument.content}</pre>
        </div>
                ) : previewDocument?.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <div className="p-4 bg-gray-50 max-h-[75vh] overflow-y-auto">
                    {previewDocument?.previewUrl ? (
                      <img 
                        src={previewDocument.previewUrl}
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
                        console.error('❌ Error loading image in modal:', e.target.src);
                        e.target.style.display = 'none';
                        if (e.target.nextSibling && e.target.nextSibling.style) {
                          e.target.nextSibling.style.display = 'block';
                        }
                      }}
                      onLoad={() => {
                        console.log('✅ Image loaded successfully in modal:', previewDocument?.previewUrl?.substring(0, 50));
                      }}
                    />
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-600 mb-4">🖼️ Cargando imagen...</p>
                        <p className="text-sm text-gray-500">Por favor espera mientras se carga la imagen</p>
                      </div>
                    )}
                    <div className="hidden text-center">
                      <p className="text-gray-600 mb-4">🖼️ Error al cargar la imagen</p>
                      <p className="text-sm text-gray-500">La imagen no se pudo cargar, usa el botón de descarga</p>
                    </div>
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
            </div>
        </Modal>,
        document.body
      )}

      {/* Buton pentru AutoFirma - click manual necesar */}
      {autoFirmaUrl && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <div className="solicitud-admin-callout p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <PenLine className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">AutoFirma</h3>
                <p className="text-xs text-gray-600">Abre AutoFirma o copia la URL al portapapeles</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <a
                href={autoFirmaUrl}
                className="solicitud-admin-btn solicitud-admin-btn--primary flex-1 justify-center"
              >
                <PenLine className="w-4 h-4" aria-hidden />
                <span>Semnează cu AutoFirma</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(autoFirmaUrl).then(() => {
                    alert('La URL de AutoFirma se ha copiado al portapapeles. Puedes abrirla manualmente en el navegador.');
                  }).catch(() => {
                    alert('URL de AutoFirma: ' + autoFirmaUrl);
                  });
                }}
                className="solicitud-admin-icon-btn"
                title="Copiar URL"
              >
                <FileText className="w-4 h-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setAutoFirmaUrl(null)}
                className="solicitud-admin-icon-btn"
                title="Cerrar"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {typeof document !== 'undefined' && showReplaceConfirmModal && documentToReplace && createPortal(
        <Modal
          isOpen={showReplaceConfirmModal}
          onClose={() => {
            setShowReplaceConfirmModal(false);
            setDocumentToReplace(null);
          }}
          title="Confirmar Reemplazo"
          showCloseButton={false}
          footer={(
            <>
              <button
                type="button"
                onClick={() => {
                  setShowReplaceConfirmModal(false);
                  setDocumentToReplace(null);
                }}
                className="solicitud-admin-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowReplaceConfirmModal(false);

                  try {
                    setUploading(true);

                    const fileNameToDelete = documentToReplace.fileName ||
                                            documentToReplace.nombre_archivo ||
                                            documentToReplace.filename ||
                                            documentToReplace.archivo;

                    console.log('🔍 [Modal Replace] Document to replace:', documentToReplace);
                    console.log('🔍 [Modal Replace] fileName to delete:', fileNameToDelete);

                    if (!fileNameToDelete) {
                      throw new Error('No se pudo obtener el nombre del archivo del documento');
                    }

                    const deleted = await handleDeleteDocumento(documentToReplace.id, documentToReplace.doc_id, fileNameToDelete);

                    if (deleted) {
                      await new Promise(resolve => setTimeout(resolve, 500));

                      setDocumentType(documentToReplace.tipo);
                      setShowCustomTypeSourceModal(true);

                      setNotification({
                        type: 'success',
                        title: 'Documento Eliminado',
                        message: 'El documento anterior ha sido eliminado. Ahora puedes subir uno nuevo.'
                      });
                    }
                  } catch (error) {
                    console.error('Error al reemplazar documento:', error);
                    setNotification({
                      type: 'error',
                      title: 'Error',
                      message: `Error al reemplazar el documento: ${error.message}`
                    });
                  } finally {
                    setUploading(false);
                    setDocumentToReplace(null);
                  }
                }}
                disabled={uploading}
                className="solicitud-admin-btn solicitud-admin-btn--primary"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Replace className="w-4 h-4" aria-hidden />
                    <span>Confirmar Reemplazo</span>
                  </>
                )}
              </button>
            </>
          )}
        >
          <AlertBanner variant="warning" title="Esta acción no se puede deshacer">
            ¿Estás seguro de que deseas reemplazar el documento &quot;{documentToReplace.fileName}&quot;? El documento actual se eliminará permanentemente y podrás subir uno nuevo.
          </AlertBanner>
        </Modal>,
        document.body
      )}

      {/* Modal autoevaluación PRL (antes de firmar manual) */}
      {showPRLAutoevaluacion && prlDocumentForTest && (
        <PRLAutoevaluacionModal
          documento={prlDocumentForTest}
          onClose={() => {
            setShowPRLAutoevaluacion(false);
            setPrlDocumentForTest(null);
          }}
          onSuccess={async () => {
            await fetchDocumentosPRL();
            setNotification({
              type: 'success',
              title: 'Autoevaluación superada',
              message: 'Ya puedes firmar el manual.',
            });
          }}
        />
      )}

      {showPRLAutoevaluacionResult && prlDocumentForResult && (
        <PRLAutoevaluacionResultModal
          documentoId={prlDocumentForResult.id}
          admin={false}
          onClose={() => {
            setShowPRLAutoevaluacionResult(false);
            setPrlDocumentForResult(null);
          }}
        />
      )}

      {/* Modal pentru semnare PRL */}
      {(() => {
        const shouldShow = showPRLSigner && prlDocumentToSign && prlPdfUrl;
        console.log('🔍 [DocumentosPage] PRLDocumentSigner render check:', {
          showPRLSigner,
          hasPrlDocumentToSign: !!prlDocumentToSign,
          hasPrlPdfUrl: !!prlPdfUrl,
          shouldShow,
          isDocx: prlDocumentToSign?.isDocx,
          documentoId: prlDocumentToSign?.id,
          fileName: prlDocumentToSign?.nombre_archivo_original
        });
        return shouldShow;
      })() && (
        <PRLDocumentSigner
          pdfUrl={prlPdfUrl}
          documentoId={prlDocumentToSign.id}
          originalFileName={prlDocumentToSign.nombre_archivo_original}
          isDocx={prlDocumentToSign.isDocx || false}
          footerLayout={
            prlDocumentToSign.isDocx
              ? null
              : resolvePrlManualFooterLayout(
                  prlDocumentToSign.nombre_archivo_original || prlDocumentToSign.template_nombre,
                )
          }
          footerFields={
            prlDocumentToSign.isDocx
              ? null
              : resolvePrlManualFooterLayout(
                  prlDocumentToSign.nombre_archivo_original || prlDocumentToSign.template_nombre,
                )
                ? buildPrlManualFooterFields(authUser)
                : null
          }
          onClose={() => {
            setShowPRLSigner(false);
            setPrlDocumentToSign(null);
            if (prlPdfUrl) {
              window.URL.revokeObjectURL(prlPdfUrl);
            }
            setPrlPdfUrl(null);
          }}
          onSuccess={async () => {
            // Reîncarcă documentele pentru a actualiza statusul
            await fetchDocumentosPRL();
            
            setNotification({
              type: 'success',
              title: 'Documento firmado',
              message: 'El documento ha sido firmado y enviado exitosamente.',
            });
            
            // Închide modalul
            setShowPRLSigner(false);
            setPrlDocumentToSign(null);
            if (prlPdfUrl) {
              window.URL.revokeObjectURL(prlPdfUrl);
            }
            setPrlPdfUrl(null);
          }}
        />
      )}

      {/* Modal pentru semnare documente oficiale */}
      {showOficialSigner && documentoOficialToSign && documentoOficialPdfUrl && (
        <ContractSigner
          pdfUrl={documentoOficialPdfUrl}
          docId={documentoOficialToSign.doc_id || documentoOficialToSign.id || ''}
          originalFileName={documentoOficialToSign.fileName || ''}
          autoStampMode={isContratoDocumento(documentoOficialToSign)}
          onClose={() => {
            setShowOficialSigner(false);
            setDocumentoOficialToSign(null);
            if (documentoOficialPdfUrl && !documentoOficialPdfUrl.startsWith('data:')) {
              window.URL.revokeObjectURL(documentoOficialPdfUrl);
            }
            setDocumentoOficialPdfUrl(null);
          }}
          onSignComplete={async () => {
            // Esperar un momento para que el documento se guarde completamente en la base de datos
            await new Promise(resolve => setTimeout(resolve, 500));
            // Actualizar lista de documentos oficiales
            if (typeof fetchDocumentosOficiales === 'function') {
              await fetchDocumentosOficiales();
            }
            setShowOficialSigner(false);
            setDocumentoOficialToSign(null);
            if (documentoOficialPdfUrl && !documentoOficialPdfUrl.startsWith('data:')) {
              window.URL.revokeObjectURL(documentoOficialPdfUrl);
            }
            setDocumentoOficialPdfUrl(null);
            setNotification({
              type: 'success',
              title: 'Documento Firmado',
              message: 'El documento oficial ha sido firmado exitosamente'
            });
          }}
        />
      )}
    </div>
  );
} 