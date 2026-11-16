import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FestivosZonaService } from './festivos-zona.service';
import {
  decideZona,
  fiestaAppliesOn,
  fiestaAppliesToZona,
  scopeKind,
  type FiestaRow,
  type Zona,
} from './festivos-zona.logic';
import {
  collapseTemplates,
  eachIsoDate,
  evaluatePermisoRange,
  madridIsoDate,
  presentPermisoDuration,
  presentRegisteredDuration,
  slotFromMonthRows,
  weekdayPrefix,
  type HolidayState,
  type PermisoDuration,
} from './permiso-retribuido-duration.logic';

type MonthRow = {
  codigo: string;
  luna: unknown;
  visible?: unknown;
  cells: Record<string, unknown>;
};

type TemplateRow = {
  centro: string;
  grupo: string;
  vd: string | null;
  vh: string | null;
  times: Record<string, unknown>;
};

type RangeRequest = {
  codigo: string;
  inicio: string;
  fin: string;
};

const WEEK_PREFIXES = ['lun', 'mar', 'mie', 'joi', 'vin', 'sam', 'dum'];

@Injectable()
export class PermisoRetribuidoDurationService {
  private readonly logger = new Logger(PermisoRetribuidoDurationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly festivos: FestivosZonaService,
  ) {}

  async evaluate(
    codigo: string,
    inicio: string,
    fin: string,
  ): Promise<PermisoDuration> {
    const [result] = await this.evaluateMany([{ codigo, inicio, fin }]);
    return result;
  }

  async evaluateMany(requests: RangeRequest[]): Promise<PermisoDuration[]> {
    if (requests.length === 0) return [];
    try {
      return await this.evaluateManyUnsafe(requests);
    } catch (error: any) {
      this.logger.warn(
        `No se pudo leer el programa del permiso: ${error?.message || error}`,
      );
      return requests.map((request) => this.unreadable(request));
    }
  }

  async attachSolicitudes(rows: any[]): Promise<void> {
    const targets = (rows || []).filter((row) =>
      this.isPermisoRow(row?.tipo || row?.TIPO),
    );
    if (targets.length === 0) return;
    const stored = await this.readStoredBySolicitud(
      targets.map((row) => String(row.id || row.ID || '')),
    );
    const previews = await this.evaluateMany(
      targets.map((row) => ({
        codigo: String(row.codigo || row.CODIGO || ''),
        inicio: this.rowStart(row),
        fin: this.rowEnd(row),
      })),
    );
    targets.forEach((row, index) => {
      const key = String(row.id || row.ID || '');
      const estado = String(row.estado || row.ESTADO || '').toLowerCase();
      const saved = stored.get(key);
      row.permiso_duracion =
        estado === 'aprobada' || estado === 'aprobado'
          ? presentRegisteredDuration(previews[index], saved)
          : previews[index];
    });
  }

  async attachAusencias(rows: any[]): Promise<void> {
    const targets = (rows || []).filter((row) =>
      this.isPermisoRow(row?.TIPO || row?.tipo),
    );
    if (targets.length === 0) return;
    const previews = await this.evaluateMany(
      targets.map((row) => {
        const range = this.splitFecha(row.FECHA || row.fecha);
        return {
          codigo: String(row.CODIGO || row.codigo || ''),
          inicio: range.inicio,
          fin: range.fin,
        };
      }),
    );
    targets.forEach((row, index) => {
      row.permiso_duracion = presentRegisteredDuration(previews[index], {
        unidad: row.UNIDAD_DURACION || row.unidad_duracion,
        dias: row.DURACION || row.duracion,
      });
    });
  }

  private isPermisoRow(tipo: unknown): boolean {
    return (
      String(tipo || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '') === 'permiso retribuido'
    );
  }

  private unreadable(request: RangeRequest): PermisoDuration {
    const dates = eachIsoDate(request.inicio, request.fin);
    return presentPermisoDuration(
      dates.map((date) => ({ date, status: 'unknown', source: 'none' })),
    );
  }

