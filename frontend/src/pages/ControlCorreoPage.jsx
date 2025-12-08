import { useMemo, useState, useEffect, useCallback } from 'react';
import { Calendar, FileSpreadsheet, FileText, Plus } from 'lucide-react';
import Back3DButton from '../components/Back3DButton';
import { exportToExcelWithHeader } from '../utils/exportExcel';
import { useAuth } from '../contexts/AuthContextBase';
import { useLocation } from '../contexts/LocationContextBase';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes';
import { Card } from '../components/ui';

// Campos base tomados del cuaderno de control de correo.
// Si el Excel cambia, solo hay que ajustar esta lista.
const REMITENTES_SUGERIDOS = [
  'Correos',
  'Correos Express',
  'SEUR',
  'MRW',
  'NACEX',
  'GLS',
  'DHL',
  'UPS',
  'FedEx',
  'CTT Express',
  'TIPSA',
  'Envialia',
  'Amazon Logistics',
  'Zeleris'
];
// Coloane pentru afișare în tabel
const DISPLAY_COLUMNS = [
  { key: 'fecha', label: 'Fecha', width: 14 },
  { key: 'hora', label: 'Hora', width: 10 },
  { key: 'nombre', label: 'Empleado', width: 24 },
  { key: 'tipo', label: 'Tipo (Paquete/Certificado)', width: 22 },
  { key: 'empresa', label: 'Empresa/Remitente', width: 26 },
  { key: 'propietario', label: 'Propietario', width: 26 },
  { key: 'portalPisoLetra', label: 'Portal/Piso/Letra', width: 24 },
  { key: 'observaciones', label: 'Observaciones', width: 32 },
  { key: 'estado', label: 'Estado', width: 16 }
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
  { key: 'tipo', label: 'Tipo (Paquete/Certificado)', width: 22 },
  { key: 'empresa', label: 'Empresa/Remitente', width: 26 },
  { key: 'propietario', label: 'Propietario', width: 26 },
  { key: 'portalPisoLetra', label: 'Portal/Piso/Letra', width: 24 },
  { key: 'observaciones', label: 'Observaciones', width: 32 },
  { key: 'estado', label: 'Estado', width: 16 }
];

const getMadridDate = () => {
  const now = new Date();
  // Alineado con TareasPage: usar zona "Europe/Madrid" para hora correcta
  const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return madridTime;
};

