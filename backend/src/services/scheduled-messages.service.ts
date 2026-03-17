import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduledMessage } from '@prisma/client';

@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createScheduledMessage(data: {
    name: string;
    recipientType: string;
    recipientId?: string;
    recipientEmail?: string;
    subject: string;
    message: string;
    additionalMessage?: string;
    startDate: Date;
    endDate: Date;
    sendTime: string; // Format: "HH:mm"
    recurrence?: string; // 'daily' | 'weekly' | 'monthly'
    recurrenceDayOfWeek?: number; // 0=Dom..6=Sáb (weekly)
    recurrenceDayOfMonth?: number; // 1-31 (monthly)
    createdBy: string;
  }): Promise<ScheduledMessage> {
    const scheduledMessage = await this.prisma.scheduledMessage.create({
      data: {
        name: data.name,
        recipient_type: data.recipientType,
        recipient_id: data.recipientId || null,
        recipient_email: data.recipientEmail || null,
        subject: data.subject,
        message: data.message,
        additional_message: data.additionalMessage || null,
        is_active: true,
        start_date: data.startDate,
        end_date: data.endDate,
        send_time: data.sendTime,
        recurrence: data.recurrence || null,
        recurrence_day_of_week: data.recurrenceDayOfWeek ?? null,
        recurrence_day_of_month: data.recurrenceDayOfMonth ?? null,
        created_by: data.createdBy,
      },
    });

    this.logger.log(
      `✅ Mesaj automat creat: ${scheduledMessage.id} - ${scheduledMessage.name}`,
    );
    return scheduledMessage;
  }

  async getScheduledMessages(filters?: {
    isActive?: boolean;
    createdBy?: string;
  }): Promise<ScheduledMessage[]> {
    const where: any = {};

    if (filters?.isActive !== undefined) {
      where.is_active = filters.isActive;
    }
    if (filters?.createdBy) {
      where.created_by = filters.createdBy;
    }

    return this.prisma.scheduledMessage.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async getScheduledMessageById(id: string): Promise<ScheduledMessage | null> {
    return this.prisma.scheduledMessage.findUnique({
      where: { id },
    });
  }

  async updateScheduledMessage(
    id: string,
    data: Partial<{
      name: string;
      recipientType: string;
      recipientId: string;
      recipientEmail: string;
      subject: string;
      message: string;
      additionalMessage: string;
      isActive: boolean;
      startDate: Date;
      endDate: Date;
      sendTime: string;
      recurrence: string;
      recurrenceDayOfWeek: number;
      recurrenceDayOfMonth: number;
    }>,
  ): Promise<ScheduledMessage> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.recipientType !== undefined)
      updateData.recipient_type = data.recipientType;
    if (data.recipientId !== undefined)
      updateData.recipient_id = data.recipientId;
    if (data.recipientEmail !== undefined)
      updateData.recipient_email = data.recipientEmail;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.message !== undefined) updateData.message = data.message;
    if (data.additionalMessage !== undefined)
      updateData.additional_message = data.additionalMessage;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.sendTime !== undefined) updateData.send_time = data.sendTime;
    if (data.recurrence !== undefined) updateData.recurrence = data.recurrence;
    if (data.recurrenceDayOfWeek !== undefined)
      updateData.recurrence_day_of_week = data.recurrenceDayOfWeek;
    if (data.recurrenceDayOfMonth !== undefined)
      updateData.recurrence_day_of_month = data.recurrenceDayOfMonth;
    updateData.updated_at = new Date();

    const updated = await this.prisma.scheduledMessage.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`✅ Mesaj automat actualizat: ${id}`);
    return updated;
  }

  async deleteScheduledMessage(id: string): Promise<void> {
    await this.prisma.scheduledMessage.delete({
      where: { id },
    });

    this.logger.log(`✅ Mesaj automat șters: ${id}`);
  }

  /**
   * Obține mesajele automate care trebuie trimise astăzi
   * (active, între startDate și endDate, și nu au fost trimise astăzi)
   * @param ignoreTimeCheck - Dacă este true, ignoră verificarea orei (pentru testare manuală)
   */
  async getMessagesToSendToday(
    ignoreTimeCheck: boolean = false,
  ): Promise<ScheduledMessage[]> {
    // Folosim doar partea de dată (YYYY-MM-DD) pentru comparații, ignorând ora și timezone-ul
    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const todayStart = new Date(todayDateOnly);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayDateOnly);
    todayEnd.setHours(23, 59, 59, 999);

    // Log pentru debugging
    this.logger.log(
      `🔍 Căutare mesaje automate - today: ${todayStart.toISOString()} - ${todayEnd.toISOString()}, ignoreTimeCheck: ${ignoreTimeCheck}`,
    );

    // Mai întâi, obține toate mesajele active pentru debugging
    const allActiveMessages = await this.prisma.scheduledMessage.findMany({
      where: {
        is_active: true,
      },
    });

    this.logger.log(
      `📊 Total mesaje active în BD: ${allActiveMessages.length}`,
    );
    if (allActiveMessages.length > 0) {
      allActiveMessages.forEach((msg) => {
        this.logger.log(
          `  - ${msg.name}: start_date=${msg.start_date}, end_date=${msg.end_date}, last_sent_at=${msg.last_sent_at}`,
        );
      });
    }

    // Obține toate mesajele active și filtrează manual pentru a evita problemele cu timezone-ul
    const allMessages = await this.prisma.scheduledMessage.findMany({
      where: {
        is_active: true,
      },
    });

    // Filtrează manual mesajele care sunt în perioada corectă și respectă recurența
    const recurrence = (r: string | null) => (r && r.trim()) || 'daily';
    const messages = allMessages.filter((msg) => {
      const startDate = new Date(msg.start_date);
      const endDate = new Date(msg.end_date);
      const startDateOnly = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      );
      const endDateOnly = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
      );
      const todayDateOnlyCompare = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      const isInPeriod =
        startDateOnly <= todayDateOnlyCompare &&
        endDateOnly >= todayDateOnlyCompare;
      if (!isInPeriod) return false;

      const rec = recurrence((msg as any).recurrence);

      // Recurență: daily = zilnic, weekly = o zi din săptămână, monthly = o zi din lună
      if (rec === 'weekly') {
        const dayOfWeek = (msg as any).recurrence_day_of_week;
        if (dayOfWeek == null) return false;
        const todayDay = today.getDay();
        if (todayDay !== dayOfWeek) return false;
        const lastSent = (msg as any).last_sent_at;
        if (lastSent) {
          const last = new Date(lastSent);
          const sameWeek =
            this.getWeekNumber(last) === this.getWeekNumber(today) &&
            last.getFullYear() === today.getFullYear();
          if (sameWeek) return false;
        }
      } else if (rec === 'monthly') {
        const dayOfMonth = (msg as any).recurrence_day_of_month;
        if (dayOfMonth == null) return false;
        const todayDay = today.getDate();
        if (todayDay !== dayOfMonth) return false;
        const lastSent = (msg as any).last_sent_at;
        if (lastSent) {
          const last = new Date(lastSent);
          if (
            last.getFullYear() === today.getFullYear() &&
            last.getMonth() === today.getMonth()
          )
            return false;
        }
      } else {
        // daily: nu trimite dacă a fost trimis astăzi
        if (msg.last_sent_at) {
          const lastSentDate = new Date(msg.last_sent_at);
          const lastSentDateOnly = new Date(
            lastSentDate.getFullYear(),
            lastSentDate.getMonth(),
            lastSentDate.getDate(),
          );
          if (lastSentDateOnly >= todayDateOnlyCompare) return false;
        }
      }

      return true;
    });

    this.logger.log(
      `📋 Mesaje găsite după filtrare (active, în perioadă, ne-trimise astăzi): ${messages.length}`,
    );

    // Dacă ignorăm verificarea orei (pentru testare manuală), returnăm toate mesajele
    if (ignoreTimeCheck) {
      this.logger.log(
        `📋 Găsite ${messages.length} mesaje automate (ignorând verificarea orei pentru testare)`,
      );
      return messages;
    }

    // Filtrează mesajele care trebuie trimise la ora curentă
    // Folosim timezone-ul Europe/Madrid pentru comparare (Spania)
    const currentTime = new Date();
    const madridTime = new Date(
      currentTime.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }),
    );
    const currentHour = madridTime.getHours();
    const currentMinute = madridTime.getMinutes();
    const currentTimeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    this.logger.log(
      `🕐 Ora curentă (UTC): ${currentTime.getHours()}:${String(currentTime.getMinutes()).padStart(2, '0')}, Ora curentă (Madrid): ${currentTimeString}`,
    );

    const filtered = messages.filter((msg) => {
      if (!msg.send_time) {
        this.logger.warn(`⚠️ Mesaj "${msg.name}" nu are send_time setat`);
        return false;
      }
      const [msgHour, msgMinute] = msg.send_time.split(':').map(Number);
      const isEligible =
        currentHour > msgHour ||
        (currentHour === msgHour && currentMinute >= msgMinute);
      this.logger.log(
        `  - Mesaj "${msg.name}": send_time=${msg.send_time}, ora curentă=${currentTimeString}, eligibil=${isEligible}`,
      );
      // Verifică dacă ora curentă este >= ora de trimitere
      return isEligible;
    });

    this.logger.log(
      `📋 Găsite ${messages.length} mesaje automate, ${filtered.length} eligibile pentru trimitere la ora ${currentTimeString}`,
    );
    return filtered;
  }

  private getWeekNumber(d: Date): number {
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor(
      (d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000),
    );
    return Math.ceil((dayOfYear + oneJan.getDay() + 1) / 7);
  }

  /**
   * Actualizează lastSentAt pentru un mesaj automat
   */
  async markAsSent(id: string): Promise<void> {
    await this.prisma.scheduledMessage.update({
      where: { id },
      data: { last_sent_at: new Date() },
    });
  }
}
