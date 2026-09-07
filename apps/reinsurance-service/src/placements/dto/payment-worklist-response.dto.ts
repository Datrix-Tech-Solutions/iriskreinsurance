import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementStatus } from '../../../prisma/generated/client';

export const PAYMENT_WORKLIST_PAYMENT_STATUSES = [
  'Outstanding',
  'Pending',
  'Part Payment',
  'Paid',
] as const;

export type PaymentWorklistPaymentStatus =
  (typeof PAYMENT_WORKLIST_PAYMENT_STATUSES)[number];

export class PaymentWorklistRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ example: 'FAC-2026-001', nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({ example: 'POL-001', nullable: true })
  policyNumber!: string | null;

  @ApiProperty({ example: 'Xpress Group' })
  title!: string;

  @ApiPropertyOptional({ example: 'Marine Cargo', nullable: true })
  classOfBusiness!: string | null;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  cedantName!: string;

  @ApiPropertyOptional({ example: 1000000, nullable: true })
  sumInsured!: number | null;

  @ApiPropertyOptional({ example: 80, nullable: true })
  facultativeOffer!: number | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  commission!: number | null;

  @ApiPropertyOptional({ example: 800000, nullable: true })
  facultativeSumInsured!: number | null;

  @ApiPropertyOptional({
    example: 1200000,
    nullable: true,
    description:
      'Sum insured after applying every closed, in-force endorsement. Equals sumInsured when no endorsement applies.',
  })
  effectiveSumInsured!: number | null;

  @ApiPropertyOptional({
    example: 90000,
    nullable: true,
    description:
      'Facultative premium after applying every closed, in-force endorsement. Equals the base placement premium when no endorsement applies.',
  })
  effectivePremium!: number | null;

  @ApiPropertyOptional({
    example: 75,
    nullable: true,
    description:
      'Facultative offer percentage after applying every closed, in-force endorsement. Equals facultativeOffer when no endorsement applies.',
  })
  effectiveFacultativeOfferPercent!: number | null;

  @ApiPropertyOptional({
    example: 900000,
    nullable: true,
    description:
      'effectiveSumInsured * effectiveFacultativeOfferPercent / 100. Equals facultativeSumInsured when no endorsement applies.',
  })
  effectiveFacultativeSumInsured!: number | null;

  @ApiProperty({ example: 2 })
  acceptedParticipantCount!: number;

  @ApiPropertyOptional({ example: 'GHS', nullable: true })
  currency!: string | null;

  @ApiProperty({ example: 75000 })
  paidAmount!: number;

  @ApiProperty({ example: 25000 })
  outstandingAmount!: number;

  @ApiProperty({ example: 'outstanding', enum: ['outstanding', 'credit'] })
  outstandingLabel!: 'outstanding' | 'credit';

  @ApiProperty({ example: 100000 })
  currentObligation!: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  latestConfirmedPaymentDate!: string | null;

  @ApiProperty({ enum: PlacementStatus, example: PlacementStatus.CLOSED })
  placementStatus!: PlacementStatus;

  @ApiProperty({
    enum: PAYMENT_WORKLIST_PAYMENT_STATUSES,
    example: 'Part Payment',
  })
  paymentStatus!: PaymentWorklistPaymentStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'When the offer was entered in the system (placement.createdAt).',
  })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  sortDate!: string;
}

export class PaymentWorklistMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class PaymentWorklistResponseDto {
  @ApiProperty({ type: [PaymentWorklistRowDto] })
  items!: PaymentWorklistRowDto[];

  @ApiProperty({ type: PaymentWorklistMetaDto })
  meta!: PaymentWorklistMetaDto;
}
