import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, Button, Modal } from '../../components/ui';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useAuth } from '../../contexts/AuthContextBase';
import activityLogger from '../../utils/activityLogger';
import { routes } from '../../utils/routes';

export default function AccessMatrix() {
  const {
    getAllPermissions,
    savePermissions,
    deleteUnusedGroups,
    getEmpleadoGrupoScope,
    saveEmpleadoGrupoScope,
  } = useAdminApi();
  const { user: authUser } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [customGroups, setCustomGroups] = useState([]);
  const isMountedRef = useRef(true);

  // Grupuri vizibile = cele din DatosEmpleados (+ custom adăugate manual). Fără seed hardcodat.
  const [userGroups, setUserGroups] = useState([]);
  const [groupsFromEmpleados, setGroupsFromEmpleados] = useState([]);

  // Modulele aplicației – sincronizate cu cheile reale din backend
  const modules = useMemo(() => ([
    { id: 'dashboard', name: 'Panel Principal', icon: '🏠', description: 'Vista general e inicio' },
    { id: 'datos', name: 'Datos Personales', icon: '🆔', description: 'Información del empleado' },
    { id: 'mis-tareas', name: 'Mis Tareas', icon: '✅', description: 'Tareas asignadas al empleado (confirmar y subir fotos)' },
    { id: 'tareas', name: 'Tareas', icon: '📋', description: 'Gestión de todas las tareas (crear, asignar, prioridad, seguimiento)' },
    { id: 'empleados', name: 'Empleados', icon: '👥', description: 'Gestión de empleados' },
    { id: 'fichar-empleados', name: 'Fichar Empleados', icon: '⏰', description: 'Registro de jornada limitado (solo mis fichajes)' },
    { id: 'fichar-admin', name: 'Fichar Admin', icon: '⏰', description: 'Registro de jornada completo (todos los fichajes y gestión)' },
    { id: 'solicitudes-empleados', name: 'Solicitudes Empleados', icon: '📝', description: 'Solicitudes limitadas (solo mis solicitudes)' },
    { id: 'solicitudes-admin', name: 'Solicitudes Admin', icon: '📝', description: 'Solicitudes completas (todas las solicitudes y estadísticas)' },
    { id: 'asuntos-propios', name: 'Asuntos Propios', icon: '📅', description: 'Derecho a solicitar AP en «Nueva Solicitud» (no afecta crear solicitud para empleado)' },
    { id: 'documentos', name: 'Documentos', icon: '📄', description: 'Documentos y nóminas' },
    { id: 'documentos-empleados', name: 'Documentos Empleados', icon: '📂', description: 'Archivos por empleado' },
    { id: 'prl-documentos', name: 'Documentos PRL', icon: '🛡️', description: 'PRL: plantillas, envíos y firma por grupo' },
    { id: 'cuadrantes', name: 'Cuadrantes', icon: '📅', description: 'Gestión de horarios' },
    { id: 'cuadrantes-empleado', name: 'Mi Horario', icon: '📅', description: 'Cuadrante personal' },
    { id: 'mis-inspecciones', name: 'Mis Inspecciones', icon: '👷‍♂️', description: 'Inspecciones asignadas' },
    { id: 'inspecciones', name: 'Inspecciones', icon: '🔍', description: 'Inspecciones digitales' },
    { id: 'aprobaciones', name: 'Aprobaciones', icon: '✅', description: 'Aprobaciones de fichajes' },
    { id: 'estadisticas', name: 'Estadísticas', icon: '📊', description: 'Informes y analítica' },
    { id: 'clientes', name: 'Clientes', icon: '👥', description: 'Gestión de clientes' },
    { id: 'servicios-periodicos', name: 'Servicios periódicos', icon: '🔄', description: 'Checklist mensual por comunidad (cristales, garajes…)' },
    { id: 'fotos-trabajo', name: 'Fotos Trabajo', icon: '📷', description: 'Fotos por comunidad y servicio (Cloudflare R2)' },
    { id: 'presupuestos-informes', name: 'Presupuestos e Informes (Legacy)', icon: '📋', description: 'Sistema actual de presupuestos e informes' },
    { id: 'presupuestos-v2', name: 'Presupuestos V2', icon: '🧾', description: 'Nuevo módulo Presupuestos V2' },
    { id: 'presupuestos-v2-config', name: 'Config Presupuestos V2', icon: '⚙️', description: 'Empresa, marca, series, parámetros y servicios V2' },
    { id: 'pedidos-empleados', name: 'Pedidos Empleados', icon: '🛒', description: 'Pedidos limitados (solo su comunidad)' },
    { id: 'pedidos-admin', name: 'Pedidos Admin', icon: '🛒', description: 'Pedidos completos (todas las comunidades)' },
    { id: 'admin', name: 'Admin Panel', icon: '⚙️', description: 'Panel de administración' },
    { id: 'cuadernos', name: 'Cuadernos', icon: '📔', description: 'Cuadernos y documentación por centro' },
    { id: 'proveedores', name: 'Proveedores', icon: '🏢', description: 'Gestión de proveedores' },
    { id: 'comunicados', name: 'Comunicados', icon: '📢', description: 'Anuncios y comunicaciones (gestionar)' },
    { id: 'hall-of-fame', name: 'Hall of Fame', icon: '🏆', description: 'Clasament y premios (calcular)' }
  ]), []);

  // Culorile pentru grupurile noi
  const groupColors = useMemo(() => ({
    'Admin': 'bg-red-500',
    'Supervisor': 'bg-blue-500', 
    'Manager': 'bg-green-500',
    'Operario': 'bg-yellow-500',
    'Auxiliar': 'bg-purple-500',
    'Developer': 'bg-indigo-500',
    'Empleado': 'bg-gray-500',
    'Limpieza': 'bg-pink-500',
    'Vigilante': 'bg-orange-500',
    'Mantenimiento': 'bg-teal-500',
    'default': 'bg-gray-500'
  }), []);

  // Demo data pentru AccessMatrix
  const setDemoPermissions = useCallback(() => {
    if (!isMountedRef.current) return;
    const demoPermissions = {
      Admin: modules.reduce((acc, module) => ({ ...acc, [module.id]: true }), {}),
      Supervisor: {
        dashboard: true,
        datos: true,
        'mis-tareas': true,
        tareas: true,
        empleados: true,
        'fichar-empleados': false,
        'fichar-admin': true,
        'solicitudes-empleados': false,
        'solicitudes-admin': true,
        documentos: true,
        'documentos-empleados': true,
        'prl-documentos': true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        'mis-inspecciones': true,
        inspecciones: true,
        aprobaciones: true,
        estadisticas: true,
        clientes: true,
        'servicios-periodicos': true,
        'fotos-trabajo': true,
        'presupuestos-informes': true,
        'presupuestos-v2': true,
        'presupuestos-v2-config': false,
        'pedidos-empleados': false,
        'pedidos-admin': true,
        cuadernos: true,
        proveedores: true,
        comunicados: true,
        'hall-of-fame': true,
        admin: false
      },
      Manager: {
        dashboard: true,
        datos: true,
        'mis-tareas': true,
        tareas: true,
        empleados: true,
        'fichar-empleados': false,
        'fichar-admin': true,
        'solicitudes-empleados': false,
        'solicitudes-admin': true,
        documentos: true,
        'documentos-empleados': true,
        'prl-documentos': true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        'mis-inspecciones': true,
        inspecciones: true,
        aprobaciones: false,
        estadisticas: true,
        clientes: true,
        'servicios-periodicos': true,
        'fotos-trabajo': true,
        'presupuestos-informes': true,
        'presupuestos-v2': true,
        'presupuestos-v2-config': false,
        'pedidos-empleados': false,
        'pedidos-admin': true,
        cuadernos: true,
        proveedores: true,
        comunicados: true,
        'hall-of-fame': true,
        admin: false
      },
      Empleado: {
        dashboard: true,
        datos: true,
        'mis-tareas': true,
        tareas: false,
        empleados: false,
        'fichar-empleados': true,
        'fichar-admin': false,
        'solicitudes-empleados': true,
        'solicitudes-admin': false,
        documentos: true,
        'documentos-empleados': false,
        'prl-documentos': false,
        cuadrantes: false,
        'cuadrantes-empleado': true,
        'mis-inspecciones': false,
        inspecciones: false,
        aprobaciones: false,
        estadisticas: false,
        clientes: false,
        'servicios-periodicos': false,
        'fotos-trabajo': false,
        'presupuestos-informes': false,
        'presupuestos-v2': false,
        'presupuestos-v2-config': false,
        'pedidos-empleados': false,
        'pedidos-admin': false,
        cuadernos: true, // Public - toți pot accesa cuadernos
        proveedores: false,
        comunicados: true, // Public - toți pot citi comunicados
        'hall-of-fame': true, // Public - toți pot vedea ranking-ul
        admin: false
      }
    };
    setPermissions(demoPermissions);
    setLoading(false);
  }, [modules]);

  const getAllPermissionsRef = useRef(getAllPermissions);

  const normalizePermissions = useCallback((rawPermissions) => {
    if (!rawPermissions) {
      return {};
    }

    if (!Array.isArray(rawPermissions)) {
      return rawPermissions;
    }

    const normalized = {};

    // Prima trecere: normalizează permisiunile din backend
    rawPermissions.forEach(entry => {
      const grupoModule = entry?.grupo_module || entry?.grupoModule;
      if (!grupoModule) return;

      const parts = grupoModule.split('_');
      if (parts.length < 2) return;

      const grupo = parts[0];
      const module = parts.slice(1).join('_');
      const value = entry?.permitted;
      const isPermitted =
        value === true ||
        value === 'true' ||
        value === 'TRUE' ||
        value === 1 ||
        value === '1';

      if (!normalized[grupo]) {
        normalized[grupo] = {};
      }

      normalized[grupo][module] = isPermitted;
    });

    // A doua trecere: asigură că toate modulele definite în array-ul `modules` 
    // sunt prezente pentru toate grupurile (chiar dacă nu există în backend)
    // Astfel, modulele noi vor apărea în tabel chiar dacă nu sunt încă în DB
    const allGroups = Object.keys(normalized);
    const allModuleIds = modules.map(m => m.id);
    
    allGroups.forEach(grupo => {
      allModuleIds.forEach(moduleId => {
        // Dacă modulul nu există în permisiunile normalizate, setează-l implicit la false
        if (normalized[grupo][moduleId] === undefined) {
          normalized[grupo][moduleId] = false;
        }
      });
    });

    return normalized;
  }, [modules]);

  const buildVisibleGroups = useCallback((empleadosGrupos, custom = []) => {
    const byId = new Map();
    (empleadosGrupos || []).forEach((g) => {
      if (!g?.id) return;
      byId.set(g.id, {
        id: g.id,
        name: g.name || g.id,
        color: groupColors[g.id] || groupColors.default,
      });
    });
    (custom || []).forEach((g) => {
      if (!g?.id || byId.has(g.id)) return;
      byId.set(g.id, {
        id: g.id,
        name: g.name || g.id,
        color: groupColors[g.id] || groupColors.default,
      });
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [groupColors]);

  const loadEmployeeGroups = useCallback(async () => {
    try {
      const response = await fetch(routes.getEmpleados, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });

      if (!response.ok) {
        console.warn('Error fetching empleados:', response.status);
        return [];
      }

      const empleadosData = await response.json();
      const empleadosArray = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
      const gruposUnicos = [...new Set(
        empleadosArray
          .map((emp) => String(emp['GRUPO'] || emp.grupo || '').trim())
          .filter(Boolean),
      )].sort((a, b) => a.localeCompare(b, 'es'));

      const fromEmpleados = gruposUnicos.map((grupo) => ({
        id: grupo,
        name: grupo,
        color: groupColors[grupo] || groupColors.default,
      }));

      if (!isMountedRef.current) return fromEmpleados;
      setGroupsFromEmpleados(fromEmpleados);
      // Păstrează rândurile adăugate manual (nu sunt încă în DatosEmpleados)
      setUserGroups((prev) => {
        const empleadoIds = new Set(fromEmpleados.map((g) => g.id));
        const customsKept = prev.filter((g) => !empleadoIds.has(g.id));
        return buildVisibleGroups(fromEmpleados, customsKept);
      });
      return fromEmpleados;
    } catch (empleadosError) {
      console.warn('Error fetching empleados data, continuing with existing groups:', empleadosError);
      return [];
    }
  }, [groupColors, buildVisibleGroups]);

  useEffect(() => {
    getAllPermissionsRef.current = getAllPermissions;
  }, [getAllPermissions]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadPermissions = async () => {
      if (authUser?.isDemo) {
        console.log('🎭 DEMO mode: Using demo permissions');
        setDemoPermissions();
        loadEmployeeGroups().catch((error) =>
          console.warn('Error loading grupos (demo):', error),
        );
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        console.log('[DEBUG] Cargando permisos reales desde backend...');
        const data = await getAllPermissionsRef.current();
        if (!isMountedRef.current) return;

        console.log('[DEBUG] Permisos crudos recibidos (sample):', Array.isArray(data) ? data.slice(0, 5) : data);

        const normalized = normalizePermissions(data);
        console.log('[DEBUG] Permisos normalizados (keys):', Object.keys(normalized));

        if (Object.keys(normalized).length === 0) {
          console.warn('[DEBUG] Permisos vacíos, aplicando fallback demo');
          setDemoPermissions();
        } else {
          setPermissions(normalized);
        }

        // Vizibile doar grupurile din DatosEmpleados (per client) — nu cele orphan din Permissions
        await loadEmployeeGroups();
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error('Error al cargar permisos:', error);
        setDemoPermissions();
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          console.log('[DEBUG] Control de Acceso loading = false');
        }
      }
    };

    loadPermissions();
  }, [authUser?.isDemo, setDemoPermissions, normalizePermissions, loadEmployeeGroups]);

  const togglePermission = (groupId, moduleId) => {
    setPermissions(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [moduleId]: !prev[groupId]?.[moduleId]
      }
    }));
  };

  // Modernizare UI: căutare + toggles de rând/coloană
  const [groupSearch, setGroupSearch] = useState('');
  const [scopeUserCodigo, setScopeUserCodigo] = useState('');
  const [scopeGruposInput, setScopeGruposInput] = useState('');
  const [scopeBusy, setScopeBusy] = useState(false);

  const canManageEmpleadoScope =
    authUser?.GRUPO === 'Developer' ||
    authUser?.GRUPO === 'Admin' ||
    authUser?.grupo === 'Developer' ||
    authUser?.grupo === 'Admin';

  const loadEmpleadoScope = async () => {
    const c = (scopeUserCodigo || '').trim();
    if (!c) {
      alert('Introduce el CODIGO del usuario');
      return;
    }
    setScopeBusy(true);
    try {
      const data = await getEmpleadoGrupoScope(c);
      const list = Array.isArray(data?.grupos) ? data.grupos : [];
      setScopeGruposInput(list.join(', '));
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al cargar ámbito');
    } finally {
      setScopeBusy(false);
    }
  };

  const saveEmpleadoScope = async () => {
    const c = (scopeUserCodigo || '').trim();
    if (!c) {
      alert('Introduce el CODIGO del usuario');
      return;
    }
    const grupos = scopeGruposInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      !confirm(
        `¿Guardar ámbito para ${c}?\n\nGrupos: ${grupos.length ? grupos.join(', ') : '(ninguno — acceso completo a empleados)'}`,
      )
    ) {
      return;
    }
    setScopeBusy(true);
    try {
      await saveEmpleadoGrupoScope(c, grupos);
      alert('Ámbito guardado. El usuario debe volver a iniciar sesión para refrescar la lista.');
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al guardar');
    } finally {
      setScopeBusy(false);
    }
  };

  const filteredGroups = useMemo(() => userGroups.filter(g => (
    (g.name || '').toLowerCase().includes(groupSearch.toLowerCase()) ||
    (g.id || '').toLowerCase().includes(groupSearch.toLowerCase())
  )), [userGroups, groupSearch]);

  const toggleAllForGroup = (groupId) => {
    setPermissions(prev => ({
      ...prev,
      [groupId]: modules.reduce((acc, m) => ({ ...acc, [m.id]: !prev[groupId]?.[m.id] }), {})
    }));
  };

  const toggleAllForModule = (moduleId) => {
    setPermissions(prev => {
      const next = { ...prev };
      filteredGroups.forEach(g => {
        next[g.id] = { ...next[g.id], [moduleId]: !next[g.id]?.[moduleId] };
      });
      return next;
    });
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      await savePermissions(permissions);
      
      // Log salvarea permisiunilor
      await activityLogger.logPermissionsSaved(permissions, authUser);
      
      setShowSaveModal(true);
      setTimeout(() => setShowSaveModal(false), 2000);
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Error al guardar los permisos!');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    const confirmMessage = '⚠️ ATENCIÓN: ¿Estás seguro de que quieres restablecer TODOS los permisos a FALSE para TODOS los grupos?\n\nEsta acción:\n- Pondrá todos los permisos a false en la base de datos\n- Eliminará el acceso para todos\n- No se puede deshacer fácilmente\n\n¿Continuar?';
    if (!confirm(confirmMessage)) {
      return;
    }

    // Setează toate permisiunile la false pentru toate grupurile și modulele
    const resetPermissions = {};
    userGroups.forEach(group => {
      resetPermissions[group.id] = {};
      modules.forEach(module => {
        resetPermissions[group.id][module.id] = false;
      });
    });

    setPermissions(resetPermissions);

    // Salvează automat în backend
    try {
      setSaving(true);
      await savePermissions(resetPermissions);
      
      // Log salvarea permisiunilor
      await activityLogger.logPermissionsSaved(resetPermissions, authUser);
      
      alert('✅ Todos los permisos se han restablecido a FALSE y guardado en la base de datos.\n\nTodos los grupos tienen ahora acceso 0 a todos los módulos.');
    } catch (error) {
      console.error('Error resetting permissions:', error);
      alert('❌ Error al restablecer los permisos: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddGroup = (newGroup) => {
    const groupExists = userGroups.find(g => g.id === newGroup.id);
    if (groupExists) {
      alert('¡El grupo ya existe!');
      return;
    }

    const newGroupObj = {
      id: newGroup.id,
      name: newGroup.name,
      color: groupColors[newGroup.id] || groupColors.default
    };

    setUserGroups((prev) => [...prev, newGroupObj].sort((a, b) => a.name.localeCompare(b.name, 'es')));
    setCustomGroups((prev) => [...prev, newGroupObj]);
    setPermissions((prev) => ({
      ...prev,
      [newGroupObj.id]: modules.reduce(
        (acc, m) => ({ ...acc, [m.id]: prev[newGroupObj.id]?.[m.id] ?? false }),
        {},
      ),
    }));
    setShowAddGroupModal(false);
  };

  const handleRemoveGroup = (groupId) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el grupo "${groupId}"?`)) {
      setUserGroups(prev => prev.filter(g => g.id !== groupId));
      setCustomGroups(prev => prev.filter(g => g.id !== groupId));
      
      // Șterge și permisiunile pentru acest grup
      setPermissions(prev => {
        const newPermissions = { ...prev };
        delete newPermissions[groupId];
        return newPermissions;
      });
    }
  };

  const handleDeleteUnusedGroups = async () => {
    const confirmMessage = `⚠️ ATENCIÓN: ¿Estás seguro de que quieres eliminar TODOS los permisos de los grupos NO USADOS?\n\nLos grupos que SE MANTIENEN son los que existen en la tabla DatosEmpleados (campo GRUPO).\n\nEl resto de grupos en la tabla Permissions tendrán sus permisos eliminados permanentemente.\n\n¿Continuar?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setSaving(true);
      const result = await deleteUnusedGroups();
      
      // Reîncarcă permisiunile pentru a actualiza UI-ul
      const reloadedPermissions = await getAllPermissions();
      if (reloadedPermissions && typeof reloadedPermissions === 'object') {
        // getAllPermissions returnează deja un obiect procesat { grupo: { module: true/false } }
        setPermissions(reloadedPermissions);
      }
      
      const message = result.deleted > 0
        ? `✅ Eliminados ${result.deleted} permisos de ${result.unusedGroups.length} grupos no usados:\n\n${result.unusedGroups.join(', ')}\n\nGrupos mantenidos (en DatosEmpleados):\n${result.usedGroups.join(', ')}`
        : `ℹ️ No se encontraron grupos no usados. Todos los grupos en Permissions existen en DatosEmpleados.\n\nGrupos encontrados en DatosEmpleados:\n${result.usedGroups.join(', ')}`;
      
      alert(message);
    } catch (error) {
      console.error('Error deleting unused groups:', error);
      alert('❌ Error al eliminar los grupos no usados: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Cargando permisos...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header cu acțiuni */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-red-600">Control de Acces</h2>
          <p className="text-gray-600">
            Solo grupos presentes en empleados de este cliente
            {groupsFromEmpleados.length > 0 ? ` (${groupsFromEmpleados.length})` : ''}.
            Usa «Añadir grupo» para uno nuevo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Buscar grupo..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
          />
          <Button
            onClick={() => setShowAddGroupModal(true)}
            variant="outline"
            size="sm"
          >
            ➕ Añadir grupo
          </Button>
          <Button
            onClick={handleResetToDefaults}
            variant="outline"
            size="sm"
          >
            🔄 Reset
          </Button>
          <Button
            onClick={handleDeleteUnusedGroups}
            variant="outline"
            size="sm"
            disabled={saving}
            className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
          >
            🗑️ Eliminar grupos no usados
          </Button>
          <Button
            onClick={handleSavePermissions}
            disabled={saving}
            size="sm"
          >
            {saving ? '💾 Guardando...' : '💾 Guardar'}
          </Button>
        </div>
      </div>

      {/* Matrice: rânduri = module, coloane = grupuri (mai ușor de gestionat) */}
      <Card padding="p-2 sm:p-3">
        <div className="overflow-auto max-h-[min(75vh,900px)] rounded-lg border border-gray-100">
          <table
            className="w-full border-separate border-spacing-0"
            style={{ minWidth: `${260 + Math.max(filteredGroups.length, 1) * 112}px` }}
          >
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr className="border-b border-gray-200">
                <th className="sticky left-0 z-30 bg-white text-left px-3 py-3 font-semibold text-gray-700 min-w-[240px] border-b border-r border-gray-200">
                  Modul / Grupo
                </th>
                {filteredGroups.map((group) => (
                  <th
                    key={group.id}
                    className="text-center px-1.5 py-2 font-semibold text-gray-700 min-w-[108px] max-w-[128px] border-b border-gray-200 bg-white align-bottom"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-3 h-3 rounded-full ${group.color}`} title={group.name} />
                      <span
                        className="text-[11px] leading-tight font-semibold text-gray-800 px-0.5 line-clamp-3"
                        title={group.name}
                      >
                        {group.name}
                      </span>
                      <button
                        type="button"
                        className="text-[10px] text-red-600 hover:underline"
                        onClick={() => toggleAllForGroup(group.id)}
                        title={`Alternar todos los módulos para ${group.name}`}
                      >
                        Toggle col
                      </button>
                      {customGroups.find((g) => g.id === group.id) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(group.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                          title="Eliminar grupo"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="text-center px-2 py-3 font-semibold text-gray-700 min-w-[100px] border-b border-gray-200 bg-white sticky right-0 z-20">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.id} className="border-b border-gray-100 hover:bg-gray-50/80 group/row">
                  <td className="sticky left-0 z-10 bg-white group-hover/row:bg-gray-50 px-3 py-2.5 border-r border-b border-gray-100 min-w-[240px]">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-base leading-none shrink-0 mt-0.5" aria-hidden>
                        {module.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-gray-900 leading-tight">
                          {module.name}
                        </div>
                        {module.description ? (
                          <div className="text-[11px] text-gray-500 leading-snug mt-0.5 line-clamp-2" title={module.description}>
                            {module.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {filteredGroups.map((group) => {
                    const hasPermission = permissions[group.id]?.[module.id] ?? false;
                    return (
                      <td key={group.id} className="text-center px-1.5 py-2 border-b border-gray-100">
                        <button
                          type="button"
                          onClick={() => togglePermission(group.id, module.id)}
                          aria-label={`${module.name} — ${group.name}`}
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-md border-2 text-sm font-bold transition-colors ${
                            hasPermission
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'bg-white border-gray-300 hover:border-red-400 text-transparent'
                          }`}
                        >
                          {hasPermission ? '✓' : '·'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-2 border-b border-gray-100 bg-white sticky right-0 z-10">
                    <button
                      type="button"
                      onClick={() => toggleAllForModule(module.id)}
                      className="text-red-600 hover:text-red-800 text-xs underline whitespace-nowrap"
                      title={`Alternar este módulo para todos los grupos`}
                    >
                      Toggle row
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canManageEmpleadoScope && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Ámbito de empleados por GRUPO
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Limita qué filas de <strong>DatosEmpleados.GRUPO</strong> puede ver y editar un usuario con
            permiso Empleados. Debe coincidir exactamente el texto del grupo (ej. Socorrista). Vacío =
            sin restricción (comportamiento anterior). Admin/Developer no se limitan.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                CODIGO usuario
              </label>
              <input
                type="text"
                className="px-3 py-2 border border-gray-300 rounded-lg w-48"
                value={scopeUserCodigo}
                onChange={(e) => setScopeUserCodigo(e.target.value)}
                placeholder="ej. 12345"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Grupos (separados por coma)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={scopeGruposInput}
                onChange={(e) => setScopeGruposInput(e.target.value)}
                placeholder="Socorrista"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={scopeBusy}
              onClick={loadEmpleadoScope}
            >
              Cargar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={scopeBusy}
              onClick={saveEmpleadoScope}
            >
              {scopeBusy ? '…' : 'Guardar ámbito'}
            </Button>
          </div>
        </Card>
      )}

      {/* Modal pentru adăugare grup */}
      {showAddGroupModal && (
        <AddGroupModal
          isOpen={showAddGroupModal}
          onClose={() => setShowAddGroupModal(false)}
          onAdd={handleAddGroup}
          existingGroups={userGroups}
        />
      )}

      {/* Modal de confirmare salvare */}
      {showSaveModal && (
        <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)}>
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Permisiuni salvate cu succes!
            </h3>
            <p className="text-gray-600">
              Toate modificările au fost salvate în sistem.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Component pentru adăugarea de grupuri noi
function AddGroupModal({ isOpen, onClose, onAdd, existingGroups }) {
  const [formData, setFormData] = useState({
    id: '',
    name: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.id.trim() || !formData.name.trim()) {
      alert('Por favor, completa todos los campos obligatorios');
      return;
    }
    
    if (existingGroups.find(g => g.id === formData.id)) {
      alert('Ya existe un grupo con este ID');
      return;
    }
    
    onAdd(formData);
    setFormData({ id: '', name: '' });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Adaugă Grup Nou
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID Grup *
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => handleChange('id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="ex: Limpieza"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nume Grup *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="ex: Limpieza"
              required
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Adaugă Grup
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
} 