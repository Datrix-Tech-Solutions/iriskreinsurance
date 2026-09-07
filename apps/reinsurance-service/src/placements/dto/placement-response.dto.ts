import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  PlacementType,
} from '../../../prisma/generated/client';
import { ApiErrorResponseDto } from '../../counterparties/dto/counterparty-response.dto';
import { PlacementLockStatusDto } from './placement-lock-status.dto';

export { ApiErrorResponseDto };

export class PlacementCounterpartySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.CEDANT })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'C-00123' })
  registrationNumber!: string | null;
}

export class PlacementParticipantResponseDto {
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
    example: PlacementParticipantStatus.INVITED,
    description:
      'Participant workflow status. This replaces status stored in notes JSON.',
  })
  status!: PlacementParticipantStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '30.0000',
    description:
      'Offered participation percentage for this participant. ' +
      'Returned as a JSON string by Prisma. ' +
      'The sum across all participants (totalOfferedPercent) may exceed 100% ' +
      'because the same available share can be extended to multiple reinsurers ' +
      'during the marketing phase.',
  })
  sharePercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '25.0000',
    description:
      'Signed line percentage — the share this participant accepted. ' +
      'Returned as a JSON string by Prisma. ' +
      'Only ACCEPTED participants contribute to the placement totalAcceptedPercent.',
  })
  signedLinePercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '7.50',
    description:
      'Brokerage fee percentage. Decimal returned as JSON string by Prisma.',
  })
  brokerageFee!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Lead market' })
  notes!: string | null;

  @ApiProperty({ type: PlacementCounterpartySummaryDto })
  counterparty!: PlacementCounterpartySummaryDto;
}

export class PlacementStatusHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    enum: PlacementStatus,
    nullable: true,
    example: PlacementStatus.DRAFT,
  })
  fromStatus!: PlacementStatus | null;

  @ApiProperty({ enum: PlacementStatus, example: PlacementStatus.MARKETING })
  toStatus!: PlacementStatus;

  @ApiProperty({ format: 'uuid' })
  changedByUserId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Moved to market.',
  })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PlacementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'FAC-2026-0001' })
  reference!: string;

  @ApiProperty({ example: 'fac-2026-0001' })
  normalizedReference!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'POL-2026-0001',
    description: 'Cedant-issued policy number, entered by the user.',
  })
  policyNumber!: string | null;

  @ApiProperty({ example: 'Acme Energy Facultative Placement' })
  title!: string;

  @ApiProperty({ enum: PlacementType, example: PlacementType.FACULTATIVE })
  placementType!: PlacementType;

  @ApiProperty({
    enum: PlacementStatus,
    example: PlacementStatus.DRAFT,
    description:
      'Current placement lifecycle status.\n\n' +
      'DRAFT — being prepared, not yet submitted to market.\n' +
      'MARKETING — submitted to market, no accepted capacity yet.\n' +
      'PARTIALLY_PLACED — some capacity accepted, below the facultativeOffer target.\n' +
      'PLACED — accepted capacity has reached or exceeded the facultativeOffer target.\n' +
      'CLOSING — placed and entering formal bind/close; avoid major structural changes.\n' +
      'CLOSED — formally closed, terminal, no edits or archive allowed.\n' +
      'DECLINED — all markets declined; can return to MARKETING.\n' +
      'CANCELLED — cancelled before close, terminal, no edits allowed.',
  })
  status!: PlacementStatus;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'FK to RiskType. Drives dynamic field validation.',
  })
  riskTypeId!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Marine Cargo',
    description: 'Denormalized from RiskType.name for display and search.',
  })
  classOfBusiness!: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: {
      vessel_name: 'MV Ocean Pioneer',
      voyage_route: 'Tema → Rotterdam',
    },
    description:
      'Risk-type-specific details keyed by RiskTypeField definitions.',
  })
  businessDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { coverage_type: 'All Risk', deductible: 5000 },
    description: 'Offer-specific details keyed by RiskTypeField definitions.',
  })
  offerDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  expiryDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '16.500000',
    description:
      'Exchange rate snapshotted at placement creation or last currency change.',
  })
  exchangeRateToBase!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '5000000.00',
    description: 'Decimal returned as JSON string by Prisma.',
  })
  sumInsured!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '1.5000',
    description: 'Risk rate as a percentage. Decimal returned as JSON string.',
  })
  rate!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '75000.00',
    description: 'Gross premium. Decimal returned as JSON string.',
  })
  premium!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '15.0000',
    description: 'Commission percentage. Decimal returned as JSON string.',
  })
  commission!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '60.0000',
    description:
      'Facultative offer percentage. Decimal returned as JSON string.',
  })
  facultativeOffer!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '5.0000',
    description:
      'Preliminary brokerage percentage. Decimal returned as JSON string.',
  })
  preliminaryBrokerage!: string | null;

  @ApiProperty({ type: PlacementCounterpartySummaryDto })
  cedant!: PlacementCounterpartySummaryDto;

  @ApiProperty({ type: [PlacementParticipantResponseDto] })
  participants!: PlacementParticipantResponseDto[];

  @ApiProperty({
    example: 90,
    description:
      'Sum of sharePercent across all participants regardless of status. ' +
      'May exceed 100% because the same available share can be offered to multiple ' +
      'reinsurers during the marketing phase. Treat this as the total distribution sent to market.',
  })
  totalOfferedPercent!: number;

  @ApiProperty({
    example: 20,
    description:
      'Sum of signedLinePercent for ACCEPTED participants only. ' +
      'This is the binding accepted capacity and drives auto-recalculation of placement status. ' +
      'Validation permits up to 100 when facultativeOffer is absent, but placement preview/display calculations treat an absent facultativeOffer as 0 to match the frontend.',
  })
  totalAcceptedPercent!: number;

  @ApiProperty({
    example: 10,
    description:
      'Remaining capacity: max(0, (facultativeOffer ?? 0) − totalAcceptedPercent). ' +
      'Based on accepted capacity, not offered. Never returns negative.',
  })
  remainingPercent!: number;

  @ApiProperty({ type: [PlacementStatusHistoryResponseDto] })
  statusHistory!: PlacementStatusHistoryResponseDto[];

  @ApiPropertyOptional({
    type: PlacementLockStatusDto,
    description:
      'Included on placement detail responses. Use for frontend action gating; list responses may omit it.',
  })
  lockStatus?: PlacementLockStatusDto;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'uuid' })
  updatedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  archivedByUserId!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Duplicate placement created in error.',
  })
  archiveReason!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['NORMAL', 'FORCED'],
    example: 'FORCED',
    description:
      'How the placement reached CLOSED state. FORCED indicates an operational override.',
  })
  closeMode!: string | null;

  @ApiProperty({
    example: false,
    description:
      'True when the placement was closed through the Force Close override.',
  })
  forceClosed!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  forceClosedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  forceClosedByUserId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PlacementsPageMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ example: 34, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  totalPages!: number;
}

export class PaginatedPlacementsResponseDto {
  @ApiProperty({ type: [PlacementResponseDto] })
  items!: PlacementResponseDto[];

  @ApiProperty({ type: PlacementsPageMetaDto })
  meta!: PlacementsPageMetaDto;
}
