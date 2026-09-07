import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  PlacementType,
} from '../../../prisma/generated/client';

export class SlipPreviewContactDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Akosua Mensah' })
  fullName!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Head of Treaty',
  })
  jobTitle!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'akosua@example.com',
  })
  email!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+233240000000',
  })
  phone!: string | null;

  @ApiProperty({ example: true })
  isPrimary!: boolean;
}

export class SlipPreviewAddressDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Head office' })
  label!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '1 Independence Avenue',
  })
  line1!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  line2!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Accra' })
  city!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Greater Accra',
  })
  state!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GA-123-4567' })
  postalCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GH' })
  country!: string | null;

  @ApiProperty({ example: true })
  isPrimary!: boolean;
}

export class SlipPreviewCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.REINSURER })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Ghana Reinsurance PLC' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'REG-001' })
  registrationNumber!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'broker@example.com',
  })
  email!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+233240000000',
  })
  phone!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GH' })
  country!: string | null;

  @ApiProperty({ type: [SlipPreviewContactDto] })
  contacts!: SlipPreviewContactDto[];

  @ApiProperty({ type: [SlipPreviewAddressDto] })
  addresses!: SlipPreviewAddressDto[];
}

export class SlipPreviewDetailEntryDto {
  @ApiProperty({ example: 'vessel_name' })
  key!: string;

  @ApiProperty({
    example: 'Vessel Name',
    description:
      'Frontend-compatible display label generated from the JSON key by replacing underscores and title-casing words.',
  })
  label!: string;

  @ApiProperty({ nullable: true, example: 'MV Ocean Pioneer' })
  value!: unknown;
}

export class SlipPreviewPlacementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FAC-2026-0001' })
  reference!: string;

  @ApiProperty({ example: 'Marine Cargo Facultative Placement' })
  title!: string;

  @ApiProperty({ enum: PlacementType, example: PlacementType.FACULTATIVE })
  placementType!: PlacementType;

  @ApiProperty({ enum: PlacementStatus, example: PlacementStatus.MARKETING })
  status!: PlacementStatus;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  riskTypeId!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Marine Cargo',
  })
  classOfBusiness!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  expiryDate!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1000000 })
  sumInsured!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1.5 })
  rate!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 15000 })
  premium!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10 })
  commission!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 40 })
  facultativeOffer!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 5 })
  preliminaryBrokerage!: number | null;
}

export class SlipPreviewFinancialsDto {
  @ApiProperty({
    example: 7.5,
    description:
      'Brokerage fee percentage passed to the current frontend SlipPreviewModal.',
  })
  brokerageFee!: number;

  @ApiProperty({
    example: 40,
    description: 'facultativeOffer ?? 0, matching the frontend.',
  })
  facOffer!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 400000,
    description: '(facOffer / 100) * sumInsured when sumInsured exists.',
  })
  facSumInsured!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 6000,
    description: '(facOffer / 100) * premium when premium exists.',
  })
  reinsurancePremium!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 1050,
    description:
      '((commission ?? 0) + brokerageFee) / 100 * reinsurancePremium, matching SlipPreviewModal.',
  })
  commissions!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 4950,
    description: 'reinsurancePremium - commissions.',
  })
  netPremium!: number | null;
}

export class SlipPreviewDebitGuaranteeFinancialsDto {
  @ApiPropertyOptional({ type: Number, nullable: true, example: 400000 })
  facSumInsured!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 6000 })
  facPremium!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 600,
    description: '(commission ?? 0) / 100 * facPremium.',
  })
  commissionAmount!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 5400 })
  netPremium!: number | null;
}

export class SlipPreviewDistributionFinancialsDto {
  @ApiProperty({ example: 40 })
  shareLine!: number;

  @ApiProperty({ example: 7.5 })
  brokerageFee!: number;

  @ApiProperty({
    example: 6000,
    description: 'premium * ((facultativeOffer ?? 0) / 100).',
  })
  facPremium!: number;

  @ApiProperty({
    example: 2400,
    description: '(shareLine / 100) * facPremium.',
  })
  premiumShare!: number;

  @ApiProperty({
    example: 180,
    description: '(brokerageFee / 100) * premiumShare.',
  })
  brokerageAmount!: number;
}

export class SlipPreviewClosingRowDto {
  @ApiProperty({ example: 30 })
  signedShare!: number;

  @ApiProperty({
    example: 4500,
    description: '(signedShare / 100) * (premium ?? 0).',
  })
  signedGrossPremium!: number;

