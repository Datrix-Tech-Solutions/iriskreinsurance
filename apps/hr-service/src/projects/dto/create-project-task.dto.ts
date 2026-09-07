import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ProjectTaskPriority } from '../../../prisma/generated/client';

export class CreateProjectTaskDto {
  @ApiProperty({ example: 'Prepare payroll approval copy' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'Draft the notification copy for approvers.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-05-22' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    enum: ProjectTaskPriority,
    example: ProjectTaskPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ProjectTaskPriority)
  priority?: ProjectTaskPriority;

  @ApiPropertyOptional({ example: '05ba7933-1078-4409-8242-95a08540a9d5' })
  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string;
}
