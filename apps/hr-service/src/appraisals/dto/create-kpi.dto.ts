import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppraisalKpiDto {
  @ApiProperty({ description: 'KPI title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'KPI description' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ description: 'Weight (0-100)' })
  @IsInt()
  @Min(1)
  @Max(100)
  weight!: number;

  @ApiPropertyOptional({ description: 'Max score', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxScore?: number;

  @ApiPropertyOptional({
    description: 'Self-assessment weight (0-100)',
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  selfWeight?: number;

  @ApiPropertyOptional({
    description: 'Manager assessment weight (0-100)',
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  managerWeight?: number;
}
