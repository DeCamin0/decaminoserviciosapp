import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// Cache global pentru documentos-solicitados (în afara componentei pentru a funcționa în React Strict Mode)
const documentosSolicitadosGlobalCache = {
  lastFetch: 0,
  cacheTime: 60000, // 60 secunde cache (mărit pentru a evita 429)
  isFetching: false,
  retryCount: 0, // Contor pentru retry-uri după 429
  maxRetries: 3, // Maxim 3 retry-uri
  lastAusenciasLength: 0 // Track ultima lungime a listei pentru a detecta schimbări
};
import { useAuth } from '../contexts/AuthContextBase';
import { useLoadingState } from '../hooks/useLoadingState';
import { useBreakpoint } from '../hooks/useBreakpoint';
import Back3DButton from '../components/Back3DButton.jsx';
import { Card, LoadingSpinner } from '../components/ui';
import Modal from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { useAdminApi } from '../hooks/useAdminApi';
import { routes } from '../utils/routes.js';
import { API_ENDPOINTS } from '../utils/constants.js';
import activityLogger from '../utils/activityLogger';
import { ChevronLeft, ChevronRight, Edit, Trash2, RefreshCw, Lock, Unlock } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import { config } from '../config/env.js';
import { getPdfMake } from '../utils/getPdfMake';

// Branding din config (multi-client)
const rawColor = config.PRIMARY_COLOR || '#CC0000';
const PRIMARY_COLOR = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;

const MONTHS = [
  'Todas las meses', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/** Valor por defecto hasta cargar el límite desde la API (gestión). */
const DEFAULT_ASUNTOS_PROPIOS_MAX_POR_DIA = 3;

function isTipoAsuntoPropio(tipo) {
  const t = String(tipo || '').trim().toLowerCase();
  return t === 'asunto propio' || t === 'asuntos propios';
}

/** Parámetro TIPO en URL/API: la UI usa «Asuntos Propios» pero el backend guarda «Asunto Propio». */
function tipoSolicitudApiParam(tipoUI) {
  return tipoUI === 'Asuntos Propios' ? 'Asunto Propio' : tipoUI;
}

/** Coincide el tipo de la solicitud (API) con el tipo seleccionado en el formulario. */
function solicitudTipoCoincideUi(sTipo, uiTipo) {
  if (String(uiTipo) === 'Vacaciones') return sTipo === 'Vacaciones';
  if (isTipoAsuntoPropio(uiTipo)) return isTipoAsuntoPropio(sTipo);
  return String(sTipo) === String(uiTipo);
}

/** Inicio/fin locales (YYYY-MM-DD) para filtros por mes; alineado con Control vacaciones. */
const getSolicitudRangoFechasLocal = (s) => {
  let fi = '';
  let ff = '';
  if (s.FECHA && String(s.FECHA).includes(' - ')) {
    [fi, ff] = String(s.FECHA).split(' - ');
  } else {
    fi = s.fecha_inicio || s['fecha inicio'] || s.fecha;
    ff = s.fecha_fin || s['fecha fin'] || s.fecha;
  }
  if (!fi || !ff) return null;
  const parseYmd = (raw) => {
    const t = String(raw).trim();
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        0,
        0,
        0,
        0,
      );
    }
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  };
  const start = parseYmd(fi);
  const end = parseYmd(ff);
  if (!start || !end) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

/** selectedMonth: índice MONTHS 1=Enero … 12=Diciembre (no 0). */
const solicitudSolapaMesCalendario = (s, selectedMonth, year) => {
  const range = getSolicitudRangoFechasLocal(s);
  if (!range) return false;
  const monthIdx = selectedMonth - 1;
  const monthStart = new Date(year, monthIdx, 1);
  monthStart.setHours(0, 0, 0, 0);
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const monthEnd = new Date(year, monthIdx, lastDay);
  monthEnd.setHours(0, 0, 0, 0);
  const { start, end } = range;
  return end >= monthStart && start <= monthEnd;
};

const ENDPOINT = routes.getSolicitudesByEmail;
const BAJA_UPLOAD_ENDPOINT = routes.uploadBajasMedicas || '';
const BAJA_LIST_ENDPOINT = routes.getBajasMedicas || '';
const BAJA_MANUAL_ENDPOINT = routes.createBajaMedicaManual || '';
const BAJA_RESOLVE_CONFLICTS_ENDPOINT = routes.resolveBajasMedicasConflicts || '';

const normalizeTipo = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const isBajaMedica = (value) => {
  const normalized = normalizeTipo(value);
  return normalized.includes('baja') && normalized.includes('medic');
};

/** PDF en iframe está bien; imágenes blob en iframe suelen verse en blanco en móvil (iOS/Android) → usar <img>. */
function isJustificantePreviewImage(mimeType, fileName) {
  if (mimeType && /^image\//i.test(String(mimeType))) return true;
  const base = (fileName || '').split(/[?#]/)[0].toLowerCase();
  return /\.(jpe?g|pjpeg|png|gif|webp|bmp|svg|heic|heif)$/i.test(base);
}

const formatDate = (dateStr) => {
  if (!dateStr || dateStr === '-' || dateStr === '') return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-ES');
  } catch {
    return '-';
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return value;
    return `${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return value;
  }
};

const getSituacionColor = (situacion) => {
  const normalized = normalizeTipo(situacion);
  if (normalized.includes('alta')) {
    return 'bg-green-100 text-green-800';
  }
  if (normalized.includes('seguimiento')) {
    return 'bg-amber-100 text-amber-800';
  }
  if (normalized.includes('finalizada') || normalized.includes('cerrada')) {
    return 'bg-blue-100 text-blue-800';
  }
  return 'bg-rose-100 text-rose-800';
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (isNaN(number)) return String(value);
  return new Intl.NumberFormat('es-ES').format(number);
};

// Funcție pentru formatarea intervalelor de date (similar cu Fichaje)
const formatDateRange = (fechaCombinada) => {
  if (!fechaCombinada || fechaCombinada === '-' || fechaCombinada === '') return '—';
  try {
    let fechaNormalized = fechaCombinada.trim();
    const sameDatePattern = /^(\d{4}-\d{2}-\d{2})-\s*(\1)$/;
    const match = fechaNormalized.match(sameDatePattern);
    if (match) {
      fechaNormalized = `${match[1]} - ${match[1]}`;
    }
    
    if (fechaNormalized.includes(' - ')) {
      const [fechaInicio, fechaFin] = fechaNormalized.split(' - ');
      if (fechaInicio.trim() === fechaFin.trim()) {
        return fechaInicio.trim().split('-').reverse().join('/');
      }
      const startFormatted = fechaInicio.trim().split('-').reverse().join('/');
      const endFormatted = fechaFin.trim().split('-').reverse().join('/');
      return `${startFormatted} - ${endFormatted}`;
    }
    
    return fechaNormalized.split('-').reverse().join('/');
  } catch {
    return '—';
  }
};

// Funcție pentru scurtarea tipului de solicitare
const getSolicitudTipoShort = (tipo) => {
  if (!tipo) return 'Sol.';
  const tipoLower = tipo.toLowerCase();
  if (tipoLower.includes('vacacion')) return 'Vac.';
  if (tipoLower.includes('asunto') && tipoLower.includes('propio')) return 'As.Prop.';
  if (tipoLower.includes('permiso') && tipoLower.includes('retribuido')) return 'Perm.Ret.';
  if (tipoLower.includes('salida') && tipoLower.includes('regreso')) return 'Sal.Reg.';
  if (tipoLower.includes('salida') && tipoLower.includes('sin')) return 'Sal.Sin';
  return tipo.substring(0, 6) || 'Sol.';
};

// Funcție pentru culoarea indicatorului pe baza statusului
const getStatusIndicatorColor = (estado) => {
  switch (estado) {
    case 'Aprobada':
      return 'bg-green-500';
    case 'Pendiente':
      return 'bg-yellow-500';
    case 'Rechazada':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const formatBajaRecord = (item) => {
  const idCaso = item?.['Id.Caso'] ?? item?.Id_Caso ?? item?.id ?? '';
  const idPosicion = item?.['Id.Posición'] ?? item?.['Id.Posicion'] ?? item?.Id_Posici_n ?? '';
  // ID unic bazat pe Id.Caso + Id.Posición (cheia unică din baza de date)
  const uniqueId = idCaso && idPosicion ? `${idCaso}_${idPosicion}` : (item?.id ?? `baja_${Math.random().toString(36).slice(2, 9)}`);

  const parseISODateOnlyToUtc = (value) => {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || !mo || !d) return null;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  };

  const calculateInclusiveDays = (startISO, endISO) => {
    const start = parseISODateOnlyToUtc(startISO);
    const end = parseISODateOnlyToUtc(endISO);
    if (!start || !end) return null;
    const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (!isFinite(diff) || diff < 1) return null;
    return diff;
  };

  const fechaBajaRaw =
    item?.['Fecha baja'] ??
    item?.['Fecha Baja'] ??
    item?.fecha_baja ??
    item?.fechaBaja ??
    '';
  const fechaAltaRaw =
    item?.['Fecha de alta'] ??
    item?.['Fecha alta'] ??
    item?.['Fecha Alta'] ??
    item?.fecha_alta ??
    item?.fechaAlta ??
    '';

  const fuente = item?.fuente ?? '';

  const rawDiasBaja = item?.['Días de baja'] ?? item?.['Dias de baja'] ?? item?.dias_baja ?? null;
  const rawDiasPrevSps =
    item?.['Días previstos Servicio Público de Salud'] ??
    item?.['Dias previstos Servicio Publico de Salud'] ??
    item?.dias_previstos_sps ??
    null;

  // For MANUAL records, if day counts are missing/0, compute from dates (inclusive).
  const computedDiasBaja =
    String(fuente || '').toUpperCase() === 'MANUAL' &&
    (rawDiasBaja === null || rawDiasBaja === undefined || rawDiasBaja === '' || Number(rawDiasBaja) === 0) &&
    fechaBajaRaw
      ? calculateInclusiveDays(
          String(fechaBajaRaw).slice(0, 10),
          (fechaAltaRaw ? String(fechaAltaRaw).slice(0, 10) : new Date().toISOString().slice(0, 10))
        )
      : null;

  return {
    id: uniqueId,
    casoId: idCaso ?? '',
    trabajador:
      item?.Trabajador ??
      item?.trabajador ??
      item?.['Nombre empleado'] ??
      item?.['Nombre Empleado'] ??
      '',
    posicionId: item?.['Id.Posición'] ?? item?.['Id.Posicion'] ?? '',
    codigoEmpleado:
      item?.Codigo_Empleado ??
      item?.['Código Empleado'] ??
      item?.codigo_empleado ??
      item?.codigoEmpleado ??
      '',
    situacion: item?.['Situación'] ?? item?.Situacion ?? item?.situacion ?? '',
    diasBaja: rawDiasBaja ?? computedDiasBaja ?? 0,
    diasPrevistosSps: rawDiasPrevSps ?? 0,
    inicioPagoDelegado:
      item?.['Inicio pago delegado'] ?? item?.inicio_pago_delegado ?? item?.inicioPagoDelegado ?? '',
    finPagoDelegado:
      item?.['Fin pago delegado'] ?? item?.fin_pago_delegado ?? item?.finPagoDelegado ?? '',
    ultimaGestionMutua:
      item?.['Última gestión Mutua'] ?? item?.ultima_gestion_mutua ?? item?.ultimaGestionMutua ?? '',
    proximaGestionMutua:
      item?.['Próxima gestión Mutua'] ??
      item?.proxima_gestion_mutua ??
      item?.proximaGestionMutua ??
      '',
    pendienteINSS:
      item?.['Pendiente validación INSS'] ?? item?.pendiente_validacion_inss ?? item?.pendienteINSS ?? 0,
    demoraParteBaja:
      item?.['Demora recepción del parte de baja'] ??
      item?.demora_recepcion_parte_baja ??
      item?.demoraParteBaja ??
      '',
    ultimoParteConfirmacion:
      item?.['Último Parte de Confirmación'] ?? item?.ultimo_parte_confirmacion ?? '',
    diasBajaDetalle: item?.['Días de baja'] ?? item?.dias_baja ?? '',
    fechaBaja: fechaBajaRaw,
    fechaAlta: fechaAltaRaw,
    fuente,
    updatedAt: item?.updated_at ?? item?.updatedAt ?? '',
    tipo: 'Baja Médica',
    estado: item?.['Situación'] ?? item?.situacion ?? '',
    raw: item,
  };
};

// Component pentru item-ul de baja médica pe mobile (compact, similar cu MobileAusenciaItemTodas)
function MobileBajaMedicaItem({ item, formatDate, formatDateTime, getSituacionColor, isManager, editingBaja, editingBajaValue, onEditSituacion, onEditFechaBaja, onEditFechaAlta, formatNumber }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Scurtează numele pentru afișare compactă
  const getTrabajadorShort = (trabajador) => {
    if (!trabajador) return 'N/A';
    if (trabajador.length <= 15) return trabajador;
    return trabajador.substring(0, 12) + '...';
  };
  
  // Scurtează situacion pentru afișare compactă
  const getSituacionShort = (situacion) => {
    if (!situacion) return 'N/A';
    if (situacion.length <= 10) return situacion;
    return situacion.substring(0, 8) + '...';
  };
  
  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (roșu pentru bajas médicas) */}
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"></div>
        
        {/* Caso ID - text mic */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[50px]">
          #{item.casoId || item.id || 'N/A'}
        </span>
        
        {/* Trabajador - text mic, scurtat */}
        <span className="text-[11px] font-semibold flex-1 text-gray-700 dark:text-gray-300 truncate">
          {getTrabajadorShort(item.trabajador)}
        </span>
        
        {/* Situacion - badge mic */}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getSituacionColor(item.situacion)}`}>
          {getSituacionShort(item.situacion || 'N/A')}
        </span>
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Caso ID */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Caso:</span>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              {item.casoId || item.id || 'N/A'}
            </span>
          </div>
          
          {/* Trabajador complet */}
          {item.trabajador && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Trabajador:</span>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                {item.trabajador}
              </span>
            </div>
          )}
          
          {/* Posición */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Posición:</span>
            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
              {item.posicionId || 'N/A'}
            </span>
          </div>
          
          {/* Código empleado */}
          {item.codigoEmpleado && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Código:</span>
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                {item.codigoEmpleado}
              </span>
            </div>
          )}
          
          {/* Situación */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Situación:</span>
            {editingBaja?.idCaso === item.casoId && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'situacion' ? (
              <input
                type="text"
                value={editingBajaValue || ''}
                onChange={(e) => onEditSituacion(e.target.value)}
                className={`text-[10px] font-medium rounded-full px-2 py-1 border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${getSituacionColor(editingBajaValue)}`}
                autoFocus
                onBlur={() => {
                  if (editingBajaValue !== item.situacion) {
                    onEditSituacion(editingBajaValue, true);
                  } else {
                    onEditSituacion('', false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (editingBajaValue !== item.situacion) {
                      onEditSituacion(editingBajaValue, true);
                    } else {
                      onEditSituacion('', false);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onEditSituacion('', false);
                  }
                }}
                placeholder="Situación"
              />
            ) : (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity ${getSituacionColor(item.situacion)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isManager && item.casoId && item.posicionId) {
                    onEditSituacion(item.situacion || '', false);
                  }
                }}
                title={isManager ? "Clic para editar" : ""}
              >
                {item.situacion || 'Situación desconocida'}
              </span>
            )}
          </div>
          
          {/* Fuente */}
          {item.fuente && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Fuente:</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                {item.fuente}
              </span>
            </div>
          )}
          
          {/* Días de baja */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">🩺 Días de baja:</span>
            <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
              {formatNumber(item.diasBaja)} días
            </span>
            {item.diasPrevistosSps > 0 && (
              <span className="text-[9px] text-rose-600 dark:text-rose-400">
                (Previsto SPS: {formatNumber(item.diasPrevistosSps)})
              </span>
            )}
          </div>
          
          {/* Fecha baja */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Fecha baja:</span>
            {editingBaja?.idCaso === item.casoId && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'fechaBaja' ? (
              <input
                type="date"
                value={editingBajaValue || ''}
                onChange={(e) => onEditFechaBaja(e.target.value)}
                className="text-[10px] font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onBlur={() => {
                  if (editingBajaValue !== item.fechaBaja) {
                    onEditFechaBaja(editingBajaValue, true);
                  } else {
                    onEditFechaBaja('', false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onEditFechaBaja(editingBajaValue, true);
                  } else if (e.key === 'Escape') {
                    onEditFechaBaja('', false);
                  }
                }}
              />
            ) : (
              <span
                className="text-[10px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isManager && item.casoId && item.posicionId) {
                    onEditFechaBaja(item.fechaBaja || '', false);
                  }
                }}
                title={isManager ? "Clic para editar" : ""}
              >
                {formatDate(item.fechaBaja)}
              </span>
            )}
          </div>
          
          {/* Fecha alta */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Fecha alta:</span>
            {editingBaja?.idCaso === item.casoId && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'fechaAlta' ? (
              <input
                type="date"
                value={editingBajaValue || ''}
                onChange={(e) => onEditFechaAlta(e.target.value)}
                className="text-[10px] font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onBlur={() => {
                  if (editingBajaValue !== item.fechaAlta) {
                    onEditFechaAlta(editingBajaValue, true);
                  } else {
                    onEditFechaAlta('', false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onEditFechaAlta(editingBajaValue, true);
                  } else if (e.key === 'Escape') {
                    onEditFechaAlta('', false);
                  }
                }}
              />
            ) : (
              <span
                className="text-[10px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isManager && item.casoId && item.posicionId) {
                    onEditFechaAlta(item.fechaAlta || '', false);
                  }
                }}
                title={isManager ? "Clic para editar" : ""}
              >
                {formatDate(item.fechaAlta)}
              </span>
            )}
          </div>
          
          {/* Última actualización */}
          {item.updatedAt && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">Última actualización:</span>
              <span className="text-[9px] text-gray-600 dark:text-gray-400">
                {formatDateTime(item.updatedAt)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Ausencias justificada în Todas > Ausencias / Aprobación (mobil): detalii + buton comprobar bajo demanda. */
function MobileAusenciaJustificadaTodasBlocks({
  item,
  onComprobarJustificante,
  comprobarJustificanteItemId,
}) {
  const t = (item.tipo || item.TIPO || item.tipo_solicitud || item.TIPO_SOLICITUD || '').toLowerCase();
  const esAusenciaJustificada =
    t.includes('ausencia') && t.includes('justificada') && !t.includes('injustificada');
  if (!esAusenciaJustificada) return null;

  const labels = {
    cita_medica: 'Cita médica',
    cita_especialista: 'Cita con especialista',
    justificante_medico_sin_baja: 'Justificante médico (sin baja)',
    deber_inexcusable: 'Deber inexcusable',
    incidencia_puntual: 'Incidencia puntual/urgencia',
    otro: 'Otro',
  };
  const tipoLabel = labels[item.tipo_justificante] || item.tipo_justificante || '—';

  return (
    <div className="pt-2 border-t border-gray-200 dark:border-gray-600 space-y-2">
      <div className="p-2.5 rounded-lg border-2 border-cyan-200 dark:border-cyan-700 bg-cyan-50/80 dark:bg-cyan-900/20">
        <span className="block text-[10px] font-bold text-cyan-800 dark:text-cyan-200 mb-1.5">📋 Detalles ausencia justificada</span>
        <div className="space-y-1 text-[10px]">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Tipo justificante:</span>{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{tipoLabel}</span>
          </div>
          {(item.hora_cita || item.HORA_CITA) && (
            <div>
              <span className="text-gray-600 dark:text-gray-400">Hora cita:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">{item.hora_cita || item.HORA_CITA}</span>
            </div>
          )}
          {(item.centro_medico || item.CENTRO_MEDICO) && (
            <div>
              <span className="text-gray-600 dark:text-gray-400">Centro médico:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">{item.centro_medico || item.CENTRO_MEDICO}</span>
            </div>
          )}
          {(item.descripcion_otro || item.DESCRIPCION_OTRO) && (
            <div>
              <span className="text-gray-600 dark:text-gray-400">Descripción (otro):</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100 break-words">{item.descripcion_otro || item.DESCRIPCION_OTRO}</span>
            </div>
          )}
        </div>
      </div>
      {(item.motivo || item.MOTIVO) && (
        <div className="p-2.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
          <span className="block text-[10px] font-medium text-blue-700 dark:text-blue-300 mb-0.5">Motivo</span>
          <p className="text-[10px] text-blue-800 dark:text-blue-200 break-words">{item.motivo || item.MOTIVO}</p>
        </div>
      )}
      {onComprobarJustificante && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComprobarJustificante(item);
          }}
          disabled={comprobarJustificanteItemId === (item.id ?? item.ID)}
          className="w-full px-3 py-2 text-[11px] font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {comprobarJustificanteItemId === (item.id ?? item.ID) ? '⏳ Comprobando…' : '🔍 Comprobar justificante'}
        </button>
      )}
    </div>
  );
}

// Component pentru item-ul de ausencia pe mobile în "Todas las Solicitudes" (compact, similar cu MobileSolicitudItem)
function MobileAusenciaItemTodas({
  item,
  getAusenciaDurationDisplay,
  formatFechaFlexible,
  getTipoColor,
  formatHora,
  getStatusColor,
  onComprobarJustificante,
  comprobarJustificanteItemId,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const durationDisplay = getAusenciaDurationDisplay(item);
  
  // Formatează data
  const formattedDate = formatFechaFlexible(item.FECHA || item.fecha, item.fecha_inicio, item.fecha_fin);
  
  // Formatează HORA
  const formattedHora = formatHora(item.HORA || item.hora);
  
  // Scurtează tipul pentru afișare compactă
  const getTipoShort = (tipo) => {
    if (!tipo) return 'Aus.';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('injustificada')) return 'Injust.';
    if (tipoLower.includes('justificada')) return 'Justif.';
    if (tipoLower.includes('permiso')) return 'Perm.';
    return tipo.substring(0, 6) || 'Aus.';
  };

  const tipoRowLower = (item.TIPO || item.tipo || '').toLowerCase();
  const esAusenciaJustificadaTodas =
    tipoRowLower.includes('ausencia') &&
    tipoRowLower.includes('justificada') &&
    !tipoRowLower.includes('injustificada');

  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (portocaliu pentru ausencias) */}
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-500"></div>
        
        {/* Fecha - text mic (primul în titlu) */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[65px]">
          {formattedDate.length > 12 ? formattedDate.substring(0, 12) + '...' : formattedDate}
        </span>
        
        {/* Hora - text mic (după Fecha) */}
        {formattedHora !== '—' && (
          <span className="text-[11px] text-gray-700 dark:text-gray-300 font-semibold min-w-[45px]">
            {formattedHora}
          </span>
        )}
        
        {/* Tipo - text mic, scurtat */}
        <span className="text-[11px] font-semibold flex-1 text-gray-700 dark:text-gray-300">
          {getTipoShort(item.TIPO || item.tipo)}
        </span>
        
        {/* Nume - text mic, scurtat */}
        <span className="text-[10px] text-gray-500 dark:text-gray-400 min-w-[60px] truncate">
          {item.NOMBRE || item.nombre || 'N/A'}
        </span>
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Nume complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Empleado:</span>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              {item.NOMBRE || item.nombre || 'N/A'}
            </span>
          </div>
          
          {/* Código */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Código:</span>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
              {item.CODIGO || item.codigo || 'N/A'}
            </span>
          </div>
          
          {/* Tipo complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getTipoColor(item.TIPO || item.tipo)}`}>
              {item.TIPO || item.tipo || 'N/A'}
            </span>
          </div>
          
          {/* Estado (Pendiente / Aprobada / Rechazada) pentru Ausencias justificada și Permiso Retribuido */}
          {(() => {
            const t = (item.TIPO || item.tipo || '').toLowerCase();
            const isJustificada = t.includes('ausencia') && t.includes('justificada');
            const isPermiso = t.includes('permiso') && t.includes('retribuido');
            if (!isJustificada && !isPermiso || !getStatusColor) return null;
            const estado = (item.estado || item.ESTADO || 'Aprobada').trim();
            return (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Estado:</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusColor(estado)}`}>
                  {estado === 'Aprobada' ? '✅ Aprobada' : estado === 'Pendiente' ? '⏳ Pendiente' : '❌ Rechazada'}
                </span>
              </div>
            );
          })()}
          
          {/* Fecha */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Fecha:</span>
            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
              {formattedDate}
            </span>
          </div>
          
          {/* Hora */}
          {formattedHora !== '—' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Hora:</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                {formattedHora}
              </span>
            </div>
          )}
          
          {/* Ubicación */}
          {(item.LOCACION || item.locacion) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Ubicación:</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                {item.LOCACION || item.locacion}
              </span>
            </div>
          )}
          
          {/* Duración */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {durationDisplay.isDayBased ? '📅' : '⏱️'} Duración:
            </span>
            <span className={`text-[10px] font-medium ${
              durationDisplay.isDayBased 
                ? 'text-blue-700 dark:text-blue-300' 
                : 'text-purple-700 dark:text-purple-300'
            }`}>
              {durationDisplay.text}
            </span>
          </div>
          
          {/* ID și Codigo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
              ID: {item.id}
            </span>
            {item.CODIGO && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">
                Código: {item.CODIGO}
              </span>
            )}
          </div>
          
          {/* Motivo (Ausencias justificada: motivo va dentro del bloque nuevo, igual que en desktop) */}
          {!esAusenciaJustificadaTodas && (item.MOTIVO || item.motivo) && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400 mb-1">📝 Motivo</div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words">
                {item.MOTIVO || item.motivo}
              </p>
            </div>
          )}
          
          {/* Fecha Solicitud */}
          {(item.created_at || item.CREATED_AT || item.createdAt) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Fecha Solicitud:</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                {(() => {
                  const createdAt = item.created_at || item.CREATED_AT || item.createdAt;
                  if (!createdAt) return 'N/A';
                  try {
                    const date = new Date(createdAt.replace(' ', 'T'));
                    if (isNaN(date.getTime())) return createdAt;
                    return `${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`;
                  } catch {
                    return createdAt;
                  }
                })()}
              </span>
            </div>
          )}

          {esAusenciaJustificadaTodas && (
            <MobileAusenciaJustificadaTodasBlocks
              item={item}
              onComprobarJustificante={onComprobarJustificante}
              comprobarJustificanteItemId={comprobarJustificanteItemId}
            />
          )}
          
        </div>
      )}
    </div>
  );
}

/** YYYY-MM-DD pentru matching justificante (aliniat cu cardul desktop Mis Solicitudes). */
function normalizeFechaAusenciaSolicitud(solicitud) {
  let fechaAusencia = solicitud.FECHA || solicitud.fecha || solicitud.fecha_inicio || solicitud['fecha inicio'] || '';
  if (fechaAusencia && typeof fechaAusencia === 'string' && fechaAusencia.includes(' - ')) {
    fechaAusencia = fechaAusencia.split(' - ')[0].trim();
  }
  if (!fechaAusencia) fechaAusencia = solicitud.fecha_solicitud || '';
  let fechaNormalizada = '';
  if (fechaAusencia) {
    try {
      if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
        const fechaParts = fechaAusencia.trim().split('/');
        if (fechaParts.length === 3) {
          fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
        }
      } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
        fechaNormalizada = fechaAusencia.substring(0, 10);
      } else {
        const fecha = new Date(fechaAusencia);
        if (!isNaN(fecha.getTime())) fechaNormalizada = fecha.toISOString().split('T')[0];
      }
    } catch {
      /* ignore */
    }
  }
  return fechaNormalizada;
}

/** Două rânduri: justificante solicitud + presencia (versiune mobilă, aceeași logică ca desktop). */
function MobileJustificanteDosBloquesMisSolicitudes({
  solicitud,
  fechaNormalizada,
  currentMap,
  initialJustificantesPorFecha,
  openUploadJustificanteModal,
  onJustificanteError,
  openJustificantePreview,
}) {
  const mapFecha = initialJustificantesPorFecha || new Map();
  let fechaSolicitudNorm = '';
  try {
    const fs = solicitud.fecha_solicitud || solicitud.created_at || solicitud.FECHA_SOLICITUD;
    if (fs) {
      const d = new Date(fs);
      if (!isNaN(d.getTime())) fechaSolicitudNorm = d.toISOString().split('T')[0];
    }
  } catch {
    /* ignore */
  }
  const docsIniciales = mapFecha.get(fechaNormalizada) || mapFecha.get(fechaSolicitudNorm) || [];
  const tipoNormMis = (solicitud.tipo || solicitud.TIPO || solicitud.tipo_solicitud || solicitud.TIPO_SOLICITUD || '').toLowerCase();
  const esAusenciaJustificada = tipoNormMis.includes('ausencia') && tipoNormMis.includes('justificada');
  const keyCerere = `Ausencias justificada_${fechaNormalizada}`;
  const keyCerereSinEspacios = `Ausenciasjustificada_${fechaNormalizada}`;
  const justificanteCerereFromMap = esAusenciaJustificada ? (currentMap.get(keyCerere) || currentMap.get(keyCerereSinEspacios)) : null;
  const docCerereFromMap = justificanteCerereFromMap?.doc_id
    ? { doc_id: justificanteCerereFromMap.doc_id, nombre_archivo: justificanteCerereFromMap.doc_nombre_archivo || 'Justificante' }
    : null;
  const docCerere = docsIniciales[0] || docCerereFromMap;
  const tieneJustificanteCerere = docsIniciales.length > 0 || !!docCerereFromMap;
  const keyPresencia = `Ausencias justificada_${fechaNormalizada}_presencia`;
  const keyPresenciaSinEspacios = `Ausenciasjustificada_${fechaNormalizada}_presencia`;
  const justificantePresencia = esAusenciaJustificada
    ? currentMap.get(keyPresencia) || currentMap.get(keyPresenciaSinEspacios)
    : null;
  const codigo = solicitud.codigo || solicitud.CODIGO || '';
  const email = solicitud.email || '';

  const downloadDoc = (docId, fileName) => {
    const token = localStorage.getItem('auth_token');
    const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${docId}&id=${codigo}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(fileName || '')}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? 'No autorizado' : 'Error al cargar');
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || 'justificante';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      })
      .catch(() => onJustificanteError?.('Error al descargar el justificante. Inicia sesión si es necesario.'));
  };

  const previewDoc = (docId, fileName) => {
    const token = localStorage.getItem('auth_token');
    const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${docId}&id=${codigo}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(fileName || '')}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        openJustificantePreview?.({
          isOpen: true,
          blobUrl,
          fileName: fileName || 'Justificante',
          mimeType: blob.type || '',
        });
      })
      .catch(() => onJustificanteError?.('Error al abrir el justificante. Inicia sesión si es necesario.'));
  };

  return (
    <div className="pt-2 border-t border-gray-200 dark:border-gray-600 space-y-2">
      <div className="p-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-gray-600/30 space-y-2">
        <div>
          <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 mb-1">Justificante para la solicitud:</p>
          {tieneJustificanteCerere ? (
            <div className="text-[10px] text-green-700 dark:text-green-300 flex flex-col gap-1.5">
              <span>✅ Cargado</span>
              {docCerere && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadDoc(docCerere.doc_id, docCerere.nombre_archivo);
                    }}
                    className="px-2 py-1 text-[10px] font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                  >
                    📥 Descargar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      previewDoc(docCerere.doc_id, docCerere.nombre_archivo);
                    }}
                    className="px-2 py-1 text-[10px] font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                  >
                    👁️ Ver
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-600 dark:text-gray-300">No cargado.</p>
          )}
        </div>
        {esAusenciaJustificada && (
          <div>
            <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 mb-1">Justificante de presencia a la cita:</p>
            {justificantePresencia ? (
              <div className="text-[10px]">
                {justificantePresencia.estado === 'completado' ? (
                  <div className="text-green-700 dark:text-green-300 flex flex-col gap-1.5">
                    <span>✅ Completado</span>
                    {(justificantePresencia.doc_id || justificantePresencia.doc_ID) ? (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const docId = justificantePresencia.doc_id || justificantePresencia.doc_ID;
                            downloadDoc(
                              docId,
                              justificantePresencia.doc_nombre_archivo || justificantePresencia.doc_NOMBRE_ARCHIVO || 'justificante-presencia',
                            );
                          }}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                        >
                          📥 Descargar
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const docId = justificantePresencia.doc_id || justificantePresencia.doc_ID;
                            previewDoc(
                              docId,
                              justificantePresencia.doc_nombre_archivo || justificantePresencia.doc_NOMBRE_ARCHIVO || 'Justificante presencia',
                            );
                          }}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                        >
                          👁️ Ver
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const token = localStorage.getItem('auth_token');
                            try {
                              const r = await fetch(
                                `${routes.getDocumentos || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos`}?empleadoId=${encodeURIComponent(codigo)}`,
                                { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                              );
                              if (!r.ok) throw new Error();
                              const data = await r.json();
                              const docs = Array.isArray(data) ? data : (data?.data || []);
                              const presencia = docs.find((d) => (d.tipo_documento || '').toLowerCase().includes('presencia'));
                              const doc = presencia || docs.find((d) => (d.tipo_documento || '').toLowerCase().includes('justificante'));
                              if (!doc?.doc_id) {
                                onJustificanteError?.('No se encontró el documento.');
                                return;
                              }
                              downloadDoc(doc.doc_id, doc.nombre_archivo || 'justificante-presencia');
                            } catch {
                              onJustificanteError?.('Error al descargar. Inicia sesión si es necesario.');
                            }
                          }}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                        >
                          📥 Descargar
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const token = localStorage.getItem('auth_token');
                            try {
                              const r = await fetch(
                                `${routes.getDocumentos || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos`}?empleadoId=${encodeURIComponent(codigo)}`,
                                { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                              );
                              if (!r.ok) throw new Error();
                              const data = await r.json();
                              const docs = Array.isArray(data) ? data : (data?.data || []);
                              const presencia = docs.find((d) => (d.tipo_documento || '').toLowerCase().includes('presencia'));
                              const doc = presencia || docs.find((d) => (d.tipo_documento || '').toLowerCase().includes('justificante'));
                              if (!doc?.doc_id) {
                                onJustificanteError?.('No se encontró el documento.');
                                return;
                              }
                              const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${doc.doc_id}&id=${codigo}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(doc.nombre_archivo || 'justificante-presencia')}`;
                              const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                              if (!res.ok) throw new Error();
                              const blob = await res.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              openJustificantePreview?.({
                                isOpen: true,
                                blobUrl,
                                fileName: doc.nombre_archivo || 'Justificante presencia',
                                mimeType: blob.type || '',
                              });
                            } catch {
                              onJustificanteError?.('Error al abrir. Inicia sesión si es necesario.');
                            }
                          }}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                        >
                          👁️ Ver
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300">⏳ Pendiente de subir</span>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Se solicitará tras la aprobación.</p>
            )}
          </div>
        )}
        {!tieneJustificanteCerere && openUploadJustificanteModal && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openUploadJustificanteModal(solicitud);
            }}
            className="w-full px-2 py-1.5 text-[10px] font-medium rounded bg-green-600 text-white hover:bg-green-700"
          >
            📤 Cargar Justificante
          </button>
        )}
      </div>
    </div>
  );
}

// Component pentru item-ul de solicitare pe mobile (compact, similar cu MobileAusenciaItem din Fichaje)
function MobileSolicitudItem({
  solicitud,
  getAusenciaDurationDisplay,
  formatDate,
  formatDateRange,
  getStatusColor,
  getSolicitudTipoShort,
  getStatusIndicatorColor,
  justificantesPorAusencia,
  initialJustificantesPorFecha,
  openUploadJustificanteModal,
  onJustificanteError,
  openJustificantePreview,
  onEdit,
  onDelete,
  isDeleting,
  allAusencias,
  solicitudesLookup,
  onComprobarJustificante,
  comprobarJustificanteItemId,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const durationDisplay = getAusenciaDurationDisplay(solicitud);
  
  // Formatează data solicitării
  const formattedFechaSolicitud = formatDate(solicitud.fecha_solicitud);
  
  // Formatează perioada
  const formattedPeriodo = solicitud.FECHA 
    ? formatDateRange(solicitud.FECHA)
    : (solicitud.fecha_inicio && solicitud.fecha_fin 
      ? formatDateRange(`${solicitud.fecha_inicio} - ${solicitud.fecha_fin}`)
      : formatDate(solicitud.fecha_inicio || solicitud.fecha || solicitud["fecha inicio"] || ''));
  
  // Verifică dacă are justificante (doar pentru ausencias, nu pentru Vacaciones sau Asunto Propio)
  const tipoNormalized = (solicitud.tipo || '').toLowerCase();
  const isVacaciones = tipoNormalized.includes('vacacion');
  const isAsuntoPropio = tipoNormalized.includes('asunto') && tipoNormalized.includes('propio');
  const esAusencia = !isVacaciones && !isAsuntoPropio && 
                    (solicitud.FECHA || solicitud.fecha || solicitud.fecha_inicio || solicitud.fecha_solicitud);
  
  const fechaNormAus = esAusencia ? normalizeFechaAusenciaSolicitud(solicitud) : '';
  // Doar din props (state în părinte); fără ref în render — ref-ul e menținut în sync cu setJustificantesPorAusenciaWithRef
  const currentMapForJust =
    justificantesPorAusencia && justificantesPorAusencia.size > 0
      ? justificantesPorAusencia
      : new Map();
  const tipoAusenciaFull = solicitud.tipo || '';
  const tipoNormJustMobile = (solicitud.tipo || solicitud.TIPO || '').toLowerCase();
  const esAusenciaJustificadaParaDosBloques =
    tipoNormJustMobile.includes('ausencia') && tipoNormJustMobile.includes('justificada');

  let justificante = null;
  if (esAusencia && fechaNormAus && tipoAusenciaFull && currentMapForJust) {
    const keyExact = `${tipoAusenciaFull}_${fechaNormAus}`;
    const keyExactSinEspacios = `${tipoAusenciaFull.replace(/\s+/g, '')}_${fechaNormAus}`;
    justificante = currentMapForJust.get(keyExact) || currentMapForJust.get(keyExactSinEspacios);
    if (!justificante) {
      for (const [, value] of currentMapForJust.entries()) {
        if (value.fechaAusencia === fechaNormAus) {
          const tipoJustificante = (value.tipoAusencia || '').toLowerCase().trim();
          const tipoAusenciaNormalizado = tipoAusenciaFull.toLowerCase().trim();
          if (tipoJustificante === tipoAusenciaNormalizado) {
            justificante = value;
            break;
          }
        }
      }
    }
    if (justificante) {
      if (justificante.fechaAusencia && fechaNormAus && justificante.fechaAusencia !== fechaNormAus) {
        justificante = null;
      } else if (justificante.tipoAusencia && tipoAusenciaFull) {
        const tipoJustificante = justificante.tipoAusencia.toLowerCase().trim();
        const tipoAusenciaNormalizado = tipoAusenciaFull.toLowerCase().trim();
        if (tipoJustificante !== tipoAusenciaNormalizado) justificante = null;
      }
    }
  }
  
  // Verifică dacă ausencia este asociată cu alta care are justificante
  const ausenciaAsociadaId = solicitud.ausencia_asociada_id;
  const ausenciaAsociada = ausenciaAsociadaId
    ? (Array.isArray(solicitudesLookup) && solicitudesLookup.length > 0
        ? solicitudesLookup.find((s) => (s.id || s.ID) === ausenciaAsociadaId)
        : null) ||
      (Array.isArray(allAusencias) ? allAusencias.find((a) => (a.id || a.ID) === ausenciaAsociadaId) : null)
    : null;
  
  // Verifică dacă ausencia asociată are justificante
  let ausenciaAsociadaTieneJustificantes = false;
  let fechaNormalizadaForAsociada = '';
  if (ausenciaAsociada && !justificante) {
    // Normalizăm data pentru ausencia asociată
    const fechaAusencia = solicitud.FECHA || solicitud.fecha || solicitud.fecha_inicio || solicitud['fecha inicio'] || '';
    if (fechaAusencia) {
      try {
        if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
          const fechaParts = fechaAusencia.trim().split('/');
          if (fechaParts.length === 3) {
            fechaNormalizadaForAsociada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
          }
        } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
          fechaNormalizadaForAsociada = fechaAusencia.substring(0, 10);
        } else {
          const fecha = new Date(fechaAusencia);
          if (!isNaN(fecha.getTime())) {
            fechaNormalizadaForAsociada = fecha.toISOString().split('T')[0];
          }
        }
      } catch {
        // Ignore
      }
    }
  }
  
  if (ausenciaAsociada && !justificante && fechaNormalizadaForAsociada) {
    const fechaAsociada = ausenciaAsociada.FECHA || ausenciaAsociada.fecha || ausenciaAsociada.fecha_inicio || '';
    let fechaAsociadaNormalizada = '';
    if (fechaAsociada) {
      try {
        if (typeof fechaAsociada === 'string' && fechaAsociada.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
          const fechaParts = fechaAsociada.trim().split('/');
          if (fechaParts.length === 3) {
            fechaAsociadaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
          }
        } else if (typeof fechaAsociada === 'string' && fechaAsociada.match(/^\d{4}-\d{2}-\d{2}/)) {
          fechaAsociadaNormalizada = fechaAsociada.substring(0, 10);
        } else {
          const fecha = new Date(fechaAsociada);
          if (!isNaN(fecha.getTime())) {
            fechaAsociadaNormalizada = fecha.toISOString().split('T')[0];
          }
        }
      } catch {
        // Ignore
      }
    }
    
    if (fechaAsociadaNormalizada && currentMapForJust) {
      for (const [, value] of currentMapForJust.entries()) {
        if (value.fechaAusencia === fechaAsociadaNormalizada) {
          ausenciaAsociadaTieneJustificantes = true;
          break;
        }
      }
    }
  }
  
  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (verde/galben/roșu) */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusIndicatorColor(solicitud.estado)}`}></div>
        
        {/* Pentru Vacaciones și Asuntos Propios: afișăm numele/inițialele în loc de FECHA */}
        {(isVacaciones || isAsuntoPropio) && solicitud.nombre ? (
          <span className="text-[11px] text-gray-700 dark:text-gray-300 font-semibold min-w-[65px] truncate">
            {(() => {
              const nombre = solicitud.nombre || solicitud.NOMBRE || '';
              if (!nombre) return '—';
              // Dacă numele este prea lung, afișăm inițialele
              if (nombre.length > 12) {
                const parts = nombre.trim().split(' ').filter(p => p && p.trim() !== '');
                if (parts.length >= 2) {
                  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                }
                return nombre.substring(0, 10) + '...';
              }
              return nombre;
            })()}
          </span>
        ) : (
          /* Pentru alte tipuri: afișăm FECHA */
          <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[65px]">
            {formattedFechaSolicitud.length > 12 ? formattedFechaSolicitud.substring(0, 12) + '...' : formattedFechaSolicitud}
          </span>
        )}
        
        {/* Duration - text mic */}
        <span className={`text-[10px] font-medium min-w-[45px] ${
          durationDisplay.isDayBased 
            ? 'text-blue-600 dark:text-blue-400' 
            : 'text-purple-600 dark:text-purple-400'
        }`}>
          {durationDisplay.text}
        </span>
        
        {/* Tipo - text mic, scurtat */}
        <span className="text-[11px] font-semibold flex-1 text-gray-700 dark:text-gray-300">
          {getSolicitudTipoShort(solicitud.tipo)}
        </span>
        
        {/* Status badge mic */}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(solicitud.estado)}`}>
          {solicitud.estado === 'Aprobada' ? '✓' : solicitud.estado === 'Pendiente' ? '⏳' : '✗'}
        </span>
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Nume complet (doar pentru Vacaciones și Asuntos Propios) */}
          {(isVacaciones || isAsuntoPropio) && solicitud.nombre && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Empleado:</span>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                {solicitud.nombre || solicitud.NOMBRE || 'N/A'}
              </span>
            </div>
          )}
          
          {/* Tipo complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              {solicitud.tipo}
            </span>
          </div>
          
          {/* Status complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Estado:</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusColor(solicitud.estado)}`}>
              {solicitud.estado === 'Aprobada' ? '✅ Aprobada' : solicitud.estado === 'Pendiente' ? '⏳ Pendiente' : '❌ Rechazada'}
            </span>
          </div>
          
          {/* Período */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Período:</span>
            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
              {formattedPeriodo}
            </span>
          </div>
          
          {/* Duration complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {durationDisplay.isDayBased ? '📅' : '⏱️'} Duración:
            </span>
            <span className={`text-[10px] font-medium ${
              durationDisplay.isDayBased 
                ? 'text-blue-700 dark:text-blue-300' 
                : 'text-purple-700 dark:text-purple-300'
            }`}>
              {durationDisplay.text}
            </span>
          </div>
          
          {/* ID și Codigo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
              ID: {solicitud.id}
            </span>
            {solicitud.codigo && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">
                Código: {solicitud.codigo}
              </span>
            )}
          </div>
          
          {/* Motivo */}
          {solicitud.motivo && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400 mb-1">📝 Motivo</div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words">
                {solicitud.motivo}
              </p>
            </div>
          )}
          
          {/* Indicator asociere (dacă există) */}
          {ausenciaAsociada && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] text-blue-600">🔗</span>
                <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                  Asociada con: {ausenciaAsociada.TIPO || ausenciaAsociada.tipo} #{ausenciaAsociada.id || ausenciaAsociada.ID}
                </span>
              </div>
            </div>
          )}
          
          {/* Justificante — aliniat cu desktop: Ausencias justificada = două blocuri (solicitud + presencia) */}
          {esAusencia && (() => {
            if (!fechaNormAus) return null;

            if (justificante && !esAusenciaJustificadaParaDosBloques) {
              const esPendiente = justificante.estado === 'pendiente';
              const esCompletado = justificante.estado === 'completado';
              return (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400 mb-1">📋 Justificante</div>
                  <div className="text-[10px] text-gray-700 dark:text-gray-300 mb-2">
                    {justificante.tipo_documento} - {esCompletado ? '✅ Completado' : '⏳ Pendiente'}
                  </div>
                  {esPendiente && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = '/documentos';
                      }}
                      className="w-full px-2 py-1.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center justify-center gap-1"
                    >
                      📤 Subir
                    </button>
                  )}
                </div>
              );
            }
            if (ausenciaAsociadaTieneJustificantes) {
              return (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-green-600">✅</span>
                    <span className="text-[10px] font-medium text-green-700 dark:text-green-300">
                      Justificantes gestionados a través de la ausencia asociada
                    </span>
                  </div>
                </div>
              );
            }

            const noNecesitaJustificante =
              solicitud.no_necesita_justificante === true ||
              solicitud.no_necesita_justificante === 1 ||
              solicitud.no_necesita_justificante === 'true' ||
              solicitud.NO_NECESITA_JUSTIFICANTE === true ||
              solicitud.NO_NECESITA_JUSTIFICANTE === 1 ||
              solicitud.NO_NECESITA_JUSTIFICANTE === 'true';
            if (noNecesitaJustificante) {
              return (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-2">
                    ✅ No Necesita Justificante
                  </div>
                </div>
              );
            }

            const tipoAusenciaLower = (solicitud.tipo || solicitud.TIPO || '').toLowerCase();
            if (tipoAusenciaLower.includes('ausencia injustificada')) {
              return (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-2">
                    ❌ Esta ausencia está marcada como injustificada.
                  </div>
                </div>
              );
            }

            if (esAusenciaJustificadaParaDosBloques && onComprobarJustificante) {
              const itemId = solicitud.id ?? solicitud.ID;
              return (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onComprobarJustificante(solicitud);
                    }}
                    disabled={comprobarJustificanteItemId === itemId}
                    className="w-full px-3 py-2 text-[11px] font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {comprobarJustificanteItemId === itemId ? '⏳ Comprobando…' : '🔍 Comprobar justificante'}
                  </button>
                </div>
              );
            }

            return (
              <MobileJustificanteDosBloquesMisSolicitudes
                solicitud={solicitud}
                fechaNormalizada={fechaNormAus}
                currentMap={currentMapForJust}
                initialJustificantesPorFecha={initialJustificantesPorFecha}
                openUploadJustificanteModal={openUploadJustificanteModal}
                onJustificanteError={onJustificanteError}
                openJustificantePreview={openJustificantePreview}
              />
            );
          })()}
          
          {/* Butoane Edit și Delete (doar dacă sunt furnizate) */}
          {onEdit && onDelete && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) {
                    onEdit(solicitud);
                  }
                }}
                className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center justify-center gap-1"
              >
                ✏️ Editar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDelete) {
                    onDelete(solicitud.id);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-800 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ Eliminar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SolicitudesPage() {
  const { user: authUser } = useAuth();
  const { callApi } = useApi();
  const { getPermissions } = useAdminApi();
  const { isMobile } = useBreakpoint();
  
  const [tipo, setTipo] = useState('Asuntos Propios');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fechaUltimoDiaTrabajo, setFechaUltimoDiaTrabajo] = useState('');
  const [bajaVoluntariaDocumento, setBajaVoluntariaDocumento] = useState(null); // Fișier pentru BAJA_VOLUNTARIA
  const [motivo, setMotivo] = useState('');
  // Ausencia justificada: tipo justificante + câmpuri condiționale
  const [tipoJustificante, setTipoJustificante] = useState('');
  const [horaCita, setHoraCita] = useState('');
  const [centroMedico, setCentroMedico] = useState('');
  const [descripcionOtro, setDescripcionOtro] = useState('');
  const [archivoJustificante, setArchivoJustificante] = useState(null);
  const [editingSolicitud, setEditingSolicitud] = useState(null); // ID-ul solicitării în curs de editare
  const [originalSolicitudData, setOriginalSolicitudData] = useState(null); // Datele originale ale solicitării în curs de editare
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, solicitudId: null, mensaje: '' }); // Modal de confirmare ștergere cu mesaj personalizat
  const [deleteBajaMedicaModal, setDeleteBajaMedicaModal] = useState({ isOpen: false, baja: null, mensaje: '' }); // Modal pentru ștergere baja médica cu mesaj
  const [rejectPermisoModal, setRejectPermisoModal] = useState({ isOpen: false, solicitud: null, mensaje: '', tipoSolicitud: 'Permiso Retribuido' }); // Modal respingere (Permiso Retribuido / Ausencias justificada)
  const [convertirConfirm, setConvertirConfirm] = useState({ isOpen: false, ausencia: null }); // Modal de confirmare conversie ausencia
  const [convertirTipoModal, setConvertirTipoModal] = useState({ 
    isOpen: false, 
    ausencia: null, 
    mensaje: '',
    fechaInicio: '',
    fechaFin: '',
    nuevoTipo: null // Tipul selectat pentru a ști când să afișăm câmpurile de date
  }); // Modal pentru conversie tip Permiso Retribuido
  const [asociarAusenciaModal, setAsociarAusenciaModal] = useState({ isOpen: false, ausencia: null }); // Modal pentru asociere ausencias
  const [editarDuracionModal, setEditarDuracionModal] = useState({ isOpen: false, ausencia: null, duracion: '', unidad: 'dias' }); // Modal pentru editare manuală durată
  const [selectedAusenciaIdForAsociar, setSelectedAusenciaIdForAsociar] = useState(null); // Ausencia selectată pentru asociere
  const [bajaVoluntariaPreview, setBajaVoluntariaPreview] = useState({ isOpen: false, solicitud: null, pdfUrl: null }); // Modal preview PDF Baja Voluntaria
  const [justificantePreview, setJustificantePreview] = useState({
    isOpen: false,
    blobUrl: null,
    fileName: '',
    mimeType: '',
  }); // Modal preview justificante (Ausencias justificada)
  const [justificanteStatusModal, setJustificanteStatusModal] = useState({
    isOpen: false,
    loading: false,
    item: null,
    cerere: null,
    presencia: null,
    error: null,
  }); // Modal estado justificantes (Todas > Aprobación, carga bajo demanda)
  const [comprobarJustificanteItemId, setComprobarJustificanteItemId] = useState(null);
  // Loading states centralizate
  const { setOperationLoading, isOperationLoading } = useLoadingState();
  const [serverResp, setServerResp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [solicitudes, setSolicitudes] = useState([]);
  const [activeTab, setActiveTab] = useState('lista'); // 'lista' | 'nueva' | 'todas' | 'estadisticas'
  const [allSolicitudes, setAllSolicitudes] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [totalAsuntoPropioDays, setTotalAsuntoPropioDays] = useState(0);
  const [totalVacacionesDays, setTotalVacacionesDays] = useState(0);
  // Anul pentru filtrarea listei "Mis Solicitudes" (doar vacanțe/solicitudini din acel an)
  const [misSolicitudesYear, setMisSolicitudesYear] = useState(() => new Date().getFullYear());
  // State pentru datele complete ale utilizatorului (inclusiv certificado_handicap_confirmado)
  const [empleadoCompleto, setEmpleadoCompleto] = useState(null);
  // State pentru saldo-ul real de vacanțe (din backend)
  const [vacacionesSaldo, setVacacionesSaldo] = useState({
    dias_anuales: 31, // Default fallback
    dias_restantes_ano_anterior: 0,
    dias_restantes: 0, // Zile rămase disponibile
  });
  // State pentru saldo-ul real de asuntos propios (din backend)
  const [asuntosPropiosSaldo, setAsuntosPropiosSaldo] = useState({
    dias_anuales: 0, // Default fallback
    dias_consumidos_aprobados: 0,
    dias_restantes: 0,
  });
  
  // Estadísticas states
  const [estadisticas, setEstadisticas] = useState([]);
  const [estadisticasLoading, setEstadisticasLoading] = useState(false);
  const [editingRestantes, setEditingRestantes] = useState({}); // { codigo: value }
  const [editingVacacionesAnuales, setEditingVacacionesAnuales] = useState({}); // { codigo: value }
  const [editingAsuntosPropiosAnuales, setEditingAsuntosPropiosAnuales] = useState({}); // { codigo: value }

  // Calendar states for Vacaciones
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState([]);
  const [occupiedDates, setOccupiedDates] = useState([]);
  const [dateAvailability, setDateAvailability] = useState({}); // { date: { available: 5, total: 10, group: 'Limpiador' } }
  // Cache pentru request-urile de disponibilitate (evită request-uri duplicate)
  const occupiedDatesCacheRef = useRef(new Map()); // { "2026-10-Vacaciones": { data, timestamp } }
  const loadOccupiedDatesTimeoutRef = useRef(null);


  // Filtros para managers
  const [selectedTab, setSelectedTab] = useState('asunto'); // 'asunto' | 'vacaciones' | 'ausencias' | 'baja' | 'baja_voluntaria' | 'aprobacion' | 'control_vacaciones'
  /** Año del panel de control de cupos (Todas → Control vacaciones) */
  const [vacationControlYear, setVacationControlYear] = useState(() => new Date().getFullYear());
  /** Menú contextual (Control vacaciones): mes 0–11 (Ene–Dic), posición fija para no recortar con overflow-x */
  const [vacationMonthMenuIdx, setVacationMonthMenuIdx] = useState(null);
  const [vacationMonthMenuPos, setVacationMonthMenuPos] = useState({ top: 0, left: 0 });
  const [vacationMonthActionBusy, setVacationMonthActionBusy] = useState(false);
  /** Catálogo horarios (tabla `horarios`): carga en Control vacaciones para h/día desde horario asignado */
  const [horariosCatalog, setHorariosCatalog] = useState([]);
  /** Mes (0–11) para cruzar la tabla Limpiador/L con vacaciones (mismo año que vacationControlYear) */
  const [vacationPartTimeCompareMonth, setVacationPartTimeCompareMonth] = useState(() =>
    new Date().getMonth(),
  );
  const selectedStatus = 'Todos';
  // Documentos asociados con BAJA_VOLUNTARIA: Map<solicitudId, documento>
  const [bajaVoluntariaDocumentos, setBajaVoluntariaDocumentos] = useState(new Map());
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedTipoAusencia, setSelectedTipoAusencia] = useState(['ALL']); // Filtrul de tip pentru ausencias (array pentru multi-select)
  const [showTipoDropdown, setShowTipoDropdown] = useState(false); // Pentru a controla vizibilitatea dropdown-ului multi-select
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const bajaFileInputRef = useRef(null);
  const [allBajasMedicas, setAllBajasMedicas] = useState([]);
  // State pentru filtrul de bajas médicas (null = toate, 'cerradas' = doar închise, 'abiertas' = doar deschise)
  const [bajaFilter, setBajaFilter] = useState(null);
  // State pentru editare bajas médicas
  const [editingBaja, setEditingBaja] = useState(null); // { idCaso, idPosicion, field: 'fechaBaja' | 'fechaAlta' | 'situacion' }
  const [editingBajaValue, setEditingBajaValue] = useState('');

  // Manual baja (creare rapidă)
  const [showManualBajaModal, setShowManualBajaModal] = useState(false);
  const [manualEmployeeSearch, setManualEmployeeSearch] = useState('');
  const [manualShowEmployeeDropdown, setManualShowEmployeeDropdown] = useState(false);
  const [manualSelectedEmployee, setManualSelectedEmployee] = useState(null); // { codigo, name, email }
  const [manualBajaFechaBaja, setManualBajaFechaBaja] = useState('');
  const [manualBajaFechaAlta, setManualBajaFechaAlta] = useState('');
  // Perioade blocate pentru vacanțe (modal Bloquear periodos)
  const [showVacationBlockedPeriodsModal, setShowVacationBlockedPeriodsModal] = useState(false);
  const [vacationBlockedPeriods, setVacationBlockedPeriods] = useState([]);
  const [newBlockedPeriodInicio, setNewBlockedPeriodInicio] = useState('');
  const [newBlockedPeriodFin, setNewBlockedPeriodFin] = useState('');
  const [blockedPeriodsYear, setBlockedPeriodsYear] = useState(() => new Date().getFullYear());
  const [showAsuntoPropioBlockedPeriodsModal, setShowAsuntoPropioBlockedPeriodsModal] = useState(false);
  const [asuntoPropioBlockedPeriods, setAsuntoPropioBlockedPeriods] = useState([]);
  const [newApBlockedPeriodInicio, setNewApBlockedPeriodInicio] = useState('');
  const [newApBlockedPeriodFin, setNewApBlockedPeriodFin] = useState('');
  const [blockedApPeriodsYear, setBlockedApPeriodsYear] = useState(() => new Date().getFullYear());
  // % del grupo en vacaciones simultáneas (misma regla que backend; por defecto 10)
  const [vacacionesDisponibilidadPct, setVacacionesDisponibilidadPct] = useState(10);
  const [vacacionPctDraft, setVacacionPctDraft] = useState('10');
  const [savingVacacionPct, setSavingVacacionPct] = useState(false);
  const [asuntosPropiosMaxPorDia, setAsuntosPropiosMaxPorDia] = useState(
    DEFAULT_ASUNTOS_PROPIOS_MAX_POR_DIA,
  );
  const [apMaxPersonasDraft, setApMaxPersonasDraft] = useState('3');
  const [savingApMaxPersonas, setSavingApMaxPersonas] = useState(false);

  // Conflicte MANUAL vs MUTUA (după upload Excel)
  const [showBajaConflictsModal, setShowBajaConflictsModal] = useState(false);
  const [bajaConflicts, setBajaConflicts] = useState([]);
  const [bajaConflictChoices, setBajaConflictChoices] = useState({}); // key -> action
  
  // Modal pentru manager să creeze solicitări pentru angajați
  const [showManagerSolicitudModal, setShowManagerSolicitudModal] = useState(false);
  const [managerSelectedEmpleado, setManagerSelectedEmpleado] = useState(null); // { codigo, nombre, email }
  const [managerEmpleadoSearch, setManagerEmpleadoSearch] = useState('');
  const [managerShowEmpleadoDropdown, setManagerShowEmpleadoDropdown] = useState(false);
  const [managerAutoApprove, setManagerAutoApprove] = useState(true); // Checkbox "Aprobar automáticamente"
  
  // Ausencias states
  const [allAusencias, setAllAusencias] = useState([]);

  // Verifică dacă o solicitare se suprapune cu un an dat (pentru filtrarea "Mis Solicitudes" pe an)
  const solicitudOverlapsYear = useCallback((solicitud, year) => {
    let startStr = solicitud.fecha_inicio || solicitud['fecha inicio'] || solicitud.fecha;
    let endStr = solicitud.fecha_fin || solicitud['fecha fin'] || solicitud.fecha;
    if (solicitud.FECHA && solicitud.FECHA.includes(' - ')) {
      const parts = solicitud.FECHA.split(' - ');
      startStr = parts[0]?.trim();
      endStr = parts[1]?.trim();
    }
    if (!startStr) return false;
    const start = new Date(startStr.trim());
    const end = endStr ? new Date(endStr.trim()) : start;
    if (isNaN(start.getTime())) return false;
    const endDate = isNaN(end.getTime()) ? start : end;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    return start <= yearEnd && endDate >= yearStart;
  }, []);

  // Lista filtrată pe an pentru "Mis Solicitudes" și totaluri pentru acel an
  const { solicitudesForYear, totalVacacionesDaysForYear, totalAsuntoPropioDaysForYear } = useMemo(() => {
    const year = misSolicitudesYear;
    const filtered = solicitudes.filter(s => solicitudOverlapsYear(s, year));
    let vacaciones = 0;
    let asunto = 0;
    filtered.forEach(item => {
      const tipo = (item.tipo || item.TIPO || '').toLowerCase();
      let startStr = item.fecha_inicio || item['fecha inicio'] || item.fecha;
      let endStr = item.fecha_fin || item['fecha fin'] || item.fecha;
      if (item.FECHA && item.FECHA.includes(' - ')) {
        const parts = item.FECHA.split(' - ');
        startStr = parts[0]?.trim();
        endStr = parts[1]?.trim();
      }
      if (startStr) {
        const start = new Date(startStr);
        const end = endStr ? new Date(endStr) : start;
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
        const numDays = Math.max(1, Math.floor(days));
        if (tipo.includes('vacacion')) vacaciones += numDays;
        else if (tipo.includes('asunto') || tipo.includes('propio')) asunto += numDays;
      }
    });
    return {
      solicitudesForYear: filtered,
      totalVacacionesDaysForYear: vacaciones,
      totalAsuntoPropioDaysForYear: asunto,
    };
  }, [solicitudes, misSolicitudesYear, solicitudOverlapsYear]);

  // States pentru solicitare justificante (documentos solicitados) - ELIMINAT (folosim recordarJustificante direct)
  
  // States pentru upload justificante (cargar justificante)
  const [showUploadJustificanteModal, setShowUploadJustificanteModal] = useState(false);
  const [selectedAusenciaForUpload, setSelectedAusenciaForUpload] = useState(null);
  const [uploadJustificanteFile, setUploadJustificanteFile] = useState(null);
  const [uploadJustificanteLoading, setUploadJustificanteLoading] = useState(false);
  const [isFetchingDocumentos, setIsFetchingDocumentos] = useState(false);
  const [uploadJustificanteError, setUploadJustificanteError] = useState(null);
  const [documentosSolicitadosMap, setDocumentosSolicitadosMap] = useState(new Map()); // Map<codigo_tipo, {estado, fecha_solicitud, fecha_completado}>
  
  // Map pentru asocierea justificantelor cu ausencias (pentru angajați)
  // Key: `${tipo}_${fecha}` (ex: "Salida Sin Regreso_2026-01-05")
  // Value: { estado, fecha_solicitud, fecha_completado, tipo_documento, notas, id }
  const [justificantesPorAusencia, setJustificantesPorAusencia] = useState(new Map());
  // Ref pentru a păstra map-ul între render-uri (evită resetarea în React Strict Mode)
  const justificantesPorAusenciaRef = useRef(new Map());
  // Justificante pentru cerere (încărcate la trimitere sau din "Cargar Justificante") – din GET /api/documentos, key = fecha YYYY-MM-DD
  const [initialJustificantesPorFecha, setInitialJustificantesPorFecha] = useState(new Map());
  
  // Wrapper pentru setJustificantesPorAusencia care actualizează și ref-ul imediat
  const setJustificantesPorAusenciaWithRef = useCallback((newMap) => {
    justificantesPorAusenciaRef.current = newMap;
    setJustificantesPorAusencia(newMap);
  }, []);

  const email = authUser?.email || authUser?.['CORREO ELECTRONICO'] || '';
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = authUser?.isManager || false;

  // Permisiuni din backend
  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const userGrupo = useMemo(() => authUser?.GRUPO || authUser?.grupo || 'Empleado', [authUser?.GRUPO, authUser?.grupo]);

  // Helper pentru verificarea permisiunilor
  const findGrupoKey = useCallback((grupo, permissions) => {
    if (!grupo || !permissions) return null;
    const grupoStr = String(grupo).trim();
    if (permissions[grupoStr]) return grupoStr;
    const exactMatch = Object.keys(permissions).find(key => 
      key.toLowerCase() === grupoStr.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    const firstWord = grupoStr.split(/\s+/)[0];
    if (permissions[firstWord]) return firstWord;
    return null;
  }, []);

  const hasPermission = useCallback((module) => {
    if (!userPermissions || !userGrupo) return false;
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) return false;
    const grupoPermissions = userPermissions[grupoKey];
    return grupoPermissions && grupoPermissions[module] === true;
  }, [userPermissions, userGrupo, findGrupoKey]);

  // Încarcă permisiunile din backend
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userGrupo || authUser?.isDemo) {
        setLoadingPermissions(false);
        return;
      }
      try {
        const permissions = await getPermissions(userGrupo);
        setUserPermissions(permissions);
      } catch (error) {
        console.error('Error loading permissions:', error);
        setUserPermissions(null);
      } finally {
        setLoadingPermissions(false);
      }
    };
    loadPermissions();
  }, [userGrupo, authUser?.isDemo, getPermissions]);

  // Verifică permisiunile din backend - folosim DOAR permisiunile din backend (fără fallback la isManager)
  const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
  
  // Verifică permisiunile - SIMPLU:
  // solicitudes-empleados = doar tab-ul "Mis Solicitudes"
  // solicitudes-admin = acces total (toate tab-urile)
  // Folosim DOAR permisiunile din backend - fără fallback la isManager
  const hasSolicitudesEmpleadosPermission = hasBackendPermissions ? hasPermission('solicitudes-empleados') : false;
  const hasSolicitudesAdminPermission = hasBackendPermissions ? hasPermission('solicitudes-admin') : false;
  
  // Acces complet dacă are solicitudes-admin (DOAR din backend)
  const canAccessAllTabs = hasSolicitudesAdminPermission;
  
  // Acces la pagina (chiar dacă nu la toate tab-urile) dacă are solicitudes-empleados SAU solicitudes-admin (DOAR din backend)
  const canAccessPage = hasSolicitudesEmpleadosPermission || hasSolicitudesAdminPermission;

  // Calendar functions
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const isDateSelected = (date) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return selectedDates.includes(dateStr);
  };

  const isDateOccupied = (date) => {
    // This function is now deprecated - we use dateAvailability instead
    // Keep it for backward compatibility but it shouldn't be used for Vacaciones
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return occupiedDates.includes(dateStr);
  };

  /** 6 Dic – 6 Ene (empleada), aplicable a Vacaciones y Asuntos Propios. */
  const isFixedEmpleadaBlock = (dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    if (month === 12 && date.getDate() >= 6) return true;
    if (month === 1 && date.getDate() <= 6) return true;
    return false;
  };

  const isVacationConfiguredBlock = (dateStr) => {
    if (!vacationBlockedPeriods?.length) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    for (const p of vacationBlockedPeriods) {
      const start = new Date(p.fecha_inicio);
      const end = new Date(p.fecha_fin);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (d >= start && d <= end) return true;
    }
    return false;
  };

  const isAsuntoPropioConfiguredBlock = (dateStr) => {
    if (!asuntoPropioBlockedPeriods?.length) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    for (const p of asuntoPropioBlockedPeriods) {
      const start = new Date(p.fecha_inicio);
      const end = new Date(p.fecha_fin);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (d >= start && d <= end) return true;
    }
    return false;
  };

  /** Vacaciones: fijo empleada + periodos bloqueados de vacaciones (gestión). */
  const isInHolidayBlockPeriod = (dateStr) =>
    isFixedEmpleadaBlock(dateStr) || isVacationConfiguredBlock(dateStr);

  /** Asuntos Propios: fijo empleada + periodos bloqueados solo para AP (no los de vacaciones). */
  const isInAsuntoPropioCalendarBlock = (dateStr) =>
    isFixedEmpleadaBlock(dateStr) || isAsuntoPropioConfiguredBlock(dateStr);

  const isDateDisabled = (date, isManagerMode = false) => {
    // În modul manager, nu blocăm nicio dată
    if (isManagerMode) {
      return false;
    }
    
    // Disable past dates, holiday block period, and full availability
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const today = new Date();
    const currentDate = new Date(dateStr);
    
    // Check if date is full (no availability left)
    const availability = dateAvailability[dateStr];
    const isFull = availability && availability.isFull;
    
    // Când se editează o solicitare de tip Vacaciones sau Asunto Propio, ignorăm TOATE regulile de disponibilitate
    const isEditingVacacionesOrAsuntoPropio = editingSolicitud !== null && 
      (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios');
    
    // For Vacaciones and Asuntos Propios, don't use occupiedDates - use availability logic instead
    if (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios') {
      // Dacă se editează, ignorăm TOATE verificările (disponibilitatea, perioada de blocare, zilele din trecut, etc.)
      // Permitem selectarea oricărei date (trecut, prezent, viitor)
      if (isEditingVacacionesOrAsuntoPropio) {
        return false; // Nu blocăm nicio dată când se editează
      }
      const blockedByPolicy =
        tipo === 'Vacaciones'
          ? isInHolidayBlockPeriod(dateStr)
          : isInAsuntoPropioCalendarBlock(dateStr);
      return currentDate < today || blockedByPolicy || isFull;
    } else {
      // For other types, use the old logic
      return currentDate < today || occupiedDates.includes(dateStr) || isInHolidayBlockPeriod(dateStr);
    }
  };

  // Normalize group names - groups that represent the same service but with different contracts
  // should be treated as the same group for availability calculations
  const normalizeGroup = (groupName) => {
    if (!groupName || typeof groupName !== 'string') return groupName || '';
    
    const trimmed = groupName.trim();
    
    // Map equivalent groups to a canonical group name
    // "Limpiador" and "Auxiliar De Servicios - L" are the same service (different contracts)
    const groupMapping = {
      'Limpiador': 'Limpiador',
      'Auxiliar De Servicios - L': 'Limpiador',
      // Add more mappings here if needed in the future
      // Example: 'Grupo A': 'Grupo Canonical',
      //          'Grupo B': 'Grupo Canonical',
    };
    
    // Return mapped group or original if no mapping exists
    return groupMapping[trimmed] || trimmed;
  };

  // Calculate availability limits based on month and group
  const getAvailabilityLimit = useCallback((month, groupSize, tipo) => {
    if (tipo === 'Vacaciones') {
      const percentage = vacacionesDisponibilidadPct / 100;
      return Math.max(1, Math.ceil(groupSize * percentage)); // At least 1 person
    } else if (isTipoAsuntoPropio(tipo)) {
      return Math.min(
        50,
        Math.max(1, Number(asuntosPropiosMaxPorDia) || DEFAULT_ASUNTOS_PROPIOS_MAX_POR_DIA),
      );
    }
    return 1; // Default fallback
  }, [vacacionesDisponibilidadPct, asuntosPropiosMaxPorDia]);

  // Calculate date availability for each group and center
  const calculateDateAvailability = useCallback((solicitudes, users, year, month) => {
    const apCap = Math.min(
      50,
      Math.max(1, Number(asuntosPropiosMaxPorDia) || DEFAULT_ASUNTOS_PROPIOS_MAX_POR_DIA),
    );
    const availability = {};
    const currentUser = authUser;
    const currentUserGroup = currentUser?.['GRUPO'] || currentUser?.grupo || '';
    // Try multiple possible field names for center - FIXED: use "CENTRO TRABAJO" (with space, not "DE")
    let currentUserCenter = '';
    if (currentUser) {
      // First, check the exact key used in DatosPage
      if (currentUser['CENTRO TRABAJO'] && String(currentUser['CENTRO TRABAJO']).trim()) {
        currentUserCenter = String(currentUser['CENTRO TRABAJO']).trim();
      } else {
        const preferredKeys = [
          'CENTRO DE TRABAJO',
          'centro de trabajo',
          'CENTRO_DE_TRABAJO',
          'centroDeTrabajo',
          'centro_trabajo',
          'CENTRO',
          'centro',
          'CENTER',
          'center',
          'DEPARTAMENTO',
          'departamento'
        ];
        for (const k of preferredKeys) {
          if (currentUser[k] && String(currentUser[k]).trim()) {
            currentUserCenter = String(currentUser[k]).trim();
            break;
          }
        }
        // Heurística: primer campo cuyo nombre contiene 'centro' o 'trabajo'
        if (!currentUserCenter) {
          try {
            const allKeys = Object.keys(currentUser || {});
            const key = allKeys.find(key => {
              const lk = key.toLowerCase();
              return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(currentUser[key]).trim();
            });
            if (key) {
              currentUserCenter = String(currentUser[key]).trim();
            }
          } catch (e) {
            console.warn('Error in centroTrabajo heuristics:', e);
          }
        }
      }
      
      // Fallback: dacă nu s-a găsit centrul în authUser, caută în lista de utilizatori
      if (!currentUserCenter && users && users.length > 0) {
        const currentUserEmail = currentUser?.email || currentUser?.['CORREO ELECTRONICO'] || currentUser?.['CORREO ELECTRONIC'] || '';
        const currentUserCodigo = currentUser?.['CODIGO'] || currentUser?.codigo || '';
        
        const matchedUser = users.find(user => {
          const userEmail = user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email || '';
          const userCodigo = user?.CODIGO || user?.codigo || '';
          return (currentUserEmail && userEmail && String(userEmail).toLowerCase() === String(currentUserEmail).toLowerCase()) ||
                 (currentUserCodigo && userCodigo && String(userCodigo) === String(currentUserCodigo));
        });
        
        if (matchedUser) {
          // Încearcă să găsească centrul în utilizatorul găsit
          if (matchedUser['CENTRO TRABAJO'] && String(matchedUser['CENTRO TRABAJO']).trim()) {
            currentUserCenter = String(matchedUser['CENTRO TRABAJO']).trim();
          } else {
            const preferredKeys = [
              'CENTRO DE TRABAJO',
              'centro de trabajo',
              'CENTRO_DE_TRABAJO',
              'centroDeTrabajo',
              'centro_trabajo',
              'CENTRO',
              'centro',
              'CENTER',
              'center',
              'DEPARTAMENTO',
              'departamento'
            ];
            for (const k of preferredKeys) {
              if (matchedUser[k] && String(matchedUser[k]).trim()) {
                currentUserCenter = String(matchedUser[k]).trim();
                break;
              }
            }
          }
        }
      }
    }
    
    console.log('🔍 Current user data for center:', {
      currentUser,
      currentUserGroup,
      currentUserCenter,
      allUserKeys: Object.keys(currentUser || {}),
      centerKeys: Object.keys(currentUser || {}).filter(key => 
        key.toLowerCase().includes('centro') || 
        key.toLowerCase().includes('center') ||
        key.toLowerCase().includes('trabajo') ||
        key.toLowerCase().includes('departamento')
      )
    });
    
    // Log first few users to see actual structure
    if (users && users.length > 0) {
      console.log('🔍 First user structure:', users[0]);
      console.log('🔍 All keys in first user:', Object.keys(users[0] || {}));
      
      // Look for any field that might contain center info
      const sampleUser = users[0];
      Object.keys(sampleUser || {}).forEach(key => {
        if (typeof sampleUser[key] === 'string' && sampleUser[key].length > 0) {
          console.log(`🔍 Field "${key}": "${sampleUser[key]}"`);
        }
      });
    }

    // Normalize current user's group for comparison
    const normalizedCurrentUserGroup = normalizeGroup(currentUserGroup);

    // Pentru Vacaciones: obținem toți utilizatorii din același GRUP (toate centrele)
    // Pentru Asuntos Propios: obținem utilizatorii din același grup+centru
    let relevantUsers;
    if (tipo === 'Vacaciones') {
      // Vacaciones: limita este per grup (toate centrele din grup)
      // Folosim normalizarea pentru a include grupuri echivalente (ex: "Limpiador" și "Auxiliar De Servicios - L")
      relevantUsers = users.filter(user => {
        const userGroup = user['GRUPO'] || user.grupo || '';
        const normalizedUserGroup = normalizeGroup(userGroup);
        return normalizedUserGroup === normalizedCurrentUserGroup;
      });
    } else {
      // Asuntos Propios: limita este per grup+centru
      relevantUsers = users.filter(user => {
        const userGroup = user['GRUPO'] || user.grupo || '';
        const normalizedUserGroup = normalizeGroup(userGroup);
        const userCenter = user['CENTRO TRABAJO'] || 
                          user['CENTRO DE TRABAJO'] || 
                          user['centro de trabajo'] || 
                          user['CENTRO_DE_TRABAJO'] ||
                          user['centroDeTrabajo'] ||
                          user['centro'] ||
                          user['CENTER'] ||
                          user['center'] ||
                          user['DEPARTAMENTO'] ||
                          user['departamento'] ||
                          '';
        
        return normalizedUserGroup === normalizedCurrentUserGroup && userCenter === currentUserCenter;
      });
    }

    const groupSize = relevantUsers.length;
    let maxAllowed;
    
    if (isTipoAsuntoPropio(tipo)) {
      maxAllowed = apCap;
    } else {
      maxAllowed = getAvailabilityLimit(month, groupSize, tipo);
    }
    
    console.log('🔍 Availability calculation:', {
      currentUserGroup,
      normalizedCurrentUserGroup: normalizedCurrentUserGroup,
      currentUserCenter,
      groupSize,
      maxAllowed,
      isSummerMonth: month >= 5 && month <= 7,
      totalSolicitudes: solicitudes.length,
      tipo,
      month: month + 1,
      year,
      relevantUsers: relevantUsers.map(u => ({
        name: u['NOMBRE / APELLIDOS'] || u.nombre,
        group: u['GRUPO'] || u.grupo,
        normalizedGroup: normalizeGroup(u['GRUPO'] || u.grupo || ''),
        center: u['CENTRO TRABAJO'] || u['CENTRO DE TRABAJO'] || u['centro de trabajo']
      })),
      allSolicitudes: solicitudes.map(s => ({
        id: s.id,
        nombre: s.nombre,
        tipo: s.tipo,
        estado: s.estado,
        grupo: s.grupo || s['GRUPO'],
        normalizedGrupo: normalizeGroup(s.grupo || s['GRUPO'] || ''),
        centro: s['CENTRO TRABAJO'] || s['centro de trabajo'] || s['CENTRO DE TRABAJO'],
        fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`
      }))
    });

    // Process each day of the month
    const daysInMonth = getDaysInMonth(year, month);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Count approved/pending requests for this date
      let occupiedCount = 0;
      let sameCenterCount = 0; // Count people from same center
      
      solicitudes.forEach(solicitud => {
        // Exclude solicitarea care se editează din calculul disponibilității
        if (editingSolicitud !== null && solicitud.id === editingSolicitud) {
          return; // Skip solicitarea care se editează
        }
        
        if (solicitudTipoCoincideUi(solicitud.tipo, tipo) &&
            (solicitud.estado === 'Aprobada' || solicitud.estado === 'Pendiente')) {
          
          const solicitudGroup = solicitud.grupo || solicitud['GRUPO'] || '';
          const solicitudCenter = solicitud['CENTRO TRABAJO'] || 
                                solicitud['centro de trabajo'] || 
                                solicitud['CENTRO DE TRABAJO'] || 
                                solicitud['CENTRO_DE_TRABAJO'] ||
                                solicitud['centroDeTrabajo'] ||
                                solicitud['centro'] ||
                                solicitud['CENTER'] ||
                                solicitud['center'] ||
                                solicitud['DEPARTAMENTO'] ||
                                solicitud['departamento'] ||
                                '';
          
          // Check if this date falls within the solicitud date range
          let fechaInicio = '';
          let fechaFin = '';
          
          if (solicitud.FECHA && solicitud.FECHA.includes(' - ')) {
            [fechaInicio, fechaFin] = solicitud.FECHA.split(' - ');
          } else {
            fechaInicio = solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha;
            fechaFin = solicitud.fecha_fin || solicitud["fecha fin"] || solicitud.fecha;
          }
          
          if (fechaInicio && fechaFin) {
            const start = new Date(fechaInicio.trim());
            const end = new Date(fechaFin.trim());
            const currentDate = new Date(dateStr);
            
            if (currentDate >= start && currentDate <= end) {
              if (tipo === 'Vacaciones') {
                // ✅ Vacaciones: limită per GRUP (toate centrele din grup) + limită per grup+centru (max 1)
                // Numărăm solicitările din ACELAȘI GRUP (folosind normalizare pentru grupuri echivalente), indiferent de centru
                const normalizedSolicitudGroup = normalizeGroup(solicitudGroup);
                if (normalizedSolicitudGroup === normalizedCurrentUserGroup) {
                  occupiedCount++; // Numără doar din același grup normalizat (toate centrele)
                  
                  // Count people from same group+center (pentru limita per grup+centru)
                  if (solicitudCenter === currentUserCenter) {
                    sameCenterCount++;
                  }
                }
              } else if (isTipoAsuntoPropio(tipo)) {
                // ✅ Asuntos Propios: límite global + máx. 1 del mismo centro
                occupiedCount++; // Numără toate solicitările global (din toate grupuri/centre)
                
                // Count people from same center (pentru limita per centru)
                const normalizedSolicitudGroup = normalizeGroup(solicitudGroup);
                if (normalizedSolicitudGroup === normalizedCurrentUserGroup && solicitudCenter === currentUserCenter) {
                  sameCenterCount++;
                }
              } else {
                // Fallback: numără toate
                occupiedCount++;
              }
            }
          }
        }
      });

      // Verifică dacă ziua este complet ocupată
      // Când se editează o solicitare de tip Vacaciones sau Asunto Propio, ignorăm regulile (isFull = false)
      const isEditingVacacionesOrAsuntoPropio = editingSolicitud !== null && 
        (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios');
      
      let isFull = false;
      if (isEditingVacacionesOrAsuntoPropio) {
        // La editare, toate zilele sunt disponibile (ignorăm regulile)
        isFull = false;
      } else if (isTipoAsuntoPropio(tipo)) {
        isFull = occupiedCount >= apCap || sameCenterCount >= 1;
      } else if (tipo === 'Vacaciones') {
        // Vacaciones: limită per grup (maxAllowed) + limită per grup+centru (max 1)
        isFull = occupiedCount >= maxAllowed || sameCenterCount >= 1;
      } else {
        // Fallback
        isFull = occupiedCount >= maxAllowed;
      }

      availability[dateStr] = {
        available: isTipoAsuntoPropio(tipo)
          ? Math.max(0, apCap - occupiedCount)
          : Math.max(0, maxAllowed - occupiedCount),
        total: isTipoAsuntoPropio(tipo) ? apCap : maxAllowed,
        occupied: occupiedCount,
        sameCenterOccupied: sameCenterCount,
        isFull: isFull,
        group: currentUserGroup,
        center: currentUserCenter,
        maxAllowed: isTipoAsuntoPropio(tipo) ? apCap : maxAllowed,
        groupSize,
      };
      
      // Log first few days for debugging
      if (day <= 10) {
        console.log(`🔍 Day ${day} (${dateStr}):`, {
          occupiedCount,
          sameCenterCount,
          maxAllowed,
          available: isTipoAsuntoPropio(tipo)
            ? Math.max(0, apCap - occupiedCount)
            : Math.max(0, maxAllowed - occupiedCount),
          isFull: isTipoAsuntoPropio(tipo)
            ? (occupiedCount >= apCap || sameCenterCount >= 1)
            : occupiedCount >= maxAllowed,
          tipo,
          solicitudesForDay: solicitudes.filter(s => {
            if (!solicitudTipoCoincideUi(s.tipo, tipo) || (s.estado !== 'Aprobada' && s.estado !== 'Pendiente')) return false;
            
            const solicitudGroup = s.grupo || s['GRUPO'] || '';
            const normalizedSolicitudGroup = normalizeGroup(solicitudGroup);
            const solicitudCenter = s['CENTRO TRABAJO'] || 
                                  s['centro de trabajo'] || 
                                  s['CENTRO DE TRABAJO'] || 
                                  s['CENTRO_DE_TRABAJO'] ||
                                  s['centroDeTrabajo'] ||
                                  s['centro'] ||
                                  s['CENTER'] ||
                                  s['center'] ||
                                  s['DEPARTAMENTO'] ||
                                  s['departamento'] ||
                                  '';
            
            if (normalizedSolicitudGroup !== normalizedCurrentUserGroup || solicitudCenter !== currentUserCenter) return false;
            
            // Check if this date falls within the solicitud date range
            let fechaInicio = '';
            let fechaFin = '';
            
            if (s.FECHA && s.FECHA.includes(' - ')) {
              [fechaInicio, fechaFin] = s.FECHA.split(' - ');
            } else {
              fechaInicio = s.fecha_inicio || s["fecha inicio"] || s.fecha;
              fechaFin = s.fecha_fin || s["fecha fin"] || s.fecha;
            }
            
            if (fechaInicio && fechaFin) {
              const start = new Date(fechaInicio.trim());
              const end = new Date(fechaFin.trim());
              const currentDate = new Date(dateStr);
              
              return currentDate >= start && currentDate <= end;
            }
            return false;
          }).map(s => ({
            id: s.id,
            nombre: s.nombre,
            grupo: s.grupo || s['GRUPO'],
            centro: s['CENTRO TRABAJO'] || s['centro de trabajo'],
            fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`,
            estado: s.estado
          }))
        });
      }
    }

    return availability;
  }, [authUser, tipo, editingSolicitud, getAvailabilityLimit, asuntosPropiosMaxPorDia]);

  const toggleDate = (date) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        // Remove the date if it's already selected
        return prev.filter(d => d !== dateStr);
      } else {
        // Add the date, but keep only the last 2 selections
        const newSelection = [...prev, dateStr].sort();
        return newSelection.slice(-2); // Keep only the last 2 dates
      }
    });
  };

  const updateFechaFromCalendar = useCallback(() => {
    if (selectedDates.length > 0) {
      const sortedDates = [...selectedDates].sort();
      setFechaInicio(sortedDates[0]);
      setFechaFin(sortedDates[sortedDates.length - 1]);
    }
  }, [selectedDates]);



  useEffect(() => {
    updateFechaFromCalendar();
  }, [updateFechaFromCalendar]);

  // Cache pentru empleado completo - evită apeluri duplicate
  const empleadoCompletoCacheRef = useRef({ codigo: null, email: null, data: null, timestamp: 0 });
  const CACHE_DURATION = 60000; // 60 secunde cache
  const fetchingEmpleadoRef = useRef(false);

  // Obține datele complete ale utilizatorului (inclusiv certificado_handicap_confirmado)
  useEffect(() => {
    const fetchEmpleadoCompleto = async () => {
      if (!authUser?.CODIGO && !authUser?.email) {
        return;
      }

      // Verifică cache-ul
      const now = Date.now();
      const cache = empleadoCompletoCacheRef.current;
      if (cache.data && 
          (cache.codigo === authUser?.CODIGO || cache.email === authUser?.email) &&
          (now - cache.timestamp) < CACHE_DURATION) {
        // Folosește cache-ul
        setEmpleadoCompleto(cache.data);
        return;
      }

      // Evită apeluri duplicate simultane
      if (fetchingEmpleadoRef.current) {
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          return;
        }

        fetchingEmpleadoRef.current = true;
        const res = await fetch(routes.getEmpleadoMe, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const empleado = data?.empleado || data?.data?.empleado || data;
          if (empleado) {
            setEmpleadoCompleto(empleado);
            // Actualizează cache-ul
            empleadoCompletoCacheRef.current = {
              codigo: authUser?.CODIGO,
              email: authUser?.email,
              data: empleado,
              timestamp: now,
            };
          }
        }
      } catch (error) {
        console.error('Error fetching empleado completo:', error);
      } finally {
        fetchingEmpleadoRef.current = false;
      }
    };

    // Debounce pentru a evita apeluri prea frecvente
    const timeoutId = setTimeout(() => {
      fetchEmpleadoCompleto();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [authUser?.CODIGO, authUser?.email]);

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (calendarMonth === 0) {
        setCalendarMonth(11);
        setCalendarYear(calendarYear - 1);
      } else {
        setCalendarMonth(calendarMonth - 1);
      }
    } else {
      if (calendarMonth === 11) {
        setCalendarMonth(0);
        setCalendarYear(calendarYear + 1);
      } else {
        setCalendarMonth(calendarMonth + 1);
      }
    }
  };

  // Helper function to get approved requests
  const getApprovedRequests = useCallback(async (monthStr) => {
    try {
      // Remove email filter to get ALL approved requests for the month
      const tipoApi = tipoSolicitudApiParam(tipo);
      const allApprovedUrl = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipoApi)}&ESTADO=Aprobada&limit=1000`;
      console.log('🔍 Fetching ALL approved requests from:', allApprovedUrl);
      const approvedResult = await callApi(allApprovedUrl);
      if (approvedResult.success) {
        const approvedData = Array.isArray(approvedResult.data) ? approvedResult.data : [approvedResult.data];
        console.log('🔍 Found approved requests:', approvedData.length);
        
        // Filter to only include requests that actually fall within the current month
        const filteredData = filterSolicitudesByMonth(approvedData, monthStr);
        
        console.log('🔍 Filtered approved requests for month:', {
          original: approvedData.length,
          filtered: filteredData.length,
          monthStr
        });
        
        return filteredData;
      }
    } catch (error) {
      console.warn('Could not fetch approved requests:', error);
    }
    return [];
  }, [tipo, callApi]);

  // Helper function to filter solicitudes by month
  const filterSolicitudesByMonth = (solicitudes, targetMonthStr) => {
    return solicitudes.filter(solicitud => {
      const fechaInicio = solicitud.fecha_inicio;
      const fechaFin = solicitud.fecha_fin;
      
      if (!fechaInicio || !fechaFin) return false;
      
      const startDate = new Date(fechaInicio);
      const endDate = new Date(fechaFin);
      const [year, month] = targetMonthStr.split('-');
      const targetMonth = parseInt(month) - 1; // JavaScript months are 0-based
      const targetYear = parseInt(year);
      
      // Check if the request overlaps with the target month
      const requestStartMonth = startDate.getMonth();
      const requestStartYear = startDate.getFullYear();
      const requestEndMonth = endDate.getMonth();
      const requestEndYear = endDate.getFullYear();
      
      const overlaps = (
        (requestStartYear === targetYear && requestStartMonth === targetMonth) ||
        (requestEndYear === targetYear && requestEndMonth === targetMonth) ||
        (requestStartYear < targetYear && requestEndYear > targetYear) ||
        (requestStartYear === targetYear && requestEndYear === targetYear && requestStartMonth <= targetMonth && requestEndMonth >= targetMonth)
      );
      
      return overlaps;
    });
  };

  // Load occupied dates from backend - enhanced for all users
  const loadOccupiedDates = useCallback(async (year, month) => {
    // Debounce: anulează request-ul anterior dacă se schimbă rapid
    if (loadOccupiedDatesTimeoutRef.current) {
      clearTimeout(loadOccupiedDatesTimeoutRef.current);
    }
    
    // Cache key pentru această lună și tip
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const cacheKey = `${monthStr}-${tipo}`;
    const cached = occupiedDatesCacheRef.current.get(cacheKey);
    const CACHE_DURATION = 30000; // 30 secunde cache
    
    // Verifică cache (doar dacă nu e editare - la editare vrem date fresh)
    if (cached && editingSolicitud === null && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('✅ Using cached occupied dates for:', cacheKey);
      setOccupiedDates(cached.occupiedDates);
      setDateAvailability(prev => ({ ...prev, ...(cached.dateAvailability || {}) }));
      return;
    }
    
    // Debounce request-ul cu 300ms pentru a evita request-uri prea frecvente
    loadOccupiedDatesTimeoutRef.current = setTimeout(async () => {
      setOperationLoading('occupiedDates', true);
      try {
        const tipoApi = tipoSolicitudApiParam(tipo);
        // For managers: get all requests for the month
        // For employees: get their own requests plus approved ones from others
        let url;
        if (isManager) {
          // Managers can see all requests
          url = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipoApi)}&limit=1000`;
        } else {
          // Employees see their own requests plus all approved ones
          const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
          url = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipoApi)}&codigo=${encodeURIComponent(userCode)}&limit=1000`;
        }
        
        console.log('🔍 Loading occupied dates from:', url);
        const result = await callApi(url);
      
      if (result.success) {
        let data = Array.isArray(result.data) ? result.data : [result.data];
        const occupiedDatesSet = new Set();
        
        // Also get all approved vacation requests for the month (for conflict checking)
        if (!canAccessAllTabs) {
          try {
            const allApprovedUrl = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=Vacaciones&ESTADO=Aprobada&limit=1000`;
            const approvedResult = await callApi(allApprovedUrl);
            if (approvedResult.success) {
              const approvedData = Array.isArray(approvedResult.data) ? approvedResult.data : [approvedResult.data];
              data.push(...approvedData);
            }
          } catch (error) {
            console.warn('Could not fetch approved requests for conflict checking:', error);
          }
        }

        // Filter all data to only include requests that overlap with the target month
        const filteredData = filterSolicitudesByMonth(data, monthStr);
        console.log('🔍 Month filtering results:', {
          original: data.length,
          filtered: filteredData.length,
          monthStr
        });
        data = filteredData;
        
        data.forEach(solicitud => {
          // Process requests based on current tipo (Vacaciones or Asunto Propio)
          if (solicitudTipoCoincideUi(solicitud.tipo, tipo) && (solicitud.estado === 'Aprobada' || solicitud.estado === 'Pendiente')) {
            // Handle different date formats
            let fechaInicio = '';
            let fechaFin = '';
            
            if (solicitud.FECHA && solicitud.FECHA.includes(' - ')) {
              [fechaInicio, fechaFin] = solicitud.FECHA.split(' - ');
            } else {
              fechaInicio = solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha;
              fechaFin = solicitud.fecha_fin || solicitud["fecha fin"] || solicitud.fecha;
            }
            
            if (fechaInicio && fechaFin) {
              // Add all dates in the range to occupiedDatesSet for backward compatibility
              const start = new Date(fechaInicio.trim());
              const end = new Date(fechaFin.trim());
              
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const current = new Date(start);
                while (current <= end) {
                  const dateStr = current.toISOString().split('T')[0];
                  occupiedDatesSet.add(dateStr);
                  current.setDate(current.getDate() + 1);
                }
              }
            }
          }
        });
        
        setOccupiedDates(Array.from(occupiedDatesSet));
        console.log('🔍 Loaded occupied dates:', Array.from(occupiedDatesSet));

        // Calculate availability for current user's group and center
        if (tipo === 'Vacaciones' || isTipoAsuntoPropio(tipo)) {
          // For non-managers, fetch users if not already loaded
          if (allUsers.length === 0) {
            try {
              const usersResult = await callApi(API_ENDPOINTS.USERS);
              if (usersResult.success) {
                const usersData = Array.isArray(usersResult.data) ? usersResult.data : [usersResult.data];
                setAllUsers(usersData);
                console.log('🔍 Loaded users for availability calculation:', usersData.length);
                
                // Use the loaded users for calculation
                // Get ALL approved requests - same for everyone regardless of role
                const approvedRequests = await getApprovedRequests(monthStr);
                let allSolicitudesData = [...data, ...approvedRequests];
                
                // Enrich solicitudes with user data (grupo and centro)
                const enrichedSolicitudes = allSolicitudesData.map(solicitud => {
                  if (solicitud.codigo && usersData.length > 0) {
                    const user = usersData.find(u => u['CODIGO'] === solicitud.codigo);
                    if (user) {
                      return {
                        ...solicitud,
                        grupo: user['GRUPO'] || user.grupo || '',
                        centro: user['CENTRO TRABAJO'] || user['CENTRO DE TRABAJO'] || user['centro de trabajo'] || '',
                        nombre: user['NOMBRE / APELLIDOS'] || user.nombre || solicitud.nombre
                      };
                    }
                  }
                  return solicitud;
                });
                
                allSolicitudesData = enrichedSolicitudes;
                console.log('🔍 Combined solicitudes for availability (early):', {
                  userRequests: data.length,
                  approvedRequests: approvedRequests.length,
                  total: allSolicitudesData.length,
                  isManager: isManager
                });
                const availability = calculateDateAvailability(allSolicitudesData, usersData, year, month);
                setDateAvailability(prev => ({ ...prev, ...availability }));
                console.log('🔍 Calculated date availability:', availability);
                return; // Exit early after setting availability
              }
            } catch (error) {
              console.warn('Could not fetch users for availability calculation:', error);
            }
          }
          
          if (allUsers.length > 0) {
            // For availability calculation, we need ALL approved requests for the month
            // This applies to EVERYONE regardless of role
            let allSolicitudesData = data;
            
            try {
              // Get ALL approved requests for the month (no email filter) - same for everyone
              const allApprovedUrl = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipoApi)}&ESTADO=Aprobada&limit=1000`;
              console.log('🔍 Fetching ALL approved requests for availability calculation:', allApprovedUrl);
              const approvedResult = await callApi(allApprovedUrl);
              if (approvedResult.success) {
                let approvedData = Array.isArray(approvedResult.data) ? approvedResult.data : [approvedResult.data];
                
                // Filter both user's own requests and approved requests to only include current month
                const filteredUserData = filterSolicitudesByMonth(data, monthStr);
                const filteredApprovedData = filterSolicitudesByMonth(approvedData, monthStr);
                
                console.log('🔍 Month filtering for availability:', {
                  userOriginal: data.length,
                  userFiltered: filteredUserData.length,
                  approvedOriginal: approvedData.length,
                  approvedFiltered: filteredApprovedData.length,
                  monthStr
                });
                
                // Combine filtered user's requests with filtered approved requests
                // Remove duplicates by id to avoid counting the same request twice
                const combinedData = [...filteredUserData, ...filteredApprovedData];
                const uniqueData = combinedData.filter((solicitud, index, self) => 
                  index === self.findIndex(s => s.id === solicitud.id)
                );
                allSolicitudesData = uniqueData;
                
                console.log('🔍 Deduplication results:', {
                  combined: combinedData.length,
                  unique: uniqueData.length,
                  duplicates: combinedData.length - uniqueData.length
                });
                console.log('🔍 Combined solicitudes for availability:', {
                  userRequests: filteredUserData.length,
                  approvedRequests: filteredApprovedData.length,
                  total: allSolicitudesData.length,
                  isManager: isManager
                });
                
                // Log first few solicitudes to see their structure
                console.log('🔍 Sample solicitudes structure:', allSolicitudesData.slice(0, 3).map(s => ({
                  id: s.id,
                  nombre: s.nombre,
                  tipo: s.tipo,
                  estado: s.estado,
                  fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`,
                  grupo: s.grupo || s['GRUPO'],
                  centro: s['CENTRO TRABAJO'] || s['centro de trabajo'] || s['CENTRO DE TRABAJO'],
                  codigo: s.codigo,
                  allKeys: Object.keys(s || {})
                })));
                
                // Enrich solicitudes with user data (grupo and centro)
                const enrichedSolicitudes = allSolicitudesData.map(solicitud => {
                  if (solicitud.codigo && allUsers.length > 0) {
                    const user = allUsers.find(u => u['CODIGO'] === solicitud.codigo);
                    if (user) {
                      return {
                        ...solicitud,
                        grupo: user['GRUPO'] || user.grupo || '',
                        centro: user['CENTRO TRABAJO'] || user['CENTRO DE TRABAJO'] || user['centro de trabajo'] || '',
                        nombre: user['NOMBRE / APELLIDOS'] || user.nombre || solicitud.nombre
                      };
                    }
                  }
                  return solicitud;
                });
                
                console.log('🔍 Enriched solicitudes sample:', enrichedSolicitudes.slice(0, 3).map(s => ({
                  id: s.id,
                  nombre: s.nombre,
                  tipo: s.tipo,
                  estado: s.estado,
                  codigo: s.codigo,
                  grupo: s.grupo,
                  centro: s.centro,
                  fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`
                })));
                
                // Use enriched solicitudes for availability calculation
                allSolicitudesData = enrichedSolicitudes;
              }
            } catch (error) {
              console.warn('Could not fetch all approved requests for availability:', error);
            }
            
            const availability = calculateDateAvailability(allSolicitudesData, allUsers, year, month);
            setDateAvailability(prev => ({ ...prev, ...availability }));
            console.log('🔍 Calculated date availability:', availability);
            console.log('🔍 Using solicitudes data:', allSolicitudesData.length, 'requests');
            
            // Get current user info for logging
            const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
            const currentUserCenter = authUser?.['CENTRO TRABAJO'] || 
                                    authUser?.['CENTRO DE TRABAJO'] || 
                                    authUser?.['centro de trabajo'] || 
                                    authUser?.['CENTRO_DE_TRABAJO'] ||
                                    authUser?.['centroDeTrabajo'] ||
                                    authUser?.['centro'] ||
                                    authUser?.['CENTER'] ||
                                    authUser?.['center'] ||
                                    authUser?.['DEPARTAMENTO'] ||
                                    authUser?.['departamento'] ||
                                    '';
            console.log('🔍 Current user group:', currentUserGroup, 'center:', currentUserCenter);
            
            // Salvează în cache după ce toate datele sunt setate (doar dacă nu e editare)
            if (editingSolicitud === null) {
              occupiedDatesCacheRef.current.set(cacheKey, {
                occupiedDates: Array.from(occupiedDatesSet),
                dateAvailability: availability,
                timestamp: Date.now()
              });
            }
          }
        } else {
          setDateAvailability(prev => {
            const next = { ...prev };
            const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
            Object.keys(next).forEach(k => { if (k.startsWith(monthPrefix)) delete next[k]; });
            return next;
          });
          // Salvează în cache și pentru cazul când nu există disponibilitate
          if (editingSolicitud === null) {
            occupiedDatesCacheRef.current.set(cacheKey, {
              occupiedDates: Array.from(occupiedDatesSet),
              dateAvailability: {},
              timestamp: Date.now()
            });
          }
        }
      } else {
        console.log('🔍 Failed to load occupied dates');
        setOccupiedDates([]);
      }
    } catch (error) {
      console.error('Error loading occupied dates:', error);
      setOccupiedDates([]);
    } finally {
      setOperationLoading('occupiedDates', false);
    }
    }, 300); // Debounce 300ms
  }, [setOperationLoading, canAccessAllTabs, tipo, authUser, callApi, allUsers, calculateDateAvailability, getApprovedRequests, editingSolicitud, isManager]);



  // Reset calendar when tipo changes
  useEffect(() => {
    const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
    const allowedGroups = ['Limpiador', 'Developer', 'Auxiliar De Servicios - L'];

    // If user is not in allowed groups and has Asuntos Propios selected, reset to Vacaciones
    if (tipo === 'Asuntos Propios' && !allowedGroups.includes(currentUserGroup)) {
      setTipo('Vacaciones');
      return;
    }

    if (tipo !== 'Vacaciones') {
      setSelectedDates([]);
      setCalendarMonth(new Date().getMonth());
      setCalendarYear(new Date().getFullYear());
    }
  }, [tipo, authUser]);



  // Load occupied dates when calendar month/year changes or when tipo is Vacaciones o Asunto Propio
  useEffect(() => {
    const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
    const allowedGroups = ['Limpiador', 'Developer', 'Auxiliar De Servicios - L'];

    if (tipo === 'Vacaciones') {
      loadOccupiedDates(calendarYear, calendarMonth);
    } else if (isTipoAsuntoPropio(tipo) && allowedGroups.includes(currentUserGroup)) {
      loadOccupiedDates(calendarYear, calendarMonth);
    } else {
      setOccupiedDates(prev => (prev.length === 0 ? prev : []));
      setDateAvailability(prev => (Object.keys(prev || {}).length === 0 ? prev : {}));
    }
  }, [calendarYear, calendarMonth, tipo, authUser, loadOccupiedDates, asuntosPropiosMaxPorDia]);

  // Recalculează disponibilitatea când se schimbă editingSolicitud (pentru a exclude solicitarea din calcul)
  useEffect(() => {
    if (editingSolicitud !== null && (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios')) {
      // Recalculează disponibilitatea când se editează o solicitare
      // Asta va exclude solicitarea din calcul și va marca toate zilele ca disponibile
      if (allUsers.length > 0) {
        loadOccupiedDates(calendarYear, calendarMonth);
      }
    }
  }, [editingSolicitud, tipo, calendarYear, calendarMonth, allUsers, loadOccupiedDates]);

  // Cargar disponibilidad para todos los meses del rango seleccionado (Vacaciones / Asuntos Propios)
  // para poder validar que no se incluyan días ocupados al enviar
  useEffect(() => {
    if (editingSolicitud !== null) return;
    if (tipo !== 'Vacaciones' && tipo !== 'Asunto Propio' && tipo !== 'Asuntos Propios') return;
    if (!fechaInicio || !fechaFin || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) return;
    const [y1, m1, d1] = fechaInicio.split('-').map(Number);
    const [y2, m2, d2] = fechaFin.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    if (end < start) return;
    const monthsToLoad = new Set();
    const cur = new Date(start);
    while (cur <= end) {
      monthsToLoad.add(`${cur.getFullYear()}-${cur.getMonth()}`);
      cur.setMonth(cur.getMonth() + 1);
      cur.setDate(1);
    }
    monthsToLoad.forEach(key => {
      const [y, m] = key.split('-').map(Number);
      loadOccupiedDates(y, m);
    });
  }, [tipo, fechaInicio, fechaFin, editingSolicitud, loadOccupiedDates, asuntosPropiosMaxPorDia]);

  // Demo solicitudes data
  const setDemoSolicitudes = useCallback(() => {
    const demoPersonalSolicitudes = [
      {
        id: 'DEMO001',
        email: 'admin@demo.com',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        tipo: 'Asunto Propio',
        estado: 'Aprobada',
        motivo: 'Cita médica',
        fecha_inicio: '2024-12-15',
        fecha_fin: '2024-12-15',
        fecha_solicitud: '2024-12-10',
        duracion: 1
      },
      {
        id: 'DEMO002',
        email: 'admin@demo.com',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        tipo: 'Vacaciones',
        estado: 'Pendiente',
        motivo: 'Vacaciones familiares',
        fecha_inicio: '2024-12-20',
        fecha_fin: '2024-12-27',
        fecha_solicitud: '2024-12-01',
        duracion: 8
      },
      {
        id: 'DEMO003',
        email: 'admin@demo.com',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        tipo: 'Asunto Propio',
        estado: 'Aprobada',
        motivo: 'Trámites bancarios',
        fecha_inicio: '2024-11-28',
        fecha_fin: '2024-11-28',
        fecha_solicitud: '2024-11-20',
        duracion: 1
      }
    ];

    const demoAllSolicitudes = [
      ...demoPersonalSolicitudes,
      {
        id: 'DEMO004',
        email: 'maria.gonzalez@demo.com',
        codigo: 'EMP002',
        nombre: 'María González López',
        tipo: 'Vacaciones',
        estado: 'Aprobada',
        motivo: 'Vacaciones de verano',
        fecha_inicio: '2024-08-15',
        fecha_fin: '2024-08-22',
        fecha_solicitud: '2024-07-01',
        duracion: 8
      },
      {
        id: 'DEMO005',
        email: 'juan.perez@demo.com',
        codigo: 'EMP003',
        nombre: 'Juan Pérez Martín',
        tipo: 'Asunto Propio',
        estado: 'Pendiente',
        motivo: 'Cita con abogado',
        fecha_inicio: '2024-12-30',
        fecha_fin: '2024-12-30',
        fecha_solicitud: '2024-12-25',
        duracion: 1
      },
      {
        id: 'DEMO006',
        email: 'ana.sanchez@demo.com',
        codigo: 'EMP004',
        nombre: 'Ana Sánchez Ruiz',
        tipo: 'Vacaciones',
        estado: 'Aprobada',
        motivo: 'Puente de diciembre',
        fecha_inicio: '2024-12-06',
        fecha_fin: '2024-12-09',
        fecha_solicitud: '2024-11-15',
        duracion: 4
      }
    ];

    setSolicitudes(demoPersonalSolicitudes);
    setAllSolicitudes(demoAllSolicitudes);
    
    // Calculate totals
    setTotalAsuntoPropioDays(2); // 2 days from demo data
    setTotalVacacionesDays(8); // 8 days from demo data
  }, []);

  // Funcție pentru a încărca documentele asociate cu solicitările BAJA_VOLUNTARIA / Ausencias justificada
  // Rulează promise-uri în batch (max `concurrency` simultan) + pauză între batch-uri pentru a evita 429
  const runInBatches = async (items, concurrency, fn) => {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      if (i > 0) await new Promise(r => setTimeout(r, 800)); // delay mai mare ca să evităm 429 pe listări mari
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  };

  const fetchBajaVoluntariaDocumentos = useCallback(async (solicitudes) => {
    const bajasVoluntarias = solicitudes.filter(s => s.tipo === 'BAJA_VOLUNTARIA');
    if (bajasVoluntarias.length === 0) {
      setBajaVoluntariaDocumentos(new Map());
      return;
    }

    const token = localStorage.getItem('auth_token');
    const documentosMap = new Map();

    await runInBatches(bajasVoluntarias, 2, async (solicitud) => {
      try {
        const codigo = solicitud.codigo || solicitud.CODIGO || '';
        const email = solicitud.email || solicitud['CORREO ELECTRONICO'] || '';
        if (!codigo && !email) return null;
        const documentosUrl = `${routes.getDocumentos || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos`}${codigo ? `?empleadoId=${codigo}` : email ? `?email=${encodeURIComponent(email)}` : ''}`;
        const response = await fetch(documentosUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        });
        if (!response.ok) return null;
        const data = await response.json();
        const documentos = Array.isArray(data) ? data : (data.data || []);
        const bajaVoluntariaDocs = documentos.filter(doc =>
          (doc.tipo_documento || '').toLowerCase() === 'baja voluntaria'
        );
        if (bajaVoluntariaDocs.length > 0) {
          const sortedDocs = bajaVoluntariaDocs.sort((a, b) => {
            if (b.doc_id && a.doc_id) return b.doc_id - a.doc_id;
            if (b.fecha_creacion && a.fecha_creacion) return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
            return 0;
          });
          documentosMap.set(solicitud.id, sortedDocs[0]);
        }
        return null;
      } catch (error) {
        console.warn(`Error fetching documento for BAJA_VOLUNTARIA ${solicitud.id}:`, error);
        return null;
      }
    });

    setBajaVoluntariaDocumentos(documentosMap);
  }, []);

  // Documente justificante pentru Ausencias justificada (Ver / Descargar în tab Aprobación) – cu batch pentru a evita 429
  const findCerereJustificanteDoc = (documentos, item) => {
    const justificantes = documentos.filter((d) => {
      const t = (d.tipo_documento || '').toLowerCase();
      return t.includes('justificante') && !t.includes('presencia');
    });
    if (justificantes.length === 0) return null;
    const fechaInicio = item.fecha_inicio || (item.FECHA || '').split(' - ')[0]?.trim() || '';
    const fechaInicioDay = fechaInicio ? String(fechaInicio).substring(0, 10) : '';
    const sorted = justificantes.sort((a, b) => {
      if (b.doc_id && a.doc_id) return b.doc_id - a.doc_id;
      if (b.fecha_creacion && a.fecha_creacion) return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
      return 0;
    });
    if (!fechaInicioDay) return sorted[0];
    return (
      sorted.find((d) => {
        const fc = d.fecha_creacion;
        if (!fc) return false;
        const docDay = typeof fc === 'string' ? fc.substring(0, 10) : (fc instanceof Date ? fc.toISOString().split('T')[0] : '');
        return docDay === fechaInicioDay;
      }) || sorted[0]
    );
  };

  const findPresenciaJustificanteDoc = (documentos, item) => {
    const presenciaDocs = documentos.filter((d) => {
      const t = (d.tipo_documento || '').toLowerCase();
      return t.includes('presencia');
    });
    if (presenciaDocs.length === 0) return null;
    const sorted = presenciaDocs.sort((a, b) => {
      if (b.doc_id && a.doc_id) return b.doc_id - a.doc_id;
      if (b.fecha_creacion && a.fecha_creacion) return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
      return 0;
    });
    const fechaRaw = item?.FECHA || item?.fecha || item?.fecha_inicio || (item?.FECHA || '').split(' - ')[0]?.trim() || '';
    let fechaDay = '';
    if (fechaRaw) {
      const s = String(fechaRaw).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) fechaDay = s.substring(0, 10);
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
        const [d, m, y] = s.split('/');
        fechaDay = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    if (fechaDay) {
      const byDate = sorted.find((d) => {
        const fc = d.fecha_creacion;
        if (!fc) return false;
        const docDay = typeof fc === 'string' ? fc.substring(0, 10) : (fc instanceof Date ? fc.toISOString().split('T')[0] : '');
        return docDay === fechaDay;
      });
      if (byDate) return byDate;
    }
    return sorted[0];
  };

  const hasValidJustificanteDocId = (doc) => {
    const id = doc?.doc_id ?? doc?.doc_ID;
    return id != null && id !== '' && String(id) !== 'undefined';
  };

  const getItemEmpleadoCodigo = (item) => String(item?.CODIGO ?? item?.codigo ?? '').trim();

  const fetchDocumentosForItem = async (item, token) => {
    const codigo = getItemEmpleadoCodigo(item);
    const email = item?.email || item?.['CORREO ELECTRONICO'] || '';
    if (!codigo && !email) return [];
    const url = `${routes.getDocumentos || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos`}${codigo ? `?empleadoId=${encodeURIComponent(codigo)}` : ''}${email && !codigo ? `?email=${encodeURIComponent(email)}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.data || []);
  };

  const resolvePresenciaDocFromDocumentos = (documentos, item, cerereDocId = null) => {
    if (!documentos?.length) return null;
    const byDate = findPresenciaJustificanteDoc(documentos, item);
    if (byDate?.doc_id) return byDate;
    const presenciaLoose = documentos.find((d) => (d.tipo_documento || '').toLowerCase().includes('presencia'));
    if (presenciaLoose?.doc_id) return presenciaLoose;
    const justificantes = documentos
      .filter((d) => (d.tipo_documento || '').toLowerCase().includes('justificante'))
      .sort((a, b) => {
        if (b.doc_id && a.doc_id) return b.doc_id - a.doc_id;
        return 0;
      });
    if (cerereDocId != null) {
      const other = justificantes.find((d) => String(d.doc_id) !== String(cerereDocId));
      if (other?.doc_id) return other;
    }
    return justificantes[0] || null;
  };

  const resolvePresenciaStatus = async (item, token, presenciaRow, documentosEmpleadoRef, cerereDocId = null) => {
    const estadoAusencia = (item.estado || item.ESTADO || '').toLowerCase();
    if (estadoAusencia === 'pendiente') {
      return { status: 'tras_aprobacion', message: 'Se solicitará tras la aprobación.' };
    }

    let docId = presenciaRow?.doc_id ?? presenciaRow?.doc_ID;
    let nombreArchivo = presenciaRow?.doc_nombre_archivo ?? presenciaRow?.doc_NOMBRE_ARCHIVO ?? 'Justificante presencia';
    const estadoPresencia = (presenciaRow?.doc_solicitado_estado || '').toLowerCase();
    const solicitudCompletada = estadoPresencia === 'completado';

    if (!hasValidJustificanteDocId({ doc_id: docId })) {
      if (!documentosEmpleadoRef.current) {
        documentosEmpleadoRef.current = await fetchDocumentosForItem(item, token);
      }
      const resolved = resolvePresenciaDocFromDocumentos(
        documentosEmpleadoRef.current,
        item,
        cerereDocId ?? presenciaRow?.doc_id ?? presenciaRow?.doc_ID,
      );
      if (resolved?.doc_id) {
        docId = resolved.doc_id;
        nombreArchivo = resolved.nombre_archivo || nombreArchivo;
      }
    }

    if (hasValidJustificanteDocId({ doc_id: docId })) {
      return {
        status: 'completado',
        doc: { doc_id: docId, nombre_archivo: nombreArchivo },
      };
    }

    // Mismo criterio que Mis Solicitudes del empleado: solicitud completada → ✅ Completado (descarga resuelve el archivo al click)
    if (solicitudCompletada) {
      return {
        status: 'completado',
        doc: { doc_id: null, nombre_archivo: nombreArchivo },
      };
    }

    return {
      status: 'pendiente',
      message: 'Tras la aprobación se solicita al empleado; cuando lo suba aparecerá aquí.',
    };
  };

  const comprobarJustificantesForItem = useCallback(async (item) => {
    const itemId = item.id ?? item.ID;
    setComprobarJustificanteItemId(itemId);
    setJustificanteStatusModal({
      isOpen: true,
      loading: true,
      item,
      cerere: null,
      presencia: null,
      error: null,
    });

    const token = localStorage.getItem('auth_token');
    const codigo = getItemEmpleadoCodigo(item);
    const email = item.email || item['CORREO ELECTRONICO'] || '';
    const estado = (item.estado || item.ESTADO || '').toLowerCase();

    try {
      let cerereDoc = null;
      let presencia = null;
      const ausenciaId = item.ausencia_id ?? item.ausenciaId ?? item.id ?? item.ID;
      const documentosEmpleadoRef = { current: null };

      if (ausenciaId != null && Number.isFinite(Number(ausenciaId))) {
        try {
          const res = await fetch(routes.getAusenciaJustificantes(Number(ausenciaId)), {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const rows = await res.json();
            const justificantesList = Array.isArray(rows) ? rows : (rows?.data ?? []);
            const cerereRow = justificantesList.find((j) => {
              const t = (j.tipo || j.TIPO || '').toLowerCase();
              return t === 'cerere' || (t && t !== 'presencia' && !t.includes('presencia'));
            });
            if (cerereRow && hasValidJustificanteDocId(cerereRow)) {
              cerereDoc = {
                doc_id: cerereRow.doc_id ?? cerereRow.doc_ID,
                nombre_archivo: cerereRow.doc_nombre_archivo ?? cerereRow.doc_NOMBRE_ARCHIVO ?? 'Justificante',
              };
            }
            const presenciaRow = justificantesList.find((j) => {
              const t = (j.tipo || j.TIPO || j.tipo_documento || j.doc_tipo_documento || '').toLowerCase();
              return t === 'presencia' || t.includes('presencia');
            });
            presencia = await resolvePresenciaStatus(
              item,
              token,
              presenciaRow,
              documentosEmpleadoRef,
              cerereDoc?.doc_id,
            );
          }
        } catch {
          /* fallback below */
        }
      }

      if (!presencia && (item.estado || item.ESTADO || '').toLowerCase() !== 'pendiente') {
        presencia = await resolvePresenciaStatus(item, token, null, documentosEmpleadoRef, cerereDoc?.doc_id);
      }

      if (!cerereDoc && (codigo || email)) {
        if (!documentosEmpleadoRef.current) {
          documentosEmpleadoRef.current = await fetchDocumentosForItem(item, token);
        }
        cerereDoc = findCerereJustificanteDoc(documentosEmpleadoRef.current, item);
      }

      const cerere = cerereDoc
        ? { status: 'cargado', doc: cerereDoc }
        : { status: 'no_cargado' };

      if (!presencia) {
        if (estado === 'pendiente') {
          presencia = { status: 'tras_aprobacion', message: 'Se solicitará tras la aprobación.' };
        } else {
          presencia = {
            status: 'pendiente',
            message: 'Tras la aprobación se solicita al empleado; cuando lo suba aparecerá aquí.',
          };
        }
      }

      setJustificanteStatusModal({
        isOpen: true,
        loading: false,
        item,
        cerere,
        presencia,
        error: null,
      });
    } catch (e) {
      console.warn('Error comprobando justificantes:', e);
      setJustificanteStatusModal((prev) => ({
        ...prev,
        loading: false,
        error: 'Error al comprobar justificantes. Inicia sesión si es necesario.',
      }));
    } finally {
      setComprobarJustificanteItemId(null);
    }
  }, [fetchDocumentosForItem, resolvePresenciaStatus]);

  const downloadJustificanteDoc = useCallback(async (doc, item, forPreview = false, resolveAsPresencia = false) => {
    const token = localStorage.getItem('auth_token');
    const codigo = getItemEmpleadoCodigo(item);
    const emailEnc = encodeURIComponent(item?.email || item?.['CORREO ELECTRONICO'] || '');
    let docId = doc?.doc_id ?? doc?.doc_ID;
    let fileName = doc?.nombre_archivo || (resolveAsPresencia ? 'Justificante presencia' : 'justificante');

    if (!hasValidJustificanteDocId({ doc_id: docId }) && (codigo || emailEnc)) {
      const documentos = await fetchDocumentosForItem(item, token);
      const resolved = resolveAsPresencia
        ? resolvePresenciaDocFromDocumentos(documentos, item)
        : findCerereJustificanteDoc(documentos, item);
      if (resolved?.doc_id) {
        docId = resolved.doc_id;
        fileName = resolved.nombre_archivo || fileName;
      }
    }

    if (!hasValidJustificanteDocId({ doc_id: docId })) {
      throw new Error('Documento no disponible');
    }

    const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${docId}&id=${encodeURIComponent(codigo)}&email=${emailEnc}&fileName=${encodeURIComponent(fileName)}`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('No autorizado');
    const blob = await res.blob();
    if (forPreview) {
      setJustificantePreview({
        isOpen: true,
        blobUrl: window.URL.createObjectURL(blob),
        fileName,
        mimeType: blob.type || '',
      });
      return;
    }
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  }, [fetchDocumentosForItem, resolvePresenciaDocFromDocumentos]);

  const fetchSolicitudes = useCallback(async () => {
    setOperationLoading('solicitudes', true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchSolicitudes');
      setOperationLoading('solicitudes', false);
      return;
    }
    
    // Verifică dacă utilizatorul este autentificat înainte de a face request-uri
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('⚠️ [fetchSolicitudes] No auth token, skipping fetch (user logged out)');
      setOperationLoading('solicitudes', false);
      return;
    }
    
    try {
      const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
      
      // Pentru "Mis Solicitudes" (activeTab === 'lista'): ausencias + solicitudes (Pendiente/Rechazada) ca să apară și cele în așteptare
      if (activeTab === 'lista') {
        const ausenciasUrl = `${routes.getAusencias}?codigo=${encodeURIComponent(userCode)}`;
        const [ausenciasResult, solicitudesResult] = await Promise.all([
          callApi(ausenciasUrl),
          callApi(`${ENDPOINT}?email=${encodeURIComponent(email)}&codigo=${encodeURIComponent(userCode)}&limit=500`),
        ]);
        
        const ausenciasData = ausenciasResult.success ? (Array.isArray(ausenciasResult.data) ? ausenciasResult.data : [ausenciasResult.data]) : [];
        const solicitudesUser = solicitudesResult.success ? (Array.isArray(solicitudesResult.data) ? solicitudesResult.data : [solicitudesResult.data]) : [];
        
        // Transformăm ausencias în format compatibil cu solicitudes pentru UI
        let transformedData = ausenciasData.map(ausencia => ({
          id: ausencia.id || ausencia.ID || `ausencia_${Math.random().toString(36).slice(2, 9)}`,
          tipo: ausencia.TIPO || ausencia.tipo || 'Ausencia',
          fecha_inicio: ausencia.FECHA_INICIO || ausencia.fecha_inicio || ausencia.FECHA || ausencia.fecha,
          fecha_fin: ausencia.FECHA_FIN || ausencia.fecha_fin || ausencia.FECHA || ausencia.fecha,
          FECHA: ausencia.FECHA || ausencia.fecha,
          FECHA_INICIO: ausencia.FECHA_INICIO || ausencia.fecha_inicio,
          FECHA_FIN: ausencia.FECHA_FIN || ausencia.fecha_fin,
          fecha_solicitud: ausencia.created_at || ausencia.CREATED_AT || ausencia.createdAt || ausencia.fecha_solicitud || ausencia.FECHA || ausencia.fecha,
          created_at: ausencia.created_at || ausencia.CREATED_AT || ausencia.createdAt,
          MOTIVO: ausencia.MOTIVO || ausencia.motivo || '',
          motivo: ausencia.MOTIVO || ausencia.motivo || '',
          ESTADO: ausencia.ESTADO || ausencia.estado || 'Aprobada',
          estado: ausencia.ESTADO || ausencia.estado || 'Aprobada',
          CODIGO: ausencia.CODIGO || ausencia.codigo || userCode,
          codigo: ausencia.CODIGO || ausencia.codigo || userCode,
          NOMBRE: ausencia.NOMBRE || ausencia.nombre || '',
          nombre: ausencia.NOMBRE || ausencia.nombre || '',
          duracion: ausencia.duracion || ausencia.DURACION || '',
          no_necesita_justificante: ausencia.no_necesita_justificante || ausencia.NO_NECESITA_JUSTIFICANTE || false,
          ausencia_asociada_id: ausencia.ausencia_asociada_id || null,
          fuente: 'ausencias',
          raw: ausencia
        }));
        
        // Adăugăm solicitările Pendiente și Rechazada (nu sunt în ausencias) și eventual Aprobada care nu e încă în ausencias
        const normalizeSolicitud = (s) => ({
          id: s.id || s.ID,
          tipo: s.tipo || s.TIPO,
          fecha_inicio: s.fecha_inicio || s.FECHA_INICIO,
          fecha_fin: s.fecha_fin || s.FECHA_FIN,
          FECHA: s.FECHA || (s.fecha_inicio && s.fecha_fin ? `${s.fecha_inicio} - ${s.fecha_fin}` : s.fecha_inicio || s.fecha_fin),
          FECHA_INICIO: s.fecha_inicio,
          FECHA_FIN: s.fecha_fin,
          fecha_solicitud: s.fecha_solicitud || s.created_at,
          created_at: s.fecha_solicitud || s.created_at,
          MOTIVO: s.motivo || s.MOTIVO || '',
          motivo: s.motivo || s.MOTIVO || '',
          ESTADO: s.estado || s.ESTADO,
          estado: s.estado || s.ESTADO,
          CODIGO: s.codigo || s.CODIGO || userCode,
          codigo: s.codigo || s.CODIGO || userCode,
          NOMBRE: s.nombre || s.NOMBRE || '',
          nombre: s.nombre || s.NOMBRE || '',
          email: s.email || s.EMAIL,
          duracion: s.duracion || s.DURACION || '',
          no_necesita_justificante: s.no_necesita_justificante ?? false,
          ausencia_asociada_id: s.ausencia_asociada_id || null,
          tipo_justificante: s.tipo_justificante,
          hora_cita: s.hora_cita,
          centro_medico: s.centro_medico,
          descripcion_otro: s.descripcion_otro,
          fecha_ultimo_dia_trabajo: s.fecha_ultimo_dia_trabajo,
          dias_preaviso: s.dias_preaviso,
          cumple_preaviso_15: s.cumple_preaviso_15,
          fuente: 'solicitudes',
          raw: s
        });
        
        for (const s of solicitudesUser) {
          const already = transformedData.some(
            a => String(a.id) === String(s.id) || 
              ((a.tipo || a.TIPO) === (s.tipo || s.TIPO) && (a.fecha_inicio || a.FECHA_INICIO) === (s.fecha_inicio || s.FECHA_INICIO) && (a.codigo || a.CODIGO) === (s.codigo || s.CODIGO))
          );
          if (!already) transformedData.push(normalizeSolicitud(s));
        }
        
        // Sortare după fecha_solicitud - cea mai nouă primul
        transformedData.sort((a, b) => {
          const fechaA = a.fecha_solicitud || a.created_at || a.FECHA || a.fecha_inicio || a.FECHA_INICIO || '';
          const fechaB = b.fecha_solicitud || b.created_at || b.FECHA || b.fecha_inicio || b.FECHA_INICIO || '';
          if (fechaA && fechaB) {
            const dateA = new Date(fechaA);
            const dateB = new Date(fechaB);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) return dateB.getTime() - dateA.getTime();
            return (fechaB || '').localeCompare(fechaA || '');
          }
          if (fechaA && !fechaB) return -1;
          if (!fechaA && fechaB) return 1;
          return 0;
        });
        
        setSolicitudes(transformedData);
        
        await fetchBajaVoluntariaDocumentos(transformedData);

        let totalAsuntoDays = 0;
        let totalVacacionesDays = 0;
        
        transformedData.forEach(item => {
            const tipo = (item.tipo || item.TIPO || '').toLowerCase();
            const fechaInicio = item.fecha_inicio || item.FECHA_INICIO || item.FECHA || item.fecha;
            const fechaFin = item.fecha_fin || item.FECHA_FIN || item.FECHA || item.fecha;
            
            if (fechaInicio && fechaFin) {
              const start = new Date(fechaInicio);
              const end = new Date(fechaFin);
              const diffMs = end.getTime() - start.getTime();
              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
              
              if (tipo.includes('asunto') || tipo.includes('propio')) {
                totalAsuntoDays += days;
              } else if (tipo.includes('vacacion')) {
                totalVacacionesDays += days;
              }
            } else if (fechaInicio) {
              // Dacă e o singură dată, numără 1 zi
              if (tipo.includes('asunto') || tipo.includes('propio')) {
                totalAsuntoDays += 1;
              } else if (tipo.includes('vacacion')) {
                totalVacacionesDays += 1;
              }
            }
          });
          
          setTotalAsuntoPropioDays(totalAsuntoDays);
          setTotalVacacionesDays(totalVacacionesDays);
      } else {
        // Pentru alte taburi (ex: "Todas las Solicitudes"): păstrăm comportamentul vechi (din solicitudes)
        const url = `${ENDPOINT}?email=${encodeURIComponent(email)}&codigo=${encodeURIComponent(userCode)}`;
        const result = await callApi(url);
        if (result.success) {
          const data = Array.isArray(result.data) ? result.data : [result.data];
          setSolicitudes(data);
          
          // Încarcă documentele asociate cu BAJA_VOLUNTARIA și Ausencias justificada
          await fetchBajaVoluntariaDocumentos(data);

          // Calculează totalul de zile pentru Asunto Propio și Vacaciones
          let totalAsuntoDays = 0;
          let totalVacacionesDays = 0;
          
          data.forEach(solicitud => {
            if (solicitud.tipo === 'Asunto Propio' && solicitud.fecha_inicio && solicitud.fecha_fin) {
              const start = new Date(solicitud.fecha_inicio);
              const end = new Date(solicitud.fecha_fin);
              const diffMs = end.getTime() - start.getTime();
              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
              totalAsuntoDays += days;
            }
            
            if (solicitud.tipo === 'Vacaciones' && solicitud.fecha_inicio && solicitud.fecha_fin) {
              const start = new Date(solicitud.fecha_inicio);
              const end = new Date(solicitud.fecha_fin);
              const diffMs = end.getTime() - start.getTime();
              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
              totalVacacionesDays += days;
            }
          });
          
          setTotalAsuntoPropioDays(totalAsuntoDays);
          setTotalVacacionesDays(totalVacacionesDays);
        }
      }
    } catch (error) {
      console.error('Error fetching solicitudes/ausencias:', error);
    }
    setOperationLoading('solicitudes', false);
  }, [authUser, email, callApi, setOperationLoading, activeTab, fetchBajaVoluntariaDocumentos]);

  const fetchAllSolicitudes = useCallback(async () => {
    setOperationLoading('allSolicitudes', true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchAllSolicitudes');
      setOperationLoading('allSolicitudes', false);
      return;
    }
    
    // Verifică dacă utilizatorul este autentificat înainte de a face request-uri
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('⚠️ [fetchAllSolicitudes] No auth token, skipping fetch (user logged out)');
      setOperationLoading('allSolicitudes', false);
      return;
    }
    
    try {
      // Para managers - todas las solicitudes del sistema (sin email). Lista primero; documentos se cargan solo en el tab que los necesita.
      const result = await callApi(ENDPOINT);
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setAllSolicitudes(data);
        // No bloquear: documentos se cargan en useEffect cuando el usuario abre Aprobación / Ausencias / Baja voluntaria
      }
    } catch (error) {
      console.error('Error fetching all solicitudes:', error);
    }
    setOperationLoading('allSolicitudes', false);
  }, [authUser, callApi, setOperationLoading]);

  const fetchAllUsers = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchAllUsers');
      return;
    }
    
    try {
      const result = await callApi(API_ENDPOINTS.USERS);
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setAllUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setAllUsers([]);
    }
  }, [authUser, callApi]);

  // Funcție pentru încărcarea saldo-ului real de vacanțe din backend
  const fetchVacacionesSaldo = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchVacacionesSaldo');
      return;
    }

    try {
      const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
      if (!userCode) {
        console.warn('⚠️ No user code available for fetching vacaciones saldo');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const saldoUrl = routes.getVacacionesSaldoEmpleado(userCode);
      
      const response = await fetch(saldoUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.vacaciones) {
          setVacacionesSaldo({
            dias_anuales: data.vacaciones.dias_anuales || 31,
            dias_restantes_ano_anterior: data.vacaciones.dias_restantes_ano_anterior || 0,
            dias_restantes: data.vacaciones.dias_restantes || 0,
          });
          console.log('✅ Saldo vacaciones loaded:', data.vacaciones);
        }
        if (data.asuntos_propios) {
          setAsuntosPropiosSaldo({
            dias_anuales: data.asuntos_propios.dias_anuales || 0,
            dias_consumidos_aprobados: data.asuntos_propios.dias_consumidos_aprobados || 0,
            dias_restantes: data.asuntos_propios.dias_restantes || 0,
          });
          console.log('✅ Saldo asuntos propios loaded:', data.asuntos_propios);
        }
      } else {
        console.warn('⚠️ Error fetching vacaciones saldo:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching vacaciones saldo:', error);
    }
  }, [authUser]);

  const fetchAllAusencias = useCallback(async () => {
    if (!canAccessAllTabs) return; // Doar utilizatorii cu acces complet pot vedea toate ausencias-urile
    
    setOperationLoading('ausencias', true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchAllAusencias');
      setOperationLoading('ausencias', false);
      return;
    }
    
    // Verifică dacă utilizatorul este autentificat înainte de a face request-uri
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('⚠️ [fetchAllAusencias] No auth token, skipping fetch (user logged out)');
      setOperationLoading('ausencias', false);
      return;
    }
    
    try {
      // Folosim backend-ul nou (GET /api/ausencias)
      // Pentru managers: toate ausencias-urile (fără filtru codigo)
      const url = routes.getAusencias;
      console.log('✅ [SolicitudesPage] Folosind backend-ul nou (getAusencias):', url);
      
      const result = await callApi(url);
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setAllAusencias(data);
        // useEffect-ul se va ocupa de declanșarea fetch-ului pentru justificante
      }
    } catch (error) {
      console.error('Error fetching ausencias:', error);
      setAllAusencias([]);
    }
    setOperationLoading('ausencias', false);
  }, [authUser, canAccessAllTabs, callApi, setOperationLoading]);



  const fetchBajasMedicas = useCallback(async () => {
    if (!canAccessAllTabs) return;
    if (!BAJA_LIST_ENDPOINT) {
      console.warn('Endpoint para obtener bajas médicas no está configurado.');
      setAllBajasMedicas([]);
      return;
    }

    setOperationLoading('bajas', true);
    try {
      // Backend endpoint is GET /api/bajas-medicas (requires JWT authentication)
      const listUrl = BAJA_LIST_ENDPOINT;

      // Folosește callApi pentru a beneficia de error handling și token refresh automat
      const result = await callApi(listUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': config.APP_VERSION,
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0',
        },
      });

      // Backend returns array directly, not wrapped in data property
      const data = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result)
        ? result
        : [];
      setAllBajasMedicas(data);
    } catch (error) {
      console.error('Error fetching bajas médicas:', error);
      setAllBajasMedicas([]);
    } finally {
      setOperationLoading('bajas', false);
    }
  }, [canAccessAllTabs, setOperationLoading, callApi]);

  // Funcție pentru a salva modificările la bajas médicas
  const handleSaveBajaDate = useCallback(async (idCaso, idPosicion, field, newValue) => {
    if (!canAccessAllTabs) return;

    setOperationLoading('updateBaja', true);
    try {
      const updateData = {
        idCaso,
        idPosicion,
      };
      
      if (field === 'fechaBaja') {
        updateData.fechaBaja = newValue || null;
      } else if (field === 'fechaAlta') {
        updateData.fechaAlta = newValue || null;
      } else if (field === 'situacion') {
        updateData.situacion = newValue || '';
      }

      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.updateBajasMedicas, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const fieldName = field === 'fechaBaja' ? 'baja' : field === 'fechaAlta' ? 'alta' : 'situación';
        setSuccessMsg(`${field === 'situacion' ? 'Situación' : `Fecha ${fieldName}`} actualizada correctamente.`);
        
        // Log editarea bajas médicas
        await activityLogger.logAction('baja_medica_updated', {
          idCaso,
          idPosicion,
          field,
          newValue,
          user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
          email: authUser?.email
        });
        
        // Refreshează lista
        await fetchBajasMedicas();
        
        // Închide editarea
        setEditingBaja(null);
        setEditingBajaValue('');
      } else {
        throw new Error(result.message || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error updating baja médica:', error);
      setErrorMsg(
        error instanceof Error
          ? `No se pudo actualizar: ${error.message}`
          : 'No se pudo actualizar la fecha.'
      );
    } finally {
      setOperationLoading('updateBaja', false);
    }
  }, [canAccessAllTabs, setOperationLoading, setSuccessMsg, setErrorMsg, fetchBajasMedicas, authUser]);

  useEffect(() => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo solicitudes data instead of fetching from backend');
      setDemoSolicitudes();
      setOperationLoading('solicitudes', false);
      setOperationLoading('allSolicitudes', false);
      return;
    }

    fetchSolicitudes();
    fetchVacacionesSaldo(); // Încarcă saldo-ul real de vacanțe

    if (canAccessAllTabs) {
      fetchAllSolicitudes();
      fetchAllUsers();
      fetchAllAusencias();
      fetchBajasMedicas();
    }

    activityLogger.logPageAccess('solicitudes', authUser);
  }, [authUser, canAccessAllTabs, activeTab, fetchSolicitudes, fetchVacacionesSaldo, fetchAllSolicitudes, fetchAllUsers, fetchAllAusencias, fetchBajasMedicas, setDemoSolicitudes, setOperationLoading]);

  const fetchVacationBlockedPeriods = useCallback(async () => {
    if (authUser?.isDemo || !canAccessAllTabs) return;
    try {
      const res = await callApi(routes.getVacationBlockedPeriods, { method: 'GET' });
      const list = (res?.data ?? res) ?? [];
      setVacationBlockedPeriods(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Error fetching vacation blocked periods:', e);
      setVacationBlockedPeriods([]);
    }
  }, [authUser?.isDemo, canAccessAllTabs, callApi]);

  const fetchAsuntoPropioBlockedPeriods = useCallback(async () => {
    if (authUser?.isDemo || !canAccessPage) return;
    try {
      const res = await callApi(routes.getAsuntoPropioBlockedPeriods, { method: 'GET' });
      const list = (res?.data ?? res) ?? [];
      setAsuntoPropioBlockedPeriods(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Error fetching asunto propio blocked periods:', e);
      setAsuntoPropioBlockedPeriods([]);
    }
  }, [authUser?.isDemo, canAccessPage, callApi]);

  const fetchAsuntosPropiosMaxPorDia = useCallback(async () => {
    if (authUser?.isDemo || !canAccessPage) return;
    try {
      const res = await callApi(routes.getAsuntosPropiosMaxPorDia, { method: 'GET' });
      const data = res?.data ?? res;
      const n = Number(data?.max_personas_dia);
      if (Number.isFinite(n) && n >= 1 && n <= 50) {
        setAsuntosPropiosMaxPorDia(n);
      }
    } catch (e) {
      console.warn('getAsuntosPropiosMaxPorDia:', e);
    }
  }, [authUser?.isDemo, canAccessPage, callApi]);

  const fetchVacacionesDisponibilidadPct = useCallback(async () => {
    if (authUser?.isDemo) return;
    try {
      const res = await callApi(routes.getVacacionesDisponibilidadPorcentaje, { method: 'GET' });
      if (!res?.success) return;
      const data = res.data;
      const p = Number(data?.porcentaje);
      if (Number.isFinite(p) && p >= 1 && p <= 100) {
        setVacacionesDisponibilidadPct(p);
      }
    } catch (e) {
      console.warn('getVacacionesDisponibilidadPorcentaje:', e);
    }
  }, [authUser?.isDemo, callApi]);

  useEffect(() => {
    if (authUser && !authUser.isDemo) {
      fetchVacacionesDisponibilidadPct();
    }
  }, [authUser, fetchVacacionesDisponibilidadPct]);

  useEffect(() => {
    if (showVacationBlockedPeriodsModal) {
      setVacacionPctDraft(String(vacacionesDisponibilidadPct));
    }
    // Solo al abrir el modal (no reemplazar el borrador si cambia % con el modal abierto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVacationBlockedPeriodsModal]);

  useEffect(() => {
    if (canAccessAllTabs) fetchVacationBlockedPeriods();
  }, [canAccessAllTabs, fetchVacationBlockedPeriods]);

  useEffect(() => {
    if (canAccessPage) fetchAsuntoPropioBlockedPeriods();
  }, [canAccessPage, fetchAsuntoPropioBlockedPeriods]);

  useEffect(() => {
    if (canAccessPage) fetchAsuntosPropiosMaxPorDia();
  }, [canAccessPage, fetchAsuntosPropiosMaxPorDia]);

  useEffect(() => {
    if (showAsuntoPropioBlockedPeriodsModal) {
      setApMaxPersonasDraft(String(asuntosPropiosMaxPorDia));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAsuntoPropioBlockedPeriodsModal]);
  useEffect(() => {
    if (selectedTab === 'baja' && canAccessAllTabs) {
      fetchBajasMedicas();
    }
  }, [selectedTab, canAccessAllTabs, fetchBajasMedicas]);

  // Cargar estadísticas cuando se abre el tab (solo una vez)
  const estadisticasLoadedRef = useRef(false);
  useEffect(() => {
    // Reset ref cuando se cambia de tab
    if (activeTab !== 'estadisticas') {
      estadisticasLoadedRef.current = false;
      return;
    }
    
    // Cargar solo si es el tab de estadísticas, tiene acceso completo, y no se ha cargado aún
    if (activeTab === 'estadisticas' && canAccessAllTabs && !estadisticasLoadedRef.current) {
      estadisticasLoadedRef.current = true;
      const loadEstadisticas = async () => {
        setEstadisticasLoading(true);
        try {
          console.log('🔄 Cargando estadísticas...');
          const response = await callApi(routes.getVacacionesEstadisticas, {
            method: 'GET',
          });
          console.log('✅ Respuesta estadísticas:', response);
          // useApi wrappează răspunsul în {success: true, data: {...}}
          if (response?.success && response?.data?.success && response?.data?.estadisticas) {
            console.log('📊 Estadísticas recibidas:', response.data.estadisticas.length, 'empleados');
            setEstadisticas(response.data.estadisticas);
          } else {
            console.warn('⚠️ Respuesta sin estadísticas:', response);
          }
        } catch (error) {
          console.error('❌ Error cargando estadísticas:', error);
        } finally {
          setEstadisticasLoading(false);
        }
      };
      loadEstadisticas();
    }
  }, [activeTab, canAccessAllTabs, callApi]);

  const estadisticasControlVacLoadedRef = useRef(false);
  useEffect(() => {
    if (activeTab !== 'todas' || selectedTab !== 'control_vacaciones') {
      estadisticasControlVacLoadedRef.current = false;
      return;
    }
    if (!canAccessAllTabs || authUser?.isDemo) return;
    if (estadisticasControlVacLoadedRef.current) return;
    estadisticasControlVacLoadedRef.current = true;
    const loadVacControlStats = async () => {
      setEstadisticasLoading(true);
      try {
        const response = await callApi(routes.getVacacionesEstadisticas, {
          method: 'GET',
        });
        if (response?.success && response?.data?.success && response?.data?.estadisticas) {
          setEstadisticas(response.data.estadisticas);
        }
      } catch (error) {
        console.error('Error cargando estadísticas (control vacaciones):', error);
      } finally {
        setEstadisticasLoading(false);
      }
    };
    loadVacControlStats();
  }, [activeTab, selectedTab, canAccessAllTabs, authUser?.isDemo, callApi]);

  const horariosControlVacLoadedRef = useRef(false);
  useEffect(() => {
    if (activeTab !== 'todas' || selectedTab !== 'control_vacaciones') {
      horariosControlVacLoadedRef.current = false;
      return;
    }
    if (!canAccessAllTabs || authUser?.isDemo) return;
    if (horariosControlVacLoadedRef.current) return;
    horariosControlVacLoadedRef.current = true;
    (async () => {
      try {
        const response = await callApi(routes.getHorarios, { method: 'GET' });
        const raw = response?.data ?? response;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setHorariosCatalog(list);
      } catch (e) {
        console.warn('No se pudo cargar catálogo horarios:', e);
        setHorariosCatalog([]);
      }
    })();
  }, [activeTab, selectedTab, canAccessAllTabs, authUser?.isDemo, callApi]);

  const handleBajaUploadClick = useCallback(() => {
    if (!canAccessAllTabs) return;
    bajaFileInputRef.current?.click();
  }, [canAccessAllTabs]);

  const handleBajaFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!BAJA_UPLOAD_ENDPOINT) {
        setErrorMsg('Endpoint para subir bajas médicas no está configurado.');
        event.target.value = '';
        return;
      }

      setOperationLoading('uploadBajas', true);
      setErrorMsg('');
      setSuccessMsg('');

      try {
        const formData = new FormData();
        formData.append('file', file, file.name);

        const uploadUrl = `${BAJA_UPLOAD_ENDPOINT}${
          BAJA_UPLOAD_ENDPOINT.includes('?') ? '&' : '?'
        }accion=guardar_bajas`;

        // Add JWT token for backend API calls
        const token = localStorage.getItem('auth_token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: headers,
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        let result = null;
        try {
          result = await response.json();
        } catch {
          // ignore parsing errors for non-JSON responses
        }

        setSuccessMsg(
          result?.message || 'Archivo de bajas médicas cargado correctamente.'
        );

        // Dacă backend a detectat conflicte MANUAL vs MUTUA, afișăm modalul de rezolvare
        const conflicts = Array.isArray(result?.conflicts) ? result.conflicts : [];
        if (conflicts.length > 0) {
          setBajaConflicts(conflicts);
          // Default: "merge" (dacă Mutua nu are fecha alta, păstrăm manual; altfel păstrăm Mutua)
          const initialChoices = {};
          for (const c of conflicts) {
            const key = `${c?.manual?.idCaso || ''}_${c?.manual?.idPosicion || ''}__${c?.mutua?.idCaso || ''}_${c?.mutua?.idPosicion || ''}`;
            if (key !== '__') initialChoices[key] = 'merge';
          }
          setBajaConflictChoices(initialChoices);
          setShowBajaConflictsModal(true);
        }

        // Log upload bajas médicas
        await activityLogger.logBajaMedicaUploaded(
          { fileName: file.name, fileSize: file.size },
          authUser
        );

        if (isManager) {
          await fetchAllSolicitudes();
          await fetchAllAusencias();
          await fetchBajasMedicas();
        }
      } catch (error) {
        console.error('Error uploading bajas médicas:', error);
        setErrorMsg(
          error instanceof Error
            ? `No se pudo cargar el archivo de bajas médicas: ${error.message}`
            : 'No se pudo cargar el archivo de bajas médicas.'
        );
      } finally {
        setOperationLoading('uploadBajas', false);
        if (event.target) {
          event.target.value = '';
        }
      }
    },
    [
      authUser,
      fetchAllAusencias,
      fetchAllSolicitudes,
      isManager,
      setErrorMsg,
      setOperationLoading,
      setSuccessMsg,
      fetchBajasMedicas,
    ]
  );

  const handleOpenManualBajaModal = useCallback(() => {
    if (!canAccessAllTabs) return;
    setManualEmployeeSearch('');
    setManualShowEmployeeDropdown(false);
    setManualSelectedEmployee(null);
    setManualBajaFechaBaja('');
    setManualBajaFechaAlta('');
    setShowManualBajaModal(true);
  }, [canAccessAllTabs]);

  const handleCreateManualBaja = useCallback(async () => {
    if (!canAccessAllTabs) return;
    if (!BAJA_MANUAL_ENDPOINT) {
      setErrorMsg('Endpoint para crear baja manual no está configurado.');
      return;
    }
    if (!manualSelectedEmployee?.codigo) {
      setErrorMsg('Selecciona un empleado (código).');
      return;
    }
    if (!manualBajaFechaBaja) {
      setErrorMsg('Fecha baja es obligatoria.');
      return;
    }

    setOperationLoading('createManualBaja', true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        codigoEmpleado: manualSelectedEmployee.codigo,
        fechaBaja: manualBajaFechaBaja,
        fechaAlta: manualBajaFechaAlta || undefined,
        fuente: 'MANUAL',
      };

      const resp = await fetch(BAJA_MANUAL_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `HTTP ${resp.status}`);
      }
      const result = await resp.json();
      if (!result?.success) {
        throw new Error(result?.message || 'No se pudo crear la baja manual.');
      }

      setSuccessMsg(result?.message || 'Baja médica manual creada correctamente.');
      
      // Log crearea manuală de bajas
      await activityLogger.logAction('baja_medica_manual_created', {
        codigoEmpleado: manualSelectedEmployee.codigo,
        nombreEmpleado: manualSelectedEmployee.name,
        fechaBaja: manualBajaFechaBaja,
        fechaAlta: manualBajaFechaAlta || null,
        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
        email: authUser?.email
      });
      
      setShowManualBajaModal(false);
      await fetchBajasMedicas();
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? `No se pudo crear: ${e.message}` : 'No se pudo crear.'
      );
    } finally {
      setOperationLoading('createManualBaja', false);
    }
  }, [
    canAccessAllTabs,
    manualSelectedEmployee,
    manualBajaFechaBaja,
    manualBajaFechaAlta,
    setOperationLoading,
    setErrorMsg,
    setSuccessMsg,
    fetchBajasMedicas,
    authUser,
  ]);

  const handleResolveBajaConflicts = useCallback(async () => {
    if (!canAccessAllTabs) return;
    if (!BAJA_RESOLVE_CONFLICTS_ENDPOINT) {
      setErrorMsg('Endpoint para resolver conflictos no está configurado.');
      return;
    }

    const resolutions = (bajaConflicts || [])
      .map((c) => {
        const key = `${c?.manual?.idCaso || ''}_${c?.manual?.idPosicion || ''}__${c?.mutua?.idCaso || ''}_${c?.mutua?.idPosicion || ''}`;
        const action = bajaConflictChoices?.[key] || 'merge';
        return {
          action,
          manualIdCaso: c?.manual?.idCaso,
          manualIdPosicion: c?.manual?.idPosicion,
          mutuaIdCaso: c?.mutua?.idCaso,
          mutuaIdPosicion: c?.mutua?.idPosicion,
        };
      })
      .filter(
        (r) => r.manualIdCaso && r.manualIdPosicion && r.mutuaIdCaso && r.mutuaIdPosicion
      );

    if (resolutions.length === 0) {
      setShowBajaConflictsModal(false);
      return;
    }

    setOperationLoading('resolveBajaConflicts', true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(BAJA_RESOLVE_CONFLICTS_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolutions }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `HTTP ${resp.status}`);
      }
      const result = await resp.json();
      if (!result?.success) {
        throw new Error(result?.message || 'No se pudo resolver conflictos.');
      }

      setSuccessMsg(
        `Conflictos resueltos: ${result?.resolved ?? resolutions.length}.`
      );
      
      // Log rezolvarea conflictelor
      await activityLogger.logAction('baja_conflicts_resolved', {
        resolved_count: result?.resolved ?? resolutions.length,
        total_conflicts: resolutions.length,
        resolutions: resolutions.map(r => ({ action: r.action, manualIdCaso: r.manualIdCaso, mutuaIdCaso: r.mutuaIdCaso })),
        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
        email: authUser?.email
      });
      
      setShowBajaConflictsModal(false);
      setBajaConflicts([]);
      setBajaConflictChoices({});
      await fetchBajasMedicas();
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? `No se pudo resolver: ${e.message}` : 'No se pudo resolver.'
      );
    } finally {
      setOperationLoading('resolveBajaConflicts', false);
    }
  }, [
    canAccessAllTabs,
    bajaConflicts,
    bajaConflictChoices,
    setOperationLoading,
    setErrorMsg,
    setSuccessMsg,
    fetchBajasMedicas,
    authUser,
  ]);

  const handleExportEstadisticasExcel = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.exportVacacionesEstadisticasExcel;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Estadisticas_Solicitudes_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      alert('Error al exportar Excel: ' + err.message);
    }
  };

  const handleExportEstadisticasPDF = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.exportVacacionesEstadisticasPDF;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Estadisticas_Solicitudes_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      alert('Error al exportar PDF: ' + err.message);
    }
  };

  // Polling cu pause/resume automat când tab-ul nu e activ + jitter
  usePolling(() => {
    fetchSolicitudes();
    if (canAccessAllTabs) {
      fetchAllSolicitudes();
      fetchAllAusencias();
    }
  }, 60000, true, 12000); // 60s base + max 12s jitter

  // Funcție pentru trimitere reamintire justificante (fără modal, apel direct)
  const handleRecordarJustificante = async (ausencia) => {
    const ausenciaId = ausencia.id || ausencia.ID;
    if (!ausenciaId) {
      setErrorMsg('No se ha identificado la ausencia.');
      return;
    }

    setOperationLoading('recordar-justificante', true);
    setErrorMsg(null);

    try {
      const result = await callApi(routes.recordarJustificante(ausenciaId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (result.success) {
        const nombreEmpleado = ausencia.NOMBRE || ausencia.nombre || ausencia.CODIGO || ausencia.codigo || 'empleado';
        setSuccessMsg(`✅ Recordatorio enviado a ${nombreEmpleado}. Se ha enviado un email y notificación a gestoria.`);
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setErrorMsg(result.error || 'Error al enviar recordatorio');
      }
    } catch (error) {
      console.error('Error enviando recordatorio:', error);
      setErrorMsg(error.message || 'Error al enviar recordatorio');
    } finally {
      setOperationLoading('recordar-justificante', false);
    }
  };

  const handleAsociarAusencia = async (ausenciaId, ausenciaAsociadaId) => {
    setOperationLoading('asociar-ausencia', true);
    setErrorMsg(null);

    try {
      const result = await callApi(routes.asociarAusencia(ausenciaId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ausencia_asociada_id: ausenciaAsociadaId,
        }),
      });

      if (result.success) {
        setSuccessMsg(result.message || '✅ Ausencia asociada correctamente');
        setTimeout(() => setSuccessMsg(''), 5000);
        // Reîncarcă listele
        fetchAllAusencias();
        // Reîncarcă și pentru "Mis Solicitudes" dacă suntem în acel tab
        if (activeTab === 'lista') {
          fetchSolicitudes();
        }
        setAsociarAusenciaModal({ isOpen: false, ausencia: null });
        setSelectedAusenciaIdForAsociar(null);
      } else {
        setErrorMsg(result.error || 'Error al asociar ausencia');
      }
    } catch (error) {
      console.error('Error asociando ausencia:', error);
      setErrorMsg(error.message || 'Error al asociar ausencia');
    } finally {
      setOperationLoading('asociar-ausencia', false);
    }
  };

  const handleCalcularDuracion = async (ausenciaId) => {
    setOperationLoading('calcular-duracion', true);
    setErrorMsg(null);

    try {
      const result = await callApi(routes.recalcularDuracion(ausenciaId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (result.success) {
        // Reîncarcă datele pentru a actualiza durata
        await fetchSolicitudes();
        alert(result.message || 'Duración calculada correctamente');
      } else {
        setErrorMsg(result.message || 'Error al calcular la duración');
      }
    } catch (error) {
      console.error('Error calculando duración:', error);
      setErrorMsg(error.message || 'Error al calcular la duración');
    } finally {
      setOperationLoading('calcular-duracion', false);
    }
  };

  const handleMarcarSinAusencia = async (ausenciaId) => {
    setOperationLoading('marcar-sin-ausencia', true);
    setErrorMsg(null);

    try {
      const result = await callApi(routes.marcarSinAusencia(ausenciaId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (result.success) {
        setSuccessMsg(result.message || '✅ Ausencia marcada como sin ausencia');
        setTimeout(() => setSuccessMsg(''), 5000);
        // Reîncarcă listele
        fetchAllAusencias();
        // Reîncarcă și pentru "Mis Solicitudes" dacă suntem în acel tab
        if (activeTab === 'lista') {
          fetchSolicitudes();
        }
      } else {
        setErrorMsg(result.error || 'Error al marcar ausencia como sin ausencia');
      }
    } catch (error) {
      console.error('Error marcando ausencia como sin ausencia:', error);
      setErrorMsg(error.message || 'Error al marcar ausencia como sin ausencia');
    } finally {
      setOperationLoading('marcar-sin-ausencia', false);
    }
  };

  const handleRecalcularDuracion = async (ausenciaId) => {
    setOperationLoading('recalcular-duracion', true);
    setErrorMsg(null);

    try {
      const result = await callApi(routes.recalcularDuracion(ausenciaId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (result.success) {
        setSuccessMsg(result.message || `✅ Duración recalculada: ${result.duracion} ${result.duracion === 1 ? 'día' : 'días'}`);
        setTimeout(() => setSuccessMsg(''), 5000);
        // Reîncarcă listele
        await fetchAllAusencias();
        // Reîncarcă și pentru "Mis Solicitudes" pentru a actualiza lista
        await fetchSolicitudes();
      } else {
        setErrorMsg(result.error || 'Error al recalcular duración');
      }
    } catch (error) {
      console.error('Error recalculando duración:', error);
      setErrorMsg(error.message || 'Error al recalcular duración');
    } finally {
      setOperationLoading('recalcular-duracion', false);
    }
  };

  const handleOpenEditarDuracionModal = (ausencia) => {
    const duracion = ausencia.DURACION || ausencia.duracion || '';
    const unidad = ausencia.UNIDAD_DURACION || ausencia.unidad_duracion || 'dias';
    
    // Pentru ore, formatăm durata pentru afișare (dacă este în format TIME)
    let duracionDisplay = duracion;
    if (unidad === 'horas' && typeof duracion === 'string' && duracion.includes(':')) {
      // Păstrăm formatul TIME pentru editare
      duracionDisplay = duracion;
    } else if (unidad === 'horas' && typeof duracion === 'number') {
      // Convertim numărul de ore în format TIME
      const horas = Math.floor(duracion);
      const minutos = Math.round((duracion - horas) * 60);
      duracionDisplay = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;
    }
    
    setEditarDuracionModal({
      isOpen: true,
      ausencia: ausencia,
      duracion: duracionDisplay.toString(),
      unidad: unidad,
    });
  };

  const handleUpdateDuracion = async () => {
    const { ausencia, duracion, unidad } = editarDuracionModal;
    if (!ausencia || !duracion) {
      setErrorMsg('Por favor, ingrese una duración válida');
      return;
    }

    setOperationLoading('update-duracion', true);
    setErrorMsg(null);

    try {
      // Validează input-ul în funcție de unitate
      let duracionValue = duracion.trim();
      
      if (unidad === 'horas') {
        // Pentru ore, verifică formatul TIME (HH:MM:SS)
        if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(duracionValue)) {
          setErrorMsg('Formato inválido para horas. Use formato HH:MM:SS (ej: 05:30:00)');
          setOperationLoading('update-duracion', false);
          return;
        }
        // Asigură formatul complet HH:MM:SS
        const parts = duracionValue.split(':');
        if (parts.length === 2) {
          duracionValue = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
        } else {
          duracionValue = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
        }
      } else {
        // Pentru zile, verifică că este un număr
        const duracionNum = Number(duracionValue);
        if (isNaN(duracionNum) || duracionNum < 0) {
          setErrorMsg('La duración debe ser un número positivo');
          setOperationLoading('update-duracion', false);
          return;
        }
        duracionValue = duracionNum;
      }

      const result = await callApi(routes.updateDuracion(ausencia.id || ausencia.ID), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          duracion: duracionValue,
          unidad: unidad,
        }),
      });

      if (result.success) {
        setSuccessMsg(result.message || '✅ Duración actualizada correctamente');
        setTimeout(() => setSuccessMsg(''), 5000);
        setEditarDuracionModal({ isOpen: false, ausencia: null, duracion: '', unidad: 'dias' });
        // Reîncarcă listele
        await fetchAllAusencias();
        await fetchSolicitudes();
      } else {
        setErrorMsg(result.error || 'Error al actualizar duración');
      }
    } catch (error) {
      console.error('Error actualizando duración:', error);
      setErrorMsg(error.message || 'Error al actualizar duración');
    } finally {
      setOperationLoading('update-duracion', false);
    }
  };

  // Funcții pentru upload justificante (cargar justificante)
  const openUploadJustificanteModal = (ausencia) => {
    setSelectedAusenciaForUpload(ausencia);
    setUploadJustificanteFile(null);
    setUploadJustificanteError(null);
    setShowUploadJustificanteModal(true);
  };

  const handleUploadJustificante = async () => {
    if (!selectedAusenciaForUpload || !uploadJustificanteFile) {
      setUploadJustificanteError('Por favor, selecciona un archivo');
      return;
    }

    setUploadJustificanteLoading(true);
    setUploadJustificanteError(null);

    try {
      const codigoEmpleado = authUser?.['CODIGO'] || authUser?.codigo || '';
      if (!codigoEmpleado) {
        throw new Error('No se ha identificado el empleado');
      }

      const tipoAusencia = selectedAusenciaForUpload.tipo || selectedAusenciaForUpload.TIPO || 'Ausencia';
      let fechaAusencia = selectedAusenciaForUpload.FECHA || selectedAusenciaForUpload.fecha || selectedAusenciaForUpload.fecha_inicio || '';
      
      // Dacă FECHA conține un interval, luăm prima dată
      if (fechaAusencia && typeof fechaAusencia === 'string' && fechaAusencia.includes(' - ')) {
        fechaAusencia = fechaAusencia.split(' - ')[0].trim();
      }

      // Normalizează data pentru notas
      let fechaNormalizada = '';
      if (fechaAusencia) {
        try {
          if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
            fechaNormalizada = fechaAusencia.substring(0, 10);
          } else {
            const fecha = new Date(fechaAusencia);
            if (!isNaN(fecha.getTime())) {
              fechaNormalizada = fecha.toISOString().split('T')[0];
            }
          }
        } catch {
          fechaNormalizada = fechaAusencia;
        }
      }

      const notas = `Justificante para ausencia: ${tipoAusencia} - ${fechaNormalizada}`;
      const tipoDocumento = 'Justificante';

      // 1. Creează cererea în documentos_solicitados
      const token = localStorage.getItem('auth_token');
      
      // Creăm cererea direct cu status "completado" (pentru că angajatul încarcă direct justificantele)
      // Folosim endpoint-ul de creare, apoi îl marchem ca completat
      const createResponse = await fetch(routes.createDocumentoSolicitado, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          empleado_id: codigoEmpleado,
          tipo_documento: tipoDocumento,
          notas: notas,
        }),
      });

      let solicitudId = null;
      if (createResponse.ok) {
        const createData = await createResponse.json();
        solicitudId = createData.id;
      } else {
        // Dacă nu poate crea cererea (permisiuni), continuăm cu upload-ul direct
        // Backend-ul poate marca automat cererea ca completată dacă există
        console.warn('No se pudo crear la solicitud, continuando con el upload');
      }

      // 2. Încarcă fișierul
      const formData = new FormData();
      formData.append('archivo_0', uploadJustificanteFile);
      formData.append('empleado_id', codigoEmpleado);
      formData.append('empleado_nombre', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre');
      formData.append('empleado_email', authUser?.['CORREO ELECTRONICO'] || authUser?.email || '');
      formData.append('tipo_documento', tipoDocumento);
      formData.append('fecha_upload', new Date().toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Madrid'
      }));
      formData.append('archivo_0_nombre', uploadJustificanteFile.name);
      formData.append('archivo_0_tamaño', uploadJustificanteFile.size.toString());
      formData.append('archivo_0_tipo', uploadJustificanteFile.type);
      const ausenciaId = selectedAusenciaForUpload?.ausencia_id ?? selectedAusenciaForUpload?.id;
      if (ausenciaId != null && Number.isFinite(Number(ausenciaId))) {
        formData.append('ausencia_id', String(ausenciaId));
      }

      const uploadResponse = await fetch(routes.uploadDocumento, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Error al subir el archivo' }));
        throw new Error(errorData.error || 'Error al subir el archivo');
      }

      // 3. Marchează cererea ca completată (dacă s-a creat)
      if (solicitudId) {
        try {
          await fetch(routes.marcarDocumentoSolicitadoCompletado, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify({
              empleado_id: codigoEmpleado,
              tipo_documento: tipoDocumento,
            }),
          });
        } catch (e) {
          console.warn('No se pudo marcar la solicitud como completada:', e);
        }
      }

      setSuccessMsg(`Justificante cargado correctamente para ${tipoAusencia}`);
      
      // Log upload justificante
      await activityLogger.logAction('justificante_uploaded', {
        codigoEmpleado,
        tipoAusencia,
        fechaAusencia: fechaNormalizada,
        fileName: uploadJustificanteFile.name,
        fileSize: uploadJustificanteFile.size,
        solicitudId,
        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
        email: authUser?.email
      });
      
      setShowUploadJustificanteModal(false);
      setUploadJustificanteFile(null);
      setSelectedAusenciaForUpload(null);

      // Reîncarcă justificantele
      setTimeout(() => {
        const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
        if (userCode) {
          // Reîncarcă justificantele
          const fetchJustificantes = async () => {
            try {
              const token = localStorage.getItem('auth_token');
              const url = routes.getDocumentosSolicitados(userCode);
              const response = await fetch(url, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              });
              if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && Array.isArray(data.data)) {
                  // Re-procesează justificantele (similar cu useEffect-ul existent)
                  const justificantes = data.data.filter(doc => {
                    const tipo = (doc.tipo_documento || '').toLowerCase().trim();
                    return tipo.includes('justificante') || 
                           tipo.includes('certificado médico') || 
                           tipo.includes('certificado medico');
                  });
                  
                  const justificantesMapPorFecha = new Map();
                  const justificantesMapPorTipoYFecha = new Map();
                  
                  justificantes.forEach(doc => {
                    const notas = doc.notas || '';
                    let match = notas.match(/Justificante para ausencia:\s*(.+?)\s*-\s*(\d{4}-\d{2}-\d{2})/i);
                    if (!match) {
                      match = notas.match(/Justificante para ausencia:\s*(.+?)\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
                      if (match) {
                        const fechaParts = match[2].trim().split('/');
                        if (fechaParts.length === 3) {
                          const fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                          match = [match[0], match[1], fechaNormalizada];
                        }
                      }
                    }
                    
                    if (match) {
                      const tipoAusencia = match[1].trim();
                      let fechaAusencia = match[2].trim();
                      
                      // Asigură-te că data este în format YYYY-MM-DD
                      if (fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                        const fechaParts = fechaAusencia.split('/');
                        if (fechaParts.length === 3) {
                          fechaAusencia = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                        }
                      }
                      
                      if (!justificantesMapPorFecha.has(fechaAusencia)) {
                        justificantesMapPorFecha.set(fechaAusencia, []);
                      }
                      const justificanteData = {
                        estado: doc.estado,
                        fecha_solicitud: doc.fecha_solicitud,
                        fecha_completado: doc.fecha_completado,
                        tipo_documento: doc.tipo_documento,
                        notas: doc.notas,
                        id: doc.id,
                        tipoAusencia: tipoAusencia,
                        fechaAusencia: fechaAusencia
                      };
                      justificantesMapPorFecha.get(fechaAusencia).push(justificanteData);
                      
                      const key = `${tipoAusencia}_${fechaAusencia}`;
                      justificantesMapPorTipoYFecha.set(key, justificanteData);
                      
                      const keySinEspacios = `${tipoAusencia.replace(/\s+/g, '')}_${fechaAusencia}`;
                      if (keySinEspacios !== key) {
                        justificantesMapPorTipoYFecha.set(keySinEspacios, justificanteData);
                      }
                    }
                  });
                  
                  const justificantesMap = new Map();
                  justificantesMapPorTipoYFecha.forEach((value, key) => {
                    justificantesMap.set(key, value);
                  });
                  // ELIMINAT: Key-uri generice pe dată pentru a evita asocierea greșită a justificantelor
                  // Fiecare absență trebuie să aibă propriile justificante asociate pe baza tipului și datei exacte
                  // Nu mai adăugăm key-uri generice pe dată (_YYYY-MM-DD) pentru a preveni matching-ul greșit
                  
                  setJustificantesPorAusenciaWithRef(justificantesMap);
                }
              }
            } catch (error) {
              console.warn('Error recargando justificantes:', error);
            }
          };
          fetchJustificantes();
          fetchInitialJustificantes();
        }
      }, 500);

      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error) {
      console.error('Error cargando justificante:', error);
      setUploadJustificanteError(error.message || 'Error al cargar el justificante');
    } finally {
      setUploadJustificanteLoading(false);
    }
  };

  // Fetch documentos solicitados pentru ausencias (pentru a afișa statusul)
  const fetchDocumentosSolicitadosForAusencias = useCallback(async () => {
    console.log('🔍 [fetchDocumentosSolicitadosForAusencias] Called', {
      isDemo: authUser?.isDemo,
      selectedTab,
      isFetchingDocumentos,
      allAusenciasLength: allAusencias.length,
      cacheLastFetch: documentosSolicitadosGlobalCache.lastFetch,
      cacheTime: documentosSolicitadosGlobalCache.cacheTime,
      isFetching: documentosSolicitadosGlobalCache.isFetching
    });
    
    if (authUser?.isDemo || selectedTab !== 'ausencias' || isFetchingDocumentos) {
      console.log('⏭️ [fetchDocumentosSolicitadosForAusencias] Skipped - conditions not met');
      return;
    }

    // Verificăm cache-ul global pentru a evita apelurile duplicate
    // DAR: permitem fetch-ul dacă lista s-a schimbat (lungime diferită) sau dacă este primul request
    const now = Date.now();
    const listaChanged = allAusencias.length !== documentosSolicitadosGlobalCache.lastAusenciasLength;
    const cacheValid = documentosSolicitadosGlobalCache.lastFetch > 0 && 
                       now - documentosSolicitadosGlobalCache.lastFetch < documentosSolicitadosGlobalCache.cacheTime;
    
    if (cacheValid && !listaChanged) {
      console.log('⏭️ [fetchDocumentosSolicitadosForAusencias] Skipped - cache still valid and list unchanged');
      return;
    }
    
    if (listaChanged) {
      console.log('✅ [fetchDocumentosSolicitadosForAusencias] List changed, allowing fetch', {
        oldLength: documentosSolicitadosGlobalCache.lastAusenciasLength,
        newLength: allAusencias.length
      });
      documentosSolicitadosGlobalCache.lastAusenciasLength = allAusencias.length;
    }
    
    if (documentosSolicitadosGlobalCache.isFetching) {
      console.log('⏭️ [fetchDocumentosSolicitadosForAusencias] Skipped - already fetching');
      return;
    }
    
    console.log('✅ [fetchDocumentosSolicitadosForAusencias] Starting fetch...');

    setIsFetchingDocumentos(true);
    documentosSolicitadosGlobalCache.isFetching = true;
    documentosSolicitadosGlobalCache.lastFetch = now;
    try {
      // Obținem toate CODIGO-urile unice din ausencias
      const codigosUnicos = new Set();
      const ausenciasList = selectedUser === 'ALL' ? allAusencias : allAusencias.filter(a => a.CODIGO === selectedUser);
      
      ausenciasList.forEach(ausencia => {
        const codigo = ausencia.CODIGO || ausencia.codigo;
        if (codigo) codigosUnicos.add(codigo);
      });

      if (codigosUnicos.size === 0) {
        setDocumentosSolicitadosMap(new Map());
        return;
      }

      // Fetch documentos solicitados pentru fiecare codigo
      // Folosim procesare complet secvențială cu delay pentru a evita throttling
      const token = localStorage.getItem('auth_token');
      const documentosMap = new Map();
      const codigosArray = Array.from(codigosUnicos);
      
      // Procesăm complet secvențial (1 request la un moment dat) cu delay de 300ms între ele
      for (const codigo of codigosArray) {

        try {
          const url = routes.getDocumentosSolicitados(codigo);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          });

          if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                  // Filtrează doar justificantele (tipuri care conțin "justificante", "certificado médico" sau alte tipuri de justificante)
                  const justificantes = data.data.filter(doc => {
                    const tipo = (doc.tipo_documento || '').toLowerCase();
                    return tipo.includes('justificante') || 
                           tipo.includes('certificado médico') || 
                           tipo.includes('justificante médico') ||
                           tipo.includes('justificante de ausencia');
                  });

                  justificantes.forEach(doc => {
                    // Extrage tipul și data din notas pentru a crea key-ul corect
                    const notas = doc.notas || '';
                    let tipoAusencia = '';
                    let fechaAusencia = '';
                    
                    // Pattern: "Justificante para ausencia: TIPO - YYYY-MM-DD"
                    let match = notas.match(/Justificante para ausencia:\s*(.+?)\s*-\s*(\d{4}-\d{2}-\d{2})/i);
                    if (!match) {
                      // Pattern alternativ: "Justificante para ausencia: TIPO - DD/MM/YYYY"
                      match = notas.match(/Justificante para ausencia:\s*(.+?)\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
                      if (match) {
                        const fechaParts = match[2].trim().split('/');
                        if (fechaParts.length === 3) {
                          fechaAusencia = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                          tipoAusencia = match[1].trim();
                        }
                      }
                    } else {
                      tipoAusencia = match[1].trim();
                      fechaAusencia = match[2].trim();
                    }
                    
                    // Dacă am extras tipul și data, folosim key-ul complet
                    if (tipoAusencia && fechaAusencia) {
                      const key = `${codigo}_${tipoAusencia}_${fechaAusencia}`;
                      const keySinEspacios = `${codigo}_${tipoAusencia.replace(/\s+/g, '')}_${fechaAusencia}`;
                      
                      documentosMap.set(key, {
                        estado: doc.estado,
                        fecha_solicitud: doc.fecha_solicitud,
                        fecha_completado: doc.fecha_completado,
                        tipo_documento: doc.tipo_documento,
                        notas: doc.notas,
                        tipoAusencia: tipoAusencia,
                        fechaAusencia: fechaAusencia
                      });
                      
                      // Adăugăm și key-ul fără spații pentru matching flexibil
                      if (keySinEspacios !== key) {
                        documentosMap.set(keySinEspacios, {
                          estado: doc.estado,
                          fecha_solicitud: doc.fecha_solicitud,
                          fecha_completado: doc.fecha_completado,
                          tipo_documento: doc.tipo_documento,
                          notas: doc.notas,
                          tipoAusencia: tipoAusencia,
                          fechaAusencia: fechaAusencia
                        });
                      }
                    } else {
                      // Fallback: dacă nu putem extrage tipul și data, folosim key-ul vechi (pentru compatibilitate cu justificante vechi)
                      // NOTĂ: Acest fallback este folosit doar pentru justificante vechi care nu au tipul și data în notas
                      const key = `${codigo}_${doc.tipo_documento}`;
                      documentosMap.set(key, {
                        estado: doc.estado,
                        fecha_solicitud: doc.fecha_solicitud,
                        fecha_completado: doc.fecha_completado,
                        tipo_documento: doc.tipo_documento,
                        notas: doc.notas
                      });
                    }
                  });
                }
              }
            } catch (error) {
              console.warn(`Error fetching documentos solicitados for ${codigo}:`, error);
            }
            
            // Delay de 100ms între fiecare request pentru a evita throttling (optimizat pentru viteză maximă)
            if (codigosArray.indexOf(codigo) < codigosArray.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

      setDocumentosSolicitadosMap(documentosMap);
      // Actualizăm lungimea listei în cache după fetch-ul reușit
      documentosSolicitadosGlobalCache.lastAusenciasLength = allAusencias.length;
      console.log('✅ [fetchDocumentosSolicitadosForAusencias] Fetch completed successfully', {
        documentosMapSize: documentosMap.size,
        allAusenciasLength: allAusencias.length
      });
    } catch (error) {
      console.error('Error fetching documentos solicitados for ausencias:', error);
      setDocumentosSolicitadosMap(new Map());
    } finally {
      setIsFetchingDocumentos(false);
      documentosSolicitadosGlobalCache.isFetching = false;
    }
  }, [authUser?.isDemo, selectedTab, selectedUser, allAusencias, isFetchingDocumentos]);

  // Fetch documentos solicitados pentru ausencias când se schimbă tab-ul sau ausencias
  // Se declanșează imediat după ce allAusencias este încărcat (fără delay)
  useEffect(() => {
    console.log('🔍 [useEffect] Checking conditions for fetchDocumentosSolicitadosForAusencias', {
      selectedTab,
      canAccessAllTabs,
      allAusenciasLength: allAusencias.length,
      activeTab
    });
    
    if (selectedTab === 'ausencias' && canAccessAllTabs && allAusencias.length > 0) {
      console.log('✅ [useEffect] Triggering fetchDocumentosSolicitadosForAusencias (selectedTab)');
      // Fără delay - se declanșează imediat după ce lista este încărcată
      fetchDocumentosSolicitadosForAusencias();
    }
  }, [selectedTab, selectedUser, allAusencias.length, canAccessAllTabs, fetchDocumentosSolicitadosForAusencias, activeTab]);

  // Fetch documentos solicitados când se schimbă activeTab la 'todas' și selectedTab este 'ausencias'
  // Sau când se schimbă selectedUser în tab-ul 'todas'
  useEffect(() => {
    console.log('🔍 [useEffect] Checking conditions for fetchDocumentosSolicitadosForAusencias (activeTab)', {
      activeTab,
      selectedTab,
      canAccessAllTabs,
      allAusenciasLength: allAusencias.length
    });
    
    if (activeTab === 'todas' && selectedTab === 'ausencias' && canAccessAllTabs && allAusencias.length > 0) {
      console.log('✅ [useEffect] Triggering fetchDocumentosSolicitadosForAusencias (activeTab)');
      // Fără delay - se declanșează imediat după ce lista este încărcată
      fetchDocumentosSolicitadosForAusencias();
    }
  }, [activeTab, selectedTab, selectedUser, allAusencias.length, canAccessAllTabs, fetchDocumentosSolicitadosForAusencias]);

  // Justificantes por ausencia_id: ya no se precargan en Todas > Ausencias (comprobar bajo demanda)

  // Sub-tab Ausencias: por defecto filtrar por mes actual (no "Todas las meses")
  useEffect(() => {
    if (selectedTab === 'ausencias' && selectedMonth === 0) {
      const currentMonth = new Date().getMonth() + 1; // 1-12 (MONTHS[0]=Todas, MONTHS[1]=Enero, ...)
      setSelectedMonth(currentMonth);
    }
  }, [selectedTab, selectedMonth]);

  // Todas: documentos Baja Voluntaria al abrir ese sub-tab (justificantes ausencia: bajo demanda)
  useEffect(() => {
    if (activeTab !== 'todas' || !canAccessAllTabs || !allSolicitudes.length) return;
    if (selectedTab === 'baja_voluntaria') {
      fetchBajaVoluntariaDocumentos(allSolicitudes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run when tab/length change, not on every allSolicitudes reference
  }, [activeTab, canAccessAllTabs, selectedTab, allSolicitudes.length, fetchBajaVoluntariaDocumentos]);

  // Sincronizăm ref-ul cu state-ul pentru a păstra map-ul între render-uri
  useLayoutEffect(() => {
    justificantesPorAusenciaRef.current = justificantesPorAusencia;
  }, [justificantesPorAusencia]);

  // Justificante pentru cerere (CarpetasDocumentos) – reutilizabil după upload
  const fetchInitialJustificantes = useCallback(async () => {
    const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
    if (!userCode || authUser?.isDemo) return;
    try {
      const token = localStorage.getItem('auth_token');
      const url = `${routes.getDocumentos || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos`}?empleadoId=${encodeURIComponent(userCode)}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return;
      const data = await res.json();
      const docs = Array.isArray(data) ? data : (data?.data || []);
      const justificantes = docs.filter(d => {
        const t = (d.tipo_documento || '').toLowerCase();
        return t.includes('justificante') && !t.includes('presencia');
      });
      const map = new Map();
      justificantes.forEach(doc => {
        const fechaCreacion = doc.fecha_creacion;
        let fecha = '';
        if (fechaCreacion) {
          try {
            const d = new Date(fechaCreacion);
            if (!isNaN(d.getTime())) fecha = d.toISOString().split('T')[0];
          } catch {
            /* ignore invalid date */
          }
        }
        if (fecha) {
          if (!map.has(fecha)) map.set(fecha, []);
          map.get(fecha).push(doc);
        }
      });
      setInitialJustificantesPorFecha(map);
    } catch (e) {
      console.warn('Error fetching initial justificantes:', e);
    }
  }, [authUser]);

  // Fetch justificantele pentru utilizatorul curent (angajat sau manager) - pentru "Mis Solicitudes"
  // Se declanșează imediat după ce solicitudes este încărcat (fără delay)
  useEffect(() => {
    let isMounted = true;
    
    // Așteptăm ca lista să fie încărcată înainte de a face fetch pentru justificante
    if (activeTab !== 'lista') {
      return;
    }
    
    const fetchJustificantesPendientes = async () => {
      // Prevenim apelurile duplicate folosind cache global (funcționează în React Strict Mode)
      if (documentosSolicitadosGlobalCache.isFetching) {
        return;
      }
      
      // Verificăm cache-ul global pentru a evita apelurile duplicate în React Strict Mode
      const now = Date.now();
      if (now - documentosSolicitadosGlobalCache.lastFetch < documentosSolicitadosGlobalCache.cacheTime) {
        return;
      }
      
      // Permitem fetch-ul și pentru manageri pentru a vedea justificantele în "Mis Solicitudes"
      const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
      
      if (!userCode || authUser?.isDemo) {
        // Nu resetăm map-ul - păstrăm datele existente pentru a nu face justificantele să dispară
        return;
      }

      documentosSolicitadosGlobalCache.isFetching = true;
      documentosSolicitadosGlobalCache.lastFetch = now; // Actualizăm cache-ul global
      try {
        const token = localStorage.getItem('auth_token');
        const empleadoId = userCode;
        // Prefer new API (ausencia_justificantes): fetch by ausencia id. Para empleados (Mis Solicitudes) allAusencias puede estar vacío → obtener ausencias del usuario.
        const justificantesMapFromApi = new Map();
        let ausenciasList = (typeof allAusencias !== 'undefined' && Array.isArray(allAusencias))
          ? allAusencias.filter(a => (a.CODIGO || a.codigo) === userCode)
          : [];
        if (ausenciasList.length === 0) {
          try {
            const ausenciasRes = await fetch(`${routes.getAusencias || ''}?codigo=${encodeURIComponent(userCode)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (ausenciasRes.ok) {
              const ausenciasData = await ausenciasRes.json();
              ausenciasList = Array.isArray(ausenciasData) ? ausenciasData : (ausenciasData?.data || []);
            }
          } catch {
            /* ignore: ausencias fetch optional */
          }
        }
        for (const ausencia of ausenciasList) {
          const aid = ausencia.ausencia_id ?? ausencia.id;
          if (aid == null || !Number.isFinite(Number(aid))) continue;
          try {
            const jRes = await fetch(routes.getAusenciaJustificantes(Number(aid)), {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
            });
            if (!jRes.ok) continue;
            const rows = await jRes.json();
            if (!Array.isArray(rows) || rows.length === 0) continue;
            const tipoAusencia = ausencia.TIPO || ausencia.tipo || 'Ausencia';
            let fecha = (ausencia.FECHA || ausencia.fecha || ausencia.fecha_inicio || '').toString().trim();
            if (fecha.includes(' - ')) fecha = fecha.split(' - ')[0].trim();
            if (!fecha || fecha.length < 10) continue;
            const fechaNorm = fecha.substring(0, 10);
            rows.forEach(row => {
              const tipo = (row.tipo || '').toLowerCase();
              const keySuffix = tipo === 'presencia' ? '_presencia' : '';
              const key = `${tipoAusencia}_${fechaNorm}${keySuffix}`;
              const keySinEspacios = `${(tipoAusencia || '').replace(/\s+/g, '')}_${fechaNorm}${keySuffix}`;
              const estado = row.doc_solicitado_estado || (row.doc_id ? 'completado' : 'pendiente');
              const justificanteData = {
                estado,
                fecha_solicitud: row.created_at,
                fecha_completado: estado === 'completado' ? row.created_at : null,
                tipo_documento: row.doc_tipo_documento || row.doc_solicitado_tipo || (tipo === 'presencia' ? 'Justificante de presencia a la cita' : 'Justificante'),
                notas: row.doc_solicitado_notas,
                id: row.documento_solicitado_id ?? row.doc_id,
                tipoAusencia,
                fechaAusencia: fechaNorm,
                doc_id: row.doc_id ?? row.doc_ID,
                doc_nombre_archivo: row.doc_nombre_archivo ?? row.doc_NOMBRE_ARCHIVO ?? (tipo === 'presencia' ? 'Justificante presencia' : 'Justificante'),
              };
              justificantesMapFromApi.set(key, justificanteData);
              if (keySinEspacios !== key) justificantesMapFromApi.set(keySinEspacios, justificanteData);
            });
          } catch {
            /* ignore: justificantes API optional */
          }
        }

        const url = routes.getDocumentosSolicitados(empleadoId);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        // Dacă endpoint-ul nu există sau dacă e eroare 404/500, păstrăm datele existente (nu resetăm)
        if (response.status === 404 || response.status === 500) {
          // Nu resetăm map-ul - păstrăm datele existente pentru a nu face justificantele să dispară
          documentosSolicitadosGlobalCache.isFetching = false;
          return;
        }

        // Tratăm eroarea 429 (Too Many Requests) - reîncercăm după un delay
        if (response.status === 429) {
          console.warn('⚠️ [fetchJustificantesPendientes] 429 Too Many Requests - will retry');
          // Mărim cache-ul pentru a evita apelurile ulterioare
          documentosSolicitadosGlobalCache.cacheTime = 60000; // 60 secunde după 429
          documentosSolicitadosGlobalCache.lastFetch = Date.now();
          documentosSolicitadosGlobalCache.isFetching = false;
          
          // Reîncercăm după un delay progresiv (nu resetăm map-ul - păstrăm datele existente)
          if (isMounted && documentosSolicitadosGlobalCache.retryCount < documentosSolicitadosGlobalCache.maxRetries) {
            documentosSolicitadosGlobalCache.retryCount++;
            const retryDelay = 10000 * documentosSolicitadosGlobalCache.retryCount; // 10s, 20s, 30s
            console.log(`🔄 [fetchJustificantesPendientes] Will retry in ${retryDelay/1000}s (attempt ${documentosSolicitadosGlobalCache.retryCount}/${documentosSolicitadosGlobalCache.maxRetries})`);
            setTimeout(() => {
              if (isMounted && !documentosSolicitadosGlobalCache.isFetching) {
                fetchJustificantesPendientes();
              }
            }, retryDelay);
          } else {
            // Resetăm contorul după max retries
            console.warn('⚠️ [fetchJustificantesPendientes] Max retries reached, will try again later');
            documentosSolicitadosGlobalCache.retryCount = 0;
          }
          return;
        }
        
        // Resetăm contorul de retry la succes
        documentosSolicitadosGlobalCache.retryCount = 0;

        if (!response.ok) {
          console.warn(`Warning: Error HTTP ${response.status} al obtener justificantes pendientes`);
          // Nu resetăm map-ul - păstrăm datele existente pentru a nu face justificantele să dispară
          documentosSolicitadosGlobalCache.isFetching = false;
          return;
        }

        const data = await response.json();
        
        if (data.success && data.data && Array.isArray(data.data)) {
          console.log(`✅ [fetchJustificantesPendientes] Received ${data.data.length} documentos`);
          // Filtrează justificantele (pendiente și completadas) - similar cu tab-ul ausencias pentru manageri
          // Verificăm doar tipul, nu și estado-ul (pentru a include și completadas)
          const justificantes = data.data.filter(doc => {
            const tipo = (doc.tipo_documento || '').toLowerCase().trim();
            
            // Verificăm dacă este un tip de justificante
            const esJustificante = tipo.includes('justificante') || 
                                  tipo.includes('certificado médico') || 
                                  tipo.includes('certificado medico') ||
                                  tipo.includes('justificante médico') ||
                                  tipo.includes('justificante medico') ||
                                  tipo.includes('justificante de ausencia');
            
            return esJustificante;
          });
          
          console.log(`✅ [fetchJustificantesPendientes] Filtered ${justificantes.length} justificantes`);
          
          // Creează un map pentru asocierea justificantelor cu ausencias
          // SOLUȚIE GENERICĂ: Map-ul principal folosește doar data ca key (YYYY-MM-DD)
          // Astfel, orice justificante pentru aceeași dată vor fi asociate cu orice ausencia din acea dată
          const justificantesMapPorFecha = new Map(); // Map<fecha, justificante[]>
          const justificantesMapPorTipoYFecha = new Map(); // Map<tipo_fecha, justificante> - pentru matching exact
          
          justificantes.forEach(doc => {
            const notas = doc.notas || '';
            const tipoDoc = (doc.tipo_documento || '').toLowerCase();
            const esPresencia = tipoDoc.includes('presencia');
            
            // "Justificante de presencia a la cita (ausencia justificada aprobada) - 21/03/2026" sau " - 2026-03-21"
            let match = null;
            if (esPresencia) {
              match = notas.match(/Justificante de presencia[^)]*\)\s*-\s*(\d{4}-\d{2}-\d{2})/i);
              if (match) match = [match[0], 'Ausencias justificada', match[1]];
              if (!match) {
                match = notas.match(/Justificante de presencia[^)]*\)\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
                if (match) {
                  const fechaParts = match[1].trim().split('/');
                  if (fechaParts.length === 3) {
                    const fechaNorm = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                    match = [match[0], 'Ausencias justificada', fechaNorm];
                  }
                }
              }
            }
            if (!match) {
              // Extrage tipul și data din notas: "Justificante para ausencia: Salida Sin Regreso - 2026-01-05"
              match = notas.match(/Justificante para ausencia:\s*(.+?)\s*-\s*(\d{4}-\d{2}-\d{2})/i);
            }
            if (!match) {
              // Pattern alternativ: "Justificante para ausencia: TIPO - DD/MM/YYYY"
              match = notas.match(/Justificante para ausencia:\s*(.+?)\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
              if (match) {
                const fechaParts = match[2].trim().split('/');
                if (fechaParts.length === 3) {
                  const fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                  match = [match[0], match[1], fechaNormalizada];
                }
              }
            }
            
            if (match) {
              const tipoAusencia = match[1].trim();
              let fechaAusencia = match[2].trim();
              
              // Asigură-te că data este în format YYYY-MM-DD
              if (fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                const fechaParts = fechaAusencia.split('/');
                if (fechaParts.length === 3) {
                  fechaAusencia = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                }
              }
              
              // Adăugăm în map-ul generic (doar pe dată) - SOLUȚIE GENERICĂ
              if (!justificantesMapPorFecha.has(fechaAusencia)) {
                justificantesMapPorFecha.set(fechaAusencia, []);
              }
              const justificanteData = {
                estado: doc.estado,
                fecha_solicitud: doc.fecha_solicitud,
                fecha_completado: doc.fecha_completado,
                tipo_documento: doc.tipo_documento,
                notas: doc.notas,
                id: doc.id,
                tipoAusencia: tipoAusencia, // Păstrăm tipul pentru referință
                fechaAusencia: fechaAusencia // Asigură-te că data este normalizată în YYYY-MM-DD
              };
              justificantesMapPorFecha.get(fechaAusencia).push(justificanteData);
              
              // Key pentru matching: dacă e "Justificante de presencia" folosim sufix _presencia ca să nu suprascriem justificantele pentru cerere
              const keySuffix = esPresencia ? '_presencia' : '';
              const key = `${tipoAusencia}_${fechaAusencia}${keySuffix}`;
              justificantesMapPorTipoYFecha.set(key, justificanteData);
              
              const keySinEspacios = `${tipoAusencia.replace(/\s+/g, '')}_${fechaAusencia}${keySuffix}`;
              if (keySinEspacios !== key) {
                justificantesMapPorTipoYFecha.set(keySinEspacios, justificanteData);
              }
            }
          });
          
          // Combinăm: prefer date din noul API (ausencia_justificantes), apoi map-ul din documentos solicitados
          const justificantesMap = new Map();
          // 1) Date din noul API (by ausencia_id) au prioritate
          justificantesMapFromApi.forEach((value, key) => {
            justificantesMap.set(key, value);
          });
          // 2) Adăugăm key-uri din map-ul exact (tipo_fecha) doar dacă nu există deja
          justificantesMapPorTipoYFecha.forEach((value, key) => {
            if (!justificantesMap.has(key)) justificantesMap.set(key, value);
          });
          // 3) Key-uri pe dată (fără tip) pentru matching flexibil
          justificantesMapPorFecha.forEach((justificantesArray, fecha) => {
            if (justificantesArray && justificantesArray.length > 0 && !justificantesMap.has(fecha)) {
              justificantesMap.set(fecha, justificantesArray[0]);
            }
          });
          
          // IMPORTANT: Actualizăm ref-ul ÎNTOTDEAUNA (chiar dacă componenta nu este montată)
          // Ref-ul este folosit pentru lookup sincron, deci trebuie actualizat imediat
          const newMap = new Map(justificantesMap);
          justificantesPorAusenciaRef.current = newMap;
          
          console.log(`✅ [fetchJustificantesPendientes] Map updated with ${newMap.size} entries`);
          // Log first few entries for debugging
          if (newMap.size > 0) {
            const firstEntries = Array.from(newMap.entries()).slice(0, 3);
            console.log('📋 [fetchJustificantesPendientes] First entries:', firstEntries);
          }
          
          // Actualizăm state-ul DOAR dacă componenta este montată (pentru a evita memory leaks)
          if (isMounted) {
            setJustificantesPorAusencia(newMap);
          }
        } else {
          // Nu resetăm map-ul dacă nu există date - păstrăm datele existente
          // (poate că datele nu s-au încărcat încă, dar nu vrem să ștergem ce avem deja)
        }
      } catch (error) {
        console.warn('Warning: Error obteniendo justificantes pendientes:', error);
        // Nu resetăm map-ul la erori - păstrăm datele existente pentru a nu face justificantele să dispară
      } finally {
        documentosSolicitadosGlobalCache.isFetching = false;
      }
    };

    // DEZACTIVAT: Polling-ul este dezactivat complet pentru a evita erorile 429
    const interval = null;
    
    // Declanșăm fetch-ul imediat după ce lista este încărcată (fără delay)
    // Verificăm cache-ul pentru a evita duplicatele
    if (solicitudes.length > 0) {
      const now = Date.now();
      const shouldFetchImmediately = documentosSolicitadosGlobalCache.lastFetch === 0 || 
                                      (now - documentosSolicitadosGlobalCache.lastFetch >= documentosSolicitadosGlobalCache.cacheTime);
      
      if (shouldFetchImmediately && !documentosSolicitadosGlobalCache.isFetching) {
        // Fără delay - se declanșează imediat după ce lista este încărcată
        fetchJustificantesPendientes();
      }
      fetchInitialJustificantes();
    }
    
    // Return cleanup
    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [authUser, activeTab, solicitudes.length, fetchInitialJustificantes, allAusencias]);

  // Funcția handleSolicitarJustificante a fost eliminată - folosim handleRecordarJustificante direct

  const validateDates = (isManagerMode = false) => {
    // Pentru BAJA_VOLUNTARIA nu avem nevoie de fecha_inicio și fecha_fin
    if (tipo !== 'BAJA_VOLUNTARIA' && (!fechaInicio || !fechaFin)) {
      setErrorMsg('Por favor, selecciona las fechas de inicio y fin');
      return false;
    }

    // În modul manager, verificăm doar că fecha_fin >= fecha_inicio
    if (isManagerMode) {
      if (tipo !== 'BAJA_VOLUNTARIA' && fechaInicio && fechaFin) {
        const [y1, m1, d1] = fechaInicio.split('-').map(Number);
        const [y2, m2, d2] = fechaFin.split('-').map(Number);
        const start = new Date(y1, m1 - 1, d1);
        const end = new Date(y2, m2 - 1, d2);
        if ((end - start) < 0) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
      }
      return true; // Toate celelalte validări sunt ignorate în modul manager
    }

    const [y1, m1, d1] = fechaInicio.split('-').map(Number);
    const [y2, m2, d2] = fechaFin.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if any day in range is in a blocked period (6 Dic - 6 Ene or periodos bloqueados)
    if (tipo === 'Vacaciones' && editingSolicitud === null) {
      const checkBlock = new Date(start);
      checkBlock.setHours(0, 0, 0, 0);
      const endCheckBlock = new Date(end);
      endCheckBlock.setHours(0, 0, 0, 0);
      while (checkBlock <= endCheckBlock) {
        const dateStr = checkBlock.toISOString().split('T')[0];
        if (isInHolidayBlockPeriod(dateStr)) {
          setErrorMsg('El rango incluye días bloqueados (período empleada 6 Dic - 6 Ene o periodos bloqueados en gestión). Elige solo días permitidos.');
          return false;
        }
        checkBlock.setDate(checkBlock.getDate() + 1);
      }
    }
    if (isTipoAsuntoPropio(tipo) && editingSolicitud === null) {
      const checkAp = new Date(start);
      checkAp.setHours(0, 0, 0, 0);
      const endCheckAp = new Date(end);
      endCheckAp.setHours(0, 0, 0, 0);
      while (checkAp <= endCheckAp) {
        const dateStr = checkAp.toISOString().split('T')[0];
        if (isInAsuntoPropioCalendarBlock(dateStr)) {
          setErrorMsg(
            'El rango incluye días bloqueados para Asuntos Propios (período empleada 6 Dic - 6 Ene o periodos configurados en gestión). Elige solo días permitidos.',
          );
          return false;
        }
        checkAp.setDate(checkAp.getDate() + 1);
      }
    }

    // No permitir rango que incluya días sin disponibilidad (ocupados / bloqueados)
    if (editingSolicitud === null && (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios')) {
      const check = new Date(start);
      check.setHours(0, 0, 0, 0);
      const endCheck = new Date(end);
      endCheck.setHours(0, 0, 0, 0);
      while (check <= endCheck) {
        const dateStr = check.toISOString().split('T')[0];
        if (dateAvailability[dateStr]?.isFull) {
          setErrorMsg('El rango seleccionado incluye días sin disponibilidad (ocupados por otras solicitudes o bloqueados). Por favor, elige solo días disponibles.');
          return false;
        }
        check.setDate(check.getDate() + 1);
      }
    }

    // Calculează zilele din solicitarea originală dacă se editează
    let originalDays = 0;
    if (editingSolicitud !== null && originalSolicitudData) {
      let originalFechaInicio = '';
      let originalFechaFin = '';
      
      // Gestionează FECHA combinată sau separate
      if (originalSolicitudData.FECHA && originalSolicitudData.FECHA.includes(' - ')) {
        const [inicio, fin] = originalSolicitudData.FECHA.split(' - ');
        originalFechaInicio = inicio.trim();
        originalFechaFin = fin.trim();
      } else {
        originalFechaInicio = originalSolicitudData.fecha_inicio || '';
        originalFechaFin = originalSolicitudData.fecha_fin || '';
      }
      
      if (originalFechaInicio && originalFechaFin) {
        const originalStart = new Date(originalFechaInicio);
        const originalEnd = new Date(originalFechaFin);
        originalDays = Math.ceil((originalEnd - originalStart) / (1000 * 60 * 60 * 24)) + 1;
        
        console.log('🔍 Validare editare:', {
          editingSolicitud,
          originalSolicitudData,
          originalFechaInicio,
          originalFechaFin,
          originalDays,
          tipo,
          totalVacacionesDays,
          totalAsuntoPropioDays
        });
      }
    }

    // Validare Asunto Propio
    if (tipo === 'Asuntos Propios') {
      // Verifică dacă utilizatorul are drepturi reale în baza de date
      if ((asuntosPropiosSaldo.dias_anuales || 0) <= 0) {
        setErrorMsg('No tienes derechos de Asuntos Propios asignados. Contacta con tu administrador.');
        return false;
      }
      
      // Când se editează o solicitare, ignorăm validările de limite (șeful poate alege orice dată)
      const isEditing = editingSolicitud !== null;
      
      if (!isEditing) {
        // Calculează totalul ajustat (exclude zilele din solicitarea originală dacă se editează și tipul se potrivește)
        const shouldExcludeOriginal = editingSolicitud !== null && 
          originalSolicitudData && 
          (originalSolicitudData.tipo === 'Asunto Propio' || originalSolicitudData.tipo === 'Asuntos Propios');
        const adjustedTotal = shouldExcludeOriginal 
          ? totalAsuntoPropioDays - originalDays 
          : totalAsuntoPropioDays;
        
        // Verifică dacă s-a ajuns la limita de 6 zile pe an
        if (adjustedTotal >= 6) {
          setErrorMsg('Has alcanzado el límite de 6 días de Asunto Propio para este año. No puedes solicitar más días de este tipo.');
          return false;
        }
        
        // Normalizăm orele la 00:00:00 pentru a evita probleme de timezone
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diffStart = (start - today) / (1000 * 60 * 60 * 24);
        const diffMs = end.getTime() - start.getTime();
        const diffZile = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

        if (diffStart < 5) {
          setErrorMsg('No es posible solicitar un día de asunto propio con menos de 5 días de antelación.');
          return false;
        }
        if (diffZile > 6) {
          setErrorMsg('No puedes solicitar más de 6 días de asuntos propios de una vez.');
          return false;
        }
        if (diffZile < 1) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
        
        // Verifică dacă noua solicitare nu depășește limita de 6 zile pe an (folosind totalul ajustat)
        if (adjustedTotal + diffZile > 6) {
          setErrorMsg(`No puedes solicitar ${diffZile} días adicionales. Ya tienes ${adjustedTotal} días de Asunto Propio. El límite es de 6 días por año.`);
          return false;
        }
      } else {
        // La editare, doar verificăm că datele sunt valide (fecha fin >= fecha inicio)
        // Normalizăm orele la 00:00:00 pentru consistență
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diffMs = end.getTime() - start.getTime();
        const diffZile = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        if (diffZile < 1) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
      }
    }

    // Validare Vacaciones
    if (tipo === 'Vacaciones') {
      // Verifică dacă utilizatorul are zile disponibile
      const hasVacacionesRights = (vacacionesSaldo.dias_restantes || 0) > 0 || (vacacionesSaldo.dias_anuales || 0) > 0;
      if (!hasVacacionesRights) {
        setErrorMsg('No tienes días de vacaciones disponibles. Contacta con tu administrador.');
        return false;
      }
      
      // Când se editează o solicitare, ignorăm validările de limite (șeful poate alege orice dată)
      const isEditing = editingSolicitud !== null;
      
      if (!isEditing) {
        // Calculează totalul ajustat (exclude zilele din solicitarea originală dacă se editează și tipul se potrivește)
        const shouldExcludeOriginal = editingSolicitud !== null && 
          originalSolicitudData && 
          originalSolicitudData.tipo === 'Vacaciones';
        const adjustedTotal = shouldExcludeOriginal 
          ? totalVacacionesDays - originalDays 
          : totalVacacionesDays;
        
        // Calculează limita maximă reală: zile anuale + zile din anul trecut
        const limitaMaxima = (vacacionesSaldo.dias_anuales || 31) + (vacacionesSaldo.dias_restantes_ano_anterior || 0);
        
        // Verifică dacă s-a ajuns la limita maximă
        if (adjustedTotal >= limitaMaxima) {
          setErrorMsg(`Has alcanzado el límite de ${limitaMaxima} días de Vacaciones (${vacacionesSaldo.dias_anuales || 31} días anuales + ${vacacionesSaldo.dias_restantes_ano_anterior || 0} días del año anterior). No puedes solicitar más días de este tipo.`);
          return false;
        }
        
        // Folosim același calcul ca în calculateDays pentru consistență
        // Normalizăm orele la 00:00:00 pentru a evita probleme de timezone
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diffMs = end.getTime() - start.getTime();
        const diffZile = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        
        if ((end - start) < 0) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
        
        // Verifică dacă utilizatorul are certificat de handicap confirmat
        // Dacă are, permite orice număr de zile (nu doar quincena sau luna întreagă)
        const tieneCertificadoHandicap = empleadoCompleto?.certificado_handicap_confirmado === true ||
                                         empleadoCompleto?.certificado_handicap_confirmado === 1 ||
                                         authUser?.certificado_handicap_confirmado === true ||
                                         authUser?.certificado_handicap_confirmado === 1;
        
        if (!tieneCertificadoHandicap && ![15, 30, 31].includes(diffZile)) {
          setErrorMsg('Solo puedes solicitar vacaciones por quincena (15 días) o mes entero.');
          return false;
        }

        // Misma persona: margen 15 días antes/después de otra quincena (Aprobada o Pendiente)
        const QUINCENA_BUFFER_DAYS = 15;
        const userCodeVac = authUser?.['CODIGO'] || authUser?.codigo || '';
        const ownVac = solicitudes.filter(
          (s) =>
            s.tipo === 'Vacaciones' &&
            (s.estado === 'Aprobada' || s.estado === 'Pendiente') &&
            s.fecha_inicio &&
            s.fecha_fin &&
            String(s.codigo) === String(userCodeVac)
        );
        const n0 = new Date(y1, m1 - 1, d1);
        const n1 = new Date(y2, m2 - 1, d2);
        n0.setHours(0, 0, 0, 0);
        n1.setHours(0, 0, 0, 0);
        for (const s of ownVac) {
          const a = new Date(s.fecha_inicio);
          const b = new Date(s.fecha_fin);
          a.setHours(0, 0, 0, 0);
          b.setHours(0, 0, 0, 0);
          const bs = new Date(a);
          bs.setDate(bs.getDate() - QUINCENA_BUFFER_DAYS);
          const be = new Date(b);
          be.setDate(be.getDate() + QUINCENA_BUFFER_DAYS);
          if (n0 <= be && n1 >= bs) {
            const fi = String(s.fecha_inicio).split('T')[0];
            const ff = String(s.fecha_fin).split('T')[0];
            setErrorMsg(
              `No puedes solicitar estas fechas: debe respetarse un margen de ${QUINCENA_BUFFER_DAYS} días antes y después de otra quincena ya solicitada o aprobada (${fi} - ${ff}).`
            );
            return false;
          }
        }
        
        // Verifică dacă noua solicitare nu depășește limita maximă reală (folosind totalul ajustat)
        if (adjustedTotal + diffZile > limitaMaxima) {
          setErrorMsg(`No puedes solicitar ${diffZile} días adicionales. Ya tienes ${adjustedTotal} días de Vacaciones. El límite máximo es de ${limitaMaxima} días (${vacacionesSaldo.dias_anuales || 31} días anuales + ${vacacionesSaldo.dias_restantes_ano_anterior || 0} días del año anterior).`);
          return false;
        }
      } else {
        // La editare, doar verificăm că datele sunt valide (fecha fin >= fecha inicio)
        if ((end - start) < 0) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
      }
    }

    return true;
  };

  // Funcții pentru BAJA_VOLUNTARIA
  const handlePreviewBajaVoluntaria = async (solicitud) => {
    try {
      setOperationLoading('preview', true);
      const token = localStorage.getItem('auth_token');
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      
      const response = await fetch(`${endpoint}/baja-voluntaria/${solicitud.id}/preview-pdf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('Error al generar el PDF');
      }

      const blob = await response.blob();
      const pdfUrl = URL.createObjectURL(blob);
      
      setBajaVoluntariaPreview({
        isOpen: true,
        solicitud: solicitud,
        pdfUrl: pdfUrl,
      });
    } catch (error) {
      console.error('Error al generar preview PDF:', error);
      setErrorMsg('Error al generar el preview del PDF');
    } finally {
      setOperationLoading('preview', false);
    }
  };

  const handleApproveBajaVoluntaria = async (solicitud) => {
    try {
      setOperationLoading('approve', true);
      const token = localStorage.getItem('auth_token');
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      
      const data = {
        accion: 'update',
        id: solicitud.id,
        estado: 'Aprobada',
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al aprobar la baja voluntaria');
      }

      const result = await response.json();
      const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

      if (response.ok && (responseData?.success === true || responseData?.status === 'ok' || responseData?.solicitud_ok === 1)) {
        setSuccessMsg('Baja voluntaria aprobada y enviada a gestoria correctamente.');
        // Reîncarcă listele
        setTimeout(() => {
          fetchSolicitudes();
          if (isManager) {
            fetchAllSolicitudes();
          }
        }, 1000);
      } else {
        setErrorMsg('No se pudo aprobar la baja voluntaria.');
      }
    } catch (error) {
      console.error('Error al aprobar baja voluntaria:', error);
      setErrorMsg('Error al aprobar la baja voluntaria');
    } finally {
      setOperationLoading('approve', false);
    }
  };

  const handleRejectBajaVoluntaria = async (solicitud) => {
    try {
      setOperationLoading('reject', true);
      const token = localStorage.getItem('auth_token');
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      
      const data = {
        accion: 'update',
        id: solicitud.id,
        estado: 'Rechazada',
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al rechazar la baja voluntaria');
      }

      const result = await response.json();
      const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

      if (response.ok && (responseData?.success === true || responseData?.status === 'ok' || responseData?.solicitud_ok === 1)) {
        setSuccessMsg('Baja voluntaria rechazada correctamente.');
        // Reîncarcă listele
        setTimeout(() => {
          fetchSolicitudes();
          if (isManager) {
            fetchAllSolicitudes();
          }
        }, 1000);
      } else {
        setErrorMsg('No se pudo rechazar la baja voluntaria.');
      }
    } catch (error) {
      console.error('Error al rechazar baja voluntaria:', error);
      setErrorMsg('Error al rechazar la baja voluntaria');
    } finally {
      setOperationLoading('reject', false);
    }
  };

  // Funcții pentru aprobare/rechazare Permiso Retribuido
  const handleApprovePermisoRetribuido = async (solicitud) => {
    try {
      setOperationLoading('approve-permiso', true);
      const token = localStorage.getItem('auth_token');
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      
      const data = {
        accion: 'update',
        id: solicitud.id || solicitud.ID,
        estado: 'Aprobada',
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al aprobar el permiso retribuido');
      }

      const result = await response.json();
      const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

      if (response.ok && (responseData?.success === true || responseData?.status === 'ok' || responseData?.solicitud_ok === 1)) {
        setSuccessMsg('Permiso retribuido aprobado correctamente.');
        // Reîncarcă listele
        setTimeout(() => {
          fetchSolicitudes();
          if (isManager) {
            fetchAllSolicitudes();
          }
        }, 1000);
      } else {
        setErrorMsg('No se pudo aprobar el permiso retribuido.');
      }
    } catch (error) {
      console.error('Error al aprobar permiso retribuido:', error);
      setErrorMsg('Error al aprobar el permiso retribuido');
    } finally {
      setOperationLoading('approve-permiso', false);
    }
  };

  const handleApproveAusenciaJustificada = async (solicitud) => {
    try {
      setOperationLoading('approve-ausencia', true);
      const token = localStorage.getItem('auth_token');
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      const data = { accion: 'update', id: solicitud.id || solicitud.ID, estado: 'Aprobada' };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Error al aprobar la ausencia justificada');
      const result = await response.json();
      const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;
      if (response.ok && (responseData?.success === true || responseData?.status === 'ok' || responseData?.solicitud_ok === 1)) {
        setSuccessMsg('Ausencia justificada aprobada correctamente.');
        // Crear "Solicitud de Documento" para que el empleado suba justificante de presencia a la cita (diferente del justificante de la cita subido al solicitar)
        try {
          const codigoEmpleado = solicitud.codigo || solicitud.CODIGO || '';
          const token = localStorage.getItem('auth_token');
          const fechaNorm = (solicitud.fecha_inicio || solicitud.FECHA || '').split('-').reverse().join('/') || new Date().toLocaleDateString('es-ES');
          const notas = `Justificante de presencia a la cita (ausencia justificada aprobada) - ${fechaNorm}`;
          const ausenciaId = solicitud.ausencia_id ?? solicitud.ausencias?.[0]?.id ?? solicitud.firstAusenciaId;
          await fetch(routes.createDocumentoSolicitado, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
            body: JSON.stringify({
              empleado_id: codigoEmpleado,
              tipo_documento: 'Justificante de presencia a la cita',
              notas,
              ...(ausenciaId != null && Number.isFinite(Number(ausenciaId)) && { ausencia_id: Number(ausenciaId) }),
            }),
          });
        } catch (e) {
          console.warn('No se pudo crear solicitud de documento tras aprobar ausencia:', e);
        }
        setTimeout(() => { fetchSolicitudes(); if (isManager) fetchAllSolicitudes(); }, 1000);
      } else {
        setErrorMsg('No se pudo aprobar la ausencia justificada.');
      }
    } catch (error) {
      console.error('Error al aprobar ausencia justificada:', error);
      setErrorMsg('Error al aprobar la ausencia justificada');
    } finally {
      setOperationLoading('approve-ausencia', false);
    }
  };

  const handleRejectPermisoRetribuidoClick = (solicitud) => {
    const tipo = (solicitud.tipo || solicitud.TIPO || '').toLowerCase();
    const tipoSolicitud = (tipo.includes('ausencias') && tipo.includes('justificada')) ? 'Ausencias justificada' : 'Permiso Retribuido';
    setRejectPermisoModal({ isOpen: true, solicitud, mensaje: '', tipoSolicitud });
  };

  const handleRejectSolicitudPendiente = async () => {
    if (!rejectPermisoModal.solicitud) return;
    
    try {
      setOperationLoading('reject-permiso', true);
      const token = localStorage.getItem('auth_token');
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      
      const data = {
        accion: 'update',
        id: rejectPermisoModal.solicitud.id || rejectPermisoModal.solicitud.ID,
        estado: 'Rechazada',
        mensajePersonalizado: rejectPermisoModal.mensaje || undefined,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al rechazar el permiso retribuido');
      }

      const result = await response.json();
      const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

      if (response.ok && (responseData?.success === true || responseData?.status === 'ok' || responseData?.solicitud_ok === 1)) {
        setSuccessMsg('Solicitud rechazada correctamente.');
        setRejectPermisoModal({ isOpen: false, solicitud: null, mensaje: '', tipoSolicitud: 'Permiso Retribuido' });
        // Reîncarcă listele
        setTimeout(() => {
          fetchSolicitudes();
          if (isManager) {
            fetchAllSolicitudes();
          }
        }, 1000);
      } else {
        setErrorMsg('No se pudo rechazar el permiso retribuido.');
      }
    } catch (error) {
      console.error('Error al rechazar permiso retribuido:', error);
      setErrorMsg('Error al rechazar el permiso retribuido');
    } finally {
      setOperationLoading('reject-permiso', false);
    }
  };

  const handleAdd = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setServerResp('');

    if (!validateDates()) {
      return;
    }

    // Validare motivo obligatoriu când se editează
    if (editingSolicitud !== null && !motivo.trim()) {
      setErrorMsg('El motivo es obligatorio al editar una solicitud.');
      return;
    }

    // Validare fecha_ultimo_dia_trabajo pentru BAJA_VOLUNTARIA
    if (tipo === 'BAJA_VOLUNTARIA' && !fechaUltimoDiaTrabajo) {
      setErrorMsg('El último día de trabajo es obligatorio para Baja Voluntaria.');
      return;
    }

    // Validare Ausencia justificada: toate câmpurile obligatorii (mai puțin Motivo general)
    if (tipo === 'Ausencias justificada') {
      if (!tipoJustificante || !tipoJustificante.trim()) {
        setErrorMsg('El tipo de justificante es obligatorio.');
        return;
      }
      if (!fechaInicio || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
        setErrorMsg('La fecha de la ausencia es obligatoria.');
        return;
      }
      if (tipoJustificante === 'otro') {
        if (!descripcionOtro.trim()) {
          setErrorMsg('Describe el motivo es obligatorio cuando el tipo es "Otro".');
          return;
        }
      }
      if (!archivoJustificante) {
        setErrorMsg('Adjuntar justificante es obligatorio.');
        return;
      }
    }

    setOperationLoading('submit', true);
    
    const tipoPayload = tipo === 'Asuntos Propios' ? 'Asunto Propio' : tipo;
    const isEditing = editingSolicitud !== null;
    
    // Când se editează, folosește datele din solicitarea originală, altfel datele utilizatorului logat
    let solicitudEmail = email;
    let solicitudCodigo = authUser?.['CODIGO'] || authUser?.codigo || '';
    let solicitudNombre = authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || '';
    
    if (isEditing && originalSolicitudData) {
      // Caută solicitarea originală pentru a obține email, codigo, nombre
      const originalSolicitud = [...solicitudes, ...allSolicitudes].find(s => s.id === editingSolicitud);
      if (originalSolicitud) {
        solicitudEmail = originalSolicitud.email || email;
        solicitudCodigo = originalSolicitud.codigo || originalSolicitud.CODIGO || solicitudCodigo;
        solicitudNombre = originalSolicitud.nombre || originalSolicitud.NOMBRE || solicitudNombre;
      }
    }
    
    const data = {
      accion: isEditing ? 'update' : 'create',
      id: isEditing ? editingSolicitud : Date.now(),
      email: solicitudEmail,
      codigo: solicitudCodigo,
      nombre: solicitudNombre,
      tipo: tipoPayload,
      // BAJA_VOLUNTARIA, Permiso Retribuido și Ausencias justificada cerute de angajați trebuie aprobate de manager
      estado: (tipoPayload === 'BAJA_VOLUNTARIA' || tipoPayload === 'Permiso Retribuido' || tipoPayload === 'Ausencias justificada') ? 'Pendiente' : 'Aprobada',
      motivo,
      // Pentru BAJA_VOLUNTARIA, nu trimitem fecha_inicio și fecha_fin
      ...(tipoPayload !== 'BAJA_VOLUNTARIA' ? {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      } : {
        fecha_inicio: fechaUltimoDiaTrabajo, // Folosim fecha_ultimo_dia_trabajo ca fecha_inicio pentru compatibilitate
        fecha_fin: fechaUltimoDiaTrabajo, // Folosim fecha_ultimo_dia_trabajo ca fecha_fin pentru compatibilitate
      }),
      ...(tipoPayload === 'BAJA_VOLUNTARIA' && fechaUltimoDiaTrabajo ? {
        fecha_ultimo_dia_trabajo: fechaUltimoDiaTrabajo
      } : {}),
      ...(tipoPayload === 'Ausencias justificada' ? {
        tipo_justificante: tipoJustificante,
        hora_cita: horaCita || null,
        centro_medico: centroMedico || null,
        descripcion_otro: tipoJustificante === 'otro' ? descripcionOtro : null,
        archivo_justificante_nombre: archivoJustificante ? archivoJustificante.name : null,
      } : {}),
    };

    console.log('TRIMIT:', data);
    console.log('DEBUG authUser:', authUser);
    console.log('DEBUG codigo from authUser:', authUser?.['CODIGO'], authUser?.codigo);
    console.log('DEBUG isEditing:', isEditing);
    console.log('DEBUG accion:', data.accion);

    try {
      // Folosește backend-ul nou pentru create/update
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      
      const result = await callApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      // Procesează răspunsul: poate fi array cu { status: "ok", ... } sau { success: true } sau obiect direct
      let responseData = result.data;
      if (Array.isArray(responseData) && responseData.length > 0) {
        responseData = responseData[0];
      }
      
      console.log('🔍 Response processing:', { result, responseData, isEditing });
      
      // Verifică dacă operația a reușit
      // Pentru create: { success: true }
      // Pentru update: { status: "ok", solicitud_ok: 1 }
      // Dacă result.success este true, consideră că operația a reușit
      // Sau dacă responseData are success: true sau status: "ok"
      const isSuccess = result.success || 
        (responseData && (responseData.success === true || responseData.status === 'ok' || responseData.solicitud_ok === 1));
      
      console.log('🔍 isSuccess:', isSuccess);

      if (isSuccess) {
        // Log crearea sau actualizarea solicitării
        if (isEditing) {
          await activityLogger.logAction('solicitud_updated', {
            solicitud_id: responseData?.solicitud_id || editingSolicitud,
            data: data,
            user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
            email: authUser?.email
          });
          setSuccessMsg('Solicitud actualizada correctamente.');
        } else {
          await activityLogger.logSolicitudCreated(data, authUser);
          setSuccessMsg('Solicitud enviada correctamente.');
          
          // Dacă este BAJA_VOLUNTARIA și există document, încarcă-l
          if (tipoPayload === 'BAJA_VOLUNTARIA' && bajaVoluntariaDocumento) {
            try {
              const codigoEmpleado = authUser?.['CODIGO'] || authUser?.codigo || '';
              const token = localStorage.getItem('auth_token');
              
              const formData = new FormData();
              formData.append('archivo_0', bajaVoluntariaDocumento);
              formData.append('empleado_id', codigoEmpleado);
              formData.append('empleado_nombre', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre');
              formData.append('empleado_email', authUser?.['CORREO ELECTRONICO'] || authUser?.email || '');
              formData.append('tipo_documento', 'Baja Voluntaria');
              formData.append('fecha_upload', new Date().toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Europe/Madrid'
              }));
              formData.append('archivo_0_nombre', bajaVoluntariaDocumento.name);
              formData.append('archivo_0_tamaño', bajaVoluntariaDocumento.size.toString());
              formData.append('archivo_0_tipo', bajaVoluntariaDocumento.type);
              
              const uploadResponse = await fetch(routes.uploadDocumento, {
                method: 'POST',
                headers: {
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: formData,
              });
              
              if (uploadResponse.ok) {
                console.log('✅ Documento de Baja Voluntaria subido correctamente');
              } else {
                console.warn('⚠️ No se pudo subir el documento de Baja Voluntaria:', await uploadResponse.text());
              }
            } catch (uploadError) {
              console.error('❌ Error al subir documento de Baja Voluntaria:', uploadError);
              // Nu aruncăm eroarea pentru a nu opri flow-ul principal
            }
          } else if (tipoPayload === 'Ausencias justificada' && archivoJustificante) {
            // Subir el archivo a CarpetasDocumentos y, si hay ausencia_id (solicitud creada Aprobada), vincular en ausencia_justificantes
            try {
              const codigoEmpleado = authUser?.['CODIGO'] || authUser?.codigo || '';
              const token = localStorage.getItem('auth_token');
              const tipoDocumento = 'Justificante';
              const formData = new FormData();
              formData.append('archivo_0', archivoJustificante);
              formData.append('empleado_id', codigoEmpleado);
              formData.append('empleado_nombre', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre');
              formData.append('empleado_email', authUser?.['CORREO ELECTRONICO'] || authUser?.email || '');
              formData.append('tipo_documento', tipoDocumento);
              formData.append('fecha_upload', new Date().toLocaleString('es-ES', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Madrid'
              }));
              formData.append('archivo_0_nombre', archivoJustificante.name);
              formData.append('archivo_0_tamaño', archivoJustificante.size.toString());
              formData.append('archivo_0_tipo', archivoJustificante.type);
              const ausenciaIdFromCreate = responseData?.ausencia_id ?? responseData?.ausenciaId;
              if (ausenciaIdFromCreate != null && Number.isFinite(Number(ausenciaIdFromCreate))) {
                formData.append('ausencia_id', String(ausenciaIdFromCreate));
              }
              const uploadResp = await fetch(routes.uploadDocumento, {
                method: 'POST',
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                body: formData,
              });
              if (!uploadResp.ok) {
                const err = await uploadResp.json().catch(() => ({}));
                console.warn('⚠️ No se pudo subir el justificante:', err.error || uploadResp.statusText);
              }
            } catch (uploadError) {
              console.error('❌ Error al subir justificante ausencia:', uploadError);
            }
          }
        }
        setServerResp(`Status: ${responseData?.status || 'ok'} - Solicitud ${isEditing ? 'actualizada' : 'guardada'} exitosamente`);
        
        // Reset form
        setTipo('Asuntos Propios');
        setFechaInicio('');
        setFechaFin('');
        setFechaUltimoDiaTrabajo('');
        setBajaVoluntariaDocumento(null);
        setMotivo('');
        setTipoJustificante('');
        setHoraCita('');
        setCentroMedico('');
        setDescripcionOtro('');
        setArchivoJustificante(null);
        setEditingSolicitud(null);
        setOriginalSolicitudData(null);
        
        // Reîncarcă listele de solicitări
        setTimeout(() => {
          fetchSolicitudes();
          if (isManager) {
            fetchAllSolicitudes();
          }
        }, 1000);
      } else {
        setErrorMsg('No se pudo guardar la solicitud.');
        setServerResp(`Error: ${result.error || responseData?.error || 'Error desconocido'}`);
      }
    } catch (e) {
      setErrorMsg('No se pudo guardar la solicitud en línea');
      setServerResp('Error: ' + (e.message || e.toString()));
    } finally {
      // Oprește loading-ul întotdeauna, indiferent de rezultat
      setOperationLoading('submit', false);
    }
  };

  // Funcție pentru manager să creeze solicitări pentru angajați
  const handleAddManagerSolicitud = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setServerResp('');

    // Verifică dacă este selectat un angajat
    if (!managerSelectedEmpleado) {
      setErrorMsg('Por favor, selecciona un empleado');
      return;
    }

    // Validare cu isManagerMode=true pentru a ignora restricțiile
    if (!validateDates(true)) {
      return;
    }

    // Validare fecha_ultimo_dia_trabajo pentru BAJA_VOLUNTARIA
    if (tipo === 'BAJA_VOLUNTARIA' && !fechaUltimoDiaTrabajo) {
      setErrorMsg('El último día de trabajo es obligatorio para Baja Voluntaria.');
      return;
    }

    setOperationLoading('submit-manager', true);
    
    const tipoPayload = tipo === 'Asuntos Propios' ? 'Asunto Propio' : tipo;
    
    // Folosește datele angajatului selectat
    const solicitudEmail = managerSelectedEmpleado.email;
    const solicitudCodigo = managerSelectedEmpleado.codigo;
    const solicitudNombre = managerSelectedEmpleado.name;
    
    const data = {
      accion: 'create',
      id: Date.now(),
      email: solicitudEmail,
      codigo: solicitudCodigo,
      nombre: solicitudNombre,
      tipo: tipoPayload,
      estado: managerAutoApprove ? 'Aprobada' : 'Pendiente',
      motivo,
      origen: 'MANAGER', // Marchează că este creată de manager
      creado_por: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || '',
      creado_por_email: authUser?.email || '',
      // Pentru BAJA_VOLUNTARIA, nu trimitem fecha_inicio și fecha_fin
      ...(tipoPayload !== 'BAJA_VOLUNTARIA' ? {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      } : {
        fecha_inicio: fechaUltimoDiaTrabajo,
        fecha_fin: fechaUltimoDiaTrabajo,
      }),
      ...(tipoPayload === 'BAJA_VOLUNTARIA' && fechaUltimoDiaTrabajo ? {
        fecha_ultimo_dia_trabajo: fechaUltimoDiaTrabajo
      } : {}),
      ...(tipoPayload === 'Ausencias justificada' ? {
        tipo_justificante: tipoJustificante,
        hora_cita: horaCita || null,
        centro_medico: centroMedico || null,
        descripcion_otro: tipoJustificante === 'otro' ? descripcionOtro : null,
        archivo_justificante_nombre: archivoJustificante ? archivoJustificante.name : null,
      } : {}),
    };

    console.log('📤 [Manager] Creando solicitud para empleado:', data);

    try {
      const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
      
      const result = await callApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      let responseData = result.data;
      if (Array.isArray(responseData) && responseData.length > 0) {
        responseData = responseData[0];
      }
      
      const isSuccess = result.success || 
        (responseData && (responseData.success === true || responseData.status === 'ok' || responseData.solicitud_ok === 1));

      if (isSuccess) {
        await activityLogger.logSolicitudCreated(data, authUser);
        setSuccessMsg(`Solicitud creada correctamente para ${solicitudNombre}.`);
        setServerResp(`Status: ${responseData?.status || 'ok'} - Solicitud guardada exitosamente`);

        if (tipoPayload === 'Ausencias justificada' && archivoJustificante) {
          try {
            const token = localStorage.getItem('auth_token');
            const tipoDocumento = 'Justificante';
            const formData = new FormData();
            formData.append('archivo_0', archivoJustificante);
            formData.append('empleado_id', solicitudCodigo);
            formData.append('empleado_nombre', solicitudNombre || 'Sin nombre');
            formData.append('empleado_email', solicitudEmail || '');
            formData.append('tipo_documento', tipoDocumento);
            formData.append('fecha_upload', new Date().toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Madrid' }));
            formData.append('archivo_0_nombre', archivoJustificante.name);
            formData.append('archivo_0_tamaño', archivoJustificante.size.toString());
            formData.append('archivo_0_tipo', archivoJustificante.type);
            await fetch(routes.uploadDocumento, { method: 'POST', headers: { ...(token && { Authorization: `Bearer ${token}` }) }, body: formData });
            // Si el manager crea ya Aprobada, crear la solicitud de documento para que el empleado reciba el email
            if (managerAutoApprove) {
              const fechaNorm = (fechaInicio || '').split('-').reverse().join('/') || new Date().toLocaleDateString('es-ES');
              const notas = `Justificante de presencia a la cita (ausencia justificada aprobada) - ${fechaNorm}`;
              await fetch(routes.createDocumentoSolicitado, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                body: JSON.stringify({ empleado_id: solicitudCodigo, tipo_documento: 'Justificante de presencia a la cita', notas }),
              }).catch(() => {});
            }
          } catch (e) { console.error('Error al subir justificante (manager):', e); }
        }
        
        // Reset form și închide modalul
        setTipo('Asuntos Propios');
        setFechaInicio('');
        setFechaFin('');
        setFechaUltimoDiaTrabajo('');
        setBajaVoluntariaDocumento(null);
        setMotivo('');
        setTipoJustificante('');
        setHoraCita('');
        setCentroMedico('');
        setDescripcionOtro('');
        setArchivoJustificante(null);
        setManagerSelectedEmpleado(null);
        setManagerEmpleadoSearch('');
        setManagerAutoApprove(true);
        setShowManagerSolicitudModal(false);
        
        // Reîncarcă listele de solicitări
        setTimeout(() => {
          fetchSolicitudes();
          if (isManager) {
            fetchAllSolicitudes();
          }
        }, 1000);
      } else {
        setErrorMsg('No se pudo guardar la solicitud.');
        setServerResp(`Error: ${result.error || responseData?.error || 'Error desconocido'}`);
      }
    } catch (e) {
      setErrorMsg('No se pudo guardar la solicitud en línea');
      setServerResp('Error: ' + (e.message || e.toString()));
    } finally {
      setOperationLoading('submit-manager', false);
    }
  };

  const handleExportExcel = async () => {
    try {
      // Import funcția de export Excel
      const { exportToExcelWithHeader } = await import('../utils/exportExcel');
      
      const dataToExport = canAccessAllTabs ? getFilteredSolicitudes : solicitudes;
      
      if (!dataToExport || dataToExport.length === 0) {
        alert('No hay datos para exportar');
        return;
      }
      
      // Funcție helper pentru a verifica dacă o absență are justificante încărcate
      const tieneJustificante = (item) => {
        if (selectedTab !== 'ausencias') return 'N/A';
        
        const tipoAusencia = item.TIPO || item.tipo || '';
        const codigo = item.CODIGO || item.codigo || '';
        let fechaAusencia = item.FECHA || item.fecha || item.fecha_inicio || '';
        
        if (fechaAusencia && typeof fechaAusencia === 'string' && fechaAusencia.includes(' - ')) {
          fechaAusencia = fechaAusencia.split(' - ')[0].trim();
        }
        
        if (!fechaAusencia) return 'No';
        
        let fechaNormalizada = '';
        try {
          if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
            const fechaParts = fechaAusencia.trim().split('/');
            if (fechaParts.length === 3) {
              fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
            }
          } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
            fechaNormalizada = fechaAusencia.substring(0, 10);
          } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}T/)) {
            // Handle ISO date format
            fechaNormalizada = fechaAusencia.substring(0, 10);
          }
        } catch {
          // Ignore
        }
        
        if (!fechaNormalizada) return 'No';
        
        // Pentru tab-ul "todas" (manageri), justificantele sunt în documentosSolicitadosMap
        if (canAccessAllTabs && documentosSolicitadosMap.size > 0) {
          // Key-ul în documentosSolicitadosMap este: `${codigo}_${tipo}_${fecha}`
          const key = `${codigo}_${tipoAusencia}_${fechaNormalizada}`;
          const keySinEspacios = `${codigo}_${tipoAusencia.replace(/\s+/g, '')}_${fechaNormalizada}`;
          let justificante = documentosSolicitadosMap.get(key) || documentosSolicitadosMap.get(keySinEspacios);
          
          // Dacă nu găsește exact, caută doar pe dată (matching flexibil)
          if (!justificante) {
            for (const [mapKey, value] of documentosSolicitadosMap.entries()) {
              if (mapKey.includes(codigo) && value.fechaAusencia === fechaNormalizada) {
                justificante = value;
                break;
              }
            }
          }
          
          if (justificante) {
            if (justificante.estado === 'completado') {
              return 'Sí (Completado)';
            } else if (justificante.estado === 'pendiente') {
              return 'Sí (Pendiente)';
            }
            return 'Sí';
          }
        }
        
        // Pentru "Mis Solicitudes" (angajați), justificantele sunt în justificantesPorAusencia
        const currentMap = justificantesPorAusenciaRef.current.size > 0 
          ? justificantesPorAusenciaRef.current 
          : justificantesPorAusencia;
        
        // MATCHING FLEXIBIL: Caută direct pe dată (key-ul este data normalizată YYYY-MM-DD)
        let justificante = currentMap.get(fechaNormalizada);
        
        // Dacă nu găsește direct pe dată, caută prin iterație (fallback pentru key-uri vechi)
        if (!justificante) {
          for (const [, value] of currentMap.entries()) {
            if (value.fechaAusencia === fechaNormalizada) {
              justificante = value;
              break;
            }
          }
        }
        
        if (justificante) {
          // Verifică doar dacă data se potrivește (nu verificăm tipul)
          if (justificante.fechaAusencia && fechaNormalizada && justificante.fechaAusencia !== fechaNormalizada) {
            return 'No';
          }
          // Verifică dacă justificantele sunt completate
          if (justificante.estado === 'completado') {
            return 'Sí (Completado)';
          } else if (justificante.estado === 'pendiente') {
            return 'Sí (Pendiente)';
          }
          return 'Sí';
        }
        
        return 'No';
      };

      // Formatează datele pentru Excel
      const excelData = dataToExport.map(item => {
        if (selectedTab === 'ausencias') {
          return {
            id: item.id,
            nombre: item.NOMBRE || item.nombre || 'N/A',
            codigo: item.CODIGO || item.codigo || 'N/A',
            tipo: item.TIPO || item.tipo || 'N/A',
            fecha: formatDate(item.FECHA || item.fecha),
            hora: item.HORA || item.hora || 'N/A',
            ubicacion: item.LOCACION || item.locacion || 'N/A',
            motivo: item.MOTIVO || item.motivo || 'N/A',
            duracion: item.DURACION || item.duracion || 'N/A',
            justificante: tieneJustificante(item)
          };
        }

        if (selectedTab === 'baja') {
          return {
            caso_id: item.casoId || item.id,
            posicion: item.posicionId || '',
            situacion: item.situacion || '',
            dias_baja: formatNumber(item.diasBaja),
            dias_previstos_sps: formatNumber(item.diasPrevistosSps),
            inicio_pago_delegado: formatDate(item.inicioPagoDelegado),
            fin_pago_delegado: formatDate(item.finPagoDelegado),
            ultima_gestion_mutua: formatDate(item.ultimaGestionMutua),
            proxima_gestion_mutua: formatDate(item.proximaGestionMutua),
            pendiente_inss: formatNumber(item.pendienteINSS),
            demora_parte_baja: formatNumber(item.demoraParteBaja),
            fuente: item.fuente || '',
            actualizado: formatDateTime(item.updatedAt)
          };
        }

        return {
          id: item.id,
          nombre: getUserName(item.email),
          email: item.email,
          tipo: item.tipo,
          estado: item.estado,
          fecha_solicitud: formatDate(item.fecha_solicitud),
          fecha_inicio: formatDate(item.fecha_inicio || item['fecha inicio'] || item.fecha),
          fecha_fin: formatDate(item.fecha_fin || item['fecha fin']),
          duracion: (() => {
            const durationInfo = getAusenciaDurationDisplay(item);
            return durationInfo.text;
          })(),
          motivo: item.motivo || ''
        };
      });

      let columns;
      if (selectedTab === 'ausencias') {
        columns = [
          { key: 'id', label: 'ID', width: 15 },
          { key: 'nombre', label: 'Empleado', width: 25 },
          { key: 'codigo', label: 'Código', width: 15 },
          { key: 'tipo', label: 'Tipo', width: 18 },
          { key: 'fecha', label: 'Fecha', width: 15 },
          { key: 'hora', label: 'Hora', width: 12 },
          { key: 'ubicacion', label: 'Ubicación', width: 25 },
          { key: 'motivo', label: 'Motivo', width: 40 },
          { key: 'duracion', label: 'Duración', width: 12 },
          { key: 'justificante', label: 'Justificante', width: 20 }
        ];
      } else if (selectedTab === 'baja') {
        columns = [
          { key: 'caso_id', label: 'Id. Caso', width: 15 },
          { key: 'posicion', label: 'Posición', width: 12 },
          { key: 'situacion', label: 'Situación', width: 18 },
          { key: 'dias_baja', label: 'Días de baja', width: 15 },
          { key: 'dias_previstos_sps', label: 'Previsto SPS', width: 15 },
          { key: 'inicio_pago_delegado', label: 'Inicio pago', width: 18 },
          { key: 'fin_pago_delegado', label: 'Fin pago', width: 18 },
          { key: 'ultima_gestion_mutua', label: 'Última Mutua', width: 18 },
          { key: 'proxima_gestion_mutua', label: 'Próxima Mutua', width: 18 },
          { key: 'pendiente_inss', label: 'Pendiente INSS', width: 18 },
          { key: 'demora_parte_baja', label: 'Demora parte baja', width: 20 },
          { key: 'fuente', label: 'Fuente', width: 15 },
          { key: 'actualizado', label: 'Actualizado', width: 20 }
        ];
      } else {
        columns = [
          { key: 'id', label: 'ID', width: 15 },
          { key: 'nombre', label: 'Empleado', width: 25 },
          { key: 'email', label: 'Email', width: 30 },
          { key: 'tipo', label: 'Tipo', width: 18 },
          { key: 'estado', label: 'Estado', width: 12 },
          { key: 'fecha_solicitud', label: 'Fecha Solicitud', width: 18 },
          { key: 'fecha_inicio', label: 'Fecha Inicio', width: 15 },
          { key: 'fecha_fin', label: 'Fecha Fin', width: 15 },
          { key: 'duracion', label: 'Duración', width: 12 },
          { key: 'motivo', label: 'Motivo', width: 40 }
        ];
      }
      
      // Construye el título del reporte
      const selectedTypeText =
        selectedTab === 'ausencias'
          ? 'Ausencias'
          : selectedTab === 'asunto'
          ? 'Asuntos Propios'
          : selectedTab === 'baja'
          ? 'Bajas Médicas'
          : 'Vacaciones';

      const selectedTypeTextPdf =
        selectedTab === 'ausencias'
          ? 'Ausencias'
          : selectedTab === 'baja'
          ? 'Bajas Médicas'
          : selectedTab === 'asunto'
          ? 'Asuntos Propios'
          : 'Vacaciones';

      const reportTitle =
        selectedTab === 'ausencias'
          ? selectedUser !== 'ALL'
            ? `AUSENCIAS - ${getUserName(selectedUser)}`
            : 'AUSENCIAS DE EMPLEADOS'
          : selectedUser !== 'ALL'
          ? `${selectedTypeTextPdf.toUpperCase()} - ${getUserName(selectedUser)}`
          : `${selectedTypeTextPdf.toUpperCase()} DE EMPLEADOS`;

      // Construye el período para mostrar
      const selectedMonthName = selectedMonth > 0 ? MONTHS[selectedMonth] : 'Todos los meses';
      const period = `${selectedTypeTextPdf} - ${selectedMonthName}`;
      
      // Mensaje informativo sobre qué se está exportando
      const filterInfo = [];
      if (selectedUser !== 'ALL') filterInfo.push(`Empleado: ${getUserName(selectedUser)}`);
      if (selectedMonth > 0) filterInfo.push(`Mes: ${selectedMonthName}`);
      if (selectedTab === 'ausencias' && !selectedTipoAusencia.includes('ALL') && selectedTipoAusencia.length > 0) {
        filterInfo.push(`Tipos: ${selectedTipoAusencia.join(', ')}`);
      } else {
        filterInfo.push(`Tipo: ${selectedTypeText}`);
      }
      if (selectedTab === 'vacaciones') filterInfo.push(`Estado: ${selectedStatus}`);
      
      console.log(`Exportando ${excelData.length} solicitudes con filtros: ${filterInfo.join(', ')}`);

      // Construye el nombre del archivo con filtros
      let filename = selectedTab === 'ausencias' ? 'ausencias' : 'solicitudes';
      
      // Agrega empleado al nombre si está seleccionado
      if (selectedUser !== 'ALL') {
        const empleadoName = getUserName(selectedUser)
          .replace(/[^a-zA-Z0-9\s]/g, '') // Elimina caracteres especiales
          .replace(/\s+/g, '_') // Reemplaza espacios con guiones bajos
          .toLowerCase();
        filename += `_${empleadoName}`;
      }
      
      // Agrega mes al nombre si está seleccionado
      if (selectedMonth > 0) {
        const mesName = MONTHS[selectedMonth].toLowerCase();
        filename += `_${mesName}`;
      }
      
      // Agrega tipo al nombre
      const tipoName =
        selectedTab === 'ausencias'
          ? 'ausencias'
          : selectedTab === 'asunto'
          ? 'asuntos'
          : selectedTab === 'baja'
          ? 'bajas'
          : 'vacaciones';
      filename += `_${tipoName}`;
      
      // Agrega estado si es vacaciones
      if (selectedTab === 'vacaciones') {
        filename += `_${selectedStatus.toLowerCase()}`;
      }

      // Export a Excel con header de la compañía
      await exportToExcelWithHeader(
        excelData,
        columns,
        reportTitle,
        filename,
        {},
        period
      );

      // Log export-ul de date
      await activityLogger.logDataExport('solicitudes_excel', {
        count: excelData.length,
        filters: {
          isManager: isManager,
          selectedTab: selectedTab,
          selectedStatus: selectedStatus,
          selectedMonth: selectedMonth,
          selectedUser: selectedUser
        }
      }, authUser);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error al exportar a Excel. Por favor, inténtalo de nuevo.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const pdfMake = await getPdfMake();

      const dataToExport = canAccessAllTabs ? getFilteredSolicitudes : solicitudes;
      
      if (!dataToExport || dataToExport.length === 0) {
        alert('No hay datos para exportar');
        return;
      }

      // Funcție helper pentru a verifica dacă o absență are justificante încărcate (pentru PDF)
      const tieneJustificantePDF = (item) => {
        if (selectedTab !== 'ausencias') return 'N/A';
        
        const tipoAusencia = item.TIPO || item.tipo || '';
        const codigo = item.CODIGO || item.codigo || '';
        let fechaAusencia = item.FECHA || item.fecha || item.fecha_inicio || '';
        
        if (fechaAusencia && typeof fechaAusencia === 'string' && fechaAusencia.includes(' - ')) {
          fechaAusencia = fechaAusencia.split(' - ')[0].trim();
        }
        
        if (!fechaAusencia) return 'No';
        
        let fechaNormalizada = '';
        try {
          if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
            const fechaParts = fechaAusencia.trim().split('/');
            if (fechaParts.length === 3) {
              fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
            }
          } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
            fechaNormalizada = fechaAusencia.substring(0, 10);
          } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}T/)) {
            // Handle ISO date format
            fechaNormalizada = fechaAusencia.substring(0, 10);
          }
        } catch {
          // Ignore
        }
        
        if (!fechaNormalizada) return 'No';
        
        // Pentru tab-ul "todas" (manageri), justificantele sunt în documentosSolicitadosMap
        if (canAccessAllTabs && documentosSolicitadosMap.size > 0) {
          // Key-ul în documentosSolicitadosMap este: `${codigo}_${tipo}_${fecha}`
          const key = `${codigo}_${tipoAusencia}_${fechaNormalizada}`;
          const keySinEspacios = `${codigo}_${tipoAusencia.replace(/\s+/g, '')}_${fechaNormalizada}`;
          let justificante = documentosSolicitadosMap.get(key) || documentosSolicitadosMap.get(keySinEspacios);
          
          // Dacă nu găsește exact, caută doar pe dată (matching flexibil)
          if (!justificante) {
            for (const [mapKey, value] of documentosSolicitadosMap.entries()) {
              if (mapKey.includes(codigo) && value.fechaAusencia === fechaNormalizada) {
                justificante = value;
                break;
              }
            }
          }
          
          if (justificante) {
            if (justificante.estado === 'completado') {
              return 'Sí (Completado)';
            } else if (justificante.estado === 'pendiente') {
              return 'Sí (Pendiente)';
            }
            return 'Sí';
          }
        }
        
        // Pentru "Mis Solicitudes" (angajați), justificantele sunt în justificantesPorAusencia
        const currentMap = justificantesPorAusenciaRef.current.size > 0 
          ? justificantesPorAusenciaRef.current 
          : justificantesPorAusencia;
        
        // MATCHING FLEXIBIL: Caută direct pe dată (key-ul este data normalizată YYYY-MM-DD)
        let justificante = currentMap.get(fechaNormalizada);
        
        // Dacă nu găsește direct pe dată, caută prin iterație (fallback pentru key-uri vechi)
        if (!justificante) {
          for (const [, value] of currentMap.entries()) {
            if (value.fechaAusencia === fechaNormalizada) {
              justificante = value;
              break;
            }
          }
        }
        
        if (justificante) {
          // Verifică doar dacă data se potrivește (nu verificăm tipul)
          if (justificante.fechaAusencia && fechaNormalizada && justificante.fechaAusencia !== fechaNormalizada) {
            return 'No';
          }
          // Verifică dacă justificantele sunt completate
          if (justificante.estado === 'completado') {
            return 'Sí (Completado)';
          } else if (justificante.estado === 'pendiente') {
            return 'Sí (Pendiente)';
          }
          return 'Sí';
        }
        
        return 'No';
      };

      // Construye el cuerpo de la tabla
      let tableBody;
      let tableWidths;
      if (selectedTab === 'ausencias') {
        tableBody = [
          ['Empleado', 'Código', 'Tipo', 'Fecha', 'Hora', 'Ubicación', 'Motivo', 'Duración', 'Justificante'],
          ...dataToExport.map(item => [
            item.NOMBRE || item.nombre || '',
            item.CODIGO || item.codigo || '',
            item.TIPO || item.tipo || '',
            formatDate(item.FECHA || item.fecha) || '',
            item.HORA || item.hora || '',
            item.LOCACION || item.locacion || '',
            item.MOTIVO || item.motivo || '',
            getAusenciaDurationDisplay(item).text,
            tieneJustificantePDF(item)
          ])
        ];
        tableWidths = [90, 60, 60, 60, 50, 90, 120, 60, 70];
      } else if (selectedTab === 'baja') {
        tableBody = [
          ['Caso', 'Posición', 'Situación', 'Días baja', 'Previsto SPS', 'Inicio pago', 'Fin pago', 'Última Mutua', 'Próxima Mutua', 'Pendiente INSS', 'Fuente', 'Actualizado'],
          ...dataToExport.map(item => [
            item.casoId || item.id || '',
            item.posicionId || '',
            item.situacion || '',
            formatNumber(item.diasBaja),
            formatNumber(item.diasPrevistosSps),
            formatDate(item.inicioPagoDelegado),
            formatDate(item.finPagoDelegado),
            formatDate(item.ultimaGestionMutua),
            formatDate(item.proximaGestionMutua),
            formatNumber(item.pendienteINSS),
            item.fuente || '',
            formatDateTime(item.updatedAt)
          ])
        ];
        tableWidths = [60, 50, 80, 60, 70, 70, 70, 80, 80, 70, 60, 90];
      } else {
        tableBody = [
          ['Empleado', 'Email', 'Tipo', 'Estado', 'F. Solicitud', 'F. Inicio', 'F. Fin', 'Duración', 'Motivo'],
          ...dataToExport.map(item => [
            getUserName(item.email) || '',
            item.email || '',
            item.tipo || '',
            item.estado || '',
            formatDate(item.fecha_solicitud) || '',
            formatDate(item.fecha_inicio || item['fecha inicio'] || item.fecha) || '',
            formatDate(item.fecha_fin || item['fecha fin']) || '',
            (() => {
              const durationInfo = getAusenciaDurationDisplay(item);
              return durationInfo.text;
            })(),
            item.motivo || ''
          ])
        ];
        tableWidths = [80, 120, 60, 50, 60, 60, 60, 50, '*'];
      }

      const selectedTypeTextPdf =
        selectedTab === 'ausencias'
          ? 'Ausencias'
          : selectedTab === 'baja'
          ? 'Bajas Médicas'
          : selectedTab === 'asunto'
          ? 'Asuntos Propios'
          : 'Vacaciones';

      const reportTitle =
        selectedTab === 'ausencias'
          ? selectedUser !== 'ALL'
            ? `AUSENCIAS - ${getUserName(selectedUser)}`
            : 'AUSENCIAS DE EMPLEADOS'
          : selectedUser !== 'ALL'
          ? `${selectedTypeTextPdf.toUpperCase()} - ${getUserName(selectedUser)}`
          : `${selectedTypeTextPdf.toUpperCase()} DE EMPLEADOS`;

      // Construye el período para mostrar
      const selectedMonthName = selectedMonth > 0 ? MONTHS[selectedMonth] : 'Todos los meses';
      const period = `${selectedTypeTextPdf} - ${selectedMonthName}`;

      const docDefinition = {
        pageOrientation: 'landscape',
        content: [
          // Header compañía
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: config.COMPANY_NAME, style: 'companyName' }],
                [{ text: `NIF: ${config.COMPANY_CIF}`, style: 'companyDetails' }],
                [{ text: config.COMPANY_ADDRESS, style: 'companyDetails' }],
                [{ text: `Teléfono: ${config.COMPANY_PHONE}`, style: 'companyDetails' }],
                [{ text: `Email: ${config.COMPANY_EMAIL}`, style: 'companyDetails' }]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 10]
          },
          
          // Título del reporte
          { text: reportTitle, style: 'reportTitle' },
          { text: `Período: ${period}`, style: 'period', margin: [0, 0, 0, 10] },
          
          // Tabla con datos
          {
            table: { 
              headerRows: 1, 
              widths: tableWidths, 
              body: tableBody 
            },
            layout: 'lightHorizontalLines'
          }
        ],
        styles: {
          companyName: { 
            fontSize: 18, 
            bold: true, 
            color: '#FFFFFF', 
            fillColor: PRIMARY_COLOR, 
            alignment: 'center', 
            margin: [0, 0, 0, 8]
          },
          companyDetails: { 
            fontSize: 10, 
            bold: true, 
            color: '#333333', 
            fillColor: '#F0F0F0', 
            alignment: 'center',
            margin: [0, 0, 0, 2]
          },
          reportTitle: { 
            fontSize: 12, 
            bold: true, 
            color: '#FFFFFF', 
            fillColor: PRIMARY_COLOR, 
            alignment: 'center',
            margin: [0, 4, 0, 2]
          },
          period: { 
            fontSize: 10, 
            color: '#333333', 
            alignment: 'center'
          }
        }
      };

      // Construye el nombre del archivo con filtros (igual que Excel)
      let filename = selectedTab === 'ausencias' ? 'ausencias' : 'solicitudes';
      
      if (selectedUser !== 'ALL') {
        const empleadoName = getUserName(selectedUser)
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .toLowerCase();
        filename += `_${empleadoName}`;
      }
      
      if (selectedMonth > 0) {
        const mesName = MONTHS[selectedMonth].toLowerCase();
        filename += `_${mesName}`;
      }
      
      const tipoName =
        selectedTab === 'ausencias'
          ? 'ausencias'
          : selectedTab === 'asunto'
          ? 'asuntos'
          : selectedTab === 'baja'
          ? 'bajas'
          : 'vacaciones';
      filename += `_${tipoName}`;
      
      if (selectedTab === 'vacaciones') {
        filename += `_${selectedStatus.toLowerCase()}`;
      }

      filename += '.pdf';

      pdfMake.createPdf(docDefinition).download(filename);

      // Log export-ul de date
      await activityLogger.logDataExport('solicitudes_pdf', {
        count: dataToExport.length,
        filters: {
          isManager: isManager,
          selectedTab: selectedTab,
          selectedStatus: selectedStatus,
          selectedMonth: selectedMonth,
          selectedUser: selectedUser
        }
      }, authUser);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar PDF. Por favor, inténtalo de nuevo.');
    }
  };

  const handleEdit = (solicitud) => {
    // Dacă este "Permiso Retribuido" sau "Asunto Propio", deschide modalul de conversie în loc de formularul de editare
    const tipo = solicitud.tipo || solicitud.TIPO || '';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('permiso retribuido') || 
        tipoLower.includes('asunto propio') || 
        tipoLower.includes('asuntos propios')) {
      setConvertirTipoModal({ isOpen: true, ausencia: solicitud, mensaje: '' });
      return;
    }
    
    // Populează formularul cu datele solicitării existente
    setTipo(solicitud.tipo === 'Asunto Propio' ? 'Asuntos Propios' : solicitud.tipo);
    
    // Gestionează FECHA combinată (ex: "2025-11-03 - 2025-12-02")
    let fechaInicioValue = '';
    let fechaFinValue = '';
    
    if (solicitud.FECHA && solicitud.FECHA.includes(' - ')) {
      const [inicio, fin] = solicitud.FECHA.split(' - ');
      fechaInicioValue = inicio.trim();
      fechaFinValue = fin.trim();
    } else {
      fechaInicioValue = solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha || solicitud.FECHA || '';
      fechaFinValue = solicitud.fecha_fin || solicitud["fecha fin"] || '';
    }
    
    setFechaInicio(fechaInicioValue);
    setFechaFin(fechaFinValue);
    setMotivo(solicitud.motivo || '');
    setEditingSolicitud(solicitud.id);
    
    // Salvează datele originale pentru validare
    setOriginalSolicitudData({
      tipo: solicitud.tipo,
      fecha_inicio: fechaInicioValue,
      fecha_fin: fechaFinValue,
      FECHA: solicitud.FECHA
    });
    
    // Schimbă la tab-ul de formular
    setActiveTab('nueva');
    // Scroll la formular
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleDeleteClick = (solicitudId) => {
    setDeleteConfirm({ isOpen: true, solicitudId, mensaje: '' });
  };

  const handleConvertirAusencia = async (ausencia) => {
    try {
      setOperationLoading('convertir', true);
      setErrorMsg('');
      
      // Obține ID-ul absenței (nu solicitud_id)
      const ausenciaId = ausencia.id || ausencia.ID;
      
      if (!ausenciaId) {
        console.error('❌ Ausencia item (nu are id):', ausencia);
        setErrorMsg('No se pudo encontrar el ID de la ausencia. Verifica la consola para más detalles.');
        setConvertirConfirm({ isOpen: false, ausencia: null });
        setOperationLoading('convertir', false);
        return;
      }
      
      // Determină tipul curent și tipul nou (conversie inversă)
      // Normalizăm tipul pentru a se potrivi cu backend-ul
      const tipoActual = (ausencia.TIPO || ausencia.tipo || '').trim();
      const tipoActualLower = tipoActual.toLowerCase();
      
      let tipoNuevo = '';
      if (tipoActualLower.includes('justificada')) {
        // Dacă e justificada (orice variantă), devine injustificada
        tipoNuevo = 'Ausencia Injustificada';
      } else if (tipoActualLower.includes('injustificada')) {
        // Dacă e injustificada, devine justificada
        tipoNuevo = 'Ausencia Justificada';
      } else {
        // Fallback
        tipoNuevo = 'Ausencia Injustificada';
      }
      
      console.log('🔍 Conversie ausencia:', { ausenciaId, tipoActual, tipoNuevo });
      
      // Folosește noul endpoint care trimite notificări (email + Telegram)
      const endpoint = routes.updateAusenciaTipo(ausenciaId);
      
      const result = await callApi(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: tipoNuevo,
          mensaje: '' // Mesaj gol pentru conversie automată (poate fi adăugat un modal mai târziu)
        })
      });

      if (result.success) {
        // Log conversia
        await activityLogger.logAction('ausencia_converted', {
          ausencia_id: ausenciaId,
          tipo_anterior: tipoActual,
          tipo_nuevo: tipoNuevo,
          user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
          email: authUser?.email
        });
        
        setSuccessMsg(result.message || `Ausencia convertida de "${tipoActual}" a "${tipoNuevo}"`);
        setConvertirConfirm({ isOpen: false, ausencia: null });
        
        // Reîncarcă listele
        fetchSolicitudes();
        if (isManager) {
          fetchAllSolicitudes();
          fetchAllAusencias();
        }
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(result.error || 'Error al convertir ausencia');
      }
    } catch (e) {
      console.error('Error converting ausencia:', e);
      setErrorMsg(`Error al convertir: ${e.message}`);
      setConvertirConfirm({ isOpen: false, ausencia: null });
    } finally {
      setOperationLoading('convertir', false);
    }
  };

  const handleToggleNoNecesitaJustificante = async (ausenciaId, currentValue) => {
    try {
      setOperationLoading('no-necesita-justificante', true);
      
      const endpoint = routes.updateNoNecesitaJustificante(ausenciaId);
      const result = await callApi(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_necesita_justificante: !currentValue
        })
      });

      if (result.success) {
        setSuccessMsg(
          !currentValue 
            ? 'Ausencia marcada como "No necesita justificante"' 
            : 'Flag "No necesita justificante" eliminado'
        );
        
        // Reîncarcă listele
        fetchSolicitudes();
        if (isManager) {
          fetchAllSolicitudes();
        }
        setTimeout(() => setSuccessMsg(''), 2500);
      } else {
        setErrorMsg(result.error || 'Error al actualizar ausencia');
      }
    } catch (e) {
      console.error('Error updating no_necesita_justificante:', e);
      setErrorMsg(`Error al actualizar: ${e.message}`);
    } finally {
      setOperationLoading('no-necesita-justificante', false);
    }
  };

  const handleConvertirTipo = async (nuevoTipo) => {
    if (!convertirTipoModal.ausencia) return;
    
    try {
      setOperationLoading('convertir-tipo', true);
      setErrorMsg('');
      
      const ausenciaId = convertirTipoModal.ausencia.id || convertirTipoModal.ausencia.ID;
      const endpoint = routes.updateAusenciaTipo(ausenciaId);
      
      // Pentru "Permiso Retribuido", trimitem și datele
      const bodyData = {
        tipo: nuevoTipo,
        mensaje: convertirTipoModal.mensaje || ''
      };
      
      // Dacă este "Permiso Retribuido" și avem date, le adăugăm
      if (nuevoTipo === 'Permiso Retribuido' && convertirTipoModal.fechaInicio) {
        bodyData.fecha_inicio = convertirTipoModal.fechaInicio;
        bodyData.fecha_fin = convertirTipoModal.fechaFin || convertirTipoModal.fechaInicio;
      }
      
      const result = await callApi(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData)
      });

      if (result.success) {
        setSuccessMsg(result.message || `Ausencia convertida a "${nuevoTipo}"`);
        setConvertirTipoModal({ 
          isOpen: false, 
          ausencia: null, 
          mensaje: '',
          fechaInicio: '',
          fechaFin: '',
          nuevoTipo: null
        });
        
        // Reîncarcă listele
        fetchSolicitudes();
        if (isManager) {
          fetchAllSolicitudes();
          fetchAllAusencias();
        }
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(result.error || 'Error al convertir ausencia');
      }
    } catch (e) {
      console.error('Error converting tipo:', e);
      setErrorMsg(`Error al convertir: ${e.message}`);
    } finally {
      setOperationLoading('convertir-tipo', false);
    }
  };

  const handleDelete = async (solicitudId, mensajePersonalizado = '') => {
    try {
      setOperationLoading('delete', true);
      
      // Găsește solicitarea pentru a obține codigo-ul angajatului
      // Caută în toate locurile: solicitudes, allSolicitudes și allAusencias
      let solicitudToDelete = [...solicitudes, ...allSolicitudes].find(s => s.id === solicitudId);
      let esAusencia = solicitudToDelete?.fuente === 'ausencias' || !!(solicitudToDelete?.solicitud_id || solicitudToDelete?.SOLICITUD_ID);
      
      // Dacă nu s-a găsit în solicitudes, caută în allAusencias
      if (!solicitudToDelete && allAusencias) {
        solicitudToDelete = allAusencias.find(a => (a.id || a.ID) === solicitudId);
        if (solicitudToDelete) {
          esAusencia = true;
        }
      }
      
      const codigo = solicitudToDelete?.codigo || solicitudToDelete?.CODIGO || '';
      
      let result;
      
      // Dacă este o ausencia, folosește endpoint-ul de ștergere pentru ausencias
      if (esAusencia) {
        const endpoint = routes.deleteAusencia(solicitudId);
        result = await callApi(endpoint, {
          method: 'DELETE'
        });
      } else {
        // Pentru solicitudes normale, folosește același endpoint cu accion: 'delete'
        const data = {
          accion: 'delete',
          id: solicitudId,
          codigo: codigo,
          ...(mensajePersonalizado.trim() ? { mensajePersonalizado: mensajePersonalizado.trim() } : {})
        };
        
        console.log('TRIMIT DELETE:', data);
        
        // Folosește backend-ul nou pentru delete
        const endpoint = routes.getSolicitudesByEmail || `${config.BACKEND_BASE || config.API_URL || ''}/api/solicitudes`;
        
        result = await callApi(endpoint, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }

      // Procesează răspunsul: poate fi array cu { status: "ok", ... } sau { success: true } sau obiect direct
      let responseData = result.data;
      if (Array.isArray(responseData) && responseData.length > 0) {
        responseData = responseData[0];
      }
      
      // Verifică dacă operația a reușit
      // Pentru delete: { status: "ok", solicitud_ok: 1 } sau { success: true }
      const isSuccess = result.success && (
        (responseData && responseData.success === true) ||
        (responseData && responseData.status === 'ok') || 
        (responseData && responseData.solicitud_ok === 1) ||
        result.success
      );

      if (isSuccess) {
        // Log ștergerea solicitării
        await activityLogger.logAction(esAusencia ? 'ausencia_deleted' : 'solicitud_deleted', {
          solicitud_id: responseData?.deleted_id || responseData?.solicitud_id || solicitudId,
          codigo: responseData?.codigo || codigo,
          user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
          email: authUser?.email
        });
        
        setSuccessMsg(esAusencia ? 'Ausencia eliminada correctamente.' : 'Solicitud eliminada correctamente.');
        setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' }); // Închide modalul
        // Reîncarcă listele
        fetchSolicitudes();
        if (isManager) {
          fetchAllSolicitudes();
        }
        setTimeout(() => setSuccessMsg(''), 2500);
      } else {
        setErrorMsg(`No se pudo eliminar ${esAusencia ? 'la ausencia' : 'la solicitud'}: ${result.error || responseData?.error || 'Error desconocido'}`);
        setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' }); // Închide modalul chiar dacă e eroare
      }
    } catch (e) {
      console.error('Error deleting solicitud/ausencia:', e);
      setErrorMsg(`Error al eliminar: ${e.message}`);
      setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' }); // Închide modalul în caz de eroare
    } finally {
      setOperationLoading('delete', false);
    }
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Aprobada':
        return 'bg-green-100 text-green-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rechazada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoColor = (tipo) => {
    if (isBajaMedica(tipo)) {
      return 'bg-rose-100 text-rose-800';
    }
    switch (tipo) {
      case 'Asunto Propio':
        return 'bg-blue-100 text-blue-800';
      case 'Vacaciones':
        return 'bg-purple-100 text-purple-800';
      case 'Ausencia':
      case 'AUSENCIA':
        return 'bg-orange-100 text-orange-800';
      case 'Salida Centro':
      case 'Entrada Centro':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Formatează HORA corect (poate fi timestamp sau string simplu)
  const formatHora = (hora) => {
    if (!hora || hora === '—' || hora === '-' || hora === 'N/A') return '—';
    
    // Dacă este un timestamp ISO (ex: "1970-01-01T20:41:44.000Z")
    if (typeof hora === 'string' && hora.includes('T') && hora.includes('Z')) {
      try {
        const date = new Date(hora);
        if (!isNaN(date.getTime())) {
          // Extrage doar ora și minutele
          return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      } catch {
        // Ignore
      }
    }
    
    // Dacă este deja formatată (ex: "20:41:44" sau "20:41")
    if (typeof hora === 'string' && hora.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      // Dacă are secunde, le eliminăm
      return hora.split(':').slice(0, 2).join(':');
    }
    
    // Altfel, returnează valoarea originală
    return hora;
  };

  // Formatează flexibil câmpul FECHA care poate veni fie ca o dată simplă
  // fie ca un interval "YYYY-MM-DD - YYYY-MM-DD"
  const formatFechaFlexible = (value, fallbackInicio, fallbackFin) => {
    if (value && typeof value === 'string' && value.includes(' - ')) {
      const [ini, fin] = value.split(' - ').map(s => s.trim());
      const iniFmt = formatDate(ini);
      const finFmt = formatDate(fin);
      if (iniFmt !== '-' && finFmt !== '-') return `${iniFmt} - ${finFmt}`;
    }
    // Dacă nu este combinată, încearcă să formatezi valoarea simplă
    const simple = formatDate(value);
    if (simple !== '-') return simple;
    // Fallback pe perechea (inicio, fin) dacă există separat
    const iniFmt = formatDate(fallbackInicio);
    const finFmt = formatDate(fallbackFin);
    if (iniFmt !== '-' && finFmt !== '-') return `${iniFmt} - ${finFmt}`;
    return '-';
  };

  const calculateDays = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin || fechaInicio === '-' || fechaFin === '-' || fechaInicio === '' || fechaFin === '') return 0;
    try {
      // Folosim același calcul ca în validare pentru consistență (evită probleme de timezone)
      const [y1, m1, d1] = fechaInicio.split('-').map(Number);
      const [y2, m2, d2] = fechaFin.split('-').map(Number);
      const start = new Date(y1, m1 - 1, d1);
      const end = new Date(y2, m2 - 1, d2);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
      // Normalizăm orele la 00:00:00 pentru consistență
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      // Calculăm diferența în zile (folosim Math.floor pentru a obține zile calendaristice exacte)
      // +1 pentru a include ambele zile (inclusiv prima și ultima)
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays + 1;
    } catch {
      return 0;
    }
  };

  // Zile din intervalul selectat care sunt ocupate (sin disponibilidad) — pentru avertisment în UI
  const occupiedDaysInRange = useMemo(() => {
    if (editingSolicitud !== null || (!fechaInicio || !fechaFin || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin))) return [];
    const [y1, m1, d1] = fechaInicio.split('-').map(Number);
    const [y2, m2, d2] = fechaFin.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const list = [];
    const check = new Date(start);
    check.setHours(0, 0, 0, 0);
    const endCheck = new Date(end);
    endCheck.setHours(0, 0, 0, 0);
    while (check <= endCheck) {
      const dateStr = check.toISOString().split('T')[0];
      if (dateAvailability[dateStr]?.isFull) list.push(dateStr);
      check.setDate(check.getDate() + 1);
    }
    return list;
  }, [fechaInicio, fechaFin, dateAvailability, editingSolicitud]);

  // Calculează zilele lucrătoare (exclude weekend-urile, Luni-Vineri)
  const calculateWorkingDays = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin || fechaInicio === '-' || fechaFin === '-' || fechaInicio === '' || fechaFin === '') return 0;
    try {
      const [y1, m1, d1] = fechaInicio.split('-').map(Number);
      const [y2, m2, d2] = fechaFin.split('-').map(Number);
      const start = new Date(y1, m1 - 1, d1);
      const end = new Date(y2, m2 - 1, d2);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
      
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      let workingDays = 0;
      const currentDate = new Date(start);
      
      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay(); // 0 = Duminică, 1 = Luni, ..., 6 = Sâmbătă
        // Luni-Vineri (1-5) sunt zile lucrătoare
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          workingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return workingDays;
    } catch {
      return 0;
    }
  };

  // Funcție pentru calculul zilelor din FECHA combinată (ex: "2025-10-09 - 2025-10-23")
  const calculateDaysFromCombinedDate = (fechaCombinada) => {
    if (!fechaCombinada || fechaCombinada === '-' || fechaCombinada === '') return 0;
    try {
      // Verifică dacă FECHA conține " - " (format combinat)
      if (fechaCombinada.includes(' - ')) {
        const [fechaInicio, fechaFin] = fechaCombinada.split(' - ');
        return calculateDays(fechaInicio.trim(), fechaFin.trim());
      }
      // Dacă nu e format combinat, returnează 1 zi
      return 1;
    } catch {
      return 0;
    }
  };

  const formatSecondsToHHMMSS = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds)) {
      return null;
    }
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDecimalDuration = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return formatSecondsToHHMMSS(numeric * 3600);
  };

  const getFirstValue = (item, keys) => {
    if (!item) return null;
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
        return item[key];
      }
    }
    return null;
  };

  const isDayBasedAbsenceType = (tipo = '') => {
    // IMPORTANT: Verifică și UNIDAD_DURACION dacă este disponibil
    // Dacă UNIDAD_DURACION este 'dias', atunci este bazat pe zile
    const tipoStr = (tipo || '').trim();
    
    // Tipuri cunoscute bazate pe zile
    const dayBasedTypes = [
      'Vacaciones',
      'Asunto Propio',
      'Permiso Retribuido',
      'Permiso Recuperable',
      'Permiso No Retribuido',
      'Permiso sin sueldo',
      'Permiso médico',
      'Permiso',
      'Ausencia Injustificada', // Adăugat pentru ausencias injustificadas
      'Ausencias justificada', // Adăugat pentru ausencias justificadas
    ];
    
    return dayBasedTypes.includes(tipoStr);
  };

  const getApprovedDaysCount = (item) => {
    if (!item) return 0;
    const diasValue = getFirstValue(item, ['dias_aprobados', 'DIAS_APROBADOS', 'diasAprobados']);
    if (diasValue !== null && diasValue !== undefined && diasValue !== '') {
      const numeric = Number(diasValue);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }

    const fechaInicio = getFirstValue(item, ['fecha_inicio', 'FECHA_INICIO', 'fechaInicio']);
    const fechaFin = getFirstValue(item, ['fecha_fin', 'FECHA_FIN', 'fechaFin']);
    if (fechaInicio && fechaFin) {
      return calculateDays(fechaInicio, fechaFin);
    }

    const fechaCombinada = getFirstValue(item, ['FECHA', 'fecha']);
    if (fechaCombinada) {
      return calculateDaysFromCombinedDate(fechaCombinada);
    }

    return 0;
  };

  const getApprovedHoursLabel = (item) => {
    if (!item) return null;
    const horasValue = getFirstValue(item, ['horas_aprobadas', 'HORAS_APROBADAS', 'horasAprobadas']);
    if (typeof horasValue === 'string' && horasValue.trim() !== '') {
      if (horasValue.includes(':')) {
        return horasValue;
      }
      const formatted = formatDecimalDuration(horasValue);
      if (formatted) {
        return formatted;
      }
      return horasValue;
    }
    if (typeof horasValue === 'number' && !Number.isNaN(horasValue)) {
      const formatted = formatDecimalDuration(horasValue);
      if (formatted) {
        return formatted;
      }
      return horasValue.toString();
    }

    const duracion = getFirstValue(item, ['DURACION', 'duracion']);
    const unidad = getFirstValue(item, ['UNIDAD_DURACION', 'unidad_duracion']);
    
    // IMPORTANT: Dacă UNIDAD_DURACION este 'dias', afișăm direct ca zile, nu ca timp
    if (unidad === 'dias' || unidad === 'día' || unidad === 'días') {
      if (typeof duracion === 'number') {
        return `${duracion} ${duracion === 1 ? 'día' : 'días'}`;
      }
      if (typeof duracion === 'string' && duracion.trim() !== '') {
        // Dacă este string numeric, convertim
        const numDuracion = parseFloat(duracion);
        if (!isNaN(numDuracion)) {
          return `${numDuracion} ${numDuracion === 1 ? 'día' : 'días'}`;
        }
        return `${duracion} ${unidad}`;
      }
    }
    
    // Pentru 'horas' sau fără unitate, verificăm dacă este timp sau număr
    // PRIORITATE: Dacă DURACION este în format TIME (HH:MM:SS), returnează direct
    if (typeof duracion === 'string' && duracion.trim() !== '') {
      if (duracion.includes(':')) {
        // Verifică dacă este format TIME valid (HH:MM:SS sau HH:MM)
        const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
        if (timePattern.test(duracion.trim())) {
          return duracion.trim(); // Este deja formatat ca timp (HH:MM:SS)
        }
      }
      // Dacă UNIDAD_DURACION este 'horas', afișăm cu unitatea
      if (unidad === 'horas' || unidad === 'hora') {
        return `${duracion} ${unidad}`;
      }
      return unidad ? `${duracion} ${unidad}` : duracion;
    }
    if (typeof duracion === 'number') {
      // Dacă UNIDAD_DURACION este 'horas', formatăm ca timp
      if (unidad === 'horas' || unidad === 'hora') {
        const formatted = formatDecimalDuration(duracion);
        if (formatted) {
          return formatted;
        }
      }
      // Altfel, afișăm numărul direct cu unitatea
      return unidad ? `${duracion} ${unidad}` : duracion.toString();
    }

    return null;
  };

  const getAusenciaDurationDisplay = (item) => {
    const tipo = getFirstValue(item, ['TIPO', 'tipo']);
    const unidad = getFirstValue(item, ['UNIDAD_DURACION', 'unidad_duracion']);
    const duracion = getFirstValue(item, ['DURACION', 'duracion']);
    
    // IMPORTANT: Verifică UNIDAD_DURACION PRIMUL - dacă este 'horas', nu este day-based
    // Dacă UNIDAD_DURACION este explicit 'horas', atunci este pe ore, indiferent de tip
    const esHoras = unidad === 'horas' || unidad === 'hora';
    const esDias = unidad === 'dias' || unidad === 'día' || unidad === 'días';
    
    // Dacă UNIDAD_DURACION este explicit setat, folosim acel lucru
    // Altfel, verificăm tipul
    const isDayBased = esHoras ? false : (esDias ? true : isDayBasedAbsenceType(tipo));

    if (isDayBased) {
      // Pentru tipuri bazate pe zile, folosim DURACION direct dacă este disponibil
      if (duracion !== null && duracion !== undefined && duracion !== '') {
        const numDuracion = typeof duracion === 'number' ? duracion : parseFloat(duracion);
        if (!isNaN(numDuracion) && numDuracion > 0) {
          return {
            isDayBased: true,
            text: `${numDuracion} ${numDuracion === 1 ? 'día' : 'días'}`,
          };
        }
      }
      
      // Fallback la getApprovedDaysCount
      const days = getApprovedDaysCount(item);
      return {
        isDayBased: true,
        text: days > 0 ? `${days} día${days === 1 ? '' : 's'}` : 'Sin días',
      };
    }

    const hours = getApprovedHoursLabel(item);
    return {
      isDayBased: false,
      text: hours || 'Sin duración',
    };
  };

  const getUserName = useCallback((email) => {
    const user = allUsers.find(u => u['CORREO ELECTRONICO'] === email);
    return user ? (user['NOMBRE / APELLIDOS'] || email) : email;
  }, [allUsers]);

  // Extrage tipurile unice de ausencias din backend (doar când selectedTab === 'ausencias')
  const ausenciaTipos = useMemo(() => {
    if (selectedTab !== 'ausencias' || !allAusencias || allAusencias.length === 0) {
      return [];
    }
    
    // Extrage tipurile unice din allAusencias
    const tiposSet = new Set();
    allAusencias.forEach(ausencia => {
      const tipo = ausencia.TIPO || ausencia.tipo || '';
      if (tipo && tipo.trim() !== '') {
        tiposSet.add(tipo.trim());
      }
    });
    
    // Sortează tipurile alfabetic
    return Array.from(tiposSet).sort();
  }, [selectedTab, allAusencias]);

  const getFilteredSolicitudes = useMemo(() => {
    if (selectedTab === 'control_vacaciones') {
      return [];
    }

    let filtered;
    
    // Selectează sursa de date în funcție de tab-ul selectat
    if (selectedTab === 'ausencias') {
      // Combină allAusencias cu solicitările Pendiente/Rechazada din allSolicitudes (tip ausencia) ca să apară și cele rechazade
      const ausenciaTipos = (t) => {
        const lower = (t || '').toLowerCase();
        return !lower.includes('vacacion') && !lower.includes('asunto propio') && !lower.includes('baja_voluntaria') && (lower.includes('ausencia') || lower.includes('permiso') || lower.includes('retribuido') || lower.includes('salida') || lower.includes('justificada'));
      };
      const pendienteOrRechazada = allSolicitudes.filter(s => {
        const estado = (s.estado || s.ESTADO || '').toLowerCase();
        return (estado === 'pendiente' || estado === 'rechazada') && ausenciaTipos(s.tipo || s.TIPO);
      });
      const toAusenciaShape = (s) => ({
        ...s,
        id: s.id || s.ID,
        TIPO: s.tipo || s.TIPO,
        tipo: s.tipo || s.TIPO,
        FECHA: s.FECHA || (s.fecha_inicio && s.fecha_fin ? `${s.fecha_inicio} - ${s.fecha_fin}` : s.fecha_inicio || s.fecha_fin),
        fecha: s.fecha_inicio || s.fecha_fin || s.FECHA,
        CODIGO: s.codigo || s.CODIGO,
        codigo: s.codigo || s.CODIGO,
        NOMBRE: s.nombre || s.NOMBRE,
        nombre: s.nombre || s.NOMBRE,
        ESTADO: s.estado || s.ESTADO,
        estado: s.estado || s.ESTADO,
        fecha_solicitud: s.fecha_solicitud || s.created_at,
        created_at: s.fecha_solicitud || s.created_at,
      });
      const existingKeys = new Set(
        allAusencias.map(a => `${(a.TIPO || a.tipo || '').trim()}_${(a.CODIGO || a.codigo || '')}_${(a.FECHA || a.fecha_inicio || a.fecha || '').toString().substring(0, 10)}`)
      );
      const extra = pendienteOrRechazada
        .map(toAusenciaShape)
        .filter(s => !existingKeys.has(`${(s.TIPO || s.tipo || '').trim()}_${(s.CODIGO || s.codigo || '')}_${(s.fecha_inicio || (s.FECHA || '').split(' - ')[0] || '').toString().substring(0, 10)}`));
      filtered = [...allAusencias, ...extra];
    } else if (selectedTab === 'baja') {
      // Formatează și deduplică bazându-ne pe cheia unică (Id.Caso + Id.Posición)
      const formatted = allBajasMedicas.map(formatBajaRecord);
      // Elimină duplicate-urile bazându-ne pe ID-ul unic
      const seen = new Set();
      filtered = formatted.filter(item => {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      });
      
      // Aplică filtrul de bajas (cerradas/abiertas)
      if (bajaFilter === 'cerradas') {
        filtered = filtered.filter(item => {
          const situacion = String(item.situacion || item.estado || '').toLowerCase();
          return situacion.includes('alta') && !situacion.includes('prevista');
        });
      } else if (bajaFilter === 'abiertas') {
        filtered = filtered.filter(item => {
          const situacion = String(item.situacion || item.estado || '').toLowerCase();
          return !situacion.includes('alta') || situacion.includes('prevista');
        });
      }
      // Dacă bajaFilter === null, afișează toate (nu filtrează)
    } else {
      filtered = allSolicitudes;
    }
    
    if (selectedUser !== 'ALL') {
      if (selectedTab === 'ausencias') {
        // Pentru absențe, filtrăm după CODIGO sau NOMBRE
        filtered = filtered.filter(a => {
          const userCode = a.CODIGO || a.codigo || '';
          const userName = a.NOMBRE || a.nombre || '';
          const selectedUserData = allUsers.find(u => u['CORREO ELECTRONICO'] === selectedUser);
          if (selectedUserData) {
            const selectedUserCode = selectedUserData['CODIGO'] || selectedUserData.codigo || '';
            const selectedUserName = selectedUserData['NOMBRE / APELLIDOS'] || selectedUserData.nombre || '';
            return userCode === selectedUserCode || userName === selectedUserName;
          }
          return false;
        });
      } else {
        filtered = filtered.filter(s => s.email === selectedUser);
      }
    }
    
    if (selectedTab === 'asunto') {
      filtered = filtered.filter(s => s.tipo === 'Asunto Propio');
    } else if (selectedTab === 'vacaciones') {
      filtered = filtered.filter(s => s.tipo === 'Vacaciones');
    } else if (selectedTab === 'baja') {
      filtered = filtered.filter(s => isBajaMedica(s.tipo));
    } else if (selectedTab === 'baja_voluntaria') {
      filtered = filtered.filter(s => s.tipo === 'BAJA_VOLUNTARIA');
    } else if (selectedTab === 'aprobacion') {
      // Tab pentru cererile pendiente de aprobare (Permiso Retribuido, BAJA_VOLUNTARIA, Ausencias justificada)
      filtered = filtered.filter(s => {
        const tipo = (s.tipo || s.TIPO || '').toLowerCase();
        const estado = (s.estado || s.ESTADO || '').toLowerCase();
        const esPermisoRetribuido = tipo.includes('permiso') && tipo.includes('retribuido');
        const esBajaVoluntaria = tipo.includes('baja') && tipo.includes('voluntaria');
        const esAusenciaJustificada = tipo.includes('ausencias') && tipo.includes('justificada');
        return estado === 'pendiente' && (esPermisoRetribuido || esBajaVoluntaria || esAusenciaJustificada);
      });
    }
    if (selectedMonth > 0) {
      filtered = filtered.filter((s) => {
        if (selectedTab === 'ausencias') {
          if (s.FECHA && String(s.FECHA).includes(' - ')) {
            return solicitudSolapaMesCalendario(s, selectedMonth, vacationControlYear);
          }
          const fechaInicio = s.FECHA || s.fecha || '';
          if (!fechaInicio) return false;
          const ymd = String(fechaInicio).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (ymd) {
            return (
              parseInt(ymd[2], 10) === selectedMonth &&
              parseInt(ymd[1], 10) === vacationControlYear
            );
          }
          const luna = parseInt(String(fechaInicio).split(/[-/]/)[1] || '0', 10);
          return luna === selectedMonth;
        }
        // Solicitudes (Vacaciones, etc.): solapamiento con el mes/año (mismo criterio que Control vacaciones)
        return solicitudSolapaMesCalendario(s, selectedMonth, vacationControlYear);
      });
    }
    
    // Filtru după tip de ausencia (doar pentru tab-ul 'ausencias')
    if (selectedTab === 'ausencias' && !selectedTipoAusencia.includes('ALL') && selectedTipoAusencia.length > 0) {
      filtered = filtered.filter(s => {
        const tipo = (s.TIPO || s.tipo || '').trim();
        // Verifică dacă tipul este în array-ul de tipuri selectate
        return selectedTipoAusencia.includes(tipo);
      });
    }
    
    // Sortare după fecha_solicitud (data solicitării) - cele mai recente sus
    const sorted = filtered.sort((a, b) => {
      let createdA, createdB;
      if (selectedTab === 'ausencias') {
        // Pentru ausencias, prioritizăm fecha_solicitud sau created_at
        createdA = a.fecha_solicitud || a.created_at || a.FECHA || a.fecha || '';
        createdB = b.fecha_solicitud || b.created_at || b.FECHA || b.fecha || '';
      } else {
        // Pentru alte taburi, prioritizăm fecha_solicitud
        createdA = a.fecha_solicitud || a.created_at || a.fecha || '';
        createdB = b.fecha_solicitud || b.created_at || b.fecha || '';
      }
      
      // Compară ca Date dacă e posibil, altfel ca string
      if (createdA && createdB) {
        const dateA = new Date(createdA);
        const dateB = new Date(createdB);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime(); // Descendent - cea mai nouă primul
        }
        // Fallback: compară ca string
        return createdB.localeCompare(createdA);
      }
      // Dacă una lipsește, o punem la sfârșit
      if (createdA && !createdB) return -1;
      if (!createdA && createdB) return 1;
      return 0;
    });
    return sorted;
  }, [
    selectedTab,
    selectedUser,
    selectedMonth,
    selectedTipoAusencia,
    allAusencias,
    allSolicitudes,
    allBajasMedicas,
    allUsers,
    bajaFilter,
    vacationControlYear,
  ]);

  /**
   * Por grupo y mes: cuántos empleados activos distintos tienen al menos un día de vacaciones
   * (Aprobada/Pendiente) en ese mes / N activos del grupo. N y X solo cuentan ESTADO activo (como estadísticas API).
   */
  const vacationControlByGroupMonth = useMemo(() => {
    if (!allSolicitudes?.length || !allUsers?.length) return [];
    const isEmpleadoActivo = (u) =>
      String(u?.ESTADO ?? u?.estado ?? '')
        .trim()
        .toUpperCase() === 'ACTIVO';

    /** El listado global de solicitudes (GET /solicitudes) no trae `grupo`; hay que tomarlo del empleado activo por codigo/email. */
    const vacSol = allSolicitudes.filter((s) => {
      const t = String(s.tipo || s.TIPO || '')
        .trim()
        .toLowerCase();
      if (t !== 'vacaciones') return false;
      const e = (s.estado || s.ESTADO || '').trim();
      return e === 'Aprobada' || e === 'Pendiente';
    });

    const activeUsers = allUsers.filter(isEmpleadoActivo);
    const userByCodigo = new Map();
    const userByEmail = new Map();
    activeUsers.forEach((u) => {
      const c = String(u.CODIGO ?? u.codigo ?? '')
        .trim();
      const m = String(
        u['CORREO ELECTRONICO'] || u.CORREO_ELECTRONICO || u.EMAIL || u.email || '',
      ).toLowerCase();
      if (c) userByCodigo.set(c, u);
      if (m) userByEmail.set(m, u);
    });

    const resolveActiveUserForSol = (sol) => {
      const c = String(sol.codigo || sol.CODIGO || '')
        .trim();
      if (c && userByCodigo.has(c)) return userByCodigo.get(c);
      const mail = String(
        sol.email || sol.EMAIL || sol['CORREO ELECTRONICO'] || '',
      ).toLowerCase();
      if (mail && userByEmail.has(mail)) return userByEmail.get(mail);
      return null;
    };

    const groupSet = new Set();
    activeUsers.forEach((u) => {
      const gr = normalizeGroup(u['GRUPO'] || u.grupo || '');
      if (gr) groupSet.add(gr);
    });
    const groups = Array.from(groupSet).sort((a, b) => a.localeCompare(b));
    const year = vacationControlYear;
    const rows = [];
    for (const g of groups) {
      const groupUsers = activeUsers.filter(
        (u) => normalizeGroup(u['GRUPO'] || u.grupo || '') === g,
      );
      const groupSize = groupUsers.length;
      if (groupSize === 0) continue;

      const months = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(year, month, 1);
        monthStart.setHours(0, 0, 0, 0);
        const lastDay = getDaysInMonth(year, month);
        const monthEnd = new Date(year, month, lastDay);
        monthEnd.setHours(0, 0, 0, 0);

        const empleadosEnMes = new Set();
        vacSol.forEach((sol) => {
          const emp = resolveActiveUserForSol(sol);
          if (!emp) return;
          const sg = normalizeGroup(emp['GRUPO'] || emp.grupo || '');
          if (sg !== g) return;

          const range = getSolicitudRangoFechasLocal(sol);
          if (!range) return;
          const { start, end } = range;
          if (end < monthStart || start > monthEnd) return;

          const uniq =
            String(emp.CODIGO || emp.codigo || '').trim() ||
            String(
              emp['CORREO ELECTRONICO'] ||
                emp.CORREO_ELECTRONICO ||
                emp.email ||
                '',
            ).toLowerCase();
          if (uniq) empleadosEnMes.add(uniq);
        });

        const empleadosConVacaciones = empleadosEnMes.size;
        const empleadosDisponiblesCubrir = Math.max(
          0,
          groupSize - empleadosConVacaciones,
        );

        let picoSimultaneosMes = 0;
        for (let day = 1; day <= lastDay; day++) {
          const d = new Date(year, month, day);
          d.setHours(0, 0, 0, 0);
          const enEsteDia = new Set();
          vacSol.forEach((sol) => {
            const emp = resolveActiveUserForSol(sol);
            if (!emp) return;
            const sg = normalizeGroup(emp['GRUPO'] || emp.grupo || '');
            if (sg !== g) return;
            const range = getSolicitudRangoFechasLocal(sol);
            if (!range) return;
            const { start, end } = range;
            if (end < d || start > d) return;
            const uniq =
              String(emp.CODIGO || emp.codigo || '').trim() ||
              String(
                emp['CORREO ELECTRONICO'] ||
                  emp.CORREO_ELECTRONICO ||
                  emp.email ||
                  '',
              ).toLowerCase();
            if (uniq) enEsteDia.add(uniq);
          });
          picoSimultaneosMes = Math.max(picoSimultaneosMes, enEsteDia.size);
        }

        const limiteSimultaneosDia = getAvailabilityLimit(
          month,
          groupSize,
          'Vacaciones',
        );

        months.push({
          monthIndex: month,
          monthLabel: MONTHS[month + 1] || String(month + 1),
          empleadosConVacaciones,
          empleadosDisponiblesCubrir,
          picoSimultaneosMes,
          limiteSimultaneosDia,
          groupSize,
        });
      }
      rows.push({ group: g, groupSize, months });
    }
    return rows;
  }, [allSolicitudes, allUsers, vacationControlYear, getAvailabilityLimit]);

  /**
   * Estimación de contratación (personal NUEVO): déficit mensual = pico simultáneo de vacaciones − límite
   * diario del grupo (misma regla que «Pico día / lím.» arriba). No asigna cobertura a la plantilla actual
   * (evita lógica de horas extra / SS). Mínimo de refuerzos a contratar «a la vez» en el peor mes =
   * max(deficits). Ese mismo número puede cubrir varios meses del año si en ningún día se supera ese pico.
   */
  const vacationNewHireEstimateByGroup = useMemo(() => {
    return vacationControlByGroupMonth.map((row) => {
      const deficits = row.months.map((m) =>
        Math.max(0, m.picoSimultaneosMes - m.limiteSimultaneosDia),
      );
      const deficitMax = deficits.length ? Math.max(0, ...deficits) : 0;
      const mesesConDeficit = deficits.filter((d) => d > 0).length;
      return {
        group: row.group,
        groupSize: row.groupSize,
        deficitMax,
        mesesConDeficit,
        deficits,
        months: row.months,
      };
    });
  }, [vacationControlByGroupMonth]);

  /**
   * Limpiador y «Auxiliar De Servicios - L»: activos con contrato que implica menos de 8 h/día Lun–Vie.
   * Contrato: `HORAS DE CONTRATO` — si > 12 → semanal ÷5; si no → diario.
   * Horario: registro en tabla `horarios` con mismo CENTRO TRABAJO + GRUPO y vigencia actual; usa
   * total_horas_semanales o total_minutos_semanales → h/día = ÷5.
   * Subida contrato: referencia 40 h/semana; «Puede subir» = 40 − h/sem según contrato (orientativo).
   */
  const vacationControlLimpiadorPartTimeList = useMemo(() => {
    const parseHorasContrato = (raw) => {
      const s = String(raw ?? '').trim();
      if (!s) return null;
      const m = s.match(/(\d+(?:[.,]\d+)?)/);
      if (!m) return null;
      const n = parseFloat(String(m[1]).replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0) return null;
      return n;
    };
    const inferDailyMonFri = (n) => {
      if (n > 12) return n / 5;
      return n;
    };
    const parseDateMs = (d) => {
      if (d == null || d === '') return null;
      const t = new Date(d).getTime();
      return Number.isNaN(t) ? null : t;
    };
    const findHorarioVigente = (centro, grupo) => {
      const c = String(centro || '').trim().toLowerCase();
      const g = String(grupo || '').trim().toLowerCase();
      if (!c || !g || !horariosCatalog?.length) return null;
      const t = Date.now();
      const candidates = horariosCatalog.filter((h) => {
        const hc = String(h.centro_nombre ?? h.centroNombre ?? '').trim().toLowerCase();
        const hg = String(h.grupo_nombre ?? h.grupoNombre ?? '').trim().toLowerCase();
        return hc === c && hg === g;
      });
      const valid = candidates.filter((h) => {
        const vd = parseDateMs(h.vigente_desde ?? h.vigenteDesde);
        const vh = parseDateMs(h.vigente_hasta ?? h.vigenteHasta);
        const vdOk = vd == null || t >= vd;
        const vhOk = vh == null || t <= vh;
        return vdOk && vhOk;
      });
      const pool = valid.length ? valid : candidates;
      if (!pool.length) return null;
      return [...pool].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
    };
    const horasSemanalesDesdeHorario = (h) => {
      if (!h) return null;
      const th = Number(h.total_horas_semanales ?? h.totalHorasSemanales);
      if (Number.isFinite(th) && th > 0) return th;
      const tm = Number(h.total_minutos_semanales ?? h.totalMinutosSemanales);
      if (Number.isFinite(tm) && tm > 0) return tm / 60;
      return null;
    };

    const TARGET_DAILY = 8;
    /** Referencia jornada completa semanal (España); margen de subida de contrato hasta este tope */
    const MAX_H_SEMANALES_CONTRATO_REF = 40;
    const isActivo = (u) =>
      String(u?.ESTADO ?? u?.estado ?? '')
        .trim()
        .toUpperCase() === 'ACTIVO';

    const rows = [];
    (allUsers || []).forEach((u) => {
      if (!isActivo(u)) return;
      const rawGrupo = String(u['GRUPO'] || u.grupo || '').trim();
      if (normalizeGroup(rawGrupo) !== 'Limpiador') return;

      const rawHoras =
        u['HORAS DE CONTRATO'] ??
        u.HORAS_DE_CONTRATO ??
        u.horas_contrato ??
        u.horasContrato;
      const num = parseHorasContrato(rawHoras);
      if (num == null) return;

      const horasDia = inferDailyMonFri(num);
      if (horasDia >= TARGET_DAILY - 1e-6) return;

      const horasHasta8 = Math.max(0, TARGET_DAILY - horasDia);
      const nombre =
        u['NOMBRE / APELLIDOS'] ||
        u.NOMBRE_APELLIDOS ||
        u.nombre ||
        u['CODIGO'];

      const centroTrabajo = String(
        u['CENTRO TRABAJO'] || u.CENTRO_TRABAJO || u.centro_trabajo || u.centroTrabajo || '',
      ).trim();
      const hRec = findHorarioVigente(centroTrabajo, rawGrupo);
      const hs = horasSemanalesDesdeHorario(hRec);
      const horasDiaHorario =
        hs != null ? Math.round((hs / 5) * 100) / 100 : null;
      const horasDisponiblesHasta8Horario =
        horasDiaHorario != null
          ? Math.round(Math.max(0, TARGET_DAILY - horasDiaHorario) * 100) / 100
          : null;

      const horasSemanalesContrato =
        Math.round((num > 12 ? num : num * 5) * 100) / 100;
      const puedeSubirContratoHasta40Semanal = Math.round(
        Math.max(0, MAX_H_SEMANALES_CONTRATO_REF - horasSemanalesContrato) * 100,
      ) / 100;

      rows.push({
        codigo: String(u.CODIGO ?? u.codigo ?? '').trim(),
        nombre: String(nombre || '').trim(),
        grupoRaw: rawGrupo,
        centroTrabajo,
        horasContratoRaw: String(rawHoras),
        interpretacionSemanal: num > 12,
        horasDia: Math.round(horasDia * 100) / 100,
        horasDisponiblesHasta8: Math.round(horasHasta8 * 100) / 100,
        horasSemanalesContrato,
        puedeSubirContratoHasta40Semanal,
        horarioNombre: hRec ? String(hRec.nombre || '').trim() : '',
        horarioId: hRec?.id ?? null,
        horasSemanalesHorario:
          hs != null ? Math.round(hs * 100) / 100 : null,
        horasDiaHorario,
        horasDisponiblesHasta8Horario,
      });
    });
    rows.sort((a, b) => b.horasDisponiblesHasta8 - a.horasDisponiblesHasta8);
    return rows;
  }, [allUsers, horariosCatalog]);

  /**
   * Misma lista Limpiador/L + cruce con solicitudes de vacaciones (Aprobada/Pendiente) en el mes
   * seleccionado y año vacationControlYear. «Refuerzo» = no en vacaciones ese mes y con margen hasta 8 h.
   */
  const vacationControlLimpiadorPartTimeWithVacationMonth = useMemo(() => {
    const vacSol = (allSolicitudes || []).filter((s) => {
      const t = String(s.tipo || s.TIPO || '')
        .trim()
        .toLowerCase();
      if (t !== 'vacaciones') return false;
      const e = (s.estado || s.ESTADO || '').trim();
      return e === 'Aprobada' || e === 'Pendiente';
    });

    const activeUsers = (allUsers || []).filter(
      (u) =>
        String(u?.ESTADO ?? u?.estado ?? '')
          .trim()
          .toUpperCase() === 'ACTIVO',
    );
    const userByCodigo = new Map();
    const userByEmail = new Map();
    activeUsers.forEach((u) => {
      const c = String(u.CODIGO ?? u.codigo ?? '').trim();
      const m = String(
        u['CORREO ELECTRONICO'] || u.CORREO_ELECTRONICO || u.EMAIL || u.email || '',
      ).toLowerCase();
      if (c) userByCodigo.set(c, u);
      if (m) userByEmail.set(m, u);
    });

    const resolveActiveUserForSol = (sol) => {
      const c = String(sol.codigo || sol.CODIGO || '').trim();
      if (c && userByCodigo.has(c)) return userByCodigo.get(c);
      const mail = String(
        sol.email || sol.EMAIL || sol['CORREO ELECTRONICO'] || '',
      ).toLowerCase();
      if (mail && userByEmail.has(mail)) return userByEmail.get(mail);
      return null;
    };

    const year = vacationControlYear;
    const monthIdx = vacationPartTimeCompareMonth;
    const lastDay = getDaysInMonth(year, monthIdx);
    const monthStart = new Date(year, monthIdx, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, monthIdx, lastDay);
    monthEnd.setHours(0, 0, 0, 0);

    const hasVacationInSelectedMonth = (codigo) => {
      const c = String(codigo || '').trim();
      if (!c) return false;
      return vacSol.some((sol) => {
        const emp = resolveActiveUserForSol(sol);
        if (!emp) return false;
        const sc = String(emp.CODIGO || emp.codigo || '').trim();
        if (sc !== c) return false;
        const range = getSolicitudRangoFechasLocal(sol);
        if (!range) return false;
        const { start, end } = range;
        return !(end < monthStart || start > monthEnd);
      });
    };

    return vacationControlLimpiadorPartTimeList.map((row) => {
      const enVac = hasVacationInSelectedMonth(row.codigo);
      const margenContr = row.horasDisponiblesHasta8;
      const margenHor = row.horasDisponiblesHasta8Horario;
      const tieneMargen =
        margenContr > 0.05 ||
        (margenHor != null && margenHor > 0.05);
      const puedeSubir40 =
        row.puedeSubirContratoHasta40Semanal != null &&
        row.puedeSubirContratoHasta40Semanal > 0.05;
      /** Candidato a refuerzo: margen actual o posibilidad de subir contrato hacia 40 h/sem (referencia) */
      const refuerzoPosible = !enVac && (tieneMargen || puedeSubir40);
      let refuerzoDetalle = `Hasta ${margenContr.toFixed(1)} h/día según contrato`;
      if (margenHor != null) {
        refuerzoDetalle += `; hasta ${margenHor.toFixed(1)} h/día según horario`;
      }
      if (puedeSubir40) {
        refuerzoDetalle += `. Subida posible: +${row.puedeSubirContratoHasta40Semanal.toFixed(1)} h/sem hasta 40 h/sem (ref.)`;
      }
      return {
        ...row,
        enVacacionesEnMesSeleccionado: enVac,
        refuerzoPosibleJornada: refuerzoPosible,
        refuerzoDetalle,
      };
    });
  }, [
    vacationControlLimpiadorPartTimeList,
    vacationPartTimeCompareMonth,
    vacationControlYear,
    allSolicitudes,
    allUsers,
  ]);

  const vacationPartTimeCompareSummary = useMemo(() => {
    const list = vacationControlLimpiadorPartTimeWithVacationMonth;
    const enVac = list.filter((x) => x.enVacacionesEnMesSeleccionado);
    const refuerzo = list.filter((x) => x.refuerzoPosibleJornada);
    return {
      enVacacionesCount: enVac.length,
      refuerzoCount: refuerzo.length,
      enVacacionesNombres: enVac.map((x) => x.nombre).filter(Boolean),
      refuerzoNombres: refuerzo.map((x) => x.nombre).filter(Boolean),
    };
  }, [vacationControlLimpiadorPartTimeWithVacationMonth]);

  /**
   * Por cada candidato a refuerzo: compañeros en vacaciones en el mes (misma lista) que podría cubrir
   * (mismo CENTRO; prioridad mismo GRUPO). Segunda columna: mismo GRUPO pero OTRO centro.
   * Horas: máx. h/día = max(h/día+margen, 8) si «Puede subir»>0 hacia 40 h/sem; si no, solo h/día+margen.
   * Así se cuenta una posible subida de contrato para cubrir el puesto (orientativo).
   */
  const vacationPartTimeRefuerzoCobertura = useMemo(() => {
    const list = vacationControlLimpiadorPartTimeWithVacationMonth;
    const vacRows = list.filter((r) => r.enVacacionesEnMesSeleccionado);
    const refRows = list.filter((r) => r.refuerzoPosibleJornada);

    const normC = (r) => String(r.centroTrabajo || '').trim().toLowerCase();
    const normG = (r) => String(r.grupoRaw || '').trim().toLowerCase();

    const sameCentro = (a, b) => {
      const ca = normC(a);
      const cb = normC(b);
      return ca.length > 0 && ca === cb;
    };
    const sameGrupo = (a, b) => normG(a) === normG(b);

    /** h/día del puesto que queda vacante: preferir horario del compañero; si no, contrato */
    const horasPuestoACubrir = (v) => {
      if (v.horasDiaHorario != null && Number.isFinite(v.horasDiaHorario)) return v.horasDiaHorario;
      if (Number.isFinite(v.horasDia)) return v.horasDia;
      return null;
    };
    /** Margen del refuerzo hasta completar jornada 8 h: lo más restrictivo entre contrato y horario */
    const margenRefuerzoHacia8 = (r) => {
      const mC = r.horasDisponiblesHasta8;
      const mH = r.horasDisponiblesHasta8Horario;
      const okC = Number.isFinite(mC);
      const okH = mH != null && Number.isFinite(mH);
      if (okC && okH) return Math.min(mC, mH);
      if (okC) return mC;
      if (okH) return mH;
      return null;
    };
    /** Máx. h/día que el refuerzo puede alcanzar (h/día contrato + margen hacia 8 h). Suele ser 8. */
    const maxHorasDiaRefuerzo = (r) => {
      const m = margenRefuerzoHacia8(r);
      const hd = r.horasDia;
      if (m == null || !Number.isFinite(hd)) return null;
      return hd + m;
    };
    const JORNADA_REF_DIA = 8;
    /**
     * Techo h/día para cubrir bajas: si aún puede subir contrato hacia 40 h/sem, se admite hasta 8 h/día
     * (misma referencia que «Puede subir» en la tabla); si no, solo el máximo actual.
     */
    const maxHorasDiaRefuerzoInclSubida = (r) => {
      const base = maxHorasDiaRefuerzo(r);
      const puedeSubir =
        r.puedeSubirContratoHasta40Semanal != null &&
        r.puedeSubirContratoHasta40Semanal > 0.05;
      if (puedeSubir) {
        const b = base != null && Number.isFinite(base) ? base : 0;
        return Math.max(b, JORNADA_REF_DIA);
      }
      return base;
    };
    const HORAS_TOL = 0.05;
    /** El puesto pide `nec` h/día; el refuerzo debe poder llegar al menos a eso (incl. subida teórica a 40 h/sem). */
    const puedeCubrirPorHoras = (r, v) => {
      const nec = horasPuestoACubrir(v);
      const max = maxHorasDiaRefuerzoInclSubida(r);
      if (nec == null || nec <= 0) return false;
      if (max == null || !Number.isFinite(max)) return false;
      return max + 1e-6 >= nec - HORAS_TOL;
    };

    /**
     * Referencia orientativa: si en un mismo día se suman h/día propias del refuerzo (máx. contrato vs horario)
     * y las h/día del puesto a cubrir, ¿se supera el tope de 8 h/día? Devuelve el exceso en horas o 0.
     */
    const horasDiaPropiaRefuerzo = (r) => {
      const c = Number.isFinite(r.horasDia) ? r.horasDia : 0;
      const h =
        r.horasDiaHorario != null && Number.isFinite(r.horasDiaHorario)
          ? r.horasDiaHorario
          : null;
      if (h == null) return c;
      return Math.max(c, h);
    };
    const excesoSobre8hCombinadoRefVac = (ref, vac) => {
      const nec = horasPuestoACubrir(vac);
      if (nec == null || !Number.isFinite(nec) || nec <= 0) return 0;
      const propia = horasDiaPropiaRefuerzo(ref);
      if (!Number.isFinite(propia)) return 0;
      const suma = propia + nec;
      if (suma <= JORNADA_REF_DIA + HORAS_TOL) return 0;
      return Math.round((suma - JORNADA_REF_DIA) * 100) / 100;
    };
    /** `quien`: nombre del refuerzo (lista «le pueden cubrir») o del compañero en vacaciones (lista «cubre»). */
    const etiquetaRefVacConExceso8h = (ref, vac, quien) => {
      const ex = excesoSobre8hCombinadoRefVac(ref, vac);
      const nome =
        quien === 'refuerzo'
          ? String(ref.nombre || ref.codigo || '').trim()
          : String(vac.nombre || vac.codigo || '').trim();
      if (ex <= 0) return nome;
      return `${nome} (+${ex} h sobre 8 h/día)`;
    };

    const refCandidatesAll = list.filter((r) => r.refuerzoPosibleJornada);

    const quienPuedeCubrirAVacacion = (v) => {
      const ideal = [];
      const soloCentro = [];
      for (const c of refCandidatesAll) {
        if (String(c.codigo || '') === String(v.codigo || '')) continue;
        if (!sameCentro(c, v)) continue;
        if (!puedeCubrirPorHoras(c, v)) continue;
        if (sameGrupo(c, v)) ideal.push(c);
        else soloCentro.push(c);
      }
      const idealCodes = new Set(ideal.map((x) => x.codigo));
      const soloCentroFiltered = soloCentro.filter((x) => !idealCodes.has(x.codigo));
      const parts = [];
      if (ideal.length) {
        parts.push(
          `Mismo centro y grupo: ${ideal.map((c) => etiquetaRefVacConExceso8h(c, v, 'refuerzo')).join(', ')}`,
        );
      }
      if (soloCentroFiltered.length) {
        parts.push(
          `Mismo centro (otro grupo): ${soloCentroFiltered.map((c) => etiquetaRefVacConExceso8h(c, v, 'refuerzo')).join(', ')}`,
        );
      }
      const otroCentroMg = [];
      for (const c of refCandidatesAll) {
        if (String(c.codigo || '') === String(v.codigo || '')) continue;
        if (!normC(c).length || !normC(v).length) continue;
        if (sameCentro(c, v)) continue;
        if (!sameGrupo(c, v)) continue;
        if (!puedeCubrirPorHoras(c, v)) continue;
        otroCentroMg.push(c);
      }
      otroCentroMg.sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'),
      );
      const otroParts =
        otroCentroMg.length > 0
          ? [
              `Mismo grupo, otro centro: ${otroCentroMg.map((c) => etiquetaRefVacConExceso8h(c, v, 'refuerzo')).join(', ')}`,
            ]
          : [];
      const otroTooltip =
        otroParts.length > 0
          ? `${otroParts.join('\n')}\n\nCandidatos refuerzo en esta lista que podrían cubrir tu puesto (mismas reglas de horas y subida). Si «+X h sobre 8 h/día»: suma orientativa de tu jornada habitual (máx. contr./horario) + h/día del puesto a cubrir; la organización reparte horas y límites legales.`
          : '';
      return {
        lePuedenCubrirMismoCentroEtiqueta: parts.length ? parts.join(' · ') : null,
        lePuedenCubrirMismoCentroTooltip: parts.length
          ? `${parts.join('\n')}\n\nQuién puede cubrir tu vacación si estás de baja (mismo centro). «+X h sobre 8 h/día»: suma orientativa jornada del candidato + tu puesto (mismo día); orientativo.`
          : '',
        lePuedenCubrirOtroCentroEtiqueta: otroParts.length ? otroParts.join(' · ') : null,
        lePuedenCubrirOtroCentroTooltip: otroTooltip,
      };
    };

    const rows = list.map((row) => {
      if (!row.refuerzoPosibleJornada) {
        const vacExtra = row.enVacacionesEnMesSeleccionado
          ? quienPuedeCubrirAVacacion(row)
          : {
              lePuedenCubrirMismoCentroEtiqueta: null,
              lePuedenCubrirMismoCentroTooltip: '',
              lePuedenCubrirOtroCentroEtiqueta: null,
              lePuedenCubrirOtroCentroTooltip: '',
            };
        return {
          ...row,
          refuerzoVacantesIdeal: [],
          refuerzoVacantesSoloCentro: [],
          refuerzoVacantesEtiqueta: null,
          refuerzoVacantesTooltip: '',
          refuerzoVacantesOtroCentro: [],
          refuerzoVacantesOtroCentroEtiqueta: null,
          refuerzoVacantesOtroCentroTooltip: '',
          ...vacExtra,
        };
      }
      const ideal = [];
      const soloCentro = [];
      for (const v of vacRows) {
        if (String(v.codigo || '') === String(row.codigo || '')) continue;
        if (!sameCentro(row, v)) continue;
        if (!puedeCubrirPorHoras(row, v)) continue;
        if (sameGrupo(row, v)) ideal.push(v);
        else soloCentro.push(v);
      }
      const idealCodes = new Set(ideal.map((x) => x.codigo));
      const soloCentroFiltered = soloCentro.filter((x) => !idealCodes.has(x.codigo));

      const parts = [];
      if (ideal.length) {
        parts.push(
          `Mismo centro y grupo: ${ideal.map((vac) => etiquetaRefVacConExceso8h(row, vac, 'vacacion')).join(', ')}`,
        );
      }
      if (soloCentroFiltered.length) {
        parts.push(
          `Mismo centro (otro grupo): ${soloCentroFiltered.map((vac) => etiquetaRefVacConExceso8h(row, vac, 'vacacion')).join(', ')}`,
        );
      }
      const refuerzoVacantesEtiqueta = parts.length ? parts.join(' · ') : null;
      const refuerzoVacantesTooltip = parts.length
        ? `${parts.join('\n')}\n\nIncluye posible subida de contrato hasta 40 h/sem (tope 8 h/día) si «Puede subir»>0. «+X h sobre 8 h/día»: suma orientativa de tu jornada (máx. contr./horario) + h/día del puesto del compañero en vacaciones (mismo día); orientativo.`
        : '';

      /** Mismo grupo, distinto centro (no incluye mismo centro). Requiere centro en ambas fichas. */
      const otroCentroMismoGrupo = [];
      for (const v of vacRows) {
        if (String(v.codigo || '') === String(row.codigo || '')) continue;
        if (!normC(row).length || !normC(v).length) continue;
        if (sameCentro(row, v)) continue;
        if (!sameGrupo(row, v)) continue;
        if (!puedeCubrirPorHoras(row, v)) continue;
        otroCentroMismoGrupo.push(v);
      }
      otroCentroMismoGrupo.sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'),
      );

      const otroParts = [];
      if (otroCentroMismoGrupo.length) {
        otroParts.push(
          `Mismo grupo, otro centro: ${otroCentroMismoGrupo.map((vac) => etiquetaRefVacConExceso8h(row, vac, 'vacacion')).join(', ')}`,
        );
      }
      const refuerzoVacantesOtroCentroEtiqueta = otroParts.length
        ? otroParts.join(' · ')
        : null;
      const refuerzoVacantesOtroCentroTooltip = otroParts.length
        ? `${otroParts.join('\n')}\n\nCada nombre es una baja distinta en el mes. Criterio de horas: máx. actual o 8 h/día si puede subir contrato (40 h/sem ref.). «+X h sobre 8 h/día»: suma orientativa jornada + puesto a cubrir. La organización decide la subida real.`
        : '';

      return {
        ...row,
        refuerzoVacantesIdeal: ideal,
        refuerzoVacantesSoloCentro: soloCentroFiltered,
        refuerzoVacantesEtiqueta,
        refuerzoVacantesTooltip,
        refuerzoVacantesOtroCentro: otroCentroMismoGrupo,
        refuerzoVacantesOtroCentroEtiqueta,
        refuerzoVacantesOtroCentroTooltip,
        lePuedenCubrirMismoCentroEtiqueta: null,
        lePuedenCubrirMismoCentroTooltip: '',
        lePuedenCubrirOtroCentroEtiqueta: null,
        lePuedenCubrirOtroCentroTooltip: '',
      };
    });

    const N = vacRows.length;
    let conCentroGrupo = 0;
    let conCentro = 0;
    for (const v of vacRows) {
      let okG = false;
      let okC = false;
      for (const r of refRows) {
        if (String(r.codigo || '') === String(v.codigo || '')) continue;
        if (!sameCentro(r, v)) continue;
        if (!puedeCubrirPorHoras(r, v)) continue;
        okC = true;
        if (sameGrupo(r, v)) okG = true;
      }
      if (okG) conCentroGrupo += 1;
      if (okC) conCentro += 1;
    }

    const pct = (a, n) => (n > 0 ? Math.round((a / n) * 1000) / 10 : null);

    return {
      rows,
      stats: {
        vacacionesTotal: N,
        cubiertasMismoCentroYGrupo: conCentroGrupo,
        cubiertasMismoCentro: conCentro,
        pctCentroYGrupo: pct(conCentroGrupo, N),
        pctCentro: pct(conCentro, N),
      },
    };
  }, [vacationControlLimpiadorPartTimeWithVacationMonth]);

  const exportLimpiadorRefuerzoTableXlsx = useCallback(async () => {
    const dataRows = vacationPartTimeRefuerzoCobertura?.rows ?? [];
    if (!dataRows.length) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Refuerzos', {
        views: [{ state: 'frozen', ySplit: 2 }],
      });
      const mesLabel = MONTHS[vacationPartTimeCompareMonth + 1] || '';
      const title = `Limpiador / Auxiliar L (< 8 h/día) — ${mesLabel} ${vacationControlYear}`;
      ws.mergeCells(1, 1, 1, 20);
      const tCell = ws.getCell(1, 1);
      tCell.value = title;
      tCell.font = { bold: true, size: 12 };
      tCell.alignment = { vertical: 'middle' };

      const headers = [
        'Código',
        'Nombre',
        'Centro',
        'Grupo',
        'H. contrato',
        'h/día (contr.)',
        'hasta 8 (contr.)',
        'H. sem. (contr.)',
        'Puede subir (h/sem)',
        'Horario (catálogo)',
        'Horario id',
        'H. sem. (horario)',
        'h/día (horario)',
        'hasta 8 (horario)',
        'Vac. mes',
        '¿Refuerzo?',
        'Cubre vac. (mismo centro)',
        'Cubre vac. (otro centro)',
        'Le pueden cubrir (mismo centro)',
        'Le pueden cubrir (otro centro)',
      ];
      const hr = ws.addRow(headers);
      hr.font = { bold: true };
      hr.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8DEF5' },
      };

      const yn = (b) => (b ? 'Sí' : 'No');
      dataRows.forEach((r) => {
        ws.addRow([
          r.codigo ?? '',
          r.nombre ?? '',
          r.centroTrabajo ?? '',
          r.grupoRaw ?? '',
          `${r.horasContratoRaw ?? ''}${r.interpretacionSemanal ? ' (sem.)' : ' (día)'}`,
          r.horasDia ?? '',
          r.horasDisponiblesHasta8 ?? '',
          r.horasSemanalesContrato ?? '',
          r.puedeSubirContratoHasta40Semanal ?? '',
          r.horarioNombre ?? '',
          r.horarioId ?? '',
          r.horasSemanalesHorario ?? '',
          r.horasDiaHorario ?? '',
          r.horasDisponiblesHasta8Horario ?? '',
          yn(r.enVacacionesEnMesSeleccionado),
          yn(r.refuerzoPosibleJornada),
          r.refuerzoVacantesEtiqueta ?? '',
          r.refuerzoVacantesOtroCentroEtiqueta ?? '',
          r.lePuedenCubrirMismoCentroEtiqueta ?? '',
          r.lePuedenCubrirOtroCentroEtiqueta ?? '',
        ]);
      });

      [10, 28, 36, 22, 12, 10, 10, 10, 10, 24, 8, 10, 10, 10, 8, 10, 36, 36, 36, 36].forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refuerzos-limpiador-L-${vacationControlYear}-${String(vacationPartTimeCompareMonth + 1).padStart(2, '0')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('No se pudo generar el Excel. Inténtalo de nuevo.');
    }
  }, [
    vacationPartTimeRefuerzoCobertura,
    vacationPartTimeCompareMonth,
    vacationControlYear,
  ]);

  /**
   * Estado por mes (año = vacationControlYear): Abierta vs Cerrada para solicitar vacaciones.
   * Cerrada si: (1) bloqueo API cubre todo el mes (como modal «Bloquear mes entero»), o (2) mes ya pasado por completo.
   */
  const vacationMonthHeaderStatus = useMemo(() => {
    const year = vacationControlYear;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = [];
    for (let month1 = 1; month1 <= 12; month1++) {
      const firstDay = `${year}-${String(month1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(year, month1, 0).getDate();
      const lastDay = `${year}-${String(month1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      const fullyBlockedByApi = (vacationBlockedPeriods || []).some((p) => {
        const inicio = (
          typeof p.fecha_inicio === 'string'
            ? p.fecha_inicio
            : p.fecha_inicio?.split?.('T')[0] ?? ''
        ).slice(0, 10);
        const fin = (
          typeof p.fecha_fin === 'string'
            ? p.fecha_fin
            : p.fecha_fin?.split?.('T')[0] ?? ''
        ).slice(0, 10);
        return inicio <= firstDay && fin >= lastDay;
      });
      const exactFullMonthPeriodId =
        (vacationBlockedPeriods || []).find((p) => {
          const inicio = (
            typeof p.fecha_inicio === 'string'
              ? p.fecha_inicio
              : p.fecha_inicio?.split?.('T')[0] ?? ''
          ).slice(0, 10);
          const fin = (
            typeof p.fecha_fin === 'string'
              ? p.fecha_fin
              : p.fecha_fin?.split?.('T')[0] ?? ''
          ).slice(0, 10);
          return inicio === firstDay && fin === lastDay;
        })?.id ?? null;
      const monthEnd = new Date(year, month1 - 1, lastDayNum);
      monthEnd.setHours(0, 0, 0, 0);
      const entirelyPast = monthEnd < today;

      let locked = false;
      let title = '';
      let reason = 'open';
      if (fullyBlockedByApi) {
        locked = true;
        reason = 'api';
        title =
          'Cerrada: mes bloqueado por administración (periodo que cubre todo el mes; no se pueden solicitar vacaciones en estas fechas).';
      } else if (entirelyPast) {
        locked = true;
        reason = 'past';
        title =
          'Cerrada: mes pasado (no se pueden solicitar nuevas vacaciones en fechas ya cerradas).';
      } else {
        locked = false;
        reason = 'open';
        title =
          'Abierta: se pueden solicitar vacaciones en fechas disponibles (pueden existir intervalos concretos o reglas de calendario).';
      }
      list.push({
        locked,
        title,
        reason,
        exactFullMonthPeriodId,
        fullyBlockedByApi,
        entirelyPast,
        firstDay,
        lastDay,
      });
    }
    return list;
  }, [vacationControlYear, vacationBlockedPeriods]);

  /** Empleados activos (API estadísticas): uso completo / parcial / sin consumo. */
  const vacationControlUso = useMemo(() => {
    const list = (estadisticas || []).map((emp) => {
      const v = emp.vacaciones;
      const consum = Number(v?.dias_consumidos_aprobados) || 0;
      const rest = Number(v?.dias_restantes) || 0;
      let estadoUso = 'sin_uso';
      if (consum > 0) {
        estadoUso = rest <= 0.01 ? 'completo' : 'parcial';
      }
      return { ...emp, consum, rest, estadoUso };
    });
    const summary = { completo: 0, parcial: 0, sin_uso: 0, total: list.length };
    list.forEach((e) => {
      if (e.estadoUso === 'completo') summary.completo++;
      else if (e.estadoUso === 'parcial') summary.parcial++;
      else summary.sin_uso++;
    });
    return { list, summary };
  }, [estadisticas]);

  const vacationControlEmpleadosFiltrados = useMemo(() => {
    let list = vacationControlUso.list;
    if (selectedUser !== 'ALL') {
      const u = allUsers.find(
        (x) =>
          (x['CORREO ELECTRONICO'] || x.EMAIL || x.email) === selectedUser,
      );
      const cod = u?.CODIGO || u?.codigo;
      if (cod) list = list.filter((e) => e.codigo === cod);
    }
    return list;
  }, [vacationControlUso, selectedUser, allUsers]);

  /** Todas → Vacaciones: empleados distintos en la lista filtrada (mismo filtro que la tabla; no el nº de solicitudes). */
  const vacacionesListaEmpleadosUnicos = useMemo(() => {
    if (selectedTab !== 'vacaciones') return 0;
    const keys = new Set();
    getFilteredSolicitudes.forEach((s) => {
      const em = String(s.email || s.EMAIL || '').trim().toLowerCase();
      const cod = String(s.codigo || s.CODIGO || '').trim();
      if (em) keys.add(`e:${em}`);
      else if (cod) keys.add(`c:${cod}`);
    });
    return keys.size;
  }, [getFilteredSolicitudes, selectedTab]);

  // Statistici pentru bajas médicas
  const bajasStats = useMemo(() => {
    if (selectedTab !== 'baja') {
      return { total: 0, cerradas: 0, abiertas: 0 };
    }
    
    const formatted = allBajasMedicas.map(formatBajaRecord);
    // Elimină duplicate-urile
    const seen = new Set();
    const uniqueBajas = formatted.filter(item => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
    
    const total = uniqueBajas.length;
    const cerradas = uniqueBajas.filter(item => {
      const situacion = String(item.situacion || item.estado || '').toLowerCase();
      return situacion.includes('alta') && !situacion.includes('prevista');
    }).length;
    const abiertas = total - cerradas;
    
    return { total, cerradas, abiertas };
  }, [selectedTab, allBajasMedicas]);

  const userList = useMemo(
    () => allUsers.map(u => u['CORREO ELECTRONICO']).filter(Boolean),
    [allUsers]
  );
  
  // Función para filtrar usuarios por búsqueda (memoizată pentru performanță)
  const getFilteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) {
      return [
        { email: 'ALL', name: 'Todos los empleados' },
        ...userList.map(email => ({
          email,
          name: getUserName(email)
        }))
      ];
    }
    
    const searchLower = userSearchTerm.toLowerCase();
    const filtered = userList
      .map(email => ({
        email,
        name: getUserName(email)
      }))
      .filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    
    return [
      { email: 'ALL', name: 'Todos los empleados' },
      ...filtered
    ];
  }, [userSearchTerm, userList, getUserName]);

  // Opțiuni pentru selectorul de angajat în modalul managerului
  const managerEmpleadoOptions = useMemo(() => {
    const term = managerEmpleadoSearch.toLowerCase().trim();
    const mapped = (allUsers || [])
      .map((u) => {
        const codigo = u?.['CODIGO'] || u?.codigo || '';
        const name = u?.['NOMBRE / APELLIDOS'] || u?.nombre || '';
        const email = u?.['CORREO ELECTRONICO'] || u?.EMAIL || u?.email || '';
        return {
          codigo: String(codigo || '').trim(),
          name: String(name || '').trim(),
          email: String(email || '').trim(),
        };
      })
      .filter((u) => u.codigo || u.email || u.name);

    const filtered = term
      ? mapped.filter((u) => {
          return (
            u.codigo.toLowerCase().includes(term) ||
            u.name.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
          );
        })
      : mapped;

    return filtered.slice(0, 50); // Limitează la 50 pentru performanță
  }, [managerEmpleadoSearch, allUsers]);

  const manualEmployeeOptions = useMemo(() => {
    const term = manualEmployeeSearch.toLowerCase().trim();
    const mapped = (allUsers || [])
      .map((u) => {
        const codigo = u?.['CODIGO'] || u?.codigo || '';
        const name = u?.['NOMBRE / APELLIDOS'] || u?.nombre || '';
        const email = u?.['CORREO ELECTRONICO'] || u?.EMAIL || u?.email || '';
        return {
          codigo: String(codigo || '').trim(),
          name: String(name || '').trim(),
          email: String(email || '').trim(),
        };
      })
      .filter((u) => u.codigo || u.email || u.name);

    const filtered = term
      ? mapped.filter((u) => {
          return (
            u.codigo.toLowerCase().includes(term) ||
            u.name.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
          );
        })
      : mapped;

    filtered.sort((a, b) => (a.name || a.codigo).localeCompare(b.name || b.codigo));
    return filtered.slice(0, 50);
  }, [allUsers, manualEmployeeSearch]);

  // Mobile: control expand/collapse pentru "Motivo" per solicitud
  const [expandedMotivos, setExpandedMotivos] = useState({}); // { [id]: boolean }

  // Auto-expand pentru solicitări respinse
  useEffect(() => {
    try {
      const next = { ...expandedMotivos };
      for (const s of solicitudes || []) {
        const sid = s?.id ?? `idx_${Math.random()}`;
        if (s?.estado === 'Rechazada' && next[sid] !== true) {
          next[sid] = true;
        }
      }
      setExpandedMotivos(next);
      // eslint-disable-next-line no-empty
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudes]);

  const handleVacationMonthBlockAction = useCallback(
    async (monthIdx, action) => {
      if (authUser?.isDemo || !canAccessAllTabs) return;
      const year = vacationControlYear;
      const month1 = monthIdx + 1;
      const firstDay = `${year}-${String(month1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(year, month1, 0).getDate();
      const lastDay = `${year}-${String(month1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      const periodId =
        (vacationBlockedPeriods || []).find((p) => {
          const inicio = (
            typeof p.fecha_inicio === 'string'
              ? p.fecha_inicio
              : p.fecha_inicio?.split?.('T')[0] ?? ''
          ).slice(0, 10);
          const fin = (
            typeof p.fecha_fin === 'string'
              ? p.fecha_fin
              : p.fecha_fin?.split?.('T')[0] ?? ''
          ).slice(0, 10);
          return inicio === firstDay && fin === lastDay;
        })?.id ?? null;

      setErrorMsg('');
      setVacationMonthActionBusy(true);
      try {
        if (action === 'block') {
          await callApi(routes.createVacationBlockedPeriod, {
            method: 'POST',
            body: JSON.stringify({ fecha_inicio: firstDay, fecha_fin: lastDay }),
            headers: { 'Content-Type': 'application/json' },
          });
          await fetchVacationBlockedPeriods();
          setVacationMonthMenuIdx(null);
        } else if (action === 'unblock') {
          if (periodId == null) {
            setErrorMsg(
              'No hay bloqueo exacto de mes; usa «Bloquear periodos vacaciones» para ajustar el periodo.',
            );
            return;
          }
          await callApi(routes.deleteVacationBlockedPeriod(periodId), { method: 'DELETE' });
          await fetchVacationBlockedPeriods();
          setVacationMonthMenuIdx(null);
        }
      } catch (e) {
        setErrorMsg(e?.message || 'Error al actualizar el bloqueo.');
      } finally {
        setVacationMonthActionBusy(false);
      }
    },
    [
      authUser?.isDemo,
      canAccessAllTabs,
      vacationControlYear,
      vacationBlockedPeriods,
      callApi,
      fetchVacationBlockedPeriods,
    ],
  );

  useEffect(() => {
    if (vacationMonthMenuIdx === null) return;
    const onDown = (e) => {
      const t = e.target;
      if (t.closest?.('[data-vacation-month-menu]') || t.closest?.('[data-vacation-month-trigger]')) return;
      setVacationMonthMenuIdx(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setVacationMonthMenuIdx(null);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [vacationMonthMenuIdx]);

  const isMotivoExpanded = (solicitud) => {
    const sid = solicitud?.id ?? 'unknown';
    return !!expandedMotivos[sid];
  };

  const toggleMotivo = (solicitud) => {
    const sid = solicitud?.id ?? 'unknown';
    setExpandedMotivos(prev => ({ ...prev, [sid]: !prev[sid] }));
  };

  const copyMotivo = async (texto) => {
    try {
      await navigator.clipboard.writeText(String(texto ?? ''));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar al Dashboard" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Gestión de Solicitudes
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              Solicita días de asuntos propios o vacaciones
            </p>
          </div>
        </div>
      </div>

      {/* Botón Reportar Error */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => {
            // Date relevante pentru pagina de solicitudes
            const solicitudesActivas = solicitudes?.filter(s => 
              s.estado === 'Pendiente' || s.estado === 'Aprobada'
            ) || [];
            const tiposSolicitudes = [...new Set(solicitudesActivas.map(s => s.tipo || s.TIPO))].filter(Boolean);
            
            const pageData = {
              additionalInfo: [
                solicitudesActivas.length > 0 ? `[SOLICITUDES] Total activas: ${solicitudesActivas.length}` : null,
                tiposSolicitudes.length > 0 ? `[TIPOS] ${tiposSolicitudes.join(", ")}` : null,
                allSolicitudes?.length > 0 ? `[TOTAL] ${allSolicitudes.length} solicitudes en total` : null,
              ].filter(Boolean),
            };
            
            const message = buildErrorReportMessage({
              authUser,
              userData: empleadoCompleto,
              pageName: "Gestión de Solicitudes",
              pageData,
            });
            
            openWhatsAppErrorReport(message);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <span className="text-base">📱</span>
          Reportar error
        </button>
      </div>

      {/* Verifică dacă utilizatorul are acces la pagină */}
      {loadingPermissions && (
        <Card>
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="text-gray-600 mt-4">Cargando permisos...</p>
          </div>
        </Card>
      )}

      {/* Dacă nu are permisiuni în backend sau nu are permisiuni pentru solicitudes */}
      {!loadingPermissions && !canAccessPage && (
        <Card>
          <div className="text-center py-8">
            <div className="max-w-md mx-auto">
              <p className="text-gray-800 text-lg font-semibold mb-2">
                No tienes acceso a esta página
              </p>
              <p className="text-gray-600 mb-4">
                No tienes permisos configurados para acceder a la página de Solicitudes.
              </p>
              <p className="text-gray-600">
                Por favor, contacta con tu supervisor para que te asigne los permisos necesarios.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs - doar dacă are acces */}
      {!loadingPermissions && canAccessPage && (
      <Card>
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveTab('lista')}
            className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'lista'
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
                : 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'lista' 
                ? 'bg-red-400 opacity-30 blur-md animate-pulse' 
                : 'bg-red-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                activeTab === 'lista' 
                  ? 'bg-white/20' 
                  : 'bg-red-100 group-hover:bg-red-200'
              }`}>
                <span className={`text-xl ${
                  activeTab === 'lista' ? 'text-white' : 'text-red-600'
                }`}>📋</span>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold">Mis Solicitudes</div>
                <div className={`text-xs ${
                  activeTab === 'lista' ? 'text-white/80' : 'text-red-500'
                }`}>Ver mis peticiones</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('nueva')}
            className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'nueva'
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:bg-green-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'nueva' 
                ? 'bg-green-400 opacity-30 blur-md animate-pulse' 
                : 'bg-green-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                activeTab === 'nueva' 
                  ? 'bg-white/20' 
                  : 'bg-green-100 group-hover:bg-green-200'
              }`}>
                <span className={`text-xl ${
                  activeTab === 'nueva' ? 'text-white' : 'text-green-600'
                }`}>➕</span>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold">Nueva Solicitud</div>
                <div className={`text-xs ${
                  activeTab === 'nueva' ? 'text-white/80' : 'text-green-500'
                }`}>Crear petición</div>
              </div>
            </div>
          </button>

          {canAccessAllTabs && (
            <>
              <button
                onClick={() => setActiveTab('todas')}
                className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                  activeTab === 'todas'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                    : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                  activeTab === 'todas' 
                    ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                    : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
                }`}></div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    activeTab === 'todas' 
                      ? 'bg-white/20' 
                      : 'bg-blue-100 group-hover:bg-blue-200'
                  }`}>
                    <span className={`text-xl ${
                      activeTab === 'todas' ? 'text-white' : 'text-blue-600'
                    }`}>👥</span>
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold">Todas las Solicitudes</div>
                    <div className={`text-xs ${
                      activeTab === 'todas' ? 'text-white/80' : 'text-blue-500'
                    }`}>Gestionar equipo</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('estadisticas')}
                className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                  activeTab === 'estadisticas'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                    : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                  activeTab === 'estadisticas' 
                    ? 'bg-purple-400 opacity-30 blur-md animate-pulse' 
                    : 'bg-purple-400 opacity-0 group-hover:opacity-20 blur-md'
                }`}></div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    activeTab === 'estadisticas' 
                      ? 'bg-white/20' 
                      : 'bg-purple-100 group-hover:bg-purple-200'
                  }`}>
                    <span className={`text-xl ${
                      activeTab === 'estadisticas' ? 'text-white' : 'text-purple-600'
                    }`}>📊</span>
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold">Estadísticas</div>
                    <div className={`text-xs ${
                      activeTab === 'estadisticas' ? 'text-white/80' : 'text-purple-500'
                    }`}>Vacaciones y Asuntos Propios</div>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>

        {activeTab === 'lista' ? (
          // Lista de solicitudes del usuario (filtrada por año seleccionado)
          <div>
            <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} ${isMobile ? 'gap-2 mb-4' : 'mb-6'}`}>
              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>
                  Mis Solicitudes
                </h2>
                <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                  <span>Año:</span>
                  <select
                    value={misSolicitudesYear}
                    onChange={(e) => setMisSolicitudesYear(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    {(() => {
                      const currentYear = new Date().getFullYear();
                      const years = [];
                      for (let y = currentYear + 1; y >= currentYear - 6; y--) years.push(y);
                      return years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ));
                    })()}
                  </select>
                </label>
              </div>
              <div className={`flex ${isMobile ? 'flex-wrap gap-1.5 mt-1' : 'gap-3'}`}>
                {totalAsuntoPropioDaysForYear > 0 && (
                  <span className={`inline-flex items-center ${isMobile ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-sm'} font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200`}>
                    📅 Asunto Propio: {totalAsuntoPropioDaysForYear} días
                  </span>
                )}
                {totalVacacionesDaysForYear > 0 && (
                  <span className={`inline-flex items-center ${isMobile ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-sm'} font-medium rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200`}>
                    🏖️ Vacaciones: {totalVacacionesDaysForYear} días
                  </span>
                )}
              </div>
            </div>
            
            {isOperationLoading('solicitudes') ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" text="Cargando solicitudes..." />
              </div>
            ) : solicitudesForYear.length === 0 ? (
              <div className={`text-center ${isMobile ? 'py-4 text-sm' : 'py-8'} text-gray-500`}>
                {solicitudes.length === 0 ? 'No tienes solicitudes aún.' : `No tienes solicitudes en ${misSolicitudesYear}.`}
              </div>
            ) : (
              <div className={isMobile ? "space-y-2" : "space-y-3"}>
                {solicitudesForYear.map((solicitud, index) => (
                  isMobile ? (
                    <MobileSolicitudItem
                      key={solicitud.id || index}
                      solicitud={solicitud}
                      getAusenciaDurationDisplay={getAusenciaDurationDisplay}
                      formatDate={formatDate}
                      formatDateRange={formatDateRange}
                      getStatusColor={getStatusColor}
                      getSolicitudTipoShort={getSolicitudTipoShort}
                      getStatusIndicatorColor={getStatusIndicatorColor}
                      justificantesPorAusencia={justificantesPorAusencia}
                      initialJustificantesPorFecha={initialJustificantesPorFecha}
                      openUploadJustificanteModal={openUploadJustificanteModal}
                      onJustificanteError={setErrorMsg}
                      openJustificantePreview={setJustificantePreview}
                      solicitudesLookup={solicitudes}
                      allAusencias={allAusencias}
                    />
                  ) : (
                  <div key={solicitud.id || index} className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-red-500">
                    {/* Header compact pe mobil, complet pe ecrane mari */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                          <span className="text-white text-lg">
                            {solicitud.tipo === 'Vacaciones' ? '🏖️' : '📅'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 truncate">{solicitud.tipo}</h3>
                          {/* ID și Codigo: mutat sub tip pe mobil */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              ID: {solicitud.id}
                            </span>
                            {solicitud.codigo && (
                              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                Código: {solicitud.codigo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(solicitud.estado)}`}>
                              {solicitud.estado === 'Aprobada' ? '✅' : solicitud.estado === 'Pendiente' ? '⏳' : '❌'} {solicitud.estado}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Grid: 1 col pe mobil, 2 pe tablet, 4 pe desktop */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <span className="block text-xs font-medium text-blue-700 mb-1">📅 Fecha Solicitud</span>
                        <p className="text-sm font-semibold text-blue-900 break-words">{formatDate(solicitud.fecha_solicitud)}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
            <span className="block text-xs font-medium text-gray-600 mb-1">Período</span>
                        <p className="text-sm font-semibold text-gray-900 break-words">{solicitud.FECHA || formatDate(solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha)}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
            <span className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</span>
                        <p className="text-sm font-semibold text-gray-900 break-words">{solicitud.FECHA ? (solicitud.FECHA.includes(' - ') ? solicitud.FECHA.split(' - ')[1] : solicitud.FECHA) : formatDate(solicitud.fecha_fin || solicitud["fecha fin"])}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
            <span className="block text-xs font-medium text-gray-600 mb-1">Duración</span>
                        {(() => {
                          const durationInfo = getAusenciaDurationDisplay(solicitud);
                          return (
                            <p className={`text-sm font-semibold break-words ${durationInfo.isDayBased ? 'text-red-600' : 'text-purple-600'}`}>
                              {durationInfo.isDayBased ? `📅 ${durationInfo.text}` : `⏱️ ${durationInfo.text}`}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Indicator asociere (dacă există) - afișat înainte de justificante */}
                    {(() => {
                      const ausenciaAsociadaId = solicitud.ausencia_asociada_id;
                      const ausenciaAsociada = ausenciaAsociadaId 
                        ? solicitudes.find(s => (s.id || s.ID) === ausenciaAsociadaId)
                        : null;
                      
                      if (ausenciaAsociada) {
                        return (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600">🔗</span>
                              <span className="text-sm text-blue-700 font-medium">
                                Asociada con: <span className="font-semibold">{ausenciaAsociada.TIPO || ausenciaAsociada.tipo} #{ausenciaAsociada.id || ausenciaAsociada.ID}</span>
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Afișare justificante asociate cu ausencia - pentru angajați și manageri */}
                    {(() => {
                      // Verificăm dacă este o ausencia (nu Vacaciones sau Asunto Propio)
                      const tipoNormalized = (solicitud.tipo || '').toLowerCase();
                      const isVacaciones = tipoNormalized.includes('vacacion');
                      const isAsuntoPropio = tipoNormalized.includes('asunto') && tipoNormalized.includes('propio');
                      
                      // SOLUȚIE GENERICĂ: Include toate tipurile care NU sunt Vacaciones sau Asunto Propio
                      // (Permiso Retribuido, Salida Sin Regreso, etc. - toate pot avea justificante)
                      const esAusencia = !isVacaciones && !isAsuntoPropio && 
                                        (solicitud.FECHA || solicitud.fecha || solicitud.fecha_inicio || solicitud.fecha_solicitud);
                      
                      if (esAusencia) {
                        // IMPORTANT: Definim tipoAusencia pentru matching cu justificante
                        const tipoAusencia = solicitud.tipo || '';
                        // Pentru data, folosim FECHA sau prima dată disponibilă
                        // IMPORTANT: Pentru matching cu justificante, folosim prima dată din interval
                        let fechaAusencia = solicitud.FECHA || solicitud.fecha || solicitud.fecha_inicio || solicitud['fecha inicio'] || '';
                        
                        // Dacă FECHA conține un interval (ex: "2025-11-24 - 2025-11-28"), luăm prima dată
                        if (fechaAusencia && typeof fechaAusencia === 'string' && fechaAusencia.includes(' - ')) {
                          fechaAusencia = fechaAusencia.split(' - ')[0].trim();
                        }
                        
                        // Dacă tot nu avem dată, încercăm cu fecha_solicitud (poate fi util pentru matching)
                        if (!fechaAusencia) {
                          fechaAusencia = solicitud.fecha_solicitud || '';
                        }
                        
                        // Normalizează data pentru matching (format YYYY-MM-DD)
                        let fechaNormalizada = '';
                        if (fechaAusencia) {
                          try {
                            // Dacă este format "DD/MM/YYYY" sau "D/M/YYYY" (ex: "8/1/2026")
                            if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                              const fechaParts = fechaAusencia.trim().split('/');
                              if (fechaParts.length === 3) {
                                fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                              }
                            } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
                              fechaNormalizada = fechaAusencia.substring(0, 10);
                            } else {
                              // Încearcă să parseze ca Date
                              const fecha = new Date(fechaAusencia);
                              if (!isNaN(fecha.getTime())) {
                                fechaNormalizada = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
                              }
                            }
                          } catch (e) {
                            console.warn('Error normalizando fecha:', fechaAusencia, e);
                          }
                        }
                        
                        if (!fechaNormalizada) {
                          // console.log('⚠️ No se pudo normalizar fecha');
                          return null;
                        }
                        
                        // Key-urile nu sunt folosite direct în acest context
                        // const key = `${tipoAusencia}_${fechaNormalizada}`;
                        // const keySinEspacios = `${tipoAusencia.replace(/\s+/g, '')}_${fechaNormalizada}`;
                        
                        // Folosim state-ul direct pentru lookup (este întotdeauna actualizat)
                        // Ref-ul este folosit doar ca fallback dacă state-ul este gol (pentru React Strict Mode)
                        const currentMap = justificantesPorAusencia.size > 0 
                          ? justificantesPorAusencia 
                          : justificantesPorAusenciaRef.current;
                        
                        // PRIORITATE 1: Matching exact pe tipo_fecha (cel mai precis)
                        let justificante = null;
                        if (tipoAusencia && fechaNormalizada) {
                          const keyExact = `${tipoAusencia}_${fechaNormalizada}`;
                          const keyExactSinEspacios = `${tipoAusencia.replace(/\s+/g, '')}_${fechaNormalizada}`;
                          
                          justificante = currentMap.get(keyExact) || currentMap.get(keyExactSinEspacios);
                          
                          // PRIORITATE 2: Dacă nu găsește matching exact, caută pe dată dar VERIFICĂ TIPUL
                          if (!justificante) {
                            for (const [, value] of currentMap.entries()) {
                              // Verifică că data se potrivește
                              if (value.fechaAusencia === fechaNormalizada) {
                                // IMPORTANT: Verifică că tipul se potrivește (case-insensitive, fără spații)
                                const tipoJustificante = (value.tipoAusencia || '').toLowerCase().trim();
                                const tipoAusenciaNormalizado = tipoAusencia.toLowerCase().trim();
                                
                                if (tipoJustificante === tipoAusenciaNormalizado) {
                                  justificante = value;
                                  break;
                                }
                              }
                            }
                          }
                          
                          // Verificare finală: asigură-te că data și tipul se potrivesc
                          if (justificante) {
                            // Verifică data
                            if (justificante.fechaAusencia && fechaNormalizada && justificante.fechaAusencia !== fechaNormalizada) {
                              justificante = null;
                            }
                            // Verifică tipul (case-insensitive)
                            else if (justificante.tipoAusencia && tipoAusencia) {
                              const tipoJustificante = justificante.tipoAusencia.toLowerCase().trim();
                              const tipoAusenciaNormalizado = tipoAusencia.toLowerCase().trim();
                              if (tipoJustificante !== tipoAusenciaNormalizado) {
                                justificante = null;
                              }
                            }
                          }
                        }
                        
                        // console.log('📄 Justificante encontrada en lista:', justificante ? 'found' : 'not found');
                        
                        // Verifică dacă ausencia este asociată cu alta care are justificante
                        const ausenciaAsociadaId = solicitud.ausencia_asociada_id;
                        // În "Mis Solicitudes", căutăm în solicitudes (care conține toate ausencias-urile utilizatorului)
                        // În "Todas las Solicitudes", căutăm în allAusencias
                        const ausenciaAsociada = ausenciaAsociadaId 
                          ? (activeTab === 'lista' 
                              ? solicitudes.find(s => (s.id || s.ID) === ausenciaAsociadaId)
                              : allAusencias.find(a => (a.id || a.ID) === ausenciaAsociadaId))
                          : null;
                        
                        // Verifică dacă ausencia asociată are justificante
                        let ausenciaAsociadaTieneJustificantes = false;
                        if (ausenciaAsociada && !justificante) {
                          // codigoAsociada și tipoAsociada nu sunt folosite în acest context
                          // const codigoAsociada = ausenciaAsociada.CODIGO || ausenciaAsociada.codigo || '';
                          // const tipoAsociada = ausenciaAsociada.tipo || ausenciaAsociada.TIPO || '';
                          const fechaAsociada = ausenciaAsociada.FECHA || ausenciaAsociada.fecha || ausenciaAsociada.fecha_inicio || '';
                          
                          // Normalizează data pentru ausencia asociată
                          let fechaAsociadaNormalizada = '';
                          if (fechaAsociada) {
                            try {
                              if (typeof fechaAsociada === 'string' && fechaAsociada.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                                const fechaParts = fechaAsociada.trim().split('/');
                                if (fechaParts.length === 3) {
                                  fechaAsociadaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                                }
                              } else if (typeof fechaAsociada === 'string' && fechaAsociada.match(/^\d{4}-\d{2}-\d{2}/)) {
                                fechaAsociadaNormalizada = fechaAsociada.substring(0, 10);
                              } else {
                                const fecha = new Date(fechaAsociada);
                                if (!isNaN(fecha.getTime())) {
                                  fechaAsociadaNormalizada = fecha.toISOString().split('T')[0];
                                }
                              }
                            } catch (e) {
                              console.warn('Error normalizando fecha asociada:', fechaAsociada, e);
                            }
                          }
                          
                          // Verifică dacă ausencia asociată are justificante
                          if (fechaAsociadaNormalizada) {
                            for (const [, value] of currentMap.entries()) {
                              if (value.fechaAusencia === fechaAsociadaNormalizada) {
                                ausenciaAsociadaTieneJustificantes = true;
                                break;
                              }
                            }
                          }
                        }
                        
                        // Para "Ausencias justificada" mostramos siempre las dos secciones (cerere + presencia), no el box único
                        const tipoNorm = (solicitud.tipo || solicitud.TIPO || solicitud.tipo_solicitud || solicitud.TIPO_SOLICITUD || '').toLowerCase();
                        const esAusenciaJustificadaParaDosBloques = tipoNorm.includes('ausencia') && tipoNorm.includes('justificada');
                        
                        if (justificante && !esAusenciaJustificadaParaDosBloques) {
                          const esPendiente = justificante.estado === 'pendiente';
                          const esCompletado = justificante.estado === 'completado';
                          
                          return (
                            <div className="mt-4 p-4 rounded-lg border-2 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xl">📋</span>
                                      <h4 className="font-bold text-gray-900">{justificante.tipo_documento}</h4>
                                      {esPendiente && (
                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                          Pendiente
                                        </span>
                                      )}
                                      {esCompletado && (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                          ✅ Completado
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 space-y-1">
                                      <p>Solicitado el {formatDate(justificante.fecha_solicitud)}</p>
                                      {esCompletado && justificante.fecha_completado && (
                                        <p>Completado el {formatDate(justificante.fecha_completado)}</p>
                                      )}
                                    </div>
                                  </div>
                                  {esPendiente && (
                                    <button
                                      onClick={() => {
                                        window.location.href = '/documentos';
                                      }}
                                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm"
                                    >
                                      📤 Subir
                                    </button>
                                  )}
                                </div>
                              </div>
                          );
                        } else if (ausenciaAsociadaTieneJustificantes) {
                          // Dacă ausencia asociată are justificante, afișăm mesajul
                          return (
                            <div className="mt-4 p-4 rounded-lg border-2 border-green-200 bg-green-50">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600">✅</span>
                                  <span className="text-sm text-green-700 font-medium">
                                    Justificantes gestionados a través de la ausencia asociada ({ausenciaAsociada?.TIPO || ausenciaAsociada?.tipo} #{ausenciaAsociada?.id || ausenciaAsociada?.ID})
                                  </span>
                                </div>
                              </div>
                          );
                        } else {
                          // Verifică dacă nu necesita justificante (verificăm și pentru 1, true, 'true', etc.)
                          const noNecesitaJustificante = solicitud.no_necesita_justificante === true || 
                                                          solicitud.no_necesita_justificante === 1 || 
                                                          solicitud.no_necesita_justificante === 'true' ||
                                                          solicitud.NO_NECESITA_JUSTIFICANTE === true ||
                                                          solicitud.NO_NECESITA_JUSTIFICANTE === 1 ||
                                                          solicitud.NO_NECESITA_JUSTIFICANTE === 'true';
                          const esPermisoRetribuido = ((solicitud.tipo || solicitud.TIPO || '').toLowerCase().includes('permiso retribuido'));
                          
                          // Dacă no_necesita_justificante === true, nu afișăm butonul "Cargar Justificante"
                          if (noNecesitaJustificante) {
                            // Dacă nu necesita justificante, afișăm doar indicatorul (fără buton "Cargar Justificante")
                            return (
                              <div className="mt-4 p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-sm text-blue-700 font-medium">
                                      ✅ No Necesita Justificante
                                    </p>
                                  </div>
                                  {isManager && (
                                    <button
                                      onClick={() => handleToggleNoNecesitaJustificante(solicitud.id || solicitud.ID, true)}
                                      disabled={isOperationLoading('no-necesita-justificante')}
                                      className="px-3 py-1.5 text-xs rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Desmarcar 'No necesita justificante'"
                                    >
                                      Desmarcar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          
                          // Dacă necesita justificante, afișăm butonul "Cargar Justificante" sau "Solicitar Justificante"
                          // IMPORTANT: În "Mis Solicitudes" (activeTab === 'lista'), nu afișăm "Solicitar Justificante"
                          // pentru că toate solicitările sunt ale utilizatorului curent (nu poți să-ți solici justificante ție însuți)
                          // IMPORTANT: Pentru "Ausencia Injustificada", nu afișăm butonul "Cargar Justificante" în "Mis Solicitudes"
                          const isMisSolicitudesTab = activeTab === 'lista';
                          const tipoAusencia = (solicitud.tipo || solicitud.TIPO || '').toLowerCase();
                          const esAusenciaInjustificada = tipoAusencia.includes('ausencia injustificada');
                          
                          // Dacă este "Ausencia Injustificada" în "Mis Solicitudes", nu afișăm butonul
                          if (isMisSolicitudesTab && esAusenciaInjustificada) {
                            return (
                              <div className="mt-4 p-4 rounded-lg border-2 border-red-200 bg-red-50">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">❌</span>
                                  <p className="text-sm text-red-700 font-medium">
                                    Esta ausencia está marcada como injustificada.
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          
                          let fechaSolicitudNorm = '';
                          try {
                            const fs = solicitud.fecha_solicitud || solicitud.created_at || solicitud.FECHA_SOLICITUD;
                            if (fs) {
                              const d = new Date(fs);
                              if (!isNaN(d.getTime())) fechaSolicitudNorm = d.toISOString().split('T')[0];
                            }
                          } catch {
                            /* ignore invalid date */
                          }
                          const docsIniciales = initialJustificantesPorFecha.get(fechaNormalizada) || initialJustificantesPorFecha.get(fechaSolicitudNorm) || [];
                          const tipoNormMis = (solicitud.tipo || solicitud.TIPO || solicitud.tipo_solicitud || solicitud.TIPO_SOLICITUD || '').toLowerCase();
                          const esAusenciaJustificada = tipoNormMis.includes('ausencia') && tipoNormMis.includes('justificada');
                          const keyCerere = `Ausencias justificada_${fechaNormalizada}`;
                          const keyCerereSinEspacios = `Ausenciasjustificada_${fechaNormalizada}`;
                          const justificanteCerereFromMap = esAusenciaJustificada ? (currentMap.get(keyCerere) || currentMap.get(keyCerereSinEspacios)) : null;
                          const docCerereFromMap = justificanteCerereFromMap?.doc_id ? { doc_id: justificanteCerereFromMap.doc_id, nombre_archivo: justificanteCerereFromMap.doc_nombre_archivo || 'Justificante' } : null;
                          const docCerere = docsIniciales[0] || docCerereFromMap;
                          const tieneJustificanteCerere = docsIniciales.length > 0 || !!docCerereFromMap;
                          const keyPresencia = `Ausencias justificada_${fechaNormalizada}_presencia`;
                          const keyPresenciaSinEspacios = `Ausenciasjustificada_${fechaNormalizada}_presencia`;
                          const justificantePresencia = esAusenciaJustificada ? (currentMap.get(keyPresencia) || currentMap.get(keyPresenciaSinEspacios)) : null;
                          return (
                            <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 space-y-3">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-700 mb-1">Justificante para la solicitud:</p>
                                  {tieneJustificanteCerere ? (
                                    <p className="text-sm text-green-700 flex items-center gap-2 flex-wrap">
                                      ✅ Cargado
                                      {docCerere && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              const token = localStorage.getItem('auth_token');
                                              const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${docCerere.doc_id}&id=${solicitud.codigo || solicitud.CODIGO || ''}&email=${encodeURIComponent(solicitud.email || '')}&fileName=${encodeURIComponent(docCerere.nombre_archivo || '')}`;
                                              fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                                                .then((res) => {
                                                  if (!res.ok) throw new Error(res.status === 401 ? 'No autorizado' : 'Error al cargar');
                                                  return res.blob();
                                                })
                                                .then((blob) => {
                                                  const blobUrl = window.URL.createObjectURL(blob);
                                                  const a = document.createElement('a');
                                                  a.href = blobUrl;
                                                  a.download = docCerere.nombre_archivo || 'justificante';
                                                  document.body.appendChild(a);
                                                  a.click();
                                                  window.URL.revokeObjectURL(blobUrl);
                                                  document.body.removeChild(a);
                                                })
                                                .catch(() => setErrorMsg('Error al descargar el justificante. Inicia sesión si es necesario.'));
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                                          >
                                            📥 Descargar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              const token = localStorage.getItem('auth_token');
                                              const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${docCerere.doc_id}&id=${solicitud.codigo || solicitud.CODIGO || ''}&email=${encodeURIComponent(solicitud.email || '')}&fileName=${encodeURIComponent(docCerere.nombre_archivo || '')}`;
                                              fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                                                .then((res) => {
                                                  if (!res.ok) throw new Error(res.status === 401 ? 'No autorizado' : 'Error al cargar');
                                                  return res.blob();
                                                })
                                                .then((blob) => {
                                                  const blobUrl = window.URL.createObjectURL(blob);
                                                  setJustificantePreview({
                                                    isOpen: true,
                                                    blobUrl,
                                                    fileName: docCerere.nombre_archivo || 'Justificante',
                                                    mimeType: blob.type || '',
                                                  });
                                                })
                                                .catch(() => setErrorMsg('Error al abrir el justificante. Inicia sesión si es necesario.'));
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                                          >
                                            👁️ Ver
                                          </button>
                                        </>
                                      )}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-600">No cargado.</p>
                                  )}
                                  {esAusenciaJustificada && (
                                    <>
                                      <p className="text-sm font-medium text-gray-700 mt-2 mb-1">Justificante de presencia a la cita:</p>
                                      {justificantePresencia ? (
                                        <p className="text-sm">
                                          {justificantePresencia.estado === 'completado' ? (
                                            <span className="text-green-700 flex items-center gap-2 flex-wrap">
                                              ✅ Completado
                                              {/* Siempre mostrar botones si está completado; si no hay doc_id, resolver por GET documentos (presencia + fecha) */}
                                              {(justificantePresencia.doc_id || justificantePresencia.doc_ID) ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      const docId = justificantePresencia.doc_id || justificantePresencia.doc_ID;
                                                      const token = localStorage.getItem('auth_token');
                                                      const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${docId}&id=${solicitud.codigo || solicitud.CODIGO || ''}&email=${encodeURIComponent(solicitud.email || '')}&fileName=${encodeURIComponent(justificantePresencia.doc_nombre_archivo || justificantePresencia.doc_NOMBRE_ARCHIVO || 'justificante-presencia')}`;
                                                      fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                                                        .then((res) => { if (!res.ok) throw new Error(); return res.blob(); })
                                                        .then((blob) => {
                                                          const blobUrl = window.URL.createObjectURL(blob);
                                                          const a = document.createElement('a');
                                                          a.href = blobUrl;
                                                          a.download = justificantePresencia.doc_nombre_archivo || justificantePresencia.doc_NOMBRE_ARCHIVO || 'justificante-presencia';
                                                          document.body.appendChild(a);
                                                          a.click();
                                                          window.URL.revokeObjectURL(blobUrl);
                                                          document.body.removeChild(a);
                                                        })
                                                        .catch(() => setErrorMsg('Error al descargar. Inicia sesión si es necesario.'));
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                                                  >
                                                    📥 Descargar
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      const docId = justificantePresencia.doc_id || justificantePresencia.doc_ID;
                                                      const token = localStorage.getItem('auth_token');
                                                      const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${docId}&id=${solicitud.codigo || solicitud.CODIGO || ''}&email=${encodeURIComponent(solicitud.email || '')}&fileName=${encodeURIComponent(justificantePresencia.doc_nombre_archivo || justificantePresencia.doc_NOMBRE_ARCHIVO || 'justificante-presencia')}`;
                                                      fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                                                        .then((res) => { if (!res.ok) throw new Error(); return res.blob(); })
                                                        .then((blob) => {
                                                          const blobUrl = window.URL.createObjectURL(blob);
                                                          setJustificantePreview({
                                                            isOpen: true,
                                                            blobUrl,
                                                            fileName:
                                                              justificantePresencia.doc_nombre_archivo ||
                                                              justificantePresencia.doc_NOMBRE_ARCHIVO ||
                                                              'Justificante presencia',
                                                            mimeType: blob.type || '',
                                                          });
                                                        })
                                                        .catch(() => setErrorMsg('Error al abrir. Inicia sesión si es necesario.'));
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                                                  >
                                                    👁️ Ver
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                      e.preventDefault();
                                                      const token = localStorage.getItem('auth_token');
                                                      const codigo = solicitud.codigo || solicitud.CODIGO || '';
                                                      try {
                                                        const r = await fetch(`${routes.getDocumentos || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos`}?empleadoId=${encodeURIComponent(codigo)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                                        if (!r.ok) throw new Error();
                                                        const data = await r.json();
                                                        const docs = Array.isArray(data) ? data : (data?.data || []);
                                                        const presencia = docs.find(d => (d.tipo_documento || '').toLowerCase().includes('presencia'));
                                                        const doc = presencia || docs.find(d => (d.tipo_documento || '').toLowerCase().includes('justificante'));
                                                        if (!doc?.doc_id) { setErrorMsg('No se encontró el documento.'); return; }
                                                        const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${doc.doc_id}&id=${codigo}&email=${encodeURIComponent(solicitud.email || '')}&fileName=${encodeURIComponent(doc.nombre_archivo || 'justificante-presencia')}`;
                                                        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                                        if (!res.ok) throw new Error();
                                                        const blob = await res.blob();
                                                        const blobUrl = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = blobUrl;
                                                        a.download = doc.nombre_archivo || 'justificante-presencia';
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        window.URL.revokeObjectURL(blobUrl);
                                                        document.body.removeChild(a);
                                                      } catch {
                                                        setErrorMsg('Error al descargar. Inicia sesión si es necesario.');
                                                      }
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                                                  >
                                                    📥 Descargar
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                      e.preventDefault();
                                                      const token = localStorage.getItem('auth_token');
                                                      const codigo = solicitud.codigo || solicitud.CODIGO || '';
                                                      try {
                                                        const r = await fetch(`${routes.getDocumentos || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos`}?empleadoId=${encodeURIComponent(codigo)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                                        if (!r.ok) throw new Error();
                                                        const data = await r.json();
                                                        const docs = Array.isArray(data) ? data : (data?.data || []);
                                                        const presencia = docs.find(d => (d.tipo_documento || '').toLowerCase().includes('presencia'));
                                                        const doc = presencia || docs.find(d => (d.tipo_documento || '').toLowerCase().includes('justificante'));
                                                        if (!doc?.doc_id) { setErrorMsg('No se encontró el documento.'); return; }
                                                        const url = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${doc.doc_id}&id=${codigo}&email=${encodeURIComponent(solicitud.email || '')}&fileName=${encodeURIComponent(doc.nombre_archivo || 'justificante-presencia')}`;
                                                        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                                        if (!res.ok) throw new Error();
                                                        const blob = await res.blob();
                                                        const blobUrl = window.URL.createObjectURL(blob);
                                                        setJustificantePreview({
                                                          isOpen: true,
                                                          blobUrl,
                                                          fileName: doc.nombre_archivo || 'Justificante presencia',
                                                          mimeType: blob.type || '',
                                                        });
                                                      } catch {
                                                        setErrorMsg('Error al abrir. Inicia sesión si es necesario.');
                                                      }
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                                                  >
                                                    👁️ Ver
                                                  </button>
                                                </>
                                              )}
                                            </span>
                                          ) : (
                                            <span className="text-amber-700">⏳ Pendiente de subir</span>
                                          )}
                                        </p>
                                      ) : (
                                        <p className="text-sm text-gray-500">Se solicitará tras la aprobación.</p>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Butonul "Recordar Justificante" apare DOAR în tab-urile unde managerii pot gestiona solicitările altora */}
                                  {isManager && !isMisSolicitudesTab && (
                                    <button
                                      onClick={() => handleRecordarJustificante(solicitud)}
                                      disabled={isOperationLoading('recordar-justificante')}
                                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isOperationLoading('recordar-justificante') ? (
                                        <span className="flex items-center gap-2">
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                          Enviando...
                                        </span>
                                      ) : (
                                        '📋 Recordar Justificante'
                                      )}
                                    </button>
                                  )}
                                  {!tieneJustificanteCerere && (
                                    <button
                                      onClick={() => openUploadJustificanteModal(solicitud)}
                                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm"
                                    >
                                      📤 Cargar Justificante
                                    </button>
                                  )}
                                  {/* Buton "No Necesita Justificante" doar pentru Permiso Retribuido și manageri */}
                                  {esPermisoRetribuido && isManager && (() => {
                                    const noNecesitaJustificante = solicitud.no_necesita_justificante === true || 
                                                                    solicitud.no_necesita_justificante === 1 || 
                                                                    solicitud.no_necesita_justificante === 'true' ||
                                                                    solicitud.NO_NECESITA_JUSTIFICANTE === true ||
                                                                    solicitud.NO_NECESITA_JUSTIFICANTE === 1 ||
                                                                    solicitud.NO_NECESITA_JUSTIFICANTE === 'true';
                                    return (
                                      <button
                                        onClick={() => handleToggleNoNecesitaJustificante(solicitud.id || solicitud.ID, noNecesitaJustificante)}
                                        disabled={isOperationLoading('no-necesita-justificante')}
                                        className={`px-3 py-2 text-xs rounded-lg font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                          noNecesitaJustificante
                                            ? 'bg-green-100 hover:bg-green-200 text-green-700 border-green-300'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300'
                                        }`}
                                        title={noNecesitaJustificante ? "Desmarcar 'No necesita justificante'" : "Marcar como 'No necesita justificante'"}
                                      >
                                        {noNecesitaJustificante ? '✅ No Necesita Justificante' : 'No Necesita Justificante'}
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {/* Motivo: clamp pe mobil, complet pe >= sm */}
                    {solicitud.motivo && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 relative">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="block text-xs font-medium text-blue-700 mb-1">Motivo</span>
                            {/* Container text cu clamp pe mobil când e colapsat */}
                            <div className={`text-sm text-blue-800 break-words ${isMotivoExpanded(solicitud) ? '' : 'line-clamp-2 sm:line-clamp-none'}`}>
                              {solicitud.motivo}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Copiere motiv */}
                            <button
                              type="button"
                              onClick={() => copyMotivo(solicitud.motivo)}
                              className="hidden sm:inline-flex px-2 py-1 text-xs rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
                              title="Copiar"
                            >
                              Copiar
                            </button>
                            {/* Toggle doar pe mobil */}
                            <button
                              type="button"
                              onClick={() => toggleMotivo(solicitud)}
                              className="sm:hidden px-2 py-1 text-xs rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              {isMotivoExpanded(solicitud) ? 'Ver menos' : 'Ver más'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'todas' ? (
          // Lista de todas las solicitudes (solo para managers)
          <div>
            {/* Header con título y botones de export */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900">
              Todas las Solicitudes
            </h2>
            
              {/* Botones export y crear solicitud */}
              <div className="flex gap-3 flex-wrap">
              {selectedTab === 'vacaciones' && (
                <button
                  onClick={() => { setErrorMsg(''); setShowVacationBlockedPeriodsModal(true); fetchVacationBlockedPeriods(); }}
                  className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔒</span>
                    <span className="text-sm">Bloquear periodos vacaciones</span>
                  </div>
                </button>
              )}
              {selectedTab === 'asunto' && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setShowAsuntoPropioBlockedPeriodsModal(true);
                    fetchAsuntoPropioBlockedPeriods();
                  }}
                  className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔒</span>
                    <span className="text-sm">Bloquear Asuntos Propios</span>
                  </div>
                </button>
              )}
              <button
                onClick={() => setShowManagerSolicitudModal(true)}
                  className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">➕</span>
                    <span className="text-sm">Crear Solicitud para Empleado</span>
                </div>
              </button>
              
              <button
                onClick={handleExportExcel}
                  disabled={selectedTab === 'control_vacaciones'}
                  title={selectedTab === 'control_vacaciones' ? 'Cambia de pestaña para exportar la lista' : undefined}
                  className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📊</span>
                    <span className="text-sm">Excel</span>
                </div>
              </button>

              <button
                onClick={handleExportPDF}
                  disabled={selectedTab === 'control_vacaciones'}
                  title={selectedTab === 'control_vacaciones' ? 'Cambia de pestaña para exportar la lista' : undefined}
                  className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📄</span>
                    <span className="text-sm">PDF</span>
                </div>
              </button>
              </div>
            </div>

            {/* Filtros para managers - Layout refinado */}
            <div className="space-y-4 mb-6">
              {/* Selector usuario refinado */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-2xl border border-gray-200 shadow-lg backdrop-blur-sm user-dropdown-container relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-lg">👥</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Filtrar por Empleado</h3>
                      <p className="text-xs text-gray-500">Busca y selecciona un empleado específico</p>
                    </div>
                  </div>
                  <div className="relative flex-1 max-w-lg">
                    <div className="relative group">
                    <input
                      id="manager-user-search"
                      name="manager-user-search"
                      type="text"
                        placeholder="Escribe el nombre o email del empleado..."
                      value={userSearchTerm}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                        className={`w-full ${isMobile ? 'px-3 py-2 pl-10 pr-10 text-xs' : 'px-4 py-3 pl-12 pr-12 text-sm'} border-2 border-gray-200 ${isMobile ? 'rounded-lg' : 'rounded-xl'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 backdrop-blur-sm transition-all duration-300 placeholder-gray-400 shadow-sm group-hover:shadow-md`}
                    />
                    <div className={`absolute ${isMobile ? 'left-3' : 'left-4'} top-1/2 transform -translate-y-1/2`}>
                        <span className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-lg'} group-focus-within:text-blue-500 transition-colors`}>🔍</span>
                    </div>
                    <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowUserDropdown(!showUserDropdown);
                        }}
                        className={`absolute ${isMobile ? 'right-2' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-all duration-200 ${isMobile ? 'p-0.5' : 'p-1'} rounded-lg hover:bg-blue-50`}
                      >
                        <span className={`${isMobile ? 'text-xs' : ''} transform transition-transform duration-300 ${showUserDropdown ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                  </div>
                  
                    {/* Dropdown refinado */}
                  {showUserDropdown && (
                      <div className={`absolute z-[9999] w-full ${isMobile ? 'mt-2' : 'mt-3'} bg-white border border-gray-200 ${isMobile ? 'rounded-lg' : 'rounded-2xl'} shadow-2xl ${isMobile ? 'max-h-60' : 'max-h-80'} overflow-y-auto`} 
                           style={{ 
                             zIndex: 9999,
                             position: 'absolute',
                             top: '100%',
                             left: 0,
                             right: 0
                           }}>
                      {allUsers.length === 0 ? (
                          <div className={`${isMobile ? 'px-4 py-8' : 'px-6 py-12'} text-center text-gray-500`}>
                            <div className={`${isMobile ? 'w-6 h-6 border-2' : 'w-8 h-8 border-3'} border-blue-500 border-t-transparent rounded-full animate-spin mx-auto ${isMobile ? 'mb-2' : 'mb-3'}`}></div>
                            <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>Cargando empleados...</p>
                        </div>
                      ) : (
                          <div className={isMobile ? 'p-1.5' : 'p-2'}>
                            {getFilteredUsers.map(user => (
                        <button
                          key={user.email}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            setSelectedUser(user.email);
                            setUserSearchTerm(user.name);
                            setShowUserDropdown(false);
                          }}
                              className={`w-full text-left ${isMobile ? 'px-2.5 py-2' : 'px-4 py-3'} hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 flex items-center ${isMobile ? 'gap-2' : 'gap-3'} ${isMobile ? 'rounded-lg mb-0.5' : 'rounded-xl mb-1'} ${
                                selectedUser === user.email ? 'bg-gradient-to-r from-blue-100 to-purple-100 border-l-4 border-l-blue-500 shadow-sm' : ''
                              }`}
                            >
                              <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} ${isMobile ? 'rounded-lg' : 'rounded-xl'} flex items-center justify-center shadow-md transition-all duration-200 ${
                            user.email === 'ALL' 
                              ? 'bg-gradient-to-br from-gray-500 to-gray-600' 
                                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
                              }`}>
                            <span className={`text-white ${isMobile ? 'text-xs' : 'text-sm'} font-bold`}>
                              {user.email === 'ALL' ? '👥' : user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-gray-900 ${isMobile ? 'text-xs truncate' : 'text-sm'}`}>{user.name}</p>
                            {user.email !== 'ALL' && (
                              <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 truncate`}>{user.email}</p>
                            )}
                          </div>
                          {selectedUser === user.email && (
                                <div className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0`}>
                                  <span className={`text-white ${isMobile ? 'text-[10px]' : 'text-xs'}`}>✓</span>
                                </div>
                          )}
                        </button>
                            ))}
                          </div>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Tabs para tipo - Modernos con efectos */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSelectedTab('asunto')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'asunto'
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
                      : 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50'
                  }`}
                >
                  {/* Glow effect */}
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'asunto' 
                      ? 'bg-red-400 opacity-25 blur-md animate-pulse' 
                      : 'bg-red-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <span>Asuntos Propios</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedTab('vacaciones')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'vacaciones'
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-200'
                      : 'bg-white text-cyan-600 border-2 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50'
                  }`}
                >
                  {/* Glow effect */}
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'vacaciones' 
                      ? 'bg-cyan-400 opacity-25 blur-md animate-pulse' 
                      : 'bg-cyan-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">🏖️</span>
                    <span>Vacaciones</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTab('control_vacaciones')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'control_vacaciones'
                      ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-teal-200'
                      : 'bg-white text-teal-700 border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50'
                  }`}
                >
                  <div
                    className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                      selectedTab === 'control_vacaciones'
                        ? 'bg-teal-400 opacity-25 blur-md animate-pulse'
                        : 'bg-teal-400 opacity-0 group-hover:opacity-15 blur-md'
                    }`}
                  />
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">📈</span>
                    <span className="hidden sm:inline">Control vacaciones</span>
                    <span className="sm:hidden">Ctrl. vac.</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedTab('ausencias')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'ausencias'
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200'
                      : 'bg-white text-orange-600 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50'
                  }`}
                >
                  {/* Glow effect */}
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'ausencias' 
                      ? 'bg-orange-400 opacity-25 blur-md animate-pulse' 
                      : 'bg-orange-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">🚫</span>
                    <span>Ausencias</span>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('baja')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'baja'
                      ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-rose-200'
                      : 'bg-white text-rose-600 border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'baja'
                      ? 'bg-rose-400 opacity-25 blur-md animate-pulse'
                      : 'bg-rose-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">🩺</span>
                    <span>Bajas Médicas</span>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('baja_voluntaria')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'baja_voluntaria'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                      : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'baja_voluntaria'
                      ? 'bg-purple-400 opacity-25 blur-md animate-pulse'
                      : 'bg-purple-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">🚪</span>
                    <span>Bajas Voluntarias</span>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('aprobacion')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'aprobacion'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-yellow-200'
                      : 'bg-white text-yellow-600 border-2 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'aprobacion'
                      ? 'bg-yellow-400 opacity-25 blur-md animate-pulse'
                      : 'bg-yellow-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <span>Aprobación</span>
                    {(() => {
                      // Numără cererile pendiente (Permiso Retribuido, BAJA_VOLUNTARIA, Ausencias justificada)
                      const pendientes = allSolicitudes.filter(s => {
                        const tipo = (s.tipo || s.TIPO || '').toLowerCase();
                        const estado = (s.estado || s.ESTADO || '').toLowerCase();
                        const esPermisoRetribuido = tipo.includes('permiso') && tipo.includes('retribuido');
                        const esBajaVoluntaria = tipo.includes('baja') && tipo.includes('voluntaria');
                        const esAusenciaJustificada = tipo.includes('ausencias') && tipo.includes('justificada');
                        return estado === 'pendiente' && (esPermisoRetribuido || esBajaVoluntaria || esAusenciaJustificada);
                      }).length;
                      return pendientes > 0 ? (
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          selectedTab === 'aprobacion'
                            ? 'bg-white/30 text-white'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {pendientes}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </button>
              </div>


              {/* Selector meses y tipo - Dropdowns en línea */}
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                {selectedTab === 'control_vacaciones' ? (
                  <div className="flex-1 sm:flex-initial sm:w-auto">
                    <label
                      htmlFor="vacation-control-year"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Año (cupos y calendario)
                    </label>
                    <select
                      id="vacation-control-year"
                      value={vacationControlYear}
                      onChange={(e) => setVacationControlYear(Number(e.target.value))}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-teal-800 border-2 border-teal-200 hover:border-teal-400 cursor-pointer"
                    >
                      {[0, 1, 2].map((offset) => {
                        const y = new Date().getFullYear() - 1 + offset;
                        return (
                          <option key={y} value={y}>
                            📅 {y}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 max-w-md">
                      La tabla cuenta empleados únicos con vacaciones en el mes (no el cupo simultáneo por día).
                    </p>
                  </div>
                ) : (
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="flex-1 sm:flex-initial sm:w-auto min-w-0">
                    <label htmlFor="month-selector" className="block text-sm font-semibold text-gray-700 mb-2">
                      Filtrar por mes
                    </label>
                    <select
                      id="month-selector"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-indigo-700 border-2 border-indigo-200 hover:border-indigo-400 cursor-pointer"
                    >
                      {MONTHS.map((month, idx) => (
                        <option key={month} value={idx}>
                          {idx === 0 ? `📅 ${month}` : month}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedMonth > 0 && (
                    <div className="flex-1 sm:flex-initial sm:w-auto min-w-0">
                      <label
                        htmlFor="todas-month-filter-year"
                        className="block text-sm font-semibold text-gray-700 mb-2"
                      >
                        Año (lista y Control vacaciones)
                      </label>
                      <select
                        id="todas-month-filter-year"
                        value={vacationControlYear}
                        onChange={(e) => setVacationControlYear(Number(e.target.value))}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-indigo-700 border-2 border-indigo-200 hover:border-indigo-400 cursor-pointer"
                      >
                        {[0, 1, 2].map((offset) => {
                          const y = new Date().getFullYear() - 1 + offset;
                          return (
                            <option key={y} value={y}>
                              📅 {y}
                            </option>
                          );
                        })}
                      </select>
                      <p className="mt-1 text-xs text-gray-500 max-w-xs hidden sm:block">
                        Mismo año que la tabla Control vacaciones. El mes incluye solicitudes cuyo periodo se solapa con
                        ese mes (no solo las que empiezan en el mes).
                      </p>
                    </div>
                  )}
                  {selectedTab === 'vacaciones' && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-900 text-sm shadow-sm shrink-0"
                      title={`Empleados distintos con al menos una solicitud en la lista (año ${vacationControlYear}, periodo solapado con el mes)`}
                    >
                      <span className="text-base" aria-hidden>
                        👤
                      </span>
                      <span>
                        <span className="font-bold text-lg tabular-nums">{vacacionesListaEmpleadosUnicos}</span>
                        <span className="text-cyan-800/90"> empleado(s)</span>
                      </span>
                    </div>
                  )}
                </div>
                )}

                {/* Selector tipo ausencia - Multi-select Dropdown (doar pentru tab-ul 'ausencias') */}
                {selectedTab === 'ausencias' && (
                  <div className="flex-1 sm:flex-initial sm:w-auto relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Filtrar por tipo
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        id="tipo-ausencia-selector"
                        onClick={() => setShowTipoDropdown(!showTipoDropdown)}
                        aria-haspopup="listbox"
                        aria-expanded={showTipoDropdown}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-indigo-700 border-2 border-indigo-200 hover:border-indigo-400 cursor-pointer flex items-center justify-between gap-2 min-w-[200px]"
                      >
                        <span>
                          {selectedTipoAusencia.includes('ALL') || selectedTipoAusencia.length === 0
                            ? '📋 Todos los tipos'
                            : selectedTipoAusencia.length === 1
                            ? selectedTipoAusencia[0]
                            : `${selectedTipoAusencia.length} tipos seleccionados`}
                        </span>
                        <span className="text-xs">▼</span>
                      </button>
                      
                      {showTipoDropdown && (
                        <div 
                          role="listbox"
                          aria-labelledby="tipo-ausencia-selector"
                          className="absolute z-50 mt-1 w-full sm:w-auto min-w-[250px] bg-white border-2 border-indigo-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                        >
                          <div className="p-2">
                            <label className="flex items-center gap-2 p-2 hover:bg-indigo-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedTipoAusencia.includes('ALL')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTipoAusencia(['ALL']);
                                  } else {
                                    setSelectedTipoAusencia([]);
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                                aria-label="Todos los tipos"
                              />
                              <span className="text-sm font-semibold text-indigo-700">📋 Todos los tipos</span>
                            </label>
                            <div className="border-t border-indigo-200 my-1"></div>
                            {ausenciaTipos.map((tipo) => (
                              <label
                                key={tipo}
                                className="flex items-center gap-2 p-2 hover:bg-indigo-50 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTipoAusencia.includes(tipo)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      // Elimină 'ALL' dacă există și adaugă tipul selectat
                                      const newSelection = selectedTipoAusencia.filter(t => t !== 'ALL');
                                      setSelectedTipoAusencia([...newSelection, tipo]);
                                    } else {
                                      // Elimină tipul din selecție
                                      const newSelection = selectedTipoAusencia.filter(t => t !== tipo);
                                      // Dacă nu mai sunt tipuri selectate, setează 'ALL'
                                      setSelectedTipoAusencia(newSelection.length === 0 ? ['ALL'] : newSelection);
                                    }
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                                  aria-label={`Filtrar por ${tipo}`}
                                />
                                <span className="text-sm text-gray-700">{tipo}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Click outside pentru a închide dropdown-ul */}
                    {showTipoDropdown && (
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowTipoDropdown(false)}
                      ></div>
                    )}
                  </div>
                )}
              </div>
            </div>

              {selectedTab === 'baja' && canAccessAllTabs && (
                <div className={`w-full mt-4 bg-rose-50 border border-rose-200 ${isMobile ? 'rounded-lg p-3' : 'rounded-2xl p-4'} flex flex-col md:flex-row md:items-center md:justify-between gap-3`}>
                  <div className={`${isMobile ? 'text-[11px]' : 'text-sm'} text-rose-700`}>
                    Sube el fichero XML/Excel con las bajas médicas para sincronizarlo con el
                    sistema. Se registrará al usuario que realiza la carga.
                  </div>
                  <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
                    <button
                      type="button"
                      onClick={handleBajaUploadClick}
                      disabled={
                        isOperationLoading('uploadBajas') || !BAJA_UPLOAD_ENDPOINT
                      }
                      className={`${isMobile ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2'} rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2 ${
                        isOperationLoading('uploadBajas') || !BAJA_UPLOAD_ENDPOINT
                          ? 'bg-rose-200 text-rose-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700'
                      }`}
                    >
                      <span className={isMobile ? 'text-sm' : ''}>{isOperationLoading('uploadBajas') ? '⏳' : '🩺'}</span>
                      <span>
                        {isOperationLoading('uploadBajas')
                          ? 'Cargando...'
                          : 'Cargar listado'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenManualBajaModal}
                      disabled={!BAJA_MANUAL_ENDPOINT}
                      className={`${isMobile ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2'} rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2 ${
                        !BAJA_MANUAL_ENDPOINT
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                      }`}
                      title="Añadir una baja manual (fuente: MANUAL)"
                    >
                      <span className={isMobile ? 'text-sm' : ''}>➕</span>
                      <span>Añadir manual</span>
                    </button>
                    {!BAJA_UPLOAD_ENDPOINT && (
                      <span className="text-xs text-rose-500">
                        Configura `VITE_UPLOAD_BAJAS_MEDICAS` para habilitar la carga.
                      </span>
                    )}
                    {!BAJA_MANUAL_ENDPOINT && (
                      <span className="text-xs text-gray-500">
                        Endpoint manual no configurado.
                      </span>
                    )}
                    <input
                      ref={bajaFileInputRef}
                      id="bajas-medicas-file"
                      name="bajas-medicas-file"
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.xml"
                      onChange={handleBajaFileChange}
                    />
                  </div>
                </div>
              )}

            {/* Panel de statistici pentru bajas médicas */}
            {selectedTab === 'baja' && canAccessAllTabs && (
              <div className={`bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 ${isMobile ? 'rounded-lg p-3' : 'rounded-xl p-6'} shadow-lg ${isMobile ? 'mb-3' : 'mb-6'}`}>
                <div className={`flex items-center justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                  <h3 className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-rose-900 flex items-center gap-2`}>
                    <span className={isMobile ? 'text-base' : ''}>📊</span>
                    <span className={isMobile ? 'text-xs' : ''}>Estadísticas de Bajas Médicas</span>
                  </h3>
                  <button
                    onClick={() => {
                      setOperationLoading('refreshBajas', true);
                      fetchBajasMedicas().finally(() => {
                        setOperationLoading('refreshBajas', false);
                      });
                    }}
                    disabled={isOperationLoading('refreshBajas') || isOperationLoading('bajas')}
                    className={`flex items-center gap-1.5 ${isMobile ? 'px-2 py-1 text-xs' : 'px-4 py-2'} bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Actualizar lista"
                  >
                    <RefreshCw 
                      className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${isOperationLoading('refreshBajas') || isOperationLoading('bajas') ? 'animate-spin' : ''}`} 
                    />
                    <span>{isMobile ? 'Actualizar' : 'Actualizar'}</span>
                  </button>
                </div>
                <div className={`grid grid-cols-1 md:grid-cols-3 ${isMobile ? 'gap-2' : 'gap-4'}`}>
                  <div 
                    onClick={() => setBajaFilter(null)}
                    className={`bg-white rounded-lg ${isMobile ? 'p-2.5' : 'p-4'} border-2 shadow-md cursor-pointer transition-all hover:shadow-lg ${
                      bajaFilter === null 
                        ? 'border-blue-400 shadow-lg scale-105' 
                        : 'border-blue-200 hover:border-blue-300'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setBajaFilter(null);
                      }
                    }}
                  >
                    <div className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium text-gray-600 ${isMobile ? 'mb-0.5' : 'mb-1'}`}>Total Casos</div>
                    <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-blue-700`}>{bajasStats.total}</div>
                  </div>
                  <div 
                    onClick={() => setBajaFilter('cerradas')}
                    className={`bg-white rounded-lg ${isMobile ? 'p-2.5' : 'p-4'} border-2 shadow-md cursor-pointer transition-all hover:shadow-lg ${
                      bajaFilter === 'cerradas' 
                        ? 'border-green-400 shadow-lg scale-105' 
                        : 'border-green-200 hover:border-green-300'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setBajaFilter('cerradas');
                      }
                    }}
                  >
                    <div className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium text-gray-600 ${isMobile ? 'mb-0.5' : 'mb-1'}`}>Casos Cerrados</div>
                    <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-green-700`}>{bajasStats.cerradas}</div>
                    <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-500 ${isMobile ? 'mt-0.5' : 'mt-1'}`}>Con alta médica</div>
                  </div>
                  <div 
                    onClick={() => setBajaFilter('abiertas')}
                    className={`bg-white rounded-lg ${isMobile ? 'p-2.5' : 'p-4'} border-2 shadow-md cursor-pointer transition-all hover:shadow-lg ${
                      bajaFilter === 'abiertas' 
                        ? 'border-orange-400 shadow-lg scale-105' 
                        : 'border-orange-200 hover:border-orange-300'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setBajaFilter('abiertas');
                      }
                    }}
                  >
                    <div className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium text-gray-600 ${isMobile ? 'mb-0.5' : 'mb-1'}`}>Casos Abiertos</div>
                    <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-orange-700`}>{bajasStats.abiertas}</div>
                    <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-500 ${isMobile ? 'mt-0.5' : 'mt-1'}`}>En seguimiento</div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista filtrada */}
            {selectedTab === 'control_vacaciones' ? (
              <div className="space-y-6 mb-6">
                {authUser?.isDemo ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
                    En modo demo no se cargan estadísticas de vacaciones para este panel.
                  </div>
                ) : isOperationLoading('allSolicitudes') ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" text="Cargando solicitudes..." />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-gray-900`}>
                          Vacaciones por grupo y mes (empleados)
                        </h3>
                        <p className="text-sm text-gray-600">
                          Año {vacationControlYear}. Solo activos. X/N y %: distintos con vacaciones en el mes. «Disp.
                          cubrir»: N − X (sin vacaciones en el mes). «Pico día / lím.»: en el día más cargado del mes,
                          cuántos del grupo están de vacaciones a la vez, frente al tope diario del grupo (regla
                          10%/15%). Si el pico supera el límite, revisar planificación. En cabecera:{' '}
                          <span className="text-emerald-700">Abierta</span> /{' '}
                          <span className="text-rose-700">Cerrada</span> según bloqueo de mes completo (misma lógica que
                          «Bloquear periodos vacaciones») o mes ya pasado.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setEstadisticasLoading(true);
                          try {
                            const response = await callApi(routes.getVacacionesEstadisticas, {
                              method: 'GET',
                            });
                            if (response?.success && response?.data?.success && response?.data?.estadisticas) {
                              setEstadisticas(response.data.estadisticas);
                            }
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setEstadisticasLoading(false);
                          }
                        }}
                        disabled={estadisticasLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold shadow hover:bg-teal-700 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${estadisticasLoading ? 'animate-spin' : ''}`} />
                        Actualizar empleados
                      </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-medium text-gray-500">Empleados activos</div>
                        <div className="text-2xl font-bold text-gray-900">{vacationControlUso.summary.total}</div>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
                        <div className="text-xs font-medium text-orange-800">Cupo agotado</div>
                        <div className="text-2xl font-bold text-orange-900">{vacationControlUso.summary.completo}</div>
                        <div className="text-[10px] text-orange-700 mt-1">Sin días restantes (con consumo)</div>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                        <div className="text-xs font-medium text-blue-800">Uso parcial</div>
                        <div className="text-2xl font-bold text-blue-900">{vacationControlUso.summary.parcial}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                        <div className="text-xs font-medium text-gray-600">Sin consumir</div>
                        <div className="text-2xl font-bold text-gray-900">{vacationControlUso.summary.sin_uso}</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
                      <table className="min-w-[900px] w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-teal-600 text-white">
                            <th className="sticky left-0 z-10 bg-teal-600 px-3 py-2 text-left font-semibold">Grupo</th>
                            <th
                              className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                              title="Empleados activos en el grupo (ESTADO = Activo)"
                            >
                              N
                            </th>
                            {MONTHS.slice(1).map((m, idx) => {
                              const st = vacationMonthHeaderStatus[idx];
                              const canInteract =
                                canAccessAllTabs && !authUser?.isDemo;
                              const pillClass = `inline-flex items-center justify-center gap-0.5 rounded-full px-1 py-0.5 text-[8px] sm:text-[9px] font-bold leading-none ${
                                st?.locked
                                  ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-200/80'
                                  : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80'
                              }`;
                              const pillInner = (
                                <>
                                  {st?.locked ? (
                                    <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden />
                                  ) : (
                                    <Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden />
                                  )}
                                  <span className="hidden sm:inline max-w-[3rem] truncate">
                                    {st?.locked ? 'Cerrada' : 'Abierta'}
                                  </span>
                                </>
                              );
                              return (
                                <th
                                  key={m}
                                  className="px-1 py-2 text-center font-semibold align-bottom min-w-[3.25rem]"
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[11px] sm:text-xs leading-tight">
                                      {m.slice(0, 3)}
                                    </span>
                                    {canInteract ? (
                                      <button
                                        type="button"
                                        data-vacation-month-trigger
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const r = e.currentTarget.getBoundingClientRect();
                                          setVacationMonthMenuPos({
                                            top: r.bottom + 6,
                                            left: r.left + r.width / 2,
                                          });
                                          setVacationMonthMenuIdx((prev) =>
                                            prev === idx ? null : idx,
                                          );
                                        }}
                                        className={`${pillClass} cursor-pointer hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
                                        title={`${st?.title ?? ''} Clic: bloquear o desbloquear el mes completo.`}
                                        aria-expanded={vacationMonthMenuIdx === idx}
                                        aria-haspopup="menu"
                                      >
                                        {pillInner}
                                      </button>
                                    ) : (
                                      <span className={pillClass} title={st?.title}>
                                        {pillInner}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {vacationControlByGroupMonth.length === 0 ? (
                            <tr>
                              <td colSpan={14} className="px-4 py-6 text-center text-gray-500">
                                No hay grupos con empleados en la lista cargada.
                              </td>
                            </tr>
                          ) : (
                            vacationControlByGroupMonth.map((row) => (
                              <tr key={row.group} className="hover:bg-gray-50/80">
                                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 border-r border-gray-100">
                                  {row.group}
                                </td>
                                <td className="text-center text-gray-600">{row.groupSize}</td>
                                {row.months.map((m) => (
                                  <td
                                    key={m.monthIndex}
                                    className={`px-1 py-2 text-center align-top ${
                                      m.groupSize > 0 &&
                                      m.empleadosConVacaciones >= m.groupSize
                                        ? 'bg-amber-50 text-amber-900'
                                        : m.empleadosConVacaciones > 0
                                          ? 'bg-teal-50/60'
                                          : ''
                                    }`}
                                    title={`${m.monthLabel}: ${m.empleadosConVacaciones} con vacaciones en el mes; ${m.empleadosDisponiblesCubrir} sin vacaciones en el mes. Pico: hasta ${m.picoSimultaneosMes} a la vez en un día (carga a repartir); límite regla: ${m.limiteSimultaneosDia}/día.`}
                                  >
                                    <div className="font-bold leading-tight">
                                      {m.empleadosConVacaciones}/{m.groupSize}
                                    </div>
                                    <div className="text-[10px] text-gray-500 leading-tight">
                                      {m.groupSize > 0
                                        ? `${Math.round((100 * m.empleadosConVacaciones) / m.groupSize)}%`
                                        : '—'}
                                    </div>
                                    <div className="text-[10px] text-emerald-800/90 leading-tight mt-0.5 font-medium">
                                      Disp. cubrir: {m.empleadosDisponiblesCubrir}
                                    </div>
                                    <div
                                      className={`text-[10px] leading-tight mt-0.5 font-medium ${
                                        m.picoSimultaneosMes > m.limiteSimultaneosDia
                                          ? 'text-red-700'
                                          : 'text-slate-700'
                                      }`}
                                    >
                                      Pico día: {m.picoSimultaneosMes}
                                      <span className="text-slate-500 font-normal">
                                        {' '}
                                        / lím. {m.limiteSimultaneosDia}
                                      </span>
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {vacationMonthMenuIdx !== null &&
                      canAccessAllTabs &&
                      !authUser?.isDemo &&
                      vacationMonthHeaderStatus[vacationMonthMenuIdx] &&
                      createPortal(
                        <div
                          data-vacation-month-menu
                          role="menu"
                          aria-label="Bloqueo de mes de vacaciones"
                          className="fixed z-[100] min-w-[240px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg text-left text-sm"
                          style={{
                            top: vacationMonthMenuPos.top,
                            left: vacationMonthMenuPos.left,
                            transform: 'translateX(-50%)',
                          }}
                        >
                          {(() => {
                            const ms = vacationMonthHeaderStatus[vacationMonthMenuIdx];
                            const monthLabel =
                              MONTHS[vacationMonthMenuIdx + 1] ?? 'Mes';
                            if (ms.reason === 'past') {
                              return (
                                <p className="px-3 py-2 text-xs text-gray-600">
                                  {monthLabel} ({vacationControlYear}): mes pasado
                                  — no se puede bloquear ni desbloquear desde aquí.
                                </p>
                              );
                            }
                            if (ms.reason === 'open') {
                              return (
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={vacationMonthActionBusy}
                                  onClick={() =>
                                    handleVacationMonthBlockAction(
                                      vacationMonthMenuIdx,
                                      'block',
                                    )
                                  }
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-amber-50 disabled:opacity-50"
                                >
                                  {vacationMonthActionBusy
                                    ? 'Procesando…'
                                    : `Bloquear ${monthLabel} completo`}
                                </button>
                              );
                            }
                            if (ms.reason === 'api') {
                              if (ms.exactFullMonthPeriodId != null) {
                                return (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={vacationMonthActionBusy}
                                    onClick={() =>
                                      handleVacationMonthBlockAction(
                                        vacationMonthMenuIdx,
                                        'unblock',
                                      )
                                    }
                                    className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    {vacationMonthActionBusy
                                      ? 'Procesando…'
                                      : `Desbloquear ${monthLabel}`}
                                  </button>
                                );
                              }
                              return (
                                <p className="px-3 py-2 text-xs text-gray-600">
                                  {monthLabel} está cubierto por un periodo distinto
                                  al mes entero. Elimínalo en «Bloquear periodos
                                  vacaciones».
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>,
                        document.body,
                      )}

                    <div className="rounded-xl border border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-100/80">
                        <h4 className="font-semibold text-gray-900">
                          Contratación estimada (personal nuevo — no sobrecargar la plantilla)
                        </h4>
                        <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">
                          Aquí <strong>no</strong> se usa a tus empleados actuales para cubrir vacantes (eso
                          sumaría horas y puede chocar con límites de Seguridad Social). Se calcula cuántas
                          personas <strong>nuevas</strong> harían falta como refuerzo usando la misma regla que
                          arriba: en cada mes, déficit = «Pico día» − «límite» del grupo. El{' '}
                          <strong>mínimo a contratar «a la vez»</strong> es el peor déficit del año en ese grupo.
                          Si contratas ese mínimo, <strong>las mismas personas nuevas</strong> pueden ir cubriendo
                          varios meses del año, porque en ningún día necesitas más refuerzos simultáneos que ese
                          máximo. Es una <strong>estimación orientativa</strong>, no sustituye asesoría laboral.
                        </p>
                      </div>
                      {vacationNewHireEstimateByGroup.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">
                          No hay grupos con datos para esta estimación.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-[640px] w-full text-xs sm:text-sm">
                            <thead className="bg-slate-200/90">
                              <tr className="text-slate-900">
                                <th className="px-3 py-2 text-left font-semibold">Grupo</th>
                                <th
                                  className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                                  title="Activos en el grupo"
                                >
                                  N
                                </th>
                                <th
                                  className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                                  title="Mínimo de refuerzos simultáneos en el peor mes (pico − límite)"
                                >
                                  Mín. refuerzos (peor mes)
                                </th>
                                <th
                                  className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                                  title="Meses en que el pico supera el límite"
                                >
                                  Meses con déficit
                                </th>
                                <th className="px-3 py-2 text-left font-semibold min-w-[200px]">
                                  Déficit por mes (pico − lím.)
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {vacationNewHireEstimateByGroup.map((g) => (
                                <tr key={g.group} className="hover:bg-slate-50/90 align-top">
                                  <td className="px-3 py-2 font-medium text-gray-900">{g.group}</td>
                                  <td className="px-2 py-2 text-center text-gray-700">{g.groupSize}</td>
                                  <td className="px-2 py-2 text-center">
                                    {g.deficitMax > 0 ? (
                                      <span className="inline-flex items-center justify-center min-w-[2rem] rounded-lg bg-amber-100 text-amber-950 font-bold px-2 py-1 border border-amber-300">
                                        {g.deficitMax}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 font-medium">0</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-center text-gray-800">
                                    {g.mesesConDeficit}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700">
                                    <div className="flex flex-wrap gap-1">
                                      {g.months.map((m, idx) => {
                                        const d = g.deficits[idx] ?? 0;
                                        if (d <= 0) return null;
                                        return (
                                          <span
                                            key={m.monthIndex}
                                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-[10px] sm:text-xs"
                                            title={`${m.monthLabel}: pico ${m.picoSimultaneosMes}, lím. ${m.limiteSimultaneosDia}`}
                                          >
                                            {m.monthLabel.slice(0, 3)}:{' '}
                                            <strong className="text-amber-900">+{d}</strong>
                                          </span>
                                        );
                                      })}
                                      {g.mesesConDeficit === 0 && (
                                        <span className="text-gray-500 text-xs">—</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {vacationNewHireEstimateByGroup.some((x) => x.deficitMax > 0) && (
                        <div className="px-4 py-3 border-t border-slate-200 bg-white text-xs text-gray-600 leading-relaxed">
                          <strong className="text-gray-800">Continuidad:</strong> el número «Mín. refuerzos» es
                          el máximo simultáneo que necesitas en un solo día del año (en el peor mes). Contratando
                          al menos esa cifra por grupo, puedes repartir esas mismas personas a lo largo de los
                          meses con déficit sin exigir más horas a quien ya está en nómina.
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-violet-100">
                        <h4 className="font-semibold text-gray-900">
                          Limpiador / Auxiliar De Servicios — L: contrato &lt; 8 h/día (Lun–Vie)
                        </h4>
                        <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">
                          Lista de activos del grupo <strong>Limpiador</strong> o{' '}
                          <strong>Auxiliar De Servicios - L</strong> cuyo <strong>HORAS DE CONTRATO</strong>{' '}
                          implica menos de <strong>8 h/día</strong> Lun–Vie. Columnas de <strong>contrato</strong>:
                          si el valor es &gt; 12 se trata como semanal (÷5); si no, como diario. Columnas de{' '}
                          <strong>horario</strong>: se busca en el catálogo <code className="text-xs bg-violet-100 px-1 rounded">horarios</code>{' '}
                          la fila con mismo <strong>CENTRO TRABAJO</strong> y <strong>GRUPO</strong> que el
                          empleado y vigencia que incluya hoy; se usan{' '}
                          <code className="text-xs bg-violet-100 px-1 rounded">total_horas_semanales</code> o{' '}
                          <code className="text-xs bg-violet-100 px-1 rounded">total_minutos_semanales</code> → h/día
                          = ÷5. Si no hay coincidencia o no hay totales, aparece «—». En{' '}
                          <strong>h/día (horario)</strong>, valor en <strong className="text-red-600">rojo</strong> si
                          difiere de <strong>h/día (contr.)</strong> (tolerancia 0,05 h).{' '}
                          <strong>H. sem. (contr.)</strong> y <strong>Puede subir (h/sem)</strong>: horas semanales
                          inferidas del contrato (misma regla que arriba) y margen hasta <strong>40 h/sem</strong> de
                          referencia (orientativo, no compromiso legal).
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <label className="text-gray-700 font-medium whitespace-nowrap">
                            Cruzar con vacaciones (mes):
                          </label>
                          <select
                            className="rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-gray-900 text-sm shadow-sm focus:ring-2 focus:ring-violet-300"
                            value={vacationPartTimeCompareMonth}
                            onChange={(e) =>
                              setVacationPartTimeCompareMonth(Number(e.target.value))
                            }
                          >
                            {MONTHS.slice(1).map((m, idx) => (
                              <option key={m} value={idx}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <span className="text-gray-600 text-xs sm:text-sm">
                            Año: <strong className="text-gray-800">{vacationControlYear}</strong> (mismo selector
                            «Año» del panel de control arriba)
                          </span>
                          <button
                            type="button"
                            onClick={exportLimpiadorRefuerzoTableXlsx}
                            disabled={vacationControlLimpiadorPartTimeList.length === 0}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400 bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 disabled:pointer-events-none"
                            title="Descargar esta tabla en Excel (.xlsx)"
                          >
                            Exportar Excel (.xlsx)
                          </button>
                        </div>
                        <p className="text-xs text-violet-900/80 mt-2 leading-relaxed">
                          <strong>Vac. mes:</strong> solicitud de vacaciones (Aprobada o Pendiente) con fechas que
                          solapan el mes elegido. <strong>¿Refuerzo?</strong> empleado <em>no</em> en vacaciones ese
                          mes y con <strong>margen</strong> hacia 8 h (contrato u horario) <strong>o</strong> con{' '}
                          <strong>subida posible</strong> hacia 40 h/sem en «Puede subir».{' '}
                          <strong>Cubre vacaciones</strong>: quién puede cubrir a quién si eres refuerzo.{' '}
                          <strong>Le pueden cubrir</strong>: si <strong>Vac. mes = Sí</strong>, lista inversa (quién
                          de esta tabla podría cubrirte en tu centro u otro centro mismo grupo). Mismas reglas de
                          horas y subida. Si un nombre lleva <strong>«+X h sobre 8 h/día»</strong>, es una suma
                          orientativa (jornada habitual del refuerzo + h/día del puesto a cubrir) que supera el tope
                          de referencia de 8 h/día en X horas; no implica doble jornada real automática. Orientativo.
                        </p>
                      </div>
                      {vacationControlLimpiadorPartTimeList.length > 0 && (
                        <div className="px-4 py-2.5 bg-violet-50/90 border-b border-violet-100 text-xs text-gray-800 space-y-1.5">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span>
                              <strong>
                                {MONTHS[vacationPartTimeCompareMonth + 1]} {vacationControlYear}
                              </strong>
                              :{' '}
                              <span className="text-amber-900">
                                {vacationPartTimeCompareSummary.enVacacionesCount} en vacaciones
                              </span>
                              {' · '}
                              <span className="text-emerald-900">
                                {vacationPartTimeCompareSummary.refuerzoCount} candidatos a refuerzo
                              </span>
                            </span>
                          </div>
                          {vacationPartTimeCompareSummary.enVacacionesNombres.length > 0 && (
                            <p
                              className="text-gray-700 line-clamp-2"
                              title={vacationPartTimeCompareSummary.enVacacionesNombres.join(', ')}
                            >
                              <span className="font-medium text-gray-800">En vacaciones:</span>{' '}
                              {vacationPartTimeCompareSummary.enVacacionesNombres.join(', ')}
                            </p>
                          )}
                          {vacationPartTimeCompareSummary.refuerzoNombres.length > 0 && (
                            <p
                              className="text-gray-700 line-clamp-2"
                              title={vacationPartTimeCompareSummary.refuerzoNombres.join(', ')}
                            >
                              <span className="font-medium text-gray-800">Candidatos refuerzo:</span>{' '}
                              {vacationPartTimeCompareSummary.refuerzoNombres.join(', ')}
                            </p>
                          )}
                          {vacationPartTimeCompareSummary.enVacacionesCount === 0 && (
                            <p className="text-violet-900/90 border-t border-violet-200/80 pt-1.5 mt-1">
                              Con <strong>0</strong> personas de esta tabla en vacaciones el mes, las columnas
                              «Cubre vacaciones» muestran <em>Sin bajas en el mes</em> (no es un error: no hay a
                              quién cubrir dentro de esta lista).
                            </p>
                          )}
                        </div>
                      )}
                      {authUser?.isDemo || !allUsers?.length ? (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">
                          {authUser?.isDemo
                            ? 'En modo demo no hay lista de empleados.'
                            : 'Cargando empleados…'}
                        </div>
                      ) : vacationControlLimpiadorPartTimeList.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-600 text-sm">
                          No hay Limpiador / Auxiliar L activos con contrato &lt; 8 h/día según los datos, o falta
                          «HORAS DE CONTRATO» en ficha.
                        </div>
                      ) : (
                        <div className="overflow-x-auto max-h-[min(60vh,420px)] overflow-y-auto">
                          <table className="min-w-[2100px] w-full text-xs sm:text-sm">
                            <thead className="bg-violet-100/90 sticky top-0 z-[1]">
                              <tr className="text-violet-950">
                                <th className="sticky left-0 z-[2] bg-violet-100 px-3 py-2 text-left font-semibold">
                                  Empleado
                                </th>
                                <th className="px-2 py-2 text-left font-semibold max-w-[140px]">Centro</th>
                                <th className="px-2 py-2 text-left font-semibold">Grupo</th>
                                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap border-l border-violet-200">
                                  H. contrato
                                </th>
                                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                                  h/día (contr.)
                                </th>
                                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                                  hasta 8 (contr.)
                                </th>
                                <th
                                  className="px-2 py-2 text-center font-semibold whitespace-nowrap border-l border-violet-200"
                                  title="Horas semanales según contrato: si el valor es >12 se toma como semanal; si no, h/día × 5."
                                >
                                  H. sem. (contr.)
                                </th>
                                <th
                                  className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                                  title="Margen orientativo hasta 40 h/semana de referencia (jornada completa típica)."
                                >
                                  Puede subir (h/sem)
                                </th>
                                <th className="px-2 py-2 text-left font-semibold max-w-[160px] border-l border-violet-200">
                                  Horario (catálogo)
                                </th>
                                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                                  H. sem. (horario)
                                </th>
                                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                                  h/día (horario)
                                </th>
                                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                                  hasta 8 (horario)
                                </th>
                                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap border-l border-violet-200">
                                  Vac. mes
                                </th>
                                <th
                                  className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                                  title="Sí si no está en vacaciones el mes y tiene margen hacia 8 h o puede subir contrato (40 h/sem ref.)."
                                >
                                  ¿Refuerzo?
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-semibold min-w-[200px] max-w-[260px]"
                                  title="Mismo centro; solo si h/día refuerzo + margen hacia 8 h ≥ h/día del puesto (compañero en vacaciones)."
                                >
                                  Cubre vacaciones (mismo centro)
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-semibold min-w-[200px] max-w-[240px]"
                                  title="Mismo grupo, distinto centro; mismo filtro de horas que la columna anterior. Varias bajas distintas; no cubrirlas todas a la vez."
                                >
                                  Cubre vacaciones (otro centro, mismo grupo)
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-semibold min-w-[200px] max-w-[240px] border-l border-violet-200"
                                  title="Si estás en vacaciones el mes: compañeros de esta lista que podrían cubrirte (mismo centro)."
                                >
                                  Le pueden cubrir (mismo centro)
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-semibold min-w-[200px] max-w-[240px]"
                                  title="Si estás en vacaciones: refuerzo en otro centro, mismo grupo."
                                >
                                  Le pueden cubrir (otro centro)
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-violet-100">
                              {vacationPartTimeRefuerzoCobertura.rows.map((r) => (
                                <tr key={r.codigo || r.nombre} className="hover:bg-white/90">
                                  <td className="sticky left-0 z-[1] bg-white px-3 py-2 font-medium text-gray-900 border-r border-gray-100 max-w-[200px] truncate">
                                    {r.nombre}
                                    {r.codigo ? (
                                      <span className="block text-[10px] text-gray-500 font-normal">
                                        {r.codigo}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 max-w-[140px] truncate" title={r.centroTrabajo}>
                                    {r.centroTrabajo || '—'}
                                  </td>
                                  <td className="px-2 py-2 text-gray-800 whitespace-nowrap">{r.grupoRaw}</td>
                                  <td className="px-2 py-2 text-center text-gray-700 whitespace-nowrap border-l border-violet-100">
                                    {r.horasContratoRaw}
                                    {r.interpretacionSemanal ? (
                                      <span className="block text-[10px] text-violet-700">(sem.)</span>
                                    ) : (
                                      <span className="block text-[10px] text-violet-700">(día)</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-center font-medium text-gray-900">
                                    {r.horasDia}
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[2.25rem] rounded-lg bg-violet-100 text-violet-950 font-bold px-1.5 py-0.5 border border-violet-300 text-[11px]">
                                      {r.horasDisponiblesHasta8}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-center text-gray-800 whitespace-nowrap border-l border-violet-200">
                                    {r.horasSemanalesContrato != null ? r.horasSemanalesContrato : '—'}
                                  </td>
                                  <td className="px-2 py-2 text-center whitespace-nowrap">
                                    {r.puedeSubirContratoHasta40Semanal != null ? (
                                      <span
                                        className={`inline-flex items-center justify-center min-w-[2.25rem] rounded-lg font-bold px-1.5 py-0.5 border text-[11px] ${
                                          r.puedeSubirContratoHasta40Semanal > 0.05
                                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                            : 'bg-gray-100 text-gray-500 border-gray-200'
                                        }`}
                                        title="Hasta 40 h/sem de referencia; si 0, el contrato ya alcanza ese tope en la ficha."
                                      >
                                        {r.puedeSubirContratoHasta40Semanal}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-gray-800 max-w-[160px] truncate border-l border-violet-100" title={r.horarioNombre || ''}>
                                    {r.horarioNombre ? (
                                      <>
                                        {r.horarioNombre}
                                        {r.horarioId != null ? (
                                          <span className="block text-[10px] text-gray-500">id {r.horarioId}</span>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-center text-gray-800 whitespace-nowrap">
                                    {r.horasSemanalesHorario != null ? r.horasSemanalesHorario : '—'}
                                  </td>
                                  <td
                                    className={`px-2 py-2 text-center font-medium ${
                                      r.horasDiaHorario != null &&
                                      Number.isFinite(r.horasDia) &&
                                      Math.abs(r.horasDiaHorario - r.horasDia) > 0.05
                                        ? 'text-red-600'
                                        : 'text-gray-900'
                                    }`}
                                    title={
                                      r.horasDiaHorario != null &&
                                      Number.isFinite(r.horasDia) &&
                                      Math.abs(r.horasDiaHorario - r.horasDia) > 0.05
                                        ? `No coincide con h/día contrato (${r.horasDia})`
                                        : undefined
                                    }
                                  >
                                    {r.horasDiaHorario != null ? r.horasDiaHorario : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {r.horasDisponiblesHasta8Horario != null ? (
                                      <span className="inline-flex items-center justify-center min-w-[2.25rem] rounded-lg bg-fuchsia-50 text-fuchsia-950 font-bold px-1.5 py-0.5 border border-fuchsia-200 text-[11px]">
                                        {r.horasDisponiblesHasta8Horario}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-center whitespace-nowrap border-l border-violet-200">
                                    {r.enVacacionesEnMesSeleccionado ? (
                                      <span className="text-amber-800 font-semibold" title="Vacaciones Aprobada/Pendiente en el mes">
                                        Sí
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">No</span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-center whitespace-nowrap"
                                    title={r.refuerzoDetalle}
                                  >
                                    {r.enVacacionesEnMesSeleccionado ? (
                                      <span className="text-gray-400" title="En vacaciones: no aplica como refuerzo">
                                        —
                                      </span>
                                    ) : r.refuerzoPosibleJornada ? (
                                      <span className="text-emerald-800 font-semibold">Sí</span>
                                    ) : (
                                      <span className="text-gray-500">No</span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-left align-top text-gray-800 max-w-[280px]"
                                    title={r.refuerzoVacantesTooltip || undefined}
                                  >
                                    {!r.refuerzoPosibleJornada ? (
                                      <span className="text-gray-400">—</span>
                                    ) : r.refuerzoVacantesEtiqueta ? (
                                      <span className="line-clamp-3 text-[11px] sm:text-xs leading-snug">
                                        {r.refuerzoVacantesEtiqueta}
                                      </span>
                                    ) : vacationPartTimeRefuerzoCobertura.stats.vacacionesTotal === 0 ? (
                                      <span
                                        className="text-violet-800/90 text-[11px] sm:text-xs italic"
                                        title="Ningún empleado de esta tabla tiene vacaciones (Aprobada/Pendiente) en el mes y año seleccionados; no hay bajas que cubrir en esta lista."
                                      >
                                        Sin bajas en el mes
                                      </span>
                                    ) : (
                                      <span
                                        className="text-gray-500 text-[11px] sm:text-xs"
                                        title="Hay compañeros en vacaciones, pero ninguno con el mismo centro que tú (o falta centro en ficha)."
                                      >
                                        Sin coincidencia
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-left align-top text-gray-800 max-w-[260px] border-l border-violet-100"
                                    title={r.refuerzoVacantesOtroCentroTooltip || undefined}
                                  >
                                    {!r.refuerzoPosibleJornada ? (
                                      <span className="text-gray-400">—</span>
                                    ) : r.refuerzoVacantesOtroCentroEtiqueta ? (
                                      <span className="line-clamp-3 text-[11px] sm:text-xs leading-snug">
                                        {r.refuerzoVacantesOtroCentroEtiqueta}
                                      </span>
                                    ) : vacationPartTimeRefuerzoCobertura.stats.vacacionesTotal === 0 ? (
                                      <span
                                        className="text-violet-800/90 text-[11px] sm:text-xs italic"
                                        title="Ningún empleado de esta tabla tiene vacaciones (Aprobada/Pendiente) en el mes y año seleccionados; no hay bajas que cubrir en esta lista."
                                      >
                                        Sin bajas en el mes
                                      </span>
                                    ) : (
                                      <span
                                        className="text-gray-500 text-[11px] sm:text-xs"
                                        title="Hay compañeros en vacaciones, pero ninguno con mismo grupo y otro centro distinto al tuyo (o falta centro en ficha)."
                                      >
                                        Sin coincidencia
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-left align-top text-gray-800 max-w-[240px] border-l border-violet-200"
                                    title={r.lePuedenCubrirMismoCentroTooltip || undefined}
                                  >
                                    {!r.enVacacionesEnMesSeleccionado ? (
                                      <span className="text-gray-400" title="Solo si tienes vacaciones en el mes seleccionado">
                                        —
                                      </span>
                                    ) : r.lePuedenCubrirMismoCentroEtiqueta ? (
                                      <span className="line-clamp-3 text-[11px] sm:text-xs leading-snug text-teal-900">
                                        {r.lePuedenCubrirMismoCentroEtiqueta}
                                      </span>
                                    ) : vacationPartTimeRefuerzoCobertura.stats.vacacionesTotal === 0 ? (
                                      <span className="text-gray-400 text-[11px]">—</span>
                                    ) : (
                                      <span
                                        className="text-gray-500 text-[11px] sm:text-xs"
                                        title="Ningún candidato a refuerzo en esta lista con mismo centro y horas suficientes."
                                      >
                                        Sin coincidencia
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-left align-top text-gray-800 max-w-[240px]"
                                    title={r.lePuedenCubrirOtroCentroTooltip || undefined}
                                  >
                                    {!r.enVacacionesEnMesSeleccionado ? (
                                      <span className="text-gray-400" title="Solo si tienes vacaciones en el mes seleccionado">
                                        —
                                      </span>
                                    ) : r.lePuedenCubrirOtroCentroEtiqueta ? (
                                      <span className="line-clamp-3 text-[11px] sm:text-xs leading-snug text-teal-900">
                                        {r.lePuedenCubrirOtroCentroEtiqueta}
                                      </span>
                                    ) : vacationPartTimeRefuerzoCobertura.stats.vacacionesTotal === 0 ? (
                                      <span className="text-gray-400 text-[11px]">—</span>
                                    ) : (
                                      <span
                                        className="text-gray-500 text-[11px] sm:text-xs"
                                        title="Ningún refuerzo con mismo grupo y otro centro que pueda cubrir tus h/día."
                                      >
                                        Sin coincidencia
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {vacationControlLimpiadorPartTimeList.length > 0 && (
                        <div className="px-4 py-3 border-t border-violet-100 bg-white text-xs text-gray-800 leading-relaxed space-y-1.5">
                          <p className="font-semibold text-gray-900">
                            Cobertura interna (esta lista, mes seleccionado)
                          </p>
                          {vacationPartTimeRefuerzoCobertura.stats.vacacionesTotal === 0 ? (
                            <p className="text-gray-600">
                              No hay empleados de esta tabla en vacaciones en el mes: no aplica el %.
                            </p>
                          ) : (
                            <>
                              <p>
                                Bajas por vacaciones en la lista:{' '}
                                <strong>{vacationPartTimeRefuerzoCobertura.stats.vacacionesTotal}</strong>. Con al
                                menos un candidato a refuerzo en el <strong>mismo centro y grupo</strong>:{' '}
                                <strong>
                                  {vacationPartTimeRefuerzoCobertura.stats.cubiertasMismoCentroYGrupo}
                                </strong>{' '}
                                (
                                {vacationPartTimeRefuerzoCobertura.stats.pctCentroYGrupo != null
                                  ? `${vacationPartTimeRefuerzoCobertura.stats.pctCentroYGrupo}%`
                                  : '—'}
                                ). Con al menos un refuerzo en el <strong>mismo centro</strong> (cualquier
                                grupo):{' '}
                                <strong>
                                  {vacationPartTimeRefuerzoCobertura.stats.cubiertasMismoCentro}
                                </strong>{' '}
                                (
                                {vacationPartTimeRefuerzoCobertura.stats.pctCentro != null
                                  ? `${vacationPartTimeRefuerzoCobertura.stats.pctCentro}%`
                                  : '—'}
                                ).
                              </p>
                              <p className="text-gray-600">
                                El % cuenta si el refuerzo puede cubrir las h/día del puesto (máx. actual o 8 h/día
                                si hay margen de subida a 40 h/sem). No garantiza solapes de fechas ni desplazamiento
                                entre sedes.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h4 className="font-semibold text-gray-900">Uso del cupo individual (activos)</h4>
                        {selectedUser !== 'ALL' && (
                          <span className="text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-100">
                            Filtrado por empleado seleccionado arriba
                          </span>
                        )}
                      </div>
                      {estadisticasLoading && vacationControlEmpleadosFiltrados.length === 0 ? (
                        <div className="flex justify-center py-10">
                          <LoadingSpinner size="lg" text="Cargando estadísticas de empleados..." />
                        </div>
                      ) : (
                        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                          <table className="min-w-[640px] w-full text-xs sm:text-sm">
                            <thead className="bg-gray-50 sticky top-0 z-[1]">
                              <tr>
                                <th className="text-left px-3 py-2 font-semibold text-gray-700">Empleado</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-700">Grupo</th>
                                <th className="text-center px-2 py-2 font-semibold text-gray-700">Generados</th>
                                <th className="text-center px-2 py-2 font-semibold text-gray-700">Consumidos</th>
                                <th className="text-center px-2 py-2 font-semibold text-gray-700">Restantes</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-700">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {vacationControlEmpleadosFiltrados.map((emp) => (
                                <tr key={emp.codigo} className="hover:bg-gray-50/80">
                                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{emp.nombre}</td>
                                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{emp.grupo || '—'}</td>
                                  <td className="px-2 py-2 text-center text-gray-700">
                                    {(emp.vacaciones?.dias_generados_hasta_hoy ?? 0).toFixed(1)}
                                  </td>
                                  <td className="px-2 py-2 text-center text-gray-700">
                                    {(emp.vacaciones?.dias_consumidos_aprobados ?? 0).toFixed(1)}
                                  </td>
                                  <td className="px-2 py-2 text-center font-semibold text-gray-900">
                                    {(emp.vacaciones?.dias_restantes ?? 0).toFixed(1)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {emp.estadoUso === 'completo' && (
                                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                                        Cupo agotado
                                      </span>
                                    )}
                                    {emp.estadoUso === 'parcial' && (
                                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                        Parcial
                                      </span>
                                    )}
                                    {emp.estadoUso === 'sin_uso' && (
                                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                        Sin consumo
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {vacationControlEmpleadosFiltrados.length === 0 && !estadisticasLoading && (
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">
                              No hay datos de empleados. Pulsa «Actualizar empleados».
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (isOperationLoading('allSolicitudes') || (selectedTab === 'ausencias' && isOperationLoading('ausencias'))) ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" text={selectedTab === 'ausencias' ? "Cargando ausencias..." : "Cargando todas las solicitudes..."} />
              </div>
            ) : (
              <div className="space-y-4">
                {successMsg && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    {successMsg}
                  </div>
                )}
                
                {getFilteredSolicitudes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {selectedTab === 'ausencias'
                      ? 'No existen ausencias para esta selección.'
                      : selectedTab === 'baja'
                      ? 'No existen bajas médicas para esta selección.'
                      : 'No existen solicitudes para esta selección.'}
                  </div>
                ) : (
                  <div className={isMobile ? "space-y-2" : "space-y-4"}>
                    {getFilteredSolicitudes.map(item => {
                      const durationInfo = getAusenciaDurationDisplay(item);
                      
                      // Pe mobil, folosim MobileAusenciaItemTodas pentru ausencias
                      if (isMobile && selectedTab === 'ausencias') {
                        return (
                          <MobileAusenciaItemTodas
                            key={item.id || item.email}
                            item={item}
                            getAusenciaDurationDisplay={getAusenciaDurationDisplay}
                            formatFechaFlexible={formatFechaFlexible}
                            getTipoColor={getTipoColor}
                            formatHora={formatHora}
                            getStatusColor={getStatusColor}
                            onComprobarJustificante={comprobarJustificantesForItem}
                            comprobarJustificanteItemId={comprobarJustificanteItemId}
                          />
                        );
                      }
                      
                      // Pe mobil, folosim MobileBajaMedicaItem pentru bajas médicas
                      if (isMobile && selectedTab === 'baja') {
                        return (
                          <MobileBajaMedicaItem
                            key={item.casoId || item.id}
                            item={item}
                            formatDate={formatDate}
                            formatDateTime={formatDateTime}
                            getSituacionColor={getSituacionColor}
                            isManager={isManager}
                            editingBaja={editingBaja}
                            editingBajaValue={editingBajaValue}
                            onEditSituacion={(value, shouldSave) => {
                              if (shouldSave) {
                                if (value !== item.situacion) {
                                  handleSaveBajaDate(item.casoId, item.posicionId, 'situacion', value);
                                } else {
                                  setEditingBaja(null);
                                  setEditingBajaValue('');
                                }
                              } else {
                                // Deschide editarea - folosește valoarea din item
                                setEditingBaja({ idCaso: item.casoId, idPosicion: item.posicionId, field: 'situacion' });
                                setEditingBajaValue(item.situacion || '');
                              }
                            }}
                            onEditFechaBaja={(value, shouldSave) => {
                              if (shouldSave) {
                                if (value !== item.fechaBaja) {
                                  handleSaveBajaDate(item.casoId, item.posicionId, 'fechaBaja', value);
                                } else {
                                  setEditingBaja(null);
                                  setEditingBajaValue('');
                                }
                              } else {
                                // Deschide editarea - convertește data pentru input type="date" (YYYY-MM-DD)
                                const dateStr = item.fechaBaja;
                                if (dateStr && dateStr !== '-') {
                                  try {
                                    const date = new Date(dateStr);
                                    if (!isNaN(date.getTime())) {
                                      const year = date.getFullYear();
                                      const month = String(date.getMonth() + 1).padStart(2, '0');
                                      const day = String(date.getDate()).padStart(2, '0');
                                      setEditingBajaValue(`${year}-${month}-${day}`);
                                    } else {
                                      setEditingBajaValue('');
                                    }
                                  } catch {
                                    setEditingBajaValue('');
                                  }
                                } else {
                                  setEditingBajaValue('');
                                }
                                setEditingBaja({ idCaso: item.casoId, idPosicion: item.posicionId, field: 'fechaBaja' });
                              }
                            }}
                            onEditFechaAlta={(value, shouldSave) => {
                              if (shouldSave) {
                                if (value !== item.fechaAlta) {
                                  handleSaveBajaDate(item.casoId, item.posicionId, 'fechaAlta', value);
                                } else {
                                  setEditingBaja(null);
                                  setEditingBajaValue('');
                                }
                              } else {
                                // Deschide editarea - convertește data pentru input type="date" (YYYY-MM-DD)
                                const dateStr = item.fechaAlta;
                                if (dateStr && dateStr !== '-') {
                                  try {
                                    const date = new Date(dateStr);
                                    if (!isNaN(date.getTime())) {
                                      const year = date.getFullYear();
                                      const month = String(date.getMonth() + 1).padStart(2, '0');
                                      const day = String(date.getDate()).padStart(2, '0');
                                      setEditingBajaValue(`${year}-${month}-${day}`);
                                    } else {
                                      setEditingBajaValue('');
                                    }
                                  } catch {
                                    setEditingBajaValue('');
                                  }
                                } else {
                                  setEditingBajaValue('');
                                }
                                setEditingBaja({ idCaso: item.casoId, idPosicion: item.posicionId, field: 'fechaAlta' });
                              }
                            }}
                            formatNumber={formatNumber}
                          />
                        );
                      }
                      
                      // Pe mobil, folosim MobileSolicitudItem (doar pentru tab-urile care nu sunt 'ausencias' sau 'baja')
                      if (isMobile && selectedTab !== 'ausencias' && selectedTab !== 'baja') {
                        // Transformăm item-ul pentru a fi compatibil cu MobileSolicitudItem
                        const solicitudForMobile = {
                          ...item,
                          fecha_solicitud: item.fecha_solicitud || item.created_at || item.CREATED_AT || item.createdAt,
                          FECHA: item.FECHA || item.fecha || (item.fecha_inicio && item.fecha_fin ? `${item.fecha_inicio} - ${item.fecha_fin}` : item.fecha_inicio || item.fecha),
                          fecha_inicio: item.fecha_inicio || (item.FECHA && item.FECHA.includes(' - ') ? item.FECHA.split(' - ')[0] : item.FECHA),
                          fecha_fin: item.fecha_fin || (item.FECHA && item.FECHA.includes(' - ') ? item.FECHA.split(' - ')[1] : null),
                          fecha: item.fecha || item.FECHA || item.fecha_inicio,
                          // Adăugăm numele pentru Vacaciones și Asuntos Propios
                          nombre: item.NOMBRE || item.nombre || getUserName(item.email),
                        };
                        
                        return (
                          <MobileSolicitudItem
                            key={item.id || item.email}
                            solicitud={solicitudForMobile}
                            getAusenciaDurationDisplay={getAusenciaDurationDisplay}
                            formatDate={formatDate}
                            formatDateRange={formatDateRange}
                            getStatusColor={getStatusColor}
                            getSolicitudTipoShort={getSolicitudTipoShort}
                            getStatusIndicatorColor={getStatusIndicatorColor}
                            justificantesPorAusencia={new Map()}
                            openUploadJustificanteModal={selectedTab === 'aprobacion' ? null : undefined}
                            onComprobarJustificante={selectedTab === 'aprobacion' ? comprobarJustificantesForItem : undefined}
                            comprobarJustificanteItemId={selectedTab === 'aprobacion' ? comprobarJustificanteItemId : null}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            isDeleting={isOperationLoading('delete')}
                          />
                        );
                      }
                      
                      return (
                    <div key={item.id || item.email} className="card hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-500 group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                            <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">
                              {selectedTab === 'ausencias'
                                ? '🚫'
                                : selectedTab === 'baja' || isBajaMedica(item.tipo)
                                ? '🩺'
                                : selectedTab === 'baja_voluntaria' || item.tipo === 'BAJA_VOLUNTARIA'
                                ? '🚪'
                                : item.tipo === 'Vacaciones'
                                ? '🏖️'
                                : '📅'}
                            </span>
                          </div>
                          <div className="flex-1">
                            {selectedTab === 'ausencias' ? (
                              <>
                                <h3 className="font-semibold text-gray-900 text-lg">{item.NOMBRE || item.nombre || 'N/A'}</h3>
                                <p className="text-sm text-gray-600">{item.CODIGO || item.codigo || 'N/A'}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    ID: {item.id}
                                  </span>
                                  {item.CODIGO && (
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      Código: {item.CODIGO}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getTipoColor(item.TIPO || item.tipo)}`}>
                                    {item.TIPO || item.tipo}
                                  </span>
                                  {/* Status (Pendiente / Aprobada / Rechazada) pentru Ausencias justificada și Permiso Retribuido */}
                                  {(tipo => {
                                    const t = (tipo || '').toLowerCase();
                                    const isJustificada = t.includes('ausencia') && t.includes('justificada');
                                    const isPermiso = t.includes('permiso') && t.includes('retribuido');
                                    if (!isJustificada && !isPermiso) return null;
                                    const estado = (item.estado || item.ESTADO || 'Aprobada').trim();
                                    return (
                                      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(estado)}`} title={`Estado: ${estado}`}>
                                        {estado === 'Aprobada' ? '✅ Aprobada' : estado === 'Pendiente' ? '⏳ Pendiente' : '❌ Rechazada'}
                                      </span>
                                    );
                                  })(item.TIPO || item.tipo)}
                                </div>
                              </>
                            ) : selectedTab === 'baja' ? (
                              <>
                                <h3 className="font-semibold text-gray-900 text-lg">
                                  Caso {item.casoId || item.id}
                                </h3>
                                {item.trabajador && (
                                  <p className="text-sm text-gray-600">
                                    Trabajador: {item.trabajador}
                                  </p>
                                )}
                                <p className="text-sm text-gray-600">
                                  Posición: {item.posicionId || 'N/A'}
                                </p>
                                {item.codigoEmpleado && (
                                  <p className="text-sm text-gray-600">
                                    Código empleado: {item.codigoEmpleado}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {editingBaja?.idCaso === item.casoId && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'situacion' ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={editingBajaValue || ''}
                                        onChange={(e) => setEditingBajaValue(e.target.value)}
                                        className={`text-xs font-medium rounded-full px-3 py-1 border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${getSituacionColor(editingBajaValue)}`}
                                        autoFocus
                                        onBlur={() => {
                                          if (editingBajaValue !== item.situacion) {
                                            handleSaveBajaDate(item.casoId, item.posicionId, 'situacion', editingBajaValue);
                                          } else {
                                            setEditingBaja(null);
                                            setEditingBajaValue('');
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (editingBajaValue !== item.situacion) {
                                              handleSaveBajaDate(item.casoId, item.posicionId, 'situacion', editingBajaValue);
                                            } else {
                                              setEditingBaja(null);
                                              setEditingBajaValue('');
                                            }
                                          } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setEditingBaja(null);
                                            setEditingBajaValue('');
                                          }
                                        }}
                                        placeholder="Situación"
                                      />
                                    </div>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getSituacionColor(
                                        item.situacion
                                      )}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (isManager && item.casoId && item.posicionId) {
                                          setEditingBaja({ idCaso: item.casoId, idPosicion: item.posicionId, field: 'situacion' });
                                          setEditingBajaValue(item.situacion || '');
                                        }
                                      }}
                                      title={isManager ? "Clic para editar" : ""}
                                    >
                                      {item.situacion || 'Situación desconocida'}
                                    </span>
                                  )}
                                  {item.fuente && (
                                    <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-800">
                                      Fuente: {item.fuente}
                                    </span>
                                  )}
                                </div>
                                {item.updatedAt && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Última actualización: {formatDateTime(item.updatedAt)}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <h3 className="font-semibold text-gray-900 text-lg">
                                  {item.NOMBRE || item.nombre || getUserName(item.email)}
                                </h3>
                                <p className="text-sm text-gray-600">{item.email}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    ID: {item.id}
                                  </span>
                                  {item.codigo && (
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      Código: {item.codigo}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getTipoColor(item.tipo)}`}>
                                    {item.tipo}
                                  </span>
                                  <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(item.estado)}`}>
                                    {item.estado === 'Aprobada' ? '✅' : item.estado === 'Pendiente' ? '⏳' : '❌'} {item.estado}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Iconițe Edit și Delete */}
                        {selectedTab !== 'baja' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {(() => {
                              const tipo = (item.tipo || item.TIPO || '').toLowerCase();
                              const estado = (item.estado || item.ESTADO || '').toLowerCase();
                              const esPendiente = estado === 'pendiente';
                              const esBajaVoluntaria = tipo.includes('baja') && tipo.includes('voluntaria');
                              const esPermisoRetribuido = tipo.includes('permiso') && tipo.includes('retribuido');
                              const esAusenciaJustificada = tipo.includes('ausencias') && tipo.includes('justificada');
                              
                              // Butoane pentru cererile pendiente în tab-ul "aprobacion" sau în tab-urile specifice
                              const showApprovalButtons = canAccessAllTabs && esPendiente && 
                                ((selectedTab === 'aprobacion' && (esBajaVoluntaria || esPermisoRetribuido || esAusenciaJustificada)) ||
                                 (selectedTab === 'baja_voluntaria' && esBajaVoluntaria) ||
                                 (selectedTab !== 'baja_voluntaria' && selectedTab !== 'aprobacion' && (esPermisoRetribuido || esAusenciaJustificada)));
                              
                              if (showApprovalButtons) {
                                // Butoane pentru BAJA_VOLUNTARIA (cu preview)
                                if (esBajaVoluntaria) {
                                  return (
                                    <>
                                      <button
                                        onClick={() => handlePreviewBajaVoluntaria(item)}
                                        className="group/preview relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-blue-50"
                                        title="Vista previa del PDF"
                                      >
                                        <span className="text-2xl">👁️</span>
                                      </button>
                                      <button
                                        onClick={() => handleApproveBajaVoluntaria(item)}
                                        disabled={isOperationLoading('approve')}
                                        className="group/approve relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Aprobar y enviar a gestoria"
                                      >
                                        <span className="text-2xl">✅</span>
                                      </button>
                                      <button
                                        onClick={() => handleRejectBajaVoluntaria(item)}
                                        disabled={isOperationLoading('reject')}
                                        className="group/reject relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Rechazar"
                                      >
                                        <span className="text-2xl">❌</span>
                                      </button>
                                    </>
                                  );
                                }
                                
                                // Butoane pentru Permiso Retribuido
                                if (esPermisoRetribuido) {
                                  return (
                                    <>
                                      <button
                                        onClick={() => handleApprovePermisoRetribuido(item)}
                                        disabled={isOperationLoading('approve-permiso')}
                                        className="group/approve relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Aprobar permiso retribuido"
                                      >
                                        <span className="text-2xl">✅</span>
                                      </button>
                                      <button
                                        onClick={() => handleRejectPermisoRetribuidoClick(item)}
                                        disabled={isOperationLoading('reject-permiso')}
                                        className="group/reject relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Rechazar permiso retribuido"
                                      >
                                        <span className="text-2xl">❌</span>
                                      </button>
                                    </>
                                  );
                                }
                                // Butoane pentru Ausencias justificada
                                if (esAusenciaJustificada) {
                                  return (
                                    <>
                                      <button
                                        onClick={() => handleApproveAusenciaJustificada(item)}
                                        disabled={isOperationLoading('approve-ausencia')}
                                        className="group/approve relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Aprobar ausencia justificada"
                                      >
                                        <span className="text-2xl">✅</span>
                                      </button>
                                      <button
                                        onClick={() => handleRejectPermisoRetribuidoClick(item)}
                                        disabled={isOperationLoading('reject-permiso')}
                                        className="group/reject relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Rechazar ausencia justificada"
                                      >
                                        <span className="text-2xl">❌</span>
                                      </button>
                                    </>
                                  );
                                }
                              }
                              
                              // Butoane normale Edit/Delete pentru restul
                              return (
                                <>
                                  <button
                                    onClick={() => handleEdit(item)}
                                    className="group/edit relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-blue-50"
                                    title="Editar solicitud"
                                  >
                                    <Edit className="w-5 h-5 text-blue-600 group-hover/edit:text-blue-700" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(item.id)}
                                    disabled={isOperationLoading('delete')}
                                    className="group/delete relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Eliminar solicitud"
                                  >
                                    <Trash2 className="w-5 h-5 text-red-600 group-hover/delete:text-red-700" />
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {/* Buton de ștergere pentru bajas medicas (doar dacă nu e MUTUA) */}
                        {selectedTab === 'baja' && canAccessAllTabs && item.fuente && String(item.fuente).toUpperCase() !== 'MUTUA' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                setDeleteBajaMedicaModal({ isOpen: true, baja: item, mensaje: '' });
                              }}
                              disabled={isOperationLoading('deleteBaja')}
                              className="group/delete relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Eliminar baja médica (solo si Fuente no es MUTUA)"
                            >
                              <Trash2 className="w-5 h-5 text-red-600 group-hover/delete:text-red-700" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {selectedTab === 'ausencias' ? (
                          <>
                            <div className="bg-blue-50 p-4 rounded-lg group-hover:bg-blue-100 transition-colors duration-300 border border-blue-200">
                            <span className="block text-xs font-medium text-blue-700 mb-1">📅 Fecha</span>
                              <p className="text-sm font-bold text-blue-900">{formatFechaFlexible(item.FECHA || item.fecha, item.fecha_inicio, item.fecha_fin)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duration-300">
                            <span className="block text-xs font-medium text-gray-600 mb-1">Hora</span>
                              <p className="text-sm font-bold text-gray-900">{formatHora(item.HORA || item.hora) || 'N/A'}</p>
                            </div>
                            {(item.created_at || item.CREATED_AT || item.createdAt) && (
                              <div className="bg-green-50 p-4 rounded-lg group-hover:bg-green-100 transition-colors duration-300 border border-green-200">
                              <span className="block text-xs font-medium text-green-700 mb-1">📋 Fecha Solicitud</span>
                                <p className="text-sm font-bold text-green-900">
                                  {(() => {
                                    const createdAt = item.created_at || item.CREATED_AT || item.createdAt;
                                    if (!createdAt) return 'N/A';
                                    try {
                                      const date = new Date(createdAt.replace(' ', 'T'));
                                      if (isNaN(date.getTime())) return createdAt;
                                      return `${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}`;
                                    } catch {
                                      return createdAt;
                                    }
                                  })()}
                                </p>
                              </div>
                            )}
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Ubicación</span>
                              <p className="text-sm font-bold text-gray-900">{item.LOCACION || item.locacion || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Duración</span>
                              <p className={`text-sm font-bold ${durationInfo.isDayBased ? 'text-blue-700' : 'text-purple-600'}`}>
                                {durationInfo.isDayBased ? `📅 ${durationInfo.text}` : `⏱️ ${durationInfo.text}`}
                              </p>
                            </div>
                          </>
                        ) : selectedTab === 'baja' ? (
                          <>
                            <div className="bg-rose-50 p-4 rounded-lg border border-rose-200 group-hover:bg-rose-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-rose-700 mb-1">🩺 Días de baja</span>
                              <p className="text-sm font-bold text-rose-900">{formatNumber(item.diasBaja)} días</p>
                              <p className="text-xs text-rose-700 mt-1">
                                Previsto SPS: {formatNumber(item.diasPrevistosSps)} días
                              </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 group-hover:bg-gray-50 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Fecha baja</span>
                              {editingBaja?.idCaso === item.casoId && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'fechaBaja' ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={editingBajaValue || ''}
                                    onChange={(e) => setEditingBajaValue(e.target.value)}
                                    className="text-sm font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    onBlur={() => {
                                      if (editingBajaValue !== item.fechaBaja) {
                                        handleSaveBajaDate(item.casoId, item.posicionId, 'fechaBaja', editingBajaValue);
                                      } else {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveBajaDate(item.casoId, item.posicionId, 'fechaBaja', editingBajaValue);
                                      } else if (e.key === 'Escape') {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <p 
                                  className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isManager && item.casoId && item.posicionId) {
                                      setEditingBaja({ idCaso: item.casoId, idPosicion: item.posicionId, field: 'fechaBaja' });
                                      // Convertește data pentru input type="date" (YYYY-MM-DD)
                                      const dateStr = item.fechaBaja;
                                      if (dateStr && dateStr !== '-') {
                                        try {
                                          const date = new Date(dateStr);
                                          if (!isNaN(date.getTime())) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setEditingBajaValue(`${year}-${month}-${day}`);
                                          } else {
                                            setEditingBajaValue('');
                                          }
                                        } catch {
                                          setEditingBajaValue('');
                                        }
                                      } else {
                                        setEditingBajaValue('');
                                      }
                                    }
                                  }}
                                  title={isManager ? "Clic para editar" : ""}
                                >
                                  {formatDate(item.fechaBaja)}
                                </p>
                              )}
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 group-hover:bg-gray-50 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Fecha alta</span>
                              {editingBaja?.idCaso === item.casoId && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'fechaAlta' ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={editingBajaValue || ''}
                                    onChange={(e) => setEditingBajaValue(e.target.value)}
                                    className="text-sm font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    onBlur={() => {
                                      if (editingBajaValue !== item.fechaAlta) {
                                        handleSaveBajaDate(item.casoId, item.posicionId, 'fechaAlta', editingBajaValue);
                                      } else {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveBajaDate(item.casoId, item.posicionId, 'fechaAlta', editingBajaValue);
                                      } else if (e.key === 'Escape') {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <p 
                                  className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isManager && item.casoId && item.posicionId) {
                                      setEditingBaja({ idCaso: item.casoId, idPosicion: item.posicionId, field: 'fechaAlta' });
                                      // Convertește data pentru input type="date" (YYYY-MM-DD)
                                      const dateStr = item.fechaAlta;
                                      if (dateStr && dateStr !== '-') {
                                        try {
                                          const date = new Date(dateStr);
                                          if (!isNaN(date.getTime())) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setEditingBajaValue(`${year}-${month}-${day}`);
                                          } else {
                                            setEditingBajaValue('');
                                          }
                                        } catch {
                                          setEditingBajaValue('');
                                        }
                                      } else {
                                        setEditingBajaValue('');
                                      }
                                    }
                                  }}
                                  title={isManager ? "Clic para editar" : ""}
                                >
                                  {formatDate(item.fechaAlta)}
                                </p>
                              )}
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Pago delegado</span>
                              <p className="text-sm font-bold text-gray-900">Inicio: {formatDate(item.inicioPagoDelegado)}</p>
                              <p className="text-xs text-gray-600 mt-1">Fin: {formatDate(item.finPagoDelegado)}</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 group-hover:bg-blue-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-blue-700 mb-1">Gestiones Mutua</span>
                              <p className="text-sm font-bold text-blue-900">Última: {formatDate(item.ultimaGestionMutua)}</p>
                              <p className="text-xs text-blue-700 mt-1">Próxima: {formatDate(item.proximaGestionMutua)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Seguimiento INSS</span>
                              <p className="text-sm font-bold text-gray-900">
                                Pendiente validación: {formatNumber(item.pendienteINSS)}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                Demora parte baja: {formatNumber(item.demoraParteBaja)} días
                              </p>
                            </div>
                          </>
                        ) : selectedTab === 'baja_voluntaria' || item.tipo === 'BAJA_VOLUNTARIA' ? (
                          <>
                            <div className="bg-blue-50 p-4 rounded-lg group-hover:bg-blue-100 transition-colors duration-300 border border-blue-200">
                              <span className="block text-xs font-medium text-blue-700 mb-1">📅 Fecha Solicitud</span>
                              <p className="text-sm font-bold text-blue-900">{formatDate(item.fecha_solicitud)}</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg group-hover:bg-purple-100 transition-colors duration-300 border border-purple-200">
                              <span className="block text-xs font-medium text-purple-700 mb-1">🚪 Último día de trabajo</span>
                              <p className="text-sm font-bold text-purple-900">
                                {formatDate(item.fecha_ultimo_dia_trabajo || item.fecha_inicio || item.fecha_fin)}
                              </p>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-lg group-hover:bg-amber-100 transition-colors duration-300 border border-amber-200">
                              <span className="block text-xs font-medium text-amber-700 mb-1">📊 Días de preaviso</span>
                              <p className="text-sm font-bold text-amber-900">
                                {item.dias_preaviso !== null && item.dias_preaviso !== undefined && item.dias_preaviso !== '' 
                                  ? `${item.dias_preaviso} días`
                                  : 'N/A'}
                              </p>
                            </div>
                            <div className={`p-4 rounded-lg group-hover:opacity-90 transition-colors duration-300 border ${
                              item.cumple_preaviso_15 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <span className="block text-xs font-medium mb-1" style={{
                                color: item.cumple_preaviso_15 ? '#065f46' : '#991b1b'
                              }}>
                                ✅ Cumple preaviso de 15 días
                              </span>
                              <p className="text-sm font-bold" style={{
                                color: item.cumple_preaviso_15 ? '#047857' : '#dc2626'
                              }}>
                                {item.cumple_preaviso_15 ? 'SÍ' : 'NO'}
                              </p>
                            </div>
                            {/* Documento asociado - dacă există */}
                            {(() => {
                              const documento = bajaVoluntariaDocumentos.get(item.id);
                              if (documento) {
                                const downloadUrl = `${routes.downloadDocumento || `${config.BACKEND_BASE || config.API_URL || ''}/api/documentos/download`}?documentId=${documento.doc_id}&id=${item.codigo || ''}&email=${encodeURIComponent(item.email || '')}&fileName=${encodeURIComponent(documento.nombre_archivo || '')}`;
                                return (
                                  <div className="bg-indigo-50 p-4 rounded-lg group-hover:bg-indigo-100 transition-colors duration-300 border border-indigo-200 col-span-full">
                                    <span className="block text-xs font-medium text-indigo-700 mb-2">📄 Documento firmado</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-indigo-900 font-medium flex-1">{documento.nombre_archivo || 'Documento'}</span>
                                      <a
                                        href={downloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const token = localStorage.getItem('auth_token');
                                          if (token) {
                                            // Adaugă token-ul la URL pentru download
                                            e.preventDefault();
                                            fetch(downloadUrl, {
                                              headers: {
                                                Authorization: `Bearer ${token}`,
                                              },
                                            })
                                              .then((res) => res.blob())
                                              .then((blob) => {
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = documento.nombre_archivo || 'documento.pdf';
                                                document.body.appendChild(a);
                                                a.click();
                                                window.URL.revokeObjectURL(url);
                                                document.body.removeChild(a);
                                              })
                                              .catch((err) => {
                                                console.error('Error downloading documento:', err);
                                                setErrorMsg('Error al descargar el documento');
                                              });
                                          }
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1"
                                      >
                                        📥 Descargar
                                      </a>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="bg-blue-50 p-4 rounded-lg group-hover:bg-blue-100 transition-colors duración-300 border border-blue-200">
                              <span className="block text-xs font-medium text-blue-700 mb-1">📅 Fecha Solicitud</span>
                              <p className="text-sm font-bold text-blue-900">{formatDate(item.fecha_solicitud)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Período</span>
                              <p className="text-sm font-bold text-gray-900">{item.FECHA || formatDate(item.fecha_inicio || item['fecha inicio'] || item.fecha)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</span>
                              <p className="text-sm font-bold text-gray-900">{item.FECHA ? (item.FECHA.includes(' - ') ? item.FECHA.split(' - ')[1] : item.FECHA) : formatDate(item.fecha_fin || item['fecha fin'])}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Duración</span>
                              <p className="text-sm font-bold text-purple-600">
                                {item.FECHA
                                  ? calculateDaysFromCombinedDate(item.FECHA)
                                  : calculateDays(item.fecha_inicio || item['fecha inicio'] || item.fecha, item.fecha_fin || item['fecha fin'])}{' '}
                                días
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Detalii Ausencias justificada (Todas): detalles + justificantes (Aprobación: botón bajo demanda) */}
                      {(() => {
                        const t = (item.tipo || item.TIPO || item.tipo_solicitud || item.TIPO_SOLICITUD || '').toLowerCase();
                        const esAusenciaJustificada = t.includes('ausencias') && t.includes('justificada');
                        if (!esAusenciaJustificada) return null;
                        const labels = {
                          cita_medica: 'Cita médica',
                          cita_especialista: 'Cita con especialista',
                          justificante_medico_sin_baja: 'Justificante médico (sin baja)',
                          deber_inexcusable: 'Deber inexcusable',
                          incidencia_puntual: 'Incidencia puntual/urgencia',
                          otro: 'Otro',
                        };
                        const tipoLabel = labels[item.tipo_justificante] || item.tipo_justificante || '—';
                        return (
                          <div className="mb-4 space-y-3">
                            <div className="p-4 rounded-lg border-2 border-cyan-200 bg-cyan-50/80">
                              <span className="block text-xs font-bold text-cyan-800 mb-2">📋 Detalles ausencia justificada</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                <div><span className="text-gray-600">Tipo justificante:</span> <span className="font-medium text-gray-900">{tipoLabel}</span></div>
                                {(item.hora_cita || item.HORA_CITA) && <div><span className="text-gray-600">Hora cita:</span> <span className="font-medium text-gray-900">{item.hora_cita || item.HORA_CITA}</span></div>}
                                {(item.centro_medico || item.CENTRO_MEDICO) && <div className="sm:col-span-2"><span className="text-gray-600">Centro médico:</span> <span className="font-medium text-gray-900">{item.centro_medico || item.CENTRO_MEDICO}</span></div>}
                                {(item.descripcion_otro || item.DESCRIPCION_OTRO) && <div className="sm:col-span-2"><span className="text-gray-600">Descripción (otro):</span> <span className="font-medium text-gray-900">{item.descripcion_otro || item.DESCRIPCION_OTRO}</span></div>}
                              </div>
                            </div>
                            {(item.motivo || item.MOTIVO) && (
                              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <span className="block text-xs font-medium text-blue-700 mb-1">Motivo</span>
                                <p className="text-sm text-blue-800">{item.motivo || item.MOTIVO}</p>
                              </div>
                            )}
                            {(selectedTab === 'aprobacion' || selectedTab === 'ausencias') ? (
                              <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    comprobarJustificantesForItem(item);
                                  }}
                                  disabled={comprobarJustificanteItemId === (item.id ?? item.ID)}
                                  className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                >
                                  {comprobarJustificanteItemId === (item.id ?? item.ID) ? '⏳ Comprobando…' : '🔍 Comprobar justificante'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                      
                      {selectedTab === 'ausencias' && !((item.tipo || item.TIPO || '').toLowerCase().includes('ausencias') && (item.tipo || item.TIPO || '').toLowerCase().includes('justificada')) && (item.MOTIVO || item.motivo) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                          <span className="block text-xs font-medium text-blue-700 mb-1">Motivo</span>
                          <p className="text-sm text-blue-800">{item.MOTIVO || item.motivo}</p>
                        </div>
                      )}

                      {/* Afișare justificante asociate cu ausencia - pentru angajați în tab-ul "ausencias" */}
                      {!canAccessAllTabs && selectedTab === 'ausencias' && (() => {
                        // IMPORTANT: Definim tipoAusencia pentru matching cu justificante
                        const tipoAusencia = item.tipo || item.TIPO || '';
                        const fechaAusencia = item.FECHA || item.fecha || item.fecha_inicio || item['fecha inicio'] || '';
                        // Normalizează data pentru matching (format YYYY-MM-DD)
                        let fechaNormalizada = '';
                        if (fechaAusencia) {
                          try {
                            // Dacă este format "DD/MM/YYYY" sau "D/M/YYYY" (ex: "8/1/2026")
                            if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                              const fechaParts = fechaAusencia.trim().split('/');
                              if (fechaParts.length === 3) {
                                fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                              }
                            } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
                              fechaNormalizada = fechaAusencia.substring(0, 10);
                            } else {
                              // Încearcă să parseze ca Date
                              const fecha = new Date(fechaAusencia);
                              if (!isNaN(fecha.getTime())) {
                                fechaNormalizada = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
                              }
                            }
                          } catch (e) {
                            console.warn('Error normalizando fecha:', fechaAusencia, e);
                          }
                        }
                        
                        // Key-urile nu sunt folosite direct în acest context
                        // const key = `${tipoAusencia}_${fechaNormalizada}`;
                        // const keySinEspacios = `${tipoAusencia.replace(/\s+/g, '')}_${fechaNormalizada}`;
                        
                        // Folosim state-ul direct pentru lookup (este întotdeauna actualizat)
                        // Ref-ul este folosit doar ca fallback dacă state-ul este gol (pentru React Strict Mode)
                        const currentMap = justificantesPorAusencia.size > 0 
                          ? justificantesPorAusencia 
                          : justificantesPorAusenciaRef.current;
                        
                        // PRIORITATE 1: Matching exact pe tipo_fecha (cel mai precis)
                        let justificante = null;
                        if (tipoAusencia && fechaNormalizada) {
                          const keyExact = `${tipoAusencia}_${fechaNormalizada}`;
                          const keyExactSinEspacios = `${tipoAusencia.replace(/\s+/g, '')}_${fechaNormalizada}`;
                          
                          justificante = currentMap.get(keyExact) || currentMap.get(keyExactSinEspacios);
                          
                          // PRIORITATE 2: Dacă nu găsește matching exact, caută pe dată dar VERIFICĂ TIPUL
                          if (!justificante) {
                            for (const [, value] of currentMap.entries()) {
                              // Verifică că data se potrivește
                              if (value.fechaAusencia === fechaNormalizada) {
                                // IMPORTANT: Verifică că tipul se potrivește (case-insensitive, fără spații)
                                const tipoJustificante = (value.tipoAusencia || '').toLowerCase().trim();
                                const tipoAusenciaNormalizado = tipoAusencia.toLowerCase().trim();
                                
                                if (tipoJustificante === tipoAusenciaNormalizado) {
                                  justificante = value;
                                  break;
                                }
                              }
                            }
                          }
                          
                          // Verificare finală: asigură-te că data și tipul se potrivesc
                          if (justificante) {
                            // Verifică data
                            if (justificante.fechaAusencia && fechaNormalizada && justificante.fechaAusencia !== fechaNormalizada) {
                              justificante = null;
                            }
                            // Verifică tipul (case-insensitive)
                            else if (justificante.tipoAusencia && tipoAusencia) {
                              const tipoJustificante = justificante.tipoAusencia.toLowerCase().trim();
                              const tipoAusenciaNormalizado = tipoAusencia.toLowerCase().trim();
                              if (tipoJustificante !== tipoAusenciaNormalizado) {
                                justificante = null;
                              }
                            }
                          }
                        }
                        
                        // IMPORTANT: Fiecare absență trebuie să aibă propriile justificante asociate pe baza tipului și datei
                        // Dacă nu se găsește matching exact, înseamnă că nu există justificante pentru această absență specifică
                        
                        // console.log('📄 Justificante encontrada (tab ausencias):', justificante ? 'found' : 'not found');
                        
                        if (justificante) {
                          const esPendiente = justificante.estado === 'pendiente';
                          const esCompletado = justificante.estado === 'completado';
                          
                          return (
                            <div className="mt-4 p-4 rounded-lg border-2 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">📋</span>
                                    <h4 className="font-bold text-gray-900">{justificante.tipo_documento}</h4>
                                    {esPendiente && (
                                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                        Pendiente
                                      </span>
                                    )}
                                    {esCompletado && (
                                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                        ✅ Completado
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-1">
                                    <p>Solicitado el {formatDate(justificante.fecha_solicitud)}</p>
                                    {esCompletado && justificante.fecha_completado && (
                                      <p>Completado el {formatDate(justificante.fecha_completado)}</p>
                                    )}
                                  </div>
                                </div>
                                {esPendiente && (
                                  <button
                                    onClick={() => {
                                      window.location.href = '/documentos';
                                    }}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm"
                                  >
                                    📤 Subir
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Indicator asociere ausencia + Buton asociar/desasociar */}
                      {selectedTab === 'ausencias' && isManager && (() => {
                        const ausenciaAsociadaId = item.ausencia_asociada_id;
                        const ausenciaAsociada = ausenciaAsociadaId 
                          ? allAusencias.find(a => (a.id || a.ID) === ausenciaAsociadaId)
                          : null;
                        
                        return (
                          <div className="mt-4 flex justify-between items-center gap-3">
                            {/* Indicator asociere */}
                            {ausenciaAsociada && (
                              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <span className="text-blue-600">🔗</span>
                                <span className="text-sm text-blue-700 font-medium">
                                  Asociada con: <span className="font-semibold">{ausenciaAsociada.TIPO || ausenciaAsociada.tipo} #{ausenciaAsociada.id || ausenciaAsociada.ID}</span>
                                </span>
                              </div>
                            )}
                            
                            {/* Butoane asociar/desasociar și marcar sin ausencia */}
                            <div className="flex gap-2 ml-auto">
                              {/* Buton "Recalcular Duración" - pentru ausencias cu interval de date dar durata greșită */}
                              {(() => {
                                const tipo = (item.tipo || item.TIPO || '').toLowerCase();
                                const fecha = item.FECHA || item.fecha || '';
                                // duracion și duracionNum nu sunt folosite în acest context
                                // const duracion = item.DURACION || item.duracion;
                                // const duracionNum = typeof duracion === 'number' ? duracion : parseFloat(duracion);
                                
                                // Verifică dacă este tip pe zile și are interval de date
                                // Exclude "vacaciones" și "asuntos propios"
                                const esTipoZile = (tipo.includes('permiso') || tipo.includes('ausencia')) 
                                  && !tipo.includes('vacacion') 
                                  && !tipo.includes('asunto propio');
                                const tieneIntervalo = fecha.includes(' - ');
                                
                                // Afișează butonul dacă este tip pe zile și are interval de date
                                return (esTipoZile && tieneIntervalo) ? (
                                  <button
                                    onClick={() => handleRecalcularDuracion(item.id || item.ID)}
                                    disabled={isOperationLoading('recalcular-duracion')}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Recalcular duración basada en el intervalo de fechas"
                                  >
                                    {isOperationLoading('recalcular-duracion') ? (
                                      <span className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Recalculando...
                                      </span>
                                    ) : (
                                      '🔄 Recalcular Duración'
                                    )}
                                  </button>
                                ) : null;
                              })()}
                              
                              {/* Buton "Calcular Duración" - doar pentru "Ausencias justificada" */}
                              {((item.tipo || item.TIPO) === 'Ausencias justificada' || (item.tipo || item.TIPO) === 'Ausencia Justificada') && (
                                <button
                                  onClick={() => handleCalcularDuracion(item.id || item.ID)}
                                  disabled={isOperationLoading('calcular-duracion')}
                                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Calcular duración basada en horas fichadas vs horas programadas"
                                >
                                  {isOperationLoading('calcular-duracion') ? (
                                    <span className="flex items-center gap-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      Calculando...
                                    </span>
                                  ) : (
                                    '🔄 Calcular Duración'
                                  )}
                                </button>
                              )}
                              
                              {/* Buton "Editar Duración" - pentru toate ausencias */}
                              {canAccessAllTabs && (
                                <button
                                  onClick={() => handleOpenEditarDuracionModal(item)}
                                  disabled={isOperationLoading('update-duracion')}
                                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Editar duración manualmente"
                                >
                                  ✏️ Editar Duración
                                </button>
                              )}
                              
                              {/* Buton "Marcar como sin ausencia" - doar pentru "Ausencias justificada" cu durata > 0 */}
                              {((item.tipo || item.TIPO) === 'Ausencias justificada' || (item.tipo || item.TIPO) === 'Ausencia Justificada') && (() => {
                                const duracion = item.DURACION || item.duracion;
                                // unidad și duracionNum nu sunt folosite în acest context
                                // const unidad = item.UNIDAD_DURACION || item.unidad_duracion;
                                const duracionNum = typeof duracion === 'number' ? duracion : parseFloat(duracion);
                                const tieneDuracion = !isNaN(duracionNum) && duracionNum > 0;
                                return tieneDuracion ? (
                                  <button
                                    onClick={() => handleMarcarSinAusencia(item.id || item.ID)}
                                    disabled={isOperationLoading('marcar-sin-ausencia')}
                                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Marcar como sin ausencia (no ha faltado al trabajo)"
                                  >
                                    {isOperationLoading('marcar-sin-ausencia') ? (
                                      <span className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Marcando...
                                      </span>
                                    ) : (
                                      '✅ No ha faltado'
                                    )}
                                  </button>
                                ) : null;
                              })()}
                              
                              {ausenciaAsociada ? (
                                <button
                                  onClick={() => handleAsociarAusencia(item.id || item.ID, null)}
                                  disabled={isOperationLoading('asociar-ausencia')}
                                  className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg font-semibold hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isOperationLoading('asociar-ausencia') ? (
                                    <span className="flex items-center gap-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      Desasociando...
                                    </span>
                                  ) : (
                                    '🔓 Desasociar'
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setAsociarAusenciaModal({ isOpen: true, ausencia: item })}
                                  disabled={isOperationLoading('asociar-ausencia')}
                                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  🔗 Asociar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Buton pentru convertir - pentru "Ausencias justificada" și "Ausencia Injustificada" */}
                      {selectedTab === 'ausencias' && ((item.tipo || item.TIPO) === 'Ausencias justificada' || (item.tipo || item.TIPO) === 'Ausencia Injustificada') && (
                        <div className="mt-4 flex justify-end items-center gap-3">
                          <button
                            onClick={() => setConvertirConfirm({ isOpen: true, ausencia: item })}
                            className={`group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                              (item.tipo || item.TIPO) === 'Ausencias justificada'
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                                : 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                            }`}
                          >
                            <div className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300 ${
                              (item.tipo || item.TIPO) === 'Ausencias justificada'
                                ? 'bg-red-400'
                                : 'bg-green-400'
                            }`}></div>
                            <div className="relative flex items-center gap-2">
                              <span className="text-sm">{(item.tipo || item.TIPO) === 'Ausencias justificada' ? '⚠️' : '✅'}</span>
                              <span className="text-sm">
                                {(item.tipo || item.TIPO) === 'Ausencias justificada'
                                  ? 'Convertir en ausencia injustificada'
                                  : 'Convertir en ausencia justificada'}
                              </span>
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Buton pentru solicitare justificante - doar pentru tipuri care NU sunt Vacaciones sau Asunto Propio */}
                      {selectedTab === 'ausencias' && (() => {
                        const tipoNormalized = (item.tipo || item.TIPO || '').toLowerCase();
                        const isVacaciones = tipoNormalized.includes('vacacion');
                        const isAsuntoPropio = tipoNormalized.includes('asunto') && tipoNormalized.includes('propio');
                        
                        if (!isVacaciones && !isAsuntoPropio) {
                          // Verifică dacă ausencia este asociată cu alta care are justificante
                          const ausenciaAsociadaId = item.ausencia_asociada_id;
                          const ausenciaAsociada = ausenciaAsociadaId 
                            ? allAusencias.find(a => (a.id || a.ID) === ausenciaAsociadaId)
                            : null;
                          
                          // Verifică dacă ausencia asociată are justificante
                          let ausenciaAsociadaTieneJustificantes = false;
                          if (ausenciaAsociada) {
                            const codigoAsociada = ausenciaAsociada.CODIGO || ausenciaAsociada.codigo || '';
                            const tipoAsociada = ausenciaAsociada.tipo || ausenciaAsociada.TIPO || '';
                            const fechaAsociada = ausenciaAsociada.FECHA || ausenciaAsociada.fecha || ausenciaAsociada.fecha_inicio || '';
                            
                            // Normalizează data pentru ausencia asociată
                            let fechaAsociadaNormalizada = '';
                            if (fechaAsociada) {
                              try {
                                if (typeof fechaAsociada === 'string' && fechaAsociada.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                                  const fechaParts = fechaAsociada.trim().split('/');
                                  if (fechaParts.length === 3) {
                                    fechaAsociadaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                                  }
                                } else if (typeof fechaAsociada === 'string' && fechaAsociada.match(/^\d{4}-\d{2}-\d{2}/)) {
                                  fechaAsociadaNormalizada = fechaAsociada.substring(0, 10);
                                } else {
                                  const fecha = new Date(fechaAsociada);
                                  if (!isNaN(fecha.getTime())) {
                                    fechaAsociadaNormalizada = fecha.toISOString().split('T')[0];
                                  }
                                }
                              } catch (e) {
                                console.warn('Error normalizando fecha asociada:', fechaAsociada, e);
                              }
                            }
                            
                            // Verifică dacă ausencia asociată are justificante
                            if (codigoAsociada && tipoAsociada && fechaAsociadaNormalizada) {
                              const keyAsociada = `${codigoAsociada}_${tipoAsociada}_${fechaAsociadaNormalizada}`;
                              const keyAsociadaSinEspacios = `${codigoAsociada}_${tipoAsociada.replace(/\s+/g, '')}_${fechaAsociadaNormalizada}`;
                              const justificanteAsociada = documentosSolicitadosMap.get(keyAsociada) || documentosSolicitadosMap.get(keyAsociadaSinEspacios);
                              
                              if (justificanteAsociada) {
                                ausenciaAsociadaTieneJustificantes = true;
                              }
                            }
                          }
                          
                          // Verificăm dacă există deja o cerere de justificante pentru această ausencia
                          const codigo = item.CODIGO || item.codigo || '';
                          const tipoAusencia = item.tipo || item.TIPO || '';
                          const fechaAusencia = item.FECHA || item.fecha || item.fecha_inicio || item['fecha inicio'] || '';
                          
                          // Normalizează data pentru matching (format YYYY-MM-DD)
                          let fechaNormalizada = '';
                          if (fechaAusencia) {
                            try {
                              // Dacă este format "DD/MM/YYYY" sau "D/M/YYYY"
                              if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                                const fechaParts = fechaAusencia.trim().split('/');
                                if (fechaParts.length === 3) {
                                  fechaNormalizada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
                                }
                              } else if (typeof fechaAusencia === 'string' && fechaAusencia.match(/^\d{4}-\d{2}-\d{2}/)) {
                                fechaNormalizada = fechaAusencia.substring(0, 10);
                              } else {
                                const fecha = new Date(fechaAusencia);
                                if (!isNaN(fecha.getTime())) {
                                  fechaNormalizada = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
                                }
                              }
                            } catch (e) {
                              console.warn('Error normalizando fecha para matching:', fechaAusencia, e);
                            }
                          }
                          
                          let justificanteStatus = null;
                          
                          if (codigo && tipoAusencia && fechaNormalizada) {
                            // Căutăm cu key-ul complet: codigo_tipoAusencia_fecha
                            const key = `${codigo}_${tipoAusencia}_${fechaNormalizada}`;
                            const keySinEspacios = `${codigo}_${tipoAusencia.replace(/\s+/g, '')}_${fechaNormalizada}`;
                            
                            justificanteStatus = documentosSolicitadosMap.get(key) || documentosSolicitadosMap.get(keySinEspacios);
                            
                            // VERIFICARE SUPLIMENTARĂ: Dacă justificantele au data diferită de absență, nu le asociem
                            if (justificanteStatus && justificanteStatus.fechaAusencia && fechaNormalizada && 
                                justificanteStatus.fechaAusencia !== fechaNormalizada) {
                              justificanteStatus = null; // Nu asociem justificantele cu data diferită
                            }
                            
                            // VERIFICARE SUPLIMENTARĂ: Dacă tipul absenței nu se potrivește, nu le asociem
                            if (justificanteStatus && justificanteStatus.tipoAusencia && tipoAusencia && 
                                justificanteStatus.tipoAusencia.toLowerCase().trim() !== tipoAusencia.toLowerCase().trim()) {
                              justificanteStatus = null; // Nu asociem justificantele cu tipul diferit
                            }
                          } else if (codigo) {
                            // Fallback: dacă nu avem tipul sau data, căutăm doar pe codigo_tipo (pentru compatibilitate cu justificante vechi)
                            // NOTĂ: Acest fallback este folosit doar pentru justificante vechi care nu au tipul și data în notas
                            const tiposJustificante = ['Justificante', 'Justificante Médico', 'Justificante de Ausencia', 'Certificado Médico'];
                            for (const tipoJust of tiposJustificante) {
                              const key = `${codigo}_${tipoJust}`;
                              const docSolicitado = documentosSolicitadosMap.get(key);
                              if (docSolicitado) {
                                // Verificăm dacă justificantele vechi nu au fechaAusencia (sunt justificante vechi)
                                if (!docSolicitado.fechaAusencia) {
                                  justificanteStatus = docSolicitado;
                                  break;
                                }
                              }
                            }
                          }

                          return (
                            <div className="mt-4 flex justify-end items-center gap-3">
                              {justificanteStatus ? (
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${
                                    justificanteStatus.estado === 'completado' 
                                      ? 'bg-green-100 text-green-800 border border-green-300' 
                                      : justificanteStatus.estado === 'pendiente'
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                      : 'bg-gray-100 text-gray-800 border border-gray-300'
                                  }`}>
                                    {justificanteStatus.estado === 'completado' ? '✅ Completado' : 
                                     justificanteStatus.estado === 'pendiente' ? '⏳ Pendiente' : 
                                     '📄 ' + justificanteStatus.estado}
                                  </span>
                                  {justificanteStatus.fecha_solicitud && (
                                    <span className="text-xs text-gray-500">
                                      Solicitado: {formatDate(justificanteStatus.fecha_solicitud)}
                                    </span>
                                  )}
                                  {justificanteStatus.fecha_completado && (
                                    <span className="text-xs text-green-600">
                                      Completado: {formatDate(justificanteStatus.fecha_completado)}
                                    </span>
                                  )}
                                </div>
                              ) : ausenciaAsociadaTieneJustificantes ? (
                                // Dacă ausencia asociată are justificante, nu mai cerem justificante pentru această ausencia
                                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                  <span className="text-green-600">✅</span>
                                  <span className="text-sm text-green-700 font-medium">
                                    Justificantes gestionados a través de la ausencia asociada ({ausenciaAsociada?.TIPO || ausenciaAsociada?.tipo} #{ausenciaAsociada?.id || ausenciaAsociada?.ID})
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleRecordarJustificante(item)}
                                    disabled={isOperationLoading('recordar-justificante')}
                                    className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <div className="absolute inset-0 rounded-lg bg-orange-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                                    <div className="relative flex items-center gap-2">
                                      {isOperationLoading('recordar-justificante') ? (
                                        <>
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                          <span className="text-sm">Enviando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-sm">📋</span>
                                          <span className="text-sm">Recordar Justificante</span>
                                        </>
                                      )}
                                    </div>
                                  </button>
                                  {/* Buton "No Necesita Justificante" doar pentru Permiso Retribuido și manageri */}
                                  {((item.tipo || item.TIPO) === 'Permiso Retribuido' && isManager) && (() => {
                                    const noNecesitaJustificante = item.no_necesita_justificante === true || 
                                                                    item.no_necesita_justificante === 1 || 
                                                                    item.no_necesita_justificante === 'true' ||
                                                                    item.NO_NECESITA_JUSTIFICANTE === true ||
                                                                    item.NO_NECESITA_JUSTIFICANTE === 1 ||
                                                                    item.NO_NECESITA_JUSTIFICANTE === 'true';
                                    return (
                                      <button
                                        onClick={() => handleToggleNoNecesitaJustificante(item.id || item.ID, noNecesitaJustificante)}
                                        disabled={isOperationLoading('no-necesita-justificante')}
                                        className={`px-3 py-2 text-xs rounded-lg font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                          noNecesitaJustificante
                                            ? 'bg-green-100 hover:bg-green-200 text-green-700 border-green-300'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300'
                                        }`}
                                        title={noNecesitaJustificante ? "Desmarcar 'No necesita justificante'" : "Marcar como 'No necesita justificante'"}
                                      >
                                        {noNecesitaJustificante ? '✅ No Necesita Justificante' : 'No Necesita Justificante'}
                                      </button>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {selectedTab === 'baja' && (
                        <div className="bg-rose-50 p-4 rounded-lg border border-rose-200 mb-4">
                          <span className="block text-xs font-medium text-rose-700 mb-1">Información adicional</span>
                          <div className="text-sm text-rose-900 space-y-1">
                            <div>
                              Último parte de confirmación:{' '}
                              <span className="font-semibold">
                                {item.ultimoParteConfirmacion ? formatDate(item.ultimoParteConfirmacion) : 'No registrado'}
                              </span>
                            </div>
                            <div>
                              Fuente:{' '}
                              <span className="font-semibold">{item.fuente || 'No especificada'}</span>
                            </div>
                            <div>
                              Última actualización:{' '}
                              <span className="font-semibold">{formatDateTime(item.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedTab !== 'ausencias' && selectedTab !== 'baja' && (item.motivo || item.MOTIVO) && !((item.tipo || item.TIPO || '').toLowerCase().includes('ausencias') && (item.tipo || item.TIPO || '').toLowerCase().includes('justificada')) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                          <span className="block text-xs font-medium text-blue-700 mb-1">Motivo</span>
                          <p className="text-sm text-blue-800">{item.motivo || item.MOTIVO}</p>
                        </div>
                      )}
                    </div>
                  );
                  })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'estadisticas' ? (
          // Tab Estadísticas - Vacaciones y Asuntos Propios
          <div>
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} ${isMobile ? 'mb-3' : 'mb-6'}`}>
              <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>
                Estadísticas de Solicitudes
              </h2>
              <button
                onClick={async () => {
                  setEstadisticasLoading(true);
                  try {
                    const response = await callApi(routes.getVacacionesEstadisticas, {
                      method: 'GET',
                    });
                    // useApi wrappează răspunsul în {success: true, data: {...}}
                    if (response?.success && response?.data?.success && response?.data?.estadisticas) {
                      setEstadisticas(response.data.estadisticas);
                    }
                  } catch (error) {
                    console.error('Error cargando estadísticas:', error);
                    alert('Error al cargar estadísticas. Por favor, inténtalo de nuevo.');
                  } finally {
                    setEstadisticasLoading(false);
                  }
                }}
                disabled={estadisticasLoading}
                className={`${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2'} bg-purple-600 hover:bg-purple-700 text-white ${isMobile ? 'rounded-lg' : 'rounded-lg'} font-medium transition-colors disabled:opacity-50 flex items-center gap-2`}
              >
                {estadisticasLoading ? (
                  <>
                    <div className={`${isMobile ? 'w-3 h-3 border-2' : 'w-4 h-4 border-2'} border-white border-t-transparent rounded-full animate-spin`}></div>
                    Cargando...
                  </>
                ) : (
                  <>
                    <RefreshCw className={isMobile ? 'w-3 h-3' : 'w-4 h-4'} />
                    Actualizar
                  </>
                )}
              </button>
            </div>

            {estadisticasLoading ? (
              <div className={`flex justify-center ${isMobile ? 'py-6' : 'py-12'}`}>
                <LoadingSpinner size={isMobile ? 'md' : 'lg'} text="Cargando estadísticas..." />
              </div>
            ) : estadisticas.length === 0 ? (
              <div className={`text-center ${isMobile ? 'py-6 px-3' : 'py-12'} bg-gray-50 ${isMobile ? 'rounded-lg' : 'rounded-xl'}`}>
                <p className={`${isMobile ? 'text-sm mb-3' : 'text-gray-600 mb-4'}`}>No hay estadísticas disponibles</p>
                <button
                  onClick={async () => {
                    setEstadisticasLoading(true);
                    try {
                      const response = await callApi(routes.getVacacionesEstadisticas, {
                        method: 'GET',
                      });
                      // useApi wrappează răspunsul în {success: true, data: {...}}
                      if (response?.success && response?.data?.success && response?.data?.estadisticas) {
                        setEstadisticas(response.data.estadisticas);
                      }
                    } catch (error) {
                      console.error('Error cargando estadísticas:', error);
                      alert('Error al cargar estadísticas. Por favor, inténtalo de nuevo.');
                    } finally {
                      setEstadisticasLoading(false);
                    }
                  }}
                  className={`${isMobile ? 'px-4 py-1.5 text-xs' : 'px-6 py-2'} bg-purple-600 hover:bg-purple-700 text-white ${isMobile ? 'rounded-lg' : 'rounded-lg'} font-medium transition-colors`}
                >
                  Cargar Estadísticas
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`min-w-full bg-white border border-gray-200 ${isMobile ? 'rounded-lg' : 'rounded-xl'} overflow-hidden shadow-lg`}>
                  <thead className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                    <tr>
                      <th className={`${isMobile ? 'px-3 py-2 text-[10px]' : 'px-6 py-4 text-sm'} text-left font-bold sticky left-0 bg-purple-600 z-10`}>Empleado</th>
                      <th className={`${isMobile ? 'px-3 py-2 text-[10px]' : 'px-6 py-4 text-sm'} text-left font-bold`}>Código</th>
                      <th className={`${isMobile ? 'px-3 py-2 text-[10px]' : 'px-6 py-4 text-sm'} text-left font-bold`}>Grupo</th>
                      <th className={`${isMobile ? 'px-2 py-2 text-[10px]' : 'px-6 py-4 text-sm'} text-center font-bold border-l-2 border-purple-400`} colSpan={5}>
                        🏖️ Vacaciones
                      </th>
                      <th className={`${isMobile ? 'px-2 py-2 text-[10px]' : 'px-6 py-4 text-sm'} text-center font-bold border-l-2 border-purple-400`} colSpan={3}>
                        📅 Asuntos Propios
                      </th>
                    </tr>
                    <tr className="bg-purple-500/90">
                      <th className={`${isMobile ? 'px-3 py-1 text-[9px]' : 'px-6 py-2 text-xs'} font-medium sticky left-0 bg-purple-500/90 z-10`}></th>
                      <th className={`${isMobile ? 'px-3 py-1 text-[9px]' : 'px-6 py-2 text-xs'} font-medium`}></th>
                      <th className={`${isMobile ? 'px-3 py-1 text-[9px]' : 'px-6 py-2 text-xs'} font-medium`}></th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium border-l-2 border-purple-400`}>Anuales</th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium`}>Generados</th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium`}>Consumidos</th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium`}>Rest. Año Pasado</th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium`}>Restantes</th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium border-l-2 border-purple-400`}>Anuales</th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium`}>Consumidos</th>
                      <th className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-4 py-2 text-xs'} font-medium`}>Restantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {estadisticas.map((emp, idx) => (
                      <tr 
                        key={emp.codigo} 
                        className={`hover:bg-gray-50 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        <td className={`${isMobile ? 'px-3 py-2 text-[10px]' : 'px-6 py-4 text-sm'} font-medium text-gray-900 sticky left-0 bg-inherit z-10 whitespace-nowrap`}>
                          {emp.nombre}
                        </td>
                        <td className={`${isMobile ? 'px-3 py-2 text-[10px]' : 'px-6 py-4 text-sm'} text-gray-700 whitespace-nowrap`}>
                          {emp.codigo}
                        </td>
                        <td className={`${isMobile ? 'px-3 py-2 text-[10px]' : 'px-6 py-4 text-sm'} text-gray-600 whitespace-nowrap`}>
                          {emp.grupo || '-'}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center border-l-2 border-gray-200`}>
                          {editingVacacionesAnuales[emp.codigo] !== undefined ? (
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={editingVacacionesAnuales[emp.codigo]}
                              onChange={(e) => {
                                const value = e.target.value === '' ? null : parseFloat(e.target.value);
                                setEditingVacacionesAnuales({
                                  ...editingVacacionesAnuales,
                                  [emp.codigo]: value,
                                });
                              }}
                              onBlur={async () => {
                                const newValue = editingVacacionesAnuales[emp.codigo];
                                const oldValue = emp.vacaciones.dias_anuales;
                                
                                if (newValue !== oldValue) {
                                  try {
                                    const response = await callApi(
                                      routes.updateVacacionesAnualesPersonalizadas(emp.codigo),
                                      {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                          dias_anuales: newValue,
                                        }),
                                      }
                                    );
                                    
                                    if (response?.success) {
                                      // Recargar estadísticas para obtener valores actualizados
                                      const refreshResponse = await callApi(routes.getVacacionesEstadisticas);
                                      if (refreshResponse?.success && refreshResponse?.data?.success && refreshResponse?.data?.estadisticas) {
                                        setEstadisticas(refreshResponse.data.estadisticas);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error actualizando vacaciones anuales:', error);
                                    alert('Error al actualizar. Por favor, inténtalo de nuevo.');
                                    // Revertir al valor anterior
                                    setEditingVacacionesAnuales({
                                      ...editingVacacionesAnuales,
                                      [emp.codigo]: oldValue,
                                    });
                                  }
                                }
                                
                                // Salir del modo edición
                                const newEditing = { ...editingVacacionesAnuales };
                                delete newEditing[emp.codigo];
                                setEditingVacacionesAnuales(newEditing);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                } else if (e.key === 'Escape') {
                                  // Cancelar edición
                                  const newEditing = { ...editingVacacionesAnuales };
                                  delete newEditing[emp.codigo];
                                  setEditingVacacionesAnuales(newEditing);
                                }
                              }}
                              className={`${isMobile ? 'w-12 text-[10px] px-1 py-0.5 border' : 'w-20 px-2 py-1 border-2'} text-center border-purple-300 ${isMobile ? 'rounded' : 'rounded-lg'} focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                              autoFocus
                              placeholder="NULL"
                            />
                          ) : (
                            <span
                              className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-gray-700 font-medium cursor-pointer hover:text-purple-600 hover:underline`}
                              onClick={() => {
                                setEditingVacacionesAnuales({
                                  ...editingVacacionesAnuales,
                                  [emp.codigo]: emp.vacaciones.dias_anuales,
                                });
                              }}
                              title="Click para editar (NULL = usar convenio)"
                            >
                              {emp.vacaciones.dias_anuales}
                            </span>
                          )}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center text-gray-700`}>
                          {emp.vacaciones.dias_generados_hasta_hoy.toFixed(1)}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center text-gray-700`}>
                          {emp.vacaciones.dias_consumidos_aprobados}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center`}>
                          {editingRestantes[emp.codigo] !== undefined ? (
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={editingRestantes[emp.codigo]}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setEditingRestantes({
                                  ...editingRestantes,
                                  [emp.codigo]: value,
                                });
                              }}
                              onBlur={async () => {
                                const newValue = editingRestantes[emp.codigo];
                                const oldValue = emp.vacaciones.dias_restantes_ano_anterior || 0;
                                
                                if (newValue !== oldValue) {
                                  try {
                                    const response = await callApi(
                                      routes.updateVacacionesRestantesAnoAnterior(emp.codigo),
                                      {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                          restantes_ano_anterior: newValue,
                                        }),
                                      }
                                    );
                                    
                                    if (response?.success) {
                                      // Actualizar estadísticas localmente
                                      setEstadisticas((prev) =>
                                        prev.map((e) =>
                                          e.codigo === emp.codigo
                                            ? {
                                                ...e,
                                                vacaciones: {
                                                  ...e.vacaciones,
                                                  dias_restantes_ano_anterior: newValue,
                                                  dias_restantes: Math.max(
                                                    0,
                                                    e.vacaciones.dias_generados_hasta_hoy +
                                                      newValue -
                                                      e.vacaciones.dias_consumidos_aprobados
                                                  ),
                                                },
                                              }
                                            : e
                                        )
                                      );
                                    }
                                  } catch (error) {
                                    console.error('Error actualizando restantes año anterior:', error);
                                    alert('Error al actualizar. Por favor, inténtalo de nuevo.');
                                    // Revertir al valor anterior
                                    setEditingRestantes({
                                      ...editingRestantes,
                                      [emp.codigo]: oldValue,
                                    });
                                  }
                                }
                                
                                // Salir del modo edición
                                const newEditing = { ...editingRestantes };
                                delete newEditing[emp.codigo];
                                setEditingRestantes(newEditing);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                } else if (e.key === 'Escape') {
                                  // Cancelar edición
                                  const newEditing = { ...editingRestantes };
                                  delete newEditing[emp.codigo];
                                  setEditingRestantes(newEditing);
                                }
                              }}
                              className={`${isMobile ? 'w-12 text-[10px] px-1 py-0.5 border' : 'w-20 px-2 py-1 border-2'} text-center border-purple-300 ${isMobile ? 'rounded' : 'rounded-lg'} focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-gray-600 font-medium cursor-pointer hover:text-purple-600 hover:underline`}
                              onClick={() => {
                                setEditingRestantes({
                                  ...editingRestantes,
                                  [emp.codigo]: emp.vacaciones.dias_restantes_ano_anterior || 0,
                                });
                              }}
                              title="Click para editar"
                            >
                              {(emp.vacaciones.dias_restantes_ano_anterior || 0).toFixed(1)}
                            </span>
                          )}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center font-semibold ${
                          emp.vacaciones.dias_restantes < 5 
                            ? 'text-red-600' 
                            : emp.vacaciones.dias_restantes < 10 
                            ? 'text-orange-600' 
                            : 'text-green-600'
                        }`}>
                          {emp.vacaciones.dias_restantes.toFixed(1)}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center border-l-2 border-gray-200`}>
                          {editingAsuntosPropiosAnuales[emp.codigo] !== undefined ? (
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={editingAsuntosPropiosAnuales[emp.codigo] ?? ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? null : parseFloat(e.target.value);
                                setEditingAsuntosPropiosAnuales({
                                  ...editingAsuntosPropiosAnuales,
                                  [emp.codigo]: value,
                                });
                              }}
                              onBlur={async () => {
                                const newValue = editingAsuntosPropiosAnuales[emp.codigo];
                                const oldValue = emp.asuntos_propios.dias_anuales;
                                
                                if (newValue !== oldValue) {
                                  try {
                                    const response = await callApi(
                                      routes.updateAsuntosPropiosAnualesPersonalizadas(emp.codigo),
                                      {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                          dias_anuales: newValue,
                                        }),
                                      }
                                    );
                                    
                                    if (response?.success) {
                                      // Recargar estadísticas para obtener valores actualizados
                                      const refreshResponse = await callApi(routes.getVacacionesEstadisticas);
                                      if (refreshResponse?.success && refreshResponse?.data?.success && refreshResponse?.data?.estadisticas) {
                                        setEstadisticas(refreshResponse.data.estadisticas);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error actualizando asuntos propios anuales:', error);
                                    alert('Error al actualizar. Por favor, inténtalo de nuevo.');
                                    // Revertir al valor anterior
                                    setEditingAsuntosPropiosAnuales({
                                      ...editingAsuntosPropiosAnuales,
                                      [emp.codigo]: oldValue,
                                    });
                                  }
                                }
                                
                                // Salir del modo edición
                                const newEditing = { ...editingAsuntosPropiosAnuales };
                                delete newEditing[emp.codigo];
                                setEditingAsuntosPropiosAnuales(newEditing);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                } else if (e.key === 'Escape') {
                                  // Cancelar edición
                                  const newEditing = { ...editingAsuntosPropiosAnuales };
                                  delete newEditing[emp.codigo];
                                  setEditingAsuntosPropiosAnuales(newEditing);
                                }
                              }}
                              className={`${isMobile ? 'w-12 text-[10px] px-1 py-0.5 border' : 'w-20 px-2 py-1 border-2'} text-center border-purple-300 ${isMobile ? 'rounded' : 'rounded-lg'} focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                              autoFocus
                              placeholder="NULL"
                            />
                          ) : (
                            <span
                              className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-gray-700 font-medium cursor-pointer hover:text-purple-600 hover:underline`}
                              onClick={() => {
                                setEditingAsuntosPropiosAnuales({
                                  ...editingAsuntosPropiosAnuales,
                                  [emp.codigo]: emp.asuntos_propios.dias_anuales,
                                });
                              }}
                              title="Click para editar (NULL = usar convenio)"
                            >
                              {emp.asuntos_propios.dias_anuales}
                            </span>
                          )}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center text-gray-700`}>
                          {emp.asuntos_propios.dias_consumidos_aprobados}
                        </td>
                        <td className={`${isMobile ? 'px-1.5 py-2 text-[10px]' : 'px-4 py-4 text-sm'} text-center font-semibold ${
                          emp.asuntos_propios.dias_restantes < 2 
                            ? 'text-red-600' 
                            : emp.asuntos_propios.dias_restantes < 4 
                            ? 'text-orange-600' 
                            : 'text-green-600'
                        }`}>
                          {emp.asuntos_propios.dias_restantes.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Butoane de export */}
                <div className={`${isMobile ? 'mt-2' : 'mt-4'} flex ${isMobile ? 'flex-col gap-2' : 'gap-3'} ${isMobile ? '' : 'justify-end'}`}>
                  <button
                    onClick={handleExportEstadisticasExcel}
                    disabled={estadisticasLoading || estadisticas.length === 0}
                    className={`${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2'} bg-green-600 text-white ${isMobile ? 'rounded-lg' : 'rounded-lg'} hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                  >
                    <span className={isMobile ? 'text-sm' : ''}>📊</span>
                    <span>Exportar Excel</span>
                  </button>
                  <button
                    onClick={handleExportEstadisticasPDF}
                    disabled={estadisticasLoading || estadisticas.length === 0}
                    className={`${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2'} bg-red-600 text-white ${isMobile ? 'rounded-lg' : 'rounded-lg'} hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                  >
                    <span className={isMobile ? 'text-sm' : ''}>📄</span>
                    <span>Exportar PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Formulario para nueva solicitud - SUPER WOW 3D MODERNIZADO ✨
          <div className="max-w-3xl mx-auto">
            {/* Header ULTRA WOW con efectos 3D */}
            <div className="relative mb-10">
              {/* Glow background animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 opacity-20 blur-3xl animate-pulse"></div>
              
              {/* Buton Volver - doar când se editează */}
              {editingSolicitud && (
                <div className="relative mb-4">
                  <button
                    onClick={() => {
                      setEditingSolicitud(null);
                      setOriginalSolicitudData(null);
                      setTipo('Asuntos Propios');
                      setFechaInicio('');
                      setFechaFin('');
                      setMotivo('');
                      setTipoJustificante('');
                      setHoraCita('');
                      setCentroMedico('');
                      setDescripcionOtro('');
                      setArchivoJustificante(null);
                      // Revine la tab-ul corespunzător
                      if (isManager) {
                        setActiveTab('todas');
                      } else {
                        setActiveTab('lista');
                      }
                    }}
                    className="group flex items-center gap-2 text-gray-700 hover:text-red-600 transition-colors duration-300"
                  >
                    <svg className="w-5 h-5 text-red-600 group-hover:text-red-700 transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H6" />
                      <path d="M12 19l-7-7 7-7" />
                    </svg>
                    <span className="font-semibold">Volver a Solicitudes</span>
                  </button>
                </div>
              )}
              
              <div className="relative text-center">
                {/* Icono 3D flotante con sombra y animaciones */}
                <div className="relative inline-block mb-6">
                  {/* Círculo exterior con gradiente y blur */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-pink-500 rounded-full blur-lg opacity-60 animate-pulse"></div>
                  
                  {/* Círculo principal 3D */}
                  <div 
                    className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 hover:rotate-12 transition-all duration-500"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
                      boxShadow: '0 20px 40px rgba(239, 68, 68, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    <span className="text-4xl animate-bounce">📝</span>
                  </div>
                </div>

                {/* Título animado con gradiente */}
                <h2 
                  className="text-3xl sm:text-4xl font-black mb-3 bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent animate-pulse"
                  style={{
                    textShadow: '0 2px 20px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {editingSolicitud ? 'Editar Solicitud' : 'Nueva Solicitud'}
                </h2>
                <p className="text-gray-600 text-base sm:text-lg font-medium">
                  {editingSolicitud ? 'Modifica los datos de la solicitud' : 'Completa el formulario para enviar tu solicitud'}
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Tipo de solicitud - SUPER WOW 3D */}
              <div 
                className="relative group p-4 sm:p-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '1rem',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  boxShadow: '0 10px 30px rgba(168, 85, 247, 0.15)'
                }}
              >
                {/* Glow animado en hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-purple-600 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duración-500"></div>
                
                {/* Header con icono 3D */}
                <div className="relative flex items-start sm:items-center justify-between flex-wrap gap-3 sm:gap-6 mb-6">
                  <div className="flex items-center">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                      style={{
                          background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                          boxShadow: '0 8px 20px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      <span className="text-2xl">📋</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Tipo de Solicitud
                    </h3>
                  </div>

                  {/* Select modernizado */}
                  <select
                    id="solicitud-tipo"
                    name="solicitud-tipo"
                    value={tipo}
                    onChange={(e) => {
                      const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
                      const allowedGroups = ['Limpiador', 'Developer', 'Auxiliar De Servicios - L'];
                      
                      // Prevent selection of Asuntos Propios for non-allowed groups
                      if (e.target.value === 'Asuntos Propios') {
                        if (!allowedGroups.includes(currentUserGroup)) {
                          alert('Asuntos Propios solo está disponible para usuarios de Limpiador, Developer y Auxiliar De Servicios - L.');
                          return;
                        }
                        // Verifică dacă utilizatorul are drepturi reale în baza de date
                        if ((asuntosPropiosSaldo.dias_anuales || 0) <= 0) {
                          alert('No tienes derechos de Asuntos Propios asignados. Contacta con tu administrador.');
                          return;
                        }
                      }
                      
                      // Prevent selection of Vacaciones if user has no rights
                      if (e.target.value === 'Vacaciones') {
                        const hasVacacionesRights = (vacacionesSaldo.dias_restantes || 0) > 0 || (vacacionesSaldo.dias_anuales || 0) > 0;
                        if (!hasVacacionesRights) {
                          alert('No tienes días de vacaciones disponibles. Contacta con tu administrador.');
                          return;
                        }
                      }
                      
                      setTipo(e.target.value);
                      setFechaInicio('');
                      setFechaFin('');
                      if (e.target.value !== 'Ausencias justificada') {
                        setTipoJustificante('');
                        setHoraCita('');
                        setCentroMedico('');
                        setDescripcionOtro('');
                        setArchivoJustificante(null);
                      }
                    }}
                    disabled={editingSolicitud !== null}
                    className="relative w-full px-4 py-4 text-base font-semibold rounded-xl border-2 transition-all duration-300 shadow-md hover:shadow-xl focus:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: editingSolicitud !== null 
                        ? 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                        : 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                      borderColor: editingSolicitud !== null ? '#d1d5db' : '#e9d5ff',
                      color: editingSolicitud !== null ? '#6b7280' : '#6b21a8',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      if (editingSolicitud === null) {
                        e.target.style.borderColor = '#a855f7';
                        e.target.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.2)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = editingSolicitud !== null ? '#d1d5db' : '#e9d5ff';
                      e.target.style.boxShadow = '';
                    }}
                  >
                    {(() => {
                      const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
                      const allowedGroups = ['Limpiador', 'Developer', 'Auxiliar De Servicios - L'];
                      const isGroupAllowed = allowedGroups.includes(currentUserGroup);
                      // Verifică dacă utilizatorul are drepturi reale în baza de date
                      const hasAsuntosPropiosRights = (asuntosPropiosSaldo.dias_anuales || 0) > 0;
                      const isDisabled = !isGroupAllowed || !hasAsuntosPropiosRights || totalAsuntoPropioDays >= 6;
                      
                      return (
                    <option 
                      value="Asuntos Propios" 
                          disabled={isDisabled}
                      style={{ 
                            color: isDisabled ? '#9ca3af' : '#6b21a8',
                            backgroundColor: isDisabled ? '#f3f4f6' : 'transparent'
                      }}
                    >
                      📅 Asuntos Propios {
                        !hasAsuntosPropiosRights ? '(Sin derechos)' :
                        totalAsuntoPropioDays >= 6 ? '(Límite alcanzado - 6/6 días)' : ''
                      }
                    </option>
                      );
                    })()}
                    {(() => {
                      // Verifică dacă utilizatorul are zile disponibile (dias_restantes > 0 sau are zile anuale)
                      const hasVacacionesRights = (vacacionesSaldo.dias_restantes || 0) > 0 || (vacacionesSaldo.dias_anuales || 0) > 0;
                      const maxVacaciones = (vacacionesSaldo.dias_anuales || 31) + (vacacionesSaldo.dias_restantes_ano_anterior || 0);
                      const isDisabled = !hasVacacionesRights || totalVacacionesDays >= maxVacaciones;
                      
                      return (
                        <option 
                          value="Vacaciones"
                          disabled={isDisabled}
                          style={{ 
                            color: isDisabled ? '#9ca3af' : '#0891b2',
                            backgroundColor: isDisabled ? '#f3f4f6' : 'transparent'
                          }}
                        >
                          🏖️ Vacaciones {
                            !hasVacacionesRights ? '(Sin derechos)' :
                            totalVacacionesDays >= maxVacaciones ? '(Límite alcanzado)' : ''
                          }
                        </option>
                      );
                    })()}
                    <option 
                      value="BAJA_VOLUNTARIA"
                      style={{ 
                        color: '#dc2626',
                        backgroundColor: 'transparent'
                      }}
                    >
                      🚪 Baja Voluntaria
                    </option>
                    <option 
                      value="Permiso Retribuido"
                      style={{ 
                        color: '#059669',
                        backgroundColor: 'transparent'
                      }}
                    >
                      💼 Permiso Retribuido
                    </option>
                    <option 
                      value="Ausencias justificada"
                      style={{ 
                        color: '#0891b2',
                        backgroundColor: 'transparent'
                      }}
                    >
                      🩺 Ausencias justificada
                    </option>
                  </select>
                </div>

                {/* Aviso sobre vacaciones - solo para Vacaciones */}
                {tipo === 'Vacaciones' && (
                  <div 
                    className="relative mt-4 p-4 rounded-lg border-l-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
                      borderColor: '#f59e0b',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-900 mb-2">
                          Información importante sobre vacaciones
                        </h4>
                        <div className="text-xs sm:text-sm text-amber-800 space-y-1.5 leading-relaxed">
                          <p>
                            Las vacaciones deberán solicitarse e iniciarse exclusivamente en días laborables según el turno de trabajo asignado.
                          </p>
                          <p>
                            No podrán iniciarse en días de descanso semanal ni días no laborables.
                          </p>
                          <p className="font-medium mt-2">
                            Las solicitudes de vacaciones deberán presentarse con un mínimo de dos meses de antelación.
                          </p>
                          <p>
                            En caso contrario, la empresa podrá ajustar las fechas solicitadas en función de las necesidades organizativas, adecuando el inicio al primer día laborable disponible.
                          </p>
                          <p>
                            Dicha adaptación no supondrá en ningún caso la reducción del número total de días de vacaciones del trabajador.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Período Solicitado - Calendar for Vacaciones or Asuntos Propios */}
                {tipo === 'Vacaciones' && (
                  <>
                    {/* Recomandare pentru mobil să rotească telefonul */}
                    {isMobile && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📱</span>
                          <p className="text-sm font-medium text-blue-800">
                            💡 Recomendación: Rota tu teléfono a horizontal para una mejor experiencia con el calendario
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Calendar for Vacaciones */}
                  <div 
                    className="relative group p-4 sm:p-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      boxShadow: '0 10px 30px rgba(59, 130, 246, 0.15)'
                    }}
                  >
                    {/* Glow animado en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                    
                    {/* Header con icono 3D */}
                    <div className="relative flex items-start sm:items-center justify-between flex-wrap gap-3 sm:gap-6 mb-6">
                      <div className="flex items-center">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <span className="text-2xl">📅</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Selecciona tus Vacaciones
                        </h3>
                      </div>
                      
                      {/* Month Navigation */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => navigateMonth('prev')}
                          className="w-10 h-10 bg-white border border-blue-300 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronLeft className="w-5 h-5 text-blue-600" />
                        </button>
                        
                        <div className="bg-white border border-blue-300 rounded-lg px-4 py-2 shadow-sm min-w-[140px] text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {monthNames[calendarMonth]} {calendarYear}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => navigateMonth('next')}
                          className="w-10 h-10 bg-white border border-blue-300 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronRight className="w-5 h-5 text-blue-600" />
                        </button>
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="bg-white rounded-xl border border-blue-200 shadow-lg sm:overflow-hidden">
                      <div className="overflow-x-auto sm:overflow-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="w-full min-w-[280px] sm:min-w-[420px]">
                          {/* Days of week header */}
                          <div className="grid grid-cols-7 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                              <div key={day} className="p-2 sm:p-3 text-center text-[11px] sm:text-sm font-bold text-blue-700 border-r border-blue-200 last:border-r-0">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Calendar days */}
                          <div className="grid grid-cols-7">
                            {/* Empty cells for days before month starts */}
                            {Array.from({ length: getFirstDayOfMonth(calendarYear, calendarMonth) }).map((_, index) => (
                              <div key={`empty-${index}`} className="h-12 border-r border-b border-gray-100 last:border-r-0"></div>
                            ))}
                            
                            {/* Days of the month */}
                            {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }, (_, i) => i + 1).map(day => {
                              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const today = new Date();
                              const currentDate = new Date(dateStr);
                              const isToday = currentDate.toDateString() === today.toDateString();
                              const isPast = editingSolicitud === null && currentDate < today;
                              // Ignorăm perioada de blocare când se editează o solicitare
                              const isEditingVacacionesOrAsuntoPropio = editingSolicitud !== null && 
                                (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios');
                              const isBlocked = isEditingVacacionesOrAsuntoPropio ? false : isInHolidayBlockPeriod(dateStr);
                              const availability = dateAvailability[dateStr];
                              const isFull = availability && availability.isFull;
                              const isLowAvailability = availability && availability.available <= 1 && availability.available > 0;
                              // For Vacaciones and Asuntos Propios, we don't use isDateOccupied anymore - we use availability logic instead
                              const isOccupied = (tipo !== 'Vacaciones' && !isTipoAsuntoPropio(tipo)) ? isDateOccupied(day) : false;
                              
                              return (
                              <button
                                key={day}
                                  onClick={() => !isDateDisabled(day) && toggleDate(day)}
                                  disabled={isDateDisabled(day)}
                                  className={`h-10 sm:h-12 border-r border-b border-gray-100 last:border-r-0 transition-all duration-200 relative ${
                                  isDateSelected(day)
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-lg'
                                      : isBlocked
                                      ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800 cursor-not-allowed'
                                      : isFull
                                      ? 'bg-gradient-to-br from-purple-200 to-purple-300 text-purple-800 cursor-not-allowed'
                                      : isOccupied
                                      ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-700 cursor-not-allowed'
                                      : isLowAvailability
                                      ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 hover:bg-yellow-300'
                                      : isToday
                                      ? 'bg-gradient-to-br from-green-100 to-green-200 text-green-800 font-semibold hover:bg-green-300'
                                      : isPast
                                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                  title={
                                    isBlocked
                                      ? 'Período bloqueado: 6 Dic - 6 Ene (Empleada)'
                                      : isFull
                                      ? `Sin disponibilidad (${availability?.occupied}/${availability?.total} ocupados)`
                                      : isOccupied
                                      ? 'Fecha ocupada por otra solicitud' 
                                      : isLowAvailability
                                      ? `Poca disponibilidad: ${availability?.available}/${availability?.total} libres`
                                      : availability && availability.available > 0
                                      ? `Disponibilidad: ${availability?.available}/${availability?.total} libres`
                                      : isPast 
                                      ? 'No se pueden seleccionar fechas pasadas' 
                                      : isToday 
                                      ? 'Hoy' 
                                      : ''
                                  }
                              >
                                <span className="text-xs sm:text-sm">{day}</span>
                                  {isBlocked && (
                                    <span className="absolute top-1 right-1 text-xs">🔒</span>
                                  )}
                                  {isFull && !isBlocked && (
                                    <span className="absolute top-1 right-1 text-xs">🈵</span>
                                  )}
                                  {isLowAvailability && !isBlocked && !isFull && (
                                    <span className="absolute top-1 right-1 text-xs">⚠️</span>
                                  )}
                                  {isOccupied && !isBlocked && !isFull && (
                                    <span className="absolute top-1 right-1 text-xs">🚫</span>
                                  )}
                                  {availability && !isOccupied && !isBlocked && (
                                    <span className="absolute bottom-1 right-1 text-xs font-bold" style={{ fontSize: '9px' }}>
                                      {availability.available}/{availability.total}
                                    </span>
                                  )}
                              </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Loading indicator */}
                    {isOperationLoading('occupiedDates') && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 flex items-center">
                          <span className="animate-spin mr-2">⏳</span>
                          Cargando fechas ocupadas...
                        </p>
                      </div>
                    )}
                    
                    {/* Availability info for Vacaciones and Asuntos Propios - Only for managers */}
                    {editingSolicitud === null && isManager && !isOperationLoading('occupiedDates') && (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios') && Object.keys(dateAvailability).length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-blue-800 mb-2">
                              📊 Disponibilidad del Grupo
                            </p>
                            {(() => {
                              const firstDate = Object.keys(dateAvailability)[0];
                              const firstAvailability = dateAvailability[firstDate];
                              return (
                                <div className="text-xs text-blue-600 space-y-1">
                                  <p><strong>Grupo:</strong> {firstAvailability.group || 'N/A'}</p>
                                  <p><strong>Centro:</strong> {firstAvailability.center || 'No definido'}</p>
                                  <p><strong>Límite por fecha:</strong> {firstAvailability.total} personas</p>
                                </div>
                              );
                            })()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-800 mb-2">
                              📅 Resumen del Grupo
                            </p>
                            {(() => {
                              const firstDate = Object.keys(dateAvailability)[0];
                              const firstAvailability = dateAvailability[firstDate];
                              
                              // Calculate totals from allUsers if available, otherwise use fallback
                              const currentUserCenter = firstAvailability.center || '';
                              const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
                              const normalizedCurrentUserGroup = normalizeGroup(currentUserGroup);
                              
                              let totalInGroup = 0;
                              let totalInCenter = 0;
                              
                              if (allUsers && allUsers.length > 0) {
                                // Calculate totals from allUsers
                                totalInGroup = allUsers.filter(user => {
                                  const userGroup = user['GRUPO'] || user.grupo || '';
                                  const normalizedUserGroup = normalizeGroup(userGroup);
                                  return normalizedUserGroup === normalizedCurrentUserGroup;
                                }).length;
                              
                              // Helper function to get center from user (same logic as in calculateDateAvailability)
                              const getUserCenter = (user) => {
                                if (!user) return '';
                                // First, check the exact key used in DatosPage
                                if (user['CENTRO TRABAJO'] && String(user['CENTRO TRABAJO']).trim()) {
                                  return String(user['CENTRO TRABAJO']).trim();
                                }
                                const preferredKeys = [
                                  'CENTRO DE TRABAJO',
                                  'centro de trabajo',
                                  'CENTRO_DE_TRABAJO',
                                  'centroDeTrabajo',
                                  'centro_trabajo',
                                  'CENTRO',
                                  'centro',
                                  'CENTER',
                                  'center',
                                  'DEPARTAMENTO',
                                  'departamento'
                                ];
                                for (const k of preferredKeys) {
                                  if (user[k] && String(user[k]).trim()) {
                                    return String(user[k]).trim();
                                  }
                                }
                                // Heurística: primer campo cuyo nombre contiene 'centro' o 'trabajo'
                                try {
                                  const allKeys = Object.keys(user || {});
                                  const key = allKeys.find(key => {
                                    const lk = key.toLowerCase();
                                    return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(user[key]).trim();
                                  });
                                  if (key) {
                                    return String(user[key]).trim();
                                  }
                                } catch (e) {
                                  console.warn('Error in getUserCenter heuristics:', e);
                                }
                                return '';
                              };
                              
                                totalInCenter = allUsers.filter(user => {
                                const userCenter = getUserCenter(user);
                                return userCenter && currentUserCenter && userCenter === currentUserCenter;
                              }).length;
                              } else {
                                // Fallback: use maxAllowed to estimate group size if allUsers is not loaded
                                // maxAllowed is calculated as percentage of groupSize, so we can reverse it
                                // For Vacaciones: maxAllowed = Math.ceil(groupSize * percentage), so groupSize ≈ maxAllowed / percentage
                                const percentage = vacacionesDisponibilidadPct / 100;
                                const estimatedGroupSize = Math.ceil(firstAvailability.maxAllowed / percentage);
                                totalInGroup = estimatedGroupSize;
                                totalInCenter = 'N/A'; // Can't calculate without allUsers
                              }
                              
                              return (
                                <div className="text-xs text-blue-600 space-y-1">
                                  <p><strong>Total empleados en centro:</strong> {totalInCenter !== 'N/A' ? totalInCenter : 'Calculando...'}</p>
                                  <p><strong>Total empleados en grupo:</strong> {totalInGroup}</p>
                                  <p><strong>Límite per grup:</strong> {firstAvailability.total} personas</p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </>
                )}
                
                {/* Elemente comune pentru Vacaciones și Asuntos Propios */}
                {(tipo === 'Vacaciones' || tipo === 'Asuntos Propios') && (
                  <>
                    {!isOperationLoading('occupiedDates') && tipo !== 'Vacaciones' && occupiedDates.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800">
                          🚫 {occupiedDates.length} días ocupados este mes
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Las fechas en rojo están ocupadas por otras solicitudes
                        </p>
                      </div>
                    )}

                    {/* Calendar Legend */}
                    {editingSolicitud === null && (
                    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-bold text-gray-800 mb-2">Leyenda del Calendario:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded"></div>
                          <span className="text-gray-700">Días seleccionados</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-green-100 to-green-200 rounded"></div>
                          <span className="text-gray-700">Hoy</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-purple-200 to-purple-300 rounded"></div>
                          <span className="text-gray-700">Sin disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded"></div>
                          <span className="text-gray-700">Poca disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-red-100 to-red-200 rounded"></div>
                          <span className="text-gray-700">Ocupado por otras solicitudes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-orange-200 to-orange-300 rounded"></div>
                          <span className="text-gray-700">Bloqueado (Empleada)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gray-50 rounded"></div>
                          <span className="text-gray-700">Fechas pasadas</span>
                        </div>
                      </div>
                      {/* Reglas de Disponibilidad - Only for managers */}
                      {isManager && (
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700 font-medium">
                          📊 Reglas de Disponibilidad:
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            • {tipo === 'Vacaciones' ? `${vacacionesDisponibilidadPct}%` : '20%'} del grupo puede estar {tipo === 'Vacaciones' ? 'de vacaciones' : 'en asuntos propios'} durante todo el año
                        </p>
                      </div>
                      )}
                    </div>
                    )}
                    
                    {/* Selected dates info */}
                    {selectedDates.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          📅 Días seleccionados: {fechaInicio && fechaFin ? calculateDays(fechaInicio, fechaFin) : selectedDates.length} días
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Desde: {fechaInicio} hasta: {fechaFin}
                        </p>
                      </div>
                    )}
                    {/* Avertisment când intervalul include zile ocupate (sin disponibilidad) */}
                    {occupiedDaysInRange.length > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                        <p className="text-sm font-medium text-amber-800">
                          ⚠️ No puedes incluir en el intervalo días ya ocupados
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Los siguientes días están ocupados por otras solicitudes o sin disponibilidad: {occupiedDaysInRange.join(', ')}. Elige solo días disponibles o cambia el rango.
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                          No se podrá enviar la solicitud hasta que el rango no incluya días ocupados.
                        </p>
                      </div>
                    )}
                  </>
                )}
                
                {/* Calendar for Asuntos Propios - separate conditional */}
                {tipo === 'Asuntos Propios' && (
                  <>
                    {/* Recomandare pentru mobil să rotească telefonul */}
                    {isMobile && (
                      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📱</span>
                          <p className="text-sm font-medium text-purple-800">
                            💡 Recomendación: Rota tu teléfono a horizontal para una mejor experiencia con el calendario
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Calendar for Asuntos Propios */}
                    <div 
                    className="relative group p-4 sm:p-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      boxShadow: '0 10px 30px rgba(168, 85, 247, 0.15)',
                      padding: 'clamp(1rem, 2vw + 0.5rem, 1.5rem)'
                    }}
                  >
                    {/* Glow animado en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-purple-600 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duración-500"></div>
                    
                    {/* Header con icono 3D */}
                    <div className="relative flex items-start sm:items-center justify-between flex-wrap gap-3 sm:gap-6 mb-6">
                      <div className="flex items-center">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                          style={{
                              background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                              boxShadow: '0 8px 20px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <span className="text-2xl">📅</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                            Selecciona tus Asuntos Propios
                        </h3>
                      </div>

                      {/* Month Navigation */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => navigateMonth('prev')}
                          className="w-10 h-10 bg-white border border-purple-300 rounded-lg flex items-center justify-center hover:bg-purple-50 hover:border-purple-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronLeft className="w-5 h-5 text-purple-600" />
                        </button>
                        
                        <div className="bg-white border border-purple-300 rounded-lg px-4 py-2 shadow-sm min-w-[140px] text-center">
                          <div className="text-lg font-bold text-purple-600">
                            {monthNames[calendarMonth]} {calendarYear}
                          </div>
                      </div>

                        <button
                          onClick={() => navigateMonth('next')}
                          className="w-10 h-10 bg-white border border-purple-300 rounded-lg flex items-center justify-center hover:bg-purple-50 hover:border-purple-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronRight className="w-5 h-5 text-purple-600" />
                        </button>
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="bg-white rounded-xl border border-purple-200 shadow-lg sm:overflow-hidden">
                      <div className="overflow-x-auto sm:overflow-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="w-full min-w-[280px] sm:min-w-[420px]">
                          {/* Days of week header */}
                          <div className="grid grid-cols-7 bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                              <div
                                key={day}
                                className="p-2 sm:p-3 text-center text-[11px] sm:text-sm font-bold text-purple-700 border-r border-purple-200 last:border-r-0"
                              >
                                {day}
                              </div>
                            ))}
                          </div>
                          {/* Calendar days */}
                          <div className="grid grid-cols-7">
                            {/* Empty cells for days before month starts */}
                            {Array.from({ length: getFirstDayOfMonth(calendarYear, calendarMonth) }).map((_, index) => (
                              <div
                                key={`empty-${index}`}
                                className="h-10 sm:h-12 border-r border-b border-gray-100 last:border-r-0"
                              ></div>
                            ))}
                            {/* Days of the month */}
                            {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }, (_, i) => i + 1).map(day => {
                              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const today = new Date();
                              const currentDate = new Date(dateStr);
                              const isToday = currentDate.toDateString() === today.toDateString();
                              const isPast = editingSolicitud === null && currentDate < today;
                              // Ignorăm perioada de blocare când se editează o solicitare
                              const isEditingVacacionesOrAsuntoPropio = editingSolicitud !== null && 
                                (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios');
                              const isBlocked = isEditingVacacionesOrAsuntoPropio
                                ? false
                                : isInAsuntoPropioCalendarBlock(dateStr);
                              const availability = dateAvailability[dateStr];
                              const isFull = availability && availability.isFull;
                              const isLowAvailability = availability && availability.available <= 1 && availability.available > 0;
                              // For Asuntos Propios, we don't use isDateOccupied - we use availability logic
                              const isOccupied = false;
                              return (
                                <button
                                  key={day}
                                  onClick={() => !isDateDisabled(day) && toggleDate(day)}
                                  disabled={isDateDisabled(day)}
                                  className={`h-10 sm:h-12 border-r border-b border-gray-100 last:border-r-0 transition-all duration-200 relative ${
                                    isDateSelected(day)
                                      ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold shadow-lg'
                                      : isBlocked
                                      ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800 cursor-not-allowed'
                                      : isFull
                                      ? 'bg-gradient-to-br from-purple-200 to-purple-300 text-purple-800 cursor-not-allowed'
                                      : isLowAvailability
                                      ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 hover:bg-yellow-200'
                                      : isOccupied
                                      ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 cursor-not-allowed'
                                      : isPast
                                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : isToday
                                      ? 'bg-gradient-to-br from-green-100 to-green-200 text-green-800 hover:bg-green-200'
                                      : 'bg-white text-gray-700 hover:bg-purple-50 hover:text-purple-800'
                                  }`}
                                  title={
                                    isPast
                                      ? 'Fecha pasada'
                                      : isBlocked
                                      ? 'Bloqueado (Empleada)'
                                      : isFull
                                      ? (canAccessAllTabs
                                          ? `Sin disponibilidad (${availability?.occupied ?? 0}/${availability?.maxAllowed ?? 1})`
                                          : 'Sin disponibilidad para Asuntos Propios en esta fecha')
                                      : isLowAvailability
                                      ? (canAccessAllTabs
                                          ? `Poca disponibilidad (${availability?.available ?? 0}/${availability?.maxAllowed ?? 1})`
                                          : 'Poca disponibilidad: quedan pocos cupos para este día')
                                      : isOccupied
                                      ? 'Ocupado por otras solicitudes'
                                      : isToday
                                      ? 'Hoy'
                                      : availability
                                      ? (canAccessAllTabs
                                          ? `Disponible (${availability.available}/${availability.maxAllowed})`
                                          : 'Disponible')
                                      : 'Disponible'
                                  }
                                >
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <span className="text-xs sm:text-sm font-medium">{day}</span>
                                    {availability && (
                                      <span className="text-[10px] sm:text-xs opacity-75">
                                        {isFull
                                          ? '🈵'
                                          : isLowAvailability
                                            ? '⚠️'
                                            : canAccessAllTabs
                                              ? availability.available
                                              : ''}
                                      </span>
                                    )}
                                  </div>
                                  {/* Icons overlay */}
                                  <div className="absolute top-1 right-1">
                                    {isBlocked && <span className="text-xs">🔒</span>}
                                    {isFull && !isBlocked && <span className="text-xs">🈵</span>}
                                    {isLowAvailability && !isBlocked && !isFull && <span className="text-xs">⚠️</span>}
                                    {isOccupied && !isBlocked && !isFull && <span className="text-xs">🚫</span>}
                                    {isToday && !isBlocked && !isFull && !isOccupied && <span className="text-xs">📍</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Availability info for Asuntos Propios */}
                    {editingSolicitud === null && Object.keys(dateAvailability).length > 0 && (
                      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm font-medium text-purple-800">
                          📊 Disponibilidad de Asuntos Propios
                        </p>
                        {canAccessAllTabs ? (
                          <>
                            <p className="text-xs text-purple-600 mt-1">
                              Total empleados en grupo: {Object.values(dateAvailability)[0]?.groupSize ?? 0}
                            </p>
                            <p className="text-xs text-purple-600">
                              Límite permitido: {Object.values(dateAvailability)[0]?.maxAllowed ?? 0} personas
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-purple-600 mt-1">
                            El calendario indica si el día está disponible; en amarillo hay poca disponibilidad. El cupo diario lo gestiona la empresa y no se muestra el número exacto.
                          </p>
                        )}
                        <p className="text-xs text-purple-600">
                          Días disponibles: {totalAsuntoPropioDays}/6 días (anual)
                        </p>
                      </div>
                    )}

                    {/* Calendar Legend for Asuntos Propios */}
                    {editingSolicitud === null && (
                    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-gray-800">Leyenda del Calendario:</h4>
                        <div className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">
                          Días disponibles: {totalAsuntoPropioDays}/6 días (anual)
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded"></div>
                          <span className="text-gray-700">Días seleccionados</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-green-100 to-green-200 rounded"></div>
                          <span className="text-gray-700">Hoy</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-purple-200 to-purple-300 rounded"></div>
                          <span className="text-gray-700">Sin disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded"></div>
                          <span className="text-gray-700">Poca disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-orange-200 to-orange-300 rounded"></div>
                          <span className="text-gray-700">Bloqueado (Empleada)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gray-50 rounded"></div>
                          <span className="text-gray-700">Fechas pasadas</span>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-purple-50 rounded border border-purple-200">
                        <p className="text-xs text-purple-700 font-medium">
                          📊 Reglas para Asuntos Propios:
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          • Máximo 6 días por persona por año
                        </p>
                        <p className="text-xs text-purple-600">
                          {canAccessAllTabs ? (
                            <>• Máximo {asuntosPropiosMaxPorDia} personas por día en total (se configura en «Bloquear Asuntos Propios»)</>
                          ) : (
                            <>• Cupo diario a nivel empresa (el número no se muestra en el calendario)</>
                          )}
                        </p>
                        <p className="text-xs text-purple-600">
                          • Máximo 1 persona del mismo centro por día
                        </p>
                        <p className="text-xs text-purple-600">
                          • Máximo 6 días consecutivos
                        </p>
                        <p className="text-xs text-purple-600">
                          • Mínimo 5 días de adelanto
                        </p>
                      </div>
                    </div>
                    )}
                    
                    {/* Selected dates info */}
                    {selectedDates.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          📅 Días seleccionados: {fechaInicio && fechaFin ? calculateDays(fechaInicio, fechaFin) : selectedDates.length} días
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Desde: {fechaInicio} hasta: {fechaFin}
                        </p>
                      </div>
                    )}
                  </div>
                  </>
                )}

                {/* Input date pentru Permiso Retribuido */}
                {tipo === 'Permiso Retribuido' && (
                  <div 
                    className="relative group p-4 sm:p-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.05) 0%, rgba(4, 120, 87, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(5, 150, 105, 0.2)',
                      boxShadow: '0 10px 30px rgba(5, 150, 105, 0.15)'
                    }}
                  >
                    <div className="relative flex items-center mb-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          boxShadow: '0 8px 20px rgba(5, 150, 105, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        }}
                      >
                        <span className="text-2xl">📅</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Período del Permiso
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="permiso-fecha-inicio" className="block text-sm font-bold text-gray-700 mb-2">
                          Fecha inicio
                        </label>
                        <input
                          id="permiso-fecha-inicio"
                          type="date"
                          value={fechaInicio}
                          onChange={(e) => {
                            setFechaInicio(e.target.value);
                            if (e.target.value && fechaFin && e.target.value > fechaFin) {
                              setFechaFin(e.target.value);
                            }
                          }}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-emerald-200 focus:ring-emerald-300/50 focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label htmlFor="permiso-fecha-fin" className="block text-sm font-bold text-gray-700 mb-2">
                          Fecha fin
                        </label>
                        <input
                          id="permiso-fecha-fin"
                          type="date"
                          value={fechaFin}
                          min={fechaInicio || undefined}
                          onChange={(e) => setFechaFin(e.target.value)}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-emerald-200 focus:ring-emerald-300/50 focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Ausencias justificada: Tipo de justificante + Fecha + condiționale + adjunto */}
                {tipo === 'Ausencias justificada' && (
                  <div
                    className="relative group p-4 sm:p-6 space-y-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(8, 145, 178, 0.05) 0%, rgba(6, 122, 154, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(8, 145, 178, 0.2)',
                      boxShadow: '0 10px 30px rgba(8, 145, 178, 0.15)'
                    }}
                  >
                    {/* Tipo de justificante (obligatoriu) */}
                    <div>
                      <div className="relative flex items-center mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg"
                          style={{
                            background: 'linear-gradient(135deg, #0891b2 0%, #0679a2 100%)',
                            boxShadow: '0 8px 20px rgba(8, 145, 178, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <span className="text-2xl">📋</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Tipo de justificante <span className="text-red-500">*</span>
                        </h3>
                      </div>
                      <select
                        id="ausencia-tipo-justificante"
                        value={tipoJustificante}
                        onChange={(e) => {
                          setTipoJustificante(e.target.value);
                          setDescripcionOtro('');
                          setHoraCita('');
                          setCentroMedico('');
                        }}
                        required
                        className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-cyan-200 focus:ring-cyan-300/50 focus:border-cyan-400"
                      >
                        <option value="">Selecciona el tipo de justificante</option>
                        <option value="cita_medica">Cita médica (médico de cabecera)</option>
                        <option value="cita_especialista">Cita con especialista</option>
                        <option value="justificante_medico_sin_baja">Justificante médico (sin baja)</option>
                        <option value="deber_inexcusable">Deber inexcusable (cita oficial)</option>
                        <option value="incidencia_urgencia">Incidencia puntual / urgencia</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    {/* Si "Otro" → Describe el motivo (obligatoriu) */}
                    {tipoJustificante === 'otro' && (
                      <div>
                        <label htmlFor="ausencia-descripcion-otro" className="block text-sm font-bold text-gray-700 mb-2">
                          Describe el motivo <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="ausencia-descripcion-otro"
                          value={descripcionOtro}
                          onChange={(e) => setDescripcionOtro(e.target.value)}
                          placeholder="Describe el motivo de la ausencia..."
                          rows={3}
                          required
                          className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-cyan-200 focus:ring-cyan-300/50 focus:border-cyan-400"
                        />
                      </div>
                    )}

                    {/* Si "Cita médica" o "Cita con especialista" → Hora + Centro médico (opcionales) */}
                    {(tipoJustificante === 'cita_medica' || tipoJustificante === 'cita_especialista') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="ausencia-hora-cita" className="block text-sm font-bold text-gray-700 mb-2">
                            Hora de la cita <span className="text-gray-500 font-normal">(opcional)</span>
                          </label>
                          <input
                            id="ausencia-hora-cita"
                            type="time"
                            value={horaCita}
                            onChange={(e) => setHoraCita(e.target.value)}
                            className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-cyan-200 focus:ring-cyan-300/50 focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label htmlFor="ausencia-centro-medico" className="block text-sm font-bold text-gray-700 mb-2">
                            Centro médico <span className="text-gray-500 font-normal">(opcional)</span>
                          </label>
                          <input
                            id="ausencia-centro-medico"
                            type="text"
                            value={centroMedico}
                            onChange={(e) => setCentroMedico(e.target.value)}
                            placeholder="Ej: Centro Salud Madrid"
                            className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-cyan-200 focus:ring-cyan-300/50 focus:border-cyan-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Fecha de la ausencia */}
                    <div>
                      <div className="relative flex items-center mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg"
                          style={{
                            background: 'linear-gradient(135deg, #0891b2 0%, #0679a2 100%)',
                            boxShadow: '0 8px 20px rgba(8, 145, 178, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <span className="text-2xl">📅</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Fecha de la ausencia <span className="text-red-500">*</span>
                        </h3>
                      </div>
                      <label htmlFor="ausencia-justificada-fecha" className="block text-sm font-bold text-gray-700 mb-2">
                        Fecha <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="ausencia-justificada-fecha"
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => {
                          setFechaInicio(e.target.value);
                          setFechaFin(e.target.value);
                        }}
                        className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-cyan-200 focus:ring-cyan-300/50 focus:border-cyan-400"
                      />
                    </div>

                    {/* Adjuntar justificante (opcional) */}
                    <div>
                      <label htmlFor="ausencia-archivo-justificante" className="block text-sm font-bold text-gray-700 mb-2">
                        Adjuntar justificante <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="ausencia-archivo-justificante"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={(e) => setArchivoJustificante(e.target.files?.[0] || null)}
                        className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg border-cyan-200 focus:ring-cyan-300/50 focus:border-cyan-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-medium file:bg-cyan-100 file:text-cyan-800"
                      />
                      {archivoJustificante && (
                        <p className="text-sm text-gray-600 mt-2">
                          📎 {archivoJustificante.name}
                        </p>
                      )}
                    </div>

                    {/* Mesaj de avertizare */}
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">⚠️</span>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-bold text-yellow-800 mb-2">
                            Importante - Esta ausencia sirve como aviso
                          </h3>
                          <p className="text-sm text-yellow-700 mb-2">
                            Esta ausencia justificada sirve como aviso previo. Sin embargo, es importante que también registres en el día de la ausencia:
                          </p>
                          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                            <li>Una &quot;Salida del Centro&quot; o &quot;Salida Sin Regreso&quot; cuando salgas</li>
                            <li>Un &quot;Regreso al Centro&quot; cuando regreses (si aplica)</li>
                          </ul>
                          <p className="text-sm font-bold text-yellow-800 mt-2">
                            Si no registras la salida/regreso, se descontará el día completo.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cálculo de días - MEGA WOW Badge */}
                {fechaInicio && fechaFin && (
                  <div 
                    className="relative group overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.1) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '2px solid rgba(34, 197, 94, 0.3)',
                      boxShadow: '0 8px 25px rgba(34, 197, 94, 0.2)',
                      padding: '1rem'
                    }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                    
                    <div className="relative flex items-center justify-between">
                      <p className="text-base font-bold text-green-800 flex items-center">
                        <span className="text-2xl mr-3">⏱️</span>
                        {tipo === 'Permiso Retribuido' ? (
                          <>
                            <span>Días laborables:</span>
                            <span className="ml-2 text-2xl text-green-600">{calculateWorkingDays(fechaInicio, fechaFin)}</span>
                            <span className="ml-2 text-lg">días</span>
                            <span className="ml-2 text-sm text-gray-600">({calculateDays(fechaInicio, fechaFin)} días totales)</span>
                          </>
                        ) : (
                          <>
                            <span>Días solicitados:</span>
                            <span className="ml-2 text-2xl text-green-600">{calculateDays(fechaInicio, fechaFin)}</span>
                            <span className="ml-2 text-lg">días</span>
                          </>
                        )}
                      </p>
                    </div>
                    
                    {tipo === 'Asuntos Propios' && (
                      <div className="mt-2 ml-11">
                        <p className="text-sm text-green-700 font-medium">
                          ℹ️ Máximo 5 días consecutivos, mínimo 5 días de antelación
                        </p>
                        <p className={`text-sm font-medium mt-1 ${
                          totalAsuntoPropioDays >= 6 ? 'text-red-600' : 
                          totalAsuntoPropioDays >= 4 ? 'text-yellow-600' : 
                          'text-blue-600'
                        }`}>
                          📊 Días usados: {totalAsuntoPropioDays}/6 {totalAsuntoPropioDays >= 6 ? '(LÍMITE ALCANZADO)' : ''}
                        </p>
                      </div>
                    )}
                    {tipo === 'Vacaciones' && (() => {
                      const tieneCertificadoHandicap = empleadoCompleto?.certificado_handicap_confirmado === true ||
                                                         empleadoCompleto?.certificado_handicap_confirmado === 1 ||
                                                         authUser?.certificado_handicap_confirmado === true ||
                                                         authUser?.certificado_handicap_confirmado === 1;
                      
                      if (tieneCertificadoHandicap) {
                        return (
                          <p className="text-sm text-blue-700 mt-2 ml-11 font-medium">
                            ℹ️ Puedes solicitar cualquier número de días (certificado de discapacidad confirmado)
                          </p>
                        );
                      }
                      
                      return (
                        <p className="text-sm text-green-700 mt-2 ml-11 font-medium">
                          ℹ️ Solo quincena (15 días) o mes entero
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Motivo - SUPER WOW 3D */}
                <div 
                  className="relative group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.05) 0%, rgba(75, 85, 99, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(107, 114, 128, 0.2)',
                    boxShadow: '0 10px 30px rgba(107, 114, 128, 0.15)',
                    padding: '1.5rem'
                  }}
                >
                  {/* Glow animado en hover */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-gray-400 to-slate-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                  
                  {/* Header con icono 3D */}
                  <div className="relative flex items-center mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                      style={{
                        background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                        boxShadow: '0 8px 20px rgba(107, 114, 128, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      <span className="text-2xl">💬</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Motivo <span className={`text-sm font-normal ${editingSolicitud ? 'text-red-600' : 'text-gray-500'}`}>
                        {editingSolicitud ? '(obligatorio)' : '(opcional)'}
                      </span>
                    </h3>
                  </div>

                  {/* Textarea modernizado */}
                  <textarea
                    id="solicitud-motivo"
                    name="solicitud-motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Describe el motivo de tu solicitud..."
                    rows={4}
                    className="relative w-full px-4 py-4 text-base font-medium rounded-xl border-2 transition-all duration-300 shadow-md hover:shadow-lg focus:shadow-xl resize-none"
                    style={{
                      background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                      borderColor: '#d1d5db',
                      color: '#374151',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6b7280';
                      e.target.style.boxShadow = '0 0 0 3px rgba(107, 114, 128, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                    }}
                  />
                </div>

                {/* Fecha último día de trabajo - Pentru BAJA_VOLUNTARIA */}
                {tipo === 'BAJA_VOLUNTARIA' && (
                  <div 
                    className="relative group"
                    style={{
                      background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.05) 0%, rgba(185, 28, 28, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      boxShadow: '0 10px 30px rgba(220, 38, 38, 0.15)',
                      padding: '1.5rem'
                    }}
                  >
                    {/* Glow animado en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 to-pink-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                    
                    {/* Header con icono 3D */}
                    <div className="relative flex items-center mb-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                          boxShadow: '0 8px 20px rgba(220, 38, 38, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        }}
                      >
                        <span className="text-2xl">📅</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Último día de trabajo <span className="text-sm font-normal text-red-600">(obligatorio)</span>
                      </h3>
                    </div>

                    {/* Input date */}
                    <input
                      type="date"
                      value={fechaUltimoDiaTrabajo}
                      onChange={(e) => setFechaUltimoDiaTrabajo(e.target.value)}
                      required
                      className="relative w-full px-4 py-4 text-base font-medium rounded-xl border-2 transition-all duration-300 shadow-md hover:shadow-lg focus:shadow-xl"
                      style={{
                        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                        borderColor: '#dc2626',
                        color: '#374151',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#dc2626';
                        e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.2)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#dc2626';
                        e.target.style.boxShadow = '';
                      }}
                    />
                    <p className="text-sm text-gray-600 mt-2">
                      ℹ️ Este será el último día que trabajarás en la empresa.
                    </p>
                  </div>
                )}

                {/* Upload documento - Pentru BAJA_VOLUNTARIA */}
                {tipo === 'BAJA_VOLUNTARIA' && (
                  <div 
                    className="relative group"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      boxShadow: '0 10px 30px rgba(139, 92, 246, 0.15)',
                      padding: '1.5rem'
                    }}
                  >
                    {/* Glow animado en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-indigo-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                    
                    {/* Header con icono 3D */}
                    <div className="relative flex items-center mb-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          boxShadow: '0 8px 20px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        }}
                      >
                        <span className="text-2xl">📄</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Documento firmado <span className="text-sm font-normal text-purple-600">(opcional)</span>
                      </h3>
                    </div>

                    {/* Input file */}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Verifică dimensiunea (max 10MB)
                          if (file.size > 10 * 1024 * 1024) {
                            setErrorMsg('El archivo es demasiado grande. Máximo 10MB.');
                            return;
                          }
                          setBajaVoluntariaDocumento(file);
                          setErrorMsg('');
                        }
                      }}
                      className="relative w-full px-4 py-4 text-base font-medium rounded-xl border-2 transition-all duration-300 shadow-md hover:shadow-lg focus:shadow-xl"
                      style={{
                        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                        borderColor: '#8b5cf6',
                        color: '#374151',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#8b5cf6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.2)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#8b5cf6';
                        e.target.style.boxShadow = '';
                      }}
                    />
                    {bajaVoluntariaDocumento && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-600">📎</span>
                          <span className="text-sm text-gray-700 font-medium">{bajaVoluntariaDocumento.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(bajaVoluntariaDocumento.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 mt-2">
                      ℹ️ Puedes subir un documento firmado (por ejemplo, la solicitud de baja voluntaria firmada).
                    </p>
                  </div>
                )}

                {/* Botón Enviar - MEGA ULTRA WOW 3D integrado en card */}
                <div 
                  className="relative group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)',
                    padding: '2rem'
                  }}
                >
                  {/* Glow animado en hover del card */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 to-pink-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                  
                  {/* Botón centrado */}
                  <div className="relative text-center">
                    <button
                      onClick={handleAdd}
                      disabled={isOperationLoading('submit')}
                      className="group/btn relative inline-flex items-center justify-center overflow-hidden"
                    >
                      {/* Capa externa con glow animado más suave */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 via-pink-500 to-purple-500 opacity-50 blur-lg group-hover/btn:opacity-75 transition-opacity duration-300"></div>
                      
                      {/* Botón principal */}
                      <div 
                        className="relative px-10 py-4 rounded-2xl font-black text-lg text-white shadow-xl transform group-hover/btn:scale-105 group-active/btn:scale-95 transition-all duration-300"
                        style={{
                          background: isOperationLoading('submit') 
                            ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)'
                            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
                          boxShadow: '0 12px 28px rgba(239, 68, 68, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.3)'
                        }}
                      >
                        {/* Shimmer effect */}
                        {!isOperationLoading('submit') && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-1000"></div>
                        )}
                        
                        {/* Contenido del botón */}
                        <div className="relative flex items-center gap-3">
                          {isOperationLoading('submit') ? (
                            <>
                              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>{editingSolicitud ? 'Actualizando...' : 'Enviando...'}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-2xl animate-bounce">{editingSolicitud ? '💾' : '📤'}</span>
                              <span>{editingSolicitud ? 'Actualizar Solicitud' : 'Enviar Solicitud'}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Partículas flotantes más discretas */}
                      {!isOperationLoading('submit') && (
                        <>
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping opacity-60"></div>
                          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-pink-300 rounded-full animate-ping opacity-60" style={{ animationDelay: '0.3s' }}></div>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Mensajes de feedback - Modernizados */}
                {errorMsg && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.8) 0%, rgba(254, 202, 202, 0.8) 100%)',
                      borderColor: '#fca5a5',
                      boxShadow: '0 8px 20px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">❌</span>
                      <p className="text-red-800 font-semibold">{errorMsg}</p>
                    </div>
                  </div>
                )}
                
                {successMsg && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(220, 252, 231, 0.8) 0%, rgba(187, 247, 208, 0.8) 100%)',
                      borderColor: '#86efac',
                      boxShadow: '0 8px 20px rgba(34, 197, 94, 0.2)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">✅</span>
                      <p className="text-green-800 font-semibold">{successMsg}</p>
                    </div>
                  </div>
                )}
                
                {serverResp && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: serverResp.startsWith('Status: 2')
                        ? 'linear-gradient(135deg, rgba(220, 252, 231, 0.8) 0%, rgba(187, 247, 208, 0.8) 100%)'
                        : 'linear-gradient(135deg, rgba(254, 226, 226, 0.8) 0%, rgba(254, 202, 202, 0.8) 100%)',
                      borderColor: serverResp.startsWith('Status: 2') ? '#86efac' : '#fca5a5',
                      boxShadow: serverResp.startsWith('Status: 2')
                        ? '0 8px 20px rgba(34, 197, 94, 0.2)'
                        : '0 8px 20px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <pre className={`text-sm font-mono whitespace-pre-wrap ${
                      serverResp.startsWith('Status: 2') ? 'text-green-800' : 'text-red-800'
                    }`}>{serverResp}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
      )}

      {/* Modal de confirmare ștergere */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' })}
        title=""
        size="md"
        className="max-w-lg"
      >
        <div className="py-4">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
          
          {/* Titlu */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            ¿Eliminar solicitud?
          </h3>
          
          {/* Mesaj de confirmare */}
          <p className="text-gray-600 mb-4 text-center">
            ¿Estás seguro de que deseas eliminar esta solicitud? Esta acción no se puede deshacer.
          </p>

          {/* Câmp pentru mesaj personalizat */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje para el empleado (opcional):
            </label>
            <textarea
              value={deleteConfirm.mensaje}
              onChange={(e) => setDeleteConfirm({ ...deleteConfirm, mensaje: e.target.value })}
              placeholder="Escribe un mensaje que se enviará al empleado por email junto con la confirmación de eliminación..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este mensaje se enviará por email al empleado junto con la confirmación de que se ha eliminado su solicitud.
            </p>
          </div>
          
          {/* Butoane */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' })}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (deleteConfirm.solicitudId) {
                  handleDelete(deleteConfirm.solicitudId, deleteConfirm.mensaje);
                }
              }}
              disabled={isOperationLoading('delete')}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('delete') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal pentru respingere solicitud pendiente (Permiso Retribuido / Ausencias justificada) */}
      <Modal
        isOpen={rejectPermisoModal.isOpen}
        onClose={() => setRejectPermisoModal({ isOpen: false, solicitud: null, mensaje: '', tipoSolicitud: 'Permiso Retribuido' })}
        title=""
        size="md"
        className="max-w-lg"
      >
        <div className="py-4">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <span className="text-4xl">❌</span>
          </div>
          
          {/* Titlu */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            ¿Rechazar {rejectPermisoModal.tipoSolicitud === 'Ausencias justificada' ? 'ausencia justificada' : 'permiso retribuido'}?
          </h3>
          
          {/* Mesaj de confirmare */}
          <p className="text-gray-600 mb-4 text-center">
            ¿Estás seguro de que deseas rechazar esta solicitud? Esta acción notificará al empleado.
          </p>

          {/* Câmp pentru mesaj personalizat */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje para el empleado (opcional):
            </label>
            <textarea
              value={rejectPermisoModal.mensaje}
              onChange={(e) => setRejectPermisoModal({ ...rejectPermisoModal, mensaje: e.target.value })}
              placeholder="Escribe un mensaje que se enviará al empleado por email junto con la notificación de rechazo..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este mensaje se enviará por email al empleado junto con la notificación de rechazo.
            </p>
          </div>
          
          {/* Butoane */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setRejectPermisoModal({ isOpen: false, solicitud: null, mensaje: '' })}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejectSolicitudPendiente}
              disabled={isOperationLoading('reject-permiso')}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('reject-permiso') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Rechazando...
                </>
              ) : (
                <>
                  <span className="text-lg">❌</span>
                  Rechazar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal pentru ștergere baja médica cu mesaj */}
      <Modal
        isOpen={deleteBajaMedicaModal.isOpen}
        onClose={() => setDeleteBajaMedicaModal({ isOpen: false, baja: null, mensaje: '' })}
        title=""
        size="md"
        className="max-w-lg"
      >
        <div className="py-4">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
          
          {/* Titlu */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            ¿Eliminar baja médica?
          </h3>
          
          {/* Informații despre baja */}
          {deleteBajaMedicaModal.baja && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Caso:</span>{' '}
                  <span className="text-gray-900">{deleteBajaMedicaModal.baja.casoId}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Trabajador:</span>{' '}
                  <span className="text-gray-900">{deleteBajaMedicaModal.baja.trabajador || 'N/A'}</span>
                </div>
                {deleteBajaMedicaModal.baja.fuente && (
                  <div>
                    <span className="font-semibold text-gray-700">Fuente:</span>{' '}
                    <span className="text-gray-900">{deleteBajaMedicaModal.baja.fuente}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Mesaj de confirmare */}
          <p className="text-gray-600 mb-4 text-center">
            ¿Estás seguro de que deseas eliminar esta baja médica? Esta acción no se puede deshacer.
          </p>

          {/* Câmp pentru mesaj personalizat */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje para el empleado (opcional):
            </label>
            <textarea
              value={deleteBajaMedicaModal.mensaje}
              onChange={(e) => setDeleteBajaMedicaModal({ ...deleteBajaMedicaModal, mensaje: e.target.value })}
              placeholder="Escribe un mensaje que se enviará al empleado por email junto con la confirmación de eliminación..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este mensaje se enviará por email al empleado junto con la confirmación de que se ha eliminado su baja médica.
            </p>
          </div>
          
          {/* Butoane */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setDeleteBajaMedicaModal({ isOpen: false, baja: null, mensaje: '' })}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (!deleteBajaMedicaModal.baja) return;
                
                try {
                  setOperationLoading('deleteBaja', true);
                  setErrorMsg('');
                  const token = localStorage.getItem('auth_token');
                  
                  const body = deleteBajaMedicaModal.mensaje.trim() 
                    ? { mensajePersonalizado: deleteBajaMedicaModal.mensaje.trim() }
                    : {};
                  
                  const response = await fetch(
                    routes.deleteBajaMedica(deleteBajaMedicaModal.baja.casoId, deleteBajaMedicaModal.baja.posicionId),
                    {
                      method: 'DELETE',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
                    }
                  );
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `HTTP ${response.status}`);
                  }
                  
                  const result = await response.json();
                  setSuccessMsg(result.message || 'Baja médica eliminada correctamente');
                  setDeleteBajaMedicaModal({ isOpen: false, baja: null, mensaje: '' });
                  await fetchBajasMedicas();
                } catch (error) {
                  console.error('Error eliminando baja médica:', error);
                  setErrorMsg(`Error al eliminar baja médica: ${error.message || error.toString()}`);
                } finally {
                  setOperationLoading('deleteBaja', false);
                }
              }}
              disabled={isOperationLoading('deleteBaja')}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('deleteBaja') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmare conversie ausencia */}
      <Modal
        isOpen={convertirConfirm.isOpen}
        onClose={() => setConvertirConfirm({ isOpen: false, ausencia: null })}
        title=""
        size="sm"
        className="max-w-md"
      >
        <div className="text-center py-4">
          {(() => {
            const tipoActual = convertirConfirm.ausencia ? (convertirConfirm.ausencia.TIPO || convertirConfirm.ausencia.tipo || '').trim() : '';
            const esJustificada = tipoActual === 'Ausencias justificada';
            const convertirA = esJustificada ? 'injustificada' : 'justificada';
            
            return (
              <>
                {/* Icon */}
                <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${
                  esJustificada ? 'bg-orange-100' : 'bg-green-100'
                }`}>
                  <span className="text-4xl">{esJustificada ? '⚠️' : '✅'}</span>
                </div>
                
                {/* Titlu */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Convertir en ausencia {convertirA}
                </h3>
                
                {/* Mesaj */}
                {esJustificada ? (
                  <>
                    <p className="text-gray-600 mb-4">
                      Esta acción solo debe realizarse si no existe justificante válido para la ausencia.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                      ¿Estás seguro de que deseas convertir esta ausencia justificada en injustificada?
                    </p>
                  </>
                ) : (
                  <p className="text-gray-600 mb-4">
                    Esta acción convertirá la ausencia injustificada en justificada.
                  </p>
                )}
              </>
            );
          })()}
          
          {/* Butoane */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setConvertirConfirm({ isOpen: false, ausencia: null })}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            {(() => {
              const tipoActual = convertirConfirm.ausencia ? (convertirConfirm.ausencia.TIPO || convertirConfirm.ausencia.tipo || '').trim() : '';
              const esJustificada = tipoActual === 'Ausencias justificada';
              return (
                <button
                  onClick={() => {
                    if (convertirConfirm.ausencia) {
                      handleConvertirAusencia(convertirConfirm.ausencia);
                    }
                  }}
                  disabled={isOperationLoading('convertir')}
                  className={`px-6 py-2.5 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                    esJustificada
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isOperationLoading('convertir') ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Convirtiendo...
                    </>
                  ) : (
                    'Convertir'
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      </Modal>

      {/* Modal asociere ausencias */}
      <Modal
        isOpen={asociarAusenciaModal.isOpen}
        onClose={() => setAsociarAusenciaModal({ isOpen: false, ausencia: null })}
        title="Asociar Ausencia"
        size="md"
        className="max-w-2xl"
      >
        {asociarAusenciaModal.ausencia && (() => {
          const ausenciaActual = asociarAusenciaModal.ausencia;
          const ausenciaActualId = ausenciaActual.id || ausenciaActual.ID;
          const codigoActual = ausenciaActual.CODIGO || ausenciaActual.codigo;
          
          // Filtrează ausencias disponibile pentru asociere:
          // - Același CODIGO
          // - Exclude pe cea curentă
          // - Exclude pe cele deja asociate cu alta (opțional, pentru simplitate)
          const ausenciasDisponibles = allAusencias.filter(a => {
            const aId = a.id || a.ID;
            const aCodigo = a.CODIGO || a.codigo;
            return aId !== ausenciaActualId && aCodigo === codigoActual;
          });

          return (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Ausencia actual:</strong>
                </p>
                <div className="text-sm text-blue-900">
                  <p><strong>Tipo:</strong> {ausenciaActual.TIPO || ausenciaActual.tipo}</p>
                  <p><strong>Fecha:</strong> {formatDate(ausenciaActual.FECHA || ausenciaActual.fecha || ausenciaActual.fecha_inicio)}</p>
                  <p><strong>ID:</strong> {ausenciaActualId}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona la ausencia con la que deseas asociar:
                </label>
                {ausenciasDisponibles.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                    No hay otras ausencias disponibles para asociar (mismo empleado).
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    {ausenciasDisponibles.map((ausencia) => {
                      const aId = ausencia.id || ausencia.ID;
                      const isSelected = selectedAusenciaIdForAsociar === aId;
                      return (
                        <div
                          key={aId}
                          onClick={() => setSelectedAusenciaIdForAsociar(aId)}
                          className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-blue-300'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => setSelectedAusenciaIdForAsociar(aId)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">
                                  {ausencia.TIPO || ausencia.tipo}
                                </span>
                                <span className="text-xs text-gray-500">#{aId}</span>
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                <span>Fecha: {formatDate(ausencia.FECHA || ausencia.fecha || ausencia.fecha_inicio)}</span>
                                {ausencia.MOTIVO || ausencia.motivo ? (
                                  <span className="ml-3">• Motivo: {ausencia.MOTIVO || ausencia.motivo}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setAsociarAusenciaModal({ isOpen: false, ausencia: null });
                    setSelectedAusenciaIdForAsociar(null);
                  }}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (selectedAusenciaIdForAsociar) {
                      handleAsociarAusencia(ausenciaActualId, selectedAusenciaIdForAsociar);
                      setSelectedAusenciaIdForAsociar(null);
                    }
                  }}
                  disabled={!selectedAusenciaIdForAsociar || isOperationLoading('asociar-ausencia')}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isOperationLoading('asociar-ausencia') ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Asociando...
                    </>
                  ) : (
                    <>
                      🔗 Asociar
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal: Añadir baja manual */}
      <Modal
        isOpen={showManualBajaModal}
        onClose={() => setShowManualBajaModal(false)}
        title="Añadir baja manual"
        size="md"
      >
        <div className="space-y-5">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">
            Crea una baja médica manual (fuente: <b>MANUAL</b>) para estar al día si Mutua no actualiza.
            Cuando llegue la baja desde Mutua (Excel), el sistema te pedirá resolver el conflicto.
          </div>

          <div className="relative">
            <label
              htmlFor="manual-baja-employee-search"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Empleado (código / nombre / email) <span className="text-red-500">*</span>
            </label>
            <input
              id="manual-baja-employee-search"
              type="text"
              value={manualEmployeeSearch}
              onChange={(e) => {
                setManualEmployeeSearch(e.target.value);
                setManualShowEmployeeDropdown(true);
              }}
              onFocus={() => setManualShowEmployeeDropdown(true)}
              placeholder="Ej: 10000084, Pirvu, pirvu@..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 bg-white"
            />
            {manualSelectedEmployee?.codigo && (
              <div className="mt-2 text-xs text-gray-600">
                Seleccionado: <b>{manualSelectedEmployee.codigo}</b> — {manualSelectedEmployee.name || manualSelectedEmployee.email}
              </div>
            )}

            {manualShowEmployeeDropdown && (
              <div className="absolute z-[9999] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                {manualEmployeeOptions.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-500 text-sm">
                    No se encontraron empleados.
                  </div>
                ) : (
                  <div className="p-2">
                    {manualEmployeeOptions.map((u) => {
                      const key = `${u.codigo || u.email || u.name}`;
                      return (
                        <button
                          key={key}
                          onClick={(e) => {
                            e.preventDefault();
                            setManualSelectedEmployee(u);
                            setManualEmployeeSearch(`${u.codigo} - ${u.name || u.email}`);
                            setManualShowEmployeeDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {u.name || 'Sin nombre'}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {u.email || '—'}
                              </div>
                            </div>
                            <div className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-lg">
                              {u.codigo || 'N/A'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="manual-baja-fecha-baja" className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha baja <span className="text-red-500">*</span>
              </label>
              <input
                id="manual-baja-fecha-baja"
                type="date"
                value={manualBajaFechaBaja}
                onChange={(e) => setManualBajaFechaBaja(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 bg-white"
              />
            </div>
            <div>
              <label htmlFor="manual-baja-fecha-alta" className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha alta (opcional)
              </label>
              <input
                id="manual-baja-fecha-alta"
                type="date"
                value={manualBajaFechaAlta}
                onChange={(e) => setManualBajaFechaAlta(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 bg-white"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setShowManualBajaModal(false)}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateManualBaja}
              disabled={isOperationLoading('createManualBaja')}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('createManualBaja') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creando...
                </>
              ) : (
                <>
                  <span>➕</span>
                  Crear baja manual
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Resolver conflictos MANUAL vs MUTUA */}
      <Modal
        isOpen={showBajaConflictsModal}
        onClose={() => setShowBajaConflictsModal(false)}
        title="Resolver conflictos (MANUAL vs MUTUA)"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            Se detectaron registros duplicados (MANUAL y MUTUA) para la misma baja. Elige qué hacer.
            Verás explícitamente <b>Fecha alta MANUAL</b> y <b>Fecha alta MUTUA</b>.
          </div>

          {(bajaConflicts || []).length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No hay conflictos.
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {bajaConflicts.map((c) => {
                const key = `${c?.manual?.idCaso || ''}_${c?.manual?.idPosicion || ''}__${c?.mutua?.idCaso || ''}_${c?.mutua?.idPosicion || ''}`;
                const choice = bajaConflictChoices?.[key] || 'merge';
                return (
                  <div key={key} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">
                          {c?.trabajador || 'Sin nombre'}{' '}
                          <span className="text-gray-500 font-semibold">
                            (Código: {c?.codigoEmpleado || 'N/A'})
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Fecha baja: <b>{formatDate(c?.fechaBaja)}</b>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        MANUAL: {c?.manual?.idCaso}/{c?.manual?.idPosicion} · MUTUA: {c?.mutua?.idCaso}/{c?.mutua?.idPosicion}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-amber-800">Fecha alta (MANUAL)</div>
                        <div className="text-sm font-bold text-amber-900">
                          {formatDate(c?.fechaAltaManual) || '-'}
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-emerald-800">Fecha alta (MUTUA)</div>
                        <div className="text-sm font-bold text-emerald-900">
                          {formatDate(c?.fechaAltaMutua) || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-semibold text-gray-700 mb-2">Acción</div>
                      <div className="flex flex-col sm:flex-row gap-3 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`conflict_${key}`}
                            value="keep_manual"
                            checked={choice === 'keep_manual'}
                            onChange={() =>
                              setBajaConflictChoices((prev) => ({ ...prev, [key]: 'keep_manual' }))
                            }
                          />
                          <span><b>Conservar MANUAL</b> (sobrescribe MUTUA)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`conflict_${key}`}
                            value="use_mutua"
                            checked={choice === 'use_mutua'}
                            onChange={() =>
                              setBajaConflictChoices((prev) => ({ ...prev, [key]: 'use_mutua' }))
                            }
                          />
                          <span><b>Usar MUTUA</b></span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`conflict_${key}`}
                            value="merge"
                            checked={choice === 'merge'}
                            onChange={() =>
                              setBajaConflictChoices((prev) => ({ ...prev, [key]: 'merge' }))
                            }
                          />
                          <span><b>Unir</b> (si MUTUA no tiene alta, copia MANUAL)</span>
                        </label>
                      </div>
                      {choice === 'keep_manual' && (
                        <div className="mt-2 text-xs text-rose-700">
                          Nota: “Conservar MANUAL” actualizará la Fecha alta de MUTUA con la de MANUAL (incluso si está vacía).
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setShowBajaConflictsModal(false)}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Más tarde
            </button>
            <button
              onClick={handleResolveBajaConflicts}
              disabled={isOperationLoading('resolveBajaConflicts')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('resolveBajaConflicts') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Aplicando...
                </>
              ) : (
                <>
                  <span>✅</span>
                  Aplicar decisiones
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal pentru solicitare justificante - ELIMINAT (folosim recordarJustificante direct) */}

      {/* Modal pentru Upload Justificante */}
      <Modal
        isOpen={showUploadJustificanteModal}
        onClose={() => {
          setShowUploadJustificanteModal(false);
          setSelectedAusenciaForUpload(null);
          setUploadJustificanteFile(null);
          setUploadJustificanteError(null);
        }}
        title="Cargar Justificante"
        size="md"
      >
        {selectedAusenciaForUpload && (
          <div className="space-y-6">
            {/* Info ausencia */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📄</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {selectedAusenciaForUpload.tipo || selectedAusenciaForUpload.TIPO || 'Ausencia'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Fecha: {selectedAusenciaForUpload.FECHA || selectedAusenciaForUpload.fecha || selectedAusenciaForUpload.fecha_inicio || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* File input */}
            <div>
              <label htmlFor="justificante-file-input" className="block text-sm font-semibold text-gray-700 mb-3">
                Selecciona el archivo del justificante <span className="text-red-500">*</span>
              </label>
              <input
                id="justificante-file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Verifică dimensiunea (max 10MB)
                    if (file.size > 10 * 1024 * 1024) {
                      setUploadJustificanteError('El archivo es demasiado grande. Máximo 10MB.');
                      return;
                    }
                    setUploadJustificanteFile(file);
                    setUploadJustificanteError(null);
                  }
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white"
              />
              {uploadJustificanteFile && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">📎</span>
                    <span className="text-sm text-gray-700 font-medium">{uploadJustificanteFile.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(uploadJustificanteFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Informare clară */}
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-green-600 text-xl">ℹ️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800 font-medium">
                    Al cargar el justificante, se creará automáticamente una solicitud completa y se marcará como completada.
                  </p>
                </div>
              </div>
            </div>

            {/* Error message */}
            {uploadJustificanteError && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-red-600 text-lg">⚠️</span>
                  </div>
                  <div>
                    <p className="text-red-800 font-medium">Error</p>
                    <p className="text-red-600 text-sm">{uploadJustificanteError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Butoane */}
            <div className="flex gap-4 justify-center mt-8">
              <button
                onClick={() => {
                  setShowUploadJustificanteModal(false);
                  setSelectedAusenciaForUpload(null);
                  setUploadJustificanteFile(null);
                  setUploadJustificanteError(null);
                }}
                className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors duration-200"
              >
                <span className="mr-2">✖️</span>
                Cancelar
              </button>
              <button
                onClick={handleUploadJustificante}
                disabled={uploadJustificanteLoading || !uploadJustificanteFile}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploadJustificanteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Cargando...
                  </>
                ) : (
                  <>
                    <span className="mr-2">📤</span>
                    Cargar Justificante
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal estado justificantes (Todas > Aprobación, carga bajo demanda) */}
      <Modal
        isOpen={justificanteStatusModal.isOpen}
        onClose={() => setJustificanteStatusModal({ isOpen: false, loading: false, item: null, cerere: null, presencia: null, error: null })}
        title="Estado de justificantes"
        size="md"
      >
        {justificanteStatusModal.loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="md" text="Comprobando justificantes..." />
          </div>
        ) : (
          <div className="space-y-4">
            {justificanteStatusModal.item && (
              <p className="text-sm text-gray-600">
                {justificanteStatusModal.item.NOMBRE || justificanteStatusModal.item.nombre || justificanteStatusModal.item.email}
              </p>
            )}
            {justificanteStatusModal.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {justificanteStatusModal.error}
              </div>
            )}
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
              <p className="text-sm font-medium text-gray-800">Justificante para la solicitud:</p>
              {justificanteStatusModal.cerere?.status === 'cargado' && hasValidJustificanteDocId(justificanteStatusModal.cerere.doc) ? (
                <div className="text-sm text-green-700 flex items-center gap-2 flex-wrap">
                  <span>✅ Cargado</span>
                  <button
                    type="button"
                    onClick={() => downloadJustificanteDoc(justificanteStatusModal.cerere.doc, justificanteStatusModal.item, false).catch(() => setErrorMsg('Error al descargar el justificante.'))}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                  >
                    📥 Descargar
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadJustificanteDoc(justificanteStatusModal.cerere.doc, justificanteStatusModal.item, true).catch(() => setErrorMsg('Error al abrir el justificante.'))}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                  >
                    👁️ Ver
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-600">No cargado.</p>
              )}
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
              <p className="text-sm font-medium text-gray-800">Justificante de presencia a la cita:</p>
              {justificanteStatusModal.presencia?.status === 'completado' ? (
                <div className="text-sm text-green-700 flex items-center gap-2 flex-wrap">
                  <span>✅ Completado</span>
                  <button
                    type="button"
                    onClick={() => downloadJustificanteDoc(justificanteStatusModal.presencia.doc, justificanteStatusModal.item, false, true).catch(() => setErrorMsg('Error al descargar el justificante.'))}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                  >
                    📥 Descargar
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadJustificanteDoc(justificanteStatusModal.presencia.doc, justificanteStatusModal.item, true, true).catch(() => setErrorMsg('Error al abrir el justificante.'))}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-600 text-white hover:bg-cyan-700"
                  >
                    👁️ Ver
                  </button>
                </div>
              ) : justificanteStatusModal.presencia?.status === 'tras_aprobacion' ? (
                <p className="text-sm text-gray-500">{justificanteStatusModal.presencia.message}</p>
              ) : justificanteStatusModal.presencia?.status === 'pendiente' ? (
                <p className="text-sm text-amber-700">{justificanteStatusModal.presencia.message}</p>
              ) : (
                <p className="text-sm text-gray-500">—</p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setJustificanteStatusModal({ isOpen: false, loading: false, item: null, cerere: null, presencia: null, error: null })}
                className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Preview Justificante (Ausencias justificada) */}
      <Modal
        isOpen={justificantePreview.isOpen}
        onClose={() => {
          if (justificantePreview.blobUrl) {
            URL.revokeObjectURL(justificantePreview.blobUrl);
          }
          setJustificantePreview({ isOpen: false, blobUrl: null, fileName: '', mimeType: '' });
        }}
        title={`Vista previa - ${justificantePreview.fileName || 'Justificante'}`}
        size="lg"
        className="max-w-4xl"
      >
        {justificantePreview.blobUrl && (
          <div className="space-y-4">
            <div
              className={`border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 ${
                isJustificantePreviewImage(justificantePreview.mimeType, justificantePreview.fileName)
                  ? 'overflow-auto flex items-center justify-center p-2'
                  : 'overflow-hidden'
              }`}
              style={{ height: '70vh', minHeight: '400px' }}
            >
              {isJustificantePreviewImage(justificantePreview.mimeType, justificantePreview.fileName) ? (
                <img
                  src={justificantePreview.blobUrl}
                  alt=""
                  className="max-w-full w-auto h-auto object-contain"
                  style={{ maxHeight: 'min(68vh, 100%)' }}
                />
              ) : (
                <iframe
                  src={justificantePreview.blobUrl}
                  className="w-full h-full min-h-[400px] border-0"
                  title="Preview justificante"
                />
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (justificantePreview.blobUrl) URL.revokeObjectURL(justificantePreview.blobUrl);
                  setJustificantePreview({ isOpen: false, blobUrl: null, fileName: '', mimeType: '' });
                }}
                className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Preview PDF Baja Voluntaria */}
      <Modal
        isOpen={bajaVoluntariaPreview.isOpen}
        onClose={() => {
          if (bajaVoluntariaPreview.pdfUrl) {
            URL.revokeObjectURL(bajaVoluntariaPreview.pdfUrl);
          }
          setBajaVoluntariaPreview({ isOpen: false, solicitud: null, pdfUrl: null });
        }}
        title="Vista Previa - Baja Voluntaria"
        size="lg"
        className="max-w-4xl"
      >
        {bajaVoluntariaPreview.solicitud && (
          <div className="space-y-4">
            {/* Informații solicitare */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-purple-700">Empleado:</span>
                  <p className="text-purple-900">{bajaVoluntariaPreview.solicitud.nombre || 'N/A'}</p>
                </div>
                <div>
                  <span className="font-semibold text-purple-700">Código:</span>
                  <p className="text-purple-900">{bajaVoluntariaPreview.solicitud.codigo || 'N/A'}</p>
                </div>
                <div>
                  <span className="font-semibold text-purple-700">Último día de trabajo:</span>
                  <p className="text-purple-900">
                    {formatDate(bajaVoluntariaPreview.solicitud.fecha_ultimo_dia_trabajo || bajaVoluntariaPreview.solicitud.fecha_inicio)}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-purple-700">Días de preaviso:</span>
                  <p className="text-purple-900">
                    {bajaVoluntariaPreview.solicitud.dias_preaviso !== null && bajaVoluntariaPreview.solicitud.dias_preaviso !== undefined 
                      ? `${bajaVoluntariaPreview.solicitud.dias_preaviso} días`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Preview PDF */}
            {bajaVoluntariaPreview.pdfUrl && (
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <iframe
                  src={bajaVoluntariaPreview.pdfUrl}
                  className="w-full h-full"
                  title="Preview PDF Baja Voluntaria"
                />
              </div>
            )}

            {/* Butoane */}
            <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  if (bajaVoluntariaPreview.pdfUrl) {
                    URL.revokeObjectURL(bajaVoluntariaPreview.pdfUrl);
                  }
                  setBajaVoluntariaPreview({ isOpen: false, solicitud: null, pdfUrl: null });
                }}
                className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors duration-200"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  if (bajaVoluntariaPreview.solicitud) {
                    handleApproveBajaVoluntaria(bajaVoluntariaPreview.solicitud);
                  }
                }}
                disabled={isOperationLoading('approve')}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isOperationLoading('approve') ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Aprobando...
                  </>
                ) : (
                  <>
                    <span className="text-xl">✅</span>
                    Aprobar y Enviar a Gestoria
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal pentru conversie tip Permiso Retribuido */}
      <Modal
        isOpen={convertirTipoModal.isOpen}
        onClose={() => setConvertirTipoModal({ 
          isOpen: false, 
          ausencia: null, 
          mensaje: '',
          fechaInicio: '',
          fechaFin: '',
          nuevoTipo: null
        })}
        title="Convertir Ausencia"
        size="md"
      >
        {convertirTipoModal.ausencia && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">
                Selecciona el nuevo tipo para esta ausencia:
              </p>
              <div className="text-sm text-blue-900">
                <p><strong>Empleado:</strong> {convertirTipoModal.ausencia.nombre || convertirTipoModal.ausencia.NOMBRE || 'N/A'}</p>
                <p><strong>Tipo actual:</strong> {convertirTipoModal.ausencia.tipo || convertirTipoModal.ausencia.TIPO || 'N/A'}</p>
                <p><strong>Fecha:</strong> {formatDate(convertirTipoModal.ausencia.fecha || convertirTipoModal.ausencia.FECHA || '')}</p>
              </div>
            </div>

            {/* Câmp pentru mesaj personalizat */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mensaje personalizado (opcional):
              </label>
              <textarea
                value={convertirTipoModal.mensaje || ''}
                onChange={(e) => setConvertirTipoModal({ ...convertirTipoModal, mensaje: e.target.value })}
                placeholder="Escribe un mensaje que se enviará al empleado junto con la notificación del cambio..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                disabled={isOperationLoading('convertir-tipo')}
              />
              <p className="text-xs text-gray-500 mt-1">
                Este mensaje se incluirá en el email de notificación al empleado.
              </p>
            </div>

            <div className="space-y-3">
              {(() => {
                const tipoActual = (convertirTipoModal.ausencia?.tipo || convertirTipoModal.ausencia?.TIPO || '').toLowerCase();
                const esPermisoRetribuido = tipoActual.includes('permiso retribuido');
                const esAsuntoPropio = tipoActual.includes('asunto propio') || tipoActual.includes('asuntos propios');
                
                // Dacă este "Asunto Propio", afișăm opțiuni pentru conversie în Permiso Retribuido sau Ausencias
                if (esAsuntoPropio) {
                  return (
                    <>
                      <button
                        onClick={() => {
                          // Când se selectează "Permiso Retribuido", setăm nuevoTipo pentru a afișa câmpurile de date
                          const ausencia = convertirTipoModal.ausencia;
                          let fechaInicioValue = '';
                          let fechaFinValue = '';
                          
                          // Extrage datele din ausencia existentă
                          if (ausencia.FECHA && ausencia.FECHA.includes(' - ')) {
                            const [inicio, fin] = ausencia.FECHA.split(' - ');
                            fechaInicioValue = inicio.trim();
                            fechaFinValue = fin.trim();
                          } else {
                            fechaInicioValue = ausencia.fecha_inicio || ausencia["fecha inicio"] || ausencia.fecha || ausencia.FECHA || '';
                            fechaFinValue = ausencia.fecha_fin || ausencia["fecha fin"] || '';
                          }
                          
                          setConvertirTipoModal({ 
                            ...convertirTipoModal, 
                            nuevoTipo: 'Permiso Retribuido',
                            fechaInicio: fechaInicioValue,
                            fechaFin: fechaFinValue || fechaInicioValue
                          });
                        }}
                        disabled={isOperationLoading('convertir-tipo')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isOperationLoading('convertir-tipo') ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <span className="text-xl">💰</span>
                            <span>Permiso Retribuido</span>
                          </>
                        )}
                      </button>
                      
                      {/* Câmpuri pentru interval de date - doar când se selectează "Permiso Retribuido" */}
                      {convertirTipoModal.nuevoTipo === 'Permiso Retribuido' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-blue-800 mb-2">
                            Selecciona el intervalo de fechas:
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Fecha Inicio:
                              </label>
                              <input
                                type="date"
                                value={convertirTipoModal.fechaInicio || ''}
                                onChange={(e) => setConvertirTipoModal({ ...convertirTipoModal, fechaInicio: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                disabled={isOperationLoading('convertir-tipo')}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Fecha Fin:
                              </label>
                              <input
                                type="date"
                                value={convertirTipoModal.fechaFin || ''}
                                onChange={(e) => setConvertirTipoModal({ ...convertirTipoModal, fechaFin: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                disabled={isOperationLoading('convertir-tipo')}
                                min={convertirTipoModal.fechaInicio || ''}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleConvertirTipo('Permiso Retribuido')}
                            disabled={isOperationLoading('convertir-tipo') || !convertirTipoModal.fechaInicio}
                            className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isOperationLoading('convertir-tipo') ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Convirtiendo...
                              </>
                            ) : (
                              <>
                                <span>✅</span>
                                <span>Confirmar Conversión</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handleConvertirTipo('Ausencias justificada')}
                        disabled={isOperationLoading('convertir-tipo')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isOperationLoading('convertir-tipo') ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <span className="text-xl">✅</span>
                            <span>Ausencias justificada</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleConvertirTipo('Ausencia Injustificada')}
                        disabled={isOperationLoading('convertir-tipo')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isOperationLoading('convertir-tipo') ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <span className="text-xl">❌</span>
                            <span>Ausencia Injustificada</span>
                          </>
                        )}
                      </button>
                    </>
                  );
                }
                
                // Dacă este "Permiso Retribuido", afișăm opțiunile originale
                if (esPermisoRetribuido) {
                  return (
                    <>
                      <button
                        onClick={() => handleConvertirTipo('Ausencia Injustificada')}
                        disabled={isOperationLoading('convertir-tipo')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isOperationLoading('convertir-tipo') ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <span className="text-xl">❌</span>
                            <span>Ausencia Injustificada</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleConvertirTipo('Ausencia Justificada')}
                        disabled={isOperationLoading('convertir-tipo')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isOperationLoading('convertir-tipo') ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <span className="text-xl">✅</span>
                            <span>Ausencia Justificada</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleConvertirTipo('Asuntos Propios')}
                        disabled={isOperationLoading('convertir-tipo')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isOperationLoading('convertir-tipo') ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <span className="text-xl">📋</span>
                            <span>Asuntos Propios</span>
                          </>
                        )}
                      </button>
                    </>
                  );
                }
                
                // Fallback pentru alte tipuri (nu ar trebui să ajungă aici)
                return null;
              })()}
            </div>

            <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
              <button
                onClick={() => setConvertirTipoModal({ isOpen: false, ausencia: null, mensaje: '' })}
                disabled={isOperationLoading('convertir-tipo')}
                className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal pentru editare manuală durată */}
      <Modal
        isOpen={editarDuracionModal.isOpen}
        onClose={() => setEditarDuracionModal({ isOpen: false, ausencia: null, duracion: '', unidad: 'dias' })}
        title="Editar Duración"
      >
        <div className="space-y-4">
          {editarDuracionModal.ausencia && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Empleado:</span> {editarDuracionModal.ausencia.NOMBRE || editarDuracionModal.ausencia.nombre || 'N/A'}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Tipo:</span> {editarDuracionModal.ausencia.TIPO || editarDuracionModal.ausencia.tipo || 'N/A'}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Fecha:</span> {editarDuracionModal.ausencia.FECHA || editarDuracionModal.ausencia.fecha || 'N/A'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unidad:
            </label>
            <select
              value={editarDuracionModal.unidad}
              onChange={(e) => setEditarDuracionModal({ ...editarDuracionModal, unidad: e.target.value, duracion: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={isOperationLoading('update-duracion')}
            >
              <option value="dias">Días</option>
              <option value="horas">Horas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duración:
              {editarDuracionModal.unidad === 'horas' && (
                <span className="text-xs text-gray-500 ml-2">(Formato: HH:MM:SS, ej: 05:30:00)</span>
              )}
            </label>
            <input
              type={editarDuracionModal.unidad === 'horas' ? 'text' : 'number'}
              value={editarDuracionModal.duracion}
              onChange={(e) => setEditarDuracionModal({ ...editarDuracionModal, duracion: e.target.value })}
              placeholder={editarDuracionModal.unidad === 'horas' ? '05:30:00' : '1'}
              min="0"
              step={editarDuracionModal.unidad === 'horas' ? undefined : '0.5'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={isOperationLoading('update-duracion')}
            />
          </div>

          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => setEditarDuracionModal({ isOpen: false, ausencia: null, duracion: '', unidad: 'dias' })}
              disabled={isOperationLoading('update-duracion')}
              className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpdateDuracion}
              disabled={isOperationLoading('update-duracion') || !editarDuracionModal.duracion}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('update-duracion') ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Bloquear periodos vacaciones */}
      <Modal
        isOpen={showVacationBlockedPeriodsModal}
        onClose={() => {
          setShowVacationBlockedPeriodsModal(false);
          setNewBlockedPeriodInicio('');
          setNewBlockedPeriodFin('');
        }}
        title="Bloquear periodos para vacaciones"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Las fechas dentro de estos periodos no se podrán solicitar como vacaciones. Puedes bloquear meses enteros con los checkboxes o intervalos concretos abajo.
          </p>
          {canAccessAllTabs && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-1">Disponibilidad de vacaciones (mismo grupo, mismo día)</h4>
              <p className="text-xs text-gray-600 mb-2">
                Cuántas personas del mismo grupo pueden estar de vacaciones a la vez: porcentaje del tamaño del grupo (mínimo 1). Se aplica en el calendario y al aprobar solicitudes.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Porcentaje (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={0.5}
                    value={vacacionPctDraft}
                    onChange={(e) => setVacacionPctDraft(e.target.value)}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={savingVacacionPct}
                  onClick={async () => {
                    const n = Number(vacacionPctDraft);
                    if (!Number.isFinite(n) || n < 1 || n > 100) {
                      setErrorMsg('Indica un porcentaje entre 1 y 100.');
                      return;
                    }
                    setSavingVacacionPct(true);
                    setErrorMsg('');
                    try {
                      await callApi(routes.putVacacionesDisponibilidadPorcentaje, {
                        method: 'PUT',
                        body: JSON.stringify({ porcentaje: n }),
                        headers: { 'Content-Type': 'application/json' },
                      });
                      await fetchVacacionesDisponibilidadPct();
                      setVacacionPctDraft(String(n));
                    } catch (e) {
                      setErrorMsg(e?.message || 'Error al guardar el porcentaje.');
                    } finally {
                      setSavingVacacionPct(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg font-medium bg-gray-800 hover:bg-gray-900 text-white text-sm disabled:opacity-50"
                >
                  {savingVacacionPct ? 'Guardando…' : 'Guardar porcentaje'}
                </button>
              </div>
            </div>
          )}
          {/* Bloquear por mes entero: año + 12 checkboxes */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Bloquear mes entero</h4>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs font-medium text-gray-600">Año:</label>
              <select
                value={blockedPeriodsYear}
                onChange={(e) => setBlockedPeriodsYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {[new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {monthNames.map((name, idx) => {
                const month1 = idx + 1;
                const firstDay = `${blockedPeriodsYear}-${String(month1).padStart(2, '0')}-01`;
                const lastDay = (() => {
                  const d = new Date(blockedPeriodsYear, month1, 0);
                  return `${blockedPeriodsYear}-${String(month1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })();
                const isBlocked = vacationBlockedPeriods.some((p) => {
                  const inicio = (typeof p.fecha_inicio === 'string' ? p.fecha_inicio : p.fecha_inicio?.split?.('T')[0] ?? '').slice(0, 10);
                  const fin = (typeof p.fecha_fin === 'string' ? p.fecha_fin : p.fecha_fin?.split?.('T')[0] ?? '').slice(0, 10);
                  return inicio <= firstDay && fin >= lastDay;
                });
                const periodIdForMonth = vacationBlockedPeriods.find((p) => {
                  const inicio = (typeof p.fecha_inicio === 'string' ? p.fecha_inicio : p.fecha_inicio?.split?.('T')[0] ?? '').slice(0, 10);
                  const fin = (typeof p.fecha_fin === 'string' ? p.fecha_fin : p.fecha_fin?.split?.('T')[0] ?? '').slice(0, 10);
                  return inicio === firstDay && fin === lastDay;
                })?.id;
                return (
                  <label key={idx} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={!!isBlocked}
                      onChange={async (e) => {
                        setErrorMsg('');
                        if (e.target.checked) {
                          try {
                            await callApi(routes.createVacationBlockedPeriod, {
                              method: 'POST',
                              body: JSON.stringify({ fecha_inicio: firstDay, fecha_fin: lastDay }),
                              headers: { 'Content-Type': 'application/json' },
                            });
                            await fetchVacationBlockedPeriods();
                          } catch (err) {
                            setErrorMsg(err?.message || 'Error al bloquear el mes.');
                          }
                        } else if (periodIdForMonth != null) {
                          try {
                            await callApi(routes.deleteVacationBlockedPeriod(periodIdForMonth), { method: 'DELETE' });
                            await fetchVacationBlockedPeriods();
                          } catch (err) {
                            setErrorMsg(err?.message || 'Error al desbloquear.');
                          }
                        }
                      }}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-gray-700">{name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {/* Intervalo personalizado */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">O añade un intervalo concreto</h4>
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={newBlockedPeriodInicio}
                  onChange={(e) => setNewBlockedPeriodInicio(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={newBlockedPeriodFin}
                  onChange={(e) => setNewBlockedPeriodFin(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!newBlockedPeriodInicio || !newBlockedPeriodFin) {
                    setErrorMsg('Indica desde y hasta.');
                    return;
                  }
                  if (new Date(newBlockedPeriodFin) < new Date(newBlockedPeriodInicio)) {
                    setErrorMsg('La fecha hasta debe ser igual o posterior a desde.');
                    return;
                  }
                  setErrorMsg('');
                  try {
                    await callApi(routes.createVacationBlockedPeriod, {
                      method: 'POST',
                      body: JSON.stringify({ fecha_inicio: newBlockedPeriodInicio, fecha_fin: newBlockedPeriodFin }),
                      headers: { 'Content-Type': 'application/json' },
                    });
                    setNewBlockedPeriodInicio('');
                    setNewBlockedPeriodFin('');
                    await fetchVacationBlockedPeriods();
                  } catch (e) {
                    setErrorMsg(e?.message || 'Error al crear el periodo bloqueado.');
                  }
                }}
                className="px-4 py-2 rounded-lg font-medium bg-amber-500 hover:bg-amber-600 text-white text-sm"
              >
                Añadir periodo
              </button>
            </div>
          </div>
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Periodos bloqueados actuales</h4>
            {vacationBlockedPeriods.length === 0 ? (
              <p className="text-sm text-gray-500">Ninguno. Usa los checkboxes o el intervalo arriba.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {vacationBlockedPeriods.map((p) => {
                  const inicio = typeof p.fecha_inicio === 'string' ? p.fecha_inicio : (p.fecha_inicio?.split?.('T')[0] ?? '');
                  const fin = typeof p.fecha_fin === 'string' ? p.fecha_fin : (p.fecha_fin?.split?.('T')[0] ?? '');
                  return (
                    <li key={p.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                      <span>{inicio} — {fin}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await callApi(routes.deleteVacationBlockedPeriod(p.id), { method: 'DELETE' });
                            await fetchVacationBlockedPeriods();
                          } catch (e) {
                            setErrorMsg(e?.message || 'Error al eliminar.');
                          }
                        }}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Eliminar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Bloquear periodos Asuntos Propios */}
      <Modal
        isOpen={showAsuntoPropioBlockedPeriodsModal}
        onClose={() => {
          setShowAsuntoPropioBlockedPeriodsModal(false);
          setNewApBlockedPeriodInicio('');
          setNewApBlockedPeriodFin('');
        }}
        title="Bloquear periodos para Asuntos Propios"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Las fechas dentro de estos periodos no se podrán solicitar como Asuntos Propios. Puedes bloquear meses enteros con los checkboxes o intervalos concretos abajo (solo afecta a Asuntos Propios, no a vacaciones).
          </p>
          {canAccessAllTabs && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-1">
                Límite diario (toda la empresa)
              </h4>
              <p className="text-xs text-gray-600 mb-2">
                Máximo de personas con Asunto Propio el mismo día. Los empleados ven «poca disponibilidad» en amarillo sin cifras en el calendario.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Personas / día</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={apMaxPersonasDraft}
                    onChange={(e) => setApMaxPersonasDraft(e.target.value)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={savingApMaxPersonas}
                  onClick={async () => {
                    const n = Number(apMaxPersonasDraft);
                    if (!Number.isFinite(n) || n < 1 || n > 50) {
                      setErrorMsg('Indica un valor entre 1 y 50.');
                      return;
                    }
                    setSavingApMaxPersonas(true);
                    setErrorMsg('');
                    try {
                      await callApi(routes.putAsuntosPropiosMaxPorDia, {
                        method: 'PUT',
                        body: JSON.stringify({ max_personas_dia: n }),
                        headers: { 'Content-Type': 'application/json' },
                      });
                      await fetchAsuntosPropiosMaxPorDia();
                      setApMaxPersonasDraft(String(n));
                    } catch (e) {
                      setErrorMsg(e?.message || 'Error al guardar el límite.');
                    } finally {
                      setSavingApMaxPersonas(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg font-medium bg-gray-800 hover:bg-gray-900 text-white text-sm disabled:opacity-50"
                >
                  {savingApMaxPersonas ? 'Guardando…' : 'Guardar límite'}
                </button>
              </div>
            </div>
          )}
          <div className="p-3 bg-violet-50 rounded-xl border border-violet-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Bloquear mes entero</h4>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs font-medium text-gray-600">Año:</label>
              <select
                value={blockedApPeriodsYear}
                onChange={(e) => setBlockedApPeriodsYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {[new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {monthNames.map((name, idx) => {
                const month1 = idx + 1;
                const firstDay = `${blockedApPeriodsYear}-${String(month1).padStart(2, '0')}-01`;
                const lastDay = (() => {
                  const d = new Date(blockedApPeriodsYear, month1, 0);
                  return `${blockedApPeriodsYear}-${String(month1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })();
                const isBlocked = asuntoPropioBlockedPeriods.some((p) => {
                  const inicio = (typeof p.fecha_inicio === 'string' ? p.fecha_inicio : p.fecha_inicio?.split?.('T')[0] ?? '').slice(0, 10);
                  const fin = (typeof p.fecha_fin === 'string' ? p.fecha_fin : p.fecha_fin?.split?.('T')[0] ?? '').slice(0, 10);
                  return inicio <= firstDay && fin >= lastDay;
                });
                const periodIdForMonth = asuntoPropioBlockedPeriods.find((p) => {
                  const inicio = (typeof p.fecha_inicio === 'string' ? p.fecha_inicio : p.fecha_inicio?.split?.('T')[0] ?? '').slice(0, 10);
                  const fin = (typeof p.fecha_fin === 'string' ? p.fecha_fin : p.fecha_fin?.split?.('T')[0] ?? '').slice(0, 10);
                  return inicio === firstDay && fin === lastDay;
                })?.id;
                return (
                  <label key={idx} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={!!isBlocked}
                      onChange={async (e) => {
                        setErrorMsg('');
                        if (e.target.checked) {
                          try {
                            await callApi(routes.createAsuntoPropioBlockedPeriod, {
                              method: 'POST',
                              body: JSON.stringify({ fecha_inicio: firstDay, fecha_fin: lastDay }),
                              headers: { 'Content-Type': 'application/json' },
                            });
                            await fetchAsuntoPropioBlockedPeriods();
                          } catch (err) {
                            setErrorMsg(err?.message || 'Error al bloquear el mes.');
                          }
                        } else if (periodIdForMonth != null) {
                          try {
                            await callApi(routes.deleteAsuntoPropioBlockedPeriod(periodIdForMonth), { method: 'DELETE' });
                            await fetchAsuntoPropioBlockedPeriods();
                          } catch (err) {
                            setErrorMsg(err?.message || 'Error al desbloquear.');
                          }
                        }
                      }}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-gray-700">{name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">O añade un intervalo concreto</h4>
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={newApBlockedPeriodInicio}
                  onChange={(e) => setNewApBlockedPeriodInicio(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={newApBlockedPeriodFin}
                  onChange={(e) => setNewApBlockedPeriodFin(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!newApBlockedPeriodInicio || !newApBlockedPeriodFin) {
                    setErrorMsg('Indica desde y hasta.');
                    return;
                  }
                  if (new Date(newApBlockedPeriodFin) < new Date(newApBlockedPeriodInicio)) {
                    setErrorMsg('La fecha hasta debe ser igual o posterior a desde.');
                    return;
                  }
                  setErrorMsg('');
                  try {
                    await callApi(routes.createAsuntoPropioBlockedPeriod, {
                      method: 'POST',
                      body: JSON.stringify({
                        fecha_inicio: newApBlockedPeriodInicio,
                        fecha_fin: newApBlockedPeriodFin,
                      }),
                      headers: { 'Content-Type': 'application/json' },
                    });
                    setNewApBlockedPeriodInicio('');
                    setNewApBlockedPeriodFin('');
                    await fetchAsuntoPropioBlockedPeriods();
                  } catch (e) {
                    setErrorMsg(e?.message || 'Error al crear el periodo bloqueado.');
                  }
                }}
                className="px-4 py-2 rounded-lg font-medium bg-violet-600 hover:bg-violet-700 text-white text-sm"
              >
                Añadir periodo
              </button>
            </div>
          </div>
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Periodos bloqueados actuales (Asuntos Propios)</h4>
            {asuntoPropioBlockedPeriods.length === 0 ? (
              <p className="text-sm text-gray-500">Ninguno. Usa los checkboxes o el intervalo arriba.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {asuntoPropioBlockedPeriods.map((p) => {
                  const inicio = typeof p.fecha_inicio === 'string' ? p.fecha_inicio : (p.fecha_inicio?.split?.('T')[0] ?? '');
                  const fin = typeof p.fecha_fin === 'string' ? p.fecha_fin : (p.fecha_fin?.split?.('T')[0] ?? '');
                  return (
                    <li key={p.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                      <span>{inicio} — {fin}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await callApi(routes.deleteAsuntoPropioBlockedPeriod(p.id), { method: 'DELETE' });
                            await fetchAsuntoPropioBlockedPeriods();
                          } catch (e) {
                            setErrorMsg(e?.message || 'Error al eliminar.');
                          }
                        }}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Eliminar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal pentru manager să creeze solicitări pentru angajați */}
      <Modal
        isOpen={showManagerSolicitudModal}
        onClose={() => {
          setShowManagerSolicitudModal(false);
          setManagerSelectedEmpleado(null);
          setManagerEmpleadoSearch('');
          setTipo('Asuntos Propios');
          setFechaInicio('');
          setFechaFin('');
          setFechaUltimoDiaTrabajo('');
          setMotivo('');
          setTipoJustificante('');
          setHoraCita('');
          setCentroMedico('');
          setDescripcionOtro('');
          setArchivoJustificante(null);
          setManagerAutoApprove(true);
        }}
        title="Crear Solicitud para Empleado"
        size="lg"
      >
        <div className="space-y-6">
          {/* Selector de angajat */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Empleado <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={managerEmpleadoSearch}
                onChange={(e) => {
                  setManagerEmpleadoSearch(e.target.value);
                  setManagerShowEmpleadoDropdown(true);
                }}
                onFocus={() => setManagerShowEmpleadoDropdown(true)}
                placeholder="Buscar por nombre, código o email..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {managerShowEmpleadoDropdown && managerEmpleadoOptions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {managerEmpleadoOptions.map((emp) => (
                    <button
                      key={emp.codigo || emp.email}
                      type="button"
                      onClick={() => {
                        setManagerSelectedEmpleado(emp);
                        setManagerEmpleadoSearch(emp.name);
                        setManagerShowEmpleadoDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{emp.name}</div>
                      <div className="text-sm text-gray-500">{emp.codigo} • {emp.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {managerSelectedEmpleado && (
              <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-indigo-900">{managerSelectedEmpleado.name}</div>
                    <div className="text-sm text-indigo-700">{managerSelectedEmpleado.codigo} • {managerSelectedEmpleado.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManagerSelectedEmpleado(null);
                      setManagerEmpleadoSearch('');
                    }}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tip solicitare */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Solicitud <span className="text-red-500">*</span>
            </label>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setFechaInicio('');
                setFechaFin('');
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Asuntos Propios">📅 Asuntos Propios</option>
              <option value="Vacaciones">🏖️ Vacaciones</option>
              <option value="BAJA_VOLUNTARIA">🚪 Baja Voluntaria</option>
              <option value="Permiso Retribuido">💼 Permiso Retribuido</option>
              <option value="Ausencias justificada">🩺 Ausencias justificada</option>
            </select>
          </div>

          {/* Date - doar pentru tipuri care necesită date */}
          {tipo !== 'BAJA_VOLUNTARIA' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  min={fechaInicio}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {/* Fecha último día de trabajo pentru BAJA_VOLUNTARIA */}
          {tipo === 'BAJA_VOLUNTARIA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Último Día de Trabajo <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fechaUltimoDiaTrabajo}
                onChange={(e) => setFechaUltimoDiaTrabajo(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Describe el motivo de la solicitud (opcional)..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Checkbox Aprobar automáticamente */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="manager-auto-approve"
              checked={managerAutoApprove}
              onChange={(e) => setManagerAutoApprove(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="manager-auto-approve" className="text-sm font-medium text-gray-700">
              Aprobar automáticamente
            </label>
          </div>

          {/* Mesaje de eroare/succes */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {successMsg}
            </div>
          )}

          {/* Butoane */}
          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowManagerSolicitudModal(false);
                setManagerSelectedEmpleado(null);
                setManagerEmpleadoSearch('');
                setTipo('Asuntos Propios');
                setFechaInicio('');
                setFechaFin('');
                setFechaUltimoDiaTrabajo('');
                setMotivo('');
                setTipoJustificante('');
                setHoraCita('');
                setCentroMedico('');
                setDescripcionOtro('');
                setArchivoJustificante(null);
                setManagerAutoApprove(true);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              disabled={isOperationLoading('submit-manager')}
              className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddManagerSolicitud}
              disabled={isOperationLoading('submit-manager') || !managerSelectedEmpleado}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('submit-manager') ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creando...
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Crear Solicitud</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 
