import React from 'react';
import { Eye } from 'lucide-react';
import type { ResumenEmpleado } from './HorasTrabajadas';

type EmployeeAlertsTableProps = {
  data: ResumenEmpleado[];
  onVerDetalle: (empleadoId: number) => void;
  onDescargarPDF: (empleadoId: number, mes: string) => void;
  loading?: boolean;
};

type AlertCounts = {
  total: number;
  positivos: number;
  negativos: number;
  hasData: boolean;
};

const normalizeDetalles = (rawDetalles: any): any[] => {
  if (!rawDetalles) {
    return [];
  }

  if (Array.isArray(rawDetalles)) {
    return rawDetalles;
  }

  if (typeof rawDetalles === 'string') {
    try {
      const parsed = JSON.parse(rawDetalles);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('⚠️ EmployeeAlertsTable - No se pudo parsear detalii_zilnice:', error);
      return [];
    }
  }

  return [];
};

const parseNumericValue = (value: any): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const calculateAlertCounts = (empleado: ResumenEmpleado): AlertCounts => {
  const detalles = normalizeDetalles((empleado as any).detaliiZilnice ?? (empleado as any).detalii_zilnice);
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return { total: 0, positivos: 0, negativos: 0, hasData: false };
  }

  let positivos = 0;
  let negativos = 0;

  detalles.forEach((detalle) => {
    const deltaValue = parseNumericValue(detalle?.delta);
    const excedenteRaw = Number.isFinite(deltaValue) ? Number(deltaValue) : (parseNumericValue(detalle?.excedente) ?? 0);

    if (!Number.isFinite(excedenteRaw) || excedenteRaw === 0) {
      return;
    }

    if (excedenteRaw > 0) {
      positivos += 1;
    } else {
      negativos += 1;
    }
  });

  return {
    total: positivos + negativos,
    positivos,
    negativos,
    hasData: positivos + negativos > 0
  };
};

const EmployeeAlertsTable: React.FC<EmployeeAlertsTableProps> = ({ data, onVerDetalle, onDescargarPDF, loading = false }) => {
  const rows = React.useMemo(() => {
    return data.map((empleado) => ({
      empleado,
      counts: calculateAlertCounts(empleado)
    }));
  }, [data]);

  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.counts.hasData) {
          acc.total += row.counts.total;
          acc.positivos += row.counts.positivos;
          acc.negativos += row.counts.negativos;
          acc.empleadosConAlertas += 1;
        }
        return acc;
      },
      { total: 0, positivos: 0, negativos: 0, empleadosConAlertas: 0 }
    );
  }, [rows]);

  const hasAnyData = rows.some((row) => row.counts.hasData);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando alertas...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Empleados con alertas</div>
          <div className="mt-2 text-3xl font-bold text-blue-700">{totals.empleadosConAlertas}</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide">Excedentes positivos</div>
          <div className="mt-2 text-3xl font-bold text-red-700">{totals.positivos}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
          <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Excedentes negativos</div>
          <div className="mt-2 text-3xl font-bold text-yellow-700">{totals.negativos}</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total días con alerta</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{totals.total}</div>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empleado</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Días con alerta</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Excedentes (+)</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Excedentes (-)</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map(({ empleado, counts }) => (
              <tr key={empleado.empleadoId} className="hover:bg-gray-50">
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{empleado.empleadoNombre}</div>
                  <div className="text-xs text-gray-500">ID: {empleado.empleadoId}</div>
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-center">
                  {counts.hasData ? (
                    <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                      {counts.total}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-center">
                  {counts.hasData ? (
                    <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">
                      +{counts.positivos}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-center">
                  {counts.hasData ? (
                    <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                      -{counts.negativos}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-center">
                  <button
                    onClick={() => onVerDetalle(empleado.empleadoId)}
                    className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors duration-200 mr-2"
                    title="Ver detalle"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => onDescargarPDF(empleado.empleadoId, empleado.mes)}
                    className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors duration-200"
                    title="Descargar PDF"
                  >
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-3 py-3 text-sm font-semibold text-gray-700">Totales</td>
              <td className="px-2 py-3 text-center text-sm font-semibold text-gray-700">
                {hasAnyData ? totals.total : '—'}
              </td>
              <td className="px-2 py-3 text-center text-sm font-semibold text-red-600">
                {hasAnyData ? `+${totals.positivos}` : '—'}
              </td>
              <td className="px-2 py-3 text-center text-sm font-semibold text-yellow-600">
                {hasAnyData ? `-${totals.negativos}` : '—'}
              </td>
              <td className="px-2 py-3 text-center text-sm text-gray-400">—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!loading && !hasAnyData && (
        <div className="text-center py-10 text-gray-500">
          No hay datos detallados de alertas disponibles para los empleados listados.
        </div>
      )}
    </div>
  );
};

export default EmployeeAlertsTable;

