import { useState, useEffect, useCallback } from 'react';
import { routes } from '../../utils/routes';

/**
 * Certificados de retenciones (IRPF / nómina): mismo flujo que Diplomas — PDF/ZIP, preview, asociación por nombre.
 */
export default function CertificadosRetencionesTab({ showNotification }) {
  const notify = showNotification || (() => {});

  const [zipFile, setZipFile] = useState(null);
  const [zipPreview, setZipPreview] = useState(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState(null);
  const [zipSeleccionadas, setZipSeleccionadas] = useState([]);
  const [zipGuardando, setZipGuardando] = useState(false);

  const [pdfsFiles, setPdfsFiles] = useState([]);
  const [pdfsPreview, setPdfsPreview] = useState(null);
  const [pdfsLoading, setPdfsLoading] = useState(false);
  const [pdfsError, setPdfsError] = useState(null);
  const [pdfsSeleccionadas, setPdfsSeleccionadas] = useState([]);
  const [pdfsGuardando, setPdfsGuardando] = useState(false);

  const [todas, setTodas] = useState([]);
  const [todasLoading, setTodasLoading] = useState(false);
  const [todasError, setTodasError] = useState(null);

  /** PDF único con muchos certificados (ej. CERTIFICADOS RETENCIONES DE CAMINO 2025.pdf) */
  const [compFile, setCompFile] = useState(null);
  const [compPreview, setCompPreview] = useState(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState(null);
  const [compSel, setCompSel] = useState([]);
  const [compGuardando, setCompGuardando] = useState(false);

  const fetchTodas = useCallback(async () => {
    setTodasLoading(true);
    setTodasError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(routes.certificadosRetencionesListarTodas, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al cargar certificados' }));
        throw new Error(errorData.message || 'Error al cargar certificados');
      }
      const data = await response.json();
      setTodas(Array.isArray(data.certificados) ? data.certificados : []);
    } catch (error) {
      console.error('Certificados retenciones:', error);
      setTodasError(error.message);
      setTodas([]);
    } finally {
      setTodasLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodas();
  }, [fetchTodas]);

  const borderSpin = 'border-emerald-500';
  const btnGrad = 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="documentos-empleados-avatar shrink-0 w-10 h-10 sm:w-12 sm:h-12 text-base">
            CR
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Certificados de retenciones</h2>
            <p className="text-gray-600 text-xs sm:text-sm">
              Sube PDFs por empleado (certificados IRPF / retenciones). Misma lógica que diplomas: nombre desde el PDF o
              el archivo.
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-6 border-2 border-emerald-200 bg-emerald-50/30">
        <h3 className="text-lg font-bold text-gray-900 mb-2">📚 Un solo PDF con muchos certificados</h3>
        <p className="text-sm text-gray-600 mb-4">
          Para ficheros tipo <strong>CERTIFICADOS RETENCIONES DE CAMINO 2025.pdf</strong>: el servidor lee cada página,
          detecta inicios de certificado (AEAT / retenciones), extrae <strong>ejercicio</strong> (año) y{' '}
          <strong>nombre</strong>, y propone un PDF separado por empleado al guardar.
        </p>
        <label className="flex flex-col items-center justify-center w-full min-h-[7rem] border-2 border-dashed border-emerald-400 rounded-lg cursor-pointer bg-white hover:bg-emerald-50/80 transition-colors">
          <div className="py-4 px-2 text-center">
            <p className="text-sm text-gray-700 font-medium">Seleccionar un PDF compuesto</p>
            <p className="text-xs text-gray-500 mt-1">Un archivo con varias hojas / varios perceptores</p>
          </div>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setCompFile(file);
              setCompLoading(true);
              setCompError(null);
              setCompPreview(null);
              setCompSel([]);
              try {
                const token = localStorage.getItem('auth_token');
                const formData = new FormData();
                formData.append('pdf_file', file);
                const response = await fetch(routes.certificadosRetencionesCompuestoPreview, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: formData,
                });
                if (!response.ok) {
                  const err = await response.json().catch(() => ({}));
                  throw new Error(err.message || 'Error al analizar el PDF');
                }
                const data = await response.json();
                setCompPreview(data);
                const list = Array.isArray(data.certificados) ? data.certificados : [];
                setCompSel(
                  list
                    .filter((c) => c.empleadoCodigo && !c.esPortada)
                    .map((c) => ({
                      pageFrom: c.pageFrom,
                      pageTo: c.pageTo,
                      empleadoCodigo: c.empleadoCodigo,
                      empleadoNombre: c.empleadoNombre,
                      ejercicio: c.ejercicio || null,
                    })),
                );
                notify(
                  'success',
                  'PDF analizado',
                  `${data.totalPages || list.length} páginas → ${list.length} segmentos (${data.estrategia || ''}). Revisa y marca los que quieras guardar.`,
                );
              } catch (err) {
                setCompError(err.message);
                notify('error', 'Error', err.message);
              } finally {
                setCompLoading(false);
              }
            }}
          />
        </label>
        {compLoading && (
          <div className="flex items-center gap-2 mt-3 text-gray-600 text-sm">
            <div className={`w-5 h-5 border-2 ${borderSpin} border-t-transparent rounded-full animate-spin`} />
            Analizando páginas…
          </div>
        )}
        {compError && (
          <p className="text-red-700 text-sm mt-2">❌ {compError}</p>
        )}
        {compPreview && Array.isArray(compPreview.certificados) && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{compPreview.totalPages}</span> páginas · estrategia:{' '}
              <code className="bg-gray-100 px-1 rounded">{compPreview.estrategia}</code>
            </p>
            <div className="max-h-80 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2 bg-white">
              {compPreview.certificados.map((c) => (
                <div
                  key={c.segmentoId}
                  className={`p-2 rounded border text-sm ${
                    c.esPortada ? 'bg-amber-50 border-amber-200' : c.empleadoCodigo ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-semibold">
                        pp. {c.pageFrom}
                        {c.pageTo !== c.pageFrom ? `–${c.pageTo}` : ''}
                      </span>
                      {c.ejercicio && (
                        <span className="ml-2 text-emerald-800 font-medium">Ejercicio {c.ejercicio}</span>
                      )}
                      {c.esPortada && <span className="ml-2 text-amber-800">(posible portada)</span>}
                      {c.nombreExtraido && (
                        <p className="text-gray-800 mt-1">Nombre detectado: {c.nombreExtraido}</p>
                      )}
                      {c.empleadoCodigo ? (
                        <p className="text-green-800 text-xs mt-1">
                          ✅ {c.empleadoNombre} ({c.empleadoCodigo})
                        </p>
                      ) : (
                        <p className="text-yellow-800 text-xs mt-1">⚠️ Sin empleado en base de datos</p>
                      )}
                    </div>
                    {c.empleadoCodigo && !c.esPortada && (
                      <input
                        type="checkbox"
                        className="mt-1 w-5 h-5 text-emerald-600"
                        checked={compSel.some(
                          (s) => s.pageFrom === c.pageFrom && s.pageTo === c.pageTo,
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCompSel([
                              ...compSel,
                              {
                                pageFrom: c.pageFrom,
                                pageTo: c.pageTo,
                                empleadoCodigo: c.empleadoCodigo,
                                empleadoNombre: c.empleadoNombre,
                                ejercicio: c.ejercicio || null,
                              },
                            ]);
                          } else {
                            setCompSel(
                              compSel.filter(
                                (s) => !(s.pageFrom === c.pageFrom && s.pageTo === c.pageTo),
                              ),
                            );
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {compSel.length > 0 && compFile && (
              <button
                type="button"
                disabled={compGuardando}
                onClick={async () => {
                  setCompGuardando(true);
                  try {
                    const token = localStorage.getItem('auth_token');
                    const formData = new FormData();
                    formData.append('pdf_file', compFile);
                    formData.append('certificados', JSON.stringify(compSel));
                    const response = await fetch(routes.certificadosRetencionesCompuestoConfirmar, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                      body: formData,
                    });
                    if (!response.ok) {
                      const err = await response.json().catch(() => ({}));
                      throw new Error(err.message || 'Error al guardar');
                    }
                    const data = await response.json();
                    notify('success', 'Guardado', data.message || `${data.guardados} certificados`);
                    setCompFile(null);
                    setCompPreview(null);
                    setCompSel([]);
                    fetchTodas();
                  } catch (err) {
                    notify('error', 'Error', err.message);
                  } finally {
                    setCompGuardando(false);
                  }
                }}
                className={`w-full py-3 rounded-lg font-bold text-white bg-gradient-to-r ${btnGrad} shadow-lg disabled:opacity-50`}
              >
                {compGuardando ? 'Guardando…' : `Guardar ${compSel.length} PDFs recortados`}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📄 Subir PDFs individuales</h3>
        <p className="text-sm text-gray-600 mb-4">
          Selecciona uno o más PDF de certificados de retenciones. El sistema intentará extraer el nombre del perceptor
          (p. ej. etiqueta PERCEPTOR en AEAT) o usar el nombre del archivo.
        </p>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click para seleccionar</span> o arrastra los PDFs aquí
              </p>
              <p className="text-xs text-gray-500">Múltiples archivos PDF</p>
            </div>
            <input
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                setPdfsFiles(files);
                setPdfsLoading(true);
                setPdfsError(null);
                setPdfsPreview(null);
                try {
                  const token = localStorage.getItem('auth_token');
                  const formData = new FormData();
                  files.forEach((file) => formData.append('pdf_files', file));
                  const response = await fetch(routes.certificadosRetencionesUploadPdfsPreview, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                  });
                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al procesar PDFs');
                  }
                  const data = await response.json();
                  const list = data.certificados || [];
                  setPdfsPreview(data);
                  setPdfsSeleccionadas(
                    list
                      .filter((d) => d.empleadoCodigo)
                      .map((d) => ({
                        nombreArchivo: d.nombreArchivo,
                        empleadoCodigo: d.empleadoCodigo,
                        empleadoNombre: d.empleadoNombre,
                      })),
                  );
                  notify(
                    'success',
                    'PDFs procesados',
                    `Se encontraron ${list.length} archivos. ${list.filter((d) => d.empleadoCodigo).length} asociados.`,
                  );
                } catch (error) {
                  setPdfsError(error.message);
                  notify('error', 'Error', error.message);
                } finally {
                  setPdfsLoading(false);
                }
              }}
            />
          </label>

          {pdfsLoading && (
            <div className="flex items-center justify-center py-4">
              <div className={`w-8 h-8 border-4 ${borderSpin} border-t-transparent rounded-full animate-spin`} />
              <span className="ml-3 text-gray-600">Procesando PDFs...</span>
            </div>
          )}

          {pdfsError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">❌ {pdfsError}</p>
            </div>
          )}

          {pdfsPreview && pdfsPreview.certificados && (
            <div className="mt-4">
              <h4 className="font-bold text-gray-900 mb-3">
                Preview: {pdfsPreview.certificados.length} certificados encontrados
              </h4>
              <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                {pdfsPreview.certificados.map((row, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-2 ${
                      row.empleadoCodigo ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{row.nombreArchivo}</p>
                        {row.nombreExtraido && (
                          <p className="text-xs text-gray-600 mt-1">
                            Nombre extraído: <span className="font-semibold">{row.nombreExtraido}</span>
                            {row.fuente && (
                              <span className="ml-2 text-gray-500">
                                ({row.fuente === 'pdf' ? '📄 PDF' : '📝 Filename'})
                              </span>
                            )}
                          </p>
                        )}
                        {row.empleadoCodigo ? (
                          <p className="text-xs text-green-700 mt-1">
                            ✅ Asociado a: {row.empleadoNombre} ({row.empleadoCodigo})
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-700 mt-1">⚠️ No se encontró empleado</p>
                        )}
                      </div>
                      {row.empleadoCodigo && (
                        <input
                          type="checkbox"
                          checked={pdfsSeleccionadas.some((d) => d.nombreArchivo === row.nombreArchivo)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPdfsSeleccionadas([
                                ...pdfsSeleccionadas,
                                {
                                  nombreArchivo: row.nombreArchivo,
                                  empleadoCodigo: row.empleadoCodigo,
                                  empleadoNombre: row.empleadoNombre,
                                },
                              ]);
                            } else {
                              setPdfsSeleccionadas(
                                pdfsSeleccionadas.filter((d) => d.nombreArchivo !== row.nombreArchivo),
                              );
                            }
                          }}
                          className="ml-2 w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pdfsPreview.errores?.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-bold text-red-700 mb-2">Errores:</h5>
                  <div className="space-y-1">
                    {pdfsPreview.errores.map((err, idx) => (
                      <p key={idx} className="text-xs text-red-600">
                        {err.nombreArchivo}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {pdfsSeleccionadas.length > 0 && (
                <button
                  onClick={async () => {
                    if (pdfsFiles.length === 0) return;
                    setPdfsGuardando(true);
                    try {
                      const token = localStorage.getItem('auth_token');
                      const formData = new FormData();
                      pdfsFiles.forEach((file) => formData.append('pdf_files', file));
                      formData.append('certificados', JSON.stringify(pdfsSeleccionadas));
                      const response = await fetch(routes.certificadosRetencionesUploadPdfsConfirmar, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                      });
                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Error al guardar');
                      }
                      const data = await response.json();
                      notify('success', 'Guardado', data.message || `Guardados: ${data.guardados}`);
                      setPdfsFiles([]);
                      setPdfsPreview(null);
                      setPdfsSeleccionadas([]);
                      fetchTodas();
                    } catch (error) {
                      notify('error', 'Error', error.message);
                    } finally {
                      setPdfsGuardando(false);
                    }
                  }}
                  disabled={pdfsGuardando || pdfsSeleccionadas.length === 0}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white bg-gradient-to-r ${btnGrad} shadow-lg disabled:opacity-50`}
                >
                  {pdfsGuardando ? 'Guardando…' : `Guardar ${pdfsSeleccionadas.length} seleccionados`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📦 Subir ZIP con PDFs</h3>
        <p className="text-sm text-gray-600 mb-4">ZIP con varios PDF de certificados de retenciones.</p>
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Seleccionar ZIP</span>
            </p>
          </div>
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setZipFile(file);
              setZipLoading(true);
              setZipError(null);
              setZipPreview(null);
              try {
                const token = localStorage.getItem('auth_token');
                const formData = new FormData();
                formData.append('zip_file', file);
                const response = await fetch(routes.certificadosRetencionesUploadZipPreview, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: formData,
                });
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || 'Error al procesar ZIP');
                }
                const data = await response.json();
                const list = data.certificados || [];
                setZipPreview(data);
                setZipSeleccionadas(
                  list
                    .filter((d) => d.empleadoCodigo)
                    .map((d) => ({
                      nombreArchivo: d.nombreArchivo,
                      empleadoCodigo: d.empleadoCodigo,
                      empleadoNombre: d.empleadoNombre,
                    })),
                );
                notify('success', 'ZIP procesado', `${list.length} PDFs en el ZIP.`);
              } catch (error) {
                setZipError(error.message);
                notify('error', 'Error', error.message);
              } finally {
                setZipLoading(false);
              }
            }}
          />
        </label>

        {zipLoading && (
          <div className="flex items-center justify-center py-4 mt-2">
            <div className={`w-8 h-8 border-4 ${borderSpin} border-t-transparent rounded-full animate-spin`} />
            <span className="ml-3 text-gray-600">Procesando ZIP...</span>
          </div>
        )}
        {zipError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-2">
            <p className="text-red-800 text-sm">❌ {zipError}</p>
          </div>
        )}

        {zipPreview?.certificados && (
          <div className="mt-4">
            <h4 className="font-bold text-gray-900 mb-3">
              Preview: {zipPreview.certificados.length} certificados
            </h4>
            <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
              {zipPreview.certificados.map((row, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border-2 ${
                    row.empleadoCodigo ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{row.nombreArchivo}</p>
                      {row.empleadoCodigo ? (
                        <p className="text-xs text-green-700 mt-1">
                          ✅ {row.empleadoNombre} ({row.empleadoCodigo})
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-700 mt-1">⚠️ Sin empleado</p>
                      )}
                    </div>
                    {row.empleadoCodigo && (
                      <input
                        type="checkbox"
                        checked={zipSeleccionadas.some((d) => d.nombreArchivo === row.nombreArchivo)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setZipSeleccionadas([
                              ...zipSeleccionadas,
                              {
                                nombreArchivo: row.nombreArchivo,
                                empleadoCodigo: row.empleadoCodigo,
                                empleadoNombre: row.empleadoNombre,
                              },
                            ]);
                          } else {
                            setZipSeleccionadas(
                              zipSeleccionadas.filter((d) => d.nombreArchivo !== row.nombreArchivo),
                            );
                          }
                        }}
                        className="ml-2 w-5 h-5 text-emerald-600 border-gray-300 rounded"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {zipSeleccionadas.length > 0 && (
              <button
                onClick={async () => {
                  if (!zipFile) return;
                  setZipGuardando(true);
                  try {
                    const token = localStorage.getItem('auth_token');
                    const formData = new FormData();
                    formData.append('zip_file', zipFile);
                    formData.append('certificados', JSON.stringify(zipSeleccionadas));
                    const response = await fetch(routes.certificadosRetencionesUploadZipConfirmar, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                      body: formData,
                    });
                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.message || 'Error al guardar');
                    }
                    const data = await response.json();
                    notify('success', 'Guardado', data.message || '');
                    setZipFile(null);
                    setZipPreview(null);
                    setZipSeleccionadas([]);
                    fetchTodas();
                  } catch (error) {
                    notify('error', 'Error', error.message);
                  } finally {
                    setZipGuardando(false);
                  }
                }}
                disabled={zipGuardando}
                className={`w-full py-3 px-4 rounded-lg font-bold text-white bg-gradient-to-r ${btnGrad} shadow-lg disabled:opacity-50`}
              >
                {zipGuardando ? 'Guardando…' : `Guardar ${zipSeleccionadas.length} del ZIP`}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">📋 Todos los certificados</h3>
          <button
            type="button"
            onClick={fetchTodas}
            disabled={todasLoading}
            className={`px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r ${btnGrad} shadow-lg disabled:opacity-50 flex items-center gap-2`}
          >
            {todasLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Cargando…
              </>
            ) : (
              <>
                <span>🔄</span> Actualizar
              </>
            )}
          </button>
        </div>

        {todasLoading ? (
          <div className="text-center py-8">
            <div className={`animate-spin rounded-full h-12 w-12 border-4 ${borderSpin} border-t-transparent mx-auto mb-4`} />
            <p className="text-gray-600">Cargando…</p>
          </div>
        ) : todasError ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <p className="text-red-800">❌ {todasError}</p>
          </div>
        ) : todas.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No hay certificados guardados</div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-2">
              Total: <span className="font-bold">{todas.length}</span>
            </p>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {todas.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-lg border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{c.nombre_archivo}</h4>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Empleado:</span> {c.nombre_empleado} ({c.empleado_id})
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Subido:{' '}
                        {new Date(c.uploaded_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('auth_token');
                          const response = await fetch(routes.certificadosRetencionesDescargar(c.id), {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (!response.ok) throw new Error('Error al descargar');
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          const cd = response.headers.get('Content-Disposition');
                          const filename = cd
                            ? cd.split('filename=')[1]?.replace(/"/g, '') || c.nombre_archivo
                            : c.nombre_archivo;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          notify('error', 'Error', error.message);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r ${btnGrad} shadow-lg flex items-center gap-2 shrink-0`}
                    >
                      📥 Descargar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