  private async evaluateManyUnsafe(
    requests: RangeRequest[],
  ): Promise<PermisoDuration[]> {
    const normalized = requests.map((request) => ({
      codigo: String(request.codigo || '').trim(),
      inicio: madridIsoDate(request.inicio) || '',
      fin: madridIsoDate(request.fin) || '',
    }));
    const codes = [
      ...new Set(normalized.map((item) => item.codigo).filter(Boolean)),
    ];
    const spans = normalized.filter(
      (item) => item.inicio && item.fin && item.fin >= item.inicio,
    );
    const min = spans.reduce(
      (acc, item) => (item.inicio < acc ? item.inicio : acc),
      spans[0]?.inicio || '',
    );
    const max = spans.reduce(
      (acc, item) => (item.fin > acc ? item.fin : acc),
      spans[0]?.fin || '',
    );

    const [employees, cuadrantes, multicentros, extras, templates, holidays] =
      codes.length === 0 || !min
        ? [[], [], [], new Map<string, string[]>(), [], this.emptyHolidays()]
        : await Promise.all([
            this.loadEmployees(codes),
            this.loadMonthRows('cuadrante', codes, true),
            this.loadMonthRows('horario_multicentro', codes, false),
            this.loadExtras(codes),
            this.loadTemplates(),
            this.loadHolidays(codes, min, max),
          ]);

    const employeesByCode = new Map(employees.map((row) => [row.codigo, row]));
    const cuadranteByCode = this.groupRows(cuadrantes);
    const multiByCode = this.groupRows(multicentros);

    return normalized.map((request) => {
      if (!request.inicio || !request.fin || request.fin < request.inicio) {
        const blank = this.unreadable(request);
        return {
          ...blank,
          status: 'needs_verification' as const,
          workingDays: null,
          headline: 'Duración pendiente de verificar',
          detail: 'El intervalo de fechas no es válido.',
          text: 'Duración pendiente de verificar. El intervalo de fechas no es válido.',
        };
      }
      const employee = employeesByCode.get(request.codigo);
      const centros = [
        employee?.centro || '',
        ...(extras.get(request.codigo) || []),
      ].filter((centro, index, list) => {
        const key = centro.trim().toLowerCase();
        return (
          key &&
          list.findIndex((item) => item.trim().toLowerCase() === key) === index
        );
      });
      const dates = eachIsoDate(request.inicio, request.fin);
      const days = dates.map((date) => {
        const [year, month, day] = date.split('-').map(Number);
        const holiday = holidays.failed
          ? 'unresolved'
          : this.holidayOn(holidays, request.codigo, date);
        return {
          date,
          cuadrante: slotFromMonthRows(
            cuadranteByCode.get(request.codigo) || [],
            year,
            month,
            day,
            'one',
          ),
          multicentro: slotFromMonthRows(
            multiByCode.get(request.codigo) || [],
            year,
            month,
            day,
            'many',
          ),
          horario: this.templateOn(
            templates,
            centros,
            employee?.grupo || '',
            date,
          ),
          holiday,
        };
      });
      return evaluatePermisoRange({
        inicio: request.inicio,
        fin: request.fin,
        trabajaFestivos: this.worksHolidays(employee?.trabajaFestivos),
        days,
      });
    });
  }

  private templateOn(
    templates: TemplateRow[],
    centros: string[],
    grupo: string,
    date: string,
  ): 'work' | 'off' | 'missing' {
    if (!grupo || centros.length === 0) return 'missing';
    const prefix = weekdayPrefix(date);
    const flags = templates
      .filter(
        (row) =>
          this.same(row.grupo, grupo) &&
          centros.some((centro) => this.same(row.centro, centro)),
      )
      .map((row) => {
        if (!row.vd || row.vd > date) return 'missing' as const;
        if (row.vh && row.vh < date) return 'missing' as const;
        const works = [1, 2, 3].some((index) => {
          const value = row.times[`${prefix}_in${index}`];
          return value != null && String(value).trim() !== '';
        });
        return works ? ('work' as const) : ('off' as const);
      });
    return collapseTemplates(flags);
  }

