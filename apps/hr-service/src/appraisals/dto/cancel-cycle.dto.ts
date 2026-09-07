import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelAppraisalCycleDto {
  @ApiProperty({
    description: 'Reason for cancelling an in-progress appraisal cycle',
    example: 'Company performance review policy was updated mid-cycle.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason!: string;
}
