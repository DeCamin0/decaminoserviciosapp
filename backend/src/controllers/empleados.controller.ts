import {
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  Logger,
  Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadosService } from '../services/empleados.service';
import { EmailService } from '../services/email.service';
import { EmpleadosStatsService } from '../services/empleados-stats.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { NotificationsService } from '../services/notifications.service';
import { SentEmailsService } from '../services/sent-emails.service';

@Controller('api/empleados')
export class EmpleadosController {
  private readonly logger = new Logger(EmpleadosController.name);

  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly emailService: EmailService,
    private readonly empleadosStatsService: EmpleadosStatsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly sentEmailsService: SentEmailsService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    const codigo = user?.userId;
    const empleado = await this.empleadosService.getEmpleadoByCodigo(codigo);
    return { success: true, empleado };
  }

  @Get('cambios-pendientes')
  @UseGuards(JwtAuthGuard)
  async getCambiosPendientes() {
    try {
      this.logger.log('📋 Get cambios pendientes request');
      const cambios = await this.empleadosService.getCambiosPendientes();
      return cambios;
    } catch (error: any) {
      this.logger.error('❌ Error getting cambios pendientes:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener cambios pendientes: ${error.message}`,
      );
    }
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getEmpleadosStats() {
    try {
      this.logger.log('📊 Get empleados stats request');
      const stats = await this.empleadosStatsService.getEmpleadosStats();
      return stats;
    } catch (error: any) {
      this.logger.error('❌ Error getting empleados stats:', error);
      throw new BadRequestException(
        `Error al obtener estadísticas: ${error.message}`,
      );
    }
  }

  @Get('estadisticas')
  @UseGuards(JwtAuthGuard)
  async getEstadisticasEmpleados() {
    try {
      this.logger.log('📊 Get estadísticas empleados request');
      // Nu trebuie să verificăm RBAC aici - doar managerii pot accesa tab-ul în frontend
      const estadisticas =
        await this.empleadosService.getEstadisticasEmpleados();
      return { success: true, estadisticas };
    } catch (error: any) {
      this.logger.error('❌ Error getting estadísticas empleados:', error);
      throw new BadRequestException(
        `Error al obtener estadísticas: ${error.message}`,
      );
    }
  }

  @Get('estadisticas/export-excel')
  @UseGuards(JwtAuthGuard)
  async exportEstadisticasExcel(@Res() res: any) {
    try {
      this.logger.log('📊 Export estadísticas empleados Excel request');
      const buffer =
        await this.empleadosService.exportEstadisticasEmpleadosExcel();

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=Estadisticas_Empleados_${new Date().toISOString().split('T')[0]}.xlsx`,
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error: any) {
      this.logger.error('❌ Error exporting estadísticas Excel:', error);
      throw new BadRequestException(
        `Error al exportar Excel: ${error.message}`,
      );
    }
  }

  @Get('estadisticas/export-pdf')
  @UseGuards(JwtAuthGuard)
  async exportEstadisticasPDF(@Res() res: any) {
    try {
      this.logger.log('📊 Export estadísticas empleados PDF request');
      const buffer =
        await this.empleadosService.exportEstadisticasEmpleadosPDF();

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Estadisticas_Empleados_${new Date().toISOString().split('T')[0]}.pdf`,
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error: any) {
      this.logger.error('❌ Error exporting estadísticas PDF:', error);
      throw new BadRequestException(`Error al exportar PDF: ${error.message}`);
    }
  }

  @Get()
  async getAll() {
    const empleados = await this.empleadosService.getAllEmpleados();
    return empleados;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'pdf', maxCount: 1 },
      { name: 'archivosGestoria', maxCount: 10 },
    ]),
  )
  async addEmpleado(
    @UploadedFiles()
    files: {
      pdf?: Express.Multer.File[];
      archivosGestoria?: Express.Multer.File[];
    },
    @Body() body: any,
  ) {
    const pdfFile = files?.pdf?.[0];
    const archivosGestoria = files?.archivosGestoria || [];
    try {
      // Extragem datele din body
      const empleadoData = {
        CODIGO: body.CODIGO,
        'NOMBRE / APELLIDOS': body['NOMBRE / APELLIDOS'] || '',
        NOMBRE: body.NOMBRE || null,
        APELLIDO1: body.APELLIDO1 || null,
        APELLIDO2: body.APELLIDO2 || null,
        NOMBRE_SPLIT_CONFIANZA:
          body.NOMBRE_SPLIT_CONFIANZA !== undefined
            ? parseInt(body.NOMBRE_SPLIT_CONFIANZA)
            : body.NOMBRE || body.APELLIDO1 || body.APELLIDO2
              ? 2
              : 0,
        NACIONALIDAD: body.NACIONALIDAD || '',
        DIRECCION: body.DIRECCION || '',
        'D.N.I. / NIE': body['D.N.I. / NIE'] || '',
        'SEG. SOCIAL': body['SEG. SOCIAL'] || '',
        'Nº Cuenta': body['Nº Cuenta'] || '',
        TELEFONO: body.TELEFONO || '',
        'CORREO ELECTRONICO': body['CORREO ELECTRONICO'] || '',
        'FECHA NACIMIENTO': body['FECHA NACIMIENTO'] || '',
        'FECHA DE ALTA': body['FECHA DE ALTA'] || '',
        'FECHA BAJA': body['FECHA DE BAJA'] || body['FECHA BAJA'] || null,
        'Fecha Antigüedad': body['Fecha Antigüedad'] || null,
        Antigüedad: body.Antigüedad || null,
        'CENTRO TRABAJO': body['CENTRO TRABAJO'] || '',
        'TIPO DE CONTRATO': body['TIPO DE CONTRATO'] || '',
        'SUELDO BRUTO MENSUAL': body['SUELDO BRUTO MENSUAL'] || '',
        'HORAS DE CONTRATO': body['HORAS DE CONTRATO'] || '',
        EMPRESA: body.EMPRESA || '',
        GRUPO: body.GRUPO || '',
        ESTADO: body.ESTADO || 'PENDIENTE',
        DerechoPedidos: body.DerechoPedidos || 'NO',
        TrabajaFestivos: body.TrabajaFestivos || 'NO',
      };

      if (!empleadoData.CODIGO) {
        throw new BadRequestException('CODIGO is required');
      }

      // Adăugăm empleado în baza de date
      const result = await this.empleadosService.addEmpleado(empleadoData);

      // Trimite email de bun venit dacă este un angajat nou cu FECHA DE ALTA setată
      // (indiferent de ESTADO, pentru că poate fi PENDIENTE la început)
      if (
        empleadoData['FECHA DE ALTA'] &&
        empleadoData['FECHA DE ALTA'].trim() !== '' &&
        empleadoData['CORREO ELECTRONICO'] &&
        empleadoData['CORREO ELECTRONICO'].trim() !== ''
      ) {
        try {
          await this.sendWelcomeEmailToEmpleado(empleadoData);
        } catch (welcomeEmailError: any) {
          this.logger.warn(
            `⚠️ Eroare la trimiterea email-ului de bun venit către ${empleadoData.CODIGO}: ${welcomeEmailError.message}`,
          );
          // Nu oprește procesul dacă email-ul de bun venit eșuează
        }
      }

      // Salvăm PDF-ul în CarpetasDocumentos dacă există
      if (pdfFile && pdfFile.buffer) {
        const nombreEmpleado =
          this.empleadosService.getFormattedNombre(empleadoData) || '';
        // Luăm email-ul din empleadoData sau din body (pentru a fi siguri)
        const correoElectronico =
          empleadoData['CORREO ELECTRONICO'] ||
          body['CORREO ELECTRONICO'] ||
          '';
        const nombreArchivo =
          pdfFile.originalname || `Ficha_${empleadoData.CODIGO}.pdf`;
        const tipoDocumento = body.tipo || 'ficha_empleado';

        this.logger.log(
          `📄 Salvăm PDF pentru empleado ${empleadoData.CODIGO}, email: ${correoElectronico || '(gol)'}`,
        );

        await this.empleadosService.savePDFToCarpetasDocumentos(
          empleadoData.CODIGO,
          nombreEmpleado,
          correoElectronico,
          pdfFile.buffer,
          nombreArchivo,
          tipoDocumento,
        );
      }

      // Trimitem email dacă există PDF
      if (pdfFile && pdfFile.buffer) {
        if (!this.emailService.isConfigured()) {
          this.logger.warn(
            '⚠️ SMTP nu este configurat. Email-ul nu va fi trimis.',
          );
        } else {
          try {
            const nombreEmpleado =
              this.empleadosService.getFormattedNombre(empleadoData) ||
              'Sin Nombre';
            const subject = `ALTA OPERARIA/O: ${nombreEmpleado}`;
            const html = `
              <html>
                <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                  <p>Hola,</p>
                  <p>Te anexo los datos correspondientes a <strong>${nombreEmpleado}</strong>.</p>
                  <br>
                  <p>Un saludo,<br>
                  <em>Feliz día 🌞</em></p>
                </body>
              </html>
            `;

            const pdfFileName =
              pdfFile.originalname ||
              `Ficha_${nombreEmpleado.replace(/\s+/g, '_')}.pdf`;

            // Verificăm dacă checkbox-ul "Enviar a Gestoria" este bifat
            const enviarAGestoria =
              body.enviarAGestoria === 'true' ||
              body.enviarAGestoria === true ||
              body.enviarAGestoria === '1';

            // Mesaj adițional pentru gestorie
            const mensajeAdicional = body.mensajeAdicionalGestoria || '';

            // Pregătește attachments: PDF + fișierele adiționale
            const attachments = [
              {
                filename: pdfFileName,
                content: pdfFile.buffer,
                contentType: 'application/pdf',
              },
            ];

            // Adaugă fișierele adiționale dacă există
            if (archivosGestoria.length > 0) {
              archivosGestoria.forEach((file) => {
                attachments.push({
                  filename: file.originalname || 'attachment',
                  content: file.buffer,
                  contentType: file.mimetype || 'application/octet-stream',
                });
              });
            }

            // Adaugă mesajul adițional în HTML dacă există
            let htmlFinal = html;
            if (mensajeAdicional && mensajeAdicional.trim() !== '') {
              htmlFinal = html.replace(
                '</body>',
                `<div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #007bff;">
                  <strong>Mensaje adicional:</strong><br>
                  <div style="white-space: pre-wrap;">${mensajeAdicional.replace(/\n/g, '<br>')}</div>
                </div>
                </body>`,
              );
            }

            if (enviarAGestoria) {
              // Dacă este bifat: trimite la gestoria (altemprado@gmail.com) cu BCC
              if (attachments.length > 1) {
                // Folosește sendEmailWithAttachments pentru multiple attachments
                await this.emailService.sendEmailWithAttachments(
                  'altemprado@gmail.com',
                  subject,
                  htmlFinal,
                  attachments,
                  {
                    bcc: [
                      'info@decaminoservicios.com',
                      'mirisjm@gmail.com',
                      'decamino.rrhh@gmail.com',
                    ],
                  },
                );
              } else {
                // Folosește sendEmailWithAttachment pentru un singur attachment (PDF)
                await this.emailService.sendEmailWithAttachment(
                  'altemprado@gmail.com',
                  subject,
                  htmlFinal,
                  pdfFile.buffer,
                  pdfFileName,
                  {
                    bcc: [
                      'info@decaminoservicios.com',
                      'mirisjm@gmail.com',
                      'decamino.rrhh@gmail.com',
                    ],
                  },
                );
              }

              this.logger.log(
                `✅ Email trimis către gestoria (altemprado@gmail.com) pentru empleado ${empleadoData.CODIGO} cu ${attachments.length} attachments`,
              );

              // Salvează email-ul în BD
              try {
                const senderId = String(
                  body.createdBy ? JSON.parse(body.createdBy).nombre : 'system',
                );
                await this.sentEmailsService.saveSentEmail({
                  senderId,
                  recipientType: 'gestoria',
                  recipientEmail: 'altemprado@gmail.com',
                  recipientName: 'Gestoria',
                  subject,
                  message: htmlFinal,
                  additionalMessage: mensajeAdicional || undefined,
                  status: 'sent',
                  attachments: attachments.map((att) => ({
                    filename: att.filename,
                    fileContent: att.content,
                    mimeType: att.contentType,
                    fileSize: att.content.length,
                  })),
                });
              } catch (saveError: any) {
                this.logger.warn(
                  `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
                );
              }
            } else {
              // Dacă NU este bifat: trimite DOAR la info@decaminoservicios.com
              if (attachments.length > 1) {
                // Folosește sendEmailWithAttachments pentru multiple attachments
                await this.emailService.sendEmailWithAttachments(
                  'info@decaminoservicios.com',
                  subject,
                  htmlFinal,
                  attachments,
                  {
                    bcc: ['decamino.rrhh@gmail.com'],
                  },
                );
              } else {
                // Folosește sendEmailWithAttachment pentru un singur attachment (PDF)
                await this.emailService.sendEmailWithAttachment(
                  'info@decaminoservicios.com',
                  subject,
                  htmlFinal,
                  pdfFile.buffer,
                  pdfFileName,
                  {
                    bcc: ['decamino.rrhh@gmail.com'],
                  },
                );
              }

              this.logger.log(
                `✅ Email trimis către info@decaminoservicios.com pentru empleado ${empleadoData.CODIGO} cu ${attachments.length} attachments`,
              );

              // Salvează email-ul în BD
              try {
                const senderId = String(
                  body.createdBy ? JSON.parse(body.createdBy).nombre : 'system',
                );
                await this.sentEmailsService.saveSentEmail({
                  senderId,
                  recipientType: 'gestoria',
                  recipientEmail: 'info@decaminoservicios.com',
                  recipientName: 'Info',
                  subject,
                  message: htmlFinal,
                  additionalMessage: mensajeAdicional || undefined,
                  status: 'sent',
                  attachments: attachments.map((att) => ({
                    filename: att.filename,
                    fileContent: att.content,
                    mimeType: att.contentType,
                    fileSize: att.content.length,
                  })),
                });
              } catch (saveError: any) {
                this.logger.warn(
                  `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
                );
              }
            }
          } catch (emailError: any) {
            this.logger.error(
              `❌ Eroare la trimiterea email-ului: ${emailError.message}`,
            );
            // Nu aruncăm eroare aici, pentru că empleado-ul a fost adăugat cu succes
            // Doar logăm eroarea
          }
        }
      }

      return {
        success: true,
        message: 'Empleado añadido correctamente',
        codigo: result.codigo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error adding empleado:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al añadir empleado: ${error.message}`,
      );
    }
  }

  @Post('retrimite-ficha')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'pdf', maxCount: 1 },
      { name: 'archivosGestoria', maxCount: 10 },
    ]),
  )
  async retrimiteFicha(
    @UploadedFiles()
    files: {
      pdf?: Express.Multer.File[];
      archivosGestoria?: Express.Multer.File[];
    },
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    try {
      const pdfFile = files?.pdf?.[0];
      const archivosGestoria = files?.archivosGestoria || [];

      if (!pdfFile || !pdfFile.buffer) {
        throw new BadRequestException('PDF-ul este obligatoriu');
      }

      if (!body.CODIGO) {
        throw new BadRequestException('CODIGO este obligatoriu');
      }

      // Verifică dacă angajatul există
      const empleadoExistente = await this.empleadosService.getEmpleadoByCodigo(
        body.CODIGO,
      );
      if (!empleadoExistente) {
        throw new BadRequestException(
          `Angajatul cu CODIGO ${body.CODIGO} nu există`,
        );
      }

      // Nu modificăm angajatul în BD, doar trimitem ficha la gestorie
      // Get employee data to use formatted nombre
      const empleadoForNombre = await this.empleadosService.getEmpleadoByCodigo(
        body.CODIGO,
      );
      const nombreEmpleado =
        this.empleadosService.getFormattedNombre(empleadoForNombre) ||
        body['NOMBRE / APELLIDOS'] ||
        'Sin Nombre';
      const subject = `RE-ENVÍO FICHA: ${nombreEmpleado}`;

      let html = `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <p>Hola,</p>
            <p>Te reenvío los datos correspondientes a <strong>${nombreEmpleado}</strong> (Código: ${body.CODIGO}).</p>
      `;

      // Adaugă mesajul adițional dacă există
      const mensajeAdicional = body.mensajeAdicionalGestoria || '';
      if (mensajeAdicional) {
        html += `
            <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #007bff;">
              <strong>Mensaje adicional:</strong><br>
              <div style="white-space: pre-wrap;">${mensajeAdicional.replace(/\n/g, '<br>')}</div>
            </div>
        `;
      }

      html += `
            <br>
            <p>Un saludo,<br>
            <em>Feliz día 🌞</em></p>
          </body>
        </html>
      `;

      const pdfFileName =
        pdfFile.originalname ||
        `Ficha_${nombreEmpleado.replace(/\s+/g, '_')}.pdf`;

      // Pregătește attachments: PDF + fișierele adiționale
      const attachments = [
        {
          filename: pdfFileName,
          content: pdfFile.buffer,
          contentType: 'application/pdf',
        },
      ];

      // Adaugă fișierele adiționale dacă există
      if (archivosGestoria.length > 0) {
        archivosGestoria.forEach((file) => {
          attachments.push({
            filename: file.originalname || 'attachment',
            content: file.buffer,
            contentType: file.mimetype || 'application/octet-stream',
          });
        });
      }

      // Trimite la gestoria
      if (attachments.length > 1) {
        await this.emailService.sendEmailWithAttachments(
          'altemprado@gmail.com',
          subject,
          html,
          attachments,
          {
            bcc: [
              'info@decaminoservicios.com',
              'mirisjm@gmail.com',
              'decamino.rrhh@gmail.com',
            ],
          },
        );
      } else {
        await this.emailService.sendEmailWithAttachment(
          'altemprado@gmail.com',
          subject,
          html,
          pdfFile.buffer,
          pdfFileName,
          {
            bcc: [
              'info@decaminoservicios.com',
              'mirisjm@gmail.com',
              'decamino.rrhh@gmail.com',
            ],
          },
        );
      }

      this.logger.log(
        `✅ Ficha retrimisă către gestoria pentru empleado ${body.CODIGO} cu ${attachments.length} attachments`,
      );

      // Salvează email-ul în BD
      try {
        const senderId = String(
          user?.CODIGO || user?.codigo || user?.userId || 'system',
        );
        await this.sentEmailsService.saveSentEmail({
          senderId,
          recipientType: 'gestoria',
          recipientEmail: 'altemprado@gmail.com',
          recipientName: 'Gestoria',
          subject,
          message: html,
          additionalMessage: mensajeAdicional || undefined,
          status: 'sent',
          attachments: attachments.map((att) => ({
            filename: att.filename,
            fileContent: att.content,
            mimeType: att.contentType,
            fileSize: att.content.length,
          })),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }

      return {
        success: true,
        message: 'Ficha retrimisă cu succes către gestoria',
        codigo: body.CODIGO,
      };
    } catch (error: any) {
      this.logger.error('❌ Error retrimitere ficha:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al retrimitere ficha: ${error.message}`,
      );
    }
  }

  /**
   * Trimite email de bun venit către angajat când se dă de alta sau se reactivează
   */
  private async sendWelcomeEmailToEmpleado(empleadoData: any) {
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        '⚠️ SMTP nu este configurat. Email-ul de bun venit nu va fi trimis.',
      );
      return;
    }

    const email =
      empleadoData['CORREO ELECTRONICO'] || empleadoData.CORREO_ELECTRONICO;
    const nombre =
      this.empleadosService.getFormattedNombre(empleadoData) || 'Empleado';
    const fechaAlta =
      empleadoData['FECHA DE ALTA'] || empleadoData.FECHA_DE_ALTA || '';

    if (!email || !email.trim()) {
      this.logger.warn(
        `⚠️ Angajatul ${empleadoData.CODIGO} nu are email configurat pentru email de bun venit`,
      );
      return;
    }

    if (!fechaAlta || !fechaAlta.trim()) {
      this.logger.warn(
        `⚠️ Angajatul ${empleadoData.CODIGO} nu are FECHA DE ALTA pentru email de bun venit`,
      );
      return;
    }

    // Verifică dacă suntem după 1 ianuarie al anului curent
    const fechaLimite = new Date(new Date().getFullYear(), 0, 1); // 1 ianuarie an curent
    const fechaActual = new Date();
    const esDespuesDeEnero = fechaActual >= fechaLimite;

    const subject = 'Bienvenido/a a De Camino - Acceso a la aplicación interna';

    // Formatează data de alta pentru mesaj
    let fechaAltaFormateada = fechaAlta;
    try {
      // Încearcă să formateze data (dd/mm/yyyy sau dd-mm-yyyy)
      if (fechaAlta.includes('/')) {
        const [dd, mm, yyyy] = fechaAlta.split('/');
        fechaAltaFormateada = `${dd}/${mm}/${yyyy}`;
      } else if (fechaAlta.includes('-')) {
        const [dd, mm, yyyy] = fechaAlta.split('-');
        fechaAltaFormateada = `${dd}/${mm}/${yyyy}`;
      }
    } catch {
      // Folosește data originală dacă formatarea eșuează
    }

    // Mesaj diferit în funcție de data curentă
    let html = '';

    if (esDespuesDeEnero) {
      // Email pentru după 1 ianuarie (aplicația este obligatorie)
      html = `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p>Hola <strong>${nombre}</strong>,</p>
            
            <p>A partir del <strong>${fechaAltaFormateada}</strong>, deberás utilizar la aplicación interna De Camino para todas las gestiones laborales.</p>
            
            <p><strong>El uso de la aplicación es obligatorio</strong> y sustituye completamente el uso de documentos en papel.</p>
            
            <p>La aplicación De Camino es la aplicación oficial de la empresa y se utiliza para:</p>
            
            <ul style="margin: 15px 0; padding-left: 25px;">
              <li>fichaje y registro de horas trabajadas</li>
              <li>consulta de horarios y cuadrantes</li>
              <li>solicitud de vacaciones, días libres y asunto propio</li>
              <li>acceso a documentación e información interna</li>
            </ul>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>🔐 Datos de acceso</strong></p>
              <p style="margin: 5px 0;"><strong>Usuario:</strong> el correo electrónico facilitado por la empresa</p>
              <p style="margin: 5px 0;">La contraseña deberá solicitarse por WhatsApp a un responsable autorizado de la empresa.</p>
            </div>
            
            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>📲 Cómo instalar la aplicación</strong></p>
              <p style="margin: 5px 0;">La aplicación no se descarga desde Google Play ni App Store.</p>
              <p style="margin: 5px 0;">Se utiliza directamente desde el navegador del móvil.</p>
              <ol style="margin: 10px 0; padding-left: 25px;">
                <li>Abre el navegador de tu teléfono (Chrome en Android o Safari en iPhone)</li>
                <li>Accede al siguiente enlace:</li>
              </ol>
              <p style="margin: 10px 0; text-align: center;">
                <a href="https://app.decaminoservicios.com" style="color: #0066CC; font-weight: bold; font-size: 16px;">👉 https://app.decaminoservicios.com</a>
              </p>
              <ol start="3" style="margin: 10px 0; padding-left: 25px;">
                <li>Introduce tu usuario y la contraseña facilitada por la empresa</li>
                <li>Sigue las instrucciones para añadir la aplicación a la pantalla de inicio</li>
                <li>Confirma la opción para disponer de la aplicación como un icono en tu móvil</li>
              </ol>
            </div>
            
            <p>Si tienes cualquier problema técnico o duda sobre el uso de la aplicación, puedes contactar con nosotros</p>
            
            <p>Gracias por tu colaboración.</p>
            
            <p><strong>Atentamente:</strong><br>
            <strong>RRHH</strong><br>
            <strong>DE CAMINO SERVICIOS AUXILIARES SL</strong></p>
          </body>
        </html>
      `;
    } else {
      // Email pentru înainte de 1 ianuarie (aplicația va fi disponibilă)
      html = `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p>Hola <strong>${nombre}</strong>,</p>
            
            <p>A partir del <strong>${fechaAltaFormateada}</strong>, la aplicación interna De Camino estará disponible para que puedas empezar a utilizarla.</p>
            
            <p>A partir del <strong>1 de enero</strong>, el uso de la aplicación será obligatorio y sustituirá completamente el uso de documentos en papel.</p>
            
            <p>La aplicación De Camino es la aplicación oficial de la empresa y se utilizará para:</p>
            
            <ul style="margin: 15px 0; padding-left: 25px;">
              <li>fichaje y registro de horas trabajadas</li>
              <li>consulta de horarios y cuadrantes</li>
              <li>solicitud de vacaciones, días libres y asunto propio</li>
              <li>acceso a documentación e información interna</li>
            </ul>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>🔐 Datos de acceso</strong></p>
              <p style="margin: 5px 0;"><strong>Usuario:</strong> el correo electrónico facilitado por la empresa</p>
              <p style="margin: 5px 0;">La contraseña deberá solicitarse por WhatsApp a un responsable autorizado de la empresa.</p>
            </div>
            
            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>📲 Cómo instalar la aplicación</strong></p>
              <p style="margin: 5px 0;">La aplicación no se descarga desde Google Play ni App Store.</p>
              <p style="margin: 5px 0;">Se utiliza directamente desde el navegador del móvil.</p>
              <ol style="margin: 10px 0; padding-left: 25px;">
                <li>Abre el navegador de tu teléfono (Chrome en Android o Safari en iPhone)</li>
                <li>Accede al siguiente enlace:</li>
              </ol>
              <p style="margin: 10px 0; text-align: center;">
                <a href="https://app.decaminoservicios.com" style="color: #0066CC; font-weight: bold; font-size: 16px;">👉 https://app.decaminoservicios.com</a>
              </p>
              <ol start="3" style="margin: 10px 0; padding-left: 25px;">
                <li>Introduce tu usuario y la contraseña facilitada por la empresa</li>
                <li>Sigue las instrucciones para añadir la aplicación a la pantalla de inicio</li>
                <li>Confirma la opción para disponer de la aplicación como un icono en tu móvil</li>
              </ol>
            </div>
            
            <p>Si tienes cualquier problema técnico o duda sobre el uso de la aplicación, puedes contactar con nosotros</p>
            
            <p>Gracias por tu colaboración.</p>
            
            <p><strong>Atentamente:</strong><br>
            <strong>RRHH</strong><br>
            <strong>DE CAMINO SERVICIOS AUXILIARES SL</strong></p>
          </body>
        </html>
      `;
    }

    try {
      await this.emailService.sendEmail(email, subject, html, {
        bcc: ['decamino.rrhh@gmail.com'],
      });

      this.logger.log(
        `✅ Email de bun venit trimis către ${email} (${nombre}) pentru FECHA DE ALTA: ${fechaAltaFormateada}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: empleadoData.CODIGO,
          recipientEmail: email,
          recipientName: nombre,
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ Eroare la salvarea email-ului de bun venit în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la trimiterea email-ului de bun venit către ${email}: ${error.message}`,
      );

      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: empleadoData.CODIGO,
          recipientEmail: email,
          recipientName: nombre,
          subject,
          message: html,
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ Eroare la salvarea email-ului de bun venit eșuat în BD: ${saveError.message}`,
        );
      }

      throw error;
    }
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'archivosGestoria', maxCount: 10 }]),
  )
  async updateEmpleado(
    @UploadedFiles()
    files: {
      archivosGestoria?: Express.Multer.File[];
    },
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `📝 Update empleado request received. Body keys: ${Object.keys(body || {}).join(', ')}`,
      );
      this.logger.log(`📝 CODIGO value: ${body?.CODIGO || 'undefined'}`);

      if (!body || !body.CODIGO) {
        this.logger.error(`❌ CODIGO missing. Body: ${JSON.stringify(body)}`);
        throw new BadRequestException('CODIGO is required');
      }

      // Obține datele originale ale angajatului pentru a verifica dacă este o reactivare
      const empleadoAnterior = await this.empleadosService.getEmpleadoByCodigo(
        body.CODIGO,
      );

      // Extragem datele din body
      // Pentru parolă, includem doar dacă este trimisă și nu este goală (pentru a nu suprascrie parola existentă)
      const contraseña = body.Contraseña?.trim() || null;
      const includePassword = contraseña !== null && contraseña !== '';

      // Log pentru debugging
      this.logger.log(
        `🔍 [updateEmpleado] Câmpuri separate primite: NOMBRE=${body.NOMBRE}, APELLIDO1=${body.APELLIDO1}, APELLIDO2=${body.APELLIDO2}, NOMBRE_SPLIT_CONFIANZA=${body.NOMBRE_SPLIT_CONFIANZA}`,
      );

      const empleadoData: any = {
        'NOMBRE / APELLIDOS': body['NOMBRE / APELLIDOS'] || '',
        // Câmpuri separate pentru nume (dacă sunt furnizate)
        NOMBRE: body.NOMBRE !== undefined ? body.NOMBRE : undefined,
        APELLIDO1: body.APELLIDO1 !== undefined ? body.APELLIDO1 : undefined,
        APELLIDO2: body.APELLIDO2 !== undefined ? body.APELLIDO2 : undefined,
        NOMBRE_SPLIT_CONFIANZA:
          body.NOMBRE_SPLIT_CONFIANZA !== undefined
            ? body.NOMBRE_SPLIT_CONFIANZA
            : undefined,
        NACIONALIDAD: body.NACIONALIDAD || '',
        DIRECCION: body.DIRECCION || '',
        'D.N.I. / NIE': body['D.N.I. / NIE'] || '',
        'SEG. SOCIAL': body['SEG. SOCIAL'] || '',
        'Nº Cuenta': body['Nº Cuenta'] || '',
        TELEFONO: body.TELEFONO || '',
        'CORREO ELECTRONICO': body['CORREO ELECTRONICO'] || '',
        'FECHA NACIMIENTO': body['FECHA NACIMIENTO'] || '',
        'FECHA DE ALTA': body['FECHA DE ALTA'] || '',
        'FECHA BAJA': body['FECHA BAJA'] || body['FECHA BAJA'] || null,
        'Fecha Antigüedad': body['Fecha Antigüedad'] || null,
        Antigüedad: body.Antigüedad || null,
        'CENTRO TRABAJO': body['CENTRO TRABAJO'] || '',
        'TIPO DE CONTRATO': body['TIPO DE CONTRATO'] || '',
        'SUELDO BRUTO MENSUAL': body['SUELDO BRUTO MENSUAL'] || '',
        'HORAS DE CONTRATO': body['HORAS DE CONTRATO'] || '',
        EMPRESA: body.EMPRESA || '',
        GRUPO: body.GRUPO || '',
        ESTADO: body.ESTADO || '',
        DerechoPedidos: body.DerechoPedidos || '',
        TrabajaFestivos: body.TrabajaFestivos || '',
      };

      // Include parola doar dacă este furnizată și nu este goală
      if (includePassword) {
        empleadoData.Contraseña = contraseña;
      }

      const result = await this.empleadosService.updateEmpleado(
        body.CODIGO,
        empleadoData,
      );

      // Verifică dacă este o reactivare (ESTADO se schimbă din INACTIVO în ACTIVO) sau dacă se setează FECHA DE ALTA
      const estadoAnterior =
        empleadoAnterior?.ESTADO || empleadoAnterior?.estado || '';
      const estadoNuevo =
        empleadoData.ESTADO ||
        empleadoAnterior?.ESTADO ||
        empleadoAnterior?.estado ||
        '';
      const fechaAltaAnterior =
        empleadoAnterior?.['FECHA DE ALTA'] ||
        empleadoAnterior?.FECHA_DE_ALTA ||
        '';
      // Folosește FECHA DE ALTA din body dacă există, altfel folosește cea anterioară
      const fechaAltaNueva =
        body['FECHA DE ALTA'] ||
        empleadoData['FECHA DE ALTA'] ||
        fechaAltaAnterior ||
        '';

      // Verifică dacă este reactivare (ESTADO din INACTIVO în ACTIVO)
      const esReactivacion =
        estadoAnterior.toUpperCase() === 'INACTIVO' &&
        estadoNuevo.toUpperCase() === 'ACTIVO';
      // Verifică dacă se setează FECHA DE ALTA pentru prima dată (nu există anterior)
      const esPrimeraFechaAlta =
        (!fechaAltaAnterior || fechaAltaAnterior.trim() === '') &&
        fechaAltaNueva &&
        fechaAltaNueva.trim() !== '';
      // Verifică dacă există FECHA DE ALTA (fie nouă, fie existentă)
      const tieneFechaAlta = fechaAltaNueva && fechaAltaNueva.trim() !== '';

      // Funcție helper pentru a parsea FECHA_DE_ALTA și a verifica dacă este în viitor sau astăzi
      const parseFechaAlta = (fechaStr: string): Date | null => {
        if (!fechaStr || fechaStr.trim() === '') return null;

        const str = fechaStr.trim();
        // Formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          const date = new Date(str);
          if (!isNaN(date.getTime())) return date;
        }
        // Formato DD/MM/YYYY o DD-MM-YYYY
        const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          let year = parseInt(match[3], 10);
          if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
          }
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) return date;
        }
        return null;
      };

      // Verifică dacă FECHA_DE_ALTA este în viitor sau astăzi (nu în trecut)
      const fechaAltaDate = parseFechaAlta(fechaAltaNueva);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaAltaNormalizada = fechaAltaDate
        ? new Date(fechaAltaDate)
        : null;
      if (fechaAltaNormalizada) {
        fechaAltaNormalizada.setHours(0, 0, 0, 0);
      }
      // FECHA_DE_ALTA este în viitor sau astăzi (>= astăzi)
      const fechaAltaEsFuturoOHoy = fechaAltaNormalizada
        ? fechaAltaNormalizada >= hoy
        : false;

      this.logger.log(
        `🔍 [updateEmpleado] Verificare email bun venit pentru ${body.CODIGO}: esReactivacion=${esReactivacion}, esPrimeraFechaAlta=${esPrimeraFechaAlta}, tieneFechaAlta=${tieneFechaAlta}, fechaAltaEsFuturoOHoy=${fechaAltaEsFuturoOHoy}, fechaAltaNueva="${fechaAltaNueva}"`,
      );

      // Trimite email de bun venit dacă:
      // 1. Este reactivare (ESTADO din INACTIVO în ACTIVO) ȘI are FECHA DE ALTA (fie nouă, fie existentă) ȘI FECHA_DE_ALTA este în viitor sau astăzi
      // 2. SAU se setează FECHA DE ALTA pentru prima dată ȘI FECHA_DE_ALTA este în viitor sau astăzi
      if (
        ((esReactivacion && tieneFechaAlta) || esPrimeraFechaAlta) &&
        fechaAltaEsFuturoOHoy
      ) {
        const empleadoCompleto = {
          ...empleadoAnterior,
          ...empleadoData,
          CODIGO: body.CODIGO,
          'FECHA DE ALTA': fechaAltaNueva, // Asigură că folosește FECHA DE ALTA (nouă sau existentă)
        };

        const emailEmpleado =
          empleadoCompleto['CORREO ELECTRONICO'] ||
          empleadoCompleto.CORREO_ELECTRONICO;
        if (emailEmpleado && emailEmpleado.trim() !== '') {
          this.logger.log(
            `📧 [updateEmpleado] Trimitere email bun venit către ${emailEmpleado} (${body.CODIGO}) - Reactivare: ${esReactivacion}, Primera Fecha Alta: ${esPrimeraFechaAlta}`,
          );
          try {
            await this.sendWelcomeEmailToEmpleado(empleadoCompleto);
          } catch (welcomeEmailError: any) {
            this.logger.warn(
              `⚠️ Eroare la trimiterea email-ului de bun venit către ${body.CODIGO}: ${welcomeEmailError.message}`,
            );
            // Nu oprește procesul dacă email-ul de bun venit eșuează
          }
        } else {
          this.logger.warn(
            `⚠️ [updateEmpleado] Angajatul ${body.CODIGO} nu are email configurat pentru email de bun venit`,
          );
        }
      } else {
        this.logger.log(
          `ℹ️ [updateEmpleado] Email bun venit NU se trimite pentru ${body.CODIGO} - condițiile nu sunt îndeplinite`,
        );
      }

      // Trimite email la gestorie dacă este solicitat
      const enviarAGestoria =
        body.enviarAGestoria === 'true' ||
        body.enviarAGestoria === true ||
        body.enviarAGestoria === '1';

      if (enviarAGestoria && this.emailService.isConfigured()) {
        // Definește variabilele înainte de try pentru a fi disponibile în catch
        const emailBody =
          body.emailBody ||
          body.mesaj ||
          'Se ha actualizado la información del empleado.';
        const emailSubject =
          body.emailSubject ||
          body.subiect ||
          `Actualización de datos - ${empleadoData['NOMBRE / APELLIDOS'] || body.CODIGO || 'Empleado'}`;

        // Adaugă mesajul adițional dacă există
        const mensajeAdicional = body.mensajeAdicionalGestoria || '';
        let htmlEmail = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066CC;">Actualización de Datos del Empleado</h2>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Empleado:</strong> ${this.empleadosService.getFormattedNombre(empleadoData) || body.CODIGO || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Código:</strong> ${body.CODIGO || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${empleadoData['CORREO ELECTRONICO'] || 'N/A'}</p>
            </div>
            <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #0066CC; margin: 20px 0;">
              <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${emailBody.replace(/\n/g, '<br>')}</pre>
            </div>
        `;

        // Adaugă mesajul adițional dacă există
        if (mensajeAdicional && mensajeAdicional.trim()) {
          htmlEmail += `
            <div style="background-color: #e8f4f8; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
              <strong>Mensaje adicional:</strong><br>
              <div style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${mensajeAdicional.replace(/\n/g, '<br>')}</div>
            </div>
          `;
        }

        htmlEmail += `
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Actualizado por: ${body.updatedBy || 'Sistema'}<br>
              Fecha: ${new Date().toLocaleString('es-ES')}
            </p>
          </div>
        `;

        try {
          // Obține fișierele dacă există
          const archivosGestoria = files?.archivosGestoria || [];

          // Pregătește attachments
          const attachments = [];
          if (archivosGestoria.length > 0) {
            archivosGestoria.forEach((file) => {
              attachments.push({
                filename: file.originalname || 'attachment',
                content: file.buffer,
                contentType: file.mimetype || 'application/octet-stream',
              });
            });
          }

          // Trimite la gestoria (altemprado@gmail.com) cu BCC
          if (attachments.length > 0) {
            await this.emailService.sendEmailWithAttachments(
              'altemprado@gmail.com',
              emailSubject,
              htmlEmail,
              attachments,
              {
                bcc: [
                  'info@decaminoservicios.com',
                  'mirisjm@gmail.com',
                  'decamino.rrhh@gmail.com',
                ],
              },
            );
          } else {
            await this.emailService.sendEmail(
              'altemprado@gmail.com',
              emailSubject,
              htmlEmail,
              {
                bcc: [
                  'info@decaminoservicios.com',
                  'mirisjm@gmail.com',
                  'decamino.rrhh@gmail.com',
                ],
              },
            );
          }

          this.logger.log(
            `✅ Email trimis către gestoria (altemprado@gmail.com) pentru actualizare empleado ${body.CODIGO}`,
          );

          // Salvează email-ul în BD
          try {
            const senderId = String(
              body.updatedBy
                ? body.updatedBy
                : user?.CODIGO || user?.codigo || user?.userId || 'system',
            );
            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType: 'gestoria',
              recipientEmail: 'altemprado@gmail.com',
              recipientName: 'Gestoria',
              subject: emailSubject,
              message: htmlEmail,
              additionalMessage: mensajeAdicional || emailBody || undefined,
              status: 'sent',
              attachments: attachments.map((att) => ({
                filename: att.filename,
                fileContent: att.content,
                mimeType: att.contentType,
                fileSize: att.content.length,
              })),
            });
          } catch (saveError: any) {
            this.logger.warn(
              `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
            );
          }
        } catch (emailError: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului către gestoria: ${emailError.message}`,
          );

          // Salvează și email-urile eșuate în BD
          try {
            const senderId = String(
              body.updatedBy
                ? body.updatedBy
                : user?.CODIGO || user?.codigo || user?.userId || 'system',
            );
            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType: 'gestoria',
              recipientEmail: 'altemprado@gmail.com',
              recipientName: 'Gestoria',
              subject:
                emailSubject ||
                `Actualización de datos - ${this.empleadosService.getFormattedNombre(empleadoData) || body.CODIGO || 'Empleado'}`,
              message:
                htmlEmail ||
                emailBody ||
                'Se ha actualizado la información del empleado.',
              additionalMessage: emailBody || undefined,
              status: 'failed',
              errorMessage: emailError.message || String(emailError),
            });
          } catch (saveError: any) {
            this.logger.warn(
              `⚠️ Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
            );
          }

          // Nu aruncăm eroare aici, pentru că actualizarea a reușit
        }
      }

      return {
        success: true,
        message: 'Empleado actualizado correctamente',
        codigo: result.codigo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating empleado:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar empleado: ${error.message}`,
      );
    }
  }

  @Post('cambio-aprobacion')
  @UseGuards(JwtAuthGuard)
  async createCambioAprobacion(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Creare cerere de aprobare pentru empleado: ${body?.CODIGO || 'unknown'}`,
      );

      // Validăm datele
      if (!body.ID || !body.CODIGO || !body.CORREO_ELECTRONICO) {
        throw new BadRequestException(
          'ID, CODIGO și CORREO_ELECTRONICO sunt obligatorii',
        );
      }

      // Creăm cererea de aprobare
      const result = await this.empleadosService.createCambioAprobacion({
        ID: body.ID,
        CODIGO: body.CODIGO,
        CORREO_ELECTRONICO: body.CORREO_ELECTRONICO,
        NOMBRE: body.NOMBRE || '',
        CAMPO_MODIFICADO: body.CAMPO_MODIFICADO || '',
        VALOR_ANTERIOR: body.VALOR_ANTERIOR || '',
        VALOR_NUEVO: body.VALOR_NUEVO || '',
        MOTIVO_CAMBIO: body.MOTIVO_CAMBIO || '',
        FECHA_SOLICITUD: body.FECHA_SOLICITUD || new Date().toISOString(),
        FECHA_APROBACION: body.FECHA_APROBACION || new Date().toISOString(),
        ESTADO: body.ESTADO || 'pendiente',
        // Campos separados (opcionales)
        NOMBRE_SEPARADO: body.NOMBRE_SEPARADO,
        APELLIDO1: body.APELLIDO1,
        APELLIDO2: body.APELLIDO2,
        NOMBRE_SPLIT_CONFIANZA: body.NOMBRE_SPLIT_CONFIANZA,
      });

      // Trimitem email de confirmare dacă SMTP este configurat
      if (this.emailService.isConfigured() && body.CORREO_ELECTRONICO) {
        try {
          const subject =
            'Tu solicitud de actualización ha sido registrada correctamente';
          const html = `
            <p>¡Hola!</p>
            <p>
              Hemos recibido tu solicitud para modificar el campo <strong>"${body.CAMPO_MODIFICADO || ''}"</strong>.<br>
              <strong>Valor actual:</strong> ${body.VALOR_ANTERIOR || ''}<br>
              <strong>Nuevo valor solicitado:</strong> ${body.VALOR_NUEVO || ''}
            </p>
            <p>Un supervisor revisará tu solicitud en breve.</p>
            <p>Gracias,<br>
            Equipo de Recursos Humanos</p>
            <p>DE CAMINO Servicios Auxiliares SL</p>
          `;

          await this.emailService.sendEmail(
            body.CORREO_ELECTRONICO,
            subject,
            html,
            {
              bcc: ['info@decaminoservicios.com', 'decamino.rrhh@gmail.com'],
            },
          );

          this.logger.log(
            `✅ Email de confirmare trimis către ${body.CORREO_ELECTRONICO}`,
          );
        } catch (emailError: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului de confirmare: ${emailError.message}`,
          );
          // Nu aruncăm eroare aici, pentru că cererea a fost creată cu succes
        }
      } else {
        this.logger.warn(
          '⚠️ SMTP nu este configurat sau CORREO_ELECTRONICO lipsește. Email-ul nu va fi trimis.',
        );
      }

      return {
        success: true,
        message: 'Solicitud de actualización registrada correctamente',
        id: result.id,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating cambio aprobacion:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear solicitud de aprobación: ${error.message}`,
      );
    }
  }

  @Post('approve-cambio')
  @UseGuards(JwtAuthGuard)
  async approveCambio(@Body() body: any) {
    try {
      this.logger.log(
        `✅ Aprobare cambio pentru empleado: ${body?.codigo || body?.CODIGO || 'unknown'}, cambio ID: ${body?.id || body?.ID || 'unknown'}`,
      );

      // Validăm datele
      if (!body.id && !body.ID) {
        throw new BadRequestException('ID-ul cambio-ului este obligatoriu');
      }
      if (!body.codigo && !body.CODIGO) {
        throw new BadRequestException('CODIGO-ul empleado este obligatoriu');
      }
      if (!body.campo && !body.CAMPO_MODIFICADO) {
        throw new BadRequestException('Câmpul de modificat este obligatoriu');
      }
      if (body.valor === undefined && body.VALOR_NUEVO === undefined) {
        throw new BadRequestException('Valoarea nouă este obligatorie');
      }

      // Aprobă cambio-ul
      const result = await this.empleadosService.approveCambio({
        id: body.id || body.ID,
        codigo: body.codigo || body.CODIGO,
        campo: body.campo || body.CAMPO_MODIFICADO,
        valor: body.valor || body.VALOR_NUEVO || '',
      });

      // Trimite email la gestoria dacă este solicitat
      const enviarAGestoria =
        body.enviarAGestoria === 'true' ||
        body.enviarAGestoria === true ||
        body.enviarAGestoria === '1';

      if (enviarAGestoria && this.emailService.isConfigured()) {
        try {
          // Construiește mesajul email cu informații despre aprobare
          const emailBody =
            body.emailBody ||
            body.mesaj ||
            `Se ha aprobado y actualizado la información del empleado:\n\n` +
              `Empleado: ${body.nombre || body.NOMBRE || 'N/A'}\n` +
              `Código: ${body.codigo || body.CODIGO || 'N/A'}\n` +
              `Email: ${body.email || body.CORREO_ELECTRONICO || 'N/A'}\n\n` +
              `Campo modificado: ${body.campo || body.CAMPO_MODIFICADO || 'N/A'}\n` +
              `Valor nuevo: ${body.valor || body.VALOR_NUEVO || 'N/A'}\n\n` +
              `Aprobado por: ${body.updatedBy || 'Sistema'}\n` +
              `Fecha: ${new Date().toLocaleString('es-ES')}`;

          const emailSubject =
            body.emailSubject ||
            body.subiect ||
            `Aprobación de cambio de datos - ${body.nombre || body.NOMBRE || body.codigo || body.CODIGO || 'Empleado'}`;

          // Formatează mesajul ca HTML pentru email
          const htmlEmail = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0066CC;">Aprobación de Cambio de Datos del Empleado</h2>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Empleado:</strong> ${body.nombre || body.NOMBRE || body.codigo || body.CODIGO || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Código:</strong> ${body.codigo || body.CODIGO || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${body.email || body.CORREO_ELECTRONICO || 'N/A'}</p>
              </div>
              <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #0066CC; margin: 20px 0;">
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${emailBody.replace(/\n/g, '<br>')}</pre>
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Aprobado por: ${body.updatedBy || 'Sistema'}<br>
                Fecha: ${new Date().toLocaleString('es-ES')}
              </p>
            </div>
          `;

          // Trimite la gestoria (altemprado@gmail.com) cu BCC
          await this.emailService.sendEmail(
            'altemprado@gmail.com',
            emailSubject,
            htmlEmail,
            {
              bcc: [
                'info@decaminoservicios.com',
                'mirisjm@gmail.com',
                'decamino.rrhh@gmail.com',
              ],
            },
          );

          this.logger.log(
            `✅ Email trimis către gestoria (altemprado@gmail.com) pentru aprobare cambio ${body.id || body.ID}`,
          );
        } catch (emailError: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului către gestoria: ${emailError.message}`,
          );
          // Nu aruncăm eroare aici, pentru că aprobarea a reușit
        }
      }

      return {
        success: true,
        message: 'Cambio aprobado y actualizado correctamente',
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error approving cambio:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al aprobar cambio: ${error.message}`,
      );
    }
  }

  @Post('reject-cambio')
  @UseGuards(JwtAuthGuard)
  async rejectCambio(@Body() body: any) {
    try {
      this.logger.log(
        `❌ Respingere cambio ID: ${body?.id || body?.ID || 'unknown'}`,
      );

      // Validăm datele
      if (!body.id && !body.ID) {
        throw new BadRequestException('ID-ul cambio-ului este obligatoriu');
      }

      // Respinge cambio-ul
      const result = await this.empleadosService.rejectCambio({
        id: body.id || body.ID,
      });

      // Trimite email către angajat dacă email este furnizat
      if (
        (body.email || body.CORREO_ELECTRONICO) &&
        this.emailService.isConfigured()
      ) {
        try {
          const emailDestinatario = body.email || body.CORREO_ELECTRONICO;
          const campoModificado =
            body.campo || body.CAMPO_MODIFICADO || 'el campo solicitado';
          const motivoRechazo =
            body.motiv ||
            body.rejectReason ||
            'No se ha especificado un motivo';

          const subject = 'Tu solicitud de cambio ha sido rechazada';
          const htmlEmail = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #CC0000;">Solicitud de Cambio Rechazada</h2>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Empleado:</strong> ${body.nombre || body.NOMBRE || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Código:</strong> ${body.codigo || body.CODIGO || 'N/A'}</p>
              </div>
              <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #CC0000; margin: 20px 0;">
                <p>¡Hola!</p>
                <p>
                  Tu solicitud para modificar el campo <strong>"${campoModificado}"</strong> ha sido rechazada.
                </p>
                ${motivoRechazo ? `<p><strong>Motivo del rechazo:</strong><br>${motivoRechazo.replace(/\n/g, '<br>')}</p>` : ''}
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Gracias,<br>
                Equipo de Recursos Humanos<br>
                DE CAMINO Servicios Auxiliares SL
              </p>
            </div>
          `;

          // Trimite către angajat cu BCC la info@decaminoservicios.com
          await this.emailService.sendEmail(
            emailDestinatario,
            subject,
            htmlEmail,
            {
              bcc: ['info@decaminoservicios.com', 'decamino.rrhh@gmail.com'],
            },
          );

          this.logger.log(
            `✅ Email de respingere trimis către ${emailDestinatario} pentru cambio ${body.id || body.ID}`,
          );
        } catch (emailError: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului de respingere: ${emailError.message}`,
          );
          // Nu aruncăm eroare aici, pentru că respingerea a reușit
        }
      } else {
        this.logger.warn(
          '⚠️ Email nu este furnizat sau SMTP nu este configurat. Email-ul de respingere nu va fi trimis.',
        );
      }

      return {
        success: true,
        message: 'Cambio rechazado correctamente',
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error rejecting cambio:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al rechazar cambio: ${error.message}`,
      );
    }
  }

  @Post('send-email')
  @UseGuards(JwtAuthGuard)
  async sendEmailToEmpleado(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log('📧 Send email request:', {
        destinatar: body.destinatar,
        grup: body.grup,
        codigo: body.codigo,
      });

      const { mesaj, subiect, destinatar, grup, codigo } = body;

      if (!mesaj || !subiect) {
        throw new BadRequestException('mesaj și subiect sunt obligatorii');
      }

      // Verifică dacă SMTP este configurat
      if (!this.emailService.isConfigured()) {
        throw new BadRequestException(
          'SMTP nu este configurat. Email-ul nu poate fi trimis.',
        );
      }

      let emailRecipients: Array<{
        email: string;
        nombre: string;
        codigo: string;
      }> = [];

      if (destinatar === 'angajat' && codigo) {
        // Trimite la un angajat specific
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        const email =
          empleado['CORREO ELECTRONICO'] || empleado.CORREO_ELECTRONICO;
        const nombre = this.empleadosService.getFormattedNombre(empleado);

        if (!email) {
          throw new BadRequestException(
            `Angajatul ${codigo} nu are email configurat`,
          );
        }

        emailRecipients = [
          { email, nombre, codigo: String(empleado.CODIGO || codigo) },
        ];
      } else if (destinatar === 'toti') {
        // Trimite la TOȚI angajații ACTIVI (indiferent de grup)
        const empleados = await this.empleadosService.getAllEmpleados();
        const empleadosActivos = empleados.filter(
          (e) => (e.ESTADO || e.estado) === 'ACTIVO',
        );

        emailRecipients = empleadosActivos
          .map((e) => ({
            email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
            nombre: this.empleadosService.getFormattedNombre(e),
            codigo: String(e.CODIGO),
          }))
          .filter((r) => r.email && r.email.trim() !== '');

        if (emailRecipients.length === 0) {
          throw new BadRequestException(
            'Nu s-au găsit angajați activi care au email configurat',
          );
        }

        this.logger.log(
          `📧 Trimite email la TOȚI angajații activi: ${emailRecipients.length} destinatari`,
        );
      } else if (grup) {
        // Trimite la toți angajații dintr-un grup (doar cei activi)
        const empleados = await this.empleadosService.getAllEmpleados();
        const empleadosGrupo = empleados.filter(
          (e) =>
            (e.GRUPO || e.grupo) === grup &&
            (e.ESTADO || e.estado) === 'ACTIVO',
        );

        emailRecipients = empleadosGrupo
          .map((e) => ({
            email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
            nombre: this.empleadosService.getFormattedNombre(e),
            codigo: String(e.CODIGO),
          }))
          .filter((r) => r.email && r.email.trim() !== '');

        if (emailRecipients.length === 0) {
          throw new BadRequestException(
            `Nu s-au găsit angajați activi cu grupul ${grup} care au email configurat`,
          );
        }
      } else {
        throw new BadRequestException(
          'destinatar și codigo sau grup sunt obligatorii',
        );
      }

      // Trimite email-uri către toți destinatarii
      // Folosim secvențial cu delay pentru a nu suprasolicita SMTP
      // Pentru număr mare de destinatari, mărim delay-ul pentru a evita rate limiting
      const totalRecipients = emailRecipients.length;
      const delayMs = totalRecipients > 50 ? 1000 : 500; // 1s pentru >50, 500ms pentru mai puțini

      // Obține userId-ul utilizatorului curent pentru a trimite progresul
      const currentUserId =
        user?.CODIGO || user?.codigo || user?.userId || 'unknown';

      this.logger.log(
        `📧 Începe trimiterea email-urilor către ${totalRecipients} destinatari (delay: ${delayMs}ms între email-uri)`,
      );

      // Trimite progres inițial
      this.notificationsGateway.sendToUser(currentUserId, {
        type: 'email_progress',
        total: totalRecipients,
        current: 0,
        success: 0,
        failed: 0,
        status: 'starting',
      });

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < emailRecipients.length; i++) {
        const recipient = emailRecipients[i];

        // Template email identic cu n8n - fără indentare pentru a evita spații
        // Curăță mesajul de spații și linii goale
        const mesajCleaned = (mesaj || '')
          .trim()
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join('\n');
        const html = `<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><p>Hola <strong>${recipient.nombre}</strong>,</p>${mesajCleaned ? `<div style="white-space: pre-wrap;">${mesajCleaned.replace(/\n/g, '<br>')}</div>` : ''}<p><strong>Atentamente:</strong><br><strong>RRHH</strong><br><strong>DE CAMINO SERVICIOS AUXILIARES SL</strong></p></body></html>`;

        try {
          await this.emailService.sendEmail(recipient.email, subiect, html, {
            bcc: ['decamino.rrhh@gmail.com'],
          });
          successCount++;

          // Salvează email-ul în BD
          try {
            const senderId = String(
              user?.CODIGO || user?.codigo || user?.userId || 'system',
            );
            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType:
                destinatar === 'toti'
                  ? 'toti'
                  : destinatar === 'grup'
                    ? 'grupo'
                    : 'empleado',
              recipientId: recipient.codigo || undefined,
              recipientEmail: recipient.email,
              recipientName: recipient.nombre,
              subject: subiect,
              message: html,
              status: 'sent',
            });
          } catch (saveError: any) {
            // Nu oprește procesul dacă salvarea eșuează
            this.logger.warn(
              `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
            );
          }

          // Trimite notificare către angajatul care a primit email-ul
          try {
            const senderId = String(
              user?.CODIGO || user?.codigo || user?.userId || 'system',
            );
            await this.notificationsService.notifyUser(
              senderId,
              recipient.codigo,
              {
                type: 'info',
                title: 'Nuevo correo recibido',
                message: `Has recibido un correo: ${subiect}`,
                data: {
                  subject: subiect,
                  sender:
                    user?.nombre ||
                    (user
                      ? this.empleadosService.getFormattedNombre(user)
                      : null) ||
                    'RRHH',
                },
              },
            );
            this.logger.log(
              `📬 Notificare trimisă către angajat ${recipient.codigo} (${recipient.nombre})`,
            );
          } catch (notifError: any) {
            // Nu oprește procesul dacă notificarea eșuează
            this.logger.warn(
              `⚠️ Eroare la trimiterea notificării către ${recipient.codigo}: ${notifError.message}`,
            );
          }

          // Trimite progres prin WebSocket la fiecare email sau la fiecare 5 email-uri pentru număr mare
          const progressInterval = totalRecipients > 20 ? 5 : 1;
          if (
            (i + 1) % progressInterval === 0 ||
            i === emailRecipients.length - 1
          ) {
            this.notificationsGateway.sendToUser(currentUserId, {
              type: 'email_progress',
              total: totalRecipients,
              current: i + 1,
              success: successCount,
              failed: failedCount,
              status:
                i === emailRecipients.length - 1 ? 'completed' : 'sending',
            });
          }

          // Log progres la fiecare 10 email-uri sau la ultimul
          if ((i + 1) % 10 === 0 || i === emailRecipients.length - 1) {
            this.logger.log(
              `📧 Progres: ${i + 1}/${totalRecipients} email-uri procesate (${successCount} reușite, ${failedCount} eșuate)`,
            );
          }

          // Delay între email-uri pentru a nu suprasolicita SMTP
          // Delay mai mare pentru număr mare de destinatari
          if (i < emailRecipients.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } catch (error: any) {
          failedCount++;
          this.logger.error(
            `❌ Eroare la trimiterea email-ului către ${recipient.email} (${recipient.nombre}):`,
            error.message || error,
          );

          // Salvează și email-urile eșuate în BD
          try {
            const senderId = String(
              user?.CODIGO || user?.codigo || user?.userId || 'system',
            );
            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType:
                destinatar === 'toti'
                  ? 'toti'
                  : destinatar === 'grup'
                    ? 'grupo'
                    : 'empleado',
              recipientId: recipient.codigo || undefined,
              recipientEmail: recipient.email,
              recipientName: recipient.nombre,
              subject: subiect,
              message: html,
              status: 'failed',
              errorMessage: error.message || String(error),
            });
          } catch (saveError: any) {
            this.logger.warn(
              `⚠️ Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
            );
          }

          // Trimite progres și pentru erori
          if ((i + 1) % 5 === 0 || i === emailRecipients.length - 1) {
            this.notificationsGateway.sendToUser(currentUserId, {
              type: 'email_progress',
              total: totalRecipients,
              current: i + 1,
              success: successCount,
              failed: failedCount,
              status: 'sending',
            });
          }
          // Continuă cu următorul email chiar dacă unul a eșuat
        }
      }

      // Trimite progres final
      this.notificationsGateway.sendToUser(currentUserId, {
        type: 'email_progress',
        total: totalRecipients,
        current: totalRecipients,
        success: successCount,
        failed: failedCount,
        status: 'completed',
      });

      this.logger.log(
        `✅ Finalizat: ${successCount} email-uri trimise cu succes, ${failedCount} eșuate din ${totalRecipients} total`,
      );

      return {
        success: true,
        message: `Email trimis către ${successCount} destinatari${failedCount > 0 ? ` (${failedCount} eșuate)` : ''}`,
        destinatari: totalRecipients,
        successCount,
        failedCount,
      };
    } catch (error: any) {
      this.logger.error('❌ Error sending email:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al enviar email: ${error.message}`);
    }
  }

  /**
   * Endpoint pentru actualizarea câmpurilor separate (NOMBRE, APELLIDO1, APELLIDO2)
   * Folosit pentru corectare manuală a split-urilor
   */
  @Put(':codigo/nombre-split')
  @UseGuards(JwtAuthGuard)
  async updateNombreSplit(
    @Body()
    body: {
      NOMBRE?: string;
      APELLIDO1?: string;
      APELLIDO2?: string;
      NOMBRE_SPLIT_CONFIANZA?: number;
    },
  ) {
    try {
      const codigo = (body as any).CODIGO || (body as any).codigo;
      if (!codigo) {
        throw new BadRequestException('CODIGO is required');
      }

      this.logger.log(
        `📝 Actualizare câmpuri separate pentru empleado ${codigo}`,
      );

      const result = await this.empleadosService.updateNombreSplit(codigo, {
        NOMBRE: body.NOMBRE,
        APELLIDO1: body.APELLIDO1,
        APELLIDO2: body.APELLIDO2,
        NOMBRE_SPLIT_CONFIANZA: body.NOMBRE_SPLIT_CONFIANZA ?? 2, // Default confianza = 2 pentru corectare manuală
      });

      return {
        success: true,
        message: 'Câmpuri separate actualizate cu succes',
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating nombre split:', error);
      throw new BadRequestException(
        `Error al actualizar campos separados: ${error.message}`,
      );
    }
  }
}
