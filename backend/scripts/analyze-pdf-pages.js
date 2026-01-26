/**
 * Script pentru a analiza PDF-ul generat și a vedea câte pagini are și ce conținut
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

async function analyzePDF() {
  const pdfPath = path.join(__dirname, 'test-output', 'Registro_10000063_2026-01_test.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`📄 Analyzing PDF: ${pdfPath}\n`);
  
  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log(`📊 PDF Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`📊 Buffer length: ${pdfBuffer.length} bytes\n`);

  // Încercăm să citim PDF-ul cu pdf-parse sau pdfkit
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    
    console.log(`📄 PDF Info:`);
    console.log(`   - Number of pages: ${data.numpages}`);
    console.log(`   - Title: ${data.info?.Title || 'N/A'}`);
    console.log(`   - Author: ${data.info?.Author || 'N/A'}`);
    console.log(`   - Subject: ${data.info?.Subject || 'N/A'}\n`);
    
    console.log(`📝 Text content (first 500 chars):`);
    console.log(data.text.substring(0, 500));
    console.log('\n...\n');
    
    // Verificăm dacă există pagini goale
    if (data.numpages > 1) {
      console.log(`\n⚠️  WARNING: PDF has ${data.numpages} pages, but should have only 1 page with content!`);
      console.log(`   This suggests empty pages are being created.\n`);
    }
    
  } catch (error) {
    console.error('❌ Error parsing PDF:');
    console.error(error.message);
    
    // Alternativ, încercăm să citim direct din buffer
    console.log('\n🔍 Trying to analyze PDF structure directly...');
    
    // Căutăm pattern-uri în PDF care indică numărul de pagini
    const pdfString = pdfBuffer.toString('latin1');
    const pageMatches = pdfString.match(/\/Count\s+(\d+)/g);
    const kidsMatches = pdfString.match(/\/Kids\s*\[([^\]]+)\]/g);
    
    if (pageMatches) {
      console.log(`📄 Found /Count patterns: ${pageMatches.length}`);
      pageMatches.forEach((match, i) => {
        const count = match.match(/\d+/);
        console.log(`   Pattern ${i + 1}: ${count ? count[0] : 'N/A'} pages`);
      });
    }
    
    if (kidsMatches) {
      console.log(`📄 Found /Kids patterns: ${kidsMatches.length}`);
      kidsMatches.forEach((match, i) => {
        console.log(`   Pattern ${i + 1}: ${match.substring(0, 100)}...`);
      });
    }
    
    // Căutăm /Page pattern-uri
    const pagePatternMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
    if (pagePatternMatches) {
      console.log(`\n📄 Found /Type /Page patterns: ${pagePatternMatches.length}`);
      console.log(`   This indicates ${pagePatternMatches.length} page objects in the PDF`);
    }
  }
}

analyzePDF().catch((error) => {
  console.error('❌ Fatal error:');
  console.error(error);
  process.exit(1);
});
