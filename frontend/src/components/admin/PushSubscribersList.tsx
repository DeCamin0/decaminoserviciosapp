import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';
import { BASE_URL } from '../../utils/routes';

type Subscriber = {
  userId: string;
  nombre: string | null;
  centroTrabajo: string | null;
  subscriptionsCount: number;
  lastUpdatedAt: string | null;
};

export default function PushSubscribersList() {
  const { authToken, isAuthenticated } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubscribers() {
      try {
        setLoading(true);
        setError(null);

        const url = `${BASE_URL}/api/push/subscribers`;

        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authToken ? `Bearer ${authToken}` : '',
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Error al cargar suscriptores Push: ${res.status} ${text}`,
          );
        }

        const data = await res.json();

        setSubscribers(Array.isArray(data.items) ? data.items : []);
      } catch (err: any) {
        console.error('[PushSubscribersList] Error fetching subscribers:', err);
        setError(err.message || 'Error desconocido al cargar suscriptores');
      } finally {
        setLoading(false);
      }
    }

    if (authToken) {
      fetchSubscribers();
    } else {
      setLoading(false);
    }
  }, [authToken]);

  if (!isAuthenticated || !authToken) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <p className="text-sm text-gray-600">
          Debes iniciar sesión para ver los suscriptores de notificaciones
          Push.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
        <p className="text-sm text-gray-600">Cargando suscriptores Push...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-6">
        <p className="text-sm text-red-600 font-medium mb-2">
          Error al cargar suscriptores Push
        </p>
        <p className="text-xs text-gray-600 break-all">{error}</p>
      </div>
    );
  }

  if (subscribers.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <p className="text-sm text-gray-600">
          Ningún usuario tiene suscripción activa a notificaciones Push.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Suscriptores Push
          </h2>
          <p className="text-xs text-gray-500">
            Usuarios que tienen al menos una suscripción activa a
            notificaciones Push.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
          {subscribers.length} usuarios
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Código
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Empleado
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Centro
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Suscripciones
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Última actualización
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {subscribers.map((sub) => (
              <tr key={sub.userId} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs font-mono text-gray-800">
                  {sub.userId}
                </td>
                <td className="px-3 py-2 text-xs text-gray-900">
                  {sub.nombre || '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {sub.centroTrabajo || '—'}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-900">
                  {sub.subscriptionsCount}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {sub.lastUpdatedAt
                    ? new Date(sub.lastUpdatedAt).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


