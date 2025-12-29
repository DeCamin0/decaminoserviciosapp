/**
 * Helper function to get formatted employee name
 * Uses new split columns (NOMBRE, APELLIDO1, APELLIDO2) with fallback to original
 * 
 * @param {Object} empleado - Employee object from backend
 * @returns {string} - Formatted employee name
 */
export function getFormattedNombre(empleado) {
  if (!empleado) {
    return 'Unknown';
  }

  // Get confidence level (0 = failed, 1 = uncertain, 2 = confident)
  const confianza = empleado.NOMBRE_SPLIT_CONFIANZA ?? empleado.nombre_split_confianza ?? 2;
  
  // Get new split columns
  const nombre = empleado.NOMBRE ?? empleado.nombre;
  const apellido1 = empleado.APELLIDO1 ?? empleado.apellido1;
  const apellido2 = empleado.APELLIDO2 ?? empleado.apellido2;
  
  // Use new columns if confidence is good (1 or 2) and they exist
  if (confianza > 0 && nombre) {
    const parts = [nombre, apellido1, apellido2].filter(p => p && p.trim() !== '');
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }
  
  // Fallback to original column
  return empleado['NOMBRE / APELLIDOS'] ?? 
         empleado.NOMBRE_APELLIDOS ?? 
         empleado.CODIGO ?? 
         'Unknown';
}

/**
 * Get employee initials from formatted name
 * @param {Object} empleado - Employee object
 * @returns {string} - Initials (max 2 characters)
 */
export function getEmployeeInitials(empleado) {
  const nombre = getFormattedNombre(empleado);
  if (!nombre || nombre === 'Unknown') {
    return '?';
  }
  
  const parts = nombre.split(' ').filter(p => p && p.trim() !== '');
  if (parts.length === 0) {
    return '?';
  }
  
  // Get first letter of first part and first letter of last part
  if (parts.length === 1) {
    return parts[0][0]?.toUpperCase() || '?';
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
}

