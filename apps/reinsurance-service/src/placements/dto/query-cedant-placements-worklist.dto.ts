import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export const CEDANT_PLACEMENT_FILTERS = [
  'all',
  'pending',
  'closed',
  'unpaid',
  'paid',
] as const;

export type CedantPlacementFilter = (typeof CEDANT_PLACEMENT_FILTERS)[number];

export class QueryCedantPlacementsWorklistDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cedantId!: string;

  @ApiPropertyOptional({ enum: CEDANT_PLACEMENT_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(CEDANT_PLACEMENT_FILTERS)
  filter: CedantPlacementFilter = 'all';

  @ApiPropertyOptional({ example: 'FAC-2026', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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
}
