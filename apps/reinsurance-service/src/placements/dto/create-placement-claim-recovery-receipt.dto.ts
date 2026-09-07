import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementSettlementMethod } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementClaimRecoveryReceiptDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Approved claim recovery record this operational receipt settles. Required when multiple recovery approvals exist for the cash call/allocation.',
  })
  @IsOptional()
  @IsUUID()
  recoveryApprovalId?: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @TrimmedString()
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({ example: 40000, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-29T12:00:00.000Z',
  })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({
    enum: PlacementSettlementMethod,
    example: PlacementSettlementMethod.BANK_TRANSFER,
    description:
      'Operational settlement method supplied by Reinsurance. Accounting confirms bank completion later and cannot change this fact.',
  })
  @IsOptional()
  @IsEnum(PlacementSettlementMethod)
  settlementMethod?: PlacementSettlementMethod;

  @ApiPropertyOptional({
    example: 'GHS',
    minLength: 3,
    maxLength: 3,
    description:
      'Operational settlement currency. Defaults to receipt currency when omitted.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  settlementCurrency?: string;

  @ApiPropertyOptional({
    example: 12.345678,
    minimum: 0.000001,
    description:
      'Agreed transaction FX rate when settlement currency differs from the recovery currency. Never derived from live FX.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  agreedExchangeRate?: number;

  @ApiPropertyOptional({ example: 'BANK-REC-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({
    example: 'Partial recovery received from reinsurer.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
