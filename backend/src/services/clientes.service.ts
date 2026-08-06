import * as crypto from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortalDocumentsStorageService } from '../portal/portal-documents-storage.service';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portalDocsStorage: PortalDocumentsStorageService,
  ) {}

  /**
   * Escapă string-uri pentru SQL (prevenire SQL injection)
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      // Escapăm ghilimele simple și backslash-uri
      const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
      return `'${escaped}'`;
    }
    return String(value);
  }

  /**
   * Adaugă un client nou
   */
  async addCliente(data: any): Promise<{ success: true; mensaje: string }> {
    // Normalizează NIF: trimite null dacă este gol sau undefined (pentru a permite mai multe NULL-uri cu constraint UNIQUE)
    const nifValue = data.NIF || data.nif;
    const nifNormalized =
      nifValue && String(nifValue).trim() !== ''
        ? String(nifValue).trim()
        : null;

    try {
      this.logger.log(
        `📝 Adding new cliente: ${data['NOMBRE O RAZON SOCIAL'] || data.NOMBRE_O_RAZON_SOCIAL || 'N/A'}`,
      );

      // Verificăm dacă există deja un client cu același NIF (doar dacă NIF nu este null)
      if (nifNormalized) {
        const existingCliente = await this.prisma.clientes.findUnique({
          where: { NIF: nifNormalized },
          select: { id: true, NOMBRE_O_RAZON_SOCIAL: true },
        });

        if (existingCliente) {
          throw new BadRequestException(
            `Ya existe un cliente con el NIF "${nifNormalized}" en la base de datos. ` +
              `Cliente existente: "${existingCliente.NOMBRE_O_RAZON_SOCIAL || 'N/A'}" (ID: ${existingCliente.id}). ` +
              `Por favor, usa la opción "Actualizar" en lugar de "Añadir".`,
          );
        }
      }

      // Normalizează datele (acceptă atât câmpuri cu spații cât și cu underscore)
      const clienteData: any = {
        NIF: nifNormalized,
        NOMBRE_O_RAZON_SOCIAL:
          data['NOMBRE O RAZON SOCIAL'] || data.NOMBRE_O_RAZON_SOCIAL || null,
        TIPO: data.TIPO || data.tipo || null,
        EMAIL: data.EMAIL || data.email || null,
        TELEFONO: data.TELEFONO || data.telefono || null,
        MOVIL: data.MOVIL || data.movil || null,
        FAX: data.FAX || data.fax || null,
        DIRECCION: data.DIRECCION || data.direccion || null,
        CODIGO_POSTAL:
          data['CODIGO POSTAL'] || data.CODIGO_POSTAL || data.cp || null,
        POBLACION: data.POBLACION || data.poblacion || data.ciudad || null,
        PROVINCIA: data.PROVINCIA || data.provincia || null,
        PAIS: data.PAIS || data.pais || 'España',
        URL: data.URL || data.url || null,
        DESCUENTO_POR_DEFECTO:
          data['DESCUENTO POR DEFECTO'] ||
          data.DESCUENTO_POR_DEFECTO ||
          data.descuento_por_defecto ||
          null,
        LATITUD: data.LATITUD || data.latitud || null,
        LONGITUD: data.LONGITUD || data.longitud || null,
        NOTAS_PRIVADAS:
          data['NOTAS PRIVADAS'] || data.NOTAS_PRIVADAS || data.notas || null,
        CUENTAS_BANCARIAS:
          data['CUENTAS BANCARIAS'] ||
          data.CUENTAS_BANCARIAS ||
          data.cuentas_bancarias ||
          null,
        Fecha_Ultima_Renovacion:
          data['Fecha Ultima Renovacion'] ||
          data.Fecha_Ultima_Renovacion ||
          data.fecha_ultima_renovacion ||
          null,
        Fecha_Proxima_Renovacion:
          data['Fecha Proxima Renovacion'] ||
          data.Fecha_Proxima_Renovacion ||
          data.fecha_proxima_renovacion ||
          null,
        ESTADO: data.ESTADO || data.estado || data.activo || 'Sí',
        CuantoPuedeGastar:
          data.CuantoPuedeGastar ||
          data.CuantoPuedeGastar ||
          data.limite_gasto ||
          null,
        SERVICIO_ENTREGA:
          data['SERVICIO ENTREGA'] ||
          data.SERVICIO_ENTREGA ||
          data.servicio_entrega ||
          null,
        TELEFONO_ENTREGA:
          data['TELEFON ENTREGA'] ||
          data.TELEFONO_ENTREGA ||
          data.telefon_entrega ||
          null,
      };

      // Folosim Prisma pentru INSERT
      await this.prisma.clientes.create({
        data: clienteData,
      });

      this.logger.log(
        `✅ Cliente added successfully: ${clienteData.NOMBRE_O_RAZON_SOCIAL || 'N/A'}`,
      );
      return {
        success: true,
        mensaje:
          '✅ Registro exitoso. Los datos del cliente se han añadido correctamente en la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error adding cliente:', error);
      if (error.code === 'P2002') {
        // Unique constraint violation
        if (error.meta?.target?.includes('NIF')) {
          throw new BadRequestException(
            `El NIF "${nifNormalized || '(vacío)'}" ya existe en la base de datos. Por favor, verifica el NIF o déjalo vacío.`,
          );
        }
        throw new BadRequestException(
          `Ya existe un cliente con estos datos únicos en la base de datos.`,
        );
      }
      throw new BadRequestException(
        `Error al añadir cliente: ${error.message}`,
      );
    }
  }

  /**
   * Caută client după nume (potrivire flexibilă)
   * Similar cu findEmpleadoFlexible din GestoriaService
   */
  async findClienteFlexible(nombreDetectado: string): Promise<{
    id: number;
    NOMBRE_O_RAZON_SOCIAL: string;
    confianza: number;
    matchType: string;
  } | null> {
    const nombreNormalized = nombreDetectado.trim().toUpperCase();
    this.logger.log(
      `🔍 [findClienteFlexible] Căutăm client: "${nombreDetectado}" -> normalizat: "${nombreNormalized}"`,
    );

    // 1. Potrivire exactă după nume complet
    let clienteQuery = `
      SELECT id, \`NOMBRE O RAZON SOCIAL\` AS NOMBRE_O_RAZON_SOCIAL
      FROM Clientes
      WHERE TRIM(UPPER(\`NOMBRE O RAZON SOCIAL\`)) = ${this.escapeSql(nombreNormalized)}
      LIMIT 1
    `;
    let cliente =
      await this.prisma.$queryRawUnsafe<
        Array<{ id: number; NOMBRE_O_RAZON_SOCIAL: string }>
      >(clienteQuery);

    if (cliente.length > 0) {
      this.logger.log(
        `✅ [findClienteFlexible] Cliente găsit (potrivire exactă): "${cliente[0].NOMBRE_O_RAZON_SOCIAL}" (ID: ${cliente[0].id})`,
      );
      return { ...cliente[0], confianza: 100, matchType: 'exacta' };
    }
    this.logger.log(
      `⚠️ [findClienteFlexible] Nu s-a găsit potrivire exactă pentru: "${nombreNormalized}"`,
    );

    // 2. Potrivire parțială (LIKE) - primele 10 caractere
    if (nombreNormalized.length >= 10) {
      const primerosCaracteres = nombreNormalized.substring(0, 10);
      clienteQuery = `
        SELECT id, \`NOMBRE O RAZON SOCIAL\` AS NOMBRE_O_RAZON_SOCIAL
        FROM Clientes
        WHERE TRIM(UPPER(\`NOMBRE O RAZON SOCIAL\`)) LIKE ${this.escapeSql(`${primerosCaracteres}%`)}
        LIMIT 5
      `;
      cliente =
        await this.prisma.$queryRawUnsafe<
          Array<{ id: number; NOMBRE_O_RAZON_SOCIAL: string }>
        >(clienteQuery);

      if (cliente.length > 0) {
        // Căutăm cea mai bună potrivire
        const mejorMatch = cliente.find((c) => {
          const nombreBd = c.NOMBRE_O_RAZON_SOCIAL?.trim().toUpperCase() || '';
          return (
            nombreBd.startsWith(nombreNormalized) ||
            nombreNormalized.startsWith(
              nombreBd.substring(0, nombreNormalized.length),
            )
          );
        });

        if (mejorMatch) {
          const nombreBd =
            mejorMatch.NOMBRE_O_RAZON_SOCIAL?.trim().toUpperCase() || '';
          const similarity = this.calculateSimilarity(
            nombreNormalized,
            nombreBd,
          );
          this.logger.debug(
            `✅ Cliente găsit (potrivire parțială): ${mejorMatch.NOMBRE_O_RAZON_SOCIAL} (${similarity}%)`,
          );
          return {
            ...mejorMatch,
            confianza: Math.round(similarity),
            matchType: 'parcial',
          };
        }

        // Dacă nu găsim o potrivire perfectă, luăm primul cu similaritate > 70%
        this.logger.log(
          `🔍 [findClienteFlexible] Verificăm ${cliente.length} clienți găsiți cu LIKE pentru similaritate...`,
        );
        for (const c of cliente) {
          const nombreBd = c.NOMBRE_O_RAZON_SOCIAL?.trim().toUpperCase() || '';
          const similarity = this.calculateSimilarity(
            nombreNormalized,
            nombreBd,
          );
          this.logger.log(
            `  - "${c.NOMBRE_O_RAZON_SOCIAL}" -> similaritate: ${similarity}%`,
          );
          if (similarity >= 70) {
            this.logger.log(
              `✅ [findClienteFlexible] Cliente găsit (similaritate ${similarity}%): "${c.NOMBRE_O_RAZON_SOCIAL}" (ID: ${c.id})`,
            );
            return {
              ...c,
              confianza: Math.round(similarity),
              matchType: 'similar',
            };
          }
        }
        this.logger.log(
          `⚠️ [findClienteFlexible] Niciun client cu similaritate >= 70% din ${cliente.length} găsiți`,
        );
      }
    }

    // 3. Potrivire cu LIKE %nombre%
    this.logger.log(
      `🔍 [findClienteFlexible] Încercăm potrivire cu LIKE %nombre% pentru: "${nombreNormalized}"`,
    );
    clienteQuery = `
      SELECT id, \`NOMBRE O RAZON SOCIAL\` AS NOMBRE_O_RAZON_SOCIAL
      FROM Clientes
      WHERE TRIM(UPPER(\`NOMBRE O RAZON SOCIAL\`)) LIKE ${this.escapeSql(`%${nombreNormalized}%`)}
      LIMIT 10
    `;
    cliente =
      await this.prisma.$queryRawUnsafe<
        Array<{ id: number; NOMBRE_O_RAZON_SOCIAL: string }>
      >(clienteQuery);

    if (cliente.length > 0) {
      this.logger.log(
        `🔍 [findClienteFlexible] Găsiți ${cliente.length} clienți cu LIKE %nombre%, verificăm similaritatea...`,
      );
      // Căutăm cea mai bună potrivire după similaritate
      let mejorMatch: { cliente: any; similarity: number } | null = null;

      for (const c of cliente) {
        const nombreBd = c.NOMBRE_O_RAZON_SOCIAL?.trim().toUpperCase() || '';
        const similarity = this.calculateSimilarity(nombreNormalized, nombreBd);
        this.logger.log(
          `  - "${c.NOMBRE_O_RAZON_SOCIAL}" -> similaritate: ${similarity}%`,
        );
        if (!mejorMatch || similarity > mejorMatch.similarity) {
          mejorMatch = { cliente: c, similarity };
        }
      }

      if (mejorMatch && mejorMatch.similarity >= 60) {
        this.logger.log(
          `✅ [findClienteFlexible] Cliente găsit (similaritate ${mejorMatch.similarity}%): "${mejorMatch.cliente.NOMBRE_O_RAZON_SOCIAL}" (ID: ${mejorMatch.cliente.id})`,
        );
        return {
          ...mejorMatch.cliente,
          confianza: Math.round(mejorMatch.similarity),
          matchType: 'similar',
        };
      }
      this.logger.log(
        `⚠️ [findClienteFlexible] Cea mai bună similaritate: ${mejorMatch?.similarity || 0}% (necesar >= 60%)`,
      );
    } else {
      this.logger.log(
        `⚠️ [findClienteFlexible] Nu s-au găsit clienți cu LIKE %nombre% pentru: "${nombreNormalized}"`,
      );
    }

    this.logger.warn(
      `❌ [findClienteFlexible] Cliente NU a fost găsit pentru: "${nombreDetectado}" (normalizat: "${nombreNormalized}")`,
    );
    return null;
  }

  /**
   * Calculează similaritatea între două string-uri (Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 100;

    // Simplificat: verificăm câte caractere comune sunt
    let commonChars = 0;
    const shorterSet = new Set(shorter.split(''));
    for (const char of longer.split('')) {
      if (shorterSet.has(char)) {
        commonChars++;
      }
    }

    // Calculăm procentul de caractere comune
    const similarity = (commonChars / longer.length) * 100;
    return Math.min(similarity, 100);
  }

  /**
   * Actualizează un client existent
   */
  async updateCliente(
    id: number,
    data: any,
  ): Promise<{ success: true; mensaje: string }> {
    try {
      this.logger.log(`📝 Updating cliente ID: ${id}`);

      // Verifică dacă clientul există
      const existing = await this.prisma.clientes.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new BadRequestException(`Cliente con ID ${id} no encontrado.`);
      }

      // Normalizează datele
      const updateData: any = {};

      if (data.NIF !== undefined || data.nif !== undefined)
        updateData.NIF = data.NIF || data.nif || null;
      if (
        data['NOMBRE O RAZON SOCIAL'] !== undefined ||
        data.NOMBRE_O_RAZON_SOCIAL !== undefined
      ) {
        updateData.NOMBRE_O_RAZON_SOCIAL =
          data['NOMBRE O RAZON SOCIAL'] || data.NOMBRE_O_RAZON_SOCIAL || null;
      }
      if (data.TIPO !== undefined || data.tipo !== undefined)
        updateData.TIPO = data.TIPO || data.tipo || null;
      if (data.EMAIL !== undefined || data.email !== undefined)
        updateData.EMAIL = data.EMAIL || data.email || null;
      if (data.TELEFONO !== undefined || data.telefono !== undefined)
        updateData.TELEFONO = data.TELEFONO || data.telefono || null;
      if (data.MOVIL !== undefined || data.movil !== undefined)
        updateData.MOVIL = data.MOVIL || data.movil || null;
      if (data.FAX !== undefined || data.fax !== undefined)
        updateData.FAX = data.FAX || data.fax || null;
      if (data.DIRECCION !== undefined || data.direccion !== undefined)
        updateData.DIRECCION = data.DIRECCION || data.direccion || null;
      if (
        data['CODIGO POSTAL'] !== undefined ||
        data.CODIGO_POSTAL !== undefined ||
        data.cp !== undefined
      ) {
        updateData.CODIGO_POSTAL =
          data['CODIGO POSTAL'] || data.CODIGO_POSTAL || data.cp || null;
      }
      if (
        data.POBLACION !== undefined ||
        data.poblacion !== undefined ||
        data.ciudad !== undefined
      ) {
        updateData.POBLACION =
          data.POBLACION || data.poblacion || data.ciudad || null;
      }
      if (data.PROVINCIA !== undefined || data.provincia !== undefined)
        updateData.PROVINCIA = data.PROVINCIA || data.provincia || null;
      if (data.PAIS !== undefined || data.pais !== undefined)
        updateData.PAIS = data.PAIS || data.pais || null;
      if (data.URL !== undefined || data.url !== undefined)
        updateData.URL = data.URL || data.url || null;
      if (
        data['DESCUENTO POR DEFECTO'] !== undefined ||
        data.DESCUENTO_POR_DEFECTO !== undefined ||
        data.descuento_por_defecto !== undefined
      ) {
        updateData.DESCUENTO_POR_DEFECTO =
          data['DESCUENTO POR DEFECTO'] ||
          data.DESCUENTO_POR_DEFECTO ||
          data.descuento_por_defecto ||
          null;
      }
      if (data.LATITUD !== undefined || data.latitud !== undefined)
        updateData.LATITUD = data.LATITUD || data.latitud || null;
      if (data.LONGITUD !== undefined || data.longitud !== undefined)
        updateData.LONGITUD = data.LONGITUD || data.longitud || null;
      if (
        data['NOTAS PRIVADAS'] !== undefined ||
        data.NOTAS_PRIVADAS !== undefined ||
        data.notas !== undefined
      ) {
        updateData.NOTAS_PRIVADAS =
          data['NOTAS PRIVADAS'] || data.NOTAS_PRIVADAS || data.notas || null;
      }
      if (
        data['CUENTAS BANCARIAS'] !== undefined ||
        data.CUENTAS_BANCARIAS !== undefined ||
        data.cuentas_bancarias !== undefined
      ) {
        updateData.CUENTAS_BANCARIAS =
          data['CUENTAS BANCARIAS'] ||
          data.CUENTAS_BANCARIAS ||
          data.cuentas_bancarias ||
          null;
      }
      if (
        data['Fecha Ultima Renovacion'] !== undefined ||
        data.Fecha_Ultima_Renovacion !== undefined ||
        data.fecha_ultima_renovacion !== undefined
      ) {
        updateData.Fecha_Ultima_Renovacion =
          data['Fecha Ultima Renovacion'] ||
          data.Fecha_Ultima_Renovacion ||
          data.fecha_ultima_renovacion ||
          null;
      }
      if (
        data['Fecha Proxima Renovacion'] !== undefined ||
        data.Fecha_Proxima_Renovacion !== undefined ||
        data.fecha_proxima_renovacion !== undefined
      ) {
        updateData.Fecha_Proxima_Renovacion =
          data['Fecha Proxima Renovacion'] ||
          data.Fecha_Proxima_Renovacion ||
          data.fecha_proxima_renovacion ||
          null;
      }
      if (
        data.ESTADO !== undefined ||
        data.estado !== undefined ||
        data.activo !== undefined
      ) {
        updateData.ESTADO = data.ESTADO || data.estado || data.activo || null;
      }
      // SERVICIO ENTREGA - verificăm dacă există în payload (chiar dacă e string gol)
      const servicioValue =
        data['SERVICIO ENTREGA'] !== undefined
          ? data['SERVICIO ENTREGA']
          : data.SERVICIO_ENTREGA !== undefined
            ? data.SERVICIO_ENTREGA
            : data.servicio_entrega !== undefined
              ? data.servicio_entrega
              : undefined;

      if (servicioValue !== undefined) {
        // Trimitem string gol ca null pentru a permite ștergerea valorii
        updateData.SERVICIO_ENTREGA =
          servicioValue && String(servicioValue).trim() !== ''
            ? String(servicioValue).trim()
            : null;
      }

      // TELEFON ENTREGA - verificăm dacă există în payload
      const telefonEntregaValue =
        data['TELEFON ENTREGA'] !== undefined
          ? data['TELEFON ENTREGA']
          : data.TELEFONO_ENTREGA !== undefined
            ? data.TELEFONO_ENTREGA
            : data.telefon_entrega !== undefined
              ? data.telefon_entrega
              : undefined;

      if (telefonEntregaValue !== undefined) {
        // Trimitem string gol ca null pentru a permite ștergerea valorii
        updateData.TELEFONO_ENTREGA =
          telefonEntregaValue && String(telefonEntregaValue).trim() !== ''
            ? String(telefonEntregaValue).trim()
            : null;
      }

      if (
        data.CuantoPuedeGastar !== undefined ||
        data.limite_gasto !== undefined
      ) {
        updateData.CuantoPuedeGastar =
          data.CuantoPuedeGastar || data.limite_gasto || null;
      }

      // Folosim Prisma pentru UPDATE
      await this.prisma.clientes.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`✅ Cliente updated successfully: ID ${id}`);
      return {
        success: true,
        mensaje:
          '✅ Edición exitosa. Los datos del cliente se han actualizado correctamente en la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating cliente:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar cliente: ${error.message}`,
      );
    }
  }

  /**
   * Șterge un client
   */
  async deleteCliente(id: number): Promise<{ success: true; mensaje: string }> {
    try {
      this.logger.log(`📝 Deleting cliente ID: ${id}`);

      // Verifică dacă clientul există
      const existing = await this.prisma.clientes.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new BadRequestException(`Cliente con ID ${id} no encontrado.`);
      }

      await this.prisma.clientes.delete({
        where: { id },
      });

      this.logger.log(`✅ Cliente deleted successfully: ID ${id}`);
      return {
        success: true,
        mensaje:
          '🗑️ Eliminación exitosa. El registro del cliente ha sido borrado correctamente de la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting cliente:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar cliente: ${error.message}`,
      );
    }
  }

  /**
   * Obține lista de furnizori (proveedores) din tabelul Proveedores
   */
  async getProveedores(): Promise<any[]> {
    try {
      this.logger.log('📥 Fetching proveedores');

      const proveedores = await this.prisma.proveedores.findMany({
        orderBy: {
          NOMBRE_O_RAZ_N_SOCIAL: 'asc',
        },
      });

      // Mapează câmpurile pentru compatibilitate cu frontend-ul
      const mapped = proveedores.map((p: any) => ({
        ...p,
        'NOMBRE O RAZÓN SOCIAL':
          p.NOMBRE_O_RAZ_N_SOCIAL || p['NOMBRE O RAZÓN SOCIAL'] || null,
        NOMBRE_O_RAZON_SOCIAL: p.NOMBRE_O_RAZ_N_SOCIAL || null,
        DIRECCIÓN: p.DIRECCI_N || p.DIRECCIÓN || null,
        CODIGO_POSTAL: p.CODIGO_POSTAL || null,
        POBLACIÓN: p.POBLACI_N || p.POBLACIÓN || null,
        PAÍS: p.PA_S || p.PAÍS || null,
        MÓVIL: p.M_VIL || p.MÓVIL || null,
        NOTAS_PRIVADAS: p.NOTAS_PRIVADAS || null,
      }));

      this.logger.log(`✅ Found ${mapped.length} proveedores`);
      return mapped;
    } catch (error: any) {
      this.logger.error('❌ Error fetching proveedores:', error);
      throw new BadRequestException(
        `Error al cargar proveedores: ${error.message}`,
      );
    }
  }

  /**
   * Adaugă un furnizor nou
   */
  async addProveedor(data: any): Promise<{ success: true; mensaje: string }> {
    try {
      this.logger.log(
        `📝 Adding new proveedor: ${data['NOMBRE O RAZÓN SOCIAL'] || data.NOMBRE_O_RAZ_N_SOCIAL || 'N/A'}`,
      );

      // Normalizează datele (acceptă atât câmpuri cu spații cât și cu underscore)
      const proveedorData: any = {
        NIF: data.NIF || data.nif || null,
        NOMBRE_O_RAZ_N_SOCIAL:
          data['NOMBRE O RAZÓN SOCIAL'] ||
          data['NOMBRE O RAZON SOCIAL'] ||
          data.NOMBRE_O_RAZ_N_SOCIAL ||
          null,
        EMAIL: data.EMAIL || data.email || null,
        TELEFONO: data.TELEFONO || data.telefono || null,
        M_VIL: data.MÓVIL || data.MOVIL || data.movil || null,
        FAX: data.FAX || data.fax || null,
        DIRECCI_N: data.DIRECCIÓN || data.DIRECCION || data.direccion || null,
        CODIGO_POSTAL:
          data['CODIGO POSTAL'] || data.CODIGO_POSTAL || data.cp || null,
        POBLACI_N:
          data.POBLACIÓN ||
          data.POBLACION ||
          data.poblacion ||
          data.ciudad ||
          null,
        PROVINCIA: data.PROVINCIA || data.provincia || null,
        PA_S: data.PAÍS || data.PAIS || data.pais || 'España',
        URL: data.URL || data.url || null,
        DESCUENTO_POR_DEFECTO:
          data['DESCUENTO POR DEFECTO'] ||
          data.DESCUENTO_POR_DEFECTO ||
          data.descuento_por_defecto ||
          null,
        LATITUD: data.LATITUD || data.latitud || null,
        LONGITUD: data.LONGITUD || data.longitud || null,
        NOTAS_PRIVADAS:
          data['NOTAS PRIVADAS'] || data.NOTAS_PRIVADAS || data.notas || null,
        CUENTAS_BANCARIAS:
          data['CUENTAS BANCARIAS'] ||
          data.CUENTAS_BANCARIAS ||
          data.cuentas_bancarias ||
          null,
        ESTADO: data.ESTADO || data.estado || data.activo || 'Sí',
        // fecha_creacion și fecha_actualizacion sunt setate automat de Prisma
      };

      // Folosim Prisma pentru INSERT
      await this.prisma.proveedores.create({
        data: proveedorData,
      });

      this.logger.log(
        `✅ Proveedor added successfully: ${proveedorData.NOMBRE_O_RAZ_N_SOCIAL || 'N/A'}`,
      );
      return {
        success: true,
        mensaje:
          '✅ Registro exitoso. Los datos del proveedor se han añadido correctamente en la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error adding proveedor:', error);
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw new BadRequestException('El NIF ya existe en la base de datos.');
      }
      throw new BadRequestException(
        `Error al añadir proveedor: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează un furnizor existent
   */
  async updateProveedor(
    id: number,
    data: any,
  ): Promise<{ success: true; mensaje: string }> {
    try {
      this.logger.log(`📝 Updating proveedor ID: ${id}`);

      // Verifică dacă furnizorul există
      const existing = await this.prisma.proveedores.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new BadRequestException(`Proveedor con ID ${id} no encontrado.`);
      }

      // Normalizează datele
      const updateData: any = {};

      if (data.NIF !== undefined || data.nif !== undefined)
        updateData.NIF = data.NIF || data.nif || null;
      if (
        data['NOMBRE O RAZÓN SOCIAL'] !== undefined ||
        data['NOMBRE O RAZON SOCIAL'] !== undefined ||
        data.NOMBRE_O_RAZ_N_SOCIAL !== undefined
      ) {
        updateData.NOMBRE_O_RAZ_N_SOCIAL =
          data['NOMBRE O RAZÓN SOCIAL'] ||
          data['NOMBRE O RAZON SOCIAL'] ||
          data.NOMBRE_O_RAZ_N_SOCIAL ||
          null;
      }
      if (data.EMAIL !== undefined || data.email !== undefined)
        updateData.EMAIL = data.EMAIL || data.email || null;
      if (data.TELEFONO !== undefined || data.telefono !== undefined)
        updateData.TELEFONO = data.TELEFONO || data.telefono || null;
      if (
        data.MÓVIL !== undefined ||
        data.MOVIL !== undefined ||
        data.movil !== undefined
      ) {
        updateData.M_VIL = data.MÓVIL || data.MOVIL || data.movil || null;
      }
      if (data.FAX !== undefined || data.fax !== undefined)
        updateData.FAX = data.FAX || data.fax || null;
      if (
        data.DIRECCIÓN !== undefined ||
        data.DIRECCION !== undefined ||
        data.direccion !== undefined
      ) {
        updateData.DIRECCI_N =
          data.DIRECCIÓN || data.DIRECCION || data.direccion || null;
      }
      if (
        data['CODIGO POSTAL'] !== undefined ||
        data.CODIGO_POSTAL !== undefined ||
        data.cp !== undefined
      ) {
        updateData.CODIGO_POSTAL =
          data['CODIGO POSTAL'] || data.CODIGO_POSTAL || data.cp || null;
      }
      if (
        data.POBLACIÓN !== undefined ||
        data.POBLACION !== undefined ||
        data.poblacion !== undefined ||
        data.ciudad !== undefined
      ) {
        updateData.POBLACI_N =
          data.POBLACIÓN ||
          data.POBLACION ||
          data.poblacion ||
          data.ciudad ||
          null;
      }
      if (data.PROVINCIA !== undefined || data.provincia !== undefined)
        updateData.PROVINCIA = data.PROVINCIA || data.provincia || null;
      if (
        data.PAÍS !== undefined ||
        data.PAIS !== undefined ||
        data.pais !== undefined
      ) {
        updateData.PA_S = data.PAÍS || data.PAIS || data.pais || null;
      }
      if (data.URL !== undefined || data.url !== undefined)
        updateData.URL = data.URL || data.url || null;
      if (
        data['DESCUENTO POR DEFECTO'] !== undefined ||
        data.DESCUENTO_POR_DEFECTO !== undefined ||
        data.descuento_por_defecto !== undefined
      ) {
        updateData.DESCUENTO_POR_DEFECTO =
          data['DESCUENTO POR DEFECTO'] ||
          data.DESCUENTO_POR_DEFECTO ||
          data.descuento_por_defecto ||
          null;
      }
      if (data.LATITUD !== undefined || data.latitud !== undefined)
        updateData.LATITUD = data.LATITUD || data.latitud || null;
      if (data.LONGITUD !== undefined || data.longitud !== undefined)
        updateData.LONGITUD = data.LONGITUD || data.longitud || null;
      if (
        data['NOTAS PRIVADAS'] !== undefined ||
        data.NOTAS_PRIVADAS !== undefined ||
        data.notas !== undefined
      ) {
        updateData.NOTAS_PRIVADAS =
          data['NOTAS PRIVADAS'] || data.NOTAS_PRIVADAS || data.notas || null;
      }
      if (
        data['CUENTAS BANCARIAS'] !== undefined ||
        data.CUENTAS_BANCARIAS !== undefined ||
        data.cuentas_bancarias !== undefined
      ) {
        updateData.CUENTAS_BANCARIAS =
          data['CUENTAS BANCARIAS'] ||
          data.CUENTAS_BANCARIAS ||
          data.cuentas_bancarias ||
          null;
      }
      if (
        data.ESTADO !== undefined ||
        data.estado !== undefined ||
        data.activo !== undefined
      ) {
        updateData.ESTADO = data.ESTADO || data.estado || data.activo || null;
      }
      // Actualizează automat fecha_actualizacion
      updateData.fecha_actualizacion = new Date();

      await this.prisma.proveedores.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`✅ Proveedor updated successfully: ID ${id}`);
      return {
        success: true,
        mensaje:
          '✅ Edición exitosa. Los datos del proveedor se han actualizado correctamente en la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating proveedor:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar proveedor: ${error.message}`,
      );
    }
  }

  /**
   * Șterge un furnizor
   */
  async deleteProveedor(
    id: number,
  ): Promise<{ success: true; mensaje: string }> {
    try {
      this.logger.log(`📝 Deleting proveedor ID: ${id}`);

      // Verifică dacă furnizorul există
      const existing = await this.prisma.proveedores.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new BadRequestException(`Proveedor con ID ${id} no encontrado.`);
      }

      await this.prisma.proveedores.delete({
        where: { id },
      });

      this.logger.log(`✅ Proveedor deleted successfully: ID ${id}`);
      return {
        success: true,
        mensaje:
          '🗑️ Eliminación exitosa. El registro del proveedor ha sido borrado correctamente de la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting proveedor:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar proveedor: ${error.message}`,
      );
    }
  }

  /**
   * Obține contractele unui client după NIF
   */
  async getContratosCliente(nif: string): Promise<any[]> {
    try {
      this.logger.log(`📥 Fetching contracts for cliente NIF: ${nif}`);

      if (!nif || nif.trim() === '') {
        throw new BadRequestException(
          'NIF es requerido para obtener los contratos.',
        );
      }

      const contratos = await this.prisma.contratosClientes.findMany({
        where: {
          cliente_nif: nif.trim(),
        },
        orderBy: {
          fecha_subida: 'desc',
        },
      });

      // Mapează contractele pentru compatibilitate cu frontend-ul
      const mapped = contratos.map((c: any) => ({
        id: c.id,
        cliente_nif: c.cliente_nif,
        tipo_contrato: c.tipo_contrato,
        fecha_subida: c.fecha_subida,
        fecha_renovacion: c.fecha_renovacion,
        archivo_base64: c.archivo_base64,
        // Pentru compatibilitate cu frontend
        nif: c.cliente_nif,
        contractType: c.tipo_contrato,
        fechaSubida: c.fecha_subida,
        fechaRenovacion: c.fecha_renovacion,
        archivo: c.archivo_base64,
      }));

      this.logger.log(
        `✅ Found ${mapped.length} contracts for cliente NIF: ${nif}`,
      );
      return mapped;
    } catch (error: any) {
      this.logger.error('❌ Error fetching contratos cliente:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al cargar contratos: ${error.message}`,
      );
    }
  }

  /**
   * Upload contract pentru un client
   */
  async uploadContract(data: any): Promise<{ success: true; mensaje: string }> {
    try {
      this.logger.log(
        `📤 Uploading contract for cliente NIF: ${data.nif || data.NIF || 'N/A'}`,
      );

      const nif = data.nif || data.NIF || '';
      const tipoContrato =
        data.contractType || data.tipo_contrato || data.tipoContrato || '';
      const fechaSubida =
        data.fechaSubida || data.fecha_subida || new Date().toISOString();
      const fechaRenovacion =
        data.fechaRenovacion || data.fecha_renovacion || null;
      const archivoBase64 = data.archivo || data.archivo_base64 || '';

      if (!nif || nif.trim() === '') {
        throw new BadRequestException(
          'NIF es requerido para subir el contrato.',
        );
      }

      if (!tipoContrato || tipoContrato.trim() === '') {
        throw new BadRequestException('Tipo de contrato es requerido.');
      }

      // Verifică dacă clientul există
      const cliente = await this.prisma.clientes.findUnique({
        where: { NIF: nif.trim() },
      });

      if (!cliente) {
        throw new BadRequestException(`Cliente con NIF ${nif} no encontrado.`);
      }

      // Formatează data de subida (ISO string -> YYYY-MM-DD sau păstrează formatul)
      let fechaSubidaFormatted = fechaSubida;
      if (fechaSubida && fechaSubida.includes('T')) {
        fechaSubidaFormatted = fechaSubida.split('T')[0];
      }

      // Formatează data de renovación dacă există
      let fechaRenovacionFormatted = fechaRenovacion;
      if (fechaRenovacion && fechaRenovacion.includes('T')) {
        fechaRenovacionFormatted = fechaRenovacion.split('T')[0];
      }

      // Verifică dacă există deja un contract cu același NIF și tip
      const existingContract = await this.prisma.contratosClientes.findFirst({
        where: {
          cliente_nif: nif.trim(),
          tipo_contrato: tipoContrato.trim(),
        },
      });

      if (existingContract) {
        // Actualizează contractul existent
        await this.prisma.contratosClientes.update({
          where: {
            id: existingContract.id,
          },
          data: {
            fecha_subida: fechaSubidaFormatted,
            fecha_renovacion: fechaRenovacionFormatted || null,
            archivo_base64: archivoBase64 || null,
          },
        });
      } else {
        // Creează contract nou
        await this.prisma.contratosClientes.create({
          data: {
            cliente_nif: nif.trim(),
            tipo_contrato: tipoContrato.trim(),
            fecha_subida: fechaSubidaFormatted,
            fecha_renovacion: fechaRenovacionFormatted || null,
            archivo_base64: archivoBase64 || null,
          },
        });
      }

      this.logger.log(
        `✅ Contract uploaded successfully for cliente NIF: ${nif}`,
      );
      return {
        success: true,
        mensaje:
          '✅ Contrato subido exitosamente. El contrato se ha guardado correctamente en la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error uploading contract:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.code === 'P2002') {
        throw new BadRequestException(
          'Ya existe un contrato con este tipo para este cliente.',
        );
      }
      throw new BadRequestException(
        `Error al subir contrato: ${error.message}`,
      );
    }
  }

  /**
   * Șterge un contract după ID
   */
  async deleteContract(
    id: number,
  ): Promise<{ success: true; mensaje: string }> {
    try {
      this.logger.log(`🗑️ Deleting contract ID: ${id}`);

      // Verifică dacă contractul există
      const existing = await this.prisma.contratosClientes.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new BadRequestException(`Contrato con ID ${id} no encontrado.`);
      }

      await this.prisma.contratosClientes.delete({
        where: { id },
      });

      this.logger.log(`✅ Contract deleted successfully: ID ${id}`);
      return {
        success: true,
        mensaje:
          '🗑️ Eliminación exitosa. El contrato del cliente ha sido borrado correctamente de la base de datos.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting contract:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar contrato: ${error.message}`,
      );
    }
  }

  private normalizeContactEmail(
    email: string | null | undefined,
  ): string | null {
    if (!email || !String(email).trim()) return null;
    return String(email).trim().toLowerCase();
  }

  private async assertClienteExists(clienteId: number) {
    const c = await this.prisma.clientes.findUnique({
      where: { id: clienteId },
      select: { id: true },
    });
    if (!c) {
      throw new NotFoundException(`Cliente con id ${clienteId} no encontrado`);
    }
  }

  /** Mismo email + acceso portal no duplicado dentro de la misma comunidad (el enlace del portal acota el cliente). */
  private async assertPortalEmailUniquePerCliente(
    clienteId: number,
    email: string | null,
    accesoPortal: boolean,
    excludeContactoId?: number,
  ) {
    if (!accesoPortal) return;
    const norm = this.normalizeContactEmail(email);
    if (!norm) {
      throw new BadRequestException(
        'Email obligatorio cuando el contacto tiene acceso al portal',
      );
    }
    const candidatos = await this.prisma.clienteContacto.findMany({
      where: {
        cliente_id: clienteId,
        acceso_portal: true,
        estado: 'activo',
        email: { not: null },
      },
      select: { id: true, email: true },
    });
    const conflict = candidatos.find(
      (row) =>
        row.id !== excludeContactoId &&
        row.email &&
        this.normalizeContactEmail(row.email) === norm,
    );
    if (conflict) {
      throw new ConflictException(
        'Ya existe otro contacto con este email y acceso al portal en esta comunidad.',
      );
    }
  }

  private async clearOtherPrincipalContactos(
    clienteId: number,
    keepId: number,
  ) {
    await this.prisma.clienteContacto.updateMany({
      where: {
        cliente_id: clienteId,
        id: { not: keepId },
        es_principal: true,
      },
      data: { es_principal: false },
    });
  }

  async listClienteContactos(clienteId: number) {
    await this.assertClienteExists(clienteId);
    return this.prisma.clienteContacto.findMany({
      where: { cliente_id: clienteId },
      orderBy: [{ es_principal: 'desc' }, { id: 'asc' }],
    });
  }

  async createClienteContacto(
    clienteId: number,
    body: Record<string, unknown>,
  ) {
    await this.assertClienteExists(clienteId);
    const acceso_portal = Boolean(body.acceso_portal);
    const emailRaw = body.email != null ? String(body.email).trim() : '';
    const email = emailRaw || null;
    if (acceso_portal) {
      await this.assertPortalEmailUniquePerCliente(clienteId, email, true);
    }
    const nombre = String(body.nombre || '').trim() || 'Sin nombre';
    const row = await this.prisma.clienteContacto.create({
      data: {
        cliente_id: clienteId,
        nombre,
        cargo_codigo: body.cargo_codigo
          ? String(body.cargo_codigo).trim().slice(0, 80)
          : null,
        cargo_libre: body.cargo_libre
          ? String(body.cargo_libre).trim().slice(0, 200)
          : null,
        email,
        telefono: body.telefono
          ? String(body.telefono).trim().slice(0, 50)
          : null,
        acceso_portal,
        recibe_notificaciones: Boolean(body.recibe_notificaciones),
        es_principal: Boolean(body.es_principal),
        estado:
          String(body.estado || 'activo').toLowerCase() === 'inactivo'
            ? 'inactivo'
            : 'activo',
      },
    });
    if (row.es_principal) {
      await this.clearOtherPrincipalContactos(clienteId, row.id);
    }
    return { success: true as const, data: row };
  }

  async updateClienteContacto(
    clienteId: number,
    contactoId: number,
    body: Record<string, unknown>,
  ) {
    await this.assertClienteExists(clienteId);
    const existing = await this.prisma.clienteContacto.findFirst({
      where: { id: contactoId, cliente_id: clienteId },
    });
    if (!existing) {
      throw new NotFoundException('Contacto no encontrado');
    }
    const acceso_portal =
      body.acceso_portal !== undefined
        ? Boolean(body.acceso_portal)
        : existing.acceso_portal;
    const email =
      body.email !== undefined
        ? String(body.email || '').trim() || null
        : existing.email;
    if (acceso_portal) {
      await this.assertPortalEmailUniquePerCliente(
        clienteId,
        email,
        true,
        contactoId,
      );
    }
    const row = await this.prisma.clienteContacto.update({
      where: { id: contactoId },
      data: {
        nombre:
          body.nombre !== undefined
            ? String(body.nombre || '').trim() || 'Sin nombre'
            : existing.nombre,
        cargo_codigo:
          body.cargo_codigo !== undefined
            ? body.cargo_codigo
              ? String(body.cargo_codigo).trim().slice(0, 80)
              : null
            : existing.cargo_codigo,
        cargo_libre:
          body.cargo_libre !== undefined
            ? body.cargo_libre
              ? String(body.cargo_libre).trim().slice(0, 200)
              : null
            : existing.cargo_libre,
        email,
        telefono:
          body.telefono !== undefined
            ? body.telefono
              ? String(body.telefono).trim().slice(0, 50)
              : null
            : existing.telefono,
        acceso_portal,
        recibe_notificaciones:
          body.recibe_notificaciones !== undefined
            ? Boolean(body.recibe_notificaciones)
            : existing.recibe_notificaciones,
        es_principal:
          body.es_principal !== undefined
            ? Boolean(body.es_principal)
            : existing.es_principal,
        estado:
          body.estado !== undefined
            ? String(body.estado).toLowerCase() === 'inactivo'
              ? 'inactivo'
              : 'activo'
            : existing.estado,
      },
    });
    if (row.es_principal) {
      await this.clearOtherPrincipalContactos(clienteId, row.id);
    }
    return { success: true as const, data: row };
  }

  async deleteClienteContacto(clienteId: number, contactoId: number) {
    await this.assertClienteExists(clienteId);
    const existing = await this.prisma.clienteContacto.findFirst({
      where: { id: contactoId, cliente_id: clienteId },
    });
    if (!existing) {
      throw new NotFoundException('Contacto no encontrado');
    }
    await this.prisma.clienteContacto.delete({ where: { id: contactoId } });
    return { success: true as const };
  }

  /**
   * Crea `portal_invite_token` si no existe (enlace único / QR por comunidad).
   */
  async ensurePortalInviteToken(
    clienteId: number,
    rotate = false,
  ): Promise<{
    token: string;
    nombre: string | null;
  }> {
    await this.assertClienteExists(clienteId);
    const row = await this.prisma.clientes.findUnique({
      where: { id: clienteId },
      select: {
        portal_invite_token: true,
        NOMBRE_O_RAZON_SOCIAL: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Cliente no encontrado');
    }
    if (!rotate && row.portal_invite_token) {
      return {
        token: row.portal_invite_token,
        nombre: row.NOMBRE_O_RAZON_SOCIAL,
      };
    }
    for (let i = 0; i < 5; i++) {
      const token = crypto.randomBytes(32).toString('hex');
      try {
        await this.prisma.clientes.update({
          where: { id: clienteId },
          data: { portal_invite_token: token },
        });
        return { token, nombre: row.NOMBRE_O_RAZON_SOCIAL };
      } catch (e: any) {
        if (e?.code === 'P2002') continue;
        throw e;
      }
    }
    throw new BadRequestException(
      'No se pudo generar el enlace del portal; reintente.',
    );
  }

  /** Facturas PDF del portal (import manual / lote) para ficha CRM del cliente. */
  async listPortalFacturasManuales(clienteId: number) {
    await this.assertClienteExists(clienteId);
    const rows = await this.prisma.clienteFacturaManual.findMany({
      where: { cliente_id: clienteId },
      orderBy: [{ fecha_emision: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        numero_factura: true,
        nombre_archivo: true,
        fecha_emision: true,
        fecha_vencimiento: true,
        importe: true,
        estado: true,
        created_at: true,
      },
    });
    return { success: true as const, data: rows };
  }

  async getPortalFacturaManualPdfBuffer(
    clienteId: number,
    facturaId: number,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    await this.assertClienteExists(clienteId);
    const row = await this.prisma.clienteFacturaManual.findFirst({
      where: { id: facturaId, cliente_id: clienteId },
      select: {
        nombre_archivo: true,
        mime_type: true,
        storage_key: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Factura no encontrada');
    }
    const buffer = await this.portalDocsStorage.resolveArchivo(row);
    const mime = row.mime_type?.trim() || 'application/pdf';
    return { buffer, filename: row.nombre_archivo, mime };
  }
}
