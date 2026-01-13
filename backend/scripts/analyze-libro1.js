const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Helper pentru a converti un worksheet ExcelJS la array de obiecte JSON
 */
function sheetToJson(worksheet, options = {}) {
  const { raw = false, defval = '' } = options;
  const rows = [];
  const headers = [];
  let hasHeaders = false;

  // Verificăm prima linie - poate fi zile săptămânii
  // Citim header-urile pe două linii
  let row1 = null;
  let row2 = null;
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Prima linie = "DIAS DE LA SEMANA" + zile săptămânii (J, V, S, D, L, M, X)
      row1 = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const value = cell.value ? String(cell.value).trim() : '';
        row1[colNumber - 1] = value;
      });
    } else if (rowNumber === 2) {
      // A doua linie = "TRABAJADOR" + "TURNO" + numerele zilelor lunii (1-31)
      row2 = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const value = cell.value ? String(cell.value).trim() : '';
        row2[colNumber - 1] = value;
        
        // Construim header-ul: combinăm linia 1 (ziua săptămânii) cu linia 2 (ziua lunii)
        if (colNumber === 1) {
          headers[0] = value; // "TRABAJADOR"
        } else if (colNumber === 2) {
          headers[1] = value; // "TURNO"
        } else {
          // Pentru coloanele cu zile: dacă linia 2 are un număr (ziua lunii)
          if (!isNaN(parseInt(value)) && row1[colNumber - 1]) {
            const dayName = row1[colNumber - 1]; // J, V, S, D, L, M, X
            headers[colNumber - 1] = `ZI_${value}`; // ZI_1, ZI_2, etc.
          } else {
            headers[colNumber - 1] = value || row1[colNumber - 1] || '';
          }
        }
      });
      hasHeaders = true;
    } else if (hasHeaders) {
      // Liniile de date
      const rowData = {};

      headers.forEach((header, index) => {
        if (header !== undefined && header !== '') {
          const cell = row.getCell(index + 1);
          let value;

          if (cell.value === null || cell.value === undefined) {
            value = defval !== undefined ? defval : '';
          } else if (cell.value instanceof Date) {
            value = raw ? cell.value : cell.value.toISOString().split('T')[0];
          } else if (typeof cell.value === 'object' && 'result' in cell.value) {
            value = raw ? cell.value.result : String(cell.value.result || defval);
          } else if (typeof cell.value === 'number') {
            value = raw ? cell.value : String(cell.value);
          } else {
            value = raw ? cell.value : String(cell.value);
          }

          rowData[header] = value;
        }
      });

      rows.push(rowData);
    }
  });

  return rows;
}

// Libro1.xlsx e în root
const excelPath = path.join(__dirname, '../../Libro1.xlsx');

console.log('📊 Analizând Excel:', excelPath);

