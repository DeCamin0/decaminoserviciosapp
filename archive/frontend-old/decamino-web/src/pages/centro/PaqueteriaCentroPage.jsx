import { useState, useEffect, useCallback } from 'react';
import Back3DButton from '../../components/Back3DButton';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Notification from '../../components/ui/Notification';
import { exportToExcelWithHeader } from '../../utils/exportExcel';
import { useApi } from '../../hooks/useApi';

const PaqueteriaCentroPage = () => {
  const { callApi } = useApi();
  const [items, setItems] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('all');
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showItemDetails, setShowItemDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Cargar lista de centros
  useEffect(() => {
    const fetchCentros = async () => {
      try {
        console.log('🔄 Cargando lista de centros para paquetería...');
        const data = await callApi('getClientes'); // Use getClientes endpoint like in EmpleadosPage
        console.log('📊 Datos recibidos para paquetería:', data);
        
        if (Array.isArray(data)) {
          // Extract unique centros from clientes data (same logic as EmpleadosPage)
          const soloClientes = data.filter(item => item.tipo !== 'proveedor');
          const uniqueCentros = [...new Set(soloClientes.map(cliente => cliente['NOMBRE O RAZON SOCIAL']).filter(Boolean))];
          console.log('🏢 Centros únicos encontrados para paquetería:', uniqueCentros);
          setCentros(uniqueCentros.sort());
          setNotification({ type: 'success', message: `${uniqueCentros.length} centros cargados para paquetería` });
        } else {
          console.warn('⚠️ Datos no son un array:', data);
          setNotification({ type: 'warning', message: 'Formato de datos inesperado' });
        }
      } catch (error) {
        console.error('❌ Error loading centros:', error);
        setNotification({ type: 'error', message: 'Error al cargar la lista de centros' });
      }
    };

    fetchCentros();
  }, [callApi]);

  // Cargar paquetes
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let allItems = [];

      if (selectedCentro === 'all') {
        // Fetch para todos los centros
        const promises = centros.map(async (centro) => {
          try {
            const response = await fetch(`https://n8n.decaminoservicios.com/webhook/6d752a3a-bed9-4c48-a6a9-8a2583875ef9?centroTrabajo=${encodeURIComponent(centro)}`);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
          } catch (error) {
            console.error(`Error fetching items for ${centro}:`, error);
            return [];
          }
        });

        const results = await Promise.all(promises);
        allItems = results.flat();
      } else {
        // Fetch para un centro específico
        const response = await fetch(`https://n8n.decaminoservicios.com/webhook/6d752a3a-bed9-4c48-a6a9-8a2583875ef9?centroTrabajo=${encodeURIComponent(selectedCentro)}`);
        if (response.ok) {
          const data = await response.json();
          allItems = Array.isArray(data) ? data : [];
        }
      }

      setItems(allItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      setNotification({ type: 'error', message: 'Error al cargar los paquetes' });
    } finally {
      setLoading(false);
    }
  }, [selectedCentro, centros]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleShowItemDetails = (item) => {
    setSelectedItem(item);
    setShowItemDetails(true);
  };

  const exportToExcel = () => {
    if (items.length === 0) {
      setNotification({ type: 'warning', message: 'No hay paquetes para exportar' });
      return;
    }

    const data = items.map(item => ({
      'Centro': item.centroTrabajo || '-',
      'Fecha': item.fecha || '-',
      'Hora': item.hora || '-',
      'Tipo': item.tipo || '-',
      'Destinatario': item.destinatario || '-',
      'Remitente': item.remitente || '-',
      'Observaciones': item.observaciones || '-',
      'Estado': item.entregado ? 'Entregado' : 'Pendiente',
      'Fecha Entrega': item.fechaEntrega || '-',
      'Nombre': item.nombre || '-',
      'Código': item.codigo || '-'
    }));

    const columns = [
      { header: 'Centro', key: 'Centro', width: 30 },
      { header: 'Fecha', key: 'Fecha', width: 12 },
      { header: 'Hora', key: 'Hora', width: 10 },
      { header: 'Tipo', key: 'Tipo', width: 15 },
      { header: 'Destinatario', key: 'Destinatario', width: 25 },
      { header: 'Remitente', key: 'Remitente', width: 25 },
      { header: 'Observaciones', key: 'Observaciones', width: 35 },
      { header: 'Estado', key: 'Estado', width: 12 },
      { header: 'Fecha Entrega', key: 'Fecha Entrega', width: 15 },
      { header: 'Nombre', key: 'Nombre', width: 25 },
      { header: 'Código', key: 'Código', width: 12 }
    ];

    const centroName = selectedCentro === 'all' ? 'Todos_Centros' : selectedCentro.replace(/\s+/g, '_');
    const fileName = `Paqueteria_${centroName}_${new Date().toISOString().split('T')[0]}`;

    exportToExcelWithHeader(
      data,
      columns,
      fileName,
      `Control Paquetería - ${selectedCentro === 'all' ? 'Todos los Centros' : selectedCentro}`,
      `Exportado: ${new Date().toLocaleDateString('es-ES')}`
    );

    setNotification({ type: 'success', message: 'Exportado a Excel correctamente' });
  };

  const exportToPDF = () => {
    setNotification({
      type: 'info',
      message: 'Exportar a PDF estará disponible próximamente.'
    });
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Back3DButton to="/cuadernos-centro" title="Volver" />
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              📦 Control Paquetería Por Centro
            </h1>
          </div>
          <p className="text-gray-600">Visualiza todos los paquetes de los diferentes centros de trabajo</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector de Centro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Centro de Trabajo</label>
              <select
                value={selectedCentro}
                onChange={(e) => setSelectedCentro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              >
                <option value="all">📊 Todos los Centros</option>
                {centros.map(centro => (
                  <option key={centro} value={centro}>{centro}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={exportToExcel} variant="primary">
            📊 Exportar Excel
          </Button>
          <Button onClick={exportToPDF} variant="secondary">
            📄 Exportar PDF
          </Button>
          <Button onClick={fetchItems} variant="outline">
            🔄 Refrescar
          </Button>
        </div>

        {/* Tabla de Paquetes */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              {loading ? 'Cargando...' : `${items.length} paquete${items.length !== 1 ? 's' : ''} encontrado${items.length !== 1 ? 's' : ''}`}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-rose-600 text-white">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Centro</th>
                  <th className="text-left py-3 px-4 font-medium">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium">Hora</th>
                  <th className="text-left py-3 px-4 font-medium">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium">Destinatario</th>
                  <th className="text-left py-3 px-4 font-medium">Remitente</th>
                  <th className="text-left py-3 px-4 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      Cargando paquetes...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      No hay paquetes registrados
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={item.id || index}
                      onClick={() => handleShowItemDetails(item)}
                      className="border-b border-gray-200 hover:bg-rose-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900">{item.centroTrabajo || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.fecha || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.hora || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.tipo || '-'}</td>
                      <td className="py-3 px-4 text-gray-900">{item.destinatario || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.remitente || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.entregado 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.entregado ? '✓ Entregado' : '⏳ Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Detalles Paquete */}
      <Modal
        isOpen={showItemDetails}
        onClose={() => setShowItemDetails(false)}
        title="Detalles del Paquete"
      >
        {selectedItem && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold">Centro:</span> {selectedItem.centroTrabajo || '-'}</div>
              <div><span className="font-semibold">Fecha:</span> {selectedItem.fecha || '-'}</div>
              <div><span className="font-semibold">Hora:</span> {selectedItem.hora || '-'}</div>
              <div><span className="font-semibold">Tipo:</span> {selectedItem.tipo || '-'}</div>
              <div><span className="font-semibold">Destinatario:</span> {selectedItem.destinatario || '-'}</div>
              <div><span className="font-semibold">Remitente:</span> {selectedItem.remitente || '-'}</div>
              <div className="col-span-2"><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones || '-'}</div>
              <div><span className="font-semibold">Estado:</span> {selectedItem.entregado ? 'Entregado' : 'Pendiente'}</div>
              <div><span className="font-semibold">Fecha Entrega:</span> {selectedItem.fechaEntrega || '-'}</div>
              <div><span className="font-semibold">Nombre:</span> {selectedItem.nombre || '-'}</div>
              <div><span className="font-semibold">Código:</span> {selectedItem.codigo || '-'}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Notificaciones */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default PaqueteriaCentroPage;

