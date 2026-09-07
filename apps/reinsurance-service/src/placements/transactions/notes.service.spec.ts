import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyOrigin,
  CounterpartyType,
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
  ReinsuranceChargeCalculationBasis,
  ReinsuranceChargeCode,
  ReinsuranceChargeDirection,
  ReinsuranceChargeRateType,
  ReinsuranceChargeRoundingMode,
  ReinsuranceChargeType,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementFinancialActivityReader } from '../finance/financial-activity.reader';
import { PlacementFinancialLockPolicy } from '../finance/financial-lock.policy';
import { PlacementNotesService } from './notes.service';
import {
  ChargeCalculationInput,
  ReinsuranceChargeSettingsService,
} from '../../settings/reinsurance-charge-settings.service';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import { PlacementFinancialPositionService } from '../finance/financial-position.service';

describe('PlacementNotesService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE' as const,
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [] as string[],
  };

  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    cedantId: 'cedant-1',
    currency: 'USD',
    cedant: {
      origin: CounterpartyOrigin.LOCAL,
    },
  };

  const foreignCedantPlacement = {
    ...placement,
    cedant: {
      origin: CounterpartyOrigin.FOREIGN,
    },
  };

  const note = {
    id: 'note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    closingId: null,
    participantId: null,
    counterpartyId: 'cedant-1',
    settledByPaymentId: null,
    type: PlacementNoteType.DEBIT_NOTE,
    direction: PlacementNoteDirection.CEDANT_TO_BROKER,
    noteNumber: 'DN-001',
    status: PlacementNoteStatus.DRAFT,
    currency: 'USD',
    grossAmount: new Prisma.Decimal('7500.00'),
    commissionPercent: null,
    commissionAmount: new Prisma.Decimal('750.00'),
    brokeragePercent: null,
    brokerageAmount: null,
    nicLevyPercent: new Prisma.Decimal('0.0000'),
    nicLevyAmount: new Prisma.Decimal('0.00'),
    withholdingTaxPercent: new Prisma.Decimal('0.0000'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    netAmount: new Prisma.Decimal('6750.00'),
    noteDate: new Date('2026-06-04T12:00:00.000Z'),
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-04T12:00:00.000Z'),
    updatedAt: new Date('2026-06-04T12:00:00.000Z'),
    counterparty: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Insurance',
      registrationNumber: null,
    },
    participant: null,
    closing: null,
    endorsementId: null,
    endorsementClosingId: null,
    endorsementParticipantId: null,
    endorsementParticipant: null,
    endorsementClosing: null,
    appliedCharges: null,
  };

  const confirmedClosing = {
    id: 'closing-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    participantId: 'participant-1',
    closingNumber: 'CLO-001',
    status: PlacementClosingStatus.CONFIRMED,
    signedLinePercent: new Prisma.Decimal('30.0000'),
    sharePercent: new Prisma.Decimal('40.0000'),
    grossPremium: new Prisma.Decimal('4500.00'),
    commissionPercent: new Prisma.Decimal('10.0000'),
    commissionAmount: new Prisma.Decimal('450.00'),
    brokeragePercent: new Prisma.Decimal('7.50'),
    brokerageAmount: new Prisma.Decimal('337.50'),
    netPremium: new Prisma.Decimal('3712.50'),
    currency: 'USD',
    issuedAt: new Date('2026-06-04T10:00:00.000Z'),
    confirmedAt: new Date('2026-06-04T11:00:00.000Z'),
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-04T09:00:00.000Z'),
    updatedAt: new Date('2026-06-04T11:00:00.000Z'),
    participant: {
      id: 'participant-1',
      counterpartyId: 'reinsurer-1',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
      },
    },
  };

  const confirmedEndorsementClosing = {
    id: 'endorsement-closing-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    endorsementId: 'endorsement-1',
    endorsementParticipantId: 'endorsement-participant-1',
    closingNumber: 'ENC-001',
    status: PlacementClosingStatus.CONFIRMED,
    signedLinePercent: new Prisma.Decimal('10.0000'),
    sharePercent: new Prisma.Decimal('10.0000'),
    sumInsuredSnapshot: new Prisma.Decimal('100000.00'),
    premiumSnapshot: new Prisma.Decimal('1500.00'),
    commissionPercent: new Prisma.Decimal('10.0000'),
    commissionAmount: new Prisma.Decimal('150.00'),
    brokeragePercent: new Prisma.Decimal('7.50'),
    brokerageAmount: new Prisma.Decimal('112.50'),
    netPremium: new Prisma.Decimal('1237.50'),
    currency: 'USD',
    issuedAt: new Date('2026-06-05T10:00:00.000Z'),
    confirmedAt: new Date('2026-06-05T11:00:00.000Z'),
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-05T09:00:00.000Z'),
    updatedAt: new Date('2026-06-05T11:00:00.000Z'),
    endorsementParticipant: {
      id: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
      },
    },
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClosing: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
    };
    placementEndorsement: { findFirst: PrismaMethod };
    placementEndorsementClosing: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
    };
    placementNote: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementPayment: { findFirst: PrismaMethod };
    $transaction: jest.Mock;
  };
  let service: PlacementNotesService;
  let lockPolicy: PlacementFinancialLockPolicy;
  let chargeSettings: {
    calculateCharges: jest.Mock;
  };
  let financialEvents: {
    assertAccountingReadyForEvent: jest.Mock;
    prepareDebitNoteIssued: jest.Mock;
    prepareCreditNoteIssued: jest.Mock;
    prepareEndorsementDebitNoteIssued: jest.Mock;
    prepareEndorsementCreditNoteIssued: jest.Mock;
    enqueuePreparedEvent: jest.Mock;
  };
  let financialPosition: { getFinancialPosition: jest.Mock };
  let effectiveView: { getEffectiveView: jest.Mock };

  const configuredChargeResult = (
    input: ChargeCalculationInput,
    charges: { nicLevyAmount?: number; withholdingTaxAmount?: number },
  ) => {
    const grossAmount = input.grossAmount;
    const commissionAmount = input.commissionAmount ?? 0;
    const brokerageAmount = input.brokerageAmount ?? 0;
    const netBeforeCharges = grossAmount - commissionAmount - brokerageAmount;
    const nicLevyAmount = charges.nicLevyAmount ?? 0;
    const withholdingTaxAmount = charges.withholdingTaxAmount ?? 0;
    const deductions = nicLevyAmount + withholdingTaxAmount;

    return {
      currency: input.currency,
      effectiveAt: (input.effectiveAt ?? new Date()).toISOString(),
      grossAmount,
      commissionAmount,
      brokerageAmount,
      netBeforeCharges,
      additions: 0,
      deductions,
      netAmount: netBeforeCharges - deductions,
      charges: [
        ...(nicLevyAmount
          ? [
              {
                configurationId: 'charge-nic',
                code: ReinsuranceChargeCode.NIC_LEVY,
                name: 'NIC Levy',
                chargeType: ReinsuranceChargeType.LEVY,
                rateType: ReinsuranceChargeRateType.PERCENTAGE,
                rate: '1',
                calculationBasis:
                  ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
                direction: ReinsuranceChargeDirection.DEDUCTION,
                currency: null,
                effectiveFrom: '2026-01-01T00:00:00.000Z',
                effectiveTo: null,
                roundingMode: ReinsuranceChargeRoundingMode.HALF_UP,
                decimalPlaces: 2,
                basisAmount: netBeforeCharges,
                amount: nicLevyAmount,
              },
            ]
          : []),
        ...(withholdingTaxAmount
          ? [
              {
                configurationId: 'charge-wht',
                code: ReinsuranceChargeCode.WITHHOLDING_TAX,
                name: 'Withholding Tax',
                chargeType: ReinsuranceChargeType.TAX,
                rateType: ReinsuranceChargeRateType.PERCENTAGE,
                rate: '5',
                calculationBasis:
                  ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
                direction: ReinsuranceChargeDirection.DEDUCTION,
                currency: null,
                effectiveFrom: '2026-01-01T00:00:00.000Z',
                effectiveTo: null,
                roundingMode: ReinsuranceChargeRoundingMode.HALF_UP,
                decimalPlaces: 2,
                basisAmount: netBeforeCharges,
                amount: withholdingTaxAmount,
              },
            ]
          : []),
      ],
    };
  };

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementNote: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    chargeSettings = {
      calculateCharges: jest.fn(
        (_tenantId: string, input: ChargeCalculationInput) => {
          const grossAmount = input.grossAmount;
          const commissionAmount = input.commissionAmount ?? 0;
          const brokerageAmount = input.brokerageAmount ?? 0;
          const netBeforeCharges =
            grossAmount - commissionAmount - brokerageAmount;
          return Promise.resolve({
            currency: input.currency,
            effectiveAt: (input.effectiveAt ?? new Date()).toISOString(),
            grossAmount,
            commissionAmount,
            brokerageAmount,
            netBeforeCharges,
            additions: 0,
            deductions: 0,
            netAmount: netBeforeCharges,
            charges: [],
          });
        },
      ),
    };
    financialEvents = {
      assertAccountingReadyForEvent: jest.fn().mockResolvedValue(undefined),
      prepareDebitNoteIssued: jest.fn().mockResolvedValue(null),
      prepareCreditNoteIssued: jest.fn().mockResolvedValue(null),
      prepareEndorsementDebitNoteIssued: jest.fn().mockResolvedValue(null),
      prepareEndorsementCreditNoteIssued: jest.fn().mockResolvedValue(null),
      enqueuePreparedEvent: jest.fn(),
    };
    financialPosition = {
      getFinancialPosition: jest.fn().mockResolvedValue({
        placementId: 'placement-1',
        asOfDate: '2026-06-10T00:00:00.000Z',
        currency: 'USD',
        isMultiCurrency: false,
        cedant: {
          originalObligation: 6750,
          endorsementAdjustments: 1800,
          currentObligation: 8550,
          received: 0,
          refunded: 0,
          grossRecorded: 0,
          reversed: 0,
          netSettled: 0,
          outstanding: 8550,
          position: 'RECEIVABLE',
        },
        reinsurers: [],
        adjustments: [
          {
            sourceType: 'ENDORSEMENT_CLOSING',
            closingId: 'endorsement-closing-1',
            endorsementId: 'endorsement-1',
            endorsementNumber: 'END-001',
            counterpartyId: 'reinsurer-1',
            originalParticipantId: null,
            amount: 1800,
            currency: 'USD',
            effectiveDate: '2026-06-05T00:00:00.000Z',
          },
        ],
        warnings: [],
      }),
    };
    effectiveView = {
      getEffectiveView: jest.fn().mockResolvedValue({
        viewAsOf: '2026-06-10T00:00:00.000Z',
        basePlacement: {
          id: 'placement-1',
          reference: 'FAC-001',
          policyNumber: 'POL-001',
          title: 'Factory Fire',
          cedantId: 'cedant-1',
          currency: 'USD',
          sumInsured: 100000,
          premium: 10000,
          rate: 1,
          commissionPercent: 10,
          brokeragePercent: 0,
          facultativeOfferPercent: 60,
        },
        effectiveTotals: {
          facultativeOfferPercent: 70,
          originalFacultativeOfferPercent: 60,
          acceptedEndorsementCapacityPercent: 0,
          confirmedEndorsementCapacityPercent: 10,
          remainingCapacityPercent: 0,
          participantCount: 2,
          sumInsured: 120000,
          premium: 12000,
          currency: 'USD',
          rate: 1,
          commissionPercent: 10,
          brokeragePercent: 0,
          grossPremium: 9500,
          commissionAmount: 950,
          brokerageAmount: 0,
          netPremium: 8550,
        },
        capacityBreakdown: {
          originalCapacityPercent: 60,
          acceptedEndorsementCapacityPercent: 0,
          confirmedEndorsementCapacityPercent: 10,
          remainingCapacityPercent: 0,
          effectiveTotalCapacityPercent: 70,
        },
        effectiveTerms: {
          title: 'Factory Fire',
          policyNumber: 'POL-001',
          cedantId: 'cedant-1',
          riskTypeId: 'risk-type-1',
          businessDetails: null,
          offerDetails: null,
          description: null,
          inceptionDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-05-31T00:00:00.000Z',
          currency: 'USD',
          sumInsured: 120000,
          rate: 1,
          premium: 12000,
          commissionPercent: 10,
          brokeragePercent: 0,
          facultativeOfferPercent: 70,
        },
        effectiveParticipants: [],
        appliedEndorsements: [
          {
            id: 'endorsement-1',
            endorsementNumber: 'END-001',
            type: 'PARTICIPANT_ADDITION',
            status: 'CLOSED',
            effectiveDate: '2026-06-05T00:00:00.000Z',
            targetPercent: 70,
            confirmedClosings: [
              {
                id: 'endorsement-closing-1',
                closingNumber: 'ENC-001',
                endorsementParticipantId: 'endorsement-participant-1',
                counterpartyId: 'reinsurer-1',
                signedLinePercent: 10,
              },
            ],
          },
        ],
        scheduledEndorsements: [
          {
            id: 'endorsement-2',
            endorsementNumber: 'END-002',
            type: 'PARTICIPANT_ADDITION',
            status: 'CLOSED',
            effectiveDate: '2026-07-01T00:00:00.000Z',
            targetPercent: 80,
            confirmedClosingCount: 1,
          },
        ],
        pendingEndorsements: [],
        warnings: [],
      }),
    };
    service = new PlacementNotesService(
      prisma as unknown as PrismaService,
      chargeSettings as unknown as ReinsuranceChargeSettingsService,
      financialPosition as unknown as PlacementFinancialPositionService,
      effectiveView as unknown as PlacementEffectiveViewService,
    );
    lockPolicy = new PlacementFinancialLockPolicy(
      new PlacementFinancialActivityReader(prisma as unknown as PrismaService),
    );
  });

  it('lists notes for an active tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findMany.mockResolvedValue([note]);

    const result = await service.findAll('tenant-1', 'placement-1');

    expect(prisma.placementNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', placementId: 'placement-1' },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('does not expose another tenant placement notes', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findAll('tenant-1', 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates debit note from confirmed closing snapshots', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionAmount: new Prisma.Decimal('450.00'),
        currency: 'USD',
      },
      {
        grossPremium: new Prisma.Decimal('3000.00'),
        commissionAmount: new Prisma.Decimal('300.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue(note);

    const result = await service.createDebitNote(user, 'placement-1');

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      counterpartyId: 'cedant-1',
      type: PlacementNoteType.DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      noteNumber: 'DN-001',
      grossAmount: 7500,
      commissionAmount: 750,
      brokerageAmount: null,
      nicLevyAmount: 0,
      withholdingTaxAmount: 0,
      netAmount: 6750,
    });
    expect(createArgs.data.appliedCharges).toMatchObject({
      version: 1,
      additions: 0,
      deductions: 0,
      charges: [],
    });
    expect(result.noteNumber).toBe('DN-001');
  });

  it('snapshots configured charge calculations onto debit notes', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('10000.00'),
        commissionAmount: new Prisma.Decimal('1000.00'),
        currency: 'USD',
        participant: {
          counterparty: {
            addresses: [{ country: 'GB', isPrimary: true }],
          },
        },
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue(note);
    chargeSettings.calculateCharges.mockResolvedValueOnce({
      currency: 'USD',
      effectiveAt: '2026-06-04T12:00:00.000Z',
      grossAmount: 10000,
      commissionAmount: 1000,
      brokerageAmount: 0,
      netBeforeCharges: 9000,
      additions: 0,
      deductions: 540,
      netAmount: 8460,
      charges: [
        {
          configurationId: 'charge-nic',
          code: ReinsuranceChargeCode.NIC_LEVY,
          name: 'NIC Levy',
          chargeType: ReinsuranceChargeType.LEVY,
          rateType: ReinsuranceChargeRateType.PERCENTAGE,
          rate: '1',
          calculationBasis:
            ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
          direction: ReinsuranceChargeDirection.DEDUCTION,
          currency: null,
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
          roundingMode: ReinsuranceChargeRoundingMode.HALF_UP,
          decimalPlaces: 2,
          basisAmount: 9000,
          amount: 90,
        },
        {
          configurationId: 'charge-wht',
          code: ReinsuranceChargeCode.WITHHOLDING_TAX,
          name: 'Withholding Tax',
          chargeType: ReinsuranceChargeType.TAX,
          rateType: ReinsuranceChargeRateType.PERCENTAGE,
          rate: '5',
          calculationBasis:
            ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
          direction: ReinsuranceChargeDirection.DEDUCTION,
          currency: null,
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
          roundingMode: ReinsuranceChargeRoundingMode.HALF_UP,
          decimalPlaces: 2,
          basisAmount: 9000,
          amount: 450,
        },
      ],
    });

    await service.createDebitNote(user, 'placement-1');

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      grossAmount: 10000,
      commissionAmount: 1000,
      nicLevyPercent: 1,
      nicLevyAmount: 90,
      withholdingTaxPercent: 5,
      withholdingTaxAmount: 450,
      netAmount: 8460,
    });
    expect(createArgs.data.appliedCharges).toMatchObject({
      version: 1,
      netBeforeCharges: 9000,
      deductions: 540,
      netAmount: 8460,
    });
  });

  it('does not apply cedant levy charges to foreign-cedant debit notes', async () => {
    prisma.placement.findFirst.mockResolvedValue(foreignCedantPlacement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('10000.00'),
        commissionAmount: new Prisma.Decimal('1000.00'),
        currency: 'USD',
        participant: {
          counterparty: {
            addresses: [{ country: 'GB', isPrimary: true }],
          },
        },
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue(note);

    await service.createDebitNote(user, 'placement-1');

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      grossAmount: 10000,
      commissionAmount: 1000,
      nicLevyPercent: 0,
      nicLevyAmount: 0,
      withholdingTaxPercent: 0,
      withholdingTaxAmount: 0,
      netAmount: 9000,
    });
    expect(createArgs.data.appliedCharges).toMatchObject({
      deductions: 0,
      netAmount: 9000,
      charges: [],
    });
    expect(chargeSettings.calculateCharges).not.toHaveBeenCalled();
  });

  it('applies foreign-cession levies only to the share ceded to non-resident reinsurers', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('6000.00'),
        commissionAmount: new Prisma.Decimal('600.00'),
        currency: 'USD',
        participant: {
          counterparty: { addresses: [{ country: 'GB', isPrimary: true }] },
        },
      },
      {
        grossPremium: new Prisma.Decimal('4000.00'),
        commissionAmount: new Prisma.Decimal('400.00'),
        currency: 'USD',
        participant: {
          counterparty: { addresses: [{ country: 'GH', isPrimary: true }] },
        },
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue(note);

    chargeSettings.calculateCharges.mockImplementation(
      (_tenantId: string, input: ChargeCalculationInput) => {
        const grossAmount = input.grossAmount;
        const commissionAmount = input.commissionAmount ?? 0;
        const netBeforeCharges = grossAmount - commissionAmount;
        const deductions = input.isForeignReinsurer
          ? Math.round(netBeforeCharges * 0.06 * 100) / 100
          : 0;
        return Promise.resolve({
          currency: input.currency,
          effectiveAt: (input.effectiveAt ?? new Date()).toISOString(),
          grossAmount,
          commissionAmount,
          brokerageAmount: 0,
          netBeforeCharges,
          additions: 0,
          deductions,
          netAmount: netBeforeCharges - deductions,
          charges: input.isForeignReinsurer
            ? [
                {
                  configurationId: 'charge-wht',
                  code: ReinsuranceChargeCode.WITHHOLDING_TAX,
                  name: 'Withholding Tax',
                  chargeType: ReinsuranceChargeType.TAX,
                  rateType: ReinsuranceChargeRateType.PERCENTAGE,
                  rate: '6',
                  calculationBasis:
                    ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
                  direction: ReinsuranceChargeDirection.DEDUCTION,
                  currency: null,
                  effectiveFrom: '2026-01-01T00:00:00.000Z',
                  effectiveTo: null,
                  roundingMode: ReinsuranceChargeRoundingMode.HALF_UP,
                  decimalPlaces: 2,
                  basisAmount: netBeforeCharges,
                  amount: deductions,
                },
              ]
            : [],
        });
      },
    );

    await service.createDebitNote(user, 'placement-1');

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    // Foreign sub-pool: net 6000 - 600 = 5400, WHT 6% = 324.
    // Resident sub-pool: net 4000 - 400 = 3600, no levy.
    expect(createArgs.data).toMatchObject({
      grossAmount: 10000,
      commissionAmount: 1000,
      withholdingTaxAmount: 324,
      netAmount: 8676,
    });
    expect(createArgs.data.appliedCharges).toMatchObject({
      deductions: 324,
      netAmount: 8676,
    });
    const foreignInputs = chargeSettings.calculateCharges.mock.calls
      .map(([, input]: [unknown, ChargeCalculationInput]) => input)
      .filter((input: ChargeCalculationInput) => input.isForeignReinsurer);
    expect(foreignInputs).toHaveLength(1);
    expect(foreignInputs[0]).toMatchObject({
      grossAmount: 6000,
      commissionAmount: 600,
    });
  });

  it('allows locked placements to generate notes from confirmed closings without unlocking them', async () => {
    const lockedPlacement = {
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.MARKETING,
    };
    const paymentDate = new Date('2026-06-04T13:00:00.000Z');
    prisma.placementPayment.findFirst.mockResolvedValue({
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      paymentDate,
      createdAt: paymentDate,
    });
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionAmount: new Prisma.Decimal('450.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue(note);

    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
      endorsementRequired: true,
      lockSource: 'PREMIUM_PAYMENT',
    });

    await expect(
      service.createDebitNote(user, 'placement-1'),
    ).resolves.toMatchObject({
      id: 'note-1',
      noteNumber: 'DN-001',
      type: PlacementNoteType.DEBIT_NOTE,
    });

    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
      endorsementRequired: true,
      lockSource: 'PREMIUM_PAYMENT',
    });
  });

  it('rejects debit note when no confirmed closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([]);

    await expect(service.createDebitNote(user, 'placement-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects duplicate active debit note and allows reissue after VOID', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst
      .mockResolvedValueOnce({ id: 'active-note' })
      .mockResolvedValueOnce(null);

    await expect(service.createDebitNote(user, 'placement-1')).rejects.toThrow(
      ConflictException,
    );

    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionAmount: new Prisma.Decimal('450.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(1);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      noteNumber: 'DN-002',
    });

    const result = await service.createDebitNote(user, 'placement-1');

    expect(result.noteNumber).toBe('DN-002');
  });

  it('creates credit note from a confirmed closing snapshot', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findFirst.mockResolvedValue(confirmedClosing);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      id: 'credit-note-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'CN-001',
      grossAmount: new Prisma.Decimal('4500.00'),
      commissionPercent: new Prisma.Decimal('10.0000'),
      commissionAmount: new Prisma.Decimal('450.00'),
      brokeragePercent: new Prisma.Decimal('7.50'),
      brokerageAmount: new Prisma.Decimal('337.50'),
      netAmount: new Prisma.Decimal('3712.50'),
    });

    await service.createCreditNote(user, 'placement-1', 'closing-1');

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'CN-001',
      grossAmount: 4500,
      commissionPercent: 10,
      commissionAmount: 450,
      brokeragePercent: 7.5,
      brokerageAmount: 337.5,
      netAmount: 3712.5,
    });
  });

  it('rejects credit note for non-confirmed or wrong-tenant closing', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findFirst.mockResolvedValue(null);

    await expect(
      service.createCreditNote(user, 'placement-1', 'closing-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate active credit note and allows reissue after VOID', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst
      .mockResolvedValueOnce({ id: 'active-note' })
      .mockResolvedValueOnce(null);

    await expect(
      service.createCreditNote(user, 'placement-1', 'closing-1'),
    ).rejects.toThrow(ConflictException);

    prisma.placementClosing.findFirst.mockResolvedValue(confirmedClosing);
    prisma.placementNote.count.mockResolvedValue(1);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.CREDIT_NOTE,
      noteNumber: 'CN-002',
    });

    const result = await service.createCreditNote(
      user,
      'placement-1',
      'closing-1',
    );

    expect(result.noteNumber).toBe('CN-002');
  });

  it('creates endorsement debit note from confirmed endorsement closing snapshots', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        premiumSnapshot: new Prisma.Decimal('1500.00'),
        commissionAmount: new Prisma.Decimal('150.00'),
        currency: 'USD',
      },
      {
        premiumSnapshot: new Prisma.Decimal('500.00'),
        commissionAmount: new Prisma.Decimal('50.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      noteNumber: 'EDN-001',
      endorsementId: 'endorsement-1',
      grossAmount: new Prisma.Decimal('2000.00'),
      commissionAmount: new Prisma.Decimal('200.00'),
      netAmount: new Prisma.Decimal('1800.00'),
    });

    const result = await service.createEndorsementDebitNote(
      user,
      'placement-1',
      'endorsement-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      counterpartyId: 'cedant-1',
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      noteNumber: 'EDN-001',
      grossAmount: 2000,
      commissionAmount: 200,
      brokerageAmount: null,
      netAmount: 1800,
    });
    expect(result.noteNumber).toBe('EDN-001');
  });

  it('preserves configured charge calculations for local-cedant endorsement debit notes', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        premiumSnapshot: new Prisma.Decimal('2000.00'),
        commissionAmount: new Prisma.Decimal('200.00'),
        currency: 'USD',
        endorsementParticipant: {
          counterparty: {
            addresses: [{ country: 'GB', isPrimary: true }],
          },
        },
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      noteNumber: 'EDN-001',
      endorsementId: 'endorsement-1',
    });
    chargeSettings.calculateCharges.mockImplementation(
      (_tenantId: string, input: ChargeCalculationInput) =>
        Promise.resolve(
          configuredChargeResult(input, {
            nicLevyAmount: 18,
            withholdingTaxAmount: 90,
          }),
        ),
    );

    await service.createEndorsementDebitNote(
      user,
      'placement-1',
      'endorsement-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      grossAmount: 2000,
      commissionAmount: 200,
      nicLevyPercent: 1,
      nicLevyAmount: 18,
      withholdingTaxPercent: 5,
      withholdingTaxAmount: 90,
      netAmount: 1692,
    });
    expect(createArgs.data.appliedCharges).toMatchObject({
      deductions: 108,
      netAmount: 1692,
    });
  });

  it('does not apply cedant levy charges to foreign-cedant endorsement debit notes', async () => {
    prisma.placement.findFirst.mockResolvedValue(foreignCedantPlacement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        premiumSnapshot: new Prisma.Decimal('2000.00'),
        commissionAmount: new Prisma.Decimal('200.00'),
        currency: 'USD',
        endorsementParticipant: {
          counterparty: {
            addresses: [{ country: 'GB', isPrimary: true }],
          },
        },
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      noteNumber: 'EDN-001',
      endorsementId: 'endorsement-1',
    });

    await service.createEndorsementDebitNote(
      user,
      'placement-1',
      'endorsement-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      grossAmount: 2000,
      commissionAmount: 200,
      nicLevyPercent: 0,
      nicLevyAmount: 0,
      withholdingTaxPercent: 0,
      withholdingTaxAmount: 0,
      netAmount: 1800,
    });
    expect(createArgs.data.appliedCharges).toMatchObject({
      deductions: 0,
      netAmount: 1800,
      charges: [],
    });
    expect(chargeSettings.calculateCharges).not.toHaveBeenCalled();
  });

  it('rejects endorsement debit note when no confirmed endorsement closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects endorsement debit note when the endorsement is not closed', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'ACCEPTED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('rejects future-dated endorsement debit note generation by default', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('rejects endorsement debit note for decrease or cancellation endorsements', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('rejects endorsement debit note when confirmed closing snapshots have mixed currencies', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        premiumSnapshot: new Prisma.Decimal('1500.00'),
        commissionAmount: new Prisma.Decimal('150.00'),
        currency: 'USD',
      },
      {
        premiumSnapshot: new Prisma.Decimal('500.00'),
        commissionAmount: new Prisma.Decimal('50.00'),
        currency: 'GHS',
      },
    ]);

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('rejects endorsement debit note for zero or return-premium adjustments', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        premiumSnapshot: new Prisma.Decimal('-500.00'),
        commissionAmount: new Prisma.Decimal('-50.00'),
        currency: 'USD',
      },
    ]);

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active endorsement debit note', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue({ id: 'active-note' });

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('allows endorsement debit note regeneration after VOID and preserves numbering history', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: 'CLOSED',
      effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        premiumSnapshot: new Prisma.Decimal('1500.00'),
        commissionAmount: new Prisma.Decimal('150.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(1);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      noteNumber: 'EDN-002',
      endorsementId: 'endorsement-1',
    });

    const result = await service.createEndorsementDebitNote(
      user,
      'placement-1',
      'endorsement-1',
    );

    expect(result.noteNumber).toBe('EDN-002');
    expect(prisma.placementNote.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      },
    });
  });

  it('creates a non-posting current effective debit note statement from backend effective state', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClosing.findMany.mockResolvedValue([
      { id: 'closing-1', closingNumber: 'CLO-001' },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        closingNumber: 'ENC-001',
        endorsementId: 'endorsement-1',
      },
    ]);
    prisma.placementNote.findMany.mockResolvedValue([
      {
        id: 'note-1',
        noteNumber: 'DN-001',
        endorsementId: null,
        type: PlacementNoteType.DEBIT_NOTE,
        grossAmount: new Prisma.Decimal('7500.00'),
        nicLevyAmount: new Prisma.Decimal('10.00'),
        withholdingTaxAmount: new Prisma.Decimal('5.00'),
        netAmount: new Prisma.Decimal('6750.00'),
      },
      {
        id: 'endorsement-note-1',
        noteNumber: 'EDN-001',
        endorsementId: 'endorsement-1',
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        grossAmount: new Prisma.Decimal('2000.00'),
        nicLevyAmount: new Prisma.Decimal('2.00'),
        withholdingTaxAmount: new Prisma.Decimal('1.00'),
        netAmount: new Prisma.Decimal('1800.00'),
      },
    ]);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
      noteNumber: 'CEDN-001',
      postingEnabled: false,
      effectiveVersionKey: 'current-effective-debit-note:v1:test',
    });

    await service.createCurrentEffectiveDebitNote(
      user,
      'placement-1',
      '2026-06-10T00:00:00.000Z',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      counterpartyId: 'cedant-1',
      type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      noteNumber: 'CEDN-001',
      postingEnabled: false,
      grossAmount: 9500,
      commissionPercent: 10,
      commissionAmount: 950,
      brokeragePercent: 0,
      brokerageAmount: 0,
      nicLevyAmount: 12,
      withholdingTaxAmount: 6,
      netAmount: 8550,
    });
    const sourceSnapshot = createArgs.data.sourceSnapshot as Record<
      string,
      unknown
    >;
    expect(sourceSnapshot.postingBehavior).toBe(
      'NON_POSTING_CONSOLIDATED_STATEMENT',
    );
    expect(sourceSnapshot.postingDecision).toEqual(
      expect.stringContaining('duplicate receivables'),
    );
    expect(sourceSnapshot.sourceNoteIds).toEqual([
      'note-1',
      'endorsement-note-1',
    ]);
    expect(createArgs.data.effectiveVersionKey).toMatch(
      /^current-effective-debit-note:v1:/,
    );
  });

  it('reuses an existing current effective debit note for the same deterministic version', async () => {
    const existing = {
      ...note,
      type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
      postingEnabled: false,
      effectiveVersionKey: 'current-effective-debit-note:v1:existing',
    };
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClosing.findMany.mockResolvedValue([
      { id: 'closing-1', closingNumber: 'CLO-001' },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);
    prisma.placementNote.findMany.mockResolvedValue([]);
    prisma.placementNote.findFirst.mockResolvedValue(existing);

    const result = await service.createCurrentEffectiveDebitNote(
      user,
      'placement-1',
      '2026-06-10T00:00:00.000Z',
    );

    expect(result).toBe(existing);
    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('issues current effective debit notes without enqueueing accounting events', async () => {
    const currentEffectiveNote = {
      ...note,
      type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
      postingEnabled: false,
      effectiveVersionKey: 'current-effective-debit-note:v1:test',
    };
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(currentEffectiveNote);
    prisma.placementNote.update.mockResolvedValue({
      ...currentEffectiveNote,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });

    await service.issue(user, 'placement-1', 'note-1', {
      status: PlacementNoteStatus.ISSUED,
    });

    expect(financialEvents.prepareDebitNoteIssued).not.toHaveBeenCalled();
    expect(financialEvents.prepareCreditNoteIssued).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('creates endorsement credit note from a confirmed endorsement closing snapshot', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findFirst.mockResolvedValue(
      confirmedEndorsementClosing,
    );
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      id: 'endorsement-credit-note-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'ECN-001',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
    });

    await service.createEndorsementCreditNote(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'ECN-001',
      grossAmount: 1500,
      commissionPercent: 10,
      commissionAmount: 150,
      brokeragePercent: 7.5,
      brokerageAmount: 112.5,
      netAmount: 1237.5,
    });
  });

  it('rejects endorsement credit note for non-confirmed or wrong-tenant closing', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findFirst.mockResolvedValue(null);

    await expect(
      service.createEndorsementCreditNote(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-closing-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate active endorsement credit note', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue({ id: 'active-note' });

    await expect(
      service.createEndorsementCreditNote(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-closing-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('lists and gets endorsement notes scoped to tenant placement and endorsement', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findMany.mockResolvedValue([
      {
        ...note,
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        endorsementId: 'endorsement-1',
      },
    ]);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      endorsementId: 'endorsement-1',
    });

    const list = await service.findAllEndorsementNotes(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    const detail = await service.findEndorsementNote(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'note-1',
    );

    expect(prisma.placementNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          endorsementId: 'endorsement-1',
        },
      }),
    );
    expect(list).toHaveLength(1);
    expect(detail.endorsementId).toBe('endorsement-1');
  });

  it('issues a draft debit note without Accounting readiness or outbox capture', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(note);
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });

    await service.issue(user, 'placement-1', 'note-1', {
      status: PlacementNoteStatus.ISSUED,
    });

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.where).toEqual({ id: 'note-1' });
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.ISSUED,
    });
    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(financialEvents.prepareDebitNoteIssued).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('issues notes even when retired Accounting readiness would fail', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(note);
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });
    financialEvents.assertAccountingReadyForEvent.mockRejectedValue(
      new ConflictException({
        code: 'ACCOUNTING_NOT_READY',
        blockers: [{ code: 'POSTING_RULE_MISSING' }],
      }),
    );

    await service.issue(user, 'placement-1', 'note-1', {
      status: PlacementNoteStatus.ISSUED,
    });

    expect(prisma.placementNote.update).toHaveBeenCalled();
    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(financialEvents.prepareDebitNoteIssued).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('issues a credit note without Accounting event preparation', async () => {
    const creditNote = {
      ...note,
      id: 'credit-note-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'CN-001',
      grossAmount: new Prisma.Decimal('4500.00'),
      commissionAmount: new Prisma.Decimal('450.00'),
      brokerageAmount: new Prisma.Decimal('337.50'),
      netAmount: new Prisma.Decimal('3712.50'),
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
      closing: {
        id: 'closing-1',
        closingNumber: 'CLO-001',
      },
    };
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(creditNote);
    prisma.placementNote.update.mockResolvedValue({
      ...creditNote,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });

    await service.issue(user, 'placement-1', 'credit-note-1', {
      status: PlacementNoteStatus.ISSUED,
    });

    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(financialEvents.prepareCreditNoteIssued).not.toHaveBeenCalled();
    expect(financialEvents.prepareDebitNoteIssued).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('issues a draft endorsement debit note without Accounting event preparation', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      endorsementId: 'endorsement-1',
    });
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      endorsementId: 'endorsement-1',
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });

    await service.issueEndorsementNote(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      { status: PlacementNoteStatus.ISSUED },
    );

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.where).toEqual({ id: 'note-1' });
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.ISSUED,
    });
    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareEndorsementDebitNoteIssued,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('issues an endorsement credit note without Accounting event preparation', async () => {
    const endorsementCreditNote = {
      ...note,
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
      noteNumber: 'ECN-001',
      grossAmount: new Prisma.Decimal('-1800.00'),
      netAmount: new Prisma.Decimal('-1620.00'),
    };
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue(endorsementCreditNote);
    prisma.placementNote.update.mockResolvedValue({
      ...endorsementCreditNote,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });

    await service.issueEndorsementNote(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      { status: PlacementNoteStatus.ISSUED },
    );

    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareEndorsementCreditNoteIssued,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareEndorsementDebitNoteIssued,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects unsupported status transitions and keeps VOID terminal', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.VOID,
    });

    await expect(
      service.issue(user, 'placement-1', 'note-1', {
        status: PlacementNoteStatus.ISSUED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('voids draft or issued notes with a reason', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.ISSUED,
    });
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });

    await service.void(user, 'placement-1', 'note-1', {
      voidReason: 'Issued in error',
    });

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });
  });

  it('voids draft or issued endorsement notes with a reason', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      endorsementId: 'endorsement-1',
      status: PlacementNoteStatus.ISSUED,
    });
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      endorsementId: 'endorsement-1',
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });

    await service.voidEndorsementNote(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      { voidReason: 'Issued in error' },
    );

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });
  });

  it('rejects voiding a VOID note', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.VOID,
    });

    await expect(
      service.void(user, 'placement-1', 'note-1', {
        voidReason: 'Try again',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
