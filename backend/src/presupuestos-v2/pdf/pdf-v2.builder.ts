import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { formatJornadaLines } from '../emit/jornada.util';
import { applyDescuentoFidelidadToTotales } from '../emit/descuento-fidelidad.util';
import { normalizeTotales } from '../emit/totales.util';

export type PdfV2BuildInput = {
  mode: 'BORRADOR' | 'EMITIDO';
  numero: string | null;
  emittedAt: string | null;
  /** Commercial validity; Legacy presupuesto uses 60. */
  validezDias?: number | null;
  /** Raw logo bytes from R2 (preferred over filesystem path). */
  logoBuffer?: Buffer | null;
  company: Record<string, any>;
  brand: Record<string, any>;
  cliente: Record<string, any> | null;
  lineas: Array<{
    nombre: string;
    descripcion?: string | null;
    codigo_motor?: string;
    inputs?: Record<string, any>;
    contenido_comercial?: {
      titulo_comercial?: string | null;
      descripcion_comercial?: string | null;
      operativa?: string[];
      tareas?: string[];
      tareas_auxiliares?: string[];
      tareas_limpieza?: string[];
      servicios_periodicos?: Array<{
        nombre: string;
        periodicidad?: string;
        descripcion?: string | null;
        orden?: number;
      }>;
      condiciones_especificas?: string[];
      imagen_ref?: string | null;
      periodicidad?: string | null;
      template_key?: string | null;
    } | null;
    totales?: {
      mensualidad_sin_iva?: number;
      mensualidad_con_iva?: number;
      anualidad_sin_iva?: number;
      anualidad_con_iva?: number;
    };
    resultado?: Record<string, any>;
    opciones?: Array<{
      etiqueta?: string;
      seleccion_tipo?: string;
      descripcion_local?: string | null;
      jornada?: {
        horas_semana?: number | null;
        festivos_incluidos?: boolean;
        observacion?: string | null;
        tramos?: Array<{
          dias_label?: string;
          dias?: string[];
          hora_inicio?: string;
          hora_fin?: string;
        }>;
      } | null;
      inputs?: Record<string, any>;
      totales?: {
        mensualidad_sin_iva?: number;
        mensualidad_con_iva?: number;
        anualidad_sin_iva?: number;
        anualidad_con_iva?: number;
      };
      resultado?: Record<string, any>;
    }>;
  }>;
  totales: {
    mensualidad_sin_iva: number;
    mensualidad_con_iva: number;
    anualidad_sin_iva: number;
    anualidad_con_iva: number;
  };
  /** When true, document has exclusive alternatives — do not imply a single global total. */
  totalesAmbiguo?: boolean;
  /** Legacy «Descuento por fidelidad» % (0–100). Applied per opción in economic table. */
  descuentoFidelidadPct?: number;
  /** Pre-discount document totals (optional; for footer note). */
  totalesBrutos?: {
    mensualidad_sin_iva: number;
    mensualidad_con_iva: number;
    anualidad_sin_iva: number;
    anualidad_con_iva: number;
  } | null;
  serviciosDigitales?: Array<{
    nombre: string;
    precio_referencia_mensual: number;
    descuento_pct: number;
    precio_final_mensual: number;
    incluido: boolean;
    descripcion?: string | null;
    activo?: boolean;
  }>;
  /** Commercial condition bullets (no internal architecture text). */
  condiciones?: string[];
};

export type PdfOpcionRow = NonNullable<
  PdfV2BuildInput['lineas'][0]['opciones']
>[0];

export type PdfOpcionSection = {
  /** Client-facing heading; null = no section title (single option). */
  heading: 'Elija una opción' | 'Extras opcionales' | null;
  /** Prefix '+' for optional extras prices. */
  pricePrefix: '' | '+';
  opciones: PdfOpcionRow[];
  showLabels: boolean;
};

/**
 * Commercial PDF grouping for opciones (no EXCLUSIVE/ACUMULABLE jargon).
 */
export function groupOpcionesForPdfPresentation(
  opciones: PdfOpcionRow[],
): PdfOpcionSection[] {
  if (!opciones.length) return [];
  if (opciones.length === 1) {
    return [
      {
        heading: null,
        pricePrefix: '',
        opciones,
        showLabels: false,
      },
    ];
  }

  const alternativas = opciones.filter(
    (o) => String(o.seleccion_tipo || '').toUpperCase() === 'EXCLUSIVE',
  );
  const extras = opciones.filter(
    (o) => String(o.seleccion_tipo || '').toUpperCase() !== 'EXCLUSIVE',
  );

  const sections: PdfOpcionSection[] = [];
  if (alternativas.length) {
    sections.push({
      heading: 'Elija una opción',
      pricePrefix: '',
      opciones: alternativas,
      showLabels: true,
    });
  }
  if (extras.length) {
    sections.push({
      heading: 'Extras opcionales',
      pricePrefix: '+',
      opciones: extras,
      showLabels: true,
    });
  }
  return sections;
}

