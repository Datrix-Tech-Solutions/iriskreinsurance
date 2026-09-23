import { ApiProperty } from '@nestjs/swagger';

export class CedantReportCurrencyAmountDto {
  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ example: 125000.25 })
  amount!: number;
}

export class CedantReportCurrencyTotalsDto {
  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ example: 12 })
  placementCount!: number;

  @ApiProperty({ example: 1000000 })
  sumInsured!: number;

  @ApiProperty({ example: 75000 })
  premium!: number;

  @ApiProperty({ example: 12000 })
  brokerage!: number;

  @ApiProperty({ example: 8000 })
  commission!: number;

  @ApiProperty({ example: 0 })
  nicLevy!: number;

  @ApiProperty({ example: 0 })
  wht!: number;

  @ApiProperty({ example: 67000 })
  totalPremium!: number;

  @ApiProperty({ example: 45000 })
  received!: number;

  @ApiProperty({ example: 2000 })
  mandatoryDeductions!: number;

  @ApiProperty({ example: 47000 })
  effectiveSettlementCredit!: number;

  @ApiProperty({ example: 20000 })
  outstanding!: number;

  @ApiProperty({ example: 5000 })
  pending!: number;
}

export class CedantReportRowDto {
  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiProperty({ example: 8 })
  placementCount!: number;

  @ApiProperty({ type: [CedantReportCurrencyAmountDto] })
  totalPremiumByCurrency!: CedantReportCurrencyAmountDto[];

  @ApiProperty({ type: [CedantReportCurrencyAmountDto] })
  outstandingByCurrency!: CedantReportCurrencyAmountDto[];

  @ApiProperty({ type: [CedantReportCurrencyAmountDto] })
  pendingByCurrency!: CedantReportCurrencyAmountDto[];

  @ApiProperty({ example: 67000 })
  totalPremium!: number;

  @ApiProperty({ example: 20000 })
  outstanding!: number;

  @ApiProperty({ example: 5000 })
  pending!: number;
}

export class CedantsReportSummaryDto {
  @ApiProperty({ example: 5 })
  activeCedants!: number;

  @ApiProperty({ example: 25 })
  totalPlacements!: number;

  @ApiProperty({ example: 3 })
  cedantsWithOutstanding!: number;

  @ApiProperty({ type: [CedantReportCurrencyTotalsDto] })
  totalsByCurrency!: CedantReportCurrencyTotalsDto[];
}

export class CedantsReportMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class CedantsReportResponseDto {
  @ApiProperty({ type: [CedantReportRowDto] })
  items!: CedantReportRowDto[];

  @ApiProperty({ type: CedantsReportSummaryDto })
  summary!: CedantsReportSummaryDto;

  @ApiProperty({ type: CedantsReportMetaDto })
  meta!: CedantsReportMetaDto;
}
