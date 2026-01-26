const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

/**
 * Testează extragerea valorilor din câmpurile de formular PDF
 * Usage: node test-pdf-form-fields.js <path-to-pdf>
 */
async function testPDFFormFields(pdfPath) {
  try {
    // Verifică dacă fișierul există
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ PDF-ul nu a fost găsit la: ${pdfPath}`);
      console.log('\n💡 Usage: node test-pdf-form-fields.js <path-to-pdf>');
      console.log('   Exemplu: node test-pdf-form-fields.js "CONTRATO YUSBEL.pdf"');
      return;
    }

    console.log(`📄 Testând extragerea câmpurilor de formular din: ${pdfPath}\n`);
    console.log('='.repeat(80));
    
    // Citim buffer-ul PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`📊 Dimensiune PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);
    
    // Încărcăm PDF-ul cu pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    
    console.log('='.repeat(80));
    console.log('📋 CÂMPURI DE FORMULAR GĂSITE:');
    console.log('='.repeat(80));
    
    const fields = form.getFields();
    console.log(`📌 Total câmpuri: ${fields.length}\n`);
    
    // Căutăm câmpuri care ar putea conține DNI/NIE, număr de securitate socială sau nume
    const relevantFields = [];
    
    for (const field of fields) {
      const fieldName = field.getName();
      let fieldValue = null;
      
      try {
        // Încercăm să obținem valoarea în funcție de tipul câmpului
        if (field.constructor.name === 'PDFTextField') {
          fieldValue = field.getText();
        } else if (field.constructor.name === 'PDFCheckBox') {
          fieldValue = field.isChecked() ? 'checked' : 'unchecked';
        } else if (field.constructor.name === 'PDFDropdown') {
          fieldValue = field.getSelected();
        } else if (field.constructor.name === 'PDFRadioGroup') {
          fieldValue = field.getSelected();
        }
      } catch (e) {
        // Ignorăm erorile
      }
      
      // Verificăm dacă numele câmpului sau valoarea conține cuvinte cheie relevante
      const fieldNameLower = fieldName.toLowerCase();
      const fieldValueLower = fieldValue ? fieldValue.toLowerCase() : '';
      const isRelevant = 
        fieldNameLower.includes('nif') ||
        fieldNameLower.includes('nie') ||
        fieldNameLower.includes('dni') ||
        fieldNameLower.includes('afiliacion') ||
        fieldNameLower.includes('seguridad') ||
        fieldNameLower.includes('social') ||
        fieldNameLower.includes('nombre') ||
        fieldNameLower.includes('trabajador') ||
        fieldNameLower.includes('empleado') ||
        fieldValueLower.includes('nif') ||
        fieldValueLower.includes('nie') ||
        fieldValueLower.includes('dni') ||
        (fieldValue && /^\d{8,10}$/.test(fieldValue.trim())) ||
        (fieldValue && /^[A-Z]?\d{7,8}[A-Z]?$/.test(fieldValue.trim().toUpperCase()));
      
      if (isRelevant || fieldValue) {
        relevantFields.push({
          name: fieldName,
          type: field.constructor.name,
          value: fieldValue,
        });
      }
    }
    
    if (relevantFields.length > 0) {
      console.log('📌 Câmpuri relevante găsite:\n');
      for (const field of relevantFields) {
        console.log(`   Nume: "${field.name}"`);
        console.log(`   Tip: ${field.type}`);
        console.log(`   Valoare: "${field.value || '(gol)'}"`);
        console.log('');
      }
    } else {
      console.log('⚠️ Nu s-au găsit câmpuri de formular relevante sau PDF-ul nu are câmpuri de formular');
    }
    
    // Căutăm specific DNI/NIE și număr de securitate socială
    console.log('='.repeat(80));
    console.log('🔍 CĂUTARE SPECIFICĂ DNI/NIE ȘI SEG. SOCIAL:');
    console.log('='.repeat(80));
    
    let dniNieFound = null;
    let segSocialFound = null;
    let nombreFound = null;
    
    for (const field of relevantFields) {
      const fieldNameLower = field.name.toLowerCase();
      const fieldValue = field.value ? field.value.trim() : '';
      
      // Căutăm DNI/NIE
      if (!dniNieFound && (
        fieldNameLower.includes('nif') ||
        fieldNameLower.includes('nie') ||
        fieldNameLower.includes('dni')
      )) {
        // Verificăm dacă valoarea arată ca un DNI/NIE
        if (fieldValue && /^[A-Z]?\d{7,8}[A-Z]?$/.test(fieldValue.toUpperCase())) {
          dniNieFound = fieldValue.toUpperCase();
          console.log(`✅ DNI/NIE găsit în câmp "${field.name}": "${dniNieFound}"`);
        } else if (fieldValue && fieldValue.length > 0) {
          console.log(`⚠️ Câmp "${field.name}" conține: "${fieldValue}" (nu arată ca DNI/NIE)`);
        }
      }
      
      // Căutăm număr de securitate socială
      if (!segSocialFound && (
        fieldNameLower.includes('afiliacion') ||
        fieldNameLower.includes('seguridad') ||
        fieldNameLower.includes('social')
      )) {
        // Verificăm dacă valoarea arată ca un număr de securitate socială (10 cifre)
        if (fieldValue && /^\d{10}$/.test(fieldValue)) {
          segSocialFound = fieldValue;
          console.log(`✅ Seg. Social găsit în câmp "${field.name}": "${segSocialFound}"`);
        } else if (fieldValue && fieldValue.length > 0) {
          console.log(`⚠️ Câmp "${field.name}" conține: "${fieldValue}" (nu arată ca Seg. Social)`);
        }
      }
      
      // Căutăm nume
      if (!nombreFound && (
        fieldNameLower.includes('nombre') ||
        fieldNameLower.includes('trabajador') ||
        fieldNameLower.includes('empleado')
      )) {
        if (fieldValue && fieldValue.length >= 3 && !/^\d+$/.test(fieldValue)) {
          nombreFound = fieldValue;
          console.log(`✅ Nume găsit în câmp "${field.name}": "${nombreFound}"`);
        }
      }
    }
    
    // Rezumat
    console.log('\n' + '='.repeat(80));
    console.log('📊 REZUMAT:');
    console.log('='.repeat(80));
    
    if (dniNieFound) {
      console.log(`✅ DNI/NIE: "${dniNieFound}"`);
      console.log(`   Query sugerat: SELECT CODIGO FROM DatosEmpleados WHERE TRIM(UPPER(REPLACE(REPLACE(\`D.N.I. / NIE\`, '-', ''), ' ', ''))) = '${dniNieFound.replace(/[^A-Z0-9]/g, '')}'`);
    } else {
      console.log(`⚠️ DNI/NIE: Nu s-a găsit în câmpurile de formular`);
    }
    
    if (segSocialFound) {
      console.log(`✅ Seg. Social: "${segSocialFound}"`);
      console.log(`   Query sugerat: SELECT CODIGO FROM DatosEmpleados WHERE TRIM(REPLACE(\`SEG. SOCIAL\`, ' ', '')) = '${segSocialFound}'`);
    } else {
      console.log(`⚠️ Seg. Social: Nu s-a găsit în câmpurile de formular`);
    }
    
    if (nombreFound) {
      console.log(`✅ Nume: "${nombreFound}"`);
    } else {
      console.log(`⚠️ Nume: Nu s-a găsit în câmpurile de formular`);
    }
    
    // Dacă nu am găsit nimic, afișăm toate câmpurile pentru debugging
    if (!dniNieFound && !segSocialFound && !nombreFound && fields.length > 0) {
      console.log('\n📋 Toate câmpurile de formular (pentru debugging):');
      for (const field of fields.slice(0, 20)) { // Primele 20
        try {
          let value = null;
          if (field.constructor.name === 'PDFTextField') {
            value = field.getText();
          }
          console.log(`   - "${field.getName()}": "${value || '(gol)'}"`);
        } catch (e) {
          console.log(`   - "${field.getName()}": (eroare la citire)`);
        }
      }
      if (fields.length > 20) {
        console.log(`   ... și încă ${fields.length - 20} câmpuri`);
      }
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
  console.log('\n💡 Usage: node test-pdf-form-fields.js <path-to-pdf>');
  console.log('   Exemplu: node test-pdf-form-fields.js "CONTRATO YUSBEL.pdf"');
  process.exit(1);
}

testPDFFormFields(pdfPath);
