import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftType, WorkMode } from '../../../prisma/generated/client';

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Type of shift', enum: ShiftType })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;

  @ApiPropertyOptional({
    description: 'Expected work mode for the shift',
    enum: WorkMode,
  })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @ApiPropertyOptional({ description: 'Shift start time', example: '08:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Shift end time', example: '17:00' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Effective end date',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
