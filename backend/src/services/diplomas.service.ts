import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import AdmZip from 'adm-zip';
import * as pdfParseModule from 'pdf-parse';
import * as iconv from 'iconv-lite';

@Injectable()
export class DiplomasService {
  private readonly logger = new Logger(DiplomasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escapează string-uri pentru SQL
   */
  private escapeSql(value: string): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  /**
   * Extrage textul dintr-un PDF
   */
  private async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    try {
      // pdf-parse este un modul CommonJS, trebuie folosit direct
      const data = await (pdfParseModule as any)(pdfBuffer);
      return data.text || '';
    } catch (error: any) {
      this.logger.warn(`⚠️ Error extrayendo texto del PDF: ${error.message}`);
      return '';
    }
  }

  /**
   * Extrage numele angajatului din textul PDF
   * Folosește pattern-uri similare cu document-classifier
   */
  private extractNombreFromPdfText(pdfText: string): string | null {
    if (!pdfText || pdfText.trim().length === 0) {
      return null;
    }

    const textLines = pdfText.split('\n').map((line) => line.trim());

    // Pattern 1: "D/Dª" sau "D/Da" urmat de nume (comun în documente oficiale)
    const ddaPattern =
      /D\/D[ªA]\.?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,4})(?=\s*\n|\s*NIF|\s*NIE|\s*DNI|\s*Fecha|$)/i;
    const ddaMatch = pdfText.match(ddaPattern);
    if (ddaMatch && ddaMatch[1]) {
      const nombre = ddaMatch[1].trim();
      if (nombre.length >= 5) {
        this.logger.log(`✅ Nombre extraído del PDF (D/Dª): ${nombre}`);
        return nombre;
      }
    }

    // Pattern 2: "NOMBRE:" sau "NOMBRE COMPLETO:" urmat de nume
    const nombrePattern =
      /(?:NOMBRE|NOMBRE\s+COMPLETO|NOMBRE\s+Y\s+APELLIDOS)\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,4})(?=\s*\n|$)/i;
    const nombreMatch = pdfText.match(nombrePattern);
    if (nombreMatch && nombreMatch[1]) {
      const nombre = nombreMatch[1].trim();
      if (nombre.length >= 5) {
        this.logger.log(`✅ Nombre extraído del PDF (NOMBRE:): ${nombre}`);
        return nombre;
      }
    }

    // Pattern 3: "TRABAJADOR/A:" sau "EMPLEADO:" urmat de nume
    const trabajadorPattern =
      /(?:TRABAJADOR\/?A|EMPLEADO|ALUMNO|ESTUDIANTE)\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,4})(?=\s*\n|$)/i;
    const trabajadorMatch = pdfText.match(trabajadorPattern);
    if (trabajadorMatch && trabajadorMatch[1]) {
      const nombre = trabajadorMatch[1].trim();
      if (nombre.length >= 5) {
        this.logger.log(`✅ Nombre extraído del PDF (TRABAJADOR): ${nombre}`);
        return nombre;
      }
    }

    // Pattern 4: Caută linii care conțin doar nume (2-5 cuvinte, toate cu majuscule, fără cifre)
    for (const line of textLines) {
      if (line.length < 5 || line.length > 100) continue;

      const words = line.split(/\s+/).filter((w) => w.length > 0);
      if (words.length >= 2 && words.length <= 5) {
        // Verifică dacă toate cuvintele încep cu majusculă și nu conțin cifre
        const allWordsValid = words.every(
          (w) => /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]*$/.test(w) && !/\d/.test(w),
        );

        if (allWordsValid) {
          // Verifică dacă nu este un pattern comun de document (ex: "CERTIFICADO DE", "DIPLOMA DE")
          const isDocumentPattern =
            /^(CERTIFICADO|DIPLOMA|TÍTULO|DOCUMENTO|FECHA|AÑO|MES|DÍA)/i.test(
              line,
            );
          if (!isDocumentPattern) {
            this.logger.log(
              `✅ Nombre extraído del PDF (línea completa): ${line}`,
            );
            return line;
          }
        }
      }
    }

    return null;
  }

  /**
   * Extrage numele din filename (fallback)
   * Format: diploma-036-304-CARLOS IVAN_BERRAL_VINAS-09231775N.pdf
   * Format alternativ: diploma-241-325-ANISOARA_HUTOPILA_.pdf (fără DNI, cu underscore la final)
   */
  private extractNombreFromFilename(filename: string): string | null {
    if (!filename) return null;

    // Pattern 1: diploma-XXX-XXX-NOMBRE_COMPLETO-DNI.pdf (cu DNI)
    const patternWithDni =
      /^diploma-\d+-\d+-([A-ZÁÉÍÓÚÑ\s_]+)-[A-Z0-9]+\.pdf$/i;
    let match = filename.match(patternWithDni);

    if (match && match[1]) {
      // Înlocuiește underscore-uri cu spații și normalizează
      const nombre = match[1]
        .trim()
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^_+|_+$/g, '')
        .trim();

      if (nombre.length >= 5) {
        this.logger.log(`✅ Nombre extraído del filename (con DNI): ${nombre}`);
        return nombre.toUpperCase();
      }
    }

    // Pattern 2: diploma-XXX-XXX-NOMBRE_COMPLETO_.pdf (fără DNI, cu underscore la final)
    const patternWithoutDni = /^diploma-\d+-\d+-([A-ZÁÉÍÓÚÑ\s_]+)\.pdf$/i;
    match = filename.match(patternWithoutDni);

    if (match && match[1]) {
      // Elimină underscore-urile de la început și final, apoi înlocuiește cu spații
      const nombre = match[1]
        .trim()
        .replace(/^_+|_+$/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (nombre.length >= 5) {
        this.logger.log(`✅ Nombre extraído del filename (sin DNI): ${nombre}`);
        return nombre.toUpperCase();
      }
    }

    // Fallback: caută orice secvență de cuvinte majuscule înainte de ultimul cratime sau la final
    const parts = filename.replace(/\.pdf$/i, '').split('-');
    if (parts.length >= 4) {
      // Alege partea din mijloc (după primele 3 părți numerice)
      // Dacă există DNI, ia până la penultima parte; altfel ia toate părțile rămase
      let nombrePart: string;
      if (parts.length > 4 && /^[A-Z0-9]+$/i.test(parts[parts.length - 1])) {
        // Ultima parte pare să fie DNI, deci ia până la penultima
        nombrePart = parts.slice(3, -1).join(' ');
      } else {
        // Nu există DNI, ia toate părțile rămase
        nombrePart = parts.slice(3).join(' ');
      }

      if (nombrePart && nombrePart.length >= 5) {
        // Elimină underscore-urile de la început și final, apoi normalizează
        const nombre = nombrePart
          .replace(/^_+|_+$/g, '')
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (nombre.length >= 5) {
          this.logger.log(
            `✅ Nombre extraído del filename (fallback): ${nombre}`,
          );
          return nombre.toUpperCase();
        }
      }
    }

    this.logger.warn(`⚠️ No se pudo extraer nombre del filename: ${filename}`);
    return null;
  }

  /**
   * Găsește angajatul după nume (folosește logica similară cu document-ingestion)
   */
  private async findEmpleadoByNombre(nombre: string): Promise<{
    codigo: string;
    nombreCompleto: string;
  } | null> {
    if (!nombre || nombre.trim().length < 3) {
      return null;
    }

    try {
      // Normalizează numele
      const normalizeAccents = (str: string): string => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
      };

      // Normalizează numele: elimină underscore-uri, normalizează spațiile
      let nombreNormalized = nombre.trim().toUpperCase();
      nombreNormalized = nombreNormalized
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const nombreWords = nombreNormalized
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      const nombreWordsNormalized = nombreWords.map((w) => normalizeAccents(w));

      // Strategy 1: Exact match (normalizat, fără underscore-uri)
      let query = `
        SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
        FROM DatosEmpleados
        WHERE TRIM(UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '_', ' '), '  ', ' '))) = ${this.escapeSql(nombreNormalized)}
        LIMIT 1
      `;

      let result =
        await this.prisma.$queryRawUnsafe<
          Array<{ CODIGO: string; nombre: string }>
        >(query);

      if (result && result.length > 0) {
        this.logger.log(
          `✅ Exact match found for "${nombreNormalized}": ${result[0].CODIGO}`,
        );
        return {
          codigo: result[0].CODIGO,
          nombreCompleto: result[0].nombre,
        };
      }

      // Strategy 2: Majority of words match (OR)
      if (nombreWords.length >= 2) {
        const likeConditions = nombreWordsNormalized
          .map(
            (word) =>
              `TRIM(UPPER(REPLACE(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '_', ' '), '  ', ' '), '  ', ' '))) LIKE ${this.escapeSql(`%${word}%`)}`,
          )
          .join(' OR ');

        query = `
          SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
          FROM DatosEmpleados
          WHERE (${likeConditions})
          LIMIT 20
        `;

        result =
          await this.prisma.$queryRawUnsafe<
            Array<{ CODIGO: string; nombre: string }>
          >(query);

        if (result && result.length > 0) {
          // Găsește cel mai bun match (cel cu cele mai multe cuvinte comune)
          let bestMatch = result[0];
          let bestScore = 0;

          for (const emp of result) {
            const empWords = normalizeAccents(emp.nombre)
              .split(/\s+/)
              .filter((w) => w.length >= 2);
            const commonWords = nombreWordsNormalized.filter((w) =>
              empWords.some((ew) => ew.includes(w) || w.includes(ew)),
            );
            const score =
              commonWords.length /
              Math.max(nombreWords.length, empWords.length);

            if (score > bestScore) {
              bestScore = score;
              bestMatch = emp;
            }
          }

          if (bestScore >= 0.5) {
            // Minimum 50% match
            this.logger.log(
              `✅ Best match found for "${nombreNormalized}": ${bestMatch.CODIGO} (${bestMatch.nombre}, score: ${bestScore.toFixed(2)})`,
            );
            return {
              codigo: bestMatch.CODIGO,
              nombreCompleto: bestMatch.nombre,
            };
          }
        }
      }

      this.logger.warn(`⚠️ No match found for "${nombreNormalized}"`);
      return null;
    } catch (error: any) {
      this.logger.error(
        `❌ Error finding empleado by nombre "${nombre}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Procesează un ZIP cu diplome și extrage informațiile
   */
  async procesarZipDiplomas(
    zipBuffer: Buffer,

    _usuarioId: string,
  ): Promise<{
    success: boolean;
    diplomas: Array<{
      nombreArchivo: string;
      nombreExtraido: string | null;
      empleadoCodigo: string | null;
      empleadoNombre: string | null;
      archivoBuffer: Buffer;
      tamaño: number;
      fuente: 'pdf' | 'filename' | null; // De unde s-a extras numele
    }>;
    errores: Array<{
      nombreArchivo: string;
      error: string;
    }>;
  }> {
    try {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      const diplomas: Array<{
        nombreArchivo: string;
        nombreExtraido: string | null;
        empleadoCodigo: string | null;
        empleadoNombre: string | null;
        archivoBuffer: Buffer;
        tamaño: number;
        fuente: 'pdf' | 'filename' | null;
      }> = [];

      const errores: Array<{ nombreArchivo: string; error: string }> = [];

      for (const entry of zipEntries) {
        // Ignoră directoarele
        if (entry.isDirectory) {
          continue;
        }

        // Decodează numele corect din ZIP
        let entryName = entry.entryName;
        try {
          // Încearcă să decodezi din CP437 (pentru ZIP-uri vechi)
          if (entry.rawEntryName) {
            entryName = iconv.decode(entry.rawEntryName, 'cp437');
          }
        } catch {
          // Folosește numele original
        }

        // Doar PDF-uri
        if (!entryName.toLowerCase().endsWith('.pdf')) {
          this.logger.warn(`⚠️ Archivo ignorado (no es PDF): ${entryName}`);
          continue;
        }

        const nombreArchivo = entryName.split('/').pop() || entryName;
        let nombreExtraido: string | null = null;
        let empleadoCodigo: string | null = null;
        let empleadoNombre: string | null = null;
        let fuente: 'pdf' | 'filename' | null = null;

        try {
          const archivoBuffer = entry.getData();

          // PRIORITATE 1: Extrage din PDF
          const pdfText = await this.extractTextFromPdf(archivoBuffer);
          if (pdfText) {
            nombreExtraido = this.extractNombreFromPdfText(pdfText);
            if (nombreExtraido) {
              fuente = 'pdf';
              this.logger.log(
                `📄 Nombre extraído del PDF para ${nombreArchivo}: ${nombreExtraido}`,
              );
            }
          }

          // FALLBACK: Extrage din filename
          if (!nombreExtraido) {
            nombreExtraido = this.extractNombreFromFilename(nombreArchivo);
            if (nombreExtraido) {
              fuente = 'filename';
              this.logger.log(
                `📝 Nombre extraído del filename para ${nombreArchivo}: ${nombreExtraido}`,
              );
            }
          }

          // Găsește angajatul
          if (nombreExtraido) {
            const empleado = await this.findEmpleadoByNombre(nombreExtraido);
            if (empleado) {
              empleadoCodigo = empleado.codigo;
              empleadoNombre = empleado.nombreCompleto;
            } else {
              this.logger.warn(
                `⚠️ No se encontró empleado para "${nombreExtraido}" (archivo: ${nombreArchivo})`,
              );
            }
          } else {
            this.logger.warn(
              `⚠️ No se pudo extraer nombre de ${nombreArchivo}`,
            );
          }

          diplomas.push({
            nombreArchivo,
            nombreExtraido,
            empleadoCodigo,
            empleadoNombre,
            archivoBuffer,
            tamaño: archivoBuffer.length,
            fuente,
          });
        } catch (error: any) {
          this.logger.error(
            `❌ Error procesando ${nombreArchivo}: ${error.message}`,
          );
          errores.push({
            nombreArchivo,
            error: error.message,
          });
        }
      }

      this.logger.log(
        `✅ ZIP procesado: ${diplomas.length} diplomas, ${errores.length} errores`,
      );

      return {
        success: true,
        diplomas,
        errores,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando ZIP de diplomas:`, error);
      throw new BadRequestException(`Error procesando ZIP: ${error.message}`);
    }
  }

  /**
   * Procesează PDF-uri individuale (fără ZIP) și extrage informațiile
   */
  async procesarPdfDiplomas(
    pdfs: Array<{ nombreArchivo: string; archivoBuffer: Buffer }>,

    _usuarioId: string,
  ): Promise<{
    success: boolean;
    diplomas: Array<{
      nombreArchivo: string;
      nombreExtraido: string | null;
      empleadoCodigo: string | null;
      empleadoNombre: string | null;
      archivoBuffer: Buffer;
      tamaño: number;
      fuente: 'pdf' | 'filename' | null;
    }>;
    errores: Array<{
      nombreArchivo: string;
      error: string;
    }>;
  }> {
    try {
      const diplomas: Array<{
        nombreArchivo: string;
        nombreExtraido: string | null;
        empleadoCodigo: string | null;
        empleadoNombre: string | null;
        archivoBuffer: Buffer;
        tamaño: number;
        fuente: 'pdf' | 'filename' | null;
      }> = [];

      const errores: Array<{ nombreArchivo: string; error: string }> = [];

      for (const pdf of pdfs) {
        // Doar PDF-uri
        if (!pdf.nombreArchivo.toLowerCase().endsWith('.pdf')) {
          this.logger.warn(
            `⚠️ Archivo ignorado (no es PDF): ${pdf.nombreArchivo}`,
          );
          continue;
        }

        const nombreArchivo =
          pdf.nombreArchivo.split('/').pop() || pdf.nombreArchivo;
        let nombreExtraido: string | null = null;
        let empleadoCodigo: string | null = null;
        let empleadoNombre: string | null = null;
        let fuente: 'pdf' | 'filename' | null = null;

        try {
          // PRIORITATE 1: Extrage din PDF
          const pdfText = await this.extractTextFromPdf(pdf.archivoBuffer);
          if (pdfText) {
            nombreExtraido = this.extractNombreFromPdfText(pdfText);
            if (nombreExtraido) {
              fuente = 'pdf';
              this.logger.log(
                `📄 Nombre extraído del PDF para ${nombreArchivo}: ${nombreExtraido}`,
              );
            }
          }

          // FALLBACK: Extrage din filename
          if (!nombreExtraido) {
            nombreExtraido = this.extractNombreFromFilename(nombreArchivo);
            if (nombreExtraido) {
              fuente = 'filename';
              this.logger.log(
                `📝 Nombre extraído del filename para ${nombreArchivo}: ${nombreExtraido}`,
              );
            }
          }

          // Găsește angajatul
          if (nombreExtraido) {
            const empleado = await this.findEmpleadoByNombre(nombreExtraido);
            if (empleado) {
              empleadoCodigo = empleado.codigo;
              empleadoNombre = empleado.nombreCompleto;
            } else {
              this.logger.warn(
                `⚠️ No se encontró empleado para "${nombreExtraido}" (archivo: ${nombreArchivo})`,
              );
            }
          } else {
            this.logger.warn(
              `⚠️ No se pudo extraer nombre de ${nombreArchivo}`,
            );
          }

          diplomas.push({
            nombreArchivo,
            nombreExtraido,
            empleadoCodigo,
            empleadoNombre,
            archivoBuffer: pdf.archivoBuffer,
            tamaño: pdf.archivoBuffer.length,
            fuente,
          });
        } catch (error: any) {
          this.logger.error(
            `❌ Error procesando ${nombreArchivo}: ${error.message}`,
          );
          errores.push({
            nombreArchivo,
            error: error.message,
          });
        }
      }

      this.logger.log(
        `✅ PDFs procesados: ${diplomas.length} diplomas, ${errores.length} errores`,
      );

      return {
        success: true,
        diplomas,
        errores,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando PDFs de diplomas:`, error);
      throw new BadRequestException(`Error procesando PDFs: ${error.message}`);
    }
  }

  /**
   * Salvează diplomele în baza de date
   */
  async guardarDiplomas(
    diplomas: Array<{
      nombreArchivo: string;
      empleadoCodigo: string;
      empleadoNombre: string;
      archivoBuffer: Buffer;
    }>,
    usuarioId: string,
  ): Promise<{
    success: boolean;
    guardados: number;
    errores: number;
  }> {
    let guardados = 0;
    let errores = 0;

    for (const diploma of diplomas) {
      try {
        if (!diploma.empleadoCodigo) {
          this.logger.warn(
            `⚠️ Saltando diploma ${diploma.nombreArchivo} - sin empleadoCodigo`,
          );
          errores++;
          continue;
        }

        const archivoHex = `0x${diploma.archivoBuffer.toString('hex')}`;
        const nombreNormalizado = diploma.nombreArchivo
          .replace(/[^\w\s.-]/g, '_')
          .substring(0, 255);

        await this.prisma.$executeRawUnsafe(
          `
          INSERT INTO diplomas (empleado_id, nombre_empleado, nombre_archivo, archivo, subido_por, fecha_subida)
          VALUES (
            ${this.escapeSql(diploma.empleadoCodigo)},
            ${this.escapeSql(diploma.empleadoNombre)},
            ${this.escapeSql(nombreNormalizado)},
            ${archivoHex},
            ${this.escapeSql(usuarioId)},
            CURRENT_TIMESTAMP
          )
          `,
        );

        guardados++;
        this.logger.log(
          `✅ Diploma guardado: ${diploma.nombreArchivo} para empleado ${diploma.empleadoCodigo}`,
        );
      } catch (error: any) {
        this.logger.error(
          `❌ Error guardando diploma ${diploma.nombreArchivo}: ${error.message}`,
        );
        errores++;
      }
    }

    return {
      success: true,
      guardados,
      errores,
    };
  }

  /**
   * Listează diplomele unui angajat
   */
  /**
   * Listează toate diplomas din baza de date (pentru admin)
   */
  async listarTodasLasDiplomas(): Promise<
    Array<{
      id: number;
      empleado_id: string;
      nombre_empleado: string;
      nombre_archivo: string;
      uploaded_by: string;
      uploaded_at: Date;
    }>
  > {
    try {
      const diplomas = await this.prisma.diploma.findMany({
        orderBy: { fecha_subida: 'desc' },
        select: {
          id: true,
          empleado_id: true,
          nombre_empleado: true,
          nombre_archivo: true,
          subido_por: true,
          fecha_subida: true,
        },
      });

      return diplomas.map((d) => ({
        id: d.id,
        empleado_id: d.empleado_id,
        nombre_empleado: d.nombre_empleado,
        nombre_archivo: d.nombre_archivo,
        uploaded_by: d.subido_por,
        uploaded_at: d.fecha_subida,
      }));
    } catch (error: any) {
      this.logger.error(`❌ Error listando todas las diplomas:`, error);
      throw new BadRequestException(
        `Error listando diplomas: ${error.message}`,
      );
    }
  }

  async listarDiplomasEmpleado(empleadoId: string): Promise<
    Array<{
      id: number;
      nombre_archivo: string;
      fecha_subida: Date;
      subido_por: string;
    }>
  > {
    try {
      const diplomas = await this.prisma.$queryRawUnsafe<
        Array<{
          id: number;
          nombre_archivo: string;
          fecha_subida: Date;
          subido_por: string;
        }>
      >(
        `
        SELECT id, nombre_archivo, fecha_subida, subido_por
        FROM diplomas
        WHERE empleado_id = ${this.escapeSql(empleadoId)}
        ORDER BY fecha_subida DESC
        `,
      );

      return diplomas;
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando diplomas para empleado ${empleadoId}:`,
        error,
      );
      throw new BadRequestException(
        `Error listando diplomas: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă o diplomă. Dacă empleadoId e null/undefined (admin), se returnează orice diplomă cu acel id.
   */
  async descargarDiploma(
    diplomaId: number,
    empleadoId: string | null | undefined,
  ): Promise<{ archivo: Buffer; nombre_archivo: string }> {
    try {
      const andEmpleado =
        empleadoId != null && String(empleadoId).trim() !== ''
          ? ` AND empleado_id = ${this.escapeSql(String(empleadoId).trim())}`
          : '';
      const diploma = await this.prisma.$queryRawUnsafe<
        Array<{
          archivo: Buffer;
          nombre_archivo: string;
          empleado_id: string;
        }>
      >(
        `
        SELECT archivo, nombre_archivo, empleado_id
        FROM diplomas
        WHERE id = ${diplomaId}${andEmpleado}
        LIMIT 1
        `,
      );

      if (!diploma || diploma.length === 0) {
        throw new BadRequestException(
          empleadoId != null
            ? `Diploma ${diplomaId} no encontrada o no tienes acceso`
            : `Diploma ${diplomaId} no encontrada`,
        );
      }

      return {
        archivo: diploma[0].archivo,
        nombre_archivo: diploma[0].nombre_archivo,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error descargando diploma ${diplomaId}:`, error);
      throw new BadRequestException(
        `Error descargando diploma: ${error.message}`,
      );
    }
  }
}
