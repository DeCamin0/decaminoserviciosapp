// Normalize email for comparison
export const normalizeEmail = (email) => {
  return (email || '').trim().toLowerCase();
};

// Find user by email
export const findUserByEmail = (users, email) => {
  const normEmail = normalizeEmail(email);
  let found = users.find(u => normalizeEmail(u['CORREO ELECTRONICO']) === normEmail);
  
  if (!found && users.length > 0) {
    found = users.find(u => normalizeEmail(u[8]) === normEmail);
  }
  
  return found;
};

// Validate user role access
export const validateUserAccess = (user, role) => {
  const grupo = user?.['GRUPO'] || user?.[16] || '';
  
  if (role === 'MANAGER' && grupo !== 'Manager' && grupo !== 'Supervisor') {
    return { valid: false, error: '¡Acceso permitido solo para supervisores!' };
  }
  
  if (role === 'EMPLEADOS' && (grupo === 'Manager' || grupo === 'Supervisor')) {
    return { valid: false, error: '¡El acceso de supervisores no está permitido aquí!' };
  }
  
  return { valid: true };
};

// Format user data for storage
export const formatUserData = (user, role) => {
  const grupo = user['GRUPO'] || user[16] || '';
  
  return {
    email: user['CORREO ELECTRONICO'] || user[8],
    isManager: grupo === 'Manager' || grupo === 'Supervisor',
    role,
    GRUPO: grupo,
    ...user
  };
};

// Format date for display
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  } catch {
    return dateString;
  }
};

// Format currency
export const formatCurrency = (amount) => {
  if (!amount) return '-';
  
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  } catch {
    return amount;
  }
}; 