import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import sizeOf from 'image-size';
import PDFDocument from 'pdfkit';
import { PresupuestosGuardadosService } from './presupuestos-guardados.service';
import { PrismaService } from '../prisma/prisma.service';

export interface OfertaEconomicaRow {
  descripcion: string;
  mensualidadSinIva: number;
  mensualidadConIva: number;
  anualidadSinIva: number;
  anualidadConIva: number;
}

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const FOOTER_Y = 808;
/** Y pentru numerotare „Pag. x de y” – deasupra liniei De Camino (FOOTER_Y 808) ca să rămână pe pagină. */
const PAGE_NUM_Y = 778;
/** Nombres de meses en español para formatear fechas. */
const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Texto de la página 1.1 PRESENTACIÓN para Decamino. */
const PRESENTACION_DECAMINO: string[] = [
  'Estimado/a Sr./Sra.:',
  'Desde De Camino Servicios Auxiliares S.L. le agradecemos la oportunidad de presentar nuestra propuesta de servicios para su comunidad.',
  'Contamos con más de 15 años de experiencia prestando servicios en comunidades de propietarios, empresas y establecimientos, gestionando actualmente más de 250 centros. Nuestro trabajo se basa en un principio claro: que la comunidad funcione correctamente sin generar preocupaciones al administrador ni a los vecinos.',
  'Nuestro objetivo no es únicamente realizar tareas, sino garantizar el buen funcionamiento diario de la finca mediante control, seguimiento y resolución rápida de incidencias. Para ello, cada servicio se implanta de forma organizada y supervisada por nuestro equipo técnico, asegurando continuidad y estabilidad desde el primer día.',
  'Disponemos de personal especializado en cada área y protocolos de actuación que permiten mantener un nivel constante de calidad, reduciendo avisos, quejas y problemas operativos.',
  'La empresa permanece operativa las 24 horas del día, los 365 días del año, permitiendo atender cualquier incidencia con rapidez y eficacia.',
  'Quedamos a su disposición para cualquier aclaración adicional.',
  'Atentamente,',
  'A. Elsayed',
  'De Camino Servicios Auxiliares S.L.',
];

/** Texto de la página 1.1 PRESENTACIÓN para HERA. Puedes editar este array para ajustar el texto. */
const PRESENTACION_HERA: string[] = [
  'Estimado/a Sr./Sra.:',
  'Desde HERA Facility le agradecemos la oportunidad de presentar nuestra propuesta de servicios para su comunidad.',
  'Nuestra empresa está especializada en la gestión integral de servicios auxiliares para comunidades de propietarios y empresas. Trabajamos con un compromiso constante de calidad y cercanía con el cliente.',
  'Nuestro objetivo es ofrecer soluciones adaptadas a sus necesidades, con un equipo cualificado y protocolos de actuación que garantizan el correcto funcionamiento de las instalaciones y la resolución ágil de incidencias.',
  'Ponemos a su disposición nuestra experiencia y medios para que la comunidad funcione con normalidad y sin preocupaciones añadidas para el administrador o los vecinos.',
  'Quedamos a su disposición para cualquier aclaración adicional.',
  'Atentamente,',
  'HERA Facility',
];

/** 2.1 SERVICIO DE AUXILIARES DE SERVICIOS – texto Decamino. */
const AUXILIARES_DECAMINO = {
  intro1:
    'Nuestro servicio de Auxiliares de Servicios está orientado a garantizar la tranquilidad, el control diario y la correcta convivencia dentro de la comunidad, actuando como punto de apoyo permanente para vecinos, administración y proveedores.',
  intro2:
    'El auxiliar se convierte en la figura visible de la comunidad, previniendo incidencias antes de que se conviertan en problemas y ofreciendo una atención cercana y profesional.',
  funciones: [
    'Control de accesos y supervisión de personas ajenas a la finca.',
    'Supervisión y seguimiento de trabajos realizados por proveedores.',
    'Atención y asistencia a residentes que requieran su presencia.',
    'Realización de rondas preventivas en diferentes horarios.',
    'Comunicación inmediata de desperfectos o averías a la administración.',
    'Aviso a servicios técnicos o de emergencia cuando sea necesario.',
    'Apoyo en situaciones de molestias o incidencias vecinales.',
    'Supervisión básica de instalaciones comunes (garajes, zonas comunes, sistemas comunitarios).',
  ],
  apoyo: [
    'Sustitución de bombillas y luminarias (material a cargo de la comunidad).',
    'Revisión y limpieza básica de rejillas de desagüe obstruidas.',
    'Conocimiento de la ubicación de llaves de corte de agua, luz y gas para casos de emergencia.',
    'Información periódica a la Junta de Gobierno sobre incidencias y estado general de la finca.',
  ],
  beneficios: [
    'Mayor tranquilidad y control diario',
    'Prevención de conflictos y actos vandálicos',
    'Mejora de la convivencia vecinal',
    'Supervisión constante del estado del edificio',
    'Imagen cuidada y profesional de la comunidad',
  ],
  marco:
    'El servicio se presta conforme a la normativa vigente, sin realizar funciones reservadas al personal de seguridad privada según lo establecido en la legislación aplicable, incluyendo el Real Decreto 2364/1994 y normativa complementaria.',
};

/** 2.1 SERVICIO DE AUXILIARES DE SERVICIOS – texto HERA. */
const AUXILIARES_HERA = {
  intro1:
    'El servicio de Auxiliares de Servicios está diseñado para ofrecer apoyo continuo en la gestión diaria de la comunidad, contribuyendo al orden, la seguridad básica y el bienestar de los residentes.',
  intro2:
    'El auxiliar actúa como enlace directo entre vecinos, administración y proveedores, garantizando una atención eficiente y una supervisión constante de las instalaciones, con un enfoque preventivo y resolutivo.',
  funciones: [
    'Control y registro de accesos a la comunidad.',
    'Supervisión de entradas y salidas de personal externo.',
    'Apoyo y atención a vecinos ante incidencias cotidianas.',
    'Realización de rondas periódicas para detectar posibles anomalías.',
    'Seguimiento de trabajos realizados por empresas externas.',
    'Comunicación de incidencias, averías o desperfectos a la administración.',
    'Gestión de avisos a servicios técnicos cuando sea necesario.',
    'Intervención básica ante conflictos o molestias entre residentes.',
    'Vigilancia general del estado de zonas comunes e instalaciones.',
  ],
  apoyo: [
    'Sustitución de elementos básicos de iluminación en zonas comunes.',
    'Limpieza y revisión de puntos críticos como desagües o accesos.',
    'Conocimiento operativo de instalaciones para actuar en emergencias.',
    'Colaboración en el control del correcto funcionamiento de servicios comunitarios.',
    'Reporte periódico del estado general del edificio a la administración.',
  ],
  beneficios: [
    'Mayor control operativo del día a día',
    'Reducción de incidencias y respuesta rápida ante problemas',
    'Mejora del ambiente y la convivencia vecinal',
    'Supervisión constante del estado de las instalaciones',
    'Refuerzo de la imagen y organización de la comunidad',
  ],
  marco:
    'El servicio se desarrolla conforme a la legislación vigente, sin asumir funciones propias del personal de seguridad privada, respetando lo dispuesto en la normativa aplicable, incluyendo el Real Decreto 2364/1994 y disposiciones complementarias.',
};

/** 2.2 SERVICIO DE LIMPIEZA DE COMUNIDADES – texto Decamino. */
const LIMPIEZA_DECAMINO = {
  intro1:
    'El servicio de limpieza está diseñado para mantener la finca en condiciones óptimas de higiene, imagen y salubridad, garantizando un mantenimiento continuo de las zonas comunes y evitando la acumulación de suciedad o deterioro prematuro de las instalaciones.',
  intro2:
    'Nuestro objetivo es que la comunidad permanezca siempre en buen estado, sin depender de avisos constantes por parte de vecinos o administradores.',
  seccionFunc: 'Funcionamiento del servicio',
  func1:
    'El personal asignado realiza un mantenimiento periódico siguiendo un plan de trabajo establecido, adaptado a las características del edificio y supervisado regularmente para asegurar la calidad del servicio.',
  func2: 'Las tareas pueden ajustarse según necesidades de la comunidad.',
  freqDiaria: 'Frecuencia diaria',
  diaria: [
    'Barrido y fregado de suelos',
    'Limpieza de escaleras interiores',
    'Limpieza de ascensor',
    'Limpieza de huellas en barandillas, buzones e interruptores',
    'Limpieza de cristales de acceso',
    'Vaciado de publicidad',
  ],
  freqAlterna: 'Frecuencia alterna',
  alterna: [
    'Limpieza de puerta de acceso',
    'Desempolvado de puntos de luz',
    'Limpieza de elementos decorativos',
    'Limpieza de patios',
  ],
  beneficios: [
    'Mejora de la imagen del edificio',
    'Prevención de malos olores y suciedad acumulada',
    'Reducción de quejas vecinales',
    'Mayor conservación de las instalaciones',
    'Servicio estable sin depender de una sola persona',
  ],
  cierre:
    'El plan de trabajo puede adaptarse a las necesidades específicas de cada comunidad.',
};

/** 2.2 SERVICIO DE LIMPIEZA DE COMUNIDADES – texto HERA. */
const LIMPIEZA_HERA = {
  intro1:
    'El servicio de limpieza de comunidades tiene como finalidad asegurar el correcto estado de higiene, orden y conservación de las zonas comunes, aportando una imagen cuidada y un entorno agradable para todos los residentes.',
  intro2:
    'Se trata de un servicio continuo y organizado, que evita la acumulación de suciedad y garantiza el mantenimiento regular del edificio sin necesidad de intervenciones puntuales o avisos constantes.',
  seccionFunc: 'Organización del servicio',
  func1:
    'El personal de limpieza actúa conforme a un plan de trabajo previamente definido, adaptado a las características de cada comunidad y revisado periódicamente para garantizar un alto nivel de calidad.',
  func2:
    'Las tareas y frecuencias pueden ajustarse en función de las necesidades específicas del inmueble.',
  freqDiaria: 'Frecuencia diaria',
  diaria: [
    'Limpieza y fregado de suelos en zonas comunes',
    'Limpieza de escaleras y rellanos',
    'Mantenimiento de limpieza en ascensores',
    'Eliminación de huellas en superficies de contacto (barandillas, interruptores, buzones)',
    'Limpieza de accesos y zonas de entrada',
    'Retirada de publicidad y residuos en buzones',
  ],
  freqAlterna: 'Frecuencia periódica',
  alterna: [
    'Limpieza de puertas de acceso y elementos exteriores',
    'Desempolvado de luminarias y puntos de luz',
    'Limpieza de elementos decorativos y mobiliario común',
    'Mantenimiento de patios interiores o zonas abiertas',
  ],
  beneficios: [
    'Mejora continua de la imagen y presentación del edificio',
    'Mayor nivel de higiene y salubridad',
    'Disminución de incidencias relacionadas con la suciedad',
    'Conservación a largo plazo de las instalaciones',
    'Servicio profesional, constante y organizado',
  ],
  cierre:
    'El plan de limpieza se adapta en todo momento a las características y exigencias de cada comunidad, garantizando flexibilidad y eficacia en el servicio.',
};

/** 2.3 SERVICIO DE JARDINERÍA – texto Decamino. */
const JARDINERIA_DECAMINO = {
  intro1:
    'El servicio de jardinería está orientado a la conservación estética y sanitaria de las zonas verdes, garantizando durante todo el año un correcto estado del jardín y evitando su deterioro progresivo.',
  intro2:
    'El mantenimiento se realiza de forma periódica, adaptándose a las estaciones y necesidades de cada zona ajardinada.',
  trabajos: [
    'Eliminación de malas hierbas mediante medios manuales o mecánicos según superficie',
    'Recorte y perfilado de zonas verdes',
    'Limpieza de hojas y restos vegetales',
    'Retirada de brotes no deseados (chupones)',
    'Control y revisión del sistema de riego',
    'Aviso de averías y posibilidad de reparación (materiales no incluidos)',
  ],
  tratamientos: [
    'Dos tratamientos fitosanitarios preventivos anuales con productos homologados (incluidos)',
    'Abonado orgánico anual incluido',
    'Poda anual de arbolado hasta 3 metros de altura',
  ],
  beneficios: [
    'Jardín cuidado durante todo el año',
    'Prevención de plagas y deterioro',
    'Mejora estética de la finca',
    'Mayor durabilidad de plantas y césped',
    'Reducción de incidencias por riego o suciedad',
  ],
  condiciones: [
    'El consumo de agua será por cuenta de la comunidad',
    'La retirada de restos de poda mediante camión no está incluida',
  ],
};

/** 2.3 SERVICIO DE JARDINERÍA – texto HERA. */
const JARDINERIA_HERA = {
  intro1:
    'El servicio de jardinería está enfocado al mantenimiento integral de las zonas verdes, asegurando su buen estado tanto a nivel estético como funcional durante todo el año.',
  intro2:
    'A través de un mantenimiento planificado y adaptado a cada temporada, se garantiza la conservación del jardín, evitando el deterioro de las plantas y manteniendo un entorno cuidado y agradable.',
  trabajos: [
    'Eliminación de malas hierbas mediante técnicas manuales o mecánicas según las necesidades',
    'Recorte y perfilado de césped y zonas ajardinadas',
    'Limpieza general de hojas, ramas y residuos vegetales',
    'Eliminación de brotes no deseados en árboles y arbustos',
    'Revisión periódica del sistema de riego',
    'Detección y comunicación de averías, con opción de reparación (materiales no incluidos)',
  ],
  tratamientos: [
    'Aplicación de tratamientos fitosanitarios preventivos anuales con productos autorizados',
    'Abonado orgánico para mejorar la salud del suelo y las plantas',
    'Poda anual de árboles y arbustos hasta una altura máxima de 3 metros',
    'Seguimiento del estado general de la vegetación',
  ],
  beneficios: [
    'Espacios verdes cuidados de forma continua',
    'Prevención de plagas, enfermedades y deterioro del jardín',
    'Mejora visual y valor añadido a la comunidad',
    'Mayor durabilidad de plantas, arbustos y césped',
    'Control del sistema de riego y reducción de incidencias',
  ],
  condiciones: [
    'El consumo de agua necesario para el riego será asumido por la comunidad',
    'La retirada de restos de poda mediante transporte especializado no está incluida en el servicio',
  ],
};

/** 2.4 GESTIÓN DE CUBOS DE BASURA – texto Decamino. */
const CUBOS_DECAMINO = {
  intro1:
    'El servicio de gestión de cubos está orientado a mantener la zona de residuos organizada, limpia y sin molestias para los vecinos, evitando acumulaciones, malos olores y sanciones por incumplimiento de horarios municipales.',
  intro2:
    'Nos encargamos de la correcta retirada y colocación de los contenedores según la normativa local, garantizando comodidad para la comunidad y una buena imagen del edificio.',
  seccionFunc: 'Funcionamiento del servicio',
  func1:
    'El personal asignado realiza la retirada y reposición de cubos en los horarios establecidos por la ordenanza municipal, asegurando que los vecinos siempre dispongan de acceso a los contenedores sin tener que manipularlos.',
  func2: '',
  tareas: [
    'Salida de cubos en horario permitido',
    'Entrada de cubos tras la recogida municipal',
    'Colocación correcta en la zona asignada',
    'Cierre de tapas y ordenación del área de residuos',
    'Limpieza básica del entorno inmediato',
    'Aviso de incidencias (roturas, suciedad excesiva, vandalismo)',
  ],
  beneficios: [
    'Evita sanciones municipales',
    'Elimina molestias para los vecinos',
    'Mejora la higiene del acceso a la finca',
    'Previene malos olores y suciedad',
    'Mayor comodidad diaria',
  ],
  condiciones:
    'El servicio se realizará conforme a la normativa municipal vigente de recogida de residuos.',
};

/** 2.4 GESTIÓN DE CUBOS DE BASURA – texto HERA. */
const CUBOS_HERA = {
  intro1:
    'El servicio de gestión de residuos tiene como objetivo garantizar el correcto uso y mantenimiento de los contenedores comunitarios, manteniendo la zona limpia, ordenada y conforme a la normativa municipal.',
  intro2:
    'Este servicio permite a la comunidad despreocuparse de la manipulación diaria de los cubos, asegurando su correcta colocación y evitando problemas derivados de una gestión inadecuada.',
  seccionFunc: 'Organización del servicio',
  func1:
    'El personal asignado se encarga de la retirada y reposición de los contenedores en los horarios establecidos por el ayuntamiento, cumpliendo en todo momento con la normativa vigente.',
  func2:
    'Se asegura que los cubos estén disponibles cuando sea necesario y correctamente recogidos tras el servicio municipal.',
  tareas: [
    'Colocación de los contenedores en la vía pública dentro del horario autorizado',
    'Retirada de los cubos una vez realizada la recogida municipal',
    'Ubicación correcta en la zona designada por la comunidad',
    'Verificación del cierre de tapas y orden general del área',
    'Mantenimiento básico de limpieza en la zona de residuos',
    'Comunicación de incidencias como daños, suciedad o uso indebido',
  ],
  beneficios: [
    'Cumplimiento de la normativa municipal y prevención de sanciones',
    'Mayor limpieza y orden en la zona de contenedores',
    'Eliminación de molestias para los vecinos',
    'Reducción de olores y acumulación de residuos',
    'Mayor comodidad y mejor imagen del edificio',
  ],
  condiciones:
    'El servicio se prestará de acuerdo con los horarios y requisitos establecidos por la ordenanza municipal correspondiente.',
};

/** 5. CONDICIONES CONTRACTUALES – texto Decamino. */
const CONDICIONES_CONTRACTUALES_DECAMINO = {
  intro:
    'La aprobación del presente presupuesto por parte de la Comunidad de Propietarios tendrá la consideración de acuerdo vinculante entre las partes, adquiriendo carácter contractual desde el inicio efectivo del servicio.',
  secciones: [
    {
      titulo: '1. Inicio y duración',
      parrafos: [
        'El servicio comenzará en la fecha acordada tras la aprobación del presupuesto.',
        'La duración inicial será de 12 meses, prorrogándose automáticamente por periodos anuales salvo comunicación escrita en contrario con un preaviso mínimo de 30 días.',
      ],
    },
    {
      titulo: '2. Condiciones económicas y facturación',
      parrafos: [
        'Los precios indicados no incluyen IVA, aplicándose el tipo vigente en cada momento.',
        'La facturación será mensual mediante recibo domiciliado, realizándose el pago dentro de los últimos 5 días hábiles del mes en curso.',
        'El impago total o parcial de cualquier factura devengará un recargo del 1% sobre la cantidad adeudada, así como los gastos bancarios derivados de su devolución. La empresa podrá suspender temporalmente el servicio hasta su regularización.',
      ],
    },
    {
      titulo: '3. Revisión de precios',
      parrafos: [
        'Los precios están calculados conforme al convenio colectivo aplicable y podrán actualizarse cuando exista:',
        '• modificación legal obligatoria (SMI, convenio, normativa laboral o fiscal)',
        '• cambios en horarios, frecuencia o condiciones del servicio',
        '• variaciones en costes laborales derivados de subrogación',
      ],
    },
    {
      titulo: '4. Subrogación de personal',
      parrafos: [
        'En caso de subrogación, las condiciones económicas podrán adaptarse a las obligaciones legales derivadas del convenio colectivo.',
        'Si la relación laboral del trabajador subrogado finalizara por cualquier causa, el precio del servicio será actualizado conforme a las nuevas condiciones laborales.',
        'En caso de resoluciones judiciales que obliguen al abono de indemnizaciones vinculadas al servicio contratado, la Comunidad asumirá el coste correspondiente al tratarse de obligaciones derivadas de su contratación.',
      ],
    },
    {
      titulo: '5. Obligaciones de la Comunidad',
      parrafos: [
        'La Comunidad facilitará acceso a las instalaciones, suministros necesarios y condiciones adecuadas para la correcta prestación del servicio.',
      ],
    },
    {
      titulo: '6. Responsabilidad',
      parrafos: [
        'La empresa no será responsable de daños derivados del estado previo de las instalaciones, uso indebido por terceros o incidencias ajenas al servicio contratado.',
      ],
    },
    {
      titulo: '7. Normativa aplicable',
      parrafos: [
        'El servicio se prestará conforme a la normativa laboral, prevención de riesgos laborales y demás legislación vigente.',
      ],
    },
    {
      titulo: '8. Servicios no incluidos',
      parrafos: [
        'No se incluyen gestiones documentales CAE o PRL en plataformas externas.',
        'En caso de requerirse, podrán contratarse adicionalmente por 250,00 € + IVA anuales.',
      ],
    },
    {
      titulo: '9. Formalización contractual',
      parrafos: [
        'La aceptación del presupuesto mediante firma manuscrita o electrónica, así como el inicio efectivo del servicio, implicará la plena aceptación de estas condiciones contractuales, considerándose formalizado el contrato de prestación de servicios.',
      ],
    },
  ],
};

