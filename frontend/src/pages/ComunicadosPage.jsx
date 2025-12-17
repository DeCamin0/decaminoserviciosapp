import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { FileText, Plus, Eye, Calendar, User, CheckCircle, ArrowLeft, Paperclip, Send, Clock, Users } from 'lucide-react';
import Notification from '../components/ui/Notification';
import Modal from '../components/ui/Modal';

const ComunicadosPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fetchComunicados, fetchComunicado, loading, error } = useComunicadosApi();
  const [comunicados, setComunicados] = useState([]);
  const [notification, setNotification] = useState(null);
  const [showReadersModal, setShowReadersModal] = useState(false);
  const [selectedComunicado, setSelectedComunicado] = useState(null);

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

  const handleShowReaders = async (comunicadoId) => {
    try {
      const data = await fetchComunicado(comunicadoId);
      setSelectedComunicado(data);
      setShowReadersModal(true);
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al cargar lectores: ${err.message}`,
      });
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
                        {canManageComunicados() && (
                          <span
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              comunicado.publicado
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            }`}
                          >
                            {comunicado.publicado ? (
                              <>
                                <Send className="w-3 h-3" />
                                Publicado
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                Borrador
                              </>
                            )}
                          </span>
                        )}
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
                          <span>Autor: {canManageComunicados() ? (comunicado.autor_nombre || comunicado.autor_id) : 'Empresa'}</span>
                        </div>
                        {comunicado.leidos_count > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowReaders(comunicado.id);
                            }}
                            className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                            title="Ver quién ha leído"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>{comunicado.leidos_count} leídos</span>
                          </button>
                        )}
                        {comunicado.has_archivo && comunicado.nombre_archivo && (
                          <div className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                            <Paperclip className="w-4 h-4" />
                            <span>{comunicado.nombre_archivo}</span>
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

        {/* Modal pentru lista de cititori */}
        <Modal
          isOpen={showReadersModal}
          onClose={() => {
            setShowReadersModal(false);
            setSelectedComunicado(null);
          }}
          title="Usuarios que han leído"
          size="md"
        >
          {selectedComunicado && selectedComunicado.leidos ? (
            <div className="space-y-3">
              {selectedComunicado.leidos.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  Nadie ha leído este comunicado aún.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedComunicado.leidos.map((leido, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {leido.user_nombre || leido.user_id}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDateTime(leido.read_at)}
                          </p>
                        </div>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Cargando...</p>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default ComunicadosPage;

