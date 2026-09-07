import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectTaskStatus } from '../../../prisma/generated/client';

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ProjectTaskStatus, example: ProjectTaskStatus.DONE })
  @IsEnum(ProjectTaskStatus)
  status!: ProjectTaskStatus;
}
