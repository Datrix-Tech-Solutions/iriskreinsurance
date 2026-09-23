import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementStatus } from '../../../../prisma/generated/client';
import { PremiumReportPaymentStatus } from './query-premiums-report.dto';
import { BrokerageReportScope } from './query-brokerage-report.dto';

export class BrokerageReportRowDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ nullable: true })
  policyNumber!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty()
  cedantName!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reinsurerId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reinsurerName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  riskTypeId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  policyType!: string | null;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

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
  exchangeRate!: number | null;

  @ApiPropertyOptional({ nullable: true })
  grossPremium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brokerageAmount!: number | null;

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

  @ApiProperty({ enum: ['Outstanding', 'Pending', 'Part Payment', 'Paid'] })
  paymentStatus!: PremiumReportPaymentStatus;
}

export class BrokerageReportCurrencyTotalsDto {
  @ApiProperty()
  currency!: string;

  @ApiProperty()
  placementCount!: number;

  @ApiProperty()
  participantCount!: number;

  @ApiProperty()
  premium!: number;

  @ApiProperty()
  grossPremium!: number;

  @ApiProperty()
  brokerageAmount!: number;

  @ApiProperty()
  brokeragePaid!: number;

  @ApiProperty()
  withholdingTax!: number;

  @ApiProperty()
  withholdingTaxPaid!: number;

  @ApiProperty()
  nicLevy!: number;

  @ApiProperty()
  nicLevyPaid!: number;
}

export class BrokerageReportSummaryDto {
  @ApiProperty({ enum: ['cedant', 'reinsurer'] })
  scope!: BrokerageReportScope;

  @ApiProperty()
  placementCount!: number;

  @ApiProperty()
  participantCount!: number;

  @ApiProperty({ type: [BrokerageReportCurrencyTotalsDto] })
  totalsByCurrency!: BrokerageReportCurrencyTotalsDto[];
}

export class BrokerageReportMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class BrokerageReportResponseDto {
  @ApiProperty({ type: [BrokerageReportRowDto] })
  items!: BrokerageReportRowDto[];

  @ApiProperty({ type: BrokerageReportSummaryDto })
  summary!: BrokerageReportSummaryDto;

  @ApiProperty({ type: BrokerageReportMetaDto })
  meta!: BrokerageReportMetaDto;
}
