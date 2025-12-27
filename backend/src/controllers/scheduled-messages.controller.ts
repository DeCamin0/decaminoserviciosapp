import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ScheduledMessagesService } from '../services/scheduled-messages.service';
import { ScheduledMessagesCronService } from '../services/scheduled-messages-cron.service';
import { SentEmailsService } from '../services/sent-emails.service';
import { EmpleadosService } from '../services/empleados.service';

@Controller('api/scheduled-messages')
@UseGuards(JwtAuthGuard)
export class ScheduledMessagesController {
  private readonly logger = new Logger(ScheduledMessagesController.name);

  constructor(
    private readonly scheduledMessagesService: ScheduledMessagesService,
    private readonly scheduledMessagesCronService: ScheduledMessagesCronService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  @Post()
  async createScheduledMessage(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    try {
      const {
        name,
        recipientType,
        recipientId,
        recipientEmail,
        subject,
        message,
        additionalMessage,
        startDate,
        endDate,
        sendTime,
      } = body;

      if (!name || !recipientType || !subject || !message || !startDate || !endDate || !sendTime) {
        throw new BadRequestException(
          'name, recipientType, subject, message, startDate, endDate și sendTime sunt obligatorii',
        );
      }

      const createdBy = String(user?.CODIGO || user?.codigo || user?.userId || 'system');

      const scheduledMessage = await this.scheduledMessagesService.createScheduledMessage({
        name,
        recipientType,
        recipientId: recipientId || undefined,
        recipientEmail: recipientEmail || undefined,
        subject,
        message,
        additionalMessage: additionalMessage || undefined,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        sendTime,
        createdBy,
      });

      return {
        success: true,
        message: 'Mesaj automat creat cu succes',
        data: scheduledMessage,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating scheduled message:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear mensaje automático: ${error.message}`,
      );
    }
  }

  @Get()
  async getScheduledMessages(@CurrentUser() user: any, @Body() body?: any) {
    try {
      const filters: any = {};
      
      if (body?.isActive !== undefined) {
        filters.isActive = body.isActive === true || body.isActive === 'true';
      }
      
      // Opțional: filtrează doar mesajele create de utilizatorul curent (dacă nu este admin)
      const grupo = user?.GRUPO || user?.grupo || '';
      if (!['Developer', 'Admin'].includes(grupo)) {
        filters.createdBy = String(user?.CODIGO || user?.codigo || user?.userId);
      }

      const messages = await this.scheduledMessagesService.getScheduledMessages(filters);

      return {
        success: true,
        data: messages,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting scheduled messages:', error);
      throw new BadRequestException(
        `Error al obtener mensajes automáticos: ${error.message}`,
      );
    }
  }

  // IMPORTANT: Rutele mai specifice trebuie să fie înainte de rutele generice
  // Altfel, :id va captura și "/recipients" ca parte din ID
  @Get(':id/recipients')
  async getScheduledMessageRecipients(@Param('id') id: string) {
    try {
      const message = await this.scheduledMessagesService.getScheduledMessageById(id);
      
      if (!message) {
        throw new BadRequestException('Mesaj automat nu a fost găsit');
      }

      // Obține toate email-urile trimise pentru acest mesaj automat
      const sentEmails = await this.sentEmailsService.getSentEmails({
        scheduledMessageId: id,
      });

      const relevantEmails = sentEmails.emails || [];

      // Obține lista de destinatari potențiali
      const recipientType = message.recipient_type || (message as any).recipientType;
      const recipientId = message.recipient_id || (message as any).recipientId;
      const recipientEmail = message.recipient_email || (message as any).recipientEmail;

      let potentialRecipients: Array<{ email: string; nombre: string; codigo?: string }> = [];

      if (recipientType === 'empleado' && recipientId) {
        const empleado = await this.empleadosService.getEmpleadoByCodigo(recipientId);
        if (empleado) {
          const email = empleado['CORREO ELECTRONICO'] || empleado.CORREO_ELECTRONICO;
          const nombre = empleado['NOMBRE / APELLIDOS'] || empleado.NOMBRE_APELLIDOS || empleado.CODIGO;
          if (email) {
            potentialRecipients = [{ email, nombre, codigo: String(empleado.CODIGO) }];
          }
        }
      } else if (recipientType === 'toti') {
        const empleados = await this.empleadosService.getAllEmpleados();
        const empleadosActivos = empleados.filter(
          (e) => (e.ESTADO || e.estado) === 'ACTIVO',
        );
        potentialRecipients = empleadosActivos
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
        potentialRecipients = empleadosGrupo
          .map((e) => ({
            email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
            nombre: e['NOMBRE / APELLIDOS'] || e.NOMBRE_APELLIDOS || e.CODIGO,
            codigo: String(e.CODIGO),
          }))
          .filter((r) => r.email && r.email.trim() !== '');
      } else if (recipientType === 'gestoria' && recipientEmail) {
        potentialRecipients = [
          {
            email: recipientEmail,
            nombre: 'Gestoria',
          },
        ];
      }

      // Helper function pentru normalizare email (lowercase, trim)
      const normalizeEmail = (email: string) => (email || '').toLowerCase().trim();

      // Log pentru debugging
      this.logger.log(`📊 Recipients check: potentialRecipients=${potentialRecipients.length}, relevantEmails=${relevantEmails.length}`);
      this.logger.log(`📊 Email statuses: ${relevantEmails.map((se: any) => `${se.recipient_email}:${se.status}`).join(', ')}`);

      // Compară destinatarii potențiali cu cei care au primit email
      const recipientsWithStatus = potentialRecipients.map((potential) => {
        const normalizedPotentialEmail = normalizeEmail(potential.email);
        const sentEmail = relevantEmails.find(
          (se: any) => normalizeEmail(se.recipient_email) === normalizedPotentialEmail,
        );
        return {
          email: potential.email,
          nombre: potential.nombre,
          codigo: potential.codigo,
          status: sentEmail ? sentEmail.status : 'not_sent',
          sentAt: sentEmail?.sent_at || sentEmail?.created_at || null,
          errorMessage: sentEmail?.error_message || null,
        };
      });

      // Calculează statisticile corect
      const sentCount = recipientsWithStatus.filter((r) => r.status === 'sent').length;
      const failedCount = recipientsWithStatus.filter((r) => r.status === 'failed').length;
      const notSentCount = recipientsWithStatus.filter((r) => r.status === 'not_sent').length;

      this.logger.log(`📊 Statistics: total=${potentialRecipients.length}, sent=${sentCount}, failed=${failedCount}, notSent=${notSentCount}`);

      return {
        success: true,
        data: {
          scheduledMessage: message,
          recipients: recipientsWithStatus,
          totalRecipients: potentialRecipients.length,
          sentCount: sentCount,
          failedCount: failedCount,
          notSentCount: notSentCount,
        },
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting scheduled message recipients:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener destinatarios: ${error.message}`,
      );
    }
  }

  @Get(':id')
  async getScheduledMessageById(@Param('id') id: string) {
    try {
      const message = await this.scheduledMessagesService.getScheduledMessageById(id);
      
      if (!message) {
        throw new BadRequestException('Mesaj automat nu a fost găsit');
      }

      return {
        success: true,
        data: message,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting scheduled message:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener mensaje automático: ${error.message}`,
      );
    }
  }

  @Put(':id')
  async updateScheduledMessage(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    try {
      const updateData: any = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.recipientType !== undefined) updateData.recipientType = body.recipientType;
      if (body.recipientId !== undefined) updateData.recipientId = body.recipientId;
      if (body.recipientEmail !== undefined) updateData.recipientEmail = body.recipientEmail;
      if (body.subject !== undefined) updateData.subject = body.subject;
      if (body.message !== undefined) updateData.message = body.message;
      if (body.additionalMessage !== undefined) updateData.additionalMessage = body.additionalMessage;
      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive === true || body.isActive === 'true';
      }
      if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
      if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
      if (body.sendTime !== undefined) updateData.sendTime = body.sendTime;

      const updated = await this.scheduledMessagesService.updateScheduledMessage(id, updateData);

      return {
        success: true,
        message: 'Mesaj automat actualizat cu succes',
        data: updated,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating scheduled message:', error);
      throw new BadRequestException(
        `Error al actualizar mensaje automático: ${error.message}`,
      );
    }
  }

  @Delete(':id')
  async deleteScheduledMessage(@Param('id') id: string) {
    try {
      await this.scheduledMessagesService.deleteScheduledMessage(id);

      return {
        success: true,
        message: 'Mesaj automat șters cu succes',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting scheduled message:', error);
      throw new BadRequestException(
        `Error al eliminar mensaje automático: ${error.message}`,
      );
    }
  }

  @Post('test-trigger')
  async testTriggerCron(@CurrentUser() user: any) {
    try {
      // Verifică dacă utilizatorul este admin/developer
      const grupo = user?.GRUPO || user?.grupo || '';
      if (!['Developer', 'Admin'].includes(grupo)) {
        throw new BadRequestException('Nu ai permisiunea de a testa cron job-ul');
      }

      // Declanșează manual cron-ul (ignoră verificarea orei pentru testare)
      await this.scheduledMessagesCronService.processScheduledMessages(true);

      return {
        success: true,
        message: 'Cron job declanșat manual cu succes. Verifică logs-urile backend-ului și tab-ul Historial pentru email-uri trimise.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error triggering cron manually:', error);
      throw new BadRequestException(
        `Error al trigger cron manualmente: ${error.message}`,
      );
    }
  }
}

