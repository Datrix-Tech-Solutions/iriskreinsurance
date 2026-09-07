import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementParticipantStatus } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class UpdatePlacementParticipantStatusDto {
  @ApiProperty({
    enum: PlacementParticipantStatus,
    example: PlacementParticipantStatus.ACCEPTED,
    description:
      'Target participant workflow status. Only allowed transitions are accepted — an invalid move returns 400.\n\n' +
      'Allowed transitions:\n' +
      '  INVITED → OFFER_SENT, DECLINED\n' +
      '  OFFER_SENT → QUOTED, ACCEPTED, DECLINED\n' +
      '  QUOTED → OFFER_SENT, ACCEPTED, DECLINED\n' +
      '  ACCEPTED → QUOTED, DECLINED, CLOSED\n' +
      '  DECLINED → OFFER_SENT\n' +
      '  CLOSED → terminal (no transitions)\n\n' +
      'Moving a participant to ACCEPTED requires that signedLinePercent is already set ' +
      'and greater than 0. Set signedLinePercent via PATCH /participants/:id first if needed.\n\n' +
      'Only ACCEPTED participants contribute to totalAcceptedPercent and trigger placement ' +
      'status recalculation (for MARKETING, PARTIALLY_PLACED and PLACED placements).',
  })
  @IsEnum(PlacementParticipantStatus)
  status!: PlacementParticipantStatus;

  @ApiPropertyOptional({
    example: 'Reinsurer accepted 20% line by email.',
    maxLength: 1000,
    description:
      'Optional broker note retained on the participant when supplied.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
