const fs = require('fs');
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

async function extractIRPF() {
  try {
    // Folosim un PDF de test - utilizatorul poate modifica calea
    const pdfPath = '../FINIQUITO JOSE ANTONIO NAVARRO - copia.pdf';
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Convertim Buffer la Uint8Array
    const uint8Array = new Uint8Array(dataBuffer);
    const pdfInstance = new PDFParse({ data: uint8Array });
    const result = await pdfInstance.getText();
    
    const textContent = result.text || result;
    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log('=== CĂUTARE IRPF ===\n');
    
    // Căutăm pattern-urile relevante pentru IRPF
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      // Pattern 1: "2. I.R.P.F." sau "2 IRPF"
      if ((lineUpper.includes('I.R.P.F.') || lineUpper.includes('IRPF')) && 
          (lineUpper.includes('2.') || lineUpper.startsWith('2 ') || lineUpper.match(/^2\s/))) {
        console.log(`\n📌 Linia ${i + 1} - Pattern IRPF găsit:`);
        console.log(`   "${line}"`);
        
        // Căutăm valoarea pe aceeași linie
        const match = line.match(/I\.?R\.?P\.?F\.?[:\s.]*([\d.,]+)/i);
        if (match && match[1] && match[1].trim() !== '') {
          const valueStr = match[1].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);
          console.log(`   ✅ Valoare găsită pe aceeași linie: ${match[1]} (${value})`);
        } else {
          console.log(`   ⚠️  Valoarea NU este pe aceeași linie`);
        }
        
        // Afișăm contextul complet (15 linii după)
        console.log(`\n   📄 15 linii DUPĂ "2. I.R.P.F." (căutăm valoarea IRPF):`);
        let liquidoTotalIndex = -1;
        let valoresDespuesLiquido = 0;
        
        for (let j = i + 1; j < Math.min(i + 16, lines.length); j++) {
          const nextLine = lines[j].trim();
          const nextLineUpper = nextLine.toUpperCase();
          
          // Verificăm dacă am trecut de "LIQUIDO TOTAL A PERCIBIR"
          if (nextLineUpper.includes('LIQUIDO TOTAL A PERCIBIR') || nextLineUpper.includes('LÍQUIDO TOTAL A PERCIBIR')) {
            liquidoTotalIndex = j;
            console.log(`   ${j + 1}: "${nextLine}" 📌 LIQUIDO TOTAL A PERCIBIR`);
            valoresDespuesLiquido = 0; // Resetăm contorul
            continue;
          }
          
          // Verificăm dacă am trecut de "TOTAL A DEDUCIR"
          if (nextLineUpper.includes('TOTAL A DEDUCIR')) {
            console.log(`   ${j + 1}: "${nextLine}" 📌 TOTAL A DEDUCIR`);
            // Continuăm (IRPF poate fi după)
            continue;
          }
          
          // Verificăm dacă este o valoare numerică
          const valueMatch = nextLine.match(/^([\d.,]+)$/);
          if (valueMatch && valueMatch[1]) {
            const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(valueStr);
            
            // Dacă am trecut de "LIQUIDO TOTAL A PERCIBIR", numărăm valorile
            if (liquidoTotalIndex !== -1 && j > liquidoTotalIndex) {
              valoresDespuesLiquido++;
            }
            
            const isValid = !isNaN(value) && (value === 0 || value >= 0.01);
            const marker = isValid ? ' ✅ VALOARE VALIDĂ' : ' ⚠️  VALOARE INVALIDĂ';
            const ignoreMarker = (liquidoTotalIndex !== -1 && j > liquidoTotalIndex && valoresDespuesLiquido <= 3) 
              ? ' ⏭️  IGNORAT (primele 3 după LIQUIDO)' : '';
            const irpfMarker = (isValid && !ignoreMarker) ? ' 🔍 ACEASTA ESTE IRPF' : '';
            
            console.log(`   ${j + 1}: "${nextLine}"${marker}${ignoreMarker}${irpfMarker} (valori după LIQUIDO: ${valoresDespuesLiquido})`);
          } else {
            // Verificăm dacă este un indicator de oprire
            if (nextLine.match(/\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/i) ||
                nextLine.match(/FALTA PREAVISO|VACACIONES DISFRUTADAS|TOTAL DEVENGADO|A\. TOTAL DEVENGADO|II\. DEDUCCIONES/i)) {
              console.log(`   ${j + 1}: "${nextLine}" ⏹️  OPRIM (indicator de oprire)`);
              break;
            } else {
              console.log(`   ${j + 1}: "${nextLine}"`);
            }
          }
        }
      }
    }
    
    // Căutăm și fallback-urile
    console.log('\n\n=== FALLBACK 1: "I.R.P.F." sau "IRPF" fără "2." ===\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if ((lineUpper.includes('I.R.P.F.') || lineUpper.includes('IRPF')) && 
          !(lineUpper.includes('2.') || lineUpper.startsWith('2 ') || lineUpper.match(/^2\s/))) {
        console.log(`\n📌 Linia ${i + 1} - IRPF fără "2.":`);
        console.log(`   "${line}"`);
        
        // Căutăm valoarea
        const match = line.match(/I\.?R\.?P\.?F\.?[:\s.]*([\d.,]+)/i);
        if (match && match[1]) {
          const valueStr = match[1].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);
          console.log(`   ✅ Valoare găsită: ${match[1]} (${value})`);
        } else if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const valueMatch = nextLine.match(/^([\d.,]+)$/);
          if (valueMatch && valueMatch[1]) {
            const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(valueStr);
            console.log(`   ✅ Valoare găsită pe linia următoare: ${valueMatch[1]} (${value})`);
          }
        }
      }
    }
    
    // Căutăm și "RETENCIÓN IRPF"
    console.log('\n\n=== FALLBACK 2: "RETENCIÓN IRPF" ===\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if (lineUpper.includes('RETENCIÓN IRPF') || lineUpper.includes('RETENCION IRPF')) {
        console.log(`\n📌 Linia ${i + 1} - RETENCIÓN IRPF:`);
        console.log(`   "${line}"`);
        
        // Căutăm valoarea
        const match = line.match(/([\d.,]+)/);
        if (match && match[1]) {
          const valueStr = match[1].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);
          console.log(`   ✅ Valoare găsită: ${match[1]} (${value})`);
        } else if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const valueMatch = nextLine.match(/^([\d.,]+)/);
          if (valueMatch && valueMatch[1]) {
            const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(valueStr);
            console.log(`   ✅ Valoare găsită pe linia următoare: ${valueMatch[1]} (${value})`);
          }
        }
      }
    }
    
    // Căutăm structura completă: "2. I.R.P.F." → "LIQUIDO TOTAL A PERCIBIR" → valoarea IRPF
    console.log('\n\n=== STRUCTURA COMPLETĂ: "2. I.R.P.F." → "LIQUIDO TOTAL A PERCIBIR" → IRPF ===\n');
    let irpfIndex = -1;
    let liquidoIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      if ((lineUpper.includes('I.R.P.F.') || lineUpper.includes('IRPF')) && 
          (lineUpper.includes('2.') || lineUpper.startsWith('2 ') || lineUpper.match(/^2\s/))) {
        irpfIndex = i;
      }
      
      if ((lineUpper.includes('LIQUIDO TOTAL A PERCIBIR') || lineUpper.includes('LÍQUIDO TOTAL A PERCIBIR')) && 
          (lineUpper.includes('(A-B)') || lineUpper.includes('A-B'))) {
        liquidoIndex = i;
      }
    }
    
    if (irpfIndex !== -1) {
      console.log(`\n📌 "2. I.R.P.F." este la linia ${irpfIndex + 1}`);
      if (liquidoIndex !== -1) {
        console.log(`📌 "LIQUIDO TOTAL A PERCIBIR (A-B)" este la linia ${liquidoIndex + 1}`);
        
        if (liquidoIndex > irpfIndex) {
          console.log(`\n📌 Structura: "2. I.R.P.F." (${irpfIndex + 1}) → "LIQUIDO TOTAL A PERCIBIR" (${liquidoIndex + 1})`);
          console.log(`\n📌 15 linii DUPĂ "2. I.R.P.F." (până la "LIQUIDO TOTAL A PERCIBIR" și după):\n`);
          let valoresDespuesLiquido = 0;
          
          for (let i = irpfIndex + 1; i < Math.min(irpfIndex + 16, lines.length); i++) {
            const line = lines[i];
            const lineUpper = line.toUpperCase();
            
            if (lineUpper.includes('LIQUIDO TOTAL A PERCIBIR') || lineUpper.includes('LÍQUIDO TOTAL A PERCIBIR')) {
              console.log(`   ${i + 1}: "${line}" 📌 LIQUIDO TOTAL A PERCIBIR`);
              valoresDespuesLiquido = 0;
              continue;
            }
            
            const valueMatch = line.match(/^([\d.,]+)$/);
            if (valueMatch && valueMatch[1]) {
              const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
              const value = parseFloat(valueStr);
              
              if (i > liquidoIndex) {
                valoresDespuesLiquido++;
              }
              
              const isValid = !isNaN(value) && (value === 0 || value >= 0.01);
              const ignoreMarker = (i > liquidoIndex && valoresDespuesLiquido <= 3) 
                ? ' ⏭️  IGNORAT (primele 3 după LIQUIDO)' : '';
              const irpfMarker = (isValid && !ignoreMarker) ? ' 🔍 ACEASTA ESTE IRPF' : '';
              
              console.log(`   ${i + 1}: "${line}" ✅ VALOARE${ignoreMarker}${irpfMarker} (valori după LIQUIDO: ${valoresDespuesLiquido})`);
            } else {
              console.log(`   ${i + 1}: "${line}"`);
            }
          }
        } else {
          console.log(`\n📌 "LIQUIDO TOTAL A PERCIBIR" este ÎNAINTE de "2. I.R.P.F."`);
          console.log(`\n📌 15 linii DUPĂ "2. I.R.P.F." (căutăm IRPF):\n`);
          
          for (let i = irpfIndex + 1; i < Math.min(irpfIndex + 16, lines.length); i++) {
            const line = lines[i];
            const valueMatch = line.match(/^([\d.,]+)$/);
            if (valueMatch && valueMatch[1]) {
              const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
              const value = parseFloat(valueStr);
              const isValid = !isNaN(value) && (value === 0 || value >= 0.01);
              const marker = isValid ? ' ✅ VALOARE VALIDĂ 🔍 ACEASTA ESTE IRPF' : ' ⚠️  VALOARE INVALIDĂ';
              console.log(`   ${i + 1}: "${line}"${marker}`);
            } else {
              console.log(`   ${i + 1}: "${line}"`);
            }
          }
        }
      } else {
        console.log(`\n⚠️  "LIQUIDO TOTAL A PERCIBIR" NU a fost găsit`);
        console.log(`\n📌 15 linii DUPĂ "2. I.R.P.F." (căutăm IRPF):\n`);
        
        for (let i = irpfIndex + 1; i < Math.min(irpfIndex + 16, lines.length); i++) {
          const line = lines[i];
          const valueMatch = line.match(/^([\d.,]+)$/);
          if (valueMatch && valueMatch[1]) {
            const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(valueStr);
            const isValid = !isNaN(value) && (value === 0 || value >= 0.01);
            const marker = isValid ? ' ✅ VALOARE VALIDĂ 🔍 ACEASTA ESTE IRPF' : ' ⚠️  VALOARE INVALIDĂ';
            console.log(`   ${i + 1}: "${line}"${marker}`);
          } else {
            console.log(`   ${i + 1}: "${line}"`);
          }
        }
      }
    }
    
    // Căutăm valoarea 21,18 sau 21.18 (valoarea menționată de utilizator)
    console.log('\n\n=== CĂUTARE VALOAREA 21,18 / 21.18 ===\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('21,18') || line.includes('21.18')) {
        console.log(`\n📌 Linia ${i + 1}: "${line}"`);
        
        // Afișăm contextul (10 linii înainte și după)
        console.log(`\n   📄 10 linii ÎNAINTE:`);
        for (let j = Math.max(0, i - 10); j < i; j++) {
          const prevLine = lines[j];
          const prevLineUpper = prevLine.toUpperCase();
          const isIRPF = (prevLineUpper.includes('I.R.P.F.') || prevLineUpper.includes('IRPF'));
          const marker = isIRPF ? ' 🔍 IRPF' : '';
          console.log(`   ${j + 1}: "${prevLine}"${marker}`);
        }
        
        console.log(`\n   📄 10 linii DUPĂ:`);
        for (let j = i + 1; j < Math.min(i + 11, lines.length); j++) {
          console.log(`   ${j + 1}: "${lines[j]}"`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error);
  }
}

extractIRPF();

