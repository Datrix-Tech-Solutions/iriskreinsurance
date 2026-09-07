import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
} from '../../../prisma/generated/client';

export class ClosingParticipantCounterpartySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.REINSURER })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Ghana Reinsurance PLC' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GRE-001' })
  registrationNumber!: string | null;
}

export class ClosingParticipantSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementParticipantRole,
    example: PlacementParticipantRole.LEAD_REINSURER,
  })
  role!: PlacementParticipantRole;

  @ApiProperty({
    enum: PlacementParticipantStatus,
    example: PlacementParticipantStatus.ACCEPTED,
  })
  status!: PlacementParticipantStatus;

  @ApiProperty({ type: ClosingParticipantCounterpartySummaryDto })
  counterparty!: ClosingParticipantCounterpartySummaryDto;
}

export class PlacementClosingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  participantId!: string;

  @ApiProperty({
    example: 'CLO-001',
    description: 'Sequential closing reference number within the placement.',
  })
  closingNumber!: string;

  @ApiProperty({
    enum: PlacementClosingStatus,
    example: PlacementClosingStatus.DRAFT,
    description:
      'Closing lifecycle status.\n' +
      'DRAFT — created, not yet sent to reinsurer.\n' +
      'ISSUED — formally issued to the reinsurer.\n' +
      'CONFIRMED — reinsurer closing is confirmed. Terminal.\n' +
      'VOID — closing was voided. Terminal.',
  })
  status!: PlacementClosingStatus;

  @ApiProperty({
    type: String,
    example: '30.0000',
    description:
      'Snapshot of the participant signed line percentage at closing creation. Decimal returned as JSON string.',
  })
  signedLinePercent!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '40.0000',
    description:
      'Snapshot of the participant offered share. Decimal returned as JSON string.',
  })
  sharePercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '600000.00',
    description:
      'Sum insured snapshot: (signedLinePercent / 100) × placement.sumInsured, captured at closing ' +
      'creation. Null when the placement had no sum insured set. Decimal returned as JSON string.',
  })
  sumInsuredSnapshot!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '4500.00',
    description:
      'Gross premium snapshot: (signedLinePercent / 100) × placement.premium. ' +
      'Closing creation requires placement premium to be set. Decimal returned as JSON string.',
  })
  grossPremium!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '10.0000',
    description:
      'Commission percentage snapshot from placement. Decimal returned as JSON string.',
  })
  commissionPercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '450.00',
    description:
      'Commission amount snapshot: (commissionPercent / 100) × grossPremium. Decimal returned as JSON string.',
  })
  commissionAmount!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '7.50',
    description:
      'Brokerage fee percentage snapshot from participant. Decimal returned as JSON string.',
  })
  brokeragePercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '337.50',
    description:
      'Brokerage amount snapshot: (brokeragePercent / 100) × grossPremium. Decimal returned as JSON string.',
  })
  brokerageAmount!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3712.50',
    description:
      'Net premium snapshot: grossPremium − commissionAmount − brokerageAmount. Decimal returned as JSON string.',
  })
  netPremium!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'USD',
  })
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

  @ApiProperty({ type: ClosingParticipantSummaryDto })
  participant!: ClosingParticipantSummaryDto;
}

export class PlacementClosingListResponseDto {
  @ApiProperty({ type: [PlacementClosingResponseDto] })
  items!: PlacementClosingResponseDto[];
}
