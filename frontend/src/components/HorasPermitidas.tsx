import React, { useEffect, useRef, useState } from "react";
import { routes } from '../utils/routes';

// Interfaces pentru componente UI
interface TitleProps {
  level?: 4 | 5 | 6;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

interface TextProps {
  children: React.ReactNode;
  type?: 'primary' | 'secondary';
  style?: React.CSSProperties;
  className?: string;
}

// Simple UI components (replacing Ant Design Typography)
const Title = ({ level, children, style, className, ...props }: TitleProps) => {
  const Tag = level === 4 ? 'h4' : level === 5 ? 'h5' : 'h6';
  return <Tag style={style} className={className} {...props}>{children}</Tag>;
};

const Text = ({ children, type, style, className, ...props }: TextProps) => {
  const textClassName = type === 'secondary' ? 'text-gray-500' : '';
  const combinedClassName = className ? `${textClassName} ${className}` : textClassName;
  return <span className={combinedClassName} style={style} {...props}>{children}</span>;
};

export type HorasPermitidasItem = {
  id?: number;
  grupo: string;
  horasAnuales: number;
  horasMensuales: number;
};

// Fetch real data from new backend endpoint
async function fetchHorasPermitidas(): Promise<HorasPermitidasItem[]> {
  try {
    console.log('✅ [HorasPermitidas] Folosind backend-ul nou (getHorasPermitidas)');
    
    const endpoint = routes.getHorasPermitidas || (import.meta.env.DEV 
      ? 'http://localhost:3000/api/horas-permitidas'
      : 'https://api.decaminoservicios.com/api/horas-permitidas');
    
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: headers,
    });

    console.log('🔍 Response status:', response.status);
    console.log('🔍 Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('🔍 HorasPermitidas data received:', data);
      console.log('🔍 Data type:', typeof data);
      console.log('🔍 Data keys:', Object.keys(data || {}));
      
      // Parse the actual data structure from your endpoint
      if (Array.isArray(data)) {
        console.log('✅ Data is array, parsing format...');
        return data.map(item => ({
          id: item.id,
          grupo: item.GRUPO,
          horasAnuales: parseFloat(item['Horas Anuales']),
          horasMensuales: parseFloat(item['Horas Mensuales'])
        }));
      } else if (data.grupos && Array.isArray(data.grupos)) {
        console.log('✅ Data has grupos array');
        return data.grupos.map(item => ({
          id: item.id,
          grupo: item.GRUPO,
          horasAnuales: parseFloat(item['Horas Anuales']),
          horasMensuales: parseFloat(item['Horas Mensuales'])
        }));
      } else if (data.data && Array.isArray(data.data)) {
        console.log('✅ Data has data array');
        return data.data.map(item => ({
          id: item.id,
          grupo: item.GRUPO,
          horasAnuales: parseFloat(item['Horas Anuales']),
          horasMensuales: parseFloat(item['Horas Mensuales'])
        }));
      } else {
        console.log('⚠️ Unknown data structure, using fallback');
        return [];
      }
    } else {
      console.error('❌ Response not ok:', response.status, response.statusText);
      throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Error fetching horas permitidas:', error);
    console.log('🔄 No data available from endpoint');
    // Return empty array when endpoint fails - no mock data
    return [];
  }
}

type NotificationType = {
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  description?: string;
};

interface HorasPermitidasProps {
  setNotification: (notification: NotificationType) => void;
}

