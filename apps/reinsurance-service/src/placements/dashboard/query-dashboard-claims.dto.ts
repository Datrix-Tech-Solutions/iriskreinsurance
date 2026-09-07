import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryDashboardClaimsDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive lower bound. Windows claimsIncurredByCurrency by claim occurrence date and recoveriesByCurrency by recovery bank-confirmation date. Omit for all-time.',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive upper bound for the same window. Omit for open-ended.',
  })
  @IsOptional()
  @IsDateString()
  until?: string;
}
