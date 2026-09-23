/**
 * Generează DOCX Art. 18 (Decamino) cu placeholderi PRL + sello empresa.
 * Usage: node scripts/build-art18-certificado-docx.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
} = require('docx');

const root = path.resolve(__dirname, '..', '..');
const stampPath = path.join(
  root,
  'frontend',
  'public',
  'assets',
  'sello-decamino-empresa.png',
);
const outPath = path.join(
  root,
  'CERTIFICADO_INFORMACION_RECIBIDA_ART_18_DECAMINO.docx',
);

function p(text, opts = {}) {
  const {
    bold = false,
    size = 22,
    align = AlignmentType.LEFT,
    spacingAfter = 120,
    spacingBefore = 0,
    italics = false,
  } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { after: spacingAfter, before: spacingBefore },
    children: [
      new TextRun({
        text,
        bold,
        italics,
        size,
        font: 'Arial',
      }),
    ],
  });
}

function mixed(runs, opts = {}) {
  const { align = AlignmentType.LEFT, spacingAfter = 120, spacingBefore = 0 } =
    opts;
  return new Paragraph({
    alignment: align,
    spacing: { after: spacingAfter, before: spacingBefore },
    children: runs.map((r) =>
      new TextRun({
        text: r.text,
        bold: !!r.bold,
        italics: !!r.italics,
        size: r.size || 22,
        font: 'Arial',
      }),
    ),
  });
}

async function main() {
  if (!fs.existsSync(stampPath)) {
    console.error('❌ Stampila lipsă:', stampPath);
    process.exit(1);
  }
  const stampBuf = fs.readFileSync(stampPath);
  console.log('✅ Sello Decamino:', stampBuf.length, 'bytes');

  const checkItems = [
    'Riesgos específicos de la actividad indicados en la Evaluación de Riesgos y medidas de prevención aplicables.',
    'Normas generales de prevención de riesgos laborales del centro de trabajo.',
    'Normas generales de actuación en situaciones de emergencia, primeros auxilios y evacuación de trabajadores accidentados.',
    'Riesgos, medidas de protección y medidas preventivas contenidas en el Plan de Seguridad y Salud de la obra.',
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          styles: [{ id: 'Normal', run: { font: 'Arial', size: 22 } }],
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 850,
              right: 850,
            },
          },
        },
        children: [
          p('CERTIFICADO DE LA INFORMACIÓN RECIBIDA POR LOS TRABAJADORES', {
            bold: true,
            size: 28,
            align: AlignmentType.CENTER,
            spacingAfter: 280,
            spacingBefore: 80,
          }),

          mixed(
            [
              { text: 'D/. (a) ', bold: true },
              { text: '{{TRABAJADOR}}' },
            ],
            { spacingAfter: 140 },
          ),
          mixed(
            [
              { text: 'D.N.I. ', bold: true },
              { text: '{{DNI}}' },
            ],
            { spacingAfter: 140 },
          ),
          mixed(
            [
              { text: 'PUESTO DE TRABAJO: ', bold: true },
              { text: '{{PUESTO_TRABAJO}}' },
            ],
            { spacingAfter: 140 },
          ),
          mixed(
            [
              { text: 'Empresa: ', bold: true },
              { text: '{{EMPRESA}}' },
            ],
            { spacingAfter: 240 },
          ),

          p(
            'Información de riesgos y medidas preventivas conforme al Art. 18 de la Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales.',
            { size: 20, spacingAfter: 160 },
          ),
          p(
            'Con el presente documento se deja constancia de que el/la trabajador/a ha recibido información relativa a:',
            { size: 20, spacingAfter: 160 },
          ),

          ...checkItems.map(
            (item) =>
              new Paragraph({
                spacing: { after: 100 },
                indent: { left: 200 },
                children: [
                  new TextRun({ text: '☑  ', size: 22, font: 'Arial' }),
                  new TextRun({ text: item, size: 20, font: 'Arial' }),
                ],
              }),
          ),

          p(
            'Con el presente documento, se registra y controla la entrega a los trabajadores de la información de los riesgos a los que están expuestos en su puesto de trabajo y medidas preventivas a llevar a cabo para eliminar o minimizar dichos riesgos.',
            { size: 20, spacingBefore: 200, spacingAfter: 200 },
          ),

          mixed(
            [
              { text: 'En Madrid, a ', size: 20 },
              { text: '{{FECHA}}', size: 20 },
            ],
            { spacingAfter: 360 },
          ),

          // Două coloane: sello empresa (stânga) | {{FIRMA}} centrata sub trabajador (dreapta)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [4680, 4680],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4680, type: WidthType.DXA },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 120 },
                        children: [
                          new TextRun({
                            text: 'Firma y sello de Empresa:',
                            bold: true,
                            size: 20,
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80 },
                        children: [
                          new ImageRun({
                            type: 'png',
                            data: stampBuf,
                            transformation: { width: 110, height: 110 },
                            altText: {
                              title: 'Sello empresa',
                              description: 'Sello Decamino Servicios',
                              name: 'sello-decamino-empresa.png',
                            },
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4680, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                        children: [
                          new TextRun({
                            text: 'Firma de el/la trabajador/a:',
                            bold: true,
                            size: 20,
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200 },
                        children: [
                          new TextRun({
                            text: '{{FIRMA}}',
                            size: 22,
                            font: 'Arial',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  let target = outPath;
  try {
    fs.writeFileSync(target, buffer);
  } catch (e) {
    if (e && (e.code === 'EBUSY' || e.code === 'EPERM')) {
      target = outPath.replace(/\.docx$/i, '_v2.docx');
      fs.writeFileSync(target, buffer);
      console.warn('⚠️ Fișierul original e deschis în Word — salvat ca:', path.basename(target));
    } else {
      throw e;
    }
  }
  console.log('✅ DOCX generat:', target);
  console.log('Placeholders: {{TRABAJADOR}} {{DNI}} {{PUESTO_TRABAJO}} {{EMPRESA}} {{FECHA}} {{FIRMA}}');
  console.log('Sello empresa: imagine statică (sello-decamino-empresa.png)');
  console.log('Lugar: Madrid (fix)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
