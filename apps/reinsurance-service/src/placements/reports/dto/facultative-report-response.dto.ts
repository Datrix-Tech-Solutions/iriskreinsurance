import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementStatus } from '../../../../prisma/generated/client';
import { PremiumReportPaymentStatus } from './query-premiums-report.dto';

export class FacultativeCedantFinancialsDto {
  @ApiPropertyOptional({ nullable: true })
  facSumInsured!: number | null;

  @ApiPropertyOptional({ nullable: true })
  facPremium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  paidFacPremium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  cedantCommissionPercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  cedantCommissionAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  netPremiumDueIrisk!: number | null;

  @ApiPropertyOptional({ nullable: true })
  netPremiumDueIriskPaid!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brokerage!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brokeragePaid!: number | null;

  @ApiPropertyOptional({ nullable: true })
  netPremiumDueReinsurer!: number | null;

  @ApiPropertyOptional({ nullable: true })
  netPremiumDueReinsurerPaid!: number | null;
}

export class FacultativeReinsurerBreakdownDto {
  @ApiProperty({ format: 'uuid' })
  reinsurerId!: string;

  @ApiProperty()
  reinsurerName!: string;

  @ApiPropertyOptional({ nullable: true })
  sharePercent!: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  facSumInsured!: number | null;

  @ApiPropertyOptional({ nullable: true })
  facPremium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  paidFacPremium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brokerage!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brokeragePaid!: number | null;

  @ApiPropertyOptional({ nullable: true })
  withholdingTax!: number | null;

  @ApiPropertyOptional({ nullable: true })
  withholdingTaxPaid!: number | null;

  @ApiPropertyOptional({ nullable: true })
  nicLevy!: number | null;

  @ApiPropertyOptional({ nullable: true })
  nicLevyPaid!: number | null;

  @ApiPropertyOptional({ nullable: true })
  netPremiumDueReinsurer!: number | null;

  @ApiPropertyOptional({ nullable: true })
  netPremiumPaid!: number | null;
}

export class FacultativeReportRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  policyNumber!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty()
  cedantName!: string;

  @ApiPropertyOptional({ nullable: true })
  classOfBusiness!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  riskClassId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  riskClassName!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  offerDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sumInsured!: number | null;

  @ApiPropertyOptional({ nullable: true })
  premium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  currency!: string | null;

  @ApiPropertyOptional({ nullable: true })
  commission!: number | null;

  @ApiPropertyOptional({ nullable: true })
  facultativeOfferPercent!: number | null;

  @ApiProperty()
  totalOfferedPercent!: number;

  @ApiProperty()
  totalAcceptedPercent!: number;

  @ApiProperty()
  reinsurerCount!: number;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiryDate!: string | null;

  @ApiProperty({ enum: ['Outstanding', 'Pending', 'Part Payment', 'Paid'] })
  paymentStatus!: PremiumReportPaymentStatus;

  @ApiProperty({ type: FacultativeCedantFinancialsDto })
  cedantFinancials!: FacultativeCedantFinancialsDto;

  @ApiProperty({ type: [FacultativeReinsurerBreakdownDto] })
  reinsurers!: FacultativeReinsurerBreakdownDto[];
}

export class FacultativeReportCurrencyTotalsDto {
  @ApiProperty()
  currency!: string;

  @ApiProperty()
  placementCount!: number;

  @ApiProperty()
  participantCount!: number;

  @ApiProperty()
  sumInsured!: number;

  @ApiProperty()
  premium!: number;

  @ApiProperty()
  brokerage!: number;

  @ApiProperty()
  commission!: number;
}

export class FacultativeReportSummaryDto {
  @ApiProperty()
  totalOffers!: number;

  @ApiProperty()
  openOffers!: number;

  @ApiProperty()
  acceptanceRate!: number;

  @ApiProperty({ type: [FacultativeReportCurrencyTotalsDto] })
  totalsByCurrency!: FacultativeReportCurrencyTotalsDto[];
}

export class FacultativeReportMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class FacultativeReportResponseDto {
  @ApiProperty({ type: [FacultativeReportRowDto] })
  items!: FacultativeReportRowDto[];

  @ApiProperty({ type: FacultativeReportSummaryDto })
  summary!: FacultativeReportSummaryDto;

  @ApiProperty({ type: FacultativeReportMetaDto })
  meta!: FacultativeReportMetaDto;
}
