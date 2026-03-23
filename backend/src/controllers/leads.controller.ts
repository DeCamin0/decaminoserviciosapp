import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  Logger,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  LeadsService,
  LeadsListQuery,
  type LeadsScrapeBody,
  type LeadsScrapeHtmlFields,
} from '../services/leads.service';

@Controller('api/leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(private readonly leadsService: LeadsService) {}

  private assertAdminOrDeveloper(req: any) {
    const grupo = req?.user?.GRUPO || req?.user?.grupo;
    const ok = grupo === 'Admin' || grupo === 'Developer';
    if (!ok) {
      this.logger.warn(`Leads access denied for grupo=${grupo}`);
      throw new ForbiddenException(
        'Solo administradores y desarrolladores pueden acceder a leads.',
      );
    }
  }

  /**
   * GET /api/leads
   * Query: country, province, city, category, q (company name), page, pageSize
   */
  @Get()
  async list(
    @Req() req: any,
    @Query('country') country?: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    this.assertAdminOrDeveloper(req);

    const query: LeadsListQuery = {
      country,
      province,
      city,
      category,
      q,
      page: pageStr ? parseInt(pageStr, 10) : undefined,
      pageSize: pageSizeStr ? parseInt(pageSizeStr, 10) : undefined,
    };

    return this.leadsService.findMany(query);
  }

  /**
   * POST /api/leads/import
   * - JSON: { "leads": [ { company_name, … } ] }
   * - multipart: campo "file" (.csv, .json, .jsonl)
   */
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async import(
    @Req() req: any,
    @Body() body: { leads?: unknown[] },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.assertAdminOrDeveloper(req);

    if (file?.buffer?.length) {
      return this.leadsService.importFromFileBuffer(
        file.buffer,
        file.originalname,
      );
    }

    if (Array.isArray(body?.leads)) {
      return this.leadsService.importRows(body.leads);
    }

    throw new BadRequestException(
      'Envía { "leads": [...] } o multipart con campo "file" (csv/json/jsonl)',
    );
  }

  /**
   * POST /api/leads/scrape/from-html
   * multipart: campo "file" (HTML) + country, province, city, category, source (texto)
   */
  @Post('scrape/from-html')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async scrapeFromHtml(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: LeadsScrapeHtmlFields,
  ) {
    this.assertAdminOrDeveloper(req);
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Adjunta un archivo HTML (campo file). En Chrome: Ctrl+S → «Página web, completa».',
      );
    }
    return this.leadsService.scrapeAndImportFromSavedHtml(
      file.buffer,
      body || {},
    );
  }

  /**
   * POST /api/leads/scrape
   * Ejecuta el scraper Python (tools/spanish-leads-scraper) e importa en BD.
   */
  @Post('scrape')
  async scrape(@Req() req: any, @Body() body: LeadsScrapeBody) {
    this.assertAdminOrDeveloper(req);
    return this.leadsService.scrapeAndImport(body || ({} as LeadsScrapeBody));
  }

  /**
   * GET /api/leads/scrape/registry
   * Metadatos de fuentes (registro) y si están activas en modo auto según sources_config.json.
   */
  @Get('scrape/registry')
  scrapeRegistry(@Req() req: any) {
    this.assertAdminOrDeveloper(req);
    return this.leadsService.getScrapeRegistry();
  }
}
