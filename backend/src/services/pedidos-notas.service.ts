import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PedidosNotasService {
  private readonly logger = new Logger(PedidosNotasService.name);
  private readonly uploadsDir = path.join(
    process.cwd(),
    'uploads',
    'pedidos-notas',
  );

  constructor(private readonly prisma: PrismaService) {
    // Creează directorul pentru upload-uri dacă nu există
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`📁 Created uploads directory: ${this.uploadsDir}`);
    }
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

      this.logger.log(`✅ Retrieved ${notas.length} notas`);
      return notas;
    } catch (error: any) {
      this.logger.error('❌ Error getting notas:', error);
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

      return nota;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ Error getting nota ${id}:`, error);
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

      this.logger.log(`✅ Created nota with id=${nota.id}`);
      return nota;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('❌ Error creating nota:', error);
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
      // Verifică dacă nota există
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

      this.logger.log(`✅ Updated nota with id=${id}`);
      return nota;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`❌ Error updating nota ${id}:`, error);
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

      // Șterge pozele fizice
      for (const imagen of existingNota.imagenes) {
        await this.deleteImagenFile(imagen.ruta_archivo);
      }

      // Soft delete - setează activo = false
      await this.prisma.pedidosNotas.update({
        where: { id },
        data: { activo: false },
      });

      this.logger.log(`✅ Deleted (soft) nota with id=${id}`);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ Error deleting nota ${id}:`, error);
      throw new BadRequestException(`Error al eliminar nota: ${error.message}`);
    }
  }

  /**
   * Adaugă poze la o notă
   */
  async addImagenesToNota(
    notaId: number,
    files: Express.Multer.File[],
  ): Promise<any[]> {
    try {
      // Verifică dacă nota există
      const nota = await this.prisma.pedidosNotas.findUnique({
        where: { id: notaId },
        include: {
          imagenes: true,
        },
      });

      if (!nota) {
        throw new NotFoundException(`Nota con id=${notaId} no encontrada`);
      }

      const imagenesCreadas = [];

      for (const file of files) {
        // Generează nume unic pentru fișier
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const extension = path.extname(file.originalname);
        const fileName = `${timestamp}_${randomStr}${extension}`;
        const filePath = path.join(this.uploadsDir, fileName);

        // Salvează fișierul
        fs.writeFileSync(filePath, file.buffer);

        // Obține următorul ordin
        const maxOrden =
          nota.imagenes.length > 0
            ? Math.max(...nota.imagenes.map((img) => img.orden))
            : -1;

        // Salvează în baza de date
        const imagen = await this.prisma.pedidosNotasImagen.create({
          data: {
            nota_id: notaId,
            nombre_archivo: file.originalname,
            ruta_archivo: `/uploads/pedidos-notas/${fileName}`,
            tipo_mime: file.mimetype || null,
            tamano_bytes: file.size || null,
            orden: maxOrden + 1,
          },
        });

        imagenesCreadas.push(imagen);
        this.logger.log(
          `✅ Added imagen ${imagen.id} to nota ${notaId}: ${file.originalname}`,
        );
      }

      return imagenesCreadas;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ Error adding imagenes to nota ${notaId}:`, error);
      throw new BadRequestException(
        `Error al agregar imágenes: ${error.message}`,
      );
    }
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

      // Șterge fișierul fizic
      await this.deleteImagenFile(imagen.ruta_archivo);

      // Șterge din baza de date
      await this.prisma.pedidosNotasImagen.delete({
        where: { id: imagenId },
      });

      this.logger.log(`✅ Deleted imagen ${imagenId}`);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ Error deleting imagen ${imagenId}:`, error);
      throw new BadRequestException(
        `Error al eliminar imagen: ${error.message}`,
      );
    }
  }

  /**
   * Șterge fișierul fizic al unei imagini
   */
  private async deleteImagenFile(rutaArchivo: string): Promise<void> {
    try {
      // Extrage numele fișierului din ruta
      const fileName = path.basename(rutaArchivo);
      const filePath = path.join(this.uploadsDir, fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`🗑️ Deleted file: ${filePath}`);
      }
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error deleting file ${rutaArchivo}: ${error.message}`,
      );
      // Nu aruncăm eroare - fișierul poate să nu existe deja
    }
  }
}
