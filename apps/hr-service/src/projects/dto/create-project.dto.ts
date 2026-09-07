import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Payroll self-service rollout' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'Roll out employee payslip and payroll approval improvements.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({
    description: 'Employee ID of the project manager',
    example: '05ba7933-1078-4409-8242-95a08540a9d5',
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;
}
