/**
 * Borradores PDF (información mínima RGPD + protocolo fichaje) para revisión jurídica.
 * Datos del responsable: objeto `company` (rellenar desde VITE_COMPANY_* en browser o script Node).
 */

/** @typedef {{ legalName: string, address: string, cpPoblacion: string, email: string, cif: string }} LegalPdfCompany */

/** @typedef {{ primaryColor?: string, fichajeProductName?: string }} LegalPdfBuildOpts */

/**
 * Nombre corto del sistema de fichaje (app / plataforma propia). Sin TimeCheck ni marcas ajenas.
 * @param {LegalPdfBuildOpts} [opts]
 */
export function resolveFichajeProductLabel(opts = {}) {
  const n = (opts.fichajeProductName || '').trim();
  if (n) return n;
  return 'la plataforma de registro de jornada';
}

/**
 * @param {LegalPdfCompany} c
 */
export function legalPdfFileSlug(c) {
  const base = (c.legalName || 'empresa').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'empresa';
  return base.slice(0, 80);
}

/**
 * @param {LegalPdfCompany} c
 */
function responsableLines(c) {
  const lines = [c.legalName];
  if (c.address) lines.push(c.address);
  if (c.cpPoblacion) lines.push(c.cpPoblacion);
  if (c.email) lines.push(c.email);
  return lines.join('\n');
}

/**
 * @param {string} text
 * @param {number} [fontSize]
 */
function tc(text, fontSize = 7) {
  return { text, fontSize, margin: [3, 3, 3, 3] };
}

/**
 * @param {string} text
 */
function th(text) {
  return { text, bold: true, fontSize: 8, margin: [3, 3, 3, 3], fillColor: '#eeeeee' };
}

/**
 * Pie reutilizable
 * @param {LegalPdfCompany} c
 */
function footerLine(c) {
  const tail = [c.cif && `CIF ${c.cif}`, c.address, c.cpPoblacion].filter(Boolean).join(' | ');
  return `${c.legalName}${tail ? ` | ${tail}` : ''}`;
}

/**
 * Documento 1: tabla información mínima RGPD (texto propio; marca fichaje vía opts).
 * @param {LegalPdfCompany} company
 * @param {LegalPdfBuildOpts} [opts]
 */
