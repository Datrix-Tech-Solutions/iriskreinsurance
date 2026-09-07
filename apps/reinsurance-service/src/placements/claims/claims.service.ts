import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimAllocationStatus,
  PlacementClaimCashCallStatus,
  PlacementClaimCedantSettlementStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimState,
  PlacementClaimStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { assertUserHasAnyPermission } from '../../auth/permissions/permission-assertions';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaimAllocationCalculator } from './allocation/allocation.calculator';
import { ClosingSnapshot } from '../closings/closing-snapshot.reader';
import { CreatePlacementClaimDto } from '../dto/create-placement-claim.dto';
import { UpdatePlacementClaimStatusDto } from '../dto/update-placement-claim-status.dto';
import { UpdatePlacementClaimDto } from '../dto/update-placement-claim.dto';
import { PlacementClaimFinancialCloseReadinessService } from './close/financial-close-readiness.service';
import { PlacementEffectivePositionService } from '../placement-effective-position.service';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import {
  ClaimWorkflowPermission,
  PlacementPermission,
} from '../placement.permissions';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

const claimAllocationInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  placementClosing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
} satisfies Prisma.PlacementClaimAllocationInclude;

type PlacementClaimRecord = Prisma.PlacementClaimGetPayload<object>;

type PlacementClaimAllocationRecord =
  Prisma.PlacementClaimAllocationGetPayload<{
    include: typeof claimAllocationInclude;
  }>;

