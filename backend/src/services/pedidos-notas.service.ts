import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PedidosNotasStorageService } from './pedidos-notas-storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PedidosNotasService {
  private readonly logger = new Logger(PedidosNotasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidosNotasStorage: PedidosNotasStorageService,
  ) {
    const uploadsDir = this.pedidosNotasStorage.getUploadsDir();
    if (
      !this.pedidosNotasStorage.isWriteEnabled() &&
      !fs.existsSync(uploadsDir)
    ) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${uploadsDir}`);
    }
  }

  private imagenDownloadUrl(imagenId: number): string {
    return `/api/pedidos-notas/imagenes/${imagenId}/archivo`;
  }

  private mapImagen(imagen: any) {
    return {
      ...imagen,
      url_archivo: this.imagenDownloadUrl(imagen.id),
    };
  }

  private mapNota(nota: any) {
    if (!nota) return nota;
    return {
      ...nota,
      imagenes: Array.isArray(nota.imagenes)
        ? nota.imagenes.map((img: any) => this.mapImagen(img))
        : nota.imagenes,
    };
  }

  /**
   * Obține toate notele active
   */
  async getAllNotas(): Promise<any[]> {
    try {
      const notas = await this.prisma.pedidosNotas.findMany({
        where: {
          activo: true,
        },
        include: {
          imagenes: {
            orderBy: {
              orden: 'asc',
            },
          },
        },
        orderBy: {
          creado_en: 'desc',
        },
      });

      this.logger.log(`Retrieved ${notas.length} notas`);
      return notas.map((n) => this.mapNota(n));
    } catch (error: any) {
      this.logger.error('Error getting notas:', error);
      throw new BadRequestException(`Error al obtener notas: ${error.message}`);
    }
  }

  /**
   * Obține o notă specifică cu poze
   */
  async getNotaById(id: number): Promise<any> {
    try {
      const nota = await this.prisma.pedidosNotas.findUnique({
        where: { id },
        include: {
          imagenes: {
            orderBy: {
              orden: 'asc',
            },
          },
        },
      });

      if (!nota) {
        throw new NotFoundException(`Nota con id=${id} no encontrada`);
      }

      return this.mapNota(nota);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error getting nota ${id}:`, error);
      throw new BadRequestException(`Error al obtener nota: ${error.message}`);
    }
  }

  /**
   * Creează o notă nouă
   */
  async createNota(data: {
    titulo?: string;
    contenido: string;
    creado_por?: string;
  }): Promise<any> {
    try {
      if (!data.contenido || !data.contenido.trim()) {
        throw new BadRequestException('El campo "contenido" es requerido');
      }

      const nota = await this.prisma.pedidosNotas.create({
        data: {
          titulo: data.titulo?.trim() || null,
          contenido: data.contenido.trim(),
          creado_por: data.creado_por || null,
        },
        include: {
          imagenes: true,
        },
      });

      this.logger.log(`Created nota with id=${nota.id}`);
      return this.mapNota(nota);
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating nota:', error);
      throw new BadRequestException(`Error al crear nota: ${error.message}`);
    }
  }

  /**
   * Actualizează o notă existentă
   */
  async updateNota(
    id: number,
    data: {
      titulo?: string;
      contenido?: string;
    },
  ): Promise<any> {
    try {
      const existingNota = await this.prisma.pedidosNotas.findUnique({
        where: { id },
      });

      if (!existingNota) {
        throw new NotFoundException(`Nota con id=${id} no encontrada`);
      }

      const updateData: any = {};
      if (data.titulo !== undefined) {
        updateData.titulo = data.titulo?.trim() || null;
      }
      if (data.contenido !== undefined) {
        if (!data.contenido || !data.contenido.trim()) {
          throw new BadRequestException(
            'El campo "contenido" no puede estar vacío',
          );
        }
        updateData.contenido = data.contenido.trim();
      }

      const nota = await this.prisma.pedidosNotas.update({
        where: { id },
        data: updateData,
        include: {
          imagenes: {
            orderBy: {
              orden: 'asc',
            },
          },
        },
      });

      this.logger.log(`Updated nota with id=${id}`);
      return this.mapNota(nota);
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Error updating nota ${id}:`, error);
      throw new BadRequestException(
        `Error al actualizar nota: ${error.message}`,
      );
    }
  }

  /**
   * Șterge o notă (soft delete)
   */
  async deleteNota(id: number): Promise<void> {
    try {
      const existingNota = await this.prisma.pedidosNotas.findUnique({
        where: { id },
        include: {
          imagenes: true,
        },
      });

      if (!existingNota) {
        throw new NotFoundException(`Nota con id=${id} no encontrada`);
      }

      for (const imagen of existingNota.imagenes) {
        await this.pedidosNotasStorage.deleteObjectIfAny(imagen.storage_key);
        this.pedidosNotasStorage.deleteDiskFileIfAny(imagen.ruta_archivo);
      }

      await this.prisma.pedidosNotas.update({
        where: { id },
        data: { activo: false },
      });

      this.logger.log(`Deleted (soft) nota with id=${id}`);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting nota ${id}:`, error);
      throw new BadRequestException(`Error al eliminar nota: ${error.message}`);
    }
  }

  /**
   * Adaugă poze la o notă — R2 when enabled, otherwise disk.
   */
  async addImagenesToNota(
    notaId: number,
    files: Express.Multer.File[],
  ): Promise<any[]> {
    try {
      const nota = await this.prisma.pedidosNotas.findUnique({
        where: { id: notaId },
        include: {
          imagenes: true,
        },
      });

      if (!nota) {
        throw new NotFoundException(`Nota con id=${notaId} no encontrada`);
      }

      const useR2 = this.pedidosNotasStorage.isWriteEnabled();
      const imagenesCreadas = [];
      let nextOrden =
        nota.imagenes.length > 0
          ? Math.max(...nota.imagenes.map((img) => img.orden)) + 1
          : 0;

      for (const file of files) {
        let storageKey: string | null = null;
        let storageBucket: string | null = null;
        let rutaArchivo: string | null = null;
        const tamanoBytes = file.size || file.buffer?.length || null;

        if (useR2) {
          const put = await this.pedidosNotasStorage.putImagen(
            file.buffer,
            notaId,
            file.originalname,
            file.mimetype,
          );
          storageKey = put.storage_key;
          storageBucket = put.storage_bucket;
        } else {
          const uploadsDir = this.pedidosNotasStorage.getUploadsDir();
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 15);
          const extension = path.extname(file.originalname);
          const fileName = `${timestamp}_${randomStr}${extension}`;
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, file.buffer);
          rutaArchivo = `/uploads/pedidos-notas/${fileName}`;
        }

        const imagen = await this.prisma.pedidosNotasImagen.create({
          data: {
            nota_id: notaId,
            nombre_archivo: file.originalname,
            ruta_archivo: rutaArchivo,
            tipo_mime: file.mimetype || null,
            tamano_bytes: tamanoBytes,
            orden: nextOrden,
            storage_key: storageKey,
            storage_bucket: storageBucket,
          },
        });

        nextOrden += 1;
        imagenesCreadas.push(this.mapImagen(imagen));
        this.logger.log(
          `Added imagen ${imagen.id} to nota ${notaId}: ${file.originalname} (${useR2 ? 'R2' : 'disk'})`,
        );
      }

      return imagenesCreadas;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error adding imagenes to nota ${notaId}:`, error);
      throw new BadRequestException(
        `Error al agregar imágenes: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă / streamează o imagine (R2 sau disk fallback).
   */
  async getImagenArchivo(imagenId: number): Promise<{
    buffer: Buffer;
    contentType: string;
    nombre_archivo: string;
  }> {
    const imagen = await this.prisma.pedidosNotasImagen.findUnique({
      where: { id: imagenId },
    });

    if (!imagen) {
      throw new NotFoundException(`Imagen con id=${imagenId} no encontrada`);
    }

    this.pedidosNotasStorage.assertHasReadableSource(imagen);
    const resolved = await this.pedidosNotasStorage.resolveArchivo({
      storage_key: imagen.storage_key,
      ruta_archivo: imagen.ruta_archivo,
      tipo_mime: imagen.tipo_mime,
      nombre_archivo: imagen.nombre_archivo,
    });

    return {
      buffer: resolved.buffer,
      contentType: resolved.contentType,
      nombre_archivo: imagen.nombre_archivo,
    };
  }

  /**
   * Șterge o poză
   */
  async deleteImagen(imagenId: number): Promise<void> {
    try {
      const imagen = await this.prisma.pedidosNotasImagen.findUnique({
        where: { id: imagenId },
      });

      if (!imagen) {
        throw new NotFoundException(`Imagen con id=${imagenId} no encontrada`);
      }

      await this.pedidosNotasStorage.deleteObjectIfAny(imagen.storage_key);
      this.pedidosNotasStorage.deleteDiskFileIfAny(imagen.ruta_archivo);

      await this.prisma.pedidosNotasImagen.delete({
        where: { id: imagenId },
      });

      this.logger.log(`Deleted imagen ${imagenId}`);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting imagen ${imagenId}:`, error);
      throw new BadRequestException(
        `Error al eliminar imagen: ${error.message}`,
      );
    }
  }
}
