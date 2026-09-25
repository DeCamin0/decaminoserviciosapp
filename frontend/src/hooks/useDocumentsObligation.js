import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Pending docs + snooze state for obligation modal (employee + developer).
 */
export function useDocumentsObligation() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const codigo = useMemo(
    () => String(user?.CODIGO || user?.id || '').trim(),
    [user?.CODIGO, user?.id],
  );

  const nombreSlash = user?.['NOMBRE / APELLIDOS'];
  const userName = user?.name;
  const nombreApellidos = user?.NOMBRE_APELLIDOS;
  const nombre = useMemo(
    () => String(nombreSlash || userName || nombreApellidos || '').trim(),
    [nombreSlash, userName, nombreApellidos],
  );

  const isDeveloper = useMemo(
    () => user?.GRUPO === 'Developer' || user?.grupo === 'Developer',
    [user?.GRUPO, user?.grupo],
  );

  const isAudience = !!(user && !user.isDemo && codigo);

  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(null);
  /** Soft hide doar în memorie (refresh = modal din nou pe Inicio) */
  const [softHidden, setSoftHidden] = useState(false);

  const shownRecordedRef = useRef(false);
  const stateRef = useRef(null);
  const loadGenRef = useRef(0);
  const lastPathRef = useRef(location.pathname);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const hardLocked = !!(state?.hard_locked);
  const snoozeCount = state?.snooze_count ?? 0;
  const snoozeMax = state?.snooze_max ?? 3;
  const audienceActive = !!(isAudience && codigo);
  const visibleItems = audienceActive ? items : [];
  const hasPending = visibleItems.length > 0;
  const loading = audienceActive ? !ready : false;
  const onInicio = location.pathname === '/inicio' || location.pathname === '/';

  // La revenire pe Inicio după navigare: arată din nou modalul soft
  useEffect(() => {
    const prev = lastPathRef.current;
    lastPathRef.current = location.pathname;
    if (!hardLocked && onInicio && prev !== location.pathname) {
      shownRecordedRef.current = false;
      const t = window.setTimeout(() => {
        setSoftHidden(false);
      }, 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [location.pathname, onInicio, hardLocked]);

  const fetchPendingItems = useCallback(async () => {
    if (!codigo || !isAudience) {
      setItems([]);
      return [];
    }

    const headers = authHeaders();
    const next = [];

    try {
      const [oficialesRes, solicitadosRes, prlRes] = await Promise.all([
        fetch(routes.getDocumentosOficiales, {
          method: 'POST',
          headers,
          body: JSON.stringify({ codigo, nombre }),
        }).catch(() => null),
        fetch(routes.getDocumentosSolicitados(codigo), { headers }).catch(() => null),
        fetch(routes.prlMisDocumentos, { headers }).catch(() => null),
      ]);

      if (oficialesRes?.ok) {
        const data = await oficialesRes.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.documentos)
            ? data.documentos
            : [];
        list.forEach((doc, idx) => {
          const perm = String(
            doc.permisso_para_empleado ?? doc['Permisso Para Empleado'] ?? '',
          )
            .trim()
            .toUpperCase();
          const visible =
            perm === 'SI' || perm === 'YES' || perm === '1' || perm === 'TRUE';
          if (!visible) return;

          const needs =
            doc.necesita_firma === true ||
            doc.necesita_firma === 1 ||
            doc.necesita_firma === '1';
          if (!needs) return;
          const name = doc.nombre_archivo || doc.fileName || doc.nombre || '';
          if (/_firmado/i.test(name)) return;

          next.push({
            key: `oficial-${doc.doc_id || doc.id || idx}`,
            kind: 'oficial',
            title: name || 'Documento oficial',
            subtitle: doc.tipo_documento || doc.tipo || 'Oficial',
            action: 'firmar',
            raw: {
              id: doc.id,
              doc_id: doc.doc_id,
              fileName: name,
              tipo: doc.tipo_documento || doc.tipo || 'Documento Oficial',
            },
          });
        });
      }

      if (solicitadosRes?.ok) {
        const data = await solicitadosRes.json();
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.solicitudes)
            ? data.solicitudes
            : Array.isArray(data)
              ? data
              : [];
        list
          .filter((s) => (s.estado || 'pendiente') === 'pendiente')
          // Justificante de presencia → doar pe Solicitudes, nu în obligation gate
          .filter((s) => {
            const t = String(s.tipo_documento || '').toLowerCase();
            return !(
              t.includes('justificante de presencia') ||
              (t.includes('presencia') && t.includes('cita'))
            );
          })
          .forEach((s) => {
            next.push({
              key: `solicitado-${s.id}`,
              kind: 'solicitado',
              title: s.tipo_documento || 'Documento solicitado',
              subtitle: s.notas || 'Pendiente de subir',
              action: 'subir',
              raw: s,
            });
          });
      }

      if (prlRes?.ok) {
        const data = await prlRes.json();
        const list = Array.isArray(data?.documentos) ? data.documentos : [];
        list.forEach((d) => {
          const isRenuncia = !!(d.es_renuncia_rm || d.tipo_documento === 'RENUNCIA_RM');
          const rmSolicitado = !!(d.rm_solicitado === true || d.rm_solicitado === 1);

          // Renuncia RM: Quiero doar dacă n-a cerut niciodată;
          // după RECHAZADO / rm_solicitado_en → doar firmar renuncia
          if (isRenuncia && !rmSolicitado) {
            const alreadyUsedOnce =
              d.rm_aprobacion_estado === 'RECHAZADO' ||
              d.rm_aprobacion_estado === 'ACEPTADO' ||
              !!d.rm_solicitado_en;

            if (alreadyUsedOnce) {
              if (d.estado === 'PENDIENTE' && d.requiere_firma) {
                next.push({
                  key: `prl-sign-${d.id}`,
                  kind: 'prl',
                  title:
                    d.nombre_archivo_original ||
                    d.template_nombre ||
                    'Renuncia RM',
                  subtitle: 'Debes firmar la renuncia (RM ya solicitado antes)',
                  action: 'firmar',
                  raw: d,
                });
              }
              return;
            }

            if (d.estado === 'NO_APLICA' || d.estado === 'PENDIENTE') {
              next.push({
                key: `prl-rm-${d.id}`,
                kind: 'prl_rm',
                title:
                  d.nombre_archivo_original ||
                  d.template_nombre ||
                  'Reconocimiento Médico',
                subtitle:
                  d.estado === 'PENDIENTE'
                    ? 'Elige: solicitar RM o firmar la renuncia'
                    : '¿Quieres el reconocimiento médico o renuncias?',
                action: 'decidir_rm',
                raw: d,
              });
            }
            return;
          }

          if (d.estado !== 'PENDIENTE') return;
          const needsTest = !!(d.es_manual_test && !d.test_completado);
          if (needsTest) {
            next.push({
              key: `prl-test-${d.id}`,
              kind: 'prl_test',
              title:
                d.nombre_archivo_original || d.template_nombre || 'Manual PRL',
              subtitle: 'Autoevaluación pendiente',
              action: 'test',
              raw: d,
            });
          } else if (d.requiere_firma) {
            next.push({
              key: `prl-sign-${d.id}`,
              kind: 'prl',
              title:
                d.nombre_archivo_original ||
                d.template_nombre ||
                'Documento PRL',
              subtitle: 'Pendiente de firma',
              action: 'firmar',
              raw: d,
            });
          }
        });
      }
    } catch (e) {
      console.warn('[DocumentsObligation] fetch pending failed', e);
    }

    setItems(next);
    return next;
  }, [codigo, isAudience, nombre]);

  const fetchState = useCallback(async () => {
    if (!codigo || !isAudience) {
      setState(null);
      return null;
    }
    try {
      const res = await fetch(routes.documentosObligationMe, {
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.state) {
        setState(data.state);
        return data.state;
      }
    } catch (e) {
      console.warn('[DocumentsObligation] state failed', e);
    }
    return null;
  }, [codigo, isAudience]);

  const markResolvedIfEmpty = useCallback(
    async (pendingList) => {
      if (!codigo || !isAudience) return;
      if (!pendingList || pendingList.length > 0) return;

      const current = stateRef.current;
      if (!current || (current.apariciones || 0) === 0) return;

      try {
        const res = await fetch(routes.documentosObligationResolve, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.state) setState(data.state);
        }
        setSoftHidden(false);
      } catch (e) {
        console.warn('[DocumentsObligation] resolve failed', e);
      }
    },
    [codigo, isAudience],
  );

  useEffect(() => {
    if (!isAudience || !codigo) {
      return undefined;
    }

    const gen = ++loadGenRef.current;

    (async () => {
      try {
        const [pending] = await Promise.all([
          fetchPendingItems(),
          fetchState(),
        ]);
        if (loadGenRef.current !== gen) return;

        await markResolvedIfEmpty(pending);
        if (loadGenRef.current !== gen) return;
        setReady(true);
      } catch (e) {
        console.warn('[DocumentsObligation] load failed', e);
        if (loadGenRef.current === gen) setReady(true);
      }
    })();

    return () => {
      if (loadGenRef.current === gen) {
        loadGenRef.current += 1;
      }
    };
  }, [isAudience, codigo, fetchPendingItems, fetchState, markResolvedIfEmpty]);

  const shouldShowModal = useMemo(() => {
    if (!isAudience || !hasPending) return false;
    if (hardLocked) return true;
    if (softHidden) return false;
    return onInicio;
  }, [isAudience, hasPending, hardLocked, softHidden, onInicio]);

  useEffect(() => {
    if (!shouldShowModal || !codigo) return;
    if (shownRecordedRef.current) return;
    shownRecordedRef.current = true;
    (async () => {
      try {
        const res = await fetch(routes.documentosObligationShown, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.state) setState(data.state);
        }
      } catch (e) {
        console.warn('[DocumentsObligation] shown failed', e);
      }
    })();
  }, [shouldShowModal, codigo]);

  useEffect(() => {
    if (!hardLocked || !hasPending) return;
    if (location.pathname !== '/inicio' && location.pathname !== '/') {
      navigate('/inicio', { replace: true });
    }
  }, [hardLocked, hasPending, location.pathname, navigate]);

  const snooze = useCallback(async () => {
    if (hardLocked) return;
    try {
      const res = await fetch(routes.documentosObligationSnooze, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.state) {
          setState(data.state);
          if (data.state.hard_locked) {
            setSoftHidden(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[DocumentsObligation] snooze failed', e);
    }
    shownRecordedRef.current = false;
    setSoftHidden(true);
  }, [hardLocked]);

  const afterItemDone = useCallback(async () => {
    const pending = await fetchPendingItems();
    await markResolvedIfEmpty(pending);
  }, [fetchPendingItems, markResolvedIfEmpty]);

  return {
    user,
    codigo,
    isDeveloper,
    isAudience,
    items: visibleItems,
    loading,
    state,
    hardLocked,
    snoozeCount,
    snoozeMax,
    hasPending,
    shouldShowModal,
    snooze,
    afterItemDone,
    refresh: async () => {
      const pending = await fetchPendingItems();
      await fetchState();
      await markResolvedIfEmpty(pending);
    },
    logout,
  };
}
