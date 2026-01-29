"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function testGenerateIbanPDF() {
    try {
        console.log('🧪 Test generare PDF Lista IBAN...\n');
        const excludedCodigos = ['10000002', '10000001'];
        const allEmpleados = await prisma.$queryRaw `
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
        const activeEmployees = allEmpleados.filter((emp) => {
            const codigo = (emp.CODIGO || '').toString().trim();
            const estado = (emp.ESTADO || '').toString().trim().toUpperCase();
            const fechaBajaProgramada = emp.fecha_baja_programada || '';
            if (excludedCodigos.includes(codigo)) {
                return false;
            }
            if (fechaBajaProgramada && fechaBajaProgramada.toString().trim() !== '') {
                return false;
            }
            return estado === 'ACTIVO';
        });
        console.log(`✅ Angajați activi (după filtrare): ${activeEmployees.length}\n`);
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default({
                size: 'A4',
                layout: 'landscape',
                margin: 50,
            });
            const outputPath = path.join(__dirname, 'test-lista-iban.pdf');
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);
            doc.fontSize(16).text('Lista de IBAN - Empleados Activos', { align: 'center' });
            doc.moveDown(0.5);
            const headers = ['CODIGO', 'NOMBRE', 'IBAN'];
            const colWidths = [120, 300, 322];
            const rowHeight = 18;
            const tableTop = doc.y;
            let currentY = tableTop;
            doc.fontSize(10).font('Helvetica-Bold');
            let x = 50;
            headers.forEach((header, i) => {
                doc.text(header, x, currentY, { width: colWidths[i], align: 'left' });
                x += colWidths[i];
            });
            currentY += rowHeight;
            doc
                .moveTo(50, currentY)
                .lineTo(50 + colWidths.reduce((a, b) => a + b, 0), currentY)
                .stroke();
            doc.font('Helvetica').fontSize(8);
            currentY += 3;
            let pageCount = 1;
            activeEmployees.forEach((emp, index) => {
                if (currentY > 750) {
                    pageCount++;
                    console.log(`📄 Pagină ${pageCount - 1} completă, trec la pagină ${pageCount}...`);
                    doc.addPage();
                    currentY = 50;
                    doc.font('Helvetica-Bold').fontSize(10);
                    x = 50;
                    headers.forEach((header, i) => {
                        doc.text(header, x, currentY, { width: colWidths[i], align: 'left' });
                        x += colWidths[i];
                    });
                    currentY += rowHeight;
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
    }
    catch (error) {
        console.error('❌ Eroare:', error.message);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
testGenerateIbanPDF()
    .then(() => {
    console.log('\n✅ Test completat!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Test eșuat:', error);
    process.exit(1);
});
//# sourceMappingURL=test-generate-iban-pdf.js.map