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
import {
  CLAIM_ROW_BUCKETS,
  ClaimRowBucket,
} from '../../dto/claim-row-state-response.dto';
import { PlacementClaimState } from '../../../../prisma/generated/client';
import { TrimmedString } from '../../../counterparties/dto/string.transforms';

export const CLAIMS_REPORT_SCOPES = ['general', 'cedant', 'reinsurer'] as const;

export type ClaimsReportScope = (typeof CLAIMS_REPORT_SCOPES)[number];

export const CLAIMS_REPORT_RECOVERY_STATUSES = [
  'outstanding',
  'part',
  'full',
] as const;

export type ClaimsReportRecoveryStatus =
  (typeof CLAIMS_REPORT_RECOVERY_STATUSES)[number];

export const CLAIMS_REPORT_SORT_FIELDS = [
  'occurrenceDate',
  'claimNumber',
  'policyNumber',
  'cedantName',
  'claimAmount',
  'iriskShareAmount',
  'iriskShareOutstanding',
  'reinsurerName',
  'reinsurerShareAmount',
  'reinsurerOutstandingAmount',
  'agingDays',
] as const;

export type ClaimsReportSortField = (typeof CLAIMS_REPORT_SORT_FIELDS)[number];

export const CLAIMS_REPORT_SORT_ORDERS = ['asc', 'desc'] as const;

export type ClaimsReportSortOrder = (typeof CLAIMS_REPORT_SORT_ORDERS)[number];

function parseArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryClaimsReportDto {
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
    type: String,
    format: 'date',
    description:
      'Inclusive lower bound on date of loss (PlacementClaim.occurrenceDate).',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description:
      'Inclusive upper bound on date of loss (PlacementClaim.occurrenceDate).',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: CLAIMS_REPORT_SCOPES, default: 'general' })
  @IsOptional()
  @IsIn(CLAIMS_REPORT_SCOPES)
  scope?: ClaimsReportScope = 'general';

  @ApiPropertyOptional({
    type: [String],
    enum: CLAIM_ROW_BUCKETS,
    description: 'Server-derived claim bucket: notification, open or closed.',
  })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(CLAIM_ROW_BUCKETS, { each: true })
  bucket?: ClaimRowBucket[];

  @ApiPropertyOptional({
    type: [String],
    enum: PlacementClaimState,
    description:
      'Claim lifecycle state. PENDING has no finalized allocation; FINALIZED has locked financial inputs.',
  })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(Object.values(PlacementClaimState), { each: true })
  claimState?: PlacementClaimState[];

  @ApiPropertyOptional({
    type: [String],
    enum: CLAIMS_REPORT_RECOVERY_STATUSES,
    description:
      'Recovery status for finalized claims, based on bank-confirmed reinsurer recoveries.',
  })
  @IsOptional()
  @Transform(({ value }) => parseArray(value as unknown))
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(CLAIMS_REPORT_RECOVERY_STATUSES, { each: true })
  recoveryStatus?: ClaimsReportRecoveryStatus[];

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

  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Searches policy number, insured/title, class of business and claim number.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: CLAIMS_REPORT_SORT_FIELDS,
    default: 'occurrenceDate',
  })
  @IsOptional()
  @IsIn(CLAIMS_REPORT_SORT_FIELDS)
  sortBy?: ClaimsReportSortField = 'occurrenceDate';

  @ApiPropertyOptional({ enum: CLAIMS_REPORT_SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(CLAIMS_REPORT_SORT_ORDERS)
  sortOrder?: ClaimsReportSortOrder = 'desc';
}
