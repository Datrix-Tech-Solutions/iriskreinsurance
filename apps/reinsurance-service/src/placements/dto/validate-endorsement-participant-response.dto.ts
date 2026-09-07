import { ApiProperty } from '@nestjs/swagger';
import { PlacementEndorsementStatus } from '../../../prisma/generated/client';
import { PlacementEndorsementClosingResponseDto } from './placement-endorsement-closing-response.dto';
import { PlacementEndorsementParticipantResponseDto } from './placement-endorsement-participant-response.dto';
import { PlacementEndorsementSummaryResponseDto } from './placement-endorsement-summary-response.dto';

export class ValidateEndorsementParticipantResponseDto {
  @ApiProperty({
    type: PlacementEndorsementParticipantResponseDto,
    description:
      'Endorsement-scoped participant after validation. The original placement participant is not mutated.',
  })
  participant!: PlacementEndorsementParticipantResponseDto;

  @ApiProperty({
    type: PlacementEndorsementClosingResponseDto,
    description:
      'Active endorsement closing that was created or reused, issued when needed, and confirmed.',
  })
  closing!: PlacementEndorsementClosingResponseDto;

  @ApiProperty({
    type: PlacementEndorsementSummaryResponseDto,
    description: 'Fresh backend summary after endorsement validation.',
  })
  summary!: PlacementEndorsementSummaryResponseDto;

  @ApiProperty({
    enum: PlacementEndorsementStatus,
    example: PlacementEndorsementStatus.CLOSING,
    description:
      'Broker-facing effective workflow state derived from the refreshed summary. This does not silently close the endorsement.',
  })
  effectiveStatus!: PlacementEndorsementStatus;
}
