import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SentEmailsService {
  private readonly logger = new Logger(SentEmailsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      const sentEmail = await this.prisma.sentEmail.create({
        data: {
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
          attachments: data.attachments
            ? {
                create: data.attachments.map((att) => ({
                  filename: att.filename,
                  file_content: att.fileContent,
                  mime_type: att.mimeType,
                  file_size: att.fileSize || att.fileContent.length,
                })),
              }
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
   * Obține un email specific după ID
   */
  async getSentEmailById(id: string) {
    try {
      const email = await this.prisma.sentEmail.findUnique({
        where: { id },
        include: {
          attachments: true,
        },
      });

      if (!email) {
        throw new Error(`Email cu ID ${id} nu a fost găsit`);
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
   * Obține un attachment după ID
   */
  async getAttachmentById(attachmentId: string) {
    try {
      const attachment = await this.prisma.emailAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        throw new Error(`Attachment cu ID ${attachmentId} nu a fost găsit`);
      }

      return attachment;
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la obținerea attachment-ului ${attachmentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Șterge un email din baza de date
   */
  async deleteSentEmail(id: string): Promise<void> {
    try {
      // Prisma va șterge automat și attachment-urile datorită onDelete: Cascade
      await this.prisma.sentEmail.delete({
        where: { id },
      });

      this.logger.log(`✅ Email șters din BD: ${id}`);
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la ștergerea email-ului ${id}: ${error.message}`,
      );
      throw error;
    }
  }
}