/** 5. CONDICIONES CONTRACTUALES – texto HERA. */
const CONDICIONES_CONTRACTUALES_HERA = {
  intro:
    'La aceptación del presente presupuesto por parte de la Comunidad de Propietarios supondrá la formalización de un acuerdo vinculante entre ambas partes, adquiriendo carácter contractual desde el inicio de la prestación del servicio.',
  secciones: [
    {
      titulo: '1. Inicio y duración',
      parrafos: [
        'El servicio dará comienzo en la fecha acordada tras la aprobación del presupuesto.',
        'El contrato tendrá una duración inicial de 12 meses, renovándose automáticamente por periodos anuales, salvo notificación por escrito con un preaviso mínimo de 30 días.',
      ],
    },
    {
      titulo: '2. Condiciones económicas y facturación',
      parrafos: [
        'Los importes indicados no incluyen IVA, aplicándose el tipo impositivo vigente en el momento de la facturación.',
        'La facturación se realizará con carácter mensual mediante domiciliación bancaria, efectuándose el cobro dentro de los últimos días hábiles del mes correspondiente.',
        'El retraso o impago de cualquier factura podrá generar un recargo del 1% sobre el importe pendiente, así como los costes derivados de su devolución. La empresa se reserva el derecho de suspender temporalmente el servicio hasta la regularización de la deuda.',
      ],
    },
    {
      titulo: '3. Actualización de precios',
      parrafos: [
        'Los precios establecidos están sujetos a revisión en los siguientes supuestos:',
        '• Cambios en la normativa laboral o fiscal aplicable (SMI, convenios colectivos, etc.)',
        '• Modificación de las condiciones del servicio (horarios, frecuencia, alcance)',
        '• Incrementos en los costes laborales derivados de procesos de subrogación',
      ],
    },
    {
      titulo: '4. Subrogación de personal',
      parrafos: [
        'En caso de subrogación de trabajadores, las condiciones económicas del servicio podrán ajustarse conforme a las obligaciones establecidas en el convenio colectivo correspondiente.',
        'Si la relación laboral del personal subrogado finalizara por cualquier motivo, el precio del servicio será revisado en función de las nuevas condiciones laborales aplicables.',
        'Asimismo, cualquier obligación económica derivada de resoluciones judiciales relacionadas con dicho personal será asumida por la Comunidad, al estar vinculada directamente al servicio contratado.',
      ],
    },
    {
      titulo: '5. Obligaciones de la Comunidad',
      parrafos: [
        'La Comunidad se compromete a facilitar el acceso a las instalaciones, así como los medios y suministros necesarios para el correcto desarrollo del servicio.',
      ],
    },
    {
      titulo: '6. Responsabilidad',
      parrafos: [
        'La empresa no asumirá responsabilidad por daños ocasionados por el estado previo de las instalaciones, el uso indebido por terceros o situaciones ajenas al servicio contratado.',
      ],
    },
    {
      titulo: '7. Normativa aplicable',
      parrafos: [
        'El servicio se prestará en cumplimiento de la legislación vigente en materia laboral, prevención de riesgos laborales y demás normativa aplicable.',
      ],
    },
    {
      titulo: '8. Servicios no incluidos',
      parrafos: [
        'No están incluidos los servicios de gestión documental CAE o PRL en plataformas externas.',
        'En caso de requerirse, podrán contratarse adicionalmente por un importe de 250,00 € + IVA anuales.',
      ],
    },
    {
      titulo: '9. Formalización del contrato',
      parrafos: [
        'La firma del presupuesto, ya sea de forma manuscrita o electrónica, así como el inicio del servicio, implicará la aceptación íntegra de las presentes condiciones, considerándose formalizado el contrato de prestación de servicios.',
      ],
    },
  ],
};

