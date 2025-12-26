import { useState, useMemo } from 'react';
import { useFacturas } from '../contexts/FacturasContext';
import { downloadFacturaPDF } from '../utils/pdfGenerator.jsx';
import { downloadFacturaeXML } from '../utils/facturae.ts';
import { isEInvoiceXMLEnabled } from '../../../config/env';

const FacturaLista = ({ onEdit, onView, onDelete }) => {
  const { facturas, loading, deleteFactura, updateFacturaStatus } = useFacturas();
  
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  });

  const [sortBy, setSortBy] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('desc');
  const [openMenuId, setOpenMenuId] = useState(null);

  // Filtrează și sortează facturile
  const filteredAndSortedFacturas = useMemo(() => {
    let filtered = facturas;

    // Filtrare după status
    if (filters.status) {
      filtered = filtered.filter(f => f.status === filters.status);
    }

    // Filtrare după căutare
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(f => 
        f.numero?.toLowerCase().includes(searchLower) ||
        f.cliente?.toLowerCase().includes(searchLower)
      );
    }

    // Filtrare după dată
    if (filters.dateFrom) {
      filtered = filtered.filter(f => new Date(f.fecha) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(f => new Date(f.fecha) <= new Date(filters.dateTo));
    }

    // Sortare
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'numero':
          aValue = a.numero || '';
          bValue = b.numero || '';
          break;
        case 'cliente':
          aValue = a.cliente || '';
          bValue = b.cliente || '';
          break;
        case 'total':
          aValue = a.total || 0;
          bValue = b.total || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          aValue = new Date(a.fecha);
          bValue = new Date(b.fecha);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [facturas, filters, sortBy, sortOrder]);

  // Funcție pentru a formata data
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  };

  // Funcție pentru a formata suma
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  // Funcție pentru a obține statusul în spaniolă
  const getStatusText = (status) => {
    const statusMap = {
      'borrador': 'Borrador',
      'enviado': 'Enviado',
      'efactura-pendiente': 'eFactura Pendiente',
      'pagado': 'Pagado'
    };
    return statusMap[status] || status;
  };

  // Funcție pentru a obține culoarea statusului
  const getStatusColor = (status) => {
    const colorMap = {
      'borrador': 'bg-gray-100 text-gray-800',
      'enviado': 'bg-blue-100 text-blue-800',
      'efactura-pendiente': 'bg-amber-100 text-amber-800',
      'pagado': 'bg-green-100 text-green-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Gestiona la eliminación de una factura
  const handleDelete = async (factura) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la factura ${factura.numero}?`)) {
      const result = await deleteFactura(factura.id);
      if (!result.success) {
        alert(result.error || 'Error al eliminar la factura');
      }
    }
  };



  // Gestionează descărcarea PDF-ului
  const handleDownloadPDF = async (factura) => {
    const result = await downloadFacturaPDF(factura);
    if (!result.success) {
      alert(result.error || 'Error al descargar el PDF');
    }
  };

  const handleDownloadXML = async (factura) => {
    if (!isEInvoiceXMLEnabled()) {
      alert('e-Factura (XML) no está habilitada');
      return;
    }
    const result = await downloadFacturaeXML(factura);
    if (!result.success) {
      alert('Error al descargar el XML');
    }
  };

  const handleMarkPaid = async (factura, paid) => {
    const newStatus = paid ? 'pagado' : 'pendiente';
    await updateFacturaStatus(factura.id, newStatus);
  };

  const handleAttachFiles = async (factura) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '*/*';
      input.onchange = async () => {
        const files = Array.from(input.files || []);
        if (files.length === 0) return;
        const form = new FormData();
        form.append('action', 'attach');
        form.append('id', factura.id || '');
        files.forEach((f) => form.append('files', f, f.name));
        try {
          // Folosește același endpoint de salvare până avem unul dedicat
          const resp = await fetch(import.meta.env.VITE_API_ATTACH_ENDPOINT || '', {
            method: 'POST',
            body: form,
          });
          console.log('Attach response:', resp.status);
        } catch (e) {
          console.warn('Adjuntar archivos: endpoint no configurado');
        }
      };
      input.click();
    } catch (e) {
      alert('No se pudo adjuntar archivos');
    }
  };

  const handleToggleCobro = async (factura) => {
    const isPaid = factura.status === 'pagado';
    await handleMarkPaid(factura, !isPaid);
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

  // Gestiona las modificaciones en filtros
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
      search: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header cu statistici */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Lista de Facturas</h2>
          <div className="text-sm text-gray-600">
            {filteredAndSortedFacturas.length} de {facturas.length} facturas
          </div>
        </div>

        {/* Filtre */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Número o cliente..."
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
              <option value="borrador">Borrador</option>
              <option value="enviado">Enviado</option>
              <option value="efactura-pendiente">eFactura Pendiente</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
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

      {/* Tabel cu facturi */}
      <div className="bg-white rounded-lg shadow-md overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('numero')}
                >
                  <div className="flex items-center">
                    Número
                    {sortBy === 'numero' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('cliente')}
                >
                  <div className="flex items-center">
                    Cliente
                    {sortBy === 'cliente' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('fecha')}
                >
                  <div className="flex items-center">
                    Fecha
                    {sortBy === 'fecha' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center">
                    Total
                    {sortBy === 'total' && (
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
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    Cargando facturas...
                  </td>
                </tr>
              ) : filteredAndSortedFacturas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No se encontraron facturas
                  </td>
                </tr>
              ) : (
                filteredAndSortedFacturas.map((factura) => (
                  <tr key={factura.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {factura.numero}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {factura.cliente || 'Sin cliente'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(factura.fecha)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(factura.total)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(factura.status)}`}>
                        {getStatusText(factura.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        {/* Acciones rápidas predeterminadas */}
                        <button
                          onClick={() => handleAttachFiles(factura)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Adjuntar archivo a factura"
                        >
                          📎
                        </button>
                        <button
                          onClick={() => handleToggleCobro(factura)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Gestionar cobro (marcar pagado/pendiente)"
                        >
                          💶
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(factura)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Exportar o imprimir en PDF"
                        >
                          🖨️
                        </button>

                        {/* Menú de más acciones */}
                        <div className="relative inline-block">
                          <button
                            className="text-gray-700 hover:text-gray-900"
                            title="Acciones"
                            onClick={() => setOpenMenuId(openMenuId === factura.id ? null : factura.id)}
                          >
                            ⋮
                          </button>
                          {openMenuId === factura.id && (
                          <div className="absolute right-0 mt-2 min-w-[12rem] bg-white border border-gray-200 rounded-md shadow-xl z-50 flex flex-col py-1">
                            <button onClick={() => onView && onView(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">👁️ Ver factura</button>
                            <button onClick={() => handleDownloadPDF(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">📄 Exportar PDF</button>
                            {isEInvoiceXMLEnabled() && (
                              <button onClick={() => handleDownloadXML(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">🧾 Exportar Facturae (XML)</button>
                            )}
                            <button onClick={() => handleMarkPaid(factura, true)} className="w-full text-left px-3 py-2 hover:bg-gray-50">✅ Marcar Pagado</button>
                            <button onClick={() => handleMarkPaid(factura, false)} className="w-full text-left px-3 py-2 hover:bg-gray-50">⏳ Marcar Pendiente</button>
                            {onEdit && (<button onClick={() => onEdit(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">✏️ Editar</button>)}
                            {onDelete && (<button onClick={() => handleDelete(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600">🗑️ Eliminar</button>)}
                          </div>
                          )}
                        </div>
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

export default FacturaLista; 