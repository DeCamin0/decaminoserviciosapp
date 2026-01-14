const fs = require('fs');
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

async function extractAportaciones() {
  try {
    const pdfPath = '../FINIQUITO JOSE ANTONIO NAVARRO - copia.pdf';
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Convertim Buffer la Uint8Array
    const uint8Array = new Uint8Array(dataBuffer);
    const pdfInstance = new PDFParse({ data: uint8Array });
    const result = await pdfInstance.getText();
    
    const textContent = result.text || result;
    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log('=== CĂUTARE APORTACIONES TRABAJADOR ===\n');
    
    // Căutăm pattern-urile relevante
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      // Pattern 1: "1. TOTAL APORTACIONES"
      if (lineUpper.includes('TOTAL APORTACIONES') || lineUpper.includes('TOTAL APORTACION')) {
        console.log(`\n📌 Linia ${i + 1} - TOTAL APORTACIONES:`);
        console.log(`   "${line}"`);
        
        // Verificăm dacă are "1." sau începe cu "1 "
        if (lineUpper.includes('1.') || lineUpper.startsWith('1 ')) {
          console.log(`   ✅ Conține "1." sau începe cu "1 "`);
        }
        
        // Căutăm valoarea pe aceeași linie
        const match = line.match(/TOTAL\s+APORTACIONES?[:\s.]*([\d.,]+)/i);
        if (match && match[1]) {
          console.log(`   ✅ Valoare găsită pe aceeași linie: ${match[1]}`);
        } else {
          console.log(`   ⚠️  Valoarea NU este pe aceeași linie`);
          // Verificăm linia următoare
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            console.log(`   📄 Linia următoare (${i + 2}): "${nextLine}"`);
            const valueMatch = nextLine.match(/^([\d.,]+)/);
            if (valueMatch && valueMatch[1]) {
              console.log(`   ✅ Valoare găsită pe linia următoare: ${valueMatch[1]}`);
            }
          }
        }
      }
      
      // Pattern 2: "APORTACIONES TRABAJADOR" sau "APORT. TRABAJADOR"
      if ((lineUpper.includes('APORTACIONES TRABAJADOR') || lineUpper.includes('APORT. TRABAJADOR')) && 
          !lineUpper.includes('TOTAL APORTACIONES')) {
        console.log(`\n📌 Linia ${i + 1} - APORTACIONES TRABAJADOR:`);
        console.log(`   "${line}"`);
        
        // Căutăm valoarea
        const match = line.match(/([\d.,]+)/);
        if (match && match[1]) {
          console.log(`   ✅ Valoare găsită: ${match[1]}`);
        } else if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          console.log(`   📄 Linia următoare (${i + 2}): "${nextLine}"`);
          const valueMatch = nextLine.match(/^([\d.,]+)/);
          if (valueMatch && valueMatch[1]) {
            console.log(`   ✅ Valoare găsită pe linia următoare: ${valueMatch[1]}`);
          }
        }
      }
    }
    
    // Căutăm și contextul în jurul "TOTAL A DEDUCIR" pentru a vedea structura
    console.log('\n\n=== CONTEXT ÎN JURUL "TOTAL A DEDUCIR" ===\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if (lineUpper.includes('TOTAL A DEDUCIR')) {
        console.log(`\n📌 Linia ${i + 1} - TOTAL A DEDUCIR:`);
        console.log(`   "${line}"`);
        
        // Afișăm 5 linii înainte
        console.log(`\n   📄 5 linii ÎNAINTE:`);
        for (let j = Math.max(0, i - 5); j < i; j++) {
          console.log(`   ${j + 1}: "${lines[j]}"`);
        }
        
        // Afișăm 3 linii după
        console.log(`\n   📄 3 linii DUPĂ:`);
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          console.log(`   ${j + 1}: "${lines[j]}"`);
        }
        break;
      }
    }
    
    // Căutăm și "1. TOTAL APORTACIONES" cu context
    console.log('\n\n=== CONTEXT COMPLET PENTRU "1. TOTAL APORTACIONES" ===\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if ((lineUpper.includes('TOTAL APORTACIONES') || lineUpper.includes('TOTAL APORTACION')) && 
          (lineUpper.includes('1.') || lineUpper.startsWith('1 '))) {
        console.log(`\n📌 Linia ${i + 1} - 1. TOTAL APORTACIONES:`);
        console.log(`   "${line}"`);
        
        // Afișăm 3 linii înainte
        console.log(`\n   📄 3 linii ÎNAINTE:`);
        for (let j = Math.max(0, i - 3); j < i; j++) {
          console.log(`   ${j + 1}: "${lines[j]}"`);
        }
        
        // Afișăm 15 linii după pentru a găsi valoarea
        console.log(`\n   📄 15 linii DUPĂ (căutăm valoarea):`);
        for (let j = i + 1; j < Math.min(i + 16, lines.length); j++) {
          const nextLine = lines[j].trim();
          // Verificăm dacă este o valoare numerică
          const valueMatch = nextLine.match(/^([\d.,]+)$/);
          const hasValue = valueMatch && valueMatch[1];
          const marker = hasValue ? ' ✅ VALOARE' : '';
          console.log(`   ${j + 1}: "${nextLine}"${marker}`);
          
          // Dacă găsim "2. I.R.P.F." sau "TOTAL A DEDUCIR", ne oprim
          const nextLineUpper = nextLine.toUpperCase();
          if (nextLineUpper.includes('2.') && (nextLineUpper.includes('I.R.P.F.') || nextLineUpper.includes('IRPF'))) {
            console.log(`   ⚠️  OPRIM - am găsit "2. I.R.P.F."`);
            break;
          }
          if (nextLineUpper.includes('TOTAL A DEDUCIR')) {
            console.log(`   ⚠️  OPRIM - am găsit "TOTAL A DEDUCIR"`);
            break;
          }
        }
        break;
      }
    }
    
    // Căutăm și toate aparițiile de "APORTACIONES" pentru context complet
    console.log('\n\n=== TOATE APARIȚIILE "APORTACIONES" ===\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if (lineUpper.includes('APORTACIONES') || lineUpper.includes('APORT.')) {
        console.log(`\n📌 Linia ${i + 1}:`);
        console.log(`   "${line}"`);
        
        // Verificăm dacă are valoare pe aceeași linie
        const match = line.match(/([\d.,]+)/);
        if (match && match[1]) {
          console.log(`   ✅ Valoare pe aceeași linie: ${match[1]}`);
        }
      }
    }
    
    // Căutăm valoarea 68,62 sau 68.62
    console.log('\n\n=== CĂUTARE VALOAREA 68,62 / 68.62 ===\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('68,62') || line.includes('68.62')) {
        console.log(`\n📌 Linia ${i + 1}: "${line}"`);
        
        // Afișăm contextul (5 linii înainte și după)
        console.log(`\n   📄 5 linii ÎNAINTE:`);
        for (let j = Math.max(0, i - 5); j < i; j++) {
          console.log(`   ${j + 1}: "${lines[j]}"`);
        }
        
        console.log(`\n   📄 5 linii DUPĂ:`);
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          console.log(`   ${j + 1}: "${lines[j]}"`);
        }
      }
    }
    
    // Căutăm structura: "1. TOTAL APORTACIONES" → "LIQUIDO TOTAL A PERCIBIR" → valoarea
    console.log('\n\n=== STRUCTURA: "1. TOTAL APORTACIONES" → "LIQUIDO TOTAL A PERCIBIR" → VALOAREA ===\n');
    let aportacionesIndex = -1;
    let liquidoIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if ((lineUpper.includes('TOTAL APORTACIONES') || lineUpper.includes('TOTAL APORTACION')) && 
          (lineUpper.includes('1.') || lineUpper.startsWith('1 '))) {
        aportacionesIndex = i;
      }
      
      if ((lineUpper.includes('LIQUIDO TOTAL A PERCIBIR') || lineUpper.includes('LÍQUIDO TOTAL A PERCIBIR')) && 
          (lineUpper.includes('(A-B)') || lineUpper.includes('A-B'))) {
        liquidoIndex = i;
      }
    }
    
    if (aportacionesIndex !== -1 && liquidoIndex !== -1) {
      console.log(`\n📌 "1. TOTAL APORTACIONES" este la linia ${aportacionesIndex + 1}`);
      console.log(`📌 "LIQUIDO TOTAL A PERCIBIR (A-B)" este la linia ${liquidoIndex + 1}`);
      console.log(`\n📌 Structura între ele (${aportacionesIndex + 1} → ${liquidoIndex + 1}):\n`);
      for (let i = aportacionesIndex; i <= liquidoIndex; i++) {
        const line = lines[i];
        const valueMatch = line.match(/^([\d.,]+)$/);
        const marker = valueMatch ? ' ✅ VALOARE' : '';
        console.log(`   ${i + 1}: "${line}"${marker}`);
      }
      
      console.log(`\n📌 5 linii DUPĂ "LIQUIDO TOTAL A PERCIBIR (A-B)" (căutăm valoarea 68,62):\n`);
      for (let i = liquidoIndex + 1; i < Math.min(liquidoIndex + 6, lines.length); i++) {
        const line = lines[i];
        const valueMatch = line.match(/^([\d.,]+)$/);
        const marker = valueMatch ? ' ✅ VALOARE' : '';
        const is6862 = line.includes('68,62') || line.includes('68.62');
        const marker2 = is6862 ? ' 🔍 ACEASTA ESTE APORTACIONES TRABAJADOR' : '';
        console.log(`   ${i + 1}: "${line}"${marker}${marker2}`);
      }
    }
    
    // Căutăm structura completă în jurul "1. TOTAL APORTACIONES" și "2. I.R.P.F."
    console.log('\n\n=== STRUCTURA COMPLETĂ: ÎNAINTE DE "2. I.R.P.F." (căutăm "1. TOTAL APORTACIONES") ===\n');
    let irpfIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if (lineUpper.includes('2.') && (lineUpper.includes('I.R.P.F.') || lineUpper.includes('IRPF'))) {
        irpfIndex = i;
        break;
      }
    }
    
    if (irpfIndex !== -1) {
      console.log(`\n📌 "2. I.R.P.F." este la linia ${irpfIndex + 1}`);
      console.log(`\n📌 15 linii ÎNAINTE de "2. I.R.P.F." (căutăm "1. TOTAL APORTACIONES" și valoarea sa):\n`);
      for (let i = Math.max(0, irpfIndex - 15); i < irpfIndex; i++) {
        const line = lines[i];
        const lineUpper = line.toUpperCase();
        const valueMatch = line.match(/^([\d.,]+)$/);
        const marker = valueMatch ? ' ✅ VALOARE' : '';
        const isAportaciones = (lineUpper.includes('TOTAL APORTACIONES') || lineUpper.includes('TOTAL APORTACION')) && 
                                (lineUpper.includes('1.') || lineUpper.startsWith('1 '));
        const marker2 = isAportaciones ? ' 🔍 "1. TOTAL APORTACIONES"' : '';
        console.log(`   ${i + 1}: "${line}"${marker}${marker2}`);
      }
    }
    
    // Căutăm și toate aparițiile de "1." înainte de "2. I.R.P.F."
    console.log('\n\n=== TOATE APARIȚIILE "1." ÎNAINTE DE "2. I.R.P.F." ===\n');
    if (irpfIndex !== -1) {
      for (let i = 0; i < irpfIndex; i++) {
        const line = lines[i];
        const lineUpper = line.toUpperCase();
        if (lineUpper.includes('1.') || lineUpper.startsWith('1 ')) {
          console.log(`\n📌 Linia ${i + 1}: "${line}"`);
          // Afișăm 3 linii înainte și după
          console.log(`   📄 3 linii ÎNAINTE:`);
          for (let j = Math.max(0, i - 3); j < i; j++) {
            console.log(`   ${j + 1}: "${lines[j]}"`);
          }
          console.log(`   📄 3 linii DUPĂ:`);
          for (let j = i + 1; j < Math.min(i + 4, irpfIndex); j++) {
            const valueMatch = lines[j].match(/^([\d.,]+)$/);
            const marker = valueMatch ? ' ✅ VALOARE' : '';
            console.log(`   ${j + 1}: "${lines[j]}"${marker}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error);
  }
}

extractAportaciones();

