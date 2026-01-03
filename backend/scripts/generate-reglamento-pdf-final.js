const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLib } = require('pdf-lib');
const PDFParse = require('pdf-parse');

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
console.log(`📝 Procesăm ${lines.length} linii din markdown...`);
let lastProcessedLine = '';
for (let i = 0; i < lines.length; i++) {
  let line = lines[i].trim();
  
  // Log ultimele capitole procesate pentru debugging
  if (line.startsWith('CAPÍTULO')) {
    console.log(`📄 Procesăm: ${line}`);
    lastProcessedLine = line;
  }
  
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
    // Calculează înălțimea reală a titlului (poate fi pe mai multe linii)
    const actualTitleHeight = doc.heightOfString(line, {
      width: pageWidth,
      lineGap: 4
    });
    
    // Verifică dacă următorul conținut (Artículo sau text) încape împreună cu titlul
    let nextContentLine = '';
    let nextContentHeight = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('CAPÍTULO')) {
        nextContentLine = nextLine;
        if (nextLine.match(/^Artículo\s+\d+\./)) {
          // Dacă următorul este Artículo, calculează înălțimea lui
          nextContentHeight = doc.heightOfString(nextLine, {
            width: pageWidth,
            lineGap: 3
          }) + 12 + 8; // titlu + spațiu înainte + spațiu după
        } else {
          // Dacă următorul este text normal, calculează înălțimea lui
          nextContentHeight = doc.heightOfString(nextLine, {
            width: pageWidth,
            lineGap: 4
          }) + 6;
        }
        break;
      }
    }
    
    // Verifică dacă trebuie pagină nouă DOAR dacă titlul + cel puțin o linie de conținut nu încape
    const totalHeight = 10 + actualTitleHeight + 12 + nextContentHeight; // spațiu înainte + titlu + spațiu după + conținut
    if (hasContentOnCurrentPage && (yPosition + totalHeight > maxY) && nextContentLine) {
      // Creează pagină nouă înainte de a adăuga titlul
      addFooter(contentPageNumber);
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    yPosition += 10; // Spațiu înainte de titlu
    doc.fontSize(16)
       .fillColor('#E53935')
       .font('Helvetica-Bold')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 4 // Spațiu între liniile titlului dacă se împarte
       });
    yPosition += actualTitleHeight + 12; // Spațiu suplimentar după titlu
    hasContentOnCurrentPage = true;
    continue;
  }
  
  // Artículo
  if (line.match(/^Artículo\s+\d+\./)) {
    // Calculează înălțimea reală a subtitlului
    const actualSubtitleHeight = doc.heightOfString(line, {
      width: pageWidth,
      lineGap: 3
    });
    
    // Verifică dacă următoarea linie de conținut încape împreună cu titlul
    let nextContentLine = '';
    let nextContentHeight = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('CAPÍTULO') && !nextLine.match(/^Artículo\s+\d+\./)) {
        nextContentLine = nextLine;
        nextContentHeight = doc.heightOfString(nextLine, {
          width: pageWidth,
          lineGap: 4
        });
        break;
      }
    }
    
    // Verifică dacă trebuie pagină nouă DOAR dacă titlul + cel puțin o linie de conținut nu încape
    const totalHeight = actualSubtitleHeight + 12 + 8 + nextContentHeight; // titlu + spațiu + conținut
    if (hasContentOnCurrentPage && (yPosition + totalHeight > maxY) && nextContentLine) {
      // Creează pagină nouă înainte de a adăuga titlul
      addFooter(contentPageNumber);
      doc.addPage();
      yPosition = 60;
      contentPageNumber++;
      hasContentOnCurrentPage = false;
    }
    
    yPosition += 12; // Spațiu suplimentar înainte de Artículo (12px în loc de 8px)
    doc.fontSize(14)
       .fillColor('#333333')
       .font('Helvetica-Bold')
       .text(line, marginLeft, yPosition, {
         width: pageWidth,
         align: 'left',
         lineGap: 3 // Spațiu între liniile subtitlului dacă se împarte
       });
    // Folosim înălțimea deja calculată mai sus
    yPosition += actualSubtitleHeight + 8; // Spațiu după subtitlu
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