export function buildInformacionMinimaRgpdDocDefinition(company, opts = {}) {
  const primary = opts.primaryColor ?? '#CC0000';
  const fichaje = resolveFichajeProductLabel(opts);
  const r = responsableLines(company);

  const intro =
    `Tratamientos: envío de nómina a correo particular, registro de jornada mediante ${fichaje} y gestión laboral.\n\n` +
    'Este documento resume la información esencial exigible sobre los tratamientos indicados. La firma acredita la recepción y comprensión de la presente comunicación.';

  const bodyRows = [
    [
      th('Aspecto'),
      th('Nómina a correo electrónico particular'),
      th(`Registro de jornada – ${fichaje}`),
      th('Tratamiento de datos laborales'),
    ],
    [th('Responsable'), tc(r), tc(r), tc(r)],
    [
      th('Finalidad'),
      tc('Enviar la nómina mensual al correo designado automáticamente.'),
      tc('Gestionar el registro de jornada, fichajes e incidencias.'),
      tc(
        'Gestionar la relación laboral: contratación, nóminas, seguros sociales, prevención y formación.',
      ),
    ],
    [
      th('Base jurídica'),
      tc(
        'Consentimiento expreso (art. 6.1.a RGPD). Si no se autoriza, la nómina se entrega presencialmente.',
      ),
      tc('Obligación legal y ejecución de la relación laboral.'),
      tc(
        'Ejecución del contrato y cumplimiento de obligaciones laborales, fiscales y de Seguridad Social (art. 6.1.b y c RGPD).',
      ),
    ],
    [
      th('Datos tratados'),
      tc('Identificativos y correo electrónico particular.'),
      tc(
        'Identificativos, horario/turno, fichajes, incidencias y geolocalización solo al fichar.',
      ),
      tc(
        'Identificativos, contacto, bancarios, académicos/profesionales, cotización, jornada, absentismo y PRL.',
      ),
    ],
    [
      th('Conservación'),
      tc('Mientras se mantenga este sistema o existan responsabilidades legales.'),
      tc('Durante el plazo necesario y el legalmente exigible para control horario.'),
      tc('Durante la relación laboral y los plazos legales de archivo y prescripción.'),
    ],
    [
      th('Destinatarios'),
      tc('Sin cesiones, salvo obligación legal o encargados del tratamiento.'),
      tc('Sin cesiones, salvo obligación legal o encargados del tratamiento.'),
      tc(
        'Administraciones públicas, Seguridad Social, AEAT, bancos, mutuas, servicio de prevención y encargados cuando proceda.',
      ),
    ],
    [
      th('Derechos'),
      tc(
        'Retirada del consentimiento y ejercicio de derechos ante la empresa; reclamación ante la AEPD.',
      ),
      tc('Ejercicio de derechos ante la empresa; reclamación ante la AEPD.'),
      tc('Ejercicio de derechos ante la empresa; reclamación ante la AEPD.'),
    ],
    [
      th('Información operativa'),
      tc('Se usará exclusivamente el correo indicado por la persona trabajadora.'),
      tc('Los errores u olvidos deberán comunicarse mediante incidencia en la app/plataforma.'),
      tc('Acceso restringido al personal autorizado y uso conforme a política interna.'),
    ],
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    content: [
      {
        text: 'BORRADOR PARA REVISIÓN JURÍDICA',
        fontSize: 8,
        color: '#666666',
        margin: [0, 0, 0, 6],
      },
      { text: company.legalName.toUpperCase(), style: 'titleCompany', margin: [0, 0, 0, 8] },
      {
        text: 'INFORMACIÓN MÍNIMA DE PROTECCIÓN DE DATOS Y FUNCIONAMIENTO',
        style: 'titleDoc',
        margin: [0, 0, 0, 10],
      },
      { text: intro, fontSize: 9, margin: [0, 0, 0, 12] },
      {
        table: {
          headerRows: 1,
          widths: ['14%', '29%', '29%', '28%'],
          body: bodyRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#333333',
          vLineColor: () => '#333333',
        },
      },
      { text: '', margin: [0, 0, 0, 14] },
      { text: 'Datos del centro de trabajo: _________________________________', fontSize: 9 },
      { text: 'Nombre y apellidos de la persona trabajadora: _________________________________', fontSize: 9, margin: [0, 6, 0, 0] },
      { text: 'Fecha: ____ / ____ / ______    DNI/NIF: _______________________', fontSize: 9, margin: [0, 6, 0, 0] },
      { text: 'Firma de recepción y conformidad', fontSize: 9, bold: true, margin: [0, 14, 0, 4] },
      { text: '_________________________________________________', fontSize: 9, margin: [0, 0, 0, 12] },
      { text: '☐ Autorizo el tratamiento de mis datos para el envío de nómina por correo electrónico.', fontSize: 8 },
      { text: '☐ No autorizo el tratamiento de mis datos para el envío de nómina por correo electrónico.', fontSize: 8, margin: [0, 2, 0, 0] },
      { text: '☐ Autorizo el tratamiento de mis datos para la geolocalización del registro de jornada.', fontSize: 8, margin: [0, 6, 0, 0] },
      { text: '☐ No autorizo el tratamiento de mis datos para la geolocalización del registro de jornada.', fontSize: 8, margin: [0, 2, 0, 0] },
    ],
    footer: (currentPage, pageCount) => ({
      margin: [40, 0, 40, 0],
      stack: [
        { text: footerLine(company), fontSize: 7, color: '#444444' },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          fontSize: 7,
          color: '#888888',
          alignment: 'right',
        },
      ],
    }),
    styles: {
      titleCompany: { fontSize: 13, bold: true, alignment: 'center', color: primary },
      titleDoc: { fontSize: 11, bold: true, alignment: 'center' },
    },
    defaultStyle: { fontSize: 9 },
  };
}

/**
 * Documento 2: protocolo de registro de jornada (plataforma / app propia).
 * @param {LegalPdfCompany} company
 * @param {LegalPdfBuildOpts} [opts]
 */
