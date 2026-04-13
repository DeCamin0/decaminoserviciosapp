import { useState, useCallback, useEffect } from 'react';
import { Button } from '../components/ui';
import { routes } from '../utils/routes';
import { config } from '../config/env';
import {
  PortalClienteDashboardInside,
  PortalDocumentosGeneralesList,
} from './PortalAccesoPage';
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

const GESTOR_PICK_KEY = 'portal_gestor_pick';

function readGestorPick() {
  try {
    const raw = sessionStorage.getItem(GESTOR_PICK_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (
      o?.selectionToken &&
      Array.isArray(o.communities) &&
      o.communities.length > 1
    ) {
      return { selectionToken: o.selectionToken, communities: o.communities };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeGestorPick(selectionToken, communities) {
  sessionStorage.setItem(
    GESTOR_PICK_KEY,
    JSON.stringify({ selectionToken, communities }),
  );
}

function clearGestorPick() {
  sessionStorage.removeItem(GESTOR_PICK_KEY);
}

/**
 * Acceso al área de clientes sin enlace por comunidad: solo contactos con rol
 * Administrador y «Acceso portal» en cada comunidad donde estén dados de alta.
 */
export default function PortalGestoresAccesoPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [selectionToken, setSelectionToken] = useState('');
  const [communities, setCommunities] = useState([]);
  const [storageKey, setStorageKey] = useState('');
  const [portalJwt, setPortalJwt] = useState('');
  /** Datos del cliente/comunidad del JWT (GET /api/portal/me). */
  const [portalMe, setPortalMe] = useState(null);

  const isC2 = portalIsClient2();
  const fieldClass = portalFieldClass();
  const labelClass = portalLabelClass();

  useEffect(() => {
    const prefix = 'portal_jwt_gestor_';
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(prefix));
    for (const k of keys) {
      const j = sessionStorage.getItem(k);
      if (j) {
        setStorageKey(k);
        setPortalJwt(j);
        setStep('inside');
        const pick = readGestorPick();
        if (pick) {
          setSelectionToken(pick.selectionToken);
          setCommunities(pick.communities);
        }
        return;
      }
    }
  }, []);

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
      const res = await fetch(routes.portalAuthRequestAdminCode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message || json.error || `Error ${res.status}`,
        );
      }
      setMsg(
        'Si tu email está registrado como administrador con acceso al portal, recibirás un código.',
      );
      setStep('code');
    } catch (e) {
      setErr(e.message || 'Error al solicitar el código');
    } finally {
      setBusy(false);
    }
  }, [email]);

  const verify = useCallback(async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch(routes.portalAuthVerifyAdminCode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message || json.error || `Error ${res.status}`,
        );
      }
      if (json.accessToken) {
        const token = String(json.portal_token || '').trim();
        if (token.length < 16) {
          throw new Error('Respuesta incompleta del servidor');
        }
        const key = `portal_jwt_gestor_${token}`;
        sessionStorage.setItem(key, json.accessToken);
        setStorageKey(key);
        setPortalJwt(json.accessToken);
        clearGestorPick();
        setSelectionToken('');
        setCommunities([]);
        setStep('inside');
        setMsg('');
        return;
      }
      if (json.selectionToken && Array.isArray(json.communities)) {
        setSelectionToken(json.selectionToken);
        setCommunities(json.communities);
        if (json.communities.length > 1) {
          writeGestorPick(json.selectionToken, json.communities);
        } else {
          clearGestorPick();
        }
        setStep('pick');
        setMsg('');
        return;
      }
      throw new Error('Respuesta sin token ni comunidades');
    } catch (e) {
      setErr(e.message || 'Código incorrecto');
    } finally {
      setBusy(false);
    }
  }, [code, email]);

  const pickCommunity = useCallback(
    async (clienteId, portalToken) => {
      setErr('');
      setBusy(true);
      try {
        const res = await fetch(routes.portalAuthSelectAdminComunidad, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selection_token: selectionToken,
            cliente_id: clienteId,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) {
            clearGestorPick();
          }
          throw new Error(
            json.message || json.error || `Error ${res.status}`,
          );
        }
        const jwt = json.accessToken;
        if (!jwt) throw new Error('Respuesta sin token');
        const key = `portal_jwt_gestor_${portalToken}`;
        sessionStorage.setItem(key, jwt);
        setStorageKey(key);
        setPortalJwt(jwt);
        setStep('inside');
      } catch (e) {
        setErr(e.message || 'No se pudo entrar en esa comunidad');
      } finally {
        setBusy(false);
      }
    },
    [selectionToken],
  );

  const logout = () => {
    if (storageKey) sessionStorage.removeItem(storageKey);
    clearGestorPick();
    setPortalJwt('');
    setStorageKey('');
    setSelectionToken('');
    setCommunities([]);
    setStep('email');
    setCode('');
  };

  const canSwitchCommunity = readGestorPick() !== null;

  const backToCommunityList = () => {
    setErr('');
    const pick = readGestorPick();
    if (!pick) {
      setErr('No hay otras comunidades guardadas en esta sesión.');
      return;
    }
    if (storageKey) sessionStorage.removeItem(storageKey);
    setPortalJwt('');
    setStorageKey('');
    setSelectionToken(pick.selectionToken);
    setCommunities(pick.communities);
    setStep('pick');
  };

  const downloadContrato = async (id, label) => {
    const jwt = portalJwt || (storageKey && sessionStorage.getItem(storageKey));
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
    const jwt = portalJwt || (storageKey && sessionStorage.getItem(storageKey));
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

  let cardTitle = 'Portal gestores';
  let cardSubtitle =
    'Administradores con acceso al portal en varias comunidades.';
  if (step === 'email') {
    cardTitle = 'Acceso con código';
    cardSubtitle =
      'Introduce el email con el que das acceso al portal como administrador.';
  } else if (step === 'code') {
    cardTitle = 'Verificar código';
    cardSubtitle = 'Revisa tu bandeja de entrada (y spam).';
  } else if (step === 'pick') {
    cardTitle = 'Elige comunidad';
    cardSubtitle = 'Documentación general o una comunidad concreta.';
  } else if (step === 'generales') {
    cardTitle = 'Documentación general';
    cardSubtitle =
      'Archivos de empresa (no dependen de la comunidad que elijas después).';
  } else if (step === 'inside') {
    cardTitle = 'Tu área de clientes';
    if (portalMe?.comunidad) {
      cardSubtitle = portalMe.nif
        ? `${portalMe.comunidad} · NIF/CIF ${portalMe.nif}`
        : portalMe.comunidad;
    } else {
      cardSubtitle = 'Cargando datos de la comunidad…';
    }
  }

  const listBtnClass = isC2
    ? 'w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 font-medium transition-colors disabled:opacity-50'
    : 'w-full text-left px-4 py-3 rounded-xl border border-white/25 bg-white/10 hover:bg-white/15 text-white font-medium transition-colors disabled:opacity-50';

  const alertOk = isC2
    ? 'rounded-xl p-3 text-sm bg-emerald-50 text-emerald-900 border border-emerald-200'
    : 'rounded-xl p-3 text-sm bg-white/15 text-emerald-100 border border-emerald-400/35';
  const alertErr = isC2
    ? 'rounded-xl p-3 text-sm bg-red-50 text-red-800 border border-red-200'
    : 'rounded-xl p-3 text-sm bg-red-950/40 text-red-100 border border-red-400/30';

  return (
    <PortalAuthChrome
      cardTitle={cardTitle}
      cardSubtitle={cardSubtitle}
      wideContent={step === 'inside'}
      activePortalClient={
        step === 'inside' && portalMe?.comunidad
          ? {
              name: portalMe.comunidad,
              nif: portalMe.nif,
              id: portalMe.cliente_id,
            }
          : null
      }
      footerNote={
        step === 'email' || step === 'code'
          ? 'El acceso es solo para contactos con rol Administrador y «Acceso portal» activo.'
          : null
      }
    >
      {step !== 'inside' && (
        <div className="space-y-5">
          {step === 'email' && (
            <>
              <div>
                <label htmlFor="gestor-email" className={labelClass}>
                  Correo electrónico
                </label>
                <input
                  id="gestor-email"
                  type="email"
                  className={fieldClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="tu@email.com"
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
                <label htmlFor="gestor-code" className={labelClass}>
                  Código de 6 dígitos
                </label>
                <input
                  id="gestor-code"
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
          {step === 'pick' && (
            <>
              <p className={`text-xs leading-relaxed ${isC2 ? 'text-gray-600' : 'text-white/75'}`}>
                El primer botón abre solo la <strong>documentación general</strong>{' '}
                que subís para la empresa. Los demás son <strong>comunidades</strong>:
                al pulsar una entras al portal de esa comunidad (contratos, etc.).
              </p>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    className={listBtnClass}
                    disabled={busy || !selectionToken}
                    onClick={() => {
                      setErr('');
                      setStep('generales');
                    }}
                  >
                    <span className="block font-semibold">
                      Documentación general de la empresa
                    </span>
                    <span
                      className={`block text-xs mt-1 ${isC2 ? 'text-gray-600' : 'text-white/75'}`}
                    >
                      Listado y descarga (igual para todas las comunidades)
                    </span>
                  </button>
                </li>
                {communities.map((c) => (
                  <li key={c.cliente_id}>
                    <button
                      type="button"
                      className={listBtnClass}
                      disabled={busy}
                      onClick={() =>
                        pickCommunity(c.cliente_id, c.portal_token)
                      }
                    >
                      <span className="truncate block">{c.nombre}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {step === 'generales' && (
            <>
              <PortalDocumentosGeneralesList
                bearerToken={selectionToken}
                tone={isC2 ? 'light' : 'dark'}
                onError={(m) => setErr(m)}
              />
              <button
                type="button"
                className={listBtnClass}
                onClick={() => {
                  setErr('');
                  setStep('pick');
                }}
              >
                Volver a elegir comunidad
              </button>
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
          comunidadNombre={portalMe?.comunidad || ''}
          comunidadNif={portalMe?.nif || null}
          intro={
            <p className="text-sm text-slate-600 leading-relaxed">
              Has accedido como <strong className="text-slate-800">administrador</strong>{' '}
              en esta comunidad.
              {canSwitchCommunity
                ? ' Puedes elegir otra comunidad sin volver a pedir el código.'
                : ' Para otra comunidad, cierra sesión y vuelve a entrar con el código, o usa el enlace dedicado de esa comunidad.'}
            </p>
          }
          downloadContrato={downloadContrato}
          downloadPresupuestoFirmado={downloadPresupuestoFirmado}
          footer={
            <>
              {canSwitchCommunity ? (
                <PortalPrimaryButton
                  className="w-full sm:w-auto sm:min-w-[220px]"
                  onClick={backToCommunityList}
                >
                  Elegir otra comunidad
                </PortalPrimaryButton>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto min-w-[140px] border-slate-300 text-slate-800"
                onClick={logout}
              >
                Salir
              </Button>
            </>
          }
        />
      )}
    </PortalAuthChrome>
  );
}
