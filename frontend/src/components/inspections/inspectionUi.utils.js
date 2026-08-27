export function getInspectionTypeLabel(type) {
  if (type === 'limpieza') return 'Limpieza';
  if (type === 'servicios') return 'Servicios Auxiliares';
  if (type === 'entrega-materiales') return 'Entrega de Materiales';
  if (type === 'personalizada') return 'Personalizada';
  return type || 'Desconocido';
}

export function getInspectionTypeBadgeClass(type) {
  if (type === 'limpieza') return 'inspecciones-badge inspecciones-badge--limpieza';
  if (type === 'servicios') return 'inspecciones-badge inspecciones-badge--servicios';
  if (type === 'entrega-materiales') return 'inspecciones-badge inspecciones-badge--materiales';
  if (type === 'personalizada') return 'inspecciones-badge inspecciones-badge--personalizada';
  return 'inspecciones-badge';
}

export function getInspectionStatusBadge(inspection) {
  if (inspection.isSolicitud) {
    return { label: 'Solicitud pendiente', className: 'inspecciones-badge inspecciones-badge--pending' };
  }
  return {
    label: inspection.status || 'Completada',
    className: 'inspecciones-badge inspecciones-badge--done',
  };
}
