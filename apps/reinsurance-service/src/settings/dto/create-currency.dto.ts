import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TrimmedString,
  UppercaseTrimmedString,
} from '../../counterparties/dto/string.transforms';

export class CreateCurrencyDto {
  @ApiProperty({
    example: 'GHS',
    description: 'ISO 4217 currency code — exactly 3 uppercase letters.',
    minLength: 3,
    maxLength: 3,
    pattern: '^[A-Z]{3}$',
  })
  @UppercaseTrimmedString()
  @IsString()
  @Length(3, 3, { message: 'isoCode must be exactly 3 characters' })
  @Matches(/^[A-Z]{3}$/, { message: 'isoCode must be 3 uppercase letters' })
  isoCode!: string;

  @ApiProperty({ example: 'Ghana Cedi', maxLength: 100 })
  @TrimmedString()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '₵', maxLength: 10 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  symbol?: string;

  @ApiPropertyOptional({
    example: 16.5,
    description:
      'Exchange rate relative to the tenant base currency. Required for non-base currencies. Must be greater than 0. Ignored and set to 1 when isBaseCurrency is true.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001, { message: 'exchangeRateToBase must be greater than 0' })
  exchangeRateToBase?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Marks this as the tenant reporting base currency (e.g. USD). Only one base currency is allowed per tenant. The rate is automatically set to 1.000000.',
  })
  @IsOptional()
  @IsBoolean()
  isBaseCurrency?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
