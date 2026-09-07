import { IsString, MinLength } from 'class-validator';

export class ForceResetPasswordDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
