import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PortalJwtAuthGuard extends AuthGuard('portal-jwt') {}
