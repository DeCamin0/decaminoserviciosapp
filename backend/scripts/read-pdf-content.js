/**
 * Script pentru a citi și analiza complet PDF-ul generat
 */

const fs = require('fs');
const path = require('path');

async function readPDFContent() {
  const pdfPath = path.join(__dirname, 'test-output', 'Registro_10000063_2026-01_test.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading PDF: ${pdfPath}\n`);
  
  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log(`📊 PDF Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`📊 Buffer length: ${pdfBuffer.length} bytes\n`);

  // Convertim buffer-ul la string pentru a căuta pattern-uri
  const pdfString = pdfBuffer.toString('latin1');
  
  // Căutăm pattern-uri pentru pagini
  console.log('🔍 Searching for page patterns...\n');
  
  const pagePatterns = pdfString.match(/\/Type\s*\/Page[^s]/g);
  console.log(`📄 Found /Type /Page patterns: ${pagePatterns ? pagePatterns.length : 0}`);
  
  // Căutăm /Count pentru numărul de pagini
  const countMatches = pdfString.match(/\/Count\s+(\d+)/g);
  if (countMatches) {
    countMatches.forEach((match, i) => {
      const count = match.match(/\d+/);
      console.log(`   Pattern ${i + 1}: ${count ? count[0] : 'N/A'} pages`);
    });
  }
  
  // Căutăm textul footer-ului
  console.log('\n🔍 Searching for footer text...\n');
  const footerText1 = 'Registro horario orientativo generado a partir de los fichajes del trabajador.';
  const footerText2 = 'La empresa no se responsabiliza de discrepancias con la jornada real trabajada.';
  
  const found1 = pdfString.includes(footerText1);
  const found2 = pdfString.includes(footerText2);
  
  console.log(`   "${footerText1.substring(0, 50)}..."`);
  console.log(`   Found: ${found1 ? '✅ YES' : '❌ NO'}\n`);
  
  console.log(`   "${footerText2.substring(0, 50)}..."`);
  console.log(`   Found: ${found2 ? '✅ YES' : '❌ NO'}\n`);
  
  // Căutăm pattern-uri pentru text
  console.log('🔍 Searching for text patterns...\n');
  const textPatterns = pdfString.match(/BT[\s\S]{0,200}ET/g);
  if (textPatterns) {
    console.log(`   Found ${textPatterns.length} text blocks`);
    // Afișăm primele 5 pentru a vedea ce conțin
    textPatterns.slice(0, 5).forEach((pattern, i) => {
      console.log(`\n   Text block ${i + 1}:`);
      // Extragem textul din pattern
      const textMatch = pattern.match(/\(([^)]+)\)/g);
      if (textMatch) {
        textMatch.slice(0, 3).forEach(t => console.log(`      ${t.substring(0, 80)}`));
      }
    });
  }
  
  // Căutăm pattern-uri pentru rect (fundal footer)
  console.log('\n🔍 Searching for rectangle patterns (footer background)...\n');
  const rectPatterns = pdfString.match(/re[\s\S]{0,50}/g);
  if (rectPatterns) {
    console.log(`   Found ${rectPatterns.length} rectangle patterns`);
    // Căutăm pattern-uri care ar putea fi footer (poziții mari Y)
    const footerRects = rectPatterns.filter(r => {
      // Căutăm pattern-uri cu valori mari (poziții Y mari pentru footer)
      return r.match(/7[0-9]{2}|8[0-9]{2}/);
    });
    console.log(`   Potential footer rectangles: ${footerRects.length}`);
  }
  
  // Căutăm pattern-uri pentru font și text
  console.log('\n🔍 Searching for font and text operations...\n');
  const fontPatterns = pdfString.match(/\/F[0-9]+\s+[0-9]+\s+Tf/g);
  if (fontPatterns) {
    console.log(`   Found ${fontPatterns.length} font operations`);
  }
  
  // Căutăm pattern-uri pentru /Kids (pagini)
  console.log('\n🔍 Searching for /Kids patterns (pages)...\n');
  const kidsMatches = pdfString.match(/\/Kids\s*\[([^\]]+)\]/g);
  if (kidsMatches) {
    kidsMatches.forEach((match, i) => {
      const refs = match.match(/\d+\s+\d+\s+R/g);
      console.log(`   Pattern ${i + 1}: ${refs ? refs.length : 0} page references`);
      if (refs) {
        refs.slice(0, 5).forEach(ref => console.log(`      ${ref}`));
      }
    });
  }
  
  // Căutăm pattern-uri pentru poziții Y mari (footer)
  console.log('\n🔍 Searching for high Y positions (potential footer)...\n');
  const yPositions = pdfString.match(/\s([7-8][0-9]{2}|9[0-9]{2})\s+Td/g);
  if (yPositions) {
    console.log(`   Found ${yPositions.length} high Y positions`);
    const uniqueY = [...new Set(yPositions.map(y => y.match(/\d+/)[0]))].sort((a, b) => b - a);
    console.log(`   Unique high Y positions: ${uniqueY.slice(0, 10).join(', ')}`);
  }
  
  // Căutăm pattern-uri pentru /MediaBox (dimensiuni pagină)
  console.log('\n🔍 Searching for /MediaBox (page dimensions)...\n');
  const mediaBoxMatches = pdfString.match(/\/MediaBox\s*\[([^\]]+)\]/g);
  if (mediaBoxMatches) {
    mediaBoxMatches.forEach((match, i) => {
      const coords = match.match(/\[([^\]]+)\]/)[1];
      console.log(`   Page ${i + 1} MediaBox: [${coords}]`);
    });
  }
}

readPDFContent().catch((error) => {
  console.error('❌ Fatal error:');
  console.error(error);
  process.exit(1);
});
