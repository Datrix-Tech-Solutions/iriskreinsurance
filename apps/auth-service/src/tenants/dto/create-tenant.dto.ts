import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Acme Ghana Ltd',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Company billing/admin email address',
    example: 'admin@acmeghana.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description:
      'Workspace slug — unique identifier used in all workspace URLs (/t/:slug/login). Lowercase letters, numbers and hyphens only.',
    example: 'acme-ghana',
    minLength: 2,
    maxLength: 50,
    pattern: '^[a-z0-9-]+$',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers and hyphens',
  })
  slug!: string;

  @ApiProperty({
    description: 'Admin first name',
    example: 'Abena',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({
    description: 'Admin last name',
    example: 'Mensah',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @ApiPropertyOptional({
    description:
      'Admin password — if omitted, an invite email is sent and admin sets password on first login',
    example: 'Admin123!',
    minLength: 8,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;

  @ApiPropertyOptional({
    description: 'Company phone number',
    example: '+233302000001',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Company address',
    example: '12 Independence Avenue, Accra',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    description: 'Country code (ISO 3166-1 alpha-2). Defaults to GH.',
    example: 'GH',
    default: 'GH',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Primary tenant currency code. Defaults to GHS.',
    example: 'GHS',
    default: 'GHS',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Industry sector',
    example: 'Manufacturing',
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({
    description: 'Company size range',
    example: '100-500',
    enum: ['1-10', '10-50', '50-100', '100-500', '500+'],
  })
  @IsOptional()
  @IsString()
  size?: string;
}
