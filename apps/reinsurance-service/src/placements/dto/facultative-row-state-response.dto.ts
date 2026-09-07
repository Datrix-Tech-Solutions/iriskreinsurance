import { ApiProperty } from '@nestjs/swagger';

export const FACULTATIVE_ROW_PAYMENT_STATUSES = [
  'Outstanding',
  'Pending',
  'Part Payment',
  'Paid',
] as const;

export type FacultativeRowPaymentStatus =
  (typeof FACULTATIVE_ROW_PAYMENT_STATUSES)[number];

export class FacultativeRowStateDto {
  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({
    enum: FACULTATIVE_ROW_PAYMENT_STATUSES,
    example: 'Pending',
  })
  paymentStatus!: FacultativeRowPaymentStatus;

  @ApiProperty({
    example: true,
    description:
      'Preserves current Facultative Open-table behavior: true when any placement payment is RECORDED.',
  })
  hasRecordedPayment!: boolean;

  @ApiProperty({ example: 1 })
  nonVoidEndorsementCount!: number;

  @ApiProperty({ example: true })
  hasNonVoidEndorsement!: boolean;

  @ApiProperty({
    example: 5000000,
    nullable: true,
    description:
      'Sum insured after applying every closed, in-force endorsement. Equals the base placement value when no endorsement applies.',
  })
  effectiveSumInsured!: number | null;

  @ApiProperty({
    example: 75000,
    nullable: true,
    description:
      'Facultative premium after applying every closed, in-force endorsement. Equals the base placement value when no endorsement applies.',
  })
  effectivePremium!: number | null;

  @ApiProperty({
    example: 40,
    nullable: true,
    description:
      'Facultative offer percentage after applying every closed, in-force endorsement. Equals the base placement value when no endorsement applies.',
  })
  effectiveFacultativeOfferPercent!: number | null;

  @ApiProperty({
    example: 3,
    description:
      'Effective participant count after applying every closed, in-force endorsement.',
  })
  effectiveParticipantCount!: number;
}

export class FacultativeRowStateResponseDto {
  @ApiProperty({ type: [FacultativeRowStateDto] })
  items!: FacultativeRowStateDto[];
}
