import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString, UppercaseTrimmedString } from './string.transforms';

export class CreateCounterpartyAddressDto {
  @ApiPropertyOptional({ example: 'Head Office', maxLength: 50 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiProperty({
    example: '1 Independence Avenue',
    minLength: 2,
    maxLength: 200,
  })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional({ example: 'Ridge', maxLength: 200 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty({ example: 'Accra', minLength: 2, maxLength: 100 })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional({ example: 'Greater Accra', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'GA-123-4567', maxLength: 30 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  postalCode?: string;

  @ApiProperty({ example: 'GH', minLength: 2, maxLength: 2 })
  @UppercaseTrimmedString()
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
