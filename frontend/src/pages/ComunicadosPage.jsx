import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { PageHeader, AlertBanner, Modal, Notification } from '../components/ui';
import {
  Plus,
  Eye,
  Calendar,
  User,
  CheckCircle,
  Paperclip,
  RefreshCw,
} from 'lucide-react';

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
    const timer = setTimeout(() => {
      loadComunicados();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadComunicados]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPreview = (contenido) => {
    if (!contenido) return '';
    return contenido.length > 120 ? `${contenido.substring(0, 120)}…` : contenido;
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="app-page comunicados-page">
      <PageHeader
        title="Comunicados"
        subtitle="Anuncios y comunicaciones oficiales"
        backTo="/inicio"
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadComunicados} disabled={loading} className="solicitud-admin-btn" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            {canManageComunicados() && (
              <button
                type="button"
                onClick={() => navigate('/comunicados/nuevo')}
                className="solicitud-admin-btn solicitud-admin-btn--primary"
              >
                <Plus className="w-4 h-4" aria-hidden />
                <span>Nuevo</span>
              </button>
            )}
          </div>
        )}
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {loading ? (
        <AlertBanner variant="loading" loading>Cargando comunicados...</AlertBanner>
      ) : error ? (
        <AlertBanner variant="danger" title="Error">{error}</AlertBanner>
      ) : comunicados.length === 0 ? (
        <AlertBanner variant="info" title="No hay comunicados disponibles">
          Cuando haya anuncios oficiales, aparecerán aquí.
        </AlertBanner>
      ) : (
        <div className="solicitud-admin-mobile-list">
          {comunicados.map((comunicado) => (
            <article
              key={comunicado.id}
              className="solicitud-admin-mobile-card cursor-pointer"
              onClick={() => navigate(`/comunicados/${comunicado.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/comunicados/${comunicado.id}`)}
              role="button"
              tabIndex={0}
            >
              <div className="solicitud-admin-mobile-card__head">
                <div className="min-w-0 flex-1">
                  <h2 className="solicitud-admin-mobile-card__title">{comunicado.titulo}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                    {getPreview(comunicado.contenido)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {canManageComunicados() && (
                    <span className={`solicitud-status ${comunicado.publicado ? 'solicitud-status--ok' : 'solicitud-status--pendiente'}`}>
                      {comunicado.publicado ? 'Publicado' : 'Borrador'}
                    </span>
                  )}
                  <Eye className="w-4 h-4 text-gray-400" aria-hidden />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" aria-hidden />
                  {formatDate(comunicado.created_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="w-3.5 h-3.5" aria-hidden />
                  {canManageComunicados() ? (comunicado.autor_nombre || comunicado.autor_id) : 'Empresa'}
                </span>
                {comunicado.has_archivo && comunicado.nombre_archivo && (
                  <span className="inline-flex items-center gap-1 truncate max-w-[10rem]">
                    <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{comunicado.nombre_archivo}</span>
                  </span>
                )}
                {canManageComunicados() && comunicado.leidos_count > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowReaders(comunicado.id);
                    }}
                    className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                    title="Ver quién ha leído"
                  >
                    <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                    {comunicado.leidos_count} leídos
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showReadersModal}
          onClose={() => { setShowReadersModal(false); setSelectedComunicado(null); }}
          title="Usuarios que han leído"
          showCloseButton={false}
          size="md"
          className="app-modal--form"
          footer={(
            <button type="button" onClick={() => { setShowReadersModal(false); setSelectedComunicado(null); }} className="app-modal__btn">
              Cerrar
            </button>
          )}
        >
          {selectedComunicado && selectedComunicado.leidos ? (
            selectedComunicado.leidos.length === 0 ? (
              <AlertBanner variant="info">Nadie ha leído este comunicado aún.</AlertBanner>
            ) : (
              <div className="solicitud-admin-mobile-list max-h-96 overflow-y-auto">
                {selectedComunicado.leidos.map((leido, index) => (
                  <div key={index} className="solicitud-admin-mobile-card flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {leido.user_nombre || leido.user_id}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(leido.read_at)}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" aria-hidden />
                  </div>
                ))}
              </div>
            )
          ) : (
            <AlertBanner variant="loading" loading>Cargando...</AlertBanner>
          )}
        </Modal>,
        document.body
      )}
    </div>
  );
};

export default ComunicadosPage;
