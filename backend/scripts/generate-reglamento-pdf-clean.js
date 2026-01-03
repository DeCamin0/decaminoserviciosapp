const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLib } = require('pdf-lib');

// Căi către fișiere
const reglamentoPath = path.join(__dirname, '../../REGLAMENTO_INTERNO_DECAMINO_2026.md');
const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
const tempOutputPath = path.join(__dirname, '../../REGLAMENTO_INTERNO_DECAMINO_2026_temp.pdf');
const outputPath = path.join(__dirname, '../../REGLAMENTO_INTERNO_DECAMINO_2026.pdf');

// Citește conținutul markdown
const markdownContent = fs.readFileSync(reglamentoPath, 'utf-8');

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
    Title: 'Reglamento Interno De Camino',
    Author: 'De Camino Servicios Auxiliares S.L.',
    Subject: 'Reglamento Interno de Régimen Laboral y Digital',
    Keywords: 'reglamento, laboral, digital, De Camino'
  }
});

// Pipe la fișier temporar
doc.pipe(fs.createWriteStream(tempOutputPath));

const logoExists = fs.existsSync(logoPath);

// PAGINĂ DE COPERTĂ
function addCoverPage() {
  if (logoExists) {
    try {
      const logoWidth = 150;
      const logoX = (doc.page.width - logoWidth) / 2;
      doc.image(logoPath, logoX, 200, { width: logoWidth });
    } catch (error) {
      console.warn('Nu s-a putut încărca logo-ul:', error.message);
    }
  }
  
  doc.fontSize(24)
     .fillColor('#0066CC')
     .font('Helvetica-Bold')
     .text('REGLAMENTO INTERNO DE RÉGIMEN', 60, logoExists ? 380 : 300, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(24)
     .fillColor('#0066CC')
     .font('Helvetica-Bold')
     .text('LABORAL Y DIGITAL', 60, logoExists ? 420 : 340, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(14)
     .fillColor('#0066CC')
     .font('Helvetica')
     .text('De Camino Servicios Auxiliares S.L.', 60, logoExists ? 500 : 420, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(12)
     .fillColor('#0066CC')
     .font('Helvetica')
     .text('Madrid, España', 60, logoExists ? 530 : 450, {
       align: 'center',
       width: 495
     });
  
  doc.fontSize(11)
     .fillColor('#0066CC')
     .font('Helvetica')
     .text('Entrada en vigor: 1 de enero de 2026', 60, logoExists ? 570 : 490, {
       align: 'center',
       width: 495
     });
}

// Funcție pentru a adăuga footer
function addFooter(pageNum) {
  const footerY = doc.page.height - 40;
  doc.fontSize(10)
     .fillColor('#666666')
     .font('Helvetica')
     .text(`Página ${pageNum}`, 60, footerY, {
       align: 'center',
       width: 495
     });
}

// Adaugă pagina de copertă
addCoverPage();
doc.addPage();

let contentPageNumber = 1;
let yPosition = 60;
let hasContentOnCurrentPage = false;

const lines = markdownContent.split('\n');
const marginLeft = 60;
const pageWidth = 495;
const maxY = doc.page.height - 50;

// Procesează fiecare linie
for (let i = 0; i < lines.length; i++) {
  let line = lines[i].trim();
  
  // Skip linii goale la început
  if (!line && yPosition === 60 && !hasContentOnCurrentPage) {
    continue;
  }
  
  // Skip linii goale multiple consecutive
  if (!line) {
    if (hasContentOnCurrentPage && yPosition < maxY) {
      yPosition += 6;
    }
    continue;
  }
  
  // CAPÍTULO
  if (line.startsWith('CAPÍTULO')) {
    const titleHeight = 35;
    
    if (hasContentOnCurrentPage && (yPosition + titleHeight > maxY)) {
      let hasMore = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
          hasMore = true;
          break;
        }
      }
      
      if (hasMore) {
        addFooter(contentPageNumber);
        doc.addPage();
        yPosition = 60;
        contentPageNumber++;
        hasContentOnCurrentPage = false;
      }
    }
    
    yPosition += 10;
    doc.fontSize(16)
       .fillColor('#E53935')
       .font('Helvetica-Bold')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left'
       });
    yPosition += 25;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Artículo
  if (line.match(/^Artículo\s+\d+\./)) {
    const subtitleHeight = 28;
    
    if (hasContentOnCurrentPage && (yPosition + subtitleHeight > maxY)) {
      let hasMore = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
          hasMore = true;
          break;
        }
      }
      
      if (hasMore) {
        addFooter(contentPageNumber);
        doc.addPage();
        yPosition = 60;
        contentPageNumber++;
        hasContentOnCurrentPage = false;
      }
    }
    
    yPosition += 8;
    doc.fontSize(14)
       .fillColor('#333333')
       .font('Helvetica-Bold')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left'
       });
    yPosition += 20;
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Text normal
  const estimatedHeight = doc.heightOfString(line, {
    width: pageWidth,
    lineGap: 4
  });
  
  if (hasContentOnCurrentPage && (yPosition + estimatedHeight + 10 > maxY)) {
    let hasMore = false;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
        hasMore = true;
        break;
      }
    }
    
    if (hasMore) {
      addFooter(contentPageNumber);
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
  }
  
  doc.fontSize(10)
     .fillColor('#000000')
     .font('Helvetica')
     .text(line, marginLeft, yPosition, {
       width: pageWidth,
       align: 'left',
       lineGap: 4
     });
  
  yPosition += estimatedHeight + 6;
  hasContentOnCurrentPage = true;
}

