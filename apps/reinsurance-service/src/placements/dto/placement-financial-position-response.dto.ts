import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FinancialPositionState =
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'SETTLED'
  | 'CREDIT_BALANCE';

export class PlacementFinancialPositionAdjustmentDto {
  @ApiProperty({ enum: ['PLACEMENT_CLOSING', 'ENDORSEMENT_CLOSING'] })
  sourceType!: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';

  @ApiProperty({ format: 'uuid' })
  closingId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementId!: string | null;

  @ApiPropertyOptional({ example: 'END-001', nullable: true })
  endorsementNumber!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  counterpartyId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  originalParticipantId!: string | null;

  @ApiProperty({ example: 20000 })
  amount!: number;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  effectiveDate!: string | null;
}

export class PlacementCedantFinancialPositionDto {
  @ApiProperty({ example: 100000 })
  originalObligation!: number;

  @ApiProperty({ example: 20000 })
  endorsementAdjustments!: number;

  @ApiProperty({ example: 120000 })
  currentObligation!: number;

  @ApiProperty({ example: 70000 })
  received!: number;

  @ApiProperty({ example: 0 })
  refunded!: number;

  @ApiProperty({ example: 100000 })
  grossRecorded!: number;

  @ApiProperty({ example: 30000 })
  reversed!: number;

  @ApiProperty({ example: 70000 })
  netSettled!: number;

  @ApiProperty({ example: 50000 })
  outstanding!: number;

  @ApiProperty({ enum: ['RECEIVABLE', 'PAYABLE', 'SETTLED', 'CREDIT_BALANCE'] })
  position!: FinancialPositionState;
}

export class PlacementReinsurerFinancialPositionDto {
  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ example: 'Ghana Reinsurance PLC' })
  counterpartyName!: string;

  @ApiProperty({ example: 82500 })
  originalPayable!: number;

  @ApiProperty({ example: 16500 })
  endorsementAdjustments!: number;

  @ApiProperty({ example: 99000 })
  currentEffectivePayable!: number;

  @ApiProperty({ example: 50000 })
  paid!: number;

  @ApiProperty({ example: 0 })
  refunded!: number;

  @ApiProperty({ example: 70000 })
  grossRecorded!: number;

  @ApiProperty({ example: 20000 })
  reversed!: number;

  @ApiProperty({ example: 50000 })
  netSettled!: number;

  @ApiProperty({ example: 49000 })
  outstanding!: number;

  @ApiProperty({ enum: ['RECEIVABLE', 'PAYABLE', 'SETTLED', 'CREDIT_BALANCE'] })
  position!: FinancialPositionState;

  @ApiProperty({ type: [PlacementFinancialPositionAdjustmentDto] })
  adjustments!: PlacementFinancialPositionAdjustmentDto[];
}

export class PlacementFinancialPositionResponseDto {
  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  asOfDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GHS' })
  currency!: string | null;

  @ApiProperty({ example: false })
  isMultiCurrency!: boolean;

  @ApiProperty({ type: PlacementCedantFinancialPositionDto })
  cedant!: PlacementCedantFinancialPositionDto;

  @ApiProperty({ type: [PlacementReinsurerFinancialPositionDto] })
  reinsurers!: PlacementReinsurerFinancialPositionDto[];

  @ApiProperty({ type: [PlacementFinancialPositionAdjustmentDto] })
  adjustments!: PlacementFinancialPositionAdjustmentDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings!: string[];
}
