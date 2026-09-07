import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class VoidPlacementNoteDto {
  @ApiProperty({
    example: 'Issued in error; replacement note will be generated.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsString()
  @MaxLength(1000)
  voidReason!: string;
}
