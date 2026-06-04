import { useCallback, useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { routes } from '../utils/routes';

export default function PRLAutoevaluacionModal({ documento, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [preguntas, setPreguntas] = useState([]);
  const [minScore, setMinScore] = useState(8);
  const [testCompletado, setTestCompletado] = useState(false);
  const [testPuntuacion, setTestPuntuacion] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [resultado, setResultado] = useState(null);

  const loadTest = useCallback(async () => {
    if (!documento?.id) return;
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.prlAutoevaluacion(documento.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'No se pudo cargar la autoevaluación');
      }
      setPreguntas(Array.isArray(data.preguntas) ? data.preguntas : []);
      setMinScore(data.minScore ?? 8);
      setTestCompletado(Boolean(data.test_completado));
      setTestPuntuacion(data.test_puntuacion ?? null);
    } catch (err) {
      setError(err.message || 'Error al cargar la autoevaluación');
    } finally {
      setLoading(false);
    }
  }, [documento?.id]);

  useEffect(() => {
    loadTest();
  }, [loadTest]);

  const handleSelect = (questionId, option) => {
    setRespuestas((prev) => ({ ...prev, [String(questionId)]: option }));
  };

  const handleSubmit = async () => {
    const faltan = preguntas.filter((q) => !respuestas[String(q.id)]);
    if (faltan.length > 0) {
      setError(`Responde todas las preguntas (${faltan.length} pendiente(s)).`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setResultado(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.prlAutoevaluacion(documento.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ respuestas }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Error al enviar respuestas');
      }

      setResultado(data);
      if (data.aprobado) {
        setTestCompletado(true);
        setTestPuntuacion(data.puntuacion ?? null);
        if (onSuccess) onSuccess(data);
      }
    } catch (err) {
      setError(err.message || 'Error al enviar respuestas');
    } finally {
      setSubmitting(false);
    }
  };

  const formLocked = testCompletado && (!resultado || resultado.aprobado);
  const showSubmit = !formLocked;
  const showContinuar = formLocked;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Autoevaluación — Manual PRL"
      size="lg"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          <p className="font-semibold">{documento?.template_nombre || 'Manual PRL'}</p>
          <p className="mt-1">
            Lee el manual y responde las {preguntas.length || 10} preguntas. Necesitas al menos{' '}
            <strong>{minScore}</strong> respuestas correctas para poder firmar el documento.
          </p>
        </div>

        {loading && (
          <div className="text-center py-10 text-gray-500">Cargando preguntas…</div>
        )}

        {!loading && testCompletado && !resultado && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-900 text-sm">
            ✅ Autoevaluación completada
            {testPuntuacion != null ? ` (${testPuntuacion} respuestas correctas)` : ''}. Ya puedes
            firmar el documento.
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        {resultado && (
          <div
            className={`p-4 rounded-lg border text-sm ${
              resultado.aprobado
                ? 'bg-green-50 border-green-200 text-green-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {resultado.aprobado ? (
              <>
                <p className="font-semibold">¡Autoevaluación superada!</p>
                <p className="mt-1">
                  Has acertado {resultado.puntuacion} de {resultado.total}. Ya puedes firmar el
                  manual.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">No superada</p>
                <p className="mt-1">
                  Has acertado {resultado.puntuacion} de {resultado.total}. Se requieren al menos{' '}
                  {resultado.minScore}. Revisa el manual e inténtalo de nuevo.
                </p>
              </>
            )}
          </div>
        )}

        {!loading &&
          preguntas.map((q) => (
            <fieldset
              key={q.id}
              className="border border-gray-200 rounded-lg p-4 bg-white"
              disabled={formLocked}
            >
              <legend className="text-sm font-semibold text-gray-900 px-1">
                {q.id}. {q.text}
              </legend>
              <div className="mt-3 space-y-2">
                {Object.entries(q.options || {}).map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                      respuestas[String(q.id)] === key
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-transparent hover:bg-gray-50'
                    } ${formLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`pregunta-${q.id}`}
                      value={key}
                      checked={respuestas[String(q.id)] === key}
                      onChange={() => handleSelect(q.id, key)}
                      className="mt-1"
                      disabled={formLocked}
                    />
                    <span className="text-sm text-gray-800">
                      <strong className="uppercase">{key})</strong> {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cerrar
          </button>
          {showSubmit ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                loading ||
                !(preguntas.length > 0 && preguntas.every((q) => respuestas[String(q.id)]))
              }
              className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold"
            >
              {submitting ? 'Enviando…' : 'Enviar respuestas'}
            </button>
          ) : null}
          {showContinuar ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              Continuar para firmar
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
