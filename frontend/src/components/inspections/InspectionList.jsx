import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';

import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { routes } from '../../utils/routes';
import { API_ENDPOINTS } from '../../utils/constants';
import Back3DButton from '../Back3DButton.jsx';
import PDFViewerAndroid from '../PDFViewerAndroid.jsx';


const InspectionList = ({ onBackToSelection, onlySolicitudes = false, onStartInspection }) => {
  const { user: authUser } = useAuth();
  
  // Detectare mobile pentru PDF preview
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);
  

  // Función helper para convertir blob a Base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]); // Eliminar el prefijo data:...;base64,
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedCentro, setSelectedCentro] = useState('');
  const [employees, setEmployees] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  // State pentru documentele materialelor (pentru fiecare inspecție)
  const [materialesDocumentos, setMaterialesDocumentos] = useState({});
  
  // State pentru searchbar-uri
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [centroSearchTerm, setCentroSearchTerm] = useState('');
  const [inspectorSearchTerm, setInspectorSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showCentroDropdown, setShowCentroDropdown] = useState(false);
  const [sortBy, setSortBy] = useState('fecha'); // fecha, tipo, inspector, trabajador, centro
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [selectedMonthYear, setSelectedMonthYear] = useState('all'); // Format: 'YYYY-MM' sau 'all'
  
  // State pentru preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // State pentru modal de selectare tip inspecție
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  
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
  
  // State pentru bara desplegable
  const [showFilters, setShowFilters] = useState(true);

  // Webhook URL pentru lista inspecțiilor (folosind proxy-ul Vite)
  const INSPECTIONS_WEBHOOK = routes.getInspecciones;

  // Demo data for InspectionList
  const setDemoData = useCallback(() => {
    const demoInspections = [
      {
        id: 'DEMO-INS-001',
        type: 'limpieza',
        date: '2024-12-01',
        inspector: 'María González López',
        trabajador: 'Carlos Antonio Rodríguez',
        employeeCode: 'ADM001',
        location: 'Madrid Centro - Planta Baja',
        centro: 'Madrid Centro',
        status: 'completada',
        pdfUrl: '/api/inspections/DEMO-INS-001.pdf'
      },
      {
        id: 'DEMO-SERV-001',
        type: 'servicios',
        date: '2024-11-28',
        inspector: 'Juan Pérez Martín',
        trabajador: 'Ana Sánchez Ruiz',
        employeeCode: 'EMP004',
        location: 'Madrid Centro - Planta Primera',
        centro: 'Madrid Centro',
        status: 'completada',
        pdfUrl: '/api/inspections/DEMO-SERV-001.pdf'
      },
      {
        id: 'DEMO-INS-002',
        type: 'limpieza',
        date: '2024-11-25',
        inspector: 'Pedro Martínez García',
        trabajador: 'Laura Fernández Torres',
        employeeCode: 'EMP006',
        location: 'Madrid Centro - Oficinas',
        centro: 'Madrid Centro',
        status: 'completada',
        pdfUrl: '/api/inspections/DEMO-INS-002.pdf'
      }
    ];

    const demoEmployees = [
      { code: 'ADM001', name: 'Carlos Antonio Rodríguez', email: 'admin@demo.com', centro: 'Madrid Centro' },
      { code: 'SUP002', name: 'María González López', email: 'maria.gonzalez@demo.com', centro: 'Madrid Centro' },
      { code: 'EMP003', name: 'Juan Pérez Martín', email: 'juan.perez@demo.com', centro: 'Madrid Centro' },
      { code: 'EMP004', name: 'Ana Sánchez Ruiz', email: 'ana.sanchez@demo.com', centro: 'Madrid Centro' },
      { code: 'EMP005', name: 'Pedro Martínez García', email: 'pedro.martinez@demo.com', centro: 'Madrid Centro' },
      { code: 'EMP006', name: 'Laura Fernández Torres', email: 'laura.fernandez@demo.com', centro: 'Madrid Centro' }
    ];

    const demoCentros = ['Madrid Centro', 'Barcelona Norte', 'Valencia Sur'];

    setInspections(demoInspections);
    setEmployees(demoEmployees);
    setCentros(demoCentros);
    setLoading(false);
  }, []);

  const fetchEmployees = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchEmployees in InspectionList');
      return;
    }

    if (employees.length > 0) return; // Nu aduce din nou dacă deja sunt încărcați
    
    setLoadingEmployees(true);
    try {
      // Încarcă angajații
      const responseEmpleados = await fetch(API_ENDPOINTS.USERS, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      
      if (responseEmpleados.status === 403) {
        console.warn('🚫 403 Forbidden la getEmpleados în InspectionList. Setez lista goală.');
        setEmployees([]);
        setCentros([]);
        return;
      }
      
      const dataEmpleados = await responseEmpleados.json();
      
      // Încarcă clienții (pentru centre de trabajo)
      const responseClientes = await fetch(routes.getClientes);
      const dataClientes = await responseClientes.json();
      
      if (dataEmpleados && Array.isArray(dataEmpleados)) {
        // Mapează angajații
        const mappedEmployees = dataEmpleados.map(emp => ({
          code: emp.CODIGO || emp.codigo || '',
          name: emp['NOMBRE / APELLIDOS'] || emp.nombre || emp.NOMBRE || 'Sin nombre',
          email: emp['CORREO ELECTRONICO'] || emp.email || emp.EMAIL || '',
          centro: emp['CENTRO TRABAJO'] || emp.CENTRO_TRABAJO || emp.CENTRO || emp.centro || ''
        }));
        
        setEmployees(mappedEmployees);
        
        console.log('✅ Empleados cargados:', mappedEmployees.length);
      }
      
      if (dataClientes && Array.isArray(dataClientes)) {
        // Extrage numele clienților ca centre de trabajo
        const centrosFromClientes = dataClientes
          .map(cliente => (cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre || '').trim())
          .filter(nombre => nombre && nombre !== '' && nombre.length > 3);

        // Dedupe case-insensitiv, păstrând forma originală a primului element
        const uniqueCentros = Array.from(
          new Map(centrosFromClientes.map(n => [n.toUpperCase(), n])).values()
        ).sort();

        setCentros(uniqueCentros);

        console.log('✅ Centros de Trabajo (Clientes) cargados:', uniqueCentros.length);
        console.log('📋 Lista de centros:', uniqueCentros);
      }
    } catch (error) {
      console.error('Error fetching employees/clientes:', error);
    } finally {
      setLoadingEmployees(false);
    }
  }, [authUser?.isDemo, employees.length]);

  // Închide dropdown-urile când se face click în afara lor
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Verificăm dacă click-ul este în interiorul unui element cu clasa group/field
      // Folosim un selector de atribut pentru a evita eroarea cu slash-ul
      const clickedInsideField = event.target.closest('[class*="group/field"]') !== null;
      if (!clickedInsideField) {
        setShowEmployeeDropdown(false);
        setShowCentroDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const fetchInspections = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchInspections in InspectionList');
      return;
    }

    setLoading(true);
    try {
      let url = INSPECTIONS_WEBHOOK;
      
      // Adaugă parametrii de filtrare în URL
      const params = new URLSearchParams();
      if (selectedEmployee) {
        params.append('employeeCode', selectedEmployee);
        // Dacă este selectat un angajat, trimite și numele lui pentru matching mai precis
        const selectedEmp = employees.find(emp => emp.code === selectedEmployee);
        if (selectedEmp) {
          params.append('employeeName', selectedEmp.name);
        }
      }
      if (selectedCentro) {
        params.append('centro', selectedCentro);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: fetchHeaders,
      });

      if (response.status === 403) {
        console.warn('🚫 403 Forbidden al cargar inspecciones. Tratando como lista vacía.');
        setInspections([]);
      } else if (response.ok) {
        const data = await response.json();
        
        // Validare și procesare date
        let processedInspections = [];
        
        if (Array.isArray(data)) {
          // Tratare caz special: [{ success: true }] => fără inspecții
          if (data.length === 1 && data[0] && data[0].success === true && Object.keys(data[0]).length === 1) {
            processedInspections = [];
          } else {
          // Dacă răspunsul este direct un array
            processedInspections = data;
          }
        } else if (data.inspections && Array.isArray(data.inspections)) {
          // Dacă răspunsul are structura { inspections: [...] } sau { success: true, inspections: [...] }
          processedInspections = data.inspections;
        } else {
          processedInspections = [];
        }
        
        // Validare că fiecare inspecție are proprietățile necesare
        const validInspections = processedInspections.filter(inspection => 
          inspection && 
          typeof inspection === 'object' && 
          (inspection.id || inspection.id_inspeccion) // Acceptă ambele structuri
                ).map(inspection => {
          // Mapare proprietăți spaniole la engleză cu mai multe variante
          // Salvează data originală înainte de formatare pentru a putea fi folosită în filtre
          const rawDate = inspection.date || inspection.fecha || inspection.fecha_subida;
          const tipoInspeccion = inspection.type || inspection.tipo_inspeccion || '';
          const nombreArchivo = inspection.nombre_archivo || '';
          // Identifică cererile: nombre_archivo începe cu "SOLICITUD-" sau tipo_inspeccion = "Solicitada"
          const isSolicitud = nombreArchivo.startsWith('SOLICITUD-') || tipoInspeccion === 'Solicitada';
          
          const mappedInspection = {
            id: inspection.id || inspection.id_inspeccion,
            type: tipoInspeccion,
            date: formatDate(rawDate),
            dateRaw: rawDate, // Data originală pentru filtrare și sortare
            inspector: inspection.inspector || inspection.inspector_nombre || inspection.Nombre_Supervisor || inspection['Nombre Supervisor'] || 'N/A',
            trabajador: inspection.trabajador || inspection.nombre_empleado || 'N/A',
            employeeCode: inspection.employeeCode || inspection.codigo_empleado || 'N/A',
            location: inspection.location || inspection.ubicacion || inspection.lugar || inspection.sitio || inspection.direccion || inspection.Locacion || 'N/A',
            centro: inspection.centro || inspection.Centro || 'N/A',
            status: inspection.status || inspection.estado || inspection.estado_inspeccion || (isSolicitud ? 'Solicitada' : 'completada'),
            pdfUrl: inspection.pdfUrl || inspection.archivo?.url || inspection.archivo || inspection.url_pdf || 'N/A',
            scor_total: inspection.scor_total || null,
            nombre_archivo: nombreArchivo,
            isSolicitud: isSolicitud,
            observaciones: inspection.observaciones || null
          };
          
          return mappedInspection;
        });
        
        // Dacă onlySolicitudes este true, filtrează doar cererile
        const filteredBySolicitud = onlySolicitudes 
          ? validInspections.filter(inspection => inspection.isSolicitud)
          : validInspections;
        
        setInspections(filteredBySolicitud);
        
        // Dacă avem lista de angajați în răspuns
        if (data.employees && Array.isArray(data.employees)) {
          setEmployees(data.employees);
        }
              } else {
          // Fallback la mock data dacă webhook-ul nu funcționează
          setInspections(getMockInspections());
        }
      } catch {
        // Fallback la mock data
        setInspections(getMockInspections());
      } finally {
      setLoading(false);
    }
  }, [INSPECTIONS_WEBHOOK, authUser?.isDemo, employees, selectedCentro, selectedEmployee, onlySolicitudes]);

  useEffect(() => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo inspection data instead of fetching from backend');
      setDemoData();
      return;
    }

    fetchInspections();
    fetchEmployees();
  }, [authUser?.isDemo, fetchEmployees, fetchInspections, setDemoData]);

  const getMockInspections = () => [
    {
      id: 'INS-20250127-1030',
      type: 'limpieza',
      date: '2025-01-27',
      inspector: 'Marta García',
      trabajador: 'Juan Pérez',
      employeeCode: 'EMP001',
      location: 'Obra Madrid Norte',
      status: 'completada',
      pdfUrl: '/api/inspections/INS-20250127-1030.pdf'
    },
    {
      id: 'SERV-20250126-1420',
      type: 'servicios',
      date: '2025-01-26',
      inspector: 'Carlos López',
      trabajador: 'Ana Martínez',
      employeeCode: 'EMP002',
      location: 'Centro Madrid Sur',
      status: 'completada',
      pdfUrl: '/api/inspections/SERV-20250126-1420.pdf'
    },
    {
      id: 'INS-20250125-0915',
      type: 'limpieza',
      date: '2025-01-25',
      inspector: 'Laura Fernández',
      trabajador: 'Miguel Rodríguez',
      employeeCode: 'EMP003',
      location: 'Obra Barcelona',
      status: 'completada',
      pdfUrl: '/api/inspections/INS-20250125-0915.pdf'
    },
    {
      id: '28471c02-654b-4df7-8b44-8766975cbc80',
      type: 'servicios',
      date: '2025-01-27',
      inspector: 'Profetul Empleado',
      trabajador: 'ARIAS HENAO YISENIA',
      employeeCode: '12345',
      location: 'Madrid Centro',
      status: 'completada',
      pdfUrl: '/api/inspections/28471c02-654b-4df7-8b44-8766975cbc80.pdf'
    },
    {
      id: '688eb2a4-dab1-448e-b10d-c72793c8c56b',
      type: 'servicios',
      date: '2025-01-26',
      inspector: 'Profetul Empleado',
      trabajador: 'Profetul',
      employeeCode: '12345',
      location: 'Madrid Norte',
      status: 'completada',
      pdfUrl: '/api/inspections/688eb2a4-dab1-448e-b10d-c72793c8c56b.pdf'
    }
  ];

  // Generează lista de luni/an disponibile din inspecții
  const getAvailableMonths = () => {
    const monthSet = new Set();
    inspections.forEach(inspection => {
      // Folosește dateRaw dacă există (data originală), altfel încearcă să parseze date formatat
      const dateToUse = inspection.dateRaw || inspection.date;
      
      if (dateToUse && dateToUse !== 'N/A') {
        try {
          let date;
          
          // Dacă este dateRaw (ISO string sau timestamp), folosește direct
          if (inspection.dateRaw) {
            date = new Date(inspection.dateRaw);
          } else {
            // Dacă este date formatat (DD/MM/YYYY), parsează manual
            const dateStr = inspection.date;
            if (dateStr.includes('/')) {
              const [day, month, year] = dateStr.split('/');
              date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              date = new Date(dateStr);
            }
          }
          
          if (!isNaN(date.getTime())) {
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthSet.add(yearMonth);
          }
        } catch (e) {
          // Ignoră date invalide
          console.warn('Error parsing date for month filter:', dateToUse, e);
        }
      }
    });
    return Array.from(monthSet).sort().reverse(); // Sortate descrescător (cel mai recent primul)
  };

  const filteredInspections = inspections.filter(inspection => {
    // Validare că inspecția are toate proprietățile necesare
    if (!inspection || typeof inspection !== 'object') {
      return false;
    }
    
    const matchesSearch = (inspection.id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (inspection.trabajador?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (inspection.location?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || inspection.type === filterType;
    
    // Filtrul pentru inspector - dacă există un termen de căutare, filtrează după inspector
    const matchesInspector = !inspectorSearchTerm || 
                            (inspection.inspector?.toLowerCase() || '').includes(inspectorSearchTerm.toLowerCase());
    
    // Filtrul pentru empleado - dacă este selectat un angajat, afișează DOAR inspecțiile lui
    const matchesEmployee = !selectedEmployee || 
                           (inspection.employeeCode === selectedEmployee) ||
                           (inspection.trabajador && employees.find(emp => emp.code === selectedEmployee)?.name === inspection.trabajador);
    
    // Filtrul pentru centro - verifică dacă inspecția are un centro care se potrivește cu cel selectat
    const matchesCentro = !selectedCentro || 
                         (inspection.centro && inspection.centro === selectedCentro) ||
                         (inspection.employeeCode && employees.find(emp => emp.code === inspection.employeeCode)?.centro === selectedCentro);
    
    // Filtrul pentru lună/an - dacă este selectată o lună, afișează DOAR inspecțiile din acea lună
    let matchesMonth = true;
    if (selectedMonthYear !== 'all') {
      const dateToUse = inspection.dateRaw || inspection.date;
      if (dateToUse && dateToUse !== 'N/A') {
        try {
          let date;
          
          // Dacă este dateRaw (ISO string sau timestamp), folosește direct
          if (inspection.dateRaw) {
            date = new Date(inspection.dateRaw);
          } else {
            // Dacă este date formatat (DD/MM/YYYY), parsează manual
            const dateStr = inspection.date;
            if (dateStr.includes('/')) {
              const [day, month, year] = dateStr.split('/');
              date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              date = new Date(dateStr);
            }
          }
          
          if (!isNaN(date.getTime())) {
            const inspectionYearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            matchesMonth = inspectionYearMonth === selectedMonthYear;
          } else {
            matchesMonth = false;
          }
        } catch {
          matchesMonth = false;
        }
      } else {
        matchesMonth = false;
      }
    }
    
    return matchesSearch && matchesFilter && matchesInspector && matchesEmployee && matchesCentro && matchesMonth;
  });

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
            setPreviewData({ ...inspection, error: 'El PDF está vacío (0 bytes)' });
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
              setPreviewData({ ...inspection, pdfUrl: data.pdfUrl });
            } else {
              setPreviewData({ ...inspection, error: 'No se encontró el PDF para esta inspección' });
            }
          } catch (jsonError) {
            console.error('Error parsing JSON:', jsonError);
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
              setPreviewData({ ...inspection, error: 'No se pudo cargar el PDF para preview (blob vacío)' });
            }
          }
        }
      } else {
        setPreviewData({ ...inspection, error: 'Error al cargar el PDF' });
      }
    } catch (error) {
      console.error('Error in preview:', error);
      setPreviewData({ ...inspection, error: 'Error en la vista previa del PDF' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (inspection) => {
    try {
      // Request către backend pentru descărcare document
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
      console.error('Error al descargar:', error);
      alert('Error al descargar el PDF');
    }
  };

  // Funcție pentru a încărca documentele materialelor pentru o inspecție
  const fetchMaterialesDocumentos = useCallback(async (inspeccionId) => {
    if (!inspeccionId || materialesDocumentos[inspeccionId]) {
      return; // Deja încărcat sau ID invalid
    }

    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${routes.getMaterialesDocumentos}?inspeccion_id=${encodeURIComponent(inspeccionId)}`,
        { headers }
      );

      if (response.ok) {
        const documentos = await response.json();
        setMaterialesDocumentos(prev => ({
          ...prev,
          [inspeccionId]: documentos
        }));
      }
    } catch (error) {
      console.error('Error fetching materiales documentos:', error);
    }
  }, [materialesDocumentos]);

  // Funcție pentru a descărca un document de material
  const handleDownloadMaterialDocumento = async (docId, nombreArchivo) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Accept': 'application/pdf, application/json, image/*',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${routes.downloadMaterialDocumento}?doc_id=${docId}`,
        { headers }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo || `material_document_${docId}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error al descargar el documento');
      }
    } catch (error) {
      console.error('Error downloading material document:', error);
      alert('Error al descargar el documento');
    }
  };

  // Funcția de sortare pentru inspecții
  const sortInspections = (inspectionsList) => {
    return [...inspectionsList].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'fecha':
          // Folosește dateRaw dacă există pentru sortare corectă
          if (a.dateRaw) {
            aValue = new Date(a.dateRaw);
          } else if (a.date && a.date.includes('/')) {
            // Parsează formatul DD/MM/YYYY
            const [day, month, year] = a.date.split('/');
            aValue = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            aValue = new Date(a.date || '1900-01-01');
          }
          
          if (b.dateRaw) {
            bValue = new Date(b.dateRaw);
          } else if (b.date && b.date.includes('/')) {
            // Parsează formatul DD/MM/YYYY
            const [day, month, year] = b.date.split('/');
            bValue = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            bValue = new Date(b.date || '1900-01-01');
          }
          break;
        case 'tipo':
          aValue = a.type || '';
          bValue = b.type || '';
          break;
        case 'inspector':
          aValue = a.inspector || '';
          bValue = b.inspector || '';
          break;
        case 'trabajador':
          aValue = a.trabajador || '';
          bValue = b.trabajador || '';
          break;
        case 'centro':
          aValue = a.centro || '';
          bValue = b.centro || '';
          break;
        default:
          aValue = a.date || '';
          bValue = b.date || '';
      }
      
      if (sortBy === 'fecha') {
        // Pentru date, compară direct
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        // Pentru text, compară alfabetic
        const comparison = aValue.toString().localeCompare(bValue.toString());
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });
  };

  const getTypeLabel = (type) => {
    if (type === 'limpieza') return 'Limpieza';
    if (type === 'servicios') return 'Servicios Auxiliares';
    if (type === 'entrega-materiales') return 'Entrega de Materiales';
    if (type === 'personalizada') return 'Personalizada';
    return type || 'Desconocido';
  };

  // Aplică sortarea la inspecțiile filtrate
  const sortedAndFilteredInspections = sortInspections(filteredInspections);

  // Încarcă automat documentele materialelor pentru inspecțiile "Entrega de Materiales"
  useEffect(() => {
    if (authUser?.isDemo) return;
    
    filteredInspections.forEach(inspection => {
      if (inspection.type === 'entrega-materiales' && 
          inspection.id && 
          !materialesDocumentos[inspection.id]) {
        fetchMaterialesDocumentos(inspection.id);
      }
    });
  }, [filteredInspections, materialesDocumentos, fetchMaterialesDocumentos, authUser?.isDemo]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <span className="ml-3 text-gray-600">Cargando inspecciones...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ULTRA MODERN Header con efectos 3D */}
      <div className="mb-8 relative">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 blur-3xl"></div>
        
        <div className="relative flex items-center gap-4">
          <div onClick={onBackToSelection}>
            <Back3DButton to="#" title="Volver a selección" onClick={(e) => { e.preventDefault(); onBackToSelection(); }} />
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent mb-2">
              {onlySolicitudes ? 'Inspecciones Solicitadas' : 'Lista de Inspecciones'}
            </h1>
            <p className="text-gray-600 text-base font-medium">
              {onlySolicitudes 
                ? 'Ver todas las solicitudes de inspección pendientes de completar' 
                : 'Ver todas las inspecciones existentes y descargar los PDFs'}
            </p>
          </div>
        </div>
      </div>
        {/* Botón para mostrar/ocultar filtros */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">🔎</span>
            <span>Búsqueda y Filtros</span>
          </h3>
          
          {/* Botón Toggle ULTRA WOW */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="group relative px-6 py-3 rounded-2xl font-bold transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 shadow-xl hover:shadow-indigo-500/50 overflow-hidden"
            style={{
              background: showFilters 
                ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)'
                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-indigo-400 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"></div>
            
            {/* Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            
            <div className="relative flex items-center gap-2 text-white">
              <span className={`text-xl transform transition-all duration-500 ${showFilters ? 'rotate-180' : 'rotate-0'}`}>
                {showFilters ? '🔼' : '🔽'}
              </span>
              <span className="text-sm font-black">
                {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
              </span>
            </div>
          </button>
        </div>
        
        {/* Filtre și căutare ULTRA MODERN - DESPLEGABLE */}
        <div className={`relative group mb-6 transition-all duration-700 overflow-hidden ${
          showFilters ? 'max-h-[800px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'
        }`}>
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-3xl opacity-20 group-hover:opacity-30 blur-xl transition-all duration-500"></div>
          
          <Card className="relative bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-gray-200/50 rounded-3xl p-6"
                style={{ backdropFilter: 'blur(20px)' }}>
            
            {/* Layout reorganizado - Búsqueda arriba, filtros abajo */}
            <div className="space-y-6">
              {/* Fila 1: Búsqueda FULL WIDTH */}
              <div className="group/field">
                <label htmlFor="search-inspections" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                  <span className="text-xl">🔍</span>
                  <span className="text-lg">Búsqueda</span>
                </label>
                <div className="relative">
                  <input
                    id="search-inspections"
                    name="search-inspections"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por ID, inspector, trabajador, ubicación..."
                    className="w-full px-5 py-4 text-lg border-2 border-gray-300 rounded-2xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 hover:border-purple-300 shadow-lg focus:shadow-2xl focus:shadow-purple-500/30"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-200 hover:bg-red-500 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
                    >
                      <span className="text-sm font-bold text-gray-600 hover:text-white">✕</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Fila 2: Filtros principales en 4 columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tipo de Inspección ULTRA */}
                <div className="group/field">
                  <label htmlFor="filter-type" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <span>Tipo de Inspección</span>
                  </label>
                  <select
                    id="filter-type"
                    name="filter-type"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-red-50/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-300 hover:border-red-300 shadow-md focus:shadow-xl focus:shadow-red-500/20 font-medium cursor-pointer"
                  >
                    <option value="all">Todos los tipos</option>
                    <option value="limpieza">🧹 Limpieza</option>
                    <option value="servicios">🛡️ Servicios Auxiliares</option>
                    <option value="entrega-materiales">📦 Entrega de Materiales</option>
                    <option value="personalizada">⚙️ Personalizada</option>
                  </select>
                </div>

                {/* Inspector ULTRA - Searchbar */}
                <div className="group/field relative">
                  <label htmlFor="inspector-search" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-base">👨‍💼</span>
                    <span>Inspector</span>
                  </label>
                  <div className="relative">
                    <input
                      id="inspector-search"
                      name="inspector-search"
                      type="text"
                      placeholder="👨‍💼 Buscar inspector..."
                      value={inspectorSearchTerm}
                      onChange={(e) => setInspectorSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 hover:border-indigo-300 shadow-md focus:shadow-xl focus:shadow-indigo-500/20 font-medium"
                    />
                    {inspectorSearchTerm && (
                      <button
                        onClick={() => setInspectorSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-200 hover:bg-red-500 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                      >
                        <span className="text-xs font-bold text-gray-600 hover:text-white">✕</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Empleado ULTRA - Searchbar */}
                <div className="group/field relative">
                  <label htmlFor="employee-search" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-base">👷</span>
                    <span>Empleado</span>
                  </label>
                  <div className="relative">
                    <input
                      id="employee-search"
                      name="employee-search"
                      type="text"
                      placeholder={loadingEmployees ? '⏳ Cargando empleados...' : '👥 Buscar empleado...'}
                      value={employeeSearchTerm}
                      onChange={(e) => {
                        setEmployeeSearchTerm(e.target.value);
                        setShowEmployeeDropdown(true);
                        if (e.target.value === '') {
                          setSelectedEmployee('');
                        }
                      }}
                      onFocus={() => setShowEmployeeDropdown(true)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 hover:border-blue-300 shadow-md focus:shadow-xl focus:shadow-blue-500/20 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loadingEmployees}
                    />
                    {employeeSearchTerm && (
                      <button
                        onClick={() => {
                          setEmployeeSearchTerm('');
                          setSelectedEmployee('');
                          setShowEmployeeDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-200 hover:bg-red-500 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                      >
                        <span className="text-xs font-bold text-gray-600 hover:text-white">✕</span>
                      </button>
                    )}
                    
                    {/* Dropdown cu rezultate */}
                    {showEmployeeDropdown && !loadingEmployees && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {employees
                          .filter(emp => 
                            (!selectedCentro || emp.centro === selectedCentro) &&
                            (employeeSearchTerm === '' || 
                             emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                             emp.code.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
                          )
                          .map((employee) => (
                            <div
                              key={employee.code}
                              onClick={() => {
                                setSelectedEmployee(employee.code);
                                setEmployeeSearchTerm(employee.name);
                                setShowEmployeeDropdown(false);
                              }}
                              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-800">{employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.code}</div>
                            </div>
                          ))}
                        {employees.filter(emp => 
                          (!selectedCentro || emp.centro === selectedCentro) &&
                          (employeeSearchTerm === '' || 
                           emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                           emp.code.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
                        ).length === 0 && (
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No se encontraron empleados
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Centro de Trabajo ULTRA - Searchbar */}
                <div className="group/field relative">
                  <label htmlFor="centro-search" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-base">🏢</span>
                    <span>Centro de Trabajo</span>
                  </label>
                  <div className="relative">
                    <input
                      id="centro-search"
                      name="centro-search"
                      type="text"
                      placeholder={loadingEmployees ? '⏳ Cargando centros...' : '🏢 Buscar centro...'}
                      value={centroSearchTerm}
                      onChange={(e) => {
                        setCentroSearchTerm(e.target.value);
                        setShowCentroDropdown(true);
                        if (e.target.value === '') {
                          setSelectedCentro('');
                        }
                      }}
                      onFocus={() => setShowCentroDropdown(true)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-green-50/30 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300 hover:border-green-300 shadow-md focus:shadow-xl focus:shadow-green-500/20 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loadingEmployees}
                    />
                    {centroSearchTerm && (
                      <button
                        onClick={() => {
                          setCentroSearchTerm('');
                          setSelectedCentro('');
                          setShowCentroDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-200 hover:bg-red-500 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                      >
                        <span className="text-xs font-bold text-gray-600 hover:text-white">✕</span>
                      </button>
                    )}
                    
                    {/* Dropdown cu rezultate */}
                    {showCentroDropdown && !loadingEmployees && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {centros
                          .filter(centro => 
                            centroSearchTerm === '' || 
                            centro.toLowerCase().includes(centroSearchTerm.toLowerCase())
                          )
                          .map((centro, idx) => (
                            <div
                              key={`${centro}-${idx}`}
                              onClick={() => {
                                setSelectedCentro(centro);
                                setCentroSearchTerm(centro);
                                setShowCentroDropdown(false);
                              }}
                              className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-800">{centro}</div>
                            </div>
                          ))}
                        {centros.filter(centro => 
                          centroSearchTerm === '' || 
                          centro.toLowerCase().includes(centroSearchTerm.toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No se encontraron centros
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Fila 3: Sorting + Reset en 3-4 columnas (4 când sortBy === 'fecha') */}
              <div className={`grid grid-cols-1 gap-4 ${sortBy === 'fecha' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                {/* Ordenar por ULTRA */}
                <div className="group/field">
                  <label htmlFor="sort-by" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-base">⬇️</span>
                    <span>Ordenar por</span>
                  </label>
                  <select
                    id="sort-by"
                    name="sort-by"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      // Resetează filtrul de lună când nu mai sortează după dată
                      if (e.target.value !== 'fecha') {
                        setSelectedMonthYear('all');
                      }
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-orange-50/30 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-300 hover:border-orange-300 shadow-md focus:shadow-xl focus:shadow-orange-500/20 font-medium cursor-pointer"
                  >
                    <option value="fecha">📅 Fecha</option>
                    <option value="tipo">📋 Tipo</option>
                    <option value="inspector">👨‍💼 Inspector</option>
                    <option value="trabajador">👷 Trabajador</option>
                    <option value="centro">🏢 Centro</option>
                  </select>
                </div>

                {/* Orden ULTRA */}
                <div className="group/field">
                  <label htmlFor="sort-order" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-base">🔢</span>
                    <span>Orden</span>
                  </label>
                  <select
                    id="sort-order"
                    name="sort-order"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-cyan-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 hover:border-cyan-300 shadow-md focus:shadow-xl focus:shadow-cyan-500/20 font-medium cursor-pointer"
                  >
                    <option value="desc">⬇️ Descendente</option>
                    <option value="asc">⬆️ Ascendente</option>
                  </select>
                </div>

                {/* Filtro por Mes/Año - Apare doar când sortBy === 'fecha' */}
                {sortBy === 'fecha' && (
                  <div className="group/field">
                    <label htmlFor="month-year-filter" className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                      <span className="text-base">📆</span>
                      <span>Mes/Año</span>
                    </label>
                    <select
                      id="month-year-filter"
                      name="month-year-filter"
                      value={selectedMonthYear}
                      onChange={(e) => setSelectedMonthYear(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-purple-50/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 hover:border-purple-300 shadow-md focus:shadow-xl focus:shadow-purple-500/20 font-medium cursor-pointer"
                    >
                      <option value="all">📅 Todos los meses</option>
                      {getAvailableMonths().map(monthYear => {
                        const [year, month] = monthYear.split('-');
                        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                        const monthName = monthNames[parseInt(month) - 1];
                        return (
                          <option key={monthYear} value={monthYear}>
                            {monthName} {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
          
                {/* Botón Reset MEGA WOW */}
                <div className="group/field">
                  <div className="block text-sm font-black text-gray-800 mb-2 opacity-0 pointer-events-none">
                    Spacer
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setFilterType('all');
                      setSelectedEmployee('');
                      setSelectedCentro('');
                      setEmployeeSearchTerm('');
                      setCentroSearchTerm('');
                      setInspectorSearchTerm('');
                      setShowEmployeeDropdown(false);
                      setShowCentroDropdown(false);
                      setSortBy('fecha');
                      setSortOrder('desc');
                      setSelectedMonthYear('all');
                    }}
                    className="group relative w-full px-6 py-3 rounded-2xl font-black transition-all duration-700 transform hover:scale-110 hover:-translate-y-2 hover:rotate-3 shadow-2xl hover:shadow-purple-500/50 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, #ec4899 0%, #d946ef 30%, #a855f7 60%, #8b5cf6 100%)',
                      boxShadow: '0 15px 40px rgba(168, 85, 247, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {/* Animated glow ultra potente */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500 opacity-60 group-hover:opacity-80 blur-2xl transition-all duration-700 animate-pulse"></div>
                    
                    {/* Shimmer mega effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    
                    {/* Segundo shimmer en dirección opuesta */}
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/30 to-transparent translate-x-full group-hover:-translate-x-full transition-transform duration-1500"></div>
                    
                    {/* Particles effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                      <div className="absolute top-2 left-4 w-2 h-2 bg-white rounded-full animate-ping"></div>
                      <div className="absolute bottom-3 right-6 w-1.5 h-1.5 bg-white rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                      <div className="absolute top-4 right-8 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    
                    {/* Content con múltiples efectos */}
                    <div className="relative flex items-center justify-center gap-2 text-white">
                      {/* Icon giratorio con múltiples animaciones */}
                      <span className="text-xl transform group-hover:rotate-[360deg] group-hover:scale-125 transition-all duration-700 inline-block">
                        ✨
                      </span>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black tracking-wider">RESETEAR</span>
                        <span className="text-xs opacity-90 font-bold">Filtros</span>
                      </div>
                      <span className="text-xl transform group-hover:-rotate-[360deg] group-hover:scale-125 transition-all duration-700 inline-block">
                        🔄
                      </span>
                    </div>
                    
                    {/* Borde brillante animado */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-white/30 group-hover:border-white/60 transition-all duration-700"></div>
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Lista inspecțiilor */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-gray-900">
              Inspecciones ({sortedAndFilteredInspections.length})
            </h3>
            
            {/* SUPER 3D Refresh Button - SOLO ICONITA */}
            <button
              onClick={fetchInspections}
              disabled={loading}
              className="group relative w-12 h-12 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-xl hover:shadow-green-500/50 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
              title="Actualizar inspecciones"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-green-400 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"></div>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {/* Icon con animație de rotire */}
              <div className="relative flex items-center justify-center h-full">
                <span className="text-2xl transform group-hover:rotate-180 transition-transform duration-500">🔄</span>
              </div>
            </button>
          </div>
          
          {sortedAndFilteredInspections.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-8xl mb-6 opacity-30">📋</div>
              <h3 className="text-2xl font-bold text-gray-600 mb-2">No se encontraron inspecciones</h3>
              <p className="text-gray-500">No hay inspecciones que coincidan con los criterios de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedAndFilteredInspections.map((inspection) => (
              <div
                key={inspection.id}
                className="group relative overflow-hidden transform-gpu transition-all duration-500 hover:scale-105 hover:-translate-y-2"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Glow effect basado en tipo */}
                <div className={`absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-25 blur-xl transition-all duration-500 ${
                  inspection.type === 'limpieza' 
                    ? 'bg-gradient-to-br from-red-400 to-pink-500' 
                    : inspection.type === 'servicios'
                    ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
                    : inspection.type === 'entrega-materiales'
                    ? 'bg-gradient-to-br from-orange-400 to-amber-500'
                    : 'bg-gradient-to-br from-purple-400 to-violet-500'
                }`}></div>
                
                {/* Card principal con glassmorphism */}
                <div className={`relative backdrop-blur-xl rounded-2xl border overflow-hidden shadow-xl group-hover:shadow-2xl transition-all duration-500 ${
                  inspection.type === 'limpieza'
                    ? 'bg-gradient-to-br from-red-50/90 to-pink-50/80 border-red-200/50 group-hover:border-red-300'
                    : inspection.type === 'servicios'
                    ? 'bg-gradient-to-br from-blue-50/90 to-cyan-50/80 border-blue-200/50 group-hover:border-blue-300'
                    : inspection.type === 'entrega-materiales'
                    ? 'bg-gradient-to-br from-orange-50/90 to-amber-50/80 border-orange-200/50 group-hover:border-orange-300'
                    : 'bg-gradient-to-br from-purple-50/90 to-violet-50/80 border-purple-200/50 group-hover:border-purple-300'
                }`}
                     style={{ backdropFilter: 'blur(20px)' }}>
                  
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  
                  {/* Header cu gradient */}
                  <div className={`relative p-4 border-b ${
                    inspection.type === 'limpieza' 
                      ? 'bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-200' 
                      : inspection.type === 'servicios'
                      ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-200'
                      : inspection.type === 'entrega-materiales'
                      ? 'bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-200'
                      : 'bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-purple-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 ${
                        inspection.type === 'limpieza'
                          ? 'bg-gradient-to-br from-red-500 to-red-700'
                          : inspection.type === 'servicios'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                          : inspection.type === 'entrega-materiales'
                          ? 'bg-gradient-to-br from-orange-500 to-orange-700'
                          : 'bg-gradient-to-br from-purple-500 to-purple-700'
                      }`}
                           style={{
                             boxShadow: inspection.type === 'limpieza' 
                               ? '0 8px 20px rgba(239, 68, 68, 0.4)' 
                               : inspection.type === 'servicios'
                               ? '0 8px 20px rgba(59, 130, 246, 0.4)'
                               : inspection.type === 'entrega-materiales'
                               ? '0 8px 20px rgba(251, 191, 36, 0.4)'
                               : '0 8px 20px rgba(139, 92, 246, 0.4)'
                           }}>
                        <span className="text-xl">
                          {inspection.type === 'limpieza' ? '🧹' : 
                           inspection.type === 'servicios' ? '🛡️' :
                           inspection.type === 'entrega-materiales' ? '📦' : '⚙️'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 truncate flex-1">
                        {inspection.id}
                      </h4>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {inspection.isSolicitud ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                          ⏳ Solicitud Pendiente
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                          ✓ {inspection.status}
                        </span>
                      )}
                      {inspection.employeeCode && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-300">
                          {inspection.employeeCode}
                        </span>
                      )}
                      {inspection.scor_total !== null && inspection.scor_total !== undefined && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold border border-yellow-300">
                          ⭐ {Number(inspection.scor_total).toFixed(2)}/5
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Detalii inspecție cu icons */}
                  <div className="relative p-4 space-y-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-base">📋</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-700">Tipo:</span>
                        <span className="text-gray-600 ml-1">{getTypeLabel(inspection.type)}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base">📅</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-700">Fecha:</span>
                        <span className="text-gray-600 ml-1">{inspection.date}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base">👨‍💼</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-700">Inspector:</span>
                        <span className="text-gray-600 ml-1">
                          {inspection.isSolicitud ? 'Pendiente de asignación' : (inspection.inspector || 'N/A')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base">👷</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-700">Trabajador:</span>
                        <span className="text-gray-600 ml-1">{inspection.trabajador}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base">📍</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-700">Ubicación:</span>
                        <span className="text-gray-600 ml-1 truncate block">{inspection.location}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base">🏢</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-700">Centro:</span>
                        <span className="text-gray-600 ml-1">{inspection.centro}</span>
                      </div>
                    </div>
                    {inspection.observaciones && (
                      <div className="flex items-start gap-2">
                        <span className="text-base">📝</span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-700">Observaciones:</span>
                          <span className="text-gray-600 ml-1">{inspection.observaciones}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Documentos de Materiales - doar pentru "Entrega de Materiales" */}
                    {inspection.type === 'entrega-materiales' && (
                      <div className="flex items-start gap-2">
                        <span className="text-base">📦</span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-700">Documentos:</span>
                          <div className="mt-2 space-y-2">
                            {materialesDocumentos[inspection.id] && materialesDocumentos[inspection.id].length > 0 ? (
                              materialesDocumentos[inspection.id].map((doc) => (
                                <button
                                  key={doc.doc_id}
                                  onClick={() => handleDownloadMaterialDocumento(doc.doc_id, doc.nombre_archivo || '')}
                                  className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-all duration-200 hover:shadow-md group"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-lg">
                                      {doc.tipo_documento === 'factura' ? '🧾' : '📄'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-gray-800 truncate">
                                        {doc.nombre_archivo || `Documento ${doc.material_index + 1}`}
                                      </div>
                                      {doc.descripcion_material && (
                                        <div className="text-xs text-gray-500 truncate">
                                          {doc.descripcion_material}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-orange-600 group-hover:text-orange-700 text-sm font-medium">
                                    ⬇️ Descargar
                                  </span>
                                </button>
                              ))
                            ) : (
                              <button
                                onClick={() => fetchMaterialesDocumentos(inspection.id)}
                                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-gray-800 transition-all duration-200"
                              >
                                📦 Cargar documentos
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Butoane de acțiune ULTRA MODERN */}
                  <div className="relative p-4 pt-0 flex gap-3">
                    {inspection.isSolicitud ? (
                      /* Pentru cereri - buton pentru a începe inspecția */
                      <button
                        onClick={() => {
                          setSelectedSolicitud(inspection);
                          setShowTipoModal(true);
                        }}
                        className="group/btn relative flex-1 px-4 py-3 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)'
                        }}
                      >
                        <div className="absolute inset-0 bg-yellow-400 opacity-0 group-hover/btn:opacity-30 transition-opacity"></div>
                        <div className="relative flex items-center justify-center gap-2">
                          <span className="text-lg">🔍</span>
                          <span className="text-sm">Iniciar Inspección</span>
                        </div>
                      </button>
                    ) : (
                      /* Pentru inspecții complete - butoane normale */
                      <>
                        <button
                          onClick={() => handlePreview(inspection)}
                          className="group/btn relative flex-1 px-4 py-3 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <div className="absolute inset-0 bg-green-400 opacity-0 group-hover/btn:opacity-30 transition-opacity"></div>
                          <div className="relative flex items-center justify-center gap-2">
                            <span className="text-lg">👁️</span>
                            <span className="text-sm">Preview</span>
                          </div>
                        </button>
                        
                        <button
                          onClick={() => handleDownload(inspection)}
                          className="group/btn relative flex-1 px-4 py-3 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)'
                          }}
                        >
                          <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover/btn:opacity-30 transition-opacity"></div>
                          <div className="relative flex items-center justify-center gap-2">
                            <span className="text-lg">📥</span>
                            <span className="text-sm">Descargar</span>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </Card>

      {/* Modal ULTRA MODERN pentru preview PDF */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-none sm:rounded-3xl max-w-[95vw] sm:max-w-7xl w-full h-full sm:h-[95vh] overflow-hidden shadow-2xl border-0 sm:border border-gray-200 transform scale-100 transition-all duration-500 flex flex-col">
            {/* Header ULTRA MODERN */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-green-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <span className="text-white text-xl sm:text-2xl">👁️</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Vista Previa PDF</h3>
                    <p className="text-xs sm:text-sm text-green-600 font-medium">{previewData?.id}</p>
                  </div>
                </div>
                <button
                    onClick={() => {
                      // Cleanup blob URL dacă există
                      if (previewData?.pdfUrl && typeof previewData.pdfUrl === 'string' && previewData.pdfUrl.startsWith('blob:')) {
                        window.URL.revokeObjectURL(previewData.pdfUrl);
                        console.log('🧹 Blob URL revocat la închiderea modalului');
                      }
                      setShowPreviewModal(false);
                      setPreviewData(null);
                    }}
                  className="hidden sm:flex group w-10 h-10 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-xl items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg flex-shrink-0"
                  aria-label="Cerrar preview"
                >
                  <span className="text-gray-400 group-hover:text-red-500 text-xl font-bold">✕</span>
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 flex-1 overflow-auto bg-gray-50 min-h-0" style={{ minHeight: 'calc(95vh - 120px)' }}>
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mb-4"></div>
                  <div className="text-xl font-bold text-gray-700">Cargando PDF...</div>
                </div>
              ) : previewData?.error ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="text-6xl mb-4">❌</div>
                  <div className="text-red-600 text-xl font-bold">{previewData.error}</div>
                </div>
              ) : previewData?.pdfUrl ? (
                <div className="bg-white rounded-xl shadow-lg p-2 pdf-preview-container" style={{ minHeight: 'calc(95vh - 180px)', height: '100%' }}>
                  {isAndroid || isIOS ? (
                    <PDFViewerAndroid 
                      pdfUrl={previewData.pdfUrl}
                      className="w-full h-full"
                      onClose={() => {
                        // Cleanup blob URL dacă există
                        if (previewData?.pdfUrl && typeof previewData.pdfUrl === 'string' && previewData.pdfUrl.startsWith('blob:')) {
                          window.URL.revokeObjectURL(previewData.pdfUrl);
                          console.log('🧹 Blob URL revocat la închiderea modalului');
                        }
                        setShowPreviewModal(false);
                        setPreviewData(null);
                      }}
                    />
                  ) : (
                <iframe
                  src={previewData.pdfUrl}
                      className="w-full h-full border-0 rounded-lg"
                      style={{ minHeight: 'calc(95vh - 200px)' }}
                  title={`Preview ${previewData.id}`}
                />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="text-6xl mb-4">📄</div>
                  <div className="text-gray-600 text-xl font-bold">No se encontró el PDF</div>
                </div>
              )}
            </div>
            
            {/* Buton de închidere fixat jos - VIZIBIL PE MOBIL */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white sm:hidden" style={{ zIndex: 10001, marginBottom: '64px' }}>
              <button
                onClick={() => {
                  // Cleanup blob URL dacă există
                  if (previewData?.pdfUrl && typeof previewData.pdfUrl === 'string' && previewData.pdfUrl.startsWith('blob:')) {
                    window.URL.revokeObjectURL(previewData.pdfUrl);
                    console.log('🧹 Blob URL revocat la închiderea modalului');
                  }
                  setShowPreviewModal(false);
                  setPreviewData(null);
                }}
                className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold text-lg rounded-none transition-all duration-200 shadow-lg touch-manipulation"
                aria-label="Cerrar preview"
                style={{ 
                  paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
                  position: 'relative',
                  zIndex: 10001
                }}
              >
                Cerrar preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru selectarea tipului de inspecție */}
      <Modal
        isOpen={showTipoModal}
        onClose={() => {
          setShowTipoModal(false);
          setSelectedSolicitud(null);
        }}
        title="Seleccionar Tipo de Inspección"
        size="md"
        showCloseButton={false}
      >
        {selectedSolicitud && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Información de la Solicitud:</p>
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Empleado:</span> {selectedSolicitud.trabajador} ({selectedSolicitud.employeeCode})
              </p>
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Centro:</span> {selectedSolicitud.centro}
              </p>
              {selectedSolicitud.observaciones && (
                <p className="text-sm text-blue-800 mt-2">
                  <span className="font-semibold">Observaciones:</span> {selectedSolicitud.observaciones}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecciona el tipo de inspección que deseas realizar:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (onStartInspection) {
                      onStartInspection('limpieza', selectedSolicitud);
                    }
                    setShowTipoModal(false);
                    setSelectedSolicitud(null);
                  }}
                  className="p-4 border-2 border-red-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🧹</span>
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-red-600">Limpieza</p>
                      <p className="text-xs text-gray-600">Inspección de limpieza</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (onStartInspection) {
                      onStartInspection('servicios', selectedSolicitud);
                    }
                    setShowTipoModal(false);
                    setSelectedSolicitud(null);
                  }}
                  className="p-4 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🛡️</span>
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-blue-600">Servicios Auxiliares</p>
                      <p className="text-xs text-gray-600">Inspección de servicios</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (onStartInspection) {
                      onStartInspection('personalizada', selectedSolicitud);
                    }
                    setShowTipoModal(false);
                    setSelectedSolicitud(null);
                  }}
                  className="p-4 border-2 border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">⚙️</span>
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-purple-600">Personalizada</p>
                      <p className="text-xs text-gray-600">Inspección personalizada</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (onStartInspection) {
                      onStartInspection('entrega-materiales', selectedSolicitud);
                    }
                    setShowTipoModal(false);
                    setSelectedSolicitud(null);
                  }}
                  className="p-4 border-2 border-orange-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📦</span>
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-orange-600">Entrega de Materiales</p>
                      <p className="text-xs text-gray-600">Registro de entrega</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowTipoModal(false);
                  setSelectedSolicitud(null);
                }}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InspectionList; 