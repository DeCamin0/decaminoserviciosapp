import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IntentType, type IntentResult } from './intent-classifier.service';
import { looksLikeAppHelpDatosPersonales } from '../utils/assistant-app-help.util';
import { procedimientosAppHelpDatosPersonalesSupplement } from '../utils/assistant-procedimientos-app-help-prompt.util';
import {
  DEFAULT_ASSISTANT_PREFERENCES,
  type AssistantAiLanguageContext,
  type AssistantLocale,
  type ResolvedAssistantPreferences,
} from '../types/assistant-preferences.types';

@Injectable()
export class AiResponseService {
  private readonly logger = new Logger(AiResponseService.name);
  private openai: OpenAI | null = null;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    // Încearcă să citească din ConfigService, apoi din process.env ca fallback
    let apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      // Fallback la process.env direct
      apiKey = process.env.OPENAI_API_KEY || null;
      this.logger.log('🔍 Trying process.env.OPENAI_API_KEY as fallback');
    }

    this.isEnabled = !!apiKey;

    this.logger.log(
      `🔍 OpenAI initialization check - API key present: ${!!apiKey}, length: ${apiKey?.length || 0}`,
    );
    if (apiKey) {
      this.logger.log(`🔍 API key preview: ${apiKey.substring(0, 15)}...`);
    }

    if (this.isEnabled) {
      try {
        this.openai = new OpenAI({
          apiKey: apiKey,
          timeout: 30000, // 30 secunde timeout pentru răspunsuri cu date mari
        });
        this.logger.log(
          `✅ OpenAI service initialized (API key: ${apiKey.substring(0, 10)}...)`,
        );
      } catch (error: any) {
        this.logger.error(`❌ Error initializing OpenAI: ${error.message}`);
        this.isEnabled = false;
      }
    } else {
      this.logger.warn(
        '⚠️ OPENAI_API_KEY not found in environment, AI responses will be disabled',
      );
      this.logger.warn(
        '⚠️ Make sure OPENAI_API_KEY is set in .env file and backend is restarted',
      );
      this.logger.warn(
        `⚠️ process.env.OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'exists' : 'not found'}`,
      );
    }
  }

  /**
   * Preguntas del tipo «cómo borrar / eliminar justificante (cita médica, etc.)»:
   * la app puede no ofrecer borrado al empleado; el LLM inventaba menús. Respuesta fija.
   */
  private isDeleteJustificanteQuestion(mensaje: string): boolean {
    const n = mensaje.toLowerCase();
    const aboutJust =
      /\bjustificantes?\b/.test(n) ||
      /\b(cita|consulta)\s*m[eé]dica/.test(n) ||
      /\bjustificativo\b/.test(n);
    if (!aboutJust) return false;
    return (
      /\b(borrar|eliminar|quitar|suprimir|delete|remove|șterge|sterge)\b/.test(
        n,
      ) ||
      /\b(borrarlo|eliminarlo|quitarlo)\b/.test(n) ||
      /\b(cómo|como)\s+.{0,55}puedo\s+.{0,35}(borrar|eliminar|quitar)\b/.test(
        n,
      ) ||
      /\b(borrar|eliminar)\s+.{0,45}(justificante|cita)\b/.test(n)
    );
  }

  private templateDeleteJustificanteResponse(
    outputLocale: AssistantLocale,
  ): string {
    switch (outputLocale) {
      case 'ro':
        return (
          `În aplicație **nu este garantat** că există o opțiune pentru angajat de a **șterge** un justificativ deja trimis (ex. consultație medicală). ` +
          `Dacă **nu vezi** buton sau acțiune de eliminare la cerere sau la document, asta poate fi normal: **nu inventăm** pași de meniu aici.\n\n` +
          `Pentru **anulare, corecție sau înlocuire** a justificativului, contactează **supervizarea** sau **resurse umane (RRHH)**. ` +
          `Dacă nu știi cui să scrii, întreabă **supervizorul** sau **administrația** companiei.`
        );
      case 'en':
        return (
          `The app **does not guarantee** that you can **delete** a justification you already submitted (e.g. medical appointment). ` +
          `If you **see no delete option** in requests or documents, that may be expected — we do **not** invent menu steps here.\n\n` +
          `To **cancel, correct or replace** it, contact **supervision** or **HR**. If unsure who to ask, speak to your **supervisor** or **company administration**.`
        );
      default:
        return (
          `En la aplicación **no está garantizado** que el empleado tenga una opción para **eliminar** un justificante ya enviado (por ejemplo, cita médica). ` +
          `Si **no ves** botón ni acción de borrado en **solicitudes** o en el detalle, puede ser normal: **no inventamos** pasos de menú desde el chat.\n\n` +
          `Para **anular, corregir o sustituir** el justificante, contacta a **supervisión** o a **recursos humanos (RRHH)**. ` +
          `Si no sabes a quién dirigirte, pregunta a tu **supervisor** o a **administración** de la empresa.`
        );
    }
  }

  /**
   * Generează un răspuns natural folosind OpenAI bazat pe:
   * - Intent-ul detectat
   * - Datele din query (dacă există)
   * - Mesajul original
   */
  async generateNaturalResponse(
    mensaje: string,
    intent: IntentType,
    data: any[] | any | null,
    confianza: number,
    usuarioRol: string | null,
    prefs: ResolvedAssistantPreferences = DEFAULT_ASSISTANT_PREFERENCES,
    language?: AssistantAiLanguageContext,
    entidades?: IntentResult['entidades'],
  ): Promise<string> {
    const outputLocale = this.outputLocaleFor(prefs, language);
    if (this.isDeleteJustificanteQuestion(mensaje)) {
      this.logger.log(
        'AiResponse: borrar/eliminar justificante → plantilla fija (sin LLM)',
      );
      return this.templateDeleteJustificanteResponse(outputLocale);
    }

    if (!this.isEnabled || !this.openai) {
      this.logger.warn(
        `⚠️ OpenAI not enabled or not initialized. isEnabled: ${this.isEnabled}, openai: ${!!this.openai}`,
      );
      return this.generateFallbackResponse(
        intent,
        data,
        this.outputLocaleFor(prefs, language),
      );
    }

    try {
      // Construiește context-ul pentru AI
      this.logger.log(`🤖 Generating AI response for intent: ${intent}`);
      const systemPrompt = this.buildSystemPrompt(
        intent,
        usuarioRol,
        prefs,
        outputLocale,
      );
      const userPrompt = this.buildUserPrompt(
        mensaje,
        intent,
        data,
        confianza,
        outputLocale,
        entidades,
      );
      const maxTokens = this.getMaxTokensForResponse(prefs, 'main');

      this.logger.debug(
        `📝 System prompt length: ${systemPrompt.length}, User prompt length: ${userPrompt.length}`,
      );

      // Adaugă timeout pentru apelul OpenAI (10 secunde)
      const completionPromise = this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Model mai economic
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      });

      // Timeout de 30 secunde pentru răspunsuri cu date mari
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('OpenAI API timeout after 30 seconds')),
          30000,
        );
      });

      const completion = await Promise.race([
        completionPromise,
        timeoutPromise,
      ]);

      const response = completion.choices[0]?.message?.content?.trim();
      if (response) {
        this.logger.log(
          `✅ AI response generated successfully (${response.length} chars)`,
        );
        return response;
      }

      this.logger.warn('⚠️ AI response is empty, using fallback');
      return this.generateFallbackResponse(intent, data, outputLocale);
    } catch (error: any) {
      this.logger.error(
        `❌ Error generating AI response: ${error.message}`,
        error.stack,
      );
      return this.generateFallbackResponse(
        intent,
        data,
        this.outputLocaleFor(prefs, language),
      );
    }
  }

  /**
   * Generează un mesaj care cere clarificare când nu avem suficiente informații
   */
  async generateClarificationRequest(
    intent: IntentType,
    mensaje: string,
    prefs: ResolvedAssistantPreferences = DEFAULT_ASSISTANT_PREFERENCES,
    language?: AssistantAiLanguageContext,
  ): Promise<string> {
    const outputLocale = this.outputLocaleFor(prefs, language);

    if (!this.isEnabled || !this.openai) {
      return this.generateFallbackClarification(intent, outputLocale);
    }

    try {
      const systemPrompt =
        this.buildClarificationSystemPrompt(outputLocale) +
        this.buildPreferenceSuffix(prefs);

      const clarificationPrompts: Record<IntentType, string> = {
        [IntentType.FICHAJES]: `El usuario pregunta sobre fichajes pero no ha especificado una fecha o período. Necesitas pedirle que especifique:
- ¿De qué fecha necesita los registros? (ej: "hoy", "ayer", "15/12/2025")
- ¿De qué período? (ej: "este mes", "diciembre", "la semana pasada")
- ¿De qué empleado específico? (si aplica)

Ofrece ejemplos claros de cómo puede reformular su pregunta.`,
        [IntentType.CUADRANTE]: `El usuario pregunta sobre cuadrantes pero no ha especificado un período. Necesitas pedirle que especifique el mes o período que necesita.`,
        [IntentType.PEDIDOS]: `El usuario pregunta sobre pedidos de material/catálogo (compras en la app). Si falta el mes o período, pídeselo (ej. "este mes", "marzo"). No mezcles con vacaciones ni cuadrantes.`,
        [IntentType.VACACIONES]: `El usuario pregunta sobre vacaciones. Si no está claro, pregunta si necesita información sobre su saldo, solicitudes, o algo específico.`,
        [IntentType.EMPLEADOS]: `El usuario pregunta sobre empleados. Si no está claro, pregunta qué información específica necesita (listado completo, empleados sin cuadrante, sin horario, sin centro, etc.).`,
        [IntentType.NOMINAS]: `El usuario pregunta sobre nóminas pero no ha especificado el mes o período. Necesitas pedirle que especifique qué mes necesita.`,
        [IntentType.DIPLOMAS]: `El usuario pregunta sobre diplomas o certificaciones subidas en la app. Si el mensaje es vago, pide si quiere el listado de todos los que tienen archivo subido o filtrar por empleado.`,
        [IntentType.DOCUMENTOS]: `El usuario pregunta sobre documentos pero no está claro qué tipo de documento necesita. Pide aclaración.`,
        [IntentType.DOCUMENTOS_SOLICITADOS]: `El usuario pregunta sobre documentación que la empresa le ha pedido subir (pendiente de entregar). Si no está claro, pregunta si quiere solo pendientes o el historial completo.`,
        [IntentType.SOLICITUDES]: `El usuario pregunta sobre solicitudes/cambios en la tabla de solicitudes (vacaciones, bajas, etc.). Si falta alcance, pregunta si quiere solo pendientes, un tipo concreto o el listado reciente.`,
        [IntentType.COMUNICADOS]: `El usuario pregunta sobre comunicados o avisos internos publicados. Si no hay matiz, resume los recientes y cuáles están sin leer.`,
        [IntentType.PROCEDIMIENTOS]: `El usuario pregunta sobre procedimientos pero no está claro qué procedimiento específico necesita. Pide aclaración.`,
        [IntentType.INCIDENCIAS]: `El usuario reporta una incidencia. Si no está claro, pide más detalles sobre el problema.`,
        [IntentType.DESCONOCIDO]: `El usuario hace una pregunta pero no está claro qué necesita. Ofrece ayuda: fichajes, cuadrantes, pedidos de material, vacaciones, solicitudes, comunicados, nóminas, diplomas/certificaciones subidos, documentos de inspección, documentación pendiente de subir, incidencias.`,
      };

      const userPrompt = `${this.clarificationUserAskedLabel(outputLocale)}: "${mensaje}"

${clarificationPrompts[intent]}

${this.clarificationClosingInstruction(outputLocale)}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: this.getMaxTokensForResponse(prefs, 'clarify'),
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (response) {
        this.logger.log(`✅ Clarification request generated successfully`);
        return response;
      }

      return this.generateFallbackClarification(intent, outputLocale);
    } catch (error: any) {
      this.logger.error(
        `❌ Error generating clarification request: ${error.message}`,
      );
      return this.generateFallbackClarification(intent, outputLocale);
    }
  }

  private outputLocaleFor(
    prefs: ResolvedAssistantPreferences,
    language?: AssistantAiLanguageContext,
  ): AssistantLocale {
    return language?.responseLocale ?? (prefs.active ? prefs.locale : 'es');
  }

  private buildLanguageInstructionClosing(locale: AssistantLocale): string {
    switch (locale) {
      case 'en':
        return 'Always respond in English, naturally and professionally.';
      case 'ro':
        return 'Răspunde întotdeauna în română, natural și profesionist.';
      default:
        return 'Responde SIEMPRE en español, de forma natural y profesional.';
    }
  }

  private buildDataHandlingClosingLocale(locale: AssistantLocale): string {
    switch (locale) {
      case 'en':
        return 'Do not overuse emojis. Present data clearly. If there are many rows, mention they can download full data (Excel/TXT/PDF) when buttons are shown.';
      case 'ro':
        return 'Nu abuza de emoji. Prezintă datele clar. Dacă sunt multe înregistrări, menționează că pot descărca datele complete (Excel/TXT/PDF) când există butoane.';
      default:
        return 'No uses emojis en exceso. Si hay datos, preséntalos de forma clara. Si hay muchos registros, menciona brevemente que puede descargar los datos completos.';
    }
  }

  private clarificationUserAskedLabel(locale: AssistantLocale): string {
    switch (locale) {
      case 'ro':
        return 'Utilizatorul a întrebat';
      case 'en':
        return 'The user asked';
      default:
        return 'El usuario preguntó';
    }
  }

  private clarificationClosingInstruction(locale: AssistantLocale): string {
    switch (locale) {
      case 'ro':
        return 'Generează un răspuns prietenos în română care cere clarificări și oferă exemple concrete de reformulare.';
      case 'en':
        return 'Generate a friendly clarification request in English with concrete examples of how to rephrase.';
      default:
        return 'Genera una respuesta amigable en español que pida aclaración y ofrezca ejemplos concretos de cómo puede reformular su pregunta.';
    }
  }

  private dataDownloadHint(locale: AssistantLocale, count: number): string {
    switch (locale) {
      case 'ro':
        return `IMPORTANT: ${count} înregistrări în total. Menționează pe scurt că utilizatorul poate descărca datele complete (Excel/TXT/PDF) dacă apar butoane. `;
      case 'en':
        return `IMPORTANT: ${count} rows in total. Briefly mention the user can download full data (Excel/TXT/PDF) when download buttons appear. `;
      default:
        return `IMPORTANTE: Hay ${count} registros en total. Menciona brevemente que el usuario puede descargar todos los datos completos en Excel, TXT o PDF usando los botones de descarga que aparecerán. `;
    }
  }

  private userPromptAnswerFromDataLine(locale: AssistantLocale): string {
    switch (locale) {
      case 'ro':
        return 'Generează un răspuns natural și profesionist în română pe baza datelor de mai sus.';
      case 'en':
        return 'Generate a natural, professional answer in English based on the data above.';
      default:
        return 'Genera una respuesta natural y profesional en español basada en los datos proporcionados.';
    }
  }

  private userPromptAnswerFromSummaryLine(locale: AssistantLocale): string {
    switch (locale) {
      case 'ro':
        return 'Generează un răspuns natural și profesionist în română pe baza acestui rezumat. Include numărul total de înregistrări și detaliile relevante.';
      case 'en':
        return 'Generate a natural, professional answer in English from this summary. Include total row count and the most relevant details.';
      default:
        return 'Genera una respuesta natural y profesional en español basada en este resumen. Incluye el número total de registros y los detalles más relevantes.';
    }
  }

  private kbEmptyProcedimientosInstruction(locale: AssistantLocale): string {
    switch (locale) {
      case 'ro':
        return (
          'Baza de cunoștințe nu a returnat articole care să se potrivească exact întrebării.\n\n' +
          'Sarcina ta: răspunde totuși util, cu pași numerotați (1. 2. 3.), limbaj simplu, despre cum se folosește de obicei aplicația pentru subiectul întrebării (ex. concediu → meniu Solicitări / Vacanțe; orar → Cuadrante sau Mi horario).\n' +
          'NU spune „nu am date”, „nu există informații” sau „nu pot”. Propune explorarea meniului și reformularea sau întrebarea către administrare.\n\n' +
          'Răspunde concis.'
        );
      case 'en':
        return (
          'The knowledge base returned no articles that exactly match the question.\n\n' +
          'Your task: still give helpful numbered steps (1. 2. 3.) in simple language about how employees usually use the app for this topic (e.g. time off → Requests / Time off; schedule → Schedules / My schedule).\n' +
          'Do NOT say “no data”, “no information”, or “I can’t”. Suggest checking the menu, rephrasing, or asking admin.\n\n' +
          'Keep it concise.'
        );
      default:
        return (
          'La base de conocimiento no devolvió artículos que coincidan exactamente con la pregunta.\n\n' +
          'Tu tarea: responde de todos modos de forma útil, con pasos numerados (1. 2. 3.) y lenguaje muy sencillo, sobre cómo suele usarse la app para ese tema (ej. vacaciones → menú Solicitudes / Vacaciones; horario → Cuadrantes o Mi horario).\n' +
          'NO digas «no hay datos», «no tengo información» o «no puedo». Sugiere revisar el menú, reformular la pregunta o consultar a administración.\n\n' +
          'Sé breve.'
        );
    }
  }

  private userPromptNoDataBlock(locale: AssistantLocale): string {
    switch (locale) {
      case 'ro':
        return 'Nu s-au găsit date pentru această consultație.\n\nExplică pe scurt în română că nu există informații potrivite.';
      case 'en':
        return 'No data was found for this query.\n\nExplain briefly in English that there is no matching information.';
      default:
        return 'No se encontraron datos para esta consulta.\n\nExplica amablemente que no se encontró información.';
    }
  }

  private userPromptLanguageFooter(locale: AssistantLocale): string {
    switch (locale) {
      case 'ro':
        return 'Regulă finală de limbă: răspunsul vizibil utilizatorului trebuie să fie integral în română. Poți folosi date din JSON cu etichete în spaniolă, dar explică-le în română.';
      case 'en':
        return 'Final language rule: the user-visible answer must be entirely in English. JSON keys may be Spanish; explain content in English.';
      default:
        return 'Regla final de idioma: la respuesta visible para el usuario debe estar completamente en español.';
    }
  }

  /**
   * Fallback pentru clarificare când AI nu e disponibil
   */
  private generateFallbackClarification(
    intent: IntentType,
    outputLocale: AssistantLocale = 'es',
  ): string {
    const clarificationsEs: Record<IntentType, string> = {
      [IntentType.FICHAJES]:
        `Para poder ayudarte con los registros de fichaje, necesito que especifiques:\n\n` +
        `📅 **Fecha o período:**\n` +
        `- "registros de hoy"\n` +
        `- "registros de ayer"\n` +
        `- "registros del 15/12/2025"\n` +
        `- "registros de este mes"\n` +
        `- "registros de diciembre"\n\n` +
        `👤 **Empleado (opcional):**\n` +
        `- "registros de Juan Pérez"\n` +
        `- "registros del empleado 10000001"\n\n` +
        `Ejemplo: "¿Puedes darme los registros de fichaje de este mes para todos los empleados activos?"`,
      [IntentType.CUADRANTE]: `Para ayudarte con los cuadrantes, necesito que especifiques el mes o período que necesitas.`,
      [IntentType.PEDIDOS]: `Para ayudarte con tus pedidos de material/catálogo, indica el período si hace falta (ej. "este mes", "marzo").`,
      [IntentType.VACACIONES]: `Para ayudarte con las vacaciones, ¿necesitas información sobre tu saldo, solicitudes pendientes, o algo específico?`,
      [IntentType.EMPLEADOS]: `Para ayudarte con el listado de empleados, ¿necesitas información sobre todos los empleados, o empleados específicos (sin cuadrante, sin horario, sin centro, etc.)?`,
      [IntentType.NOMINAS]: `Para ayudarte con las nóminas, necesito que especifiques el mes que necesitas (ej: "nómina de diciembre").`,
      [IntentType.DIPLOMAS]: `Para diplomas o certificaciones en la app: ¿quieres el listado de quienes tienen archivo subido o buscas a alguien en concreto?`,
      [IntentType.DOCUMENTOS]: `Para ayudarte con los documentos, ¿qué tipo de documento necesitas?`,
      [IntentType.DOCUMENTOS_SOLICITADOS]: `Para la documentación que te han pedido subir: ¿quieres ver solo lo pendiente o todo el historial?`,
      [IntentType.SOLICITUDES]: `Para tus solicitudes (vacaciones, bajas, etc.): ¿solo pendientes, un tipo concreto o las últimas en general?`,
      [IntentType.COMUNICADOS]: `Sobre comunicados: ¿quieres los últimos avisos o solo los que no has leído?`,
      [IntentType.PROCEDIMIENTOS]: `Para ayudarte con los procedimientos, ¿qué procedimiento específico necesitas?`,
      [IntentType.INCIDENCIAS]: `Para ayudarte con la incidencia, ¿puedes darme más detalles sobre el problema?`,
      [IntentType.DESCONOCIDO]: `No estoy seguro de qué necesitas. Puedo ayudarte con fichajes, cuadrantes, pedidos de material (catálogo), vacaciones, solicitudes, comunicados, nóminas, documentos y más. ¿En qué puedo ayudarte específicamente?`,
    };

    const clarificationsRo: Record<IntentType, string> = {
      [IntentType.FICHAJES]:
        `Ca să te ajut cu pontajele/fichajes, am nevoie de:\n\n` +
        `📅 **Data sau perioada:** ex. „azi”, „ieri”, „2025-12-15”, „luna aceasta”, „decembrie”.\n` +
        `👤 **Angajat (opțional):** ex. după nume sau cod.\n\n` +
        `Exemplu: „Îmi poți da registrele de pontaj din luna aceasta?”`,
      [IntentType.CUADRANTE]: `Pentru cuadrante, spune te rog luna sau perioada care te interesează.`,
      [IntentType.PEDIDOS]: `Pentru comenzile de materiale din aplicație, spune perioada dacă e nevoie (ex. „luna asta”, „martie”).`,
      [IntentType.VACACIONES]: `Pentru concedii/vacanțe: vrei sold, cereri în așteptare sau altceva anume?`,
      [IntentType.EMPLEADOS]: `Pentru lista de angajați: vrei toți angajații sau doar cei fără cuadrante / fără orar / fără centru?`,
      [IntentType.NOMINAS]: `Pentru fluturași, spune luna (ex. „fluturaș decembrie”).`,
      [IntentType.DIPLOMAS]: `Pentru diplome/certificări încărcate în app: vrei lista celor cu fișier sau un angajat anume?`,
      [IntentType.DOCUMENTOS]: `Ce tip de document ai nevoie?`,
      [IntentType.DOCUMENTOS_SOLICITADOS]: `Pentru documentele cerute de firmă: vrei doar ce e în așteptare sau tot istoricul?`,
      [IntentType.SOLICITUDES]: `Pentru cereri/solicitări: vrei doar cele în așteptare, un tip anume sau ultimele în general?`,
      [IntentType.COMUNICADOS]: `Pentru comunicări: ultimele anunțuri sau doar ce nu ai citit?`,
      [IntentType.PROCEDIMIENTOS]: `Despre ce procedură e vorba?`,
      [IntentType.INCIDENCIAS]: `Poți detalia problema raportată?`,
      [IntentType.DESCONOCIDO]: `Nu sunt sigur ce ai nevoie. Te pot ajuta cu pontaje, cuadrante, comenzi materiale (catalog), concedii, cereri, comunicări, fluturași, documente inspecție, documente de încărcat și altele. Cu ce anume te ajut?`,
    };

    const clarificationsEn: Record<IntentType, string> = {
      [IntentType.FICHAJES]:
        `To help with clock-in/out records, please specify:\n\n` +
        `📅 **Date or period:** e.g. “today”, “yesterday”, “2025-12-15”, “this month”, “December”.\n` +
        `👤 **Employee (optional):** by name or code.\n\n` +
        `Example: “Can I have clock-in records for this month?”`,
      [IntentType.CUADRANTE]: `For schedules/shifts, please specify the month or period you need.`,
      [IntentType.PEDIDOS]: `For catalogue/material orders from the app, say the period if needed (e.g. “this month”, “March”).`,
      [IntentType.VACACIONES]: `For time off: do you need balance, pending requests, or something specific?`,
      [IntentType.EMPLEADOS]: `For employee lists: everyone, or only those missing schedule / shift plan / work site?`,
      [IntentType.NOMINAS]: `For payslips, specify the month (e.g. “December payslip”).`,
      [IntentType.DIPLOMAS]: `For diplomas or certifications uploaded in the app: do you want everyone with a file, or a specific employee?`,
      [IntentType.DOCUMENTOS]: `What kind of document do you need?`,
      [IntentType.DOCUMENTOS_SOLICITADOS]: `For uploads requested by HR: pending items only, or full history?`,
      [IntentType.SOLICITUDES]: `For requests (time off, leave, etc.): pending only, a specific type, or recent overall?`,
      [IntentType.COMUNICADOS]: `For internal notices: latest items, or only unread?`,
      [IntentType.PROCEDIMIENTOS]: `Which procedure are you asking about?`,
      [IntentType.INCIDENCIAS]: `Can you add more detail about the issue?`,
      [IntentType.DESCONOCIDO]: `I’m not sure what you need. I can help with clock-ins, schedules, catalogue orders, time off, requests, internal notices, payslips, inspection docs, pending uploads, and more. What would you like?`,
    };

    const table =
      outputLocale === 'ro'
        ? clarificationsRo
        : outputLocale === 'en'
          ? clarificationsEn
          : clarificationsEs;
    return table[intent] || table[IntentType.DESCONOCIDO];
  }

  /**
   * Construiește system prompt bazat pe intent și rol
   */
  private getMaxTokensForResponse(
    prefs: ResolvedAssistantPreferences,
    kind: 'main' | 'clarify',
  ): number {
    if (!prefs.active) {
      return kind === 'clarify' ? 300 : 500;
    }
    if (prefs.responseStyle === 'short') {
      return kind === 'clarify' ? 180 : 260;
    }
    if (prefs.responseStyle === 'detailed') {
      return kind === 'clarify' ? 420 : 900;
    }
    return kind === 'clarify' ? 300 : 500;
  }

  private buildClarificationSystemPrompt(locale: AssistantLocale): string {
    switch (locale) {
      case 'en':
        return `You are a professional virtual assistant. Ask for clarification when you lack information. Be clear and give concrete examples of how the user can rephrase.`;
      case 'ro':
        return `Ești un asistent virtual profesionist. Cere clarificări când nu ai suficiente informații. Fii clar și oferă exemple concrete de reformulare.`;
      default:
        return `Eres un asistente virtual profesional. Tu tarea es pedir aclaraciones cuando no tienes suficiente información para responder una consulta. Sé amigable, claro y ofrece ejemplos concretos de cómo el usuario puede reformular su pregunta.`;
    }
  }

  /** Instrucciones añadidas solo si opted_in (estilo / tono). */
  private buildPreferenceSuffix(prefs: ResolvedAssistantPreferences): string {
    if (!prefs.active) {
      return '';
    }
    const en = prefs.locale === 'en';
    const ro = prefs.locale === 'ro';
    const parts: string[] = [];
    if (prefs.responseStyle === 'short') {
      parts.push(
        en
          ? 'Keep answers brief: few sentences, no redundancy.'
          : ro
            ? 'Răspunsuri scurte: puține propoziții, fără redundanță.'
            : 'Respuestas breves: pocas frases, sin redundancia.',
      );
    } else if (prefs.responseStyle === 'detailed') {
      parts.push(
        en
          ? 'You may elaborate with clear sections or lists when helpful.'
          : ro
            ? 'Poți detalia cu secțiuni sau liste clare când ajută.'
            : 'Puedes desarrollar más: apartados o listas cuando ayuden a entender.',
      );
    }
    if (prefs.tone === 'friendly') {
      parts.push(
        en
          ? 'Warm, approachable tone; stay accurate.'
          : ro
            ? 'Ton cald și prietenos; rămâi corect.'
            : 'Tono cercano y amable; mantén corrección.',
      );
    } else {
      parts.push(
        en
          ? 'Professional, straightforward tone.'
          : ro
            ? 'Ton profesionist și direct.'
            : 'Tono profesional y directo.',
      );
    }
    const label = en
      ? '[User-saved preferences]'
      : ro
        ? '[Preferințe salvate de utilizator]'
        : '[Preferencias guardadas por el usuario]';
    return `\n\n${label}\n${parts.join(' ')}`;
  }

  private buildSystemPrompt(
    intent: IntentType,
    usuarioRol: string | null,
    prefs: ResolvedAssistantPreferences = DEFAULT_ASSISTANT_PREFERENCES,
    outputLocale: AssistantLocale = 'es',
  ): string {
    const rolContext =
      usuarioRol?.toLowerCase().includes('admin') ||
      usuarioRol?.toLowerCase().includes('supervisor') ||
      usuarioRol?.toLowerCase().includes('manager') ||
      usuarioRol?.toLowerCase().includes('developer') ||
      usuarioRol?.toLowerCase().includes('jefe')
        ? 'Eres un asistente para administradores/supervisores con acceso total a los datos.'
        : 'Eres un asistente para empleados que solo puede acceder a sus propios datos.';

    const intentContexts: Record<IntentType, string> = {
      [IntentType.FICHAJES]:
        'El usuario pregunta sobre fichajes (registros de entrada/salida) o empleados que deberían haber fichado pero no lo hicieron. Responde de forma clara y concisa. Si hay empleados sin cuadrante, horario o centro asignado, menciona claramente qué les falta (ej: "Sin cuadrante asignado", "Sin horario asignado", "Sin centro asignado"). Si hay muchos registros (>10), menciona que puede descargar los datos completos en Excel, TXT o PDF usando los botones de descarga.',
      [IntentType.CUADRANTE]:
        'El usuario pregunta sobre cuadrantes y horarios de trabajo (**planificación**: cuadrante vs horario asignado). El JSON del mes puede traer `fuente_plan`: `cuadrante` (grid ZI_* en tabla cuadrante), `horario_multicentro` (grid en horario_multicentro: CLIENTE/HORARIO/SERVICIO) o `plan_dia` (una fila por día cuando no hay grid pero sí plan vía horario plantilla u otras fuentes). En `plan_dia`, `fuente` indica la fuente del día (`cuadrante`, `horario`, `horario_multicentro`, etc.). Los datos pueden incluir `horas_plan`, `horas_horario_multicentro_dia`, `cliente_horario_multicentro`, `valor_celula_cuadrante`, `trabaja_este_dia`, `centro`. Incluye en la respuesta a quienes trabajan por **horario_multicentro** en ese centro/cliente, no solo los que tienen ese `centro` como centro principal. **REGLA CRÍTICA (confidencialidad):** usa **solo** los nombres de centro/cliente que aparecen en el JSON (`centro`, `cliente_horario_multicentro`, `CLIENTE`). **PROHIBIDO** inventar, sustituir o «recordar» otro centro (ej. de conversaciones anteriores). Si el JSON no menciona un centro concreto, no lo nombres. **NO confundas esto con fichajes** (marcajes reales de entrada/salida): salvo que el usuario pida explícitamente fichajes, registros o marcas, explica quién **debería trabajar** según plan/horario para la fecha, no quién ha fichado. Si el rol es empleado (acceso solo a datos propios) y la pregunta es por **otro centro**, el listado puede venir vacío: explica con claridad que hace falta rol de supervisión/administración para ver el equipo completo de un centro, sin decir que «falta cuadrante» en el sistema si no hay datos. **REGLA CRÍTICA (exactitud de centro):** Distingue: (A) El usuario **nombra un centro concreto**: no titules con un centro distinto al de cada fila (`centro` / `cliente_horario_multicentro`); si no hay filas para ese centro, di que no hay resultados o pide el nombre exacto como en la app; **no inventes** ni listes personal como de otro centro. (B) El usuario pide **listado agrupado por centro** (p. ej. «por centro», «cada centro») **sin** nombrar un único centro: **prohibido** decir «no hay datos para el centro que solicitaste» o pedir el nombre exacto de un centro; si no hay filas, explica ausencia de plan para la fecha o alcance/rol sin culpar a un centro mal escrito; si hay filas, agrupa por `centro` y muestra todos los que aparecen en el JSON.',
      [IntentType.PEDIDOS]:
        'El usuario pregunta sobre **pedidos de material o catálogo** (compras de suministros desde la app). Usa ÚNICAMENTE el JSON de pedidos que recibes. PROHIBIDO mezclar, citar o inventar información de cuadrantes, fichajes o vacaciones. Si el array está vacío, di claramente que no hay pedidos en el período consultado.',
      [IntentType.VACACIONES]:
        'El usuario pregunta sobre vacaciones o asuntos propios. Responde de forma clara y concisa.',
      [IntentType.EMPLEADOS]:
        'El usuario pregunta sobre un listado de empleados con su estado, cuadrantes, horarios y centros asignados, o sobre **su propio contrato** (resumen en datos de ficha). Presenta la información de forma clara. Si la pregunta es **cómo solicitar o obtener una copia del contrato**, no digas que debe ir al «RRHH del centro de trabajo» por el campo `centro` de la ficha: indica supervisión / RRHH o administración de la empresa. Si hay muchos empleados (>10), menciona descarga Excel/TXT/PDF cuando aplique.',
      [IntentType.NOMINAS]:
        'El usuario pregunta sobre nóminas (payslips). Si las filas traen row_kind=sin_nomina_mes, son empleados ACTIVOS sin fila en Nominas para ese mes/año (heurística): lista quién falta; NO ofrezcas descargar nómina ni hables como si fueran PDFs de nómina. Si son nóminas reales (id, Mes, fecha_subida), enumera periodos; si hay muchas (>10), resume y recuerda descarga cuando aplique.',
      [IntentType.DIPLOMAS]:
        'El usuario pregunta sobre diplomas o certificaciones subidas en la app (tabla diplomas, metadatos). Enumera empleado, nombre_archivo y fecha_subida; no inventes contenido del archivo.',
      [IntentType.DOCUMENTOS]:
        'El usuario pregunta sobre documentos de inspección ya registrados (metadatos). Resume por tipo y estado; si no hay filas, explica que puede no haber registros o que debe mirar la sección Documentos en la app.',
      [IntentType.DOCUMENTOS_SOLICITADOS]:
        'El usuario pregunta sobre documentación que la empresa le ha solicitado entregar (tabla documentos_solicitados). Enumera tipo_documento y estado; distingue pendiente vs completado. No inventes requisitos.',
      [IntentType.SOLICITUDES]:
        'El usuario pregunta sobre ausencias / solicitudes. El JSON puede traer **solicitudes** (tabla solicitudes) y **ausencias_calendario** (tabla **Ausencias**, misma consulta que el cron n8n «Cron absente»: tipos operativos, FECHA en un día o rango, duración, ubicación). Usa ambas listas. Campos Ausencias: NOMBRE, CODIGO, TIPO, FECHA_RAW, fecha_inicio/fecha_fin derivadas, DURACION, UNIDAD_DURACION, LOCACION, MOTIVO. PROHIBIDO inventar datos ausentes; PROHIBIDO mezclar con saldo de vacaciones personales. Si la pregunta es **qué ausencias hay / tenemos** (día o periodo), **no** respondas con el **plan de trabajo** (quién tiene horas plan / cuadrante del día): eso es otro módulo; aquí solo **solicitudes** + **Ausencias** del JSON.',
      [IntentType.COMUNICADOS]:
        'El usuario pregunta sobre comunicados internos publicados. Usa titulo, resumen_texto, leido_por_mi. Indica cuántos sin leer. No inventes contenido que no esté en el JSON.',
      [IntentType.PROCEDIMIENTOS]:
        'El usuario pregunta cómo usar la aplicación o un procedimiento interno. Si el JSON trae artículos de la base de conocimiento (título + contenido), redacta la respuesta en pasos numerados (1. 2. 3.) con lenguaje muy simple, sin inventar pantallas que no aparezcan en el texto. Si no hay artículos, da una guía general segura (menú, sección de solicitudes/cuadrantes/documentos según el tema de la pregunta) sin decir «no hay datos» ni «no tengo información». **Excepción:** si la pregunta es **borrar o eliminar justificantes** (p. ej. cita médica) y **no** consta en los artículos que exista esa opción, **no inventes** menús ni pasos de eliminación: indica que debe contactar a **supervisión** o **RRHH**.',
      [IntentType.INCIDENCIAS]:
        'El usuario reporta una incidencia o problema. Responde de forma empática y profesional.',
      [IntentType.DESCONOCIDO]:
        'El usuario hace una pregunta general o saludo. Responde de forma amigable y profesional. Si no entiendes la pregunta, ofrece ayuda sobre qué puedes hacer.',
    };

    const closing = `${this.buildLanguageInstructionClosing(outputLocale)} ${this.buildDataHandlingClosingLocale(outputLocale)}`;

    return `${rolContext}\n\n${intentContexts[intent]}\n\n${this.buildGlobalPolicyNoCenterAdministrator(outputLocale)}\n\n${closing}${this.buildPreferenceSuffix(prefs)}`;
  }

  /**
   * Política fija: no dirigir al usuario a un «administrador del centro de trabajo» como contacto (cualquier tema).
   */
  private buildGlobalPolicyNoCenterAdministrator(
    outputLocale: AssistantLocale,
  ): string {
    if (outputLocale === 'ro') {
      return '**REGULĂ GLOBALĂ (obligatorie):** Nu spune niciodată că utilizatorul trebuie să se adreseze **administratorului centrului de lucru** / „responsabilului de centru” ca persoană de contact pentru cereri, documente, reclamații sau pași în aplicație. Câmpul „centru” din date este doar **informație de locație**. Orientează spre **resurse umane**, **administrația companiei**, **supervizare**, secțiunile relevante din **aplicație** sau canalele oficiale ale firmei — dar **nu** inventa sau impune un „administrator al centrului” ca destinatar.';
    }
    if (outputLocale === 'en') {
      return '**GLOBAL RULE (mandatory):** Never tell the user to contact a **work-center administrator** / **site administrator** as the person to reach for requests, documents, complaints, or app steps. The `centro` / work-site field in data is **location information only**. Point to **HR**, **company administration**, **supervision**, the relevant **app sections**, or official company channels — **never** present “the center administrator” as the addressee.';
    }
    return '**REGLA GLOBAL (obligatoria):** Nunca indiques que el usuario debe dirigirse al **administrador del centro de trabajo** (ni a un «responsable del centro» como persona de contacto única) para trámites, solicitudes, documentos, incidencias o pasos en la app. El campo `centro` en los datos es solo **información de ubicación laboral**. Orienta hacia **recursos humanos**, **administración de la empresa**, **supervisión**, las secciones pertinentes de la **aplicación** o los canales oficiales de la empresa, según el tema — **prohibido** presentar al «administrador del centro de trabajo» como destinatario.';
  }

  /** Repetición breve en el user prompt (refuerzo). */
  private buildGlobalPolicyNoCenterAdministratorUserReminder(
    outputLocale: AssistantLocale,
  ): string {
    if (outputLocale === 'ro') {
      return 'Recordator obligatoriu: nu îndruma niciodată utilizatorul către „administratorul centrului de lucru” ca persoană de contact.';
    }
    if (outputLocale === 'en') {
      return 'Mandatory reminder: never direct the user to a “work-center administrator” as the contact person.';
    }
    return 'Recordatorio obligatorio: no indiques nunca al «administrador del centro de trabajo» como persona de contacto para trámites.';
  }

  /**
   * Construiește user prompt cu mesajul și datele
   * Pentru array-uri mari, generează un rezumat/statistici în loc de toate înregistrările
   */
  private buildUserPrompt(
    mensaje: string,
    intent: IntentType,
    data: any[] | any | null,
    confianza: number,
    outputLocale: AssistantLocale,
    entidades?: IntentResult['entidades'],
  ): string {
    const qLabel =
      outputLocale === 'ro'
        ? 'Întrebarea utilizatorului'
        : outputLocale === 'en'
          ? 'User question'
          : 'Pregunta del usuario';
    const iLabel =
      outputLocale === 'ro'
        ? 'Intent detectat'
        : outputLocale === 'en'
          ? 'Detected intent'
          : 'Intent detectado';
    const confLabel =
      outputLocale === 'ro'
        ? 'încredere'
        : outputLocale === 'en'
          ? 'confidence'
          : 'confianza';

    let prompt = `${qLabel}: "${mensaje}"\n\n`;
    prompt += `${iLabel}: ${intent} (${confLabel}: ${(confianza * 100).toFixed(0)}%)\n\n`;

    if (data) {
      const isSolicitudesCombo =
        intent === IntentType.SOLICITUDES &&
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        Array.isArray((data as Record<string, unknown>).solicitudes) &&
        Array.isArray((data as Record<string, unknown>).ausencias_calendario);

      if (isSolicitudesCombo) {
        const d = data as {
          solicitudes: unknown[];
          ausencias_calendario: unknown[];
        };
        const s = d.solicitudes;
        const a = d.ausencias_calendario;
        const total = s.length + a.length;
        if (total === 0) {
          prompt += this.userPromptNoDataBlock(outputLocale);
        } else if (total > 10) {
          prompt += `Resumen de datos (${total} registros: tabla solicitudes + tabla Ausencias, misma lógica SQL que n8n «Cron absente»):\n${JSON.stringify(this.generateSolicitudesComboSummary(s as any[], a as any[]), null, 2)}\n\n`;
          prompt += this.dataDownloadHint(outputLocale, total);
          prompt += this.userPromptAnswerFromSummaryLine(outputLocale);
        } else {
          prompt += `Datos encontrados (${total}):\n${JSON.stringify({ solicitudes: s, ausencias_calendario: a }, null, 2)}\n\n`;
          prompt += this.userPromptAnswerFromDataLine(outputLocale);
        }
      } else if (Array.isArray(data) && data.length > 0) {
        // Pentru array-uri mari (>10), generăm un rezumat/statistici
        if (data.length > 10) {
          const summary = this.generateDataSummary(intent, data);
          prompt += `Resumen de datos encontrados (${data.length} registro(s) total):\n${JSON.stringify(summary, null, 2)}\n\n`;
          prompt += this.dataDownloadHint(outputLocale, data.length);
          prompt += this.userPromptAnswerFromSummaryLine(outputLocale);
        } else {
          // Pentru array-uri mici, trimitem datele optimizate
          const optimizedData = data.map((item: any) => {
            const optimized: any = {};
            // Păstrează doar câmpurile esențiale
            // Nume: verifică multiple variante (fichajes, solicitudes, etc.)
            if (
              item.nombre_apellidos ||
              item['NOMBRE / APELLIDOS'] ||
              item.nombre
            ) {
              optimized.nombre =
                item.nombre_apellidos ||
                item['NOMBRE / APELLIDOS'] ||
                item.nombre;
            }
            if (item.CODIGO || item.codigo)
              optimized.codigo = item.CODIGO || item.codigo;
            if (item.TIPO || item.tipo) optimized.tipo = item.TIPO || item.tipo;
            if (item.HORA || item.hora) optimized.hora = item.HORA || item.hora;
            if (item.FECHA || item.fecha || item.fecha_inicio)
              optimized.fecha = item.FECHA || item.fecha || item.fecha_inicio;
            if (item.fecha_fin) optimized.fecha_fin = item.fecha_fin;
            if (item.estado) optimized.estado = item.estado;
            if (item.email) optimized.email = item.email;
            if (item.motivo) optimized.motivo = item.motivo;
            // Pentru fichajes faltantes: include detalii despre ce lipsește
            if (item.detalles_faltantes)
              optimized.detalles_faltantes = item.detalles_faltantes;
            if (item.fuente) optimized.fuente = item.fuente;
            if (item.horas_plan !== undefined)
              optimized.horas_plan = item.horas_plan;
            const centroVal =
              item.centro ?? item.CENTRO ?? item['CENTRO TRABAJO'];
            if (centroVal !== undefined && centroVal !== null)
              optimized.centro = String(centroVal).trim() || undefined;
            if (item.horas_horario_multicentro_dia != null)
              optimized.horas_horario_multicentro_dia =
                item.horas_horario_multicentro_dia;
            if (item.cliente_horario_multicentro != null)
              optimized.cliente_horario_multicentro =
                item.cliente_horario_multicentro;
            // Pentru listado empleados: include toate câmpurile relevante
            if (item.estado) optimized.estado = item.estado;
            if (item.tiene_cuadrante)
              optimized.tiene_cuadrante = item.tiene_cuadrante;
            if (item.tiene_horario)
              optimized.tiene_horario = item.tiene_horario;
            if (item.tiene_centro) optimized.tiene_centro = item.tiene_centro;
            if (item.grupo) optimized.grupo = item.grupo;
            if (item.id !== undefined && item.id !== null)
              optimized.id = item.id;
            if (item.Mes || item.mes) optimized.mes = item.Mes || item.mes;
            if (item.Ano != null && item.Ano !== '') optimized.ano = item.Ano;
            else if (item.ano != null && item.ano !== '')
              optimized.ano = item.ano;
            if (item.fecha_subida) optimized.fecha_subida = item.fecha_subida;
            if (item.pedido_uid) optimized.pedido_uid = item.pedido_uid;
            if (item.comunidad_nombre)
              optimized.comunidad_nombre = item.comunidad_nombre;
            if (item.creado_en) optimized.creado_en = item.creado_en;
            if (item.num_items != null) optimized.num_items = item.num_items;
            if (item.moneda) optimized.moneda = item.moneda;
            if (item.total != null) optimized.total = item.total;
            if (item.titulo != null) optimized.titulo = item.titulo;
            if (item.contenido != null) optimized.contenido = item.contenido;
            if (item.resumen_texto != null)
              optimized.resumen_texto = item.resumen_texto;
            if (item.leido_por_mi !== undefined)
              optimized.leido_por_mi = item.leido_por_mi;
            if (item.autor_id != null) optimized.autor_id = item.autor_id;
            if (item.tipo_documento != null)
              optimized.tipo_documento = item.tipo_documento;
            if (item.row_kind != null) optimized.row_kind = item.row_kind;
            if (item.mes_referencia != null)
              optimized.mes_referencia = item.mes_referencia;
            if (item.ano_referencia != null)
              optimized.ano_referencia = item.ano_referencia;
            if (item.codigo_empleado != null)
              optimized.codigo_empleado = item.codigo_empleado;
            if (item.nombre_archivo != null)
              optimized.nombre_archivo = item.nombre_archivo;
            if (item.nombre_empleado != null)
              optimized.nombre_empleado = item.nombre_empleado;
            if (item.subido_por != null) optimized.subido_por = item.subido_por;
            if (item.notas != null)
              optimized.notas = String(item.notas).slice(0, 200);
            if (item.empleado_id != null)
              optimized.empleado_id = item.empleado_id;
            if (item.tipo != null) optimized.tipo = item.tipo;
            if (item.fecha_completado != null)
              optimized.fecha_completado = item.fecha_completado;
            if (intent === IntentType.SOLICITUDES) {
              const fi = this.formatRowDate(item.fecha_inicio);
              if (fi) optimized.fecha_inicio = fi;
              if (
                item.fecha_fin != null &&
                String(item.fecha_fin).trim() !== ''
              ) {
                optimized.fecha_fin = this.formatRowDate(item.fecha_fin);
              }
              if (
                item.tipo_justificante != null &&
                String(item.tipo_justificante).trim() !== ''
              ) {
                optimized.tipo_justificante = item.tipo_justificante;
              }
            }
            if (intent === IntentType.CUADRANTE) {
              if (item.NOMBRE != null) optimized.NOMBRE = item.NOMBRE;
              if (item.LUNA != null) optimized.LUNA = item.LUNA;
              if (item.CENTRO != null) optimized.CENTRO = item.CENTRO;
              if (item.TotalHoras != null && item.TotalHoras !== '')
                optimized.TotalHoras = item.TotalHoras;
              for (let zi = 1; zi <= 31; zi++) {
                const k = `ZI_${zi}`;
                if (item[k] != null && String(item[k]).trim() !== '') {
                  optimized[k] = item[k];
                }
              }
            }
            return optimized;
          });

          prompt += `Datos encontrados (${data.length} registro(s)):\n${JSON.stringify(optimizedData, null, 2)}\n\n`;
          if (data.length > 10) {
            prompt += this.dataDownloadHint(outputLocale, data.length);
          }
          prompt += this.userPromptAnswerFromDataLine(outputLocale);
        }
      } else if (
        Array.isArray(data) &&
        data.length === 0 &&
        intent === IntentType.PROCEDIMIENTOS
      ) {
        prompt += this.kbEmptyProcedimientosInstruction(outputLocale);
        if (looksLikeAppHelpDatosPersonales(mensaje)) {
          prompt +=
            procedimientosAppHelpDatosPersonalesSupplement(outputLocale);
        }
        prompt += '\n\n' + this.userPromptAnswerFromDataLine(outputLocale);
      } else if (
        typeof data === 'object' &&
        !Array.isArray(data) &&
        Object.keys(data as object).length > 0 &&
        !(
          intent === IntentType.SOLICITUDES &&
          Array.isArray((data as Record<string, unknown>).solicitudes) &&
          Array.isArray((data as Record<string, unknown>).ausencias_calendario)
        )
      ) {
        prompt += `Datos encontrados:\n${JSON.stringify(data, null, 2)}\n\n`;
        prompt += this.userPromptAnswerFromDataLine(outputLocale);
      } else {
        prompt += this.userPromptNoDataBlock(outputLocale);
      }
    } else {
      if (intent === IntentType.PROCEDIMIENTOS) {
        prompt += this.kbEmptyProcedimientosInstruction(outputLocale);
        if (looksLikeAppHelpDatosPersonales(mensaje)) {
          prompt +=
            procedimientosAppHelpDatosPersonalesSupplement(outputLocale);
        }
        prompt += '\n\n' + this.userPromptAnswerFromDataLine(outputLocale);
      } else if (looksLikeAppHelpDatosPersonales(mensaje)) {
        prompt += this.kbEmptyProcedimientosInstruction(outputLocale);
        prompt += procedimientosAppHelpDatosPersonalesSupplement(outputLocale);
        prompt += '\n\n' + this.userPromptAnswerFromDataLine(outputLocale);
      } else {
        prompt += this.userPromptNoDataBlock(outputLocale);
      }
    }

    if (intent === IntentType.PEDIDOS) {
      prompt +=
        '\n\nREGLA CRÍTICA (PEDIDOS): Responde solo sobre pedidos de material/catálogo del JSON. No menciones cuadrantes, horarios ni fichajes.';
    }

    if (intent === IntentType.CUADRANTE) {
      const agruparSinCentroNombrado =
        Boolean(entidades?.agrupar_por_centro) &&
        !String(entidades?.centro ?? '').trim();

      if (agruparSinCentroNombrado) {
        prompt +=
          '\n\nREGLA CRÍTICA (LISTADO POR CENTRO, SIN CENTRO CONCRETO EN LA PETICIÓN): El usuario pidió ver trabajadores **agrupados por centro** (no un solo centro nombrado). **PROHIBIDO** decir «no hay datos para el centro que solicitaste», «verifica el nombre exacto del centro» o pedir el nombre exacto de un centro: el usuario **no** ha solicitado un centro concreto. Si el JSON está vacío o no hay filas, di que no hay trabajadores previstos para la fecha en el alcance de datos disponible, o que el rol limita la visibilidad (p. ej. solo datos propios), **sin** culpar a un centro mal escrito. Si hay datos, sigue la instrucción de formato «por centro».';
      } else {
        prompt +=
          '\n\nREGLA CRÍTICA (CENTRO / LISTADOS): Si el usuario pide quién trabaja «en [centro]» concreto, comprueba el campo `centro` (y `cliente_horario_multicentro` si el turno es multicentro) en **cada fila** del JSON. No titules ni afirmes «en el centro X…» si X no coincide con lo que pidió el usuario o con los valores reales de las filas. Si el centro pedido no aparece o no coincide con ninguna fila, **no inventes** otro centro: di que no hay resultados para ese centro o pide el nombre exacto como en la aplicación. Ante la duda, **no listes** personal como si fuera del centro equivocado.';
      }
    }

    if (intent === IntentType.CUADRANTE && entidades?.agrupar_por_centro) {
      prompt +=
        '\n\nINSTRUCCIÓN DE FORMATO (listado por centro): El usuario pidió trabajadores previstos **agrupados por centro de trabajo** (no un solo centro). Organiza la respuesta en **secciones**: un encabezado por cada valor distinto de `centro` en los datos; dentro de cada sección, lista empleados (nombre/código) con horas previstas para la fecha. Si una fila tiene turno por **horario_multicentro**, indica `cliente_horario_multicentro` y no mezcles esa fila como si el centro principal fuera el único contexto. No des una lista plana única sin separar por centro.';
    }

    if (intent === IntentType.SOLICITUDES) {
      prompt +=
        '\n\nREGLA CRÍTICA (SOLICITUDES): Hay dos fuentes en el JSON cuando aparecen `solicitudes` y `ausencias_calendario`: (1) filas de `solicitudes` con estado/tipo de solicitud; (2) filas de tabla `Ausencias` (registro operativo por día o rango FECHA) — incluye permisos, ausencias justificadas, vacaciones materializadas, etc., como el cron n8n. Resume ambas. Usa los campos reales (NOMBRE/CODIGO/TIPO/FECHA_RAW en Ausencias). PROHIBIDO «información no disponible» si el JSON trae el dato. OBLIGATORIO: enumera TODOS los tipos con recuento > 0 de `distribucion_tipos_solicitudes` y de `distribucion_tipos_tabla_ausencias` (y de las claves `*_ordenada` si existen); no agrupar en un solo bloque genérico «otras» ni omitir tipos.';
    }

    if (
      intent === IntentType.EMPLEADOS &&
      entidades?.contrato_solicitud_procedimiento
    ) {
      prompt +=
        '\n\nREGLA CRÍTICA (solicitud de copia del contrato): La pregunta es **cómo solicitar o conseguir** el contrato o una copia oficial. **NO** indiques que debe dirigirse al «departamento de recursos humanos del centro de trabajo» ni uses el campo `centro` del JSON como **destino** de la solicitud o como único interlocutor. El `centro` en ficha es **dato laboral de ubicación**, no el canal oficial para expedir el documento. Indica que debe contactar a **supervisión**, **recursos humanos / administración de la empresa** o el canal que la empresa haya establecido. Si el JSON incluye `empresa`, puedes citarla como empleador; **no** presentes al administrador del centro asignado como responsable de entregar el contrato. Si hay `documento_contrato_subido`, puedes mencionar si consta copia en la app; no inventes trámites internos.';
    }

    prompt += `\n\n${this.buildGlobalPolicyNoCenterAdministratorUserReminder(outputLocale)}`;
    prompt += `\n\n${this.userPromptLanguageFooter(outputLocale)}`;
    return prompt;
  }

  /** Fecha YYYY-MM-DD para prompts (Date Prisma o string). */
  private formatRowDate(v: unknown): string {
    if (v == null || v === '') return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  /** Resumen solicitudes + tabla Ausencias (n8n Cron absente) para el LLM. */
  private generateSolicitudesComboSummary(
    solicitudes: any[],
    ausencias: any[],
  ): Record<string, unknown> {
    const distSol: Record<string, number> = {};
    for (const r of solicitudes) {
      const t = String(r?.tipo ?? 'sin tipo');
      distSol[t] = (distSol[t] || 0) + 1;
    }
    const distAus: Record<string, number> = {};
    for (const r of ausencias) {
      const t = String(r?.TIPO ?? r?.tipo ?? 'sin tipo');
      distAus[t] = (distAus[t] || 0) + 1;
    }
    const muestraSol = solicitudes.slice(0, 5).map((s: any) => ({
      codigo: s.codigo,
      nombre: s.nombre,
      tipo: s.tipo,
      estado: s.estado,
      fecha_inicio: this.formatRowDate(s.fecha_inicio),
      fecha_fin: s.fecha_fin ? this.formatRowDate(s.fecha_fin) : null,
      tipo_justificante: s.tipo_justificante ?? null,
    }));
    const muestraAus = ausencias.slice(0, 5).map((x: any) => ({
      CODIGO: x.CODIGO,
      NOMBRE: x.NOMBRE,
      TIPO: x.TIPO,
      FECHA_RAW: x.FECHA_RAW,
      fecha_inicio: this.formatRowDate(x.fecha_inicio),
      fecha_fin: x.fecha_fin ? this.formatRowDate(x.fecha_fin) : null,
      DURACION: x.DURACION ?? null,
      UNIDAD_DURACION: x.UNIDAD_DURACION ?? null,
      LOCACION: x.LOCACION ?? null,
      fuente: x.fuente ?? 'ausencias_registro',
    }));
    const ordenDesc = (a: [string, number], b: [string, number]) =>
      b[1] - a[1] || a[0].localeCompare(b[0]);
    return {
      solicitudes_count: solicitudes.length,
      ausencias_calendario_count: ausencias.length,
      distribucion_tipos_solicitudes: distSol,
      distribucion_tipos_tabla_ausencias: distAus,
      distribucion_tipos_solicitudes_ordenada:
        Object.entries(distSol).sort(ordenDesc),
      distribucion_tipos_tabla_ausencias_ordenada:
        Object.entries(distAus).sort(ordenDesc),
      muestra_solicitudes: muestraSol,
      muestra_ausencias: muestraAus,
      nota: 'ausencias_calendario = tabla Ausencias (SQL alineado con n8n «Cron absente»).',
    };
  }

  /**
   * Generează un rezumat/statistici pentru array-uri mari
   */
  private generateDataSummary(intent: IntentType, data: any[]): any {
    switch (intent) {
      case IntentType.FICHAJES:
        // Agrupează după CODIGO pentru a număra câți angajați au fichat
        const empleadosMap = new Map<string, any>();
        const tiposCount: Record<string, number> = {};

        data.forEach((item: any) => {
          const codigo = item.CODIGO || item.codigo;
          const nombre =
            item.nombre_apellidos || item['NOMBRE / APELLIDOS'] || 'N/A';
          const tipo = item.TIPO || item.tipo || 'N/A';
          const hora = item.HORA || item.hora || 'N/A';

          // Numără tipurile
          tiposCount[tipo] = (tiposCount[tipo] || 0) + 1;

          // Agrupează după angajat
          if (codigo && !empleadosMap.has(codigo)) {
            empleadosMap.set(codigo, {
              codigo,
              nombre,
              fichajes: [],
            });
          }
          if (codigo) {
            empleadosMap.get(codigo)?.fichajes.push({ tipo, hora });
          }
        });

        // Primele 5 angajați ca sample
        const sampleEmpleados = Array.from(empleadosMap.values())
          .slice(0, 5)
          .map((emp) => ({
            nombre: emp.nombre,
            total_fichajes: emp.fichajes.length,
            fichajes: emp.fichajes.slice(0, 2), // Primele 2 fichaje per angajat
          }));

        return {
          total_registros: data.length,
          total_empleados_unicos: empleadosMap.size,
          tipos_distribucion: tiposCount,
          muestra_empleados: sampleEmpleados,
          nota: `Hay ${empleadosMap.size} empleado(s) que han fichado. Mostrando muestra de ${Math.min(5, empleadosMap.size)} empleado(s).`,
        };

      case IntentType.CUADRANTE: {
        const first = data[0] as Record<string, unknown> | undefined;
        /** Filas de `plan_trabajo_dia` (nombre, centro, horas_plan, fuente) vs rejilla mensual (LUNA, ZI_*). */
        const isPlanTrabajoDia =
          !!first &&
          (first.horas_plan !== undefined ||
            first.fuente !== undefined ||
            (first.fecha != null && first.LUNA === undefined));

        if (isPlanTrabajoDia) {
          const porCentro: Record<string, number> = {};
          let conHoras = 0;
          for (const raw of data) {
            const item = raw as Record<string, unknown>;
            const c = String(
              item.centro ?? item.CENTRO ?? item['CENTRO TRABAJO'] ?? '',
            ).trim();
            const key = c || 'Sin centro asignado';
            porCentro[key] = (porCentro[key] || 0) + 1;
            const hp = Number(item.horas_plan);
            if (!Number.isNaN(hp) && hp > 0) conHoras++;
          }
          return {
            tipo_consulta: 'plan_trabajo_dia',
            total_registros: data.length,
            empleados_con_horas_plan_positivas: conHoras,
            distribucion_por_centro: porCentro,
            muestra: data.slice(0, 12).map((raw: any) => ({
              codigo: raw.CODIGO || raw.codigo,
              nombre: raw.nombre || raw.NOMBRE || raw['NOMBRE / APELLIDOS'],
              centro: raw.centro ?? raw.CENTRO ?? raw['CENTRO TRABAJO'] ?? null,
              horas_plan: raw.horas_plan,
              fuente: raw.fuente,
              trabaja_este_dia: raw.trabaja_este_dia,
              cliente_horario_multicentro:
                raw.cliente_horario_multicentro ?? null,
            })),
            nota: 'Datos del plan del día (daily_plan). Usa los campos `centro`, `horas_plan` y `fuente` de cada fila; no inventes N/A si vienen en la muestra o en la distribución. Para «quién trabaja hoy», prioriza filas con horas_plan > 0.',
          };
        }

        return {
          total_registros: data.length,
          muestra: data.slice(0, 3).map((item: any) => ({
            NOMBRE: item.NOMBRE || item.nombre || 'N/A',
            LUNA: item.LUNA || 'N/A',
            CENTRO: item.CENTRO || item.centro || 'N/A',
            TotalHoras: item.TotalHoras ?? 'N/A',
          })),
          nota: `Cuadrante(s); detalle por día (ZI_1…ZI_31) en filas completas cuando el listado es pequeño.`,
        };
      }

      case IntentType.PEDIDOS:
        return {
          total_pedidos: data.length,
          pedidos: data.map((item: any) => ({
            pedido_uid: item.pedido_uid,
            estado: item.estado,
            total: item.total,
            moneda: item.moneda,
            comunidad: item.comunidad_nombre,
            fecha: item.fecha,
            num_items: item.num_items,
          })),
          nota: 'Solo pedidos de catálogo/material; no mezclar con cuadrante u otros módulos.',
        };

      case IntentType.NOMINAS: {
        const faltan = data.some(
          (item: any) => item.row_kind === 'sin_nomina_mes',
        );
        if (faltan) {
          return {
            consulta: 'empleados_activos_sin_nomina_mes',
            total_empleados: data.length,
            mes_referencia: data[0]?.mes_referencia,
            ano_referencia: data[0]?.ano_referencia,
            muestra: data.slice(0, 15).map((item: any) => ({
              codigo_empleado: item.codigo_empleado,
              nombre: item.nombre,
              estado: item.estado,
            })),
            nota: 'Empleados ACTIVOS sin fila en Nominas que coincida con mes/año (heurística SQL). No son archivos de nómina.',
          };
        }
        return {
          total_registros: data.length,
          nominas: data.map((item: any) => ({
            nombre:
              item.nombre ||
              item.nombre_apellidos ||
              item['NOMBRE / APELLIDOS'] ||
              'N/A',
            mes: item.Mes || item.mes || 'N/A',
            ano: item.Ano ?? item.ano ?? 'N/A',
            fecha_subida: item.fecha_subida || 'N/A',
          })),
          nota: 'Lista completa por mes/año; el asistente debe resumir sin omitir periodos distintos.',
        };
      }

      case IntentType.DIPLOMAS:
        return {
          total: data.length,
          muestra: data.slice(0, 15).map((item: any) => ({
            nombre_empleado: item.nombre_empleado,
            nombre_archivo: item.nombre_archivo,
            fecha_subida: item.fecha_subida
              ? String(item.fecha_subida).slice(0, 10)
              : null,
            notas: item.notas ? String(item.notas).slice(0, 80) : null,
          })),
          nota: 'Metadatos de diplomas/certificaciones; no se incluye el PDF.',
        };

      case IntentType.DOCUMENTOS:
        return {
          total_registros: data.length,
          muestra: data.slice(0, 3).map((item: any) => ({
            nombre: item.nombre || item.NOMBRE || 'N/A',
            tipo: item.TIPO || item.tipo || 'N/A',
            fecha: item.FECHA || item.fecha || 'N/A',
          })),
          nota: `Mostrando muestra de 3 registros de ${data.length} total.`,
        };

      case IntentType.PROCEDIMIENTOS:
        return {
          total_articulos: data.length,
          articulos: data.map((item: any) => ({
            titulo: item.titulo || 'Artículo',
            contenido_resumen: String(item.contenido ?? '').slice(0, 800),
          })),
          nota: 'Base de conocimiento: redactar pasos numerados solo con lo que dicen los artículos.',
        };

      case IntentType.COMUNICADOS:
        return {
          total: data.length,
          sin_leer: data.filter((x: any) => !x.leido_por_mi).length,
          muestra: data.slice(0, 5).map((c: any) => ({
            titulo: c.titulo,
            leido: Boolean(c.leido_por_mi),
          })),
        };

      case IntentType.SOLICITUDES: {
        const distribucion_por_tipo: Record<string, number> = {};
        for (const row of data) {
          const t = String((row as any).tipo ?? 'sin tipo');
          distribucion_por_tipo[t] = (distribucion_por_tipo[t] || 0) + 1;
        }
        return {
          total: data.length,
          distribucion_por_tipo,
          muestra: data.slice(0, 8).map((s: any) => ({
            id: s.id ?? null,
            codigo: s.codigo ?? null,
            nombre: s.nombre ?? null,
            tipo: s.tipo ?? null,
            estado: s.estado ?? null,
            fecha_inicio: this.formatRowDate(s.fecha_inicio),
            fecha_fin:
              s.fecha_fin != null && String(s.fecha_fin).trim() !== ''
                ? this.formatRowDate(s.fecha_fin)
                : null,
            tipo_justificante: s.tipo_justificante ?? null,
          })),
          nota: 'Cada fila es una solicitud aprobada o en trámite; el campo tipo distingue vacaciones, bajas, ausencias justificadas, permisos, etc.',
        };
      }

      case IntentType.DOCUMENTOS_SOLICITADOS:
        return {
          total: data.length,
          muestra: data.slice(0, 5).map((d: any) => ({
            tipo_documento: d.tipo_documento,
            estado: d.estado,
          })),
        };

      default:
        // Pentru alte intent-uri, returnăm un rezumat simplu
        return {
          total_registros: data.length,
          muestra: data.slice(0, 5).map((item: any) => {
            const optimized: any = {};
            Object.keys(item)
              .slice(0, 5)
              .forEach((key) => {
                optimized[key] = item[key];
              });
            return optimized;
          }),
          nota: `Mostrando muestra de 5 registros de ${data.length} total.`,
        };
    }
  }

  /**
   * Răspuns fallback când AI nu este disponibil
   */
  private generateFallbackResponse(
    intent: IntentType,
    data: any[] | any | null,
    outputLocale: AssistantLocale = 'es',
  ): string {
    this.logger.warn(`⚠️ Using fallback response for intent: ${intent}`);

    if (intent === IntentType.DESCONOCIDO) {
      if (outputLocale === 'ro') {
        return 'Bună! Sunt asistentul virtual. Te pot ajuta cu pontaje, cuadrante, comenzi materiale (catalog), concedii, cereri, comunicări, fluturași, diplome/certificări, documente inspecție, documente de încărcat și altele. Cu ce te ajut?';
      }
      if (outputLocale === 'en') {
        return 'Hi! I’m your virtual assistant. I can help with clock-ins, schedules, catalogue orders, time off, requests, notices, payslips, diplomas/certifications, inspection docs, pending uploads, and more. What do you need?';
      }
      return '¡Hola! Soy tu asistente virtual. Puedo ayudarte con fichajes, cuadrantes, pedidos de material (catálogo), vacaciones, solicitudes, comunicados, nóminas, diplomas/certificaciones, documentos y más. ¿En qué puedo ayudarte?';
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      const intentMessagesEs: Record<IntentType, string> = {
        [IntentType.FICHAJES]:
          'No se encontraron registros de fichaje para la fecha consultada.',
        [IntentType.CUADRANTE]:
          'No se encontró información del cuadrante para el período consultado.',
        [IntentType.PEDIDOS]:
          'No hay pedidos de material/catálogo registrados para el período consultado.',
        [IntentType.VACACIONES]:
          'No se pudo obtener la información de vacaciones.',
        [IntentType.EMPLEADOS]:
          'No se encontraron empleados que cumplan con los criterios solicitados.',
        [IntentType.NOMINAS]:
          'No se encontraron nóminas para el período consultado.',
        [IntentType.DIPLOMAS]:
          'No hay diplomas ni certificaciones subidos visibles en la consulta.',
        [IntentType.DOCUMENTOS]: 'No se encontraron documentos.',
        [IntentType.DOCUMENTOS_SOLICITADOS]:
          'No hay filas de documentación solicitada en la consulta; puede que no haya pendientes o ya estén completadas. Revisa el módulo correspondiente en la app.',
        [IntentType.SOLICITUDES]:
          'No aparecen solicitudes recientes en la consulta; prueba reformular o revisa Solicitudes en la app.',
        [IntentType.COMUNICADOS]:
          'No hay comunicados publicados recientes en la lista consultada.',
        [IntentType.PROCEDIMIENTOS]:
          'Te guío con pasos generales: abre el menú de la app, busca Solicitudes o Cuadrantes según el tema, y si no lo ves reformula o pregunta a administración. (Respuesta sin IA.)',
        [IntentType.INCIDENCIAS]: 'No se pudo procesar tu incidencia.',
        [IntentType.DESCONOCIDO]:
          'No he entendido tu pregunta. Por favor, reformula tu consulta.',
      };
      if (outputLocale === 'ro') {
        const roEmpty: Partial<Record<IntentType, string>> = {
          [IntentType.FICHAJES]:
            'Nu există registre de pontaj pentru data sau perioada cerută.',
          [IntentType.CUADRANTE]:
            'Nu am găsit informații de cuadrante pentru perioada cerută.',
          [IntentType.PEDIDOS]:
            'Nu există comenzi de materiale în perioada cerută.',
          [IntentType.VACACIONES]:
            'Nu am putut obține informații despre concedii pentru această cerere.',
          [IntentType.EMPLEADOS]:
            'Nu există angajați care să îndeplinească criteriile cerute.',
          [IntentType.NOMINAS]: 'Nu există fluturași pentru perioada cerută.',
          [IntentType.DIPLOMAS]:
            'Nu apar diplome sau certificări încărcate în această interogare.',
          [IntentType.DOCUMENTOS]: 'Nu am găsit documente.',
          [IntentType.DOCUMENTOS_SOLICITADOS]:
            'Nu apar cereri de documente în această interogare; poate nu ai nimic în așteptare.',
          [IntentType.SOLICITUDES]:
            'Nu apar solicitări recente; verifică modulul Cereri din app.',
          [IntentType.COMUNICADOS]:
            'Nu sunt comunicări publicate în lista consultată.',
          [IntentType.PROCEDIMIENTOS]:
            'Îți explic pe scurt: din meniul aplicației caută Solicitări sau Cuadrante după subiect; dacă nu găsești, reformulează sau întreabă administrarea. (Fără IA.)',
          [IntentType.INCIDENCIAS]:
            'Nu s-a putut procesa incidența (fallback fără AI).',
        };
        return (
          roEmpty[intent] ||
          'Nu am găsit date potrivite. Încearcă o altă formulare.'
        );
      }
      if (outputLocale === 'en') {
        const enEmpty: Partial<Record<IntentType, string>> = {
          [IntentType.FICHAJES]:
            'No clock-in/out records for the requested date or period.',
          [IntentType.CUADRANTE]:
            'No schedule information for the requested period.',
          [IntentType.PEDIDOS]:
            'No catalogue/material orders for the requested period.',
          [IntentType.VACACIONES]:
            'No time-off information available for this query.',
          [IntentType.EMPLEADOS]: 'No employees match the requested criteria.',
          [IntentType.NOMINAS]: 'No payslips for the requested period.',
          [IntentType.DIPLOMAS]:
            'No uploaded diplomas or certifications in this query.',
          [IntentType.DOCUMENTOS]: 'No documents found.',
          [IntentType.DOCUMENTOS_SOLICITADOS]:
            'No pending document requests in this query; check the app or HR.',
          [IntentType.SOLICITUDES]:
            'No recent requests in this query; check Requests in the app.',
          [IntentType.COMUNICADOS]: 'No published notices in this feed.',
          [IntentType.PROCEDIMIENTOS]:
            'Here are general steps: use the app menu, open Requests or Schedules depending on your topic, and if needed rephrase or ask admin. (Offline.)',
          [IntentType.INCIDENCIAS]:
            'Could not process the incident (offline fallback).',
        };
        return (
          enEmpty[intent] || 'No matching data. Try rephrasing your question.'
        );
      }
      return (
        intentMessagesEs[intent] ||
        'No se encontraron datos para tu consulta. Por favor, intenta reformular tu pregunta.'
      );
    }

    const n = Array.isArray(data) ? data.length : 1;
    if (outputLocale === 'ro') {
      const roWith: Partial<Record<IntentType, string>> = {
        [IntentType.FICHAJES]: `S-au găsit ${n} înregistrări de pontaj.`,
        [IntentType.EMPLEADOS]: `S-au găsit ${n} angajați în listă.`,
        [IntentType.NOMINAS]: `S-au găsit ${n} fluturași.`,
        [IntentType.DIPLOMAS]: `S-au găsit ${n} diplome/certificări încărcate.`,
        [IntentType.PEDIDOS]: `S-au găsit ${n} comenzi de materiale.`,
        [IntentType.DOCUMENTOS]: `S-au găsit ${n} documente.`,
        [IntentType.DOCUMENTOS_SOLICITADOS]: `S-au găsit ${n} cereri de documente.`,
        [IntentType.SOLICITUDES]: `S-au găsit ${n} solicitări.`,
        [IntentType.COMUNICADOS]: `S-au găsit ${n} comunicări.`,
      };
      return (
        roWith[intent] ||
        `Am găsit ${n} rezultat(e). (Rezumat fără AI — activează OpenAI pentru formulare completă.)`
      );
    }
    if (outputLocale === 'en') {
      return `Found ${n} record(s). (Brief fallback without AI.)`;
    }

    const intentMessages: Record<IntentType, string> = {
      [IntentType.FICHAJES]: `Se encontraron ${n} registro(s) de fichaje.`,
      [IntentType.CUADRANTE]: `Se encontró información del cuadrante.`,
      [IntentType.PEDIDOS]: `Se encontraron ${n} pedido(s) de material/catálogo.`,
      [IntentType.VACACIONES]: 'Información de vacaciones disponible.',
      [IntentType.EMPLEADOS]: `Se encontraron ${n} empleado(s).`,
      [IntentType.NOMINAS]: `Se encontraron ${n} nómina(s).`,
      [IntentType.DIPLOMAS]: `Se encontraron ${n} diploma(s) / certificación(es) subida(s).`,
      [IntentType.DOCUMENTOS]: `Se encontraron ${n} documento(s).`,
      [IntentType.DOCUMENTOS_SOLICITADOS]: `Hay ${n} registro(s) de documentación solicitada.`,
      [IntentType.SOLICITUDES]: `Hay ${n} solicitud(es) en el listado.`,
      [IntentType.COMUNICADOS]: `Hay ${n} comunicado(s) en el listado.`,
      [IntentType.PROCEDIMIENTOS]: 'Información de procedimientos disponible.',
      [IntentType.INCIDENCIAS]: 'Incidencia registrada.',
      [IntentType.DESCONOCIDO]: 'Procesando tu consulta...',
    };
    return intentMessages[intent] || 'Procesando tu consulta...';
  }
}
