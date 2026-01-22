import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogoService {
  private readonly logger = new Logger(CatalogoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returnează toate produsele din catalog
   * Convertește fotoproducto (Bytes) în base64 pentru frontend
   */
  async getCatalogo(): Promise<any[]> {
    try {
      this.logger.log('📦 Fetching catalogo products...');

      // Folosim query SQL cu TO_BASE64 pentru a converti direct fotoproducto în base64
      const query = `
        SELECT 
          id AS producto_id,
          \`Número de artículo\` AS numero_articulo,
          \`Descripción de artículo\` AS descripcion,
          \`Precio por unidad\` AS precio,
          CASE 
            WHEN fotoproducto IS NOT NULL AND LENGTH(fotoproducto) > 0 
            THEN TO_BASE64(fotoproducto)
            ELSE NULL
          END AS imagen_base64
        FROM CatologoProductos
        ORDER BY id ASC
      `;

      const resultados = await this.prisma.$queryRawUnsafe<any[]>(query);
      this.logger.log(`✅ Found ${resultados.length} products in catalog`);

      // Debug: verifică dacă există imagini
      const productosConImagen = resultados.filter(
        (r: any) => r.imagen_base64,
      ).length;
      this.logger.log(
        `📸 Products with imagen_base64: ${productosConImagen}/${resultados.length}`,
      );

      // Transformă produsele pentru frontend
      const productosFormateados = resultados.map((row: any) => {
        // imagen_base64 este deja convertit în base64 de MySQL (TO_BASE64)
        const imagenBase64 = row.imagen_base64
          ? `data:image/jpeg;base64,${row.imagen_base64}`
          : null;

        return {
          id: row.producto_id,
          producto_id: row.producto_id, // Pentru compatibilitate
          numero: row.numero_articulo || '',
          numero_articulo: row.numero_articulo || '', // Pentru compatibilitate
          descripcion: row.descripcion || '',
          precio: Number(row.precio) || 0,
          imagen: imagenBase64,
          imagen_base64: row.imagen_base64 || null, // Pentru compatibilitate cu getCatalogoConPermisos
        };
      });

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

      // Query SQL pentru a obține DOAR produsele cu permisiuni setate (permitido = 1)
      // Folosim INNER JOIN pentru a include DOAR produsele care au permisiuni explicate pentru această comunitate
      // Folosim TO_BASE64() pentru a converti direct fotoproducto (Bytes) în base64 în MySQL
      const query = `
        SELECT 
          cp.id AS producto_id,
          cp.\`Número de artículo\` AS numero_articulo,
          cp.\`Descripción de artículo\` AS descripcion,
          cp.\`Precio por unidad\` AS precio,
          pp.permitido,
          pp.cliente_id AS permiso_cliente_id,
          pp.producto_id AS permiso_producto_id,
          CASE 
            WHEN cp.fotoproducto IS NOT NULL AND LENGTH(cp.fotoproducto) > 0 
            THEN TO_BASE64(cp.fotoproducto)
            ELSE NULL
          END AS imagen_base64
        FROM CatologoProductos cp
        INNER JOIN PermisosProductos pp ON cp.id = pp.producto_id AND pp.cliente_id = ${clienteId}
        WHERE pp.permitido = 1
        ORDER BY cp.id ASC
      `;

      const resultados = await this.prisma.$queryRawUnsafe<any[]>(query);
      this.logger.log(
        `✅ Found ${resultados.length} products with permisos for cliente ${clienteId}`,
      );

      // Debug: verifică dacă există imagini
      const productosConImagen = resultados.filter(
        (r: any) => r.imagen_base64,
      ).length;
      this.logger.log(
        `📸 Products with imagen_base64: ${productosConImagen}/${resultados.length}`,
      );

      // Transformă rezultatele pentru frontend
      const productosConPermisos = resultados.map((row: any) => {
        // imagen_base64 este deja convertit în base64 de MySQL (TO_BASE64)
        const imagenBase64 = row.imagen_base64 || null;

        if (imagenBase64) {
          this.logger.debug(
            `✅ Image found for product ${row.producto_id}, base64 length: ${imagenBase64.length}`,
          );
        }

        // ✅ Toate produsele din query au deja permitido = 1 (filtrate în WHERE)
        // Nu mai trebuie să verificăm, dar păstrăm logica pentru siguranță
        const permitidoRaw = row.permitido;
        const permitidoProcessed =
          permitidoRaw === 1 ||
          permitidoRaw === true ||
          permitidoRaw === '1' ||
          permitidoRaw === 1n; // BigInt support

        return {
          producto_id: row.producto_id,
          numero_articulo: row.numero_articulo || '',
          descripcion: row.descripcion || '',
          precio: Number(row.precio) || 0,
          permitido: permitidoProcessed, // Ar trebui să fie întotdeauna true
          imagen_base64: imagenBase64, // Frontend așteaptă imagen_base64 (fără prefix data:image)
        };
      });

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
      // În caz de eroare, presupunem că nu există permisiuni pentru siguranță
      return false;
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

      // Validează câmpurile obligatorii
      if (
        !productoData['Número de artículo'] ||
        !productoData['Descripción de artículo']
      ) {
        throw new Error(
          'Número de artículo și Descripción de artículo sunt obligatorii',
        );
      }

      // Parsează prețul
      const precio =
        typeof productoData['Precio por unidad'] === 'string'
          ? parseFloat(productoData['Precio por unidad'])
          : productoData['Precio por unidad'];

      if (isNaN(precio) || precio < 0) {
        throw new Error('Precio por unidad trebuie să fie un număr pozitiv');
      }

      // Escape SQL pentru stringuri
      const escapeSql = (value: any): string => {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'boolean') return value ? '1' : '0';
        if (typeof value === 'number') return String(value);
        const str = String(value);
        return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
      };

      // Construiește query-ul INSERT
      let query = `
        INSERT INTO CatologoProductos (
          \`Número de artículo\`,
          \`Descripción de artículo\`,
          \`Precio por unidad\`
      `;

      let values = `
        VALUES (
          ${escapeSql(productoData['Número de artículo'])},
          ${escapeSql(productoData['Descripción de artículo'])},
          ${precio}
      `;

      // Adaugă imaginea dacă există
      if (productoData.imagen_base64) {
        // Elimină prefixul data:image/jpeg;base64, dacă există
        const base64Data = productoData.imagen_base64.replace(
          /^data:image\/[^;]+;base64,/,
          '',
        );
        query += `, fotoproducto`;
        values += `, FROM_BASE64(${escapeSql(base64Data)})`;
      }

      query += `) ${values})`;

      // Execută query-ul
      await this.prisma.$executeRawUnsafe(query);

      // Obține ID-ul produsului creat (ultimul INSERT)
      const lastInsertQuery = `SELECT LAST_INSERT_ID() as id`;
      const result =
        await this.prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
          lastInsertQuery,
        );
      const newId = Number(result[0]?.id || 0);

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

      // Validează ID-ul
      if (!productoData.id || productoData.id <= 0) {
        throw new Error(
          'ID-ul produsului este obligatoriu și trebuie să fie pozitiv',
        );
      }

      // Validează câmpurile obligatorii
      if (
        !productoData['Número de artículo'] ||
        !productoData['Descripción de artículo']
      ) {
        throw new Error(
          'Número de artículo și Descripción de artículo sunt obligatorii',
        );
      }

      // Parsează prețul
      const precio =
        typeof productoData['Precio por unidad'] === 'string'
          ? parseFloat(productoData['Precio por unidad'])
          : productoData['Precio por unidad'];

      if (isNaN(precio) || precio < 0) {
        throw new Error('Precio por unidad trebuie să fie un număr pozitiv');
      }

      // Escape SQL pentru stringuri
      const escapeSql = (value: any): string => {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'boolean') return value ? '1' : '0';
        if (typeof value === 'number') return String(value);
        const str = String(value);
        return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
      };

      // Construiește query-ul UPDATE
      let query = `
        UPDATE CatologoProductos
        SET
          \`Número de artículo\` = ${escapeSql(productoData['Número de artículo'])},
          \`Descripción de artículo\` = ${escapeSql(productoData['Descripción de artículo'])},
          \`Precio por unidad\` = ${precio}
      `;

      // Gestionează imaginea
      if (productoData.eliminar_imagen) {
        // Șterge imaginea
        query += `, fotoproducto = NULL`;
      } else if (productoData.imagen_base64) {
        // Actualizează imaginea
        const base64Data = productoData.imagen_base64.replace(
          /^data:image\/[^;]+;base64,/,
          '',
        );
        query += `, fotoproducto = FROM_BASE64(${escapeSql(base64Data)})`;
      }

      query += ` WHERE id = ${productoData.id}`;

      // Execută query-ul
      await this.prisma.$executeRawUnsafe(query);

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

      // Validează ID-ul
      if (!productoId || productoId <= 0) {
        throw new Error(
          'ID-ul produsului este obligatoriu și trebuie să fie pozitiv',
        );
      }

      // Construiește query-ul DELETE
      const query = `DELETE FROM CatologoProductos WHERE id = ${productoId}`;

      // Execută query-ul
      await this.prisma.$executeRawUnsafe(query);

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

      // Validează comunidad_id
      if (!permisosData.comunidad_id || permisosData.comunidad_id <= 0) {
        throw new Error(
          'comunidad_id este obligatoriu și trebuie să fie pozitiv',
        );
      }

      if (!permisosData.permisos || permisosData.permisos.length === 0) {
        throw new Error('permisos trebuie să fie un array nevid');
      }

      // 1. Șterge permisiunile existente pentru această comunitate
      const deleteQuery = `DELETE FROM PermisosProductos WHERE cliente_id = ${permisosData.comunidad_id}`;
      await this.prisma.$executeRawUnsafe(deleteQuery);
      this.logger.log(
        `🗑️ Deleted existing permisos for comunidad ${permisosData.comunidad_id}`,
      );

      // 2. Inserează permisiunile noi (doar cele cu permitido = true)
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
