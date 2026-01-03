import ExcelJS from 'exceljs';

// Company information
const COMPANY_INFO = {
  name: 'DE CAMINO SERVICIOS AUXILIARES SL',
  cif: 'B85524536',
  address: 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: '+34 91 123 45 67',
  email: 'info@decaminoservicios.com'
};

// Excel styling constants
const STYLES = {
  companyName: {
    font: { bold: true, size: 16, color: { argb: "FFFFFF" } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: "CC0000" } },
    alignment: { horizontal: "center", vertical: "middle" }
  },
  companyDetails: {
    font: { bold: true, size: 12, color: { argb: "333333" } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: "F0F0F0" } }
  },
  reportTitle: {
    font: { bold: true, size: 14, color: { argb: "FFFFFF" } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: "0066CC" } },
    alignment: { horizontal: "center", vertical: "middle" }
  },
  period: {
    font: { size: 12, color: { argb: "333333" } },
    alignment: { horizontal: "center", vertical: "middle" }
  },
  columnHeaders: {
    font: { bold: true, color: { argb: "FFFFFF" } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: "333333" } },
    alignment: { horizontal: "center", vertical: "middle" }
  },
  totalsRow: {
    font: { bold: true, color: { argb: "FFFFFF" } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: "CC0000" } }
  }
};

// Helper function to determine if we're in browser
function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

// Helper function to convert column index (0-based) to Excel column letter (A, B, ..., Z, AA, AB, ...)
function getExcelColumnLetter(index: number): string {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}

// Interface pentru coloane Excel
interface ExcelColumn {
  key: string;
  label: string;
  width?: number;
  type?: 'number' | 'string';
  [key: string]: any;
}

// Interface pentru date Excel (generic)
interface ExcelDataItem {
  [key: string]: any;
}

// Interface pentru totals
interface ExcelTotals {
  [key: string]: number | string;
}

/**
 * Export data to Excel with company header using exceljs
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column definitions with key, label, and width
 * @param {string} reportTitle - Title of the report
 * @param {string} filename - Name of the file (without extension)
 * @param {Object} totals - Object with totals for numeric columns
 * @param {string} period - Period string to display (optional, defaults to current date)
 */
