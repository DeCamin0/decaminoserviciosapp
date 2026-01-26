const fs = require('fs');
const path = require('path');

// Importăm pdf-parse (același modul folosit în gestoria.service.ts)
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

/**
 * Testează extragerea DNI/NIE și numărului de securitate socială din PDF
 * Usage: node test-dni-seg-social-extraction.js <path-to-pdf>
 */
async function testDNISegSocialExtraction(pdfPath) {
  try {
    // Verifică dacă fișierul există
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ PDF-ul nu a fost găsit la: ${pdfPath}`);
      console.log('\n💡 Usage: node test-dni-seg-social-extraction.js <path-to-pdf>');
      console.log('   Exemplu: node test-dni-seg-social-extraction.js "CONTRATO YUSBEL.pdf"');
      return;
    }

    console.log(`📄 Testând extragerea DNI/NIE și Seg. Social din: ${pdfPath}\n`);
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
    console.log('📝 TEXTUL EXTRAS DIN PDF (primele 2000 caractere):');
    console.log('='.repeat(80));
    console.log(textContent.substring(0, 2000));
    if (textContent.length > 2000) {
      console.log('\n... (textul continuă)');
    }
    console.log('='.repeat(80));
    console.log(`\n📊 Lungime text total: ${textContent.length} caractere\n`);

    // Testăm pattern-urile pentru DNI/NIE
    console.log('='.repeat(80));
    console.log('🔍 TESTARE EXTRAGERE DNI/NIE:');
    console.log('='.repeat(80));

    const dniPatterns = [
      {
        name: 'Pattern 1: NIF/NIE: 12345678A',
        pattern: /(?:nif|nie|dni|d\.n\.i\.)\s*\/?\s*(?:nie|nif)?\s*:?\s*([A-Z]?\d{7,8}[A-Z]?)/i,
      },
      {
        name: 'Pattern 2: Standalone DNI (8 digits + optional letter)',
        pattern: /\b([A-Z]\d{7,8}[A-Z]?|\d{8}[A-Z]?)\b/i,
      },
    ];

    let dniNieFound = null;
    for (const { name, pattern } of dniPatterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        // Check if this is preceded by "número de afiliación" or "afiliación" (should be excluded)
        const beforeMatch = textContent.substring(0, match.index || 0);
        if (!/n[úu]mero\s+de\s+afiliaci[óo]n|afiliaci[óo]n|seguridad\s+social/i.test(beforeMatch)) {
          const dniNie = match[1].trim().toUpperCase();
          console.log(`✅ ${name}: "${dniNie}"`);
          if (!dniNieFound) {
            dniNieFound = dniNie;
          }
        } else {
          console.log(`⏭️ ${name}: "${match[1]}" (exclus - este número de afiliación)`);
        }
      } else {
        console.log(`❌ ${name}: Nu s-a găsit`);
      }
    }

    if (dniNieFound) {
      console.log(`\n✅ DNI/NIE EXTRAS: "${dniNieFound}"`);
    } else {
      console.log(`\n⚠️ Nu s-a putut extrage DNI/NIE`);
    }

    // Testăm pattern-urile pentru număr de securitate socială
    console.log('\n' + '='.repeat(80));
    console.log('🔍 TESTARE EXTRAGERE NUMĂR SEGURITATE SOCIALĂ:');
    console.log('='.repeat(80));

    const segSocialPatterns = [
      {
        name: 'Pattern 1: Nº AFILIACIÓN SEGURIDAD SOCIAL: 1234567890',
        pattern: /(?:n[º°]|numero|número)\s*(?:de\s+)?afiliaci[óo]n\s*(?:seguridad\s+social)?\s*:?\s*(\d{10})/i,
      },
      {
        name: 'Pattern 2: SEG. SOCIAL: 1234567890',
        pattern: /seg\.?\s*social\s*:?\s*(\d{10})/i,
      },
      {
        name: 'Pattern 3: Context pattern (afiliación/seguidad social + 10 digits nearby)',
        pattern: /(?:afiliaci[óo]n|seguridad\s+social|seg\.\s*social)[\s\S]{0,100}?(\d{10})/i,
      },
    ];

    let segSocialFound = null;
    for (const { name, pattern } of segSocialPatterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        const segSocial = match[1].trim();
        console.log(`✅ ${name}: "${segSocial}"`);
        if (!segSocialFound) {
          segSocialFound = segSocial;
        }
      } else {
        console.log(`❌ ${name}: Nu s-a găsit`);
      }
    }

    if (segSocialFound) {
      console.log(`\n✅ NUMĂR SEGURITATE SOCIALĂ EXTRAS: "${segSocialFound}"`);
    } else {
      console.log(`\n⚠️ Nu s-a putut extrage număr de securitate socială`);
    }

    // Căutăm manual în text pentru a vedea ce există
    console.log('\n' + '='.repeat(80));
    console.log('🔍 CĂUTARE MANUALĂ ÎN TEXT:');
    console.log('='.repeat(80));

    // Căutăm toate aparițiile "NIF", "NIE", "DNI"
    const nifNieMatches = textContent.match(/(?:nif|nie|dni|d\.n\.i\.)/gi);
    if (nifNieMatches && nifNieMatches.length > 0) {
      console.log(`📌 Găsit "${nifNieMatches[0]}" în text (${nifNieMatches.length} apariții)`);
      
      // Afișăm contextul pentru fiecare apariție
      const regex = /(?:nif|nie|dni|d\.n\.i\.)/gi;
      let match;
      let count = 0;
      while ((match = regex.exec(textContent)) !== null && count < 5) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(textContent.length, match.index + 100);
        const context = textContent.substring(start, end);
        console.log(`\n   Context ${count + 1}: "${context}"`);
        count++;
      }
    }

    // Căutăm toate aparițiile "afiliación", "seguridad social"
    const segSocialMatches = textContent.match(/(?:afiliaci[óo]n|seguridad\s+social|seg\.\s*social)/gi);
    if (segSocialMatches && segSocialMatches.length > 0) {
      console.log(`\n📌 Găsit "afiliación/seguridad social" în text (${segSocialMatches.length} apariții)`);
      
      // Afișăm contextul pentru fiecare apariție
      const regex = /(?:afiliaci[óo]n|seguridad\s+social|seg\.\s*social)/gi;
      let match;
      let count = 0;
      while ((match = regex.exec(textContent)) !== null && count < 5) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(textContent.length, match.index + 150);
        const context = textContent.substring(start, end);
        console.log(`\n   Context ${count + 1}: "${context}"`);
        count++;
      }
    }

    // Căutăm toate numerele de 8-10 cifre
    console.log('\n📌 Numere de 8-10 cifre găsite în text:');
    const numberPattern = /\b(\d{8,10})\b/g;
    const numbers = [];
    let numMatch;
    while ((numMatch = numberPattern.exec(textContent)) !== null) {
      const num = numMatch[1];
      const start = Math.max(0, numMatch.index - 30);
      const end = Math.min(textContent.length, numMatch.index + num.length + 30);
      const context = textContent.substring(start, end);
      numbers.push({ number: num, context: context.trim() });
    }
    
    // Afișăm primele 10 numere găsite
    const uniqueNumbers = [...new Set(numbers.map(n => n.number))];
    uniqueNumbers.slice(0, 10).forEach(num => {
      const firstOccurrence = numbers.find(n => n.number === num);
      console.log(`   - ${num}: "${firstOccurrence.context}"`);
    });

    // Rezumat
    console.log('\n' + '='.repeat(80));
    console.log('📊 REZUMAT:');
    console.log('='.repeat(80));
    if (dniNieFound) {
      console.log(`✅ DNI/NIE: "${dniNieFound}"`);
      console.log(`   Query sugerat: SELECT CODIGO FROM DatosEmpleados WHERE TRIM(UPPER(REPLACE(REPLACE(\`D.N.I. / NIE\`, '-', ''), ' ', ''))) = '${dniNieFound.replace(/[^A-Z0-9]/g, '')}'`);
    } else {
      console.log(`⚠️ DNI/NIE: Nu s-a găsit`);
    }
    
    if (segSocialFound) {
      console.log(`✅ Seg. Social: "${segSocialFound}"`);
      console.log(`   Query sugerat: SELECT CODIGO FROM DatosEmpleados WHERE TRIM(REPLACE(\`SEG. SOCIAL\`, ' ', '')) = '${segSocialFound}'`);
    } else {
      console.log(`⚠️ Seg. Social: Nu s-a găsit`);
    }

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('❌ Eroare la testarea PDF:', error.message);
    console.error(error.stack);
  }
}

// Main
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('❌ Lipsește calea către PDF!');
  console.log('\n💡 Usage: node test-dni-seg-social-extraction.js <path-to-pdf>');
  console.log('   Exemplu: node test-dni-seg-social-extraction.js "CONTRATO YUSBEL.pdf"');
  process.exit(1);
}

testDNISegSocialExtraction(pdfPath);
