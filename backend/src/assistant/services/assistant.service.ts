import { Injectable, Logger } from '@nestjs/common';
import {
  IntentClassifierService,
  IntentType,
  type IntentResult,
} from './intent-classifier.service';
import { AssistantReadToolsService } from './assistant-read-tools.service';
import { ResponseGeneratorService } from './response-generator.service';
import { EscalationService } from './escalation.service';
import { AuditService } from './audit.service';
import { AiResponseService } from './ai-response.service';
import { ConversationContextService } from './conversation-context.service';
import { AssistantUserPreferencesService } from './assistant-user-preferences.service';
import { AssistantValidatedFaqService } from './assistant-validated-faq.service';
import { AssistantResponseDto, MessageDto } from '../dto/message.dto';
import {
  buildAssistantResponse,
  defaultFollowUpsForIntent,
  sourcesForSuccessfulDataIntent,
} from '../utils/assistant-response.contract';
import { resolveAssistantResponseSource } from '../utils/assistant-response-source.util';
import { resolveAssistantResponseLanguage } from '../utils/assistant-message-language.util';
import type {
  AssistantAiLanguageContext,
  AssistantLocale,
} from '../types/assistant-preferences.types';
import {
  countAssistantDataRows,
  isAssistantTabularExportIntent,
  resolveAssistantTools,
} from '../utils/assistant-intent-tools.util';
import { deepCloneForAssistantExport } from '../utils/assistant-export-payload.util';
import { ASSISTANT_TABULAR_PREVIEW_ROWS } from '../constants/assistant-session.constants';
import type { KbQueryMeta } from '../types/kb-query.types';
import {
  extractNaturalPeriodEntityPatch,
  messageImpliesWholeMonthSchedule,
} from '../utils/month-and-relative-dates.util';
import {
  assistantFatalErrorUi,
  fichajesClarificationUi,
  noDataQueryUi,
  procedimientosSinArticulosUi,
  unsupportedIntentUi,
} from '../utils/assistant-response-localized.util';
import {
  computeBusinessLexiconSignals,
  messageAsksOwnContractSummary,
} from '../utils/assistant-business-signals.util';
import { looksLikeAppHelpDatosPersonales } from '../utils/assistant-app-help.util';
import {
  buildRecoveryCandidatesForDesconocido,
  pickPostQueryRecoveryIntent,
  shouldAttemptPostQueryRecovery,
} from '../utils/assistant-recovery.util';
import { evaluateAssistantOutcome } from '../utils/assistant-outcome-eval.util';
import { RbacService } from './rbac.service';
import { AssistantOperationalAlertService } from './assistant-operational-alert.service';
import { AssistantDataScope } from '../constants/assistant-data-scope.const';
import { resolveRequestedAssistantDataScope } from '../utils/assistant-requested-scope.util';
import { resolvePedidosProceduralStaticReply } from '../utils/assistant-pedidos-procedural.util';
import {
  getVagueAppHelpClarificationReply,
  messageIsVeryVagueAppHelp,
} from '../utils/assistant-vague-message.util';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  /** true / 1 → líneas [assistant:pipeline] con intent, entidades enmascaradas, tool, resultado SQL. Sin texto del usuario. */
  private isAssistantPipelineDebug(): boolean {
    const v = String(process.env.ASSISTANT_PIPELINE_DEBUG ?? '')
      .trim()
      .toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }

  /** Log operativo: nunca nombre/código literal; solo indicadores. */
  private snapshotEntitiesForLog(
    entidades: IntentResult['entidades'] | null | undefined,
  ): Record<string, unknown> {
    if (!entidades || typeof entidades !== 'object') {
      return {};
    }
    const sensitive = new Set(['nombre', 'codigo']);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(
      entidades as Record<string, unknown>,
    )) {
      if (sensitive.has(k)) {
        out[k] = val != null && String(val).trim() !== '' ? '[set]' : null;
        continue;
      }
      if (val == null) {
        out[k] = val;
      } else if (typeof val === 'string') {
        out[k] = val.length > 120 ? `${val.slice(0, 120)}…` : val;
      } else {
        out[k] = val;
      }
    }
    return out;
  }

  private logAssistantPipeline(
    stage: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.isAssistantPipelineDebug()) {
      return;
    }
    this.logger.log(`[assistant:pipeline] ${stage} ${JSON.stringify(payload)}`);
  }

  /** Una línea por petición: metadatos para soporte / monitoring (sin texto conversacional). */
  private emitAssistantOpsLog(p: {
    outcome: string;
    userId: string;
    intent?: string;
    status?: string;
    responseType?: string;
    ms: number;
    tools: string[];
    resultCount: number;
    escalated: boolean;
    ticketId?: string;
    queryError?: boolean;
  }): void {
    this.logger.log(
      `[assistant] ${p.outcome} user=${p.userId} intent=${p.intent ?? '-'} status=${p.status ?? '-'} rtype=${p.responseType ?? '-'} ms=${p.ms} n=${p.resultCount} tools=${p.tools.join('|')} esc=${p.escalated}${p.ticketId ? ` ticket=${p.ticketId}` : ''}${p.queryError ? ' qerr=1' : ''}`,
    );
  }

  /** Contrato premium: meta KB sin datos sensibles (solo procedimientos). */
  private withKbMetaIfNeeded(
    dto: AssistantResponseDto,
    intent: IntentType,
    kb: KbQueryMeta | undefined,
  ): AssistantResponseDto {
    if (intent !== IntentType.PROCEDIMIENTOS || !kb) {
      return dto;
    }
    return {
      ...dto,
      knowledgeBaseMeta: {
        articleCount: kb.articleCount,
        searchActive: kb.searchActive,
      },
    };
  }

  /** True dacă nu există nimic util de trimis către LLM (null, [], {}). */
  private isAssistantDataEmpty(data: unknown): boolean {
    if (data === null || data === undefined) {
      return true;
    }
    if (Array.isArray(data)) {
      return data.length === 0;
    }
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const o = data as Record<string, unknown>;
      if (
        Array.isArray(o.solicitudes) &&
        Array.isArray(o.ausencias_calendario)
      ) {
        return (
          (o.solicitudes as unknown[]).length === 0 &&
          (o.ausencias_calendario as unknown[]).length === 0
        );
      }
      return Object.keys(o).length === 0;
    }
    return false;
  }

  constructor(
    private readonly intentClassifier: IntentClassifierService,
    private readonly readTools: AssistantReadToolsService,
    private readonly responseGenerator: ResponseGeneratorService,
    private readonly escalationService: EscalationService,
    private readonly auditService: AuditService,
    private readonly aiResponseService: AiResponseService,
    private readonly contextService: ConversationContextService,
    private readonly userPreferencesService: AssistantUserPreferencesService,
    private readonly rbacService: RbacService,
    private readonly operationalAlerts: AssistantOperationalAlertService,
    private readonly validatedFaq: AssistantValidatedFaqService,
  ) {}

  /**
   * Procesează un mesaj și returnează răspuns
   */
  async processMessage(messageDto: MessageDto): Promise<AssistantResponseDto> {
    const { mensaje, usuario } = messageDto;
    const startTime = Date.now();
    let intentForAudit: string | undefined;
    let uiLocale: AssistantLocale = 'es';

    this.logger.log(
      `📨 Procesando mensaje de ${usuario.nombre} (${usuario.id}, rol: ${usuario.rol})`,
    );

    try {
      const assistantPrefs =
        await this.userPreferencesService.resolveForAssistant(usuario.id);

      const { responseLocale, source: responseLanguageSource } =
        resolveAssistantResponseLanguage(mensaje, assistantPrefs);
      const aiLanguage: AssistantAiLanguageContext = { responseLocale };
      uiLocale = aiLanguage.responseLocale;
      this.logAssistantPipeline('response_language', {
        userId: usuario.id,
        detectedLanguage: responseLocale,
        source: responseLanguageSource,
      });

      const assistantDataScope = resolveRequestedAssistantDataScope(
        mensaje,
        usuario.rol,
      );
      this.logAssistantPipeline('requested_data_scope', {
        userId: usuario.id,
        requestedScope: assistantDataScope,
      });

      // 1. Clasifică intenția
      const intentResult = await this.intentClassifier.classifyIntent(mensaje);
      const ctxSnap = this.contextService.getContext(usuario.id);
      const resolved = this.intentClassifier.applyContextualFollowUp(
        mensaje,
        intentResult,
        ctxSnap
          ? {
              lastIntent: ctxSnap.lastIntent,
              lastEntities: ctxSnap.lastEntities,
            }
          : null,
      );
      let intent = resolved.intent;
      let confianza = resolved.confianza;
      let entidades = resolved.entidades;
      let queryErrorTicketSent = false;
      const signals = computeBusinessLexiconSignals(mensaje);
      let recoverySlotConsumed = false;
      let recoveryAttempted = false;
      let recoverySucceeded = false;
      let recoveryCandidateIntents: IntentType[] = [];
      let recoveryChosenIntent: IntentType | null = null;
      intentForAudit = intent;

      const recoveredFromDesconocido =
        intentResult.intent === IntentType.DESCONOCIDO &&
        resolved.intent !== IntentType.DESCONOCIDO;

      this.logAssistantPipeline('after_classify', {
        userId: usuario.id,
        intent,
        confianza: Number(confianza.toFixed(3)),
        entities: this.snapshotEntitiesForLog(entidades),
        ctxLastIntent: ctxSnap?.lastIntent ?? null,
        ctxHasEntities: Boolean(
          ctxSnap?.lastEntities && Object.keys(ctxSnap.lastEntities).length > 0,
        ),
        recoveredFromDesconocido,
      });

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
        this.logger.log(
          `📋 Entități completate: ${JSON.stringify(this.snapshotEntitiesForLog(entidades))}`,
        );
      }

      // CUADRANTE: „este mes” / completo_* trebuie să folosească cuadrante_mes, nu fecha lipită din „hoy”.
      if (
        intent === IntentType.CUADRANTE &&
        entidades &&
        (messageImpliesWholeMonthSchedule(mensaje) ||
          (entidades.mes != null &&
            String(entidades.mes).startsWith('completo_')))
      ) {
        delete entidades.fecha;
      }

      const intentClassified = intent;

      if (intent === IntentType.DESCONOCIDO) {
        recoveryCandidateIntents =
          buildRecoveryCandidatesForDesconocido(signals);
        if (recoveryCandidateIntents.length > 0) {
          recoveryChosenIntent = recoveryCandidateIntents[0];
          intent = recoveryChosenIntent;
          recoverySlotConsumed = true;
          recoveryAttempted = true;
          const fresh =
            this.intentClassifier.extractEntitiesFromMessage(mensaje);
          entidades = {
            ...(entidades ?? {}),
            ...(fresh ?? {}),
          } as IntentResult['entidades'];
          if (
            intent === IntentType.CUADRANTE &&
            entidades &&
            (messageImpliesWholeMonthSchedule(mensaje) ||
              (entidades.mes != null &&
                String(entidades.mes).startsWith('completo_')))
          ) {
            delete entidades.fecha;
          }
        }
      }

      // ETAPA 1: datos personales / app-help → PROCEDIMIENTOS (antes del fallback DESCONOCIDO sin tools)
      if (
        intent === IntentType.DESCONOCIDO &&
        looksLikeAppHelpDatosPersonales(mensaje)
      ) {
        intent = IntentType.PROCEDIMIENTOS;
        confianza = Math.max(confianza, 0.72);
        this.logAssistantPipeline('app_help_intent_override', {
          userId: usuario.id,
          from: IntentType.DESCONOCIDO,
          to: IntentType.PROCEDIMIENTOS,
        });
      }

      this.logAssistantPipeline('after_followup_merge', {
        userId: usuario.id,
        intent,
        intentClassified,
        isFollowUp,
        entities: this.snapshotEntitiesForLog(entidades),
        plannedTools: resolveAssistantTools(intent, entidades),
        recoveryAttempted,
        recoveryChosenIntent,
        recoveryCandidates: recoveryCandidateIntents,
        assistantDataScope,
      });

      // 3. Solo respuesta genérica sin tools si intent explícitamente desconocido.
      // (La confianza baja con intent conocido seguimos al pipeline de datos — read-only + RBAC.)
      if (intent === IntentType.DESCONOCIDO) {
        if (messageIsVeryVagueAppHelp(mensaje)) {
          const respuestaVag = getVagueAppHelpClarificationReply(
            aiLanguage.responseLocale,
          );
          const durationMsVag = Date.now() - startTime;
          await this.auditService.logInteraction({
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            usuario_rol: usuario.rol,
            mensaje,
            intent_detectado: intent,
            confianza,
            respuesta: respuestaVag,
            escalado: false,
            auditMetrics: {
              durationMs: durationMsVag,
              resultCount: 0,
              tools: [],
              responseStatus: 'success',
              responseType: 'clarification',
            },
          });
          this.emitAssistantOpsLog({
            outcome: 'success',
            userId: usuario.id,
            intent,
            status: 'success',
            responseType: 'clarification',
            ms: durationMsVag,
            tools: [],
            resultCount: 0,
            escalated: false,
          });
          return buildAssistantResponse({
            respuesta: respuestaVag,
            confianza: Math.max(confianza, 0.55),
            escalado: false,
            status: 'success',
            responseType: 'clarification',
            responseSource: resolveAssistantResponseSource({
              kind: 'llm_only',
            }),
            sources: [
              {
                type: 'generated_summary',
                label: 'Aclaración',
                detail: 'static:vague_app_help',
              },
            ],
          });
        }

        this.logger.log(
          `🤖 Using AI (sin datos) intent=${intent} confianza=${confianza.toFixed(2)}`,
        );
        this.logAssistantPipeline('fallback_no_tools', {
          userId: usuario.id,
          reason: 'intent_desconocido',
          confianza: Number(confianza.toFixed(3)),
          executedReadTool: null,
        });

        const aiResponse = await this.aiResponseService.generateNaturalResponse(
          mensaje,
          intent,
          null,
          confianza,
          usuario.rol,
          assistantPrefs,
          aiLanguage,
        );

        const durationMs = Date.now() - startTime;
        await this.auditService.logInteraction({
          usuario_id: usuario.id,
          usuario_nombre: usuario.nombre,
          usuario_rol: usuario.rol,
          mensaje,
          intent_detectado: intent,
          confianza,
          respuesta: aiResponse,
          escalado: false,
          auditMetrics: {
            durationMs,
            resultCount: 0,
            tools: [],
            responseStatus: 'unsupported',
            responseType: 'generated_summary',
          },
        });
        this.emitAssistantOpsLog({
          outcome: 'unsupported',
          userId: usuario.id,
          intent,
          status: 'unsupported',
          responseType: 'generated_summary',
          ms: durationMs,
          tools: [],
          resultCount: 0,
          escalated: false,
        });

        const evalDes = evaluateAssistantOutcome({
          mensaje,
          initialIntent: intentClassified,
          finalIntent: IntentType.DESCONOCIDO,
          entidades,
          executedTools: [],
          resultCount: 0,
          queryError: false,
          responseType: 'generated_summary',
          status: 'unsupported',
          skippedQuery: true,
          accessLevel: this.rbacService.getAccessLevel(usuario.rol),
          recoveryAttempted,
          recoverySucceeded: false,
          signals,
        });
        const alertDes =
          await this.operationalAlerts.maybeSendAssistantOpsAlert({
            mensaje,
            userId: usuario.id,
            evaluation: evalDes,
            initialIntent: intentClassified,
            finalIntent: IntentType.DESCONOCIDO,
            recoverySucceeded: false,
            queryErrorTicketSent: false,
            signals,
            tools: [],
            resultCount: 0,
            recoveryAttempted,
          });
        this.logAssistantPipeline('outcome_trace', {
          userId: usuario.id,
          initialIntent: intentClassified,
          finalIntent: IntentType.DESCONOCIDO,
          outcomeLevel: evalDes.level,
          failureKind: evalDes.failureKind,
          recoveryAttempted,
          telegramAlertSent: alertDes.sent,
          alertReason: alertDes.reason,
        });

        const unsup = unsupportedIntentUi(uiLocale);
        return buildAssistantResponse({
          respuesta: aiResponse,
          confianza: Math.max(confianza, 0.5),
          escalado: false,
          status: 'unsupported',
          responseType: 'generated_summary',
          responseSource: resolveAssistantResponseSource({ kind: 'llm_only' }),
          sources: [
            {
              type: 'generated_summary',
              label: unsup.sourceLabel,
              detail: unsup.sourceDetail,
            },
          ],
          limitations: unsup.limitations,
        });
      }

      // 4. Verifică dacă avem suficiente informații pentru query
      // Pentru FICHAJES, dacă nu avem fecha/mes specificat, cerem clarificare
      if (
        intent === IntentType.FICHAJES &&
        !entidades?.fecha &&
        !entidades?.mes &&
        !entidades?.year
      ) {
        // Verifică dacă mesajul conține "hoy", "hoy", "ahora" - atunci e OK
        const mensajeLower = mensaje.toLowerCase();
        const mensajeNorm = mensajeLower
          .normalize('NFD')
          .replace(/\p{M}/gu, '');
        const tieneReferenciaTemporal =
          mensajeLower.includes('hoy') ||
          mensajeLower.includes('ahora') ||
          mensajeLower.includes('este mes') ||
          mensajeLower.includes('este año') ||
          mensajeLower.includes('mes actual') ||
          mensajeLower.includes('todo el mes') ||
          mensajeLower.includes('tot mesul') ||
          mensajeLower.includes('luna asta') ||
          mensajeLower.includes('luna aceasta') ||
          mensajeLower.includes('anul asta') ||
          mensajeLower.includes('anu asta') ||
          mensajeLower.includes('anul acesta') ||
          /\beste\s+ano\b/.test(mensajeNorm) ||
          /\b(azi|astazi|ieri|maine|ayer|manana|mañana)\b/i.test(mensajeNorm) ||
          /\b(oggi|ieri|domani)\b/i.test(mensajeNorm);
        const periodoNatural = extractNaturalPeriodEntityPatch(mensaje);
        const tienePeriodoNatural = Boolean(
          periodoNatural.mes || periodoNatural.year,
        );

        if (!tieneReferenciaTemporal && !tienePeriodoNatural) {
          // Nu avem referință temporală clară - cerem clarificare
          const clarificationResponse =
            await this.aiResponseService.generateClarificationRequest(
              intent,
              mensaje,
              assistantPrefs,
              aiLanguage,
            );

          const durationMsCl = Date.now() - startTime;
          await this.auditService.logInteraction({
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            usuario_rol: usuario.rol,
            mensaje,
            intent_detectado: intent,
            confianza,
            respuesta: clarificationResponse,
            escalado: false,
            auditMetrics: {
              durationMs: durationMsCl,
              resultCount: 0,
              tools: [],
              responseStatus: 'success',
              responseType: 'clarification',
            },
          });
          this.emitAssistantOpsLog({
            outcome: 'clarification',
            userId: usuario.id,
            intent,
            status: 'success',
            responseType: 'clarification',
            ms: durationMsCl,
            tools: [],
            resultCount: 0,
            escalated: false,
          });

          const clarUi = fichajesClarificationUi(uiLocale);
          return buildAssistantResponse({
            respuesta: clarificationResponse,
            confianza,
            escalado: false,
            status: 'success',
            responseType: 'clarification',
            sources: [
              {
                type: 'generated_summary',
                label: clarUi.label,
                detail: clarUi.detail,
              },
            ],
            followUps: clarUi.followUps,
          });
        }
      }

      // 4b. INCIDENCIAS: flux dedicat — ticket + răspuns clar (fără query de date)
      if (intent === IntentType.INCIDENCIAS) {
        const ticketId = await this.escalationService.createTicket({
          usuario_id: usuario.id,
          usuario_nombre: usuario.nombre,
          usuario_rol: usuario.rol,
          mensaje_original: mensaje,
          intent_detectado: intent,
          contexto: JSON.stringify({
            confianza,
            entidades: entidades ?? null,
            canal: 'assistant_incidencias',
          }),
          prioridad: 'normal',
        });

        const respuesta =
          `✅ **Incidencia registrada**\n\n` +
          `**Referencia:** ${ticketId}\n\n` +
          `El equipo de administración revisará tu mensaje. ` +
          `Si añades más detalles más adelante, indica esta referencia.`;

        const durationMsInc = Date.now() - startTime;
        await this.auditService.logInteraction({
          usuario_id: usuario.id,
          usuario_nombre: usuario.nombre,
          usuario_rol: usuario.rol,
          mensaje,
          intent_detectado: intent,
          confianza,
          respuesta,
          escalado: true,
          ticket_id: ticketId,
          datos_consultados: 0,
          auditMetrics: {
            durationMs: durationMsInc,
            resultCount: 0,
            tools: ['escalation_ticket'],
            responseStatus: 'escalated',
            responseType: 'escalation',
          },
        });
        this.emitAssistantOpsLog({
          outcome: 'escalated',
          userId: usuario.id,
          intent,
          status: 'escalated',
          responseType: 'escalation',
          ms: durationMsInc,
          tools: ['escalation_ticket'],
          resultCount: 0,
          escalated: true,
          ticketId,
        });

        return buildAssistantResponse({
          respuesta,
          confianza: Math.min(Math.max(confianza, 0.78), 1),
          escalado: true,
          ticket_id: ticketId,
          status: 'escalated',
          responseType: 'escalation',
          sources: [
            {
              type: 'escalation_ticket',
              label: 'Incidencia registrada',
              detail: ticketId,
            },
          ],
        });
      }

      // 4c. FAQ validate (înainte de read tools / LLM): intent + hash + locale
      const faqMatch = await this.validatedFaq.findMatch(
        intent,
        mensaje,
        responseLocale,
      );
      if (faqMatch) {
        const durationMsFaq = Date.now() - startTime;
        await this.auditService.logInteraction({
          usuario_id: usuario.id,
          usuario_nombre: usuario.nombre,
          usuario_rol: usuario.rol,
          mensaje,
          intent_detectado: intent,
          confianza,
          respuesta: faqMatch.replyText,
          escalado: false,
          auditMetrics: {
            durationMs: durationMsFaq,
            resultCount: 0,
            tools: ['validated_faq'],
            responseStatus: 'success',
            responseType: 'fallback',
          },
        });
        this.emitAssistantOpsLog({
          outcome: 'success',
          userId: usuario.id,
          intent,
          status: 'success',
          responseType: 'fallback',
          ms: durationMsFaq,
          tools: ['validated_faq'],
          resultCount: 0,
          escalated: false,
        });
        this.contextService.saveContext(
          usuario.id,
          intent,
          entidades ?? null,
          mensaje,
          {},
        );
        return buildAssistantResponse({
          respuesta: faqMatch.replyText,
          confianza: Math.min(Math.max(confianza, 0.85), 1),
          escalado: false,
          status: 'success',
          responseType: 'fallback',
          responseSource: resolveAssistantResponseSource({
            kind: 'validated_faq',
          }),
          sources: [
            {
              type: 'generated_summary',
              label: 'FAQ validada',
              detail: `curada · id=${faqMatch.id}`,
            },
          ],
        });
      }

      // 4d. Pedidos / albarán: guía fija sin read_tools (evita listar pedidos como "cómo subir albarán")
      const pedidosProc = resolvePedidosProceduralStaticReply(
        mensaje,
        intent,
        aiLanguage.responseLocale,
      );
      if (pedidosProc) {
        const durationMsProc = Date.now() - startTime;
        await this.auditService.logInteraction({
          usuario_id: usuario.id,
          usuario_nombre: usuario.nombre,
          usuario_rol: usuario.rol,
          mensaje,
          intent_detectado: intent,
          confianza,
          respuesta: pedidosProc.reply,
          escalado: false,
          auditMetrics: {
            durationMs: durationMsProc,
            resultCount: 0,
            tools: ['static_procedural'],
            responseStatus: 'success',
            responseType: 'generated_summary',
          },
        });
        this.emitAssistantOpsLog({
          outcome: 'success',
          userId: usuario.id,
          intent,
          status: 'success',
          responseType: 'generated_summary',
          ms: durationMsProc,
          tools: ['static_procedural'],
          resultCount: 0,
          escalated: false,
        });
        this.contextService.saveContext(
          usuario.id,
          intent,
          entidades ?? null,
          mensaje,
          {},
        );
        return buildAssistantResponse({
          respuesta: pedidosProc.reply,
          confianza: Math.min(Math.max(confianza, 0.86), 1),
          escalado: false,
          status: 'success',
          responseType: 'generated_summary',
          responseSource: resolveAssistantResponseSource({
            kind: 'validated_faq',
          }),
          sources: [
            {
              type: 'generated_summary',
              label: 'Guía fija',
              detail: `procedural:${pedidosProc.kind}`,
            },
          ],
          followUps: defaultFollowUpsForIntent(intent, entidades),
        });
      }

      // 5. Query datele (cu RBAC) + un singur retry inteligent (post-query)
      let data: any = null;
      let queryError: string | null = null;
      let kbQueryMeta: KbQueryMeta | undefined;
      let executedReadTool: string | null = null;

      let readResult = await this.runAssistantReadToolsForIntent(
        mensaje,
        usuario,
        intent,
        entidades,
        assistantDataScope,
      );
      data = readResult.data;
      queryError = readResult.queryError;
      executedReadTool = readResult.executedReadTool;
      kbQueryMeta = readResult.kbQueryMeta;

      const firstPassEmpty = this.isAssistantDataEmpty(data);
      if (
        !recoverySlotConsumed &&
        !queryError &&
        shouldAttemptPostQueryRecovery({
          recoveryAlreadyUsed: recoverySlotConsumed,
          queryError: Boolean(queryError),
          currentIntent: intent,
          signals,
          mensaje,
          dataEmpty: firstPassEmpty,
          entidades,
        })
      ) {
        const alt = pickPostQueryRecoveryIntent(
          intent,
          signals,
          mensaje,
          firstPassEmpty,
          entidades,
        );
        if (alt) {
          recoverySlotConsumed = true;
          recoveryAttempted = true;
          recoveryChosenIntent = alt;
          intent = alt;
          const ex = this.intentClassifier.extractEntitiesFromMessage(mensaje);
          entidades = {
            ...(entidades ?? {}),
            ...(ex ?? {}),
          } as IntentResult['entidades'];
          if (
            intent === IntentType.CUADRANTE &&
            entidades &&
            (messageImpliesWholeMonthSchedule(mensaje) ||
              (entidades.mes != null &&
                String(entidades.mes).startsWith('completo_')))
          ) {
            delete entidades.fecha;
          }
          readResult = await this.runAssistantReadToolsForIntent(
            mensaje,
            usuario,
            intent,
            entidades,
            assistantDataScope,
          );
          data = readResult.data;
          queryError = readResult.queryError;
          executedReadTool = readResult.executedReadTool;
          kbQueryMeta = readResult.kbQueryMeta;
        }
      }

      recoverySucceeded =
        recoveryAttempted && !queryError && !this.isAssistantDataEmpty(data);

      const dataEmptyAfterRead = this.isAssistantDataEmpty(data);
      this.logAssistantPipeline('after_read_tools', {
        userId: usuario.id,
        intent,
        executedReadTool,
        queryThrew: Boolean(queryError),
        queryErrorSnippet: queryError ? String(queryError).slice(0, 160) : null,
        dataEmpty: dataEmptyAfterRead,
        rowCountApprox: Array.isArray(data)
          ? data.length
          : data != null && typeof data === 'object'
            ? 1
            : 0,
      });

      // 6. Fără date: escalăm doar la eroare tehnică de query (nu la „0 rânduri” normale)
      if (this.isAssistantDataEmpty(data)) {
        if (queryError) {
          const ticketId = await this.escalationService.createTicket({
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            usuario_rol: usuario.rol,
            mensaje_original: mensaje,
            intent_detectado: intent,
            contexto: JSON.stringify({
              confianza,
              entidades,
              queryError,
              motivo: 'assistant_query_error',
            }),
            prioridad: 'normal',
          });
          queryErrorTicketSent = true;

          const durationMsQerr = Date.now() - startTime;
          const toolsQerr = resolveAssistantTools(intent, entidades);
          await this.auditService.logInteraction({
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            usuario_rol: usuario.rol,
            mensaje,
            intent_detectado: intent,
            confianza,
            escalado: true,
            ticket_id: ticketId,
            error: queryError,
            auditMetrics: {
              durationMs: durationMsQerr,
              resultCount: 0,
              tools: toolsQerr,
              responseStatus: 'error',
              responseType: 'error',
              queryError: true,
            },
          });
          this.emitAssistantOpsLog({
            outcome: 'error',
            userId: usuario.id,
            intent,
            status: 'error',
            responseType: 'error',
            ms: durationMsQerr,
            tools: toolsQerr,
            resultCount: 0,
            escalated: true,
            ticketId,
            queryError: true,
          });

          return buildAssistantResponse({
            respuesta:
              'No se pudo completar la consulta por un error técnico. ' +
              'Se ha notificado a administración con una referencia de seguimiento.',
            confianza: Math.max(0, confianza * 0.4),
            escalado: true,
            ticket_id: ticketId,
            status: 'error',
            responseType: 'error',
            sources: [
              {
                type: 'escalation_ticket',
                label: 'Administración notificada',
                detail: ticketId,
              },
            ],
            limitations: [
              `Error en consulta interna: ${String(queryError).slice(0, 240)}`,
            ],
          });
        }
        // 0 rezultate fără eroare: continuăm — mesaj clar prin ResponseGenerator / IA (fără ticket)
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

      if (!this.isAssistantDataEmpty(data)) {
        // Avem date - folosim AI pentru a formula răspunsul natural
        this.logger.log(
          `🤖 Using AI to format response with data for ${intent} intent`,
        );

        const structuredResponse =
          await this.responseGenerator.generateResponse(
            intent,
            data,
            confianza,
            entidades,
          );

        let aiResponse: string;
        try {
          aiResponse = await this.aiResponseService.generateNaturalResponse(
            mensaje,
            intent,
            data,
            confianza,
            usuario.rol,
            assistantPrefs,
            aiLanguage,
          );
          this.logger.log(
            `✅ AI response received (${aiResponse.length} chars)`,
          );
        } catch (error: any) {
          this.logger.error(`❌ Error getting AI response: ${error.message}`);
          aiResponse = structuredResponse.respuesta;
        }

        // Acțiuni din template + payload util pentru client (ex. id-uri nóminas)
        let acciones = structuredResponse.acciones || [];
        acciones = acciones.map((a) => {
          if (
            a.tipo === 'descargar_nomina' &&
            intent === IntentType.NOMINAS &&
            Array.isArray(data) &&
            data.length > 0 &&
            !data.some(
              (row: Record<string, unknown>) =>
                row.row_kind === 'sin_nomina_mes',
            )
          ) {
            return {
              tipo: a.tipo,
              label: a.label,
              payload: {
                tipo: 'nominas',
                items: data.map((row: Record<string, unknown>) => ({
                  id: row.id,
                  nombre: String(row.nombre ?? row.NOMBRE ?? ''),
                  mes: row.Mes ?? row.mes,
                  ano: row.Ano ?? row.ano,
                })),
              },
            };
          }
          return a;
        });
        const exportRowCount = countAssistantDataRows(data);
        this.logger.log(
          `📊 Verificare acțiuni: rows=${exportRowCount}, acciones existente=${acciones.length}`,
        );
        const tabularExportEligible =
          isAssistantTabularExportIntent(intent) &&
          !this.isAssistantDataEmpty(data) &&
          (exportRowCount > 10 ||
            intent === IntentType.CUADRANTE ||
            intent === IntentType.PEDIDOS);
        const exportDataSnapshot = tabularExportEligible
          ? deepCloneForAssistantExport(data)
          : null;
        const downloadAcciones = tabularExportEligible
          ? [
              {
                tipo: 'descargar_excel',
                label: '📥 Descargar Excel',
                payload: {
                  intent: intent,
                  /** Dataset completo solo para export (no usar para prompt LLM). */
                  exportData: exportDataSnapshot,
                  datos: exportDataSnapshot,
                  totalRows: exportRowCount,
                  previewMax: ASSISTANT_TABULAR_PREVIEW_ROWS,
                  formato: 'excel',
                },
              },
              {
                tipo: 'descargar_txt',
                label: '📄 Descargar TXT',
                payload: {
                  intent: intent,
                  exportData: exportDataSnapshot,
                  datos: exportDataSnapshot,
                  totalRows: exportRowCount,
                  previewMax: ASSISTANT_TABULAR_PREVIEW_ROWS,
                  formato: 'txt',
                },
              },
              {
                tipo: 'descargar_pdf',
                label: '📑 Descargar PDF',
                payload: {
                  intent: intent,
                  exportData: exportDataSnapshot,
                  datos: exportDataSnapshot,
                  totalRows: exportRowCount,
                  previewMax: ASSISTANT_TABULAR_PREVIEW_ROWS,
                  formato: 'pdf',
                },
              },
            ]
          : [];
        if (tabularExportEligible) {
          this.logger.log(
            `✅ Acțiuni descărcare (${exportRowCount} rânduri, intent=${intent})`,
          );
          acciones =
            intent === IntentType.CUADRANTE || intent === IntentType.PEDIDOS
              ? [...downloadAcciones, ...acciones]
              : [...acciones, ...downloadAcciones];
        } else {
          this.logger.log(`⚠️ Fără export tabular: rows=${exportRowCount}`);
        }

        const { responseType, sources } = sourcesForSuccessfulDataIntent(
          intent,
          true,
        );
        response = buildAssistantResponse({
          respuesta: aiResponse,
          acciones,
          confianza: Math.min(confianza + 0.1, 1.0),
          escalado: false,
          status: 'success',
          responseType,
          responseSource: resolveAssistantResponseSource({
            kind: 'pipeline_with_data',
          }),
          sources,
          followUps: defaultFollowUpsForIntent(intent, entidades),
          tabularExportMeta: tabularExportEligible
            ? {
                totalRows: exportRowCount,
                previewMax: ASSISTANT_TABULAR_PREVIEW_ROWS,
              }
            : undefined,
        });

        this.logger.log(
          `📤 Response ready (${response.respuesta.length} chars)`,
        );
        this.logger.log(
          `📤 Response acciones: ${response.acciones?.length || 0} acțiuni`,
        );
      } else {
        const procKbSinArticulos =
          intent === IntentType.PROCEDIMIENTOS && !queryError;

        this.logger.log(
          procKbSinArticulos
            ? `📭 Procedimientos: KB sin artículos — guía general asistida`
            : `📭 Sin datos para intent ${intent} — respuesta informativa (sin ticket)`,
        );

        const structuredEmpty = await this.responseGenerator.generateResponse(
          intent,
          data,
          confianza,
          entidades,
        );

        let aiResponse: string;
        try {
          aiResponse = await this.aiResponseService.generateNaturalResponse(
            mensaje,
            intent,
            procKbSinArticulos ? [] : null,
            confianza,
            usuario.rol,
            assistantPrefs,
            aiLanguage,
          );
        } catch (e: any) {
          this.logger.warn(`⚠️ AI sin datos fallback: ${e?.message ?? e}`);
          aiResponse = structuredEmpty.respuesta;
        }

        if (procKbSinArticulos) {
          const kbUi = procedimientosSinArticulosUi(uiLocale);
          const { responseType, sources } = sourcesForSuccessfulDataIntent(
            intent,
            true,
          );
          response = buildAssistantResponse({
            respuesta: aiResponse,
            confianza: Math.max(confianza, 0.62),
            escalado: false,
            acciones: structuredEmpty.acciones,
            status: 'success',
            responseType,
            responseSource: resolveAssistantResponseSource({
              kind: 'pipeline_empty_kb',
            }),
            sources,
            limitations: kbUi.limitations,
            followUps: [
              kbUi.followUp,
              ...(defaultFollowUpsForIntent(intent, entidades) ?? []),
            ],
          });
        } else {
          const noDataUi = noDataQueryUi(uiLocale);
          response = buildAssistantResponse({
            respuesta: aiResponse,
            confianza: Math.max(confianza, 0.55),
            escalado: false,
            acciones: structuredEmpty.acciones,
            status: 'no_data',
            responseType: 'generated_summary',
            responseSource: resolveAssistantResponseSource({
              kind: 'pipeline_empty_no_data',
            }),
            sources: [
              {
                type: 'generated_summary',
                label: noDataUi.sourceLabel,
                detail: noDataUi.sourceDetail,
              },
            ],
            limitations: noDataUi.limitations,
            followUps: defaultFollowUpsForIntent(intent, entidades),
          });
        }
      }

      // 9. Evaluare outcome + alertă operațională (Telegram filtrat)
      const tools = resolveAssistantTools(intent, entidades);
      const resultCount = countAssistantDataRows(data);
      const evaluationMain = evaluateAssistantOutcome({
        mensaje,
        initialIntent: intentClassified,
        finalIntent: intent,
        entidades,
        executedTools: tools,
        resultCount,
        queryError: false,
        responseType: response.responseType,
        status: response.status,
        skippedQuery: false,
        accessLevel: this.rbacService.getAccessLevel(usuario.rol),
        recoveryAttempted,
        recoverySucceeded,
        signals,
      });
      const alertMain = await this.operationalAlerts.maybeSendAssistantOpsAlert(
        {
          mensaje,
          userId: usuario.id,
          evaluation: evaluationMain,
          initialIntent: intentClassified,
          finalIntent: intent,
          recoverySucceeded,
          queryErrorTicketSent,
          signals,
          tools,
          resultCount,
          recoveryAttempted,
        },
      );
      this.logAssistantPipeline('outcome_trace', {
        userId: usuario.id,
        initialIntent: intentClassified,
        finalIntent: intent,
        outcomeLevel: evaluationMain.level,
        failureKind: evaluationMain.failureKind,
        resultCount,
        recoveryAttempted,
        recoverySucceeded,
        recoveryChosenIntent,
        telegramAlertSent: alertMain.sent,
        alertReason: alertMain.reason,
      });

      // 10. Audit
      const durationMs = Date.now() - startTime;
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
        datos_consultados: resultCount,
        auditMetrics: {
          durationMs,
          resultCount,
          tools,
          responseStatus: response.status,
          responseType: response.responseType,
        },
      });
      this.emitAssistantOpsLog({
        outcome: response.status ?? 'success',
        userId: usuario.id,
        intent,
        status: response.status,
        responseType: response.responseType,
        ms: durationMs,
        tools,
        resultCount,
        escalated: response.escalado ?? false,
        ticketId: response.ticket_id,
      });

      return this.withKbMetaIfNeeded(response, intent, kbQueryMeta);
    } catch (error: any) {
      this.logger.error(
        `❌ Error procesando mensaje: ${error.message}`,
        error.stack,
      );

      const ticketId = await this.escalationService.createTicket({
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol: usuario.rol,
        mensaje_original: mensaje,
        contexto: `Error: ${error.message}`,
        prioridad: 'alta',
      });

      const durationMsCatch = Date.now() - startTime;
      const toolsCatch = intentForAudit
        ? resolveAssistantTools(intentForAudit as IntentType, undefined)
        : [];

      await this.auditService.logInteraction({
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol: usuario.rol,
        mensaje,
        intent_detectado: intentForAudit,
        error: error.message,
        escalado: true,
        ticket_id: ticketId,
        datos_consultados: 0,
        auditMetrics: {
          durationMs: durationMsCatch,
          resultCount: 0,
          tools: toolsCatch,
          responseStatus: 'error',
          responseType: 'error',
        },
      });
      this.emitAssistantOpsLog({
        outcome: 'error',
        userId: usuario.id,
        intent: intentForAudit,
        status: 'error',
        responseType: 'error',
        ms: durationMsCatch,
        tools: toolsCatch,
        resultCount: 0,
        escalated: true,
        ticketId,
      });

      const fatalUi = assistantFatalErrorUi(uiLocale);
      return buildAssistantResponse({
        respuesta: fatalUi.respuesta,
        confianza: 0.0,
        escalado: true,
        ticket_id: ticketId,
        status: 'error',
        responseType: 'error',
        sources: [
          {
            type: 'escalation_ticket',
            label: fatalUi.sourceLabel,
            detail: ticketId,
          },
        ],
        limitations: [
          error?.message
            ? String(error.message).slice(0, 240)
            : fatalUi.limitationFallback,
        ],
      });
    }
  }

  private async runAssistantReadToolsForIntent(
    mensaje: string,
    usuario: NonNullable<MessageDto['usuario']>,
    intent: IntentType,
    entidades: IntentResult['entidades'] | undefined,
    dataScope: AssistantDataScope,
  ): Promise<{
    data: any;
    queryError: string | null;
    executedReadTool: string | null;
    kbQueryMeta?: KbQueryMeta;
  }> {
    let data: any = null;
    let queryError: string | null = null;
    let kbQueryMeta: KbQueryMeta | undefined;
    let executedReadTool: string | null = null;

    try {
      switch (intent) {
        case IntentType.FICHAJES:
          this.logger.log(
            `🔍 [Assistant] FICHAJES intent detected. entidades.tipo: ${entidades?.tipo}`,
          );
          if (entidades?.tipo === 'fichajes_faltantes') {
            executedReadTool = 'fichajes_ausencias_plan';
            this.logger.log(
              `🔍 [Assistant] Querying fichajes faltantes for fecha: ${entidades?.fecha || 'today'}`,
            );
            data = await this.readTools.fichajesAusenciasPlan(
              usuario.id,
              usuario.rol,
              entidades?.fecha,
              dataScope,
            );
            this.logger.log(
              `✅ [Assistant] queryFichajesFaltantes returned ${data?.length || 0} results`,
            );
          } else {
            executedReadTool = 'fichajes_registro';
            data = await this.readTools.fichajesRegistro(
              usuario.id,
              usuario.rol,
              entidades,
              dataScope,
            );
          }
          break;

        case IntentType.CUADRANTE:
          if (entidades?.fecha) {
            executedReadTool = 'plan_trabajo_dia';
            this.logger.log(
              `[Assistant] CUADRANTE → plan_trabajo_dia fecha=${entidades.fecha} codigo=${entidades.codigo ?? '-'} nombre=${entidades.nombre ? String(entidades.nombre).slice(0, 48) : '-'}`,
            );
            data = await this.readTools.planTrabajoDia(
              usuario.id,
              usuario.rol,
              entidades.fecha,
              dataScope,
              entidades?.codigo || entidades?.nombre
                ? {
                    codigo: entidades.codigo,
                    nombre: entidades.nombre,
                  }
                : undefined,
            );
          } else {
            executedReadTool = 'cuadrante_mes';
            this.logger.log(
              `[Assistant] CUADRANTE → cuadrante_mes (sin fecha) mes=${entidades?.mes ?? '-'} codigo=${entidades?.codigo ?? '-'} nombre=${entidades?.nombre ? String(entidades.nombre).slice(0, 48) : '-'}`,
            );
            data = await this.readTools.cuadranteMes(
              usuario.id,
              usuario.rol,
              entidades,
              dataScope,
            );
          }
          break;

        case IntentType.PEDIDOS:
          executedReadTool = 'pedidos_resumen';
          data = await this.readTools.pedidosResumen(
            usuario.id,
            usuario.rol,
            entidades,
            dataScope,
          );
          break;

        case IntentType.VACACIONES:
          if (entidades?.mes || entidades?.year) {
            executedReadTool = 'vacaciones_solicitudes';
            data = await this.readTools.vacacionesSolicitudes(
              usuario.id,
              usuario.rol,
              entidades,
              dataScope,
            );
          } else if (entidades?.soloPendientes) {
            executedReadTool = 'vacaciones_solicitudes';
            data = await this.readTools.vacacionesSolicitudes(
              usuario.id,
              usuario.rol,
              { ...entidades, soloPendientes: true },
              dataScope,
            );
          } else {
            executedReadTool = 'vacaciones_saldo';
            data = await this.readTools.vacacionesSaldo(usuario.id);
          }
          break;

        case IntentType.SOLICITUDES: {
          executedReadTool = 'solicitudes_tabla+ausencias_calendario';
          const [solRows, ausRows] = await Promise.all([
            this.readTools.solicitudesTabla(
              usuario.id,
              usuario.rol,
              entidades,
              dataScope,
            ),
            this.readTools.ausenciasCalendario(
              usuario.id,
              usuario.rol,
              entidades,
              dataScope,
            ),
          ]);
          data = {
            solicitudes: solRows,
            ausencias_calendario: ausRows,
          };
          break;
        }

        case IntentType.COMUNICADOS:
          executedReadTool = 'comunicados_list';
          data = await this.readTools.comunicadosList(
            usuario.id,
            usuario.rol,
            dataScope,
          );
          break;

        case IntentType.DOCUMENTOS_SOLICITADOS:
          executedReadTool = 'documentos_solicitados_metadatos';
          data = await this.readTools.documentosSolicitadosMetadatos(
            usuario.id,
            usuario.rol,
            { soloPendientes: Boolean(entidades?.soloPendientes) },
            dataScope,
          );
          break;

        case IntentType.EMPLEADOS: {
          const mensajeLower = mensaje.toLowerCase();
          if (messageAsksOwnContractSummary(mensaje)) {
            executedReadTool = 'empleado_mis_datos_contrato';
            data = await this.readTools.empleadoMisDatosContrato(
              usuario.id,
              usuario.rol,
              dataScope,
            );
            break;
          }
          const tieneCuadranteHorario =
            mensajeLower.includes('cuadrante') ||
            mensajeLower.includes('horario');
          const tieneCentro =
            mensajeLower.includes('centro') ||
            mensajeLower.includes('centro de trabajo');

          if (tieneCuadranteHorario && tieneCentro && !entidades?.filtro) {
            executedReadTool = 'empleados_resumen_operativo:combined';
            this.logger.log(
              `🔍 Detectat mesaj cu multiple întrebări: cuadrante/horario + centro`,
            );

            const dataCuadranteHorario =
              await this.readTools.empleadosResumenOperativo(
                usuario.id,
                usuario.rol,
                'sin_cuadrante_o_horario',
                dataScope,
              );

            const dataCentro = await this.readTools.empleadosResumenOperativo(
              usuario.id,
              usuario.rol,
              'sin_centro',
              dataScope,
            );

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
            executedReadTool = 'empleados_resumen_operativo';
            data = await this.readTools.empleadosResumenOperativo(
              usuario.id,
              usuario.rol,
              entidades?.filtro,
              dataScope,
            );
          }
          break;
        }

        case IntentType.NOMINAS:
          executedReadTool = 'nominas_metadatos';
          data = await this.readTools.nominasMetadatos(
            usuario.id,
            usuario.rol,
            entidades,
            dataScope,
          );
          break;

        case IntentType.DIPLOMAS:
          executedReadTool = 'diplomas_metadatos';
          data = await this.readTools.diplomasMetadatos(
            usuario.id,
            usuario.rol,
            dataScope,
          );
          break;

        case IntentType.DOCUMENTOS:
          executedReadTool = 'documentos_inspeccion_metadatos';
          data = await this.readTools.documentosInspeccionMetadatos(
            usuario.id,
            usuario.rol,
            dataScope,
          );
          break;

        case IntentType.PROCEDIMIENTOS: {
          executedReadTool = 'knowledge_base_articulos';
          const kb = await this.readTools.knowledgeBaseArticulos(mensaje);
          data = kb.rows;
          kbQueryMeta = kb.meta;
          break;
        }

        default:
          executedReadTool = 'none';
          data = [];
      }
    } catch (error: any) {
      queryError = error.message;
      this.logger.error(
        `❌ Error en query para intent ${intent}: ${error.message}`,
      );
      data = null;
    }

    return { data, queryError, executedReadTool, kbQueryMeta };
  }
}
