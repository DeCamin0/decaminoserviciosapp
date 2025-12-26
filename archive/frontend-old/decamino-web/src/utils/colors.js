// Culorile DeCamino - consistent cu theme.js și tailwind.config.js
export const DECAMINO_COLORS = {
  // Culori primare (roșii)
  primary: {
    50: 'bg-primary-50',
    100: 'bg-primary-100', 
    200: 'bg-primary-200',
    300: 'bg-primary-300',
    400: 'bg-primary-400',
    500: 'bg-primary-500', // DeCamino red
    600: 'bg-primary-600',
    700: 'bg-primary-700',
    800: 'bg-primary-800',
    900: 'bg-primary-900',
  },
  
  // Culori secundare (griuri)
  secondary: {
    50: 'bg-secondary-50',   // White
    100: 'bg-secondary-100', // Very light gray
    200: 'bg-secondary-200', // DeCamino background
    300: 'bg-secondary-300',
    400: 'bg-secondary-400',
    500: 'bg-secondary-500',
    600: 'bg-secondary-600',
    700: 'bg-secondary-700',
    800: 'bg-secondary-800',
    900: 'bg-secondary-900',
  },
  
  // Culori pentru text
  text: {
    primary: 'text-primary-500',     // DeCamino red
    secondary: 'text-secondary-600', // Gray
    white: 'text-white',
    dark: 'text-text-primary',
  },
  
  // Culori pentru borduri
  border: {
    primary: 'border-primary-500',
    secondary: 'border-secondary-300',
    light: 'border-border',
  },
  
  // Culori pentru hover
  hover: {
    primary: 'hover:bg-primary-600',
    secondary: 'hover:bg-secondary-100',
    light: 'hover:bg-primary-50',
  },
  
  // Culori semantice
  success: 'bg-success',
  warning: 'bg-warning', 
  error: 'bg-error',
  info: 'bg-info',
};

// Funcții helper pentru culori
export const getColorClass = (type, variant = '500', prefix = 'bg') => {
  const colorMap = {
    primary: DECAMINO_COLORS.primary,
    secondary: DECAMINO_COLORS.secondary,
  };
  
  return colorMap[type]?.[variant] || `${prefix}-${type}-${variant}`;
};

// Clase predefinite pentru butoane
export const BUTTON_COLORS = {
  primary: 'bg-primary-500 hover:bg-primary-600 text-white',
  secondary: 'bg-secondary-200 hover:bg-secondary-300 text-secondary-800',
  outline: 'bg-white text-primary-500 border border-primary-500 hover:bg-primary-50',
  danger: 'bg-error hover:bg-red-700 text-white',
  success: 'bg-success hover:bg-green-700 text-white',
};

// Clase predefinite pentru text
export const TEXT_COLORS = {
  primary: 'text-primary-500',
  secondary: 'text-secondary-600',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
};

// Clase predefinite pentru borduri
export const BORDER_COLORS = {
  primary: 'border-primary-500',
  secondary: 'border-secondary-300',
  error: 'border-error',
  success: 'border-success',
};
