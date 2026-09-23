import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type CalendarHoliday = {
  date: string;
  name: string;
  scope?: string;
  source?: string;
  sourceUrl?: string;
};

type MadCalendarApiResponse = {
  year?: number;
  holidays?: {
    calendar?: CalendarHoliday[];
    national?: CalendarHoliday[];
    regional?: CalendarHoliday[];
  };
};

type NagerHoliday = {
  date: string;
  localName?: string;
  name?: string;
  global?: boolean;
  counties?: string[] | null;
};

type MadridOdRow = {
  festividad?: string;
  año?: string | number;
  fecha_festivo?: string;
};

export type FestivosVerifyReport = {
  source: 'madrid-od' | 'nager' | 'none';
  match: boolean;
  primaryCount: number;
  verifyCount: number;
  onlyInPrimary: string[];
  onlyInVerify: string[];
  note?: string;
};

export type FestivosSyncYearResult = {
  year: number;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: boolean;
  skipReason?: string;
  usedSource: 'calendariosnacionales' | 'madrid-od' | 'nager' | 'none';
  usedFallback: boolean;
  verification: FestivosVerifyReport;
};

export type FestivosSyncResult = {
  success: true;
  region: 'MAD';
  source: string;
  years: FestivosSyncYearResult[];
  totals: {
    inserted: number;
    updated: number;
    unchanged: number;
    fetched: number;
  };
  verificationSummary: {
    allMatch: boolean;
    yearsWithMismatch: number[];
  };
};