export function buildProtocoloRegistroJornadaDocDefinition(company, opts = {}) {
  const primary = opts.primaryColor ?? '#CC0000';
  const fichaje = resolveFichajeProductLabel(opts);

  const sections = [
    `Os informamos de la puesta en marcha del sistema oficial de registro de jornada a través de ${fichaje}. Leed atentamente las siguientes instrucciones para una correcta activación.`,
    '',
    '1. Proceso de alta y acceso (correo electrónico)',
    'Para comenzar a usar el sistema, recibiréis comunicaciones automáticas en vuestro correo con las instrucciones de alta (por ejemplo, enlace de activación y/o credenciales de acceso), según la configuración aplicada por la empresa.',
    '• Seguid las indicaciones del mensaje para confirmar el acceso a la plataforma.',
    '• Conservad usuario y contraseña de forma confidencial.',
    `Recomendación: utilizar ${fichaje} desde un navegador actualizado; si la empresa ofrece la aplicación como PWA (instalable desde el navegador), podéis añadirla al inicio del dispositivo para fichar con mayor comodidad.`,
    '',
    '2. Sincronización con el horario del centro',
    'El sistema se configura según el horario de apertura y cierre de la instalación o el cuadrante asignado. El tiempo de trabajo efectivo se computa conforme a dichas reglas.',
    '',
    '3. Margen de cortesía (5 minutos)',
    'La plataforma puede permitir fichar con un margen de 5 minutos respecto a la hora de entrada y salida (según configuración del centro):',
    '• Entrada: desde 5 minutos antes del inicio del turno.',
    '• Salida/descansos: hasta 5 minutos tras la hora de cierre o inicio de descanso para registrar la salida.',
    '• Fuera de ese margen, el sistema puede bloquear el fichaje directo y exigir incidencia.',
    '',
    '4. Gestión de incidencias (olvidos o errores)',
    'Si llegáis tarde, hay una emergencia u olvidáis fichar a la hora exacta:',
    '1) Entrar en la app/plataforma y abrir una incidencia.',
    '2) Indicar el motivo y la hora real (ej.: "Olvido de fichaje entrada a las 10:00").',
    '',
    '5. Uso responsable y seguridad',
    '• Geolocalización: puede activarse solo en el momento del fichaje para validar presencia en el centro, según configuración.',
    '• Seguridad: el uso del teléfono móvil durante la prestación del servicio debe ajustarse a la normativa interna del centro (PRL y protocolos).',
    '',
    '6. Responsabilidad',
    'Es obligación de cada persona trabajadora asegurar que su jornada quede registrada. La falta de registros o incidencias sin justificar dificulta la gestión de nóminas.',
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    content: [
      {
        text: 'BORRADOR PARA REVISIÓN JURÍDICA',
        fontSize: 8,
        color: '#666666',
        margin: [0, 0, 0, 6],
      },
      {
        text: `PROTOCOLO DE REGISTRO DE JORNADA\n${fichaje}\n${company.legalName.toUpperCase()}`,
        style: 'titleDoc',
        margin: [0, 0, 0, 6],
      },
      { text: 'FECHA: ____ / ____ / ______', fontSize: 9, margin: [0, 0, 0, 14] },
      ...sections.map((line) =>
        line === ''
          ? { text: '', margin: [0, 0, 0, 4] }
          : {
              text: line,
              fontSize: /^(\d+\.|•)/.test(line) ? 9 : 9,
              bold: /^\d+\./.test(line),
              color: /^\d+\./.test(line) ? primary : '#000000',
              margin: [0, 0, 0, line.startsWith('•') || /^\d+\)/.test(line) ? 2 : 4],
            },
      ),
      { text: '', margin: [0, 0, 0, 16] },
      {
        text:
          'Mediante la firma del presente documento, la persona trabajadora declara haber recibido, leído y comprendido la circular informativa relativa al protocolo de registro de jornada.',
        fontSize: 9,
        margin: [0, 0, 0, 12],
      },
      { text: 'CENTRO DE TRABAJO: _______________________________________________', fontSize: 9 },
      { text: 'NOMBRE COMPLETO: _________________________________________________', fontSize: 9, margin: [0, 8, 0, 0] },
      { text: 'DNI / NIE: _______________________', fontSize: 9, margin: [0, 8, 0, 0] },
      { text: 'FIRMADO: _________________________', fontSize: 9, margin: [0, 8, 0, 0] },
    ],
    footer: (currentPage, pageCount) => ({
      margin: [40, 0, 40, 0],
      stack: [
        { text: footerLine(company), fontSize: 7, color: '#444444' },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          fontSize: 7,
          color: '#888888',
          alignment: 'right',
        },
      ],
    }),
    styles: {
      titleDoc: { fontSize: 11, bold: true, alignment: 'center', color: primary },
    },
    defaultStyle: { fontSize: 9 },
  };
}
