import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AssistantService } from './services/assistant.service';
import { MessageDto, AssistantResponseDto } from './dto/message.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantUserThrottlerGuard } from './guards/assistant-user-throttler.guard';
import { AssistantUserPreferencesService } from './services/assistant-user-preferences.service';
import { AssistantConversationService } from './services/assistant-conversation.service';
import { AssistantMessageFeedbackService } from './services/assistant-message-feedback.service';
import { AssistantAnalyticsService } from './services/assistant-analytics.service';
import { AssistantValidatedFaqAdminService } from './services/assistant-validated-faq-admin.service';
import { ASSISTANT_FAQ_WILDCARD_INTENT } from './services/assistant-validated-faq.service';
import { UpdateAssistantPreferencesDto } from './dto/assistant-preferences.dto';

/** Usuario JWT validado por JwtStrategy (no confiar en el body para identidad). */
type JwtUser = {
  userId?: string;
  role?: string;
  grupo?: string;
  email?: string;
};

@Controller('api/assistant')
@UseGuards(JwtAuthGuard, AssistantUserThrottlerGuard)
@Throttle({
  /** Llamadas costosas (LLM + SQL): ~1 mensaje cada pocos s en uso normal */
  short: { ttl: 60000, limit: 45 },
  medium: { ttl: 3600000, limit: 280 },
})
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(
    private readonly assistantService: AssistantService,
    private readonly prisma: PrismaService,
    private readonly assistantPreferences: AssistantUserPreferencesService,
    private readonly assistantConversations: AssistantConversationService,
    private readonly assistantMessageFeedback: AssistantMessageFeedbackService,
    private readonly assistantAnalytics: AssistantAnalyticsService,
    private readonly assistantValidatedFaqAdmin: AssistantValidatedFaqAdminService,
  ) {}

  /** RRHH / supervisores: ver arhiva chat AI de otro empleado */
  private assertStaffCanViewEmployeeChatAudit(user: JwtUser) {
    const g = (user?.grupo || user?.role || '').toString().trim();
    const allowed = ['Developer', 'Admin', 'Manager', 'Supervisor'];
    if (!allowed.some((a) => a.toLowerCase() === g.toLowerCase())) {
      throw new ForbiddenException(
        'Sin permiso para consultar el historial de chat del asistente',
      );
    }
  }

  /**
   * GET /api/assistant/admin/empleados-con-conversaciones
   * Empleados con al menos un hilo archivado (para selector RRHH).
   */
  @Get('admin/empleados-con-conversaciones')
  async adminListEmpleadosConConversaciones(
    @CurrentUser() currentUser: JwtUser,
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    const empleados =
      await this.assistantConversations.listEmpleadosWithArchivedConversations(
        500,
      );
    return { empleados };
  }

  /**
   * GET /api/assistant/admin/empleado/:codigo/conversations
   * Lista hilos de chat archivados (mismo esquema que el usuario ve en la app).
   */
  @Get('admin/empleado/:codigo/conversations')
  async adminListConversationsForEmpleado(
    @CurrentUser() currentUser: JwtUser,
    @Param('codigo') codigo: string,
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    const c = (codigo || '').trim();
    if (!c) {
      throw new BadRequestException('codigo es obligatorio');
    }
    const conversations = await this.assistantConversations.listForUser(c, 120);
    return { usuarioId: c, conversations };
  }

  /**
   * GET /api/assistant/admin/analytics/summary
   * KPIs agregados (mensajes, response_source, feedback) en rango de fechas (UTC).
   */
  @Get('admin/analytics/summary')
  async adminAnalyticsSummary(
    @CurrentUser() currentUser: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    const range = this.assistantAnalytics.parseRange(from, to);
    return this.assistantAnalytics.getSummary(range.from, range.to);
  }

  /**
   * GET /api/assistant/admin/analytics/feedback-negative
   * Lista feedback negativo con preview de pregunta (mensaje user previo) y respuesta assistant.
   */
  @Get('admin/analytics/feedback-negative')
  async adminAnalyticsFeedbackNegative(
    @CurrentUser() currentUser: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    const range = this.assistantAnalytics.parseRange(from, to);
    const lim =
      limit != null && String(limit).trim() !== ''
        ? Number.parseInt(String(limit).trim(), 10)
        : 50;
    return this.assistantAnalytics.getFeedbackNegative(
      range.from,
      range.to,
      lim,
    );
  }

  /**
   * GET /api/assistant/admin/analytics/app-help-insights
   * Agregados app-help / datos personales desde assistant_audit_log (FAQ vs KB vacía, top preguntas).
   */
  @Get('admin/analytics/app-help-insights')
  async adminAnalyticsAppHelpInsights(
    @CurrentUser() currentUser: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('minCount') minCount?: string,
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    const range = this.assistantAnalytics.parseRange(from, to);
    const p = this.assistantAnalytics.parseAppHelpInsightsParams(
      limit,
      minCount,
    );
    return this.assistantAnalytics.getAppHelpInsights(
      range.from,
      range.to,
      p.limit,
      p.minCount,
    );
  }

  /**
   * GET /api/assistant/admin/validated-faq
   * Una fila por clave (question_hash + intent + locale). Prefill del editor FAQ.
   */
  @Get('admin/validated-faq')
  async adminGetValidatedFaq(
    @CurrentUser() currentUser: JwtUser,
    @Query('question_hash') questionHash?: string,
    @Query('intent') intent?: string,
    @Query('locale') locale?: string,
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    const i = (intent ?? ASSISTANT_FAQ_WILDCARD_INTENT).trim();
    const l = (locale ?? 'es').trim().toLowerCase();
    return this.assistantValidatedFaqAdmin.getByCompositeKey(
      questionHash ?? '',
      i,
      l,
    );
  }

  /**
   * PUT /api/assistant/admin/validated-faq
   * Upsert FAQ validada (hash recalculado en servidor desde normalizedQuestion).
   */
  @Put('admin/validated-faq')
  async adminUpsertValidatedFaq(
    @CurrentUser() currentUser: JwtUser,
    @Body()
    body: {
      normalizedQuestion?: string;
      replyText?: string;
      intent?: string;
      locale?: string;
      active?: boolean;
      priority?: number;
      source?: string;
    },
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    return this.assistantValidatedFaqAdmin.upsert(body ?? {});
  }

  /**
   * GET /api/assistant/admin/empleado/:codigo/conversations/:conversationId/messages
   */
  @Get('admin/empleado/:codigo/conversations/:conversationId/messages')
  async adminGetConversationMessagesForEmpleado(
    @CurrentUser() currentUser: JwtUser,
    @Param('codigo') codigo: string,
    @Param('conversationId') conversationId: string,
  ) {
    this.assertStaffCanViewEmployeeChatAudit(currentUser);
    const c = (codigo || '').trim();
    if (!c) {
      throw new BadRequestException('codigo es obligatorio');
    }
    const messages = await this.assistantConversations.getMessagesForUser(
      c,
      conversationId,
    );
    return { conversationId, messages };
  }

  /**
   * POST /api/assistant/message
   * Identidad y rol para RBAC: solo desde JWT + BD (nombre para auditoría).
   * El objeto body.usuario se ignora para autorización (compatibilidad con clientes que lo envían).
   */
  /**
   * GET /api/assistant/preferences — preferencias explícitas (opt-in). Sin fila → valores por defecto lógicos.
   */
  @Get('preferences')
  async getPreferences(@CurrentUser() currentUser: JwtUser) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identidad de usuario',
      );
    }
    return this.assistantPreferences.getPublic(currentUser.userId);
  }

  /**
   * PUT /api/assistant/preferences — merge parcial; opted_in true activa idioma/estilo/tono en prompts.
   */
  @Put('preferences')
  async putPreferences(
    @CurrentUser() currentUser: JwtUser,
    @Body() body: UpdateAssistantPreferencesDto,
  ) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identidad de usuario',
      );
    }
    return this.assistantPreferences.upsert(currentUser.userId, body ?? {});
  }

  /**
   * GET /api/assistant/conversations — istoric conversații pentru utilizatorul JWT.
   */
  @Get('conversations')
  async listConversations(@CurrentUser() currentUser: JwtUser) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identidad de usuario',
      );
    }
    const conversations = await this.assistantConversations.listForUser(
      currentUser.userId,
    );
    return { conversations };
  }

  /**
   * DELETE /api/assistant/conversations — borra todo el historial del asistente del usuario JWT (irreversible).
   */
  @Delete('conversations')
  async deleteAllConversations(@CurrentUser() currentUser: JwtUser) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identidad de usuario',
      );
    }
    const { deletedConversations } =
      await this.assistantConversations.deleteAllForUser(currentUser.userId);
    return { ok: true, deletedConversations };
  }

  /**
   * GET /api/assistant/conversations/:id — mesaje dintr-o conversație (doar dacă aparține userului).
   */
  @Get('conversations/:id')
  async getConversationMessages(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') conversationId: string,
  ) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identidad de usuario',
      );
    }
    const messages = await this.assistantConversations.getMessagesForUser(
      currentUser.userId,
      conversationId,
    );
    return { conversationId, messages };
  }

  /**
   * POST /api/assistant/messages/:messageId/feedback — valoración thumbs up/down (un envío por mensaje y usuario).
   */
  @Post('messages/:messageId/feedback')
  async submitAssistantMessageFeedback(
    @Param('messageId') messageId: string,
    @Body() body: { rating?: string; comment?: string | null },
    @CurrentUser() currentUser: JwtUser,
  ) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identidad de usuario',
      );
    }
    return this.assistantMessageFeedback.submitFeedback(
      currentUser.userId,
      messageId,
      body?.rating ?? '',
      body?.comment === null || body?.comment === undefined
        ? undefined
        : String(body.comment),
    );
  }

  @Post('message')
  async processMessage(
    @Body() body: MessageDto,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<AssistantResponseDto> {
    if (!currentUser?.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identidad de usuario',
      );
    }

    if (
      !body?.mensaje ||
      typeof body.mensaje !== 'string' ||
      !body.mensaje.trim()
    ) {
      throw new BadRequestException('mensaje es obligatorio');
    }

    // RBAC: preferir GRUPO del token (p. ej. Jefe, Manager) — alineado con RbacService.toLowerCase()
    const rbacRol =
      (currentUser.grupo && String(currentUser.grupo).trim()) ||
      (currentUser.role && String(currentUser.role).trim()) ||
      null;

    let nombre = 'Usuario';
    try {
      const emp = await this.prisma.user.findUnique({
        where: { CODIGO: currentUser.userId },
        select: {
          NOMBRE_APELLIDOS: true,
          CORREO_ELECTRONICO: true,
        },
      });
      if (emp?.NOMBRE_APELLIDOS?.trim()) {
        nombre = emp.NOMBRE_APELLIDOS.trim();
      } else if (emp?.CORREO_ELECTRONICO?.trim()) {
        nombre = emp.CORREO_ELECTRONICO.trim();
      } else if (currentUser.email) {
        nombre = currentUser.email;
      }
    } catch (e: any) {
      this.logger.warn(
        `No se pudo cargar nombre del empleado: ${e?.message ?? e}`,
      );
      if (currentUser.email) {
        nombre = currentUser.email;
      }
    }

    const conversationIdRaw =
      body.conversationId != null && String(body.conversationId).trim() !== ''
        ? String(body.conversationId).trim()
        : undefined;

    const messageDto: MessageDto = {
      mensaje: body.mensaje.trim(),
      conversationId: conversationIdRaw,
      usuario: {
        id: currentUser.userId,
        nombre,
        rol: rbacRol ?? '',
      },
    };

    this.logger.log(`📨 Mensaje recibido de ${nombre} (${currentUser.userId})`);

    const response = await this.assistantService.processMessage(messageDto);

    try {
      const archived = await this.assistantConversations.appendExchange(
        currentUser.userId,
        conversationIdRaw,
        body.mensaje.trim(),
        response.respuesta ?? '',
        response.responseSource ?? null,
      );
      return {
        ...response,
        conversationId: archived.conversationId,
        ...(archived.assistantMessageId
          ? { assistantMessageId: archived.assistantMessageId }
          : {}),
      };
    } catch (e: any) {
      this.logger.warn(
        `Arhivă conversație: nu s-a putut salva (${e?.message ?? e})`,
      );
      return response;
    }
  }
}
