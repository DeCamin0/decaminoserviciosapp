export type PrlAutoevaluacionOptionKey = 'a' | 'b' | 'c' | 'd';

export type PrlAutoevaluacionAnswerValue =
  | PrlAutoevaluacionOptionKey
  | { type: 'text'; accept: string[] };

export interface PrlAutoevaluacionQuestion {
  id: number;
  text: string;
  type?: 'choice' | 'text';
  placeholder?: string;
  options?: {
    a: string;
    b: string;
    c?: string;
    d?: string;
  };
}

export interface PrlAutoevaluacionLayout {
  id: string;
  matchFileName: RegExp;
  minScore: number;
  answers: Record<string, PrlAutoevaluacionAnswerValue>;
  questions: PrlAutoevaluacionQuestion[];
}

function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isTextAnswer(
  expected: PrlAutoevaluacionAnswerValue,
): expected is { type: 'text'; accept: string[] } {
  return typeof expected === 'object' && expected?.type === 'text';
}

function matchTextAnswer(given: string, accept: string[]): boolean {
  const normalizedGiven = normalizeText(given);
  if (!normalizedGiven) return false;
  return accept.some((candidate) => {
    const normalizedCandidate = normalizeText(candidate);
    return (
      normalizedGiven === normalizedCandidate ||
      normalizedGiven.includes(normalizedCandidate)
    );
  });
}

