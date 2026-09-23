import { ApiProperty } from '@nestjs/swagger';

export class PremiumsStatsCurrencyAmountDto {
  @ApiProperty({ example: 'GHS' })
  code!: string;

  @ApiProperty({ example: 125000.25 })
  amount!: number;
}

export class PremiumsStatsTopCedantDto {
  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiProperty({ example: 12 })
  count!: number;

  @ApiProperty({ type: [PremiumsStatsCurrencyAmountDto] })
  premiumByCurrency!: PremiumsStatsCurrencyAmountDto[];
}

export class PremiumsStatsResponseDto {
  @ApiProperty({ type: [PremiumsStatsCurrencyAmountDto] })
  dueByCurrency!: PremiumsStatsCurrencyAmountDto[];

  @ApiProperty({ type: [PremiumsStatsCurrencyAmountDto] })
  paidByCurrency!: PremiumsStatsCurrencyAmountDto[];

  @ApiProperty({ type: [PremiumsStatsCurrencyAmountDto] })
  outstandingByCurrency!: PremiumsStatsCurrencyAmountDto[];

  @ApiProperty({ type: [PremiumsStatsCurrencyAmountDto] })
  brokerageEarnedByCurrency!: PremiumsStatsCurrencyAmountDto[];

  @ApiProperty({
    example: 72.45,
    description:
      'Period premium collection activity divided by premium collectible during the same window.',
  })
  collectionRate!: number;

  @ApiProperty({ type: [PremiumsStatsTopCedantDto] })
  topCedantsByPaidOffers!: PremiumsStatsTopCedantDto[];
}
