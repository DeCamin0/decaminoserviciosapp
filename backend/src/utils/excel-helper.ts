import * as ExcelJS from 'exceljs';

/**
 * Helper pentru a converti un worksheet ExcelJS la array de obiecte JSON
 * Replică comportamentul XLSX.utils.sheet_to_json cu opțiunile:
 * - raw: false (toate valorile ca string)
 * - defval: '' (valori default goale)
 */
export function sheetToJson(
  worksheet: ExcelJS.Worksheet,
  options: { raw?: boolean; defval?: any } = {},
): any[] {
  const { raw = false, defval = '' } = options;

  const rows: any[] = [];
  const headers: string[] = [];
  let hasHeaders = false;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Prima linie = header
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = cell.value
          ? String(cell.value).trim()
          : defval !== undefined
            ? String(defval)
            : '';
        headers[colNumber - 1] = header;
      });
      hasHeaders = true;
    } else if (hasHeaders) {
      // Liniile de date
      const rowData: any = {};

      // Pentru fiecare coloană din header, adaugă valoarea (sau defval dacă e goală)
      headers.forEach((header, index) => {
        if (header !== undefined && header !== '') {
          const cell = row.getCell(index + 1);
          let value: any;

          if (cell.value === null || cell.value === undefined) {
            value = defval !== undefined ? defval : '';
          } else if (cell.value instanceof Date) {
            // Datele se convertesc la string
            value = raw ? cell.value : cell.value.toISOString().split('T')[0];
          } else if (typeof cell.value === 'object' && 'result' in cell.value) {
            // Formula rezolvată
            value = raw
              ? cell.value.result
              : String(cell.value.result || defval);
          } else if (typeof cell.value === 'number') {
            // Numere
            value = raw ? cell.value : String(cell.value);
          } else {
            // String sau altceva
            value = raw ? cell.value : String(cell.value);
          }

          rowData[header] = value;
        }
      });

      // Adaugă rândul (XLSX include toate rândurile, chiar și cele goale)
      rows.push(rowData);
    }
  });

  return rows;
}
