import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimAllocationStatus,
  PlacementClaimCedantSettlementStatus,
  PlacementClaimStatus,
  PlacementSettlementMethod,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApprovePlacementClaimPayableDto } from '../../dto/approve-placement-claim-payable.dto';
import { ConfirmPlacementClaimCedantSettlementBankDto } from '../../dto/confirm-placement-claim-cedant-settlement-bank.dto';
import { CreatePlacementClaimCedantSettlementDto } from '../../dto/create-placement-claim-cedant-settlement.dto';
import { ReversePlacementClaimCedantSettlementDto } from '../../dto/reverse-placement-claim-cedant-settlement.dto';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

const cedantSettlementInclude = {
  reversalSettlements: {
    select: { id: true },
  },
} satisfies Prisma.PlacementClaimCedantSettlementInclude;

type CedantSettlementRecord = Prisma.PlacementClaimCedantSettlementGetPayload<{
  include: typeof cedantSettlementInclude;
}>;

type ClaimApprovalRecord = Prisma.PlacementClaimGetPayload<object>;

export type ClaimCedantSettlementStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED_UNSETTLED'
  | 'PARTIALLY_SETTLED'
  | 'SETTLED';

export interface ClaimCedantSettlementPosition {
  finalLossAmount: string | null;
  approvedPayableAmount: string | null;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  recordedAmount: string;
  bankConfirmedAmount: string;
  settledAmount: string;
  reversedAmount: string;
  outstandingAmount: string;
  operationalSettledAmount: string;
  settlementStatus: ClaimCedantSettlementStatus;
}

