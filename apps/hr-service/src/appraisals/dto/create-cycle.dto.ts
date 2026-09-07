import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES = [
  'ACTIVE',
  'PROBATION',
  'SUSPENDED',
] as const;

export class CreateAppraisalCycleDto {
  @ApiProperty({
    description: 'Cycle title',
    example: 'Midyear Performance Review',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional cycle description',
    example: 'Review employee goals and performance for H1',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cycle start date', example: '2026-07-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Cycle end date', example: '2026-07-31' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({
    description: 'Self-assessment deadline',
    example: '2026-07-15',
  })
  @IsDateString()
  selfAssessmentDeadline?: string;

  @ApiProperty({
    description: 'Manager review deadline',
    example: '2026-07-25',
  })
  @IsDateString()
  managerReviewDeadline?: string;

  @ApiProperty({
    description: 'Cycle frequency',
    example: 'ANNUAL',
    enum: ['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'AD_HOC'],
  })
  @IsString()
  @IsIn(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'AD_HOC'])
  frequency!: string;

  @ApiPropertyOptional({
    description: 'Department IDs to restrict cycle',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({
    description:
      'Employment types to include — FULL_TIME, PART_TIME, CONTRACT, INTERN. Defaults to all when empty.',
    type: [String],
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'], { each: true })
  employmentTypes?: string[];

  @ApiPropertyOptional({
    description:
      'Employment statuses eligible for this cycle. Leave empty to use the company appraisal default.',
    type: [String],
    enum: APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES,
  })
  @IsOptional()
  @IsArray()
  @IsIn(APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES, { each: true })
  employmentStatuses?: string[];

  @ApiPropertyOptional({
    description:
      'Explicit employee IDs to include. When set, departmentIds and employmentTypes are ignored.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];

  @ApiProperty({ description: 'Appraisal template ID' })
  @IsString()
  templateId!: string;
}
