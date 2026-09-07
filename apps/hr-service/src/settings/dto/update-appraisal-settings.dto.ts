import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsIn, Max, Min } from 'class-validator';

const APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES = [
  'ACTIVE',
  'PROBATION',
  'SUSPENDED',
] as const;

export class UpdateAppraisalSettingsDto {
  @ApiProperty({ description: 'Outstanding threshold percentage', default: 90 })
  @IsInt()
  @Min(0)
  @Max(100)
  outstandingThreshold!: number;

  @ApiProperty({ description: 'Very Good threshold percentage', default: 80 })
  @IsInt()
  @Min(0)
  @Max(100)
  veryGoodThreshold!: number;

  @ApiProperty({ description: 'Good threshold percentage', default: 70 })
  @IsInt()
  @Min(0)
  @Max(100)
  goodThreshold!: number;

  @ApiProperty({
    description: 'Satisfactory threshold percentage',
    default: 60,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  satisfactoryThreshold!: number;

  @ApiProperty({
    description:
      'Default employment statuses eligible for new appraisal cycles',
    type: [String],
    enum: APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES,
    default: ['ACTIVE', 'PROBATION'],
  })
  @IsArray()
  @IsIn(APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES, { each: true })
  appraisalEligibleStatuses!: string[];
}
