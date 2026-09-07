import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementClaimState,
  PlacementClaimStatus,
  PlacementStatus,
} from '../../../prisma/generated/client';
import {
  CLAIM_ROW_BUCKETS,
  ClaimRowBucket,
} from './claim-row-state-response.dto';

export class ClaimsWorklistCedantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;
}

export class ClaimsWorklistPlacementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ example: 'FAC-2026-001', nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({ example: 'POL-001', nullable: true })
  policyNumber!: string | null;

  @ApiProperty({ example: 'Xpress Group' })
  title!: string;

  @ApiPropertyOptional({ example: 'Marine Cargo', nullable: true })
  classOfBusiness!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  riskTypeId!: string | null;

  @ApiProperty({ type: ClaimsWorklistCedantDto })
  cedant!: ClaimsWorklistCedantDto;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  cedantName!: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  businessDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  offerDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ example: 1000000, nullable: true })
  sumInsured!: number | null;

  @ApiPropertyOptional({ example: 1.5, nullable: true })
  rate!: number | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  commission!: number | null;

  @ApiPropertyOptional({ example: 80, nullable: true })
  facultativeOffer!: number | null;

  @ApiPropertyOptional({ example: 120000, nullable: true })
  premium!: number | null;

  @ApiPropertyOptional({ example: 'GHS', nullable: true })
  currency!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiryDate!: string | null;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  archivedByUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  archiveReason!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  closeMode!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  forceClosedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  forceClosedByUserId!: string | null;
}

export class ClaimsWorklistClaimDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ example: 'CLM-001' })
  claimNumber!: string;

  @ApiProperty({ enum: PlacementClaimStatus })
  status!: PlacementClaimStatus;

  @ApiProperty({ enum: PlacementClaimState })
  claimState!: PlacementClaimState;

  @ApiProperty({ type: String, format: 'date-time' })
  occurrenceDate!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  reportedDate!: string;

  @ApiProperty({ example: 'Fire damage' })
  claimCause!: string;

  @ApiPropertyOptional({ nullable: true })
  occurrenceDetails!: string | null;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ example: '10000.00' })
  estimatedLossAmount!: string;

  @ApiPropertyOptional({ example: '9500.00', nullable: true })
  finalLossAmount!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  finalizedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  finalizedByUserId!: string | null;

  @ApiPropertyOptional({ example: '7600.00', nullable: true })
  approvedPayableAmount!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  approvedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  approvedByUserId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  voidedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class ClaimsWorklistRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({
    enum: CLAIM_ROW_BUCKETS,
    example: 'open',
  })
  bucket!: ClaimRowBucket;

  @ApiProperty({ type: ClaimsWorklistPlacementDto })
  placement!: ClaimsWorklistPlacementDto;

  @ApiProperty({ type: ClaimsWorklistClaimDto })
  claim!: ClaimsWorklistClaimDto;

  @ApiProperty({ example: 2500 })
  recoveredAmount!: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  recoveredAt!: string | null;

  @ApiProperty({ example: false })
  isFullyRecovered!: boolean;

  @ApiProperty({ example: 8000 })
  claimShare!: number;

  @ApiProperty({ example: 2 })
  nonVoidEndorsementCount!: number;

  @ApiProperty({ example: true })
  hasNonVoidEndorsement!: boolean;
}

export class ClaimsWorklistMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class ClaimsCurrencyAmountDto {
  @ApiProperty({ example: 'GHS' })
  code!: string;

  @ApiProperty({ example: 25000 })
  amount!: number;
}

export class ClaimsWorklistResponseDto {
  @ApiProperty({ type: [ClaimsWorklistRowDto] })
  items!: ClaimsWorklistRowDto[];

  @ApiProperty({ type: ClaimsWorklistMetaDto })
  meta!: ClaimsWorklistMetaDto;
}

export class ClaimsSummaryResponseDto {
  @ApiProperty({ example: 18 })
  totalClaims!: number;

  @ApiProperty({ example: 6 })
  settledClaims!: number;

  @ApiProperty({ example: 4 })
  notificationClaims!: number;

  @ApiProperty({ example: 10 })
  openClaims!: number;

  @ApiProperty({
    example: 3,
    description:
      'Open-bucket claims still in the PENDING state (no allocations generated).',
  })
  openPendingClaims!: number;

  @ApiProperty({
    example: 7,
    description:
      'Open-bucket claims in the FINALIZED state (allocations generated).',
  })
  openFinalizedClaims!: number;

  @ApiProperty({ example: 4 })
  closedClaims!: number;

  @ApiProperty({
    type: [ClaimsCurrencyAmountDto],
    description:
      "Reinsurers' total claim share (summed allocations) for FINALIZED claims (open or closed), grouped by claim currency.",
  })
  claimsByCurrency!: ClaimsCurrencyAmountDto[];

  @ApiProperty({
    type: [ClaimsCurrencyAmountDto],
    description:
      'Recoveries received on claims still in the open bucket, grouped by claim currency. Drops out once a claim closes (fully recovered).',
  })
  recoveredByCurrency!: ClaimsCurrencyAmountDto[];

  @ApiProperty({
    type: [ClaimsCurrencyAmountDto],
    description:
      'FINALIZED claim share less recoveries received, grouped by claim currency (outstanding recovery still owed by reinsurers). Nets to ~0 for closed claims.',
  })
  outstandingRecoveredByCurrency!: ClaimsCurrencyAmountDto[];
}
