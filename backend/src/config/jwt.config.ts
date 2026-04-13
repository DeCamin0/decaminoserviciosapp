import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const mainSecret =
    process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return {
    secret: mainSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '30m', // 30 minutes for access token
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // 7 days for refresh token
    /** JWT exclusivo del área portal clientes (no reutilizar el de empleados). */
    portalSecret:
      process.env.JWT_PORTAL_SECRET || `${mainSecret}::portal_client`,
    portalExpiresIn: process.env.JWT_PORTAL_EXPIRES_IN || '12h',
    /** Tras OTP gestores con varias comunidades: elegir cliente (JWT corto). */
    portalSelectExpiresIn: process.env.JWT_PORTAL_SELECT_EXPIRES_IN || '15m',
  };
});
