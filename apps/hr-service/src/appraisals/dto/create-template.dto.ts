import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateKpiDto {
  @ApiProperty({ description: 'KPI title' })
  @IsString()
  title!: string;

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

  @ApiPropertyOptional({ description: 'KPI description' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class CreateAppraisalTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Self-assessment weight (0-100)',
    default: 40,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  selfAssessmentWeight?: number;

  @ApiPropertyOptional({
    description: 'Manager assessment weight (0-100)',
    default: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  managerAssessmentWeight?: number;

  @ApiProperty({
    description: 'KPIs for this template',
    type: [TemplateKpiDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateKpiDto)
  kpis?: TemplateKpiDto[];
}
