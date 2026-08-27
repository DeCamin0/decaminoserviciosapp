import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../../utils/routes';
import { MotorInputsForm } from './MotorCalcForms';
import { DigitalesEditor } from './JornadaDigitalesEditors';
import { motorLabel, slugifyCodigo } from './v2UiHelpers';

function BrandLogoPreview({ brandId, bust, hasLogo }) {
  const fetchKey = `${brandId}:${bust}:${hasLogo}`;
  const [url, setUrl] = useState(null);
  const [syncKey, setSyncKey] = useState(fetchKey);
  if (fetchKey !== syncKey) {
    setSyncKey(fetchKey);
    setUrl(null);
  }

  useEffect(() => {
    if (!hasLogo) return undefined;

    let revoked = false;
    let objectUrl = null;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(
          `${routes.v2ConfigBrandLogo(brandId)}?t=${bust || ''}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          if (!revoked) setUrl(null);
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!revoked) setUrl(objectUrl);
      } catch {
        if (!revoked) setUrl(null);
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [brandId, bust, hasLogo]);
  if (!hasLogo || !url) {
    return (
      <div className="h-16 w-28 border border-dashed rounded-xl flex items-center justify-center text-xs text-slate-400">
        Sin logo
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="Logo marca"
      className="h-16 w-auto max-w-[180px] object-contain border rounded-xl bg-white p-2"
    />
  );
}

const DEFAULT_BRAND_DIGITALES = [
  {
    codigo: 'vecindario',
    nombre: 'Vecindario',
    precio_referencia_mensual: 25,
    descuento_pct: 100,
    descripcion: 'App de comunicación con la comunidad',
    activo: true,
    orden: 0,
  },
];

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
    err.payload = typeof data?.message === 'object' ? data.message : data;
    throw err;
  }
  return data;
}

function linesToText(arr) {
  return Array.isArray(arr) ? arr.join('\n') : '';
}
function textToLines(text) {
  return String(text || '')
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const emptyContenido = () => ({
  titulo_comercial: '',
  descripcion_comercial: '',
  operativa: '',
  tareas: '',
  tareas_auxiliares: '',
  tareas_limpieza: '',
  periodicos_text: '',
  condiciones_especificas: '',
  imagen_ref: '',
  periodicidad: '',
  template_key: '',
});

/**
 * Full Configuración panel for Presupuestos V2 (Servicios | Parámetros | Series | Empresa).
 */
export default function PresupuestosV2ConfigPanel({
  motores,
  onFlash,
  onBusy,
}) {
  const [subtab, setSubtab] = useState('servicios');
  const [loading, setLoading] = useState(false);
  const onFlashRef = useRef(onFlash);
  const onBusyRef = useRef(onBusy);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    onFlashRef.current = onFlash;
  }, [onFlash]);
  useEffect(() => {
    onBusyRef.current = onBusy;
  }, [onBusy]);

  const [servicios, setServicios] = useState([]);
  const [parametros, setParametros] = useState([]);
  const [paramAudit, setParamAudit] = useState([]);
  const [series, setSeries] = useState([]);
  const [presets, setPresets] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [bloqueEdits, setBloqueEdits] = useState({});

  const [svcForm, setSvcForm] = useState({
    id: null,
    codigo_interno: '',
    codigo_manual: false,
    nombre: '',
    descripcion: '',
    categoria: '',
    codigo_motor: '',
    activo: true,
    orden: 10,
    defaults: {},
    contenido: emptyContenido(),
  });

  const [paramEdits, setParamEdits] = useState({});
  const [serieEdits, setSerieEdits] = useState({});
  const [companyEdits, setCompanyEdits] = useState({});
  const [brandEdits, setBrandEdits] = useState({});

  const loadAll = useCallback(async ({ notifyParent = true } = {}) => {
    setLoading(true);
    if (notifyParent) onBusyRef.current?.(true, 'Cargando configuración…');
    try {
      const [s, p, ser, pre, co, b, aud, bl] = await Promise.all([
        apiJson(routes.v2ConfigServiciosComerciales),
        apiJson(routes.v2ConfigParametros),
        apiJson(routes.v2ConfigSeries),
        apiJson(routes.v2ConfigSeriePresets).catch(() => ({ data: [] })),
        apiJson(routes.v2ConfigCompanies),
        apiJson(routes.v2ConfigBrands),
        apiJson(routes.v2ConfigParametrosAudit).catch(() => ({ data: [] })),
        apiJson(routes.v2ConfigContenidoBloques).catch(() => ({ data: [] })),
      ]);
      setServicios(s.data || []);
      setParametros(p.data || []);
      setSeries(ser.data || []);
      setPresets(pre.data || []);
      setCompanies(co.data || []);
      setBrands(b.data || []);
      setParamAudit(aud.data || []);
      setBloques(bl.data || []);
      const pe = {};
      (p.data || []).forEach((row) => {
        pe[row.clave] = row.valor_display;
      });
      setParamEdits(pe);
    } catch (e) {
      onFlashRef.current?.('error', e.message || 'Error al cargar configuración');
    } finally {
      setLoading(false);
      if (notifyParent) onBusyRef.current?.(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    // Initial load: local spinner only — avoid parent setLoading loops.
    loadAll({ notifyParent: false });
  }, [loadAll]);

  const resetSvc = () => {
    setSvcForm({
      id: null,
      codigo_interno: '',
      codigo_manual: false,
      nombre: '',
      descripcion: '',
      categoria: '',
      codigo_motor: motores[0]?.codigo || '',
      activo: true,
      orden: ((servicios || []).length + 1) * 10,
      defaults: {},
      contenido: emptyContenido(),
    });
  };

  const editSvc = (s) => {
    const cc = s.contenido_comercial_json || {};
    setSvcForm({
      id: s.id,
      codigo_interno: s.codigo_interno,
      codigo_manual: true,
      nombre: s.nombre,
      descripcion: s.descripcion || '',
      categoria: s.categoria || '',
      codigo_motor: s.codigo_motor,
      activo: !!s.activo,
      orden: s.orden ?? 0,
      defaults:
        s.defaults_json && typeof s.defaults_json === 'object'
          ? s.defaults_json
          : {},
      contenido: {
        titulo_comercial: cc.titulo_comercial || '',
        descripcion_comercial: cc.descripcion_comercial || '',
        operativa: linesToText(cc.operativa),
        tareas: linesToText(cc.tareas),
        tareas_auxiliares: linesToText(cc.tareas_auxiliares),
        tareas_limpieza: linesToText(cc.tareas_limpieza),
        periodicos_text: (cc.servicios_periodicos || [])
          .map((p) =>
            [p.nombre, p.periodicidad, p.descripcion]
              .filter(Boolean)
              .join(' | '),
          )
          .join('\n'),
        condiciones_especificas: linesToText(cc.condiciones_especificas),
        imagen_ref: cc.imagen_ref || '',
        periodicidad: cc.periodicidad || '',
        template_key: cc.template_key || '',
      },
    });
    setSubtab('servicios');
  };

  const submitSvc = async (e) => {
    e.preventDefault();
    const codigo = (svcForm.codigo_interno || slugifyCodigo(svcForm.nombre)).trim();
    if (!svcForm.id) {
      if (!codigo) {
        onFlash?.('error', 'Indica un nombre para generar el código');
        return;
      }
      if (
        servicios.some(
          (s) => String(s.codigo_interno).toLowerCase() === codigo.toLowerCase(),
        )
      ) {
        onFlash?.('error', `Ya existe el código «${codigo}»`);
        return;
      }
    }
    onBusy?.(true, 'Guardando servicio…');
    try {
      const contenido_comercial_json = {
        titulo_comercial: svcForm.contenido.titulo_comercial || svcForm.nombre,
        descripcion_comercial: svcForm.contenido.descripcion_comercial || null,
        operativa: textToLines(svcForm.contenido.operativa),
        tareas: textToLines(svcForm.contenido.tareas),
        tareas_auxiliares: textToLines(svcForm.contenido.tareas_auxiliares),
        tareas_limpieza: textToLines(svcForm.contenido.tareas_limpieza),
        servicios_periodicos: String(svcForm.contenido.periodicos_text || '')
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, i) => {
            const parts = line.split('|').map((s) => s.trim());
            return {
              nombre: parts[0] || line,
              periodicidad: parts[1] || '',
              descripcion: parts[2] || null,
              orden: i,
            };
          }),
        condiciones_especificas: textToLines(
          svcForm.contenido.condiciones_especificas,
        ),
        imagen_ref: svcForm.contenido.imagen_ref || null,
        periodicidad: svcForm.contenido.periodicidad || null,
        template_key: svcForm.contenido.template_key || null,
      };
      const payload = {
        nombre: svcForm.nombre,
        descripcion: svcForm.descripcion || null,
        categoria: svcForm.categoria || null,
        codigo_motor: svcForm.codigo_motor,
        activo: svcForm.activo,
        orden: Number(svcForm.orden) || 0,
        defaults_json:
          svcForm.defaults && Object.keys(svcForm.defaults).length
            ? svcForm.defaults
            : null,
        contenido_comercial_json,
      };
      if (svcForm.id) {
        await apiJson(routes.v2ConfigServicioComercial(svcForm.id), {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onFlash?.('ok', 'Servicio actualizado');
      } else {
        await apiJson(routes.v2ConfigServiciosComerciales, {
          method: 'POST',
          body: JSON.stringify({ codigo_interno: codigo, ...payload }),
        });
        onFlash?.('ok', 'Servicio creado');
      }
      resetSvc();
      await loadAll();
    } catch (err) {
      onFlash?.('error', err.message);
    } finally {
      onBusy?.(false);
    }
  };

  const saveParam = async (clave) => {
    onBusy?.(true, 'Guardando parámetro…');
    try {
      await apiJson(routes.v2ConfigParametro(clave), {
        method: 'PUT',
        body: JSON.stringify({ valor_display: Number(paramEdits[clave]) }),
      });
      onFlash?.('ok', 'Parámetro actualizado');
      await loadAll();
    } catch (err) {
      onFlash?.('error', err.message);
    } finally {
      onBusy?.(false);
    }
  };

  const paramsByGroup = useMemo(() => {
    const map = {};
    for (const p of parametros) {
      if (!map[p.group]) map[p.group] = [];
      map[p.group].push(p);
    }
    return map;
  }, [parametros]);

  const saveSerie = async (serie) => {
    const edit = serieEdits[serie.id] || {};
    onBusy?.(true, 'Guardando serie…');
    try {
      const body = {
        prefijo: edit.prefijo ?? serie.prefijo,
        formato_preset: edit.formato_preset || serie.formato,
        padding: Number(edit.padding ?? serie.padding),
        reset_anual:
          edit.reset_anual != null ? edit.reset_anual : serie.reset_anual,
        activo: edit.activo != null ? edit.activo : serie.activo,
      };
      if (edit.siguiente_numero != null && edit.siguiente_numero !== '') {
        body.siguiente_numero = Number(edit.siguiente_numero);
        body.confirm_counter_change = Boolean(edit.confirm_counter_change);
      }
      const res = await apiJson(routes.v2ConfigSerie(serie.id), {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      onFlash?.(
        'ok',
        `Serie guardada · vista previa: ${res.data?.vista_previa || '—'}`,
      );
      setSerieEdits((e) => ({ ...e, [serie.id]: undefined }));
      await loadAll();
    } catch (err) {
      onFlash?.('error', err.message);
    } finally {
      onBusy?.(false);
    }
  };

  const previewSerieLocal = (serie) => {
    const edit = serieEdits[serie.id] || {};
    const pref = String(edit.prefijo ?? serie.prefijo ?? 'MAD').toUpperCase();
    const pad = Number(edit.padding ?? serie.padding ?? 4) || 4;
    const seq = Number(edit.siguiente_numero ?? serie.siguiente_numero ?? 1) || 1;
    const year = new Date().getFullYear();
    const fmt = edit.formato_preset || serie.formato || '{PREF}-{YYYY}-{SEQ}';
    const formato =
      presets.find((p) => p.id === fmt)?.formato ||
      presets.find((p) => p.formato === fmt)?.formato ||
      fmt;
    return formato
      .replace('{PREF}', pref)
      .replace('{YYYY}', String(year))
      .replace('{YY}', String(year).slice(-2))
      .replace('{SEQ}', String(seq).padStart(pad, '0'));
  };

  const saveCompany = async (company) => {
    const edit = companyEdits[company.id] || {};
    const fiscales = {
      ...(company.datos_fiscales_json || {}),
      cp: edit.cp ?? company.datos_fiscales_json?.cp ?? '',
      poblacion: edit.poblacion ?? company.datos_fiscales_json?.poblacion ?? '',
      provincia: edit.provincia ?? company.datos_fiscales_json?.provincia ?? '',
      pais: edit.pais ?? company.datos_fiscales_json?.pais ?? 'España',
      telefono: edit.telefono ?? company.datos_fiscales_json?.telefono ?? '',
      email: edit.email ?? company.datos_fiscales_json?.email ?? '',
      web: edit.web ?? company.datos_fiscales_json?.web ?? '',
    };
    onBusy?.(true, 'Guardando empresa…');
    try {
      await apiJson(routes.v2ConfigCompany(company.id), {
        method: 'PUT',
        body: JSON.stringify({
          legal_name: edit.legal_name ?? company.legal_name,
          cif: edit.cif ?? company.cif,
          direccion_fiscal: edit.direccion_fiscal ?? company.direccion_fiscal,
          logo_ref: edit.logo_ref ?? company.logo_ref,
          datos_fiscales: fiscales,
        }),
      });
      onFlash?.('ok', 'Empresa actualizada');
      await loadAll();
    } catch (err) {
      onFlash?.('error', err.message);
    } finally {
      onBusy?.(false);
    }
  };

  const saveBrand = async (brand) => {
    const edit = brandEdits[brand.id] || {};
    const prev = brand.config_json || {};
    const config = {
      ...prev,
      brandColor: edit.brandColor ?? prev.brandColor ?? '#B91C1C',
      portadaBg: edit.portadaBg ?? prev.portadaBg ?? edit.brandColor ?? prev.brandColor,
      phone: edit.phone ?? prev.phone ?? '',
      email: edit.email ?? prev.email ?? '',
      website: edit.website ?? prev.website ?? '',
      validez_dias: Number(edit.validez_dias ?? prev.validez_dias ?? 60),
      presentacion: textToLines(edit.presentacion ?? linesToText(prev.presentacion)),
      garantia: textToLines(edit.garantia ?? linesToText(prev.garantia)),
      condiciones_pdf: textToLines(
        edit.condiciones_pdf ?? linesToText(prev.condiciones_pdf),
      ),
      aceptacion_texto:
        edit.aceptacion_texto ?? prev.aceptacion_texto ?? '',
      servicios_digitales:
        edit.servicios_digitales ??
        prev.servicios_digitales ??
        DEFAULT_BRAND_DIGITALES,
    };
    onBusy?.(true, 'Guardando marca…');
    try {
      await apiJson(routes.v2ConfigBrand(brand.id), {
        method: 'PUT',
        body: JSON.stringify({
          nombre: edit.nombre ?? brand.nombre,
          logo_ref: edit.logo_ref ?? brand.logo_ref,
          config,
        }),
      });
      onFlash?.('ok', 'Marca actualizada');
      await loadAll();
    } catch (err) {
      onFlash?.('error', err.message);
    } finally {
      onBusy?.(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 pt-4">
        <h2 className="text-lg font-semibold text-slate-900">Configuración</h2>
        <p className="text-sm text-slate-500 mt-1">
          Empresa, marca, series, parámetros y contenido comercial de servicios
        </p>
      </div>
      <div className="mt-3 flex gap-1 overflow-x-auto px-2 sm:px-3 border-b border-slate-100">
        {[
          { id: 'servicios', label: 'Servicios' },
          { id: 'contenido', label: 'Contenido / Plantillas' },
          { id: 'parametros', label: 'Parámetros' },
          { id: 'series', label: 'Series' },
          { id: 'empresa', label: 'Empresa y marca' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubtab(t.id)}
            className={`shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 ${
              subtab === t.id
                ? 'border-red-600 text-red-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="p-4 text-sm text-slate-500">Cargando…</p>
      )}

      {subtab === 'servicios' && (
        <div className="p-4 sm:p-5 space-y-6">
          <form onSubmit={submitSvc} className="space-y-4 max-w-3xl">
            <h3 className="font-medium text-slate-800">
              {svcForm.id ? 'Editar servicio' : 'Nuevo servicio'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre
              </label>
              <input
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                value={svcForm.nombre}
                onChange={(e) => {
                  const nombre = e.target.value;
                  setSvcForm((f) => ({
                    ...f,
                    nombre,
                    codigo_interno: f.codigo_manual
                      ? f.codigo_interno
                      : slugifyCodigo(nombre),
                  }));
                }}
                required
              />
            </div>
            {!svcForm.id && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Código interno
                </label>
                <input
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono"
                  value={svcForm.codigo_interno}
                  onChange={(e) =>
                    setSvcForm((f) => ({
                      ...f,
                      codigo_interno: e.target.value,
                      codigo_manual: true,
                    }))
                  }
                />
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-700 font-medium">Categoría</span>
                <input
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2"
                  value={svcForm.categoria}
                  onChange={(e) =>
                    setSvcForm((f) => ({ ...f, categoria: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700 font-medium">Motor de cálculo</span>
                <select
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2"
                  value={svcForm.codigo_motor}
                  onChange={(e) =>
                    setSvcForm((f) => ({
                      ...f,
                      codigo_motor: e.target.value,
                      defaults: {},
                    }))
                  }
                  required
                >
                  <option value="">—</option>
                  {motores.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {motorLabel(m.codigo, motores)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 mt-1 block">
                  Determina cómo se calculará el precio de este servicio.
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">
                Contenido comercial (PDF)
              </h4>
              <label className="block text-sm">
                <span className="text-slate-600">Título comercial</span>
                <input
                  className="mt-1 w-full border rounded-xl px-3 py-2"
                  value={svcForm.contenido.titulo_comercial}
                  onChange={(e) =>
                    setSvcForm((f) => ({
                      ...f,
                      contenido: {
                        ...f.contenido,
                        titulo_comercial: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Descripción comercial</span>
                <textarea
                  className="mt-1 w-full border rounded-xl px-3 py-2"
                  rows={2}
                  value={svcForm.contenido.descripcion_comercial}
                  onChange={(e) =>
                    setSvcForm((f) => ({
                      ...f,
                      contenido: {
                        ...f.contenido,
                        descripcion_comercial: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              {[
                ['operativa', 'Operativa (una línea por punto)'],
                ['tareas', 'Tareas generales (servicios simples)'],
                ['tareas_auxiliares', 'Tareas Auxiliar (servicios combinados)'],
                ['tareas_limpieza', 'Tareas Limpieza (servicios combinados)'],
                [
                  'periodicos_text',
                  'Periódicos incluidos (una línea: Nombre | periodicidad | descripción)',
                ],
                ['condiciones_especificas', 'Condiciones específicas'],
              ].map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="text-slate-600">{label}</span>
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    rows={3}
                    value={svcForm.contenido[key] || ''}
                    onChange={(e) =>
                      setSvcForm((f) => ({
                        ...f,
                        contenido: { ...f.contenido, [key]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-600">Periodicidad (texto libre)</span>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    value={svcForm.contenido.periodicidad}
                    onChange={(e) =>
                      setSvcForm((f) => ({
                        ...f,
                        contenido: {
                          ...f.contenido,
                          periodicidad: e.target.value,
                        },
                      }))
                    }
                    placeholder="ej. Mensual"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">Plantilla PDF</span>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    value={svcForm.contenido.template_key || ''}
                    onChange={(e) =>
                      setSvcForm((f) => ({
                        ...f,
                        contenido: {
                          ...f.contenido,
                          template_key: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">General</option>
                    <option value="auxiliar_limpieza">
                      Auxiliar + Limpieza
                    </option>
                    <option value="auxiliares">Auxiliares</option>
                    <option value="limpieza">Limpieza</option>
                    <option value="jardineria">Jardinería</option>
                    <option value="cubos">Cubos</option>
                    <option value="garaje">Garaje</option>
                    <option value="piscina">Piscina</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-slate-600">Imagen / asset (referencia)</span>
                <input
                  className="mt-1 w-full border rounded-xl px-3 py-2 font-mono text-xs"
                  value={svcForm.contenido.imagen_ref}
                  onChange={(e) =>
                    setSvcForm((f) => ({
                      ...f,
                      contenido: {
                        ...f.contenido,
                        imagen_ref: e.target.value,
                      },
                    }))
                  }
                  placeholder="ruta o key de storage"
                />
              </label>
            </div>

            {svcForm.codigo_motor && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                <h4 className="text-sm font-medium text-slate-800">
                  Valores por defecto del cálculo
                </h4>
                <MotorInputsForm
                  codigoMotor={svcForm.codigo_motor}
                  inputs={svcForm.defaults}
                  onChange={(next) =>
                    setSvcForm((f) => ({ ...f, defaults: next }))
                  }
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svcForm.activo}
                  onChange={(e) =>
                    setSvcForm((f) => ({ ...f, activo: e.target.checked }))
                  }
                />
                Activo
              </label>
              <label className="text-sm">
                Orden de visualización
                <input
                  type="number"
                  className="ml-2 w-24 border rounded-xl px-2 py-1.5"
                  value={svcForm.orden}
                  onChange={(e) =>
                    setSvcForm((f) => ({ ...f, orden: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm"
              >
                {svcForm.id ? 'Actualizar' : 'Crear'}
              </button>
              {svcForm.id && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border text-sm"
                  onClick={resetSvc}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <ul className="divide-y border border-slate-200 rounded-2xl overflow-hidden">
            {servicios.map((s) => (
              <li
                key={s.id}
                className="px-4 py-3 flex justify-between gap-2 items-start"
              >
                <div>
                  <div className="font-medium text-slate-900">
                    {s.nombre}
                    {!s.activo && (
                      <span className="ml-2 text-xs text-amber-700">inactivo</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    {s.categoria || 'Sin categoría'} ·{' '}
                    {motorLabel(s.codigo_motor, motores)}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm px-3 py-1.5 border rounded-xl"
                  onClick={() => editSvc(s)}
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subtab === 'contenido' && (
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Bloques reutilizables (textos Legacy). Editar aquí no cambia
            presupuestos ya emitidos. Los servicios los referencian por código.
          </p>
          {bloques.map((b) => {
            const body = b.body_json || {};
            const edit = bloqueEdits[b.id];
            const itemsText =
              edit?.itemsText ??
              (Array.isArray(body.items) ? body.items.join('\n') : '');
            const usado =
              (b.usado_en || []).map((s) => s.nombre).join(', ') || '—';
            return (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 p-4 space-y-2"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-slate-900">{b.nombre}</h4>
                    <p className="text-xs text-slate-500">
                      {b.codigo} · {b.categoria || 'general'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Usado en: {usado}
                    </p>
                  </div>
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        edit?.activo != null ? edit.activo : b.activo !== false
                      }
                      onChange={(e) =>
                        setBloqueEdits((x) => ({
                          ...x,
                          [b.id]: {
                            ...edit,
                            itemsText,
                            activo: e.target.checked,
                          },
                        }))
                      }
                    />
                    Activo
                  </label>
                </div>
                {Array.isArray(body.items) && (
                  <label className="block text-sm">
                    <span className="text-slate-600">
                      Ítems (uno por línea)
                    </span>
                    <textarea
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                      rows={6}
                      value={itemsText}
                      onChange={(e) =>
                        setBloqueEdits((x) => ({
                          ...x,
                          [b.id]: {
                            ...edit,
                            itemsText: e.target.value,
                            activo:
                              edit?.activo != null
                                ? edit.activo
                                : b.activo !== false,
                          },
                        }))
                      }
                    />
                  </label>
                )}
                {!Array.isArray(body.items) && (
                  <p className="text-xs text-slate-500">
                    Estructura {body.tipo || 'compuesta'} — se edita desde
                    servicios/plantilla o se puede ampliar en una siguiente
                    iteración de UI.
                  </p>
                )}
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm"
                  onClick={async () => {
                    onBusy?.(true, 'Guardando bloque…');
                    try {
                      const nextBody = { ...body };
                      if (Array.isArray(body.items)) {
                        nextBody.items = String(
                          bloqueEdits[b.id]?.itemsText ?? itemsText,
                        )
                          .split(/\n+/)
                          .map((x) => x.trim())
                          .filter(Boolean);
                      }
                      await apiJson(routes.v2ConfigContenidoBloque(b.id), {
                        method: 'PUT',
                        body: JSON.stringify({
                          body_json: nextBody,
                          activo:
                            bloqueEdits[b.id]?.activo != null
                              ? bloqueEdits[b.id].activo
                              : b.activo,
                        }),
                      });
                      onFlash?.('ok', 'Bloque actualizado');
                      await loadAll();
                    } catch (err) {
                      onFlash?.('error', err.message);
                    } finally {
                      onBusy?.(false);
                    }
                  }}
                >
                  Guardar bloque
                </button>
              </div>
            );
          })}
          {!bloques.length && (
            <p className="text-sm text-slate-500">
              Sin bloques todavía. Se cargan al arrancar el backend.
            </p>
          )}
        </div>
      )}

      {subtab === 'parametros' && (
        <div className="p-4 sm:p-5 space-y-6">
          {Object.entries(paramsByGroup).map(([group, rows]) => (
            <div key={group} className="space-y-3">
              <h3 className="font-semibold text-slate-800">{group}</h3>
              <div className="grid gap-3">
                {rows.map((p) => (
                  <div
                    key={p.clave}
                    className="rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end justify-between"
                  >
                    <div className="min-w-[200px] flex-1">
                      <div className="font-medium text-slate-900">{p.label}</div>
                      <p className="text-xs text-slate-500 mt-0.5">{p.helper}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        className="w-28 border rounded-xl px-3 py-2 text-sm"
                        value={paramEdits[p.clave] ?? ''}
                        onChange={(e) =>
                          setParamEdits((x) => ({
                            ...x,
                            [p.clave]: e.target.value,
                          }))
                        }
                      />
                      <span className="text-sm text-slate-500 w-6">
                        {p.unit_suffix}
                      </span>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm"
                        onClick={() => saveParam(p.clave)}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {paramAudit.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Historial reciente
              </h3>
              <ul className="text-xs text-slate-600 space-y-1 max-h-40 overflow-auto">
                {paramAudit.slice(0, 15).map((a) => (
                  <li key={a.id}>
                    {new Date(a.created_at).toLocaleString('es-ES')} ·{' '}
                    {a.entity_id} · {a.actor || '—'} ·{' '}
                    {a.payload_json?.display_old ?? a.payload_json?.old} →{' '}
                    {a.payload_json?.display_new ?? a.payload_json?.new}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {subtab === 'series' && (
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-sm text-slate-600">
            El contador solo puede ajustarlo un Developer. No puede bajar por debajo
            de números ya emitidos.
          </p>
          {series.map((serie) => {
            const edit = serieEdits[serie.id] || {};
            return (
              <div
                key={serie.id}
                className="rounded-xl border border-slate-200 p-4 space-y-3"
              >
                <div className="font-medium text-slate-900">
                  {serie.brand?.nombre || 'Marca'} · serie {serie.codigo}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-sm">
                    Prefijo
                    <input
                      className="mt-1 w-full border rounded-xl px-3 py-2 uppercase"
                      value={edit.prefijo ?? serie.prefijo}
                      onChange={(e) =>
                        setSerieEdits((x) => ({
                          ...x,
                          [serie.id]: {
                            ...edit,
                            prefijo: e.target.value.toUpperCase(),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Formato
                    <select
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={
                        edit.formato_preset ||
                        presets.find((p) => p.formato === serie.formato)?.id ||
                        serie.formato
                      }
                      onChange={(e) =>
                        setSerieEdits((x) => ({
                          ...x,
                          [serie.id]: {
                            ...edit,
                            formato_preset: e.target.value,
                          },
                        }))
                      }
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Padding
                    <input
                      type="number"
                      min={1}
                      max={8}
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={edit.padding ?? serie.padding}
                      onChange={(e) =>
                        setSerieEdits((x) => ({
                          ...x,
                          [serie.id]: { ...edit, padding: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={
                        edit.reset_anual != null
                          ? edit.reset_anual
                          : serie.reset_anual
                      }
                      onChange={(e) =>
                        setSerieEdits((x) => ({
                          ...x,
                          [serie.id]: {
                            ...edit,
                            reset_anual: e.target.checked,
                          },
                        }))
                      }
                    />
                    Reinicio anual
                  </label>
                </div>
                <p className="text-sm">
                  <span className="text-slate-500">Vista previa: </span>
                  <strong className="font-mono">{previewSerieLocal(serie)}</strong>
                </p>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm space-y-2">
                  <p className="text-amber-900">
                    Siguiente número actual: <strong>{serie.siguiente_numero}</strong>
                  </p>
                  <label className="block text-xs text-amber-800">
                    Ajuste de contador (solo Developer)
                    <input
                      type="number"
                      className="mt-1 w-32 border rounded-lg px-2 py-1"
                      placeholder={String(serie.siguiente_numero)}
                      value={edit.siguiente_numero ?? ''}
                      onChange={(e) =>
                        setSerieEdits((x) => ({
                          ...x,
                          [serie.id]: {
                            ...edit,
                            siguiente_numero: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-amber-800">
                    <input
                      type="checkbox"
                      checked={!!edit.confirm_counter_change}
                      onChange={(e) =>
                        setSerieEdits((x) => ({
                          ...x,
                          [serie.id]: {
                            ...edit,
                            confirm_counter_change: e.target.checked,
                          },
                        }))
                      }
                    />
                    Confirmo el cambio de contador (riesgo de huecos/duplicados)
                  </label>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm"
                  onClick={() => saveSerie(serie)}
                >
                  Guardar serie
                </button>
              </div>
            );
          })}
        </div>
      )}

      {subtab === 'empresa' && (
        <div className="p-4 sm:p-5 space-y-6">
          {companies.map((company) => {
            const edit = companyEdits[company.id] || {};
            const df = company.datos_fiscales_json || {};
            return (
              <div
                key={company.id}
                className="rounded-xl border border-slate-200 p-4 space-y-3"
              >
                <h3 className="font-semibold text-slate-900">Empresa</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    ['legal_name', 'Razón social', company.legal_name],
                    ['cif', 'CIF', company.cif],
                    ['direccion_fiscal', 'Dirección', company.direccion_fiscal],
                    ['cp', 'Código postal', df.cp],
                    ['poblacion', 'Población', df.poblacion],
                    ['provincia', 'Provincia', df.provincia],
                    ['pais', 'País', df.pais || 'España'],
                    ['telefono', 'Teléfono', df.telefono],
                    ['email', 'Email', df.email],
                    ['web', 'Web', df.web],
                    ['logo_ref', 'Logo (referencia)', company.logo_ref],
                  ].map(([key, label, current]) => (
                    <label key={key} className="text-sm block">
                      <span className="text-slate-600">{label}</span>
                      <input
                        className="mt-1 w-full border rounded-xl px-3 py-2"
                        value={edit[key] ?? current ?? ''}
                        onChange={(e) =>
                          setCompanyEdits((x) => ({
                            ...x,
                            [company.id]: { ...edit, [key]: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm"
                  onClick={() => saveCompany(company)}
                >
                  Guardar empresa
                </button>
              </div>
            );
          })}

          {brands.map((brand) => {
            const edit = brandEdits[brand.id] || {};
            const cfg = brand.config_json || {};
            return (
              <div
                key={brand.id}
                className="rounded-xl border border-slate-200 p-4 space-y-3"
              >
                <h3 className="font-semibold text-slate-900">
                  Marca · {brand.nombre}
                </h3>
                <p className="text-xs text-slate-500">
                  Empresa: {brand.company?.legal_name || '—'}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-sm">
                    Nombre comercial
                    <input
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={edit.nombre ?? brand.nombre}
                      onChange={(e) =>
                        setBrandEdits((x) => ({
                          ...x,
                          [brand.id]: { ...edit, nombre: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Color de marca
                    <input
                      type="color"
                      className="mt-1 w-full h-10 border rounded-xl"
                      value={edit.brandColor ?? cfg.brandColor ?? '#B91C1C'}
                      onChange={(e) =>
                        setBrandEdits((x) => ({
                          ...x,
                          [brand.id]: { ...edit, brandColor: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Teléfono comercial
                    <input
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={edit.phone ?? cfg.phone ?? ''}
                      onChange={(e) =>
                        setBrandEdits((x) => ({
                          ...x,
                          [brand.id]: { ...edit, phone: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Email comercial
                    <input
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={edit.email ?? cfg.email ?? ''}
                      onChange={(e) =>
                        setBrandEdits((x) => ({
                          ...x,
                          [brand.id]: { ...edit, email: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Web
                    <input
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={edit.website ?? cfg.website ?? ''}
                      onChange={(e) =>
                        setBrandEdits((x) => ({
                          ...x,
                          [brand.id]: { ...edit, website: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Validez presupuesto (días)
                    <input
                      type="number"
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={edit.validez_dias ?? cfg.validez_dias ?? 60}
                      onChange={(e) =>
                        setBrandEdits((x) => ({
                          ...x,
                          [brand.id]: {
                            ...edit,
                            validez_dias: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <div className="text-sm sm:col-span-2 space-y-2">
                    <span className="font-medium text-slate-700">Logo</span>
                    <div className="flex flex-wrap items-start gap-4">
                      <BrandLogoPreview
                        brandId={brand.id}
                        bust={edit.logo_bust || brand.updated_at || ''}
                        hasLogo={Boolean(edit.logo_ref ?? brand.logo_ref)}
                      />
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="block text-xs"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            onBusy?.(true, 'Subiendo logo…');
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const token = localStorage.getItem('auth_token');
                              const res = await fetch(
                                routes.v2ConfigBrandLogo(brand.id),
                                {
                                  method: 'POST',
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: fd,
                                },
                              );
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                throw new Error(
                                  data?.message || `Error ${res.status}`,
                                );
                              }
                              onFlash?.('ok', 'Logo actualizado');
                              setBrandEdits((x) => ({
                                ...x,
                                [brand.id]: {
                                  ...edit,
                                  logo_ref: data?.data?.logo_ref,
                                  logo_bust: Date.now(),
                                },
                              }));
                              await loadAll();
                            } catch (err) {
                              onFlash?.('error', err.message);
                            } finally {
                              onBusy?.(false);
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  '¿Quitar el logo de esta marca?',
                                )
                              ) {
                                return;
                              }
                              onBusy?.(true, 'Eliminando logo…');
                              try {
                                await apiJson(
                                  routes.v2ConfigBrandLogo(brand.id),
                                  { method: 'DELETE' },
                                );
                                onFlash?.('ok', 'Logo eliminado');
                                setBrandEdits((x) => ({
                                  ...x,
                                  [brand.id]: {
                                    ...edit,
                                    logo_ref: null,
                                    logo_bust: Date.now(),
                                  },
                                }));
                                await loadAll();
                              } catch (err) {
                                onFlash?.('error', err.message);
                              } finally {
                                onBusy?.(false);
                              }
                            }}
                          >
                            Eliminar logo
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">
                          PNG, JPG o WebP · máx. 3 MB. Los PDF ya emitidos
                          conservan el logo de su emisión.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {[
                  ['presentacion', 'Presentación (párrafos, uno por línea)'],
                  ['garantia', 'Garantía (puntos)'],
                  ['condiciones_pdf', 'Condiciones contractuales (puntos)'],
                ].map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="text-slate-600">{label}</span>
                    <textarea
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      rows={3}
                      value={
                        edit[key] ?? linesToText(cfg[key])
                      }
                      onChange={(e) =>
                        setBrandEdits((x) => ({
                          ...x,
                          [brand.id]: { ...edit, [key]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  Texto de aceptación
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    rows={2}
                    value={edit.aceptacion_texto ?? cfg.aceptacion_texto ?? ''}
                    onChange={(e) =>
                      setBrandEdits((x) => ({
                        ...x,
                        [brand.id]: {
                          ...edit,
                          aceptacion_texto: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <DigitalesEditor
                  items={
                    edit.servicios_digitales ??
                    cfg.servicios_digitales ??
                    DEFAULT_BRAND_DIGITALES
                  }
                  saveLabel="Aplicar digitales a la marca"
                  onSave={(list) =>
                    setBrandEdits((x) => ({
                      ...x,
                      [brand.id]: { ...edit, servicios_digitales: list },
                    }))
                  }
                />
                <p className="text-xs text-slate-500">
                  Defaults para nuevos presupuestos (Vecindario, etc.). Luego
                  pulsa Guardar marca.
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm"
                  onClick={() => saveBrand(brand)}
                >
                  Guardar marca
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
