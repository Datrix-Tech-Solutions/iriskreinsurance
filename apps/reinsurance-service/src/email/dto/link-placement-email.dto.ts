import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class LinkPlacementEmailDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional message ID. When omitted, the whole thread is linked to the placement.',
  })
  @IsOptional()
  @IsUUID()
  messageId?: string;

  @ApiPropertyOptional({
    example: 'Broker manually linked this renewal email.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
