import type {
  GetObjectResult,
  PresignGetOptions,
  PresignPutOptions,
  PresignedUrlResult,
  PutObjectInput,
  PutObjectResult,
} from './storage.types';

/**
 * Abstract object-storage backend (R2 today; swap-able later).
 * Existing business modules must not call this until a later migration step.
 */
export interface StorageProvider {
  put(input: PutObjectInput): Promise<PutObjectResult>;
  get(key: string): Promise<GetObjectResult>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getPresignedGetUrl(options: PresignGetOptions): Promise<PresignedUrlResult>;
  getPresignedPutUrl(options: PresignPutOptions): Promise<PresignedUrlResult>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