@Injectable()
export class PlacementClaimCedantSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async approvePayable(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: ApprovePlacementClaimPayableDto,
  ): Promise<ClaimApprovalRecord> {
    const approvedAmount = this.money.roundMoney(dto.approvedPayableAmount);
    const dtoCurrency = dto.currency ? this.cleanCurrency(dto.currency) : null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const claim = await this.findClaim(
              tx,
              user.tenantId,
              placementId,
              claimId,
            );
            this.assertClaimCanBeApproved(claim);

            if (dtoCurrency && dtoCurrency !== claim.currency) {
              throw new BadRequestException(
                'Approved payable currency must match the claim currency',
              );
            }

            const finalLossAmount = this.money.toOptionalNumber(
              claim.finalLossAmount,
            );
            if (finalLossAmount === null) {
              throw new BadRequestException(
                'Final loss amount is required before approving cedant payable amount',
              );
            }
            if (approvedAmount > finalLossAmount) {
              throw new BadRequestException(
                'Approved payable amount cannot exceed the final loss amount',
              );
            }

            await this.assertClaimHasActiveReinsurerAllocations(
              tx,
              user.tenantId,
              placementId,
              claimId,
            );

            const existingApproval =
              await tx.placementClaimPayableApproval.findFirst({
                where: {
                  tenantId: user.tenantId,
                  placementId,
                  claimId,
                },
                orderBy: { approvalVersion: 'desc' },
              });
            if (existingApproval) {
              const existingAmount = this.money.roundMoney(
                this.money.toNumber(existingApproval.approvedPayableAmount),
              );
              const existingFinalLoss = this.money.roundMoney(
                this.money.toNumber(existingApproval.finalLossAmount),
              );
              if (
                existingAmount === approvedAmount &&
                existingFinalLoss === finalLossAmount &&
                existingApproval.currency === claim.currency
              ) {
                return claim;
              }
              throw new ConflictException(
                'Claim payable approval has already been recognized. Future changes require an explicit amendment or reversal workflow.',
              );
            }

            const position = await this.calculatePosition(
              tx,
              user.tenantId,
              placementId,
              claimId,
              approvedAmount,
              claim,
            );
            const settledAmount = Number(position.settledAmount);
            if (approvedAmount < settledAmount) {
              throw new ConflictException(
                'Approved payable amount cannot be lower than the amount already settled to the cedant',
              );
            }

            const approvedAt = new Date();
            await tx.placementClaimPayableApproval.create({
              data: {
                tenantId: user.tenantId,
                placementId: claim.placementId,
                claimId: claim.id,
                approvalVersion: 1,
                approvedPayableAmount: approvedAmount,
                finalLossAmount,
                currency: claim.currency,
                approvedAt,
                approvedByUserId: user.id,
                notes: this.cleanOptional(dto.notes),
              },
            });
            const approvedClaim = await tx.placementClaim.update({
              where: { id: claimId },
              data: {
                approvedPayableAmount: approvedAmount,
                approvedAt,
                approvedByUserId: user.id,
                updatedByUserId: user.id,
              },
            });

            return approvedClaim;
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

    throw new ConflictException('Could not approve claim payable amount');
  }

  async findAll(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<CedantSettlementRecord[]> {
    await this.findClaim(this.prisma, tenantId, placementId, claimId);
    return this.prisma.placementClaimCedantSettlement.findMany({
      where: { tenantId, placementId, claimId },
      include: cedantSettlementInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: CreatePlacementClaimCedantSettlementDto,
  ): Promise<CedantSettlementRecord> {
    const currency = this.cleanCurrency(dto.currency);
    const amount = this.money.roundMoney(dto.amount);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const claim = await this.findClaim(
              tx,
              user.tenantId,
              placementId,
              claimId,
            );
            this.assertClaimCanBeSettled(claim);

            if (currency !== claim.currency) {
              throw new BadRequestException(
                'Cedant settlement currency must match the claim currency',
              );
            }

            const approvedPayableAmount = this.money.toOptionalNumber(
              claim.approvedPayableAmount,
            );
            if (approvedPayableAmount === null) {
              throw new BadRequestException(
                'Approved payable amount is required before recording cedant settlement',
              );
            }
            const payableApproval = await this.resolvePayableApproval(
              tx,
              user.tenantId,
              placementId,
              claimId,
              dto.payableApprovalId,
            );
            const approvedAmount = this.money.toNumber(
              payableApproval.approvedPayableAmount,
            );
            if (currency !== payableApproval.currency) {
              throw new BadRequestException(
                'Cedant settlement currency must match the payable approval currency',
              );
            }

            const position = await this.calculatePosition(
              tx,
              user.tenantId,
              placementId,
              claimId,
              approvedAmount,
              claim,
            );
            const operationalOutstanding =
              approvedAmount - Number(position.operationalSettledAmount);
            if (amount > operationalOutstanding) {
              throw new ConflictException(
                'Cedant settlement amount cannot exceed the outstanding approved payable balance',
              );
            }
            const settlementCurrency = this.resolveSettlementCurrency(
              dto.settlementCurrency,
              currency,
            );
            this.assertFxFacts(
              currency,
              settlementCurrency,
              dto.agreedExchangeRate,
            );

            return tx.placementClaimCedantSettlement.create({
              data: {
                tenantId: user.tenantId,
                placementId: claim.placementId,
                claimId: claim.id,
                payableApprovalId: payableApproval.id,
                currency,
                amount,
                settlementDate: new Date(dto.settlementDate),
                reference: this.cleanOptional(dto.reference),
                settlementMethod: dto.settlementMethod ?? null,
                settlementCurrency,
                agreedExchangeRate: dto.agreedExchangeRate ?? null,
                notes: this.cleanOptional(dto.notes),
                status: PlacementClaimCedantSettlementStatus.RECORDED,
                createdByUserId: user.id,
              },
              include: cedantSettlementInclude,
            });
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

    throw new ConflictException('Could not record cedant settlement');
  }

  async confirmBankSettlement(
    user: RequestUser,
    placementId: string,
    claimId: string,
    settlementId: string,
    dto: ConfirmPlacementClaimCedantSettlementBankDto,
  ): Promise<CedantSettlementRecord> {
    const settlement =
      await this.prisma.placementClaimCedantSettlement.findFirst({
        where: {
          id: settlementId,
          tenantId: user.tenantId,
          placementId,
          claimId,
        },
        include: cedantSettlementInclude,
      });
    if (!settlement) {
      throw new NotFoundException(
        'Placement claim cedant settlement not found',
      );
    }
    if (settlement.reversalOfSettlementId) {
      throw new BadRequestException(
        'Cannot financially confirm a reversal cedant settlement',
      );
    }
    if (
      settlement.status === PlacementClaimCedantSettlementStatus.BANK_CONFIRMED
    ) {
      throw new ConflictException(
        'Cedant settlement has already been financially confirmed',
      );
    }
    if (settlement.status !== PlacementClaimCedantSettlementStatus.RECORDED) {
      throw new BadRequestException(
        `Cannot financially confirm a cedant settlement from ${settlement.status}`,
      );
    }

    const settlementMethod = this.resolveConfirmationSettlementMethod(
      settlement,
      dto.settlementMethod,
    );
    const settlementCurrency = this.resolveConfirmationSettlementCurrency(
      settlement,
      dto.settlementCurrency,
    );
    const bankReference = this.resolveConfirmationBankReference(
      settlement,
      dto.bankReference,
    );
    const confirmedExchangeRate =
      dto.confirmedExchangeRate ?? dto.agreedExchangeRate ?? undefined;
    this.assertConfirmationFacts({
      settlementMethod,
      bankReference,
      operationalReference: settlement.reference,
      accountingCashAccountId: dto.accountingCashAccountId,
      notes: dto.notes,
    });
    this.assertFxFacts(
      settlement.currency,
      settlementCurrency,
      confirmedExchangeRate ??
        this.optionalDecimalToNumber(settlement.agreedExchangeRate),
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const claim = await this.findClaim(
              tx,
              user.tenantId,
              placementId,
              claimId,
            );
            const payableApproval = await this.resolvePayableApproval(
              tx,
              user.tenantId,
              placementId,
              claimId,
              settlement.payableApprovalId,
            );
            const approvedAmount = this.money.toNumber(
              payableApproval.approvedPayableAmount,
            );
            const position = await this.calculatePosition(
              tx,
              user.tenantId,
              placementId,
              claimId,
              approvedAmount,
              claim,
            );
            const confirmedOutstanding =
              approvedAmount - Number(position.bankConfirmedAmount);
            const amount = this.money.toNumber(settlement.amount);
            if (amount > confirmedOutstanding) {
              throw new ConflictException(
                'Cedant settlement confirmation cannot exceed the outstanding approved payable balance',
              );
            }

            const updateResult =
              await tx.placementClaimCedantSettlement.updateMany({
                where: {
                  id: settlementId,
                  tenantId: user.tenantId,
                  placementId,
                  claimId,
                  status: PlacementClaimCedantSettlementStatus.RECORDED,
                },
                data: {
                  status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
                  payableApprovalId: payableApproval.id,
                  bankConfirmedAt: new Date(dto.bankConfirmedAt),
                  bankConfirmedByUserId: user.id,
                  settlementMethod,
                  settlementCurrency,
                  bankReference,
                  accountingCashAccountId: dto.accountingCashAccountId ?? null,
                  agreedExchangeRate:
                    confirmedExchangeRate ?? settlement.agreedExchangeRate,
                  bankChargeAmount: dto.bankChargeAmount ?? 0,
                  notes: this.appendConfirmationNotes(
                    settlement.notes,
                    dto.notes,
                  ),
                },
              });
            if (updateResult.count !== 1) {
              throw new ConflictException(
                'Cedant settlement could not be financially confirmed because its status changed',
              );
            }

            const confirmed = await tx.placementClaimCedantSettlement.findFirst(
              {
                where: {
                  id: settlementId,
                  tenantId: user.tenantId,
                  placementId,
                  claimId,
                },
                include: cedantSettlementInclude,
              },
            );
            if (!confirmed) {
              throw new NotFoundException(
                'Placement claim cedant settlement not found',
              );
            }

            return confirmed;
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

    throw new ConflictException(
      'Could not financially confirm cedant settlement',
    );
  }

  async reverse(
    user: RequestUser,
    placementId: string,
    claimId: string,
    settlementId: string,
    dto: ReversePlacementClaimCedantSettlementDto,
  ): Promise<CedantSettlementRecord> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const settlement =
              await tx.placementClaimCedantSettlement.findFirst({
                where: {
                  id: settlementId,
                  tenantId: user.tenantId,
                  placementId,
                  claimId,
                },
                include: cedantSettlementInclude,
              });
            if (!settlement) {
              throw new NotFoundException(
                'Placement claim cedant settlement not found',
              );
            }
            if (settlement.reversalOfSettlementId) {
              throw new BadRequestException(
                'Cannot reverse a reversal cedant settlement',
              );
            }
            if (
              settlement.status ===
                PlacementClaimCedantSettlementStatus.REVERSED ||
              settlement.reversalSettlements.length > 0
            ) {
              throw new ConflictException(
                'Cedant settlement has already been reversed',
              );
            }
            const claim = await this.findClaim(
              tx,
              user.tenantId,
              placementId,
              claimId,
            );
            this.assertClaimAllowsFinancialReversal(claim.status);

            await tx.placementClaimCedantSettlement.update({
              where: { id: settlement.id },
              data: { status: PlacementClaimCedantSettlementStatus.REVERSED },
            });

            const confirmedOriginal =
              settlement.status ===
              PlacementClaimCedantSettlementStatus.BANK_CONFIRMED;
            const reversal = await tx.placementClaimCedantSettlement.create({
              data: {
                tenantId: settlement.tenantId,
                placementId: settlement.placementId,
                claimId: settlement.claimId,
                payableApprovalId: settlement.payableApprovalId,
                currency: settlement.currency,
                amount: settlement.amount.negated(),
                settlementDate: new Date(),
                reference: settlement.reference
                  ? `REVERSAL:${settlement.reference}`
                  : `REVERSAL:${settlement.id}`,
                settlementMethod: settlement.settlementMethod,
                settlementCurrency: settlement.settlementCurrency,
                bankReference: confirmedOriginal
                  ? settlement.bankReference
                    ? `REVERSAL:${settlement.bankReference}`
                    : `REVERSAL:${settlement.id}`
                  : null,
                accountingCashAccountId: confirmedOriginal
                  ? settlement.accountingCashAccountId
                  : null,
                bankConfirmedAt: confirmedOriginal ? new Date() : null,
                bankConfirmedByUserId: confirmedOriginal ? user.id : null,
                agreedExchangeRate: settlement.agreedExchangeRate,
                bankChargeAmount: confirmedOriginal
                  ? settlement.bankChargeAmount.negated()
                  : 0,
                notes: this.cleanOptional(dto.notes),
                status: confirmedOriginal
                  ? PlacementClaimCedantSettlementStatus.BANK_CONFIRMED
                  : PlacementClaimCedantSettlementStatus.RECORDED,
                reversalOfSettlementId: settlement.id,
                createdByUserId: user.id,
              },
              include: cedantSettlementInclude,
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

    throw new ConflictException('Could not reverse cedant settlement');
  }

  async getPosition(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<ClaimCedantSettlementPosition> {
    const claim = await this.findClaim(
      this.prisma,
      tenantId,
      placementId,
      claimId,
    );
    const approvedPayableAmount = this.money.toOptionalNumber(
      claim.approvedPayableAmount,
    );
    return this.calculatePosition(
      this.prisma,
      tenantId,
      placementId,
      claimId,
      approvedPayableAmount,
      claim,
    );
  }

  async calculatePosition(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
    approvedPayableAmount: number | null,
    claim?: ClaimApprovalRecord,
  ): Promise<ClaimCedantSettlementPosition> {
    const claimRecord =
      claim ?? (await this.findClaim(prisma, tenantId, placementId, claimId));
    const settlements = await prisma.placementClaimCedantSettlement.findMany({
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
    const operationalSettledAmount = this.money.roundMoney(
      recordedAmount + settledAmount,
    );
    const approved = approvedPayableAmount;
    const outstandingAmount =
      approved === null
        ? 0
        : Math.max(0, this.money.roundMoney(approved - settledAmount));
    const settlementStatus: ClaimCedantSettlementStatus =
      approved === null
        ? 'PENDING_APPROVAL'
        : settledAmount <= 0
          ? 'APPROVED_UNSETTLED'
          : outstandingAmount <= 0
            ? 'SETTLED'
            : 'PARTIALLY_SETTLED';

    return {
      finalLossAmount: this.formatOptionalMoney(claimRecord.finalLossAmount),
      approvedPayableAmount:
        approved === null ? null : this.formatMoney(approved),
      approvedAt: claimRecord.approvedAt,
      approvedByUserId: claimRecord.approvedByUserId,
      recordedAmount: this.formatMoney(recordedAmount),
      bankConfirmedAmount: this.formatMoney(settledAmount),
      settledAmount: this.formatMoney(settledAmount),
      reversedAmount: this.formatMoney(reversedAmount),
      outstandingAmount: this.formatMoney(outstandingAmount),
      operationalSettledAmount: this.formatMoney(operationalSettledAmount),
      settlementStatus,
    };
  }

  private async findClaim(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<ClaimApprovalRecord> {
    const placement = await prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const claim = await prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId, placementId },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');
    return claim;
  }

  private assertClaimCanBeApproved(claim: ClaimApprovalRecord): void {
    if (
      claim.status === PlacementClaimStatus.CLOSED ||
      claim.status === PlacementClaimStatus.DECLINED ||
      claim.status === PlacementClaimStatus.VOID
    ) {
      throw new BadRequestException(
        'Terminal claims cannot have payable amount approved',
      );
    }
  }

  private async assertClaimHasActiveReinsurerAllocations(
    prisma: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<void> {
    const allocationCount = await prisma.placementClaimAllocation.count({
      where: {
        tenantId,
        placementId,
        claimId,
        status: { not: PlacementClaimAllocationStatus.VOID },
      },
    });
    if (allocationCount <= 0) {
      throw new BadRequestException(
        'At least one active reinsurer claim allocation is required before approving claim payable recognition',
      );
    }
  }

  private assertClaimCanBeSettled(claim: ClaimApprovalRecord): void {
    if (
      claim.status === PlacementClaimStatus.CLOSED ||
      claim.status === PlacementClaimStatus.DECLINED ||
      claim.status === PlacementClaimStatus.VOID
    ) {
      throw new BadRequestException('Terminal claims cannot be settled');
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
        'Financial settlement reversals are blocked once a claim is settled or closed. Reopen the claim through an authorized workflow before reversing financial history.',
      );
    }
  }

  private async resolvePayableApproval(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
    payableApprovalId: string | null | undefined,
  ) {
    const approval = await prisma.placementClaimPayableApproval.findFirst({
      where: {
        tenantId,
        placementId,
        claimId,
        ...(payableApprovalId ? { id: payableApprovalId } : {}),
      },
      orderBy: { approvalVersion: 'desc' },
    });
    if (!approval) {
      throw new BadRequestException(
        'Claim payable approval is required before recording or confirming cedant settlement',
      );
    }
    return approval;
  }

  private resolveSettlementCurrency(
    requested: string | undefined,
    payableCurrency: string,
  ): string {
    return this.cleanCurrency(requested ?? payableCurrency);
  }

  private resolveConfirmationSettlementMethod(
    settlement: CedantSettlementRecord,
    requested: PlacementSettlementMethod | undefined,
  ): PlacementSettlementMethod {
    if (settlement.settlementMethod) {
      if (requested && requested !== settlement.settlementMethod) {
        throw new BadRequestException(
          'Confirmation cannot change the operational settlement method',
        );
      }
      return settlement.settlementMethod;
    }
    return requested ?? PlacementSettlementMethod.BANK_TRANSFER;
  }

  private resolveConfirmationSettlementCurrency(
    settlement: CedantSettlementRecord,
    requested: string | undefined,
  ): string {
    if (settlement.settlementCurrency) {
      const cleanedRequested = this.cleanOptional(requested);
      if (
        cleanedRequested &&
        this.cleanCurrency(cleanedRequested) !== settlement.settlementCurrency
      ) {
        throw new BadRequestException(
          'Confirmation cannot change the operational settlement currency',
        );
      }
      return settlement.settlementCurrency;
    }
    return this.cleanCurrency(requested ?? settlement.currency);
  }

  private resolveConfirmationBankReference(
    settlement: CedantSettlementRecord,
    requested: string | undefined,
  ): string | null {
    if (settlement.bankReference) {
      const cleanedRequested = this.cleanOptional(requested);
      if (cleanedRequested && cleanedRequested !== settlement.bankReference) {
        throw new BadRequestException(
          'Confirmation cannot change the bank confirmation reference',
        );
      }
      return settlement.bankReference;
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

  private assertFxFacts(
    payableCurrency: string,
    settlementCurrency: string,
    exchangeRate: number | undefined,
  ): void {
    if (this.cleanCurrency(payableCurrency) === settlementCurrency) return;
    if (!exchangeRate) {
      throw new BadRequestException(
        'Cross-currency cedant claim settlement requires a persisted agreed FX rate',
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
}
