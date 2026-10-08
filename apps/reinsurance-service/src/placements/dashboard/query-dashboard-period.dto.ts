import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryDashboardPeriodDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive dashboard period start. Placement metrics are windowed by placement createdAt.',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive dashboard period end. Placement metrics are windowed by placement createdAt.',
  })
  @IsOptional()
  @IsDateString()
  until?: string;
}
