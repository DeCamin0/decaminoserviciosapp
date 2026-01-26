const fs = require('fs');
const path = require('path');

// Importăm pdf-parse (același modul folosit în gestoria.service.ts)
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

/**
 * Analizează un PDF și încearcă să extragă numele angajatului
 * Usage: node analyze-pdf-empleado.js <path-to-pdf>
 */
async function analyzePDFEmpleado(pdfPath) {
  try {
    // Verifică dacă fișierul există
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ PDF-ul nu a fost găsit la: ${pdfPath}`);
      console.log('\n💡 Usage: node analyze-pdf-empleado.js <path-to-pdf>');
      console.log('   Exemplu: node analyze-pdf-empleado.js "SELLO YUSBEL.pdf"');
      return;
    }

    console.log(`📄 Analizând PDF: ${pdfPath}\n`);
    console.log('='.repeat(80));
    
    // Citim buffer-ul PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`📊 Dimensiune PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);
    
    // Extragem textul
    const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const textResult = await pdfInstance.getText();
    const textContent = (textResult && typeof textResult === 'object' && 'text' in textResult) 
      ? textResult.text 
      : (typeof textResult === 'string' ? textResult : '');

    console.log('='.repeat(80));
    console.log('📝 TEXTUL EXTRAS DIN PDF:');
    console.log('='.repeat(80));
    console.log(textContent);
    console.log('='.repeat(80));
    console.log(`\n📊 Lungime text: ${textContent.length} caractere\n`);

    // Analizăm filename
    const filename = path.basename(pdfPath);
    console.log('='.repeat(80));
    console.log('🔍 ANALIZA FILENAME:');
    console.log('='.repeat(80));
    console.log(`Filename: ${filename}`);
    
    // Extragem nume din filename
    const filenamePatterns = [
      /(?:sello|alta|baja|contrato|nomina|liquidacion)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\.|$)/i,
      /(?:sello|alta|baja|contrato|nomina|liquidacion)\s+([a-záéíóúñ][a-záéíóúñ\s]+?)(?:\.|$)/i,
    ];

    let nombreFromFilename = null;
    for (const pattern of filenamePatterns) {
      const match = filename.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length >= 3 && !/^\d+$/.test(name)) {
          nombreFromFilename = name;
          console.log(`✅ Nume extras din filename: "${nombreFromFilename}"`);
          break;
        }
      }
    }

    if (!nombreFromFilename) {
      console.log('⚠️ Nu s-a putut extrage nume din filename');
    }

    // Analizăm textul PDF pentru nume - folosim pattern-urile din cod
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ANALIZA TEXT PDF PENTRU NUME (cu pattern-urile din cod):');
    console.log('='.repeat(80));

    // Pattern-urile din document-classifier.util.ts
    const trabajadorPatterns = [
      // Pattern 1: "D/Dª" followed by name on next line (PRIORITY - most common in SELLO documents)
      /d\/d[ªa]\.?\s*:?\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*\n|\s*NIF|\s*NIE|\s*Fecha)/i,
      // Pattern 2: "DATOS DEL/LA TRABAJADOR/A" section followed by "D/Dª" and name
      /(?:datos\s+del\/?la\s+trabajador\/?a)\s*:?\s*\n?\s*d\/d[ªa]\.?\s*:?\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*\n|\s*NIF|\s*NIE|\s*Fecha)/i,
      // Pattern 3: "D/Dª" or "D/Da" (lowercase) on same line or next line, followed by name
      /d\/d[ªa]\.?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*\n\s*NIF|\s*\n\s*NIE|\s*\n\s*Fecha|\s*NIF|\s*NIE|\s*Fecha|$)/i,
    ];

    let nombreFromText = null;
    for (let i = 0; i < trabajadorPatterns.length; i++) {
      const pattern = trabajadorPatterns[i];
      const match = textContent.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        
        // Verificări din cod
        if (/^o\s+/i.test(name)) {
          console.log(`⏭️ Pattern ${i+1} - Rejected (starts with "o "): "${name}"`);
          continue;
        }
        
        const matchIndex = match.index || 0;
        const contextBefore = textContent.substring(Math.max(0, matchIndex - 50), matchIndex).toLowerCase();
        if (contextBefore.includes('nombre o razón') || contextBefore.includes('razón social')) {
          console.log(`⏭️ Pattern ${i+1} - Rejected (from "Nombre o Razón" context): "${name}"`);
          continue;
        }
        
        const containsRazonSocial = /raz[óo]n|social|empresa|camino|servicios|auxiliares/i.test(name);
        if (containsRazonSocial) {
          console.log(`⏭️ Pattern ${i+1} - Rejected (contains false positive): "${name}"`);
          continue;
        }
        
        nombreFromText = name;
        console.log(`✅ Pattern ${i+1} - Nume extras din text: "${nombreFromText}"`);
        console.log(`   Match index: ${matchIndex}, Context before: "${contextBefore.substring(Math.max(0, contextBefore.length - 30))}"`);
        break;
      } else {
        console.log(`❌ Pattern ${i+1} - Nu s-a potrivit`);
      }
    }

    if (!nombreFromText) {
      console.log('⚠️ Nu s-a putut extrage nume din textul PDF cu pattern-urile din cod');
    }

    // Căutăm și alte pattern-uri comune
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ALTE PATTERN-URI IDENTIFICATE:');
    console.log('='.repeat(80));

    // Căutăm cuvinte mari (posibile nume)
    const palabrasGrandes = textContent.match(/\b[A-ZÁÉÍÓÚÑ]{3,}\b/g);
    if (palabrasGrandes && palabrasGrandes.length > 0) {
      console.log('📌 Cuvinte mari (posibile nume):');
      const unique = [...new Set(palabrasGrandes)];
      unique.slice(0, 10).forEach(word => {
        console.log(`   - ${word}`);
      });
    }

    // Căutăm pattern-uri de nume (2-3 cuvinte cu majuscule)
    const nombrePattern = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,2})\b/g;
    const nombresEncontrados = [];
    let match;
    while ((match = nombrePattern.exec(textContent)) !== null) {
      const nombre = match[1].trim();
      // Filtrează cuvinte comune
      if (!/^(EL|LA|LOS|LAS|DE|DEL|Y|O|A|EN|CON|POR|PARA|QUE|ES|SON|ESTA|ESTE)$/i.test(nombre)) {
        nombresEncontrados.push(nombre);
      }
    }
    
    if (nombresEncontrados.length > 0) {
      console.log('\n📌 Posibile nume complete (2-3 cuvinte):');
      const unique = [...new Set(nombresEncontrados)];
      unique.slice(0, 10).forEach(nombre => {
        console.log(`   - ${nombre}`);
      });
    }

    // Rezumat
    console.log('\n' + '='.repeat(80));
    console.log('📊 REZUMAT:');
    console.log('='.repeat(80));
    console.log(`Filename: ${filename}`);
    if (nombreFromFilename) {
      console.log(`✅ Nume din filename: "${nombreFromFilename}"`);
    }
    if (nombreFromText) {
      console.log(`✅ Nume din text PDF: "${nombreFromText}"`);
    }
    if (!nombreFromFilename && !nombreFromText) {
      console.log('⚠️ Nu s-a putut extrage nume automat');
      console.log('💡 Verifică manual textul PDF de mai sus pentru a identifica numele');
    }

    // Sugestie pentru pattern
    if (nombreFromFilename || nombreFromText) {
      const nombreFinal = nombreFromText || nombreFromFilename;
      console.log(`\n💡 Nume sugerat pentru căutare în DB: "${nombreFinal}"`);
      console.log(`   Query sugerat: SELECT CODIGO FROM Empleados WHERE UPPER(\`NOMBRE / APELLIDOS\`) LIKE '%${nombreFinal.toUpperCase()}%'`);
    }

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('❌ Eroare la analizarea PDF:', error.message);
    console.error(error.stack);
  }
}

// Main
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('❌ Lipsește calea către PDF!');
  console.log('\n💡 Usage: node analyze-pdf-empleado.js <path-to-pdf>');
  console.log('   Exemplu: node analyze-pdf-empleado.js "SELLO YUSBEL.pdf"');
  console.log('   Sau: node analyze-pdf-empleado.js "../SELLO YUSBEL.pdf"');
  process.exit(1);
}

analyzePDFEmpleado(pdfPath);
