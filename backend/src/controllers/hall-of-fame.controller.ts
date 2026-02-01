import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { HallOfFameService } from '../services/hall-of-fame.service';

@Controller('api/hall-of-fame')
@UseGuards(JwtAuthGuard)
export class HallOfFameController {
  private readonly logger = new Logger(HallOfFameController.name);

  constructor(private readonly hallOfFameService: HallOfFameService) {}

  /**
   * GET /api/hall-of-fame?mes=YYYY-MM&limit=10
   * Returnează clasamentul pentru o lună
   */
  @Get()
  async getRanking(@Query('mes') mes?: string, @Query('limit') limit?: string) {
    // Default: luna curentă
    if (!mes) {
      const now = new Date();
      mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const limitNum = limit ? parseInt(limit, 10) : 100;
    // limit=0 înseamnă "toți" (fără limită)
    if (isNaN(limitNum) || limitNum < 0 || limitNum > 500) {
      throw new BadRequestException('limit must be between 0 (all) and 500');
    }

    try {
      const ranking = await this.hallOfFameService.getRanking(mes, limitNum);
      return {
        success: true,
        mes: mes,
        ranking: ranking,
        total: ranking.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting ranking for ${mes}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Error getting ranking: ${error.message}`);
    }
  }

  /**
   * GET /api/hall-of-fame/premios
   * Returnează lista de premii date (permiso retribuido ca premiu)
   * IMPORTANT: Această rută trebuie să fie ÎNAINTE de @Get(':codigo') pentru a evita conflictele
   */
  @Get('premios')
  async getPremios() {
    try {
      const premios = await this.hallOfFameService.getPremios();
      return {
        success: true,
        premios: premios,
        total: premios.length,
      };
    } catch (error) {
      this.logger.error(`Error getting premios: ${error.message}`, error.stack);
      throw new BadRequestException(`Error getting premios: ${error.message}`);
    }
  }

  /**
   * GET /api/hall-of-fame/:codigo?mes=YYYY-MM
   * Returnează breakdown-ul pentru un angajat specific
   */
  @Get(':codigo')
  async getEmployeeBreakdown(
    @Param('codigo') codigo: string,
    @Query('mes') mes?: string,
  ) {
    if (!codigo) {
      throw new BadRequestException('codigo is required');
    }

    // Default: luna curentă
    if (!mes) {
      const now = new Date();
      mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    try {
      const breakdown = await this.hallOfFameService.getEmployeeBreakdown(
        codigo,
        mes,
      );

      if (!breakdown) {
        return {
          success: false,
          message: 'No data found for this employee and month',
          codigo: codigo,
          mes: mes,
        };
      }

      return {
        success: true,
        mes: mes,
        data: breakdown,
      };
    } catch (error) {
      this.logger.error(
        `Error getting breakdown for ${codigo}/${mes}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error getting breakdown: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/hall-of-fame/calculate/employee/:codigo?mes=YYYY-MM
   * Calculează și salvează scorul pentru un singur angajat (doar manageri/admini/developeri)
   */
  @Post('calculate/employee/:codigo')
  async calculateEmployeeScore(
    @Param('codigo') codigo: string,
    @Query('mes') mes?: string,
    @CurrentUser() user?: any,
  ) {
    // Verifică permisiuni
    const grupo = user?.GRUPO || user?.grupo || '';
    const isManager = user?.isManager || false;
    const canCalculate =
      isManager ||
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!canCalculate) {
      throw new ForbiddenException(
        'No tienes permisos para calcular scores. Solo los administradores y managers pueden hacerlo.',
      );
    }

    if (!codigo) {
      throw new BadRequestException('codigo is required');
    }

    // Default: luna curentă
    if (!mes) {
      const now = new Date();
      mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    try {
      const result = await this.hallOfFameService.calculateEmployeeScore(
        codigo,
        mes,
      );
      return {
        success: result.success,
        mes: mes,
        codigo: codigo,
        processed: result.processed,
        message: `Calculated score for employee ${codigo} for ${mes}`,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating score for ${codigo}/${mes}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error calculating score: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/hall-of-fame/calculate?mes=YYYY-MM
   * Calculează și salvează scorurile pentru o lună (doar manageri/admini/developeri)
   */
  @Post('calculate')
  async calculateScores(@Query('mes') mes?: string, @CurrentUser() user?: any) {
    // Verifică permisiuni - doar manageri/admini/developeri pot calcula scoruri
    const grupo = user?.GRUPO || user?.grupo || '';
    const isManager = user?.isManager || false;
    const canCalculate =
      isManager ||
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!canCalculate) {
      throw new ForbiddenException(
        'No tienes permisos para calcular scores. Solo los administradores y managers pueden hacerlo.',
      );
    }

    // Default: luna curentă
    if (!mes) {
      const now = new Date();
      mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    try {
      const result = await this.hallOfFameService.calculateMonthlyScores(mes);
      return {
        success: result.success,
        mes: mes,
        processed: result.processed,
        message: `Calculated ${result.processed} scores for ${mes}`,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating scores for ${mes}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error calculating scores: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/hall-of-fame/latest-month
   * Returnează ultima lună disponibilă (cea mai recentă cu date)
   */
  @Get('latest-month')
  async getLatestMonth() {
    try {
      const latestMonth = await this.hallOfFameService.getLatestMonth();
      return {
        success: true,
        mes: latestMonth,
      };
    } catch (error) {
      this.logger.error(
        `Error getting latest month: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error getting latest month: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/hall-of-fame/debug/cuadrante/:codigo?mes=YYYY-MM
   * Debug endpoint pentru a vedea exact cum se calculează cuadrante pentru un angajat
   * Public endpoint - nu necesită autentificare (doar pentru debug)
   */
  @Public()
  @Get('debug/cuadrante/:codigo')
  async debugCuadrante(
    @Param('codigo') codigo: string,
    @Query('mes') mes?: string,
  ) {
    if (!codigo) {
      throw new BadRequestException('codigo is required');
    }

    // Default: luna curentă
    if (!mes) {
      const now = new Date();
      mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    try {
      const debug = await this.hallOfFameService.debugCuadranteCalculation(
        codigo,
        mes,
      );
      return {
        success: true,
        mes: mes,
        codigo: codigo,
        debug: debug,
      };
    } catch (error) {
      this.logger.error(
        `Error debugging cuadrante for ${codigo}/${mes}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error debugging cuadrante: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/hall-of-fame/trimestral?trimestre=Q1-2026&limit=10
   * Returnează clasamentul trimestrial pentru un trimestru
   */
  @Get('trimestral')
  async getRankingTrimestral(
    @Query('trimestre') trimestre?: string,
    @Query('limit') limit?: string,
  ) {
    // Default: trimestrul curent
    if (!trimestre) {
      const now = new Date();
      const ano = now.getFullYear();
      const month = now.getMonth() + 1; // 1-12
      const trimestreNum = Math.ceil(month / 3); // 1-4
      trimestre = `Q${trimestreNum}-${ano}`;
    }

    const limitNum = limit ? parseInt(limit, 10) : 100;
    if (isNaN(limitNum) || limitNum < 0 || limitNum > 500) {
      throw new BadRequestException('limit must be between 0 (all) and 500');
    }

    try {
      const ranking = await this.hallOfFameService.getRankingTrimestral(
        trimestre,
        limitNum,
      );
      return {
        success: true,
        trimestre: trimestre,
        ranking: ranking,
        total: ranking.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting trimestral ranking for ${trimestre}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error getting trimestral ranking: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/hall-of-fame/trimestral/calculate?trimestre=Q1-2026
   * Calculează și salvează scorurile trimestriale pentru un trimestru (doar manageri/admini/developeri)
   */
  @Post('trimestral/calculate')
  async calculateTrimestralScores(
    @Query('trimestre') trimestre?: string,
    @CurrentUser() user?: any,
  ) {
    // Verifică permisiuni
    const grupo = user?.GRUPO || user?.grupo || '';
    const isManager = user?.isManager || false;
    const canCalculate =
      isManager ||
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!canCalculate) {
      throw new ForbiddenException(
        'No tienes permisos para calcular scores trimestrales. Solo los administradores y managers pueden hacerlo.',
      );
    }

    // Default: trimestrul curent
    if (!trimestre) {
      const now = new Date();
      const ano = now.getFullYear();
      const month = now.getMonth() + 1; // 1-12
      const trimestreNum = Math.ceil(month / 3); // 1-4
      trimestre = `Q${trimestreNum}-${ano}`;
    }

    try {
      const result =
        await this.hallOfFameService.calculateTrimestralScores(trimestre);
      return {
        success: result.success,
        trimestre: trimestre,
        processed: result.processed,
        message: `Calculated ${result.processed} trimestral scores for ${trimestre}`,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating trimestral scores for ${trimestre}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error calculating trimestral scores: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/hall-of-fame/trimestral/latest
   * Returnează ultimul trimestru disponibil (cel mai recent cu date)
   */
  @Get('trimestral/latest')
  async getLatestTrimestre() {
    try {
      // Găsește ultimul trimestru cu date
      const latest = await this.hallOfFameService.getLatestTrimestre();
      return {
        success: true,
        trimestre: latest,
      };
    } catch (error) {
      this.logger.error(
        `Error getting latest trimestre: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error getting latest trimestre: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/hall-of-fame/premios
   * Creează un premiu (permiso retribuido) pentru un angajat (doar manageri/admini/developeri)
   */
  @Post('premios')
  async createPremio(
    @Body()
    body: {
      codigo: string;
      nombre: string;
      fecha: string;
      mesPremio: string;
    },
    @CurrentUser() user?: any,
  ) {
    // Verifică permisiuni
    const grupo = user?.GRUPO || user?.grupo || '';
    const isManager = user?.isManager || false;
    const canCreate =
      isManager ||
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!canCreate) {
      throw new ForbiddenException(
        'No tienes permisos para crear premios. Solo los administradores y managers pueden hacerlo.',
      );
    }

    if (!body.codigo || !body.nombre || !body.fecha || !body.mesPremio) {
      throw new BadRequestException(
        'codigo, nombre, fecha, and mesPremio are required',
      );
    }

    // Obține numele utilizatorului care dă premiul
    const dadoPor =
      user?.NOMBRE_APELLIDOS || user?.nombre || user?.CODIGO || 'Admin';

    try {
      const result = await this.hallOfFameService.createPremio(
        body.codigo,
        body.nombre,
        body.fecha,
        body.mesPremio,
        dadoPor,
      );
      return {
        success: true,
        message: `Premio creado exitosamente para ${body.nombre}`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error creating premio: ${error.message}`, error.stack);
      throw new BadRequestException(`Error creating premio: ${error.message}`);
    }
  }
}
