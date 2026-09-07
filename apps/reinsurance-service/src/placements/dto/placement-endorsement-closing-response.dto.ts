import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementClosingStatus,
  PlacementEndorsementParticipantStatus,
} from '../../../prisma/generated/client';

export class EndorsementClosingParticipantCounterpartySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ghana Reinsurance PLC' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GRE-001' })
  registrationNumber!: string | null;
}

export class EndorsementClosingParticipantSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementEndorsementParticipantStatus,
    example: PlacementEndorsementParticipantStatus.ACCEPTED,
  })
  status!: PlacementEndorsementParticipantStatus;

  @ApiProperty({ type: EndorsementClosingParticipantCounterpartySummaryDto })
  counterparty!: EndorsementClosingParticipantCounterpartySummaryDto;
}

export class PlacementEndorsementClosingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  endorsementId!: string;

  @ApiProperty({ format: 'uuid' })
  endorsementParticipantId!: string;

  @ApiProperty({
    example: 'ENC-001',
    description:
      'Placement-scoped endorsement closing number. Numbers are not reused, including after VOID.',
  })
  closingNumber!: string;

  @ApiProperty({
    enum: PlacementClosingStatus,
    example: PlacementClosingStatus.DRAFT,
    description:
      'Endorsement closing lifecycle status.\n' +
      'DRAFT — created, not yet issued.\n' +
      'ISSUED — formally issued for the accepted endorsement participant.\n' +
      'CONFIRMED — endorsement closing is confirmed. Terminal.\n' +
      'VOID — endorsement closing was voided. Terminal.',
  })
  status!: PlacementClosingStatus;

  @ApiProperty({
    type: String,
    example: '30.0000',
    description:
      'Snapshot of the accepted endorsement participant signed line percentage at closing creation.',
  })
  signedLinePercent!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '40.0000',
    description:
      'Snapshot of the endorsement participant offered share at closing creation.',
  })
  sharePercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '45000.00',
    description:
      'Sum insured snapshot: signedLinePercent × the endorsement sum insured from ' +
      'proposedSnapshot/originalSnapshot, captured at closing creation.',
  })
  sumInsuredSnapshot!: string | null;

  @ApiProperty({
    type: String,
    example: '9000.00',
    description:
      'Endorsement premium allocation snapshot: signedLinePercent × endorsement premium snapshot.',
  })
  premiumSnapshot!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '10.0000' })
  commissionPercent!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '900.00' })
  commissionAmount!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '7.50' })
  brokeragePercent!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '675.00' })
  brokerageAmount!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '7425.00' })
  netPremium!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  issuedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  confirmedAt!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: EndorsementClosingParticipantSummaryDto })
  endorsementParticipant!: EndorsementClosingParticipantSummaryDto;
}

export class PlacementEndorsementClosingListResponseDto {
  @ApiProperty({ type: [PlacementEndorsementClosingResponseDto] })
  items!: PlacementEndorsementClosingResponseDto[];
}
