import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Super-admin: Developer grupo or email listed in SUPER_ADMIN_EMAILS (comma-separated).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { email?: string; grupo?: string } | undefined;

    const grupo = String(user?.grupo || '').trim();
    if (grupo === 'Developer') {
      return true;
    }

    const raw = process.env.SUPER_ADMIN_EMAILS || '';
    const allow = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = String(user?.email || '')
      .trim()
      .toLowerCase();
    if (allow.length > 0 && email && allow.includes(email)) {
      return true;
    }

    throw new ForbiddenException(
      'Super-admin only: Developer grupo or SUPER_ADMIN_EMAILS',
    );
  }
}
