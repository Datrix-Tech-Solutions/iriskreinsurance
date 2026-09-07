import { IsDateString, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TimeCorrectionDto {
  @ApiProperty({
    description: 'Date for the correction request',
    example: '2026-07-15',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description: 'Requested clock-in time',
    example: '08:30',
  })
  @IsOptional()
  @IsDateString()
  requestedIn?: string;

  @ApiPropertyOptional({
    description: 'Requested clock-out time',
    example: '17:30',
  })
  @IsOptional()
  @IsDateString()
  requestedOut?: string;

  @ApiProperty({
    description: 'Reason for the correction request',
    example: 'Missed punch due to meeting',
  })
  @IsString()
  reason!: string;
}
