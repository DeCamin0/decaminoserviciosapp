
import { downloadFacturaPDF, openFacturaPDF } from '../utils/pdfGenerator.jsx';
import { downloadFacturaeXML } from '../utils/facturae.ts';
import { routes } from '../../../utils/routes';
import { isEInvoiceXMLEnabled } from '../../../config/env';
import logoImg from '@/assets/logo.svg';

const FacturaPreview = ({ factura, onEdit, onClose }) => {
  // Función para formatear la fecha
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Función para formatear la suma
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  // Función para obtener el estado en español
  const getStatusText = (status) => {
    const statusMap = {
      'borrador': 'Borrador',
      'enviado': 'Enviado',
      'efactura-pendiente': 'eFactura Pendiente',
      'pagado': 'Pagado'
    };
    return statusMap[status] || status;
  };

  // Función para obtener el color del estado
  const getStatusColor = (status) => {
    const colorMap = {
      'borrador': 'bg-gray-100 text-gray-800',
      'enviado': 'bg-blue-100 text-blue-800',
      'efactura-pendiente': 'bg-amber-100 text-amber-800',
      'pagado': 'bg-green-100 text-green-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Calcula el total para un item
  const calculateItemTotal = (item) => {
    const subtotal = (item.cantidad || 0) * (item.precioUnitario || 0);
    const descuento = subtotal * ((item.descuento || 0) / 100);
    const totalWithDiscount = subtotal - descuento;
    return totalWithDiscount;
  };

  const handleDownloadPDF = async () => {
    const result = await downloadFacturaPDF(factura);
    if (!result.success) {
      alert(result.error || 'Error al descargar el PDF');
    }
  };

  const handleOpenPDF = async () => {
    const result = await openFacturaPDF(factura);
    if (!result.success) {
      alert(result.error || 'Error al abrir el PDF');
    }
  };

  const handleDownloadXML = async () => {
    try {
      if (!isEInvoiceXMLEnabled()) {
        alert('e-Factura (XML) no está habilitada');
        return;
      }
      const res = await downloadFacturaeXML(factura);
      if (!res.success) throw new Error('Error al descargar XML');
    } catch (e) {
      alert('No se pudo generar el XML Facturae');
    }
  };

  const handleGuardar = async () => {
    try {
      // Trimite la backend un payload cu datele principale + fișierele generate
      const form = new FormData();
      form.append('id', factura.id || '');
      form.append('Serie', factura.serie || '');
      form.append('num_factura', factura.numero || '');
      form.append('fecha', factura.fecha || '');
      form.append('cliente_nombre', factura.cliente || '');
      form.append('cliente_nif', factura.cliente_nif || '');
      form.append('base_imponible', String(factura.subtotal || 0));
      form.append('retencion', String(factura.totalRetencion || 0));
      form.append('iva', String(factura.totalTVA || 0));
      form.append('total', String(factura.total || 0));
      form.append('estado', factura.status || 'borrador');
      form.append('observaciones', factura.observaciones || '');
      form.append('created_at', factura.createdAt || new Date().toISOString());

      // Genera PDF en blob
      const pdfRes = await downloadFacturaPDF({ ...factura, downloadOnlyBlob: true });
      if (pdfRes?.blob) {
        form.append('pdf', pdfRes.blob, `Factura_${factura.numero || 'sin_num'}.pdf`);
      }

      // Genera XML si está activo
      if (isEInvoiceXMLEnabled()) {
        const xml = (await (async () => {
          const xmlStr = (await (async () => {
            const { toFacturaeXML } = await import('../utils/facturae.ts');
            return toFacturaeXML(factura);
          })());
          return new Blob([xmlStr], { type: 'application/xml;charset=utf-8' });
        })());
        form.append('xml', xml, `Facturae_${factura.numero || 'sin_num'}.xml`);
      }

      const resp = await fetch(routes.saveFactura, { method: 'POST', body: form });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      alert('Factura guardada correctamente');
    } catch (e) {
      alert('No se pudo guardar la factura');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      {/* Buton regresar */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onClose}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          title="Regresar"
        >
          <span className="text-lg mr-2">←</span>
          <span>Regresar</span>
        </button>
      </div>

      {/* Header cu logo și informații companie */}
      <div className="bg-red-600 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <div className="flex items-center">
              <img 
                src={logoImg} 
                alt="DeCamino Logo" 
                className="h-12 w-auto mr-4"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div>
                <h1 className="text-2xl font-bold">DE CAMINO</h1>
                <p className="text-sm opacity-90">SERVICIOS AUXILIARES SL</p>
                <p className="text-xs opacity-75">CIF B-85524536</p>
                <p className="text-xs opacity-75">Inscrita en R.M. Madrid</p>
                <p className="text-xs opacity-75">T260005-Lº0-Fº180-Secc.8-HOJA M-468812</p>
                <p className="text-xs opacity-75">Avda Euzkadi 14, 28702 San Sebastián de los Reyes, MADRID, España</p>
                <p className="text-xs opacity-75">decaminoservicios@gmail.com</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold mb-2">FACTURA</h2>
            <p className="text-sm opacity-90">Nº: {factura.numero}</p>
            <p className="text-xs opacity-75">Fecha: {formatDate(factura.fecha)}</p>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(factura.status)}`}>
              {getStatusText(factura.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Informații client */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">DATOS DEL CLIENTE</h3>
        <p className="text-gray-900 font-semibold">{factura.cliente || 'Cliente no especificado'}</p>
        <p className="text-sm text-gray-600 mt-1">Dirección del cliente</p>
        <p className="text-sm text-gray-600">Código postal y ciudad</p>
        <p className="text-sm text-gray-600">País</p>
        <p className="text-sm text-gray-600">NIF/CIF del cliente</p>
      </div>

      {/* Tabel cu produse/servicii */}
      <div className="p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide border-b border-gray-200 pb-2">DETALLE DE PRODUCTOS/SERVICIOS</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 text-xs">CONCEPTO</th>
                <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700 text-xs">UDS.</th>
                <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-700 text-xs">BASE UD.</th>
                <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-700 text-xs">BASE TOTAL</th>
                <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700 text-xs">% IVA</th>
                <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700 text-xs">% DESC.</th>
                <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-700 text-xs">IVA</th>
              </tr>
            </thead>
            <tbody>
              {factura.items?.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2 text-gray-700 text-xs">
                    {item.descripcion || 'Sin descripción'}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 text-xs">
                    {item.cantidad || 0}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 text-xs">
                    {formatCurrency(item.precioUnitario || 0)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 text-xs">
                    {formatCurrency(calculateItemTotal(item))}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 text-xs">
                    {item.tva || 0}%
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 text-xs">
                    {item.descuento || 0}%
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 text-xs">
                    {formatCurrency(calculateItemTotal(item) * ((item.tva || 0) / 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaluri */}
        <div className="mt-6 flex justify-end">
          <div className="w-64">
            <div className="space-y-1">
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(factura.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-sm">
                <span>IVA:</span>
                <span className="font-medium">{formatCurrency(factura.totalTVA || 0)}</span>
              </div>
              {factura.totalRetencion && factura.totalRetencion > 0 && (
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Retención:</span>
                  <span className="font-medium">{formatCurrency(factura.totalRetencion)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-red-600 border-t border-gray-200 pt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(factura.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        {factura.observaciones && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">OBSERVACIONES</h4>
            <p className="text-gray-700 italic text-sm">{factura.observaciones}</p>
          </div>
        )}
      </div>

      {/* Footer cu butoane */}
      <div className="p-6 bg-gray-50 rounded-b-lg">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <p>Creada por: {factura.createdBy || 'Sistema'}</p>
            <p>Creada el: {formatDate(factura.createdAt)}</p>
            {factura.updatedAt && (
              <p>Actualizada el: {formatDate(factura.updatedAt)}</p>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleOpenPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Ver PDF
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Descargar PDF
            </button>
            <button
              onClick={handleGuardar}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Guardar
            </button>
            {isEInvoiceXMLEnabled() && (
              <button
                onClick={handleDownloadXML}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                title="Descargar e-Factura (XML)"
              >
                e-Factura (XML)
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(factura)}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
              >
                Editar
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacturaPreview; 