import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class VoidPlacementClaimCashCallDto {
  @ApiProperty({
    example: 'Cash call replaced after updated claim review.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsString()
  @MaxLength(1000)
  voidReason!: string;
}
