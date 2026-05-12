import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { routes } from '../utils/routes';
import { config } from '../config/env';
import PortalAuthChrome, {
  PortalGhostButton,
  PortalPrimaryButton,
} from '../components/portal/PortalAuthChrome';
import {
  portalFieldClass,
  portalIsClient2,
  portalLabelClass,
} from '../components/portal/portalAuthChromeUtils.js';

const apiBase = () => config.API_URL || config.BACKEND_BASE || '';

export default function PortalAccesoPage() {
  const { token } = useParams();
  const [nombre, setNombre] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const storageKey = token ? `portal_jwt_${token}` : '';
  const [portalJwt, setPortalJwt] = useState('');
  const [portalMe, setPortalMe] = useState(null);

  const isC2 = portalIsClient2();
  const fieldClass = portalFieldClass();
  const labelClass = portalLabelClass();

  useEffect(() => {
    if (!storageKey) return;
    const j = sessionStorage.getItem(storageKey);
    if (j) {
      setPortalJwt(j);
      setStep('inside');
    }
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token || String(token).trim().length < 16) {
        setInfoError('Enlace no válido');
        setLoadingInfo(false);
        return;
      }
      setLoadingInfo(true);
      setInfoError(null);
      try {
        const res = await fetch(routes.portalPublicComunidad(token));
        if (!res.ok) {
          throw new Error('Enlace no válido o caducado');
        }
        const json = await res.json();
        if (cancelled) return;
        setNombre(json?.data?.nombre || '');
      } catch (e) {
        if (!cancelled) setInfoError(e.message || 'Error');
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (step !== 'inside' || !portalJwt) {
      setPortalMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(routes.portalMe, {
          headers: { Authorization: `Bearer ${portalJwt}` },
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled || !json?.success || !json?.data) {
          if (!cancelled) setPortalMe(null);
          return;
        }
        const d = json.data;
        setPortalMe({
          comunidad: (d.comunidad && String(d.comunidad).trim()) || '',
          nif: d.nif || null,
          cliente_id: d.cliente_id,
        });
      } catch {
        if (!cancelled) setPortalMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, portalJwt]);

  const requestCode = useCallback(async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch(routes.portalAuthRequestCode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          portal_token: token,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message || json.error || `Error ${res.status}`,
        );
      }
      setMsg('Si el email es correcto, recibirás un código en unos minutos.');
      setStep('code');
    } catch (e) {
      setErr(e.message || 'Error al solicitar el código');
    } finally {
      setBusy(false);
    }
  }, [email, token]);

  const verify = useCallback(async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch(routes.portalAuthVerifyCode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          portal_token: token,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message || json.error || `Error ${res.status}`,
        );
      }
      const jwt = json.accessToken;
      if (!jwt) throw new Error('Respuesta sin token');
      sessionStorage.setItem(storageKey, jwt);
      setPortalJwt(jwt);
      setStep('inside');
      setMsg('');
    } catch (e) {
      setErr(e.message || 'Código incorrecto');
    } finally {
      setBusy(false);
    }
  }, [code, email, token, storageKey]);

  const logout = () => {
    sessionStorage.removeItem(storageKey);
    setPortalJwt('');
    setStep('email');
    setCode('');
  };

  const downloadContrato = async (id, label) => {
    const jwt = portalJwt || sessionStorage.getItem(storageKey);
    if (!jwt) return;
    try {
      const res = await fetch(`${apiBase()}/api/portal/contratos/${id}/pdf`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('No se pudo descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label || 'contrato'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || 'Error descarga');
    }
  };

  const downloadPresupuestoFirmado = async (id, label) => {
    const jwt = portalJwt || sessionStorage.getItem(storageKey);
    if (!jwt) return;
    try {
      const res = await fetch(routes.portalPresupuestoPdfFirmado(id), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('No se pudo descargar el PDF firmado');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(label || `presupuesto-${id}`).slice(0, 80)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || 'Error descarga');
    }
  };

  const spinClass = isC2
    ? 'h-12 w-12 rounded-full border-2 border-[var(--primary-color)] border-t-transparent animate-spin'
    : 'h-12 w-12 rounded-full border-2 border-white border-t-transparent animate-spin';

  const alertOk = isC2
    ? 'rounded-xl p-3 text-sm bg-emerald-50 text-emerald-900 border border-emerald-200'
    : 'rounded-xl p-3 text-sm bg-white/15 text-emerald-100 border border-emerald-400/35';
  const alertErr = isC2
    ? 'rounded-xl p-3 text-sm bg-red-50 text-red-800 border border-red-200'
    : 'rounded-xl p-3 text-sm bg-red-950/40 text-red-100 border border-red-400/30';

  if (loadingInfo) {
    return (
      <PortalAuthChrome
        cardTitle="Validando enlace"
        cardSubtitle="Comprobando el acceso a tu comunidad…"
      >
        <div className="flex justify-center py-10">
          <div className={spinClass} />
        </div>
      </PortalAuthChrome>
    );
  }

  if (infoError) {
    return (
      <PortalAuthChrome cardTitle="Enlace no disponible" cardSubtitle="">
        <div className={`rounded-xl p-4 text-center text-sm border ${isC2 ? 'bg-red-50 text-red-800 border-red-200' : 'bg-red-950/30 text-red-100 border-red-400/25'}`}>
          {infoError}
        </div>
      </PortalAuthChrome>
    );
  }

  let cardTitle = 'Acceso al portal';
  let cardSubtitle = nombre || 'Área de clientes';
  if (step === 'code') {
    cardTitle = 'Introduce el código';
    cardSubtitle = nombre
      ? `Comunidad: ${nombre}`
      : 'Revisa tu correo (y la carpeta de spam).';
  } else if (step === 'inside') {
    cardTitle = 'Tu área de clientes';
    if (portalMe?.comunidad) {
      cardSubtitle = portalMe.nif
        ? `${portalMe.comunidad} · NIF/CIF ${portalMe.nif}`
        : portalMe.comunidad;
    } else {
      cardSubtitle = nombre || 'Documentación y contratos';
    }
  }

  const activePortalClientChrome =
    step === 'inside'
      ? portalMe?.comunidad
        ? {
            name: portalMe.comunidad,
            nif: portalMe.nif,
            id: portalMe.cliente_id,
          }
        : nombre
          ? { name: nombre, nif: null, id: null }
          : null
      : null;

  return (
    <PortalAuthChrome
      cardTitle={cardTitle}
      cardSubtitle={cardSubtitle}
      activePortalClient={activePortalClientChrome}
      wideContent={step === 'inside'}
      footerNote={
        step === 'email' || step === 'code'
          ? 'Acceso por código de un solo uso enviado a tu email.'
          : null
      }
    >
      {step !== 'inside' && (
        <div className="space-y-5">
          {step === 'email' && (
            <>
              <div>
                <label htmlFor="portal-email" className={labelClass}>
                  Correo electrónico
                </label>
                <input
                  id="portal-email"
                  type="email"
                  className={fieldClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="El mismo con acceso al portal"
                />
              </div>
              <PortalPrimaryButton
                disabled={busy || !email.includes('@')}
                onClick={requestCode}
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando…
                  </span>
                ) : (
                  'Recibir código por email'
                )}
              </PortalPrimaryButton>
            </>
          )}
          {step === 'code' && (
            <>
              <div>
                <label htmlFor="portal-code" className={labelClass}>
                  Código de 6 dígitos
                </label>
                <input
                  id="portal-code"
                  inputMode="numeric"
                  className={`${fieldClass} tracking-[0.35em] text-center text-lg font-semibold`}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="000000"
                />
              </div>
              <PortalPrimaryButton
                disabled={busy || code.length < 6}
                onClick={verify}
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Comprobando…
                  </span>
                ) : (
                  'Entrar'
                )}
              </PortalPrimaryButton>
              <PortalGhostButton
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                }}
              >
                Cambiar email
              </PortalGhostButton>
            </>
          )}
          {msg && <div className={alertOk}>{msg}</div>}
          {err && <div className={alertErr}>{err}</div>}
        </div>
      )}

      {step === 'inside' && (
        <PortalClienteDashboardInside
          jwt={portalJwt}
          err={err}
          setErr={setErr}
          comunidadNombre={portalMe?.comunidad || nombre}
          comunidadNif={portalMe?.nif || null}
          intro={
            <p className="text-sm text-slate-600 leading-relaxed">
              Has accedido correctamente. Documentación{' '}
              <strong className="text-slate-800">general de la empresa</strong> y
              de <strong className="text-slate-800">esta comunidad</strong>{' '}
              (personal activo, contratos laborales visibles, contratos PDF del
              cliente, presupuestos guardados con PDF firmado y facturas mensuales).
            </p>
          }
          downloadContrato={downloadContrato}
          downloadPresupuestoFirmado={downloadPresupuestoFirmado}
          footer={
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto min-w-[140px] border-slate-300 text-slate-800"
              onClick={logout}
            >
              Salir
            </Button>
          }
        />
      )}
    </PortalAuthChrome>
  );
}

