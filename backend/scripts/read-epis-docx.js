const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

async function readEPISDocx() {
  const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
  
  if (!fs.existsSync(docxPath)) {
    console.log('❌ Fișierul nu există:', docxPath);
    return;
  }

  console.log('📄 Citind fișierul:', docxPath);
  console.log('📊 Dimensiune:', (fs.statSync(docxPath).size / 1024).toFixed(2), 'KB\n');

  try {
    // Citește textul din .docx
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value;
    
    console.log('=== CONȚINUT TEXT ===\n');
    console.log(text);
    console.log('\n=== SFÂRȘIT TEXT ===\n');

    // Încearcă să extragă și HTML-ul pentru a vedea structura
    const htmlResult = await mammoth.convertToHtml({ path: docxPath });
    console.log('=== STRUCTURĂ HTML (primele 5000 caractere) ===\n');
    console.log(htmlResult.value.substring(0, 5000));
    console.log('\n=== SFÂRȘIT HTML ===\n');

    // Caută placeholder-uri sau câmpuri care trebuie completate
    console.log('=== CĂUTARE PLACEHOLDER-URI / CÂMPURI ===\n');
    
    // Pattern-uri comune pentru placeholder-uri
    const patterns = [
      /\{\{.*?\}\}/g,  // {{placeholder}}
      /\{.*?\}/g,      // {placeholder}
      /\[.*?\]/g,      // [placeholder]
      /<.*?>/g,        // <placeholder>
      /___+/g,         // Linii pentru completat
      /_+/g,           // Underscores
    ];

    const foundPlaceholders = new Set();
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => foundPlaceholders.add(m));
      }
    }

    if (foundPlaceholders.size > 0) {
      console.log('Placeholder-uri găsite:');
      Array.from(foundPlaceholders).forEach(p => console.log('  -', p));
    } else {
      console.log('Nu s-au găsit placeholder-uri evidente în text.');
    }

    // Caută câmpuri care par să necesite completare (spații goale, linii, etc.)
    console.log('\n=== CĂUTARE CÂMPURI GOALE / DE COMPLETAT ===\n');
    const lines = text.split('\n');
    const emptyFields = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      // Caută linii care par să fie câmpuri de completat
      if (trimmed.length > 0 && (
        trimmed.match(/^[_\s]+$/) || // Doar underscores sau spații
        trimmed.match(/^[\.\s]+$/) || // Doar puncte sau spații
        trimmed.match(/^[-–—\s]+$/) || // Doar linii
        trimmed.match(/^[Xx\s]+$/) || // Doar X-uri (pentru checkbox-uri)
        trimmed.toLowerCase().includes('completar') ||
        trimmed.toLowerCase().includes('rellenar') ||
        trimmed.toLowerCase().includes('firma') ||
        trimmed.toLowerCase().includes('fecha') ||
        trimmed.toLowerCase().includes('nombre') ||
        trimmed.toLowerCase().includes('dni') ||
        trimmed.toLowerCase().includes('nif')
      )) {
        emptyFields.push({ line: index + 1, content: trimmed });
      }
    });

    if (emptyFields.length > 0) {
      console.log('Câmpuri care par să necesite completare:');
      emptyFields.slice(0, 20).forEach(f => {
        console.log(`  Linia ${f.line}: "${f.content}"`);
      });
      if (emptyFields.length > 20) {
        console.log(`  ... și încă ${emptyFields.length - 20} câmpuri`);
      }
    }

  } catch (error) {
    console.error('❌ Eroare la citirea fișierului:', error);
  }
}

readEPISDocx();
