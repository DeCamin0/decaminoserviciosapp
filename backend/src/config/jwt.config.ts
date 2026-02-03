import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '30m', // 30 minutes for access token
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // 7 days for refresh token
}));
