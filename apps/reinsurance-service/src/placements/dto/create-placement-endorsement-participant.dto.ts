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
import { PlacementEndorsementParticipantStatus } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementEndorsementParticipantDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Tenant-owned active REINSURER counterparty participating in the endorsement.',
  })
  @IsUUID()
  counterpartyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Original placement participant ID when this reinsurer already participated in the underlying placement. Omit for newly introduced reinsurers.',
  })
  @IsOptional()
  @IsUUID()
  originalParticipantId?: string;

  @ApiPropertyOptional({
    enum: PlacementEndorsementParticipantStatus,
    example: PlacementEndorsementParticipantStatus.INVITED,
    default: PlacementEndorsementParticipantStatus.INVITED,
    description:
      'Endorsement participant workflow status. Defaults to INVITED when omitted.',
  })
  @IsOptional()
  @IsEnum(PlacementEndorsementParticipantStatus)
  status?: PlacementEndorsementParticipantStatus;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    maximum: 100,
    description:
      'Endorsement offer percentage extended to this reinsurer. Optional during early marketing; when supplied it must be greater than 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  sharePercent?: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    maximum: 100,
    description:
      'Signed endorsement line accepted by this reinsurer. Required and greater than 0 when status is ACCEPTED.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  signedLinePercent?: number;

  @ApiPropertyOptional({
    example: 'Existing reinsurer accepted revised endorsement terms.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