@Injectable()
export class FestivosService {
  private readonly logger = new Logger(FestivosService.name);
  private readonly apiBase = 'https://calendariosnacionales.com/es/v1';
  private readonly nagerBase = 'https://date.nager.at/api/v3';
  /** Open Data oficial Comunidad de Madrid (año en curso). */
  private readonly madridOdRegionalesUrl =
    'https://datos.comunidad.madrid/dataset/f160eb6c-6715-471e-9bc0-38497aae950f/resource/975f579d-92c2-42de-bfa9-aff5bd164586/download/festivos_regionales.json';
  /** Alineat cu UI Cuadrantes (ES-MD). */
  private readonly madridCcaaCode = 'ES-MD';
  private readonly notesPrefix = 'calendariosnacionales';
  private readonly syncMarkers = [
    'calendariosnacionales',
    'madrid-od',
    'nager',
  ] as const;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escape SQL pentru prevenirea SQL injection
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    const str = String(value);
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  private normalizeScope(raw?: string): 'Nacional' | 'Autonómico' {
    const s = String(raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    if (
      s.includes('autonom') ||
      s.includes('regional') ||
      s.includes('comunidad')
    ) {
      return 'Autonómico';
    }
    return 'Nacional';
  }

  private normalizeNameKey(name: string): string {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildNotes(
    holiday: CalendarHoliday,
    extras?: { verified?: string; usedFallback?: boolean },
  ): string {
    const parts = [
      holiday.source?.startsWith('madrid-od')
        ? 'madrid-od'
        : holiday.source?.startsWith('nager')
          ? 'nager'
          : this.notesPrefix,
      holiday.source || 'API',
      holiday.sourceUrl || '',
      extras?.verified ? `verified:${extras.verified}` : '',
      extras?.usedFallback ? 'fallback:1' : '',
      `synced:${new Date().toISOString().slice(0, 10)}`,
    ].filter(Boolean);
    return parts.join(' | ').slice(0, 2000);
  }

  private datesSet(holidays: CalendarHoliday[]): Set<string> {
    return new Set(holidays.map((h) => h.date));
  }

  private compareDateSets(
    primary: CalendarHoliday[],
    verify: CalendarHoliday[],
    source: FestivosVerifyReport['source'],
    note?: string,
  ): FestivosVerifyReport {
    const p = this.datesSet(primary);
    const v = this.datesSet(verify);
    const onlyInPrimary = [...p].filter((d) => !v.has(d)).sort();
    const onlyInVerify = [...v].filter((d) => !p.has(d)).sort();
    return {
      source,
      match: onlyInPrimary.length === 0 && onlyInVerify.length === 0,
      primaryCount: p.size,
      verifyCount: v.size,
      onlyInPrimary,
      onlyInVerify,
      note,
    };
  }

  /**
   * Sync festivos naționali + Comunidad de Madrid.
   * Primar: calendariosnacionales. Verificare: Madrid Open Data (oficial).
   * Fallback: Madrid OD → Nager.Date. Nu șterge festivos manuale.
   */
  async syncFromCalendariosNacionales(options?: {
    years?: number[];
  }): Promise<FestivosSyncResult> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years =
      options?.years?.length && options.years.every((y) => Number.isFinite(y))
        ? [...new Set(options.years.map((y) => Number(y)))]
        : [currentYear, currentYear + 1];

    // Cache Madrid OD (un singur download pe sync)
    const madridOdByYear = await this.fetchMadridOdByYear();

    const yearResults: FestivosSyncYearResult[] = [];

    for (const year of years) {
      yearResults.push(
        await this.syncYearWithVerifyAndFallback(year, madridOdByYear),
      );
    }

    const totals = yearResults.reduce(
      (acc, y) => {
        acc.inserted += y.inserted;
        acc.updated += y.updated;
        acc.unchanged += y.unchanged;
        acc.fetched += y.fetched;
        return acc;
      },
      { inserted: 0, updated: 0, unchanged: 0, fetched: 0 },
    );

    const yearsWithMismatch = yearResults
      .filter(
        (y) =>
          !y.skipped &&
          y.verification.source !== 'none' &&
          !y.verification.match,
      )
      .map((y) => y.year);

    this.logger.log(
      `✅ Festivos sync done: years=${years.join(',')} inserted=${totals.inserted} updated=${totals.updated} unchanged=${totals.unchanged} mismatches=${yearsWithMismatch.join(',') || 'none'}`,
    );

    return {
      success: true,
      region: 'MAD',
      source: `${this.apiBase}/{year}/regiones/mad.json (+ verify madrid-od / fallback nager)`,
      years: yearResults,
      totals,
      verificationSummary: {
        allMatch: yearsWithMismatch.length === 0,
        yearsWithMismatch,
      },
    };
  }

  private async syncYearWithVerifyAndFallback(
    year: number,
    madridOdByYear: Map<number, CalendarHoliday[]>,
  ): Promise<FestivosSyncYearResult> {
    const emptyVerify = (): FestivosVerifyReport => ({
      source: 'none',
      match: true,
      primaryCount: 0,
      verifyCount: 0,
      onlyInPrimary: [],
      onlyInVerify: [],
    });

    let holidays: CalendarHoliday[] = [];
    let usedSource: FestivosSyncYearResult['usedSource'] = 'none';
    let usedFallback = false;

    // 1) Primary: calendariosnacionales
    const primary = await this.fetchCalendariosNacionalesYear(year);
    if (primary.status === 'ok') {
      holidays = primary.holidays;
      usedSource = 'calendariosnacionales';
    } else if (primary.status === 'not_found') {
      this.logger.warn(`⚠️ Primary festivos 404 for ${year}`);
    } else {
      this.logger.warn(`⚠️ Primary festivos error ${year}: ${primary.error}`);
    }

    // 2) Fallback: Madrid OD → Nager
    if (!holidays.length) {
      const od = madridOdByYear.get(year) || [];
      if (od.length) {
        holidays = od;
        usedSource = 'madrid-od';
        usedFallback = true;
        this.logger.log(`↩️ Fallback Madrid OD for ${year} (${od.length})`);
      } else {
        const nager = await this.fetchNagerMadridYear(year);
        if (nager.length) {
          holidays = nager;
          usedSource = 'nager';
          usedFallback = true;
          this.logger.log(`↩️ Fallback Nager for ${year} (${nager.length})`);
        }
      }
    }

    if (!holidays.length) {
      return {
        year,
        fetched: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        skipped: true,
        skipReason:
          primary.status === 'not_found'
            ? 'not_available_yet'
            : 'all_sources_failed',
        usedSource: 'none',
        usedFallback: false,
        verification: emptyVerify(),
      };
    }

    // 3) Verification (prefer Madrid OD oficial; else soft Nager)
    let verification: FestivosVerifyReport;
    const odVerify = madridOdByYear.get(year) || [];
    if (odVerify.length && usedSource !== 'madrid-od') {
      verification = this.compareDateSets(
        holidays,
        odVerify,
        'madrid-od',
        'Comparado con Open Data oficial Comunidad de Madrid',
      );
    } else if (usedSource === 'madrid-od') {
      verification = {
        source: 'madrid-od',
        match: true,
        primaryCount: holidays.length,
        verifyCount: holidays.length,
        onlyInPrimary: [],
        onlyInVerify: [],
        note: 'Fuente = Open Data oficial Comunidad de Madrid',
      };
    } else {
      const nagerVerify = await this.fetchNagerMadridYear(year);
      if (nagerVerify.length && usedSource !== 'nager') {
        verification = this.compareDateSets(
          holidays,
          nagerVerify,
          'nager',
          'Verificación soft Nager (pueden diferir traslados BOE vs fecha canónica)',
        );
      } else if (usedSource === 'nager') {
        verification = {
          source: 'nager',
          match: true,
          primaryCount: holidays.length,
          verifyCount: holidays.length,
          onlyInPrimary: [],
          onlyInVerify: [],
          note: 'Fuente = Nager.Date (fallback)',
        };
      } else {
        verification = {
          ...emptyVerify(),
          primaryCount: holidays.length,
          note: 'Sin fuente de verificación disponible',
        };
      }
    }

    if (!verification.match) {
      this.logger.warn(
        `⚠️ Festivos mismatch ${year} vs ${verification.source}: onlyPrimary=${verification.onlyInPrimary.join(',')} onlyVerify=${verification.onlyInVerify.join(',')}`,
      );
    }

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const holiday of holidays) {
      const result = await this.upsertSyncedFestivo(holiday, {
        verified:
          verification.source !== 'none' ? verification.source : undefined,
        usedFallback,
      });
      if (result === 'inserted') inserted += 1;
      else if (result === 'updated') updated += 1;
      else unchanged += 1;
    }

    return {
      year,
      fetched: holidays.length,
      inserted,
      updated,
      unchanged,
      skipped: false,
      usedSource,
      usedFallback,
      verification,
    };
  }

