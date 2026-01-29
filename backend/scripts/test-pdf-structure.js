// Test script pentru a vedea structura exactă a PDF-ului SOPORTE
const fs = require('fs');
const path = require('path');

async function testPdfStructure() {
  const pdfPath = path.join(__dirname, '..', '..', 'SOPORTE DE CAMINO ENERO 2026V.pdf');
  
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
    console.log('\n=== FIRST 2000 CHARACTERS ===\n');
    console.log(text.substring(0, 2000));
    
    console.log('\n=== LINES ANALYSIS ===\n');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('Total lines:', lines.length);
    
    // Caută pattern-uri de IBAN
    console.log('\n=== IBAN PATTERNS ===\n');
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
    console.log('Found IBANs:', ibans.length);
    console.log('First 10 IBANs:', ibans.slice(0, 10));
    
    // Analizează structura în jurul primelor IBAN-uri
    console.log('\n=== STRUCTURE AROUND FIRST 5 IBANs ===\n');
    for (let i = 0; i < Math.min(5, ibans.length); i++) {
      const iban = ibans[i];
      console.log(`\n--- IBAN ${i + 1}: ${iban} ---`);
      
      // Găsește linia cu IBAN-ul
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].replace(/\s+/g, '').includes(iban)) {
          console.log('Line with IBAN:', j, ':', lines[j]);
          
          // Arată liniile dinainte (5 linii)
          console.log('Lines BEFORE (5 lines):');
          for (let k = Math.max(0, j - 5); k < j; k++) {
            console.log(`  [${k}] ${lines[k]}`);
          }
          
          // Arată linia cu IBAN
          console.log('Line WITH IBAN:');
          console.log(`  [${j}] ${lines[j]}`);
          
          // Arată liniile după (2 linii)
          console.log('Lines AFTER (2 lines):');
          for (let k = j + 1; k < Math.min(lines.length, j + 3); k++) {
            console.log(`  [${k}] ${lines[k]}`);
          }
          break;
        }
      }
    }
    
    // Caută pattern-uri pentru CODIGO (8 cifre)
    console.log('\n=== CODIGO PATTERNS (8 digits) ===\n');
    const codigoPattern = /\b(\d{8})\b/g;
    const codigos = [];
    for (const line of lines) {
      const matches = line.match(codigoPattern);
      if (matches) {
        codigos.push(...matches);
      }
    }
    console.log('Found CODIGOs:', codigos.length);
    console.log('First 10 CODIGOs:', codigos.slice(0, 10));
    
    // Analizează relația între CODIGO și IBAN
    console.log('\n=== RELATIONSHIP: CODIGO -> IBAN (first 5 examples) ===\n');
    for (let i = 0; i < Math.min(5, codigos.length); i++) {
      const codigo = codigos[i];
      console.log(`\n--- CODIGO: ${codigo} ---`);
      
      // Găsește linia cu CODIGO-ul
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].includes(codigo)) {
          console.log('Line with CODIGO:', j, ':', lines[j]);
          
          // Caută IBAN în liniile următoare (până la 10 linii)
          for (let k = j; k < Math.min(lines.length, j + 10); k++) {
            const line = lines[k].replace(/\s+/g, '');
            for (const iban of ibans) {
              if (line.includes(iban)) {
                console.log(`  -> Found IBAN ${iban} at line ${k}: ${lines[k]}`);
                break;
              }
            }
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

testPdfStructure().catch(console.error);
