import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementType } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';
import { CreatePlacementParticipantDto } from './create-placement-participant.dto';

export class CreatePlacementDto {
  @ApiProperty({
    example: 'FAC-2026-0001',
    minLength: 2,
    maxLength: 80,
    description:
      'Broker-controlled placement reference, unique per tenant while active.',
  })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  reference!: string;

  @ApiPropertyOptional({
    example: 'POL-2026-0001',
    minLength: 2,
    maxLength: 80,
    description:
      'Cedant-issued policy number, entered by the user. Distinct from reference.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  policyNumber?: string | null;

  @ApiProperty({
    example: 'Acme Energy Facultative Placement',
    minLength: 2,
    maxLength: 200,
  })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    enum: PlacementType,
    example: PlacementType.FACULTATIVE,
    default: PlacementType.FACULTATIVE,
  })
  @IsOptional()
  @IsEnum(PlacementType)
  placementType?: PlacementType;

  @ApiProperty({
    format: 'uuid',
    description: 'Tenant-owned cedant counterparty for the placement.',
  })
  @IsUUID()
  cedantId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Risk type that drives dynamic businessDetails/offerDetails field validation. ' +
      'Must belong to the authenticated tenant.',
  })
  @IsOptional()
  @IsUUID()
  riskTypeId?: string;

  @ApiPropertyOptional({
    example: 'Marine Cargo',
    maxLength: 100,
    description:
      'Denormalized display label. When riskTypeId is supplied this is auto-populated ' +
      'from RiskType.name; may also be supplied directly.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  classOfBusiness?: string;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Risk-type-specific details. Keys must match active RiskTypeField definitions ' +
      'for the BUSINESS_DETAILS section of the selected riskTypeId.',
    example: {
      vessel_name: 'MV Ocean Pioneer',
      voyage_route: 'Tema → Rotterdam',
    },
  })
  @IsOptional()
  @IsObject()
  businessDetails?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Offer-specific details. Keys must match active RiskTypeField definitions ' +
      'for the OFFER_DETAILS section of the selected riskTypeId.',
    example: { coverage_type: 'All Risk', deductible: 5000 },
  })
  @IsOptional()
  @IsObject()
  offerDetails?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Facultative placement for upstream energy risk.',
    maxLength: 4000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  inceptionDate?: string;

  @ApiPropertyOptional({ example: '2027-05-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'USD', minLength: 3, maxLength: 3 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 5000000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sumInsured?: number;

  @ApiPropertyOptional({
    example: 1.5,
    minimum: 0,
    maximum: 100,
    description: 'Risk rate as a percentage (0–100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rate?: number;

  @ApiPropertyOptional({
    example: 75000,
    minimum: 0,
    description: 'Gross premium amount in the placement currency.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium?: number;

  @ApiPropertyOptional({
    example: 15,
    minimum: 0,
    maximum: 100,
    description: 'Reinsurance commission as a percentage (0–100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  commission?: number;

  @ApiPropertyOptional({
    example: 60,
    minimum: 0,
    maximum: 100,
    description:
      'Facultative offer percentage — the share of the risk being ceded to the market (0–100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  facultativeOffer?: number;

  @ApiPropertyOptional({
    example: 5,
    minimum: 0,
    maximum: 100,
    description: 'Preliminary brokerage as a percentage (0–100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  preliminaryBrokerage?: number;

  @ApiPropertyOptional({
    type: [CreatePlacementParticipantDto],
    maxItems: 100,
    description:
      'When supplied, participants are stored as the placement market snapshot.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreatePlacementParticipantDto)
  participants?: CreatePlacementParticipantDto[];
}
