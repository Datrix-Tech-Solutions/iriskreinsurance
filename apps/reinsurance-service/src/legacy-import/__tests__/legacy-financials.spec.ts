import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LegacyFinancialPlanner } from '../legacy-financials';
import { NormalizedLegacyOffer } from '../legacy-import.types';

describe('LegacyFinancialPlanner', () => {
  it('plans a premium receipt and reinsurer disbursement from evidenced paid components', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '700.00',
      paidCommission: '100.00',
      brokeragePaid: '50.00',
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
      participantByLegacyId: new Map([
        ['2001', { participantId: 'participant-1', closingId: 'closing-1' }],
      ]),
    });

    expect(plan.counts.premiumReceipts.create).toBe(1);
    expect(plan.counts.reinsurerDisbursements.create).toBe(1);
    expect(plan.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'PREMIUM_RECEIPT',
          amount: '700.00',
          effectiveDate: '2026-01-15',
          effectiveDateSource: 'derived_from_date_closed',
          canonicalStatus: 'BANK_CONFIRMED',
          settlementMethod: 'OTHER',
          reference: 'LEGACY-IRISK-RECEIPT-1001',
        }),
        expect.objectContaining({
          kind: 'REINSURER_DISBURSEMENT',
          amount: '550.00',
          legacyParticipantId: '2001',
          participantId: 'participant-1',
          closingId: 'closing-1',
          canonicalStatus: 'BANK_CONFIRMED',
          reference: 'LEGACY-IRISK-DISBURSEMENT-2001',
        }),
      ]),
    );
  });

  it('plans only evidenced partial amounts for PARTPAYMENT', () => {
    const fixture = makeFixture({
      paymentStatus: 'PARTPAYMENT',
      paidFacPremium: '125.25',
      paidCommission: '25.25',
      brokeragePaid: '0',
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
      participantByLegacyId: new Map([
        ['2001', { participantId: 'participant-1', closingId: 'closing-1' }],
      ]),
    });

    expect(
      plan.records.find((record) => record.kind === 'PREMIUM_RECEIPT'),
    ).toMatchObject({ amount: '125.25' });
    expect(
      plan.records.find((record) => record.kind === 'REINSURER_DISBURSEMENT'),
    ).toMatchObject({ amount: '100.00' });
  });

  it('creates no financial records for UNPAID even when zero fields are present', () => {
    const fixture = makeFixture({
      paymentStatus: 'UNPAID',
      paidFacPremium: '0',
      paidCommission: '0',
      brokeragePaid: '0',
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
    });

    expect(plan.records).toHaveLength(0);
  });

  it('skips already mapped financial records on rerun', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '700.00',
      paidCommission: '100.00',
      brokeragePaid: '50.00',
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
      participantByLegacyId: new Map([
        ['2001', { participantId: 'participant-1', closingId: 'closing-1' }],
      ]),
      existingMaps: [
        {
          entityType: 'offer_premium_receipt',
          legacyId: '1001',
          currentModel: 'PlacementPayment',
          currentId: 'payment-1',
        },
        {
          entityType: 'offer_participant_disbursement',
          legacyId: '2001',
          currentModel: 'PlacementPayment',
          currentId: 'payment-2',
        },
      ],
    });

    expect(plan.counts.premiumReceipts.skip).toBe(1);
    expect(plan.counts.reinsurerDisbursements.skip).toBe(1);
  });

  it('blocks an offer with ambiguous positive participant disbursement evidence', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '700.00',
      paidCommission: '100.00',
      brokeragePaid: '50.00',
      participantMatchClass: 'AMBIGUOUS',
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
    });

    expect(plan.counts.premiumReceipts.create).toBe(0);
    expect(plan.counts.reinsurerDisbursements.create).toBe(0);
    expect(plan.blockedOffers).toEqual([
      {
        legacyOfferId: '1001',
        reasons: ['non-deterministic-participant-disbursement:Saha Re'],
      },
    ]);
  });

  it('resolves participant evidence by source reinsurer row instead of first same-name crosswalk row', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '700.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [
        placementRow({
          paidFacPremium: '0',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
        placementRow({
          paidFacPremium: '700.00',
          paidCommission: '100.00',
          brokeragePaid: '50.00',
        }),
      ],
      participantRows: [
        participantCrosswalk({ sourceReinsurerRow: 1, matchClass: 'REVIEW' }),
        participantCrosswalk({ sourceReinsurerRow: 2, matchClass: 'EXACT' }),
      ],
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
      participantByLegacyId: new Map([
        ['2001', { participantId: 'participant-1', closingId: 'closing-1' }],
      ]),
    });

    expect(plan.blockedOffers).toEqual([]);
    expect(plan.counts.reinsurerDisbursements.create).toBe(1);
    const disbursement = plan.records.find(
      (record) => record.kind === 'REINSURER_DISBURSEMENT',
    );
    expect(disbursement).toMatchObject({
      amount: '550.00',
      legacyParticipantId: '2001',
    });
    expect(disbursement?.provenance.contributingRows).toEqual([
      expect.objectContaining({
        sourceReinsurerRow: 2,
        matchClass: 'EXACT',
        computedAmount: '550.00',
      }),
    ]);
  });

  it('aggregates multiple accepted manager rows into one participant disbursement', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '700.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [
        placementRow({
          paidFacPremium: '700.00',
          paidCommission: '100.00',
          brokeragePaid: '50.00',
        }),
        placementRow({
          paidFacPremium: '300.00',
          paidCommission: '75.00',
          brokeragePaid: '25.00',
        }),
      ],
      participantRows: [
        participantCrosswalk({ sourceReinsurerRow: 1, matchClass: 'EXACT' }),
        participantCrosswalk({
          sourceReinsurerRow: 2,
          matchClass: 'HIGH_CONFIDENCE',
        }),
      ],
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
      participantByLegacyId: new Map([
        ['2001', { participantId: 'participant-1', closingId: 'closing-1' }],
      ]),
    });

    const disbursements = plan.records.filter(
      (record) => record.kind === 'REINSURER_DISBURSEMENT',
    );
    expect(plan.blockedOffers).toEqual([]);
    expect(plan.counts.reinsurerDisbursements.create).toBe(1);
    expect(disbursements).toHaveLength(1);
    expect(disbursements[0]).toMatchObject({
      entityType: 'offer_participant_disbursement',
      legacyId: '2001',
      amount: '750.00',
      reference: 'LEGACY-IRISK-DISBURSEMENT-2001',
    });
    expect(disbursements[0]?.provenance.contributingRows).toEqual([
      expect.objectContaining({
        sourceReinsurerRow: 1,
        computedAmount: '550.00',
      }),
      expect.objectContaining({
        sourceReinsurerRow: 2,
        computedAmount: '200.00',
      }),
    ]);
  });

  it('does not double-count exact duplicate manager reinsurer rows', () => {
    const duplicate = placementRow({
      paidFacPremium: '700.00',
      paidCommission: '100.00',
      brokeragePaid: '50.00',
    });
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '700.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [duplicate, { ...duplicate }],
      participantRows: [
        participantCrosswalk({ sourceReinsurerRow: 1, matchClass: 'EXACT' }),
        participantCrosswalk({ sourceReinsurerRow: 2, matchClass: 'EXACT' }),
      ],
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [offer()],
      placementByOfferId: new Map([['1001', 'placement-1']]),
    });

    expect(plan.counts.reinsurerDisbursements.create).toBe(1);
    expect(
      plan.records.find((record) => record.kind === 'REINSURER_DISBURSEMENT'),
    ).toMatchObject({ amount: '550.00' });
    expect(plan.warnings).toEqual([
      'Duplicate manager reinsurer row ignored for offer 1001 source row 1 reinsurer row 2',
    ]);
  });
});

