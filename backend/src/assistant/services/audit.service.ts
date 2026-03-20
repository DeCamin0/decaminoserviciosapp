import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Metadatos compactos en columna `datos_consultados` (JSON, sin migración). */
export type AssistantAuditMetrics = {
  durationMs: number;
  resultCount?: number;
  tools?: string[];
  responseStatus?: string;
  responseType?: string;
  queryError?: boolean;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private buildDatosConsultadosJson(data: {
    datos_consultados?: number;
    auditMetrics?: AssistantAuditMetrics;
  }): string | null {
    const payload: Record<string, unknown> = { v: 2 };
    const m = data.auditMetrics;
    if (m?.durationMs !== undefined) {
      payload.durationMs = m.durationMs;
    }
    if (m?.tools?.length) {
      payload.tools = m.tools.slice(0, 20);
    }
    if (m?.responseStatus) {
      payload.responseStatus = String(m.responseStatus).slice(0, 40);
    }
    if (m?.responseType) {
      payload.responseType = String(m.responseType).slice(0, 40);
    }
    if (m?.queryError === true) {
      payload.queryError = true;
    }
    const rc =
      m?.resultCount !== undefined
        ? m.resultCount
        : data.datos_consultados !== undefined
          ? data.datos_consultados
          : undefined;
    if (rc !== undefined) {
      payload.resultCount = rc;
    }
    if (Object.keys(payload).length <= 1 && payload.v === 2) {
      return null;
    }
    return JSON.stringify(payload).slice(0, 3500);
  }

  /**
   * Registrează o interacțiune în audit log
   */
  async logInteraction(data: {
    usuario_id: string;
    usuario_nombre: string;
    usuario_rol: string | null;
    mensaje: string;
    intent_detectado?: string;
    confianza?: number;
    respuesta?: string;
    escalado?: boolean;
    ticket_id?: string;
    /** @deprecated preferir auditMetrics.resultCount */
    datos_consultados?: number;
    auditMetrics?: AssistantAuditMetrics;
    error?: string;
  }): Promise<void> {
    try {
      const datosJson = this.buildDatosConsultadosJson({
        datos_consultados: data.datos_consultados,
        auditMetrics: data.auditMetrics,
      });

      const query = `
        INSERT INTO assistant_audit_log (
          usuario_id,
          usuario_nombre,
          usuario_rol,
          mensaje,
          intent_detectado,
          confianza,
          respuesta,
          escalado,
          ticket_id,
          datos_consultados,
          error,
          created_at
        ) VALUES (
          ${this.escapeSql(data.usuario_id)},
          ${this.escapeSql(data.usuario_nombre)},
          ${data.usuario_rol ? this.escapeSql(data.usuario_rol) : 'NULL'},
          ${this.escapeSql(data.mensaje)},
          ${data.intent_detectado ? this.escapeSql(data.intent_detectado) : 'NULL'},
          ${data.confianza !== undefined ? data.confianza : 'NULL'},
          ${data.respuesta ? this.escapeSql(data.respuesta.substring(0, 5000)) : 'NULL'},
          ${data.escalado ? 'TRUE' : 'FALSE'},
          ${data.ticket_id ? this.escapeSql(data.ticket_id) : 'NULL'},
          ${datosJson ? this.escapeSql(datosJson) : 'NULL'},
          ${data.error ? this.escapeSql(data.error.substring(0, 2000)) : 'NULL'},
          NOW()
        )
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.debug(
        `✅ Audit log registrado para usuario ${data.usuario_id}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error registrando audit log: ${error.message}`,
        error.stack,
      );
      // No lanzamos error - el audit es no crítico
    }
  }

  private escapeSql(value: string): string {
    if (!value) return "''";
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }
}
