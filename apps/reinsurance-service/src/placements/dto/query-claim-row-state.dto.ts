import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

function parseClaimIds(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class QueryClaimRowStateDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 100,
    description:
      'Bounded claim IDs to resolve row-state for. Comma-separated query values are accepted.',
  })
  @IsOptional()
  @Transform(({ value }) => parseClaimIds(value as unknown))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  claimIds?: string[];
}