function makeFixture(input: {
  paymentStatus: string;
  paidFacPremium: string;
  paidCommission: string;
  brokeragePaid: string;
  participantMatchClass?: string;
  placements?: Array<Record<string, unknown>>;
  participantRows?: Array<Record<string, unknown>>;
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-financials-'));
  const sourceDir = path.join(dir, 'source');
  fs.mkdirSync(sourceDir);
  fs.writeFileSync(
    path.join(sourceDir, 'joined_jan_2026.json'),
    JSON.stringify({
      policies: [
        {
          'Policy #': 'POL-1',
          Currency: 'GHS',
          'Date Closed': '15-01-2026',
          'Payment Status': input.paymentStatus,
          'Paid fac premium': input.paidFacPremium,
          reinsurance_placements: input.placements ?? [
            placementRow({
              paidFacPremium: input.paidFacPremium,
              paidCommission: input.paidCommission,
              brokeragePaid: input.brokeragePaid,
            }),
          ],
        },
      ],
    }),
  );
  const offerCrosswalkFile = path.join(dir, 'offer-crosswalk.json');
  fs.writeFileSync(
    offerCrosswalkFile,
    JSON.stringify([
      {
        sourceFile: 'joined_jan_2026.json',
        sourceMonth: 'jan',
        sourceRow: 1,
        sourceFileRow: 1,
        closedDate: '2026-01-15',
        policyNumber: 'POL-1',
        legacyOfferId: '1001',
        matchClass: 'EXACT',
      },
    ]),
  );
  const participantCrosswalkFile = path.join(dir, 'participant-crosswalk.json');
  fs.writeFileSync(
    participantCrosswalkFile,
    JSON.stringify(
      input.participantRows ?? [
        participantCrosswalk({
          sourceReinsurerRow: 1,
          matchClass: input.participantMatchClass ?? 'EXACT',
        }),
      ],
    ),
  );
  return {
    options: { sourceDir, offerCrosswalkFile, participantCrosswalkFile },
  };
}

function placementRow(input: {
  reinsurer?: string;
  paidFacPremium: string;
  paidCommission: string;
  brokeragePaid: string;
}) {
  return {
    Reinsurer: input.reinsurer ?? 'Saha Re',
    'Payment Status': 'PAID',
    'Fac Sum Insured': '1000.00',
    'Fac Premium': input.paidFacPremium,
    'Paid fac premium': input.paidFacPremium,
    'Paid Commission': input.paidCommission,
    'Brokerage Paid': input.brokeragePaid,
    'Paid WHT': '0',
    'Paid NIC': '0',
  };
}

function participantCrosswalk(input: {
  sourceReinsurerRow: number;
  matchClass: string;
  reinsurer?: string;
  legacyParticipantId?: string;
}) {
  return {
    sourceFile: 'joined_jan_2026.json',
    sourceMonth: 'jan',
    sourceRow: 1,
    sourceReinsurerRow: input.sourceReinsurerRow,
    closedDate: '2026-01-15',
    policyNumber: 'POL-1',
    reinsurer: input.reinsurer ?? 'Saha Re',
    legacyOfferId: '1001',
    legacyParticipantId: input.legacyParticipantId ?? '2001',
    matchClass: input.matchClass,
  };
}

function offer(): NormalizedLegacyOffer {
  return {
    offerId: '1001',
    currency: 'GHS',
    participants: [{ participantId: '2001' }],
  } as NormalizedLegacyOffer;
}
