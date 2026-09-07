import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementSettlementMethod,
} from '../../../prisma/generated/client';

export class PlacementClaimRecoveryCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.REINSURER })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Avenue Re' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  registrationNumber!: string | null;
}

export class PlacementClaimRecoveryReceiptResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  allocationId!: string;

  @ApiProperty({ format: 'uuid' })
  cashCallId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  recoveryApprovalId!: string | null;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  amount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  paymentDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({
    enum: PlacementSettlementMethod,
    nullable: true,
  })
  settlementMethod!: PlacementSettlementMethod | null;

  @ApiPropertyOptional({ example: 'GHS', nullable: true })
  settlementCurrency!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  bankReference!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Accounting cash/bank account selected during financial confirmation for Cashbook integration.',
  })
  accountingCashAccountId!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  bankConfirmedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  bankConfirmedByUserId!: string | null;

  @ApiPropertyOptional({ type: String, example: '12.34567800', nullable: true })
  agreedExchangeRate!: string | null;

  @ApiProperty({ type: String, example: '15.00' })
  bankChargeAmount!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    enum: PlacementClaimRecoveryReceiptStatus,
    example: PlacementClaimRecoveryReceiptStatus.RECORDED,
  })
  status!: PlacementClaimRecoveryReceiptStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reversalOfReceiptId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementClaimRecoveryCounterpartyDto })
  counterparty!: PlacementClaimRecoveryCounterpartyDto;
}

export class PlacementClaimRecoveryReceiptListResponseDto {
  @ApiProperty({ type: [PlacementClaimRecoveryReceiptResponseDto] })
  items!: PlacementClaimRecoveryReceiptResponseDto[];
}

export class PlacementClaimRecoveryApprovalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  allocationId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cashCallId!: string | null;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ example: 1 })
  approvalVersion!: number;

  @ApiProperty({ type: String, example: '40000.00' })
  approvedAmount!: string;

  @ApiProperty({ type: String, example: '100000.00' })
  eligibleAmount!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  approvedAt!: string;

  @ApiProperty({ format: 'uuid' })
  approvedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: PlacementClaimRecoveryCounterpartyDto })
  counterparty!: PlacementClaimRecoveryCounterpartyDto;
}

export class PlacementClaimRecoveryApprovalListResponseDto {
  @ApiProperty({ type: [PlacementClaimRecoveryApprovalResponseDto] })
  items!: PlacementClaimRecoveryApprovalResponseDto[];
}

export class PlacementClaimRecoveryPositionCashCallDto {
  @ApiProperty({ format: 'uuid' })
  cashCallId!: string;

  @ApiProperty({ format: 'uuid' })
  allocationId!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ type: PlacementClaimRecoveryCounterpartyDto })
  counterparty!: PlacementClaimRecoveryCounterpartyDto;

  @ApiProperty({ example: 'CCL-001' })
  cashCallNumber!: string;

  @ApiProperty({ enum: PlacementClaimCashCallStatus })
  cashCallStatus!: PlacementClaimCashCallStatus;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, example: '100000.00' })
  calledAmount!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  recoveredAmount!: string;

  @ApiProperty({
    type: String,
    example: '10000.00',
    description:
      'Operational receipts recorded but not yet financially confirmed by Accounting.',
  })
  recordedAmount!: string;

  @ApiProperty({
    type: String,
    example: '40000.00',
    description:
      'Bank-confirmed recovery receipts that reduce financial outstanding.',
  })
  confirmedAmount!: string;

  @ApiProperty({ type: String, example: '10000.00' })
  reversedAmount!: string;

  @ApiProperty({ type: String, example: '60000.00' })
  outstandingAmount!: string;

  @ApiProperty({
    enum: ['UNRECOVERED', 'PARTIALLY_RECOVERED', 'FULLY_RECOVERED'],
    example: 'PARTIALLY_RECOVERED',
  })
  recoveryStatus!: 'UNRECOVERED' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED';

  @ApiProperty({ type: [PlacementClaimRecoveryReceiptResponseDto] })
  receipts!: PlacementClaimRecoveryReceiptResponseDto[];
}

export class PlacementClaimRecoveryPositionTotalsDto {
  @ApiProperty({ type: String, example: '100000.00' })
  totalAllocated!: string;

  @ApiProperty({ type: String, example: '100000.00' })
  totalCashCalled!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  totalRecovered!: string;

  @ApiProperty({ type: String, example: '10000.00' })
  totalRecorded!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  totalConfirmed!: string;

  @ApiProperty({ type: String, example: '10000.00' })
  totalReversed!: string;

  @ApiProperty({ type: String, example: '60000.00' })
  totalOutstanding!: string;
}

export class PlacementClaimRecoveryPositionClaimDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: '37500.00' })
  finalLossAmount!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '35000.00' })
  approvedPayableAmount!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  approvedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  approvedByUserId!: string | null;
}

export class PlacementClaimCedantSettlementPositionDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: '35000.00' })
  approvedPayableAmount!: string | null;

  @ApiProperty({ type: String, example: '25000.00' })
  settledAmount!: string;

  @ApiProperty({
    type: String,
    example: '10000.00',
    description:
      'Operational Cedant settlements recorded but not yet financially confirmed by Accounting.',
  })
  recordedAmount!: string;

  @ApiProperty({
    type: String,
    example: '25000.00',
    description:
      'Bank-confirmed Cedant settlements that reduce financial payable outstanding.',
  })
  bankConfirmedAmount!: string;

  @ApiProperty({ type: String, example: '5000.00' })
  reversedAmount!: string;

  @ApiProperty({ type: String, example: '10000.00' })
  outstandingAmount!: string;

  @ApiProperty({ type: String, example: '35000.00' })
  operationalSettledAmount!: string;

  @ApiProperty({
    enum: [
      'PENDING_APPROVAL',
      'APPROVED_UNSETTLED',
      'PARTIALLY_SETTLED',
      'SETTLED',
    ],
    example: 'PARTIALLY_SETTLED',
  })
  settlementStatus!:
    | 'PENDING_APPROVAL'
    | 'APPROVED_UNSETTLED'
    | 'PARTIALLY_SETTLED'
    | 'SETTLED';
}

export class PlacementClaimFundingPositionDto {
  @ApiProperty({ type: String, example: '10000.00' })
  brokerFundedExposure!: string;

  @ApiProperty({ type: String, example: '0.00' })
  recoveredMinusSettled!: string;
}

export class PlacementClaimRecoveryPositionResponseDto {
  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: PlacementClaimRecoveryPositionClaimDto })
  claim!: PlacementClaimRecoveryPositionClaimDto;

  @ApiProperty({ type: PlacementClaimRecoveryPositionTotalsDto })
  recoveries!: PlacementClaimRecoveryPositionTotalsDto;

  @ApiProperty({ type: [PlacementClaimRecoveryPositionCashCallDto] })
  perCashCall!: PlacementClaimRecoveryPositionCashCallDto[];

  @ApiProperty({ type: PlacementClaimCedantSettlementPositionDto })
  cedantSettlement!: PlacementClaimCedantSettlementPositionDto;

  @ApiProperty({ type: PlacementClaimFundingPositionDto })
  funding!: PlacementClaimFundingPositionDto;

  @ApiProperty({
    example: 'PARTIALLY_SETTLED',
  })
  cedantSettlementStatus!: string;
}
