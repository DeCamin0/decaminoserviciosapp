import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { SentEmailsService } from './sent-emails.service';
import { EmpleadosService } from './empleados.service';

@Injectable()
export class DocumentosSolicitadosService {
  private readonly logger = new Logger(DocumentosSolicitadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly sentEmailsService: SentEmailsService,
    @Inject(forwardRef(() => EmpleadosService))
    private readonly empleadosService: EmpleadosService,
  ) {}

  /**
   * Creează o cerere nouă de document
   */
  async crearSolicitud(data: {
    empleado_id: string;
    tipo_documento: string;
    solicitado_por: string;
    notas?: string;
    aplicar_a_nuevos?: boolean;
  }): Promise<{ success: true; id: number }> {
    try {
      if (!data.empleado_id || !data.tipo_documento || !data.solicitado_por) {
        throw new BadRequestException(
          'Se requieren empleado_id, tipo_documento y solicitado_por',
        );
      }

      // Verifică dacă există deja o cerere activă pentru același tip de document
      const solicitudExistente = await this.prisma.$queryRawUnsafe<
        Array<{ id: bigint | number }>
      >(
        `
        SELECT id FROM \`documentos_solicitados\`
        WHERE \`empleado_id\` = ${this.escapeSql(data.empleado_id)}
          AND \`tipo_documento\` = ${this.escapeSql(data.tipo_documento)}
          AND \`estado\` = 'pendiente'
        LIMIT 1
        `,
      );

      if (solicitudExistente && solicitudExistente.length > 0) {
        this.logger.warn(
          `⚠️ Ya existe una solicitud pendiente para empleado ${data.empleado_id} y tipo ${data.tipo_documento}`,
        );
        // Return existing ID instead of creating duplicate (convert BigInt to Number)
        const existingId = solicitudExistente[0].id;
        const normalizedId =
          typeof existingId === 'bigint'
            ? Number(existingId)
            : Number(existingId);
        return {
          success: true,
          id: normalizedId,
        };
      }

      const aplicarANuevos = data.aplicar_a_nuevos === true ? 1 : 0;

      const query = `
        INSERT INTO \`documentos_solicitados\` (
          \`empleado_id\`,
          \`tipo_documento\`,
          \`estado\`,
          \`solicitado_por\`,
          \`notas\`,
          \`aplicar_a_nuevos\`,
          \`fecha_solicitud\`
        ) VALUES (
          ${this.escapeSql(data.empleado_id)},
          ${this.escapeSql(data.tipo_documento)},
          'pendiente',
          ${this.escapeSql(data.solicitado_por)},
          ${data.notas ? this.escapeSql(data.notas) : 'NULL'},
          ${aplicarANuevos},
          CURRENT_TIMESTAMP
        )
      `;

      await this.prisma.$executeRawUnsafe(query);
      const insertId = await this.prisma.$queryRawUnsafe<
        Array<{ id: bigint | number }>
      >(`SELECT LAST_INSERT_ID() as id`);

      const rawId = insertId[0]?.id;
      if (!rawId) {
        throw new BadRequestException(
          'Error al obtener el ID de la solicitud creada',
        );
      }

      // Convert BigInt to Number for JSON serialization
      const newId = typeof rawId === 'bigint' ? Number(rawId) : Number(rawId);

      this.logger.log(
        `✅ Solicitud creada: ID ${newId}, empleado ${data.empleado_id}, tipo ${data.tipo_documento}`,
      );

      // Trimite notificări și email-uri (non-blocking)
      setImmediate(() => {
        this.sendNotificationsAndEmail(
          data.empleado_id,
          data.tipo_documento,
          data.notas,
          data.solicitado_por,
          newId,
        ).catch((error: any) => {
          this.logger.warn(
            `⚠️ Error sending notifications/email for solicitud ${newId} (non-blocking): ${error.message}`,
          );
        });
      });

      return { success: true, id: newId };
    } catch (error: any) {
      this.logger.error('❌ Error creando solicitud:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear solicitud: ${error.message}`,
      );
    }
  }

