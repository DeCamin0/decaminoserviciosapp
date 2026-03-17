import { registerAs } from '@nestjs/config';

/** Fără fallback-uri: doar din .env (local + producție). Lipsește ceva → eroare clară. */
const req = (key: string): string => {
  const v = process.env[key];
  if (v === undefined || String(v).trim() === '') {
    throw new Error(
      `[company.config] Missing required env: ${key}. Add it in backend/.env (see .env.example).`,
    );
  }
  return v.trim();
};
const opt = (key: string): string => (process.env[key] ?? '').trim();

export default registerAs('company', () => {
  const legalName = req('COMPANY_LEGAL_NAME');
  const legalNameShort = req('COMPANY_LEGAL_NAME_SHORT');
  const address = opt('COMPANY_ADDRESS') || req('COMPANY_ADDRESS_LINE1');
  const addressLine1 = req('COMPANY_ADDRESS_LINE1');
  const cpPoblacion = opt('COMPANY_CP_POBLACION');
  const cif = req('COMPANY_CIF');
  const phone = opt('COMPANY_PHONE');
  const email = req('COMPANY_EMAIL');
  const emailBcc = opt('COMPANY_EMAIL_BCC');
  const solicitudesEmail = opt('COMPANY_SOLICITUDES_EMAIL') || email;
  /** Email destinatar principal gestoria (fiche, despido, baja, etc.). Dacă lipsește → COMPANY_EMAIL. */
  const gestoriaEmail = opt('COMPANY_GESTORIA_EMAIL') || email;
  /** CC la emailuri către gestoria – mai multe adrese separate prin virgulă. Opțional. */
  const gestoriaCc = opt('COMPANY_GESTORIA_CC');
  const emailFromName = opt('COMPANY_EMAIL_FROM_NAME') || legalNameShort;
  const website = opt('COMPANY_WEBSITE');
  const brandRed = opt('COMPANY_BRAND_RED') || '#CC0000';
  /** Portada PDF: fundal (ex. albastru deschis HERA = același ca login). Dacă lipsește → brandRed. */
  const portadaBg = opt('COMPANY_PORTADA_BG') || brandRed;
  /** Portada PDF: culoare text (pe fundal deschis folosești închis, ex. #1e3a5f). Dacă lipsește → #FFFFFF. */
  const portadaTextColor = opt('COMPANY_PORTADA_TEXT_COLOR') || '#FFFFFF';
  const frontendAppUrl = req('FRONTEND_APP_URL');
  /** Logo filename (e.g. logo.png, logo.svg) or path; used by PDF services. Optional. */
  const logoPath = opt('COMPANY_LOGO_PATH');
  /** Logo HERA when presupuestoPresentacionKey=hera (same process, multi-client). Optional. */
  const logoPathHera = opt('COMPANY_LOGO_PATH_HERA');
  /** Stamp/sello filename for PDF Aceptación; looked up in assets/cwd. Optional. */
  const stampPath = opt('COMPANY_STAMP_PATH');
  /** Stamp HERA when presupuestoPresentacionKey=hera (e.g. sello hera firma 10-07-25.png). Optional. */
  const stampPathHera = opt('COMPANY_STAMP_PATH_HERA');
  /** Presupuesto: 'decamino' = texto presentación Decamino, 'hera' = texto presentación HERA. Por defecto 'decamino'. */
  const presupuestoPresentacionKey = (opt('COMPANY_PRESUPUESTO_PRESENTACION_KEY') || 'decamino').toLowerCase();

  const legalRegistryText =
    opt('COMPANY_LEGAL_REGISTRY_TEXT') ||
    `${legalNameShort} CIF: ${cif} Inscrita en el registro Mercantil`;
  const empresaBlock =
    opt('COMPANY_EMPRESA_BLOCK') || `${legalName}\n${addressLine1}\n${cif}`;
  const officinaLabel =
    opt('COMPANY_OFFICINA_LABEL') || `Officina - ${legalNameShort}`;

  return {
    legalName,
    legalNameShort,
    address,
    addressLine1,
    cpPoblacion,
    cif,
    phone,
    email,
    emailBcc,
    solicitudesEmail,
    gestoriaEmail,
    gestoriaCc,
    emailFromName,
    website,
    brandRed,
    portadaBg,
    portadaTextColor,
    frontendAppUrl,
    logoPath,
    logoPathHera,
    stampPath,
    stampPathHera,
    presupuestoPresentacionKey,
    legalRegistryText,
    empresaBlock,
    officinaLabel,
  };
});
