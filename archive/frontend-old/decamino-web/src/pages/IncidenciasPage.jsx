import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { useLocation } from '../contexts/LocationContextBase';
import { useApi } from '../hooks/useApi';
import { exportToExcelWithHeader } from '../utils/exportExcel';
import Back3DButton from '../components/Back3DButton';
import { Card } from '../components/ui';

// Coloane pentru afișare în tabel - exact ca în Excel
const DISPLAY_COLUMNS = [
  // TIPO și PRIORIDAD (noi coloane la început)
  { key: 'tipo', label: 'Tipo', width: 15 },
  { key: 'prioridad', label: 'Prioridad', width: 15 },
  // APERTURA INCIDENCIA
  { key: 'fecha', label: 'Fecha', width: 12 },
  { key: 'hora', label: 'Hora', width: 10 },
  { key: 'auxiliar', label: 'Auxiliar', width: 15 },
  // DESCRIPCION  
  { key: 'descripcion', label: 'Incidencia/Avería', width: 30 },
  // AVISO
  { key: 'personaInformada', label: 'Persona Informada', width: 30 },
  // RESOLUCION
  { key: 'resolucionFecha', label: 'Fecha', width: 12 },
  { key: 'resolucionHora', label: 'Hora', width: 10 },
  { key: 'resolucionAuxiliar', label: 'Auxiliar', width: 15 }
];

// Coloane pentru export (toate din backend)
const EXPORT_COLUMNS = [
  { key: 'id', label: 'ID', width: 8 },
  { key: 'codigo', label: 'Código', width: 12 },
  { key: 'fecha', label: 'Fecha', width: 14 },
  { key: 'hora', label: 'Hora', width: 10 },
  { key: 'nombre', label: 'Empleado', width: 24 },
  { key: 'email', label: 'Email', width: 30 },
  { key: 'centroTrabajo', label: 'Centro Trabajo', width: 35 },
  { key: 'address', label: 'Dirección', width: 40 },
  { key: 'created_at', label: 'Creado', width: 20 },
  // APERTURA INCIDENCIA
  { key: 'fecha', label: 'Fecha', width: 12 },
  { key: 'hora', label: 'Hora', width: 10 },
  { key: 'auxiliar', label: 'Auxiliar', width: 15 },
  // DESCRIPCION
  { key: 'descripcion', label: 'Incidencia/Avería', width: 30 },
  // AVISO
  { key: 'personaInformada', label: 'Persona Informada', width: 30 },
  // RESOLUCION
  { key: 'resolucionFecha', label: 'Fecha', width: 12 },
  { key: 'resolucionHora', label: 'Hora', width: 10 },
  { key: 'resolucionAuxiliar', label: 'Auxiliar', width: 15 },
  { key: 'tipo', label: 'Tipo', width: 20 },
  { key: 'ubicacion', label: 'Ubicación', width: 26 },
  { key: 'prioridad', label: 'Prioridad', width: 16 },
  { key: 'estado', label: 'Estado', width: 16 },
  { key: 'observaciones', label: 'Observaciones', width: 32 },
  { key: 'solucion', label: 'Solución', width: 32 }
];

const getMadridDate = () => {
  const now = new Date();
  const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return madridTime;
};

