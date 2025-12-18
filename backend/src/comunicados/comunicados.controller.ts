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
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ComunicadosService } from './comunicados.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/comunicados')
@UseGuards(JwtAuthGuard)
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  /**
   * GET /api/comunicados
   * Obține toate comunicados publicate (sau toate dacă user-ul are permisiuni de management)
   */
  @Get()
  async findAll(@CurrentUser() user: any) {
    // Dacă user-ul are permisiuni de management, arată toate comunicados (publicate și nepublicate)
    const includeUnpublished = this.comunicadosService.canUserManageComunicados(
      user.grupo,
    );
    const comunicados =
      await this.comunicadosService.findAll(includeUnpublished);

    return {
      success: true,
      comunicados: comunicados.map((c) => ({
        id: Number(c.id),
        titulo: c.titulo,
        contenido: c.contenido,
        autor_id: c.autor_id,
        autor_nombre: c.autor_nombre || c.autor_id,
        publicado: c.publicado,
        nombre_archivo: c.nombre_archivo,
        has_archivo: !!c.nombre_archivo,
        created_at: c.created_at,
        updated_at: c.updated_at,
        leidos_count: c.leidos.length,
      })),
    };
  }

  /**
   * GET /api/comunicados/unread-count
   * Obține numărul de comunicados necitite pentru user-ul curent
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.comunicadosService.countUnread(user.userId);
    return {
      success: true,
      count,
    };
  }

  /**
   * GET /api/comunicados/:id
   * Obține un comunicado specific
   * IMPORTANT: Această rută trebuie să fie DUPĂ rutele specifice (ex: unread-count)
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Verifică dacă id-ul este un număr valid înainte de a-l converti la BigInt
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException(`Invalid comunicado ID: ${id}`);
    }
    const comunicado = await this.comunicadosService.findOne(BigInt(id));
    return {
      success: true,
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
        autor_id: comunicado.autor_id,
        autor_nombre: comunicado.autor_nombre || comunicado.autor_id,
        publicado: comunicado.publicado,
        nombre_archivo: comunicado.nombre_archivo,
        has_archivo: !!comunicado.nombre_archivo,
        created_at: comunicado.created_at,
        updated_at: comunicado.updated_at,
        leidos: comunicado.leidos.map((l: any) => ({
          user_id: l.user_id,
          user_nombre: l.user_nombre || l.user_id,
          read_at: l.read_at,
        })),
      },
    };
  }

  /**
   * POST /api/comunicados
   * Creează un comunicado nou (doar Admin/Supervisor/RRHH)
   * Acceptă FormData cu câmpuri: titulo, contenido, publicado, archivo (opțional)
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
      fileFilter: (req, file, cb) => {
        // Log pentru debugging
        console.log(`[Comunicados] File filter - name: ${file.originalname}, mimetype: ${file.mimetype}`);
        cb(null, true); // Acceptă toate fișierele
      },
    }),
  )
  async create(
    @CurrentUser() user: any,
    @Body()
    body: {
      titulo: string;
      contenido: string;
      publicado?: string | boolean;
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Verifică permisiunile
    if (!this.comunicadosService.canUserManageComunicados(user.grupo)) {
      throw new ForbiddenException(
        'No tienes permiso para crear comunicados. Solo Admin, Supervisor y RRHH pueden crear comunicados.',
      );
    }

    if (!body.titulo || !body.titulo.trim()) {
      throw new BadRequestException('El título es obligatorio');
    }

    if (!body.contenido || !body.contenido.trim()) {
      throw new BadRequestException('El contenido es obligatorio');
    }

    // Procesează fișierul dacă există
    let archivoBuffer: Buffer | null = null;
    let nombreArchivo: string | null = null;

    if (file) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`[Comunicados] File received: ${file.originalname}, size: ${file.size} bytes (${fileSizeMB} MB), mimetype: ${file.mimetype}`);
      archivoBuffer = Buffer.from(file.buffer);
      // Sanitizează numele fișierului: elimină caractere problematice și normalizează
      const originalName = file.originalname || `archivo_${Date.now()}`;
      // Elimină caractere non-ASCII problematice, păstrează doar litere, cifre, puncte, spații, underscore, hyphen
      nombreArchivo = originalName
        .replace(/[^\w\s.-]/g, '_') // Înlocuiește caractere speciale cu underscore
        .replace(/\s+/g, '_') // Înlocuiește spațiile multiple cu underscore
        .trim();
      
      // Dacă numele este prea scurt sau gol după sanitizare, adaugă timestamp
      if (!nombreArchivo || nombreArchivo.length < 3) {
        const extension = originalName.split('.').pop() || 'bin';
        nombreArchivo = `archivo_${Date.now()}.${extension}`;
      }
      
      console.log(`[Comunicados] Sanitized filename: ${originalName} -> ${nombreArchivo}`);
    } else {
      console.log('[Comunicados] No file received in request');
    }

    // Procesează publicado (poate veni ca string "true"/"false" din FormData)
    const publicado =
      body.publicado === true ||
      body.publicado === 'true' ||
      body.publicado === '1';

    const comunicado = await this.comunicadosService.create(user.userId, {
      titulo: body.titulo.trim(),
      contenido: body.contenido.trim(),
      publicado,
      archivo: archivoBuffer,
      nombre_archivo: nombreArchivo,
    });

    return {
      success: true,
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
        autor_id: comunicado.autor_id,
        autor_nombre: comunicado.autor_nombre || comunicado.autor_id,
        publicado: comunicado.publicado,
        nombre_archivo: comunicado.nombre_archivo,
        has_archivo: !!comunicado.nombre_archivo,
        created_at: comunicado.created_at,
        updated_at: comunicado.updated_at,
      },
    };
  }

  /**
   * PUT /api/comunicados/:id
   * Actualizează un comunicado (doar Admin/Supervisor/RRHH)
   * Acceptă FormData cu câmpuri: titulo, contenido, publicado, archivo (opțional)
   */
  @Put(':id')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
    }),
  )
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    body: {
      titulo?: string;
      contenido?: string;
      publicado?: string | boolean;
      remove_archivo?: string | boolean;
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Verifică permisiunile
    if (!this.comunicadosService.canUserManageComunicados(user.grupo)) {
      throw new ForbiddenException(
        'No tienes permiso para editar comunicados. Solo Admin, Supervisor y RRHH pueden editar comunicados.',
      );
    }

    // Procesează fișierul dacă există
    let archivoBuffer: Buffer | null | undefined = undefined;
    let nombreArchivo: string | null | undefined = undefined;

    if (file) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`[Comunicados] Update - File received: ${file.originalname}, size: ${file.size} bytes (${fileSizeMB} MB), mimetype: ${file.mimetype}`);
      archivoBuffer = Buffer.from(file.buffer);
      // Sanitizează numele fișierului: elimină caractere problematice și normalizează
      const originalName = file.originalname || `archivo_${Date.now()}`;
      // Elimină caractere non-ASCII problematice, păstrează doar litere, cifre, puncte, spații, underscore, hyphen
      nombreArchivo = originalName
        .replace(/[^\w\s.-]/g, '_') // Înlocuiește caractere speciale cu underscore
        .replace(/\s+/g, '_') // Înlocuiește spațiile multiple cu underscore
        .trim();
      
      // Dacă numele este prea scurt sau gol după sanitizare, adaugă timestamp
      if (!nombreArchivo || nombreArchivo.length < 3) {
        const extension = originalName.split('.').pop() || 'bin';
        nombreArchivo = `archivo_${Date.now()}.${extension}`;
      }
      
      console.log(`[Comunicados] Update - Sanitized filename: ${originalName} -> ${nombreArchivo}`);
    } else if (
      body.remove_archivo === true ||
      body.remove_archivo === 'true' ||
      body.remove_archivo === '1'
    ) {
      // Dacă se cere ștergerea fișierului
      archivoBuffer = null;
      nombreArchivo = null;
    }

    // Procesează publicado (poate veni ca string "true"/"false" din FormData)
    const publicado =
      body.publicado !== undefined
        ? body.publicado === true ||
          body.publicado === 'true' ||
          body.publicado === '1'
        : undefined;

    const comunicado = await this.comunicadosService.update(BigInt(id), {
      titulo: body.titulo?.trim(),
      contenido: body.contenido?.trim(),
      publicado,
      archivo: archivoBuffer,
      nombre_archivo: nombreArchivo,
    });

    return {
      success: true,
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
        autor_id: comunicado.autor_id,
        autor_nombre: comunicado.autor_nombre || comunicado.autor_id,
        publicado: comunicado.publicado,
        nombre_archivo: comunicado.nombre_archivo,
        has_archivo: !!comunicado.nombre_archivo,
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
   * GET /api/comunicados/:id/download
   * Descarcă fișierul atașat la un comunicado
   */
  @Get(':id/download')
  async downloadArchivo(@Param('id') id: string, @Res() res: Response) {
    const result = await this.comunicadosService.downloadArchivo(BigInt(id));

    // Setează headers pentru download
    res.setHeader('Content-Type', result.tipo_mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.nombre_archivo)}"`,
    );
    res.setHeader('Content-Length', result.archivo.length);

    // Trimite fișierul
    res.send(result.archivo);
  }

  /**
   * POST /api/comunicados/:id/publicar
   * Publică un comunicado și trimite push notification (doar Admin/Supervisor/RRHH)
   */
  @Post(':id/publicar')
  async publicar(@CurrentUser() user: any, @Param('id') id: string) {
    // Verifică permisiunile
    if (!this.comunicadosService.canUserManageComunicados(user.grupo)) {
      throw new ForbiddenException(
        'No tienes permiso para publicar comunicados. Solo Admin, Supervisor y RRHH pueden publicar comunicados.',
      );
    }

    const comunicado = await this.comunicadosService.update(BigInt(id), {
      publicado: true,
    });

    return {
      success: true,
      message:
        'Comunicado publicado con éxito. Se ha enviado una notificación push a todos los empleados.',
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
        autor_id: comunicado.autor_id,
        autor_nombre: comunicado.autor_nombre || comunicado.autor_id,
        publicado: comunicado.publicado,
        nombre_archivo: comunicado.nombre_archivo,
        has_archivo: !!comunicado.nombre_archivo,
        created_at: comunicado.created_at,
        updated_at: comunicado.updated_at,
      },
    };
  }

  /**
   * POST /api/comunicados/:id/notificar
   * Retrimite notificarea push pentru un comunicado deja publicat
   * Doar Admin/Supervisor/RRHH/Developer
   */
  @Post(':id/notificar')
  async renotificar(@CurrentUser() user: any, @Param('id') id: string) {
    // Verifică permisiunile
    if (!this.comunicadosService.canUserManageComunicados(user.grupo)) {
      throw new ForbiddenException(
        'No tienes permiso para reenviar notificaciones. Solo Admin, Supervisor, RRHH y Developer pueden reenviar notificaciones.',
      );
    }

    const { comunicado, pushResult } =
      await this.comunicadosService.resendPushNotification(BigInt(id));

    return {
      success: true,
      message:
        pushResult && typeof pushResult.sent === 'number'
          ? `Se ha reenviado la notificación: ${pushResult.sent} de ${pushResult.total} empleados con notificaciones activas.`
          : 'Se ha reenviado la notificación push de este comunicado a todos los empleados con notificaciones activas.',
      comunicado,
      pushResult,
    };
  }


  /**
   * POST /api/comunicados/:id/marcar-leido
   * Marchează un comunicado ca citit
   */
  @Post(':id/marcar-leido')
  async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user || !user.userId) {
      throw new UnauthorizedException(
        'Usuario no autenticado o userId no disponible',
      );
    }

    await this.comunicadosService.markAsRead(BigInt(id), user.userId);

    return {
      success: true,
      message: 'Comunicado marcado como leído',
    };
  }
}
