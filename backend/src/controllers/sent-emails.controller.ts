import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  Res,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SentEmailsService } from '../services/sent-emails.service';
import { EmailService } from '../services/email.service';
import { EmpleadosService } from '../services/empleados.service';
import { NotificationsService } from '../services/notifications.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { Response } from 'express';

@Controller('api/sent-emails')
export class SentEmailsController {
  private readonly logger = new Logger(SentEmailsController.name);

  constructor(
    private readonly sentEmailsService: SentEmailsService,
    private readonly emailService: EmailService,
    private readonly empleadosService: EmpleadosService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Obține toate email-urile trimise cu filtre opționale
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getSentEmails(
    @Query() query: {
      senderId?: string;
      recipientType?: string;
      recipientId?: string;
      recipientEmail?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    },
  ) {
    try {
      const filters: any = {};

      if (query.senderId) filters.senderId = query.senderId;
      if (query.recipientType) filters.recipientType = query.recipientType;
      if (query.recipientId) filters.recipientId = query.recipientId;
      if (query.recipientEmail) filters.recipientEmail = query.recipientEmail;
      if (query.status) filters.status = query.status;
      if (query.startDate) filters.startDate = new Date(query.startDate);
      if (query.endDate) filters.endDate = new Date(query.endDate);
      if (query.limit) filters.limit = parseInt(query.limit, 10);
      if (query.offset) filters.offset = parseInt(query.offset, 10);

      const result = await this.sentEmailsService.getSentEmails(filters);

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting sent emails:', error);
      throw new BadRequestException(`Error: ${error.message}`);
    }
  }

  /**
   * Obține un email specific după ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSentEmailById(@Param('id') id: string) {
    try {
      const email = await this.sentEmailsService.getSentEmailById(id);

      return {
        success: true,
        email,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting email ${id}:`, error);
      throw new BadRequestException(`Error: ${error.message}`);
    }
  }

  /**
   * Descarcă un attachment
   */
  @Get('attachments/:attachmentId')
  @UseGuards(JwtAuthGuard)
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    try {
      const attachment = await this.sentEmailsService.getAttachmentById(
        attachmentId,
      );

      res.setHeader('Content-Type', attachment.mime_type);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${attachment.filename}"`,
      );
      res.setHeader('Content-Length', attachment.file_content.length);

      res.send(attachment.file_content);
    } catch (error: any) {
      this.logger.error(
        `❌ Error downloading attachment ${attachmentId}:`,
        error,
      );
      throw new BadRequestException(`Error: ${error.message}`);
    }
  }

  /**
   * Trimite email către angajați/grup/gestorie
   */
  @Post('send')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('attachments', 10)) // Max 10 fișiere
  async sendEmail(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    try {
      const {
        recipientType,
        recipientId,
        recipientEmail,
        subject,
        message,
        additionalMessage,
      } = body;

      if (!recipientType || !subject || !message) {
        throw new BadRequestException(
          'recipientType, subject și message sunt obligatorii',
        );
      }

      if (!this.emailService.isConfigured()) {
        throw new BadRequestException('SMTP nu este configurat');
      }

      const senderId = String(user?.CODIGO || user?.codigo || user?.userId);
      let recipients: Array<{
        email: string;
        nombre: string;
        codigo?: string;
      }> = [];

      // Obține destinatarii în funcție de tip
      if (recipientType === 'empleado' && recipientId) {
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(recipientId);
        const email =
          empleado['CORREO ELECTRONICO'] || empleado.CORREO_ELECTRONICO;
        const nombre =
          empleado['NOMBRE / APELLIDOS'] ||
          empleado.NOMBRE_APELLIDOS ||
          empleado.CODIGO;

        if (!email) {
          throw new BadRequestException(
            `Angajatul ${recipientId} nu are email configurat`,
          );
        }

        recipients = [{ email, nombre, codigo: String(empleado.CODIGO) }];
      } else if (recipientType === 'toti') {
        const empleados = await this.empleadosService.getAllEmpleados();
        const empleadosActivos = empleados.filter(
          (e) => (e.ESTADO || e.estado) === 'ACTIVO',
        );

        recipients = empleadosActivos
          .map((e) => ({
            email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
            nombre:
              e['NOMBRE / APELLIDOS'] || e.NOMBRE_APELLIDOS || e.CODIGO,
            codigo: String(e.CODIGO),
          }))
          .filter((r) => r.email && r.email.trim() !== '');
      } else if (recipientType === 'grupo' && body.grupo) {
        const empleados = await this.empleadosService.getAllEmpleados();
        const empleadosGrupo = empleados.filter(
          (e) =>
            (e.GRUPO || e.grupo) === body.grupo &&
            (e.ESTADO || e.estado) === 'ACTIVO',
        );

        recipients = empleadosGrupo
          .map((e) => ({
            email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
            nombre:
              e['NOMBRE / APELLIDOS'] || e.NOMBRE_APELLIDOS || e.CODIGO,
            codigo: String(e.CODIGO),
          }))
          .filter((r) => r.email && r.email.trim() !== '');
      } else if (recipientType === 'gestoria') {
        recipients = [
          {
            email: recipientEmail || 'altemprado@gmail.com',
            nombre: 'Gestoria',
          },
        ];
      } else {
        throw new BadRequestException('Tip de destinatar invalid');
      }

      if (recipients.length === 0) {
        throw new BadRequestException('Nu s-au găsit destinatari');
      }

      // Pregătește attachments
      this.logger.log(`📎 Files received: ${files?.length || 0}`);
      if (files && files.length > 0) {
        files.forEach((file, idx) => {
          this.logger.log(`📎 File ${idx + 1}: ${file.originalname}, size: ${file.size || file.buffer?.length || 0}, mimetype: ${file.mimetype}`);
          if (!file.buffer || file.buffer.length === 0) {
            this.logger.warn(`⚠️ File ${idx + 1} has no buffer!`);
          }
        });
      } else {
        this.logger.warn('⚠️ No files received in request');
      }
      
      const attachments = files && files.length > 0
        ? files
            .filter((file) => file.buffer && file.buffer.length > 0) // Filtrează fișierele fără buffer
            .map((file) => ({
              filename: file.originalname || 'attachment',
              content: file.buffer,
              contentType: file.mimetype || 'application/octet-stream',
            }))
        : [];
      
      this.logger.log(`📎 Attachments prepared: ${attachments.length} (from ${files?.length || 0} files)`);

      // Template HTML pentru email - fără indentare pentru a evita spații
      const htmlTemplate = (nombre: string, mesaj: string) => {
        // Curăță mesajul de spații și linii goale
        const mesajCleaned = (mesaj || '').trim().split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
        const additionalMsgCleaned = additionalMessage ? (additionalMessage || '').trim().split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n') : '';
        
        return `<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><p>Hola <strong>${nombre}</strong>,</p>${mesajCleaned ? `<div style="white-space: pre-wrap;">${mesajCleaned.replace(/\n/g, '<br>')}</div>` : ''}${additionalMsgCleaned ? `<div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #007bff;"><strong>Mensaje adicional:</strong><br><div style="white-space: pre-wrap;">${additionalMsgCleaned.replace(/\n/g, '<br>')}</div></div>` : ''}<p><strong>Atentamente:</strong><br><strong>RRHH</strong><br><strong>DE CAMINO SERVICIOS AUXILIARES SL</strong></p></body></html>`;
      };

      let successCount = 0;
      let failedCount = 0;
      const emailIds: string[] = [];
      const totalRecipients = recipients.length;
      const currentUserId = String(user?.CODIGO || user?.codigo || user?.userId || 'system');

      // Trimite progres inițial
      if (totalRecipients > 1) {
        this.notificationsGateway.sendToUser(currentUserId, {
          type: 'email_progress',
          total: totalRecipients,
          current: 0,
          success: 0,
          failed: 0,
          status: 'starting',
        });
      }

      // Trimite email-uri către toți destinatarii
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        try {
          const html = htmlTemplate(recipient.nombre, message);

          // Trimite email
          if (attachments.length > 0) {
            await this.emailService.sendEmailWithAttachments(
              recipient.email,
              subject,
              html,
              attachments,
              {
                bcc: ['decamino.rrhh@gmail.com'],
              },
            );
          } else {
            await this.emailService.sendEmail(recipient.email, subject, html, {
              bcc: ['decamino.rrhh@gmail.com'],
            });
          }

          // Salvează în BD
          const savedEmail = await this.sentEmailsService.saveSentEmail({
            senderId,
            recipientType:
              recipientType === 'gestoria'
                ? 'gestoria'
                : recipientType === 'toti'
                  ? 'toti'
                  : recipientType === 'grupo'
                    ? 'grupo'
                    : 'empleado',
            recipientId: recipient.codigo || undefined,
            recipientEmail: recipient.email,
            recipientName: recipient.nombre,
            subject,
            message: html,
            additionalMessage: additionalMessage || undefined,
            status: 'sent',
            attachments:
              attachments.length > 0
                ? attachments.map((att, idx) => ({
                    filename: att.filename,
                    fileContent: att.content,
                    mimeType: att.contentType,
                    fileSize: att.content.length,
                  }))
                : undefined,
          });

          emailIds.push(savedEmail.id);
          successCount++;

          // Trimite progres prin WebSocket (doar pentru mai mulți destinatari)
          if (totalRecipients > 1) {
            const progressInterval = totalRecipients > 20 ? 5 : 1;
            if ((i + 1) % progressInterval === 0 || i === recipients.length - 1) {
              this.notificationsGateway.sendToUser(currentUserId, {
                type: 'email_progress',
                total: totalRecipients,
                current: i + 1,
                success: successCount,
                failed: failedCount,
                status: i === recipients.length - 1 ? 'completed' : 'sending',
              });
            }
          }

          // Trimite notificare în aplicație (doar pentru angajați, nu pentru gestorie)
          if (recipient.codigo && recipientType !== 'gestoria') {
            try {
              await this.notificationsService.notifyUser(
                senderId,
                recipient.codigo,
                {
                  type: 'info',
                  title: 'Nuevo correo recibido',
                  message: `Has recibido un correo: ${subject}`,
                  data: {
                    subject,
                    sender:
                      user?.['NOMBRE / APELLIDOS'] ||
                      user?.nombre ||
                      'RRHH',
                    emailId: savedEmail.id,
                  },
                },
              );
            } catch (notifError: any) {
              this.logger.warn(
                `⚠️ Eroare la trimiterea notificării către ${recipient.codigo}: ${notifError.message}`,
              );
            }
          }

          // Delay între email-uri
          if (recipients.length > 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, recipients.length > 50 ? 1000 : 500),
            );
          }
        } catch (error: any) {
          failedCount++;
          this.logger.error(
            `❌ Eroare la trimiterea email-ului către ${recipient.email}:`,
            error,
          );

          // Salvează și email-urile eșuate în BD
          try {
            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType:
                recipientType === 'gestoria'
                  ? 'gestoria'
                  : recipientType === 'toti'
                    ? 'toti'
                    : recipientType === 'grupo'
                      ? 'grupo'
                      : 'empleado',
              recipientId: recipient.codigo || undefined,
              recipientEmail: recipient.email,
              recipientName: recipient.nombre,
              subject,
              message: htmlTemplate(recipient.nombre, message),
              additionalMessage: additionalMessage || undefined,
              status: 'failed',
              errorMessage: error.message,
            });
          } catch (saveError: any) {
            this.logger.error(
              `❌ Eroare la salvarea email-ului eșuat: ${saveError.message}`,
            );
          }

          // Trimite progres prin WebSocket (doar pentru mai mulți destinatari)
          if (totalRecipients > 1) {
            const progressInterval = totalRecipients > 20 ? 5 : 1;
            if ((i + 1) % progressInterval === 0 || i === recipients.length - 1) {
              this.notificationsGateway.sendToUser(currentUserId, {
                type: 'email_progress',
                total: totalRecipients,
                current: i + 1,
                success: successCount,
                failed: failedCount,
                status: i === recipients.length - 1 ? 'completed' : 'sending',
              });
            }
          }
        }
      }

      return {
        success: true,
        message: `Email trimis către ${successCount} destinatari (din ${recipients.length}). Eșuate: ${failedCount}`,
        totalRecipients: recipients.length,
        successCount,
        failedCount,
        emailIds,
      };
    } catch (error: any) {
      this.logger.error('❌ Error sending email:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error: ${error.message}`);
    }
  }

  /**
   * Șterge un email din baza de date
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteSentEmail(@Param('id') id: string) {
    try {
      await this.sentEmailsService.deleteSentEmail(id);

      return {
        success: true,
        message: 'Email șters cu succes',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting email ${id}:`, error);
      throw new BadRequestException(`Error: ${error.message}`);
    }
  }
}

