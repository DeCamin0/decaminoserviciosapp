export type StorageBody = Buffer | Uint8Array | string;

export interface PutObjectInput {
  key: string;
  body: StorageBody;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  etag?: string;
  bucket: string;
}

export interface GetObjectResult {
  key: string;
  body: Buffer;
  contentType?: string;
  contentLength?: number;
  etag?: string;
}

export interface PresignGetOptions {
  key: string;
  expiresInSeconds?: number;
}

export interface PresignPutOptions {
  key: string;
  contentType?: string;
  expiresInSeconds?: number;
}

export interface PresignedUrlResult {
  url: string;
  key: string;
  expiresInSeconds: number;
}

export interface BuildObjectKeyInput {
  app: string;
  tenant: string;
  domain: string;
  scopeId: string;
  originalName?: string;
  ext?: string;
  at?: Date;
  uuid?: string;
}

export interface StorageConfig {
  enabled: boolean;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
  publicBaseUrl: string;
  /** Comma-separated Cloudflare edge IPs when local DNS returns blocked R2 API IPs. */
  connectViaEdgeIps: string;
}
