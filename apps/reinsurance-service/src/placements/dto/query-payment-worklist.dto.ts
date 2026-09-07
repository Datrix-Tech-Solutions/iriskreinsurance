import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ArrayMaxSize,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export const PAYMENT_WORKLIST_STATUS_FILTERS = [
  'Placed',
  'Closed',
  'Outstanding',
  'Pending',
  'Part Payment',
  'Paid',
] as const;

export type PaymentWorklistStatusFilter =
  (typeof PAYMENT_WORKLIST_STATUS_FILTERS)[number];

function parsePlacementIds(value: unknown): unknown {
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

export class QueryPaymentWorklistDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    example: 'FAC-2026',
    maxLength: 100,
    description:
      'Searches placement reference, policy number, title, risk type and cedant name.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: PAYMENT_WORKLIST_STATUS_FILTERS,
    description:
      'Current Payments table status filter. Placed/Closed target placement lifecycle; Pending/Part Payment/Paid target payment state.',
  })
  @IsOptional()
  @IsIn(PAYMENT_WORKLIST_STATUS_FILTERS)
  status?: PaymentWorklistStatusFilter;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by tenant-owned cedant counterparty.',
  })
  @IsOptional()
  @IsUUID()
  cedantId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Optional bounded set of placement IDs. Comma-separated query values are accepted.',
  })
  @IsOptional()
  @Transform(({ value }) => parsePlacementIds(value as unknown))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  placementIds?: string[];
}
