import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyOrigin,
  CounterpartyType,
} from '../../../prisma/generated/client';
import { CreateCounterpartyAddressDto } from './create-counterparty-address.dto';
import { CreateCounterpartyContactDto } from './create-counterparty-contact.dto';
import { TrimmedString, UppercaseTrimmedString } from './string.transforms';

export class UpdateCounterpartyDto {
  @ApiPropertyOptional({
    enum: CounterpartyType,
    example: CounterpartyType.REINSURER,
  })
  @IsOptional()
  @IsEnum(CounterpartyType)
  type?: CounterpartyType;

  @ApiPropertyOptional({
    enum: CounterpartyOrigin,
    example: CounterpartyOrigin.FOREIGN,
    description:
      'LOCAL for domestically registered entities; FOREIGN for overseas companies. Country must be present after the update when origin is FOREIGN.',
  })
  @IsOptional()
  @IsEnum(CounterpartyOrigin)
  origin?: CounterpartyOrigin;

  @ApiPropertyOptional({
    example: 'Acme Insurance Ltd',
    minLength: 2,
    maxLength: 200,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'C-00123', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({
    example: 'NG',
    minLength: 2,
    maxLength: 2,
    description:
      'ISO 3166-1 alpha-2 country code. Required after update when origin is FOREIGN.',
  })
  @UppercaseTrimmedString()
  @IsOptional()
  @IsString()
  @Length(2, 2, {
    message: 'country must be a 2-character ISO 3166-1 alpha-2 code',
  })
  country?: string;

  @ApiPropertyOptional({
    example: 'TIN-0042024',
    maxLength: 100,
    description: 'Tax identification number or TIN.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({
    example: 'NAICOM/2024/001',
    maxLength: 100,
    description:
      'Insurance or business licence number issued by the regulator.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'operations@acme.example', maxLength: 200 })
  @TrimmedString()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: '+233201234567', maxLength: 50 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acme.example', maxLength: 2048 })
  @TrimmedString()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  website?: string;

  @ApiPropertyOptional({ example: 'Priority cedant account', maxLength: 2000 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    example: 5.0,
    minimum: 0,
    maximum: 100,
    description: 'Brokerage fee as a percentage (0–100)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  brokerageFee?: number;

  @ApiPropertyOptional({
    type: [CreateCounterpartyContactDto],
    maxItems: 50,
    description:
      'When supplied, replaces the complete stored contact collection.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyContactDto)
  contacts?: CreateCounterpartyContactDto[];

  @ApiPropertyOptional({
    type: [CreateCounterpartyAddressDto],
    maxItems: 20,
    description:
      'When supplied, replaces the complete stored address collection.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyAddressDto)
  addresses?: CreateCounterpartyAddressDto[];
}
