import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { routes } from '../../utils/routes';
import { config } from '../../config/env';
import ConfirmModal from '../ui/ConfirmModal';

const N = config.NOMINAS_LABEL;           // "Nóminas" | "Hojas de salario"
const N1 = config.NOMINAS_LABEL_SINGULAR; // "nómina" | "hoja de salario"

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

// Helper function pentru maparea erorilor
const getErrorText = (error, nombreDetectado, empleadoEncontrado) => {
  if (!error) return null; // Nu e eroare dacă error este null
  
  if (error === 'nombre_no_detectado') {
    return 'Nombre no detectado';
  } else if (error === 'employee_not_found') {
    return `Empleado "${nombreDetectado || 'N/A'}" no encontrado`;
  } else if (error === 'duplicate') {
    return `Duplicado para ${empleadoEncontrado || nombreDetectado || 'N/A'}`;
  } else if (error === 'mes_o_ano_no_detectado') {
    return 'Mes o año no detectado';
  } else if (error.startsWith('fecha_baja_establecida:')) {
    // Eroare specială pentru FECHA BAJA - extragem data
    const fechaBaja = error.replace('fecha_baja_establecida:', '');
    return `Empleado tiene FECHA BAJA establecida (${fechaBaja}). No se puede subir ${config.NOMINAS_LABEL_SINGULAR}.`;
  } else if (error.startsWith('error_procesamiento:')) {
    // Eroare de procesare - afișăm mesajul complet (truncat dacă e prea lung)
    const errorMsg = error.replace('error_procesamiento: ', '');
    return `Error de procesamiento: ${errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg}`;
  } else {
    // Alt tip de eroare - afișăm mesajul (truncat dacă e prea lung)
    return error.length > 100 ? error.substring(0, 100) + '...' : error;
  }
};

