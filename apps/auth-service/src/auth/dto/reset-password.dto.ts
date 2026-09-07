import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description:
      'Tenant workspace slug — extracted from the route /t/:tenantSlug/reset-password by the frontend',
    example: 'acme-ghana',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @ApiProperty({
    description: 'User email address',
    example: 'kofi@acmeghana.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Reset token from the reset-password link (?token=...)',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description: 'OTP code when reset was requested via SMS',
    example: '654321',
  })
  @IsOptional()
  @IsString()
  otpCode?: string;

  @ApiProperty({
    description: 'New password (min 8 characters)',
    example: 'NewPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
