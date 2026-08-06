import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as pdfParseModule from 'pdf-parse';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PortalDocumentsStorageService } from './portal-documents-storage.service';

const BATCH_TTL_MS = 45 * 60 * 1000;
const MAX_PAGES = 120;
const MAX_FILE_BYTES = 35 * 1024 * 1024;

type LoteBatch = {
  pages: Buffer[];
  expiresAt: number;
};

type FacturaMetaDetectadaDto = {
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  numeroFactura: string | null;
  /** Total con IVA, string decimal p.ej. "6140.75" */
  importe: string | null;
};

export type PageMatchDto = {
  pageIndex: number;
  cifDetectado: string | null;
  nombreDetectado: string | null;
  /** YYYY-MM-DD desde «Fecha factura» / «Fecha de emisión», etc. */
  fechaEmisionDetectada: string | null;
  fechaVencimientoDetectada: string | null;
  numeroFacturaDetectado: string | null;
  importeDetectado: string | null;
  textoMuestra: string;
  clienteSugerido: {
    id: number;
    nif: string | null;
    nombre: string | null;
    score: number;
  } | null;
  nombreCoincide: boolean | null;
};

/** Normaliza NIF/CIF para comparar (sin prefijo ES, mayúsculas). */
function normalizeDocId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).toUpperCase().replace(/\s+/g, '');
  if (s.startsWith('ES')) s = s.slice(2);
  return s.length >= 8 ? s : null;
}

/** CIF/NIF/NIE en orden de aparición (con índice) para priorizar receptor. */
function extractDocIdsInOrder(text: string): { id: string; index: number }[] {
  const t = text.replace(/\u00a0/g, ' ');
  const hits: { id: string; index: number }[] = [];
  const patterns: RegExp[] = [
    /\b(?:ES)?([ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J])\b/gi,
    /\b(\d{8}[A-Z])\b/gi,
    /\b([XYZ]\d{7}[A-Z])\b/gi,
  ];
  for (const re of patterns) {
    const r = new RegExp(
      re.source,
      re.flags.includes('g') ? re.flags : `${re.flags}g`,
    );
    let m: RegExpExecArray | null;
    while ((m = r.exec(t)) !== null) {
      hits.push({ id: m[1].toUpperCase(), index: m.index });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * Cabecera típica emisor + receptor antes de la tabla (evita CIF repetido del pie).
 */
function sliceTextBeforeFacturaTable(text: string): string {
  const m = /\bFACTURA\b/i.exec(text);
  if (m && m.index > 40) return text.slice(0, m.index);
  return text;
}

function ymdToIso(y: number, mo: number, d: number): string | null {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
    return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd (y 2 dígitos de año). */
function parseFechaFacturaToken(raw: string): string | null {
  const s = raw.replace(/\s+/g, '').trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    return ymdToIso(y, mo, d);
  }
  m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return ymdToIso(y, mo, d);
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    y += y <= 50 ? 2000 : 1900;
    return ymdToIso(y, mo, d);
  }
  return null;
}

/**
 * Fecha de la factura en cabecera (Contasimple: «Fecha factura: 01/01/2026»).
 */
function extractFechaEmisionFromText(text: string): string | null {
  const t = text.replace(/\u00a0/g, ' ');
  const head = sliceTextBeforeFacturaTable(t);
  const probe = head.length > 30 ? head : t;
  const patterns: RegExp[] = [
    /fecha\s+de\s+factura\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
    /fecha\s+factura\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
    /fecha\s+de\s+emis[ií]on\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
    /fecha\s+emis[ií]on\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
  ];
  for (const re of patterns) {
    const mm = re.exec(probe);
    if (mm?.[1]) {
      const iso = parseFechaFacturaToken(mm[1]);
      if (iso) return iso;
    }
  }
  return null;
}

function extractNumeroFacturaFromText(text: string): string | null {
  const t = text.replace(/\u00a0/g, ' ');
  const re = /n[uú]mero\s+de\s+factura\s*[:\s]+\s*(\S+)/i;
  const m = re.exec(t);
  if (m?.[1]) {
    const v = m[1].trim();
    if (v.length >= 2 && v.length <= 100) return v;
  }
  return null;
}

function extractFechaVencimientoFromText(text: string): string | null {
  const t = text.replace(/\u00a0/g, ' ');
  const patterns: RegExp[] = [
    /fecha\s+de\s+vencimiento\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
    /fecha\s+vencimiento\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
    /vencimiento\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
    /vto\.?\s*[:\s]+\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})/i,
  ];
  for (const re of patterns) {
    const mm = re.exec(t);
    if (mm?.[1]) {
      const iso = parseFechaFacturaToken(mm[1]);
      if (iso) return iso;
    }
  }
  return null;
}

