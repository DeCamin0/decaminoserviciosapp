import { Injectable, Logger } from '@nestjs/common';
import {
  extractNaturalPeriodEntityPatch,
  extractProximosDiasCount,
  extractRelativeDayIso,
  extractSpanishMonthFromText,
  hasRelativeDayKeyword,
  looksLikeShortTemporalFollowUp,
  normalizeForMatch,
} from '../utils/month-and-relative-dates.util';
import {
  looksLikeDetailOrReformulationFollowUp,
  looksLikeNominaTopicLex,
} from '../utils/follow-up-detail.util';

export enum IntentType {
  FICHAJES = 'fichajes',
  CUADRANTE = 'cuadrante',
  /** Pedidos de material / catálogo (PedidosTodos), no confundir con „pedir vacaciones”. */
  PEDIDOS = 'pedidos',
  VACACIONES = 'vacaciones',
  /** Cereri din `solicitudes` (toate tipurile), nu doar vacanțe pe lună. */
  SOLICITUDES = 'solicitudes',
  NOMINAS = 'nominas',
  /** Diplomas / certificaciones subidas en la app (tabla `diplomas`). */
  DIPLOMAS = 'diplomas',
  DOCUMENTOS = 'documentos',
  /** Cereri de documente către angajat (`documentos_solicitados`). */
  DOCUMENTOS_SOLICITADOS = 'documentos_solicitados',
  COMUNICADOS = 'comunicados',
  PROCEDIMIENTOS = 'procedimientos',
  INCIDENCIAS = 'incidencias',
  EMPLEADOS = 'empleados',
  DESCONOCIDO = 'desconocido',
}

export interface IntentResult {
  intent: IntentType;
  confianza: number;
  entidades?: {
    codigo?: string;
    nombre?: string;
    fecha?: string;
    mes?: string;
    /** An calendaristic (YYYY), ex. perioadă „anul acesta” */
    year?: string;
    tipo?: string;
    filtro?: string;
    /** Filtru solicitudes: doar în așteptare / pendiente. */
    soloPendientes?: boolean;
    /** „Próximos N días” / next N days — fereastră de la CURDATE() (inclusiv). */
    proximos_dias?: number;
    /** Centru de lucru (ex. „quién trabaja hoy en Bosquepino”) — filtru pe `CENTRO TRABAJO`, nu pe nume angajat. */
    centro?: string;
    /** „Listado … hoy por centro” = un bloque por cada centro de trabajo (agrupar respuesta), sin filtrar un solo centro. */
    agrupar_por_centro?: boolean;
    /** Pregunta por empleados sin nómina / falta nómina (consulta anti‑lista genérica). */
    faltan_nominas?: boolean;
  };
}

