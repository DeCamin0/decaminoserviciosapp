import { useEffect, useMemo, useState } from 'react';
import { routes } from '../../../utils/routes';
import { exportGastosToExcel } from '../../../utils/exportExcel';
import MonthSelector from '../../../components/MonthSelector';

const columnDefs = [
  { key: 'id', label: 'ID' },
  { key: 'numar_operatiune', label: 'Número' },
  { key: 'data', label: 'Fecha' },
  { key: 'produse_text', label: 'Concepto' },
  { key: 'total_platit', label: 'Importe' },
  { key: 'imputable', label: 'Imputable' }
];

const formatNumber = (value) => {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const GastosTabla = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📥 Cargando gastos (tabla) desde:', routes.getGastos);
      const res = await fetch(routes.getGastos);
      const text = await res.text();
      console.log('🧾 RAW respuesta (2KB):', text.slice(0, 2048));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = [];
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }
      const arrayData = Array.isArray(data) ? data : [];
      setItems(arrayData);
    } catch (e) {
      console.error('❌ Error listando gastos:', e);
      setError(e.message || 'Error cargando gastos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resolveFileInfo = (row) => {
    // Support nested structures and many common key variants
    const fileObj = row.file || row.archivo || row.fichero || row.documento || row.document || null;

    const url =
      row.fileUrl || row.file_url || row.url || row.enlace || row.downloadUrl || row.download_url ||
      row.archivoUrl || row.archivo_url || row.signedUrl || row.signed_url || row.s3Url || row.s3_url ||
      row.path || row.ruta || row.rutaArchivo || row.ruta_archivo || fileObj?.url || fileObj?.link || fileObj?.href;

    const base64 =
      row.fileBase64 || row.file_base64 || row.base64 || row.contenido || row.contenido_base64 ||
      row.archivoB64 || row.archivo_base64 || row.file_b64 || row.content || row.data || fileObj?.base64 || fileObj?.contenido;

    const mime = row.mimeType || row.mime_type || row.contentType || row.mime || fileObj?.mime || fileObj?.mimeType || 'application/pdf';

    const name =
      row.fileName || row.filename || row.nombreArchivo || row.archivoNombre || row.nombre || row.name ||
      fileObj?.name || fileObj?.fileName || 'gasto.pdf';

    const id =
      row.id || row.fileId || row.file_id || row.archivoId || row.archivo_id || row.idArchivo || row.documentId || row.documentoId ||
      fileObj?.id || fileObj?.fileId;

    return { url, base64, mime, name, id };
  };

  const hasDownloadable = (row) => {
    const { url, base64 } = resolveFileInfo(row);
    const has = Boolean(url || base64 || row.hasFile || row.fileName);
    if (!has) {
      // Ajutăm debugging-ul: arată în consolă cheile disponibile
      console.warn('No se detectó archivo descargable para fila. Claves disponibles:', Object.keys(row));
    }
    return has;
  };

  const exportToExcel = async () => {
    if (!hasAny) return;
    await exportGastosToExcel(filteredItems, columnTotals);
  };

  const handleDownloadFile = async (row) => {
    try {
      const { url: fileUrl, base64, mime, name: fileName, id } = resolveFileInfo(row);
      console.log('⬇️ Intento descarga gasto:', { fileUrl, hasBase64: Boolean(base64), fileName, id, hasFile: row.hasFile });
      // 0) Descărcare prin ID la endpoint-ul indicat de tine (prioritar)
      if (id !== undefined && id !== null) {
        try {
          const resp = await fetch(`${routes.downloadGastoById}?id=${encodeURIComponent(id)}`);
          if (resp.ok) {
            const blob = await resp.blob();
            const dlUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = row.fileName || fileName || `gasto_${id}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(dlUrl);
            return;
          }
          console.warn('⚠️ Download by ID respondió con', resp.status);
        } catch (e) {
          console.warn('⚠️ Error intentando download por ID:', e);
        }
      }

      // 1) URL directa
      if (fileUrl) {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 2) Base64 (acceptă și data URLs)
      if (base64) {
        try {
          let raw = String(base64);
          const commaIdx = raw.indexOf(',');
          if (raw.startsWith('data:') && commaIdx !== -1) {
            raw = raw.slice(commaIdx + 1);
          }
          raw = raw.replace(/\s/g, '');
          const binary = atob(raw);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        } catch (e) {
          console.warn('⚠️ Base64 inválido, intento otros métodos de descarga');
        }
      }

      // 2.1) Fallback: backend indică hasFile + fileName → încercăm GET cu parametri
      if (row.hasFile && (row.fileName || fileName)) {
        const name = row.fileName || fileName || 'gasto.pdf';
        const q = encodeURIComponent(name);
        const tryUrls = [
          `${routes.getGastos}?download=1&fileName=${q}`,
          `${routes.getGastos}?fileName=${q}`,
          `${routes.getGastos}?filename=${q}`,
          `${routes.getGastos}?file=${q}`,
        ];

        for (const trialUrl of tryUrls) {
          try {
            const resp = await fetch(trialUrl);
            if (!resp.ok) continue;
            const ct = resp.headers.get('content-type') || '';
            const blob = await resp.blob();
            const dlUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(dlUrl);
            return;
          } catch (e) {
            // continue next trial
          }
        }

        // 2.2) Fallback POST cu acțiune explicită
        const postBodies = [
          { action: 'download', fileName: name },
          { download: true, fileName: name },
          { file: name },
          { filename: name }
        ];
        for (const body of postBodies) {
          try {
            const resp = await fetch(routes.getGastos, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            if (resp.ok) {
              const blob = await resp.blob();
              const dlUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = dlUrl;
              a.download = name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(dlUrl);
              return;
            }
          } catch (e) {
            // continue next
          }
        }
      }

      // 3) Descărcare prin ID la endpoint specificat
      if (id) {
        try {
          const resp = await fetch(`${routes.downloadGastoById}?id=${encodeURIComponent(id)}`);
          if (resp.ok) {
            const blob = await resp.blob();
            const dlUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = row.fileName || fileName || `gasto_${id}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(dlUrl);
            return;
          }
          console.warn('⚠️ Download by ID respondió con', resp.status);
        } catch (e) {
          console.warn('⚠️ Error intentando download por ID:', e);
        }
      }
    } catch (e) {
      console.error('❌ Error al descargar el archivo:', e);
      alert('No se pudo descargar el archivo');
    }
  };

  const hasAny = items && items.length > 0;
  
  // Filter items by selected month if a month is selected
  const filteredItems = useMemo(() => {
    if (selectedMonth === 0) return items;
    return items.filter(item => {
      if (!item.data) return false;
      const itemMonth = parseInt(item.data.split('-')[1], 10);
      return itemMonth === selectedMonth;
    });
  }, [items, selectedMonth]);

  const totals = useMemo(() => {
    if (!hasAny) return { total: 0, imputable: 0, noImputable: 0 };
    
    return filteredItems.reduce(
      (acc, it) => ({
        total: acc.total + Number(it.total_platit || 0),
        imputable: acc.imputable + (it.imputable ? Number(it.total_platit || 0) : 0),
        noImputable: acc.noImputable + (!it.imputable ? Number(it.total_platit || 0) : 0)
      }),
      { total: 0, imputable: 0, noImputable: 0 }
    );
  }, [filteredItems, hasAny]);

  // Calculate totals for all numeric columns
  const columnTotals = useMemo(() => {
    if (!hasAny) return {};
    
    const totals = {};
    columnDefs.forEach(col => {
      if (col.key === 'total_platit') {
        totals[col.key] = filteredItems.reduce((sum, item) => {
          const value = Number(item[col.key] || 0);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);
      }
    });
    return totals;
  }, [filteredItems, hasAny]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold text-gray-800">Ver Gastos</h2>
          <MonthSelector 
            onMonthSelect={setSelectedMonth}
            selectedMonth={selectedMonth}
          />
          {selectedMonth > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 font-medium">
                Filtrado por mes ({filteredItems.length} de {items.length})
              </span>
              <button
                onClick={() => setSelectedMonth(0)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Limpiar filtro de mes"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={!hasAny || loading}
            className={`px-3 py-2 rounded-md ${!hasAny || loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            title="Exportar a Excel"
          >
            📊 Export Excel
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className={`px-3 py-2 rounded-md ${loading ? 'bg-gray-200 text-gray-500' : 'bg-red-600 text-white hover:bg-red-700'}`}
          >
            {loading ? 'Actualizando...' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">💰</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Total Importe</p>
              <p className="text-2xl font-bold text-blue-900">
                €{formatNumber(totals.total)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-green-600 text-xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600">Imputable</p>
              <p className="text-2xl font-bold text-green-900">
                €{formatNumber(totals.imputable)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-amber-100 rounded-lg">
              <span className="text-amber-600 text-xl">📋</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-amber-600">Total Gastos</p>
              <p className="text-2xl font-bold text-amber-900">
                {filteredItems.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {columnDefs.map(col => (
                  <th key={col.key} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr><td colSpan={columnDefs.length + 1} className="px-4 py-4 text-center text-gray-500">Cargando...</td></tr>
              )}
              {!loading && !hasAny && (
                <tr><td colSpan={columnDefs.length + 1} className="px-4 py-4 text-center text-gray-500">Sin datos</td></tr>
              )}
              {!loading && hasAny && filteredItems.length === 0 && (
                <tr><td colSpan={columnDefs.length + 1} className="px-4 py-4 text-center text-gray-500">No hay gastos para el mes seleccionado</td></tr>
              )}
              {!loading && hasAny && filteredItems.length > 0 && filteredItems.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {columnDefs.map(col => {
                    const value = row[col.key];
                    let display = value;
                    
                    // Formatare specială pentru diferite tipuri de coloane
                    if (col.key === 'total_platit') {
                      display = formatNumber(value);
                    } else if (col.key === 'imputable') {
                      display = value ? '✅ Sí' : '❌ No';
                    } else if (col.key === 'data') {
                      display = value ? new Date(value).toLocaleDateString('es-ES') : '';
                    } else if (col.key === 'produse_text') {
                      // Truncate textul dacă e prea lung
                      display = value && value.length > 50 ? value.substring(0, 50) + '...' : value;
                    }
                    
                    return (
                      <td key={col.key} className="px-4 py-2 text-sm text-gray-800 align-top">
                        {display || '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-sm">
                    {hasDownloadable(row) ? (
                      <button
                        onClick={() => handleDownloadFile(row)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Descargar archivo"
                      >
                        📄 Descargar
                      </button>
                    ) : (
                      <span className="text-gray-400" title={`Sin archivo (keys: ${Object.keys(row).join(', ')})`}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {hasAny && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-2 text-xs text-gray-600 font-semibold" colSpan={4}>TOTALES</td>
                  <td className="px-4 py-2 text-sm font-semibold text-red-600">{formatNumber(columnTotals.total_platit)}</td>
                  <td className="px-4 py-2 text-sm font-semibold">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default GastosTabla;


