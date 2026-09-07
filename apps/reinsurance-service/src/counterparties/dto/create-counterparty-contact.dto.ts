import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from './string.transforms';

export class CreateCounterpartyContactDto {
  @ApiProperty({ example: 'Ama Mensah', minLength: 2, maxLength: 150 })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;

  @ApiPropertyOptional({ example: 'Treaty Manager', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'ama@example.com', maxLength: 200 })
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

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
