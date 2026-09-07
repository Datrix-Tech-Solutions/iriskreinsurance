import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateShiftSwapDto {
  @ApiProperty({ description: 'Requester shift schedule ID' })
  @IsString()
  requesterScheduleId!: string;

  @ApiProperty({
    description: 'Date of the requester shift occurrence',
    example: '2026-05-14',
  })
  @IsDateString()
  requesterShiftDate!: string;

  @ApiProperty({ description: 'Colleague shift schedule ID' })
  @IsString()
  targetScheduleId!: string;

  @ApiProperty({
    description: 'Date of the colleague shift occurrence',
    example: '2026-05-18',
  })
  @IsDateString()
  targetShiftDate!: string;

  @ApiPropertyOptional({
    description: 'Optional reason for the swap request',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
