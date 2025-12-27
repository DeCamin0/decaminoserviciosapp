import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { SentEmailsService } from './sent-emails.service';
import { EmailService } from './email.service';
import { EmpleadosService } from './empleados.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ScheduledMessagesCronService {
  private readonly logger = new Logger(ScheduledMessagesCronService.name);

  constructor(
    private readonly scheduledMessagesService: ScheduledMessagesService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly emailService: EmailService,
    private readonly empleadosService: EmpleadosService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Verifică și trimite mesajele automate la fiecare 15 minute
   * (pentru a fi mai flexibil cu ora de trimitere)
   */
  @Cron('0 */15 * * * *') // La fiecare 15 minute (00, 15, 30, 45)
  async handleScheduledMessages() {
    this.logger.log('⏰ Cron job declanșat automat pentru mesaje automate');
    await this.processScheduledMessages();
  }

  /**
   * Procesează mesajele automate (folosit și pentru testare manuală)
   * @param ignoreTimeCheck - Dacă este true, ignoră verificarea orei (pentru testare manuală)
   */
  async processScheduledMessages(ignoreTimeCheck: boolean = false) {
    this.logger.log(`🕐 Verificare mesaje automate...${ignoreTimeCheck ? ' (testare manuală - ignoră verificarea orei)' : ''}`);

    try {
      const messagesToSend = await this.scheduledMessagesService.getMessagesToSendToday(ignoreTimeCheck);

      if (messagesToSend.length === 0) {
        this.logger.log('ℹ️ Nu există mesaje automate de trimis astăzi');
        return;
      }

      this.logger.log(`📧 Găsite ${messagesToSend.length} mesaje automate de trimis`);

      for (const scheduledMessage of messagesToSend) {
        try {
          await this.sendScheduledMessage(scheduledMessage);
          await this.scheduledMessagesService.markAsSent(scheduledMessage.id);
          this.logger.log(`✅ Mesaj automat trimis: ${scheduledMessage.name} (${scheduledMessage.id})`);
        } catch (error: any) {
          this.logger.error(
            `❌ Eroare la trimiterea mesajului automat ${scheduledMessage.id}: ${error.message}`,
          );
          // Continuă cu următorul mesaj chiar dacă acesta eșuează
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ Eroare în cron job pentru mesaje automate: ${error.message}`);
    }
  }

  private async sendScheduledMessage(scheduledMessage: any) {
    if (!this.emailService.isConfigured()) {
      throw new Error('SMTP nu este configurat');
    }

    let recipients: Array<{ email: string; nombre: string; codigo?: string }> = [];

    // Obține destinatarii în funcție de tip
    const recipientType = (scheduledMessage as any).recipient_type || scheduledMessage.recipientType;
    const recipientId = (scheduledMessage as any).recipient_id || scheduledMessage.recipientId;
    const recipientEmail = (scheduledMessage as any).recipient_email || scheduledMessage.recipientEmail;
    
    if (recipientType === 'empleado' && recipientId) {
      const empleado = await this.empleadosService.getEmpleadoByCodigo(recipientId);
      if (empleado) {
        const email = empleado['CORREO ELECTRONICO'] || empleado.CORREO_ELECTRONICO;
        const nombre = empleado['NOMBRE / APELLIDOS'] || empleado.NOMBRE_APELLIDOS || empleado.CODIGO;
        if (email) {
          recipients = [{ email, nombre, codigo: String(empleado.CODIGO) }];
        }
      }
    } else if (recipientType === 'toti') {
      const empleados = await this.empleadosService.getAllEmpleados();
      const empleadosActivos = empleados.filter(
        (e) => (e.ESTADO || e.estado) === 'ACTIVO',
      );
      recipients = empleadosActivos
        .map((e) => ({
          email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
          nombre: e['NOMBRE / APELLIDOS'] || e.NOMBRE_APELLIDOS || e.CODIGO,
          codigo: String(e.CODIGO),
        }))
        .filter((r) => r.email && r.email.trim() !== '');
    } else if (recipientType === 'grupo' && recipientId) {
      const empleados = await this.empleadosService.getAllEmpleados();
      const empleadosGrupo = empleados.filter(
        (e) =>
          (e.GRUPO || e.grupo) === recipientId &&
          (e.ESTADO || e.estado) === 'ACTIVO',
      );
      recipients = empleadosGrupo
        .map((e) => ({
          email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
          nombre: e['NOMBRE / APELLIDOS'] || e.NOMBRE_APELLIDOS || e.CODIGO,
          codigo: String(e.CODIGO),
        }))
        .filter((r) => r.email && r.email.trim() !== '');
    } else if (recipientType === 'gestoria' && recipientEmail) {
      recipients = [
        {
          email: recipientEmail,
          nombre: 'Gestoria',
        },
      ];
    }

    if (recipients.length === 0) {
      throw new Error('Nu s-au găsit destinatari pentru mesajul automat');
    }

    // Construiește HTML-ul mesajului
    const message = ((scheduledMessage as any).message || scheduledMessage.message || '').trim();
    const additionalMessage = ((scheduledMessage as any).additional_message || scheduledMessage.additionalMessage || '').trim();
    const subject = ((scheduledMessage as any).subject || scheduledMessage.subject || '').trim();
    const createdBy = (scheduledMessage as any).created_by || scheduledMessage.createdBy;
    
    // Elimină liniile goale de la început și sfârșit
    let htmlMessage = message.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
    if (htmlMessage) {
      htmlMessage = htmlMessage.trim();
    }
    
    if (additionalMessage) {
      const additionalMsgCleaned = additionalMessage.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
      htmlMessage += `<div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #007bff;">
        <strong>Mensaje adicional:</strong><br>
        <div style="white-space: pre-wrap;">${additionalMsgCleaned.replace(/\n/g, '<br>')}</div>
      </div>`;
    }

    // Trimite email-uri către toți destinatarii
    for (const recipient of recipients) {
      try {
        // Template email similar cu celelalte - fără spații în template
        const html = `<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">${recipient.nombre && recipient.nombre !== 'Gestoria' ? `<p>Hola <strong>${recipient.nombre}</strong>,</p>` : '<p>Hola,</p>'}${htmlMessage ? `<div style="white-space: pre-wrap;">${htmlMessage.replace(/\n/g, '<br>')}</div>` : ''}<p><strong>Atentamente:</strong><br><strong>RRHH</strong><br><strong>DE CAMINO SERVICIOS AUXILIARES SL</strong></p></body></html>`;

        await this.emailService.sendEmail(recipient.email, subject, html, {
          bcc: ['decamino.rrhh@gmail.com'],
        });

        // Salvează email-ul în BD
        await this.sentEmailsService.saveSentEmail({
          senderId: createdBy,
          recipientType: recipientType,
          recipientId: recipient.codigo || recipientId || undefined,
          recipientEmail: recipient.email,
          recipientName: recipient.nombre,
          subject: subject,
          message: html,
          additionalMessage: additionalMessage || undefined,
          status: 'sent',
          scheduledMessageId: scheduledMessage.id, // Legătură cu mesajul automat
        });

        // Trimite notificare în aplicație dacă destinatarul este un angajat
        if (recipient.codigo && recipientType !== 'gestoria') {
          try {
            await this.notificationsService.notifyUser(
              createdBy,
              recipient.codigo,
              {
                type: 'info',
                title: 'Nuevo correo recibido',
                message: `Has recibido un correo: ${subject}`,
                data: {
                  subject: subject,
                  sender: 'Sistema Automático',
                  scheduledMessageId: scheduledMessage.id,
                },
              },
            );
          } catch (notifError: any) {
            // Nu oprește procesul dacă notificarea eșuează
            this.logger.warn(
              `⚠️ Eroare la trimiterea notificării către ${recipient.codigo}: ${notifError.message}`,
            );
          }
        }
      } catch (error: any) {
        this.logger.error(
          `❌ Eroare la trimiterea email-ului către ${recipient.email}: ${error.message}`,
        );
        
        // Salvează și email-urile eșuate
        try {
          await this.sentEmailsService.saveSentEmail({
            senderId: createdBy,
            recipientType: recipientType,
            recipientId: recipient.codigo || recipientId || undefined,
            recipientEmail: recipient.email,
            recipientName: recipient.nombre,
            subject: subject,
            message: htmlMessage,
            additionalMessage: additionalMessage || undefined,
            status: 'failed',
            errorMessage: error.message || String(error),
            scheduledMessageId: scheduledMessage.id, // Legătură cu mesajul automat
          });
        } catch (saveError: any) {
          this.logger.warn(`⚠️ Eroare la salvarea email-ului eșuat: ${saveError.message}`);
        }
      }
    }
  }
}

