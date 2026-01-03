const fs = require('fs');
const path = require('path');

const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

const pdfPath = path.join(__dirname, '../../finiquito/finiquito jose gregorio.pdf');

async function testDetailed() {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const textResult = await pdfInstance.getText();
    const text = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');
    
    const textLower = text.toLowerCase();
    
    console.log('🔍 VERIFICARE DETALIATĂ INDEX-URI:');
    console.log('='.repeat(100));
    
    const indexLiquidacionTodos = textLower.indexOf('liquidación de todos los conceptos salariales');
    const indexSeSuspende = textLower.indexOf('se suspende la relación laboral');
    const indexHastaDiaHoy = textLower.indexOf('hasta el día de hoy');
    const indexPeriodo = textLower.indexOf('período de liquidación');
    const indexPeriodoAlt = textLower.indexOf('periodo de liquidación');
    const indexPeriodoFinal = indexPeriodo !== -1 ? indexPeriodo : (indexPeriodoAlt !== -1 ? indexPeriodoAlt : -1);
    
    console.log(`Index "liquidación de todos los conceptos salariales": ${indexLiquidacionTodos}`);
    console.log(`Index "se suspende la relación laboral": ${indexSeSuspende}`);
    console.log(`Index "hasta el día de hoy": ${indexHastaDiaHoy}`);
    console.log(`Index "período de liquidación": ${indexPeriodoFinal}`);
    
    if (indexLiquidacionTodos !== -1 && indexPeriodoFinal !== -1) {
      console.log(`\n✅ "liquidación de todos los conceptos salariales" apare DUPĂ "período de liquidación": ${indexLiquidacionTodos > indexPeriodoFinal}`);
    }
    
    if (indexLiquidacionTodos !== -1 && indexSeSuspende !== -1) {
      console.log(`\n✅ Pattern 5b: tieneLiquidacionTodosConceptos=${indexLiquidacionTodos !== -1}, tieneSeSuspende=${indexSeSuspende !== -1}`);
      if (indexPeriodoFinal === -1 || indexLiquidacionTodos > indexPeriodoFinal) {
        console.log(`✅ FINIQUITO DETECTAT (Pattern 5b)`);
      } else {
        console.log(`❌ Nu este detectat - "liquidación" apare ÎNAINTE de "período"`);
      }
    }
    
    if (indexLiquidacionTodos !== -1 && indexHastaDiaHoy !== -1) {
      console.log(`\n✅ Pattern 5c: tieneLiquidacionTodosConceptos=${indexLiquidacionTodos !== -1}, tieneHastaDiaHoy=${indexHastaDiaHoy !== -1}`);
      if (indexPeriodoFinal === -1 || indexLiquidacionTodos > indexPeriodoFinal) {
        console.log(`✅ FINIQUITO DETECTAT (Pattern 5c)`);
      } else {
        console.log(`❌ Nu este detectat - "liquidación" apare ÎNAINTE de "período"`);
      }
    }
    
    // Afișăm contextul
    if (indexLiquidacionTodos !== -1) {
      console.log(`\n📄 Context "liquidación de todos los conceptos salariales":`);
      console.log(text.substring(Math.max(0, indexLiquidacionTodos - 50), Math.min(text.length, indexLiquidacionTodos + 300)));
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
  }
}

testDetailed();

