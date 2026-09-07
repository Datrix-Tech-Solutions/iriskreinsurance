import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const REOPEN_TARGETS = ['SELF', 'MANAGER', 'FULL'] as const;

export type ReopenAppraisalTarget = (typeof REOPEN_TARGETS)[number];

export class ReopenAppraisalDto {
  @ApiPropertyOptional({
    description: 'Which side of the appraisal should be reopened',
    enum: REOPEN_TARGETS,
    default: 'SELF',
  })
  @IsOptional()
  @IsIn(REOPEN_TARGETS)
  target?: ReopenAppraisalTarget;

  @ApiPropertyOptional({ description: 'Reason for reopening or forcing redo' })
  @IsOptional()
  @IsString()
  reason?: string;
}
