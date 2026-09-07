import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class ArchivePlacementDto {
  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Duplicate placement created in error.',
    description:
      'Optional reason captured when soft-archiving the placement. Restored placements clear archive metadata.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  archiveReason?: string;
}
