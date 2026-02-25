import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../services/email.service';
import { EmpleadosService } from '../../services/empleados.service';

@Injectable()
export class DocumentDistributionService {
  private readonly logger = new Logger(DocumentDistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  /**
   * Distribute approved document to employee
   * This updates the document status to SENT and makes it available to the employee
   */
  async distributeDocument(docId: number): Promise<{ success: true }> {
    // Get document
    const documents = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT doc_id, id, status, action, nombre_archivo, tipo_documento, confirmed_empleado_id 
       FROM DocumentosOficiales 
       WHERE doc_id = ${docId} LIMIT 1`,
    );

    if (!documents || documents.length === 0) {
      throw new NotFoundException(`Document with doc_id ${docId} not found`);
    }

    const doc = documents[0];

    if (doc.status !== 'APPROVED') {
      throw new Error(
        `Document is not in APPROVED status (current: ${doc.status})`,
      );
    }

    const employeeId = doc.confirmed_empleado_id || doc.id;

    if (!employeeId || employeeId === 'PENDING') {
      throw new Error('No employee ID assigned to document');
    }

    // Update document status to SENT
    const updateQuery = `
      UPDATE \`DocumentosOficiales\`
      SET 
        \`status\` = 'SENT',
        \`distributed_at\` = NOW()
      WHERE doc_id = ${docId}
    `;

    await this.prisma.$executeRawUnsafe(updateQuery);

    this.logger.log(
      `✅ Document ${docId} distributed to employee ${employeeId}`,
    );

    // Optionally send email notification
    try {
      await this.sendEmailNotification(docId, employeeId);
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Failed to send email notification for document ${docId}: ${error.message}`,
      );
      // Don't fail the distribution if email fails
    }

    return { success: true };
  }

  /**
   * Send email notification to employee about new document
   */
  private async sendEmailNotification(
    docId: number,
    employeeId: string,
  ): Promise<void> {
    if (!this.emailService.isConfigured()) {
      this.logger.log('Email service not configured, skipping notification');
      return;
    }

    try {
      // Get employee email
      const empleado =
        await this.empleadosService.getEmpleadoByCodigo(employeeId);

      if (!empleado || !empleado['CORREO ELECTRONICO']) {
        this.logger.warn(
          `No email found for employee ${employeeId}, skipping notification`,
        );
        return;
      }

      // Get document details
      const documents = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT nombre_archivo, tipo_documento 
         FROM DocumentosOficiales 
         WHERE doc_id = ${docId} LIMIT 1`,
      );

      if (!documents || documents.length === 0) {
        return;
      }

      const doc = documents[0];
      const employeeEmail = empleado['CORREO ELECTRONICO'];
      const employeeName =
        empleado['NOMBRE / APELLIDOS'] || empleado.NOMBRE || 'Empleado';

      const subject = `Nuevo documento disponible: ${doc.tipo_documento || 'Documento'}`;
      const html = `
        <h2>Hola ${employeeName},</h2>
        <p>Se ha añadido un nuevo documento a tu carpeta:</p>
        <ul>
          <li><strong>Tipo:</strong> ${doc.tipo_documento || 'Documento'}</li>
          <li><strong>Archivo:</strong> ${doc.nombre_archivo}</li>
        </ul>
        <p>Puedes acceder a este documento desde tu portal de empleados.</p>
        <p>Saludos,<br>Equipo De Camino Servicios</p>
      `;

      await this.emailService.sendEmail(employeeEmail, subject, html, {
        bcc: this.emailService.getDefaultBcc(),
      });

      this.logger.log(
        `✅ Email notification sent to ${employeeEmail} for document ${docId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error sending email notification: ${error.message}`,
      );
      throw error;
    }
  }
}
