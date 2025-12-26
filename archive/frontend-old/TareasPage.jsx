import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button, Card, Modal, Notification } from '../components/ui';
import { Calendar, Clock, Plus, Edit3, Save, ChevronLeft, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToExcelWithHeader } from '../utils/exportExcel';
import Back3DButton from '../components/Back3DButton';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes';
import { useLocation } from '../contexts/LocationContextBase';
import activityLogger from '../utils/activityLogger';

const TareasPage = () => {
  const { user, loading } = useAuth();
  const { callApi } = useApi();
  const { currentLocation, currentAddress } = useLocation();
  const [notification, setNotification] = useState(null);
  // Obtiene el centro de trabajo desde los datos del usuario, probando múltiples variantes y búsqueda heurística
  const getCentroTrabajoFromUser = useCallback((u) => {
    if (!u) return '';
    const preferredKeys = [
      'CENTRO TRABAJO', // exact key from your data
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
      if (u[k] && String(u[k]).trim()) return String(u[k]).trim();
    }
    // Heurística: primer campo cuyo nombre contiene 'centro' o 'trabajo'
    try {
      const allKeys = Object.keys(u || {});
      const key = allKeys.find(key => {
        const lk = key.toLowerCase();
        return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(u[key]).trim();
      });
      if (key) {
        console.log('🔍 TareasPage: centroTrabajo found by key:', key, 'value:', u[key]);
        return String(u[key]).trim();
      }
    } catch (error) {
      console.warn('TareasPage: error infering centroTrabajo', error);
    }
    return '';
  }, []);

  // Busca el centro de trabajo en el listado de empleados (fallback robusto)
  const fetchCentroTrabajoFromEmployees = useCallback(async (email, codigo) => {
    try {
      const res = await callApi(routes.getEmpleados || routes.getUsuarios || routes.getUsuarios);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.body?.data || []));
      if (!Array.isArray(list)) return '';
      const match = list.find(emp => {
        const empEmail = emp?.['CORREO ELECTRONICO'] || emp?.EMAIL || emp?.email;
        const empCodigo = emp?.CODIGO || emp?.codigo;
        return (email && empEmail && String(empEmail).toLowerCase() === String(email).toLowerCase()) ||
               (codigo && empCodigo && String(empCodigo) === String(codigo));
      });
      if (match) {
        return (
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
      }
      return '';
    } catch (e) {
      console.error('TareasPage: error fetching employees for centroTrabajo', e);
      return '';
    }
  }, [callApi]);

  
  console.log('🔍 TareasPage: Component initialized, user:', user, 'loading:', loading, 'callApi:', typeof callApi);
  
  // Obtener fecha actual en Madrid (UTC+1/UTC+2 según DST)
  const getMadridDate = () => {
    const now = new Date();
    // Madrid timezone: Europe/Madrid
    const madridTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
    return madridTime;
  };
  
  const madridDate = getMadridDate();
  const [selectedMonth, setSelectedMonth] = useState(madridDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(madridDate.getFullYear());
  const [selectedDay, setSelectedDay] = useState(madridDate.getDate());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [tasks, setTasks] = useState({});
  const [newTask, setNewTask] = useState({ hora: '', descripcion: '' });
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [hasRecentFichaje, setHasRecentFichaje] = useState(false);
  // Normaliza loc (puede venir como objeto {latitude, longitude} o string "lat,lon")
  const normalizeLoc = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.latitude != null && value.longitude != null) {
      return `${value.latitude},${value.longitude}`;
    }
    try {
      return String(value);
    } catch (error) {
      console.warn('TareasPage: unable to normalize location', error);
      return '';
    }
  };
  // Obtiene fecha/hora de la tarea como Date (preferimos created_at)
  const getTaskDate = (t) => {
    try {
      const created = t?.created_at || t?.CREATED_AT;
      if (created && typeof created === 'string') return new Date(created.replace(' ', 'T'));
      const f = t?.fecha || t?.FECHA;
      const h = (t?.hora || t?.HORA || '').toString().padStart(5, '0');
      if (f && h) return new Date(`${f}T${h}`);
    } catch (error) {
      console.warn('TareasPage: unable to parse task date', error);
    }
    return new Date(NaN);
  };
  const [userCentro, setUserCentro] = useState('');

  // Lunile în spaniolă
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Zilele din lună
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  // Încarcă task-urile pentru ziua selectată
  useEffect(() => {
    const fetchTasksForCenter = async () => {
      try {
        const centro = getCentroTrabajoFromUser(user) || await fetchCentroTrabajoFromEmployees(
          user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email,
          user?.CODIGO || user?.codigo
        );
        if (!centro) return;
        setUserCentro(centro);
        const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
        const listUrl = `https://n8n.decaminoservicios.com/webhook/18868d2f-7808-434f-8d04-14848ff550fe?centroTrabajo=${encodeURIComponent(centro)}&fecha=${encodeURIComponent(dayStr)}`;
        console.log('🔍 TareasPage: Fetch tareas URL:', listUrl);
        const res = await fetch(listUrl, { headers: { 'Accept': 'application/json' } });
        console.log('🔍 TareasPage: Fetch tareas status:', res.status);
        if (!res.ok) return;
        const text = await res.text();
        console.log('🔍 TareasPage: Fetch tareas raw text:', text);
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch(e){ console.warn('🔍 TareasPage: JSON parse error tareas:', e); }
        console.log('🔍 TareasPage: Fetch tareas parsed:', data);
        // Tolerant extractor: array | single object | {data} | {success,data} | {body:{data}} | {records}
        let array = [];
        if (Array.isArray(data)) array = data;
        else if (data && typeof data === 'object' && (data.id || data.ID || data.hora || data.HORA || data.descripcion || data.DESCRIPCION)) array = [data];
        else if (data?.data && Array.isArray(data.data)) array = data.data;
        else if (data?.data && typeof data.data === 'object') array = [data.data];
        else if (data?.body?.data && Array.isArray(data.body.data)) array = data.body.data;
        else if (data?.body?.data && typeof data.body.data === 'object') array = [data.body.data];
        else if (data?.records && Array.isArray(data.records)) array = data.records;
        console.log('🔍 TareasPage: Fetch tareas array length:', Array.isArray(array) ? array.length : 'no-array');
        // Mapăm în structura paginii (pe zi selectată) - backend deja poate filtra după fecha
        const dayKey = `${selectedYear}-${selectedMonth}-${selectedDay}`;
        const filtered = (array || []).map(t => ({
          id: t.id || t.ID || `${dayStr}-${t.hora || t.HORA || ''}-${t.descripcion || t.DESCRIPCION || t.desc || ''}`,
          fecha: t.fecha || t.FECHA || dayStr,
          hora: String(t.hora || t.HORA || '').padStart(5, '0'),
          horaEdicion: t.horaEdicion || t.HORA_EDICION || '',
          descripcion: t.descripcion || t.DESCRIPCION || t.desc || '',
          codigo: t.codigo || t.CODIGO || '',
          nombre: t.nombre || t['NOMBRE / APELLIDOS'] || t.NOMBRE || '',
          email: t.email || t['CORREO ELECTRONICO'] || t.EMAIL || '',
          centroTrabajo: t.centroTrabajo || t['CENTRO TRABAJO'] || '',
          loc: normalizeLoc(t.loc || t.LOC || ''),
          locEdicion: t.locEdicion || t.LOC_EDICION || '',
          address: t.address || t.DIRECCION || '',
          ip: t.ip || '',
          created_at: t.created_at || t.CREATED_AT || ''
        }));
        console.log('🔍 TareasPage: Tasks mapped for day', dayKey, filtered);
        setTasks(prev => ({ ...prev, [dayKey]: filtered }));
      } catch (e) {
        console.warn('TareasPage: no se pudieron listar tareas por centro', e);
      }
    };

    fetchTasksForCenter();
  }, [selectedDay, selectedMonth, selectedYear, user, getCentroTrabajoFromUser, fetchCentroTrabajoFromEmployees]);

  // Verificar fichajes para el día actual
  useEffect(() => {
    const checkFichajes = async () => {
      console.log('🔍 TareasPage: checkFichajes called, user:', user);
      
      if (!user) {
        console.log('🔍 TareasPage: No user, returning');
        setHasRecentFichaje(false);
        return;
      }
      
      const today = getMadridDate();
      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      console.log('🔍 TareasPage: checkFichajes month:', month);
      
      try {
        const codigo = user?.CODIGO || user?.codigo || '';
        console.log('🔍 TareasPage: checkFichajes - codigo:', codigo);
        
        if (!codigo) {
          console.log('🔍 TareasPage: No codigo, setting empty fichajes');
          setHasRecentFichaje(false);
          return;
        }

        // Usar el mismo sistema que Fichaje.jsx
        const url = `${routes.getRegistros}?CODIGO=${encodeURIComponent(codigo)}&MES=${encodeURIComponent(month)}&limit=1000&max=1000`;
        console.log('🔍 TareasPage: Fetching fichajes from:', url);
        const result = await callApi(url);
        
        console.log('🔍 TareasPage: API result:', result);
        
        if (result.success) {
          const data = Array.isArray(result.data) ? result.data : [result.data];
          console.log('🔍 TareasPage: Raw data:', data);
          
          // Filtrar fichajes din ziua curentă (nu ultimele 24h)
          const today = getMadridDate();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const todayFichajes = data.filter(item => {
            const d = (item.FECHA || item.data || '').trim();
            return d === todayStr;
          });
          console.log('🔍 TareasPage: Fichajes ziua curentă:', todayFichajes.length, 'pentru data:', todayStr);
          setHasRecentFichaje(todayFichajes.length > 0);
        } else {
          console.log('🔍 TareasPage: API call failed');
          setHasRecentFichaje(false);
        }
      } catch (error) {
        console.error('Error checking fichajes:', error);
        setHasRecentFichaje(false);
      }
    };

    checkFichajes();
  }, [user, callApi]);

  const currentDayTasks = tasks[`${selectedYear}-${selectedMonth}-${selectedDay}`] || [];
  
  // Verifică dacă ziua selectată este ziua curentă (Madrid time)
  const isCurrentDay = () => {
    const now = new Date();
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const currentDay = madridTime.getDate();
    const currentMonth = madridTime.getMonth() + 1;
    const currentYear = madridTime.getFullYear();
    
    return selectedDay === currentDay && selectedMonth === currentMonth && selectedYear === currentYear;
  };
  
  // Disponibilidad: existe algún fichaje en las últimas 24h (indiferent de ziua curentă)
  // DOAR dacă este ziua curentă
  const canAddTask = () => {
    const canAdd = isCurrentDay() && hasRecentFichaje;
    console.log('🔍 TareasPage: canAddTask check:', {
      isCurrentDay: isCurrentDay(),
      hasRecentFichaje,
      canAdd
    });
    return canAdd;
  };

  const handleAddTask = () => {
    // Get current Madrid time
    const madridTime = getMadridDate();
    const currentHour = madridTime.getHours().toString().padStart(2, '0');
    const currentMinute = madridTime.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${currentHour}:${currentMinute}`;

    // Set current Madrid time and open modal
    setEditingTask(null);
    setNewTask({ hora: formattedTime, descripcion: '' });
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    // Setăm ora la cea curentă (Madrid) când deschidem editorul
    const now = getMadridDate();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    setNewTask({ hora: `${hh}:${mm}`, descripcion: task.descripcion });
    setShowTaskModal(true);
  };

  const handleShowTaskDetails = (task) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
  };

  const handleUpdateTask = async () => {
    try {
      const dayKey = `${selectedYear}-${selectedMonth}-${selectedDay}`;
      const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
      const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
      const email = user?.['CORREO ELECTRONICO'] || user?.['CORREO ELECTRONIC'] || user?.EMAIL || user?.email || '';
      const codigo = user?.CODIGO || user?.codigo || user?.['CODIGO EMPLEADO'] || user?.['CODIGO_EMPLEADO'] || '';
      let centroTrabajo = getCentroTrabajoFromUser(user);
      if (!centroTrabajo) {
        centroTrabajo = await fetchCentroTrabajoFromEmployees(email, codigo);
      }

      // Optimistic update în listă
      setTasks(prev => ({
        ...prev,
        [dayKey]: (prev[dayKey] || []).map(task => 
          task.id === editingTask.id 
            ? { ...task, hora: newTask.hora, descripcion: newTask.descripcion }
            : task
        )
      }));

      // Trimite notificarea/POST către webhook-ul indicat
      const updatePayload = {
        action: 'tarea_update',
        fecha: dayStr,
        hora: newTask.hora,
        descripcion: newTask.descripcion,
        codigo,
        nombre,
        email,
        centroTrabajo,
        // Specificăm explicit că ora și locația provin din momentul actualizării
        update_time: newTask.hora,
        update_loc: normalizeLoc(currentLocation || null),
        update_address: currentAddress || null,
        // Identificatori și valori originale pentru corelare în backend
        id: editingTask?.id || null,
        original_task_id: editingTask?.id || null,
        original_fecha: editingTask?.fecha || dayStr,
        original_hora: editingTask?.hora || null,
        original_descripcion: editingTask?.descripcion || null,
        source: 'webapp_tareas_update'
      };

      const updateResp = await fetch('https://n8n.decaminoservicios.com/webhook/trimiteemail/5c8b7352-280f-416d-b946-43eefade75d5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      if (updateResp.ok) {
        const updateResult = await updateResp.json();
        if (updateResult.success) {
          setNotification({ type: 'success', title: 'Tarea actualizada', message: updateResult.message || 'La tarea se ha actualizado correctamente.' });
        } else {
          setNotification({ type: 'error', title: 'Error', message: updateResult.message || 'No se pudo actualizar la tarea.' });
        }
      } else {
        setNotification({ type: 'error', title: 'Error de conexión', message: 'No se pudo actualizar la tarea. Inténtalo de nuevo.' });
      }

      // Log
      try {
        await activityLogger.logAction('tarea_updated', {
          user: nombre,
          email: email,
          grupo: user?.['GRUPO'] || user?.grupo || '',
          role: user?.['GRUPO'] || user?.grupo || '',
          ...updatePayload
        });
      } catch (error) {
        console.warn('TareasPage: failed to log tarea update', error);
      }

      // Re-fetch pentru a sincroniza cu backend
      try {
        const listUrl = `https://n8n.decaminoservicios.com/webhook/18868d2f-7808-434f-8d04-14848ff550fe?centroTrabajo=${encodeURIComponent(centroTrabajo)}&fecha=${encodeURIComponent(dayStr)}`;
        const resList = await fetch(listUrl, { headers: { 'Accept': 'application/json' } });
        if (resList.ok) {
          const textList = await resList.text();
          let dataList = null;
          try {
            dataList = textList ? JSON.parse(textList) : null;
          } catch (error) {
            console.warn('TareasPage: error parsing tareas update list', error);
          }
          let array = [];
          if (Array.isArray(dataList)) array = dataList;
          else if (dataList?.data && Array.isArray(dataList.data)) array = dataList.data;
          else if (dataList && typeof dataList === 'object') array = [dataList];
          const mapped = (array || []).map(t => ({
            id: t.id || t.ID || `${dayStr}-${t.hora || t.HORA || ''}-${t.descripcion || t.DESCRIPCION || t.desc || ''}`,
            fecha: t.fecha || t.FECHA || dayStr,
            hora: String(t.hora || t.HORA || '').padStart(5, '0'),
            horaEdicion: t.horaEdicion || t.HORA_EDICION || '',
            descripcion: t.descripcion || t.DESCRIPCION || t.desc || '',
            codigo: t.codigo || t.CODIGO || '',
            nombre: t.nombre || t['NOMBRE / APELLIDOS'] || t.NOMBRE || '',
            email: t.email || t['CORREO ELECTRONICO'] || t.EMAIL || '',
            centroTrabajo: t.centroTrabajo || t['CENTRO TRABAJO'] || '',
            loc: normalizeLoc(t.loc || t.LOC || ''),
            locEdicion: t.locEdicion || t.LOC_EDICION || '',
            address: t.address || t.DIRECCION || '',
            ip: t.ip || '',
            created_at: t.created_at || t.CREATED_AT || ''
          }));
          setTasks(prev => ({ ...prev, [dayKey]: mapped }));
        }
      } catch (e) {
        console.warn('TareasPage: refresh after update failed', e);
      }

      setEditingTask(null);
      setNewTask({ hora: '', descripcion: '' });
      setShowTaskModal(false);
    } catch (e) {
      console.error('TareasPage: error on task update', e);
      setEditingTask(null);
      setNewTask({ hora: '', descripcion: '' });
      setShowTaskModal(false);
    }
  };

  // Guardar tarea: POST a n8n con datos del empleado, centro, ubicación y tarea
  const handleSaveTask = async () => {
    try {
      if (!newTask.hora || !newTask.descripcion) return;
      const dayKey = `${selectedYear}-${selectedMonth}-${selectedDay}`;
      const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      const nombre = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.name || '';
      const email = user?.['CORREO ELECTRONICO'] || user?.['CORREO ELECTRONIC'] || user?.EMAIL || user?.email || '';
      const codigo = user?.CODIGO || user?.codigo || user?.['CODIGO EMPLEADO'] || user?.['CODIGO_EMPLEADO'] || '';
      let centroTrabajo = getCentroTrabajoFromUser(user);
      if (!centroTrabajo) {
        console.log('⚠️ TareasPage: centroTrabajo vacío en user. Intentando resolver desde lista empleados…');
        centroTrabajo = await fetchCentroTrabajoFromEmployees(email, codigo);
      }

      const payload = {
        fecha: dayStr,
        hora: newTask.hora,
        descripcion: newTask.descripcion,
        codigo,
        nombre,
        email,
        centroTrabajo,
        loc: currentLocation || null,
        address: currentAddress || null,
        source: 'webapp_tareas'
      };

      const webhookUrl = 'https://n8n.decaminoservicios.com/webhook/37aaf6bd-8be6-4ccf-9aec-185ee4f926bb';
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let respJson = null;
      try {
        respJson = await resp.json();
      } catch (error) {
        console.warn('TareasPage: error parsing tarea webhook response', error);
      }

      if (!resp.ok || (respJson && respJson.success === false)) {
        console.error('TareasPage: webhook respondió con error', resp.status, respJson);
        setNotification({ type: 'error', title: 'Error', message: (respJson && (respJson.message || respJson.error)) || 'No se pudo registrar la tarea.' });
      } else if (respJson && respJson.success) {
        setNotification({ type: 'success', title: 'Tarea registrada', message: respJson.message || 'La tarea se ha registrado correctamente.' });
      }

      // Actualiza localmente (optimista) – prepend ca să apară sus imediat
      const optimistic = {
        id: `temp-${Date.now()}`,
        fecha: dayStr,
        hora: newTask.hora,
        descripcion: newTask.descripcion,
        codigo,
        nombre,
        email,
        centroTrabajo,
        loc: normalizeLoc(currentLocation || null),
        address: currentAddress || null,
        created_at: undefined,
        ip: undefined
      };
      setTasks(prev => ({
        ...prev,
        [dayKey]: [optimistic, ...(prev[dayKey] || [])]
      }));

      // Re-fetch de la lista oficial pentru a sincroniza cu backend
      try {
        const listUrl = `https://n8n.decaminoservicios.com/webhook/18868d2f-7808-434f-8d04-14848ff550fe?centroTrabajo=${encodeURIComponent(centroTrabajo)}&fecha=${encodeURIComponent(dayStr)}`;
        console.log('🔄 TareasPage: Refreshing tareas after create:', listUrl);
        const resList = await fetch(listUrl, { headers: { 'Accept': 'application/json' } });
        if (resList.ok) {
          const textList = await resList.text();
          let dataList = null;
          try {
            dataList = textList ? JSON.parse(textList) : null;
          } catch (error) {
            console.warn('TareasPage: error parsing tareas list after create', error);
          }
          let array = [];
          if (Array.isArray(dataList)) array = dataList;
          else if (dataList?.data && Array.isArray(dataList.data)) array = dataList.data;
          else if (dataList && typeof dataList === 'object') array = [dataList];
          const mapped = (array || []).map(t => ({
            id: t.id || t.ID || `${dayStr}-${t.hora || t.HORA || ''}-${t.descripcion || t.DESCRIPCION || t.desc || ''}`,
            fecha: t.fecha || t.FECHA || dayStr,
            hora: String(t.hora || t.HORA || '').padStart(5, '0'),
            horaEdicion: t.horaEdicion || t.HORA_EDICION || '',
            descripcion: t.descripcion || t.DESCRIPCION || t.desc || '',
            codigo: t.codigo || t.CODIGO || '',
            nombre: t.nombre || t['NOMBRE / APELLIDOS'] || t.NOMBRE || '',
            email: t.email || t['CORREO ELECTRONICO'] || t.EMAIL || '',
            centroTrabajo: t.centroTrabajo || t['CENTRO TRABAJO'] || '',
            loc: normalizeLoc(t.loc || t.LOC || ''),
            locEdicion: t.locEdicion || t.LOC_EDICION || '',
            address: t.address || t.DIRECCION || '',
            ip: t.ip || '',
            created_at: t.created_at || t.CREATED_AT || ''
          }));
          setTasks(prev => ({ ...prev, [dayKey]: mapped }));
        }
      } catch (e) {
        console.warn('TareasPage: refresh after create failed', e);
      }

      // Log de creación de tarea
      try {
        await activityLogger.logAction('tarea_created', {
          user: nombre,
          email: email,
          grupo: user?.['GRUPO'] || user?.grupo || '',
          role: user?.['GRUPO'] || user?.grupo || '',
          fecha: dayStr,
          hora: newTask.hora,
          descripcion: newTask.descripcion,
          codigo,
          centroTrabajo,
          loc: currentLocation || null,
          address: currentAddress || null
        });
      } catch (e) {
        console.warn('TareasPage: no se pudo registrar el log de tarea', e);
      }
      setShowTaskModal(false);
      setEditingTask(null);
      setNewTask({ hora: '', descripcion: '' });
    } catch (e) {
      console.error('TareasPage: error enviando tarea al webhook', e);
      setNotification({ type: 'error', title: 'Error de Conexión', message: 'No se pudo registrar la tarea. Inténtalo de nuevo.' });
      setShowTaskModal(false);
    }
  };

  const getDayOfWeek = (day) => {
    const date = new Date(selectedYear, selectedMonth - 1, day);
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return daysOfWeek[date.getDay()];
  };

  // Export helpers
  const exportCurrentDayToXLS = async () => {
    const data = currentDayTasks.map(t => ({
      fecha: t.fecha,
      hora: t.hora,
      horaEdicion: t.horaEdicion,
      descripcion: t.descripcion,
      codigo: t.codigo,
      nombre: t.nombre,
      email: t.email,
      centroTrabajo: t.centroTrabajo,
      loc: t.loc,
      locEdicion: t.locEdicion,
      address: t.address,
      created_at: t.created_at,
      ip: t.ip
    }));
    const columns = [
      { key: 'fecha', label: 'Fecha', width: 14 },
      { key: 'hora', label: 'Hora', width: 10 },
      { key: 'horaEdicion', label: 'Hora Edición', width: 12 },
      { key: 'descripcion', label: 'Descripción', width: 40 },
      { key: 'nombre', label: 'Nombre', width: 28 },
      { key: 'codigo', label: 'Código', width: 14 },
      { key: 'email', label: 'Email', width: 30 },
      { key: 'centroTrabajo', label: 'Centro', width: 28 },
      { key: 'loc', label: 'Ubicación', width: 25 },
      { key: 'locEdicion', label: 'Ubicación Edición', width: 25 },
      { key: 'address', label: 'Dirección', width: 35 },
      { key: 'created_at', label: 'Creado', width: 20 },
      { key: 'ip', label: 'IP', width: 16 }
    ];
    const reportTitle = 'CUADERNO DIARIO - TAREAS';
    const filename = `tareas_${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
    const period = `${selectedDay} ${months[selectedMonth - 1]} ${selectedYear} • Centro: ${userCentro || ''}`;
    await exportToExcelWithHeader(data, columns, reportTitle, filename, {}, period);
  };

  const exportCurrentDayToPDF = async () => {
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
      ['Fecha', 'Hora', 'Nombre', 'Descripción'],
      ...currentDayTasks.map(t => [
        t.fecha || '',
        t.hora || '',
        t.nombre || '',
        t.descripcion || ''
      ])
    ];

    const reportTitle = 'CUADERNO DIARIO - TAREAS';
    const period = `${selectedDay} ${months[selectedMonth - 1]} ${selectedYear}`;

    const docDefinition = {
      pageOrientation: 'portrait',
      content: [
        { table: { widths: ['*'], body: [[{ text: 'DE CAMINO SERVICIOS AUXILIARES SL', style: 'companyName' }],
                                           [{ text: 'NIF: B85524536', style: 'companyDetails' }],
                                           [{ text: 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España', style: 'companyDetails' }],
                                           [{ text: 'Teléfono: +34 91 123 45 67', style: 'companyDetails' }],
                                           [{ text: 'Email: info@decaminoservicios.com', style: 'companyDetails' }]] }, layout: 'noBorders', margin: [0,0,0,10] },
        { text: reportTitle, style: 'reportTitle' },
        { text: `Período: ${period}`, style: 'period' },
        { text: `Centro de Trabajo: ${userCentro || ''}`, style: 'period', margin: [0, 0, 0, 10] },
        { table: { headerRows: 1, widths: [80, 50, 120, '*'], body: tableBody }, layout: 'lightHorizontalLines' }
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#FFFFFF', fillColor: '#CC0000', alignment: 'center', margin: [0,0,0,8] },
        companyDetails: { fontSize: 9, bold: true, color: '#333333', fillColor: '#F0F0F0', alignment: 'center' },
        reportTitle: { fontSize: 12, bold: true, color: '#FFFFFF', fillColor: '#0066CC', alignment: 'center', margin: [0,4,0,2] },
        period: { fontSize: 10, color: '#333333', alignment: 'center' }
      }
    };

    window.pdfMake.createPdf(docDefinition).download(`tareas_${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}.pdf`);
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
                <Calendar className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Tareas Diarias</h1>
                <p className="text-gray-600">
                  Gestión de tareas por día • Madrid: {madridDate.toLocaleDateString('es-ES', {
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
              <Back3DButton to="/cuadernos" title="Volver a Cuadernos" />
            </div>
          </div>

          {/* Compact Month and Day Selectors */}
          <div className="flex justify-center">
            <div className="flex items-center gap-4">
              {/* Month Selector */}
              <Card className="p-2 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 shadow-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedMonth === 1) {
                        setSelectedYear(selectedYear - 1);
                        setSelectedMonth(12);
                      } else {
                        setSelectedMonth(selectedMonth - 1);
                      }
                      setSelectedDay(1);
                    }}
                    className="w-8 h-8 bg-white border border-red-300 rounded flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm hover:shadow-md group"
                  >
                    <ChevronLeft className="w-4 h-4 text-red-600 group-hover:text-red-700" />
                  </button>
                  
                  <div className="bg-white border border-red-300 rounded px-3 py-1 shadow-sm min-w-[80px] text-center">
                    <div className="text-sm font-semibold text-red-600">
                      {months[selectedMonth - 1]}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (selectedMonth === 12) {
                        setSelectedYear(selectedYear + 1);
                        setSelectedMonth(1);
                      } else {
                        setSelectedMonth(selectedMonth + 1);
                      }
                      setSelectedDay(1);
                    }}
                    className="w-8 h-8 bg-white border border-red-300 rounded flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm hover:shadow-md group"
                  >
                    <ChevronRight className="w-4 h-4 text-red-600 group-hover:text-red-700" />
                  </button>
                </div>
              </Card>

              {/* Day Selector */}
              <Card className="p-2 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 shadow-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedDay === 1) {
                        setSelectedDay(daysInMonth);
                      } else {
                        setSelectedDay(selectedDay - 1);
                      }
                    }}
                    className="w-8 h-8 bg-white border border-red-300 rounded flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm hover:shadow-md group"
                  >
                    <ChevronLeft className="w-4 h-4 text-red-600 group-hover:text-red-700" />
                  </button>
                  
                  <div className="bg-white border border-red-300 rounded px-3 py-1 shadow-sm min-w-[60px] text-center">
                    <div className="text-sm font-semibold text-red-600">
                      {selectedDay}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getDayOfWeek(selectedDay)}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (selectedDay === daysInMonth) {
                        setSelectedDay(1);
                      } else {
                        setSelectedDay(selectedDay + 1);
                      }
                    }}
                    className="w-8 h-8 bg-white border border-red-300 rounded flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm hover:shadow-md group"
                  >
                    <ChevronRight className="w-4 h-4 text-red-600 group-hover:text-red-700" />
                  </button>
                </div>
              </Card>
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
                Este sistema de gestión de tareas está <strong>en fase de pruebas</strong>. Algunos datos pueden no estar 100% actualizados. 
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
                  onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de tareas', '_blank')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                >
                  <span className="text-sm">📱</span>
                  Contactar Administrador
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Task Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Cuaderno Diario - {userCentro ? `${userCentro} - ` : ''}{selectedDay} de {months[selectedMonth - 1]} {selectedYear}
              </h2>
              <p className="text-gray-600">
                {getDayOfWeek(selectedDay)} • {currentDayTasks.length} tareas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCurrentDayToXLS}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm"
                title="Exportar a Excel (XLS)"
              >
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
              </button>
              <button
                onClick={exportCurrentDayToPDF}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm"
                title="Exportar a PDF"
              >
                <FileText className="w-5 h-5 text-rose-600" />
              </button>
              {isCurrentDay() && (
                <Button
                  onClick={handleAddTask}
                  disabled={!canAddTask()}
                  className={`flex items-center gap-2 ${!canAddTask() ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!canAddTask() ? 'Primero debes registrar fichaje para agregar tareas' : 'Agregar nueva tarea'}
                >
                  <Plus className="w-4 h-4" />
                  Nueva Tarea
                </Button>
              )}
            </div>
          </div>

          {/* Tasks Table */}
          {currentDayTasks.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">
                No hay tareas para este día
              </h3>
              <p className="text-gray-400 mb-4">
                Agrega tu primera tarea haciendo clic en &quot;Nueva Tarea&quot;
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Hora</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Descripción</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDayTasks
                    .sort((a, b) => b.hora.localeCompare(a.hora))
                    .map((task) => (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => handleShowTaskDetails(task)}>
                      <td className="py-3 px-4">
                        <div className="text-gray-800 font-medium">{task.fecha || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{task.hora}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-800 font-medium">{task.nombre || '—'}</div>
                        <div className="text-xs text-gray-500">{task.codigo || ''}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-700">{task.descripcion || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {(() => {
                            const userEmail = user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email || '';
                            const userCodigo = user?.CODIGO || user?.codigo || '';
                            const taskEmail = task?.email || '';
                            const taskCodigo = task?.codigo || '';
                            const owned = (taskEmail && userEmail && String(taskEmail).toLowerCase() === String(userEmail).toLowerCase()) ||
                                           (taskCodigo && userCodigo && String(taskCodigo) === String(userCodigo));
                            const createdAt = getTaskDate(task);
                            const ageOk = !isNaN(createdAt) ? (Date.now() - createdAt.getTime() <= 72 * 60 * 60 * 1000) : true;
                            const canEdit = owned && ageOk;
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  canEdit && handleEditTask(task);
                                }}
                                disabled={!canEdit}
                                className={`text-blue-600 hover:text-blue-700 hover:bg-blue-50 ${!canEdit ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-blue-600' : ''}`}
                                title={canEdit ? 'Editar tarea' : 'Solo puedes editar tus propias tareas (máx. 72h)'}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Task Modal */}
        <Modal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
            setNewTask({ hora: '', descripcion: '' });
          }}
          title={editingTask ? "Editar Tarea" : "Nueva Tarea"}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora
              </label>
              <input
                type="time"
                value={newTask.hora}
                onChange={(e) => setNewTask(prev => ({ ...prev, hora: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                readOnly
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={newTask.descripcion}
                onChange={(e) => setNewTask(prev => ({ ...prev, descripcion: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
                placeholder="Describe la tarea..."
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowTaskModal(false);
                  setEditingTask(null);
                  setNewTask({ hora: '', descripcion: '' });
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={editingTask ? handleUpdateTask : handleSaveTask}
                disabled={!newTask.hora || !newTask.descripcion}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingTask ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Task Details Modal */}
        {showTaskDetails && selectedTask && (
          <Modal
            isOpen={showTaskDetails}
            onClose={() => {
              setShowTaskDetails(false);
              setSelectedTask(null);
            }}
            title="Detalles de la Tarea"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.id || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.hora || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Edición</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.horaEdicion || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.fecha || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.descripcion || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.nombre || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.codigo || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.email || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Trabajo</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.centroTrabajo || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.loc || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación Edición</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.locEdicion || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.address || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.ip || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Creado</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">{selectedTask.created_at || '—'}</div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowTaskDetails(false);
                    setSelectedTask(null);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {notification && (
          <Notification
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </div>
  );
};

export default TareasPage;
