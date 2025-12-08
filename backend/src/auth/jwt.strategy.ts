import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: any) {
    // Payload contains the data we put in the token (from AuthService)
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      email: payload.email,
      userId: payload.userId,
      role: payload.role,
      grupo: payload.grupo,
    };
  }
}

