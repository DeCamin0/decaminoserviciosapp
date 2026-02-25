import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlantillaCompleta {
  id: number;
  nombre: string;
  descripcion_operativa: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePlantillaDto {
  nombre: string;
  descripcion_operativa?: string;
  activo?: boolean;
}

export interface UpdatePlantillaDto {
  nombre?: string;
  descripcion_operativa?: string;
  activo?: boolean;
}

@Injectable()
export class PlantillasService {
  private readonly logger = new Logger(PlantillasService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPlantillas(): Promise<PlantillaCompleta[]> {
    try {
      const plantillas = await this.prisma.plantillas_presupuesto.findMany({
        where: {},
        orderBy: {
          id: 'asc',
        },
      });

      return plantillas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion_operativa: p.descripcion_operativa,
        activo: p.activo,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
    } catch (error) {
      this.logger.error('❌ Error fetching plantillas:', error);
      throw new BadRequestException('Error al obtener plantillas');
    }
  }

  async getPlantillaById(id: number): Promise<PlantillaCompleta> {
    try {
      const plantilla = await this.prisma.plantillas_presupuesto.findUnique({
        where: { id },
      });

      if (!plantilla) {
        throw new NotFoundException(`Plantilla con id ${id} no encontrada`);
      }

      return {
        id: plantilla.id,
        nombre: plantilla.nombre,
        descripcion_operativa: plantilla.descripcion_operativa,
        activo: plantilla.activo,
        created_at: plantilla.created_at,
        updated_at: plantilla.updated_at,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ Error fetching plantilla ${id}:`, error);
      throw new BadRequestException(`Error al obtener plantilla ${id}`);
    }
  }

  async createPlantilla(dto: CreatePlantillaDto): Promise<PlantillaCompleta> {
    try {
      this.logger.log(`📝 Create plantilla request: ${dto.nombre}`);

      if (!dto.nombre || !dto.nombre.trim()) {
        throw new BadRequestException('El nombre de la plantilla es requerido');
      }

      const plantilla = await this.prisma.plantillas_presupuesto.create({
        data: {
          nombre: dto.nombre.trim(),
          descripcion_operativa: dto.descripcion_operativa || null,
          activo: dto.activo !== undefined ? dto.activo : true,
        },
      });

      this.logger.log(
        `✅ Plantilla creada: ${plantilla.id} - ${plantilla.nombre}`,
      );

      return {
        id: plantilla.id,
        nombre: plantilla.nombre,
        descripcion_operativa: plantilla.descripcion_operativa,
        activo: plantilla.activo,
        created_at: plantilla.created_at,
        updated_at: plantilla.updated_at,
      };
    } catch (error) {
      this.logger.error('❌ Error creating plantilla:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear plantilla: ${error.message}`,
      );
    }
  }

  async updatePlantilla(
    id: number,
    dto: UpdatePlantillaDto,
  ): Promise<PlantillaCompleta> {
    try {
      this.logger.log(`📝 Update plantilla request: ${id}`);

      // Verifică dacă plantilla există
      const existing = await this.prisma.plantillas_presupuesto.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Plantilla con id ${id} no encontrada`);
      }

      const updateData: any = {};
      if (dto.nombre !== undefined) {
        if (!dto.nombre.trim()) {
          throw new BadRequestException(
            'El nombre de la plantilla no puede estar vacío',
          );
        }
        updateData.nombre = dto.nombre.trim();
      }
      if (dto.descripcion_operativa !== undefined) {
        updateData.descripcion_operativa = dto.descripcion_operativa || null;
      }
      if (dto.activo !== undefined) {
        updateData.activo = dto.activo;
      }

      const plantilla = await this.prisma.plantillas_presupuesto.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(
        `✅ Plantilla actualizada: ${plantilla.id} - ${plantilla.nombre}`,
      );

      return {
        id: plantilla.id,
        nombre: plantilla.nombre,
        descripcion_operativa: plantilla.descripcion_operativa,
        activo: plantilla.activo,
        created_at: plantilla.created_at,
        updated_at: plantilla.updated_at,
      };
    } catch (error) {
      this.logger.error(`❌ Error updating plantilla ${id}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar plantilla: ${error.message}`,
      );
    }
  }

  async deletePlantilla(id: number): Promise<void> {
    try {
      this.logger.log(`📝 Delete plantilla request: ${id}`);

      const existing = await this.prisma.plantillas_presupuesto.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Plantilla con id ${id} no encontrada`);
      }

      await this.prisma.plantillas_presupuesto.delete({
        where: { id },
      });

      this.logger.log(`✅ Plantilla eliminada: ${id}`);
    } catch (error) {
      this.logger.error(`❌ Error deleting plantilla ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar plantilla: ${error.message}`,
      );
    }
  }
}
