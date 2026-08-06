import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../services/push.service';
import { ComunicadosStorageService } from '../services/comunicados-storage.service';

@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly comunicadosStorage: ComunicadosStorageService,
  ) {}

  /**
   * Obține toate comunicados
   * @param includeUnpublished - Dacă este true, returnează și comunicados nepublicate (pentru Admin/Supervisor/RRHH/Developer)
   */
  async findAll(includeUnpublished: boolean = false) {
    const where = includeUnpublished ? {} : { publicado: true };

    const comunicados = await this.prisma.comunicado.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        titulo: true,
        contenido: true,
        autor_id: true,
        publicado: true,
        nombre_archivo: true,
        storage_key: true,
        archivo: false, // Nu returnăm conținutul fișierului în listă
        created_at: true,
        updated_at: true,
        leidos: {
          select: {
            user_id: true,
            read_at: true,
          },
        },
      },
    });

    // Obține numele autorilor din DatosEmpleados
    const autorIds = [...new Set(comunicados.map((c) => c.autor_id))];

    if (autorIds.length === 0) {
      return comunicados.map((comunicado) => ({
        ...comunicado,
        autor_nombre: comunicado.autor_id,
      }));
    }

    // Construiește query SQL sigur pentru a obține numele autorilor
    const placeholders = autorIds.map(() => '?').join(',');
    const query = `
      SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
      FROM DatosEmpleados
      WHERE CODIGO IN (${placeholders})
    `;

    const autores = await this.prisma.$queryRawUnsafe<any[]>(
      query,
      ...autorIds,
    );

    const autoresMap = new Map(
      autores.map((a: any) => [a.CODIGO, a.nombre || a.CODIGO]),
    );

    // Adaugă numele autorului la fiecare comunicado
    return comunicados.map((comunicado) => ({
      ...comunicado,
      autor_nombre: autoresMap.get(comunicado.autor_id) || comunicado.autor_id,
    }));
  }

  /**
   * Obține un comunicado specific
   */
  async findOne(id: bigint) {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        contenido: true,
        autor_id: true,
        publicado: true,
        nombre_archivo: true,
        storage_key: true,
        storage_bucket: true,
        tamano_bytes: true,
        created_at: true,
        updated_at: true,
        leidos: {
          select: {
            user_id: true,
            read_at: true,
          },
        },
      },
    });

    if (!comunicado) {
      throw new NotFoundException(`No se encontró el comunicado con id ${id}`);
    }

    // Obține numele autorului
    const autor = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT \`NOMBRE / APELLIDOS\` as nombre FROM DatosEmpleados WHERE CODIGO = ? LIMIT 1`,
      comunicado.autor_id,
    );

    const autorNombre =
      autor.length > 0 && autor[0].nombre
        ? autor[0].nombre
        : comunicado.autor_id;

    // Obține numele utilizatorilor care au citit comunicado-ul
    const userIds = comunicado.leidos.map((l) => l.user_id);
    let leidosConNombres = comunicado.leidos;

    if (userIds.length > 0) {
      // Log pentru debugging
      this.logger.log(
        `🔍 Obțin numele pentru ${userIds.length} utilizatori: ${userIds.join(', ')}`,
      );

      // Construiește query-ul cu parametri siguri
      // Folosim CAST pentru a ne asigura că comparăm string-uri
      const placeholders = userIds.map(() => '?').join(',');
      const query = `
        SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
        FROM DatosEmpleados
        WHERE CAST(CODIGO AS CHAR) IN (${placeholders})
      `;

      this.logger.log(
        `🔍 Execut query: ${query.substring(0, 100)}... cu parametri: ${userIds.join(', ')}`,
      );

      const usuarios = await this.prisma.$queryRawUnsafe<any[]>(
        query,
        ...userIds.map((id) => String(id)),
      );

      this.logger.log(
        `✅ Găsit ${usuarios.length} utilizatori în DB din ${userIds.length} căutați`,
      );
      if (usuarios.length > 0) {
        this.logger.log(
          `📋 Utilizatori găsiți:`,
          usuarios.map(
            (u: any) =>
              `CODIGO: ${u.CODIGO} (${typeof u.CODIGO}), nombre: ${u.nombre}`,
          ),
        );
      }

      // Creează map-ul folosind string pentru ambele chei pentru a evita probleme de tip
      const usuariosMap = new Map<string, string>();
      usuarios.forEach((u: any) => {
        const codigo = String(u.CODIGO).trim();
        const nombre = u.nombre ? String(u.nombre).trim() : codigo;
        usuariosMap.set(codigo, nombre);
        this.logger.log(`🗺️ Adăugat în map: "${codigo}" -> "${nombre}"`);
      });

      leidosConNombres = comunicado.leidos.map((leido) => {
        const userIdStr = String(leido.user_id).trim();
        const userNombre = usuariosMap.get(userIdStr) || userIdStr;
        this.logger.log(
          `📝 Mapare leido: user_id="${leido.user_id}" (${typeof leido.user_id}) -> user_nombre="${userNombre}"`,
        );
        return {
          ...leido,
          user_nombre: userNombre,
        };
      });
    }

    return {
      ...comunicado,
      autor_nombre: autorNombre,
      leidos: leidosConNombres,
    };
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
      archivo?: Buffer | null;
      nombre_archivo?: string | null;
      mime_hint?: string | null;
    },
  ) {
    const publicado = data.publicado ?? false;
    const hasFile = !!(data.archivo && data.archivo.length > 0);
    const useR2 = hasFile && this.comunicadosStorage.isWriteEnabled();

    let comunicado = await this.prisma.comunicado.create({
      data: {
        titulo: data.titulo,
        contenido: data.contenido,
        autor_id: autorId,
        publicado,
        archivo: useR2 ? null : (data.archivo ?? null),
        nombre_archivo: data.nombre_archivo ?? null,
      },
    });

    if (hasFile && useR2) {
      const put = await this.comunicadosStorage.putArchivo(
        data.archivo!,
        comunicado.id,
        data.nombre_archivo || `comunicado_${comunicado.id}`,
        data.mime_hint,
      );
      comunicado = await this.prisma.comunicado.update({
        where: { id: comunicado.id },
        data: {
          storage_key: put.storage_key,
          storage_bucket: put.storage_bucket,
          tamano_bytes: put.tamano_bytes,
          archivo: null,
          nombre_archivo: data.nombre_archivo ?? null,
        },
      });
    }

    // Dacă este publicat, trimite push notification către toți userii
    if (publicado) {
      await this.sendPushNotification(comunicado);
    }

    // Obține numele autorului
    const autor = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT \`NOMBRE / APELLIDOS\` as nombre FROM DatosEmpleados WHERE CODIGO = ? LIMIT 1`,
      comunicado.autor_id,
    );

    const autorNombre =
      autor.length > 0 && autor[0].nombre
        ? autor[0].nombre
        : comunicado.autor_id;

    return {
      ...comunicado,
      archivo: undefined,
      autor_nombre: autorNombre,
    };
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
      archivo?: Buffer | null | undefined;
      nombre_archivo?: string | null | undefined;
      mime_hint?: string | null;
    },
  ) {
    const existing = await this.prisma.comunicado.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`No se encontró el comunicado con id ${id}`);
    }

    const wasPublished = existing.publicado;
    const willBePublished = data.publicado ?? existing.publicado;

    // Construiește obiectul de update
    const updateData: any = {};
    if (data.titulo !== undefined) updateData.titulo = data.titulo;
    if (data.contenido !== undefined) updateData.contenido = data.contenido;
    if (data.publicado !== undefined) updateData.publicado = data.publicado;

    let oldStorageKeyToDelete: string | null = null;

    if (data.archivo !== undefined) {
      if (data.archivo === null) {
        // Ștergere atașament
        oldStorageKeyToDelete = existing.storage_key;
        updateData.archivo = null;
        updateData.nombre_archivo = null;
        updateData.storage_key = null;
        updateData.storage_bucket = null;
        updateData.tamano_bytes = null;
      } else if (data.archivo.length > 0) {
        if (this.comunicadosStorage.isWriteEnabled()) {
          const put = await this.comunicadosStorage.putArchivo(
            data.archivo,
            id,
            data.nombre_archivo ||
              existing.nombre_archivo ||
              `comunicado_${id}`,
            data.mime_hint,
          );
          if (
            existing.storage_key &&
            existing.storage_key !== put.storage_key
          ) {
            oldStorageKeyToDelete = existing.storage_key;
          }
          updateData.storage_key = put.storage_key;
          updateData.storage_bucket = put.storage_bucket;
          updateData.tamano_bytes = put.tamano_bytes;
          updateData.archivo = null;
          if (data.nombre_archivo !== undefined) {
            updateData.nombre_archivo = data.nombre_archivo;
          }
        } else {
          updateData.archivo = data.archivo;
          if (data.nombre_archivo !== undefined) {
            updateData.nombre_archivo = data.nombre_archivo;
          }
        }
      }
    } else if (data.nombre_archivo !== undefined) {
      updateData.nombre_archivo = data.nombre_archivo;
    }

    const comunicado = await this.prisma.comunicado.update({
      where: { id },
      data: updateData,
    });

    if (oldStorageKeyToDelete) {
      await this.comunicadosStorage.deleteObjectIfAny(oldStorageKeyToDelete);
    }

    // Dacă se publică pentru prima dată (nu era publicat înainte), trimite push
    if (!wasPublished && willBePublished) {
      await this.sendPushNotification(comunicado);
    }

    // Obține numele autorului
    const autor = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT \`NOMBRE / APELLIDOS\` as nombre FROM DatosEmpleados WHERE CODIGO = ? LIMIT 1`,
      comunicado.autor_id,
    );

    const autorNombre =
      autor.length > 0 && autor[0].nombre
        ? autor[0].nombre
        : comunicado.autor_id;

    return {
      ...comunicado,
      archivo: undefined,
      autor_nombre: autorNombre,
    };
  }

  /**
   * Numără comunicados necitite pentru un utilizator
   */
  async countUnread(userId: string): Promise<number> {
    // Obține toate comunicados publicate
    const comunicados = await this.prisma.comunicado.findMany({
      where: { publicado: true },
      select: {
        id: true,
        leidos: {
          where: { user_id: userId },
          select: { id: true },
        },
      },
    });

    // Numără comunicados care nu au fost citite de user
    return comunicados.filter((c) => c.leidos.length === 0).length;
  }

  /**
   * Verifică structura tabelului comunicados (debug)
   */
  async getTableStructure() {
    try {
      const columns = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'comunicados'
        ORDER BY ORDINAL_POSITION
      `);

      return {
        success: true,
        table: 'comunicados',
        columns: columns.map((col) => ({
          name: String(col.COLUMN_NAME),
          type: String(col.DATA_TYPE),
          nullable: col.IS_NULLABLE === 'YES',
          default: col.COLUMN_DEFAULT ? String(col.COLUMN_DEFAULT) : null,
          maxLength: col.CHARACTER_MAXIMUM_LENGTH
            ? Number(col.CHARACTER_MAXIMUM_LENGTH)
            : null,
        })),
        nombre_archivo_exists: columns.some(
          (col) => col.COLUMN_NAME === 'nombre_archivo',
        ),
      };
    } catch (error: any) {
      this.logger.error('Error getting table structure:', error);
      throw error;
    }
  }

  /**
   * Adaugă coloanele archivo și nombre_archivo în tabel (debug/fix)
   */
  async addMissingColumns() {
    try {
      // Verifică dacă coloanele există
      const columns = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'comunicados'
        AND COLUMN_NAME IN ('archivo', 'nombre_archivo')
      `);

      const existingColumns = columns.map((col) => col.COLUMN_NAME);
      const toAdd: string[] = [];

      if (!existingColumns.includes('archivo')) {
        toAdd.push('ADD COLUMN archivo LONGBLOB NULL');
      }

      if (!existingColumns.includes('nombre_archivo')) {
        toAdd.push('ADD COLUMN nombre_archivo VARCHAR(255) NULL');
      }

      if (toAdd.length === 0) {
        return {
          success: true,
          message: 'Todas las columnas ya existen',
          columns_added: [],
        };
      }

      // Adaugă coloanele
      const alterQuery = `ALTER TABLE comunicados ${toAdd.join(', ')}`;
      await this.prisma.$executeRawUnsafe(alterQuery);

      return {
        success: true,
        message: 'Columnas añadidas correctamente',
        columns_added: toAdd,
      };
    } catch (error: any) {
      this.logger.error('Error adding columns:', error);
      throw error;
    }
  }

  /**
   * Șterge un comunicado
   */
  async remove(id: bigint) {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      select: {
        id: true,
        storage_key: true,
      },
    });

    if (!comunicado) {
      throw new NotFoundException(`No se encontró el comunicado con id ${id}`);
    }

    await this.prisma.comunicado.delete({
      where: { id },
    });

    await this.comunicadosStorage.deleteObjectIfAny(comunicado.storage_key);

    return { message: 'Comunicado eliminado correctamente' };
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
        `No se encontró el comunicado con id ${comunicadoId}`,
      );
    }

    // Verifică dacă există deja o înregistrare
    const existing = await this.prisma.comunicadoLeido.findFirst({
      where: {
        comunicado_id: comunicadoId,
        user_id: userId,
      },
    });

    if (existing) {
      // Actualizează data de citire
      await this.prisma.comunicadoLeido.update({
        where: { id: existing.id },
        data: { read_at: new Date() },
      });
    } else {
      // Încearcă să creeze o nouă înregistrare
      // Dacă există deja (race condition), facem update
      try {
        await this.prisma.comunicadoLeido.create({
          data: {
            comunicado_id: comunicadoId,
            user_id: userId,
            read_at: new Date(),
          },
        });
      } catch (error: any) {
        // Dacă este eroare de duplicate key (race condition), facem update
        if (
          error.code === 'P2002' ||
          error.message?.includes('Unique constraint') ||
          error.message?.includes('uq_comunicado_leido_comunicado_user')
        ) {
          // Găsește înregistrarea existentă și face update
          const existingRecord = await this.prisma.comunicadoLeido.findFirst({
            where: {
              comunicado_id: comunicadoId,
              user_id: userId,
            },
          });

          if (existingRecord) {
            await this.prisma.comunicadoLeido.update({
              where: { id: existingRecord.id },
              data: { read_at: new Date() },
            });
          }
        } else {
          // Re-aruncă eroarea dacă nu este de duplicate key
          throw error;
        }
      }
    }

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
   * Descarcă fișierul atașat la un comunicado
   */
  async downloadArchivo(id: bigint): Promise<{
    archivo: Buffer;
    tipo_mime: string;
    nombre_archivo: string;
  }> {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      select: {
        archivo: true,
        nombre_archivo: true,
        storage_key: true,
      },
    });

    if (!comunicado) {
      throw new NotFoundException(`No se encontró el comunicado con id ${id}`);
    }

    const archivoBuffer = await this.comunicadosStorage.resolveArchivo({
      archivo: comunicado.archivo,
      storage_key: comunicado.storage_key,
    });

    // Detectăm tipul MIME din extensie sau din magic bytes
    const nombreArchivo = comunicado.nombre_archivo || `comunicado_${id}.bin`;
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';

    // Detectăm tipul MIME din magic bytes
    let mimeType = 'application/octet-stream';
    const firstBytes = archivoBuffer.slice(0, 10);
    const firstBytesHex = firstBytes.toString('hex');
    const firstBytesAscii = firstBytes.toString('ascii');

    if (firstBytesAscii.startsWith('%PDF-')) {
      mimeType = 'application/pdf';
    } else if (firstBytesHex.startsWith('89504e47')) {
      mimeType = 'image/png';
    } else if (firstBytesHex.startsWith('ffd8ff')) {
      mimeType = 'image/jpeg';
    } else if (firstBytesHex.startsWith('47494638')) {
      mimeType = 'image/gif';
    } else if (firstBytesHex.startsWith('52494646')) {
      mimeType = 'image/webp';
    } else {
      // Fallback la extensie
      const mimeTypes: { [key: string]: string } = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        txt: 'text/plain',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      mimeType = mimeTypes[extension] || 'application/octet-stream';
    }

    return {
      archivo: archivoBuffer,
      tipo_mime: mimeType,
      nombre_archivo: nombreArchivo,
    };
  }

  /**
   * Trimite push notification către toți userii când se publică un comunicado
   */
  async sendPushNotification(comunicado: {
    id: bigint;
    titulo: string;
    contenido: string;
  }): Promise<{ total: number; sent: number; failed: number } | null> {
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

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Eroare la trimiterea push notification pentru comunicado ${comunicado.id}:`,
        error,
      );
      // Nu aruncăm eroare - comunicado-ul a fost deja salvat
      return null;
    }
  }

  /**
   * Retrimite push notification pentru un comunicado existent (reanunțare)
   */
  async resendPushNotification(id: bigint) {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        contenido: true,
        publicado: true,
      },
    });

    if (!comunicado) {
      throw new NotFoundException(
        `No se encontró el comunicado con id ${id} para reenviar notificación`,
      );
    }

    if (!comunicado.publicado) {
      throw new BadRequestException(
        'Nu se poate trimite notificare pentru un comunicado care nu este publicat.',
      );
    }

    this.logger.log(
      `🔁 Retrimit push notification pentru comunicado ${comunicado.id}`,
    );

    const pushResult = await this.sendPushNotification(comunicado);

    return {
      comunicado: {
        id: Number(comunicado.id),
        titulo: comunicado.titulo,
        contenido: comunicado.contenido,
      },
      pushResult,
    };
  }
}
