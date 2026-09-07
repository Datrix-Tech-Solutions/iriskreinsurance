import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ description: 'Branch name', example: 'Accra Head Office' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    description: 'Short code for the branch',
    example: 'ACC-HQ',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '5 Liberation Road',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Accra' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Region or state',
    example: 'Greater Accra',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'Ghana' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+233302123456',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'accra@acmecorp.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Employee ID of the branch manager' })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Whether this is the head office',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isHeadOffice?: boolean;
}
