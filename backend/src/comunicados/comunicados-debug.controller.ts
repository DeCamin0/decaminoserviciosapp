import { Controller, Get, Post } from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';

@Controller('api/comunicados')
export class ComunicadosDebugController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  /**
   * GET /api/comunicados/debug/table-structure
   * Endpoint temporar pentru a verifica structura tabelului (fără auth)
   */
  @Get('debug/table-structure')
  async getTableStructure() {
    return await this.comunicadosService.getTableStructure();
  }

  /**
   * POST /api/comunicados/debug/add-columns
   * Endpoint temporar pentru a adăuga coloanele lipsă (fără auth)
   */
  @Post('debug/add-columns')
  async addColumns() {
    return await this.comunicadosService.addMissingColumns();
  }
}
