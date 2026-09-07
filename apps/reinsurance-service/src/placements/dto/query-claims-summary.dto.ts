import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryClaimsSummaryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-09-01T00:00:00.000Z',
    description:
      'Inclusive lower bound on claim entry date (createdAt). Windows every KPI count and currency total. Omit for all-time.',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-10-01T00:00:00.000Z',
    description:
      'Exclusive upper bound on claim entry date (createdAt). Omit to run the window up to now.',
  })
  @IsOptional()
  @IsDateString()
  until?: string;
}
