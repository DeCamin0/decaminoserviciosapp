import { registerAs } from '@nestjs/config';
import type { StorageConfig } from '../storage/storage.types';

function trim(v: string | undefined): string {
  return (v ?? '').trim();
}

/**
 * Cloudflare R2 (S3-compatible). Default disabled so the app boots without R2.
 * Business modules: Fotos Trabajo + Nóminas (write when R2_ENABLED).
 */
export default registerAs('storage', (): StorageConfig => {
  const enabled = trim(process.env.R2_ENABLED).toLowerCase() === 'true';
  const accountId = trim(process.env.R2_ACCOUNT_ID);
  const accessKeyId = trim(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = trim(process.env.R2_SECRET_ACCESS_KEY);
  const bucket = trim(process.env.R2_BUCKET) || 'dc-files-prod';
  const endpoint =
    trim(process.env.R2_ENDPOINT) ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const region = trim(process.env.R2_REGION) || 'auto';
  const publicBaseUrl = trim(process.env.R2_PUBLIC_BASE_URL);

  return {
    enabled,
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region,
    publicBaseUrl,
  };
});
