import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PlacementNoteResponseDto } from './placement-note-response.dto';

export class EffectiveDebitNoteQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Optional ISO as-of date for current-effective debit-note reconstruction. Defaults to now.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  asOfDate?: string;
}

export class CreateEffectiveDebitNoteDto extends EffectiveDebitNoteQueryDto {}

export class EffectiveDebitNoteSourceReferenceDto {
  @ApiProperty({ enum: ['PLACEMENT_CLOSING', 'ENDORSEMENT_CLOSING', 'NOTE'] })
  sourceType!: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING' | 'NOTE';

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementId!: string | null;
}

export class EffectiveDebitNotePreviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  asOfDate!: string;

  @ApiProperty({
    example: false,
    description:
      'Current-effective debit notes are non-posting consolidated statements by default.',
  })
  postingEnabled!: boolean;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ example: 100000 })
  originalObligation!: number;

  @ApiProperty({ example: 20000 })
  endorsementAdjustments!: number;

  @ApiProperty({ example: 120000 })
  currentEffectiveObligation!: number;

  @ApiProperty({ example: 120000 })
  grossAmount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10 })
  commissionPercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 12000 })
  commissionAmount!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 7.5 })
  brokeragePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 9000 })
  brokerageAmount!: number | null;

  @ApiProperty({ example: 99000 })
  netAmount!: number;

  @ApiProperty({
    example: 'asOf=2026-08-05T12:00:00.000Z;applied=END-001;current=120000',
  })
  effectiveVersionKey!: string;

  @ApiProperty({ type: [String], example: ['END-001'] })
  includedEndorsementIds!: string[];

  @ApiProperty({ type: [String], example: ['END-002'] })
  excludedFutureEndorsementIds!: string[];

  @ApiProperty({ type: [EffectiveDebitNoteSourceReferenceDto] })
  sourceReferences!: EffectiveDebitNoteSourceReferenceDto[];

  @ApiProperty({
    type: Object,
    description:
      'Immutable backend snapshot that will be copied onto the persisted note.',
  })
  sourceSnapshot!: Record<string, unknown>;
}

export class EffectiveDebitNoteListResponseDto {
  @ApiProperty({ type: [PlacementNoteResponseDto] })
  @Type(() => PlacementNoteResponseDto)
  items!: PlacementNoteResponseDto[];
}
