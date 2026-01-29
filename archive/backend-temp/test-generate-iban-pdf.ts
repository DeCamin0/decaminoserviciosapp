// Script de test pentru generarea PDF-ului Lista IBAN
// Rulare: npx ts-node test-generate-iban-pdf.ts

import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function testGenerateIbanPDF() {
  try {
    console.log('🧪 Test generare PDF Lista IBAN...\n');

    // CODIGO-uri de utilizatori de exclus
    const excludedCodigos = ['10000002', '10000001'];
    
    // Obține toți angajații
    const allEmpleados = await prisma.$queryRaw<any[]>`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\`,
        NOMBRE,
        APELLIDO1,
        APELLIDO2,
        \`ESTADO\`,
        \`Nº Cuenta\`,
        fecha_baja_programada
      FROM DatosEmpleados
      ORDER BY \`NOMBRE / APELLIDOS\` ASC
    `;

    console.log(`📊 Total angajați în BD: ${allEmpleados.length}`);

    // Filtrează doar cei activi
    const activeEmployees = allEmpleados.filter((emp) => {
      const codigo = (emp.CODIGO || '').toString().trim();
      const estado = (emp.ESTADO || '').toString().trim().toUpperCase();
      const fechaBajaProgramada = emp.fecha_baja_programada || '';
      
      // Exclude utilizatorii de test/admin
      if (excludedCodigos.includes(codigo)) {
        return false;
      }
      
      // Exclude pe cei cu fecha baja programada
      if (fechaBajaProgramada && fechaBajaProgramada.toString().trim() !== '') {
        return false;
      }
      
      // Include DOAR pe cei cu ESTADO = 'ACTIVO'
      return estado === 'ACTIVO';
    });

    console.log(`✅ Angajați activi (după filtrare): ${activeEmployees.length}\n`);

    // Generează PDF-ul
    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50,
      });

      const outputPath = path.join(__dirname, 'test-lista-iban.pdf');
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title
      doc.fontSize(16).text('Lista de IBAN - Empleados Activos', { align: 'center' });
      doc.moveDown(0.5);

      // Table headers - 3 coloane
      const headers = ['CODIGO', 'NOMBRE', 'IBAN'];
      const colWidths = [120, 300, 322]; // Total: 742px
      const rowHeight = 18;
      const tableTop = doc.y;
      let currentY = tableTop;

      // Draw header
      doc.fontSize(10).font('Helvetica-Bold');
      let x = 50;
      headers.forEach((header, i) => {
        doc.text(header, x, currentY, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });
      currentY += rowHeight;

      // Linie sub header
      doc
        .moveTo(50, currentY)
        .lineTo(50 + colWidths.reduce((a, b) => a + b, 0), currentY)
        .stroke();

      // Draw rows
      doc.font('Helvetica').fontSize(8);
      currentY += 3;
      
      let pageCount = 1;
      activeEmployees.forEach((emp, index) => {
        // Verifică dacă trebuie pagină nouă
        if (currentY > 750) {
          pageCount++;
          console.log(`📄 Pagină ${pageCount - 1} completă, trec la pagină ${pageCount}...`);
          doc.addPage();
          currentY = 50;
          
          // Redraw headers on new page
          doc.font('Helvetica-Bold').fontSize(10);
          x = 50;
          headers.forEach((header, i) => {
            doc.text(header, x, currentY, { width: colWidths[i], align: 'left' });
            x += colWidths[i];
          });
          currentY += rowHeight;
          
          // Linie sub header
          doc
            .moveTo(50, currentY)
            .lineTo(50 + colWidths.reduce((a, b) => a + b, 0), currentY)
            .stroke();
          
          currentY += 3;
          doc.font('Helvetica').fontSize(8);
        }

        const codigo = (emp.CODIGO || '').toString().trim();
        const nombre = (emp['NOMBRE / APELLIDOS'] || emp.NOMBRE || '-').toString().trim();
        const iban = (emp['Nº Cuenta'] || '').toString().trim() || '-';

        // Truncate text dacă e prea lung
        const nombreTruncated = nombre.length > 40 ? nombre.substring(0, 37) + '...' : nombre;
        const ibanTruncated = iban.length > 38 ? iban.substring(0, 35) + '...' : iban;

        const row = [codigo, nombreTruncated, ibanTruncated];

        x = 50;
        row.forEach((cell, i) => {
          doc.text(cell || '-', x, currentY, { 
            width: colWidths[i], 
            align: 'left'
          });
          x += colWidths[i];
        });
        
        currentY += rowHeight;
      });

      doc.end();

      stream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        console.log(`\n✅ PDF generat cu succes!`);
        console.log(`📄 Fișier: ${outputPath}`);
        console.log(`📊 Dimensiune: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`📑 Pagini: ${pageCount}`);
        console.log(`👥 Angajați: ${activeEmployees.length}`);
        console.log(`\n💡 Deschide PDF-ul pentru a verifica formatarea!`);
        resolve();
      });

      stream.on('error', (error) => {
        console.error('❌ Eroare la scrierea PDF-ului:', error);
        reject(error);
      });
    });
  } catch (error: any) {
    console.error('❌ Eroare:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rulează testul
testGenerateIbanPDF()
  .then(() => {
    console.log('\n✅ Test completat!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test eșuat:', error);
    process.exit(1);
  });
