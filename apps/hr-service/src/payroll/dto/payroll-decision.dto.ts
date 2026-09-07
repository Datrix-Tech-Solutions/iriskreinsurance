import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PayrollDecisionDto {
  @ApiProperty({
    description: 'Reviewer note explaining the payroll approval decision',
    example: 'Reviewed and approved after confirming overtime adjustments.',
  })
  @IsString()
  note!: string;
}
