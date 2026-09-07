import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewShiftSwapDto {
  @ApiProperty({
    description: 'Approver decision on the shift swap request',
    enum: ['APPROVE', 'REJECT'],
  })
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({
    description: 'Required rejection reason when action is REJECT',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
