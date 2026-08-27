import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalcParams, DEFAULT_CALC_PARAMS, LineaCalcResult } from './tipos';
import {
  assertMotorImplemented,
  getMotorDefinition,
  listImplementedMotors,
  mergeInputs,
} from './motor-registry';

@Injectable()
export class CalculadoraV2Service {
  private readonly logger = new Logger(CalculadoraV2Service.name);

  constructor(private readonly prisma: PrismaService) {}

  listCodeMotors() {
    return listImplementedMotors().map((m) => ({
      codigo: m.codigo,
      version: m.version,
      label: m.label,
      inputSchema: m.inputSchema,
      defaultInputs: m.defaultInputs(),
    }));
  }

  getMotorSchema(codigo: string) {
    const m = getMotorDefinition(codigo);
    if (!m) {
      throw new BadRequestException(
        `Motor "${codigo}" no tiene implementación en código`,
      );
    }
    return {
      codigo: m.codigo,
      version: m.version,
      label: m.label,
      inputSchema: m.inputSchema,
      defaultInputs: m.defaultInputs(),
    };
  }

  async resolveParams(motorCodigo: string): Promise<CalcParams> {
    const params: CalcParams = { ...DEFAULT_CALC_PARAMS };
    try {
      const rows = await this.prisma.v2ParametroCalculo.findMany({
        where: {
          activo: true,
          OR: [
            { ambito: 'global', motor_codigo: '' },
            { ambito: 'motor', motor_codigo: motorCodigo },
          ],
        },
      });
      for (const row of rows) {
        const key = row.clave as keyof CalcParams;
        if (!(key in params)) continue;
        const raw = row.valor_json;
        const num =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
              ? Number(raw)
              : typeof raw === 'object' &&
                  raw !== null &&
                  'value' in (raw as object)
                ? Number((raw as { value: unknown }).value)
                : Number(raw);
        if (Number.isFinite(num)) {
          (params as any)[key] = num;
        }
      }
    } catch (e: any) {
      this.logger.warn(
        `resolveParams fallback to code defaults: ${e?.message || e}`,
      );
    }
    return params;
  }

  buildLineInputs(
    codigoMotor: string,
    servicioDefaults: unknown,
    lineInputs: unknown,
  ): Record<string, unknown> {
    const motor = assertMotorImplemented(codigoMotor);
    return mergeInputs(
      motor.defaultInputs(),
      (servicioDefaults as Record<string, unknown>) || null,
      (lineInputs as Record<string, unknown>) || null,
    );
  }

  async calculateLine(opts: {
    codigoMotor: string;
    versionMotorDb?: string | null;
    servicioDefaults?: unknown;
    inputs?: unknown;
  }): Promise<{
    inputs_efectivos: Record<string, unknown>;
    resultado: LineaCalcResult;
  }> {
    let motor;
    try {
      motor = assertMotorImplemented(opts.codigoMotor);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }

    const params = await this.resolveParams(opts.codigoMotor);
    const inputs_efectivos = this.buildLineInputs(
      opts.codigoMotor,
      opts.servicioDefaults,
      opts.inputs,
    );
    const resultado = motor.calculate(inputs_efectivos, params);
    if (opts.versionMotorDb && opts.versionMotorDb !== motor.version) {
      resultado.warnings = [
        ...(resultado.warnings || []),
        `versión motor DB=${opts.versionMotorDb} vs código=${motor.version}`,
      ];
    }
    return { inputs_efectivos, resultado };
  }

  /** Preview without persistence */
  async preview(codigoMotor: string, inputs: Record<string, unknown>) {
    return this.calculateLine({ codigoMotor, inputs });
  }

  jsonValue(v: unknown): Prisma.InputJsonValue {
    return v as Prisma.InputJsonValue;
  }
}
