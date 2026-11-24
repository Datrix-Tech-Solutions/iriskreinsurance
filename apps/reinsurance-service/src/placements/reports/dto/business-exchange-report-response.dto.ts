import { ApiProperty } from '@nestjs/swagger';

export class BusinessExchangeReportRowDto {
  @ApiProperty({ example: 'Acme Insurance Ltd' })
  insuranceCompany!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({
    example: '2026-03',
    description: 'YYYY-MM in monthly mode, YYYY in yearly mode.',
  })
  period!: string;

  @ApiProperty({
    example: 4,
    description:
      'Placements where the company is an accepted/closed reinsurer.',
  })
  volumeGiven!: number;

  @ApiProperty({
    example: 6,
    description: 'Placements where the company is the cedant.',
  })
  volumeReceived!: number;

  @ApiProperty({
    example: 250000,
    description: 'Gross premium on placements where the company is the cedant.',
  })
  businessReceived!: number;

  @ApiProperty({
    example: 90000,
    description:
      'businessReceived minus the gross premium ceded to the company as reinsurer.',
  })
  netBalance!: number;

  @ApiProperty({
    example: 12000,
    description:
      'Effective brokerage on placements where the company is cedant or reinsurer.',
  })
  netBrokerage!: number;
}

export class BusinessExchangeCurrencyTotalsDto {
  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty() volumeGiven!: number;
  @ApiProperty() volumeReceived!: number;
  @ApiProperty() businessReceived!: number;
  @ApiProperty() netBalance!: number;
  @ApiProperty() netBrokerage!: number;
}

export class BusinessExchangeReportMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class BusinessExchangeReportSummaryDto {
  @ApiProperty() companyCount!: number;

  @ApiProperty({ type: [BusinessExchangeCurrencyTotalsDto] })
  totalsByCurrency!: BusinessExchangeCurrencyTotalsDto[];
}

export class BusinessExchangeReportResponseDto {
  @ApiProperty({ type: [BusinessExchangeReportRowDto] })
  items!: BusinessExchangeReportRowDto[];

  @ApiProperty({ type: BusinessExchangeReportSummaryDto })
  summary!: BusinessExchangeReportSummaryDto;

  @ApiProperty({ type: BusinessExchangeReportMetaDto })
  meta!: BusinessExchangeReportMetaDto;
}
