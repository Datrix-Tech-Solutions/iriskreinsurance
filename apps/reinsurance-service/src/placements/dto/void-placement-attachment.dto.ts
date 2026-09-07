import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VoidPlacementAttachmentDto {
  @ApiProperty({
    example: 'Uploaded in error; replaced by corrected document.',
    description: 'Business reason for voiding this attachment record.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
