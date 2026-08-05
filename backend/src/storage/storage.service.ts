import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2Provider } from './r2.provider';
import type { StorageProvider } from './storage-provider';
import { buildObjectKey } from './object-key.util';
import type {
  BuildObjectKeyInput,
  GetObjectResult,
  PresignGetOptions,
  PresignPutOptions,
  PresignedUrlResult,
  PutObjectInput,
  PutObjectResult,
  StorageConfig,
} from './storage.types';

/**
 * Shared façade for object storage. Safe to import; no business module
 * should call it until a later migration step.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private provider: StorageProvider | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly r2Provider: R2Provider,
  ) {}

  /** True when R2_ENABLED=true and required credentials are present. */
  isEnabled(): boolean {
    const cfg = this.getConfig();
    return (
      cfg.enabled &&
      Boolean(cfg.accessKeyId) &&
      Boolean(cfg.secretAccessKey) &&
      Boolean(cfg.bucket) &&
      Boolean(cfg.endpoint)
    );
  }

  getConfig(): StorageConfig {
    return this.configService.get<StorageConfig>('storage') as StorageConfig;
  }

  buildObjectKey(input: BuildObjectKeyInput): string {
    return buildObjectKey(input);
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    return this.getProvider().put(input);
  }

  async get(key: string): Promise<GetObjectResult> {
    return this.getProvider().get(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.getProvider().exists(key);
  }

  async delete(key: string): Promise<void> {
    return this.getProvider().delete(key);
  }

  async getPresignedGetUrl(
    options: PresignGetOptions,
  ): Promise<PresignedUrlResult> {
    return this.getProvider().getPresignedGetUrl(options);
  }

  async getPresignedPutUrl(
    options: PresignPutOptions,
  ): Promise<PresignedUrlResult> {
    return this.getProvider().getPresignedPutUrl(options);
  }

  private getProvider(): StorageProvider {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Object storage (R2) is disabled or not fully configured. Set R2_ENABLED=true and R2_* credentials.',
      );
    }
    if (!this.provider) {
      this.provider = this.r2Provider;
      const cfg = this.getConfig();
      this.logger.log(
        `R2 storage ready (bucket=${cfg.bucket}, endpoint host configured)`,
      );
    }
    return this.provider;
  }
}
