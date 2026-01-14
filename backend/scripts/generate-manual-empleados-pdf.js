const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLib } = require('pdf-lib');
const PDFParse = require('pdf-parse');

// Căi către fișiere
const manualPath = path.join(__dirname, '../../frontend/docs/MANUAL_EMPLEADOS.md');
const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
const tempOutputPath = path.join(__dirname, '../../MANUAL_EMPLEADOS_DECAMINO_temp.pdf');
const outputPath = path.join(__dirname, '../../MANUAL_EMPLEADOS_DECAMINO.pdf');

// Verifică dacă fișierul manualului există
if (!fs.existsSync(manualPath)) {
  console.error('❌ Fișierul manualului nu există:', manualPath);
  process.exit(1);
}

// Citește conținutul markdown
const markdownContent = fs.readFileSync(manualPath, 'utf-8');

// Creează documentul PDF temporar
const doc = new PDFDocument({
  size: 'A4',
  margins: {
    top: 60,
    bottom: 60,
    left: 60,
    right: 60
  },
  info: {
    Title: 'Manual de Usuario - De Camino Servicios Auxiliares',
    Author: 'De Camino Servicios Auxiliares S.L.',
    Subject: 'Manual de Usuario para Empleados',
    Keywords: 'manual, empleados, usuario, De Camino, guía'
  }
});

// Pipe direct la fișier final (fără temporar)
doc.pipe(fs.createWriteStream(outputPath));

const logoExists = fs.existsSync(logoPath);

