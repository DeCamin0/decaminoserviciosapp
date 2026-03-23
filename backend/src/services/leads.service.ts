import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlinkSync, writeFileSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import {
  dedupeCreateInputs,
  parseCsvToRecords,
  rowToCreateInput,
  type RawLeadRow,
} from '../leads/leads-import.util';
import {
  assertScraperLayout,
  loadScraperSourcesConfig,
  pickPythonCommand,
  resolveScraperDir,
  scraperChildProcessEnv,
  slugifyLocation,
  sourceInAutoPipeline,
  sourceRunsInAuto,
} from '../leads/leads-scrape.util';
import {
  LEAD_SOURCE_REGISTRY,
  displayNameForSourceId,
  type LeadSourceHealthStatus,
} from '../leads/leads-sources.registry';

export type LeadsListQuery = {
  country?: string;
  province?: string;
  city?: string;
  category?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type LeadsScrapeBody = {
  country?: string;
  province?: string;
  city?: string;
  category?: string;
  /** auto | google_discovery | paginas_amarillas | … (por defecto auto) */
  source?: string;
  maxPages?: number;
  synonyms?: string[];
  freeText?: string;
  classificationCodes?: string[];
  enrichContactPages?: boolean;
  /**
   * Empresite: `false` = modo completo (lento). Por defecto en API, Empresite usa modo MVP (rápido)
   * salvo que se envíe `lightMode: false`.
   */
  lightMode?: boolean;
};

/** Multipart scrape/from-html (sin maxPages) */
export type LeadsScrapeHtmlFields = {
  country?: string;
  province?: string;
  city?: string;
  category?: string;
  source?: string;
  synonyms?: string;
  freeText?: string;
  classificationCodes?: string;
  enrichContactPages?: string;
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/leads — list with optional filters and pagination.
   */
  async findMany(query: LeadsListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.LeadWhereInput = {};

    if (query.country?.trim()) {
      where.country = query.country.trim();
    }
    if (query.province?.trim()) {
      where.province = query.province.trim();
    }
    if (query.city?.trim()) {
      where.city = query.city.trim();
    }
    if (query.category?.trim()) {
      where.category = query.category.trim();
    }
    if (query.q?.trim()) {
      // MySQL: collation utf8mb4_unicode_ci hace contains aprox. case-insensitive
      where.companyName = { contains: query.q.trim() };
    }

    const [total, items] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    this.logger.debug(
      `findMany page=${page} pageSize=${pageSize} total=${total}`,
    );

    return {
      success: true,
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Importa filas ya normalizadas (snake_case o camelCase).
   * Dedupe por dedupe_key vía createMany + skipDuplicates (MySQL UNIQUE).
   */
  async importRows(rawRows: unknown): Promise<{
    success: true;
    received: number;
    validRows: number;
    inserted: number;
    skippedDuplicates: number;
    invalid: number;
  }> {
    if (!Array.isArray(rawRows)) {
      throw new BadRequestException('Se espera un array de leads');
    }

    const mapped: Prisma.LeadCreateManyInput[] = [];
    let invalid = 0;
    for (const row of rawRows) {
      if (!row || typeof row !== 'object') {
        invalid++;
        continue;
      }
      const input = rowToCreateInput(row as RawLeadRow);
      if (!input) {
        invalid++;
        continue;
      }
      mapped.push(input);
    }

    const unique = dedupeCreateInputs(mapped);
    if (unique.length === 0) {
      return {
        success: true,
        received: rawRows.length,
        validRows: 0,
        inserted: 0,
        skippedDuplicates: 0,
        invalid,
      };
    }

    const result = await this.prisma.lead.createMany({
      data: unique,
      skipDuplicates: true,
    });

    const inserted = result.count;
    const skippedDuplicates = unique.length - inserted;

    this.logger.log(
      `importRows received=${rawRows.length} valid=${unique.length} inserted=${inserted} skippedDup=${skippedDuplicates} invalid=${invalid}`,
    );

    return {
      success: true,
      received: rawRows.length,
      validRows: unique.length,
      inserted,
      skippedDuplicates,
      invalid,
    };
  }

  /**
   * CSV o JSON (UTF-8) desde buffer de archivo.
   */
  async importFromFileBuffer(
    buffer: Buffer,
    originalname?: string,
  ): Promise<{
    success: true;
    received: number;
    validRows: number;
    inserted: number;
    skippedDuplicates: number;
    invalid: number;
  }> {
    const text = buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trim();
    if (!text) {
      throw new BadRequestException('Archivo vacío');
    }

    const lower = (originalname || '').toLowerCase();
    let rows: unknown[];

    if (lower.endsWith('.csv')) {
      rows = parseCsvToRecords(text);
    } else if (lower.endsWith('.json') || lower.endsWith('.jsonl')) {
      rows = this.parseJsonLeadsPayload(text, lower.endsWith('.jsonl'));
    } else {
      const t = text[0];
      if (t === '[' || t === '{') {
        rows = this.parseJsonLeadsPayload(text, false);
      } else {
        rows = parseCsvToRecords(text);
      }
    }

    return this.importRows(rows);
  }

  /**
   * Registro de fuentes + flags efectivos (lee ``sources/sources_config.json`` del scraper).
   */
  getScrapeRegistry() {
    const scraperDir = resolveScraperDir();
    const cfg = loadScraperSourcesConfig(scraperDir);
    try {
      assertScraperLayout(scraperDir);
    } catch {
      /* scraper ausente: enabled solo por defaultEnabled */
    }
    const po = cfg.priority_overrides || {};
    const sources = LEAD_SOURCE_REGISTRY.map((s) => {
      const effectivePriority =
        typeof po[s.id] === 'number' ? po[s.id]! : s.priority;
      const enabled = sourceRunsInAuto(s.id, s.defaultEnabled, cfg);
      const inAutoPipeline = sourceInAutoPipeline(s, cfg);
      return {
        id: s.id,
        displayName: s.displayName,
        countries: s.countries,
        sourceType: s.sourceType,
        searchModes: s.searchModes,
        outputFields: s.outputFields,
        priority: s.priority,
        effectivePriority,
        defaultEnabled: s.defaultEnabled,
        failureMode: s.failureMode,
        notes: s.notes,
        healthStatus: s.healthStatus,
        tier: s.tier ?? null,
        includeInAuto: s.includeInAuto,
        adapterPath: s.adapterPath,
        enabled,
        inAutoPipeline,
        /** Reservado: persistir última ejecución (futuro) */
        lastRunStats: null as null,
      };
    }).sort((a, b) => a.effectivePriority - b.effectivePriority);

    return { success: true, sources };
  }

  /** Resultado estándar de scrape + import */
  async scrapeAndImport(body: LeadsScrapeBody): Promise<{
    success: boolean;
    scrapedCount: number;
    mergedUnique?: number;
    inserted: number;
    skippedDuplicates: number;
    invalid: number;
    message?: string;
    stderr?: string;
    sourceStats?: Record<string, unknown>;
    scrapeCriteriaSummary?: string;
    /** Metadatos de ejecución (Empresite: modo ligero / timeout). */
    scrapeMeta?: {
      lightMode: boolean;
      timeoutMs: number;
      scrapeSource: string;
    };
    sourceBreakdown?: Record<
      string,
      {
        displayName: string;
        scraped: number;
        inserted: number;
        skippedDuplicates: number;
        invalid: number;
        ok: boolean;
        failed: boolean;
        error?: string;
        failureMode?: string;
        hint?: string;
        zeroReasonCode?: string;
        blocked?: boolean;
        debug?: unknown;
        registryHealth?: LeadSourceHealthStatus;
        registryTier?: number | null;
      }
    >;
  }> {
    const meta = this.resolveScrapeMeta(body);
    const maxPages = Math.min(25, Math.max(1, body.maxPages ?? 1));
    const { scraperDir, python, script } = this.getScraperPaths();
    const empresiteLight =
      meta.scrapeSource === 'empresite' && body.lightMode !== false;
    const timeoutMs = this.scrapeTimeoutMs(meta.scrapeSource, maxPages, {
      empresiteLight,
    });
    const criteriaPath = join(tmpdir(), `leads-criteria-${randomUUID()}.json`);
    writeFileSync(
      criteriaPath,
      JSON.stringify(this.buildCriteriaPayload(meta, body)),
      'utf8',
    );

    this.logger.log(
      `leads.scrape start source=${meta.scrapeSource} timeoutMs=${timeoutMs} category=${meta.category} slug=${meta.whereSlug} empresiteLight=${empresiteLight}`,
    );

    try {
      const run = await this.runScraperCli(
        scraperDir,
        python,
        script,
        [
          '--source',
          meta.scrapeSource,
          '--criteria-file',
          criteriaPath,
          '--max-pages',
          String(maxPages),
          '--format',
          'json',
          '--nest-json',
        ],
        timeoutMs,
        { empresiteLight },
      );

      if (run.ok === false) {
        return {
          ...run.error,
          scrapeMeta: {
            lightMode: empresiteLight,
            timeoutMs,
            scrapeSource: meta.scrapeSource,
          },
        };
      }

      const done = await this.finishScrapeImport(run.stdout, run.stderr, meta, {
        fromHtml: false,
      });
      this.logScrapeSourceSummary(done.sourceBreakdown);
      return {
        ...done,
        scrapeMeta: {
          lightMode: empresiteLight,
          timeoutMs,
          scrapeSource: meta.scrapeSource,
        },
      };
    } finally {
      try {
        unlinkSync(criteriaPath);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Misma fuente, pero parseando un HTML guardado desde el navegador (evita Incapsula en la red).
   */
  async scrapeAndImportFromSavedHtml(
    buffer: Buffer,
    fields: LeadsScrapeHtmlFields,
  ): Promise<{
    success: boolean;
    scrapedCount: number;
    mergedUnique?: number;
    inserted: number;
    skippedDuplicates: number;
    invalid: number;
    message?: string;
    stderr?: string;
    sourceStats?: Record<string, unknown>;
    scrapeCriteriaSummary?: string;
    sourceBreakdown?: Record<
      string,
      {
        displayName: string;
        scraped: number;
        inserted: number;
        skippedDuplicates: number;
        invalid: number;
        ok: boolean;
        failed: boolean;
        error?: string;
        failureMode?: string;
        hint?: string;
        zeroReasonCode?: string;
        blocked?: boolean;
        debug?: unknown;
        registryHealth?: LeadSourceHealthStatus;
        registryTier?: number | null;
      }
    >;
  }> {
    if (!buffer?.length) {
      throw new BadRequestException('Archivo HTML vacío');
    }

    const meta = this.resolveScrapeMeta(
      {
        country: fields.country,
        province: fields.province,
        city: fields.city,
        category: fields.category || '',
        source: 'paginas_amarillas',
      },
      { forceSource: 'paginas_amarillas' },
    );

    const { scraperDir, python, script } = this.getScraperPaths();
    const tmpPath = join(tmpdir(), `pa-leads-${randomUUID()}.html`);
    const criteriaPath = join(tmpdir(), `leads-criteria-${randomUUID()}.json`);
    writeFileSync(tmpPath, buffer);
    writeFileSync(
      criteriaPath,
      JSON.stringify(this.buildCriteriaPayloadFromHtmlFields(meta, fields)),
      'utf8',
    );

    try {
      const run = await this.runScraperCli(
        scraperDir,
        python,
        script,
        [
          '--from-html',
          tmpPath,
          '--criteria-file',
          criteriaPath,
          '--format',
          'json',
          '--nest-json',
        ],
        120_000,
      );

      if (run.ok === false) {
        return run.error;
      }

      const done = await this.finishScrapeImport(run.stdout, run.stderr, meta, {
        fromHtml: true,
      });
      this.logScrapeSourceSummary(done.sourceBreakdown);
      return done;
    } finally {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(criteriaPath);
      } catch {
        /* ignore */
      }
    }
  }

  private getScraperPaths(): {
    scraperDir: string;
    python: string;
    script: string;
  } {
    const scraperDir = resolveScraperDir();
    try {
      assertScraperLayout(scraperDir);
    } catch (e: any) {
      this.logger.error(e?.message);
      throw new BadRequestException(
        'Scraper no disponible en el servidor (falta tools/spanish-leads-scraper).',
      );
    }
    return {
      scraperDir,
      python: pickPythonCommand(),
      script: join(scraperDir, 'run_scrape.py'),
    };
  }

  private readonly scrapeSources = new Set<string>([
    'auto',
    'google',
    ...LEAD_SOURCE_REGISTRY.map((s) => s.id),
  ]);

  private scrapeTimeoutMs(
    source: string,
    maxPages: number,
    opts?: { empresiteLight?: boolean },
  ): number {
    const pa = Math.min(180_000, 45_000 + maxPages * 45_000);
    switch (source) {
      case 'paginas_amarillas':
        return pa;
      case 'google':
      case 'google_discovery':
        return 240_000;
      case 'empresite':
        if (opts?.empresiteLight) {
          return 300_000;
        }
        return 600_000;
      case 'cylex':
        return 120_000;
      case 'infobel':
      case 'kompass':
      case 'yalwa':
        return 90_000;
      case 'europages':
        return 120_000;
      case 'maps_discovery':
      case 'osm_overpass':
        return 60_000;
      case 'auto':
        /* PA + Empresite + Google secuencial; tras capar discovery Google suele acabar en 2–4 min */
        return 420_000;
      default:
        return 120_000;
    }
  }

  private buildCriteriaPayload(
    meta: {
      country: string;
      province: string;
      city: string;
      category: string;
      whereSlug: string;
    },
    body: LeadsScrapeBody,
  ): Record<string, unknown> {
    return {
      category: meta.category,
      where_slug: meta.whereSlug,
      province: meta.province || '',
      city: meta.city || '',
      country: meta.country,
      synonyms: Array.isArray(body.synonyms) ? body.synonyms.map(String) : [],
      free_text: (body.freeText || '').trim(),
      classification_codes: Array.isArray(body.classificationCodes)
        ? body.classificationCodes.map(String)
        : [],
      enrich_contact_pages: Boolean(body.enrichContactPages),
      debug: true,
    };
  }

  private buildCriteriaPayloadFromHtmlFields(
    meta: {
      country: string;
      province: string;
      city: string;
      category: string;
      whereSlug: string;
    },
    fields: LeadsScrapeHtmlFields,
  ): Record<string, unknown> {
    const splitList = (s?: string) =>
      (s || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    return {
      category: meta.category,
      where_slug: meta.whereSlug,
      province: meta.province || '',
      city: meta.city || '',
      country: meta.country,
      synonyms: splitList(fields.synonyms),
      free_text: (fields.freeText || '').trim(),
      classification_codes: splitList(fields.classificationCodes),
      enrich_contact_pages:
        fields.enrichContactPages === 'true' ||
        fields.enrichContactPages === '1',
      debug: true,
    };
  }

  private resolveScrapeMeta(
    f: {
      country?: string;
      province?: string;
      city?: string;
      category?: string;
      source?: string;
    },
    opts?: { forceSource?: string },
  ): {
    country: string;
    province: string;
    city: string;
    category: string;
    whereSlug: string;
    scrapeSource: string;
  } {
    const forced = opts?.forceSource?.trim().toLowerCase();
    let raw = (forced || f.source || 'auto').trim().toLowerCase();
    if (raw === 'google') {
      raw = 'google_discovery';
    }
    if (!forced && !this.scrapeSources.has(raw)) {
      throw new BadRequestException(
        `Fuente no soportada. Use: ${[...this.scrapeSources].sort().join(', ')}`,
      );
    }

    const country = (f.country || 'ES').trim().toUpperCase();
    if (country !== 'ES') {
      throw new BadRequestException(
        'Por ahora solo se admite country=ES para el scraper',
      );
    }

    const category = (f.category || '').trim();
    if (!category) {
      throw new BadRequestException('category es obligatorio');
    }

    const province = (f.province || '').trim();
    const city = (f.city || '').trim();
    // Búsqueda solo país + categoría (p. ej. Europages): sin slug de localidad.
    const whereSlug = province || city ? slugifyLocation(city || province) : '';
    return {
      country,
      province,
      city,
      category,
      whereSlug,
      scrapeSource: forced || raw,
    };
  }

  private registryMetaForSourceId(id: string): {
    healthStatus: LeadSourceHealthStatus;
    tier: number | null;
  } {
    const s = LEAD_SOURCE_REGISTRY.find((x) => x.id === id);
    return {
      healthStatus: s?.healthStatus ?? 'ok',
      tier: s?.tier ?? null,
    };
  }

  private truncateScrapeDebug(d: unknown): unknown {
    if (d === null || d === undefined) return undefined;
    try {
      const s = JSON.stringify(d);
      const max = 14_000;
      if (s.length <= max) return d;
      return { _truncated: true, preview: `${s.slice(0, max)}…` };
    } catch {
      return { _error: 'unserializable_debug' };
    }
  }

  private logScrapeSourceSummary(
    breakdown:
      | Record<
          string,
          {
            scraped: number;
            inserted: number;
            ok: boolean;
            hint?: string;
            zeroReasonCode?: string;
            blocked?: boolean;
          }
        >
      | undefined,
  ): void {
    if (!breakdown) return;
    for (const [sid, row] of Object.entries(breakdown)) {
      this.logger.log(
        `leads.scrape source=${sid} scraped=${row.scraped} inserted=${row.inserted} ok=${row.ok} code=${row.zeroReasonCode ?? ''} blocked=${row.blocked ? 'y' : 'n'} hint=${(row.hint ?? '').slice(0, 280)}`,
      );
    }
  }

  private async runScraperCli(
    scraperDir: string,
    python: string,
    script: string,
    scriptArgs: string[],
    timeoutMs: number,
    opts?: { empresiteLight?: boolean },
  ): Promise<
    | { ok: true; stdout: string; stderr: string }
    | {
        ok: false;
        error: {
          success: false;
          scrapedCount: number;
          inserted: number;
          skippedDuplicates: number;
          invalid: number;
          message?: string;
          stderr?: string;
          sourceStats?: Record<string, unknown>;
        };
      }
  > {
    const env = scraperChildProcessEnv(
      opts?.empresiteLight === true ? true : undefined,
    );
    const args = [script, ...scriptArgs];

    return new Promise((resolve) => {
      const child = spawn(python, args, {
        cwd: scraperDir,
        env,
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      let stderrLineBuf = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        const s = chunk.toString();
        stderr += s;
        stderrLineBuf += s;
        const parts = stderrLineBuf.split(/\r?\n/);
        stderrLineBuf = parts.pop() ?? '';
        for (const line of parts) {
          const t = line.trim();
          if (t) {
            this.logger.log(`[scraper] ${t}`);
          }
        }
      });

      child.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          error: {
            success: false,
            scrapedCount: 0,
            inserted: 0,
            skippedDuplicates: 0,
            invalid: 0,
            message: err?.message || 'spawn failed',
            stderr: stderr || undefined,
          },
        });
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const tail = (stderrLineBuf || '').trim();
        if (tail) {
          this.logger.log(`[scraper] ${tail}`);
        }
        const errStderr = stderr.trim();
        const errStdout = stdout.trim();

        if (timedOut) {
          this.logger.warn(
            `scrape subprocess timeout after ${Math.round(timeoutMs / 1000)}s signal=${signal ?? ''}`,
          );
          resolve({
            ok: false,
            error: {
              success: false,
              scrapedCount: 0,
              inserted: 0,
              skippedDuplicates: 0,
              invalid: 0,
              message: `Tiempo de espera agotado (${Math.round(timeoutMs / 1000)}s). Reduce maxPages o usa HTML guardado.`,
              stderr: errStderr || undefined,
            },
          });
          return;
        }

        if (code === 2) {
          this.logger.debug(
            `scrape exit 2 (bloqueo / sin datos útiles): ${errStderr.slice(0, 240)}`,
          );
          resolve({
            ok: false,
            error: {
              success: false,
              scrapedCount: 0,
              inserted: 0,
              skippedDuplicates: 0,
              invalid: 0,
              message:
                'El sitio bloqueó la extracción automática (anti-bot). Sube abajo el HTML guardado desde el navegador («Página web, completa») o reintenta más tarde.',
              stderr: errStderr || undefined,
            },
          });
          return;
        }

        if (code !== 0 && code !== null) {
          this.logger.warn(
            `scrape subprocess failed code=${code} stderr=${errStderr.slice(0, 500)}`,
          );
          resolve({
            ok: false,
            error: {
              success: false,
              scrapedCount: 0,
              inserted: 0,
              skippedDuplicates: 0,
              invalid: 0,
              message: errStderr || `El scraper terminó con código ${code}`,
              stderr: errStderr || errStdout || undefined,
            },
          });
          return;
        }

        resolve({
          ok: true,
          stdout: stdout,
          stderr: stderr,
        });
      });
    });
  }

  private async finishScrapeImport(
    stdout: string,
    stderr: string,
    meta: {
      country: string;
      province: string;
      city: string;
      category: string;
    },
    ctx: { fromHtml: boolean },
  ): Promise<{
    success: boolean;
    scrapedCount: number;
    mergedUnique?: number;
    inserted: number;
    skippedDuplicates: number;
    invalid: number;
    message?: string;
    stderr?: string;
    sourceStats?: Record<string, unknown>;
    scrapeCriteriaSummary?: string;
    sourceBreakdown?: Record<
      string,
      {
        displayName: string;
        scraped: number;
        inserted: number;
        skippedDuplicates: number;
        invalid: number;
        ok: boolean;
        failed: boolean;
        error?: string;
        failureMode?: string;
        hint?: string;
        zeroReasonCode?: string;
        blocked?: boolean;
        debug?: unknown;
        registryHealth?: LeadSourceHealthStatus;
        registryTier?: number | null;
      }
    >;
  }> {
    type NestOut = {
      records?: unknown[];
      records_by_source?: Record<string, unknown[]>;
      stats?: Record<string, unknown>;
    };

    let nest: NestOut | null = null;
    let rowsLegacy: unknown[] = [];
    try {
      const trimmed = stdout.trim();
      if (!trimmed) {
        rowsLegacy = [];
      } else {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          rowsLegacy = parsed;
        } else if (parsed && typeof parsed === 'object') {
          nest = parsed as NestOut;
          rowsLegacy = Array.isArray(nest.records) ? nest.records : [];
        } else {
          throw new BadRequestException(
            'Salida del scraper: se esperaba un array o objeto con records.',
          );
        }
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        'Salida del scraper no es JSON válido. Revisa dependencias Python (requests, beautifulsoup4).',
      );
    }

    const geoCtx = {
      country: meta.country,
      province: meta.province || undefined,
      city: meta.city || undefined,
      category: meta.category,
    };

    const bySource =
      nest?.records_by_source &&
      typeof nest.records_by_source === 'object' &&
      !Array.isArray(nest.records_by_source)
        ? nest.records_by_source
        : null;

    const sourceStats =
      nest?.stats &&
      typeof nest.stats === 'object' &&
      !Array.isArray(nest.stats)
        ? (nest.stats as Record<string, unknown>)
        : undefined;

    const mergedUnique =
      typeof sourceStats?._merged_unique === 'number'
        ? (sourceStats._merged_unique as number)
        : undefined;

    let scrapedCount: number;
    let inserted = 0;
    let skippedDuplicates = 0;
    let invalid = 0;
    let sourceBreakdown:
      | Record<
          string,
          {
            displayName: string;
            scraped: number;
            inserted: number;
            skippedDuplicates: number;
            invalid: number;
            ok: boolean;
            failed: boolean;
            error?: string;
            failureMode?: string;
            hint?: string;
            zeroReasonCode?: string;
            blocked?: boolean;
            debug?: unknown;
            registryHealth?: LeadSourceHealthStatus;
            registryTier?: number | null;
          }
        >
      | undefined;

    if (bySource) {
      const orderRaw = sourceStats?.import_order;
      const order = Array.isArray(orderRaw)
        ? (orderRaw as string[])
        : Object.keys(bySource);
      const keysOrdered = order.filter((k) => k in bySource);
      const rest = Object.keys(bySource)
        .filter((k) => !keysOrdered.includes(k))
        .sort();
      const fullOrder = [...keysOrdered, ...rest];

      sourceBreakdown = {};
      const pySources =
        sourceStats?.sources && typeof sourceStats.sources === 'object'
          ? (sourceStats.sources as Record<string, Record<string, unknown>>)
          : {};

      scrapedCount = 0;
      for (const sid of fullOrder) {
        const batch = Array.isArray(bySource[sid]) ? bySource[sid] : [];
        scrapedCount += batch.length;
        const enriched = this.applyScrapeGeo(batch, geoCtx);
        const r = await this.importRows(enriched);
        inserted += r.inserted;
        skippedDuplicates += r.skippedDuplicates;
        invalid += r.invalid;
        const py = pySources[sid] || {};
        const dbg = py.debug;
        const dbgRec =
          dbg && typeof dbg === 'object' && !Array.isArray(dbg)
            ? (dbg as Record<string, unknown>)
            : undefined;
        const hint =
          (typeof py.hint === 'string' ? py.hint : undefined) ||
          (dbgRec && typeof dbgRec.hint === 'string' ? dbgRec.hint : undefined);
        const zeroReasonCode =
          (typeof py.zero_reason_code === 'string'
            ? py.zero_reason_code
            : undefined) ||
          (dbgRec && typeof dbgRec.zero_reason_code === 'string'
            ? dbgRec.zero_reason_code
            : undefined);
        const blocked =
          Boolean(py.blocked) ||
          Boolean(dbgRec?.blocked) ||
          zeroReasonCode === 'blocked' ||
          zeroReasonCode === 'source_rate_limited' ||
          zeroReasonCode === 'source_ip_blocked_or_throttled';
        const reg = this.registryMetaForSourceId(sid);
        sourceBreakdown[sid] = {
          displayName: displayNameForSourceId(sid),
          scraped: batch.length,
          inserted: r.inserted,
          skippedDuplicates: r.skippedDuplicates,
          invalid: r.invalid,
          ok: py.ok !== false && !blocked,
          failed: py.failed === true || blocked,
          error: typeof py.error === 'string' ? py.error : undefined,
          failureMode:
            typeof py.failure_mode === 'string' ? py.failure_mode : undefined,
          hint,
          zeroReasonCode,
          blocked,
          debug: this.truncateScrapeDebug(py.debug),
          registryHealth: reg.healthStatus,
          registryTier: reg.tier,
        };
      }
    } else {
      const enriched = this.applyScrapeGeo(rowsLegacy, geoCtx);
      const importResult = await this.importRows(enriched);
      scrapedCount = rowsLegacy.length;
      inserted = importResult.inserted;
      skippedDuplicates = importResult.skippedDuplicates;
      invalid = importResult.invalid;
    }

    const emptyMsg = ctx.fromHtml
      ? 'El parser no extrajo resultados del HTML recibido (sin JSON-LD ni enlaces /ficha/ útiles).'
      : 'No se importaron filas: revisa el resumen por fuente (bloqueo, 0 URLs candidatas o parser vacío).';

    let message: string | undefined;
    if (scrapedCount === 0) {
      message = emptyMsg;
      if (sourceBreakdown) {
        const parts = Object.values(sourceBreakdown)
          .map((row) => row.hint)
          .filter(
            (h): h is string =>
              typeof h === 'string' && h.length > 0 && h !== 'OK',
          );
        if (parts.length) message = parts.join(' · ');
      }
    }

    const crit = sourceStats?.criteria;
    let scrapeCriteriaSummary: string | undefined;
    if (crit && typeof crit === 'object' && !Array.isArray(crit)) {
      const c = crit as Record<string, unknown>;
      const profile =
        typeof c.search_profile_id === 'string' && c.search_profile_id
          ? c.search_profile_id
          : typeof c.searchProfileId === 'string' && c.searchProfileId
            ? c.searchProfileId
            : '';
      const cnae =
        Array.isArray(c.cnae_codes) && c.cnae_codes.length
          ? (c.cnae_codes as unknown[]).join('|')
          : Array.isArray(c.cnaeCodes) && c.cnaeCodes.length
            ? (c.cnaeCodes as unknown[]).join('|')
            : '';
      const parts = [
        `category=${c.category ?? ''}`,
        `where_slug=${c.where_slug ?? c.whereSlug ?? ''}`,
        `province=${c.province ?? ''}`,
        `city=${c.city ?? ''}`,
      ];
      if (profile) parts.push(`profile=${profile}`);
      if (cnae) parts.push(`cnae=${cnae}`);
      scrapeCriteriaSummary = parts.join(', ');
    }

    return {
      success: true,
      scrapedCount,
      mergedUnique,
      inserted,
      skippedDuplicates,
      invalid,
      message,
      stderr: stderr.trim() || undefined,
      sourceStats,
      sourceBreakdown,
      scrapeCriteriaSummary,
    };
  }

  /** Ajusta país/provincia/ciudad/categoría y fuerza nuevo dedupe_key en import. */
  private applyScrapeGeo(
    rows: unknown[],
    ctx: {
      country: string;
      province?: string;
      city?: string;
      category: string;
    },
  ): unknown[] {
    return rows.map((r) => {
      if (!r || typeof r !== 'object') return r;
      const o = { ...(r as Record<string, unknown>) };
      delete o.dedupe_key;
      delete o.dedupeKey;
      o.country = ctx.country;
      o.category = ctx.category;
      if (ctx.province) o.province = ctx.province;
      if (ctx.city) o.city = ctx.city;
      return o;
    });
  }

  private parseJsonLeadsPayload(text: string, jsonl: boolean): unknown[] {
    if (jsonl) {
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const out: unknown[] = [];
      for (const line of lines) {
        try {
          out.push(JSON.parse(line));
        } catch {
          throw new BadRequestException(
            'JSONL inválido: cada línea debe ser un objeto JSON',
          );
        }
      }
      return out;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed;
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { leads?: unknown[] }).leads)
      ) {
        return (parsed as { leads: unknown[] }).leads;
      }
      throw new BadRequestException(
        'JSON debe ser un array o { "leads": [ ... ] }',
      );
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('JSON inválido');
    }
  }
}
