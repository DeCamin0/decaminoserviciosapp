const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'MAQUINILLA 15 - 2026.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found:', filePath);
      process.exit(1);
    }

    console.log('📄 Reading Excel file:', filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.worksheets[0];
    console.log('\n✅ Sheet name:', sheet.name);
    console.log('📊 Total rows:', sheet.rowCount);
    console.log('📊 Total columns:', sheet.columnCount);

    console.log('\n=== FIRST 30 ROWS (first 15 columns) ===\n');
    
    for (let i = 1; i <= Math.min(30, sheet.rowCount); i++) {
      const row = sheet.getRow(i);
      const values = [];
      
        for (let colNumber = 1; colNumber <= Math.min(15, sheet.columnCount); colNumber++) {
          const cell = row.getCell(colNumber);
          let value = cell.value;
          
          if (value instanceof Date) {
            // Excel stores times as dates starting from 1899-12-30
            // Extract time portion
            const hours = value.getHours();
            const minutes = value.getMinutes();
            if (hours === 0 && minutes === 0 && value.getDate() === 30 && value.getMonth() === 11 && value.getFullYear() === 1899) {
              value = '00:00';
            } else {
              value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
          } else if (typeof value === 'number' && value < 1 && value > 0) {
            // Excel time as decimal (0.5 = 12:00, etc.)
            const totalSeconds = Math.floor(value * 86400);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          
          values.push(value || '');
        }
      
      console.log(`Row ${String(i).padStart(2, '0')}:`, values.map(v => String(v).substring(0, 15).padEnd(15)).join(' | '));
    }

    console.log('\n=== ANALYZING STRUCTURE ===\n');
    
    // Căutăm pattern-ul pentru HE și HS
    let heRow = null;
    let hsRow = null;
    let turnoMCount = 0;
    let turnoTCount = 0;
    
    for (let i = 1; i <= Math.min(30, sheet.rowCount); i++) {
      const row = sheet.getRow(i);
      const firstCell = row.getCell(1)?.value;
      const secondCell = row.getCell(2)?.value;
      
      if (String(firstCell || '').trim().toUpperCase() === 'HE' || 
          String(secondCell || '').trim().toUpperCase() === 'HE') {
        heRow = i;
        console.log(`🔍 Found HE at row: ${i}`);
      }
      
      if (String(firstCell || '').trim().toUpperCase() === 'HS' || 
          String(secondCell || '').trim().toUpperCase() === 'HS') {
        hsRow = i;
        console.log(`🔍 Found HS at row: ${i}`);
      }
      
      // Căutăm TURNO M și T
      const turnoValue = String(secondCell || '').trim().toUpperCase();
      if (turnoValue === 'M') {
        turnoMCount++;
        console.log(`🔍 Found TURNO M at row: ${i}, count: ${turnoMCount}`);
        
        // Afișăm primele 15 coloane pentru acest rând M (pentru a vedea zilele)
        const rowValues = [];
        for (let col = 1; col <= 15; col++) {
          const cell = row.getCell(col);
          let val = cell.value;
          if (val instanceof Date) {
            // Extract time from Excel date (1899-12-30 = 00:00)
            const hours = val.getHours();
            const minutes = val.getMinutes();
            val = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (typeof val === 'number' && val < 1 && val > 0) {
            // Excel time as decimal
            const totalSeconds = Math.floor(val * 86400);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            val = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (typeof val === 'object' && val !== null && 'result' in val) {
            val = `[FORMULA:${val.result}]`;
          }
          rowValues.push(val !== null && val !== undefined ? String(val).substring(0, 12) : '');
        }
        console.log(`   Values (cols 1-15):`, rowValues);
      }
      
      if (turnoValue === 'T') {
        turnoTCount++;
        console.log(`🔍 Found TURNO T at row: ${i}, count: ${turnoTCount}`);
        
        // Afișăm primele 15 coloane pentru acest rând T (pentru a vedea zilele)
        const rowValues = [];
        for (let col = 1; col <= 15; col++) {
          const cell = row.getCell(col);
          let val = cell.value;
          if (val instanceof Date) {
            // Extract time from Excel date (1899-12-30 = 00:00)
            const hours = val.getHours();
            const minutes = val.getMinutes();
            val = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (typeof val === 'number' && val < 1 && val > 0) {
            // Excel time as decimal
            const totalSeconds = Math.floor(val * 86400);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            val = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (typeof val === 'object' && val !== null && 'result' in val) {
            val = `[FORMULA:${val.result}]`;
          }
          rowValues.push(val !== null && val !== undefined ? String(val).substring(0, 12) : '');
        }
        console.log(`   Values (cols 1-15):`, rowValues);
      }
    }

    console.log('\n=== SEARCHING FOR SPECIFIC EMPLOYEE ROWS ===\n');
    
    // Căutăm un nume de angajat și vedem structura pentru el
    for (let i = 1; i <= Math.min(50, sheet.rowCount); i++) {
      const row = sheet.getRow(i);
      const trabajador = row.getCell(1)?.value;
      const turno = row.getCell(2)?.value;
      
      if (trabajador && typeof trabajador === 'string' && trabajador.length > 5 && 
          trabajador !== 'TRABAJADOR' && trabajador !== 'DIAS DE LA SEMANA' && 
          trabajador !== 'TOTAL' && trabajador !== 'M' && trabajador !== 'T') {
        
        console.log(`\n👤 Found employee row ${i}:`, trabajador, `| TURNO:`, turno);
        
        // Afișăm primele 12 coloane pentru acest angajat
        const rowValues = [];
        for (let col = 1; col <= 12; col++) {
          const cell = row.getCell(col);
          let val = cell.value;
          if (val instanceof Date) {
            // Format time from Excel date
            const hours = val.getHours();
            const minutes = val.getMinutes();
            val = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (typeof val === 'number' && val < 1 && val > 0) {
            // Excel time as decimal
            const totalSeconds = Math.floor(val * 86400);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            val = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
          rowValues.push(val !== null && val !== undefined ? String(val).substring(0, 10) : '');
        }
        console.log(`   Columns 1-12:`, rowValues);
        
        // Limităm la primul angajat găsit pentru detaliu
        if (i > 15) break;
      }
    }

    console.log('\n✅ Analysis complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
