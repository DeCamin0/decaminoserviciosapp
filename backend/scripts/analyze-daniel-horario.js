const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function analyzeDanielHorario() {
  try {
    const filePath = path.join(__dirname, '../../DANIEL - HORARIO 2026 (1).xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }

    console.log('📂 Reading file:', filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    console.log('\n📋 Sheets found:', workbook.worksheets.map(s => s.name));

    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 Sheet ${sheetIndex + 1}: "${worksheet.name}"`);
      console.log(`${'='.repeat(80)}`);

      // Citim primele 10 rânduri pentru a înțelege structura
      const maxRows = Math.min(15, worksheet.rowCount);
      
      console.log(`\n📊 First ${maxRows} rows:`);
      console.log('-'.repeat(80));
      
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > maxRows) return;
        
        const values = [];
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          let value = cell.value;
          
          // Formatează valorile
          if (value instanceof Date) {
            value = value.toISOString().slice(0, 19).replace('T', ' ');
          } else if (typeof value === 'number') {
            // Verifică dacă e o dată Excel (valorile mari sunt zile)
            if (value > 40000) {
              const excelDate = new Date((value - 25569) * 86400 * 1000);
              value = `DATE: ${excelDate.toISOString().slice(0, 10)} (${value})`;
            } else if (value < 1 && value >= 0) {
              // Probabil timp (fracție de zi)
              const hours = Math.floor(value * 24);
              const minutes = Math.round((value * 24 - hours) * 60);
              value = `TIME: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} (${value})`;
            } else {
              value = `NUM: ${value}`;
            }
          } else if (typeof value === 'object' && value !== null) {
            if ('result' in value) {
              value = `FORMULA: ${value.result}`;
            } else {
              value = JSON.stringify(value).substring(0, 50);
            }
          }
          
          values.push(`[${colNumber}]: ${String(value).substring(0, 30)}`);
        });
        
        console.log(`Row ${rowNumber.toString().padStart(3)}:`, values.join(' | '));
      });

      // Verifică numărul de coloane
      let maxCols = 0;
      worksheet.eachRow((row) => {
        maxCols = Math.max(maxCols, row.cellCount);
      });
      console.log(`\n📐 Sheet dimensions: ${worksheet.rowCount} rows × ${maxCols} columns`);
    });

    // Verifică structura specifică a primului sheet
    const firstSheet = workbook.worksheets[0];
    if (firstSheet) {
      console.log(`\n${'='.repeat(80)}`);
      console.log('🔍 Detailed analysis of first sheet:');
      console.log(`${'='.repeat(80)}`);
      
      // Analizează header-ul (primele 3 rânduri)
      console.log('\n📋 Header rows:');
      for (let rowNum = 1; rowNum <= Math.min(5, firstSheet.rowCount); rowNum++) {
        const row = firstSheet.getRow(rowNum);
        const rowValues = [];
        row.eachCell({ includeEmpty: false }, (cell, colNum) => {
          let val = cell.value;
          if (val instanceof Date) {
            val = val.toISOString().slice(0, 10);
          } else if (typeof val === 'number' && val < 1 && val >= 0) {
            const h = Math.floor(val * 24);
            const m = Math.round((val * 24 - h) * 60);
            val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
          rowValues.push(`${colNum}:${String(val).substring(0, 20)}`);
        });
        console.log(`  Row ${rowNum}:`, rowValues.join(' | '));
      }

      // Caută nume angajat
      console.log('\n👤 Looking for employee name:');
      firstSheet.eachRow((row, rowNum) => {
        if (rowNum > 10) return;
        row.eachCell({ includeEmpty: false }, (cell) => {
          const val = String(cell.value).toLowerCase();
          if (val.includes('daniel') || val.includes('nombre') || val.includes('trabajador') || val.includes('empleado')) {
            console.log(`  Found at row ${rowNum}, col ${cell.col}:`, cell.value);
          }
        });
      });

      // Caută centre
      console.log('\n🏢 Looking for centers:');
      firstSheet.eachRow((row, rowNum) => {
        if (rowNum > 15) return;
        row.eachCell({ includeEmpty: false }, (cell) => {
          const val = String(cell.value).toUpperCase();
          if (val.includes('CENTRO') || val.includes('TRABAJO') || val.includes('CLIENTE') || val.length > 15) {
            console.log(`  Found at row ${rowNum}, col ${cell.col}:`, cell.value);
          }
        });
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

analyzeDanielHorario();
