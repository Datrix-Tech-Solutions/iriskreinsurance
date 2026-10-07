import { Type } from 'class-transformer';
import {
  IsEnum,
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

export const REINSURER_PLACEMENT_FILTERS = [
  'all',
  'accepted',
  'pending',
  'closed',
  'declined',
] as const;

export type ReinsurerPlacementFilter =
  (typeof REINSURER_PLACEMENT_FILTERS)[number];

export class QueryReinsurerPlacementsWorklistDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  reinsurerId!: string;

  @ApiPropertyOptional({ enum: REINSURER_PLACEMENT_FILTERS, default: 'all' })
  @IsOptional()
  @IsEnum(REINSURER_PLACEMENT_FILTERS)
  filter: ReinsurerPlacementFilter = 'all';

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
