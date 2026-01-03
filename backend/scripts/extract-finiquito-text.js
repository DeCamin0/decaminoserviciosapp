const fs = require('fs');
const path = require('path');

const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

const finiquitoPath = path.join(__dirname, '../../x.pdf');

async function extractFiniquitoText() {
  try {
    const dataBuffer = fs.readFileSync(finiquitoPath);
    const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const textResult = await pdfInstance.getText();
    const text = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');
    
    const textLower = text.toLowerCase();
    
    console.log('📄 TEXTUL COMPLET DIN FINIQUITO:');
    console.log('='.repeat(100));
    console.log(text);
    console.log('='.repeat(100));
    
    // Căutăm zona cu "liquidación, baja y finiquito"
    const index = textLower.indexOf('liquidación, baja y finiquito');
    if (index !== -1) {
      console.log('\n📋 ZONA CU "liquidación, baja y finiquito" (1000 caractere):');
      console.log('='.repeat(100));
      const start = Math.max(0, index - 200);
      const end = Math.min(text.length, index + 800);
      console.log(text.substring(start, end));
      console.log('='.repeat(100));
    }
    
    // Căutăm toate aparițiile textului relevant
    console.log('\n🔍 TOATE APARIȚIILE TEXTULUI RELEVANT:');
    console.log('='.repeat(100));
    
    const searchTerms = [
      'liquidación, baja y finiquito',
      'por todos los conceptos hasta el día de hoy',
      'en el que se extingue la relación laboral',
      'finiquito',
    ];
    
    for (const term of searchTerms) {
      const index = textLower.indexOf(term);
      if (index !== -1) {
        console.log(`\n✅ "${term}" găsit la index ${index}:`);
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + term.length + 100);
        console.log(`   Context: "${text.substring(start, end)}"`);
      } else {
        console.log(`\n❌ "${term}" NU a fost găsit`);
      }
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
  }
}

extractFiniquitoText();

