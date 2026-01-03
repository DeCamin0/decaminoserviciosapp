const fs = require('fs');
const path = require('path');

// Încearcă să încarce pdfmake
let PdfPrinter;
try {
  // pdfmake în Node.js se importă diferit
  const pdfmake = require('pdfmake');
  // În Node.js, pdfmake exportă PdfPrinter direct
  PdfPrinter = pdfmake;
} catch (error) {
  console.error('❌ pdfmake nu este instalat. Instalează-l cu: npm install pdfmake');
  process.exit(1);
}

// Căi către fișiere
const reglamentoPath = path.join(__dirname, '../../REGLAMENTO_INTERNO_DECAMINO_2026.md');
const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
const outputPath = path.join(__dirname, '../../REGLAMENTO_INTERNO_DECAMINO_2026.pdf');

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

// Citește conținutul markdown
const markdownContent = fs.readFileSync(reglamentoPath, 'utf-8');

// Fonturi pentru pdfmake - folosim fonturile standard dacă nu sunt disponibile
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// Încearcă să încarce fonturile Roboto dacă există
const robotoNormalPath = path.join(__dirname, '../../node_modules/pdfmake/build/fonts/Roboto/Roboto-Regular.ttf');
const robotoBoldPath = path.join(__dirname, '../../node_modules/pdfmake/build/fonts/Roboto/Roboto-Medium.ttf');
const robotoItalicPath = path.join(__dirname, '../../node_modules/pdfmake/build/fonts/Roboto/Roboto-Italic.ttf');
const robotoBoldItalicPath = path.join(__dirname, '../../node_modules/pdfmake/build/fonts/Roboto/Roboto-MediumItalic.ttf');

if (fs.existsSync(robotoNormalPath)) {
  fonts.Roboto.normal = robotoNormalPath;
  fonts.Roboto.bold = fs.existsSync(robotoBoldPath) ? robotoBoldPath : 'Helvetica-Bold';
  fonts.Roboto.italics = fs.existsSync(robotoItalicPath) ? robotoItalicPath : 'Helvetica-Oblique';
  fonts.Roboto.bolditalics = fs.existsSync(robotoBoldItalicPath) ? robotoBoldItalicPath : 'Helvetica-BoldOblique';
  console.log('✅ Fonturi Roboto găsite');
} else {
  console.log('ℹ️ Folosind fonturi standard (Helvetica)');
}

// Funcție pentru a converti markdown în format pdfmake
function parseMarkdownToPdfMake(markdown) {
  const lines = markdown.split('\n');
  const content = [];
  let currentParagraph = [];
  let inList = false;
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const originalLine = line;
    line = line.trim();
    
    // Skip empty lines
    if (!line) {
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ');
        if (paraText.trim()) {
          content.push({
            text: paraText,
            margin: [0, 0, 0, 8],
            fontSize: 10,
            lineHeight: 1.4
          });
        }
        currentParagraph = [];
      }
      if (inList && listItems.length > 0) {
        content.push({
          ul: listItems,
          margin: [20, 0, 0, 8],
          fontSize: 10,
          lineHeight: 1.4
        });
        listItems = [];
        inList = false;
      }
      continue;
    }

    // Headers (CAPÍTULO, Artículo)
    if (line.startsWith('CAPÍTULO') || line.match(/^CAPÍTULO\s/)) {
      if (currentParagraph.length > 0) {
        content.push({
          text: currentParagraph.join(' '),
          margin: [0, 0, 0, 8],
          fontSize: 10,
          lineHeight: 1.4
        });
        currentParagraph = [];
      }
      if (inList && listItems.length > 0) {
        content.push({
          ul: listItems,
          margin: [20, 0, 0, 8],
          fontSize: 10,
          lineHeight: 1.4
        });
        listItems = [];
        inList = false;
      }
      
      content.push({
        text: line,
        fontSize: 16,
        bold: true,
        margin: [0, 20, 0, 10],
        color: '#E53935'
      });
      continue;
    }

    // Artículo headers
    if (line.match(/^Artículo\s+\d+\./)) {
      if (currentParagraph.length > 0) {
        content.push({
          text: currentParagraph.join(' '),
          margin: [0, 0, 0, 8],
          fontSize: 10,
          lineHeight: 1.4
        });
        currentParagraph = [];
      }
      if (inList && listItems.length > 0) {
        content.push({
          ul: listItems,
          margin: [20, 0, 0, 8],
          fontSize: 10,
          lineHeight: 1.4
        });
        listItems = [];
        inList = false;
      }
      
      content.push({
        text: line,
        fontSize: 14,
        bold: true,
        margin: [0, 12, 0, 6],
        color: '#333333'
      });
      continue;
    }

    // List items
    if (line.match(/^[-*•]\s/) || line.match(/^\d+\.\s/)) {
      if (currentParagraph.length > 0) {
        content.push({
          text: currentParagraph.join(' '),
          margin: [0, 0, 0, 8],
          fontSize: 10,
          lineHeight: 1.4
        });
        currentParagraph = [];
      }
      inList = true;
      const itemText = line.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, '');
      listItems.push({
        text: itemText,
        fontSize: 10,
        lineHeight: 1.4
      });
      continue;
    }

    // Regular text - process bold markers
    if (line.includes('**')) {
      const parts = line.split('**');
      const formattedParts = [];
      for (let j = 0; j < parts.length; j++) {
        if (j % 2 === 1) {
          formattedParts.push({ text: parts[j], bold: true });
        } else if (parts[j]) {
          formattedParts.push(parts[j]);
        }
      }
      if (formattedParts.length > 1) {
        if (currentParagraph.length > 0) {
          content.push({
            text: currentParagraph.join(' '),
            margin: [0, 0, 0, 8],
            fontSize: 10,
            lineHeight: 1.4
          });
          currentParagraph = [];
        }
        content.push({
          text: formattedParts,
          margin: [0, 0, 0, 8],
          fontSize: 10,
          lineHeight: 1.4
        });
      } else {
        currentParagraph.push(line);
      }
      continue;
    }

    // Regular text
    currentParagraph.push(line);
  }

  // Add remaining content
  if (currentParagraph.length > 0) {
    const paraText = currentParagraph.join(' ');
    if (paraText.trim()) {
      content.push({
        text: paraText,
        margin: [0, 0, 0, 8],
        fontSize: 10,
        lineHeight: 1.4
      });
    }
  }
  if (inList && listItems.length > 0) {
    content.push({
      ul: listItems,
      margin: [20, 0, 0, 8],
      fontSize: 10,
      lineHeight: 1.4
    });
  }

  return content;
}

