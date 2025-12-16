import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ActivityLogsService,
  CreateActivityLogDto,
} from '../services/activity-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('api/activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  /**
   * POST /api/activity-logs
   * Endpoint pentru crearea unui log de activitate
   * Extrage automat userAgent și ip din request headers
   */
  @Post()
  async createLog(@Req() req: Request, @Body() dto: CreateActivityLogDto) {
    // Validează câmpurile obligatorii
    if (!dto.action) {
      throw new BadRequestException('Action is required');
    }

    // Extrage userAgent din headers sau din body (fallback pentru frontend)
    const dtoAny = dto as any;
    const userAgent =
      req.headers['user-agent'] ||
      dtoAny.userAgent || // Direct în root (pentru compatibilitate)
      dtoAny.browser?.userAgent ||
      dto.details?.browser?.userAgent ||
      null;

    // Extrage IP din headers (suportă proxy headers) sau din body
    // Ordinea de verificare: proxy headers → req.ip → socket address
    let ip =
      dtoAny.ip || // Direct în root (pentru compatibilitate) - prioritatea cea mai mare
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || // Proxy header (primește primul IP din listă)
      (req.headers['x-real-ip'] as string) || // Nginx proxy header
      (req.headers['cf-connecting-ip'] as string) || // Cloudflare header
      req.ip || // Express req.ip (funcționează cu trust proxy)
      req.socket?.remoteAddress || // Direct socket address
      (req as any).connection?.remoteAddress || // Fallback pentru conexiuni HTTP
      null;

    // Normalizează IPv6 localhost la IPv4 pentru consistență
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      ip = '127.0.0.1';
    }

    // Log pentru debugging (doar dacă nu e localhost)
    if (ip !== '127.0.0.1') {
      console.log('[ActivityLogs] IP extraction:', {
        finalIp: ip,
        'dtoAny.ip': dtoAny.ip,
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'req.ip': req.ip,
        'req.socket.remoteAddress': req.socket?.remoteAddress,
      });
    }

    // Creează log-ul
    const log = await this.activityLogsService.createLog(
      dto,
      userAgent || undefined,
      ip || undefined,
    );

    return {
      success: true,
      message: 'Activity log created',
      log: log ? { id: log.id } : null,
    };
  }

  /**
   * GET /api/activity-logs
   * Endpoint pentru citirea log-urilor cu filtrare opțională
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getLogs(
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('email') email?: string,
    @Query('grupo') grupo?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = {
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
      email,
      grupo,
      dateFrom,
      dateTo,
    };

    const logs = await this.activityLogsService.getLogs(filters);

    return {
      success: true,
      logs,
      count: logs.length,
    };
  }
}