/** Autoevaluaciones configuradas por nombre de archivo del manual PRL (una por manual). */
export const PRL_MANUAL_AUTOEVALUACIONS: PrlAutoevaluacionLayout[] = [
  {
    id: 'oficinas_despachos_v1',
    matchFileName: /MANUAL\s+PRL\s+OFICINAS\s+Y\s+DESPACHOS/i,
    minScore: 8,
    answers: {
      '1': 'b',
      '2': 'b',
      '3': 'c',
      '4': 'c',
      '5': 'c',
      '6': 'c',
      '7': 'a',
      '8': 'c',
      '9': 'b',
      '10': 'b',
    },
    questions: [
      {
        id: 1,
        text: 'Los accidentes sufridos por trabajadores de oficinas y despachos:',
        options: {
          a: 'Son pocos, pero graves',
          b: 'Se producen fundamentalmente en el lugar de trabajo',
          c: 'Las dos anteriores son correctas',
        },
      },
      {
        id: 2,
        text: 'La responsabilidad de realizar la vigilancia de la salud de los trabajadores de las oficinas y despachos es de:',
        options: {
          a: 'El servicio de prevención',
          b: 'El empresario',
          c: 'El servicio médico de empresa',
        },
      },
      {
        id: 3,
        text: '¿Qué repercusiones para la salud de los trabajadores ha tenido el desarrollo de las tecnologías de la información en las últimas décadas?',
        options: {
          a: 'Ha supuesto un aumento de la producción y la eliminación de tareas tediosas y repetitivas, que en algunos casos ha favorecido la salud y bienestar de los trabajadores',
          b: 'Ha supuesto mayores exigencias en cuanto a rapidez y complejidad de la información, que en algunos casos ha perjudicado la salud y el bienestar de los trabajadores',
          c: 'Las dos anteriores son correctas',
        },
      },
      {
        id: 4,
        text: 'Indicar cuál de los siguientes se puede considerar como efectos del síndrome de edificio enfermo sobre la salud:',
        options: {
          a: 'Asma',
          b: 'Enfermedad del Legionario',
          c: 'Irritación de ojos, nariz y garganta',
        },
      },
      {
        id: 5,
        text: 'Para corregir los efectos de las radiaciones y campos electromagnéticos:',
        options: {
          a: 'Debe existir una adecuada puesta a tierra',
          b: 'Debe existir una humedad ambiental entre el 45 y el 65 %',
          c: 'Las dos anteriores son correctas',
        },
      },
      {
        id: 6,
        text: 'El problema más habitual producido por el ruido, en oficinas y despachos es:',
        options: {
          a: 'Problemas intestinales',
          b: 'Sordera profesional',
          c: 'Interferencias en la concentración',
        },
      },
      {
        id: 7,
        text: 'La posición del teclado debe permitir:',
        options: {
          a: 'Trabajar con los brazos en ángulo recto',
          b: 'Trabajar con los brazos lo más bajos posible',
          c: 'Trabajar con los brazos a la altura de los hombros',
        },
      },
      {
        id: 8,
        text: 'Para levantar una carga:',
        options: {
          a: 'Se debe mantener la columna vertebral recta y alineada con la carga',
          b: 'Se debe evitar la torsión de la columna',
          c: 'Las dos anteriores son correctas',
        },
      },
      {
        id: 9,
        text: 'Para evitar los golpes contra objetos se puede utilizar como medida preventiva:',
        options: {
          a: 'Mantener un nivel de iluminación de 500 lux',
          b: 'Despejar las zonas de tránsito de las personas',
          c: 'Evitar la monotonía en los puestos de trabajo',
        },
      },
      {
        id: 10,
        text: 'Para evitar reflejos en la pantalla de visualización, las fuentes de luz se colocarán:',
        options: {
          a: 'La artificial sobre el puesto de trabajo y la natural detrás del operador',
          b: 'La artificial y la natural paralela a los puestos de trabajo',
          c: 'Ambas por detrás del trabajador',
        },
      },
    ],
  },
  {
    id: 'manual_prl_limpieza_v1',
    matchFileName: /MANUAL[\s_]+LIMPIEZA/i,
    minScore: 8,
    answers: {
      '1': 'b',
      '2': 'a',
      '3': 'b',
      '4': 'c',
      '5': 'b',
      '6': 'a',
      '7': 'c',
      '8': 'a',
      '9': 'a',
      '10': 'c',
    },
    questions: [
      {
        id: 1,
        text: 'Respecto a los riesgos existentes en las empresas clientes, donde las empresas de limpieza llevan a cabo su actividad, ¿cuál de las siguientes afirmaciones es correcta?',
        options: {
          a: 'Los riesgos existentes en la empresa cliente son responsabilidad única y exclusiva de ellos, y no conciernen a la empresa de limpieza.',
          b: 'Los riesgos existentes en la empresa cliente deben ser prevenidos por ésta. No obstante, la empresa de limpieza debe conocerlos, vigilar que se tomen las medidas preventivas necesarias e informar y formar a sus trabajadores sobre ello.',
          c: 'La empresa de limpieza debe averiguar cuáles son los riesgos existentes en las instalaciones del cliente y tomar las medidas preventivas oportunas para que dichas instalaciones sean totalmente seguras.',
        },
      },
      {
        id: 2,
        text: 'Respecto a la utilización de zuecos por parte de los trabajadores de limpieza, ¿cuál de las siguientes afirmaciones es correcta?',
        options: {
          a: 'Este tipo de calzado no proporciona una buena sujeción del pie y aumenta considerablemente el riesgo de caída; por esta razón se desaconseja su utilización.',
          b: 'Sólo se desaconseja su utilización en caso de que sea necesario subirse a escaleras.',
          c: 'Se recomienda especialmente su uso debido a que es un tipo de calzado muy cómodo y disminuye la fatiga.',
        },
      },
      {
        id: 3,
        text: 'Para poder limpiar las partes superiores de estanterías o armarios, donde pueden estar colocados objetos diversos...',
        options: {
          a: 'No subirse en ningún caso a escaleras; de esta manera se evitarán caídas. Procurar limpiarlas desde el suelo utilizando herramientas de mango largo.',
          b: 'Siempre se deben utilizar escaleras o taburetes con peldaños adecuados que permitan ver si existen objetos que puedan caer encima.',
          c: 'Se utilizará cualquier elemento, como sillas o cajas, donde poder subirse para alcanzar la zona a limpiar, siempre y cuando no se tenga que estar subido más de 10 minutos.',
        },
      },
      {
        id: 4,
        text: 'Al efectuar un trasvase de un producto de limpieza desde un bidón o garrafa a un envase más pequeño ¿qué medidas preventivas se deben seguir?',
        options: {
          a: 'Utilizar embudos o cualquier otro medio que permita trasvasar el producto sin que se produzcan derrames.',
          b: 'Utilizar guantes y gafas o pantalla facial que protejan de posibles salpicaduras.',
          c: 'Las anteriores y, además, etiquetar el envase a donde se trasvasa el producto, anotando los datos de la etiqueta del envase original (principalmente, el nombre del producto y los riesgos y medidas de precaución a tener en cuenta).',
        },
      },
      {
        id: 5,
        text: 'Cuando se utilicen "sprays" ¿cuál de las siguientes acciones es incorrecta y puede provocar un accidente?',
        options: {
          a: 'Agitar el envase vigorosamente, porque puede explotar.',
          b: 'Dirigir el chorro hacia una bombilla encendida, porque se puede incendiar.',
          c: 'Mantener apretado el pulsador de salida del chorro durante más de 2 segundos, porque el envase puede alcanzar temperaturas peligrosas.',
        },
      },
      {
        id: 6,
        text: 'Los productos de limpieza...',
        options: {
          a: 'Nunca deben mezclarse, porque pueden producirse reacciones violentas y generar gases tóxicos.',
          b: 'Es conveniente mezclarlos para conseguir que sean más potentes y eficaces.',
          c: 'No se deben diluir, aunque lo diga el fabricante, porque al diluirlos pierden eficacia y no limpian lo suficiente.',
        },
      },
      {
        id: 7,
        text: 'Cuando se utilicen escaleras manuales para efectuar tareas de limpieza...',
        options: {
          a: 'Es necesario utilizar calzado de seguridad con puntera protegida.',
          b: 'Será imprescindible el uso de cinturón y arnés de seguridad.',
          c: 'No se colocará nunca la escalera apoyada sobre tuberías o cristaleras ni delante de puertas sin trabar.',
        },
      },
      {
        id: 8,
        text: 'Al utilizar una escalera manual de 2 metros de longitud apoyada sobre una pared, para evitar que la escalera resbale sobre su base o que caiga hacia atrás ¿qué precauciones se han de tomar?',
        options: {
          a: 'Colocar la escalera de manera que sus pies se encuentren, aproximadamente, a medio metro de la pared y no subir por encima del tercer peldaño contado desde arriba.',
          b: 'Colocar la escalera de manera que sus pies se encuentren, aproximadamente, a 1 metro de la pared y no subir por encima del tercer peldaño contado desde arriba.',
          c: 'Colocar la escalera de manera que sus pies se encuentren, aproximadamente, a medio metro de la pared y no subir por encima del segundo peldaño contado desde arriba.',
        },
      },
      {
        id: 9,
        text: 'Si durante la limpieza de un foso o cualquier otro espacio confinado un compañero se desvanece en su interior, ¿cómo se debe actuar?',
        options: {
          a: 'Lo más rápidamente posible, pero nunca se deberá entrar a rescatarlo sin antes protegerse adecuadamente con los equipos necesarios para no correr riesgos.',
          b: 'Se debe entrar a rescatarlo inmediatamente, sin perder el más mínimo tiempo, pues de lo contrario podría llegar a morir.',
          c: 'Se debe avisar a los bomberos para que acudan a su rescate, puesto que sólo ellos disponen de equipos adecuados para efectuar este tipo de rescates.',
        },
      },
      {
        id: 10,
        text: '¿Cuál de las siguientes acciones contribuye a causar lesiones musculoesqueléticas?',
        options: {
          a: 'Utilizar la fuerza de las piernas para levantar pesos.',
          b: 'Manejar los carros empujándolos desde atrás en lugar de tirar de ellos.',
          c: 'Girar la cintura cuando se manipulan cargas.',
        },
      },
    ],
  },
  {
    id: 'manual_basico_art19_v1',
    matchFileName: /Manual[\s_]*basico[\s_]*ART[\s_]*19/i,
    minScore: 10,
    answers: {
      '1': { type: 'text', accept: ['orden', 'el orden'] },
      '2': 'a',
      '3': {
        type: 'text',
        accept: [
          'revisarse',
          'inspeccionarse',
          'revisarse e inspeccionarse',
          'revisarse e inspeccionadas',
        ],
      },
      '4': 'a',
      '5': { type: 'text', accept: ['electrocución', 'electrocucion'] },
      '6': { type: 'text', accept: ['oxígeno', 'oxigeno'] },
      '7': 'b',
      '8': { type: 'text', accept: ['descanso'] },
      '9': 'a',
      '10': 'b',
      '11': { type: 'text', accept: ['avisar', 'alertar'] },
      '12': 'b',
    },
    questions: [
      {
        id: 1,
        type: 'text',
        placeholder: 'Respuesta (ej.: el orden)',
        text: 'La mejor manera de prevenir los accidentes en todos los lugares de trabajo es mediante el cumplimiento de dos principios básicos como son: ______ y la limpieza.',
      },
      {
        id: 2,
        text: 'Bajo ningún concepto deben ser anulados o inutilizados los dispositivos de seguridad de las máquinas. En el supuesto de la necesidad de realizar trabajos de reparación o de mantenimiento, los dispositivos de seguridad podrán ser retirados siempre y cuando la máquina esté parada, y la actividad sea realizada por el personal autorizado.',
        options: { a: 'Verdadero', b: 'Falso' },
      },
      {
        id: 3,
        type: 'text',
        placeholder: 'Respuesta (ej.: revisarse)',
        text: 'Las herramientas manuales a utilizar deben ser las apropiadas para cada trabajo, y además deben ______ periódicamente con el fin de que éstas estén en buen estado.',
      },
      {
        id: 4,
        text: 'Cuando se realicen trabajos con escaleras, se prestará especial atención al estado de las mismas; así, los largueros de las escaleras de madera serán de una sola pieza y sus peldaños estarán ensamblados, no clavados. Además, no se utilizarán nunca escaleras empalmadas.',
        options: { a: 'Verdadero', b: 'Falso' },
      },
      {
        id: 5,
        type: 'text',
        placeholder: 'Respuesta (ej.: electrocución)',
        text: 'Los riesgos asociados a las instalaciones eléctricas son fundamentalmente la ______, incendio o explosión y la posibilidad de caídas de altura o golpes con otros objetos.',
      },
      {
        id: 6,
        type: 'text',
        placeholder: 'Respuesta (ej.: oxígeno)',
        text: 'Para que se produzca un incendio es necesaria la presencia simultánea de tres elementos: focos de ignición, ______ y combustible.',
      },
      {
        id: 7,
        text: 'Las prendas de protección individual deben estar homologadas con el marcado "CE" y, a su vez, éstas serán intercambiables y utilizables por todo el personal.',
        options: { a: 'Verdadero', b: 'Falso' },
      },
      {
        id: 8,
        type: 'text',
        placeholder: 'Respuesta (ej.: descanso)',
        text: 'En el caso de desarrollar la actividad cotidiana en ambientes de trabajo adversos, algunas de las medidas preventivas más usuales son: la reducción del tiempo de exposición, la utilización de prendas de protección específicas y establecer períodos de ______ en zonas con temperaturas más benignas.',
      },
      {
        id: 9,
        text: 'Antes de la manipulación de cualquier sustancia química el operario deberá leer la etiqueta del envase o solicitar la hoja de datos de seguridad. Si no las tuviera, no se deberá manipular dichos productos.',
        options: { a: 'Verdadero', b: 'Falso' },
      },
      {
        id: 10,
        text: 'Durante la manipulación de cargas, la posición más adecuada para transportarlas será: llevar ligeramente inclinada la espalda hacia adelante y aproximarse la carga lo más cerca posible al cuerpo.',
        options: { a: 'Verdadero', b: 'Falso' },
      },
      {
        id: 11,
        type: 'text',
        placeholder: 'Respuesta (ej.: avisar)',
        text: 'La manera de actuar ante un accidentado es realizando una evaluación primaria que consta de tres etapas: Proteger, ______ y Socorrer.',
      },
      {
        id: 12,
        text: 'En caso de emergencia y de evacuación del edificio, el personal deberá salir de éste rápidamente y abrir las puertas y ventanas encontradas en el camino de evacuación para facilitar la extinción del incendio.',
        options: { a: 'Verdadero', b: 'Falso' },
      },
    ],
  },
];

