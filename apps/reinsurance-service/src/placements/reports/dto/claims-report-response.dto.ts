import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementClaimState } from '../../../../prisma/generated/client';
import { ClaimRowBucket } from '../../dto/claim-row-state-response.dto';
import { ClaimsReportScope } from './query-claims-report.dto';

export class ClaimsReportRowDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ enum: ['notification', 'open', 'closed'] })
  bucket!: ClaimRowBucket;

  @ApiProperty()
  policyNumber!: string;

  @ApiProperty()
  businessName!: string;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty()
  cedantName!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  riskTypeId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  policyType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  claimType!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  periodStart!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  periodEnd!: string | null;

  @ApiProperty()
  claimNumber!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  occurrenceDate!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  premiumPaidAt!: string | null;

  @ApiProperty()
  estimatedLossAmount!: number;

  @ApiPropertyOptional({ nullable: true })
  finalLossAmount!: number | null;

  @ApiProperty()
  claimAmount!: number;

  @ApiProperty({ enum: PlacementClaimState })
  claimState!: PlacementClaimState;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  finalizedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  recoveredAmount!: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  recoveredAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  iriskSharePercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  iriskShareAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  iriskSharePaid!: number | null;

  @ApiPropertyOptional({ nullable: true })
  iriskShareOutstanding!: number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reinsurerId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reinsurerName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reinsurerSharePercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  reinsurerShareAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  reinsurerPaidAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  reinsurerOutstandingAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  agingDays!: number | null;

  @ApiPropertyOptional({ nullable: true })
  dolDop!: number | null;
}

export class ClaimsReportCurrencyTotalsDto {
  @ApiProperty()
  currency!: string;

  @ApiProperty()
  claimCount!: number;

  @ApiProperty()
  claimAmount!: number;

  @ApiProperty()
  iriskShareAmount!: number;

  @ApiProperty()
  bankConfirmedRecovery!: number;

  @ApiProperty()
  outstandingRecovery!: number;
}

export class ClaimsReportSummaryDto {
  @ApiProperty({ enum: ['general', 'cedant', 'reinsurer'] })
  scope!: ClaimsReportScope;

  @ApiProperty()
  openClaims!: number;

  @ApiProperty()
  closedClaims!: number;

  @ApiProperty({
    description:
      'Share of finalized open/closed claims that are fully recovered from reinsurers.',
  })
  recoveryRate!: number;

  @ApiProperty({ type: [ClaimsReportCurrencyTotalsDto] })
  totalsByCurrency!: ClaimsReportCurrencyTotalsDto[];
}

export class ClaimsReportMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ClaimsReportResponseDto {
  @ApiProperty({ type: [ClaimsReportRowDto] })
  items!: ClaimsReportRowDto[];

  @ApiProperty({ type: ClaimsReportSummaryDto })
  summary!: ClaimsReportSummaryDto;

  @ApiProperty({ type: ClaimsReportMetaDto })
  meta!: ClaimsReportMetaDto;
}
