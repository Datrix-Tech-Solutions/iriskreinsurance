import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementPaymentDirection,
  PlacementPaymentType,
  PlacementSettlementMethod,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementPaymentAllocationDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Issued CREDIT_NOTE or ENDORSEMENT_CREDIT_NOTE settled by this reinsurer disbursement.',
  })
  @IsUUID()
  noteId!: string;

  @ApiProperty({
    example: 1000,
    minimum: 0.01,
    description:
      'Positive amount allocated from the payment currency to this obligation.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  allocatedAmount!: number;

  @ApiPropertyOptional({
    example: 1000,
    minimum: 0.01,
    description:
      'Positive obligation amount in the credit-note currency. Defaults to allocatedAmount when currencies match.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  obligationAmount?: number;
}

export class CreatePlacementPaymentDto {
  @ApiProperty({
    enum: PlacementPaymentType,
    example: PlacementPaymentType.PREMIUM_RECEIVED,
    description:
      'Payment category. CLAIM_SETTLEMENT is reserved until the claims domain is implemented.',
  })
  @IsEnum(PlacementPaymentType)
  type!: PlacementPaymentType;

  @ApiProperty({
    enum: PlacementPaymentDirection,
    example: PlacementPaymentDirection.INBOUND,
    description:
      'INBOUND for cedant premium received; OUTBOUND for reinsurer disbursement.',
  })
  @IsEnum(PlacementPaymentDirection)
  direction!: PlacementPaymentDirection;

  @ApiProperty({
    format: 'uuid',
    description: 'Tenant-owned counterparty involved in the payment.',
  })
  @IsUUID()
  counterpartyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Operational original placement closing source for a reinsurer disbursement.',
  })
  @IsOptional()
  @IsUUID()
  closingId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Operational endorsement closing source for a reinsurer disbursement.',
  })
  @IsOptional()
  @IsUUID()
  endorsementClosingId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Original placement participant source. Supported only with original placement closing disbursements.',
  })
  @IsOptional()
  @IsUUID()
  participantId?: string;

  @ApiProperty({ example: 12500.5, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    example: 'USD',
    minLength: 3,
    maxLength: 3,
    description:
      'Payment currency. Premium receipts must match the placement currency. Reinsurer disbursements may differ from credit-note currency when agreedExchangeRate is supplied.',
  })
  @TrimmedString()
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-04T12:00:00.000Z',
  })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({ example: 'BANK-REF-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'SETTLE-2026-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  settlementReference?: string;

  @ApiPropertyOptional({
    enum: PlacementSettlementMethod,
    example: PlacementSettlementMethod.BANK_TRANSFER,
    description:
      'Operational settlement method selected by the source module. Accounting confirms completion later and cannot replace this fact.',
  })
  @IsOptional()
  @IsEnum(PlacementSettlementMethod)
  settlementMethod?: PlacementSettlementMethod;

  @ApiPropertyOptional({
    example: 'USD',
    minLength: 3,
    maxLength: 3,
    description:
      'Operational settlement currency. Defaults to payment currency when omitted.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  settlementCurrency?: string;

  @ApiPropertyOptional({
    example: 'BANK-CONF-001',
    maxLength: 100,
    description:
      'Accounting-only bank reference captured during bank confirmation. Use reference for the operational payment reference.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankReference?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Accounting-only bank confirmation timestamp. Operational Reinsurance payment recording does not require this field.',
  })
  @IsOptional()
  @IsDateString()
  bankConfirmedAt?: string;

  @ApiPropertyOptional({
    example: 12.345678,
    minimum: 0.000001,
    description:
      'Accounting-only agreed transaction FX rate. Required later when Accounting confirms a different-currency settlement.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  agreedExchangeRate?: number;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    description:
      'Accounting-only bank charges captured during bank confirmation. Accounting owns final posting treatment.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bankChargeAmount?: number;

  @ApiPropertyOptional({
    example: 50,
    minimum: 0,
    description:
      'Accounting-only withholding tax captured during bank confirmation. Accounting owns final posting treatment.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  withholdingTaxAmount?: number;

  @ApiPropertyOptional({
    example: 'Partial cedant premium receipt',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    type: [CreatePlacementPaymentAllocationDto],
    description:
      'Optional credit-note allocations for a reinsurer disbursement. Accounting may complete or confirm allocations later.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePlacementPaymentAllocationDto)
  allocations?: CreatePlacementPaymentAllocationDto[];
}
