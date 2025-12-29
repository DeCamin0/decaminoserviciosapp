import { Injectable, Logger } from '@nestjs/common';

export enum IntentType {
  FICHAJES = 'fichajes',
  CUADRANTE = 'cuadrante',
  VACACIONES = 'vacaciones',
  NOMINAS = 'nominas',
  DOCUMENTOS = 'documentos',
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
    tipo?: string;
    filtro?: string;
  };
}

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
        'fichaje', 'fichar', 'puntuar', 'entrada', 'salida', 'horas trabajadas',
        'quien ha fichado', 'quién ha fichado', 'quien no ha fichado', 'quién no ha fichado',
        'faltan fichar', 'no ha puntuado', 'no ha fichado',
        'registro', 'registros de hoy', 'fichajes de hoy',
        'quien', 'quién', 'ha fichado', 'han fichado', 'fichado hoy',
        'tenia que trabajar', 'tenía que trabajar', 'deberia trabajar', 'debería trabajar',
        'no ha registrado fichaje', 'no ha registrado el fichaje', 'falta fichar',
        'según cuadrante', 'según horario', 'según los cuadrantes', 'según el horario',
        'empleado que tenia que trabajar', 'empleados que tenian que trabajar',
      ],
      [IntentType.CUADRANTE]: [
        'cuadrante', 'turno', 'turnos', 'horario', 'horarios', 'planificación',
        'cuando es mi turno', 'proximo turno', 'mi cuadrante',
      ],
      [IntentType.VACACIONES]: [
        'vacaciones', 'vacacion', 'vacante', 'dias de vacaciones', 'dias restantes',
        'solicitud de vacaciones', 'solicitud de vacacion', 'solicitudes de vacaciones',
        'pedida', 'pedido', 'esta pedida', 'esta pedido', 'han pedido',
        'asuntos propios', 'dias disponibles',
        'cuantos dias me quedan', 'balance de vacaciones',
        'nombres de empleados', 'nombre de empleados', 'nombres', 'empleados',
        'solicitudes', 'solicitud',
      ],
      [IntentType.NOMINAS]: [
        'nomina', 'nómina', 'fluturas', 'salario', 'sueldo', 'pago',
        'tengo nomina', 'nomina de', 'descargar nomina',
      ],
      [IntentType.DOCUMENTOS]: [
        'documento', 'documentos', 'pdf', 'archivo', 'descargar',
        'mis documentos', 'documentos personales',
      ],
      [IntentType.PROCEDIMIENTOS]: [
        'procedimiento', 'como hacer', 'pasos para', 'guia', 'manual',
        'instrucciones', 'ayuda con',
      ],
      [IntentType.INCIDENCIAS]: [
        'incidencia', 'problema', 'error', 'no funciona', 'ayuda',
        'reportar', 'ticket',
      ],
      [IntentType.EMPLEADOS]: [
        'listado de empleados', 'lista de empleados', 'todos los empleados',
        'empleados con', 'empleados sin', 'estado de empleados',
        'empleados que no tiene', 'empleados que no tienen',
        'empleado que no tiene', 'empleado que no tienen',
        'me puedes sacar los empleados', 'puedes sacar los empleados',
        'sacar los empleados', 'mostrar los empleados',
        'cuadrante asignado', 'horario asignado', 'centro asignado',
        'tiene cuadrante', 'tiene horario', 'tiene centro',
        'no tiene cuadrante', 'no tiene horario', 'no tiene centro',
        'sin cuadrante', 'sin horario', 'sin centro',
        'le falta centro', 'falta centro', 'falta centro de trabajo',
        'listado completo', 'información de empleados',
      ],
    };

    // Caută potriviri pentru fiecare intenție
    let bestMatch: IntentType = IntentType.DESCONOCIDO;
    let maxMatches = 0;
    const matches: Record<IntentType, number> = {
      [IntentType.FICHAJES]: 0,
      [IntentType.CUADRANTE]: 0,
      [IntentType.VACACIONES]: 0,
      [IntentType.NOMINAS]: 0,
      [IntentType.DOCUMENTOS]: 0,
      [IntentType.PROCEDIMIENTOS]: 0,
      [IntentType.INCIDENCIAS]: 0,
      [IntentType.EMPLEADOS]: 0,
      [IntentType.DESCONOCIDO]: 0,
    };

    // Verifică pattern-uri compuse (mai precise)
    // "quién/quien" + "fichado" → FICHAJES
    if ((mensajeLower.includes('quién') || mensajeLower.includes('quien')) && 
        (mensajeLower.includes('fichado') || mensajeLower.includes('fichar'))) {
      matches[IntentType.FICHAJES] += 3; // Bonus pentru pattern compus
      if (matches[IntentType.FICHAJES] > maxMatches) {
        maxMatches = matches[IntentType.FICHAJES];
        bestMatch = IntentType.FICHAJES;
      }
    }

    // "empleados" + "cuadrante/horario/centro" → EMPLEADOS (prioritate)
    if (mensajeLower.includes('empleados') || mensajeLower.includes('empleado')) {
      if (mensajeLower.includes('cuadrante') || mensajeLower.includes('horario') || 
          mensajeLower.includes('centro') || mensajeLower.includes('centro de trabajo') ||
          mensajeLower.includes('no tiene') || mensajeLower.includes('sin ') ||
          mensajeLower.includes('le falta') || mensajeLower.includes('falta')) {
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
      if (bestMatch === IntentType.FICHAJES && 
          ((mensajeLower.includes('quién') || mensajeLower.includes('quien')) && 
           (mensajeLower.includes('fichado') || mensajeLower.includes('fichar')))) {
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

    // Nombre: "Juan Pérez" sau "de Juan"
    const nombreMatch = mensaje.match(/\b(?:de|para|del)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
    if (nombreMatch) {
      entidades.nombre = nombreMatch[1];
    }

    // Detectează "tot mesul", "este mes", "mes actual", "todo el mes"
    const mesCompletoPatterns = [
      'todo el mes', 'tot mesul', 'este mes', 'mes actual', 'mes corriente',
      'todo el mes de', 'tot mesul de', 'este mes de', 'mes actual de',
      'registros del mes', 'fichajes del mes', 'registros de este mes',
      'fichajes de este mes', 'todos los registros del mes',
    ];
    
    let mesCompleto = false;
    for (const pattern of mesCompletoPatterns) {
      if (mensajeLower.includes(pattern)) {
        mesCompleto = true;
        break;
      }
    }

    // Fecha: "2024-01-15" sau "15/01/2024"
    const fechaMatch = mensaje.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/);
    if (fechaMatch) {
      entidades.fecha = fechaMatch[1];
    }

    // Mes: "enero", "febrero", "noviembre", etc.
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    for (const mes of meses) {
      if (mensajeLower.includes(mes)) {
        entidades.mes = mes;
        // Dacă e "tot mesul" + nume de lună, marchează ca mes complet
        if (mesCompleto) {
          entidades.mes = `completo_${mes}`;
        }
        break;
      }
    }

    // Dacă e "tot mesul" fără nume de lună specific, folosește luna curentă
    if (mesCompleto && !entidades.mes) {
      const ahora = new Date();
      const mesActual = meses[ahora.getMonth()];
      entidades.mes = `completo_${mesActual}`;
    }

    // Tipo: "vacaciones", "asuntos propios", etc.
    if (mensajeLower.includes('asuntos propios')) {
      entidades.tipo = 'asuntos_propios';
    } else if (mensajeLower.includes('vacaciones')) {
      entidades.tipo = 'vacaciones';
    }

    // Filtre pentru listado empleados
    // Verifică mai întâi combinațiile (sunt mai specifice)
    // "no tiene cuadrante o horario" (OR) vs "no tiene cuadrante ni horario" (AND)
    if ((mensajeLower.includes('no tiene cuadrante') || mensajeLower.includes('no tienen cuadrante') ||
         mensajeLower.includes('sin cuadrante') || mensajeLower.includes('sin cuadrantes') ||
         mensajeLower.includes('falta cuadrante') || mensajeLower.includes('faltan cuadrantes')) &&
        (mensajeLower.includes('no tiene horario') || mensajeLower.includes('no tienen horario') ||
         mensajeLower.includes('sin horario') || mensajeLower.includes('sin horarios') ||
         mensajeLower.includes('falta horario') || mensajeLower.includes('faltan horarios'))) {
      // Verifică dacă e "o" (OR) sau "ni" (AND)
      if (mensajeLower.includes(' o ') || mensajeLower.includes(' o horario') || 
          mensajeLower.includes(' o cuadrante') || mensajeLower.includes('o horario') ||
          mensajeLower.includes('o cuadrante')) {
        entidades.filtro = 'sin_cuadrante_o_horario';
      } else {
        entidades.filtro = 'sin_cuadrante_ni_horario';
      }
    } else if (mensajeLower.includes('no tiene cuadrante') || mensajeLower.includes('no tienen cuadrante') ||
               mensajeLower.includes('sin cuadrante') || mensajeLower.includes('sin cuadrantes') ||
               mensajeLower.includes('falta cuadrante') || mensajeLower.includes('faltan cuadrantes')) {
      entidades.filtro = 'sin_cuadrante';
    } else if (mensajeLower.includes('no tiene horario') || mensajeLower.includes('no tienen horario') ||
               mensajeLower.includes('sin horario') || mensajeLower.includes('sin horarios') ||
               mensajeLower.includes('falta horario') || mensajeLower.includes('faltan horarios')) {
      entidades.filtro = 'sin_horario';
    } else if (mensajeLower.includes('no tiene centro') || mensajeLower.includes('no tienen centro') ||
               mensajeLower.includes('sin centro') || mensajeLower.includes('sin centros') ||
               mensajeLower.includes('falta centro') || mensajeLower.includes('faltan centros') ||
               mensajeLower.includes('centro de trabajo') || mensajeLower.includes('centro trabajo') ||
               mensajeLower.includes('le falta centro') || mensajeLower.includes('falta centro de trabajo')) {
      entidades.filtro = 'sin_centro';
    }

    // Detectează întrebări despre fichajes faltantes (angajați care ar trebui să lucreze dar nu au fichat)
    if (mensajeLower.includes('tenia que trabajar') || 
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
        mensajeLower.includes('quién tenía que trabajar')) {
      entidades.tipo = 'fichajes_faltantes';
      this.logger.log(`✅ [IntentClassifier] Detected fichajes_faltantes tipo from message: ${mensaje.substring(0, 100)}`);
    }

    return Object.keys(entidades).length > 0 ? entidades : undefined;
  }
}