export const exportToExcelWithHeader = async (
  data: ExcelDataItem[], 
  columns: ExcelColumn[], 
  reportTitle: string, 
  filename: string, 
  totals: ExcelTotals = {}, 
  period?: string
) => {
  if (!data || data.length === 0) return;

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Set column widths
  columns.forEach((col, index) => {
    worksheet.getColumn(index + 1).width = col.width || 15;
  });

  let currentRow = 1;

  // Company name (merged across all columns)
  const companyNameCell = worksheet.getCell(`A${currentRow}`);
  companyNameCell.value = COMPANY_INFO.name;
  companyNameCell.font = STYLES.companyName.font;
  companyNameCell.fill = STYLES.companyName.fill;
  companyNameCell.alignment = STYLES.companyName.alignment;
  worksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(columns.length - 1)}${currentRow}`);
  currentRow++;

  // Company details (merged across all columns)
  const cifCell = worksheet.getCell(`A${currentRow}`);
  cifCell.value = `NIF: ${COMPANY_INFO.cif}`;
  cifCell.font = STYLES.companyDetails.font;
  cifCell.fill = STYLES.companyDetails.fill;
  worksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(columns.length - 1)}${currentRow}`);
  currentRow++;

  const addressCell = worksheet.getCell(`A${currentRow}`);
  addressCell.value = `Dirección: ${COMPANY_INFO.address}`;
  addressCell.font = STYLES.companyDetails.font;
  addressCell.fill = STYLES.companyDetails.fill;
  worksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(columns.length - 1)}${currentRow}`);
  currentRow++;

  const phoneCell = worksheet.getCell(`A${currentRow}`);
  phoneCell.value = `Teléfono: ${COMPANY_INFO.phone}`;
  phoneCell.font = STYLES.companyDetails.font;
  phoneCell.fill = STYLES.companyDetails.fill;
  worksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(columns.length - 1)}${currentRow}`);
  currentRow++;

  const emailCell = worksheet.getCell(`A${currentRow}`);
  emailCell.value = `Email: ${COMPANY_INFO.email}`;
  emailCell.font = STYLES.companyDetails.font;
  emailCell.fill = STYLES.companyDetails.fill;
  worksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(columns.length - 1)}${currentRow}`);
  currentRow++;

  // Empty row
  currentRow++;

  // Report title (merged across all columns)
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = reportTitle;
  titleCell.font = STYLES.reportTitle.font;
  titleCell.fill = STYLES.reportTitle.fill;
  titleCell.alignment = STYLES.reportTitle.alignment;
  worksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(columns.length - 1)}${currentRow}`);
  currentRow++;

  // Period (merged across all columns)
  const periodCell = worksheet.getCell(`A${currentRow}`);
  const periodText = period || new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  periodCell.value = `Período: ${periodText}`;
  periodCell.font = STYLES.period.font;
  periodCell.alignment = STYLES.period.alignment;
  worksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(columns.length - 1)}${currentRow}`);
  currentRow++;

  // Empty row
  currentRow++;

  // Column headers
  columns.forEach((col, index) => {
    const headerCell = worksheet.getCell(`${getExcelColumnLetter(index)}${currentRow}`);
    headerCell.value = col.label;
    headerCell.font = STYLES.columnHeaders.font;
    headerCell.fill = STYLES.columnHeaders.fill;
    headerCell.alignment = STYLES.columnHeaders.alignment;
  });
  currentRow++;

  // Data rows
  data.forEach(item => {
    columns.forEach((col, index) => {
      const cell = worksheet.getCell(`${getExcelColumnLetter(index)}${currentRow}`);
      const value = item[col.key];
      
      if (col.type === 'number') {
        cell.value = Number(value || 0);
        cell.numFmt = '#,##0.00';
      } else {
        cell.value = value || '';
      }
    });
    currentRow++;
  });

  // Totals row if provided
  if (Object.keys(totals).length > 0) {
    columns.forEach((col, index) => {
      const cell = worksheet.getCell(`${getExcelColumnLetter(index)}${currentRow}`);
      
      if (totals[col.key] !== undefined) {
        cell.value = totals[col.key];
        if (col.type === 'number') {
          cell.numFmt = '#,##0.00';
        }
      } else if (index === 0) {
        cell.value = 'TOTALES';
      }
      
      cell.font = STYLES.totalsRow.font;
      cell.fill = STYLES.totalsRow.fill;
    });
  }

  // Generate filename with current date
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const fullFilename = `${filename}_${dateStr}.xlsx`;

  // Export based on environment
  if (isBrowser()) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fullFilename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await workbook.xlsx.writeFile(fullFilename);
  }
};

/**
 * Export gastos to Excel (specific implementation)
 */
export const exportGastosToExcel = async (items: ExcelDataItem[], totals: ExcelTotals) => {
  const columns = [
    { key: 'id', label: 'ID', width: 8 },
    { key: 'magazin', label: 'Tienda', width: 20 },
    { key: 'adresa', label: 'Dirección', width: 30 },
    { key: 'telefon', label: 'Teléfono', width: 15 },
    { key: 'cif', label: 'CIF', width: 15 },
    { key: 'tip_bon', label: 'Tipo Bon', width: 20 },
    { key: 'numar_operatiune', label: 'Número Operación', width: 20 },
    { key: 'data', label: 'Fecha', width: 12 },
    { key: 'ora', label: 'Hora', width: 8 },
    { key: 'produse_text', label: 'Productos', width: 50 },
    { key: 'baza_impozabila', label: 'Base Imponible', width: 15, type: 'number' },
    { key: 'tva', label: 'IVA', width: 12, type: 'number' },
    { key: 'cota_tva', label: 'Tipo IVA (%)', width: 12, type: 'number' },
    { key: 'total_platit', label: 'Total Pagado', width: 15, type: 'number' },
    { key: 'moneda', label: 'Moneda', width: 10 },
    { key: 'metoda_plata', label: 'Método de Pago', width: 20 },
    { key: 'rest', label: 'Cambio', width: 12, type: 'number' }
  ];

  await exportToExcelWithHeader(items, columns, 'REPORTE DE GASTOS', 'gastos', totals);
};

