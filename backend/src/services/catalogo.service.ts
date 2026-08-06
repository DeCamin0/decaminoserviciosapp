import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoStorageService } from './catalogo-storage.service';

@Injectable()
export class CatalogoService {
  private readonly logger = new Logger(CatalogoService.name);
  private fotoproductoColumnExists: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogoStorage: CatalogoStorageService,
  ) {}

  private escapeSql(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    const str = String(value);
    return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }

  private async hasFotoproductoColumn(): Promise<boolean> {
    if (this.fotoproductoColumnExists !== null) {
      return this.fotoproductoColumnExists;
    }
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ c: bigint | number }>
      >(
        `SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'CatologoProductos'
           AND COLUMN_NAME = 'fotoproducto'`,
      );
      this.fotoproductoColumnExists = Number(rows[0]?.c || 0) > 0;
    } catch {
      this.fotoproductoColumnExists = false;
    }
    return this.fotoproductoColumnExists;
  }

  /**
   * Resolve imagen_base64 for API (frontend contract unchanged).
   * Dual-read: R2 storage_key preferred, else TO_BASE64(fotoproducto).
   */
  private async resolveImagenBase64(row: {
    storage_key?: string | null;
    imagen_base64?: string | null;
    fotoproducto?: unknown;
  }): Promise<string | null> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (key) {
      try {
        const buf = await this.catalogoStorage.resolveArchivo({
          storage_key: key,
        });
        return buf.toString('base64');
      } catch (err: any) {
        this.logger.warn(
          `⚠️ Failed to load catalogo image from R2 key=${key}: ${err?.message || err}`,
        );
        return null;
      }
    }

    if (row.imagen_base64) {
      return String(row.imagen_base64);
    }

    const blob = this.catalogoStorage.coerceFotoproductoBuffer(
      row.fotoproducto,
    );
    if (blob) return blob.toString('base64');

    return null;
  }

  /**
   * Returnează toate produsele din catalog
   * Convertește fotoproducto / R2 în base64 pentru frontend
   */
  async getCatalogo(): Promise<any[]> {
    try {
      this.logger.log('📦 Fetching catalogo products...');

      const hasBlob = await this.hasFotoproductoColumn();
      const blobSelect = hasBlob
        ? `CASE
            WHEN fotoproducto IS NOT NULL AND LENGTH(fotoproducto) > 0
            THEN TO_BASE64(fotoproducto)
            ELSE NULL
          END AS imagen_base64`
        : `NULL AS imagen_base64`;

      const query = `
        SELECT
          id AS producto_id,
          \`Número de artículo\` AS numero_articulo,
          \`Descripción de artículo\` AS descripcion,
          \`Precio por unidad\` AS precio,
          storage_key,
          ${blobSelect}
        FROM CatologoProductos
        ORDER BY id ASC
      `;

      const resultados = await this.prisma.$queryRawUnsafe<any[]>(query);
      this.logger.log(`✅ Found ${resultados.length} products in catalog`);

      const productosFormateados = await Promise.all(
        resultados.map(async (row: any) => {
          const imagenBase64Raw = await this.resolveImagenBase64(row);
          const imagenBase64 = imagenBase64Raw
            ? `data:image/jpeg;base64,${imagenBase64Raw}`
            : null;

          return {
            id: row.producto_id,
            producto_id: row.producto_id,
            numero: row.numero_articulo || '',
            numero_articulo: row.numero_articulo || '',
            descripcion: row.descripcion || '',
            precio: Number(row.precio) || 0,
            imagen: imagenBase64,
            imagen_base64: imagenBase64Raw || null,
          };
        }),
      );

      const productosConImagen = productosFormateados.filter(
        (r: any) => r.imagen_base64,
      ).length;
      this.logger.log(
        `📸 Products with imagen_base64: ${productosConImagen}/${productosFormateados.length}`,
      );

      return productosFormateados;
    } catch (error: any) {
      this.logger.error('❌ Error fetching catalogo:', error);
      throw error;
    }
  }

  /**
   * Returnează produsele din catalog cu permisiunile pentru o comunitate specifică
   * JOIN între PermisosProductos, CatologoProductos și Clientes
   *
   * @param clienteId - ID-ul comunității/clientului
   * @param clienteNombre - Numele comunității (opțional, pentru logging)
   * @returns Array de produse cu permisiunile lor pentru comunitate
   */
  async getCatalogoConPermisos(
    clienteId: number,
    clienteNombre?: string,
  ): Promise<any[]> {
    try {
      this.logger.log(
        `📦 Fetching catalogo with permisos for cliente_id=${clienteId}, nombre=${clienteNombre || 'N/A'}`,
      );

      const hasBlob = await this.hasFotoproductoColumn();
      const blobSelect = hasBlob
        ? `CASE
            WHEN cp.fotoproducto IS NOT NULL AND LENGTH(cp.fotoproducto) > 0
            THEN TO_BASE64(cp.fotoproducto)
            ELSE NULL
          END AS imagen_base64`
        : `NULL AS imagen_base64`;

      const query = `
        SELECT
          cp.id AS producto_id,
          cp.\`Número de artículo\` AS numero_articulo,
          cp.\`Descripción de artículo\` AS descripcion,
          cp.\`Precio por unidad\` AS precio,
          pp.permitido,
          pp.cliente_id AS permiso_cliente_id,
          pp.producto_id AS permiso_producto_id,
          cp.storage_key,
          ${blobSelect}
        FROM CatologoProductos cp
        INNER JOIN PermisosProductos pp ON cp.id = pp.producto_id AND pp.cliente_id = ${clienteId}
        WHERE pp.permitido = 1
        ORDER BY cp.id ASC
      `;

      const resultados = await this.prisma.$queryRawUnsafe<any[]>(query);
      this.logger.log(
        `✅ Found ${resultados.length} products with permisos for cliente ${clienteId}`,
      );

      const productosConPermisos = await Promise.all(
        resultados.map(async (row: any) => {
          const imagenBase64 = await this.resolveImagenBase64(row);

          if (imagenBase64) {
            this.logger.debug(
              `✅ Image found for product ${row.producto_id}, base64 length: ${imagenBase64.length}`,
            );
          }

          const permitidoRaw = row.permitido;
          const permitidoProcessed =
            permitidoRaw === 1 ||
            permitidoRaw === true ||
            permitidoRaw === '1' ||
            permitidoRaw === 1n;

          return {
            producto_id: row.producto_id,
            numero_articulo: row.numero_articulo || '',
            descripcion: row.descripcion || '',
            precio: Number(row.precio) || 0,
            permitido: permitidoProcessed,
            imagen_base64: imagenBase64,
          };
        }),
      );

      const productosConImagen = productosConPermisos.filter(
        (r: any) => r.imagen_base64,
      ).length;
      this.logger.log(
        `📸 Products with imagen_base64: ${productosConImagen}/${productosConPermisos.length}`,
      );

      return productosConPermisos;
    } catch (error: any) {
      this.logger.error('❌ Error fetching catalogo con permisos:', error);
      throw error;
    }
  }

  /**
   * Verifică dacă o comunitate are permisiuni generate
   * @param clienteId - ID-ul comunității/clientului
   * @returns true dacă există cel puțin un permiso pentru această comunitate
   */
  async tienePermisosGenerados(clienteId: number): Promise<boolean> {
    try {
      const count = await this.prisma.permisosProductos.count({
        where: {
          cliente_id: clienteId,
        },
      });
      return count > 0;
    } catch (error: any) {
      this.logger.error(
        `❌ Error checking permisos for cliente ${clienteId}:`,
        error,
      );
      return false;
    }
  }

  private async requireR2ForImageWrite(): Promise<void> {
    if (!this.catalogoStorage.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado; no se pueden subir imágenes de catálogo. Configura R2_ENABLED=true y credenciales.',
      );
    }
  }

  private async applyProductoImagen(
    productoId: number,
    imagenBase64: string,
    oldStorageKey?: string | null,
  ): Promise<void> {
    await this.requireR2ForImageWrite();
    const parsed = this.catalogoStorage.parseImagenBase64(imagenBase64);
    const put = await this.catalogoStorage.putProductoImagen(
      parsed.buffer,
      productoId,
      parsed.originalName,
      parsed.contentType,
    );

    const hasBlob = await this.hasFotoproductoColumn();
    const clearBlob = hasBlob ? ', fotoproducto = NULL' : '';

    await this.prisma.$executeRawUnsafe(`
      UPDATE CatologoProductos
      SET
        storage_key = ${this.escapeSql(put.storage_key)},
        storage_bucket = ${this.escapeSql(put.storage_bucket)},
        tamano_bytes = ${put.tamano_bytes}
        ${clearBlob}
      WHERE id = ${productoId}
    `);

    if (oldStorageKey && String(oldStorageKey).trim() !== put.storage_key) {
      await this.catalogoStorage.deleteObjectIfAny(oldStorageKey);
    }
  }

  /**
   * Adaugă un produs nou în catalog
   * @param productoData - Datele produsului: Número de artículo, Descripción de artículo, Precio por unidad, imagen_base64 (opțional)
   * @returns Produsul creat cu ID-ul generat
   */
  async addProducto(productoData: {
    'Número de artículo': string;
    'Descripción de artículo': string;
    'Precio por unidad': string | number;
    imagen_base64?: string;
  }): Promise<{ id: number; success: boolean }> {
    try {
      this.logger.log(
        `📦 Adding new product: ${productoData['Número de artículo']}`,
      );

      if (
        !productoData['Número de artículo'] ||
        !productoData['Descripción de artículo']
      ) {
        throw new BadRequestException(
          'Número de artículo și Descripción de artículo sunt obligatorii',
        );
      }

      const precio =
        typeof productoData['Precio por unidad'] === 'string'
          ? parseFloat(productoData['Precio por unidad'])
          : productoData['Precio por unidad'];

      if (isNaN(precio) || precio < 0) {
        throw new BadRequestException(
          'Precio por unidad trebuie să fie un număr pozitiv',
        );
      }

      if (productoData.imagen_base64) {
        await this.requireR2ForImageWrite();
      }

      const query = `
        INSERT INTO CatologoProductos (
          \`Número de artículo\`,
          \`Descripción de artículo\`,
          \`Precio por unidad\`
        ) VALUES (
          ${this.escapeSql(productoData['Número de artículo'])},
          ${this.escapeSql(productoData['Descripción de artículo'])},
          ${precio}
        )
      `;

      await this.prisma.$executeRawUnsafe(query);

      const lastInsertQuery = `SELECT LAST_INSERT_ID() as id`;
      const result =
        await this.prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
          lastInsertQuery,
        );
      const newId = Number(result[0]?.id || 0);

      if (productoData.imagen_base64 && newId > 0) {
        await this.applyProductoImagen(newId, productoData.imagen_base64);
      }

      this.logger.log(`✅ Product added successfully with ID: ${newId}`);

      return {
        id: newId,
        success: true,
      };
    } catch (error: any) {
      this.logger.error('❌ Error adding product:', error);
      throw error;
    }
  }

  /**
   * Editează un produs existent în catalog
   * @param productoData - Datele produsului: id, Número de artículo, Descripción de artículo, Precio por unidad, imagen_base64 (opțional), eliminar_imagen (opțional)
   * @returns Produsul actualizat cu ID-ul
   */
  async updateProducto(productoData: {
    id: number;
    'Número de artículo': string;
    'Descripción de artículo': string;
    'Precio por unidad': string | number;
    imagen_base64?: string;
    eliminar_imagen?: boolean;
  }): Promise<{ id: number; status: string; message: string }> {
    try {
      this.logger.log(`📦 Updating product ID: ${productoData.id}`);

      if (!productoData.id || productoData.id <= 0) {
        throw new BadRequestException(
          'ID-ul produsului este obligatoriu și trebuie să fie pozitiv',
        );
      }

      if (
        !productoData['Número de artículo'] ||
        !productoData['Descripción de artículo']
      ) {
        throw new BadRequestException(
          'Número de artículo și Descripción de artículo sunt obligatorii',
        );
      }

      const precio =
        typeof productoData['Precio por unidad'] === 'string'
          ? parseFloat(productoData['Precio por unidad'])
          : productoData['Precio por unidad'];

      if (isNaN(precio) || precio < 0) {
        throw new BadRequestException(
          'Precio por unidad trebuie să fie un număr pozitiv',
        );
      }

      const existing = await this.prisma.$queryRawUnsafe<
        Array<{ storage_key: string | null }>
      >(
        `SELECT storage_key FROM CatologoProductos WHERE id = ${productoData.id} LIMIT 1`,
      );
      const oldStorageKey = existing[0]?.storage_key || null;

      let query = `
        UPDATE CatologoProductos
        SET
          \`Número de artículo\` = ${this.escapeSql(productoData['Número de artículo'])},
          \`Descripción de artículo\` = ${this.escapeSql(productoData['Descripción de artículo'])},
          \`Precio por unidad\` = ${precio}
      `;

      if (productoData.eliminar_imagen) {
        const hasBlob = await this.hasFotoproductoColumn();
        query += `,
          storage_key = NULL,
          storage_bucket = NULL,
          tamano_bytes = NULL
          ${hasBlob ? ', fotoproducto = NULL' : ''}
        `;
        query += ` WHERE id = ${productoData.id}`;
        await this.prisma.$executeRawUnsafe(query);
        await this.catalogoStorage.deleteObjectIfAny(oldStorageKey);
      } else if (productoData.imagen_base64) {
        query += ` WHERE id = ${productoData.id}`;
        await this.prisma.$executeRawUnsafe(query);
        await this.applyProductoImagen(
          productoData.id,
          productoData.imagen_base64,
          oldStorageKey,
        );
      } else {
        query += ` WHERE id = ${productoData.id}`;
        await this.prisma.$executeRawUnsafe(query);
      }

      this.logger.log(`✅ Product ${productoData.id} updated successfully`);

      return {
        id: productoData.id,
        status: 'ok',
        message: 'Producto actualizado correctamente',
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating product:', error);
      throw error;
    }
  }

  /**
   * Șterge un produs din catalog
   * @param productoId - ID-ul produsului de șters
   * @returns Status-ul ștergerii
   */
  async deleteProducto(
    productoId: number,
  ): Promise<{ id: number; status: string; message: string }> {
    try {
      this.logger.log(`📦 Deleting product ID: ${productoId}`);

      if (!productoId || productoId <= 0) {
        throw new BadRequestException(
          'ID-ul produsului este obligatoriu și trebuie să fie pozitiv',
        );
      }

      const existing = await this.prisma.$queryRawUnsafe<
        Array<{ storage_key: string | null }>
      >(
        `SELECT storage_key FROM CatologoProductos WHERE id = ${productoId} LIMIT 1`,
      );
      const storageKey = existing[0]?.storage_key || null;

      const query = `DELETE FROM CatologoProductos WHERE id = ${productoId}`;
      await this.prisma.$executeRawUnsafe(query);

      await this.catalogoStorage.deleteObjectIfAny(storageKey);

      this.logger.log(`✅ Product ${productoId} deleted successfully`);

      return {
        id: productoId,
        status: 'ok',
        message: 'Producto eliminado correctamente',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Salvează permisiunile produselor pentru o comunitate
   * Șterge permisiunile existente și le înlocuiește cu cele noi
   * @param permisosData - Datele permisiunilor: comunidad_id, nombre_comunidad, permisos (array)
   * @returns Status-ul salvării
   */
  async savePermisos(permisosData: {
    comunidad_id: number;
    nombre_comunidad?: string;
    permisos: Array<{
      producto_id: number;
      numero_articulo?: string;
      permitido: boolean;
    }>;
  }): Promise<{
    status: string;
    message: string;
    comunidad_id: number;
    permisos_guardados: number;
  }> {
    try {
      this.logger.log(
        `📦 Saving permisos for comunidad_id: ${permisosData.comunidad_id}, ${permisosData.permisos.length} permisos`,
      );

      if (!permisosData.comunidad_id || permisosData.comunidad_id <= 0) {
        throw new BadRequestException(
          'comunidad_id este obligatoriu și trebuie să fie pozitiv',
        );
      }

      if (!permisosData.permisos || permisosData.permisos.length === 0) {
        throw new BadRequestException('permisos trebuie să fie un array nevid');
      }

      const deleteQuery = `DELETE FROM PermisosProductos WHERE cliente_id = ${permisosData.comunidad_id}`;
      await this.prisma.$executeRawUnsafe(deleteQuery);
      this.logger.log(
        `🗑️ Deleted existing permisos for comunidad ${permisosData.comunidad_id}`,
      );

      const permisosToInsert = permisosData.permisos.filter(
        (p) => p.permitido === true,
      );

      if (permisosToInsert.length > 0) {
        const insertValues = permisosToInsert
          .map(
            (p) => `(${permisosData.comunidad_id}, ${p.producto_id}, 1, NOW())`,
          )
          .join(', ');

        const insertQuery = `
          INSERT INTO PermisosProductos (cliente_id, producto_id, permitido, fecha_asignacion)
          VALUES ${insertValues}
        `;

        await this.prisma.$executeRawUnsafe(insertQuery);
        this.logger.log(
          `✅ Inserted ${permisosToInsert.length} permisos for comunidad ${permisosData.comunidad_id}`,
        );
      } else {
        this.logger.log(
          `ℹ️ No permisos to insert (all products are not permitted)`,
        );
      }

      return {
        status: 'ok',
        message: 'Permisos guardados correctamente',
        comunidad_id: permisosData.comunidad_id,
        permisos_guardados: permisosToInsert.length,
      };
    } catch (error: any) {
      this.logger.error('❌ Error saving permisos:', error);
      throw error;
    }
  }
}
