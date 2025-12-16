import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, Button, Modal } from '../../components/ui';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useAuth } from '../../contexts/AuthContextBase';
import activityLogger from '../../utils/activityLogger';
import { routes } from '../../utils/routes';

export default function AccessMatrix() {
  const { getAllPermissions, savePermissions } = useAdminApi();
  const { user: authUser } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [customGroups, setCustomGroups] = useState([]);
  const isMountedRef = useRef(true);

  // Grupurile de utilizatori – exact ca în modalul de editare (de la zero)
  const [userGroups, setUserGroups] = useState([
    { id: 'Administrativ', name: 'Administrativ', color: 'bg-gray-500' },
    { id: 'Auxiliar De Servicios - C', name: 'Auxiliar De Servicios - C', color: 'bg-yellow-500' },
    { id: 'Auxiliar De Servicios - L', name: 'Auxiliar De Servicios - L', color: 'bg-yellow-400' },
    { id: 'Comercial', name: 'Comercial', color: 'bg-orange-500' },
    { id: 'Developer', name: 'Developer', color: 'bg-indigo-500' },
    { id: 'Especialista', name: 'Especialista', color: 'bg-teal-500' },
    { id: 'Informatico', name: 'Informatico', color: 'bg-blue-500' },
    { id: 'Limpiador', name: 'Limpiador', color: 'bg-green-500' },
    { id: 'Socorrista', name: 'Socorrista', color: 'bg-cyan-500' },
    { id: 'Supervisor', name: 'Supervisor', color: 'bg-purple-500' }
  ]);

  // Modulele aplicației – sincronizate cu cheile reale din backend
  const modules = useMemo(() => ([
    { id: 'dashboard', name: 'Panel Principal', icon: '🏠', description: 'Vista general e inicio' },
    { id: 'datos', name: 'Datos Personales', icon: '🆔', description: 'Información del empleado' },
    { id: 'tareas', name: 'Tareas Diarias', icon: '📋', description: 'Gestión de tareas por día' },
    { id: 'empleados', name: 'Empleados', icon: '👥', description: 'Gestión de empleados' },
    { id: 'fichar', name: 'Fichar', icon: '⏰', description: 'Registro de jornada' },
    { id: 'solicitudes', name: 'Solicitudes', icon: '📝', description: 'Asuntos y vacaciones' },
    { id: 'documentos', name: 'Documentos', icon: '📄', description: 'Documentos y nóminas' },
    { id: 'documentos-empleados', name: 'Documentos Empleados', icon: '📂', description: 'Archivos por empleado' },
    { id: 'cuadrantes', name: 'Cuadrantes', icon: '📅', description: 'Gestión de horarios' },
    { id: 'cuadrantes-empleado', name: 'Mi Horario', icon: '📅', description: 'Cuadrante personal' },
    { id: 'mis-inspecciones', name: 'Mis Inspecciones', icon: '👷‍♂️', description: 'Inspecciones asignadas' },
    { id: 'inspecciones', name: 'Inspecciones', icon: '🔍', description: 'Inspecciones digitales' },
    { id: 'aprobaciones', name: 'Aprobaciones', icon: '✅', description: 'Aprobaciones de fichajes' },
    { id: 'estadisticas', name: 'Estadísticas', icon: '📊', description: 'Informes y analítica' },
    { id: 'clientes', name: 'Clientes', icon: '👥', description: 'Gestión de clientes' },
    { id: 'pedidos', name: 'Pedidos', icon: '🛒', description: 'Gestión de pedidos y compras' },
    { id: 'admin', name: 'Admin Panel', icon: '⚙️', description: 'Panel de administración' }
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
        tareas: true,
        empleados: true,
        fichar: true,
        solicitudes: true,
        documentos: true,
        'documentos-empleados': true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        'mis-inspecciones': true,
        inspecciones: true,
        aprobaciones: true,
        estadisticas: true,
        clientes: true,
        pedidos: true,
        admin: false
      },
      Manager: {
        dashboard: true,
        datos: true,
        tareas: true,
        empleados: true,
        fichar: true,
        solicitudes: true,
        documentos: true,
        'documentos-empleados': true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        'mis-inspecciones': true,
        inspecciones: true,
        aprobaciones: false,
        estadisticas: true,
        clientes: true,
        pedidos: true,
        admin: false
      },
      Empleado: {
        dashboard: true,
        datos: true,
        tareas: false,
        empleados: false,
        fichar: true,
        solicitudes: true,
        documentos: true,
        'documentos-empleados': false,
        cuadrantes: false,
        'cuadrantes-empleado': true,
        'mis-inspecciones': false,
        inspecciones: false,
        aprobaciones: false,
        estadisticas: false,
        clientes: false,
        pedidos: false,
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

    return normalized;
  }, []);

  const mergeDynamicGroups = useCallback((incomingGroups) => {
    if (!isMountedRef.current) return;
    if (!incomingGroups?.length) return;

    setUserGroups(prev => {
      const existingIds = new Set(prev.map(g => g.id));
      const merged = [...prev];
      let changed = false;

      incomingGroups.forEach(grupo => {
        if (!grupo?.id) return;
        if (existingIds.has(grupo.id)) return;

        merged.push({
          id: grupo.id,
          name: grupo.name || grupo.id,
          color: groupColors[grupo.id] || groupColors.default
        });
        existingIds.add(grupo.id);
        changed = true;
      });

      return changed ? merged : prev;
    });
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
        return;
      }

      const empleadosData = await response.json();
      const empleadosArray = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
      const gruposUnicos = [...new Set(empleadosArray.map(emp => emp['GRUPO'] || emp.grupo).filter(Boolean))];

      const gruposFromEmpleados = gruposUnicos.map(grupo => ({
        id: grupo,
        name: grupo,
        color: groupColors[grupo] || groupColors.default
      }));

      mergeDynamicGroups(gruposFromEmpleados);
    } catch (empleadosError) {
      console.warn('Error fetching empleados data, continuing with existing groups:', empleadosError);
    }
  }, [groupColors, mergeDynamicGroups]);

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
          mergeDynamicGroups(
            Object.keys(normalized).map(groupId => ({
              id: groupId,
              name: groupId
            }))
          );
        }

        loadEmployeeGroups().catch((error) =>
          console.warn('Error loading grupos adicionales:', error),
        );
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
  }, [authUser?.isDemo, setDemoPermissions, normalizePermissions, mergeDynamicGroups, loadEmployeeGroups]);

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
      alert('Eroare la salvarea permisiunilor!');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('Ești sigur că vrei să resetezi toate permisiunile la valorile implicite?')) {
      setPermissions({});
    }
  };

  const handleAddGroup = (newGroup) => {
    const groupExists = userGroups.find(g => g.id === newGroup.id);
    if (groupExists) {
      alert('Grupul există deja!');
      return;
    }
    
    const newGroupObj = {
      id: newGroup.id,
      name: newGroup.name,
      color: groupColors[newGroup.id] || groupColors.default
    };
    
    setUserGroups(prev => [...prev, newGroupObj]);
    setCustomGroups(prev => [...prev, newGroupObj]);
    setShowAddGroupModal(false);
  };

  const handleRemoveGroup = (groupId) => {
    if (confirm(`Ești sigur că vrei să ștergi grupul "${groupId}"?`)) {
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
          <p className="text-gray-600">Gestionează permisiunile pentru diferitele grupuri de utilizatori</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Caută grup..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
          />
          <Button
            onClick={() => setShowAddGroupModal(true)}
            variant="outline"
            size="sm"
          >
            ➕ Adaugă Grup
          </Button>
          <Button
            onClick={handleResetToDefaults}
            variant="outline"
            size="sm"
          >
            🔄 Reset
          </Button>
          <Button
            onClick={handleSavePermissions}
            disabled={saving}
            size="sm"
          >
            {saving ? '💾 Salvando...' : '💾 Salvează'}
          </Button>
        </div>
      </div>

      {/* Tabelul de permisiuni */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-4 font-semibold text-gray-700">Grup / Modul</th>
                {modules.map(module => (
                  <th key={module.id} className="text-center p-4 font-semibold text-gray-700">
                    <div className="flex flex-col items-center">
                      <span className="text-lg">{module.icon}</span>
                      <span className="text-xs">{module.name}</span>
                      <button
                        className="mt-1 text-xs text-red-600 hover:underline"
                        onClick={() => toggleAllForModule(module.id)}
                        title="Comută toate pentru coloană"
                      >
                        Toggle col
                      </button>
                    </div>
                  </th>
                ))}
                <th className="text-center p-4 font-semibold text-gray-700">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map(group => (
                <tr key={group.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${group.color}`}></div>
                      <div>
                        <div className="font-semibold text-gray-900">{group.name}</div>
                        <div className="text-sm text-gray-500">{group.id}</div>
                      </div>
                    </div>
                  </td>
                  {modules.map(module => (
                    <td key={module.id} className="text-center p-4">
                      <button
                        onClick={() => togglePermission(group.id, module.id)}
                        className={`w-6 h-6 rounded border-2 transition-colors ${
                          permissions[group.id]?.[module.id]
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-gray-300 hover:border-red-300'
                        }`}
                      >
                        {permissions[group.id]?.[module.id] ? '✓' : ''}
                      </button>
                    </td>
                  ))}
                  <td className="text-center p-4">
                    <button
                      onClick={() => toggleAllForGroup(group.id)}
                      className="text-red-600 hover:text-red-800 mr-2 text-xs underline"
                      title="Comută toate modulele pentru grup"
                    >
                      Toggle row
                    </button>
                    {customGroups.find(g => g.id === group.id) && (
                      <button
                        onClick={() => handleRemoveGroup(group.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Șterge grupul"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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