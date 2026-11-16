import { IntentType } from '../services/intent-classifier.service';
import { AssistantConductorService } from '../services/assistant-conductor.service';
import {
  containsForbiddenTemplate,
  runConductorTurn,
  type ConductorHistoryTurn,
} from './assistant-conductor.logic';
import * as fs from 'fs';
import * as path from 'path';

const live = process.env.OPENAI_CONDUCTOR_EVAL === '1';

function loadOpenAiKey(): void {
  if (process.env.OPENAI_API_KEY) return;
  const file = path.join(__dirname, '../../../.env.decamino.local');
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('OPENAI_API_KEY=')) continue;
    const value = line
      .slice('OPENAI_API_KEY='.length)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (value) process.env.OPENAI_API_KEY = value;
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ausente');
  }
}

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

(live ? describe : describe.skip)(
  'gpt-4o-mini conduce, sin base de datos',
  () => {
    jest.setTimeout(180000);
    let conductor: AssistantConductorService;

    beforeAll(() => {
      loadOpenAiKey();
      conductor = new AssistantConductorService({
        get: () => process.env.OPENAI_API_KEY,
      } as never);
    });

    async function turn(
      mensaje: string,
      history: ConductorHistoryTurn[] = [],
      hint = 'desconocido (0.20)',
    ) {
      const tools: string[] = [];
      const result = await runConductorTurn({
        mensaje,
        history,
        locale: 'es',
        hint,
        userId: '42',
        decide: (messages) => conductor.completeDecision(messages),
        phrase: (messages) => conductor.completePhrase(messages),
        runTool: async (intent) => {
          tools.push(intent);
          return { data: [{ ejemplo: true }], tool: intent, error: null };
        },
      });
      return { result, tools };
    }

    it('la página de jornada no busca el cuadrante', async () => {
      const { result, tools } = await turn(BOOTSTRAP, [], 'cuadrante (0.90)');
      expect(tools).toEqual([]);
      expect(containsForbiddenTemplate(result.respuesta)).toBe(false);
      expect(result.answerAuthor).toBe('model');
    });

    it('olvidé la salida explica el procedimiento, no el listado', async () => {
      const { result, tools } = await turn(
        'Se me olvidó fichar la salida',
        [
          { role: 'user', content: BOOTSTRAP },
          {
            role: 'assistant',
            content: '¿Qué problema tienes con el registro?',
          },
        ],
        'fichajes (0.60)',
      );
      expect(tools).not.toContain(IntentType.FICHAJES);
      expect(result.intentLabel).toBe('procedure:olvido_fichaje');
      expect(result.respuesta).toMatch(
        /Regularizar|Indicar motivo|Olvidé fichar/,
      );
      expect(containsForbiddenTemplate(result.respuesta)).toBe(false);
    });

    it('una frase nueva sobre la batería no está memorizada', async () => {
      const { result, tools } = await turn(
        'me quedé sin batería y no marqué la salida ayer',
      );
      expect(tools).toEqual([]);
      expect(result.intentLabel).toBe('procedure:olvido_fichaje');
      expect(result.respuesta).toMatch(/Indicar motivo|Olvidé fichar/);
    });

    it('diploma, horario de hoy, vacaciones, saludo y texto sin sentido', async () => {
      const diploma = await turn(
        'quien tiene alguna diploma',
        [],
        'fichajes (0.70)',
      );
      expect(diploma.tools).toEqual([IntentType.DIPLOMAS]);

      const hoy = await turn(
        'que horarrio tengo para hoy',
        [],
        'desconocido (0.30)',
      );
      expect(hoy.tools).toEqual([IntentType.CUADRANTE]);
      expect(containsForbiddenTemplate(hoy.result.respuesta)).toBe(false);

      const vacaciones = await turn('cómo solicito vacaciones?');
      expect(vacaciones.tools).toEqual([]);
      expect(vacaciones.result.intentLabel).toBe(
        'procedure:vacaciones_solicitud',
      );
      expect(vacaciones.result.respuesta).toContain('Vacaciones');
      expect(vacaciones.result.respuesta).not.toContain('(Respuesta sin IA.)');

      const hola = await turn('hola');
      expect(hola.tools).toEqual([]);
      expect(hola.result.respuesta.toLowerCase()).not.toContain(
        'solicitudes o cuadrantes',
      );

      const ruido = await turn('dasdasdas');
      expect(ruido.tools).toEqual([]);
      expect(containsForbiddenTemplate(ruido.result.respuesta)).toBe(false);
    });
  },
);
