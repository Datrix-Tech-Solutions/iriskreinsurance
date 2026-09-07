import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
} from '../../../prisma/generated/client';

export class EffectivePlacementBaseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FAC/2026/001' })
  reference!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'POL-2026-001',
  })
  policyNumber!: string | null;

  @ApiProperty({ example: 'Fire policy placement' })
  title!: string;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1000000 })
  sumInsured!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 50000 })
  premium!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2.5 })
  rate!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10 })
  commissionPercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 7.5 })
  brokeragePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 60 })
  facultativeOfferPercent!: number | null;
}

export class EffectivePlacementTotalsDto {
  @ApiProperty({ example: 70 })
  facultativeOfferPercent!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 60 })
  originalFacultativeOfferPercent!: number | null;

  @ApiProperty({
    example: 10,
    description:
      'Accepted endorsement participant capacity that is not yet effective because it has not been confirmed into endorsement closings.',
  })
  acceptedEndorsementCapacityPercent!: number;

  @ApiProperty({
    example: 10,
    description:
      'Confirmed endorsement closing capacity included in the effective placement view.',
  })
  confirmedEndorsementCapacityPercent!: number;

  @ApiProperty({
    example: 0,
    description:
      'Effective facultative offer percentage less currently confirmed effective participant lines.',
  })
  remainingCapacityPercent!: number;

  @ApiProperty({ example: 2 })
  participantCount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1500000 })
  sumInsured!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 75000 })
  premium!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2.5 })
  rate!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10 })
  commissionPercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 7.5 })
  brokeragePercent!: number | null;

  @ApiProperty({ example: 45000 })
  grossPremium!: number;

  @ApiProperty({ example: 4500 })
  commissionAmount!: number;

  @ApiProperty({ example: 3375 })
  brokerageAmount!: number;

  @ApiProperty({ example: 37125 })
  netPremium!: number;
}

export class EffectivePlacementCapacityBreakdownDto {
  @ApiPropertyOptional({ type: Number, nullable: true, example: 60 })
  originalCapacityPercent!: number | null;

  @ApiProperty({ example: 10 })
  acceptedEndorsementCapacityPercent!: number;

  @ApiProperty({ example: 10 })
  confirmedEndorsementCapacityPercent!: number;

  @ApiProperty({ example: 0 })
  remainingCapacityPercent!: number;

  @ApiProperty({ example: 70 })
  effectiveTotalCapacityPercent!: number;
}

export class EffectivePlacementTermsDto {
  @ApiProperty({ example: 'Factory Fire' })
  title!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'POL-2026-001',
  })
  policyNumber!: string | null;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  riskTypeId!: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      'Effective risk/business details reconstructed from immutable placement and endorsement snapshots.',
  })
  businessDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      'Effective offer details reconstructed from immutable placement and endorsement snapshots.',
  })
  offerDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiryDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1500000 })
  sumInsured!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2.5 })
  rate!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 75000 })
  premium!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10 })
  commissionPercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 7.5 })
  brokeragePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 70 })
  facultativeOfferPercent!: number | null;
}

export class EffectiveParticipantCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.REINSURER })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Ghana Reinsurance PLC' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GRE-001' })
  registrationNumber!: string | null;
}

export class EffectiveParticipantSourceDto {
  @ApiProperty({ enum: ['PLACEMENT_CLOSING', 'ENDORSEMENT_CLOSING'] })
  sourceType!: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';

  @ApiProperty({ format: 'uuid' })
  closingId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Present when sourceType is ENDORSEMENT_CLOSING; identifies the owning placement endorsement.',
  })
  endorsementId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  participantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  endorsementParticipantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  originalParticipantId?: string | null;

  @ApiProperty({ example: 30 })
  signedLinePercent!: number;
}

export class EffectiveParticipantDto {
  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ type: EffectiveParticipantCounterpartyDto })
  counterparty!: EffectiveParticipantCounterpartyDto;

  @ApiProperty({ example: 40 })
  signedLinePercent!: number;

  @ApiProperty({ enum: ['ORIGINAL', 'REVISED', 'ADDED'], example: 'REVISED' })
  participationType!: 'ORIGINAL' | 'REVISED' | 'ADDED';

  @ApiProperty({ example: 28000 })
  grossPremium!: number;

  @ApiProperty({ example: 2800 })
  commissionAmount!: number;

  @ApiProperty({ example: 2100 })
  brokerageAmount!: number;

  @ApiProperty({ example: 23100 })
  netPremium!: number;

  @ApiProperty({ type: [EffectiveParticipantSourceDto] })
  sources!: EffectiveParticipantSourceDto[];
}

export class EffectiveEndorsementClosingSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ENC-001' })
  closingNumber!: string;

  @ApiProperty({ format: 'uuid' })
  endorsementParticipantId!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ example: 10 })
  signedLinePercent!: number;
}

export class EffectiveEndorsementSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'END-001' })
  endorsementNumber!: string;

  @ApiProperty({ enum: PlacementEndorsementType })
  type!: PlacementEndorsementType;

  @ApiProperty({ enum: PlacementEndorsementStatus })
  status!: PlacementEndorsementStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveDate!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 70 })
  targetPercent!: number | null;

  @ApiProperty({ type: [EffectiveEndorsementClosingSummaryDto] })
  confirmedClosings!: EffectiveEndorsementClosingSummaryDto[];
}

export class PendingEndorsementSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'END-002' })
  endorsementNumber!: string;

  @ApiProperty({ enum: PlacementEndorsementType })
  type!: PlacementEndorsementType;

  @ApiProperty({ enum: PlacementEndorsementStatus })
  status!: PlacementEndorsementStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveDate!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 80 })
  targetPercent!: number | null;

  @ApiProperty({ example: 0 })
  confirmedClosingCount!: number;
}

export class EffectivePlacementViewResponseDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Date/time used to decide which closed endorsements are currently effective.',
  })
  viewAsOf!: string;

  @ApiProperty({ type: EffectivePlacementBaseDto })
  basePlacement!: EffectivePlacementBaseDto;

  @ApiProperty({ type: EffectivePlacementTotalsDto })
  effectiveTotals!: EffectivePlacementTotalsDto;

  @ApiProperty({ type: EffectivePlacementCapacityBreakdownDto })
  capacityBreakdown!: EffectivePlacementCapacityBreakdownDto;

  @ApiProperty({ type: EffectivePlacementTermsDto })
  effectiveTerms!: EffectivePlacementTermsDto;

  @ApiProperty({ type: [EffectiveParticipantDto] })
  effectiveParticipants!: EffectiveParticipantDto[];

  @ApiProperty({ type: [EffectiveEndorsementSummaryDto] })
  appliedEndorsements!: EffectiveEndorsementSummaryDto[];

  @ApiProperty({
    type: [PendingEndorsementSummaryDto],
    description:
      'Closed endorsements with future effective dates. They are approved/scheduled but not included in current effective totals.',
  })
  scheduledEndorsements!: PendingEndorsementSummaryDto[];

  @ApiProperty({ type: [PendingEndorsementSummaryDto] })
  pendingEndorsements!: PendingEndorsementSummaryDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings!: string[];
}
