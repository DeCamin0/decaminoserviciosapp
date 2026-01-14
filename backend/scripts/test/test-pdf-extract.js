const fs = require('fs');
const path = require('path');

// Importăm pdf-parse
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

async function extractPDFText() {
  try {
    const pdfPath = path.join(__dirname, '..', 'FINIQUITO JOSE ANTONIO NAVARRO - copia.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF nu există la:', pdfPath);
      return;
    }

    console.log('📄 Citind PDF:', pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const pageTextResult = await pdfInstance.getText();
    const textContent = (pageTextResult && typeof pageTextResult === 'object' && 'text' in pageTextResult) 
      ? pageTextResult.text 
      : (typeof pageTextResult === 'string' ? pageTextResult : '');

    console.log('\n===========================================');
    console.log('TEXTUL COMPLET DIN PDF:');
    console.log('===========================================\n');
    console.log(textContent);
    console.log('\n===========================================');
    console.log('LUNGIME:', textContent.length, 'caractere');
    console.log('===========================================\n');

    // Căutăm pattern-uri specifice
    console.log('\n🔍 CĂUTĂRI SPECIFICE:\n');
    
    const patterns = [
      'LIQUIDO TOTAL A PERCIBIR',
      'LÍQUIDO TOTAL A PERCIBIR',
      'LIQUIDO A PERCIBIR',
      'TOTAL A DEDUCIR',
      'NETO',
      'APORTACIONES TRABAJADOR',
      'IRPF',
      'ENFERMEDAD DEVOLUCION',
      'EMBARGOS',
      'ANTICIPO',
      'ABSENTISMO',
      'SEG. SOCIAL EMPRESA',
      'SEGURIDAD SOCIAL EMPRESA',
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = textContent.match(regex);
      if (matches) {
        console.log(`✅ "${pattern}": găsit ${matches.length} ori`);
        // Găsim contextul (50 caractere înainte și după)
        const index = textContent.toLowerCase().indexOf(pattern.toLowerCase());
        if (index !== -1) {
          const context = textContent.substring(Math.max(0, index - 50), Math.min(textContent.length, index + 200));
          console.log(`   Context: "${context}"\n`);
        }
      } else {
        console.log(`❌ "${pattern}": NU găsit`);
      }
    }

    // Căutăm linii care conțin numere (valori monetare)
    console.log('\n💰 LINII CU VALORI MONETARE:\n');
    const lines = textContent.split('\n');
    
    // Căutăm contextul pentru "LIQUIDO TOTAL A PERCIBIR"
    console.log('\n🔍 CONTEXTUL PENTRU "LIQUIDO TOTAL A PERCIBIR":\n');
    lines.forEach((line, idx) => {
      if (line.toUpperCase().includes('LIQUIDO TOTAL A PERCIBIR')) {
        console.log(`Linia ${idx + 1}: "${line.trim()}"`);
        // Afișăm și următoarele 5 linii
        for (let j = 1; j <= 5 && idx + j < lines.length; j++) {
          console.log(`Linia ${idx + 1 + j}: "${lines[idx + j].trim()}"`);
        }
      }
    });
    
    // Căutăm contextul pentru "TOTAL APORTACIONES"
    console.log('\n🔍 CONTEXTUL PENTRU "TOTAL APORTACIONES":\n');
    lines.forEach((line, idx) => {
      if (line.toUpperCase().includes('TOTAL APORTACIONES')) {
        console.log(`Linia ${idx + 1}: "${line.trim()}"`);
        // Afișăm și următoarele 3 linii
        for (let j = 1; j <= 3 && idx + j < lines.length; j++) {
          console.log(`Linia ${idx + 1 + j}: "${lines[idx + j].trim()}"`);
        }
      }
    });
    
    // Căutăm contextul pentru "2. I.R.P.F."
    console.log('\n🔍 CONTEXTUL PENTRU "2. I.R.P.F.":\n');
    lines.forEach((line, idx) => {
      const lineUpper = line.toUpperCase();
      if ((lineUpper.includes('I.R.P.F.') || lineUpper.includes('IRPF')) && 
          (lineUpper.includes('2.') || lineUpper.startsWith('2 '))) {
        console.log(`Linia ${idx + 1}: "${line.trim()}"`);
        // Afișăm și următoarele 5 linii
        for (let j = 1; j <= 5 && idx + j < lines.length; j++) {
          console.log(`Linia ${idx + 1 + j}: "${lines[idx + j].trim()}"`);
        }
      }
    });

  } catch (error) {
    console.error('❌ Eroare:', error);
  }
}

extractPDFText();