  private async fetchCalendariosNacionalesYear(
    year: number,
  ): Promise<
    | { status: 'ok'; holidays: CalendarHoliday[] }
    | { status: 'not_found' }
    | { status: 'error'; error: string }
  > {
    const url = `${this.apiBase}/${year}/regiones/mad.json`;
    try {
      const response = await axios.get<MadCalendarApiResponse>(url, {
        timeout: 20000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DeCamino-Servicios/1.0',
        },
        validateStatus: (status) => status === 200 || status === 404,
      });
      if (response.status === 404) return { status: 'not_found' };
      return {
        status: 'ok',
        holidays: this.extractHolidays(response.data),
      };
    } catch (error: any) {
      return { status: 'error', error: error?.message || 'network' };
    }
  }

  private async fetchMadridOdByYear(): Promise<Map<number, CalendarHoliday[]>> {
    const map = new Map<number, CalendarHoliday[]>();
    try {
      const response = await axios.get<{ data?: MadridOdRow[] }>(
        this.madridOdRegionalesUrl,
        {
          timeout: 20000,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'DeCamino-Servicios/1.0',
          },
        },
      );
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      for (const row of rows) {
        const date = String(row.fecha_festivo || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const year = Number(row.año) || Number(date.slice(0, 4));
        if (!year) continue;
        const name = String(row.festividad || 'Festivo').trim();
        const isMadridOnly = /comunidad de madrid|fiesta comunidad/i.test(name);
        const holiday: CalendarHoliday = {
          date,
          name,
          scope: isMadridOnly ? 'autonomico' : 'nacional',
          source: 'madrid-od',
          sourceUrl: this.madridOdRegionalesUrl,
        };
        const list = map.get(year) || [];
        list.push(holiday);
        map.set(year, list);
      }
      for (const [y, list] of map) {
        const byDate = new Map<string, CalendarHoliday>();
        for (const h of list) byDate.set(h.date, h);
        map.set(
          y,
          [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
        );
      }
      this.logger.log(
        `📘 Madrid OD loaded years: ${[...map.keys()].join(',') || 'none'}`,
      );
    } catch (error: any) {
      this.logger.warn(`⚠️ Madrid OD unavailable: ${error?.message}`);
    }
    return map;
  }

  private async fetchNagerMadridYear(year: number): Promise<CalendarHoliday[]> {
    try {
      const url = `${this.nagerBase}/PublicHolidays/${year}/ES`;
      const response = await axios.get<NagerHoliday[]>(url, {
        timeout: 15000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DeCamino-Servicios/1.0',
        },
      });
      const rows = Array.isArray(response.data) ? response.data : [];
      const holidays: CalendarHoliday[] = [];
      for (const row of rows) {
        const date = String(row.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const applies =
          row.global === true ||
          (Array.isArray(row.counties) &&
            row.counties.includes(this.madridCcaaCode));
        if (!applies) continue;
        const isMadridOnly =
          Array.isArray(row.counties) &&
          row.counties.length === 1 &&
          row.counties[0] === this.madridCcaaCode;
        holidays.push({
          date,
          name: String(row.localName || row.name || 'Festivo').trim(),
          scope: isMadridOnly ? 'autonomico' : 'nacional',
          source: 'nager',
          sourceUrl: url,
        });
      }
      const byDate = new Map<string, CalendarHoliday>();
      for (const h of holidays) byDate.set(h.date, h);
      return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    } catch (error: any) {
      this.logger.warn(`⚠️ Nager unavailable ${year}: ${error?.message}`);
      return [];
    }
  }

  private extractHolidays(payload: MadCalendarApiResponse): CalendarHoliday[] {
    const fromCalendar = payload?.holidays?.calendar;
    const list: CalendarHoliday[] =
      Array.isArray(fromCalendar) && fromCalendar.length > 0
        ? fromCalendar
        : [
            ...(payload?.holidays?.national || []),
            ...(payload?.holidays?.regional || []),
          ];

    const byDate = new Map<string, CalendarHoliday>();
    for (const item of list) {
      if (!item?.date || !item?.name) continue;
      const date = String(item.date).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      // Preferă autonomico dacă există dublu pe aceeași dată
      const prev = byDate.get(date);
      if (!prev) {
        byDate.set(date, { ...item, date });
        continue;
      }
      const nextScope = this.normalizeScope(item.scope);
      const prevScope = this.normalizeScope(prev.scope);
      if (nextScope === 'Autonómico' && prevScope !== 'Autonómico') {
        byDate.set(date, { ...item, date });
      }
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private async upsertSyncedFestivo(
    holiday: CalendarHoliday,
    extras?: { verified?: string; usedFallback?: boolean },
  ): Promise<'inserted' | 'updated' | 'unchanged'> {
    const scope = this.normalizeScope(holiday.scope);
    const ccaa = scope === 'Autonómico' ? this.madridCcaaCode : null;
    const notes = this.buildNotes(holiday, extras);
    const name = String(holiday.name).trim().slice(0, 160);
    const date = holiday.date;

    const existing = await this.findExistingForSync(date, scope, ccaa, name);

    if (!existing) {
      await this.createFestivo({
        fecha: date,
        nombre: name,
        scope,
        ccaa: ccaa || undefined,
        observed_date: date,
        active: 1,
        notes,
      });
      return 'inserted';
    }

    const sameName = existing.name === name;
    const sameScope = this.normalizeScope(existing.scope) === scope;
    const sameCcaa =
      (existing.ccaa_code || null) === ccaa ||
      (scope === 'Autonómico' &&
        ['MAD', 'MD', 'ES-MD'].includes(
          String(existing.ccaa_code || '').toUpperCase(),
        ));
    const alreadySynced = this.syncMarkers.some((m) =>
      String(existing.notes || '').includes(m),
    );

    if (sameName && sameScope && sameCcaa && alreadySynced) {
      // Reînnoiește doar marca de sync în notes
      await this.updateFestivo({
        id: existing.id,
        notes,
        active: 1,
      });
      return 'unchanged';
    }

    await this.updateFestivo({
      id: existing.id,
      fecha: date,
      nombre: name,
      scope,
      notes,
      active: 1,
    });

    // Actualizează ccaa_code dacă lipsește / e alt format
    if (ccaa) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE fiestas SET ccaa_code = ${this.escapeSql(ccaa)} WHERE id = ${Number(existing.id)}`,
      );
    }

    return 'updated';
  }

  private async findExistingForSync(
    date: string,
    scope: 'Nacional' | 'Autonómico',
    ccaa: string | null,
    name: string,
  ): Promise<{
    id: number;
    name: string;
    scope: string;
    ccaa_code: string | null;
    notes: string | null;
  } | null> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        name: string;
        scope: string;
        ccaa_code: string | null;
        notes: string | null;
      }>
    >(
      `SELECT id, name, scope, ccaa_code, notes
       FROM fiestas
       WHERE date = ${this.escapeSql(date)}`,
    );

    if (!rows?.length) return null;

    const nameKey = this.normalizeNameKey(name);

    // 1) Match pe scope + ccaa (sau notes din sync anterior)
    const byScope = rows.find((r) => {
      const rScope = this.normalizeScope(r.scope);
      if (rScope !== scope) return false;
      if (scope === 'Nacional') {
        return (
          !r.ccaa_code ||
          ['ES', 'ESP', 'NACIONAL'].includes(String(r.ccaa_code).toUpperCase())
        );
      }
      const code = String(r.ccaa_code || '').toUpperCase();
      return (
        code === 'ES-MD' ||
        code === 'MAD' ||
        code === 'MD' ||
        code === this.madridCcaaCode
      );
    });
    if (byScope) return byScope;

    // 2) Match pe nume (evită dubluri față de festivos manuale)
    const byName = rows.find((r) => this.normalizeNameKey(r.name) === nameKey);
    if (byName) return byName;

    // 3) Deja sync-uit pe aceeași dată
    const byNotes = rows.find((r) =>
      this.syncMarkers.some((m) => String(r.notes || '').includes(m)),
    );
    if (byNotes) return byNotes;

    return null;
  }

  /**
   * Obține toate zilele festive pentru un an specific
   * @param year Anul pentru care se extrag zilele festive
   * @returns Array cu zilele festive
   */
  async getFestivos(year: number): Promise<any[]> {
    try {
      if (!year || isNaN(year)) {
        throw new BadRequestException(
          'Year is required and must be a valid number',
        );
      }

      const query = `
        SELECT
          id,
          date,
          name,
          scope,
          ccaa_code,
          observed_date,
          active,
          notes
        FROM fiestas
        WHERE YEAR(date) = ${year}
          AND active = 1
        ORDER BY date ASC
      `;

      this.logger.log(`📅 Fetching festivos for year: ${year}`);

      const festivos = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(`✅ Found ${festivos.length} festivos for year ${year}`);

      return festivos;
    } catch (error: any) {
      this.logger.error(`❌ Error getting festivos for year ${year}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener festivos: ${error.message}`,
      );
    }
  }

  /**
   * Creează o zi festivă nouă
   * @param data Datele zilei festive
   */
  async createFestivo(data: {
    fecha: string;
    nombre: string;
    scope: string;
    ccaa?: string;
    observed_date?: string;
    active?: number | boolean;
    notes?: string;
  }): Promise<{ success: true; id: number }> {
    try {
      if (!data.fecha || !data.nombre || !data.scope) {
        throw new BadRequestException('fecha, nombre, and scope are required');
      }

      // observed_date default la fecha dacă nu este specificat
      const observedDate = data.observed_date || data.fecha;
      const active =
        data.active !== undefined
          ? typeof data.active === 'boolean'
            ? data.active
              ? 1
              : 0
            : Number(data.active)
          : 1;

      const query = `
        INSERT INTO fiestas
          (date, name, scope, ccaa_code, observed_date, active, notes)
        VALUES
          (
            ${this.escapeSql(data.fecha)},
            ${this.escapeSql(data.nombre)},
            ${this.escapeSql(data.scope)},
            ${data.ccaa ? this.escapeSql(data.ccaa) : 'NULL'},
            ${this.escapeSql(observedDate)},
            ${active},
            ${data.notes ? this.escapeSql(data.notes) : "''"}
          )
      `;

      this.logger.log(`📝 Creating festivo: ${data.nombre} on ${data.fecha}`);

      await this.prisma.$executeRawUnsafe(query);

      // Obține ID-ul inserat
      const inserted = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM fiestas WHERE date = ${this.escapeSql(data.fecha)} AND name = ${this.escapeSql(data.nombre)} AND scope = ${this.escapeSql(data.scope)} ORDER BY id DESC LIMIT 1`,
      );

      const id = inserted && inserted.length > 0 ? inserted[0].id : null;

      this.logger.log(`✅ Festivo created with id: ${id}`);

      return { success: true, id: id || 0 };
    } catch (error: any) {
      this.logger.error('❌ Error creating festivo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al crear festivo: ${error.message}`);
    }
  }

  /**
   * Actualizează o zi festivă existentă
   * @param data Datele pentru actualizare
   */
  async updateFestivo(data: {
    id: number;
    fecha?: string;
    nombre?: string;
    scope?: string;
    notes?: string;
    active?: number | boolean;
  }): Promise<{ success: true }> {
    try {
      if (!data.id || isNaN(data.id)) {
        throw new BadRequestException(
          'id is required and must be a valid number',
        );
      }

      const updates: string[] = [];

      if (data.fecha !== undefined) {
        updates.push(`date = ${this.escapeSql(data.fecha)}`);
      }
      if (data.nombre !== undefined) {
        updates.push(`name = ${this.escapeSql(data.nombre)}`);
      }
      if (data.scope !== undefined) {
        updates.push(`scope = ${this.escapeSql(data.scope)}`);
      }
      if (data.notes !== undefined) {
        updates.push(`notes = ${this.escapeSql(data.notes)}`);
      }
      if (data.active !== undefined) {
        const active =
          typeof data.active === 'boolean'
            ? data.active
              ? 1
              : 0
            : Number(data.active);
        updates.push(`active = ${active}`);
      }

      if (updates.length === 0) {
        throw new BadRequestException(
          'At least one field must be provided for update',
        );
      }

      const query = `
        UPDATE fiestas
        SET ${updates.join(', ')}
        WHERE id = ${Number(data.id)}
      `;

      this.logger.log(`📝 Updating festivo with id: ${data.id}`);

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Festivo updated with id: ${data.id}`);

      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Error updating festivo with id ${data.id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar festivo: ${error.message}`,
      );
    }
  }

  /**
   * Șterge o zi festivă
   * @param id ID-ul zilei festive de șters
   */
  async deleteFestivo(id: number): Promise<{ success: true }> {
    try {
      if (!id || isNaN(id)) {
        throw new BadRequestException(
          'id is required and must be a valid number',
        );
      }

      const query = `
        DELETE FROM fiestas
        WHERE id = ${Number(id)}
      `;

      this.logger.log(`🗑️ Deleting festivo with id: ${id}`);

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Festivo deleted with id: ${id}`);

      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting festivo with id ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar festivo: ${error.message}`,
      );
    }
  }
}
