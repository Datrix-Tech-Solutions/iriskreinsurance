import { ApiProperty } from '@nestjs/swagger';

export class ReinsuranceDashboardCurrencyBreakdownDto {
  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ example: 125000 })
  amount!: number;
}

export class ReinsuranceDashboardNoteCountsDto {
  @ApiProperty({ example: 4 })
  draft!: number;

  @ApiProperty({ example: 8 })
  issued!: number;

  @ApiProperty({ example: 1 })
  void!: number;
}

export class ReinsuranceDashboardOverviewResponseDto {
  @ApiProperty({ example: 12 })
  activePlacements!: number;

  @ApiProperty({ example: 5 })
  closedPlacements!: number;

  @ApiProperty({ example: 7 })
  lockedPlacements!: number;

  @ApiProperty({ example: 3 })
  endorsementsPending!: number;

  @ApiProperty({ example: 2 })
  claimsOpen!: number;

  @ApiProperty({
    type: [String],
    example: ['lockedPlacements is derived from payment activity.'],
  })
  warnings!: string[];
}

export class ReinsuranceDashboardPlacementsResponseDto {
  @ApiProperty({ example: 15 })
  placementCount!: number;

  @ApiProperty({
    example: 900,
    description: 'Sum of placement facultativeOffer values.',
  })
  totalCapacity!: number;

  @ApiProperty({
    example: 640,
    description:
      'Confirmed placement and endorsement closing signedLinePercent total.',
  })
  acceptedCapacity!: number;

  @ApiProperty({ example: 260 })
  pendingCapacity!: number;

  @ApiProperty({ example: 640 })
  confirmedClosingCapacity!: number;

  @ApiProperty({ example: 2 })
  placementsMissingTarget!: number;

  @ApiProperty({ type: [String] })
  warnings!: string[];
}

export class ReinsuranceDashboardFinancialsResponseDto {
  @ApiProperty({ example: 250000 })
  grossPremium!: number;

  @ApiProperty({ example: 210000 })
  netPremium!: number;

  @ApiProperty({ example: 15000 })
  brokerage!: number;

  @ApiProperty({ example: 25000 })
  commission!: number;

  @ApiProperty({ example: 100000 })
  paid!: number;

  @ApiProperty({ example: 110000 })
  outstanding!: number;

  @ApiProperty({ type: [ReinsuranceDashboardCurrencyBreakdownDto] })
  grossPremiumByCurrency!: ReinsuranceDashboardCurrencyBreakdownDto[];

  @ApiProperty({ type: [ReinsuranceDashboardCurrencyBreakdownDto] })
  netPremiumByCurrency!: ReinsuranceDashboardCurrencyBreakdownDto[];

  @ApiProperty({ type: [ReinsuranceDashboardCurrencyBreakdownDto] })
  paidByCurrency!: ReinsuranceDashboardCurrencyBreakdownDto[];

  @ApiProperty({ type: [ReinsuranceDashboardCurrencyBreakdownDto] })
  outstandingByCurrency!: ReinsuranceDashboardCurrencyBreakdownDto[];

  @ApiProperty({ type: ReinsuranceDashboardNoteCountsDto })
  noteCounts!: ReinsuranceDashboardNoteCountsDto;

  @ApiProperty({ type: [String] })
  warnings!: string[];
}

export class ReinsuranceDashboardCashCallCountsDto {
  @ApiProperty({ example: 2 })
  draft!: number;

  @ApiProperty({ example: 4 })
  issued!: number;

  @ApiProperty({ example: 1 })
  paid!: number;
}

export class ReinsuranceDashboardClaimsResponseDto {
  @ApiProperty({ example: 6 })
  claimsCount!: number;

  @ApiProperty({ example: 4 })
  openClaims!: number;

  @ApiProperty({ example: 500000 })
  estimatedLoss!: number;

  @ApiProperty({ example: 350000 })
  finalLoss!: number;

  @ApiProperty({ example: 220000 })
  allocatedLiability!: number;

  @ApiProperty({
    type: [ReinsuranceDashboardCurrencyBreakdownDto],
    description:
      'Claims incurred per claim currency: finalLossAmount when set, otherwise estimatedLossAmount.',
  })
  claimsIncurredByCurrency!: ReinsuranceDashboardCurrencyBreakdownDto[];

  @ApiProperty({
    type: [ReinsuranceDashboardCurrencyBreakdownDto],
    description:
      'Net recoveries received per currency: bank-confirmed recovery receipts less their reversals.',
  })
  recoveriesByCurrency!: ReinsuranceDashboardCurrencyBreakdownDto[];

  @ApiProperty({ example: 120000 })
  cashCallsIssued!: number;

  @ApiProperty({ example: 40000 })
  cashCallsPaid!: number;

  @ApiProperty({ example: 80000 })
  cashCallsPending!: number;

  @ApiProperty({ type: ReinsuranceDashboardCashCallCountsDto })
  cashCallCounts!: ReinsuranceDashboardCashCallCountsDto;

  @ApiProperty({ type: [String] })
  warnings!: string[];
}
