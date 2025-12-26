// Compatibility wrapper - imports from the new exceljs-based exportExcel.ts
// This file maintains backward compatibility while the migration is in progress

export { 
  exportToExcelWithHeader, 
  exportGastosToExcel, 
  exportFacturasToExcel 
} from './exportExcel.js';

// Note: The old xlsx-based implementation has been replaced with exceljs
// All functionality remains the same, but now uses the modern exceljs library
// which provides better styling, formatting, and browser compatibility
