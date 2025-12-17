import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { ArrowLeft, Save } from 'lucide-react';
import Notification from '../components/ui/Notification';

const ComunicadoCreatePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    fetchComunicado,
    createComunicado,
    updateComunicado,
    loading,
  } = useComunicadosApi();
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [publicado, setPublicado] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [archivoPreview, setArchivoPreview] = useState(null);
  const [notification, setNotification] = useState(null);
  const isEdit = !!id;

  const loadComunicado = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchComunicado(id);
      setTitulo(data.titulo);
      setContenido(data.contenido);
      setPublicado(data.publicado);
      if (data.nombre_archivo) {
        setArchivoPreview(data.nombre_archivo);
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error al cargar comunicado: ${err.message}`,
      });
    }
  }, [id, fetchComunicado]);

  useEffect(() => {
    if (isEdit) {
      loadComunicado();
    }
  }, [isEdit, loadComunicado]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!titulo.trim()) {
      setNotification({
        type: 'error',
        message: 'El título es obligatorio',
      });
      return;
    }

    if (!contenido.trim()) {
      setNotification({
        type: 'error',
        message: 'El contenido es obligatorio',
      });
      return;
    }

    try {
      // Creează FormData pentru a trimite și fișierul
      const formData = new FormData();
      formData.append('titulo', titulo.trim());
      formData.append('contenido', contenido.trim());
      formData.append('publicado', publicado.toString());

      if (archivo) {
        formData.append('archivo', archivo);
      }

      if (isEdit) {
        await updateComunicado(id, formData);
        setNotification({
          type: 'success',
          message: 'Comunicado actualizado con éxito',
        });
      } else {
        await createComunicado(formData);
        setNotification({
          type: 'success',
          message: 'Comunicado creado con éxito',
        });
      }

      setTimeout(() => {
        navigate('/comunicados');
      }, 1500);
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error: ${err.message}`,
      });
    }
  };

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

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Editar Comunicado' : 'Nuevo Comunicado'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {isEdit
                ? 'Modifica el comunicado existente'
                : 'Crea un nuevo comunicado para todos los empleados'}
            </p>
          </div>
          <button
            onClick={() => navigate('/comunicados')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:p-8">
          {/* Título */}
          <div className="mb-6">
            <label
              htmlFor="titulo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Título *
            </label>
            <input
              type="text"
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Título del comunicado"
              required
            />
          </div>

          {/* Contenido */}
          <div className="mb-6">
            <label
              htmlFor="contenido"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Contenido *
            </label>
            <textarea
              id="contenido"
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y"
              placeholder="Contenido del comunicado..."
              required
            />
          </div>

          {/* Archivo adjunto */}
          <div className="mb-6">
            <label
              htmlFor="archivo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Archivo adjunto (opcional)
            </label>
            <div className="space-y-3">
              <input
                type="file"
                id="archivo"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setArchivo(file);
                    setArchivoPreview(file.name);
                  }
                }}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt,.xls,.xlsx"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900 dark:file:text-primary-300"
              />
              {archivoPreview && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    📎 {archivoPreview}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setArchivo(null);
                      setArchivoPreview(null);
                      const input = document.getElementById('archivo');
                      if (input) input.value = '';
                    }}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Formatos permitidos: PDF, imágenes (PNG, JPG, GIF, WEBP), documentos (DOC, DOCX), Excel (XLS, XLSX), texto (TXT)
            </p>
          </div>

          {/* Publicado */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={publicado}
                onChange={(e) => setPublicado(e.target.checked)}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Publicar inmediatamente
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Si está marcado, el comunicado se publicará y se enviará una
                  notificación push a todos los empleados
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/comunicados')}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isEdit ? 'Guardando...' : 'Creando...'}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEdit ? 'Guardar Cambios' : 'Crear Comunicado'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComunicadoCreatePage;

