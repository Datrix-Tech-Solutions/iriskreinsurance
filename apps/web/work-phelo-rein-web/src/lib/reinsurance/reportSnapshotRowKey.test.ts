import type { FacultativeReinsurerBreakdown } from '@/hooks/reinsurance/useFacultativeReport';
import type { PremiumReinsurerBreakdown } from '@/hooks/reinsurance/usePremiumsReport';
import { reportSnapshotRowKey } from './reportSnapshotRowKey';

describe('reportSnapshotRowKey', () => {
  it('distinguishes Premium snapshots for the same counterparty, including a settlement-only line', () => {
    const snapshots: Pick<
      PremiumReinsurerBreakdown,
      'reinsurerId' | 'closingId' | 'netPremium' | 'paidAmount'
    >[] = [
      { reinsurerId: 're-1', closingId: 'active-1', netPremium: 100, paidAmount: 20 },
      { reinsurerId: 're-1', closingId: 'credit-1', netPremium: -40, paidAmount: 0 },
      { reinsurerId: 're-1', closingId: 'settled-1', netPremium: 0, paidAmount: 30 },
    ];
    const keys = snapshots.map((snapshot, index) =>
      reportSnapshotRowKey('placement-1', snapshot, index),
    );

    expect(new Set(keys).size).toBe(3);
    expect(keys).toEqual([
      'placement-1:re-1:closing:active-1',
      'placement-1:re-1:closing:credit-1',
      'placement-1:re-1:closing:settled-1',
    ]);
    // Real closing identity survives reordering or narrowing the displayed list.
    expect(reportSnapshotRowKey('placement-1', snapshots[2], 0)).toBe(keys[2]);
  });

  it('distinguishes Fac snapshots for the same counterparty, including a settlement-only line', () => {
    const snapshots: Pick<
      FacultativeReinsurerBreakdown,
      'reinsurerId' | 'closingId' | 'netPremiumDueReinsurer' | 'netPremiumPaid'
    >[] = [
      {
        reinsurerId: 're-1',
        closingId: 'active-1',
        netPremiumDueReinsurer: 100,
        netPremiumPaid: 20,
      },
      {
        reinsurerId: 're-1',
        closingId: 'credit-1',
        netPremiumDueReinsurer: -40,
        netPremiumPaid: 0,
      },
      {
        reinsurerId: 're-1',
        closingId: 'settled-1',
        netPremiumDueReinsurer: 0,
        netPremiumPaid: 30,
      },
    ];
    const keys = snapshots.map((snapshot, index) =>
      reportSnapshotRowKey('placement-1', snapshot, index),
    );

    expect(new Set(keys).size).toBe(3);
    expect(reportSnapshotRowKey('placement-1', snapshots[2], 0)).toBe(keys[2]);
  });

  it('uses only a presentation index for old Fac snapshots without closingId', () => {
    const snapshots: Pick<FacultativeReinsurerBreakdown, 'reinsurerId' | 'closingId'>[] = [
      { reinsurerId: 're-1' },
      { reinsurerId: 're-1' },
      { reinsurerId: 're-1', closingId: 'legacy-index:0' },
    ];
    const keys = snapshots.map((snapshot, index) =>
      reportSnapshotRowKey('placement-1', snapshot, index),
    );

    expect(new Set(keys).size).toBe(3);
    expect(keys.slice(0, 2)).toEqual([
      'placement-1:re-1:legacy-index:0',
      'placement-1:re-1:legacy-index:1',
    ]);
    expect(snapshots[0].closingId).toBeUndefined();
    expect(snapshots[1].closingId).toBeUndefined();
  });

  it('keeps the same closing distinct across placements', () => {
    const snapshot = { reinsurerId: 're-1', closingId: 'active-1' };
    expect(reportSnapshotRowKey('placement-1', snapshot, 0)).not.toBe(
      reportSnapshotRowKey('placement-2', snapshot, 0),
    );
  });
});
