import { useState } from 'react';
import { Modal, Button } from './ui';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes';
import { success, error as logError } from '../utils/logger';

const REASON_OPTIONS = [
  { value: 'OLVIDO_FICHAR', label: 'Olvidé fichar', description: 'Se requiere revisión del supervisor' },
  { value: 'AUSENCIA_INJUSTIFICADA', label: 'Ausencia injustificada', description: 'Se requiere revisión del supervisor' },
  { value: 'OTRO', label: 'Otro', description: 'Se requiere revisión del supervisor' },
];

export default function DeclararNoPunchModal({
  isOpen,
  onClose,
  onConfirm,
  data,
}) {
  const { callApi } = useApi();
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen || !data) return null;

  const { workday_date, scheduled_hours } = data;

  const handleConfirm = async () => {
    if (!selectedReason) {
      logError('Por favor, selecciona un motivo');
      return;
    }

    setLoading(true);
    try {
      const body = {
        workday_date,
        reason_code: selectedReason,
        notes: notes.trim() || undefined,
        // Dacă este specificat employee_codigo în data, îl folosim (pentru admin care regularizează pentru alt angajat)
        ...(data.employee_codigo && { employee_codigo: data.employee_codigo }),
      };

      const result = await callApi(routes.declararNoPunch, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (result.success) {
        const resultData = result.data || result;
        const message = resultData.message || 'Motivo registrado correctamente.';
        success(message);
        onConfirm?.(resultData);
        onClose();
        // Reset form
        setSelectedReason('');
        setNotes('');
      } else {
        const errorMsg = result.error || result.data?.message || 'Error desconocido';
        logError('Error declarando motivo:', errorMsg);
      }
    } catch (err) {
      logError('Error declarando motivo:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const selectedReasonOption = REASON_OPTIONS.find(r => r.value === selectedReason);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📝 Indicar motivo (Sin fichajes)"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Fecha:</strong> {workday_date}
          </p>
          {scheduled_hours && (
            <p className="text-sm text-yellow-800">
              <strong>Horario previsto:</strong> {scheduled_hours}
            </p>
          )}
          <p className="text-sm text-yellow-700 mt-2">
            No se encontraron fichajes para esta fecha. Por favor, indica el motivo.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motivo <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {REASON_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedReason === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={option.value}
                  checked={selectedReason === option.value}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Añade información adicional si es necesario..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {selectedReasonOption && (
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <p className="text-sm">
              ⚠️ Este motivo requiere revisión del supervisor.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || !selectedReason}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

