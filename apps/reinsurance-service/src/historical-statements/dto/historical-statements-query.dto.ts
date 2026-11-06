import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';

export enum StatementKind {
  INSURER = 'INSURER',
  REINSURER = 'REINSURER',
}
export const SORT_FIELDS = [
  'year',
  'sourceRow',
  'policyNumber',
  'insurerName',
  'reinsurerName',
  'reinsuredName',
  'insuredName',
  'businessName',
  'currency',
  'offerDate',
  'closedDate',
  'startDate',
  'endDate',
  'sumInsured100',
  'premium100',
  'facShare',
  'facSumInsured',
  'facPremium',
  'paidFacPremium',
  'insurerCommissionPercent',
  'insurerCommissionAmount',
  'paidCommission',
  'netPremiumDueBroker',
  'netPremiumDueBrokerPaid',
  'brokerage',
  'brokeragePaid',
  'wht',
  'paidWht',
  'paidWhtFirst',
  'paidWhtSecond',
  'nicLevy',
  'paidNic',
  'netPremiumDueReinsurer',
  'netPremiumPaid',
  'offerStatus',
  'paymentStatus',
] as const;
export function validArchiveDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split('-').map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return (
    y > 0 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  );
}
const DateOnly = () =>
  ValidateBy({
    name: 'archiveDate',
    validator: {
      validate: validArchiveDate,
      defaultMessage: (args) =>
        `${args?.property ?? 'date'} must be a valid YYYY-MM-DD date`,
    },
  });
export class ArchivePageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
export class ArchiveDatasetQueryDto {
  @ApiProperty({
    description: 'Exact published dataset/load ID returned by /datasets',
  })
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  datasetId!: string;
}
export class ArchiveRowParamsDto {
  @ApiProperty({
    description: 'Opaque archive row ID; may be UUID or deterministic hash',
  })
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  id!: string;
}
export class ArchiveFiltersDto extends ArchiveDatasetQueryDto {
  @ApiPropertyOptional({ minimum: 2021, maximum: 2025 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2021)
  @Max(2025)
  year?: number;
  @ApiPropertyOptional({
    description: 'Literal case-insensitive contains search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  policyNumber?: string;
  @ApiPropertyOptional({
    description: 'Literal case-insensitive contains search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  search?: string;
  @ApiPropertyOptional({
    description: 'Literal case-insensitive contains search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  insurer?: string;
  @ApiPropertyOptional({
    description: 'Literal case-insensitive contains search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  reinsurer?: string;
  @ApiPropertyOptional({
    description: 'Literal case-insensitive contains search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  insured?: string;
  @ApiPropertyOptional({
    description: 'Literal case-insensitive contains search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  businessName?: string;
  @ApiPropertyOptional({ description: 'Case-insensitive exact source value' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  currency?: string;
  @ApiPropertyOptional({ description: 'Case-insensitive exact source value' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  offerStatus?: string;
  @ApiPropertyOptional({ description: 'Case-insensitive exact source value' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  paymentStatus?: string;
  @ApiPropertyOptional({
    example: '2025-01-01',
    description:
      'Inclusive source DATE boundary; null dates excluded when filtered',
  })
  @IsOptional()
  @DateOnly()
  offerDateFrom?: string;
  @ApiPropertyOptional({
    example: '2025-01-01',
    description:
      'Inclusive source DATE boundary; null dates excluded when filtered',
  })
  @IsOptional()
  @DateOnly()
  offerDateTo?: string;
  @ApiPropertyOptional({
    example: '2025-01-01',
    description:
      'Inclusive source DATE boundary; null dates excluded when filtered',
  })
  @IsOptional()
  @DateOnly()
  closedDateFrom?: string;
  @ApiPropertyOptional({
    example: '2025-01-01',
    description:
      'Inclusive source DATE boundary; null dates excluded when filtered',
  })
  @IsOptional()
  @DateOnly()
  closedDateTo?: string;
}
export class ArchiveListQueryDto extends ArchiveFiltersDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'year' })
  @IsOptional()
  @IsEnum(Object.fromEntries(SORT_FIELDS.map((s) => [s, s])))
  sortBy: string = 'year';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum({ asc: 'asc', desc: 'desc' })
  sortOrder: 'asc' | 'desc' = 'desc';
}
export class ArchiveFacetsQueryDto extends ArchiveFiltersDto {
  @ApiPropertyOptional({ enum: StatementKind, default: StatementKind.INSURER })
  @IsEnum(StatementKind)
  kind: StatementKind = StatementKind.INSURER;
}
export class ArchiveExportQueryDto extends ArchiveFiltersDto {
  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'year' })
  @IsOptional()
  @IsEnum(Object.fromEntries(SORT_FIELDS.map((s) => [s, s])))
  sortBy: string = 'year';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum({ asc: 'asc', desc: 'desc' })
  sortOrder: 'asc' | 'desc' = 'desc';
}
export class ArchiveLinkedListQueryDto extends ArchiveDatasetQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
