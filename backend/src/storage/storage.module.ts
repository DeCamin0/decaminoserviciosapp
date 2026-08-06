import { Global, Module } from '@nestjs/common';
import { R2Provider } from './r2.provider';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER } from './storage-provider';
import { EmailAttachmentsStorageService } from '../services/email-attachments-storage.service';

/**
 * Global storage infrastructure for Cloudflare R2.
 * Wired: Fotos Trabajo; Nóminas; Diplomas; Comunicados; Pedidos Notas;
 * Email attachments (sent-emails).
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
    EmailAttachmentsStorageService,
  ],
  exports: [
    StorageService,
    R2Provider,
    STORAGE_PROVIDER,
    EmailAttachmentsStorageService,
  ],
})
export class StorageModule {}
