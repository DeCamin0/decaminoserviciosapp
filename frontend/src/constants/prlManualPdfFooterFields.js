import { config } from '../config/env.js';

/**
 * Coordenadas relativas (0–1) sobre la última página del manual PRL.
 * xRatio / width: desde la izquierda; yBottomRatio: distancia desde el borde inferior del PDF.
 * Ajustar en `oficinas_despachos_v1` si el maquetado del PDF cambia.
 */
export const PRL_MANUAL_PDF_FOOTER_LAYOUTS = {
  oficinas_despachos_v1: {
    id: 'oficinas_despachos_v1',
    matchFileName: /MANUAL\s+PRL\s+OFICINAS\s+Y\s+DESPACHOS/i,
    /** Valores alineados a las líneas del formulario (no al pie con logo Preventium). */
    /** xRatio distinto por fila: las etiquetas tienen distinta longitud. */
    fields: {
      empresa: { xRatio: 0.34, yBottomRatio: 0.705, fontSize: 10 },
      fecha: { xRatio: 0.22, yBottomRatio: 0.605, fontSize: 10 },
      dni: { xRatio: 0.22, yBottomRatio: 0.535, fontSize: 10 },
      nombre: { xRatio: 0.50, yBottomRatio: 0.465, fontSize: 10, maxWidthRatio: 0.42 },
    },
    signature: {
      xRatio: 0.56,
      yBottomRatio: 0.40,
      widthRatio: 0.28,
      heightRatio: 0.065,
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

/** Preview en canvas: mismo baseline que pdf-lib (`y = yBottomRatio * altura`). */
export function drawManualFooterPreviewOnCanvas(context, canvas, footerFields, layout) {
  if (!context || !canvas || !footerFields || !layout?.fields) return;
  const rows = [
    ['empresa', footerFields.empresa],
    ['fecha', footerFields.fecha],
    ['dni', footerFields.dni],
    ['nombre', footerFields.nombre],
  ];
  context.save();
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = 'rgba(20, 20, 120, 0.92)';
  for (const [key, text] of rows) {
    const value = text != null ? String(text).trim() : '';
    if (!value) continue;
    const spec = layout.fields[key];
    if (!spec) continue;
    const size = spec.fontSize ?? 10;
    context.font = `${size}px Helvetica, Arial, sans-serif`;
    const x = spec.xRatio * canvas.width;
    const y = canvas.height - spec.yBottomRatio * canvas.height;
    if (spec.maxWidthRatio != null) {
      context.fillText(value, x, y, spec.maxWidthRatio * canvas.width);
    } else {
      context.fillText(value, x, y);
    }
  }
  context.restore();
}

export function manualSignaturePositionFromLayout(canvas, layoutSignature) {
  if (!canvas || !layoutSignature) return null;
  const w = canvas.width * (layoutSignature.widthRatio ?? 0.3);
  const h = canvas.height * (layoutSignature.heightRatio ?? 0.07);
  const x = canvas.width * (layoutSignature.xRatio ?? 0.5);
  const yBottom = layoutSignature.yBottomRatio ?? 0.14;
  const y = canvas.height * (1 - yBottom - (layoutSignature.heightRatio ?? 0.07));
  return {
    x: Math.max(0, Math.min(x, canvas.width - w)),
    y: Math.max(0, Math.min(y, canvas.height - h)),
    width: w,
    height: h,
  };
}