const ControlCorreoPage = () => {
  const { user } = useAuth();
  const { currentLocation, currentAddress } = useLocation();
  const { callApi } = useApi();
  const [allItems, setAllItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form, setForm] = useState({ fecha: '', hora: '', tipo: 'Paquete', estado: 'Entregado', empresa: '', propietario: '', portalPisoLetra: '', observaciones: '' });
  const [selectedRemitente, setSelectedRemitente] = useState('');
  const [detailsItem, setDetailsItem] = useState(null);
  const [userCentro, setUserCentro] = useState('');
  const [hasRecentFichaje, setHasRecentFichaje] = useState(false);

  const madridDate = useMemo(() => getMadridDate(), []);

  // Helper function to check if user can perform actions
  const canPerformActions = () => {
    console.log('ControlCorreo - canPerformActions called:', { hasRecentFichaje });
    return hasRecentFichaje;
  };

  // Helpers de centro de trabajo (alineado con Tareas)
  const getCentroTrabajoFromUser = (u) => {
    if (!u) return '';
    return (
      u['CENTRO TRABAJO'] ||
      u['CENTRO DE TRABAJO'] ||
      u['centro de trabajo'] ||
      u['CENTRO_DE_TRABAJO'] ||
      u['centroDeTrabajo'] ||
      u['centro_trabajo'] ||
      u['CENTRO'] || u['centro'] ||
      u['CENTER'] || u['center'] ||
      u['DEPARTAMENTO'] || u['departamento'] ||
      ''
    );
  };

  const resolveCentroTrabajo = useCallback(async () => {
    let centro = getCentroTrabajoFromUser(user);
    if (centro) {
      setUserCentro(centro);
      return centro;
    }
    try {
      const email = user?.['CORREO ELECTRONICO'] || user?.['CORREO ELECTRONIC'] || user?.EMAIL || user?.email || '';
      const codigo = user?.CODIGO || user?.codigo || user?.['CODIGO EMPLEADO'] || '';
      const res = await callApi(routes.getEmpleados || routes.getUsuarios || routes.getUsuarios);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.body?.data || []));
      const match = Array.isArray(list) ? list.find(emp => {
        const empEmail = emp?.['CORREO ELECTRONICO'] || emp?.EMAIL || emp?.email;
        const empCodigo = emp?.CODIGO || emp?.codigo;
        return (email && empEmail && String(empEmail).toLowerCase() === String(email).toLowerCase()) || (codigo && empCodigo && String(empCodigo) === String(codigo));
      }) : null;
      if (match) {
        centro = (
          match['CENTRO TRABAJO'] || match['CENTRO DE TRABAJO'] || match['centro de trabajo'] || match['CENTRO_DE_TRABAJO'] || match['centroDeTrabajo'] || match['centro_trabajo'] || match['CENTRO'] || match['centro'] || ''
        );
      }
    } catch (e) {
      console.warn('ControlCorreo: resolveCentroTrabajo fallback empleados failed', e);
    }
    setUserCentro(centro || '');
    return centro || '';
  }, [callApi, user]);

  // Verificar fichaje recente (ultimele 12 ore)
  const checkRecentFichaje = useCallback(async () => {
      console.log('ControlCorreo - checkRecentFichaje started');
      try {
        const email = user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email || '';
        const codigo = user?.CODIGO || user?.codigo || user?.['CODIGO EMPLEADO'] || '';
        
        console.log('ControlCorreo - User email/codigo:', { email, codigo });
        
        if (!email && !codigo) {
          console.log('ControlCorreo - No email/codigo found, setting hasRecentFichaje to false');
          setHasRecentFichaje(false);
          return;
        }

        // URL pentru verificarea fichajelor recente - folosim callApi ca la TareasPage
        try {
          const codigoEmpleado = user?.CODIGO || user?.codigo || '';
          console.log('ControlCorreo - User codigo:', codigoEmpleado);
          
          if (!codigoEmpleado) {
            console.log('ControlCorreo - No codigo found, setting hasRecentFichaje to false');
            setHasRecentFichaje(false);
            return;
          }

          const today = getMadridDate();
          const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          
          // Usar el mismo sistema que TareasPage
          const url = `${routes.getRegistros}?CODIGO=${encodeURIComponent(codigoEmpleado)}&MES=${encodeURIComponent(month)}&limit=1000&max=1000`;
          console.log('ControlCorreo - Fetching fichajes from:', url);
          const result = await callApi(url);
          
          console.log('ControlCorreo - API result:', result);
          
          if (result.success) {
            const data = Array.isArray(result.data) ? result.data : [result.data];
            console.log('ControlCorreo - Raw data:', data);
            
            // Verifică dacă există fichaje în ultimele 12 ore
            const now = getMadridDate();
            const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            
            console.log('ControlCorreo - Debug fichaje:', {
              totalFichajes: data.length,
              now: now.toISOString(),
              twelveHoursAgo: twelveHoursAgo.toISOString()
            });
            
            const hasRecent = data.some(item => {
              const fecha = item.FECHA || item.data || '';
              const hora = item.HORA || item.hora || '';
              if (!fecha || !hora) return false;
              
              const fichajeDate = new Date(`${fecha} ${hora}`);
              const isRecent = fichajeDate >= twelveHoursAgo && fichajeDate <= now;
              
              console.log('ControlCorreo - Checking fichaje:', {
                fecha,
                hora,
                fichajeDate: fichajeDate.toISOString(),
                isRecent
              });
              
              return isRecent;
            });
            
            console.log('ControlCorreo - hasRecentFichaje result:', hasRecent);
            setHasRecentFichaje(hasRecent);
          } else {
            console.log('ControlCorreo - API call failed');
            setHasRecentFichaje(false);
          }
          
        } catch (e) {
          console.warn('ControlCorreo - Error fetching fichajes via callApi:', e);
          setHasRecentFichaje(false);
        }
      } catch (e) {
        console.warn('ControlCorreo - Error in checkRecentFichaje:', e);
        setHasRecentFichaje(false);
      }
  }, [callApi, user]);

  useEffect(() => {
    if (user) {
      console.log('ControlCorreo - User found, calling checkRecentFichaje');
      checkRecentFichaje();
    } else {
      console.log('ControlCorreo - No user found');
    }
  }, [user, checkRecentFichaje]);

  // Cargar listado completo desde backend según centro de trabajo
  const fetchList = useCallback(async () => {
      try {
        let centro = getCentroTrabajoFromUser(user);
        if (!centro) {
          // Fallback: buscar en lista de empleados după email/código
          const email = user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email || '';
          const codigo = user?.CODIGO || user?.codigo || user?.['CODIGO EMPLEADO'] || '';
          try {
            const res = await callApi(routes.getEmpleados || routes.getUsuarios || routes.getUsuarios);
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.body?.data || []));
            const match = Array.isArray(list) ? list.find(emp => {
              const empEmail = emp?.['CORREO ELECTRONICO'] || emp?.EMAIL || emp?.email;
              const empCodigo = emp?.CODIGO || emp?.codigo;
              return (email && empEmail && String(empEmail).toLowerCase() === String(email).toLowerCase()) || (codigo && empCodigo && String(empCodigo) === String(codigo));
            }) : null;
            centro = match ? (
              match['CENTRO TRABAJO'] || match['CENTRO DE TRABAJO'] || match['centro de trabajo'] || match['CENTRO_DE_TRABAJO'] || match['centroDeTrabajo'] || match['centro_trabajo'] || match['CENTRO'] || match['centro'] || ''
            ) : '';
          } catch (e) {
            console.warn('ControlCorreo: fallback empleados failed', e);
          }
        }

        if (!centro) {
          console.warn('ControlCorreo: centroTrabajo no encontrado, abort fetch');
          return;
        }

        // Folosim URL direct către n8n în producție - fără filtru de dată
        const url = `https://n8n.decaminoservicios.com/webhook/6d752a3a-bed9-4c48-a6a9-8a2583875ef9?centroTrabajo=${encodeURIComponent(centro)}`;
        console.log('ControlCorreo: fetching all data ->', url);
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return;
        const text = await res.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (err) {
          console.warn('ControlCorreo: parse response error', err);
        }

        // Normaliza a array tolerant
        let array = [];
        if (Array.isArray(data)) array = data;
        else if (data?.data && Array.isArray(data.data)) array = data.data;
        else if (data?.body?.data && Array.isArray(data.body.data)) array = data.body.data;
        else if (data && typeof data === 'object') array = [data];

        // Mapea și normalizează toate câmpurile relevante - fără filtru de dată
        const mapped = array.map((it) => ({
          id: it.id || it.ID || null,
          codigo: it.codigo || it.CODIGO || '',
          nombre: it.nombre || it.NOMBRE || '',
          email: it.email || it.EMAIL || '',
          centroTrabajo: it.centroTrabajo || it.CENTRO_TRABAJO || it['CENTRO TRABAJO'] || '',
          address: it.address || it.direccion || it.DIRECCION || '',
          created_at: it.created_at || it.CREATED_AT || it.createdAt || '',
          fecha: it.fecha || it.FECHA || '',
          hora: it.hora || it.HORA || '',
          tipo: it.tipo || it.TIPO || 'Paquete',
          empresa: it.empresa || it.remitente || it.REMITENTE || it.EMPRESA || '',
          propietario: it.propietario || it.PROPIETARIO || '',
          portalPisoLetra: it.portalPisoLetra || it.PORTAL_PISO_LETRA || it.PORTALPISOLETRA || '',
          observaciones: it.observaciones || it.OBSERVACIONES || '',
          estado: it.estado || it.ESTADO || 'Pendiente'
        }));

        setAllItems(mapped);
      } catch (e) {
        console.error('ControlCorreo: error fetching list', e);
      }
  }, [callApi, user]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openNew = () => {
    const today = getMadridDate();
    const hh = String(today.getHours()).padStart(2, '0');
    const mm = String(today.getMinutes()).padStart(2, '0');
    const userName = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || 'Usuario';
    const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    setEditingIndex(null);
    setForm({ fecha: currentDate, hora: `${hh}:${mm}`, tipo: 'Paquete', estado: 'Entregado', empresa: userName, propietario: '', portalPisoLetra: '', observaciones: '' });
    setSelectedRemitente('');
    setShowModal(true);
  };

  const openEdit = (idx) => {
    setEditingIndex(idx);
    const now = getMadridDate();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setForm({ ...allItems[idx], hora: `${hh}:${mm}` });
    const empresaVal = allItems[idx]?.empresa || '';
    setSelectedRemitente(REMITENTES_SUGERIDOS.includes(empresaVal) ? empresaVal : (empresaVal ? 'Otro' : ''));
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!form.hora || !form.empresa) { setShowModal(false); return; }
    const next = [...allItems];
    const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
    const itemToSave = { ...form, nombre }; // Asegurar que se incluya el nombre del empleado
    if (editingIndex === null) next.push(itemToSave); else next[editingIndex] = itemToSave;
    setAllItems(next);
    setShowModal(false);

    // Enviar al backend con datos del empleado y del formulario
    try {
      const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
      const email = user?.['CORREO ELECTRONICO'] || user?.['CORREO ELECTRONIC'] || user?.EMAIL || user?.email || '';
      const codigo = user?.CODIGO || user?.codigo || user?.['CODIGO EMPLEADO'] || '';
      const centroTrabajo = await resolveCentroTrabajo();
      const payload = {
        // Datos del formulario
        ...(editingIndex !== null && { id: allItems[editingIndex].id || `item_${editingIndex}` }),
        fecha: form.fecha,
        hora: form.hora,
        tipo: form.tipo,
        empresa: form.empresa,
        propietario: form.propietario,
        portalPisoLetra: form.portalPisoLetra,
        observaciones: form.observaciones,
        estado: editingIndex !== null ? form.estado : 'Pendiente',
        // Datos del empleado
        codigo,
        nombre,
        email,
        centroTrabajo,
        loc: currentLocation || null,
        address: currentAddress || null,
        source: 'webapp_paquetes',
        // Metadatos para edit
        ...(editingIndex !== null && { accion: 'edit' })
      };
      // Folosim URL direct către n8n în producție (ca tareas)
      const webhookUrl = editingIndex !== null 
        ? 'https://n8n.decaminoservicios.com/webhook/9a16282e-3651-4ac6-a3da-c31ad18c480b'  // Edit
        : 'https://n8n.decaminoservicios.com/webhook/028926ba-398d-45a4-96b5-f145fb687fa6'; // Nueva entrada
      
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (_) {
      // No bloquear la UI si hay fallo al enviar
    }
  };

  const exportExcel = async () => {
    if (!allItems.length) return;
    
    const today = getMadridDate();
    await exportToExcelWithHeader(allItems, EXPORT_COLUMNS, 'CUADERNO PAQUETERÍA', 'control_correo', {}, `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`);
  };

  const exportPDF = async () => {
    if (!allItems.length) return;
    
    const exportData = allItems;
    
    // Reutiliza pdfMake cu antet de brand folosit în alte pagini
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
      ['Fecha', 'Hora', 'Empleado', 'Tipo', 'Empresa/Remitente', 'Propietario', 'Portal/Piso/Letra', 'Observaciones', 'Estado'],
      ...exportData.map(item => [
        item.fecha || '',
        item.hora || '',
        item.nombre || '',
        item.tipo || '',
        item.empresa || '',
        item.propietario || '',
        item.portalPisoLetra || '',
        item.observaciones || '',
        item.estado || 'Pendiente'
      ])
    ];

    const reportTitle = 'CUADERNO PAQUETERÍA';
    const today = getMadridDate();
    const period = `${today.getDate()} ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][today.getMonth()]} ${today.getFullYear()}`;

    const docDefinition = {
      pageOrientation: 'landscape', // landscape pentru mai multe coloane
      content: [
        { table: { widths: ['*'], body: [[{ text: 'DE CAMINO SERVICIOS AUXILIARES SL', style: 'companyName' }],
                                           [{ text: 'NIF: B85524536', style: 'companyDetails' }],
                                           [{ text: 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España', style: 'companyDetails' }],
                                           [{ text: 'Teléfono: +34 91 123 45 67', style: 'companyDetails' }],
                                           [{ text: 'Email: info@decaminoservicios.com', style: 'companyDetails' }]] }, layout: 'noBorders', margin: [0,0,0,10] },
        { text: reportTitle, style: 'reportTitle' },
        { text: `Período: ${period}`, style: 'period' },
        { text: `Centro de Trabajo: ${userCentro || ''}`, style: 'period', margin: [0, 0, 0, 10] },
        { table: { headerRows: 1, widths: [60, 50, 80, 60, 100, 80, 80, '*', 70], body: tableBody }, layout: 'lightHorizontalLines' }
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#FFFFFF', fillColor: '#CC0000', alignment: 'center', margin: [0,0,0,8] },
        companyDetails: { fontSize: 9, bold: true, color: '#333333', fillColor: '#F0F0F0', alignment: 'center' },
        reportTitle: { fontSize: 12, bold: true, color: '#FFFFFF', fillColor: '#0066CC', alignment: 'center', margin: [0,4,0,2] },
        period: { fontSize: 10, color: '#333333', alignment: 'center' }
      }
    };

    window.pdfMake.createPdf(docDefinition).download(`control_correo_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}.pdf`);
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Back3DButton to="/inicio" title="Volver a Inicio" />
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">CONTROL CORREO/PAQUETERÍA</h1>
                <p className="text-gray-600">
                  Gestión de correo y paquetería por día • Madrid: {madridDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                Este sistema de control de correo y paquetería está <strong>en fase de pruebas</strong>. Algunos datos pueden no estar 100% actualizados. 
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
                  onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de control de correo', '_blank')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                >
                  <span className="text-sm">📱</span>
                  Contactar Administrador
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mail Control Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Cuaderno Paquetería - {userCentro ? `${userCentro} - ` : ''}DE CAMINO SERVICIOS AUXILIARES SL
              </h2>
              <p className="text-gray-600">
                {allItems.length} entradas totales
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportExcel}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm"
                title="Exportar a Excel (XLS)"
              >
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
              </button>
              <button
                onClick={exportPDF}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm"
                title="Exportar a PDF"
              >
                <FileText className="w-5 h-5 text-rose-600" />
              </button>
              {canPerformActions() && (
              <button
                onClick={openNew}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Nueva Entrada
              </button>
              )}
              {!canPerformActions() && (
                <div className="inline-flex items-center gap-2 bg-gray-400 text-white px-4 py-2 rounded-lg shadow-sm cursor-not-allowed opacity-50">
                  <Plus className="w-4 h-4" />
                  Nueva Entrada
                  <span className="text-xs ml-1">(Ficha primero)</span>
                </div>
              )}
            </div>
          </div>

          {allItems.length === 0 ? (
            <div className="py-16 text-center text-gray-500">No hay entradas registradas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    {DISPLAY_COLUMNS.map(col => (
                      <th key={col.key} className="py-2 px-3 font-medium border-b">{col.label}</th>
                    ))}
                    <th className="py-2 px-3 font-medium border-b">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((it, idx) => (
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
                            e.stopPropagation(); // Prevent row click
                            openEdit(idx);
                          }} 
                          className="text-blue-600 hover:underline"
                        >
                          Entregado
                        </button>
                        ) : (
                          <span className="text-gray-400 cursor-not-allowed">
                            Entregado
                            <span className="text-xs ml-1">(Ficha primero)</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal Nueva Entrada */}
        {showModal && editingIndex === null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Nueva entrada</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fecha Entrega</label>
                  <input value={form.fecha} readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Hora Entrega</label>
                  <input value={form.hora} readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed" placeholder="hh:mm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                    <option>Paquete</option>
                    <option>Certificado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Empresa/Remitente</label>
                  <select
                    value={selectedRemitente}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedRemitente(val);
                      setForm({ ...form, empresa: val === 'Otro' ? '' : val });
                    }}
                    className="w-full border rounded-lg px-3 py-2 mb-2"
                  >
                    <option value="">Selecciona…</option>
                    {REMITENTES_SUGERIDOS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="Otro">Otro</option>
                  </select>
                  {selectedRemitente === 'Otro' && (
                    <input
                      value={form.empresa}
                      onChange={e => setForm({ ...form, empresa: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Especificar empresa"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Propietario</label>
                  <input value={form.propietario} onChange={e => setForm({ ...form, propietario: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Portal/Piso/Letra</label>
                  <input value={form.portalPisoLetra} onChange={e => setForm({ ...form, portalPisoLetra: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Observacion</label>
                  <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border">Cancelar</button>
                <button onClick={saveItem} className="px-4 py-2 rounded-lg bg-red-600 text-white">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Edit Entrada */}
        {showModal && editingIndex !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Edit entrada</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fecha Entrega</label>
                  <input value={form.fecha} readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Hora Entrega</label>
                  <input value={form.hora} readOnly className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed" placeholder="hh:mm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Estado</label>
                  <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                    <option>Entregado</option>
                    <option>Pendiente</option>
                    <option>Rechazado</option>
                    <option>Devuelto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Entregado Por</label>
                  <input 
                    value={user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || 'Usuario'} 
                    readOnly 
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed" 
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Entregado A</label>
                  <input value={form.propietario} onChange={e => setForm({ ...form, propietario: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Observacion Entrega</label>
                  <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border">Cancelar</button>
                <button onClick={saveItem} className="px-4 py-2 rounded-lg bg-red-600 text-white">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* Detalles */}
        {detailsItem && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Detalles del Registro</h3>
                <button onClick={() => setDetailsItem(null)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">ID:</span> {detailsItem.id || '-'}</div>
                <div><span className="font-semibold">Código:</span> {detailsItem.codigo || '-'}</div>
                <div><span className="font-semibold">Empleado:</span> {detailsItem.nombre || '-'}</div>
                <div><span className="font-semibold">Email:</span> {detailsItem.email || '-'}</div>
                <div><span className="font-semibold">Centro Trabajo:</span> {detailsItem.centroTrabajo || '-'}</div>
                <div><span className="font-semibold">Dirección:</span> {detailsItem.address || '-'}</div>
                <div><span className="font-semibold">Creado:</span> {detailsItem.created_at || '-'}</div>
                <div><span className="font-semibold">Fecha:</span> {detailsItem.fecha || '-'}</div>
                <div><span className="font-semibold">Hora:</span> {detailsItem.hora || '-'}</div>
                <div><span className="font-semibold">Tipo:</span> {detailsItem.tipo || '-'}</div>
                <div><span className="font-semibold">Empresa:</span> {detailsItem.empresa || '-'}</div>
                <div><span className="font-semibold">Propietario:</span> {detailsItem.propietario || '-'}</div>
                <div><span className="font-semibold">Portal/Piso/Letra:</span> {detailsItem.portalPisoLetra || '-'}</div>
                <div className="sm:col-span-2"><span className="font-semibold">Observaciones:</span> {detailsItem.observaciones || '-'}</div>
                <div><span className="font-semibold">Estado:</span> {detailsItem.estado || '-'}</div>
              </div>
              <div className="mt-5 flex items-center justify-end">
                <button onClick={() => setDetailsItem(null)} className="px-4 py-2 rounded-lg border">Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlCorreoPage;


