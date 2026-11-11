import { randomUUID } from 'node:crypto';
import {
  Prisma,
  PrismaClient,
  CounterpartyType,
} from '../../../../prisma/generated/client';

// Never fall back to DATABASE_URL. Provision the current Prisma schema in a fresh
// disposable database first (CI does this with prisma migrate deploy).
export const financialDatabaseUrl =
  process.env.FINANCIAL_REPORTS_TEST_DATABASE_URL;
export const financialDatabaseDescribe = financialDatabaseUrl
  ? describe
  : describe.skip;

export function verifiedFinancialDatabaseUrl(value: string): string {
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^\/irisk_financial_test_[a-zA-Z0-9_]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'FINANCIAL_REPORTS_TEST_DATABASE_URL requires an explicit local irisk_financial_test_ database without URL options',
    );
  }
  return url.toString();
}

export async function createFinancialReportFixture() {
  const url = verifiedFinancialDatabaseUrl(financialDatabaseUrl!);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const cedant = await prisma.counterparty.create({
    data: {
      tenantId,
      type: 'CEDANT',
      name: 'Synthetic cedant',
      normalizedName: `synthetic-${randomUUID()}`,
      createdByUserId: actorId,
      updatedByUserId: actorId,
    },
  });
  const fixture = {
    prisma,
    tenantId,
    actorId,
    cedant,
    async disconnect() {
      await prisma.$disconnect();
    },
    counterparty(
      name = `Synthetic reinsurer ${randomUUID()}`,
      type: CounterpartyType = 'REINSURER',
    ) {
      return prisma.counterparty.create({
        data: {
          tenantId,
          type,
          name,
          normalizedName: name.toLowerCase(),
          createdByUserId: actorId,
          updatedByUserId: actorId,
        },
      });
    },
    placement(data: Partial<Prisma.PlacementUncheckedCreateInput> = {}) {
      const reference = `SYNTHETIC-${randomUUID()}`;
      return prisma.placement.create({
        data: {
          tenantId,
          reference,
          normalizedReference: reference.toLowerCase(),
          title: 'Synthetic financial regression',
          cedantId: cedant.id,
          status: 'CLOSED',
          currency: 'GHS',
          premium: '2000',
          sumInsured: '100000',
          commission: '10',
          facultativeOffer: '50',
          createdByUserId: actorId,
          updatedByUserId: actorId,
          inceptionDate: new Date('2026-01-01T00:00:00Z'),
          expiryDate: new Date('2026-12-31T00:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
          ...data,
        },
      });
    },
    participant(
      placementId: string,
      counterpartyId: string,
      data: Partial<Prisma.PlacementParticipantUncheckedCreateInput> = {},
    ) {
      return prisma.placementParticipant.create({
        data: {
          tenantId,
          placementId,
          counterpartyId,
          role: 'REINSURER',
          status: 'CLOSED',
          signedLinePercent: '50',
          sharePercent: '50',
          ...data,
        },
      });
    },
    closing(
      placementId: string,
      participantId: string,
      data: Partial<Prisma.PlacementClosingUncheckedCreateInput> = {},
    ) {
      return prisma.placementClosing.create({
        data: {
          tenantId,
          placementId,
          participantId,
          closingNumber: `SYNTHETIC-${randomUUID()}`,
          status: 'CONFIRMED',
          signedLinePercent: '50',
          sharePercent: '50',
          sumInsuredSnapshot: '50000',
          grossPremium: '1000',
          commissionAmount: '100',
          commissionPercent: '10',
          brokerageAmount: '100',
          brokeragePercent: '10',
          netPremium: '800',
          currency: 'GHS',
          confirmedAt: new Date('2026-01-01T00:00:00Z'),
          createdByUserId: actorId,
          ...data,
        },
      });
    },
    endorsement(
      placementId: string,
      data: Partial<Prisma.PlacementEndorsementUncheckedCreateInput> = {},
    ) {
      return prisma.placementEndorsement.create({
        data: {
          tenantId,
          placementId,
          endorsementNumber: `SYNTHETIC-${randomUUID()}`,
          type: 'OTHER',
          impactType: 'TERMS_ONLY',
          status: 'CLOSED',
          effectiveDate: new Date('2026-02-01T00:00:00Z'),
          reason: 'Synthetic integration test',
          originalSnapshot: {},
          createdByUserId: actorId,
          updatedByUserId: actorId,
          ...data,
        },
      });
    },
    endorsementParticipant(
      placementId: string,
      endorsementId: string,
      counterpartyId: string,
      originalParticipantId: string | null,
      data: Partial<Prisma.PlacementEndorsementParticipantUncheckedCreateInput> = {},
    ) {
      return prisma.placementEndorsementParticipant.create({
        data: {
          tenantId,
          placementId,
          endorsementId,
          counterpartyId,
          originalParticipantId,
          status: 'CLOSED',
          signedLinePercent: '50',
          sharePercent: '50',
          createdByUserId: actorId,
          ...data,
        },
      });
    },
    endorsementClosing(
      placementId: string,
      endorsementId: string,
      endorsementParticipantId: string,
      data: Partial<Prisma.PlacementEndorsementClosingUncheckedCreateInput> = {},
    ) {
      return prisma.placementEndorsementClosing.create({
        data: {
          tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId,
          closingNumber: `SYNTHETIC-${randomUUID()}`,
          status: 'CONFIRMED',
          signedLinePercent: '50',
          sharePercent: '50',
          sumInsuredSnapshot: '75000',
          premiumSnapshot: '1500',
          commissionAmount: '150',
          commissionPercent: '10',
          brokerageAmount: '150',
          brokeragePercent: '10',
          netPremium: '1200',
          currency: 'GHS',
          confirmedAt: new Date('2026-02-01T00:00:00Z'),
          createdByUserId: actorId,
          ...data,
        },
      });
    },
    payment(
      placementId: string,
      counterpartyId: string,
      data: Partial<Prisma.PlacementPaymentUncheckedCreateInput> = {},
    ) {
      return prisma.placementPayment.create({
        data: {
          tenantId,
          placementId,
          counterpartyId,
          type: 'REINSURER_DISBURSEMENT',
          direction: 'OUTBOUND',
          amount: '300',
          currency: 'GHS',
          paymentDate: new Date('2026-03-01T00:00:00Z'),
          status: 'BANK_CONFIRMED',
          bankConfirmedAt: new Date('2026-03-01T00:00:00Z'),
          bankConfirmedByUserId: actorId,
          settlementMethod: 'OTHER',
          createdByUserId: actorId,
          ...data,
        },
      });
    },
    note(
      placementId: string,
      counterpartyId: string,
      data: Partial<Prisma.PlacementNoteUncheckedCreateInput> = {},
    ) {
      return prisma.placementNote.create({
        data: {
          tenantId,
          placementId,
          counterpartyId,
          type: 'CREDIT_NOTE',
          direction: 'BROKER_TO_REINSURER',
          noteNumber: `SYNTHETIC-${randomUUID()}`,
          status: 'ISSUED',
          currency: 'GHS',
          grossAmount: '1000',
          commissionAmount: '100',
          brokerageAmount: '100',
          netAmount: '800',
          noteDate: new Date('2026-01-01T00:00:00Z'),
          issuedAt: new Date('2026-01-01T00:00:00Z'),
          postingEnabled: false,
          createdByUserId: actorId,
          ...data,
        },
      });
    },
    claim(
      placementId: string,
      data: Partial<Prisma.PlacementClaimUncheckedCreateInput> = {},
    ) {
      return prisma.placementClaim.create({
        data: {
          tenantId,
          placementId,
          claimNumber: `SYNTHETIC-${randomUUID()}`,
          status: 'RESERVED',
          claimState: 'FINALIZED',
          occurrenceDate: new Date('2026-01-10T00:00:00Z'),
          reportedDate: new Date('2026-01-10T00:00:00Z'),
          claimCause: 'Synthetic test',
          currency: 'GHS',
          estimatedLossAmount: '100',
          finalLossAmount: '100',
          finalizedAt: new Date('2026-01-11T00:00:00Z'),
          createdByUserId: actorId,
          ...data,
        },
      });
    },
    allocation(
      placementId: string,
      claimId: string,
      counterpartyId: string,
      data: Partial<Prisma.PlacementClaimAllocationUncheckedCreateInput> = {},
    ) {
      return prisma.placementClaimAllocation.create({
        data: {
          tenantId,
          placementId,
          claimId,
          counterpartyId,
          signedLinePercent: '100',
          basisAmount: '100',
          allocatedEstimatedLossAmount: '100',
          allocatedFinalLossAmount: '100',
          cashCallAmount: '100',
          status: 'CASH_CALLED',
          ...data,
        },
      });
    },
    cashCall(
      placementId: string,
      claimId: string,
      allocationId: string,
      counterpartyId: string,
      data: Partial<Prisma.PlacementClaimCashCallUncheckedCreateInput> = {},
    ) {
      return prisma.placementClaimCashCall.create({
        data: {
          tenantId,
          placementId,
          claimId,
          allocationId,
          counterpartyId,
          cashCallNumber: `SYNTHETIC-${randomUUID()}`,
          status: 'ISSUED',
          currency: 'GHS',
          amount: '100',
          basisAmount: '100',
          signedLinePercent: '100',
          createdByUserId: actorId,
          ...data,
        },
      });
    },
    receipt(
      placementId: string,
      claimId: string,
      allocationId: string,
      cashCallId: string,
      counterpartyId: string,
      data: Partial<Prisma.PlacementClaimRecoveryReceiptUncheckedCreateInput> = {},
    ) {
      return prisma.placementClaimRecoveryReceipt.create({
        data: {
          tenantId,
          placementId,
          claimId,
          allocationId,
          cashCallId,
          counterpartyId,
          currency: 'GHS',
          amount: '100',
          paymentDate: new Date('2026-03-01T00:00:00Z'),
          status: 'BANK_CONFIRMED',
          bankConfirmedAt: new Date('2026-03-01T00:00:00Z'),
          bankConfirmedByUserId: actorId,
          createdByUserId: actorId,
          ...data,
        },
      });
    },
  };
  return fixture;
}

export type FinancialReportFixture = Awaited<
  ReturnType<typeof createFinancialReportFixture>
>;
