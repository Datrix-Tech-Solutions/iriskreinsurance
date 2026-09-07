import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementEndorsementImpactType,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
} from '../../../prisma/generated/client';

export class PlacementEndorsementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({
    example: 'END-001',
    description: 'Placement-scoped endorsement number. Numbers are not reused.',
  })
  endorsementNumber!: string;

  @ApiProperty({
    enum: PlacementEndorsementType,
    example: PlacementEndorsementType.SUM_INSURED_INCREASE,
  })
  type!: PlacementEndorsementType;

  @ApiProperty({
    enum: PlacementEndorsementImpactType,
    example: PlacementEndorsementImpactType.CAPACITY_INCREASE,
    description:
      'Backend-derived workflow classification. CAPACITY_INCREASE requires market placement; TERMS_ONLY indicates financial/coverage terms changed without capacity increase; DECREASE_OR_CANCELLATION covers reductions/cancellations; ADMINISTRATIVE is non-financial/admin-only.',
  })
  impactType!: PlacementEndorsementImpactType;

  @ApiProperty({
    enum: PlacementEndorsementStatus,
    example: PlacementEndorsementStatus.DRAFT,
  })
  status!: PlacementEndorsementStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveDate!: string;

  @ApiProperty({ example: 'Cedant requested increased capacity.' })
  reason!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  changeSummary!: Record<string, unknown> | null;

  @ApiProperty({
    type: Object,
    description:
      'Backend-captured immutable snapshot of original placement state at endorsement creation.',
  })
  originalSnapshot!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'Proposed endorsement version data supplied by the broker.',
  })
  proposedSnapshot!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Endorsement target capacity percentage as a decimal-safe string. Endorsement participant accepted lines are capped only when this value is set.',
  })
  targetPercent!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'uuid' })
  updatedByUserId!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  voidedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlacementEndorsementListResponseDto {
  @ApiProperty({ type: [PlacementEndorsementResponseDto] })
  items!: PlacementEndorsementResponseDto[];
}
