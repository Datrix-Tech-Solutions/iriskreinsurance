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
import {
  PREMIUM_REPORT_PAYMENT_STATUSES,
  PremiumReportPaymentStatus,
} from './query-premiums-report.dto';

export const FACULTATIVE_REPORT_DATE_FIELDS = [
  'createdAt',
  'premiumPaid',
  'closingDate',
] as const;

export type FacultativeReportDateField =
  (typeof FACULTATIVE_REPORT_DATE_FIELDS)[number];

export const FACULTATIVE_REPORT_LIFECYCLES = ['ACTIVE', 'EXPIRED'] as const;

export type FacultativeReportLifecycle =
  (typeof FACULTATIVE_REPORT_LIFECYCLES)[number];

export const FACULTATIVE_REPORT_SCOPES = ['cedant', 'reinsurer'] as const;

export type FacultativeReportScope = (typeof FACULTATIVE_REPORT_SCOPES)[number];

export const FACULTATIVE_REPORT_SORT_FIELDS = [
  'policyNumber',
  'cedantName',
  'offerDate',
  'closedAt',
  'inceptionDate',
  'expiryDate',
  'premium',
  'facPremium',
  'paymentStatus',
] as const;

export type FacultativeReportSortField =
  (typeof FACULTATIVE_REPORT_SORT_FIELDS)[number];

export const FACULTATIVE_REPORT_SORT_ORDERS = ['asc', 'desc'] as const;

export type FacultativeReportSortOrder =
  (typeof FACULTATIVE_REPORT_SORT_ORDERS)[number];

function parseArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryFacultativeReportDto {
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
    enum: FACULTATIVE_REPORT_DATE_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(FACULTATIVE_REPORT_DATE_FIELDS)
  dateField?: FacultativeReportDateField = 'createdAt';

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
  cedantId?: string[];

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
  riskClassId?: string[];

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
    enum: PREMIUM_REPORT_PAYMENT_STATUSES,
  })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(PREMIUM_REPORT_PAYMENT_STATUSES, { each: true })
  paymentStatus?: PremiumReportPaymentStatus[];

  @ApiPropertyOptional({ enum: FACULTATIVE_REPORT_LIFECYCLES })
  @IsOptional()
  @IsIn(FACULTATIVE_REPORT_LIFECYCLES)
  lifecycle?: FacultativeReportLifecycle;

  @ApiPropertyOptional({ enum: FACULTATIVE_REPORT_SCOPES, default: 'cedant' })
  @IsOptional()
  @IsIn(FACULTATIVE_REPORT_SCOPES)
  scope?: FacultativeReportScope = 'cedant';

  @ApiPropertyOptional({ maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: FACULTATIVE_REPORT_SORT_FIELDS,
    default: 'offerDate',
  })
  @IsOptional()
  @IsIn(FACULTATIVE_REPORT_SORT_FIELDS)
  sortBy?: FacultativeReportSortField = 'offerDate';

  @ApiPropertyOptional({
    enum: FACULTATIVE_REPORT_SORT_ORDERS,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(FACULTATIVE_REPORT_SORT_ORDERS)
  sortOrder?: FacultativeReportSortOrder = 'desc';
}