export function resolvePrlAutoevaluacionLayout(
  fileName: string | null | undefined,
): PrlAutoevaluacionLayout | null {
  const name = String(fileName || '');
  return (
    PRL_MANUAL_AUTOEVALUACIONS.find((layout) => layout.matchFileName.test(name)) ??
    null
  );
}

export function getPublicAutoevaluacionQuestions(
  layout: PrlAutoevaluacionLayout,
): Array<{
  id: number;
  text: string;
  type: 'choice' | 'text';
  placeholder?: string;
  options?: PrlAutoevaluacionQuestion['options'];
}> {
  return layout.questions.map(({ id, text, type, options, placeholder }) => ({
    id,
    text,
    type: type ?? (options ? 'choice' : 'text'),
    placeholder,
    options,
  }));
}

export function scoreAutoevaluacionAnswers(
  layout: PrlAutoevaluacionLayout,
  respuestas: Record<string, string>,
): { correctas: number; total: number; puntuacion: number } {
  const total = layout.questions.length;
  let correctas = 0;
  for (const q of layout.questions) {
    const key = String(q.id);
    const expected = layout.answers[key];
    const given = String(respuestas[key] || '').trim();
    if (!expected) continue;

    if (isTextAnswer(expected)) {
      if (matchTextAnswer(given, expected.accept)) correctas += 1;
      continue;
    }

    if (given.toLowerCase() === expected) correctas += 1;
  }
  return { correctas, total, puntuacion: correctas };
}

