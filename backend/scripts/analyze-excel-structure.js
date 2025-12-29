const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Helper pentru a converti un worksheet ExcelJS la array de obiecte JSON
 * Replică comportamentul XLSX.utils.sheet_to_json
 */
function sheetToJson(worksheet, options = {}) {
  const { raw = false, defval = '' } = options;
  const rows = [];
  const headers = [];
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
      const rowData = {};

      // Pentru fiecare coloană din header, adaugă valoarea (sau defval dacă e goală)
      headers.forEach((header, index) => {
        if (header !== undefined && header !== '') {
          const cell = row.getCell(index + 1);
          let value;

          if (cell.value === null || cell.value === undefined) {
            value = defval !== undefined ? defval : '';
          } else if (cell.value instanceof Date) {
            // Datele se convertesc la string
            value = raw ? cell.value : cell.value.toISOString().split('T')[0];
          } else if (typeof cell.value === 'object' && 'result' in cell.value) {
            // Formula rezolvată
            value = raw ? cell.value.result : String(cell.value.result || defval);
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

const excelPath = path.join(__dirname, '../n8n-snapshots/MutuaUniversal_Casos_20251212_132003_24575.xlsx');

console.log('📊 Analizând Excel:', excelPath);

(async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    
    console.log('\n📋 Sheet-uri disponibile:');
    workbook.worksheets.forEach((sheet, index) => {
      console.log(`  ${index + 1}. "${sheet.name}"`);
    });
    
    // Verifică dacă există sheet "Común"
    const sheet = workbook.worksheets.find(s => 
      s.name.toLowerCase().includes('común') || 
      s.name.toLowerCase().includes('comun')
    ) || workbook.worksheets[0];
    
    if (!sheet) {
      console.error('❌ Nu s-a găsit niciun sheet în Excel!');
      process.exit(1);
    }
    
    const sheetName = sheet.name;
    console.log(`\n📄 Analizez sheet: "${sheetName}"`);
    
    const data = sheetToJson(sheet, { 
      raw: false, // Pentru a vedea valorile exacte
      defval: '' // Valori default
    });
  
  if (data.length === 0) {
    console.log('❌ Sheet-ul este gol!');
    process.exit(1);
  }
  
  console.log(`\n📊 Rânduri găsite: ${data.length}`);
  console.log('\n🔍 Coloane identificate:');
  
  const firstRow = data[0];
  const columns = Object.keys(firstRow);
  columns.forEach((col, index) => {
    console.log(`  ${index + 1}. "${col}"`);
  });
  
  console.log('\n📝 Primele 2 rânduri de date:');
  console.log(JSON.stringify(data.slice(0, 2), null, 2));
  
    console.log('\n✅ Analiză completă!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Eroare la citirea Excel-ului:', error.message);
    process.exit(1);
  }
})();

