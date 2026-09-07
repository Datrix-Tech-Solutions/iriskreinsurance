import { ApiProperty } from '@nestjs/swagger';
import { PlacementClaimStatus } from '../../../prisma/generated/client';

export const PLACEMENT_CLAIM_FINANCIAL_CLOSE_BLOCKERS = [
  'PAYABLE_NOT_APPROVED',
  'CLAIM_PAYABLE_OUTSTANDING',
  'RECOVERY_OUTSTANDING',
  'CEDANT_SETTLEMENT_CONFIRMATION_PENDING',
  'RECOVERY_RECEIPT_CONFIRMATION_PENDING',
] as const;

export type PlacementClaimFinancialCloseBlocker =
  (typeof PLACEMENT_CLAIM_FINANCIAL_CLOSE_BLOCKERS)[number];

export class PlacementClaimFinancialClosePayableDto {
  @ApiProperty({ type: String, nullable: true, example: '100000.00' })
  approvedPayableAmount!: string | null;

  @ApiProperty({ type: String, example: '100000.00' })
  bankConfirmedSettledAmount!: string;

  @ApiProperty({ type: String, example: '0.00' })
  outstandingPayable!: string;
}

export class PlacementClaimFinancialCloseRecoveryDto {
  @ApiProperty({ type: String, example: '80000.00' })
  approvedRecoveryAmount!: string;

  @ApiProperty({ type: String, example: '80000.00' })
  bankConfirmedRecoveryAmount!: string;

  @ApiProperty({ type: String, example: '0.00' })
  outstandingRecovery!: string;
}

export class PlacementClaimFinancialClosePendingConfirmationsDto {
  @ApiProperty({ example: 0 })
  recordedCedantSettlementCount!: number;

  @ApiProperty({ type: String, example: '0.00' })
  recordedCedantSettlementAmount!: string;

  @ApiProperty({ example: 0 })
  recordedRecoveryReceiptCount!: number;

  @ApiProperty({ type: String, example: '0.00' })
  recordedRecoveryReceiptAmount!: string;
}

export class PlacementClaimFinancialCloseReadinessResponseDto {
  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({
    enum: PlacementClaimStatus,
    example: PlacementClaimStatus.SETTLED,
  })
  currentClaimStatus!: PlacementClaimStatus;

  @ApiProperty({ type: PlacementClaimFinancialClosePayableDto })
  payable!: PlacementClaimFinancialClosePayableDto;

  @ApiProperty({ type: PlacementClaimFinancialCloseRecoveryDto })
  recovery!: PlacementClaimFinancialCloseRecoveryDto;

  @ApiProperty({ type: PlacementClaimFinancialClosePendingConfirmationsDto })
  pendingConfirmations!: PlacementClaimFinancialClosePendingConfirmationsDto;

  @ApiProperty({ example: true })
  isPayableFullySettled!: boolean;

  @ApiProperty({ example: true })
  areRecoveriesFullyReceived!: boolean;

  @ApiProperty({ example: false })
  hasPendingFinancialConfirmations!: boolean;

  @ApiProperty({ example: true })
  isFinanciallyReadyToSettle!: boolean;

  @ApiProperty({ example: true })
  isFinanciallyReadyToClose!: boolean;

  @ApiProperty({
    enum: PLACEMENT_CLAIM_FINANCIAL_CLOSE_BLOCKERS,
    isArray: true,
    example: [],
  })
  blockers!: PlacementClaimFinancialCloseBlocker[];
}
