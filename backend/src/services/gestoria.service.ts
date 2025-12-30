import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class GestoriaService {
  private readonly logger = new Logger(GestoriaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Escapă valori SQL pentru prevenirea SQL injection
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    const stringValue = String(value);
    const escaped = stringValue.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  /**
   * Actualizează statusul unui angajat la INACTIVO dacă este încă ACTIVO
   * @param codigo - CODIGO-ul angajatului
   * @returns true dacă s-a actualizat, false dacă era deja INACTIVO sau nu s-a găsit
   */
  private async actualizarEstadoEmpleadoSiActivo(codigo: string): Promise<boolean> {
    try {
      // Verificăm dacă angajatul este ACTIVO
      const checkQuery = `
        SELECT \`ESTADO\`
        FROM \`DatosEmpleados\`
        WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
        LIMIT 1
      `;
      const empleado = await this.prisma.$queryRawUnsafe<Array<{ ESTADO: string }>>(
        checkQuery,
      );

      if (empleado.length === 0) {
        this.logger.warn(`⚠️ Angajat cu CODIGO ${codigo} nu a fost găsit pentru actualizare status`);
        return false;
      }

      const estadoActual = empleado[0]?.ESTADO?.trim().toUpperCase();
      
      // Dacă este deja INACTIVO sau alt status, nu actualizăm
      if (estadoActual !== 'ACTIVO') {
        this.logger.log(`ℹ️ Angajat ${codigo} are deja status ${estadoActual}, nu se actualizează`);
        return false;
      }

      // Actualizăm la INACTIVO
      const updateQuery = `
        UPDATE \`DatosEmpleados\`
        SET \`ESTADO\` = 'INACTIVO'
        WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
          AND \`ESTADO\` = 'ACTIVO'
      `;
      await this.prisma.$executeRawUnsafe(updateQuery);
      
      this.logger.log(`✅ Status actualizat la INACTIVO pentru angajat ${codigo} (detectat finiquito)`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la actualizarea statusului pentru angajat ${codigo}:`, error);
      return false;
    }
  }

  /**
   * Extrage Fecha Antigüedad din textul PDF
   * @param textContent - Textul extras din PDF
   * @returns Data în format YYYY-MM-DD sau null dacă nu se găsește
   */
  private extraerFechaAntiguedad(textContent: string): string | null {
    try {
      const textLower = textContent.toLowerCase();
      
      // Căutăm pattern-ul "fecha antigüedad" sau "fecha antiguedad" urmat de o dată
      // Pattern-uri mai flexibile pentru a găsi datele
      const patterns = [
        /fecha\s+antigüedad\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /fecha\s+antiguedad\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /fecha\s+antigüedad\s*[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /fecha\s+antiguedad\s*[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /antigüedad\s*[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /antiguedad\s*[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        // Pattern mai flexibil - poate fi pe linii diferite sau cu spații diferite
        /fecha\s+antigüedad[^\d]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /fecha\s+antiguedad[^\d]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        // Pattern pentru a găsi orice dată după "fecha antigüedad" (chiar dacă sunt caractere între, inclusiv newline)
        /fecha\s+antigüedad[\s\S]{0,100}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /fecha\s+antiguedad[\s\S]{0,100}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      ];

      this.logger.debug(`🔍 Căutând Fecha Antigüedad în text (${textContent.length} caractere)`);
      
      for (const pattern of patterns) {
        const match = textContent.match(pattern);
        if (match) {
          // Încercăm mai întâi cu match[1] (grupul de captură)
          let dateStr = match[1];
          // Dacă nu există match[1], încercăm să extragem data din match[0]
          if (!dateStr && match[0]) {
            const dateMatchFromFull = match[0].match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
            if (dateMatchFromFull) {
              dateStr = dateMatchFromFull[0];
            }
          }
          
          if (dateStr) {
            this.logger.debug(`✅ Pattern găsit pentru Fecha Antigüedad: "${match[0]}", dateStr: "${dateStr}"`);
            const dateMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            if (dateMatch) {
              let day = parseInt(dateMatch[1], 10);
              let month = parseInt(dateMatch[2], 10);
              let year = parseInt(dateMatch[3], 10);
              
              // Normalizăm anul (dacă e 2 cifre)
              if (year < 100) {
                year = year < 50 ? 2000 + year : 1900 + year;
              }
              
              // Formatăm ca DD/MM/YYYY
              const fechaFormateada = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
              this.logger.log(`✅ Fecha Antigüedad extrasă: ${fechaFormateada} (din: "${match[0]}")`);
              return fechaFormateada;
            }
          }
        }
      }
      
      this.logger.debug(`⚠️ Fecha Antigüedad nu a fost găsită în PDF`);
      return null;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la extragerea Fecha Antigüedad:`, error);
      return null;
    }
  }

  /**
   * Extrage Fecha Baja din textul finiquito
   * Pattern: "del X de [mes] al Y de [mes] de [an]" - luăm data finală (Y de [mes] de [an])
   * @param textContent - Textul extras din PDF
   * @returns Data în format YYYY-MM-DD sau null dacă nu se găsește
   */
  private extraerFechaBaja(textContent: string): string | null {
    try {
      const textLower = textContent.toLowerCase();
      
      // Numele lunilor în spaniolă
      const meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      // Pattern: "del X de [mes] al Y de [mes] de [an]"
      // Sau variante: "del X al Y de [mes] de [an]"
      // Anul poate fi "2025" sau "2.025"
      const patterns = [
        /del\s+(\d{1,2})\s+de\s+(\w+)\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{1,4}[\.]?\d{0,4})/gi,
        /del\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{1,4}[\.]?\d{0,4})/gi,
      ];

      for (const pattern of patterns) {
        const match = textContent.match(pattern);
        if (match && match[0]) {
          this.logger.log(`🔍 Pattern găsit pentru Fecha Baja: "${match[0]}"`);
          
          // Pentru primul pattern: "del X de [mes1] al Y de [mes2] de [an]"
          if (pattern.source.includes('de\\s+(\\w+)\\s+al')) {
            const parts = match[0].match(/del\s+(\d{1,2})\s+de\s+(\w+)\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{1,4}[\.]?\d{0,4})/i);
            if (parts) {
              const diaFinal = parseInt(parts[3], 10);
              const mesNombre = parts[4].toLowerCase();
              const anoStr = parts[5].replace(/\./g, ''); // Eliminăm punctele din an (ex: "2.025" -> "2025")
              const ano = parseInt(anoStr, 10);
              
              const mesIndex = meses.findIndex(m => mesNombre.includes(m) || m.includes(mesNombre));
              if (mesIndex !== -1) {
                const mes = mesIndex + 1;
                const fechaFormateada = `${String(diaFinal).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
                this.logger.log(`✅ Fecha Baja extrasă: ${fechaFormateada} (din: "${match[0]}")`);
                return fechaFormateada;
              }
            }
          } else {
            // Pentru al doilea pattern: "del X al Y de [mes] de [an]"
            const parts = match[0].match(/del\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{1,4}[\.]?\d{0,4})/i);
            if (parts) {
              const diaFinal = parseInt(parts[2], 10);
              const mesNombre = parts[3].toLowerCase();
              const anoStr = parts[4].replace(/\./g, ''); // Eliminăm punctele din an (ex: "2.025" -> "2025")
              const ano = parseInt(anoStr, 10);
              
              const mesIndex = meses.findIndex(m => mesNombre.includes(m) || m.includes(mesNombre));
              if (mesIndex !== -1) {
                const mes = mesIndex + 1;
                const fechaFormateada = `${String(diaFinal).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
                this.logger.log(`✅ Fecha Baja extrasă: ${fechaFormateada} (din: "${match[0]}")`);
                return fechaFormateada;
              }
            }
          }
        }
      }
      
      return null;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la extragerea Fecha Baja:`, error);
      return null;
    }
  }

  /**
   * Actualizează Fecha Alta, Fecha Antigüedad și Fecha Baja pentru un angajat dacă nu sunt setate
   * @param codigo - CODIGO-ul angajatului
   * @param fechaAlta - Data alta extrasă (format DD/MM/YYYY sau null) - de obicei = fechaAntiguedadExtraida
   * @param fechaAntiguedad - Data antigüedad extrasă (format DD/MM/YYYY sau null)
   * @param fechaBaja - Data baja extrasă (format DD/MM/YYYY sau null) - doar pentru finiquitos
   * @param esFiniquito - Indică dacă este finiquito (pentru a da prioritate Fecha Baja pentru FECHA DE ALTA)
   * @returns true dacă s-a actualizat ceva, false altfel
   */
  private async actualizarFechasEmpleado(
    codigo: string,
    fechaAlta: string | null,
    fechaAntiguedad: string | null,
    fechaBaja: string | null,
    esFiniquito: boolean = false
  ): Promise<boolean> {
    try {
      // Verificăm ce date are deja angajatul
      const checkQuery = `
        SELECT 
          \`Fecha Antigüedad\`,
          \`FECHA DE ALTA\`,
          \`FECHA BAJA\`
        FROM \`DatosEmpleados\`
        WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
        LIMIT 1
      `;
      const empleado = await this.prisma.$queryRawUnsafe<Array<{
        'Fecha Antigüedad': string | null;
        'FECHA DE ALTA': string | null;
        'FECHA BAJA': string | null;
      }>>(checkQuery);

      if (empleado.length === 0) {
        this.logger.warn(`⚠️ Angajat cu CODIGO ${codigo} nu a fost găsit pentru actualizare fechas`);
        return false;
      }

      const fechaAntiguedadActual = empleado[0]?.['Fecha Antigüedad'];
      const fechaAltaActual = empleado[0]?.['FECHA DE ALTA'];
      const fechaBajaActual = empleado[0]?.['FECHA BAJA'];

      const updateFields: string[] = [];
      
      // Actualizăm FECHA DE ALTA dacă nu este setată - folosim ÎNTOTDEAUNA fechaAntiguedadExtraida
      if (!fechaAltaActual && fechaAntiguedad) {
        updateFields.push(`\`FECHA DE ALTA\` = ${this.escapeSql(fechaAntiguedad)}`);
        this.logger.log(`📅 Va actualiza FECHA DE ALTA (din Fecha Antigüedad Extraida): ${fechaAntiguedad}`);
      }
      
      // Actualizăm Fecha Antigüedad dacă nu este setată - folosim fechaAntiguedadExtraida
      if (!fechaAntiguedadActual && fechaAntiguedad) {
        updateFields.push(`\`Fecha Antigüedad\` = ${this.escapeSql(fechaAntiguedad)}`);
        this.logger.log(`📅 Va actualiza Fecha Antigüedad (din Fecha Antigüedad Extraida): ${fechaAntiguedad}`);
      }
      
      // Actualizăm FECHA BAJA dacă nu este setată - folosim fechaBajaExtraida
      if (!fechaBajaActual && fechaBaja) {
        updateFields.push(`\`FECHA BAJA\` = ${this.escapeSql(fechaBaja)}`);
        this.logger.log(`📅 Va actualiza FECHA BAJA (din Fecha Baja Extraida): ${fechaBaja}`);
      }

      if (updateFields.length === 0) {
        this.logger.log(`ℹ️ Angajat ${codigo} are deja toate datele setate sau nu s-au extras date noi`);
        return false;
      }

      // Actualizăm în baza de date
      const updateQuery = `
        UPDATE \`DatosEmpleados\`
        SET ${updateFields.join(', ')}
        WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
      `;
      await this.prisma.$executeRawUnsafe(updateQuery);
      
      this.logger.log(`✅ Date actualizate pentru angajat ${codigo}: ${updateFields.join(', ')}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la actualizarea fechas pentru angajat ${codigo}:`, error);
      return false;
    }
  }

  /**
   * Detectează dacă un text PDF este un finiquito
   * @param textContent - Textul extras din PDF
   * @returns true dacă este finiquito, false altfel
   */
  private detectarFiniquito(textContent: string): boolean {
    const textLower = textContent.toLowerCase();
    
    // Logging pentru debugging
    this.logger.debug(`🔍 detectarFiniquito: Analizăm text (${textContent.length} caractere)`);
    
    // ============================================
    // PATTERN PRINCIPAL: TEXTUL EXACT DIN CHENARUL FINIQUITO-ULUI
    // (Acesta este cel mai sigur indicator - apare DOAR în finiquito)
    // ============================================
    
    // Textul EXACT din chenarul finiquito-ului (identificat prin analiză comparativă):
    // "Liquidación, Baja y Finiquito por todos los conceptos hasta el día de hoy, en el que se extingue la relación laboral."
    const textoCompletoFiniquito = 'liquidación, baja y finiquito por todos los conceptos hasta el día de hoy, en el que se extingue la relación laboral';
    
    if (textLower.includes(textoCompletoFiniquito)) {
      this.logger.debug(`✅ Finiquito detectat (textul complet din chenar: "${textoCompletoFiniquito}")`);
      return true;
    }
    
    // Pattern 1: Verificăm dacă ambele părți ale textului complet apar în text
    // (în cazul în care textul este împărțit pe mai multe linii)
    const parte1 = 'liquidación, baja y finiquito por todos los conceptos hasta el día de hoy';
    const parte2 = 'en el que se extingue la relación laboral';
    
    const tieneParte1 = textLower.includes(parte1);
    const tieneParte2 = textLower.includes(parte2);
    
    this.logger.debug(`🔍 Pattern 1 check: parte1=${tieneParte1}, parte2=${tieneParte2}`);
    
    if (tieneParte1 && tieneParte2) {
      this.logger.debug(`✅ Finiquito detectat (ambele părți ale textului complet: "${parte1}" + "${parte2}")`);
      return true;
    }
    
    // Pattern 2: "Liquidación, Baja y Finiquito" + "se extingue la relación laboral"
    // IMPORTANT: Trebuie să apară AMBELE, și să nu fie doar "período de liquidación"
    const tieneLiquidacionBajaFiniquito = textLower.includes('liquidación, baja y finiquito');
    const tieneSeExtingue = textLower.includes('se extingue la relación laboral');
    const tienePeriodoLiquidacion = textLower.includes('período de liquidación') || textLower.includes('periodo de liquidación');
    
    this.logger.debug(`🔍 Pattern 2 check: tieneLiquidacionBajaFiniquito=${tieneLiquidacionBajaFiniquito}, tieneSeExtingue=${tieneSeExtingue}, tienePeriodoLiquidacion=${tienePeriodoLiquidacion}`);
    
    if (tieneLiquidacionBajaFiniquito && tieneSeExtingue && !tienePeriodoLiquidacion) {
      this.logger.debug(`✅ Finiquito detectat (liquidación, baja y finiquito + se extingue, fără período de liquidación)`);
      return true;
    }
    
    // Pattern 3: Doar "Liquidación, Baja y Finiquito" (fără "se extingue")
    // Acest pattern este mai permisiv, dar poate apărea doar în finiquito
    if (tieneLiquidacionBajaFiniquito && !tienePeriodoLiquidacion) {
      this.logger.debug(`✅ Finiquito detectat (liquidación, baja y finiquito, fără período de liquidación)`);
      return true;
    }
    
    // Pattern 4: Verificăm variante ale textului (poate textul este formatat diferit)
    // "Liquidación, Baja y Finiquito" poate apărea cu sau fără virgule, cu spații diferite
    const varianteLiquidacion = [
      'liquidación baja y finiquito', // fără virgule
      'liquidación,baja y finiquito', // virgulă doar după liquidación
      'liquidación baja finiquito', // fără "y"
    ];
    
    for (const variante of varianteLiquidacion) {
      if (textLower.includes(variante)) {
        this.logger.debug(`✅ Finiquito detectat (variante text: "${variante}")`);
        return true;
      }
    }
    
    // Pattern 5: Verificăm dacă conține "por todos los conceptos" + "hasta el día de hoy"
    // Acestea sunt pattern-uri specifice finiquito-ului
    const tienePorTodosConceptos = textLower.includes('por todos los conceptos');
    const tieneHastaDiaHoy = textLower.includes('hasta el día de hoy') || textLower.includes('hasta el dia de hoy');
    
    this.logger.debug(`🔍 Pattern 5 check: tienePorTodosConceptos=${tienePorTodosConceptos}, tieneHastaDiaHoy=${tieneHastaDiaHoy}`);
    
    if (tienePorTodosConceptos && tieneHastaDiaHoy && !tienePeriodoLiquidacion) {
      this.logger.debug(`✅ Finiquito detectat (por todos los conceptos + hasta el día de hoy, fără período de liquidación)`);
      return true;
    }
    
    // Pattern 5b: "Liquidación de todos los conceptos salariales" + "se suspende la relación laboral"
    // Acesta este un pattern alternativ pentru finiquito (fără cuvântul "finiquito" în text)
    // IMPORTANT: "período de liquidación" poate apărea în header, dar pattern-urile de finiquito sunt în chenar
    const tieneLiquidacionTodosConceptos = textLower.includes('liquidación de todos los conceptos salariales');
    const tieneSeSuspende = textLower.includes('se suspende la relación laboral');
    
    this.logger.debug(`🔍 Pattern 5b check: tieneLiquidacionTodosConceptos=${tieneLiquidacionTodosConceptos}, tieneSeSuspende=${tieneSeSuspende}`);
    
    // Verificăm dacă pattern-urile de finiquito apar ÎNAINTE de "período de liquidación"
    // (adică în chenarul finiquito-ului, nu în header)
    if (tieneLiquidacionTodosConceptos && tieneSeSuspende) {
      const indexLiquidacionTodos = textLower.indexOf('liquidación de todos los conceptos salariales');
      const indexPeriodo = textLower.indexOf('período de liquidación');
      const indexPeriodoAlt = textLower.indexOf('periodo de liquidación');
      const indexPeriodoFinal = indexPeriodo !== -1 ? indexPeriodo : (indexPeriodoAlt !== -1 ? indexPeriodoAlt : -1);
      
      // Dacă "liquidación de todos los conceptos salariales" apare DUPĂ "período de liquidación",
      // înseamnă că este în chenarul finiquito-ului (nu în header)
      if (indexPeriodoFinal === -1 || indexLiquidacionTodos > indexPeriodoFinal) {
        this.logger.debug(`✅ Finiquito detectat (liquidación de todos los conceptos salariales + se suspende, după período de liquidación)`);
        return true;
      }
    }
    
    // Pattern 5c: "Liquidación de todos los conceptos salariales" + "hasta el día de hoy"
    // Variantă fără "se suspende"
    if (tieneLiquidacionTodosConceptos && tieneHastaDiaHoy) {
      const indexLiquidacionTodos = textLower.indexOf('liquidación de todos los conceptos salariales');
      const indexPeriodo = textLower.indexOf('período de liquidación');
      const indexPeriodoAlt = textLower.indexOf('periodo de liquidación');
      const indexPeriodoFinal = indexPeriodo !== -1 ? indexPeriodo : (indexPeriodoAlt !== -1 ? indexPeriodoAlt : -1);
      
      if (indexPeriodoFinal === -1 || indexLiquidacionTodos > indexPeriodoFinal) {
        this.logger.debug(`✅ Finiquito detectat (liquidación de todos los conceptos salariales + hasta el día de hoy, după período de liquidación)`);
        return true;
      }
    }
    
    // ============================================
    // VERIFICARE NEGATIVĂ: NÓMINA NORMALĂ
    // (Dacă este nómina normală, NU este finiquito)
    // ============================================
    
    // Dacă conține "recibo de salarios" sau "nómina" și NU are pattern-uri specifice de finiquito,
    // este nómina normală
    const tieneReciboSalarios = textLower.includes('recibo de salarios') || textLower.includes('recibo de salario');
    const tieneNomina = textLower.includes('nómina') || textLower.includes('nomina');
    
    // Verificăm dacă are pattern-uri specifice de finiquito
    const tienePatternFiniquito = tieneLiquidacionBajaFiniquito || 
                                  textLower.includes('liquidación de todos los conceptos salariales hasta el día de hoy') ||
                                  textLower.includes('se suspende la relación laboral') ||
                                  tieneSeExtingue;
    
    // Dacă are "recibo de salarios" sau "nómina" și NU are pattern-uri de finiquito, este nómina normală
    if ((tieneReciboSalarios || tieneNomina) && !tienePatternFiniquito) {
      this.logger.debug(`❌ Nu este finiquito - este nómina normală (${tieneReciboSalarios ? 'recibo de salarios' : 'nómina'} fără pattern-uri de finiquito)`);
      return false;
    }
    
    // ============================================
    // PATTERN-URI SECUNDARE (mai puțin specifice)
    // (Trebuie să găsim mai multe pentru a fi siguri)
    // ============================================
    
    // Pattern-uri care indică finiquito, dar pot apărea și în alte contexte
    // Trebuie să găsim cel puțin 3 pentru a fi siguri
    const finiquitoIndicatorsSecundarios = [
      'cese de actividad',
      'cese voluntario',
      'cese de trabajo',
      'despido',
      'rescisión',
      'finalización contrato',
      'indemnización',
      'fecha de baja',
    ];
    
    const finiquitoIndicatorsSuplimentarios = [
      'vacaciones no disfrutadas',
      'vacaciones disfrutadas', // Apare în finiquito ca secțiune separată
      'parte proporcional',
      'falta preaviso',
      'falta de preaviso',
    ];
    
    let foundCountSecundarios = 0;
    let foundCountSuplimentarios = 0;
    
    for (const indicator of finiquitoIndicatorsSecundarios) {
      if (textLower.includes(indicator)) {
        foundCountSecundarios++;
        this.logger.debug(`🔍 Indicator secundar găsit: "${indicator}"`);
      }
    }
    
    for (const indicator of finiquitoIndicatorsSuplimentarios) {
      if (textLower.includes(indicator)) {
        foundCountSuplimentarios++;
        this.logger.debug(`🔍 Indicator suplimentar găsit: "${indicator}"`);
      }
    }
    
    // Pattern 6: Verificăm structura documentului - finiquito-ul are secțiuni specifice
    // "FALTA PREAVISO" și "VACACIONES DISFRUTADAS" apar împreună în finiquito
    const tieneFaltaPreaviso = textLower.includes('falta preaviso') || textLower.includes('falta de preaviso');
    const tieneVacacionesDisfrutadas = textLower.includes('vacaciones disfrutadas');
    
    this.logger.debug(`🔍 Pattern 6 check: tieneFaltaPreaviso=${tieneFaltaPreaviso}, tieneVacacionesDisfrutadas=${tieneVacacionesDisfrutadas}`);
    
    if (tieneFaltaPreaviso && tieneVacacionesDisfrutadas && !tieneReciboSalarios && !tieneNomina) {
      this.logger.debug(`✅ Finiquito detectat (FALTA PREAVISO + VACACIONES DISFRUTADAS)`);
      return true;
    }
    
    // Dacă găsim cel puțin 3 indicatori secundari, sau 2 secundari + 1 suplimentar, considerăm finiquito
    // DAR doar dacă NU este nómina normală (verificare dublă)
    const tieneIndicadoresMultiples = foundCountSecundarios >= 3 || (foundCountSecundarios >= 2 && foundCountSuplimentarios >= 1);
    
    if (tieneIndicadoresMultiples && !tieneReciboSalarios && !tieneNomina) {
      this.logger.debug(`✅ Finiquito detectat (${foundCountSecundarios} secundari + ${foundCountSuplimentarios} suplimentari, fără recibo de salarios/nómina)`);
      return true;
    }
    
    // Pattern 7: Dacă găsim "finiquito" în text (chiar dacă nu are pattern-urile principale)
    // și NU este nómina normală, considerăm finiquito
    const tieneFiniquitoWord = textLower.includes('finiquito') || textLower.includes('finiquitar');
    
    if (tieneFiniquitoWord && !tieneReciboSalarios && !tieneNomina && !tienePeriodoLiquidacion) {
      this.logger.debug(`✅ Finiquito detectat (cuvântul "finiquito" găsit, fără recibo de salarios/nómina/período)`);
      return true;
    }
    
    // ============================================
    // REZULTAT FINAL
    // ============================================
    
    // Dacă am ajuns aici, nu am găsit pattern-uri clare de finiquito
    // Logăm un sample din text pentru debugging
    const textSample = textContent.substring(0, 500).toLowerCase();
    this.logger.debug(`❌ Nu este finiquito (${foundCountSecundarios} secundari + ${foundCountSuplimentarios} suplimentari, ${tieneReciboSalarios ? 'cu' : 'fără'} recibo de salarios)`);
    this.logger.debug(`📄 Text sample pentru debugging: "${textSample}..."`);
    
    // Căutăm orice apariție a cuvântului "finiquito" pentru debugging
    const indexFiniquito = textLower.indexOf('finiquito');
    if (indexFiniquito !== -1) {
      const contextFiniquito = textContent.substring(Math.max(0, indexFiniquito - 100), Math.min(textContent.length, indexFiniquito + 200));
      this.logger.debug(`🔍 Cuvântul "finiquito" găsit la index ${indexFiniquito}, context: "${contextFiniquito}"`);
    }
    
    return false;
  }

  /**
   * Obține CODIGO-ul unui angajat după nume
   * @param nombre - Numele complet al angajatului
   * @returns CODIGO-ul sau null dacă nu se găsește
   */
  private async obtenerCodigoPorNombre(nombre: string): Promise<string | null> {
    try {
      const query = `
        SELECT \`CODIGO\`
        FROM \`DatosEmpleados\`
        WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) = ${this.escapeSql(nombre.trim().toUpperCase())}
        LIMIT 1
      `;
      const result = await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(query);
      return result.length > 0 ? result[0].CODIGO : null;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la obținerea CODIGO pentru ${nombre}:`, error);
      return null;
    }
  }

  /**
   * Caută angajat după nume, NIF sau număr de securitate socială (potrivire flexibilă)
   * Returnează null dacă nu găsește
   */
  async findEmpleadoFlexible(
    nombreDetectado: string,
    nifDetectado?: string | null,
    segSocialDetectado?: string | null,
  ): Promise<{ CODIGO: string; 'NOMBRE / APELLIDOS': string; confianza: number; matchType: string } | null> {
    const nombreNormalized = nombreDetectado.trim().toUpperCase();

    // 1. Potrivire exactă după nume complet (toți angajații, inclusiv inactivi)
    let empleadoQuery = `
      SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
      FROM \`DatosEmpleados\`
      WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) = ${this.escapeSql(nombreNormalized)}
      LIMIT 1
    `;
    let empleado = await this.prisma.$queryRawUnsafe<
      Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
    >(empleadoQuery);

    if (empleado.length > 0) {
      this.logger.debug(`✅ Empleado găsit (potrivire exactă): ${empleado[0]['NOMBRE / APELLIDOS']}`);
      return { ...empleado[0], confianza: 100, matchType: 'exacta' };
    }

    // 2. Potrivire după primele 2 nume (ex: "ALEXANDRU MIHAI" din "ALEXANDRU MIHAI PAULET")
    const nombreParts = nombreNormalized.split(/\s+/).filter(p => p.length > 0);
    if (nombreParts.length >= 2) {
      const primerosDosNombres = `${nombreParts[0]} ${nombreParts[1]}`;
      empleadoQuery = `
        SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
        FROM \`DatosEmpleados\`
        WHERE (
          TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`${primerosDosNombres}%`)}
          OR TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`%${primerosDosNombres}%`)}
        )
        LIMIT 5
      `;
      empleado = await this.prisma.$queryRawUnsafe<
        Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
      >(empleadoQuery);

      if (empleado.length > 0) {
        // Dacă găsim mai multe, încercăm să găsim cel mai apropiat
        // Verificăm dacă numele detectat conține toate cuvintele din numele din DB
        const nombreDetectadoWords = new Set(nombreParts);
        let bestMatch: { CODIGO: string; 'NOMBRE / APELLIDOS': string } | null = null;
        let bestConfianza = 0;
        
        for (const emp of empleado) {
          const empWords = emp['NOMBRE / APELLIDOS'].toUpperCase().split(/\s+/).filter(w => w.length > 0);
          const empWordsSet = new Set(empWords);
          
          // Calculăm confidența: câte cuvinte din numele detectat sunt în numele din DB
          let matchedWords = 0;
          for (const word of nombreDetectadoWords) {
            if (empWordsSet.has(word)) {
              matchedWords++;
            }
          }
          
          // Confidența = procentul de cuvinte potrivite
          const confianza = Math.round((matchedWords / nombreDetectadoWords.size) * 100);
          
          // Verificăm dacă toate cuvintele se potrivesc (100% confidență)
          if (matchedWords === nombreDetectadoWords.size) {
            this.logger.debug(`✅ Empleado găsit (potrivire după 2 nume - 100%): ${emp['NOMBRE / APELLIDOS']}`);
            return { ...emp, confianza: 100, matchType: 'primeros_dos_nombres' };
          }
          
          if (confianza > bestConfianza) {
            bestConfianza = confianza;
            bestMatch = emp;
          }
        }
        
        // Dacă găsim un match cu cel puțin 50% confidență, îl returnăm
        if (bestMatch && bestConfianza >= 50) {
          this.logger.debug(`✅ Empleado găsit (potrivire după 2 nume - ${bestConfianza}%): ${bestMatch['NOMBRE / APELLIDOS']}`);
          return { ...bestMatch, confianza: bestConfianza, matchType: 'primeros_dos_nombres_parcial' };
        }
      }
    }

    // 3. Potrivire după NIF/DNI_NIE
    if (nifDetectado && nifDetectado.trim().length > 0) {
      const nifNormalized = nifDetectado.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      empleadoQuery = `
        SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
        FROM \`DatosEmpleados\`
        WHERE TRIM(UPPER(REPLACE(REPLACE(\`D.N.I. / NIE\`, '-', ''), ' ', ''))) = ${this.escapeSql(nifNormalized)}
        LIMIT 1
      `;
      empleado = await this.prisma.$queryRawUnsafe<
        Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
      >(empleadoQuery);

      if (empleado.length > 0) {
        this.logger.debug(`✅ Empleado găsit (potrivire după NIF): ${empleado[0]['NOMBRE / APELLIDOS']}`);
        return { ...empleado[0], confianza: 100, matchType: 'nif' };
      }
    }

    // 4. Potrivire după număr de securitate socială
    if (segSocialDetectado && segSocialDetectado.trim().length > 0) {
      const segSocialNormalized = segSocialDetectado.trim().replace(/\s+/g, '');
      empleadoQuery = `
        SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
        FROM \`DatosEmpleados\`
        WHERE TRIM(REPLACE(\`SEG. SOCIAL\`, ' ', '')) = ${this.escapeSql(segSocialNormalized)}
        LIMIT 1
      `;
      empleado = await this.prisma.$queryRawUnsafe<
        Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
      >(empleadoQuery);

      if (empleado.length > 0) {
        this.logger.debug(`✅ Empleado găsit (potrivire după Seg. Social): ${empleado[0]['NOMBRE / APELLIDOS']}`);
        return { ...empleado[0], confianza: 100, matchType: 'seg_social' };
      }
    }

    // 5. Potrivire parțială - căutăm după primele 2 cuvinte în orice ordine
    if (nombreParts.length >= 2) {
      empleadoQuery = `
        SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
        FROM \`DatosEmpleados\`
        WHERE (
          TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`%${nombreParts[0]}%${nombreParts[1]}%`)}
          OR TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`%${nombreParts[1]}%${nombreParts[0]}%`)}
        )
        LIMIT 10
      `;
      empleado = await this.prisma.$queryRawUnsafe<
        Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
      >(empleadoQuery);

      if (empleado.length > 0) {
        // Găsim cel mai bun match - verificăm câte cuvinte se potrivesc
        let bestMatch: { CODIGO: string; 'NOMBRE / APELLIDOS': string } | null = null;
        let bestConfianza = 0;
        const nombreDetectadoWords = new Set(nombreParts);
        
        for (const emp of empleado) {
          const empWords = emp['NOMBRE / APELLIDOS'].toUpperCase().split(/\s+/).filter(w => w.length > 0);
          const empWordsSet = new Set(empWords);
          
          // Calculăm scorul: câte cuvinte din numele detectat sunt în numele din DB
          let score = 0;
          for (const word of nombreDetectadoWords) {
            if (empWordsSet.has(word)) {
              score++;
            }
          }
          
          // Calculăm confidența
          const confianza = Math.round((score / nombreDetectadoWords.size) * 100);
          
          // Dacă toate cuvintele se potrivesc (100% confidență)
          if (score === nombreDetectadoWords.size) {
            this.logger.debug(`✅ Empleado găsit (potrivire parțială - toate cuvintele): ${emp['NOMBRE / APELLIDOS']}`);
            return { ...emp, confianza: 100, matchType: 'parcial_completa' };
          }
          
          if (confianza > bestConfianza) {
            bestConfianza = confianza;
            bestMatch = emp;
          }
        }
        
        // Returnăm doar dacă confidența este >= 70% (cel puțin 2 din 3 cuvinte sau similar)
        if (bestMatch && bestConfianza >= 70) {
          this.logger.debug(`✅ Empleado găsit (potrivire parțială - ${bestConfianza}%): ${bestMatch['NOMBRE / APELLIDOS']}`);
          return { ...bestMatch, confianza: bestConfianza, matchType: 'parcial' };
        }
      }
    }

    // 6. Căutare după primul nume (dacă numele detectat are cel puțin un cuvânt)
    if (nombreParts.length >= 1 && nombreParts[0].length >= 3) {
      const primerNombre = nombreParts[0];
      empleadoQuery = `
        SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
        FROM \`DatosEmpleados\`
        WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`${primerNombre}%`)}
        LIMIT 10
      `;
      empleado = await this.prisma.$queryRawUnsafe<
        Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
      >(empleadoQuery);

      if (empleado.length > 0) {
        this.logger.debug(`🔍 Căutare după primul nume "${primerNombre}": găsiți ${empleado.length} rezultate. Nume detectat: "${nombreDetectado}" (${nombreParts.length} cuvinte)`);
        // Dacă găsim un singur rezultat și numele detectat are doar un cuvânt, confidența este medie
        if (empleado.length === 1 && nombreParts.length === 1) {
          this.logger.debug(`✅ Empleado găsit (după primul nume - un singur rezultat): ${empleado[0]['NOMBRE / APELLIDOS']}`);
          return { ...empleado[0], confianza: 60, matchType: 'primer_nombre_unico' };
        }
        
        // Dacă numele detectat are mai multe cuvinte, verificăm dacă se potrivesc
        if (nombreParts.length > 1) {
          const segundoNombre = nombreParts[1];
          this.logger.debug(`🔍 Verificăm al doilea nume "${segundoNombre}" în ${empleado.length} rezultate`);
          let bestMatch: { CODIGO: string; 'NOMBRE / APELLIDOS': string } | null = null;
          let bestConfianza = 0;
          
          for (const emp of empleado) {
            const empUpper = emp['NOMBRE / APELLIDOS'].toUpperCase();
            const empWords = empUpper.split(/\s+/).filter(w => w.length > 0);
            const empWordsSet = new Set(empWords);
            
            // Verificăm dacă al doilea nume se potrivește
            const tieneSegundoNombre = empWordsSet.has(segundoNombre);
            this.logger.debug(`🔍 Verificăm "${emp['NOMBRE / APELLIDOS']}": al doilea nume "${segundoNombre}" ${tieneSegundoNombre ? 'SE POTRIVEȘTE' : 'NU se potrivește'}`);
            
            if (tieneSegundoNombre) {
              // Calculăm confidența: câte cuvinte se potrivesc
              let matchedWords = 0;
              for (const word of nombreParts) {
                if (empWordsSet.has(word)) {
                  matchedWords++;
                }
              }
              const confianza = Math.round((matchedWords / nombreParts.length) * 100);
              
              // Dacă toate cuvintele se potrivesc, returnăm imediat
              if (confianza === 100) {
                this.logger.debug(`✅ Empleado găsit (după primul + al doilea nume - 100%): ${emp['NOMBRE / APELLIDOS']}`);
                return { ...emp, confianza: 100, matchType: 'primer_segundo_nombre' };
              }
              
              // Păstrăm cel mai bun match
              if (confianza > bestConfianza) {
                bestConfianza = confianza;
                bestMatch = emp;
              }
            }
          }
          
          // Dacă am găsit un match cu al doilea nume, returnăm cel mai bun
          if (bestMatch && bestConfianza >= 50) {
            this.logger.debug(`✅ Empleado găsit (după primul + al doilea nume - ${bestConfianza}%): ${bestMatch['NOMBRE / APELLIDOS']}`);
            return { ...bestMatch, confianza: bestConfianza, matchType: 'primer_segundo_nombre' };
          }
          
          // Dacă nu găsim potrivire pentru al doilea nume, NU returnăm nimic
          // (sau returnăm cu confidență foarte scăzută doar dacă este un singur rezultat)
          if (empleado.length === 1) {
            // Dacă este un singur rezultat, dar al doilea nume nu se potrivește, confidența este foarte scăzută
            this.logger.warn(`⚠️ Un singur empleado găsit după primul nume "${nombreParts[0]}", dar al doilea nume "${nombreParts[1]}" nu se potrivește cu "${empleado[0]['NOMBRE / APELLIDOS']}". Confidența foarte scăzută.`);
            return { ...empleado[0], confianza: 30, matchType: 'primer_nombre_sin_segundo' };
          } else {
            // Dacă sunt mai multe rezultate și al doilea nume nu se potrivește, nu returnăm nimic
            this.logger.warn(`⚠️ Múltiples empleados encontrados por primer nombre "${nombreParts[0]}", pero segundo nombre "${nombreParts[1]}" no coincide. No se retorna automáticamente.`);
            return null;
          }
        }
        
        // Dacă numele detectat are doar un cuvânt
        if (nombreParts.length === 1) {
          // Dacă este un singur rezultat, confidența este medie
          if (empleado.length === 1) {
            this.logger.debug(`✅ Empleado găsit (după primul nume - un singur rezultat): ${empleado[0]['NOMBRE / APELLIDOS']}`);
            return { ...empleado[0], confianza: 60, matchType: 'primer_nombre_unico' };
          }
          
          // Dacă sunt mai multe rezultate, confidența este foarte scăzută
          this.logger.warn(`⚠️ Múltiples empleados encontrados por primer nombre "${nombreParts[0]}". Confidența scăzută.`);
          return { ...empleado[0], confianza: 40, matchType: 'primer_nombre_multiple' };
        }
        
        // Nu ar trebui să ajungem aici, dar pentru siguranță
        return null;
      }
    }

    // 7. Căutare după ultimul nume (apellido) - dacă numele detectat are cel puțin 2 cuvinte
    if (nombreParts.length >= 2) {
      const ultimoNombre = nombreParts[nombreParts.length - 1];
      if (ultimoNombre.length >= 3) {
        empleadoQuery = `
          SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
          FROM \`DatosEmpleados\`
          WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`%${ultimoNombre}%`)}
          LIMIT 10
        `;
        empleado = await this.prisma.$queryRawUnsafe<
          Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
        >(empleadoQuery);

        if (empleado.length > 0) {
          // Verificăm dacă primul nume se potrivește
          if (nombreParts.length > 0) {
            const primerNombre = nombreParts[0];
            for (const emp of empleado) {
              const empUpper = emp['NOMBRE / APELLIDOS'].toUpperCase();
              if (empUpper.includes(primerNombre)) {
                // Calculăm confidența
                const empWords = empUpper.split(/\s+/).filter(w => w.length > 0);
                const empWordsSet = new Set(empWords);
                let matchedWords = 0;
                for (const word of nombreParts) {
                  if (empWordsSet.has(word)) {
                    matchedWords++;
                  }
                }
                const confianza = Math.round((matchedWords / nombreParts.length) * 100);
                this.logger.debug(`✅ Empleado găsit (după ultimul + primul nume - ${confianza}%): ${emp['NOMBRE / APELLIDOS']}`);
                return { ...emp, confianza, matchType: 'ultimo_primer_nombre' };
              }
            }
          }
          
          // Dacă nu găsim potrivire perfectă, confidența este scăzută
          this.logger.debug(`✅ Empleado găsit (după ultimul nume - confidența scăzută): ${empleado[0]['NOMBRE / APELLIDOS']}`);
          return { ...empleado[0], confianza: 50, matchType: 'ultimo_nombre' };
        }
      }
    }

    // 8. Căutare după orice cuvânt din nume (ultimul rezort) - doar dacă numele are cel puțin 3 caractere
    if (nombreParts.length >= 1) {
      // Căutăm după cel mai lung cuvânt (cel mai probabil să fie nume sau apellido)
      const palabrasOrdenadas = [...nombreParts].sort((a, b) => b.length - a.length);
      for (const palabra of palabrasOrdenadas) {
        if (palabra.length >= 4) { // Doar cuvinte de cel puțin 4 caractere
          empleadoQuery = `
            SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
            FROM \`DatosEmpleados\`
            WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`%${palabra}%`)}
            LIMIT 5
          `;
          empleado = await this.prisma.$queryRawUnsafe<
            Array<{ CODIGO: string; 'NOMBRE / APELLIDOS': string }>
          >(empleadoQuery);

          if (empleado.length > 0) {
            // Căutarea după un singur cuvânt are confidența foarte scăzută
            this.logger.debug(`✅ Empleado găsit (după cuvânt "${palabra}" - confidența foarte scăzută): ${empleado[0]['NOMBRE / APELLIDOS']}`);
            return { ...empleado[0], confianza: 30, matchType: 'palabra_unica' };
          }
        }
      }
    }

    this.logger.warn(`⚠️ Empleado NU a fost găsit pentru: ${nombreDetectado}${nifDetectado ? ` (NIF: ${nifDetectado})` : ''}${segSocialDetectado ? ` (SS: ${segSocialDetectado})` : ''}`);
    return null;
  }

  /**
   * Obține statistici pentru un an dat
   */
  async getStats(ano: number): Promise<{
    empleados_activos: number;
    con_nomina: number;
    sin_nomina: number;
  }> {
    try {
      // Total angajați activi
      const totalActivosQuery = `
        SELECT COUNT(*) as total
        FROM \`DatosEmpleados\`
        WHERE \`ESTADO\` = 'ACTIVO'
      `;
      const totalActivos = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        totalActivosQuery,
      );
      const empleados_activos = Number(totalActivos[0]?.total || 0);

      // Angajați cu nómina pentru anul dat (cel puțin o lună)
      const conNominaQuery = `
        SELECT COUNT(DISTINCT e.\`CODIGO\`) as total
        FROM \`DatosEmpleados\` e
        WHERE e.\`ESTADO\` = 'ACTIVO'
          AND EXISTS (
            SELECT 1
            FROM \`Nominas\` n
            WHERE n.\`Ano\` = ${this.escapeSql(ano.toString())}
              AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
          )
      `;
      const conNomina = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        conNominaQuery,
      );
      const con_nomina = Number(conNomina[0]?.total || 0);

      // Debug: verificăm ce nóminas există pentru anul dat
      const debugNominasQuery = `
        SELECT n.\`nombre\`, n.\`Mes\`, n.\`Ano\`, e.\`CODIGO\`, e.\`NOMBRE / APELLIDOS\`
        FROM \`Nominas\` n
        LEFT JOIN \`DatosEmpleados\` e ON TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
        WHERE n.\`Ano\` = ${this.escapeSql(ano.toString())}
        LIMIT 10
      `;
      const debugNominas = await this.prisma.$queryRawUnsafe<any[]>(debugNominasQuery);
      this.logger.log(`🔍 Debug: Nóminas pentru anul ${ano}: ${JSON.stringify(debugNominas)}`);

      const sin_nomina = empleados_activos - con_nomina;

      return {
        empleados_activos,
        con_nomina,
        sin_nomina,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting stats for year ${ano}:`, error);
      throw new BadRequestException(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Obține lista de angajați cu status nómina pentru un an dat
   */
  async getEmpleadosMatrix(
    ano: number,
    options?: {
      pendientes?: boolean; // Doar cei fără nómina
      q?: string; // Căutare
      centro?: string; // Filtrare după centru
    },
  ): Promise<
    Array<{
      CODIGO: string;
      nombre_completo: string;
      CENTRO_TRABAJO: string;
      ESTADO: string;
      nominas: Array<{ mes: number; tiene_nomina: boolean }>;
    }>
  > {
    try {
      let whereClause = `WHERE e.\`ESTADO\` = 'ACTIVO'`;

      // Filtrare după centru
      if (options?.centro) {
        whereClause += ` AND e.\`CENTRO TRABAJO\` LIKE ${this.escapeSql(`%${options.centro}%`)}`;
      }

      // Căutare
      if (options?.q) {
        const searchTerm = options.q.trim();
        whereClause += ` AND (
          e.\`CODIGO\` LIKE ${this.escapeSql(`%${searchTerm}%`)}
          OR e.\`NOMBRE / APELLIDOS\` LIKE ${this.escapeSql(`%${searchTerm}%`)}
          OR e.\`CORREO ELECTRONICO\` LIKE ${this.escapeSql(`%${searchTerm}%`)}
        )`;
      }

      // Mapăm numerele de lună la numele în spaniolă (pentru compatibilitate cu datele existente)
      // Acceptăm atât nume cât și număr pentru fiecare lună
      const mesesConditions = {
        '1': `(n.\`Mes\` = 'Enero' OR n.\`Mes\` = '1')`,
        '2': `(n.\`Mes\` = 'Febrero' OR n.\`Mes\` = '2')`,
        '3': `(n.\`Mes\` = 'Marzo' OR n.\`Mes\` = '3')`,
        '4': `(n.\`Mes\` = 'Abril' OR n.\`Mes\` = '4')`,
        '5': `(n.\`Mes\` = 'Mayo' OR n.\`Mes\` = '5')`,
        '6': `(n.\`Mes\` = 'Junio' OR n.\`Mes\` = '6')`,
        '7': `(n.\`Mes\` = 'Julio' OR n.\`Mes\` = '7')`,
        '8': `(n.\`Mes\` = 'Agosto' OR n.\`Mes\` = '8')`,
        '9': `(n.\`Mes\` = 'Septiembre' OR n.\`Mes\` = '9')`,
        '10': `(n.\`Mes\` = 'Octubre' OR n.\`Mes\` = '10')`,
        '11': `(n.\`Mes\` = 'Noviembre' OR n.\`Mes\` = '11')`,
        '12': `(n.\`Mes\` = 'Diciembre' OR n.\`Mes\` = '12')`,
      };

      const query = `
        SELECT 
          e.\`CODIGO\`,
          e.\`NOMBRE / APELLIDOS\` AS nombre_completo,
          e.\`CENTRO TRABAJO\` AS CENTRO_TRABAJO,
          e.\`ESTADO\`,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['1']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_ene,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['2']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_feb,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['3']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_mar,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['4']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_abr,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['5']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_may,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['6']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_jun,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['7']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_jul,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['8']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_ago,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['9']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_sep,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['10']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_oct,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['11']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_nov,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM \`Nominas\` n
              WHERE ${mesesConditions['12']} AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
                AND TRIM(UPPER(n.\`nombre\`)) = TRIM(UPPER(e.\`NOMBRE / APELLIDOS\`))
            ) THEN 1 ELSE 0 END AS tiene_dic
        FROM \`DatosEmpleados\` e
        ${whereClause}
        ORDER BY e.\`CENTRO TRABAJO\`, e.\`NOMBRE / APELLIDOS\`
      `;

      const results = await this.prisma.$queryRawUnsafe<any[]>(query);

      // Debug: logăm primul rezultat pentru a vedea valorile
      if (results.length > 0) {
        this.logger.log(`🔍 Debug: Primul empleado - CODIGO: ${results[0].CODIGO}, nombre: ${results[0].nombre_completo}`);
        this.logger.log(`🔍 Debug: Valori tiene_* - ene: ${results[0].tiene_ene}, feb: ${results[0].tiene_feb}, mar: ${results[0].tiene_mar}`);
      }

      // Transformăm rezultatele
      const empleados = results.map((row) => {
        // Convertim valorile la boolean (pot veni ca bigint, number, etc.)
        const nominas = [
          { mes: 1, tiene_nomina: Number(row.tiene_ene) === 1 },
          { mes: 2, tiene_nomina: Number(row.tiene_feb) === 1 },
          { mes: 3, tiene_nomina: Number(row.tiene_mar) === 1 },
          { mes: 4, tiene_nomina: Number(row.tiene_abr) === 1 },
          { mes: 5, tiene_nomina: Number(row.tiene_may) === 1 },
          { mes: 6, tiene_nomina: Number(row.tiene_jun) === 1 },
          { mes: 7, tiene_nomina: Number(row.tiene_jul) === 1 },
          { mes: 8, tiene_nomina: Number(row.tiene_ago) === 1 },
          { mes: 9, tiene_nomina: Number(row.tiene_sep) === 1 },
          { mes: 10, tiene_nomina: Number(row.tiene_oct) === 1 },
          { mes: 11, tiene_nomina: Number(row.tiene_nov) === 1 },
          { mes: 12, tiene_nomina: Number(row.tiene_dic) === 1 },
        ];
        
        // Debug: logăm dacă angajatul are cel puțin o lună cu nómina
        const tieneAlguna = nominas.some(n => n.tiene_nomina);
        if (tieneAlguna) {
          this.logger.log(`✅ Empleado con nómina encontrado: ${row.nombre_completo} (CODIGO: ${row.CODIGO})`);
        }

        // Dacă filtrăm doar pendientes, verificăm dacă are cel puțin o lună fără nómina
        if (options?.pendientes) {
          const tieneTodas = nominas.every((n) => n.tiene_nomina);
          if (tieneTodas) {
            return null; // Excludem din rezultate
          }
        }

        return {
          CODIGO: row.CODIGO,
          nombre_completo: row.nombre_completo || '',
          CENTRO_TRABAJO: row.CENTRO_TRABAJO || '',
          ESTADO: row.ESTADO || '',
          nominas,
        };
      }).filter(Boolean);

      return empleados;
    } catch (error: any) {
      this.logger.error(`❌ Error getting empleados matrix for year ${ano}:`, error);
      throw new BadRequestException(
        `Error al obtener matriz de empleados: ${error.message}`,
      );
    }
  }

  /**
   * Obține lista de nóminas pentru un angajat în luna/anul specificat
   */
  async getNominasForEmpleado(
    employeeNombre: string,
    mes?: number,
    ano?: number,
  ): Promise<
    Array<{
      id: number;
      nombre: string;
      fecha_subida: string; // ISO string format for JSON serialization
      tipo_mime: string;
      Mes: string;
      Ano: string;
    }>
  > {
    try {
      const nombreNormalized = employeeNombre.trim().toUpperCase();

      let whereClause = `WHERE TRIM(UPPER(n.\`nombre\`)) = ${this.escapeSql(nombreNormalized)}`;

      if (mes !== undefined) {
        // Mapăm numărul lunii la numele în spaniolă (pentru compatibilitate)
        const mesesNombres = {
          1: 'Enero',
          2: 'Febrero',
          3: 'Marzo',
          4: 'Abril',
          5: 'Mayo',
          6: 'Junio',
          7: 'Julio',
          8: 'Agosto',
          9: 'Septiembre',
          10: 'Octubre',
          11: 'Noviembre',
          12: 'Diciembre',
        };
        const nombreMes = mesesNombres[mes as keyof typeof mesesNombres];
        // Acceptăm atât nume cât și număr
        whereClause += ` AND (n.\`Mes\` = ${this.escapeSql(nombreMes)} OR n.\`Mes\` = ${this.escapeSql(mes.toString())})`;
      }

      if (ano !== undefined) {
        whereClause += ` AND n.\`Ano\` = ${this.escapeSql(ano.toString())}`;
      }

      const query = `
        SELECT 
          n.\`id\`,
          n.\`nombre\`,
          n.\`fecha_subida\`,
          n.\`tipo_mime\`,
          n.\`Mes\`,
          n.\`Ano\`
        FROM \`Nominas\` n
        ${whereClause}
        ORDER BY n.\`Ano\` DESC, n.\`Mes\` DESC, n.\`fecha_subida\` DESC
      `;

      this.logger.log(`🔍 Query getNominasForEmpleado: ${query}`);
      this.logger.log(`🔍 Params: employeeNombre=${employeeNombre}, mes=${mes}, ano=${ano}`);

      const results = await this.prisma.$queryRawUnsafe<any[]>(query);
      
      this.logger.log(`📄 Results count: ${results.length}`);
      
      // Convert all fields to JSON-safe types BEFORE any JSON.stringify
      const convertedResults = results.map((row) => {
        // Convert all fields to JSON-safe types
        const fechaSubida = row.fecha_subida;
        let fechaSubidaStr: string;
        if (fechaSubida instanceof Date) {
          fechaSubidaStr = fechaSubida.toISOString();
        } else if (fechaSubida) {
          fechaSubidaStr = new Date(fechaSubida).toISOString();
        } else {
          fechaSubidaStr = new Date().toISOString();
        }

        return {
          id: Number(row.id), // Convert BigInt to Number for JSON serialization
          nombre: String(row.nombre || ''),
          fecha_subida: fechaSubidaStr,
          tipo_mime: String(row.tipo_mime || 'application/pdf'),
          Mes: String(row.Mes || ''),
          Ano: String(row.Ano || ''),
        };
      });

      if (convertedResults.length > 0) {
        this.logger.log(`📄 First result: ${JSON.stringify(convertedResults[0])}`);
      }

      return convertedResults;
    } catch (error: any) {
      this.logger.error(
        `❌ Error getting nominas for employee ${employeeNombre}:`,
        error,
      );
      throw new BadRequestException(
        `Error al obtener nóminas: ${error.message}`,
      );
    }
  }

  /**
   * Upload single nómina
   */
  async uploadNomina(
    file: Express.Multer.File,
    nombre: string,
    mes: number,
    ano: number,
    codigo?: string,
    preview: boolean = false,
  ): Promise<{ 
    success: true; 
    id?: number; 
    nombre: string;
    esFiniquito?: boolean;
    actualizaraEstado?: boolean;
    estadoActual?: string;
    fechaAltaDB?: string;
    fechaAntiguedadDB?: string;
    fechaBajaDB?: string;
    fechaAltaExtraida?: string;
    fechaBajaExtraida?: string;
    fechaAntiguedadExtraida?: string;
    actualizaraFechaAlta?: boolean;
    actualizaraFechaAntiguedad?: boolean;
    actualizaraFechaBaja?: boolean;
    tieneFiniquitoExistente?: boolean;
  }> {
    try {
      // Dacă avem CODIGO, rezolvăm numele complet
      let nombreFinal = nombre.trim();
      if (codigo && !nombreFinal) {
        const empleadoQuery = `
          SELECT \`NOMBRE / APELLIDOS\`
          FROM \`DatosEmpleados\`
          WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
          LIMIT 1
        `;
        const empleado = await this.prisma.$queryRawUnsafe<Array<{ 'NOMBRE / APELLIDOS': string }>>(
          empleadoQuery,
        );
        if (empleado.length > 0) {
          nombreFinal = empleado[0]['NOMBRE / APELLIDOS'] || '';
        }
      }

      if (!nombreFinal) {
        throw new BadRequestException('Nombre del empleado es requerido');
      }

      // Detectăm dacă este finiquito (extragem textul din PDF)
      let esFiniquito = false;
      let textContent: string = '';
      if (file.buffer) {
        try {
          const pdfParseModule = require('pdf-parse');
          const PDFParse = pdfParseModule.PDFParse;
          const pdfInstance = new PDFParse({ data: new Uint8Array(file.buffer) });
          const textResult = await pdfInstance.getText();
          textContent = (textResult && typeof textResult === 'object' && 'text' in textResult) 
            ? textResult.text 
            : (typeof textResult === 'string' ? textResult : '');
          esFiniquito = this.detectarFiniquito(textContent);
          if (esFiniquito) {
            this.logger.log(`🔍 Finiquito detectat pentru ${nombreFinal}`);
          }
        } catch (pdfError: any) {
          // Dacă nu putem extrage textul, continuăm fără detecție
          this.logger.warn(`⚠️ Nu s-a putut extrage textul din PDF pentru detecție finiquito: ${pdfError.message}`);
        }
      }

      // Adăugăm prefix "FINIQUITO - " dacă e detectat
      const nombreFinalConTipo = esFiniquito 
        ? `FINIQUITO - ${nombreFinal}`
        : nombreFinal;

      // Verificăm duplicate
      const nombreNormalized = nombreFinalConTipo.trim().toUpperCase();
      const duplicateCheck = `
        SELECT \`id\`
        FROM \`Nominas\`
        WHERE \`Mes\` = ${this.escapeSql(mes.toString())}
          AND \`Ano\` = ${this.escapeSql(ano.toString())}
          AND TRIM(UPPER(\`nombre\`)) = ${this.escapeSql(nombreNormalized)}
        LIMIT 1
      `;
      const duplicate = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        duplicateCheck,
      );

      if (duplicate.length > 0) {
        throw new BadRequestException(
          `Ya existe una nómina para ${nombreFinalConTipo} en ${mes}/${ano}`,
        );
      }

      // Verificăm statusul actual al angajatului dacă este finiquito (pentru preview)
      // Și extragem Fecha Antigüedad și Fecha Baja pentru finiquitos
      // Pentru nóminas, extragem doar Fecha Antigüedad
      let estadoActual: string | null = null;
      let actualizaraEstado = false;
      let fechaAltaDB: string | null = null;
      let fechaAntiguedadDB: string | null = null;
      let fechaBajaDB: string | null = null;
      let fechaAltaExtraida: string | null = null;
      let fechaBajaExtraida: string | null = null;
      let fechaAntiguedadExtraida: string | null = null;
      let tieneFiniquitoExistente = false;
      let tieneFechaBajaEnDB = false;
      
      // Obținem datele din DB pentru toate nóminas (nu doar finiquitos)
      const codigoParaVerificar = codigo || await this.obtenerCodigoPorNombre(nombreFinal);
      
      if (codigoParaVerificar) {
        // Obținem statusul și datele existente din DB
        const empleadoQuery = `
          SELECT 
            \`ESTADO\`,
            \`FECHA DE ALTA\`,
            \`Fecha Antigüedad\`,
            \`FECHA BAJA\`
          FROM \`DatosEmpleados\`
          WHERE \`CODIGO\` = ${this.escapeSql(codigoParaVerificar)}
          LIMIT 1
        `;
        const empleadoResult = await this.prisma.$queryRawUnsafe<Array<{
          ESTADO: string;
          'FECHA DE ALTA': string | null;
          'Fecha Antigüedad': string | null;
          'FECHA BAJA': string | null;
        }>>(empleadoQuery);
        
        if (empleadoResult.length > 0) {
          estadoActual = empleadoResult[0]?.ESTADO?.trim().toUpperCase() || null;
          if (esFiniquito) {
            actualizaraEstado = estadoActual === 'ACTIVO';
          }
          fechaAltaDB = empleadoResult[0]?.['FECHA DE ALTA'] || null;
          fechaAntiguedadDB = empleadoResult[0]?.['Fecha Antigüedad'] || null;
          fechaBajaDB = empleadoResult[0]?.['FECHA BAJA'] || null;
          
          // Dacă angajatul are FECHA BAJA setată, excludem nómina (doar pentru nóminas normale, nu finiquitos)
          if (!esFiniquito && fechaBajaDB && fechaBajaDB.trim() !== '') {
            tieneFechaBajaEnDB = true;
            this.logger.warn(`⚠️ Angajatul ${nombreFinal} (CODIGO: ${codigoParaVerificar}) are deja FECHA BAJA setată (${fechaBajaDB}). Nómina va fi exclusă.`);
          }
        }
      }
      
      // Dacă este o nómina normală (nu finiquito), verificăm dacă angajatul are deja un finiquito urcat
      if (!esFiniquito && codigoParaVerificar && !tieneFechaBajaEnDB) {
        const finiquitoCheck = `
          SELECT \`id\`, \`nombre\`, \`Mes\`, \`Ano\`
          FROM \`Nominas\`
          WHERE TRIM(UPPER(\`nombre\`)) LIKE ${this.escapeSql(`%FINIQUITO%${nombreFinal.toUpperCase()}%`)}
            OR TRIM(UPPER(\`nombre\`)) LIKE ${this.escapeSql(`%FINIQUITO - ${nombreFinal.toUpperCase()}%`)}
          LIMIT 1
        `;
        const finiquitoExistente = await this.prisma.$queryRawUnsafe<Array<{
          id: number;
          nombre: string;
          Mes: string;
          Ano: string;
        }>>(finiquitoCheck);
        
        if (finiquitoExistente.length > 0) {
          tieneFiniquitoExistente = true;
          this.logger.warn(`⚠️ Angajatul ${nombreFinal} (CODIGO: ${codigoParaVerificar}) are deja un finiquito urcat: ${finiquitoExistente[0].nombre} (${finiquitoExistente[0].Mes}/${finiquitoExistente[0].Ano})`);
        }
      }
      
      // Extragem datele din PDF (nu depinde de codigo)
      if (textContent) {
        this.logger.debug(`🔍 Extragem datele din PDF pentru uploadNomina, codigo: ${codigoParaVerificar || 'null'}`);
        // Pentru toate nóminas (inclusiv finiquitos), extragem Fecha Antigüedad
        fechaAntiguedadExtraida = this.extraerFechaAntiguedad(textContent);
        this.logger.debug(`📅 Fecha Antigüedad extrasă: ${fechaAntiguedadExtraida || 'null'}`);
        
        // Pentru finiquitos, extragem și Fecha Baja
        if (esFiniquito) {
          fechaBajaExtraida = this.extraerFechaBaja(textContent);
          this.logger.debug(`📅 Fecha Baja extrasă: ${fechaBajaExtraida || 'null'}`);
        }
        
        // Fecha Alta Extrasa = Fecha Antigüedad Extrasa (pentru toate nóminas)
        if (fechaAntiguedadExtraida) {
          fechaAltaExtraida = fechaAntiguedadExtraida;
        }
      } else {
        this.logger.warn(`⚠️ textContent este gol pentru uploadNomina`);
      }

      // Dacă este preview mode, returnăm informații fără să salvăm
      if (preview) {
        this.logger.log(
          `🔍 Preview nómina: ${nombreFinalConTipo} - ${mes}/${ano}${esFiniquito ? ' (FINIQUITO detectat)' : ''}`,
        );
        
        // Calculăm ce se va actualiza dacă nu sunt setate în DB
        const actualizaraFechaAlta = !fechaAltaDB && fechaAltaExtraida ? true : false;
        const actualizaraFechaAntiguedad = !fechaAntiguedadDB && fechaAntiguedadExtraida ? true : false;
        const actualizaraFechaBaja = esFiniquito && fechaBajaExtraida ? true : false; // Notă: Fecha Baja se folosește pentru FECHA DE ALTA dacă nu există
        
        return {
          success: true,
          nombre: nombreFinalConTipo,
          esFiniquito,
          actualizaraEstado,
          estadoActual: estadoActual || undefined,
          fechaAltaDB: fechaAltaDB || undefined,
          fechaAntiguedadDB: fechaAntiguedadDB || undefined,
          fechaBajaDB: fechaBajaDB || undefined,
          fechaAltaExtraida: fechaAltaExtraida || undefined,
          fechaBajaExtraida: fechaBajaExtraida || undefined,
          fechaAntiguedadExtraida: fechaAntiguedadExtraida || undefined,
          actualizaraFechaAlta,
          actualizaraFechaAntiguedad,
          actualizaraFechaBaja,
        };
      }

      // Salvăm nómina DOAR dacă nu este preview mode
      const insertQuery = `
        INSERT INTO \`Nominas\` (
          \`nombre\`,
          \`archivo\`,
          \`tipo_mime\`,
          \`fecha_subida\`,
          \`Mes\`,
          \`Ano\`
        ) VALUES (
          ${this.escapeSql(nombreFinalConTipo)},
          ${file.buffer ? `FROM_BASE64(${this.escapeSql(file.buffer.toString('base64'))})` : 'NULL'},
          ${this.escapeSql(file.mimetype || 'application/pdf')},
          NOW(),
          ${this.escapeSql(mes.toString())},
          ${this.escapeSql(ano.toString())}
        )
      `;

      await this.prisma.$executeRawUnsafe(insertQuery);

      // Obținem ID-ul inserat
      const getIdQuery = `
        SELECT \`id\`
        FROM \`Nominas\`
        WHERE \`nombre\` = ${this.escapeSql(nombreFinalConTipo)}
          AND \`Mes\` = ${this.escapeSql(mes.toString())}
          AND \`Ano\` = ${this.escapeSql(ano.toString())}
        ORDER BY \`fecha_subida\` DESC
        LIMIT 1
      `;
      const inserted = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        getIdQuery,
      );

      this.logger.log(
        `✅ Nómina uploaded: ${nombreFinalConTipo} - ${mes}/${ano} (ID: ${inserted[0]?.id})`,
      );

      // Folosim codigo dacă există, altfel căutăm după nume (fără prefixul "FINIQUITO - " dacă e finiquito)
      const codigoParaActualizar = codigo || await this.obtenerCodigoPorNombre(nombreFinal);
      
      if (codigoParaActualizar) {
        // Dacă este finiquito, actualizăm statusul angajatului la INACTIVO dacă este încă ACTIVO
        if (esFiniquito) {
          await this.actualizarEstadoEmpleadoSiActivo(codigoParaActualizar);
        }
        
        // Pentru toate nóminas (normale și finiquitos), extragem/actualizăm Fecha Antigüedad
        // Pentru finiquitos, extragem și Fecha Baja
        let fechaAlta: string | null = null;
        let fechaAntiguedad: string | null = null;
        let fechaBaja: string | null = null;
        
        try {
          if (textContent) {
            fechaAntiguedad = this.extraerFechaAntiguedad(textContent);
            // Fecha Alta = Fecha Antigüedad extrasă
            fechaAlta = fechaAntiguedad;
            
            if (esFiniquito) {
              fechaBaja = this.extraerFechaBaja(textContent);
            }
            
            // Actualizăm datele în baza de date dacă nu sunt setate
            if (fechaAlta || fechaAntiguedad || fechaBaja) {
              await this.actualizarFechasEmpleado(codigoParaActualizar, fechaAlta, fechaAntiguedad, fechaBaja, esFiniquito);
            }
          }
        } catch (error: any) {
          this.logger.error(`❌ Eroare la extragerea fechas din ${esFiniquito ? 'finiquito' : 'nómina'}:`, error);
        }
      } else {
        this.logger.warn(`⚠️ Nu s-a găsit CODIGO pentru ${nombreFinal} - datele nu au fost actualizate`);
      }

      // Trimite notificare către angajat când se publică nómina
      try {
        // Găsește CODIGO-ul angajatului după nume
        const empleadoQuery = `
          SELECT \`CODIGO\`
          FROM \`DatosEmpleados\`
          WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) = ${this.escapeSql(nombreFinal.trim().toUpperCase())}
          LIMIT 1
        `;
        const empleado = await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(
          empleadoQuery,
        );

        if (empleado.length > 0 && empleado[0].CODIGO) {
          const mesesNombres = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
          ];
          const mesNombre = typeof mes === 'number' && mes >= 1 && mes <= 12
            ? mesesNombres[mes - 1].charAt(0).toUpperCase() + mesesNombres[mes - 1].slice(1)
            : mes.toString();

          await this.notificationsService.notifyUser(
            'system',
            empleado[0].CODIGO,
            {
              type: 'info',
              title: '💰 Nueva Nómina Disponible',
              message: `Tu nómina de ${mesNombre} ${ano} está disponible para descargar`,
              data: {
                nominaId: inserted[0]?.id || 0,
                mes: mesNombre,
                ano: ano.toString(),
                nombre: nombreFinal,
              },
            },
          );
          this.logger.log(
            `📬 Notificare trimisă către angajat ${empleado[0].CODIGO} pentru nómina ${mes}/${ano}`,
          );
        } else {
          this.logger.warn(
            `⚠️ Nu s-a găsit CODIGO pentru angajat "${nombreFinal}" - notificare nu a fost trimisă`,
          );
        }
      } catch (notifError: any) {
        // Nu oprește procesul dacă notificarea eșuează
        this.logger.warn(
          `⚠️ Eroare la trimiterea notificării pentru nómina: ${notifError.message}`,
        );
      }

      return {
        success: true,
        id: inserted[0]?.id || 0,
        nombre: nombreFinalConTipo,
        esFiniquito,
        actualizaraEstado: false, // Deja actualizat
        fechaAltaDB: fechaAltaDB || undefined,
        fechaAntiguedadDB: fechaAntiguedadDB || undefined,
        fechaAltaExtraida: fechaAltaExtraida || undefined,
        fechaBajaExtraida: fechaBajaExtraida || undefined,
        fechaAntiguedadExtraida: fechaAntiguedadExtraida || undefined,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`❌ Error uploading nómina:`, error);
      throw new BadRequestException(`Error al subir nómina: ${error.message}`);
    }
  }

  /**
   * Upload bulk PDF cu multiple pagini
   * Fiecare pagină = o nómina
   * TODO: Instalar pdf-lib y pdf-parse: npm install pdf-lib pdf-parse
   */
  async uploadBulkNominas(
    file: Express.Multer.File,
    mes?: number, // Opcional - se poate detecta din PDF
    ano?: number, // Opcional - se poate detecta din PDF
    preview: boolean = false, // Si preview = true, nu salvează în DB
    forceReplace: Array<{ pagina: number; codigo: string; nombre: string }> = [], // Lista de duplicate-uri marcate pentru înlocuire
    forceFechaBaja: Array<{ pagina: number; codigo: string; nombre: string }> = [], // Lista de nóminas marcate pentru salvare chiar dacă au FECHA BAJA
  ): Promise<{
    total_paginas: number;
    procesadas: number;
    erori: number;
    mes_detectado?: number;
    ano_detectado?: number;
    detalle: Array<{
      pagina: number;
      nombre_detectado: string | null;
      mes_detectado: number | null;
      ano_detectado: number | null;
      empleado_encontrado: string | null;
      codigo: string | null;
      inserted: boolean;
      error: string | null;
      esFiniquito?: boolean;
      actualizaraEstado?: boolean;
      estadoActual?: string | null;
      fechaAltaDB?: string;
      fechaAntiguedadDB?: string;
      fechaBajaDB?: string;
      fechaAltaExtraida?: string;
      fechaBajaExtraida?: string;
      fechaAntiguedadExtraida?: string;
      actualizaraFechaAlta?: boolean;
      actualizaraFechaAntiguedad?: boolean;
      actualizaraFechaBaja?: boolean;
      tieneFiniquitoExistente?: boolean;
    }>;
  }> {
    try {
      if (!file.buffer) {
        throw new BadRequestException('Archivo vacío');
      }

      // Código activado - dependencias instaladas
      const pdfLib = require('pdf-lib');
      const pdfParseModule = require('pdf-parse');
      const PDFParse = pdfParseModule.PDFParse;
      
      const mesesNombres = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const pdfDoc = await pdfLib.PDFDocument.load(file.buffer);
      const totalPages = pdfDoc.getPageCount();

      const detalle: Array<{
        pagina: number;
        nombre_detectado: string | null;
        mes_detectado: number | null;
        ano_detectado: number | null;
        empleado_encontrado: string | null;
        codigo: string | null;
        inserted: boolean;
        error: string | null;
        esFiniquito?: boolean;
        fechaAltaDB?: string;
        fechaAntiguedadDB?: string;
        fechaBajaDB?: string;
        tieneFiniquitoExistente?: boolean;
        fechaAltaExtraida?: string;
        fechaBajaExtraida?: string;
        fechaAntiguedadExtraida?: string;
        actualizaraEstado?: boolean;
        estadoActual?: string | null;
        actualizaraFechaAlta?: boolean;
        actualizaraFechaAntiguedad?: boolean;
        actualizaraFechaBaja?: boolean;
      }> = [];

      let procesadas = 0;
      let erori = 0;

      // Procesăm fiecare pagină
      for (let i = 0; i < totalPages; i++) {
        try {
          // Extragem pagina ca PDF separat
          const newPdfDoc = await pdfLib.PDFDocument.create();
          const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
          newPdfDoc.addPage(copiedPage);
          const pagePdfBytes = await newPdfDoc.save();

          // Extragem textul din pagină pentru a detecta numele
          // pdf-parse necesită Uint8Array, nu Buffer
          const pdfBuffer = Buffer.from(pagePdfBytes);
          const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
          
          // getText() returnează un obiect cu proprietatea 'text'
          const pageTextResult = await pdfInstance.getText();
          const textContent = (pageTextResult && typeof pageTextResult === 'object' && 'text' in pageTextResult) 
            ? pageTextResult.text 
            : (typeof pageTextResult === 'string' ? pageTextResult : '');
          
          this.logger.debug(`📄 Page ${i + 1} text length: ${textContent.length}, first 200 chars: ${textContent.substring(0, 200)}`);

          // Încercăm să detectăm numele din text
          // Numele este în dreapta sus după "TRABAJADOR /A"
          let nombreDetectado: string | null = null;

          // Extragem primele 15 linii pentru analiză
          const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          this.logger.debug(`📄 Page ${i + 1} first 15 lines:`, lines.slice(0, 15));

          // Pattern 1: Căutăm numele după "Periodo de liquidación.:" - numele este pe următoarea linie cu format "NUME\tDE CAMINO"
          for (let idx = 0; idx < lines.length; idx++) {
            if (lines[idx].match(/Periodo\s+de\s+liquidación/i)) {
              // Numele este pe următoarea linie (idx + 1)
              if (idx + 1 < lines.length) {
                const nombreLine = lines[idx + 1];
                // Format: "NUME\tDE CAMINO S. AUXILIARES SL" - extragem partea dinainte de tab
                if (nombreLine && nombreLine.includes('\t')) {
                  nombreDetectado = nombreLine.split('\t')[0].trim();
                  this.logger.debug(`✅ Page ${i + 1} - Nume detectat (Pattern 1 - Periodo + Tab): ${nombreDetectado}`);
                  break;
                }
                // Sau dacă nu are tab, luăm până la "DE CAMINO"
                if (nombreLine && nombreLine.includes('DE CAMINO')) {
                  nombreDetectado = nombreLine.split('DE CAMINO')[0].trim();
                  this.logger.debug(`✅ Page ${i + 1} - Nume detectat (Pattern 1 - DE CAMINO): ${nombreDetectado}`);
                  break;
                }
                // Sau dacă linia conține doar numele (fără "DE CAMINO"), o luăm direct
                if (nombreLine && nombreLine.trim().length > 5 && 
                    !nombreLine.match(/^(EMPRESA|N\.I\.F\.|Núm|Ocupación|Seg\.|Social|del\s+\d+)/i) &&
                    /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}/.test(nombreLine)) {
                  nombreDetectado = nombreLine.trim();
                  this.logger.debug(`✅ Page ${i + 1} - Nume detectat (Pattern 1 - Direct): ${nombreDetectado}`);
                  break;
                }
              }
            }
          }

          // Pattern 2: Căutăm "TRABAJADOR /A" și apoi numele pe următoarele linii (fallback)
          if (!nombreDetectado) {
            for (let idx = 0; idx < Math.min(lines.length, 10); idx++) {
              if (lines[idx].match(/TRABAJADOR\s*\/A/i)) {
                // Căutăm numele în următoarele 3 linii după TRABAJADOR /A
                for (let j = idx + 1; j < Math.min(idx + 4, lines.length); j++) {
                  const candidateLine = lines[j];
                  // Verificăm că nu este o etichetă (N.I.F., Ocupación, etc.)
                  if (candidateLine && 
                      !candidateLine.match(/^(N\.I\.F\.|Núm|Ocupación|Seg\.|Social|EMPRESA|del\s+\d+)/i) &&
                      /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}/.test(candidateLine)) {
                    // Extragem numele până la N.I.F. sau până la sfârșitul liniei
                    const nombreMatch = candidateLine.match(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+N\.I\.F\.|$)/);
                    if (nombreMatch) {
                      nombreDetectado = nombreMatch[1].trim();
                      this.logger.debug(`✅ Page ${i + 1} - Nume detectat (Pattern 2): ${nombreDetectado}`);
                      break;
                    }
                  }
                }
                if (nombreDetectado) break;
              }
            }
          }

          // Detectăm luna și anul din PDF
          // Format: "del 1 de noviembre al 30 de noviembre de 2.025"
          let mesDetectado: number | null = null;
          let anoDetectado: number | null = null;

          const mesesNombres = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
          ];

          // Pattern 1: "del X de [mes] al Y de [mes] de [an]" (ex: "del 1 de noviembre al 30 de noviembre de 2.025")
          // Anul poate fi "2.025" (cu punct) sau "2025" (fără punct)
          const periodoMatch = textContent.match(/del\s+\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+al\s+\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{1,4}(?:\.\d{1,4})?)/i);
          if (periodoMatch) {
            const mesNombre = periodoMatch[2].toLowerCase(); // Al doilea mes (cel de la sfârșit)
            const mesIndex = mesesNombres.findIndex(m => m === mesNombre);
            if (mesIndex >= 0) {
              mesDetectado = mesIndex + 1; // 1-12
              // Anul poate fi "2.025" sau "2025" - eliminăm punctul și convertim
              const anoStr = periodoMatch[3].replace(/\./g, '');
              const anoNum = parseInt(anoStr, 10);
              // Dacă anul este < 100, înseamnă că era "2.025" și trebuie să fie 2025
              if (anoNum < 100 && anoNum >= 2) {
                anoDetectado = 2000 + anoNum; // 2 -> 2002, dar pentru 2.025 trebuie 2025
                // Verificăm dacă formatul original era "2.025"
                if (periodoMatch[3].includes('.')) {
                  const parts = periodoMatch[3].split('.');
                  if (parts.length === 2) {
                    anoDetectado = parseInt(parts[0] + parts[1], 10); // "2" + "025" = 2025
                  }
                }
              } else {
                anoDetectado = anoNum;
              }
              this.logger.debug(`✅ Page ${i + 1} - Mes/Ano detectat (Pattern 1): mes=${mesDetectado}, ano=${anoDetectado} (original: ${periodoMatch[3]})`);
            }
          }

          // Pattern 2: "de [mes] de [an]" (ex: "de noviembre de 2025")
          if (!mesDetectado) {
            const mesAnoMatch = textContent.match(/de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{1,4})/i);
            if (mesAnoMatch) {
              const mesNombre = mesAnoMatch[1].toLowerCase();
              const mesIndex = mesesNombres.findIndex(m => m === mesNombre);
              if (mesIndex >= 0) {
                mesDetectado = mesIndex + 1;
                const anoStr = mesAnoMatch[2].replace(/\./g, '');
                anoDetectado = parseInt(anoStr, 10);
              }
            }
          }

          // Pattern 3: Căutăm nume de lună cu an (ex: "NOVIEMBRE 2025", "noviembre 2.025")
          if (!mesDetectado) {
            for (let idx = 0; idx < mesesNombres.length; idx++) {
              const mesNombre = mesesNombres[idx];
              const mesNombreUpper = mesNombre.toUpperCase();
              // Căutăm "noviembre 2.025" sau "NOVIEMBRE 2025"
              const mesMatch = textContent.match(
                new RegExp(`(${mesNombre}|${mesNombreUpper})\\s+(\\d{1,4})`, 'i')
              );
              if (mesMatch) {
                const anoStr = mesMatch[2].replace(/\./g, '');
                const anoNum = parseInt(anoStr, 10);
                if (anoNum >= 2000 && anoNum <= 2100) {
                  mesDetectado = idx + 1; // 1-12
                  anoDetectado = anoNum;
                  break;
                }
              }
            }
          }

          // Extragem NIF și număr de securitate socială din PDF
          let nifDetectado: string | null = null;
          let segSocialDetectado: string | null = null;

          // Pattern pentru NIF: "N.I.F.: Y8480886H" sau "N.I.F.: Y7549044K"
          // Căutăm în toate liniile pentru a găsi NIF-ul
          for (const line of lines) {
            const nifMatch = line.match(/N\.I\.F\.:\s*([A-Z0-9]{8,12})/i);
            if (nifMatch) {
              nifDetectado = nifMatch[1].trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
              this.logger.debug(`✅ Page ${i + 1} - NIF detectat: ${nifDetectado}`);
              break;
            }
          }

          // Pattern pentru număr de securitate socială: "Núm afiliación Seg. Social: 281621290066"
          // Căutăm în toate liniile pentru a găsi numărul de securitate socială
          for (const line of lines) {
            const segSocialMatch = line.match(/Núm\s+afiliación\s+Seg\.\s+Social:\s*(\d{10,15})/i);
            if (segSocialMatch) {
              segSocialDetectado = segSocialMatch[1].trim().replace(/\s+/g, '');
              this.logger.debug(`✅ Page ${i + 1} - Seg. Social detectat: ${segSocialDetectado}`);
              break;
            }
          }

          // Logging pentru debugging
          this.logger.debug(`📄 Page ${i + 1} - nombreDetectado: ${nombreDetectado}, mesDetectado: ${mesDetectado}, anoDetectado: ${anoDetectado}, NIF: ${nifDetectado}, SS: ${segSocialDetectado}`);

          // Folosim mes/ano detectat sau cel furnizat
          const mesFinal = mesDetectado || mes;
          const anoFinal = anoDetectado || ano;

          // Dacă nu am detectat numele, marcăm ca eroare
          if (!nombreDetectado) {
            // Logging detaliat pentru debugging
            this.logger.warn(`⚠️ Page ${i + 1} - Numele nu a fost detectat. Primele 20 linii:`, lines.slice(0, 20));
            // Căutăm "Periodo de liquidación" pentru a vedea ce se întâmplă
            const periodoIndex = lines.findIndex(l => l.match(/Periodo\s+de\s+liquidación/i));
            if (periodoIndex >= 0) {
              this.logger.warn(`⚠️ Page ${i + 1} - "Periodo de liquidación" găsit la index ${periodoIndex}, următoarele 3 linii:`, 
                lines.slice(periodoIndex, periodoIndex + 4));
            } else {
              this.logger.warn(`⚠️ Page ${i + 1} - "Periodo de liquidación" NU a fost găsit în primele ${lines.length} linii`);
            }
            
            detalle.push({
              pagina: i + 1,
              nombre_detectado: null,
              mes_detectado: mesDetectado,
              ano_detectado: anoDetectado,
              empleado_encontrado: null,
              codigo: null,
              inserted: false,
              error: 'nombre_no_detectado',
            });
            erori++;
            continue;
          }

          // Verificăm dacă avem mes și ano (fie detectat, fie furnizat)
          if (!mesFinal || !anoFinal) {
            detalle.push({
              pagina: i + 1,
              nombre_detectado: nombreDetectado,
              mes_detectado: mesDetectado,
              ano_detectado: anoDetectado,
              empleado_encontrado: null,
              codigo: null,
              inserted: false,
              error: 'mes_o_ano_no_detectado',
            });
            erori++;
            continue;
          }

          // Căutăm angajatul în baza de date (potrivire flexibilă)
          const empleadoEncontrado = await this.findEmpleadoFlexible(
            nombreDetectado,
            nifDetectado,
            segSocialDetectado,
          );

          if (!empleadoEncontrado) {
            detalle.push({
              pagina: i + 1,
              nombre_detectado: nombreDetectado,
              mes_detectado: mesDetectado,
              ano_detectado: anoDetectado,
              empleado_encontrado: null,
              codigo: null,
              inserted: false,
              error: 'employee_not_found',
            });
            erori++;
            continue;
          }

          const codigo = empleadoEncontrado.CODIGO;
          const nombreCompleto = empleadoEncontrado['NOMBRE / APELLIDOS'] || '';
          const confianza = empleadoEncontrado.confianza || 0;
          // Dacă confidența este < 80%, logăm un warning
          if (confianza < 80) {
            this.logger.warn(`⚠️ Potrivire cu confidență scăzută (${confianza}%) pentru "${nombreDetectado}" -> "${nombreCompleto}" (${codigo})`);
          }
          const nombreNormalized = nombreCompleto.trim().toUpperCase();

          // Detectăm dacă este finiquito
          // Logăm un sample din text pentru debugging
          const textSample = textContent.substring(0, 1000).toLowerCase();
          this.logger.debug(`📄 Page ${i + 1} - Text sample (first 1000 chars): ${textSample.substring(0, 500)}...`);
          
          // Căutăm pattern-uri specifice finiquito
          const tieneLiquidacionBajaFiniquito = textContent.toLowerCase().includes('liquidación, baja y finiquito');
          const tieneSeExtingue = textContent.toLowerCase().includes('se extingue la relación laboral');
          const tieneFiniquitoCompleto = textContent.toLowerCase().includes('liquidación, baja y finiquito por todos los conceptos');
          
          this.logger.debug(`🔍 Page ${i + 1} - Pattern checks: tieneLiquidacionBajaFiniquito=${tieneLiquidacionBajaFiniquito}, tieneSeExtingue=${tieneSeExtingue}, tieneFiniquitoCompleto=${tieneFiniquitoCompleto}`);
          
          const esFiniquito = this.detectarFiniquito(textContent);
          const nombreFinal = esFiniquito 
            ? `FINIQUITO - ${nombreCompleto}`
            : nombreCompleto;
          
          if (esFiniquito) {
            this.logger.log(`🔍 Page ${i + 1} - Finiquito detectat pentru ${nombreCompleto}${preview ? ' (PREVIEW - nu se va salva)' : ''}`);
          } else {
            this.logger.debug(`📄 Page ${i + 1} - Nu este finiquito pentru ${nombreCompleto}`);
          }

          // Verificăm dacă această pagină este marcată pentru înlocuire forțată
          const shouldForceReplace = forceReplace.some(
            fr => fr.pagina === (i + 1) && fr.codigo === codigo
          );
          
          // Verificăm duplicate
          const nombreNormalizedParaDuplicate = nombreFinal.trim().toUpperCase();
          const duplicateCheck = `
            SELECT \`id\`
            FROM \`Nominas\`
            WHERE (\`Mes\` = ${this.escapeSql(mesFinal.toString())} OR \`Mes\` = ${this.escapeSql(mesesNombres[mesFinal - 1])})
              AND \`Ano\` = ${this.escapeSql(anoFinal.toString())}
              AND TRIM(UPPER(\`nombre\`)) = ${this.escapeSql(nombreNormalizedParaDuplicate)}
            LIMIT 1
          `;
          const duplicate = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
            duplicateCheck,
          );

          // Dacă este duplicate dar e marcat pentru înlocuire forțată, continuăm procesarea normală
          if (duplicate.length > 0 && !shouldForceReplace) {
            // Verificăm statusul actual al angajatului dacă este finiquito (pentru preview)
            // Și extragem datele pentru toate nóminas (nu doar finiquitos)
            let estadoActual: string | null = null;
            let actualizaraEstado = false;
            let fechaAltaDB: string | null = null;
            let fechaAntiguedadDB: string | null = null;
            let fechaBajaDB: string | null = null;
            let fechaAltaExtraida: string | null = null;
            let fechaBajaExtraida: string | null = null;
            let fechaAntiguedadExtraida: string | null = null;
            let tieneFiniquitoExistente = false;
            let tieneFechaBajaEnDB = false;
            
            // Obținem datele din DB pentru toate nóminas (nu doar finiquitos)
            if (codigo) {
              const empleadoQuery = `
                SELECT 
                  \`ESTADO\`,
                  \`FECHA DE ALTA\`,
                  \`Fecha Antigüedad\`,
                  \`FECHA BAJA\`
                FROM \`DatosEmpleados\`
                WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
                LIMIT 1
              `;
              const empleadoResult = await this.prisma.$queryRawUnsafe<Array<{
                ESTADO: string;
                'FECHA DE ALTA': string | null;
                'Fecha Antigüedad': string | null;
                'FECHA BAJA': string | null;
              }>>(empleadoQuery);
              
              if (empleadoResult.length > 0) {
                estadoActual = empleadoResult[0]?.ESTADO?.trim().toUpperCase() || null;
                if (esFiniquito) {
                  actualizaraEstado = estadoActual === 'ACTIVO';
                }
                fechaAltaDB = empleadoResult[0]?.['FECHA DE ALTA'] || null;
                fechaAntiguedadDB = empleadoResult[0]?.['Fecha Antigüedad'] || null;
                fechaBajaDB = empleadoResult[0]?.['FECHA BAJA'] || null;
                
                // Dacă angajatul are FECHA BAJA setată, excludem nómina (doar pentru nóminas normale, nu finiquitos)
                if (!esFiniquito && fechaBajaDB && fechaBajaDB.trim() !== '') {
                  tieneFechaBajaEnDB = true;
                  this.logger.warn(`⚠️ Angajatul ${nombreCompleto} (CODIGO: ${codigo}) are deja FECHA BAJA setată (${fechaBajaDB}). Nómina va fi exclusă.`);
                }
              }
            }
            
            // Dacă este o nómina normală (nu finiquito), verificăm dacă angajatul are deja un finiquito urcat
            if (!esFiniquito && codigo && !tieneFechaBajaEnDB) {
              const finiquitoCheck = `
                SELECT \`id\`, \`nombre\`, \`Mes\`, \`Ano\`
                FROM \`Nominas\`
                WHERE TRIM(UPPER(\`nombre\`)) LIKE ${this.escapeSql(`%FINIQUITO%${nombreCompleto.toUpperCase()}%`)}
                  OR TRIM(UPPER(\`nombre\`)) LIKE ${this.escapeSql(`%FINIQUITO - ${nombreCompleto.toUpperCase()}%`)}
                LIMIT 1
              `;
              const finiquitoExistente = await this.prisma.$queryRawUnsafe<Array<{
                id: number;
                nombre: string;
                Mes: string;
                Ano: string;
              }>>(finiquitoCheck);
              
              if (finiquitoExistente.length > 0) {
                tieneFiniquitoExistente = true;
                this.logger.warn(`⚠️ Angajatul ${nombreCompleto} (CODIGO: ${codigo}) are deja un finiquito urcat: ${finiquitoExistente[0].nombre} (${finiquitoExistente[0].Mes}/${finiquitoExistente[0].Ano})`);
              }
            }
            
            // Extragem datele din PDF (nu depinde de codigo)
            if (textContent) {
              this.logger.debug(`🔍 Extragem datele din PDF pentru pagina ${i + 1}, codigo: ${codigo || 'null'}`);
              // Pentru toate nóminas (inclusiv finiquitos), extragem Fecha Antigüedad
              fechaAntiguedadExtraida = this.extraerFechaAntiguedad(textContent);
              this.logger.debug(`📅 Fecha Antigüedad extrasă: ${fechaAntiguedadExtraida || 'null'}`);
              
              // Pentru finiquitos, extragem și Fecha Baja
              if (esFiniquito) {
                fechaBajaExtraida = this.extraerFechaBaja(textContent);
                this.logger.debug(`📅 Fecha Baja extrasă: ${fechaBajaExtraida || 'null'}`);
              }
              
              // Fecha Alta Extrasa = Fecha Antigüedad Extrasa (pentru toate nóminas)
              if (fechaAntiguedadExtraida) {
                fechaAltaExtraida = fechaAntiguedadExtraida;
              }
            } else {
              this.logger.warn(`⚠️ textContent este gol pentru pagina ${i + 1}`);
            }
            
            // Dacă angajatul are FECHA BAJA setată și este o nómina normală, marchez ca eroare
            if (tieneFechaBajaEnDB && !esFiniquito) {
              detalle.push({
                pagina: i + 1,
                nombre_detectado: nombreDetectado,
                mes_detectado: mesDetectado,
                ano_detectado: anoDetectado,
                empleado_encontrado: nombreCompleto,
                codigo: codigo,
                inserted: false,
                error: `fecha_baja_establecida:${fechaBajaDB}`, // Format special pentru a putea extrage data
                esFiniquito: esFiniquito,
                actualizaraEstado: actualizaraEstado,
                estadoActual: estadoActual,
                fechaAltaDB: fechaAltaDB || undefined,
                fechaAntiguedadDB: fechaAntiguedadDB || undefined,
                fechaBajaDB: fechaBajaDB || undefined,
                fechaAltaExtraida: fechaAltaExtraida || undefined,
                fechaBajaExtraida: fechaBajaExtraida || undefined,
                fechaAntiguedadExtraida: fechaAntiguedadExtraida || undefined,
                actualizaraFechaAlta: false,
                actualizaraFechaAntiguedad: false,
                actualizaraFechaBaja: false,
                tieneFiniquitoExistente,
              });
              erori++;
              continue;
            }
            
            // Calculăm ce se va actualiza dacă nu sunt setate în DB
            const actualizaraFechaAlta = !fechaAltaDB && fechaAltaExtraida ? true : false;
            const actualizaraFechaAntiguedad = !fechaAntiguedadDB && fechaAntiguedadExtraida ? true : false;
            const actualizaraFechaBaja = esFiniquito && fechaBajaExtraida ? true : false;
            
            detalle.push({
              pagina: i + 1,
              nombre_detectado: nombreDetectado,
              mes_detectado: mesDetectado,
              ano_detectado: anoDetectado,
              empleado_encontrado: nombreCompleto,
              codigo: codigo,
              inserted: false,
              error: 'duplicate',
              esFiniquito: esFiniquito,
              actualizaraEstado: actualizaraEstado,
              estadoActual: estadoActual,
              fechaAltaDB: fechaAltaDB || undefined,
              fechaAntiguedadDB: fechaAntiguedadDB || undefined,
              fechaBajaDB: fechaBajaDB || undefined,
              fechaAltaExtraida: fechaAltaExtraida || undefined,
              fechaBajaExtraida: fechaBajaExtraida || undefined,
              fechaAntiguedadExtraida: fechaAntiguedadExtraida || undefined,
              actualizaraFechaAlta,
              actualizaraFechaAntiguedad,
              actualizaraFechaBaja,
              tieneFiniquitoExistente,
            });
            erori++;
            continue;
          }

          // Verificăm statusul actual al angajatului dacă este finiquito (pentru preview)
          // Și extragem datele pentru toate nóminas (nu doar finiquitos)
          let estadoActual: string | null = null;
          let actualizaraEstado = false;
          let fechaAltaDB: string | null = null;
          let fechaAntiguedadDB: string | null = null;
          let fechaBajaDB: string | null = null;
          let fechaAltaExtraida: string | null = null;
          let fechaBajaExtraida: string | null = null;
          let fechaAntiguedadExtraida: string | null = null;
          let tieneFiniquitoExistente = false;
          let tieneFechaBajaEnDB = false;
          
          // Obținem datele din DB pentru toate nóminas (nu doar finiquitos)
          if (codigo) {
            const empleadoQuery = `
              SELECT 
                \`ESTADO\`,
                \`FECHA DE ALTA\`,
                \`Fecha Antigüedad\`,
                \`FECHA BAJA\`
              FROM \`DatosEmpleados\`
              WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
              LIMIT 1
            `;
            const empleadoResult = await this.prisma.$queryRawUnsafe<Array<{
              ESTADO: string;
              'FECHA DE ALTA': string | null;
              'Fecha Antigüedad': string | null;
              'FECHA BAJA': string | null;
            }>>(empleadoQuery);
            
            if (empleadoResult.length > 0) {
              estadoActual = empleadoResult[0]?.ESTADO?.trim().toUpperCase() || null;
              if (esFiniquito) {
                actualizaraEstado = estadoActual === 'ACTIVO';
              }
              fechaAltaDB = empleadoResult[0]?.['FECHA DE ALTA'] || null;
              fechaAntiguedadDB = empleadoResult[0]?.['Fecha Antigüedad'] || null;
              fechaBajaDB = empleadoResult[0]?.['FECHA BAJA'] || null;
              
              // Dacă angajatul are FECHA BAJA setată, excludem nómina (doar pentru nóminas normale, nu finiquitos)
              if (!esFiniquito && fechaBajaDB && fechaBajaDB.trim() !== '') {
                tieneFechaBajaEnDB = true;
                this.logger.warn(`⚠️ Angajatul ${nombreCompleto} (CODIGO: ${codigo}) are deja FECHA BAJA setată (${fechaBajaDB}). Nómina va fi exclusă.`);
              }
            }
          }
          
          // Dacă este o nómina normală (nu finiquito), verificăm dacă angajatul are deja un finiquito urcat
          if (!esFiniquito && codigo && !tieneFechaBajaEnDB) {
            const finiquitoCheck = `
              SELECT \`id\`, \`nombre\`, \`Mes\`, \`Ano\`
              FROM \`Nominas\`
              WHERE TRIM(UPPER(\`nombre\`)) LIKE ${this.escapeSql(`%FINIQUITO%${nombreCompleto.toUpperCase()}%`)}
                OR TRIM(UPPER(\`nombre\`)) LIKE ${this.escapeSql(`%FINIQUITO - ${nombreCompleto.toUpperCase()}%`)}
              LIMIT 1
            `;
            const finiquitoExistente = await this.prisma.$queryRawUnsafe<Array<{
              id: number;
              nombre: string;
              Mes: string;
              Ano: string;
            }>>(finiquitoCheck);
            
            if (finiquitoExistente.length > 0) {
              tieneFiniquitoExistente = true;
              this.logger.warn(`⚠️ Angajatul ${nombreCompleto} (CODIGO: ${codigo}) are deja un finiquito urcat: ${finiquitoExistente[0].nombre} (${finiquitoExistente[0].Mes}/${finiquitoExistente[0].Ano})`);
            }
          }
          
          // Verificăm dacă această pagină este marcată pentru salvare forțată chiar dacă are FECHA BAJA
          const shouldForceFechaBaja = forceFechaBaja.some(
            fb => fb.pagina === (i + 1) && fb.codigo === codigo
          );
          
          // Dacă angajatul are FECHA BAJA setată și este o nómina normală, marchez ca eroare (dacă nu e marcat pentru forțare)
          if (tieneFechaBajaEnDB && !esFiniquito && !shouldForceFechaBaja) {
            detalle.push({
              pagina: i + 1,
              nombre_detectado: nombreDetectado,
              mes_detectado: mesDetectado,
              ano_detectado: anoDetectado,
              empleado_encontrado: nombreCompleto,
              codigo: codigo,
              inserted: false,
              error: `fecha_baja_establecida:${fechaBajaDB}`, // Format special pentru a putea extrage data
              esFiniquito: esFiniquito,
              actualizaraEstado: actualizaraEstado,
              estadoActual: estadoActual,
              fechaAltaDB: fechaAltaDB || undefined,
              fechaAntiguedadDB: fechaAntiguedadDB || undefined,
              fechaBajaDB: fechaBajaDB || undefined,
              fechaAltaExtraida: fechaAltaExtraida || undefined,
              fechaBajaExtraida: fechaBajaExtraida || undefined,
              fechaAntiguedadExtraida: fechaAntiguedadExtraida || undefined,
              actualizaraFechaAlta: false,
              actualizaraFechaAntiguedad: false,
              actualizaraFechaBaja: false,
              tieneFiniquitoExistente,
            });
            erori++;
            continue;
          }
          
          // Extragem datele din PDF (nu depinde de codigo)
          if (textContent) {
            this.logger.debug(`🔍 Extragem datele din PDF pentru pagina ${i + 1}, codigo: ${codigo || 'null'}`);
            // Pentru toate nóminas (inclusiv finiquitos), extragem Fecha Antigüedad
            fechaAntiguedadExtraida = this.extraerFechaAntiguedad(textContent);
            this.logger.debug(`📅 Fecha Antigüedad extrasă: ${fechaAntiguedadExtraida || 'null'}`);
            
            // Pentru finiquitos, extragem și Fecha Baja
            if (esFiniquito) {
              fechaBajaExtraida = this.extraerFechaBaja(textContent);
              this.logger.debug(`📅 Fecha Baja extrasă: ${fechaBajaExtraida || 'null'}`);
            }
            
            // Fecha Alta Extrasa = Fecha Antigüedad Extrasa (pentru toate nóminas)
            if (fechaAntiguedadExtraida) {
              fechaAltaExtraida = fechaAntiguedadExtraida;
            }
          } else {
            this.logger.warn(`⚠️ textContent este gol pentru pagina ${i + 1}`);
          }

          // Salvăm nómina DOAR dacă nu este preview mode
          let inserted = false;
          if (!preview) {
            const mesNombre = mesesNombres[mesFinal - 1];
            
            // Dacă este duplicate dar e marcat pentru înlocuire, facem UPDATE
            if (duplicate.length > 0 && shouldForceReplace) {
              const updateQuery = `
                UPDATE \`Nominas\`
                SET 
                  \`archivo\` = FROM_BASE64(${this.escapeSql(Buffer.from(pagePdfBytes).toString('base64'))}),
                  \`fecha_subida\` = NOW(),
                  \`tipo_mime\` = 'application/pdf'
                WHERE \`id\` = ${duplicate[0].id}
              `;
              await this.prisma.$executeRawUnsafe(updateQuery);
              this.logger.log(`🔄 Nómina actualizată (forceReplace): ${nombreFinal} - ID: ${duplicate[0].id}`);
              inserted = true;
            } else if (!duplicate.length || shouldForceReplace) {
              // INSERT normal (dacă nu e duplicate sau e marcat pentru înlocuire dar nu e duplicate - caz rar)
              const insertQuery = `
                INSERT INTO \`Nominas\` (
                  \`nombre\`,
                  \`archivo\`,
                  \`tipo_mime\`,
                  \`fecha_subida\`,
                  \`Mes\`,
                  \`Ano\`
                ) VALUES (
                  ${this.escapeSql(nombreFinal)},
                  FROM_BASE64(${this.escapeSql(Buffer.from(pagePdfBytes).toString('base64'))}),
                  'application/pdf',
                  NOW(),
                  ${this.escapeSql(mesNombre)},
                  ${this.escapeSql(anoFinal.toString())}
                )
              `;

              await this.prisma.$executeRawUnsafe(insertQuery);
              inserted = true;
            }

            // Dacă este finiquito, actualizăm statusul angajatului la INACTIVO dacă este încă ACTIVO
            // Și extragem/actualizăm Fecha Antigüedad și Fecha Baja
            if (esFiniquito && codigo) {
              await this.actualizarEstadoEmpleadoSiActivo(codigo);
              
              // Extragem Fecha Antigüedad și Fecha Baja din textul PDF
              try {
                if (textContent) {
                  const fechaAntiguedad = this.extraerFechaAntiguedad(textContent);
                  // Fecha Alta = Fecha Antigüedad extrasă
                  const fechaAlta = fechaAntiguedad;
                  const fechaBaja = this.extraerFechaBaja(textContent);
                  
                  // Actualizăm datele în baza de date dacă nu sunt setate
                  if (fechaAlta || fechaAntiguedad || fechaBaja) {
                    await this.actualizarFechasEmpleado(codigo, fechaAlta, fechaAntiguedad, fechaBaja, esFiniquito);
                  }
                }
              } catch (error: any) {
                this.logger.error(`❌ Eroare la extragerea fechas din finiquito (bulk):`, error);
              }
            } else if (!esFiniquito && codigo && inserted) {
              // Pentru nóminas normale, actualizăm FECHA DE ALTA și Fecha Antigüedad dacă nu sunt setate
              try {
                if (textContent) {
                  const fechaAntiguedad = this.extraerFechaAntiguedad(textContent);
                  // Fecha Alta = Fecha Antigüedad extrasă
                  const fechaAlta = fechaAntiguedad;
                  
                  // Actualizăm datele în baza de date dacă nu sunt setate (nu trimitem fechaBaja pentru nóminas normale)
                  if (fechaAlta || fechaAntiguedad) {
                    await this.actualizarFechasEmpleado(codigo, fechaAlta, fechaAntiguedad, null, false);
                  }
                }
              } catch (error: any) {
                this.logger.error(`❌ Eroare la extragerea fechas din nómina (bulk):`, error);
              }
            }
          }

          // Calculăm ce se va actualiza dacă nu sunt setate în DB
          const actualizaraFechaAlta = !fechaAltaDB && fechaAltaExtraida ? true : false;
          const actualizaraFechaAntiguedad = !fechaAntiguedadDB && fechaAntiguedadExtraida ? true : false;
          const actualizaraFechaBaja = esFiniquito && fechaBajaExtraida ? true : false;
          
          detalle.push({
            pagina: i + 1,
            nombre_detectado: nombreDetectado,
            mes_detectado: mesDetectado,
            ano_detectado: anoDetectado,
            empleado_encontrado: nombreCompleto,
            codigo: codigo,
            inserted: inserted,
            error: null,
            esFiniquito: esFiniquito,
            actualizaraEstado: actualizaraEstado,
            estadoActual: estadoActual,
            fechaAltaDB: fechaAltaDB || undefined,
            fechaAntiguedadDB: fechaAntiguedadDB || undefined,
            fechaBajaDB: fechaBajaDB || undefined,
            fechaAltaExtraida: fechaAltaExtraida || undefined,
            fechaBajaExtraida: fechaBajaExtraida || undefined,
            fechaAntiguedadExtraida: fechaAntiguedadExtraida || undefined,
            actualizaraFechaAlta,
            actualizaraFechaAntiguedad,
            actualizaraFechaBaja,
          });
          procesadas++;

          // Trimite notificare către angajat când se publică nómina (doar dacă nu e preview)
          if (inserted && codigo) {
            try {
              const mesesNombres = [
                'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
              ];
              const mesNombre = mesFinal && mesFinal >= 1 && mesFinal <= 12
                ? mesesNombres[mesFinal - 1].charAt(0).toUpperCase() + mesesNombres[mesFinal - 1].slice(1)
                : mesDetectado?.toString() || '';

              await this.notificationsService.notifyUser(
                'system',
                codigo,
                {
                  type: 'info',
                  title: '💰 Nueva Nómina Disponible',
                  message: `Tu nómina de ${mesNombre} ${anoFinal} está disponible para descargar`,
                  data: {
                    nominaId: null, // Nu avem ID-ul încă în bulk upload
                    mes: mesNombre,
                    ano: anoFinal.toString(),
                    nombre: nombreCompleto,
                  },
                },
              );
              this.logger.log(
                `📬 Notificare trimisă către angajat ${codigo} pentru nómina bulk ${mesFinal}/${anoFinal}`,
              );
            } catch (notifError: any) {
              // Nu oprește procesul dacă notificarea eșuează
              this.logger.warn(
                `⚠️ Eroare la trimiterea notificării pentru nómina bulk (pagina ${i + 1}): ${notifError.message}`,
              );
            }
          }
        } catch (pageError: any) {
          const errorMessage = pageError?.message || String(pageError) || 'unknown_error';
          this.logger.error(`❌ Error processing page ${i + 1}:`, errorMessage);
          if (pageError?.stack) {
            this.logger.error(`❌ Error stack (first 200 chars):`, pageError.stack.substring(0, 200));
          }
          detalle.push({
            pagina: i + 1,
            nombre_detectado: null,
            mes_detectado: null,
            ano_detectado: null,
            empleado_encontrado: null,
            codigo: null,
            inserted: false,
            error: `error_procesamiento: ${errorMessage}`,
          });
          erori++;
        }
      }

      // Detectăm mes și ano global din PDF (din prima pagină sau din majoritatea paginilor)
      let mesGlobal: number | null = null;
      let anoGlobal: number | null = null;
      
      // Căutăm mes/ano în detalle (majoritatea paginilor ar trebui să aibă același mes/ano)
      const mesCounts: { [key: number]: number } = {};
      const anoCounts: { [key: number]: number } = {};
      
      detalle.forEach(item => {
        if (item.mes_detectado) {
          mesCounts[item.mes_detectado] = (mesCounts[item.mes_detectado] || 0) + 1;
        }
        if (item.ano_detectado) {
          anoCounts[item.ano_detectado] = (anoCounts[item.ano_detectado] || 0) + 1;
        }
      });
      
      // Găsim mes/ano cel mai frecvent
      const mesMasFrecuente = Object.keys(mesCounts).reduce((a, b) => 
        mesCounts[parseInt(a, 10)] > mesCounts[parseInt(b, 10)] ? a : b, 
        Object.keys(mesCounts)[0] || ''
      );
      const anoMasFrecuente = Object.keys(anoCounts).reduce((a, b) => 
        anoCounts[parseInt(a, 10)] > anoCounts[parseInt(b, 10)] ? a : b, 
        Object.keys(anoCounts)[0] || ''
      );
      
      if (mesMasFrecuente) mesGlobal = parseInt(mesMasFrecuente, 10);
      if (anoMasFrecuente) anoGlobal = parseInt(anoMasFrecuente, 10);

      this.logger.log(
        `✅ Bulk upload completed: ${procesadas}/${totalPages} procesadas, ${erori} errores`,
      );

      return {
        total_paginas: totalPages,
        procesadas,
        erori,
        mes_detectado: mesGlobal || mes || null,
        ano_detectado: anoGlobal || ano || null,
        detalle,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error in bulk upload:`, error);
      throw new BadRequestException(
        `Error al procesar PDF masivo: ${error.message}`,
      );
    }
  }

  /**
   * Obține nómina pentru download
   */
  async getNominaById(id: number): Promise<{
    archivo: Buffer;
    nombre: string;
    tipo_mime: string;
  }> {
    try {
      const query = `
        SELECT \`archivo\`, \`nombre\`, \`tipo_mime\`
        FROM \`Nominas\`
        WHERE \`id\` = ${this.escapeSql(id.toString())}
        LIMIT 1
      `;
      const result = await this.prisma.$queryRawUnsafe<
        Array<{ archivo: Buffer; nombre: string; tipo_mime: string }>
      >(query);

      if (result.length === 0) {
        throw new NotFoundException(`Nómina con ID ${id} no encontrada`);
      }

      return {
        archivo: result[0].archivo,
        nombre: result[0].nombre || 'nomina.pdf',
        tipo_mime: result[0].tipo_mime || 'application/pdf',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ Error getting nómina ${id}:`, error);
      throw new BadRequestException(`Error al obtener nómina: ${error.message}`);
    }
  }

  /**
   * Șterge nómina
   */
  async deleteNomina(id: number): Promise<{ success: true }> {
    try {
      const deleteQuery = `
        DELETE FROM \`Nominas\`
        WHERE \`id\` = ${this.escapeSql(id.toString())}
      `;
      await this.prisma.$executeRawUnsafe(deleteQuery);

      this.logger.log(`✅ Nómina ${id} eliminada`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting nómina ${id}:`, error);
      throw new BadRequestException(`Error al eliminar nómina: ${error.message}`);
    }
  }

  /**
   * Helper pentru a converti valoarea unei celule la număr
   */
  private parseNumericValue(cell: ExcelJS.Cell): number {
    let value: any = cell.value;
    
    // Dacă este o formulă, folosim rezultatul
    if (cell.type === ExcelJS.ValueType.Formula) {
      value = cell.result;
    }

    // Convertim la număr dacă este posibil
    if (typeof value === 'number') {
      return value;
    } else if (typeof value === 'string' && value.trim() !== '') {
      const numValue = parseFloat(value.replace(',', '.'));
      return isNaN(numValue) ? 0 : numValue;
    } else {
      return 0;
    }
  }

  /**
   * Procesează un fișier Excel Coste Personal
   * @param fileBuffer - Buffer-ul fișierului Excel
   * @returns Datele procesate din Excel
   */
  async procesarCostePersonal(fileBuffer: Buffer | ArrayBuffer): Promise<{
    sheets: Array<{
      name: string;
      mes: string;
      ano: number;
      data: Array<{
        operario: string;
        codigo: string | null;
        nombre_bd: string | null;
        empleado_encontrado: boolean;
        total: number;
        total_calculado: number;
        total_aportaciones: number;
        neto: number;
        aportaciones_trabajador: number;
        irpf: number;
        enfermedad_devolucion: number;
        embargos: number;
        anticipo: number;
        absentismo_laboral: number;
        seg_social_empresa: number;
      }>;
    }>;
  }> {
    try {
      const workbook = new ExcelJS.Workbook();
      // ExcelJS acceptă Buffer, dar TypeScript are probleme cu tipurile
      // Folosim type assertion pentru a rezolva incompatibilitatea de tipuri
      await workbook.xlsx.load(fileBuffer as any);

      const sheets = [];

      for (const worksheet of workbook.worksheets) {
        const sheetName = worksheet.name;
        this.logger.log(`📊 Procesando sheet: ${sheetName}`);

        // Extragem mes și an din numele sheet-ului
        const mesMatch = sheetName.match(/(JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)/i);
        const anoMatch = sheetName.match(/20\d{2}/);
        const mes = mesMatch ? mesMatch[1].toUpperCase() : '';
        const ano = anoMatch ? parseInt(anoMatch[0], 10) : new Date().getFullYear();

        // Citim header-ul (prima linie)
        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        let firstColValue = '';
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const cellValue = cell.value?.toString().trim() || '';
          if (colNumber === 1) {
            firstColValue = cellValue;
            this.logger.debug(`📋 Primera columna (colNumber=1): "${cellValue}"`);
          }
          // Includem toate coloanele, nu doar cele de la colNumber > 1
          // Indexăm corect: colNumber 1 -> index 0, colNumber 2 -> index 1, etc.
          const headerIndex = colNumber - 1;
          headers[headerIndex] = cellValue;
        });
        
        this.logger.debug(`📋 Headers detectados (${headers.length}):`, headers);
        this.logger.debug(`📋 Headers sample:`, headers.slice(0, 5));

        // Procesăm datele (începând cu linia 2)
        const data: Array<any & { orden: number }> = [];
        const rowPromises: Promise<void>[] = [];
        let ordenCounter = 0; // Contor pentru ordinea din Excel
        
        worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const rowData: any = {};
          let hasData = false;
          const currentOrden = ordenCounter++; // Păstrăm ordinea curentă

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            // Indexăm corect: colNumber 1 -> index 0, colNumber 2 -> index 1, etc.
            const headerIndex = colNumber - 1;
            const header = headers[headerIndex];

            if (!header) return;

            // Mapăm header-urile la câmpuri
            switch (header.toUpperCase()) {
              case 'OPERARIO':
                rowData.operario = cell.value?.toString().trim() || '';
                hasData = hasData || rowData.operario !== '';
                break;
              case 'TOTAL':
                rowData.total = this.parseNumericValue(cell);
                hasData = hasData || rowData.total !== 0;
                break;
              case 'NETO':
                rowData.neto = this.parseNumericValue(cell);
                break;
              case 'APORTACIONES TRABAJADOR':
                rowData.aportaciones_trabajador = this.parseNumericValue(cell);
                break;
              case 'IRPF':
                rowData.irpf = this.parseNumericValue(cell);
                break;
              case 'ENFERMEDAD DEVOLUCION':
                rowData.enfermedad_devolucion = this.parseNumericValue(cell);
                break;
              case 'EMBARGOS':
                rowData.embargos = this.parseNumericValue(cell);
                break;
              case 'ANTICIPO ':
              case 'ANTICIPO':
              case 'ANTICIPO/CURSO':
                rowData.anticipo = this.parseNumericValue(cell);
                break;
              case 'ABSENTISMO LABORAL':
                rowData.absentismo_laboral = this.parseNumericValue(cell);
                break;
              case 'SEG SOCIAL EMPRESA':
                rowData.seg_social_empresa = this.parseNumericValue(cell);
                break;
            }
          });

          // Adăugăm rândul doar dacă are date
          if (hasData && rowData.operario) {
            // Căutăm angajatul pentru preview (folosim promise pentru async)
            const promise = (async () => {
              const empleadoEncontrado = await this.findEmpleadoFlexible(
                rowData.operario,
                null,
                null,
              );

              let codigo: string | null = null;
              let nombreBd: string | null = null;
              let empleadoEncontradoFlag = false;

              if (empleadoEncontrado) {
                codigo = empleadoEncontrado.CODIGO;
                nombreBd = empleadoEncontrado['NOMBRE / APELLIDOS'] || null;
                // Marcăm ca "encontrado" doar dacă confidența este >= 80%
                empleadoEncontradoFlag = empleadoEncontrado.confianza >= 80;
              }

              // Calculăm total_calculado: NETO + APORTACIONES_TRABAJADOR + IRPF - ENFERMEDAD_DEVOLUCION + EMBARGOS + ANTICIPO + SEG_SOCIAL_EMPRESA
              const totalCalculado = 
                (rowData.neto || 0) +
                (rowData.aportaciones_trabajador || 0) +
                (rowData.irpf || 0) -
                (rowData.enfermedad_devolucion || 0) +
                (rowData.embargos || 0) +
                (rowData.anticipo || 0) +
                (rowData.seg_social_empresa || 0);

              // Calculăm total_aportaciones: APORTACIONES_TRABAJADOR + SEG_SOCIAL_EMPRESA
              const totalAportaciones = 
                (rowData.aportaciones_trabajador || 0) +
                (rowData.seg_social_empresa || 0);

              data.push({
                orden: currentOrden, // Păstrăm ordinea din Excel
                operario: rowData.operario || '',
                codigo: codigo,
                nombre_bd: nombreBd,
                empleado_encontrado: empleadoEncontradoFlag,
                confianza: empleadoEncontrado?.confianza || 0,
                matchType: empleadoEncontrado?.matchType || 'not_found',
                total: rowData.total || 0,
                total_calculado: totalCalculado,
                neto: rowData.neto || 0,
                aportaciones_trabajador: rowData.aportaciones_trabajador || 0,
                irpf: rowData.irpf || 0,
                enfermedad_devolucion: rowData.enfermedad_devolucion || 0,
                embargos: rowData.embargos || 0,
                anticipo: rowData.anticipo || 0,
                absentismo_laboral: rowData.absentismo_laboral || 0,
                seg_social_empresa: rowData.seg_social_empresa || 0,
                total_aportaciones: totalAportaciones,
              });
            })();
            rowPromises.push(promise);
          } else if (rowData.operario) {
            // Log pentru debugging - de ce nu s-a adăugat rândul
            this.logger.debug(`⚠️ Row ${rowNumber} skipped - hasData: ${hasData}, operario: "${rowData.operario}"`);
          }
        });
        
        // Așteptăm ca toate căutările de angajați să se termine
        await Promise.all(rowPromises);
        
        // Sortăm după ordinea din Excel
        data.sort((a, b) => a.orden - b.orden);
        
        this.logger.debug(`📊 Sheet ${sheetName}: ${data.length} filas procesadas de ${worksheet.rowCount - 1} filas totales`);

        if (data.length > 0) {
          sheets.push({
            name: sheetName,
            mes,
            ano,
            data,
          });
        }
      }

      this.logger.log(`✅ Excel procesado: ${sheets.length} sheets con datos`);
      return { sheets };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando Excel Coste Personal:`, error);
      throw new BadRequestException(
        `Error al procesar Excel: ${error.message}`,
      );
    }
  }

  /**
   * Obține toate datele Coste Personal pentru o lună și an
   */
  async getCostePersonal(mes: string, ano: number): Promise<any[]> {
    try {
      const query = `
        SELECT 
          id,
          codigo_empleado,
          nombre_empleado,
          nombre_bd,
          empleado_encontrado,
          mes,
          ano,
          total,
          total_calculado,
          total_aportaciones,
          neto,
          aportaciones_trabajador,
          irpf,
          enfermedad_devolucion,
          embargos,
          anticipo,
          absentismo_laboral,
          seg_social_empresa
        FROM \`coste_personal\`
        WHERE \`mes\` = ${this.escapeSql(mes)} 
          AND \`ano\` = ${this.escapeSql(ano.toString())}
        ORDER BY \`id\` ASC
      `;
      
      const results = await this.prisma.$queryRawUnsafe<any[]>(query);
      return results.map(row => ({
        id: row.id,
        codigo_empleado: row.codigo_empleado,
        nombre_empleado: row.nombre_empleado,
        nombre_bd: row.nombre_bd || null,
        empleado_encontrado: row.empleado_encontrado === 1 || row.empleado_encontrado === true,
        mes: row.mes,
        ano: row.ano,
        total: parseFloat(row.total?.toString() || '0'),
        total_calculado: parseFloat(row.total_calculado?.toString() || '0'),
        total_aportaciones: parseFloat(row.total_aportaciones?.toString() || '0'),
        neto: parseFloat(row.neto?.toString() || '0'),
        aportaciones_trabajador: parseFloat(row.aportaciones_trabajador?.toString() || '0'),
        irpf: parseFloat(row.irpf?.toString() || '0'),
        enfermedad_devolucion: parseFloat(row.enfermedad_devolucion?.toString() || '0'),
        embargos: parseFloat(row.embargos?.toString() || '0'),
        anticipo: parseFloat(row.anticipo?.toString() || '0'),
        absentismo_laboral: parseFloat(row.absentismo_laboral?.toString() || '0'),
        seg_social_empresa: parseFloat(row.seg_social_empresa?.toString() || '0'),
      }));
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo Coste Personal:`, error);
      throw new BadRequestException(`Error al obtener datos: ${error.message}`);
    }
  }

  /**
   * Salvează sau actualizează date Coste Personal
   */
  async saveCostePersonal(data: {
    codigo_empleado: string;
    nombre_empleado: string;
    nombre_bd?: string | null;
    empleado_encontrado?: boolean;
    mes: string;
    ano: number;
    total: number;
    neto: number;
    aportaciones_trabajador: number;
    irpf: number;
    enfermedad_devolucion: number;
    embargos: number;
    anticipo: number;
    absentismo_laboral: number;
    seg_social_empresa: number;
  }): Promise<any> {
    try {
      // Verificăm dacă există deja
      const existingQuery = `
        SELECT id
        FROM \`coste_personal\`
        WHERE \`codigo_empleado\` = ${this.escapeSql(data.codigo_empleado)}
          AND \`mes\` = ${this.escapeSql(data.mes)}
          AND \`ano\` = ${this.escapeSql(data.ano.toString())}
      `;
      
      const existing = await this.prisma.$queryRawUnsafe<any[]>(existingQuery);
      
      // Calculăm total_aportaciones: APORTACIONES_TRABAJADOR + SEG_SOCIAL_EMPRESA
      const totalAportaciones = 
        (data.aportaciones_trabajador || 0) +
        (data.seg_social_empresa || 0);
      
      if (existing.length > 0) {
        // Actualizăm
        const updateQuery = `
          UPDATE \`coste_personal\`
          SET 
            \`nombre_empleado\` = ${this.escapeSql(data.nombre_empleado)},
            ${data.nombre_bd !== undefined ? `\`nombre_bd\` = ${data.nombre_bd ? this.escapeSql(data.nombre_bd) : 'NULL'},` : ''}
            ${data.empleado_encontrado !== undefined ? `\`empleado_encontrado\` = ${data.empleado_encontrado ? 1 : 0},` : ''}
            \`total\` = ${data.total},
            \`neto\` = ${data.neto},
            \`aportaciones_trabajador\` = ${data.aportaciones_trabajador},
            \`irpf\` = ${data.irpf},
            \`enfermedad_devolucion\` = ${data.enfermedad_devolucion},
            \`embargos\` = ${data.embargos},
            \`anticipo\` = ${data.anticipo},
            \`absentismo_laboral\` = ${data.absentismo_laboral},
            \`seg_social_empresa\` = ${data.seg_social_empresa},
            \`total_aportaciones\` = ${totalAportaciones},
            \`updated_at\` = NOW()
          WHERE \`id\` = ${existing[0].id}
        `;
        await this.prisma.$executeRawUnsafe(updateQuery);
        this.logger.log(`✅ Coste Personal actualizado para ${data.nombre_empleado} - ${data.mes} ${data.ano}`);
        return { id: existing[0].id, action: 'updated' };
      } else {
        // Creăm nou
        const insertQuery = `
          INSERT INTO \`coste_personal\` (
            \`codigo_empleado\`,
            \`nombre_empleado\`,
            ${data.nombre_bd !== undefined ? '\`nombre_bd\`,' : ''}
            ${data.empleado_encontrado !== undefined ? '\`empleado_encontrado\`,' : ''}
            \`mes\`,
            \`ano\`,
            \`total\`,
            \`neto\`,
            \`aportaciones_trabajador\`,
            \`irpf\`,
            \`enfermedad_devolucion\`,
            \`embargos\`,
            \`anticipo\`,
            \`absentismo_laboral\`,
            \`seg_social_empresa\`,
            \`total_aportaciones\`
          ) VALUES (
            ${this.escapeSql(data.codigo_empleado)},
            ${this.escapeSql(data.nombre_empleado)},
            ${data.nombre_bd !== undefined ? (data.nombre_bd ? this.escapeSql(data.nombre_bd) : 'NULL') + ',' : ''}
            ${data.empleado_encontrado !== undefined ? (data.empleado_encontrado ? 1 : 0) + ',' : ''}
            ${this.escapeSql(data.mes)},
            ${data.ano},
            ${data.total},
            ${data.neto},
            ${data.aportaciones_trabajador},
            ${data.irpf},
            ${data.enfermedad_devolucion},
            ${data.embargos},
            ${data.anticipo},
            ${data.absentismo_laboral},
            ${data.seg_social_empresa},
            ${totalAportaciones}
          )
        `;
        await this.prisma.$executeRawUnsafe(insertQuery);
        this.logger.log(`✅ Coste Personal creado para ${data.nombre_empleado} - ${data.mes} ${data.ano}`);
        return { action: 'created' };
      }
    } catch (error: any) {
      this.logger.error(`❌ Error guardando Coste Personal:`, error);
      throw new BadRequestException(`Error al guardar datos: ${error.message}`);
    }
  }

  /**
   * Adaugă automat rândurile speciale: TOTAL, CON AURA, VACACIONES
   */
  private async agregarFilasEspeciales(
    mes: string,
    ano: number,
    vacacionesData?: {
      total: number;
      neto: number;
      aportaciones_trabajador: number;
      irpf: number;
      enfermedad_devolucion: number;
      embargos: number;
      anticipo: number;
      absentismo_laboral: number;
      seg_social_empresa: number;
    }
  ): Promise<void> {
    try {
      // Obținem toate datele salvate pentru această lună și an
      const allDataQuery = `
        SELECT 
          codigo_empleado,
          total,
          total_calculado,
          total_aportaciones,
          neto,
          aportaciones_trabajador,
          irpf,
          enfermedad_devolucion,
          embargos,
          anticipo,
          absentismo_laboral,
          seg_social_empresa
        FROM \`coste_personal\`
        WHERE \`mes\` = ${this.escapeSql(mes)}
          AND \`ano\` = ${this.escapeSql(ano.toString())}
          AND \`codigo_empleado\` NOT IN ('TOTAL', 'CON_AURA', 'VACACIONES')
      `;
      
      const allData = await this.prisma.$queryRawUnsafe<any[]>(allDataQuery);
      
      // Verificăm dacă există AURA în date
      const auraData = allData.filter(row => row.codigo_empleado === '10000008');
      if (auraData.length > 0) {
        this.logger.log(`🔍 [AGREGAR FILAS ESPECIALES] AURA găsit: ${auraData.length} rând(uri) cu codigo_empleado = '10000008'`);
        auraData.forEach((row, idx) => {
          this.logger.log(`   Rând ${idx + 1}: total=${row.total}, total_calculado=${row.total_calculado}, neto=${row.neto}`);
        });
      } else {
        this.logger.warn(`⚠️ [AGREGAR FILAS ESPECIALES] AURA NU a fost găsit în date pentru ${mes} ${ano}`);
      }
      
      // Calculăm CON AURA (toate datele, fără excludere)
      const conAuraRow = {
        total: allData.reduce((sum, row) => sum + parseFloat(row.total?.toString() || '0'), 0),
        total_calculado: allData.reduce((sum, row) => sum + parseFloat(row.total_calculado?.toString() || '0'), 0),
        total_aportaciones: allData.reduce((sum, row) => sum + parseFloat(row.total_aportaciones?.toString() || '0'), 0),
        neto: allData.reduce((sum, row) => sum + parseFloat(row.neto?.toString() || '0'), 0),
        aportaciones_trabajador: allData.reduce((sum, row) => sum + parseFloat(row.aportaciones_trabajador?.toString() || '0'), 0),
        irpf: allData.reduce((sum, row) => sum + parseFloat(row.irpf?.toString() || '0'), 0),
        enfermedad_devolucion: allData.reduce((sum, row) => sum + parseFloat(row.enfermedad_devolucion?.toString() || '0'), 0),
        embargos: allData.reduce((sum, row) => sum + parseFloat(row.embargos?.toString() || '0'), 0),
        anticipo: allData.reduce((sum, row) => sum + parseFloat(row.anticipo?.toString() || '0'), 0),
        absentismo_laboral: allData.reduce((sum, row) => sum + parseFloat(row.absentismo_laboral?.toString() || '0'), 0),
        seg_social_empresa: allData.reduce((sum, row) => sum + parseFloat(row.seg_social_empresa?.toString() || '0'), 0),
      };
      
      // VACACIONES: dacă există date din Excel, folosim valorile; altfel 0
      const vacacionesRow = vacacionesData ? {
        total: vacacionesData.total || 0,
        total_calculado: (vacacionesData.neto || 0) + (vacacionesData.aportaciones_trabajador || 0) + (vacacionesData.irpf || 0) - (vacacionesData.enfermedad_devolucion || 0) + (vacacionesData.embargos || 0) + (vacacionesData.anticipo || 0) + (vacacionesData.seg_social_empresa || 0),
        total_aportaciones: (vacacionesData.aportaciones_trabajador || 0) + (vacacionesData.seg_social_empresa || 0),
        neto: vacacionesData.neto || 0,
        aportaciones_trabajador: vacacionesData.aportaciones_trabajador || 0,
        irpf: vacacionesData.irpf || 0,
        enfermedad_devolucion: vacacionesData.enfermedad_devolucion || 0,
        embargos: vacacionesData.embargos || 0,
        anticipo: vacacionesData.anticipo || 0,
        absentismo_laboral: vacacionesData.absentismo_laboral || 0,
        seg_social_empresa: vacacionesData.seg_social_empresa || 0,
      } : {
        total: 0,
        total_calculado: 0,
        total_aportaciones: 0,
        neto: 0,
        aportaciones_trabajador: 0,
        irpf: 0,
        enfermedad_devolucion: 0,
        embargos: 0,
        anticipo: 0,
        absentismo_laboral: 0,
        seg_social_empresa: 0,
      };
      
      // Calculăm TOTAL = CON AURA + VACACIONES
      const totalRow = {
        total: conAuraRow.total + vacacionesRow.total,
        total_calculado: conAuraRow.total_calculado + vacacionesRow.total_calculado,
        total_aportaciones: conAuraRow.total_aportaciones + vacacionesRow.total_aportaciones,
        neto: conAuraRow.neto + vacacionesRow.neto,
        aportaciones_trabajador: conAuraRow.aportaciones_trabajador + vacacionesRow.aportaciones_trabajador,
        irpf: conAuraRow.irpf + vacacionesRow.irpf,
        enfermedad_devolucion: conAuraRow.enfermedad_devolucion + vacacionesRow.enfermedad_devolucion,
        embargos: conAuraRow.embargos + vacacionesRow.embargos,
        anticipo: conAuraRow.anticipo + vacacionesRow.anticipo,
        absentismo_laboral: conAuraRow.absentismo_laboral + vacacionesRow.absentismo_laboral,
        seg_social_empresa: conAuraRow.seg_social_empresa + vacacionesRow.seg_social_empresa,
      };
      
      // Logging pentru debugging
      this.logger.log(`📊 [AGREGAR FILAS ESPECIALES] CON AURA: total_calculado=${conAuraRow.total_calculado.toFixed(2)}, neto=${conAuraRow.neto.toFixed(2)}`);
      this.logger.log(`📊 [AGREGAR FILAS ESPECIALES] VACACIONES: total_calculado=${vacacionesRow.total_calculado.toFixed(2)}, neto=${vacacionesRow.neto.toFixed(2)}`);
      this.logger.log(`📊 [AGREGAR FILAS ESPECIALES] TOTAL (CON AURA + VACACIONES): total_calculado=${totalRow.total_calculado.toFixed(2)}, neto=${totalRow.neto.toFixed(2)}`);
      
      // Funcție helper pentru salvare/actualizare rând special
      const saveOrUpdateSpecialRow = async (codigo: string, nombre: string, data: typeof totalRow) => {
        const existingQuery = `
          SELECT id
          FROM \`coste_personal\`
          WHERE \`codigo_empleado\` = ${this.escapeSql(codigo)}
            AND \`mes\` = ${this.escapeSql(mes)}
            AND \`ano\` = ${this.escapeSql(ano.toString())}
        `;
        const existing = await this.prisma.$queryRawUnsafe<any[]>(existingQuery);
        
        if (existing.length > 0) {
          // Actualizăm
          const updateQuery = `
            UPDATE \`coste_personal\`
            SET 
              \`total\` = ${data.total},
              \`total_calculado\` = ${data.total_calculado},
              \`total_aportaciones\` = ${data.total_aportaciones},
              \`neto\` = ${data.neto},
              \`aportaciones_trabajador\` = ${data.aportaciones_trabajador},
              \`irpf\` = ${data.irpf},
              \`enfermedad_devolucion\` = ${data.enfermedad_devolucion},
              \`embargos\` = ${data.embargos},
              \`anticipo\` = ${data.anticipo},
              \`absentismo_laboral\` = ${data.absentismo_laboral},
              \`seg_social_empresa\` = ${data.seg_social_empresa},
              \`updated_at\` = NOW()
            WHERE \`id\` = ${existing[0].id}
          `;
          await this.prisma.$executeRawUnsafe(updateQuery);
        } else {
          // Creăm nou
          const insertQuery = `
            INSERT INTO \`coste_personal\` (
              \`codigo_empleado\`,
              \`nombre_empleado\`,
              \`nombre_bd\`,
              \`empleado_encontrado\`,
              \`mes\`,
              \`ano\`,
              \`total\`,
              \`total_calculado\`,
              \`total_aportaciones\`,
              \`neto\`,
              \`aportaciones_trabajador\`,
              \`irpf\`,
              \`enfermedad_devolucion\`,
              \`embargos\`,
              \`anticipo\`,
              \`absentismo_laboral\`,
              \`seg_social_empresa\`,
              \`created_at\`,
              \`updated_at\`
            ) VALUES (
              ${this.escapeSql(codigo)},
              ${this.escapeSql(nombre)},
              NULL,
              0,
              ${this.escapeSql(mes)},
              ${ano},
              ${data.total},
              ${data.total_calculado},
              ${data.total_aportaciones},
              ${data.neto},
              ${data.aportaciones_trabajador},
              ${data.irpf},
              ${data.enfermedad_devolucion},
              ${data.embargos},
              ${data.anticipo},
              ${data.absentismo_laboral},
              ${data.seg_social_empresa},
              NOW(),
              NOW()
            )
          `;
          await this.prisma.$executeRawUnsafe(insertQuery);
        }
      };
      
      // Salvăm/actualizăm cele 3 rânduri speciale
      await saveOrUpdateSpecialRow('TOTAL', 'TOTAL', totalRow);
      await saveOrUpdateSpecialRow('CON_AURA', 'CON AURA', conAuraRow);
      await saveOrUpdateSpecialRow('VACACIONES', 'VACACIONES', vacacionesRow);
      
      this.logger.log(`✅ Filas especiales agregadas: TOTAL, CON AURA, VACACIONES para ${mes} ${ano}`);
    } catch (error: any) {
      this.logger.error(`❌ Error agregando filas especiales:`, error);
      // Nu aruncăm eroare, doar logăm, pentru a nu întrerupe procesul principal
    }
  }

  /**
   * Salvează date Coste Personal din Excel (bulk)
   */
  async saveCostePersonalFromExcel(
    mes: string,
    ano: number,
    data: Array<{
      orden?: number;
      operario: string;
      nombre_bd?: string | null; // Nume editat din preview (opțional)
      codigo?: string | null; // Cod editat din preview (opțional)
      total: number;
      neto: number;
      aportaciones_trabajador: number;
      irpf: number;
      enfermedad_devolucion: number;
      embargos: number;
      anticipo: number;
      absentismo_laboral: number;
      seg_social_empresa: number;
    }>
  ): Promise<{ saved: number; updated: number; notFound: number }> {
    try {
      // Sortăm datele după ordinea din Excel (dacă există)
      const sortedData = [...data].sort((a, b) => {
        const ordenA = a.orden ?? 999999;
        const ordenB = b.orden ?? 999999;
        return ordenA - ordenB;
      });

      // Detectăm dacă există un rând "VACACIONES" în datele procesate
      let vacacionesData: typeof sortedData[0] | undefined = undefined;
      const vacacionesIndex = sortedData.findIndex(row => 
        row.operario && row.operario.toUpperCase().trim() === 'VACACIONES'
      );
      if (vacacionesIndex !== -1) {
        vacacionesData = sortedData[vacacionesIndex];
        // Eliminăm rândul VACACIONES din sortedData pentru a nu-l salva de două ori
        sortedData.splice(vacacionesIndex, 1);
      }

      let saved = 0;
      let updated = 0;
      let notFound = 0;
      let ordenCounter = 0; // Contor pentru ordinea de salvare

      for (const row of sortedData) {
        let empleadoEncontrado: { CODIGO: string; 'NOMBRE / APELLIDOS': string; confianza: number; matchType: string } | null = null;
        
        // Dacă există nombre_bd editat și este diferit de operario, folosim nombre_bd pentru căutare
        if (row.nombre_bd && row.nombre_bd.trim().length > 0 && row.nombre_bd.trim() !== row.operario.trim()) {
          // Folosim căutare flexibilă după nombre_bd editat
          empleadoEncontrado = await this.findEmpleadoFlexible(
            row.nombre_bd.trim(),
            null,
            null,
          );
          this.logger.debug(`🔍 Búsqueda por nombre_bd editado: "${row.nombre_bd}" (operario original: "${row.operario}")`);
        } else if (row.codigo && !row.codigo.startsWith('TEMP_')) {
          // Dacă există codigo editat (și nu este temporar), căutăm direct după codigo
          const empleadoQuery = `
            SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
            FROM \`DatosEmpleados\`
            WHERE \`CODIGO\` = ${this.escapeSql(row.codigo)}
            LIMIT 1
          `;
          const empleado = await this.prisma.$queryRawUnsafe<any[]>(empleadoQuery);
          if (empleado.length > 0) {
            empleadoEncontrado = { 
              CODIGO: empleado[0].CODIGO, 
              'NOMBRE / APELLIDOS': empleado[0]['NOMBRE / APELLIDOS'],
              confianza: 100,
              matchType: 'codigo_editado'
            };
            this.logger.debug(`🔍 Empleado encontrado por código editado: ${row.codigo}`);
          }
        } else {
          // Altfel, folosim căutare flexibilă după operario (comportament original)
          empleadoEncontrado = await this.findEmpleadoFlexible(
            row.operario,
            null,
            null,
          );
        }

        let codigo: string;
        let nombreCompleto: string;
        let nombreBd: string | null = null;
        let empleadoEncontradoFlag = true;

        if (empleadoEncontrado) {
          codigo = empleadoEncontrado.CODIGO;
          nombreCompleto = empleadoEncontrado['NOMBRE / APELLIDOS'] || row.operario;
          nombreBd = empleadoEncontrado['NOMBRE / APELLIDOS'] || null;
          // Marcăm ca "encontrado" doar dacă confidența este >= 80%
          empleadoEncontradoFlag = empleadoEncontrado.confianza >= 80;
        } else {
          // Dacă nu găsim angajatul, generăm un codigo temporar bazat pe nume
          // și salvăm cu numele din Excel
          const nombreNormalized = row.operario.trim().toUpperCase().replace(/\s+/g, '_');
          codigo = `TEMP_${nombreNormalized.substring(0, 20)}`;
          nombreCompleto = row.operario;
          empleadoEncontradoFlag = false;
          this.logger.warn(`⚠️ Empleado no encontrado, usando código temporal: ${codigo} para "${row.operario}"`);
          notFound++;
        }

        // Verificăm dacă există deja o înregistrare pentru acest codigo/mes/ano
        // sau pentru acest nume/mes/ano (în cazul codurilor temporare)
        const existingQuery = `
          SELECT id
          FROM \`coste_personal\`
          WHERE (
            \`codigo_empleado\` = ${this.escapeSql(codigo)}
            OR (\`codigo_empleado\` LIKE 'TEMP_%' AND \`nombre_empleado\` = ${this.escapeSql(nombreCompleto)})
          )
            AND \`mes\` = ${this.escapeSql(mes)}
            AND \`ano\` = ${this.escapeSql(ano.toString())}
          LIMIT 1
        `;
        
        const existing = await this.prisma.$queryRawUnsafe<any[]>(existingQuery);
        
        // Calculăm total_calculado: NETO + APORTACIONES_TRABAJADOR + IRPF - ENFERMEDAD_DEVOLUCION + EMBARGOS + ANTICIPO + SEG_SOCIAL_EMPRESA
        const totalCalculado = 
          (row.neto || 0) +
          (row.aportaciones_trabajador || 0) +
          (row.irpf || 0) -
          (row.enfermedad_devolucion || 0) +
          (row.embargos || 0) +
          (row.anticipo || 0) +
          (row.seg_social_empresa || 0);

        // Calculăm total_aportaciones: APORTACIONES_TRABAJADOR + SEG_SOCIAL_EMPRESA
        const totalAportaciones = 
          (row.aportaciones_trabajador || 0) +
          (row.seg_social_empresa || 0);
        
        if (existing.length > 0) {
          // Actualizăm
          const updateQuery = `
            UPDATE \`coste_personal\`
            SET 
              \`codigo_empleado\` = ${this.escapeSql(codigo)},
              \`nombre_empleado\` = ${this.escapeSql(nombreCompleto)},
              \`nombre_bd\` = ${nombreBd ? this.escapeSql(nombreBd) : 'NULL'},
              \`empleado_encontrado\` = ${empleadoEncontradoFlag ? 1 : 0},
              \`total\` = ${row.total},
              \`total_calculado\` = ${totalCalculado},
              \`neto\` = ${row.neto},
              \`aportaciones_trabajador\` = ${row.aportaciones_trabajador},
              \`irpf\` = ${row.irpf},
              \`enfermedad_devolucion\` = ${row.enfermedad_devolucion},
              \`embargos\` = ${row.embargos},
              \`anticipo\` = ${row.anticipo},
              \`absentismo_laboral\` = ${row.absentismo_laboral},
              \`seg_social_empresa\` = ${row.seg_social_empresa},
              \`total_aportaciones\` = ${totalAportaciones},
              \`updated_at\` = NOW()
            WHERE \`id\` = ${existing[0].id}
          `;
          await this.prisma.$executeRawUnsafe(updateQuery);
          updated++;
        } else {
          // Creăm nou - salvăm în ordinea din Excel
          // Folosim un mic delay pentru a asigura ordinea corectă de inserare
          const currentOrden = ordenCounter++;
          const insertQuery = `
            INSERT INTO \`coste_personal\` (
              \`codigo_empleado\`,
              \`nombre_empleado\`,
              \`nombre_bd\`,
              \`empleado_encontrado\`,
              \`mes\`,
              \`ano\`,
              \`total\`,
              \`total_calculado\`,
              \`neto\`,
              \`aportaciones_trabajador\`,
              \`irpf\`,
              \`enfermedad_devolucion\`,
              \`embargos\`,
              \`anticipo\`,
              \`absentismo_laboral\`,
              \`seg_social_empresa\`,
              \`total_aportaciones\`,
              \`created_at\`,
              \`updated_at\`
            ) VALUES (
              ${this.escapeSql(codigo)},
              ${this.escapeSql(nombreCompleto)},
              ${nombreBd ? this.escapeSql(nombreBd) : 'NULL'},
              ${empleadoEncontradoFlag ? 1 : 0},
              ${this.escapeSql(mes)},
              ${ano},
              ${row.total},
              ${totalCalculado},
              ${row.neto},
              ${row.aportaciones_trabajador},
              ${row.irpf},
              ${row.enfermedad_devolucion},
              ${row.embargos},
              ${row.anticipo},
              ${row.absentismo_laboral},
              ${row.seg_social_empresa},
              ${totalAportaciones},
              NOW(),
              NOW()
            )
          `;
          await this.prisma.$executeRawUnsafe(insertQuery);
          // Mic delay pentru a asigura ordinea corectă (1ms per rând)
          if (currentOrden < sortedData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          saved++;
        }
      }

      this.logger.log(`✅ Coste Personal guardado: ${saved} creados, ${updated} actualizados, ${notFound} no encontrados (usando código temporal)`);
      
      // Adăugăm rândurile speciale: TOTAL, CON AURA, VACACIONES
      await this.agregarFilasEspeciales(
        mes,
        ano,
        vacacionesData ? {
          total: vacacionesData.total || 0,
          neto: vacacionesData.neto || 0,
          aportaciones_trabajador: vacacionesData.aportaciones_trabajador || 0,
          irpf: vacacionesData.irpf || 0,
          enfermedad_devolucion: vacacionesData.enfermedad_devolucion || 0,
          embargos: vacacionesData.embargos || 0,
          anticipo: vacacionesData.anticipo || 0,
          absentismo_laboral: vacacionesData.absentismo_laboral || 0,
          seg_social_empresa: vacacionesData.seg_social_empresa || 0,
        } : undefined
      );
      
      return { saved, updated, notFound };
    } catch (error: any) {
      this.logger.error(`❌ Error guardando Coste Personal desde Excel:`, error);
      throw new BadRequestException(`Error al guardar datos: ${error.message}`);
    }
  }

  /**
   * Actualizează un câmp specific pentru Coste Personal
   */
  async updateCostePersonalField(
    id: number,
    field: string,
    value: number | string
  ): Promise<{ success: boolean }> {
    try {
      const allowedNumericFields = [
        'total',
        'total_calculado',
        'neto',
        'aportaciones_trabajador',
        'irpf',
        'enfermedad_devolucion',
        'embargos',
        'anticipo',
        'absentismo_laboral',
        'seg_social_empresa',
        'total_aportaciones'
      ];

      const allowedStringFields = [
        'codigo_empleado',
        'nombre_empleado',
        'nombre_bd'
      ];

      if (allowedNumericFields.includes(field)) {
        const updateQuery = `
          UPDATE \`coste_personal\`
          SET 
            \`${field}\` = ${typeof value === 'number' ? value : parseFloat(value.toString())},
            \`updated_at\` = NOW()
          WHERE \`id\` = ${id}
        `;
        await this.prisma.$executeRawUnsafe(updateQuery);
        this.logger.log(`✅ Campo ${field} actualizado para Coste Personal id ${id}`);
        return { success: true };
      } else if (allowedStringFields.includes(field)) {
        const updateQuery = `
          UPDATE \`coste_personal\`
          SET 
            \`${field}\` = ${this.escapeSql(value.toString())},
            \`updated_at\` = NOW()
          WHERE \`id\` = ${id}
        `;
        await this.prisma.$executeRawUnsafe(updateQuery);
        
        // Dacă actualizăm codigo_empleado, verificăm dacă angajatul există
        if (field === 'codigo_empleado') {
          const empleadoQuery = `
            SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
            FROM \`DatosEmpleados\`
            WHERE \`CODIGO\` = ${this.escapeSql(value.toString())}
            LIMIT 1
          `;
          const empleado = await this.prisma.$queryRawUnsafe<any[]>(empleadoQuery);
          
          if (empleado.length > 0) {
            // Actualizăm și nombre_bd și empleado_encontrado
            const updateEmpleadoQuery = `
              UPDATE \`coste_personal\`
              SET 
                \`nombre_bd\` = ${this.escapeSql(empleado[0]['NOMBRE / APELLIDOS'])},
                \`empleado_encontrado\` = 1,
                \`updated_at\` = NOW()
              WHERE \`id\` = ${id}
            `;
            await this.prisma.$executeRawUnsafe(updateEmpleadoQuery);
          } else {
            // Dacă nu există, marcăm ca negăsit
            const updateNotFoundQuery = `
              UPDATE \`coste_personal\`
              SET 
                \`empleado_encontrado\` = 0,
                \`updated_at\` = NOW()
              WHERE \`id\` = ${id}
            `;
            await this.prisma.$executeRawUnsafe(updateNotFoundQuery);
          }
        }
        
        // Dacă actualizăm nombre_bd, căutăm angajatul după nume și actualizăm codigo_empleado
        if (field === 'nombre_bd') {
          const nombreBuscado = value.toString().trim();
          if (nombreBuscado.length > 0) {
            // Căutăm angajatul după nume folosind findEmpleadoFlexible
            const empleadoEncontrado = await this.findEmpleadoFlexible(
              nombreBuscado,
              null,
              null,
            );
            
            if (empleadoEncontrado && empleadoEncontrado.confianza >= 80) {
              // Dacă găsim cu confidență >= 80%, actualizăm codigo_empleado și empleado_encontrado
              const updateEmpleadoQuery = `
                UPDATE \`coste_personal\`
                SET 
                  \`codigo_empleado\` = ${this.escapeSql(empleadoEncontrado.CODIGO)},
                  \`nombre_bd\` = ${this.escapeSql(empleadoEncontrado['NOMBRE / APELLIDOS'])},
                  \`empleado_encontrado\` = 1,
                  \`updated_at\` = NOW()
                WHERE \`id\` = ${id}
              `;
              await this.prisma.$executeRawUnsafe(updateEmpleadoQuery);
              this.logger.log(`✅ Nombre BD actualizado y empleado encontrado: ${empleadoEncontrado['NOMBRE / APELLIDOS']} (${empleadoEncontrado.CODIGO})`);
            } else if (empleadoEncontrado && empleadoEncontrado.confianza < 80) {
              // Dacă găsim dar cu confidență < 80%, actualizăm doar nombre_bd și marcăm ca nesigur
              const updateEmpleadoQuery = `
                UPDATE \`coste_personal\`
                SET 
                  \`codigo_empleado\` = ${this.escapeSql(empleadoEncontrado.CODIGO)},
                  \`nombre_bd\` = ${this.escapeSql(empleadoEncontrado['NOMBRE / APELLIDOS'])},
                  \`empleado_encontrado\` = 0,
                  \`updated_at\` = NOW()
                WHERE \`id\` = ${id}
              `;
              await this.prisma.$executeRawUnsafe(updateEmpleadoQuery);
              this.logger.warn(`⚠️ Nombre BD actualizado pero confianza baja (${empleadoEncontrado.confianza}%): ${empleadoEncontrado['NOMBRE / APELLIDOS']}`);
            } else {
              // Dacă nu găsim, actualizăm doar nombre_bd și marcăm ca negăsit
              const updateNotFoundQuery = `
                UPDATE \`coste_personal\`
                SET 
                  \`nombre_bd\` = ${this.escapeSql(nombreBuscado)},
                  \`empleado_encontrado\` = 0,
                  \`updated_at\` = NOW()
                WHERE \`id\` = ${id}
              `;
              await this.prisma.$executeRawUnsafe(updateNotFoundQuery);
              this.logger.warn(`⚠️ Nombre BD actualizado pero empleado no encontrado: ${nombreBuscado}`);
            }
          }
        }
        
        this.logger.log(`✅ Campo ${field} actualizado para Coste Personal id ${id}`);
        return { success: true };
      } else {
        throw new BadRequestException(`Campo no permitido: ${field}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ Error actualizando campo Coste Personal:`, error);
      throw new BadRequestException(`Error al actualizar: ${error.message}`);
    }
  }

  /**
   * Șterge toate înregistrările Coste Personal pentru o lună și an
   */
  async deleteCostePersonalByMesAno(mes: string, ano: number): Promise<{ deleted: number }> {
    try {
      // Verificăm câte înregistrări vor fi șterse
      const countQuery = `
        SELECT COUNT(*) as count
        FROM \`coste_personal\`
        WHERE \`mes\` = ${this.escapeSql(mes)}
          AND \`ano\` = ${this.escapeSql(ano.toString())}
      `;
      const countResult = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(countQuery);
      const count = Number(countResult[0]?.count || 0);

      if (count === 0) {
        this.logger.warn(`⚠️ No hay registros para eliminar en ${mes} ${ano}`);
        return { deleted: 0 };
      }

      // Ștergem toate înregistrările pentru luna și anul specificat
      const deleteQuery = `
        DELETE FROM \`coste_personal\`
        WHERE \`mes\` = ${this.escapeSql(mes)}
          AND \`ano\` = ${this.escapeSql(ano.toString())}
      `;
      await this.prisma.$executeRawUnsafe(deleteQuery);

      this.logger.log(`✅ Eliminados ${count} registros de Coste Personal para ${mes} ${ano}`);
      return { deleted: count };
    } catch (error: any) {
      this.logger.error(`❌ Error eliminando Coste Personal:`, error);
      throw new BadRequestException(`Error al eliminar datos: ${error.message}`);
    }
  }

  /**
   * Extrage datele necesare din textul unui PDF nómina
   */
  private extraerDatosNomina(
    textContent: string, 
    empleadoNombre?: string, 
    empleadoCodigo?: string,
    auraDebugInfo?: {
      irpfPatternFound: boolean;
      irpfPatternLine: number | null;
      irpfPatternContext: string[];
      irpfCandidates: Array<{ value: number; line: number; reason: string }>;
      irpfFinalValue: number | null;
      segSocialPatterns: Array<{
        line: number;
        lineText: string;
        valueFound: number | null;
        extractionMethod: string;
        context: string[];
      }>;
      segSocialFinalValue: number | null;
    },
    dobreAdrianEnfInfo?: {
      conceptosTableStart: number | null;
      enfConcepts: Array<{
        line: number;
        lineText: string;
        columns: string[];
        allValues: string[];
        extractedValue: number | null;
        extractionMethod: string;
      }>;
      enfFinalValue: number | null;
    },
    garciaGomezEmbargosInfo?: {
      embargoPatterns: Array<{
        line: number;
        lineText: string;
        valueFound: number | null;
        extractionMethod: string;
        context: string[];
      }>;
      embargosFinalValue: number | null;
    },
    garciaMoranAnticipoInfo?: {
      anticipoPatterns: Array<{
        line: number;
        lineText: string;
        valueFound: number | null;
        extractionMethod: string;
        context: string[];
      }>;
      anticipoFinalValue: number | null;
    },
    manzanoCuevasAbsentismoInfo?: {
      absentismoPatterns: Array<{
        line: number;
        lineText: string;
        valueFound: number | null;
        extractionMethod: string;
        context: string[];
      }>;
      absentismoFinalValue: number | null;
    }
  ): {
    total: number;
    neto: number;
    aportaciones_trabajador: number;
    irpf: number;
    enfermedad_devolucion: number;
    embargos: number;
    anticipo: number;
    absentismo_laboral: number;
    seg_social_empresa: number;
  } {
    // Angajați speciali pentru loguri detaliate IRPF
    const empleadosEspeciales = ['10000008', '10000004', '10000063']; // ELSAYED, MAVRU, HUTOPILA
    const isEmpleadoEspecial = empleadoCodigo && empleadosEspeciales.includes(empleadoCodigo);
    const isAura = empleadoCodigo === '10000008';
    
    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Funcție helper pentru a extrage valoarea numerică dintr-o linie
    const extractValue = (pattern: RegExp, line: string): number => {
      const match = line.match(pattern);
      if (match && match[1]) {
        // Eliminăm punctele și virgulele, păstrăm doar punctul zecimal
        const valueStr = match[1].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(valueStr);
        return isNaN(value) ? 0 : value;
      }
      return 0;
    };

    let total = 0;
    let neto = 0;
    let aportaciones_trabajador = 0;
    let irpf = 0;
    let enfermedad_devolucion = 0;
    let embargos = 0;
    let anticipo = 0;
    let absentismo_laboral = 0;
    let seg_social_empresa = 0;

    // Căutăm valorile în text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();

      // Total devengado (Total)
      if ((lineUpper.includes('TOTAL DEVENGADO') || lineUpper.includes('TOTAL DEVENGADOS')) && !total) {
        // Căutăm valoarea pe aceeași linie sau următoarea
        const value = extractValue(/([\d.,]+)/, line);
        if (value > 0) {
          total = value;
        } else if (i + 1 < lines.length) {
          total = extractValue(/([\d.,]+)/, lines[i + 1]);
        }
      }

      // Líquido a percibir (Neto) - Pattern: "LIQUIDO TOTAL A PERCIBIR (A-B) ....................."
      // Detectăm dacă este Finiquito sau Nominas pentru a ajusta logica de extragere
      if ((lineUpper.includes('LIQUIDO TOTAL A PERCIBIR') || lineUpper.includes('LÍQUIDO TOTAL A PERCIBIR')) && 
          (lineUpper.includes('(A-B)') || lineUpper.includes('A-B'))) {
        // Detectăm tipul documentului
        const esFiniquito = this.detectarFiniquito(textContent);
        
        if (esFiniquito) {
          // PENTRU FINIQUITO: NETO este ultima valoare validă (pozitivă sau negativă) înainte de "TOTAL A DEDUCIR" sau "2. I.R.P.F."
          let lastValidValue = 0;
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nextLine = lines[j].trim();
            const nextLineUpper = nextLine.toUpperCase();
            
            // Dacă găsim "TOTAL A DEDUCIR", am trecut de NETO, ne oprim
            if (nextLineUpper.includes('TOTAL A DEDUCIR')) {
              break;
            }
            
            // Dacă găsim "2. I.R.P.F." sau "I.R.P.F.", am trecut de NETO, ne oprim
            if (nextLineUpper.includes('2.') && (nextLineUpper.includes('I.R.P.F.') || nextLineUpper.includes('IRPF'))) {
              break;
            }
            
            // Dacă găsim o dată sau alte indicatori, ne oprim
            if (nextLine.match(/\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i) ||
                nextLine.match(/FALTA PREAVISO|VACACIONES|TOTAL DEVENGADO/i)) {
              break;
            }
            
            // Căutăm o valoare numerică simplă (doar număr cu virgulă/punct, fără procente sau alte text)
            // Poate fi pozitivă sau negativă (ex: -94,40 sau 94,40), sau 0
            const valueMatch = nextLine.match(/^(-?[\d.,]+)$/);
            if (valueMatch && valueMatch[1]) {
              const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
              const value = parseFloat(valueStr);
              // NETO poate fi orice valoare (poate fi negativ, pozitiv, 0, sau peste 1000)
              // Permitem 0 sau valori cu valoare absolută >= 50 (pentru a exclude zgomotul mic)
              // Luăm ultima valoare validă găsită (pozitivă, negativă sau 0)
              if (!isNaN(value) && (value === 0 || Math.abs(value) >= 50)) {
                lastValidValue = value;
                this.logger.debug(`🔍 [FINIQUITO] Valoare NETO candidată (linia ${j + 1}): ${value} din "${nextLine}"`);
              }
            }
          }
          // Folosim ultima valoare validă găsită (poate fi 0)
          neto = lastValidValue;
          this.logger.debug(`✅ [FINIQUITO] NETO extras: ${neto}`);
        } else {
          // PENTRU NOMINAS: NETO este valoarea cea mai mare (în valoare absolută) dintre valorile candidate
          // înainte de "TOTAL A DEDUCIR" sau "2. I.R.P.F."
          let maxValidValue = 0;
          let maxAbsValue = 0;
          let hasZero = false;
          let hasLargeValue = false; // Valori >= 50 (probabil NETO real)
          
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            const nextLine = lines[j].trim();
            const nextLineUpper = nextLine.toUpperCase();
            
            // Dacă găsim "TOTAL A DEDUCIR", am trecut de NETO, ne oprim
            if (nextLineUpper.includes('TOTAL A DEDUCIR')) {
              break;
            }
            
            // Dacă găsim "2. I.R.P.F." sau "I.R.P.F.", am trecut de NETO, ne oprim
            if (nextLineUpper.includes('2.') && (nextLineUpper.includes('I.R.P.F.') || nextLineUpper.includes('IRPF'))) {
              break;
            }
            
            // Dacă găsim o dată sau alte indicatori, ne oprim
            if (nextLine.match(/\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i) ||
                nextLine.match(/FALTA PREAVISO|VACACIONES|TOTAL DEVENGADO/i)) {
              break;
            }
            
            // Căutăm o valoare numerică simplă (doar număr cu virgulă/punct, fără procente sau alte text)
            // Poate fi pozitivă sau negativă (ex: -94,40 sau 94,40), sau 0
            const valueMatch = nextLine.match(/^(-?[\d.,]+)$/);
            if (valueMatch && valueMatch[1]) {
              const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
              const value = parseFloat(valueStr);
              // NETO poate fi orice valoare (poate fi negativ, pozitiv, 0, sau peste 1000)
              // Pentru Nominas, acceptăm 0 sau valori cu valoare absolută >= 0.01
              if (!isNaN(value) && (value === 0 || Math.abs(value) >= 0.01)) {
                const absValue = Math.abs(value);
                
                // Marcăm dacă avem 0 sau valori mari (>= 50)
                if (value === 0) {
                  hasZero = true;
                }
                if (absValue >= 50) {
                  hasLargeValue = true;
                }
                
                // Luăm valoarea cu cea mai mare valoare absolută (cea mai mare în modul)
                if (absValue > maxAbsValue) {
                  maxAbsValue = absValue;
                  maxValidValue = value;
                }
                this.logger.debug(`🔍 [NOMINAS] Valoare NETO candidată (linia ${j + 1}): ${value} din "${nextLine}"`);
              }
            }
          }
          
          // Dacă nu am găsit valori mari (>= 50) și am găsit 0, folosim 0
          // Altfel, folosim valoarea cu cea mai mare valoare absolută
          if (!hasLargeValue && hasZero) {
            neto = 0;
            this.logger.debug(`✅ [NOMINAS] NETO extras: 0 (toate valorile candidate sunt mici, folosim 0)`);
          } else {
            neto = maxValidValue;
            this.logger.debug(`✅ [NOMINAS] NETO extras: ${neto} (max abs: ${maxAbsValue})`);
          }
        }
      }
      
      // Fallback pentru "LIQUIDO A PERCIBIR" (fără TOTAL)
      if ((lineUpper.includes('LIQUIDO A PERCIBIR') || lineUpper.includes('LÍQUIDO A PERCIBIR')) && !neto) {
        const value = extractValue(/([\d.,]+)/, line);
        if (value > 0) {
          neto = value;
        } else if (i + 1 < lines.length) {
          neto = extractValue(/([\d.,]+)/, lines[i + 1]);
        }
      }

      // Aportaciones trabajador - Pattern: "1. TOTAL APORTACIONES:" → valoarea 68,62
      // În PDF-urile Finiquito, valoarea pentru "1. TOTAL APORTACIONES" este prima valoare numerică
      // care apare după "LIQUIDO TOTAL A PERCIBIR (A-B)" și înainte de "1. TOTAL APORTACIONES"
      if ((lineUpper.includes('TOTAL APORTACIONES') || lineUpper.includes('TOTAL APORTACION')) && 
          (lineUpper.includes('1.') || lineUpper.startsWith('1 '))) {
        // Căutăm valoarea pe aceeași linie
        const match = line.match(/TOTAL\s+APORTACIONES?[:\s.]*([\d.,]+)/i);
        if (match && match[1]) {
          const valueStr = match[1].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);
          // Aportaciones poate fi 0 sau orice valoare pozitivă
          if (!isNaN(value) && value >= 0) {
            aportaciones_trabajador = value;
            this.logger.debug(`✅ Aportaciones Trabajador extras: ${aportaciones_trabajador} din linia: "${line.substring(0, 100)}"`);
          }
        } else {
          // Valoarea nu este pe aceeași linie
          // În PDF-urile Finiquito, "LIQUIDO TOTAL A PERCIBIR (A-B)" apare ÎNAINTE de "1. TOTAL APORTACIONES"
          // Valoarea pentru "1. TOTAL APORTACIONES" este prima valoare numerică după "LIQUIDO TOTAL A PERCIBIR (A-B)"
          // Căutăm înapoi de la "1. TOTAL APORTACIONES" până la "LIQUIDO TOTAL A PERCIBIR (A-B)"
          let liquidoIndex = -1;
          for (let j = i - 1; j >= 0 && j >= i - 30; j--) {
            const prevLine = lines[j].trim();
            const prevLineUpper = prevLine.toUpperCase();
            if ((prevLineUpper.includes('LIQUIDO TOTAL A PERCIBIR') || prevLineUpper.includes('LÍQUIDO TOTAL A PERCIBIR')) && 
                (prevLineUpper.includes('(A-B)') || prevLineUpper.includes('A-B'))) {
              liquidoIndex = j;
              break;
            }
          }
          
          if (liquidoIndex !== -1) {
            // Căutăm prima valoare numerică după "LIQUIDO TOTAL A PERCIBIR (A-B)"
            for (let j = liquidoIndex + 1; j < i; j++) {
              const nextLine = lines[j].trim();
              const nextLineUpper = nextLine.toUpperCase();
              
              // Dacă găsim "TOTAL A DEDUCIR", am trecut de valoarea pentru Aportaciones, ne oprim
              if (nextLineUpper.includes('TOTAL A DEDUCIR')) {
                break;
              }
              
              // Căutăm o valoare numerică simplă (doar număr cu virgulă/punct, fără procente sau alte text)
              const valueMatch = nextLine.match(/^([\d.,]+)$/);
              if (valueMatch && valueMatch[1]) {
                const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
                const value = parseFloat(valueStr);
                // Aportaciones poate fi 0 sau orice valoare pozitivă validă (>= 0.01 pentru valori non-zero)
                if (!isNaN(value) && (value === 0 || value >= 0.01)) {
                  aportaciones_trabajador = value;
                  this.logger.debug(`✅ Aportaciones Trabajador extras (linia ${j + 1}, după LIQUIDO TOTAL A PERCIBIR): ${aportaciones_trabajador} din "${nextLine}"`);
                  break;
                }
              }
            }
          } else {
            // Fallback: căutăm în următoarele linii (pentru cazurile când "1. TOTAL APORTACIONES" apare înainte de "LIQUIDO TOTAL A PERCIBIR")
            for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
              const nextLine = lines[j].trim();
              const nextLineUpper = nextLine.toUpperCase();
              
              // Dacă găsim "2. I.R.P.F." sau "I.R.P.F.", am trecut de Aportaciones, ne oprim
              if (nextLineUpper.includes('2.') && (nextLineUpper.includes('I.R.P.F.') || nextLineUpper.includes('IRPF'))) {
                break;
              }
              
              // Dacă găsim "TOTAL A DEDUCIR", am trecut de Aportaciones, ne oprim
              if (nextLineUpper.includes('TOTAL A DEDUCIR')) {
                break;
              }
              
              // Căutăm o valoare numerică simplă
              const valueMatch = nextLine.match(/^([\d.,]+)$/);
              if (valueMatch && valueMatch[1]) {
                const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
                const value = parseFloat(valueStr);
                // Aportaciones poate fi 0 sau orice valoare pozitivă validă (>= 0.01 pentru valori non-zero)
                if (!isNaN(value) && (value === 0 || value >= 0.01)) {
                  aportaciones_trabajador = value;
                  this.logger.debug(`✅ Aportaciones Trabajador extras (linia ${j + 1}): ${aportaciones_trabajador} din "${nextLine}"`);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Fallback pentru "APORTACIONES TRABAJADOR" sau "APORT. TRABAJADOR"
      if ((lineUpper.includes('APORTACIONES TRABAJADOR') || lineUpper.includes('APORT. TRABAJADOR')) && !aportaciones_trabajador) {
        const value = extractValue(/([\d.,]+)/, line);
        if (value > 0) {
          aportaciones_trabajador = value;
        } else if (i + 1 < lines.length) {
          aportaciones_trabajador = extractValue(/([\d.,]+)/, lines[i + 1]);
        }
      }

      // IRPF - Pattern: "2. I.R.P.F.:" → valoarea 21,18 (poate fi 0)
      if ((lineUpper.includes('I.R.P.F.') || lineUpper.includes('IRPF')) && 
          (lineUpper.includes('2.') || lineUpper.startsWith('2 ') || lineUpper.match(/^2\s/))) {
        this.logger.debug(`🔍 Pattern IRPF găsit pe linia ${i + 1}: "${line.substring(0, 100)}"`);
        
        // Loguri speciale pentru AURA (doar un log simplu, nu toate detaliile)
        const isAura = empleadoCodigo === '10000008';
        if (isAura && auraDebugInfo) {
          auraDebugInfo.irpfPatternFound = true;
          auraDebugInfo.irpfPatternLine = i + 1;
          // Colectăm contextul: 5 linii înainte și 20 linii după
          auraDebugInfo.irpfPatternContext = [];
          for (let k = Math.max(0, i - 5); k < Math.min(i + 21, lines.length); k++) {
            const marker = k === i ? ' ⬅️ AICI ESTE "2. I.R.P.F."' : '';
            auraDebugInfo.irpfPatternContext.push(`Linia ${k + 1}: "${lines[k]}"${marker}`);
          }
          this.logger.log(`🔍 [AURA IRPF] Pattern "2. I.R.P.F." găsit pe linia ${i + 1}: "${line.substring(0, 80)}"`);
        }
        
        // Căutăm valoarea pe aceeași linie
        const match = line.match(/I\.?R\.?P\.?F\.?[:\s.]*([\d.,]+)/i);
        let valueFound = false;
        
        if (match && match[1] && match[1].trim() !== '') {
          const valueStr = match[1].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);
          
          // Verificăm dacă este un procent (apare cu "%" în text sau este între 0 și 100 ȘI apare în context de procent)
          const hasPercentSign = lineUpper.includes('%');
          const isPercentage = hasPercentSign || (lineUpper.includes('POR CIENTO') || lineUpper.includes('PORCIENTO') || lineUpper.match(/\d+\s*%/));
          
          // Pentru AURA (codigo: 10000008): dacă valoarea de pe aceeași linie cu "2. I.R.P.F." 
          // este un număr întreg mic (0-100) fără zecimale, este probabil procentul, nu valoarea IRPF
          // Ignorăm și continuăm căutarea pentru valoarea reală IRPF
          const isAura = empleadoCodigo === '10000008';
          const isSmallInteger = value > 0 && value <= 100 && Number.isInteger(value);
          const isLikelyPercentageForAura = isAura && isSmallInteger && !hasPercentSign;
          
          // IRPF poate fi 0 sau orice valoare pozitivă validă (>= 0.01 pentru valori non-zero)
          // Ignorăm valorile prea mici care sunt probabil doar puncte sau caractere invalide
          // Ignorăm doar procentele (cu "%" sau în context de procent, sau pentru AURA numere întregi mici)
          if (!isNaN(value) && (value === 0 || value >= 0.01) && !isPercentage && !isLikelyPercentageForAura) {
            irpf = value;
            valueFound = true;
            this.logger.debug(`✅ IRPF extras (pe aceeași linie): ${irpf} din linia: "${line.substring(0, 100)}"`);
            if (isAura) {
              this.logger.log(`🔍 [AURA IRPF] ✅ Valoare extrasă de pe aceeași linie: ${irpf}`);
            }
          } else {
            if (isPercentage || isLikelyPercentageForAura) {
              this.logger.debug(`⚠️ IRPF găsit pe linie dar este procent (${value}%), continuăm căutarea`);
              if (isAura) {
                this.logger.log(`🔍 [AURA IRPF] ⚠️ Valoare ${value} este procent, continuăm căutarea`);
              }
            } else {
              this.logger.debug(`⚠️ IRPF găsit pe linie dar valoarea invalidă/prea mică: ${valueStr} (${value})`);
            }
          }
        }
        
        // Dacă nu am găsit valoarea pe aceeași linie, căutăm în următoarele linii
        if (!valueFound) {
          // Găsim poziția "LIQUIDO TOTAL A PERCIBIR" pentru a determina strategia de căutare
          let liquidoTotalIndex = -1;
          for (let k = 0; k < lines.length; k++) {
            const checkLine = lines[k].toUpperCase();
            if (checkLine.includes('LIQUIDO TOTAL A PERCIBIR') || checkLine.includes('LÍQUIDO TOTAL A PERCIBIR')) {
              liquidoTotalIndex = k;
              break;
            }
          }
          
          // Strategie 1: Dacă "2. I.R.P.F." este ÎNAINTE de "LIQUIDO TOTAL A PERCIBIR"
          // IRPF este probabil prima valoare numerică după "2. I.R.P.F." și înainte de "LIQUIDO TOTAL A PERCIBIR"
          if (liquidoTotalIndex !== -1 && i < liquidoTotalIndex) {
            this.logger.debug(`🔍 "2. I.R.P.F." este ÎNAINTE de "LIQUIDO TOTAL A PERCIBIR" (${i + 1} < ${liquidoTotalIndex + 1}), căutăm IRPF între ele`);
            if (isAura) {
              this.logger.log(`🔍 [AURA IRPF] "2. I.R.P.F." este ÎNAINTE de "LIQUIDO TOTAL A PERCIBIR", căutăm IRPF între ele`);
            }
            
            for (let j = i + 1; j < liquidoTotalIndex && j < Math.min(i + 10, lines.length); j++) {
              const nextLine = lines[j].trim();
              const nextLineUpper = nextLine.toUpperCase();
              
              // Dacă găsim "TOTAL A DEDUCIR" sau alte indicatori, ne oprim
              if (nextLineUpper.includes('TOTAL A DEDUCIR') ||
                  (nextLineUpper.includes('1.') && (nextLineUpper.includes('TOTAL APORTACIONES') || nextLineUpper.includes('TOTAL APORTACION')))) {
                break;
              }
              
              // Căutăm o valoare numerică simplă
              const valueMatch = nextLine.match(/^([\d.,]+)$/);
              if (valueMatch && valueMatch[1]) {
                const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
                const value = parseFloat(valueStr);
                
                // Verificăm dacă valoarea este aceeași cu NETO
                const isSameAsNeto = neto > 0 && Math.abs(value - neto) < 0.01;
                
                // Pentru AURA: dacă valoarea este un număr întreg mic (0-100), este probabil procentul
                const isAura = empleadoCodigo === '10000008';
                
                // Verificăm dacă valoarea este prea mare (probabil NETO sau alte totaluri, nu IRPF)
                // IRPF este de obicei o valoare mai mică (sub 500)
                // PENTRU AURA: IRPF poate fi mai mare (până la ~2000), dar nu mai mare decât NETO
                const isTooLarge = isAura 
                  ? (value > 2000 || (neto > 0 && value > neto))  // Pentru AURA: acceptăm până la 2000, dar nu mai mare decât NETO
                  : value > 500;  // Pentru alții: acceptăm doar până la 500
                const isSmallInteger = value > 0 && value <= 100 && Number.isInteger(value);
                const isLikelyPercentageForAura = isAura && isSmallInteger;
                
                if (!isNaN(value) && (value === 0 || value >= 0.01) && !isSameAsNeto && !isTooLarge && !isLikelyPercentageForAura) {
                  irpf = value;
                  this.logger.debug(`✅ IRPF extras (linia ${j + 1}, între "2. I.R.P.F." și "LIQUIDO TOTAL A PERCIBIR"): ${irpf} din "${nextLine}"`);
                  if (isAura) {
                    this.logger.log(`🔍 [AURA IRPF] ✅ IRPF extras: ${irpf} din linia ${j + 1}`);
                  }
                  valueFound = true;
                  break;
                } else if (isSameAsNeto && isAura) {
                  this.logger.log(`🔍 [AURA IRPF] ⏭️ Ignorăm ${value} (este aceeași cu NETO: ${neto})`);
                } else if (isTooLarge && isAura) {
                  const reason = value > 2000 ? `este prea mare > 2000` : `este mai mare decât NETO (${neto})`;
                  this.logger.log(`🔍 [AURA IRPF] ⏭️ Ignorăm ${value} (${reason})`);
                } else if (isLikelyPercentageForAura && isAura) {
                  this.logger.log(`🔍 [AURA IRPF] ⏭️ Ignorăm ${value} (este probabil procent)`);
                }
              }
            }
          }
          
          // Strategie 2: Dacă "2. I.R.P.F." este DUPĂ "LIQUIDO TOTAL A PERCIBIR" sau nu am găsit "LIQUIDO TOTAL A PERCIBIR"
          // IRPF este probabil prima valoare numerică după "2. I.R.P.F." (dar nu primele 3 după "LIQUIDO TOTAL A PERCIBIR")
          if (!valueFound) {
            this.logger.debug(`🔍 Căutăm IRPF după "2. I.R.P.F." (linia ${i + 1})`);
            let valoresDespuesLiquido = 0;
            
            if (isAura) {
              this.logger.log(`🔍 [AURA IRPF] Căutăm IRPF în următoarele 15 linii după linia ${i + 1}`);
            }
            
            for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            const nextLine = lines[j].trim();
            const nextLineUpper = nextLine.toUpperCase();
            
            // Dacă găsim "TOTAL A DEDUCIR", continuăm căutarea (IRPF poate fi după)
            if (nextLineUpper.includes('TOTAL A DEDUCIR')) {
              this.logger.debug(`📌 Găsit "TOTAL A DEDUCIR" la linia ${j + 1}, continuăm căutarea pentru IRPF`);
              // Nu ne oprim, continuăm
            }
            
            // Dacă găsim "LIQUIDO TOTAL A PERCIBIR", continuăm căutarea (IRPF poate fi după)
            if (nextLineUpper.includes('LIQUIDO TOTAL A PERCIBIR') || nextLineUpper.includes('LÍQUIDO TOTAL A PERCIBIR')) {
              liquidoTotalIndex = j;
              this.logger.debug(`📌 Găsit "LIQUIDO TOTAL A PERCIBIR" la linia ${j + 1}, continuăm căutarea pentru IRPF`);
              if (isAura) {
                this.logger.log(`🔍 [AURA IRPF] 📌 Găsit "LIQUIDO TOTAL A PERCIBIR" la linia ${j + 1}`);
              }
              // Nu ne oprim, continuăm
            }
            
            // Dacă găsim alte indicatori relevante (date complete, alte secțiuni), ne oprim
            if (nextLine.match(/\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/i) ||
                nextLine.match(/FALTA PREAVISO|VACACIONES DISFRUTADAS|TOTAL DEVENGADO|A\. TOTAL DEVENGADO|II\. DEDUCCIONES/i)) {
              this.logger.debug(`⏹️ Oprire la linia ${j + 1}: găsit indicator: "${nextLine.substring(0, 50)}"`);
              break;
            }
            
            // Căutăm o valoare numerică simplă (doar număr cu virgulă/punct)
            const valueMatch = nextLine.match(/^([\d.,]+)$/);
            if (valueMatch && valueMatch[1]) {
              const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
              const value = parseFloat(valueStr);
              
              // Dacă am trecut de "LIQUIDO TOTAL A PERCIBIR", numărăm valorile găsite
              if (liquidoTotalIndex !== -1 && j > liquidoTotalIndex) {
                valoresDespuesLiquido++;
              }
              
              this.logger.debug(`🔍 Valoare candidată IRPF (linia ${j + 1}): ${value} din "${nextLine}" (valori după LIQUIDO: ${valoresDespuesLiquido})`);
              
              if (isAura) {
                this.logger.log(`🔍 [AURA IRPF] 🔍 Linia ${j + 1}: Valoare candidată: ${value} (după LIQUIDO: ${valoresDespuesLiquido})`);
              }
              
              // IRPF poate fi 0 sau orice valoare pozitivă validă (>= 0.01 pentru valori non-zero)
              // După "LIQUIDO TOTAL A PERCIBIR", primele 3 valori sunt pentru NETO, TOTAL A DEDUCIR și alte valori
              // Deci ignorăm primele 3 valori și acceptăm a 4-a sau următoarele
              if (!isNaN(value) && (value === 0 || value >= 0.01)) {
                // Verificăm dacă valoarea este aceeași cu NETO (dacă NETO a fost deja extras)
                // Dacă da, continuăm căutarea (aceasta este probabil NETO, nu IRPF)
                const isSameAsNeto = neto > 0 && Math.abs(value - neto) < 0.01;
                
                // Pentru AURA: dacă valoarea este un număr întreg mic (0-100), este probabil procentul
                const isAura = empleadoCodigo === '10000008';
                const isSmallInteger = value > 0 && value <= 100 && Number.isInteger(value);
                const isLikelyPercentageForAura = isAura && isSmallInteger;
                
                // Verificăm dacă valoarea este prea mare (probabil NETO sau alte totaluri, nu IRPF)
                // IRPF este de obicei o valoare mai mică (sub 500)
                // PENTRU AURA: IRPF poate fi mai mare (până la ~2000), dar nu mai mare decât NETO
                const isTooLarge = isAura 
                  ? (value > 2000 || (neto > 0 && value > neto))  // Pentru AURA: acceptăm până la 2000, dar nu mai mare decât NETO
                  : value > 500;  // Pentru alții: acceptăm doar până la 500
                
                // Colectăm informații pentru AURA
                if (isAura && auraDebugInfo) {
                  let reason = '';
                  if (isSameAsNeto) {
                    reason = `Ignorat: este aceeași cu NETO (${neto})`;
                  } else if (isTooLarge) {
                    if (isAura) {
                      reason = value > 2000 ? `Ignorat: este prea mare > 2000` : `Ignorat: este mai mare decât NETO (${neto})`;
                    } else {
                      reason = `Ignorat: este prea mare > 500`;
                    }
                  } else if (isLikelyPercentageForAura) {
                    reason = `Ignorat: este probabil procent`;
                  } else if (liquidoTotalIndex !== -1 && j > liquidoTotalIndex && valoresDespuesLiquido <= 3) {
                    reason = `Ignorat: a ${valoresDespuesLiquido}-a după LIQUIDO`;
                  } else {
                    reason = `ACCEPTAT`;
                  }
                  auraDebugInfo.irpfCandidates.push({
                    value: value,
                    line: j + 1,
                    reason: reason
                  });
                }
                
                if (isSameAsNeto) {
                  this.logger.debug(`⏭️ Ignorăm valoarea ${value} (este aceeași cu NETO: ${neto}), continuăm căutarea`);
                  if (isAura) {
                    this.logger.log(`🔍 [AURA IRPF] ⏭️ Ignorăm ${value} (este aceeași cu NETO: ${neto})`);
                  }
                  // Continuăm căutarea
                } else if (isTooLarge) {
                  if (isAura) {
                    const reason = value > 2000 ? `este prea mare > 2000` : `este mai mare decât NETO (${neto})`;
                    this.logger.debug(`⏭️ Ignorăm valoarea ${value} (${reason}), continuăm căutarea`);
                    this.logger.log(`🔍 [AURA IRPF] ⏭️ Ignorăm ${value} (${reason})`);
                  } else {
                    this.logger.debug(`⏭️ Ignorăm valoarea ${value} (este prea mare, probabil NETO sau alt total, nu IRPF), continuăm căutarea`);
                  }
                  // Continuăm căutarea
                } else if (isLikelyPercentageForAura) {
                  this.logger.debug(`⏭️ Ignorăm valoarea ${value} (este probabil procent pentru AURA), continuăm căutarea`);
                  if (isAura) {
                    this.logger.log(`🔍 [AURA IRPF] ⏭️ Ignorăm ${value} (este probabil procent)`);
                  }
                  // Continuăm căutarea
                } else if (liquidoTotalIndex !== -1 && j > liquidoTotalIndex && valoresDespuesLiquido <= 3) {
                  // Ignorăm primele 3 valori după "LIQUIDO TOTAL A PERCIBIR"
                  this.logger.debug(`⏭️ Ignorăm valoarea ${value} (a ${valoresDespuesLiquido}-a după LIQUIDO TOTAL A PERCIBIR), continuăm căutarea`);
                  if (isAura) {
                    this.logger.log(`🔍 [AURA IRPF] ⏭️ Ignorăm ${value} (a ${valoresDespuesLiquido}-a după LIQUIDO)`);
                  }
                  // Continuăm căutarea
                } else {
                  // Acceptăm valoarea (fie este înainte de "LIQUIDO TOTAL A PERCIBIR", fie este a 4-a sau următoarele)
                  irpf = value;
                  if (isAura && auraDebugInfo) {
                    auraDebugInfo.irpfFinalValue = irpf;
                  }
                  this.logger.debug(`✅ IRPF extras (linia ${j + 1}): ${irpf} din "${nextLine}"`);
                  if (isAura) {
                    this.logger.log(`🔍 [AURA IRPF] ✅ IRPF extras: ${irpf} din linia ${j + 1}`);
                  }
                  break;
                }
              }
            }
            }
          }
          
          if (isAura && !valueFound && irpf === 0) {
            this.logger.log(`🔍 [AURA IRPF] ⚠️ IRPF NU A FOST GĂSIT - rămâne 0`);
          } else if (isAura && valueFound) {
            this.logger.log(`🔍 [AURA IRPF] ✅ IRPF extras: ${irpf}`);
          }
        }
      }
      
      // Fallback 1: Căutăm "I.R.P.F." sau "IRPF" fără "2." (poate fi scris diferit)
      if (!irpf && (lineUpper.includes('I.R.P.F.') || lineUpper.includes('IRPF'))) {
        if (isAura) {
          this.logger.log(`🔍 [AURA IRPF] 🔄 FALLBACK 1: Căutăm "I.R.P.F." sau "IRPF" fără "2." pe linia ${i + 1}`);
        }
        
        // Căutăm valoarea pe aceeași linie sau următoarea
        const match = line.match(/I\.?R\.?P\.?F\.?[:\s.]*([\d.,]+)/i);
        if (match && match[1]) {
          const valueStr = match[1].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);
          if (!isNaN(value) && value >= 0) {
            irpf = value;
            this.logger.debug(`✅ IRPF extras (fallback 1, pe aceeași linie): ${irpf} din linia: "${line.substring(0, 100)}"`);
            if (isAura) {
              this.logger.log(`🔍 [AURA IRPF] ✅ IRPF extras (FALLBACK 1): ${irpf}`);
            }
          }
        } else if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const valueMatch = nextLine.match(/^([\d.,]+)$/);
          if (valueMatch && valueMatch[1]) {
            const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(valueStr);
            if (!isNaN(value) && value >= 0) {
              irpf = value;
              this.logger.debug(`✅ IRPF extras (fallback 1, linia următoare): ${irpf} din "${nextLine}"`);
              if (isAura) {
                this.logger.log(`🔍 [AURA IRPF] ✅ IRPF extras (FALLBACK 1, linia următoare): ${irpf}`);
              }
            }
          }
        }
      }
      
      // Fallback 2: Căutăm "RETENCIÓN IRPF"
      if (!irpf && (lineUpper.includes('RETENCIÓN IRPF') || lineUpper.includes('RETENCION IRPF'))) {
        if (isAura) {
          this.logger.log(`🔍 [AURA IRPF] 🔄 FALLBACK 2: Căutăm "RETENCIÓN IRPF" pe linia ${i + 1}`);
        }
        
        const value = extractValue(/([\d.,]+)/, line);
        if (value >= 0) {
          irpf = value;
          this.logger.debug(`✅ IRPF extras (fallback 2): ${irpf}`);
          if (isAura) {
            this.logger.log(`🔍 [AURA IRPF] ✅ IRPF extras (FALLBACK 2): ${irpf}`);
          }
        } else if (i + 1 < lines.length) {
          const nextValue = extractValue(/([\d.,]+)/, lines[i + 1]);
          if (nextValue >= 0) {
            irpf = nextValue;
            this.logger.debug(`✅ IRPF extras (fallback 2, linia următoare): ${irpf}`);
            if (isAura) {
              this.logger.log(`🔍 [AURA IRPF] ✅ IRPF extras (FALLBACK 2, linia următoare): ${irpf}`);
            }
          }
        }
      }

      // Enfermedad devolución - Căutăm în tabelul de concepte
      // Tabelul: CONCEPTO | DESCRIPCION | UNIDADES | IMPORTE | COMPLEM. | TIPO
      // Căutăm concepte cu "ENF" în DESCRIPCION și adunăm valorile din IMPORTE
      if (!enfermedad_devolucion) {
        // Căutăm începutul tabelului de concepte
        let conceptosTableStart = -1;
        for (let k = 0; k < lines.length; k++) {
          const checkLine = lines[k].toUpperCase();
          if (checkLine.includes('CONCEPTO') && (checkLine.includes('DESCRIPCION') || checkLine.includes('DESCRIPCIÓN'))) {
            conceptosTableStart = k;
            break;
          }
        }
        
        // Dacă am găsit tabelul de concepte, căutăm concepte cu "ENF"
        if (conceptosTableStart !== -1) {
          const isDobreAdrian = empleadoNombre && empleadoNombre.toUpperCase().includes('DOBRE') && empleadoNombre.toUpperCase().includes('ADRIAN');
          let enfValues: number[] = [];
          
          if (isDobreAdrian && dobreAdrianEnfInfo) {
            dobreAdrianEnfInfo.conceptosTableStart = conceptosTableStart;
          }
          
          // Parcurgem liniile după header-ul tabelului
          for (let k = conceptosTableStart + 1; k < lines.length; k++) {
            const tableLine = lines[k];
            const tableLineUpper = tableLine.toUpperCase();
            
            // Dacă găsim un nou header sau secțiune, ne oprim
            if (tableLineUpper.includes('TOTAL DEVENGADO') || 
                tableLineUpper.includes('II. DEDUCCIONES') ||
                tableLineUpper.includes('DEDUCCIONES') ||
                (tableLineUpper.includes('TOTAL') && tableLineUpper.includes('A DEDUCIR'))) {
              if (isDobreAdrian) {
                this.logger.log(`🔍 [DOBRE ADRIAN - ENF] Oprire la linia ${k + 1}: "${tableLine}"`);
              }
              break;
            }
            
            // Căutăm concepte cu "ENF" în DESCRIPCION
            // Format: "1.500 IT ENF BASE REGUL 75 30,00 1.130,57" sau similar
            // Coloanele: CONCEPTO | DESCRIPCION | UNIDADES | IMPORTE | COMPLEM. | TIPO
            if (tableLineUpper.includes('ENF')) {
              // Împărțim linia în coloane (separate prin spații multiple sau tab-uri)
              const columns = tableLine.split(/\s{2,}|\t/).filter(col => col.trim().length > 0);
              
              // Extragem toate valorile numerice din linie pentru analiză
              const allValues = tableLine.match(/[\d.,]+/g) || [];
              
              let extractedValue: number | null = null;
              let extractionMethod = '';
              
              if (columns.length >= 4) {
                // IMPORTE este de obicei a 4-a coloană (index 3)
                // Dar poate fi și a 3-a dacă UNIDADES lipsește
                // Încercăm să găsim coloana IMPORTE
                let importeValue: number | null = null;
                
                // Căutăm în coloanele 3, 4, 5 (posibile poziții pentru IMPORTE)
                for (let colIdx = 2; colIdx < Math.min(6, columns.length); colIdx++) {
                  const colValue = columns[colIdx].trim();
                  // Extragem valoarea numerică (poate conține puncte și virgule)
                  const valueMatch = colValue.match(/^([\d.,]+)/);
                  if (valueMatch) {
                    const valStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0 && val <= 100000) {
                      // IMPORTE este de obicei între 10 și 100000
                      if (val >= 10) {
                        importeValue = val;
                        extractedValue = val;
                        extractionMethod = `Coloana ${colIdx + 1}`;
                        break;
                      }
                    }
                  }
                }
                
                if (importeValue !== null) {
                  enfValues.push(importeValue);
                } else {
                  // Fallback: extragem toate valorile și luăm ultima valoare validă
                  extractionMethod = 'Fallback (nu s-a găsit în coloane)';
                  if (allValues.length > 0) {
                    // Colectăm toate valorile valide
                    const validValues: Array<{ value: number; index: number }> = [];
                    for (let vIdx = 0; vIdx < allValues.length; vIdx++) {
                      const valStr = allValues[vIdx];
                      const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
                      if (!isNaN(val) && val > 0 && val <= 100000) {
                        // Ignorăm valorile care sunt prea mari (probabil CONCEPTO) sau prea mici (probabil UNIDADES)
                        // IMPORTE este de obicei între 10 și 2000
                        if (val >= 10 && val <= 2000) {
                          validValues.push({ value: val, index: vIdx });
                        }
                      }
                    }
                    
                    if (validValues.length > 0) {
                      // Luăm ultima valoare validă (probabil IMPORTE sau COMPLEM.)
                      const selected = validValues[validValues.length - 1];
                      enfValues.push(selected.value);
                      extractedValue = selected.value;
                      extractionMethod = `Fallback (ultima valoare validă din ${validValues.length} valori)`;
                    } else {
                      // Dacă nu găsim valori în intervalul 10-2000, luăm ultima valoare validă (fără restricții)
                      for (let vIdx = allValues.length - 1; vIdx >= 0; vIdx--) {
                        const valStr = allValues[vIdx];
                        const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
                        if (!isNaN(val) && val >= 10 && val <= 100000) {
                          enfValues.push(val);
                          extractedValue = val;
                          extractionMethod = `Fallback (ultima valoare validă, fără restricții)`;
                          break;
                        }
                      }
                    }
                  }
                }
              } else {
                // Fallback: extragem toate valorile și luăm ultima valoare validă (sau cea mai mare)
                // IMPORTE este de obicei una dintre ultimele valori (după CONCEPTO, DESCRIPCION, UNIDADES)
                extractionMethod = `Fallback (prea puține coloane: ${columns.length})`;
                if (allValues.length > 0) {
                  // Colectăm toate valorile valide
                  const validValues: Array<{ value: number; index: number }> = [];
                  for (let vIdx = 0; vIdx < allValues.length; vIdx++) {
                    const valStr = allValues[vIdx];
                    const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
                    if (!isNaN(val) && val > 0 && val <= 100000) {
                      // Ignorăm valorile care sunt prea mari (probabil CONCEPTO) sau prea mici (probabil UNIDADES)
                      // IMPORTE este de obicei între 10 și 2000
                      if (val >= 10 && val <= 2000) {
                        validValues.push({ value: val, index: vIdx });
                      }
                    }
                  }
                  
                  if (validValues.length > 0) {
                    // Luăm ultima valoare validă (probabil IMPORTE sau COMPLEM.)
                    const selected = validValues[validValues.length - 1];
                    enfValues.push(selected.value);
                    extractedValue = selected.value;
                    extractionMethod = `Fallback (ultima valoare validă din ${validValues.length} valori)`;
                  } else {
                    // Dacă nu găsim valori în intervalul 10-2000, luăm ultima valoare validă (fără restricții)
                    for (let vIdx = allValues.length - 1; vIdx >= 0; vIdx--) {
                      const valStr = allValues[vIdx];
                      const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
                      if (!isNaN(val) && val >= 10 && val <= 100000) {
                        enfValues.push(val);
                        extractedValue = val;
                        extractionMethod = `Fallback (ultima valoare validă, fără restricții)`;
                        break;
                      }
                    }
                  }
                }
              }
              
              // Colectăm informațiile pentru DOBRE ADRIAN
              if (isDobreAdrian && dobreAdrianEnfInfo) {
                dobreAdrianEnfInfo.enfConcepts.push({
                  line: k + 1,
                  lineText: tableLine,
                  columns: columns,
                  allValues: allValues,
                  extractedValue: extractedValue,
                  extractionMethod: extractionMethod
                });
              }
            }
          }
          
          // Adunăm toate valorile găsite
          if (enfValues.length > 0) {
            enfermedad_devolucion = enfValues.reduce((sum, val) => sum + val, 0);
            if (isDobreAdrian && dobreAdrianEnfInfo) {
              dobreAdrianEnfInfo.enfFinalValue = enfermedad_devolucion;
            }
            this.logger.debug(`✅ Enfermedad Devolución extras din concepte ENF: ${enfermedad_devolucion.toFixed(2)} €`);
          } else {
            if (isDobreAdrian && dobreAdrianEnfInfo) {
              dobreAdrianEnfInfo.enfFinalValue = 0;
            }
          }
        }
        
        // Fallback: Căutăm pattern-ul vechi "ENFERMEDAD DEVOLUCIÓN" sau "ENF. DEVOLUCIÓN"
        if (!enfermedad_devolucion && (lineUpper.includes('ENFERMEDAD DEVOLUCIÓN') || lineUpper.includes('ENF. DEVOLUCIÓN'))) {
          const value = extractValue(/([\d.,]+)/, line);
          if (value > 0) {
            enfermedad_devolucion = value;
            const isDobreAdrian = empleadoNombre && empleadoNombre.toUpperCase().includes('DOBRE') && empleadoNombre.toUpperCase().includes('ADRIAN');
            if (isDobreAdrian) {
              this.logger.log(`🔍 [DOBRE ADRIAN - ENF] ENF. DEV. extras (fallback): ${enfermedad_devolucion.toFixed(2)} €`);
            }
          } else if (i + 1 < lines.length) {
            enfermedad_devolucion = extractValue(/([\d.,]+)/, lines[i + 1]);
            const isDobreAdrian = empleadoNombre && empleadoNombre.toUpperCase().includes('DOBRE') && empleadoNombre.toUpperCase().includes('ADRIAN');
            if (isDobreAdrian && enfermedad_devolucion > 0) {
              this.logger.log(`🔍 [DOBRE ADRIAN - ENF] ENF. DEV. extras (fallback, linia următoare): ${enfermedad_devolucion.toFixed(2)} €`);
            }
          }
        }
      }

      // Embargos
      const isGarciaGomez = empleadoNombre && empleadoNombre.toUpperCase().includes('GARCIA') && empleadoNombre.toUpperCase().includes('GOMEZ') && empleadoNombre.toUpperCase().includes('JUAN');
      
      if ((lineUpper.includes('EMBARGOS') || lineUpper.includes('EMBARGO')) && !embargos) {
        let embargoValue: number | null = null;
        let extractionMethod = '';
        const context: string[] = [];
        
        // Colectăm contextul (3 linii înainte și 3 după)
        for (let ctx = Math.max(0, i - 3); ctx < Math.min(i + 4, lines.length); ctx++) {
          const marker = ctx === i ? ' ⬅️ AICI ESTE "EMBARGO"' : '';
          context.push(`Linia ${ctx + 1}: "${lines[ctx]}"${marker}`);
        }
        
        // Căutăm valoarea pe aceeași linie
        const value = extractValue(/([\d.,]+)/, line);
        if (value > 0) {
          embargos = value;
          embargoValue = value;
          extractionMethod = 'Pe aceeași linie';
        } else if (i + 1 < lines.length) {
          const nextValue = extractValue(/([\d.,]+)/, lines[i + 1]);
          if (nextValue > 0) {
            embargos = nextValue;
            embargoValue = nextValue;
            extractionMethod = 'Pe linia următoare';
          }
        }
        
        // Colectăm informațiile pentru GARCIA GOMEZ JUAN MANUEL
        if (isGarciaGomez && garciaGomezEmbargosInfo) {
          garciaGomezEmbargosInfo.embargoPatterns.push({
            line: i + 1,
            lineText: line,
            valueFound: embargoValue,
            extractionMethod: embargoValue !== null ? extractionMethod : 'Nu s-a găsit valoare',
            context: context
          });
        }
      }

      // Anticipo
      const isGarciaMoran = empleadoNombre && empleadoNombre.toUpperCase().includes('GARCIA') && empleadoNombre.toUpperCase().includes('MORAN') && empleadoNombre.toUpperCase().includes('JUAN');
      
      if ((lineUpper.includes('ANTICIPO') || lineUpper.includes('ANTICIPOS')) && !anticipo) {
        let anticipoValue: number | null = null;
        let extractionMethod = '';
        const context: string[] = [];
        
        // Colectăm contextul (3 linii înainte și 3 după)
        for (let ctx = Math.max(0, i - 3); ctx < Math.min(i + 4, lines.length); ctx++) {
          const marker = ctx === i ? ' ⬅️ AICI ESTE "ANTICIPO"' : '';
          context.push(`Linia ${ctx + 1}: "${lines[ctx]}"${marker}`);
        }
        
        // Căutăm valoarea pe aceeași linie
        const value = extractValue(/([\d.,]+)/, line);
        if (value > 0) {
          anticipo = value;
          anticipoValue = value;
          extractionMethod = 'Pe aceeași linie';
        } else if (i + 1 < lines.length) {
          const nextValue = extractValue(/([\d.,]+)/, lines[i + 1]);
          if (nextValue > 0) {
            anticipo = nextValue;
            anticipoValue = nextValue;
            extractionMethod = 'Pe linia următoare';
          }
        }
        
        // Colectăm informațiile pentru GARCIA MORAN JUAN ANTONIO
        if (isGarciaMoran && garciaMoranAnticipoInfo) {
          garciaMoranAnticipoInfo.anticipoPatterns.push({
            line: i + 1,
            lineText: line,
            valueFound: anticipoValue,
            extractionMethod: anticipoValue !== null ? extractionMethod : 'Nu s-a găsit valoare',
            context: context
          });
        }
      }
      
      // Setăm valoarea finală pentru GARCIA MORAN (va fi setată la sfârșitul funcției)

      // Absentismo laboral
      if ((lineUpper.includes('ABSENTISMO LABORAL') || lineUpper.includes('ABSENTISMO')) && !absentismo_laboral) {
        let absentismoValue: number | null = null;
        let extractionMethod = '';
        const context: string[] = [];
        
        // Colectăm contextul (3 linii înainte și 3 după)
        for (let ctx = Math.max(0, i - 3); ctx < Math.min(i + 4, lines.length); ctx++) {
          const marker = ctx === i ? ' ⬅️ AICI ESTE "ABSENTISMO"' : '';
          context.push(`Linia ${ctx + 1}: "${lines[ctx]}"${marker}`);
        }
        
        // Căutăm valoarea pe aceeași linie
        const value = extractValue(/([\d.,]+)/, line);
        if (value > 0) {
          absentismo_laboral = value;
          absentismoValue = value;
          extractionMethod = 'Pattern 1: Pe aceeași linie (ABSENTISMO)';
          this.logger.debug(`✅ Absentismo extras (pe aceeași linie): ${absentismo_laboral} din "${line.substring(0, 100)}"`);
        } else if (i + 1 < lines.length) {
          // Valoarea este pe linia următoare
          const nextLine = lines[i + 1].trim();
          const nextValue = extractValue(/([\d.,]+)/, nextLine);
          if (nextValue > 0) {
            absentismo_laboral = nextValue;
            absentismoValue = nextValue;
            extractionMethod = 'Pattern 1: Pe linia următoare (ABSENTISMO)';
            this.logger.debug(`✅ Absentismo extras (pe linia următoare): ${absentismo_laboral} din "${nextLine}"`);
          }
        }
        
        // Colectăm informațiile pentru MANZANO CUEVAS MARA
        if (manzanoCuevasAbsentismoInfo && absentismoValue !== null) {
          manzanoCuevasAbsentismoInfo.absentismoPatterns.push({
            line: i + 1,
            lineText: line,
            valueFound: absentismoValue,
            extractionMethod: extractionMethod,
            context: context
          });
        }
      }

      // Seg. Social Empresa
      // Pattern 1: "Total aportaciones 343,33" (fără "1.") → Seg. Social Empresa
      if ((lineUpper.includes('TOTAL APORTACIONES') || lineUpper.includes('TOTAL APORTACION')) && 
          !lineUpper.includes('1.') && !lineUpper.startsWith('1 ') && !seg_social_empresa) {
        let segSocialValue: number | null = null;
        let extractionMethod = '';
        const context: string[] = [];
        
        // Colectăm contextul (3 linii înainte și 3 după)
        for (let ctx = Math.max(0, i - 3); ctx < Math.min(i + 4, lines.length); ctx++) {
          const marker = ctx === i ? ' ⬅️ AICI ESTE "TOTAL APORTACIONES"' : '';
          context.push(`Linia ${ctx + 1}: "${lines[ctx]}"${marker}`);
        }
        
        // Căutăm valoarea pe aceeași linie
        const match = line.match(/TOTAL\s+APORTACIONES?[:\s.]*([\d.,]+)/i);
        if (match && match[1]) {
          const valueStr = match[1].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);
          if (!isNaN(value) && value > 0) {
            seg_social_empresa = value;
            segSocialValue = value;
            extractionMethod = 'Pattern 1: Pe aceeași linie (TOTAL APORTACIONES)';
            this.logger.debug(`✅ Seg. Social Empresa extras: ${seg_social_empresa} din linia: "${line.substring(0, 100)}"`);
          }
        } else if (i + 1 < lines.length) {
          // Valoarea este pe linia următoare
          const nextLine = lines[i + 1].trim();
          const nextLineUpper = nextLine.toUpperCase();
          
          // Verificăm dacă linia următoare nu conține text care indică că nu este o valoare monetară
          const isNotMonetaryValue = nextLineUpper.includes('COTIZACIÓN') || 
                                    nextLineUpper.includes('COTIZACION') ||
                                    nextLineUpper.includes('HORAS') ||
                                    nextLineUpper.includes('EMERGENCIA') ||
                                    nextLineUpper.includes('EXTRAS') ||
                                    nextLineUpper.match(/^\d+\.\s+[A-Z]/); // Pattern: "3. Cotización" sau similar
          
          if (!isNotMonetaryValue) {
            const valueMatch = nextLine.match(/^([\d.,]+)/);
            if (valueMatch && valueMatch[1]) {
              const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
              const value = parseFloat(valueStr);
              // Seg. Social Empresa este de obicei o valoare mai mare (>= 10)
              if (!isNaN(value) && value >= 10) {
                seg_social_empresa = value;
                segSocialValue = value;
                extractionMethod = 'Pattern 1: Pe linia următoare (TOTAL APORTACIONES)';
                this.logger.debug(`✅ Seg. Social Empresa extras (linia următoare): ${seg_social_empresa} din "${nextLine}"`);
              } else if (isAura && auraDebugInfo) {
                // Pentru AURA, logăm și valorile mici care sunt ignorate
                auraDebugInfo.segSocialPatterns.push({
                  line: i + 1,
                  lineText: line,
                  valueFound: value,
                  extractionMethod: `Pattern 1: Ignorat (valoare prea mică: ${value} < 10 sau linia următoare conține text)`,
                  context: context
                });
              }
            }
          } else if (isAura && auraDebugInfo) {
            // Pentru AURA, logăm când linia următoare conține text care indică că nu este o valoare monetară
            auraDebugInfo.segSocialPatterns.push({
              line: i + 1,
              lineText: line,
              valueFound: null,
              extractionMethod: `Pattern 1: Ignorat (linia următoare conține text: "${nextLine}")`,
              context: context
            });
          }
        }
        
        // Colectăm informațiile pentru AURA
        if (isAura && auraDebugInfo && segSocialValue !== null) {
          auraDebugInfo.segSocialPatterns.push({
            line: i + 1,
            lineText: line,
            valueFound: segSocialValue,
            extractionMethod: extractionMethod,
            context: context
          });
        }
      }
      
      // Pattern 2: "SEG. SOCIAL EMPRESA" sau "SEGURIDAD SOCIAL EMPRESA" (fallback)
      if ((lineUpper.includes('SEG. SOCIAL EMPRESA') || lineUpper.includes('SEGURIDAD SOCIAL EMPRESA')) && !seg_social_empresa) {
        let segSocialValue: number | null = null;
        let extractionMethod = '';
        const context: string[] = [];
        
        // Colectăm contextul (3 linii înainte și 3 după)
        for (let ctx = Math.max(0, i - 3); ctx < Math.min(i + 4, lines.length); ctx++) {
          const marker = ctx === i ? ' ⬅️ AICI ESTE "SEG. SOCIAL EMPRESA"' : '';
          context.push(`Linia ${ctx + 1}: "${lines[ctx]}"${marker}`);
        }
        
        const value = extractValue(/([\d.,]+)/, line);
        if (value > 0) {
          seg_social_empresa = value;
          segSocialValue = value;
          extractionMethod = 'Pattern 2: Pe aceeași linie (SEG. SOCIAL EMPRESA)';
        } else if (i + 1 < lines.length) {
          const nextValue = extractValue(/([\d.,]+)/, lines[i + 1]);
          if (nextValue > 0) {
            seg_social_empresa = nextValue;
            segSocialValue = nextValue;
            extractionMethod = 'Pattern 2: Pe linia următoare (SEG. SOCIAL EMPRESA)';
          }
        }
        
        // Colectăm informațiile pentru AURA
        if (isAura && auraDebugInfo && segSocialValue !== null) {
          auraDebugInfo.segSocialPatterns.push({
            line: i + 1,
            lineText: line,
            valueFound: segSocialValue,
            extractionMethod: extractionMethod,
            context: context
          });
        }
      }
    }
    
    // Pattern 3: "Base % Cuota emp" - căutăm valoarea "Cuota emp" (ultima valoare din linie)
    // Exemplu: "4.294,81 520,19" → 520,19 este Seg. Social Empresa
    if (!seg_social_empresa) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineUpper = line.toUpperCase();
        
        // Căutăm linia cu "BASE" și "CUOTA EMP" sau "COTA EMP"
        if ((lineUpper.includes('BASE') && (lineUpper.includes('CUOTA EMP') || lineUpper.includes('COTA EMP'))) ||
            (lineUpper.match(/BASE\s+%\s+CUOTA\s+EMP/i))) {
          // Extragem toate valorile numerice din linie
          const values = line.match(/[\d.,]+/g);
          if (values && values.length >= 2) {
            // Ultima valoare este "Cuota emp" (Seg. Social Empresa)
            const lastValueStr = values[values.length - 1].replace(/\./g, '').replace(',', '.');
            const lastValue = parseFloat(lastValueStr);
            if (!isNaN(lastValue) && lastValue >= 10) {
              seg_social_empresa = lastValue;
              if (isAura && auraDebugInfo) {
                auraDebugInfo.segSocialPatterns.push({
                  line: i + 1,
                  lineText: line,
                  valueFound: lastValue,
                  extractionMethod: 'Pattern 3: Din "Base % Cuota emp" (ultima valoare)',
                  context: []
                });
              }
              this.logger.debug(`✅ Seg. Social Empresa extras (Base % Cuota emp): ${seg_social_empresa} din "${line}"`);
              break;
            }
          }
        }
      }
    }

    // Setăm irpfFinalValue pentru AURA dacă nu a fost setat anterior
    if (isAura && auraDebugInfo && auraDebugInfo.irpfFinalValue === null) {
      auraDebugInfo.irpfFinalValue = irpf;
    }
    
    // Setăm segSocialFinalValue pentru AURA dacă nu a fost setat anterior
    if (isAura && auraDebugInfo && auraDebugInfo.segSocialFinalValue === null) {
      auraDebugInfo.segSocialFinalValue = seg_social_empresa;
    }
    
    // Setăm embargosFinalValue pentru GARCIA GOMEZ dacă nu a fost setat anterior
    const isGarciaGomez = empleadoNombre && empleadoNombre.toUpperCase().includes('GARCIA') && empleadoNombre.toUpperCase().includes('GOMEZ') && empleadoNombre.toUpperCase().includes('JUAN');
    if (isGarciaGomez && garciaGomezEmbargosInfo && garciaGomezEmbargosInfo.embargosFinalValue === null) {
      garciaGomezEmbargosInfo.embargosFinalValue = embargos;
    }
    
    // Setăm anticipoFinalValue pentru GARCIA MORAN dacă nu a fost setat anterior
    const isGarciaMoran = empleadoNombre && empleadoNombre.toUpperCase().includes('GARCIA') && empleadoNombre.toUpperCase().includes('MORAN') && empleadoNombre.toUpperCase().includes('JUAN');
    if (isGarciaMoran && garciaMoranAnticipoInfo && garciaMoranAnticipoInfo.anticipoFinalValue === null) {
      garciaMoranAnticipoInfo.anticipoFinalValue = anticipo;
    }
    
    // Setăm absentismoFinalValue pentru MANZANO CUEVAS MARA dacă nu a fost setat anterior
    const isManzanoCuevas = empleadoNombre && empleadoNombre.toUpperCase().includes('MANZANO') && empleadoNombre.toUpperCase().includes('CUEVAS') && empleadoNombre.toUpperCase().includes('MARA');
    if (isManzanoCuevas && manzanoCuevasAbsentismoInfo && manzanoCuevasAbsentismoInfo.absentismoFinalValue === null) {
      manzanoCuevasAbsentismoInfo.absentismoFinalValue = absentismo_laboral;
    }
    
    return {
      total,
      neto,
      aportaciones_trabajador,
      irpf,
      enfermedad_devolucion,
      embargos,
      anticipo,
      absentismo_laboral,
      seg_social_empresa,
    };
  }

  /**
   * Procesează PDF-uri pentru Coste Personal (nu salvează în Nominas, doar extrage datele)
   */
  async procesarPDFsParaCostePersonal(
    files: Express.Multer.File[],
    mes?: string,
    ano?: number,
  ): Promise<{
    processed: number;
    errors: number;
    mes_detectado?: string | null;
    ano_detectado?: number | null;
    preview: Array<{
      nombre_archivo: string;
      pagina?: number;
      nombre: string;
      codigo: string | null;
      nombre_bd: string | null;
      empleado_encontrado: boolean;
      es_finiquito: boolean;
      total: number;
      total_calculado: number;
      total_aportaciones: number;
      neto: number;
      aportaciones_trabajador: number;
      irpf: number;
      enfermedad_devolucion: number;
      embargos: number;
      anticipo: number;
      absentismo_laboral: number;
      seg_social_empresa: number;
      error?: string;
    }>;
  }> {
    try {
      const pdfLib = require('pdf-lib');
      const pdfParseModule = require('pdf-parse');
      const PDFParse = pdfParseModule.PDFParse;

      let processed = 0;
      let errors = 0;
      const preview: Array<any> = [];
      
      // Colectăm informații pentru angajații speciali (pentru rezumat la sfârșit)
      const empleadosEspecialesInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        irpf: number;
        neto: number;
        archivo: string;
        pagina: number;
      }> = [];
      
      // Colectăm informații detaliate pentru AURA (pentru log final separat)
      const auraInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        irpf: number;
        neto: number;
        aportaciones_trabajador: number;
        seg_social_empresa: number;
        archivo: string;
        pagina: number;
        irpfPatternFound: boolean;
        irpfPatternLine: number | null;
        irpfPatternContext: string[];
        irpfCandidates: Array<{ value: number; line: number; reason: string }>;
        irpfFinalValue: number | null;
        segSocialPatterns: Array<{
          line: number;
          lineText: string;
          valueFound: number | null;
          extractionMethod: string;
          context: string[];
        }>;
        segSocialFinalValue: number | null;
      }> = [];
      
      // Colectăm informații detaliate pentru DOBRE ADRIAN MINEL (pentru log final separat)
      const dobreAdrianEnfInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        enfermedad_devolucion: number;
        archivo: string;
        pagina: number;
        conceptosTableStart: number | null;
        enfConcepts: Array<{
          line: number;
          lineText: string;
          columns: string[];
          allValues: string[];
          extractedValue: number | null;
          extractionMethod: string;
        }>;
        enfFinalValue: number | null;
      }> = [];
      
      // Colectăm informații detaliate pentru GARCIA GOMEZ JUAN MANUEL (pentru log final separat)
      const garciaGomezEmbargosInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        embargos: number;
        archivo: string;
        pagina: number;
        embargoPatterns: Array<{
          line: number;
          lineText: string;
          valueFound: number | null;
          extractionMethod: string;
          context: string[];
        }>;
        embargosFinalValue: number | null;
      }> = [];
      
      // Colectăm informații detaliate pentru GARCIA MORAN JUAN ANTONIO (pentru log final separat)
      const garciaMoranAnticipoInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        anticipo: number;
        archivo: string;
        pagina: number;
        anticipoPatterns: Array<{
          line: number;
          lineText: string;
          valueFound: number | null;
          extractionMethod: string;
          context: string[];
        }>;
        anticipoFinalValue: number | null;
      }> = [];
      
      // Colectăm informații detaliate pentru MANZANO CUEVAS MARA (pentru log final separat)
      const manzanoCuevasAbsentismoInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        absentismo_laboral: number;
        archivo: string;
        pagina: number;
        absentismoPatterns: Array<{
          line: number;
          lineText: string;
          valueFound: number | null;
          extractionMethod: string;
          context: string[];
        }>;
        absentismoFinalValue: number | null;
      }> = [];
      
      // Detectăm mes și ano global din PDF-uri (din majoritatea paginilor)
      const mesCounts: { [key: number]: number } = {};
      const anoCounts: { [key: number]: number } = {};
      const mesNombreCounts: { [key: string]: number } = {};

      // Procesăm fiecare fișier
      for (const file of files) {
        try {
          const pdfDoc = await pdfLib.PDFDocument.load(file.buffer);
          const totalPages = pdfDoc.getPageCount();

          // Procesăm fiecare pagină
          for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            try {
              // Extragem pagina ca PDF separat
              const newPdfDoc = await pdfLib.PDFDocument.create();
              const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
              newPdfDoc.addPage(copiedPage);
              const pagePdfBytes = await newPdfDoc.save();

              // Extragem textul din pagină
              const pdfInstance = new PDFParse({ data: new Uint8Array(pagePdfBytes) });
              const pageTextResult = await pdfInstance.getText();
              const textContent = (pageTextResult && typeof pageTextResult === 'object' && 'text' in pageTextResult) 
                ? pageTextResult.text 
                : (typeof pageTextResult === 'string' ? pageTextResult : '');

              // Detectăm dacă este finiquito
              const esFiniquito = this.detectarFiniquito(textContent);

              // Extragem datele necesare (înainte de a căuta numele, pentru cazul când nu găsim numele)
              let datos = this.extraerDatosNomina(textContent);

              // Detectăm numele din PDF (folosim aceeași logică ca în uploadBulkNominas)
              const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
              let nombreDetectado: string | null = null;
              
              // Detectăm luna și anul din PDF
              const mesesNombres = [
                'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
              ];
              
              let mesDetectado: number | null = null;
              let anoDetectado: number | null = null;
              
              // Pattern 1: "del X de [mes] al Y de [mes] de [an]" (ex: "del 1 de noviembre al 30 de noviembre de 2.025")
              const periodoMatch = textContent.match(/del\s+\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+al\s+\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{1,4}(?:\.\d{1,4})?)/i);
              if (periodoMatch) {
                const mesNombre = periodoMatch[2].toLowerCase();
                const mesIndex = mesesNombres.findIndex(m => m === mesNombre);
                if (mesIndex >= 0) {
                  mesDetectado = mesIndex + 1;
                  const anoStr = periodoMatch[3].replace(/\./g, '');
                  const anoNum = parseInt(anoStr, 10);
                  if (anoNum < 100 && anoNum >= 2) {
                    if (periodoMatch[3].includes('.')) {
                      const parts = periodoMatch[3].split('.');
                      if (parts.length === 2) {
                        anoDetectado = parseInt(parts[0] + parts[1], 10);
                      }
                    } else {
                      anoDetectado = 2000 + anoNum;
                    }
                  } else {
                    anoDetectado = anoNum;
                  }
                }
              }
              
              // Pattern 2: "de [mes] de [an]" (ex: "de noviembre de 2025")
              if (!mesDetectado) {
                const mesAnoMatch = textContent.match(/de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{1,4})/i);
                if (mesAnoMatch) {
                  const mesNombre = mesAnoMatch[1].toLowerCase();
                  const mesIndex = mesesNombres.findIndex(m => m === mesNombre);
                  if (mesIndex >= 0) {
                    mesDetectado = mesIndex + 1;
                    const anoStr = mesAnoMatch[2].replace(/\./g, '');
                    anoDetectado = parseInt(anoStr, 10);
                  }
                }
              }
              
              // Pattern 3: Căutăm nume de lună cu an (ex: "NOVIEMBRE 2025", "noviembre 2.025")
              if (!mesDetectado) {
                for (let idx = 0; idx < mesesNombres.length; idx++) {
                  const mesNombre = mesesNombres[idx];
                  const mesNombreUpper = mesNombre.toUpperCase();
                  const mesMatch = textContent.match(
                    new RegExp(`(${mesNombre}|${mesNombreUpper})\\s+(\\d{1,4})`, 'i')
                  );
                  if (mesMatch) {
                    const anoStr = mesMatch[2].replace(/\./g, '');
                    const anoNum = parseInt(anoStr, 10);
                    if (anoNum >= 2000 && anoNum <= 2100) {
                      mesDetectado = idx + 1;
                      anoDetectado = anoNum;
                      break;
                    }
                  }
                }
              }
              
              // Adăugăm la contoare pentru a găsi mes/ano cel mai frecvent
              if (mesDetectado) {
                mesCounts[mesDetectado] = (mesCounts[mesDetectado] || 0) + 1;
                const mesNombreDetectado = mesesNombres[mesDetectado - 1].toUpperCase();
                mesNombreCounts[mesNombreDetectado] = (mesNombreCounts[mesNombreDetectado] || 0) + 1;
              }
              if (anoDetectado) {
                anoCounts[anoDetectado] = (anoCounts[anoDetectado] || 0) + 1;
              }

              // Pattern 1: Căutăm numele după "Periodo de liquidación.:" - numele este pe următoarea linie
              for (let idx = 0; idx < lines.length; idx++) {
                if (lines[idx].match(/Periodo\s+de\s+liquidación/i)) {
                  if (idx + 1 < lines.length) {
                    const nombreLine = lines[idx + 1];
                    if (nombreLine && nombreLine.includes('\t')) {
                      nombreDetectado = nombreLine.split('\t')[0].trim();
                      break;
                    }
                    if (nombreLine && nombreLine.includes('DE CAMINO')) {
                      nombreDetectado = nombreLine.split('DE CAMINO')[0].trim();
                      break;
                    }
                    if (nombreLine && nombreLine.trim().length > 5 && 
                        !nombreLine.match(/^(EMPRESA|N\.I\.F\.|Núm|Ocupación|Seg\.|Social|del\s+\d+)/i) &&
                        /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}/.test(nombreLine)) {
                      nombreDetectado = nombreLine.trim();
                      break;
                    }
                  }
                }
              }

              // Pattern 2: Căutăm "TRABAJADOR /A" și apoi numele pe următoarele linii (fallback)
              if (!nombreDetectado) {
                for (let idx = 0; idx < Math.min(lines.length, 10); idx++) {
                  if (lines[idx].match(/TRABAJADOR\s*\/A/i)) {
                    for (let j = idx + 1; j < Math.min(idx + 4, lines.length); j++) {
                      const candidateLine = lines[j];
                      if (candidateLine && 
                          !candidateLine.match(/^(N\.I\.F\.|Núm|Ocupación|Seg\.|Social|EMPRESA|del\s+\d+)/i) &&
                          /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}/.test(candidateLine)) {
                        const nombreMatch = candidateLine.match(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+N\.I\.F\.|$)/);
                        if (nombreMatch) {
                          nombreDetectado = nombreMatch[1].trim();
                          break;
                        }
                      }
                    }
                    if (nombreDetectado) break;
                  }
                }
              }

              if (!nombreDetectado) {
                // Calculăm total_calculado chiar dacă nu am găsit numele
                const totalCalculado = 
                  (datos.neto || 0) +
                  (datos.aportaciones_trabajador || 0) +
                  (datos.irpf || 0) -
                  (datos.enfermedad_devolucion || 0) +
                  (datos.embargos || 0) +
                  (datos.anticipo || 0) +
                  (datos.seg_social_empresa || 0);
                
                // Calculăm total_aportaciones: APORTACIONES_TRABAJADOR + SEG_SOCIAL_EMPRESA
                const totalAportaciones = 
                  (datos.aportaciones_trabajador || 0) +
                  (datos.seg_social_empresa || 0);
                
                preview.push({
                  nombre_archivo: file.originalname,
                  pagina: pageIndex + 1,
                  nombre: `Página ${pageIndex + 1} de ${file.originalname}`,
                  codigo: null,
                  nombre_bd: null,
                  empleado_encontrado: false,
                  es_finiquito: esFiniquito,
                  total: totalCalculado,
                  total_calculado: totalCalculado,
                  total_aportaciones: totalAportaciones,
                  neto: datos.neto,
                  aportaciones_trabajador: datos.aportaciones_trabajador,
                  irpf: datos.irpf,
                  enfermedad_devolucion: datos.enfermedad_devolucion,
                  embargos: datos.embargos,
                  anticipo: datos.anticipo,
                  absentismo_laboral: datos.absentismo_laboral,
                  seg_social_empresa: datos.seg_social_empresa,
                  error: 'Nombre no detectado en PDF',
                });
                errors++;
                continue;
              }

              // Căutăm angajatul după nume
              const empleadoEncontrado = await this.findEmpleadoFlexible(
                nombreDetectado,
                null,
                null,
              );

              // Re-extragem datele cu loguri speciale dacă este un angajat special
              let codigoEmpleado: string | null = null;
              let nombreBd: string | null = null;
              if (empleadoEncontrado) {
                codigoEmpleado = empleadoEncontrado.CODIGO;
                nombreBd = empleadoEncontrado['NOMBRE / APELLIDOS'] || null;
                
                // Re-extragem datele cu loguri speciale pentru angajații speciali
                const empleadosEspeciales = ['10000008', '10000004', '10000063'];
                if (empleadosEspeciales.includes(codigoEmpleado)) {
                  // Colectăm informații detaliate pentru AURA
                  let auraDebugInfo: any = null;
                  if (codigoEmpleado === '10000008') {
                    auraDebugInfo = {
                      irpfPatternFound: false,
                      irpfPatternLine: null,
                      irpfPatternContext: [],
                      irpfCandidates: [],
                      irpfFinalValue: null,
                      segSocialPatterns: [],
                      segSocialFinalValue: null,
                    };
                  }
                  
                  datos = this.extraerDatosNomina(textContent, nombreDetectado || undefined, codigoEmpleado, auraDebugInfo);
                  
                  // Colectăm informații detaliate pentru AURA
                  if (codigoEmpleado === '10000008' && auraDebugInfo) {
                    auraInfo.push({
                      codigo: codigoEmpleado,
                      nombre: nombreDetectado || 'N/A',
                      nombre_bd: nombreBd,
                      irpf: datos.irpf,
                      neto: datos.neto,
                      aportaciones_trabajador: datos.aportaciones_trabajador,
                      seg_social_empresa: datos.seg_social_empresa,
                      archivo: file.originalname,
                      pagina: pageIndex + 1,
                      irpfPatternFound: auraDebugInfo.irpfPatternFound,
                      irpfPatternLine: auraDebugInfo.irpfPatternLine,
                      irpfPatternContext: auraDebugInfo.irpfPatternContext,
                      irpfCandidates: auraDebugInfo.irpfCandidates,
                      irpfFinalValue: auraDebugInfo.irpfFinalValue,
                      segSocialPatterns: auraDebugInfo.segSocialPatterns || [],
                      segSocialFinalValue: auraDebugInfo.segSocialFinalValue,
                    });
                  }
                }
                
                // Colectăm informații detaliate pentru DOBRE ADRIAN MINEL
                const isDobreAdrian = nombreDetectado && nombreDetectado.toUpperCase().includes('DOBRE') && nombreDetectado.toUpperCase().includes('ADRIAN');
                if (isDobreAdrian) {
                  let dobreAdrianDebugInfo: any = null;
                  dobreAdrianDebugInfo = {
                    conceptosTableStart: null,
                    enfConcepts: [],
                    enfFinalValue: null,
                  };
                  
                  datos = this.extraerDatosNomina(textContent, nombreDetectado || undefined, codigoEmpleado || undefined, undefined, dobreAdrianDebugInfo);
                  
                  if (dobreAdrianDebugInfo) {
                    dobreAdrianEnfInfo.push({
                      codigo: codigoEmpleado || 'N/A',
                      nombre: nombreDetectado || 'N/A',
                      nombre_bd: nombreBd,
                      enfermedad_devolucion: datos.enfermedad_devolucion,
                      archivo: file.originalname,
                      pagina: pageIndex + 1,
                      conceptosTableStart: dobreAdrianDebugInfo.conceptosTableStart,
                      enfConcepts: dobreAdrianDebugInfo.enfConcepts,
                      enfFinalValue: dobreAdrianDebugInfo.enfFinalValue,
                    });
                  }
                }
                
                // Colectăm informații detaliate pentru GARCIA GOMEZ JUAN MANUEL
                const isGarciaGomez = nombreDetectado && nombreDetectado.toUpperCase().includes('GARCIA') && nombreDetectado.toUpperCase().includes('GOMEZ') && nombreDetectado.toUpperCase().includes('JUAN');
                if (isGarciaGomez) {
                  let garciaGomezDebugInfo: any = null;
                  garciaGomezDebugInfo = {
                    embargoPatterns: [],
                    embargosFinalValue: null,
                  };
                  
                  datos = this.extraerDatosNomina(textContent, nombreDetectado || undefined, codigoEmpleado || undefined, undefined, undefined, garciaGomezDebugInfo);
                  
                  if (garciaGomezDebugInfo) {
                    garciaGomezEmbargosInfo.push({
                      codigo: codigoEmpleado || 'N/A',
                      nombre: nombreDetectado || 'N/A',
                      nombre_bd: nombreBd,
                      embargos: datos.embargos,
                      archivo: file.originalname,
                      pagina: pageIndex + 1,
                      embargoPatterns: garciaGomezDebugInfo.embargoPatterns,
                      embargosFinalValue: garciaGomezDebugInfo.embargosFinalValue,
                    });
                  }
                }
                
                // Colectăm informații detaliate pentru GARCIA MORAN JUAN ANTONIO
                const isGarciaMoran = nombreDetectado && nombreDetectado.toUpperCase().includes('GARCIA') && nombreDetectado.toUpperCase().includes('MORAN') && nombreDetectado.toUpperCase().includes('JUAN');
                if (isGarciaMoran) {
                  let garciaMoranDebugInfo: any = null;
                  garciaMoranDebugInfo = {
                    anticipoPatterns: [],
                    anticipoFinalValue: null,
                  };
                  
                  datos = this.extraerDatosNomina(textContent, nombreDetectado || undefined, codigoEmpleado || undefined, undefined, undefined, undefined, garciaMoranDebugInfo);
                  
                  if (garciaMoranDebugInfo) {
                    garciaMoranAnticipoInfo.push({
                      codigo: codigoEmpleado || 'N/A',
                      nombre: nombreDetectado || 'N/A',
                      nombre_bd: nombreBd,
                      anticipo: datos.anticipo,
                      archivo: file.originalname,
                      pagina: pageIndex + 1,
                      anticipoPatterns: garciaMoranDebugInfo.anticipoPatterns,
                      anticipoFinalValue: garciaMoranDebugInfo.anticipoFinalValue,
                    });
                  }
                }
                
                // Colectăm informații detaliate pentru MANZANO CUEVAS MARA
                const isManzanoCuevas = nombreDetectado && nombreDetectado.toUpperCase().includes('MANZANO') && nombreDetectado.toUpperCase().includes('CUEVAS') && nombreDetectado.toUpperCase().includes('MARA');
                if (isManzanoCuevas) {
                  let manzanoCuevasDebugInfo: any = null;
                  manzanoCuevasDebugInfo = {
                    absentismoPatterns: [],
                    absentismoFinalValue: null,
                  };
                  
                  datos = this.extraerDatosNomina(textContent, nombreDetectado || undefined, codigoEmpleado || undefined, undefined, undefined, undefined, undefined, manzanoCuevasDebugInfo);
                  
                  if (manzanoCuevasDebugInfo) {
                    manzanoCuevasAbsentismoInfo.push({
                      codigo: codigoEmpleado || 'N/A',
                      nombre: nombreDetectado || 'N/A',
                      nombre_bd: nombreBd,
                      absentismo_laboral: datos.absentismo_laboral,
                      archivo: file.originalname,
                      pagina: pageIndex + 1,
                      absentismoPatterns: manzanoCuevasDebugInfo.absentismoPatterns,
                      absentismoFinalValue: manzanoCuevasDebugInfo.absentismoFinalValue,
                    });
                  }
                }
              }

              // Calculăm total_calculado: NETO + APORTACIONES_TRABAJADOR + IRPF - ENFERMEDAD_DEVOLUCION + EMBARGOS + ANTICIPO + SEG_SOCIAL_EMPRESA
              const totalCalculado = 
                (datos.neto || 0) +
                (datos.aportaciones_trabajador || 0) +
                (datos.irpf || 0) -
                (datos.enfermedad_devolucion || 0) +
                (datos.embargos || 0) +
                (datos.anticipo || 0) +
                (datos.seg_social_empresa || 0);

              // Calculăm total_aportaciones: APORTACIONES_TRABAJADOR + SEG_SOCIAL_EMPRESA
              const totalAportaciones = 
                (datos.aportaciones_trabajador || 0) +
                (datos.seg_social_empresa || 0);

              // Colectăm informații pentru angajații speciali
              const empleadosEspeciales = ['10000008', '10000004', '10000063'];
              if (codigoEmpleado && empleadosEspeciales.includes(codigoEmpleado)) {
                empleadosEspecialesInfo.push({
                  codigo: codigoEmpleado,
                  nombre: nombreDetectado || 'N/A',
                  nombre_bd: nombreBd,
                  irpf: datos.irpf,
                  neto: datos.neto,
                  archivo: file.originalname,
                  pagina: pageIndex + 1,
                });
              }

              if (empleadoEncontrado) {
                // Marcăm ca "encontrado" doar dacă confidența este >= 80%
                const confianza = empleadoEncontrado.confianza || 0;
                preview.push({
                  nombre_archivo: file.originalname,
                  pagina: pageIndex + 1,
                  nombre: nombreDetectado,
                  codigo: empleadoEncontrado.CODIGO,
                  nombre_bd: empleadoEncontrado['NOMBRE / APELLIDOS'] || nombreDetectado,
                  empleado_encontrado: confianza >= 80,
                  confianza: confianza,
                  matchType: empleadoEncontrado.matchType || 'unknown',
                  es_finiquito: esFiniquito,
                  total: totalCalculado, // Pentru PDF-uri folosim doar total_calculado
                  total_calculado: totalCalculado,
                  total_aportaciones: totalAportaciones,
                  neto: datos.neto,
                  aportaciones_trabajador: datos.aportaciones_trabajador,
                  irpf: datos.irpf,
                  enfermedad_devolucion: datos.enfermedad_devolucion,
                  embargos: datos.embargos,
                  anticipo: datos.anticipo,
                  absentismo_laboral: datos.absentismo_laboral,
                  seg_social_empresa: datos.seg_social_empresa,
                });
                processed++;
              } else {
                preview.push({
                  nombre_archivo: file.originalname,
                  pagina: pageIndex + 1,
                  nombre: nombreDetectado,
                  codigo: null,
                  nombre_bd: null,
                  empleado_encontrado: false,
                  es_finiquito: esFiniquito,
                  total: totalCalculado, // Pentru PDF-uri folosim doar total_calculado
                  total_calculado: totalCalculado,
                  total_aportaciones: totalAportaciones,
                  neto: datos.neto,
                  aportaciones_trabajador: datos.aportaciones_trabajador,
                  irpf: datos.irpf,
                  enfermedad_devolucion: datos.enfermedad_devolucion,
                  embargos: datos.embargos,
                  anticipo: datos.anticipo,
                  absentismo_laboral: datos.absentismo_laboral,
                  seg_social_empresa: datos.seg_social_empresa,
                  error: 'Empleado no encontrado',
                });
                errors++;
              }
            } catch (pageError: any) {
              this.logger.error(`❌ Error procesando página ${pageIndex + 1} de ${file.originalname}:`, pageError);
              preview.push({
                nombre_archivo: file.originalname,
                pagina: pageIndex + 1,
                nombre: `Página ${pageIndex + 1} de ${file.originalname}`,
                codigo: null,
                nombre_bd: null,
                empleado_encontrado: false,
                es_finiquito: false,
                total: 0,
                total_calculado: 0,
                total_aportaciones: 0,
                neto: 0,
                aportaciones_trabajador: 0,
                irpf: 0,
                enfermedad_devolucion: 0,
                embargos: 0,
                anticipo: 0,
                absentismo_laboral: 0,
                seg_social_empresa: 0,
                error: pageError.message || 'Error procesando página',
              });
              errors++;
            }
          }
        } catch (fileError: any) {
          this.logger.error(`❌ Error procesando archivo ${file.originalname}:`, fileError);
          preview.push({
            nombre_archivo: file.originalname,
            nombre: file.originalname,
            codigo: null,
            nombre_bd: null,
            empleado_encontrado: false,
            es_finiquito: false,
            total: 0,
            total_calculado: 0,
            total_aportaciones: 0,
            neto: 0,
            aportaciones_trabajador: 0,
            irpf: 0,
            enfermedad_devolucion: 0,
            embargos: 0,
            anticipo: 0,
            absentismo_laboral: 0,
            seg_social_empresa: 0,
            error: fileError.message || 'Error procesando archivo',
          });
          errors++;
        }
      }

      // Găsim mes/ano cel mai frecvent
      let mesGlobal: string | null = null;
      let anoGlobal: number | null = null;
      
      if (Object.keys(mesNombreCounts).length > 0) {
        const mesMasFrecuente = Object.keys(mesNombreCounts).reduce((a, b) => 
          mesNombreCounts[a] > mesNombreCounts[b] ? a : b
        );
        mesGlobal = mesMasFrecuente;
      }
      
      if (Object.keys(anoCounts).length > 0) {
        const anoMasFrecuente = Object.keys(anoCounts).reduce((a, b) => 
          anoCounts[parseInt(a, 10)] > anoCounts[parseInt(b, 10)] ? a : b
        );
        anoGlobal = parseInt(anoMasFrecuente, 10);
      }
      
      // Dacă nu am detectat mes/ano, folosim parametrii furnizați
      if (!mesGlobal && mes) {
        mesGlobal = mes.toUpperCase();
      }
      if (!anoGlobal && ano) {
        anoGlobal = ano;
      }

      this.logger.log(`✅ PDFs procesados para Coste Personal: ${processed} procesadas, ${errors} errores. Mes detectado: ${mesGlobal || 'N/A'}, Ano detectado: ${anoGlobal || 'N/A'}`);
      
      // Rezumat pentru angajații speciali
      if (empleadosEspecialesInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`📋 REZUMAT ANGAJAȚI SPECIALI - IRPF EXTRACTION`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of empleadosEspecialesInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Archivo: ${info.archivo} - Página ${info.pagina}`);
          this.logger.log(`   💰 NETO extras: ${info.neto.toFixed(2)} €`);
          this.logger.log(`   💰 IRPF extras: ${info.irpf.toFixed(2)} €`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      // Log final separat pentru AURA
      if (auraInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`🔍🔍🔍 REZUMAT FINAL AURA - IRPF EXTRACTION`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of auraInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Archivo: ${info.archivo} - Página ${info.pagina}`);
          this.logger.log(`   💰 NETO extras: ${info.neto.toFixed(2)} €`);
          this.logger.log(`   💰 IRPF extras: ${info.irpf.toFixed(2)} €`);
          this.logger.log(`   💰 Aportaciones Trabajador: ${info.aportaciones_trabajador.toFixed(2)} €`);
          this.logger.log(`   💰 Seg. Social Empresa: ${info.seg_social_empresa.toFixed(2)} €`);
          if (info.irpf === 0) {
            this.logger.log(`   ⚠️ PROBLEMA: IRPF extras este 0.00 € în loc de 1.073,70 €`);
          } else {
            this.logger.log(`   ✅ IRPF extras corect: ${info.irpf.toFixed(2)} €`);
          }
          
          // Detalii despre căutarea IRPF
          this.logger.log(`\n   🔍 DETALII CĂUTARE IRPF:`);
          this.logger.log(`   - Pattern "2. I.R.P.F." găsit: ${info.irpfPatternFound ? 'DA' : 'NU'}`);
          if (info.irpfPatternFound && info.irpfPatternLine) {
            this.logger.log(`   - Linia pattern: ${info.irpfPatternLine}`);
            this.logger.log(`   - Context (5 linii înainte și 20 după):`);
            for (const contextLine of info.irpfPatternContext) {
              this.logger.log(`     ${contextLine}`);
            }
          }
          this.logger.log(`   - Valori candidate găsite: ${info.irpfCandidates.length}`);
          if (info.irpfCandidates.length > 0) {
            for (const candidate of info.irpfCandidates) {
              this.logger.log(`     • Linia ${candidate.line}: ${candidate.value.toFixed(2)} € - ${candidate.reason}`);
            }
          }
          this.logger.log(`   - Valoare finală extrasă: ${info.irpfFinalValue !== null ? info.irpfFinalValue.toFixed(2) + ' €' : 'NULL'}`);
          
          // Detalii despre căutarea Seg. Social Empresa
          this.logger.log(`\n   🔍 DETALII CĂUTARE SEG. SOCIAL EMPRESA:`);
          this.logger.log(`   - Pattern-uri găsite: ${info.segSocialPatterns.length}`);
          if (info.segSocialPatterns.length > 0) {
            for (const pattern of info.segSocialPatterns) {
              this.logger.log(`\n     📄 Pattern Seg. Social Empresa pe linia ${pattern.line}:`);
              this.logger.log(`       Linia completă: "${pattern.lineText}"`);
              if (pattern.valueFound !== null) {
                this.logger.log(`       ✅ Valoare extrasă: ${pattern.valueFound.toFixed(2)} € (${pattern.extractionMethod})`);
              } else {
                this.logger.log(`       ❌ Nu s-a extras nicio valoare (${pattern.extractionMethod})`);
              }
              this.logger.log(`       Context (3 linii înainte și 3 după):`);
              for (const contextLine of pattern.context) {
                this.logger.log(`         ${contextLine}`);
              }
            }
          } else {
            this.logger.log(`   ⚠️ Nu s-au găsit pattern-uri pentru Seg. Social Empresa`);
          }
          this.logger.log(`   - Valoare finală extrasă: ${info.segSocialFinalValue !== null ? info.segSocialFinalValue.toFixed(2) + ' €' : 'NULL'}`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      // Log final separat pentru DOBRE ADRIAN MINEL
      if (dobreAdrianEnfInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`🔍🔍🔍 REZUMAT FINAL DOBRE ADRIAN MINEL - ENF. DEV. EXTRACTION`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of dobreAdrianEnfInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Archivo: ${info.archivo} - Página ${info.pagina}`);
          this.logger.log(`   💰 ENF. DEV. extras: ${info.enfermedad_devolucion.toFixed(2)} €`);
          if (info.enfermedad_devolucion === 0) {
            this.logger.log(`   ⚠️ PROBLEMA: ENF. DEV. extras este 0.00 €`);
          } else if (info.enfermedad_devolucion === 1500) {
            this.logger.log(`   ⚠️ PROBLEMA: ENF. DEV. extras este 1500.00 € în loc de 1.130,57 €`);
          } else {
            this.logger.log(`   ✅ ENF. DEV. extras: ${info.enfermedad_devolucion.toFixed(2)} €`);
          }
          
          // Detalii despre căutarea ENF. DEV.
          this.logger.log(`\n   🔍 DETALII CĂUTARE ENF. DEV.:`);
          if (info.conceptosTableStart !== null) {
            this.logger.log(`   - Header tabel găsit la linia: ${info.conceptosTableStart + 1}`);
          } else {
            this.logger.log(`   - Header tabel: NU GĂSIT`);
          }
          this.logger.log(`   - Concepte ENF găsite: ${info.enfConcepts.length}`);
          if (info.enfConcepts.length > 0) {
            for (const concept of info.enfConcepts) {
              this.logger.log(`\n     📄 Concept ENF pe linia ${concept.line}:`);
              this.logger.log(`       Linia completă: "${concept.lineText}"`);
              this.logger.log(`       Număr coloane: ${concept.columns.length}`);
              for (let c = 0; c < concept.columns.length; c++) {
                this.logger.log(`         Coloana ${c + 1}: "${concept.columns[c]}"`);
              }
              this.logger.log(`       Toate valorile numerice: ${concept.allValues.join(', ')}`);
              if (concept.extractedValue !== null) {
                this.logger.log(`       ✅ Valoare extrasă: ${concept.extractedValue.toFixed(2)} € (${concept.extractionMethod})`);
              } else {
                this.logger.log(`       ❌ Nu s-a extras nicio valoare (${concept.extractionMethod})`);
              }
            }
          }
          this.logger.log(`   - Valoare finală extrasă: ${info.enfFinalValue !== null ? info.enfFinalValue.toFixed(2) + ' €' : 'NULL'}`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      // Log final separat pentru GARCIA GOMEZ JUAN MANUEL
      if (garciaGomezEmbargosInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`🔍🔍🔍 REZUMAT FINAL GARCIA GOMEZ JUAN MANUEL - EMBARGOS EXTRACTION`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of garciaGomezEmbargosInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Archivo: ${info.archivo} - Página ${info.pagina}`);
          this.logger.log(`   💰 EMBARGOS extras: ${info.embargos.toFixed(2)} €`);
          if (info.embargos === 0) {
            this.logger.log(`   ⚠️ PROBLEMA: EMBARGOS extras este 0.00 €`);
          } else {
            this.logger.log(`   ✅ EMBARGOS extras: ${info.embargos.toFixed(2)} €`);
          }
          
          // Detalii despre căutarea EMBARGOS
          this.logger.log(`\n   🔍 DETALII CĂUTARE EMBARGOS:`);
          this.logger.log(`   - Pattern-uri "EMBARGO" sau "EMBARGOS" găsite: ${info.embargoPatterns.length}`);
          if (info.embargoPatterns.length > 0) {
            for (const pattern of info.embargoPatterns) {
              this.logger.log(`\n     📄 Pattern EMBARGO pe linia ${pattern.line}:`);
              this.logger.log(`       Linia completă: "${pattern.lineText}"`);
              if (pattern.valueFound !== null) {
                this.logger.log(`       ✅ Valoare extrasă: ${pattern.valueFound.toFixed(2)} € (${pattern.extractionMethod})`);
              } else {
                this.logger.log(`       ❌ Nu s-a extras nicio valoare (${pattern.extractionMethod})`);
              }
              this.logger.log(`       Context (3 linii înainte și 3 după):`);
              for (const contextLine of pattern.context) {
                this.logger.log(`         ${contextLine}`);
              }
            }
          } else {
            this.logger.log(`   ⚠️ Nu s-au găsit pattern-uri "EMBARGO" sau "EMBARGOS"`);
          }
          this.logger.log(`   - Valoare finală extrasă: ${info.embargosFinalValue !== null ? info.embargosFinalValue.toFixed(2) + ' €' : 'NULL'}`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      // Log final separat pentru GARCIA MORAN JUAN ANTONIO
      if (garciaMoranAnticipoInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`🔍🔍🔍 REZUMAT FINAL GARCIA MORAN JUAN ANTONIO - ANTICIPO EXTRACTION`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of garciaMoranAnticipoInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Archivo: ${info.archivo} - Página ${info.pagina}`);
          this.logger.log(`   💰 ANTICIPO extras: ${info.anticipo.toFixed(2)} €`);
          if (info.anticipo === 0) {
            this.logger.log(`   ⚠️ PROBLEMA: ANTICIPO extras este 0.00 €`);
          } else {
            this.logger.log(`   ✅ ANTICIPO extras: ${info.anticipo.toFixed(2)} €`);
          }
          
          // Detalii despre căutarea ANTICIPO
          this.logger.log(`\n   🔍 DETALII CĂUTARE ANTICIPO:`);
          this.logger.log(`   - Pattern-uri "ANTICIPO" sau "ANTICIPOS" găsite: ${info.anticipoPatterns.length}`);
          if (info.anticipoPatterns.length > 0) {
            for (const pattern of info.anticipoPatterns) {
              this.logger.log(`\n     📄 Pattern ANTICIPO pe linia ${pattern.line}:`);
              this.logger.log(`       Linia completă: "${pattern.lineText}"`);
              if (pattern.valueFound !== null) {
                this.logger.log(`       ✅ Valoare extrasă: ${pattern.valueFound.toFixed(2)} € (${pattern.extractionMethod})`);
              } else {
                this.logger.log(`       ❌ Nu s-a extras nicio valoare (${pattern.extractionMethod})`);
              }
              this.logger.log(`       Context (3 linii înainte și 3 după):`);
              for (const contextLine of pattern.context) {
                this.logger.log(`         ${contextLine}`);
              }
            }
          } else {
            this.logger.log(`   ⚠️ Nu s-au găsit pattern-uri "ANTICIPO" sau "ANTICIPOS"`);
          }
          this.logger.log(`   - Valoare finală extrasă: ${info.anticipoFinalValue !== null ? info.anticipoFinalValue.toFixed(2) + ' €' : 'NULL'}`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      // Rezumat final pentru MANZANO CUEVAS MARA - ABSENTISMO
      if (manzanoCuevasAbsentismoInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`🔍🔍🔍 REZUMAT FINAL MANZANO CUEVAS MARA - ABSENTISMO EXTRACTION`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of manzanoCuevasAbsentismoInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Archivo: ${info.archivo} - Página ${info.pagina}`);
          this.logger.log(`   💰 ABSENTISMO extras: ${info.absentismo_laboral.toFixed(2)} €`);
          if (info.absentismo_laboral === 0) {
            this.logger.log(`   ⚠️ PROBLEMA: ABSENTISMO extras este 0.00 €`);
          } else {
            this.logger.log(`   ✅ ABSENTISMO extras: ${info.absentismo_laboral.toFixed(2)} €`);
          }
          
          // Detalii despre căutarea ABSENTISMO
          this.logger.log(`\n   🔍 DETALII CĂUTARE ABSENTISMO:`);
          this.logger.log(`   - Pattern-uri "ABSENTISMO LABORAL" sau "ABSENTISMO" găsite: ${info.absentismoPatterns.length}`);
          if (info.absentismoPatterns.length > 0) {
            for (const pattern of info.absentismoPatterns) {
              this.logger.log(`\n     📄 Pattern ABSENTISMO pe linia ${pattern.line}:`);
              this.logger.log(`       Linia completă: "${pattern.lineText}"`);
              if (pattern.valueFound !== null) {
                this.logger.log(`       ✅ Valoare extrasă: ${pattern.valueFound.toFixed(2)} € (${pattern.extractionMethod})`);
              } else {
                this.logger.log(`       ❌ Nu s-a extras nicio valoare (${pattern.extractionMethod})`);
              }
              this.logger.log(`       Context (3 linii înainte și 3 după):`);
              for (const contextLine of pattern.context) {
                this.logger.log(`         ${contextLine}`);
              }
            }
          } else {
            this.logger.log(`   ⚠️ Nu s-au găsit pattern-uri "ABSENTISMO LABORAL" sau "ABSENTISMO"`);
          }
          this.logger.log(`   - Valoare finală extrasă: ${info.absentismoFinalValue !== null ? info.absentismoFinalValue.toFixed(2) + ' €' : 'NULL'}`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      // Sortăm preview-ul: Nóminas primul, apoi Finiquitos
      preview.sort((a, b) => {
        // Nóminas (es_finiquito: false) înainte de Finiquitos (es_finiquito: true)
        if (a.es_finiquito === b.es_finiquito) {
          // Dacă sunt de același tip, sortăm după nume de fișier și pagină
          if (a.nombre_archivo !== b.nombre_archivo) {
            return a.nombre_archivo.localeCompare(b.nombre_archivo);
          }
          return (a.pagina || 0) - (b.pagina || 0);
        }
        // false (Nómina) vine înainte de true (Finiquito)
        return a.es_finiquito ? 1 : -1;
      });
      
      return { processed, errors, mes_detectado: mesGlobal, ano_detectado: anoGlobal, preview };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando PDFs para Coste Personal:`, error);
      throw new BadRequestException(`Error al procesar PDFs: ${error.message}`);
    }
  }

  /**
   * Salvează date Coste Personal din preview (după confirmare)
   */
  async saveCostePersonalFromPreview(
    mes: string,
    ano: number,
    previewData: Array<{
      codigo: string | null;
      nombre: string;
      nombre_bd: string | null;
      empleado_encontrado: boolean;
      es_finiquito?: boolean;
      total: number;
      neto: number;
      aportaciones_trabajador: number;
      irpf: number;
      enfermedad_devolucion: number;
      embargos: number;
      anticipo: number;
      absentismo_laboral: number;
      seg_social_empresa: number;
    }>
  ): Promise<{ saved: number; updated: number; notFound: number }> {
    try {
      let saved = 0;
      let updated = 0;
      let notFound = 0;

      for (const row of previewData) {
        // Calculăm total_calculado: NETO + APORTACIONES_TRABAJADOR + IRPF - ENFERMEDAD_DEVOLUCION + EMBARGOS + ANTICIPO + SEG_SOCIAL_EMPRESA
        const totalCalculado = 
          (row.neto || 0) +
          (row.aportaciones_trabajador || 0) +
          (row.irpf || 0) -
          (row.enfermedad_devolucion || 0) +
          (row.embargos || 0) +
          (row.anticipo || 0) +
          (row.seg_social_empresa || 0);

        // Calculăm total_aportaciones: APORTACIONES_TRABAJADOR + SEG_SOCIAL_EMPRESA
        const totalAportaciones = 
          (row.aportaciones_trabajador || 0) +
          (row.seg_social_empresa || 0);

        // Dacă este finiquito, adăugăm " - FINIQUITO" la nume
        const nombreEmpleadoFinal = row.es_finiquito 
          ? `${row.nombre} - FINIQUITO`
          : row.nombre;
        
        // Dacă nu avem codigo, generăm un cod temporar bazat pe numele din PDF
        // Folosim primele caractere din nume + mes + an pentru a evita coliziuni (max 50 caractere)
        const nombreSinAcentos = nombreEmpleadoFinal.replace(/[^A-Z0-9]/g, '').toUpperCase().substring(0, 15);
        const codigoEmpleadoFinal = row.codigo || `NO_ENC_${nombreSinAcentos}_${mes.substring(0, 3)}${ano}`.substring(0, 50);
        
        // Verificăm dacă există deja
        // Dacă avem codigo, căutăm după codigo; altfel căutăm după nombre_empleado
        let existingQuery = '';
        if (row.codigo && row.empleado_encontrado) {
          // Angajat găsit - căutăm după codigo
          existingQuery = `
            SELECT id
            FROM \`coste_personal\`
            WHERE \`codigo_empleado\` = ${this.escapeSql(row.codigo)}
              AND \`mes\` = ${this.escapeSql(mes)}
              AND \`ano\` = ${this.escapeSql(ano.toString())}
          `;
        } else {
          // Angajat negăsit - căutăm după nombre_empleado (numele din PDF) și codigo temporar
          existingQuery = `
            SELECT id
            FROM \`coste_personal\`
            WHERE \`nombre_empleado\` = ${this.escapeSql(nombreEmpleadoFinal)}
              AND \`mes\` = ${this.escapeSql(mes)}
              AND \`ano\` = ${this.escapeSql(ano.toString())}
              AND \`codigo_empleado\` LIKE 'NO_ENCONTRADO_%'
          `;
        }
        
        const existing = await this.prisma.$queryRawUnsafe<any[]>(existingQuery);
        
        if (existing.length > 0) {
          // Actualizăm
          const updateQuery = `
            UPDATE \`coste_personal\`
            SET 
              \`codigo_empleado\` = ${this.escapeSql(codigoEmpleadoFinal)},
              \`nombre_empleado\` = ${this.escapeSql(nombreEmpleadoFinal)},
              \`nombre_bd\` = ${row.nombre_bd ? this.escapeSql(row.nombre_bd) : 'NULL'},
              \`empleado_encontrado\` = ${row.empleado_encontrado ? 1 : 0},
              \`total\` = ${row.total},
              \`total_calculado\` = ${totalCalculado},
              \`neto\` = ${row.neto},
              \`aportaciones_trabajador\` = ${row.aportaciones_trabajador},
              \`irpf\` = ${row.irpf},
              \`enfermedad_devolucion\` = ${row.enfermedad_devolucion},
              \`embargos\` = ${row.embargos},
              \`anticipo\` = ${row.anticipo},
              \`absentismo_laboral\` = ${row.absentismo_laboral},
              \`seg_social_empresa\` = ${row.seg_social_empresa},
              \`total_aportaciones\` = ${totalAportaciones},
              \`updated_at\` = NOW()
            WHERE \`id\` = ${existing[0].id}
          `;
          await this.prisma.$executeRawUnsafe(updateQuery);
          updated++;
        } else {
          // Creăm nou
          const insertQuery = `
            INSERT INTO \`coste_personal\` (
              \`codigo_empleado\`,
              \`nombre_empleado\`,
              \`nombre_bd\`,
              \`empleado_encontrado\`,
              \`mes\`,
              \`ano\`,
              \`total\`,
              \`total_calculado\`,
              \`neto\`,
              \`aportaciones_trabajador\`,
              \`irpf\`,
              \`enfermedad_devolucion\`,
              \`embargos\`,
              \`anticipo\`,
              \`absentismo_laboral\`,
              \`seg_social_empresa\`,
              \`total_aportaciones\`,
              \`created_at\`,
              \`updated_at\`
            ) VALUES (
              ${this.escapeSql(codigoEmpleadoFinal)},
              ${this.escapeSql(nombreEmpleadoFinal)},
              ${row.nombre_bd ? this.escapeSql(row.nombre_bd) : 'NULL'},
              ${row.empleado_encontrado ? 1 : 0},
              ${this.escapeSql(mes)},
              ${ano},
              ${row.total},
              ${totalCalculado},
              ${row.neto},
              ${row.aportaciones_trabajador},
              ${row.irpf},
              ${row.enfermedad_devolucion},
              ${row.embargos},
              ${row.anticipo},
              ${row.absentismo_laboral},
              ${row.seg_social_empresa},
              ${totalAportaciones},
              NOW(),
              NOW()
            )
          `;
          await this.prisma.$executeRawUnsafe(insertQuery);
          saved++;
        }
        
        // Dacă angajatul nu a fost găsit, incrementăm notFound pentru statistici
        if (!row.empleado_encontrado) {
          notFound++;
        }
      }

      this.logger.log(`✅ Coste Personal guardado desde preview: ${saved} creados, ${updated} actualizados, ${notFound} no encontrados`);
      
      // Adăugăm rândurile speciale: TOTAL, CON AURA, VACACIONES (pentru PDF, VACACIONES = 0)
      await this.agregarFilasEspeciales(mes, ano, undefined);
      
      return { saved, updated, notFound };
    } catch (error: any) {
      this.logger.error(`❌ Error guardando Coste Personal desde preview:`, error);
      throw new BadRequestException(`Error al guardar datos: ${error.message}`);
    }
  }

  /**
   * Preview: Procesează nóminas pentru Coste Personal fără să salveze (preview)
   */
  async previewPoblarCostePersonalDesdeNominas(
    mes: string,
    ano: number
  ): Promise<{ 
    processed: number; 
    preview: Array<{
      nombre: string;
      codigo: string | null;
      nombre_bd: string | null;
      empleado_encontrado: boolean;
      es_finiquito: boolean;
      total: number;
      total_calculado: number;
      total_aportaciones: number;
      neto: number;
      aportaciones_trabajador: number;
      irpf: number;
      enfermedad_devolucion: number;
      embargos: number;
      anticipo: number;
      absentismo_laboral: number;
      seg_social_empresa: number;
      error?: string;
    }>;
    errors: number;
  }> {
    try {
      const mesesNombres = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const mesNumero = mesesNombres.findIndex(m => m.toUpperCase() === mes.toUpperCase()) + 1;
      if (mesNumero === 0) {
        throw new BadRequestException(`Mes inválido: ${mes}`);
      }

      // Obținem toate nóminas pentru luna și anul specificat (inclusiv finiquitos)
      const nominasQuery = `
        SELECT 
          n.\`id\`,
          n.\`nombre\`,
          n.\`archivo\`,
          n.\`Mes\`,
          n.\`Ano\`
        FROM \`Nominas\` n
        WHERE (n.\`Mes\` = ${this.escapeSql(mesNumero.toString())} 
           OR n.\`Mes\` = ${this.escapeSql(mesesNombres[mesNumero - 1])}
           OR UPPER(n.\`Mes\`) = ${this.escapeSql(mes.toUpperCase())})
          AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
        ORDER BY n.\`nombre\` ASC
      `;

      const nominas = await this.prisma.$queryRawUnsafe<any[]>(nominasQuery);
      
      this.logger.log(`📊 Preview: Encontradas ${nominas.length} nóminas para ${mes} ${ano}`);

      let processed = 0;
      let errors = 0;
      const preview: Array<any> = [];
      
      // Colectăm informații pentru angajații speciali (pentru rezumat la sfârșit)
      const empleadosEspecialesInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        irpf: number;
        neto: number;
        nomina: string;
      }> = [];

      const pdfParseModule = require('pdf-parse');
      const PDFParse = pdfParseModule.PDFParse;

      for (const nomina of nominas) {
        try {
          // Extragem textul din PDF
          const pdfBuffer = Buffer.from(nomina.archivo);
          const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
          const pageTextResult = await pdfInstance.getText();
          const textContent = (pageTextResult && typeof pageTextResult === 'object' && 'text' in pageTextResult) 
            ? pageTextResult.text 
            : (typeof pageTextResult === 'string' ? pageTextResult : '');

          // Detectăm dacă este finiquito
          const esFiniquito = this.detectarFiniquito(textContent) || nomina.nombre.startsWith('FINIQUITO - ');

          // Căutăm angajatul după nume
          const nombreEmpleado = nomina.nombre.replace(/^FINIQUITO - /, '').trim();
          const empleadoQuery = `
            SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
            FROM \`DatosEmpleados\`
            WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) = ${this.escapeSql(nombreEmpleado.toUpperCase().trim())}
            LIMIT 1
          `;
          
          const empleado = await this.prisma.$queryRawUnsafe<any[]>(empleadoQuery);
          
          // Extragem datele necesare (după ce am găsit numele și codigo pentru loguri speciale)
          let codigoEmpleado: string | null = null;
          let nombreBd: string | null = null;
          if (empleado.length > 0) {
            codigoEmpleado = empleado[0].CODIGO;
            nombreBd = empleado[0]['NOMBRE / APELLIDOS'] || null;
          }
          
          const datos = this.extraerDatosNomina(textContent, nombreEmpleado, codigoEmpleado || undefined);
          
          // Calculăm total_calculado: NETO + APORTACIONES_TRABAJADOR + IRPF - ENFERMEDAD_DEVOLUCION + EMBARGOS + ANTICIPO + SEG_SOCIAL_EMPRESA
          const totalCalculado = 
            (datos.neto || 0) +
            (datos.aportaciones_trabajador || 0) +
            (datos.irpf || 0) -
            (datos.enfermedad_devolucion || 0) +
            (datos.embargos || 0) +
            (datos.anticipo || 0) +
            (datos.seg_social_empresa || 0);

          // Calculăm total_aportaciones: APORTACIONES_TRABAJADOR + SEG_SOCIAL_EMPRESA
          const totalAportaciones = 
            (datos.aportaciones_trabajador || 0) +
            (datos.seg_social_empresa || 0);
          
          if (empleado.length === 0) {
            preview.push({
              nombre: nombreEmpleado,
              codigo: null,
              nombre_bd: null,
              empleado_encontrado: false,
              es_finiquito: esFiniquito,
              total: totalCalculado,
              total_calculado: totalCalculado,
              total_aportaciones: totalAportaciones,
              neto: datos.neto,
              aportaciones_trabajador: datos.aportaciones_trabajador,
              irpf: datos.irpf,
              enfermedad_devolucion: datos.enfermedad_devolucion,
              embargos: datos.embargos,
              anticipo: datos.anticipo,
              absentismo_laboral: datos.absentismo_laboral,
              seg_social_empresa: datos.seg_social_empresa,
              error: 'Empleado no encontrado',
            });
            errors++;
            continue;
          }

          const codigo = empleado[0].CODIGO;
          const nombreCompleto = empleado[0]['NOMBRE / APELLIDOS'] || nombreEmpleado;
          
          // Colectăm informații pentru angajații speciali
          const empleadosEspeciales = ['10000008', '10000004', '10000063'];
          if (empleadosEspeciales.includes(codigo)) {
            empleadosEspecialesInfo.push({
              codigo: codigo,
              nombre: nombreEmpleado,
              nombre_bd: nombreCompleto,
              irpf: datos.irpf,
              neto: datos.neto,
              nomina: nomina.nombre,
            });
          }

          preview.push({
            nombre: nombreEmpleado,
            codigo,
            nombre_bd: nombreCompleto,
            empleado_encontrado: true,
            es_finiquito: esFiniquito,
            total: totalCalculado,
            total_calculado: totalCalculado,
            total_aportaciones: totalAportaciones,
            neto: datos.neto,
            aportaciones_trabajador: datos.aportaciones_trabajador,
            irpf: datos.irpf,
            enfermedad_devolucion: datos.enfermedad_devolucion,
            embargos: datos.embargos,
            anticipo: datos.anticipo,
            absentismo_laboral: datos.absentismo_laboral,
            seg_social_empresa: datos.seg_social_empresa,
          });
          processed++;
        } catch (error: any) {
          this.logger.error(`❌ Error procesando nómina ${nomina.id} (preview):`, error);
          preview.push({
            nombre: nomina.nombre,
            codigo: null,
            nombre_bd: null,
            empleado_encontrado: false,
            es_finiquito: nomina.nombre.startsWith('FINIQUITO - '),
            total: 0,
            total_calculado: 0,
            total_aportaciones: 0,
            neto: 0,
            aportaciones_trabajador: 0,
            irpf: 0,
            enfermedad_devolucion: 0,
            embargos: 0,
            anticipo: 0,
            absentismo_laboral: 0,
            seg_social_empresa: 0,
            error: error.message || 'Error procesando PDF',
          });
          errors++;
        }
      }

      this.logger.log(`✅ Preview Coste Personal: ${processed} procesadas, ${errors} errores`);
      
      // Rezumat pentru angajații speciali
      if (empleadosEspecialesInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`📋 REZUMAT ANGAJAȚI SPECIALI - IRPF EXTRACTION (PREVIEW NÓMINAS)`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of empleadosEspecialesInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Nómina: ${info.nomina}`);
          this.logger.log(`   💰 NETO extras: ${info.neto.toFixed(2)} €`);
          this.logger.log(`   💰 IRPF extras: ${info.irpf.toFixed(2)} €`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      return { processed, preview, errors };
    } catch (error: any) {
      this.logger.error(`❌ Error preview poblando Coste Personal desde nóminas:`, error);
      throw new BadRequestException(`Error al poblar datos: ${error.message}`);
    }
  }

  /**
   * Populează tabelul Coste Personal din nóminas pentru o lună și an
   */
  async poblarCostePersonalDesdeNominas(
    mes: string,
    ano: number
  ): Promise<{ processed: number; saved: number; updated: number; errors: number }> {
    try {
      const mesesNombres = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const mesNumero = mesesNombres.findIndex(m => m.toUpperCase() === mes.toUpperCase()) + 1;
      if (mesNumero === 0) {
        throw new BadRequestException(`Mes inválido: ${mes}`);
      }

      // Obținem toate nóminas pentru luna și anul specificat
      const nominasQuery = `
        SELECT 
          n.\`id\`,
          n.\`nombre\`,
          n.\`archivo\`,
          n.\`Mes\`,
          n.\`Ano\`
        FROM \`Nominas\` n
        WHERE (n.\`Mes\` = ${this.escapeSql(mesNumero.toString())} 
           OR n.\`Mes\` = ${this.escapeSql(mesesNombres[mesNumero - 1])}
           OR UPPER(n.\`Mes\`) = ${this.escapeSql(mes.toUpperCase())})
          AND n.\`Ano\` = ${this.escapeSql(ano.toString())}
          AND n.\`nombre\` NOT LIKE 'FINIQUITO - %'
        ORDER BY n.\`nombre\` ASC
      `;

      const nominas = await this.prisma.$queryRawUnsafe<any[]>(nominasQuery);
      
      this.logger.log(`📊 Encontradas ${nominas.length} nóminas para ${mes} ${ano}`);

      let processed = 0;
      let saved = 0;
      let updated = 0;
      let errors = 0;
      
      // Colectăm informații pentru angajații speciali (pentru rezumat la sfârșit)
      const empleadosEspecialesInfo: Array<{
        codigo: string;
        nombre: string;
        nombre_bd: string | null;
        irpf: number;
        neto: number;
        nomina: string;
      }> = [];

      const pdfParseModule = require('pdf-parse');
      const PDFParse = pdfParseModule.PDFParse;

      for (const nomina of nominas) {
        try {
          // Extragem textul din PDF
          const pdfBuffer = Buffer.from(nomina.archivo);
          const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
          const pageTextResult = await pdfInstance.getText();
          const textContent = (pageTextResult && typeof pageTextResult === 'object' && 'text' in pageTextResult) 
            ? pageTextResult.text 
            : (typeof pageTextResult === 'string' ? pageTextResult : '');

          // Detectăm dacă este finiquito
          const esFiniquito = this.detectarFiniquito(textContent) || nomina.nombre.startsWith('FINIQUITO - ');

          // Căutăm angajatul după nume
          const nombreEmpleado = nomina.nombre.replace(/^FINIQUITO - /, '').trim();
          const empleadoQuery = `
            SELECT \`CODIGO\`, \`NOMBRE / APELLIDOS\`
            FROM \`DatosEmpleados\`
            WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) = ${this.escapeSql(nombreEmpleado.toUpperCase().trim())}
            LIMIT 1
          `;
          
          const empleado = await this.prisma.$queryRawUnsafe<any[]>(empleadoQuery);
          
          if (empleado.length === 0) {
            this.logger.warn(`⚠️ Empleado no encontrado para nómina: ${nombreEmpleado}`);
            errors++;
            continue;
          }

          const codigo = empleado[0].CODIGO;
          const nombreCompleto = empleado[0]['NOMBRE / APELLIDOS'] || nombreEmpleado;
          
          // Extragem datele necesare (după ce am găsit numele și codigo pentru loguri speciale)
          const datos = this.extraerDatosNomina(textContent, nombreEmpleado, codigo);
          
          // Colectăm informații pentru angajații speciali
          const empleadosEspeciales = ['10000008', '10000004', '10000063'];
          if (empleadosEspeciales.includes(codigo)) {
            empleadosEspecialesInfo.push({
              codigo: codigo,
              nombre: nombreEmpleado,
              nombre_bd: nombreCompleto,
              irpf: datos.irpf,
              neto: datos.neto,
              nomina: nomina.nombre,
            });
          }

          // Dacă este finiquito, adăugăm " - FINIQUITO" la nume
          const nombreEmpleadoFinal = esFiniquito 
            ? `${nombreCompleto} - FINIQUITO`
            : nombreCompleto;

          // Salvăm sau actualizăm în coste_personal
          const result = await this.saveCostePersonal({
            codigo_empleado: codigo,
            nombre_empleado: nombreEmpleadoFinal,
            nombre_bd: nombreCompleto,
            empleado_encontrado: true,
            mes: mes.toUpperCase(),
            ano,
            total: datos.total,
            neto: datos.neto,
            aportaciones_trabajador: datos.aportaciones_trabajador,
            irpf: datos.irpf,
            enfermedad_devolucion: datos.enfermedad_devolucion,
            embargos: datos.embargos,
            anticipo: datos.anticipo,
            absentismo_laboral: datos.absentismo_laboral,
            seg_social_empresa: datos.seg_social_empresa,
          });

          if (result.action === 'created') {
            saved++;
          } else {
            updated++;
          }
          processed++;
        } catch (error: any) {
          this.logger.error(`❌ Error procesando nómina ${nomina.id}:`, error);
          errors++;
        }
      }

      this.logger.log(`✅ Coste Personal poblado: ${processed} procesadas, ${saved} creadas, ${updated} actualizadas, ${errors} errores`);
      
      // Rezumat pentru angajații speciali
      if (empleadosEspecialesInfo.length > 0) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`📋 REZUMAT ANGAJAȚI SPECIALI - IRPF EXTRACTION (POBLAR NÓMINAS)`);
        this.logger.log(`${'='.repeat(80)}`);
        for (const info of empleadosEspecialesInfo) {
          this.logger.log(`\n👤 Angajat: ${info.nombre} (${info.nombre_bd || 'N/A'})`);
          this.logger.log(`   📄 Codigo: ${info.codigo}`);
          this.logger.log(`   📁 Nómina: ${info.nomina}`);
          this.logger.log(`   💰 NETO extras: ${info.neto.toFixed(2)} €`);
          this.logger.log(`   💰 IRPF extras: ${info.irpf.toFixed(2)} €`);
        }
        this.logger.log(`\n${'='.repeat(80)}\n`);
      }
      
      // Adăugăm rândurile speciale: TOTAL, CON AURA, VACACIONES (pentru nóminas, VACACIONES = 0)
      await this.agregarFilasEspeciales(mes.toUpperCase(), ano, undefined);
      
      return { processed, saved, updated, errors };
    } catch (error: any) {
      this.logger.error(`❌ Error poblando Coste Personal desde nóminas:`, error);
      throw new BadRequestException(`Error al poblar datos: ${error.message}`);
    }
  }

  /**
   * Exportă datele Coste Personal în format Excel
   */
  async exportCostePersonalToExcel(mes: string, ano: number): Promise<Buffer> {
    try {
      // Obținem datele
      const data = await this.getCostePersonal(mes, ano);

      // Creăm workbook și worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Coste Personal ${mes} ${ano}`);

      // Definim coloanele
      worksheet.columns = [
        { header: 'Operario', key: 'nombre_empleado', width: 30 },
        { header: 'Código', key: 'codigo_empleado', width: 15 },
        { header: 'Estado', key: 'empleado_encontrado', width: 12 },
        { header: 'Total (Excel)', key: 'total', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'Total (Calculat)', key: 'total_calculado', width: 18, style: { numFmt: '#,##0.00' } },
        { header: 'Neto', key: 'neto', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'Aport. Trab.', key: 'aportaciones_trabajador', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'IRPF', key: 'irpf', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'Enf. Dev.', key: 'enfermedad_devolucion', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'Embargos', key: 'embargos', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'Anticipo', key: 'anticipo', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'Absentismo', key: 'absentismo_laboral', width: 15, style: { numFmt: '#,##0.00' } },
        { header: 'Seg. Social Emp.', key: 'seg_social_empresa', width: 18, style: { numFmt: '#,##0.00' } },
        { header: 'Total Aportaciones', key: 'total_aportaciones', width: 20, style: { numFmt: '#,##0.00' } },
      ];

      // Stilizăm header-ul
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Adăugăm datele
      data.forEach((row) => {
        worksheet.addRow({
          nombre_empleado: row.nombre_empleado,
          codigo_empleado: row.codigo_empleado || '',
          empleado_encontrado: row.empleado_encontrado ? 'Encontrado' : 'No encontrado',
          total: parseFloat(row.total?.toString() || '0'),
          total_calculado: parseFloat(row.total_calculado?.toString() || '0'),
          neto: parseFloat(row.neto?.toString() || '0'),
          aportaciones_trabajador: parseFloat(row.aportaciones_trabajador?.toString() || '0'),
          irpf: parseFloat(row.irpf?.toString() || '0'),
          enfermedad_devolucion: parseFloat(row.enfermedad_devolucion?.toString() || '0'),
          embargos: parseFloat(row.embargos?.toString() || '0'),
          anticipo: parseFloat(row.anticipo?.toString() || '0'),
          absentismo_laboral: parseFloat(row.absentismo_laboral?.toString() || '0'),
          seg_social_empresa: parseFloat(row.seg_social_empresa?.toString() || '0'),
          total_aportaciones: parseFloat(row.total_aportaciones?.toString() || '0'),
        });
      });

      // Generăm buffer-ul
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error: any) {
      this.logger.error(`❌ Error exportando Coste Personal a Excel:`, error);
      throw new BadRequestException(`Error al exportar: ${error.message}`);
    }
  }

  /**
   * Exportă datele Coste Personal în format PDF
   */
  async exportCostePersonalToPDF(mes: string, ano: number): Promise<Buffer> {
    try {
      // Obținem datele
      const data = await this.getCostePersonal(mes, ano);

      // Pentru PDF, folosim pdfkit
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {});

      // Titlu
      doc.fontSize(16).text(`Coste Personal - ${mes} ${ano}`, { align: 'center' });
      doc.moveDown();

      // Tabel
      const tableTop = doc.y;
      const rowHeight = 20;
      const colWidths = [80, 50, 40, 50, 50, 40, 40, 40, 40, 40, 40, 40, 50, 50];
      const headers = ['Operario', 'Código', 'Estado', 'Total (Excel)', 'Total (Calculat)', 'Neto', 'Aport. Trab.', 'IRPF', 'Enf. Dev.', 'Embargos', 'Anticipo', 'Absentismo', 'Seg. Social Emp.', 'Total Aportaciones'];
      
      // Header
      let x = 50;
      doc.fontSize(8).font('Helvetica-Bold');
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });
      
      // Linie sub header
      doc.moveTo(50, tableTop + rowHeight).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableTop + rowHeight).stroke();
      
      // Date
      doc.fontSize(7).font('Helvetica');
      let y = tableTop + rowHeight + 5;
      data.forEach((row, idx) => {
        if (y > 700) { // Nouă pagină dacă e necesar
          doc.addPage();
          y = 50;
        }
        
        x = 50;
        const rowData = [
          row.nombre_empleado || '',
          row.codigo_empleado || '',
          row.empleado_encontrado ? 'Encontrado' : 'No encontrado',
          parseFloat(row.total?.toString() || '0').toFixed(2),
          parseFloat(row.total_calculado?.toString() || '0').toFixed(2),
          parseFloat(row.neto?.toString() || '0').toFixed(2),
          parseFloat(row.aportaciones_trabajador?.toString() || '0').toFixed(2),
          parseFloat(row.irpf?.toString() || '0').toFixed(2),
          parseFloat(row.enfermedad_devolucion?.toString() || '0').toFixed(2),
          parseFloat(row.embargos?.toString() || '0').toFixed(2),
          parseFloat(row.anticipo?.toString() || '0').toFixed(2),
          parseFloat(row.absentismo_laboral?.toString() || '0').toFixed(2),
          parseFloat(row.seg_social_empresa?.toString() || '0').toFixed(2),
          parseFloat(row.total_aportaciones?.toString() || '0').toFixed(2),
        ];
        
        rowData.forEach((cell, i) => {
          doc.text(cell, x, y, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        
        y += rowHeight;
      });

      doc.end();

      // Așteptăm finalizarea
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);
      });
    } catch (error: any) {
      this.logger.error(`❌ Error exportando Coste Personal a PDF:`, error);
      throw new BadRequestException(`Error al exportar: ${error.message}`);
    }
  }
}

