import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HorariosService {
  private readonly logger = new Logger(HorariosService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const scheduleId = idFromBody ?? idFromPayl ?? idFromPayload ?? idFromRoot ?? null;

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
        getFirst(p?.nombre, root?.payload?.nombre, root?.body?.nombre, root?.nombre, '') || ''
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
      vigente_desde: getFirst(p?.vigenteDesde, root?.payload?.vigenteDesde, root?.body?.vigenteDesde, null),
      vigente_hasta: getFirst(p?.vigenteHasta, root?.payload?.vigenteHasta, root?.body?.vigenteHasta, null),
      wb: Number(
        getFirst(p?.weeklyBreakMinutes, root?.payload?.weeklyBreakMinutes, root?.body?.weeklyBreakMinutes, 0),
      ),
      em: Number(
        getFirst(p?.entryMarginMinutes, root?.payload?.entryMarginMinutes, root?.body?.entryMarginMinutes, 0),
      ),
      xm: Number(
        getFirst(p?.exitMarginMinutes, root?.payload?.exitMarginMinutes, root?.body?.exitMarginMinutes, 0),
      ),
    };

    let totalHours = Number(getFirst(root?.totalWeekHours, root?.payload?.totalWeekHours, p?.totalWeekHours));
    let totalMin = Number(
      getFirst(root?.totalWeekMinutes, root?.payload?.totalWeekMinutes, p?.totalWeekMinutes),
    );

    // Pentru calcul automat, folosim payload-ul complet (root?.payload sau p)
    const calcPayload = root?.payload ?? p ?? {};
    if (Number.isNaN(totalMin)) totalMin = this.calcWeekMinutesFromIntervals(calcPayload);
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
    this.logger.log(`📝 Update body keys: ${Object.keys(body || {}).join(', ')}`);
    this.logger.log(`📝 Update body.payload keys: ${body?.payload ? Object.keys(body.payload).join(', ') : 'no payload'}`);
    this.logger.log(`📝 Update body.payload.id: ${body?.payload?.id || 'missing'}`);

    const normalized = this.normalizeForUpdate(body);

    if (!normalized.ok) {
      this.logger.error(`❌ NormalizeForUpdate failed. Mode: ${normalized.mode}, Errors: ${JSON.stringify(normalized.errors)}, Warnings: ${JSON.stringify(normalized.warnings)}`);
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
}
