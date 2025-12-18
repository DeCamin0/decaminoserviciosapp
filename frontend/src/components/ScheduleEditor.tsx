import React, { useState, useEffect } from 'react';
import { 
  ScheduleData, 
  DayKey, 
  TimeInterval,
  calcWeekMinutes,
  formatMinutes,
  validateDaySchedule,
  validateScheduleData,
  toMinutes
} from '../types/schedule';
import { createSchedule, updateSchedule } from '../api/schedules';

interface Centro {
  id: number;
  nombre: string;
}

interface Grupo {
  id: number;
  nombre: string;
}

interface ScheduleEditorProps {
  centros: Centro[];
  grupos: Grupo[];
  callApi?: any; // Funcția callApi din useApi hook
  onSave?: (schedule: ScheduleData) => void;
  onError?: (error: string) => void;
  initialData?: ScheduleData; // Datele inițiale pentru editare
  isEditMode?: boolean; // Indica dacă este modul de editare
}

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'L', label: 'Lunes' },
  { key: 'M', label: 'Martes' },
  { key: 'X', label: 'Miércoles' },
  { key: 'J', label: 'Jueves' },
  { key: 'V', label: 'Viernes' },
  { key: 'S', label: 'Sábado' },
  { key: 'D', label: 'Domingo' }
];

