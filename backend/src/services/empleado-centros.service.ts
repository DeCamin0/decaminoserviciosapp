import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FestivosZonaService } from './festivos-zona.service';
import { normalizePlaceName } from './festivos-zona.logic';
import {
  intervalsFromWeeklyRow,
  mergeCentroHorarios,
  type CentroBlock,
} from './centros-horario.logic';

export type CentroDayContext = {
  extras: Map<string, string[]>;
  towns: Map<string, string>;
  localByTown: Map<string, string>;
  choices: Map<string, string>;
  /** Festivo local de azi când firma are o singură zonă. Atunci cade pe toate centrele. */
  singleZoneLocalName: string | null;
};

export type CentroDiaResult = {
  mode: 'single' | 'multiple';
  schemaPending?: boolean;
  conflict: boolean;
  opciones: string[];
  elegido: string | null;
  intervals: CentroBlock[];
  festivosLocales: Array<{ centro: string; name: string }>;
  wholeDayFestivo: boolean;
  slotRaw: string | null;
  entryMarginMinutes: number;
  exitMarginMinutes: number;
};

@Injectable()
export class EmpleadoCentrosService {
  private schemaReady: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly festivosZona: FestivosZonaService,
  ) {}

  async hasSchema(): Promise<boolean> {
    if (this.schemaReady === true) return true;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT 1 AS ok
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'empleado_centros'
       LIMIT 1`,
    );
    this.schemaReady = (rows || []).length > 0;
    return this.schemaReady;
  }

  async getCentros(codigo: string): Promise<{
    primario: string;
    extras: string[];
    schemaPending: boolean;
  }> {
    const clean = String(codigo || '').trim();
    const primario = await this.loadPrimario(clean);
    if (!(await this.hasSchema())) {
      return { primario, extras: [], schemaPending: true };
    }
    const extras = await this.loadExtras([clean]);
    return {
      primario,
      extras: (extras.get(clean) || []).filter(
        (centro) => centro.toLowerCase() !== primario.toLowerCase(),
      ),
      schemaPending: false,
    };
  }

  async setExtras(codigo: string, centros: string[]): Promise<string[]> {
    const clean = String(codigo || '').trim();
    if (!clean) throw new BadRequestException('Empleado sin código');
    if (!(await this.hasSchema())) {
      throw new BadRequestException(
        'Falta la tabla de centros. Ejecuta scripts/run-empleado-centros-migration.js',
      );
    }
    const primario = await this.loadPrimario(clean);
    const unique: string[] = [];
    for (const raw of centros || []) {
      const name = String(raw || '')
        .trim()
        .slice(0, 300);
      if (!name) continue;
      if (primario && name.toLowerCase() === primario.toLowerCase()) continue;
      if (unique.some((item) => item.toLowerCase() === name.toLowerCase()))
        continue;
      unique.push(name);
    }
    if (unique.length > 8) {
      throw new BadRequestException('Máximo 8 centros extra');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM empleado_centros WHERE TRIM(codigo) = ${this.escapeSql(clean)}`,
    );
    for (const centro of unique) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO empleado_centros (codigo, centro)
         VALUES (${this.escapeSql(clean)}, ${this.escapeSql(centro)})`,
      );
    }
    return unique;
  }

  async elegirHoy(codigo: string, centro: string): Promise<{ centro: string }> {
    const clean = String(codigo || '').trim();
    const chosen = String(centro || '').trim();
    if (!clean || !chosen) throw new BadRequestException('Faltan datos');
    if (!(await this.hasSchema())) {
      throw new BadRequestException('Falta la tabla de centros');
    }
    const propios = await this.getCentros(clean);
    const allowed = [propios.primario, ...propios.extras].filter(Boolean);
    const match = allowed.find(
      (item) => item.toLowerCase() === chosen.toLowerCase(),
    );
    if (!match) throw new BadRequestException('Ese centro no está asignado');
    const fecha = this.madridToday();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO fichaje_centro_dia (codigo, fecha, centro)
       VALUES (${this.escapeSql(clean)}, ${this.escapeSql(fecha)}, ${this.escapeSql(match)})
       ON DUPLICATE KEY UPDATE centro = ${this.escapeSql(match)}`,
    );
    return { centro: match };
  }

  async diaHoy(codigo: string): Promise<CentroDiaResult> {
    const empty: CentroDiaResult = {
      mode: 'single',
      conflict: false,
      opciones: [],
      elegido: null,
      intervals: [],
      festivosLocales: [],
      wholeDayFestivo: false,
      slotRaw: null,
      entryMarginMinutes: 15,
      exitMarginMinutes: 15,
    };
    const clean = String(codigo || '').trim();
    if (!clean || !(await this.hasSchema())) {
      return { ...empty, schemaPending: true };
    }
    const employee = await this.loadEmployee(clean);
    if (!employee?.centro || !employee.grupo) return empty;
    const today = this.madridToday();
    const ctx = await this.loadDayContext([clean], today);
    if (!ctx) return { ...empty, schemaPending: true };
    const weekday = this.weekdayPrefix(today);
    const horarios = await this.loadHorarios(today);
    const merged = this.mergeForEmployee({
      codigo: clean,
      centro: employee.centro,
      grupo: employee.grupo,
      prefix: weekday,
      horarios,
      ctx,
    });
    if (!merged) return empty;
    const [fiesta, zonas] = await Promise.all([
      this.festivosZona.fiestaForEmployees([clean], today),
      this.festivosZona.getZonas(),
    ]);
    const info = fiesta.get(clean);
    const oneZone = zonas.length === 1;
    return {
      mode: 'multiple',
      conflict: merged.conflict,
      opciones: merged.opciones,
      elegido: merged.elegido,
      intervals: merged.intervals,
      festivosLocales: merged.festivosLocales,
      wholeDayFestivo: !!info?.isFiesta && (info.kind !== 'local' || oneZone),
      slotRaw: merged.slotRaw,
      entryMarginMinutes: merged.entryMarginMinutes,
      exitMarginMinutes: merged.exitMarginMinutes,
    };
  }

  async loadDayContext(
    codigos: string[],
    dateStr: string,
  ): Promise<CentroDayContext | null> {
    if (!(await this.hasSchema()) || codigos.length === 0) return null;
    const extras = await this.loadExtras(codigos);
    const hasAny = [...extras.values()].some((list) => list.length > 0);
    if (!hasAny) {
      return {
        extras,
        towns: new Map(),
        localByTown: new Map(),
        choices: new Map(),
        singleZoneLocalName: null,
      };
    }
    const names = new Set<string>();
    for (const list of extras.values()) {
      for (const centro of list) names.add(centro);
    }
    const primaries = await this.prisma.$queryRawUnsafe<
      Array<{ centro: string | null }>
    >(
      `SELECT NULLIF(TRIM(\`CENTRO TRABAJO\`), '') AS centro
       FROM DatosEmpleados
       WHERE TRIM(CAST(CODIGO AS CHAR)) IN (${this.inList(codigos)})`,
    );
    for (const row of primaries || []) {
      if (row.centro) names.add(row.centro);
    }
    const [towns, localByTown, choices, zonas] = await Promise.all([
      this.loadTowns([...names]),
      this.festivosZona.localHolidayByTown(dateStr),
      this.loadChoices(codigos, dateStr),
      this.festivosZona.getZonas(),
    ]);
    const singleZoneLocalName =
      zonas.length === 1
        ? localByTown.get(normalizePlaceName(zonas[0].nombre)) || null
        : null;
    return { extras, towns, localByTown, choices, singleZoneLocalName };
  }

  mergeForEmployee(input: {
    codigo: string;
    centro: string;
    grupo: string;
    prefix: string;
    horarios: Array<Record<string, unknown>>;
    ctx: CentroDayContext;
  }): {
    intervals: CentroBlock[];
    conflict: boolean;
    opciones: string[];
    elegido: string | null;
    festivosLocales: Array<{ centro: string; name: string }>;
    slotRaw: string;
    entryMarginMinutes: number;
    exitMarginMinutes: number;
  } | null {
    const extras = input.ctx.extras.get(input.codigo) || [];
    if (extras.length === 0) return null;
    const centros = [input.centro];
    for (const extra of extras) {
      if (!centros.some((item) => item.toLowerCase() === extra.toLowerCase())) {
        centros.push(extra);
      }
    }
    if (centros.length < 2) return null;

    const groups = centros.map((centro) => {
      const row = this.findHorario(input.horarios, centro, input.grupo);
      return {
        centro,
        row,
        intervals: row ? intervalsFromWeeklyRow(row, input.prefix) : [],
      };
    });
    const withHours = groups.filter((group) => group.intervals.length > 0);
    if (withHours.length < 2) return null;

    const primary = this.findHorario(input.horarios, input.centro, input.grupo);
    const entryMarginMinutes =
      Number(primary?.entry_margin_minutes ?? 15) || 15;
    const exitMarginMinutes = Number(primary?.exit_margin_minutes ?? 15) || 15;
    const merged = mergeCentroHorarios(withHours);
    const elegidoRaw = input.ctx.choices.get(input.codigo) || null;
    const elegido = merged.conflict
      ? centros.find(
          (centro) =>
            centro.toLowerCase() === String(elegidoRaw || '').toLowerCase(),
        ) || null
      : null;

    let intervals: CentroBlock[];
    if (merged.conflict) {
      const active = elegido || input.centro;
      const group = groups.find(
        (item) => item.centro.toLowerCase() === active.toLowerCase(),
      );
      intervals = (group?.intervals || []).map((interval) => ({
        ...interval,
        centro: group?.centro || active,
      }));
    } else {
      intervals = merged.intervals;
    }

    const festivosLocales: Array<{ centro: string; name: string }> = [];
    if (input.ctx.singleZoneLocalName) {
      const name = input.ctx.singleZoneLocalName;
      for (const interval of intervals) {
        if (!festivosLocales.some((item) => item.centro === interval.centro)) {
          festivosLocales.push({ centro: interval.centro, name });
        }
      }
      intervals = [];
    } else {
      intervals = intervals.filter((interval) => {
        const name = this.localName(interval.centro, input.ctx);
        if (!name) return true;
        if (!festivosLocales.some((item) => item.centro === interval.centro)) {
          festivosLocales.push({ centro: interval.centro, name });
        }
        return false;
      });
    }

    const slotRaw = intervals
      .map(
        (interval) =>
          `${interval.horaIn}-${interval.horaOut} ${interval.centro}`,
      )
      .join(' | ');

    return {
      intervals,
      conflict: merged.conflict && !elegido,
      opciones: centros,
      elegido,
      festivosLocales,
      slotRaw,
      entryMarginMinutes,
      exitMarginMinutes,
    };
  }

  private localName(centro: string, ctx: CentroDayContext): string | null {
    const town = ctx.towns.get(centro.trim().toUpperCase());
    if (!town) return null;
    return ctx.localByTown.get(normalizePlaceName(town)) || null;
  }

  private findHorario(
    horarios: Array<Record<string, unknown>>,
    centro: string,
    grupo: string,
  ): Record<string, unknown> | undefined {
    const key = `${centro.trim()}||${grupo.trim()}`.toLowerCase();
    return horarios.find((row) => {
      const centroNombre = String(row.centro_nombre || '').trim();
      const grupoNombre = String(row.grupo_nombre || '').trim();
      return `${centroNombre}||${grupoNombre}`.toLowerCase() === key;
    });
  }

  private async loadPrimario(codigo: string): Promise<string> {
    if (!codigo) return '';
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ centro: string | null }>
    >(
      `SELECT NULLIF(TRIM(\`CENTRO TRABAJO\`), '') AS centro
       FROM DatosEmpleados
       WHERE TRIM(CAST(CODIGO AS CHAR)) = ${this.escapeSql(codigo)}
       LIMIT 1`,
    );
    return String(rows?.[0]?.centro || '').trim();
  }

  private async loadEmployee(
    codigo: string,
  ): Promise<{ centro: string; grupo: string } | null> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ centro: string | null; grupo: string | null }>
    >(
      `SELECT NULLIF(TRIM(\`CENTRO TRABAJO\`), '') AS centro,
              NULLIF(TRIM(GRUPO), '') AS grupo
       FROM DatosEmpleados
       WHERE TRIM(CAST(CODIGO AS CHAR)) = ${this.escapeSql(codigo)}
       LIMIT 1`,
    );
    const row = rows?.[0];
    if (!row?.centro || !row.grupo) return null;
    return { centro: row.centro, grupo: row.grupo };
  }

  private async loadExtras(codigos: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (codigos.length === 0) return map;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ codigo: string; centro: string }>
    >(
      `SELECT TRIM(codigo) AS codigo, TRIM(centro) AS centro
       FROM empleado_centros
       WHERE TRIM(codigo) IN (${this.inList(codigos)})
       ORDER BY id ASC`,
    );
    for (const row of rows || []) {
      if (!row.codigo || !row.centro) continue;
      const list = map.get(row.codigo) || [];
      list.push(row.centro);
      map.set(row.codigo, list);
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
      Array<{ codigo: string; centro: string }>
    >(
      `SELECT TRIM(codigo) AS codigo, TRIM(centro) AS centro
       FROM fichaje_centro_dia
       WHERE fecha = ${this.escapeSql(dateStr)}
         AND TRIM(codigo) IN (${this.inList(codigos)})`,
    );
    for (const row of rows || []) {
      if (row.codigo && row.centro) map.set(row.codigo, row.centro);
    }
    return map;
  }

  private async loadTowns(centros: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (centros.length === 0) return map;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ centro: string; poblacion: string | null }>
    >(
      `SELECT TRIM(\`NOMBRE O RAZON SOCIAL\`) AS centro,
              NULLIF(TRIM(POBLACION), '') AS poblacion
       FROM Clientes
       WHERE UPPER(TRIM(\`NOMBRE O RAZON SOCIAL\`)) IN (${this.inList(
         centros.map((centro) => centro.toUpperCase()),
       )})`,
    );
    for (const row of rows || []) {
      if (row.centro && row.poblacion && !map.has(row.centro.toUpperCase())) {
        map.set(row.centro.toUpperCase(), row.poblacion);
      }
    }
    return map;
  }

  private async loadHorarios(
    dateStr: string,
  ): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(
      `SELECT *
       FROM horarios
       WHERE (vigente_desde IS NULL OR vigente_desde <= ${this.escapeSql(dateStr)})
         AND (vigente_hasta IS NULL OR vigente_hasta >= ${this.escapeSql(dateStr)})`,
    );
    return rows || [];
  }

  private weekdayPrefix(dateStr: string): string {
    const noon = new Date(`${dateStr}T12:00:00Z`);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      weekday: 'short',
    }).format(noon);
    const map: Record<string, string> = {
      Sun: 'dum',
      Mon: 'lun',
      Tue: 'mar',
      Wed: 'mie',
      Thu: 'joi',
      Fri: 'vin',
      Sat: 'sam',
    };
    return map[weekday] || 'lun';
  }

  private madridToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private inList(values: string[]): string {
    return values.map((value) => this.escapeSql(value)).join(',');
  }

  private escapeSql(value: string): string {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
}
