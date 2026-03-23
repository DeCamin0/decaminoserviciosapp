import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import ConfirmModal from './ui/ConfirmModal';
import './ChatBot.css';
import { config } from '../config/env.js';
import { buildAssistantPremiumFooter } from '../utils/assistantPremiumMeta.js';
import {
  pickCuadranteResumenRow,
  buildCuadranteDetallePorDiaRows,
} from '../utils/cuadranteExportHelpers.js';

/**
 * El asistente a veces devuelve tablas como array y a veces como objeto compuesto
 * (p. ej. SOLICITUDES: solicitudes + ausencias_calendario).
 * @returns {{ sections: { title: string | null, rows: Record<string, unknown>[] }[] }}
 */
function parseAssistantExportPayload(datos) {
  if (datos == null) {
    return { sections: [] };
  }
  if (Array.isArray(datos)) {
    const rows = datos.filter((r) => r && typeof r === 'object' && !Array.isArray(r));
    return rows.length ? { sections: [{ title: null, rows }] } : { sections: [] };
  }
  if (typeof datos === 'object') {
    const ordered = [
      ['solicitudes', 'Solicitudes'],
      ['ausencias_calendario', 'Ausencias (calendario)'],
      ['ausencias', 'Ausencias'],
    ];
    const sections = [];
    const used = new Set();
    for (const [key, label] of ordered) {
      const arr = datos[key];
      if (Array.isArray(arr) && arr.length && arr[0] && typeof arr[0] === 'object') {
        sections.push({ title: label, rows: arr });
        used.add(key);
      }
    }
    for (const [key, val] of Object.entries(datos)) {
      if (used.has(key)) continue;
      if (Array.isArray(val) && val.length && val[0] && typeof val[0] === 'object') {
        sections.push({ title: key, rows: val });
      }
    }
    return { sections };
  }
  return { sections: [] };
}

const rawColor = config.PRIMARY_COLOR || '#E53935';
const PRIMARY_COLOR = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;

/** Log lizibil în consolă (dev / DEBUG_MODE); evită obiecte colapsate „Object”. */
function logAssistantDev(label, payload) {
  if (!(import.meta.env.DEV || config.DEBUG_MODE)) return;
  try {
    const s =
      typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    console.log(`[ChatBot Assistant] ${label}\n${s}`);
  } catch {
    console.log(`[ChatBot Assistant] ${label}`, payload);
  }
}

// Helper functions pentru conversie culori
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

/** Sugestii pentru empty / welcome (doar UI; umplu inputul, utilizatorul poate enviar). */
const ASSISTANT_SUGGESTION_CHIPS = [
  '¿Cuál es mi horario este mes?',
  '¿Cómo registro la jornada?',
  '¿Cómo solicito vacaciones?',
  'Resumen de mi cuadrante',
];

/** API archive → mensajes UI (sin react-chatbot-kit). */
function mapArchiveToUiMessages(apiMessages) {
  if (!apiMessages?.length) return [];
  let n = 0;
  return apiMessages.map((m) => {
    const role = m.role === 'user' ? 'user' : 'assistant';
    const text = typeof m.content === 'string' ? m.content : '';
    const serverMessageId =
      role === 'assistant' && m.id && typeof m.id === 'string' ? m.id : undefined;
    return { id: `arch-${++n}`, role, text, serverMessageId };
  });
}

