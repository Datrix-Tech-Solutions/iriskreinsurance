import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementStatus } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class UpdatePlacementStatusDto {
  @ApiProperty({
    enum: PlacementStatus,
    example: PlacementStatus.MARKETING,
    description:
      'Target placement lifecycle status. Only allowed transitions are accepted — an invalid move returns 400.\n\n' +
      'Allowed transitions:\n' +
      '  DRAFT → MARKETING, CANCELLED\n' +
      '  MARKETING → PARTIALLY_PLACED, PLACED, DECLINED, CANCELLED\n' +
      '  PARTIALLY_PLACED → MARKETING, PLACED, DECLINED, CANCELLED\n' +
      '  PLACED → PARTIALLY_PLACED, CLOSING, CANCELLED\n' +
      '  CLOSING → PLACED, CLOSED, CANCELLED\n' +
      '  DECLINED → MARKETING\n' +
      '  CLOSED → terminal (no transitions)\n' +
      '  CANCELLED → terminal (no transitions)\n\n' +
      'MARKETING, PARTIALLY_PLACED and PLACED are also set automatically by ' +
      'participant capacity recalculation when participants are added or changed.',
  })
  @IsEnum(PlacementStatus)
  status!: PlacementStatus;

  @ApiPropertyOptional({
    example: 'Moved to market after broker review.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
