import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { PageHeader, Notification } from '../components/ui';
import { Save, Paperclip, X } from 'lucide-react';

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
      const timer = setTimeout(() => {
        loadComunicado();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isEdit, loadComunicado]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!titulo.trim()) {
      setNotification({ type: 'error', message: 'El título es obligatorio' });
      return;
    }

    if (!contenido.trim()) {
      setNotification({ type: 'error', message: 'El contenido es obligatorio' });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('titulo', titulo.trim());
      formData.append('contenido', contenido.trim());
      formData.append('publicado', publicado.toString());
      if (archivo) {
        formData.append('archivo', archivo);
      }

      if (isEdit) {
        await updateComunicado(id, formData);
        setNotification({ type: 'success', message: 'Comunicado actualizado con éxito' });
      } else {
        await createComunicado(formData);
        setNotification({ type: 'success', message: 'Comunicado creado con éxito' });
      }

      setTimeout(() => {
        navigate('/comunicados');
      }, 1500);
    } catch (err) {
      setNotification({ type: 'error', message: `Error: ${err.message}` });
    }
  };

  return (
    <div className="app-page comunicados-page">
      <PageHeader
        title={isEdit ? 'Editar Comunicado' : 'Nuevo Comunicado'}
        subtitle={isEdit ? 'Modifica el comunicado existente' : 'Crea un nuevo comunicado para todos los empleados'}
        backTo="/comunicados"
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="app-card app-card--pad space-y-4">
        <div className="app-modal__field">
          <label htmlFor="titulo" className="app-modal__label">Título *</label>
          <input
            type="text"
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="app-modal__input"
            placeholder="Título del comunicado"
            required
          />
        </div>

        <div className="app-modal__field">
          <label htmlFor="contenido" className="app-modal__label">Contenido *</label>
          <textarea
            id="contenido"
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={12}
            className="app-modal__input min-h-[12rem] resize-y"
            placeholder="Contenido del comunicado..."
            required
          />
        </div>

        <div className="app-modal__field">
          <label htmlFor="archivo" className="app-modal__label">Archivo adjunto (opcional)</label>
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
            className="app-modal__input py-2"
          />
          {archivoPreview && (
            <div className="solicitud-admin-callout flex items-center justify-between gap-2 mt-2">
              <span className="text-sm flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 shrink-0" aria-hidden />
                <span className="truncate">{archivoPreview}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setArchivo(null);
                  setArchivoPreview(null);
                  const input = document.getElementById('archivo');
                  if (input) input.value = '';
                }}
                className="solicitud-admin-btn shrink-0"
                aria-label="Eliminar archivo"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          )}
          <p className="app-modal__meta mt-1">
            PDF, imágenes, DOC/DOCX, XLS/XLSX, TXT
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={publicado}
            onChange={(e) => setPublicado(e.target.checked)}
            className="mt-1 w-5 h-5"
          />
          <span>
            <span className="app-modal__label mb-0 block">Publicar inmediatamente</span>
            <span className="app-modal__meta text-sm">
              Se enviará una notificación push a todos los empleados
            </span>
          </span>
        </label>

        <div className="solicitud-admin-toolbar justify-end pt-2">
          <button type="button" onClick={() => navigate('/comunicados')} className="solicitud-admin-btn">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="solicitud-admin-btn solicitud-admin-btn--primary">
            {loading ? (
              <span>{isEdit ? 'Guardando...' : 'Creando...'}</span>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden />
                <span>{isEdit ? 'Guardar cambios' : 'Crear comunicado'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ComunicadoCreatePage;
