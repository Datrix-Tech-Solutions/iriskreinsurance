import {
  IsString,
  IsEnum,
  IsArray,
  IsInt,
  IsDateString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftType, WorkMode } from '../../../prisma/generated/client';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Employee ID for the shift', example: 'emp-123' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ description: 'Type of shift', example: 'DAY' })
  @IsEnum(ShiftType)
  shiftType!: ShiftType;

  @ApiPropertyOptional({
    description: 'Expected work mode for the shift',
    enum: WorkMode,
    default: WorkMode.ONSITE,
  })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @ApiProperty({ description: 'Shift start time', example: '08:00' })
  @IsString()
  startTime!: string;

  @ApiProperty({ description: 'Shift end time', example: '17:00' })
  @IsString()
  endTime!: string;

  @ApiProperty({
    description: 'Days of week to apply schedule (0=Sunday..6=Saturday)',
    example: [1, 2, 3, 4, 5],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  dayOfWeek!: number[];

  @ApiProperty({
    description: 'Schedule effective start date',
    example: '2026-07-01',
  })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({
    description: 'Optional effective end date',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
