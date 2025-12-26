import {
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadosService } from '../services/empleados.service';
import { EmailService } from '../services/email.service';
import { EmpleadosStatsService } from '../services/empleados-stats.service';

@Controller('api/empleados')
export class EmpleadosController {
  private readonly logger = new Logger(EmpleadosController.name);

  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly emailService: EmailService,
    private readonly empleadosStatsService: EmpleadosStatsService,
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

  @Get()
  async getAll() {
    const empleados = await this.empleadosService.getAllEmpleados();
    return empleados;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('pdf'))
  async addEmpleado(
    @UploadedFile() pdfFile: Express.Multer.File,
    @Body() body: any,
  ) {
    try {
      // Extragem datele din body
      const empleadoData = {
        CODIGO: body.CODIGO,
        'NOMBRE / APELLIDOS': body['NOMBRE / APELLIDOS'] || '',
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

      // Salvăm PDF-ul în CarpetasDocumentos dacă există
      if (pdfFile && pdfFile.buffer) {
        const nombreEmpleado = empleadoData['NOMBRE / APELLIDOS'] || '';
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
              empleadoData['NOMBRE / APELLIDOS'] || 'Sin Nombre';
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

            if (enviarAGestoria) {
              // Dacă este bifat: trimite la gestoria (altemprado@gmail.com) cu BCC
              await this.emailService.sendEmailWithAttachment(
                'altemprado@gmail.com',
                subject,
                html,
                pdfFile.buffer,
                pdfFileName,
                {
                  bcc: ['info@decaminoservicios.com', 'mirisjm@gmail.com'],
                },
              );

              this.logger.log(
                `✅ Email trimis către gestoria (altemprado@gmail.com) pentru empleado ${empleadoData.CODIGO}`,
              );
            } else {
              // Dacă NU este bifat: trimite DOAR la info@decaminoservicios.com
              await this.emailService.sendEmailWithAttachment(
                'info@decaminoservicios.com',
                subject,
                html,
                pdfFile.buffer,
                pdfFileName,
              );

              this.logger.log(
                `✅ Email trimis către info@decaminoservicios.com pentru empleado ${empleadoData.CODIGO}`,
              );
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

  @Put()
  @UseGuards(JwtAuthGuard)
  async updateEmpleado(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Update empleado request received. Body keys: ${Object.keys(body || {}).join(', ')}`,
      );
      this.logger.log(`📝 CODIGO value: ${body?.CODIGO || 'undefined'}`);

      if (!body || !body.CODIGO) {
        this.logger.error(`❌ CODIGO missing. Body: ${JSON.stringify(body)}`);
        throw new BadRequestException('CODIGO is required');
      }

      // Extragem datele din body
      // Pentru parolă, includem doar dacă este trimisă și nu este goală (pentru a nu suprascrie parola existentă)
      const contraseña = body.Contraseña?.trim() || null;
      const includePassword = contraseña !== null && contraseña !== '';

      const empleadoData: any = {
        'NOMBRE / APELLIDOS': body['NOMBRE / APELLIDOS'] || '',
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

      // Trimite email la gestorie dacă este solicitat
      const enviarAGestoria =
        body.enviarAGestoria === 'true' ||
        body.enviarAGestoria === true ||
        body.enviarAGestoria === '1';

      if (enviarAGestoria && this.emailService.isConfigured()) {
        try {
          // Construiește mesajul email cu informații despre actualizare
          const emailBody =
            body.emailBody ||
            body.mesaj ||
            'Se ha actualizado la información del empleado.';
          const emailSubject =
            body.emailSubject ||
            body.subiect ||
            `Actualización de datos - ${empleadoData['NOMBRE / APELLIDOS'] || body.CODIGO || 'Empleado'}`;

          // Formatează mesajul ca HTML pentru email
          const htmlEmail = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0066CC;">Actualización de Datos del Empleado</h2>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Empleado:</strong> ${empleadoData['NOMBRE / APELLIDOS'] || body.CODIGO || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Código:</strong> ${body.CODIGO || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${empleadoData['CORREO ELECTRONICO'] || 'N/A'}</p>
              </div>
              <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #0066CC; margin: 20px 0;">
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${emailBody.replace(/\n/g, '<br>')}</pre>
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Actualizado por: ${body.updatedBy || 'Sistema'}<br>
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
              bcc: ['info@decaminoservicios.com', 'mirisjm@gmail.com'],
            },
          );

          this.logger.log(
            `✅ Email trimis către gestoria (altemprado@gmail.com) pentru actualizare empleado ${body.CODIGO}`,
          );
        } catch (emailError: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului către gestoria: ${emailError.message}`,
          );
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
              bcc: ['info@decaminoservicios.com'],
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
              bcc: ['info@decaminoservicios.com', 'mirisjm@gmail.com'],
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
              bcc: ['info@decaminoservicios.com'],
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
  async sendEmailToEmpleado(@Body() body: any) {
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

      let emailRecipients: Array<{ email: string; nombre: string }> = [];

      if (destinatar === 'angajat' && codigo) {
        // Trimite la un angajat specific
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        const email =
          empleado['CORREO ELECTRONICO'] || empleado.CORREO_ELECTRONICO;
        const nombre =
          empleado['NOMBRE / APELLIDOS'] ||
          empleado.NOMBRE_APELLIDOS ||
          empleado.CODIGO;

        if (!email) {
          throw new BadRequestException(
            `Angajatul ${codigo} nu are email configurat`,
          );
        }

        emailRecipients = [{ email, nombre }];
      } else if (grup) {
        // Trimite la toți angajații dintr-un grup
        const empleados = await this.empleadosService.getAllEmpleados();
        const empleadosGrupo = empleados.filter(
          (e) =>
            (e.GRUPO || e.grupo) === grup &&
            (e.ESTADO || e.estado) === 'ACTIVO',
        );

        emailRecipients = empleadosGrupo
          .map((e) => ({
            email: e['CORREO ELECTRONICO'] || e.CORREO_ELECTRONICO,
            nombre: e['NOMBRE / APELLIDOS'] || e.NOMBRE_APELLIDOS || e.CODIGO,
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
      // Folosim secvențial cu delay pentru a nu suprasolicita SMTP (similar cu n8n)
      for (let i = 0; i < emailRecipients.length; i++) {
        const recipient = emailRecipients[i];

        // Template email identic cu n8n
        const html = `
          <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <p>Hola ${recipient.nombre},</p>
              <div style="white-space: pre-wrap;">
                ${mesaj.replace(/\n/g, '<br>')}
              </div>
              <p>Atentamente:<br>
              <strong>RRHH</strong><br>
              DE CAMINO SERVICIOS AUXILIARES SL</p>
            </body>
          </html>
        `;

        try {
          await this.emailService.sendEmail(recipient.email, subiect, html, {
            bcc: ['decamino.rrhh@gmail.com'],
          });
          this.logger.log(
            `✅ Email ${i + 1}/${emailRecipients.length} trimis către ${recipient.email} (${recipient.nombre})`,
          );

          // Delay între email-uri (500ms) pentru a nu suprasolicita SMTP
          if (i < emailRecipients.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului către ${recipient.email}:`,
            error,
          );
          // Continuă cu următorul email chiar dacă unul a eșuat
        }
      }

      this.logger.log(
        `✅ Email trimis către ${emailRecipients.length} destinatari`,
      );

      return {
        success: true,
        message: `Email trimis către ${emailRecipients.length} destinatari`,
        destinatari: emailRecipients.length,
      };
    } catch (error: any) {
      this.logger.error('❌ Error sending email:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al enviar email: ${error.message}`);
    }
  }
}
