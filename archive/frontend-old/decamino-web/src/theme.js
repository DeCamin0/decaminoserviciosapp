// Theme colors for DeCamino app
export const COLORS = {
  PRIMARY: '#E53935', // Red
  PRIMARY_LIGHT: '#FFCDD2', // Light red
  SECONDARY: '#FFFFFF', // White
  TEXT_PRIMARY: '#222222', // Dark text
  TEXT_SECONDARY: '#666666', // Gray text
  BACKGROUND: '#F5F5F5', // Light gray background
  SUCCESS: '#4CAF50', // Green
  WARNING: '#FF9800', // Orange
  ERROR: '#F44336', // Red
  INFO: '#2196F3', // Blue
  BORDER: '#E0E0E0', // Light gray border
  SHADOW: 'rgba(0, 0, 0, 0.1)', // Shadow
};

// Tailwind CSS classes pentru culorile DeCamino
export const TAILWIND_COLORS = {
  // Culori primare (roșii)
  primary: {
    50: 'bg-primary-50 text-primary-50',
    100: 'bg-primary-100 text-primary-100',
    200: 'bg-primary-200 text-primary-200',
    300: 'bg-primary-300 text-primary-300',
    400: 'bg-primary-400 text-primary-400',
    500: 'bg-primary-500 text-primary-500', // DeCamino red
    600: 'bg-primary-600 text-primary-600',
    700: 'bg-primary-700 text-primary-700',
    800: 'bg-primary-800 text-primary-800',
    900: 'bg-primary-900 text-primary-900',
  },
  
  // Culori secundare (griuri)
  secondary: {
    50: 'bg-secondary-50 text-secondary-50',   // White
    100: 'bg-secondary-100 text-secondary-100', // Very light gray
    200: 'bg-secondary-200 text-secondary-200', // DeCamino background
    300: 'bg-secondary-300 text-secondary-300',
    400: 'bg-secondary-400 text-secondary-400',
    500: 'bg-secondary-500 text-secondary-500',
    600: 'bg-secondary-600 text-secondary-600',
    700: 'bg-secondary-700 text-secondary-700',
    800: 'bg-secondary-800 text-secondary-800',
    900: 'bg-secondary-900 text-secondary-900',
  },
  
  // Culori semantice
  success: 'bg-success text-success',
  warning: 'bg-warning text-warning',
  error: 'bg-error text-error',
  info: 'bg-info text-info',
  
  // Culori pentru text
  text: {
    primary: 'text-primary-500',
    secondary: 'text-secondary-600',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    info: 'text-info',
  },
  
  // Culori pentru borduri
  border: {
    primary: 'border-primary-500',
    secondary: 'border-secondary-300',
    success: 'border-success',
    warning: 'border-warning',
    error: 'border-error',
    info: 'border-info',
  },
};

// Helper function to check if eFactura XML is enabled
export const isEInvoiceXMLEnabled = () => import.meta.env.VITE_ENABLE_EINVOICE_XML === 'true' || true;

// Helper function to get API URL
export const getApiUrl = (endpoint) => `${import.meta.env.VITE_API_BASE || '/api'}${endpoint}`; 