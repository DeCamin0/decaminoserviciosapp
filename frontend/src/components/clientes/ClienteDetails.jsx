import { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui';
import { routes } from '../../utils/routes';

export default function ClienteDetails({ cliente }) {
  const [centrosTrabajo, setCentrosTrabajo] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRelatedData = useCallback(async () => {
    if (!cliente) {
      return;
    }
    setLoading(true);
    try {
      // ✅ MIGRAT: folosim backend /api/clientes pentru centre de lucru
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const centrosResponse = await fetch(routes.getClientes, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });
      const centrosData = await centrosResponse.json();
      // Centrele de lucru sunt clienții care se potrivesc cu NIF sau nume
      const centrosCliente = Array.isArray(centrosData) ? 
        centrosData.filter(centro => 
          centro.NIF === cliente.NIF || 
          centro['NOMBRE O RAZON SOCIAL'] === cliente['NOMBRE O RAZON SOCIAL'] ||
          centro['NOMBRE O RAZÓN SOCIAL'] === cliente['NOMBRE O RAZON SOCIAL']
        ).map(centro => ({
          nombre: centro['NOMBRE O RAZON SOCIAL'] || centro['NOMBRE O RAZÓN SOCIAL'],
          direccion: centro.DIRECCIÓN || centro.DIRECCION,
          cliente_id: centro.NIF
        })) : [];
      setCentrosTrabajo(centrosCliente);

      // ✅ MIGRAT: folosim backend /api/empleados pentru angajați
      const empleadosResponse = await fetch(routes.getEmpleados, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });
      const empleadosData = await empleadosResponse.json();
      // Angajații care lucrează la acest client (filtrat după CENTRO TRABAJO)
      const clienteNombre = cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'];
      const empleadosCliente = Array.isArray(empleadosData) ? 
        empleadosData.filter(emp => {
          const centroTrabajo = emp['CENTRO TRABAJO'] || emp.CENTRO_TRABAJO || emp.centro || '';
          return centroTrabajo && centroTrabajo.includes(clienteNombre);
        }) : [];
      setEmpleados(empleadosCliente);
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
    setLoading(false);
  }, [cliente]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  return (
    <div className="space-y-6">
      {/* Informații de bază */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="p-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Información básica</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Nombre:</span>
                <span className="font-medium">{cliente['NOMBRE O RAZÓN SOCIAL'] || cliente['NOMBRE O RAZON SOCIAL']}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">NIF/CIF:</span>
                <span className="font-medium">{cliente.NIF}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{cliente.EMAIL || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Teléfono:</span>
                <span className="font-medium">{cliente.TELEFONO || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Móvil:</span>
                <span className="font-medium">{cliente.MÓVIL || cliente.MOVIL || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">FAX:</span>
                <span className="font-medium">{cliente.FAX || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Descuento:</span>
                <span className="font-medium">{cliente['DESCUENTO POR DEFECTO'] || '0.00'}%</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Dirección</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Dirección:</span>
                <span className="font-medium">{cliente.DIRECCIÓN || cliente.DIRECCION || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Código postal:</span>
                <span className="font-medium">{cliente.CODIGO_POSTAL || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ciudad:</span>
                <span className="font-medium">{cliente.POBLACIÓN || cliente.POBLACION || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Provincia:</span>
                <span className="font-medium">{cliente.PROVINCIA || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">País:</span>
                <span className="font-medium">{cliente.PAÍS || cliente.PAIS || 'N/A'}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Informații suplimentare */}
      <Card>
        <div className="p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Información adicional</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">URL:</span>
                <span className="font-medium">
                  {cliente.URL ? (
                    <a href={`https://${cliente.URL.split(';')[0]}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {cliente.URL.split(';')[0]}
                    </a>
                  ) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Latitud:</span>
                <span className="font-medium">{cliente.LATITUD || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Longitud:</span>
                <span className="font-medium">{cliente.LONGITUD || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha creación:</span>
                <span className="font-medium">{formatDate(cliente.fecha_creacion)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha actualización:</span>
                <span className="font-medium">{formatDate(cliente.fecha_actualizacion)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cuentas bancarias:</span>
                <span className="font-medium">{cliente['CUENTAS BANCARIAS'] || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Notas privadas:</span>
                <span className="font-medium">{cliente['NOTAS PRIVADAS'] || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className="font-medium">{cliente.ESTADO || 'Activo'}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Centre de lucru asociate */}
      <Card>
        <div className="p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">
            Centros de trabajo ({centrosTrabajo.length})
          </h4>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : centrosTrabajo.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No hay centros de trabajo asociados con este cliente.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {centrosTrabajo.map((centro, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="font-medium">{centro.nombre || centro.name}</div>
                  <div className="text-sm text-gray-600">{centro.direccion || centro.address}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Angajați care lucrează la acest client */}
      <Card>
        <div className="p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">
            Empleados ({empleados.length})
          </h4>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : empleados.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No hay empleados que trabajen para este cliente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grupo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Centro</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {empleados.map((empleado, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium">{empleado['NOMBRE / APELLIDOS'] || empleado.nombre}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          empleado.GRUPO === 'Manager' || empleado.grupo === 'Manager'
                            ? 'bg-blue-100 text-blue-800'
                            : empleado.GRUPO === 'Supervisor' || empleado.grupo === 'Supervisor'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {empleado.GRUPO || empleado.grupo || 'Empleado'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {empleado['CENTRO TRABAJO'] || empleado.centro || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {empleado['CORREO ELECTRONICO'] || empleado.email || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
} 