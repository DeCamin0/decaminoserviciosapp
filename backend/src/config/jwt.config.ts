import { registerAs } from '@nestjs/config';
import {
  assertEmployeeJwtSecret,
  assertPortalJwtSecret,
} from '../services/jwt-secret-policy';

export default registerAs('jwt', () => {
  const mainSecret = assertEmployeeJwtSecret(process.env.JWT_SECRET);
  return {
    secret: mainSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    /** JWT exclusivo del área portal clientes. Obligatoriu și diferit de JWT_SECRET. */
    portalSecret: assertPortalJwtSecret(
      process.env.JWT_PORTAL_SECRET,
      mainSecret,
    ),
    portalExpiresIn: process.env.JWT_PORTAL_EXPIRES_IN || '12h',
    /** Tras OTP gestores con varias comunidades: elegir cliente (JWT corto). */
    portalSelectExpiresIn: process.env.JWT_PORTAL_SELECT_EXPIRES_IN || '15m',
  };
});
