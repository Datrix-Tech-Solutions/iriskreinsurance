import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
} from '../../../prisma/generated/client';
import {
  PAYMENT_WORKLIST_PAYMENT_STATUSES,
  PaymentWorklistPaymentStatus,
} from './payment-worklist-response.dto';

export class CedantPlacementParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ enum: PlacementParticipantRole })
  role!: PlacementParticipantRole;

  @ApiProperty({ enum: PlacementParticipantStatus })
  status!: PlacementParticipantStatus;

  @ApiPropertyOptional({ nullable: true })
  sharePercent!: string | null;

  @ApiPropertyOptional({ nullable: true })
  signedLinePercent!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brokerageFee!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;

  @ApiProperty({ type: Object })
  counterparty!: { id: string; name: string };
}

export class CedantPlacementsWorklistRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  policyNumber!: string | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  classOfBusiness!: string | null;

  @ApiPropertyOptional({ nullable: true })
  riskTypeId!: string | null;

  @ApiProperty({ type: Object })
  cedant!: { id: string; name: string };

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty()
  cedantName!: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  businessDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  offerDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sumInsured!: number | null;

  @ApiPropertyOptional({ nullable: true })
  rate!: number | null;

  @ApiPropertyOptional({ nullable: true })
  commission!: number | null;

  @ApiPropertyOptional({ nullable: true })
  facultativeOffer!: number | null;

  @ApiPropertyOptional({ nullable: true })
  premium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  currency!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiryDate!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  archivedByUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  archiveReason!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  closeMode!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  forceClosedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  forceClosedByUserId!: string | null;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

  @ApiProperty({ type: [CedantPlacementParticipantDto] })
  participants!: CedantPlacementParticipantDto[];

  @ApiProperty()
  totalOfferedPercent!: number;

  @ApiProperty()
  totalAcceptedPercent!: number;

  @ApiProperty()
  remainingPercent!: number;

  @ApiPropertyOptional({ enum: ['CONFIRMED'], nullable: true })
  closingStatus!: 'CONFIRMED' | null;

  @ApiProperty({
    enum: PAYMENT_WORKLIST_PAYMENT_STATUSES,
    example: 'Outstanding',
  })
  paymentStatus!: PaymentWorklistPaymentStatus;

  @ApiProperty()
  hasRecordedPayment!: boolean;

  @ApiProperty()
  hasNonVoidEndorsement!: boolean;

  @ApiProperty()
  acceptedParticipantCount!: number;

  @ApiProperty()
  participantCount!: number;

  @ApiProperty()
  currentObligation!: number;

  @ApiProperty()
  bankConfirmedCash!: number;

  @ApiProperty()
  pendingCash!: number;

  @ApiProperty()
  mandatoryDeductions!: number;

  @ApiProperty()
  effectiveSettlementCredit!: number;

  @ApiProperty()
  outstandingAmount!: number;
}

export class CedantPlacementsWorklistSummaryDto {
  @ApiProperty({ example: 130 })
  all!: number;

  @ApiProperty({ example: 20 })
  pending!: number;

  @ApiProperty({ example: 80 })
  closed!: number;

  @ApiProperty({ example: 30 })
  unpaid!: number;

  @ApiProperty({ example: 50 })
  paid!: number;
}

export class CedantPlacementsWorklistMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 130 })
  total!: number;

  @ApiProperty({ example: 13 })
  totalPages!: number;
}

export class CedantPlacementsWorklistResponseDto {
  @ApiProperty({ type: [CedantPlacementsWorklistRowDto] })
  items!: CedantPlacementsWorklistRowDto[];

  @ApiProperty({ type: CedantPlacementsWorklistSummaryDto })
  summary!: CedantPlacementsWorklistSummaryDto;

  @ApiProperty({ type: CedantPlacementsWorklistMetaDto })
  meta!: CedantPlacementsWorklistMetaDto;
}
