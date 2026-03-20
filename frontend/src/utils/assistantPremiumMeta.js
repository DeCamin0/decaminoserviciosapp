/**
 * Texto legible para el pie del mensaje del asistente (contrato premium backend).
 * No muestra JSON ni detalles técnicos innecesarios.
 */

const SOURCE_FALLBACK = {
  live_data: 'Datos de la aplicación',
  knowledge_base: 'Base de conocimiento',
  generated_summary: 'Texto asistido',
  escalation_ticket: 'Soporte',
};

function sourceLine(s) {
  if (!s || typeof s !== 'object') return '';
  const label = typeof s.label === 'string' && s.label.trim();
  if (label) return label;
  const t = s.type;
  return (t && SOURCE_FALLBACK[t]) || '';
}

/**
 * @param {Record<string, unknown>|null|undefined} apiData - JSON de POST /api/assistant/message
 * @returns {string} sufijo para añadir tras `respuesta` (vacío si no hay nada útil)
 */
export function buildAssistantPremiumFooter(apiData) {
  if (!apiData || typeof apiData !== 'object') return '';

  const status = apiData.status;
  const blocks = [];

  if (status === 'no_data') {
    blocks.push('ℹ️ No hay registros que coincidan con esta consulta.');
  } else if (status === 'unsupported') {
    blocks.push('💬 Respuesta general: no se ha consultado tu información interna en este mensaje.');
  } else if (status === 'error') {
    blocks.push('⚠️ Ha ocurrido un inconveniente. Si aparece una referencia abajo, consérvala para seguimiento.');
  } else if (status === 'escalated') {
    blocks.push('📋 Tu mensaje quedó registrado para el equipo de administración.');
  }

  if (Array.isArray(apiData.sources) && apiData.sources.length > 0) {
    const seen = new Set();
    const labels = [];
    for (const s of apiData.sources) {
      const line = sourceLine(s);
      if (line && !seen.has(line)) {
        seen.add(line);
        labels.push(line);
      }
    }
    if (labels.length) {
      blocks.push(`🔎 Con base en: ${labels.join(' · ')}`);
    }
  }

  const ticket = apiData.ticket_id || apiData.ticketId;
  if (ticket) {
    blocks.push(`🎫 Referencia: ${ticket}`);
  }

  if (
    Array.isArray(apiData.limitations) &&
    apiData.limitations.length > 0 &&
    ['no_data', 'unsupported', 'error'].includes(status)
  ) {
    const short = apiData.limitations
      .slice(0, 2)
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(' ');
    if (short) {
      const clipped = short.length > 200 ? `${short.slice(0, 197)}…` : short;
      blocks.push(`📌 ${clipped}`);
    }
  }

  if (Array.isArray(apiData.followUps) && apiData.followUps.length > 0) {
    const lines = apiData.followUps
      .slice(0, 3)
      .map((f) => String(f).trim())
      .filter(Boolean)
      .map((f) => `• ${f}`);
    if (lines.length) {
      blocks.push(`💡 Sugerencias:\n${lines.join('\n')}`);
    }
  }

  if (blocks.length === 0) return '';
  return `\n\n──────────────\n${blocks.join('\n\n')}`;
}
