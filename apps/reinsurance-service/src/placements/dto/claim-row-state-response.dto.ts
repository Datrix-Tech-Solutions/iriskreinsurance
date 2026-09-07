import { ApiProperty } from '@nestjs/swagger';

export const CLAIM_ROW_BUCKETS = ['notification', 'open', 'closed'] as const;

export type ClaimRowBucket = (typeof CLAIM_ROW_BUCKETS)[number];

export class ClaimRowStateDto {
  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({
    enum: CLAIM_ROW_BUCKETS,
    example: 'open',
    description:
      'Claims list bucket derived from finalLossAmount and recovery-position-compatible financial state.',
  })
  bucket!: ClaimRowBucket;

  @ApiProperty({
    example: '1250.00',
    description:
      'Bank-confirmed recovery amount net of reversal rows, matching the existing Claims list calculation.',
  })
  recoveredAmount!: string;

  @ApiProperty({
    example: '2026-08-24T10:00:00.000Z',
    nullable: true,
    description:
      'Latest bankConfirmedAt among BANK_CONFIRMED recovery receipts for the claim.',
  })
  recoveredAt!: string | null;

  @ApiProperty({ example: false })
  isFullyRecovered!: boolean;

  @ApiProperty({ example: 2 })
  nonVoidEndorsementCount!: number;

  @ApiProperty({ example: true })
  hasNonVoidEndorsement!: boolean;
}

export class ClaimRowStateResponseDto {
  @ApiProperty({ type: [ClaimRowStateDto] })
  items!: ClaimRowStateDto[];
}
