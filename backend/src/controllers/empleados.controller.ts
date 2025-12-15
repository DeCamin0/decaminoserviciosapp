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

@Controller('api/empleados')
export class EmpleadosController {
  private readonly logger = new Logger(EmpleadosController.name);

  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly emailService: EmailService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    const codigo = user?.userId;
    const empleado = await this.empleadosService.getEmpleadoByCodigo(codigo);
    return { success: true, empleado };
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
}
