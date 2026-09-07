import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class UpdateCurrencyDto {
  @ApiPropertyOptional({ example: 'Ghana Cedi', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '₵', maxLength: 10 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  symbol?: string;

  @ApiPropertyOptional({
    example: 16.5,
    description:
      'Updated exchange rate to the base currency. Must be greater than 0. Ignored when isBaseCurrency is being set to true.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001, { message: 'exchangeRateToBase must be greater than 0' })
  exchangeRateToBase?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Set to true to designate this as the base currency. The existing base currency (if any) loses its base flag. Rate is forced to 1 when promoting.',
  })
  @IsOptional()
  @IsBoolean()
  isBaseCurrency?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
