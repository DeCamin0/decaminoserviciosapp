export type PrlAutoevaluacionOptionKey = 'a' | 'b' | 'c' | 'd';

export interface PrlAutoevaluacionQuestion {
  id: number;
  text: string;
  options: {
    a: string;
    b: string;
    c: string;
    d?: string;
  };
}

export interface PrlAutoevaluacionLayout {
  id: string;
  matchFileName: RegExp;
  minScore: number;
  /** Clave interna — no exponer al cliente */
  answers: Record<string, PrlAutoevaluacionOptionKey>;
  questions: PrlAutoevaluacionQuestion[];
}

/** Autoevaluación manual PRL Oficinas y Despachos (pág. 19). Clave: SOLUCIONES del PDF. */
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
): PrlAutoevaluacionQuestion[] {
  return layout.questions.map(({ id, text, options }) => ({ id, text, options }));
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
    const given = String(respuestas[key] || '')
      .trim()
      .toLowerCase();
    if (expected && given === expected) correctas += 1;
  }
  return { correctas, total, puntuacion: correctas };
}
