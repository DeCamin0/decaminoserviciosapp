const fs = require('fs');
const path = require('path');

// Încearcă să încarce pdfmake
let PdfPrinter;
try {
  // pdfmake în Node.js se importă diferit
  const pdfmake = require('pdfmake');
  // În Node.js, pdfmake exportă PdfPrinter direct
  PdfPrinter = pdfmake;
  
  // Verifică dacă e constructor sau obiect
  if (typeof PdfPrinter !== 'function') {
    // Încearcă să acceseze PdfPrinter din modul
    PdfPrinter = pdfmake.PdfPrinter || pdfmake.default || pdfmake;
  }
} catch (error) {
  console.error('❌ pdfmake nu este instalat. Instalează-l cu: npm install pdfmake');
  process.exit(1);
}

// Căi către fișiere
const manualPath = path.join(__dirname, '../../frontend/docs/MANUAL_EMPLEADOS.md');
const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
const outputPath = path.join(__dirname, '../../MANUAL_EMPLEADOS_DECAMINO.pdf');

// Verifică dacă fișierul manualului există
if (!fs.existsSync(manualPath)) {
  console.error('❌ Fișierul manualului nu există:', manualPath);
  process.exit(1);
}

// Citește conținutul markdown
const markdownContent = fs.readFileSync(manualPath, 'utf-8');

// Verifică dacă există logo-ul
let logoBase64 = null;
try {
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    console.log('✅ Logo găsit și încărcat');
  } else {
    console.warn('⚠️ Logo nu a fost găsit la:', logoPath);
  }
} catch (error) {
  console.warn('⚠️ Eroare la încărcarea logo-ului:', error.message);
}

// Fonturi pentru pdfmake
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// Funcție pentru a parsa markdown în format pdfmake
function parseMarkdownToPdfMake(markdown) {
  const lines = markdown.split('\n');
  const content = [];
  let currentList = null;
  let listItems = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Skip linii goale la început
    if (!line && content.length === 0) {
      continue;
    }
    
    // Títulos principales (##)
    if (line.startsWith('## ')) {
      // Finalizează lista anterioară dacă există
      if (currentList) {
        content.push(currentList);
        currentList = null;
        listItems = [];
      }
      
      const title = line.replace('## ', '');
      content.push({
        text: title,
        style: 'heading1',
        margin: [0, 20, 0, 10]
      });
      continue;
    }
    
    // Subtítulos (###)
    if (line.startsWith('### ')) {
      if (currentList) {
        content.push(currentList);
        currentList = null;
        listItems = [];
      }
      
      const subtitle = line.replace('### ', '');
      content.push({
        text: subtitle,
        style: 'heading2',
        margin: [0, 15, 0, 8]
      });
      continue;
    }
    
    // Subtítulos nivel 4 (####)
    if (line.startsWith('#### ')) {
      if (currentList) {
        content.push(currentList);
        currentList = null;
        listItems = [];
      }
      
      const subsubtitle = line.replace('#### ', '');
      content.push({
        text: subsubtitle,
        style: 'heading3',
        margin: [0, 12, 0, 6]
      });
      continue;
    }
    
    // Subtítulos nivel 5 (#####)
    if (line.startsWith('##### ')) {
      if (currentList) {
        content.push(currentList);
        currentList = null;
        listItems = [];
      }
      
      const subsubsubtitle = line.replace('##### ', '');
      content.push({
        text: subsubsubtitle,
        style: 'heading4',
        margin: [0, 10, 0, 5]
      });
      continue;
    }
    
    // Listas con viñetas (- o *)
    if (line.match(/^[-*]\s+/)) {
      const listItem = line.replace(/^[-*]\s+/, '');
      // Dacă există o listă numerată, o finalizăm
      if (currentList && currentList.ol) {
        content.push(currentList);
        currentList = null;
      }
      if (!currentList) {
        currentList = {
          ul: [],
          margin: [0, 5, 0, 5]
        };
      }
      if (currentList.ul) {
        currentList.ul.push(parseInlineFormatting(listItem));
      }
      continue;
    }
    
    // Listas numeradas
    if (line.match(/^\d+\.\s+/)) {
      const listItem = line.replace(/^\d+\.\s+/, '');
      // Dacă există o listă cu bullet points, o finalizăm
      if (currentList && currentList.ul) {
        content.push(currentList);
        currentList = null;
      }
      if (!currentList) {
        currentList = {
          ol: [],
          margin: [0, 5, 0, 5]
        };
      }
      if (currentList.ol) {
        currentList.ol.push(parseInlineFormatting(listItem));
      }
      continue;
    }
    
    // Separadores (---)
    if (line.match(/^-{3,}$/)) {
      if (currentList) {
        content.push(currentList);
        currentList = null;
        listItems = [];
      }
      content.push({
        canvas: [{
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 1,
          lineColor: '#E0E0E0'
        }],
        margin: [0, 10, 0, 10]
      });
      continue;
    }
    
    // Linie goală
    if (!line) {
      if (currentList) {
        content.push(currentList);
        currentList = null;
        listItems = [];
      }
      content.push({ text: '', margin: [0, 4, 0, 4] });
      continue;
    }
    
    // Text normal
    if (currentList) {
      content.push(currentList);
      currentList = null;
      listItems = [];
    }
    
    content.push({
      text: parseInlineFormatting(line),
      style: 'body',
      margin: [0, 2, 0, 2]
    });
  }
  
  // Finalizează lista dacă există
  if (currentList) {
    content.push(currentList);
  }
  
  return content;
}

