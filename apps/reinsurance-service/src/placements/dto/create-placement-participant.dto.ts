import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementParticipantRole,
  PlacementParticipantStatus,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementParticipantDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Tenant-owned counterparty participating in the placement.',
  })
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementParticipantRole,
    example: PlacementParticipantRole.LEAD_REINSURER,
  })
  @IsEnum(PlacementParticipantRole)
  role!: PlacementParticipantRole;

  @ApiPropertyOptional({
    enum: PlacementParticipantStatus,
    example: PlacementParticipantStatus.INVITED,
    default: PlacementParticipantStatus.INVITED,
    description:
      'Participant workflow status. Defaults to INVITED when omitted.',
  })
  @IsOptional()
  @IsEnum(PlacementParticipantStatus)
  status?: PlacementParticipantStatus;

  @ApiPropertyOptional({
    example: 30,
    minimum: 0,
    maximum: 100,
    description:
      'Offered participation percentage (0–100). ' +
      'Represents the share of the available offer extended to this participant. ' +
      'Multiple participants may each be offered the full available share during the ' +
      'marketing phase — the aggregate totalOfferedPercent can therefore exceed 100% and that is expected. ' +
      'No global cap is enforced on totalOfferedPercent.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  sharePercent?: number;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    maximum: 100,
    description:
      'Signed line percentage — the share this participant actually accepts (0–100). ' +
      'Required when status is ACCEPTED (must be > 0). ' +
      'Cannot exceed sharePercent when both are provided. ' +
      'The combined signedLinePercent of all ACCEPTED participants must not exceed ' +
      'the placement facultativeOffer (or 100 when absent).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  signedLinePercent?: number;

  @ApiPropertyOptional({
    example: 7.5,
    minimum: 0,
    maximum: 100,
    description: 'Brokerage fee percentage for this participant.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  brokerageFee?: number;

  @ApiPropertyOptional({ example: 'Lead market indication', maxLength: 1000 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
