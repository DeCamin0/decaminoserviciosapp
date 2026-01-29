// Test script pentru pdf-parse
const fs = require('fs');
const path = require('path');

async function testPdfParse() {
  // Încercăm diferite moduri de import
  console.log('🔍 Testing pdf-parse import methods...\n');

  // Metoda 1: require direct
  try {
    console.log('1. Testing require("pdf-parse")...');
    const pdfParse1 = require('pdf-parse');
    console.log('   ✅ Type:', typeof pdfParse1);
    console.log('   ✅ Is function:', typeof pdfParse1 === 'function');
    if (typeof pdfParse1 === 'function') {
      console.log('   ✅ Direct function works!');
    } else if (pdfParse1.default) {
      console.log('   ✅ Has default export');
    } else {
      console.log('   ❌ Keys:', Object.keys(pdfParse1));
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }

  // Test cu PDF real
  const pdfPath = path.join(__dirname, '..', '..', 'SOPORTE DE CAMINO ENERO 2026V.pdf');
  if (fs.existsSync(pdfPath)) {
    console.log('\n📄 Testing with real PDF:', pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('   PDF size:', pdfBuffer.length, 'bytes');

    // Test cu require direct
    try {
      console.log('\n2. Testing extraction with require("pdf-parse")...');
      const pdfParse = require('pdf-parse');
      
      console.log('   pdfParse type:', typeof pdfParse);
      console.log('   pdfParse keys:', Object.keys(pdfParse || {}));
      
      if (typeof pdfParse === 'function') {
        const data = await pdfParse(pdfBuffer);
        console.log('   ✅ Success! Text length:', data.text.length);
        console.log('   ✅ First 500 chars:', data.text.substring(0, 500));
        
        // Caută IBAN-uri în text
        const ibanPattern = /ES\d{22}|[A-Z]{2}\d{2,30}/g;
        const ibans = data.text.match(ibanPattern);
        if (ibans) {
          console.log('   ✅ Found IBANs:', ibans.length);
          console.log('   IBANs:', ibans.slice(0, 5));
        } else {
          console.log('   ⚠️ No IBANs found with pattern');
        }
      } else if (pdfParse && typeof pdfParse.default === 'function') {
        const data = await pdfParse.default(pdfBuffer);
        console.log('   ✅ Success with default! Text length:', data.text.length);
        console.log('   ✅ First 500 chars:', data.text.substring(0, 500));
      } else {
        console.log('   ❌ pdfParse is not a function');
        console.log('   Type:', typeof pdfParse);
        if (pdfParse) {
          console.log('   Keys:', Object.keys(pdfParse));
        }
      }
    } catch (error) {
      console.log('   ❌ Error:', error.message);
      console.log('   Stack:', error.stack);
    }
  } else {
    console.log('\n⚠️ PDF file not found at:', pdfPath);
  }
}

testPdfParse().catch(console.error);
