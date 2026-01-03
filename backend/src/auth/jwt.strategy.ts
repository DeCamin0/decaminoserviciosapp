import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  /**
   * Calculează un hash simplu al parolei pentru a invalida token-urile când se schimbă parola
   */
  private getPasswordHash(password: string): string {
    if (!password || password.length === 0) return '';
    const firstChar = password[0] || '';
    const lastChar = password[password.length - 1] || '';
    const length = password.length;
    return `${firstChar}${lastChar}${length}`.substring(0, 10);
  }

  async validate(payload: any) {
    // Payload contains the data we put in the token (from AuthService)
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid token');
    }

    // Verifică dacă parola a fost schimbată după emiterea token-ului
    // Dacă passwordHash din token nu corespunde cu parola actuală, token-ul este invalid
    if (payload.passwordHash) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { CODIGO: payload.userId },
          select: { CONTRASENA: true, DNI_NIE: true },
        });

        if (user) {
          // Folosim aceeași logică ca la login: contraseña dacă există și nu e goală, altfel DNI_NIE
          const contraseñaPassword = String(user.CONTRASENA || '').trim();
          const dniPassword = String(user.DNI_NIE || '').trim();
          const currentPassword = contraseñaPassword || dniPassword;
          const currentPasswordHash = this.getPasswordHash(currentPassword);
          
          // Dacă hash-ul parolei din token nu corespunde cu hash-ul parolei actuale,
          // înseamnă că parola a fost schimbată și token-ul este invalid
          if (payload.passwordHash !== currentPasswordHash) {
            throw new UnauthorizedException(
              'Token invalidado: la contraseña ha sido cambiada. Por favor, inicia sesión nuevamente.',
            );
          }
        }
      } catch (error: any) {
        // Dacă este UnauthorizedException, aruncă-l mai departe
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        // Pentru alte erori (ex: user nu există), logăm dar nu invalidăm token-ul
        // pentru a nu bloca utilizatorii din cauza unor erori temporare
        console.warn('[JwtStrategy] Error validating password hash:', error.message);
      }
    }

    return {
      email: payload.email,
      userId: payload.userId,
      role: payload.role,
      grupo: payload.grupo,
    };
  }
}
