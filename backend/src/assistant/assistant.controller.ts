import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  BadRequestException,
  UnauthorizedException,
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
  ) {}

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
      const archivedId = await this.assistantConversations.appendExchange(
        currentUser.userId,
        conversationIdRaw,
        body.mensaje.trim(),
        response.respuesta ?? '',
      );
      return { ...response, conversationId: archivedId };
    } catch (e: any) {
      this.logger.warn(
        `Arhivă conversație: nu s-a putut salva (${e?.message ?? e})`,
      );
      return response;
    }
  }
}