  /**
   * Obține cererile pentru un angajat sau toate (pentru admin)
   */
  async getSolicitudes(empleadoId?: string): Promise<{
    success: true;
    data: Array<{
      id: number;
      empleado_id: string;
      tipo_documento: string;
      estado: string;
      fecha_solicitud: Date;
      fecha_completado: Date | null;
      solicitado_por: string;
      notas: string | null;
    }>;
  }> {
    try {
      let query = `
        SELECT 
          id,
          empleado_id,
          tipo_documento,
          estado,
          fecha_solicitud,
          fecha_completado,
          solicitado_por,
          notas
        FROM \`documentos_solicitados\`
      `;

      if (empleadoId) {
        query += ` WHERE \`empleado_id\` = ${this.escapeSql(empleadoId)}`;
      }

      query += ` ORDER BY fecha_solicitud DESC`;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          id: bigint | number;
          empleado_id: string;
          tipo_documento: string;
          estado: string;
          fecha_solicitud: Date;
          fecha_completado: Date | null;
          solicitado_por: string;
          notas: string | null;
        }>
      >(query);

      // Convert BigInt IDs to Number for JSON serialization
      const normalizedData = (result || []).map((item) => ({
        ...item,
        id: typeof item.id === 'bigint' ? Number(item.id) : Number(item.id),
      }));

      return { success: true, data: normalizedData };
    } catch (error: any) {
      this.logger.error('❌ Error obteniendo solicitudes:', error);
      throw new BadRequestException(
        `Error al obtener solicitudes: ${error.message}`,
      );
    }
  }

  /**
   * Marchează o cerere ca completată
   */
  async marcarCompletado(
    empleadoId: string,
    tipoDocumento: string,
  ): Promise<{ success: true; updated: number }> {
    try {
      const query = `
        UPDATE \`documentos_solicitados\`
        SET 
          \`estado\` = 'completado',
          \`fecha_completado\` = CURRENT_TIMESTAMP
        WHERE \`empleado_id\` = ${this.escapeSql(empleadoId)}
          AND \`tipo_documento\` = ${this.escapeSql(tipoDocumento)}
          AND \`estado\` = 'pendiente'
      `;

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = (result as any).affectedRows || 0;

      if (affectedRows > 0) {
        this.logger.log(
          `✅ Solicitud marcada como completada: empleado ${empleadoId}, tipo ${tipoDocumento}`,
        );
      }

      return { success: true, updated: affectedRows };
    } catch (error: any) {
      this.logger.error('❌ Error marcando solicitud como completada:', error);
      throw new BadRequestException(
        `Error al marcar solicitud como completada: ${error.message}`,
      );
    }
  }

  /**
   * Marchează ca completată orice solicitare pendiente pentru un angajat,
   * folosind matching flexibil pe tipo_documento
   */
  async marcarCompletadoFlexible(
    empleadoId: string,
    tipoDocumento: string,
  ): Promise<{ success: true; updated: number }> {
    try {
      // Normalizăm tipul documentului pentru matching
      const tipoDocNormalized = tipoDocumento.toLowerCase().trim();
      
      // Căutăm solicitări pendiente pentru acest angajat
      const solicitudesQuery = `
        SELECT id, tipo_documento
        FROM \`documentos_solicitados\`
        WHERE \`empleado_id\` = ${this.escapeSql(empleadoId)}
          AND \`estado\` = 'pendiente'
      `;
      
      const solicitudes = await this.prisma.$queryRawUnsafe<
        Array<{ id: bigint | number; tipo_documento: string }>
      >(solicitudesQuery);

      let updated = 0;

      // Verificăm fiecare solicitare pentru matching flexibil
      for (const solicitud of solicitudes) {
        const tipoSolicitudNormalized = solicitud.tipo_documento.toLowerCase().trim();
        
        // Matching exact sau dacă unul conține pe celălalt
        const matches = 
          tipoDocNormalized === tipoSolicitudNormalized ||
          tipoDocNormalized.includes(tipoSolicitudNormalized) ||
          tipoSolicitudNormalized.includes(tipoDocNormalized);

        if (matches) {
          // Marchem ca completată folosind tipul exact din solicitare
          const updateQuery = `
            UPDATE \`documentos_solicitados\`
            SET 
              \`estado\` = 'completado',
              \`fecha_completado\` = CURRENT_TIMESTAMP
            WHERE \`id\` = ${Number(solicitud.id)}
              AND \`estado\` = 'pendiente'
          `;

          const result = await this.prisma.$executeRawUnsafe(updateQuery);
          const affectedRows = (result as any).affectedRows || 0;
          updated += affectedRows;

          if (affectedRows > 0) {
            this.logger.log(
              `✅ Solicitud marcada como completada (matching flexibil): empleado ${empleadoId}, tipo ${tipoDocumento} -> ${solicitud.tipo_documento}`,
            );
          }
        }
      }

      return { success: true, updated };
    } catch (error: any) {
      this.logger.error('❌ Error marcando solicitud como completada (flexible):', error);
      throw new BadRequestException(
        `Error al marcar solicitud como completada: ${error.message}`,
      );
    }
  }

  /**
   * Aplică automat cererile cu aplicar_a_nuevos = true la un angajat nou activ
   */
  async aplicarReglasANuevoEmpleado(
    empleadoId: string,
  ): Promise<{ success: true; aplicadas: number }> {
    try {
      // Obținem toate cererile active cu aplicar_a_nuevos = true
      const reglas = await this.prisma.$queryRawUnsafe<
        Array<{
          tipo_documento: string;
          solicitado_por: string;
          notas: string | null;
        }>
      >(
        `
        SELECT DISTINCT
          \`tipo_documento\`,
          \`solicitado_por\`,
          \`notas\`
        FROM \`documentos_solicitados\`
        WHERE \`aplicar_a_nuevos\` = 1
          AND \`estado\` = 'pendiente'
        `,
      );

      if (!reglas || reglas.length === 0) {
        this.logger.log(
          `ℹ️ No hay reglas activas con aplicar_a_nuevos para empleado ${empleadoId}`,
        );
        return { success: true, aplicadas: 0 };
      }

      let aplicadas = 0;

      for (const regla of reglas) {
        // Verificăm dacă nu există deja o cerere activă pentru acest tip de document
        const existe = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
          `
          SELECT id FROM \`documentos_solicitados\`
          WHERE \`empleado_id\` = ${this.escapeSql(empleadoId)}
            AND \`tipo_documento\` = ${this.escapeSql(regla.tipo_documento)}
            AND \`estado\` = 'pendiente'
          LIMIT 1
          `,
        );

        if (existe && existe.length > 0) {
          this.logger.log(
            `⚠️ Ya existe solicitud pendiente para ${empleadoId} (${regla.tipo_documento}). Saltando.`,
          );
          continue;
        }

        // Creăm cererea pentru noul angajat
        const query = `
          INSERT INTO \`documentos_solicitados\` (
            \`empleado_id\`,
            \`tipo_documento\`,
            \`estado\`,
            \`solicitado_por\`,
            \`notas\`,
            \`aplicar_a_nuevos\`,
            \`fecha_solicitud\`
          ) VALUES (
            ${this.escapeSql(empleadoId)},
            ${this.escapeSql(regla.tipo_documento)},
            'pendiente',
            ${this.escapeSql(regla.solicitado_por)},
            ${regla.notas ? this.escapeSql(regla.notas) : 'NULL'},
            0,
            CURRENT_TIMESTAMP
          )
        `;

        await this.prisma.$executeRawUnsafe(query);
        aplicadas++;
        this.logger.log(
          `✅ Solicitud aplicada automáticamente a nuevo empleado ${empleadoId}: ${regla.tipo_documento}`,
        );
      }

      return { success: true, aplicadas };
    } catch (error: any) {
      this.logger.error(
        `❌ Error aplicando reglas a nuevo empleado ${empleadoId}:`,
        error,
      );
      // Nu aruncăm eroare pentru a nu bloca crearea angajatului
      return { success: true, aplicadas: 0 };
    }
  }

  /**
   * Trimite notificări și email-uri pentru o cerere de document nou creată
   */
  private async sendNotificationsAndEmail(
    empleadoId: string,
    tipoDocumento: string,
    notas: string | undefined,
    solicitadoPor: string,
    solicitudId: number,
  ): Promise<void> {
    try {
      // Obține datele angajatului
      let empleadoEmail: string | null = null;
      let empleadoNombre: string = empleadoId;

      try {
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(empleadoId);
        empleadoEmail =
          empleado?.['CORREO ELECTRONICO'] ||
          empleado?.CORREO_ELECTRONICO ||
          null;
        empleadoNombre =
          empleado?.['NOMBRE / APELLIDOS'] ||
          empleado?.NOMBRE_APELLIDOS ||
          empleadoNombre;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Could not fetch empleado data for ${empleadoId}: ${error.message}`,
        );
      }

      // Trimite notificare în aplicație
      try {
        await this.notificationsService.notifyUser(
          solicitadoPor || 'system',
          empleadoId,
          {
            type: 'info',
            title: 'Nueva solicitud de documento',
            message: `Se ha solicitado el documento: ${tipoDocumento}${notas ? ` - ${notas}` : ''}`,
            data: {
              solicitudId,
              tipo_documento: tipoDocumento,
              notas: notas || null,
            },
          },
        );
        this.logger.log(
          `✅ In-app notification sent to empleado ${empleadoId} for solicitud ${solicitudId}`,
        );
      } catch (notifError: any) {
        this.logger.warn(
          `⚠️ Error sending in-app notification to ${empleadoId}: ${notifError.message}`,
        );
      }

      // Trimite email (dacă există email)
      if (empleadoEmail && empleadoEmail.trim() !== '') {
        if (!this.emailService.isConfigured()) {
          this.logger.warn(
            `⚠️ Email service not configured. Email notification not sent to ${empleadoEmail}`,
          );
          return;
        }

        try {
          const { subject, html } = this.formatDocumentoSolicitadoEmailHtml({
            empleadoNombre,
            tipoDocumento,
            notas,
          });

          await this.emailService.sendEmail(empleadoEmail, subject, html);
          this.logger.log(
            `✅ Email notification sent to ${empleadoEmail} for solicitud ${solicitudId}`,
          );

          // Salvează email-ul în BD
          try {
            await this.sentEmailsService.saveSentEmail({
              senderId: solicitadoPor || 'system',
              recipientType: 'empleado',
              recipientId: empleadoId,
              recipientEmail: empleadoEmail,
              recipientName: empleadoNombre,
              subject,
              message: html,
              status: 'sent',
            });
          } catch (saveError: any) {
            this.logger.warn(
              `⚠️ Error saving email to DB: ${saveError.message}`,
            );
          }
        } catch (emailError: any) {
          this.logger.warn(
            `⚠️ Error sending email to ${empleadoEmail}: ${emailError.message}`,
          );
        }
      } else {
        this.logger.warn(
          `⚠️ No email found for empleado ${empleadoId}, skipping email notification`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error in sendNotificationsAndEmail: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Formatează HTML-ul pentru email-ul de cerere de document
   */
  private formatDocumentoSolicitadoEmailHtml(data: {
    empleadoNombre: string;
    tipoDocumento: string;
    notas?: string;
  }): { subject: string; html: string } {
    const subject = `Solicitud de documento: ${data.tipoDocumento}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }
    .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4F46E5; border-radius: 4px; }
    .notas { background-color: #fef3c7; padding: 10px; margin: 10px 0; border-left: 4px solid #f59e0b; border-radius: 4px; }
    .info-notice { background-color: #dbeafe; padding: 12px; margin: 15px 0; border-left: 4px solid #3b82f6; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DE CAMINO SERVICIOS AUXILIARES</h1>
      <h2>Solicitud de Documento</h2>
    </div>
    <div class="content">
      <p>Estimado/a <strong>${data.empleadoNombre}</strong>,</p>
      <p>Se ha creado una nueva solicitud de documento para usted:</p>
      
      <div class="info-box">
        <p><strong>Tipo de documento:</strong> ${data.tipoDocumento}</p>
        ${data.notas ? `<div class="notas"><strong>Notas:</strong> ${data.notas}</div>` : ''}
      </div>
      
      <div class="info-notice">
        <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 500;">
          <strong>ℹ️ Información importante:</strong> Los documentos se solicitan exclusivamente para la verificación de identidad y cuenta bancaria, con fines contractuales y fiscales.
        </p>
      </div>
      
      <p>Por favor, acceda a la aplicación para ver más detalles y subir el documento solicitado.</p>
      
      <p>Gracias por su atención.</p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático. Por favor, no responda a este correo.</p>
      <p>DE CAMINO SERVICIOS AUXILIARES SL</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { subject, html };
  }

  /**
   * Helper pentru escape SQL
   */
  private escapeSql(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    // Escape single quotes and wrap in quotes
    const escaped = String(value).replace(/'/g, "''");
    return `'${escaped}'`;
  }
}
