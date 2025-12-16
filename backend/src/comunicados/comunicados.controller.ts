import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/comunicados')
@UseGuards(JwtAuthGuard)
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  /**
   * GET /api/comunicados
   * Obține toate comunicados publicate
   */
  @Get()
  async findAll() {
    const comunicados = await this.comunicadosService.findAll();
    return {
      success: true,
      comunicados: comunicados.map((c) => ({
        id: Number(c.id),
        titulo: c.titulo,
        contenido: c.contenido,
        autor_id: c.autor_id,
        publicado: c.publicado,
        created_at: c.created_at,
        updated_at: c.updated_at,
        leidos_count: c.leidos.length,
      })),
    };
  }

  /**
   * GET /api/comunicados/:id
   * Obține un comunicado specific
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const comunicado = await this.comunicadosService.findOne(BigInt(id));
    return {
      success: true,
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
        autor_id: comunicado.autor_id,
        publicado: comunicado.publicado,
        created_at: comunicado.created_at,
        updated_at: comunicado.updated_at,
        leidos: comunicado.leidos.map((l) => ({
          user_id: l.user_id,
          read_at: l.read_at,
        })),
      },
    };
  }

  /**
   * POST /api/comunicados
   * Creează un comunicado nou (doar Admin/Supervisor/RRHH)
   */
  @Post()
  async create(
    @CurrentUser() user: any,
    @Body()
    body: {
      titulo: string;
      contenido: string;
      publicado?: boolean;
    },
  ) {
    // Verifică permisiunile
    if (!this.comunicadosService.canUserManageComunicados(user.grupo)) {
      throw new ForbiddenException(
        'No tienes permiso para crear comunicados. Solo Admin, Supervisor y RRHH pueden crear comunicados.',
      );
    }

    if (!body.titulo || !body.titulo.trim()) {
      throw new ForbiddenException('El título es obligatorio');
    }

    if (!body.contenido || !body.contenido.trim()) {
      throw new ForbiddenException('El contenido es obligatorio');
    }

    const comunicado = await this.comunicadosService.create(user.userId, {
      titulo: body.titulo.trim(),
      contenido: body.contenido.trim(),
      publicado: body.publicado ?? false,
    });

    return {
      success: true,
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
        autor_id: comunicado.autor_id,
        publicado: comunicado.publicado,
        created_at: comunicado.created_at,
        updated_at: comunicado.updated_at,
      },
    };
  }

  /**
   * PUT /api/comunicados/:id
   * Actualizează un comunicado (doar Admin/Supervisor/RRHH)
   */
  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    body: {
      titulo?: string;
      contenido?: string;
      publicado?: boolean;
    },
  ) {
    // Verifică permisiunile
    if (!this.comunicadosService.canUserManageComunicados(user.grupo)) {
      throw new ForbiddenException(
        'No tienes permiso para editar comunicados. Solo Admin, Supervisor y RRHH pueden editar comunicados.',
      );
    }

    const comunicado = await this.comunicadosService.update(BigInt(id), {
      titulo: body.titulo?.trim(),
      contenido: body.contenido?.trim(),
      publicado: body.publicado,
    });

    return {
      success: true,
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
        autor_id: comunicado.autor_id,
        publicado: comunicado.publicado,
        created_at: comunicado.created_at,
        updated_at: comunicado.updated_at,
      },
    };
  }

  /**
   * DELETE /api/comunicados/:id
   * Șterge un comunicado (doar Admin/Supervisor/RRHH)
   */
  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    // Verifică permisiunile
    if (!this.comunicadosService.canUserManageComunicados(user.grupo)) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar comunicados. Solo Admin, Supervisor y RRHH pueden eliminar comunicados.',
      );
    }

    await this.comunicadosService.remove(BigInt(id));

    return {
      success: true,
      message: 'Comunicado eliminado con éxito',
    };
  }

  /**
   * POST /api/comunicados/:id/marcar-leido
   * Marchează un comunicado ca citit
   */
  @Post(':id/marcar-leido')
  async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    await this.comunicadosService.markAsRead(BigInt(id), user.userId);

    return {
      success: true,
      message: 'Comunicado marcado como leído',
    };
  }
}
