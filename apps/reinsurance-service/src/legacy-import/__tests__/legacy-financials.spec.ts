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
          amount: '700.00',
          legacyParticipantId: '2001',
          participantId: 'participant-1',
          closingId: 'closing-1',
          canonicalStatus: 'BANK_CONFIRMED',
          reference: 'LEGACY-IRISK-DISBURSEMENT-2001',
        }),
      ]),
    );
  });

  it('does not subtract commission, brokerage, WHT, or NIC from reinsurer paid fac premium', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '1000.00',
      paidCommission: '100.00',
      brokeragePaid: '50.00',
      paidWht: '25.00',
      paidNic: '10.00',
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
      plan.records.find((record) => record.kind === 'REINSURER_DISBURSEMENT'),
    ).toMatchObject({ amount: '1000.00' });
  });

  it('plans only evidenced partial amounts for PARTPAYMENT', () => {
    const fixture = makeFixture({
      paymentStatus: 'PARTPAYMENT',
      currency: 'USD',
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
    ).toMatchObject({ amount: '125.25', currency: 'USD' });
    expect(
      plan.records.find((record) => record.kind === 'REINSURER_DISBURSEMENT'),
    ).toMatchObject({ amount: '125.25', currency: 'USD' });
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

  it('creates no financial records for an explicitly excluded hard-rejected offer', () => {
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
      excludedOfferIds: new Set(['1001']),
    });

    expect(plan.records).toHaveLength(0);
    expect(plan.counts.premiumReceipts.create).toBe(0);
    expect(plan.counts.reinsurerDisbursements.create).toBe(0);
    expect(plan.blockedOffers).toEqual([]);
  });

  it('continues planning financial records for non-excluded evidenced offers', () => {
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
      excludedOfferIds: new Set(['9999']),
    });

    expect(plan.counts.premiumReceipts.create).toBe(1);
    expect(plan.counts.reinsurerDisbursements.create).toBe(1);
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

  it('ignores sibling positive rows when deterministic participant rows reconcile to the offer receipt', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '300.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [
        placementRow({
          reinsurer: 'Selected Re',
          paidFacPremium: '300.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
        placementRow({
          reinsurer: 'Sibling Re',
          paidFacPremium: '200.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
      ],
      participantRows: [
        participantCrosswalk({
          sourceReinsurerRow: 1,
          matchClass: 'HIGH_CONFIDENCE',
        }),
        participantCrosswalk({
          sourceReinsurerRow: 2,
          matchClass: 'AMBIGUOUS',
          legacyParticipantId: null,
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

    expect(plan.blockedOffers).toEqual([]);
    expect(plan.counts.premiumReceipts.create).toBe(1);
    expect(plan.counts.reinsurerDisbursements.create).toBe(1);
    expect(plan.warnings).toEqual([
      'Ignored 1 unmatched manager reinsurer row(s) for offer 1001; deterministic participant rows reconcile to offer-level Paid fac premium.',
    ]);
    expect(
      plan.records.filter((record) => record.kind === 'REINSURER_DISBURSEMENT'),
    ).toEqual([
      expect.objectContaining({
        amount: '300.00',
        legacyParticipantId: '2001',
      }),
    ]);
  });

  it('blocks unresolved positive rows when deterministic rows do not explain the receipt amount', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '500.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [
        placementRow({
          reinsurer: 'Selected Re',
          paidFacPremium: '300.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
        placementRow({
          reinsurer: 'Unresolved Re',
          paidFacPremium: '200.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
      ],
      participantRows: [
        participantCrosswalk({ sourceReinsurerRow: 1, matchClass: 'EXACT' }),
        participantCrosswalk({
          sourceReinsurerRow: 2,
          matchClass: 'REVIEW',
          legacyParticipantId: null,
        }),
      ],
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
        reasons: ['non-deterministic-participant-disbursement:Unresolved Re'],
      },
    ]);
  });

  it('blocks a positive row with a conflicting non-null participant identity', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '300.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [
        placementRow({
          reinsurer: 'Selected Re',
          paidFacPremium: '300.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
        placementRow({
          reinsurer: 'Other Offer Re',
          paidFacPremium: '200.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
      ],
      participantRows: [
        participantCrosswalk({ sourceReinsurerRow: 1, matchClass: 'EXACT' }),
        participantCrosswalk({
          sourceReinsurerRow: 2,
          matchClass: 'EXACT',
          legacyOfferId: '9999',
          legacyParticipantId: '2999',
        }),
      ],
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
        reasons: ['conflicting-participant-disbursement:Other Offer Re'],
      },
    ]);
  });

  it('blocks duplicate participant mappings for one source reinsurer row', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '300.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [
        placementRow({
          reinsurer: 'Selected Re',
          paidFacPremium: '300.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
      ],
      participantRows: [
        participantCrosswalk({
          sourceReinsurerRow: 1,
          matchClass: 'EXACT',
          legacyParticipantId: '2001',
        }),
        participantCrosswalk({
          sourceReinsurerRow: 1,
          matchClass: 'EXACT',
          legacyParticipantId: '2999',
        }),
      ],
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
        reasons: ['duplicate-participant-disbursement-mapping:Selected Re'],
      },
    ]);
  });

  it('blocks deterministic participant rows when their paid sum differs from the offer receipt', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '500.00',
      paidCommission: '0',
      brokeragePaid: '0',
      placements: [
        placementRow({
          reinsurer: 'First Re',
          paidFacPremium: '300.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
        placementRow({
          reinsurer: 'Second Re',
          paidFacPremium: '100.00',
          paidCommission: '0',
          brokeragePaid: '0',
        }),
      ],
      participantRows: [
        participantCrosswalk({
          sourceReinsurerRow: 1,
          matchClass: 'EXACT',
          legacyParticipantId: '2001',
        }),
        participantCrosswalk({
          sourceReinsurerRow: 2,
          matchClass: 'EXACT',
          legacyParticipantId: '2002',
        }),
      ],
    });

    const plan = new LegacyFinancialPlanner().build({
      options: fixture.options,
      normalizedOffers: [
        {
          ...offer(),
          participants: [{ participantId: '2001' }, { participantId: '2002' }],
        } as NormalizedLegacyOffer,
      ],
      placementByOfferId: new Map([['1001', 'placement-1']]),
    });

    expect(plan.counts.premiumReceipts.create).toBe(0);
    expect(plan.counts.reinsurerDisbursements.create).toBe(0);
    expect(plan.blockedOffers).toEqual([
      {
        legacyOfferId: '1001',
        reasons: ['participant-disbursement-sum-mismatch'],
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
      amount: '700.00',
      legacyParticipantId: '2001',
    });
    expect(disbursement?.provenance.contributingRows).toEqual([
      expect.objectContaining({
        sourceReinsurerRow: 2,
        matchClass: 'EXACT',
        computedAmount: '700.00',
      }),
    ]);
  });

  it('aggregates multiple accepted manager rows into one participant disbursement', () => {
    const fixture = makeFixture({
      paymentStatus: 'PAID',
      paidFacPremium: '1000.00',
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
      amount: '1000.00',
      reference: 'LEGACY-IRISK-DISBURSEMENT-2001',
    });
    expect(disbursements[0]?.provenance.contributingRows).toEqual([
      expect.objectContaining({
        sourceReinsurerRow: 1,
        computedAmount: '700.00',
      }),
      expect.objectContaining({
        sourceReinsurerRow: 2,
        computedAmount: '300.00',
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
    ).toMatchObject({ amount: '700.00' });
    expect(plan.warnings).toEqual([
      'Duplicate manager reinsurer row ignored for offer 1001 source row 1 reinsurer row 2',
    ]);
  });
});

function makeFixture(input: {
  paymentStatus: string;
  currency?: string;
  paidFacPremium: string;
  paidCommission: string;
  brokeragePaid: string;
  paidWht?: string;
  paidNic?: string;
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
          Currency: input.currency ?? 'GHS',
          'Date Closed': '15-01-2026',
          'Payment Status': input.paymentStatus,
          'Paid fac premium': input.paidFacPremium,
          reinsurance_placements: input.placements ?? [
            placementRow({
              paidFacPremium: input.paidFacPremium,
              paidCommission: input.paidCommission,
              brokeragePaid: input.brokeragePaid,
              paidWht: input.paidWht,
              paidNic: input.paidNic,
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
  paidWht?: string;
  paidNic?: string;
}) {
  return {
    Reinsurer: input.reinsurer ?? 'Saha Re',
    'Payment Status': 'PAID',
    'Fac Sum Insured': '1000.00',
    'Fac Premium': input.paidFacPremium,
    'Paid fac premium': input.paidFacPremium,
    'Paid Commission': input.paidCommission,
    'Brokerage Paid': input.brokeragePaid,
    'Paid WHT': input.paidWht ?? '0',
    'Paid NIC': input.paidNic ?? '0',
  };
}

function participantCrosswalk(input: {
  sourceReinsurerRow: number;
  matchClass: string;
  reinsurer?: string;
  legacyOfferId?: string;
  legacyParticipantId?: string | null;
}) {
  return {
    sourceFile: 'joined_jan_2026.json',
    sourceMonth: 'jan',
    sourceRow: 1,
    sourceReinsurerRow: input.sourceReinsurerRow,
    closedDate: '2026-01-15',
    policyNumber: 'POL-1',
    reinsurer: input.reinsurer ?? 'Saha Re',
    legacyOfferId: input.legacyOfferId ?? '1001',
    legacyParticipantId:
      input.legacyParticipantId === undefined
        ? '2001'
        : input.legacyParticipantId,
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
