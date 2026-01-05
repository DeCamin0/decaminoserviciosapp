import React, { useState } from 'react';
import ScheduleEditor from '../components/ScheduleEditor';
import { ScheduleData } from '../types/schedule';
import { useApi } from '../hooks/useApi';

// Date mock pentru teste
const mockCentros = [
  { id: 1, nombre: 'Bosquepino2' },
  { id: 2, nombre: 'Alvaro Lopez Costa' },
  { id: 3, nombre: 'Centro Norte' },
  { id: 4, nombre: 'Centro Sur' },
  { id: 5, nombre: 'Centro Este' }
];

const mockGrupos = [
  { id: 1, nombre: 'Limpiador' },
  { id: 2, nombre: 'Auxiliar' },
  { id: 3, nombre: 'Socorrista' },
  { id: 4, nombre: 'Supervisor' },
  { id: 5, nombre: 'Administrativo' }
];

const DemoSchedulePage: React.FC = () => {
  const { callApi } = useApi();
  const [lastSavedSchedule, setLastSavedSchedule] = useState<ScheduleData | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSave = (schedule: ScheduleData) => {
    console.log('📋 Horario guardado:', schedule);
    setLastSavedSchedule(schedule);
    showToast('success', 'Horario guardado exitosamente');
  };

  const handleError = (error: string) => {
    console.error('❌ Error al guardar horario:', error);
    showToast('error', `Error: ${error}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Demo - Editor de Horarios
          </h1>
          <p className="text-gray-600">
            Prueba la funcionalidad de creación de horarios de trabajo
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg max-w-md ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {toast.type === 'success' ? '✅' : '❌'}
              </span>
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Información de centros y grupos disponibles */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl shadow">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Centros disponibles:</h3>
            <ul className="space-y-1">
              {mockCentros.map(centro => (
                <li key={centro.id} className="text-sm text-gray-600">
                  • {centro.nombre}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Grupos disponibles:</h3>
            <ul className="space-y-1">
              {mockGrupos.map(grupo => (
                <li key={grupo.id} className="text-sm text-gray-600">
                  • {grupo.nombre}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Editor de horarios */}
        <ScheduleEditor
          centros={mockCentros}
          grupos={mockGrupos}
          callApi={callApi}
          onSave={handleSave}
          onError={handleError}
        />

        {/* Último horario guardado */}
        {lastSavedSchedule && (
          <div className="mt-8 bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              Último horario guardado:
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm text-gray-700 overflow-x-auto">
                {JSON.stringify(lastSavedSchedule, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Instrucciones de uso */}
        <div className="mt-8 bg-blue-50 p-6 rounded-xl">
          <h3 className="text-lg font-medium text-blue-800 mb-3">
            📋 Instrucciones de uso:
          </h3>
          <ul className="text-blue-700 space-y-2 text-sm">
            <li>• <strong>Completa los campos obligatorios:</strong> Nombre, Centro y Grupo</li>
            <li>• <strong>Configura los horarios:</strong> Puedes definir hasta 3 intervalos por día</li>
            <li>• <strong>Usa los botones de día:</strong> &quot;Copiar a toda la semana&quot; y &quot;Vaciar día&quot;</li>
            <li>• <strong>Valida los datos:</strong> Las entradas y salidas deben ser pares completos</li>
            <li>• <strong>Revisa el total:</strong> Se calcula automáticamente las horas semanales</li>
            <li>• <strong>Guarda el horario:</strong> Se enviará a n8n y aparecerá en consola</li>
          </ul>
        </div>

        {/* Ejemplo de uso */}
        <div className="mt-6 bg-green-50 p-6 rounded-xl">
          <h3 className="text-lg font-medium text-green-800 mb-3">
            💡 Ejemplo de uso:
          </h3>
          <div className="text-green-700 text-sm space-y-2">
            <p>
              <strong>1.</strong> Nombre: &quot;Limpieza Bosquepino&quot;<br/>
              <strong>2.</strong> Centro: &quot;Bosquepino2&quot;<br/>
              <strong>3.</strong> Grupo: &quot;Limpiador&quot;<br/>
              <strong>4.</strong> Configura Lunes: 08:00-16:00<br/>
              <strong>5.</strong> Haz clic en &quot;Copiar a toda la semana&quot;<br/>
              <strong>6.</strong> Guarda el horario
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoSchedulePage;
