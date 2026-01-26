const pdfParseModule = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '..', '..', 'DISMINUCION JORNADA.pdf');
const data = fs.readFileSync(pdfPath);

const PDFParse = pdfParseModule.PDFParse;
const pdfInstance = new PDFParse({
  data: new Uint8Array(data),
});

pdfInstance.getText().then(result => {
  const text = result && typeof result === 'object' && 'text' in result
    ? result.text
    : typeof result === 'string'
      ? result
      : '';
  
  console.log('PDF Text (first 5000 chars):');
  console.log(text.substring(0, 5000));
  console.log('\n--- Full text length:', text.length);
  
  // Look for name patterns
  console.log('\n--- Looking for name patterns ---');
  const namePatterns = [
    /d\.\/d[ñÑ]a\.\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})/i,
    /d\/d[ªa]\.?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})/i,
    /trabajador[\/a]?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})/i,
  ];
  
  namePatterns.forEach((pattern, i) => {
    const match = text.match(pattern);
    if (match) {
      console.log(`Pattern ${i} matched: "${match[1]}"`);
    }
  });
}).catch(err => {
  console.error('Error:', err);
});
