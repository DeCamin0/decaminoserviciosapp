import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import { PRL_MATRIX_SHARE_TYP } from '../auth/prl-matrix-share.guard';
import { PrlDocumentsService } from './prl-documents.service';
import { DiplomasService } from './diplomas.service';

@Injectable()
export class PrlMatrixShareService {
  private readonly logger = new Logger(PrlMatrixShareService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prlDocumentsService: PrlDocumentsService,
    private readonly diplomasService: DiplomasService,
  ) {}

  isEnabled(): boolean {
    return (
      String(
        this.configService.get<string>('PRL_MATRIX_SHARE_ENABLED') || '',
      ).toLowerCase() === 'true'
    );
  }

  getDisplayName(): string {
    return (
      String(
        this.configService.get<string>('PRL_MATRIX_SHARE_DISPLAY_NAME') || '',
      ).trim() || 'Ancara talent development SL'
    );
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Acceso matrix share no disponible');
    }
  }

  private getPasswordHash(): string {
    return String(
      this.configService.get<string>('PRL_MATRIX_SHARE_PASSWORD_HASH') || '',
    ).trim();
  }

  async login(passwordRaw: string): Promise<{
    access_token: string;
    displayName: string;
    expiresIn: string;
  }> {
    this.assertEnabled();

    const hash = this.getPasswordHash();
    if (!hash) {
      this.logger.error(
        'PRL_MATRIX_SHARE_PASSWORD_HASH no configurado — share deshabilitado en runtime',
      );
      throw new ServiceUnavailableException(
        'Acceso temporalmente no configurado',
      );
    }

    const password = String(passwordRaw || '').trim();
    if (!password) {
      throw new BadRequestException('Contraseña requerida');
    }

    let ok = false;
    try {
      ok = await bcrypt.compare(password, hash);
    } catch (e: any) {
      this.logger.error(`bcrypt.compare failed: ${e?.message || e}`);
      throw new ServiceUnavailableException('Error verificando contraseña');
    }

    if (!ok) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    const displayName = this.getDisplayName();
    const expiresIn = (this.configService.get<string>(
      'PRL_MATRIX_SHARE_JWT_EXPIRES_IN',
    ) || '12h') as StringValue;

    const access_token = this.jwtService.sign(
      {
        typ: PRL_MATRIX_SHARE_TYP,
        scope: 'prl_matrix_readonly',
        displayName,
        sub: 'prl-matrix-share',
      },
      { expiresIn },
    );

    this.logger.log(`✅ Matrix share login OK — ${displayName}`);

    return { access_token, displayName, expiresIn };
  }

  async getMatrix() {
    this.assertEnabled();
    const empleados =
      await this.prlDocumentsService.listarEmpleadosConDocumentosPRL();
    return {
      success: true,
      /** Solo puede: procesado + subir diploma + asignar cita RM */
      allowed_actions: ['procesado', 'subir_diploma', 'asignar_cita'] as const,
      displayName: this.getDisplayName(),
      empleados,
    };
  }

  async setProcesado(empleadoId: string, procesado: boolean) {
    this.assertEnabled();
    return this.prlDocumentsService.setEmpleadoProcesado(
      empleadoId,
      procesado,
      `share:${this.getDisplayName()}`,
    );
  }

  async asignarRmCita(documentoId: number, fecha: string, hora: string) {
    this.assertEnabled();
    return this.prlDocumentsService.asignarRmCita(
      documentoId,
      fecha,
      hora,
      `share:${this.getDisplayName()}`,
    );
  }

  async uploadDiploma(
    empleadoId: string,
    file: { buffer: Buffer; originalname?: string },
  ) {
    this.assertEnabled();
    return this.diplomasService.uploadDiplomaEmpleado(
      empleadoId,
      file,
      `share:${this.getDisplayName()}`,
    );
  }
}
