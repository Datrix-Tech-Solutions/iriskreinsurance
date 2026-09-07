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

export class CreatePlacementClaimCedantSettlementDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Recognized claim payable approval this operational settlement pays. Defaults to the latest claim-level payable approval when omitted.',
  })
  @IsOptional()
  @IsUUID()
  payableApprovalId?: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @TrimmedString()
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({ example: 25000, minimum: 0.01 })
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
  settlementDate!: string;

  @ApiPropertyOptional({
    enum: PlacementSettlementMethod,
    example: PlacementSettlementMethod.BANK_TRANSFER,
    description:
      'Operational intended settlement method. Accounting confirms execution later and cannot change this fact if supplied.',
  })
  @IsOptional()
  @IsEnum(PlacementSettlementMethod)
  settlementMethod?: PlacementSettlementMethod;

  @ApiPropertyOptional({
    example: 'GHS',
    minLength: 3,
    maxLength: 3,
    description:
      'Operational intended settlement currency. Defaults to claim payable currency when omitted.',
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
      'Agreed transaction FX rate when settlement currency differs from payable currency. Never derived from live FX.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  agreedExchangeRate?: number;

  @ApiPropertyOptional({ example: 'CEDANT-PAY-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({
    example: 'Partial settlement paid to cedant.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
