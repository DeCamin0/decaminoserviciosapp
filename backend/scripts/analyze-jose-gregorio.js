const fs = require('fs');
const path = require('path');

const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

const pdfPath = path.join(__dirname, '../../finiquito/finiquito jose gregorio.pdf');

async function analyzePDF() {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const textResult = await pdfInstance.getText();
    const text = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');
    
    const textLower = text.toLowerCase();
    
    console.log('📄 TEXTUL COMPLET DIN "finiquito jose gregorio.pdf":');
    console.log('='.repeat(100));
    console.log(text);
    console.log('='.repeat(100));
    
    // Căutăm toate pattern-urile relevante
    console.log('\n🔍 PATTERN-URI RELEVANTE:');
    console.log('='.repeat(100));
    
    const patterns = {
      'liquidación, baja y finiquito': textLower.includes('liquidación, baja y finiquito'),
      'liquidación baja y finiquito': textLower.includes('liquidación baja y finiquito'),
      'liquidación, baja y finiquito por todos los conceptos': textLower.includes('liquidación, baja y finiquito por todos los conceptos'),
      'por todos los conceptos hasta el día de hoy': textLower.includes('por todos los conceptos hasta el día de hoy'),
      'en el que se extingue la relación laboral': textLower.includes('en el que se extingue la relación laboral'),
      'se extingue la relación laboral': textLower.includes('se extingue la relación laboral'),
      'período de liquidación': textLower.includes('período de liquidación') || textLower.includes('periodo de liquidación'),
      'finiquito': textLower.includes('finiquito'),
      'finiquitar': textLower.includes('finiquitar'),
      'falta preaviso': textLower.includes('falta preaviso') || textLower.includes('falta de preaviso'),
      'vacaciones disfrutadas': textLower.includes('vacaciones disfrutadas'),
      'recibo de salarios': textLower.includes('recibo de salarios') || textLower.includes('recibo de salario'),
      'nómina': textLower.includes('nómina') || textLower.includes('nomina'),
    };
    
    for (const [pattern, found] of Object.entries(patterns)) {
      console.log(`   ${found ? '✅' : '❌'} "${pattern}": ${found}`);
      
      if (found) {
        const index = textLower.indexOf(pattern);
        if (index !== -1) {
          const context = text.substring(Math.max(0, index - 100), Math.min(text.length, index + pattern.length + 200));
          console.log(`      Context: "${context}"`);
        }
      }
    }
    
    // Căutăm zona cu "liquidación"
    const indexLiquidacion = textLower.indexOf('liquidación');
    if (indexLiquidacion !== -1) {
      console.log('\n📋 ZONA CU "liquidación" (500 caractere):');
      console.log('='.repeat(100));
      console.log(text.substring(Math.max(0, indexLiquidacion - 100), Math.min(text.length, indexLiquidacion + 400)));
      console.log('='.repeat(100));
    }
    
    // Căutăm zona cu "finiquito"
    const indexFiniquito = textLower.indexOf('finiquito');
    if (indexFiniquito !== -1) {
      console.log('\n📋 ZONA CU "finiquito" (500 caractere):');
      console.log('='.repeat(100));
      console.log(text.substring(Math.max(0, indexFiniquito - 100), Math.min(text.length, indexFiniquito + 400)));
      console.log('='.repeat(100));
    } else {
      console.log('\n❌ Cuvântul "finiquito" NU a fost găsit în text!');
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
  }
}

analyzePDF();

