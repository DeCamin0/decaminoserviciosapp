import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GruposService {
  private readonly logger = new Logger(GruposService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGrupos(): Promise<string[]> {
    try {
      // Extrage grupuri din tabelul de referință grupos_referencia
      // Acest tabel este independent de DatosEmpleados și nu afectează n8n
      const query = `
        SELECT \`nombre\`
        FROM grupos_referencia
        WHERE \`activo\` = TRUE
        ORDER BY \`nombre\` ASC
      `;

      const rows =
        await this.prisma.$queryRawUnsafe<Array<{ nombre: string }>>(query);

      const grupos = rows
        .map((row) => row.nombre?.trim())
        .filter(
          (grupo): grupo is string =>
            grupo !== null && grupo !== undefined && grupo !== '',
        );

      this.logger.log(
        `✅ Grupos retrieved from grupos_referencia: ${grupos.length} grupos`,
      );

      return grupos;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving grupos:', error);
      throw new BadRequestException(
        `Error al obtener grupos: ${error.message}`,
      );
    }
  }
}