function formatAssistantMsgTime(ts) {
  if (ts == null) return '';
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const ChatBot = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const conversationIdRef = useRef(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [threadKey, setThreadKey] = useState(0);
  /** @type {[Array<{id: string, role: 'user'|'assistant', text: string, pending?: boolean, acciones?: unknown[], createdAt?: number, serverMessageId?: string, feedbackSubmitted?: boolean, feedbackRating?: 'positive'|'negative', feedbackSubmitting?: boolean, feedbackNegativeOpen?: boolean, feedbackCommentDraft?: string}>|null, Function]} */
  const [threadBootstrap, setThreadBootstrap] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef(null);

  // Setează CSS variables pentru culori branding
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', PRIMARY_COLOR);
    // Calculează culori derivate pentru gradient
    const primaryRgb = hexToRgb(PRIMARY_COLOR);
    if (primaryRgb) {
      const darker = rgbToHex(
        Math.max(0, primaryRgb.r - 20),
        Math.max(0, primaryRgb.g - 20),
        Math.max(0, primaryRgb.b - 20)
      );
      const darkest = rgbToHex(
        Math.max(0, primaryRgb.r - 40),
        Math.max(0, primaryRgb.g - 40),
        Math.max(0, primaryRgb.b - 40)
      );
      document.documentElement.style.setProperty('--primary-color-darker', darker);
      document.documentElement.style.setProperty('--primary-color-darkest', darkest);
      document.documentElement.style.setProperty('--primary-color-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
      // Setează rgba variants pentru box-shadow
      document.documentElement.style.setProperty('--primary-color-rgba-05', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.5)`);
      document.documentElement.style.setProperty('--primary-color-rgba-06', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.6)`);
      document.documentElement.style.setProperty('--primary-color-rgba-02', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`);
      document.documentElement.style.setProperty('--primary-color-rgba-04', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.4)`);
      document.documentElement.style.setProperty('--primary-color-rgba-01', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`);
    }
  }, []);

  // Extrage numele utilizatorului
  const userName = user?.['NOMBRE / APELLIDOS'] || user?.name || 'Utilizator';

  const refreshConversations = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const res = await fetch(routes.assistantConversations, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (e) {
      console.warn('Istoric conversații:', e);
    }
  }, []);

  const toggleHistorySidebar = useCallback(() => {
    setHistoryOpen((o) => {
      const next = !o;
      if (next) {
        refreshConversations();
      }
      return next;
    });
  }, [refreshConversations]);

  const loadArchivedConversation = useCallback(async (conversationId) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setHistoryLoading(true);
    setMessages([]);
    try {
      const res = await fetch(routes.assistantConversationMessages(conversationId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const initial = mapArchiveToUiMessages(data.messages);
      if (initial.length) {
        conversationIdRef.current = conversationId;
        setActiveHistoryId(conversationId);
        setThreadBootstrap(initial);
        setThreadKey((k) => k + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    conversationIdRef.current = null;
    setActiveHistoryId(null);
    setThreadBootstrap(null);
    setInputValue('');
    setThreadKey((k) => k + 1);
  }, []);

  const [deletingAllHistory, setDeletingAllHistory] = useState(false);
  const [showPurgeHistoryModal, setShowPurgeHistoryModal] = useState(false);
  const [purgeErrorToast, setPurgeErrorToast] = useState(null);

  useEffect(() => {
    if (!purgeErrorToast) return;
    const t = window.setTimeout(() => setPurgeErrorToast(null), 6000);
    return () => clearTimeout(t);
  }, [purgeErrorToast]);

  const performPurgeAllAssistantHistory = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setDeletingAllHistory(true);
    try {
      const res = await fetch(routes.assistantConversations, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `HTTP ${res.status}`);
      }
      conversationIdRef.current = null;
      setActiveHistoryId(null);
      setThreadBootstrap(null);
      setInputValue('');
      setConversations([]);
      setThreadKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      setPurgeErrorToast(
        'No se pudo borrar el historial. Inténtalo de nuevo o contacta con administración.',
      );
    } finally {
      setDeletingAllHistory(false);
    }
  }, []);

  const isManagerOrSupervisor =
    user?.GRUPO === 'Manager' ||
    user?.GRUPO === 'Supervisor' ||
    user?.GRUPO === 'Developer' ||
    user?.GRUPO === 'Admin' ||
    user?.GRUPO === 'Jefe' ||
    user?.isManager;

  const estadoUpper = String(user?.ESTADO || '').toUpperCase();
  const isActiveUser =
    !user?.ESTADO || estadoUpper === 'ACTIVO' || estadoUpper === 'ACTIVE';

  const canUseAssistantAsEmployee =
    Boolean(config.ASSISTANT_FOR_EMPLOYEES) && isActiveUser;

  const shouldShowAssistant =
    Boolean(user) && (isManagerOrSupervisor || canUseAssistantAsEmployee);

  useEffect(() => {
    if (shouldShowAssistant) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [shouldShowAssistant]);

  useEffect(() => {
    if (Array.isArray(threadBootstrap) && threadBootstrap.length > 0) {
      setMessages(threadBootstrap);
    } else {
      setMessages([]);
    }
  }, [threadKey, threadBootstrap]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isOpen, messages, threadKey]);

  // Funcție pentru procesarea mesajelor
  const handleUserMessage = async (message) => {
    try {
      const requestData = {
        mensaje: message,
        ...(conversationIdRef.current
          ? { conversationId: conversationIdRef.current }
          : {}),
        usuario: {
          id: user?.CODIGO || user?.id || 'N/A',
          nombre: user?.['NOMBRE / APELLIDOS'] || user?.name || 'Utilizator',
          rol: user?.GRUPO || user?.role || 'manager'
        }
      };

      logAssistantDev('REQUEST', {
        mensaje: requestData.mensaje,
        conversationId: requestData.conversationId ?? null,
        usuarioCodigo: requestData.usuario?.id,
        usuarioRol: requestData.usuario?.rol,
      });

      // Obține JWT token pentru autentificare
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.chatAI, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      try {
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = text;
        }
      } catch {
        data = await response.text().catch(() => null);
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        logAssistantDev('RESPONSE_SNAPSHOT', {
          conversationId: data.conversationId,
          assistantMessageId: data.assistantMessageId,
          status: data.status,
          responseType: data.responseType,
          sources: data.sources,
          confianza: data.confianza,
          respuestaLength: (data.respuesta || '').length,
          respuestaPreview: String(data.respuesta || '').slice(0, 600),
          accionesCount: Array.isArray(data.acciones) ? data.acciones.length : 0,
          accionesTipos: Array.isArray(data.acciones)
            ? data.acciones.map((a) => a?.tipo)
            : [],
        });
      } else {
        logAssistantDev('RESPONSE_RAW', {
          type: typeof data,
          preview:
            typeof data === 'string'
              ? data.slice(0, 1200)
              : JSON.stringify(data).slice(0, 1200),
        });
      }

      if (data && typeof data === 'object' && !Array.isArray(data) && data.conversationId) {
        conversationIdRef.current = data.conversationId;
      }

      // Procesare flexibilă a răspunsului
      let aiResponse = '';
      let acciones = [];
      
      if (data) {
        // Extrage acțiunile dacă există
        if (data.acciones && Array.isArray(data.acciones)) {
          acciones = data.acciones;
          logAssistantDev('ACCIONES', { count: acciones.length, acciones });
        } else {
          logAssistantDev('ACCIONES', { count: 0, note: 'no acciones array' });
        }
        
        // Încearcă diferite formate posibile
        if (typeof data === 'string') {
          aiResponse = data;
        } else if (data.respuesta) {
          aiResponse = data.respuesta;
        } else if (data.message) {
          aiResponse = data.message;
        } else if (data.content) {
          aiResponse = data.content;
        } else if (data.text) {
          aiResponse = data.text;
        } else if (data.choices && data.choices[0] && data.choices[0].message) {
          aiResponse = data.choices[0].message.content;
        } else {
          aiResponse = JSON.stringify(data);
        }
      }

      // Curăță răspunsul de HTML/iframe
      if (aiResponse && aiResponse.includes('<iframe')) {
        const textMatch = aiResponse.match(/srcdoc="([^"]+)"/);
        if (textMatch && textMatch[1]) {
          aiResponse = textMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        } else {
          aiResponse = aiResponse.replace(/<[^>]*>/g, '').trim();
        }
      }
      
      // Curăță și alte tag-uri HTML
      if (aiResponse) {
        aiResponse = aiResponse
          .replace(/<[^>]*>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
      }

      const mainText =
        aiResponse ||
        '❌ No he podido procesar la respuesta del AI. Por favor, intenta de nuevo.';

      const premiumFooter =
        data && typeof data === 'object' && !Array.isArray(data)
          ? buildAssistantPremiumFooter(data)
          : '';

      const assistantMessageId =
        data &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        data.assistantMessageId &&
        typeof data.assistantMessageId === 'string'
          ? data.assistantMessageId
          : undefined;

      return {
        respuesta: mainText + premiumFooter,
        acciones,
        assistantMessageId,
      };

    } catch (error) {
      console.error('❌ Eroare la trimiterea mesajului:', error);
      
      let errorMessage = '❌ Error al comunicarse con el AI.';
      
      if (error.message?.includes('HTTP')) {
        errorMessage = `❌ ${error.message}`;
      } else if (error.name === 'AbortError') {
        errorMessage = '⏰ Timeout - la respuesta tardó demasiado. Por favor, intenta de nuevo.';
      }
      
      return errorMessage;
    }
  };

  const submitAssistantFeedback = useCallback(
    async (uiMessageId, serverMessageId, rating, comment) => {
      const token = localStorage.getItem('auth_token');
      if (!token || !serverMessageId) return;
      setMessages((prev) =>
        prev.map((x) =>
          x.id === uiMessageId ? { ...x, feedbackSubmitting: true } : x,
        ),
      );
      try {
        const res = await fetch(routes.assistantMessageFeedback(serverMessageId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rating,
            ...(comment && String(comment).trim()
              ? { comment: String(comment).trim() }
              : {}),
          }),
        });
        if (res.status === 409) {
          setMessages((prev) =>
            prev.map((x) =>
              x.id === uiMessageId
                ? {
                    ...x,
                    feedbackSubmitting: false,
                    feedbackSubmitted: true,
                    feedbackRating: rating,
                    feedbackNegativeOpen: false,
                    feedbackCommentDraft: undefined,
                  }
                : x,
            ),
          );
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        setMessages((prev) =>
          prev.map((x) =>
            x.id === uiMessageId
              ? {
                  ...x,
                  feedbackSubmitting: false,
                  feedbackSubmitted: true,
                  feedbackRating: rating,
                  feedbackNegativeOpen: false,
                  feedbackCommentDraft: undefined,
                }
              : x,
          ),
        );
      } catch (e) {
        console.error('Feedback asistente:', e);
        setMessages((prev) =>
          prev.map((x) =>
            x.id === uiMessageId ? { ...x, feedbackSubmitting: false } : x,
          ),
        );
      }
    },
    [],
  );

  // Funcție pentru descărcare Excel
  const downloadAsExcel = useCallback(async (datos, intent) => {
    // Import dinamic pentru exceljs (dacă nu e deja importat)
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();

    if (intent === 'cuadrante' && datos?.length) {
      const resumen = datos.map((r) => pickCuadranteResumenRow(r));
      const detalle = buildCuadranteDetallePorDiaRows(datos);
      const wsR = workbook.addWorksheet('Resumen');
      if (resumen.length) {
        const h = Object.keys(resumen[0]);
        wsR.addRow(h);
        resumen.forEach((item) => wsR.addRow(h.map((k) => item[k] ?? '')));
      }
      const wsD = workbook.addWorksheet('Por día');
      if (detalle.length) {
        const hd = Object.keys(detalle[0]);
        wsD.addRow(hd);
        detalle.forEach((item) => wsD.addRow(hd.map((k) => item[k] ?? '')));
      }
    } else {
      const { sections } = parseAssistantExportPayload(datos);
      const nonEmpty = sections.filter((s) => s.rows?.length);
      if (nonEmpty.length === 0) {
        workbook.addWorksheet(intent === 'pedidos' ? 'Pedidos' : 'Datos');
      } else if (nonEmpty.length === 1) {
        const { title, rows } = nonEmpty[0];
        const sheetName = (title || (intent === 'pedidos' ? 'Pedidos' : 'Datos')).slice(
          0,
          31,
        );
        const worksheet = workbook.addWorksheet(sheetName);
        const headers = Object.keys(rows[0]);
        worksheet.addRow(headers);
        rows.forEach((item) => {
          worksheet.addRow(headers.map((header) => item[header] ?? ''));
        });
      } else {
        for (const { title, rows } of nonEmpty) {
          const safe = String(title || 'Datos')
            .replace(/[:\\/?*[\]]/g, '_')
            .slice(0, 31);
          const ws = workbook.addWorksheet(safe);
          const headers = Object.keys(rows[0]);
          ws.addRow(headers);
          rows.forEach((item) => {
            ws.addRow(headers.map((header) => item[header] ?? ''));
          });
        }
      }
    }

    // Generează buffer și descarcă
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const day = new Date().toISOString().split('T')[0];
    link.download =
      intent === 'cuadrante'
        ? `mi_horario_cuadrante_${day}.xlsx`
        : `registros_${intent}_${day}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  // Funcție pentru descărcare TXT
  const downloadAsTxt = useCallback((datos, intent) => {
    let content = '';
    if (intent === 'cuadrante') {
      if (!Array.isArray(datos) || datos.length === 0) return;
      const resumen = datos.map((r) => pickCuadranteResumenRow(r));
      const detalle = buildCuadranteDetallePorDiaRows(datos);
      content += 'Resumen (mes / total)\n';
      if (resumen.length) {
        const h = Object.keys(resumen[0]);
        content += h.join('\t') + '\n';
        resumen.forEach((item) => {
          content += h.map((k) => item[k] ?? '').join('\t') + '\n';
        });
      }
      content += '\nDetalle por día\n';
      if (detalle.length) {
        const hd = Object.keys(detalle[0]);
        content += hd.join('\t') + '\n';
        detalle.forEach((item) => {
          content += hd.map((k) => item[k] ?? '').join('\t') + '\n';
        });
      }
    } else {
      const { sections } = parseAssistantExportPayload(datos);
      const nonEmpty = sections.filter((s) => s.rows?.length);
      if (!nonEmpty.length) return;
      for (const { title, rows } of nonEmpty) {
        if (title) content += `${title}\n`;
        const headers = Object.keys(rows[0]);
        content += headers.join('\t') + '\n';
        rows.forEach((item) => {
          content += headers.map((header) => item[header] ?? '').join('\t') + '\n';
        });
        content += '\n';
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const day = new Date().toISOString().split('T')[0];
    link.download =
      intent === 'cuadrante'
        ? `mi_horario_cuadrante_${day}.txt`
        : `registros_${intent}_${day}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  // Funcție pentru descărcare PDF (tabele late: landscape + coloane proporționale + wrap)
  const downloadAsPdf = useCallback(async (datos, intent) => {
    try {
      const { jsPDF } = await import('jspdf');
      const isCuadrante = intent === 'cuadrante';
      const isPedidos = intent === 'pedidos';
      const sectionsNonCuadrante = isCuadrante
        ? []
        : parseAssistantExportPayload(datos).sections.filter((s) => s.rows?.length);
      const cuadranteRows = isCuadrante && Array.isArray(datos) ? datos : [];
      const sampleForHeaders = isCuadrante
        ? cuadranteRows
        : sectionsNonCuadrante[0]?.rows || [];
      const headers =
        sampleForHeaders.length > 0 ? Object.keys(sampleForHeaders[0]) : [];
      const manyCols = headers.length > 6;
      const doc = new jsPDF({
        orientation: manyCols || isCuadrante || isPedidos ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const usableW = pageW - 2 * margin;
      const title =
        intent === 'cuadrante'
          ? 'Plan de trabajo / cuadrante (asistente)'
          : intent === 'pedidos'
            ? 'Pedidos de material / catálogo'
            : `Registros de ${intent}`;
      const lineH = 3.8;
      const fontTitle = 13;
      const fontTable = manyCols || isCuadrante || isPedidos ? 7 : 8;

      doc.setFontSize(fontTitle);
      doc.setFont(undefined, 'bold');
      doc.text(title, margin, margin + 4);

      const hasCuadranteData = isCuadrante && cuadranteRows.length > 0;
      const hasGenericData = !isCuadrante && sectionsNonCuadrante.length > 0;
      if (!hasCuadranteData && !hasGenericData) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Sin datos.', margin, margin + 14);
        const day = new Date().toISOString().split('T')[0];
        doc.save(
          intent === 'cuadrante'
            ? `mi_horario_cuadrante_${day}.pdf`
            : intent === 'pedidos'
              ? `mis_pedidos_${day}.pdf`
              : `registros_${intent}_${day}.pdf`,
        );
        return;
      }

      const bottomSafe = pageH - margin - 8;

      /** @param {Record<string, unknown>[]} tableDatos @param {number} y0 */
      const renderPdfTable = (tableDatos, y0, rowLimit = 200) => {
        if (!tableDatos?.length) return y0;
        const hdrs = Object.keys(tableDatos[0]);
        const maxRows = Math.min(rowLimit, tableDatos.length);
        const tableRows = tableDatos.slice(0, maxRows);

        const charUnit = 0.42;
        const weights = hdrs.map((h) => {
          let n = String(h).length;
          for (const item of tableRows) {
            n = Math.max(n, String(item[h] ?? '').length);
          }
          return Math.min(n * charUnit + 3, 55);
        });
        const sumW = weights.reduce((a, b) => a + b, 0) || 1;
        let colWidths = weights.map((w) => (w / sumW) * usableW);
        const minColMm = 9;
        colWidths = colWidths.map((w) => Math.max(w, minColMm));
        let widthSum = colWidths.reduce((a, b) => a + b, 0);
        if (widthSum > usableW) {
          colWidths = colWidths.map((w) => (w / widthSum) * usableW);
          widthSum = usableW;
        }

        doc.setFontSize(fontTable);
        doc.setFont(undefined, 'bold');
        const headerLineCounts = hdrs.map((h, i) =>
          doc.splitTextToSize(String(h), colWidths[i] - 1.5).length,
        );
        const headerBlockH = Math.max(...headerLineCounts, 1) * lineH + 2;

        doc.setDrawColor(180);
        doc.setLineWidth(0.1);

        const drawHeaderRow = (yy0) => {
          let x = margin;
          doc.setFontSize(fontTable);
          doc.setFont(undefined, 'bold');
          hdrs.forEach((header, i) => {
            const w = colWidths[i];
            const lines = doc.splitTextToSize(String(header), w - 1.5);
            doc.rect(x, yy0 - lineH + 1, w, headerBlockH);
            let yy = yy0;
            lines.forEach((ln) => {
              doc.text(ln, x + 0.8, yy);
              yy += lineH;
            });
            x += w;
          });
          return yy0 + headerBlockH;
        };

        let yPos = drawHeaderRow(y0);
        doc.setFont(undefined, 'normal');

        tableRows.forEach((item) => {
          const cellBlocks = hdrs.map((h, i) => {
            const w = colWidths[i];
            return doc.splitTextToSize(String(item[h] ?? ''), w - 1.5);
          });
          const rowH =
            Math.max(...cellBlocks.map((lines) => lines.length), 1) * lineH + 2;

          if (yPos + rowH > bottomSafe) {
            doc.addPage();
            yPos = drawHeaderRow(margin + 10);
          }

          let x = margin;
          hdrs.forEach((h, i) => {
            const w = colWidths[i];
            doc.rect(x, yPos - lineH + 1, w, rowH);
            const lines = cellBlocks[i];
            let yy = yPos;
            lines.forEach((ln) => {
              doc.text(ln, x + 0.8, yy);
              yy += lineH;
            });
            x += w;
          });
          yPos += rowH;
        });

        if (tableDatos.length > maxRows) {
          doc.setFontSize(8);
          doc.text(
            `… y ${tableDatos.length - maxRows} registros más`,
            margin,
            Math.min(yPos + 6, bottomSafe),
          );
          yPos += 8;
        }
        return yPos;
      };

      if (isCuadrante) {
        const resumenRows = cuadranteRows.map((r) => pickCuadranteResumenRow(r));
        const detalleRows = buildCuadranteDetallePorDiaRows(cuadranteRows);
        const yAfterResumen = renderPdfTable(resumenRows, margin + 14, 80);
        let yNext = yAfterResumen + 8;
        if (yNext > bottomSafe - 16) {
          doc.addPage();
          yNext = margin + 10;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Detalle por día', margin, yNext);
        doc.setFont(undefined, 'normal');
        renderPdfTable(detalleRows, yNext + 6, 500);
      } else if (sectionsNonCuadrante.length === 1) {
        renderPdfTable(sectionsNonCuadrante[0].rows, margin + 14, 80);
      } else {
        let yPos = margin + 14;
        for (const { title, rows } of sectionsNonCuadrante) {
          if (!rows?.length) continue;
          if (yPos > bottomSafe - 28) {
            doc.addPage();
            yPos = margin + 10;
          }
          if (title) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(String(title), margin, yPos);
            doc.setFont(undefined, 'normal');
            yPos += 6;
          }
          yPos = renderPdfTable(rows, yPos, 80);
          yPos += 6;
        }
      }

      const day = new Date().toISOString().split('T')[0];
      doc.save(
        intent === 'cuadrante'
          ? `mi_horario_cuadrante_${day}.pdf`
          : intent === 'pedidos'
            ? `mis_pedidos_${day}.pdf`
            : `registros_${intent}_${day}.pdf`,
      );
    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      downloadAsTxt(datos, intent);
    }
  }, [downloadAsTxt]);

  // Descărcare nómina: GET /api/nominas/download?id=&nombre= cu JWT
  const downloadNominasFromAssistant = useCallback(async (items) => {
    const token = localStorage.getItem('auth_token');
    if (!items?.length) {
      window.location.href = '/documentos-empleados';
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const id = it?.id;
      if (id == null || id === '') continue;
      const nombre = String(it?.nombre ?? '');
      const q = new URLSearchParams({
        id: String(id),
        nombre,
      });
      const url = `${routes.downloadNomina}?${q.toString()}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Descarga nómina ${id}: HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition');
      let filename = `nomina_${id}.pdf`;
      const m = dispo && /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(dispo);
      if (m) {
        try {
          filename = decodeURIComponent(m[1].trim());
        } catch {
          filename = m[1].trim();
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      if (items.length > 1 && i < items.length - 1) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }, []);

  // Funcție pentru descărcare Excel/TXT/PDF
  const handleDownload = useCallback(async (accion) => {
    const { payload } = accion || {};
    if (accion?.tipo === 'ver_cuadrante' || payload?.tipo === 'cuadrante') {
      window.location.href = '/cuadrantes-empleado';
      return;
    }
    if (accion?.tipo === 'ver_pedidos' || payload?.tipo === 'pedidos') {
      window.location.href = payload?.href || '/empleado-pedidos';
      return;
    }
    if (accion?.tipo === 'descargar_nomina') {
      try {
        await downloadNominasFromAssistant(payload?.items);
      } catch (error) {
        console.error('❌ Error al descargar nómina(s):', error);
        alert(
          error?.message ||
            'No se pudo descargar la nómina. Prueba desde Documentos del empleado.',
        );
      }
      return;
    }

    const { exportData, datos, formato, intent } = payload || {};
    /** Backend envía `exportData` (dataset completo); `datos` es alias legacy. */
    const datasetCompleto = exportData ?? datos;

    if (
      (formato === 'excel' || formato === 'txt' || formato === 'pdf') &&
      datasetCompleto === undefined
    ) {
      alert('No hay datos para exportar.');
      return;
    }

    try {
      if (formato === 'excel') {
        await downloadAsExcel(datasetCompleto, intent);
      } else if (formato === 'txt') {
        await downloadAsTxt(datasetCompleto, intent);
      } else if (formato === 'pdf') {
        await downloadAsPdf(datasetCompleto, intent);
      }
    } catch (error) {
      console.error('❌ Error al descargar:', error);
      alert('Error al generar el archivo. Por favor, intenta de nuevo.');
    }
  }, [downloadAsExcel, downloadAsTxt, downloadAsPdf, downloadNominasFromAssistant]);

  /** @param {string} [presetText] - desde chip sugerencia: envía ese texto sin depender del estado del input (evita batching). */
  const sendAssistantMessage = async (presetText) => {
    const text = (typeof presetText === 'string' ? presetText : inputValue).trim();
    if (!text || sending) return;
    const now = Date.now();
    const uid = `u-${now}`;
    const bid = `b-${now}`;
    setSending(true);
    setInputValue('');
    setMessages((prev) => [
      ...prev,
      { id: uid, role: 'user', text, createdAt: now },
      {
        id: bid,
        role: 'assistant',
        text: '⏳ Procesando mensaje...',
        pending: true,
        createdAt: now,
      },
    ]);

    try {
      const response = await handleUserMessage(text);
      let respuestaText = '';
      let acciones = [];
      let assistantMessageId;
      if (typeof response === 'string') {
        respuestaText = response;
      } else if (response && response.respuesta) {
        respuestaText = response.respuesta;
        acciones = response.acciones || [];
        assistantMessageId = response.assistantMessageId;
      } else {
        respuestaText = 'Error procesando respuesta';
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === bid
            ? {
                ...m,
                text: respuestaText,
                pending: false,
                acciones,
                createdAt: Date.now(),
                ...(assistantMessageId
                  ? { serverMessageId: assistantMessageId }
                  : {}),
              }
            : m,
        ),
      );
    } catch (e) {
      console.error(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === bid
            ? {
                ...m,
                text: '❌ Error inesperado. Intenta de nuevo.',
                pending: false,
              }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAssistantMessage(undefined);
    }
  };

  const logoSrc = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.hostname.includes('ngrok')) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo=';
    }
    const basePath = config.BASE_PATH || '/';
    const logoPath = config.LOGO_PATH || 'logo.svg';
    return `${basePath}${logoPath}`.replace(/\/+/g, '/');
  }, []);

  if (config.DEBUG_MODE) {
    console.log('🎯 ChatBot Render:', { isVisible, shouldShowAssistant, isOpen });
  }

  if (!isVisible) {
    if (config.DEBUG_MODE) {
      console.log('❌ ChatBot nu este vizibil');
    }
    return null;
  }

  if (config.DEBUG_MODE) {
    console.log('✅ ChatBot se randează');
  }

  return (
    <div className={`ast-root${isOpen ? ' ast-root--open' : ''}`}>
      <button
        type="button"
        className="ast-fab"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente'}
      >
        <span className="ast-fab__icon" aria-hidden>
          {isOpen ? '✕' : '💬'}
        </span>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="ast-scrim"
            aria-label="Cerrar asistente"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`ast-panel${historyOpen ? ' ast-panel--with-history' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Asistente del portal"
          >
            <header className="ast-header">
              <button
                type="button"
                className="ast-header__close-touch"
                aria-label="Cerrar asistente"
                onClick={() => {
                  setHistoryOpen(false);
                  setIsOpen(false);
                }}
              >
                <span aria-hidden>✕</span>
              </button>
              <div className="ast-header__text">
                <div className="ast-header__row">
                  <h2 className="ast-header__title">Asistente</h2>
                  <span className="ast-header__badge">
                    {config.APP_NAME || config.COMPANY_NAME || 'Portal'}
                  </span>
                </div>
                <p className="ast-header__subtitle">
                  Horarios, fichajes, vacaciones y trámites. Las respuestas dependen de tu rol.
                </p>
              </div>
              <div className="ast-header__right">
                <div className="ast-header__actions">
                  <button
                    type="button"
                    className={`ast-btn ast-btn--ghost${historyOpen ? ' is-active' : ''}`}
                    onClick={toggleHistorySidebar}
                  >
                    {historyOpen ? 'Cerrar' : 'Historial'}
                  </button>
                  <button type="button" className="ast-btn ast-btn--solid" onClick={startNewChat}>
                    Chat nuevo
                  </button>
                </div>
                <img
                  src={logoSrc}
                  alt=""
                  className="ast-header__logo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            </header>

            <div className="ast-body">
              {historyOpen && (
                <button
                  type="button"
                  className="ast-history-scrim"
                  aria-label="Cerrar historial"
                  onClick={() => setHistoryOpen(false)}
                />
              )}
              {historyOpen && (
                <aside className="ast-history" aria-label="Conversaciones guardadas">
                  <div className="ast-history__head">
                    <h3 className="ast-history__title">Conversaciones</h3>
                    <p className="ast-history__hint">Elige una para continuar</p>
                    <button
                      type="button"
                      className="ast-history__purge"
                      disabled={deletingAllHistory || conversations.length === 0}
                      onClick={() => setShowPurgeHistoryModal(true)}
                    >
                      {deletingAllHistory
                        ? 'Borrando…'
                        : 'Borrar todo el historial'}
                    </button>
                  </div>
                  {historyLoading && <div className="ast-history__status">Cargando…</div>}
                  {!historyLoading && conversations.length === 0 && (
                    <div className="ast-history__empty">Aún no hay conversaciones guardadas.</div>
                  )}
                  <div className="ast-history__list">
                    {conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`ast-history__item${
                          activeHistoryId === c.id ? ' ast-history__item--active' : ''
                        }`}
                        onClick={() => loadArchivedConversation(c.id)}
                      >
                        <span className="ast-history__item-title">
                          {c.title || 'Conversación'}
                        </span>
                        <span className="ast-history__item-meta">
                          {c.updatedAt
                            ? new Date(c.updatedAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>
              )}

              <div className="ast-main">
                <div
                  ref={messagesContainerRef}
                  className="ast-messages"
                  aria-live="polite"
                >
                  {historyLoading ? (
                    <div className="ast-messages__loading" role="status">
                      Cargando conversación…
                    </div>
                  ) : null}

                  {!historyLoading && messages.length === 0 ? (
                    <div className="ast-empty">
                      <div className="ast-empty__card">
                        <p className="ast-empty__greeting">
                          ¡Hola, <strong>{userName}</strong>!
                        </p>
                        <p className="ast-empty__lead">
                          Pregunta con lenguaje natural: horarios, fichajes, vacaciones o documentos.
                          Las respuestas respetan tu rol en el portal.
                        </p>
                        <p className="ast-empty__hint">Prueba con:</p>
                        <div className="ast-chips" role="group" aria-label="Sugerencias">
                          {ASSISTANT_SUGGESTION_CHIPS.map((label) => (
                            <button
                              key={label}
                              type="button"
                              className="ast-chip"
                              onClick={() => setInputValue(label)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ul className="ast-msg-list">
                      {messages.map((m) => (
                        <li key={m.id} className={`ast-msg ast-msg--${m.role}`}>
                          <div className="ast-msg__bubble">
                            <div className="ast-msg__body ast-msg__body--pre">{m.text}</div>
                            {m.role === 'assistant' &&
                            Array.isArray(m.acciones) &&
                            m.acciones.length > 0 ? (
                              <div className="ast-msg__actions">
                                {m.acciones.map((accion, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    className="ast-action-btn"
                                    onClick={() => handleDownload(accion)}
                                  >
                                    {accion.label || `Acción ${idx + 1}`}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {m.role === 'assistant' &&
                          !m.pending &&
                          m.serverMessageId ? (
                            m.feedbackSubmitted ? (
                              <div className="ast-feedback ast-feedback--done" role="status">
                                Gracias por tu opinión
                              </div>
                            ) : (
                              <div className="ast-feedback">
                                <div className="ast-feedback__row">
                                  <button
                                    type="button"
                                    className="ast-feedback__btn"
                                    disabled={m.feedbackSubmitting}
                                    aria-label="Respuesta útil"
                                    onClick={() => {
                                      setMessages((prev) =>
                                        prev.map((x) => ({
                                          ...x,
                                          feedbackNegativeOpen: false,
                                          feedbackCommentDraft: undefined,
                                        })),
                                      );
                                      void submitAssistantFeedback(
                                        m.id,
                                        m.serverMessageId,
                                        'positive',
                                        undefined,
                                      );
                                    }}
                                  >
                                    👍
                                  </button>
                                  <button
                                    type="button"
                                    className="ast-feedback__btn"
                                    disabled={m.feedbackSubmitting}
                                    aria-label="Respuesta no útil"
                                    onClick={() => {
                                      setMessages((prev) => {
                                        const cur = prev.find((x) => x.id === m.id);
                                        const willOpen = !cur?.feedbackNegativeOpen;
                                        return prev.map((x) => {
                                          if (x.id !== m.id) {
                                            return { ...x, feedbackNegativeOpen: false };
                                          }
                                          return {
                                            ...x,
                                            feedbackNegativeOpen: willOpen,
                                            feedbackCommentDraft: willOpen
                                              ? (x.feedbackCommentDraft ?? '')
                                              : undefined,
                                          };
                                        });
                                      });
                                    }}
                                  >
                                    👎
                                  </button>
                                </div>
                                {m.feedbackNegativeOpen ? (
                                  <div className="ast-feedback__negative">
                                    <textarea
                                      className="ast-feedback__textarea"
                                      rows={2}
                                      placeholder="Cuéntanos qué podemos mejorar"
                                      value={m.feedbackCommentDraft ?? ''}
                                      disabled={m.feedbackSubmitting}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setMessages((prev) =>
                                          prev.map((x) =>
                                            x.id === m.id
                                              ? { ...x, feedbackCommentDraft: v }
                                              : x,
                                          ),
                                        );
                                      }}
                                      aria-label="Comentario opcional"
                                    />
                                    <button
                                      type="button"
                                      className="ast-feedback__send"
                                      disabled={m.feedbackSubmitting}
                                      onClick={() => {
                                        void submitAssistantFeedback(
                                          m.id,
                                          m.serverMessageId,
                                          'negative',
                                          m.feedbackCommentDraft,
                                        );
                                      }}
                                    >
                                      Enviar comentario
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            )
                          ) : null}
                          <span className="ast-msg__meta">
                            {m.role === 'user' ? 'Tú' : 'Asistente'}
                            {m.createdAt ? ` · ${formatAssistantMsgTime(m.createdAt)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="ast-composer">
                  <textarea
                    className="ast-composer__input"
                    rows={1}
                    placeholder="Escribe tu consulta…"
                    value={inputValue}
                    disabled={sending}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={onComposerKeyDown}
                    aria-label="Mensaje para el asistente"
                  />
                  <button
                    type="button"
                    className="ast-composer__send"
                    disabled={sending || !inputValue.trim()}
                    onClick={() => sendAssistantMessage(undefined)}
                    aria-label="Enviar mensaje"
                  >
                    {sending ? (
                      <span className="ast-composer__spinner" aria-hidden />
                    ) : (
                      <span className="ast-composer__send-icon" aria-hidden>
                        ➤
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <ConfirmModal
              isOpen={showPurgeHistoryModal}
              onClose={() => setShowPurgeHistoryModal(false)}
              onConfirm={() => {
                void performPurgeAllAssistantHistory();
              }}
              title="Borrar historial del asistente"
              message="¿Borrar todo el historial guardado en el servidor? Esta acción no se puede deshacer."
              confirmText="Sí, borrar todo"
              cancelText="Cancelar"
              type="danger"
              overlayZIndex={200000}
            />
            {purgeErrorToast && (
              <div
                className="fixed top-4 left-4 max-w-sm animate-slide-in"
                style={{ zIndex: 200001 }}
                role="alert"
              >
                <div className="bg-white/95 backdrop-blur-sm border border-red-200 rounded-xl shadow-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        !
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">No se pudo borrar</h3>
                      <p className="mt-1 text-sm text-gray-600">{purgeErrorToast}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPurgeErrorToast(null)}
                      className="text-gray-400 hover:text-gray-600 shrink-0"
                      aria-label="Cerrar"
                    >
                      <span className="text-lg leading-none">×</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body,
        )}
    </div>
  );
};

export default ChatBot; 