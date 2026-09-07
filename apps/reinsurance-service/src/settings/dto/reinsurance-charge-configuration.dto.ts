import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ReinsuranceChargeCalculationBasis,
  ReinsuranceChargeCode,
  ReinsuranceChargeDirection,
  ReinsuranceChargeRateType,
  ReinsuranceChargeRoundingMode,
  ReinsuranceChargeType,
} from '../../../prisma/generated/client';
import {
  TrimmedString,
  UppercaseTrimmedString,
} from '../../counterparties/dto/string.transforms';
import { ApiErrorResponseDto } from './risk-class-response.dto';

export { ApiErrorResponseDto };

export class CreateReinsuranceChargeConfigurationDto {
  @ApiProperty({ enum: ReinsuranceChargeCode, example: 'NIC_LEVY' })
  @IsEnum(ReinsuranceChargeCode)
  code!: ReinsuranceChargeCode;

  @ApiProperty({ example: 'NIC Levy', maxLength: 120 })
  @TrimmedString()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ReinsuranceChargeType, example: 'LEVY' })
  @IsEnum(ReinsuranceChargeType)
  chargeType!: ReinsuranceChargeType;

  @ApiProperty({ enum: ReinsuranceChargeRateType, example: 'PERCENTAGE' })
  @IsEnum(ReinsuranceChargeRateType)
  rateType!: ReinsuranceChargeRateType;

  @ApiProperty({
    example: 0,
    description:
      'Percentage rate as a percent value, e.g. 5 for 5%, or fixed amount when rateType is FIXED_AMOUNT.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  rate!: number;

  @ApiProperty({
    enum: ReinsuranceChargeCalculationBasis,
    example: 'NET_BEFORE_CHARGES',
  })
  @IsEnum(ReinsuranceChargeCalculationBasis)
  calculationBasis!: ReinsuranceChargeCalculationBasis;

  @ApiProperty({ enum: ReinsuranceChargeDirection, example: 'DEDUCTION' })
  @IsEnum(ReinsuranceChargeDirection)
  direction!: ReinsuranceChargeDirection;

  @ApiPropertyOptional({
    example: 'GHS',
    nullable: true,
    description:
      'Optional ISO currency. Null applies to all currencies for the same tenant and code.',
  })
  @UppercaseTrimmedString()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string | null;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @ApiPropertyOptional({
    enum: ReinsuranceChargeRoundingMode,
    default: 'HALF_UP',
  })
  @IsOptional()
  @IsEnum(ReinsuranceChargeRoundingMode)
  roundingMode?: ReinsuranceChargeRoundingMode;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 6, default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  decimalPlaces?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: 10, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateReinsuranceChargeConfigurationDto {
  @ApiPropertyOptional({ example: 'NIC Levy', maxLength: 120 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ReinsuranceChargeType })
  @IsOptional()
  @IsEnum(ReinsuranceChargeType)
  chargeType?: ReinsuranceChargeType;

  @ApiPropertyOptional({ enum: ReinsuranceChargeRateType })
  @IsOptional()
  @IsEnum(ReinsuranceChargeRateType)
  rateType?: ReinsuranceChargeRateType;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  rate?: number;

  @ApiPropertyOptional({ enum: ReinsuranceChargeCalculationBasis })
  @IsOptional()
  @IsEnum(ReinsuranceChargeCalculationBasis)
  calculationBasis?: ReinsuranceChargeCalculationBasis;

  @ApiPropertyOptional({ enum: ReinsuranceChargeDirection })
  @IsOptional()
  @IsEnum(ReinsuranceChargeDirection)
  direction?: ReinsuranceChargeDirection;

  @ApiPropertyOptional({ example: 'GHS', nullable: true })
  @UppercaseTrimmedString()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @ApiPropertyOptional({ enum: ReinsuranceChargeRoundingMode })
  @IsOptional()
  @IsEnum(ReinsuranceChargeRoundingMode)
  roundingMode?: ReinsuranceChargeRoundingMode;

  @ApiPropertyOptional({ minimum: 0, maximum: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  decimalPlaces?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class QueryReinsuranceChargeConfigurationsDto {
  @ApiPropertyOptional({ enum: ReinsuranceChargeCode })
  @IsOptional()
  @IsEnum(ReinsuranceChargeCode)
  code?: ReinsuranceChargeCode;

  @ApiPropertyOptional({ example: 'GHS' })
  @UppercaseTrimmedString()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50, default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PreviewReinsuranceChargeCalculationDto {
  @ApiProperty({ example: 'GHS' })
  @UppercaseTrimmedString()
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ example: 10000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grossAmount!: number;

  @ApiPropertyOptional({ example: 1000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionAmount?: number;

  @ApiPropertyOptional({ example: 250, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  brokerageAmount?: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Whether the reinsurer is non-resident. Defaults to true so the preview shows the foreign-cession levies (NIC Levy, Withholding Tax); set false to preview a cession to a resident reinsurer.',
  })
  @IsOptional()
  @IsBoolean()
  isForeignReinsurer?: boolean;
}

export class ReinsuranceChargeConfigurationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ enum: ReinsuranceChargeCode })
  code!: ReinsuranceChargeCode;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ReinsuranceChargeType })
  chargeType!: ReinsuranceChargeType;

  @ApiProperty({ enum: ReinsuranceChargeRateType })
  rateType!: ReinsuranceChargeRateType;

  @ApiProperty({ example: '5.000000' })
  rate!: string;

  @ApiProperty({ enum: ReinsuranceChargeCalculationBasis })
  calculationBasis!: ReinsuranceChargeCalculationBasis;

  @ApiProperty({ enum: ReinsuranceChargeDirection })
  direction!: ReinsuranceChargeDirection;

  @ApiPropertyOptional({ nullable: true })
  currency!: string | null;

  @ApiProperty({ format: 'date-time' })
  effectiveFrom!: string;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  effectiveTo!: string | null;

  @ApiProperty({ enum: ReinsuranceChargeRoundingMode })
  roundingMode!: ReinsuranceChargeRoundingMode;

  @ApiProperty()
  decimalPlaces!: number;

  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty()
  displayOrder!: number;
}

export class ReinsuranceChargeTemplateDto {
  @ApiProperty({ enum: ReinsuranceChargeCode })
  code!: ReinsuranceChargeCode;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ReinsuranceChargeType })
  chargeType!: ReinsuranceChargeType;

  @ApiProperty({ enum: ReinsuranceChargeRateType })
  rateType!: ReinsuranceChargeRateType;

  @ApiProperty({ enum: ReinsuranceChargeCalculationBasis })
  calculationBasis!: ReinsuranceChargeCalculationBasis;

  @ApiProperty({ enum: ReinsuranceChargeDirection })
  direction!: ReinsuranceChargeDirection;

  @ApiProperty()
  description!: string;
}
