import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import {
  ProjectTaskPriority,
  ProjectTaskStatus,
} from '../../../prisma/generated/client';

export class UpdateProjectTaskDto {
  @ApiPropertyOptional({ example: 'Prepare payroll approval copy' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'Draft the notification copy for approvers.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectTaskStatus })
  @IsOptional()
  @IsEnum(ProjectTaskStatus)
  status?: ProjectTaskStatus;

  @ApiPropertyOptional({ enum: ProjectTaskPriority })
  @IsOptional()
  @IsEnum(ProjectTaskPriority)
  priority?: ProjectTaskPriority;

  @ApiPropertyOptional({ example: '2026-05-22' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: '05ba7933-1078-4409-8242-95a08540a9d5',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string;
}
