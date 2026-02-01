import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FichajesService } from './fichajes.service';
import { HorasTrabajadasService } from './horas-trabajadas.service';
import { AusenciasService } from './ausencias.service';
import { EmpleadosService } from './empleados.service';
import { NominasService } from './nominas.service';
import { DocumentosOficialesService } from './documentos-oficiales.service';
import { DocumentosService } from './documentos.service';
import { InspeccionesService } from './inspecciones.service';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import { Readable } from 'stream';

@Injectable()
export class EmployeeExportService {
  private readonly logger = new Logger(EmployeeExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fichajesService: FichajesService,
    private readonly horasTrabajadasService: HorasTrabajadasService,
    private readonly ausenciasService: AusenciasService,
    private readonly empleadosService: EmpleadosService,
    private readonly nominasService: NominasService,
    private readonly documentosOficialesService: DocumentosOficialesService,
    private readonly documentosService: DocumentosService,
    private readonly inspeccionesService: InspeccionesService,
  ) {}

  /**
   * Generează PDF cu registrul orar lunar - VERSIUNE SIMPLĂ
   */
  async generateMonthlyRegistroPDF(
    codigo: string,
    mes: string,
    empleado: any,
  ): Promise<Buffer> {
    // Obține datele
    const resumenMensual = await this.horasTrabajadasService.getResumenMensual(
      mes,
      codigo,
    );
    if (!resumenMensual || resumenMensual.length === 0) {
      throw new Error(`No hay datos para el mes ${mes}`);
    }

    const detalle = resumenMensual[0];
    const registros = await this.fichajesService.getRegistros(codigo, mes);
    // const ausencias = await this.ausenciasService.getAusencias(codigo, mes); // TODO: Use in future if needed

    // Parsează luna
    const [ano, mesNum] = mes.split('-');
    const fechaMes = new Date(parseInt(ano), parseInt(mesNum) - 1, 1);
    const nombreMes = fechaMes.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });

    return new Promise((resolve, reject) => {
      try {
        // Creează PDF
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `Registro Horario - ${nombreMes}`,
            Author: 'De Camino Servicios',
            Subject: `Registro horario para ${codigo}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (error) => reject(error));

        // Header
        doc
          .fontSize(18)
          .font('Helvetica-Bold')
          .fillColor('#DC2626')
          .text('DE CAMINO SERVICIOS AUXILIARES S.L.', { align: 'center' });
        doc.moveDown(0.5);
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#1F2937')
          .text('REGISTRO HORARIO MENSUAL', { align: 'center' });
        doc.moveDown(0.3);
        // Mesaj sub titlu - bold, mai mic
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#666666')
          .text(
            'Registro horario orientativo generado a partir de los fichajes del trabajador; la empresa no se responsabiliza de discrepancias con la jornada real trabajada.',
            { align: 'center' },
          );
        doc.moveDown(1);

        // Informații angajat
        doc.fontSize(11).font('Helvetica').fillColor('#374151');
        const nombreEmpleado =
          empleado.NOMBRE_APELLIDOS ||
          `${empleado.NOMBRE || ''} ${empleado.APELLIDO1 || ''} ${empleado.APELLIDO2 || ''}`.trim() ||
          'Unknown';
        doc.text(`Empleado: ${nombreEmpleado}`);
        doc.text(`Código: ${codigo}`);
        doc.text(`Período: ${nombreMes}`);
        doc.moveDown(0.5);

        // Rezumat
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#1F2937')
          .text('Resumen:');
        doc.font('Helvetica').fontSize(9);
        const horasTrabajadas = Number(detalle.horas_trabajadas_mes) || 0;
        const horasMes = Number(detalle.horas_mes) || 0;
        doc.text(`  • Horas trabajadas: ${horasTrabajadas.toFixed(2)}h`);
        doc.text(`  • Horas plan: ${horasMes.toFixed(2)}h`);
        doc.moveDown(1);

        // Tabel registros - simplu, fără page breaks complicate
        const startY = doc.y;
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#FFFFFF')
          .rect(50, startY, 495, 20)
          .fill('#DC2626');
        doc.text('Fecha', 55, startY + 6);
        doc.text('Tipo', 120, startY + 6);
        doc.text('Hora', 180, startY + 6);
        doc.text('Duración', 250, startY + 6);
        doc.text('Duración Reg.', 350, startY + 6);

        let currentY = startY + 25;

        // Organizează registros
        const registrosPorDia = new Map<string, any[]>();
        for (const registro of registros) {
          const fecha =
            registro.FECHA instanceof Date
              ? registro.FECHA.toISOString().split('T')[0]
              : registro.FECHA;
          if (!registrosPorDia.has(fecha)) {
            registrosPorDia.set(fecha, []);
          }
          registrosPorDia.get(fecha)!.push(registro);
        }

        const fechasOrdenadas = Array.from(registrosPorDia.keys()).sort();

        for (const fecha of fechasOrdenadas) {
          const registrosDia = registrosPorDia.get(fecha)!;
          const fechaObj = new Date(fecha);
          const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
          });

          for (const registro of registrosDia) {
            // Verifică spațiu pentru pagină nouă - lasă 50px pentru footer
            if (currentY > 780) {
              // NU adăugăm footer aici - îl adăugăm la final pe toate paginile
              doc.addPage();
              currentY = 50;
            }

            doc.fontSize(8).font('Helvetica').fillColor('#1F2937');

            // Fecha (doar o dată per zi)
            if (registrosDia.indexOf(registro) === 0) {
              doc.text(fechaFormateada, 55, currentY);
            }

            doc.text(registro.TIPO || 'N/A', 120, currentY);
            const hora = registro.HORA ? registro.HORA.substring(0, 5) : 'N/A';
            doc.text(hora, 180, currentY);

            // Duración originală
            let duracion = registro.DURACION || '00:00:00';
            if (duracion && duracion !== '00:00:00') {
              const parts = duracion.split(':');
              const horas = parseInt(parts[0]) || 0;
              const minutos = parseInt(parts[1]) || 0;
              duracion = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
            } else {
              duracion = '-';
            }
            doc.text(duracion, 250, currentY);

            // Duración regularizată (dacă există)
            let duracionReg = registro.effective_duration || null;

            if (duracionReg && duracionReg !== '00:00:00') {
              const parts = duracionReg.split(':');
              const horas = parseInt(parts[0]) || 0;
              const minutos = parseInt(parts[1]) || 0;
              duracionReg = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;

              // Verifică dacă e diferită de originală pentru a o face verde
              const duracionOriginal = registro.DURACION || '00:00:00';
              if (duracionReg !== duracion && duracionOriginal !== '00:00:00') {
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#059669'); // Verde pentru regularizat
              } else {
                doc.fontSize(8).font('Helvetica').fillColor('#1F2937');
              }
              doc.text(duracionReg, 350, currentY);
            } else {
              doc.fontSize(8).font('Helvetica').fillColor('#1F2937');
              doc.text('-', 350, currentY);
            }

            currentY += 15;
          }
        }

        // Total - folosim valoarea din resumen (care include regularizările)
        currentY += 10;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#1F2937')
          .text(
            `Total horas trabajadas: ${horasTrabajadas.toFixed(2)} horas`,
            50,
            currentY,
            {
              width: 495,
              align: 'right',
            },
          );

        // FĂRĂ FOOTER - eliminat complet
        doc.end();
      } catch (error: any) {
        this.logger.error(`❌ Error: ${error.message}`, error.stack);
        reject(error);
      }
    });
  }

  /**
   * Exportă documentele unui angajat într-un ZIP
   */
  async exportEmployeeDocuments(
    codigo: string,
  ): Promise<{ stream: Readable; filename: string }> {
    this.logger.log(`📦 Starting export for employee: ${codigo}`);

    // Găsește angajatul folosind service-ul
    const empleado = await this.empleadosService.getEmpleadoByCodigo(codigo);

    if (!empleado) {
      throw new NotFoundException(`Empleado ${codigo} not found`);
    }

    const nombreEmpleado =
      empleado.NOMBRE_APELLIDOS || empleado['NOMBRE / APELLIDOS'] || codigo;
    const nombreSafe = nombreEmpleado
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_');

    // Creează ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    const filename = `${nombreSafe}_${codigo}_${new Date().toISOString().split('T')[0]}.zip`;

    try {
      // 1. DocumentosOficiales
      const documentosOficiales =
        await this.documentosOficialesService.getDocumentosOficiales(codigo);
      this.logger.log(
        `📄 Found ${documentosOficiales.length} DocumentosOficiales`,
      );

      for (const doc of documentosOficiales) {
        try {
          const { archivo, nombre_archivo } =
            await this.documentosOficialesService.downloadDocumentoOficial(
              doc.doc_id,
              codigo,
            );
          const año = doc.fecha_creacion
            ? new Date(doc.fecha_creacion).getFullYear()
            : 'SinFecha';
          archive.append(archivo, {
            name: `DocumentosOficiales/${año}/${nombre_archivo}`,
          });
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error downloading DocumentoOficial ${doc.doc_id}: ${error.message}`,
          );
        }
      }

      // 2. Nominas
      const nominas = await this.nominasService.getNominas(undefined, codigo);
      this.logger.log(`💰 Found ${nominas.length} Nominas`);

      for (const nomina of nominas) {
        try {
          const nominaNombre = nomina.nombre_empleado || nombreEmpleado;
          if (!nominaNombre) {
            this.logger.warn(
              `⚠️ Skipping nomina ${nomina.id}: no nombre_empleado`,
            );
            continue;
          }
          const { archivo, nombre_archivo } =
            await this.nominasService.downloadNomina(nomina.id, nominaNombre);
          const año = nomina.ano || 'SinFecha';
          const mes = nomina.mes || 'SinMes';
          archive.append(archivo, {
            name: `Nominas/${año}/${mes}_${nombre_archivo}`,
          });
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error downloading Nomina ${nomina.id}: ${error.message}`,
          );
        }
      }

      // 3. CarpetasDocumentos (Otros)
      const carpetasDocs = await this.documentosService.getDocumentos(codigo);
      this.logger.log(`📁 Found ${carpetasDocs.length} CarpetasDocumentos`);

      for (const doc of carpetasDocs) {
        try {
          const { archivo, nombre_archivo } =
            await this.documentosService.downloadDocumento(doc.doc_id, codigo);
          const año = doc.fecha_creacion
            ? new Date(doc.fecha_creacion).getFullYear()
            : 'SinFecha';
          archive.append(archivo, {
            name: `CarpetasDocumentos/${año}/${nombre_archivo}`,
          });
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error downloading CarpetasDocumento ${doc.doc_id}: ${error.message}`,
          );
        }
      }

      // 4. Registros Horarios (PDF-uri generate)
      const meses = await this.fichajesService.getMonthsWithFichajes(codigo);
      this.logger.log(`📅 Found ${meses.length} months with fichajes`);

      for (const mes of meses) {
        try {
          const pdfBuffer = await this.generateMonthlyRegistroPDF(
            codigo,
            mes,
            empleado,
          );
          const [ano, mesNum] = mes.split('-');
          const nombreMes = new Date(
            parseInt(ano),
            parseInt(mesNum) - 1,
            1,
          ).toLocaleDateString('es-ES', {
            month: 'long',
            year: 'numeric',
          });
          archive.append(pdfBuffer, {
            name: `Registros_Horarios/${mes}_${nombreMes.replace(/\s+/g, '_')}.pdf`,
          });
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error generating PDF for ${mes}: ${error.message}`,
          );
        }
      }

      // 5. Inspecciones (organizate pe tip de inspecție)
      const inspecciones =
        await this.inspeccionesService.getMisInspecciones(codigo);
      this.logger.log(`🔍 Found ${inspecciones.length} Inspecciones`);

      for (const inspeccion of inspecciones) {
        try {
          const { archivo, nombre_archivo } =
            await this.inspeccionesService.downloadInspeccion(inspeccion.id);
          // Organizăm pe tip de inspecție
          const tipoInspeccion =
            inspeccion.tipo_inspeccion &&
            inspeccion.tipo_inspeccion.trim() !== ''
              ? inspeccion.tipo_inspeccion
                  .trim()
                  .replace(/[^a-zA-Z0-9\s]/g, '')
                  .replace(/\s+/g, '_')
              : 'SinTipo';
          archive.append(archivo, {
            name: `Inspecciones/${tipoInspeccion}/${nombre_archivo}`,
          });
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error downloading Inspeccion ${inspeccion.id}: ${error.message}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error adding documents to ZIP: ${error.message}`,
        error.stack,
      );
      throw error;
    }

    archive.finalize();

    this.logger.log(`✅ Export completed for employee: ${codigo}`);
    return { stream: archive, filename };
  }

  /**
   * Exportă documentele pentru toți angajații
   */
  async exportAllEmployeesDocuments(): Promise<{
    stream: Readable;
    filename: string;
  }> {
    this.logger.log(`📦 Starting export for all employees`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const filename = `todos_empleados_${new Date().toISOString().split('T')[0]}.zip`;

    // TODO: Adaugă toate documentele în ZIP

    archive.finalize();

    this.logger.log(`✅ Export completed for all employees`);
    return { stream: archive, filename };
  }
}
