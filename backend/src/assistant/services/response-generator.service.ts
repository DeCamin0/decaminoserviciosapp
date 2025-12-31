import { Injectable, Logger } from '@nestjs/common';
import { IntentType } from './intent-classifier.service';
import { AssistantResponseDto } from '../dto/message.dto';

@Injectable()
export class ResponseGeneratorService {
  private readonly logger = new Logger(ResponseGeneratorService.name);

  /**
   * Generează răspuns în spaniolă bazat pe intenție și date
   */
  async generateResponse(
    intent: IntentType,
    data: any[],
    confianza: number,
    entidades?: any,
  ): Promise<AssistantResponseDto> {
    switch (intent) {
      case IntentType.FICHAJES:
        return this.generateFichajesResponse(data);

      case IntentType.CUADRANTE:
        return this.generateCuadranteResponse(data, entidades);

      case IntentType.VACACIONES:
        return this.generateVacacionesResponse(data);

      case IntentType.EMPLEADOS:
        return this.generateEmpleadosResponse(data);

      case IntentType.NOMINAS:
        return this.generateNominasResponse(data);

      case IntentType.DOCUMENTOS:
        return this.generateDocumentosResponse(data);

      case IntentType.PROCEDIMIENTOS:
        return this.generateProcedimientosResponse(data);

      case IntentType.INCIDENCIAS:
        return this.generateIncidenciasResponse();

      default:
        return this.generateDesconocidoResponse();
    }
  }

