import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewCorrectionDto {
  @ApiProperty({
    description: 'Review action',
    example: 'APPROVED',
    enum: ['APPROVED', 'REJECTED'],
  })
  @IsEnum(['APPROVED', 'REJECTED'])
  action!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({
    description: 'Optional note when approving or rejecting',
    example: 'Looks good, approve as submitted',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
