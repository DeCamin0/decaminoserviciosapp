import { useCallback, useEffect, useMemo, useState } from 'react';
import { routes } from '../utils/routes';
import { usePermissions } from '../hooks/usePermissions';
import { Notification } from '../components/ui';
import ConfirmModal from '../components/ui/ConfirmModal';
import Back3DButton from '../components/Back3DButton';
import {
  MotorInputsForm,
  ResultadoBreakdown,
  money,
} from './presupuestos-v2/MotorCalcForms';
import {
  summarizeServicioInputs,
  clienteDisplayLines,
  mergeClienteWorking,
} from './presupuestos-v2/v2UiHelpers';
import PresupuestosV2ConfigPanel from './presupuestos-v2/PresupuestosV2ConfigPanel';
import {
  JornadaEditor,
  DigitalesEditor,
  formatJornadaPreview,
} from './presupuestos-v2/JornadaDigitalesEditors';
import { ContenidoLineaEditor } from './presupuestos-v2/ContenidoLineaEditor';

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      typeof data?.message === 'string'
        ? data.message
        : data?.message?.message ||
          (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
          data?.error ||
          `Error ${res.status}`,
    );
    err.status = res.status;
    err.code = data?.code || data?.message?.code;
    err.payload = typeof data?.message === 'object' ? data.message : data;
    throw err;
  }
  return data;
}

