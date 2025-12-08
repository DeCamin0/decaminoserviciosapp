// Configuration file for environment variables
// This file helps manage environment-specific settings

const inferApiBase = () => {
  const fromEnv = import.meta.env.VITE_API_BASE
  if (fromEnv && typeof fromEnv === 'string') return fromEnv
  // Fallback sigur: folosește rute relative prin proxy/ingress (evită http implicit)
  return '/api'
}

export const config = {
  // Enable eFactura XML generation
  ENABLE_EINVOICE_XML: import.meta.env.VITE_ENABLE_EINVOICE_XML === 'true' || true,
  
  // API endpoints
  API_BASE_URL: inferApiBase(),
  
  // Other configuration options
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true' || false,
  
  // PDF generation settings
  PDF_QUALITY: import.meta.env.VITE_PDF_QUALITY || 'high',
  
  // File upload settings
  MAX_FILE_SIZE: import.meta.env.VITE_MAX_FILE_SIZE || 30 * 1024 * 1024, // 30MB
};

// Helper function to check if eFactura XML is enabled
export const isEInvoiceXMLEnabled = () => config.ENABLE_EINVOICE_XML;

// Helper function to get API URL
export const getApiUrl = (endpoint) => `${config.API_BASE_URL}${endpoint}`;
