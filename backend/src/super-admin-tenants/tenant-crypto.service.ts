import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class TenantCryptoService {
  private getKey(): Buffer {
    const hex = process.env.TENANT_DB_PASSWORD_ENCRYPTION_KEY?.trim();
    if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error(
        "TENANT_DB_PASSWORD_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }
    return Buffer.from(hex, 'hex');
  }

  encrypt(plain: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(b64: string): string {
    const key = this.getKey();
    const buf = Buffer.from(b64, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      'utf8',
    );
  }
}