  private holidayOn(
    holidays: HolidayLoad,
    codigo: string,
    date: string,
  ): HolidayState {
    const decision = holidays.decisions.get(codigo);
    const zona = decision?.zona ?? null;
    const needsChoice = decision?.needsChoice === true;
    const onDay = holidays.rows.filter(
      (row) => row.active && fiestaAppliesOn(row, date),
    );
    const applicable = onDay.filter((row) =>
      fiestaAppliesToZona(row, zona, date),
    );
    const known = applicable.some((row) => {
      const kind = scopeKind(row.scope);
      return kind === 'nacional' || kind === 'autonomico' || kind === 'local';
    });
    if (known) return 'applies';
    const unclear = onDay.some((row) => {
      const kind = scopeKind(row.scope);
      if (kind === 'otro') return true;
      return needsChoice && (kind === 'local' || kind === 'autonomico');
    });
    return unclear ? 'unresolved' : 'none';
  }

  private worksHolidays(value: unknown): boolean {
    return ['si', 'sí', 's', '1', 'true', 'da', 'y'].includes(
      String(value || '')
        .trim()
        .toLowerCase(),
    );
  }

  private same(left: unknown, right: unknown): boolean {
    return (
      String(left || '')
        .trim()
        .toLowerCase() ===
      String(right || '')
        .trim()
        .toLowerCase()
    );
  }

  private groupRows(rows: MonthRow[]): Map<string, MonthRow[]> {
    const map = new Map<string, MonthRow[]>();
    for (const row of rows) {
      const list = map.get(row.codigo) || [];
      list.push(row);
      map.set(row.codigo, list);
    }
    return map;
  }

