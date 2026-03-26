import { Injectable, Logger } from '@nestjs/common';
import { IntentType } from './intent-classifier.service';
import { AssistantResponseDto } from '../dto/message.dto';
import { ASSISTANT_TABULAR_PREVIEW_ROWS } from '../constants/assistant-session.constants';

@Injectable()
export class ResponseGeneratorService {
  private readonly logger = new Logger(ResponseGeneratorService.name);

  /** Solo texto fallback / plantilla; el export usa el dataset completo en el servidor. */
  private slicePreview<T>(rows: T[] | null | undefined): {
    shown: T[];
    total: number;
  } {
    if (!rows?.length) return { shown: [], total: 0 };
    const total = rows.length;
    const shown =
      total <= ASSISTANT_TABULAR_PREVIEW_ROWS
        ? rows
        : rows.slice(0, ASSISTANT_TABULAR_PREVIEW_ROWS);
    return { shown, total };
  }

  private moreRowsNote(total: number, shownLen: number): string {
    if (total <= shownLen) return '';
    const n = total - shownLen;
    return `\n\n… (${n} registro(s) más no mostrados aquí; usa Excel, TXT o PDF para el listado completo.)`;
  }

  /** Normalizează la array pentru intenții tabulare (nu folosi pentru VACACIONES). */
  private assistantDataAsArray(data: unknown): any[] {
    if (data === null || data === undefined) {
      return [];
    }
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Generează răspuns în spaniolă bazat pe intenție și date
   */
  async generateResponse(
    intent: IntentType,
    data: unknown,
    confianza: number,
    entidades?: any,
  ): Promise<AssistantResponseDto> {
    switch (intent) {
      case IntentType.FICHAJES:
        return this.generateFichajesResponse(this.assistantDataAsArray(data));

      case IntentType.CUADRANTE:
        return this.generateCuadranteResponse(
          this.assistantDataAsArray(data),
          entidades,
        );

      case IntentType.PEDIDOS:
        return this.generatePedidosResponse(this.assistantDataAsArray(data));

      case IntentType.VACACIONES:
        return this.generateVacacionesResponse(data);

      case IntentType.EMPLEADOS:
        return this.generateEmpleadosResponse(
          this.assistantDataAsArray(data),
          entidades,
        );

      case IntentType.NOMINAS:
        return this.generateNominasResponse(
          this.assistantDataAsArray(data),
          entidades,
        );

      case IntentType.DIPLOMAS:
        return this.generateDiplomasResponse(this.assistantDataAsArray(data));

      case IntentType.DOCUMENTOS:
        return this.generateDocumentosResponse(this.assistantDataAsArray(data));

      case IntentType.DOCUMENTOS_SOLICITADOS:
        return this.generateDocumentosSolicitadosResponse(
          this.assistantDataAsArray(data),
        );

      case IntentType.SOLICITUDES:
        return this.generateSolicitudesResponse(data);

      case IntentType.COMUNICADOS:
        return this.generateComunicadosResponse(
          this.assistantDataAsArray(data),
        );

      case IntentType.PROCEDIMIENTOS:
        return this.generateProcedimientosResponse(
          this.assistantDataAsArray(data),
        );

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
    const empleadosList = Array.from(empleadosUnicos.values());
    const { shown, total } = this.slicePreview(empleadosList);
    const respuesta =
      `📊 Hoy han fichado ${numEmpleados} empleado${numEmpleados !== 1 ? 's' : ''}:\n\n` +
      shown
        .map((emp, i) => {
          const fichajesStr = emp.fichajes
            .map((f: any) => `${f.tipo} a las ${f.hora}`)
            .join(', ');
          return `${i + 1}. 👤 ${emp.nombre}\n   ⏰ ${fichajesStr}`;
        })
        .join('\n\n') +
      this.moreRowsNote(total, shown.length);

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

    const { shown, total } = this.slicePreview(data);
    const respuesta =
      `📅 Cuadrante encontrado (${total} registro(s)):\n\n` +
      shown
        .map(
          (c, i) =>
            `${i + 1}. 👤 ${c.NOMBRE || c.nombre || 'N/A'}\n` +
            `   📅 Mes: ${c.LUNA || c.luna || 'N/A'}\n` +
            `   🏢 Centro: ${c.CENTRO || c.centro || 'N/A'}\n` +
            `   ⏰ Total horas: ${c.TotalHoras || c.totalHoras || 'N/A'}`,
        )
        .join('\n\n') +
      this.moreRowsNote(total, shown.length);

    return {
      respuesta,
      confianza: 0.9,
      acciones: [
        {
          tipo: 'ver_cuadrante',
          label: 'Abrir Mi Horario (calendario)',
          payload: { tipo: 'cuadrante', mes: entidades?.mes },
        },
      ],
    };
  }

  private generatePedidosResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No hay pedidos de material/catálogo en el período consultado (o no tienes pedidos registrados).',
        confianza: 0.82,
      };
    }
    const { shown, total } = this.slicePreview(data);
    const respuesta =
      `📦 Pedidos (${total}):\n\n` +
      shown
        .map((p, i) => {
          const uid = p.pedido_uid ?? 'N/A';
          const est = p.estado ?? 'N/A';
          const tot = p.total != null ? String(p.total) : 'N/A';
          const mon = p.moneda ?? '';
          const cen = p.comunidad_nombre ?? '';
          return (
            `${i + 1}. **${uid}** — estado: ${est}, total: ${tot} ${mon}\n` +
            (cen ? `   Centro/comunidad: ${cen}\n` : '')
          );
        })
        .join('\n') +
      this.moreRowsNote(total, shown.length);
    return {
      respuesta,
      confianza: 0.88,
      acciones: [
        {
          tipo: 'ver_pedidos',
          label: 'Abrir Pedidos (empleado)',
          payload: { tipo: 'pedidos', href: '/empleado-pedidos' },
        },
      ],
    };
  }

  private generateEmpleadosResponse(
    data: any[],
    entidades?: { contrato_solicitud_procedimiento?: boolean },
  ): AssistantResponseDto {
    if (data?.length === 1 && data[0]?.row_kind === 'contrato_propio') {
      const r = data[0] as Record<string, unknown>;
      const nom =
        r.nombre != null && String(r.nombre).trim() !== ''
          ? String(r.nombre)
          : null;
      const docSubido = r.documento_contrato_subido === true;
      const lines: string[] = [];
      if (nom) {
        lines.push(`👤 ${nom}`);
      }
      lines.push(
        'Estos datos son tu **ficha administrativa** (`DatosEmpleados`: tipo, horas, centro, etc.). No sustituyen la firma de un PDF en la carpeta de documentos.',
      );
      if (entidades?.contrato_solicitud_procedimiento) {
        lines.push(
          '',
          'Para **solicitar una copia oficial** del contrato, contacta a **tu supervisión** o a **recursos humanos / administración de la empresa**; el centro de trabajo de la ficha es solo **dato de ubicación**, no el canal oficial para documentos.',
        );
      }
      lines.push('');
      lines.push('📄 **Resumen de tu contrato (datos de ficha)**');
      lines.push(`- Código: ${r.codigo != null ? String(r.codigo) : '—'}`);
      lines.push(
        `- Tipo: ${r.tipo_contrato != null ? String(r.tipo_contrato) : '—'}`,
      );
      lines.push(
        `- Horas de contrato: ${r.horas_contrato != null ? String(r.horas_contrato) : '—'}`,
      );
      lines.push(
        `- Fecha de alta: ${r.fecha_alta != null ? String(r.fecha_alta) : '—'}`,
      );
      if (
        r.fecha_antiguedad != null &&
        String(r.fecha_antiguedad).trim() !== ''
      ) {
        lines.push(`- Fecha antigüedad: ${String(r.fecha_antiguedad)}`);
      }
      if (r.antiguedad != null && String(r.antiguedad).trim() !== '') {
        lines.push(`- Antigüedad: ${String(r.antiguedad)}`);
      }
      lines.push(`- Empresa: ${r.empresa != null ? String(r.empresa) : '—'}`);
      lines.push(
        `- Centro de trabajo (referencia): ${r.centro != null ? String(r.centro) : '—'}`,
      );
      lines.push(`- Estado: ${r.estado != null ? String(r.estado) : '—'}`);
      lines.push('');
      lines.push('📎 **Copia del contrato en la app (Mis documentos)**');
      if (docSubido) {
        lines.push(
          'Consta al menos un **archivo** en tu carpeta con tipo o nombre que indica **contrato** (puedes abrirlo o descargarlo desde la sección **Documentos** / **Mis documentos**).',
        );
      } else {
        lines.push(
          '**No aparece** en la carpeta de la app un PDF/archivo de contrato con “contrato” en el nombre o tipo (o no está subido el fichero). Revisa **Mis documentos**; si falta, pide copia a **supervisión o RRHH de la empresa** (no confundas con el solo centro de trabajo de la ficha).',
        );
      }
      lines.push(
        '',
        '_(No se muestran por el chat el salario ni otros datos sensibles.)_',
      );
      return {
        respuesta: lines.join('\n'),
        confianza: 0.92,
      };
    }

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
      const p = this.slicePreview(sinCuadranteOHorario);
      respuesta += `📋 **Empleados sin cuadrante o horario asignado** (${sinCuadranteOHorario.length}):\n\n`;
      p.shown.forEach((emp: any, i: number) => {
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
      respuesta += this.moreRowsNote(p.total, p.shown.length);
      respuesta += '\n';
    }

    // Dacă avem angajați fără centro
    if (sinCentro.length > 0) {
      const p = this.slicePreview(sinCentro);
      respuesta += `🏢 **Empleados sin centro de trabajo asignado** (${sinCentro.length}):\n\n`;
      p.shown.forEach((emp: any, i: number) => {
        const nombre = emp.nombre || emp.NOMBRE || 'N/A';
        const codigo = emp.CODIGO || emp.codigo || 'N/A';
        respuesta += `${i + 1}. 👤 ${nombre} (Código: ${codigo})\n`;
        respuesta += `   ⚠️ Falta: centro de trabajo\n`;
        if (emp.grupo) respuesta += `   Grupo: ${emp.grupo}\n`;
        respuesta += '\n';
      });
      respuesta += this.moreRowsNote(p.total, p.shown.length);
    }

    // Dacă nu am grupat, afișăm lista (vista previa)
    if (respuesta === '') {
      const p = this.slicePreview(data);
      respuesta =
        `👥 Listado de empleados (${p.total} en total):\n\n` +
        p.shown
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
          .join('\n\n') +
        this.moreRowsNote(p.total, p.shown.length);
    }

    return {
      respuesta,
      confianza: 0.9,
    };
  }

  /** Saldo (objeto plano del asistente) vs fila de solicitud en tabla solicitudes */
  private isVacacionesSaldoPayload(d: any): boolean {
    return (
      d &&
      typeof d === 'object' &&
      !Array.isArray(d) &&
      'dias_restantes' in d &&
      'dias_anuales' in d &&
      !('fecha_solicitud' in d)
    );
  }

  private formatVacacionesSaldo(data: any): AssistantResponseDto {
    const respuesta =
      `🏖️ Información de vacaciones:\n\n` +
      `📊 Días anuales: ${data.dias_anuales ?? 0}\n` +
      `✅ Días generados hasta hoy: ${data.dias_generados_hasta_hoy ?? 0}\n` +
      `📉 Días consumidos: ${data.dias_consumidos_aprobados ?? 0}\n` +
      `🎯 Días restantes: ${data.dias_restantes ?? 0}`;

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

  private formatVacacionesSolicitudesList(rows: any[]): AssistantResponseDto {
    const p = this.slicePreview(rows);
    const respuesta =
      `📋 Solicitudes de vacaciones (${p.total}):\n\n` +
      p.shown
        .map((s, i) => {
          const ini = s.fecha_inicio ?? '—';
          const fin = s.fecha_fin ?? '—';
          const est = s.estado ?? '—';
          const nom = s.nombre ?? s.codigo ?? '—';
          return (
            `${i + 1}. 👤 ${nom}\n` +
            `   📌 Estado: ${est} | Tipo: ${s.tipo ?? '—'}\n` +
            `   📅 ${ini} → ${fin}`
          );
        })
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

    return {
      respuesta,
      confianza: 0.88,
      acciones: [
        {
          tipo: 'ver_vacaciones',
          label: 'Ver solicitudes en la app',
          payload: { tipo: 'vacaciones' },
        },
      ],
    };
  }

  private generateVacacionesResponse(data: unknown): AssistantResponseDto {
    if (data === null || data === undefined) {
      return {
        respuesta: 'No hay información de vacaciones disponible para mostrar.',
        confianza: 0.55,
        escalado: false,
      };
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return {
          respuesta:
            'No hay solicitudes de vacaciones que coincidan con tu consulta.',
          confianza: 0.82,
          escalado: false,
        };
      }
      const first = data[0];
      if (data.length === 1 && this.isVacacionesSaldoPayload(first)) {
        return this.formatVacacionesSaldo(first);
      }
      return this.formatVacacionesSolicitudesList(data);
    }

    if (typeof data === 'object' && this.isVacacionesSaldoPayload(data)) {
      return this.formatVacacionesSaldo(data);
    }

    return {
      respuesta:
        'No se pudo interpretar la información de vacaciones. Reformula la pregunta o revisa el módulo de vacaciones en la app.',
      confianza: 0.45,
      escalado: false,
    };
  }

  private generateNominasResponse(
    data: any[],
    entidades?: { faltan_nominas?: boolean; mes?: string; year?: string },
  ): AssistantResponseDto {
    const esSinNominaMes =
      data?.length > 0 && data.some((r) => r.row_kind === 'sin_nomina_mes');

    if (!data || data.length === 0) {
      if (entidades?.faltan_nominas) {
        const m = String(entidades.mes ?? '')
          .replace(/^completo_/i, '')
          .trim();
        const y = entidades.year?.trim() || String(new Date().getFullYear());
        return {
          respuesta:
            `✅ No hay empleados **ACTIVOS** sin nómina registrada en la consulta` +
            (m ? ` para **${m}** ${y}` : '') +
            ` (heurística: sin fila en tabla Nominas que coincida con mes/año).`,
          confianza: 0.85,
        };
      }
      return {
        respuesta: 'No se encontraron nóminas para el período consultado.',
        confianza: 0.8,
      };
    }

    if (esSinNominaMes) {
      const mesRef = data[0]?.mes_referencia ?? 'N/A';
      const anoRef = data[0]?.ano_referencia ?? '';
      const p = this.slicePreview(data);
      const respuesta =
        `📋 Empleados **ACTIVOS** sin nómina en **${mesRef}** ${anoRef} (${data.length}):\n\n` +
        p.shown
          .map(
            (n, i) =>
              `${i + 1}. **${n.nombre || 'N/A'}**\n` +
              `   Código: ${n.codigo_empleado ?? n.CODIGO ?? 'N/A'} · Estado: ${n.estado ?? 'N/A'}`,
          )
          .join('\n\n') +
        this.moreRowsNote(p.total, p.shown.length) +
        `\n\n_Nota: lista por heurística SQL (no es la nómina en sí); revisa RRHH o la app si hace falta._`;

      return {
        respuesta,
        confianza: 0.9,
      };
    }

    const p = this.slicePreview(data);
    const respuesta =
      `💰 Nóminas encontradas (${p.total}):\n\n` +
      p.shown
        .map(
          (n, i) =>
            `${i + 1}. 📄 ${n.nombre || n.NOMBRE || 'N/A'}\n` +
            `   📅 ${n.Mes || n.mes || 'N/A'} ${n.Ano || n.ano || ''}\n` +
            `   📆 Fecha subida: ${n.fecha_subida || 'N/A'}`,
        )
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

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

  private generateDiplomasResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No hay diplomas ni certificaciones subidos visibles en la consulta (tabla diplomas de la app).',
        confianza: 0.82,
      };
    }

    const p = this.slicePreview(data);
    const respuesta =
      `🎓 Diplomas / certificaciones en la app (${p.total}):\n\n` +
      p.shown
        .map(
          (d, i) =>
            `${i + 1}. **${d.nombre_empleado || 'Empleado'}**\n` +
            `   📄 Archivo: ${d.nombre_archivo || 'N/A'}\n` +
            `   📆 Subida: ${d.fecha_subida ? String(d.fecha_subida).slice(0, 10) : 'N/A'}` +
            (d.notas ? `\n   📝 Notas: ${String(d.notas).slice(0, 120)}` : ''),
        )
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

    return { respuesta, confianza: 0.9 };
  }

  private generateDocumentosResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No hay filas de documentos de inspección en la consulta. Puede que no existan registros o que el filtro sea muy estrecho; revisa la sección Documentos / Inspección en la app o reformula (por ejemplo «pendiente», «subidos este mes»).',
        confianza: 0.78,
      };
    }

    const p = this.slicePreview(data);
    const respuesta =
      `📄 Documentos encontrados (${p.total}):\n\n` +
      p.shown
        .map(
          (d, i) =>
            `${i + 1}. 📋 ${d.tipo_documento || 'Documento'}\n` +
            `   📅 Fecha: ${d.fecha_subida || 'N/A'}\n` +
            `   📌 Estado: ${d.estado || 'N/A'}`,
        )
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

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

  private generateDocumentosSolicitadosResponse(
    data: any[],
  ): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No hay solicitudes de documentación pendientes visibles para tu usuario (o ya están completadas). Revisa en la app la bandeja de documentos solicitados o pregunta a RRHH si esperabas algo concreto.',
        confianza: 0.78,
        escalado: false,
      };
    }

    const p = this.slicePreview(data);
    const respuesta =
      `📑 Documentación solicitada (${p.total}):\n\n` +
      p.shown
        .map(
          (d, i) =>
            `${i + 1}. ${d.tipo_documento || 'Documento'}\n` +
            `   Estado: ${d.estado || 'N/A'} · Solicitado: ${d.fecha_solicitud ? String(d.fecha_solicitud).slice(0, 10) : 'N/A'}`,
        )
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

    return { respuesta, confianza: 0.88, escalado: false };
  }

  private generateSolicitudesResponse(data: unknown): AssistantResponseDto {
    const emptyMsg =
      'No hay solicitudes ni registros en Ausencias (calendario) para el período consultado. Si acabas de crear uno, espera unos minutos o revísalo en la app.';

    if (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Array.isArray((data as Record<string, unknown>).solicitudes) &&
      Array.isArray((data as Record<string, unknown>).ausencias_calendario)
    ) {
      const s = (data as { solicitudes: any[] }).solicitudes ?? [];
      const a =
        (data as { ausencias_calendario: any[] }).ausencias_calendario ?? [];
      if (s.length === 0 && a.length === 0) {
        return {
          respuesta: emptyMsg,
          confianza: 0.78,
          escalado: false,
        };
      }
      const fmt = (d: unknown) =>
        d != null && String(d).trim() !== '' ? String(d).slice(0, 10) : '—';
      const parts: string[] = [];
      if (s.length > 0) {
        const ps = this.slicePreview(s);
        parts.push(
          `📋 Solicitudes (${s.length}):\n\n` +
            ps.shown
              .map(
                (row, i) =>
                  `${i + 1}. 👤 ${row.nombre || 'Sin nombre'} (${row.codigo || '—'})\n` +
                  `   Tipo: ${row.tipo || '—'} · Estado: ${row.estado || '—'}` +
                  (row.tipo_justificante
                    ? `\n   Justificante: ${row.tipo_justificante}`
                    : '') +
                  `\n   Periodo: ${fmt(row.fecha_inicio)} → ${fmt(row.fecha_fin)} · Solicitado: ${fmt(row.fecha_solicitud)}`,
              )
              .join('\n\n') +
            this.moreRowsNote(ps.total, ps.shown.length),
        );
      }
      if (a.length > 0) {
        const pa = this.slicePreview(a);
        parts.push(
          `📆 Ausencias / calendario (${a.length}, tabla Ausencias — misma fuente que cron n8n):\n\n` +
            pa.shown
              .map(
                (row, i) =>
                  `${i + 1}. 👤 ${row.NOMBRE || row.nombre || '—'} (${row.CODIGO || row.codigo || '—'})\n` +
                  `   Tipo: ${row.TIPO || row.tipo || '—'}\n` +
                  `   FECHA: ${row.FECHA_RAW ?? row.FECHA ?? '—'} · Intervalo: ${fmt(row.fecha_inicio)} → ${fmt(row.fecha_fin)}` +
                  (row.DURACION || row.UNIDAD_DURACION
                    ? `\n   Duración: ${[row.DURACION, row.UNIDAD_DURACION].filter(Boolean).join(' ')}`
                    : '') +
                  (row.LOCACION ? `\n   Ubicación: ${row.LOCACION}` : '') +
                  (row.MOTIVO
                    ? `\n   Motivo: ${String(row.MOTIVO).slice(0, 120)}${String(row.MOTIVO).length > 120 ? '…' : ''}`
                    : ''),
              )
              .join('\n\n') +
            this.moreRowsNote(pa.total, pa.shown.length),
        );
      }
      return {
        respuesta: parts.join('\n\n──────────\n\n'),
        confianza: 0.88,
        escalado: false,
      };
    }

    const arr = this.assistantDataAsArray(data);
    if (!arr || arr.length === 0) {
      return {
        respuesta: emptyMsg,
        confianza: 0.78,
        escalado: false,
      };
    }

    const fmt = (d: unknown) =>
      d != null && String(d).trim() !== '' ? String(d).slice(0, 10) : '—';
    const p = this.slicePreview(arr);
    const respuesta =
      `📋 Solicitudes (${p.total}):\n\n` +
      p.shown
        .map(
          (s, i) =>
            `${i + 1}. 👤 ${s.nombre || 'Sin nombre'} (${s.codigo || '—'})\n` +
            `   Tipo: ${s.tipo || '—'} · Estado: ${s.estado || '—'}` +
            (s.tipo_justificante
              ? `\n   Justificante: ${s.tipo_justificante}`
              : '') +
            `\n   Periodo: ${fmt(s.fecha_inicio)} → ${fmt(s.fecha_fin)} · Solicitado: ${fmt(s.fecha_solicitud)}`,
        )
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

    return { respuesta, confianza: 0.88, escalado: false };
  }

  private generateComunicadosResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No hay comunicados publicados recientes visibles. Cuando RRHH publique uno nuevo, aparecerá aquí y en la sección Comunicados de la app.',
        confianza: 0.75,
        escalado: false,
      };
    }

    const sinLeer = data.filter((c) => !c.leido_por_mi).length;
    const p = this.slicePreview(data);
    const respuesta =
      `📢 Comunicados (${data.length}${sinLeer ? `, ${sinLeer} sin leer` : ''}):\n\n` +
      p.shown
        .map(
          (c, i) =>
            `${i + 1}. ${c.titulo || 'Aviso'}${c.leido_por_mi ? ' ✓' : ' · NUEVO'}\n` +
            `   ${String(c.resumen_texto || '').slice(0, 120)}${String(c.resumen_texto || '').length > 120 ? '…' : ''}`,
        )
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

    return { respuesta, confianza: 0.85, escalado: false };
  }

  private generateProcedimientosResponse(data: any[]): AssistantResponseDto {
    if (!data || data.length === 0) {
      return {
        respuesta:
          'No hay un artículo exacto en la guía para eso, pero suele resolverse así: 1) Abre el menú de la app. 2) Entra en la sección que toque (Solicitudes/Vacaciones, Cuadrantes o Documentos). 3) Si no lo encuentras, reformula la pregunta o pide ayuda a administración.',
        confianza: 0.62,
        escalado: false,
      };
    }

    const p = this.slicePreview(data);
    const respuesta =
      `📚 Procedimientos encontrados (${p.total}):\n\n` +
      p.shown
        .map(
          (a, i) =>
            `${i + 1}. 📖 ${a.titulo || 'Artículo'}\n` +
            `   ${a.contenido?.substring(0, 100) || ''}...`,
        )
        .join('\n\n') +
      this.moreRowsNote(p.total, p.shown.length);

    return {
      respuesta,
      confianza: 0.8,
    };
  }

  private generateIncidenciasResponse(): AssistantResponseDto {
    return {
      respuesta:
        'Las incidencias se registran automáticamente cuando envías un mensaje clasificado como incidencia. Si no ves una referencia arriba, vuelve a intentarlo con más detalle.',
      confianza: 0.5,
      escalado: false,
    };
  }

  private generateDesconocidoResponse(): AssistantResponseDto {
    return {
      respuesta:
        'No he entendido tu pregunta. Reformula la consulta o usa el menú de la aplicación. Si necesitas reportar un fallo, indica «incidencia» o «reportar incidencia».',
      confianza: 0.15,
      escalado: false,
    };
  }
}
