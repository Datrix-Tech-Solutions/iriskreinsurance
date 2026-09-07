import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

function parsePlacementIds(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryFacultativeRowStateDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 100,
    description:
      'Bounded placement IDs to resolve row-state for. Comma-separated query values are accepted.',
  })
  @IsOptional()
  @Transform(({ value }) => parsePlacementIds(value as unknown))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  placementIds?: string[];
}
