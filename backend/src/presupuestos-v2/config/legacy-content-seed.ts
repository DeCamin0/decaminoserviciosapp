/**
 * Contenido comercial Decamino recuperado de Legacy
 * (presupuesto-documento.service.ts PRESENTACION / AUXILIARES / LIMPIEZA / … / CONDICIONES / garantía).
 * Se siembra en v2_contenido_bloques + brand.config_json — NO se hardcodea en el PDF builder.
 */

export type BloqueSeed = {
  codigo: string;
  nombre: string;
  categoria: string;
  body: Record<string, unknown>;
};

export const LEGACY_BLOQUES_DECAMINO: BloqueSeed[] = [
  {
    codigo: 'auxiliares_intro',
    nombre: 'Auxiliares — introducción',
    categoria: 'auxiliares',
    body: {
      tipo: 'texto',
      parrafos: [
        'Nuestro servicio de Auxiliares de Servicios está orientado a garantizar la tranquilidad, el control diario y la correcta convivencia dentro de la comunidad, actuando como punto de apoyo permanente para vecinos, administración y proveedores.',
        'El auxiliar se convierte en la figura visible de la comunidad, previniendo incidencias antes de que se conviertan en problemas y ofreciendo una atención cercana y profesional.',
      ],
    },
  },
  {
    codigo: 'auxiliares_operativa',
    nombre: 'Auxiliares — funciones principales',
    categoria: 'auxiliares',
    body: {
      tipo: 'lista',
      titulo: 'Funciones principales',
      items: [
        'Control de accesos y supervisión de personas ajenas a la finca.',
        'Supervisión y seguimiento de trabajos realizados por proveedores.',
        'Atención y asistencia a residentes que requieran su presencia.',
        'Realización de rondas preventivas en diferentes horarios.',
        'Comunicación inmediata de desperfectos o averías a la administración.',
        'Aviso a servicios técnicos o de emergencia cuando sea necesario.',
        'Apoyo en situaciones de molestias o incidencias vecinales.',
        'Supervisión básica de instalaciones comunes (garajes, zonas comunes, sistemas comunitarios).',
      ],
    },
  },
  {
    codigo: 'auxiliares_mantenimiento',
    nombre: 'Auxiliares — apoyo al mantenimiento',
    categoria: 'auxiliares',
    body: {
      tipo: 'lista',
      titulo: 'Apoyo al mantenimiento',
      items: [
        'Sustitución de bombillas y luminarias (material a cargo de la comunidad).',
        'Revisión y limpieza básica de rejillas de desagüe obstruidas.',
        'Conocimiento de la ubicación de llaves de corte de agua, luz y gas para casos de emergencia.',
        'Información periódica a la Junta de Gobierno sobre incidencias y estado general de la finca.',
      ],
    },
  },
  {
    codigo: 'auxiliares_beneficios',
    nombre: 'Auxiliares — beneficios',
    categoria: 'auxiliares',
    body: {
      tipo: 'lista',
      titulo: 'Beneficios para la comunidad',
      items: [
        'Mayor tranquilidad y control diario',
        'Prevención de conflictos y actos vandálicos',
        'Mejora de la convivencia vecinal',
        'Supervisión constante del estado del edificio',
        'Imagen cuidada y profesional de la comunidad',
      ],
    },
  },
  {
    codigo: 'auxiliares_marco_legal',
    nombre: 'Auxiliares — marco legal',
    categoria: 'auxiliares',
    body: {
      tipo: 'texto',
      titulo: 'Marco legal',
      parrafos: [
        'El servicio se presta conforme a la normativa vigente, sin realizar funciones reservadas al personal de seguridad privada según lo establecido en la legislación aplicable, incluyendo el Real Decreto 2364/1994 y normativa complementaria.',
      ],
    },
  },
  {
    codigo: 'limpieza_intro',
    nombre: 'Limpieza — introducción',
    categoria: 'limpieza',
    body: {
      tipo: 'texto',
      parrafos: [
        'El servicio de limpieza está diseñado para mantener la finca en condiciones óptimas de higiene, imagen y salubridad, garantizando un mantenimiento continuo de las zonas comunes y evitando la acumulación de suciedad o deterioro prematuro de las instalaciones.',
        'Nuestro objetivo es que la comunidad permanezca siempre en buen estado, sin depender de avisos constantes por parte de vecinos o administradores.',
      ],
    },
  },
  {
    codigo: 'limpieza_funcionamiento',
    nombre: 'Limpieza — funcionamiento',
    categoria: 'limpieza',
    body: {
      tipo: 'texto',
      titulo: 'Funcionamiento del servicio',
      parrafos: [
        'El personal asignado realiza un mantenimiento periódico siguiendo un plan de trabajo establecido, adaptado a las características del edificio y supervisado regularmente para asegurar la calidad del servicio.',
        'Las tareas pueden ajustarse según necesidades de la comunidad.',
      ],
    },
  },
  {
    codigo: 'limpieza_frecuencias',
    nombre: 'Limpieza — frecuencias',
    categoria: 'limpieza',
    body: {
      tipo: 'grupos',
      titulo: 'Tareas habituales',
      grupos: [
        {
          titulo: 'Frecuencia diaria',
          items: [
            'Barrido y fregado de suelos',
            'Limpieza de escaleras interiores',
            'Limpieza de ascensor',
            'Limpieza de huellas en barandillas, buzones e interruptores',
            'Limpieza de cristales de acceso',
            'Vaciado de publicidad',
          ],
        },
        {
          titulo: 'Frecuencia alterna',
          items: [
            'Limpieza de puerta de acceso',
            'Desempolvado de puntos de luz',
            'Limpieza de elementos decorativos',
            'Limpieza de patios',
          ],
        },
      ],
    },
  },
  {
    codigo: 'limpieza_beneficios',
    nombre: 'Limpieza — beneficios',
    categoria: 'limpieza',
    body: {
      tipo: 'lista',
      titulo: 'Beneficios',
      items: [
        'Mejora de la imagen del edificio',
        'Prevención de malos olores y suciedad acumulada',
        'Reducción de quejas vecinales',
        'Mayor conservación de las instalaciones',
        'Servicio estable sin depender de una sola persona',
      ],
      cierre:
        'El plan de trabajo puede adaptarse a las necesidades específicas de cada comunidad.',
    },
  },
  {
    codigo: 'jardineria_completo',
    nombre: 'Jardinería — contenido completo',
    categoria: 'jardineria',
    body: {
      tipo: 'compuesto',
      parrafos: [
        'El servicio de jardinería está orientado a la conservación estética y sanitaria de las zonas verdes, garantizando durante todo el año un correcto estado del jardín y evitando su deterioro progresivo.',
        'El mantenimiento se realiza de forma periódica, adaptándose a las estaciones y necesidades de cada zona ajardinada.',
      ],
      grupos: [
        {
          titulo: 'Trabajos de mantenimiento',
          items: [
            'Eliminación de malas hierbas mediante medios manuales o mecánicos según superficie',
            'Recorte y perfilado de zonas verdes',
            'Limpieza de hojas y restos vegetales',
            'Retirada de brotes no deseados (chupones)',
            'Control y revisión del sistema de riego',
            'Aviso de averías y posibilidad de reparación (materiales no incluidos)',
          ],
        },
        {
          titulo: 'Tratamientos y conservación',
          items: [
            'Dos tratamientos fitosanitarios preventivos anuales con productos homologados (incluidos)',
            'Abonado orgánico anual incluido',
            'Poda anual de arbolado hasta 3 metros de altura',
          ],
        },
        {
          titulo: 'Beneficios',
          items: [
            'Jardín cuidado durante todo el año',
            'Prevención de plagas y deterioro',
            'Mejora estética de la finca',
            'Mayor durabilidad de plantas y césped',
            'Reducción de incidencias por riego o suciedad',
          ],
        },
      ],
      condiciones: [
        'El consumo de agua será por cuenta de la comunidad',
        'La retirada de restos de poda mediante camión no está incluida',
      ],
    },
  },
  {
    codigo: 'cubos_completo',
    nombre: 'Cubos — contenido completo',
    categoria: 'cubos',
    body: {
      tipo: 'compuesto',
      parrafos: [
        'El servicio de gestión de cubos está orientado a mantener la zona de residuos organizada, limpia y sin molestias para los vecinos, evitando acumulaciones, malos olores y sanciones por incumplimiento de horarios municipales.',
        'Nos encargamos de la correcta retirada y colocación de los contenedores según la normativa local, garantizando comodidad para la comunidad y una buena imagen del edificio.',
      ],
      grupos: [
        {
          titulo: 'Funcionamiento del servicio',
          items: [
            'Salida de cubos en horario permitido',
            'Entrada de cubos tras la recogida municipal',
            'Colocación correcta en la zona asignada',
            'Cierre de tapas y ordenación del área de residuos',
            'Limpieza básica del entorno inmediato',
            'Aviso de incidencias (roturas, suciedad excesiva, vandalismo)',
          ],
        },
        {
          titulo: 'Beneficios',
          items: [
            'Evita sanciones municipales',
            'Elimina molestias para los vecinos',
            'Mejora la higiene del acceso a la finca',
            'Previene malos olores y suciedad',
            'Mayor comodidad diaria',
          ],
        },
      ],
      condiciones: [
        'El servicio se realizará conforme a la normativa municipal vigente de recogida de residuos.',
      ],
    },
  },
  {
    codigo: 'garaje_completo',
    nombre: 'Garaje — tareas operativas',
    categoria: 'garaje',
    body: {
      tipo: 'compuesto',
      titulo: 'Tareas operativas',
      parrafos: [
        'Los auxiliares de servicios tienen establecidas unas tareas por defecto, cualquiera de ellas puede ser sustituida por otras o modificadas a petición del cliente, entre dichas tareas se encuentran.',
      ],
      grupos: [
        {
          titulo: 'Tareas',
          items: [
            'Desempolvado de paredes',
            'Limpieza de tuberías, puntos de luz, extintores, elementos decorativos',
            'Limpieza del suelo con máquina de hombre sentado',
            'Limpieza del suelo con Karcher',
          ],
        },
      ],
      notas: [
        'Para una limpieza más efectiva y segura no debe de haber ningún vehículo ni objeto en el interior del garaje en el momento de la limpieza. Se trabaja con maquinaria que produce salpicadura y proyección de pequeños objetos.',
        'Para la realización de trabajos se pasará aviso con mínimo 10 días naturales para que los usuarios puedan desalojar las plazas de garaje.',
        'Nota importante: las plazas ocupadas no se limpiarán después del día asignado a la limpieza. Se pasará a la administración un listado con las plazas ocupadas en el momento de realización de los servicios.',
      ],
    },
  },
  {
    codigo: 'garantia_corporativa',
    nombre: 'Garantía profesional corporativa',
    categoria: 'corporativo',
    body: {
      tipo: 'garantia_cajas',
      intro:
        'garantiza el cumplimiento de las siguientes obligaciones y certificaciones profesionales, como base de confianza en nuestra relación con los clientes.',
      cajas: [
        {
          codigo: 'prl',
          titulo: 'Prevención de Riesgos Laborales',
          texto:
            'El cumplimiento de todas las pautas en materia de PRL es nuestra prioridad por eso colaboramos activamente con Mutua Universal.',
        },
        {
          codigo: 'laboral',
          titulo: 'Obligación laboral',
          texto:
            'Ponemos a disposición cuando usted lo requiera los informes de estar al día en las obligaciones tributarias.',
        },
        {
          codigo: 'rc',
          titulo: 'Certificado de Responsabilidad Civil',
          texto:
            'Dispone de un seguro de RC en 600.000 €, para dar atención a cualquier imprevisto.',
        },
        {
          codigo: 'tributarias',
          titulo: 'Certificado al corriente de Obligaciones Tributarias',
          texto:
            'Ponemos a disposición de todos nuestros clientes que lo soliciten el certificado correspondiente de estar al corriente de todas nuestras obligaciones tributarias derivadas de nuestro ejercicio.',
        },
        {
          codigo: 'igualdad',
          titulo: 'Plan de Igualdad',
          texto:
            'Dispone del Plan de Igualdad con Grupo ASPY (Conversia) según Real Decreto-Ley 6/2019.',
        },
        {
          codigo: 'confidencialidad',
          titulo: 'Confidencialidad',
          texto:
            'El presente documento, así como todos los anexos posibles, contiene información confidencial. Nos comprometemos con todos nuestros clientes a no revelar ni publicar sus datos sin su consentimiento.',
        },
      ],
    },
  },
  {
    codigo: 'condiciones_generales',
    nombre: 'Condiciones contractuales generales',
    categoria: 'corporativo',
    body: {
      tipo: 'condiciones_secciones',
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
    },
  },
];

export const PRESENTACION_DECAMINO_SEED: string[] = [
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

export const ACEPTACION_DECAMINO_SEED =
  'La firma de este documento implica la aceptación de la propuesta económica y de las condiciones indicadas. La formalización contractual se realizará según el procedimiento de la empresa.';

/** Refs de bloques por servicio catalog. */
export const SERVICIO_BLOQUES_REFS: Record<string, string[]> = {
  auxiliares: [
    'auxiliares_intro',
    'auxiliares_operativa',
    'auxiliares_mantenimiento',
    'auxiliares_beneficios',
    'auxiliares_marco_legal',
  ],
  limpieza: [
    'limpieza_intro',
    'limpieza_funcionamiento',
    'limpieza_frecuencias',
    'limpieza_beneficios',
  ],
  auxiliar_limpieza: [
    'auxiliares_intro',
    'auxiliares_operativa',
    'auxiliares_mantenimiento',
    'auxiliares_marco_legal',
    'limpieza_intro',
    'limpieza_funcionamiento',
    'limpieza_frecuencias',
    'limpieza_beneficios',
  ],
  jardineria: ['jardineria_completo'],
  cubos: ['cubos_completo'],
  garaje: ['garaje_completo'],
};