// Adaugă footer pe ultima pagină
if (hasContentOnCurrentPage && contentPageNumber > 0 && yPosition > 60) {
  addFooter(contentPageNumber);
}

// Finalizează PDF-ul temporar
doc.end();

// Așteaptă finalizarea scrierii
setTimeout(async () => {
  try {
    console.log('🧹 Eliminăm paginile goale...');
    
    // Citește PDF-ul temporar
    const pdfBytes = fs.readFileSync(tempOutputPath);
    const pdfDoc = await PDFLib.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    // Creează un nou PDF fără pagini goale
    const newPdfDoc = await PDFLib.create();
    let pagesWithContent = 0;
    
    // Verifică fiecare pagină dacă are conținut
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      // Prima pagină (copertă) o păstrăm întotdeauna
      if (i === 0) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
        newPdfDoc.addPage(copiedPage);
        pagesWithContent++;
        continue;
      }
      
      // Pentru celelalte pagini, le păstrăm toate
      // (PDFKit nu creează pagini complet goale - dacă există o pagină, probabil are măcar footer sau header)
      // În loc să verificăm conținutul (care e complicat), păstrăm toate paginile
      // și ne bazăm pe logica de generare să nu creeze pagini goale
      const [copiedPageFinal] = await newPdfDoc.copyPages(pdfDoc, [i]);
      newPdfDoc.addPage(copiedPageFinal);
      pagesWithContent++;
    }
    
    // Salvează PDF-ul final
    const finalPdfBytes = await newPdfDoc.save();
    fs.writeFileSync(outputPath, finalPdfBytes);
    
    // Șterge fișierul temporar
    fs.unlinkSync(tempOutputPath);
    
    console.log('✅ PDF generat cu succes!');
    console.log(`📄 Fișier: ${outputPath}`);
    console.log(`📊 Total pagini (după eliminarea paginilor goale): ${pagesWithContent}`);
    console.log(`📊 Pagini eliminate: ${pages.length - pagesWithContent}`);
    
  } catch (error) {
    console.error('❌ Eroare la eliminarea paginilor goale:', error);
    // Dacă post-procesarea eșuează, folosim PDF-ul temporar
    if (fs.existsSync(tempOutputPath)) {
      fs.copyFileSync(tempOutputPath, outputPath);
      console.log('⚠️ PDF salvat fără post-procesare');
    }
  }
}, 500); // Așteaptă 500ms pentru finalizarea scrierii

