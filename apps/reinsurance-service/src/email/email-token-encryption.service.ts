import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_ENV = 'REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY';

@Injectable()
export class EmailTokenEncryptionService {
  encrypt(value?: string): string | null {
    if (!value) return null;
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  decrypt(value?: string | null): string | undefined {
    if (!value) return undefined;
    const [version, iv, tag, encrypted] = value.split(':');
    if (version !== 'v1' || !iv || !tag || !encrypted) {
      throw new BadRequestException('Invalid encrypted mailbox token format');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const value = process.env[KEY_ENV];
    if (!value) {
      throw new BadRequestException(
        `${KEY_ENV} is required for mailbox tokens`,
      );
    }

    const key = /^[a-f0-9]{64}$/i.test(value)
      ? Buffer.from(value, 'hex')
      : Buffer.from(value, 'base64');

    if (key.length !== 32) {
      throw new BadRequestException(
        `${KEY_ENV} must be a 32-byte key encoded as hex or base64`,
      );
    }

    return key;
  }
}