export default function NominasMatrixTab() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [empleados, setEmpleados] = useState([]);
  const [stats, setStats] = useState({ empleados_activos: 0, con_nomina: 0, sin_nomina: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [centroFilter, setCentroFilter] = useState('');
  const [showPendientes, setShowPendientes] = useState(false);
  const [filterByNomina, setFilterByNomina] = useState(null); // null = todos, 'con' = con nómina, 'sin' = sin nómina
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewNominaId, setPreviewNominaId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadEmpleado, setUploadEmpleado] = useState(null);
  const [uploadMes, setUploadMes] = useState(null);
  const [viewEmpleado, setViewEmpleado] = useState(null);
  const [viewMes, setViewMes] = useState(null);
  const [viewNominas, setViewNominas] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [nominaToDelete, setNominaToDelete] = useState(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFiles, setBulkUploadFiles] = useState([]); // Array de fișiere
  const [bulkUploadMes, setBulkUploadMes] = useState(null);
  const [bulkUploadAno, setBulkUploadAno] = useState(selectedYear);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);
  const [bulkUploadError, setBulkUploadError] = useState(null);
  const [showBulkVerificationModal, setShowBulkVerificationModal] = useState(false);
  const [bulkPreviewData, setBulkPreviewData] = useState(null);
  const [forceReplaceItems, setForceReplaceItems] = useState(new Set()); // Set de index-uri pentru duplicate-uri marcate ca "forceReplace"
  const [forceFechaBajaItems, setForceFechaBajaItems] = useState(new Set()); // Set de index-uri pentru nóminas cu FECHA BAJA marcate pentru salvare
  
  // Preview pentru upload simplu
  const [showUploadVerificationModal, setShowUploadVerificationModal] = useState(false);
  const [uploadPreviewData, setUploadPreviewData] = useState(null);
  
  // Modal accesuri
  const [showAccesosModal, setShowAccesosModal] = useState(false);
  const [accesosData, setAccesosData] = useState([]);
  const [accesosLoading, setAccesosLoading] = useState(false);
  const [selectedNominaId, setSelectedNominaId] = useState(null);

  // Căutare și filtrare
  const filteredEmpleados = useMemo(() => {
    let filtered = empleados;

    // Filtrare după căutare
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(emp => {
        const nombre = (emp.nombre_completo || '').toLowerCase();
        const codigo = (emp.CODIGO || '').toLowerCase();
        const centro = (emp.CENTRO_TRABAJO || '').toLowerCase();
        return nombre.includes(term) || codigo.includes(term) || centro.includes(term);
      });
    }

    // Filtrare după centru
    if (centroFilter.trim()) {
      const term = centroFilter.toLowerCase().trim();
      filtered = filtered.filter(emp => {
        const centro = (emp.CENTRO_TRABAJO || '').toLowerCase();
        return centro.includes(term);
      });
    }

    // Filtrare pendientes (doar cei cu cel puțin o lună fără nómina)
    if (showPendientes) {
      filtered = filtered.filter(emp => {
        return emp.nominas.some(n => !n.tiene_nomina);
      });
    }

    // Filtrare după tip nómina (con/sin)
    if (filterByNomina === 'con') {
      // Doar angajații care au cel puțin o lună cu nómina
      filtered = filtered.filter(emp => {
        if (!emp.nominas || !Array.isArray(emp.nominas)) {
          console.warn('⚠️ Empleado sin array nominas:', emp);
          return false;
        }
        const tieneAlguna = emp.nominas.some(n => {
          // Aseguramos que tiene_nomina sea true (puede venir como 1, true, "1", etc.)
          const tiene = n.tiene_nomina === true || n.tiene_nomina === 1 || n.tiene_nomina === '1';
          return tiene;
        });
        if (tieneAlguna) {
          console.log('✅ Empleado con nómina encontrado:', emp.nombre_completo, emp.nominas);
        }
        return tieneAlguna;
      });
      console.log('🔍 Filtered empleados con nómina:', filtered.length);
    } else if (filterByNomina === 'sin') {
      // Doar angajații care nu au nómina pentru toate lunile
      filtered = filtered.filter(emp => {
        if (!emp.nominas || !Array.isArray(emp.nominas)) {
          return false;
        }
        const todasSin = emp.nominas.every(n => {
          // Aseguramos que tiene_nomina sea false (puede venir como 0, false, "0", etc.)
          const tiene = n.tiene_nomina === true || n.tiene_nomina === 1 || n.tiene_nomina === '1';
          return !tiene;
        });
        return todasSin;
      });
    }

    return filtered;
  }, [empleados, searchTerm, centroFilter, showPendientes, filterByNomina]);

  // Încărcare date
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');

      // Fetch stats
      const statsUrl = routes.getGestoriaStats(selectedYear);
      console.log('📊 Fetching stats from:', statsUrl);
      const statsRes = await fetch(statsUrl, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (!statsRes.ok) {
        const errorText = await statsRes.text();
        console.error('❌ Stats error response:', errorText);
        throw new Error('Error al obtener estadísticas');
      }
      const statsData = await statsRes.json();
      console.log('📊 Stats data received:', statsData);
      // Backend returnează { success: true, empleados_activos, con_nomina, sin_nomina }
      setStats({
        empleados_activos: statsData.empleados_activos || 0,
        con_nomina: statsData.con_nomina || 0,
        sin_nomina: statsData.sin_nomina || 0,
      });

      // Fetch empleados
      const empleadosUrl = routes.getGestoriaEmpleados(selectedYear, { pendientes: showPendientes });
      console.log('👥 Fetching empleados from:', empleadosUrl);
      const empleadosRes = await fetch(empleadosUrl, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (!empleadosRes.ok) {
        const errorText = await empleadosRes.text();
        console.error('❌ Empleados error response:', errorText);
        throw new Error('Error al obtener empleados');
      }
      const empleadosData = await empleadosRes.json();
      console.log('👥 Empleados data received:', empleadosData);
      console.log('👥 Number of empleados:', empleadosData.empleados?.length || 0);
      
      // Debug: verificăm structura unui angajat
      if (empleadosData.empleados && empleadosData.empleados.length > 0) {
        const firstEmp = empleadosData.empleados[0];
        console.log('👥 First empleado structure:', firstEmp);
        console.log('👥 First empleado nominas:', firstEmp.nominas);
        if (firstEmp.nominas && firstEmp.nominas.length > 0) {
          console.log('👥 First nomina example:', firstEmp.nominas[0]);
        }
        
        // Debug: găsim angajații care au cel puțin o lună cu nómina
        const empleadosConNomina = empleadosData.empleados.filter(emp => {
          return emp.nominas && emp.nominas.some(n => {
            const tiene = n.tiene_nomina === true || n.tiene_nomina === 1 || n.tiene_nomina === '1';
            return tiene;
          });
        });
        console.log('👥 Empleados con nómina (filtered):', empleadosConNomina.length);
        if (empleadosConNomina.length > 0) {
          console.log('👥 First empleado con nómina:', empleadosConNomina[0]);
          console.log('👥 First empleado con nómina - nominas:', empleadosConNomina[0].nominas);
        }
      }
      
      // Backend returnează { success: true, empleados: [...] }
      setEmpleados(empleadosData.empleados || []);
    } catch (err) {
      setError(err.message || 'Error al cargar datos');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, showPendientes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll la top când se deschide modalul
  useEffect(() => {
    if (showViewModal || showAccesosModal) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showViewModal, showAccesosModal]);

  // Preview upload nómina (nu salvează în DB)
  const handlePreviewUpload = async () => {
    if (!uploadFile || !uploadEmpleado || uploadMes === null) {
      setUploadError('Completa todos los campos');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadPreviewData(null);

    try {
      const token = localStorage.getItem('auth_token');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('nombre', uploadEmpleado.nombre_completo);
      formData.append('codigo', uploadEmpleado.CODIGO);
      formData.append('mes', (uploadMes + 1).toString()); // 0-11 -> 1-12
      formData.append('ano', selectedYear.toString());
      formData.append('preview', 'true'); // Preview mode

      const response = await fetch(routes.uploadGestoriaNomina, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Error al procesar ${N1}` }));
        throw new Error(errorData.message || `Error al procesar ${N1}`);
      }

      const data = await response.json();
      setUploadPreviewData(data);
      setShowUploadVerificationModal(true);
    } catch (err) {
      setUploadError(err.message || `Error al procesar ${N1}`);
      console.error('Error in preview:', err);
    } finally {
      setUploading(false);
    }
  };

  // Confirmar și salvare în DB pentru upload simplu
  const handleConfirmUpload = async () => {
    if (!uploadFile || !uploadEmpleado || uploadMes === null) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const token = localStorage.getItem('auth_token');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('nombre', uploadEmpleado.nombre_completo);
      formData.append('codigo', uploadEmpleado.CODIGO);
      formData.append('mes', (uploadMes + 1).toString()); // 0-11 -> 1-12
      formData.append('ano', selectedYear.toString());
      formData.append('preview', 'false'); // Upload real

      const response = await fetch(routes.uploadGestoriaNomina, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Error al subir ${N1}` }));
        throw new Error(errorData.message || `Error al subir ${N1}`);
      }

      setUploadSuccess(true);
      setUploadFile(null);
      setShowUploadVerificationModal(false);
      setUploadPreviewData(null);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadEmpleado(null);
        setUploadMes(null);
        setUploadSuccess(false);
        fetchData(); // Recargar datos
      }, 1500);
    } catch (err) {
      setUploadError(err.message || `Error al subir ${N1}`);
    } finally {
      setUploading(false);
    }
  };

  // Ver nóminas
  const handleViewNominas = async (empleado, mes) => {
    setViewEmpleado(empleado);
    setViewMes(mes);
    setShowViewModal(true);
    setViewNominas([]);

    try {
      const token = localStorage.getItem('auth_token');
      const mesNum = mes + 1; // 0-11 -> 1-12
      const url = routes.getGestoriaNominas(empleado.nombre_completo, mesNum, selectedYear);
      
      console.log('📄 Fetching nominas:', {
        empleado: empleado.nombre_completo,
        mes: mesNum,
        ano: selectedYear,
        url: url,
      });

      const response = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Error al obtener ${N}`);
      }
      
      const data = await response.json();
      console.log('📄 Nominas data received:', data);
      console.log('📄 Number of nominas:', data.nominas?.length || 0);
      
      setViewNominas(data.nominas || []);
    } catch (err) {
      console.error('❌ Error fetching nominas:', err);
    }
  };

  // Ver accesos nómina
  const handleViewAccesos = async (nominaId) => {
    setSelectedNominaId(nominaId);
    setShowAccesosModal(true);
    setAccesosData([]);
    setAccesosLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.getNominasAccesos(nominaId);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener accesos');
      }
      
      const data = await response.json();
      console.log('📊 [handleViewAccesos] Response data:', data);
      console.log('📊 [handleViewAccesos] Accesos array:', data.accesos);
      console.log('📊 [handleViewAccesos] Total:', data.total);
      setAccesosData(data.accesos || []);
    } catch (err) {
      console.error('❌ Error fetching accesos:', err);
      setAccesosData([]);
    } finally {
      setAccesosLoading(false);
    }
  };

  // Descargar nómina
  const handleDownload = async (nominaId) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(routes.downloadGestoriaNomina(nominaId), {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('No autorizado. Por favor, inicia sesión nuevamente.');
        }
        throw new Error(`Error al descargar ${N1}`);
      }

      // Get blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nomina_${nominaId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading nomina:', err);
      alert(`Error al descargar ${N1}: ` + err.message);
    }
  };

  // Preview nómina
  const handlePreview = async (nominaId) => {
    try {
      // Închide modalul principal când se deschide preview-ul
      setShowViewModal(false);
      
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(routes.downloadGestoriaNomina(nominaId), {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('No autorizado. Por favor, inicia sesión nuevamente.');
        }
        throw new Error(`Error al cargar ${N1}`);
      }

      // Get blob from response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      setPreviewNominaId(nominaId);
      setPreviewUrl(url);
      setShowPreviewModal(true);
    } catch (err) {
      console.error('Error previewing nomina:', err);
      alert(`Error al cargar ${N1}: ` + err.message);
    }
  };

  // Eliminar nómina
  const handleDeleteClick = (nominaId) => {
    setNominaToDelete(nominaId);
    setShowDeleteConfirmModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!nominaToDelete) return;

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(routes.deleteGestoriaNomina(nominaToDelete), {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) throw new Error(`Error al eliminar ${N1}`);

      // Recargar datos
      await handleViewNominas(viewEmpleado, viewMes);
      await fetchData();
      
      setShowDeleteConfirmModal(false);
      setNominaToDelete(null);
    } catch (err) {
      console.error('Error deleting nomina:', err);
      alert(`Error al eliminar ${N1}: ` + err.message);
      setShowDeleteConfirmModal(false);
      setNominaToDelete(null);
    }
  };

  // Preview bulk upload (nu salvează în DB) - procesează multiple fișiere
  const handlePreviewBulkUpload = async () => {
    if (!bulkUploadFiles || bulkUploadFiles.length === 0) {
      setBulkUploadError('Selecciona al menos un archivo PDF');
      return;
    }

    setBulkUploading(true);
    setBulkUploadError(null);
    setBulkPreviewData(null);

    try {
      const token = localStorage.getItem('auth_token');
      
      // Procesăm toate fișierele și combinăm rezultatele
      const allResults = [];
      let totalPaginas = 0;
      let totalProcesadas = 0;
      let totalErrores = 0;
      const allDetalle = [];
      let mesDetectadoGlobal = null;
      let anoDetectadoGlobal = null;

      for (let i = 0; i < bulkUploadFiles.length; i++) {
        const file = bulkUploadFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('preview', 'true'); // Preview mode
        // Mes și ano sunt opționale - se pot detecta din PDF
        if (bulkUploadMes !== null) {
          formData.append('mes', (bulkUploadMes + 1).toString()); // 0-11 -> 1-12
        }
        if (bulkUploadAno) {
          formData.append('ano', bulkUploadAno.toString());
        }

        const response = await fetch(routes.uploadGestoriaBulk, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error procesando ${file.name}: ${errorData.message || 'Error al procesar PDF'}`);
        }

        const data = await response.json();
        allResults.push({ fileName: file.name, data });
        
        // Combinăm rezultatele
        totalPaginas += data.total_paginas || 0;
        totalProcesadas += data.procesadas || 0;
        totalErrores += data.erori || 0;
        
        // Adăugăm numele fișierului la fiecare detalle
        if (data.detalle && Array.isArray(data.detalle)) {
          data.detalle.forEach(item => {
            allDetalle.push({
              ...item,
              nombre_archivo: file.name,
            });
          });
        }
        
        // Actualizăm mes/ano global dacă nu sunt setate
        if (!mesDetectadoGlobal && data.mes_detectado) {
          mesDetectadoGlobal = data.mes_detectado;
        }
        if (!anoDetectadoGlobal && data.ano_detectado) {
          anoDetectadoGlobal = data.ano_detectado;
        }
      }

      // Creăm obiectul combinat
      const combinedData = {
        total_paginas: totalPaginas,
        procesadas: totalProcesadas,
        erori: totalErrores,
        mes_detectado: mesDetectadoGlobal || bulkUploadMes !== null ? bulkUploadMes + 1 : null,
        ano_detectado: anoDetectadoGlobal || bulkUploadAno,
        detalle: allDetalle,
        archivos_procesados: bulkUploadFiles.length,
      };

      setBulkPreviewData(combinedData);
      setShowBulkVerificationModal(true);
      
      // Actualizăm mes și ano dacă au fost detectate
      if (mesDetectadoGlobal && bulkUploadMes === null) {
        setBulkUploadMes(mesDetectadoGlobal - 1); // 1-12 -> 0-11
      }
      if (anoDetectadoGlobal && !bulkUploadAno) {
        setBulkUploadAno(anoDetectadoGlobal);
      }
    } catch (err) {
      setBulkUploadError(err.message || 'Error al procesar PDFs');
      console.error('Error in preview:', err);
    } finally {
      setBulkUploading(false);
    }
  };

  // Confirmar și salvare în DB - procesează toate fișierele
  const handleConfirmBulkUpload = async () => {
    if (!bulkUploadFiles || bulkUploadFiles.length === 0 || !bulkPreviewData) return;

    setBulkUploading(true);
    setBulkUploadError(null);

    try {
      const token = localStorage.getItem('auth_token');
      
      // Construim lista de duplicate-uri marcate pentru înlocuire
      const forceReplaceList = Array.from(forceReplaceItems).map(idx => {
        const item = bulkPreviewData.detalle[idx];
        return {
          pagina: item.pagina,
          codigo: item.codigo,
          nombre: item.nombre_detectado,
        };
      });
      
      // Construim lista de nóminas cu FECHA BAJA marcate pentru salvare
      const forceFechaBajaList = Array.from(forceFechaBajaItems).map(idx => {
        const item = bulkPreviewData.detalle[idx];
        return {
          pagina: item.pagina,
          codigo: item.codigo,
          nombre: item.nombre_detectado,
        };
      });
      
      // Procesăm toate fișierele
      const allResults = [];
      let totalPaginas = 0;
      let totalProcesadas = 0;
      let totalErrores = 0;
      const allDetalle = [];

      for (let i = 0; i < bulkUploadFiles.length; i++) {
        const file = bulkUploadFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('preview', 'false'); // Upload real
        // Folosim mes/ano detectat sau cel selectat
        const mesFinal = bulkPreviewData?.mes_detectado || (bulkUploadMes !== null ? bulkUploadMes + 1 : null);
        const anoFinal = bulkPreviewData?.ano_detectado || bulkUploadAno;
        
        if (mesFinal) {
          formData.append('mes', mesFinal.toString());
        }
        if (anoFinal) {
          formData.append('ano', anoFinal.toString());
        }
        
        // Trimitem lista de duplicate-uri marcate pentru înlocuire
        if (forceReplaceList.length > 0) {
          formData.append('forceReplace', JSON.stringify(forceReplaceList));
        }
        if (forceFechaBajaList.length > 0) {
          formData.append('forceFechaBaja', JSON.stringify(forceFechaBajaList));
        }

        const response = await fetch(routes.uploadGestoriaBulk, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error subiendo ${file.name}: ${errorData.message || `Error al subir ${N}`}`);
        }

        const data = await response.json();
        allResults.push({ fileName: file.name, data });
        
        // Combinăm rezultatele
        totalPaginas += data.total_paginas || 0;
        totalProcesadas += data.procesadas || 0;
        totalErrores += data.erori || 0;
        
        // Adăugăm numele fișierului la fiecare detalle
        if (data.detalle && Array.isArray(data.detalle)) {
          data.detalle.forEach(item => {
            allDetalle.push({
              ...item,
              nombre_archivo: file.name,
            });
          });
        }
      }

      // Creăm obiectul combinat
      const combinedResult = {
        total_paginas: totalPaginas,
        procesadas: totalProcesadas,
        erori: totalErrores,
        detalle: allDetalle,
        archivos_procesados: bulkUploadFiles.length,
      };

      setBulkUploadResult(combinedResult);
      setShowBulkVerificationModal(false);
      setBulkPreviewData(null);
      setShowBulkUploadModal(false);
      setForceReplaceItems(new Set()); // Resetăm lista de duplicate-uri marcate
      setForceFechaBajaItems(new Set()); // Resetăm lista de nóminas cu FECHA BAJA marcate
      
      // Recargar datos después de 2 segundos
      setTimeout(async () => {
        await fetchData();
      }, 2000);
    } catch (err) {
      setBulkUploadError(err.message || `Error al subir ${N}`);
      console.error('Error in bulk upload:', err);
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con controles */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">💰 Gestión de {N}</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPendientes}
                onChange={(e) => setShowPendientes(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Solo pendientes</span>
            </label>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => {
            setFilterByNomina(null);
            setShowPendientes(false);
          }}
          className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
            filterByNomina === null 
              ? 'border-blue-500 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Total Activos</div>
          <div className="text-2xl font-bold text-gray-900">{stats.empleados_activos}</div>
          {filterByNomina === null && (
            <div className="text-xs text-blue-600 mt-1">✓ Filtro activo</div>
          )}
        </div>
        <div 
          onClick={() => {
            setFilterByNomina('con');
            setShowPendientes(false);
          }}
          className={`bg-green-50 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
            filterByNomina === 'con' 
              ? 'border-green-500 shadow-md' 
              : 'border-green-200 hover:border-green-300'
          }`}
        >
          <div className="text-sm text-green-600">Con {N}</div>
          <div className="text-2xl font-bold text-green-700">{stats.con_nomina}</div>
          {filterByNomina === 'con' && (
            <div className="text-xs text-green-600 mt-1">✓ Filtro activo</div>
          )}
        </div>
        <div 
          onClick={() => {
            setFilterByNomina('sin');
            setShowPendientes(false);
          }}
          className={`bg-red-50 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
            filterByNomina === 'sin' 
              ? 'border-red-500 shadow-md' 
              : 'border-red-200 hover:border-red-300'
          }`}
        >
          <div className="text-sm text-red-600">Sin {N}</div>
          <div className="text-2xl font-bold text-red-700">{stats.sin_nomina}</div>
          {filterByNomina === 'sin' && (
            <div className="text-xs text-red-600 mt-1">✓ Filtro activo</div>
          )}
        </div>
      </div>

      {/* Botón Bulk Upload */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowBulkUploadModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
        >
          📦 Subir Múltiples {N}
        </button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">🔍 Buscar</label>
          <input
            id="nominas-matrix-search"
            name="nominas-matrix-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, código, centro..."
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">🏢 Filtrar por Centro</label>
          <input
            id="nominas-matrix-centro-filter"
            name="nominas-matrix-centro-filter"
            type="text"
            value={centroFilter}
            onChange={(e) => setCentroFilter(e.target.value)}
            placeholder="Filtrar por centro de trabajo..."
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Tabel matrice */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ❌ {error}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-500 to-green-600 text-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-bold sticky left-0 bg-green-600 z-10 min-w-[200px]">
                    Empleado
                  </th>
                  {MESES.map((mes, idx) => (
                    <th key={idx} className="px-3 py-3 text-center font-bold min-w-[80px]">
                      {mes}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmpleados.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron empleados
                    </td>
                  </tr>
                ) : (
                  filteredEmpleados.map((emp) => (
                    <tr key={emp.CODIGO} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 font-medium">
                        <div className="font-semibold text-gray-900">{emp.nombre_completo}</div>
                        <div className="text-xs text-gray-500">{emp.CODIGO}</div>
                        <div className="text-xs text-gray-400">{emp.CENTRO_TRABAJO}</div>
                      </td>
                      {emp.nominas.map((nomina, idx) => (
                        <td key={idx} className="px-3 py-3 text-center">
                          {nomina.tiene_nomina ? (
                            <button
                              onClick={() => handleViewNominas(emp, idx)}
                              className="text-green-600 hover:text-green-700 font-bold text-lg"
                              title={`Ver ${N}`}
                            >
                              ✅
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setUploadEmpleado(emp);
                                setUploadMes(idx);
                                setShowUploadModal(true);
                                setUploadFile(null);
                                setUploadError(null);
                                setUploadSuccess(false);
                              }}
                              className="text-red-600 hover:text-red-700 font-bold text-lg"
                              title={`Subir ${N1}`}
                            >
                              ❌
                            </button>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Upload */}
      {showUploadModal && uploadEmpleado && uploadMes !== null && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUploadModal(false);
              setUploadEmpleado(null);
              setUploadMes(null);
              setUploadFile(null);
              setUploadError(null);
              setUploadSuccess(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Subir {N1.charAt(0).toUpperCase() + N1.slice(1)}</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadEmpleado(null);
                  setUploadMes(null);
                  setUploadFile(null);
                  setUploadError(null);
                  setUploadSuccess(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Empleado</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {uploadEmpleado.nombre_completo} ({uploadEmpleado.CODIGO})
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {MESES[uploadMes]} {selectedYear}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Archivo PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  ❌ {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  ✅ {N1.charAt(0).toUpperCase() + N1.slice(1)} subida correctamente
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadEmpleado(null);
                    setUploadMes(null);
                    setUploadFile(null);
                    setUploadError(null);
                    setUploadSuccess(false);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePreviewUpload}
                  disabled={uploading || !uploadFile}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {uploading ? 'Procesando...' : 'Verificar y Subir'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Ver Nóminas */}
      {showViewModal && viewEmpleado && viewMes !== null && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            // Închide modalul când se face click pe backdrop
            if (e.target === e.currentTarget) {
              setShowViewModal(false);
              setViewEmpleado(null);
              setViewMes(null);
              setViewNominas([]);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {N} de {viewEmpleado.nombre_completo} - {MESES[viewMes]} {selectedYear}
                </h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewEmpleado(null);
                    setViewMes(null);
                    setViewNominas([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {viewNominas.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No hay {N.toLowerCase()} para este mes
                </div>
              ) : (
                <div className="space-y-3">
                  {viewNominas.map((nomina) => (
                    <div key={nomina.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">
                          Subida: {new Date(nomina.fecha_subida).toLocaleDateString('es-ES')}
                        </div>
                        <div className="text-sm text-gray-500">
                          Tipo: {nomina.tipo_mime}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePreview(nomina.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          👁️ Ver
                        </button>
                        <button
                          onClick={() => handleDownload(nomina.id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          📥 Descargar
                        </button>
                        <button
                          onClick={() => handleViewAccesos(nomina.id)}
                          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                        >
                          📊 Accesos
                        </button>
                        <button
                          onClick={() => handleDeleteClick(nomina.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Bulk Upload */}
      {showBulkUploadModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  📦 Subir Múltiples {N}
                </h3>
                <button
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setBulkUploadFiles([]);
                    setBulkUploadMes(null);
                    setBulkUploadError(null);
                    setBulkUploadResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {bulkUploadResult ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    ✅ Proceso completado: {bulkUploadResult.procesadas}/{bulkUploadResult.total_paginas} {N.toLowerCase()} procesadas
                  </div>
                  
                  {bulkUploadResult.erori > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
                      ⚠️ {bulkUploadResult.erori} errores encontrados
                    </div>
                  )}

                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Detalle del proceso:</h4>
                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Página</th>
                            <th className="px-3 py-2 text-left">Nombre Detectado</th>
                            <th className="px-3 py-2 text-left">Empleado</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkUploadResult.detalle?.map((item, idx) => (
                            <tr key={idx} className={item.inserted ? 'bg-green-50' : 'bg-red-50'}>
                              <td className="px-3 py-2">{item.pagina}</td>
                              <td className="px-3 py-2">{item.nombre_detectado || '-'}</td>
                              <td className="px-3 py-2">
                                {item.mes_detectado && item.ano_detectado 
                                  ? `${MESES[item.mes_detectado - 1]} ${item.ano_detectado}`
                                  : item.mes_detectado || item.ano_detectado
                                    ? `${item.mes_detectado || '?'}/${item.ano_detectado || '?'}`
                                    : '-'
                                }
                              </td>
                              <td className="px-3 py-2">{item.empleado_encontrado || '-'}</td>
                              <td className="px-3 py-2">
                                {item.inserted ? (
                                  <span className="text-green-600">✅ Insertado</span>
                                ) : (
                                  <span className="text-red-600">❌ {item.error || 'Error'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📄 Archivos PDF (puedes seleccionar múltiples)
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setBulkUploadFiles(files);
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {bulkUploadFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-sm text-gray-600 font-medium">
                          {bulkUploadFiles.length} archivo(s) seleccionado(s):
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                          {bulkUploadFiles.map((file, idx) => (
                            <div key={idx} className="text-xs text-gray-700 py-1">
                              📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📅 Mes <span className="text-xs text-gray-500">(opcional - se detecta automáticamente)</span>
                      </label>
                      <select
                        value={bulkUploadMes !== null ? bulkUploadMes : ''}
                        onChange={(e) => setBulkUploadMes(e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Se detectará automáticamente</option>
                        {MESES.map((mes, idx) => (
                          <option key={idx} value={idx}>{mes}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📅 Año <span className="text-xs text-gray-500">(opcional - se detecta automáticamente)</span>
                      </label>
                      <input
                        type="number"
                        value={bulkUploadAno || ''}
                        onChange={(e) => setBulkUploadAno(e.target.value ? parseInt(e.target.value, 10) : null)}
                        min="2000"
                        max="2100"
                        placeholder="Se detectará automáticamente"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {bulkUploadError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      ❌ {bulkUploadError}
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
                    ℹ️ Puedes seleccionar múltiples archivos PDF. Cada PDF puede tener una o múltiples páginas (una {N1} por página). El sistema intentará detectar automáticamente el nombre del empleado, mes y año en cada página. Si no se especifican mes y año, se detectarán automáticamente del PDF.
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setBulkUploadFiles([]);
                    setBulkUploadMes(null);
                    setBulkUploadError(null);
                    setBulkUploadResult(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  {bulkUploadResult ? 'Cerrar' : 'Cancelar'}
                </button>
                {!bulkUploadResult && (
                  <button
                    onClick={handlePreviewBulkUpload}
                    disabled={bulkUploading || !bulkUploadFiles || bulkUploadFiles.length === 0}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {bulkUploading ? 'Procesando...' : 'Verificar y Subir'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Verificación Bulk Upload */}
      {showBulkVerificationModal && bulkPreviewData && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
        >
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    📋 Verificación de {N}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Revisa los detalles antes de confirmar la subida
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowBulkVerificationModal(false);
                    setBulkPreviewData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-sm text-blue-600 font-medium">Total Páginas</div>
                  <div className="text-3xl font-bold text-blue-700">{bulkPreviewData.total_paginas}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-sm text-green-600 font-medium">Listas para Subir</div>
                  <div className="text-3xl font-bold text-green-700">
                    {bulkPreviewData.procesadas + (bulkPreviewData.detalle?.filter((item, idx) => 
                      (item.error === 'duplicate' && forceReplaceItems.has(idx)) ||
                      (item.error && item.error.startsWith('fecha_baja_establecida:') && forceFechaBajaItems.has(idx))
                    ).length || 0)}
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-sm text-red-600 font-medium">Con Errores</div>
                  <div className="text-3xl font-bold text-red-700">{bulkPreviewData.erori}</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="text-sm text-purple-600 font-medium">Mes/Año Detectado</div>
                  <div className="text-lg font-bold text-purple-700">
                    {bulkPreviewData.mes_detectado && bulkPreviewData.ano_detectado
                      ? `${MESES[bulkPreviewData.mes_detectado - 1]} ${bulkPreviewData.ano_detectado}`
                      : bulkPreviewData.mes_detectado || bulkPreviewData.ano_detectado
                        ? `${bulkPreviewData.mes_detectado || '?'}/${bulkPreviewData.ano_detectado || '?'}`
                        : 'No detectado'
                    }
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="text-sm text-orange-600 font-medium">Finiquitos</div>
                  <div className="text-3xl font-bold text-orange-700">
                    {bulkPreviewData.detalle?.filter(item => item.esFiniquito).length || 0}
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <div className="text-sm text-indigo-600 font-medium">Archivos</div>
                  <div className="text-3xl font-bold text-indigo-700">
                    {bulkPreviewData.archivos_procesados || 1}
                  </div>
                </div>
              </div>

              {/* Lista de empleados */}
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Detalle por Empleado:</h4>
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Archivo</th>
                        <th className="px-3 py-2 text-left">Página</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Nombre Detectado</th>
                        <th className="px-3 py-2 text-left">Mes/Año</th>
                        <th className="px-3 py-2 text-left">Empleado Encontrado</th>
                        <th className="px-3 py-2 text-left">Código</th>
                        <th className="px-3 py-2 text-left">Fecha Alta (DB)</th>
                        <th className="px-3 py-2 text-left">Fecha Alta Ext.</th>
                        <th className="px-3 py-2 text-left">Fecha Antig. (DB)</th>
                        <th className="px-3 py-2 text-left">Fecha Antig. Ext.</th>
                        <th className="px-3 py-2 text-left">Fecha Baja (DB)</th>
                        <th className="px-3 py-2 text-left">Fecha Baja Ext.</th>
                        <th className="px-3 py-2 text-left">SEG. SOCIAL (DB)</th>
                        <th className="px-3 py-2 text-left">SEG. SOCIAL Ext.</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreviewData.detalle?.map((item, idx) => (
                        <tr key={idx} className={
                          item.inserted 
                            ? 'bg-green-50' 
                            : item.error === 'duplicate' 
                              ? 'bg-yellow-50' 
                              : item.error 
                                ? 'bg-red-50' 
                                : item.empleado_encontrado && item.codigo 
                                  ? 'bg-green-50' 
                                  : 'bg-gray-50'
                        }>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {item.nombre_archivo ? (
                              <span className="font-mono" title={item.nombre_archivo}>
                                {item.nombre_archivo.length > 20 
                                  ? item.nombre_archivo.substring(0, 20) + '...' 
                                  : item.nombre_archivo}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2">{item.pagina}</td>
                          <td className="px-3 py-2">
                            {item.esFiniquito ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                                ⚠️ FINIQUITO
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                                📄 {N1.charAt(0).toUpperCase() + N1.slice(1).toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{item.nombre_detectado || '-'}</td>
                          <td className="px-3 py-2">
                            {item.mes_detectado && item.ano_detectado 
                              ? `${MESES[item.mes_detectado - 1]} ${item.ano_detectado}`
                              : item.mes_detectado || item.ano_detectado
                                ? `${item.mes_detectado || '?'}/${item.ano_detectado || '?'}`
                                : '-'
                            }
                          </td>
                          <td className="px-3 py-2">{item.empleado_encontrado || '-'}</td>
                          <td className="px-3 py-2">{item.codigo || '-'}</td>
                          <td className="px-3 py-2 text-xs">
                            {item.fechaAltaDB ? (
                              <span className="text-gray-700">{item.fechaAltaDB}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.fechaAltaExtraida ? (
                              <span className="text-green-600 font-semibold">{item.fechaAltaExtraida}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.fechaAntiguedadDB ? (
                              <span className="text-gray-700">{item.fechaAntiguedadDB}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.fechaAntiguedadExtraida ? (
                              <span className="text-blue-600 font-semibold">{item.fechaAntiguedadExtraida}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.fechaBajaDB ? (
                              <span className="text-gray-700">{item.fechaBajaDB}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.fechaBajaExtraida ? (
                              <span className="text-orange-600 font-semibold">{item.fechaBajaExtraida}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.segSocialDB ? (
                              <span className="text-gray-700">{item.segSocialDB}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.segSocialExtraido ? (
                              <span className="text-blue-600 font-semibold">{item.segSocialExtraido}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                            {item.actualizaraSegSocial && (
                              <span className="ml-1 text-yellow-600" title="Se actualizará en la base de datos">⚠️</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              {item.inserted ? (
                                <span className="text-green-600 font-semibold">✅ Listo</span>
                              ) : item.error === 'duplicate' ? (
                                <div className="flex flex-col gap-1">
                                  {forceReplaceItems.has(idx) ? (
                                    <span className="text-green-600 font-semibold">✅ Listo para subir (reemplazar)</span>
                                  ) : (
                                    <>
                                      <span className="text-yellow-600 font-semibold">⚠️ Duplicado</span>
                                      <button
                                        onClick={() => {
                                          const newSet = new Set(forceReplaceItems);
                                          newSet.add(idx);
                                          setForceReplaceItems(newSet);
                                        }}
                                        className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                      >
                                        Marcar para reemplazar
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : item.error && item.error.startsWith('fecha_baja_establecida:') ? (
                                <div className="flex flex-col gap-1">
                                  {forceFechaBajaItems.has(idx) ? (
                                    <span className="text-green-600 font-semibold">✅ Listo para subir (con FECHA BAJA)</span>
                                  ) : (
                                    <>
                                      <span className="text-red-600 font-semibold">❌ {getErrorText(item.error, item.nombre_detectado, item.empleado_encontrado)}</span>
                                      <button
                                        onClick={() => {
                                          const newSet = new Set(forceFechaBajaItems);
                                          newSet.add(idx);
                                          setForceFechaBajaItems(newSet);
                                        }}
                                        className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                      >
                                        Confirmar y subir de todas formas
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : item.error ? (
                                <span className="text-red-600 font-semibold" title={item.error || 'Error'}>
                                  ❌ {getErrorText(item.error, item.nombre_detectado, item.empleado_encontrado)}
                                </span>
                              ) : item.empleado_encontrado && item.codigo ? (
                                <span className="text-green-600 font-semibold">✅ Listo para subir</span>
                              ) : (
                                <span className="text-gray-600 font-semibold">⏳ Pendiente</span>
                              )}
                              {item.esFiniquito && item.actualizaraEstado && (
                                <div className="text-xs text-orange-700 font-semibold mt-1">
                                  → Estado: {item.estadoActual} → INACTIVO
                                </div>
                              )}
                              {item.tieneFiniquitoExistente && !item.esFiniquito && (
                                <div className="text-xs text-red-700 font-semibold mt-1 bg-red-50 border border-red-200 rounded px-2 py-1">
                                  ⚠️ Este angajatul are deja un FINIQUITO urcat!
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen de errores */}
              {bulkPreviewData.erori > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4">
                  <div className="font-semibold mb-2">⚠️ Errores encontrados:</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {bulkPreviewData.detalle?.filter(item => !item.inserted && item.error).map((item, idx) => {
                      const errorText = getErrorText(item.error, item.nombre_detectado, item.empleado_encontrado);
                      if (!errorText) return null; // Skip dacă nu e eroare
                      return (
                        <li key={idx}>
                          Página {item.pagina}: {errorText}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBulkVerificationModal(false);
                    setBulkPreviewData(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmBulkUpload}
                  disabled={bulkUploading || (bulkPreviewData.procesadas + (bulkPreviewData.detalle?.filter((item, idx) => 
                    (item.error === 'duplicate' && forceReplaceItems.has(idx)) ||
                    (item.error && item.error.startsWith('fecha_baja_establecida:') && forceFechaBajaItems.has(idx))
                  ).length || 0)) === 0}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                >
                  {bulkUploading ? 'Subiendo...' : `Confirmar y Subir (${bulkPreviewData.procesadas + (bulkPreviewData.detalle?.filter((item, idx) => 
                    (item.error === 'duplicate' && forceReplaceItems.has(idx)) ||
                    (item.error && item.error.startsWith('fecha_baja_establecida:') && forceFechaBajaItems.has(idx))
                  ).length || 0)} {N})`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Verificación Upload Simplu */}
      {showUploadVerificationModal && uploadPreviewData && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-green-100">
              <h3 className="text-xl font-bold text-gray-900">Verificar {N1.charAt(0).toUpperCase() + N1.slice(1)} antes de Subir</h3>
              <p className="text-sm text-gray-600 mt-1">Revisa los detalles antes de confirmar</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Información básica */}
              <div className="space-y-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-600 font-medium mb-2">Empleado</div>
                  <div className="text-lg font-bold text-blue-900">
                    {uploadEmpleado?.nombre_completo} ({uploadEmpleado?.CODIGO})
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-sm text-purple-600 font-medium mb-2">Mes/Año</div>
                  <div className="text-lg font-bold text-purple-900">
                    {MESES[uploadMes]} {selectedYear}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 font-medium mb-2">Nombre en Sistema</div>
                  <div className="text-lg font-bold text-gray-900">
                    {uploadPreviewData.nombre}
                  </div>
                </div>
                <div className={`border-2 rounded-lg p-4 ${uploadPreviewData.esFiniquito ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
                  <div className="text-sm font-medium mb-2" style={{ color: uploadPreviewData.esFiniquito ? '#9a3412' : '#166534' }}>
                    Tipo de Documento
                  </div>
                  <div className={`text-2xl font-bold ${uploadPreviewData.esFiniquito ? 'text-orange-900' : 'text-green-900'}`}>
                    {uploadPreviewData.esFiniquito ? '⚠️ FINIQUITO' : `📄 ${N1.charAt(0).toUpperCase() + N1.slice(1).toUpperCase()}`}
                  </div>
                  {uploadPreviewData.esFiniquito && (
                    <div className="text-sm text-orange-800 mt-2">
                      Documento de liquidación y baja
                    </div>
                  )}
                </div>
              </div>

              {/* Información de SEG. SOCIAL */}
              {(uploadPreviewData.segSocialDB || uploadPreviewData.segSocialExtraido) && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
                  <div className="font-bold text-blue-900 mb-3">📋 Seguridad Social</div>
                  <div className="space-y-2 text-sm">
                    {uploadPreviewData.segSocialDB && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-700">En Base de Datos:</span>
                        <span className="text-blue-900">{uploadPreviewData.segSocialDB}</span>
                      </div>
                    )}
                    {uploadPreviewData.segSocialExtraido && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-700">Extraído de {N1.charAt(0).toUpperCase() + N1.slice(1)}:</span>
                        <span className="text-blue-900 font-semibold">{uploadPreviewData.segSocialExtraido}</span>
                      </div>
                    )}
                    {uploadPreviewData.actualizaraSegSocial && (
                      <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                        <span className="text-yellow-800 font-semibold">
                          ⚠️ Se actualizará SEG. SOCIAL en la base de datos (no existe actualmente)
                        </span>
                      </div>
                    )}
                    {!uploadPreviewData.actualizaraSegSocial && uploadPreviewData.segSocialDB && uploadPreviewData.segSocialExtraido && (
                      <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded">
                        <span className="text-green-800">
                          ✓ SEG. SOCIAL ya existe en la base de datos, no se actualizará
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Información de Fechas */}
              {(uploadPreviewData.fechaAltaDB || uploadPreviewData.fechaAltaExtraida || 
                uploadPreviewData.fechaAntiguedadDB || uploadPreviewData.fechaAntiguedadExtraida ||
                uploadPreviewData.fechaBajaDB || uploadPreviewData.fechaBajaExtraida) && (
                <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
                  <div className="font-bold text-purple-900 mb-3">📅 Fechas</div>
                  <div className="space-y-2 text-sm">
                    {uploadPreviewData.fechaAltaDB && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-700">Fecha Alta (DB):</span>
                        <span className="text-purple-900">{uploadPreviewData.fechaAltaDB}</span>
                      </div>
                    )}
                    {uploadPreviewData.fechaAltaExtraida && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-700">Fecha Alta ({N1.charAt(0).toUpperCase() + N1.slice(1)}):</span>
                        <span className="text-purple-900 font-semibold">{uploadPreviewData.fechaAltaExtraida}</span>
                      </div>
                    )}
                    {uploadPreviewData.fechaAntiguedadDB && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-700">Fecha Antigüedad (DB):</span>
                        <span className="text-purple-900">{uploadPreviewData.fechaAntiguedadDB}</span>
                      </div>
                    )}
                    {uploadPreviewData.fechaAntiguedadExtraida && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-700">Fecha Antigüedad ({N1.charAt(0).toUpperCase() + N1.slice(1)}):</span>
                        <span className="text-purple-900 font-semibold">{uploadPreviewData.fechaAntiguedadExtraida}</span>
                      </div>
                    )}
                    {uploadPreviewData.fechaBajaDB && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-700">Fecha Baja (DB):</span>
                        <span className="text-purple-900">{uploadPreviewData.fechaBajaDB}</span>
                      </div>
                    )}
                    {uploadPreviewData.fechaBajaExtraida && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-700">Fecha Baja ({N1.charAt(0).toUpperCase() + N1.slice(1)}):</span>
                        <span className="text-purple-900 font-semibold">{uploadPreviewData.fechaBajaExtraida}</span>
                      </div>
                    )}
                    {(uploadPreviewData.actualizaraFechaAlta || uploadPreviewData.actualizaraFechaAntiguedad || uploadPreviewData.actualizaraFechaBaja) && (
                      <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                        <span className="text-yellow-800 font-semibold">
                          ⚠️ Se actualizarán las fechas en la base de datos
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Alerta Finiquito */}
              {uploadPreviewData.esFiniquito && (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div className="flex-1">
                      <div className="font-bold text-orange-900 mb-2">FINIQUITO Detectado</div>
                      <div className="text-sm text-orange-800 space-y-1">
                        <p>Este documento es un <strong>finiquito</strong> (liquidación y baja).</p>
                        {uploadPreviewData.actualizaraEstado && (
                          <p className="font-semibold">
                            ⚠️ El estado del empleado se actualizará de <strong>{uploadPreviewData.estadoActual}</strong> a <strong>INACTIVO</strong>.
                          </p>
                        )}
                        {!uploadPreviewData.actualizaraEstado && uploadPreviewData.estadoActual && (
                          <p>
                            El empleado ya tiene estado <strong>{uploadPreviewData.estadoActual}</strong>, no se actualizará.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUploadVerificationModal(false);
                    setUploadPreviewData(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                >
                  {uploading ? 'Subiendo...' : 'Confirmar y Subir'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setNominaToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={`Eliminar ${N1.charAt(0).toUpperCase() + N1.slice(1)}`}
        message={`¿Estás seguro de que quieres eliminar esta ${N1}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

      {/* Modal Preview PDF */}
      {showPreviewModal && previewUrl && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl w-full h-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                Vista Previa - {N1.charAt(0).toUpperCase() + N1.slice(1)} #{previewNominaId}
              </h3>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  if (previewUrl) {
                    window.URL.revokeObjectURL(previewUrl);
                  }
                  setPreviewUrl(null);
                  setPreviewNominaId(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Preview ${N1.charAt(0).toUpperCase() + N1.slice(1)}`}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Accesos Nómina */}
      {showAccesosModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            // Închide modalul când se face click pe backdrop
            if (e.target === e.currentTarget) {
              setShowAccesosModal(false);
              setSelectedNominaId(null);
              setAccesosData([]);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  📊 Accesos a {N1.charAt(0).toUpperCase() + N1.slice(1)} #{selectedNominaId}
                </h3>
                <button
                  onClick={() => {
                    setShowAccesosModal(false);
                    setSelectedNominaId(null);
                    setAccesosData([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {accesosLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando accesos...</p>
                </div>
              ) : accesosData.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No hay accesos registrados para esta {N1}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Total:</strong> {accesosData.length} acceso(s) registrado(s)
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b">
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Fecha</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Empleado</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">IP</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">User Agent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accesosData.map((acceso) => (
                          <tr key={acceso.id} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">
                              {new Date(acceso.fecha_acceso).toLocaleString('es-ES', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <div>
                                <div className="font-medium text-gray-900">{acceso.empleado_nombre}</div>
                                <div className="text-xs text-gray-500">COD: {acceso.empleado_codigo}</div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                acceso.tipo_acceso === 'preview' ? 'bg-blue-100 text-blue-800' :
                                acceso.tipo_acceso === 'download' ? 'bg-green-100 text-green-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {acceso.tipo_acceso === 'preview' ? '👁️ Preview' :
                                 acceso.tipo_acceso === 'download' ? '📥 Download' :
                                 '📧 Email'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 text-xs">
                              {acceso.ip || '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title={acceso.user_agent || ''}>
                              {acceso.user_agent ? (acceso.user_agent.length > 50 ? acceso.user_agent.substring(0, 50) + '...' : acceso.user_agent) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

