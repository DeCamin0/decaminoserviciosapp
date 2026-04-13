/**
 * Genera PDFs borrador (RGPD + protocolo registro de jornada) en disco, sin abrir el navegador.
 * Lee VITE_COMPANY_* y VITE_PRIMARY_COLOR de .env.decamino / .env.hera (+ *.local).
 *
 * Uso (desde carpeta frontend):
 *   npm run legal-pdfs:borrador
 *
 * Salida: legal-pdfs-borrador/decamino/ y legal-pdfs-borrador/hera/
 */

import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  buildInformacionMinimaRgpdDocDefinition,
  buildProtocoloRegistroJornadaDocDefinition,
  legalPdfFileSlug,
} from '../src/utils/legalPdfDrafts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.join(__dirname, '..');
const OUT_ROOT = path.join(FRONTEND_ROOT, 'legal-pdfs-borrador');

/** @param {string} filePath */
function loadEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!existsSync(filePath)) return out;
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** @param {'decamino' | 'hera'} mode */
function loadMergedEnv(mode) {
  const base = loadEnvFile(path.join(FRONTEND_ROOT, `.env.${mode}`));
  const local = loadEnvFile(path.join(FRONTEND_ROOT, `.env.${mode}.local`));
  return { ...base, ...local };
}

/** @param {Record<string, string>} e */
function companyFromViteEnv(e) {
  return {
    legalName: (e.VITE_COMPANY_NAME_LEGAL || e.VITE_COMPANY_NAME || '').trim() || '(sin VITE_COMPANY_NAME)',
    address: (e.VITE_COMPANY_ADDRESS || '').trim(),
    cpPoblacion: (e.VITE_COMPANY_CP_POBLACION || '').trim(),
    email: (e.VITE_COMPANY_EMAIL || '').trim(),
    cif: (e.VITE_COMPANY_CIF || '').trim(),
  };
}

/** @param {Record<string, string>} e */
function primaryFromEnv(e) {
  const c = (e.VITE_PRIMARY_COLOR || '').trim();
  return c || '#CC0000';
}

/**
 * Nombre del sistema de fichaje en los PDF (app propia). Opcional: VITE_LEGAL_PDF_FICHAJE_LABEL.
 * Si no, VITE_APP_NAME (ej. marca corta); último recurso razón social.
 * @param {Record<string, string>} e
 */
function fichajeProductNameFromEnv(e) {
  const label = (e.VITE_LEGAL_PDF_FICHAJE_LABEL || '').trim();
  if (label) return label;
  const app = (e.VITE_APP_NAME || '').trim();
  if (app) return app;
  return (e.VITE_COMPANY_NAME_LEGAL || e.VITE_COMPANY_NAME || '').trim();
}

async function getPdfMakeNode() {
  const [pdfMakeModule, vfsModule] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    import('pdfmake/build/vfs_fonts.js'),
  ]);
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const vfs = vfsModule.default ?? vfsModule;
  if (pdfMake.addVirtualFileSystem && vfs) {
    pdfMake.addVirtualFileSystem(vfs);
  } else if (vfs && typeof pdfMake.vfs !== 'undefined') {
    pdfMake.vfs = vfs;
  }
  return pdfMake;
}

/**
 * @param {unknown} pdfMake
 * @param {object} def
 * @param {string} outPath
 */
function writePdfFile(pdfMake, def, outPath) {
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(def).getBuffer((buffer) => {
        mkdirSync(path.dirname(outPath), { recursive: true });
        writeFileSync(outPath, buffer);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * @param {'decamino' | 'hera'} label
 * @param {Record<string, string>} envMap
 * @param {unknown} pdfMake
 */
async function generateForClient(label, envMap, pdfMake) {
  const company = companyFromViteEnv(envMap);
  const primary = primaryFromEnv(envMap);
  const fichajeProductName = fichajeProductNameFromEnv(envMap);
  const slug = legalPdfFileSlug(company);
  const dir = path.join(OUT_ROOT, label);

  const p1 = path.join(dir, `01_informacion_minima_rgpd_${slug}.pdf`);
  const p2 = path.join(dir, `02_protocolo_registro_jornada_${slug}.pdf`);

  const pdfOpts = { primaryColor: primary, fichajeProductName };

  await writePdfFile(
    pdfMake,
    buildInformacionMinimaRgpdDocDefinition(company, pdfOpts),
    p1,
  );
  await writePdfFile(
    pdfMake,
    buildProtocoloRegistroJornadaDocDefinition(company, pdfOpts),
    p2,
  );

  console.log(`[${label}] → ${p1}`);
  console.log(`[${label}] → ${p2}`);
}

async function main() {
  const pdfMake = await getPdfMakeNode();

  const decaminoEnv = loadMergedEnv('decamino');
  const heraEnv = loadMergedEnv('hera');

  if (!decaminoEnv.VITE_COMPANY_NAME && !decaminoEnv.VITE_COMPANY_NAME_LEGAL) {
    console.warn('Aviso: .env.decamino sin VITE_COMPANY_NAME — revisa el PDF generado.');
  }
  if (!heraEnv.VITE_COMPANY_NAME && !heraEnv.VITE_COMPANY_NAME_LEGAL) {
    console.warn('Aviso: .env.hera sin VITE_COMPANY_NAME — revisa el PDF generado.');
  }

  await generateForClient('decamino', decaminoEnv, pdfMake);
  await generateForClient('hera', heraEnv, pdfMake);

  console.log(`\nListo. Carpeta: ${OUT_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
