import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetCondition, AssetType } from '../../../prisma/generated/client';

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset display name', example: 'MacBook Pro 14' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: AssetType, example: AssetType.LAPTOP })
  @IsEnum(AssetType)
  type!: AssetType;

  @ApiPropertyOptional({
    description: 'Free-text label describing the asset type when type is OTHER',
    example: 'Projector',
  })
  @ValidateIf((dto) => dto.type === AssetType.OTHER)
  @IsString()
  @MinLength(1)
  customType?: string;

  @ApiPropertyOptional({
    description: 'Manufacturer serial number',
    example: 'C02XL0LFJGH5',
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Purchase date in ISO format',
    example: '2026-04-10',
  })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({
    description: 'Purchase amount in tenant currency',
    example: 12500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseCost?: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'GHS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: AssetCondition, example: AssetCondition.GOOD })
  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @ApiPropertyOptional({
    description: 'Internal notes about the asset',
    example: 'Issued with docking station and charger.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Branch the asset is assigned to',
    example: 'branch-789',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
