import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementClaimAllocationStatus,
  PlacementClaimState,
  PlacementClaimStatus,
} from '../../../prisma/generated/client';

export class PlacementClaimResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ example: 'CLM-001' })
  claimNumber!: string;

  @ApiProperty({
    enum: PlacementClaimStatus,
    example: PlacementClaimStatus.DRAFT,
  })
  status!: PlacementClaimStatus;

  @ApiProperty({
    enum: PlacementClaimState,
    example: PlacementClaimState.PENDING,
  })
  claimState!: PlacementClaimState;

  @ApiProperty({ type: String, format: 'date-time' })
  occurrenceDate!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  reportedDate!: string;

  @ApiProperty({ example: 'Warehouse fire in section B' })
  claimCause!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  occurrenceDetails!: string | null;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  estimatedLossAmount!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '37500.00' })
  finalLossAmount!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  finalizedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  finalizedByUserId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '37500.00' })
  approvedPayableAmount!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  approvedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  approvedByUserId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  closedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  voidedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlacementClaimListResponseDto {
  @ApiProperty({ type: [PlacementClaimResponseDto] })
  items!: PlacementClaimResponseDto[];
}

export class PlacementClaimAllocationCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.REINSURER })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Avenue Re' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'R-00123' })
  registrationNumber!: string | null;
}

export class PlacementClaimAllocationClosingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CLO-001' })
  closingNumber!: string;
}

export class PlacementClaimAllocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  placementClosingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementClosingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  participantId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementParticipantId!: string | null;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ type: String, example: '40.0000' })
  signedLinePercent!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  basisAmount!: string;

  @ApiProperty({ type: String, example: '16000.00' })
  allocatedEstimatedLossAmount!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '15000.00' })
  allocatedFinalLossAmount!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Reserved for the future claim cash call domain.',
  })
  cashCallAmount!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Reserved for future claim settlement payment tracking.',
  })
  paidAmount!: string | null;

  @ApiProperty({
    enum: PlacementClaimAllocationStatus,
    example: PlacementClaimAllocationStatus.DRAFT,
  })
  status!: PlacementClaimAllocationStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementClaimAllocationCounterpartyDto })
  counterparty!: PlacementClaimAllocationCounterpartyDto;

  @ApiPropertyOptional({
    type: PlacementClaimAllocationClosingDto,
    nullable: true,
  })
  placementClosing!: PlacementClaimAllocationClosingDto | null;

  @ApiPropertyOptional({
    type: PlacementClaimAllocationClosingDto,
    nullable: true,
  })
  endorsementClosing!: PlacementClaimAllocationClosingDto | null;
}

export class PlacementClaimAllocationListResponseDto {
  @ApiProperty({ type: [PlacementClaimAllocationResponseDto] })
  items!: PlacementClaimAllocationResponseDto[];
}
