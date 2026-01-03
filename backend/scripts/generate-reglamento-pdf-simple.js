const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Căi către fișiere
const reglamentoPath = path.join(__dirname, '../../REGLAMENTO_INTERNO_DECAMINO_2026.md');
const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
const outputPath = path.join(__dirname, '../../REGLAMENTO_INTERNO_DECAMINO_2026.pdf');

// Citește conținutul markdown
const markdownContent = fs.readFileSync(reglamentoPath, 'utf-8');

// Creează documentul PDF
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

// Pipe la fișier
doc.pipe(fs.createWriteStream(outputPath));

const logoExists = fs.existsSync(logoPath);

// PAGINĂ DE COPERTĂ
function addCoverPage() {
  // Logo mare centrat
  if (logoExists) {
    try {
      const logoWidth = 150; // Logo mai mare
      const logoX = (doc.page.width - logoWidth) / 2;
      doc.image(logoPath, logoX, 200, { width: logoWidth });
    } catch (error) {
      console.warn('Nu s-a putut încărca logo-ul:', error.message);
    }
  }
  
  // Titlu principal - pe două linii
  doc.fontSize(24)
     .fillColor('#0066CC') // Albastru ca în poză
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
  
  // Informații companie
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
  
  // Data intrării în vigoare
  doc.fontSize(11)
     .fillColor('#0066CC')
     .font('Helvetica')
     .text('Entrada en vigor: 1 de enero de 2026', 60, logoExists ? 570 : 490, {
       align: 'center',
       width: 495
     });
}