const HorasPermitidas: React.FC<HorasPermitidasProps> = ({ setNotification }) => {
  const [data, setData] = useState<HorasPermitidasItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<HorasPermitidasItem | null>(null);
  const [newItem, setNewItem] = useState({
    grupo: '',
    horasAnuales: 0,
    horasMensuales: 0
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  useEffect(() => {
    fetchHorasPermitidas().then(setData);
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (tableScrollRef.current) {
        setTableScrollWidth(tableScrollRef.current.scrollWidth);
      }
    };

    // Actualizează după randare pentru a captura lățimea reală a tabelului
    requestAnimationFrame(updateWidth);
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, [data]);

  useEffect(() => {
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;

    if (!topEl || !tableEl) {
      return;
    }

    let isSyncingFromTop = false;
    let isSyncingFromTable = false;

    const handleTopScroll = () => {
      if (!tableScrollRef.current) {
        return;
      }
      if (isSyncingFromTable) {
        isSyncingFromTable = false;
        return;
      }
      isSyncingFromTop = true;
      tableScrollRef.current.scrollLeft = topEl.scrollLeft;
    };

    const handleTableScroll = () => {
      if (!topScrollRef.current) {
        return;
      }
      if (isSyncingFromTop) {
        isSyncingFromTop = false;
        return;
      }
      isSyncingFromTable = true;
      topScrollRef.current.scrollLeft = tableEl.scrollLeft;
    };

    topEl.addEventListener('scroll', handleTopScroll);
    tableEl.addEventListener('scroll', handleTableScroll);

    return () => {
      topEl.removeEventListener('scroll', handleTopScroll);
      tableEl.removeEventListener('scroll', handleTableScroll);
    };
  }, [data.length]);

  const topScrollContentWidth = tableScrollWidth > 0 ? `${tableScrollWidth}px` : '100%';

  const handleAddNew = () => {
    setNewItem({ grupo: '', horasAnuales: 0, horasMensuales: 0 });
    setShowAddModal(true);
  };

  const handleEdit = (item: HorasPermitidasItem) => {
    setEditingItem(item);
  };

  const handleSaveNew = async () => {
    if (newItem.grupo.trim()) {
      try {
        // Folosim backend-ul nou
        const endpoint = routes.getHorasPermitidas || (import.meta.env.DEV 
          ? 'http://localhost:3000/api/horas-permitidas'
          : 'https://api.decaminoservicios.com/api/horas-permitidas');
        
        console.log('✅ [HorasPermitidas] Folosind backend-ul nou (createHorasPermitidas):', endpoint);
        
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            grupo: newItem.grupo.trim(),
            horasAnuales: newItem.horasAnuales,
            horasMensuales: newItem.horasMensuales,
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('🔍 Add response:', result);
          
          if (result.status === 'success') {
            // Adaugă grupul cu datele din backend
            setData(prev => [...prev, {
              id: result.data.id || parseInt(String(result.data.id)),
              grupo: result.data.grupo,
              horasAnuales: result.data.horasAnuales || parseFloat(String(result.data.horasAnuales)),
              horasMensuales: result.data.horasMensuales || parseFloat(String(result.data.horasMensuales))
            }]);
            
            setNotification({
              type: 'success',
              message: 'Grupo Agregado',
              description: result.message || `El grupo "${result.data.grupo}" ha sido agregado correctamente.`
            });
            
            // Log horas permitidas created
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && (user['NOMBRE / APELLIDOS'] || user.nombre)) {
              const activityLogger = (await import('../utils/activityLogger')).default;
              activityLogger.logHorasPermitidasCreated(
                {
                  grupo: result.data.grupo,
                  horasAnuales: result.data.horasAnuales,
                  horasMensuales: result.data.horasMensuales
                },
                user
              );
            }
            
            setShowAddModal(false);
            setNewItem({ grupo: '', horasAnuales: 0, horasMensuales: 0 });
          } else {
            throw new Error(result.message || 'Error en la respuesta del servidor');
          }
        } else {
          throw new Error('Error en la respuesta del servidor');
        }
      } catch (error) {
        console.error('Error adding grupo:', error);
        setNotification({
          type: 'error',
          message: 'Error al Agregar',
          description: 'No se pudo agregar el grupo. Por favor, inténtalo de nuevo.'
        });
      }
    }
  };

  const handleSaveEdit = async () => {
    if (editingItem && editingItem.id) {
      try {
        // Folosim backend-ul nou
        const baseEndpoint = routes.getHorasPermitidas || (import.meta.env.DEV 
          ? 'http://localhost:3000/api/horas-permitidas'
          : 'https://api.decaminoservicios.com/api/horas-permitidas');
        const endpoint = `${baseEndpoint}/${editingItem.id}`;
        
        console.log('✅ [HorasPermitidas] Folosind backend-ul nou (updateHorasPermitidas):', endpoint);
        
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify({
            grupo: editingItem.grupo,
            horasAnuales: editingItem.horasAnuales,
            horasMensuales: editingItem.horasMensuales,
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('🔍 Edit response:', result);
          
          if (result.status === 'success') {
            // Actualizează datele locale cu datele din backend
            setData(prev => prev.map(item => 
              item.id === editingItem.id ? {
                id: parseInt(result.data.id),
                grupo: result.data.grupo,
                horasAnuales: parseFloat(result.data.horasAnuales),
                horasMensuales: parseFloat(result.data.horasMensuales)
              } : item
            ));
            
            setNotification({
              type: 'success',
              message: 'Grupo Actualizado',
              description: result.message || `El grupo "${result.data.grupo}" ha sido actualizado correctamente.`
            });
            
            setEditingItem(null);
          } else {
            throw new Error(result.message || 'Error en la respuesta del servidor');
          }
        } else {
          throw new Error('Error en la respuesta del servidor');
        }
      } catch (error) {
        console.error('Error updating grupo:', error);
        setNotification({
          type: 'error',
          message: 'Error al Actualizar',
          description: 'No se pudo actualizar el grupo. Por favor, inténtalo de nuevo.'
        });
      }
    }
  };

  const handleDelete = (grupo: string) => {
    setItemToDelete(grupo);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        const itemToDeleteObj = data.find(item => item.grupo === itemToDelete);
        if (!itemToDeleteObj || !itemToDeleteObj.id) {
          throw new Error('Item not found or missing ID');
        }
        
        // Folosim backend-ul nou
        const baseEndpoint = routes.getHorasPermitidas || (import.meta.env.DEV 
          ? 'http://localhost:3000/api/horas-permitidas'
          : 'https://api.decaminoservicios.com/api/horas-permitidas');
        const endpoint = `${baseEndpoint}/${itemToDeleteObj.id}`;
        
        console.log('✅ [HorasPermitidas] Folosind backend-ul nou (deleteHorasPermitidas):', endpoint);
        
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers: headers,
        });

        if (response.ok) {
          const result = await response.json();
          console.log('🔍 Delete response:', result);
          
          if (result.status === 'success') {
            // Elimină grupul doar dacă API call-ul a reușit
            setData(prev => prev.filter(item => item.id !== parseInt(result.data.id)));
            
            setNotification({
              type: 'success',
              message: 'Grupo Eliminado',
              description: result.message || `El grupo "${result.data.grupo}" ha sido eliminado correctamente.`
            });
            
            setShowDeleteModal(false);
            setItemToDelete(null);
          } else {
            throw new Error(result.message || 'Error en la respuesta del servidor');
          }
        } else {
          throw new Error('Error en la respuesta del servidor');
        }
      } catch (error) {
        console.error('Error deleting grupo:', error);
        setNotification({
          type: 'error',
          message: 'Error al Eliminar',
          description: 'No se pudo eliminar el grupo. Por favor, inténtalo de nuevo.'
        });
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  return (
    <div
      style={{
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
        padding: 24,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb'
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <Title
              level={4}
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: "1.1rem",
                lineHeight: 1.2,
              }}
            >
              Horas Permitidas
            </Title>
            <Text style={{ color: "#777", fontSize: "0.9rem" }}>
              Límites máximos de jornada por grupo (mensual y anual).
            </Text>
          </div>
          <button
            onClick={handleAddNew}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <span>➕</span>
            Añadir Grupo Nuevo
          </button>
        </div>
      </div>
      <div
        ref={topScrollRef}
        className="overflow-x-auto mb-3"
        style={{
          height: 24,
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)'
        }}
        aria-hidden="true"
      >
        <div style={{ width: topScrollContentWidth, height: 1 }} />
      </div>

      <div ref={tableScrollRef} className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Horas anuales permitidas</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Horas mensuales permitidas</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item) => (
              <tr key={item.grupo} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{item.grupo}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <span className="font-semibold text-lg text-blue-600">{item.horasAnuales}h</span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <span className="font-semibold text-lg text-green-600">{item.horasMensuales}h</span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(item.grupo)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
{data.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos disponibles</h3>
            <p className="text-gray-500 mb-4">
              No se pudieron cargar las horas permitidas desde el servidor.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              🔄 Reintentar
            </button>
          </div>
        )}
      </div>

      {/* Modal para añadir nuevo grupo */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Añadir Nuevo Grupo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Grupo</label>
                <input
                  type="text"
                  value={newItem.grupo}
                  onChange={(e) => setNewItem({...newItem, grupo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Supervisor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas Anuales</label>
                <input
                  type="number"
                  value={newItem.horasAnuales}
                  onChange={(e) => setNewItem({...newItem, horasAnuales: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas Mensuales</label>
                <input
                  type="number"
                  step="0.1"
                  value={newItem.horasMensuales}
                  onChange={(e) => setNewItem({...newItem, horasMensuales: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNew}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar grupo */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Editar Grupo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Grupo</label>
                <input
                  type="text"
                  value={editingItem.grupo}
                  onChange={(e) => setEditingItem({...editingItem, grupo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas Anuales</label>
                <input
                  type="number"
                  value={editingItem.horasAnuales}
                  onChange={(e) => setEditingItem({...editingItem, horasAnuales: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas Mensuales</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingItem.horasMensuales}
                  onChange={(e) => setEditingItem({...editingItem, horasMensuales: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmare pentru eliminare */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-w-md mx-4 shadow-2xl border border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmar Eliminación</h3>
                <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                ¿Estás seguro de que quieres eliminar el grupo <strong>"{itemToDelete}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 font-medium">
                  ⚠️ ADVERTENCIA: Esta acción eliminará permanentemente todos los datos asociados a este grupo.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 font-medium flex items-center gap-2"
              >
                <span>🗑️</span>
                Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HorasPermitidas;