function money(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveLogoPath(logoRef?: string | null): string | null {
  const candidates: string[] = [];
  if (logoRef) {
    if (path.isAbsolute(logoRef)) candidates.push(logoRef);
    candidates.push(path.join(process.cwd(), 'assets', logoRef));
    candidates.push(path.join(process.cwd(), logoRef));
  }
  for (const name of ['logo.png', 'logo.jpg', 'logo.jpeg']) {
    candidates.push(path.join(process.cwd(), 'assets', name));
  }
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p) && /\.(png|jpe?g)$/i.test(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Client-facing service configuration lines (never costs / margins / motor codes). */
function commercialConfigLines(linea: PdfV2BuildInput['lineas'][0]): string[] {
  const i = linea.inputs || {};
  const bits: string[] = [];
  if (i.numOperarias != null && i.numOperarias !== '') {
    bits.push(
      `${i.numOperarias} ${Number(i.numOperarias) === 1 ? 'operaria' : 'operarias'}`,
    );
  }
  if (i.horasPorDiaPorOperaria != null && i.horasPorDiaPorOperaria !== '') {
    bits.push(`${i.horasPorDiaPorOperaria} horas/día`);
  }
  if (i.horasDiarias != null && i.horasDiarias !== '') {
    bits.push(`${i.horasDiarias} horas/día`);
  }
  if (i.diasLaborablesSemana != null && i.diasLaborablesSemana !== '') {
    bits.push(`${i.diasLaborablesSemana} días laborables/semana`);
  }
  if (i.diasPorSemana != null && i.diasPorSemana !== '') {
    bits.push(`${i.diasPorSemana} días/semana`);
  }
  if (i.horasACubrirPorSemana != null && i.horasACubrirPorSemana !== '') {
    bits.push(`${i.horasACubrirPorSemana} h a cubrir/semana`);
  }
  if (i.concepto) bits.push(String(i.concepto));
  if (i.horas) bits.push(`${i.horas} h`);
  if (i.dias) bits.push(String(i.dias));
  if (linea.descripcion) bits.push(String(linea.descripcion));
  const resDesc = linea.resultado?.descripcion;
  if (resDesc && !bits.includes(String(resDesc))) bits.push(String(resDesc));
  return bits;
}

function defaultCondiciones(
  mode: 'BORRADOR' | 'EMITIDO',
  validezDias: number | null | undefined,
): string[] {
  const lines: string[] = [];
  if (mode === 'BORRADOR') {
    lines.push(
      'Este documento es un borrador informativo y no constituye oferta vinculante ni documento oficial.',
    );
  }
  if (validezDias != null && Number(validezDias) > 0) {
    lines.push(
      `El presupuesto tiene una validez de ${Number(validezDias)} días desde su emisión.`,
    );
  }
  lines.push(
    'Los importes se indican en euros. El IVA aplicable se desglosa en la propuesta económica.',
  );
  lines.push(
    'La prestación del servicio quedará sujeta a la formalización del contrato correspondiente y a las condiciones particulares acordadas.',
  );
  lines.push(
    'Cualquier modificación de horarios, frecuencias o alcance podrá requerir una revisión de la oferta.',
  );
  return lines;
}

/**
 * Presupuestos V2 PDF — commercial document inspired by Legacy portada/oferta,
 * built on V2 snapshots/architecture (not a copy of Legacy code).
 */
export async function buildPresupuestoV2Pdf(
  input: PdfV2BuildInput,
): Promise<Buffer> {
  const brandCfg = (input.brand?.config || {}) as Record<string, any>;
  const brandColor = String(
    brandCfg.portadaBg ||
      brandCfg.brandColor ||
      brandCfg.brand_color ||
      input.company?.brand_color ||
      '#B91C1C',
  );
  const portadaText = String(
    brandCfg.portadaTextColor || brandCfg.portada_text_color || '#FFFFFF',
  );
  const logoPath = resolveLogoPath(
    input.brand?.logo_ref || input.company?.logo_ref || null,
  );
  const logoSrc = input.logoBuffer || logoPath;

  const validez =
    input.validezDias != null
      ? Number(input.validezDias)
      : brandCfg.validez_dias != null
        ? Number(brandCfg.validez_dias)
        : 60;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 56, left: 48, right: 48 },
    bufferPages: true,
    info: {
      Title:
        input.mode === 'EMITIDO'
          ? `Presupuesto ${input.numero || ''}`
          : 'Presupuesto (borrador)',
      Author: String(input.brand?.nombre || input.company?.legal_name || ''),
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const contentW = pageW - left - right;

  let pageNo = 0; // content pages only (portada excluded from numbering)
  let paintingChrome = false;
  let onContent = false;

  const drawWatermark = () => {
    if (input.mode !== 'BORRADOR') return;
    doc.save();
    try {
      doc.fillColor('#DC2626').opacity(0.08);
      doc.font('Helvetica-Bold').fontSize(64);
      // Single-line watermark — avoid mid-word wrap ("BORRAD"/"OR")
      doc.rotate(-28, { origin: [pageW / 2, pageH / 2] });
      doc.text('BORRADOR', 0, pageH / 2 - 28, {
        width: pageW,
        align: 'center',
        lineBreak: false,
      });
    } finally {
      doc.restore();
      doc.fillColor('#111827').opacity(1);
    }
  };

  const drawFooter = () => {
    if (paintingChrome || !onContent) return;
    paintingChrome = true;
    try {
      const y = pageH - 40;
      const legal = [
        input.brand?.nombre || input.company?.legal_name,
        input.company?.cif ? `CIF ${input.company.cif}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 95);
      doc
        .fontSize(7)
        .fillColor('#6B7280')
        .text(legal, left, y, {
          width: contentW - 70,
          align: 'left',
          lineBreak: false,
        });
      if (pageNo > 0) {
        doc.text(`Pág. ${pageNo}`, left, y, {
          width: contentW,
          align: 'right',
          lineBreak: false,
        });
      }
      drawWatermark();
      doc.fillColor('#111827').opacity(1);
    } finally {
      paintingChrome = false;
    }
  };

  const drawHeaderMini = () => {
    if (paintingChrome || !onContent) return;
    paintingChrome = true;
    try {
      doc
        .moveTo(left, 28)
        .lineTo(pageW - right, 28)
        .strokeColor(brandColor)
        .lineWidth(2)
        .stroke();
      doc
        .fontSize(9)
        .fillColor('#374151')
        .text(
          input.mode === 'EMITIDO'
            ? `Presupuesto ${input.numero || ''}`
            : 'Presupuesto — borrador (no oficial)',
          left,
          14,
          { width: contentW, align: 'right', lineBreak: false },
        );
      doc.fillColor('#111827');
      doc.y = Math.max(doc.y, 42);
    } finally {
      paintingChrome = false;
    }
  };

  const newContentPage = () => {
    doc.addPage();
    onContent = true;
    pageNo += 1;
    drawHeaderMini();
    drawFooter();
  };

  function ensureSpaceLocal(need: number, marginBottom = 72): void {
    if (doc.y + need > pageH - marginBottom) {
      newContentPage();
    }
  }

  // ——— PORTADA (Legacy commercial concept) ———
  doc.rect(0, 0, pageW, pageH).fill(brandColor);
  const anio = input.emittedAt
    ? new Date(input.emittedAt).getFullYear()
    : new Date().getFullYear();
  doc.fillColor(portadaText).font('Helvetica-Bold').fontSize(32);
  doc.text(`PRESUPUESTO ${anio}`, 0, 48, {
    width: pageW,
    align: 'center',
  });

  const lineW = Math.min(280, pageW - 80);
  const lineY = 95;
  doc
    .strokeColor(portadaText)
    .lineWidth(2)
    .moveTo((pageW - lineW) / 2, lineY)
    .lineTo((pageW + lineW) / 2, lineY)
    .stroke();

  const serviciosTitulo =
    input.lineas.length > 0
      ? `SERVICIO DE ${input.lineas
          .map((l) => String(l.nombre || '').toUpperCase())
          .filter(Boolean)
          .join(', ')}`
      : 'SERVICIOS PRESUPUESTADOS';
  doc.font('Helvetica').fontSize(13);
  doc.text(serviciosTitulo, 40, lineY + 16, {
    width: pageW - 80,
    align: 'center',
  });

  let yCursor = lineY + 70;
  if (logoSrc) {
    try {
      doc.image(logoSrc as any, (pageW - 160) / 2, yCursor, {
        fit: [160, 80],
        align: 'center',
      });
      yCursor += 100;
    } catch {
      yCursor += 20;
    }
  }

  const brandName = String(input.brand?.nombre || '');
  if (brandName) {
    doc.font('Helvetica-Bold').fontSize(16);
    doc.text(brandName, 40, yCursor, { width: pageW - 80, align: 'center' });
    yCursor += 28;
  }

  const c = input.cliente || {};
  const clienteNombre = String(c.nombre || 'Cliente pendiente de asignar');
  doc.font('Helvetica-Bold').fontSize(14);
  doc.text(clienteNombre, 50, yCursor, { width: pageW - 100, align: 'center' });
  yCursor += 22;
  doc.font('Helvetica').fontSize(11);
  const addr = [
    c.direccion_servicio || c.direccion,
    [c.codigo_postal, c.poblacion].filter(Boolean).join(' '),
    c.provincia,
  ]
    .filter(Boolean)
    .join(' · ');
  if (addr) {
    doc.text(addr, 50, yCursor, { width: pageW - 100, align: 'center' });
    yCursor += 18;
  }
  if (c.nif) {
    doc.text(`CIF/NIF: ${c.nif}`, 50, yCursor, {
      width: pageW - 100,
      align: 'center',
    });
    yCursor += 22;
  } else {
    yCursor += 8;
  }

  doc.font('Helvetica-Bold').fontSize(13);
  const numLabel =
    input.mode === 'EMITIDO' && input.numero
      ? `PRESUPUESTO Nº ${input.numero}`
      : 'PRESUPUESTO — BORRADOR';
  doc.text(numLabel, 50, yCursor, { width: pageW - 100, align: 'center' });
  yCursor += 20;
  doc
    .strokeColor(portadaText)
    .lineWidth(1)
    .moveTo(pageW / 2 - 90, yCursor)
    .lineTo(pageW / 2 + 90, yCursor)
    .stroke();
  yCursor += 14;
  doc.font('Helvetica').fontSize(11);
  const fechaTxt =
    input.mode === 'EMITIDO' && input.emittedAt
      ? `Fecha de emisión: ${new Date(input.emittedAt).toLocaleDateString(
          'es-ES',
          {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          },
        )}`
      : 'Documento no oficial · sin número asignado';
  doc.text(fechaTxt, 50, yCursor, { width: pageW - 100, align: 'center' });
  if (validez > 0 && input.mode === 'EMITIDO') {
    yCursor += 16;
    doc.text(`Validez: ${validez} días`, 50, yCursor, {
      width: pageW - 100,
      align: 'center',
    });
  }

  // Contact footer on portada (no duplicate legal name / CIF clutter)
  const contactBits = [
    brandCfg.phone || input.company?.phone,
    brandCfg.email || input.company?.email,
    brandCfg.website || input.company?.website,
  ].filter(Boolean);
  doc.fontSize(10).fillColor(portadaText);
  doc.text(contactBits.join('  ·  '), 40, pageH - 56, {
    width: pageW - 80,
    align: 'center',
    lineGap: 2,
  });

  if (input.mode === 'BORRADOR') {
    doc.save();
    doc.fillColor(portadaText).opacity(0.25);
    doc.fontSize(48);
    doc.rotate(-28, { origin: [pageW / 2, pageH / 2] });
    doc.text('BORRADOR', pageW / 2 - 120, pageH / 2 - 20, {
      width: 260,
      align: 'center',
      lineBreak: false,
    });
    doc.restore();
  }

  // ——— CONTENIDO ———
  newContentPage();

  // Índice dinámico solo si el documento es sustancial
  const estimatedHeavy = input.lineas.some((l) => {
    const cc = l.contenido_comercial || {};
    const n =
      (cc.tareas_auxiliares?.length || 0) +
      (cc.tareas_limpieza?.length || 0) +
      (cc.tareas?.length || 0);
    return n >= 8;
  });
  if (estimatedHeavy || input.lineas.length >= 2) {
    ensureSpaceLocal(80);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(brandColor)
      .text('Índice');
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(9).fillColor('#374151');
    const idxItems = [
      'Presentación',
      'Servicios ofertados',
      ...input.lineas.map(
        (l, i) =>
          `${i + 1}. ${l.contenido_comercial?.titulo_comercial || l.nombre}`,
      ),
      'Propuesta económica',
      'Garantía profesional',
      'Condiciones contractuales',
      'Aceptación',
    ];
    for (const it of idxItems) {
      ensureSpaceLocal(14);
      doc.text(`• ${it}`, { width: contentW });
    }
    doc.moveDown(0.6);
  }

  // Presentación (brand config — seeded from Legacy)
  const presentacion = Array.isArray(brandCfg.presentacion)
    ? brandCfg.presentacion.map(String).filter(Boolean)
    : [];
  if (presentacion.length) {
    ensureSpaceLocal(80);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(brandColor)
      .text('Presentación');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#374151');
    for (const p of presentacion) {
      ensureSpaceLocal(22);
      doc.text(p, { width: contentW, align: 'justify' });
      doc.moveDown(0.25);
    }
    doc.moveDown(0.5);
  }

  // Cliente
  doc.font('Helvetica-Bold').fontSize(12).fillColor(brandColor).text('Cliente');
  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  for (const line of [
    c.nombre,
    c.nif ? `CIF/NIF: ${c.nif}` : null,
    c.direccion_servicio || c.direccion,
    [c.codigo_postal, c.poblacion, c.provincia].filter(Boolean).join(' '),
    c.email_envio || c.email,
    c.telefono || c.movil,
    c.atencion_de ? `Att.: ${c.atencion_de}` : null,
    c.contacto_especifico ? `Contacto: ${c.contacto_especifico}` : null,
  ].filter(Boolean)) {
    doc.text(String(line));
  }
  if (c.observaciones_documento) {
    doc
      .fillColor('#4B5563')
      .text(`Observaciones: ${c.observaciones_documento}`);
    doc.fillColor('#111827');
  }
  doc.moveDown(1);

  // Servicios ofertados (resumen)
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(brandColor)
    .text('Servicios ofertados');
  doc.moveDown(0.3);
  doc.fillColor('#111827');

  input.lineas.forEach((linea, idx) => {
    ensureSpaceLocal(40);
    const titulo = linea.contenido_comercial?.titulo_comercial || linea.nombre;
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(`${idx + 1}. ${titulo}`);
    const cfg = commercialConfigLines(linea);
    if (cfg.length) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#4B5563')
        .text(cfg.join(' · '), { width: contentW });
      doc.fillColor('#111827');
    }
    doc.moveDown(0.35);
  });

  // Detalle comercial por servicio (jornada / tareas / periódicos)
  input.lineas.forEach((linea, _idx) => {
    const cc = linea.contenido_comercial || {};
    const titulo = cc.titulo_comercial || linea.nombre;
    const tareasAux = cc.tareas_auxiliares || [];
    const tareasLimp = cc.tareas_limpieza || [];
    const periodicos = cc.servicios_periodicos || [];
    const tareasFlat = cc.tareas || [];
    const jornadaSrc =
      linea.opciones?.length === 1
        ? linea.opciones[0]?.jornada
        : linea.opciones?.[0]?.jornada;
    const jornadaLines = formatJornadaLines(jornadaSrc as any);

    const hasDetail =
      cc.descripcion_comercial ||
      (cc.operativa && cc.operativa.length) ||
      tareasFlat.length ||
      tareasAux.length ||
      tareasLimp.length ||
      periodicos.length ||
      jornadaLines.length ||
      (cc.condiciones_especificas && cc.condiciones_especificas.length);
    if (!hasDetail) return;

    ensureSpaceLocal(110);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(brandColor)
      .text(String(titulo).toUpperCase());
    doc.moveDown(0.35);
    if (cc.descripcion_comercial) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(String(cc.descripcion_comercial), {
          width: contentW,
          align: 'justify',
        });
      doc.moveDown(0.45);
    }

    if (jornadaLines.length) {
      ensureSpaceLocal(55);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(brandColor)
        .text('Jornada');
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#111827');
      for (const jl of jornadaLines) {
        ensureSpaceLocal(16);
        doc.text(jl, { width: contentW });
      }
      doc.moveDown(0.4);
    }

    const writeBulletSection = (heading: string, items: string[]) => {
      if (!items.length) return;
      ensureSpaceLocal(36);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(brandColor)
        .text(heading);
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#111827');
      for (const item of items) {
        ensureSpaceLocal(16);
        doc.text(`• ${item}`, { width: contentW });
      }
      doc.moveDown(0.35);
    };

    /** Group "Frecuencia X: tarea" lines into Legacy-like subgroups. */
    const writeGroupedOrFlat = (heading: string, items: string[]) => {
      if (!items.length) return;
      const groups = new Map<string, string[]>();
      const plain: string[] = [];
      for (const raw of items) {
        const m = String(raw).match(/^(Frecuencia [^:]+):\s*(.+)$/i);
        if (m) {
          const list = groups.get(m[1]) || [];
          list.push(m[2]);
          groups.set(m[1], list);
        } else plain.push(raw);
      }
      if (!groups.size) {
        writeBulletSection(heading, items);
        return;
      }
      ensureSpaceLocal(36);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(brandColor)
        .text(heading);
      doc.moveDown(0.2);
      if (plain.length) {
        doc.font('Helvetica').fontSize(9).fillColor('#111827');
        for (const item of plain) {
          ensureSpaceLocal(16);
          doc.text(`• ${item}`, { width: contentW });
        }
      }
      for (const [gTitle, gItems] of groups) {
        ensureSpaceLocal(28);
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#374151')
          .text(gTitle);
        doc.moveDown(0.15);
        doc.font('Helvetica').fontSize(9).fillColor('#111827');
        for (const item of gItems) {
          ensureSpaceLocal(16);
          doc.text(`• ${item}`, { width: contentW });
        }
        doc.moveDown(0.25);
      }
      doc.moveDown(0.2);
    };

    if (cc.operativa?.length) writeBulletSection('Operativa', cc.operativa);
    if (tareasAux.length) {
      const looksLikeFullLegacy = tareasAux.length >= 10;
      if (looksLikeFullLegacy) {
        writeBulletSection(
          'Auxiliares de Servicios — Funciones principales',
          tareasAux.slice(0, 8),
        );
        writeBulletSection('Mantenimiento', tareasAux.slice(8));
      } else {
        writeBulletSection('Tareas de Auxiliar de Servicios', tareasAux);
      }
    }
    if (tareasLimp.length) {
      writeGroupedOrFlat('Limpieza — Tareas habituales', tareasLimp);
    }
    if (!tareasAux.length && !tareasLimp.length && tareasFlat.length) {
      writeBulletSection('Tareas', tareasFlat);
    }
    if (periodicos.length) {
      ensureSpaceLocal(40);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(brandColor)
        .text('Servicios periódicos incluidos');
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#111827');
      for (const pr of periodicos) {
        ensureSpaceLocal(16);
        const bit = [pr.nombre, pr.periodicidad].filter(Boolean).join(' — ');
        doc.text(`• ${bit}`, { width: contentW });
      }
      doc.moveDown(0.35);
    }
    if (cc.condiciones_especificas?.length) {
      writeBulletSection(
        'Condiciones del servicio',
        cc.condiciones_especificas,
      );
    }
  });

  // Servicios digitales (document-level)
  const digitales = (input.serviciosDigitales || []).filter(
    (d) => d && d.activo !== false,
  );
  if (digitales.length) {
    ensureSpaceLocal(70);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(brandColor)
      .text('Servicios digitales');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    for (const d of digitales) {
      ensureSpaceLocal(28);
      if (d.incluido) {
        doc.text(`• ${d.nombre} — Incluido`);
        doc
          .fillColor('#6B7280')
          .fontSize(8)
          .text(
            `  Ref. ${money(d.precio_referencia_mensual)} €/mes · Descuento ${d.descuento_pct}%`,
          );
        doc.fillColor('#111827').fontSize(9);
      } else {
        doc.text(
          `• ${d.nombre} — ${money(d.precio_final_mensual)} €/mes` +
            (d.descuento_pct > 0 ? ` (dto. ${d.descuento_pct}%)` : ''),
        );
      }
    }
    doc.moveDown(0.5);
  }

  // Oferta económica (Legacy-like: descripción / mensualidad / anualidad)
  ensureSpaceLocal(160);
  doc.moveDown(0.6);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(brandColor)
    .text('Propuesta económica');
  doc.moveDown(0.4);

  const tableTop = doc.y;
  const colDesc = { x: left, w: contentW * 0.42 };
  const colMen = { x: left + contentW * 0.42, w: contentW * 0.29 };
  const colAn = { x: left + contentW * 0.71, w: contentW * 0.29 };

  doc.rect(left, tableTop, contentW, 20).fill(brandColor);
  doc.fillColor(portadaText).font('Helvetica-Bold').fontSize(8);
  doc.text('DESCRIPCIÓN', colDesc.x + 4, tableTop + 6, {
    width: colDesc.w - 8,
  });
  doc.text('MENSUALIDAD', colMen.x + 4, tableTop + 6, {
    width: colMen.w - 8,
    align: 'right',
  });
  doc.text('ANUALIDAD', colAn.x + 4, tableTop + 6, {
    width: colAn.w - 8,
    align: 'right',
  });

  let y = tableTop + 24;
  doc.fillColor('#111827').font('Helvetica').fontSize(9);
  const dtoPct = Number(input.descuentoFidelidadPct) || 0;

  const writeSectionHeading = (title: string) => {
    ensureSpaceLocal(28);
    if (doc.y > y) y = doc.y;
    doc
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(title, colDesc.x + 4, y, { width: colDesc.w - 8 });
    doc.fillColor('#111827').font('Helvetica').fontSize(9);
    y += 12;
  };

  const writeOpcionRow = (
    op: NonNullable<PdfV2BuildInput['lineas'][0]['opciones']>[0],
    opts: { showLabel: boolean; pricePrefix?: string },
  ) => {
    ensureSpaceLocal(40);
    if (doc.y > y) y = doc.y;
    const t = op.totales || op.resultado?.totales || {};
    const mSin = Number(t.mensualidad_sin_iva);
    const mCon = Number(t.mensualidad_con_iva);
    const aSin = Number(t.anualidad_sin_iva);
    const aCon = Number(t.anualidad_con_iva);
    const hasResultado = Boolean(op.resultado || op.totales);
    const pending = !hasResultado || !Number.isFinite(mSin);
    const label = opts.showLabel
      ? String(op.etiqueta || 'Opción').slice(0, 50)
      : null;
    const jornadaHint =
      op.jornada?.horas_semana != null
        ? `${op.jornada.horas_semana}h/semana`
        : null;
    const desc =
      op.descripcion_local ||
      jornadaHint ||
      (op.inputs
        ? commercialConfigLines({
            nombre: '',
            inputs: op.inputs,
          } as PdfV2BuildInput['lineas'][0])
            .slice(0, 2)
            .join(' · ')
        : null);

    if (label) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`  ${label}`, colDesc.x + 4, y, { width: colDesc.w - 8 });
      y += 11;
    }
    if (desc) {
      doc
        .fillColor('#6B7280')
        .font('Helvetica')
        .fontSize(8)
        .text(String(desc).slice(0, 90), colDesc.x + 8, y, {
          width: colDesc.w - 12,
        });
      doc.fillColor('#111827');
      y += 10;
    }

    const prefix = opts.pricePrefix || '';
    doc.font('Helvetica').fontSize(9);
    if (pending) {
      doc.fillColor('#B45309').text('Pendiente de cálculo', colMen.x + 4, y, {
        width: colMen.w - 8,
        align: 'right',
      });
      doc.text('—', colAn.x + 4, y, {
        width: colAn.w - 8,
        align: 'right',
      });
      doc.fillColor('#111827');
      y += 16;
      return;
    }
    doc.text(`${prefix}${money(mSin)} € + IVA`, colMen.x + 4, y, {
      width: colMen.w - 8,
      align: 'right',
    });
    doc.text(`${prefix}${money(aSin)} € + IVA`, colAn.x + 4, y, {
      width: colAn.w - 8,
      align: 'right',
    });
    y += 11;
    doc
      .fillColor('#6B7280')
      .fontSize(8)
      .text(`${prefix}${money(mCon)} € IVA incl.`, colMen.x + 4, y, {
        width: colMen.w - 8,
        align: 'right',
      });
    doc.text(`${prefix}${money(aCon)} € IVA incl.`, colAn.x + 4, y, {
      width: colAn.w - 8,
      align: 'right',
    });
    doc.fillColor('#111827').fontSize(9);
    y += 14;

    if (dtoPct > 0) {
      const applied = applyDescuentoFidelidadToTotales(
        normalizeTotales({
          mensualidad_sin_iva: mSin,
          mensualidad_con_iva: mCon,
          anualidad_sin_iva: aSin,
          anualidad_con_iva: aCon,
        }),
        dtoPct,
      );
      ensureSpaceLocal(48);
      if (doc.y > y) y = doc.y;
      doc
        .fillColor('#B45309')
        .font('Helvetica')
        .fontSize(8)
        .text(`Descuento por fidelidad (${dtoPct}%)`, colDesc.x + 4, y, {
          width: colDesc.w - 8,
        });
      doc.text(
        `${money(-applied.descuento.mensualidad_sin_iva)} € + IVA`,
        colMen.x + 4,
        y,
        { width: colMen.w - 8, align: 'right' },
      );
      doc.text(
        `${money(-applied.descuento.anualidad_sin_iva)} € + IVA`,
        colAn.x + 4,
        y,
        { width: colAn.w - 8, align: 'right' },
      );
      y += 12;
      const suf = String(label || 'opción').slice(0, 36);
      doc
        .fillColor('#065F46')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(`TOTAL neto (incl. dto.) — ${suf}`, colDesc.x + 4, y, {
          width: colDesc.w - 8,
        });
      doc.text(
        `${money(applied.neto.mensualidad_sin_iva)} € + IVA`,
        colMen.x + 4,
        y,
        { width: colMen.w - 8, align: 'right' },
      );
      doc.text(
        `${money(applied.neto.anualidad_sin_iva)} € + IVA`,
        colAn.x + 4,
        y,
        { width: colAn.w - 8, align: 'right' },
      );
      doc.fillColor('#111827').font('Helvetica').fontSize(9);
      y += 14;
    }
  };

  for (const linea of input.lineas) {
    ensureSpaceLocal(36);
    if (doc.y > y) y = doc.y;

    const opcionesRaw =
      Array.isArray(linea.opciones) && linea.opciones.length > 0
        ? linea.opciones
        : [
            {
              etiqueta: 'Opción única',
              seleccion_tipo: 'ACUMULABLE',
              descripcion_local: null,
              inputs: linea.inputs,
              totales: linea.totales,
              resultado: linea.resultado,
            },
          ];

    doc
      .font('Helvetica-Bold')
      .text(String(linea.nombre).slice(0, 55), colDesc.x + 4, y, {
        width: colDesc.w - 8,
      });
    y += 12;

    const sections = groupOpcionesForPdfPresentation(opcionesRaw);
    for (const section of sections) {
      if (section.heading) writeSectionHeading(section.heading);
      for (const op of section.opciones) {
        writeOpcionRow(op, {
          showLabel: section.showLabels,
          pricePrefix: section.pricePrefix || undefined,
        });
      }
    }

    y += 6;
    doc.y = y;
  }

  // Digitales in economic table (100% dto → Incluido, no double total)
  for (const d of digitales) {
    ensureSpaceLocal(36);
    if (doc.y > y) y = doc.y;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#111827')
      .text(String(d.nombre).slice(0, 40), colDesc.x + 4, y, {
        width: colDesc.w - 8,
      });
    y += 11;
    doc
      .fillColor('#6B7280')
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Ref. ${money(d.precio_referencia_mensual)} €/mes · Descuento ${d.descuento_pct}%`,
        colDesc.x + 8,
        y,
        { width: colDesc.w - 12 },
      );
    doc.fillColor('#111827');
    y += 10;
    if (d.incluido) {
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Incluido', colMen.x + 4, y, {
        width: colMen.w - 8,
        align: 'right',
      });
      doc.text('—', colAn.x + 4, y, {
        width: colAn.w - 8,
        align: 'right',
      });
    } else {
      const m = Number(d.precio_final_mensual) || 0;
      doc.font('Helvetica').fontSize(9);
      doc.text(`${money(m)} €/mes`, colMen.x + 4, y, {
        width: colMen.w - 8,
        align: 'right',
      });
      doc.text(`${money(m * 12)} €/año`, colAn.x + 4, y, {
        width: colAn.w - 8,
        align: 'right',
      });
    }
    y += 16;
    doc.y = y;
  }

  ensureSpaceLocal(70);
  y = Math.max(y, doc.y) + 6;
  if (input.totalesAmbiguo) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor('#6B7280')
      .text(
        'Este presupuesto incluye alternativas. Los totales globales no suman todas las opciones alternativas.',
        left,
        y,
        { width: contentW },
      );
    y += 28;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text(
        `Total de componentes no ambiguos (mensual s/IVA): ${money(input.totales.mensualidad_sin_iva)} €`,
        left,
        y,
      );
    y += 14;
    doc.text(
      `Total de componentes no ambiguos (anual s/IVA): ${money(input.totales.anualidad_sin_iva)} €`,
      left,
      y,
    );
  } else {
    if (dtoPct > 0 && input.totalesBrutos) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#6B7280')
        .text(
          `Descuento por fidelidad ${dtoPct}% aplicado sobre la oferta (bruto mensual s/IVA: ${money(input.totalesBrutos.mensualidad_sin_iva)} €).`,
          left,
          y,
          { width: contentW },
        );
      y += 16;
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text(
        `Total mensual sin IVA${dtoPct > 0 ? ' (neto)' : ''}: ${money(input.totales.mensualidad_sin_iva)} €`,
        left,
        y,
      );
    y += 14;
    doc.text(
      `Total mensual con IVA${dtoPct > 0 ? ' (neto)' : ''}: ${money(input.totales.mensualidad_con_iva)} €`,
      left,
      y,
    );
    y += 14;
    doc.text(
      `Total anual sin IVA${dtoPct > 0 ? ' (neto)' : ''}: ${money(input.totales.anualidad_sin_iva)} €`,
      left,
      y,
    );
    y += 14;
    doc.text(
      `Total anual con IVA${dtoPct > 0 ? ' (neto)' : ''}: ${money(input.totales.anualidad_con_iva)} €`,
      left,
      y,
    );
  }
  doc.y = y + 18;

  // Garantía profesional (from brand config — Legacy texts seeded)
  const garantiaCajas = Array.isArray(brandCfg.garantia_bloques)
    ? brandCfg.garantia_bloques
    : [];
  const garantiaFlat = Array.isArray(brandCfg.garantia)
    ? brandCfg.garantia.map(String).filter(Boolean)
    : [];
  if (garantiaCajas.length || garantiaFlat.length) {
    ensureSpaceLocal(90);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(brandColor)
      .text('Garantía profesional');
    doc.moveDown(0.3);
    if (brandCfg.garantia_intro) {
      doc.font('Helvetica').fontSize(9).fillColor('#374151');
      const legalName =
        input.company?.legal_name || input.brand?.nombre || 'La empresa';
      doc.text(`${legalName} ${String(brandCfg.garantia_intro)}`, {
        width: contentW,
        align: 'justify',
      });
      doc.moveDown(0.4);
    }
    if (garantiaCajas.length) {
      for (const caja of garantiaCajas) {
        ensureSpaceLocal(42);
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#111827')
          .text(String(caja.titulo || ''));
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#374151')
          .text(String(caja.texto || ''), { width: contentW });
        doc.moveDown(0.35);
      }
    } else {
      doc.font('Helvetica').fontSize(9).fillColor('#374151');
      for (const g of garantiaFlat) {
        ensureSpaceLocal(18);
        doc.text(`• ${g}`, { width: contentW });
      }
    }
    doc.moveDown(0.4);
  }

  // Condiciones contractuales (secciones Legacy seeded en brand)
  ensureSpaceLocal(100);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(brandColor)
    .text('Condiciones contractuales');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).fillColor('#374151');

  const condSecciones = Array.isArray(brandCfg.condiciones_secciones)
    ? brandCfg.condiciones_secciones
    : [];
  const fromBrandFlat = Array.isArray(brandCfg.condiciones_pdf)
    ? brandCfg.condiciones_pdf.map(String).filter(Boolean)
    : Array.isArray(input.condiciones)
      ? input.condiciones
      : null;

  if (brandCfg.condiciones_intro) {
    doc.text(String(brandCfg.condiciones_intro), {
      width: contentW,
      align: 'justify',
    });
    doc.moveDown(0.4);
  }

  if (condSecciones.length) {
    for (const sec of condSecciones) {
      ensureSpaceLocal(36);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#111827')
        .text(String(sec.titulo || ''));
      doc.font('Helvetica').fontSize(8).fillColor('#374151');
      for (const p of sec.parrafos || []) {
        ensureSpaceLocal(16);
        doc.text(String(p), { width: contentW });
      }
      doc.moveDown(0.3);
    }
  } else {
    const condiciones =
      fromBrandFlat && fromBrandFlat.length
        ? fromBrandFlat
        : defaultCondiciones(input.mode, validez);
    for (const cnd of condiciones) {
      ensureSpaceLocal(20);
      doc.text(`• ${cnd}`, { width: contentW });
    }
  }

  // Append service-specific conditions once (summary)
  const extraSvc: string[] = [];
  for (const linea of input.lineas) {
    for (const cnd of linea.contenido_comercial?.condiciones_especificas ||
      []) {
      extraSvc.push(
        `${linea.contenido_comercial?.titulo_comercial || linea.nombre}: ${cnd}`,
      );
    }
  }
  if (extraSvc.length) {
    doc.moveDown(0.35);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(brandColor)
      .text('Particularidades de servicio');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).fillColor('#374151');
    for (const cnd of extraSvc) {
      ensureSpaceLocal(20);
      doc.text(`• ${cnd}`, { width: contentW });
    }
  }

  // Aceptación (visual placeholder — no e-signature yet)
  ensureSpaceLocal(120);
  doc.moveDown(0.8);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(brandColor)
    .text('Aceptación');
  doc.moveDown(0.3);
  const aceptacion =
    String(brandCfg.aceptacion_texto || '').trim() ||
    'La firma de este documento implica la aceptación de la propuesta económica y de las condiciones indicadas. La formalización contractual se realizará según el procedimiento de la empresa.';
  doc.font('Helvetica').fontSize(9).fillColor('#374151').text(aceptacion, {
    width: contentW,
    align: 'justify',
  });
  doc.moveDown(1.2);
  const sigY = doc.y;
  doc
    .strokeColor('#9CA3AF')
    .lineWidth(0.8)
    .moveTo(left, sigY + 40)
    .lineTo(left + contentW * 0.4, sigY + 40)
    .stroke();
  doc
    .moveTo(left + contentW * 0.55, sigY + 40)
    .lineTo(left + contentW, sigY + 40)
    .stroke();
  doc.fontSize(8).fillColor('#6B7280');
  doc.text('Por la empresa', left, sigY + 46, { width: contentW * 0.4 });
  doc.text('Por el cliente', left + contentW * 0.55, sigY + 46, {
    width: contentW * 0.45,
  });
  doc.y = sigY + 70;

  drawFooter();

  doc.end();
  await new Promise<void>((resolve, reject) => {
    doc.on('end', () => resolve());
    doc.on('error', reject);
  });
  return Buffer.concat(chunks);
}
