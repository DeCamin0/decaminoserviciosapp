import { useState } from 'react';
import { Modal, Button } from './ui';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes';
import { success, error as logError } from '../utils/logger';

export default function ConfirmarJornadaModal({
  isOpen,
  onClose,
  onConfirm,
  data,
}) {
  const { callApi } = useApi();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !data) return null;

  const { punched_minutes, scheduled_minutes, delta_minutes, fecha, employee_codigo } = data;

  // Funcție pentru formatare în "Xh Ym" (ex: "2h 48m")
  const formatMinutesToHours = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) {
      return `${mins}m`;
    }
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  const punchedHours = formatMinutesToHours(punched_minutes);
  const scheduledHours = formatMinutesToHours(scheduled_minutes);
  const deltaHours = formatMinutesToHours(Math.abs(delta_minutes));
  const isMore = delta_minutes > 0;

  const handleConfirm = async (userChoice, reason = null) => {
    setLoading(true);
    try {
      // Logica pentru decision și effective_minutes:
      // 
      // DELTA POZITIVĂ (+): punched > scheduled (ex: 8h29 vs 8h)
      //   - "No he trabajado más" (user_no) → decision='no_extra', effective=scheduled (8h)
      //   - "He trabajado más" (user_yes) → decision='worked_more', effective=punched (8h29)
      //
      // DELTA NEGATIVĂ (-): punched < scheduled (ex: 7h38 vs 8h)
      //   - "Sí, he trabajado menos" (user_yes) → decision='no_extra', effective=punched (7h38)
      //   - "No, fue error de fichaje" (user_no) → decision='no_extra', effective=scheduled (8h), reason='punch_error'
      //
      // Ambele cazuri de delta negativă sunt NO_EXTRA (user confirmă situația, nu declară extra)
      
      let decision;
      if (isMore) {
        // Delta pozitivă: user_yes = worked_more, user_no = no_extra
        decision = userChoice === 'user_yes' ? 'worked_more' : 'no_extra';
      } else {
        // Delta negativă: ambele sunt no_extra
        // Diferența e în effective_minutes (handled by backend via 'worked_less' flag)
        decision = 'no_extra';
      }
      
      const body = {
        employee_codigo,
        fecha,
        decision,
      };
      
      // Pentru delta negativă, adăugăm un flag pentru a diferenția între cele 2 cazuri
      if (!isMore) {
        if (userChoice === 'user_yes') {
          // "Sí, he trabajado menos" → effective = punched
          body.reason = 'worked_less';
        } else if (reason === 'punch_error') {
          // "No, fue error de fichaje" → effective = scheduled
          body.reason = 'punch_error';
        }
      }
      
      console.log('🔍 DEBUG ConfirmarJornadaModal - Sending request:', body, 'userChoice:', userChoice, 'isMore:', isMore);
      
      const result = await callApi(routes.confirmarJornada, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('🔍 DEBUG ConfirmarJornadaModal - Response:', {
        success: result.success,
        data: result.data,
        error: result.error,
        full_result: result
      });

      if (result.success) {
        const resultData = result.data || result; // callApi returnează { success: true, data }
        const message = decision === 'no_extra'
          ? 'Jornada confirmada correctamente.'
          : 'Jornada enviada para revisión.';
        
        success(message);
        onConfirm?.(resultData);
        onClose();
      } else {
        const errorMsg = result.error || result.data?.message || 'Error desconocido';
        logError('Error confirming jornada:', errorMsg);
      }
    } catch (err) {
      console.error('🔍 DEBUG ConfirmarJornadaModal - Exception:', err);
      logError('Error confirming jornada:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚠️ Confirmar Jornada"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Has fichado:</span>
              <p className="font-semibold text-lg text-blue-600">
                {punchedHours}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Horario previsto:</span>
              <p className="font-semibold text-lg text-green-600">
                {scheduledHours}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <span className="text-gray-600">Diferencia:</span>
            <p
              className={`font-bold text-lg ${
                isMore ? 'text-orange-600' : 'text-red-600'
              }`}
            >
              {isMore ? '+' : '-'}
              {deltaHours}
            </p>
          </div>
        </div>

        <div className="text-center">
          {isMore ? (
            <>
              <p className="text-gray-700 font-medium mb-4">
                ¿Has trabajado más horas de las previstas?
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => handleConfirm('user_no')}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  No he trabajado más
                </Button>
                <Button
                  onClick={() => handleConfirm('user_yes')}
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  He trabajado más
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-700 font-medium mb-4">
                ¿Has trabajado menos horas de las previstas?
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => handleConfirm('user_yes', null)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Sí, he trabajado menos
                </Button>
                <Button
                  onClick={() => handleConfirm('user_no', 'punch_error')}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  No, fue error de fichaje
                </Button>
              </div>
            </>
          )}
        </div>

        {loading && (
          <div className="text-center text-gray-500 text-sm">
            Procesando...
          </div>
        )}
      </div>
    </Modal>
  );
}