/** Listado y descarga de PDFs subidos como documentación general (no por cliente). */
export function PortalDocumentosGeneralesList({
  bearerToken,
  jwt,
  onError,
  /** En tarjeta oscura (p. ej. portal gestores antes de elegir comunidad). */
  tone = 'light',
}) {
  const token = bearerToken ?? jwt;
  const mutedClass =
    tone === 'dark' ? 'text-sm text-white/80' : 'text-sm text-gray-500';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(routes.portalDocumentosGenerales, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          setRows(Array.isArray(json.data) ? json.data : []);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const download = async (id, label) => {
    if (!token) return;
    try {
      const res = await fetch(routes.portalDocumentoGeneralArchivo(id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(label || `documento-${id}`).slice(0, 80)}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError?.(e.message || 'Error descarga');
    }
  };

  if (!token) return null;
  if (loading) {
    return <p className={mutedClass}>Cargando documentación general…</p>;
  }
  if (!rows.length) {
    return (
      <p className={mutedClass}>
        No hay documentación general publicada por ahora.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((d) => (
        <li
          key={d.id}
          className="flex justify-between items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <span className="truncate text-gray-800">
            {d.nombre_documento || d.tipo_documento || `Documento #${d.id}`}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              download(
                d.id,
                (d.nombre_documento || d.tipo_documento || `doc-${d.id}`).slice(
                  0,
                  60,
                ),
              )
            }
          >
            Descargar
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function TrabajadoresPortalList({ jwt, onError, hideSectionTitle = false }) {
  const [rows, setRows] = useState([]);
  const [contratosEmp, setContratosEmp] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jwt) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [resT, resC] = await Promise.all([
          fetch(routes.portalTrabajadores, {
            headers: { Authorization: `Bearer ${jwt}` },
          }),
          fetch(routes.portalEmpleadosContratos, {
            headers: { Authorization: `Bearer ${jwt}` },
          }),
        ]);
        const jsonT = await resT.json().catch(() => ({}));
        const jsonC = await resC.json().catch(() => ({}));
        if (!cancelled) {
          setRows(Array.isArray(jsonT.data) ? jsonT.data : []);
          setContratosEmp(Array.isArray(jsonC.data) ? jsonC.data : []);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setContratosEmp([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt]);

  const contratosPorCodigo = (codigo) =>
    contratosEmp.filter((d) => String(d.codigo_empleado) === String(codigo));

  const descargarContratoEmpleado = async (docId, label) => {
    if (!jwt) return;
    try {
      const res = await fetch(routes.portalEmpleadoContratoPdf(docId), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('No se pudo descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(label || `contrato-${docId}`).slice(0, 80)}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError?.(e.message || 'Error descarga contrato');
    }
  };

  if (!jwt) return null;
  if (loading) {
    return <p className="text-sm text-gray-500">Cargando personal asignado…</p>;
  }
  if (!rows.length) {
    return (
      <p className="text-sm text-gray-500">
        No hay empleados <strong>activos</strong> (estado ACTIVO) en{' '}
        <strong>DatosEmpleados</strong> cuyo <strong>centro de trabajo</strong>{' '}
        coincida con el nombre, NIF o servicio de entrega de esta comunidad.
      </p>
    );
  }
  return (
    <div className="space-y-2 pb-2">
      {!hideSectionTitle ? (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Personal asignado
        </h3>
      ) : null}
      <ul className="space-y-2">
        {rows.map((t) => (
          <li
            key={t.codigo}
            className="border rounded-lg px-3 py-2 text-sm border-gray-200 bg-white text-gray-800"
          >
            <div className="font-medium">{t.nombre}</div>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {t.centro_trabajo ? <span>{t.centro_trabajo}</span> : null}
              {t.grupo ? <span>· {t.grupo}</span> : null}
              {t.estado ? <span>· {t.estado}</span> : null}
            </div>
            {contratosPorCodigo(t.codigo).length > 0 ? (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Contrato visible para el empleado
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {contratosPorCodigo(t.codigo).map((d) => (
                    <li key={d.doc_id}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() =>
                          descargarContratoEmpleado(
                            d.doc_id,
                            d.nombre_archivo ||
                              d.tipo_documento ||
                              `contrato-${d.doc_id}`,
                          )
                        }
                      >
                        {(d.tipo_documento || 'Contrato').slice(0, 36)}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContratosPortalList({ jwt, onDownload, hideHeading = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jwt) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/portal/contratos`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          setRows(Array.isArray(json.data) ? json.data : []);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt]);

  if (!jwt) return null;
  if (loading) {
    return <p className="text-sm text-gray-500">Cargando contratos…</p>;
  }
  if (!rows.length) {
    return <p className="text-sm text-gray-500">No hay contratos asociados.</p>;
  }
  return (
    <div className="space-y-2">
      {!hideHeading ? (
        <h2 className="text-sm font-semibold text-gray-800">Contratos</h2>
      ) : null}
      <ul className="space-y-2">
        {rows.map((c) => (
          <li
            key={c.id}
            className="flex justify-between items-center gap-2 border rounded-lg px-3 py-2 text-sm border-gray-200 bg-white"
          >
            <span className="truncate">{c.tipo_contrato || `Contrato #${c.id}`}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onDownload(c.id, (c.tipo_contrato || `contrato-${c.id}`).slice(0, 40))
              }
            >
              PDF
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PortalFacturasManualesList({ jwt, onError }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!jwt) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(routes.portalFacturas, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setRows([]);
            onErrorRef.current?.(
              json.message ||
                json.error ||
                `No se pudieron cargar las facturas (${res.status})`,
            );
          }
          return;
        }
        if (!cancelled) setRows(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (!cancelled) {
          setRows([]);
          onErrorRef.current?.('Error de red al cargar facturas');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt]);

  const facturasPorMes = useMemo(() => {
    const map = new Map();
    for (const f of rows) {
      const d = new Date(f.fecha_emision);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const etiquetaMes = (yyyyMm) => {
    const [y, m] = yyyyMm.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const formatImporteEur = (imp) => {
    if (imp == null || imp === '') return null;
    const n =
      typeof imp === 'string' ? Number(imp.replace(',', '.')) : Number(imp);
    if (!Number.isFinite(n)) return null;
    return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  };

  const abrirPdf = async (facturaId) => {
    if (!jwt) return;
    try {
      const res = await fetch(routes.portalFacturaArchivo(facturaId), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) {
        onError?.('No se pudo abrir el PDF de la factura');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      onError?.('Error al abrir el PDF');
    }
  };

  if (!jwt) return null;
  if (loading) {
    return <p className="text-sm text-slate-500">Cargando facturas…</p>;
  }
  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500">
        No hay facturas disponibles para esta comunidad en el portal.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-h-[min(380px,45vh)] overflow-y-auto pr-1">
      {facturasPorMes.map(([mesKey, lista]) => (
        <div key={mesKey}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100 pb-1 mb-2">
            {etiquetaMes(mesKey)}
          </p>
          <ul className="space-y-2">
            {lista.map((f) => {
              const fechaEm = f.fecha_emision
                ? new Date(f.fecha_emision).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '';
              const fechaVto = f.fecha_vencimiento
                ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : null;
              const importeTxt = formatImporteEur(f.importe);
              const titulo =
                f.numero_factura?.trim() ||
                f.nombre_archivo?.replace(/\.pdf$/i, '') ||
                `Factura #${f.id}`;
              const detalles = [];
              if (fechaEm) detalles.push(`Emisión: ${fechaEm}`);
              if (fechaVto) detalles.push(`Venc.: ${fechaVto}`);
              if (importeTxt) detalles.push(importeTxt);
              return (
                <li
                  key={f.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 block truncate">
                      {titulo}
                    </span>
                    {detalles.length > 0 ? (
                      <span className="text-[11px] text-slate-500 block">
                        {detalles.join(' · ')}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => abrirPdf(f.id)}
                  >
                    Ver PDF
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function PresupuestosPortalList({ jwt, onDownload, hideHeading = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jwt) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(routes.portalPresupuestos, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          setRows(Array.isArray(json.data) ? json.data : []);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt]);

  if (!jwt) return null;
  if (loading) {
    return <p className="text-sm text-gray-500">Cargando presupuestos…</p>;
  }
  if (!rows.length) {
    return (
      <p className="text-sm text-gray-500">
        No hay presupuestos guardados para este cliente en el portal.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {!hideHeading ? (
        <h2 className="text-sm font-semibold text-gray-800">Presupuestos</h2>
      ) : null}
      <ul className="space-y-2">
        {rows.map((p) => {
          const label =
            (p.numero_presupuesto && String(p.numero_presupuesto).trim()) ||
            (p.nombre && String(p.nombre).trim()) ||
            `Presupuesto #${p.id}`;
          return (
            <li
              key={p.id}
              className="flex flex-col gap-2 border rounded-lg px-3 py-2 text-sm border-gray-200 bg-white sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <span className="font-medium text-gray-800 block truncate">{label}</span>
                {p.tiene_firma ? (
                  <span className="text-[10px] text-emerald-700">PDF firmado disponible</span>
                ) : (
                  <span className="text-[10px] text-amber-700">
                    Sin firma aún: el PDF firmado aparecerá cuando el cliente firme
                  </span>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!p.tiene_firma}
                title={
                  p.tiene_firma
                    ? 'Descargar PDF firmado'
                    : 'No hay PDF firmado para este presupuesto'
                }
                className="shrink-0"
                onClick={() => onDownload(p.id, label)}
              >
                PDF firmado
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const portalDashPanel =
  'rounded-xl border border-slate-200/95 bg-white shadow-sm flex flex-col min-h-0 overflow-hidden';
const portalDashPanelHead =
  'flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/95 px-4 py-2.5';
const portalDashPanelTitle =
  'text-[11px] font-bold uppercase tracking-wide text-slate-600';
const portalDashPanelBody = 'p-4 flex-1 min-h-0';

/** Layout ancho en 3 columnas: documentación general | personal | contratos comunidad. */
export function PortalClienteDashboardInside({
  jwt,
  err,
  setErr,
  comunidadNombre,
  comunidadNif,
  intro,
  downloadContrato,
  downloadPresupuestoFirmado,
  footer,
}) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white text-gray-900 shadow-2xl overflow-hidden">
      <header className="bg-gradient-to-r from-slate-800 via-slate-800 to-slate-900 px-4 py-3 sm:px-6 flex flex-wrap items-start justify-between gap-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">
            Comunidad activa
          </p>
          <p className="font-semibold text-base sm:text-lg leading-snug break-words">
            {comunidadNombre || '—'}
          </p>
        </div>
        {comunidadNif ? (
          <span className="shrink-0 text-xs font-mono bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
            NIF/CIF {comunidadNif}
          </span>
        ) : null}
      </header>
      {err ? (
        <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      ) : null}
      <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-white to-slate-50/90">
        {intro}
        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-12">
          <aside className={`xl:col-span-3 ${portalDashPanel}`}>
            <div className={portalDashPanelHead}>
              <h2 className={portalDashPanelTitle}>Documentación general</h2>
            </div>
            <p className="px-4 pt-3 text-[11px] text-slate-500 leading-snug">
              Misma para todas las comunidades (empresa).
            </p>
            <div className={portalDashPanelBody}>
              <PortalDocumentosGeneralesList
                bearerToken={jwt}
                onError={(m) => setErr(m)}
              />
            </div>
          </aside>
          <section className={`xl:col-span-5 ${portalDashPanel}`}>
            <div className={portalDashPanelHead}>
              <h2 className={portalDashPanelTitle}>Personal asignado</h2>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                Solo activos
              </span>
            </div>
            <p className="px-4 pt-3 text-[11px] text-slate-500 leading-snug">
              Empleados con centro de trabajo de esta comunidad.
            </p>
            <div className={portalDashPanelBody}>
              <TrabajadoresPortalList
                jwt={jwt}
                onError={(m) => setErr(m)}
                hideSectionTitle
              />
            </div>
          </section>
          <section className={`xl:col-span-4 ${portalDashPanel}`}>
            <div className={portalDashPanelHead}>
              <h2 className={portalDashPanelTitle}>Contratos y presupuestos</h2>
            </div>
            <p className="px-4 pt-3 text-[11px] text-slate-500 leading-snug">
              Contratos PDF asociados al NIF de la comunidad y presupuestos
              guardados del mismo cliente (descarga del PDF firmado cuando exista).
            </p>
            <div className={`${portalDashPanelBody} space-y-5`}>
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Contratos (PDF administración)
                </h3>
                <ContratosPortalList
                  jwt={jwt}
                  onDownload={downloadContrato}
                  hideHeading
                />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Presupuestos guardados
                </h3>
                <PresupuestosPortalList
                  jwt={jwt}
                  onDownload={downloadPresupuestoFirmado}
                  hideHeading
                />
              </div>
            </div>
          </section>
        </div>

        <section className={`mt-6 ${portalDashPanel}`}>
          <div className={portalDashPanelHead}>
            <h2 className={portalDashPanelTitle}>Facturas mensuales</h2>
          </div>
          <p className="px-4 pt-3 text-[11px] text-slate-500 leading-snug">
            PDFs de facturación de esta comunidad, agrupados por mes de emisión (misma
            vista que en el área interna del CRM).
          </p>
          <div className={portalDashPanelBody}>
            <PortalFacturasManualesList jwt={jwt} onError={(m) => setErr(m)} />
          </div>
        </section>

        {footer ? (
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:items-center">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
