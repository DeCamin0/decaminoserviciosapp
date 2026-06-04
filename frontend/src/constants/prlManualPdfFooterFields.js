import { config } from '../config/env.js';

/**
 * Coordenadas relativas (0–1) sobre la página del formulario del manual PRL.
 * xRatio: desde la izquierda; yBottomRatio: distancia desde el borde INFERIOR del PDF (Y pdf-lib).
 */
export const PRL_MANUAL_FOOTER_FONT_SIZE = 11;

export const PRL_MANUAL_PDF_FOOTER_LAYOUTS = {
  oficinas_despachos_v1: {
    id: 'oficinas_despachos_v1',
    matchFileName: /MANUAL\s+PRL\s+OFICINAS\s+Y\s+DESPACHOS/i,
    fields: {
      empresa: { xRatio: 0.28, yBottomRatio: 0.705, fontSize: 11, maxWidthRatio: 0.5 },
      fecha: { xRatio: 0.28, yBottomRatio: 0.616, fontSize: 11 },
      dni: { xRatio: 0.28, yBottomRatio: 0.526, fontSize: 11 },
      nombre: { xRatio: 0.48, yBottomRatio: 0.437, fontSize: 11, maxWidthRatio: 0.28 },
    },
    signature: {
      xRatio: 0.78,
      yBottomRatio: 0.398,
      widthRatio: 0.17,
      heightRatio: 0.065,
    },
  },
  manual_prl_limpieza_v1: {
    id: 'manual_prl_limpieza_v1',
    matchFileName: /MANUAL[\s_]+LIMPIEZA/i,
    fields: {
      empresa: { xRatio: 0.17, yBottomRatio: 0.644, fontSize: 11 },
      fecha: { xRatio: 0.17, yBottomRatio: 0.551, fontSize: 11 },
      dni: { xRatio: 0.17, yBottomRatio: 0.453, fontSize: 11 },
      nombre: { xRatio: 0.17, yBottomRatio: 0.338, fontSize: 11, maxWidthRatio: 0.34 },
    },
    signature: {
      xRatio: 0.58,
      yBottomRatio: 0.31,
      widthRatio: 0.28,
      heightRatio: 0.045,
    },
  },
  manual_basico_art19_v1: {
    id: 'manual_basico_art19_v1',
    matchFileName: /Manual[\s_]*basico[\s_]*ART[\s_]*19/i,
    fields: {
      empresa: { xRatio: 0.17, yBottomRatio: 0.508, fontSize: 11 },
      fecha: { xRatio: 0.17, yBottomRatio: 0.408, fontSize: 11 },
      dni: { xRatio: 0.17, yBottomRatio: 0.308, fontSize: 11 },
      nombre: { xRatio: 0.17, yBottomRatio: 0.169, fontSize: 11, maxWidthRatio: 0.38 },
    },
    signature: {
      xRatio: 0.56,
      yBottomRatio: 0.185,
      widthRatio: 0.28,
      heightRatio: 0.045,
    },
  },
};

export function resolvePrlManualFooterLayout(fileName) {
  const name = String(fileName || '');
  for (const layout of Object.values(PRL_MANUAL_PDF_FOOTER_LAYOUTS)) {
    if (layout.matchFileName?.test(name)) return layout;
  }
  return null;
}

function pageTextLooksLikeManualFooterForm(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ');
  return (
    /Empresa:/i.test(normalized) &&
    (/Nombre y firma del trabajador/i.test(normalized) ||
      /Nombre y firma/i.test(normalized))
  );
}

export async function resolveManualFooterPageNumber(pdfDocument) {
  if (!pdfDocument?.numPages) return 1;
  const start = pdfDocument.numPages;
  const end = Math.max(1, pdfDocument.numPages - 4);
  for (let pageNum = start; pageNum >= end; pageNum -= 1) {
    const page = await pdfDocument.getPage(pageNum);
    const text = (await page.getTextContent()).items.map((item) => item.str).join(' ');
    if (pageTextLooksLikeManualFooterForm(text)) {
      return pageNum;
    }
  }
  return pdfDocument.numPages;
}

