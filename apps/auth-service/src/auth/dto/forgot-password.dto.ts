import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'The user email address',
    example: 'kofi@acmeghana.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description:
      'The tenant workspace slug — extracted from the route /t/:tenantSlug/reset-password by the frontend',
    example: 'acme-ghana',
  })
  @IsString()
  tenantSlug!: string;

  @ApiPropertyOptional({
    description: 'Delivery method for the reset token',
    enum: ['email', 'sms'],
    default: 'email',
  })
  @IsOptional()
  @IsIn(['email', 'sms'])
  method?: 'email' | 'sms';
}
