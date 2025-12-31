import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    datos_consultados?: any;
    error?: string;
  }): Promise<void> {
    try {
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
          ${data.datos_consultados ? this.escapeSql(JSON.stringify(data.datos_consultados)) : 'NULL'},
          ${data.error ? this.escapeSql(data.error) : 'NULL'},
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
