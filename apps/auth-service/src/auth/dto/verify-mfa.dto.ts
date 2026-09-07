import { IsString } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  userId!: string;

  @IsString()
  totpCode!: string;
}