// Funcție pentru a adăuga footer (doar numărul paginii)
function addFooter(pageNum) {
  const footerY = doc.page.height - 40;
  // Doar numărul paginii, centrat
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

let contentPageNumber = 0; // Numărăm paginile de conținut de la 0 (se incrementează când adăugăm prima pagină cu conținut)
let yPosition = 0; // Nu avem pagină de conținut încă
let hasContentOnCurrentPage = false; // Track dacă avem conținut pe pagina curentă
let pageCreated = false; // Track dacă am creat deja pagina de conținut
let lastPageNumber = 1; // Track numărul ultimei pagini (1 = copertă)

// Track paginile create automat de PDFKit
doc.on('pageAdded', () => {
  lastPageNumber = doc.bufferedPageRange().count;
});

// Parsează markdown și adaugă conținut
const lines = markdownContent.split('\n');
const marginLeft = 60;
const pageWidth = 495;
const maxY = doc.page.height - 50; // Poziția maximă înainte de footer

// Funcție helper pentru a crea pagină nouă DOAR dacă este necesar
function ensurePage() {
  if (!pageCreated) {
    // Prima pagină de conținut - o creăm doar când avem conținut de adăugat
    doc.addPage();
    pageCreated = true;
    contentPageNumber = 1;
    yPosition = 60;
    hasContentOnCurrentPage = false; // Resetăm flag-ul
    lastPageNumber = doc.bufferedPageRange().count;
  }
}

// Funcție helper pentru a verifica dacă PDFKit a creat automat o pagină nouă
function checkAutoPageBreak() {
  const currentPageNumber = doc.bufferedPageRange().count;
  if (currentPageNumber > lastPageNumber) {
    // PDFKit a creat automat o pagină nouă
    lastPageNumber = currentPageNumber;
    contentPageNumber++;
    yPosition = 60; // Resetăm poziția pentru noua pagină
    hasContentOnCurrentPage = false; // Resetăm flag-ul - va fi setat când adăugăm conținut
  }
}

// Procesează fiecare linie
for (let i = 0; i < lines.length; i++) {
  let line = lines[i].trim();
  
  // Skip linii goale la început (înainte de a crea prima pagină)
  if (!line && !pageCreated) {
    continue;
  }
  
  // Skip linii goale multiple consecutive (adaugă doar spațiu minim)
  if (!line) {
    // Dacă avem deja conținut pe pagină, adaugă doar un mic spațiu
    if (hasContentOnCurrentPage && pageCreated && yPosition < maxY) {
      yPosition += 6; // Spațiu între paragrafe
    }
    continue;
  }
  
  // Asigură-te că avem o pagină de conținut
  ensurePage();
  
  // CAPÍTULO - titlu mare
  if (line.startsWith('CAPÍTULO')) {
    const titleHeight = 35; // 10 spațiu + 25 înălțime titlu
    
    // Verifică dacă trebuie pagină nouă DOAR dacă avem deja conținut pe pagină
    if (hasContentOnCurrentPage && (yPosition + titleHeight > maxY)) {
      // Verifică dacă mai există conținut după (nu doar linii goale sau alte titluri)
      let hasMore = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
          hasMore = true;
          break;
        }
      }
      
      // Creează pagină nouă DOAR dacă mai există conținut real ȘI pagina curentă are conținut
      if (hasMore && hasContentOnCurrentPage) {
        addFooter(contentPageNumber);
        doc.addPage();
        yPosition = 60;
        contentPageNumber++;
        hasContentOnCurrentPage = false; // Resetăm - va fi setat la true când adăugăm conținut
        pageCreated = true; // Pagina nouă este creată
      }
    }
    
    yPosition += 10; // Spațiu înainte
    const pageBefore = doc.bufferedPageRange().count;
    doc.fontSize(16)
       .fillColor('#E53935')
       .font('Helvetica-Bold')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left'
       });
    
    // Verifică dacă PDFKit a creat automat o pagină nouă
    const pageAfter = doc.bufferedPageRange().count;
    if (pageAfter > pageBefore) {
      lastPageNumber = pageAfter;
      contentPageNumber++;
      yPosition = doc.y; // Folosim poziția Y actuală de la PDFKit
    } else {
      yPosition += 25; // Actualizăm manual
    }
    hasContentOnCurrentPage = true; // Marchează că avem conținut pe pagină
    continue;
  }
  
  // Artículo - subtitlu
  if (line.match(/^Artículo\s+\d+\./)) {
    const subtitleHeight = 28; // 8 spațiu + 20 înălțime subtitlu
    
    // Verifică dacă trebuie pagină nouă DOAR dacă avem deja conținut pe pagină
    if (hasContentOnCurrentPage && (yPosition + subtitleHeight > maxY)) {
      // Verifică dacă mai există conținut după (nu doar linii goale sau alte titluri)
      let hasMore = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
          hasMore = true;
          break;
        }
      }
      
      // Creează pagină nouă DOAR dacă mai există conținut real ȘI pagina curentă are conținut
      if (hasMore && hasContentOnCurrentPage) {
        addFooter(contentPageNumber);
        doc.addPage();
        yPosition = 60;
        contentPageNumber++;
        hasContentOnCurrentPage = false; // Resetăm - va fi setat la true când adăugăm conținut
        pageCreated = true; // Pagina nouă este creată
      }
    }
    
    yPosition += 8; // Spațiu înainte
    const pageBefore = doc.bufferedPageRange().count;
    doc.fontSize(14)
       .fillColor('#333333')
       .font('Helvetica-Bold')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left'
       });
    
    // Verifică dacă PDFKit a creat automat o pagină nouă
    const pageAfter = doc.bufferedPageRange().count;
    if (pageAfter > pageBefore) {
      lastPageNumber = pageAfter;
      contentPageNumber++;
      yPosition = doc.y; // Folosim poziția Y actuală de la PDFKit
    } else {
      yPosition += 20; // Actualizăm manual
    }
    hasContentOnCurrentPage = true; // Marchează că avem conținut pe pagină
    continue;
  }
  
  // Text normal
  // Calculează înălțimea textului înainte de a-l adăuga
  const estimatedHeight = doc.heightOfString(line, {
    width: pageWidth,
    lineGap: 4
  });
  
  // Verifică dacă trebuie pagină nouă DOAR dacă avem deja conținut pe pagină
  if (hasContentOnCurrentPage && (yPosition + estimatedHeight + 10 > maxY)) {
    // Verifică dacă mai există conținut după (nu doar linii goale sau titluri)
    let hasMore = false;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
        hasMore = true;
        break;
      }
    }
    
    // Creează pagină nouă DOAR dacă mai există conținut real ȘI pagina curentă are conținut
    if (hasMore && hasContentOnCurrentPage) {
      addFooter(contentPageNumber);
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false; // Resetăm - va fi setat la true când adăugăm conținut
      pageCreated = true; // Pagina nouă este creată
    }
  }
  
  // Salvează numărul paginii înainte de a adăuga textul
  const pageBefore = doc.bufferedPageRange().count;
  
  // Verifică dacă textul încape pe pagină înainte de a-l adăuga
  // Dacă nu încape, creăm manual o pagină nouă înainte
  if (yPosition + estimatedHeight > maxY && hasContentOnCurrentPage) {
    // Verifică dacă mai există conținut după
    let hasMore = false;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
        hasMore = true;
        break;
      }
    }
    
    if (hasMore) {
      // Creăm manual pagină nouă înainte de a adăuga textul
      addFooter(contentPageNumber);
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
      pageCreated = true;
    }
  }
  
  // Adaugă textul fără să permită PDFKit să creeze automat pagini noi
  // Folosim opțiunea height pentru a limita textul la spațiul disponibil
  const availableHeight = maxY - yPosition;
  
  if (estimatedHeight > availableHeight && hasContentOnCurrentPage) {
    // Textul nu încape - îl trunchiem sau creăm pagină nouă
    // Dar dacă am verificat deja mai sus, ar trebui să fie OK
    doc.fontSize(10)
       .fillColor('#000000')
       .font('Helvetica')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 4,
         height: availableHeight,
         ellipsis: '...'
       });
  } else {
    // Textul încape - îl adăugăm normal
    doc.fontSize(10)
       .fillColor('#000000')
       .font('Helvetica')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 4
       });
  }
  
  // Actualizează poziția - folosim doc.y dacă PDFKit a mutat cursorul
  const pageAfter = doc.bufferedPageRange().count;
  if (pageAfter > pageBefore) {
    // PDFKit a creat automat o pagină nouă
    yPosition = doc.y;
    hasContentOnCurrentPage = true;
    lastPageNumber = pageAfter;
    contentPageNumber++;
  } else {
    // Nu s-a creat pagină nouă
    yPosition += estimatedHeight + 6;
    hasContentOnCurrentPage = true;
  }
}

// Adaugă footer pe ultima pagină (doar dacă avem conținut pe ea și pagina există)
if (pageCreated && hasContentOnCurrentPage && contentPageNumber > 0 && yPosition > 60) {
  addFooter(contentPageNumber);
}

// Finalizează PDF-ul
doc.end();

console.log('✅ PDF generat cu succes!');
console.log(`📄 Fișier: ${outputPath}`);
console.log(`📊 Total pagini de conținut: ${contentPageNumber}`);
