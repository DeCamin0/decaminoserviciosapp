import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FestivosService } from '../services/festivos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/festivos')
@UseGuards(JwtAuthGuard)
export class FestivosController {
  private readonly logger = new Logger(FestivosController.name);

  constructor(private readonly festivosService: FestivosService) {}

  /**
   * Endpoint principal pentru gestionarea zilelor festive
   * Suportă acțiuni: get, nueva fiesta, edit, delete
   * Compatibil cu formatul n8n (query params) - acceptă și GET pentru create/edit pentru compatibilitate
   */
  @Get()
  async handleFestivos(@Query() query: any) {
    try {
      const accion = query.accion;

      if (!accion) {
        throw new BadRequestException('accion parameter is required');
      }

      this.logger.log(`📋 Festivos GET request - accion: ${accion}`);

      // GET - Listare zile festive pentru un an
      if (accion === 'get') {
        const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
        
        if (isNaN(year)) {
          throw new BadRequestException('year must be a valid number');
        }

        const festivos = await this.festivosService.getFestivos(year);
        return festivos;
      }

      // CREATE - Creare zi festivă nouă (acceptă și GET pentru compatibilitate cu n8n)
      if (accion === 'nueva fiesta') {
        const data = {
          fecha: query.fecha,
          nombre: query.nombre,
          scope: query.scope,
          ccaa: query.ccaa,
          observed_date: query.observed_date || query.observedDate,
          active: query.active !== undefined 
            ? (query.active === '1' || query.active === 1 || query.active === true)
            : 1,
          notes: query.notes,
        };

        if (!data.fecha || !data.nombre || !data.scope) {
          throw new BadRequestException('fecha, nombre, and scope are required');
        }

        const result = await this.festivosService.createFestivo(data);
        // Returnează ca array pentru compatibilitate cu n8n
        return [result];
      }

      // UPDATE - Editare zi festivă (acceptă și GET pentru compatibilitate cu n8n)
      if (accion === 'edit') {
        const id = query.id;
        
        if (!id) {
          throw new BadRequestException('id is required for edit');
        }

        const data = {
          id: parseInt(String(id), 10),
          fecha: query.fecha,
          nombre: query.nombre,
          scope: query.scope,
          notes: query.notes,
          active: query.active !== undefined
            ? (query.active === '1' || query.active === 1 || query.active === true)
            : undefined,
        };

        const result = await this.festivosService.updateFestivo(data);
        // Returnează ca array pentru compatibilitate cu n8n
        return [result];
      }

      // DELETE - Ștergere zi festivă
      if (accion === 'delete') {
        const id = query.id ? parseInt(query.id, 10) : null;
        
        if (!id || isNaN(id)) {
          throw new BadRequestException('id is required and must be a valid number');
        }

        const result = await this.festivosService.deleteFestivo(id);
        // Returnează ca array pentru compatibilitate cu n8n
        return [result];
      }

      throw new BadRequestException(`Invalid accion '${accion}'`);
    } catch (error: any) {
      this.logger.error('❌ Error in handleFestivos:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error processing festivos request: ${error.message}`,
      );
    }
  }

  /**
   * POST endpoint pentru creare și editare zile festive
   * Compatibil cu formatul n8n (query params)
   */
  @Post()
  async handleFestivosPost(@Query() query: any, @Body() body: any) {
    try {
      const accion = query.accion || body.accion;

      if (!accion) {
        throw new BadRequestException('accion parameter is required');
      }

      this.logger.log(`📋 Festivos POST request - accion: ${accion}`);

      // CREATE - Creare zi festivă nouă
      if (accion === 'nueva fiesta') {
        const data = {
          fecha: query.fecha || body.fecha,
          nombre: query.nombre || body.nombre,
          scope: query.scope || body.scope,
          ccaa: query.ccaa || body.ccaa,
          observed_date: query.observed_date || body.observed_date,
          active: query.active !== undefined 
            ? (query.active === '1' || query.active === 1 || query.active === true)
            : (body.active !== undefined 
                ? (body.active === '1' || body.active === 1 || body.active === true)
                : 1),
          notes: query.notes || body.notes,
        };

        if (!data.fecha || !data.nombre || !data.scope) {
          throw new BadRequestException('fecha, nombre, and scope are required');
        }

        const result = await this.festivosService.createFestivo(data);
        // Returnează ca array pentru compatibilitate cu n8n
        return [result];
      }

      // UPDATE - Editare zi festivă
      if (accion === 'edit') {
        const id = query.id || body.id;
        
        if (!id) {
          throw new BadRequestException('id is required for edit');
        }

        const data = {
          id: parseInt(String(id), 10),
          fecha: query.fecha || body.fecha,
          nombre: query.nombre || body.nombre,
          scope: query.scope || body.scope,
          notes: query.notes || body.notes,
          active: query.active !== undefined
            ? (query.active === '1' || query.active === 1 || query.active === true)
            : (body.active !== undefined
                ? (body.active === '1' || body.active === 1 || body.active === true)
                : undefined),
        };

        const result = await this.festivosService.updateFestivo(data);
        // Returnează ca array pentru compatibilitate cu n8n
        return [result];
      }

      throw new BadRequestException(
        `Invalid accion '${accion}'. Use 'nueva fiesta' or 'edit' for POST requests.`,
      );
    } catch (error: any) {
      this.logger.error('❌ Error in handleFestivosPost:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error processing festivos POST request: ${error.message}`,
      );
    }
  }
}