console.log(`✅ Ultimul capitol procesat: ${lastProcessedLine || 'N/A'}`);
console.log(`📊 Total linii procesate: ${lines.length}`);

// Finalizează PDF-ul temporar
doc.end();

// Așteaptă finalizarea scrierii și post-procesează
setTimeout(async () => {
  try {
    console.log('🧹 Eliminăm paginile goale...');
    
    // Citește PDF-ul temporar
    const pdfBytes = fs.readFileSync(tempOutputPath);
    const pdfDoc = await PDFLib.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    
    // Creează un nou PDF fără pagini goale
    const newPdfDoc = await PDFLib.create();
    let pagesWithContent = 0;
    let pagesRemoved = 0;
    
    // Parsează întregul PDF pentru a obține textul de pe fiecare pagină
    let pageTexts = [];
    try {
      const fullPdfData = await PDFParse(pdfBytes);
      // pdf-parse returnează textul pentru întregul PDF, nu per pagină
      // Trebuie să extragem manual paginile
      pageTexts = [fullPdfData.text]; // Pentru moment, folosim textul complet
    } catch (error) {
      console.warn('⚠️ Nu s-a putut parsa PDF-ul complet, folosim metoda alternativă');
    }
    
    // Verifică fiecare pagină dacă are conținut
    for (let i = 0; i < totalPages; i++) {
      // Prima pagină (copertă) o păstrăm întotdeauna
      if (i === 0) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
        newPdfDoc.addPage(copiedPage);
        pagesWithContent++;
        continue;
      }
      
      // Pentru celelalte pagini, extragem pagina ca PDF separat
      const tempPdf = await PDFLib.create();
      const [copiedPage] = await tempPdf.copyPages(pdfDoc, [i]);
      tempPdf.addPage(copiedPage);
      const pageBytes = await tempPdf.save();
      const pageSize = pageBytes.length;
      
      // Strategie FOARTE conservatoare: eliminăm DOAR paginile cu siguranță goale
      // O pagină cu siguranță goală are dimensiune FOARTE mică (< 900 bytes) ȘI nu are text deloc
      let isDefinitelyEmpty = pageSize < 900; // Doar paginile foarte mici
      
      // Verificăm cu pdf-parse dacă pagina are text
      try {
        const pdfData = await PDFParse(Buffer.from(pageBytes));
        const text = (pdfData.text || '').trim();
        
        if (text.length > 0) {
          // Dacă pagina are orice text, o păstrăm (chiar dacă este doar footer)
          isDefinitelyEmpty = false;
        }
      } catch (parseError) {
        // Dacă nu putem parsa, folosim doar dimensiunea
        // Doar paginile cu dimensiune foarte mică (< 900 bytes) sunt considerate goale
        isDefinitelyEmpty = pageSize < 900;
      }
      
      // Păstrăm pagina dacă nu este cu siguranță goală
      if (!isDefinitelyEmpty) {
        const [copiedPageFinal] = await newPdfDoc.copyPages(pdfDoc, [i]);
        newPdfDoc.addPage(copiedPageFinal);
        pagesWithContent++;
      } else {
        console.log(`⚠️ Pagină ${i + 1} eliminată (goală - ${pageSize} bytes)`);
        pagesRemoved++;
      }
    }
    
    // Salvează PDF-ul final
    const finalPdfBytes = await newPdfDoc.save();
    fs.writeFileSync(outputPath, finalPdfBytes);
    
    // Șterge fișierul temporar
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
    
    console.log('✅ PDF generat cu succes!');
    console.log(`📄 Fișier: ${outputPath}`);
    console.log(`📊 Total pagini originale: ${totalPages}`);
    console.log(`📊 Pagini cu conținut: ${pagesWithContent}`);
    console.log(`📊 Pagini eliminate: ${pagesRemoved}`);
    
  } catch (error) {
    console.error('❌ Eroare la eliminarea paginilor goale:', error);
    // Dacă post-procesarea eșuează, folosim PDF-ul temporar
    if (fs.existsSync(tempOutputPath)) {
      fs.copyFileSync(tempOutputPath, outputPath);
      console.log('⚠️ PDF salvat fără post-procesare');
    }
  }
}, 1000); // Așteaptă 1 secundă pentru finalizarea scrierii

