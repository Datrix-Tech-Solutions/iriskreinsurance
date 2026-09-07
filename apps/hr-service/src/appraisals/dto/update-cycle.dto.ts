import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES = [
  'ACTIVE',
  'PROBATION',
  'SUSPENDED',
] as const;

export class UpdateAppraisalCycleDto {
  @ApiPropertyOptional({ description: 'Cycle title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Cycle start date',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Cycle end date', example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Self-assessment deadline',
    example: '2026-07-15',
  })
  @IsOptional()
  @IsDateString()
  selfAssessmentDeadline?: string;

  @ApiPropertyOptional({
    description: 'Manager review deadline',
    example: '2026-07-25',
  })
  @IsOptional()
  @IsDateString()
  managerReviewDeadline?: string;

  @ApiPropertyOptional({ description: 'Frequency', example: 'Annual' })
  @IsOptional()
  @IsString()
  @IsIn(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'AD_HOC'])
  frequency?: string;

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
      'Employment types to include — FULL_TIME, PART_TIME, CONTRACT, INTERN.',
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

  @ApiPropertyOptional({ description: 'Appraisal template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;
}
