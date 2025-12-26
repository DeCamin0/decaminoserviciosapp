import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escape SQL string pentru prevenirea SQL injection
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    const str = String(value);
    return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }

  /**
   * Generează un UID pentru pedido în format: =YYYYMMDDHHMMSS-ID
   */
  private generatePedidoUid(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const randomId = Math.floor(Math.random() * 10);
    return `=${year}${month}${day}${hours}${minutes}${seconds}-${randomId}`;
  }

  /**
   * Salvează un pedido în baza de date
   * Creează un rând în PedidosTodos pentru fiecare item din pedido
   */
  async savePedido(pedidoData: {
    empleado: {
      id: string;
      nombre: string;
      email: string;
      centro_trabajo: string;
    };
    comunidad: {
      id: number | string;
      nombre: string;
      direccion?: string;
      codigo_postal?: string;
      localidad?: string;
      provincia?: string;
      telefono?: string;
      email?: string;
      nif?: string;
      dni?: string;
      limite_gasto?: number;
    };
    pedido: {
      fecha: string;
      moneda: string;
      descuento_global: number;
      impuestos: number;
      notas?: string;
      subtotal: number;
      iva_total: number;
      total: number;
      limite_excedido: boolean;
      exceso_limite: number;
      items: Array<{
        producto_id: number;
        numero_articulo: string;
        descripcion: string;
        cantidad: number;
        precio_unitario: number;
        subtotal_linea: number;
        descuento_linea: number;
        iva_porcentaje: number;
        iva_linea: number;
        total_linea: number;
      }>;
    };
  }): Promise<{
    status: string;
    message: string;
    pedido_uid: string;
    empleado: any;
    comunidad: any;
    resumen_pedido: any;
  }> {
    try {
      this.logger.log(
        `📦 Saving pedido for empleado: ${pedidoData.empleado.id}, comunidad: ${pedidoData.comunidad.id}`,
      );

      // Validează datele
      if (!pedidoData.empleado || !pedidoData.comunidad || !pedidoData.pedido) {
        throw new BadRequestException(
          'empleado, comunidad și pedido sunt obligatorii',
        );
      }

      if (!pedidoData.pedido.items || pedidoData.pedido.items.length === 0) {
        throw new BadRequestException(
          'pedido trebuie să aibă cel puțin un item',
        );
      }

      // Generează UID pentru pedido
      const pedidoUid = this.generatePedidoUid();

      // Parsează fecha pentru MySQL
      let fechaSQL = 'NULL';
      if (pedidoData.pedido.fecha) {
        try {
          const fechaDate = new Date(pedidoData.pedido.fecha);
          if (!isNaN(fechaDate.getTime())) {
            const fechaFormatted = fechaDate
              .toISOString()
              .slice(0, 19)
              .replace('T', ' ');
            fechaSQL = this.escapeSql(fechaFormatted);
          }
        } catch {
          this.logger.warn(
            `⚠️ Error parsing fecha: ${pedidoData.pedido.fecha}, using NULL`,
          );
        }
      }

      // Parsează comunidad_id
      const comunidadId =
        typeof pedidoData.comunidad.id === 'number'
          ? pedidoData.comunidad.id
          : pedidoData.comunidad.id !== 'N/A'
            ? parseInt(String(pedidoData.comunidad.id), 10)
            : null;

      // Salvează fiecare item ca un rând separat în PedidosTodos
      const insertQueries: string[] = [];

      for (const item of pedidoData.pedido.items) {
        const insertQuery = `
          INSERT INTO PedidosTodos (
            pedido_uid,
            empleado_id,
            empleado_nombre,
            empleado_email,
            comunidad_id,
            comunidad_nombre,
            comunidad_direccion,
            comunidad_codigo_postal,
            comunidad_localidad,
            comunidad_provincia,
            comunidad_telefono,
            comunidad_email,
            comunidad_nif,
            comunidad_limite_gasto,
            fecha,
            moneda,
            descuento_global,
            impuestos,
            subtotal,
            iva_total,
            total,
            limite_excedido,
            exceso_limite,
            notas,
            producto_id,
            numero_articulo,
            descripcion,
            cantidad,
            precio_unitario,
            subtotal_linea,
            descuento_linea,
            iva_porcentaje,
            iva_linea,
            total_linea
          ) VALUES (
            ${this.escapeSql(pedidoUid)},
            ${this.escapeSql(pedidoData.empleado.id)},
            ${this.escapeSql(pedidoData.empleado.nombre)},
            ${this.escapeSql(pedidoData.empleado.email)},
            ${comunidadId !== null ? comunidadId : 'NULL'},
            ${this.escapeSql(pedidoData.comunidad.nombre)},
            ${this.escapeSql(pedidoData.comunidad.direccion || '')},
            ${this.escapeSql(pedidoData.comunidad.codigo_postal || '')},
            ${this.escapeSql(pedidoData.comunidad.localidad || '')},
            ${this.escapeSql(pedidoData.comunidad.provincia || '')},
            ${this.escapeSql(pedidoData.comunidad.telefono || '')},
            ${this.escapeSql(pedidoData.comunidad.email || '')},
            ${this.escapeSql(pedidoData.comunidad.nif || '')},
            ${pedidoData.comunidad.limite_gasto !== undefined ? pedidoData.comunidad.limite_gasto : 'NULL'},
            ${fechaSQL},
            ${this.escapeSql(pedidoData.pedido.moneda)},
            ${pedidoData.pedido.descuento_global},
            ${pedidoData.pedido.impuestos},
            ${pedidoData.pedido.subtotal},
            ${pedidoData.pedido.iva_total},
            ${pedidoData.pedido.total},
            ${pedidoData.pedido.limite_excedido ? 1 : 0},
            ${pedidoData.pedido.exceso_limite},
            ${this.escapeSql(pedidoData.pedido.notas || '')},
            ${item.producto_id},
            ${this.escapeSql(item.numero_articulo)},
            ${this.escapeSql(item.descripcion)},
            ${item.cantidad},
            ${item.precio_unitario},
            ${item.subtotal_linea},
            ${item.descuento_linea},
            ${item.iva_porcentaje},
            ${item.iva_linea},
            ${item.total_linea}
          )
        `;
        insertQueries.push(insertQuery);
      }

      // Execută toate INSERT-urile
      for (const query of insertQueries) {
        await this.prisma.$executeRawUnsafe(query);
      }

      this.logger.log(
        `✅ Pedido ${pedidoUid} saved successfully with ${pedidoData.pedido.items.length} items`,
      );

      // Returnează răspuns în format compatibil cu n8n
      return {
        status: 'ok',
        message: 'Pedido guardado correctamente.',
        pedido_uid: pedidoUid,
        empleado: {
          id: `=${pedidoData.empleado.id}`,
          nombre: `=${pedidoData.empleado.nombre}`,
          email: `=${pedidoData.empleado.email}`,
        },
        comunidad: {
          id: `=${pedidoData.comunidad.id}`,
          nombre: `=${pedidoData.comunidad.nombre}`,
        },
        resumen_pedido: {
          fecha: `=${pedidoData.pedido.fecha}`,
          moneda: `=${pedidoData.pedido.moneda}`,
          subtotal: `=${pedidoData.pedido.subtotal}`,
          iva_total: `=${pedidoData.pedido.iva_total}`,
          total: `=${pedidoData.pedido.total}`,
          limite_excedido: `=${pedidoData.pedido.limite_excedido ? 1 : 0}`,
          exceso_limite: `=${pedidoData.pedido.exceso_limite}`,
        },
      };
    } catch (error: any) {
      this.logger.error('❌ Error saving pedido:', error);
      throw error;
    }
  }
}
