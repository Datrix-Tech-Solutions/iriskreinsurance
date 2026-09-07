import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementSettlementMethod,
} from '../../../prisma/generated/client';

export class PlacementPaymentCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.CEDANT })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'C-00123' })
  registrationNumber!: string | null;
}

export class PlacementPaymentParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;
}

export class PlacementPaymentClosingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CLO-001' })
  closingNumber!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '1250.00' })
  netPremium?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency?: string | null;
}

export class PlacementPaymentAllocationNoteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CN-001' })
  noteNumber!: string;

  @ApiProperty({ example: 'CREDIT_NOTE' })
  type!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '25.00' })
  nicLevyAmount?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '50.00' })
  withholdingTaxAmount?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '0.5000' })
  withholdingTaxPercent?: string | null;
}

export class PlacementPaymentAllocationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  noteId!: string;

  @ApiProperty({
    type: String,
    example: '1000.00',
    description: 'Positive amount allocated from the payment currency.',
  })
  allocatedAmount!: string;

  @ApiProperty({ example: 'USD' })
  allocatedCurrency!: string;

  @ApiProperty({
    type: String,
    example: '1000.00',
    description: 'Positive obligation amount in the credit-note currency.',
  })
  obligationAmount!: string;

  @ApiProperty({ example: 'USD' })
  obligationCurrency!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '12.345678' })
  agreedExchangeRate!: string | null;

  @ApiProperty({ type: PlacementPaymentAllocationNoteDto })
  note!: PlacementPaymentAllocationNoteDto;
}

export class PlacementPaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  closingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementClosingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  participantId!: string | null;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementPaymentType,
    example: PlacementPaymentType.PREMIUM_RECEIVED,
  })
  type!: PlacementPaymentType;

  @ApiProperty({
    enum: PlacementPaymentDirection,
    example: PlacementPaymentDirection.INBOUND,
  })
  direction!: PlacementPaymentDirection;

  @ApiProperty({
    type: String,
    example: '12500.50',
    description: 'Decimal returned as a JSON string by Prisma.',
  })
  amount!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  paymentDate!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'BANK-REF-001',
  })
  reference!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'SETTLE-2026-001',
  })
  settlementReference!: string | null;

  @ApiPropertyOptional({
    enum: PlacementSettlementMethod,
    nullable: true,
    example: PlacementSettlementMethod.BANK_TRANSFER,
  })
  settlementMethod!: PlacementSettlementMethod | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  settlementCurrency!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'BANK-CONF-001',
  })
  bankReference!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Accounting cash/bank account selected during financial confirmation for Cashbook integration.',
  })
  accountingCashAccountId!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  bankConfirmedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  bankConfirmedByUserId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '12.345678' })
  agreedExchangeRate!: string | null;

  @ApiProperty({
    type: String,
    example: '0.00',
    description: 'Bank charges captured on the transaction.',
  })
  bankChargeAmount!: string;

  @ApiProperty({
    type: String,
    example: '0.00',
    description: 'Withholding tax captured on the transaction.',
  })
  withholdingTaxAmount!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    enum: PlacementPaymentStatus,
    example: PlacementPaymentStatus.RECORDED,
  })
  status!: PlacementPaymentStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reversalOfPaymentId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementPaymentCounterpartyDto })
  counterparty!: PlacementPaymentCounterpartyDto;

  @ApiPropertyOptional({
    type: PlacementPaymentParticipantDto,
    nullable: true,
  })
  participant!: PlacementPaymentParticipantDto | null;

  @ApiPropertyOptional({ type: PlacementPaymentClosingDto, nullable: true })
  closing!: PlacementPaymentClosingDto | null;

  @ApiPropertyOptional({ type: PlacementPaymentClosingDto, nullable: true })
  endorsementClosing!: PlacementPaymentClosingDto | null;

  @ApiProperty({ type: [PlacementPaymentAllocationDto] })
  allocations!: PlacementPaymentAllocationDto[];
}

export class PlacementPaymentListResponseDto {
  @ApiProperty({ type: [PlacementPaymentResponseDto] })
  items!: PlacementPaymentResponseDto[];
}
