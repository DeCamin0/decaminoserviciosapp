import { Global, Module } from '@nestjs/common';
import { R2Provider } from './r2.provider';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER } from './storage-provider';

/**
 * Global storage infrastructure for Cloudflare R2.
 * Not wired into business modules yet (Nóminas, PRL, Documentos, etc.).
 */
@Global()
@Module({
  providers: [
    R2Provider,
    StorageService,
    {
      provide: STORAGE_PROVIDER,
      useExisting: R2Provider,
    },
  ],
  exports: [StorageService, R2Provider, STORAGE_PROVIDER],
})
export class StorageModule {}