const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ centros, grupos, callApi, onSave, onError, initialData, isEditMode = false }) => {
  // State pentru formular
  const [formData, setFormData] = useState<ScheduleData>(initialData || {
    nombre: '',
    centroId: null,
    grupoId: null,
    vigenteDesde: null,
    vigenteHasta: null,
    weeklyBreakMinutes: 0,
    entryMarginMinutes: 0,
    exitMarginMinutes: 0,
    days: {
      L: { intervals: [{}, {}, {}] },
      M: { intervals: [{}, {}, {}] },
      X: { intervals: [{}, {}, {}] },
      J: { intervals: [{}, {}, {}] },
      V: { intervals: [{}, {}, {}] },
      S: { intervals: [{}, {}, {}] },
      D: { intervals: [{}, {}, {}] }
    }
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Helper pentru a normaliza datele ISO la format YYYY-MM-DD pentru input-uri de tip date
  const normalizeDateForInput = (date: string | null | undefined): string => {
    if (!date) return '';
    // Dacă e deja în format YYYY-MM-DD, returnează-l direct
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Dacă e în format ISO (2025-12-18T00:00:00.000Z), extrage doar partea de dată
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  };

  // Actualizează formularul când se schimbă initialData
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        vigenteDesde: normalizeDateForInput(initialData.vigenteDesde) || null,
        vigenteHasta: normalizeDateForInput(initialData.vigenteHasta) || null,
      });
    }
  }, [initialData]);

  // Calculează totalul de ore săptămânale
  const totalWeekMinutes = calcWeekMinutes(formData.days);
  const totalWeekMinutesWithBreak = Math.max(0, totalWeekMinutes - formData.weeklyBreakMinutes);

  // Calculează orele per turno (pe baza tipurilor unice de turnuri)
  const calculateHoursPerShift = () => {
    const shiftsMap = new Map<string, number>(); // map<"HH:MM-HH:MM", minutes>
    
    DAYS.forEach(day => {
      formData.days[day.key].intervals.forEach(interval => {
        if (interval.in && interval.out) {
          const inMinutes = toMinutes(interval.in);
          const outMinutes = toMinutes(interval.out);
          
          if (inMinutes !== null && outMinutes !== null) {
            let duration = outMinutes - inMinutes;
            // Pentru ture nocturne (peste miezul nopții)
            if (duration < 0) {
              duration = (24 * 60) + outMinutes - inMinutes;
            }
            
            const key = `${interval.in}-${interval.out}`;
            const currentMinutes = shiftsMap.get(key) || 0;
            
            // Numără câte zile din săptămână folosesc acest turn
            shiftsMap.set(key, currentMinutes + duration);
          }
        }
      });
    });
    
    // Convertim din minute în ore și găsim zilele care folosesc fiecare turn
    const result = Array.from(shiftsMap.entries()).map(([shiftTime, totalMinutes]) => {
      const [inTime, outTime] = shiftTime.split('-');
      const hours = (totalMinutes / 60).toFixed(2);
      
      // Câte zile din săptămână folosesc acest turn
      const daysCount = DAYS.filter(day => {
        return formData.days[day.key].intervals.some(interval => 
          interval.in === inTime && interval.out === outTime
        );
      }).length;
      
      return {
        shiftTime,
        inTime,
        outTime,
        hours: parseFloat(hours),
        totalMinutes,
        daysCount
      };
    });
    
    return result;
  };
  
  const shiftsBreakdown = calculateHoursPerShift();

  // Validează formularul
  const validateForm = (): boolean => {
    const validationErrors: string[] = [];
    
    // Validează datele de bază
    validationErrors.push(...validateScheduleData(formData));
    
    // Validează fiecare zi
    DAYS.forEach(day => {
      const dayErrors = validateDaySchedule(formData.days[day.key]);
      dayErrors.forEach(error => {
        validationErrors.push(`${day.label}: ${error}`);
      });
    });
    
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  // Gestionează schimbarea câmpurilor de bază
  const handleFieldChange = (field: keyof ScheduleData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Gestionează schimbarea intervalelor de timp
  const handleTimeChange = (day: DayKey, slotIndex: number, field: 'in' | 'out', value: string) => {
    setFormData(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: {
          ...prev.days[day],
          intervals: prev.days[day].intervals.map((interval, index) => 
            index === slotIndex 
              ? { ...interval, [field]: value }
              : interval
          )
        }
      }
    }));
  };

  // Copiază o zi pe toată săptămâna
  const copyDayToWeek = (sourceDay: DayKey) => {
    const sourceDayData = formData.days[sourceDay];
    setFormData(prev => ({
      ...prev,
      days: {
        L: sourceDayData,
        M: sourceDayData,
        X: sourceDayData,
        J: sourceDayData,
        V: sourceDayData,
        S: sourceDayData,
        D: sourceDayData
      }
    }));
  };

  // Golește o zi
  const clearDay = (day: DayKey) => {
    setFormData(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: { intervals: [{}, {}, {}] }
      }
    }));
  };

  // Gestionează salvarea
  const handleSave = async () => {
    if (!validateForm()) {
      showToastMessage('error', 'Por favor corrige los errores antes de guardar');
      return;
    }

    if (!callApi) {
      showToastMessage('error', 'callApi no está disponible');
      onError?.('callApi no está disponible');
      return;
    }

    setIsLoading(true);
    
    try {
      // Adaugă numele centro/grupo în payload pentru backend (în loc de id-uri)
      const centroNombre = centros.find(c => c.id === formData.centroId)?.nombre || null;
      const grupoNombre = grupos.find(g => g.id === formData.grupoId)?.nombre || null;

      // Calculează totalul de minute/ore săptămânale (după descanso)
      const totalMinutes = Math.max(0, totalWeekMinutes - formData.weeklyBreakMinutes);

      const payload = { 
        ...formData, 
        centroId: centroNombre, // trimite numele în loc de id
        grupoId: grupoNombre,   // trimite numele în loc de id
        centroNombre, 
        grupoNombre,
        totalWeekMinutes: totalMinutes,
        totalWeekHours: Number((totalMinutes / 60).toFixed(2))
      } as any;

      const result = isEditMode 
        ? await updateSchedule(callApi, payload.id || payload.nombre || 'unknown', payload) 
        : await createSchedule(callApi, payload);
      
      if (result.success) {
        const backendMsg = (result.data as any)?.message || result.message || (isEditMode ? 'Horario actualizado' : 'Horario creado');
        const backendName = (result.data as any)?.nombre || payload.nombre || '';
        showToastMessage('success', `✅ ${backendMsg}${backendName ? `: ${backendName}` : ''}`);
        onSave?.(payload);
      } else {
        const backendMsg = result.message || result.error || (isEditMode ? 'Error al actualizar el horario' : 'Error al guardar el horario');
        showToastMessage('error', `❌ ${backendMsg}`);
        onError?.(backendMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      showToastMessage('error', `❌ ${errorMessage.includes('Failed to fetch') ? 'No se pudo conectar con el servidor' : errorMessage}`);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Afișează toast
  const showToastMessage = (type: 'success' | 'error', message: string) => {
    setShowToast({ type, message });
    setTimeout(() => setShowToast(null), 5000);
  };

  // Renderizează un interval de timp
  const renderTimeInterval = (day: DayKey, slotIndex: number, interval: TimeInterval) => {
    const slotErrors = validateDaySchedule(formData.days[day]).filter(error => 
      error.includes(`Slot ${slotIndex + 1}`)
    );

    const inId = `schedule-${day}-${slotIndex}-entrada`;
    const outId = `schedule-${day}-${slotIndex}-salida`;

    return (
      <div key={slotIndex} className="flex gap-2 items-center">
        <div className="flex-1">
          <label
            htmlFor={inId}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Entrada
          </label>
          <input
            id={inId}
            name={inId}
            type="time"
            value={interval.in || ''}
            onChange={(e) => handleTimeChange(day, slotIndex, 'in', e.target.value)}
            className={`w-full px-2 py-1 border rounded-lg text-sm ${
              slotErrors.length > 0 ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Entrada"
          />
        </div>
        <span className="text-gray-500">-</span>
        <div className="flex-1">
          <label
            htmlFor={outId}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Salida
          </label>
          <input
            id={outId}
            name={outId}
            type="time"
            value={interval.out || ''}
            onChange={(e) => handleTimeChange(day, slotIndex, 'out', e.target.value)}
            className={`w-full px-2 py-1 border rounded-lg text-sm ${
              slotErrors.length > 0 ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Salida"
          />
        </div>
        {slotErrors.length > 0 && (
          <div className="text-red-500 text-xs">
            {slotErrors[0].replace(`Slot ${slotIndex + 1}: `, '')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Editor de Horarios</h2>
        <p className="text-gray-600">Gestiona los horarios de trabajo para empleados</p>
      </div>

      {/* Toast */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
          showToast.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {showToast.message}
        </div>
      )}

      {/* Formular principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Nombre del horario */}
        <div>
          <label
            htmlFor="schedule-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nombre del horario *
          </label>
          <input
            id="schedule-name"
            name="scheduleName"
            type="text"
            value={formData.nombre}
            onChange={(e) => handleFieldChange('nombre', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Ej: Limpieza Bosquepino"
          />
        </div>

        {/* Centro */}
        <div>
          <label
            htmlFor="schedule-centro"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Centro *
          </label>
          <select
            id="schedule-centro"
            name="scheduleCentro"
            value={formData.centroId || ''}
            onChange={(e) => handleFieldChange('centroId', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Selecciona un centro</option>
            {centros.map(centro => (
              <option key={centro.id} value={centro.id}>
                {centro.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Grupo */}
        <div>
          <label
            htmlFor="schedule-grupo"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Grupo *
          </label>
          <select
            id="schedule-grupo"
            name="scheduleGrupo"
            value={formData.grupoId || ''}
            onChange={(e) => handleFieldChange('grupoId', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Selecciona un grupo</option>
            {grupos.map(grupo => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Vigente desde */}
        <div>
          <label
            htmlFor="schedule-vigente-desde"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Vigente desde
          </label>
          <input
            id="schedule-vigente-desde"
            name="vigenteDesde"
            type="date"
            value={normalizeDateForInput(formData.vigenteDesde)}
            onChange={(e) => handleFieldChange('vigenteDesde', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* Vigente hasta */}
        <div>
          <label
            htmlFor="schedule-vigente-hasta"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Vigente hasta
          </label>
          <input
            id="schedule-vigente-hasta"
            name="vigenteHasta"
            type="date"
            value={normalizeDateForInput(formData.vigenteHasta)}
            onChange={(e) => handleFieldChange('vigenteHasta', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* Descanso semanal */}
        <div>
          <label
            htmlFor="schedule-weekly-break"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Descanso semanal (min)
          </label>
          <input
            id="schedule-weekly-break"
            name="weeklyBreakMinutes"
            type="number"
            min="0"
            value={formData.weeklyBreakMinutes}
            onChange={(e) => handleFieldChange('weeklyBreakMinutes', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* Margen entrada */}
        <div>
          <label
            htmlFor="schedule-entry-margin"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Margen entrada (min)
          </label>
          <input
            id="schedule-entry-margin"
            name="entryMarginMinutes"
            type="number"
            min="0"
            value={formData.entryMarginMinutes}
            onChange={(e) => handleFieldChange('entryMarginMinutes', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* Margen salida */}
        <div>
          <label
            htmlFor="schedule-exit-margin"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Margen salida (min)
          </label>
          <input
            id="schedule-exit-margin"
            name="exitMarginMinutes"
            type="number"
            min="0"
            value={formData.exitMarginMinutes}
            onChange={(e) => handleFieldChange('exitMarginMinutes', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
      </div>

      {/* Horas semanales per turno */}
      {shiftsBreakdown.length > 0 ? (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-medium text-gray-800">
              Horas semanales per turno:
            </span>
            <span className="text-xl font-bold text-blue-600">
              Total: {formatMinutes(totalWeekMinutesWithBreak)}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shiftsBreakdown.map((shift, index) => (
              <div key={index} className="bg-white p-3 rounded-lg border-2 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600">
                    Turno {index + 1}
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {shift.hours}h
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {shift.inTime} - {shift.outTime}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {shift.daysCount} días/semana
                </div>
              </div>
            ))}
          </div>
          
          {formData.weeklyBreakMinutes > 0 && (
            <div className="text-sm text-gray-600 mt-3 pt-3 border-t border-blue-200">
              Descanso semanal: {formatMinutes(formData.weeklyBreakMinutes)}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium text-gray-800">
              Horas semanales per turno:
            </span>
            <span className="text-2xl font-bold text-blue-600">
              {formatMinutes(totalWeekMinutesWithBreak)}
            </span>
          </div>
          {formData.weeklyBreakMinutes > 0 && (
            <div className="text-sm text-gray-600 mt-1">
              Descanso semanal: {formatMinutes(formData.weeklyBreakMinutes)}
            </div>
          )}
        </div>
      )}

      {/* Grila pentru zile */}
      <div className="space-y-4">
        {DAYS.map(day => (
          <div key={day.key} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-800">{day.label}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copyDayToWeek(day.key)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Copiar a toda la semana
                </button>
                <button
                  onClick={() => clearDay(day.key)}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Vaciar día
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              {formData.days[day.key].intervals.map((interval, index) => 
                renderTimeInterval(day.key, index, interval)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Erori de validare */}
      {errors.length > 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <h4 className="text-red-800 font-medium mb-2">Errores de validación:</h4>
          <ul className="text-red-700 text-sm space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Butoane de acțiune */}
      <div className="mt-8 flex justify-end gap-4">
        <button
          onClick={() => {
            setFormData({
              nombre: '',
              centroId: null,
              grupoId: null,
              vigenteDesde: null,
              vigenteHasta: null,
              weeklyBreakMinutes: 0,
              entryMarginMinutes: 0,
              exitMarginMinutes: 0,
              days: {
                L: { intervals: [{}, {}, {}] },
                M: { intervals: [{}, {}, {}] },
                X: { intervals: [{}, {}, {}] },
                J: { intervals: [{}, {}, {}] },
                V: { intervals: [{}, {}, {}] },
                S: { intervals: [{}, {}, {}] },
                D: { intervals: [{}, {}, {}] }
              }
            });
            setErrors([]);
          }}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Limpiar
        </button>
        
        <button
          onClick={handleSave}
          disabled={isLoading || errors.length > 0}
          className={`px-8 py-2 rounded-xl font-medium transition-colors ${
            isLoading || errors.length > 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {isLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
};

export default ScheduleEditor;
