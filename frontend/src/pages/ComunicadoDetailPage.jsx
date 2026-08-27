import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { config } from '../config/env';
import { PageHeader, AlertBanner, Modal, Notification } from '../components/ui';
import {
  Calendar,
  User,
  Edit,
  Trash2,
  CheckCircle,
  Paperclip,
  Download,
  Send,
  Users,
  Eye,
} from 'lucide-react';
import ConfirmModal from '../components/ui/ConfirmModal';
import PDFViewerAndroid from '../components/PDFViewerAndroid';

// Helper function pentru a converti Blob la Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const ComunicadoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    fetchComunicado,
    markAsRead,
    deleteComunicado,
    publicarComunicado,
    notifyComunicado,
    loading,
    error,
  } = useComunicadosApi();

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
  const [comunicado, setComunicado] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isMarkedAsRead, setIsMarkedAsRead] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showReadersModal, setShowReadersModal] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);

  // Detectare iOS/Android pentru preview
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);

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

  const handlePublish = async () => {
    setShowPublishModal(true);
  };

  const confirmPublish = async () => {
    try {
      await publicarComunicado(id);
      setNotification({
        type: 'success',
        message: 'Comunicado publicado con éxito. Se ha enviado una notificación push a todos los empleados.',
      });
      // Recargar comunicado para actualizar estado
      await loadComunicado();
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al publicar comunicado: ${err.message}`,
      });
    }
  };

  const handleNotify = async () => {
    if (!comunicado?.publicado) {
      setNotification({
        type: 'error',
        message:
          'Este comunicado aún no está publicado. Solo se pueden notificar comunicados publicados.',
      });
      return;
    }
    setShowNotifyModal(true);
  };

  const confirmNotify = async () => {
    try {
      setIsNotifying(true);
      const result = await notifyComunicado(id);
      const sent = result?.pushResult?.sent;
      const total = result?.pushResult?.total;

      let message = result?.message;
      if (typeof sent === 'number' && typeof total === 'number') {
        message = `Notificación reenviada: ${sent} de ${total} empleados con notificaciones activas.`;
      }

      setNotification({
        type: 'success',
        message:
          message ||
          'Notificación reenviada con éxito a los empleados con notificaciones activas.',
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al reenviar la notificación: ${err.message}`,
      });
    } finally {
      setIsNotifying(false);
      setShowNotifyModal(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
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

  const handlePreviewFile = async () => {
    if (!comunicado.has_archivo || !comunicado.nombre_archivo) return;

    setPreviewLoading(true);
    setShowFilePreview(true);

    try {
      const BASE_URL = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
      
      const downloadUrl = `${BASE_URL}/api/comunicados/${id}/download`;
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Accept': 'application/pdf, application/json, image/*, */*',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(downloadUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const fileName = comunicado.nombre_archivo.toLowerCase();
      const isPdf = fileName.endsWith('.pdf') || contentType.includes('application/pdf');
      const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) || contentType.startsWith('image/');

      if (isImage) {
        // Pentru imagini, convertim la base64 pentru a evita problemele CORB
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        const mimeType = blob.type || 'image/png';
        setPreviewData({
          fileName: comunicado.nombre_archivo,
          previewUrl: `data:${mimeType};base64,${base64}`,
          isPdf: false,
          isImage: true,
        });
      } else if (isPdf) {
        // Pentru PDF-uri
        const blob = await response.blob();
        
        if (blob.size === 0) {
          throw new Error('El archivo PDF está vacío');
        }

        // Pentru iOS folosim base64, pentru Android/Desktop folosim blob URL
        const url = isIOS
          ? `data:application/pdf;base64,${await blobToBase64(blob)}`
          : URL.createObjectURL(blob);

        setPreviewData({
          fileName: comunicado.nombre_archivo,
          previewUrl: url,
          isPdf: true,
          isImage: false,
        });
      } else {
        // Pentru alte tipuri de fișiere, arătăm mesaj
        setPreviewData({
          fileName: comunicado.nombre_archivo,
          previewUrl: null,
          isPdf: false,
          isImage: false,
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al cargar preview: ${err.message}`,
      });
      setShowFilePreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = useCallback(() => {
    setPreviewData((current) => {
      if (
        current?.previewUrl &&
        typeof current.previewUrl === 'string' &&
        current.previewUrl.startsWith('blob:')
      ) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
    setShowFilePreview(false);
  }, []);

  useEffect(() => {
    if (!showFilePreview) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClosePreview();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showFilePreview, handleClosePreview]);

  // Cleanup blob URLs când componenta se unmount sau previewData se schimbă
  useEffect(() => {
    return () => {
      if (previewData?.previewUrl && typeof previewData.previewUrl === 'string' && previewData.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewData.previewUrl);
      }
    };
  }, [previewData]);

  if (loading) {
    return (
      <div className="app-page comunicados-page">
        <PageHeader title="Comunicado" backTo="/comunicados" />
        <AlertBanner variant="loading" loading>Cargando comunicado...</AlertBanner>
      </div>
    );
  }

  if (error || !comunicado) {
    return (
      <div className="app-page comunicados-page">
        <PageHeader title="Comunicado" backTo="/comunicados" />
        <AlertBanner variant="danger" title="Error">{error || 'Comunicado no encontrado'}</AlertBanner>
      </div>
    );
  }

  return (
    <div className="app-page comunicados-page">
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <PageHeader
        title={comunicado.titulo}
        subtitle={formatDate(comunicado.created_at)}
        backTo="/comunicados"
        actions={canManageComunicados() ? (
          <div className="flex flex-wrap gap-2">
            {!comunicado.publicado && (
              <button type="button" onClick={handlePublish} className="solicitud-admin-btn solicitud-admin-btn--primary" title="Publicar">
                <Send className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">Publicar</span>
              </button>
            )}
            {comunicado.publicado && (
              <button type="button" onClick={handleNotify} disabled={isNotifying} className="solicitud-admin-btn solicitud-admin-btn--primary" title="Notificar de nuevo">
                <Send className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">{isNotifying ? 'Notificando…' : 'Notificar'}</span>
              </button>
            )}
            <button type="button" onClick={() => navigate(`/comunicados/${id}/editar`)} className="solicitud-admin-btn" title="Editar">
              <Edit className="w-4 h-4" aria-hidden />
            </button>
            <button type="button" onClick={handleDelete} className="solicitud-admin-btn" title="Eliminar">
              <Trash2 className="w-4 h-4" aria-hidden />
            </button>
          </div>
        ) : null}
      />

      <div className="app-card app-card--pad space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" aria-hidden />
            {formatDate(comunicado.created_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="w-3.5 h-3.5" aria-hidden />
            {canManageComunicados() ? (comunicado.autor_nombre || comunicado.autor_id) : 'Empresa'}
          </span>
          {isMarkedAsRead && (
            <span className="solicitud-status solicitud-status--ok">Leído</span>
          )}
          {canManageComunicados() && (
            <span className={`solicitud-status ${comunicado.publicado ? 'solicitud-status--ok' : 'solicitud-status--pendiente'}`}>
              {comunicado.publicado ? 'Publicado' : 'Borrador'}
            </span>
          )}
          {canManageComunicados() && comunicado.leidos && comunicado.leidos.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReadersModal(true)}
              className="inline-flex items-center gap-1 text-primary-600 hover:underline"
            >
              <Users className="w-3.5 h-3.5" aria-hidden />
              {comunicado.leidos.length} leídos
            </button>
          )}
        </div>

        {comunicado.has_archivo && comunicado.nombre_archivo && (
          <div className="solicitud-admin-callout">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Archivo adjunto</p>
                  <p className="text-xs text-gray-500 truncate">{comunicado.nombre_archivo}</p>
                </div>
              </div>
              <div className="solicitud-admin-toolbar flex-wrap">
                <button type="button" onClick={handlePreviewFile} className="solicitud-admin-btn">
                  <Eye className="w-4 h-4" aria-hidden />
                  <span>Ver</span>
                </button>
                <a
                  href={`${config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || ''}/api/comunicados/${id}/download`}
                  download={comunicado.nombre_archivo}
                  className="solicitud-admin-btn solicitud-admin-btn--primary"
                  onClick={(e) => {
                    const token = localStorage.getItem('auth_token');
                    if (token) {
                      e.preventDefault();
                      fetch(
                        `${config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || ''}/api/comunicados/${id}/download`,
                        { headers: { Authorization: `Bearer ${token}` } },
                      )
                        .then((res) => res.blob())
                        .then((blob) => {
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = comunicado.nombre_archivo;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        })
                        .catch((err) => {
                          setNotification({
                            type: 'error',
                            message: `Error al descargar archivo: ${err.message}`,
                          });
                        });
                    }
                  }}
                >
                  <Download className="w-4 h-4" aria-hidden />
                  <span>Descargar</span>
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="comunicados-detail-content">
          {comunicado.contenido}
        </div>
      </div>

      {/* Modal de confirmare pentru ștergere */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Eliminar Comunicado"
        message="¿Estás seguro de que deseas eliminar este comunicado? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        icon={Trash2}
      />

      {/* Modal de confirmare pentru publicare */}
      <ConfirmModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={confirmPublish}
        title="Publicar Comunicado"
        message="¿Estás seguro de que deseas publicar este comunicado? Se enviará una notificación push a todos los empleados."
        confirmText="Publicar"
        cancelText="Cancelar"
        type="info"
        icon={Send}
      />

      {/* Modal de confirmare pentru re-notificare */}
      <ConfirmModal
        isOpen={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        onConfirm={confirmNotify}
        title="Reenviar notificación"
        message="¿Quieres enviar de nuevo una notificación push de este comunicado a todos los empleados con notificaciones activas?"
        confirmText={isNotifying ? 'Notificando...' : 'Reenviar'}
        cancelText="Cancelar"
        type="info"
        icon={Send}
        disabled={isNotifying}
      />

      {/* Modal pentru lista de cititori */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showReadersModal}
          onClose={() => setShowReadersModal(false)}
          title="Usuarios que han leído"
          showCloseButton={false}
          size="md"
          className="app-modal--form"
          footer={(
            <button type="button" onClick={() => setShowReadersModal(false)} className="app-modal__btn app-modal__btn--ok">
              Cerrar
            </button>
          )}
        >
          {comunicado && comunicado.leidos ? (
            <div className="space-y-2">
              {comunicado.leidos.length === 0 ? (
                <p className="app-modal__meta text-center py-4">Nadie ha leído este comunicado aún.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {comunicado.leidos.map((leido, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
                    >
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
              )}
            </div>
          ) : (
            <AlertBanner variant="loading" loading>Cargando...</AlertBanner>
          )}
        </Modal>,
        document.body
      )}

      {/* Preview archivo */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showFilePreview}
          onClose={handleClosePreview}
          title={previewData?.fileName || comunicado?.nombre_archivo || 'Vista previa'}
          showCloseButton={false}
          size="xl"
          className="app-modal--preview"
          footer={(
            <button type="button" onClick={handleClosePreview} className="app-modal__btn">Cerrar</button>
          )}
        >
          {previewLoading ? (
            <AlertBanner variant="loading" loading>Cargando preview...</AlertBanner>
          ) : previewData?.isPdf ? (
            <div className="pdf-preview-container h-[70vh] min-h-[50vh]">
              {isAndroid || isIOS ? (
                <PDFViewerAndroid pdfUrl={previewData?.previewUrl || ''} className="w-full h-full" />
              ) : (
                <iframe
                  src={previewData?.previewUrl || ''}
                  className="w-full h-full border-0 rounded-lg"
                  title={previewData?.fileName}
                />
              )}
            </div>
          ) : previewData?.isImage ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <img
                src={previewData?.previewUrl || ''}
                alt={previewData?.fileName}
                className={`max-h-[70vh] w-full object-contain rounded-lg ${isIOS ? 'brightness-100 contrast-100' : ''}`}
                style={isIOS ? { filter: 'none', WebkitFilter: 'none' } : undefined}
                onError={(e) => {
                  e.target.style.display = 'none';
                  const container = e.target.parentElement;
                  if (container) {
                    container.innerHTML = `
                      <div class="text-center py-8">
                        <p class="text-gray-600 dark:text-gray-400 mb-2">Error al cargar la imagen</p>
                        <p class="text-sm text-gray-500">Usa el botón de descarga para ver el archivo</p>
                      </div>
                    `;
                  }
                }}
              />
            </div>
          ) : (
            <AlertBanner variant="info" title="Preview no disponible">
              Usa el botón de descarga para ver el archivo.
            </AlertBanner>
          )}
        </Modal>,
        document.body
      )}
    </div>
  );
};

export default ComunicadoDetailPage;

