import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FieldEncryptionService } from './field-encryption.service';

const VALID_KEY = 'a'.repeat(64); // 64 hex chars, all 'a'
const VALID_HMAC = 'b'.repeat(64);

function buildService(
  keyHex = VALID_KEY,
  hmacHex = VALID_HMAC,
): FieldEncryptionService {
  const svc = new FieldEncryptionService({
    getOrThrow: (key: string) =>
      key === 'FIELD_ENCRYPTION_KEY' ? keyHex : hmacHex,
  } as unknown as ConfigService);
  svc.onModuleInit();
  return svc;
}

describe('FieldEncryptionService', () => {
  let svc: FieldEncryptionService;

  beforeEach(() => {
    svc = buildService();
  });

  describe('onModuleInit key validation', () => {
    it('throws when key is wrong length', () => {
      expect(() => buildService('abc', VALID_HMAC)).toThrow(
        'FIELD_ENCRYPTION_KEY must be exactly 64',
      );
    });

    it('throws when key contains non-hex characters', () => {
      expect(() => buildService('z'.repeat(64), VALID_HMAC)).toThrow('non-hex');
    });

    it('throws when hmac key is wrong length', () => {
      expect(() => buildService(VALID_KEY, 'abc')).toThrow(
        'FIELD_HMAC_KEY must be exactly 64',
      );
    });

    it('throws when hmac key contains non-hex characters', () => {
      expect(() => buildService(VALID_KEY, 'z'.repeat(64))).toThrow('non-hex');
    });
  });

  describe('encrypt / decrypt', () => {
    it('round-trips a string value', () => {
      const original = '+233244123456';
      expect(svc.decrypt(svc.encrypt(original) as string)).toBe(original);
    });

    it('produces a different ciphertext for the same input each call (random IV)', () => {
      const a = svc.encrypt('hello');
      const b = svc.encrypt('hello');
      expect(a).not.toBe(b);
    });

    it('returns null for null input', () => {
      expect(svc.encrypt(null)).toBeNull();
      expect(svc.decrypt(null)).toBeNull();
    });

    it('returns undefined for undefined input', () => {
      expect(svc.encrypt(undefined)).toBeUndefined();
      expect(svc.decrypt(undefined)).toBeUndefined();
    });

    it('decrypt passes through plaintext without throwing (migration safety)', () => {
      expect(svc.decrypt('GHA-12345678-0')).toBe('GHA-12345678-0');
    });

    it('throws a clean application error (not raw crypto) on tampered ciphertext', () => {
      const enc = svc.encrypt('secret') as string;
      const [iv, tag] = enc.split(':');
      const tampered = `${iv}:${tag}:${Buffer.from('tampered').toString('base64')}`;
      expect(() => svc.decrypt(tampered)).toThrow('Field decryption failed');
    });

    it('error message does not contain ciphertext when decryption fails', () => {
      const enc = svc.encrypt('secret') as string;
      const [iv, tag] = enc.split(':');
      const tampered = `${iv}:${tag}:${Buffer.from('tampered').toString('base64')}`;
      try {
        svc.decrypt(tampered);
      } catch (e) {
        expect((e as Error).message).not.toContain(tampered);
        expect((e as Error).message).not.toContain(iv);
      }
    });
  });

  describe('isEncrypted', () => {
    it('returns true for values produced by encrypt()', () => {
      expect(svc.isEncrypted(svc.encrypt('value') as string)).toBe(true);
    });

    it('returns false for plaintext phone numbers', () => {
      expect(svc.isEncrypted('+233244123456')).toBe(false);
    });

    it('returns false for a national ID', () => {
      expect(svc.isEncrypted('GHA-12345678-0')).toBe(false);
    });

    it('returns false for strings with two colons but wrong lengths', () => {
      expect(svc.isEncrypted('a:b:c')).toBe(false);
    });
  });

  describe('hmac', () => {
    it('returns a 64-char hex string', () => {
      expect(svc.hmac('test@example.com')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
      expect(svc.hmac('email@example.com')).toBe(svc.hmac('email@example.com'));
    });

    it('normalises case before hashing', () => {
      expect(svc.hmac('EMAIL@EXAMPLE.COM')).toBe(svc.hmac('email@example.com'));
    });

    it('normalises surrounding whitespace', () => {
      expect(svc.hmac('  email@example.com  ')).toBe(
        svc.hmac('email@example.com'),
      );
    });

    it('returns different digests for different inputs', () => {
      expect(svc.hmac('a@example.com')).not.toBe(svc.hmac('b@example.com'));
    });
  });

  describe('mask', () => {
    it('shows last 4 characters prefixed with ****', () => {
      expect(svc.mask('+233244123456')).toBe('****3456');
    });

    it('returns **** when value is 4 chars or fewer', () => {
      expect(svc.mask('1234')).toBe('****');
      expect(svc.mask('12')).toBe('****');
    });

    it('returns null for null input', () => {
      expect(svc.mask(null)).toBeNull();
    });
  });

  describe('encryptEmployeeFields', () => {
    it('encrypts only the 10 known sensitive fields', () => {
      const input = {
        id: 'uuid-123',
        firstName: 'Kofi',
        phone: '+233244123456',
        nationalId: 'GHA-12345678-0',
        jobTitle: 'Engineer',
      };
      const result = svc.encryptEmployeeFields(input);
      expect(result.id).toBe('uuid-123');
      expect(result.firstName).toBe('Kofi');
      expect(result.jobTitle).toBe('Engineer');
      expect(svc.isEncrypted(String(result.phone))).toBe(true);
      expect(svc.isEncrypted(String(result.nationalId))).toBe(true);
    });

    it('passes null through unchanged', () => {
      const result = svc.encryptEmployeeFields({ phone: null });
      expect(result.phone).toBeNull();
    });

    it('passes undefined through unchanged', () => {
      const result = svc.encryptEmployeeFields({ phone: undefined });
      expect(result.phone).toBeUndefined();
    });

    it('does not mutate the original object', () => {
      const input = { phone: '+233244123456' };
      svc.encryptEmployeeFields(input);
      expect(input.phone).toBe('+233244123456');
    });
  });

  describe('decryptEmployeeFields', () => {
    it('round-trips all 10 sensitive fields', () => {
      const original = {
        phone: '+233244123456',
        address: '123 Independence Ave',
        emergencyName: 'Ama Boateng',
        emergencyPhone: '+233244999888',
        bankName: 'GCB Bank',
        bankAccountNumber: '1234567890',
        bankBranch: 'Accra Main',
        nationalId: 'GHA-12345678-0',
        ssnit: 'C123456789',
        tinNumber: 'P0012345678',
      };
      const encrypted = svc.encryptEmployeeFields(original);
      const decrypted = svc.decryptEmployeeFields(encrypted);
      expect(decrypted).toMatchObject(original);
    });

    it('does not touch fields not in the encrypted list', () => {
      const input = {
        id: 'uuid',
        firstName: 'Kofi',
        phone: svc.encrypt('+233244123456') as string,
      };
      const result = svc.decryptEmployeeFields(input);
      expect(result.id).toBe('uuid');
      expect(result.firstName).toBe('Kofi');
    });

    it('passes through plaintext values (migration safety)', () => {
      expect(
        svc.decryptEmployeeFields({ nationalId: 'GHA-12345678-0' }).nationalId,
      ).toBe('GHA-12345678-0');
    });
  });

  describe('maskListFields', () => {
    it('decrypts and masks ssnit', () => {
      const encrypted = svc.encryptEmployeeFields({ ssnit: 'C123456789' });
      const result = svc.maskListFields(encrypted);
      expect(result.ssnit).toBe('****6789');
    });

    it('decrypts but does not mask phone or other encrypted fields', () => {
      const encrypted = svc.encryptEmployeeFields({
        phone: '+233244123456',
        bankAccountNumber: '1234567890',
        nationalId: 'GHA-12345678-0',
      });
      const result = svc.maskListFields(encrypted);
      expect(result.phone).toBe('+233244123456');
      expect(result.bankAccountNumber).toBe('1234567890');
      expect(result.nationalId).toBe('GHA-12345678-0');
    });

    it('passes null ssnit through as null', () => {
      const result = svc.maskListFields({ ssnit: null });
      expect(result.ssnit).toBeNull();
    });

    it('does not mutate non-encrypted fields', () => {
      const input = {
        id: 'uuid-1',
        firstName: 'Kofi',
        phone: svc.encrypt('+233244123456') as string,
      };
      const result = svc.maskListFields(input);
      expect(result.id).toBe('uuid-1');
      expect(result.firstName).toBe('Kofi');
    });
  });
});
