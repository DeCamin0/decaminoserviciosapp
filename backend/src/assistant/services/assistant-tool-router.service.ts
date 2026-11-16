import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ASSISTANT_ROUTER_TOOLS,
  parseRouterToolArguments,
  type AssistantRouterChoice,
} from './assistant-tool-router';

const ROUTER_TIMEOUT_MS = 12_000;

@Injectable()
export class AssistantToolRouterService {
  private readonly logger = new Logger(AssistantToolRouterService.name);
  private readonly openai: OpenAI | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('OPENAI_API_KEY') ||
      process.env.OPENAI_API_KEY ||
      '';
    this.openai = apiKey
      ? new OpenAI({ apiKey, timeout: ROUTER_TIMEOUT_MS })
      : null;
  }

  /**
   * Alege o unealtă existentă când lista de cuvinte nu a recunoscut întrebarea.
   * null = rămâne fluxul vechi, fără date inventate.
   */
  async route(mensaje: string): Promise<AssistantRouterChoice | null> {
    const text = String(mensaje || '').trim();
    if (!text || !this.openai) return null;
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Eres el enrutador del asistente de una app de empleados. ' +
              'Elige una sola herramienta ya existente. No inventes datos ni escribas SQL. ' +
              'Si la pregunta no encaja en ninguna herramienta, tool="ninguna". ' +
              'Fechas en YYYY-MM-DD, meses en YYYY-MM. ' +
              'No pidas ni devuelvas contraseñas, IBAN, DNI, salario ni números de cuenta.',
          },
          { role: 'user', content: text.slice(0, 1500) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'elegir_herramienta',
              description:
                'Elige la consulta de solo lectura que responde la pregunta.',
              parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  tool: {
                    type: 'string',
                    enum: [...ASSISTANT_ROUTER_TOOLS],
                    description:
                      'fichajes=marcajes; cuadrante=horario del día o mes; pedidos=material; vacaciones=saldo o solicitudes de vacaciones; solicitudes=otras solicitudes y ausencias; nominas=metadatos de nómina; diplomas=certificados; documentos=documentos de inspección; documentos_solicitados=documentos pedidos al empleado; comunicados=avisos; procedimientos=cómo se hace algo en la app; incidencias=incidencias; empleados=listado o filtros operativos; ninguna=no hay herramienta.',
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
                },
                required: ['tool'],
              },
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'elegir_herramienta' },
        },
      });
      const call = completion.choices[0]?.message?.tool_calls?.[0];
      if (!call || call.type !== 'function') return null;
      const parsed = JSON.parse(call.function.arguments || '{}');
      const choice = parseRouterToolArguments(parsed);
      this.logger.log(
        `[Assistant] tool router -> ${choice ? choice.intent : 'ninguna'}`,
      );
      return choice;
    } catch (error: any) {
      this.logger.warn(
        `[Assistant] tool router skipped: ${error?.message || 'error'}`,
      );
      return null;
    }
  }
}