// Generează conținutul PDF
const pdfContent = parseMarkdownToPdfMake(markdownContent);

// Definirea documentului PDF
const docDefinition = {
  pageSize: 'A4',
  pageMargins: [60, 120, 60, 80],
  defaultStyle: {
    font: 'Roboto',
    fontSize: 10,
    lineHeight: 1.4
  },
  header: function(currentPage, pageCount) {
    if (currentPage === 1) {
      return {
        columns: [
          logoBase64 ? {
            image: logoBase64,
            width: 80,
            alignment: 'left'
          } : { text: '', width: 80 },
          {
            stack: [
              {
                text: 'REGLAMENTO INTERNO DE RÉGIMEN LABORAL Y DIGITAL',
                fontSize: 16,
                bold: true,
                color: '#E53935',
                alignment: 'center',
                margin: [0, 0, 0, 5]
              },
              {
                text: 'DeCamino Servicios Auxiliares S.L.',
                fontSize: 12,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 3]
              },
              {
                text: 'Madrid, España',
                fontSize: 10,
                alignment: 'center',
                margin: [0, 0, 0, 3]
              },
              {
                text: 'Entrada en vigor: 1 de enero de 2026',
                fontSize: 9,
                italics: true,
                alignment: 'center',
                margin: [0, 0, 0, 0]
              }
            ],
            width: '*'
          }
        ],
        margin: [60, 40, 60, 20]
      };
    } else {
      return {
        columns: [
          logoBase64 ? {
            image: logoBase64,
            width: 50,
            alignment: 'left'
          } : { text: '', width: 50 },
          {
            text: 'REGLAMENTO INTERNO - DeCamino Servicios Auxiliares S.L.',
            fontSize: 9,
            color: '#666666',
            alignment: 'right',
            margin: [0, 0, 0, 0]
          }
        ],
        margin: [60, 20, 60, 10]
      };
    }
  },
  footer: function(currentPage, pageCount) {
    return {
      columns: [
        {
          text: 'DeCamino Servicios Auxiliares S.L.',
          fontSize: 8,
          color: '#666666',
          alignment: 'left'
        },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          fontSize: 8,
          color: '#666666',
          alignment: 'right'
        }
      ],
      margin: [60, 10, 60, 0]
    };
  },
  content: pdfContent,
  styles: {
    title: {
      fontSize: 18,
      bold: true,
      color: '#E53935',
      margin: [0, 20, 0, 10]
    },
    chapter: {
      fontSize: 16,
      bold: true,
      color: '#333333',
      margin: [0, 16, 0, 8]
    },
    article: {
      fontSize: 14,
      bold: true,
      margin: [0, 12, 0, 6]
    },
    normal: {
      fontSize: 10,
      margin: [0, 0, 0, 8],
      lineHeight: 1.4
    }
  }
};

// Generează PDF-ul
try {
  // pdfmake în Node.js folosește PdfPrinter ca constructor
  const printer = new PdfPrinter(fonts);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  
  pdfDoc.pipe(fs.createWriteStream(outputPath));
  pdfDoc.end();
  
  console.log('✅ PDF generat cu succes!');
  console.log(`📄 Fișier: ${outputPath}`);
} catch (error) {
  console.error('❌ Eroare la generarea PDF:', error);
  console.error('Stack:', error.stack);
  
  // Încearcă alternativă - poate pdfmake are o structură diferită
  try {
    const pdfmakeModule = require('pdfmake/src/printer');
    const printer = new pdfmakeModule(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    pdfDoc.pipe(fs.createWriteStream(outputPath));
    pdfDoc.end();
    console.log('✅ PDF generat cu succes (metodă alternativă)!');
    console.log(`📄 Fișier: ${outputPath}`);
  } catch (error2) {
    console.error('❌ Eroare și la metoda alternativă:', error2.message);
    process.exit(1);
  }
}

