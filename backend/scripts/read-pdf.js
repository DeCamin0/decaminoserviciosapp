const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '../../x.pdf');

async function readPDF() {
  try {
    const pdfParseModule = require('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Folosim PDFParse ca în gestoria.service.ts
    const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const textResult = await pdfInstance.getText();
    const text = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');
    
    console.log('📄 PDF Text (first 2000 chars):');
    console.log('='.repeat(80));
    console.log(text.substring(0, 2000));
    console.log('='.repeat(80));
    
    const textLower = text.toLowerCase();
    
    // Căutăm indicii de finiquito
    const finiquitoIndicators = [
      'finiquito',
      'finiquitar',
      'cese de actividad',
      'extinción del contrato',
      'liquidación',
      'fecha de baja',
      'fecha baja',
      'cese voluntario',
      'cese de trabajo',
      'despido',
      'rescisión',
      'finalización contrato',
      'total devengado',
      'total a percibir',
      'saldo a favor',
      'indemnización',
      'vacaciones no disfrutadas',
      'parte proporcional',
      'días de vacaciones',
      'días naturales',
      'base de cotización',
      'base reguladora'
    ];
    
    console.log('\n🔍 Analiză pentru finiquito:');
    console.log('='.repeat(80));
    
    const foundIndicators = [];
    finiquitoIndicators.forEach(indicator => {
      if (textLower.includes(indicator)) {
        foundIndicators.push(indicator);
      }
    });
    
    if (foundIndicators.length > 0) {
      console.log('✅ GĂSITE INDICII DE FINIQUITO:');
      foundIndicators.forEach(ind => console.log(`  - ${ind}`));
      console.log(`\n📊 Probabilitate: ${foundIndicators.length >= 3 ? 'FOARTE MARE' : foundIndicators.length >= 2 ? 'MARE' : 'MEDIE'}`);
    } else {
      console.log('❌ Nu s-au găsit indicii clare de finiquito');
    }
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Eroare la citirea PDF:', error.message);
  }
}

readPDF();

