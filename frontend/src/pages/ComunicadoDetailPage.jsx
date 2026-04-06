import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { config } from '../config/env';
import {
  ArrowLeft,
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
  X,
} from 'lucide-react';
import Notification from '../components/ui/Notification';
import ConfirmModal from '../components/ui/ConfirmModal';
import Modal from '../components/ui/Modal';
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
                  <span>Autor: {canManageComunicados() ? (comunicado.autor_nombre || comunicado.autor_id) : 'Empresa'}</span>
                </div>
                {isMarkedAsRead && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Leído</span>
                  </div>
                )}
                {canManageComunicados() && comunicado.leidos && comunicado.leidos.length > 0 && (
                  <button
                    onClick={() => setShowReadersModal(true)}
                    className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors cursor-pointer"
                    title="Ver quién ha leído"
                  >
                    <Users className="w-4 h-4" />
                    <span>{comunicado.leidos.length} leídos</span>
                  </button>
                )}
              </div>
            </div>

            {/* Actions (Admin only) */}
            {canManageComunicados() && (
              <div className="flex items-center gap-2 ml-4">
                {!comunicado.publicado && (
                  <button
                    onClick={handlePublish}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    title="Publicar comunicado"
                  >
                    <Send className="w-4 h-4" />
                    Publicar
                  </button>
                )}
                {comunicado.publicado && (
                  <button
                    onClick={handleNotify}
                    disabled={isNotifying}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Enviar de nuevo notificación push a todos los empleados"
                  >
                    <Send className="w-4 h-4" />
                    {isNotifying ? 'Notificando...' : 'Notificar de nuevo'}
                  </button>
                )}
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

          {/* Archivo adjunto */}
          {comunicado.has_archivo && comunicado.nombre_archivo && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Paperclip className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Archivo adjunto
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {comunicado.nombre_archivo}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviewFile}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    title="Ver preview"
                  >
                    <Eye className="w-4 h-4" />
                    Ver preview
                  </button>
                  <a
                    href={`${config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || ''}/api/comunicados/${id}/download`}
                    download={comunicado.nombre_archivo}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    onClick={(e) => {
                      // Adaugă token JWT în header pentru download
                      const token = localStorage.getItem('auth_token');
                      if (token) {
                        e.preventDefault();
                        fetch(
                          `${config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || ''}/api/comunicados/${id}/download`,
                          {
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          },
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
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="prose dark:prose-invert max-w-none">
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {comunicado.contenido}
            </div>
          </div>
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
      <Modal
        isOpen={showReadersModal}
        onClose={() => setShowReadersModal(false)}
        title="Usuarios que han leído"
        size="md"
      >
        {comunicado && comunicado.leidos ? (
          <div className="space-y-3">
            {comunicado.leidos.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nadie ha leído este comunicado aún.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comunicado.leidos.map((leido, index) => (
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

      {/* Modal de Preview para Archivo (móvil: min-w-0 en cabecera para que el cierre no quede fuera de pantalla) */}
      {showFilePreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm"
          onClick={handleClosePreview}
          role="presentation"
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in fade-in duration-300 dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa del archivo"
          >
            {/* Cierre fijo esquina: siempre visible en móvil */}
            <button
              type="button"
              onClick={handleClosePreview}
              className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-lg ring-1 ring-black/5 transition hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-red-900/30 dark:hover:text-red-300 sm:right-3 sm:top-3"
              aria-label="Cerrar vista previa"
            >
              <X className="h-6 w-6" strokeWidth={2.5} />
            </button>

            {/* Header */}
            <div className="shrink-0 border-b border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 px-4 pb-3 pt-12 dark:border-gray-600 dark:from-gray-700 dark:to-gray-800 sm:px-6 sm:py-4 sm:pt-4">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="hidden h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg sm:flex sm:items-center sm:justify-center">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1 pr-10 sm:pr-2">
                  <h3 className="line-clamp-2 text-base font-bold leading-tight text-gray-900 dark:text-white sm:text-xl">
                    Vista previa: {previewData?.fileName || comunicado?.nombre_archivo}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400 sm:text-sm">
                    Visualización de archivo
                  </p>
                  <button
                    type="button"
                    onClick={handleClosePreview}
                    className="mt-3 w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 sm:hidden"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-3 dark:bg-gray-900 sm:p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando preview...</span>
                </div>
              ) : previewData?.isPdf ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 h-[75vh] pdf-preview-container">
                  {isAndroid || isIOS ? (
                    <PDFViewerAndroid 
                      pdfUrl={previewData?.previewUrl || ''} 
                      className="w-full h-full"
                    />
                  ) : (
                    <iframe
                      src={previewData?.previewUrl || ''}
                      className="w-full h-full border-0 rounded-lg"
                      title={previewData?.fileName}
                    />
                  )}
                </div>
              ) : previewData?.isImage ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 flex items-center justify-center min-h-[60vh]">
                  <div className="max-w-full max-h-[70vh] overflow-auto">
                    <img
                      src={previewData?.previewUrl || ''}
                      alt={previewData?.fileName}
                      className={`max-w-full h-auto rounded-lg shadow-2xl ${
                        isIOS ? 'brightness-100 contrast-100' : ''
                      }`}
                      style={{
                        ...(isIOS && {
                          filter: 'none',
                          WebkitFilter: 'none',
                          imageRendering: 'auto',
                          WebkitImageRendering: 'auto',
                          backgroundColor: 'transparent'
                        })
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const container = e.target.parentElement;
                        if (container) {
                          container.innerHTML = `
                            <div class="text-center py-12">
                              <div class="text-6xl mb-4">🖼️</div>
                              <p class="text-gray-600 dark:text-gray-400 mb-4">Error al cargar la imagen</p>
                              <p class="text-sm text-gray-500 dark:text-gray-500">Usa el botón de descarga para ver el archivo</p>
                            </div>
                          `;
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Preview no disponible para este tipo de archivo</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">Usa el botón de descarga para ver el archivo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComunicadoDetailPage;

