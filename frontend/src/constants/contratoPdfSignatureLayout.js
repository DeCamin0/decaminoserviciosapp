/**
 * Slot semnătură pe ultima pagină a contractelor SEPE / DeCamino.
 * Caseta „El/la trabajador/a” = coloana din stânga a blocului de 3 semne
 * (trabajador | empresa | representante menor), deasupra casetei IMPORTANTE.
 *
 * xRatio / widthRatio / heightRatio: din stânga / dimensiune pagină.
 * yBottomRatio: distanță de la marginea INFERIOARĂ până la baza imaginii (pdf-lib).
 *
 * Calibrat pe contract tip SEPE (pagina de semnare cu 3 coloane).
 * Retunează aici dacă template-ul se schimbă.
 */
export const CONTRATO_TRABAJADOR_SIGNATURE_SLOT = {
  id: 'contrato_trabajador_last_page_v1',
  /** Stânga — sub „El/la trabajador/a” + DNI */
  xRatio: 0.06,
  /** Baza semnăturii deasupra blocului IMPORTANTE (+ spațiu legendă) */
  yBottomRatio: 0.175,
  widthRatio: 0.26,
  heightRatio: 0.065,
};

/**
 * Semnătură pe marginea stângă (paginile 1…N-1), conform clauzei SEPE:
 * «TODAS LAS PÁGINAS… DEBERÁN IR FIRMADAS EN EL MARGEN IZQUIERDO».
 * Compactă, verticală (rotație 90°).
 */
export const CONTRATO_MARGEN_IZQUIERDO_SLOT = {
  id: 'contrato_margen_izquierdo_v1',
  /**
   * Originea (colț jos-stânga) înainte de rotație.
   * Cu rotate 90° CCW, imaginea urcă pe marginea stângă.
   */
  xRatio: 0.038,
  yBottomRatio: 0.28,
  /** Lungime de-a lungul marginii (după rotație ≈ pe verticală) */
  widthRatio: 0.14,
  /** Grosime spre interiorul paginii */
  heightRatio: 0.028,
  rotateDegrees: 90,
};

/**
 * Text mic sub semnătura digitală (pdf-lib, sub baza imaginii).
 */
export const CONTRATO_FIRMA_DIGITAL_CAPTION = {
  fontSize: 6.5,
  lineGap: 1.2,
  /** Distanță între baza semnăturii și prima linie de text */
  gapBelowSignature: 2.5,
  color: { r: 0.25, g: 0.25, b: 0.35 },
};

/**
 * Slot sello + firmă empresa pe ultima pagină (coloana din mijloc).
 * Calibrat pe crop din CONTRATO ANISOARA (pagina de semnare SEPE).
 */
export const CONTRATO_EMPRESA_SELLO_SLOT = {
  id: 'contrato_empresa_sello_last_page_v1',
  xRatio: 0.36,
  yBottomRatio: 0.21,
  widthRatio: 0.26,
  heightRatio: 0.085,
};

/**
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @param {typeof CONTRATO_TRABAJADOR_SIGNATURE_SLOT} [slot]
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function getContratoSignatureSlot(
  pageWidth,
  pageHeight,
  slot = CONTRATO_TRABAJADOR_SIGNATURE_SLOT,
) {
  const width = (slot.widthRatio ?? 0.24) * pageWidth;
  const height = (slot.heightRatio ?? 0.075) * pageHeight;
  const x = (slot.xRatio ?? 0.07) * pageWidth;
  const y = (slot.yBottomRatio ?? 0.155) * pageHeight;
  return { x, y, width, height };
}

/**
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @returns {{ x: number, y: number, width: number, height: number, rotateDegrees: number }}
 */
export function getContratoMargenIzquierdoSlot(pageWidth, pageHeight) {
  const slot = CONTRATO_MARGEN_IZQUIERDO_SLOT;
  return {
    ...getContratoSignatureSlot(pageWidth, pageHeight, slot),
    rotateDegrees: slot.rotateDegrees ?? 90,
  };
}

/**
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function getContratoEmpresaSelloSlot(pageWidth, pageHeight) {
  return getContratoSignatureSlot(
    pageWidth,
    pageHeight,
    CONTRATO_EMPRESA_SELLO_SLOT,
  );
}

/**
 * Linii de legendă sub semnătura digitală.
 * @param {Date} [date]
 * @returns {string[]}
 */
export function buildContratoFirmaDigitalCaptionLines(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const fecha = d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return [
    'Firmado digitalmente',
    `Fecha: ${fecha}`,
    'De Camino Servicios Auxiliares',
  ];
}

/**
 * Detectează dacă un document e contract (pentru autoStampMode).
 */
export function isContratoDocumento(doc = {}) {
  const haystack = [
    doc.fileName,
    doc.nombre_archivo,
    doc.tipo,
    doc.tipo_documento,
    doc.originalFileName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /contrato/.test(haystack);
}
