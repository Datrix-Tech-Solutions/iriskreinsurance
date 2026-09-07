/**
 * One-time backfill: AES-256-GCM encrypt the 10 Phase 1 Employee PII fields
 * and populate emailHash for all existing employees.
 *
 * Usage:
 *   FIELD_ENCRYPTION_KEY=<64-hex> FIELD_HMAC_KEY=<64-hex> \
 *     npx ts-node -r tsconfig-paths/register \
 *     apps/hr-service/src/scripts/encrypt-employee-fields.ts
 *
 * The script is idempotent: already-encrypted values are detected and skipped.
 * If any field remains plaintext after its update, a warning is emitted and the
 * process exits with code 1 so CI / deployment pipelines can catch it.
 *
 * Generate keys:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { PrismaClient } from '../../prisma/generated/client';
import * as crypto from 'crypto';

// ── Crypto constants ────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 16;
const AUTH_TAG_BYTES = 16;
const KEY_HEX_LENGTH = 64;
const HEX_RE = /^[0-9a-fA-F]+$/;

// ── Field list ───────────────────────────────────────────────────────────────

const SENSITIVE_FIELDS = [
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

type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

type EmployeeRow = {
  id: string;
  email: string;
  emailHash: string | null;
} & Record<SensitiveField, string | null>;

// ── Crypto helpers ───────────────────────────────────────────────────────────

function assertValidKeyHex(value: string | undefined, name: string): Buffer {
  if (!value) throw new Error(`${name} env var is not set`);
  if (value.length !== KEY_HEX_LENGTH || !HEX_RE.test(value)) {
    throw new Error(
      `${name} must be exactly ${KEY_HEX_LENGTH} valid hex characters (32 bytes)`,
    );
  }
  return Buffer.from(value, 'hex');
}

function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  return iv.length === IV_BYTES && authTag.length === AUTH_TAG_BYTES;
}

function encrypt(value: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function computeHmac(value: string, key: Buffer): string {
  return crypto
    .createHmac('sha256', key)
    .update(value.toLowerCase().trim(), 'utf8')
    .digest('hex');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const encKey = assertValidKeyHex(
    process.env.FIELD_ENCRYPTION_KEY,
    'FIELD_ENCRYPTION_KEY',
  );
  const hmacKey = assertValidKeyHex(
    process.env.FIELD_HMAC_KEY,
    'FIELD_HMAC_KEY',
  );

  const prisma = new PrismaClient();

  const total = await prisma.employee.count();
  console.log(`Backfill starting: ${total} employee records`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let warnings = 0;
  const BATCH = 100;

  let cursor: string | undefined;

  for (;;) {
    const batch = (await prisma.employee.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        emailHash: true,
        phone: true,
        address: true,
        emergencyName: true,
        emergencyPhone: true,
        bankName: true,
        bankAccountNumber: true,
        bankBranch: true,
        nationalId: true,
        ssnit: true,
        tinNumber: true,
      },
    })) as EmployeeRow[];

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const employee of batch) {
      processed++;

      const updateData: Record<string, string | null> = {};

      for (const field of SENSITIVE_FIELDS) {
        const value = employee[field];
        if (value == null) continue;
        if (!isEncrypted(value)) {
          updateData[field] = encrypt(value, encKey);
        }
      }

      if (!employee.emailHash) {
        updateData['emailHash'] = computeHmac(employee.email, hmacKey);
      }

      if (Object.keys(updateData).length === 0) {
        skipped++;
        continue;
      }

      await prisma.employee.update({
        where: { id: employee.id },
        data: updateData,
      });
      updated++;

      // Verify: re-read the updated row and warn about any non-null field still in plaintext.
      // This catches false-positives in isEncrypted() or any unexpected edge case.
      const check = (await prisma.employee.findUniqueOrThrow({
        where: { id: employee.id },
        select: {
          phone: true,
          address: true,
          emergencyName: true,
          emergencyPhone: true,
          bankName: true,
          bankAccountNumber: true,
          bankBranch: true,
          nationalId: true,
          ssnit: true,
          tinNumber: true,
        },
      })) as Record<SensitiveField, string | null>;

      const stillPlaintext = SENSITIVE_FIELDS.filter((f) => {
        const v = check[f];
        return v != null && !isEncrypted(v);
      });

      if (stillPlaintext.length > 0) {
        console.warn(
          `[WARN] employee ${employee.id}: the following fields remain plaintext after migration: ${stillPlaintext.join(', ')}`,
        );
        warnings++;
      }

      if (processed % 500 === 0) {
        console.log(`  Progress: ${processed}/${total}`);
      }
    }
  }

  await prisma.$disconnect();

  console.log('');
  console.log('Backfill complete:');
  console.log(`  Total processed : ${processed}`);
  console.log(`  Updated         : ${updated}`);
  console.log(`  Already done    : ${skipped}`);

  if (warnings > 0) {
    console.warn('');
    console.warn(
      `[WARN] ${warnings} employee record(s) had one or more sensitive fields still plaintext after migration.`,
    );
    console.warn(
      'Review the warnings above, investigate the affected records, and re-run the script.',
    );
    process.exit(1);
  }
}

run().catch((err: unknown) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
