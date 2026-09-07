import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InternalSourceEventDto } from './dto/posting.dto';

describe('InternalSourceEventDto', () => {
  const valid = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    sourceModule: 'reinsurance',
    sourceEventType: 'debit_note_issued',
    sourceRecordId: 'note-1',
    sourceDocumentId: 'document-1',
    idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
    occurredAt: '2026-07-05T10:30:00.000Z',
    currency: 'ghs',
    payload: { amounts: { netPremium: 12500 } },
  };

  it('accepts and normalizes a valid operational event', async () => {
    const dto = plainToInstance(InternalSourceEventDto, valid);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.sourceModule).toBe('REINSURANCE');
    expect(dto.sourceEventType).toBe('DEBIT_NOTE_ISSUED');
    expect(dto.currency).toBe('GHS');
  });

  it.each([
    ['tenantId', 'not-a-uuid'],
    ['occurredAt', 'not-a-date'],
    ['currency', 'GH'],
    ['payload', []],
  ])('rejects malformed %s', async (field, value) => {
    const dto = plainToInstance(InternalSourceEventDto, {
      ...valid,
      [field]: value,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
