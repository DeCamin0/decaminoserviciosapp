import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BajaVoluntariaPdfService {
  private readonly logger = new Logger(BajaVoluntariaPdfService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generează PDF pentru Baja voluntaria
   */
  async generateBajaVoluntariaPDF(data: {
    codigo: string;
    nombre: string;
    fecha_solicitud: string;
    fecha_ultimo_dia_trabajo: string;
    dias_preaviso: number;
    cumple_preaviso_15: boolean;
    motivo?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 60,
            bottom: 60,
            left: 60,
            right: 60,
          },
          info: {
            Title: 'Baja Voluntaria',
            Author: 'De Camino Servicios Auxiliares S.L.',
            Subject: 'Solicitud de Baja Voluntaria',
            Keywords: 'baja, voluntaria, solicitud',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          this.logger.log(
            `✅ PDF generat pentru Baja voluntaria - ${data.codigo} (${pdfBuffer.length} bytes)`,
          );
          resolve(pdfBuffer);
        });
        doc.on('error', (error) => {
          this.logger.error(
            `❌ Eroare la generarea PDF pentru Baja voluntaria: ${error.message}`,
          );
          reject(error);
        });

        // Header
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('BAJA VOLUNTARIA', { align: 'center' });
        doc.moveDown(2);

        // Informații angajat
        doc.fontSize(12).font('Helvetica');
        doc.text(`Código: ${data.codigo}`, { align: 'left' });
        doc.text(`Nombre: ${data.nombre}`, { align: 'left' });
        doc.moveDown();

        // Date importante
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Fechas:', { align: 'left' });
        doc.font('Helvetica');
        doc.text(
          `  • Fecha de solicitud: ${this.formatDate(data.fecha_solicitud)}`,
          {
            align: 'left',
          },
        );
        doc.text(
          `  • Último día de trabajo: ${this.formatDate(data.fecha_ultimo_dia_trabajo)}`,
          { align: 'left' },
        );
        doc.moveDown();

        // Preaviso
        doc.font('Helvetica-Bold');
        doc.text('Preaviso:', { align: 'left' });
        doc.font('Helvetica');
        doc.text(`  • Días de preaviso: ${data.dias_preaviso}`, {
          align: 'left',
        });
        doc.text(
          `  • Cumple preaviso de 15 días: ${data.cumple_preaviso_15 ? 'SÍ' : 'NO'}`,
          { align: 'left' },
        );
        doc.moveDown();

        // Motivo (dacă există)
        if (data.motivo) {
          doc.font('Helvetica-Bold');
          doc.text('Motivo:', { align: 'left' });
          doc.font('Helvetica');
          doc.text(data.motivo, { align: 'left' });
          doc.moveDown();
        }

        // Footer
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(
            'Este documento ha sido generado automáticamente por el sistema De Camino Servicios Auxiliares S.L.',
            { align: 'center' },
          );
        doc.text(
          `Generado el: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`,
          { align: 'center' },
        );

        doc.end();
      } catch (error: any) {
        this.logger.error(`❌ Eroare la generarea PDF: ${error.message}`);
        reject(error);
      }
    });
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('es-ES');
    } catch {
      return dateStr;
    }
  }
}
