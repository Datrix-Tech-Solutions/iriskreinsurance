import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementClaimState } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementClaimDto {
  @ApiProperty({
    example: 'CLMFAC-260821-0001',
    maxLength: 50,
    description: 'User-entered claim number. Must be unique tenant-wide.',
  })
  @TrimmedString()
  @IsString()
  @MaxLength(50)
  claimNumber!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-03T00:00:00.000Z',
    description: 'Date the loss event occurred.',
  })
  @IsDateString()
  occurrenceDate!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-05T10:00:00.000Z',
    description: 'Date the claim was reported to the broker.',
  })
  @IsDateString()
  reportedDate!: string;

  @ApiProperty({
    example: 'Warehouse fire in section B',
    maxLength: 250,
  })
  @TrimmedString()
  @IsString()
  @MaxLength(250)
  claimCause!: string;

  @ApiPropertyOptional({
    example: 'Loss affected finished stock and fire suppression equipment.',
    maxLength: 2000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  occurrenceDetails?: string;

  @ApiProperty({
    example: 'GHS',
    minLength: 3,
    maxLength: 3,
    description:
      'MVP requires this to match the placement currency. FX support is deferred.',
  })
  @TrimmedString()
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({
    example: 40000,
    minimum: 0.01,
    description: 'Estimated 100% loss amount for the placement.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  estimatedLossAmount!: number;

  @ApiPropertyOptional({
    example: 37500,
    minimum: 0.01,
    description:
      'Final 100% loss amount when known. Setting it stamps finalized metadata.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  finalLossAmount?: number;

  @ApiPropertyOptional({
    enum: PlacementClaimState,
    default: PlacementClaimState.PENDING,
    description:
      'PENDING (default) records the claim without touching reinsurers. FINALIZED generates reinsurer liability allocations in the same transaction and requires finalLossAmount.',
  })
  @IsOptional()
  @IsEnum(PlacementClaimState)
  claimState?: PlacementClaimState;
}
