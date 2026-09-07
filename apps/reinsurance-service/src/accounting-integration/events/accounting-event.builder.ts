import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';

export const REINSURANCE_ACCOUNTING_SOURCE_MODULE = 'REINSURANCE';

const forbiddenPayloadKeys = new Set([
  'accountId',
  'chartOfAccountId',
  'creditAccountId',
  'debitAccountId',
  'glAccountId',
  'journalLine',
  'journalLines',
  'postingRuleId',
]);

export interface ReinsuranceAccountingEventInput {
  tenantId: string;
  sourceEventType: string;
  sourceRecordType: string;
  sourceRecordId: string;
  sourceDocumentId?: string | null;
  idempotencyKey: string;
  occurredAt: Date | string;
  currency: string;
  payload: Record<string, unknown>;
}

export interface AccountingSourceEventEnvelope {
  tenantId: string;
  sourceModule: typeof REINSURANCE_ACCOUNTING_SOURCE_MODULE;
  sourceEventType: string;
  sourceRecordId: string;
  sourceDocumentId?: string;
  idempotencyKey: string;
  occurredAt: string;
  currency: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class ReinsuranceAccountingEventBuilder {
  build(input: ReinsuranceAccountingEventInput): AccountingSourceEventEnvelope {
    const occurredAt = this.isoDate(input.occurredAt);
    const sourceEventType = this.cleanUppercase(
      input.sourceEventType,
      'sourceEventType',
    );
    const sourceRecordId = this.clean(input.sourceRecordId, 'sourceRecordId');
    const idempotencyKey = this.clean(input.idempotencyKey, 'idempotencyKey');
    const currency = this.cleanCurrency(input.currency);
    this.assertNoPostingInstructions(input.payload);

    return {
      tenantId: this.clean(input.tenantId, 'tenantId'),
      sourceModule: REINSURANCE_ACCOUNTING_SOURCE_MODULE,
      sourceEventType,
      sourceRecordId,
      ...(input.sourceDocumentId
        ? {
            sourceDocumentId: this.clean(
              input.sourceDocumentId,
              'sourceDocumentId',
            ),
          }
        : {}),
      idempotencyKey,
      occurredAt,
      currency,
      payload: input.payload,
    };
  }

  asOutboxCreateInput(
    input: ReinsuranceAccountingEventInput,
  ): Prisma.ReinsuranceAccountingOutboxUncheckedCreateInput {
    const envelope = this.build(input);
    return {
      tenantId: envelope.tenantId,
      sourceEventType: envelope.sourceEventType,
      sourceRecordType: this.clean(input.sourceRecordType, 'sourceRecordType'),
      sourceRecordId: envelope.sourceRecordId,
      sourceDocumentId: envelope.sourceDocumentId ?? null,
      idempotencyKey: envelope.idempotencyKey,
      occurredAt: new Date(envelope.occurredAt),
      currency: envelope.currency,
      payload: envelope.payload as Prisma.InputJsonObject,
    };
  }

  fromOutbox(row: {
    tenantId: string;
    sourceEventType: string;
    sourceRecordId: string;
    sourceDocumentId: string | null;
    idempotencyKey: string;
    occurredAt: Date;
    currency: string;
    payload: Prisma.JsonValue;
  }): AccountingSourceEventEnvelope {
    const payload = this.payloadRecord(row.payload);
    return this.build({
      tenantId: row.tenantId,
      sourceEventType: row.sourceEventType,
      sourceRecordType: 'OUTBOX',
      sourceRecordId: row.sourceRecordId,
      sourceDocumentId: row.sourceDocumentId,
      idempotencyKey: row.idempotencyKey,
      occurredAt: row.occurredAt,
      currency: row.currency,
      payload,
    });
  }

  private clean(value: string, field: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException(`${field} is required`);
    return cleaned;
  }

  private cleanUppercase(value: string, field: string): string {
    return this.clean(value, field).toUpperCase();
  }

  private cleanCurrency(value: string): string {
    const currency = this.cleanUppercase(value, 'currency');
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('currency must be a three-letter code');
    }
    return currency;
  }

  private isoDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('occurredAt must be a valid date');
    }
    return date.toISOString();
  }

  private payloadRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Accounting event payload must be an object',
      );
    }
    return value as Record<string, unknown>;
  }

  private assertNoPostingInstructions(payload: Record<string, unknown>): void {
    const visit = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}[${index}]`));
        return;
      }
      if (typeof value !== 'object' || value === null) return;

      for (const [key, child] of Object.entries(value)) {
        if (forbiddenPayloadKeys.has(key)) {
          throw new BadRequestException(
            `Accounting event payload must not include posting instruction field ${path}.${key}`,
          );
        }
        visit(child, path ? `${path}.${key}` : key);
      }
    };

    visit(payload, 'payload');
  }
}
