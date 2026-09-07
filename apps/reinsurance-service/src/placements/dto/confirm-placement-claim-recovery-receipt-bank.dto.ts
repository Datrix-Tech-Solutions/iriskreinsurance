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

export class ConfirmPlacementClaimRecoveryReceiptBankDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-08-10T12:00:00.000Z',
    description:
      'Reinsurance-owned financial confirmation date/time when the recovery receipt was confirmed as received, cleared, completed or offset.',
  })
  @IsDateString()
  bankConfirmedAt!: string;

  @ApiPropertyOptional({
    example: 'BANK-CLAIM-REC-001',
    maxLength: 100,
    description:
      'Bank, cheque, mobile-money or settlement reference captured during Reinsurance claim financial confirmation.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankReference?: string;

  @ApiPropertyOptional({
    example: '56a9d8dd-bf8f-4d6a-a88f-8d1da3b1fd45',
    description:
      'Legacy optional Accounting cash/bank account reference retained for response compatibility. Reinsurance claim confirmations no longer require it or post claim events to Accounting.',
  })
  @IsOptional()
  @IsUUID()
  accountingCashAccountId?: string;

  @ApiPropertyOptional({
    enum: PlacementSettlementMethod,
    example: PlacementSettlementMethod.BANK_TRANSFER,
    description:
      'Compatibility field for legacy recovery receipts without an operational settlement method. Confirmation cannot change an existing operational method.',
  })
  @IsOptional()
  @IsEnum(PlacementSettlementMethod)
  settlementMethod?: PlacementSettlementMethod;

  @ApiPropertyOptional({
    example: 'GHS',
    minLength: 3,
    maxLength: 3,
    description:
      'Compatibility field for legacy recovery receipts without an operational settlement currency. Confirmation cannot change an existing operational currency.',
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
      'Confirmed transaction FX rate. Required when settlement currency differs from recovery currency and no persisted agreed FX already exists.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  confirmedExchangeRate?: number;

  @ApiPropertyOptional({
    example: 12.345678,
    minimum: 0.000001,
    deprecated: true,
    description: 'Deprecated compatibility alias for confirmedExchangeRate.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  agreedExchangeRate?: number;

  @ApiPropertyOptional({
    example: 15,
    minimum: 0,
    description:
      'Bank charges captured during Reinsurance claim financial confirmation. No Accounting posting is emitted for this recovery receipt.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bankChargeAmount?: number;

  @ApiPropertyOptional({
    example: 'Confirmed from bank statement batch 2026-08-10.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
