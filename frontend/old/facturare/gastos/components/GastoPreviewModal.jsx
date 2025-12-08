import { useState, useMemo } from 'react';
import { useGastos } from '../contexts/GastosContext';
import PDFViewerAndroid from '../../../components/PDFViewerAndroid';

const GastoPreviewModal = ({ isOpen, onClose, onProcessed }) => {
  const { uploadGasto, processGasto, gastos, loading } = useGastos();
  const [selectedFile, setSelectedFile] = useState(null);
  const [tempGastoId, setTempGastoId] = useState(null);
  const [error, setError] = useState('');

  // Detectare mobile pentru PDF preview
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);
  const isMobile = isIOS || isAndroid;

  const isImage = useMemo(() => {
    return selectedFile?.type?.startsWith('image/');
  }, [selectedFile]);

  const isPdf = useMemo(() => {
    return selectedFile?.type === 'application/pdf' || selectedFile?.name?.toLowerCase().endsWith('.pdf');
  }, [selectedFile]);

  const [previewUrl, setPreviewUrl] = useState('');

  // Generare preview URL (blob pentru desktop, base64 pentru mobile PDF)
  useMemo(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return;
    }

    // Pentru imagini sau desktop, folosim blob URL
    if (!isPdf || !isMobile) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
      return;
    }

    // Pentru PDF pe mobile, convertim în base64
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(selectedFile);
  }, [selectedFile, isPdf, isMobile]);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSelectedFile(file);

    // Încărcare fără procesare; păstrăm ID-ul pentru procesare manuală
    const res = await uploadGasto(file, { autoProcess: false });
    if (res?.success && res.gasto?.id) {
      setTempGastoId(res.gasto.id);
    } else if (res?.error) {
      setError(res.error);
    }
  };

  const handleProcess = async () => {
    if (!tempGastoId) {
      setError('Niciun fișier încărcat');
      return;
    }
    setError('');
    await processGasto(tempGastoId);
    onProcessed?.();
    onClose?.();
  };

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setTempGastoId(null);
    setError('');
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header cu branding OCR */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-red-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600 text-xl">🧠</div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Cargar y previsualizar gasto</h3>
              <p className="text-xs text-gray-500">Procesado con AI OCR — extracción automática de datos</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Dropzone stilizat */}
          <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-red-300 transition-colors">
            <input hidden type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
            <div className="text-3xl mb-2">📄</div>
            <div className="font-medium text-gray-800">Seleccione un archivo o arrástrelo aquí</div>
            <div className="text-sm text-gray-500">Imágenes o PDF — se sube primero y luego se procesa con IA</div>
          </label>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {selectedFile && (
            <div className="rounded-xl border bg-gray-50">
              <div className="px-4 py-2 text-sm text-gray-600 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{selectedFile.name}</span>
                  <span className="ml-2 text-gray-500">({Math.round(selectedFile.size/1024)} KB)</span>
                </div>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">subido</span>
              </div>
              <div className="bg-white">
                {isImage && (
                  <img src={previewUrl} alt="preview" className="max-h-[420px] md:max-h-[520px] object-contain mx-auto" />
                )}
                {isPdf && (
                  isAndroid ? (
                    <PDFViewerAndroid 
                      pdfUrl={previewUrl}
                      className="w-full h-[420px] md:h-[520px]"
                    />
                  ) : isIOS ? (
                    <object
                      data={previewUrl}
                      type="application/pdf"
                      className="w-full h-[420px] md:h-[520px]"
                    >
                      <div className="p-4 text-center text-gray-600">
                        <p className="mb-3">No se puede mostrar el PDF en este visor.</p>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                        >
                          Abrir PDF en una nueva pestaña
                        </a>
                      </div>
                    </object>
                  ) : (
                    <iframe title="preview" src={previewUrl} className="w-full h-[420px] md:h-[520px]" />
                  )
                )}
                {!isImage && !isPdf && (
                  <div className="text-gray-500 text-sm p-4">Nu există previzualizare pentru acest tip de fișier.</div>
                )}
              </div>
            </div>
          )}

          {/* Hint AI */}
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>⚙️</span>
            <span>La IA extrae: CIF/NIF, proveedor, fecha, conceptos y totales. Revisa el resultado en la lista.</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500">ID temporal: {tempGastoId ? <span className="font-mono">{tempGastoId}</span> : '—'}</div>
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Anulează</button>
            <button
              onClick={handleProcess}
              disabled={!tempGastoId || loading}
              className={`px-5 py-2 rounded-md text-white shadow ${(!tempGastoId || loading) ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {loading ? 'Procesăm...' : 'Enviar para procesar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GastoPreviewModal;


