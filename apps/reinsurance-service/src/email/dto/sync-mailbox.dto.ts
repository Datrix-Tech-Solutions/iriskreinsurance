import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SyncMailboxDto {
  @ApiPropertyOptional({
    example: 25,
    default: 25,
    minimum: 1,
    maximum: 50,
    description: 'Maximum number of recent provider messages to inspect.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 25;
}
