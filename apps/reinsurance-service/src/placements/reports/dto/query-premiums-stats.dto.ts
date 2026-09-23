import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryPremiumsStatsDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive period start used for premium collection activity. Defaults to the current month start.',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive period end used for premium collection activity. Defaults to the current request time.',
  })
  @IsOptional()
  @IsDateString()
  until?: string;
}
