import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyOrigin,
  CounterpartyType,
} from '../../../prisma/generated/client';
import { CreateCounterpartyAddressDto } from './create-counterparty-address.dto';
import { CreateCounterpartyContactDto } from './create-counterparty-contact.dto';
import { TrimmedString, UppercaseTrimmedString } from './string.transforms';

export class CreateCounterpartyDto {
  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.CEDANT })
  @IsEnum(CounterpartyType)
  type!: CounterpartyType;

  @ApiPropertyOptional({
    enum: CounterpartyOrigin,
    example: CounterpartyOrigin.LOCAL,
    default: CounterpartyOrigin.LOCAL,
    description:
      'LOCAL for domestically registered entities; FOREIGN for overseas companies. ' +
      'When FOREIGN, country is required.',
  })
  @IsOptional()
  @IsEnum(CounterpartyOrigin)
  origin?: CounterpartyOrigin;

  @ApiProperty({ example: 'Acme Insurance Ltd', minLength: 2, maxLength: 200 })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: 'C-00123',
    maxLength: 100,
    description: 'Company registration number issued by the regulatory body.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({
    example: 'GH',
    minLength: 2,
    maxLength: 2,
    description:
      'ISO 3166-1 alpha-2 country code. Required when origin is FOREIGN.',
  })
  @UppercaseTrimmedString()
  @ValidateIf(
    (o: CreateCounterpartyDto) => o.origin === CounterpartyOrigin.FOREIGN,
  )
  @IsNotEmpty({ message: 'country is required for FOREIGN counterparties' })
  @IsString()
  @Length(2, 2, {
    message: 'country must be a 2-character ISO 3166-1 alpha-2 code',
  })
  country?: string;

  @ApiPropertyOptional({
    example: 'C0042024',
    maxLength: 100,
    description: 'Tax identification number or TIN.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({
    example: 'NIC/2024/001',
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

  @ApiPropertyOptional({ type: [CreateCounterpartyContactDto], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyContactDto)
  contacts?: CreateCounterpartyContactDto[];

  @ApiPropertyOptional({ type: [CreateCounterpartyAddressDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyAddressDto)
  addresses?: CreateCounterpartyAddressDto[];
}
