import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class RespondShiftSwapDto {
  @ApiProperty({
    description: 'Colleague response to the shift swap request',
    enum: ['ACCEPT', 'DECLINE'],
  })
  @IsIn(['ACCEPT', 'DECLINE'])
  action!: 'ACCEPT' | 'DECLINE';
}
