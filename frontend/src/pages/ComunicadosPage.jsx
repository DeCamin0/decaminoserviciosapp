import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { FileText, Plus, Eye, Calendar, User, CheckCircle, ArrowLeft } from 'lucide-react';
import Notification from '../components/ui/Notification';

const ComunicadosPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fetchComunicados, loading, error } = useComunicadosApi();
  const [comunicados, setComunicados] = useState([]);
  const [notification, setNotification] = useState(null);

  const canManageComunicados = () => {
    const grupo = user?.GRUPO || user?.grupo || '';
    const grupoUpper = grupo.toUpperCase();
    return (
      grupoUpper === 'DEVELOPER' ||
      grupoUpper === 'ADMIN' ||
      grupoUpper === 'SUPERVISOR' ||
      grupoUpper === 'MANAGER' ||
      grupoUpper === 'RRHH'
    );
  };

  const loadComunicados = useCallback(async () => {
    try {
      const data = await fetchComunicados();
      setComunicados(data);
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al cargar comunicados: ${err.message}`,
      });
    }
  }, [fetchComunicados]);

  useEffect(() => {
    loadComunicados();
  }, [loadComunicados]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPreview = (contenido) => {
    if (!contenido) return '';
    return contenido.length > 150
      ? `${contenido.substring(0, 150)}...`
      : contenido;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/inicio')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </button>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Comunicados
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Anuncios y comunicaciones oficiales
            </p>
          </div>
          {canManageComunicados() && (
            <button
              onClick={() => navigate('/comunicados/nuevo')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo Comunicado
            </button>
          )}
        </div>

        {/* Notification */}
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Cargando comunicados...
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Comunicados List */}
        {!loading && !error && (
          <div className="space-y-4">
            {comunicados.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  No hay comunicados disponibles
                </p>
              </div>
            ) : (
              comunicados.map((comunicado) => (
                <div
                  key={comunicado.id}
                  onClick={() => navigate(`/comunicados/${comunicado.id}`)}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {comunicado.titulo}
                        </h2>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {getPreview(comunicado.contenido)}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(comunicado.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>Autor: {comunicado.autor_id}</span>
                        </div>
                        {comunicado.leidos_count > 0 && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>{comunicado.leidos_count} leídos</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Eye className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComunicadosPage;