  private async loadEmployees(codes: string[]): Promise<
    Array<{
      codigo: string;
      centro: string;
      grupo: string;
      trabajaFestivos: string | null;
    }>
  > {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        codigo: string;
        centro: string | null;
        grupo: string | null;
        trabajaFestivos: string | null;
      }>
    >(
      `SELECT TRIM(CAST(CODIGO AS CHAR)) AS codigo,
              TRIM(\`CENTRO TRABAJO\`) AS centro,
              TRIM(GRUPO) AS grupo,
              TrabajaFestivos AS trabajaFestivos
       FROM DatosEmpleados
       WHERE TRIM(CAST(CODIGO AS CHAR)) IN (${this.inList(codes)})`,
    );
    return (rows || []).map((row) => ({
      codigo: String(row.codigo || '').trim(),
      centro: String(row.centro || '').trim(),
      grupo: String(row.grupo || '').trim(),
      trabajaFestivos: row.trabajaFestivos,
    }));
  }

  private async loadExtras(codes: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ codigo: string; centro: string | null }>
      >(
        `SELECT TRIM(codigo) AS codigo, TRIM(centro) AS centro
         FROM empleado_centros
         WHERE TRIM(codigo) IN (${this.inList(codes)})`,
      );
      for (const row of rows || []) {
        const codigo = String(row.codigo || '').trim();
        const centro = String(row.centro || '').trim();
        if (!codigo || !centro) continue;
        const list = map.get(codigo) || [];
        list.push(centro);
        map.set(codigo, list);
      }
    } catch (error: any) {
      this.logger.warn(
        `empleado_centros no disponible: ${error?.message || error}`,
      );
    }
    return map;
  }

  private async loadMonthRows(
    table: 'cuadrante' | 'horario_multicentro',
    codes: string[],
    withVisible: boolean,
  ): Promise<MonthRow[]> {
    const zi = Array.from({ length: 31 }, (_, index) => `ZI_${index + 1}`).join(
      ', ',
    );
    const visible = withVisible ? ', visible' : '';
    const rows = await this.prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(
      `SELECT TRIM(CAST(CODIGO AS CHAR)) AS codigo, LUNA${visible}, ${zi}
       FROM ${table}
       WHERE TRIM(CAST(CODIGO AS CHAR)) IN (${this.inList(codes)})`,
    );
    return (rows || []).map((row) => {
      const cells: Record<string, unknown> = {};
      for (let day = 1; day <= 31; day += 1) {
        cells[String(day)] = row[`ZI_${day}`];
      }
      return {
        codigo: String(row.codigo || '').trim(),
        luna: row.LUNA,
        visible: withVisible ? row.visible : undefined,
        cells,
      };
    });
  }

  private async loadTemplates(): Promise<TemplateRow[]> {
    const times = WEEK_PREFIXES.flatMap((prefix) =>
      [1, 2, 3].map(
        (index) =>
          `TIME_FORMAT(${prefix}_in${index}, '%H:%i') AS ${prefix}_in${index}`,
      ),
    ).join(', ');
    const rows = await this.prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(
      `SELECT centro_nombre, grupo_nombre,
              DATE_FORMAT(vigente_desde, '%Y-%m-%d') AS vd,
              DATE_FORMAT(vigente_hasta, '%Y-%m-%d') AS vh,
              ${times}
       FROM horarios`,
    );
    return (rows || []).map((row) => {
      const timeMap: Record<string, unknown> = {};
      for (const prefix of WEEK_PREFIXES) {
        for (const index of [1, 2, 3]) {
          timeMap[`${prefix}_in${index}`] = row[`${prefix}_in${index}`];
        }
      }
      return {
        centro: String(row.centro_nombre || ''),
        grupo: String(row.grupo_nombre || ''),
        vd: row.vd ? String(row.vd) : null,
        vh: row.vh ? String(row.vh) : null,
        times: timeMap,
      };
    });
  }

  private emptyHolidays(): HolidayLoad {
    return { rows: [], decisions: new Map(), failed: true };
  }

  private async loadHolidays(
    codes: string[],
    inicio: string,
    fin: string,
  ): Promise<HolidayLoad> {
    try {
      const [zonas, places, choices, rows] = await Promise.all([
        this.festivos.getZonas(),
        this.loadPlaces(codes),
        this.loadChoices(codes, inicio, fin),
        this.prisma.$queryRawUnsafe<
          Array<{
            date: string;
            observed_date: string | null;
            name: string;
            scope: string;
            ccaa_code: string | null;
            municipio_ine: string | null;
            active: number | boolean;
          }>
        >(
          `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date,
                  DATE_FORMAT(observed_date, '%Y-%m-%d') AS observed_date,
                  name, scope, ccaa_code, municipio_ine, active
           FROM fiestas
           WHERE active = 1
             AND (date BETWEEN ${this.escape(inicio)} AND ${this.escape(fin)}
                  OR observed_date BETWEEN ${this.escape(inicio)} AND ${this.escape(fin)})`,
        ),
      ]);
      const zoneList: Zona[] = (zonas || []).map((zona) => ({
        ine: zona.ine,
        nombre: zona.nombre,
        ccaaCode: zona.ccaaCode,
      }));
      const decisions = new Map<
        string,
        { zona: Zona | null; needsChoice: boolean }
      >();
      for (const codigo of codes) {
        const place = places.get(codigo);
        const chosen = choices.get(codigo) || null;
        const decision = decideZona({
          hasCenter: !!place?.hasCenter,
          poblacion: place?.poblacion ?? null,
          zonas: zoneList,
          chosenIne: chosen,
        });
        decisions.set(codigo, {
          zona: decision.zona,
          needsChoice: decision.needsChoice,
        });
      }
      return {
        failed: false,
        decisions,
        rows: (rows || []).map(
          (row): FiestaRow => ({
            date: String(row.date),
            observedDate: row.observed_date ? String(row.observed_date) : null,
            name: row.name,
            scope: row.scope,
            ccaaCode: row.ccaa_code,
            municipioIne: String(row.municipio_ine || ''),
            active: row.active === true || row.active === 1,
          }),
        ),
      };
    } catch (error: any) {
      this.logger.warn(
        `No se pudieron leer los festivos: ${error?.message || error}`,
      );
      return this.emptyHolidays();
    }
  }

  private async loadPlaces(codes: string[]) {
    const map = new Map<
      string,
      { hasCenter: boolean; poblacion: string | null }
    >();
    try {
      return await this.loadPlacesUnsafe(codes);
    } catch (error: any) {
      this.logger.warn(
        `No se pudo leer la población del centro: ${error?.message || error}`,
      );
      return map;
    }
  }

  private async loadPlacesUnsafe(codes: string[]) {
    const map = new Map<
      string,
      { hasCenter: boolean; poblacion: string | null }
    >();
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ codigo: string; centro: string | null; poblacion: string | null }>
    >(
      `SELECT TRIM(CAST(de.CODIGO AS CHAR)) AS codigo,
              NULLIF(TRIM(de.\`CENTRO TRABAJO\`), '') AS centro,
              NULLIF(TRIM(c.POBLACION), '') AS poblacion
       FROM DatosEmpleados de
       LEFT JOIN Clientes c
         ON UPPER(TRIM(c.\`NOMBRE O RAZON SOCIAL\`)) = UPPER(TRIM(de.\`CENTRO TRABAJO\`))
       WHERE TRIM(CAST(de.CODIGO AS CHAR)) IN (${this.inList(codes)})`,
    );
    for (const row of rows || []) {
      const codigo = String(row.codigo || '').trim();
      if (!codigo || map.has(codigo)) continue;
      map.set(codigo, {
        hasCenter: !!row.centro,
        poblacion: row.poblacion,
      });
    }
    return map;
  }

  private async loadChoices(codes: string[], inicio: string, fin: string) {
    const map = new Map<string, string>();
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ codigo: string; municipio_ine: string }>
      >(
        `SELECT TRIM(codigo) AS codigo, municipio_ine
         FROM fichaje_zona_dia
         WHERE TRIM(codigo) IN (${this.inList(codes)})
           AND fecha BETWEEN ${this.escape(inicio)} AND ${this.escape(fin)}
         ORDER BY fecha DESC`,
      );
      for (const row of rows || []) {
        const codigo = String(row.codigo || '').trim();
        if (codigo && !map.has(codigo) && row.municipio_ine) {
          map.set(codigo, row.municipio_ine);
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `fichaje_zona_dia no disponible: ${error?.message || error}`,
      );
    }
    return map;
  }

  private async readStoredBySolicitud(ids: string[]) {
    const map = new Map<string, { unidad: unknown; dias: unknown }>();
    const clean = ids.map((id) => id.trim()).filter(Boolean);
    if (clean.length === 0) return map;
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          solicitud_id: string;
          DURACION: unknown;
          UNIDAD_DURACION: unknown;
        }>
      >(
        `SELECT solicitud_id, DURACION, UNIDAD_DURACION
         FROM Ausencias
         WHERE solicitud_id IN (${this.inList(clean)})`,
      );
      for (const row of rows || []) {
        map.set(String(row.solicitud_id), {
          unidad: row.UNIDAD_DURACION,
          dias: row.DURACION,
        });
      }
    } catch (error: any) {
      this.logger.warn(
        `No se pudo leer la duración guardada: ${error?.message || error}`,
      );
    }
    return map;
  }

  private rowStart(row: any): string {
    return (
      madridIsoDate(row.permiso_fecha_inicio) ||
      madridIsoDate(row.fecha_inicio || row['fecha inicio'] || row.fecha) ||
      this.splitFecha(row.FECHA).inicio
    );
  }

  private rowEnd(row: any): string {
    return (
      madridIsoDate(row.permiso_fecha_fin) ||
      madridIsoDate(row.fecha_fin || row['fecha fin']) ||
      this.splitFecha(row.FECHA).fin ||
      this.rowStart(row)
    );
  }

  private splitFecha(fecha: unknown): { inicio: string; fin: string } {
    const text = String(fecha || '');
    if (text.includes(' - ')) {
      const [inicio, fin] = text.split(' - ');
      return {
        inicio: madridIsoDate(inicio) || '',
        fin: madridIsoDate(fin) || '',
      };
    }
    const one = madridIsoDate(text) || '';
    return { inicio: one, fin: one };
  }

  private escape(value: string): string {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  private inList(values: string[]): string {
    return values.map((value) => this.escape(value)).join(',');
  }
}

type HolidayLoad = {
  rows: FiestaRow[];
  decisions: Map<string, { zona: Zona | null; needsChoice: boolean }>;
  failed: boolean;
};