  @ApiProperty({ example: 7.5 })
  brokerageFee!: number;
}

export class SlipPreviewCreditNoteFinancialsDto {
  @ApiProperty({ example: 30 })
  sharePercent!: number;

  @ApiProperty({ example: 7.5 })
  brokerageFee!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 300000 })
  yourSumInsured!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 4500 })
  yourPremium!: number | null;

  @ApiProperty({
    example: 17.5,
    description: '(commission ?? 0) + brokerageFee.',
  })
  totalCommissionPct!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 787.5 })
  commissionAmount!: number | null;

  @ApiProperty({ example: 0 })
  nicLevyPct!: number;

  @ApiProperty({ example: 0 })
  nicLevyAmount!: number;

  @ApiProperty({ example: 0 })
  withholdingTaxPct!: number;

  @ApiProperty({ example: 0 })
  withholdingTaxAmount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 3712.5 })
  netPremium!: number | null;
}

export class SlipPreviewParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ enum: PlacementParticipantRole })
  role!: PlacementParticipantRole;

  @ApiProperty({ enum: PlacementParticipantStatus })
  status!: PlacementParticipantStatus;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 40 })
  sharePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 30 })
  signedLinePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 7.5 })
  brokerageFee!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: SlipPreviewCounterpartyDto })
  counterparty!: SlipPreviewCounterpartyDto;
}

export class OfferSlipParticipantPreviewDto {
  @ApiProperty({ type: SlipPreviewParticipantDto })
  participant!: SlipPreviewParticipantDto;

  @ApiProperty({ type: SlipPreviewFinancialsDto })
  slipFinancials!: SlipPreviewFinancialsDto;

  @ApiProperty({ type: SlipPreviewDistributionFinancialsDto })
  distributionFinancials!: SlipPreviewDistributionFinancialsDto;
}

export class OfferSlipPreviewResponseDto {
  @ApiProperty({ type: SlipPreviewPlacementDto })
  placement!: SlipPreviewPlacementDto;

  @ApiProperty({ type: SlipPreviewCounterpartyDto })
  cedant!: SlipPreviewCounterpartyDto;

  @ApiProperty({ type: [SlipPreviewDetailEntryDto] })
  businessEntries!: SlipPreviewDetailEntryDto[];

  @ApiProperty({ type: [SlipPreviewDetailEntryDto] })
  offerEntries!: SlipPreviewDetailEntryDto[];

  @ApiProperty({
    type: SlipPreviewDebitGuaranteeFinancialsDto,
    description:
      'Debit/Guarantee note values mirrored from current frontend formulas, excluding brokerage.',
  })
  debitGuaranteeFinancials!: SlipPreviewDebitGuaranteeFinancialsDto;

  @ApiProperty({ type: [OfferSlipParticipantPreviewDto] })
  participantPreviews!: OfferSlipParticipantPreviewDto[];

  @ApiProperty({ example: 90 })
  totalOfferedPercent!: number;

  @ApiProperty({ example: 30 })
  totalAcceptedPercent!: number;

  @ApiProperty({ example: 10 })
  remainingPercent!: number;
}

export class ClosingSlipPreviewResponseDto {
  @ApiProperty({ type: SlipPreviewPlacementDto })
  placement!: SlipPreviewPlacementDto;

  @ApiProperty({ type: SlipPreviewCounterpartyDto })
  cedant!: SlipPreviewCounterpartyDto;

  @ApiProperty({ type: SlipPreviewParticipantDto })
  participant!: SlipPreviewParticipantDto;

  @ApiProperty({ type: [SlipPreviewDetailEntryDto] })
  businessEntries!: SlipPreviewDetailEntryDto[];

  @ApiProperty({ type: [SlipPreviewDetailEntryDto] })
  offerEntries!: SlipPreviewDetailEntryDto[];

  @ApiProperty({ type: SlipPreviewFinancialsDto })
  slipFinancials!: SlipPreviewFinancialsDto;

  @ApiProperty({ type: SlipPreviewClosingRowDto })
  closingRow!: SlipPreviewClosingRowDto;

  @ApiProperty({ type: SlipPreviewCreditNoteFinancialsDto })
  creditNoteFinancials!: SlipPreviewCreditNoteFinancialsDto;

  @ApiProperty({
    type: SlipPreviewDebitGuaranteeFinancialsDto,
    description:
      'Debit/Guarantee note values mirrored from current frontend formulas, excluding brokerage.',
  })
  debitGuaranteeFinancials!: SlipPreviewDebitGuaranteeFinancialsDto;
}
