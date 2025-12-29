import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IntentType } from './intent-classifier.service';

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

    this.logger.log(`🔍 OpenAI initialization check - API key present: ${!!apiKey}, length: ${apiKey?.length || 0}`);
    if (apiKey) {
      this.logger.log(`🔍 API key preview: ${apiKey.substring(0, 15)}...`);
    }

    if (this.isEnabled) {
      try {
        this.openai = new OpenAI({
          apiKey: apiKey,
          timeout: 30000, // 30 secunde timeout pentru răspunsuri cu date mari
        });
        this.logger.log(`✅ OpenAI service initialized (API key: ${apiKey.substring(0, 10)}...)`);
      } catch (error: any) {
        this.logger.error(`❌ Error initializing OpenAI: ${error.message}`);
        this.isEnabled = false;
      }
    } else {
      this.logger.warn('⚠️ OPENAI_API_KEY not found in environment, AI responses will be disabled');
      this.logger.warn('⚠️ Make sure OPENAI_API_KEY is set in .env file and backend is restarted');
      this.logger.warn(`⚠️ process.env.OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'exists' : 'not found'}`);
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
  ): Promise<string> {
    if (!this.isEnabled || !this.openai) {
      this.logger.warn(`⚠️ OpenAI not enabled or not initialized. isEnabled: ${this.isEnabled}, openai: ${!!this.openai}`);
      return this.generateFallbackResponse(intent, data);
    }

    try {
      // Construiește context-ul pentru AI
      this.logger.log(`🤖 Generating AI response for intent: ${intent}`);
      const systemPrompt = this.buildSystemPrompt(intent, usuarioRol);
      const userPrompt = this.buildUserPrompt(mensaje, intent, data, confianza);

      this.logger.debug(`📝 System prompt length: ${systemPrompt.length}, User prompt length: ${userPrompt.length}`);

      // Adaugă timeout pentru apelul OpenAI (10 secunde)
      const completionPromise = this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Model mai economic
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      // Timeout de 30 secunde pentru răspunsuri cu date mari
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout after 30 seconds')), 30000);
      });

      const completion = await Promise.race([completionPromise, timeoutPromise]);

      const response = completion.choices[0]?.message?.content?.trim();
      if (response) {
        this.logger.log(`✅ AI response generated successfully (${response.length} chars)`);
        return response;
      }

      this.logger.warn('⚠️ AI response is empty, using fallback');
      return this.generateFallbackResponse(intent, data);
    } catch (error: any) {
      this.logger.error(`❌ Error generating AI response: ${error.message}`, error.stack);
      return this.generateFallbackResponse(intent, data);
    }
  }

  /**
   * Generează un mesaj care cere clarificare când nu avem suficiente informații
   */
  async generateClarificationRequest(
    intent: IntentType,
    mensaje: string,
    usuarioRol: string | null,
  ): Promise<string> {
    if (!this.isEnabled || !this.openai) {
      // Fallback manual dacă AI nu e disponibil
      return this.generateFallbackClarification(intent);
    }

    try {
      const systemPrompt = `Eres un asistente virtual profesional. Tu tarea es pedir aclaraciones cuando no tienes suficiente información para responder una consulta. Sé amigable, claro y ofrece ejemplos concretos de cómo el usuario puede reformular su pregunta.`;

      const clarificationPrompts: Record<IntentType, string> = {
        [IntentType.FICHAJES]: `El usuario pregunta sobre fichajes pero no ha especificado una fecha o período. Necesitas pedirle que especifique:
- ¿De qué fecha necesita los registros? (ej: "hoy", "ayer", "15/12/2025")
- ¿De qué período? (ej: "este mes", "diciembre", "la semana pasada")
- ¿De qué empleado específico? (si aplica)

Ofrece ejemplos claros de cómo puede reformular su pregunta.`,
        [IntentType.CUADRANTE]: `El usuario pregunta sobre cuadrantes pero no ha especificado un período. Necesitas pedirle que especifique el mes o período que necesita.`,
        [IntentType.VACACIONES]: `El usuario pregunta sobre vacaciones. Si no está claro, pregunta si necesita información sobre su saldo, solicitudes, o algo específico.`,
        [IntentType.EMPLEADOS]: `El usuario pregunta sobre empleados. Si no está claro, pregunta qué información específica necesita (listado completo, empleados sin cuadrante, sin horario, sin centro, etc.).`,
        [IntentType.NOMINAS]: `El usuario pregunta sobre nóminas pero no ha especificado el mes o período. Necesitas pedirle que especifique qué mes necesita.`,
        [IntentType.DOCUMENTOS]: `El usuario pregunta sobre documentos pero no está claro qué tipo de documento necesita. Pide aclaración.`,
        [IntentType.PROCEDIMIENTOS]: `El usuario pregunta sobre procedimientos pero no está claro qué procedimiento específico necesita. Pide aclaración.`,
        [IntentType.INCIDENCIAS]: `El usuario reporta una incidencia. Si no está claro, pide más detalles sobre el problema.`,
        [IntentType.DESCONOCIDO]: `El usuario hace una pregunta pero no está claro qué necesita. Ofrece ayuda sobre qué puedes hacer.`,
      };

      const userPrompt = `El usuario preguntó: "${mensaje}"

${clarificationPrompts[intent]}

Genera una respuesta amigable que pida aclaración y ofrezca ejemplos concretos de cómo puede reformular su pregunta.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (response) {
        this.logger.log(`✅ Clarification request generated successfully`);
        return response;
      }

      return this.generateFallbackClarification(intent);
    } catch (error: any) {
      this.logger.error(`❌ Error generating clarification request: ${error.message}`);
      return this.generateFallbackClarification(intent);
    }
  }

  /**
   * Fallback pentru clarificare când AI nu e disponibil
   */
  private generateFallbackClarification(intent: IntentType): string {
    const clarifications: Record<IntentType, string> = {
      [IntentType.FICHAJES]: `Para poder ayudarte con los registros de fichaje, necesito que especifiques:\n\n` +
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
      [IntentType.VACACIONES]: `Para ayudarte con las vacaciones, ¿necesitas información sobre tu saldo, solicitudes pendientes, o algo específico?`,
      [IntentType.EMPLEADOS]: `Para ayudarte con el listado de empleados, ¿necesitas información sobre todos los empleados, o empleados específicos (sin cuadrante, sin horario, sin centro, etc.)?`,
      [IntentType.NOMINAS]: `Para ayudarte con las nóminas, necesito que especifiques el mes que necesitas (ej: "nómina de diciembre").`,
      [IntentType.DOCUMENTOS]: `Para ayudarte con los documentos, ¿qué tipo de documento necesitas?`,
      [IntentType.PROCEDIMIENTOS]: `Para ayudarte con los procedimientos, ¿qué procedimiento específico necesitas?`,
      [IntentType.INCIDENCIAS]: `Para ayudarte con la incidencia, ¿puedes darme más detalles sobre el problema?`,
      [IntentType.DESCONOCIDO]: `No estoy seguro de qué necesitas. Puedo ayudarte con fichajes, cuadrantes, vacaciones, nóminas, documentos y más. ¿En qué puedo ayudarte específicamente?`,
    };

    return clarifications[intent] || clarifications[IntentType.DESCONOCIDO];
  }

  /**
   * Construiește system prompt bazat pe intent și rol
   */
  private buildSystemPrompt(intent: IntentType, usuarioRol: string | null): string {
    const rolContext = usuarioRol?.toLowerCase().includes('admin') || 
                       usuarioRol?.toLowerCase().includes('supervisor') ||
                       usuarioRol?.toLowerCase().includes('manager') ||
                       usuarioRol?.toLowerCase().includes('developer')
      ? 'Eres un asistente para administradores/supervisores con acceso total a los datos.'
      : 'Eres un asistente para empleados que solo puede acceder a sus propios datos.';

    const intentContexts: Record<IntentType, string> = {
      [IntentType.FICHAJES]: 'El usuario pregunta sobre fichajes (registros de entrada/salida) o empleados que deberían haber fichado pero no lo hicieron. Responde de forma clara y concisa. Si hay empleados sin cuadrante, horario o centro asignado, menciona claramente qué les falta (ej: "Sin cuadrante asignado", "Sin horario asignado", "Sin centro asignado"). Si hay muchos registros (>10), menciona que puede descargar los datos completos en Excel, TXT o PDF usando los botones de descarga.',
      [IntentType.CUADRANTE]: 'El usuario pregunta sobre cuadrantes (horarios de trabajo). Responde de forma clara y concisa. Si hay muchos registros, menciona que puede descargar los datos completos.',
      [IntentType.VACACIONES]: 'El usuario pregunta sobre vacaciones o asuntos propios. Responde de forma clara y concisa.',
      [IntentType.EMPLEADOS]: 'El usuario pregunta sobre un listado de empleados con su estado, cuadrantes, horarios y centros asignados. Presenta la información de forma clara y organizada. Si hay muchos empleados (>10), menciona que puede descargar los datos completos en Excel, TXT o PDF usando los botones de descarga.',
      [IntentType.NOMINAS]: 'El usuario pregunta sobre nóminas (payslips). Responde de forma clara y concisa. Si hay muchas nóminas, menciona que puede descargar los datos completos.',
      [IntentType.DOCUMENTOS]: 'El usuario pregunta sobre documentos. Responde de forma clara y concisa.',
      [IntentType.PROCEDIMIENTOS]: 'El usuario pregunta sobre procedimientos o cómo hacer algo. Responde de forma clara y concisa.',
      [IntentType.INCIDENCIAS]: 'El usuario reporta una incidencia o problema. Responde de forma empática y profesional.',
      [IntentType.DESCONOCIDO]: 'El usuario hace una pregunta general o saludo. Responde de forma amigable y profesional. Si no entiendes la pregunta, ofrece ayuda sobre qué puedes hacer.',
    };

    return `${rolContext}\n\n${intentContexts[intent]}\n\nResponde SIEMPRE en español, de forma natural y profesional. No uses emojis en exceso. Si hay datos, preséntalos de forma clara. Si hay muchos registros, menciona brevemente que puede descargar los datos completos.`;
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
  ): string {
    let prompt = `Pregunta del usuario: "${mensaje}"\n\n`;
    prompt += `Intent detectado: ${intent} (confianza: ${(confianza * 100).toFixed(0)}%)\n\n`;

    if (data) {
      if (Array.isArray(data) && data.length > 0) {
        // Pentru array-uri mari (>10), generăm un rezumat/statistici
        if (data.length > 10) {
          const summary = this.generateDataSummary(intent, data);
          prompt += `Resumen de datos encontrados (${data.length} registro(s) total):\n${JSON.stringify(summary, null, 2)}\n\n`;
          prompt += `IMPORTANTE: Hay ${data.length} registros en total. Menciona brevemente que el usuario puede descargar todos los datos completos en Excel, TXT o PDF usando los botones de descarga que aparecerán. `;
          prompt += `Genera una respuesta natural y profesional en español basada en este resumen. Incluye el número total de registros y los detalles más relevantes.`;
        } else {
          // Pentru array-uri mici, trimitem datele optimizate
          const optimizedData = data.map((item: any) => {
            const optimized: any = {};
            // Păstrează doar câmpurile esențiale
            // Nume: verifică multiple variante (fichajes, solicitudes, etc.)
            if (item.nombre_apellidos || item['NOMBRE / APELLIDOS'] || item.nombre) {
              optimized.nombre = item.nombre_apellidos || item['NOMBRE / APELLIDOS'] || item.nombre;
            }
            if (item.CODIGO || item.codigo) optimized.codigo = item.CODIGO || item.codigo;
            if (item.TIPO || item.tipo) optimized.tipo = item.TIPO || item.tipo;
            if (item.HORA || item.hora) optimized.hora = item.HORA || item.hora;
            if (item.FECHA || item.fecha || item.fecha_inicio) optimized.fecha = item.FECHA || item.fecha || item.fecha_inicio;
            if (item.fecha_fin) optimized.fecha_fin = item.fecha_fin;
            if (item.estado) optimized.estado = item.estado;
            if (item.email) optimized.email = item.email;
            if (item.motivo) optimized.motivo = item.motivo;
            // Pentru fichajes faltantes: include detalii despre ce lipsește
            if (item.detalles_faltantes) optimized.detalles_faltantes = item.detalles_faltantes;
            if (item.fuente) optimized.fuente = item.fuente;
            if (item.horas_plan !== undefined) optimized.horas_plan = item.horas_plan;
            if (item.centro) optimized.centro = item.centro;
            // Pentru listado empleados: include toate câmpurile relevante
            if (item.estado) optimized.estado = item.estado;
            if (item.tiene_cuadrante) optimized.tiene_cuadrante = item.tiene_cuadrante;
            if (item.tiene_horario) optimized.tiene_horario = item.tiene_horario;
            if (item.tiene_centro) optimized.tiene_centro = item.tiene_centro;
            if (item.grupo) optimized.grupo = item.grupo;
            return optimized;
          });
          
          prompt += `Datos encontrados (${data.length} registro(s)):\n${JSON.stringify(optimizedData, null, 2)}\n\n`;
          if (data.length > 10) {
            prompt += `IMPORTANTE: Hay ${data.length} registros en total. Menciona brevemente que el usuario puede descargar todos los datos completos en Excel, TXT o PDF usando los botones de descarga que aparecerán. `;
          }
          prompt += `Genera una respuesta natural y profesional en español basada en los datos proporcionados.`;
        }
      } else if (typeof data === 'object' && Object.keys(data).length > 0) {
        prompt += `Datos encontrados:\n${JSON.stringify(data, null, 2)}\n\n`;
        prompt += `Genera una respuesta natural y profesional en español basada en los datos proporcionados.`;
      } else {
        prompt += `No se encontraron datos para esta consulta.\n\n`;
        prompt += `Explica amablemente que no se encontró información.`;
      }
    } else {
      prompt += `No se encontraron datos para esta consulta.\n\n`;
      prompt += `Explica amablemente que no se encontró información.`;
    }

    return prompt;
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
          const nombre = item.nombre_apellidos || item['NOMBRE / APELLIDOS'] || 'N/A';
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
        const sampleEmpleados = Array.from(empleadosMap.values()).slice(0, 5).map(emp => ({
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

      case IntentType.CUADRANTE:
        return {
          total_registros: data.length,
          muestra: data.slice(0, 3).map((item: any) => ({
            nombre: item.nombre_apellidos || item['NOMBRE / APELLIDOS'] || 'N/A',
            fecha: item.FECHA || item.fecha || 'N/A',
            horas: item.HORAS || item.horas || 'N/A',
          })),
          nota: `Mostrando muestra de 3 registros de ${data.length} total.`,
        };

      case IntentType.NOMINAS:
        return {
          total_registros: data.length,
          muestra: data.slice(0, 3).map((item: any) => ({
            nombre: item.nombre_apellidos || item['NOMBRE / APELLIDOS'] || 'N/A',
            mes: item.MES || item.mes || 'N/A',
            año: item.AÑO || item.año || 'N/A',
          })),
          nota: `Mostrando muestra de 3 registros de ${data.length} total.`,
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

      default:
        // Pentru alte intent-uri, returnăm un rezumat simplu
        return {
          total_registros: data.length,
          muestra: data.slice(0, 5).map((item: any) => {
            const optimized: any = {};
            Object.keys(item).slice(0, 5).forEach(key => {
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
  private generateFallbackResponse(intent: IntentType, data: any[] | any | null): string {
    this.logger.warn(`⚠️ Using fallback response for intent: ${intent}`);
    
    if (intent === IntentType.DESCONOCIDO) {
      return '¡Hola! Soy tu asistente virtual. Puedo ayudarte con consultas sobre fichajes, cuadrantes, vacaciones, nóminas, documentos y más. ¿En qué puedo ayudarte?';
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      const intentMessages: Record<IntentType, string> = {
        [IntentType.FICHAJES]: 'No se encontraron registros de fichaje para la fecha consultada.',
        [IntentType.CUADRANTE]: 'No se encontró información del cuadrante para el período consultado.',
        [IntentType.VACACIONES]: 'No se pudo obtener la información de vacaciones.',
        [IntentType.EMPLEADOS]: 'No se encontraron empleados que cumplan con los criterios solicitados.',
        [IntentType.NOMINAS]: 'No se encontraron nóminas para el período consultado.',
        [IntentType.DOCUMENTOS]: 'No se encontraron documentos.',
        [IntentType.PROCEDIMIENTOS]: 'No se encontraron artículos de procedimientos.',
        [IntentType.INCIDENCIAS]: 'No se pudo procesar tu incidencia.',
        [IntentType.DESCONOCIDO]: 'No he entendido tu pregunta. Por favor, reformula tu consulta.',
      };
      return intentMessages[intent] || 'No se encontraron datos para tu consulta. Por favor, intenta reformular tu pregunta.';
    }

    // Pentru intent-uri cunoscute cu date, folosim ResponseGeneratorService
    // Dar aici returnăm un mesaj temporar până când AI este disponibil
    const intentMessages: Record<IntentType, string> = {
      [IntentType.FICHAJES]: `Se encontraron ${Array.isArray(data) ? data.length : 1} registro(s) de fichaje.`,
      [IntentType.CUADRANTE]: `Se encontró información del cuadrante.`,
      [IntentType.VACACIONES]: 'Información de vacaciones disponible.',
      [IntentType.EMPLEADOS]: `Se encontraron ${Array.isArray(data) ? data.length : 1} empleado(s).`,
      [IntentType.NOMINAS]: `Se encontraron ${Array.isArray(data) ? data.length : 1} nómina(s).`,
      [IntentType.DOCUMENTOS]: `Se encontraron ${Array.isArray(data) ? data.length : 1} documento(s).`,
      [IntentType.PROCEDIMIENTOS]: 'Información de procedimientos disponible.',
      [IntentType.INCIDENCIAS]: 'Incidencia registrada.',
      [IntentType.DESCONOCIDO]: 'Procesando tu consulta...',
    };
    return intentMessages[intent] || 'Procesando tu consulta...';
  }
}

