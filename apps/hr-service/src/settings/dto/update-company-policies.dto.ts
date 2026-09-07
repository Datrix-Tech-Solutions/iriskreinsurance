import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional } from 'class-validator';

const COMPANY_POLICY_PROBATION_OPTIONS = ['3', '4', '5', '6', 'undefined'];
const COMPANY_POLICY_RESIGNATION_WINDOWS = [
  '1w',
  '2w',
  '1m',
  '2m',
  '3m',
  '6m',
  '1y',
  '2y',
] as const;
const COMPANY_POLICY_CYCLE_RECIPIENTS = [
  'all',
  'permanent',
  'contractual',
  'probation',
  'interns',
] as const;

export class UpdateCompanyPoliciesDto {
  @ApiPropertyOptional({
    description:
      'Default probation period token used by the company policies form',
    enum: COMPANY_POLICY_PROBATION_OPTIONS,
    example: '6',
  })
  @IsOptional()
  @IsIn(COMPANY_POLICY_PROBATION_OPTIONS)
  probationPeriod?: string;

  @ApiPropertyOptional({
    description:
      'Resignation notice period token used by the company policies form',
    enum: COMPANY_POLICY_RESIGNATION_WINDOWS,
    example: '1m',
  })
  @IsOptional()
  @IsIn(COMPANY_POLICY_RESIGNATION_WINDOWS)
  resignationWindow?: string;

  @ApiPropertyOptional({
    description: 'Default appraisal cycle recipient groups',
    type: [String],
    enum: COMPANY_POLICY_CYCLE_RECIPIENTS,
    example: ['all'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(COMPANY_POLICY_CYCLE_RECIPIENTS, { each: true })
  cycleRecipients?: string[];
}
