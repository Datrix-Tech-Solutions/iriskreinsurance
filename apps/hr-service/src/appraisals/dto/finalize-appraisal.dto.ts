import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class FinalizeAppraisalDto {
  @ApiPropertyOptional({
    description:
      'Optional final score override. When omitted, the system computes the weighted final score.',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  finalScore?: number;

  @ApiPropertyOptional({
    description: 'Finalization note visible in audit context',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
