import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { CatalogoService } from '../services/catalogo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/catalogo')
export class CatalogoController {
  private readonly logger = new Logger(CatalogoController.name);

  constructor(private readonly catalogoService: CatalogoService) {}

  @Get()
  async getCatalogo(
    @Query('cliente_id') clienteId?: string,
    @Query('cliente_nombre') clienteNombre?: string,
  ) {
    // Dacă există cliente_id, returnează produsele cu permisiunile pentru comunitate
    if (clienteId) {
      const clienteIdNum = parseInt(clienteId, 10);
      if (isNaN(clienteIdNum)) {
        throw new Error('Invalid cliente_id parameter');
      }

      this.logger.log(
        `📦 GET /api/catalogo?cliente_id=${clienteId} - Fetching catalog with permisos`,
      );
      try {
        const productos = await this.catalogoService.getCatalogoConPermisos(
          clienteIdNum,
          clienteNombre,
        );
        this.logger.log(
          `✅ Returning ${productos.length} products with permisos`,
        );
        return productos;
      } catch (error: any) {
        this.logger.error('❌ Error in getCatalogo con permisos:', error);
        throw error;
      }
    }

    // Altfel, returnează toate produsele fără permisiuni
    this.logger.log('📦 GET /api/catalogo - Fetching catalog products');
    try {
      const productos = await this.catalogoService.getCatalogo();
      this.logger.log(`✅ Returning ${productos.length} products`);
      return productos;
    } catch (error: any) {
      this.logger.error('❌ Error in getCatalogo:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async addOrUpdateOrDeleteProducto(@Body() body: any) {
    // Verifică acțiunea: 'edit', 'delete' sau implicit 'add'
    if (body.accion === 'edit') {
      this.logger.log(
        `📦 POST /api/catalogo - Updating product ID: ${body.id || 'N/A'}`,
      );
      return this.catalogoService.updateProducto(body);
    } else if (body.accion === 'delete') {
      this.logger.log(
        `📦 POST /api/catalogo - Deleting product ID: ${body.id || 'N/A'}`,
      );
      return this.catalogoService.deleteProducto(body.id);
    } else {
      // Implicit: add
      this.logger.log(
        `📦 POST /api/catalogo - Adding new product: ${body['Número de artículo'] || 'N/A'}`,
      );
      return this.catalogoService.addProducto(body);
    }
  }

  @Post('permisos')
  @UseGuards(JwtAuthGuard)
  async savePermisos(@Body() body: any) {
    this.logger.log(
      `📦 POST /api/catalogo/permisos - Saving permisos for comunidad: ${body.comunidad_id || 'N/A'}`,
    );
    return this.catalogoService.savePermisos(body);
  }
}
