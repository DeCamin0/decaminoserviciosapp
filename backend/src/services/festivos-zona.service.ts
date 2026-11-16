import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { matrixModuleEnabled } from './empleados-operation-access';
import {
  canManageFestivoZonas,
  decideZona,
  fiestaAppliesToZona,
  fiestaVisibleForZona,
  normalizePlaceName,
  scopeKind,
  isGenericLocalName,
  isOfficialNonLocalRow,
  localFestivoName,
  observedDateForClient,
  type FiestaRow,
  type Zona,
  type ZonaDecision,
} from './festivos-zona.logic';

type CatalogMunicipio = Zona & {
  slug: string;
  ccaaSlug: string;
  provinciaSlug: string;
};

type LocalHoliday = {
  date: string;
  name: string;
  scope?: string;
};

const API_BASE = 'https://calendariosnacionales.com/es/v1';

@Injectable()
export class FestivosZonaService {
  private readonly logger = new Logger(FestivosZonaService.name);
  private catalogCache = new Map<number, CatalogMunicipio[]>();
  private schemaReady: boolean | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Același acces ca pagina Cuadrantes, plus grupurile care puteau sincroniza înainte. */
  async assertCanManageZonas(user: any): Promise<void> {
    const grupo = user?.GRUPO || user?.grupo;
    const cuadrantesPermitted = await matrixModuleEnabled(
      this.prisma,
      grupo,
      'cuadrantes',
    );
    if (
      canManageFestivoZonas({
        grupo,
        role: user?.role,
        cuadrantesPermitted,
      })
    ) {
      return;
    }
    throw new ForbiddenException(
      'No tienes permiso para cambiar las zonas de festivos.',
    );
  }

  madridToday(ref = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(ref);
  }

