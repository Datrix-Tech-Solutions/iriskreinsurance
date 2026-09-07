import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementEndorsementImpactType,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
} from '../../../prisma/generated/client';

export class PlacementEndorsementParticipantSummaryCountsDto {
  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({
    example: 2,
    description:
      'Participants in ACCEPTED or CLOSED status. These count toward accepted endorsement capacity; confirmed closings drive placed capacity.',
  })
  accepted!: number;

  @ApiProperty({ example: 1 })
  declined!: number;
}

export class PlacementEndorsementClosingSummaryCountsDto {
  @ApiProperty({ example: 2 })
  total!: number;

  @ApiProperty({ example: 2 })
  confirmed!: number;

  @ApiProperty({ example: 0 })
  draft!: number;

  @ApiProperty({ example: 0 })
  issued!: number;

  @ApiProperty({ example: 0 })
  void!: number;
}

export class PlacementEndorsementNoteSummaryCountsDto {
  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  endorsementDebitNotes!: number;

  @ApiProperty({ example: 2 })
  endorsementCreditNotes!: number;

  @ApiProperty({ example: 3 })
  issued!: number;

  @ApiProperty({ example: 0 })
  draft!: number;

  @ApiProperty({ example: 0 })
  void!: number;
}

export class PlacementEndorsementCloseBlockingReasonDto {
  @ApiProperty({
    example: 'UNCONFIRMED_CLOSING',
    description: 'Stable machine-readable reason code for close blockers.',
  })
  code!: string;

  @ApiProperty({
    example: 'One endorsement closing has been issued but not confirmed.',
    description: 'Broker/support friendly explanation of the close blocker.',
  })
  message!: string;
}

export class PlacementEndorsementSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ example: 'END-001' })
  endorsementNumber!: string;

  @ApiProperty({
    enum: PlacementEndorsementType,
    example: PlacementEndorsementType.PARTICIPANT_ADDITION,
  })
  type!: PlacementEndorsementType;

  @ApiProperty({
    enum: PlacementEndorsementImpactType,
    example: PlacementEndorsementImpactType.CAPACITY_INCREASE,
  })
  impactType!: PlacementEndorsementImpactType;

  @ApiProperty({
    enum: PlacementEndorsementStatus,
    example: PlacementEndorsementStatus.MARKETING,
  })
  status!: PlacementEndorsementStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveDate!: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 10,
    description:
      'Endorsement target capacity percentage. Null for non-capacity endorsements.',
  })
  targetPercent!: number | null;

  @ApiProperty({
    type: Number,
    example: 10,
    description:
      'Accepted endorsement participant signed lines before validation. Original placement participants are excluded.',
  })
  acceptedPercent!: number;

  @ApiProperty({
    type: Number,
    example: 10,
    description:
      'Confirmed endorsement closing signed lines. This is the backend source of truth for placed endorsement capacity.',
  })
  placedPercent!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 0,
    description:
      'targetPercent minus confirmed placedPercent, floored at 0. Null when targetPercent is not set.',
  })
  remainingPercent!: number | null;

  @ApiProperty({ type: PlacementEndorsementParticipantSummaryCountsDto })
  participants!: PlacementEndorsementParticipantSummaryCountsDto;

  @ApiProperty({ type: PlacementEndorsementClosingSummaryCountsDto })
  closings!: PlacementEndorsementClosingSummaryCountsDto;

  @ApiProperty({ type: PlacementEndorsementNoteSummaryCountsDto })
  notes!: PlacementEndorsementNoteSummaryCountsDto;

  @ApiProperty({
    type: [String],
    example: [],
    description:
      'Backend-derived workflow hints such as SEND_TO_MARKET, ADD_CAPACITY, ACCEPT_PARTICIPANTS, CREATE_CLOSING, ISSUE_CLOSING, CONFIRM_CLOSING or CLOSE_ENDORSEMENT. Financial note/document actions are post-closing artifacts and do not block close readiness.',
  })
  pendingActions!: string[];

  @ApiProperty({
    example: false,
    description:
      'Backend-enforced close readiness. The close status transition validates this again before accepting CLOSED.',
  })
  canClose!: boolean;

  @ApiProperty({
    type: [PlacementEndorsementCloseBlockingReasonDto],
    example: [],
    description:
      'Backend-derived reasons why the endorsement cannot be closed yet.',
  })
  closeBlockingReasons!: PlacementEndorsementCloseBlockingReasonDto[];

  @ApiProperty({
    example: true,
    description:
      'True only when capacity/participant requirements are resolved, required endorsement closings are confirmed and the endorsement status is CLOSED.',
  })
  isComplete!: boolean;
}
