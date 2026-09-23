import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlacementStatus } from '../../../../prisma/generated/client';
import { TrimmedString } from '../../../counterparties/dto/string.transforms';

export const REINSURERS_REPORT_PAYMENT_STATUSES = [
  'Outstanding',
  'Pending',
  'Part Payment',
  'Paid',
] as const;

export type ReinsurerReportPaymentStatus =
  (typeof REINSURERS_REPORT_PAYMENT_STATUSES)[number];

export const REINSURERS_REPORT_SORT_FIELDS = [
  'name',
  'placementCount',
  'cededPremium',
  'outstanding',
  'pending',
] as const;

export type ReinsurersReportSortField =
  (typeof REINSURERS_REPORT_SORT_FIELDS)[number];

export const REINSURERS_REPORT_SORT_ORDERS = ['asc', 'desc'] as const;

export type ReinsurersReportSortOrder =
  (typeof REINSURERS_REPORT_SORT_ORDERS)[number];

function parseArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryReinsurersReportDto {
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

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  reinsurerId?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  riskTypeId?: string[];

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

  @ApiPropertyOptional({ type: [String], enum: PlacementStatus })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(Object.values(PlacementStatus), { each: true })
  placementStatus?: PlacementStatus[];

  @ApiPropertyOptional({
    type: [String],
    enum: REINSURERS_REPORT_PAYMENT_STATUSES,
  })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(REINSURERS_REPORT_PAYMENT_STATUSES, { each: true })
  paymentStatus?: ReinsurerReportPaymentStatus[];

  @ApiPropertyOptional({ maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: REINSURERS_REPORT_SORT_FIELDS,
    default: 'cededPremium',
  })
  @IsOptional()
  @IsIn(REINSURERS_REPORT_SORT_FIELDS)
  sortBy?: ReinsurersReportSortField = 'cededPremium';

  @ApiPropertyOptional({ enum: REINSURERS_REPORT_SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(REINSURERS_REPORT_SORT_ORDERS)
  sortOrder?: ReinsurersReportSortOrder = 'desc';
}