  async listCatalog(
    year = new Date().getFullYear(),
  ): Promise<CatalogMunicipio[]> {
    const cached = this.catalogCache.get(year);
    if (cached) return cached;
    const url = `${API_BASE}/${year}/regiones/mad/provincias/madrid/localidades.json`;
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DeCamino-Servicios/1.0',
      },
    });
    const rows = Array.isArray(response.data?.municipalities)
      ? response.data.municipalities
      : [];
    const catalog: CatalogMunicipio[] = rows
      .map((row: { ine?: string; slug?: string; name?: string }) => ({
        ine: String(row.ine || '').trim(),
        slug: String(row.slug || '').trim(),
        nombre: String(row.name || '').trim(),
        ccaaCode: 'ES-MD',
        ccaaSlug: 'mad',
        provinciaSlug: 'madrid',
      }))
      .filter((row: CatalogMunicipio) => row.ine && row.slug && row.nombre)
      .sort((a: CatalogMunicipio, b: CatalogMunicipio) =>
        a.nombre.localeCompare(b.nombre, 'es'),
      );
    this.catalogCache.set(year, catalog);
    return catalog;
  }

  async hasSchema(): Promise<boolean> {
    if (this.schemaReady === true) return true;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT 1 AS ok
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'festivo_zonas'
       LIMIT 1`,
    );
    const columns = await this.prisma.$queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT 1 AS ok
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'fiestas'
         AND COLUMN_NAME = 'municipio_ine'
       LIMIT 1`,
    );
    this.schemaReady = (rows || []).length > 0 && (columns || []).length > 0;
    return this.schemaReady;
  }

  /**
   * Fragment SQL (începe cu OR) pentru festivoul local în calendarele lunare.
   * O zonă: ține pentru toată firma. Mai multe: doar centrul din orașul ăla.
   * Gol dacă migrarea de zone nu e aplicată.
   */
  async localFiestaOrSql(empleadoIdExpr = 'ec.empleadoId'): Promise<string> {
    if (!(await this.hasSchema())) return '';
    const id = empleadoIdExpr;
    const txt = (expr: string) =>
      `CONVERT(${expr} USING utf8mb4) COLLATE utf8mb4_unicode_ci`;
    return `
      OR (
        LOWER(TRIM(fi.scope)) = 'local'
        AND NULLIF(TRIM(fi.municipio_ine), '') IS NOT NULL
        AND (
          (
            (SELECT COUNT(*) FROM festivo_zonas) = 1
            AND ${txt('fi.municipio_ine')} = (SELECT ${txt('z.ine')} FROM festivo_zonas z LIMIT 1)
          )
          OR (
            (SELECT COUNT(*) FROM festivo_zonas) > 1
            AND EXISTS (
              SELECT 1
              FROM DatosEmpleados de_fz
              JOIN Clientes cl_fz
                ON ${txt('UPPER(TRIM(cl_fz.`NOMBRE O RAZON SOCIAL`))')}
                 = ${txt('UPPER(TRIM(de_fz.`CENTRO TRABAJO`))')}
              JOIN festivo_zonas z_fz
                ON ${txt('z_fz.ine')} = ${txt('fi.municipio_ine')}
               AND ${txt('UPPER(TRIM(cl_fz.POBLACION))')} = ${txt('UPPER(TRIM(z_fz.nombre))')}
              WHERE ${txt('TRIM(CAST(de_fz.CODIGO AS CHAR))')} = ${txt(id)}
            )
          )
        )
      )`;
  }

  async getZonas(): Promise<CatalogMunicipio[]> {
    if (!(await this.hasSchema())) return [];
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        ine: string;
        slug: string;
        nombre: string;
        ccaa_slug: string;
        provincia_slug: string;
        ccaa_code: string;
      }>
    >(
      `SELECT ine, slug, nombre, ccaa_slug, provincia_slug, ccaa_code
       FROM festivo_zonas
       ORDER BY nombre ASC`,
    );
    return (rows || []).map((row) => ({
      ine: row.ine,
      slug: row.slug,
      nombre: row.nombre,
      ccaaSlug: row.ccaa_slug,
      provinciaSlug: row.provincia_slug,
      ccaaCode: row.ccaa_code || 'ES-MD',
    }));
  }

  async setZonas(ines: string[]): Promise<{
    zonas: CatalogMunicipio[];
    local: { inserted: number; updated: number };
  }> {
    if (!(await this.hasSchema())) {
      throw new BadRequestException(
        'Falta la migración de zonas. Ejecuta scripts/run-festivo-zonas-migration.js',
      );
    }
    const unique = [
      ...new Set(ines.map((ine) => String(ine || '').trim()).filter(Boolean)),
    ];
    const catalog = await this.listCatalog();
    const byIne = new Map(catalog.map((item) => [item.ine, item]));
    const selected = unique.map((ine) => {
      const found = byIne.get(ine);
      if (!found) {
        throw new BadRequestException(`Municipio desconocido: ${ine}`);
      }
      return found;
    });

    await this.prisma.$executeRawUnsafe(`DELETE FROM festivo_zonas`);
    for (const zona of selected) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO festivo_zonas (ine, slug, nombre, ccaa_slug, provincia_slug, ccaa_code)
         VALUES (
           ${this.escapeSql(zona.ine)},
           ${this.escapeSql(zona.slug)},
           ${this.escapeSql(zona.nombre)},
           ${this.escapeSql(zona.ccaaSlug)},
           ${this.escapeSql(zona.provinciaSlug)},
           ${this.escapeSql(zona.ccaaCode)}
         )`,
      );
    }

    const year = new Date().getFullYear();
    const local = await this.syncLocalHolidays([year, year + 1]);
    return { zonas: selected, local };
  }

  async syncLocalHolidays(
    years: number[],
  ): Promise<{ inserted: number; updated: number }> {
    const zonas = await this.getZonas();
    let inserted = 0;
    let updated = 0;
    for (const year of years) {
      for (const zona of zonas) {
        const holidays = await this.fetchLocalHolidays(year, zona);
        for (const holiday of holidays) {
          const result = await this.upsertLocal(holiday, zona);
          if (result === 'inserted') inserted += 1;
          else if (result === 'updated') updated += 1;
        }
      }
    }
    this.logger.log(
      `Festivos locales: zonas=${zonas.length} inserted=${inserted} updated=${updated}`,
    );
    return { inserted, updated };
  }

  async calendarioForEmpleado(codigo: string, year: number) {
    if (!(await this.hasSchema())) {
      const festivos = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, date, name, scope, ccaa_code, observed_date, active, notes
         FROM fiestas
         WHERE YEAR(date) = ${Number(year)} AND active = 1
         ORDER BY date ASC`,
      );
      return {
        needsZoneChoice: false,
        schemaPending: true,
        source: 'ninguna',
        zona: null,
        zonas: [],
        festivos: festivos || [],
      };
    }
    const today = this.madridToday();
    const decision = await this.resolveDecision(codigo, today);
    const festivos = await this.loadYearRows(year);
    const visible = festivos
      .filter((row) => fiestaVisibleForZona(row, decision.zona))
      .map((row) => ({
        id: row.id,
        date: row.date,
        name: row.name,
        scope: row.scope,
        ccaa_code: row.ccaaCode,
        municipio_ine: row.municipioIne || null,
        municipio_nombre: row.municipioNombre,
        observed_date: observedDateForClient(row),
        active: 1,
      }));
    return {
      needsZoneChoice: decision.needsChoice,
      source: decision.source,
      zona: decision.zona
        ? { ine: decision.zona.ine, nombre: decision.zona.nombre }
        : null,
      zonas: (await this.getZonas()).map((zona) => ({
        ine: zona.ine,
        nombre: zona.nombre,
      })),
      festivos: visible,
    };
  }

  async elegirZonaHoy(
    codigo: string,
    ine: string,
  ): Promise<{ ine: string; nombre: string }> {
    const cleanCodigo = String(codigo || '').trim();
    const cleanIne = String(ine || '').trim();
    if (!cleanCodigo) throw new BadRequestException('Empleado sin código');
    const zonas = await this.getZonas();
    const zona = zonas.find((item) => item.ine === cleanIne);
    if (!zona)
      throw new BadRequestException('Esa zona no está activa en la empresa');
    const fecha = this.madridToday();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO fichaje_zona_dia (codigo, fecha, municipio_ine)
       VALUES (${this.escapeSql(cleanCodigo)}, ${this.escapeSql(fecha)}, ${this.escapeSql(cleanIne)})
       ON DUPLICATE KEY UPDATE municipio_ine = ${this.escapeSql(cleanIne)}`,
    );
    return { ine: zona.ine, nombre: zona.nombre };
  }

  async fiestaForEmployees(
    codigos: string[],
    dateStr: string,
  ): Promise<
    Map<
      string,
      {
        isFiesta: boolean;
        name: string | null;
        kind: 'nacional' | 'autonomico' | 'local' | null;
      }
    >
  > {
    const map = new Map<
      string,
      {
        isFiesta: boolean;
        name: string | null;
        kind: 'nacional' | 'autonomico' | 'local' | null;
      }
    >();
    if (codigos.length === 0) return map;
    const [zonas, places, choices, fiestas] = await Promise.all([
      this.getZonas(),
      this.loadPlaces(codigos),
      this.loadChoices(codigos, dateStr),
      this.loadFiestasOn(dateStr),
    ]);
    const rank = { local: 1, autonomico: 2, nacional: 3 } as const;
    for (const codigo of codigos) {
      const place = places.get(codigo);
      const decision = decideZona({
        hasCenter: !!place?.hasCenter,
        poblacion: place?.poblacion ?? null,
        zonas,
        chosenIne: choices.get(codigo) ?? null,
      });
      const hits = fiestas.filter((row) =>
        fiestaAppliesToZona(row, decision.zona, dateStr),
      );
      let kind: 'nacional' | 'autonomico' | 'local' | null = null;
      for (const row of hits) {
        const next = scopeKind(row.scope);
        if (next !== 'nacional' && next !== 'autonomico' && next !== 'local')
          continue;
        if (!kind || rank[next] > rank[kind]) kind = next;
      }
      const names = hits.map((row) => row.name);
      map.set(codigo, {
        isFiesta: names.length > 0,
        name: names.length ? [...new Set(names)].join(', ') : null,
        kind,
      });
    }
    return map;
  }

  /** Festivo local de azi, pe numele orașului din zonele bifate. */
  async localHolidayByTown(dateStr: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!(await this.hasSchema())) return map;
    const [zonas, fiestas] = await Promise.all([
      this.getZonas(),
      this.loadFiestasOn(dateStr),
    ]);
    for (const zona of zonas) {
      const hit = fiestas.find(
        (row) =>
          scopeKind(row.scope) === 'local' &&
          fiestaAppliesToZona(row, zona, dateStr),
      );
      if (hit) map.set(normalizePlaceName(zona.nombre), hit.name);
    }
    return map;
  }

  private async resolveDecision(
    codigo: string,
    dateStr: string,
  ): Promise<ZonaDecision> {
    const zonas = await this.getZonas();
    const places = await this.loadPlaces([codigo]);
    const choices = await this.loadChoices([codigo], dateStr);
    const place = places.get(codigo);
    return decideZona({
      hasCenter: !!place?.hasCenter,
      poblacion: place?.poblacion ?? null,
      zonas,
      chosenIne: choices.get(codigo) ?? null,
    });
  }

  private async fetchLocalHolidays(
    year: number,
    zona: CatalogMunicipio,
  ): Promise<LocalHoliday[]> {
    const url = `${API_BASE}/${year}/localidades/${zona.ccaaSlug}/${zona.provinciaSlug}/${zona.slug}.json`;
    try {
      const response = await axios.get(url, {
        timeout: 20000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DeCamino-Servicios/1.0',
        },
        validateStatus: (status) => status === 200 || status === 404,
      });
      if (response.status === 404) return [];
      const list = response.data?.holidays?.calendar;
      if (!Array.isArray(list)) return [];
      return list.filter((item: LocalHoliday) => {
        const scope = String(item?.scope || '').toLowerCase();
        const date = String(item?.date || '').slice(0, 10);
        return (
          (scope === 'local' || scope === 'municipal') &&
          /^\d{4}-\d{2}-\d{2}$/.test(date)
        );
      });
    } catch (error: any) {
      this.logger.warn(
        `Local ${zona.slug} ${year}: ${error?.message || error}`,
      );
      return [];
    }
  }

  private async upsertLocal(
    holiday: LocalHoliday,
    zona: CatalogMunicipio,
  ): Promise<'inserted' | 'updated' | 'unchanged'> {
    const date = String(holiday.date).slice(0, 10);
    const name = localFestivoName(holiday.name, zona.nombre);
    const notes = `calendariosnacionales | local | ${zona.ine} | synced:${new Date().toISOString().slice(0, 10)}`;
    const existing = await this.prisma.$queryRawUnsafe<
      Array<{ id: number; name: string }>
    >(
      `SELECT id, name
       FROM fiestas
       WHERE \`date\` = ${this.escapeSql(date)}
         AND municipio_ine = ${this.escapeSql(zona.ine)}
       LIMIT 1`,
    );
    if (existing?.[0]) {
      const keptName = isGenericLocalName(existing[0].name)
        ? name
        : existing[0].name;
      await this.prisma.$executeRawUnsafe(
        `UPDATE fiestas
         SET name = ${this.escapeSql(keptName)},
             scope = 'Local',
             ccaa_code = ${this.escapeSql(zona.ccaaCode)},
             municipio_nombre = ${this.escapeSql(zona.nombre)},
             observed_date = ${this.escapeSql(date)},
             active = 1,
             notes = ${this.escapeSql(notes)}
         WHERE id = ${Number(existing[0].id)}`,
      );
      await this.retireShadowRows(date, Number(existing[0].id), zona);
      return existing[0].name === keptName ? 'unchanged' : 'updated';
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE fiestas
       SET scope = 'Local',
           municipio_ine = ${this.escapeSql(zona.ine)},
           municipio_nombre = ${this.escapeSql(zona.nombre)},
           observed_date = ${this.escapeSql(date)},
           active = 1
       WHERE \`date\` = ${this.escapeSql(date)}
         AND municipio_ine = ''
         AND LOWER(scope) IN ('local', 'municipal')`,
    );
    const claimed = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM fiestas
       WHERE \`date\` = ${this.escapeSql(date)}
         AND municipio_ine = ${this.escapeSql(zona.ine)}
       LIMIT 1`,
    );
    if (claimed?.[0]) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE fiestas
         SET name = ${this.escapeSql(name)},
             notes = ${this.escapeSql(notes)}
         WHERE id = ${Number(claimed[0].id)}`,
      );
      await this.retireShadowRows(date, Number(claimed[0].id), zona);
      return 'updated';
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO fiestas (date, name, scope, ccaa_code, municipio_ine, municipio_nombre, observed_date, active, notes)
       VALUES (
         ${this.escapeSql(date)},
         ${this.escapeSql(name)},
         'Local',
         ${this.escapeSql(zona.ccaaCode)},
         ${this.escapeSql(zona.ine)},
         ${this.escapeSql(zona.nombre)},
         ${this.escapeSql(date)},
         1,
         ${this.escapeSql(notes)}
       )`,
    );
    const inserted = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM fiestas
       WHERE \`date\` = ${this.escapeSql(date)}
         AND municipio_ine = ${this.escapeSql(zona.ine)}
       ORDER BY id DESC
       LIMIT 1`,
    );
    if (inserted?.[0]) {
      await this.retireShadowRows(date, Number(inserted[0].id), zona);
    }
    return 'inserted';
  }

  /**
   * Un festivo manual pe aceeași zi (San Isidro marcat Nacional) nu mai rămâne
   * lângă rândul local. Numele lui, dacă e mai clar, trece pe rândul local.
   * Rândurile oficiale naționale / de comunitate rămân.
   */
  private async retireShadowRows(
    date: string,
    localId: number,
    zona: CatalogMunicipio,
  ): Promise<void> {
    const shadows = await this.prisma.$queryRawUnsafe<
      Array<{ id: number; name: string; scope: string; notes: string | null }>
    >(
      `SELECT id, name, scope, notes
       FROM fiestas
       WHERE \`date\` = ${this.escapeSql(date)}
         AND active = 1
         AND id <> ${Number(localId)}
         AND (municipio_ine = '' OR municipio_ine IS NULL)`,
    );
    for (const shadow of shadows || []) {
      if (isOfficialNonLocalRow(shadow)) continue;
      if (!isGenericLocalName(shadow.name)) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE fiestas
           SET name = ${this.escapeSql(String(shadow.name).slice(0, 160))}
           WHERE id = ${Number(localId)}
             AND name LIKE 'Festivo local de %'`,
        );
      }
      const note = `sustituido por festivo local ${zona.ine}`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE fiestas
         SET active = 0,
             notes = CONCAT(IFNULL(notes, ''), ' | ', ${this.escapeSql(note)})
         WHERE id = ${Number(shadow.id)}`,
      );
    }
  }

  private async loadYearRows(
    year: number,
  ): Promise<
    Array<FiestaRow & { id: number; municipioNombre: string | null }>
  > {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        d: string;
        obs: string | null;
        name: string;
        scope: string;
        ccaa_code: string | null;
        municipio_ine: string | null;
        municipio_nombre: string | null;
        active: number;
      }>
    >(
      `SELECT id,
              DATE_FORMAT(\`date\`, '%Y-%m-%d') AS d,
              DATE_FORMAT(observed_date, '%Y-%m-%d') AS obs,
              name, scope, ccaa_code, municipio_ine, municipio_nombre, active
       FROM fiestas
       WHERE active = 1 AND YEAR(\`date\`) = ${Number(year)}
       ORDER BY \`date\` ASC`,
    );
    return (rows || []).map((row) => ({
      id: Number(row.id),
      date: row.d,
      observedDate: row.obs,
      name: row.name,
      scope: row.scope,
      ccaaCode: row.ccaa_code,
      municipioIne: row.municipio_ine || '',
      municipioNombre: row.municipio_nombre,
      active: !!row.active,
    }));
  }

  private async loadFiestasOn(dateStr: string): Promise<FiestaRow[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        d: string;
        obs: string | null;
        name: string;
        scope: string;
        ccaa_code: string | null;
        municipio_ine: string | null;
        active: number;
      }>
    >(
      `SELECT DATE_FORMAT(\`date\`, '%Y-%m-%d') AS d,
              DATE_FORMAT(observed_date, '%Y-%m-%d') AS obs,
              name, scope, ccaa_code, municipio_ine, active
       FROM fiestas
       WHERE active = 1
         AND (
           \`date\` = ${this.escapeSql(dateStr)}
           OR (
             observed_date = ${this.escapeSql(dateStr)}
             AND ABS(DATEDIFF(observed_date, \`date\`)) <= 14
           )
         )`,
    );
    return (rows || []).map((row) => ({
      date: row.d,
      observedDate: row.obs,
      name: row.name,
      scope: row.scope,
      ccaaCode: row.ccaa_code,
      municipioIne: row.municipio_ine || '',
      active: !!row.active,
    }));
  }

  private async loadPlaces(
    codigos: string[],
  ): Promise<Map<string, { hasCenter: boolean; poblacion: string | null }>> {
    const map = new Map<
      string,
      { hasCenter: boolean; poblacion: string | null }
    >();
    if (codigos.length === 0) return map;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ codigo: string; centro: string | null; poblacion: string | null }>
    >(
      `SELECT TRIM(CAST(de.CODIGO AS CHAR)) AS codigo,
              NULLIF(TRIM(de.\`CENTRO TRABAJO\`), '') AS centro,
              NULLIF(TRIM(c.POBLACION), '') AS poblacion
       FROM DatosEmpleados de
       LEFT JOIN Clientes c
         ON UPPER(TRIM(c.\`NOMBRE O RAZON SOCIAL\`)) = UPPER(TRIM(de.\`CENTRO TRABAJO\`))
       WHERE TRIM(CAST(de.CODIGO AS CHAR)) IN (${this.inList(codigos)})`,
    );
    for (const row of rows || []) {
      if (!row.codigo || map.has(row.codigo)) continue;
      map.set(row.codigo, {
        hasCenter: !!row.centro,
        poblacion: row.poblacion,
      });
    }
    return map;
  }

  private async loadChoices(
    codigos: string[],
    dateStr: string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (codigos.length === 0) return map;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ codigo: string; municipio_ine: string }>
    >(
      `SELECT TRIM(codigo) AS codigo, municipio_ine
       FROM fichaje_zona_dia
       WHERE fecha = ${this.escapeSql(dateStr)}
         AND TRIM(codigo) IN (${this.inList(codigos)})`,
    );
    for (const row of rows || []) {
      if (row.codigo) map.set(row.codigo, row.municipio_ine);
    }
    return map;
  }

  private inList(values: string[]): string {
    return values.map((value) => this.escapeSql(value)).join(',');
  }

  private escapeSql(value: string): string {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
}
