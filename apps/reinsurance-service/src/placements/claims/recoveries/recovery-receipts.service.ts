import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimCedantSettlementStatus,
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimStatus,
  PlacementSettlementMethod,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfirmPlacementClaimRecoveryReceiptBankDto } from '../../dto/confirm-placement-claim-recovery-receipt-bank.dto';
import { CreatePlacementClaimRecoveryReceiptDto } from '../../dto/create-placement-claim-recovery-receipt.dto';
import { ReversePlacementClaimRecoveryReceiptDto } from '../../dto/reverse-placement-claim-recovery-receipt.dto';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

const receiptInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  reversalReceipts: {
    select: { id: true },
  },
} satisfies Prisma.PlacementClaimRecoveryReceiptInclude;

const cashCallInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  allocation: {
    select: {
      id: true,
      allocatedEstimatedLossAmount: true,
      allocatedFinalLossAmount: true,
      recoveryApprovals: {
        select: {
          id: true,
          approvedAmount: true,
          currency: true,
          cashCallId: true,
          counterpartyId: true,
        },
      },
    },
  },
  recoveryReceipts: {
    include: receiptInclude,
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.PlacementClaimCashCallInclude;

type RecoveryReceiptRecord = Prisma.PlacementClaimRecoveryReceiptGetPayload<{
  include: typeof receiptInclude;
}>;

type CashCallWithRecoveryRecords = Prisma.PlacementClaimCashCallGetPayload<{
  include: typeof cashCallInclude;
}>;

export type ClaimRecoveryStatus =
  | 'UNRECOVERED'
  | 'PARTIALLY_RECOVERED'
  | 'FULLY_RECOVERED';

export interface ClaimRecoveryPosition {
  claimId: string;
  placementId: string;
  currency: string;
  claim: {
    finalLossAmount: string | null;
    approvedPayableAmount: string | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
  };
  recoveries: {
    totalAllocated: string;
    totalCashCalled: string;
    totalRecovered: string;
    totalRecorded: string;
    totalConfirmed: string;
    totalReversed: string;
    totalOutstanding: string;
  };
  perCashCall: Array<{
    cashCallId: string;
    allocationId: string;
    counterpartyId: string;
    counterparty: CashCallWithRecoveryRecords['counterparty'];
    cashCallNumber: string;
    cashCallStatus: PlacementClaimCashCallStatus;
    currency: string;
    calledAmount: string;
    recoveredAmount: string;
    recordedAmount: string;
    confirmedAmount: string;
    reversedAmount: string;
    outstandingAmount: string;
    recoveryStatus: ClaimRecoveryStatus;
    receipts: RecoveryReceiptRecord[];
  }>;
  cedantSettlement: {
    approvedPayableAmount: string | null;
    settledAmount: string;
    recordedAmount: string;
    bankConfirmedAmount: string;
    reversedAmount: string;
    outstandingAmount: string;
    operationalSettledAmount: string;
    settlementStatus:
      | 'PENDING_APPROVAL'
      | 'APPROVED_UNSETTLED'
      | 'PARTIALLY_SETTLED'
      | 'SETTLED';
  };
  funding: {
    brokerFundedExposure: string;
    recoveredMinusSettled: string;
  };
  cedantSettlementStatus: string;
}

@Injectable()
export class PlacementClaimRecoveryReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<RecoveryReceiptRecord[]> {
    await this.assertCashCall(tenantId, placementId, claimId, cashCallId);
    return this.prisma.placementClaimRecoveryReceipt.findMany({
      where: { tenantId, placementId, claimId, cashCallId },
      include: receiptInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    user: RequestUser,
    placementId: string,
    claimId: string,
    cashCallId: string,
    dto: CreatePlacementClaimRecoveryReceiptDto,
  ): Promise<RecoveryReceiptRecord> {
    const currency = this.cleanCurrency(dto.currency);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const cashCall = await this.findCashCall(
              tx,
              user.tenantId,
              placementId,
              claimId,
              cashCallId,
            );
            this.assertCashCallReceivable(cashCall.status);

            if (currency !== cashCall.currency) {
              throw new BadRequestException(
                'Recovery receipt currency must match the cash call currency',
              );
            }

            const recoveryApproval = this.resolveRecoveryApproval(
              cashCall,
              dto,
            );
            const position = this.calculateCashCallPosition(cashCall);
            const operationalOutstanding =
              recoveryApproval.approvedAmount -
              position.operationalReceivedAmount;
            if (dto.amount > operationalOutstanding) {
              throw new ConflictException(
                'Recovery receipt amount cannot exceed the approved recovery balance',
              );
            }

            const settlementCurrency =
              this.resolveOperationalSettlementCurrency(
                dto.settlementCurrency,
                currency,
              );
            this.assertReceiptFxFacts(
              currency,
              settlementCurrency,
              dto.agreedExchangeRate,
            );

            return tx.placementClaimRecoveryReceipt.create({
              data: {
                tenantId: user.tenantId,
                placementId: cashCall.placementId,
                claimId: cashCall.claimId,
                allocationId: cashCall.allocationId,
                cashCallId: cashCall.id,
                recoveryApprovalId: recoveryApproval.id,
                counterpartyId: cashCall.counterpartyId,
                currency,
                amount: dto.amount,
                paymentDate: new Date(dto.paymentDate),
                reference: this.cleanOptional(dto.reference),
                settlementMethod: dto.settlementMethod ?? null,
                settlementCurrency,
                agreedExchangeRate: dto.agreedExchangeRate ?? null,
                notes: this.cleanOptional(dto.notes),
                status: PlacementClaimRecoveryReceiptStatus.RECORDED,
                createdByUserId: user.id,
              },
              include: receiptInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        if (this.isUniqueConstraintConflict(error)) {
          throw new ConflictException(
            'Recovery receipt has already been reversed',
          );
        }
        throw error;
      }
    }

    throw new ConflictException('Could not record recovery receipt');
  }

  async confirmBankReceipt(
    user: RequestUser,
    placementId: string,
    claimId: string,
    receiptId: string,
    dto: ConfirmPlacementClaimRecoveryReceiptBankDto,
  ): Promise<RecoveryReceiptRecord> {
    const receipt = await this.prisma.placementClaimRecoveryReceipt.findFirst({
      where: {
        id: receiptId,
        tenantId: user.tenantId,
        placementId,
        claimId,
      },
      include: receiptInclude,
    });
    if (!receipt) {
      throw new NotFoundException('Placement claim recovery receipt not found');
    }
    if (receipt.reversalOfReceiptId) {
      throw new BadRequestException(
        'Cannot financially confirm a reversal recovery receipt',
      );
    }
    if (receipt.status === PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED) {
      throw new ConflictException(
        'Recovery receipt has already been financially confirmed',
      );
    }
    if (receipt.status !== PlacementClaimRecoveryReceiptStatus.RECORDED) {
      throw new BadRequestException(
        `Cannot financially confirm a recovery receipt from ${receipt.status}`,
      );
    }

    const settlementMethod = this.resolveConfirmationSettlementMethod(
      receipt,
      dto.settlementMethod,
    );
    const settlementCurrency = this.resolveConfirmationSettlementCurrency(
      receipt,
      dto.settlementCurrency,
    );
    const bankReference = this.resolveConfirmationBankReference(
      receipt,
      dto.bankReference,
    );
    const confirmedExchangeRate =
      dto.confirmedExchangeRate ?? dto.agreedExchangeRate ?? undefined;
    this.assertConfirmationFacts({
      settlementMethod,
      bankReference,
      operationalReference: receipt.reference,
      accountingCashAccountId: dto.accountingCashAccountId,
      notes: dto.notes,
    });
    this.assertReceiptFxFacts(
      receipt.currency,
      settlementCurrency,
      confirmedExchangeRate ??
        this.optionalDecimalToNumber(receipt.agreedExchangeRate),
    );
    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.placementClaimRecoveryReceipt.updateMany({
        where: {
          id: receiptId,
          tenantId: user.tenantId,
          placementId,
          claimId,
          status: PlacementClaimRecoveryReceiptStatus.RECORDED,
        },
        data: {
          status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
          bankConfirmedAt: new Date(dto.bankConfirmedAt),
          bankConfirmedByUserId: user.id,
          settlementMethod,
          settlementCurrency,
          bankReference,
          accountingCashAccountId: dto.accountingCashAccountId ?? null,
          agreedExchangeRate:
            confirmedExchangeRate ?? receipt.agreedExchangeRate,
          bankChargeAmount: dto.bankChargeAmount ?? 0,
          notes: this.appendConfirmationNotes(receipt.notes, dto.notes),
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'Recovery receipt could not be financially confirmed because its status changed',
        );
      }

      const confirmed = await tx.placementClaimRecoveryReceipt.findFirst({
        where: { id: receiptId, tenantId: user.tenantId, placementId, claimId },
        include: receiptInclude,
      });
      if (!confirmed) {
        throw new NotFoundException(
          'Placement claim recovery receipt not found',
        );
      }

      return confirmed;
    });
  }

  async reverse(
    user: RequestUser,
    placementId: string,
    claimId: string,
    receiptId: string,
    dto: ReversePlacementClaimRecoveryReceiptDto,
  ): Promise<RecoveryReceiptRecord> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const receipt = await tx.placementClaimRecoveryReceipt.findFirst({
              where: {
                id: receiptId,
                tenantId: user.tenantId,
                placementId,
                claimId,
              },
              include: receiptInclude,
            });
            if (!receipt) {
              throw new NotFoundException(
                'Placement claim recovery receipt not found',
              );
            }
            if (receipt.reversalOfReceiptId) {
              throw new BadRequestException(
                'Cannot reverse a reversal recovery receipt',
              );
            }
            if (
              receipt.status === PlacementClaimRecoveryReceiptStatus.REVERSED ||
              receipt.reversalReceipts.length > 0
            ) {
              throw new ConflictException(
                'Recovery receipt has already been reversed',
              );
            }
            const claim = await tx.placementClaim.findFirst({
              where: {
                id: claimId,
                tenantId: user.tenantId,
                placementId,
              },
              select: { status: true },
            });
            if (!claim) {
              throw new NotFoundException('Placement claim not found');
            }
            this.assertClaimAllowsFinancialReversal(claim.status);

            await tx.placementClaimRecoveryReceipt.update({
              where: { id: receipt.id },
              data: { status: PlacementClaimRecoveryReceiptStatus.REVERSED },
            });

            const confirmedOriginal =
              receipt.status ===
              PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED;
            const reversal = await tx.placementClaimRecoveryReceipt.create({
              data: {
                tenantId: receipt.tenantId,
                placementId: receipt.placementId,
                claimId: receipt.claimId,
                allocationId: receipt.allocationId,
                cashCallId: receipt.cashCallId,
                recoveryApprovalId: receipt.recoveryApprovalId,
                counterpartyId: receipt.counterpartyId,
                currency: receipt.currency,
                // Recovery receipt amounts are constrained to positive values.
                // The immutable reversal link and reversal event carry the
                // financial direction; position calculations exclude reversal
                // rows from recovered amounts and report them separately.
                amount: receipt.amount,
                paymentDate: new Date(),
                reference: receipt.reference
                  ? `REVERSAL:${receipt.reference}`
                  : `REVERSAL:${receipt.id}`,
                settlementMethod: receipt.settlementMethod,
                settlementCurrency: receipt.settlementCurrency,
                bankReference: confirmedOriginal
                  ? receipt.bankReference
                    ? `REVERSAL:${receipt.bankReference}`
                    : `REVERSAL:${receipt.id}`
                  : null,
                accountingCashAccountId: confirmedOriginal
                  ? receipt.accountingCashAccountId
                  : null,
                bankConfirmedAt: confirmedOriginal ? new Date() : null,
                bankConfirmedByUserId: confirmedOriginal ? user.id : null,
                agreedExchangeRate: receipt.agreedExchangeRate,
                bankChargeAmount: confirmedOriginal
                  ? receipt.bankChargeAmount.negated()
                  : 0,
                notes: this.cleanOptional(dto.notes),
                status: confirmedOriginal
                  ? PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED
                  : PlacementClaimRecoveryReceiptStatus.RECORDED,
                reversalOfReceiptId: receipt.id,
                createdByUserId: user.id,
              },
              include: receiptInclude,
            });

            return reversal;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Could not reverse recovery receipt');
  }

  async getRecoveryPosition(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<ClaimRecoveryPosition> {
    const claim = await this.prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId, placementId },
      select: {
        id: true,
        placementId: true,
        currency: true,
        finalLossAmount: true,
        approvedPayableAmount: true,
        approvedAt: true,
        approvedByUserId: true,
      },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');

    const cashCalls = await this.prisma.placementClaimCashCall.findMany({
      where: { tenantId, placementId, claimId },
      include: cashCallInclude,
      orderBy: { createdAt: 'asc' },
    });

    const perCashCall = cashCalls.map((cashCall) => {
      const position = this.calculateCashCallPosition(cashCall);
      return {
        cashCallId: cashCall.id,
        allocationId: cashCall.allocationId,
        counterpartyId: cashCall.counterpartyId,
        counterparty: cashCall.counterparty,
        cashCallNumber: cashCall.cashCallNumber,
        cashCallStatus: cashCall.status,
        currency: cashCall.currency,
        calledAmount: this.formatMoney(cashCall.amount),
        recoveredAmount: this.formatMoney(position.recoveredAmount),
        recordedAmount: this.formatMoney(position.recordedAmount),
        confirmedAmount: this.formatMoney(position.confirmedAmount),
        reversedAmount: this.formatMoney(position.reversedAmount),
        outstandingAmount: this.formatMoney(position.outstandingAmount),
        recoveryStatus: position.recoveryStatus,
        receipts: cashCall.recoveryReceipts,
      };
    });

    const totalAllocated = cashCalls.reduce(
      (sum, cashCall) =>
        sum +
        this.money.toNumber(
          cashCall.allocation.allocatedFinalLossAmount ??
            cashCall.allocation.allocatedEstimatedLossAmount,
        ),
      0,
    );
    const effectiveCashCalls = cashCalls.filter((cashCall) =>
      this.isRecoverableCashCallStatus(cashCall.status),
    );
    const totalCashCalled = effectiveCashCalls.reduce(
      (sum, cashCall) => sum + this.money.toNumber(cashCall.amount),
      0,
    );
    const totalRecovered = perCashCall.reduce(
      (sum, row) => sum + Number(row.recoveredAmount),
      0,
    );
    const totalRecorded = perCashCall.reduce(
      (sum, row) => sum + Number(row.recordedAmount),
      0,
    );
    const totalConfirmed = perCashCall.reduce(
      (sum, row) => sum + Number(row.confirmedAmount),
      0,
    );
    const totalReversed = perCashCall.reduce(
      (sum, row) => sum + Number(row.reversedAmount),
      0,
    );
    const totalOutstanding = perCashCall.reduce(
      (sum, row) => sum + Number(row.outstandingAmount),
      0,
    );
    const cedantSettlement = await this.calculateCedantSettlementPosition(
      tenantId,
      placementId,
      claimId,
      this.money.toOptionalNumber(claim.approvedPayableAmount),
    );
    const brokerFundedExposure = Math.max(
      0,
      this.money.roundMoney(
        Number(cedantSettlement.settledAmount) - totalRecovered,
      ),
    );
    const recoveredMinusSettled = Math.max(
      0,
      this.money.roundMoney(
        totalRecovered - Number(cedantSettlement.settledAmount),
      ),
    );

    return {
      claimId: claim.id,
      placementId: claim.placementId,
      currency: claim.currency,
      claim: {
        finalLossAmount: this.formatOptionalMoney(claim.finalLossAmount),
        approvedPayableAmount: this.formatOptionalMoney(
          claim.approvedPayableAmount,
        ),
        approvedAt: claim.approvedAt,
        approvedByUserId: claim.approvedByUserId,
      },
      recoveries: {
        totalAllocated: this.formatMoney(totalAllocated),
        totalCashCalled: this.formatMoney(totalCashCalled),
        totalRecovered: this.formatMoney(totalRecovered),
        totalRecorded: this.formatMoney(totalRecorded),
        totalConfirmed: this.formatMoney(totalConfirmed),
        totalReversed: this.formatMoney(totalReversed),
        totalOutstanding: this.formatMoney(totalOutstanding),
      },
      perCashCall,
      cedantSettlement,
      funding: {
        brokerFundedExposure: this.formatMoney(brokerFundedExposure),
        recoveredMinusSettled: this.formatMoney(recoveredMinusSettled),
      },
      cedantSettlementStatus: cedantSettlement.settlementStatus,
    };
  }

  async hasEffectiveReceipts(
    tenantId: string,
    cashCallId: string,
  ): Promise<boolean> {
    const receipt = await this.prisma.placementClaimRecoveryReceipt.findFirst({
      where: {
        tenantId,
        cashCallId,
        status: {
          in: [
            PlacementClaimRecoveryReceiptStatus.RECORDED,
            PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
          ],
        },
        reversalOfReceiptId: null,
      },
      select: { id: true },
    });
    return !!receipt;
  }

  private async assertCashCall(
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<void> {
    await this.findCashCall(
      this.prisma,
      tenantId,
      placementId,
      claimId,
      cashCallId,
    );
  }

  private async findCashCall(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<CashCallWithRecoveryRecords> {
    const placement = await prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const cashCall = await prisma.placementClaimCashCall.findFirst({
      where: {
        id: cashCallId,
        tenantId,
        placementId,
        claimId,
      },
      include: cashCallInclude,
    });
    if (!cashCall) {
      throw new NotFoundException('Placement claim cash call not found');
    }
    return cashCall;
  }

  private assertCashCallReceivable(status: PlacementClaimCashCallStatus): void {
    if (status !== PlacementClaimCashCallStatus.ISSUED) {
      throw new BadRequestException(
        'Only issued claim cash calls can receive recovery receipts',
      );
    }
  }

  private assertClaimAllowsFinancialReversal(
    status: PlacementClaimStatus,
  ): void {
    if (
      status === PlacementClaimStatus.SETTLED ||
      status === PlacementClaimStatus.CLOSED
    ) {
      throw new ConflictException(
        'Financial recovery reversals are blocked once a claim is settled or closed. Reopen the claim through an authorized workflow before reversing financial history.',
      );
    }
  }

  private resolveRecoveryApproval(
    cashCall: CashCallWithRecoveryRecords,
    dto: CreatePlacementClaimRecoveryReceiptDto,
  ): {
    id: string;
    approvedAmount: number;
    currency: string;
    cashCallId: string | null;
    counterpartyId: string;
  } {
    const approvals = cashCall.allocation.recoveryApprovals.filter(
      (approval) =>
        approval.currency === cashCall.currency &&
        approval.counterpartyId === cashCall.counterpartyId &&
        (!approval.cashCallId || approval.cashCallId === cashCall.id),
    );
    if (approvals.length === 0) {
      throw new ConflictException(
        'Recovery receipt requires an approved claim recovery before cash can be recorded',
      );
    }

    if (dto.recoveryApprovalId) {
      const requested = approvals.find(
        (approval) => approval.id === dto.recoveryApprovalId,
      );
      if (!requested) {
        throw new NotFoundException(
          'Placement claim recovery approval not found for this cash call',
        );
      }
      return {
        ...requested,
        approvedAmount: this.money.toNumber(requested.approvedAmount),
      };
    }

    if (approvals.length > 1) {
      throw new BadRequestException(
        'Recovery approval ID is required when multiple approved recoveries exist for this cash call',
      );
    }

    const [approval] = approvals;
    return {
      ...approval,
      approvedAmount: this.money.toNumber(approval.approvedAmount),
    };
  }

  private approvedRecoveryAmount(
    cashCall: CashCallWithRecoveryRecords,
  ): number {
    const approvals = cashCall.allocation.recoveryApprovals.filter(
      (approval) =>
        approval.currency === cashCall.currency &&
        approval.counterpartyId === cashCall.counterpartyId &&
        (!approval.cashCallId || approval.cashCallId === cashCall.id),
    );
    const approvedAmount = approvals.reduce(
      (sum, approval) => sum + this.money.toNumber(approval.approvedAmount),
      0,
    );
    return approvedAmount > 0
      ? this.money.roundMoney(approvedAmount)
      : this.money.toNumber(cashCall.amount);
  }

  private calculateCashCallPosition(cashCall: CashCallWithRecoveryRecords) {
    const isRecoverable = this.isRecoverableCashCallStatus(cashCall.status);
    const recordedReceipts = cashCall.recoveryReceipts.filter(
      (receipt) =>
        receipt.status === PlacementClaimRecoveryReceiptStatus.RECORDED &&
        !receipt.reversalOfReceiptId,
    );
    const confirmedReceipts = cashCall.recoveryReceipts.filter(
      (receipt) =>
        receipt.status === PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED &&
        !receipt.reversalOfReceiptId,
    );
    const reversalReceipts = cashCall.recoveryReceipts.filter(
      (receipt) => !!receipt.reversalOfReceiptId,
    );
    const recordedAmount = this.money.roundMoney(
      recordedReceipts.reduce(
        (sum, receipt) => sum + this.money.toNumber(receipt.amount),
        0,
      ),
    );
    const confirmedAmount = this.money.roundMoney(
      confirmedReceipts.reduce(
        (sum, receipt) => sum + this.money.toNumber(receipt.amount),
        0,
      ),
    );
    const recoveredAmount = confirmedAmount;
    const reversedAmount = this.money.roundMoney(
      reversalReceipts.reduce(
        (sum, receipt) => sum + Math.abs(this.money.toNumber(receipt.amount)),
        0,
      ),
    );
    const approvedAmount = this.approvedRecoveryAmount(cashCall);
    const outstandingAmount = Math.max(
      0,
      this.money.roundMoney(
        isRecoverable ? approvedAmount - confirmedAmount : 0,
      ),
    );
    const operationalReceivedAmount = this.money.roundMoney(
      recordedAmount + confirmedAmount,
    );
    const recoveryStatus: ClaimRecoveryStatus =
      recoveredAmount <= 0
        ? 'UNRECOVERED'
        : outstandingAmount <= 0
          ? 'FULLY_RECOVERED'
          : 'PARTIALLY_RECOVERED';

    return {
      recoveredAmount,
      recordedAmount,
      confirmedAmount,
      reversedAmount,
      outstandingAmount,
      operationalReceivedAmount,
      recoveryStatus,
    };
  }

  private isRecoverableCashCallStatus(
    status: PlacementClaimCashCallStatus,
  ): boolean {
    return (
      status === PlacementClaimCashCallStatus.ISSUED ||
      status === PlacementClaimCashCallStatus.PAID
    );
  }

  private resolveOperationalSettlementCurrency(
    requested: string | undefined,
    receiptCurrency: string,
  ): string {
    return this.cleanCurrency(requested ?? receiptCurrency);
  }

  private resolveConfirmationSettlementMethod(
    receipt: RecoveryReceiptRecord,
    requested: PlacementSettlementMethod | undefined,
  ): PlacementSettlementMethod {
    if (receipt.settlementMethod) {
      if (requested && requested !== receipt.settlementMethod) {
        throw new BadRequestException(
          'Confirmation cannot change the operational settlement method',
        );
      }
      return receipt.settlementMethod;
    }
    return requested ?? PlacementSettlementMethod.BANK_TRANSFER;
  }

  private resolveConfirmationSettlementCurrency(
    receipt: RecoveryReceiptRecord,
    requested: string | undefined,
  ): string {
    if (receipt.settlementCurrency) {
      const cleanedRequested = this.cleanOptional(requested);
      if (
        cleanedRequested &&
        this.cleanCurrency(cleanedRequested) !== receipt.settlementCurrency
      ) {
        throw new BadRequestException(
          'Confirmation cannot change the operational settlement currency',
        );
      }
      return receipt.settlementCurrency;
    }
    return this.cleanCurrency(requested ?? receipt.currency);
  }

  private resolveConfirmationBankReference(
    receipt: RecoveryReceiptRecord,
    requested: string | undefined,
  ): string | null {
    if (receipt.bankReference) {
      const cleanedRequested = this.cleanOptional(requested);
      if (cleanedRequested && cleanedRequested !== receipt.bankReference) {
        throw new BadRequestException(
          'Confirmation cannot change the bank confirmation reference',
        );
      }
      return receipt.bankReference;
    }
    return this.cleanOptional(requested);
  }

  private assertConfirmationFacts(input: {
    settlementMethod: PlacementSettlementMethod;
    bankReference: string | null;
    operationalReference: string | null;
    accountingCashAccountId?: string;
    notes?: string;
  }): void {
    const referenceRequiredMethods: PlacementSettlementMethod[] = [
      PlacementSettlementMethod.BANK_TRANSFER,
      PlacementSettlementMethod.CHEQUE,
      PlacementSettlementMethod.MOBILE_MONEY,
    ];
    const referenceRequired = referenceRequiredMethods.includes(
      input.settlementMethod,
    );
    const hasReference = Boolean(
      input.bankReference || input.operationalReference,
    );
    if (referenceRequired && !hasReference) {
      throw new BadRequestException(
        `${input.settlementMethod} confirmation requires a settlement reference`,
      );
    }
    if (
      input.settlementMethod === PlacementSettlementMethod.OTHER &&
      !hasReference &&
      !this.cleanOptional(input.notes)
    ) {
      throw new BadRequestException(
        'OTHER settlement method requires either a reference or confirmation notes',
      );
    }
  }

  private assertReceiptFxFacts(
    receiptCurrency: string,
    settlementCurrency: string,
    exchangeRate: number | undefined,
  ): void {
    if (this.cleanCurrency(receiptCurrency) === settlementCurrency) return;
    if (!exchangeRate) {
      throw new BadRequestException(
        'Cross-currency claim recovery receipt requires a persisted agreed FX rate',
      );
    }
  }

  private appendConfirmationNotes(
    existing: string | null,
    confirmationNotes: string | undefined,
  ): string | null {
    const cleaned = this.cleanOptional(confirmationNotes);
    if (!cleaned) return existing;
    return existing
      ? `${existing}\n\nFinancial confirmation: ${cleaned}`
      : cleaned;
  }

  private optionalDecimalToNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | undefined {
    if (value === null || value === undefined) return undefined;
    return this.money.toNumber(value);
  }

  private formatMoney(value: Prisma.Decimal | number | string): string {
    return this.money.roundMoney(this.money.toNumber(value)).toFixed(2);
  }

  private formatOptionalMoney(
    value: Prisma.Decimal | number | string | null,
  ): string | null {
    return value === null ? null : this.formatMoney(value);
  }

  private async calculateCedantSettlementPosition(
    tenantId: string,
    placementId: string,
    claimId: string,
    approvedPayableAmount: number | null,
  ): Promise<ClaimRecoveryPosition['cedantSettlement']> {
    const settlements =
      await this.prisma.placementClaimCedantSettlement.findMany({
        where: { tenantId, placementId, claimId },
        select: {
          amount: true,
          status: true,
          reversalOfSettlementId: true,
        },
      });
    const settledAmount = this.money.roundMoney(
      settlements
        .filter(
          (settlement) =>
            settlement.status ===
              PlacementClaimCedantSettlementStatus.BANK_CONFIRMED &&
            !settlement.reversalOfSettlementId,
        )
        .reduce(
          (sum, settlement) => sum + this.money.toNumber(settlement.amount),
          0,
        ),
    );
    const recordedAmount = this.money.roundMoney(
      settlements
        .filter(
          (settlement) =>
            settlement.status ===
              PlacementClaimCedantSettlementStatus.RECORDED &&
            !settlement.reversalOfSettlementId,
        )
        .reduce(
          (sum, settlement) => sum + this.money.toNumber(settlement.amount),
          0,
        ),
    );
    const reversedAmount = this.money.roundMoney(
      settlements
        .filter((settlement) => !!settlement.reversalOfSettlementId)
        .reduce(
          (sum, settlement) =>
            sum + Math.abs(this.money.toNumber(settlement.amount)),
          0,
        ),
    );
    const outstandingAmount =
      approvedPayableAmount === null
        ? 0
        : Math.max(
            0,
            this.money.roundMoney(approvedPayableAmount - settledAmount),
          );
    const settlementStatus =
      approvedPayableAmount === null
        ? 'PENDING_APPROVAL'
        : settledAmount <= 0
          ? 'APPROVED_UNSETTLED'
          : outstandingAmount <= 0
            ? 'SETTLED'
            : 'PARTIALLY_SETTLED';

    return {
      approvedPayableAmount:
        approvedPayableAmount === null
          ? null
          : this.formatMoney(approvedPayableAmount),
      settledAmount: this.formatMoney(settledAmount),
      recordedAmount: this.formatMoney(recordedAmount),
      bankConfirmedAmount: this.formatMoney(settledAmount),
      reversedAmount: this.formatMoney(reversedAmount),
      outstandingAmount: this.formatMoney(outstandingAmount),
      operationalSettledAmount: this.formatMoney(
        this.money.roundMoney(recordedAmount + settledAmount),
      ),
      settlementStatus,
    };
  }

  private cleanCurrency(value: string): string {
    return this.cleanRequired(value).toUpperCase();
  }

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Required text is missing');
    return cleaned;
  }

  private cleanOptional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private isUniqueConstraintConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
