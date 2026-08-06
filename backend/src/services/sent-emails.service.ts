import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAttachmentsStorageService } from './email-attachments-storage.service';
import { randomUUID } from 'crypto';

@Injectable()
export class SentEmailsService {
  private readonly logger = new Logger(SentEmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailAttachmentsStorage: EmailAttachmentsStorageService,
  ) {}

  /**
   * Salvează un email trimis în baza de date
   */
  async saveSentEmail(data: {
    senderId: string;
    recipientType: 'empleado' | 'gestoria' | 'grupo' | 'toti';
    recipientId?: string;
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    message: string;
    additionalMessage?: string;
    status: 'sent' | 'failed';
    errorMessage?: string;
    scheduledMessageId?: string; // ID-ul mesajului automat (dacă este trimis de cron)
    attachments?: Array<{
      filename: string;
      fileContent: Buffer;
      mimeType: string;
      fileSize?: number;
    }>;
  }): Promise<{ id: string }> {
    try {
      const emailId = randomUUID();
      const attachmentCreates: Array<{
        filename: string;
        storage_key: string;
        storage_bucket: string;
        mime_type: string;
        file_size: number;
      }> = [];

      if (data.attachments?.length) {
        if (!this.emailAttachmentsStorage.isWriteEnabled()) {
          throw new ServiceUnavailableException(
            'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
          );
        }
        for (const att of data.attachments) {
          const put = await this.emailAttachmentsStorage.putAttachment(
            att.fileContent,
            emailId,
            att.filename,
            att.mimeType,
          );
          attachmentCreates.push({
            filename: att.filename,
            storage_key: put.storage_key,
            storage_bucket: put.storage_bucket,
            mime_type: att.mimeType,
            file_size: att.fileSize || att.fileContent.length,
          });
        }
      }

      const sentEmail = await this.prisma.sentEmail.create({
        data: {
          id: emailId,
          sender_id: data.senderId,
          recipient_type: data.recipientType,
          recipient_id: data.recipientId || null,
          recipient_email: data.recipientEmail,
          recipient_name: data.recipientName || null,
          subject: data.subject,
          message: data.message,
          additional_message: data.additionalMessage || null,
          status: data.status,
          error_message: data.errorMessage || null,
          scheduled_message_id: data.scheduledMessageId || null,
          sent_at: data.status === 'sent' ? new Date() : null,
          attachments: attachmentCreates.length
            ? { create: attachmentCreates }
            : undefined,
        },
      });

      this.logger.log(
        `✅ Email salvat în BD: ${sentEmail.id} (${data.recipientType} -> ${data.recipientEmail})`,
      );

      return { id: sentEmail.id };
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la salvarea email-ului în BD: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Emails (lowercase) that already received the same subject successfully.
   * Used to retry bulk sends without duplicates.
   */
  async getSuccessfullySentRecipientEmails(
    subject: string,
    recipientEmails?: string[],
  ): Promise<Set<string>> {
    const subjectTrim = (subject || '').trim();
    if (!subjectTrim) return new Set();

    const where: {
      subject: string;
      status: 'sent';
      recipient_email?: { in: string[] };
    } = {
      subject: subjectTrim,
      status: 'sent',
    };

    if (recipientEmails?.length) {
      where.recipient_email = {
        in: recipientEmails.map((e) => e.trim()).filter(Boolean),
      };
    }

    const rows = await this.prisma.sentEmail.findMany({
      where,
      select: { recipient_email: true },
    });

    const sent = new Set<string>();
    for (const row of rows) {
      const email = (row.recipient_email || '').trim().toLowerCase();
      if (email) sent.add(email);
    }
    return sent;
  }

  /**
   * Obține toate email-urile trimise cu filtre opționale
   */
  async getSentEmails(filters?: {
    senderId?: string;
    recipientType?: string;
    recipientId?: string;
    recipientEmail?: string;
    status?: string;
    scheduledMessageId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    try {
      const where: any = {};

      if (filters?.senderId) {
        where.sender_id = filters.senderId;
      }

      if (filters?.recipientType) {
        where.recipient_type = filters.recipientType;
      }

      if (filters?.recipientId) {
        where.recipient_id = filters.recipientId;
      }

      if (filters?.recipientEmail) {
        where.recipient_email = { contains: filters.recipientEmail };
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.scheduledMessageId) {
        where.scheduled_message_id = filters.scheduledMessageId;
      }

      if (filters?.startDate || filters?.endDate) {
        where.created_at = {};
        if (filters.startDate) {
          where.created_at.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.created_at.lte = filters.endDate;
        }
      }

      const [emails, total] = await Promise.all([
        this.prisma.sentEmail.findMany({
          where,
          include: {
            attachments: {
              select: {
                id: true,
                filename: true,
                mime_type: true,
                file_size: true,
                storage_key: true,
                created_at: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          take: filters?.limit || 50,
          skip: filters?.offset || 0,
        }),
        this.prisma.sentEmail.count({ where }),
      ]);

      return {
        emails,
        total,
        limit: filters?.limit || 50,
        offset: filters?.offset || 0,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la obținerea email-urilor: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Obține un email specific după ID (fără blob / fără a încărca conținutul din R2)
   */
  async getSentEmailById(id: string) {
    try {
      const email = await this.prisma.sentEmail.findUnique({
        where: { id },
        include: {
          attachments: {
            select: {
              id: true,
              filename: true,
              mime_type: true,
              file_size: true,
              storage_key: true,
              created_at: true,
            },
          },
        },
      });

      if (!email) {
        throw new Error(`No se encontró el email con ID ${id}`);
      }

      return email;
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la obținerea email-ului ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Obține un attachment după ID (metadata + buffer din R2 / dual-read)
   */
  async getAttachmentById(attachmentId: string) {
    try {
      const attachment = await this.prisma.emailAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        throw new Error(`No se encontró el adjunto con ID ${attachmentId}`);
      }

      const fileContent =
        await this.emailAttachmentsStorage.resolveFileContent(attachment);

      return {
        ...attachment,
        file_content: fileContent,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la obținerea attachment-ului ${attachmentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Șterge un email din baza de date (+ obiecte R2 pentru attachments)
   */
  async deleteSentEmail(id: string): Promise<void> {
    try {
      const attachments = await this.prisma.emailAttachment.findMany({
        where: { email_id: id },
        select: { storage_key: true },
      });

      await this.prisma.sentEmail.delete({
        where: { id },
      });

      for (const att of attachments) {
        await this.emailAttachmentsStorage.deleteObjectIfAny(att.storage_key);
      }

      this.logger.log(`✅ Email șters din BD: ${id}`);
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la ștergerea email-ului ${id}: ${error.message}`,
      );
      throw error;
    }
  }
}
