import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button, Card, Modal, Input } from '../components/ui';
import Notification from '../components/ui/Notification';
import Back3DButton from '../components/Back3DButton';
import PRLAutoevaluacionResultModal from '../components/PRLAutoevaluacionResultModal';
import { routes } from '../utils/routes';

const TIPOS_DOCUMENTO = [
  { value: 'EVALUACION_RIESGOS', label: 'Evaluación de Riesgos Laborales', requiereFirma: false },
  { value: 'ACTA_INFORMATIVA', label: 'Acta Informativa del Puesto', requiereFirma: true },
  { value: 'ENTREGA_EPIS', label: 'Entrega de EPIs', requiereFirma: true },
  { value: 'RENUNCIA_RM', label: 'Renuncia Reconocimiento Médico (solo si rechaza RM)', requiereFirma: true },
  { value: 'MANUAL_TEST', label: 'Manual del Puesto + Test', requiereFirma: true },
];

export default function PRLDocumentosPage() {
  const { authToken } = useAuth();
  const [activeTab, setActiveTab] = useState('grupos'); // 'grupos' sau 'matrix'
  const [grupos, setGrupos] = useState([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // Estados para matrix/tabla
  const [empleadosConDocumentos, setEmpleadosConDocumentos] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Modal states
  const [showUploadZipModal, setShowUploadZipModal] = useState(false);
  const [showUploadIndividualModal, setShowUploadIndividualModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showEnviarModal, setShowEnviarModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [previewDocumentos, setPreviewDocumentos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [empleadosGrupoEnviar, setEmpleadosGrupoEnviar] = useState([]);
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState(new Set());
  const [loadingEmpleadosEnviar, setLoadingEmpleadosEnviar] = useState(false);
  const [filtroEmpleadoEnviar, setFiltroEmpleadoEnviar] = useState('');
  const [autoevalDocumentoId, setAutoevalDocumentoId] = useState(null);

  // Form states pentru upload individual
  const [formData, setFormData] = useState({
    grupo_nombre: '',
    tipo_documento: '',
    archivo: null,
  });

  const cargarGrupos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(routes.prlListarGrupos, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Error al cargar grupos');
      }

      const data = await res.json();
      setGrupos(data.grupos || []);
    } catch (err) {
      setError(err.message);
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const cargarTemplates = useCallback(async (grupoNombre) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(routes.prlListarTemplates(grupoNombre), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Error al cargar templates');
      }

      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.message);
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    cargarGrupos();
  }, [cargarGrupos]);

  useEffect(() => {
    if (grupoSeleccionado) {
      cargarTemplates(grupoSeleccionado);
    }
  }, [grupoSeleccionado, cargarTemplates]);

  const handleZipFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      mostrarNotificacion('error', 'El archivo debe ser un ZIP');
      return;
    }

    setZipFile(file);

    // Preview ZIP
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('zip_file', file);
      formData.append('grupo_nombre', grupoSeleccionado || '');

      const res = await fetch(routes.prlUploadZipPreview, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Error al procesar ZIP');
      }

      const data = await res.json();
      setPreviewDocumentos(data.documentos || []);
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
      setZipFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmarZip = async () => {
    if (!zipFile || !grupoSeleccionado) {
      mostrarNotificacion('error', 'Selecciona un GRUPO y un archivo ZIP');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('zip_file', zipFile);
      formData.append('grupo_nombre', grupoSeleccionado);

      const res = await fetch(routes.prlUploadZipConfirmar, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Error al guardar documentos');
      }

      const data = await res.json();
      mostrarNotificacion(
        'success',
        `✅ ${data.templates_creados} creados, ${data.templates_actualizados} actualizados`
      );
      setShowUploadZipModal(false);
      setZipFile(null);
      setPreviewDocumentos([]);
      cargarTemplates(grupoSeleccionado);
      cargarGrupos();
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadIndividual = async () => {
    if (!formData.grupo_nombre || !formData.tipo_documento || !formData.archivo) {
      mostrarNotificacion('error', 'Completa todos los campos');
      return;
    }

    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('archivo', formData.archivo);
      uploadFormData.append('grupo_nombre', formData.grupo_nombre);
      uploadFormData.append('tipo_documento', formData.tipo_documento);

      const res = await fetch(routes.prlUploadDocumento, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: uploadFormData,
      });

      if (!res.ok) {
        throw new Error('Error al subir documento');
      }

      mostrarNotificacion('success', '✅ Documento subido correctamente');
      setShowUploadIndividualModal(false);
      setFormData({ grupo_nombre: '', tipo_documento: '', archivo: null });
      if (formData.grupo_nombre === grupoSeleccionado) {
        cargarTemplates(formData.grupo_nombre);
      }
      cargarGrupos();
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDescargarTemplate = async (templateId, nombreArchivo) => {
    try {
      const res = await fetch(routes.prlDescargarTemplate(templateId), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Error al descargar');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
    }
  };

  const handleEliminarTemplate = async () => {
    if (!templateToDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(routes.prlEliminarTemplate(templateToDelete.id), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Error al eliminar documento' }));
        throw new Error(errorData.message || 'Error al eliminar documento');
      }

      const data = await res.json();
      mostrarNotificacion('success', data.message || '✅ Documento eliminado correctamente');
      setShowDeleteModal(false);
      setTemplateToDelete(null);
      cargarTemplates(grupoSeleccionado);
      cargarGrupos();
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleEliminarTodosTemplates = async () => {
    if (!grupoSeleccionado) return;

    try {
      setDeletingAll(true);
      const res = await fetch(routes.prlEliminarTodosTemplates(grupoSeleccionado), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Error al eliminar documentos');
      }

      const data = await res.json();
      mostrarNotificacion('success', `✅ ${data.message || 'Documentos eliminados correctamente'}`);
      setShowDeleteAllModal(false);
      cargarTemplates(grupoSeleccionado);
      cargarGrupos();
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setDeletingAll(false);
    }
  };

  const abrirModalEnviarDocumentos = async () => {
    if (!grupoSeleccionado) return;
    if (templates.length === 0) {
      mostrarNotificacion('error', 'No hay documentos para enviar. Sube documentos primero.');
      return;
    }

    setShowEnviarModal(true);
    setLoadingEmpleadosEnviar(true);
    setFiltroEmpleadoEnviar('');
    setEmpleadosGrupoEnviar([]);
    setEmpleadosSeleccionados(new Set());

    try {
      const res = await fetch(routes.prlEmpleadosActivosGrupo(grupoSeleccionado), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al cargar empleados del grupo');
      }

      const data = await res.json();
      const lista = Array.isArray(data.empleados) ? data.empleados : [];
      setEmpleadosGrupoEnviar(lista);
      setEmpleadosSeleccionados(new Set(lista.map((e) => String(e.codigo))));
    } catch (err) {
      setShowEnviarModal(false);
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setLoadingEmpleadosEnviar(false);
    }
  };

  const toggleEmpleadoEnviar = (codigo) => {
    const id = String(codigo);
    setEmpleadosSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seleccionarTodosEmpleadosEnviar = () => {
    setEmpleadosSeleccionados(
      new Set(empleadosGrupoEnviar.map((e) => String(e.codigo))),
    );
  };

  const deseleccionarTodosEmpleadosEnviar = () => {
    setEmpleadosSeleccionados(new Set());
  };

  const empleadosEnviarFiltrados = empleadosGrupoEnviar.filter((e) => {
    const q = filtroEmpleadoEnviar.trim().toLowerCase();
    if (!q) return true;
    return (
      String(e.nombre || '').toLowerCase().includes(q) ||
      String(e.codigo || '').toLowerCase().includes(q) ||
      String(e.dni || '').toLowerCase().includes(q)
    );
  });

  const handleEnviarDocumentosAGrupo = async () => {
    if (!grupoSeleccionado) return;
    if (empleadosSeleccionados.size === 0) {
      mostrarNotificacion('error', 'Selecciona al menos un empleado.');
      return;
    }

    try {
      setEnviando(true);
      const res = await fetch(routes.prlEnviarDocumentosAGrupo(grupoSeleccionado), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          empleado_ids: Array.from(empleadosSeleccionados),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Error al enviar documentos' }));
        throw new Error(errorData.message || 'Error al enviar documentos');
      }

      const data = await res.json();
      setShowEnviarModal(false);
      setEmpleadosGrupoEnviar([]);
      setEmpleadosSeleccionados(new Set());
      mostrarNotificacion(
        'success',
        `✅ Enviado a ${empleadosSeleccionados.size} empleado(s): ${data.documentos_creados} documentos creados, ${data.emails_enviados} emails`,
      );
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const mostrarNotificacion = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const getTipoLabel = (tipo) => {
    const tipoObj = TIPOS_DOCUMENTO.find((t) => t.value === tipo);
    return tipoObj ? tipoObj.label : tipo;
  };

  const cargarMatrixEmpleados = useCallback(async () => {
    try {
      setMatrixLoading(true);
      const res = await fetch(routes.prlListarEmpleadosConDocumentos, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Error al cargar matrix de empleados');
      }

      const data = await res.json();
      setEmpleadosConDocumentos(data.empleados || []);
    } catch (err) {
      mostrarNotificacion('error', `Error: ${err.message}`);
    } finally {
      setMatrixLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (activeTab === 'matrix') {
      cargarMatrixEmpleados();
    }
  }, [activeTab, cargarMatrixEmpleados]);

  const getEstadoColor = (estado, requiereFirma) => {
    if (!requiereFirma) {
      return 'bg-gray-100 text-gray-700'; // Informativo
    }
    switch (estado) {
      case 'FIRMADO':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'NO_APLICA':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'RECHAZADO':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'FIRMADO':
        return '✅ Firmado';
      case 'PENDIENTE':
        return '⏳ Pendiente';
      case 'NO_APLICA':
        return 'ℹ️ No aplica';
      case 'RECHAZADO':
        return '❌ Rechazado';
      case 'INFORMATIVO':
        return '📄 Informativo';
      default:
        return estado;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Back3DButton to="/inicio" title="Regresar al Dashboard" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Gestión Documentos PRL
          </h1>
          <p className="text-gray-600 dark:text-white text-sm sm:text-base">
            Administra los documentos PRL obligatorios por puesto (GRUPO)
          </p>
        </div>
      </div>

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('grupos')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'grupos'
              ? 'border-b-2 border-red-500 text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📁 Por GRUPO
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'matrix'
              ? 'border-b-2 border-red-500 text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Matrix Estado
        </button>
      </div>

      {/* Tab: Matrix Estado */}
      {activeTab === 'matrix' && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Matrix de Estado de Documentos PRL</h2>
                <p className="text-sm text-gray-600">
                  Vista completa: empleados (vertical) y documentos PRL (horizontal)
                </p>
              </div>
              <button
                onClick={cargarMatrixEmpleados}
                disabled={matrixLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {matrixLoading ? 'Cargando...' : '🔄 Actualizar'}
              </button>
            </div>

            {matrixLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando matrix...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold sticky left-0 bg-gray-100 z-10">
                        Empleado / Documento
                      </th>
                      {TIPOS_DOCUMENTO.map((tipo) => (
                        <th
                          key={tipo.value}
                          className="border border-gray-300 px-3 py-2 text-center font-semibold text-xs"
                        >
                          {tipo.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {empleadosConDocumentos.map((empleado) => (
                      <tr key={empleado.empleado_id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 sticky left-0 bg-white z-10 font-medium">
                          <div className="font-semibold">{empleado.empleado_nombre}</div>
                          <div className="text-xs text-gray-500">{empleado.grupo_nombre}</div>
                        </td>
                        {TIPOS_DOCUMENTO.map((tipo) => {
                          const documento = empleado.documentos.find(
                            (d) => d.tipo_documento === tipo.value
                          );
                          return (
                            <td
                              key={tipo.value}
                              className="border border-gray-300 px-2 py-2 text-center"
                            >
                              {documento ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      tipo.value === 'MANUAL_TEST' &&
                                      documento.test_completado &&
                                      documento.documento_id
                                    ) {
                                      setAutoevalDocumentoId(documento.documento_id);
                                    }
                                  }}
                                  className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getEstadoColor(
                                    documento.estado,
                                    documento.requiere_firma
                                  )} ${
                                    tipo.value === 'MANUAL_TEST' && documento.test_completado
                                      ? 'cursor-pointer hover:opacity-90 underline-offset-2 hover:underline'
                                      : ''
                                  }`}
                                  title={`Estado: ${documento.estado}${documento.fecha_firma ? `, Fecha: ${new Date(documento.fecha_firma).toLocaleDateString('es-ES')}` : ''}${
                                    tipo.value === 'MANUAL_TEST' && documento.test_completado
                                      ? `, Test: ${documento.test_puntuacion ?? '—'} pts — clic para ver respuestas`
                                      : ''
                                  }`}
                                >
                                  {getEstadoLabel(documento.estado)}
                                  {tipo.value === 'MANUAL_TEST' && documento.test_completado && (
                                    <span className="block text-[10px] mt-0.5 opacity-90">
                                      Test {documento.test_puntuacion ?? '—'} pts · Ver resp.
                                    </span>
                                  )}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {empleadosConDocumentos.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay empleados con documentos PRL asignados
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab: Por GRUPO */}
      {activeTab === 'grupos' && (
        <>
          {/* Selección de GRUPO */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Seleccionar GRUPO (Puesto)</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Todos los GRUPOs de empleados activos. El número entre paréntesis indica cuántos documentos PRL tiene configurados.
              </p>
              <div className="flex flex-wrap gap-2">
                {grupos.map((grupo) => (
                  <Button
                    key={grupo.grupo_nombre}
                    onClick={() => setGrupoSeleccionado(grupo.grupo_nombre)}
                    variant={grupoSeleccionado === grupo.grupo_nombre ? 'primary' : 'secondary'}
                    title={`${grupo.empleados_count || 0} empleados activos, ${grupo.count} documentos PRL`}
                  >
                    {grupo.grupo_nombre} 
                    {grupo.count > 0 ? (
                      <span className="ml-1">({grupo.count} docs)</span>
                    ) : (
                      <span className="ml-1 text-xs opacity-70">(sin docs)</span>
                    )}
                  </Button>
                ))}
                {grupos.length === 0 && !loading && (
                  <p className="text-gray-500">No hay GRUPOs disponibles</p>
                )}
              </div>
            </div>
          </Card>

      {/* Templates del GRUPO seleccionado */}
      {grupoSeleccionado && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Documentos para: {grupoSeleccionado}
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowUploadZipModal(true)}
                  variant="primary"
                >
                  📦 Subir ZIP
                </Button>
                <Button
                  onClick={() => {
                    setFormData({ ...formData, grupo_nombre: grupoSeleccionado });
                    setShowUploadIndividualModal(true);
                  }}
                  variant="secondary"
                >
                  📄 Subir Documento Individual
                </Button>
                {templates.length > 0 && (
                  <>
                    <Button
                      onClick={abrirModalEnviarDocumentos}
                      variant="primary"
                      disabled={enviando}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {enviando ? '⏳ Enviando...' : '📤 Enviar a Empleados'}
                    </Button>
                    <Button
                      onClick={() => setShowDeleteAllModal(true)}
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      🗑️ Eliminar Todos
                    </Button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay documentos para este GRUPO. Sube un ZIP o documento individual.
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{template.nombre}</div>
                      <div className="text-sm text-gray-500">
                        {getTipoLabel(template.tipo_documento)}
                        {template.requiere_firma && !template.es_renuncia_rm && ' • Requiere firma'}
                        {template.es_renuncia_rm && (
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            {' • Requiere firma solo si rechaza RM'}
                          </span>
                        )}
                        {template.es_manual_test && ' • Manual + Test'}
                        {' • Versión ' + template.version}
                      </div>
                      {template.es_renuncia_rm && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 italic">
                          ⚠️ Este documento se firma únicamente si el empleado rechaza el Reconocimiento Médico
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          handleDescargarTemplate(template.id, template.nombre_archivo)
                        }
                        variant="outline"
                        size="sm"
                      >
                        📥 Descargar
                      </Button>
                      <Button
                        onClick={() => {
                          setTemplateToDelete(template);
                          setShowDeleteModal(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        🗑️ Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
        </>
      )}

      {/* Modal Upload ZIP */}
      <Modal
        isOpen={showUploadZipModal}
        onClose={() => {
          setShowUploadZipModal(false);
          setZipFile(null);
          setPreviewDocumentos([]);
        }}
        title="Subir ZIP con Documentos PRL"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Archivo ZIP
            </label>
            <input
              type="file"
              accept=".zip"
              onChange={handleZipFileChange}
              className="w-full p-2 border rounded"
              disabled={uploading}
            />
          </div>

          {previewDocumentos.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">
                Documentos detectados ({previewDocumentos.length}):
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {previewDocumentos.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                  >
                    <div className="font-medium">{doc.nombreArchivo}</div>
                    <div className="text-gray-500">
                      Tipo: {getTipoLabel(doc.tipoDetectado)}
                      {doc.requiereFirma && ' • Requiere firma'}
                      {' • '}
                      {(doc.tamaño / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setShowUploadZipModal(false);
                setZipFile(null);
                setPreviewDocumentos([]);
              }}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarZip}
              variant="primary"
              disabled={!zipFile || uploading || previewDocumentos.length === 0}
            >
              {uploading ? 'Guardando...' : 'Confirmar y Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Upload Individual */}
      <Modal
        isOpen={showUploadIndividualModal}
        onClose={() => {
          setShowUploadIndividualModal(false);
          setFormData({ grupo_nombre: '', tipo_documento: '', archivo: null });
        }}
        title="Subir Documento Individual"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              GRUPO (Puesto)
            </label>
            <Input
              value={formData.grupo_nombre}
              onChange={(e) =>
                setFormData({ ...formData, grupo_nombre: e.target.value })
              }
              placeholder="Ej: LIMPIADOR Y PERSONAL LIMPIEZA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Tipo de Documento
            </label>
            <select
              value={formData.tipo_documento}
              onChange={(e) =>
                setFormData({ ...formData, tipo_documento: e.target.value })
              }
              className="w-full p-2 border rounded"
            >
              <option value="">Selecciona un tipo</option>
              {TIPOS_DOCUMENTO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Archivo PDF
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  archivo: e.target.files[0],
                })
              }
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setShowUploadIndividualModal(false);
                setFormData({ grupo_nombre: '', tipo_documento: '', archivo: null });
              }}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUploadIndividual}
              variant="primary"
              disabled={uploading || !formData.grupo_nombre || !formData.tipo_documento || !formData.archivo}
            >
              {uploading ? 'Subiendo...' : 'Subir'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTemplateToDelete(null);
        }}
        title="Confirmar Eliminación"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            ¿Estás seguro de que deseas eliminar este documento?
          </p>
          {templateToDelete && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="font-semibold">{templateToDelete.nombre}</div>
              <div className="text-sm text-gray-500">
                {getTipoLabel(templateToDelete.tipo_documento)}
                {' • Versión ' + templateToDelete.version}
              </div>
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            El documento será eliminado permanentemente. Puedes subir uno nuevo para reemplazarlo.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setShowDeleteModal(false);
                setTemplateToDelete(null);
              }}
              variant="secondary"
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEliminarTemplate}
              variant="primary"
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Eliminando...' : '🗑️ Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar envío a empleados */}
      <Modal
        isOpen={showEnviarModal}
        onClose={() => {
          if (!enviando) {
            setShowEnviarModal(false);
            setEmpleadosGrupoEnviar([]);
            setEmpleadosSeleccionados(new Set());
          }
        }}
        title="Confirmar envío PRL"
        size="lg"
        showCloseButton={false}
        closeOnBackdrop={!enviando}
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Se enviarán <strong>{templates.length}</strong> documento(s) PRL. Selecciona los
            empleados del grupo que deben recibirlos.
          </p>
          {grupoSeleccionado && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                GRUPO: {grupoSeleccionado}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Los empleados marcados recibirán los documentos y, si aplica, notificación por
                email.
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Documentos a enviar
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside max-h-28 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {templates.map((template) => (
                <li key={template.id}>{template.nombre}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Empleados ({empleadosSeleccionados.size}/{empleadosGrupoEnviar.length})
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={seleccionarTodosEmpleadosEnviar}
                  disabled={enviando || loadingEmpleadosEnviar}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={deseleccionarTodosEmpleadosEnviar}
                  disabled={enviando || loadingEmpleadosEnviar}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Ninguno
                </button>
              </div>
            </div>

            <Input
              value={filtroEmpleadoEnviar}
              onChange={(e) => setFiltroEmpleadoEnviar(e.target.value)}
              placeholder="Buscar por nombre, código o DNI..."
              disabled={enviando || loadingEmpleadosEnviar}
            />

            <div className="mt-2 max-h-52 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {loadingEmpleadosEnviar && (
                <div className="p-4 text-sm text-gray-500 text-center">Cargando empleados…</div>
              )}
              {!loadingEmpleadosEnviar && empleadosGrupoEnviar.length === 0 && (
                <div className="p-4 text-sm text-amber-700 text-center">
                  No hay empleados activos en este grupo.
                </div>
              )}
              {!loadingEmpleadosEnviar &&
                empleadosEnviarFiltrados.map((empleado) => {
                  const codigo = String(empleado.codigo);
                  const checked = empleadosSeleccionados.has(codigo);
                  return (
                    <label
                      key={codigo}
                      className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        checked ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmpleadoEnviar(codigo)}
                        disabled={enviando}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{empleado.nombre}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          Código: {codigo}
                          {empleado.dni ? ` · DNI: ${empleado.dni}` : ''}
                          {empleado.email ? ` · ${empleado.email}` : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              onClick={() => {
                setShowEnviarModal(false);
                setEmpleadosGrupoEnviar([]);
                setEmpleadosSeleccionados(new Set());
              }}
              variant="secondary"
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarDocumentosAGrupo}
              variant="primary"
              disabled={
                enviando || loadingEmpleadosEnviar || empleadosSeleccionados.size === 0
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {enviando
                ? 'Enviando...'
                : `📤 Enviar a ${empleadosSeleccionados.size} empleado(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación Todos */}
      <Modal
        isOpen={showDeleteAllModal}
        onClose={() => {
          setShowDeleteAllModal(false);
        }}
        title="Confirmar Eliminación de Todos los Documentos"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            ¿Estás seguro de que deseas eliminar <strong>todos los documentos</strong> para este GRUPO?
          </p>
          {grupoSeleccionado && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="font-semibold">GRUPO: {grupoSeleccionado}</div>
              <div className="text-sm text-gray-500 mt-1">
                {templates.length} documento(s) serán eliminados
              </div>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-600">Documentos que se eliminarán:</p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside max-h-40 overflow-y-auto">
              {templates.map((template) => (
                <li key={template.id}>{template.nombre}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Los documentos serán desactivados. Puedes subir nuevos documentos para reemplazarlos.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setShowDeleteAllModal(false);
              }}
              variant="secondary"
              disabled={deletingAll}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEliminarTodosTemplates}
              variant="primary"
              disabled={deletingAll}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingAll ? 'Eliminando...' : `🗑️ Eliminar Todos (${templates.length})`}
            </Button>
          </div>
        </div>
      </Modal>

      {autoevalDocumentoId && (
        <PRLAutoevaluacionResultModal
          documentoId={autoevalDocumentoId}
          admin={true}
          onClose={() => setAutoevalDocumentoId(null)}
        />
      )}
    </div>
  );
}
