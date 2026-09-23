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
  PREMIUM_REPORT_DATE_BASIS,
  PREMIUM_REPORT_PAYMENT_STATUSES,
  PremiumReportDateBasis,
  PremiumReportPaymentStatus,
} from './query-premiums-report.dto';

export const BROKERAGE_REPORT_SCOPES = ['cedant', 'reinsurer'] as const;

export type BrokerageReportScope = (typeof BROKERAGE_REPORT_SCOPES)[number];

export const BROKERAGE_REPORT_SORT_FIELDS = [
  'policyNumber',
  'cedantName',
  'reinsurerName',
  'inceptionDate',
  'expiryDate',
  'premium',
  'grossPremium',
  'brokerageAmount',
  'brokeragePaid',
  'paymentStatus',
] as const;

export type BrokerageReportSortField =
  (typeof BROKERAGE_REPORT_SORT_FIELDS)[number];

export const BROKERAGE_REPORT_SORT_ORDERS = ['asc', 'desc'] as const;

export type BrokerageReportSortOrder =
  (typeof BROKERAGE_REPORT_SORT_ORDERS)[number];

function parseArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryBrokerageReportDto {
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

  @ApiPropertyOptional({ enum: BROKERAGE_REPORT_SCOPES, default: 'reinsurer' })
  @IsOptional()
  @IsIn(BROKERAGE_REPORT_SCOPES)
  scope?: BrokerageReportScope = 'reinsurer';

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
  reinsurerId?: string[];

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

  @ApiPropertyOptional({ maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: BROKERAGE_REPORT_SORT_FIELDS,
    default: 'inceptionDate',
  })
  @IsOptional()
  @IsIn(BROKERAGE_REPORT_SORT_FIELDS)
  sortBy?: BrokerageReportSortField = 'inceptionDate';

  @ApiPropertyOptional({ enum: BROKERAGE_REPORT_SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(BROKERAGE_REPORT_SORT_ORDERS)
  sortOrder?: BrokerageReportSortOrder = 'desc';
}
