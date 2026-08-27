import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint = 639) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

export function getNombre(row) {
  return row['NOMBRE O RAZON SOCIAL'] || row['NOMBRE O RAZÓN SOCIAL'] || '—';
}

export function isComunidadCliente(cliente) {
  const nombre = getNombre(cliente);
  return (
    nombre.includes('C.P.')
    || nombre.includes('C.P ')
    || nombre.includes('CP ')
    || nombre.includes('CP.')
    || nombre.includes('COMUNIDAD DE PROPIETARIOS')
  );
}

export function getEstadoLabel(row) {
  const estado = row.ESTADO;
  if (estado === null || estado === undefined || estado === '' || estado === 'Sí') {
    return { label: 'Activo', tone: 'active' };
  }
  if (String(estado).toLowerCase() === 'no' || String(estado).toLowerCase() === 'inactivo') {
    return { label: 'Inactivo', tone: 'inactive' };
  }
  return { label: String(estado), tone: 'neutral' };
}

export function formatLimiteGasto(value) {
  if (!value) return null;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export function formatFecha(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-ES');
}

export function getContactoPrincipal(row) {
  return row.EMAIL || row.TELEFONO || row.MOVIL || row.MÓVIL || null;
}
