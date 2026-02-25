/**
 * Genera backend/assets/presupuesto-template.docx con placeholders para docxtemplater.
 * Así la app tiene la plantilla incluida y no hay que cargar nada a mano.
 * Placeholders: {cliente_nombre}, {numero_presupuesto}, {nombre_presupuesto}, {fecha}, tabla: {#filas_oferta} {descripcion} {mensualidad_sin_iva} {mensualidad_con_iva} {anualidad_sin_iva} {anualidad_con_iva} {/filas_oferta}
 */
const path = require('path');
const fs = require('fs');

// docx puede ser ESM; usamos dynamic import o require según lo que exporte
async function main() {
  const docx = require('docx');
  const Document = docx.Document;
  const Packer = docx.Packer;
  const Paragraph = docx.Paragraph;
  const Table = docx.Table;
  const TableRow = docx.TableRow;
  const TableCell = docx.TableCell;
  const TextRun = docx.TextRun;
  const AlignmentType = docx.AlignmentType;
  const WidthType = docx.WidthType;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'PRESUPUESTO 2026',
            alignment: AlignmentType.CENTER,
            heading: 'Title',
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: '{cliente_nombre}',
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: 'PRESUPUESTO Nº {numero_presupuesto}',
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: 'www.decaminoservicios.com',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: 'Tfno: 645 111 999',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: 'decaminoservicios@gmail.com',
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: 'INDICE',
            heading: 'Heading1',
            spacing: { after: 200 },
          }),
          new Paragraph('1. INTRODUCCION'),
          new Paragraph('1.1 Carta de Presentacion'),
          new Paragraph('1.2 Servicios Ofertados'),
          new Paragraph('2. DESCRIPCION OPERATIVA'),
          new Paragraph('3. OFERTA ECONOMICA'),
          new Paragraph('3.1 Oferta Económica'),
          new Paragraph({ text: ' ', spacing: { after: 400 } }),
          new Paragraph({
            text: 'OFERTA ECONOMICA',
            heading: 'Heading1',
            spacing: { after: 200 },
          }),
          new Paragraph('El precio de los servicios, en base a todo lo anteriormente expuesto es el siguiente:'),
          new Paragraph({ text: ' ', spacing: { after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ children: [new Paragraph('DESCRIPCION')] }),
                  new TableCell({ children: [new Paragraph('MENSUALIDAD')] }),
                  new TableCell({ children: [new Paragraph('ANUALIDAD')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('{#filas_oferta}{descripcion}')] }),
                  new TableCell({
                    children: [
                      new Paragraph('{mensualidad_sin_iva}'),
                      new Paragraph('{mensualidad_con_iva}'),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph('{anualidad_sin_iva}'),
                      new Paragraph('{anualidad_con_iva}{/filas_oferta}'),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: ' ', spacing: { after: 400 } }),
          new Paragraph({
            text: 'De Camino Servicios Auxiliares S.L. CIF: B-85524536',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: 'Presupuesto generado desde la aplicación. Fecha: {fecha}',
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'presupuesto-template.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Plantilla creada:', outPath);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
