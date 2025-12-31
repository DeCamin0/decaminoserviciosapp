import { Injectable, Logger } from '@nestjs/common';
import {
  IntentClassifierService,
  IntentType,
} from './intent-classifier.service';
import { DataQueryService } from './data-query.service';
import { ResponseGeneratorService } from './response-generator.service';
import { EscalationService } from './escalation.service';
import { AuditService } from './audit.service';
import { RbacService } from './rbac.service';
import { AiResponseService } from './ai-response.service';
import { ConversationContextService } from './conversation-context.service';
import { AssistantResponseDto, MessageDto } from '../dto/message.dto';
import { VacacionesService } from '../../services/vacaciones.service';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly intentClassifier: IntentClassifierService,
    private readonly dataQuery: DataQueryService,
    private readonly responseGenerator: ResponseGeneratorService,
    private readonly escalationService: EscalationService,
    private readonly auditService: AuditService,
    private readonly rbacService: RbacService,
    private readonly vacacionesService: VacacionesService,
    private readonly aiResponseService: AiResponseService,
    private readonly contextService: ConversationContextService,
  ) {}

  /**
   * Procesează un mesaj și returnează răspuns
   */
  async processMessage(messageDto: MessageDto): Promise<AssistantResponseDto> {
    const { mensaje, usuario } = messageDto;
    const startTime = Date.now();

    this.logger.log(
      `📨 Procesando mensaje de ${usuario.nombre} (${usuario.id}, rol: ${usuario.rol})`,
    );

    try {
      // 1. Clasifică intenția
      const intentResult = await this.intentClassifier.classifyIntent(mensaje);
      const { intent, confianza } = intentResult;
      let entidades = intentResult.entidades;

      // 2. Verifică dacă e o întrebare de follow-up și completează entitățile din context
      const isFollowUp = this.contextService.isFollowUpQuestion(
        usuario.id,
        intent,
        entidades,
      );
      if (isFollowUp) {
        this.logger.log(
          `🔗 Detectat follow-up pentru ${usuario.id}, completăm entitățile din context`,
        );
        entidades =
          this.contextService.enrichEntitiesWithContext(
            usuario.id,
            entidades,
            intent,
          ) || entidades;
        this.logger.log(`📋 Entități completate: ${JSON.stringify(entidades)}`);
      }

      // 3. Pentru DESCONOCIDO sau mesaje generale (hola, etc.), folosim AI direct
      // Nu escalăm imediat, ci încercăm să generăm un răspuns natural cu AI
      if (intent === IntentType.DESCONOCIDO || confianza < 0.3) {
        this.logger.log(
          `🤖 Using AI for ${intent} intent (confianza: ${confianza.toFixed(2)})`,
        );

        const aiResponse = await this.aiResponseService.generateNaturalResponse(
          mensaje,
          intent,
          null,
          confianza,
          usuario.rol,
        );

        // Audit
        await this.auditService.logInteraction({
          usuario_id: usuario.id,
          usuario_nombre: usuario.nombre,
          usuario_rol: usuario.rol,
          mensaje,
          intent_detectado: intent,
          confianza,
          respuesta: aiResponse,
          escalado: false, // Nu escalăm pentru mesaje generale
        });

        return {
          respuesta: aiResponse,
          confianza: Math.max(confianza, 0.5), // Mărim confianza pentru răspunsuri AI
          escalado: false,
        };
      }

      // 4. Verifică dacă avem suficiente informații pentru query
      // Pentru FICHAJES, dacă nu avem fecha/mes specificat, cerem clarificare
      if (
        intent === IntentType.FICHAJES &&
        !entidades?.fecha &&
        !entidades?.mes
      ) {
        // Verifică dacă mesajul conține "hoy", "hoy", "ahora" - atunci e OK
        const mensajeLower = mensaje.toLowerCase();
        const tieneReferenciaTemporal =
          mensajeLower.includes('hoy') ||
          mensajeLower.includes('ahora') ||
          mensajeLower.includes('este mes') ||
          mensajeLower.includes('mes actual') ||
          mensajeLower.includes('todo el mes') ||
          mensajeLower.includes('tot mesul');

        if (!tieneReferenciaTemporal) {
          // Nu avem referință temporală clară - cerem clarificare
          const clarificationResponse =
            await this.aiResponseService.generateClarificationRequest(
              intent,
              mensaje,
            );

          await this.auditService.logInteraction({
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            usuario_rol: usuario.rol,
            mensaje,
            intent_detectado: intent,
            confianza,
            respuesta: clarificationResponse,
            escalado: false,
          });

          return {
            respuesta: clarificationResponse,
            confianza: confianza,
            escalado: false,
          };
        }
      }

      // 5. Query datele (cu RBAC)
      let data: any = null;
      let queryError: string | null = null;

      try {
        switch (intent) {
          case IntentType.FICHAJES:
            // Verifică dacă e o întrebare despre fichajes faltantes
            this.logger.log(
              `🔍 [Assistant] FICHAJES intent detected. entidades.tipo: ${entidades?.tipo}`,
            );
            if (entidades?.tipo === 'fichajes_faltantes') {
              this.logger.log(
                `🔍 [Assistant] Querying fichajes faltantes for fecha: ${entidades?.fecha || 'today'}`,
              );
              data = await this.dataQuery.queryFichajesFaltantes(
                usuario.id,
                usuario.rol,
                entidades?.fecha,
              );
              this.logger.log(
                `✅ [Assistant] queryFichajesFaltantes returned ${data?.length || 0} results`,
              );
            } else {
              data = await this.dataQuery.queryFichajes(
                usuario.id,
                usuario.rol,
                entidades,
              );
            }
            break;

          case IntentType.CUADRANTE:
            data = await this.dataQuery.queryCuadrante(
              usuario.id,
              usuario.rol,
              entidades,
            );
            break;

          case IntentType.VACACIONES:
            // Verifică dacă se cere informație despre solicitudes într-o lună specifică
            if (entidades?.mes) {
              // Query pentru solicitudes de vacații în luna specificată
              data = await this.dataQuery.queryVacaciones(
                usuario.id,
                usuario.rol,
                entidades,
              );
            } else {
              // Dacă nu e specificată o lună, returnează saldo-ul de vacații
              const vacacionesData = await this.vacacionesService.calcularSaldo(
                usuario.id,
              );
              data = {
                dias_anuales: vacacionesData.vacaciones.dias_anuales,
                dias_generados_hasta_hoy:
                  vacacionesData.vacaciones.dias_generados_hasta_hoy,
                dias_consumidos_aprobados:
                  vacacionesData.vacaciones.dias_consumidos_aprobados,
                dias_restantes: vacacionesData.vacaciones.dias_restantes,
              };
            }
            break;

          case IntentType.EMPLEADOS:
            // Dacă mesajul conține multiple întrebări (cuadrante/horario ȘI centro),
            // executăm query-uri separate și combinăm rezultatele
            const mensajeLower = mensaje.toLowerCase();
            const tieneCuadranteHorario =
              mensajeLower.includes('cuadrante') ||
              mensajeLower.includes('horario');
            const tieneCentro =
              mensajeLower.includes('centro') ||
              mensajeLower.includes('centro de trabajo');

            if (tieneCuadranteHorario && tieneCentro && !entidades?.filtro) {
              // Mesaj cu două întrebări: executăm query-uri separate
              this.logger.log(
                `🔍 Detectat mesaj cu multiple întrebări: cuadrante/horario + centro`,
              );

              const dataCuadranteHorario =
                await this.dataQuery.queryListadoEmpleados(
                  usuario.id,
                  usuario.rol,
                  'sin_cuadrante_o_horario',
                );

              const dataCentro = await this.dataQuery.queryListadoEmpleados(
                usuario.id,
                usuario.rol,
                'sin_centro',
              );

              // Combinăm rezultatele (eliminăm duplicatele după CODIGO)
              const combinedData = [...dataCuadranteHorario];
              const codigosExistentes = new Set(
                dataCuadranteHorario.map((e: any) => e.CODIGO),
              );

              for (const emp of dataCentro) {
                if (!codigosExistentes.has(emp.CODIGO)) {
                  combinedData.push(emp);
                }
              }

              data = combinedData;
              this.logger.log(
                `✅ Combinat ${dataCuadranteHorario.length} empleados sin cuadrante/horario + ${dataCentro.length} sin centro = ${data.length} total`,
              );
            } else {
              // Query normal cu filtru
              data = await this.dataQuery.queryListadoEmpleados(
                usuario.id,
                usuario.rol,
                entidades?.filtro,
              );
            }
            break;

          case IntentType.NOMINAS:
            data = await this.dataQuery.queryNominas(
              usuario.id,
              usuario.rol,
              entidades,
            );
            break;

          case IntentType.DOCUMENTOS:
            data = await this.dataQuery.queryDocumentos(
              usuario.id,
              usuario.rol,
            );
            break;

          case IntentType.PROCEDIMIENTOS:
            data = await this.dataQuery.queryKbArticles(undefined, mensaje);
            break;

          default:
            data = [];
        }
      } catch (error: any) {
        queryError = error.message;
        this.logger.error(
          `❌ Error en query para intent ${intent}: ${error.message}`,
        );
        data = null;
      }

      // 6. Verifică dacă nu există date
      // Pentru intent-uri cunoscute cu confianza >= 0.6, nu escalăm imediat dacă nu găsim date
      // Doar returnăm un mesaj informativ
      if (!data || (Array.isArray(data) && data.length === 0)) {
        // Pentru intent-uri cu confianza mică sau erori de query, escalăm
        if (confianza < 0.5 || queryError) {
          const ticketId = await this.escalationService.createTicket({
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            usuario_rol: usuario.rol,
            mensaje_original: mensaje,
            intent_detectado: intent,
            contexto: JSON.stringify({ confianza, entidades, queryError }),
            prioridad: 'normal',
          });

          await this.auditService.logInteraction({
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            usuario_rol: usuario.rol,
            mensaje,
            intent_detectado: intent,
            confianza,
            escalado: true,
            ticket_id: ticketId,
            error: queryError || 'No se encontraron datos',
          });

          return {
            respuesta:
              'No encuentro datos para esa consulta. He creado una incidencia para administración.',
            confianza: confianza * 0.5, // Reducem confianza
            escalado: true,
            ticket_id: ticketId,
          };
        }

        // Pentru intent-uri cunoscute cu confianza >= 0.5, returnăm mesaj informativ fără escalare
        // ResponseGenerator va gestiona mesajul pentru date goale
      }

      // 7. Salvează contextul conversației pentru follow-up questions
      this.contextService.saveContext(
        usuario.id,
        intent,
        entidades,
        mensaje,
        data,
      );

      // 8. Generează răspuns
      // Pentru intent-uri cunoscute cu date, folosim AI pentru a formula răspunsul natural
      let response: AssistantResponseDto;

      if (
        data &&
        ((Array.isArray(data) && data.length > 0) ||
          (typeof data === 'object' && Object.keys(data).length > 0))
      ) {
        // Avem date - folosim AI pentru a formula răspunsul natural
        this.logger.log(
          `🤖 Using AI to format response with data for ${intent} intent`,
        );

        let aiResponse: string;
        try {
          aiResponse = await this.aiResponseService.generateNaturalResponse(
            mensaje,
            intent,
            data,
            confianza,
            usuario.rol,
          );
          this.logger.log(
            `✅ AI response received: ${aiResponse.substring(0, 100)}...`,
          );
        } catch (error: any) {
          this.logger.error(`❌ Error getting AI response: ${error.message}`);
          // Fallback la răspuns structurat dacă AI eșuează
          aiResponse = 'Procesando tu consulta...';
        }

        // Generăm și răspunsul structurat pentru acțiuni (dacă e necesar)
        const structuredResponse =
          await this.responseGenerator.generateResponse(
            intent,
            Array.isArray(data) ? data : [data],
            confianza,
            entidades,
          );

        // Adaugă acțiuni de descărcare dacă sunt multe date (>10 înregistrări)
        const acciones = structuredResponse.acciones || [];
        this.logger.log(
          `📊 Verificare acțiuni: data.length=${Array.isArray(data) ? data.length : 'N/A'}, acciones existente=${acciones.length}`,
        );
        if (Array.isArray(data) && data.length > 10) {
          this.logger.log(
            `✅ Adăugare acțiuni de descărcare pentru ${data.length} înregistrări`,
          );
          // Adaugă acțiuni de descărcare pentru date mari
          acciones.push(
            {
              tipo: 'descargar_excel',
              label: '📥 Descargar Excel',
              payload: {
                intent: intent,
                datos: data,
                formato: 'excel',
              },
            },
            {
              tipo: 'descargar_txt',
              label: '📄 Descargar TXT',
              payload: {
                intent: intent,
                datos: data,
                formato: 'txt',
              },
            },
            {
              tipo: 'descargar_pdf',
              label: '📑 Descargar PDF',
              payload: {
                intent: intent,
                datos: data,
                formato: 'pdf',
              },
            },
          );
          this.logger.log(`✅ Acțiuni adăugate: ${acciones.length} total`);
        } else {
          this.logger.log(
            `⚠️ Nu se adaugă acțiuni: data nu e array sau length <= 10`,
          );
        }

        response = {
          respuesta: aiResponse, // Folosim răspunsul AI
          acciones: acciones, // Acțiuni din răspunsul structurat + descărcări
          confianza: Math.min(confianza + 0.1, 1.0), // Mărim confianza pentru răspunsuri AI
          escalado: false,
        };

        this.logger.log(
          `📤 Response ready: ${response.respuesta.substring(0, 100)}...`,
        );
        this.logger.log(
          `📤 Response acciones: ${response.acciones?.length || 0} acțiuni`,
        );
      } else {
        // Fără date - folosim AI pentru a răspunde natural
        this.logger.log(
          `🤖 Using AI to generate response without data for ${intent} intent`,
        );

        const aiResponse = await this.aiResponseService.generateNaturalResponse(
          mensaje,
          intent,
          null,
          confianza,
          usuario.rol,
        );

        response = {
          respuesta: aiResponse,
          confianza: Math.max(confianza, 0.6),
          escalado: false,
        };
      }

      // 9. Audit
      await this.auditService.logInteraction({
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol: usuario.rol,
        mensaje,
        intent_detectado: intent,
        confianza,
        respuesta: response.respuesta,
        escalado: response.escalado || false,
        ticket_id: response.ticket_id,
        datos_consultados: Array.isArray(data) ? data.length : 1,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Mensaje procesado en ${duration}ms - Intent: ${intent}, Confianza: ${confianza.toFixed(2)}`,
      );

      return response;
    } catch (error: any) {
      this.logger.error(
        `❌ Error procesando mensaje: ${error.message}`,
        error.stack,
      );

      // Audit error
      await this.auditService.logInteraction({
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol: usuario.rol,
        mensaje,
        error: error.message,
      });

      // Escalare pentru erori critice
      const ticketId = await this.escalationService.createTicket({
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol: usuario.rol,
        mensaje_original: mensaje,
        contexto: `Error: ${error.message}`,
        prioridad: 'alta',
      });

      return {
        respuesta:
          'Ha ocurrido un error procesando tu consulta. Se ha creado una incidencia de alta prioridad.',
        confianza: 0.0,
        escalado: true,
        ticket_id: ticketId,
      };
    }
  }
}