// Funcție pentru a parsa formatare inline (bold, italic, etc.)
function parseInlineFormatting(text) {
  const parts = [];
  let currentIndex = 0;
  
  // Procesează text bold (**text**)
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let match;
  let lastIndex = 0;
  
  while ((match = boldRegex.exec(text)) !== null) {
    // Adaugă textul înainte de bold
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Adaugă textul bold
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  
  // Adaugă textul rămas
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  // Dacă nu s-a găsit nimic, returnează textul original
  if (parts.length === 0) {
    return text;
  }
  
  // Dacă e un singur element, returnează-l direct
  if (parts.length === 1) {
    return parts[0];
  }
  
  // Returnează array de părți
  return parts;
}

// Parsează markdown-ul
console.log('📝 Parseando markdown...');
const pdfContent = parseMarkdownToPdfMake(markdownContent);

// Definirea documentului PDF
const docDefinition = {
  pageSize: 'A4',
  pageMargins: [60, 80, 60, 80],
  info: {
    title: 'Manual de Usuario - De Camino Servicios Auxiliares',
    author: 'De Camino Servicios Auxiliares S.L.',
    subject: 'Manual de Usuario para Empleados',
    keywords: 'manual, empleados, usuario, De Camino, guía'
  },
  header: function(currentPage, pageCount) {
    return {
      columns: [
        logoBase64 ? { image: logoBase64, width: 40, alignment: 'left', margin: [0, 10, 0, 10] } : { text: 'De Camino Servicios Auxiliares S.L.', style: 'header', alignment: 'left' },
        { text: 'Manual de Usuario', style: 'header', alignment: 'right', margin: [0, 10, 0, 10] }
      ],
      margin: [60, 20, 60, 0]
    };
  },
  footer: function(currentPage, pageCount) {
    return {
      columns: [
        { text: 'De Camino Servicios Auxiliares S.L. | CIF: B-87654321 | Madrid, España', style: 'footer', alignment: 'left' },
        { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', alignment: 'right' }
      ],
      margin: [60, 10, 60, 20]
    };
  },
  content: [
    // Pagină de copertă
    {
      stack: [
        logoBase64 ? { image: logoBase64, width: 180, alignment: 'center', margin: [0, 100, 0, 40] } : { text: '', margin: [0, 100, 0, 40] },
        { text: 'MANUAL DE USUARIO', style: 'coverTitle', alignment: 'center', margin: [0, 0, 0, 10] },
        { text: 'Guía para Empleados', style: 'coverSubtitle', alignment: 'center', margin: [0, 0, 0, 30] },
        { canvas: [{ type: 'line', x1: 150, y1: 0, x2: 465, y2: 0, lineWidth: 2, lineColor: '#E53935' }], margin: [0, 0, 0, 20] },
        { text: 'De Camino Servicios Auxiliares S.L.', style: 'coverCompany', alignment: 'center', margin: [0, 0, 0, 10] },
        { text: 'CIF: B-87654321', style: 'coverInfo', alignment: 'center', margin: [0, 0, 0, 5] },
        { text: 'Madrid, España', style: 'coverInfo', alignment: 'center', margin: [0, 0, 0, 5] },
        { text: 'www.decaminoservicios.com', style: 'coverInfo', alignment: 'center', margin: [0, 0, 0, 5] },
        { text: 'info@decaminoservicios.com', style: 'coverInfo', alignment: 'center', margin: [0, 0, 0, 20] },
        { text: `Versión 1.0 - ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, style: 'coverVersion', alignment: 'center', margin: [0, 0, 0, 50] },
        { text: 'Documento de uso interno - Confidencial', style: 'coverConfidential', alignment: 'center' }
      ],
      pageBreak: 'after'
    },
    // Conținutul manualului
    ...pdfContent
  ],
  styles: {
    coverTitle: {
      fontSize: 28,
      bold: true,
      color: '#E53935'
    },
    coverSubtitle: {
      fontSize: 20,
      bold: true,
      color: '#E53935'
    },
    coverCompany: {
      fontSize: 16,
      bold: true,
      color: '#333333'
    },
    coverInfo: {
      fontSize: 10,
      color: '#666666'
    },
    coverVersion: {
      fontSize: 9,
      color: '#999999'
    },
    coverConfidential: {
      fontSize: 8,
      color: '#CCCCCC'
    },
    header: {
      fontSize: 9,
      color: '#666666'
    },
    footer: {
      fontSize: 8,
      color: '#999999'
    },
    heading1: {
      fontSize: 18,
      bold: true,
      color: '#E53935'
    },
    heading2: {
      fontSize: 14,
      bold: true,
      color: '#333333'
    },
    heading3: {
      fontSize: 12,
      bold: true,
      color: '#555555'
    },
    heading4: {
      fontSize: 11,
      bold: true,
      color: '#666666'
    },
    body: {
      fontSize: 10,
      color: '#000000',
      lineHeight: 1.4
    }
  },
  defaultStyle: {
    font: 'Roboto',
    fontSize: 10,
    lineHeight: 1.4
  }
};

// Generează PDF-ul
console.log('🔄 Generando PDF con pdfmake...');
try {
  // pdfmake în Node.js folosește PdfPrinter ca constructor
  const printer = new PdfPrinter(fonts);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  
  pdfDoc.pipe(fs.createWriteStream(outputPath));
  pdfDoc.end();
  
  pdfDoc.on('end', () => {
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log('');
      console.log('✅ PDF generado con éxito!');
      console.log(`📄 Archivo: ${outputPath}`);
      console.log(`📊 Tamaño: ${fileSizeMB} MB`);
    }
  });
} catch (error) {
  console.error('❌ Error al generar PDF:', error.message);
  console.error('Stack:', error.stack);
  
  // Încearcă alternativă - poate pdfmake are o structură diferită
  try {
    console.log('🔄 Intentando método alternativo...');
    const pdfmakeModule = require('pdfmake/src/printer');
    const printer = new pdfmakeModule(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    pdfDoc.pipe(fs.createWriteStream(outputPath));
    pdfDoc.end();
    
    pdfDoc.on('end', () => {
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log('');
        console.log('✅ PDF generado con éxito (método alternativo)!');
        console.log(`📄 Archivo: ${outputPath}`);
        console.log(`📊 Tamaño: ${fileSizeMB} MB`);
      }
    });
  } catch (error2) {
    console.error('❌ Error también con método alternativo:', error2.message);
    console.error('');
    console.error('💡 Solución: Instala pdfmake en backend:');
    console.error('   cd backend');
    console.error('   npm install pdfmake');
    process.exit(1);
  }
}
