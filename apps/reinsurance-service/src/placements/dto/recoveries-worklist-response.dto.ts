import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementClaimCashCallStatus } from '../../../prisma/generated/client';
import {
  RECOVERY_WORKLIST_STATUSES,
  RecoveryWorklistStatus,
} from './query-recoveries-worklist.dto';

export class RecoveriesWorklistRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ nullable: true })
  policyNumber!: string | null;

  @ApiProperty()
  insuredTitle!: string;

  @ApiPropertyOptional({ nullable: true })
  riskType!: string | null;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty()
  claimNumber!: string;

  @ApiProperty({ format: 'uuid' })
  cashCallId!: string;

  @ApiProperty()
  cashCallNumber!: string;

  @ApiProperty({ enum: PlacementClaimCashCallStatus })
  cashCallStatus!: PlacementClaimCashCallStatus;

  @ApiProperty({ format: 'uuid' })
  allocationId!: string;

  @ApiProperty({ format: 'uuid' })
  reinsurerId!: string;

  @ApiProperty()
  reinsurerName!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ example: 1000 })
  calledAmount!: number;

  @ApiProperty({ example: 250 })
  recordedAmount!: number;

  @ApiProperty({ example: 500 })
  confirmedAmount!: number;

  @ApiProperty({ example: 100 })
  reversedAmount!: number;

  @ApiProperty({ example: 500 })
  outstandingAmount!: number;

  @ApiProperty({ example: 500 })
  recoveredAmount!: number;

  @ApiProperty({ enum: RECOVERY_WORKLIST_STATUSES })
  recoveryStatus!: RecoveryWorklistStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  occurrenceDate!: string;
}

export class RecoveriesWorklistMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class RecoveriesWorklistCurrencySummaryDto {
  @ApiProperty()
  currency!: string;

  @ApiProperty({ example: 1000 })
  calledAmount!: number;

  @ApiProperty({ example: 250 })
  recordedAmount!: number;

  @ApiProperty({ example: 500 })
  confirmedAmount!: number;

  @ApiProperty({ example: 500 })
  outstandingAmount!: number;

  @ApiProperty({ example: 3 })
  overdueCount!: number;
}

export class RecoveriesWorklistSummaryDto {
  @ApiProperty({ type: [RecoveriesWorklistCurrencySummaryDto] })
  byCurrency!: RecoveriesWorklistCurrencySummaryDto[];
}

export class RecoveriesWorklistResponseDto {
  @ApiProperty({ type: [RecoveriesWorklistRowDto] })
  items!: RecoveriesWorklistRowDto[];

  @ApiProperty({ type: RecoveriesWorklistMetaDto })
  meta!: RecoveriesWorklistMetaDto;

  @ApiProperty({ type: RecoveriesWorklistSummaryDto })
  summary!: RecoveriesWorklistSummaryDto;
}
