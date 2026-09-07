import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClockInDto {
  @ApiPropertyOptional({
    description: 'Optional clock-in location',
    example: 'Office Reception',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Optional note for the clock-in entry',
    example: 'Arrived early for meeting',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