/** Snapshot minim pentru follow-up contextual (fără cicluri de import). */
export type IntentContextSnapshot = {
  lastIntent: IntentType;
  lastEntities: IntentResult['entidades'] | null;
};

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  /**
   * Clasifică intenția mesajului utilizatorului
   * Returnează intent + confianza (0.0-1.0) + entități extrase
   */
  async classifyIntent(mensaje: string): Promise<IntentResult> {
    const mensajeLower = mensaje.toLowerCase().trim();

    // Patrones pentru fiecare intenție
    const patterns = {
      [IntentType.FICHAJES]: [
        'fichaje',
        'fichajes',
        'fichar',
        'puntuar',
        'pontaj',
        'pontaje',
        'marcaj',
        'marcaje',
        'entrada',
        'salida',
        'horas trabajadas',
        'ore lucrate',
        'registro',
        'registros',
        'registre',
        'registrele',
        'ce registre',
        'qué registros',
        'registros de hoy',
        'fichajes de hoy',
        'quien ha fichado',
        'quién ha fichado',
        'quien no ha fichado',
        'quién no ha fichado',
        'cine a fichat',
        'cine a punctat',
        'faltan fichar',
        'no ha puntuado',
        'no ha fichado',
        'quien',
        'quién',
        'cine',
        'ha fichado',
        'han fichado',
        'fichado hoy',
        'tenia que trabajar',
        'tenía que trabajar',
        'deberia trabajar',
        'debería trabajar',
        'no ha registrado fichaje',
        'no ha registrado el fichaje',
        'falta fichar',
        'según cuadrante',
        'según horario',
        'según los cuadrantes',
        'según el horario',
        'empleado que tenia que trabajar',
        'empleados que tenian que trabajar',
      ],
      [IntentType.CUADRANTE]: [
        'cuadrante',
        'turno',
        'turnos',
        'horario',
        'horarios',
        'horario de hoy',
        'mi horario',
        'mi horario hoy',
        'trabajo hoy',
        'tengo turno',
        'tengo turno hoy',
        'planificación',
        'cuando es mi turno',
        'proximo turno',
        'mi cuadrante',
        'orar',
        'orarul',
        'program',
        'programul',
        'tura',
        'tură',
        'lucrez',
        'schimb',
        'care e orarul',
        'ce program',
        'am tura',
        'orarul pentru',
      ],
      [IntentType.PEDIDOS]: [
        'pedidos',
        'pedido hecho',
        'pedidos hechos',
        'mi pedido',
        'mis pedidos',
        'hice un pedido',
        'hice pedido',
        'material pedido',
        'suministro',
        'catálogo',
        'catalogo',
        'albarán',
        'albaran',
        'comanda',
        'comenzile',
        'comenzi',
        'articulos pedido',
        'artículos pedido',
        'empleado pedidos',
        'sección pedidos',
        'seccion pedidos',
      ],
      [IntentType.VACACIONES]: [
        'vacaciones',
        'vacacion',
        'vacanta',
        'vacanță',
        'vacante',
        'concediu',
        'concedii',
        'libre',
        'dias de vacaciones',
        'zile de concediu',
        'dias restantes',
        'solicitud de vacaciones',
        'solicitud de vacacion',
        'solicitudes de vacaciones',
        'cereri concediu',
        'pedida',
        'esta pedida',
        'asuntos propios',
        'dias disponibles',
        'cuantos dias me quedan',
        'câte zile',
        'balance de vacaciones',
        'saldo vacaciones',
      ],
      [IntentType.NOMINAS]: [
        'nomina',
        'nómina',
        'nominas',
        'nóminas',
        'nomine',
        'nominele',
        'nominile',
        'fluturas',
        'fluturași',
        'fluturasi',
        'salario',
        'sueldo',
        'paga',
        'pago nomina',
        'tengo nomina',
        'nomina de',
        'descargar nomina',
        'nóminas subidas',
        'nominas subidas',
        'falta nomina',
        'falta nómina',
        'faltan nominas',
        'sin nomina',
        'sin nómina',
        'sin nominas',
        'empleado sin nomina',
        'empleados sin nomina',
        'no tiene nomina',
        'no tienen nomina',
      ],
      [IntentType.DIPLOMAS]: [
        'diploma',
        'diplomas',
        'diplome',
        'certificacion',
        'certificación',
        'certificaciones',
        'certificado subido',
        'titulo subido',
        'título subido',
        'formacion completada',
        'prl subido',
        'diploma en la app',
        'diploma en aplicacion',
        'diploma en aplicación',
        'diplomas en la app',
        'quien tiene diploma',
        'quién tiene diploma',
        'cine are diploma',
        'training certificate',
      ],
      [IntentType.DOCUMENTOS]: [
        'documento',
        'documentos',
        'pdf',
        'archivo',
        'descargar',
        'mis documentos',
        'documentos personales',
        'inspeccion',
        'inspección',
        'inspecciones',
        'documentos de inspeccion',
        'documentos inspección',
      ],
      [IntentType.DOCUMENTOS_SOLICITADOS]: [
        'documentos solicitados',
        'documentación pendiente',
        'documentacion pendiente',
        'me falta documento',
        'me faltan documentos',
        'documente lipsesc',
        'documente lipsă',
        'falta subir documento',
        'faltan documentos por subir',
        'pendiente de documentación',
        'solicitud de documento',
      ],
      [IntentType.COMUNICADOS]: [
        'comunicado',
        'comunicados',
        'anuncio',
        'anuncios',
        'circular',
        'circulares',
        'novedades internas',
        'noutăți',
        'noutati',
        'comunicări',
        'comunicari',
        'am comunicări',
        'hay comunicados',
      ],
      [IntentType.SOLICITUDES]: [
        'mis solicitudes',
        'cererile mele',
        'cererile mele de',
        'toate cererile',
        'todas mis solicitudes',
        'solicitudes pendientes',
        'cereri in asteptare',
        'cereri în așteptare',
        'estado de mis solicitudes',
        'estado solicitud',
        'solicitudes en curso',
        'cereri aprobate',
        'solicitudes aprobadas',
        'justificante',
        'justificantes',
        'ausencias',
        'ausencia',
        'faltas',
        'bajas',
        'absenta',
        'absente',
        'absențe',
        'previstas',
        'previstos',
        'who is on leave',
        'who has vacation',
      ],
      [IntentType.PROCEDIMIENTOS]: [
        'procedimiento',
        'procedimientos',
        'como hacer',
        'como usar',
        'cómo usar',
        'como uso',
        'cómo uso',
        'como ver',
        'cómo ver',
        'como puedo',
        'cómo puedo',
        'donde encuentro',
        'dónde encuentro',
        'donde veo',
        'dónde veo',
        'donde esta',
        'dónde está',
        'pasos para',
        'guia',
        'guía',
        'manual',
        'instrucciones',
        'ayuda con',
        'utilizare aplicatie',
        'utilizarea aplicatiei',
        'cum fac',
        'cum pot',
        'cum folosesc',
        'unde gasesc',
        'unde găsesc',
        'cum cer',
        'cum sa cer',
        'cum să cer',
        'cum solicit',
        'pas cu pas',
        // App-help / datos personales (ETAPA 1): evitar DESCONOCIDO + no_data genérico
        'datos personales',
        'mis datos',
        'mi perfil',
        'direccion',
        'dirección',
        'domicilio',
        'mi casa',
        'no me deja',
        'no me deja guardar',
        'no puedo guardar',
        'no puedo cambiar',
        'donde estan mis datos',
        'dónde están mis datos',
        'donde edito',
        'dónde edito',
        'como cambio mi telefono',
        'cómo cambio mi teléfono',
        'como cambio mi direccion',
        'cómo cambio mi dirección',
        'quiero poner',
        'actualizar mis datos',
        'editar datos',
      ],
      [IntentType.INCIDENCIAS]: [
        'incidencia',
        'reportar incidencia',
        'reportar una incidencia',
        'problema con la aplicacion',
        'problema con la aplicación',
        'no funciona la app',
        'no funciona la aplicacion',
        'no funciona la aplicación',
        'reportar',
        'abrir ticket',
        'crear ticket',
        'fallo en',
        'fallo de',
        'error al usar',
        'error con la app',
      ],
      [IntentType.EMPLEADOS]: [
        'listado de empleados',
        'lista de empleados',
        'lista angajatilor',
        'listă angajați',
        'angajatii mei',
        'angajații mei',
        'angajatii mele',
        'subordonati',
        'subordonați',
        'echipa mea',
        'mis empleados',
        'los empleados',
        'todos los empleados',
        'empleados con',
        'empleados sin',
        'estado de empleados',
        'empleados que no tiene',
        'empleados que no tienen',
        'empleado que no tiene',
        'empleado que no tienen',
        'me puedes sacar los empleados',
        'puedes sacar los empleados',
        'sacar los empleados',
        'mostrar los empleados',
        'cuadrante asignado',
        'horario asignado',
        'centro asignado',
        'tiene cuadrante',
        'tiene horario',
        'tiene centro',
        'no tiene cuadrante',
        'no tiene horario',
        'no tiene centro',
        'sin cuadrante',
        'sin horario',
        'sin centro',
        'le falta centro',
        'falta centro',
        'falta centro de trabajo',
        'listado completo',
        'información de empleados',
        'my employees',
        'our employees',
        'mi contrato',
        'contrato laboral',
      ],
    };

    const matches: Record<IntentType, number> = {
      [IntentType.FICHAJES]: 0,
      [IntentType.CUADRANTE]: 0,
      [IntentType.PEDIDOS]: 0,
      [IntentType.VACACIONES]: 0,
      [IntentType.NOMINAS]: 0,
      [IntentType.DIPLOMAS]: 0,
      [IntentType.DOCUMENTOS]: 0,
      [IntentType.DOCUMENTOS_SOLICITADOS]: 0,
      [IntentType.COMUNICADOS]: 0,
      [IntentType.SOLICITUDES]: 0,
      [IntentType.PROCEDIMIENTOS]: 0,
      [IntentType.INCIDENCIAS]: 0,
      [IntentType.EMPLEADOS]: 0,
      [IntentType.DESCONOCIDO]: 0,
    };

    this.applyPriorityScores(mensaje, matches);

    let bestMatch: IntentType = IntentType.DESCONOCIDO;
    let maxMatches = 0;
    for (const it of Object.values(IntentType)) {
      if (it === IntentType.DESCONOCIDO) {
        continue;
      }
      if (matches[it] > maxMatches) {
        maxMatches = matches[it];
        bestMatch = it;
      }
    }

    // Verifică pattern-uri compuse (mai precise)
    // "quién/quien" + "fichado" → FICHAJES
    if (
      (mensajeLower.includes('quién') || mensajeLower.includes('quien')) &&
      (mensajeLower.includes('fichado') || mensajeLower.includes('fichar'))
    ) {
      matches[IntentType.FICHAJES] += 3; // Bonus pentru pattern compus
      if (matches[IntentType.FICHAJES] > maxMatches) {
        maxMatches = matches[IntentType.FICHAJES];
        bestMatch = IntentType.FICHAJES;
      }
    }

    // "empleados" + "cuadrante/horario/centro" → EMPLEADOS (prioritate)
    // Excepción: temas de nómina (falta nomina / sin nomina / nominas) → no forzar EMPLEADOS
    const nominaContextLex =
      mensajeLower.includes('nomina') ||
      mensajeLower.includes('nómina') ||
      mensajeLower.includes('nominas') ||
      mensajeLower.includes('nóminas') ||
      mensajeLower.includes('nomine') ||
      mensajeLower.includes('flutura') ||
      mensajeLower.includes('salario') ||
      mensajeLower.includes('sueldo') ||
      /\bpaga\b/.test(mensajeLower);
    if (
      (mensajeLower.includes('empleados') ||
        mensajeLower.includes('empleado')) &&
      !nominaContextLex
    ) {
      if (
        mensajeLower.includes('cuadrante') ||
        mensajeLower.includes('horario') ||
        mensajeLower.includes('centro') ||
        mensajeLower.includes('centro de trabajo') ||
        mensajeLower.includes('no tiene') ||
        mensajeLower.includes('sin ') ||
        mensajeLower.includes('le falta') ||
        mensajeLower.includes('falta')
      ) {
        matches[IntentType.EMPLEADOS] += 5; // Bonus mare pentru pattern compus
        if (matches[IntentType.EMPLEADOS] > maxMatches) {
          maxMatches = matches[IntentType.EMPLEADOS];
          bestMatch = IntentType.EMPLEADOS;
        }
      }
    }

    // Verifică pattern-uri simple
    for (const [intent, keywords] of Object.entries(patterns)) {
      for (const keyword of keywords) {
        if (mensajeLower.includes(keyword)) {
          matches[intent as IntentType]++;
          if (matches[intent as IntentType] > maxMatches) {
            maxMatches = matches[intent as IntentType];
            bestMatch = intent as IntentType;
          }
        }
      }
    }

    // Calculează confianza (0.0-1.0)
    // Pentru intent-uri cunoscute, confianza bazată pe numărul de matches
    let confianza = 0.1;

    if (bestMatch !== IntentType.DESCONOCIDO && maxMatches > 0) {
      // Pentru intent-uri cunoscute, confianza bazată pe matches
      // 1 match = 0.6, 2 matches = 0.75, 3+ matches = 0.9+
      if (maxMatches >= 3) {
        confianza = 0.9;
      } else if (maxMatches === 2) {
        confianza = 0.75;
      } else if (maxMatches === 1) {
        confianza = 0.6;
      }

      // Bonus pentru pattern-uri compuse (deja adăugate în matches)
      if (
        bestMatch === IntentType.FICHAJES &&
        (mensajeLower.includes('quién') || mensajeLower.includes('quien')) &&
        (mensajeLower.includes('fichado') || mensajeLower.includes('fichar'))
      ) {
        confianza = Math.min(confianza + 0.1, 1.0);
      }
    }

    // Extrage entități (codigo, nombre, fecha, mes, tipo)
    const entidades = this.extractEntities(mensaje);

    this.logger.log(
      `🔍 Intent detectado: ${bestMatch} (confianza: ${confianza.toFixed(2)})`,
    );

    return {
      intent: bestMatch,
      confianza,
      entidades,
    };
  }

  /**
   * Reglas de lenguaje natural (RO/ES) con mayor peso que keywords sueltas.
   */
  private applyPriorityScores(
    mensajeOriginal: string,
    matches: Record<IntentType, number>,
  ): void {
    const n = normalizeForMatch(mensajeOriginal);

    /** „¿Quién trabaja hoy en [centro]?” = plan del día por centro (cuadrante/horario), no registros de fichaje. */
    if (/\b(quien|qui[eé]n)\s+trabaja\b/.test(n)) {
      matches[IntentType.CUADRANTE] += 32;
    }

    /** Listado de trabajadores previstos hoy (por centro / plan) → consulta de planificación, no fichajes.
     * Incluye errores frecuentes: «listrado», «previstro», «per centro» (por/por). */
    if (
      /\b(listado|lista|listrado)\b/.test(n) &&
      /\btrabajador/.test(n) &&
      /\bhoy\b/.test(n) &&
      /\b(previsto|previstos|previstro|plan|cuadrante|horario)\b/.test(n)
    ) {
      matches[IntentType.CUADRANTE] += 28;
    }

    const pedidoVacaciones =
      /\b(vacacion|vacaciones|concediu|asuntos\s+propios)\b/.test(n) ||
      /\bpedido\s+de\s+vacaciones\b/.test(n) ||
      /\bpedida\s+de\s+vacaciones\b/.test(n) ||
      /\bhan\s+pedido\s+vacaciones\b/.test(n) ||
      /\bqui[eé]n\s+ha\s+pedido\s+vacaciones\b/.test(n);
    if (
      /\bpedidos?\b/.test(n) &&
      !pedidoVacaciones &&
      (/\b(hecho|hechos|hice|hizo|realizad|pendiente|aprobado|rechazado|material|suministro|mi\s+centro|comunidad|catalogo|catálogo|albaran|albarán|este\s+mes|mes\s+actual)\b/.test(
        n,
      ) ||
        /\b(un|una|algun|algún|algune|vreun)\s+pedid/.test(n) ||
        /\btengo\s+.*pedid/.test(n))
    ) {
      matches[IntentType.PEDIDOS] += 20;
    }

    /**
     * Albarán + subir/mandar/enviar… + cómo/dónde → Pedidos (material), no procedimientos+KB genérico.
     * Incluye: subo, mando, mandar, enviar (usuarios no siempre dicen «subir»).
     */
    if (
      /\b(albaran|albarán)\b/.test(n) &&
      /\b(subir|subo|subimos|adjuntar|adjunto|adjuntamos|cargar|cargo|cargamos|mandar|mando|mandamos|enviar|envio|envío|enviamos)\b/.test(
        n,
      ) &&
      /\b(como|cómo|donde|dónde)\b/.test(n)
    ) {
      matches[IntentType.PEDIDOS] += 45;
    }

    /** Ausencias / faltas / bajas / absențe → tabla `solicitudes`, no saldo de vacaciones. */
    const absencePlanningLex =
      /\b(ausencias?)\b/.test(n) ||
      /\bfaltas\b/.test(n) ||
      /\bbajas\b/.test(n) ||
      /\b(absent\w*|absente|absen[țt]e)\b/.test(n) ||
      /\b(previstas|previstos)\b/.test(n) ||
      /\b(who\s+is\s+on\s+leave|on\s+leave)\b/.test(n);
    if (absencePlanningLex) {
      matches[IntentType.SOLICITUDES] += 24;
    }

    /**
     * Justificantes (ausencias médicas, etc.): lexic comun în app; fără asta → DESCONOCIDO + LLM generic.
     * „Cómo/necesito mandar…” → PROCEDIMIENTOS + KB (prioridad sobre consulta tabular).
     */
    if (/\bjustificante?s?\b/.test(n)) {
      matches[IntentType.SOLICITUDES] += 22;
      if (
        /\b(necesito|quiero|debo|puedo|como|cómo|donde|dónde|mandar|enviar|subir|adjuntar|pasos|instrucciones|guia|guía)\b/.test(
          n,
        )
      ) {
        matches[IntentType.PROCEDIMIENTOS] += 36;
      }
    }

    /** Contrato laboral propio (resumen en DatosEmpleados), no listados de equipo. */
    if (
      /\b(mi|mio|mis|meu)\s+contrato\b/.test(n) ||
      /\b(tipo|horas)\s+(de\s+)?contrato\b/.test(n) ||
      /\bcontrato\s+(laboral|de\s+trabajo)\b/.test(n)
    ) {
      matches[IntentType.EMPLEADOS] += 34;
    }

    /** Diplomas / certificaciones en la app (no confundir con „quien fichó”). */
    if (
      /\bdiploma/.test(n) ||
      /\bcertificacion\b/.test(n) ||
      /\bcertificación\b/.test(n) ||
      /\bcertificaciones\b/.test(n) ||
      /\bcertificaci[oó]n(es)?\s+en\b/.test(n) ||
      /\b(quien|qui[eé]n)\s+tiene\s+.{0,50}diploma/.test(n) ||
      (/\bprl\b/.test(n) &&
        /\b(app|aplicacion|aplicación|plataforma)\b/.test(n))
    ) {
      matches[IntentType.DIPLOMAS] += 34;
    }

    /** Nóminas: prioridad sobre „empleado + falta” genérico. */
    if (
      /\b(falta|faltan)\s+.{0,40}n[oó]mina/.test(n) ||
      /\bsin\s+n[oó]mina/.test(n) ||
      /\bsin\s+nominas\b/.test(n) ||
      /\bsin\s+nóminas\b/.test(n) ||
      /\bemplead\w*\s+sin\s+n[oó]mina/.test(n) ||
      /\bno\s+tienen\s+n[oó]mina/.test(n) ||
      /\bno\s+tiene\s+n[oó]mina/.test(n)
    ) {
      matches[IntentType.NOMINAS] += 38;
    }
    if (
      /\b(nomina|nómina|nominas|nóminas)\b/.test(n) &&
      /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(
        n,
      )
    ) {
      matches[IntentType.NOMINAS] += 26;
    }

    const vacationLexCore =
      /\b(vacacion|vacaciones|vacanta|vacan[țt]a|concediu|concedii|asuntos\s+propios)\b/.test(
        n,
      ) ||
      /\b(invoierire|time\s*off)\b/.test(n) ||
      /\b(pedido\s+de\s+vacaciones|solicitud(es)?\s+de\s+vacacion)\b/.test(n);
    const whoCue = /\b(cine|cineva|quien|quienes|quien\s|qui[eé]n|who)\b/.test(
      n,
    );
    const haveCue = /\b(am|ai|are|au|tiene|tienen|han\s+pedido)\b/.test(n);
    const yearCue =
      /\b(anul\s+asta|anu\s+asta|anul\s+acesta|in\s+acest\s+an)\b/.test(n) ||
      /\b(este\s+ano|este\s+an)\b/.test(n) ||
      /\b(el\s+ano\s+actual|ano\s+actual)\b/.test(n);
    if (vacationLexCore && (whoCue || haveCue)) {
      matches[IntentType.VACACIONES] += 10;
    } else if (
      vacationLexCore &&
      extractSpanishMonthFromText(mensajeOriginal)
    ) {
      matches[IntentType.VACACIONES] += 6;
    } else if (vacationLexCore && yearCue) {
      matches[IntentType.VACACIONES] += 8;
    } else if (vacationLexCore) {
      matches[IntentType.VACACIONES] += 3;
    }

    if (
      /\b(angajat(ii|i)\s+mei|angajatii\s+mei|subordonat|subordinat)/.test(n) ||
      /\b(mis|los)\s+empleados\b/.test(n) ||
      /\b(my|our)\s+employees\b/.test(n) ||
      /\blist(a|ado)\s+(de\s+)?(angajat|emplead)/.test(n)
    ) {
      matches[IntentType.EMPLEADOS] += 9;
    }

    const fichHint =
      /(fichaj|pontaj|registre|registro|marcaj|marcaje|presencia)/.test(n) ||
      /\b(ce|qu[eé])\s+registre/.test(n) ||
      /\b(ce|qu[eé])\s+registros/.test(n);
    const schedLex =
      /\b(orarul|orar|programul|program|tura|schimb|lucrez)\b/.test(n) ||
      /\b(horario|turno|cuadrante)\b/.test(n) ||
      /\b(trabajo\s+hoy|tengo\s+turno|mi\s+horario)\b/.test(n);
    const dayRel = hasRelativeDayKeyword(mensajeOriginal);
    if (schedLex && dayRel) {
      matches[IntentType.CUADRANTE] += 14;
    } else if (schedLex && /\b(meu|me|mi|mis|mine|mio)\b/.test(n)) {
      matches[IntentType.CUADRANTE] += 10;
    } else if (/\b(horario\s+de\s+hoy|mi\s+horario\s+hoy)\b/.test(n)) {
      matches[IntentType.CUADRANTE] += 12;
    }

    if (fichHint) {
      matches[IntentType.FICHAJES] += 6;
    }
    if (fichHint && hasRelativeDayKeyword(mensajeOriginal)) {
      matches[IntentType.FICHAJES] += 5;
    }
    if (schedLex && dayRel && matches[IntentType.FICHAJES] > 0) {
      matches[IntentType.FICHAJES] = Math.max(
        0,
        matches[IntentType.FICHAJES] - 10,
      );
    }

    /** Întrebări „cum / cómo / unde” despre utilizarea aplicației → PROCEDIMIENTOS (KB), nu date live. */
    const appHowToEs =
      /\b(como|cómo)\s+(usar|uso|ver|hacer|puedo|accedo|encuentro|localizo|solicito|pido)\b/.test(
        n,
      ) ||
      /** „Cómo registro la jornada?” = procedimiento (fichar), nu consulta SQL de registros. */
      /\b(como|cómo)\s+(registro|registrar|ficho|fichar|marco|marcar|apunto|apuntar|anoto|anotar)\b/.test(
        n,
      ) ||
      /\b(donde|dónde)\s+(esta|está|encuentro|veo|consigo|abro)\b/.test(n) ||
      /\bcomo\s+usar\b/.test(n);
    const appHowToRo =
      /\b(cum\s+fac|cum\s+pot|cum\s+folosesc|unde\s+gasesc|unde\s+gasesti|cum\s+cer|cum\s+sa\s+cer|cum\s+să\s+cer|cum\s+solicit)\b/.test(
        n,
      ) ||
      /\b(cum\s+(inregistrez|inregistreaza|punctez|marchez|bifez))\b/.test(n);
    if (appHowToEs || appHowToRo) {
      matches[IntentType.PROCEDIMIENTOS] += 16;
    } else if (/(^|\s)cum(\s|$)/.test(n) && n.length <= 96) {
      matches[IntentType.PROCEDIMIENTOS] += 7;
    } else if (/(^|\s)como(\s|$)/.test(n) && n.length <= 96) {
      matches[IntentType.PROCEDIMIENTOS] += 7;
    } else if (/(^|\s)(donde|dónde)(\s|$)/.test(n) && n.length <= 96) {
      matches[IntentType.PROCEDIMIENTOS] += 7;
    }

    if (
      /\b(documentos|documentación|documentacion)\s+(solicitad|pendiente|de\s+subir)\b/.test(
        n,
      ) ||
      /\bdocumente\s+(îmi\s+)?lips(es|ă|a|esc)\b/.test(n) ||
      /\bme\s+faltan\s+documentos\b/.test(n)
    ) {
      matches[IntentType.DOCUMENTOS_SOLICITADOS] += 18;
    }

    if (
      /\b(comunicado|comunicados|anuncio|anuncios)\b/.test(n) &&
      /\b(nuevo|nuevos|nou|noi|sin\s+leer|no\s+le[ií]do|leer)\b/.test(n)
    ) {
      matches[IntentType.COMUNICADOS] += 12;
    }

    if (
      /\b(solicitudes|cereri)\s+(pendientes|in\s+asteptare)\b/.test(n) ||
      /\b(mis|todas\s+mis)\s+solicitudes\b/.test(n) ||
      /\bcereril(e|e)\s+mele\b/.test(n) ||
      /\bestado\s+de\s+mis\s+solicitudes\b/.test(n)
    ) {
      matches[IntentType.SOLICITUDES] += 14;
    }

    /** „documente lipsesc / qué documentos faltan” ≠ absențe (vacLex folosea lipsesc). */
    if (
      /\b(documento|documentos|documente|documentación|documentacion)\b/.test(
        n,
      ) &&
      /\b(lips(es|esc|ă|a)|faltan|falta)\b/.test(n)
    ) {
      matches[IntentType.DOCUMENTOS_SOLICITADOS] += 24;
    }
  }

  /** Para tests y follow-up contextual. */
  extractEntitiesFromMessage(
    mensaje: string,
  ): IntentResult['entidades'] | undefined {
    return this.extractEntities(mensaje);
  }

  /**
   * Reutilizează ultimul intent când mesajul e (1) follow-up temporal scurt sau
   * (2) cerere de listă / detalii / clarificare față de același subiect.
   */
  applyContextualFollowUp(
    mensaje: string,
    res: IntentResult,
    ctx: IntentContextSnapshot | null,
  ): IntentResult {
    if (!ctx?.lastIntent || ctx.lastIntent === IntentType.DESCONOCIDO) {
      return res;
    }
    if (
      res.intent === IntentType.PEDIDOS &&
      res.confianza >= 0.55 &&
      ctx.lastIntent !== IntentType.PEDIDOS
    ) {
      return res;
    }
    const eligible = new Set<IntentType>([
      IntentType.VACACIONES,
      IntentType.SOLICITUDES,
      IntentType.FICHAJES,
      IntentType.CUADRANTE,
      IntentType.PEDIDOS,
      IntentType.NOMINAS,
      IntentType.DIPLOMAS,
      IntentType.EMPLEADOS,
    ]);
    if (!eligible.has(ctx.lastIntent)) {
      return res;
    }

    const temporal = looksLikeShortTemporalFollowUp(mensaje);
    const detailOrRephrase = looksLikeDetailOrReformulationFollowUp(mensaje);
    if (!temporal && !detailOrRephrase) {
      return res;
    }

    if (
      res.intent !== IntentType.DESCONOCIDO &&
      res.confianza >= 0.65 &&
      res.intent !== ctx.lastIntent
    ) {
      return res;
    }

    const fresh = this.extractEntities(mensaje) || {};
    const merged: NonNullable<IntentResult['entidades']> = {
      ...(ctx.lastEntities || {}),
      ...fresh,
    };

    /** Centru nou din mesaj (ex. „maquinilla 13”) trebuie să înlocuiască Bosque Pino din context; dacă întrebarea cere explicit „… en [lugar]” dar nu putem parsa, nu păstra centrul vechi (risc de date greșite). */
    const centroNv = this.extractCentroTrabajoPlace(mensaje);
    if (centroNv) {
      merged.centro = centroNv;
    } else if (
      (ctx.lastIntent === IntentType.CUADRANTE || res.intent === IntentType.CUADRANTE) &&
      /\b(?:qui[eé]n\s+trabaja|trabaja\s+hoy)\b/i.test(mensaje) &&
      /\b(?:en|al)\s+[^\s]{2,}/i.test(mensaje) &&
      ctx.lastEntities?.centro
    ) {
      delete merged.centro;
    }

    const stickyNominasFollowUp =
      ctx.lastIntent === IntentType.NOMINAS &&
      looksLikeNominaTopicLex(mensaje) &&
      res.intent !== IntentType.NOMINAS &&
      res.confianza < 0.75;
    if (stickyNominasFollowUp) {
      return {
        intent: IntentType.NOMINAS,
        confianza: Math.max(res.confianza, 0.82),
        entidades: Object.keys(merged).length > 0 ? merged : res.entidades,
      };
    }

    const weak =
      res.intent === IntentType.DESCONOCIDO ||
      res.confianza < 0.45 ||
      (res.intent !== ctx.lastIntent &&
        res.confianza < 0.65 &&
        (detailOrRephrase || temporal));
    const outIntent = weak ? ctx.lastIntent : res.intent;
    const outConf = weak
      ? Math.max(res.confianza, 0.78)
      : Math.max(res.confianza, 0.72);

    return {
      intent: outIntent,
      confianza: outConf,
      entidades: Object.keys(merged).length > 0 ? merged : res.entidades,
    };
  }

  /**
   * Loc după „en / al” la sfârșitul întrebării (ex. „maquinilla 13”, „Bosque Pino II”).
   * Evită falsuri „en la app”; nu cere ca fiecare token să înceapă cu literă (ex. „13”).
   */
  private extractCentroTrabajoPlace(mensaje: string): string | undefined {
    const trimmed = mensaje.trim();
    /** „quien trabaja … en X” — `.+?` până la ultimul „ en ” ca să nu mănânce „en” din mijlocul propoziției. */
    const mQuien = trimmed.match(
      /\b(?:qui[eé]n\s+trabaja|trabaja)\s+.+?\s+(?:en|al)\s+(.+?)\s*\??\s*$/i,
    );
    const rawFromQuien = mQuien?.[1]?.trim();
    let raw = rawFromQuien?.replace(/[.:;!]+$/g, '').trim() ?? '';
    if (!raw && /\btrabaja\b/i.test(trimmed)) {
      const mEnd = trimmed.match(/\b(?:en|al)\s+(.+?)\s*\??\s*$/is);
      raw = mEnd?.[1]?.trim().replace(/[.:;!]+$/g, '').trim() ?? '';
    }
    if (!raw || raw.length < 2 || raw.length > 80) {
      return undefined;
    }
    const lower = raw.toLowerCase();
    if (/^(la|el|los|las)\s+(app|aplicaci)/i.test(raw)) {
      return undefined;
    }
    if (lower === 'la app' || lower === 'el centro') {
      return undefined;
    }
    if (/^(total|el\s+mismo|este\s+mes|nadie)$/i.test(raw.trim())) {
      return undefined;
    }
    return raw;
  }

  /**
   * Extrage entități din mesaj (codigo, nombre, fecha, mes, tipo)
   */
  private extractEntities(mensaje: string): IntentResult['entidades'] {
    const entidades: IntentResult['entidades'] = {};
    const mensajeLower = mensaje.toLowerCase();

    // Codigo: EMP123 sau codigo:123
    const codigoMatch = mensaje.match(/\b(?:codigo|código|emp)[\s:]*(\w+)\b/i);
    if (codigoMatch) {
      entidades.codigo = codigoMatch[1];
    }

    // Nombre tras horario/cuadrante (ES): "qué horario tiene Anisoara hoy" (una o más palabras)
    const NAME_CHUNK =
      '([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*)';
    const dayWord = 'hoy|ayer|mañana|manana|azi|ieri|maine|mâine';
    const horarioTieneNombre = mensaje.match(
      new RegExp(
        `\\b(?:que|qué)\\s+horario\\s+tiene\\s+(?!${dayWord}\\b)${NAME_CHUNK}\\b`,
        'i',
      ),
    );
    if (horarioTieneNombre) {
      entidades.nombre = horarioTieneNombre[1].trim();
    }
    if (!entidades.nombre) {
      const horarioTieneNombre2 = mensaje.match(
        new RegExp(
          `\\bhorario\\s+tiene\\s+(?!${dayWord}\\b)${NAME_CHUNK}\\b`,
          'i',
        ),
      );
      if (horarioTieneNombre2) {
        entidades.nombre = horarioTieneNombre2[1].trim();
      }
    }
    // "qué horario tiene hoy IORDACHE IONUT ADRIAN" — el día va antes del nombre; sin esto el (?!hoy) bloquea capturar el nombre
    if (!entidades.nombre) {
      const horarioTieneDiaLuegoNombre = mensaje.match(
        new RegExp(
          `\\b(?:que|qué)\\s+horario\\s+tiene\\s+(?:${dayWord})\\s+${NAME_CHUNK}\\b`,
          'i',
        ),
      );
      if (horarioTieneDiaLuegoNombre) {
        entidades.nombre = horarioTieneDiaLuegoNombre[1].trim();
      }
    }
    if (!entidades.nombre) {
      const horarioTieneDiaLuegoNombre2 = mensaje.match(
        new RegExp(
          `\\bhorario\\s+tiene\\s+(?:${dayWord})\\s+${NAME_CHUNK}\\b`,
          'i',
        ),
      );
      if (horarioTieneDiaLuegoNombre2) {
        entidades.nombre = horarioTieneDiaLuegoNombre2[1].trim();
      }
    }

    // Nombre: "Juan Pérez", "de Juan", "de Anisoara" (una o más palabras con mayúscula inicial)
    const nombreMatch = mensaje.match(
      /\b(?:de|para|del)\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)*)\b/,
    );
    if (nombreMatch) {
      entidades.nombre = nombreMatch[1].trim();
    }

    // Nombre en MAYÚSCULAS (listados RRHH): "de IORDACHE IONUT ADRIAN" — el patrón Title Case anterior no lo captura
    if (!entidades.nombre) {
      const deNombreMayusc = mensaje.match(
        /\b(?:de|para|del)\s+([A-ZÁÉÍÓÚÜÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ]{2,}){2,})\b/,
      );
      if (deNombreMayusc) {
        entidades.nombre = deNombreMayusc[1].trim();
      }
    }
    // "horario de IORDACHE IONUT ADRIAN" (sin "trabajo"; sensible a mayúsculas para no coincidir con "horario de trabajo")
    if (!entidades.nombre) {
      const horarioDeNombre = mensaje.match(
        /\bhorario\s+de\s+([A-ZÁÉÍÓÚÜÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ]{2,})+)\b/,
      );
      if (horarioDeNombre) {
        entidades.nombre = horarioDeNombre[1].trim();
      }
    }
    if (!entidades.nombre) {
      const horarioTrabajoDe = mensaje.match(
        /\bhorario\s+de\s+trabajo\s+de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)+)\b/i,
      );
      if (horarioTrabajoDe) {
        entidades.nombre = horarioTrabajoDe[1].trim();
      }
    }

    // Centru: „quien trabaja hoy en maquinilla 13” — trebuie să accepte cifre (ZI, „centro 5”), nu doar cuvinte cu literă inițială.
    const centroPlace = this.extractCentroTrabajoPlace(mensaje);
    if (centroPlace) {
      entidades.centro = centroPlace;
    }

    /** „por centro” / „per centro” / „por cada centro” = listado agrupado por lugar de trabajo, no un solo centro. */
    if (
      /\b(por\s+centro|per\s+centro|por\s+cada\s+centro|agrupad[oa]s?\s+por\s+centro)\b/i.test(
        mensaje,
      )
    ) {
      entidades.agrupar_por_centro = true;
    }

    // Detectează "tot mesul", "este mes", "mes actual", "todo el mes"
    const mesCompletoPatterns = [
      'todo el mes',
      'tot mesul',
      'luna asta',
      'luna aceasta',
      'luna curenta',
      'este mes',
      'este mes actual',
      'mes actual',
      'mes corriente',
      'todo el mes de',
      'tot mesul de',
      'este mes de',
      'mes actual de',
      'registros del mes',
      'fichajes del mes',
      'registros de este mes',
      'fichajes de este mes',
      'todos los registros del mes',
    ];

    let mesCompleto = false;
    for (const pattern of mesCompletoPatterns) {
      if (mensajeLower.includes(pattern)) {
        mesCompleto = true;
        break;
      }
    }

    // Fecha: "2024-01-15" sau "15/01/2024"
    const fechaMatch = mensaje.match(
      /\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/,
    );
    if (fechaMatch) {
      entidades.fecha = fechaMatch[1];
    }

    // Hoy / ayer / mañana / azi / ieri (RO/ES)
    if (!entidades.fecha) {
      const rel = extractRelativeDayIso(mensaje);
      if (rel) {
        entidades.fecha = rel;
      }
    }

    // Luni: español + rumano + inglés → clave mes en español (DataQuery)
    const mesCanon = extractSpanishMonthFromText(mensaje);
    if (mesCanon) {
      entidades.mes = mesCompleto ? `completo_${mesCanon}` : mesCanon;
    }

    if (mesCompleto && !entidades.mes) {
      const meses = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      const ahora = new Date();
      const mesActual = meses[ahora.getMonth()];
      entidades.mes = `completo_${mesActual}`;
    }

    // Fallback: nume lună doar în español în text (fără diacritice RO deja cubierto)
    if (!entidades.mes) {
      const mesesEs = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      for (const mes of mesesEs) {
        if (mensajeLower.includes(mes)) {
          entidades.mes = mesCompleto ? `completo_${mes}` : mes;
          break;
        }
      }
    }

    // Tip solicitud (chei canonice → mapare la valorile din DB în DataQueryService)
    const nSolicitudTipo = normalizeForMatch(mensaje);
    if (
      /\bausencias?\s+justificadas?\b/.test(nSolicitudTipo) ||
      /\bausencia\s+justificada\b/.test(nSolicitudTipo) ||
      /\babsente\s+justificate\b/.test(nSolicitudTipo) ||
      /\babsenta\s+justificata\b/.test(nSolicitudTipo) ||
      /\bjustified\s+absences?\b/.test(nSolicitudTipo) ||
      /\bjustified\s+absence\b/.test(nSolicitudTipo)
    ) {
      entidades.tipo = 'ausencia_justificada';
    } else if (/\bbajas?\b/.test(nSolicitudTipo)) {
      entidades.tipo = 'baja';
    } else if (
      /\basuntos?\s+propios?\b/.test(nSolicitudTipo) ||
      /\basunto\s+propio\b/.test(nSolicitudTipo)
    ) {
      entidades.tipo = 'asunto_propio';
    } else if (/\bvacaciones?\b/.test(nSolicitudTipo)) {
      entidades.tipo = 'vacaciones';
    }

    // Filtre pentru listado empleados
    // Verifică mai întâi combinațiile (sunt mai specifice)
    // "no tiene cuadrante o horario" (OR) vs "no tiene cuadrante ni horario" (AND)
    if (
      (mensajeLower.includes('no tiene cuadrante') ||
        mensajeLower.includes('no tienen cuadrante') ||
        mensajeLower.includes('sin cuadrante') ||
        mensajeLower.includes('sin cuadrantes') ||
        mensajeLower.includes('falta cuadrante') ||
        mensajeLower.includes('faltan cuadrantes')) &&
      (mensajeLower.includes('no tiene horario') ||
        mensajeLower.includes('no tienen horario') ||
        mensajeLower.includes('sin horario') ||
        mensajeLower.includes('sin horarios') ||
        mensajeLower.includes('falta horario') ||
        mensajeLower.includes('faltan horarios'))
    ) {
      // Verifică dacă e "o" (OR) sau "ni" (AND)
      if (
        mensajeLower.includes(' o ') ||
        mensajeLower.includes(' o horario') ||
        mensajeLower.includes(' o cuadrante') ||
        mensajeLower.includes('o horario') ||
        mensajeLower.includes('o cuadrante')
      ) {
        entidades.filtro = 'sin_cuadrante_o_horario';
      } else {
        entidades.filtro = 'sin_cuadrante_ni_horario';
      }
    } else if (
      mensajeLower.includes('no tiene cuadrante') ||
      mensajeLower.includes('no tienen cuadrante') ||
      mensajeLower.includes('sin cuadrante') ||
      mensajeLower.includes('sin cuadrantes') ||
      mensajeLower.includes('falta cuadrante') ||
      mensajeLower.includes('faltan cuadrantes')
    ) {
      entidades.filtro = 'sin_cuadrante';
    } else if (
      mensajeLower.includes('no tiene horario') ||
      mensajeLower.includes('no tienen horario') ||
      mensajeLower.includes('sin horario') ||
      mensajeLower.includes('sin horarios') ||
      mensajeLower.includes('falta horario') ||
      mensajeLower.includes('faltan horarios')
    ) {
      entidades.filtro = 'sin_horario';
    } else if (
      mensajeLower.includes('no tiene centro') ||
      mensajeLower.includes('no tienen centro') ||
      mensajeLower.includes('sin centro') ||
      mensajeLower.includes('sin centros') ||
      mensajeLower.includes('falta centro') ||
      mensajeLower.includes('faltan centros') ||
      mensajeLower.includes('centro de trabajo') ||
      mensajeLower.includes('centro trabajo') ||
      mensajeLower.includes('le falta centro') ||
      mensajeLower.includes('falta centro de trabajo')
    ) {
      entidades.filtro = 'sin_centro';
    }

    // Detectează întrebări despre fichajes faltantes (angajați care ar trebui să lucreze dar nu au fichat)
    if (
      mensajeLower.includes('tenia que trabajar') ||
      mensajeLower.includes('tenía que trabajar') ||
      mensajeLower.includes('tenian que trabajar') ||
      mensajeLower.includes('tenían que trabajar') ||
      mensajeLower.includes('deberia trabajar') ||
      mensajeLower.includes('debería trabajar') ||
      mensajeLower.includes('no ha registrado fichaje') ||
      mensajeLower.includes('no ha registrado el fichaje') ||
      mensajeLower.includes('no he registrado fichaje') ||
      mensajeLower.includes('no he registrado el fichaje') ||
      mensajeLower.includes('según cuadrante') ||
      mensajeLower.includes('según horario') ||
      mensajeLower.includes('según los cuadrantes') ||
      mensajeLower.includes('según el horario') ||
      mensajeLower.includes('quien tenia que trabajar') ||
      mensajeLower.includes('quién tenía que trabajar')
    ) {
      entidades.tipo = 'fichajes_faltantes';
      this.logger.log(
        `✅ [IntentClassifier] Detected fichajes_faltantes tipo from message: ${mensaje.substring(0, 100)}`,
      );
    }

    if (
      /\b(pendiente|pendientes|pending|în\s+așteptare|in\s+asteptare|en\s+espera)\b/i.test(
        mensajeLower,
      )
    ) {
      entidades.soloPendientes = true;
    }

    const periodPatch = extractNaturalPeriodEntityPatch(mensaje);
    if (periodPatch.mes && !entidades.mes) {
      entidades.mes = periodPatch.mes;
    }
    if (periodPatch.year && !entidades.year) {
      entidades.year = periodPatch.year;
    }

    const prox = extractProximosDiasCount(mensaje);
    if (prox != null && !entidades.fecha && !entidades.mes && !entidades.year) {
      entidades.proximos_dias = prox;
    }

    const nEnt = normalizeForMatch(mensaje);
    if (
      /\b(falta|faltan)\s+.{0,40}n[oó]mina/.test(nEnt) ||
      /\bsin\s+n[oó]mina/.test(nEnt) ||
      /\bsin\s+nominas\b/.test(nEnt) ||
      /\bsin\s+nóminas\b/.test(nEnt) ||
      /\bno\s+tienen\s+n[oó]mina/.test(nEnt) ||
      /\bno\s+tiene\s+n[oó]mina/.test(nEnt) ||
      /\bemplead\w*\s+sin\s+n[oó]mina/.test(nEnt)
    ) {
      entidades.faltan_nominas = true;
    }

    if (entidades.nombre) {
      entidades.nombre = entidades.nombre
        .replace(/\s+(hoy|ayer|mañana|manana|azi|ieri|maine|mâine)$/iu, '')
        .trim();
    }

    return Object.keys(entidades).length > 0 ? entidades : undefined;
  }
}
