import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmpleadoByCodigo(codigo: string) {
    if (!codigo) {
      throw new NotFoundException('Employee code is required');
    }

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\`,
        \`NACIONALIDAD\`,
        \`DIRECCION\`,
        \`D.N.I. / NIE\`,
        \`SEG. SOCIAL\`,
        \`Nº Cuenta\`,
        \`TELEFONO\`,
        \`CORREO ELECTRONICO\`,
        \`FECHA NACIMIENTO\`,
        \`FECHA DE ALTA\`,
        \`CENTRO TRABAJO\`,
        \`TIPO DE CONTRATO\`,
        \`SUELDO BRUTO MENSUAL\`,
        \`HORAS DE CONTRATO\`,
        \`EMPRESA\`,
        \`GRUPO\`,
        \`ESTADO\`,
        \`FECHA BAJA\`,
        \`Fecha Antigüedad\`,
        \`Antigüedad\`,
        \`DerechoPedidos\`,
        \`TrabajaFestivos\`
      FROM DatosEmpleados
      WHERE CODIGO = ${codigo}
      LIMIT 1
    `;

    const empleado = rows?.[0];

    if (!empleado) {
      throw new NotFoundException('Employee not found');
    }

    // Normalize keys frequently used in frontend (keep originals too)
    const normalized = {
      ...empleado,
      NOMBRE_APELLIDOS:
        empleado['NOMBRE / APELLIDOS'] ?? empleado.NOMBRE_APELLIDOS ?? null,
      ['NOMBRE / APELLIDOS']:
        empleado['NOMBRE / APELLIDOS'] ?? empleado.NOMBRE_APELLIDOS ?? null,
      CORREO_ELECTRONICO:
        empleado['CORREO ELECTRONICO'] ?? empleado.CORREO_ELECTRONICO ?? null,
      DNI_NIE: empleado['D.N.I. / NIE'] ?? empleado.DNI_NIE ?? null,
      SEG_SOCIAL: empleado['SEG. SOCIAL'] ?? empleado.SEG_SOCIAL ?? null,
      NUMERO_CUENTA: empleado['Nº Cuenta'] ?? empleado.NUMERO_CUENTA ?? null,
      CENTRO_TRABAJO:
        empleado['CENTRO TRABAJO'] ?? empleado.CENTRO_TRABAJO ?? null,
      SUELDO_BRUTO_MENSUAL:
        empleado['SUELDO BRUTO MENSUAL'] ??
        empleado.SUELDO_BRUTO_MENSUAL ??
        null,
      HORAS_CONTRATO:
        empleado['HORAS DE CONTRATO'] ?? empleado.HORAS_CONTRATO ?? null,
      FECHA_NACIMIENTO:
        empleado['FECHA NACIMIENTO'] ?? empleado.FECHA_NACIMIENTO ?? null,
      FECHA_DE_ALTA:
        empleado['FECHA DE ALTA'] ?? empleado.FECHA_DE_ALTA ?? null,
      FECHA_BAJA: empleado['FECHA BAJA'] ?? empleado.FECHA_BAJA ?? null,
      FECHA_ANTIGUEDAD:
        empleado['Fecha Antigüedad'] ?? empleado.FECHA_ANTIGUEDAD ?? null,
      ANTIGUEDAD: empleado['Antigüedad'] ?? empleado.ANTIGUEDAD ?? null,
      empleadoId: empleado.CODIGO,
      empleadoNombre:
        empleado['NOMBRE / APELLIDOS'] ??
        empleado.NOMBRE_APELLIDOS ??
        empleado['CORREO ELECTRONICO'] ??
        empleado.CORREO_ELECTRONICO ??
        empleado.CODIGO ??
        null,
      email:
        empleado['CORREO ELECTRONICO'] ?? empleado.CORREO_ELECTRONICO ?? null,
    };

    return normalized;
  }
}
