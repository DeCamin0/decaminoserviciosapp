const fs = require('fs');
const path = require('path');

const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

// Simulăm funcția detectarFiniquito din gestoria.service.ts
function detectarFiniquito(textContent) {
  const textLower = textContent.toLowerCase();
  
  // Pattern principal
  const textoCompletoFiniquito = 'liquidación, baja y finiquito por todos los conceptos hasta el día de hoy, en el que se extingue la relación laboral';
  
  if (textLower.includes(textoCompletoFiniquito)) {
    return { detected: true, reason: 'textul complet' };
  }
  
  // Pattern 1
  const parte1 = 'liquidación, baja y finiquito por todos los conceptos hasta el día de hoy';
  const parte2 = 'en el que se extingue la relación laboral';
  
  const tieneParte1 = textLower.includes(parte1);
  const tieneParte2 = textLower.includes(parte2);
  
  if (tieneParte1 && tieneParte2) {
    return { detected: true, reason: 'ambele părți' };
  }
  
  // Pattern 2
  const tieneLiquidacionBajaFiniquito = textLower.includes('liquidación, baja y finiquito');
  const tieneSeExtingue = textLower.includes('se extingue la relación laboral');
  const tienePeriodoLiquidacion = textLower.includes('período de liquidación') || textLower.includes('periodo de liquidación');
  
  if (tieneLiquidacionBajaFiniquito && tieneSeExtingue && !tienePeriodoLiquidacion) {
    return { detected: true, reason: 'liquidación + se extingue' };
  }
  
  // Pattern 3
  if (tieneLiquidacionBajaFiniquito && !tienePeriodoLiquidacion) {
    return { detected: true, reason: 'liquidación, fără período' };
  }
  
  // Pattern 4 - variante
  const varianteLiquidacion = [
    'liquidación baja y finiquito',
    'liquidación,baja y finiquito',
    'liquidación baja finiquito',
  ];
  
  for (const variante of varianteLiquidacion) {
    if (textLower.includes(variante)) {
      return { detected: true, reason: `variante: ${variante}` };
    }
  }
  
  // Pattern 5
  const tienePorTodosConceptos = textLower.includes('por todos los conceptos');
  const tieneHastaDiaHoy = textLower.includes('hasta el día de hoy') || textLower.includes('hasta el dia de hoy');
  
  if (tienePorTodosConceptos && tieneHastaDiaHoy && !tienePeriodoLiquidacion) {
    return { detected: true, reason: 'por todos los conceptos + hasta el día de hoy' };
  }
  
  // Pattern 5b
  const tieneLiquidacionTodosConceptos = textLower.includes('liquidación de todos los conceptos salariales');
  const tieneSeSuspende = textLower.includes('se suspende la relación laboral');
  
  if (tieneLiquidacionTodosConceptos && tieneSeSuspende) {
    const indexLiquidacionTodos = textLower.indexOf('liquidación de todos los conceptos salariales');
    const indexPeriodo = textLower.indexOf('período de liquidación');
    const indexPeriodoAlt = textLower.indexOf('periodo de liquidación');
    const indexPeriodoFinal = indexPeriodo !== -1 ? indexPeriodo : (indexPeriodoAlt !== -1 ? indexPeriodoAlt : -1);
    
    if (indexPeriodoFinal === -1 || indexLiquidacionTodos > indexPeriodoFinal) {
      return { detected: true, reason: 'liquidación de todos los conceptos salariales + se suspende (după período)' };
    }
  }
  
  // Pattern 5c
  if (tieneLiquidacionTodosConceptos && tieneHastaDiaHoy) {
    const indexLiquidacionTodos = textLower.indexOf('liquidación de todos los conceptos salariales');
    const indexPeriodo = textLower.indexOf('período de liquidación');
    const indexPeriodoAlt = textLower.indexOf('periodo de liquidación');
    const indexPeriodoFinal = indexPeriodo !== -1 ? indexPeriodo : (indexPeriodoAlt !== -1 ? indexPeriodoAlt : -1);
    
    if (indexPeriodoFinal === -1 || indexLiquidacionTodos > indexPeriodoFinal) {
      return { detected: true, reason: 'liquidación de todos los conceptos salariales + hasta el día de hoy (după período)' };
    }
  }
  
  // Pattern 6
  const tieneFaltaPreaviso = textLower.includes('falta preaviso') || textLower.includes('falta de preaviso');
  const tieneVacacionesDisfrutadas = textLower.includes('vacaciones disfrutadas');
  const tieneReciboSalarios = textLower.includes('recibo de salarios') || textLower.includes('recibo de salario');
  const tieneNomina = textLower.includes('nómina') || textLower.includes('nomina');
  
  if (tieneFaltaPreaviso && tieneVacacionesDisfrutadas && !tieneReciboSalarios && !tieneNomina) {
    return { detected: true, reason: 'FALTA PREAVISO + VACACIONES DISFRUTADAS' };
  }
  
  // Pattern 7
  const tieneFiniquitoWord = textLower.includes('finiquito') || textLower.includes('finiquitar');
  
  if (tieneFiniquitoWord && !tieneReciboSalarios && !tieneNomina && !tienePeriodoLiquidacion) {
    return { detected: true, reason: 'cuvântul "finiquito"' };
  }
  
  // Analizăm ce pattern-uri găsim
  const patterns = {
    tieneLiquidacionBajaFiniquito,
    tieneSeExtingue,
    tienePeriodoLiquidacion,
    tienePorTodosConceptos,
    tieneHastaDiaHoy,
    tieneFaltaPreaviso,
    tieneVacacionesDisfrutadas,
    tieneFiniquitoWord,
    tieneReciboSalarios,
    tieneNomina,
  };
  
  return { detected: false, reason: 'nu s-au găsit pattern-uri', patterns };
}

