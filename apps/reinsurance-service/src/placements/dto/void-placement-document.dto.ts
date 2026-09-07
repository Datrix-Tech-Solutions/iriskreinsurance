import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VoidPlacementDocumentDto {
  @ApiProperty({
    example: 'Generated in error; replacement document will be generated.',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  voidReason!: string;
}