(async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    
    console.log('\n📋 Sheet-uri disponibile:');
    workbook.worksheets.forEach((sheet, index) => {
      console.log(`  ${index + 1}. "${sheet.name}"`);
    });
    
    // Procesăm primul sheet (sau toate)
    const sheetsToProcess = workbook.worksheets.length === 1 
      ? workbook.worksheets 
      : workbook.worksheets.slice(0, 1); // Doar primul pentru analiză
    
    for (const sheet of sheetsToProcess) {
      const sheetName = sheet.name;
      console.log(`\n📄 Analizez sheet: "${sheetName}"`);
      
      // Citim cu raw: true pentru a vedea tipurile corecte de date
      const data = sheetToJson(sheet, { 
        raw: true, // Pentru a vedea timpii ca Date objects, nu string-uri
        defval: '' 
      });
      
      // Convertim manual valorile pentru afișare
      const dataFormatted = data.map(row => {
        const formattedRow = {};
        Object.keys(row).forEach(key => {
          const val = row[key];
          if (val instanceof Date) {
            // Dacă e dată (timp), formatăm ca timp
            const hours = val.getHours();
            const minutes = val.getMinutes();
            formattedRow[key] = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (typeof val === 'number') {
            // Dacă e număr, păstrăm ca string
            formattedRow[key] = String(val);
          } else {
            formattedRow[key] = val || '';
          }
        });
        return formattedRow;
      });
    
      if (data.length === 0) {
        console.log('❌ Sheet-ul este gol!');
        continue;
      }
      
      console.log(`\n📊 Rânduri găsite: ${data.length}`);
      console.log('\n🔍 Coloane identificate:');
      
      const firstRow = data[0];
      const columns = Object.keys(firstRow);
      columns.forEach((col, index) => {
        console.log(`  ${index + 1}. "${col}"`);
      });
      
      // Skip primele 2 linii (header)
      const dataRows = data;
      
      console.log('\n📝 Primele 10 rânduri de date (după header, formatate):');
      console.log(JSON.stringify(dataFormatted.slice(0, 10), null, 2));
      
      // Căutăm nume de angajați (în coloana TRABAJADOR - prima coloană)
      console.log('\n👤 ANGAJAȚI IDENTIFICAȚI:');
      const empleadosEncontrados = new Set();
      dataFormatted.forEach((row, index) => {
        const trabajador = row['TRABAJADOR'] || row[columns[0]] || '';
        if (trabajador && 
            trabajador !== 'M' && 
            trabajador !== 'T' && 
            trabajador !== 'TOTAL' && 
            trabajador !== 'HE' && 
            trabajador !== 'HS' &&
            trabajador.length > 2 &&
            !trabajador.includes('_')) {
          empleadosEncontrados.add(trabajador);
        }
      });
      
      if (empleadosEncontrados.size > 0) {
        console.log(`  Găsiți ${empleadosEncontrados.size} angajați:`);
        Array.from(empleadosEncontrados).forEach((nombre, idx) => {
          console.log(`  ${idx + 1}. ${nombre}`);
        });
        
        // Extragem orarul pentru primul angajat (exemplu)
        const primerEmpleado = Array.from(empleadosEncontrados)[0];
        console.log(`\n📋 ORARUL COMPLET PENTRU: "${primerEmpleado}"`);
        console.log('═'.repeat(80));
        
        const filasEmpleado = dataFormatted.filter(row => 
          (row['TRABAJADOR'] || row[columns[0]] || '').trim() === primerEmpleado
        );
        
        console.log(`\nGăsite ${filasEmpleado.length} rânduri pentru ${primerEmpleado}:`);
        
        // Grupăm după TURNO
        const porTurno = {};
        filasEmpleado.forEach((fila, idx) => {
          const turno = fila['TURNO'] || fila[columns[1]] || '';
          if (!porTurno[turno]) porTurno[turno] = [];
          porTurno[turno].push({ idx: idx + 1, data: fila });
        });
        
        Object.keys(porTurno).forEach(turno => {
          console.log(`\n  🔹 TURNO: "${turno}" (${porTurno[turno].length} rânduri)`);
          porTurno[turno].forEach(({ idx, data }) => {
            console.log(`\n    Rând ${idx}:`);
            // Extragem doar zilele cu valori (nu empty)
            const zileCuValori = [];
            for (let zi = 1; zi <= 31; zi++) {
              const colKey = `ZI_${zi}`;
              const val = data[colKey];
              if (val && val !== '' && val !== '0') {
                zileCuValori.push({ zi, val });
              }
            }
            
            if (zileCuValori.length > 0) {
              console.log(`      Zile cu valori: ${zileCuValori.length}`);
              // Afișăm primele 10 și ultimele 5
              const primele = zileCuValori.slice(0, 10);
              const ultimele = zileCuValori.length > 15 ? zileCuValori.slice(-5) : [];
              
              console.log(`      ${primele.map(({zi, val}) => `ZI_${zi}=${val}`).join(', ')}${ultimele.length > 0 ? ` ... ${ultimele.map(({zi, val}) => `ZI_${zi}=${val}`).join(', ')}` : ''}`);
            } else {
              console.log(`      (toate zilele sunt goale)`);
            }
          });
        });
        
        // Construim orarul final pentru angajat (combinând rândurile)
        console.log(`\n📅 ORARUL FINAL PENTRU: "${primerEmpleado}"`);
        console.log('═'.repeat(80));
        
        const orarFinal = {};
        for (let zi = 1; zi <= 31; zi++) {
          const colKey = `ZI_${zi}`;
          orarFinal[zi] = {
            turnoM: [],
            turnoT: []
          };
          
          filasEmpleado.forEach(fila => {
            const turno = fila['TURNO'] || '';
            const val = fila[colKey];
            if (val && val !== '' && val !== '0') {
              if (turno === 'M') {
                orarFinal[zi].turnoM.push(val);
              } else if (turno === 'T') {
                orarFinal[zi].turnoT.push(val);
              }
            }
          });
        }
        
        // Afișăm orarul pe zile
        console.log('\nZi | TURNO M (Mañana)                    | TURNO T (Tarde)');
        console.log('─'.repeat(80));
        for (let zi = 1; zi <= 31; zi++) {
          const m = orarFinal[zi].turnoM.length > 0 ? orarFinal[zi].turnoM.join(' / ') : '(gol)';
          const t = orarFinal[zi].turnoT.length > 0 ? orarFinal[zi].turnoT.join(' / ') : '(gol)';
          if (m !== '(gol)' || t !== '(gol)') {
            console.log(`${String(zi).padStart(2)} | ${m.padEnd(35)} | ${t}`);
          }
        }
        
        // Deducem turele pe baza timpilor
        console.log(`\n🔍 ANALIZĂ TURE PENTRU: "${primerEmpleado}"`);
        console.log('═'.repeat(80));
        
        for (let zi = 1; zi <= 31; zi++) {
          const m = orarFinal[zi].turnoM;
          const t = orarFinal[zi].turnoT;
          
          if (m.length > 0 || t.length > 0) {
            let turaDedusa = '';
            
            // Analizăm TURNO M
            if (m.length >= 2) {
              const he = m[0]; // Hora Entrada
              const hs = m[1] || m[0]; // Hora Salida
              
              if (he.includes('06:45') || he.includes('07:00')) {
                if (hs.includes('14:45') || hs.includes('15:00')) {
                  turaDedusa = 'T1 (Mañana: 7:00-15:00)';
                }
              } else if (he.includes('14:45') || he.includes('15:00')) {
                if (hs.includes('22:45') || hs.includes('23:00')) {
                  turaDedusa = 'T2 (Tarde: 15:00-23:00)';
                }
              } else if (he === 'L') {
                turaDedusa = 'LIBRE';
              }
            } else if (m.length === 1) {
              if (m[0] === 'L') {
                turaDedusa = 'LIBRE';
              } else {
                turaDedusa = `M: ${m[0]}`;
              }
            }
            
            // Analizăm TURNO T
            if (t.length >= 2) {
              const he = t[0];
              const hs = t[1] || t[0];
              
              if (he.includes('22:45') || he.includes('23:00')) {
                if (hs.includes('06:45') || hs.includes('07:00')) {
                  turaDedusa = (turaDedusa ? turaDedusa + ' + ' : '') + 'T3 (Noche: 23:00-7:00)';
                }
              } else if (he.includes('14:45') || he.includes('15:00')) {
                if (hs.includes('22:45') || hs.includes('23:00')) {
                  turaDedusa = (turaDedusa ? turaDedusa + ' + ' : '') + 'T2 (Tarde: 15:00-23:00)';
                }
              }
            } else if (t.length === 1 && t[0] !== 'L') {
              turaDedusa = (turaDedusa ? turaDedusa + ' + ' : '') + `T: ${t[0]}`;
            }
            
            if (turaDedusa || m.length > 0 || t.length > 0) {
              console.log(`  ZI_${String(zi).padStart(2)}: ${turaDedusa || (m.length > 0 ? `M: ${m.join(', ')}` : '')} ${t.length > 0 ? `T: ${t.join(', ')}` : ''}`);
            }
          }
        }
        
      } else {
        console.log('  ⚠️ Nu s-au găsit nume de angajați în coloana TRABAJADOR');
      }
      
      // Analizăm tipurile de valori (din dataFormatted)
      const uniqueValues = new Set();
      dataFormatted.slice(0, 50).forEach(row => {
        Object.entries(row).forEach(([key, val]) => {
          // Skip coloana TRABAJADOR și TOTAL
          if (key === 'TRABAJADOR' || key === 'TOTAL' || key.includes('TOTAL')) return;
          
          if (val && val !== '' && String(val) !== 'undefined') {
            const valStr = String(val).trim();
            if (valStr && valStr.length < 15 && !valStr.includes('GMT')) {
              uniqueValues.add(valStr);
            }
          }
        });
      });
      console.log('\n🔍 Valori unice găsite (ture, timpi, etc.):');
      const sortedValues = Array.from(uniqueValues).sort();
      console.log(sortedValues.join(', '));
      
      // Verificăm câte valori de fiecare tip
      const timePatterns = /^\d{1,2}:\d{2}$/; // Pattern pentru timpi: "7:00", "15:00", etc.
      const times = sortedValues.filter(v => timePatterns.test(v));
      const letters = sortedValues.filter(v => /^[A-Z]$/.test(v));
      const numbers = sortedValues.filter(v => /^\d+$/.test(v));
      
      console.log('\n📊 Tipuri de valori:');
      console.log(`  ⏰ Timpi (HH:MM): ${times.length} - ${times.slice(0, 10).join(', ')}`);
      console.log(`  🔤 Litere: ${letters.length} - ${letters.join(', ')}`);
      console.log(`  🔢 Numere: ${numbers.length} - ${numbers.slice(0, 10).join(', ')}`);
      
      if (times.length > 0) {
        console.log('\n✅ TIMPI IDENTIFICAȚI (3 ture):');
        times.forEach(time => {
          const hour = parseInt(time.split(':')[0]);
          if (hour === 7 || hour === 15 || hour === 23) {
            let turno = '';
            if (hour === 7) turno = 'T1 (Mañana)';
            else if (hour === 15) turno = 'T2 (Tarde)';
            else if (hour === 23) turno = 'T3 (Noche)';
            console.log(`  ${time} = ${turno}`);
          }
        });
      }
      
      // Extragem header-ul cu zilele lunii
      const headerRow = data.find(row => row[columns[0]] === 'TURNO');
      const dayMapping = {};
      if (headerRow) {
        ['J', 'V', 'S', 'D', 'L', 'M', 'X'].forEach(col => {
          const dayNum = headerRow[col];
          if (dayNum && !isNaN(parseInt(dayNum))) {
            dayMapping[col] = parseInt(dayNum);
          }
        });
      }
      console.log('\n📅 Mapping zile lunii din header:');
      console.log(JSON.stringify(dayMapping, null, 2));
      
      // Grupăm după "TOTAL" - fiecare grup = o secțiune cu 3 ture
      const grupos = [];
      let currentGrupo = [];
      
      data.forEach((row, index) => {
        const primeraCol = (row[columns[0]] || '').trim();
        
        if (primeraCol === 'TURNO' || primeraCol === 'DIAS DE LA SEMANA') {
          return; // Skip header
        }
        
        if (primeraCol === 'TOTAL') {
          if (currentGrupo.length > 0) {
            grupos.push([...currentGrupo]);
            currentGrupo = [];
          }
        } else if (primeraCol && primeraCol.length <= 3) {
          // M sau T (ture) sau nume scurt
          currentGrupo.push({ row: index + 1, type: primeraCol, data: row });
        }
      });
      
      if (currentGrupo.length > 0) {
        grupos.push(currentGrupo);
      }
      
      console.log(`\n🔍 Găsite ${grupos.length} grupe de ture:`);
      grupos.forEach((grupo, gIndex) => {
        console.log(`\n  📦 Grupa ${gIndex + 1} (${grupo.length} rânduri):`);
        grupo.forEach((item, iIndex) => {
          const valores = ['J', 'V', 'S', 'D', 'L', 'M', 'X'].map(col => {
            const val = item.data[col];
            // Convertim date-uri greșite (1899-12-30) sau le păstrăm ca string
            if (val && val.toString().includes('1899-12-30')) {
              return '?'; // Probabil o oră/valoare interpretată greșit
            }
            return val || '';
          }).join(', ');
          console.log(`    ${iIndex + 1}. [${item.type}] Rând ${item.row}: ${valores}`);
        });
      });
      
      // Căutăm și nume de angajați (mai lungi)
      console.log('\n👤 Rânduri care ar putea fi nume de angajați:');
      data.forEach((row, index) => {
        const primeraCol = (row[columns[0]] || '').trim();
        if (primeraCol && primeraCol.length > 3 && primeraCol !== 'TURNO' && primeraCol !== 'TOTAL' && primeraCol !== 'DIAS DE LA SEMANA') {
          const valores = ['J', 'V', 'S', 'D', 'L', 'M', 'X'].map(col => {
            const val = row[col];
            if (val && val.toString().includes('1899-12-30')) return '?';
            return val || '';
          }).join(', ');
          console.log(`  Rând ${index + 1}: "${primeraCol}" → ${valores}`);
        }
      });
      
      // Verificăm dacă există coloane ZI_1, ZI_2, etc.
      const ziColumns = columns.filter(col => /^ZI_\d+$/.test(col));
      if (ziColumns.length > 0) {
        console.log(`\n📅 Coloane ZI găsite: ${ziColumns.length}`);
        console.log(`   Primele: ${ziColumns.slice(0, 5).join(', ')}...`);
        console.log(`   Ultimele: ...${ziColumns.slice(-5).join(', ')}`);
      }
      
      // Verificăm coloane importante pentru cuadrante
      const importantColumns = ['CODIGO', 'EMAIL', 'NOMBRE', 'LUNA', 'CENTRO', 'TotalHoras'];
      const foundImportant = importantColumns.filter(col => 
        columns.some(c => c.toUpperCase().includes(col.toUpperCase()))
      );
      console.log(`\n✅ Coloane importante găsite: ${foundImportant.join(', ')}`);
      
      // Căutăm coloane care ar putea fi nume
      const possibleNameColumns = columns.filter(col => 
        /NOMBRE|APELLIDOS|NAME|NOM|EMPLEADO|OPERARIO/i.test(col)
      );
      if (possibleNameColumns.length > 0) {
        console.log(`\n👤 Coloane care ar putea fi nume: ${possibleNameColumns.join(', ')}`);
      }
    }
    
    console.log('\n✅ Analiză completă!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Eroare la citirea Excel-ului:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
