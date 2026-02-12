import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { TelegramService } from './telegram.service';
import { SentEmailsService } from './sent-emails.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly telegramService: TelegramService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly configService: ConfigService,
  ) {}

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
      direccion_envio?: string;
      codigo_postal_envio?: string;
      localidad_envio?: string;
      provincia_envio?: string;
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
            estado,
            direccion_envio,
            codigo_postal_envio,
            localidad_envio,
            provincia_envio
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
            ${this.escapeSql(estadoPedido)},
            ${this.escapeSql((pedidoData.pedido as any).direccion_envio || '')},
            ${this.escapeSql((pedidoData.pedido as any).codigo_postal_envio || '')},
            ${this.escapeSql((pedidoData.pedido as any).localidad_envio || '')},
            ${this.escapeSql((pedidoData.pedido as any).provincia_envio || '')}
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
          MAX(direccion_envio) as direccion_envio,
          MAX(codigo_postal_envio) as codigo_postal_envio,
          MAX(localidad_envio) as localidad_envio,
          MAX(provincia_envio) as provincia_envio,
          MAX(aprobado_por) as aprobado_por,
          MAX(aprobado_en) as aprobado_en,
          MAX(rechazado_por) as rechazado_por,
          MAX(rechazado_en) as rechazado_en,
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

      this.logger.log(
        `📊 Executing query for getAllPedidos${estado ? ` with estado: ${estado}` : ''}`,
      );

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(`📊 Query returned ${rows.length} rows`);

      if (rows.length === 0) {
        this.logger.warn(
          `⚠️ No pedidos found${estado ? ` with estado: ${estado}` : ''}`,
        );
        return [];
      }

      // Procesează rezultatele pentru a formata items-urile
      const pedidos = rows.map((row) => {
        const items = row.items
          ? row.items.split(';;').map((itemStr: string) => {
              const [
                numero_articulo,
                descripcion,
                cantidad,
                precio_unitario,
                subtotal_linea,
                iva_linea,
                total_linea,
              ] = itemStr.split('|');
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
          descuento_global: row.descuento_global
            ? parseFloat(row.descuento_global.toString())
            : 0,
          impuestos: row.impuestos ? parseFloat(row.impuestos.toString()) : 0,
          subtotal: row.subtotal ? parseFloat(row.subtotal.toString()) : 0,
          iva_total: row.iva_total ? parseFloat(row.iva_total.toString()) : 0,
          total: row.total ? parseFloat(row.total.toString()) : 0,
          limite_excedido:
            row.limite_excedido === 1 || row.limite_excedido === true,
          exceso_limite: row.exceso_limite
            ? parseFloat(row.exceso_limite.toString())
            : 0,
          notas: row.notas,
          estado: row.estado || 'pendiente',
          fecha_envio: row.fecha_envio,
          direccion_envio: row.direccion_envio || null,
          codigo_postal_envio: row.codigo_postal_envio || null,
          localidad_envio: row.localidad_envio || null,
          provincia_envio: row.provincia_envio || null,
          aprobado_por: row.aprobado_por || null,
          aprobado_en: row.aprobado_en || null,
          rechazado_por: row.rechazado_por || null,
          rechazado_en: row.rechazado_en || null,
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
          MAX(notas) as notas,
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
                 iva_total, total, limite_excedido, exceso_limite,
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
            const [
              numero_articulo,
              descripcion,
              cantidad,
              precio_unitario,
              subtotal_linea,
              iva_linea,
              total_linea,
              producto_id,
            ] = itemStr.split('|');
            return {
              numero_articulo,
              descripcion,
              cantidad: parseFloat(cantidad),
              precio_unitario: parseFloat(precio_unitario),
              subtotal_linea: parseFloat(subtotal_linea),
              iva_linea: parseFloat(iva_linea),
              total_linea: parseFloat(total_linea),
              producto_id:
                producto_id !== 'NULL' ? parseInt(producto_id) : null,
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
          limite_gasto: row.comunidad_limite_gasto
            ? parseFloat(row.comunidad_limite_gasto.toString())
            : null,
        },
        fecha: row.fecha,
        moneda: row.moneda,
        descuento_global: row.descuento_global
          ? parseFloat(row.descuento_global.toString())
          : 0,
        impuestos: row.impuestos ? parseFloat(row.impuestos.toString()) : 0,
        subtotal: row.subtotal ? parseFloat(row.subtotal.toString()) : 0,
        iva_total: row.iva_total ? parseFloat(row.iva_total.toString()) : 0,
        total: row.total ? parseFloat(row.total.toString()) : 0,
        limite_excedido:
          row.limite_excedido === 1 || row.limite_excedido === true,
        exceso_limite: row.exceso_limite
          ? parseFloat(row.exceso_limite.toString())
          : 0,
        notas: row.notas,
        estado: row.estado || 'pendiente',
        fecha_envio: row.fecha_envio,
        direccion_envio: row.direccion_envio || null,
        codigo_postal_envio: row.codigo_postal_envio || null,
        localidad_envio: row.localidad_envio || null,
        provincia_envio: row.provincia_envio || null,
        aprobado_por: row.aprobado_por || null,
        aprobado_en: row.aprobado_en || null,
        rechazado_por: row.rechazado_por || null,
        rechazado_en: row.rechazado_en || null,
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
   * Actualizează adresa de expediere pentru o comandă
   */
  async updatePedidoDireccionEnvio(
    pedidoUid: string,
    direccion_envio?: string,
    codigo_postal_envio?: string,
    localidad_envio?: string,
    provincia_envio?: string,
  ): Promise<any> {
    try {
      const updates: string[] = [];

      if (direccion_envio !== undefined) {
        updates.push(`direccion_envio = ${this.escapeSql(direccion_envio)}`);
      }
      if (codigo_postal_envio !== undefined) {
        updates.push(
          `codigo_postal_envio = ${this.escapeSql(codigo_postal_envio)}`,
        );
      }
      if (localidad_envio !== undefined) {
        updates.push(`localidad_envio = ${this.escapeSql(localidad_envio)}`);
      }
      if (provincia_envio !== undefined) {
        updates.push(`provincia_envio = ${this.escapeSql(provincia_envio)}`);
      }

      if (updates.length === 0) {
        throw new BadRequestException(
          'Al menos un campo de dirección de envío debe ser proporcionado',
        );
      }

      const query = `
        UPDATE PedidosTodos
        SET ${updates.join(', ')}
        WHERE pedido_uid = ${this.escapeSql(pedidoUid)}
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Pedido ${pedidoUid} dirección de envío updated`);

      // Returnează comanda actualizată
      return this.getPedidoByUid(pedidoUid);
    } catch (error: any) {
      this.logger.error(
        `❌ Error updating pedido ${pedidoUid} dirección de envío:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Actualizează statusul unei comenzi și opțional fecha_envio
   */
  async updatePedidoEstado(
    pedidoUid: string,
    estado: string,
    fecha_envio?: string,
    userInfo?: string,
  ): Promise<any> {
    try {
      // Validează statusul
      const estadosValidos = [
        'pendiente',
        'aprobado',
        'rechazado',
        'entregado',
      ];
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
          this.logger.warn(
            `⚠️ Error parsing fecha_envio: ${fecha_envio}, skipping`,
          );
        }
      }

      // Adaugă tracking pentru aprobado/rechazado
      let trackingSQL = '';
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (estado === 'aprobado' && userInfo) {
        trackingSQL = `, aprobado_por = ${this.escapeSql(userInfo)}, aprobado_en = ${this.escapeSql(now)}, rechazado_por = NULL, rechazado_en = NULL`;
      } else if (estado === 'rechazado' && userInfo) {
        trackingSQL = `, rechazado_por = ${this.escapeSql(userInfo)}, rechazado_en = ${this.escapeSql(now)}, aprobado_por = NULL, aprobado_en = NULL`;
      } else if (estado === 'pendiente') {
        // Când se resetează la pendiente, ștergem tracking-ul
        trackingSQL = `, aprobado_por = NULL, aprobado_en = NULL, rechazado_por = NULL, rechazado_en = NULL`;
      }

      // Actualizează statusul (și opțional fecha_envio și tracking) pentru toate items-urile comenzii
      const query = `
        UPDATE PedidosTodos
        SET estado = ${this.escapeSql(estado)}${fechaEnvioSQL}${trackingSQL}
        WHERE pedido_uid = ${this.escapeSql(pedidoUid)}
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Pedido ${pedidoUid} estado updated to: ${estado}${userInfo ? ` by ${userInfo}` : ''}`,
      );

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
    notas?: string | null,
  ): Promise<any> {
    try {
      this.logger.log(
        `📝 [updatePedidoItems] Updating pedido ${pedidoUid} with notas: ${notas || '(null/empty)'}`,
      );

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
            this.logger.warn(
              `⚠️ Error parsing fecha: ${pedidoExistente.fecha}, using NULL`,
            );
          }
        }

        // Parsează comunidad_id
        const comunidadId =
          typeof pedidoExistente.comunidad?.id === 'number'
            ? pedidoExistente.comunidad.id
            : pedidoExistente.comunidad?.id !== 'N/A' &&
                pedidoExistente.comunidad?.id
              ? parseInt(String(pedidoExistente.comunidad.id), 10)
              : null;

        for (const item of items) {
          // Validează și normalizează toate valorile pentru a evita `undefined` în SQL
          const productoId =
            item.producto_id !== undefined && item.producto_id !== null
              ? item.producto_id
              : 'NULL';
          const numeroArticulo = item.numero_articulo || 'N/A';
          const descripcion = item.descripcion || 'N/A';
          const cantidad =
            item.cantidad !== undefined && item.cantidad !== null
              ? Number(item.cantidad)
              : 0;
          const precioUnitario =
            item.precio_unitario !== undefined && item.precio_unitario !== null
              ? Number(item.precio_unitario)
              : 0;
          const subtotalLinea =
            item.subtotal_linea !== undefined && item.subtotal_linea !== null
              ? Number(item.subtotal_linea)
              : 0;
          const descuentoLinea =
            item.descuento_linea !== undefined && item.descuento_linea !== null
              ? Number(item.descuento_linea)
              : 0;
          const ivaPorcentaje =
            item.iva_porcentaje !== undefined && item.iva_porcentaje !== null
              ? Number(item.iva_porcentaje)
              : 21;
          const ivaLinea =
            item.iva_linea !== undefined && item.iva_linea !== null
              ? Number(item.iva_linea)
              : 0;
          const totalLinea =
            item.total_linea !== undefined && item.total_linea !== null
              ? Number(item.total_linea)
              : 0;

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
              ${notas !== undefined ? (notas !== null && notas.trim() !== '' ? this.escapeSql(notas.trim()) : 'NULL') : pedidoExistente.notas && pedidoExistente.notas.trim() !== '' ? this.escapeSql(pedidoExistente.notas.trim()) : 'NULL'},
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
   * Actualizează doar nota pentru o comandă
   */
  async updatePedidoNotas(
    pedidoUid: string,
    notas?: string | null,
  ): Promise<any> {
    try {
      this.logger.log(
        `📝 [updatePedidoNotas] Updating notas for pedido ${pedidoUid}: ${notas || '(null/empty)'}`,
      );

      // Obține comanda existentă
      const pedidoExistente = await this.getPedidoByUid(pedidoUid);

      if (!pedidoExistente) {
        throw new BadRequestException(`Pedido with UID ${pedidoUid} not found`);
      }

      // Actualizează nota pentru toate rândurile din PedidosTodos pentru acest pedido_uid
      const notasValue =
        notas !== undefined && notas !== null && notas.trim() !== ''
          ? this.escapeSql(notas.trim())
          : 'NULL';

      const updateQuery = `
        UPDATE PedidosTodos 
        SET notas = ${notasValue}
        WHERE pedido_uid = ${this.escapeSql(pedidoUid)}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(`✅ Pedido ${pedidoUid} notas updated successfully`);

      // Returnează comanda actualizată
      return this.getPedidoByUid(pedidoUid);
    } catch (error: any) {
      this.logger.error(`❌ Error updating pedido ${pedidoUid} notas:`, error);
      throw error;
    }
  }

  /**
   * Generează Excel-ul pentru comenzile aprobate (fără să le marcheze ca enviado)
   */
  async generarExcelPedidos(pedidoUids: string[]): Promise<Buffer> {
    try {
      if (!pedidoUids || pedidoUids.length === 0) {
        throw new BadRequestException(
          'No se proporcionaron pedidos para generar Excel',
        );
      }

      this.logger.log(
        `📊 Generando Excel para ${pedidoUids.length} pedidos aprobados`,
      );

      // Verifică că toate comenzile sunt aprobate
      const pedidosExistentes = await this.getAllPedidos('aprobado');
      const pedidosValidos = pedidosExistentes.filter(
        (p) => pedidoUids.includes(p.pedido_uid) && p.estado === 'aprobado',
      );

      if (pedidosValidos.length === 0) {
        throw new BadRequestException(
          'No se encontraron pedidos aprobados para generar Excel',
        );
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
  private async generarExcelParaPedidos(
    pedidosValidos: any[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Încearcă să încarce logo-urile companiei
    let logoDecaminoBuffer: Buffer | null = null;
    let logoVymaBuffer: Buffer | null = null;

    try {
      // Logo "de camino" este în frontend/public/logo.png
      // __dirname în dist este: backend/dist/src/services/
      // Trebuie să urcăm 4 nivele pentru a ajunge la root: ../../../../frontend/public/logo.png
      const logoDecaminoPath = path.join(
        __dirname,
        '../../../../',
        'frontend',
        'public',
        'logo.png',
      );
      this.logger.log(
        `🔍 [Excel] Looking for logo de camino at: ${logoDecaminoPath}`,
      );
      if (fs.existsSync(logoDecaminoPath)) {
        const fileBuffer = fs.readFileSync(logoDecaminoPath);
        logoDecaminoBuffer = Buffer.from(fileBuffer) as any;
        this.logger.log('✅ Logo de camino cargado para Excel');
      } else {
        this.logger.warn(
          '⚠️ Logo de camino no encontrado en:',
          logoDecaminoPath,
        );
      }
    } catch (error) {
      this.logger.warn('⚠️ Error cargando logo de camino:', error);
    }

    try {
      // Logo VYMA este în frontend/public/logofurnizorvyma.jpg
      // __dirname în dist este: backend/dist/src/services/
      // Trebuie să urcăm 4 nivele pentru a ajunge la root: ../../../../frontend/public/logofurnizorvyma.jpg
      const logoVymaPath = path.join(
        __dirname,
        '../../../../',
        'frontend',
        'public',
        'logofurnizorvyma.jpg',
      );
      this.logger.log(`🔍 [Excel] Looking for logo VYMA at: ${logoVymaPath}`);
      if (fs.existsSync(logoVymaPath)) {
        const fileBuffer = fs.readFileSync(logoVymaPath);
        logoVymaBuffer = Buffer.from(fileBuffer) as any;
        this.logger.log('✅ Logo VYMA cargado para Excel');
      } else {
        this.logger.warn('⚠️ Logo VYMA no encontrado en:', logoVymaPath);
      }
    } catch (error) {
      this.logger.warn('⚠️ Error cargando logo VYMA:', error);
    }

    // Pentru fiecare comandă, creează un sheet
    for (const pedido of pedidosValidos) {
      let baseSheetName =
        pedido.comunidad?.nombre || `Pedido ${pedido.pedido_uid}`;
      baseSheetName = baseSheetName
        .substring(0, 31)
        .replace(/[\\/?*[\]]/g, '_');

      // Verifică dacă numele există deja în workbook
      let finalSheetName = baseSheetName;
      if (workbook.worksheets.find((ws) => ws.name === finalSheetName)) {
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
            finalSheetName =
              baseSheetName.substring(0, maxLengthUid) + uidSuffix;
            break;
          }
        } while (workbook.worksheets.find((ws) => ws.name === finalSheetName));
      }

      const worksheet = workbook.addWorksheet(finalSheetName);

      // Setează lățimea coloanelor inițial (va fi ajustată automat mai târziu)
      worksheet.columns = [
        { width: 15 }, // A: Nº de artículo
        { width: 50 }, // B: Descripción de artículo
        { width: 0, hidden: true }, // C: Eliminat (Formato) - ascuns complet
        { width: 15 }, // D: Unidades
      ];

      // Ascunde complet coloanele E-H și orice alte coloane după D
      for (let col = 5; col <= 26; col++) {
        // Ascunde până la coloana Z
        const column = worksheet.getColumn(col);
        column.hidden = true;
        column.width = 0;
      }

      // Adaugă logo-urile în partea de sus (Row 1)
      // Logo VYMA în stânga (A1-C1) - mai mare
      if (logoVymaBuffer) {
        try {
          const imageIdVyma = workbook.addImage({
            buffer: logoVymaBuffer as any,
            extension: 'jpeg',
          });

          // Poziționează logo-ul VYMA în coloana A, rândul 1 - dimensiuni mărite
          worksheet.addImage(imageIdVyma, {
            tl: { col: 0, row: 0 }, // A1 (zero-based: col=0, row=0)
            ext: { width: 180, height: 90 }, // Dimensiuni mărite pentru logo VYMA
          });

          this.logger.log('✅ Logo VYMA añadido al Excel');
        } catch (error) {
          this.logger.warn('⚠️ Error añadiendo logo VYMA al Excel:', error);
        }
      }

      // Logo "de camino" în B1 - mărit și echilibrat
      if (logoDecaminoBuffer) {
        try {
          const imageIdDecamino = workbook.addImage({
            buffer: logoDecaminoBuffer as any,
            extension: 'png',
          });

          // Obține lățimea coloanei B (default este 15, dar poate fi ajustată)
          const colBWidth = worksheet.getColumn(2).width || 15;
          // Convertește lățimea coloanei (în unități Excel) la pixeli aproximativ
          // 1 unitate Excel ≈ 7 pixeli pentru font 11pt
          const colBWidthPixels = colBWidth * 7;

          // Ajustare fină pentru echilibru perfect: lățime puțin mai mică, înălțime optimă
          const logoWidth = colBWidthPixels * 0.6; // Redus la 60% pentru aspect mai elegant
          const logoHeight = 105; // Ajustat la 105px pentru proporții perfect echilibrate

          // Poziționează logo-ul "de camino" în coloana B, rândul 1 - mărime mărită și echilibrată
          worksheet.addImage(imageIdDecamino, {
            tl: { col: 1, row: 0 }, // B1 (zero-based: col=1, row=0)
            ext: { width: logoWidth, height: logoHeight }, // Dimensiuni mărite și echilibrate
          });

          this.logger.log(
            `✅ Logo de camino añadido al Excel en B1, width: ${logoWidth}px, height: ${logoHeight}px`,
          );
        } catch (error) {
          this.logger.warn(
            '⚠️ Error añadiendo logo de camino al Excel:',
            error,
          );
        }
      }

      // Ajustează înălțimea rândului 1 pentru a face loc logo-urilor mai mari
      if (logoVymaBuffer || logoDecaminoBuffer) {
        worksheet.getRow(1).height = 90;
      }

      // Row 3: INSPECTOR
      worksheet.getCell('A3').value = 'INSPECTOR';
      // Folosește numele și codigo-ul celui care a aprobat pedido-ul, sau "AURA" ca fallback
      worksheet.getCell('B3').value = pedido.aprobado_por || 'AURA';

      // Row 4: FECHA ENTREGA PEDIDO CLIENTE
      worksheet.getCell('A4').value = 'FECHA ENTREGA PEDIDO CLIENTE:';
      if (pedido.fecha_envio) {
        // Afișează exact cum este salvată în baza de date (format DATETIME: YYYY-MM-DD HH:MM:SS)
        const fechaEnvio = new Date(pedido.fecha_envio);
        // Formatează ca string exact cum este în baza de date
        const year = fechaEnvio.getFullYear();
        const month = String(fechaEnvio.getMonth() + 1).padStart(2, '0');
        const day = String(fechaEnvio.getDate()).padStart(2, '0');
        const hours = String(fechaEnvio.getHours()).padStart(2, '0');
        const minutes = String(fechaEnvio.getMinutes()).padStart(2, '0');
        const seconds = String(fechaEnvio.getSeconds()).padStart(2, '0');
        const fechaFormateada = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        // Setează ca text (nu ca dată formatată)
        worksheet.getCell('B4').value = fechaFormateada;
      }

      // Row 5: OPERARIO
      worksheet.getCell('A5').value = 'OPERARIO:';
      const operarioText = pedido.empleado?.nombre || '';

      // Obține TELEFON ENTREGA din Clientes în loc de telefonul comunității
      let telefonEntrega = '';
      const comunidadId = pedido.comunidad?.id;

      this.logger.log(
        `🔍 [Excel] Fetching TELEFON ENTREGA for comunidad_id: ${comunidadId}, tipo: ${typeof comunidadId}`,
      );

      if (comunidadId) {
        try {
          const clienteId =
            typeof comunidadId === 'string'
              ? parseInt(comunidadId, 10)
              : comunidadId;

          if (!isNaN(clienteId)) {
            // Citește TELEFON ENTREGA direct din baza de date
            const rawQuery = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT \`TELEFON ENTREGA\` as telefon_entrega FROM Clientes WHERE id = ${clienteId} LIMIT 1`,
            );

            this.logger.log(
              `🔍 [Excel] Raw query executed for cliente_id: ${clienteId}, results: ${rawQuery?.length || 0}`,
            );

            if (rawQuery && rawQuery.length > 0) {
              const rawValue = rawQuery[0]?.telefon_entrega;
              this.logger.log(
                `🔍 [Excel] Raw query result: telefon_entrega = "${rawValue}" (type: ${typeof rawValue}, null: ${rawValue === null}, undefined: ${rawValue === undefined})`,
              );

              if (
                rawValue !== null &&
                rawValue !== undefined &&
                String(rawValue).trim() !== ''
              ) {
                telefonEntrega = String(rawValue).trim();
                this.logger.log(
                  `✅ [Excel] Using TELEFON ENTREGA from raw query: "${telefonEntrega}"`,
                );
              } else {
                this.logger.warn(
                  `⚠️ [Excel] Raw query returned null/empty, trying Prisma fallback`,
                );
              }
            }

            // Fallback la Prisma dacă raw query nu returnează valoare
            if (!telefonEntrega) {
              const cliente = await this.prisma.clientes.findUnique({
                where: { id: clienteId },
                select: { TELEFONO_ENTREGA: true },
              });
              const prismaValue = cliente?.TELEFONO_ENTREGA;
              this.logger.log(
                `🔍 [Excel] Prisma fallback result: TELEFONO_ENTREGA = "${prismaValue}" (type: ${typeof prismaValue}, null: ${prismaValue === null})`,
              );

              if (
                prismaValue !== null &&
                prismaValue !== undefined &&
                String(prismaValue).trim() !== ''
              ) {
                telefonEntrega = String(prismaValue).trim();
                this.logger.log(
                  `✅ [Excel] Using Prisma TELEFONO_ENTREGA: "${telefonEntrega}"`,
                );
              } else {
                this.logger.warn(
                  `⚠️ [Excel] Both raw query and Prisma returned null/empty for cliente_id: ${clienteId}`,
                );
              }
            }
          } else {
            this.logger.warn(
              `⚠️ [Excel] Invalid comunidad_id: ${comunidadId} (cannot convert to number)`,
            );
          }
        } catch (error) {
          this.logger.error(
            `❌ [Excel] Error fetching TELEFON ENTREGA for cliente ${comunidadId}:`,
            error,
          );
        }
      } else {
        this.logger.warn(
          `⚠️ [Excel] No comunidad.id found for pedido ${pedido.pedido_uid}`,
        );
      }

      // Folosește TELEFON ENTREGA dacă există, altfel NU folosim fallback la telefonul comunității
      // (utilizatorul vrea doar TELEFON ENTREGA, nu telefonul comunității)
      const operarioPhone = telefonEntrega || '';
      this.logger.log(
        `📞 [Excel] OPERARIO phone: "${operarioPhone}" (telefonEntrega: "${telefonEntrega}", comunidad.telefono: "${pedido.comunidad?.telefono}")`,
      );
      worksheet.getCell('B5').value =
        operarioText + (operarioPhone ? ` (${operarioPhone})` : '');

      // Row 6: DIRECCIÓN ENTREGA
      worksheet.getCell('A6').value = 'DIRECCIÓN ENTREGA:';

      // Adresa completă a comunității sau adresa de expediere (stradă, cod poștal, oraș, provincie)
      const direccionParts = [];

      // Verifică dacă există adresă de expediere, altfel folosește adresa comunității
      const usarDireccionEnvio =
        pedido.direccion_envio ||
        pedido.codigo_postal_envio ||
        pedido.localidad_envio ||
        pedido.provincia_envio;

      if (usarDireccionEnvio) {
        // Folosește adresa de expediere
        if (
          pedido.direccion_envio &&
          pedido.direccion_envio.trim() !== '' &&
          pedido.direccion_envio.trim() !== 'N/A'
        ) {
          direccionParts.push(pedido.direccion_envio.trim());
        }
        if (
          pedido.codigo_postal_envio &&
          pedido.codigo_postal_envio.trim() !== ''
        ) {
          direccionParts.push(pedido.codigo_postal_envio.trim());
        }
        if (pedido.localidad_envio && pedido.localidad_envio.trim() !== '') {
          direccionParts.push(pedido.localidad_envio.trim());
        }
        if (pedido.provincia_envio && pedido.provincia_envio.trim() !== '') {
          direccionParts.push(pedido.provincia_envio.trim());
        }
      } else {
        // Folosește adresa comunității
        if (
          pedido.comunidad?.direccion &&
          pedido.comunidad.direccion.trim() !== '' &&
          pedido.comunidad.direccion.trim() !== 'N/A'
        ) {
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
        if (
          pedido.comunidad?.provincia &&
          pedido.comunidad.provincia.trim() !== '' &&
          pedido.comunidad.provincia.trim() !== 'N/A'
        ) {
          direccionParts.push(pedido.comunidad.provincia.trim());
        }
      }

      const direccionCompleta = direccionParts.join(', ');
      worksheet.getCell('B6').value = direccionCompleta || '';

      // Row 7: SERVICIO
      worksheet.getCell('A7').value = 'SERVICIO:';

      // Obține serviciul din Clientes folosind comunidad_id (folosim variabila deja declarată mai sus)
      let servicioEntrega = '';

      this.logger.log(
        `🔍 [Excel] Fetching SERVICIO_ENTREGA for comunidad_id: ${comunidadId}, tipo: ${typeof comunidadId}`,
      );

      if (comunidadId) {
        try {
          // Asigură-te că id-ul este un number
          const clienteId =
            typeof comunidadId === 'string'
              ? parseInt(comunidadId, 10)
              : comunidadId;

          if (isNaN(clienteId)) {
            this.logger.warn(
              `⚠️ [Excel] Invalid comunidad_id: ${comunidadId} (cannot convert to number)`,
            );
          } else {
            // Citește direct din baza de date cu query raw pentru a verifica valoarea exactă
            const rawQuery = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT \`SERVICIO ENTREGA\` as servicio_entrega FROM Clientes WHERE id = ${clienteId} LIMIT 1`,
            );

            this.logger.log(
              `🔍 [Excel] Raw query executed for cliente_id: ${clienteId}, results: ${rawQuery?.length || 0}`,
            );

            if (rawQuery && rawQuery.length > 0) {
              const rawValue = rawQuery[0]?.servicio_entrega;
              this.logger.log(
                `🔍 [Excel] Raw query result: servicio_entrega = "${rawValue}" (type: ${typeof rawValue}, null: ${rawValue === null}, undefined: ${rawValue === undefined})`,
              );

              // Tratează corect null, undefined și string gol
              if (
                rawValue !== null &&
                rawValue !== undefined &&
                String(rawValue).trim() !== ''
              ) {
                servicioEntrega = String(rawValue).trim();
                this.logger.log(
                  `✅ [Excel] Using raw query value: "${servicioEntrega}"`,
                );
              } else {
                this.logger.warn(
                  `⚠️ [Excel] Raw query returned null/empty, trying Prisma fallback`,
                );
                const cliente = await this.prisma.clientes.findUnique({
                  where: { id: clienteId },
                  select: { SERVICIO_ENTREGA: true },
                });
                const prismaValue = cliente?.SERVICIO_ENTREGA;
                this.logger.log(
                  `🔍 [Excel] Prisma fallback result: SERVICIO_ENTREGA = "${prismaValue}" (type: ${typeof prismaValue}, null: ${prismaValue === null})`,
                );

                if (
                  prismaValue !== null &&
                  prismaValue !== undefined &&
                  String(prismaValue).trim() !== ''
                ) {
                  servicioEntrega = String(prismaValue).trim();
                  this.logger.log(
                    `✅ [Excel] Using Prisma value: "${servicioEntrega}"`,
                  );
                } else {
                  servicioEntrega = '';
                  this.logger.warn(
                    `⚠️ [Excel] Both raw query and Prisma returned null/empty for cliente_id: ${clienteId}`,
                  );
                }
              }
            } else {
              this.logger.warn(
                `⚠️ [Excel] Raw query returned no results for cliente_id: ${clienteId}`,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `❌ [Excel] Error fetching servicio_entrega for cliente ${comunidadId}:`,
            error,
          );
        }
      } else {
        this.logger.warn(
          `⚠️ [Excel] No comunidad.id found for pedido ${pedido.pedido_uid}`,
        );
      }

      // Folosește serviciul din Clientes, sau fallback la logica veche
      if (servicioEntrega && servicioEntrega.trim() !== '') {
        worksheet.getCell('B7').value = servicioEntrega.trim();
        this.logger.log(
          `✅ [Excel] SERVICIO set to: ${servicioEntrega.trim()}`,
        );
      } else if (
        pedido.comunidad?.nombre &&
        pedido.comunidad.nombre.toUpperCase().includes('LIMPIEZA')
      ) {
        worksheet.getCell('B7').value = 'PEDIDO LIMPIEZA';
        this.logger.log(
          `✅ [Excel] SERVICIO set to: PEDIDO LIMPIEZA (fallback LIMPIEZA)`,
        );
      } else {
        // Lasă gol dacă nu există valoare în baza de date
        worksheet.getCell('B7').value = '';
        this.logger.warn(
          `⚠️ [Excel] SERVICIO not set - no value in database for client ${comunidadId}`,
        );
      }

      // Row 8: NOTAS (doar dacă există)
      if (pedido.notas && pedido.notas.trim() !== '') {
        worksheet.getCell('A8').value = 'NOTAS:';
        worksheet.getCell('B8').value = pedido.notas.trim();
        this.logger.log(
          `✅ [Excel] NOTAS added: ${pedido.notas.trim().substring(0, 50)}...`,
        );
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

      // Ajustează automat lățimea coloanelor pe baza conținutului
      // Funcție helper pentru a calcula lățimea necesară pentru un text
      const calculateColumnWidth = (
        worksheet: ExcelJS.Worksheet,
        columnIndex: number,
        startRow: number = 1,
        endRow?: number,
      ): number => {
        let maxWidth = 10; // Lățime minimă
        const lastRow =
          endRow || worksheet.lastRow?.number || worksheet.rowCount || startRow;

        for (let rowNum = startRow; rowNum <= lastRow; rowNum++) {
          const cell = worksheet.getRow(rowNum).getCell(columnIndex);
          if (cell.value !== null && cell.value !== undefined) {
            const cellValue = String(cell.value);
            // Calculează lățimea aproximativă: ~1 caracter = 1 unitate, dar ajustăm pentru caractere mai largi
            const cellWidth = cellValue.length * 1.2 + 2; // 1.2 pentru caractere mai largi, +2 pentru padding
            if (cellWidth > maxWidth) {
              maxWidth = cellWidth;
            }
          }
        }

        // Limitează lățimea maximă pentru a evita coloane prea largi
        return Math.min(Math.max(maxWidth, 10), 100);
      };

      // Ajustează coloanele A, B, D (1, 2, 4)
      const colA = worksheet.getColumn(1);
      colA.width = calculateColumnWidth(worksheet, 1, 3); // Începe de la row 3 (INSPECTOR)

      const colB = worksheet.getColumn(2);
      colB.width = calculateColumnWidth(worksheet, 2, 3); // Începe de la row 3

      const colD = worksheet.getColumn(4);
      colD.width = calculateColumnWidth(worksheet, 4, 11); // Începe de la row 11 (header tabel)
    }

    // Generează buffer-ul Excel
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Trimite toate comenzile aprobate (marchează-le ca "enviado")
   * Această funcție poate fi extinsă pentru a face alte acțiuni (email, export, etc.)
   */
  async enviarPedidosAprobados(
    pedidoUids: string[],
    mensaje?: string,
    enviarProveedor?: boolean,
    senderId?: string,
  ): Promise<any> {
    try {
      if (!pedidoUids || pedidoUids.length === 0) {
        throw new BadRequestException(
          'No se proporcionaron pedidos para enviar',
        );
      }

      this.logger.log(`📤 Enviando ${pedidoUids.length} pedidos aprobados`);

      // Verifică că toate comenzile sunt aprobate (nu deja enviado)
      const pedidosExistentes = await this.getAllPedidos('aprobado');
      const pedidosValidos = pedidosExistentes
        .filter(
          (p) => pedidoUids.includes(p.pedido_uid) && p.estado === 'aprobado',
        )
        .map((p) => p.pedido_uid);

      if (pedidosValidos.length === 0) {
        // Verifică dacă există comenzile dar sunt deja enviado
        const todosPedidos = await this.getAllPedidos();
        const pedidosYaEnviados = todosPedidos
          .filter(
            (p) => pedidoUids.includes(p.pedido_uid) && p.estado === 'enviado',
          )
          .map((p) => p.pedido_uid);

        if (pedidosYaEnviados.length > 0) {
          throw new BadRequestException(
            `Los siguientes pedidos ya fueron enviados: ${pedidosYaEnviados.join(', ')}`,
          );
        }

        throw new BadRequestException(
          'No se encontraron pedidos aprobados para enviar',
        );
      }

      // IMPORTANT: Generează Excel-ul ÎNAINTE de a marca comenzile ca "enviado"
      // pentru că generarea Excel-ului caută comenzile cu status "aprobado"
      let excelBuffer: Buffer | null = null;
      if (enviarProveedor) {
        try {
          this.logger.log(
            `📊 Generando Excel para ${pedidosValidos.length} pedidos (antes de marcar como enviado)...`,
          );
          excelBuffer = await this.generarExcelPedidos(pedidosValidos);
          this.logger.log(`✅ Excel generado correctamente`);
        } catch (excelError: any) {
          this.logger.error(`❌ Error generando Excel:`, excelError);
          throw excelError; // Aruncă eroarea pentru a nu marca comenzile ca "enviado" dacă Excel-ul nu s-a generat
        }
      }

      // Actualizează statusul tuturor comenzilor la "enviado"
      const pedidoUidsEscaped = pedidosValidos
        .map((uid) => this.escapeSql(uid))
        .join(', ');

      const query = `
        UPDATE PedidosTodos
        SET estado = 'enviado'
        WHERE pedido_uid IN (${pedidoUidsEscaped})
        AND estado = 'aprobado'
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ ${pedidosValidos.length} pedidos marcados como enviados`,
      );

      // Trimite email la provider cu Excel-ul atașat
      if (enviarProveedor && excelBuffer) {
        try {
          // Pregătește mesajul HTML
          const fecha = new Date()
            .toISOString()
            .split('T')[0]
            .replace(/-/g, '.');
          const subject = `Pedidos Aprobados - ${fecha}`;

          // Determină salutul în funcție de oră (Buenos días până la 14:00, Buenas tardes după)
          const horaActual = new Date().getHours();
          const saludo = horaActual < 14 ? 'Buenos días' : 'Buenas tardes';

          let htmlContent = `
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p style="margin-bottom: 15px;">${saludo},</p>
                <h2 style="color: #d32f2f;">Pedidos aprobados</h2>
                <p>Se adjunta el archivo Excel con ${pedidosValidos.length} pedido(s) aprobados.</p>
          `;

          if (mensaje && mensaje.trim()) {
            htmlContent += `
                <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #d32f2f; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #d32f2f;">Mensaje:</h3>
                  <p style="white-space: pre-wrap;">${mensaje.trim()}</p>
                </div>
            `;
          }

          htmlContent += `
                <p style="margin-top: 20px;">Gracias por su atención.</p>
                <p style="margin-top: 10px; color: #666; font-size: 12px;">
                  Este es un correo electrónico automático generado por el sistema de De Camino Servicios Auxiliares.
                </p>
              </body>
            </html>
          `;

          // Trimite email cu Excel-ul atașat
          const providerEmail = 'pedidos@vyma.es';
          const excelFileName = `PEDIDOS ${fecha}.xlsx`;
          const ccEmails = ['sergio.jurado@vyma.es'];
          const bccEmails = ['info@decaminoservicios.com'];

          this.logger.log(
            `📧 Enviando email a ${providerEmail} con Excel adjunto (CC: ${ccEmails.join(', ')}, BCC: ${bccEmails.join(', ')})...`,
          );

          await this.emailService.sendEmailWithAttachment(
            providerEmail,
            subject,
            htmlContent,
            excelBuffer,
            excelFileName,
            {
              cc: ccEmails,
              bcc: bccEmails,
            },
          );

          this.logger.log(`✅ Email enviado correctamente a ${providerEmail}`);

          // Salvează email-ul în BD (istoric)
          try {
            if (senderId) {
              await this.sentEmailsService.saveSentEmail({
                senderId,
                recipientType: 'gestoria', // Provider este tratat ca gestoria
                recipientEmail: providerEmail,
                recipientName: 'Proveedor',
                subject,
                message: htmlContent,
                additionalMessage: mensaje || undefined,
                status: 'sent',
                attachments: [
                  {
                    filename: excelFileName,
                    fileContent: excelBuffer,
                    mimeType:
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    fileSize: excelBuffer.length,
                  },
                ],
              });
              this.logger.log(
                `✅ Email salvat în istoric (sent_emails) pentru ${providerEmail}`,
              );
            } else {
              this.logger.warn(
                `⚠️ No senderId provided - email not saved to history`,
              );
            }
          } catch (saveError: any) {
            // Nu oprește procesul dacă salvarea eșuează
            this.logger.warn(
              `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
            );
          }

          // Trimite notificare pe Telegram la gestoria
          try {
            if (this.telegramService.isConfigured()) {
              const telegramMessage = `📦 *Pedidos enviados a proveedor*\n\n✅ Se han enviado ${pedidosValidos.length} pedido(s) aprobado(s) al proveedor.\n\n📧 Email enviado a: ${providerEmail}\n📅 Fecha: ${fecha}`;
              await this.telegramService.sendMessage(telegramMessage);
              this.logger.log(`✅ Notificación enviada a Telegram (gestoria)`);
            } else {
              this.logger.warn(
                `⚠️ Telegram no configurado - no se envió notificación`,
              );
            }
          } catch (telegramError: any) {
            this.logger.error(
              `❌ Error enviando notificación a Telegram:`,
              telegramError,
            );
            // Nu aruncăm eroarea pentru a nu bloca flow-ul
          }
        } catch (emailError: any) {
          this.logger.error(`❌ Error enviando email a proveedor:`, emailError);
          // Nu aruncăm eroarea pentru a nu bloca marcarea comenzilor ca "enviado"
          // Dar o logăm pentru debugging
        }
      }

      // Returnează rezultatul
      return {
        success: true,
        enviados: pedidosValidos.length,
        message: `${pedidosValidos.length} pedido(s) han sido enviados correctamente${enviarProveedor ? ' y email enviado al proveedor' : ''}${mensaje ? ' con mensaje' : ''}.`,
        mensajeEnviado: mensaje || null,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error enviando pedidos aprobados:`, error);
      throw error;
    }
  }

  /**
   * Șterge un pedido complet (toate rândurile asociate cu pedido_uid)
   * @param pedidoUid - UID-ul pedido-ului de șters
   */
  async deletePedido(
    pedidoUid: string,
  ): Promise<{ success: true; message: string; deletedRows: number }> {
    try {
      if (
        !pedidoUid ||
        typeof pedidoUid !== 'string' ||
        pedidoUid.trim() === ''
      ) {
        throw new BadRequestException('pedido_uid es requerido');
      }

      const pedidoUidEscaped = this.escapeSql(pedidoUid.trim());

      // Verifică dacă pedido-ul există
      const existingPedidos = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*) as count
        FROM PedidosTodos
        WHERE pedido_uid = ${pedidoUidEscaped}
      `);

      const count = existingPedidos[0]?.count || 0;
      if (count === 0) {
        throw new NotFoundException(
          `Pedido con UID ${pedidoUid} no encontrado`,
        );
      }

      // Șterge toate rândurile asociate cu pedido_uid
      const deleteQuery = `DELETE FROM PedidosTodos WHERE pedido_uid = ${pedidoUidEscaped}`;
      const result = await this.prisma.$executeRawUnsafe(deleteQuery);
      const deletedRows = Number(result) || 0;

      this.logger.log(
        `🗑️ Pedido eliminado: ${pedidoUid} (${deletedRows} filas eliminadas)`,
      );

      return {
        success: true,
        message: `Pedido eliminado correctamente (${deletedRows} fila(s) eliminada(s))`,
        deletedRows,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error eliminando pedido ${pedidoUid}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar pedido: ${error.message}`,
      );
    }
  }

  /**
   * Upload albarán pentru o comandă și actualizează statusul la "entregado"
   */
  async uploadAlbaran(
    pedidoUid: string,
    file: Express.Multer.File,
    userInfo: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `📦 Uploading albarán for pedido ${pedidoUid} by ${userInfo}`,
      );

      // Verifică dacă comanda există
      const pedidoExists = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT pedido_uid FROM PedidosTodos WHERE pedido_uid = ${this.escapeSql(pedidoUid)} LIMIT 1`,
      );

      if (!pedidoExists || pedidoExists.length === 0) {
        throw new NotFoundException(`Pedido ${pedidoUid} no encontrado`);
      }

      // Convertește fișierul la Buffer
      const fileBuffer = file.buffer || Buffer.from(file.buffer);

      // Salvează albarán-ul în baza de date
      // Folosim un tabel nou PedidosAlbaranes (sau adăugăm câmpuri în PedidosTodos)
      // Pentru moment, salvăm direct în PedidosTodos folosind un câmp albaran_bytes
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Verifică dacă există deja un albarán pentru această comandă
      const existingAlbaran = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM PedidosAlbaranes WHERE pedido_uid = ${this.escapeSql(pedidoUid)} LIMIT 1`,
      );

      if (existingAlbaran && existingAlbaran.length > 0) {
        // Actualizează albarán-ul existent
        await this.prisma.$executeRawUnsafe(
          `UPDATE PedidosAlbaranes SET 
            archivo = 0x${fileBuffer.toString('hex')},
            nombre_archivo = ${this.escapeSql(file.originalname || 'albaran.pdf')},
            tipo_mime = ${this.escapeSql(file.mimetype || 'application/pdf')},
            tamano_bytes = ${fileBuffer.length},
            subido_por = ${this.escapeSql(userInfo)},
            subido_en = ${this.escapeSql(now)},
            actualizado_en = ${this.escapeSql(now)}
          WHERE pedido_uid = ${this.escapeSql(pedidoUid)}`,
        );
      } else {
        // Creează un albarán nou
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO PedidosAlbaranes (
            pedido_uid,
            archivo,
            nombre_archivo,
            tipo_mime,
            tamano_bytes,
            subido_por,
            subido_en,
            actualizado_en
          ) VALUES (
            ${this.escapeSql(pedidoUid)},
            0x${fileBuffer.toString('hex')},
            ${this.escapeSql(file.originalname || 'albaran.pdf')},
            ${this.escapeSql(file.mimetype || 'application/pdf')},
            ${fileBuffer.length},
            ${this.escapeSql(userInfo)},
            ${this.escapeSql(now)},
            ${this.escapeSql(now)}
          )`,
        );
      }

      // Actualizează statusul comenzii la "entregado"
      await this.updatePedidoEstado(
        pedidoUid,
        'entregado',
        undefined,
        userInfo,
      );

      this.logger.log(
        `✅ Albarán uploaded successfully for pedido ${pedidoUid} and status updated to entregado`,
      );

      return {
        success: true,
        message: 'Albarán subido correctamente y pedido marcado como entregado',
        pedido_uid: pedidoUid,
        estado: 'entregado',
        albaran: {
          nombre_archivo: file.originalname || 'albaran.pdf',
          tipo_mime: file.mimetype || 'application/pdf',
          tamano_bytes: fileBuffer.length,
          subido_por: userInfo,
          subido_en: now,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error uploading albarán for pedido ${pedidoUid}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(`Error al subir albarán: ${error.message}`);
    }
  }
}
