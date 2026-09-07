import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlacementStatus } from '../../../prisma/generated/client';
import { PlacementFinancialActivityReader } from './financial-activity.reader';
import { PlacementFinancialLockPolicy } from './financial-lock.policy';

describe('PlacementFinancialLockPolicy', () => {
  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    status: PlacementStatus.MARKETING,
  };
  let reader: Pick<PlacementFinancialActivityReader, 'findLockingActivity'> & {
    findLockingActivity: jest.Mock;
  };
  let policy: PlacementFinancialLockPolicy;

  beforeEach(() => {
    reader = {
      findLockingActivity: jest.fn().mockResolvedValue(null),
    };
    policy = new PlacementFinancialLockPolicy(
      reader as unknown as PlacementFinancialActivityReader,
    );
  });

  it('allows direct edits when no financial activity exists', async () => {
    await expect(policy.assertEditable(placement)).resolves.toBeUndefined();

    await expect(policy.evaluate(placement)).resolves.toMatchObject({
      editable: true,
      locked: false,
      endorsementRequired: false,
      lockSource: 'NONE',
    });
    expect(reader.findLockingActivity).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
  });

  it('requires endorsement when premium payment activity exists', async () => {
    reader.findLockingActivity.mockResolvedValue({
      source: 'PREMIUM_PAYMENT',
      lockedAt: new Date('2026-06-04T10:00:00.000Z'),
    });

    await expect(policy.assertEditable(placement)).rejects.toThrow(
      ConflictException,
    );
    await expect(policy.evaluate(placement)).resolves.toMatchObject({
      editable: false,
      locked: true,
      endorsementRequired: true,
      lockSource: 'PREMIUM_PAYMENT',
      lockedAt: '2026-06-04T10:00:00.000Z',
    });
  });

  it('keeps terminal lifecycle blocks distinct from financial locks', async () => {
    const closed = { ...placement, status: PlacementStatus.CLOSED };

    await expect(policy.assertEditable(closed)).rejects.toThrow(
      BadRequestException,
    );
    await expect(policy.evaluate(closed)).resolves.toMatchObject({
      editable: false,
      locked: false,
      endorsementRequired: false,
      lockSource: 'STATUS_TERMINAL',
    });
  });

  it('allows archiving a closed placement that has no financial activity', async () => {
    const closed = { ...placement, status: PlacementStatus.CLOSED };

    await expect(policy.assertArchivable(closed)).resolves.toBeUndefined();
  });

  it('blocks archiving any placement with financial activity, regardless of status', async () => {
    reader.findLockingActivity.mockResolvedValue({
      source: 'PREMIUM_PAYMENT',
      lockedAt: new Date('2026-06-04T10:00:00.000Z'),
    });
    const closed = { ...placement, status: PlacementStatus.CLOSED };

    await expect(policy.assertArchivable(closed)).rejects.toThrow(
      ConflictException,
    );
  });
});
