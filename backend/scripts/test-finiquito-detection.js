const fs = require('fs');
const path = require('path');

const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

// Simulăm funcția detectarFiniquito din gestoria.service.ts
function detectarFiniquito(textContent) {
  const textLower = textContent.toLowerCase();
  
  console.log(`🔍 Analizăm text (${textContent.length} caractere)`);
  
  // Pattern principal
  const textoCompletoFiniquito = 'liquidación, baja y finiquito por todos los conceptos hasta el día de hoy, en el que se extingue la relación laboral';
  
  if (textLower.includes(textoCompletoFiniquito)) {
    console.log(`✅ Finiquito detectat (textul complet)`);
    return true;
  }
  
  // Pattern 1
  const parte1 = 'liquidación, baja y finiquito por todos los conceptos hasta el día de hoy';
  const parte2 = 'en el que se extingue la relación laboral';
  
  const tieneParte1 = textLower.includes(parte1);
  const tieneParte2 = textLower.includes(parte2);
  
  console.log(`🔍 Pattern 1: parte1=${tieneParte1}, parte2=${tieneParte2}`);
  
  if (tieneParte1 && tieneParte2) {
    console.log(`✅ Finiquito detectat (ambele părți)`);
    return true;
  }
  
  // Pattern 2
  const tieneLiquidacionBajaFiniquito = textLower.includes('liquidación, baja y finiquito');
  const tieneSeExtingue = textLower.includes('se extingue la relación laboral');
  const tienePeriodoLiquidacion = textLower.includes('período de liquidación') || textLower.includes('periodo de liquidación');
  
  console.log(`🔍 Pattern 2: tieneLiquidacionBajaFiniquito=${tieneLiquidacionBajaFiniquito}, tieneSeExtingue=${tieneSeExtingue}, tienePeriodoLiquidacion=${tienePeriodoLiquidacion}`);
  
  if (tieneLiquidacionBajaFiniquito && tieneSeExtingue && !tienePeriodoLiquidacion) {
    console.log(`✅ Finiquito detectat (liquidación + se extingue)`);
    return true;
  }
  
  // Pattern 3
  if (tieneLiquidacionBajaFiniquito && !tienePeriodoLiquidacion) {
    console.log(`✅ Finiquito detectat (liquidación, fără período)`);
    return true;
  }
  
  // Pattern 4 - variante
  const varianteLiquidacion = [
    'liquidación baja y finiquito',
    'liquidación,baja y finiquito',
    'liquidación baja finiquito',
  ];
  
  for (const variante of varianteLiquidacion) {
    if (textLower.includes(variante)) {
      console.log(`✅ Finiquito detectat (variante: "${variante}")`);
      return true;
    }
  }
  
  // Pattern 5
  const tienePorTodosConceptos = textLower.includes('por todos los conceptos');
  const tieneHastaDiaHoy = textLower.includes('hasta el día de hoy') || textLower.includes('hasta el dia de hoy');
  
  console.log(`🔍 Pattern 5: tienePorTodosConceptos=${tienePorTodosConceptos}, tieneHastaDiaHoy=${tieneHastaDiaHoy}`);
  
  if (tienePorTodosConceptos && tieneHastaDiaHoy && !tienePeriodoLiquidacion) {
    console.log(`✅ Finiquito detectat (por todos los conceptos + hasta el día de hoy)`);
    return true;
  }
  
  // Căutăm cuvântul "finiquito"
  const indexFiniquito = textLower.indexOf('finiquito');
  if (indexFiniquito !== -1) {
    const contextFiniquito = textContent.substring(Math.max(0, indexFiniquito - 100), Math.min(textContent.length, indexFiniquito + 200));
    console.log(`🔍 Cuvântul "finiquito" găsit la index ${indexFiniquito}, context: "${contextFiniquito}"`);
  }
  
  console.log(`❌ Nu este finiquito`);
  return false;
}

async function testPDF(pdfPath, label) {
  try {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`📄 TEST: ${label}`);
    console.log(`${'='.repeat(100)}`);
    
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const textResult = await pdfInstance.getText();
    const text = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');
    
    const result = detectarFiniquito(text);
    
    console.log(`\n📊 REZULTAT: ${result ? '✅ FINIQUITO' : '❌ NU ESTE FINIQUITO'}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Eroare la testarea ${label}:`, error.message);
    return false;
  }
}

async function main() {
  const finiquitoPath = path.join(__dirname, '../../x.pdf');
  const nominaPath = path.join(__dirname, '../../nomina_1179.pdf');
  
  await testPDF(finiquitoPath, 'FINIQUITO (x.pdf)');
  await testPDF(nominaPath, 'NÓMINA (nomina_1179.pdf)');
}

main().catch(console.error);

