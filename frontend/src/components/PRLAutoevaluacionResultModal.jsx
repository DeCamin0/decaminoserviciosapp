import { useCallback, useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { routes } from '../utils/routes';

/**
 * Muestra las respuestas de autoevaluación PRL (admin o empleado).
 * @param {{ documentoId: number, admin?: boolean, onClose: () => void }} props
 */
export default function PRLAutoevaluacionResultModal({
  documentoId,
  admin = false,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const loadResultado = useCallback(async () => {
    if (!documentoId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const url = admin
        ? routes.prlAutoevaluacionResultadoAdmin(documentoId)
        : routes.prlAutoevaluacionResultado(documentoId);
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.message || 'No se pudo cargar el resultado del test');
      }
      setData(json);
    } catch (err) {
      setError(err.message || 'Error al cargar respuestas');
    } finally {
      setLoading(false);
    }
  }, [documentoId, admin]);

  useEffect(() => {
    loadResultado();
  }, [loadResultado]);

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Respuestas autoevaluación PRL"
      size="lg"
      className="text-gray-900"
    >
      {loading && (
        <p className="text-sm text-gray-700 py-6 text-center">Cargando respuestas…</p>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-900 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4 text-gray-900">
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-gray-900 space-y-1">
            {admin && (
              <p className="text-gray-900">
                <span className="font-semibold text-gray-900">Empleado:</span>{' '}
                {data.empleado_nombre}{' '}
                <span className="text-gray-600">({data.empleado_id})</span>
              </p>
            )}
            <p className="text-gray-900">
              <span className="font-semibold">Documento:</span> {data.documento_nombre}
            </p>
            <p className="text-gray-900">
              <span className="font-semibold">Puntuación:</span>{' '}
              {data.test_puntuacion ?? '—'} / {data.total} (mínimo {data.minScore})
            </p>
            <p className="text-gray-900">
              <span className="font-semibold">Completado:</span>{' '}
              {formatDate(data.test_fecha_completado)}
            </p>
          </div>

          {!data.respuestas_disponibles && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 text-sm">
              Las respuestas detalladas no están guardadas para este test (completado antes de
              esta función). Solo se muestra la puntuación.
            </div>
          )}

          {data.respuestas_disponibles && (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {(data.revision || []).map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border text-sm text-gray-900 ${
                    item.correcta
                      ? 'border-green-300 bg-green-100'
                      : 'border-red-300 bg-red-100'
                  }`}
                >
                  <div className="font-semibold text-gray-900 mb-2 leading-snug">
                    {index + 1}. {item.text}
                  </div>
                  <p className="text-gray-900 leading-relaxed">
                    <span className="font-semibold">Respuesta:</span>{' '}
                    {item.respuesta_texto || item.respuesta_empleado || '—'}
                    <span
                      className={`ml-2 text-xs font-bold ${
                        item.correcta ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {item.correcta ? '✓ Correcta' : '✗ Incorrecta'}
                    </span>
                  </p>
                  {admin && item.respuesta_correcta_texto && !item.correcta && (
                    <p className="mt-2 text-gray-800 leading-relaxed">
                      <span className="font-semibold">Respuesta correcta:</span>{' '}
                      {item.respuesta_correcta
                        ? `${String(item.respuesta_correcta).toUpperCase()}) `
                        : ''}
                      {item.respuesta_correcta_texto}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
