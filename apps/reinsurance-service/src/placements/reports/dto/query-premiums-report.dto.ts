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

export const PREMIUM_REPORT_DATE_BASIS = [
  'PLACEMENT_CREATED',
  'INCEPTION_DATE',
  'EXPIRY_DATE',
  'CLOSING_CONFIRMED_AT',
  'PAYMENT_DATE',
  'BANK_CONFIRMED_AT',
] as const;

export type PremiumReportDateBasis = (typeof PREMIUM_REPORT_DATE_BASIS)[number];

export const PREMIUM_REPORT_PAYMENT_STATUSES = [
  'Outstanding',
  'Pending',
  'Part Payment',
  'Paid',
] as const;

export type PremiumReportPaymentStatus =
  (typeof PREMIUM_REPORT_PAYMENT_STATUSES)[number];

export const PREMIUM_REPORT_SORT_FIELDS = [
  'policyNumber',
  'cedantName',
  'offerDate',
  'dateClosed',
  'inceptionDate',
  'expiryDate',
  'premium',
  'grossPremium',
  'premiumReceived',
  'outstanding',
  'paymentStatus',
] as const;

export type PremiumReportSortField =
  (typeof PREMIUM_REPORT_SORT_FIELDS)[number];

export const PREMIUM_REPORT_SORT_ORDERS = ['asc', 'desc'] as const;

export type PremiumReportSortOrder =
  (typeof PREMIUM_REPORT_SORT_ORDERS)[number];

function parseArray(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryPremiumsReportDto {
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

  @ApiPropertyOptional({
    enum: PREMIUM_REPORT_DATE_BASIS,
    default: 'INCEPTION_DATE',
  })
  @IsOptional()
  @IsIn(PREMIUM_REPORT_DATE_BASIS)
  dateBasis?: PremiumReportDateBasis = 'INCEPTION_DATE';

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
  riskClassId?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  riskTypeId?: string[];

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

  @ApiPropertyOptional({
    example: 'POL-001',
    maxLength: 100,
    description:
      'Searches placement reference, policy number, title, cedant and risk type.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: PREMIUM_REPORT_SORT_FIELDS,
    default: 'inceptionDate',
  })
  @IsOptional()
  @IsIn(PREMIUM_REPORT_SORT_FIELDS)
  sortBy?: PremiumReportSortField = 'inceptionDate';

  @ApiPropertyOptional({
    enum: PREMIUM_REPORT_SORT_ORDERS,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(PREMIUM_REPORT_SORT_ORDERS)
  sortOrder?: PremiumReportSortOrder = 'desc';
}
