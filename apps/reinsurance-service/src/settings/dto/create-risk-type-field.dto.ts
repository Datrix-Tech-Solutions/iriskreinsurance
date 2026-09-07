import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreateRiskTypeFieldDto {
  @ApiProperty({
    enum: RiskTypeFieldSection,
    example: RiskTypeFieldSection.BUSINESS_DETAILS,
  })
  @IsEnum(RiskTypeFieldSection)
  section!: RiskTypeFieldSection;

  @ApiProperty({
    example: 'vessel_name',
    description:
      'JSON-safe key: lowercase alphanumeric and underscores, starting with a letter.',
    minLength: 1,
    maxLength: 60,
    pattern: '^[a-z][a-z0-9_]*$',
  })
  @TrimmedString()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'fieldKey must be lowercase alphanumeric with underscores, starting with a letter',
  })
  fieldKey!: string;

  @ApiProperty({ example: 'Vessel Name', minLength: 1, maxLength: 100 })
  @TrimmedString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @ApiProperty({ enum: RiskTypeFieldType, example: RiskTypeFieldType.TEXT })
  @IsEnum(RiskTypeFieldType)
  fieldType!: RiskTypeFieldType;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['Bulk Carrier', 'Container Ship', 'Tanker'],
    description: 'Required when fieldType is SELECT.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({
    type: Object,
    example: { min: 0, max: 100 },
    description: 'Arbitrary validation hints (min, max, pattern, etc.).',
  })
  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'e.g. MV Ocean Pioneer', maxLength: 200 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({
    example: 'Enter the vessel name as shown on the bill of lading.',
    maxLength: 500,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
