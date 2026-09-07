import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description:
      'Tenant workspace slug — extracted from the route /t/:tenantSlug/login by the frontend. Users never type this manually.',
    example: 'acme-ghana',
  })
  @IsString()
  tenantSlug!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'kofi@acmeghana.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'User password (min 8 characters)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description:
      'TOTP code — only required when MFA is enabled and method is TOTP',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  totpCode?: string;
}
