import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KpiScoreDto {
  @ApiProperty({ description: 'KPI UUID' })
  @IsString()
  kpiId!: string;

  @ApiProperty({ description: 'Score for this KPI' })
  @IsInt()
  @Min(1)
  score!: number;

  @ApiPropertyOptional({ description: 'Optional comment for this KPI' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class SubmitReviewDto {
  @ApiPropertyOptional({
    description:
      'Overall performance percentage. Required only when no kpiScores are provided.',
    example: 85,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({
    description: 'Overall comment for the review',
    example: 'Demonstrated strong collaboration and delivery',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description:
      'Per-KPI scores. When provided, the overall score is derived from weighted KPI scores.',
    type: [KpiScoreDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiScoreDto)
  kpiScores?: KpiScoreDto[];
}
