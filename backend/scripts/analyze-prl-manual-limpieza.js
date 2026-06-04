const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '../../MANUAL LIMPIEZA.pdf');
const outPath = path.join(__dirname, '../../manual-limpieza-extract.txt');

async function extractWithPdfParse() {
  const pdfParseModule = require('pdf-parse');
  const PDFParse = pdfParseModule.PDFParse;
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfInstance = new PDFParse({ data: new Uint8Array(dataBuffer) });
  const textResult = await pdfInstance.getText();
  const text =
    textResult && typeof textResult === 'object' && 'text' in textResult
      ? textResult.text
      : typeof textResult === 'string'
        ? textResult
        : '';
  const info = await pdfInstance.getInfo().catch(() => null);
  return { text, pages: info?.total ?? info?.numPages ?? null };
}

async function extractFooterPositionsWithPdfLib() {
  const { PDFDocument } = require('pdf-lib');
  const bytes = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  const lines = [`PDF pages: ${pages.length}`, ''];

  for (let pageNum = pages.length; pageNum >= Math.max(1, pages.length - 3); pageNum -= 1) {
    const page = pages[pageNum - 1];
    const pw = page.getWidth();
    const ph = page.getHeight();
    lines.push(`=== PAGE ${pageNum} size=${pw}x${ph} ===`);
    lines.push(`(Use pdfjs in browser for text positions; page dimensions for ratio calc)`);
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const { text, pages } = await extractWithPdfParse();
  const lower = text.toLowerCase();
  const autoIdx = lower.indexOf('autoeval');
  const testIdx = lower.indexOf('test');
  const evalIdx = lower.indexOf('evaluar');

  let body = `Pages (pdf-parse): ${pages ?? '?'}\nText length: ${text.length}\n\n`;
  body += '=== AUTOEVAL SECTION ===\n';
  const start = autoIdx >= 0 ? autoIdx : evalIdx >= 0 ? evalIdx : testIdx;
  if (start >= 0) body += text.slice(start, start + 12000);
  else body += text.slice(-12000);

  body += '\n\n=== PDF-LIB PAGE INFO ===\n';
  body += await extractFooterPositionsWithPdfLib();

  fs.writeFileSync(outPath, body, 'utf8');
  console.log('Wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
