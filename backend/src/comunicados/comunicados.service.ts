import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../services/push.service';

@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Obține toate comunicados publicate, ordonate descrescător (cele mai noi primele)
   */
  async findAll() {
    return this.prisma.comunicado.findMany({
      where: { publicado: true },
      orderBy: { created_at: 'desc' },
      include: {
        leidos: {
          select: {
            user_id: true,
            read_at: true,
          },
        },
      },
    });
  }

  /**
   * Obține un comunicado specific
   */
  async findOne(id: bigint) {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      include: {
        leidos: {
          select: {
            user_id: true,
            read_at: true,
          },
        },
      },
    });

    if (!comunicado) {
      throw new NotFoundException(`Comunicado cu id ${id} nu a fost găsit`);
    }

    return comunicado;
  }

  /**
   * Creează un comunicado nou
   */
  async create(
    autorId: string,
    data: {
      titulo: string;
      contenido: string;
      publicado?: boolean;
    },
  ) {
    const publicado = data.publicado ?? false;

    const comunicado = await this.prisma.comunicado.create({
      data: {
        titulo: data.titulo,
        contenido: data.contenido,
        autor_id: autorId,
        publicado,
      },
    });

    // Dacă este publicat, trimite push notification către toți userii
    if (publicado) {
      await this.sendPushNotification(comunicado);
    }

    return comunicado;
  }

  /**
   * Actualizează un comunicado
   */
  async update(
    id: bigint,
    data: {
      titulo?: string;
      contenido?: string;
      publicado?: boolean;
    },
  ) {
    const existing = await this.prisma.comunicado.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Comunicado cu id ${id} nu a fost găsit`);
    }

    const wasPublished = existing.publicado;
    const willBePublished = data.publicado ?? existing.publicado;

    const comunicado = await this.prisma.comunicado.update({
      where: { id },
      data: {
        titulo: data.titulo,
        contenido: data.contenido,
        publicado: data.publicado,
      },
    });

    // Dacă se publică pentru prima dată (nu era publicat înainte), trimite push
    if (!wasPublished && willBePublished) {
      await this.sendPushNotification(comunicado);
    }

    return comunicado;
  }

  /**
   * Șterge un comunicado
   */
  async remove(id: bigint) {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
    });

    if (!comunicado) {
      throw new NotFoundException(`Comunicado cu id ${id} nu a fost găsit`);
    }

    await this.prisma.comunicado.delete({
      where: { id },
    });

    return { message: 'Comunicado șters cu succes' };
  }

  /**
   * Marchează un comunicado ca citit de un utilizator
   */
  async markAsRead(comunicadoId: bigint, userId: string) {
    // Verifică dacă comunicado-ul există
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id: comunicadoId },
    });

    if (!comunicado) {
      throw new NotFoundException(
        `Comunicado cu id ${comunicadoId} nu a fost găsit`,
      );
    }

    // Upsert pentru a evita duplicate-urile
    await this.prisma.comunicadoLeido.upsert({
      where: {
        comunicado_id_user_id: {
          comunicado_id: comunicadoId,
          user_id: userId,
        },
      },
      update: {
        read_at: new Date(),
      },
      create: {
        comunicado_id: comunicadoId,
        user_id: userId,
        read_at: new Date(),
      },
    });

    return { message: 'Comunicado marcat ca citit' };
  }

  /**
   * Verifică dacă un utilizator poate gestiona comunicados (Admin/Supervisor/RRHH)
   */
  canUserManageComunicados(grupo: string | undefined): boolean {
    if (!grupo) return false;
    const grupoUpper = grupo.toUpperCase();
    return (
      grupoUpper === 'DEVELOPER' ||
      grupoUpper === 'ADMIN' ||
      grupoUpper === 'SUPERVISOR' ||
      grupoUpper === 'MANAGER' ||
      grupoUpper === 'RRHH'
    );
  }

  /**
   * Trimite push notification către toți userii când se publică un comunicado
   */
  private async sendPushNotification(comunicado: {
    id: bigint;
    titulo: string;
    contenido: string;
  }) {
    try {
      // Primele ~120 caractere din conținut pentru body
      const preview =
        comunicado.contenido.length > 120
          ? `${comunicado.contenido.slice(0, 120)}...`
          : comunicado.contenido;

      const result = await this.pushService.sendPushToAllUsers({
        title: comunicado.titulo,
        message: preview,
        data: {
          type: 'COMUNICADO',
          comunicadoId: Number(comunicado.id),
          url: `/comunicados/${comunicado.id}`,
        },
        url: `/comunicados/${comunicado.id}`,
      });

      this.logger.log(
        `✅ Push notification trimisă pentru comunicado ${comunicado.id}: ${result.sent}/${result.total} useri`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Eroare la trimiterea push notification pentru comunicado ${comunicado.id}:`,
        error,
      );
      // Nu aruncăm eroare - comunicado-ul a fost deja salvat
    }
  }
}