export function buildPrlManualFooterFields(user) {
  const empresa =
    (config.COMPANY_NAME_LEGAL && String(config.COMPANY_NAME_LEGAL).trim()) ||
    (config.COMPANY_NAME && String(config.COMPANY_NAME).trim()) ||
    '';
  const fecha = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const dni = String(
    user?.['D.N.I. / NIE'] ?? user?.DNI_NIE ?? user?.dni ?? user?.DNI ?? '',
  ).trim();
  const nombre = String(
    user?.['NOMBRE / APELLIDOS'] ?? user?.name ?? user?.nombre ?? '',
  ).trim();

  return { empresa, fecha, dni, nombre };
}

function resetCanvasTransform(context) {
  if (typeof context.resetTransform === 'function') {
    context.resetTransform();
  } else {
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
}

/** Evita que el nombre invada la zona reservada para la firma. */
export function resolveNombreMaxWidthRatio(layout) {
  const nombre = layout?.fields?.nombre;
  const sig = layout?.signature;
  if (!nombre?.xRatio || !sig?.xRatio) {
    return nombre?.maxWidthRatio ?? null;
  }
  const gap = layout.nombreSignatureGapRatio ?? 0.02;
  const available = sig.xRatio - nombre.xRatio - gap;
  if (available <= 0) return nombre.maxWidthRatio ?? null;
  if (nombre.maxWidthRatio == null) return available;
  return Math.min(nombre.maxWidthRatio, available);
}

function resolveFieldMaxWidthRatio(layout, key, spec) {
  if (key === 'nombre') return resolveNombreMaxWidthRatio(layout);
  return spec.maxWidthRatio ?? null;
}

/** Preview en píxeles canvas (misma Y pdf-lib: yBottomRatio desde abajo). */
export function drawManualFooterPreviewOnCanvas(context, canvas, footerFields, layout) {
  if (!context || !canvas || !footerFields || !layout?.fields) return;

  const rows = [
    ['empresa', footerFields.empresa],
    ['fecha', footerFields.fecha],
    ['dni', footerFields.dni],
    ['nombre', footerFields.nombre],
  ];

  context.save();
  resetCanvasTransform(context);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = 'rgba(20, 20, 120, 0.92)';

  for (const [key, text] of rows) {
    const value = text != null ? String(text).trim() : '';
    if (!value) continue;
    const spec = layout.fields[key];
    if (!spec) continue;
    const size = spec.fontSize ?? PRL_MANUAL_FOOTER_FONT_SIZE;
    context.font = `bold ${size}px Helvetica, Arial, sans-serif`;
    const x = spec.xRatio * canvas.width;
    const y = canvas.height * (1 - spec.yBottomRatio);
    const maxWidthRatio = resolveFieldMaxWidthRatio(layout, key, spec);
    if (maxWidthRatio != null) {
      context.fillText(value, x, y, maxWidthRatio * canvas.width);
    } else {
      context.fillText(value, x, y);
    }
  }

  context.restore();
}

/** Posición firma en píxeles canvas (después de resetTransform). */
export function manualSignaturePositionFromLayout(canvas, layoutSignature) {
  if (!canvas || !layoutSignature) return null;
  const w = canvas.width * (layoutSignature.widthRatio ?? 0.3);
  const h = canvas.height * (layoutSignature.heightRatio ?? 0.07);
  const x = canvas.width * (layoutSignature.xRatio ?? 0.5);
  const yBottom = layoutSignature.yBottomRatio ?? 0.14;
  const heightRatio = layoutSignature.heightRatio ?? 0.07;
  const y = canvas.height * (1 - yBottom - heightRatio);
  return {
    x: Math.max(0, Math.min(x, canvas.width - w)),
    y: Math.max(0, Math.min(y, canvas.height - h)),
    width: w,
    height: h,
  };
}
