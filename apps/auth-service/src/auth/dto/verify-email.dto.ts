import { IsString, IsEmail } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  tenantSlug!: string;

  @IsString()
  otp!: string;
}
