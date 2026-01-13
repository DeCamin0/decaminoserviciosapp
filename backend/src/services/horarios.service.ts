import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GestoriaService } from './gestoria.service';
import { ClientesService } from './clientes.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class HorariosService {
  private readonly logger = new Logger(HorariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GestoriaService))
    private readonly gestoriaService: GestoriaService,
    @Inject(forwardRef(() => ClientesService))
    private readonly clientesService: ClientesService,
  ) {}

  private escapeSql(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  // Mapă zile -> prefix coloane din DB
  private readonly PREFIX: Record<string, string> = {
    L: 'lun',
    M: 'mar',
    X: 'mie',
    J: 'joi',
    V: 'vin',
    S: 'sam',
    D: 'dum',
  };
  private readonly DAY_KEYS = Object.keys(this.PREFIX);

  // Validare HH:MM
  private readonly HHMM_REGEX = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;

  // "07:00" -> minute totale (420)
  private toMin(s: string | null | undefined): number | null {
    if (!s || !this.HHMM_REGEX.test(s)) return null;
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  }

  // Diferență în minute dintre două ore, permițând peste miezul nopții
  private diffMinutes(inn: string | null, out: string | null): number {
    if (
      !inn ||
      !out ||
      !this.HHMM_REGEX.test(inn) ||
      !this.HHMM_REGEX.test(out)
    )
      return 0;
    const a = this.toMin(inn);
    const b = this.toMin(out);
    if (a === null || b === null) return 0;
    let d = b - a;
    if (d <= 0) {
      // Presupunem că se termină a doua zi
      d = 24 * 60 - a + b;
    }
    return d > 0 ? d : 0;
  }

  // Normalizează intervalele pe o zi (max 3 sloturi)
  private normIntervals(
    list: any[] | undefined,
    dayKey: string,
    warnings: string[],
    errors: string[],
  ): Array<{ in: string; out: string } | null> {
    const arr = Array.isArray(list) ? list : [];

    const validated = arr
      .map((x) => x || {})
      .filter((x) => (x.in && x.in.trim()) || (x.out && x.out.trim()))
      .map((x, i) => {
        const inn = (x.in || '').trim();
        const out = (x.out || '').trim();

        if (!inn || !out) {
          warnings.push(`${dayKey} slot ${i + 1}: lipsă pereche (ignorat).`);
          return null;
        }

        if (!this.HHMM_REGEX.test(inn) || !this.HHMM_REGEX.test(out)) {
          errors.push(`${dayKey} slot ${i + 1}: oră invalidă HH:MM.`);
          return null;
        }

        const durationMin = this.diffMinutes(inn, out);
        if (durationMin <= 0) {
          errors.push(`${dayKey} slot ${i + 1}: ieșirea trebuie > intrare.`);
          return null;
        }

        return { in: inn, out: out };
      })
      .filter((x): x is { in: string; out: string } => x !== null);

    const top3 = validated.slice(0, 3);
    while (top3.length < 3) top3.push(null);
    return top3;
  }

  // Calculează minute pe săptămână din toate zilele
  private calcWeekMinutesFromIntervals(payload: any): number {
    let total = 0;
    for (const k of this.DAY_KEYS) {
      const list = payload?.days?.[k]?.intervals || [];
      for (const slot of list) {
        if (
          slot?.in &&
          slot?.out &&
          this.HHMM_REGEX.test(slot.in) &&
          this.HHMM_REGEX.test(slot.out)
        ) {
          total += this.diffMinutes(slot.in, slot.out);
        }
      }
    }
    const wb = Number(payload?.weeklyBreakMinutes || 0);
    return Math.max(0, total - wb);
  }

  // Normalizează payload-ul pentru CREATE
  private normalizeForCreate(body: any): {
    ok: boolean;
    data?: any;
    errors: string[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    const root = body;
    const p = root?.body?.payload || root?.payload || root || {};

    // Construiește obiectul de ieșire (flatten pt DB)
    const out: any = {
      nombre: (p.nombre || '').trim(),
      centro_nombre:
        root?.body?.centroNombre || p.centroNombre || p.centroId || null,
      grupo_nombre:
        root?.body?.grupoNombre || p.grupoNombre || p.grupoId || null,
      vigente_desde: p.vigenteDesde || null,
      vigente_hasta: p.vigenteHasta || null,
      wb: Number(p.weeklyBreakMinutes || 0),
      em: Number(p.entryMarginMinutes || 0),
      xm: Number(p.exitMarginMinutes || 0),
    };

    let totalHours = Number(root?.totalWeekHours ?? p.totalWeekHours ?? NaN);
    let totalMin = Number(root?.totalWeekMinutes ?? p.totalWeekMinutes ?? NaN);

    if (Number.isNaN(totalMin)) {
      totalMin = this.calcWeekMinutesFromIntervals(p);
    }
    if (Number.isNaN(totalHours)) {
      totalHours = Math.round((totalMin / 60) * 100) / 100;
    }

    out.total_horas_semanales = totalHours;
    out.total_minutos_semanales = totalMin;

    if (!out.nombre) {
      errors.push('Campo requerido: nombre.');
    }

    // Pentru fiecare zi (L,M,X,J,V,S,D) normalizăm până la 3 sloturi
    for (const k of this.DAY_KEYS) {
      const pref = this.PREFIX[k];
      const slots = this.normIntervals(
        p?.days?.[k]?.intervals,
        k,
        warnings,
        errors,
      );

      for (let i = 0; i < 3; i++) {
        const idx = i + 1;
        out[`${pref}_in${idx}`] = slots[i]?.in ?? null;
        out[`${pref}_out${idx}`] = slots[i]?.out ?? null;
      }
    }

    if (errors.length) {
      return { ok: false, errors, warnings };
    }

    return { ok: true, data: out, errors, warnings };
  }

  // Normalizează payload-ul pentru UPDATE (similar cu CREATE, dar permite ID)
  private normalizeForUpdate(body: any): {
    ok: boolean;
    data?: any;
    errors: string[];
    warnings: string[];
    mode: 'create' | 'edit';
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    const root = body;
    // Suport pentru multiple structuri: { action, payload: {...} } sau { body: { payload: {...} } }
    const p = root?.body?.payload ?? root?.payload ?? root?.body ?? root ?? {};

    const rawMode = String(
      root?.body?.mode ??
        root?.body?.modo ??
        root?.body?.accion ??
        root?.body?.action ??
        root?.action ??
        '',
    ).toLowerCase();
    const idFromBody = root?.body?.id ?? null;
    const idFromPayl = p?.id ?? null;
    const idFromPayload = root?.payload?.id ?? null;
    const idFromRoot = root?.id ?? null;
    const scheduleId =
      idFromBody ?? idFromPayl ?? idFromPayload ?? idFromRoot ?? null;

    const isEdit = rawMode
      ? ['edit', 'editar', 'update', 'actualizar'].includes(rawMode)
      : scheduleId != null;

    const getFirst = (...vals: any[]): any => {
      for (const v of vals)
        if (v !== undefined && v !== null && v !== '') return v;
      return null;
    };

    const out: any = {
      nombre: (
        getFirst(
          p?.nombre,
          root?.payload?.nombre,
          root?.body?.nombre,
          root?.nombre,
          '',
        ) || ''
      ).trim(),
      centro_nombre: getFirst(
        root?.body?.centroNombre,
        root?.payload?.centroNombre,
        p?.centroNombre,
        p?.centroId,
        root?.body?.centroId,
        root?.payload?.centroId,
      ),
      grupo_nombre: getFirst(
        root?.body?.grupoNombre,
        root?.payload?.grupoNombre,
        p?.grupoNombre,
        p?.grupoId,
        root?.body?.grupoId,
        root?.payload?.grupoId,
      ),
      vigente_desde: getFirst(
        p?.vigenteDesde,
        root?.payload?.vigenteDesde,
        root?.body?.vigenteDesde,
        null,
      ),
      vigente_hasta: getFirst(
        p?.vigenteHasta,
        root?.payload?.vigenteHasta,
        root?.body?.vigenteHasta,
        null,
      ),
      wb: Number(
        getFirst(
          p?.weeklyBreakMinutes,
          root?.payload?.weeklyBreakMinutes,
          root?.body?.weeklyBreakMinutes,
          0,
        ),
      ),
      em: Number(
        getFirst(
          p?.entryMarginMinutes,
          root?.payload?.entryMarginMinutes,
          root?.body?.entryMarginMinutes,
          0,
        ),
      ),
      xm: Number(
        getFirst(
          p?.exitMarginMinutes,
          root?.payload?.exitMarginMinutes,
          root?.body?.exitMarginMinutes,
          0,
        ),
      ),
    };

    let totalHours = Number(
      getFirst(
        root?.totalWeekHours,
        root?.payload?.totalWeekHours,
        p?.totalWeekHours,
      ),
    );
    let totalMin = Number(
      getFirst(
        root?.totalWeekMinutes,
        root?.payload?.totalWeekMinutes,
        p?.totalWeekMinutes,
      ),
    );

    // Pentru calcul automat, folosim payload-ul complet (root?.payload sau p)
    const calcPayload = root?.payload ?? p ?? {};
    if (Number.isNaN(totalMin))
      totalMin = this.calcWeekMinutesFromIntervals(calcPayload);
    if (Number.isNaN(totalHours))
      totalHours = Math.round((totalMin / 60) * 100) / 100;

    out.total_horas_semanales = totalHours;
    out.total_minutos_semanales = totalMin;

    if (!out.nombre) errors.push('Campo requerido: nombre.');

    // Zile + intervale (max 3/zi)
    // Suport pentru days din payload sau din root direct
    const daysData = p?.days ?? root?.payload?.days ?? root?.body?.days ?? {};
    for (const k of this.DAY_KEYS) {
      const pref = this.PREFIX[k];
      const slots = this.normIntervals(
        daysData?.[k]?.intervals,
        k,
        warnings,
        errors,
      );
      for (let i = 0; i < 3; i++) {
        const idx = i + 1;
        out[`${pref}_in${idx}`] = slots[i]?.in ?? null;
        out[`${pref}_out${idx}`] = slots[i]?.out ?? null;
      }
    }

    if (isEdit && (scheduleId === null || scheduleId === '')) {
      errors.push("Editare: câmpul 'id' este obligatoriu.");
    }

    if (scheduleId != null && scheduleId !== '') {
      out.id = scheduleId;
    }

    if (errors.length) {
      return { ok: false, mode: isEdit ? 'edit' : 'create', errors, warnings };
    }

    return {
      ok: true,
      mode: isEdit ? 'edit' : 'create',
      data: out,
      errors,
      warnings,
    };
  }

  // Convertește Time string (HH:MM) în format pentru MySQL Time (HH:MM:SS)
  private timeToSql(time: string | null | undefined): string {
    if (!time) return 'NULL';
    if (!this.HHMM_REGEX.test(time)) return 'NULL';
    // MySQL Time așteaptă formatul 'HH:MM:SS', deci adăugăm ':00' pentru secunde
    const timeWithSeconds =
      time.includes(':') && time.split(':').length === 2 ? `${time}:00` : time;
    return this.escapeSql(timeWithSeconds);
  }

  // Convertește Date string în format SQL (YYYY-MM-DD pentru DATE columns)
  private dateToSql(date: string | null | undefined): string {
    if (!date) return 'NULL';
    // Dacă e format ISO (2025-12-18T00:00:00.000Z), extrage doar partea de dată
    if (date.includes('T')) {
      const dateOnly = date.split('T')[0];
      return this.escapeSql(dateOnly);
    }
    // Dacă e deja în format YYYY-MM-DD, folosește-l direct
    return this.escapeSql(date);
  }

  async createHorario(body: any): Promise<{
    ok: boolean;
    nombre?: string;
    message: string;
    errors?: string[];
    warnings?: string[];
  }> {
    this.logger.log('📝 Create horario request');

    const normalized = this.normalizeForCreate(body);

    if (!normalized.ok) {
      throw new BadRequestException({
        ok: false,
        errors: normalized.errors,
        warnings: normalized.warnings,
      });
    }

    const data = normalized.data;

    // Construiește query-ul SQL pentru INSERT
    const query = `
      INSERT INTO horarios (
        nombre, centro_nombre, grupo_nombre,
        vigente_desde, vigente_hasta,
        weekly_break_minutes, entry_margin_minutes, exit_margin_minutes,
        total_horas_semanales, total_minutos_semanales,
        lun_in1, lun_out1, lun_in2, lun_out2, lun_in3, lun_out3,
        mar_in1, mar_out1, mar_in2, mar_out2, mar_in3, mar_out3,
        mie_in1, mie_out1, mie_in2, mie_out2, mie_in3, mie_out3,
        joi_in1, joi_out1, joi_in2, joi_out2, joi_in3, joi_out3,
        vin_in1, vin_out1, vin_in2, vin_out2, vin_in3, vin_out3,
        sam_in1, sam_out1, sam_in2, sam_out2, sam_in3, sam_out3,
        dum_in1, dum_out1, dum_in2, dum_out2, dum_in3, dum_out3
      ) VALUES (
        ${this.escapeSql(data.nombre)},
        ${data.centro_nombre ? this.escapeSql(data.centro_nombre) : 'NULL'},
        ${data.grupo_nombre ? this.escapeSql(data.grupo_nombre) : 'NULL'},
        ${this.dateToSql(data.vigente_desde)},
        ${this.dateToSql(data.vigente_hasta)},
        ${data.wb},
        ${data.em},
        ${data.xm},
        ${data.total_horas_semanales},
        ${data.total_minutos_semanales},
        ${this.timeToSql(data.lun_in1)}, ${this.timeToSql(data.lun_out1)},
        ${this.timeToSql(data.lun_in2)}, ${this.timeToSql(data.lun_out2)},
        ${this.timeToSql(data.lun_in3)}, ${this.timeToSql(data.lun_out3)},
        ${this.timeToSql(data.mar_in1)}, ${this.timeToSql(data.mar_out1)},
        ${this.timeToSql(data.mar_in2)}, ${this.timeToSql(data.mar_out2)},
        ${this.timeToSql(data.mar_in3)}, ${this.timeToSql(data.mar_out3)},
        ${this.timeToSql(data.mie_in1)}, ${this.timeToSql(data.mie_out1)},
        ${this.timeToSql(data.mie_in2)}, ${this.timeToSql(data.mie_out2)},
        ${this.timeToSql(data.mie_in3)}, ${this.timeToSql(data.mie_out3)},
        ${this.timeToSql(data.joi_in1)}, ${this.timeToSql(data.joi_out1)},
        ${this.timeToSql(data.joi_in2)}, ${this.timeToSql(data.joi_out2)},
        ${this.timeToSql(data.joi_in3)}, ${this.timeToSql(data.joi_out3)},
        ${this.timeToSql(data.vin_in1)}, ${this.timeToSql(data.vin_out1)},
        ${this.timeToSql(data.vin_in2)}, ${this.timeToSql(data.vin_out2)},
        ${this.timeToSql(data.vin_in3)}, ${this.timeToSql(data.vin_out3)},
        ${this.timeToSql(data.sam_in1)}, ${this.timeToSql(data.sam_out1)},
        ${this.timeToSql(data.sam_in2)}, ${this.timeToSql(data.sam_out2)},
        ${this.timeToSql(data.sam_in3)}, ${this.timeToSql(data.sam_out3)},
        ${this.timeToSql(data.dum_in1)}, ${this.timeToSql(data.dum_out1)},
        ${this.timeToSql(data.dum_in2)}, ${this.timeToSql(data.dum_out2)},
        ${this.timeToSql(data.dum_in3)}, ${this.timeToSql(data.dum_out3)}
      )
    `;

    try {
      await this.prisma.$executeRawUnsafe(query);
      this.logger.log(`✅ Horario ${data.nombre} creado exitosamente`);
      return {
        ok: true,
        nombre: data.nombre,
        message: 'Horario creado',
        warnings: normalized.warnings,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating horario:', error);
      throw new BadRequestException(
        `Error al crear el horario: ${error.message}`,
      );
    }
  }

  async getAllHorarios(): Promise<any[]> {
    this.logger.log('📝 Get all horarios request');

    const query = `SELECT * FROM horarios ORDER BY id DESC`;

    try {
      const results = await this.prisma.$queryRawUnsafe<any[]>(query);
      this.logger.log(`✅ Found ${results.length} horarios`);
      return results;
    } catch (error: any) {
      this.logger.error('❌ Error getting horarios:', error);
      throw new BadRequestException(
        `Error al obtener los horarios: ${error.message}`,
      );
    }
  }

  async updateHorario(body: any): Promise<{
    ok: boolean;
    nombre?: string;
    message: string;
    errors?: string[];
    warnings?: string[];
  }> {
    this.logger.log('📝 Update horario request');
    this.logger.log(
      `📝 Update body keys: ${Object.keys(body || {}).join(', ')}`,
    );
    this.logger.log(
      `📝 Update body.payload keys: ${body?.payload ? Object.keys(body.payload).join(', ') : 'no payload'}`,
    );
    this.logger.log(
      `📝 Update body.payload.id: ${body?.payload?.id || 'missing'}`,
    );

    const normalized = this.normalizeForUpdate(body);

    if (!normalized.ok) {
      this.logger.error(
        `❌ NormalizeForUpdate failed. Mode: ${normalized.mode}, Errors: ${JSON.stringify(normalized.errors)}, Warnings: ${JSON.stringify(normalized.warnings)}`,
      );
      throw new BadRequestException({
        ok: false,
        mode: normalized.mode,
        errors: normalized.errors,
        warnings: normalized.warnings,
      });
    }

    const data = normalized.data;

    if (!data.id) {
      throw new BadRequestException("Editare: câmpul 'id' este obligatoriu.");
    }

    // Construiește query-ul SQL pentru UPDATE
    const query = `
      UPDATE horarios
      SET
        nombre                = ${this.escapeSql(data.nombre)},
        centro_nombre         = ${data.centro_nombre ? this.escapeSql(data.centro_nombre) : 'NULL'},
        grupo_nombre          = ${data.grupo_nombre ? this.escapeSql(data.grupo_nombre) : 'NULL'},
        vigente_desde         = ${this.dateToSql(data.vigente_desde)},
        vigente_hasta         = ${this.dateToSql(data.vigente_hasta)},
        weekly_break_minutes  = ${data.wb},
        entry_margin_minutes  = ${data.em},
        exit_margin_minutes   = ${data.xm},
        total_horas_semanales   = ${data.total_horas_semanales},
        total_minutos_semanales = ${data.total_minutos_semanales},
        lun_in1  = ${this.timeToSql(data.lun_in1)},  lun_out1 = ${this.timeToSql(data.lun_out1)},
        lun_in2  = ${this.timeToSql(data.lun_in2)},  lun_out2 = ${this.timeToSql(data.lun_out2)},
        lun_in3  = ${this.timeToSql(data.lun_in3)},  lun_out3 = ${this.timeToSql(data.lun_out3)},
        mar_in1  = ${this.timeToSql(data.mar_in1)},  mar_out1 = ${this.timeToSql(data.mar_out1)},
        mar_in2  = ${this.timeToSql(data.mar_in2)},  mar_out2 = ${this.timeToSql(data.mar_out2)},
        mar_in3  = ${this.timeToSql(data.mar_in3)},  mar_out3 = ${this.timeToSql(data.mar_out3)},
        mie_in1  = ${this.timeToSql(data.mie_in1)},  mie_out1 = ${this.timeToSql(data.mie_out1)},
        mie_in2  = ${this.timeToSql(data.mie_in2)},  mie_out2 = ${this.timeToSql(data.mie_out2)},
        mie_in3  = ${this.timeToSql(data.mie_in3)},  mie_out3 = ${this.timeToSql(data.mie_out3)},
        joi_in1  = ${this.timeToSql(data.joi_in1)},  joi_out1 = ${this.timeToSql(data.joi_out1)},
        joi_in2  = ${this.timeToSql(data.joi_in2)},  joi_out2 = ${this.timeToSql(data.joi_out2)},
        joi_in3  = ${this.timeToSql(data.joi_in3)},  joi_out3 = ${this.timeToSql(data.joi_out3)},
        vin_in1  = ${this.timeToSql(data.vin_in1)},  vin_out1 = ${this.timeToSql(data.vin_out1)},
        vin_in2  = ${this.timeToSql(data.vin_in2)},  vin_out2 = ${this.timeToSql(data.vin_out2)},
        vin_in3  = ${this.timeToSql(data.vin_in3)},  vin_out3 = ${this.timeToSql(data.vin_out3)},
        sam_in1  = ${this.timeToSql(data.sam_in1)},  sam_out1 = ${this.timeToSql(data.sam_out1)},
        sam_in2  = ${this.timeToSql(data.sam_in2)},  sam_out2 = ${this.timeToSql(data.sam_out2)},
        sam_in3  = ${this.timeToSql(data.sam_in3)},  sam_out3 = ${this.timeToSql(data.sam_out3)},
        dum_in1  = ${this.timeToSql(data.dum_in1)},  dum_out1 = ${this.timeToSql(data.dum_out1)},
        dum_in2  = ${this.timeToSql(data.dum_in2)},  dum_out2 = ${this.timeToSql(data.dum_out2)},
        dum_in3  = ${this.timeToSql(data.dum_in3)},  dum_out3 = ${this.timeToSql(data.dum_out3)},
        created_at = NOW()
      WHERE id = ${Number(data.id)}
    `;

    try {
      await this.prisma.$executeRawUnsafe(query);
      this.logger.log(`✅ Horario ${data.id} actualizado exitosamente`);
      return {
        ok: true,
        nombre: data.nombre,
        message: 'Horario creado',
        warnings: normalized.warnings,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating horario:', error);
      throw new BadRequestException(
        `Error al actualizar el horario: ${error.message}`,
      );
    }
  }

  async deleteHorario(
    id: number,
    centroNombre: string,
  ): Promise<{ ok: boolean; message: string }> {
    this.logger.log(
      `📝 Delete horario request - id: ${id}, centro: ${centroNombre}`,
    );

    if (!id) {
      throw new BadRequestException(
        'Se requiere el ID del horario para eliminar.',
      );
    }

    if (!centroNombre) {
      throw new BadRequestException(
        'Se requiere el centro_nombre del horario para eliminar.',
      );
    }

    const query = `
      DELETE FROM horarios
      WHERE id = ${Number(id)}
        AND centro_nombre = ${this.escapeSql(centroNombre)}
    `;

    try {
      await this.prisma.$executeRawUnsafe(query);
      this.logger.log(`✅ Horario ${id} eliminado exitosamente`);
      return {
        ok: true,
        message: 'Horario eliminado',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting horario:', error);
      throw new BadRequestException(
        `Error al eliminar el horario: ${error.message}`,
      );
    }
  }

  /**
   * Procesează Excel cu horario_multicentro (orar special pentru angajați cu mai multe centre)
   * Structură Excel:
   * - Row 2: Nume angajat (ex: DANIEL)
   * - Row 3: Luna (ex: 2026-01-01) + zile săptămânii (J, V, S, D, L, M, X)
   * - Row 4: Header-uri (CLIENTE, HORARIO, SERVICIO, Nº DE HORAS, 1-31, Total)
   * - Row 5+: Date - fiecare rând = un centru diferit + tip tură + ore pe zile
   */
  async procesarHorarioMulticentroExcel(
    fileBuffer: Buffer | ArrayBuffer,
    mes?: string,
  ): Promise<{
    success: boolean;
    horarios: Array<{
      CODIGO: string;
      EMAIL?: string;
      NOMBRE?: string;
      LUNA: string;
      CLIENTE: string;
      HORARIO: string;
      SERVICIO?: string;
      ZI_1?: string;
      ZI_2?: string;
      ZI_3?: string;
      ZI_4?: string;
      ZI_5?: string;
      ZI_6?: string;
      ZI_7?: string;
      ZI_8?: string;
      ZI_9?: string;
      ZI_10?: string;
      ZI_11?: string;
      ZI_12?: string;
      ZI_13?: string;
      ZI_14?: string;
      ZI_15?: string;
      ZI_16?: string;
      ZI_17?: string;
      ZI_18?: string;
      ZI_19?: string;
      ZI_20?: string;
      ZI_21?: string;
      ZI_22?: string;
      ZI_23?: string;
      ZI_24?: string;
      ZI_25?: string;
      ZI_26?: string;
      ZI_27?: string;
      ZI_28?: string;
      ZI_29?: string;
      ZI_30?: string;
      ZI_31?: string;
      TotalHoras?: string;
      empleado_encontrado: boolean;
      confianza: number;
      matchType?: string;
      cliente_encontrado: boolean;
      cliente_confianza: number;
      cliente_matchType?: string;
    }>;
    errors?: string[];
  }> {
    try {
      this.logger.log(`📊 Procesando Excel horario_multicentro`);

      // Citește Excel-ul
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as any);

      // Găsește primul sheet
      const sheetName = workbook.worksheets[0]?.name;
      if (!sheetName) {
        throw new BadRequestException('Excel-ul nu conține sheet-uri');
      }

      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new BadRequestException(`Sheet "${sheetName}" nu a fost găsit`);
      }

      this.logger.log(`📄 Procesez sheet: "${sheetName}"`);

      // Row 2: Nume angajat
      const row2 = worksheet.getRow(2);
      const nombreEmpleadoRaw = row2.getCell(1)?.value;
      const nombreEmpleado = nombreEmpleadoRaw
        ? String(nombreEmpleadoRaw).trim()
        : '';

      // Row 3: Luna (în primele 4 coloane) + zile săptămânii
      const row3 = worksheet.getRow(3);
      let mesDetectat = mes;
      const cell3_1 = row3.getCell(1)?.value;
      if (cell3_1 instanceof Date) {
        const year = cell3_1.getFullYear();
        const month = String(cell3_1.getMonth() + 1).padStart(2, '0');
        mesDetectat = `${year}-${month}`;
      } else if (!mesDetectat) {
        throw new BadRequestException(
          'Luna nu poate fi detectată din Excel și nu este specificată',
        );
      }

      this.logger.log(`👤 Angajat: ${nombreEmpleado}, Luna: ${mesDetectat}`);

      // Row 4: Header-uri (CLIENTE, HORARIO, SERVICIO, Nº DE HORAS, 1-31, Total)
      const row4 = worksheet.getRow(4);
      const headers: string[] = [];
      const columnToDayMap: { [key: string]: number } = {};
      const maxColumns = row4.cellCount;

      for (let colNumber = 1; colNumber <= maxColumns; colNumber++) {
        const cell = row4.getCell(colNumber);
        const value = cell.value ? String(cell.value).trim() : '';

        if (colNumber === 1) {
          headers[colNumber - 1] = 'CLIENTE';
        } else if (colNumber === 2) {
          headers[colNumber - 1] = 'HORARIO';
        } else if (colNumber === 3) {
          headers[colNumber - 1] = 'SERVICIO';
        } else if (colNumber === 4) {
          headers[colNumber - 1] = 'Nº DE HORAS';
        } else {
          // Coloane cu zile (5-35 = zilele 1-31)
          const dayNum = parseInt(value, 10);
          if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
            const headerKey = `ZI_${dayNum}`;
            headers[colNumber - 1] = headerKey;
            columnToDayMap[headerKey] = dayNum;
          } else if (value === 'TOTAL' || value === 'Total') {
            headers[colNumber - 1] = 'TOTAL';
          } else {
            headers[colNumber - 1] = value || `col_${colNumber}`;
          }
        }
      }

      this.logger.log(
        `📅 Mapping zile lunii: ${JSON.stringify(columnToDayMap)}`,
      );

      // Căutăm angajatul în baza de date
      const empleadoEncontrado =
        await this.gestoriaService.findEmpleadoFlexible(
          nombreEmpleado,
          null,
          null,
        );

      let codigo: string | null = null;
      let nombreBd: string | null = null;
      let email: string | null = null;
      let empleadoEncontradoFlag = false;
      let confianza = 0;
      let matchType = 'not_found';

      if (empleadoEncontrado) {
        codigo = empleadoEncontrado.CODIGO;
        nombreBd = empleadoEncontrado['NOMBRE / APELLIDOS'] || null;
        confianza = empleadoEncontrado.confianza || 0;
        matchType = empleadoEncontrado.matchType || 'unknown';
        empleadoEncontradoFlag = confianza >= 80;

        // Obținem email-ul din baza de date
        if (codigo) {
          try {
            const empleadoQuery = `
              SELECT \`CORREO ELECTRONICO\` AS EMAIL
              FROM \`DatosEmpleados\`
              WHERE CODIGO = ${this.escapeSql(codigo)}
              LIMIT 1
            `;
            const empleadoEmail =
              await this.prisma.$queryRawUnsafe<
                Array<{ EMAIL: string | null }>
              >(empleadoQuery);
            if (empleadoEmail.length > 0 && empleadoEmail[0].EMAIL) {
              email = empleadoEmail[0].EMAIL.trim() || null;
            }
          } catch (err) {
            this.logger.warn(
              `⚠️ Nu s-a putut obține email pentru ${codigo}: ${err}`,
            );
          }
        }
      }

      // Parsează datele începând cu rândul 5
      const horarios: any[] = [];

      // Iterăm prin rânduri manual (nu putem folosi await în callback-ul eachRow)
      for (
        let rowNumber = 5;
        rowNumber <= worksheet.actualRowCount;
        rowNumber++
      ) {
        const row = worksheet.getRow(rowNumber);
        if (!row || row.cellCount === 0) continue;

        const rowData: any = {};
        let hasData = false;

        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (!header) return;

          let value: any = null;

          if (cell.value === null || cell.value === undefined) {
            value = '';
          } else if (typeof cell.value === 'number') {
            // Ore (ex: 12, 8)
            value = String(cell.value);
          } else if (typeof cell.value === 'string') {
            value = cell.value.trim();
          } else if (typeof cell.value === 'object' && 'result' in cell.value) {
            // Formula rezolvată
            value = String(cell.value.result || '');
          } else {
            value = String(cell.value).trim();
          }

          if (value && value !== '') {
            hasData = true;
          }

          rowData[header] = value;
        });

        // Ignorăm rândurile goale sau care au doar formule
        if (!hasData || !rowData.CLIENTE || !rowData.HORARIO) {
          continue;
        }

        // Căutăm clientul în baza de date
        const clienteNombre = String(rowData.CLIENTE || '').trim();
        this.logger.log(
          `🔍 [procesarHorarioMulticentroExcel] Căutăm client: "${clienteNombre}"`,
        );

        const clienteEncontrado =
          await this.clientesService.findClienteFlexible(clienteNombre);

        let clienteEncontradoFlag = false;
        let clienteConfianza = 0;
        let clienteMatchType = 'not_found';

        if (clienteEncontrado) {
          clienteEncontradoFlag = clienteEncontrado.confianza >= 80;
          clienteConfianza = clienteEncontrado.confianza || 0;
          clienteMatchType = clienteEncontrado.matchType || 'unknown';
          this.logger.log(
            `✅ [procesarHorarioMulticentroExcel] Client găsit: "${clienteEncontrado.NOMBRE_O_RAZON_SOCIAL}" ` +
              `(confianza: ${clienteConfianza}%, matchType: ${clienteMatchType}, encontrado: ${clienteEncontradoFlag})`,
          );
        } else {
          this.logger.warn(
            `⚠️ [procesarHorarioMulticentroExcel] Client NU găsit pentru: "${clienteNombre}"`,
          );
        }

        // Construim horario-ul
        const horarioData: any = {
          CODIGO: codigo || '',
          EMAIL: email || null,
          NOMBRE: nombreBd || nombreEmpleado,
          LUNA: mesDetectat!,
          CLIENTE: clienteNombre,
          HORARIO: String(rowData.HORARIO || '').trim(),
          SERVICIO: rowData.SERVICIO ? String(rowData.SERVICIO).trim() : null,
          empleado_encontrado: empleadoEncontradoFlag,
          confianza,
          matchType,
          cliente_encontrado: clienteEncontradoFlag,
          cliente_confianza: clienteConfianza,
          cliente_matchType: clienteMatchType,
        };

        // Inițializăm toate zilele cu null
        for (let zi = 1; zi <= 31; zi++) {
          horarioData[`ZI_${zi}`] = null;
        }

        // Funcție helper pentru a transforma valorile ZI_X în număr de ore
        const transformaZiValueInOre = (ziValue: any): string | null => {
          if (
            !ziValue ||
            ziValue === '' ||
            ziValue === 'LIBRE' ||
            ziValue === '0' ||
            ziValue === '0h'
          ) {
            return null; // LIBRE rămâne LIBRE
          }

          const ziStr = String(ziValue).trim();

          // Dacă este deja un număr (ex: "8", "8h", "8.0")
          if (!isNaN(parseFloat(ziStr)) && isFinite(parseFloat(ziStr))) {
            const hours = parseFloat(ziStr);
            return hours > 0 ? String(hours) : null;
          }

          // Dacă este format "T1 XX:XX:XX - XX:XX:XX", "T2 XX:XX:XX - XX:XX:XX", "T3 XX:XX:XX - XX:XX:XX"
          // Sau "XX:XX:XX - XX:XX:XX" (fără T1/T2/T3, cu sau fără secunde)
          let turnoMatch = ziStr.match(
            /^T[123]\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
          );
          if (!turnoMatch) {
            turnoMatch = ziStr.match(
              /^T[123](\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
            );
          }
          if (!turnoMatch) {
            turnoMatch = ziStr.match(
              /^T[123]\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
            );
          }

          if (turnoMatch) {
            const startHour = parseInt(turnoMatch[1], 10);
            const startMin = parseInt(turnoMatch[2], 10);
            let endHour = parseInt(turnoMatch[4], 10);
            const endMin = parseInt(turnoMatch[5], 10);

            if (
              endHour < startHour ||
              (endHour === startHour && endMin < startMin)
            ) {
              endHour += 24;
            }

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            const durationMinutes = endMinutes - startMinutes;
            const durationHours = durationMinutes / 60;

            if (durationHours === Math.round(durationHours)) {
              return String(Math.round(durationHours));
            } else {
              return String(Math.round(durationHours * 10) / 10);
            }
          }

          // Dacă este format "XX:XX:XX - XX:XX:XX" (fără T1/T2/T3, cu sau fără secunde)
          const timeMatch = ziStr.match(
            /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
          );
          if (timeMatch) {
            const startHour = parseInt(timeMatch[1], 10);
            const startMin = parseInt(timeMatch[2], 10);
            let endHour = parseInt(timeMatch[4], 10);
            const endMin = parseInt(timeMatch[5], 10);

            if (
              endHour < startHour ||
              (endHour === startHour && endMin < startMin)
            ) {
              endHour += 24;
            }

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            const durationMinutes = endMinutes - startMinutes;
            const durationHours = durationMinutes / 60;

            return String(Math.round(durationHours * 10) / 10);
          }

          // Dacă este doar "T1", "T2", "T3" fără ore, presupunem 8 ore
          if (ziStr.match(/^T[123]$/)) {
            return '8';
          }

          // Fallback: încercăm să extragem orice format de orar
          const anyTimeMatch = ziStr.match(
            /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
          );
          if (anyTimeMatch) {
            const startHour = parseInt(anyTimeMatch[1], 10);
            const startMin = parseInt(anyTimeMatch[2], 10);
            let endHour = parseInt(anyTimeMatch[4], 10);
            const endMin = parseInt(anyTimeMatch[5], 10);

            if (
              endHour < startHour ||
              (endHour === startHour && endMin < startMin)
            ) {
              endHour += 24;
            }

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            const durationMinutes = endMinutes - startMinutes;
            const durationHours = durationMinutes / 60;

            if (durationHours === Math.round(durationHours)) {
              return String(Math.round(durationHours));
            } else {
              return String(Math.round(durationHours * 10) / 10);
            }
          }

          return null;
        };

        // Copiem și transformăm orele pentru fiecare zi
        Object.entries(columnToDayMap).forEach(([headerKey, dayNum]) => {
          const value = rowData[headerKey];
          if (value !== undefined && value !== null && value !== '') {
            // Transformăm valoarea în număr de ore dacă este format complet
            const transformedValue = transformaZiValueInOre(value);
            horarioData[`ZI_${dayNum}`] = transformedValue || String(value); // Dacă transformarea eșuează, păstrăm valoarea originală
          }
        });

        // Calculăm TotalHoras sumând orele din toate zilele
        // Suportă atât formate cu timpi exacti (T1 07:30-19:30) cât și numere simple (8, 12)
        let totalHoras = 0;
        for (let zi = 1; zi <= 31; zi++) {
          const horasStr = horarioData[`ZI_${zi}`];
          if (horasStr && horasStr !== '' && horasStr !== null) {
            let horasNum = 0;

            // Încearcă să parseze ca format cu timpi exacti (T1 07:30-19:30 sau 07:30-19:30)
            const timeRangeMatch = String(horasStr).match(
              /(?:T\d+\s*:?)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
            );
            if (timeRangeMatch) {
              const [, h1, m1, h2, m2] = timeRangeMatch;
              const start = parseInt(h1) * 60 + parseInt(m1);
              const end = parseInt(h2) * 60 + parseInt(m2);
              const minutes = end > start ? end - start : 24 * 60 - start + end;
              horasNum = minutes / 60; // Convertește minute în ore
            } else {
              // Încearcă să parseze ca număr simplu (8, 12, 8.5) sau cu "h" (8h, 12h)
              const horasMatch = String(horasStr).match(
                /(\d+(?:\.\d+)?)(\s*h)?/i,
              );
              if (horasMatch) {
                horasNum = parseFloat(horasMatch[1]);
              } else {
                // Fallback: încearcă parseFloat direct
                horasNum = parseFloat(String(horasStr));
              }
            }

            if (!isNaN(horasNum) && horasNum > 0) {
              totalHoras += horasNum;
            }
          }
        }
        horarioData.TotalHoras = totalHoras.toFixed(2);

        horarios.push(horarioData);
      }

      this.logger.log(
        `✅ Procesate ${horarios.length} horarios multicentro din Excel`,
      );

      return {
        success: true,
        horarios,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error procesando Excel horario_multicentro:',
        error,
      );
      throw new BadRequestException(
        `Error al procesar Excel: ${error.message}`,
      );
    }
  }

  /**
   * Salvează horarios_multicentro în baza de date (bulk)
   */
  async saveHorariosMulticentroBulk(
    horarios: Array<{
      CODIGO: string;
      EMAIL?: string;
      NOMBRE?: string;
      LUNA: string;
      CLIENTE: string;
      HORARIO: string;
      SERVICIO?: string;
      ZI_1?: string;
      ZI_2?: string;
      ZI_3?: string;
      ZI_4?: string;
      ZI_5?: string;
      ZI_6?: string;
      ZI_7?: string;
      ZI_8?: string;
      ZI_9?: string;
      ZI_10?: string;
      ZI_11?: string;
      ZI_12?: string;
      ZI_13?: string;
      ZI_14?: string;
      ZI_15?: string;
      ZI_16?: string;
      ZI_17?: string;
      ZI_18?: string;
      ZI_19?: string;
      ZI_20?: string;
      ZI_21?: string;
      ZI_22?: string;
      ZI_23?: string;
      ZI_24?: string;
      ZI_25?: string;
      ZI_26?: string;
      ZI_27?: string;
      ZI_28?: string;
      ZI_29?: string;
      ZI_30?: string;
      ZI_31?: string;
      TotalHoras?: string;
    }>,
  ): Promise<{ success: true; updated: number }> {
    try {
      if (!Array.isArray(horarios) || horarios.length === 0) {
        throw new BadRequestException('horarios must be a non-empty array');
      }

      let updatedCount = 0;

      for (const horario of horarios) {
        if (
          !horario.CODIGO ||
          !horario.LUNA ||
          !horario.CLIENTE ||
          !horario.HORARIO
        ) {
          this.logger.warn(
            `⚠️ Skipping horario without CODIGO/LUNA/CLIENTE/HORARIO: ${JSON.stringify(horario)}`,
          );
          continue;
        }

        const fields: string[] = ['CODIGO', 'LUNA', 'CLIENTE', 'HORARIO'];
        const values: string[] = [
          this.escapeSql(horario.CODIGO),
          this.escapeSql(horario.LUNA),
          this.escapeSql(horario.CLIENTE),
          this.escapeSql(horario.HORARIO),
        ];
        const updates: string[] = [];

        // Add other fields to INSERT and ON DUPLICATE KEY UPDATE
        if (horario.EMAIL !== undefined) {
          fields.push('EMAIL');
          values.push(horario.EMAIL ? this.escapeSql(horario.EMAIL) : 'NULL');
          updates.push(`EMAIL = VALUES(EMAIL)`);
        }
        if (horario.NOMBRE !== undefined) {
          fields.push('NOMBRE');
          values.push(horario.NOMBRE ? this.escapeSql(horario.NOMBRE) : 'NULL');
          updates.push(`NOMBRE = VALUES(NOMBRE)`);
        }
        if (horario.SERVICIO !== undefined) {
          fields.push('SERVICIO');
          values.push(
            horario.SERVICIO ? this.escapeSql(horario.SERVICIO) : 'NULL',
          );
          updates.push(`SERVICIO = VALUES(SERVICIO)`);
        }

        const ziValues: string[] = [];
        for (let i = 1; i <= 31; i++) {
          const ziKey = `ZI_${i}` as keyof typeof horario;
          const value = horario[ziKey];
          // Only include ZI_X in INSERT/UPDATE if it's explicitly provided (not undefined)
          if (value !== undefined) {
            fields.push(ziKey);
            values.push(value ? this.escapeSql(String(value)) : 'NULL');
            updates.push(`${ziKey} = VALUES(${ziKey})`);
            if (value) {
              ziValues.push(`${ziKey}=${value}`);
            }
          } else {
            // If ZI_X is not provided, preserve existing value in DB (don't update it)
            // This is handled by not including it in the INSERT/UPDATE
          }
        }

        if (horario.TotalHoras !== undefined) {
          fields.push('TotalHoras');
          values.push(
            horario.TotalHoras
              ? this.escapeSql(String(horario.TotalHoras))
              : 'NULL',
          );
          updates.push(`TotalHoras = VALUES(TotalHoras)`);
        }

        const query = `
          INSERT INTO horario_multicentro (${fields.join(', ')})
          VALUES (${values.join(', ')})
          ON DUPLICATE KEY UPDATE ${updates.join(', ')}
        `;

        this.logger.log(
          `📝 Insert/Update horario_multicentro: CODIGO=${horario.CODIGO}, LUNA=${horario.LUNA}, CLIENTE=${horario.CLIENTE}, HORARIO=${horario.HORARIO}`,
        );
        if (ziValues.length > 0) {
          this.logger.debug(
            `   ZI_X values: ${ziValues.slice(0, 10).join(', ')}${ziValues.length > 10 ? ` ... (${ziValues.length} total)` : ''}`,
          );
        } else {
          this.logger.debug(`   ZI_X values: all NULL (LIBRE)`);
        }

        try {
          const result = await this.prisma.$executeRawUnsafe(query);
          if (result > 0) {
            updatedCount += 1;
          }
        } catch (sqlError: any) {
          this.logger.error(
            `❌ SQL Error saving horario_multicentro CODIGO=${horario.CODIGO}, LUNA=${horario.LUNA}, CLIENTE=${horario.CLIENTE}, HORARIO=${horario.HORARIO}: ${sqlError.message}`,
          );
          // Continue to next horario even if one fails
        }
      }

      this.logger.log(
        `✅ Bulk save completed: ${updatedCount} horarios_multicentro saved`,
      );

      return { success: true, updated: updatedCount };
    } catch (error: any) {
      this.logger.error('❌ Error saving horarios_multicentro bulk:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al guardar horarios_multicentro: ${error.message}`,
      );
    }
  }

  /**
   * Verifică dacă un angajat are orar asignat (cuadrante, horario_multicentro, sau horarios normal)
   * @param codigo - CODIGO al angajatului
   * @param mes - Luna în format YYYY-MM (opțional, dacă nu este specificat, folosește luna curentă)
   * @returns true dacă există orar, false în caz contrar
   */
  async hasSchedule(codigo: string, mes?: string): Promise<boolean> {
    try {
      const codigoClean = codigo.trim();

      // Determină luna de verificat
      let mesStr = mes;
      if (!mesStr) {
        const now = new Date();
        mesStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      this.logger.debug(
        `🔍 [hasSchedule] Verificăm orar pentru CODIGO: ${codigoClean}, LUNA: ${mesStr}`,
      );

      // 1. Verifică cuadrante (simplificat - verifică doar dacă există cuadrante pentru luna respectivă)
      const cuadranteQuery = `
        SELECT COUNT(*) as count
        FROM cuadrante
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
          AND LUNA = ${this.escapeSql(mesStr)}
          AND (
            (ZI_1 IS NOT NULL AND TRIM(ZI_1) != '' AND ZI_1 != '0' AND ZI_1 != '0h' AND UPPER(TRIM(ZI_1)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_2 IS NOT NULL AND TRIM(ZI_2) != '' AND ZI_2 != '0' AND ZI_2 != '0h' AND UPPER(TRIM(ZI_2)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_3 IS NOT NULL AND TRIM(ZI_3) != '' AND ZI_3 != '0' AND ZI_3 != '0h' AND UPPER(TRIM(ZI_3)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_4 IS NOT NULL AND TRIM(ZI_4) != '' AND ZI_4 != '0' AND ZI_4 != '0h' AND UPPER(TRIM(ZI_4)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_5 IS NOT NULL AND TRIM(ZI_5) != '' AND ZI_5 != '0' AND ZI_5 != '0h' AND UPPER(TRIM(ZI_5)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_6 IS NOT NULL AND TRIM(ZI_6) != '' AND ZI_6 != '0' AND ZI_6 != '0h' AND UPPER(TRIM(ZI_6)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_7 IS NOT NULL AND TRIM(ZI_7) != '' AND ZI_7 != '0' AND ZI_7 != '0h' AND UPPER(TRIM(ZI_7)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_8 IS NOT NULL AND TRIM(ZI_8) != '' AND ZI_8 != '0' AND ZI_8 != '0h' AND UPPER(TRIM(ZI_8)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_9 IS NOT NULL AND TRIM(ZI_9) != '' AND ZI_9 != '0' AND ZI_9 != '0h' AND UPPER(TRIM(ZI_9)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_10 IS NOT NULL AND TRIM(ZI_10) != '' AND ZI_10 != '0' AND ZI_10 != '0h' AND UPPER(TRIM(ZI_10)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_11 IS NOT NULL AND TRIM(ZI_11) != '' AND ZI_11 != '0' AND ZI_11 != '0h' AND UPPER(TRIM(ZI_11)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_12 IS NOT NULL AND TRIM(ZI_12) != '' AND ZI_12 != '0' AND ZI_12 != '0h' AND UPPER(TRIM(ZI_12)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_13 IS NOT NULL AND TRIM(ZI_13) != '' AND ZI_13 != '0' AND ZI_13 != '0h' AND UPPER(TRIM(ZI_13)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_14 IS NOT NULL AND TRIM(ZI_14) != '' AND ZI_14 != '0' AND ZI_14 != '0h' AND UPPER(TRIM(ZI_14)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_15 IS NOT NULL AND TRIM(ZI_15) != '' AND ZI_15 != '0' AND ZI_15 != '0h' AND UPPER(TRIM(ZI_15)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_16 IS NOT NULL AND TRIM(ZI_16) != '' AND ZI_16 != '0' AND ZI_16 != '0h' AND UPPER(TRIM(ZI_16)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_17 IS NOT NULL AND TRIM(ZI_17) != '' AND ZI_17 != '0' AND ZI_17 != '0h' AND UPPER(TRIM(ZI_17)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_18 IS NOT NULL AND TRIM(ZI_18) != '' AND ZI_18 != '0' AND ZI_18 != '0h' AND UPPER(TRIM(ZI_18)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_19 IS NOT NULL AND TRIM(ZI_19) != '' AND ZI_19 != '0' AND ZI_19 != '0h' AND UPPER(TRIM(ZI_19)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_20 IS NOT NULL AND TRIM(ZI_20) != '' AND ZI_20 != '0' AND ZI_20 != '0h' AND UPPER(TRIM(ZI_20)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_21 IS NOT NULL AND TRIM(ZI_21) != '' AND ZI_21 != '0' AND ZI_21 != '0h' AND UPPER(TRIM(ZI_21)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_22 IS NOT NULL AND TRIM(ZI_22) != '' AND ZI_22 != '0' AND ZI_22 != '0h' AND UPPER(TRIM(ZI_22)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_23 IS NOT NULL AND TRIM(ZI_23) != '' AND ZI_23 != '0' AND ZI_23 != '0h' AND UPPER(TRIM(ZI_23)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_24 IS NOT NULL AND TRIM(ZI_24) != '' AND ZI_24 != '0' AND ZI_24 != '0h' AND UPPER(TRIM(ZI_24)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_25 IS NOT NULL AND TRIM(ZI_25) != '' AND ZI_25 != '0' AND ZI_25 != '0h' AND UPPER(TRIM(ZI_25)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_26 IS NOT NULL AND TRIM(ZI_26) != '' AND ZI_26 != '0' AND ZI_26 != '0h' AND UPPER(TRIM(ZI_26)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_27 IS NOT NULL AND TRIM(ZI_27) != '' AND ZI_27 != '0' AND ZI_27 != '0h' AND UPPER(TRIM(ZI_27)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_28 IS NOT NULL AND TRIM(ZI_28) != '' AND ZI_28 != '0' AND ZI_28 != '0h' AND UPPER(TRIM(ZI_28)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_29 IS NOT NULL AND TRIM(ZI_29) != '' AND ZI_29 != '0' AND ZI_29 != '0h' AND UPPER(TRIM(ZI_29)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_30 IS NOT NULL AND TRIM(ZI_30) != '' AND ZI_30 != '0' AND ZI_30 != '0h' AND UPPER(TRIM(ZI_30)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_31 IS NOT NULL AND TRIM(ZI_31) != '' AND ZI_31 != '0' AND ZI_31 != '0h' AND UPPER(TRIM(ZI_31)) NOT IN ('LIB','LIBRE','L'))
          )
        LIMIT 1
      `;

      const cuadranteResult =
        await this.prisma.$queryRawUnsafe<any[]>(cuadranteQuery);

      if (
        cuadranteResult &&
        cuadranteResult.length > 0 &&
        Number(cuadranteResult[0].count) > 0
      ) {
        this.logger.debug(
          `✅ [hasSchedule] Găsit cuadrante pentru CODIGO: ${codigoClean}`,
        );
        return true;
      }

      // 2. Verifică horario_multicentro
      const horarioMulticentroQuery = `
        SELECT COUNT(*) as count
        FROM horario_multicentro
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
          AND LUNA = ${this.escapeSql(mesStr)}
          AND (
            (ZI_1 IS NOT NULL AND TRIM(ZI_1) != '' AND ZI_1 != '0' AND ZI_1 != '0h' AND UPPER(TRIM(ZI_1)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_2 IS NOT NULL AND TRIM(ZI_2) != '' AND ZI_2 != '0' AND ZI_2 != '0h' AND UPPER(TRIM(ZI_2)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_3 IS NOT NULL AND TRIM(ZI_3) != '' AND ZI_3 != '0' AND ZI_3 != '0h' AND UPPER(TRIM(ZI_3)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_4 IS NOT NULL AND TRIM(ZI_4) != '' AND ZI_4 != '0' AND ZI_4 != '0h' AND UPPER(TRIM(ZI_4)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_5 IS NOT NULL AND TRIM(ZI_5) != '' AND ZI_5 != '0' AND ZI_5 != '0h' AND UPPER(TRIM(ZI_5)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_6 IS NOT NULL AND TRIM(ZI_6) != '' AND ZI_6 != '0' AND ZI_6 != '0h' AND UPPER(TRIM(ZI_6)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_7 IS NOT NULL AND TRIM(ZI_7) != '' AND ZI_7 != '0' AND ZI_7 != '0h' AND UPPER(TRIM(ZI_7)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_8 IS NOT NULL AND TRIM(ZI_8) != '' AND ZI_8 != '0' AND ZI_8 != '0h' AND UPPER(TRIM(ZI_8)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_9 IS NOT NULL AND TRIM(ZI_9) != '' AND ZI_9 != '0' AND ZI_9 != '0h' AND UPPER(TRIM(ZI_9)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_10 IS NOT NULL AND TRIM(ZI_10) != '' AND ZI_10 != '0' AND ZI_10 != '0h' AND UPPER(TRIM(ZI_10)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_11 IS NOT NULL AND TRIM(ZI_11) != '' AND ZI_11 != '0' AND ZI_11 != '0h' AND UPPER(TRIM(ZI_11)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_12 IS NOT NULL AND TRIM(ZI_12) != '' AND ZI_12 != '0' AND ZI_12 != '0h' AND UPPER(TRIM(ZI_12)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_13 IS NOT NULL AND TRIM(ZI_13) != '' AND ZI_13 != '0' AND ZI_13 != '0h' AND UPPER(TRIM(ZI_13)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_14 IS NOT NULL AND TRIM(ZI_14) != '' AND ZI_14 != '0' AND ZI_14 != '0h' AND UPPER(TRIM(ZI_14)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_15 IS NOT NULL AND TRIM(ZI_15) != '' AND ZI_15 != '0' AND ZI_15 != '0h' AND UPPER(TRIM(ZI_15)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_16 IS NOT NULL AND TRIM(ZI_16) != '' AND ZI_16 != '0' AND ZI_16 != '0h' AND UPPER(TRIM(ZI_16)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_17 IS NOT NULL AND TRIM(ZI_17) != '' AND ZI_17 != '0' AND ZI_17 != '0h' AND UPPER(TRIM(ZI_17)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_18 IS NOT NULL AND TRIM(ZI_18) != '' AND ZI_18 != '0' AND ZI_18 != '0h' AND UPPER(TRIM(ZI_18)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_19 IS NOT NULL AND TRIM(ZI_19) != '' AND ZI_19 != '0' AND ZI_19 != '0h' AND UPPER(TRIM(ZI_19)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_20 IS NOT NULL AND TRIM(ZI_20) != '' AND ZI_20 != '0' AND ZI_20 != '0h' AND UPPER(TRIM(ZI_20)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_21 IS NOT NULL AND TRIM(ZI_21) != '' AND ZI_21 != '0' AND ZI_21 != '0h' AND UPPER(TRIM(ZI_21)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_22 IS NOT NULL AND TRIM(ZI_22) != '' AND ZI_22 != '0' AND ZI_22 != '0h' AND UPPER(TRIM(ZI_22)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_23 IS NOT NULL AND TRIM(ZI_23) != '' AND ZI_23 != '0' AND ZI_23 != '0h' AND UPPER(TRIM(ZI_23)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_24 IS NOT NULL AND TRIM(ZI_24) != '' AND ZI_24 != '0' AND ZI_24 != '0h' AND UPPER(TRIM(ZI_24)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_25 IS NOT NULL AND TRIM(ZI_25) != '' AND ZI_25 != '0' AND ZI_25 != '0h' AND UPPER(TRIM(ZI_25)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_26 IS NOT NULL AND TRIM(ZI_26) != '' AND ZI_26 != '0' AND ZI_26 != '0h' AND UPPER(TRIM(ZI_26)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_27 IS NOT NULL AND TRIM(ZI_27) != '' AND ZI_27 != '0' AND ZI_27 != '0h' AND UPPER(TRIM(ZI_27)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_28 IS NOT NULL AND TRIM(ZI_28) != '' AND ZI_28 != '0' AND ZI_28 != '0h' AND UPPER(TRIM(ZI_28)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_29 IS NOT NULL AND TRIM(ZI_29) != '' AND ZI_29 != '0' AND ZI_29 != '0h' AND UPPER(TRIM(ZI_29)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_30 IS NOT NULL AND TRIM(ZI_30) != '' AND ZI_30 != '0' AND ZI_30 != '0h' AND UPPER(TRIM(ZI_30)) NOT IN ('LIB','LIBRE','L'))
            OR (ZI_31 IS NOT NULL AND TRIM(ZI_31) != '' AND ZI_31 != '0' AND ZI_31 != '0h' AND UPPER(TRIM(ZI_31)) NOT IN ('LIB','LIBRE','L'))
          )
        LIMIT 1
      `;

      const horarioMulticentroResult = await this.prisma.$queryRawUnsafe<any[]>(
        horarioMulticentroQuery,
      );

      if (
        horarioMulticentroResult &&
        horarioMulticentroResult.length > 0 &&
        Number(horarioMulticentroResult[0].count) > 0
      ) {
        this.logger.debug(
          `✅ [hasSchedule] Găsit horario_multicentro pentru CODIGO: ${codigoClean}`,
        );
        return true;
      }

      // 3. Verifică horarios normal (pe baza centrului și grupului)
      const empleadoQuery = `
        SELECT \`CENTRO TRABAJO\` as centro, GRUPO as grupo
        FROM DatosEmpleados
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
          AND ESTADO = 'ACTIVO'
        LIMIT 1
      `;

      const empleadoResult =
        await this.prisma.$queryRawUnsafe<any[]>(empleadoQuery);

      if (empleadoResult && empleadoResult.length > 0) {
        const centro = empleadoResult[0].centro;
        const grupo = empleadoResult[0].grupo;

        if (centro && grupo) {
          const horarioQuery = `
            SELECT COUNT(*) as count
            FROM horarios
            WHERE centro_nombre = ${this.escapeSql(centro)}
              AND grupo_nombre = ${this.escapeSql(grupo)}
              AND (vigente_desde IS NULL OR vigente_desde <= CURDATE())
              AND (vigente_hasta IS NULL OR vigente_hasta >= CURDATE())
            LIMIT 1
          `;

          const horarioResult =
            await this.prisma.$queryRawUnsafe<any[]>(horarioQuery);

          if (
            horarioResult &&
            horarioResult.length > 0 &&
            Number(horarioResult[0].count) > 0
          ) {
            this.logger.debug(
              `✅ [hasSchedule] Găsit horario normal pentru CODIGO: ${codigoClean}, centro: ${centro}, grupo: ${grupo}`,
            );
            return true;
          }
        }
      }

      this.logger.debug(
        `❌ [hasSchedule] Nu s-a găsit orar pentru CODIGO: ${codigoClean}, LUNA: ${mesStr}`,
      );
      return false;
    } catch (error: any) {
      this.logger.error(`❌ [hasSchedule] Error: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Obține horario_multicentro pentru un angajat și o lună
   * @param codigo - CODIGO al angajatului (opțional, dacă este specificat email)
   * @param email - Email al angajatului (opțional, dacă este specificat codigo)
   * @param mes - Luna în format YYYY-MM (opțional, dacă nu este specificat, folosește luna curentă)
   * @returns Array cu horarios_multicentro pentru angajat și luna specificată
   */
  async getHorarioMulticentro(
    codigo?: string,
    email?: string,
    mes?: string,
  ): Promise<any[]> {
    try {
      // Determină luna de verificat
      let mesStr = mes;
      if (!mesStr) {
        const now = new Date();
        mesStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      let codigoParaBuscar: string | null = null;

      // Dacă avem codigo, folosim-l direct
      if (codigo && codigo.trim()) {
        codigoParaBuscar = codigo.trim();
      }
      // Dacă avem email, căutăm codigo-ul după email
      else if (email && email.trim()) {
        this.logger.debug(
          `🔍 [getHorarioMulticentro] Căutăm CODIGO după EMAIL: ${email.trim()}`,
        );

        const empleadoQuery = `
          SELECT CODIGO
          FROM \`DatosEmpleados\`
          WHERE TRIM(UPPER(\`CORREO ELECTRONICO\`)) = ${this.escapeSql(email.trim().toUpperCase())}
          LIMIT 1
        `;

        const empleadoResult =
          await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(
            empleadoQuery,
          );

        if (
          empleadoResult &&
          empleadoResult.length > 0 &&
          empleadoResult[0].CODIGO
        ) {
          codigoParaBuscar = empleadoResult[0].CODIGO.trim();
          this.logger.debug(
            `✅ [getHorarioMulticentro] Găsit CODIGO ${codigoParaBuscar} pentru EMAIL: ${email.trim()}`,
          );
        } else {
          this.logger.warn(
            `⚠️ [getHorarioMulticentro] Nu s-a găsit CODIGO pentru EMAIL: ${email.trim()}`,
          );
          // Încercăm și după EMAIL direct în horario_multicentro
          const queryDirect = `
            SELECT *
            FROM horario_multicentro
            WHERE TRIM(UPPER(EMAIL)) = ${this.escapeSql(email.trim().toUpperCase())}
              AND LUNA = ${this.escapeSql(mesStr)}
            ORDER BY CLIENTE, HORARIO
          `;

          const resultDirect =
            await this.prisma.$queryRawUnsafe<any[]>(queryDirect);

          this.logger.debug(
            `✅ [getHorarioMulticentro] Găsit ${resultDirect?.length || 0} horarios_multicentro pentru EMAIL: ${email.trim()}, LUNA: ${mesStr} (căutare directă)`,
          );

          // Normalizăm câmpurile
          const normalizedResult = (resultDirect || []).map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach((key) => {
              if (key.startsWith('zi_') || key.startsWith('ZI_')) {
                const normalizedKey = key.toUpperCase();
                normalized[normalizedKey] = row[key];
              } else {
                normalized[key] = row[key];
              }
            });
            return normalized;
          });

          return normalizedResult;
        }
      } else {
        // Dacă nu s-a furnizat nici CODIGO, nici EMAIL, returnăm TOATE horarios_multicentro pentru luna respectivă
        this.logger.debug(
          `🔍 [getHorarioMulticentro] Nu s-a furnizat CODIGO sau EMAIL - returnăm TOATE horarios_multicentro pentru LUNA: ${mesStr}`,
        );

        const queryAll = `
          SELECT *
          FROM horario_multicentro
          WHERE LUNA = ${this.escapeSql(mesStr)}
          ORDER BY CLIENTE, CODIGO, HORARIO
        `;

        const resultAll = await this.prisma.$queryRawUnsafe<any[]>(queryAll);

        this.logger.debug(
          `✅ [getHorarioMulticentro] Găsit ${resultAll?.length || 0} horarios_multicentro pentru LUNA: ${mesStr} (toate)`,
        );

        // Normalizăm câmpurile
        const normalizedResultAll = (resultAll || []).map((row: any) => {
          const normalized: any = {};
          Object.keys(row).forEach((key) => {
            if (key.startsWith('zi_') || key.startsWith('ZI_')) {
              const normalizedKey = key.toUpperCase();
              normalized[normalizedKey] = row[key];
            } else {
              normalized[key] = row[key];
            }
          });
          return normalized;
        });

        return normalizedResultAll;
      }

      if (!codigoParaBuscar) {
        this.logger.warn(
          `⚠️ [getHorarioMulticentro] Nu s-a putut determina CODIGO pentru căutare`,
        );
        return [];
      }

      this.logger.debug(
        `🔍 [getHorarioMulticentro] Obțin horario_multicentro pentru CODIGO: ${codigoParaBuscar}, LUNA: ${mesStr}`,
      );

      const query = `
        SELECT *
        FROM horario_multicentro
        WHERE CODIGO = ${this.escapeSql(codigoParaBuscar)}
          AND LUNA = ${this.escapeSql(mesStr)}
        ORDER BY CLIENTE, HORARIO
      `;

      const result = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.debug(
        `✅ [getHorarioMulticentro] Găsit ${result?.length || 0} horarios_multicentro pentru CODIGO: ${codigoParaBuscar}, LUNA: ${mesStr}`,
      );

      // Normalizăm câmpurile pentru a fi siguri că sunt returnate cu numele corect (uppercase)
      // MySQL poate returna câmpurile cu diferite case-uri în funcție de configurare
      const normalizedResult = (result || []).map((row: any) => {
        const normalized: any = {};
        // Copiază toate câmpurile și normalizează numele pentru câmpurile ZI_X
        Object.keys(row).forEach((key) => {
          if (key.startsWith('zi_') || key.startsWith('ZI_')) {
            // Normalizează la uppercase pentru ZI_1, ZI_2, etc.
            const normalizedKey = key.toUpperCase();
            normalized[normalizedKey] = row[key];
          } else {
            // Copiază câmpurile non-ZI cu numele original
            normalized[key] = row[key];
          }
        });
        return normalized;
      });

      // Debug: Log ZI_10 pentru ziua curentă dacă este setată
      if (normalizedResult && normalizedResult.length > 0) {
        const today = new Date().getDate();
        const dayKey = `ZI_${today}`;
        this.logger.debug(
          `🔍 [getHorarioMulticentro] Verificăm ZI_${today} pentru ${normalizedResult.length} înregistrări:`,
        );
        normalizedResult.forEach((h, idx) => {
          const ziValue = h[dayKey];
          // Listă toate cheile disponibile pentru debugging
          const allKeys = Object.keys(h).filter((k) => k.startsWith('ZI_'));
          this.logger.debug(
            `  [${idx + 1}] ${h.CLIENTE || 'N/A'} - ${h.HORARIO || 'N/A'}: ZI_${today} = ${ziValue} (type: ${typeof ziValue}), all ZI keys: ${allKeys.join(', ')}`,
          );
        });
      }

      return normalizedResult;
    } catch (error: any) {
      this.logger.error(
        `❌ [getHorarioMulticentro] Error: ${error.message}`,
        error,
      );
      return [];
    }
  }
}
