export const SOLICITUD_WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const SOLICITUD_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function solicitudDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getSolicitudDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getSolicitudFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export function getSolicitudDayOfWeekShort(year, month, day) {
  const date = new Date(year, month, day);
  return SOLICITUD_WEEKDAY_LABELS[date.getDay()];
}
