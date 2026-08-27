import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';

import { Button, LoadingSpinner, Modal, PageHeader } from '../ui';
import { routes } from '../../utils/routes';
import { API_ENDPOINTS } from '../../utils/constants';
import { RefreshCw } from 'lucide-react';
import InspectionFiltersPanel from './InspectionFiltersPanel';
import InspectionsAdminList from './InspectionsAdminList';
import InspectionPdfPreviewModal from './InspectionPdfPreviewModal';
import { InspectionTypeIcon } from './inspectionUi';


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
  const monthYearOptions = useMemo(() => {
    const monthSet = new Set();
    inspections.forEach((inspection) => {
      const dateToUse = inspection.dateRaw || inspection.date;

      if (dateToUse && dateToUse !== 'N/A') {
        try {
          let date;

          if (inspection.dateRaw) {
            date = new Date(inspection.dateRaw);
          } else {
            const dateStr = inspection.date;
            if (dateStr.includes('/')) {
              const [day, month, year] = dateStr.split('/');
              date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            } else {
              date = new Date(dateStr);
            }
          }

          if (!Number.isNaN(date.getTime())) {
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthSet.add(yearMonth);
          }
        } catch (e) {
          console.warn('Error parsing date for month filter:', dateToUse, e);
        }
      }
    });

    return Array.from(monthSet).sort().reverse().map((monthYear) => {
      const [year, month] = monthYear.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      return { value: monthYear, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [inspections]);

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

  const sortedAndFilteredInspections = sortInspections(filteredInspections);

  const filteredEmployees = useMemo(() => employees.filter((emp) =>
    (!selectedCentro || emp.centro === selectedCentro)
    && (employeeSearchTerm === ''
      || emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
      || emp.code.toLowerCase().includes(employeeSearchTerm.toLowerCase())),
  ), [employees, selectedCentro, employeeSearchTerm]);

  const filteredCentros = useMemo(() => centros.filter((centro) =>
    centroSearchTerm === '' || centro.toLowerCase().includes(centroSearchTerm.toLowerCase()),
  ), [centros, centroSearchTerm]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setSelectedEmployee('');
    setSelectedCentro('');
    setEmployeeSearchTerm('');
    setCentroSearchTerm('');
    setInspectorSearchTerm('');
    setSelectedMonthYear('all');
    setSortBy('fecha');
    setSortOrder('desc');
    setShowEmployeeDropdown(false);
    setShowCentroDropdown(false);
  };

  const handleStartSolicitud = (inspection) => {
    setSelectedSolicitud(inspection);
    setShowTipoModal(true);
  };

  const closePreviewModal = () => {
    if (previewData?.pdfUrl && typeof previewData.pdfUrl === 'string' && previewData.pdfUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(previewData.pdfUrl);
    }
    setShowPreviewModal(false);
    setPreviewData(null);
  };

  // Încarcă automat documentele materialelor
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
      <div className="app-card app-card--pad flex justify-center py-10">
        <LoadingSpinner size="lg" text="Cargando inspecciones..." />
      </div>
    );
  }

  return (
    <div className="inspecciones-list space-y-4">
      <PageHeader
        title={onlySolicitudes ? 'Inspecciones solicitadas' : 'Lista de inspecciones'}
        subtitle={onlySolicitudes
          ? 'Solicitudes pendientes de completar'
          : 'Consulta inspecciones existentes y descarga PDFs'}
        className="inspecciones-list__header"
        actions={(
          <button
            type="button"
            className="solicitud-admin-icon-btn"
            onClick={onBackToSelection}
            aria-label="Volver a seleccion"
          >
            &larr;
          </button>
        )}
      />

      <InspectionFiltersPanel
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        selectedEmployee={selectedEmployee}
        onSelectedEmployeeChange={setSelectedEmployee}
        employeeSearchTerm={employeeSearchTerm}
        onEmployeeSearchTermChange={setEmployeeSearchTerm}
        showEmployeeDropdown={showEmployeeDropdown}
        onShowEmployeeDropdownChange={setShowEmployeeDropdown}
        filteredEmployees={filteredEmployees}
        selectedCentro={selectedCentro}
        onSelectedCentroChange={setSelectedCentro}
        centroSearchTerm={centroSearchTerm}
        onCentroSearchTermChange={setCentroSearchTerm}
        showCentroDropdown={showCentroDropdown}
        onShowCentroDropdownChange={setShowCentroDropdown}
        filteredCentros={filteredCentros}
        inspectorSearchTerm={inspectorSearchTerm}
        onInspectorSearchTermChange={setInspectorSearchTerm}
        selectedMonthYear={selectedMonthYear}
        onSelectedMonthYearChange={setSelectedMonthYear}
        monthYearOptions={monthYearOptions}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onResetFilters={resetFilters}
        loadingEmployees={loadingEmployees}
        onlySolicitudes={onlySolicitudes}
      />

      <section className="app-card app-card--pad">
        <div className="inspecciones-list-toolbar">
          <h2 className="inspecciones-section-title">
            Inspecciones ({sortedAndFilteredInspections.length})
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={fetchInspections} disabled={loading}>
            <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden />
            Actualizar
          </Button>
        </div>

        <InspectionsAdminList
          items={sortedAndFilteredInspections}
          materialesDocumentos={materialesDocumentos}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onStartSolicitud={handleStartSolicitud}
          onLoadDocs={fetchMaterialesDocumentos}
          onDownloadDoc={handleDownloadMaterialDocumento}
        />
      </section>

      <InspectionPdfPreviewModal
        isOpen={showPreviewModal}
        previewData={previewData}
        previewLoading={previewLoading}
        isIOS={isIOS}
        isAndroid={isAndroid}
        onClose={closePreviewModal}
        onDownload={(data) => handleDownload(data)}
      />

      <Modal
        isOpen={showTipoModal}
        onClose={() => {
          setShowTipoModal(false);
          setSelectedSolicitud(null);
        }}
        title="Seleccionar tipo de inspeccion"
        size="md"
        showCloseButton={false}
        className="app-modal--form"
        footer={(
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowTipoModal(false);
              setSelectedSolicitud(null);
            }}
          >
            Cancelar
          </Button>
        )}
      >
        {selectedSolicitud ? (
          <div className="space-y-4">
            <div className="app-card app-card--pad inspecciones-solicitud-info">
              <p className="text-sm font-semibold mb-2">Informacion de la solicitud</p>
              <p className="text-sm"><span className="font-semibold">Empleado:</span> {selectedSolicitud.trabajador} ({selectedSolicitud.employeeCode})</p>
              <p className="text-sm"><span className="font-semibold">Centro:</span> {selectedSolicitud.centro}</p>
              {selectedSolicitud.observaciones ? (
                <p className="text-sm mt-2"><span className="font-semibold">Observaciones:</span> {selectedSolicitud.observaciones}</p>
              ) : null}
            </div>

            <div className="inspecciones-tipo-modal-grid">
              {[
                { type: 'limpieza', title: 'Limpieza', desc: 'Inspeccion de limpieza' },
                { type: 'servicios', title: 'Servicios Auxiliares', desc: 'Inspeccion de servicios' },
                { type: 'personalizada', title: 'Personalizada', desc: 'Inspeccion personalizada' },
                { type: 'entrega-materiales', title: 'Entrega de Materiales', desc: 'Registro de entrega' },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  className="inspecciones-tipo-option"
                  onClick={() => {
                    if (onStartInspection) {
                      onStartInspection(opt.type, selectedSolicitud);
                    }
                    setShowTipoModal(false);
                    setSelectedSolicitud(null);
                  }}
                >
                  <InspectionTypeIcon type={opt.type} className="w-5 h-5 shrink-0 text-[var(--primary-color)]" />
                  <span>
                    <span className="block font-semibold text-sm">{opt.title}</span>
                    <span className="block text-xs text-gray-500">{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default InspectionList;
