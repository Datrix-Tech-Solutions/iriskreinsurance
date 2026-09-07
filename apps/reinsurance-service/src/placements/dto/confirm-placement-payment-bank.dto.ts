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

export class ConfirmPlacementPaymentBankDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-04T14:30:00.000Z',
    description:
      'Broker-recorded date/time when the payment was confirmed as received, cleared, completed or offset inside Reinsurance.',
  })
  @IsDateString()
  bankConfirmedAt!: string;

  @ApiPropertyOptional({
    example: 'BANK-CONF-2026-001',
    maxLength: 100,
    description:
      'Bank, cheque, mobile-money or settlement reference for the confirmed Reinsurance payment.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankReference?: string;

  @ApiPropertyOptional({
    example: '56a9d8dd-bf8f-4d6a-a88f-8d1da3b1fd45',
    description:
      'Deprecated compatibility metadata from the former Accounting confirmation workflow. Accepted if supplied, but no longer required or validated against Accounting.',
    deprecated: true,
  })
  @IsOptional()
  @IsUUID()
  accountingCashAccountId?: string;

  @ApiPropertyOptional({
    enum: PlacementSettlementMethod,
    example: PlacementSettlementMethod.BANK_TRANSFER,
    description:
      'Compatibility field for legacy payments without an operational settlement method. New confirmations cannot change the operational settlement method.',
  })
  @IsOptional()
  @IsEnum(PlacementSettlementMethod)
  settlementMethod?: PlacementSettlementMethod;

  @ApiPropertyOptional({
    example: 'USD',
    minLength: 3,
    maxLength: 3,
    description:
      'Compatibility field for legacy payments without an operational settlement currency. New confirmations cannot change the operational settlement currency.',
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
      'Confirmed transaction FX rate. Required when settlement currency differs from the obligation currency and no persisted agreed FX already exists.',
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
    example: 25,
    minimum: 0,
    description:
      'Operational bank charges captured with the Reinsurance payment confirmation.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bankChargeAmount?: number;

  @ApiPropertyOptional({
    example: 'Confirmed from bank statement batch 2026-06-04.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
