import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementEndorsementImpactType,
  PlacementEndorsementType,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementEndorsementDto {
  @ApiProperty({
    enum: PlacementEndorsementType,
    example: PlacementEndorsementType.SUM_INSURED_INCREASE,
    description:
      'Business reason for the versioned adjustment. Endorsements do not mutate the original placement.',
  })
  @IsEnum(PlacementEndorsementType)
  type!: PlacementEndorsementType;

  @ApiPropertyOptional({
    enum: PlacementEndorsementImpactType,
    example: PlacementEndorsementImpactType.CAPACITY_INCREASE,
    description:
      'Optional explicit impact classification. When supplied, it must match the backend-derived impact from proposedSnapshot/targetPercent/type.',
  })
  @IsOptional()
  @IsEnum(PlacementEndorsementImpactType)
  impactType?: PlacementEndorsementImpactType;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-04T12:00:00.000Z',
  })
  @IsDateString()
  effectiveDate!: string;

  @ApiProperty({
    example: 'Cedant requested additional capacity after policy amendment.',
    maxLength: 500,
  })
  @TrimmedString()
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    example:
      'Increase sum insured and premium for the existing facultative risk.',
    maxLength: 2000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Optional structured summary for UI/audit display. No calculations are performed from this JSON in PR1.',
    example: {
      sumInsuredDelta: '50000.00',
      premiumDelta: '10000.00',
    },
  })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  changeSummary?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Proposed endorsement version data. Original placement state is snapshotted by the backend at creation.',
    example: {
      sumInsured: '150000.00',
      premium: '30000.00',
      coverageNotes: 'Extended warehouse coverage.',
    },
  })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  proposedSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    maximum: 100,
    description:
      'Endorsement-specific target capacity percentage. When supplied, accepted endorsement participant signed lines cannot exceed this value. When omitted, aggregate cap enforcement is deferred.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  targetPercent?: number;
}
