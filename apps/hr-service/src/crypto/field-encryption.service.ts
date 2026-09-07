import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 16;
const AUTH_TAG_BYTES = 16;
const KEY_HEX_LENGTH = 64;
const HEX_RE = /^[0-9a-fA-F]+$/;

/**
 * The 10 Employee string fields encrypted in Phase 1.
 * All are String? columns — no DB type change required.
 */
export const ENCRYPTED_EMPLOYEE_FIELDS = [
  'phone',
  'address',
  'emergencyName',
  'emergencyPhone',
  'bankName',
  'bankAccountNumber',
  'bankBranch',
  'nationalId',
  'ssnit',
  'tinNumber',
] as const;

export type EncryptedEmployeeField = (typeof ENCRYPTED_EMPLOYEE_FIELDS)[number];

@Injectable()
export class FieldEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(FieldEncryptionService.name);
  private key!: Buffer;
  private hmacKey!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const keyHex = this.config.getOrThrow<string>('FIELD_ENCRYPTION_KEY');
    const hmacHex = this.config.getOrThrow<string>('FIELD_HMAC_KEY');
    this.assertValidKeyHex(keyHex, 'FIELD_ENCRYPTION_KEY');
    this.assertValidKeyHex(hmacHex, 'FIELD_HMAC_KEY');
    this.key = Buffer.from(keyHex, 'hex');
    this.hmacKey = Buffer.from(hmacHex, 'hex');
  }

  private assertValidKeyHex(value: string, name: string): void {
    if (value.length !== KEY_HEX_LENGTH) {
      throw new Error(
        `${name} must be exactly ${KEY_HEX_LENGTH} hex characters (32 bytes), got ${value.length}`,
      );
    }
    if (!HEX_RE.test(value)) {
      throw new Error(`${name} contains non-hex characters`);
    }
  }

  /**
   * AES-256-GCM encrypt. Returns the iv:authTag:ciphertext triple as base64.
   * Preserves null and undefined so Prisma interprets them correctly:
   *   undefined → Prisma skips the field (no update)
   *   null      → Prisma sets the column to NULL
   */
  encrypt(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  /**
   * AES-256-GCM decrypt. Preserves null and undefined.
   * If value does not match the encrypted format, returns it unchanged —
   * this passthrough allows reads to work safely during and before the backfill.
   */
  decrypt(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (!this.isEncrypted(value)) return value;
    const [ivB64, authTagB64, ciphertextB64] = value.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAuthTag(authTag);
    try {
      return (
        decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
      );
    } catch {
      // Do not log ciphertext, IV, or authTag — they are encrypted data.
      this.logger.error(
        'Field decryption failed — possible key mismatch or data corruption',
      );
      throw new Error('Field decryption failed');
    }
  }

  /** HMAC-SHA256 hex digest. Input is normalised (lowercase + trim) before hashing. */
  hmac(value: string): string {
    return crypto
      .createHmac('sha256', this.hmacKey)
      .update(value.toLowerCase().trim(), 'utf8')
      .digest('hex');
  }

  /**
   * Returns true when the value matches the iv:authTag:ciphertext format
   * produced by encrypt(). Checks that the decoded IV and auth-tag lengths
   * match what AES-256-GCM requires, preventing false positives from
   * strings that happen to contain two colons.
   */
  isEncrypted(value: string): boolean {
    const parts = value.split(':');
    if (parts.length !== 3) return false;
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    return iv.length === IV_BYTES && authTag.length === AUTH_TAG_BYTES;
  }

  /**
   * Returns a masked string showing only the last 4 characters.
   * Used in list responses — the decrypted value never leaves this method.
   */
  mask(value: string | null | undefined): string | null {
    if (value == null) return null;
    return value.length <= 4 ? '****' : `****${value.slice(-4)}`;
  }

  /**
   * Encrypts all Phase 1 sensitive fields that are present as strings.
   * null → null (clear), undefined → unchanged (Prisma no-op), string → encrypted.
   */
  encryptEmployeeFields<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj } as Record<string, unknown>;
    for (const field of ENCRYPTED_EMPLOYEE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(result, field)) {
        const value = result[field];
        if (typeof value === 'string') {
          result[field] = this.encrypt(value);
        }
      }
    }
    return result as T;
  }

  /**
   * Decrypts all Phase 1 sensitive fields that are present as strings.
   * Plaintext values pass through unchanged (migration safety).
   */
  decryptEmployeeFields<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj } as Record<string, unknown>;
    for (const field of ENCRYPTED_EMPLOYEE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(result, field)) {
        const value = result[field];
        if (typeof value === 'string') {
          result[field] = this.decrypt(value);
        }
      }
    }
    return result as T;
  }

  /**
   * For list-view responses: decrypt all encrypted fields, then mask only
   * ssnit. All other encrypted fields are returned decrypted.
   */
  maskListFields<T extends Record<string, unknown>>(obj: T): T {
    const decrypted = this.decryptEmployeeFields(obj);
    const result = { ...decrypted } as Record<string, unknown>;
    for (const field of ['ssnit'] as const) {
      if (Object.prototype.hasOwnProperty.call(result, field)) {
        const value = result[field];
        if (typeof value === 'string') {
          result[field] = this.mask(value);
        }
      }
    }
    return result as T;
  }
}