// PAGINĂ DE COPERTĂ
function addCoverPage() {
  // Fundal gradient (simulat cu linii)
  doc.rect(0, 0, doc.page.width, doc.page.height)
     .fill('#F8F9FA');
  
  if (logoExists) {
    try {
      const logoWidth = 180;
      const logoX = (doc.page.width - logoWidth) / 2;
      doc.image(logoPath, logoX, 150, { width: logoWidth });
    } catch (error) {
      console.warn('⚠️ Nu s-a putut încărca logo-ul:', error.message);
    }
  }
  
  // Título principal
  doc.fontSize(28)
     .fillColor('#E53935')
     .font('Helvetica-Bold')
     .text('MANUAL DE USUARIO', 60, logoExists ? 360 : 280, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(20)
     .fillColor('#E53935')
     .font('Helvetica-Bold')
     .text('Guía para Empleados', 60, logoExists ? 410 : 330, {
       align: 'center',
       width: 495
     });
  
  // Línea decorativa
  doc.moveTo(150, logoExists ? 450 : 370)
     .lineTo(465, logoExists ? 450 : 370)
     .strokeColor('#E53935')
     .lineWidth(2)
     .stroke();
  
  // Nombre de la empresa
  doc.fontSize(16)
     .fillColor('#333333')
     .font('Helvetica-Bold')
     .text('De Camino Servicios Auxiliares S.L.', 60, logoExists ? 480 : 400, {
       align: 'center',
       width: 495
     });
  
  // Información adicional de la empresa
  doc.fontSize(10)
     .fillColor('#666666')
     .font('Helvetica')
     .text('CIF: B-87654321', 60, logoExists ? 510 : 430, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(10)
     .fillColor('#666666')
     .font('Helvetica')
     .text('Madrid, España', 60, logoExists ? 530 : 450, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(9)
     .fillColor('#999999')
     .font('Helvetica')
     .text('www.decaminoservicios.com', 60, logoExists ? 550 : 470, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(9)
     .fillColor('#999999')
     .font('Helvetica')
     .text('info@decaminoservicios.com', 60, logoExists ? 565 : 485, {
       align: 'center',
       width: 495
     });
  
  // Fecha de versión
  const fechaVersion = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  doc.fontSize(9)
     .fillColor('#999999')
     .font('Helvetica')
     .text(`Versión 1.0 - ${fechaVersion}`, 60, logoExists ? 590 : 510, {
       align: 'center',
       width: 495
     });
  
  // Nota de confidencialidad
  doc.fontSize(8)
     .fillColor('#CCCCCC')
     .font('Helvetica')
     .text('Documento de uso interno - Confidencial', 60, doc.page.height - 80, {
       align: 'center',
       width: 495
     });
}

// Funcție pentru a adăuga footer
function addFooter(pageNum, totalPages = null) {
  const footerY = doc.page.height - 40;
  
  // Línea superior del footer
  doc.moveTo(60, footerY - 10)
     .lineTo(555, footerY - 10)
     .strokeColor('#E0E0E0')
     .lineWidth(0.5)
     .stroke();
  
  // Número de página
  const pageText = totalPages ? `Página ${pageNum} de ${totalPages}` : `Página ${pageNum}`;
  doc.fontSize(9)
     .fillColor('#666666')
     .font('Helvetica')
     .text(pageText, 60, footerY, {
       align: 'center',
       width: 495
     });
  
  // Logo pequeño en el footer (opcional)
  if (logoExists && pageNum > 1) {
    try {
      doc.image(logoPath, 60, footerY - 5, { width: 20 });
    } catch (error) {
      // Ignorar error si no se puede cargar
    }
  }
  
  // Texto del footer con información de la empresa
  doc.fontSize(7)
     .fillColor('#999999')
     .font('Helvetica')
     .text('De Camino Servicios Auxiliares S.L. | CIF: B-87654321 | Madrid, España', 85, footerY, {
       width: 470,
       align: 'right'
     });
}

// Adaugă pagina de copertă
addCoverPage();
doc.addPage();

let contentPageNumber = 1;
let yPosition = 60;
let hasContentOnCurrentPage = false;
let lastPageHadContent = false; // Track dacă ultima pagină a avut conținut

const lines = markdownContent.split('\n');
const marginLeft = 60;
const pageWidth = 495;
const maxY = doc.page.height - 80; // Más espacio para el footer

// Funcție helper pentru a verifica dacă există conținut real după index-ul curent
function hasRealContentAfter(index) {
  // Verifică următoarele 50 de linii (sau până la sfârșit)
  const maxCheck = Math.min(index + 50, lines.length);
  for (let j = index + 1; j < maxCheck; j++) {
    const nextLine = lines[j].trim();
    // Ignoră linii goale și separatoare
    if (nextLine && !nextLine.match(/^-{3,}$/)) {
      // Verifică dacă nu e doar un separator sau linie goală
      if (nextLine.length > 2) {
        return true;
      }
    }
  }
  return false;
}

// Funcție pentru a verifica dacă trebuie să creez o pagină nouă
function shouldCreateNewPage(currentY, contentHeight, hasContent) {
  // Nu creează pagină nouă dacă nu există conținut pe pagina curentă
  if (!hasContent) {
    return false;
  }
  
  // Nu creează pagină nouă dacă conținutul încape pe pagina curentă
  if (currentY + contentHeight <= maxY) {
    return false;
  }
  
  return true;
}

// Procesează fiecare linie
console.log(`📝 Procesando ${lines.length} líneas del manual...`);

for (let i = 0; i < lines.length; i++) {
  let line = lines[i].trim();
  
  // Skip linii goale la început
  if (!line && yPosition === 60 && !hasContentOnCurrentPage) {
    continue;
  }
  
  // Skip linii goale multiple consecutive (reducimos el espacio)
  if (!line) {
    if (hasContentOnCurrentPage && yPosition < maxY) {
      yPosition += 4;
    }
    continue;
  }
  
  // Títulos principales (##)
  if (line.startsWith('## ')) {
    const title = line.replace('## ', '');
    
    // Verifică dacă trebuie pagină nouă
    const titleHeight = doc.heightOfString(title, {
      width: pageWidth,
      lineGap: 4
    });
    
    // Verifică dacă există conținut real după acest titlu
    const hasContentAfter = hasRealContentAfter(i);
    
    // Doar creează pagină nouă dacă există conținut după ȘI dacă pagina curentă are deja conținut
    // ȘI dacă conținutul nu încape pe pagina curentă
    if (shouldCreateNewPage(yPosition, titleHeight + 20, hasContentOnCurrentPage) && hasContentAfter) {
      addFooter(contentPageNumber);
      lastPageHadContent = true;
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    yPosition += 15; // Espacio antes del título
    doc.fontSize(18)
       .fillColor('#E53935')
       .font('Helvetica-Bold')
       .text(title, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 4
       });
    yPosition += titleHeight + 12;
    hasContentOnCurrentPage = true;
    lastPageHadContent = true;
    continue;
  }
  
  // Subtítulos (###)
  if (line.startsWith('### ')) {
    const subtitle = line.replace('### ', '');
    
    const subtitleHeight = doc.heightOfString(subtitle, {
      width: pageWidth,
      lineGap: 3
    });
    
    // Verifică dacă există conținut real după acest subtitlu
    const hasContentAfter = hasRealContentAfter(i);
    
    if (shouldCreateNewPage(yPosition, subtitleHeight + 15, hasContentOnCurrentPage) && hasContentAfter) {
      addFooter(contentPageNumber);
      lastPageHadContent = true;
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    yPosition += 10;
    doc.fontSize(14)
       .fillColor('#333333')
       .font('Helvetica-Bold')
       .text(subtitle, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 3
       });
    yPosition += subtitleHeight + 8;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Subtítulos nivel 4 (####)
  if (line.startsWith('#### ')) {
    const subsubtitle = line.replace('#### ', '');
    
    const subsubtitleHeight = doc.heightOfString(subsubtitle, {
      width: pageWidth,
      lineGap: 3
    });
    
    // Verifică dacă există conținut real după
    const hasContentAfter = hasRealContentAfter(i);
    
    if (shouldCreateNewPage(yPosition, subsubtitleHeight + 12, hasContentOnCurrentPage) && hasContentAfter) {
      addFooter(contentPageNumber);
      lastPageHadContent = true;
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    yPosition += 8;
    doc.fontSize(12)
       .fillColor('#555555')
       .font('Helvetica-Bold')
       .text(subsubtitle, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 3
       });
    yPosition += subsubtitleHeight + 6;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Subtítulos nivel 5 (#####)
  if (line.startsWith('##### ')) {
    const subsubsubtitle = line.replace('##### ', '');
    
    const subsubsubtitleHeight = doc.heightOfString(subsubsubtitle, {
      width: pageWidth,
      lineGap: 3
    });
    
    // Verifică dacă există conținut real după
    const hasContentAfter = hasRealContentAfter(i);
    
    if (shouldCreateNewPage(yPosition, subsubsubtitleHeight + 10, hasContentOnCurrentPage) && hasContentAfter) {
      addFooter(contentPageNumber);
      lastPageHadContent = true;
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    yPosition += 6;
    doc.fontSize(11)
       .fillColor('#666666')
       .font('Helvetica-Bold')
       .text(subsubsubtitle, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 3
       });
    yPosition += subsubsubtitleHeight + 5;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Listas con viñetas (- o *)
  if (line.match(/^[-*]\s+/)) {
    const listItem = line.replace(/^[-*]\s+/, '');
    
    const itemHeight = doc.heightOfString(listItem, {
      width: pageWidth - 20, // Menos ancho para la viñeta
      lineGap: 3
    });
    
    // Verifică dacă există conținut real după
    const hasMoreContent = hasRealContentAfter(i);
    
    if (shouldCreateNewPage(yPosition, itemHeight + 5, hasContentOnCurrentPage) && hasMoreContent) {
      addFooter(contentPageNumber);
      lastPageHadContent = true;
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    // Viñeta
    doc.fontSize(10)
       .fillColor('#E53935')
       .font('Helvetica-Bold')
       .text('•', marginLeft, yPosition);
    
    // Texto de la lista
    doc.fontSize(10)
       .fillColor('#000000')
       .font('Helvetica')
       .text(listItem, marginLeft + 15, yPosition, {
         width: pageWidth - 20,
         align: 'left',
         lineGap: 3
       });
    
    yPosition += itemHeight + 4;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Listas numeradas
  if (line.match(/^\d+\.\s+/)) {
    const listItem = line.replace(/^\d+\.\s+/, '');
    
    const itemHeight = doc.heightOfString(listItem, {
      width: pageWidth - 20,
      lineGap: 3
    });
    
    // Verifică dacă există conținut real după
    const hasMoreContent = hasRealContentAfter(i);
    
    if (shouldCreateNewPage(yPosition, itemHeight + 5, hasContentOnCurrentPage) && hasMoreContent) {
      addFooter(contentPageNumber);
      lastPageHadContent = true;
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    // Número
    const match = line.match(/^(\d+)\./);
    if (match) {
      doc.fontSize(10)
         .fillColor('#E53935')
         .font('Helvetica-Bold')
         .text(`${match[1]}.`, marginLeft, yPosition);
    }
    
    // Texto
    doc.fontSize(10)
       .fillColor('#000000')
       .font('Helvetica')
       .text(listItem, marginLeft + 20, yPosition, {
         width: pageWidth - 25,
         align: 'left',
         lineGap: 3
       });
    
    yPosition += itemHeight + 4;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Texto con formato especial (negrita en markdown: **texto**)
  if (line.includes('**')) {
    // Procesamos texto con negrita
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    let currentX = marginLeft;
    
    const lineHeight = doc.heightOfString('Test', {
      width: pageWidth,
      lineGap: 4
    });
    
    // Verifică dacă există conținut real după
    const hasMoreContent = hasRealContentAfter(i);
    
    if (hasContentOnCurrentPage && (yPosition + lineHeight + 5 > maxY) && hasMoreContent) {
      addFooter(contentPageNumber);
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
      currentX = marginLeft;
    }
    
    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Texto en negrita
        const boldText = part.replace(/\*\*/g, '');
        doc.fontSize(10)
           .fillColor('#000000')
           .font('Helvetica-Bold')
           .text(boldText, currentX, yPosition, {
             width: pageWidth - (currentX - marginLeft),
             continued: true
           });
        currentX += doc.widthOfString(boldText, { font: 'Helvetica-Bold', fontSize: 10 });
      } else if (part.trim()) {
        // Texto normal
        doc.fontSize(10)
           .fillColor('#000000')
           .font('Helvetica')
           .text(part, currentX, yPosition, {
             width: pageWidth - (currentX - marginLeft),
             continued: true
           });
        currentX += doc.widthOfString(part, { font: 'Helvetica', fontSize: 10 });
      }
    });
    
    yPosition += lineHeight + 4;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Separadores (---)
  if (line.match(/^-{3,}$/)) {
    // Verifică dacă există conținut real după separator
    const hasContentAfter = hasRealContentAfter(i);
    
    if (shouldCreateNewPage(yPosition, 15, hasContentOnCurrentPage) && hasContentAfter) {
      addFooter(contentPageNumber);
      lastPageHadContent = true;
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    yPosition += 8;
    doc.moveTo(marginLeft, yPosition)
       .lineTo(marginLeft + pageWidth, yPosition)
       .strokeColor('#E0E0E0')
       .lineWidth(1)
       .stroke();
    yPosition += 12;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Texto normal
  const estimatedHeight = doc.heightOfString(line, {
    width: pageWidth,
    lineGap: 4
  });
  
  // Verifică dacă există conținut real după această linie
  const hasMoreContent = hasRealContentAfter(i);
  
  // Doar creează pagină nouă dacă există mai mult conținut ȘI dacă conținutul nu încape
  if (shouldCreateNewPage(yPosition, estimatedHeight + 8, hasContentOnCurrentPage) && hasMoreContent) {
    addFooter(contentPageNumber);
    lastPageHadContent = true;
    doc.addPage();
    yPosition = 60;
    contentPageNumber++;
    hasContentOnCurrentPage = false;
  }
  
  // Nu adăuga text dacă nu mai avem spațiu și nu există mai mult conținut
  if (hasContentOnCurrentPage && (yPosition + estimatedHeight + 8 > maxY) && !hasMoreContent) {
    // Nu mai adăugăm conținut, doar footer pe ultima pagină
    continue;
  }
  
  doc.fontSize(10)
     .fillColor('#000000')
     .font('Helvetica')
     .text(line, marginLeft, yPosition, {
       width: pageWidth,
       align: 'left',
       lineGap: 4
     });
  
  yPosition += estimatedHeight + 4;
  hasContentOnCurrentPage = true;
}

// Adaugă footer pe ultima pagină doar dacă are conținut
if (hasContentOnCurrentPage && contentPageNumber > 0 && yPosition > 60 && lastPageHadContent) {
  addFooter(contentPageNumber);
}

console.log(`📊 Total páginas generadas: ${contentPageNumber}`);

// Finalizează PDF-ul temporar
doc.end();

// Finalizează PDF-ul
doc.on('end', () => {
  console.log('✅ PDF generado con éxito!');
  console.log(`📄 Archivo: ${outputPath}`);
  console.log(`📊 Total páginas: ${contentPageNumber}`);
});