const IncidenciasPage = () => {
  const { user } = useAuth();
  const { currentLocation, currentAddress } = useLocation();
  const { callApi, routes } = useApi();
  
  // Obtiene el centro de trabajo desde los datos del usuario, probando múltiples variantes y búsqueda heurística
  const getCentroTrabajoFromUser = useCallback((u) => {
    if (!u) return '';
    
    // First, check the exact key used in DatosPage
    if (u['CENTRO TRABAJO'] && String(u['CENTRO TRABAJO']).trim()) {
      return String(u['CENTRO TRABAJO']).trim();
    }
    
    const preferredKeys = [
      'CENTRO DE TRABAJO',
      'centro de trabajo',
      'CENTRO_DE_TRABAJO',
      'centroDeTrabajo',
      'centro_trabajo',
      'CENTRO',
      'centro',
      'CENTER',
      'center',
      'DEPARTAMENTO',
      'departamento'
    ];
    for (const k of preferredKeys) {
      if (u[k] && String(u[k]).trim()) {
        return String(u[k]).trim();
      }
    }
    // Heurística: primer campo cuyo nombre contiene 'centro' o 'trabajo'
    try {
      const allKeys = Object.keys(u || {});
      const key = allKeys.find(key => {
        const lk = key.toLowerCase();
        return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(u[key]).trim();
      });
      if (key) {
        return String(u[key]).trim();
      }
    } catch (e) {
      console.warn('Error in centroTrabajo heuristics:', e);
    }
    
    return '';
  }, []);
  
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [detailsItem, setDetailsItem] = useState(null);
  const [userCentro, setUserCentro] = useState('');
  const [hasRecentFichaje, setHasRecentFichaje] = useState(false);
  
  const madridDate = getMadridDate();
  const selectedYear = madridDate.getFullYear();

  const currentKey = `${selectedYear}`;

  // Helper function to check if user can perform actions
  const canPerformActions = () => {
    console.log('Incidencias - canPerformActions called:', { hasRecentFichaje });
    return hasRecentFichaje;
  };

  // Verificar fichaje recente (ultimele 12 ore)
  useEffect(() => {
    const checkRecentFichaje = async () => {
      console.log('Incidencias - checkRecentFichaje started');
      try {
        const codigo = user?.CODIGO || user?.codigo || '';
        console.log('Incidencias - User codigo:', codigo);
        
        if (!codigo) {
          console.log('Incidencias - No codigo found, setting hasRecentFichaje to false');
          setHasRecentFichaje(false);
          return;
        }

        const today = getMadridDate();
        const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        // Usar el mismo endpoint que ControlCorreoPage (directo con FECHA/HORA)
        const url = `https://n8n.decaminoservicios.com/webhook/get-registros-EgZjaHJv?CODIGO=${encodeURIComponent(codigo)}&MES=${encodeURIComponent(month)}&limit=1000&max=1000`;
        console.log('Incidencias - Fetching fichajes from:', url);
        const result = await callApi(url);
        
        console.log('Incidencias - API result:', result);
        
        if (result.success) {
          const data = Array.isArray(result.data) ? result.data : [result.data];
          console.log('Incidencias - Raw data:', data);
          
          // Verifică dacă există fichaje în ultimele 12 ore
          const now = getMadridDate();
          const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
          
          console.log('Incidencias - Debug fichaje:', {
            totalFichajes: data.length,
            now: now.toISOString(),
            twelveHoursAgo: twelveHoursAgo.toISOString()
          });
          
          const hasRecent = data.some((item, index) => {
            // Verifică toate câmpurile posibile pentru data și ora
            const fecha = item.FECHA || item.data || item.DATA || item.fecha || '';
            const hora = item.HORA || item.hora || item.HOUR || item.time || '';
            
            // Log primele 3 fichajes pentru debugging
            if (index < 3) {
              console.log(`Incidencias - Fichaje ${index} structure:`, {
                allKeys: Object.keys(item),
                fecha,
                hora,
                rawItem: item
              });
              console.log(`Incidencias - Fichaje ${index} allKeys:`, Object.keys(item));
              console.log(`Incidencias - Fichaje ${index} values:`, Object.values(item));
            }
            
            if (!fecha || !hora) {
              if (index < 5) {
                console.log(`Incidencias - Fichaje ${index}: No fecha/hora`, { fecha, hora, keys: Object.keys(item) });
              }
              return false;
            }
            
            const fichajeDate = new Date(`${fecha} ${hora}`);
            const isRecent = fichajeDate >= twelveHoursAgo && fichajeDate <= now;
            
            // Log doar primele 5 fichajes pentru debugging
            if (index < 5) {
              console.log(`Incidencias - Checking fichaje ${index}:`, {
                fecha,
                hora,
                fichajeDate: fichajeDate.toISOString(),
                twelveHoursAgo: twelveHoursAgo.toISOString(),
                now: now.toISOString(),
                isRecent
              });
            }
            
            return isRecent;
          });
          
          console.log('Incidencias - hasRecentFichaje result:', hasRecent);
          setHasRecentFichaje(hasRecent);
        } else {
          console.log('Incidencias - API call failed');
          setHasRecentFichaje(false);
        }
        
      } catch (e) {
        console.warn('Incidencias - Error checking recent fichaje:', e);
        setHasRecentFichaje(false);
      }
    };

    if (user) {
      console.log('Incidencias - User found, calling checkRecentFichaje');
      checkRecentFichaje();
    } else {
      console.log('Incidencias - No user found');
    }
  }, [user, callApi]);
  
  const [form, setForm] = useState({
    fecha: '',
    hora: '',
    tipo: 'Avería',
    ubicacion: '',
    descripcion: '',
    prioridad: 'Media',
    estado: 'Pendiente',
    observaciones: '',
    solucion: '',
    // Câmpuri noi pentru tabel
    auxiliar: '',
    personaInformada: '',
    resolucionFecha: '',
    resolucionHora: '',
    resolucionAuxiliar: ''
  });

  const [empleados, setEmpleados] = useState([]);
  const [showResolucion, setShowResolucion] = useState(false);

  const fetchCentroTrabajoFromEmployees = useCallback(async (email, codigo) => {
    try {
      const empleadosUrl = routes?.getEmpleados || routes?.getUsuarios || 'https://n8n.decaminoservicios.com/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142';
      const res = await fetch(empleadosUrl, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.data || data?.body?.data || []);
      if (!Array.isArray(list)) {
        return '';
      }
      const match = list.find(emp => {
        const empEmail = emp?.['CORREO ELECTRONICO'] || emp?.EMAIL || emp?.email;
        const empCodigo = emp?.['CODIGO'] || emp?.codigo;
        const emailMatch = email && empEmail && String(empEmail).toLowerCase() === String(email).toLowerCase();
        const codigoMatch = codigo && empCodigo && String(empCodigo) === String(codigo);
        return emailMatch || codigoMatch;
      });
      if (match) {
        const centro = (
          match['CENTRO TRABAJO'] ||
          match['CENTRO DE TRABAJO'] ||
          match['centro de trabajo'] ||
          match['CENTRO_DE_TRABAJO'] ||
          match['centroDeTrabajo'] ||
          match['centro_trabajo'] ||
          match['CENTRO'] || match['centro'] ||
          match['CENTER'] || match['center'] ||
          match['DEPARTAMENTO'] || match['departamento'] ||
          ''
        );
        return centro;
      }
      return '';
    } catch (e) {
      console.error('IncidenciasPage: error fetching employees for centroTrabajo', e);
      return '';
    }
  }, [routes]);

  // Încarcă lista de angajați pentru dropdown (doar din centrul de lucru al user-ului)
  const fetchEmpleados = useCallback(async () => {
    try {
      let centroTrabajo = getCentroTrabajoFromUser(user);
      if (!centroTrabajo) {
        const email = user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email || '';
        const codigo = user?.CODIGO || user?.codigo || '';
        centroTrabajo = await fetchCentroTrabajoFromEmployees(email, codigo);
      }

      if (!centroTrabajo) {
        console.warn('No se pudo obtener centroTrabajo para filtrar empleados');
        setEmpleados([]);
        return;
      }

      const empleadosUrl = routes?.getEmpleados || routes?.getUsuarios || 'https://n8n.decaminoservicios.com/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142';

      const res = await fetch(empleadosUrl, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      const data = await res.json();

      const list = Array.isArray(data) ? data : (data?.data || data?.body?.data || []);

      if (Array.isArray(list)) {
        const empleadosDelCentro = list.filter(emp => {
          const empCentro = (
            emp['CENTRO TRABAJO'] ||
            emp['CENTRO DE TRABAJO'] ||
            emp['centro de trabajo'] ||
            emp['CENTRO_DE_TRABAJO'] ||
            emp['centroDeTrabajo'] ||
            emp['centro_trabajo'] ||
            emp['CENTRO'] || emp['centro'] ||
            emp['CENTER'] || emp['center'] ||
            emp['DEPARTAMENTO'] || emp['departamento'] ||
            ''
          );

          return empCentro && String(empCentro).trim().toLowerCase() === String(centroTrabajo).trim().toLowerCase();
        });

        setEmpleados(empleadosDelCentro);
      }
    } catch (e) {
      console.error('Error fetching empleados:', e);
    }
  }, [user, routes, getCentroTrabajoFromUser, fetchCentroTrabajoFromEmployees]);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  const loadItems = useCallback(async () => {
    try {
      // Obtener centro de trabajo con fallback robusto
      let centroTrabajo = getCentroTrabajoFromUser(user);
      if (!centroTrabajo) {
        const email = user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email || '';
        const codigo = user?.CODIGO || user?.codigo || '';
        centroTrabajo = await fetchCentroTrabajoFromEmployees(email, codigo);
      }
      
      if (!centroTrabajo) {
        console.warn('IncidenciasPage: No se pudo obtener centroTrabajo, usando datos locales');
        return;
      }
      
      setUserCentro(centroTrabajo);
      
      // GET al webhook de producție pentru incidencias (URL direct ca tareas)
      const webhookUrl = `https://n8n.decaminoservicios.com/webhook/48ab52db-0279-4e86-aef7-2c8548fb0f5b?centroTrabajo=${encodeURIComponent(centroTrabajo)}&año=${selectedYear}`;
      
      console.log('🔍 IncidenciasPage: Making GET request to:', webhookUrl);
      console.log('🔍 IncidenciasPage: With centroTrabajo:', centroTrabajo, 'and year:', selectedYear);
      
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      
      if (!response.ok) {
        console.warn('⚠️ Error al cargar incidencias:', response.status, response.statusText);
        return;
      }
      
      const responseData = await response.json();
      
      const data = responseData?.data || responseData || [];
      const itemsArray = Array.isArray(data) ? data : [];
      
      console.log('✅ Incidencias cargadas:', itemsArray.length, 'items para centro:', centroTrabajo);
      
      setItems(itemsArray);
    } catch (error) {
      console.warn('Error loading incidencias:', error);
    }
  }, [fetchCentroTrabajoFromEmployees, getCentroTrabajoFromUser, user, selectedYear]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openNew = () => {
    const now = getMadridDate();
    const fecha = now.toISOString().split('T')[0];
    const hora = now.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
    
    setForm({
      fecha,
      hora,
      tipo: 'Avería',
      ubicacion: '',
      descripcion: '',
      prioridad: 'Media',
      estado: 'Pendiente',
      observaciones: '',
      solucion: '',
      empresa: nombre, // Pentru auto-completare
      // Câmpuri noi pentru tabel
      auxiliar: nombre, // Auto-completează cu numele angajatului logat
      personaInformada: '',
      resolucionFecha: '',
      resolucionHora: '',
      resolucionAuxiliar: ''
    });
    setShowResolucion(false); // Resetează checkbox-ul
    setEditingIndex(null);
    setShowModal(true);
  };

  const openEdit = (index) => {
    const item = items[index];
    setForm({
      fecha: item.fecha || '',
      hora: item.hora || '',
      tipo: item.tipo || 'Avería',
      ubicacion: item.ubicacion || '',
      descripcion: item.descripcion || '',
      prioridad: item.prioridad || 'Media',
      estado: item.estado || 'Pendiente',
      observaciones: item.observaciones || '',
      solucion: item.solucion || '',
      empresa: user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '',
      // Câmpuri noi pentru tabel
      auxiliar: item.auxiliar || '',
      personaInformada: item.personaInformada || '',
      resolucionFecha: item.resolucionFecha || '',
      resolucionHora: item.resolucionHora || '',
      resolucionAuxiliar: item.resolucionAuxiliar || ''
    });
    // Afișează secțiunea de rezoluție dacă există date de rezoluție
    setShowResolucion(!!(item.resolucionFecha || item.resolucionHora || item.resolucionAuxiliar));
    setEditingIndex(index);
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!form.hora || !form.descripcion) { 
      setShowModal(false); 
      return; 
    }
    
    const next = [...items];
    const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
    const itemToSave = { ...form, nombre };
    
    if (editingIndex === null) {
      next.push(itemToSave);
    } else {
      next[editingIndex] = itemToSave;
    }
    
    setItems(next);
    setShowModal(false);

    // Enviar al backend
    try {
      const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
      const email = user?.['CORREO ELECTRONICO'] || user?.['CORREO ELECTRONIC'] || user?.EMAIL || user?.email || '';
      const codigo = user?.CODIGO || user?.codigo || user?.['CODIGO EMPLEADO'] || '';
      
      // Obtener centro de trabajo con fallback robusto
      let centroTrabajo = getCentroTrabajoFromUser(user);
      if (!centroTrabajo) {
        console.log('⚠️ IncidenciasPage: centroTrabajo vacío en user. Intentando resolver desde lista empleados…');
        centroTrabajo = await fetchCentroTrabajoFromEmployees(email, codigo);
      }
      
      console.log('🔍 IncidenciasPage: Final centroTrabajo for save:', centroTrabajo);
      console.log('🔍 IncidenciasPage: User data for save:', { nombre, email, codigo, centroTrabajo });
      
      const payload = {
        // ID de la incidencia (solo para editar)
        ...(editingIndex !== null && { 
          id: items[editingIndex].id || items[editingIndex]._id || `${currentKey}_${editingIndex}` 
        }),
        // Datos del formulario
        fecha: form.fecha,
        hora: form.hora,
        tipo: form.tipo,
        ubicacion: form.ubicacion,
        descripcion: form.descripcion,
        prioridad: form.prioridad,
        estado: form.estado,
        observaciones: form.observaciones,
        solucion: form.solucion,
        // Datos del empleado
        codigo,
        nombre,
        email,
        centroTrabajo,
        loc: currentLocation || null,
        address: currentAddress || null,
        source: 'webapp_incidencias',
        // Campos de resolución (se envían vacíos si checkbox no está marcado)
        resolucionFecha: showResolucion ? form.resolucionFecha : '',
        resolucionHora: showResolucion ? form.resolucionHora : '',
        resolucionAuxiliar: showResolucion ? form.resolucionAuxiliar : '',
        // Campos adicionales del formulario
        auxiliar: form.auxiliar,
        personaInformada: form.personaInformada,
        // Metadatos para edit
        ...(editingIndex !== null && { accion: 'edit' })
      };
      
      console.log('🔍 IncidenciasPage: Complete payload being sent to backend:', payload);
      
      // POST al webhook específico - diferit pentru nueva vs editar
      const webhookUrl = editingIndex !== null 
        ? 'https://n8n.decaminoservicios.com/webhook/c3a21775-6010-4708-9c0a-dd2f978e54da'  // Webhook para editar (producción)
        : 'https://n8n.decaminoservicios.com/webhook/31f2b085-58f1-4f61-9368-3703566323f9';  // Webhook para nueva (producción)
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log('✅ Incidencia guardada en backend:', payload);
      } else {
        console.warn('⚠️ Error al guardar en backend:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error al enviar al backend:', error);
    }
  };

  const exportExcel = async () => {
    if (!items.length) return;
    
    try {
      const reportDate = madridDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // Folosim URL direct către n8n în producție (ca tareas)
      const exportUrl = `https://n8n.decaminoservicios.com/webhook/48ab52db-0279-4e86-aef7-2c8548fb0f5b?centroTrabajo=${encodeURIComponent(userCentro)}&fecha=${encodeURIComponent(currentKey)}`;
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0'
        }
      });
      
      let backendData = [];
      if (response.ok) {
        const responseData = await response.json();
        backendData = responseData?.data || responseData || [];
      }
      
      const dataToExport = Array.isArray(backendData) ? backendData : [];
      
      const exportData = dataToExport.length > 0 ? dataToExport : items;
      
      await exportToExcelWithHeader(exportData, EXPORT_COLUMNS, 'CUADERNO INCIDENCIAS', 'incidencias', {}, reportDate);
    } catch (error) {
      console.warn('Error fetching backend data for export, using local data:', error);
      const reportDate = madridDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      await exportToExcelWithHeader(items, EXPORT_COLUMNS, 'CUADERNO INCIDENCIAS', 'incidencias', {}, reportDate);
    }
  };

  const exportPDF = async () => {
    if (!items.length) return;
    
    let exportData = items;
    try {
      const response = await callApi('/api/n8n/webhook/get-incidencias-webhook-id', {
        method: 'GET',
        params: {
          fecha: currentKey,
          centroTrabajo: userCentro
        }
      });
      
      const backendData = response?.data || response || [];
      if (Array.isArray(backendData) && backendData.length > 0) {
        exportData = backendData;
      }
    } catch (error) {
      console.warn('Error fetching backend data for PDF export, using local data:', error);
    }
    
    const ensurePdfMake = () => new Promise((resolve, reject) => {
      if (window.pdfMake) return resolve(window.pdfMake);
      const s1 = document.createElement('script');
      s1.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.5/build/pdfmake.min.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.5/build/vfs_fonts.js';
        s2.onload = () => resolve(window.pdfMake);
        s2.onerror = () => reject(new Error('No se pudieron cargar las fuentes pdfMake'));
        document.head.appendChild(s2);
      };
      s1.onerror = () => reject(new Error('No se pudo cargar pdfMake'));
      document.head.appendChild(s1);
    });
    await ensurePdfMake();

    const tableBody = [
      ['Fecha', 'Hora', 'Auxiliar', 'Incidencia/Avería', 'Persona Informada', 'Fecha', 'Hora', 'Auxiliar'],
      ...exportData.map(item => [
        item.fecha || '',
        item.hora || '',
        item.auxiliar || '',
        item.incidenciaAveria || '',
        item.personaInformada || '',
        item.resolucionFecha || '',
        item.resolucionHora || '',
        item.resolucionAuxiliar || ''
      ])
    ];

    const reportTitle = 'CUADERNO INCIDENCIAS';
    const period = madridDate.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const fileDate = madridDate.toISOString().split('T')[0];

    const docDefinition = {
      pageOrientation: 'landscape',
      content: [
        { table: { widths: ['*'], body: [[{ text: 'DE CAMINO SERVICIOS AUXILIARES SL', style: 'companyName' }],
                                           [{ text: 'NIF: B85524536', style: 'companyDetails' }],
                                           [{ text: 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España', style: 'companyDetails' }],
                                           [{ text: 'Teléfono: +34 91 123 45 67', style: 'companyDetails' }],
                                           [{ text: 'Email: info@decaminoservicios.com', style: 'companyDetails' }]] }, layout: 'noBorders', margin: [0,0,0,10] },
        { text: reportTitle, style: 'reportTitle' },
        { text: `Período: ${period}`, style: 'period' },
        { text: `Centro de Trabajo: ${userCentro || ''}`, style: 'period', margin: [0, 0, 0, 10] },
        { table: { headerRows: 1, widths: [60, 50, 80, '*', 120, 60, 50, 80], body: tableBody }, layout: 'lightHorizontalLines' }
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#FFFFFF', fillColor: '#CC0000', alignment: 'center', margin: [0,0,0,8] },
        companyDetails: { fontSize: 9, bold: true, color: '#333333', fillColor: '#F0F0F0', alignment: 'center' },
        reportTitle: { fontSize: 12, bold: true, color: '#FFFFFF', fillColor: '#0066CC', alignment: 'center', margin: [0,4,0,2] },
        period: { fontSize: 10, color: '#333333', alignment: 'center' }
      }
    };

    window.pdfMake.createPdf(docDefinition).download(`incidencias_${fileDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {/* Back to Home */}
              <Back3DButton to="/inicio" title="Volver a Inicio" />
              
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Cuaderno Incidencias</h1>
                <p className="text-gray-600">
                  Registro de averías y mantenimiento • Madrid: {madridDate.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                  </div>
                </div>
            {/* Actions on right */}
            <div className="flex items-center gap-2">
              {/* SUPER 3D Refresh Button */}
              <button
                onClick={loadItems}
                className="group relative w-12 h-12 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-xl hover:shadow-blue-500/50 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                  boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
                title="Actualizar incidencias"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"></div>
                
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                
                {/* Icon con animație de rotire */}
                <div className="relative flex items-center justify-center h-full">
                  <span className="text-2xl transform group-hover:rotate-180 transition-transform duration-500">🔄</span>
              </div>
              </button>
              
              <Back3DButton to="/cuadernos" title="Volver a Cuadernos" />
            </div>
              </div>
              
              </div>
              
        {/* Banner En Pruebas */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-300 rounded-xl p-4 shadow-lg mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">🚀</span>
              </div>
          </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-800 mb-1">
                Módulo en Pruebas (Beta)
              </h3>
              <p className="text-blue-700 text-sm">
                Este sistema de gestión de incidencias está <strong>en fase de pruebas</strong>. Algunos datos pueden no estar 100% actualizados. 
                <span className="font-black text-blue-700 ml-1">¡Pronto estará completamente funcional!</span>
              </p>
              <p className="text-blue-600 text-xs mt-1">
                <strong>Importante:</strong> Hasta que se finalice esta funcionalidad, debes utilizar las hojas puestas a disposición por la empresa en el centro de trabajo.
              </p>
              <p className="text-blue-600 text-xs mt-1">
                <strong>Nota:</strong> No estás obligado a registrar todo momentáneamente, solo estás haciendo pruebas del sistema.
              </p>
              <p className="text-blue-600 text-xs mt-1">
                Si encuentras algún problema, por favor contacta al administrador del sistema.
              </p>
              <div className="mt-2">
              <button
                  onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de incidencias', '_blank')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
              >
                  <span className="text-sm">📱</span>
                  Contactar Administrador
              </button>
              </div>
              </div>
              </div>
            </div>
            
        {/* Incidents Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Cuaderno Diario - {userCentro ? `${userCentro} - ` : ''}{selectedYear}
              </h2>
              <p className="text-gray-600">
                {items.length} incidencias
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportExcel}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm"
                title="Exportar a Excel (XLS)"
              >
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button
                onClick={exportPDF}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm"
                title="Exportar a PDF"
              >
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>
              {canPerformActions() && (
                <button
                  onClick={openNew}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nueva Incidencia
                </button>
              )}
              {!canPerformActions() && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nueva Incidencia
                  <span className="text-xs ml-1">(Ficha primero)</span>
                </div>
              )}
            </div>
          </div>

          {/* Incidents Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                {/* Header principal cu 5 grupuri */}
                <tr className="text-center text-gray-600">
                  <th colSpan="2" className="py-2 px-3 font-bold border-b bg-gray-100">TIPO / PRIORIDAD</th>
                  <th colSpan="3" className="py-2 px-3 font-bold border-b bg-gray-100">APERTURA INCIDENCIA</th>
                  <th colSpan="1" className="py-2 px-3 font-bold border-b bg-gray-100">DESCRIPCION</th>
                  <th colSpan="1" className="py-2 px-3 font-bold border-b bg-gray-100">AVISO</th>
                  <th colSpan="3" className="py-2 px-3 font-bold border-b bg-gray-100">RESOLUCION</th>
                  <th colSpan="1" className="py-2 px-3 font-bold border-b bg-gray-100">ACCIONES</th>
                </tr>
                {/* Header secundar cu subcoloane */}
                <tr className="text-center text-gray-600">
                  {DISPLAY_COLUMNS.map(col => (
                    <th key={col.key} className="py-2 px-3 font-medium border-b text-xs">{col.label}</th>
                  ))}
                  <th className="py-2 px-3 font-medium border-b text-xs">Editar</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={DISPLAY_COLUMNS.length + 1} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-500 mb-2">
                          No hay incidencias para este año
                        </h3>
                        <p className="text-gray-400">
                          Agrega tu primera incidencia haciendo clic en &quot;Nueva Incidencia&quot;
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr 
                      key={idx} 
                      className="border-b hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                      onClick={() => setDetailsItem(it)}
                    >
                      {DISPLAY_COLUMNS.map(col => (
                        <td key={col.key} className="py-2 px-3">{it[col.key] || ''}</td>
                      ))}
                      <td className="py-2 px-3">
                        {canPerformActions() ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(idx);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                          >
                            Editar
                          </button>
                        ) : (
                          <span className="px-3 py-1 bg-gray-400 text-white rounded text-xs cursor-not-allowed opacity-50">
                            Editar
                            <span className="text-xs ml-1">(Ficha primero)</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal Nueva Incidencia */}
        {showModal && editingIndex === null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <h3 className="text-base font-semibold mb-3">
                Nueva Incidencia
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Reporte</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({...form, fecha: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Reporte</label>
                  <input
                    type="time"
                    value={form.hora}
                    onChange={(e) => setForm({...form, hora: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({...form, tipo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Avería">Avería</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Limpieza">Limpieza</option>
                    <option value="Seguridad">Seguridad</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select
                    value={form.prioridad}
                    onChange={(e) => setForm({...form, prioridad: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {editingIndex !== null && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({...form, estado: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Resuelto">Resuelto</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={form.ubicacion}
                  onChange={(e) => setForm({...form, ubicacion: e.target.value})}
                  placeholder="Ej: Oficina 1, Ascensor A, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Auxiliar (Apertura)</label>
                <input
                  type="text"
                  value={form.auxiliar || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Se auto-completa con el empleado logado</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Problema (Incidencia/Avería)</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({...form, descripcion: e.target.value})}
                  placeholder="Describe detalladamente el problema..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Persona Informada</label>
                <input
                  type="text"
                  value={form.personaInformada || ''}
                  onChange={(e) => setForm({...form, personaInformada: e.target.value})}
                  placeholder="Nombre de la persona informada..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Checkbox pentru a afișa secțiunea de Resolución */}
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showResolucion}
                    onChange={(e) => {
                      setShowResolucion(e.target.checked);
                      if (e.target.checked) {
                        // Auto-completează cu datele curente și angajatul logat
                        const now = getMadridDate();
                        const fechaResolucion = now.toISOString().split('T')[0];
                        const horaResolucion = now.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
                        
                        setForm({
                          ...form,
                          estado: 'Resuelto',
                          resolucionFecha: fechaResolucion,
                          resolucionHora: horaResolucion,
                          resolucionAuxiliar: nombre
                        });
                      } else {
                        // Resetează câmpurile de rezoluție dacă se dezactivează checkbox-ul
                        setForm({
                          ...form,
                          resolucionFecha: '',
                          resolucionHora: '',
                          resolucionAuxiliar: ''
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Marcar como resuelto (completar datos de resolución)
                  </span>
                </label>
              </div>

              {/* Campos de Resolución - doar dacă checkbox-ul este bifat */}
              {showResolucion && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-md font-semibold text-blue-800 mb-3 border-b border-blue-300 pb-1">Resolución</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Resolución</label>
                      <input
                        type="date"
                        value={form.resolucionFecha || ''}
                        onChange={(e) => setForm({...form, resolucionFecha: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora Resolución</label>
                      <input
                        type="time"
                        value={form.resolucionHora || ''}
                        onChange={(e) => setForm({...form, resolucionHora: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auxiliar (Resolución)</label>
                    <select
                      value={form.resolucionAuxiliar || ''}
                      onChange={(e) => setForm({...form, resolucionAuxiliar: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccionar auxiliar...</option>
                      {empleados.length === 0 ? (
                        <option value="" disabled>No hay empleados en este centro</option>
                      ) : (
                        empleados.map((emp, index) => {
                          const nombre = emp?.['NOMBRE / APELLIDOS'] || emp?.NOMBRE || emp?.name || `Empleado ${index + 1}`;
                          return (
                            <option key={index} value={nombre}>
                              {nombre}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm({...form, observaciones: e.target.value})}
                  placeholder="Observaciones adicionales..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {editingIndex !== null && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Solución Aplicada</label>
                  <textarea
                    value={form.solucion}
                    onChange={(e) => setForm({...form, solucion: e.target.value})}
                    placeholder="Describe la solución aplicada..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveItem}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Incidencia */}
        {showModal && editingIndex !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <h3 className="text-base font-semibold mb-3">
                Editar Incidencia
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Reporte</label>
                  <input
                    type="date"
                    value={form.fecha}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Reporte</label>
                  <input
                    type="time"
                    value={form.hora}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <input
                    type="text"
                    value={form.tipo}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <input
                    type="text"
                    value={form.prioridad}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <input
                  type="text"
                  value={form.estado}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={form.ubicacion}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Auxiliar (Apertura)</label>
                <input
                  type="text"
                  value={form.auxiliar || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Se auto-completa con el empleado logado</p>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Problema (incidencia/Avería)</label>
                <textarea
                  value={form.descripcion}
                  readOnly
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Persona Informada</label>
                <textarea
                  value={form.personaInformada}
                  readOnly
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>

              {/* Checkbox pentru a afișa secțiunea de Resolución */}
              <div className="mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showResolucion}
                    onChange={(e) => {
                      setShowResolucion(e.target.checked);
                      if (e.target.checked) {
                        // Auto-completează cu datele curente și angajatul logat
                        const now = getMadridDate();
                        const fechaResolucion = now.toISOString().split('T')[0];
                        const horaResolucion = now.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
                        
                        setForm({
                          ...form,
                          estado: 'Resuelto',
                          resolucionFecha: fechaResolucion,
                          resolucionHora: horaResolucion,
                          resolucionAuxiliar: nombre
                        });
                      } else {
                        // Resetează câmpurile de rezoluție dacă se dezactivează checkbox-ul
                        setForm({
                          ...form,
                          resolucionFecha: '',
                          resolucionHora: '',
                          resolucionAuxiliar: ''
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Marcar como resuelto (completar datos de resolución)
                  </span>
                </label>
              </div>

              {/* Campos de Resolución - doar dacă checkbox-ul este bifat */}
              {showResolucion && (
                <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-md font-semibold text-blue-800 mb-3 border-b border-blue-300 pb-1">Resolución</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Resolución</label>
                      <input
                        type="date"
                        value={form.resolucionFecha || ''}
                        onChange={(e) => setForm({...form, resolucionFecha: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora Resolución</label>
                      <input
                        type="time"
                        value={form.resolucionHora || ''}
                        onChange={(e) => setForm({...form, resolucionHora: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auxiliar (Resolución)</label>
                    <select
                      value={form.resolucionAuxiliar || ''}
                      onChange={(e) => setForm({...form, resolucionAuxiliar: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccionar auxiliar...</option>
                      {empleados.length === 0 ? (
                        <option value="" disabled>No hay empleados en este centro</option>
                      ) : (
                        empleados.map((emp, index) => {
                          const nombre = emp?.['NOMBRE / APELLIDOS'] || emp?.NOMBRE || emp?.name || `Empleado ${index + 1}`;
                          return (
                            <option key={index} value={nombre}>
                              {nombre}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Solución Aplicada</label>
                <textarea
                  value={form.solucion}
                  onChange={(e) => setForm({...form, solucion: e.target.value})}
                  placeholder="Describe la solución aplicada..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  readOnly
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveItem}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {detailsItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3 sticky top-0 bg-white pb-2 border-b">
                <h3 className="text-base font-semibold">Detalles de la Incidencia</h3>
                <button
                  onClick={() => setDetailsItem(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                {Object.entries(detailsItem).map(([key, value]) => (
                  <div key={key} className="flex border-b pb-2">
                    <span className="font-medium text-gray-700 w-36 capitalize flex-shrink-0">{key}:</span>
                    <span className="text-gray-900 break-words">{value || 'N/A'}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end mt-4 sticky bottom-0 bg-white pt-2 border-t">
                <button
                  onClick={() => setDetailsItem(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidenciasPage;
