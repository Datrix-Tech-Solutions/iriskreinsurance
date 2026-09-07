import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementClaimAllocationStatus,
  PlacementClaimCashCallStatus,
} from '../../../prisma/generated/client';

export class PlacementClaimCashCallCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.REINSURER })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Avenue Re' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'R-00123' })
  registrationNumber!: string | null;
}

export class PlacementClaimCashCallAllocationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: PlacementClaimAllocationStatus,
    example: PlacementClaimAllocationStatus.DRAFT,
  })
  status!: PlacementClaimAllocationStatus;
}

export class PlacementClaimCashCallResponseDto {
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
  counterpartyId!: string;

  @ApiProperty({ example: 'CCL-001' })
  cashCallNumber!: string;

  @ApiProperty({
    enum: PlacementClaimCashCallStatus,
    example: PlacementClaimCashCallStatus.DRAFT,
  })
  status!: PlacementClaimCashCallStatus;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({
    type: String,
    example: '16000.00',
    description:
      'Cash call amount copied from allocation final loss amount when present, otherwise estimated loss amount.',
  })
  amount!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  basisAmount!: string;

  @ApiProperty({ type: String, example: '40.0000' })
  signedLinePercent!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  issuedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  paidAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  voidedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  voidReason!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementClaimCashCallCounterpartyDto })
  counterparty!: PlacementClaimCashCallCounterpartyDto;

  @ApiProperty({ type: PlacementClaimCashCallAllocationDto })
  allocation!: PlacementClaimCashCallAllocationDto;
}

export class PlacementClaimCashCallListResponseDto {
  @ApiProperty({ type: [PlacementClaimCashCallResponseDto] })
  items!: PlacementClaimCashCallResponseDto[];
}
