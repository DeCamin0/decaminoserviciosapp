// Test direct pe PDF-ul SOPORTE
const fs = require('fs');
const path = require('path');

async function analyzePdf() {
  // pdf-parse este în backend/node_modules
  const pdfPath = path.join(__dirname, 'SOPORTE DE CAMINO ENERO 2026V.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found at:', pdfPath);
    return;
  }

  console.log('📄 Reading PDF:', pdfPath);
  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log('   PDF size:', pdfBuffer.length, 'bytes\n');

  try {
    const pdfParse = require('pdf-parse');
    const PDFParse = pdfParse.PDFParse;
    
    const pdfInstance = new PDFParse({
      data: new Uint8Array(pdfBuffer),
    });
    
    const textResult = await pdfInstance.getText();
    const text = textResult && typeof textResult === 'object' && 'text' in textResult
      ? textResult.text
      : typeof textResult === 'string'
      ? textResult
      : '';

    console.log('✅ Text extracted, length:', text.length);
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('Total lines:', lines.length);
    
    // Caută IBAN-uri
    const ibanPattern = /ES\d{22}|[A-Z]{2}\d{2,30}/g;
    const ibans = [];
    for (const line of lines) {
      const cleanLine = line.replace(/\s+/g, '');
      const matches = cleanLine.match(ibanPattern);
      if (matches) {
        for (const match of matches) {
          const normalized = match.replace(/\s+/g, '').toUpperCase();
          if (normalized.length >= 15 && normalized.length <= 34 && /^[A-Z]{2}\d+$/.test(normalized)) {
            if (!ibans.includes(normalized)) {
              ibans.push(normalized);
            }
          }
        }
      }
    }
    console.log('\n✅ Found IBANs:', ibans.length);
    
    // Analizează structura pentru primele 10 IBAN-uri
    console.log('\n=== STRUCTURE ANALYSIS (first 10 IBANs) ===\n');
    for (let i = 0; i < Math.min(10, ibans.length); i++) {
      const iban = ibans[i];
      console.log(`\n--- IBAN ${i + 1}: ${iban} ---`);
      
      // Găsește linia cu IBAN-ul
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].replace(/\s+/g, '').includes(iban)) {
          console.log(`\nLine ${j} (WITH IBAN): "${lines[j]}"`);
          
          // Arată liniile dinainte (10 linii)
          console.log('\nLines BEFORE (10 lines):');
          for (let k = Math.max(0, j - 10); k < j; k++) {
            console.log(`  [${k}] "${lines[k]}"`);
          }
          
          // Arată liniile după (3 linii)
          console.log('\nLines AFTER (3 lines):');
          for (let k = j + 1; k < Math.min(lines.length, j + 4); k++) {
            console.log(`  [${k}] "${lines[k]}"`);
          }
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

analyzePdf().catch(console.error);
