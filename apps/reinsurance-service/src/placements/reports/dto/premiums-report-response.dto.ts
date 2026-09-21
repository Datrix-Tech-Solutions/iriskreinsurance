import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementStatus } from '../../../../prisma/generated/client';
import { PremiumReportPaymentStatus } from './query-premiums-report.dto';

export class PremiumReportReinsurerDto {
  @ApiProperty({ format: 'uuid' })
  reinsurerId!: string;

  @ApiProperty()
  reinsurerName!: string;

  @ApiProperty({ format: 'uuid' })
  closingId!: string;

  @ApiPropertyOptional({ nullable: true })
  sharePercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  grossPremium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  commissionPercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  commissionAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brokerageAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  netPremium!: number | null;

  @ApiProperty()
  paidAmount!: number;

  @ApiPropertyOptional({ nullable: true })
  outstandingAmount!: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;
}

export class PremiumReportRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ nullable: true })
  reference!: string | null;

  @ApiProperty()
  policyNumber!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty()
  cedantName!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  riskClassId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  riskClassName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  riskTypeId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  policyType!: string | null;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  offerDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiryDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  currency!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sumInsured!: number | null;

  @ApiPropertyOptional({ nullable: true })
  premium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  facultativeOfferPercent!: number | null;

  @ApiProperty()
  due!: number;

  @ApiProperty()
  paid!: number;

  @ApiProperty({
    description:
      'Confirmed-closing mandatory deductions credited toward cedant settlement but not counted as premium cash received.',
  })
  mandatoryDeductions!: number;

  @ApiProperty({
    description:
      'Premium cash received plus mandatory deductions used for settlement status.',
  })
  effectiveSettlementCredit!: number;

  @ApiProperty()
  outstanding!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty({ enum: ['Outstanding', 'Pending', 'Part Payment', 'Paid'] })
  paymentStatus!: PremiumReportPaymentStatus;

  @ApiProperty({ type: [PremiumReportReinsurerDto] })
  reinsurers!: PremiumReportReinsurerDto[];
}

export class PremiumReportCurrencyTotalsDto {
  @ApiProperty()
  currency!: string;

  @ApiProperty()
  placementCount!: number;

  @ApiProperty()
  participantCount!: number;

  @ApiProperty()
  sumInsured!: number;

  @ApiProperty()
  grossPremium!: number;

  @ApiProperty()
  commission!: number;

  @ApiProperty()
  brokerage!: number;

  @ApiProperty()
  cedantCurrentObligation!: number;

  @ApiProperty()
  premiumReceived!: number;

  @ApiProperty()
  mandatoryDeductions!: number;

  @ApiProperty()
  effectiveSettlementCredit!: number;

  @ApiProperty()
  cedantOutstanding!: number;

  @ApiProperty()
  cedantPending!: number;

  @ApiProperty()
  reinsurerPayable!: number;

  @ApiProperty()
  reinsurerDisbursed!: number;

  @ApiProperty()
  reinsurerOutstanding!: number;
}

export class PremiumReportSummaryDto {
  @ApiProperty()
  placementCount!: number;

  @ApiProperty()
  participantCount!: number;

  @ApiProperty({ type: [PremiumReportCurrencyTotalsDto] })
  totalsByCurrency!: PremiumReportCurrencyTotalsDto[];
}

export class PremiumReportMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PremiumsReportResponseDto {
  @ApiProperty({ type: [PremiumReportRowDto] })
  items!: PremiumReportRowDto[];

  @ApiProperty({ type: PremiumReportSummaryDto })
  summary!: PremiumReportSummaryDto;

  @ApiProperty({ type: PremiumReportMetaDto })
  meta!: PremiumReportMetaDto;
}
