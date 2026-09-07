import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementEndorsementParticipantStatus } from '../../../prisma/generated/client';

export class PlacementEndorsementParticipantCounterpartySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Acme Re Ghana' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  registrationNumber!: string | null;
}

export class PlacementEndorsementParticipantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  endorsementId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Original placement participant ID when this endorsement response belongs to an existing reinsurer.',
  })
  originalParticipantId!: string | null;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementEndorsementParticipantStatus,
    example: PlacementEndorsementParticipantStatus.INVITED,
  })
  status!: PlacementEndorsementParticipantStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Offered endorsement share percentage as a decimal-safe string.',
  })
  sharePercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Accepted endorsement signed line percentage as a decimal-safe string.',
  })
  signedLinePercent!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementEndorsementParticipantCounterpartySummaryDto })
  counterparty!: PlacementEndorsementParticipantCounterpartySummaryDto;
}

export class PlacementEndorsementParticipantAggregatesDto {
  @ApiProperty({
    example: 70,
    description:
      'Sum of sharePercent across all endorsement participants that supplied an offered share.',
  })
  totalOfferedPercent!: number;

  @ApiProperty({
    example: 40,
    description:
      'Sum of signedLinePercent for ACCEPTED and CLOSED endorsement participants only.',
  })
  totalAcceptedPercent!: number;

  @ApiPropertyOptional({
    example: 30,
    nullable: true,
    description:
      'targetPercent minus totalAcceptedPercent when endorsement targetPercent is set; otherwise null.',
  })
  remainingPercent!: number | null;

  @ApiProperty({
    example: 20,
    description:
      'Sum of sharePercent for DECLINED endorsement participants. Declined participants do not contribute accepted capacity.',
  })
  declinedPercent!: number;
}

export class PlacementEndorsementParticipantListResponseDto {
  @ApiProperty({ type: [PlacementEndorsementParticipantResponseDto] })
  items!: PlacementEndorsementParticipantResponseDto[];

  @ApiProperty({ type: PlacementEndorsementParticipantAggregatesDto })
  aggregates!: PlacementEndorsementParticipantAggregatesDto;
}
