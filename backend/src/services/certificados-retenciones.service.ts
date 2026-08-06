import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificadosRetencionesStorageService } from './certificados-retenciones-storage.service';
import AdmZip from 'adm-zip';
import * as pdfParseModule from 'pdf-parse';
import * as iconv from 'iconv-lite';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class CertificadosRetencionesService {
  private readonly logger = new Logger(CertificadosRetencionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificadosStorage: CertificadosRetencionesStorageService,
  ) {}

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

  /** Frases del propio certificado AEAT que no son nombre de persona */
  private isFalsePositiveNombreCandidate(s: string): boolean {
    const u = s.trim().toUpperCase();
    if (u.length < 4) return true;
    return (
      /^RENDIMIENTOS\s+DEL\s+TRABAJO/i.test(u) ||
      /DETALLE\s+DE\s+LAS\s+PERCEPCIONES/i.test(u) ||
      /PERCEPCIONES\s+Y\s+DE\s+LAS\s+RETENCIONES/i.test(u) ||
      /RETENCIONES\s+E\s+INGRESOS/i.test(u) ||
      u.includes('DATOS DEL PAGADOR') ||
      u.includes('DATOS DEL PERCEPTOR') ||
      u.includes('IDENTIFICACIÓN DEL PAGADOR') ||
      u.includes('IDENTIFICACION DEL PAGADOR') ||
      u.includes('CORRESPONDIENTES AL EJERCICIO') ||
      u.startsWith('CERTIFICADO DE RETENCIONES') ||
      u.includes('IMPUESTO SOBRE LA RENTA') ||
      /^IMPORTE\b/i.test(u) ||
      /^TOTAL\b/i.test(u) ||
      /\bGTOS\b/i.test(s) ||
      /\bGASTOS\b/i.test(u) ||
      /\bDEDUCIBLES\b/i.test(u) ||
      /\bREDUCCIONES\b/i.test(u) ||
      /\bPERCEPCIONES\b/i.test(u) ||
      /\bRETENCIONES\b/i.test(u) ||
      /\bINGRESOS\s+A\s+CUENTA\b/i.test(u) ||
      /\bBASE\s+IMPONIBLE\b/i.test(u) ||
      /\bLIQUIDO\b/i.test(u) ||
      /\bMODELO\s*190\b/i.test(u)
    );
  }

  /** Etiquetas de casillas del modelo IRPF (no son personas) */
  private looksLikeIrpfFormLabelLine(line: string): boolean {
    const u = line.toUpperCase();
    if (u.length > 120) return true;
    const taxHints = [
      'DEDUCIBLE',
      'REDUCCION',
      'PERCEPCION',
      'RETENCION',
      'INGRESO',
      'RENDIMIENTO',
      'GTOS',
      'GASTOS',
      'BASE ',
      'CUOTA',
      'LIQUID',
      'MODELO',
      'EJERCICIO',
      'CERTIFICADO',
      'PAGADOR',
      'PERCEPTOR',
      'DETALLE',
      'IMPORTE',
      'TOTAL',
      'ANTERIOR',
      'SATISFECH',
    ];
    if (taxHints.some((h) => u.includes(h))) return true;
    return false;
  }

  /**
   * Certificado IRPF: bloque "Datos del perceptor" → NIF/NIE y línea de nombre (p. ej. BARROSO RUIZ MANUEL).
   */
  private extractNombreFromDatosDelPerceptorBlock(
    pdfText: string,
  ): string | null {
    const m = pdfText.match(/Datos\s+del\s+perceptor\s*([\s\S]{0,1600})/i);
    if (!m?.[1]) return null;
    const sub = m[1];

    const nifThenName = sub.match(
      /\b([XYZ]\d{7,8}[A-Z]|\d{8}[A-Z]|\d{9}[A-Z])\b\s*[\n\r]+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,100}?)(?=[\n\r]|$)/i,
    );
    if (nifThenName?.[2]) {
      const n = nifThenName[2].trim().replace(/\s+/g, ' ');
      if (n.length >= 5 && !this.isFalsePositiveNombreCandidate(n)) return n;
    }

    const labeledNextLine = sub.match(
      /\b(?:NIF|NIE|DNI)\s*[:\s]?\s*[A-Z0-9]{6,16}\s*[\n\r]+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,100}?)(?=[\n\r]|$)/i,
    );
    if (labeledNextLine?.[1]) {
      const n = labeledNextLine[1].trim().replace(/\s+/g, ' ');
      if (n.length >= 5 && !this.isFalsePositiveNombreCandidate(n)) return n;
    }

    const apellidos = sub.match(
      /(?:Apellidos\s+y\s+nombre|APELLIDOS\s+Y\s+NOMBRE)\s*[:\s]*\s*[\n\r]*\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,100}?)(?=[\n\r]|$)/i,
    );
    if (apellidos?.[1]) {
      const n = apellidos[1].trim().replace(/\s+/g, ' ');
      if (n.length >= 5 && !this.isFalsePositiveNombreCandidate(n)) return n;
    }

    return null;
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

    const desdePerceptor =
      this.extractNombreFromDatosDelPerceptorBlock(pdfText);
    if (desdePerceptor) {
      this.logger.debug(
        `Nombre extraído (Datos del perceptor): ${desdePerceptor}`,
      );
      return desdePerceptor;
    }

    // Pattern 1: "D/Dª" sau "D/Da" urmat de nume (comun în documente oficiale)
    const ddaPattern =
      /D\/D[ªA]\.?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,4})(?=\s*\n|\s*NIF|\s*NIE|\s*DNI|\s*Fecha|$)/i;
    const ddaMatch = pdfText.match(ddaPattern);
    if (ddaMatch && ddaMatch[1]) {
      const nombre = ddaMatch[1].trim();
      if (nombre.length >= 5 && !this.isFalsePositiveNombreCandidate(nombre)) {
        this.logger.debug(`Nombre extraído (D/Dª): ${nombre}`);
        return nombre;
      }
    }

    // Pattern 2: "NOMBRE:" sau "NOMBRE COMPLETO:" urmat de nume
    const nombrePattern =
      /(?:NOMBRE|NOMBRE\s+COMPLETO|NOMBRE\s+Y\s+APELLIDOS)\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,4})(?=\s*\n|$)/i;
    const nombreMatch = pdfText.match(nombrePattern);
    if (nombreMatch && nombreMatch[1]) {
      const nombre = nombreMatch[1].trim();
      if (nombre.length >= 5 && !this.isFalsePositiveNombreCandidate(nombre)) {
        this.logger.debug(`Nombre extraído (NOMBRE:): ${nombre}`);
        return nombre;
      }
    }

    // Pattern 3: "TRABAJADOR/A:" sau "EMPLEADO:" urmat de nume
    const trabajadorPattern =
      /(?:TRABAJADOR\/?A|EMPLEADO|ALUMNO|ESTUDIANTE)\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,4})(?=\s*\n|$)/i;
    const trabajadorMatch = pdfText.match(trabajadorPattern);
    if (trabajadorMatch && trabajadorMatch[1]) {
      const nombre = trabajadorMatch[1].trim();
      if (nombre.length >= 5 && !this.isFalsePositiveNombreCandidate(nombre)) {
        this.logger.debug(`Nombre extraído (TRABAJADOR): ${nombre}`);
        return nombre;
      }
    }

    // Pattern 3b: PERCEPTOR (certificados de retenciones / IRPF AEAT)
    // "PERCEPTOR:" como etiqueta, no la palabra dentro de "percepciones"
    const perceptorPattern =
      /(?:^|[\n\r])\s*PERCEPTOR\s*:+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,6})/im;
    const perceptorMatch = pdfText.match(perceptorPattern);
    if (perceptorMatch && perceptorMatch[1]) {
      const nombre = perceptorMatch[1].trim();
      if (nombre.length >= 5 && !this.isFalsePositiveNombreCandidate(nombre)) {
        this.logger.debug(`Nombre extraído (PERCEPTOR): ${nombre}`);
        return nombre;
      }
    }

    // AEAT modelo 190: nombre en línea siguiente a Perceptor / Apellidos y nombre
    const perceptorNl = pdfText.match(
      /(?:PERCEPTOR|Perceptor)\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,100}?)(?=\s*\n|$)/i,
    );
    if (perceptorNl && perceptorNl[1]) {
      const nombre = perceptorNl[1].trim().replace(/\s+/g, ' ');
      if (
        nombre.length >= 5 &&
        !/^NIF\b/i.test(nombre) &&
        !this.isFalsePositiveNombreCandidate(nombre)
      ) {
        this.logger.debug(`Nombre extraído (PERCEPTOR multilínea): ${nombre}`);
        return nombre;
      }
    }

    const apellidosNombre = pdfText.match(
      /(?:Apellidos\s+y\s+nombre|APELLIDOS\s+Y\s+NOMBRE|Raz[oó]n\s+[Ss]ocial)\s*:?\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,120}?)(?=\s*\n)/i,
    );
    if (apellidosNombre && apellidosNombre[1]) {
      const nombre = apellidosNombre[1].trim().replace(/\s+/g, ' ');
      if (nombre.length >= 5 && !this.isFalsePositiveNombreCandidate(nombre)) {
        this.logger.debug(`Nombre extraído (Apellidos y nombre): ${nombre}`);
        return nombre;
      }
    }

    const idPerceptor = pdfText.match(
      /Identificaci[oó]n\s+del\s+perceptor[^\n]*\n+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,120}?)(?=\s*\n)/i,
    );
    if (idPerceptor && idPerceptor[1]) {
      const nombre = idPerceptor[1].trim().replace(/\s+/g, ' ');
      if (nombre.length >= 5 && !this.isFalsePositiveNombreCandidate(nombre)) {
        this.logger.debug(
          `Nombre extraído (Identificación perceptor): ${nombre}`,
        );
        return nombre;
      }
    }

    // Pattern 4 (solo último recurso): líneas cortas tipo nombre; excluir todo lo que huela a casillas IRPF
    for (const line of textLines) {
      if (line.length < 5 || line.length > 80) continue;
      if (this.looksLikeIrpfFormLabelLine(line)) continue;

      const words = line.split(/\s+/).filter((w) => w.length > 0);
      if (words.length < 2 || words.length > 5) continue;

      const allWordsValid = words.every(
        (w) => /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]*$/.test(w) && !/\d/.test(w),
      );
      if (!allWordsValid) continue;

      const isDocumentPattern =
        /^(CERTIFICADO|DIPLOMA|TÍTULO|DOCUMENTO|FECHA|AÑO|MES|DÍA|RENDIMIENTOS|PERCEPCIONES|RETENCIONES|DETALLE|IMPORTE|TOTAL|DATOS|IDENTIFICACI|CORRESPONDIENTES|COMPROBACI|GASTOS|GTOS)/i.test(
          line,
        );
      if (isDocumentPattern || this.isFalsePositiveNombreCandidate(line)) {
        continue;
      }

      this.logger.debug(`Nombre candidato (línea): ${line}`);
      return line;
    }

    return null;
  }

  /**
   * Extrage numele din filename (fallback)
   * Format: diploma-… / certificado-… / cr-… (mismo esquema que diplomas)
   */
  private extractNombreFromFilename(filename: string): string | null {
    if (!filename) return null;

    const pref = '(?:diploma|certificado|certificadoretencion|cr|retencion)';

    // Pattern 1: PREFIX-XXX-XXX-NOMBRE_COMPLETO-DNI.pdf (cu DNI)
    const patternWithDni = new RegExp(
      `^${pref}-\\d+-\\d+-([A-ZÁÉÍÓÚÑ\\s_]+)-[A-Z0-9]+\\.pdf$`,
      'i',
    );
    let match = filename.match(patternWithDni);

    if (match && match[1]) {
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

    // Pattern 2: PREFIX-XXX-XXX-NOMBRE.pdf (sin DNI)
    const patternWithoutDni = new RegExp(
      `^${pref}-\\d+-\\d+-([A-ZÁÉÍÓÚÑ\\s_]+)\\.pdf$`,
      'i',
    );
    match = filename.match(patternWithoutDni);

    if (match && match[1]) {
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

  /** Año fiscal / ejercicio en certificados AEAT (modelo 190, etc.) */
  private extractEjercicioFromPdfText(pdfText: string): string | null {
    if (!pdfText?.trim()) return null;

    // AEAT: "Datos correspondientes al ejercicio" + año con formato español 2.025 (= 2025)
    const spanishBox = pdfText.match(
      /(?:correspondientes\s+al\s+)?ejercicio[^\d]{0,60}(\d)[\s.]?(\d{3})\b/i,
    );
    if (spanishBox?.[1] && spanishBox?.[2]) {
      const y = `${spanishBox[1]}${spanishBox[2]}`;
      const n = parseInt(y, 10);
      if (n >= 1990 && n <= 2100) return y;
    }

    const dotYear = pdfText.match(
      /\b([12])\.(0\d{2})\b(?=[\s\S]{0,500}(?:retenc|ejercicio|perceptor|irpf|certificado|ingresos))/i,
    );
    if (dotYear?.[1] && dotYear?.[2]) {
      const y = `${dotYear[1]}${dotYear[2]}`;
      const n = parseInt(y, 10);
      if (n >= 1990 && n <= 2100) return String(n);
    }

    const m =
      pdfText.match(/\bEJERCICIO\s*:?\s*(\d{4})\b/i) ||
      pdfText.match(/\bEjercicio\s*(?:fiscal)?\s*:?\s*(\d{4})\b/i) ||
      pdfText.match(/\bejercicio\s*(?:fiscal)?\s*:?\s*(\d{4})\b/i);
    if (m?.[1]) {
      const y = m[1];
      if (y >= '1990' && y <= '2100') return y;
    }
    const m2 = pdfText.match(/\b(?:año|ano)\s+(\d{4})\b/i);
    if (m2?.[1] && m2[1] >= '1990' && m2[1] <= '2100') return m2[1];

    return null;
  }

  private splitPdfTextFallback(data: {
    text?: string;
    numpages?: number;
  }): string[] {
    const full = data?.text || '';
    if (full.includes('\f')) {
      return full.split('\f').map((x) => x.trim());
    }
    const n = Math.max(1, Number(data?.numpages) || 1);
    return Array.from({ length: n }, () => full);
  }

  /** Texto por página (pdf-parse v2) con fallback */
  private async extractTextPerPage(pdfBuffer: Buffer): Promise<string[]> {
    const PDFParse = (pdfParseModule as any).PDFParse;
    if (!PDFParse) {
      const data = await (pdfParseModule as any)(pdfBuffer);
      return this.splitPdfTextFallback(data || {});
    }

    let pdfInstance: any = null;
    try {
      pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
      let total = 0;
      try {
        const info = await pdfInstance.getInfo();
        total = Number(info?.total) || 0;
      } catch {
        /* ignore */
      }
      if (total < 1) {
        const doc = await PDFDocument.load(pdfBuffer, {
          ignoreEncryption: true,
        });
        total = doc.getPageCount();
      }
      if (total < 1) {
        throw new Error('PDF sin páginas');
      }
      const out: string[] = [];
      for (let p = 1; p <= total; p++) {
        const r = await pdfInstance.getText({ partial: [p] });
        const t =
          r && typeof r === 'object' && 'text' in r
            ? String((r as { text?: string }).text ?? '')
            : String(r ?? '');
        out.push(t);
      }
      return out;
    } catch (e: any) {
      this.logger.warn(
        `⚠️ extractTextPerPage partial falló (${e?.message}), usando fallback`,
      );
      const data = await (pdfParseModule as any)(pdfBuffer);
      return this.splitPdfTextFallback(data || {});
    } finally {
      try {
        await pdfInstance?.destroy?.();
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Solo la 1ª página de cada certificado AEAT: título / cabecera arriba.
   * No usar "retenciones/perceptor" en todo el texto — en páginas siguientes aparecen en tablas y rompen el segmentado.
   */
  private isCertificateStartPage(text: string): boolean {
    const top = text.slice(0, 4000);
    if (/certificado\s+de\s+retenciones\s+e\s+ingresos/i.test(top)) {
      return true;
    }
    if (/certificado\s+de\s+retenciones/i.test(top)) {
      return true;
    }
    if (/COMPROBACI[OÓ]N\s+DE\s+DATOS/i.test(top)) {
      return true;
    }
    const head = text.slice(0, 3600);
    if (
      /datos\s+correspondientes\s+al\s+ejercicio/i.test(head) &&
      /datos\s+del\s+pagador/i.test(head) &&
      /datos\s+del\s+perceptor/i.test(head)
    ) {
      return true;
    }
    return false;
  }

  private isLikelyCoverPage(text: string): boolean {
    const t = text.slice(0, 2000);
    if (this.isCertificateStartPage(text)) return false;
    const hasPersona =
      /\b(NIF|NIE|DNI)\b/i.test(t) ||
      /perceptor/i.test(t) ||
      /identificaci[oó]n/i.test(t);
    if (hasPersona) return false;
    return (
      /certificados?\s+de\s+retenciones/i.test(t) ||
      /de\s+camino/i.test(t) ||
      t.length < 400
    );
  }

  private buildSegmentsFromPageTexts(pageTexts: string[]): Array<{
    pageFrom: number;
    pageTo: number;
  }> {
    const n = pageTexts.length;
    if (n === 0) return [];

    const starts: number[] = [];
    for (let i = 0; i < n; i++) {
      const pageNum = i + 1;
      if (this.isLikelyCoverPage(pageTexts[i])) {
        continue;
      }
      if (this.isCertificateStartPage(pageTexts[i])) {
        starts.push(pageNum);
      }
    }

    if (starts.length >= 2) {
      const segments: Array<{ pageFrom: number; pageTo: number }> = [];
      for (let i = 0; i < starts.length; i++) {
        const from = starts[i];
        const to = i + 1 < starts.length ? starts[i + 1] - 1 : n;
        if (from <= to) {
          segments.push({ pageFrom: from, pageTo: to });
        }
      }
      return segments;
    }

    if (starts.length === 1 && n > starts[0]) {
      return [{ pageFrom: starts[0], pageTo: n }];
    }

    const segments: Array<{ pageFrom: number; pageTo: number }> = [];
    for (let i = 0; i < n; i++) {
      if (this.isLikelyCoverPage(pageTexts[i])) {
        continue;
      }
      segments.push({ pageFrom: i + 1, pageTo: i + 1 });
    }
    return segments;
  }

  private async extractPdfPageRange(
    pdfBuffer: Buffer,
    pageFrom1: number,
    pageTo1: number,
  ): Promise<Buffer> {
    const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const indices: number[] = [];
    for (let p = pageFrom1; p <= pageTo1; p++) {
      indices.push(p - 1);
    }
    const copied = await out.copyPages(src, indices);
    copied.forEach((page) => out.addPage(page));
    const bytes = await out.save();
    return Buffer.from(bytes);
  }

  /**
   * Un solo PDF con muchos certificados: preview con páginas, ejercicio y nombre.
   */
  async procesarPdfCompuestoCertificadosRetenciones(
    pdfBuffer: Buffer,
    _usuarioId: string,
  ): Promise<{
    success: boolean;
    totalPages: number;
    estrategia: 'por_marcadores' | 'una_pagina_por_certificado';
    certificados: Array<{
      pageFrom: number;
      pageTo: number;
      segmentoId: string;
      nombreExtraido: string | null;
      ejercicio: string | null;
      empleadoCodigo: string | null;
      empleadoNombre: string | null;
      esPortada: boolean;
    }>;
  }> {
    const pageTexts = await this.extractTextPerPage(pdfBuffer);
    const totalPages = pageTexts.length;
    if (totalPages < 1) {
      throw new BadRequestException('No se pudo leer ninguna página del PDF');
    }

    const numStarts = pageTexts.filter(
      (t) => !this.isLikelyCoverPage(t) && this.isCertificateStartPage(t),
    ).length;
    const segments = this.buildSegmentsFromPageTexts(pageTexts);
    const estrategia =
      numStarts >= 1 ? 'por_marcadores' : 'una_pagina_por_certificado';

    const certificados: Array<{
      pageFrom: number;
      pageTo: number;
      segmentoId: string;
      nombreExtraido: string | null;
      ejercicio: string | null;
      empleadoCodigo: string | null;
      empleadoNombre: string | null;
      esPortada: boolean;
    }> = [];

    for (const seg of segments) {
      const chunk = pageTexts.slice(seg.pageFrom - 1, seg.pageTo).join('\n\n');
      const nombreExtraido = this.extractNombreFromPdfText(chunk);
      const ejercicio = this.extractEjercicioFromPdfText(chunk);
      let empleadoCodigo: string | null = null;
      let empleadoNombre: string | null = null;
      if (nombreExtraido) {
        const emp = await this.findEmpleadoByNombre(nombreExtraido);
        if (emp) {
          empleadoCodigo = emp.codigo;
          empleadoNombre = emp.nombreCompleto;
        }
      }
      const esPortada =
        seg.pageFrom === seg.pageTo &&
        this.isLikelyCoverPage(pageTexts[seg.pageFrom - 1]);

      certificados.push({
        pageFrom: seg.pageFrom,
        pageTo: seg.pageTo,
        segmentoId: `${seg.pageFrom}-${seg.pageTo}`,
        nombreExtraido,
        ejercicio,
        empleadoCodigo,
        empleadoNombre,
        esPortada,
      });
    }

    if (certificados.length === 0) {
      for (let i = 0; i < totalPages; i++) {
        const chunk = pageTexts[i];
        const nombreExtraido = this.extractNombreFromPdfText(chunk);
        const ejercicio = this.extractEjercicioFromPdfText(chunk);
        let empleadoCodigo: string | null = null;
        let empleadoNombre: string | null = null;
        if (nombreExtraido) {
          const emp = await this.findEmpleadoByNombre(nombreExtraido);
          if (emp) {
            empleadoCodigo = emp.codigo;
            empleadoNombre = emp.nombreCompleto;
          }
        }
        certificados.push({
          pageFrom: i + 1,
          pageTo: i + 1,
          segmentoId: `${i + 1}-${i + 1}`,
          nombreExtraido,
          ejercicio,
          empleadoCodigo,
          empleadoNombre,
          esPortada: this.isLikelyCoverPage(chunk),
        });
      }
    }

    this.logger.log(
      `📑 PDF compuesto: ${totalPages} páginas, ${certificados.length} segmentos (${estrategia})`,
    );

    return {
      success: true,
      totalPages,
      estrategia,
      certificados,
    };
  }

  /**
   * Confirma guardando trozos del mismo PDF compuesto.
   */
  async guardarPdfCompuestoCertificadosRetenciones(
    pdfBuffer: Buffer,
    seleccion: Array<{
      pageFrom: number;
      pageTo: number;
      empleadoCodigo: string;
      empleadoNombre: string;
      ejercicio?: string | null;
    }>,
    usuarioId: string,
  ): Promise<{ success: boolean; guardados: number; errores: number }> {
    const paraGuardar: Array<{
      nombreArchivo: string;
      empleadoCodigo: string;
      empleadoNombre: string;
      archivoBuffer: Buffer;
      notas: string | null;
    }> = [];

    for (const sel of seleccion) {
      if (
        !sel.empleadoCodigo ||
        sel.pageFrom < 1 ||
        sel.pageTo < sel.pageFrom
      ) {
        continue;
      }
      try {
        const sub = await this.extractPdfPageRange(
          pdfBuffer,
          sel.pageFrom,
          sel.pageTo,
        );
        const chunkText = (await this.extractTextPerPage(sub)).join('\n');
        const ej =
          sel.ejercicio?.trim() ||
          this.extractEjercicioFromPdfText(chunkText) ||
          null;
        const fileName =
          ej && /^\d{4}$/.test(ej)
            ? `retenciones_${ej}_p${sel.pageFrom}-${sel.pageTo}_${sel.empleadoCodigo}.pdf`
            : `retenciones_p${sel.pageFrom}-${sel.pageTo}_${sel.empleadoCodigo}.pdf`;
        const notas = ej ? `Ejercicio: ${ej}` : null;
        paraGuardar.push({
          nombreArchivo: fileName,
          empleadoCodigo: sel.empleadoCodigo,
          empleadoNombre: sel.empleadoNombre,
          archivoBuffer: sub,
          notas,
        });
      } catch (e: any) {
        this.logger.error(
          `❌ Error extrayendo páginas ${sel.pageFrom}-${sel.pageTo}: ${e?.message}`,
        );
      }
    }

    return this.guardarCertificadosRetenciones(paraGuardar, usuarioId);
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

      // Certificado: "Nombre Apellido1 Apellido2" — en BD a veces "Apellido1 Apellido2 Nombre"
      if (nombreWords.length >= 3) {
        const apellidosPrimero = [...nombreWords.slice(1), nombreWords[0]].join(
          ' ',
        );
        query = `
        SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
        FROM DatosEmpleados
        WHERE TRIM(UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '_', ' '), '  ', ' '))) = ${this.escapeSql(apellidosPrimero)}
        LIMIT 1
      `;
        result =
          await this.prisma.$queryRawUnsafe<
            Array<{ CODIGO: string; nombre: string }>
          >(query);
        if (result && result.length > 0) {
          this.logger.log(
            `✅ Exact match (orden apellidos+nombre) "${apellidosPrimero}": ${result[0].CODIGO}`,
          );
          return {
            codigo: result[0].CODIGO,
            nombreCompleto: result[0].nombre,
          };
        }
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

      this.logger.debug(`No match empleado for "${nombreNormalized}"`);
      return null;
    } catch (error: any) {
      this.logger.error(
        `❌ Error finding empleado by nombre "${nombre}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Procesează un ZIP cu PDF-uri de certificados de retenciones
   */
  async procesarZipCertificadosRetenciones(
    zipBuffer: Buffer,

    _usuarioId: string,
  ): Promise<{
    success: boolean;
    certificados: Array<{
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

      const certificados: Array<{
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

          certificados.push({
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
        `✅ ZIP procesado: ${certificados.length} certificados, ${errores.length} errores`,
      );

      return {
        success: true,
        certificados,
        errores,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error procesando ZIP certificados retenciones:`,
        error,
      );
      throw new BadRequestException(`Error procesando ZIP: ${error.message}`);
    }
  }

  /**
   * Procesează PDF-uri individuale (fără ZIP)
   */
  async procesarPdfCertificadosRetenciones(
    pdfs: Array<{ nombreArchivo: string; archivoBuffer: Buffer }>,

    _usuarioId: string,
  ): Promise<{
    success: boolean;
    certificados: Array<{
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
      const certificados: Array<{
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

          certificados.push({
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
        `✅ PDFs procesados: ${certificados.length} certificados, ${errores.length} errores`,
      );

      return {
        success: true,
        certificados,
        errores,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error procesando PDFs certificados retenciones:`,
        error,
      );
      throw new BadRequestException(`Error procesando PDFs: ${error.message}`);
    }
  }

  /**
   * Salvează certificados în baza de date
   */
  async guardarCertificadosRetenciones(
    certificados: Array<{
      nombreArchivo: string;
      empleadoCodigo: string;
      empleadoNombre: string;
      archivoBuffer: Buffer;
      notas?: string | null;
    }>,
    usuarioId: string,
  ): Promise<{
    success: boolean;
    guardados: number;
    errores: number;
  }> {
    let guardados = 0;
    let errores = 0;

    for (const c of certificados) {
      try {
        if (!c.empleadoCodigo) {
          this.logger.warn(
            `⚠️ Saltando certificado ${c.nombreArchivo} - sin empleadoCodigo`,
          );
          errores++;
          continue;
        }

        const nombreNormalizado = c.nombreArchivo
          .replace(/[^\w\s.-]/g, '_')
          .substring(0, 255);
        const notasSql =
          c.notas != null && String(c.notas).trim() !== ''
            ? this.escapeSql(String(c.notas).trim())
            : 'NULL';

        if (!this.certificadosStorage.isWriteEnabled()) {
          throw new BadRequestException(
            'R2 no está habilitado; no se pueden guardar certificados de retenciones',
          );
        }
        if (!c.archivoBuffer?.length) {
          throw new BadRequestException(
            `Certificado ${c.nombreArchivo} sin contenido`,
          );
        }

        const put = await this.certificadosStorage.putCertificadoPdf(
          c.archivoBuffer,
          c.empleadoCodigo,
          nombreNormalizado,
        );

        await this.prisma.$executeRawUnsafe(
          `
          INSERT INTO certificados_retenciones (
            empleado_id,
            nombre_empleado,
            nombre_archivo,
            subido_por,
            fecha_subida,
            notas,
            storage_key,
            storage_bucket,
            tamano_bytes
          )
          VALUES (
            ${this.escapeSql(c.empleadoCodigo)},
            ${this.escapeSql(c.empleadoNombre)},
            ${this.escapeSql(nombreNormalizado)},
            ${this.escapeSql(usuarioId)},
            CURRENT_TIMESTAMP,
            ${notasSql},
            ${this.escapeSql(put.storage_key)},
            ${this.escapeSql(put.storage_bucket)},
            ${put.tamano_bytes}
          )
          `,
        );

        guardados++;
        this.logger.log(
          `✅ Certificado guardado en R2: ${c.nombreArchivo} para empleado ${c.empleadoCodigo}`,
        );
      } catch (error: any) {
        this.logger.error(
          `❌ Error guardando certificado ${c.nombreArchivo}: ${error.message}`,
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

  /** Lista todos los certificados (admin) */
  async listarTodosLosCertificadosRetenciones(): Promise<
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
      const rows = await this.prisma.certificadoRetencion.findMany({
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

      return rows.map((d) => ({
        id: d.id,
        empleado_id: d.empleado_id,
        nombre_empleado: d.nombre_empleado,
        nombre_archivo: d.nombre_archivo,
        uploaded_by: d.subido_por,
        uploaded_at: d.fecha_subida,
      }));
    } catch (error: any) {
      this.logger.error(`❌ Error listando certificados retenciones:`, error);
      throw new BadRequestException(
        `Error listando certificados: ${error.message}`,
      );
    }
  }

  async listarCertificadosRetencionesEmpleado(empleadoId: string): Promise<
    Array<{
      id: number;
      nombre_archivo: string;
      fecha_subida: Date;
      subido_por: string;
      notas: string | null;
    }>
  > {
    try {
      return await this.prisma.$queryRawUnsafe<
        Array<{
          id: number;
          nombre_archivo: string;
          fecha_subida: Date;
          subido_por: string;
          notas: string | null;
        }>
      >(
        `
        SELECT id, nombre_archivo, fecha_subida, subido_por, notas
        FROM certificados_retenciones
        WHERE empleado_id = ${this.escapeSql(empleadoId)}
        ORDER BY fecha_subida DESC
        `,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando certificados empleado ${empleadoId}:`,
        error,
      );
      throw new BadRequestException(
        `Error listando certificados: ${error.message}`,
      );
    }
  }

  /**
   * Descarga PDF. Si empleadoId es null (admin), cualquier id válido.
   */
  async descargarCertificadoRetencion(
    certificadoId: number,
    empleadoId: string | null | undefined,
  ): Promise<{ archivo: Buffer; nombre_archivo: string }> {
    try {
      const andEmpleado =
        empleadoId != null && String(empleadoId).trim() !== ''
          ? ` AND empleado_id = ${this.escapeSql(String(empleadoId).trim())}`
          : '';
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          nombre_archivo: string;
          empleado_id: string;
          storage_key: string | null;
        }>
      >(
        `
        SELECT nombre_archivo, empleado_id, storage_key
        FROM certificados_retenciones
        WHERE id = ${certificadoId}${andEmpleado}
        LIMIT 1
        `,
      );

      if (!rows || rows.length === 0) {
        throw new BadRequestException(
          empleadoId != null
            ? `Certificado ${certificadoId} no encontrado o sin acceso`
            : `Certificado ${certificadoId} no encontrado`,
        );
      }

      const archivo = await this.certificadosStorage.resolveArchivo(rows[0]);

      return {
        archivo,
        nombre_archivo: rows[0].nombre_archivo,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error descargando certificado ${certificadoId}:`,
        error,
      );
      throw new BadRequestException(
        `Error descargando certificado: ${error.message}`,
      );
    }
  }
}