/** Ruta logo: opțional companyLogoPath din env (COMPANY_LOGO_PATH), apoi căutare logo.png/jpg în assets/public. Pentru PDF folosește doar PNG sau JPEG (nu SVG). Multi-client: pune logo-ul în backend/assets și set COMPANY_LOGO_PATH în .env. */
function getLogoPath(companyLogoPath?: string | null): string | null {
  const name = companyLogoPath && String(companyLogoPath).trim();
  const dirs = [
    path.join(process.cwd(), 'assets'),
    path.join(process.cwd(), '..', 'frontend', 'public'),
    path.join(__dirname, '..', '..', '..', 'assets'),
    path.join(__dirname, '..', '..', '..', '..', 'frontend', 'public'),
  ];
  if (name) {
    for (const dir of dirs) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  const names = ['logo.png', 'logo.jpg', 'logo.jpeg'];
  for (const dir of dirs) {
    for (const n of names) {
      const p = path.join(dir, n);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Dimensiuni imagine logo (PNG/JPEG) sau null. Folosit pentru chenar adaptat la raportul de aspect. */
function getLogoDimensions(
  logoPath: string,
): { width: number; height: number } | null {
  try {
    const buf = fs.readFileSync(logoPath);
    const dims = sizeOf(buf);
    if (dims?.width && dims?.height)
      return { width: dims.width, height: dims.height };
  } catch {
    // ignore
  }
  return null;
}

/** Calculează width/height logo pentru portadă: încadrare în maxW x maxH păstrând raportul de aspect (dreptunghi, nu pătrat fix). */
function getLogoSizeForPortada(
  logoPath: string,
  maxW: number = 280,
  maxH: number = 160,
): { w: number; h: number } {
  const dims = getLogoDimensions(logoPath);
  if (dims && dims.width > 0 && dims.height > 0) {
    const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
    return {
      w: Math.round(dims.width * scale),
      h: Math.round(dims.height * scale),
    };
  }
  return { w: 260, h: 260 };
}

/** Ruta banda servicios (backend/assets/servicios.png) */
function getServiciosStripPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'assets', 'servicios.png'),
    path.join(__dirname, '..', '..', 'assets', 'servicios.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Las 3 imágenes PISCINA (igual que en informes): backend/assets/PISCINA1.png, PISCINA2.png, PISCINA3.png */
function getPiscinaStripPaths(): [string | null, string | null, string | null] {
  const bases = [
    path.join(process.cwd(), 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
  ];
  const find = (name: string): string | null => {
    for (const base of bases) {
      const p = path.join(base, name);
      if (fs.existsSync(p)) return p;
    }
    return null;
  };
  return [find('PISCINA1.png'), find('PISCINA2.png'), find('PISCINA3.png')];
}

/** Ruta ștampilă pentru chenarul EMPRESA (Aceptación). COMPANY_STAMP_PATH din env sau fallback la stampila*. */
function getStampPath(): string | null {
  const envStamp = (process.env.COMPANY_STAMP_PATH || '').trim();
  const candidates = [
    path.join(process.cwd(), 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
    path.join(process.cwd(), '..', 'frontend', 'public'),
    process.cwd(),
    path.join(process.cwd(), '..'),
    path.join(__dirname, '..', '..', '..'),
  ];
  if (envStamp) {
    for (const dir of candidates) {
      const p = path.join(dir, envStamp);
      if (fs.existsSync(p)) return p;
    }
  }
  const names = [
    'stampila-2-image2.jpeg',
    'stampila-2-image2.jpg',
    'stampila.jpeg',
    'stampila.jpg',
  ];
  for (const dir of candidates) {
    for (const name of names) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Ruta stamp pentru company. forceKey permite cerere cu ?company=hera când backend rulează cu .env Decamino. */
function getStampPathForCompany(
  company: {
    presupuestoPresentacionKey?: string;
    stampPath?: string;
    stampPathHera?: string;
  } | null,
  forceKey?: 'decamino' | 'hera',
): string | null {
  const candidates = [
    path.join(process.cwd(), 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
    path.join(process.cwd(), '..', 'frontend', 'public'),
    process.cwd(),
    path.join(process.cwd(), '..'),
    path.join(__dirname, '..', '..', '..'),
  ];
  const key = forceKey ?? (company as any)?.presupuestoPresentacionKey;
  const name =
    key === 'hera'
      ? (company as any)?.stampPathHera ||
        (company as any)?.stampPath ||
        'stampila_hera-removebg-preview.png'
      : (company as any)?.stampPath;
  if (name && String(name).trim()) {
    for (const dir of candidates) {
      const p = path.join(dir, String(name).trim());
      if (fs.existsSync(p)) return p;
    }
  }
  // Când e HERA nu cădem niciodată pe stampila Decamino (getStampPath găsește stampila.jpeg)
  if (key === 'hera') return null;
  return getStampPath();
}

/** Deriva el tipo de servicio desde el nombre */
function derivarTipoDesdeServicio(
  nombre: string,
): 'auxiliares' | 'limpieza' | 'jardineria' | 'cubos' | 'piscina' {
  const n = String(nombre || '').toLowerCase();
  if (/limpieza/.test(n)) return 'limpieza';
  if (/jardin/.test(n)) return 'jardineria';
  if (/cubos|basura/.test(n)) return 'cubos';
  if (/piscina/.test(n)) return 'piscina';
  return 'auxiliares';
}

/** Datos de la firma para rellenar la página de aceptación y la portada del PDF firmado. */
export interface DatosFirmaAceptacion {
  fecha_hora: string;
  nombre_representante: string;
  /** Cargo del representante (Presidente, Administrador, etc.). */
  cargo?: string;
  nombre_comunidad: string;
  firma_base64: string;
  /** Dirección del formulario de firma; en PDF firmado se usa en la portada para evitar duplicados. */
  direccion?: string;
  /** CIF indicado en el formulario de firma; si no viene, se usa el de la BD del cliente. */
  cif?: string;
  /** IBAN indicado en el formulario de firma; si no viene, se usa el de la BD del cliente. */
  iban?: string;
  /** Fecha de inicio del servicio (YYYY-MM-DD). */
  fecha_inicio_servicio?: string;
  /** Solo piscina: nombre del presidente. */
  nombre_presidente?: string;
  /** Solo piscina: DNI del presidente. */
  dni_presidente?: string;
  /** Teléfono (formulario firma). */
  telefono?: string;
  /** Solo piscina: número de viviendas. */
  n_viviendas?: string;
  /** Solo piscina: recogida llaves instalaciones. */
  recogida_llaves?: string;
}

@Injectable()
export class PresupuestoDocumentoService {
  private readonly logger = new Logger(PresupuestoDocumentoService.name);

  constructor(
    private readonly presupuestosGuardadosService: PresupuestosGuardadosService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getCompany() {
    return this.configService.get('company') ?? {};
  }

  /** Key efectiv pentru acest PDF: din opciones.companyKey (cerere ?company=hera) sau din env. */
  private _pdfCompanyKey: 'decamino' | 'hera' | null = null;
  private getPresupuestoKey(): 'decamino' | 'hera' {
    return (
      this._pdfCompanyKey ??
      ((this.getCompany() as any)?.presupuestoPresentacionKey as
        | 'decamino'
        | 'hera') ??
      'decamino'
    );
  }

  /** Párrafos de la página 1.1 PRESENTACIÓN según cliente (Decamino o HERA). */
  private getPresentacionParas(): string[] {
    const key = this.getPresupuestoKey();
    return key === 'hera' ? [...PRESENTACION_HERA] : [...PRESENTACION_DECAMINO];
  }

  /** Număr de presupuesto asociat la ID: dacă e deja salvat îl folosim, altfel îl generăm (MAD+an+ID) și îl salvăm. */
  private async getOrAssignNumeroPresupuesto(id: number): Promise<string> {
    const presupuesto = await this.presupuestosGuardadosService.findOne(id);
    const existing = presupuesto.numero_presupuesto;
    if (existing && String(existing).trim()) return String(existing).trim();
    const numero = `MAD${new Date().getFullYear()}${String(id).padStart(4, '0')}`;
    await this.presupuestosGuardadosService.update(id, {
      numero_presupuesto: numero,
    });
    return numero;
  }

  /** PDF: portadă + pagina 2 INDICE (serviciile din 2.1, 2.2... din oferta contractată). Si opciones?.datosFirma, la página ACEPTACIÓN se rellena con fecha, por el cliente, empresa (cliente), y la imagen de firma en la casilla CLIENTE. */
  async generarPdf(
    id: number,
    opciones?: {
      /** Forțează company pentru logo/stamp/text (ex. ?company=hera când backend e Decamino). */
      companyKey?: 'decamino' | 'hera';
      datosFirma?: DatosFirmaAceptacion;
      /** Când e setat, se adaugă bloc Evidencias (huellas SHA-256, fecha Madrid, ID). Dacă incluzi signed_pdf_sha256, se afișează acel hash (nu placeholder). */
      evidencias?: {
        original_pdf_sha256: string;
        original_pdf_size_bytes: number;
        signed_pdf_sha256?: string;
        signed_pdf_size_bytes?: number;
      };
    },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const company = this.getCompany() as any;
    this._pdfCompanyKey =
      (opciones?.companyKey ??
        company?.presupuestoPresentacionKey ??
        'decamino') === 'hera'
        ? 'hera'
        : 'decamino';
    try {
      const presupuesto = await this.presupuestosGuardadosService.findOne(id);
      const datosFirma = opciones?.datosFirma;
      const evidencias = opciones?.evidencias;
      const clienteNombre =
        (presupuesto.cliente_nombre || '').trim() || 'Cliente';
      const nombre = (presupuesto.nombre || 'Presupuesto').replace(
        /[/\\?%*:|"<>]/g,
        '-',
      );
      const numeroPresupuesto = await this.getOrAssignNumeroPresupuesto(id);
      const payload = (presupuesto.payload || {}) as Record<string, unknown>;

      let clienteDireccionLineas: string[] = [];
      let ibanCliente: string | null = null;
      let nifCliente: string | null = null;
      if (presupuesto.cliente_id != null) {
        const cliente = await this.prisma.clientes.findUnique({
          where: { id: presupuesto.cliente_id },
          select: {
            DIRECCION: true,
            CODIGO_POSTAL: true,
            POBLACION: true,
            PROVINCIA: true,
            PAIS: true,
            CUENTAS_BANCARIAS: true,
            NIF: true,
          },
        });
        if (cliente) {
          const parts: string[] = [];
          const dir =
            cliente.DIRECCION != null ? String(cliente.DIRECCION).trim() : '';
          if (dir) parts.push(dir);
          const cp =
            cliente.CODIGO_POSTAL != null
              ? String(cliente.CODIGO_POSTAL).trim()
              : '';
          const pob =
            cliente.POBLACION != null ? String(cliente.POBLACION).trim() : '';
          if (cp || pob) parts.push([cp, pob].filter(Boolean).join(' '));
          const prov =
            cliente.PROVINCIA != null ? String(cliente.PROVINCIA).trim() : '';
          if (prov) parts.push(prov);
          const pais = cliente.PAIS != null ? String(cliente.PAIS).trim() : '';
          if (pais) {
            const p = pais.toUpperCase();
            if (p !== 'ESPAÑA' && p !== 'ESPANA') parts.push(pais);
          }
          clienteDireccionLineas = parts;
          if (cliente.CUENTAS_BANCARIAS != null) {
            const raw = String(cliente.CUENTAS_BANCARIAS).trim();
            ibanCliente = raw ? raw.split(/\r?\n/)[0]?.trim() || raw : null;
          }
          if (cliente.NIF != null) {
            const nif = String(cliente.NIF).trim();
            if (nif) nifCliente = nif;
          }
        }
      } else {
        // Cliente nuevo: dirección desde el payload del presupuesto
        const dir =
          (payload.presupuestoClienteDireccion != null
            ? String(payload.presupuestoClienteDireccion).trim()
            : '') || '';
        const cp =
          (payload.presupuestoClienteCodigoPostal != null
            ? String(payload.presupuestoClienteCodigoPostal).trim()
            : '') || '';
        const pob =
          (payload.presupuestoClientePoblacion != null
            ? String(payload.presupuestoClientePoblacion).trim()
            : '') || '';
        const prov =
          (payload.presupuestoClienteProvincia != null
            ? String(payload.presupuestoClienteProvincia).trim()
            : '') || '';
        if (dir) clienteDireccionLineas.push(dir);
        if (cp || pob)
          clienteDireccionLineas.push([cp, pob].filter(Boolean).join(' '));
        if (prov) clienteDireccionLineas.push(prov);
      }

      // Si el PDF es el firmado, la portada usa nombre y dirección del formulario de firma (evita "test cliente" y direcciones duplicadas)
      let nombrePortada = clienteNombre;
      let direccionPortadaLineas = clienteDireccionLineas;
      if (datosFirma) {
        if (datosFirma.nombre_comunidad?.trim())
          nombrePortada = datosFirma.nombre_comunidad.trim();
        if (datosFirma.direccion?.trim()) {
          direccionPortadaLineas = [datosFirma.direccion.trim()];
        }
      }

      // Serviciile contractate din ofertă → pentru INDICE "2. DESCRIPCIÓN OPERATIVA" (2.1, 2.2...)
      let ofertaEconomica = (payload.ofertaEconomica ||
        []) as OfertaEconomicaRow[];
      // Si oferta economica no viene en payload o está vacía, construir desde selectedServicios + calculo
      if (!Array.isArray(ofertaEconomica) || ofertaEconomica.length === 0) {
        const selectedServicios = (payload.selectedServiciosPresupuesto ||
          []) as Array<{ nombre?: string }>;
        const presupuestoCalculoLimpieza =
          (payload.presupuestoCalculoLimpieza || {}) as Record<string, unknown>;
        const presupuestoCalculoLimpiezaRest =
          (payload.presupuestoCalculoLimpiezaRest || []) as Record<
            string,
            unknown
          >[];
        const presupuestoCalculo = (payload.presupuestoCalculo || {}) as Record<
          string,
          unknown
        >;
        const presupuestoCalculoAuxiliaresRest =
          (payload.presupuestoCalculoAuxiliaresRest || []) as Record<
            string,
            unknown
          >[];
        const presupuestoCalculoJardineria =
          (payload.presupuestoCalculoJardineria || {}) as Record<
            string,
            unknown
          >;
        const presupuestoCalculoJardineriaRest =
          (payload.presupuestoCalculoJardineriaRest || []) as Record<
            string,
            unknown
          >[];
        const presupuestoCalculoCubos = (payload.presupuestoCalculoCubos ||
          {}) as Record<string, unknown>;
        const presupuestoCalculoCubosRest =
          (payload.presupuestoCalculoCubosRest || []) as Record<
            string,
            unknown
          >[];
        const presupuestoCalculoPiscina = (payload.presupuestoCalculoPiscina ||
          {}) as Record<string, unknown>;
        const presupuestoCalculoPiscinaRest =
          (payload.presupuestoCalculoPiscinaRest || []) as Record<
            string,
            unknown
          >[];
        const limpiezaAll = [
          presupuestoCalculoLimpieza,
          ...presupuestoCalculoLimpiezaRest,
        ];
        const auxiliaresAll = [
          presupuestoCalculo,
          ...presupuestoCalculoAuxiliaresRest,
        ];
        const jardineriaAll = [
          presupuestoCalculoJardineria,
          ...presupuestoCalculoJardineriaRest,
        ];
        const cubosAll = [
          presupuestoCalculoCubos,
          ...presupuestoCalculoCubosRest,
        ];
        const piscinaAll = [
          presupuestoCalculoPiscina,
          ...presupuestoCalculoPiscinaRest,
        ];
        let iA = 0,
          iL = 0,
          iJ = 0,
          iC = 0,
          iP = 0;
        const serviceTitles: Record<string, string> = {
          auxiliares: 'Auxiliar de Servicios',
          limpieza: 'Servicio de limpieza',
          jardineria: 'Jardinería',
          cubos: 'Gestión cubos de basura',
          piscina: 'Mantenimiento integral piscina comunitaria',
        };
        ofertaEconomica = selectedServicios.map((s) => {
          const tipo = derivarTipoDesdeServicio(s.nombre || '');
          const title =
            serviceTitles[tipo] || (s.nombre as string) || 'Servicio';
          let descripcion = title;
          let mensualidadSinIva = 0,
            mensualidadConIva = 0,
            anualidadSinIva = 0,
            anualidadConIva = 0;
          if (tipo === 'auxiliares') {
            const calc = auxiliaresAll[iA++] as
              | Record<string, unknown>
              | undefined;
            const h = Number(calc?.horasDiarias ?? 8);
            descripcion = `${title} – ${h}h/día los 365 días`;
            // Sin cálculo COSTE en backend, dejamos 0 o se rellena desde front
          } else if (tipo === 'limpieza') {
            const calc = limpiezaAll[iL++] as
              | Record<string, unknown>
              | undefined;
            const n = Number(calc?.numOperarias ?? 2);
            const h = Number(calc?.horasPorDiaPorOperaria ?? 4);
            descripcion = `Limpieza - ${n} personas, ${h}h/día`;
          } else if (tipo === 'jardineria') {
            const calc = jardineriaAll[iJ++] as
              | Record<string, unknown>
              | undefined;
            const precio = Number(calc?.precioSinIva) || 0;
            descripcion =
              calc?.concepto && String(calc.concepto).trim()
                ? `Jardinería - ${String(calc.concepto).trim()}`
                : 'Jardinería';
            mensualidadSinIva = precio;
            mensualidadConIva = precio * 1.21;
            anualidadSinIva = precio * 12;
            anualidadConIva = precio * 12 * 1.21;
          } else if (tipo === 'cubos') {
            const calc = cubosAll[iC++] as Record<string, unknown> | undefined;
            const precio = Number(calc?.precioSinIva) || 0;
            descripcion =
              calc?.concepto && String(calc.concepto).trim()
                ? `Gestión cubos - ${String(calc.concepto).trim()}`
                : 'Gestión cubos de basura';
            mensualidadSinIva = precio;
            mensualidadConIva = precio * 1.21;
            anualidadSinIva = precio * 12;
            anualidadConIva = precio * 12 * 1.21;
          } else if (tipo === 'piscina') {
            const calc = piscinaAll[iP++] as
              | Record<string, unknown>
              | undefined;
            const precio = Number(calc?.precioSinIva) || 0;
            const horas = calc?.horas != null && calc?.horas !== '';
            const dias = calc?.dias != null && calc?.dias !== '';
            const textoPiscina =
              horas && dias
                ? `Mantenimiento verano: ${calc.horas} horas – ${calc.dias} días`
                : calc?.concepto && String(calc.concepto).trim()
                  ? String(calc.concepto).trim()
                  : 'Mantenimiento integral en piscina comunitaria';
            descripcion = `Piscina - ${textoPiscina}`;
            mensualidadSinIva = precio;
            mensualidadConIva = precio * 1.21;
            anualidadSinIva = precio * 12;
            anualidadConIva = precio * 12 * 1.21;
          }
          return {
            descripcion,
            mensualidadSinIva,
            mensualidadConIva,
            anualidadSinIva,
            anualidadConIva,
          };
        });
      }
      let tiposIncluidos = new Set(
        (
          (payload.selectedServiciosPresupuesto || []) as Array<{
            nombre?: string;
          }>
        ).map((s) => derivarTipoDesdeServicio(s.nombre || '')),
      );
      if (tiposIncluidos.size === 0 && ofertaEconomica.length > 0) {
        tiposIncluidos = new Set(
          ofertaEconomica.map((r) =>
            derivarTipoDesdeServicio(r.descripcion || ''),
          ),
        );
      }
      const descripcionOperativaLineas: string[] = [];
      let sub = 1;
      if (tiposIncluidos.has('auxiliares'))
        descripcionOperativaLineas.push(`2.${sub++}  Auxiliar de Servicios`);
      if (tiposIncluidos.has('limpieza'))
        descripcionOperativaLineas.push(`2.${sub++}  Servicio de Limpieza`);
      if (tiposIncluidos.has('jardineria'))
        descripcionOperativaLineas.push(`2.${sub++}  Jardinería`);
      if (tiposIncluidos.has('cubos'))
        descripcionOperativaLineas.push(`2.${sub++}  Gestión Cubos de Basura`);
      if (tiposIncluidos.has('piscina'))
        descripcionOperativaLineas.push(
          `2.${sub++}  Mantenimiento integral piscina comunitaria`,
        );
      if (descripcionOperativaLineas.length === 0)
        descripcionOperativaLineas.push('2.1  (según servicios contratados)');

      const esSoloPiscina =
        tiposIncluidos.size === 1 && tiposIncluidos.has('piscina');

      // Servicios ofertados para pagina 4: lista numerada (1.-, 2.-, ...) cu detalle por servicio
      const selectedServicios = (payload.selectedServiciosPresupuesto ||
        []) as Array<{ nombre?: string }>;
      const presupuestoCalculoLimpieza = (payload.presupuestoCalculoLimpieza ||
        {}) as Record<string, unknown>;
      const presupuestoCalculoLimpiezaRest =
        (payload.presupuestoCalculoLimpiezaRest || []) as Record<
          string,
          unknown
        >[];
      const presupuestoCalculo = (payload.presupuestoCalculo || {}) as Record<
        string,
        unknown
      >;
      const presupuestoCalculoAuxiliaresRest =
        (payload.presupuestoCalculoAuxiliaresRest || []) as Record<
          string,
          unknown
        >[];
      const presupuestoCalculoJardineria =
        (payload.presupuestoCalculoJardineria || {}) as Record<string, unknown>;
      const presupuestoCalculoJardineriaRest =
        (payload.presupuestoCalculoJardineriaRest || []) as Record<
          string,
          unknown
        >[];
      const presupuestoCalculoCubos = (payload.presupuestoCalculoCubos ||
        {}) as Record<string, unknown>;
      const presupuestoCalculoCubosRest =
        (payload.presupuestoCalculoCubosRest || []) as Record<
          string,
          unknown
        >[];
      const presupuestoCalculoPiscina = (payload.presupuestoCalculoPiscina ||
        {}) as Record<string, unknown>;
      const presupuestoCalculoPiscinaRest =
        (payload.presupuestoCalculoPiscinaRest || []) as Record<
          string,
          unknown
        >[];
      const limpiezaAll = [
        presupuestoCalculoLimpieza,
        ...presupuestoCalculoLimpiezaRest,
      ];
      const auxiliaresAll = [
        presupuestoCalculo,
        ...presupuestoCalculoAuxiliaresRest,
      ];
      const jardineriaAll = [
        presupuestoCalculoJardineria,
        ...presupuestoCalculoJardineriaRest,
      ];
      const cubosAll = [
        presupuestoCalculoCubos,
        ...presupuestoCalculoCubosRest,
      ];
      const piscinaAll = [
        presupuestoCalculoPiscina,
        ...presupuestoCalculoPiscinaRest,
      ];

      const serviciosOfertadosParaPagina: {
        title: string;
        bullets: string[];
      }[] = [];
      const serviceTitles: Record<string, string> = {
        auxiliares: 'Auxiliar de Servicios',
        limpieza: 'Servicio de limpieza',
        jardineria: 'Jardinería',
        cubos: 'Gestión cubos de basura',
        piscina: 'Mantenimiento integral piscina comunitaria',
      };
      let idxAux = 0;
      let idxLimp = 0;
      let idxJard = 0;
      let idxCubos = 0;
      let idxPiscina = 0;
      for (const s of selectedServicios) {
        const tipo = derivarTipoDesdeServicio(s.nombre || '');
        const title = serviceTitles[tipo] || tipo;
        const bullets: string[] = [];
        if (tipo === 'limpieza') {
          const calc = limpiezaAll[idxLimp++] as
            | Record<string, unknown>
            | undefined;
          const n = Number(calc?.numOperarias ?? 2);
          const h = Number(calc?.horasPorDiaPorOperaria ?? 4);
          const dias = Number(calc?.diasLaborablesSemana ?? 5);
          const diasStr =
            dias === 5 ? 'de lunes a viernes' : `${dias} días/semana`;
          bullets.push(
            `${n} personas, ${h} horas al día cada una, ${diasStr} - excepto festivos`,
          );
        } else if (tipo === 'auxiliares') {
          const calc = auxiliaresAll[idxAux++] as
            | Record<string, unknown>
            | undefined;
          const h = Number(calc?.horasDiarias ?? 8);
          bullets.push(`${h}h/día los 365 días`);
        } else if (tipo === 'jardineria') {
          const calc = jardineriaAll[idxJard++] as
            | Record<string, unknown>
            | undefined;
          const concepto =
            calc?.concepto != null && String(calc.concepto).trim()
              ? String(calc.concepto).trim()
              : '1 visita semanal. Festivos no incluidos.';
          bullets.push(concepto);
        } else if (tipo === 'cubos') {
          const calc = cubosAll[idxCubos++] as
            | Record<string, unknown>
            | undefined;
          const concepto =
            calc?.concepto != null && String(calc.concepto).trim()
              ? String(calc.concepto).trim()
              : 'Precio según oferta económica.';
          bullets.push(concepto);
        } else if (tipo === 'piscina') {
          const calc = piscinaAll[idxPiscina++] as
            | Record<string, unknown>
            | undefined;
          const horas = calc?.horas != null && calc?.horas !== '';
          const dias = calc?.dias != null && calc?.dias !== '';
          const concepto =
            horas && dias
              ? `Mantenimiento verano: ${calc.horas} horas – ${calc.dias} días.`
              : calc?.concepto != null && String(calc.concepto).trim()
                ? String(calc.concepto).trim()
                : 'Mantenimiento integral en piscina comunitaria.';
          bullets.push(concepto);
        }
        serviciosOfertadosParaPagina.push({ title, bullets });
      }
      if (
        serviciosOfertadosParaPagina.length === 0 &&
        ofertaEconomica.length > 0
      ) {
        ofertaEconomica.forEach((row) => {
          const tipo = derivarTipoDesdeServicio(row.descripcion || '');
          serviciosOfertadosParaPagina.push({
            title: serviceTitles[tipo] || row.descripcion || 'Servicio',
            bullets: [row.descripcion || ''],
          });
        });
      }

      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'A4',
          margin: MARGIN,
          bufferPages: true,
        });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ——— PÁGINA 1: fundal portadă (brandRed sau COMPANY_PORTADA_BG – ex. albastru deschis HERA); titlu, logo, client, strip, contact ———
        const company = this.getCompany();
        const portadaBg = company.portadaBg ?? company.brandRed;
        const portadaTextColor = company.portadaTextColor ?? '#FFFFFF';
        doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(portadaBg);

        // Logo: HERA când getPresupuestoKey()=hera. Nu folosim company.logoPath (Decamino); folosim logoPathHera sau nume standard HERA.
        const isHeraKey = this.getPresupuestoKey() === 'hera';
        const logoPathRaw = isHeraKey
          ? (company as any)?.logoPathHera || 'LOGO_hera.png'
          : company?.logoPath;
        const logoPath = getLogoPath(logoPathRaw);

        // Titlu centrat pe pagină, mai sus (y=40) — anul din anul curent
        const anioPresupuesto = new Date().getFullYear();
        const tituloPortada = `PRESUPUESTO ${anioPresupuesto}`;
        const titleY = 40;
        doc.fillColor(portadaTextColor).font('Helvetica-Bold').fontSize(34);
        doc.text(tituloPortada, 0, titleY, {
          width: PAGE_WIDTH,
          align: 'center',
        });

        // Sub titlu: linie albă + subtítulo (piscina = text fix; rest = servicii presupusate)
        const titleH = doc.heightOfString(tituloPortada, { width: PAGE_WIDTH });
        const lineY = titleY + titleH + 10;
        const lineW = Math.min(280, PAGE_WIDTH - 80);
        doc.strokeColor(portadaTextColor).lineWidth(2);
        doc
          .moveTo((PAGE_WIDTH - lineW) / 2, lineY)
          .lineTo((PAGE_WIDTH + lineW) / 2, lineY)
          .stroke();
        doc.font('Helvetica').fontSize(16);
        // Spațiu sub subtitlu înainte de logo (evită suprapunerea când subtitlul are 2 rânduri, ex. "…JARDINERÍA, GESTIÓN CUBOS DE BASURA")
        const subtitleGap = 28;
        let logoY: number;
        if (esSoloPiscina) {
          doc.text(
            'SERVICIO DE MANTENIMIENTO INTEGRAL EN PISCINA COMUNITARIA',
            0,
            lineY + 14,
            {
              width: PAGE_WIDTH,
              align: 'center',
            },
          );
          logoY = lineY + 14 + 22 + subtitleGap;
        } else {
          const nombresServicios: Record<string, string> = {
            auxiliares: 'Auxiliares de Servicios',
            limpieza: 'Limpieza',
            jardineria: 'Jardinería',
            cubos: 'Gestión Cubos de Basura',
            piscina: 'Piscina',
          };
          const listaServicios = Array.from(tiposIncluidos)
            .map((t) => nombresServicios[t] || t)
            .filter(Boolean);
          const subtituloServicios =
            listaServicios.length > 0
              ? 'SERVICIO DE ' + listaServicios.join(', ').toUpperCase()
              : 'SERVICIOS PRESUPUESTADOS';
          doc.text(subtituloServicios, 0, lineY + 14, {
            width: PAGE_WIDTH,
            align: 'center',
          });
          // Permite 2 rânduri de subtitlu + gap ca să nu se suprapună cu logo-ul
          logoY = lineY + 14 + 44 + subtitleGap;
        }

        // Logo centrat sub titlu: chenar adaptat la raportul de aspect (dreptunghi, nu pătrat fix)
        const { w: logoW, h: logoH } = logoPath
          ? getLogoSizeForPortada(logoPath)
          : { w: 260, h: 260 };
        if (logoPath) {
          try {
            doc.image(logoPath, (PAGE_WIDTH - logoW) / 2, logoY, {
              width: logoW,
              height: logoH,
            });
          } catch {
            // skip
          }
        }

        // Sub logo: spațiu redus ca portada să ocupe mai puțin și să evite pagini goale la multe servicii
        const blockCenterW = PAGE_WIDTH - 80;
        const blockCenterX = 40;
        let belowLogoY = logoY + logoH + 38;
        // Nume client + direccion — en PDF firmado usamos nombre/dirección del formulario de firma
        const clientLines = nombrePortada
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        doc.fillColor(portadaTextColor).font('Helvetica').fontSize(20);
        let clientBlockHeight = 0;
        if (clientLines.length >= 2) {
          doc.text(clientLines[0], blockCenterX, belowLogoY, {
            align: 'center',
            width: blockCenterW,
          });
          const h1 = doc.heightOfString(clientLines[0], {
            width: blockCenterW,
          });
          const line2 = clientLines.slice(1).join(', ');
          doc.text(line2, blockCenterX, belowLogoY + h1 + 6, {
            align: 'center',
            width: blockCenterW,
          });
          const h2 = doc.heightOfString(line2, { width: blockCenterW });
          clientBlockHeight = h1 + 6 + h2;
        } else {
          doc.text(nombrePortada, blockCenterX, belowLogoY, {
            align: 'center',
            width: blockCenterW,
          });
          clientBlockHeight = doc.heightOfString(nombrePortada, {
            width: blockCenterW,
          });
        }
        belowLogoY += clientBlockHeight + 12;
        if (direccionPortadaLineas.length > 0) {
          doc.fontSize(11);
          for (const linea of direccionPortadaLineas) {
            doc.text(linea, blockCenterX, belowLogoY, {
              align: 'center',
              width: blockCenterW,
            });
            belowLogoY += 14;
          }
        }
        belowLogoY += 2;
        doc.font('Helvetica-Bold').fontSize(20);
        doc.text(
          `PRESUPUESTO Nº ${numeroPresupuesto}`,
          blockCenterX,
          belowLogoY,
          {
            align: 'center',
            width: blockCenterW,
            underline: true,
          },
        );
        belowLogoY += 28;
        // Fecha emisión: data creării presupuesto (informe)
        const fechaEmision = presupuesto.created_at
          ? new Date(presupuesto.created_at)
          : new Date();
        const fechaEmisionStr = `${fechaEmision.getDate()} de ${MESES_ES[fechaEmision.getMonth()]} de ${fechaEmision.getFullYear()}`;
        doc.font('Helvetica').fontSize(11);
        doc.text(
          `Fecha emisión: ${fechaEmisionStr}`,
          blockCenterX,
          belowLogoY,
          {
            align: 'center',
            width: blockCenterW,
          },
        );
        belowLogoY += 22;

        // Banda: si es solo piscina → mismas 3 fotos que en informes (PISCINA1/2/3); si no → servicios.png
        const stripW = Math.min(520, blockCenterW);
        const stripH = 72;
        if (esSoloPiscina) {
          const piscinaPaths = getPiscinaStripPaths();
          const haveAllThree =
            piscinaPaths[0] && piscinaPaths[1] && piscinaPaths[2];
          if (haveAllThree) {
            const imgW = stripW / 3;
            const stripX = (PAGE_WIDTH - stripW) / 2;
            try {
              for (let i = 0; i < 3; i++) {
                const p = piscinaPaths[i];
                if (p)
                  doc.image(p, stripX + i * imgW, belowLogoY, {
                    width: imgW,
                    height: stripH,
                  });
              }
              belowLogoY += stripH + 14;
            } catch {
              belowLogoY += 8;
            }
          } else {
            const serviciosStripPath = getServiciosStripPath();
            if (serviciosStripPath) {
              try {
                doc.image(
                  serviciosStripPath,
                  (PAGE_WIDTH - stripW) / 2,
                  belowLogoY,
                  { width: stripW, height: stripH },
                );
                belowLogoY += stripH + 14;
              } catch {
                belowLogoY += 8;
              }
            } else {
              belowLogoY += 8;
            }
          }
        } else {
          const serviciosStripPath = getServiciosStripPath();
          if (serviciosStripPath) {
            try {
              doc.image(
                serviciosStripPath,
                (PAGE_WIDTH - stripW) / 2,
                belowLogoY,
                {
                  width: stripW,
                  height: stripH,
                },
              );
              belowLogoY += stripH + 14;
            } catch {
              belowLogoY += 8;
            }
          } else {
            belowLogoY += 8;
          }
        }

        // Contact sub banda
        doc.font('Helvetica').fontSize(14);
        doc.text(this.getCompany().website ?? '', blockCenterX, belowLogoY, {
          align: 'center',
          width: blockCenterW,
        });
        doc.text(
          `Tfno: ${this.getCompany().phone ?? ''}`,
          blockCenterX,
          belowLogoY + 20,
          {
            align: 'center',
            width: blockCenterW,
          },
        );
        doc.text(this.getCompany().email ?? '', blockCenterX, belowLogoY + 40, {
          align: 'center',
          width: blockCenterW,
        });

        // Footer pe toată lățimea, text portadă (limităm înălțimea ca să nu se creeze pagină goală)
        doc.fontSize(7).fillColor(portadaTextColor).font('Helvetica');
        const footerHeight = PAGE_HEIGHT - FOOTER_Y - 12;
        doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
          height: footerHeight,
          ellipsis: true,
        });

        // ——— PÁGINA 2: INDICE + logo mic stânga sus + filigrană + footer ———
        doc.addPage({ size: 'A4', margin: MARGIN });
        if (logoPath) {
          try {
            doc.opacity(0.1);
            const wmW = 400;
            const wmH = 400;
            doc.image(
              logoPath,
              (PAGE_WIDTH - wmW) / 2,
              (PAGE_HEIGHT - wmH) / 2,
              {
                width: wmW,
                height: wmH,
              },
            );
            doc.opacity(1);
            const smallLogoSize = 56;
            doc.image(logoPath, MARGIN, 40, {
              width: smallLogoSize,
              height: smallLogoSize,
            });
          } catch {
            // skip
          }
        }

        // INDICE — titlu mare, dungă roșie dedesubt, conținut centrat pe pagină, unul sub altul
        const indiceFullWidth = PAGE_WIDTH - MARGIN * 2;
        const contentWidth = 360;
        const contentX = (PAGE_WIDTH - contentWidth) / 2;
        let indiceY = 100;

        // Titlu INDICE mare, centrat (piscina: mai compact ca să încapă pe o pagină)
        const indiceCompact = esSoloPiscina;
        doc
          .fillColor('#1a1a1a')
          .font('Helvetica-Bold')
          .fontSize(indiceCompact ? 26 : 32);
        doc.text('INDICE', MARGIN, indiceY, {
          width: indiceFullWidth,
          align: 'center',
        });
        indiceY += indiceCompact ? 32 : 42;

        const lineWidth = indiceFullWidth * 0.72;
        const lineX = (PAGE_WIDTH - lineWidth) / 2;
        doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
        doc
          .moveTo(lineX, indiceY)
          .lineTo(lineX + lineWidth, indiceY)
          .stroke();
        indiceY += indiceCompact ? 22 : 28;

        const sectionTitleSize = indiceCompact ? 10 : 11;
        const subsectionSize = indiceCompact ? 9 : 9;
        const lineH = indiceCompact ? 19 : 21;
        const gapAfterTitle = indiceCompact ? 8 : 10;
        const sectionGap = indiceCompact ? 20 : 26;
        const subIndent = 18;

        doc.font('Helvetica-Bold').fontSize(sectionTitleSize);
        doc.text('1.  INTRODUCCIÓN', contentX, indiceY, {
          width: contentWidth,
        });
        indiceY += lineH + gapAfterTitle;
        doc.font('Helvetica').fontSize(subsectionSize);
        doc.text('1.1  Carta de Presentación', contentX + subIndent, indiceY, {
          width: contentWidth - subIndent,
        });
        indiceY += lineH;
        doc.text('1.2  Servicios Ofertados', contentX + subIndent, indiceY, {
          width: contentWidth - subIndent,
        });
        indiceY += sectionGap;

        doc.font('Helvetica-Bold').fontSize(sectionTitleSize);
        doc.text('2.  DESCRIPCIÓN OPERATIVA', contentX, indiceY, {
          width: contentWidth,
        });
        indiceY += lineH + gapAfterTitle;
        doc.font('Helvetica').fontSize(subsectionSize);
        const indiceDescripcionLineas = esSoloPiscina
          ? [
              '2.1  Tramitación de apertura',
              '2.2  Puesta en marcha y limpieza inicial',
              '2.3  Condiciones generales',
              '2.4  Personal',
              '2.5  Mantenimiento de verano',
              '2.6  Mantenimiento de invierno',
              '2.7  Horario',
            ]
          : descripcionOperativaLineas;
        for (const linea of indiceDescripcionLineas) {
          doc.text(linea, contentX + subIndent, indiceY, {
            width: contentWidth - subIndent,
          });
          indiceY += lineH;
        }
        indiceY += sectionGap;

        doc.font('Helvetica-Bold').fontSize(sectionTitleSize);
        doc.text('3.  OFERTA ECONÓMICA', contentX, indiceY, {
          width: contentWidth,
        });
        indiceY += lineH + gapAfterTitle;
        doc.font('Helvetica').fontSize(subsectionSize);
        doc.text('3.1  Oferta Económica', contentX + subIndent, indiceY, {
          width: contentWidth - subIndent,
        });
        indiceY += sectionGap;

        doc.font('Helvetica-Bold').fontSize(sectionTitleSize);
        doc.text('4.  GARANTÍA PROFESIONAL', contentX, indiceY, {
          width: contentWidth,
        });
        indiceY += lineH + gapAfterTitle;
        doc.font('Helvetica').fontSize(subsectionSize);
        doc.text(
          '4.1  Seguro de Responsabilidad Civil',
          contentX + subIndent,
          indiceY,
          { width: contentWidth - subIndent },
        );
        indiceY += lineH;
        doc.text(
          '4.2  Obligaciones Tributarias',
          contentX + subIndent,
          indiceY,
          {
            width: contentWidth - subIndent,
          },
        );
        indiceY += lineH;
        doc.text('4.3  Garantía Laboral', contentX + subIndent, indiceY, {
          width: contentWidth - subIndent,
        });
        indiceY += lineH;
        doc.text(
          '4.4  Responsabilidad Social Corporativa',
          contentX + subIndent,
          indiceY,
          { width: contentWidth - subIndent },
        );
        indiceY += lineH;
        if (this.getPresupuestoKey() !== 'hera') {
          doc.text('4.5  Plan de Igualdad', contentX + subIndent, indiceY, {
            width: contentWidth - subIndent,
          });
          indiceY += lineH;
        }
        doc.text(
          '4.6  Cláusulas de Confidencialidad',
          contentX + subIndent,
          indiceY,
          { width: contentWidth - subIndent },
        );
        indiceY += sectionGap;

        if (esSoloPiscina) {
          doc.font('Helvetica-Bold').fontSize(sectionTitleSize);
          doc.text('5.  Aceptación Presupuesto - Contrato', contentX, indiceY, {
            width: contentWidth,
          });
          indiceY += sectionGap;
          doc.text('6.  Fiesta Fin de Temporada', contentX, indiceY, {
            width: contentWidth,
          });
        } else {
          doc.font('Helvetica-Bold').fontSize(sectionTitleSize);
          doc.text(
            '5.  Condiciones Contractuales de Prestación del Servicio',
            contentX,
            indiceY,
            { width: contentWidth },
          );
          indiceY += sectionGap;
          doc.text('6.  Aceptación Presupuesto - Contrato', contentX, indiceY, {
            width: contentWidth,
          });
        }

        // Footer pe pagina 2
        doc.fontSize(7).fillColor('#333333').font('Helvetica');
        doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
          height: PAGE_HEIGHT - FOOTER_Y - 12,
          ellipsis: true,
        });

        // ——— PÁGINA 3: PRESENTACIÓN (același stil ca INDICE — titlu mare, dungă roșie, conținut aerisit)
        doc.addPage({ size: 'A4', margin: MARGIN });
        if (logoPath) {
          try {
            doc.opacity(0.1);
            const wmW = 400;
            const wmH = 400;
            doc.image(
              logoPath,
              (PAGE_WIDTH - wmW) / 2,
              (PAGE_HEIGHT - wmH) / 2,
              {
                width: wmW,
                height: wmH,
              },
            );
            doc.opacity(1);
            const smallLogoSize = 56;
            doc.image(logoPath, MARGIN, 40, {
              width: smallLogoSize,
              height: smallLogoSize,
            });
          } catch {
            // skip
          }
        }

        const presentacionFullWidth = PAGE_WIDTH - MARGIN * 2;
        const presentacionContentWidth = 360;
        const presentacionContentX =
          (PAGE_WIDTH - presentacionContentWidth) / 2;
        let presentacionY = 100;

        doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
        doc.text('1.1  PRESENTACIÓN', MARGIN, presentacionY, {
          width: presentacionFullWidth,
          align: 'center',
        });
        presentacionY += 36;

        const presLineWidth = presentacionFullWidth * 0.72;
        const presLineX = (PAGE_WIDTH - presLineWidth) / 2;
        doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
        doc
          .moveTo(presLineX, presentacionY)
          .lineTo(presLineX + presLineWidth, presentacionY)
          .stroke();
        presentacionY += 36;

        const presentacionParas = this.getPresentacionParas();
        const companyShortName =
          this.getCompany().legalNameShort ?? 'De Camino';

        doc.font('Helvetica-Bold').fontSize(11);
        doc.fillColor('#1a1a1a');
        const paraSpacing = 22;

        const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const companyRegex = new RegExp(`(${esc(companyShortName)})`, 'gi');
        const drawParagraphWithCompanyRed = (
          para: string,
          align: 'left' | 'justify' = 'justify',
        ) => {
          const parts = para.split(companyRegex);
          let firstSegment = true;
          for (let i = 0; i < parts.length; i++) {
            if (parts[i].length === 0) continue;
            const isLast = i === parts.length - 1;
            const opts = {
              width: presentacionContentWidth,
              align,
              continued: !isLast,
            };
            if (parts[i].toLowerCase() === companyShortName.toLowerCase()) {
              doc.fillColor(this.getCompany().brandRed);
              const redText = parts[i] + ' ';
              if (firstSegment)
                doc.text(redText, presentacionContentX, presentacionY, opts);
              else doc.text(redText, opts);
              doc.fillColor('#1a1a1a');
            } else {
              const text =
                i > 0 &&
                parts[i - 1].toLowerCase() === companyShortName.toLowerCase() &&
                parts[i].startsWith(' ')
                  ? parts[i].slice(1)
                  : parts[i];
              if (firstSegment)
                doc.text(text, presentacionContentX, presentacionY, opts);
              else doc.text(text, opts);
            }
            firstSegment = false;
          }
          presentacionY +=
            doc.heightOfString(para, { width: presentacionContentWidth }) +
            paraSpacing;
        };

        for (const para of presentacionParas) {
          const isLeftAlign =
            para === 'Estimado/a Sr./Sra.:' ||
            para === 'Atentamente,' ||
            para === 'A. Elsayed' ||
            para === companyShortName;
          if (isLeftAlign) {
            doc.fillColor('#1a1a1a');
            doc.text(para, presentacionContentX, presentacionY, {
              width: presentacionContentWidth,
              align: 'left',
            });
            presentacionY +=
              doc.heightOfString(para, { width: presentacionContentWidth }) +
              paraSpacing;
          } else {
            drawParagraphWithCompanyRed(para, 'justify');
          }
        }

        doc.fontSize(7).fillColor('#333333').font('Helvetica');
        doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
          height: PAGE_HEIGHT - FOOTER_Y - 12,
          ellipsis: true,
        });

        // ——— PÁGINA 4: SERVICIOS OFERTADOS (același stil — titlu mare, dungă roșie, conținut centrat)
        doc.addPage({ size: 'A4', margin: MARGIN });
        if (logoPath) {
          try {
            doc.opacity(0.1);
            doc.image(
              logoPath,
              (PAGE_WIDTH - 400) / 2,
              (PAGE_HEIGHT - 400) / 2,
              {
                width: 400,
                height: 400,
              },
            );
            doc.opacity(1);
            doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
          } catch {
            // skip
          }
        }

        const servOfertaFullWidth = PAGE_WIDTH - MARGIN * 2;
        const servOfertaContentWidth = 360;
        const servOfertaContentX = (PAGE_WIDTH - servOfertaContentWidth) / 2;
        let servOfertaY = 100;

        doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
        doc.text('1.2  SERVICIOS OFERTADOS', MARGIN, servOfertaY, {
          width: servOfertaFullWidth,
          align: 'center',
        });
        servOfertaY += 36;
        const servLineW = servOfertaFullWidth * 0.72;
        doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
        doc
          .moveTo((PAGE_WIDTH - servLineW) / 2, servOfertaY)
          .lineTo((PAGE_WIDTH - servLineW) / 2 + servLineW, servOfertaY)
          .stroke();
        servOfertaY += 36;

        const servParaSpacing = 20;
        doc.font('Helvetica-Bold').fontSize(11);

        doc.text('ESTIMADO SR/SRA.', servOfertaContentX, servOfertaY, {
          width: servOfertaContentWidth,
          align: 'left',
        });
        servOfertaY +=
          doc.heightOfString('ESTIMADO SR/SRA.', {
            width: servOfertaContentWidth,
          }) + servParaSpacing;

        const introServ =
          'Una vez visitada su comunidad por nuestros técnicos especialistas en cada sector, le enumeramos los servicios que vamos a presupuestar a continuación:';
        doc.font('Helvetica').fontSize(11);
        doc.text(introServ, servOfertaContentX, servOfertaY, {
          width: servOfertaContentWidth,
          align: 'justify',
        });
        servOfertaY +=
          doc.heightOfString(introServ, { width: servOfertaContentWidth }) + 28;

        doc.font('Helvetica-Bold').fontSize(11);
        serviciosOfertadosParaPagina.forEach((item, num) => {
          const titleLine = `${num + 1}.- ${item.title}:`;
          doc.text(titleLine, servOfertaContentX, servOfertaY, {
            width: servOfertaContentWidth,
            align: 'left',
          });
          servOfertaY +=
            doc.heightOfString(titleLine, { width: servOfertaContentWidth }) +
            8;
          doc.font('Helvetica').fontSize(10);
          item.bullets.forEach((b) => {
            doc.text(`- ${b}`, servOfertaContentX + 14, servOfertaY, {
              width: servOfertaContentWidth - 14,
              align: 'left',
            });
            servOfertaY +=
              doc.heightOfString(`- ${b}`, {
                width: servOfertaContentWidth - 14,
              }) + 6;
          });
          doc.font('Helvetica-Bold').fontSize(11);
          servOfertaY += 14;
        });

        // Firma și data la sfârșitul paginii (deasupra footer) — puțin mai sus ca data să nu treacă pe pagina următoare
        const servFirmaY = FOOTER_Y - 100;
        const servFirmaNombre =
          this.getPresupuestoKey() === 'hera' ? 'HERA Facility' : 'A. ELSAYED';
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a');
        doc.text('Atentamente,', servOfertaContentX, servFirmaY, {
          width: servOfertaContentWidth,
          align: 'left',
        });
        doc.text(servFirmaNombre, servOfertaContentX, servFirmaY + 24, {
          width: servOfertaContentWidth,
          align: 'left',
        });
        const fechaHoy = new Date();
        const fechaStr = `${fechaHoy.getDate()} de ${MESES_ES[fechaHoy.getMonth()]} de ${fechaHoy.getFullYear()}`;
        doc.text(fechaStr, servOfertaContentX, servFirmaY + 46, {
          width: servOfertaContentWidth,
          align: 'left',
        });

        doc.fontSize(7).fillColor('#333333').font('Helvetica');
        doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
          height: PAGE_HEIGHT - FOOTER_Y - 12,
          ellipsis: true,
        });

        // ——— PÁGINAS PISCINA: 2.1 Tramitación apertura, 2.2, ... (solo si esSoloPiscina)
        if (esSoloPiscina) {
          // 2.1 TRAMITACIÓN APERTURA
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          const tramFullWidth = PAGE_WIDTH - MARGIN * 2;
          const tramContentWidth = 360;
          const tramContentX = (PAGE_WIDTH - tramContentWidth) / 2;
          let tramY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          doc.text('2.1  TRAMITACIÓN APERTURA', MARGIN, tramY, {
            width: tramFullWidth,
            align: 'center',
          });
          tramY += 36;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const tramLineW = tramFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - tramLineW) / 2, tramY)
            .lineTo((PAGE_WIDTH - tramLineW) / 2 + tramLineW, tramY)
            .stroke();
          tramY += 24;

          const tramSubs: { key: string; text: string }[] = [
            {
              key: '2.1.1',
              text: 'De Camino Servicios Auxiliares S.L. se compromete a realizar la tramitación de la Licencia de la reapertura anual de la piscina y la obtención de los libros de registro oficiales sin coste adicional para la Comunidad.',
            },
            {
              key: '2.1.2',
              text: 'Si los documentos requeridos por el organismo correspondiente para la tramitación de la Licencia de Reapertura de la Piscina no son entregados por la comunidad de propietarios a De Camino Servicios Auxiliares S.L. con una antelación de 25 días a la fecha de apertura al público de la piscina, De Camino Servicios Auxiliares S.L. queda eximida de las posibles sanciones por incumplimientos en los plazos de tramitación de permisos.',
            },
            {
              key: '2.1.3',
              text: 'De Camino Servicios Auxiliares S.L. realizará el tratamiento D.D.D. (Desratización, desinfección y desinsectación) al inicio de temporada, adjuntando el certificado correspondiente en la documentación necesaria para inspección de Sanidad. Sin coste adicional para la Comunidad.',
            },
            {
              key: '2.1.4',
              text: 'En los municipios en los que dicho trámite implique el pago de tasas municipales, el importe correrá por cuenta de la Comunidad. El pago de las tasas puede ser gestionado por De Camino Servicios Auxiliares S.L., facturando el importe de estas a la Comunidad.',
            },
            {
              key: '2.1.5',
              text: 'En caso de que la normativa o Sanidad requiera una analítica de agua al comienzo de la temporada y/o durante la temporada, De Camino Servicios Auxiliares S.L. procederá a realizar la analítica en un laboratorio especializado. El coste de la analítica es de 130,00€ + I.V.A.',
            },
          ];
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          for (const sub of tramSubs) {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(sub.key, tramContentX, tramY, { width: tramContentWidth });
            tramY +=
              doc.heightOfString(sub.key, { width: tramContentWidth }) + 4;
            doc.font('Helvetica').fontSize(10);
            const h = doc.heightOfString(sub.text, { width: tramContentWidth });
            doc.text(sub.text, tramContentX, tramY, {
              width: tramContentWidth,
              align: 'justify',
            });
            tramY += h + 14;
          }

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: tramFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });

          // 2.2 PUESTA EN MARCHA Y LIMPIEZA INICIAL
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          const puestaFullWidth = PAGE_WIDTH - MARGIN * 2;
          const puestaContentWidth = 360;
          const puestaContentX = (PAGE_WIDTH - puestaContentWidth) / 2;
          let puestaY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          const tituloPuesta = '2.2  PUESTA EN MARCHA Y LIMPIEZA INICIAL';
          const puestaTitleH = doc.heightOfString(tituloPuesta, {
            width: puestaFullWidth,
          });
          doc.text(tituloPuesta, MARGIN, puestaY, {
            width: puestaFullWidth,
            align: 'center',
          });
          puestaY += puestaTitleH + 14;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const puestaLineW = puestaFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - puestaLineW) / 2, puestaY)
            .lineTo((PAGE_WIDTH - puestaLineW) / 2 + puestaLineW, puestaY)
            .stroke();
          puestaY += 24;

          const puestaSubs: { key: string; text: string }[] = [
            {
              key: '2.2.1',
              text: 'Limpieza del vaso de la piscina: Se realiza una limpieza a fondo del interior de la piscina para eliminar cualquier suciedad, residuos o algas que puedan haberse acumulado durante el período de inactividad.',
            },
            {
              key: '2.2.2',
              text: 'Puesta en marcha del sistema de filtración: Se enciende y verifica el correcto funcionamiento del sistema de filtración para asegurar que el agua se esté depurando adecuadamente.',
            },
            {
              key: '2.2.3',
              text: 'Equilibrio químico del agua: Se realizan pruebas para medir y ajustar los niveles de pH, cloro, alcalinidad y dureza del agua, garantizando así un equilibrio químico adecuado.',
            },
            {
              key: '2.2.4',
              text: 'Limpieza y revisión de accesorios: Se limpian y revisan los skimmers, bombas, sistemas de iluminación y demás accesorios para asegurar su correcto funcionamiento.',
            },
            {
              key: '2.2.5',
              text: 'Tratamiento de choque: En algunos casos, puede ser necesario aplicar un tratamiento de choque con productos químicos para eliminar bacterias, algas u otros contaminantes presentes en el agua.',
            },
          ];
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          for (const sub of puestaSubs) {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(sub.key, puestaContentX, puestaY, {
              width: puestaContentWidth,
            });
            puestaY +=
              doc.heightOfString(sub.key, { width: puestaContentWidth }) + 4;
            doc.font('Helvetica').fontSize(10);
            const h = doc.heightOfString(sub.text, {
              width: puestaContentWidth,
            });
            doc.text(sub.text, puestaContentX, puestaY, {
              width: puestaContentWidth,
              align: 'justify',
            });
            puestaY += h + 14;
          }

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: puestaFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });

          // 2.3 CONDICIONES GENERALES (piscina) — repartido en 2 páginas si hace falta
          const condGenPiscinaSubs: { key: string; text: string }[] = [
            {
              key: '2.3.1',
              text: 'Los materiales y recambios suministrados sin coste para la Comunidad son propiedad De Camino Servicios Auxiliares S.L. y se dejara en uso de la Comunidad mientras mantenga el contrato en vigor.',
            },
            {
              key: '2.3.2',
              text: 'Si De Camino Servicios Auxiliares S.L. incumpliese injustificadamente los trabajos descritos, demorando los plazos previstos en tiempo superior a 7 días la Comunidad podrá optar por la resolución del contrato, tras el abono de los trabajos realizados hasta ese mismo día.',
            },
            {
              key: '2.3.3',
              text: 'En ningún caso se podrá culpar a De Camino Servicios Auxiliares S.L. el cierre de la piscina por causas relacionadas con averías técnicas, inspecciones de sanidad, condiciones climatológicas o deficiencias estructurales.',
            },
            {
              key: '2.3.4',
              text: 'Todos los gastos de consumo de agua y electricidad de la instalación son por cuenta de la comunidad de propietarios.',
            },
            {
              key: '2.3.5',
              text: 'Cualquier accidente causado en las instalaciones por mal estado de las mismas, así como escaleras, accesos, bordillos, suelos resbaladizos, etc. Será responsabilidad de la Comunidad.',
            },
            {
              key: '2.3.6',
              text: 'De Camino Servicios Auxiliares S.L. se responsabiliza de mantener en perfecto estado de conservación todos los elementos que forman parte de sus instalaciones.',
            },
            {
              key: '2.3.7',
              text: 'De acuerdo con el Convenio Colectivo de Socorristas aplicable, en jornadas ininterrumpidas el Socorrista dispondrá de 15 minutos de asueto, en los cuales se paraliza este servicio.',
            },
            {
              key: '2.3.8',
              text: 'Cualquier queja o reclamación será dirigida directamente a las oficinas de De Camino Servicios Auxiliares S.L., por escrito o de forma fehaciente, en ningún caso las quejas se dirigirán al personal que presta los servicios en las instalaciones ya que no tienen responsabilidad de tomar decisiones para solucionar las incidencias.',
            },
            {
              key: '2.3.9',
              text: 'De Camino Servicios Auxiliares S.L. podrá subcontratar a terceros cualquier parte del servicio ofertado en el presente presupuesto-contrato.',
            },
            {
              key: '2.3.10',
              text: 'En el presente contrato tiene una duración de un año y se entenderá tácitamente prorrogado por periodos anuales, si no es denunciado de forma fehaciente por alguna de las partes antes de 28 de febrero de cada año.',
            },
            {
              key: '2.3.11',
              text: 'El importe se actualizará al alza anualmente cada 1 de enero, según la variación que haya experimentado el índice general del IPC publicado por el Instituto Nacional de Estadística durante el último año natural o, en su caso, el índice que legalmente lo sustituya. No obstante, si por alguna disposición legal hay algún cambio de jornada o aumentase el salario mínimo interprofesional o del convenio de aplicación, el precio anual de este contrato se incrementará en idéntica proporción.',
            },
            {
              key: '2.3.12',
              text: 'De Camino Servicios Auxiliares S.L. declina toda responsabilidad de cualquier anomalía o avería producidas por falta de corriente eléctrica, inundación, fuego, así como pérdidas de agua por rotura de tuberías, cualquier elemento de la depuradora o deficiencias estructurales del vaso que pudiera surgir durante la duración del presente contrato.',
            },
            {
              key: '2.3.13',
              text: 'Cualquier trabajo que no esté contemplado en el presente contrato será facturado aparte previo aviso y aceptación de presupuesto.',
            },
            {
              key: '2.3.14',
              text: 'Cualquier modificación de la normativa que afecte a los servicios ofrecidos en el contrato, o introdujeses la obligatoriedad de nuevos servicios quedará excluida del presente contrato y se facturará a la Comunidad tras previo aviso.',
            },
            {
              key: '2.3.15',
              text: 'El retraso de los pagos de cualquiera de los recibos emitidos a la Comunidad será motivo de resolución del presente contrato facultando a De Camino Servicios Auxiliares S.L. a suspender el servicio o rescindir el contrato de forma unilateral, pudiendo optarse por el cumplimiento en reclamación del precio pactado, así como los gastos ocasionados en la reclamación. El cliente asume cualquier tipo de accidentes o averías que pudieran ocurrir como consecuencia del cese del servicio.',
            },
            {
              key: '2.3.16',
              text: 'Este presupuesto-contrato no incluye tareas de gestión documental CAE ni PRRLL en plataformas digitales para la coordinación de actividades empresariales que solicite la Comunidad de Propietarios o su Administración. En caso de solicitarlo, De Camino Servicios Auxiliares S.L. podrá realizar dicho servicio bajo un coste anual de 250,00 € + IVA a facturar en el mes de comienzo de la temporada.',
            },
          ];

          let condPiscinaY = 100;
          const condPiscinaFullWidth = PAGE_WIDTH - MARGIN * 2;
          const condPiscinaContentWidth = 360;
          const condPiscinaContentX =
            (PAGE_WIDTH - condPiscinaContentWidth) / 2;

          const addCondPiscinaPage = () => {
            doc.fontSize(7).fillColor('#333333').font('Helvetica');
            doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
              width: condPiscinaFullWidth,
              align: 'center',
              height: PAGE_HEIGHT - FOOTER_Y - 12,
              ellipsis: true,
            });
            doc.addPage({ size: 'A4', margin: MARGIN });
            if (logoPath) {
              try {
                doc.opacity(0.1);
                doc.image(
                  logoPath,
                  (PAGE_WIDTH - 400) / 2,
                  (PAGE_HEIGHT - 400) / 2,
                  { width: 400, height: 400 },
                );
                doc.opacity(1);
                doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
              } catch {
                // skip
              }
            }
            doc.opacity(1);
            condPiscinaY = 100;
            doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          };

          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          doc.text('2.3  CONDICIONES GENERALES', MARGIN, condPiscinaY, {
            width: condPiscinaFullWidth,
            align: 'center',
          });
          condPiscinaY += 36;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const condPiscinaLineW = condPiscinaFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - condPiscinaLineW) / 2, condPiscinaY)
            .lineTo(
              (PAGE_WIDTH - condPiscinaLineW) / 2 + condPiscinaLineW,
              condPiscinaY,
            )
            .stroke();
          condPiscinaY += 20;

          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          for (const sub of condGenPiscinaSubs) {
            const titleH = doc.heightOfString(sub.key, {
              width: condPiscinaContentWidth,
            });
            const textH = doc.heightOfString(sub.text, {
              width: condPiscinaContentWidth,
            });
            if (condPiscinaY + titleH + textH + 14 > FOOTER_Y - 25)
              addCondPiscinaPage();
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(sub.key, condPiscinaContentX, condPiscinaY, {
              width: condPiscinaContentWidth,
            });
            condPiscinaY += titleH + 4;
            doc.font('Helvetica').fontSize(10);
            doc.text(sub.text, condPiscinaContentX, condPiscinaY, {
              width: condPiscinaContentWidth,
              align: 'justify',
            });
            condPiscinaY += textH + 12;
          }

          if (condPiscinaY >= FOOTER_Y - 25) addCondPiscinaPage();
          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: condPiscinaFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });

          // 2.4 PERSONAL (piscina)
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          const persFullWidth = PAGE_WIDTH - MARGIN * 2;
          const persContentWidth = 360;
          const persContentX = (PAGE_WIDTH - persContentWidth) / 2;
          let persY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          doc.text('2.4  PERSONAL', MARGIN, persY, {
            width: persFullWidth,
            align: 'center',
          });
          persY += 36;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const persLineW = persFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - persLineW) / 2, persY)
            .lineTo((PAGE_WIDTH - persLineW) / 2 + persLineW, persY)
            .stroke();
          persY += 22;

          const persSubs: { key: string; intro: string; bullets?: string[] }[] =
            [
              {
                key: '2.4.1',
                intro:
                  'Encargado de mantenimiento de instalaciones acuáticas: responsable de supervisar y coordinar todas las actividades relacionadas con el cuidado y mantenimiento de piscinas.',
                bullets: [
                  'Elaborar un plan de mantenimiento preventivo que incluya las tareas regulares a realizar, los productos químicos necesarios, los horarios de limpieza y mantenimiento, entre otros aspectos.',
                  'Supervisar al equipo de mantenimiento, distribuir tareas, capacitar al personal en procedimientos de seguridad y técnicas de mantenimiento, y asegurarse de que se cumplan los estándares de calidad.',
                  'Coordinar las reparaciones necesarias en equipos, sistemas hidráulicos, estructuras o accesorios de la instalación en caso de averías o deterioro.',
                  'Asegurarse de que la instalación cumpla con todas las normativas locales y nacionales en cuanto a seguridad, calidad del agua, accesibilidad y requisitos técnicos.',
                ],
              },
              {
                key: '2.4.2',
                intro:
                  'Técnico en Salvamento y Socorrismo Acuático: desempeña un papel fundamental en el mantenimiento, la reparación y el funcionamiento adecuado de las instalaciones acuáticas.',
                bullets: [
                  'Realizar inspecciones regulares de las instalaciones para asegurar que todos los sistemas, equipos y accesorios estén en buen estado y funcionando correctamente.',
                  'Realizar pruebas periódicas del agua para medir y ajustar los niveles de pH, cloro, alcalinidad y dureza, garantizando así un equilibrio químico adecuado.',
                  'Identificar y solucionar problemas en los equipos, sistemas hidráulicos o estructurales de la piscina, realizando reparaciones o coordinando con otros profesionales según sea necesario.',
                  'Brindar asesoramiento a los propietarios o administradores sobre el mantenimiento adecuado, la optimización de los sistemas y la implementación de mejoras para garantizar el buen funcionamiento de la piscina.',
                ],
              },
              {
                key: '2.4.3',
                intro:
                  'Socorrista: son fundamentales para garantizar la seguridad de los usuarios en instalaciones acuáticas.',
                bullets: [
                  'Supervisar activamente a los bañistas para identificar cualquier situación de riesgo, comportamiento peligroso o emergencia médica.',
                  'Educar a los bañistas sobre las normas de seguridad, prevenir situaciones de riesgo y actuar proactivamente para evitar accidentes en el agua.',
                  'Estar preparado para responder rápidamente en caso de ahogamientos, lesiones o cualquier otra emergencia, aplicando técnicas de rescate y primeros auxilios según sea necesario.',
                  'Asegurarse de que los equipos de salvamento, como flotadores, aros salvavidas y tablas de rescate, estén en buenas condiciones y listos para su uso inmediato.',
                  'Trabajar en conjunto con el personal de mantenimiento, administración y servicios médicos para mantener un entorno seguro y responder eficazmente a situaciones de emergencia.',
                  'Mantener registros precisos de incidentes, rescates realizados, asistencias médicas proporcionadas y cualquier otro evento relevante.',
                  'Participar en entrenamientos y actualizaciones periódicas sobre técnicas de rescate, primeros auxilios, RCP (reanimación cardiopulmonar) y manejo de emergencias para mantener sus habilidades actualizadas.',
                ],
              },
              {
                key: '2.4.4',
                intro:
                  'De Camino Servicios Auxiliares S.L. NO se responsabiliza de cantidades de dinero entregadas al socorrista por ningún concepto ni tampoco objetos prestados al mismo.',
              },
              {
                key: '2.4.5',
                intro:
                  'Las ausencias de socorrista por enfermedad u otro motivo se cubrirán en un plazo máximo de 4h desde el momento que se avisa a De Camino Servicios Auxiliares S.L. Exceptuando las ausencias ocasionales por accidentes de tráfico, huelgas, inclemencias meteorológicas en las que De Camino Servicios Auxiliares S.L. no tiene responsabilidad alguna.',
              },
            ];

          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          for (const sub of persSubs) {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(sub.key, persContentX, persY, { width: persContentWidth });
            persY +=
              doc.heightOfString(sub.key, { width: persContentWidth }) + 4;
            doc.font('Helvetica').fontSize(10);
            let h = doc.heightOfString(sub.intro, { width: persContentWidth });
            if (persY + h > FOOTER_Y - 30) {
              doc.addPage({ size: 'A4', margin: MARGIN });
              if (logoPath) {
                try {
                  doc.opacity(0.1);
                  doc.image(
                    logoPath,
                    (PAGE_WIDTH - 400) / 2,
                    (PAGE_HEIGHT - 400) / 2,
                    { width: 400, height: 400 },
                  );
                  doc.opacity(1);
                  doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
                } catch {
                  // skip
                }
              }
              doc.opacity(1);
              persY = 80;
              doc.font('Helvetica-Bold').fontSize(10);
              doc.text(sub.key, persContentX, persY, {
                width: persContentWidth,
              });
              persY +=
                doc.heightOfString(sub.key, { width: persContentWidth }) + 4;
              doc.font('Helvetica').fontSize(10);
              h = doc.heightOfString(sub.intro, { width: persContentWidth });
            }
            doc.text(sub.intro, persContentX, persY, {
              width: persContentWidth,
              align: 'justify',
            });
            persY += h + 8;
            if (sub.bullets) {
              for (const b of sub.bullets) {
                const bh = doc.heightOfString(`• ${b}`, {
                  width: persContentWidth - 12,
                });
                if (persY + bh > FOOTER_Y - 25) {
                  doc.fontSize(7).fillColor('#333333').font('Helvetica');
                  doc.text(
                    this.getCompany().legalRegistryText,
                    MARGIN,
                    FOOTER_Y,
                    {
                      width: persFullWidth,
                      align: 'center',
                      height: PAGE_HEIGHT - FOOTER_Y - 12,
                      ellipsis: true,
                    },
                  );
                  doc.addPage({ size: 'A4', margin: MARGIN });
                  if (logoPath) {
                    try {
                      doc.opacity(0.1);
                      doc.image(
                        logoPath,
                        (PAGE_WIDTH - 400) / 2,
                        (PAGE_HEIGHT - 400) / 2,
                        { width: 400, height: 400 },
                      );
                      doc.opacity(1);
                      doc.image(logoPath, MARGIN, 40, {
                        width: 56,
                        height: 56,
                      });
                    } catch {
                      // skip
                    }
                  }
                  doc.opacity(1);
                  persY = 80;
                  doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
                }
                doc.text(`• ${b}`, persContentX + 10, persY, {
                  width: persContentWidth - 12,
                  align: 'justify',
                });
                persY += bh + 5;
              }
            }
            persY += 10;
          }

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: persFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });

          // 2.5 MANTENIMIENTO DE VERANO (piscina)
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          const veranoFullWidth = PAGE_WIDTH - MARGIN * 2;
          const veranoContentWidth = 360;
          const veranoContentX = (PAGE_WIDTH - veranoContentWidth) / 2;
          let veranoY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          doc.text('2.5  MANTENIMIENTO DE VERANO', MARGIN, veranoY, {
            width: veranoFullWidth,
            align: 'center',
          });
          veranoY += 36;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const veranoLineW = veranoFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - veranoLineW) / 2, veranoY)
            .lineTo((PAGE_WIDTH - veranoLineW) / 2 + veranoLineW, veranoY)
            .stroke();
          veranoY += 24;

          const veranoSubs: { key: string; text: string }[] = [
            {
              key: '2.5.1',
              text: 'Limpieza regular: Esto incluye la eliminación de hojas, insectos, suciedad y otros desechos que puedan acumularse en la superficie del agua y en los skimmers.',
            },
            {
              key: '2.5.2',
              text: 'Control del pH y cloro: Es crucial monitorear y ajustar regularmente los niveles de pH y cloro en el agua para mantenerla desinfectada y equilibrada.',
            },
            {
              key: '2.5.3',
              text: 'Filtración: Verificar que el sistema de filtración esté funcionando correctamente y limpiar o reemplazar los medios filtrantes según sea necesario.',
            },
            {
              key: '2.5.4',
              text: 'Mantenimiento del equipo: Inspeccionar y mantener en buen estado los sistemas de bombeo, la maquinaria de la piscina, las luces subacuáticas y otros accesorios.',
            },
            {
              key: '2.5.5',
              text: 'Reparaciones menores: Realizar reparaciones pequeñas o ajustes en caso de fugas, grietas, o deterioro de azulejos u otros elementos estructurales.',
            },
            {
              key: '2.5.6',
              text: 'Seguridad: Asegurarse de que todos los elementos de seguridad, como las barreras perimetrales, las señalizaciones y los equipos de rescate, estén en su lugar y en buen estado.',
            },
            {
              key: '2.5.7',
              text: 'Supervisión del agua: Realizar pruebas regulares del agua para verificar la calidad, equilibrio químico y transparencia.',
            },
            {
              key: '2.5.8',
              text: 'El Servicio no incluye limpieza de aseos, césped, solarios, etc, sacado-recogida o colocación de hamacas, sombrillas…',
            },
          ];
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          for (const sub of veranoSubs) {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(sub.key, veranoContentX, veranoY, {
              width: veranoContentWidth,
            });
            veranoY +=
              doc.heightOfString(sub.key, { width: veranoContentWidth }) + 4;
            doc.font('Helvetica').fontSize(10);
            const h = doc.heightOfString(sub.text, {
              width: veranoContentWidth,
            });
            doc.text(sub.text, veranoContentX, veranoY, {
              width: veranoContentWidth,
              align: 'justify',
            });
            veranoY += h + 14;
          }

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: veranoFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });

          // 2.6 MANTENIMIENTO DE INVIERNO (piscina)
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          const invFullWidth = PAGE_WIDTH - MARGIN * 2;
          const invContentWidth = 360;
          const invContentX = (PAGE_WIDTH - invContentWidth) / 2;
          let invY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          doc.text('2.6  MANTENIMIENTO DE INVIERNO', MARGIN, invY, {
            width: invFullWidth,
            align: 'center',
          });
          invY += 36;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const invLineW = invFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - invLineW) / 2, invY)
            .lineTo((PAGE_WIDTH - invLineW) / 2 + invLineW, invY)
            .stroke();
          invY += 24;

          const invSubs: { key: string; text: string }[] = [
            {
              key: '2.6.1',
              text: 'Invernación del agua: Ajustar los niveles de pH y cloro en el agua para prepararla para el período de inactividad, evitando la proliferación de algas y bacterias.',
            },
            {
              key: '2.6.2',
              text: 'Retirada de accesorios: Retirar y almacenar los accesorios de la piscina, como escaleras, trampolines, juguetes acuáticos y otros elementos que puedan dañarse por el frío o el hielo.',
            },
            {
              key: '2.6.3',
              text: 'Cubierta protectora: Colocar una cubierta protectora sobre la piscina para evitar la acumulación de hojas, ramas, nieve y otros desechos, así como para mantenerla segura y protegida.',
            },
            {
              key: '2.6.4',
              text: 'Mantenimiento del equipo: Inspeccionar y proteger el sistema de filtración, las bombas, los motores y otros equipos para evitar daños por congelación o corrosión.',
            },
            {
              key: '2.6.5',
              text: 'Supervisión ocasional: Realizar visitas periódicas para verificar que la cubierta esté en su lugar, que no haya acumulación excesiva de agua sobre ella y que no haya signos evidentes de daños.',
            },
            {
              key: '2.6.6',
              text: 'El mantenimiento de invierno se realizará con un coste de 1.200,00 € + IVA para la Comunidad visitando las instalaciones mínimo una vez al mes, realizando todos los trabajos detallados para prevenir averías de maquinaria, comprobar que no hay rotura de lona, fugas, etc. De Camino Servicios Auxiliares S.L. le dejará un parte de trabajo al conserje o en las instalaciones detallando la fecha y los trabajos realizados en cada visita.',
            },
          ];
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          for (const sub of invSubs) {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(sub.key, invContentX, invY, { width: invContentWidth });
            invY += doc.heightOfString(sub.key, { width: invContentWidth }) + 4;
            doc.font('Helvetica').fontSize(10);
            const h = doc.heightOfString(sub.text, { width: invContentWidth });
            doc.text(sub.text, invContentX, invY, {
              width: invContentWidth,
              align: 'justify',
            });
            invY += h + 14;
          }

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: invFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });

          // 2.7 HORARIO (piscina)
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          const horarioFullWidth = PAGE_WIDTH - MARGIN * 2;
          const horarioContentWidth = 360;
          const horarioContentX = (PAGE_WIDTH - horarioContentWidth) / 2;
          let horarioY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          doc.text('2.7  HORARIO', MARGIN, horarioY, {
            width: horarioFullWidth,
            align: 'center',
          });
          horarioY += 36;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const horarioLineW = horarioFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - horarioLineW) / 2, horarioY)
            .lineTo((PAGE_WIDTH - horarioLineW) / 2 + horarioLineW, horarioY)
            .stroke();
          horarioY += 24;

          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          doc.font('Helvetica-Bold').fontSize(10);
          doc.text('2.7.1', horarioContentX, horarioY, {
            width: horarioContentWidth,
          });
          horarioY +=
            doc.heightOfString('2.7.1', { width: horarioContentWidth }) + 4;
          doc.font('Helvetica').fontSize(10);
          const horarioP1 =
            'El periodo de apertura de las instalaciones se fija por un periodo de 93 días consecutivos, fijado por la comunidad de propietarios con una antelación mínima de 20 días entre la fecha deseada y la comunicación de esta por escrito. En caso de no haber ninguna comunicación, el periodo de apertura se fija entre el 13 de junio de 2026 y el 13 de septiembre de 2025 (fechas provisionales a confirmar por la comunidad de propietarios).';
          doc.text(horarioP1, horarioContentX, horarioY, {
            width: horarioContentWidth,
            align: 'justify',
          });
          horarioY +=
            doc.heightOfString(horarioP1, { width: horarioContentWidth }) + 16;
          // PDF firmado + variante acceptată: completar cu numărul de ore din oferta (ex. "8" din "Mantenimiento de Piscina – 8 horas")
          let horasPiscinaStr = '__';
          if (
            datosFirma != null &&
            typeof payload.selectedOfertaIndex === 'number' &&
            payload.selectedOfertaIndex >= 0 &&
            payload.selectedOfertaIndex < ofertaEconomica.length
          ) {
            const desc = (
              ofertaEconomica[payload.selectedOfertaIndex]?.descripcion ?? ''
            ).toString();
            const match = desc.match(/(\d+)\s*horas?/i);
            if (match) horasPiscinaStr = match[1];
          }
          if (horasPiscinaStr === '__') {
            const calcPiscina = (payload.presupuestoCalculoPiscina ||
              {}) as Record<string, unknown>;
            const h = calcPiscina.horas;
            if (h != null && String(h).trim() !== '')
              horasPiscinaStr = String(h).trim();
          }
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          doc.text(
            'El horario de apertura de la piscina será de ',
            horarioContentX,
            horarioY,
            { width: horarioContentWidth, continued: true },
          );
          doc.font('Helvetica-Bold');
          doc.text(horasPiscinaStr, { continued: true });
          doc.font('Helvetica');
          doc.text(' horas diarias:', { width: horarioContentWidth });
          horarioY +=
            doc.heightOfString(
              `El horario de apertura de la piscina será de ${horasPiscinaStr} horas diarias:`,
              { width: horarioContentWidth },
            ) + 8;
          // Horario por periodos (una sola vez, orientativo; viene en payload.presupuestoHorarioPiscina)
          const horarioPeriodos = (payload.presupuestoHorarioPiscina ||
            []) as Array<{
            fechaDesde?: string;
            fechaHasta?: string;
            horario?: string;
          }>;
          const horarioPeriodosFiltrados = horarioPeriodos.filter(
            (p) =>
              (p.fechaDesde && String(p.fechaDesde).trim()) ||
              (p.fechaHasta && String(p.fechaHasta).trim()) ||
              (p.horario && String(p.horario).trim()),
          );
          if (horarioPeriodosFiltrados.length > 0) {
            doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
            for (const p of horarioPeriodosFiltrados) {
              const desde = (p.fechaDesde || '').trim();
              const hasta = (p.fechaHasta || '').trim();
              const hor = (p.horario || '').trim();
              const line =
                desde && hasta
                  ? `${desde} AL ${hasta}${hor ? ': ' + hor : ''}`
                  : hor || `${desde} ${hasta}`.trim();
              if (line) {
                doc.text(line, horarioContentX, horarioY, {
                  width: horarioContentWidth,
                });
                horarioY +=
                  doc.heightOfString(line, { width: horarioContentWidth }) + 6;
              }
            }
          } else {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(
              'Horario a definir por la Comunidad',
              horarioContentX,
              horarioY,
              { width: horarioContentWidth },
            );
          }
          horarioY += 14;
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555555');
          const notaHorario =
            'Los horarios indicados son orientativos y quedarán sujetos a confirmación con el cliente.';
          doc.text(notaHorario, horarioContentX, horarioY, {
            width: horarioContentWidth,
            align: 'justify',
          });

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: horarioFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });
        }

        // ——— PÁGINA: DESCRIPCIÓN OPERATIVA - AUXILIARES (2.1)
        if (tiposIncluidos.has('auxiliares')) {
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          const auxFullWidth = PAGE_WIDTH - MARGIN * 2;
          const auxContentWidth = 360;
          const auxContentX = (PAGE_WIDTH - auxContentWidth) / 2;
          let auxY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          const tituloAux = '2.1  SERVICIO DE AUXILIARES DE SERVICIOS';
          const auxTitleHeight = doc.heightOfString(tituloAux, {
            width: auxFullWidth,
          });
          doc.text(tituloAux, MARGIN, auxY, {
            width: auxFullWidth,
            align: 'center',
          });
          auxY += auxTitleHeight + 14;
          const auxLineW = auxFullWidth * 0.72;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          doc
            .moveTo((PAGE_WIDTH - auxLineW) / 2, auxY)
            .lineTo((PAGE_WIDTH - auxLineW) / 2 + auxLineW, auxY)
            .stroke();
          auxY += 36;

          const auxLineH = 14;
          const auxParaSpacing = 10;
          const auxSectionSpacing = 16;
          const auxBlock =
            this.getPresupuestoKey() === 'hera'
              ? AUXILIARES_HERA
              : AUXILIARES_DECAMINO;

          doc.font('Helvetica').fontSize(10);
          doc.text(auxBlock.intro1, auxContentX, auxY, {
            width: auxContentWidth,
            align: 'justify',
          });
          auxY +=
            doc.heightOfString(auxBlock.intro1, { width: auxContentWidth }) +
            auxParaSpacing;
          doc.text(auxBlock.intro2, auxContentX, auxY, {
            width: auxContentWidth,
            align: 'justify',
          });
          auxY +=
            doc.heightOfString(auxBlock.intro2, { width: auxContentWidth }) +
            auxSectionSpacing;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Funciones principales', auxContentX, auxY, {
            width: auxContentWidth,
            align: 'left',
          });
          auxY += auxLineH + 4;
          doc.font('Helvetica').fontSize(10);
          auxBlock.funciones.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', auxContentX + 8, auxY, {
              continued: true,
              width: auxContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: auxContentWidth - 8, align: 'left' });
            auxY +=
              doc.heightOfString(`• ${line}`, { width: auxContentWidth - 8 }) +
              4;
          });
          auxY += auxSectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Apoyo al mantenimiento', auxContentX, auxY, {
            width: auxContentWidth,
            align: 'left',
          });
          auxY += auxLineH + 4;
          doc.font('Helvetica').fontSize(10);
          auxBlock.apoyo.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', auxContentX + 8, auxY, {
              continued: true,
              width: auxContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: auxContentWidth - 8, align: 'left' });
            auxY +=
              doc.heightOfString(`• ${line}`, { width: auxContentWidth - 8 }) +
              4;
          });
          auxY += auxSectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Beneficios para la comunidad', auxContentX, auxY, {
            width: auxContentWidth,
            align: 'left',
          });
          auxY += auxLineH + 4;
          doc.font('Helvetica').fontSize(10);
          auxBlock.beneficios.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', auxContentX + 8, auxY, {
              continued: true,
              width: auxContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: auxContentWidth - 8, align: 'left' });
            auxY +=
              doc.heightOfString(`• ${line}`, { width: auxContentWidth - 8 }) +
              4;
          });
          auxY += auxSectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Marco legal', auxContentX, auxY, {
            width: auxContentWidth,
            align: 'left',
          });
          auxY += auxLineH + 4;
          doc.font('Helvetica').fontSize(10);
          doc.text(auxBlock.marco, auxContentX, auxY, {
            width: auxContentWidth,
            align: 'justify',
          });

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: PAGE_WIDTH - MARGIN * 2,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });
        }

        // ——— PÁGINA: DESCRIPCIÓN OPERATIVA - LIMPIEZA (2.2)
        if (tiposIncluidos.has('limpieza')) {
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          const limpFullWidth = PAGE_WIDTH - MARGIN * 2;
          const limpContentWidth = 360;
          const limpContentX = (PAGE_WIDTH - limpContentWidth) / 2;
          let limpY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          const tituloLimp = '2.2  SERVICIO DE LIMPIEZA DE COMUNIDADES';
          const limpTitleHeight = doc.heightOfString(tituloLimp, {
            width: limpFullWidth,
          });
          doc.text(tituloLimp, MARGIN, limpY, {
            width: limpFullWidth,
            align: 'center',
          });
          limpY += limpTitleHeight + 14;
          const limpLineW = limpFullWidth * 0.72;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          doc
            .moveTo((PAGE_WIDTH - limpLineW) / 2, limpY)
            .lineTo((PAGE_WIDTH - limpLineW) / 2 + limpLineW, limpY)
            .stroke();
          limpY += 36;

          const limpLineH = 14;
          const limpParaSpacing = 10;
          const limpSectionSpacing = 16;
          const limpBlock =
            this.getPresupuestoKey() === 'hera'
              ? LIMPIEZA_HERA
              : LIMPIEZA_DECAMINO;

          doc.font('Helvetica').fontSize(10);
          doc.text(limpBlock.intro1, limpContentX, limpY, {
            width: limpContentWidth,
            align: 'justify',
          });
          limpY +=
            doc.heightOfString(limpBlock.intro1, { width: limpContentWidth }) +
            limpParaSpacing;
          doc.text(limpBlock.intro2, limpContentX, limpY, {
            width: limpContentWidth,
            align: 'justify',
          });
          limpY +=
            doc.heightOfString(limpBlock.intro2, { width: limpContentWidth }) +
            limpSectionSpacing;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text(limpBlock.seccionFunc, limpContentX, limpY, {
            width: limpContentWidth,
            align: 'left',
          });
          limpY += limpLineH + 4;
          doc.font('Helvetica').fontSize(10);
          doc.text(limpBlock.func1, limpContentX, limpY, {
            width: limpContentWidth,
            align: 'justify',
          });
          limpY +=
            doc.heightOfString(limpBlock.func1, { width: limpContentWidth }) +
            limpParaSpacing;
          doc.text(limpBlock.func2, limpContentX, limpY, {
            width: limpContentWidth,
            align: 'justify',
          });
          limpY +=
            doc.heightOfString(limpBlock.func2, { width: limpContentWidth }) +
            limpSectionSpacing;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Tareas habituales', limpContentX, limpY, {
            width: limpContentWidth,
            align: 'left',
          });
          limpY += limpLineH + 4;
          doc.font('Helvetica-Bold').fontSize(10);
          doc.text(limpBlock.freqDiaria, limpContentX + 8, limpY, {
            width: limpContentWidth - 8,
            align: 'left',
          });
          limpY += limpLineH + 2;
          doc.font('Helvetica').fontSize(10);
          limpBlock.diaria.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', limpContentX + 8, limpY, {
              continued: true,
              width: limpContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: limpContentWidth - 8, align: 'left' });
            limpY +=
              doc.heightOfString(`• ${line}`, { width: limpContentWidth - 8 }) +
              4;
          });
          limpY += 8;
          doc.font('Helvetica-Bold').fontSize(10);
          doc.text(limpBlock.freqAlterna, limpContentX + 8, limpY, {
            width: limpContentWidth - 8,
            align: 'left',
          });
          limpY += limpLineH + 2;
          doc.font('Helvetica').fontSize(10);
          limpBlock.alterna.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', limpContentX + 8, limpY, {
              continued: true,
              width: limpContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: limpContentWidth - 8, align: 'left' });
            limpY +=
              doc.heightOfString(`• ${line}`, { width: limpContentWidth - 8 }) +
              4;
          });
          limpY += limpSectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Beneficios para la comunidad', limpContentX, limpY, {
            width: limpContentWidth,
            align: 'left',
          });
          limpY += limpLineH + 4;
          doc.font('Helvetica').fontSize(10);
          limpBlock.beneficios.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', limpContentX + 8, limpY, {
              continued: true,
              width: limpContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: limpContentWidth - 8, align: 'left' });
            limpY +=
              doc.heightOfString(`• ${line}`, { width: limpContentWidth - 8 }) +
              4;
          });
          limpY += limpSectionSpacing;

          // Cierre en 9pt para evitar que la última línea salte a una página nueva (sobre todo HERA)
          doc.font('Helvetica').fontSize(9);
          doc.text(limpBlock.cierre, limpContentX, limpY, {
            width: limpContentWidth,
            align: 'justify',
          });

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: PAGE_WIDTH - MARGIN * 2,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });
        }

        // ——— PÁGINA: DESCRIPCIÓN OPERATIVA - JARDINERÍA (2.3)
        if (tiposIncluidos.has('jardineria')) {
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          const descFullWidth = PAGE_WIDTH - MARGIN * 2;
          const descContentWidth = 360;
          const descContentX = (PAGE_WIDTH - descContentWidth) / 2;
          let descY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          const tituloJardin = '2.3  SERVICIO DE JARDINERÍA';
          const titleHeight = doc.heightOfString(tituloJardin, {
            width: descFullWidth,
          });
          doc.text(tituloJardin, MARGIN, descY, {
            width: descFullWidth,
            align: 'center',
          });
          descY += titleHeight + 14;
          const descLineW = descFullWidth * 0.72;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          doc
            .moveTo((PAGE_WIDTH - descLineW) / 2, descY)
            .lineTo((PAGE_WIDTH - descLineW) / 2 + descLineW, descY)
            .stroke();
          descY += 36;

          const lineHeight = 14;
          const paraSpacing = 10;
          const sectionSpacing = 16;
          const jardinBlock =
            this.getPresupuestoKey() === 'hera'
              ? JARDINERIA_HERA
              : JARDINERIA_DECAMINO;

          doc.font('Helvetica').fontSize(10);
          doc.text(jardinBlock.intro1, descContentX, descY, {
            width: descContentWidth,
            align: 'justify',
          });
          descY +=
            doc.heightOfString(jardinBlock.intro1, {
              width: descContentWidth,
            }) + paraSpacing;
          doc.text(jardinBlock.intro2, descContentX, descY, {
            width: descContentWidth,
            align: 'justify',
          });
          descY +=
            doc.heightOfString(jardinBlock.intro2, {
              width: descContentWidth,
            }) + sectionSpacing;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Trabajos de mantenimiento', descContentX, descY, {
            width: descContentWidth,
            align: 'left',
          });
          descY += lineHeight + 4;
          doc.font('Helvetica').fontSize(10);
          jardinBlock.trabajos.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', descContentX + 8, descY, {
              continued: true,
              width: descContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: descContentWidth - 8, align: 'left' });
            descY +=
              doc.heightOfString(`• ${line}`, { width: descContentWidth - 8 }) +
              4;
          });
          descY += sectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Tratamientos y conservación', descContentX, descY, {
            width: descContentWidth,
            align: 'left',
          });
          descY += lineHeight + 4;
          doc.font('Helvetica').fontSize(10);
          jardinBlock.tratamientos.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', descContentX + 8, descY, {
              continued: true,
              width: descContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: descContentWidth - 8, align: 'left' });
            descY +=
              doc.heightOfString(`• ${line}`, { width: descContentWidth - 8 }) +
              4;
          });
          descY += sectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Beneficios para la comunidad', descContentX, descY, {
            width: descContentWidth,
            align: 'left',
          });
          descY += lineHeight + 4;
          doc.font('Helvetica').fontSize(10);
          jardinBlock.beneficios.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', descContentX + 8, descY, {
              continued: true,
              width: descContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: descContentWidth - 8, align: 'left' });
            descY +=
              doc.heightOfString(`• ${line}`, { width: descContentWidth - 8 }) +
              4;
          });
          descY += sectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Condiciones', descContentX, descY, {
            width: descContentWidth,
            align: 'left',
          });
          descY += lineHeight + 4;
          doc.font('Helvetica').fontSize(10);
          jardinBlock.condiciones.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', descContentX + 8, descY, {
              continued: true,
              width: descContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: descContentWidth - 8, align: 'left' });
            descY +=
              doc.heightOfString(`• ${line}`, { width: descContentWidth - 8 }) +
              4;
          });

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: PAGE_WIDTH - MARGIN * 2,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });
        }

        // ——— PÁGINA: DESCRIPCIÓN OPERATIVA - GESTIÓN CUBOS DE BASURA (2.4)
        if (tiposIncluidos.has('cubos')) {
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          const cubosFullWidth = PAGE_WIDTH - MARGIN * 2;
          const cubosContentWidth = 360;
          const cubosContentX = (PAGE_WIDTH - cubosContentWidth) / 2;
          let cubosY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          const tituloCubos = '2.4  GESTIÓN DE CUBOS DE BASURA';
          const cubosTitleHeight = doc.heightOfString(tituloCubos, {
            width: cubosFullWidth,
          });
          doc.text(tituloCubos, MARGIN, cubosY, {
            width: cubosFullWidth,
            align: 'center',
          });
          cubosY += cubosTitleHeight + 14;
          const cubosLineW = cubosFullWidth * 0.72;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          doc
            .moveTo((PAGE_WIDTH - cubosLineW) / 2, cubosY)
            .lineTo((PAGE_WIDTH - cubosLineW) / 2 + cubosLineW, cubosY)
            .stroke();
          cubosY += 36;

          const cubosLineH = 14;
          const cubosParaSpacing = 10;
          const cubosSectionSpacing = 16;
          const cubosBlock =
            this.getPresupuestoKey() === 'hera' ? CUBOS_HERA : CUBOS_DECAMINO;

          doc.font('Helvetica').fontSize(10);
          doc.text(cubosBlock.intro1, cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'justify',
          });
          cubosY +=
            doc.heightOfString(cubosBlock.intro1, {
              width: cubosContentWidth,
            }) + cubosParaSpacing;
          doc.text(cubosBlock.intro2, cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'justify',
          });
          cubosY +=
            doc.heightOfString(cubosBlock.intro2, {
              width: cubosContentWidth,
            }) + cubosSectionSpacing;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text(cubosBlock.seccionFunc, cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'left',
          });
          cubosY += cubosLineH + 4;
          doc.font('Helvetica').fontSize(10);
          doc.text(cubosBlock.func1, cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'justify',
          });
          cubosY +=
            doc.heightOfString(cubosBlock.func1, {
              width: cubosContentWidth,
            }) + (cubosBlock.func2 ? cubosParaSpacing : 0);
          if (cubosBlock.func2) {
            doc.text(cubosBlock.func2, cubosContentX, cubosY, {
              width: cubosContentWidth,
              align: 'justify',
            });
            cubosY +=
              doc.heightOfString(cubosBlock.func2, {
                width: cubosContentWidth,
              }) + cubosSectionSpacing;
          } else {
            cubosY += cubosSectionSpacing;
          }

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Tareas incluidas', cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'left',
          });
          cubosY += cubosLineH + 4;
          doc.font('Helvetica').fontSize(10);
          cubosBlock.tareas.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', cubosContentX + 8, cubosY, {
              continued: true,
              width: cubosContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: cubosContentWidth - 8, align: 'left' });
            cubosY +=
              doc.heightOfString(`• ${line}`, {
                width: cubosContentWidth - 8,
              }) + 4;
          });
          cubosY += cubosSectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Beneficios para la comunidad', cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'left',
          });
          cubosY += cubosLineH + 4;
          doc.font('Helvetica').fontSize(10);
          cubosBlock.beneficios.forEach((line) => {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(10);
            doc.text('• ', cubosContentX + 8, cubosY, {
              continued: true,
              width: cubosContentWidth - 8,
              align: 'left',
            });
            doc.fillColor('#1a1a1a').font('Helvetica');
            doc.text(line, { width: cubosContentWidth - 8, align: 'left' });
            cubosY +=
              doc.heightOfString(`• ${line}`, {
                width: cubosContentWidth - 8,
              }) + 4;
          });
          cubosY += cubosSectionSpacing - 4;

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text('Condiciones', cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'left',
          });
          cubosY += cubosLineH + 4;
          doc.font('Helvetica').fontSize(10);
          doc.text(cubosBlock.condiciones, cubosContentX, cubosY, {
            width: cubosContentWidth,
            align: 'justify',
          });

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: PAGE_WIDTH - MARGIN * 2,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });
        }

        // ——— PÁGINA(S): 3.1 OFERTA ECONÓMICA ———
        const ofertaParaTablaPdf =
          tiposIncluidos.size > 0
            ? ofertaEconomica.filter((row) =>
                tiposIncluidos.has(
                  derivarTipoDesdeServicio(row.descripcion || ''),
                ),
              )
            : ofertaEconomica;
        let filasOfertaPdf = ofertaParaTablaPdf.length
          ? ofertaParaTablaPdf
          : ofertaEconomica;
        // PDF firmado: filas aceptadas por el cliente (selección múltiple o una sola variante)
        const selectedOfertaIndices = payload.selectedOfertaIndices as
          | number[]
          | undefined;
        const selectedOfertaIndex = payload.selectedOfertaIndex;
        if (datosFirma != null) {
          if (
            Array.isArray(selectedOfertaIndices) &&
            selectedOfertaIndices.length > 0
          ) {
            const filas = selectedOfertaIndices
              .filter(
                (i) =>
                  typeof i === 'number' && i >= 0 && i < ofertaEconomica.length,
              )
              .map((i) => ofertaEconomica[i]);
            if (filas.length > 0) filasOfertaPdf = filas;
          } else if (
            typeof selectedOfertaIndex === 'number' &&
            selectedOfertaIndex >= 0 &&
            selectedOfertaIndex < ofertaEconomica.length
          ) {
            filasOfertaPdf = [ofertaEconomica[selectedOfertaIndex]];
          }
          if (payload.recuperacion_agua === true) {
            const precioRecuperacion =
              typeof payload.recuperacionAguaPrecio === 'number'
                ? payload.recuperacionAguaPrecio
                : Number(String((payload as any).recuperacionAguaPrecio ?? '').trim()) || 650;
            const conIva = Math.round(precioRecuperacion * 1.21 * 100) / 100;
            const recuperacionRow = {
              descripcion: 'Recuperación de Agua',
              mensualidadSinIva: precioRecuperacion,
              mensualidadConIva: conIva,
              anualidadSinIva: precioRecuperacion,
              anualidadConIva: conIva,
            };
            const soloRecuperacion =
              (!Array.isArray(selectedOfertaIndices) ||
                selectedOfertaIndices.length === 0) &&
              (typeof selectedOfertaIndex !== 'number' ||
                selectedOfertaIndex < 0 ||
                selectedOfertaIndex >= ofertaEconomica.length);
            if (soloRecuperacion) {
              filasOfertaPdf = [recuperacionRow];
            } else {
              filasOfertaPdf = [...filasOfertaPdf, recuperacionRow];
            }
          }
        }
        const ofertaSoloPiscinaPdf =
          filasOfertaPdf.length > 0 &&
          filasOfertaPdf.every(
            (row) =>
              derivarTipoDesdeServicio(row.descripcion || '') === 'piscina',
          );
        const fmtNum = (n: number) =>
          (n ?? 0).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

        doc.addPage({ size: 'A4', margin: MARGIN });
        if (logoPath) {
          try {
            doc.opacity(0.1);
            doc.image(
              logoPath,
              (PAGE_WIDTH - 400) / 2,
              (PAGE_HEIGHT - 400) / 2,
              {
                width: 400,
                height: 400,
              },
            );
            doc.opacity(1);
            doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
          } catch {
            // skip
          }
        }
        const ofertaFullWidth = PAGE_WIDTH - MARGIN * 2;
        let ofertaY = 100;
        doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
        const tituloOferta = '3.1  OFERTA ECONÓMICA';
        doc.text(tituloOferta, MARGIN, ofertaY, {
          width: ofertaFullWidth,
          align: 'center',
        });
        ofertaY +=
          doc.heightOfString(tituloOferta, { width: ofertaFullWidth }) + 14;
        doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
        const ofertaLineW = ofertaFullWidth * 0.72;
        doc
          .moveTo((PAGE_WIDTH - ofertaLineW) / 2, ofertaY)
          .lineTo((PAGE_WIDTH - ofertaLineW) / 2 + ofertaLineW, ofertaY)
          .stroke();
        ofertaY += 36;

        const colDescW = 228;
        const colMensW = 168;
        const colAnualW = ofertaSoloPiscinaPdf
          ? 0
          : ofertaFullWidth - colDescW - colMensW;
        const rowH = 46;
        const cellPad = 6;

        const tieneSeleccionFirma =
          datosFirma != null &&
          ((Array.isArray(selectedOfertaIndices) &&
            selectedOfertaIndices.length > 0) ||
            (typeof selectedOfertaIndex === 'number' &&
              selectedOfertaIndex >= 0 &&
              selectedOfertaIndex < ofertaEconomica.length));
        // Solo usar tabla fija (8h/9h/10h) cuando es piscina, no hay firma Y el presupuesto no tiene filas en oferta; si tiene datos, usar oferta real
        const usarTablaPiscinaFija =
          esSoloPiscina && !tieneSeleccionFirma && filasOfertaPdf.length === 0;

        if (usarTablaPiscinaFija) {
          // Piscina sin datos en presupuesto: intro fija + tabla fija (8h, 9h, 10h) + forma de pago (25% x4) como fallback
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          const introPiscina =
            'El Servicio Integral de Mantenimiento de Piscina, según los condicionantes especificados en el presente presupuesto tendrá un precio de:';
          doc.text(introPiscina, MARGIN, ofertaY, {
            width: ofertaFullWidth,
            align: 'left',
          });
          ofertaY +=
            doc.heightOfString(introPiscina, { width: ofertaFullWidth }) + 14;

          const piscinaTableTop = ofertaY;
          doc.fillColor('#f0f0f0').strokeColor('#333333');
          doc.rect(MARGIN, piscinaTableTop, colDescW, rowH).fillAndStroke();
          doc
            .rect(
              MARGIN + colDescW,
              piscinaTableTop,
              ofertaFullWidth - colDescW,
              rowH,
            )
            .fillAndStroke();
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(10);
          doc.text('DESCRIPCIÓN', MARGIN + cellPad, piscinaTableTop + 10, {
            width: colDescW - cellPad * 2,
          });
          doc.text(
            'MENSUALIDAD',
            MARGIN + colDescW + cellPad,
            piscinaTableTop + 10,
            { width: ofertaFullWidth - colDescW - cellPad * 2 },
          );

          const piscinaRows: {
            desc: string;
            sinIva: string;
            conIva: string;
          }[] = [
            {
              desc: 'Mantenimiento de Piscina – 8 horas',
              sinIva: '12.600,00€+IVA',
              conIva: '15.246,00€ IVA INCLUIDO',
            },
            {
              desc: 'Mantenimiento de Piscina – 9 horas',
              sinIva: '13.700,00€+IVA',
              conIva: '16.577,00€ IVA INCLUIDO',
            },
            {
              desc: 'Mantenimiento de Piscina – 10 horas',
              sinIva: '14.800,00€+IVA',
              conIva: '17.908,00€ IVA INCLUIDO',
            },
          ];
          ofertaY = piscinaTableTop + rowH;
          doc.font('Helvetica').fontSize(9);
          for (const r of piscinaRows) {
            doc.rect(MARGIN, ofertaY, colDescW, rowH).stroke('#333');
            doc
              .rect(
                MARGIN + colDescW,
                ofertaY,
                ofertaFullWidth - colDescW,
                rowH,
              )
              .stroke('#333');
            doc.text(r.desc, MARGIN + cellPad, ofertaY + cellPad, {
              width: colDescW - cellPad * 2,
            });
            doc.text(
              `${r.sinIva}\n${r.conIva}`,
              MARGIN + colDescW + cellPad,
              ofertaY + cellPad,
              {
                width: ofertaFullWidth - colDescW - cellPad * 2,
                lineGap: 2,
              },
            );
            ofertaY += rowH;
          }
          ofertaY += 24;

          doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
          const notaRecuperacion =
            'EN CASO DE RENUNCIA AL MANTENIMIENTO INVERNAL, SERÁ OBLIGATORIA LA CONTRATACIÓN DEL SERVICIO DE RECUPERACIÓN DE AGUA.';
          doc.text(notaRecuperacion, MARGIN, ofertaY, {
            width: ofertaFullWidth,
            align: 'left',
          });
          ofertaY +=
            doc.heightOfString(notaRecuperacion, { width: ofertaFullWidth }) +
            18;

          doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a');
          doc.text(
            'Los pagos se harán efectivos de la siguiente forma:',
            MARGIN,
            ofertaY,
            { width: ofertaFullWidth },
          );
          ofertaY +=
            doc.heightOfString(
              'Los pagos se harán efectivos de la siguiente forma:',
              { width: ofertaFullWidth },
            ) + 18;
          const pagosPiscina = [
            '25% Firma del contrato.',
            '25% 1 de Julio.',
            '25% 1 de Agosto.',
            '25% 1 de Septiembre.',
          ];
          const bulletChar = '\u2022';
          const lineGapPagos = 12;
          for (const p of pagosPiscina) {
            doc
              .fillColor(this.getCompany().brandRed)
              .font('Helvetica-Bold')
              .fontSize(11);
            doc.text(bulletChar + ' ', MARGIN, ofertaY, {
              continued: true,
              width: ofertaFullWidth,
            });
            doc.fillColor('#1a1a1a').font('Helvetica').fontSize(11);
            doc.text(p, { width: ofertaFullWidth });
            ofertaY +=
              doc.heightOfString(bulletChar + ' ' + p, {
                width: ofertaFullWidth,
              }) + lineGapPagos;
          }
        } else {
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          doc.text(
            'El precio de los servicios descritos es el siguiente:',
            MARGIN,
            ofertaY,
            {
              width: ofertaFullWidth,
              align: 'left',
            },
          );
          ofertaY += 22;

          const tableTop = ofertaY;
          const tieneColAnual = colAnualW > 0;
          // Encabezados: fondo gris y texto oscuro
          doc.fillColor('#f0f0f0').strokeColor('#333333');
          doc.rect(MARGIN, tableTop, colDescW, rowH).fillAndStroke();
          doc
            .rect(
              MARGIN + colDescW,
              tableTop,
              tieneColAnual ? colMensW : ofertaFullWidth - colDescW,
              rowH,
            )
            .fillAndStroke();
          if (tieneColAnual)
            doc
              .rect(MARGIN + colDescW + colMensW, tableTop, colAnualW, rowH)
              .fillAndStroke();
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(10);
          doc.text('DESCRIPCIÓN', MARGIN + cellPad, tableTop + 10, {
            width: colDescW - cellPad * 2,
          });
          doc.text('MENSUALIDAD', MARGIN + colDescW + cellPad, tableTop + 10, {
            width:
              (tieneColAnual ? colMensW : ofertaFullWidth - colDescW) -
              cellPad * 2,
          });
          if (tieneColAnual)
            doc.text(
              'ANUALIDAD',
              MARGIN + colDescW + colMensW + cellPad,
              tableTop + 10,
              { width: colAnualW - cellPad * 2 },
            );

          ofertaY = tableTop + rowH;
          doc.font('Helvetica').fontSize(10);
          for (const row of filasOfertaPdf) {
            const desc =
              (row.descripcion != null ? String(row.descripcion) : '').trim() ||
              '—';
            const mensSin = Number(row.mensualidadSinIva) || 0;
            const mensCon = Number(row.mensualidadConIva) || 0;
            const anualSin = Number(row.anualidadSinIva) || 0;
            const anualCon = Number(row.anualidadConIva) || 0;
            const mens1 = `${fmtNum(mensSin)}€+IVA`;
            const mens2 = `${fmtNum(mensCon)}€ IVA incluido`;
            const anual1 = `${fmtNum(anualSin)}€+IVA`;
            const anual2 = `${fmtNum(anualCon)}€ IVA incluido`;
            doc.rect(MARGIN, ofertaY, colDescW, rowH).stroke('#333');
            doc
              .rect(
                MARGIN + colDescW,
                ofertaY,
                tieneColAnual ? colMensW : ofertaFullWidth - colDescW,
                rowH,
              )
              .stroke('#333');
            if (tieneColAnual)
              doc
                .rect(MARGIN + colDescW + colMensW, ofertaY, colAnualW, rowH)
                .stroke('#333');
            doc.text(desc, MARGIN + cellPad, ofertaY + cellPad, {
              width: colDescW - cellPad * 2,
            });
            doc.text(
              `${mens1}\n${mens2}`,
              MARGIN + colDescW + cellPad,
              ofertaY + cellPad,
              {
                width:
                  (tieneColAnual ? colMensW : ofertaFullWidth - colDescW) -
                  cellPad * 2,
                lineGap: 4,
              },
            );
            if (tieneColAnual)
              doc.text(
                `${anual1}\n${anual2}`,
                MARGIN + colDescW + colMensW + cellPad,
                ofertaY + cellPad,
                { width: colAnualW - cellPad * 2, lineGap: 4 },
              );
            ofertaY += rowH;
          }

          ofertaY += 20;
          if (ofertaSoloPiscinaPdf && filasOfertaPdf.length > 0) {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
            const notaRecuperacionPdf =
              'EN CASO DE RENUNCIA AL MANTENIMIENTO INVERNAL, SERÁ OBLIGATORIA LA CONTRATACIÓN DEL SERVICIO DE RECUPERACIÓN DE AGUA.';
            doc.text(notaRecuperacionPdf, MARGIN, ofertaY, {
              width: ofertaFullWidth,
              align: 'left',
            });
            ofertaY +=
              doc.heightOfString(notaRecuperacionPdf, {
                width: ofertaFullWidth,
              }) + 18;

            doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a');
            doc.text(
              'Los pagos se harán efectivos de la siguiente forma:',
              MARGIN,
              ofertaY,
              { width: ofertaFullWidth },
            );
            ofertaY +=
              doc.heightOfString(
                'Los pagos se harán efectivos de la siguiente forma:',
                { width: ofertaFullWidth },
              ) + 18;
            const pagosPiscina2 = [
              '25% Firma del contrato.',
              '25% 1 de Julio.',
              '25% 1 de Agosto.',
              '25% 1 de Septiembre.',
            ];
            const bulletChar2 = '\u2022';
            const lineGapPagos2 = 12;
            for (const p of pagosPiscina2) {
              doc
                .fillColor(this.getCompany().brandRed)
                .font('Helvetica-Bold')
                .fontSize(11);
              doc.text(bulletChar2 + ' ', MARGIN, ofertaY, {
                continued: true,
                width: ofertaFullWidth,
              });
              doc.fillColor('#1a1a1a').font('Helvetica').fontSize(11);
              doc.text(p, { width: ofertaFullWidth });
              ofertaY +=
                doc.heightOfString(bulletChar2 + ' ' + p, {
                  width: ofertaFullWidth,
                }) + lineGapPagos2;
            }
            ofertaY += 16;
          }
          // Condiciones económicas, Revisión de precios y Formalización solo para presupuestos normales (no piscina)
          if (!ofertaSoloPiscinaPdf) {
            doc.font('Helvetica').fontSize(9).fillColor('#333333');
            doc.text(
              'Los precios están calculados para las condiciones actuales del servicio descritas en la presente propuesta.',
              MARGIN,
              ofertaY,
              { width: ofertaFullWidth, align: 'left' },
            );
            ofertaY +=
              doc.heightOfString(
                'Los precios están calculados para las condiciones actuales del servicio descritas en la presente propuesta.',
                { width: ofertaFullWidth },
              ) + 14;

            // Sub tabel: Condiciones económicas, Revisión de precios, Formalización (tot pe prima pagină Oferta)
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
            doc.text('Condiciones económicas', MARGIN, ofertaY, {
              width: ofertaFullWidth,
            });
            ofertaY += 14;
            doc.font('Helvetica').fontSize(9).fillColor('#333333');
            const bullet = '• ';
            doc.text(
              bullet + 'Facturación mensual mediante recibo domiciliado.',
              MARGIN,
              ofertaY,
              { width: ofertaFullWidth },
            );
            ofertaY +=
              doc.heightOfString(
                bullet + 'Facturación mensual mediante recibo domiciliado.',
                { width: ofertaFullWidth },
              ) + 3;
            doc.text(
              bullet +
                'El pago se realizará dentro de los últimos 5 días hábiles del mes en curso.',
              MARGIN,
              ofertaY,
              { width: ofertaFullWidth },
            );
            ofertaY +=
              doc.heightOfString(
                bullet +
                  'El pago se realizará dentro de los últimos 5 días hábiles del mes en curso.',
                { width: ofertaFullWidth },
              ) + 3;
            doc.text(
              bullet +
                'El presupuesto tiene una validez de 60 días desde su emisión.',
              MARGIN,
              ofertaY,
              { width: ofertaFullWidth },
            );
            ofertaY +=
              doc.heightOfString(
                bullet +
                  'El presupuesto tiene una validez de 60 días desde su emisión.',
                { width: ofertaFullWidth },
              ) + 12;

            doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
            doc.text('Revisión de precios', MARGIN, ofertaY, {
              width: ofertaFullWidth,
            });
            ofertaY += 14;
            doc.font('Helvetica').fontSize(9).fillColor('#333333');
            const revText =
              'Los precios están calculados conforme al convenio laboral aplicable y podrán actualizarse únicamente en caso de modificaciones legales obligatorias (SMI, convenio colectivo, normativa laboral o fiscal).';
            doc.text(revText, MARGIN, ofertaY, {
              width: ofertaFullWidth,
              align: 'justify',
            });
            ofertaY +=
              doc.heightOfString(revText, { width: ofertaFullWidth }) + 12;

            doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
            doc.text('Formalización', MARGIN, ofertaY, {
              width: ofertaFullWidth,
            });
            ofertaY += 14;
            doc.font('Helvetica').fontSize(9).fillColor('#333333');
            const formText =
              'La prestación del servicio se formalizará mediante contrato tras la aprobación del presupuesto por la Comunidad.';
            doc.text(formText, MARGIN, ofertaY, {
              width: ofertaFullWidth,
              align: 'justify',
            });
          }
        }

        doc.fontSize(7).fillColor('#333333').font('Helvetica');
        doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
          height: PAGE_HEIGHT - FOOTER_Y - 12,
          ellipsis: true,
        });

        // ——— PÁGINA: 4. GARANTÍA PROFESIONAL (siempre se añade) ———
        doc.addPage({ size: 'A4', margin: MARGIN });
        doc.opacity(1).fillColor('#1a1a1a');
        if (logoPath) {
          try {
            doc.opacity(0.1);
            doc.image(
              logoPath,
              (PAGE_WIDTH - 400) / 2,
              (PAGE_HEIGHT - 400) / 2,
              {
                width: 400,
                height: 400,
              },
            );
            doc.opacity(1);
            doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
          } catch {
            // skip
          }
        }
        doc.opacity(1);
        const garantiaFullWidth = PAGE_WIDTH - MARGIN * 2;
        let garantiaY = 100;
        doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
        const tituloGarantia = '4.  GARANTÍA PROFESIONAL';
        doc.text(tituloGarantia, MARGIN, garantiaY, {
          width: garantiaFullWidth,
          align: 'center',
        });
        garantiaY +=
          doc.heightOfString(tituloGarantia, { width: garantiaFullWidth }) + 14;
        doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
        const garantiaLineW = garantiaFullWidth * 0.72;
        doc
          .moveTo((PAGE_WIDTH - garantiaLineW) / 2, garantiaY)
          .lineTo((PAGE_WIDTH - garantiaLineW) / 2 + garantiaLineW, garantiaY)
          .stroke();
        garantiaY += 28;

        // Intro: nombre en negrita; primera línea del resto tras el nombre; líneas siguientes desde MARGIN
        const introResto =
          ' garantiza el cumplimiento de las siguientes obligaciones y certificaciones profesionales, como base de confianza en nuestra relación con los clientes.';
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333');
        const wBold = doc.widthOfString(this.getCompany().legalName);
        doc.text(this.getCompany().legalName, MARGIN, garantiaY);
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
        const firstLineWidth = garantiaFullWidth - wBold;
        const words = introResto.split(/(\s+)/);
        let firstLine = '';
        let restLine = '';
        for (let i = 0; i < words.length; i++) {
          const trial = firstLine + words[i];
          if (doc.widthOfString(trial) <= firstLineWidth) {
            firstLine = trial;
          } else {
            restLine = introResto.slice(firstLine.length).trimStart();
            break;
          }
        }
        if (firstLine.length > 0 && !restLine)
          restLine = introResto.slice(firstLine.length).trimStart();
        if (!firstLine.trim()) firstLine = introResto;
        doc.text(firstLine, MARGIN + wBold, garantiaY, {
          width: firstLineWidth,
          align: 'left',
        });
        const lineHeightGarantia = doc.heightOfString('A');
        if (restLine) {
          doc.text(restLine, MARGIN, garantiaY + lineHeightGarantia, {
            width: garantiaFullWidth,
            align: 'left',
          });
          garantiaY = doc.y + 20;
        } else {
          garantiaY = garantiaY + lineHeightGarantia + 20;
        }

        // Chenare: rând 1 = două (Prevención, Obligación), rând 2 = un chenar mare (Certificado RC), rând 3 = două (Certificado tributario, Plan Igualdad), rând 4 = un chenar mare (Confidencialidad)
        const boxPad = 10;
        const redBarW = 4;
        const cornerR = 10;
        const areaTop = garantiaY;
        const colGap = 18;
        const rowGap = 16;
        const wPct = 0.46;
        const boxW = Math.floor(garantiaFullWidth * wPct);
        const boxW2 = garantiaFullWidth - boxW - colGap;
        const row1H = 66;
        const row1RightH = 76; // Obligación Laboral: mai mult text
        const row1MaxH = Math.max(row1H, row1RightH);
        const row2H = 64;
        const row3LeftH = 92; // Certificado obligaciones tributarias: text lung
        const row3RightH = 72; // Plan de Igualdad: tot textul fără ...
        const row3MaxH = Math.max(row3LeftH, row3RightH);
        const row4H = 66;
        const y2 = areaTop + row1MaxH + rowGap;
        const y3 = areaTop + row1MaxH + rowGap + row2H + rowGap;
        const y4 =
          areaTop + row1MaxH + rowGap + row2H + rowGap + row3MaxH + rowGap;

        const cajas: {
          titulo: string;
          texto: string;
          x: number;
          y: number;
          w: number;
          h: number;
        }[] = [
          {
            titulo: '4.1  Prevención de Riesgos Laborales',
            texto:
              'El cumplimiento de todas las pautas en materia de PRL es nuestra prioridad por eso colaboramos activamente con Mutua Universal.',
            x: MARGIN,
            y: areaTop,
            w: boxW,
            h: row1H,
          },
          {
            titulo: '4.2  Obligación Laboral',
            texto:
              'De Camino pone a disposición cuando usted lo requiera los informes de estar al día en las obligaciones tributarias.',
            x: MARGIN + boxW + colGap,
            y: areaTop,
            w: boxW2,
            h: 76,
          },
          {
            titulo: '4.3  Certificado de Responsabilidad Civil',
            texto:
              'De Camino dispone de un seguro de RC con Mapfre Seguros en 600.000€, para dar atención a cualquier imprevisto.',
            x: MARGIN,
            y: y2,
            w: garantiaFullWidth,
            h: row2H,
          },
          {
            titulo: '4.4  Certificado al corriente de Obligaciones Tributarias',
            texto:
              'Ponemos a disposición de todos nuestros clientes que lo soliciten el certificado correspondiente de estar al corriente de todas nuestras obligaciones tributarias derivadas de nuestro ejercicio.',
            x: MARGIN,
            y: y3,
            w: boxW,
            h: row3LeftH,
          },
          {
            titulo: '4.5  Plan de Igualdad',
            texto:
              'De Camino dispone del Plan de Igualdad con Grupo ASPY (Conversia) según Real Decreto-Ley 6/2019.',
            x: MARGIN + boxW + colGap,
            y: y3,
            w: boxW2,
            h: row3RightH,
          },
          {
            titulo: '4.6  Confidencialidad',
            texto:
              'El presente documento así como todos los anexos posibles, contiene información confidencial propiedad de De Camino. De la misma forma De Camino se compromete con todos sus clientes a no revelar ni publicar datos de nuestros clientes sin el consentimiento del mismo.',
            x: MARGIN,
            y: y4,
            w: garantiaFullWidth,
            h: row4H,
          },
        ];
        // HERA: no mostrar 4.5 Plan de Igualdad (no aplica)
        const cajasFiltradas =
          this.getPresupuestoKey() === 'hera'
            ? cajas.filter((c) => c.titulo !== '4.5  Plan de Igualdad')
            : cajas;
        const drawGarantiaTextoWithBoldEmpresa = (
          texto: string,
          x: number,
          y: number,
          opts: {
            width: number;
            height?: number;
            align?: 'left' | 'justify';
            ellipsis?: boolean;
          },
        ) => {
          const parts = texto.split(/\bDe Camino\b/gi);
          for (let i = 0; i < parts.length; i++) {
            const textOpts =
              i < parts.length - 1 ? { ...opts, continued: true } : opts;
            const alreadyDrewNameAtStart = parts[0] === '' && i === 1;
            if (i > 0 && !alreadyDrewNameAtStart) {
              doc
                .font('Helvetica-Bold')
                .fontSize(8)
                .fillColor('#333333')
                .text(this.getCompany().legalName, {
                  ...opts,
                  continued: true,
                });
            } else if (i === 0 && parts[0] === '') {
              doc
                .font('Helvetica-Bold')
                .fontSize(8)
                .fillColor('#333333')
                .text(this.getCompany().legalName, x, y, {
                  ...opts,
                  continued: true,
                });
            }
            if (parts[i] !== '') {
              doc.font('Helvetica').fontSize(8).fillColor('#333333');
              if (i === 0 && parts[0] !== '') {
                doc.text(parts[i], x, y, textOpts);
              } else {
                doc.text(parts[i], textOpts);
              }
            }
          }
        };

        for (let i = 0; i < cajasFiltradas.length; i++) {
          const c = cajasFiltradas[i];
          const x = c.x;
          const y = c.y;
          const w = c.w;
          const h = c.h;
          const innerW = w - boxPad * 2 - redBarW;
          doc.fillColor('#fafafa').strokeColor('#cccccc').lineWidth(1);
          doc.roundedRect(x, y, w, h, cornerR).fillAndStroke();
          doc.fillColor(this.getCompany().brandRed);
          doc
            .roundedRect(x, y + cornerR * 0.3, redBarW, h - cornerR * 0.6, 2)
            .fill();
          doc
            .fillColor(this.getCompany().brandRed)
            .font('Helvetica-Bold')
            .fontSize(9);
          doc.text(c.titulo, x + boxPad + redBarW, y + boxPad, {
            width: innerW,
          });
          const titleH = doc.heightOfString(c.titulo, { width: innerW });
          const textY = y + boxPad + titleH + 4;
          drawGarantiaTextoWithBoldEmpresa(
            c.texto,
            x + boxPad + redBarW,
            textY,
            {
              width: innerW,
              height: h - boxPad * 2 - titleH - 4,
              align: 'left',
              ellipsis: true,
            },
          );
        }

        doc.fontSize(7).fillColor('#333333').font('Helvetica');
        doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
          height: PAGE_HEIGHT - FOOTER_Y - 12,
          ellipsis: true,
        });

        // ——— PÁGINA(E): CONDICIONES CONTRACTUALES (doar la presupuesto normal; la piscina sunt în 2.3 etc.)
        if (!esSoloPiscina) {
          doc.addPage({ size: 'A4', margin: MARGIN });
          doc.opacity(1).fillColor('#1a1a1a');
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          doc.opacity(1);
          const condFullWidth = PAGE_WIDTH - MARGIN * 2;
          let condGenY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          const tituloCond =
            '5.  CONDICIONES CONTRACTUALES DE PRESTACIÓN DEL SERVICIO';
          doc.text(tituloCond, MARGIN, condGenY, {
            width: condFullWidth,
            align: 'center',
          });
          condGenY +=
            doc.heightOfString(tituloCond, { width: condFullWidth }) + 14;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(2);
          const condLineW = condFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - condLineW) / 2, condGenY)
            .lineTo((PAGE_WIDTH - condLineW) / 2 + condLineW, condGenY)
            .stroke();
          condGenY += 14;

          const condBlock =
            this.getPresupuestoKey() === 'hera'
              ? CONDICIONES_CONTRACTUALES_HERA
              : CONDICIONES_CONTRACTUALES_DECAMINO;
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          doc.text(condBlock.intro, MARGIN, condGenY, {
            width: condFullWidth,
            align: 'justify',
          });
          condGenY +=
            doc.heightOfString(condBlock.intro, { width: condFullWidth }) + 14;

          const condTitleGap = 6;
          const condParaGap = 8;
          const addCondPage = () => {
            doc.fontSize(7).fillColor('#333333').font('Helvetica');
            doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
              width: condFullWidth,
              align: 'center',
              height: PAGE_HEIGHT - FOOTER_Y - 12,
              ellipsis: true,
            });
            doc.addPage({ size: 'A4', margin: MARGIN });
            if (logoPath) {
              try {
                doc.opacity(0.1);
                doc.image(
                  logoPath,
                  (PAGE_WIDTH - 400) / 2,
                  (PAGE_HEIGHT - 400) / 2,
                  { width: 400, height: 400 },
                );
                doc.opacity(1);
                doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
              } catch {
                // skip
              }
            }
            doc.opacity(1);
            condGenY = 100;
            doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          };

          for (const sec of condBlock.secciones) {
            // Forzar salto de página antes de 6. Responsabilidad: todo desde ahí va a la segunda página
            if (sec.titulo === '6. Responsabilidad') addCondPage();
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
            const titleH = doc.heightOfString(sec.titulo, {
              width: condFullWidth,
            });
            if (condGenY + titleH > FOOTER_Y - 20) addCondPage();
            doc.text(sec.titulo, MARGIN, condGenY, { width: condFullWidth });
            condGenY += titleH + condTitleGap;
            doc.font('Helvetica').fontSize(9).fillColor('#333333');
            for (const p of sec.parrafos) {
              const h = doc.heightOfString(p, { width: condFullWidth });
              if (condGenY + h > FOOTER_Y - 20) addCondPage();
              doc.text(p, MARGIN, condGenY, {
                width: condFullWidth,
                align: 'justify',
              });
              condGenY += h + condParaGap;
            }
            condGenY += 4;
          }

          // Evitar que el footer se dibuje encima del contenido: si el último texto quedó cerca o por debajo de FOOTER_Y, pasar a nueva página (addCondPage dibuja footer abajo y añade página)
          if (condGenY >= FOOTER_Y - 25) addCondPage();
          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: condFullWidth,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });
        }

        // ——— PÁGINA: ACEPTACIÓN ———
        doc.addPage({ size: 'A4', margin: MARGIN });
        doc.opacity(1).fillColor('#1a1a1a');
        const stampPath = getStampPathForCompany(
          this.getCompany(),
          this.getPresupuestoKey(),
        );
        if (logoPath) {
          try {
            doc.opacity(0.1);
            doc.image(
              logoPath,
              (PAGE_WIDTH - 400) / 2,
              (PAGE_HEIGHT - 400) / 2,
              {
                width: 400,
                height: 400,
              },
            );
            doc.opacity(1);
            doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
          } catch {
            // skip
          }
        }
        doc.opacity(1);
        const aceptFullWidth = PAGE_WIDTH - MARGIN * 2;
        const aceptContentWidth = 360;
        const aceptContentX = (PAGE_WIDTH - aceptContentWidth) / 2;
        let aceptY = 100;
        doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(20);
        const tituloAcept =
          (esSoloPiscina ? '5.  ' : '6.  ') +
          'ACEPTACIÓN PRESUPUESTO - CONTRATO';
        doc.text(tituloAcept, MARGIN, aceptY, {
          width: aceptFullWidth,
          align: 'center',
        });
        aceptY +=
          doc.heightOfString(tituloAcept, { width: aceptFullWidth }) + 10;
        doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
        const aceptLineW = aceptFullWidth * 0.72;
        doc
          .moveTo((PAGE_WIDTH - aceptLineW) / 2, aceptY)
          .lineTo((PAGE_WIDTH - aceptLineW) / 2 + aceptLineW, aceptY)
          .stroke();
        aceptY += 24;

        const labelW = 140;
        const lineLen = 280;
        const aceptRowH = 28;
        doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');

        const drawAceptRow = (label: string, value?: string) => {
          doc.font('Helvetica-Bold').fontSize(9);
          doc.text(label, aceptContentX, aceptY, { width: labelW });
          if (value != null && value !== '') {
            doc.font('Helvetica').fontSize(9);
            doc.text(value, aceptContentX + labelW + 8, aceptY + 2, {
              width: lineLen,
            });
          }
          doc.strokeColor('#333333').lineWidth(0.5);
          doc
            .moveTo(aceptContentX + labelW + 8, aceptY + 10)
            .lineTo(aceptContentX + labelW + 8 + lineLen, aceptY + 10)
            .stroke();
          aceptY += aceptRowH;
        };

        const formatFechaFirma = (iso: string) => {
          try {
            const d = new Date(iso);
            return isNaN(d.getTime())
              ? iso
              : d.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
          } catch {
            return iso;
          }
        };

        drawAceptRow(
          'Fecha:',
          datosFirma ? formatFechaFirma(datosFirma.fecha_hora) : undefined,
        );
        const formatFechaInicio = (yyyyMmDd: string) => {
          if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd.trim()))
            return undefined;
          const [y, m, d] = yyyyMmDd.trim().split('-');
          return `${d}/${m}/${y}`;
        };
        drawAceptRow(
          'Fecha inicio servicio:',
          datosFirma?.fecha_inicio_servicio
            ? formatFechaInicio(datosFirma.fecha_inicio_servicio)
            : undefined,
        );
        drawAceptRow(
          'Representante del cliente:',
          datosFirma?.nombre_representante?.trim() || undefined,
        );
        drawAceptRow('Cargo:', datosFirma?.cargo?.trim() || undefined);
        // Cliente: nombre de la comunidad (de la oferta o del formulario de firma)
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Cliente:', aceptContentX, aceptY, { width: labelW });
        doc.text(
          datosFirma?.nombre_comunidad?.trim() || clienteNombre || '-',
          aceptContentX + labelW + 8,
          aceptY,
          { width: lineLen },
        );
        aceptY += aceptRowH;
        // CIF e IBAN: din formular (la firmat) sau din clientul din BD dacă există
        const cifVal = datosFirma?.cif?.trim() || nifCliente;
        const ibanVal = datosFirma?.iban?.trim() || ibanCliente;
        drawAceptRow('CIF:', cifVal ?? undefined);
        drawAceptRow('IBAN:', ibanVal ?? undefined);
        if (esSoloPiscina && datosFirma) {
          aceptY += 10;
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555');
          doc.text('Datos piscina', aceptContentX, aceptY, {
            width: aceptContentWidth,
          });
          aceptY += 14;
          doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');
          const nombreDniPresidente = [
            datosFirma.nombre_presidente?.trim(),
            datosFirma.dni_presidente?.trim(),
          ]
            .filter(Boolean)
            .join(' ');
          drawAceptRow(
            'Nombre y D.N.I. Presidente:',
            nombreDniPresidente || undefined,
          );
          drawAceptRow('Teléfono:', datosFirma.telefono?.trim() || undefined);
          drawAceptRow(
            'Nº de viviendas:',
            datosFirma.n_viviendas?.trim() || undefined,
          );
          drawAceptRow(
            'Recogida llaves instalaciones:',
            datosFirma.recogida_llaves?.trim() || undefined,
          );
          aceptY += 8;
        } else {
          aceptY += 8;
        }

        // CLIENTE: — chenar pentru semnătură client (dacă avem firma_base64, inserăm imaginea)
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a');
        doc.text('CLIENTE:', aceptContentX, aceptY, { width: labelW });
        aceptY += 12;
        const clientBoxW = aceptContentWidth;
        const clientBoxH = 44;
        const clientBoxY = aceptY;
        doc.fillColor('#fafafa').strokeColor('#333333').lineWidth(0.8);
        doc.rect(aceptContentX, aceptY, clientBoxW, clientBoxH).fillAndStroke();
        if (datosFirma?.firma_base64?.trim()) {
          try {
            const base64Img = datosFirma.firma_base64.replace(
              /^data:image\/\w+;base64,/,
              '',
            );
            const imgBuf = Buffer.from(base64Img, 'base64');
            if (imgBuf.length > 0) {
              doc.image(imgBuf, aceptContentX + 10, clientBoxY + 4, {
                width: 90,
                height: 36,
              });
            }
          } catch {
            // ignore
          }
        }
        aceptY += clientBoxH + 10;

        // EMPRESA: — chenar cu date firmă + ștampilă (evită duplicarea "DE CAMINO")
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a');
        doc.text('EMPRESA:', aceptContentX, aceptY, { width: labelW });
        aceptY += 12;
        const caminoBoxW = aceptContentWidth;
        const caminoBoxH = 48;
        doc.fillColor('#fafafa').strokeColor('#333333').lineWidth(0.8);
        doc.rect(aceptContentX, aceptY, caminoBoxW, caminoBoxH).fillAndStroke();
        doc.font('Helvetica').fontSize(7).fillColor('#333333');
        const textoCaminoW = stampPath ? caminoBoxW - 58 : caminoBoxW - 16;
        doc.text(
          this.getCompany().empresaBlock,
          aceptContentX + 8,
          aceptY + 8,
          {
            width: textoCaminoW,
          },
        );
        if (stampPath) {
          try {
            const stampW = 56;
            const stampH = 42;
            doc.image(
              stampPath,
              aceptContentX + caminoBoxW - stampW - 8,
              aceptY + (caminoBoxH - stampH) / 2,
              {
                width: stampW,
                height: stampH,
              },
            );
          } catch {
            // skip si falla la imagen
          }
        }
        aceptY += caminoBoxH + 10;

        // ——— TEXTO FORMALIZACIÓN DEL CONTRATO (font mic) ———
        const formalizacionTitle = 'FORMALIZACIÓN DEL CONTRATO';
        const formalizacionParrafos = [
          'El presente presupuesto, junto con sus condiciones contractuales, quedará formalizado como contrato de prestación de servicios desde el momento de su aceptación mediante firma manuscrita o electrónica por parte de la Comunidad de Propietarios.',
          'La firma electrónica realizada a través del sistema habilitado tendrá plena validez jurídica conforme a la normativa vigente.',
          'Para cualquier discrepancia o controversia derivada de la interpretación o ejecución del presente contrato, las partes se someten expresamente a los Juzgados y Tribunales de Madrid.',
          'En Madrid, a la fecha de la firma electrónica.',
        ];
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#333333');
        const formalTitleH = doc.heightOfString(formalizacionTitle, {
          width: aceptFullWidth,
        });
        doc.text(formalizacionTitle, MARGIN, aceptY, {
          width: aceptFullWidth,
          align: 'center',
        });
        aceptY += formalTitleH + 4;
        doc.font('Helvetica').fontSize(6).fillColor('#555555');
        for (const p of formalizacionParrafos) {
          const h = doc.heightOfString(p, { width: aceptFullWidth });
          if (aceptY + h > FOOTER_Y - 32) break;
          doc.text(p, MARGIN, aceptY, {
            width: aceptFullWidth,
            align: 'justify',
          });
          aceptY += h + 2;
        }
        aceptY += 6;

        // ——— Botón aceptación o texto "Aceptado" si ya firmó ———
        if (datosFirma) {
          doc.font('Helvetica').fontSize(9).fillColor('#15803d');
          doc.text(
            `Aceptado electrónicamente el ${formatFechaFirma(datosFirma.fecha_hora)}`,
            MARGIN,
            aceptY,
            { width: PAGE_WIDTH - MARGIN * 2, align: 'center' },
          );
          aceptY += 18;
        } else {
          const firmarBaseUrl =
            process.env.FIRMAR_BASE_URL ||
            this.getCompany().frontendAppUrl ||
            '';
          const firmarUrl = `${firmarBaseUrl}/firmar.html?id=${id}`;
          const btnW = 200;
          const btnH = 32;
          const btnX = (PAGE_WIDTH - btnW) / 2;
          const btnY = aceptY;
          doc.fillColor('#2563eb').strokeColor('#1d4ed8').lineWidth(1);
          doc.roundedRect(btnX, btnY, btnW, btnH, 5).fillAndStroke();
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12);
          doc.text('ACEPTAR PRESUPUESTO', btnX, btnY + 9, {
            width: btnW,
            align: 'center',
          });
          doc.link(btnX, btnY, btnW, btnH, firmarUrl);
          aceptY += btnH + 8;
        }

        const legalFirma = datosFirma
          ? 'Documento aceptado mediante firma electrónica conforme al Reglamento (UE) 910/2014 (eIDAS).'
          : 'Este presupuesto puede aceptarse mediante firma electrónica a través del enlace superior, teniendo la misma validez legal que la firma manuscrita conforme al Reglamento (UE) 910/2014 (eIDAS).';
        doc.font('Helvetica').fontSize(6).fillColor('#555555');
        doc.text(legalFirma, MARGIN, aceptY, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
        });
        aceptY += 20;

        if (datosFirma && evidencias) {
          const ahoraMadrid = new Date().toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          doc.font('Helvetica-Bold').fontSize(6).fillColor('#333333');
          doc.text('Evidencias (integridad del documento)', MARGIN, aceptY, {
            width: PAGE_WIDTH - MARGIN * 2,
          });
          aceptY += 10;
          doc.font('Helvetica').fontSize(5).fillColor('#555555');
          doc.text(
            `Huella digital (SHA-256) del presupuesto original: ${evidencias.original_pdf_sha256}`,
            MARGIN,
            aceptY,
            { width: PAGE_WIDTH - MARGIN * 2 },
          );
          aceptY += 8;
          doc.text(
            `Huella digital (SHA-256) del documento firmado: ${evidencias.signed_pdf_sha256 ?? '(registrada en base de datos)'}`,
            MARGIN,
            aceptY,
            { width: PAGE_WIDTH - MARGIN * 2 },
          );
          aceptY += 8;
          doc.text(
            `Fecha y hora (Europe/Madrid): ${ahoraMadrid}`,
            MARGIN,
            aceptY,
            { width: PAGE_WIDTH - MARGIN * 2 },
          );
          aceptY += 8;
          doc.text(`ID Presupuesto: ${id}`, MARGIN, aceptY, {
            width: PAGE_WIDTH - MARGIN * 2,
          });
          aceptY += 12;
        }

        doc.fontSize(7).fillColor('#333333').font('Helvetica');
        doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'center',
          height: PAGE_HEIGHT - FOOTER_Y - 12,
          ellipsis: true,
        });

        // ——— PÁGINA: 6. FIESTA FIN DE TEMPORADA (solo piscina, última página)
        if (esSoloPiscina) {
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                { width: 400, height: 400 },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, { width: 56, height: 56 });
            } catch {
              // skip
            }
          }
          const fiestaFullWidth = PAGE_WIDTH - MARGIN * 2;
          const fiestaContentWidth = 360;
          const fiestaContentX = (PAGE_WIDTH - fiestaContentWidth) / 2;
          let fiestaY = 100;
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(26);
          const tituloFiesta = '6.  FIESTA FIN DE TEMPORADA';
          doc.text(tituloFiesta, MARGIN, fiestaY, {
            width: fiestaFullWidth,
            align: 'center',
          });
          fiestaY +=
            doc.heightOfString(tituloFiesta, { width: fiestaFullWidth }) + 14;
          doc.strokeColor(this.getCompany().brandRed).lineWidth(3);
          const fiestaLineW = fiestaFullWidth * 0.72;
          doc
            .moveTo((PAGE_WIDTH - fiestaLineW) / 2, fiestaY)
            .lineTo((PAGE_WIDTH - fiestaLineW) / 2 + fiestaLineW, fiestaY)
            .stroke();
          fiestaY += 28;

          doc.font('Helvetica').fontSize(10).fillColor('#333333');
          const fiestaIntro = `El último día, ${this.getCompany().legalName} participará en la fiesta de final de temporada:`;
          doc.text(fiestaIntro, fiestaContentX, fiestaY, {
            width: fiestaContentWidth,
            align: 'justify',
          });
          fiestaY +=
            doc.heightOfString(fiestaIntro, { width: fiestaContentWidth }) + 14;

          doc
            .fillColor(this.getCompany().brandRed)
            .font('Helvetica-Bold')
            .fontSize(10);
          doc.text('\u2022 ', fiestaContentX, fiestaY, {
            continued: true,
            width: fiestaContentWidth,
          });
          doc.fillColor('#1a1a1a').font('Helvetica');
          const fiestaBullet =
            'El socorrista adornará la piscina con globos de colores y entregará unas bolsas de chucherías a todos los niños.';
          doc.text(fiestaBullet, { width: fiestaContentWidth });
          fiestaY +=
            doc.heightOfString('\u2022 ' + fiestaBullet, {
              width: fiestaContentWidth,
            }) + 18;

          doc
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor(this.getCompany().brandRed);
          doc.text('SIN COSTE PARA LA COMUNIDAD', fiestaContentX, fiestaY, {
            width: fiestaContentWidth,
            align: 'center',
          });

          doc.fontSize(7).fillColor('#333333').font('Helvetica');
          doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
            width: PAGE_WIDTH - MARGIN * 2,
            align: 'center',
            height: PAGE_HEIGHT - FOOTER_Y - 12,
            ellipsis: true,
          });
        }

        // Numerotare "Pag. x de y" în dreapta jos, pe toate paginile exceptând coperta (pagina 0)
        const pageRange = doc.bufferedPageRange();
        const totalPages = pageRange.count;
        for (let i = 1; i < totalPages; i++) {
          doc.switchToPage(i);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(this.getCompany().brandRed);
          doc.text(`Pag. ${i + 1} de ${totalPages}`, MARGIN, PAGE_NUM_Y, {
            width: PAGE_WIDTH - MARGIN * 2,
            align: 'right',
          });
        }

        doc.end();
      });

      // HERA: numele fișierului cu marca HERA, nu "DE CAMINO" din BD
      let filename: string;
      if (this.getPresupuestoKey() === 'hera') {
        const year = new Date().getFullYear();
        const servicios =
          (payload?.selectedServiciosPresupuesto as Array<{
            nombre?: unknown;
          }>) || [];
        const servPart =
          servicios.length > 0
            ? servicios
                .map((s) => {
                  const n = s?.nombre;
                  const t = n != null ? String(n).trim() : '';
                  return t.startsWith('<')
                    ? t.replace(/<[^>]*>/g, '').trim()
                    : t;
                })
                .join(', ')
            : 'Servicios';
        const safeCliente = (clienteNombre || 'Cliente').replace(
          /[/\\?%*:|"<>]/g,
          '-',
        );
        filename = `${this.getCompany().legalNameShort} - PRESUPUESTO ${year} - ${safeCliente} - ${servPart}.pdf`;
      } else {
        filename = `${nombre.substring(0, 200).trim() || 'Presupuesto'}.pdf`;
      }
      return { buffer, filename };
    } finally {
      this._pdfCompanyKey = null;
    }
  }
}