@Injectable()
export class PlacementClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectivePositionService: PlacementEffectivePositionService,
    private readonly effectiveViewService: PlacementEffectiveViewService,
    private readonly claimAllocationCalculator: ClaimAllocationCalculator,
    private readonly financialCloseReadiness: PlacementClaimFinancialCloseReadinessService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementClaimRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementClaim.findMany({
      where: { tenantId, placementId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimRecord> {
    await this.assertPlacement(tenantId, placementId);
    const claim = await this.prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId, placementId },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');
    return claim;
  }

  async create(
    user: RequestUser,
    placementId: string,
    dto: CreatePlacementClaimDto,
  ): Promise<PlacementClaimRecord> {
    const placement = await this.findPlacement(user.tenantId, placementId);
    const currency = this.cleanCurrency(dto.currency);
    const occurrenceDate = new Date(dto.occurrenceDate);
    await this.validateClaimAgainstEffectiveTerms({
      tenantId: user.tenantId,
      placementId,
      placementCurrency: placement.currency,
      occurrenceDate,
      currency,
      estimatedLossAmount: dto.estimatedLossAmount,
      finalLossAmount:
        dto.finalLossAmount === undefined ? null : dto.finalLossAmount,
    });

    const claimNumber = this.cleanRequired(dto.claimNumber);
    const finalLossAmount =
      dto.finalLossAmount === undefined ? null : dto.finalLossAmount;
    const claimState = dto.claimState ?? PlacementClaimState.PENDING;
    const now = new Date();

    if (
      claimState === PlacementClaimState.FINALIZED &&
      finalLossAmount === null
    ) {
      throw new BadRequestException(
        'A final loss amount is required to create a finalized claim.',
      );
    }

    const data: Prisma.PlacementClaimUncheckedCreateInput = {
      tenantId: user.tenantId,
      placementId,
      claimNumber,
      status: PlacementClaimStatus.DRAFT,
      claimState,
      occurrenceDate,
      reportedDate: new Date(dto.reportedDate),
      claimCause: this.cleanRequired(dto.claimCause),
      occurrenceDetails: this.cleanOptional(dto.occurrenceDetails),
      currency,
      estimatedLossAmount: dto.estimatedLossAmount,
      finalLossAmount,
      finalizedAt: finalLossAmount === null ? null : now,
      finalizedByUserId: finalLossAmount === null ? null : user.id,
      createdByUserId: user.id,
      updatedByUserId: user.id,
    };

    try {
      if (claimState === PlacementClaimState.FINALIZED) {
        return await this.prisma.$transaction(async (tx) => {
          const claim = await tx.placementClaim.create({ data });
          await this.runAllocationGeneration(tx, user, claim);
          return claim;
        });
      }
      return await this.prisma.placementClaim.create({ data });
    } catch (error) {
      throw this.mapClaimNumberConflict(error, claimNumber);
    }
  }

  async update(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: UpdatePlacementClaimDto,
  ): Promise<PlacementClaimRecord> {
    const claim = await this.findOne(user.tenantId, placementId, claimId);
    this.assertEditable(claim.status);
    const placement = await this.findPlacement(user.tenantId, placementId);

    const currentState = claim.claimState;
    const nextState = dto.claimState ?? currentState;

    const currency =
      dto.currency === undefined
        ? claim.currency
        : this.cleanCurrency(dto.currency);
    const occurrenceDate =
      dto.occurrenceDate === undefined
        ? claim.occurrenceDate
        : new Date(dto.occurrenceDate);
    const estimatedLossAmount =
      dto.estimatedLossAmount === undefined
        ? this.money.toNumber(claim.estimatedLossAmount)
        : dto.estimatedLossAmount;

    const finalLossAmount =
      dto.finalLossAmount === undefined ? undefined : dto.finalLossAmount;
    const effectiveFinalLossAmount =
      finalLossAmount === undefined
        ? this.money.toOptionalNumber(claim.finalLossAmount)
        : finalLossAmount;

    // FINALIZED -> PENDING: void the generated allocations so the claim's
    // financial inputs unlock. Blocked while any downstream cash call, recovery
    // or cedant settlement still references those allocations.
    if (
      currentState === PlacementClaimState.FINALIZED &&
      nextState === PlacementClaimState.PENDING
    ) {
      await this.assertClaimReversible(user.tenantId, placementId, claimId);
      return this.prisma.$transaction(async (tx) => {
        await tx.placementClaimAllocation.updateMany({
          where: {
            tenantId: user.tenantId,
            placementId,
            claimId,
            status: { not: PlacementClaimAllocationStatus.VOID },
          },
          data: { status: PlacementClaimAllocationStatus.VOID },
        });
        return tx.placementClaim.update({
          where: { id: claimId },
          data: {
            claimState: PlacementClaimState.PENDING,
            updatedByUserId: user.id,
          },
        });
      });
    }

    await this.assertNoAllocationSensitiveChanges(
      user.tenantId,
      placementId,
      claimId,
      dto,
    );
    await this.validateClaimAgainstEffectiveTerms({
      tenantId: user.tenantId,
      placementId,
      placementCurrency: placement.currency,
      occurrenceDate,
      currency,
      estimatedLossAmount,
      finalLossAmount: effectiveFinalLossAmount,
    });
    const now = new Date();
    const claimNumber =
      dto.claimNumber === undefined
        ? undefined
        : this.cleanRequired(dto.claimNumber);

    const fieldData: Prisma.PlacementClaimUpdateInput = {
      ...(claimNumber === undefined ? {} : { claimNumber }),
      ...(dto.occurrenceDate === undefined ? {} : { occurrenceDate }),
      ...(dto.reportedDate === undefined
        ? {}
        : { reportedDate: new Date(dto.reportedDate) }),
      ...(dto.claimCause === undefined
        ? {}
        : { claimCause: this.cleanRequired(dto.claimCause) }),
      ...(dto.occurrenceDetails === undefined
        ? {}
        : { occurrenceDetails: this.cleanOptional(dto.occurrenceDetails) }),
      ...(dto.currency === undefined ? {} : { currency }),
      ...(dto.estimatedLossAmount === undefined
        ? {}
        : { estimatedLossAmount: dto.estimatedLossAmount }),
      ...(finalLossAmount === undefined
        ? {}
        : {
            finalLossAmount,
            finalizedAt: now,
            finalizedByUserId: user.id,
          }),
      updatedByUserId: user.id,
    };

    // PENDING -> FINALIZED: persist the state and generate reinsurer liability
    // allocations in the same transaction.
    if (
      currentState === PlacementClaimState.PENDING &&
      nextState === PlacementClaimState.FINALIZED
    ) {
      if (effectiveFinalLossAmount == null) {
        throw new BadRequestException(
          'A final loss amount is required to finalize a claim.',
        );
      }
      try {
        return await this.prisma.$transaction(async (tx) => {
          const updated = await tx.placementClaim.update({
            where: { id: claimId },
            data: {
              ...fieldData,
              claimState: PlacementClaimState.FINALIZED,
              ...(finalLossAmount === undefined
                ? { finalizedAt: now, finalizedByUserId: user.id }
                : {}),
            },
          });
          await this.runAllocationGeneration(tx, user, updated);
          return updated;
        });
      } catch (error) {
        throw this.mapClaimNumberConflict(error, claimNumber);
      }
    }

    try {
      return await this.prisma.placementClaim.update({
        where: { id: claimId },
        data: {
          ...fieldData,
          ...(dto.claimState === undefined ? {} : { claimState: nextState }),
        },
      });
    } catch (error) {
      throw this.mapClaimNumberConflict(error, claimNumber);
    }
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: UpdatePlacementClaimStatusDto,
  ): Promise<PlacementClaimRecord> {
    const claim = await this.findOne(user.tenantId, placementId, claimId);
    if (claim.status === dto.status) return claim;
    this.assertClaimStatusPermission(user, dto.status);
    this.assertStatusTransition(claim.status, dto.status);
    await this.assertFinanciallyReadyForStatus(
      user.tenantId,
      placementId,
      claimId,
      dto.status,
    );

    const now = new Date();
    return this.prisma.placementClaim.update({
      where: { id: claimId },
      data: {
        status: dto.status,
        updatedByUserId: user.id,
        ...(dto.status === PlacementClaimStatus.CLOSED
          ? { closedAt: now }
          : {}),
        ...(dto.status === PlacementClaimStatus.VOID ? { voidedAt: now } : {}),
      },
    });
  }

  async findAllocations(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimAllocationRecord[]> {
    await this.findOne(tenantId, placementId, claimId);
    return this.prisma.placementClaimAllocation.findMany({
      where: {
        tenantId,
        placementId,
        claimId,
        // Exclude allocations voided by a finalize -> pending reversal so a later
        // re-finalize doesn't appear to double the set.
        status: { not: PlacementClaimAllocationStatus.VOID },
      },
      include: claimAllocationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateAllocations(
    user: RequestUser,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimAllocationRecord[]> {
    const claim = await this.findOne(user.tenantId, placementId, claimId);
    if (
      claim.status === PlacementClaimStatus.CLOSED ||
      claim.status === PlacementClaimStatus.VOID
    ) {
      throw new BadRequestException(
        'Cannot generate allocations for terminal claims',
      );
    }

    return this.prisma.$transaction((tx) =>
      this.runAllocationGeneration(tx, user, claim),
    );
  }

  /**
   * Generates DRAFT allocation rows for a claim from the confirmed participation
   * effective on its occurrence date. Shared by the standalone generate endpoint
   * and the PENDING -> FINALIZED transition. VOID allocations from a prior
   * finalize/reverse cycle are ignored so the claim can be rebuilt.
   */
  private async runAllocationGeneration(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    claim: PlacementClaimRecord,
  ): Promise<PlacementClaimAllocationRecord[]> {
    const { tenantId } = user;
    const { placementId, id: claimId } = claim;

    const existing = await tx.placementClaimAllocation.findFirst({
      where: {
        tenantId,
        placementId,
        claimId,
        status: { not: PlacementClaimAllocationStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Claim allocations have already been generated',
      );
    }

    const effectivePosition =
      await this.effectivePositionService.getEffectivePositionAtDate(
        tx,
        tenantId,
        placementId,
        claim.occurrenceDate,
      );
    const snapshots = effectivePosition.snapshots;

    const estimatedLossAmount = this.money.toNumber(claim.estimatedLossAmount);
    const finalLossAmount = this.money.toOptionalNumber(claim.finalLossAmount);

    const data: Prisma.PlacementClaimAllocationCreateManyInput[] =
      snapshots.map((snapshot) =>
        this.buildAllocation({
          tenantId,
          placementId,
          claimId,
          snapshot,
          estimatedLossAmount,
          finalLossAmount,
        }),
      );

    if (data.length === 0) {
      throw new BadRequestException(
        'At least one confirmed closing is required before generating claim allocations',
      );
    }

    await tx.placementClaimAllocation.createMany({ data });
    return tx.placementClaimAllocation.findMany({
      where: {
        tenantId,
        placementId,
        claimId,
        status: { not: PlacementClaimAllocationStatus.VOID },
      },
      include: claimAllocationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findPlacement(tenantId: string, placementId: string) {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: {
        id: true,
        currency: true,
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');
    return placement;
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    await this.findPlacement(tenantId, placementId);
  }

  private mapClaimNumberConflict(
    error: unknown,
    claimNumber?: string,
  ): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        claimNumber
          ? `Claim number "${claimNumber}" is already in use`
          : 'Claim number is already in use',
      );
    }
    return error;
  }

  private assertStatusTransition(
    from: PlacementClaimStatus,
    to: PlacementClaimStatus,
  ): void {
    const allowed: Record<PlacementClaimStatus, PlacementClaimStatus[]> = {
      [PlacementClaimStatus.DRAFT]: [
        PlacementClaimStatus.NOTIFIED,
        PlacementClaimStatus.DECLINED,
        PlacementClaimStatus.VOID,
      ],
      [PlacementClaimStatus.NOTIFIED]: [
        PlacementClaimStatus.RESERVED,
        PlacementClaimStatus.DECLINED,
        PlacementClaimStatus.VOID,
      ],
      [PlacementClaimStatus.RESERVED]: [
        PlacementClaimStatus.PARTIALLY_SETTLED,
        PlacementClaimStatus.DECLINED,
      ],
      [PlacementClaimStatus.PARTIALLY_SETTLED]: [PlacementClaimStatus.SETTLED],
      [PlacementClaimStatus.SETTLED]: [PlacementClaimStatus.CLOSED],
      [PlacementClaimStatus.DECLINED]: [],
      [PlacementClaimStatus.CLOSED]: [],
      [PlacementClaimStatus.VOID]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Cannot move claim from ${from} to ${to}`);
    }
  }

  private async assertFinanciallyReadyForStatus(
    tenantId: string,
    placementId: string,
    claimId: string,
    status: PlacementClaimStatus,
  ): Promise<void> {
    if (status === PlacementClaimStatus.SETTLED) {
      await this.financialCloseReadiness.assertReadyForSettlementStatus(
        tenantId,
        placementId,
        claimId,
      );
    }
    if (status === PlacementClaimStatus.CLOSED) {
      await this.financialCloseReadiness.assertReadyForClosedStatus(
        tenantId,
        placementId,
        claimId,
      );
    }
  }

  private assertEditable(status: PlacementClaimStatus): void {
    const editableStatuses: PlacementClaimStatus[] = [
      PlacementClaimStatus.DRAFT,
      PlacementClaimStatus.NOTIFIED,
      PlacementClaimStatus.RESERVED,
    ];
    if (!editableStatuses.includes(status)) {
      throw new BadRequestException(`Cannot edit claim while it is ${status}`);
    }
  }

  private assertClaimStatusPermission(
    user: RequestUser,
    status: PlacementClaimStatus,
  ): void {
    if (status === PlacementClaimStatus.NOTIFIED) {
      assertUserHasAnyPermission(user, [
        ClaimWorkflowPermission.CREATE_NOTIFICATION,
        PlacementPermission.EDIT,
      ]);
      return;
    }

    if (status === PlacementClaimStatus.VOID) {
      assertUserHasAnyPermission(user, [
        ClaimWorkflowPermission.VOID_CLAIM,
        PlacementPermission.EDIT,
      ]);
      return;
    }

    assertUserHasAnyPermission(user, [PlacementPermission.EDIT]);
  }

  private buildAllocation(input: {
    tenantId: string;
    placementId: string;
    claimId: string;
    snapshot: ClosingSnapshot;
    estimatedLossAmount: number;
    finalLossAmount: number | null;
  }): Prisma.PlacementClaimAllocationCreateManyInput {
    const calculation = this.claimAllocationCalculator.calculateFromSnapshot({
      estimatedLossAmount: input.estimatedLossAmount,
      finalLossAmount: input.finalLossAmount,
      signedLinePercent: input.snapshot.signedLinePercent,
    });

    return {
      tenantId: input.tenantId,
      placementId: input.placementId,
      claimId: input.claimId,
      ...(input.snapshot.sourceType === 'PLACEMENT_CLOSING'
        ? {
            placementClosingId: input.snapshot.closingId,
            participantId: input.snapshot.participantId,
          }
        : {
            endorsementClosingId: input.snapshot.closingId,
            endorsementParticipantId: input.snapshot.endorsementParticipantId,
          }),
      counterpartyId: input.snapshot.counterpartyId,
      signedLinePercent: input.snapshot.signedLinePercent,
      ...calculation,
      cashCallAmount: null,
      paidAmount: null,
      status: PlacementClaimAllocationStatus.DRAFT,
    };
  }

  private assertClaimCurrency(
    effectiveCurrency: string | null,
    placementCurrency: string | null,
    claimCurrency: string,
  ): void {
    const expectedCurrency = effectiveCurrency ?? placementCurrency;
    if (expectedCurrency && claimCurrency !== expectedCurrency) {
      throw new BadRequestException(
        'Claim currency must match the effective placement currency on the loss date',
      );
    }
  }

  private async assertNoAllocationSensitiveChanges(
    tenantId: string,
    placementId: string,
    claimId: string,
    dto: UpdatePlacementClaimDto,
  ): Promise<void> {
    const allocationSensitiveFields: Array<keyof UpdatePlacementClaimDto> = [
      'occurrenceDate',
      'currency',
      'estimatedLossAmount',
      'finalLossAmount',
    ];
    if (
      !allocationSensitiveFields.some((field) =>
        Object.prototype.hasOwnProperty.call(dto, field),
      )
    ) {
      return;
    }

    const existingAllocation =
      await this.prisma.placementClaimAllocation.findFirst({
        where: {
          tenantId,
          placementId,
          claimId,
          status: { not: PlacementClaimAllocationStatus.VOID },
        },
        select: { id: true },
      });
    if (existingAllocation) {
      throw new ConflictException(
        'Claim occurrence date, currency and loss amounts cannot be changed while the claim is finalized. Return it to pending to void the allocations first.',
      );
    }
  }

  /**
   * Guards the FINALIZED -> PENDING transition. The allocations can only be
   * voided while nothing downstream still points at them.
   */
  private async assertClaimReversible(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<void> {
    const scope = { tenantId, placementId, claimId };
    const [cashCall, receipt, approval, settlement] = await Promise.all([
      this.prisma.placementClaimCashCall.findFirst({
        where: { ...scope, status: { not: PlacementClaimCashCallStatus.VOID } },
        select: { id: true },
      }),
      this.prisma.placementClaimRecoveryReceipt.findFirst({
        where: {
          ...scope,
          status: {
            in: [
              PlacementClaimRecoveryReceiptStatus.RECORDED,
              PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
            ],
          },
        },
        select: { id: true },
      }),
      this.prisma.placementClaimRecoveryApproval.findFirst({
        where: scope,
        select: { id: true },
      }),
      this.prisma.placementClaimCedantSettlement.findFirst({
        where: {
          ...scope,
          status: { not: PlacementClaimCedantSettlementStatus.REVERSED },
        },
        select: { id: true },
      }),
    ]);

    if (cashCall || receipt || approval || settlement) {
      throw new ConflictException(
        'Reverse the recovery approvals, cash calls, recovery receipts and cedant settlements on this claim before returning it to pending.',
      );
    }
  }

  private async validateClaimAgainstEffectiveTerms(input: {
    tenantId: string;
    placementId: string;
    placementCurrency: string | null;
    occurrenceDate: Date;
    currency: string;
    estimatedLossAmount: number;
    finalLossAmount: number | null;
  }): Promise<void> {
    const effectiveView = await this.effectiveViewService.getEffectiveView(
      input.tenantId,
      input.placementId,
      input.occurrenceDate,
    );
    const terms = effectiveView.effectiveTerms;
    this.assertClaimCurrency(
      terms.currency,
      input.placementCurrency,
      input.currency,
    );

    const occurrenceDay = this.toUtcDateKey(input.occurrenceDate);
    if (terms.inceptionDate) {
      const inceptionDay = this.toUtcDateKey(new Date(terms.inceptionDate));
      if (occurrenceDay < inceptionDay) {
        throw new BadRequestException(
          'Claim occurrence date cannot be before the effective coverage inception date',
        );
      }
    }
    if (terms.expiryDate) {
      const expiryDay = this.toUtcDateKey(new Date(terms.expiryDate));
      if (occurrenceDay > expiryDay) {
        throw new BadRequestException(
          'Claim occurrence date cannot be after the effective coverage expiry date',
        );
      }
    }

    if (terms.sumInsured != null) {
      this.assertLossAmountWithinEffectiveLimit(
        input.estimatedLossAmount,
        terms.sumInsured,
        'Estimated loss amount',
      );
      if (input.finalLossAmount != null) {
        this.assertLossAmountWithinEffectiveLimit(
          input.finalLossAmount,
          terms.sumInsured,
          'Final loss amount',
        );
      }
    }
  }

  private assertLossAmountWithinEffectiveLimit(
    amount: number,
    effectiveSumInsured: number,
    label: string,
  ): void {
    if (amount > effectiveSumInsured) {
      throw new BadRequestException(
        `${label} cannot exceed the effective sum insured on the loss date`,
      );
    }
  }

  private toUtcDateKey(date: Date): number {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
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
}
