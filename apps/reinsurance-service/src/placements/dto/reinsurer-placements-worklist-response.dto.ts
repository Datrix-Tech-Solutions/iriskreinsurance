import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
} from '../../../prisma/generated/client';

export class ReinsurerPlacementsWorklistRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FAC-ST-2026-001' })
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  policyNumber!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  cedant!: string;

  @ApiProperty({ enum: PlacementParticipantRole })
  role!: PlacementParticipantRole;

  @ApiPropertyOptional({ nullable: true })
  sharePercent!: string | null;

  @ApiProperty({ enum: PlacementParticipantStatus })
  participantStatus!: PlacementParticipantStatus;

  @ApiProperty({ enum: PlacementStatus })
  placementStatus!: PlacementStatus;

  @ApiProperty({ example: 'Facultative' })
  offerType!: 'Facultative';

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  expiryDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  currency!: string | null;

  @ApiPropertyOptional({ nullable: true })
  premium!: number | null;

  @ApiPropertyOptional({ nullable: true })
  riskType!: string | null;
}

export class ReinsurerPlacementsWorklistSummaryDto {
  @ApiProperty({ example: 130 })
  all!: number;

  @ApiProperty({ example: 80 })
  accepted!: number;

  @ApiProperty({ example: 20 })
  pending!: number;

  @ApiProperty({ example: 75 })
  closed!: number;

  @ApiProperty({ example: 5 })
  declined!: number;
}

export class ReinsurerPlacementsWorklistMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 130 })
  total!: number;

  @ApiProperty({ example: 13 })
  totalPages!: number;
}

export class ReinsurerPlacementsWorklistResponseDto {
  @ApiProperty({ type: [ReinsurerPlacementsWorklistRowDto] })
  items!: ReinsurerPlacementsWorklistRowDto[];

  @ApiProperty({ type: ReinsurerPlacementsWorklistSummaryDto })
  summary!: ReinsurerPlacementsWorklistSummaryDto;

  @ApiProperty({ type: ReinsurerPlacementsWorklistMetaDto })
  meta!: ReinsurerPlacementsWorklistMetaDto;
}