export default function PresupuestosV2Page() {
  const { hasPermission } = usePermissions();
  const canConfig = hasPermission('presupuestos-v2-config');

  const [tab, setTab] = useState('lista'); // lista | nuevo | editor | config
  const [loading, setLoading] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [notif, setNotif] = useState({
    open: false,
    type: 'success',
    title: '',
    message: '',
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    type: 'danger',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    onConfirm: null,
  });

  const showNotif = useCallback((type, title, message) => {
    setNotif({ open: true, type, title, message: message || '' });
  }, []);
  const flashOk = useCallback(
    (message, title = 'Listo') => showNotif('success', title, message),
    [showNotif],
  );
  const flashErr = useCallback(
    (message, title = 'Error') => showNotif('error', title, message),
    [showNotif],
  );

  const onConfigFlash = useCallback(
    (kind, msg) => {
      if (kind === 'ok') flashOk(msg, 'Configuración');
      else flashErr(msg);
    },
    [flashOk, flashErr],
  );
  const onConfigBusy = useCallback((busy, label) => {
    setLoading(!!busy);
    setBusyLabel(label || '');
  }, []);

  const askConfirm = ({
    title,
    message,
    type = 'danger',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    onConfirm,
  }) => {
    setConfirmModal({
      open: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  const closeConfirm = () =>
    setConfirmModal((m) => ({ ...m, open: false, onConfirm: null }));

  const [presupuestos, setPresupuestos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [motores, setMotores] = useState([]);

  const [clienteId, setClienteId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [selectedServicioIds, setSelectedServicioIds] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [lineInputs, setLineInputs] = useState({}); // opcionId -> inputs
  const [lineResults, setLineResults] = useState({}); // opcionId -> resultado
  const [calcTotales, setCalcTotales] = useState(null);
  const [totalesDocumento, setTotalesDocumento] = useState(null);
  const [emitConflict, setEmitConflict] = useState(null);
  const [overridesForm, setOverridesForm] = useState({
    direccion_servicio: '',
    email_envio: '',
    atencion_de: '',
    observaciones_documento: '',
    contacto_especifico: '',
  });

  const clearFlash = () => {
    setNotif((n) => ({ ...n, open: false }));
  };

  const loadLista = useCallback(async () => {
    const data = await apiJson(routes.v2Presupuestos);
    setPresupuestos(data.data || []);
  }, []);

  const loadCatalogos = useCallback(async () => {
    const [c, b, s, m] = await Promise.all([
      apiJson(routes.getClientes),
      apiJson(routes.v2ConfigBrands),
      apiJson(`${routes.v2ConfigServiciosComerciales}?activos=true`),
      apiJson(routes.v2ConfigMotores),
    ]);
    setClientes(Array.isArray(c) ? c : c?.data || []);
    setBrands(b.data || []);
    setServicios(s.data || []);
    setMotores(m.data || []);
    if ((b.data || []).length === 1) {
      setBrandId(String(b.data[0].id));
    }
  }, []);

  useEffect(() => {
    clearFlash();
    setLoading(true);
    const run = async () => {
      try {
        if (tab === 'lista') await loadLista();
        if (tab === 'nuevo') await loadCatalogos();
        if (tab === 'config') {
          const m = await apiJson(routes.v2ConfigMotores);
          setMotores(m.data || []);
        }
      } catch (e) {
        flashErr(e.message || 'Error al cargar');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [tab, loadLista, loadCatalogos]);

  const serviciosActivos = useMemo(
    () => (servicios || []).filter((s) => s.activo !== false),
    [servicios],
  );

  const toggleServicio = (id) => {
    setSelectedServicioIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const resetNuevoForm = () => {
    setEditingId(null);
    setClienteId('');
    setSelectedServicioIds([]);
    if (brands.length === 1) setBrandId(String(brands[0].id));
    else setBrandId('');
  };

  const hydrateEditor = (p) => {
    setDraft(p);
    setEditingId(p.id);
    const inputs = {};
    const results = {};
    (p.servicios || []).forEach((line) => {
      const ops =
        line.opciones?.length > 0
          ? line.opciones
          : [
              {
                id: `legacy-${line.linea_id || line.id}`,
                inputs_json: line.inputs_json,
                resultado_json: line.resultado_json,
              },
            ];
      ops.forEach((op) => {
        const oid = op.id;
        inputs[oid] = op.inputs_json || {};
        if (op.resultado_json) results[oid] = op.resultado_json;
      });
    });
    setLineInputs(inputs);
    setLineResults(results);
    if (p.totales_documento) {
      setTotalesDocumento(p.totales_documento);
      setCalcTotales(p.totales_documento.totales_sin_alternativas);
    } else if (p.totales_emitidos_json) {
      setCalcTotales(p.totales_emitidos_json);
      setTotalesDocumento(null);
    } else {
      setCalcTotales(null);
      setTotalesDocumento(null);
    }
    setEmitConflict(null);
    const o = p.cliente_overrides_json || {};
    setOverridesForm({
      direccion_servicio: o.direccion_servicio || '',
      email_envio: o.email_envio || '',
      atencion_de: o.atencion_de || '',
      observaciones_documento: o.observaciones_documento || '',
      contacto_especifico: o.contacto_especifico || '',
    });
  };

  const openEdit = async (id) => {
    clearFlash();
    setLoading(true);
    try {
      const data = await apiJson(routes.v2Presupuesto(id));
      const p = data.data;
      hydrateEditor(p);
      setTab('editor');
      flashOk(`Editando ${p.identificador_ui}`);
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submitBorrador = async (e) => {
    e.preventDefault();
    clearFlash();
    setLoading(true);
    try {
      const body = {
        cliente_id: clienteId ? Number(clienteId) : null,
        brand_id: brandId ? Number(brandId) : null,
        servicio_ids: selectedServicioIds,
      };
      let p;
      if (editingId && tab === 'nuevo') {
        const res = await apiJson(routes.v2Presupuesto(editingId), {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        p = res.data;
        flashOk('Borrador actualizado — edita inputs y calcula');
      } else {
        const res = await apiJson(routes.v2Presupuestos, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        p = res.data;
        flashOk('Borrador creado — introduce datos y calcula');
      }
      hydrateEditor(p);
      setTab('editor');
    } catch (err) {
      flashErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runCalcular = async () => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    clearFlash();
    setLoading(true);
    try {
      const lineas = [];
      (draft.servicios || []).forEach((line) => {
        const sid = line.servicio?.id || line.id;
        const ops = line.opciones?.length ? line.opciones : [{ id: null, inputs_json: line.inputs_json }];
        ops.forEach((op) => {
          lineas.push({
            servicio_comercial_id: sid,
            opcion_id: op.id || undefined,
            inputs: (op.id != null ? lineInputs[op.id] : null) || op.inputs_json || {},
          });
        });
      });
      const res = await apiJson(routes.v2PresupuestoCalcular(draft.id), {
        method: 'POST',
        body: JSON.stringify({ lineas, persist: true }),
      });
      const data = res.data;
      setCalcTotales(data.totales);
      setTotalesDocumento(data.totales_documento || null);
      setEmitConflict(null);
      const refreshed = await apiJson(routes.v2Presupuesto(draft.id));
      hydrateEditor(refreshed.data);
      flashOk('Cálculo guardado en el borrador');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addVariante = async (lineaId) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    clearFlash();
    setLoading(true);
    try {
      const res = await apiJson(
        routes.v2PresupuestoLineaOpciones(draft.id, lineaId),
        { method: 'POST', body: '{}' },
      );
      hydrateEditor(res.data);
      flashOk('Variante añadida');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renameOpcion = async (opcionId, etiqueta) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    try {
      const res = await apiJson(routes.v2PresupuestoOpcion(draft.id, opcionId), {
        method: 'PUT',
        body: JSON.stringify({ etiqueta }),
      });
      hydrateEditor(res.data);
    } catch (e) {
      flashErr(e.message);
    }
  };

  const setSeleccionTipo = async (opcionId, seleccion_tipo) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    try {
      const res = await apiJson(routes.v2PresupuestoOpcion(draft.id, opcionId), {
        method: 'PUT',
        body: JSON.stringify({ seleccion_tipo }),
      });
      hydrateEditor(res.data);
    } catch (e) {
      flashErr(e.message);
    }
  };

  const saveJornada = async (opcionId, jornada) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    setLoading(true);
    try {
      const res = await apiJson(routes.v2PresupuestoOpcion(draft.id, opcionId), {
        method: 'PUT',
        body: JSON.stringify({ jornada }),
      });
      hydrateEditor(res.data);
      flashOk('Jornada guardada (cálculo sincronizado)');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveDigitales = async (servicios_digitales) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    setLoading(true);
    try {
      const res = await apiJson(routes.v2PresupuestoDigitales(draft.id), {
        method: 'PUT',
        body: JSON.stringify({ servicios_digitales }),
      });
      hydrateEditor(res.data);
      flashOk('Servicios digitales guardados');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveLineaContenido = async (lineaId, contenido_comercial) => {
    if (!draft?.id || !lineaId) return;
    setLoading(true);
    try {
      const res = await apiJson(
        routes.v2PresupuestoLineaContenido(draft.id, lineaId),
        {
          method: 'PUT',
          body: JSON.stringify({ contenido_comercial }),
        },
      );
      hydrateEditor(res.data);
      flashOk('Contenido del servicio guardado');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const restoreLineaContenido = async (lineaId) => {
    if (!draft?.id || !lineaId) return;
    setLoading(true);
    try {
      const res = await apiJson(
        routes.v2PresupuestoLineaContenidoRestaurar(draft.id, lineaId),
        { method: 'POST', body: '{}' },
      );
      hydrateEditor(res.data);
      flashOk('Contenido restaurado desde la plantilla');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteOpcion = async (opcionId) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    askConfirm({
      title: 'Eliminar opción',
      message: '¿Eliminar esta variante del servicio?',
      type: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        closeConfirm();
        setLoading(true);
        try {
          const res = await apiJson(
            routes.v2PresupuestoOpcion(draft.id, opcionId),
            { method: 'DELETE' },
          );
          hydrateEditor(res.data);
          flashOk('Opción eliminada');
        } catch (e) {
          flashErr(e.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const duplicateOpcion = async (opcionId) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    setLoading(true);
    try {
      const res = await apiJson(
        routes.v2PresupuestoOpcionDuplicar(draft.id, opcionId),
        { method: 'POST', body: '{}' },
      );
      hydrateEditor(res.data);
      flashOk('Opción duplicada');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const moveOpcion = async (lineaId, opcionIds, fromIdx, dir) => {
    const to = fromIdx + dir;
    if (to < 0 || to >= opcionIds.length) return;
    const next = [...opcionIds];
    const [item] = next.splice(fromIdx, 1);
    next.splice(to, 0, item);
    setLoading(true);
    try {
      const res = await apiJson(
        routes.v2PresupuestoOpcionesOrden(draft.id, lineaId),
        { method: 'PUT', body: JSON.stringify({ orden_ids: next }) },
      );
      hydrateEditor(res.data);
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const crearNuevaVersion = async (id) => {
    clearFlash();
    askConfirm({
      title: 'Nueva versión',
      message:
        'Se creará un borrador nuevo como revisión del documento emitido. El original permanecerá inmutable.',
      type: 'warning',
      confirmText: 'Crear borrador',
      onConfirm: async () => {
        closeConfirm();
        setLoading(true);
        setBusyLabel('Creando versión…');
        try {
          const res = await apiJson(routes.v2PresupuestoNuevaVersion(id), {
            method: 'POST',
            body: '{}',
          });
          await loadLista();
          hydrateEditor(res.data);
          setTab('editor');
          flashOk(
            res.data?.identificador_ui ||
              'Revisión creada — sin número hasta Emitir',
          );
        } catch (e) {
          flashErr(e.message);
        } finally {
          setLoading(false);
          setBusyLabel('');
        }
      },
    });
  };

  const saveOverrides = async () => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    clearFlash();
    setLoading(true);
    try {
      const res = await apiJson(routes.v2PresupuestoClienteOverrides(draft.id), {
        method: 'PUT',
        body: JSON.stringify(overridesForm),
      });
      hydrateEditor(res.data);
      flashOk('Overrides de cliente guardados (no modifican la ficha)');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshCliente = async () => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    clearFlash();
    setLoading(true);
    try {
      const res = await apiJson(routes.v2PresupuestoClienteRefresh(draft.id), {
        method: 'POST',
        body: '{}',
      });
      hydrateEditor(res.data);
      flashOk('Datos del cliente actualizados desde ficha (overrides conservados)');
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const executeEmitir = async (confirmChanged = false) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    clearFlash();
    setLoading(true);
    setBusyLabel('Emitiendo…');
    setEmitConflict(null);
    try {
      const res = await apiJson(routes.v2PresupuestoEmitir(draft.id), {
        method: 'POST',
        body: JSON.stringify({ confirm_changed_totals: confirmChanged }),
      });
      const refreshed = await apiJson(routes.v2Presupuesto(draft.id));
      hydrateEditor(refreshed.data);
      flashOk(`Presupuesto emitido: ${res.data.numero}`, 'Emitido');
    } catch (e) {
      if (e.code === 'CALCULATION_CHANGED' || e.payload?.code === 'CALCULATION_CHANGED') {
        setEmitConflict(e.payload || e);
        flashErr(
          'El cálculo vigente ha cambiado respecto al último guardado. Revise totales y confirme.',
          'Cálculo modificado',
        );
      } else {
        flashErr(e.message);
      }
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
  };

  const runEmitir = (confirmChanged = false) => {
    if (!draft?.id || draft.estado === 'EMITIDO') return;
    const totales =
      calcTotales ||
      Object.values(lineResults).reduce(
        (acc, r) => {
          if (!r?.totales) return acc;
          acc.mensualidad_sin_iva += Number(r.totales.mensualidad_sin_iva) || 0;
          acc.mensualidad_con_iva += Number(r.totales.mensualidad_con_iva) || 0;
          acc.anualidad_sin_iva += Number(r.totales.anualidad_sin_iva) || 0;
          acc.anualidad_con_iva += Number(r.totales.anualidad_con_iva) || 0;
          return acc;
        },
        {
          mensualidad_sin_iva: 0,
          mensualidad_con_iva: 0,
          anualidad_sin_iva: 0,
          anualidad_con_iva: 0,
        },
      );

    const summary = [
      `Cliente: ${draft.cliente_nombre || 'Sin cliente'}`,
      `Marca: ${draft.brand?.nombre || '—'}`,
      `Servicios: ${(draft.servicios || []).map((s) => s.nombre || s.servicio?.nombre).join(', ')}`,
      `Total mensual sin IVA: ${money(totales.mensualidad_sin_iva)} €`,
      '',
      'Al emitir se asignará un número oficial y los datos económicos quedarán bloqueados.',
      confirmChanged
        ? 'CONFIRMA: el cálculo vigente difiere del guardado; se emitirá con el total recalculado.'
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    askConfirm({
      title: confirmChanged ? 'Confirmar emisión con total nuevo' : 'Emitir presupuesto',
      message: summary,
      type: confirmChanged ? 'warning' : 'info',
      confirmText: 'Emitir',
      cancelText: 'Cancelar',
      onConfirm: () => {
        void executeEmitir(confirmChanged);
      },
    });
  };

  const openPdf = async (id, mode) => {
    clearFlash();
    setLoading(true);
    setBusyLabel(mode === 'preview' ? 'Generando PDF borrador…' : 'Preparando PDF…');
    try {
      const url =
        mode === 'preview'
          ? routes.v2PresupuestoPdfPreview(id)
          : routes.v2PresupuestoPdf(id);
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Error PDF ${res.status}`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      window.open(objUrl, '_blank', 'noopener,noreferrer');
      flashOk(
        mode === 'preview' ? 'Vista previa BORRADOR abierta' : 'PDF oficial abierto',
        'PDF listo',
      );
    } catch (e) {
      flashErr(e.message, 'Error PDF');
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
  };

  const goLista = () => {
    clearFlash();
    setDraft(null);
    setEditingId(null);
    setTab('lista');
  };

  const performDeletePresupuesto = async (id) => {
    clearFlash();
    setLoading(true);
    setBusyLabel('Eliminando…');
    try {
      await apiJson(routes.v2Presupuesto(id), { method: 'DELETE' });
      flashOk('Presupuesto eliminado', 'Eliminado');
      if (draft?.id === id) {
        setDraft(null);
        setEditingId(null);
        setTab('lista');
      }
      await loadLista();
    } catch (e) {
      flashErr(e.message);
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
  };

  const askDeletePresupuesto = (id, estado) => {
    const isEmitido = estado === 'EMITIDO';
    askConfirm({
      title: isEmitido ? 'Eliminar emitido' : 'Eliminar borrador',
      message: isEmitido
        ? '¿Eliminar este presupuesto EMITIDO? (modo prueba — no se puede deshacer)'
        : '¿Eliminar este borrador? Esta acción no se puede deshacer.',
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        void performDeletePresupuesto(id);
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/40">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="bg-white/90 border border-slate-200 rounded-2xl shadow-sm px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Back3DButton to="/inicio" title="Volver al Dashboard" />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Presupuestos V2
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Ofertas comerciales · cálculo · emisión · PDF oficial
              </p>
            </div>
          </div>
          {tab !== 'lista' && (
            <button
              type="button"
              onClick={goLista}
              className="text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            >
              ← Volver a Presupuestos
            </button>
          )}
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { id: 'lista', label: 'Lista' },
            { id: 'nuevo', label: 'Nuevo' },
            ...(draft
              ? [
                  {
                    id: 'editor',
                    label: draft.estado === 'EMITIDO' ? 'Detalle' : 'Editar',
                  },
                ]
              : []),
            ...(canConfig ? [{ id: 'config', label: 'Configuración' }] : []),
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                clearFlash();
                if (t.id === 'nuevo') {
                  resetNuevoForm();
                  setDraft(null);
                  setTab('nuevo');
                } else if (t.id === 'lista') {
                  goLista();
                } else {
                  setTab(t.id);
                }
              }}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-red-600 text-red-700 bg-red-50/80'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{busyLabel || 'Cargando…'}</p>
      )}
      {notif.open && (
        <Notification
          type={notif.type}
          title={notif.title}
          message={notif.message}
          duration={4000}
          show
          onClose={() => setNotif((n) => ({ ...n, open: false }))}
        />
      )}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={closeConfirm}
        onConfirm={() => {
          const fn = confirmModal.onConfirm;
          if (typeof fn === 'function') fn();
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
      />

      {tab === 'lista' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800">Listado</h2>
            <button
              type="button"
              className="text-sm px-4 py-2 rounded-xl bg-slate-900 text-white"
              onClick={() => {
                resetNuevoForm();
                setTab('nuevo');
              }}
            >
              Nuevo presupuesto
            </button>
          </div>
          {presupuestos.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-sm">
              No hay presupuestos V2 todavía.
            </div>
          ) : (
            <div className="grid gap-3">
              {presupuestos.map((p) => {
                const totalMes = p.totales?.mensualidad_sin_iva;
                return (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap gap-3 justify-between">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 text-lg">
                            {p.identificador_ui}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.estado === 'EMITIDO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.estado === 'EMITIDO' ? 'Emitido' : 'Borrador'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">
                          {p.cliente_nombre || 'Sin cliente'} · {p.brand?.nombre || '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(p.servicios || []).map((s) => s.nombre).join(' · ') || '—'}
                        </p>
                        <p className="text-xs text-slate-400">
                          Actualizado:{' '}
                          {p.updated_at
                            ? new Date(p.updated_at).toLocaleString('es-ES')
                            : '—'}
                        </p>
                      </div>
                      {totalMes != null && (
                        <div className="text-right text-sm font-semibold">
                          {money(totalMes)} €
                          <div className="text-xs font-normal text-slate-500">mensual s/IVA</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.estado === 'BORRADOR' ? (
                        <>
                          <button type="button" className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white" onClick={() => openEdit(p.id)}>Abrir</button>
                          <button type="button" className="text-sm px-3 py-1.5 rounded-lg border" onClick={() => openPdf(p.id, 'preview')}>PDF preview</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white" onClick={() => openEdit(p.id)}>Ver detalle</button>
                          <button type="button" className="text-sm px-3 py-1.5 rounded-lg border" onClick={() => openPdf(p.id, 'oficial')}>PDF</button>
                          <button type="button" className="text-sm px-3 py-1.5 rounded-lg border" onClick={() => crearNuevaVersion(p.id)}>Nueva versión</button>
                          <button type="button" disabled className="text-sm px-3 py-1.5 rounded-lg border opacity-40 cursor-not-allowed">Enviar</button>
                        </>
                      )}
                      <button
                        type="button"
                        className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-700"
                        onClick={() => askDeletePresupuesto(p.id, p.estado)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'nuevo' && (
        <form
          onSubmit={submitBorrador}
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nuevo presupuesto</h2>
            <p className="text-sm text-slate-500 mt-1">
              Elige cliente, marca y servicios. Podrás ajustar el cálculo después.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
            <select
              className="w-full max-w-xl border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">— Sin cliente (opcional) —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.NOMBRE_O_RAZON_SOCIAL ||
                    c['NOMBRE O RAZON SOCIAL'] ||
                    `Cliente #${c.id}`}
                </option>
              ))}
            </select>
          </div>

          {brands.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Marca comercial
              </label>
              <select
                className="w-full max-w-xl border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                required
              >
                <option value="">— Seleccionar —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                    {b.company?.legal_name ? ` · ${b.company.legal_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {brands.length === 1 && (
            <p className="text-sm text-slate-500">
              Marca: <strong className="text-slate-800">{brands[0].nombre}</strong>
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Servicios
            </label>
            <div className="space-y-2 max-w-2xl">
              {serviciosActivos.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay servicios activos. Créalos en Configuración → Servicios.
                </p>
              ) : (
                serviciosActivos.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-start gap-3 text-sm p-3 rounded-xl border border-slate-200 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedServicioIds.includes(s.id)}
                      onChange={() => toggleServicio(s.id)}
                    />
                    <span>
                      <span className="font-medium text-slate-900">{s.nombre}</span>
                      {s.categoria ? (
                        <span className="text-slate-500"> · {s.categoria}</span>
                      ) : null}
                      {s.descripcion ? (
                        <span className="block text-xs text-slate-400 mt-0.5">
                          {s.descripcion}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || selectedServicioIds.length === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-50"
            >
              Crear borrador
            </button>
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              onClick={() => {
                resetNuevoForm();
                setTab('lista');
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {tab === 'editor' && draft && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap justify-between gap-3 items-start shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {draft.identificador_ui}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {draft.cliente_nombre || 'Sin cliente'}
                {draft.brand?.nombre ? ` · ${draft.brand.nombre}` : ''}
                {' · '}
                <span
                  className={
                    draft.estado === 'EMITIDO'
                      ? 'text-emerald-700 font-medium'
                      : 'text-amber-700 font-medium'
                  }
                >
                  {draft.estado === 'EMITIDO' ? 'Emitido' : 'Borrador'}
                </span>
                {draft.emitted_at
                  ? ` · ${new Date(draft.emitted_at).toLocaleDateString('es-ES')}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.estado === 'BORRADOR' && (
                <>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-sm"
                    disabled={loading}
                    onClick={runCalcular}
                  >
                    Calcular
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border text-sm"
                    disabled={loading}
                    onClick={() => openPdf(draft.id, 'preview')}
                  >
                    Preview PDF
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-indigo-700 text-white text-sm"
                    disabled={loading}
                    onClick={() => runEmitir(false)}
                  >
                    Emitir
                  </button>
                </>
              )}
              {draft.estado === 'EMITIDO' && (
                <>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm"
                    disabled={loading}
                    onClick={() => openPdf(draft.id, 'oficial')}
                  >
                    Ver PDF
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border text-sm"
                    disabled={loading}
                    onClick={() => crearNuevaVersion(draft.id)}
                  >
                    Nueva versión
                  </button>
                </>
              )}
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl border text-sm opacity-50 cursor-not-allowed"
                disabled
                title="Próxima fase"
              >
                Enviar
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl border text-sm"
                onClick={goLista}
              >
                ← Volver
              </button>
            </div>
          </div>

          {emitConflict && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm space-y-2">
              <p className="font-medium text-amber-900">
                El total ha cambiado respecto al último cálculo
              </p>
              <p>
                Antes: {money(emitConflict.total_anterior?.mensualidad_sin_iva)} €/mes
                s/IVA → ahora:{' '}
                {money(emitConflict.total_actual?.mensualidad_sin_iva)} €/mes s/IVA
              </p>
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-amber-800 text-white text-sm"
                onClick={() => runEmitir(true)}
              >
                Confirmar emitir con el total actual
              </button>
            </div>
          )}

          {draft.cliente_status?.ficha_stale && draft.estado === 'BORRADOR' && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm flex flex-wrap gap-2 items-center justify-between">
              <span>Hay datos más recientes del cliente en la ficha.</span>
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-sky-700 text-white text-sm"
                onClick={refreshCliente}
              >
                Actualizar desde ficha
              </button>
            </div>
          )}

          {/* Cliente */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Cliente</h3>
            {draft.estado === 'EMITIDO' ? (
              <div className="text-sm text-slate-700 space-y-1">
                {clienteDisplayLines(mergeClienteWorking(draft)).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {!clienteDisplayLines(mergeClienteWorking(draft)).length && (
                  <p className="text-slate-400">Sin datos de cliente</p>
                )}
              </div>
            ) : (
              <>
                <div className="text-sm text-slate-600 mb-2 space-y-0.5">
                  {clienteDisplayLines(mergeClienteWorking(draft))
                    .slice(0, 3)
                    .map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                </div>
                <p className="text-xs text-slate-500">
                  Ajustes solo para este presupuesto (no modifican la ficha del cliente).
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['direccion_servicio', 'Dirección del servicio'],
                    ['email_envio', 'Email de envío'],
                    ['atencion_de', 'Atención de'],
                    ['contacto_especifico', 'Contacto específico'],
                  ].map(([key, label]) => (
                    <label key={key} className="block text-sm">
                      <span className="text-slate-600">{label}</span>
                      <input
                        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2"
                        value={overridesForm[key]}
                        onChange={(e) =>
                          setOverridesForm((f) => ({ ...f, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-slate-600">Observaciones del documento</span>
                    <textarea
                      className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2"
                      rows={2}
                      value={overridesForm.observaciones_documento}
                      onChange={(e) =>
                        setOverridesForm((f) => ({
                          ...f,
                          observaciones_documento: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                  onClick={saveOverrides}
                  disabled={loading}
                >
                  Guardar datos de cliente
                </button>
              </>
            )}
          </section>

          {/* Oferta / Emisión */}
          <div className="grid gap-4 lg:grid-cols-2">
            {(calcTotales || draft.totales_emitidos_json) && (
              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Oferta</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['mensualidad_sin_iva', 'Mensual sin IVA'],
                    ['mensualidad_con_iva', 'Mensual con IVA'],
                    ['anualidad_sin_iva', 'Anual sin IVA'],
                    ['anualidad_con_iva', 'Anual con IVA'],
                  ].map(([k, label]) => {
                    const t = calcTotales || draft.totales_emitidos_json || {};
                    return (
                      <div
                        key={k}
                        className="flex justify-between gap-3 border-b border-slate-100 py-1.5"
                      >
                        <span className="text-slate-500">{label}</span>
                        <span className="font-semibold text-slate-900">
                          {money(t[k])} €
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900 mb-3">
                Estado / emisión
              </h3>
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="text-slate-500">Estado: </span>
                  {draft.estado === 'EMITIDO' ? 'Emitido' : 'Borrador'}
                </p>
                {draft.estado === 'EMITIDO' && (
                  <>
                    <p>
                      <span className="text-slate-500">Número: </span>
                      <strong>{draft.numero}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Fecha: </span>
                      {draft.emitted_at
                        ? new Date(draft.emitted_at).toLocaleString('es-ES')
                        : '—'}
                    </p>
                    {draft.brand?.nombre && (
                      <p>
                        <span className="text-slate-500">Marca: </span>
                        {draft.brand.nombre}
                      </p>
                    )}
                  </>
                )}
                {draft.estado === 'BORRADOR' && (
                  <p className="text-slate-500">
                    Al emitir se asignará el número oficial y se fijará la oferta.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Servicios + opciones */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900 px-1">Servicios</h3>
            {draft.parent_numero && draft.estado === 'BORRADOR' && (
              <p className="text-sm text-slate-600 px-1">
                {draft.identificador_ui || `Revisión de ${draft.parent_numero}`}
              </p>
            )}
            {Array.isArray(draft.revisado_por) && draft.revisado_por.length > 0 && (
              <p className="text-sm text-emerald-700 px-1">
                Revisado por{' '}
                {draft.revisado_por
                  .map((r) => r?.child_numero || `#${r?.child_id}`)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {(draft.servicios || []).map((line) => {
              const sid = line.servicio?.id || line.id;
              const motor = line.codigo_motor || line.servicio?.codigo_motor;
              const opciones =
                line.opciones?.length > 0
                  ? line.opciones
                  : [
                      {
                        id: null,
                        etiqueta: 'Opción 1',
                        seleccion_tipo: 'ACUMULABLE',
                        inputs_json: line.inputs_json,
                        resultado_json: line.resultado_json,
                      },
                    ];
              const opIds = opciones.map((o) => o.id).filter(Boolean);
              return (
                <div
                  key={line.linea_id || sid}
                  className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {line.nombre || line.servicio?.nombre}
                      </h4>
                      {opciones.length > 1 && (
                        <p className="text-xs text-slate-500 mt-1 max-w-xl">
                          Las alternativas se excluyen entre sí. Los extras se
                          pueden añadir a la alternativa elegida.
                        </p>
                      )}
                    </div>
                    {draft.estado === 'BORRADOR' && (
                      <button
                        type="button"
                        className="text-sm px-3 py-1.5 rounded-lg border border-slate-300"
                        onClick={() => addVariante(line.linea_id)}
                      >
                        + Añadir variante
                      </button>
                    )}
                  </div>

                  <ContenidoLineaEditor
                    value={
                      draft.estado === 'EMITIDO'
                        ? (
                            draft.snapshot_economico_json?.lineas || []
                          ).find((l) => l.servicio_comercial_id === sid)
                            ?.contenido_comercial ||
                          line.contenido_comercial
                        : line.contenido_comercial
                    }
                    personalizado={!!line.contenido_personalizado}
                    disabled={draft.estado === 'EMITIDO'}
                    onSave={(cc) => saveLineaContenido(line.linea_id, cc)}
                    onRestore={() => restoreLineaContenido(line.linea_id)}
                  />

                  {opciones.map((op, opIdx) => {
                    const oid = op.id;
                    const inputs =
                      (oid != null ? lineInputs[oid] : null) ||
                      op.inputs_json ||
                      {};
                    let resultado = null;
                    if (draft.estado === 'EMITIDO') {
                      const snapLine = (
                        draft.snapshot_economico_json?.lineas || []
                      ).find((l) => l.servicio_comercial_id === sid);
                      const snapOp = (snapLine?.opciones || []).find(
                        (o) => o.opcion_id === oid,
                      );
                      resultado =
                        snapOp?.resultado ||
                        snapLine?.resultado ||
                        op.resultado_json;
                    } else {
                      resultado =
                        (oid != null ? lineResults[oid] : null) ||
                        op.resultado_json;
                    }
                    const summary = summarizeServicioInputs(motor, inputs);
                    const showTipoSelector =
                      draft.estado === 'BORRADOR' &&
                      oid &&
                      opciones.length > 1;
                    return (
                      <div
                        key={oid || `op-${opIdx}`}
                        className="border border-slate-100 rounded-xl p-3 space-y-3 bg-slate-50/50"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {draft.estado === 'BORRADOR' && oid ? (
                            <input
                              className="text-sm font-medium border border-slate-200 rounded-lg px-2 py-1 bg-white min-w-[10rem]"
                              defaultValue={op.etiqueta || `Opción ${opIdx + 1}`}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v && v !== op.etiqueta) renameOpcion(oid, v);
                              }}
                            />
                          ) : (
                            <h5 className="text-sm font-semibold text-slate-800">
                              {op.etiqueta || `Opción ${opIdx + 1}`}
                            </h5>
                          )}
                          {draft.estado === 'BORRADOR' && oid && (
                            <>
                              {showTipoSelector && (
                                <select
                                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white max-w-[16rem]"
                                  value={String(
                                    op.seleccion_tipo || 'ACUMULABLE',
                                  ).toUpperCase()}
                                  onChange={(e) =>
                                    setSeleccionTipo(oid, e.target.value)
                                  }
                                  title="Tipo de opción comercial"
                                >
                                  <option value="EXCLUSIVE">
                                    Alternativa — elegir una
                                  </option>
                                  <option value="ACUMULABLE">
                                    Extra — se puede añadir
                                  </option>
                                </select>
                              )}
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded border"
                                onClick={() => moveOpcion(line.linea_id, opIds, opIdx, -1)}
                                disabled={opIdx === 0}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded border"
                                onClick={() => moveOpcion(line.linea_id, opIds, opIdx, 1)}
                                disabled={opIdx === opciones.length - 1}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded border"
                                onClick={() => duplicateOpcion(oid)}
                              >
                                Duplicar
                              </button>
                              {opciones.length > 1 && (
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-700"
                                  onClick={() => deleteOpcion(oid)}
                                >
                                  Eliminar
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {summary.length > 0 && (
                          <p className="text-sm text-slate-600">{summary.join(' · ')}</p>
                        )}
                        {formatJornadaPreview(op.jornada_json).length > 0 && (
                          <p className="text-sm text-slate-600">
                            {formatJornadaPreview(op.jornada_json).join(' · ')}
                          </p>
                        )}
                        {draft.estado === 'BORRADOR' && op.calculated_at && (
                          <p className="text-xs text-slate-400">
                            Calculado{' '}
                            {new Date(op.calculated_at).toLocaleString('es-ES')}
                          </p>
                        )}
                        {oid && (
                          <JornadaEditor
                            disabled={draft.estado === 'EMITIDO'}
                            value={op.jornada_json || {}}
                            onChange={(jornada) => {
                              /* local only until blur/save */
                              setDraft((d) => ({
                                ...d,
                                servicios: (d.servicios || []).map((ln) => ({
                                  ...ln,
                                  opciones: (ln.opciones || []).map((oo) =>
                                    oo.id === oid
                                      ? { ...oo, jornada_json: jornada }
                                      : oo,
                                  ),
                                })),
                              }));
                            }}
                          />
                        )}
                        {draft.estado === 'BORRADOR' && oid && (
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border"
                            onClick={() => saveJornada(oid, op.jornada_json || {})}
                          >
                            Guardar jornada
                          </button>
                        )}
                        {draft.estado === 'EMITIDO' ? (
                          <ResultadoBreakdown resultado={resultado} commercialOnly />
                        ) : (
                          <>
                            <MotorInputsForm
                              codigoMotor={motor}
                              inputs={inputs}
                              onChange={(next) =>
                                setLineInputs((prev) => ({
                                  ...prev,
                                  [oid]: next,
                                }))
                              }
                            />
                            <div className="border-t border-slate-100 pt-3">
                              <h5 className="text-sm font-medium text-slate-700 mb-2">
                                Resultado
                              </h5>
                              <ResultadoBreakdown
                                resultado={resultado}
                                commercialOnly
                              />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <DigitalesEditor
              items={draft.servicios_digitales || draft.servicios_digitales_json || []}
              disabled={draft.estado === 'EMITIDO'}
              onSave={saveDigitales}
            />
            {(totalesDocumento?.ambiguo || calcTotales) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm">
                {totalesDocumento?.ambiguo ? (
                  <p className="text-amber-800">
                    Hay alternativas exclusivas: el total del documento no suma
                    todas las opciones alternativas.
                  </p>
                ) : null}
                {calcTotales && (
                  <p className="mt-1 text-slate-700">
                    Total componentes no ambiguos (mensual s/IVA):{' '}
                    <strong>{money(calcTotales.mensualidad_sin_iva)} €</strong>
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'config' && canConfig && (
        <PresupuestosV2ConfigPanel
          motores={motores}
          onFlash={onConfigFlash}
          onBusy={onConfigBusy}
        />
      )}
    </div>
    </div>
  );
}
