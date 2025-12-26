import { useState, useMemo, useEffect } from 'react';
import { useGastos } from '../contexts/GastosContext';

const GastoLista = ({ onView, onDelete }) => {
  const { gastos, loading, deleteGasto, processGasto, downloadGasto, fetchGastosFromServer, toastMessage } = useGastos();

  // Încarcă din backend la montare
  useEffect(() => {
    // Rulează o singură dată la montare
    fetchGastosFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });

  const [sortBy, setSortBy] = useState('uploadDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filtrează și sortează gastos
  const filteredAndSortedGastos = useMemo(() => {
    let filtered = gastos;

    // Filtrare după status
    if (filters.status) {
      filtered = filtered.filter(g => g.status === filters.status);
    }

    // Filtrare după căutare
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(g => 
        g.fileName?.toLowerCase().includes(searchLower) ||
        g.processedData?.proveedor?.toLowerCase().includes(searchLower)
      );
    }

    // Sortare
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'fileName':
          aValue = a.fileName || '';
          bValue = b.fileName || '';
          break;
        case 'fileSize':
          aValue = a.fileSize || 0;
          bValue = b.fileSize || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          aValue = new Date(a.uploadDate);
          bValue = new Date(b.uploadDate);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [gastos, filters, sortBy, sortOrder]);

  // Funcție pentru a formata data
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  };

  // Funcție pentru a formata dimensiunea fișierului
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Funcție pentru a obține statusul în spaniolă
  const getStatusText = (status) => {
    const statusMap = {
      'cargado': 'Cargado',
      'pendiente': 'Pendiente',
      'procesado': 'Procesado'
    };
    return statusMap[status] || status;
  };

  // Funcție pentru a obține culoarea statusului
  const getStatusColor = (status) => {
    const colorMap = {
      'cargado': 'bg-blue-100 text-blue-800',
      'pendiente': 'bg-amber-100 text-amber-800',
      'procesado': 'bg-green-100 text-green-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Gestionează ștergerea unui gasto
  const handleDelete = async (gasto) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${gasto.fileName}"?`)) {
      const result = await deleteGasto(gasto.id);
      if (!result.success) {
        alert(result.error || 'Error al eliminar el gasto');
      }
    }
  };

  // Gestionează procesarea unui gasto
  const handleProcess = async (gasto) => {
    const result = await processGasto(gasto.id);
    if (!result.success) {
      alert(result.error || 'Error al procesar el gasto');
    }
  };

  // Gestionează descărcarea unui gasto
  const handleDownload = async (gasto) => {
    const result = await downloadGasto(gasto);
    if (!result.success) {
      alert(result.error || 'Error al descargar el archivo');
    }
  };

  // Gestionează sortarea
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Gestionează modificările în filtre
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Resetează filtrele
  const resetFilters = () => {
    setFilters({
      status: '',
      search: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header cu statistici */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <button
              onClick={() => window.history.back()}
              className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Regresar"
            >
              <span className="text-gray-600 text-lg">←</span>
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Lista de Gastos</h2>
              <div className="text-sm text-gray-600">
                {filteredAndSortedGastos.length} de {gastos.length} gastos
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchGastosFromServer()}
              disabled={loading}
              className={`px-3 py-2 rounded-md transition-colors flex items-center ${
                loading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              title="Reîmprospătează lista"
            >
              {loading ? (
                <span className="inline-flex items-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></span>
                  Actualizăm...
                </span>
              ) : (
                <span className="inline-flex items-center">↻ Reîmprospătează</span>
              )}
            </button>
          </div>
        </div>

        {/* Filtre */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Nombre de archivo o proveedor..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Todos</option>
              <option value="cargado">Cargado</option>
              <option value="pendiente">Pendiente</option>
              <option value="procesado">Procesado</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Tabel cu gastos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {toastMessage && (
          <div className="m-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            ✅ {toastMessage}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('fileName')}
                >
                  <div className="flex items-center">
                    Archivo
                    {sortBy === 'fileName' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('uploadDate')}
                >
                  <div className="flex items-center">
                    Fecha Carga
                    {sortBy === 'uploadDate' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('fileSize')}
                >
                  <div className="flex items-center">
                    Tamaño
                    {sortBy === 'fileSize' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Estado
                    {sortBy === 'status' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Datos Procesados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    Cargando gastos...
                  </td>
                </tr>
              ) : filteredAndSortedGastos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No se encontraron gastos
                  </td>
                </tr>
              ) : (
                filteredAndSortedGastos.map((gasto) => (
                  <tr key={gasto.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {gasto.fileName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(gasto.uploadDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatFileSize(gasto.fileSize)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(gasto.status)}`}>
                        {getStatusText(gasto.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {gasto.processedData ? (
                        <div className="text-sm text-gray-900">
                          <div>Total: €{gasto.processedData.total?.toFixed(2)}</div>
                          <div>NIF: {gasto.processedData.nif}</div>
                          <div>Fecha: {gasto.processedData.fecha}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin procesar</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onView && onView(gasto)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver gasto"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleDownload(gasto)}
                          className="text-green-600 hover:text-green-900"
                          title="Descargar PDF"
                        >
                          📄
                        </button>
                        {gasto.status !== 'procesado' && (
                          <button
                            onClick={() => handleProcess(gasto)}
                            className="text-amber-600 hover:text-amber-900"
                            title="Procesar gasto"
                          >
                            ⚙️
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => handleDelete(gasto)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar gasto"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GastoLista; 