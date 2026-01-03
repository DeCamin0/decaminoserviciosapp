const fs = require('fs');
const path = require('path');

// Importăm pdf-parse (același modul folosit în gestoria.service.ts)
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

async function readFiniquitoPDF() {
  try {
    // Calea către PDF (în root-ul proiectului)
    const pdfPath = path.join(__dirname, '..', 'FINIQUITO JOSE ANTONIO NAVARRO - copia.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ PDF-ul nu a fost găsit la: ${pdfPath}`);
      return;
    }

    console.log(`📄 Citind PDF: ${pdfPath}\n`);
    
    // Citim buffer-ul PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Extragem textul
    const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const textResult = await pdfInstance.getText();
    const textContent = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');

    console.log('='.repeat(80));
    console.log('📄 TEXT COMPLET EXTRAS DIN FINIQUITO');
    console.log('='.repeat(80));
    console.log(textContent);
    console.log('='.repeat(80));
    console.log(`\n📊 Lungime text: ${textContent.length} caractere\n`);

    // Căutăm pattern-uri pentru Fecha Antigüedad
    console.log('🔍 Căutând "Fecha Antigüedad" sau "Antigüedad"...');
    const antiguedadPatterns = [
      /fecha\s+antigüedad/gi,
      /antigüedad/gi,
      /fecha.*antig/gi,
      /antig/gi
    ];
    
    let foundAntiguedad = false;
    for (const pattern of antiguedadPatterns) {
      const matches = textContent.match(pattern);
      if (matches) {
        console.log(`✅ Găsit pattern: ${pattern}`);
        console.log(`   Matches: ${matches.length}`);
        // Căutăm contextul în jurul match-ului
        const matchIndex = textContent.search(pattern);
        if (matchIndex !== -1) {
          const context = textContent.substring(
            Math.max(0, matchIndex - 100),
            Math.min(textContent.length, matchIndex + 200)
          );
          console.log(`   Context: ${context}\n`);
          foundAntiguedad = true;
        }
      }
    }

    // Căutăm pattern-uri pentru Fecha Baja
    console.log('🔍 Căutând "Fecha Baja" sau "Baja"...');
    const bajaPatterns = [
      /fecha\s+baja/gi,
      /baja/gi,
      /fecha.*baja/gi,
      /fecha\s+de\s+baja/gi
    ];
    
    let foundBaja = false;
    for (const pattern of bajaPatterns) {
      const matches = textContent.match(pattern);
      if (matches) {
        console.log(`✅ Găsit pattern: ${pattern}`);
        console.log(`   Matches: ${matches.length}`);
        // Căutăm contextul în jurul match-ului
        const matchIndex = textContent.search(pattern);
        if (matchIndex !== -1) {
          const context = textContent.substring(
            Math.max(0, matchIndex - 100),
            Math.min(textContent.length, matchIndex + 200)
          );
          console.log(`   Context: ${context}\n`);
          foundBaja = true;
        }
      }
    }

    // Căutăm date în format DD/MM/YYYY sau DD-MM-YYYY
    console.log('🔍 Căutând date (DD/MM/YYYY sau DD-MM-YYYY)...');
    const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
    const dates = textContent.match(datePattern);
    if (dates) {
      console.log(`✅ Găsite ${dates.length} date posibile:`);
      dates.forEach((date, index) => {
        const dateIndex = textContent.indexOf(date);
        const context = textContent.substring(
          Math.max(0, dateIndex - 50),
          Math.min(textContent.length, dateIndex + date.length + 50)
        );
        console.log(`   ${index + 1}. ${date} - Context: ${context}`);
      });
    }

    if (!foundAntiguedad && !foundBaja) {
      console.log('\n⚠️ Nu s-au găsit pattern-uri clare pentru "Fecha Antigüedad" sau "Fecha Baja"');
      console.log('   Verifică manual textul de mai sus pentru a identifica formatul exact.\n');
    }

  } catch (error) {
    console.error('❌ Eroare la citirea PDF:', error);
  }
}

readFiniquitoPDF();

