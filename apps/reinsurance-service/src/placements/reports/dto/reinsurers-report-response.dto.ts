import { ApiProperty } from '@nestjs/swagger';

export class ReinsurerReportCurrencyAmountDto {
  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ example: 125000.25 })
  amount!: number;
}

export class ReinsurerReportCurrencyTotalsDto {
  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ example: 12 })
  placementCount!: number;

  @ApiProperty({ example: 18 })
  participantCount!: number;

  @ApiProperty({ example: 1000000 })
  sumInsured!: number;

  @ApiProperty({ example: 75000 })
  cededPremium!: number;

  @ApiProperty({ example: 12000 })
  brokerage!: number;

  @ApiProperty({ example: 8000 })
  commission!: number;

  @ApiProperty({ example: 67000 })
  payable!: number;

  @ApiProperty({ example: 45000 })
  disbursed!: number;

  @ApiProperty({ example: 20000 })
  outstanding!: number;

  @ApiProperty({ example: 5000 })
  pending!: number;
}

export class ReinsurerReportRowDto {
  @ApiProperty({ format: 'uuid' })
  reinsurerId!: string;

  @ApiProperty({ example: 'Best Re Ltd' })
  name!: string;

  @ApiProperty({ example: 8 })
  placementCount!: number;

  @ApiProperty({ example: 12 })
  participantCount!: number;

  @ApiProperty({ type: [ReinsurerReportCurrencyAmountDto] })
  cededPremiumByCurrency!: ReinsurerReportCurrencyAmountDto[];

  @ApiProperty({ type: [ReinsurerReportCurrencyAmountDto] })
  payableByCurrency!: ReinsurerReportCurrencyAmountDto[];

  @ApiProperty({ type: [ReinsurerReportCurrencyAmountDto] })
  disbursedByCurrency!: ReinsurerReportCurrencyAmountDto[];

  @ApiProperty({ type: [ReinsurerReportCurrencyAmountDto] })
  outstandingByCurrency!: ReinsurerReportCurrencyAmountDto[];

  @ApiProperty({ type: [ReinsurerReportCurrencyAmountDto] })
  pendingByCurrency!: ReinsurerReportCurrencyAmountDto[];

  @ApiProperty({ example: 75000 })
  cededPremium!: number;

  @ApiProperty({ example: 67000 })
  payable!: number;

  @ApiProperty({ example: 45000 })
  disbursed!: number;

  @ApiProperty({ example: 20000 })
  outstanding!: number;

  @ApiProperty({ example: 5000 })
  pending!: number;
}

export class ReinsurersReportSummaryDto {
  @ApiProperty({ example: 5 })
  activeReinsurers!: number;

  @ApiProperty({ example: 25 })
  totalPlacements!: number;

  @ApiProperty({ example: 30 })
  totalParticipants!: number;

  @ApiProperty({ example: 3 })
  reinsurersWithOutstanding!: number;

  @ApiProperty({ type: [ReinsurerReportCurrencyTotalsDto] })
  totalsByCurrency!: ReinsurerReportCurrencyTotalsDto[];
}

export class ReinsurersReportMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class ReinsurersReportResponseDto {
  @ApiProperty({ type: [ReinsurerReportRowDto] })
  items!: ReinsurerReportRowDto[];

  @ApiProperty({ type: ReinsurersReportSummaryDto })
  summary!: ReinsurersReportSummaryDto;

  @ApiProperty({ type: ReinsurersReportMetaDto })
  meta!: ReinsurersReportMetaDto;
}
