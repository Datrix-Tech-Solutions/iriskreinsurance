import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PREMIUM_REPORT_PAYMENT_STATUSES,
  PremiumReportPaymentStatus,
} from '../reports/dto/query-premiums-report.dto';
import { TrimmedString } from '../../counterparties/dto/string.transforms';
import {
  PlacementStatus,
  PlacementType,
} from '../../../prisma/generated/client';

export class QueryPlacementsDto {
  @ApiPropertyOptional({ example: 'FAC-2026', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: PlacementStatus,
    example: PlacementStatus.MARKETING,
  })
  @IsOptional()
  @IsEnum(PlacementStatus)
  status?: PlacementStatus;

  @ApiPropertyOptional({
    enum: PlacementStatus,
    isArray: true,
    example: [
      PlacementStatus.DRAFT,
      PlacementStatus.MARKETING,
      PlacementStatus.PARTIALLY_PLACED,
      PlacementStatus.PLACED,
    ],
    description:
      'Comma-separated placement lifecycle statuses. Applied before pagination.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const rawValues = Array.isArray(value) ? value : [value];
    const statuses = rawValues
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
    return statuses.length ? statuses : undefined;
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsEnum(PlacementStatus, { each: true })
  statuses?: PlacementStatus[];

  @ApiPropertyOptional({
    enum: PlacementType,
    example: PlacementType.FACULTATIVE,
  })
  @IsOptional()
  @IsEnum(PlacementType)
  placementType?: PlacementType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by tenant-owned cedant counterparty.',
  })
  @IsOptional()
  @IsUUID()
  cedantId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by risk type ID (exact match).',
  })
  @IsOptional()
  @IsUUID()
  riskTypeId?: string;

  @ApiPropertyOptional({
    example: 'Marine Cargo',
    maxLength: 100,
    description:
      'Filter by class of business name (partial match, case-insensitive). ' +
      'Use riskTypeId for exact structured filtering.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  classOfBusiness?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'When true, returns archived placements only. Defaults to active placements only.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '__invalid_boolean__';
  })
  @IsBoolean()
  archived?: boolean = false;

  @ApiPropertyOptional({
    enum: PREMIUM_REPORT_PAYMENT_STATUSES,
    isArray: true,
    example: ['Outstanding', 'Part Payment'],
    description:
      'Comma-separated derived payment statuses (same derivation as the payments worklist). Applied before pagination.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const rawValues = Array.isArray(value) ? value : [value];
    const statuses = rawValues
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
    return statuses.length ? statuses : undefined;
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsIn(PREMIUM_REPORT_PAYMENT_STATUSES, { each: true })
  paymentStatus?: PremiumReportPaymentStatus[];

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'Inclusive lower bound of the date selected by dateBasis.',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description:
      'Inclusive upper bound (whole day) of the date selected by dateBasis.',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    enum: ['created', 'closed'],
    default: 'created',
    description:
      'created filters/sorts on createdAt. closed filters/sorts on the closed date: forceClosedAt, else the latest confirmed closing, else updatedAt.',
  })
  @IsOptional()
  @IsIn(['created', 'closed'])
  dateBasis?: 'created' | 'closed' = 'created';

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
