export function formatJornadaPreview(j) {
  if (!j) return [];
  const lines = [];
  if (j.horas_semana != null && j.horas_semana !== '') {
    lines.push(`${j.horas_semana} horas/semana`);
  }
  for (const t of j.tramos || []) {
    if (t.dias_label && t.hora_inicio && t.hora_fin) {
      lines.push(`${t.dias_label}: ${t.hora_inicio}–${t.hora_fin}`);
    }
  }
  if (j.festivos_incluidos === false) lines.push('Sin festivos');
  else if (j.festivos_incluidos === true) lines.push('Festivos incluidos');
  return lines;
}
