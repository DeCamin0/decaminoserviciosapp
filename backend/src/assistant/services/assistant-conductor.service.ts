import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PROCEDURE_IDS } from '../utils/assistant-procedure-catalog';
import type { ConductorChatMessage } from '../utils/assistant-conductor.logic';

const DECISION_TIMEOUT_MS = 12_000;
const PHRASE_TIMEOUT_MS = 20_000;
const MODEL = 'gpt-4o-mini';

@Injectable()
export class AssistantConductorService {
  private readonly logger = new Logger(AssistantConductorService.name);
  private readonly openai: OpenAI | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('OPENAI_API_KEY') ||
      process.env.OPENAI_API_KEY ||
      '';
    this.openai = apiKey
      ? new OpenAI({ apiKey, timeout: PHRASE_TIMEOUT_MS })
      : null;
    if (!this.openai) {
      this.logger.warn(
        '[assistant:conductor] OPENAI_API_KEY ausente; el chat dirá que el modelo no está disponible',
      );
    }
  }

  async completeDecision(
    messages: ConductorChatMessage[],
  ): Promise<unknown | 'unavailable'> {
    if (!this.openai) return 'unavailable';
    try {
      const completion = await withTimeout(
        this.openai.chat.completions.create({
          model: MODEL,
          temperature: 0,
          messages,
          tools: [
            {
              type: 'function',
              function: {
                name: 'decidir_turno',
                description:
                  'Decide si respondes, consultas una herramienta, explicas un procedimiento o pides un dato.',
                parameters: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    action: {
                      type: 'string',
                      enum: ['reply', 'tool', 'procedure', 'clarify'],
                    },
                    tool: {
                      type: 'string',
                      enum: [
                        'fichajes',
                        'cuadrante',
                        'pedidos',
                        'vacaciones',
                        'solicitudes',
                        'nominas',
                        'diplomas',
                        'documentos',
                        'documentos_solicitados',
                        'comunicados',
                        'procedimientos',
                        'incidencias',
                        'empleados',
                        'ninguna',
                      ],
                    },
                    procedureId: {
                      type: 'string',
                      enum: [...PROCEDURE_IDS],
                    },
                    fecha: { type: 'string' },
                    mes: { type: 'string' },
                    year: { type: 'string' },
                    codigo: { type: 'string' },
                    nombre: { type: 'string' },
                    centro: { type: 'string' },
                    filtro: {
                      type: 'string',
                      enum: [
                        'sin_cuadrante',
                        'sin_horario',
                        'sin_centro',
                        'sin_cuadrante_ni_horario',
                        'sin_cuadrante_o_horario',
                        'sin_centro_ni_cuadrante_ni_horario',
                      ],
                    },
                    soloPendientes: { type: 'boolean' },
                    faltanNominas: { type: 'boolean' },
                    quienNoHaFichado: { type: 'boolean' },
                    texto: { type: 'string' },
                  },
                  required: ['action'],
                },
              },
            },
          ],
          tool_choice: {
            type: 'function',
            function: { name: 'decidir_turno' },
          },
        }),
        DECISION_TIMEOUT_MS,
      );
      const call = completion.choices[0]?.message?.tool_calls?.[0];
      if (!call || call.type !== 'function') return 'unavailable';
      const parsed = JSON.parse(call.function.arguments || '{}') as unknown;
      const action =
        parsed && typeof parsed === 'object'
          ? String((parsed as { action?: string }).action || '')
          : '';
      this.logger.log(`[assistant:conductor] decision action=${action || '-'}`);
      return parsed;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'error';
      this.logger.warn(`[assistant:conductor] decision skipped: ${message}`);
      return 'unavailable';
    }
  }

  async completePhrase(
    messages: ConductorChatMessage[],
  ): Promise<string | 'unavailable'> {
    if (!this.openai) return 'unavailable';
    try {
      const completion = await withTimeout(
        this.openai.chat.completions.create({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 700,
          messages,
        }),
        PHRASE_TIMEOUT_MS,
      );
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) return 'unavailable';
      return text;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'error';
      this.logger.warn(`[assistant:conductor] phrase skipped: ${message}`);
      return 'unavailable';
    }
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OpenAI timeout')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
