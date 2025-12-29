import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AssistantService } from './services/assistant.service';
import { MessageDto, AssistantResponseDto } from './dto/message.dto';

@Controller('api/assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistantService: AssistantService) {}

  /**
   * POST /api/assistant/message
   * Endpoint principal pentru chat/asistent
   * Acceptă formatul actual din frontend: { mensaje, usuario: { id, nombre, rol } }
   */
  @Post('message')
  async processMessage(
    @Body() body: MessageDto,
    @CurrentUser() currentUser: any,
  ): Promise<AssistantResponseDto> {
    this.logger.log(
      `📨 Mensaje recibido de ${body.usuario?.nombre || currentUser?.userId}`,
    );

    // Validare
    if (!body.mensaje || !body.usuario) {
      throw new Error('mensaje y usuario son obligatorios');
    }

    // Asigură că folosim datele corecte (prioritate la body.usuario, fallback la currentUser)
    const messageDto: MessageDto = {
      mensaje: body.mensaje.trim(),
      usuario: {
        id: body.usuario.id || currentUser?.userId || 'N/A',
        nombre: body.usuario.nombre || currentUser?.empleadoNombre || 'Usuario',
        rol: body.usuario.rol || currentUser?.GRUPO || currentUser?.role || null,
      },
    };

    // Procesează mesajul
    const response = await this.assistantService.processMessage(messageDto);

    return response;
  }
}

