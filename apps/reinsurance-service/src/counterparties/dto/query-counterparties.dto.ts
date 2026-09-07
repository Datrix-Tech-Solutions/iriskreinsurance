import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyOrigin,
  CounterpartyType,
} from '../../../prisma/generated/client';
import { TrimmedString, UppercaseTrimmedString } from './string.transforms';

export class QueryCounterpartiesDto {
  @ApiPropertyOptional({ example: 'ghana re', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: CounterpartyType,
    example: CounterpartyType.REINSURER,
  })
  @IsOptional()
  @IsEnum(CounterpartyType)
  type?: CounterpartyType;

  @ApiPropertyOptional({
    enum: CounterpartyOrigin,
    example: CounterpartyOrigin.FOREIGN,
  })
  @IsOptional()
  @IsEnum(CounterpartyOrigin)
  origin?: CounterpartyOrigin;

  @ApiPropertyOptional({ example: 'NG', minLength: 2, maxLength: 2 })
  @UppercaseTrimmedString()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
