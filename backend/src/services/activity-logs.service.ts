import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateActivityLogDto {
  timestamp?: string;
  action: string;
  details?: {
    user?: string;
    email?: string;
    grupo?: string;
    [key: string]: any;
  };
  url?: string;
  sessionId?: string;
}

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creează un log de activitate
   * Extrage automat userAgent și ip din request (se vor pasa din controller)
   */
  async createLog(dto: CreateActivityLogDto, userAgent?: string, ip?: string) {
    try {
      const { timestamp, action, details = {}, url, sessionId } = dto;

      // Extrage datele utilizatorului din details SAU direct din root (pentru compatibilitate cu frontend)
      // Frontend-ul trimite user, email, grupo direct în root, nu în details
      const dtoAny = dto as any;
      const user = dtoAny.user || details.user || details.userName || null;
      const email = dtoAny.email || details.email || null;
      const grupo = dtoAny.grupo || details.grupo || details.GRUPO || null;

      // Mapează updateby din root sau din details
      // IMPORTANT: Folosește user (numele) ca updateby, NU email-ul
      // NU includem rolul - avem deja grupo separat
      const updateby =
        dtoAny.updateby ||
        details.updated_by ||
        user || // Preferă numele, nu email-ul
        details.updated_by_email ||
        email ||
        '';

      // Format timestamp (folosește timestamp din request sau current time)
      const logTimestamp = timestamp
        ? new Date(timestamp).toISOString()
        : new Date().toISOString();

      // Extrage url și sessionId din root sau din parametrii (pentru compatibilitate)
      const finalUrl = dtoAny.url || url || null;
      const finalSessionId = dtoAny.sessionId || sessionId || null;

      // Log pentru debugging
      console.log('[ActivityLogsService] Creating log:', {
        action,
        user,
        email,
        grupo,
        updateby,
        ip,
        userAgent: userAgent ? userAgent.substring(0, 50) + '...' : null,
        url: finalUrl,
        sessionId: finalSessionId,
      });

      // Salvează în baza de date folosind Prisma
      const log = await this.prisma.logs.create({
        data: {
          timestamp: logTimestamp,
          action: action || 'unknown',
          user: user || null,
          email: email || null,
          grupo: grupo || null,
          updateby: updateby || null,
          userAgent: userAgent || null,
          url: finalUrl || null,
          sessionId: finalSessionId || null,
          ip: ip || null,
        },
      });

      console.log('[ActivityLogsService] Log created:', {
        id: log.id,
        action: log.action,
        user: log.user,
        updateby: log.updateby,
        ip: log.ip,
      });

      return log;
    } catch (error) {
      console.error('[ActivityLogsService] Error creating log:', error);
      // Nu aruncăm eroarea - logging-ul nu trebuie să blocheze operațiunile principale
      return null;
    }
  }

  /**
   * Citește log-urile cu filtrare opțională
   */
  async getLogs(
    filters: {
      limit?: number;
      action?: string;
      email?: string;
      grupo?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    const { limit = 100, action, email, grupo, dateFrom, dateTo } = filters;

    const where: any = {};

    if (action && action !== 'todos') {
      where.action = action;
    }

    if (email && email !== 'todos') {
      where.email = email;
    }

    if (grupo && grupo !== 'todos') {
      where.grupo = grupo;
    }

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) {
        where.timestamp.gte = new Date(dateFrom).toISOString();
      }
      if (dateTo) {
        // Adaugă 1 zi pentru a include toată ziua
        const dateToEnd = new Date(dateTo);
        dateToEnd.setDate(dateToEnd.getDate() + 1);
        where.timestamp.lt = dateToEnd.toISOString();
      }
    }

    const logs = await this.prisma.logs.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 1000), // Limit maxim 1000
    });

    return logs;
  }
}
