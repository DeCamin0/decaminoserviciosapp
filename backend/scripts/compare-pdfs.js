const fs = require('fs');
const path = require('path');

const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

const finiquitoPath = path.join(__dirname, '../../x.pdf');
const nominaPath = path.join(__dirname, '../../nomina_1179.pdf');

async function readPDF(filePath, label) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const textResult = await pdfInstance.getText();
    const text = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');
    
    return text;
  } catch (error) {
    console.error(`❌ Eroare la citirea ${label}:`, error.message);
    return '';
  }
}

async function comparePDFs() {
  console.log('📄 Citire PDF-uri...\n');
  
  const finiquitoText = await readPDF(finiquitoPath, 'FINIQUITO (x.pdf)');
  const nominaText = await readPDF(nominaPath, 'NÓMINA (nomina_1179.pdf)');
  
  const finiquitoLower = finiquitoText.toLowerCase();
  const nominaLower = nominaText.toLowerCase();
  
  console.log('='.repeat(100));
  console.log('📊 ANALIZĂ COMPARATIVĂ: FINIQUITO vs NÓMINA');
  console.log('='.repeat(100));
  
  // 1. Lungime text
  console.log('\n1️⃣ LUNGIME TEXT:');
  console.log(`   FINIQUITO: ${finiquitoText.length} caractere`);
  console.log(`   NÓMINA:    ${nominaText.length} caractere`);
  
  // 2. Primele 500 caractere din fiecare
  console.log('\n2️⃣ PRIMELE 500 CARACTERE:');
  console.log('\n--- FINIQUITO (x.pdf) ---');
  console.log(finiquitoText.substring(0, 500));
  console.log('\n--- NÓMINA (nomina_1179.pdf) ---');
  console.log(nominaText.substring(0, 500));
  
  // 3. Căutăm pattern-uri specifice
  console.log('\n3️⃣ PATTERN-URI SPECIFICE:');
  
  const patterns = {
    'liquidación, baja y finiquito': {
      finiquito: finiquitoLower.includes('liquidación, baja y finiquito'),
      nomina: nominaLower.includes('liquidación, baja y finiquito'),
    },
    'por todos los conceptos hasta el día de hoy': {
      finiquito: finiquitoLower.includes('por todos los conceptos hasta el día de hoy'),
      nomina: nominaLower.includes('por todos los conceptos hasta el día de hoy'),
    },
    'en el que se extingue la relación laboral': {
      finiquito: finiquitoLower.includes('en el que se extingue la relación laboral'),
      nomina: nominaLower.includes('en el que se extingue la relación laboral'),
    },
    'se suspende la relación laboral': {
      finiquito: finiquitoLower.includes('se suspende la relación laboral'),
      nomina: nominaLower.includes('se suspende la relación laboral'),
    },
    'período de liquidación': {
      finiquito: finiquitoLower.includes('período de liquidación') || finiquitoLower.includes('periodo de liquidación'),
      nomina: nominaLower.includes('período de liquidación') || nominaLower.includes('periodo de liquidación'),
    },
    'recibo de salarios': {
      finiquito: finiquitoLower.includes('recibo de salarios') || finiquitoLower.includes('recibo de salario'),
      nomina: nominaLower.includes('recibo de salarios') || nominaLower.includes('recibo de salario'),
    },
    'nómina': {
      finiquito: finiquitoLower.includes('nómina') || finiquitoLower.includes('nomina'),
      nomina: nominaLower.includes('nómina') || nominaLower.includes('nomina'),
    },
    'finiquito': {
      finiquito: finiquitoLower.includes('finiquito'),
      nomina: nominaLower.includes('finiquito'),
    },
    'finiquitar': {
      finiquito: finiquitoLower.includes('finiquitar'),
      nomina: nominaLower.includes('finiquitar'),
    },
    'cese de actividad': {
      finiquito: finiquitoLower.includes('cese de actividad'),
      nomina: nominaLower.includes('cese de actividad'),
    },
    'extinción del contrato': {
      finiquito: finiquitoLower.includes('extinción del contrato'),
      nomina: nominaLower.includes('extinción del contrato'),
    },
    'indemnización': {
      finiquito: finiquitoLower.includes('indemnización'),
      nomina: nominaLower.includes('indemnización'),
    },
    'fecha de baja': {
      finiquito: finiquitoLower.includes('fecha de baja'),
      nomina: nominaLower.includes('fecha de baja'),
    },
  };
  
  for (const [pattern, results] of Object.entries(patterns)) {
    const finiquitoHas = results.finiquito ? '✅' : '❌';
    const nominaHas = results.nomina ? '✅' : '❌';
    console.log(`   "${pattern}":`);
    console.log(`      FINIQUITO: ${finiquitoHas}`);
    console.log(`      NÓMINA:    ${nominaHas}`);
    
    // Dacă pattern-ul apare în finiquito dar NU în nómina, este un indicator bun
    if (results.finiquito && !results.nomina) {
      console.log(`      ⭐ EXCLUSIV FINIQUITO!`);
    }
    // Dacă pattern-ul apare în nómina dar NU în finiquito, este un indicator de nómina normală
    if (!results.finiquito && results.nomina) {
      console.log(`      ⭐ EXCLUSIV NÓMINA!`);
    }
  }
  
  // 4. Căutăm textul complet din chenarul finiquito-ului
  console.log('\n4️⃣ TEXTUL COMPLET DIN CHENARUL FINIQUITO-ULUI:');
  const textoCompleto = 'liquidación, baja y finiquito por todos los conceptos hasta el día de hoy';
  const tieneTextoCompletoFiniquito = finiquitoLower.includes(textoCompleto);
  const tieneTextoCompletoNomina = nominaLower.includes(textoCompleto);
  
  console.log(`   FINIQUITO: ${tieneTextoCompletoFiniquito ? '✅' : '❌'}`);
  console.log(`   NÓMINA:    ${tieneTextoCompletoNomina ? '✅' : '❌'}`);
  
  if (tieneTextoCompletoFiniquito && !tieneTextoCompletoNomina) {
    console.log(`   ⭐ TEXTUL COMPLET ESTE EXCLUSIV FINIQUITO!`);
  }
  
  // 5. Extragem secțiuni relevante pentru analiză
  console.log('\n5️⃣ SECȚIUNI RELEVANTE:');
  
  // Pentru finiquito - căutăm zona cu "liquidación"
  const finiquitoLiquidacionIndex = finiquitoLower.indexOf('liquidación');
  if (finiquitoLiquidacionIndex !== -1) {
    console.log('\n--- FINIQUITO: Zona "liquidación" (500 caractere) ---');
    console.log(finiquitoText.substring(Math.max(0, finiquitoLiquidacionIndex - 100), finiquitoLiquidacionIndex + 400));
  }
  
  // Pentru nómina - căutăm zona cu "período de liquidación"
  let nominaPeriodoIndex = nominaLower.indexOf('período de liquidación');
  if (nominaPeriodoIndex === -1) {
    nominaPeriodoIndex = nominaLower.indexOf('periodo de liquidación');
  }
  if (nominaPeriodoIndex !== -1) {
    console.log('\n--- NÓMINA: Zona "período de liquidación" (500 caractere) ---');
    console.log(nominaText.substring(Math.max(0, nominaPeriodoIndex - 100), nominaPeriodoIndex + 400));
  }
  
  // 6. Concluzii
  console.log('\n' + '='.repeat(100));
  console.log('📋 CONCLUZII:');
  console.log('='.repeat(100));
  
  const finiquitoExclusive = [];
  const nominaExclusive = [];
  
  for (const [pattern, results] of Object.entries(patterns)) {
    if (results.finiquito && !results.nomina) {
      finiquitoExclusive.push(pattern);
    }
    if (!results.finiquito && results.nomina) {
      nominaExclusive.push(pattern);
    }
  }
  
  console.log('\n✅ Pattern-uri EXCLUSIVE pentru FINIQUITO:');
  if (finiquitoExclusive.length > 0) {
    finiquitoExclusive.forEach(p => console.log(`   - "${p}"`));
  } else {
    console.log('   (Nu s-au găsit pattern-uri exclusive)');
  }
  
  console.log('\n✅ Pattern-uri EXCLUSIVE pentru NÓMINA:');
  if (nominaExclusive.length > 0) {
    nominaExclusive.forEach(p => console.log(`   - "${p}"`));
  } else {
    console.log('   (Nu s-au găsit pattern-uri exclusive)');
  }
  
  console.log('\n' + '='.repeat(100));
}

comparePDFs().catch(console.error);

