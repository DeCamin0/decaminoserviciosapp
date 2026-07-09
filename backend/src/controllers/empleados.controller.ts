import {
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  ForbiddenException,
  Logger,
  Res,
  Headers,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadosService } from '../services/empleados.service';
import { EmailService } from '../services/email.service';
import { EmpleadosStatsService } from '../services/empleados-stats.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { NotificationsService } from '../services/notifications.service';
import { SentEmailsService } from '../services/sent-emails.service';
import { EmployeeExportService } from '../services/employee-export.service';
import {
  EmpleadoGrupoScopeService,
  type EmpleadoGrupoScopeFilter,
} from '../services/empleado-grupo-scope.service';

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
    private readonly employeeExportService: EmployeeExportService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
  ) {}

  private getCompany() {
    return (
      this.configService.get<{
        email?: string;
        frontendAppUrl?: string;
        legalName?: string;
        legalNameShort?: string;
        gestoriaEmail?: string;
        gestoriaCc?: string;
      }>('company') ?? {}
    );
  }

  /** CC list pentru emailuri către gestoria (din COMPANY_GESTORIA_CC, comma-separated). */
  private getGestoriaCcList(): string[] {
    const cc = (this.getCompany().gestoriaCc || '').trim();
    return cc
      ? cc
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : [];
  }

  private escapeHtmlForEmail(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Bloc HTML usuario + contraseña (bienvenida masiva, alta individual, etc.). */
  private buildCredentialsAccessHtml(
    usuario: string,
    password: string | null,
  ): string {
    const usuarioSafe = this.escapeHtmlForEmail(usuario);
    const passwordBlock = password
      ? `<p style="margin: 5px 0;"><strong>Contraseña:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: bold; color: #0066CC;">${this.escapeHtmlForEmail(password)}</code></p>
              <div style="background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin-top: 10px; border-radius: 4px;">
                <p style="margin: 5px 0; color: #856404; font-weight: bold;">⚠️ IMPORTANTE:</p>
                <p style="margin: 5px 0; color: #856404;">Te recomendamos <strong>cambiarla</strong> después del primer acceso desde la sección "Datos Personales".</p>
              </div>`
      : `<p style="margin: 5px 0;">Si no tienes contraseña asignada, solicítala por WhatsApp a un responsable autorizado de la empresa.</p>`;

    return `
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>🔐 Datos de acceso</strong></p>
              <p style="margin: 5px 0;"><strong>Usuario:</strong> ${usuarioSafe}</p>
              ${passwordBlock}
            </div>`;
  }

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization || typeof authorization !== 'string') return null;
    const t = authorization.trim();
    if (!t.toLowerCase().startsWith('bearer ')) return null;
    const token = t.slice(7).trim();
    return token || null;
  }

  /**
   * Lista GET /empleados: con Bearer válido + filas en user_empleado_grupo_scope → filtrar.
   * Sin Bearer o token inválido → lista completa (compat. n8n / llamadas legacy).
   */
  private async resolveScopeFilterFromAuthHeader(
    authorization?: string,
  ): Promise<EmpleadoGrupoScopeFilter | null> {
    const token = this.extractBearerToken(authorization);
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token) as {
        userId?: string;
        role?: string;
        grupo?: string;
      };
      return await this.empleadoGrupoScopeService.resolveScopeFilter({
        userId: payload.userId,
        role: payload.role,
        grupo: payload.grupo,
      });
    } catch {
      return null;
    }
  }

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
  async getEstadisticasEmpleados(
    @CurrentUser() user: any,
    @Query('mes') mes?: string,
  ) {
    try {
      this.logger.log(
        `📊 Get estadísticas empleados request${mes ? ` for mes: ${mes}` : ' (current month)'}`,
      );
      const scope = await this.empleadoGrupoScopeService.resolveScopeFilter({
        userId: user?.userId,
        role: user?.role,
        grupo: user?.grupo,
      });
      const estadisticas = await this.empleadosService.getEstadisticasEmpleados(
        mes,
        scope,
      );
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
  async exportEstadisticasExcel(
    @Query('mes') mes: string,
    @Res() res: any,
    @CurrentUser() user: any,
  ) {
    try {
      const scope = await this.empleadoGrupoScopeService.resolveScopeFilter({
        userId: user?.userId,
        role: user?.role,
        grupo: user?.grupo,
      });
      if (!scope) {
        await this.empleadoGrupoScopeService.assertNotMassExportRestricted({
          userId: user?.userId,
          role: user?.role,
          grupo: user?.grupo,
        });
      }
      this.logger.log(
        `📊 Export estadísticas empleados Excel request${mes ? ` for mes: ${mes}` : ''}`,
      );
      const buffer =
        await this.empleadosService.exportEstadisticasEmpleadosExcel(
          mes,
          scope,
        );

      const mesSuffix = mes ? `_${mes}` : '';
      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=Estadisticas_Empleados${mesSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`,
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error: any) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('❌ Error exporting estadísticas Excel:', error);
      throw new BadRequestException(
        `Error al exportar Excel: ${error.message}`,
      );
    }
  }

  @Get('estadisticas/export-pdf')
  @UseGuards(JwtAuthGuard)
  async exportEstadisticasPDF(
    @Query('mes') mes: string,
    @Res() res: any,
    @CurrentUser() user: any,
  ) {
    try {
      const scope = await this.empleadoGrupoScopeService.resolveScopeFilter({
        userId: user?.userId,
        role: user?.role,
        grupo: user?.grupo,
      });
      if (!scope) {
        await this.empleadoGrupoScopeService.assertNotMassExportRestricted({
          userId: user?.userId,
          role: user?.role,
          grupo: user?.grupo,
        });
      }
      this.logger.log(
        `📊 Export estadísticas empleados PDF request${mes ? ` for mes: ${mes}` : ''}`,
      );
      const buffer = await this.empleadosService.exportEstadisticasEmpleadosPDF(
        mes,
        scope,
      );

      const mesSuffix = mes ? `_${mes}` : '';
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Estadisticas_Empleados${mesSuffix}_${new Date().toISOString().split('T')[0]}.pdf`,
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error: any) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('❌ Error exporting estadísticas PDF:', error);
      throw new BadRequestException(`Error al exportar PDF: ${error.message}`);
    }
  }

  @Get('lista-iban/export-pdf')
  @UseGuards(JwtAuthGuard)
  async exportListaIbanPDF(@Res() res: any, @CurrentUser() user: any) {
    try {
      await this.empleadoGrupoScopeService.assertNotMassExportRestricted({
        userId: user?.userId,
        role: user?.role,
        grupo: user?.grupo,
      });
      this.logger.log('📄 Export lista IBAN PDF request');
      const buffer = await this.empleadosService.exportListaIbanPDF();

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Lista_IBAN_Empleados_Activos_${new Date().toISOString().split('T')[0]}.pdf`,
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error: any) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('❌ Error exporting lista IBAN PDF:', error);
      throw new BadRequestException(`Error al exportar PDF: ${error.message}`);
    }
  }

  /** Ámbito de empleados del usuario autenticado (solo lectura). */
  @Get('scope/me')
  @UseGuards(JwtAuthGuard)
  async getMyEmpleadoGrupoScope(@CurrentUser() user: any) {
    const userId = user?.userId || user?.CODIGO || '';
    const grupos =
      await this.empleadoGrupoScopeService.listGruposForUserCodigo(userId);
    return { userCodigo: userId, grupos };
  }

  /** Admin/Developer: ver ámbito de otro usuario. */
  @Get('scope/:userCodigo')
  @UseGuards(JwtAuthGuard)
  async getEmpleadoGrupoScopeForUser(
    @CurrentUser() user: any,
    @Param('userCodigo') userCodigo: string,
  ) {
    this.empleadoGrupoScopeService.assertCanManageScopesInAdmin(user);
    const grupos = await this.empleadoGrupoScopeService.listGruposForUserCodigo(
      (userCodigo || '').trim(),
    );
    return { userCodigo: (userCodigo || '').trim(), grupos };
  }

  /** Admin/Developer: reemplazar lista de GRUPO gestionables (vacío = sin restricción). */
  @Put('scope/:userCodigo')
  @UseGuards(JwtAuthGuard)
  async putEmpleadoGrupoScopeForUser(
    @CurrentUser() user: any,
    @Param('userCodigo') userCodigo: string,
    @Body() body: { grupos?: string[] },
  ) {
    this.empleadoGrupoScopeService.assertCanManageScopesInAdmin(user);
    const codigo = (userCodigo || '').trim();
    if (!codigo) {
      throw new BadRequestException('userCodigo requerido');
    }
    const grupos = Array.isArray(body?.grupos) ? body.grupos : [];
    const saved = await this.empleadoGrupoScopeService.replaceScopesForUser(
      codigo,
      grupos,
    );
    return { success: true, userCodigo: codigo, grupos: saved };
  }

  @Get()
  async getAll(@Headers('authorization') authorization?: string) {
    const scope = await this.resolveScopeFilterFromAuthHeader(authorization);
    const empleados = await this.empleadosService.getAllEmpleados(scope);
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
    @CurrentUser() user: any,
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

      const scopeFilter =
        await this.empleadoGrupoScopeService.resolveScopeFilter({
          userId: user?.userId,
          role: user?.role,
          grupo: user?.grupo,
        });
      this.empleadoGrupoScopeService.assertEmpleadoAccessible(
        scopeFilter,
        empleadoData.CODIGO,
        empleadoData.GRUPO,
      );

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
          // Pasează parola provizorie în empleadoData pentru email
          const empleadoDataWithPassword = {
            ...empleadoData,
            temporaryPassword: result.temporaryPassword || undefined, // Parola provizorie generată
          };
          this.logger.log(
            `🔍 [addEmpleado] Enviando email de bienvenida con temporaryPassword: ${empleadoDataWithPassword.temporaryPassword ? 'SÍ' : 'NO'}`,
          );
          await this.sendWelcomeEmailToEmpleado(empleadoDataWithPassword);
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
            const subject = `📋 ALTA OPERARIA/O: ${nombreEmpleado}`;
            const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #ffffff; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #f8f9fa; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .highlight { color: #4CAF50; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center; }
    .signature { margin-top: 30px; color: #555; }
    .additional-message { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">📋 ${this.getCompany().legalNameShort ?? ''}</h1>
  </div>
  
  <div class="content">
    <h2 style="color: #4CAF50; margin-top: 0;">Alta de Nuevo Empleado</h2>
    
    <p>Hola,</p>
    
    <p>Te anexo los datos correspondientes al nuevo empleado <strong class="highlight">${nombreEmpleado}</strong>.</p>
    
    <div class="info-box">
      <p style="margin: 0;">Se adjunta la ficha del empleado con toda la información correspondiente.</p>
    </div>
    
    <p>Un saludo,<br>
    <em>Feliz día 🌞</em></p>
    
    <div class="signature">
      <p style="margin: 5px 0;"><strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">Sistema de Gestión de Empleados</p>
    </div>
    
    <div class="footer">
      <p>Este es un mensaje automático del sistema. Por favor, no responda a este correo.</p>
      <p>Fecha de alta: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
  </div>
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

            // Mesaj adițional pentru gestorie (excludem parola)
            let mensajeAdicional = body.mensajeAdicionalGestoria || '';
            mensajeAdicional = mensajeAdicional.replace(
              /Contraseña[:\s]*[^\n]*/gi,
              '',
            );
            mensajeAdicional = mensajeAdicional.replace(
              /CONTRASENA[:\s]*[^\n]*/gi,
              '',
            );
            mensajeAdicional = mensajeAdicional.replace(
              /password[:\s]*[^\n]*/gi,
              '',
            );
            mensajeAdicional = mensajeAdicional.replace(
              /Password[:\s]*[^\n]*/gi,
              '',
            );

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
                '</div>\n  </div>\n</body>',
                `    <div class="additional-message">
      <h3 style="margin-top: 0; color: #2196F3;">💬 Mensaje adicional:</h3>
      <div style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${mensajeAdicional.replace(/\n/g, '<br>')}</div>
    </div>
  </div>
</body>`,
              );
            }

            if (enviarAGestoria) {
              const gestoriaTo =
                (this.getCompany().gestoriaEmail || this.getCompany().email) ??
                '';
              const gestoriaCc = this.getGestoriaCcList();
              // Dacă este bifat: trimite la gestoria cu CC și BCC (din env)
              if (attachments.length > 1) {
                await this.emailService.sendEmailWithAttachments(
                  gestoriaTo,
                  subject,
                  htmlFinal,
                  attachments,
                  {
                    ...(gestoriaCc.length > 0 && { cc: gestoriaCc }),
                    bcc: this.emailService.getDefaultBcc(),
                  },
                );
              } else {
                await this.emailService.sendEmailWithAttachment(
                  gestoriaTo,
                  subject,
                  htmlFinal,
                  pdfFile.buffer,
                  pdfFileName,
                  {
                    ...(gestoriaCc.length > 0 && { cc: gestoriaCc }),
                    bcc: this.emailService.getDefaultBcc(),
                  },
                );
              }

              this.logger.log(
                `✅ Email trimis către gestoria (${gestoriaTo}) pentru empleado ${empleadoData.CODIGO} cu ${attachments.length} attachments`,
              );

              // Salvează email-ul în BD
              try {
                const senderId = String(
                  body.createdBy ? JSON.parse(body.createdBy).nombre : 'system',
                );
                await this.sentEmailsService.saveSentEmail({
                  senderId,
                  recipientType: 'gestoria',
                  recipientEmail: gestoriaTo,
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
              // Dacă NU este bifat: trimite DOAR la company email (gestoria)
              if (attachments.length > 1) {
                // Folosește sendEmailWithAttachments pentru multiple attachments
                await this.emailService.sendEmailWithAttachments(
                  this.getCompany().email ?? '',
                  subject,
                  htmlFinal,
                  attachments,
                  {
                    bcc: this.emailService.getDefaultBcc(),
                  },
                );
              } else {
                // Folosește sendEmailWithAttachment pentru un singur attachment (PDF)
                await this.emailService.sendEmailWithAttachment(
                  this.getCompany().email ?? '',
                  subject,
                  htmlFinal,
                  pdfFile.buffer,
                  pdfFileName,
                  {
                    bcc: this.emailService.getDefaultBcc(),
                  },
                );
              }

              this.logger.log(
                `✅ Email trimis către ${this.getCompany().email ?? ''} pentru empleado ${empleadoData.CODIGO} cu ${attachments.length} attachments`,
              );

              // Salvează email-ul în BD
              try {
                const senderId = String(
                  body.createdBy ? JSON.parse(body.createdBy).nombre : 'system',
                );
                await this.sentEmailsService.saveSentEmail({
                  senderId,
                  recipientType: 'gestoria',
                  recipientEmail: this.getCompany().email ?? '',
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
        throw new BadRequestException('El PDF es obligatorio');
      }

      if (!body.CODIGO) {
        throw new BadRequestException('El CODIGO es obligatorio');
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

      // Adaugă mesajul adițional dacă există (excludem parola)
      let mensajeAdicional = body.mensajeAdicionalGestoria || '';
      // IMPORTANT: Excludem parola din mensajeAdicional pentru a nu o trimite niciodată către gestoria
      mensajeAdicional = mensajeAdicional.replace(
        /Contraseña[:\s]*[^\n]*/gi,
        '',
      );
      mensajeAdicional = mensajeAdicional.replace(
        /CONTRASENA[:\s]*[^\n]*/gi,
        '',
      );
      mensajeAdicional = mensajeAdicional.replace(/password[:\s]*[^\n]*/gi, '');
      mensajeAdicional = mensajeAdicional.replace(/Password[:\s]*[^\n]*/gi, '');

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

      const gestoriaTo =
        (this.getCompany().gestoriaEmail || this.getCompany().email) ?? '';
      const gestoriaCc = this.getGestoriaCcList();
      // Trimite la gestoria (To + CC din env)
      if (attachments.length > 1) {
        await this.emailService.sendEmailWithAttachments(
          gestoriaTo,
          subject,
          html,
          attachments,
          {
            ...(gestoriaCc.length > 0 && { cc: gestoriaCc }),
            bcc: this.emailService.getDefaultBcc(),
          },
        );
      } else {
        await this.emailService.sendEmailWithAttachment(
          gestoriaTo,
          subject,
          html,
          pdfFile.buffer,
          pdfFileName,
          {
            ...(gestoriaCc.length > 0 && { cc: gestoriaCc }),
            bcc: this.emailService.getDefaultBcc(),
          },
        );
      }

      this.logger.log(
        `✅ Ficha retrimisă către gestoria (${gestoriaTo}) pentru empleado ${body.CODIGO} cu ${attachments.length} attachments`,
      );

      // Salvează email-ul în BD
      try {
        const senderId = String(
          user?.CODIGO || user?.codigo || user?.userId || 'system',
        );
        await this.sentEmailsService.saveSentEmail({
          senderId,
          recipientType: 'gestoria',
          recipientEmail: gestoriaTo,
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

    // Log pentru debugging
    this.logger.log(
      `🔍 [sendWelcomeEmailToEmpleado] temporaryPassword: ${empleadoData.temporaryPassword ? 'SÍ (' + empleadoData.temporaryPassword.substring(0, 3) + '...)' : 'NO'}`,
    );

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

    const companyName =
      this.getCompany().legalNameShort ?? this.getCompany().legalName ?? '';
    const subject = companyName
      ? `Bienvenido/a a ${companyName} - Acceso a la aplicación interna`
      : 'Acceso a la aplicación interna';

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
            
            <p>A partir del <strong>${fechaAltaFormateada}</strong>, deberás utilizar la aplicación interna ${companyName} para todas las gestiones laborales.</p>
            
            <p><strong>El uso de la aplicación es obligatorio</strong> y sustituye completamente el uso de documentos en papel.</p>
            
            <p>La aplicación es la aplicación oficial de la empresa y se utiliza para:</p>
            
            <ul style="margin: 15px 0; padding-left: 25px;">
              <li>fichaje y registro de horas trabajadas</li>
              <li>consulta de horarios y cuadrantes</li>
              <li>solicitud de vacaciones, días libres y asunto propio</li>
              <li>acceso a documentación e información interna</li>
            </ul>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>🔐 Datos de acceso</strong></p>
              <p style="margin: 5px 0;"><strong>Usuario:</strong> ${email}</p>
              ${
                empleadoData.temporaryPassword
                  ? `
              <p style="margin: 5px 0;"><strong>Contraseña temporal:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: bold; color: #0066CC;">${empleadoData.temporaryPassword}</code></p>
              <div style="background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin-top: 10px; border-radius: 4px;">
                <p style="margin: 5px 0; color: #856404; font-weight: bold;">⚠️ IMPORTANTE:</p>
                <p style="margin: 5px 0; color: #856404;">Esta es una contraseña temporal. Por seguridad, te recomendamos <strong>cambiarla inmediatamente</strong> después de iniciar sesión por primera vez.</p>
                <p style="margin: 5px 0; color: #856404;">Puedes cambiar tu contraseña desde la sección "Datos Personales" en la aplicación.</p>
              </div>
              `
                  : `
              <p style="margin: 5px 0;">La contraseña deberá solicitarse por WhatsApp a un responsable autorizado de la empresa.</p>
              `
              }
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
                <a href="${this.getCompany().frontendAppUrl ?? ''}" style="color: #0066CC; font-weight: bold; font-size: 16px;">👉 ${this.getCompany().frontendAppUrl ?? ''}</a>
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
            <strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
          </body>
        </html>
      `;
    } else {
      // Email pentru înainte de 1 ianuarie (aplicația va fi disponibilă)
      html = `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p>Hola <strong>${nombre}</strong>,</p>
            
            <p>A partir del <strong>${fechaAltaFormateada}</strong>, la aplicación interna estará disponible para que puedas empezar a utilizarla.</p>
            
            <p>A partir del <strong>1 de enero</strong>, el uso de la aplicación será obligatorio y sustituirá completamente el uso de documentos en papel.</p>
            
            <p>La aplicación es la aplicación oficial de la empresa y se utilizará para:</p>
            
            <ul style="margin: 15px 0; padding-left: 25px;">
              <li>fichaje y registro de horas trabajadas</li>
              <li>consulta de horarios y cuadrantes</li>
              <li>solicitud de vacaciones, días libres y asunto propio</li>
              <li>acceso a documentación e información interna</li>
            </ul>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>🔐 Datos de acceso</strong></p>
              <p style="margin: 5px 0;"><strong>Usuario:</strong> ${email}</p>
              ${
                empleadoData.temporaryPassword
                  ? `
              <p style="margin: 5px 0;"><strong>Contraseña temporal:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: bold; color: #0066CC;">${empleadoData.temporaryPassword}</code></p>
              <div style="background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin-top: 10px; border-radius: 4px;">
                <p style="margin: 5px 0; color: #856404; font-weight: bold;">⚠️ IMPORTANTE:</p>
                <p style="margin: 5px 0; color: #856404;">Esta es una contraseña temporal. Por seguridad, te recomendamos <strong>cambiarla inmediatamente</strong> después de iniciar sesión por primera vez.</p>
                <p style="margin: 5px 0; color: #856404;">Puedes cambiar tu contraseña desde la sección "Datos Personales" en la aplicación.</p>
              </div>
              `
                  : `
              <p style="margin: 5px 0;">La contraseña deberá solicitarse por WhatsApp a un responsable autorizado de la empresa.</p>
              `
              }
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
                <a href="${this.getCompany().frontendAppUrl ?? ''}" style="color: #0066CC; font-weight: bold; font-size: 16px;">👉 ${this.getCompany().frontendAppUrl ?? ''}</a>
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
            <strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
          </body>
        </html>
      `;
    }

    try {
      await this.emailService.sendEmail(email, subject, html, {
        bcc: this.emailService.getDefaultBcc(),
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

  private async sendResetPasswordEmail(empleado: any, newPassword: string) {
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        '⚠️ SMTP nu este configurat. Email-ul de resetare parolă nu va fi trimis.',
      );
      return;
    }

    const email = empleado['CORREO ELECTRONICO'] || empleado.CORREO_ELECTRONICO;
    const nombre =
      this.empleadosService.getFormattedNombre(empleado) || 'Empleado';

    if (!email || !email.trim()) {
      this.logger.warn(
        `⚠️ Angajatul ${empleado.CODIGO} nu are email configurat pentru email de resetare parolă`,
      );
      return;
    }

    const subject =
      (this.getCompany().legalNameShort ?? this.getCompany().legalName)
        ? `Contraseña restablecida - ${this.getCompany().legalNameShort ?? this.getCompany().legalName}`
        : 'Contraseña restablecida';

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Hola <strong>${nombre}</strong>,</p>
          
          <p>Se ha restablecido la contraseña de tu cuenta en la aplicación.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>🔐 Nueva contraseña temporal</strong></p>
            <p style="margin: 5px 0;"><strong>Usuario:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Contraseña:</strong> <code style="background-color: #fff; padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 16px; font-weight: bold; color: #0066CC; letter-spacing: 1px;">${newPassword}</code></p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 5px 0; color: #856404; font-weight: bold;">⚠️ IMPORTANTE:</p>
            <p style="margin: 5px 0; color: #856404;">Esta es una contraseña temporal generada por seguridad.</p>
            <p style="margin: 5px 0; color: #856404;">Te recomendamos <strong>cambiarla lo antes posible</strong> desde la sección "Datos Personales" después de iniciar sesión.</p>
          </div>
          
          <p style="margin-top: 20px;">Para acceder a la aplicación, utiliza el siguiente enlace:</p>
          <p style="margin: 10px 0; text-align: center;">
            <a href="${this.getCompany().frontendAppUrl ?? ''}" style="color: #0066CC; font-weight: bold; font-size: 16px;">${this.getCompany().frontendAppUrl ?? ''}</a>
          </p>
          
          <p style="margin-top: 20px;">Si no has solicitado este restablecimiento, por favor contacta con RRHH inmediatamente.</p>
          
          <p style="margin-top: 20px;">Saludos,<br>
          <strong>RRHH</strong><br>
          <strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
        </body>
      </html>
    `;

    try {
      await this.emailService.sendEmail(email, subject, html);

      this.logger.log(`✅ Email de resetare parolă trimis către: ${email}`);
    } catch (error: any) {
      this.logger.error(
        `❌ Error sending reset password email: ${error.message}`,
      );
      // Nu aruncăm eroarea pentru a nu bloca resetarea parolei dacă email-ul eșuează
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
        fecha_baja_programada:
          body.fecha_baja_programada || body['fecha_baja_programada'] || null,
        VACACIONES_RESTANTES_ANO_ANTERIOR:
          body.VACACIONES_RESTANTES_ANO_ANTERIOR !== undefined
            ? body.VACACIONES_RESTANTES_ANO_ANTERIOR
            : null,
        certificado_handicap_confirmado:
          body.certificado_handicap_confirmado !== undefined
            ? body.certificado_handicap_confirmado
            : null,
      };

      // Include parola doar dacă este furnizată și nu este goală
      if (includePassword) {
        empleadoData.Contraseña = contraseña;
      }

      const prevGrupo =
        empleadoAnterior?.GRUPO ?? empleadoAnterior?.grupo ?? '';
      const newGrupo =
        body.GRUPO !== undefined && body.GRUPO !== null
          ? String(body.GRUPO)
          : prevGrupo;
      const scopeFilterUpd =
        await this.empleadoGrupoScopeService.resolveScopeFilter({
          userId: user?.userId,
          role: user?.role,
          grupo: user?.grupo,
        });
      this.empleadoGrupoScopeService.assertEmpleadoAccessible(
        scopeFilterUpd,
        body.CODIGO,
        prevGrupo,
      );
      this.empleadoGrupoScopeService.assertEmpleadoAccessible(
        scopeFilterUpd,
        body.CODIGO,
        newGrupo,
      );

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
        const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
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
        // IMPORTANT: Excludem parola din emailBody pentru a nu o trimite niciodată către gestoria
        let emailBody =
          body.emailBody ||
          body.mesaj ||
          'Se ha actualizado la información del empleado.';

        // Elimină orice referință la parolă din emailBody
        emailBody = emailBody.replace(/Contraseña[:\s]*[^\n]*/gi, '');
        emailBody = emailBody.replace(/CONTRASENA[:\s]*[^\n]*/gi, '');
        emailBody = emailBody.replace(/password[:\s]*[^\n]*/gi, '');
        emailBody = emailBody.replace(/Password[:\s]*[^\n]*/gi, '');

        const emailSubject =
          body.emailSubject ||
          body.subiect ||
          `Actualización de datos - ${empleadoData['NOMBRE / APELLIDOS'] || body.CODIGO || 'Empleado'}`;

        // Adaugă mesajul adițional dacă există (excludem și aici parola)
        let mensajeAdicional = body.mensajeAdicionalGestoria || '';
        mensajeAdicional = mensajeAdicional.replace(
          /Contraseña[:\s]*[^\n]*/gi,
          '',
        );
        mensajeAdicional = mensajeAdicional.replace(
          /CONTRASENA[:\s]*[^\n]*/gi,
          '',
        );
        mensajeAdicional = mensajeAdicional.replace(
          /password[:\s]*[^\n]*/gi,
          '',
        );
        mensajeAdicional = mensajeAdicional.replace(
          /Password[:\s]*[^\n]*/gi,
          '',
        );

        let htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #ffffff; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #f8f9fa; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .employee-info { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .highlight { color: #2196F3; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center; }
    .signature { margin-top: 30px; color: #555; }
    .additional-message { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0; border-radius: 4px; }
    pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">📋 ${this.getCompany().legalNameShort ?? ''}</h1>
  </div>
  
  <div class="content">
    <h2 style="color: #2196F3; margin-top: 0;">Actualización de Datos del Empleado</h2>
    
    <div class="employee-info">
      <p style="margin: 5px 0;"><strong>Empleado:</strong> ${this.empleadosService.getFormattedNombre(empleadoData) || body.CODIGO || 'N/A'}</p>
      <p style="margin: 5px 0;"><strong>Código:</strong> ${body.CODIGO || 'N/A'}</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${empleadoData['CORREO ELECTRONICO'] || 'N/A'}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0; color: #2196F3;">📝 Detalles de la actualización:</h3>
      <pre>${emailBody.replace(/\n/g, '<br>')}</pre>
    </div>
        `;

        // Adaugă mesajul adițional dacă există
        if (mensajeAdicional && mensajeAdicional.trim()) {
          htmlEmail += `
    <div class="additional-message">
      <h3 style="margin-top: 0; color: #2196F3;">💬 Mensaje adicional:</h3>
      <div style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${mensajeAdicional.replace(/\n/g, '<br>')}</div>
    </div>
          `;
        }

        htmlEmail += `
    <div class="signature">
      <p style="margin: 5px 0;"><strong>Actualizado por:</strong> ${body.updatedBy || 'Sistema'}</p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">Fecha: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
    
    <div class="signature">
      <p style="margin: 5px 0;"><strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">Sistema de Gestión de Empleados</p>
    </div>
    
    <div class="footer">
      <p>Este es un mensaje automático del sistema. Por favor, no responda a este correo.</p>
    </div>
  </div>
</body>
</html>
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

          const gestoriaToUpd =
            (this.getCompany().gestoriaEmail || this.getCompany().email) ?? '';
          const gestoriaCcUpd = this.getGestoriaCcList();
          // Trimite la gestoria (To + CC din env)
          if (attachments.length > 0) {
            await this.emailService.sendEmailWithAttachments(
              gestoriaToUpd,
              emailSubject,
              htmlEmail,
              attachments,
              {
                ...(gestoriaCcUpd.length > 0 && { cc: gestoriaCcUpd }),
                bcc: this.emailService.getDefaultBcc(),
              },
            );
          } else {
            await this.emailService.sendEmail(
              gestoriaToUpd,
              emailSubject,
              htmlEmail,
              {
                ...(gestoriaCcUpd.length > 0 && { cc: gestoriaCcUpd }),
                bcc: this.emailService.getDefaultBcc(),
              },
            );
          }

          this.logger.log(
            `✅ Email trimis către gestoria (${gestoriaToUpd}) pentru actualizare empleado ${body.CODIGO}`,
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
              recipientEmail: gestoriaToUpd,
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
              recipientEmail:
                (this.getCompany().gestoriaEmail || this.getCompany().email) ??
                '',
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
            '📋 Tu solicitud de actualización ha sido registrada correctamente';
          const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #ffffff; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #f8f9fa; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .employee-info { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .highlight { color: #2196F3; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center; }
    .signature { margin-top: 30px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">📋 ${this.getCompany().legalNameShort ?? ''}</h1>
  </div>
  
  <div class="content">
    <p>Estimado/a <strong>${body.NOMBRE || body.nombre || 'Empleado'}</strong>,</p>
    
    <p>Hemos recibido su solicitud de <strong class="highlight">actualización de datos</strong> y ha sido registrada correctamente en nuestro sistema.</p>
    
    <div class="info-box">
      <h3 style="margin-top: 0; color: #2196F3;">📝 Detalles de la solicitud:</h3>
      <p style="margin-bottom: 10px;"><strong>Campo a modificar:</strong> ${body.CAMPO_MODIFICADO || 'N/A'}</p>
      <p style="margin-bottom: 10px;"><strong>Valor actual:</strong> ${body.VALOR_ANTERIOR || 'N/A'}</p>
      <p style="margin: 0;"><strong>Nuevo valor solicitado:</strong> ${body.VALOR_NUEVO || 'N/A'}</p>
    </div>
    
    <p>Un supervisor revisará su solicitud en breve. Recibirá una notificación cuando se apruebe o rechace su solicitud.</p>
    
    <p>Si tiene alguna pregunta o necesita asistencia, no dude en contactarnos.</p>
    
    <div class="signature">
      <p style="margin: 5px 0;"><strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">Sistema de Gestión de Empleados</p>
    </div>
    
    <div class="footer">
      <p>Este es un mensaje automático del sistema. Por favor, no responda a este correo.</p>
      <p>Fecha de registro: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
  </div>
</body>
</html>
          `.trim();

          await this.emailService.sendEmail(
            body.CORREO_ELECTRONICO,
            subject,
            html,
            {
              bcc: this.emailService.getDefaultBcc(),
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
  async approveCambio(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `✅ Aprobare cambio pentru empleado: ${body?.codigo || body?.CODIGO || 'unknown'}, cambio ID: ${body?.id || body?.ID || 'unknown'}`,
      );

      // Validăm datele
      if (!body.id && !body.ID) {
        throw new BadRequestException('El ID del cambio es obligatorio');
      }
      if (!body.codigo && !body.CODIGO) {
        throw new BadRequestException('El CODIGO del empleado es obligatorio');
      }

      // Obține cambio-ul pentru a extrage datele necesare
      let cambioData: any = null;
      try {
        cambioData = await this.empleadosService.getCambioById(
          body.id || body.ID,
        );
        if (!cambioData) {
          throw new BadRequestException(
            `No se encontró el cambio con ID ${body.id || body.ID}`,
          );
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.warn(`⚠️ Nu s-a putut obține cambio-ul: ${error.message}`);
      }

      // Obține email-ul angajatului din cambio dacă nu este furnizat în body
      let emailEmpleado = body.email || body.CORREO_ELECTRONICO;
      if (!emailEmpleado && cambioData) {
        emailEmpleado = cambioData.CORREO_ELECTRONICO;
      }

      // Obține campo și valor din cambio dacă nu sunt furnizate în body
      const campoFromBody = body.campo || body.CAMPO_MODIFICADO;
      const valorFromBody = body.valor || body.VALOR_NUEVO;

      // Dacă nu există campo în body, folosim din cambio (nu mai aruncăm eroare)
      // approveCambio va parsea cambio.campo pentru a obține lista de câmpuri

      // Aprobă cambio-ul
      // Folosim campo și valor din body dacă există, altfel approveCambio va parsea din cambio
      const result = await this.empleadosService.approveCambio({
        id: body.id || body.ID,
        codigo: body.codigo || body.CODIGO || cambioData?.codigo || '',
        campo: campoFromBody || cambioData?.campo || '',
        valor: valorFromBody || cambioData?.valoare_noua || '',
      });

      // Trimite email către angajat dacă email este disponibil
      if (emailEmpleado && this.emailService.isConfigured()) {
        try {
          const emailDestinatario = emailEmpleado;
          const campoModificado =
            body.campo || body.CAMPO_MODIFICADO || 'el campo solicitado';
          const valorNuevo = body.valor || body.VALOR_NUEVO || 'N/A';

          const subject = '✅ Tu solicitud de cambio ha sido aprobada';
          const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #ffffff; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #f8f9fa; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .employee-info { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .highlight { color: #4CAF50; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center; }
    .signature { margin-top: 30px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">✅ ${this.getCompany().legalNameShort ?? ''}</h1>
  </div>
  
  <div class="content">
    <p>Estimado/a <strong>${body.nombre || body.NOMBRE || 'Empleado'}</strong>,</p>
    
    <p>Le informamos que su solicitud de cambio de datos ha sido <strong class="highlight">aprobada y actualizada</strong> en nuestro sistema.</p>
    
    <div class="employee-info">
      <p style="margin: 5px 0;"><strong>Empleado:</strong> ${body.nombre || body.NOMBRE || 'N/A'}</p>
      <p style="margin: 5px 0;"><strong>Código:</strong> ${body.codigo || body.CODIGO || 'N/A'}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0; color: #4CAF50;">📋 Detalles de la solicitud aprobada:</h3>
      <p style="margin-bottom: 10px;"><strong>Campo modificado:</strong> ${campoModificado}</p>
      <p style="margin: 0;"><strong>Nuevo valor:</strong> ${valorNuevo}</p>
    </div>
    
    <p>Los cambios ya están reflejados en su perfil. Puede verificar su información actualizada en la aplicación.</p>
    
    <p>Si tiene alguna pregunta o necesita asistencia, no dude en contactarnos.</p>
    
    <div class="signature">
      <p style="margin: 5px 0;"><strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">Sistema de Gestión de Empleados</p>
    </div>
    
    <div class="footer">
      <p>Este es un mensaje automático del sistema. Por favor, no responda a este correo.</p>
      <p>Fecha de aprobación: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
  </div>
</body>
</html>
          `.trim();

          // Trimite către angajat cu BCC din config (COMPANY_EMAIL_BCC)
          await this.emailService.sendEmail(
            emailDestinatario,
            subject,
            htmlEmail,
            {
              bcc: this.emailService.getDefaultBcc(),
            },
          );

          this.logger.log(
            `✅ Email de aprobare trimis către ${emailDestinatario} pentru cambio ${body.id || body.ID}`,
          );

          // Salvează email-ul în BD
          try {
            const senderId = String(
              user?.CODIGO ||
                user?.codigo ||
                user?.userId ||
                body.updatedBy ||
                'system',
            );
            const recipientCodigo =
              body.codigo || body.CODIGO || cambioData?.codigo || '';
            const recipientNombre =
              body.nombre || body.NOMBRE || cambioData?.nombre || 'Empleado';

            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType: 'empleado',
              recipientId: recipientCodigo,
              recipientEmail: emailDestinatario,
              recipientName: recipientNombre,
              subject,
              message: htmlEmail,
              status: 'sent',
            });
          } catch (saveError: any) {
            // Nu aruncăm eroarea dacă salvarea eșuează, email-ul a fost trimis
            this.logger.warn(
              `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
            );
          }
        } catch (emailError: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului de aprobare către angajat: ${emailError.message}`,
          );

          // Salvează și email-urile eșuate în BD
          try {
            const senderId = String(
              user?.CODIGO ||
                user?.codigo ||
                user?.userId ||
                body.updatedBy ||
                'system',
            );
            const recipientCodigo =
              body.codigo || body.CODIGO || cambioData?.codigo || '';
            const recipientNombre =
              body.nombre || body.NOMBRE || cambioData?.nombre || 'Empleado';

            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType: 'empleado',
              recipientId: recipientCodigo,
              recipientEmail: emailEmpleado,
              recipientName: recipientNombre,
              subject: 'Tu solicitud de cambio ha sido aprobada',
              message: '',
              status: 'failed',
              errorMessage: emailError.message || String(emailError),
            });
          } catch {
            // Ignorăm eroarea de salvare
          }
          // Nu aruncăm eroare aici, pentru că aprobarea a reușit
        }
      }

      // Trimite email la gestoria dacă este solicitat
      const enviarAGestoria =
        body.enviarAGestoria === 'true' ||
        body.enviarAGestoria === true ||
        body.enviarAGestoria === '1';

      if (enviarAGestoria && this.emailService.isConfigured()) {
        try {
          // Construiește mesajul email cu informații despre aprobare
          // IMPORTANT: Excludem parola din emailBody pentru a nu o trimite niciodată către gestoria
          let emailBody =
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

          // Elimină orice referință la parolă din emailBody
          emailBody = emailBody.replace(/Contraseña[:\s]*[^\n]*/gi, '');
          emailBody = emailBody.replace(/CONTRASENA[:\s]*[^\n]*/gi, '');
          emailBody = emailBody.replace(/password[:\s]*[^\n]*/gi, '');
          emailBody = emailBody.replace(/Password[:\s]*[^\n]*/gi, '');

          // Excludem parola și din câmpurile modificate dacă este cazul
          const campoModificado = body.campo || body.CAMPO_MODIFICADO || 'N/A';
          if (
            campoModificado.toLowerCase().includes('contraseña') ||
            campoModificado.toLowerCase().includes('contrasena') ||
            campoModificado.toLowerCase().includes('password')
          ) {
            // Nu trimitem email dacă singurul câmp modificat este parola
            this.logger.warn(
              `⚠️ Se intentó enviar email a gestoria con cambio de contraseña - BLOQUEADO para ${body.codigo || body.CODIGO}`,
            );
            return {
              success: true,
              message:
                'Cambio aprobado y actualizado correctamente (email a gestoria bloqueado - cambio de contraseña)',
              ...result,
            };
          }

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

          const gestoriaToAprob =
            (this.getCompany().gestoriaEmail || this.getCompany().email) ?? '';
          const gestoriaCcAprob = this.getGestoriaCcList();
          // Trimite la gestoria (To + CC din env)
          await this.emailService.sendEmail(
            gestoriaToAprob,
            emailSubject,
            htmlEmail,
            {
              ...(gestoriaCcAprob.length > 0 && { cc: gestoriaCcAprob }),
              bcc: this.emailService.getDefaultBcc(),
            },
          );

          this.logger.log(
            `✅ Email trimis către gestoria (${gestoriaToAprob}) pentru aprobare cambio ${body.id || body.ID}`,
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
  async rejectCambio(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `❌ Respingere cambio ID: ${body?.id || body?.ID || 'unknown'}`,
      );

      // Validăm datele
      if (!body.id && !body.ID) {
        throw new BadRequestException('El ID del cambio es obligatorio');
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

          const subject = '❌ Tu solicitud de cambio ha sido rechazada';
          const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #E53935 0%, #C62828 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #ffffff; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #f8f9fa; border-left: 4px solid #E53935; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .employee-info { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .highlight { color: #E53935; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center; }
    .signature { margin-top: 30px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">❌ ${this.getCompany().legalNameShort ?? ''}</h1>
  </div>
  
  <div class="content">
    <p>Estimado/a <strong>${body.nombre || body.NOMBRE || 'Empleado'}</strong>,</p>
    
    <p>Le informamos que su solicitud de cambio de datos ha sido <strong class="highlight">rechazada</strong>.</p>
    
    <div class="employee-info">
      <p style="margin: 5px 0;"><strong>Empleado:</strong> ${body.nombre || body.NOMBRE || 'N/A'}</p>
      <p style="margin: 5px 0;"><strong>Código:</strong> ${body.codigo || body.CODIGO || 'N/A'}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0; color: #E53935;">📋 Detalles de la solicitud:</h3>
      <p style="margin-bottom: 10px;"><strong>Campo solicitado:</strong> ${campoModificado}</p>
      ${motivoRechazo ? `<p style="margin: 0;"><strong>Motivo del rechazo:</strong><br>${motivoRechazo.replace(/\n/g, '<br>')}</p>` : '<p style="margin: 0;">No se ha especificado un motivo.</p>'}
    </div>
    
    <p>Si considera que hay un error o desea proporcionar información adicional, puede volver a enviar una nueva solicitud a través de la aplicación.</p>
    
    <p>Si tiene alguna pregunta o necesita asistencia, no dude en contactarnos.</p>
    
    <div class="signature">
      <p style="margin: 5px 0;"><strong>${this.getCompany().legalNameShort ?? ''}</strong></p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">Sistema de Gestión de Empleados</p>
    </div>
    
    <div class="footer">
      <p>Este es un mensaje automático del sistema. Por favor, no responda a este correo.</p>
      <p>Fecha de rechazo: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
  </div>
</body>
</html>
          `.trim();

          // Trimite către angajat cu BCC din config (COMPANY_EMAIL_BCC)
          await this.emailService.sendEmail(
            emailDestinatario,
            subject,
            htmlEmail,
            {
              bcc: this.emailService.getDefaultBcc(),
            },
          );

          this.logger.log(
            `✅ Email de respingere trimis către ${emailDestinatario} pentru cambio ${body.id || body.ID}`,
          );

          // Salvează email-ul în BD
          try {
            const senderId = String(
              user?.CODIGO || user?.codigo || user?.userId || 'system',
            );
            const recipientCodigo = body.codigo || body.CODIGO || '';
            const recipientNombre = body.nombre || body.NOMBRE || 'Empleado';

            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType: 'empleado',
              recipientId: recipientCodigo,
              recipientEmail: emailDestinatario,
              recipientName: recipientNombre,
              subject,
              message: htmlEmail,
              status: 'sent',
            });
          } catch (saveError: any) {
            // Nu aruncăm eroarea dacă salvarea eșuează, email-ul a fost trimis
            this.logger.warn(
              `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
            );
          }
        } catch (emailError: any) {
          this.logger.error(
            `❌ Eroare la trimiterea email-ului de respingere: ${emailError.message}`,
          );

          // Salvează și email-urile eșuate în BD
          try {
            const senderId = String(
              user?.CODIGO || user?.codigo || user?.userId || 'system',
            );
            const recipientCodigo = body.codigo || body.CODIGO || '';
            const recipientNombre = body.nombre || body.NOMBRE || 'Empleado';

            await this.sentEmailsService.saveSentEmail({
              senderId,
              recipientType: 'empleado',
              recipientId: recipientCodigo,
              recipientEmail: body.email || body.CORREO_ELECTRONICO,
              recipientName: recipientNombre,
              subject: 'Tu solicitud de cambio ha sido rechazada',
              message: '',
              status: 'failed',
              errorMessage: emailError.message || String(emailError),
            });
          } catch {
            // Ignorăm eroarea de salvare
          }
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

      const {
        mesaj,
        subiect,
        destinatar,
        grup,
        codigo,
        includeCredentials,
        excludeAlreadySent,
      } = body;

      const shouldIncludeCredentials =
        includeCredentials === true ||
        includeCredentials === 'true' ||
        includeCredentials === '1';

      const shouldExcludeAlreadySent =
        excludeAlreadySent === true ||
        excludeAlreadySent === 'true' ||
        excludeAlreadySent === '1';

      if (!mesaj || !subiect) {
        throw new BadRequestException(
          'El mensaje y el asunto son obligatorios',
        );
      }

      // Verifică dacă SMTP este configurat
      if (!this.emailService.isConfigured()) {
        throw new BadRequestException(
          'SMTP nu este configurat. Email-ul nu poate fi trimis.',
        );
      }

      const scopeMail = await this.empleadoGrupoScopeService.resolveScopeFilter(
        {
          userId: user?.userId,
          role: user?.role,
          grupo: user?.grupo,
        },
      );

      let emailRecipients: Array<{
        email: string;
        nombre: string;
        codigo: string;
      }> = [];

      if (destinatar === 'angajat' && codigo) {
        // Trimite la un angajat specific
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        this.empleadoGrupoScopeService.assertEmpleadoAccessible(
          scopeMail,
          codigo,
          empleado?.GRUPO ?? empleado?.grupo,
        );
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
        const empleados =
          await this.empleadosService.getAllEmpleados(scopeMail);
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
            'No se encontraron empleados activos con email configurado',
          );
        }

        this.logger.log(
          `📧 Trimite email la TOȚI angajații activi: ${emailRecipients.length} destinatari`,
        );
      } else if (grup) {
        if (
          scopeMail &&
          !this.empleadoGrupoScopeService.grupoMatches(grup, scopeMail.grupos)
        ) {
          throw new ForbiddenException(
            'No puede enviar correo a un grupo fuera de su ámbito.',
          );
        }
        // Trimite la toți angajații dintr-un grup (doar cei activi)
        const empleados =
          await this.empleadosService.getAllEmpleados(scopeMail);
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
            `No se encontraron empleados activos del grupo ${grup} con email configurado`,
          );
        }
      } else {
        throw new BadRequestException(
          'destinatar și codigo sau grup sunt obligatorii',
        );
      }

      let skippedCount = 0;
      if (shouldExcludeAlreadySent) {
        const alreadySent =
          await this.sentEmailsService.getSuccessfullySentRecipientEmails(
            subiect,
            emailRecipients.map((r) => r.email),
          );
        const before = emailRecipients.length;
        emailRecipients = emailRecipients.filter(
          (r) => !alreadySent.has(r.email.trim().toLowerCase()),
        );
        skippedCount = before - emailRecipients.length;
        if (skippedCount > 0) {
          this.logger.log(
            `⏭️ Omitidos ${skippedCount} destinatarios (ya recibieron este asunto con éxito)`,
          );
        }
        if (emailRecipients.length === 0) {
          throw new BadRequestException(
            'Todos los destinatarios ya recibieron este correo con éxito. No hay nada que reenviar.',
          );
        }
      }

      // Trimite email-uri către toți destinatarii
      // Folosim secvențial cu delay pentru a nu suprasolicita SMTP
      // Pentru număr mare de destinatari, mărim delay-ul pentru a evita rate limiting
      const totalRecipients = emailRecipients.length;
      const delayMs =
        totalRecipients > 50 ? 2500 : totalRecipients > 25 ? 2000 : 1000;

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

        let credentialsHtml = '';
        if (shouldIncludeCredentials && recipient.codigo) {
          try {
            const password = await this.empleadosService.getPassword(
              recipient.codigo,
            );
            credentialsHtml = this.buildCredentialsAccessHtml(
              recipient.email,
              password,
            );
          } catch (pwdErr: any) {
            this.logger.warn(
              `⚠️ No se pudo obtener contraseña para ${recipient.codigo}: ${pwdErr.message}`,
            );
            credentialsHtml = this.buildCredentialsAccessHtml(
              recipient.email,
              null,
            );
          }
        }

        const html = `<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><p>Hola <strong>${recipient.nombre}</strong>,</p>${mesajCleaned ? `<div style="white-space: pre-wrap;">${mesajCleaned.replace(/\n/g, '<br>')}</div>` : ''}${credentialsHtml}<p><strong>Atentamente:</strong><br><strong>RRHH</strong><br><strong>${this.getCompany().legalNameShort ?? ''}</strong></p></body></html>`;

        try {
          await this.emailService.sendEmail(recipient.email, subiect, html, {
            bcc: this.emailService.getDefaultBcc(),
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
        message: `Email trimis către ${successCount} destinatari${failedCount > 0 ? ` (${failedCount} eșuate)` : ''}${skippedCount > 0 ? ` (${skippedCount} omitidos)` : ''}`,
        destinatari: totalRecipients,
        successCount,
        failedCount,
        skippedCount,
      };
    } catch (error: any) {
      this.logger.error('❌ Error sending email:', error);
      if (error instanceof ForbiddenException) throw error;
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
    @CurrentUser() user: any,
  ) {
    try {
      const codigo = (body as any).CODIGO || (body as any).codigo;
      if (!codigo) {
        throw new BadRequestException('CODIGO is required');
      }

      const empNs = await this.empleadosService.getEmpleadoByCodigo(codigo);
      const scNs = await this.empleadoGrupoScopeService.resolveScopeFilter({
        userId: user?.userId,
        role: user?.role,
        grupo: user?.grupo,
      });
      this.empleadoGrupoScopeService.assertEmpleadoAccessible(
        scNs,
        codigo,
        empNs?.GRUPO ?? empNs?.grupo,
      );

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
      if (error instanceof ForbiddenException) throw error;
      throw new BadRequestException(
        `Error al actualizar campos separados: ${error.message}`,
      );
    }
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() body: { codigo: string; oldPassword: string; newPassword: string },
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    try {
      this.logger.log(
        `📝 Change password request - CODIGO: ${body.codigo || 'missing'}`,
      );

      if (!body.codigo || !body.oldPassword || !body.newPassword) {
        throw new BadRequestException(
          'CODIGO, oldPassword y newPassword son obligatorios',
        );
      }

      // Verifică că utilizatorul își schimbă propria parolă sau este manager
      const userCodigo = user?.userId || user?.CODIGO;
      const isManager = user?.isManager || false;

      if (body.codigo !== userCodigo && !isManager) {
        throw new BadRequestException(
          'No tienes permiso para cambiar la contraseña de otro usuario',
        );
      }

      const result = await this.empleadosService.changePassword(
        body.codigo,
        body.oldPassword,
        body.newPassword,
      );

      // Trimite email de notificare către COMPANY_EMAIL (din config)
      if (result.success && this.emailService.isConfigured()) {
        try {
          // Obține informații despre angajat
          const empleado = await this.empleadosService.getEmpleadoByCodigo(
            body.codigo,
          );
          const nombreEmpleado =
            this.empleadosService.getFormattedNombre(empleado) || body.codigo;

          // Obține IP-ul clientului
          const clientIp =
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            req.ip ||
            'Desconocido';

          // Obține ora curentă
          const fechaHora = new Date().toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const subject = `Notificación: Cambio de contraseña - ${nombreEmpleado}`;
          const htmlEmail = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0066CC;">Notificación de Cambio de Contraseña</h2>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Empleado:</strong> ${nombreEmpleado}</p>
                <p style="margin: 5px 0;"><strong>Código:</strong> ${body.codigo}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${empleado['CORREO ELECTRONICO'] || empleado.CORREO_ELECTRONICO || 'N/A'}</p>
              </div>
              <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #0066CC; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Fecha y hora:</strong> ${fechaHora}</p>
                <p style="margin: 5px 0;"><strong>Ubicación (IP):</strong> ${clientIp}</p>
                <p style="margin-top: 15px;">
                  El empleado <strong>${nombreEmpleado}</strong> (Código: ${body.codigo}) ha cambiado su contraseña exitosamente.
                </p>
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Este es un mensaje automático del sistema.<br>
                ${this.getCompany().legalNameShort ?? ''}
              </p>
            </div>
          `;

          await this.emailService.sendEmail(
            this.getCompany().email ?? '',
            subject,
            htmlEmail,
            {
              bcc: this.emailService.getDefaultBcc(),
            },
          );

          this.logger.log(
            `✅ Email de notificación de cambio de contraseña enviado a ${this.getCompany().email ?? ''} para empleado ${body.codigo}`,
          );
        } catch (emailError: any) {
          this.logger.warn(
            `⚠️ Error al enviar email de notificación de cambio de contraseña: ${emailError.message}`,
          );
          // Nu aruncăm eroare aici, pentru că schimbarea parolei a reușit
        }
      }

      // Dacă utilizatorul și-a schimbat propria parolă, trebuie să se reconecteze
      const requiresLogout = body.codigo === userCodigo;

      return {
        ...result,
        requiresLogout, // Flag pentru frontend să facă logout automat
      };
    } catch (error: any) {
      this.logger.error('❌ Error changing password:', error);
      throw error;
    }
  }

  @Get('get-password/:codigo')
  @UseGuards(JwtAuthGuard)
  async getPassword(@CurrentUser() user: any, @Param('codigo') codigo: string) {
    try {
      this.logger.log(
        `🔍 Get password request - CODIGO: ${codigo || 'missing'}`,
      );

      if (!codigo) {
        throw new BadRequestException('CODIGO es obligatorio');
      }

      // Verifică că utilizatorul este manager/admin/developer
      const isManager = user?.isManager || false;
      const isDeveloper =
        user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
      const userCodigo = user?.userId || user?.CODIGO;

      // Doar managerii, adminii și developerii pot vedea parola altor utilizatori
      if (codigo !== userCodigo && !isManager && !isDeveloper) {
        throw new BadRequestException(
          'No tienes permiso para ver la contraseña de otro usuario',
        );
      }

      if (codigo !== userCodigo) {
        const empPwd = await this.empleadosService.getEmpleadoByCodigo(codigo);
        const scPwd = await this.empleadoGrupoScopeService.resolveScopeFilter({
          userId: user?.userId,
          role: user?.role,
          grupo: user?.grupo,
        });
        this.empleadoGrupoScopeService.assertEmpleadoAccessible(
          scPwd,
          codigo,
          empPwd?.GRUPO ?? empPwd?.grupo,
        );
      }

      const password = await this.empleadosService.getPassword(codigo);

      return {
        success: true,
        password: password || '',
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting password:', error);
      throw error;
    }
  }

  @Post('reset-password/:codigo')
  @UseGuards(JwtAuthGuard)
  async resetPassword(
    @CurrentUser() user: any,
    @Param('codigo') codigo: string,
  ) {
    try {
      this.logger.log(
        `🔐 Reset password request - CODIGO: ${codigo || 'missing'}`,
      );

      if (!codigo) {
        throw new BadRequestException('CODIGO es obligatorio');
      }

      // Verifică că utilizatorul este manager/admin/developer
      const isManager = user?.isManager || false;
      const isDeveloper =
        user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
      const userCodigo = user?.userId || user?.CODIGO;

      // Doar managerii, adminii și developerii pot reseta parola altor utilizatori
      if (codigo !== userCodigo && !isManager && !isDeveloper) {
        throw new BadRequestException(
          'No tienes permiso para resetear la contraseña de otro usuario',
        );
      }

      if (codigo !== userCodigo) {
        const empRs = await this.empleadosService.getEmpleadoByCodigo(codigo);
        const scRs = await this.empleadoGrupoScopeService.resolveScopeFilter({
          userId: user?.userId,
          role: user?.role,
          grupo: user?.grupo,
        });
        this.empleadoGrupoScopeService.assertEmpleadoAccessible(
          scRs,
          codigo,
          empRs?.GRUPO ?? empRs?.grupo,
        );
      }

      // Resetare parolă și generare nouă parolă
      const result =
        await this.empleadosService.resetPasswordAndSendEmail(codigo);

      // Obține datele angajatului pentru email
      const empleado = await this.empleadosService.getEmpleadoByCodigo(codigo);
      if (!empleado) {
        throw new BadRequestException('Empleado no encontrado');
      }

      // Trimite email cu noua parolă
      await this.sendResetPasswordEmail(empleado, result.temporaryPassword);

      // Dacă parola resetată este pentru utilizatorul curent, trebuie să se reconecteze
      const requiresLogout = codigo === userCodigo;

      return {
        success: true,
        message: 'Contraseña reseteada y enviada por email exitosamente',
        temporaryPassword: result.temporaryPassword,
        requiresLogout, // Flag pentru frontend să facă logout automat
      };
    } catch (error: any) {
      this.logger.error('❌ Error resetting password:', error);
      throw error;
    }
  }

  /**
   * POST /api/empleados/confirmar-certificado-handicap
   * Confirmă certificatul de handicap pentru utilizatorul curent
   */
  @Post('confirmar-certificado-handicap')
  @UseGuards(JwtAuthGuard)
  async confirmarCertificadoHandicap(
    @Body() body: { tiene_certificado: boolean },
    @CurrentUser() user: any,
  ) {
    try {
      const codigo =
        user?.CODIGO || user?.userId || user?.empleadoId || user?.codigo;

      if (!codigo) {
        throw new BadRequestException('No se pudo identificar al usuario');
      }

      if (typeof body.tiene_certificado !== 'boolean') {
        throw new BadRequestException('tiene_certificado debe ser un booleano');
      }

      const result = await this.empleadosService.confirmarCertificadoHandicap(
        codigo,
        body.tiene_certificado,
      );

      return {
        success: true,
        message: body.tiene_certificado
          ? 'Certificado confirmado. Se ha creado automáticamente una solicitud de documento.'
          : 'Confirmación registrada correctamente.',
        documentoCreado: result.documentoCreado,
      };
    } catch (error: any) {
      this.logger.error('❌ Error confirmando certificado handicap:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al confirmar certificado: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/empleados/export-all
   * Exportă toate documentele pentru toți angajații într-un ZIP
   */
  @Get('export-all')
  @UseGuards(JwtAuthGuard)
  async exportAllEmployeesDocuments(@Res() res: any, @CurrentUser() user: any) {
    try {
      await this.empleadoGrupoScopeService.assertNotMassExportRestricted({
        userId: user?.userId,
        role: user?.role,
        grupo: user?.grupo,
      });
      this.logger.log(`📦 Export request for all employees`);

      const { stream, filename } =
        await this.employeeExportService.exportAllEmployeesDocuments();

      // Setează headers pentru descărcare
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      // Pipe stream-ul către response
      stream.pipe(res);

      this.logger.log(`✅ Export completed for all employees`);
    } catch (error: any) {
      this.logger.error(
        `❌ Error exporting all employees documents: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * GET /api/empleados/:codigo/export
   * Exportă toate documentele unui angajat într-un ZIP
   */
  @Get(':codigo/export')
  @UseGuards(JwtAuthGuard)
  async exportEmployeeDocuments(
    @Param('codigo') codigo: string,
    @Res() res: any,
    @CurrentUser() user: any,
  ) {
    try {
      const emp = await this.empleadosService.getEmpleadoByCodigo(codigo);
      const scopeOne = await this.empleadoGrupoScopeService.resolveScopeFilter({
        userId: user?.userId,
        role: user?.role,
        grupo: user?.grupo,
      });
      this.empleadoGrupoScopeService.assertEmpleadoAccessible(
        scopeOne,
        codigo,
        emp?.GRUPO ?? emp?.grupo,
      );
      this.logger.log(`📦 Export request for empleado: ${codigo}`);

      const { stream, filename } =
        await this.employeeExportService.exportEmployeeDocuments(codigo);

      // Setează headers pentru descărcare
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      // Pipe stream-ul către response
      stream.pipe(res);

      this.logger.log(`✅ Export completed for empleado: ${codigo}`);
    } catch (error: any) {
      this.logger.error(
        `❌ Error exporting employee documents: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Preview: Procesează PDF-ul SOPORTE și returnează asocieri propuse
   */
  @Post('iban/preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('pdf'))
  async previewActualizacionIbans(
    @UploadedFile() file: Express.Multer.File,

    @CurrentUser() _user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó archivo PDF');
      }

      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('El archivo debe ser un PDF');
      }

      this.logger.log(`📄 Procesando PDF SOPORTE para preview de IBANs...`);

      const resultado = await this.empleadosService.procesarPdfSoportePreview(
        file.buffer,
      );

      return {
        success: true,
        ...resultado,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error en preview de IBANs: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error procesando PDF: ${error.message}`);
    }
  }

  /**
   * Confirma și actualizează IBAN-urile în baza de date
   */
  @Post('iban/confirmar')
  @UseGuards(JwtAuthGuard)
  async confirmarActualizacionIbans(
    @Body() body: { actualizaciones: Array<{ codigo: string; iban: string }> },
    @CurrentUser() user: any,
  ) {
    try {
      if (!body.actualizaciones || !Array.isArray(body.actualizaciones)) {
        throw new BadRequestException('Se requiere array de actualizaciones');
      }

      if (body.actualizaciones.length === 0) {
        throw new BadRequestException('No hay actualizaciones para confirmar');
      }

      this.logger.log(
        `💾 Confirmando ${body.actualizaciones.length} actualizaciones de IBANs...`,
      );

      const resultado = await this.empleadosService.confirmarActualizacionIbans(
        body.actualizaciones,
        user?.userId || 'system',
      );

      return {
        success: true,
        ...resultado,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error confirmando actualización de IBANs: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error confirmando actualización: ${error.message}`,
      );
    }
  }
}
