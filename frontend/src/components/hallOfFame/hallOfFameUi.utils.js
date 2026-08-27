export const HOF_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function formatHofScore(score) {
  if (score === null || score === undefined) return '-';
  return parseFloat(score).toFixed(2);
}

export function getMonthName(mes) {
  if (!mes) return '';
  const [year, month] = mes.split('-');
  return `${HOF_MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

export function getShortMonthName(mes) {
  if (!mes) return '';
  const [year, month] = mes.split('-');
  const shortYear = year.toString().slice(-2);
  return `${HOF_MONTHS[parseInt(month, 10) - 1].slice(0, 3)} ${shortYear}`;
}
