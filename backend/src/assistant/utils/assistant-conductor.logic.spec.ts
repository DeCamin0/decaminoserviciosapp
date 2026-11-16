import { IntentType } from '../services/intent-classifier.service';
import {
  buildDecisionMessages,
  containsForbiddenTemplate,
  isJornadaBootstrap,
  runConductorTurn,
  splitPageContext,
} from './assistant-conductor.logic';

const BOOTSTRAP = [
  'Hola, tengo un problema con el sistema de registro de jornada.',
  '',
  '📋 PAGINA: Registro de Jornada',
  '👤 EMPLEADO: EMPLEADO (Código: 000)',
  '📅 FECHA: 10/09/2026',
  '🏢 CENTRO: Auxiliar De Servicios',
  '📌 ASIGNADO: Cuadrante',
  '',
  '⏰ HORARIO planificado para hoy:',
  '  • 08:00 - 15:00',
  '',
  '📝 Últimos FICHAJES recientes:',
  '  • 10/09 08:01 entrada',
].join('\n');

describe('conductor del asistente', () => {
  it('separa el contexto de Registro de Jornada de la pregunta', () => {
    const split = splitPageContext(BOOTSTRAP);
    expect(isJornadaBootstrap(BOOTSTRAP)).toBe(true);
    expect(split.utterance).toBe('');
    expect(split.pageContext?.fecha).toBe('10/09/2026');
    expect(split.pageContext?.horario).toContain('08:00 - 15:00');
    expect(split.pageContext?.fichajes).toContain('entrada');
    expect(split.pageContext?.centro).toContain('Auxiliar');
  });

  it('no trata una pregunta normal como página', () => {
    const split = splitPageContext('Se me olvidó fichar la salida');
    expect(split.pageContext).toBeNull();
    expect(split.utterance).toBe('Se me olvidó fichar la salida');
  });

  it('el indicio de palabras no es la decisión y el contexto no es la pregunta', () => {
    const built = buildDecisionMessages({
      mensaje: BOOTSTRAP,
      history: [],
      hint: 'cuadrante (0.90)',
    });
    const system = built.messages[0].content;
    expect(system).toContain('NO es la decisión');
    expect(system).toContain('cuadrante (0.90)');
    expect(built.utterance).toBe('');
    expect(
      built.messages.some((m) => m.content.includes('no es la pregunta')),
    ).toBe(true);
    expect(built.messages.some((m) => m.content.includes('Código: 000'))).toBe(
      false,
    );
  });

  it('Fernando: el mensaje de la página no consulta el cuadrante', async () => {
    const runTool = jest.fn();
    const turn = await runConductorTurn({
      mensaje: BOOTSTRAP,
      history: [],
      locale: 'es',
      hint: 'cuadrante (0.90)',
      userId: '42',
      decide: async () => ({
        action: 'tool',
        tool: 'cuadrante',
        fecha: '2026-09-10',
        centro: 'Auxiliar De Servicios',
      }),
      phrase: async (messages) => {
        const blob = messages.map((m) => m.content).join('\n');
        expect(blob).toContain('08:00 - 15:00');
        expect(blob).toContain('todavía no ha preguntado');
        return 'Veo tu horario de hoy, de 08:00 a 15:00, y una entrada. ¿Qué problema tienes?';
      },
      runTool,
    });
    expect(runTool).not.toHaveBeenCalled();
    expect(turn.responseSource).toBe('llm');
    expect(turn.answerAuthor).toBe('model');
    expect(turn.respuesta).toContain('08:00');
    expect(containsForbiddenTemplate(turn.respuesta)).toBe(false);
  });

  it('Fernando: la salida olvidada usa el procedimiento y la fecha ya conocida', async () => {
    const runTool = jest.fn();
    const turn = await runConductorTurn({
      mensaje: 'Se me olvidó fichar la salida',
      history: [
        { role: 'user', content: BOOTSTRAP },
        {
          role: 'assistant',
          content: '¿Qué ocurre con el registro de hoy?',
        },
      ],
      locale: 'es',
      hint: 'fichajes (0.60)',
      userId: '42',
      decide: async (messages) => {
        const blob = messages.map((m) => m.content).join('\n');
        expect(blob).toContain('10/09/2026');
        expect(blob).toContain('Se me olvidó fichar la salida');
        expect(blob).toContain('NO es la decisión');
        return { action: 'procedure', procedureId: 'olvido_fichaje' };
      },
      phrase: async (messages) => {
        const blob = messages.map((m) => m.content).join('\n');
        expect(blob).toContain('Indicar motivo');
        expect(blob).toContain('Regularizar');
        expect(blob).toContain('10/09/2026');
        expect(blob).toContain('ni pidas');
        return 'La salida de hoy se regulariza en Registros con Regularizar. Si el día pasó sin fichajes, en Mi Horario usa Indicar motivo y Olvidé fichar.';
      },
      runTool,
    });
    expect(runTool).not.toHaveBeenCalled();
    expect(turn.intentLabel).toBe('procedure:olvido_fichaje');
    expect(turn.respuesta).toContain('Regularizar');
    expect(turn.respuesta).not.toContain(
      'No se encontró información del cuadrante',
    );
    expect(turn.responseSource).toBe('llm');
  });

  it('una frase nueva, que no está en el historial, sigue el procedimiento elegido', async () => {
    const turn = await runConductorTurn({
      mensaje: 'me quedé sin batería y no marqué la salida ayer',
      history: [],
      locale: 'es',
      hint: 'desconocido (0.20)',
      userId: '42',
      decide: async () => ({
        action: 'procedure',
        procedureId: 'olvido_fichaje',
      }),
      phrase: async (messages) => {
        const blob = messages.map((m) => m.content).join('\n');
        expect(blob).toContain('me quedé sin batería');
        expect(blob).toContain('Olvidé fichar');
        return 'Ayer ya pasó y no hay fichaje: en Mi Horario pulsa Indicar motivo y elige Olvidé fichar.';
      },
      runTool: async () => {
        throw new Error('no debía consultar');
      },
    });
    expect(turn.respuesta).toContain('Indicar motivo');
    expect(turn.responseSource).toBe('llm');
  });

  it('un diploma no se consulta como fichaje aunque el indicio diga fichajes', async () => {
    const runTool = jest.fn().mockResolvedValue({
      data: [{ nombre: 'A', archivo: 'si' }],
      tool: 'diplomas_metadatos',
      error: null,
    });
    const turn = await runConductorTurn({
      mensaje: 'quien tiene alguna diploma',
      history: [],
      locale: 'es',
      hint: 'fichajes (0.70)',
      userId: '42',
      decide: async () => ({ action: 'tool', tool: 'diplomas' }),
      phrase: async () => 'Hay un diploma cargado.',
      runTool,
    });
    expect(runTool).toHaveBeenCalledWith(IntentType.DIPLOMAS, {});
    expect(turn.tools).toEqual(['diplomas_metadatos']);
    expect(turn.responseSource).toBe('llm');
  });

  it('el horario de hoy es un solo día y el de este mes no lleva fecha', async () => {
    const days: Array<string | undefined> = [];
    await runConductorTurn({
      mensaje: 'que horarrio tengo para hoy',
      history: [],
      locale: 'es',
      hint: 'cuadrante (0.80)',
      userId: '42',
      decide: async () => ({ action: 'tool', tool: 'cuadrante' }),
      phrase: async () => 'Hoy trabajas de 08:00 a 15:00.',
      runTool: async (_intent, entidades) => {
        days.push(entidades.fecha);
        expect(entidades.codigo).toBe('42');
        return {
          data: [{ valor_celula_cuadrante: '08:00-15:00' }],
          tool: 'plan_trabajo_dia',
          error: null,
        };
      },
    });
    expect(days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await runConductorTurn({
      mensaje: 'que horario tengo este mes',
      history: [],
      locale: 'es',
      hint: 'cuadrante (0.80)',
      userId: '42',
      decide: async () => ({
        action: 'tool',
        tool: 'cuadrante',
        fecha: '2026-11-10',
      }),
      phrase: async () => 'Este mes tienes turnos repartidos.',
      runTool: async (_intent, entidades) => {
        expect(entidades.fecha).toBeUndefined();
        expect(entidades.codigo).toBe('42');
        return { data: [{ dia: 1 }], tool: 'cuadrante_mes', error: null };
      },
    });
  });

  it('un saludo no abre el menú de módulos', async () => {
    const turn = await runConductorTurn({
      mensaje: 'hola',
      history: [],
      locale: 'es',
      hint: 'desconocido (0.10)',
      userId: '42',
      decide: async () => ({
        action: 'reply',
        texto: 'Hola. Dime qué necesitas.',
      }),
      phrase: async () => {
        throw new Error('el saludo ya viene escrito');
      },
      runTool: async () => {
        throw new Error('no hay consulta');
      },
    });
    expect(turn.respuesta).toBe('Hola. Dime qué necesitas.');
    expect(turn.respuesta).not.toContain('Solicitudes o Cuadrantes');
    expect(turn.responseSource).toBe('llm');
  });

  it('una incidencia no abre un ticket ni consulta datos', async () => {
    const runTool = jest.fn();
    const turn = await runConductorTurn({
      mensaje: 'quiero reportar que no tenía internet',
      history: [],
      locale: 'es',
      hint: 'incidencias (0.80)',
      userId: '42',
      decide: async () => ({ action: 'tool', tool: 'incidencias' }),
      phrase: async (messages) => {
        const blob = messages.map((m) => m.content).join('\n');
        expect(blob).toContain('No hay un procedimiento verificado');
        return 'No tengo un procedimiento verificado para abrir una incidencia general.';
      },
      runTool,
    });
    expect(runTool).not.toHaveBeenCalled();
    expect(turn.intentLabel).toBe('procedure:no_documentada');
    expect(turn.respuesta).toContain('No tengo un procedimiento verificado');
  });

  it('sin modelo, consulta el horario y lo dice sin fingir que habló GPT', async () => {
    const phrase = jest.fn();
    const turn = await runConductorTurn({
      mensaje: 'qué horario tengo hoy',
      history: [],
      locale: 'es',
      hint: 'cuadrante (0.80)',
      userId: '42',
      decide: async () => 'unavailable',
      phrase,
      runTool: async (intent, entidades) => {
        expect(intent).toBe(IntentType.CUADRANTE);
        expect(entidades.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entidades.codigo).toBe('42');
        return {
          data: [
            {
              nombre: 'A',
              valor_celula_cuadrante: '08:00-15:00',
              trabaja_este_dia: 1,
            },
          ],
          tool: 'plan_trabajo_dia',
          error: null,
        };
      },
    });
    expect(phrase).not.toHaveBeenCalled();
    expect(turn.responseSource).toBe('fallback');
    expect(turn.answerAuthor).toBe('fallback');
    expect(turn.limitations).toContain('sin_modelo');
    expect(turn.respuesta.toLowerCase()).toContain('sin el modelo');
    expect(turn.respuesta).toContain('08:00-15:00');
    expect(containsForbiddenTemplate(turn.respuesta)).toBe(false);
  });

  it('sin modelo, la página y un fichaje olvidado no usan las plantillas viejas', async () => {
    const page = await runConductorTurn({
      mensaje: BOOTSTRAP,
      history: [],
      locale: 'es',
      hint: 'cuadrante (0.90)',
      userId: '42',
      decide: async () => 'unavailable',
      phrase: async () => 'unavailable',
      runTool: async () => {
        throw new Error('la página no se consulta');
      },
    });
    expect(page.respuesta).toContain('08:00 - 15:00');
    expect(page.respuesta.toLowerCase()).toContain('sin el modelo');
    expect(containsForbiddenTemplate(page.respuesta)).toBe(false);

    const forgot = await runConductorTurn({
      mensaje: 'Se me olvidó fichar la salida',
      history: [{ role: 'user', content: BOOTSTRAP }],
      locale: 'es',
      hint: 'fichajes (0.60)',
      userId: '42',
      decide: async () => 'unavailable',
      phrase: async () => 'unavailable',
      runTool: async () => {
        throw new Error('un olvido no es un listado');
      },
    });
    expect(forgot.intentLabel).toBe('procedure:olvido_fichaje');
    expect(forgot.respuesta).toContain('Regularizar');
    expect(forgot.respuesta).toContain('Indicar motivo');
    expect(containsForbiddenTemplate(forgot.respuesta)).toBe(false);

    const battery = await runConductorTurn({
      mensaje: 'me quedé sin batería y no marqué la salida ayer',
      history: [],
      locale: 'es',
      hint: 'desconocido (0.20)',
      userId: '42',
      decide: async () => 'unavailable',
      phrase: async () => 'unavailable',
      runTool: async () => {
        throw new Error('no es un listado');
      },
    });
    expect(battery.intentLabel).toBe('procedure:olvido_fichaje');
  });

  it('si el modelo repite la plantilla de cuadrante, no se enseña', async () => {
    const turn = await runConductorTurn({
      mensaje: 'qué horario tengo hoy',
      history: [],
      locale: 'es',
      hint: 'cuadrante (0.80)',
      userId: '42',
      decide: async () => ({ action: 'tool', tool: 'cuadrante' }),
      phrase: async () =>
        'No se encontró información del cuadrante para el período consultado.',
      runTool: async () => ({
        data: [],
        tool: 'plan_trabajo_dia',
        error: null,
      }),
    });
    expect(turn.responseSource).toBe('fallback');
    expect(turn.limitations).toContain('respuesta_plantilla_descartada');
    expect(turn.respuesta).not.toContain(
      'No se encontró información del cuadrante',
    );
  });

  it('vacaciones, justificante y una pregunta general no memorizan la frase', async () => {
    const cases = [
      {
        mensaje: 'cómo solicito vacaciones',
        decision: { action: 'procedure', procedureId: 'vacaciones_solicitud' },
        must: 'Vacaciones',
      },
      {
        mensaje: 'no puedo subir el justificante',
        decision: { action: 'procedure', procedureId: 'ausencia_justificada' },
        must: 'Adjuntar justificante',
      },
      {
        mensaje: 'dasdasdas',
        decision: {
          action: 'reply',
          texto: 'No he entendido el mensaje. ¿Puedes reformularlo?',
        },
        must: '',
      },
    ];
    for (const item of cases) {
      const turn = await runConductorTurn({
        mensaje: item.mensaje,
        history: [],
        locale: 'es',
        hint: 'desconocido (0.20)',
        userId: '42',
        decide: async () => item.decision,
        phrase: async (messages) => {
          const blob = messages.map((m) => m.content).join('\n');
          if (item.must) expect(blob).toContain(item.must);
          return 'Te explico los pasos que sí están documentados.';
        },
        runTool: async () => ({ data: null, tool: null, error: null }),
      });
      expect(turn.respuesta).not.toContain('(Respuesta sin IA.)');
    }
  });
});
