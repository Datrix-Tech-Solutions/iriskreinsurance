import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiErrorResponseDto } from './risk-class-response.dto';

export { ApiErrorResponseDto };

export class CurrencyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({
    example: 'GHS',
    description: 'ISO 4217 currency code.',
  })
  isoCode!: string;

  @ApiProperty({ example: 'Ghana Cedi' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '₵' })
  symbol!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '16.500000',
    description:
      'Exchange rate to the tenant base currency, snapshotted when the currency was last configured. Decimal returned as a JSON string by Prisma. Always "1.000000" for the base currency.',
  })
  exchangeRateToBase!: string | null;

  @ApiProperty({
    example: false,
    description:
      'True when this is the tenant reporting base currency. Its exchangeRateToBase is always 1.',
  })
  isBaseCurrency!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'uuid' })
  updatedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CurrenciesPageMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ example: 5, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 0 })
  totalPages!: number;
}

export class PaginatedCurrenciesResponseDto {
  @ApiProperty({ type: [CurrencyResponseDto] })
  items!: CurrencyResponseDto[];

  @ApiProperty({ type: CurrenciesPageMetaDto })
  meta!: CurrenciesPageMetaDto;
}