async function testPDF(pdfPath, label) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const textResult = await pdfInstance.getText();
    const text = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');
    
    const result = detectarFiniquito(text);
    
    // Căutăm textul relevant pentru debugging
    const textLower = text.toLowerCase();
    const indexFiniquito = textLower.indexOf('finiquito');
    const indexLiquidacion = textLower.indexOf('liquidación');
    
    let contextFiniquito = '';
    let contextLiquidacion = '';
    
    if (indexFiniquito !== -1) {
      contextFiniquito = text.substring(Math.max(0, indexFiniquito - 100), Math.min(text.length, indexFiniquito + 200));
    }
    
    if (indexLiquidacion !== -1) {
      contextLiquidacion = text.substring(Math.max(0, indexLiquidacion - 100), Math.min(text.length, indexLiquidacion + 200));
    }
    
    return {
      label,
      detected: result.detected,
      reason: result.reason,
      patterns: result.patterns || {},
      contextFiniquito,
      contextLiquidacion,
      textLength: text.length,
    };
  } catch (error) {
    return {
      label,
      detected: false,
      reason: `EROARE: ${error.message}`,
      patterns: {},
      contextFiniquito: '',
      contextLiquidacion: '',
      textLength: 0,
    };
  }
}

async function main() {
  const finiquitoDir = path.join(__dirname, '../../finiquito');
  const xPdfPath = path.join(__dirname, '../../x.pdf');
  
  console.log('📄 TESTARE DETECTARE FINIQUITO');
  console.log('='.repeat(100));
  
  const results = [];
  
  // Testăm x.pdf
  if (fs.existsSync(xPdfPath)) {
    const result = await testPDF(xPdfPath, 'x.pdf');
    results.push(result);
  }
  
  // Testăm toate PDF-urile din folderul finiquito
  if (fs.existsSync(finiquitoDir)) {
    const files = fs.readdirSync(finiquitoDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    
    for (const file of files) {
      const filePath = path.join(finiquitoDir, file);
      const result = await testPDF(filePath, file);
      results.push(result);
    }
  }
  
  // Afișăm rezultatele
  console.log('\n📊 REZULTATE:');
  console.log('='.repeat(100));
  
  let detectedCount = 0;
  let notDetectedCount = 0;
  
  for (const result of results) {
    const status = result.detected ? '✅' : '❌';
    console.log(`\n${status} ${result.label}`);
    console.log(`   Detectat: ${result.detected ? 'DA' : 'NU'}`);
    console.log(`   Motiv: ${result.reason}`);
    console.log(`   Lungime text: ${result.textLength} caractere`);
    
    if (!result.detected && result.patterns) {
      console.log(`   Pattern-uri găsite:`);
      for (const [key, value] of Object.entries(result.patterns)) {
        if (value) {
          console.log(`     - ${key}: ${value}`);
        }
      }
    }
    
    if (result.contextFiniquito) {
      console.log(`   Context "finiquito": "${result.contextFiniquito.substring(0, 150)}..."`);
    }
    
    if (result.contextLiquidacion && !result.contextFiniquito) {
      console.log(`   Context "liquidación": "${result.contextLiquidacion.substring(0, 150)}..."`);
    }
    
    if (result.detected) {
      detectedCount++;
    } else {
      notDetectedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(100));
  console.log(`📈 SUMAR: ${detectedCount} detectate, ${notDetectedCount} nedetectate`);
  console.log('='.repeat(100));
  
  // Dacă există PDF-uri nedetectate, afișăm detalii suplimentare
  if (notDetectedCount > 0) {
    console.log('\n🔍 ANALIZĂ DETALIATĂ PENTRU PDF-URI NEDETECTATE:');
    console.log('='.repeat(100));
    
    for (const result of results) {
      if (!result.detected) {
        console.log(`\n📄 ${result.label}:`);
        console.log(`   Text sample (primele 500 caractere):`);
        console.log(`   "${result.contextFiniquito || result.contextLiquidacion || 'N/A'}"`);
      }
    }
  }
}

main().catch(console.error);