export type PrlAutoevaluacionReviewItem = {
  id: number;
  text: string;
  type: 'choice' | 'text';
  respuesta_empleado: string;
  respuesta_texto: string | null;
  correcta: boolean;
  respuesta_correcta?: string;
  respuesta_correcta_texto?: string;
};

export function buildAutoevaluacionReview(
  layout: PrlAutoevaluacionLayout,
  respuestas: Record<string, string>,
  includeCorrectAnswers = false,
): PrlAutoevaluacionReviewItem[] {
  return layout.questions.map((q) => {
    const key = String(q.id);
    const given = String(respuestas[key] || '').trim();
    const expected = layout.answers[key];
    const type: 'choice' | 'text' = q.type ?? (q.options ? 'choice' : 'text');

    let correcta = false;
    if (expected) {
      if (isTextAnswer(expected)) {
        correcta = matchTextAnswer(given, expected.accept);
      } else {
        correcta = given.toLowerCase() === expected;
      }
    }

    let respuestaTexto: string | null = given || null;
    if (type === 'choice' && q.options && given) {
      const opt = q.options[given as PrlAutoevaluacionOptionKey];
      respuestaTexto = opt ? `${given.toUpperCase()}) ${opt}` : given.toUpperCase();
    }

    const item: PrlAutoevaluacionReviewItem = {
      id: q.id,
      text: q.text,
      type,
      respuesta_empleado: given,
      respuesta_texto: respuestaTexto,
      correcta,
    };

    if (includeCorrectAnswers && expected) {
      if (isTextAnswer(expected)) {
        item.respuesta_correcta_texto = expected.accept[0] ?? '';
      } else if (q.options) {
        item.respuesta_correcta = expected;
        item.respuesta_correcta_texto =
          q.options[expected as PrlAutoevaluacionOptionKey] ?? expected.toUpperCase();
      } else {
        item.respuesta_correcta = expected;
        item.respuesta_correcta_texto = expected.toUpperCase();
      }
    }

    return item;
  });
}
