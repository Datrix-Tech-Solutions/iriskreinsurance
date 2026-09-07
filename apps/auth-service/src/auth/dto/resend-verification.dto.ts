import { IsEmail, IsString } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email!: string;

  @IsString()
  tenantSlug!: string;
}