  private generateFichajesResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta: 'No se encontraron registros de fichaje para hoy.',
        confianza: 0.8,
      };
    }

    // Filtrează doar registrele de astăzi (query-ul ar trebui să returneze doar astăzi, dar verificăm)
    const hoy = data.filter((f) => {
      const fecha = f.FECHA || f.fecha;
      if (!fecha) return false;
      const fechaObj = new Date(fecha);
      const hoyObj = new Date();
      return fechaObj.toDateString() === hoyObj.toDateString();
    });

    if (hoy.length === 0) {
      return {
        respuesta: 'No hay registros de fichaje para hoy.',
        confianza: 0.8,
      };
    }

    // Agrupează după CODIGO pentru a număra câți angajați au fichat
    const empleadosUnicos = new Map<string, any>();
    hoy.forEach((f) => {
      const codigo = f.CODIGO || f.codigo;
      const nombre = f.nombre_apellidos || f['NOMBRE / APELLIDOS'] || 'N/A';
      if (codigo && !empleadosUnicos.has(codigo)) {
        empleadosUnicos.set(codigo, {
          codigo,
          nombre,
          fichajes: [],
        });
      }
      if (codigo) {
        empleadosUnicos.get(codigo)?.fichajes.push({
          hora: f.HORA || f.hora || 'N/A',
          tipo: f.TIPO || f.tipo || 'N/A',
        });
      }
    });

    const numEmpleados = empleadosUnicos.size;
    const respuesta =
      `📊 Hoy han fichado ${numEmpleados} empleado${numEmpleados !== 1 ? 's' : ''}:\n\n` +
      Array.from(empleadosUnicos.values())
        .map((emp, i) => {
          const fichajesStr = emp.fichajes
            .map((f: any) => `${f.tipo} a las ${f.hora}`)
            .join(', ');
          return `${i + 1}. 👤 ${emp.nombre}\n   ⏰ ${fichajesStr}`;
        })
        .join('\n\n');

    return {
      respuesta,
      confianza: 0.9,
      acciones: [
        {
          tipo: 'ver_detalle',
          label: 'Ver todos los fichajes de hoy',
          payload: {
            tipo: 'fichajes',
            fecha: new Date().toISOString().split('T')[0],
          },
        },
      ],
    };
  }

  private generateCuadranteResponse(
    data: any[],
    entidades?: any,
  ): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No se encontró información del cuadrante para el período consultado.',
        confianza: 0.8,
      };
    }

    const respuesta =
      `📅 Cuadrante encontrado (${data.length} registro(s)):\n\n` +
      data
        .map(
          (c, i) =>
            `${i + 1}. 👤 ${c.NOMBRE || c.nombre || 'N/A'}\n` +
            `   📅 Mes: ${c.LUNA || c.luna || 'N/A'}\n` +
            `   🏢 Centro: ${c.CENTRO || c.centro || 'N/A'}\n` +
            `   ⏰ Total horas: ${c.TotalHoras || c.totalHoras || 'N/A'}`,
        )
        .join('\n\n');

    return {
      respuesta,
      confianza: 0.9,
      acciones: [
        {
          tipo: 'ver_cuadrante',
          label: 'Ver cuadrante completo',
          payload: { tipo: 'cuadrante', mes: entidades?.mes },
        },
      ],
    };
  }

  private generateEmpleadosResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No se encontraron empleados que cumplan con los criterios solicitados.',
        confianza: 0.8,
      };
    }

    // Grupează angajații după ce lipsește
    const sinCentro = data.filter((emp: any) => emp.tiene_centro === 'No');
    const sinCuadranteOHorario = data.filter(
      (emp: any) => emp.tiene_cuadrante === 'No' || emp.tiene_horario === 'No',
    );

    let respuesta = '';

    // Dacă avem angajați fără cuadrante sau horario
    if (sinCuadranteOHorario.length > 0) {
      respuesta += `📋 **Empleados sin cuadrante o horario asignado** (${sinCuadranteOHorario.length}):\n\n`;
      sinCuadranteOHorario.forEach((emp: any, i: number) => {
        const detalles: string[] = [];
        if (emp.tiene_cuadrante === 'No') detalles.push('sin cuadrante');
        if (emp.tiene_horario === 'No') detalles.push('sin horario');
        const nombre = emp.nombre || emp.NOMBRE || 'N/A';
        const codigo = emp.CODIGO || emp.codigo || 'N/A';
        respuesta += `${i + 1}. 👤 ${nombre} (Código: ${codigo})\n`;
        respuesta += `   ⚠️ Falta: ${detalles.join(', ')}\n`;
        if (emp.centro && emp.centro !== 'N/A')
          respuesta += `   Centro: ${emp.centro}\n`;
        respuesta += '\n';
      });
      respuesta += '\n';
    }

    // Dacă avem angajați fără centro
    if (sinCentro.length > 0) {
      respuesta += `🏢 **Empleados sin centro de trabajo asignado** (${sinCentro.length}):\n\n`;
      sinCentro.forEach((emp: any, i: number) => {
        const nombre = emp.nombre || emp.NOMBRE || 'N/A';
        const codigo = emp.CODIGO || emp.codigo || 'N/A';
        respuesta += `${i + 1}. 👤 ${nombre} (Código: ${codigo})\n`;
        respuesta += `   ⚠️ Falta: centro de trabajo\n`;
        if (emp.grupo) respuesta += `   Grupo: ${emp.grupo}\n`;
        respuesta += '\n';
      });
    }

    // Dacă nu am grupat, afișăm lista completă
    if (respuesta === '') {
      respuesta =
        `👥 Listado de empleados (${data.length} en total):\n\n` +
        data
          .map((emp: any, i: number) => {
            const cuadrante = emp.tiene_cuadrante === 'Sí' ? 'Sí' : 'No';
            const horario = emp.tiene_horario === 'Sí' ? 'Sí' : 'No';
            const centro = emp.tiene_centro === 'Sí' ? 'Sí' : 'No';
            const nombre = emp.nombre || emp.NOMBRE || 'N/A';
            const codigo = emp.CODIGO || emp.codigo || 'N/A';
            return (
              `${i + 1}. 👤 ${nombre} (Código: ${codigo})\n` +
              `   Estado: ${emp.estado || 'N/A'}\n` +
              `   Cuadrante asignado: ${cuadrante}\n` +
              `   Horario asignado: ${horario}\n` +
              `   Centro asignado: ${centro}`
            );
          })
          .join('\n\n');
    }

    return {
      respuesta,
      confianza: 0.9,
    };
  }

  private generateVacacionesResponse(data: any): AssistantResponseDto {
    if (!data || (typeof data === 'object' && !data.dias_restantes)) {
      return {
        respuesta:
          'No se pudo obtener la información de vacaciones. Por favor, contacta con administración.',
        confianza: 0.3,
        escalado: true,
      };
    }

    const respuesta =
      `🏖️ Información de vacaciones:\n\n` +
      `📊 Días anuales: ${data.dias_anuales || 0}\n` +
      `✅ Días generados hasta hoy: ${data.dias_generados_hasta_hoy || 0}\n` +
      `📉 Días consumidos: ${data.dias_consumidos_aprobados || 0}\n` +
      `🎯 Días restantes: ${data.dias_restantes || 0}`;

    return {
      respuesta,
      confianza: 0.9,
      acciones: [
        {
          tipo: 'ver_vacaciones',
          label: 'Ver detalle de vacaciones',
          payload: { tipo: 'vacaciones' },
        },
      ],
    };
  }

  private generateNominasResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta: 'No se encontraron nóminas para el período consultado.',
        confianza: 0.8,
      };
    }

    const respuesta =
      `💰 Nóminas encontradas (${data.length}):\n\n` +
      data
        .map(
          (n, i) =>
            `${i + 1}. 📄 ${n.nombre || n.NOMBRE || 'N/A'}\n` +
            `   📅 ${n.Mes || n.mes || 'N/A'} ${n.Ano || n.ano || ''}\n` +
            `   📆 Fecha subida: ${n.fecha_subida || 'N/A'}`,
        )
        .join('\n\n');

    return {
      respuesta,
      confianza: 0.9,
      acciones: [
        {
          tipo: 'descargar_nomina',
          label: 'Descargar nómina',
          payload: { tipo: 'nominas' },
        },
      ],
    };
  }

  private generateDocumentosResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta: 'No se encontraron documentos.',
        confianza: 0.8,
      };
    }

    const respuesta =
      `📄 Documentos encontrados (${data.length}):\n\n` +
      data
        .map(
          (d, i) =>
            `${i + 1}. 📋 ${d.tipo_documento || 'Documento'}\n` +
            `   📅 Fecha: ${d.fecha_subida || 'N/A'}\n` +
            `   📌 Estado: ${d.estado || 'N/A'}`,
        )
        .join('\n\n');

    return {
      respuesta,
      confianza: 0.9,
      acciones: [
        {
          tipo: 'ver_documentos',
          label: 'Ver todos los documentos',
          payload: { tipo: 'documentos' },
        },
      ],
    };
  }

  private generateProcedimientosResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No se encontraron artículos de procedimientos. Se ha creado una incidencia para administración.',
        confianza: 0.3,
        escalado: true,
      };
    }

    const respuesta =
      `📚 Procedimientos encontrados (${data.length}):\n\n` +
      data
        .map(
          (a, i) =>
            `${i + 1}. 📖 ${a.titulo || 'Artículo'}\n` +
            `   ${a.contenido?.substring(0, 100) || ''}...`,
        )
        .join('\n\n');

    return {
      respuesta,
      confianza: 0.8,
    };
  }

  private generateIncidenciasResponse(): AssistantResponseDto {
    return {
      respuesta:
        'He registrado tu incidencia. Un administrador se pondrá en contacto contigo pronto.',
      confianza: 0.9,
      escalado: true,
    };
  }

  private generateDesconocidoResponse(): AssistantResponseDto {
    return {
      respuesta:
        'No he entendido tu pregunta. Por favor, reformula tu consulta o contacta con administración.',
      confianza: 0.1,
      escalado: true,
    };
  }
}