/**
 * Total TTC típico en facturas ES: «TOTAL: 6.140,75 €».
 */
function extractImporteTotalFromText(text: string): string | null {
  const t = text.replace(/\u00a0/g, ' ');
  const patterns: RegExp[] = [
    /TOTAL\s*[:\s]+\s*([\d][\d.\s]*,\d{2})\s*(?:€|EUR)?/i,
    /total\s+a\s+pagar\s*[:\s]+\s*([\d][\d.\s]*,\d{2})\s*(?:€|EUR)?/i,
    /importe\s+total\s*[:\s]+\s*([\d][\d.\s]*,\d{2})\s*(?:€|EUR)?/i,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m?.[1]) {
      const raw = m[1].replace(/\./g, '').replace(/\s/g, '').replace(',', '.');
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0 && n < 1e10) return n.toFixed(2);
    }
  }
  return null;
}

function extractMetadatosFacturaDesdeTexto(
  text: string,
): FacturaMetaDetectadaDto {
  return {
    fechaEmision: extractFechaEmisionFromText(text),
    fechaVencimiento: extractFechaVencimientoFromText(text),
    numeroFactura: extractNumeroFacturaFromText(text),
    importe: extractImporteTotalFromText(text),
  };
}

const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function mesNombreEspanol(d: Date): string {
  return MESES_ES[d.getMonth()] || 'Mes';
}

/** Fragmento seguro para nombre de archivo (ASCII aprox., sin espacios raros). */
function slugNombreClienteArchivo(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'Cliente';
  let t = String(raw).normalize('NFD').replace(/\p{M}/gu, '');
  t = t
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!t.length) return 'Cliente';
  return t.slice(0, 90);
}

/** p.ej. `Enero_COMUNIDAD_DE_PROPIETARIOS_LOS_PINOS` (sin extensión). */
function baseNombreArchivoFacturaLote(
  fechaEmision: Date,
  razonSocial: string | null | undefined,
): string {
  return `${mesNombreEspanol(fechaEmision)}_${slugNombreClienteArchivo(razonSocial)}`;
}

function trimStr(v: unknown): string | undefined {
  const s = String(v ?? '').trim();
  return s.length ? s : undefined;
}

function parseDateOnlyFromIso(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseImporteToDecimal(raw: string): Prisma.Decimal | null {
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  if (/^\d+(\.\d{1,2})?$/.test(s)) {
    const v = Number(s);
    if (!Number.isFinite(v) || v <= 0) return null;
    return new Prisma.Decimal(v.toFixed(2));
  }
  if (s.includes(',') && /\.\d{3}/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) return null;
  return new Prisma.Decimal(v.toFixed(2));
}

/** Heurística: línea tras "razón social", "cliente", "denominación" o la más larga tipo empresa. */
function extractNombreHeuristic(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 3);
  const keys = [
    /raz[oó]n\s+social\s*[:\s]+\s*(.+)/i,
    /denominaci[oó]n\s*[:\s]+\s*(.+)/i,
    /cliente\s*[:\s]+\s*(.+)/i,
    /nombre\s+fiscal\s*[:\s]+\s*(.+)/i,
  ];
  for (const re of keys) {
    const mm = re.exec(text);
    if (mm?.[1]) {
      const v = mm[1].split('\n')[0].trim();
      if (v.length > 2 && v.length < 400) return v;
    }
  }
  // línea larga que parezca razón social (sin solo números)
  const candidates = lines
    .filter((l) => l.length >= 8 && l.length <= 200)
    .filter((l) => !/^\d+([.,]\d+)?$/.test(l))
    .filter((l) => !/^\d{1,2}[-/]\d{1,2}/.test(l));
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || null;
}

function normalizeNombreCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreNombreMatch(
  detectado: string | null,
  razonDb: string | null,
): { score: number; coincide: boolean | null } {
  if (!detectado || !razonDb) return { score: 0, coincide: null };
  const a = normalizeNombreCompare(detectado);
  const b = normalizeNombreCompare(razonDb);
  if (!a.length || !b.length) return { score: 0, coincide: null };
  if (a === b) return { score: 100, coincide: true };
  if (b.includes(a) || a.includes(b)) return { score: 85, coincide: true };
  const wordsA = new Set(a.split(' ').filter((w) => w.length > 2));
  const wordsB = b.split(' ').filter((w) => w.length > 2);
  if (!wordsB.length) return { score: 0, coincide: null };
  let hit = 0;
  for (const w of wordsB) {
    if (wordsA.has(w)) hit++;
  }
  const ratio = hit / wordsB.length;
  if (ratio >= 0.5)
    return { score: Math.round(50 + ratio * 40), coincide: ratio >= 0.66 };
  return { score: Math.round(ratio * 40), coincide: false };
}

@Injectable()
export class PortalFacturasLoteService {
  private readonly logger = new Logger(PortalFacturasLoteService.name);
  private readonly batches = new Map<string, LoteBatch>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly portalDocsStorage: PortalDocumentsStorageService,
  ) {
    const iv = setInterval(() => this.purgeExpired(), 5 * 60 * 1000);
    if (typeof (iv as any).unref === 'function') (iv as any).unref();
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [id, b] of this.batches) {
      if (b.expiresAt < now) this.batches.delete(id);
    }
  }

  private async splitPdfToPages(buffer: Buffer): Promise<Buffer[]> {
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const n = src.getPageCount();
    if (n < 1) throw new BadRequestException('PDF sin páginas');
    if (n > MAX_PAGES) {
      throw new BadRequestException(
        `El PDF tiene demasiadas páginas (${n}). Máximo ${MAX_PAGES}.`,
      );
    }
    const out: Buffer[] = [];
    for (let i = 0; i < n; i++) {
      const doc = await PDFDocument.create();
      const [copied] = await doc.copyPages(src, [i]);
      doc.addPage(copied);
      out.push(Buffer.from(await doc.save()));
    }
    return out;
  }

  /** Texto por página del PDF completo (mismo enfoque que certificados-retenciones). */
  private async extractTextPerPage(pdfBuffer: Buffer): Promise<string[]> {
    const PDFParse = (pdfParseModule as any).PDFParse;
    if (!PDFParse) {
      const data = await (pdfParseModule as any)(pdfBuffer);
      const full = data?.text || '';
      if (full.includes('\f')) {
        return full.split('\f').map((x: string) => x.trim());
      }
      const np = Math.max(1, Number(data?.numpages) || 1);
      return Array.from({ length: np }, () => full);
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
      if (total < 1) throw new Error('PDF sin páginas');
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
        `extractTextPerPage partial falló (${e?.message}), fallback`,
      );
      const data = await (pdfParseModule as any)(pdfBuffer);
      const full = data?.text || '';
      if (full.includes('\f')) {
        return full.split('\f').map((x: string) => x.trim());
      }
      const np = Math.max(1, Number(data?.numpages) || 1);
      return Array.from({ length: np }, () => full);
    } finally {
      try {
        await pdfInstance?.destroy?.();
      } catch {
        /* ignore */
      }
    }
  }

  async analizarPdf(
    buffer: Buffer,
  ): Promise<{ batchId: string; pages: PageMatchDto[] }> {
    if (!buffer?.length) throw new BadRequestException('Archivo vacío');
    if (buffer.length > MAX_FILE_BYTES) {
      throw new BadRequestException(
        `Archivo demasiado grande (máx. ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB)`,
      );
    }
    const pages = await this.splitPdfToPages(buffer);
    const texts = await this.extractTextPerPage(buffer);
    if (texts.length !== pages.length) {
      this.logger.warn(
        `Páginas texto (${texts.length}) ≠ split (${pages.length}); se alinea por índice mínimo`,
      );
    }

    const clientes = await this.prisma.clientes.findMany({
      where: { NIF: { not: null } },
      select: { id: true, NIF: true, NOMBRE_O_RAZON_SOCIAL: true },
    });
    const byNif = new Map<string, (typeof clientes)[0]>();
    for (const c of clientes) {
      const k = normalizeDocId(c.NIF);
      if (k) byNif.set(k, c);
    }

    const n = Math.min(pages.length, texts.length || pages.length);
    const pageDtos: PageMatchDto[] = [];

    for (let i = 0; i < n; i++) {
      const text = texts[i] || '';
      const muestra = text.replace(/\s+/g, ' ').trim().slice(0, 280);
      const head = sliceTextBeforeFacturaTable(text);
      let ordered = extractDocIdsInOrder(head);
      if (!ordered.length) ordered = extractDocIdsInOrder(text);

      let cifDetectado: string | null = null;
      let clienteSugerido: PageMatchDto['clienteSugerido'] = null;
      // Receptor suele ir después del emisor: el último NIF/CIF antes de "FACTURA" encaja con PARA IMPRIMIR / Contasimple.
      for (let j = ordered.length - 1; j >= 0; j--) {
        const raw = ordered[j].id;
        const norm = normalizeDocId(raw);
        if (!norm) continue;
        const hit = byNif.get(norm);
        if (hit) {
          cifDetectado = hit.NIF || raw;
          clienteSugerido = {
            id: hit.id,
            nif: hit.NIF,
            nombre: hit.NOMBRE_O_RAZON_SOCIAL,
            score: 100,
          };
          break;
        }
      }
      if (!cifDetectado && ordered.length) {
        cifDetectado = ordered[ordered.length - 1].id;
      }
      const meta = extractMetadatosFacturaDesdeTexto(text);
      const fechaEmisionDetectada = meta.fechaEmision;
      const nombreDetectado = extractNombreHeuristic(text);
      let nombreCoincide: boolean | null = null;
      if (clienteSugerido && nombreDetectado) {
        const { score, coincide } = scoreNombreMatch(
          nombreDetectado,
          clienteSugerido.nombre,
        );
        clienteSugerido = {
          ...clienteSugerido,
          score: Math.max(clienteSugerido.score, score),
        };
        nombreCoincide = coincide;
      } else if (!clienteSugerido && nombreDetectado) {
        let best: (typeof clientes)[0] | null = null;
        let bestScore = 0;
        for (const c of clientes) {
          const { score } = scoreNombreMatch(
            nombreDetectado,
            c.NOMBRE_O_RAZON_SOCIAL,
          );
          if (score > bestScore) {
            bestScore = score;
            best = c;
          }
        }
        if (best && bestScore >= 70) {
          clienteSugerido = {
            id: best.id,
            nif: best.NIF,
            nombre: best.NOMBRE_O_RAZON_SOCIAL,
            score: bestScore,
          };
          nombreCoincide = bestScore >= 85;
        }
      }

      pageDtos.push({
        pageIndex: i,
        cifDetectado,
        nombreDetectado,
        fechaEmisionDetectada,
        fechaVencimientoDetectada: meta.fechaVencimiento,
        numeroFacturaDetectado: meta.numeroFactura,
        importeDetectado: meta.importe,
        textoMuestra: muestra,
        clienteSugerido,
        nombreCoincide,
      });
    }

    const batchId = randomUUID();
    this.batches.set(batchId, {
      pages,
      expiresAt: Date.now() + BATCH_TTL_MS,
    });

    return { batchId, pages: pageDtos };
  }

  getPagePreview(
    batchId: string,
    pageIndex: number,
  ): { buffer: Buffer; mime: string } {
    const batch = this.batches.get(batchId);
    if (!batch || batch.expiresAt < Date.now()) {
      throw new NotFoundException(
        'Lote expirado o inexistente. Vuelve a analizar el PDF.',
      );
    }
    const buf = batch.pages[pageIndex];
    if (!buf) throw new NotFoundException('Página no encontrada');
    return { buffer: buf, mime: 'application/pdf' };
  }

  async confirmarLote(
    batchId: string,
    body: {
      assignments: {
        pageIndex: number;
        cliente_id: number;
        fecha_emision?: string;
        fecha_vencimiento?: string;
        importe?: string;
        numero_factura?: string;
      }[];
      /** Respaldo si alguna fila no envía fecha_emision */
      fecha_emision?: string;
    },
  ): Promise<{ created: number; ids: number[] }> {
    const batch = this.batches.get(batchId);
    if (!batch || batch.expiresAt < Date.now()) {
      throw new NotFoundException(
        'Lote expirado o inexistente. Vuelve a analizar el PDF.',
      );
    }
    const fallbackRaw = String(body.fecha_emision || '').trim();
    const fallbackFe = fallbackRaw ? new Date(fallbackRaw) : null;
    if (fallbackRaw && Number.isNaN(fallbackFe!.getTime())) {
      throw new BadRequestException(
        'fecha_emision inválida (use ISO YYYY-MM-DD)',
      );
    }
    const fallbackDate =
      fallbackFe && !Number.isNaN(fallbackFe.getTime())
        ? new Date(
            fallbackFe.getFullYear(),
            fallbackFe.getMonth(),
            fallbackFe.getDate(),
          )
        : null;
    const assignments = body.assignments || [];
    if (!assignments.length) {
      throw new BadRequestException('assignments vacío');
    }

    const ids: number[] = [];
    const nombreArchivoCounts = new Map<string, number>();

    for (const a of assignments) {
      const idx = Number(a.pageIndex);
      const clienteId = Number(a.cliente_id);
      if (!Number.isInteger(idx) || idx < 0 || idx >= batch.pages.length) {
        throw new BadRequestException(`pageIndex inválido: ${a.pageIndex}`);
      }
      if (!Number.isInteger(clienteId) || clienteId < 1) {
        throw new BadRequestException(`cliente_id inválido: ${a.cliente_id}`);
      }
      const cliente = await this.prisma.clientes.findUnique({
        where: { id: clienteId },
        select: { id: true, NOMBRE_O_RAZON_SOCIAL: true },
      });
      if (!cliente)
        throw new BadRequestException(`Cliente no existe: ${clienteId}`);

      const rowFechaRaw = String(a.fecha_emision ?? '').trim();
      const rowFe = rowFechaRaw ? new Date(rowFechaRaw) : null;
      let fechaEmision: Date;
      if (rowFechaRaw && rowFe && !Number.isNaN(rowFe.getTime())) {
        fechaEmision = new Date(
          rowFe.getFullYear(),
          rowFe.getMonth(),
          rowFe.getDate(),
        );
      } else if (fallbackDate) {
        fechaEmision = fallbackDate;
      } else {
        throw new BadRequestException(
          `fecha_emision faltante o inválida para pageIndex ${idx} (use YYYY-MM-DD por fila o fecha_emision global)`,
        );
      }

      const archivo = batch.pages[idx];
      const pageTexts = await this.extractTextPerPage(archivo);
      const pageText = pageTexts[0] || '';
      const meta = extractMetadatosFacturaDesdeTexto(pageText);

      const numero_factura =
        trimStr(a.numero_factura) ?? meta.numeroFactura ?? null;

      let fecha_vencimiento: Date | null = null;
      const fvChosen =
        trimStr(a.fecha_vencimiento) ?? meta.fechaVencimiento ?? undefined;
      if (fvChosen) {
        const fd = parseDateOnlyFromIso(fvChosen);
        if (fd) fecha_vencimiento = fd;
      }

      let totalImporte: Prisma.Decimal | null = null;
      const impChosen = trimStr(a.importe) ?? meta.importe ?? undefined;
      if (impChosen) {
        totalImporte = parseImporteToDecimal(impChosen);
      }

      const baseNombre = baseNombreArchivoFacturaLote(
        fechaEmision,
        cliente.NOMBRE_O_RAZON_SOCIAL,
      );
      const countKey = baseNombre.toLowerCase();
      const n = (nombreArchivoCounts.get(countKey) || 0) + 1;
      nombreArchivoCounts.set(countKey, n);
      const nombre_archivo =
        n > 1 ? `${baseNombre}_${n}.pdf` : `${baseNombre}.pdf`;

      if (!this.portalDocsStorage.isWriteEnabled()) {
        throw new ServiceUnavailableException(
          'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
        );
      }
      const put = await this.portalDocsStorage.putFactura(
        archivo,
        clienteId,
        nombre_archivo,
        'application/pdf',
      );

      try {
        const row = await this.prisma.clienteFacturaManual.create({
          data: {
            cliente_id: clienteId,
            nombre_archivo,
            mime_type: 'application/pdf',
            storage_key: put.storage_key,
            storage_bucket: put.storage_bucket,
            tamano_bytes: put.tamano_bytes,
            fecha_emision: fechaEmision,
            fecha_vencimiento,
            numero_factura,
            importe: totalImporte,
            estado: 'activo',
            observaciones: `import_pdf_lote:${batchId};page:${idx}`,
          },
        });
        ids.push(row.id);
      } catch (err) {
        await this.portalDocsStorage.deleteObjectIfAny(put.storage_key);
        throw err;
      }
    }

    this.batches.delete(batchId);
    return { created: ids.length, ids };
  }
}
