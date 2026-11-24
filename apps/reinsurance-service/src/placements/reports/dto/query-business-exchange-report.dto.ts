import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimmedString } from '../../../counterparties/dto/string.transforms';

export const BUSINESS_EXCHANGE_PERIOD_MODES = ['monthly', 'yearly'] as const;

export type BusinessExchangePeriodMode =
  (typeof BUSINESS_EXCHANGE_PERIOD_MODES)[number];

export const BUSINESS_EXCHANGE_SORT_FIELDS = [
  'insuranceCompany',
  'period',
  'volumeGiven',
  'volumeReceived',
  'businessReceived',
  'netBalance',
  'netBrokerage',
] as const;

export type BusinessExchangeSortField =
  (typeof BUSINESS_EXCHANGE_SORT_FIELDS)[number];

export const BUSINESS_EXCHANGE_SORT_ORDERS = ['asc', 'desc'] as const;

function parseArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryBusinessExchangeReportDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({
    enum: BUSINESS_EXCHANGE_PERIOD_MODES,
    default: 'monthly',
    description:
      'monthly groups rows by month, yearly groups rows by year. Placements are dated by their entry date (createdAt, UTC).',
  })
  @IsOptional()
  @IsIn(BUSINESS_EXCHANGE_PERIOD_MODES)
  mode?: BusinessExchangePeriodMode = 'monthly';

  @ApiPropertyOptional({
    example: 2026,
    description:
      'Monthly mode: the year to report on (defaults to the current year). Yearly mode: a single year; omit for all years.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(2200)
  year?: number;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    maximum: 12,
    description:
      'Monthly mode only: a single month (1-12) of the year. Omit for all months.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'ISO currency codes. Comma-separated query values are accepted.',
  })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(12, { each: true })
  currency?: string[];

  @ApiPropertyOptional({ maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: BUSINESS_EXCHANGE_SORT_FIELDS,
    default: 'insuranceCompany',
  })
  @IsOptional()
  @IsIn(BUSINESS_EXCHANGE_SORT_FIELDS)
  sortBy?: BusinessExchangeSortField = 'insuranceCompany';

  @ApiPropertyOptional({
    enum: BUSINESS_EXCHANGE_SORT_ORDERS,
    default: 'asc',
  })
  @IsOptional()
  @IsIn(BUSINESS_EXCHANGE_SORT_ORDERS)
  sortOrder?: 'asc' | 'desc' = 'asc';
}
