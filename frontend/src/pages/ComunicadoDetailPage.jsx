import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import {
  ArrowLeft,
  Calendar,
  User,
  Edit,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import Notification from '../components/ui/Notification';

const ComunicadoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchComunicado, markAsRead, deleteComunicado, loading, error } =
    useComunicadosApi();
  const [comunicado, setComunicado] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isMarkedAsRead, setIsMarkedAsRead] = useState(false);

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

  const loadComunicado = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchComunicado(id);
      setComunicado(data);

      // Verifică dacă user-ul a citit deja comunicado-ul
      const currentUserId = user?.CODIGO || user?.codigo || user?.userId;
      const isRead = data.leidos?.some(
        (l) => l.user_id === String(currentUserId),
      );
      setIsMarkedAsRead(isRead);

      // Marchează ca citit dacă nu a fost citit deja
      if (!isRead && currentUserId) {
        try {
          await markAsRead(id);
          setIsMarkedAsRead(true);
        } catch (err) {
          // Nu aruncăm eroare dacă marcarea ca citit eșuează
          console.warn('Error marking as read:', err);
        }
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al cargar comunicado: ${err.message}`,
      });
    }
  }, [id, fetchComunicado, markAsRead, user]);

  useEffect(() => {
    loadComunicado();
  }, [loadComunicado]);

  const handleDelete = async () => {
    if (
      !window.confirm(
        '¿Estás seguro de que deseas eliminar este comunicado? Esta acción no se puede deshacer.',
      )
    ) {
      return;
    }

    try {
      await deleteComunicado(id);
      setNotification({
        type: 'success',
        message: 'Comunicado eliminado con éxito',
      });
      setTimeout(() => {
        navigate('/comunicados');
      }, 1500);
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al eliminar comunicado: ${err.message}`,
      });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Cargando comunicado...
          </p>
        </div>
      </div>
    );
  }

  if (error || !comunicado) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/comunicados')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Comunicados
          </button>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-800 dark:text-red-200">
              {error || 'Comunicado no encontrado'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Notification */}
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Back Button */}
        <button
          onClick={() => navigate('/comunicados')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Comunicados
        </button>

        {/* Comunicado Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {comunicado.titulo}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(comunicado.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>Autor: {comunicado.autor_id}</span>
                </div>
                {isMarkedAsRead && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Leído</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions (Admin only) */}
            {canManageComunicados() && (
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => navigate(`/comunicados/${id}/editar`)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="prose dark:prose-invert max-w-none">
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {comunicado.contenido}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComunicadoDetailPage;

