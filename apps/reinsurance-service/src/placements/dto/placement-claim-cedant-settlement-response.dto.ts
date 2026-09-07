import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementClaimCedantSettlementStatus,
  PlacementSettlementMethod,
} from '../../../prisma/generated/client';

export class PlacementClaimCedantSettlementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  payableApprovalId!: string | null;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, example: '25000.00' })
  amount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  settlementDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({ enum: PlacementSettlementMethod, nullable: true })
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

  @ApiProperty({ type: String, example: '25.00' })
  bankChargeAmount!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    enum: PlacementClaimCedantSettlementStatus,
    example: PlacementClaimCedantSettlementStatus.RECORDED,
  })
  status!: PlacementClaimCedantSettlementStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reversalOfSettlementId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlacementClaimCedantSettlementListResponseDto {
  @ApiProperty({ type: [PlacementClaimCedantSettlementResponseDto] })
  items!: PlacementClaimCedantSettlementResponseDto[];
}
