import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelPlacementPaymentDto {
  @ApiPropertyOptional({
    example: 'Wrong amount entered, re-recording',
    maxLength: 500,
    description:
      'Optional note appended to the payment explaining why it was cancelled.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
