import { useState, useEffect, useCallback } from 'react';
import Back3DButton from '../../components/Back3DButton';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Notification from '../../components/ui/Notification';
import { exportToExcelWithHeader } from '../../utils/exportExcel';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { routes } from '../../utils/routes';

pdfMake.vfs = pdfFonts.vfs;

const IncidenciasCentroPage = () => {
  const [items, setItems] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showItemDetails, setShowItemDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Cargar lista de centros
  useEffect(() => {
    const fetchCentros = async () => {
      try {
        console.log('🔄 Cargando lista de centros para incidencias...');
        const response = await fetch(routes.getEmpleados);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Datos recibidos para incidencias:', data);
        
        if (Array.isArray(data)) {
          const uniqueCentros = [...new Set(data.map(emp => emp['CENTRO TRABAJO']).filter(Boolean))];
          console.log('🏢 Centros únicos encontrados para incidencias:', uniqueCentros);
          setCentros(uniqueCentros.sort());
          setNotification({ type: 'success', message: `${uniqueCentros.length} centros cargados para incidencias` });
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
  }, []);

  // Cargar incidencias
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let allItems = [];

      if (selectedCentro === 'all') {
        // Fetch para todos los centros
        const promises = centros.map(async (centro) => {
          try {
            const response = await fetch(`https://n8n.decaminoservicios.com/webhook/48ab52db-0279-4e86-aef7-2c8548fb0f5b?centroTrabajo=${encodeURIComponent(centro)}&año=${selectedYear}`);
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
        const response = await fetch(`https://n8n.decaminoservicios.com/webhook/48ab52db-0279-4e86-aef7-2c8548fb0f5b?centroTrabajo=${encodeURIComponent(selectedCentro)}&año=${selectedYear}`);
        if (response.ok) {
          const data = await response.json();
          allItems = Array.isArray(data) ? data : [];
        }
      }

      setItems(allItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      setNotification({ type: 'error', message: 'Error al cargar las incidencias' });
    } finally {
      setLoading(false);
    }
  }, [selectedCentro, selectedYear, centros]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleShowItemDetails = (item) => {
    setSelectedItem(item);
    setShowItemDetails(true);
  };

  const exportToExcel = () => {
    if (items.length === 0) {
      setNotification({ type: 'warning', message: 'No hay incidencias para exportar' });
      return;
    }

    const data = items.map(item => ({
      'Centro': item.centroTrabajo || '-',
      'Fecha': item.fecha || '-',
      'Hora': item.hora || '-',
      'Tipo': item.tipo || '-',
      'Descripción': item.descripcion || '-',
      'Estado': item.estado || '-',
      'Prioridad': item.prioridad || '-',
      'Nombre': item.nombre || '-',
      'Código': item.codigo || '-',
      'Email': item.email || '-'
    }));

    const columns = [
      { header: 'Centro', key: 'Centro', width: 30 },
      { header: 'Fecha', key: 'Fecha', width: 12 },
      { header: 'Hora', key: 'Hora', width: 10 },
      { header: 'Tipo', key: 'Tipo', width: 20 },
      { header: 'Descripción', key: 'Descripción', width: 40 },
      { header: 'Estado', key: 'Estado', width: 15 },
      { header: 'Prioridad', key: 'Prioridad', width: 12 },
      { header: 'Nombre', key: 'Nombre', width: 25 },
      { header: 'Código', key: 'Código', width: 12 },
      { header: 'Email', key: 'Email', width: 25 }
    ];

    const centroName = selectedCentro === 'all' ? 'Todos_Centros' : selectedCentro.replace(/\s+/g, '_');
    const fileName = `Incidencias_${centroName}_${selectedYear}`;

    exportToExcelWithHeader(
      data,
      columns,
      fileName,
      `Incidencias - ${selectedCentro === 'all' ? 'Todos los Centros' : selectedCentro}`,
      `Año: ${selectedYear}`
    );

    setNotification({ type: 'success', message: 'Exportado a Excel correctamente' });
  };

  const exportToPDF = () => {
    if (items.length === 0) {
      setNotification({ type: 'warning', message: 'No hay incidencias para exportar' });
      return;
    }

    const centroName = selectedCentro === 'all' ? 'Todos los Centros' : selectedCentro;

    const tableBody = [
      ['Centro', 'Fecha', 'Tipo', 'Descripción', 'Estado', 'Prioridad']
    ];

    items.forEach(item => {
      tableBody.push([
        item.centroTrabajo || '-',
        item.fecha || '-',
        item.tipo || '-',
        item.descripcion ? item.descripcion.substring(0, 50) + '...' : '-',
        item.estado || '-',
        item.prioridad || '-'
      ]);
    });

    const docDefinition = {
      pageOrientation: 'landscape',
      content: [
        { text: `Incidencias - ${centroName}`, style: 'header' },
        { text: `Año: ${selectedYear}`, style: 'subheader' },
        { text: `Total: ${items.length} incidencias`, style: 'subheader', margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: [100, 70, 80, '*', 70, 60],
            body: tableBody
          },
          layout: {
            fillColor: (rowIndex) => rowIndex === 0 ? '#dc2626' : (rowIndex % 2 === 0 ? '#f3f4f6' : null)
          }
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 12, margin: [0, 0, 0, 5] }
      }
    };

    pdfMake.createPdf(docDefinition).download(`Incidencias_${centroName.replace(/\s+/g, '_')}_${selectedYear}.pdf`);
    setNotification({ type: 'success', message: 'PDF generado correctamente' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Back3DButton to="/cuadernos-centro" title="Volver" />
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              ⚠️ Incidencias Por Centro
            </h1>
          </div>
          <p className="text-gray-600">Visualiza todas las incidencias de los diferentes centros de trabajo</p>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">📊 Todos los Centros</option>
                {centros.map(centro => (
                  <option key={centro} value={centro}>{centro}</option>
                ))}
              </select>
            </div>

            {/* Selector de Año */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
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

        {/* Tabla de Incidencias */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              {loading ? 'Cargando...' : `${items.length} incidencia${items.length !== 1 ? 's' : ''} encontrada${items.length !== 1 ? 's' : ''}`}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-amber-600 text-white">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Centro</th>
                  <th className="text-left py-3 px-4 font-medium">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium">Hora</th>
                  <th className="text-left py-3 px-4 font-medium">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium">Descripción</th>
                  <th className="text-left py-3 px-4 font-medium">Estado</th>
                  <th className="text-left py-3 px-4 font-medium">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      Cargando incidencias...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      No hay incidencias para este año
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={item.id || index}
                      onClick={() => handleShowItemDetails(item)}
                      className="border-b border-gray-200 hover:bg-amber-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900">{item.centroTrabajo || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.fecha || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.hora || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.tipo || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{item.descripcion || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.estado === 'Resuelta' 
                            ? 'bg-green-100 text-green-800'
                            : item.estado === 'En proceso'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.estado || 'Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.prioridad === 'Alta'
                            ? 'bg-red-100 text-red-800'
                            : item.prioridad === 'Media'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.prioridad || 'Normal'}
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

      {/* Modal Detalles Incidencia */}
      <Modal
        isOpen={showItemDetails}
        onClose={() => setShowItemDetails(false)}
        title="Detalles de la Incidencia"
      >
        {selectedItem && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold">Centro:</span> {selectedItem.centroTrabajo || '-'}</div>
              <div><span className="font-semibold">Fecha:</span> {selectedItem.fecha || '-'}</div>
              <div><span className="font-semibold">Hora:</span> {selectedItem.hora || '-'}</div>
              <div><span className="font-semibold">Tipo:</span> {selectedItem.tipo || '-'}</div>
              <div className="col-span-2"><span className="font-semibold">Descripción:</span> {selectedItem.descripcion || '-'}</div>
              <div><span className="font-semibold">Estado:</span> {selectedItem.estado || '-'}</div>
              <div><span className="font-semibold">Prioridad:</span> {selectedItem.prioridad || '-'}</div>
              <div><span className="font-semibold">Nombre:</span> {selectedItem.nombre || '-'}</div>
              <div><span className="font-semibold">Código:</span> {selectedItem.codigo || '-'}</div>
              <div className="col-span-2"><span className="font-semibold">Email:</span> {selectedItem.email || '-'}</div>
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

export default IncidenciasCentroPage;

