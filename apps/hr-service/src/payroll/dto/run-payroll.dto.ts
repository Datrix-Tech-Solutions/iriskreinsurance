import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RunPayrollDto {
  @ApiProperty({
    description: 'Payroll month number',
    example: 5,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ description: 'Payroll year', example: 2026, minimum: 2020 })
  @IsInt()
  @Min(2020)
  year!: number;

  @ApiPropertyOptional({
    description: 'Optional payroll notes',
    example: 'Monthly payroll run for May 2026',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
