import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

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
      estado?: string;
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

      // Obține statusul din payload sau folosește "pendiente" ca default
      const estadoPedido = (pedidoData.pedido as any).estado || 'pendiente';

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
            total_linea,
            estado
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
            ${item.total_linea},
            ${this.escapeSql(estadoPedido)}
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

  /**
   * Obține toate comenzile grupate după pedido_uid
   * @param estado - Filtrare opțională după status (pendiente, aprobado, rechazado)
   */
  async getAllPedidos(estado?: string): Promise<any[]> {
    try {
      let query = `
        SELECT 
          pedido_uid,
          MAX(empleado_id) as empleado_id,
          MAX(empleado_nombre) as empleado_nombre,
          MAX(empleado_email) as empleado_email,
          MAX(comunidad_id) as comunidad_id,
          MAX(comunidad_nombre) as comunidad_nombre,
          MAX(comunidad_direccion) as comunidad_direccion,
          MAX(comunidad_codigo_postal) as comunidad_codigo_postal,
          MAX(comunidad_localidad) as comunidad_localidad,
          MAX(comunidad_provincia) as comunidad_provincia,
          MAX(comunidad_telefono) as comunidad_telefono,
          MAX(comunidad_email) as comunidad_email,
          MAX(comunidad_nif) as comunidad_nif,
          MAX(fecha) as fecha,
          MAX(moneda) as moneda,
          MAX(descuento_global) as descuento_global,
          MAX(impuestos) as impuestos,
          MAX(subtotal) as subtotal,
          MAX(iva_total) as iva_total,
          MAX(total) as total,
          MAX(limite_excedido) as limite_excedido,
          MAX(exceso_limite) as exceso_limite,
          MAX(notas) as notas,
          MAX(estado) as estado,
          MAX(fecha_envio) as fecha_envio,
          MAX(creado_en) as creado_en,
          COUNT(*) as num_items,
          GROUP_CONCAT(
            CONCAT(
              COALESCE(numero_articulo, ''), '|',
              COALESCE(descripcion, ''), '|',
              COALESCE(cantidad, 0), '|',
              COALESCE(precio_unitario, 0), '|',
              COALESCE(subtotal_linea, 0), '|',
              COALESCE(iva_linea, 0), '|',
              COALESCE(total_linea, 0)
            ) SEPARATOR ';;'
          ) as items
        FROM PedidosTodos
      `;

      if (estado) {
        query += ` WHERE estado = ${this.escapeSql(estado)}`;
      }

      query += `
        GROUP BY pedido_uid
        ORDER BY MAX(creado_en) DESC
      `;

      this.logger.log(`📊 Executing query for getAllPedidos${estado ? ` with estado: ${estado}` : ''}`);
      
      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(`📊 Query returned ${rows.length} rows`);

      if (rows.length === 0) {
        this.logger.warn(`⚠️ No pedidos found${estado ? ` with estado: ${estado}` : ''}`);
        return [];
      }

      // Procesează rezultatele pentru a formata items-urile
      const pedidos = rows.map((row) => {
        const items = row.items
          ? row.items.split(';;').map((itemStr: string) => {
              const [numero_articulo, descripcion, cantidad, precio_unitario, subtotal_linea, iva_linea, total_linea] =
                itemStr.split('|');
              return {
                numero_articulo,
                descripcion,
                cantidad: parseFloat(cantidad),
                precio_unitario: parseFloat(precio_unitario),
                subtotal_linea: parseFloat(subtotal_linea),
                iva_linea: parseFloat(iva_linea),
                total_linea: parseFloat(total_linea),
              };
            })
          : [];

        return {
          pedido_uid: row.pedido_uid,
          empleado: {
            id: row.empleado_id,
            nombre: row.empleado_nombre,
            email: row.empleado_email,
          },
          comunidad: {
            id: row.comunidad_id,
            nombre: row.comunidad_nombre,
            direccion: row.comunidad_direccion,
            codigo_postal: row.comunidad_codigo_postal,
            localidad: row.comunidad_localidad,
            provincia: row.comunidad_provincia,
            telefono: row.comunidad_telefono,
            email: row.comunidad_email,
            nif: row.comunidad_nif,
          },
          fecha: row.fecha,
          moneda: row.moneda,
          descuento_global: row.descuento_global ? parseFloat(row.descuento_global.toString()) : 0,
          impuestos: row.impuestos ? parseFloat(row.impuestos.toString()) : 0,
          subtotal: row.subtotal ? parseFloat(row.subtotal.toString()) : 0,
          iva_total: row.iva_total ? parseFloat(row.iva_total.toString()) : 0,
          total: row.total ? parseFloat(row.total.toString()) : 0,
          limite_excedido: row.limite_excedido === 1 || row.limite_excedido === true,
          exceso_limite: row.exceso_limite ? parseFloat(row.exceso_limite.toString()) : 0,
          notas: row.notas,
          estado: row.estado || 'pendiente',
          fecha_envio: row.fecha_envio,
          creado_en: row.creado_en,
          num_items: parseInt(row.num_items.toString()),
          items,
        };
      });

      this.logger.log(`✅ Retrieved ${pedidos.length} pedidos`);
      return pedidos;
    } catch (error: any) {
      this.logger.error('❌ Error getting all pedidos:', error);
      throw error;
    }
  }

  /**
   * Obține o comandă specifică după pedido_uid
   */
  async getPedidoByUid(pedidoUid: string): Promise<any> {
    try {
      // Query direct în baza de date pentru a obține comanda după UID
      const query = `
        SELECT 
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
          estado,
          creado_en,
          COUNT(*) as num_items,
          GROUP_CONCAT(
            CONCAT(
              numero_articulo, '|',
              descripcion, '|',
              cantidad, '|',
              precio_unitario, '|',
              subtotal_linea, '|',
              iva_linea, '|',
              total_linea, '|',
              COALESCE(producto_id, 'NULL')
            ) SEPARATOR ';;'
          ) as items
        FROM PedidosTodos
        WHERE pedido_uid = ${this.escapeSql(pedidoUid)}
        GROUP BY pedido_uid, empleado_id, empleado_nombre, empleado_email,
                 comunidad_id, comunidad_nombre, comunidad_direccion,
                 comunidad_codigo_postal, comunidad_localidad, comunidad_provincia,
                 comunidad_telefono, comunidad_email, comunidad_nif,
                 fecha, moneda, descuento_global, impuestos, subtotal,
                 iva_total, total, limite_excedido, exceso_limite, notas,
                 estado, fecha_envio, creado_en
        LIMIT 1
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      if (!rows || rows.length === 0) {
        throw new BadRequestException(`Pedido with UID ${pedidoUid} not found`);
      }

      const row = rows[0];

      // Procesează rezultatele pentru a formata items-urile
      const items = row.items
        ? row.items.split(';;').map((itemStr: string) => {
            const [numero_articulo, descripcion, cantidad, precio_unitario, subtotal_linea, iva_linea, total_linea, producto_id] =
              itemStr.split('|');
            return {
              numero_articulo,
              descripcion,
              cantidad: parseFloat(cantidad),
              precio_unitario: parseFloat(precio_unitario),
              subtotal_linea: parseFloat(subtotal_linea),
              iva_linea: parseFloat(iva_linea),
              total_linea: parseFloat(total_linea),
              producto_id: producto_id !== 'NULL' ? parseInt(producto_id) : null,
            };
          })
        : [];

      const pedido = {
        pedido_uid: row.pedido_uid,
        empleado: {
          id: row.empleado_id,
          nombre: row.empleado_nombre,
          email: row.empleado_email,
        },
        comunidad: {
          id: row.comunidad_id,
          nombre: row.comunidad_nombre,
          direccion: row.comunidad_direccion,
          codigo_postal: row.comunidad_codigo_postal,
          localidad: row.comunidad_localidad,
          provincia: row.comunidad_provincia,
          telefono: row.comunidad_telefono,
          email: row.comunidad_email,
          nif: row.comunidad_nif,
          limite_gasto: row.comunidad_limite_gasto ? parseFloat(row.comunidad_limite_gasto.toString()) : null,
        },
        fecha: row.fecha,
        moneda: row.moneda,
        descuento_global: row.descuento_global ? parseFloat(row.descuento_global.toString()) : 0,
        impuestos: row.impuestos ? parseFloat(row.impuestos.toString()) : 0,
        subtotal: row.subtotal ? parseFloat(row.subtotal.toString()) : 0,
        iva_total: row.iva_total ? parseFloat(row.iva_total.toString()) : 0,
        total: row.total ? parseFloat(row.total.toString()) : 0,
        limite_excedido: row.limite_excedido === 1 || row.limite_excedido === true,
        exceso_limite: row.exceso_limite ? parseFloat(row.exceso_limite.toString()) : 0,
        notas: row.notas,
        estado: row.estado || 'pendiente',
        fecha_envio: row.fecha_envio,
        creado_en: row.creado_en,
        num_items: parseInt(row.num_items.toString()),
        items,
      };

      return pedido;
    } catch (error: any) {
      this.logger.error(`❌ Error getting pedido ${pedidoUid}:`, error);
      throw error;
    }
  }

  /**
   * Actualizează statusul unei comenzi și opțional fecha_envio
   */
  async updatePedidoEstado(pedidoUid: string, estado: string, fecha_envio?: string): Promise<any> {
    try {
      // Validează statusul
      const estadosValidos = ['pendiente', 'aprobado', 'rechazado'];
      if (!estadosValidos.includes(estado)) {
        throw new BadRequestException(
          `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`,
        );
      }

      // Parsează fecha_envio dacă este furnizată
      let fechaEnvioSQL = '';
      if (fecha_envio) {
        try {
          const fechaDate = new Date(fecha_envio);
          if (!isNaN(fechaDate.getTime())) {
            const fechaFormatted = fechaDate
              .toISOString()
              .slice(0, 19)
              .replace('T', ' ');
            fechaEnvioSQL = `, fecha_envio = ${this.escapeSql(fechaFormatted)}`;
          }
        } catch {
          this.logger.warn(`⚠️ Error parsing fecha_envio: ${fecha_envio}, skipping`);
        }
      }

      // Actualizează statusul (și opțional fecha_envio) pentru toate items-urile comenzii
      const query = `
        UPDATE PedidosTodos
        SET estado = ${this.escapeSql(estado)}${fechaEnvioSQL}
        WHERE pedido_uid = ${this.escapeSql(pedidoUid)}
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Pedido ${pedidoUid} estado updated to: ${estado}`);

      // Returnează comanda actualizată
      return this.getPedidoByUid(pedidoUid);
    } catch (error: any) {
      this.logger.error(`❌ Error updating pedido ${pedidoUid} estado:`, error);
      throw error;
    }
  }

  /**
   * Actualizează items-urile unei comenzi existente
   * Șterge items-urile vechi și inserează cele noi (folosind tranzacție pentru siguranță)
   */
  async updatePedidoItems(
    pedidoUid: string,
    items: Array<{
      numero_articulo: string;
      descripcion: string;
      cantidad: number;
      precio_unitario: number;
      subtotal_linea: number;
      descuento_linea: number;
      iva_porcentaje: number;
      iva_linea: number;
      total_linea: number;
      producto_id?: number;
    }>,
    subtotal: number,
    iva_total: number,
    total: number,
  ): Promise<any> {
    try {
      // Obține comanda existentă pentru a păstra datele de angajat și comunitate
      const pedidoExistente = await this.getPedidoByUid(pedidoUid);
      
      if (!pedidoExistente) {
        throw new BadRequestException(`Pedido with UID ${pedidoUid} not found`);
      }

      // Folosește tranzacție pentru a asigura atomicitatea (dacă INSERT eșuează, DELETE este rollback-uit)
      await this.prisma.$transaction(async (tx) => {
        // Șterge toate items-urile existente pentru această comandă
        const deleteQuery = `DELETE FROM PedidosTodos WHERE pedido_uid = ${this.escapeSql(pedidoUid)}`;
        await tx.$executeRawUnsafe(deleteQuery);

        // Inserează items-urile noi
        const estadoPedido = pedidoExistente.estado || 'pendiente';

        // Parsează fecha
        let fechaSQL = 'NULL';
        if (pedidoExistente.fecha) {
          try {
            const fechaDate = new Date(pedidoExistente.fecha);
            if (!isNaN(fechaDate.getTime())) {
              const fechaFormatted = fechaDate
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ');
              fechaSQL = this.escapeSql(fechaFormatted);
            }
          } catch {
            this.logger.warn(`⚠️ Error parsing fecha: ${pedidoExistente.fecha}, using NULL`);
          }
        }

        // Parsează comunidad_id
        const comunidadId =
          typeof pedidoExistente.comunidad?.id === 'number'
            ? pedidoExistente.comunidad.id
            : pedidoExistente.comunidad?.id !== 'N/A' && pedidoExistente.comunidad?.id
              ? parseInt(String(pedidoExistente.comunidad.id), 10)
              : null;

        for (const item of items) {
          // Validează și normalizează toate valorile pentru a evita `undefined` în SQL
          const productoId = item.producto_id !== undefined && item.producto_id !== null ? item.producto_id : 'NULL';
          const numeroArticulo = item.numero_articulo || 'N/A';
          const descripcion = item.descripcion || 'N/A';
          const cantidad = item.cantidad !== undefined && item.cantidad !== null ? Number(item.cantidad) : 0;
          const precioUnitario = item.precio_unitario !== undefined && item.precio_unitario !== null ? Number(item.precio_unitario) : 0;
          const subtotalLinea = item.subtotal_linea !== undefined && item.subtotal_linea !== null ? Number(item.subtotal_linea) : 0;
          const descuentoLinea = item.descuento_linea !== undefined && item.descuento_linea !== null ? Number(item.descuento_linea) : 0;
          const ivaPorcentaje = item.iva_porcentaje !== undefined && item.iva_porcentaje !== null ? Number(item.iva_porcentaje) : 21;
          const ivaLinea = item.iva_linea !== undefined && item.iva_linea !== null ? Number(item.iva_linea) : 0;
          const totalLinea = item.total_linea !== undefined && item.total_linea !== null ? Number(item.total_linea) : 0;

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
              total_linea,
              estado,
              fecha_envio
            ) VALUES (
              ${this.escapeSql(pedidoUid)},
              ${this.escapeSql(pedidoExistente.empleado?.id || '')},
              ${this.escapeSql(pedidoExistente.empleado?.nombre || '')},
              ${this.escapeSql(pedidoExistente.empleado?.email || '')},
              ${comunidadId !== null ? comunidadId : 'NULL'},
              ${this.escapeSql(pedidoExistente.comunidad?.nombre || '')},
              ${this.escapeSql(pedidoExistente.comunidad?.direccion || '')},
              ${this.escapeSql(pedidoExistente.comunidad?.codigo_postal || '')},
              ${this.escapeSql(pedidoExistente.comunidad?.localidad || '')},
              ${this.escapeSql(pedidoExistente.comunidad?.provincia || '')},
              ${this.escapeSql(pedidoExistente.comunidad?.telefono || '')},
              ${this.escapeSql(pedidoExistente.comunidad?.email || '')},
              ${this.escapeSql(pedidoExistente.comunidad?.nif || '')},
              ${pedidoExistente.comunidad?.limite_gasto !== undefined ? pedidoExistente.comunidad.limite_gasto : 'NULL'},
              ${fechaSQL},
              ${this.escapeSql(pedidoExistente.moneda || 'EUR')},
              ${pedidoExistente.descuento_global || 0},
              ${iva_total},
              ${subtotal},
              ${iva_total},
              ${total},
              ${pedidoExistente.limite_excedido ? 1 : 0},
              ${pedidoExistente.exceso_limite || 0},
              ${this.escapeSql(pedidoExistente.notas || '')},
              ${productoId},
              ${this.escapeSql(numeroArticulo)},
              ${this.escapeSql(descripcion)},
              ${cantidad},
              ${precioUnitario},
              ${subtotalLinea},
              ${descuentoLinea},
              ${ivaPorcentaje},
              ${ivaLinea},
              ${totalLinea},
              ${this.escapeSql(estadoPedido)},
              ${pedidoExistente.fecha_envio ? this.escapeSql(new Date(pedidoExistente.fecha_envio).toISOString().slice(0, 19).replace('T', ' ')) : 'NULL'}
            )
          `;
          await tx.$executeRawUnsafe(insertQuery);
        }
      });

      this.logger.log(
        `✅ Pedido ${pedidoUid} items updated successfully with ${items.length} items`,
      );

      // Returnează comanda actualizată
      return this.getPedidoByUid(pedidoUid);
    } catch (error: any) {
      this.logger.error(`❌ Error updating pedido ${pedidoUid} items:`, error);
      throw error;
    }
  }

  /**
   * Generează Excel-ul pentru comenzile aprobate (fără să le marcheze ca enviado)
   */
  async generarExcelPedidos(pedidoUids: string[]): Promise<Buffer> {
    try {
      if (!pedidoUids || pedidoUids.length === 0) {
        throw new BadRequestException('No se proporcionaron pedidos para generar Excel');
      }

      this.logger.log(`📊 Generando Excel para ${pedidoUids.length} pedidos aprobados`);

      // Verifică că toate comenzile sunt aprobate
      const pedidosExistentes = await this.getAllPedidos('aprobado');
      const pedidosValidos = pedidosExistentes
        .filter(p => pedidoUids.includes(p.pedido_uid) && p.estado === 'aprobado');

      if (pedidosValidos.length === 0) {
        throw new BadRequestException('No se encontraron pedidos aprobados para generar Excel');
      }

      // Folosește aceeași logică de generare Excel ca în enviarPedidosAprobadosYGenerarExcel
      // dar fără să marcheze ca enviado
      return await this.generarExcelParaPedidos(pedidosValidos);
    } catch (error: any) {
      this.logger.error(`❌ Error generando Excel:`, error);
      throw error;
    }
  }

  /**
   * Funcție helper pentru generarea Excel-ului (folosită de ambele funcții)
   */
  private async generarExcelParaPedidos(pedidosValidos: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheetNamesUsed = new Map<string, number>(); // Track folosite pentru a evita duplicate

    // Încearcă să încarce logo-ul companiei
    let logoBuffer: Buffer | null = null;
    try {
      // Logo-ul este în frontend/public/logo.png (relativ la root-ul proiectului)
      const logoPath = path.join(__dirname, '../../..', 'frontend', 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const fileBuffer = fs.readFileSync(logoPath);
        // Convertește la Buffer Node.js pentru ExcelJS (folosind Uint8Array)
        logoBuffer = Buffer.from(fileBuffer) as any;
        this.logger.log('✅ Logo cargado para Excel');
      } else {
        this.logger.warn('⚠️ Logo no encontrado en:', logoPath);
      }
    } catch (error) {
      this.logger.warn('⚠️ Error cargando logo:', error);
    }

    // Pentru fiecare comandă, creează un sheet
    for (const pedido of pedidosValidos) {
      let baseSheetName = pedido.comunidad?.nombre || `Pedido ${pedido.pedido_uid}`;
      baseSheetName = baseSheetName.substring(0, 31).replace(/[\\/?*\[\]]/g, '_');
      
      // Verifică dacă numele există deja în workbook
      let finalSheetName = baseSheetName;
      if (workbook.worksheets.find(ws => ws.name === finalSheetName)) {
        // Dacă există deja, adaugă un sufix numeric
        let count = 1;
        do {
          const suffix = ` (${count})`;
          const maxLength = 31 - suffix.length;
          finalSheetName = baseSheetName.substring(0, maxLength) + suffix;
          count++;
          // Fallback: dacă încă nu e unic după 10 încercări, folosește pedido_uid
          if (count > 10) {
            const uidSuffix = ` ${pedido.pedido_uid.substring(0, 8)}`;
            const maxLengthUid = 31 - uidSuffix.length;
            finalSheetName = baseSheetName.substring(0, maxLengthUid) + uidSuffix;
            break;
          }
        } while (workbook.worksheets.find(ws => ws.name === finalSheetName));
      }
      
      const worksheet = workbook.addWorksheet(finalSheetName);

      // Setează lățimea coloanelor (doar A, B, D - eliminăm C și E-H)
      worksheet.columns = [
        { width: 15 }, // A: Nº de artículo
        { width: 50 }, // B: Descripción de artículo
        { width: 0, hidden: true },  // C: Eliminat (Formato) - ascuns complet
        { width: 15 }, // D: Unidades
      ];
      
      // Ascunde complet coloanele E-H și orice alte coloane după D
      for (let col = 5; col <= 26; col++) { // Ascunde până la coloana Z
        const column = worksheet.getColumn(col);
        column.hidden = true;
        column.width = 0;
      }

      // Adaugă logo-ul în partea de sus (Row 1, Col A-B) dacă există
      if (logoBuffer) {
        try {
          const imageId = workbook.addImage({
            buffer: logoBuffer as any, // Type assertion pentru compatibilitate ExcelJS
            extension: 'png',
          });
          
          // Poziționează logo-ul în coloana A, rândul 1, cu dimensiuni 80x80 pixels
          worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 }, // A1 (zero-based: col=0, row=0)
            ext: { width: 80, height: 80 },
          });
          
          // Ajustează înălțimea rândului 1 pentru a face loc logo-ului
          worksheet.getRow(1).height = 60;
        } catch (error) {
          this.logger.warn('⚠️ Error añadiendo logo al Excel:', error);
        }
      }

      // Row 3: INSPECTOR
      worksheet.getCell('A3').value = 'INSPECTOR';
      worksheet.getCell('B3').value = 'AURA';

      // Row 4: FECHA ENTREGA PEDIDO CLIENTE
      worksheet.getCell('A4').value = 'FECHA ENTREGA PEDIDO CLIENTE:';
      if (pedido.fecha_envio) {
        const fechaEnvio = new Date(pedido.fecha_envio);
        worksheet.getCell('B4').value = fechaEnvio;
        worksheet.getCell('B4').numFmt = 'yyyy-mm-dd';
      }

      // Row 5: OPERARIO
      worksheet.getCell('A5').value = 'OPERARIO:';
      const operarioText = pedido.empleado?.nombre || '';
      const operarioPhone = pedido.comunidad?.telefono || '';
      worksheet.getCell('B5').value = operarioText + (operarioPhone ? ` (${operarioPhone})` : '');

      // Row 6: Adresa completă a comunității (stradă, cod poștal, oraș, provincie)
      const direccionParts = [];
      
      // Adaugă strada dacă există
      if (pedido.comunidad?.direccion && pedido.comunidad.direccion.trim() !== '' && pedido.comunidad.direccion.trim() !== 'N/A') {
        direccionParts.push(pedido.comunidad.direccion.trim());
      }
      
      // Adaugă cod poștal și oraș împreună dacă există
      const codigoPostal = pedido.comunidad?.codigo_postal?.trim();
      const localidad = pedido.comunidad?.localidad?.trim();
      
      if (codigoPostal && codigoPostal !== '' && codigoPostal !== 'N/A') {
        if (localidad && localidad !== '' && localidad !== 'N/A') {
          direccionParts.push(`${codigoPostal} ${localidad}`);
        } else {
          direccionParts.push(codigoPostal);
        }
      } else if (localidad && localidad !== '' && localidad !== 'N/A') {
        direccionParts.push(localidad);
      }
      
      // Adaugă provincie dacă există
      if (pedido.comunidad?.provincia && pedido.comunidad.provincia.trim() !== '' && pedido.comunidad.provincia.trim() !== 'N/A') {
        direccionParts.push(pedido.comunidad.provincia.trim());
      }
      
      const direccionCompleta = direccionParts.join(', ');
      worksheet.getCell('B6').value = direccionCompleta || '';

      // Row 7: SERVICIO
      worksheet.getCell('A7').value = 'SERVICIO:';

      // Row 8: PEDIDO LIMPIEZA (opțional)
      if (pedido.comunidad?.nombre && pedido.comunidad.nombre.toUpperCase().includes('LIMPIEZA')) {
        worksheet.getCell('B8').value = 'PEDIDO LIMPIEZA';
      }

      // Row 11: Header pentru tabel (doar A, B, D - eliminăm C și E-H)
      // Folosim splice pentru a seta doar primele 4 valori (A, B, C, D), apoi ștergem restul
      worksheet.getRow(11).values = [
        'Nº de artículo',
        'Descripción de artículo',
        '', // C: Goală (va fi ascunsă)
        'Unidades',
      ];
      
      // Șterge complet valorile din coloanele E-H și orice alte coloane
      for (let col = 5; col <= 26; col++) {
        const cell = worksheet.getRow(11).getCell(col);
        cell.value = null;
        cell.style = {}; // Șterge stilurile
      }
      worksheet.getRow(11).font = { bold: true };
      worksheet.getRow(11).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Row 12: Subheader eliminat (nu mai este necesar)

      // Rânduri pentru items (doar A, B, D)
      let currentRow = 12; // Începe de la row 12 (fără subheader)
      if (pedido.items && pedido.items.length > 0) {
        for (const item of pedido.items) {
          const row = worksheet.getRow(currentRow);
          row.values = [
            item.numero_articulo || '',
            item.descripcion || '',
            '', // C: Goală (va fi ascunsă)
            item.cantidad || 0,
          ];
          
          // Șterge complet valorile din coloanele E-Z pentru fiecare rând
          for (let col = 5; col <= 26; col++) {
            const cell = row.getCell(col);
            cell.value = null;
            cell.style = {}; // Șterge stilurile
          }
          
          currentRow++;
        }
      }

      // Adaugă border-uri pentru tabel (doar coloanele A, B, D)
      for (let rowNum = 11; rowNum < currentRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        // Doar coloanele A (1), B (2), D (4)
        const columnsToBorder = [1, 2, 4];
        for (const colNum of columnsToBorder) {
          const cell = row.getCell(colNum);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }
    }

    // Generează buffer-ul Excel
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Trimite toate comenzile aprobate (marchează-le ca "enviado")
   * Această funcție poate fi extinsă pentru a face alte acțiuni (email, export, etc.)
   */
  async enviarPedidosAprobados(pedidoUids: string[], mensaje?: string, enviarProveedor?: boolean): Promise<any> {
    try {
      if (!pedidoUids || pedidoUids.length === 0) {
        throw new BadRequestException('No se proporcionaron pedidos para enviar');
      }

      this.logger.log(`📤 Enviando ${pedidoUids.length} pedidos aprobados`);

      // Verifică că toate comenzile sunt aprobate (nu deja enviado)
      const pedidosExistentes = await this.getAllPedidos('aprobado');
      const pedidosValidos = pedidosExistentes
        .filter(p => pedidoUids.includes(p.pedido_uid) && p.estado === 'aprobado')
        .map(p => p.pedido_uid);

      if (pedidosValidos.length === 0) {
        // Verifică dacă există comenzile dar sunt deja enviado
        const todosPedidos = await this.getAllPedidos();
        const pedidosYaEnviados = todosPedidos
          .filter(p => pedidoUids.includes(p.pedido_uid) && p.estado === 'enviado')
          .map(p => p.pedido_uid);
        
        if (pedidosYaEnviados.length > 0) {
          throw new BadRequestException(
            `Los siguientes pedidos ya fueron enviados: ${pedidosYaEnviados.join(', ')}`
          );
        }
        
        throw new BadRequestException('No se encontraron pedidos aprobados para enviar');
      }

      // Actualizează statusul tuturor comenzilor la "enviado"
      const pedidoUidsEscaped = pedidosValidos.map(uid => this.escapeSql(uid)).join(', ');
      
      const query = `
        UPDATE PedidosTodos
        SET estado = 'enviado'
        WHERE pedido_uid IN (${pedidoUidsEscaped})
        AND estado = 'aprobado'
      `;

      const result = await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ ${pedidosValidos.length} pedidos marcados como enviados`);

      // TODO: Aici poți adăuga logica pentru trimiterea mesajului la provider
      if (enviarProveedor && mensaje) {
        this.logger.log(`📧 Mensaje para proveedor: ${mensaje}`);
        // Poți adăuga aici integrarea cu serviciul de email sau API-ul provider-ului
      }

      // Returnează rezultatul
      return {
        success: true,
        enviados: pedidosValidos.length,
        message: `${pedidosValidos.length} pedido(s) han sido enviados correctamente${mensaje ? ' con mensaje al proveedor' : ''}.`,
        mensajeEnviado: mensaje || null,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error enviando pedidos aprobados:`, error);
      throw error;
    }
  }

}
