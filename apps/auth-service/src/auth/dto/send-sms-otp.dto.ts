import { IsString } from 'class-validator';

export class SendSmsOtpDto {
  @IsString()
  userId!: string;
}
