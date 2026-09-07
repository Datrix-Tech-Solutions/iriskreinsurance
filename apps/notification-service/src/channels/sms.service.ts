import { Injectable, Logger } from '@nestjs/common';
import { PiloSmsProvider } from './pilosms.provider';
import type {
  SmsProvider,
  SmsProviderName,
  SmsSendResult,
} from './sms-provider.interface';
import { TermiiSmsProvider } from './termii-sms.provider';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;

  constructor(
    termiiProvider: TermiiSmsProvider,
    piloSmsProvider: PiloSmsProvider,
  ) {
    const providerName = this.resolveProviderName();

    if (providerName === 'termii') {
      this.provider = termiiProvider;
    } else {
      this.provider = piloSmsProvider;
    }

    this.logger.log(`SMS provider selected: ${this.provider.provider}`);
  }

  async sendMessage(to: string, message: string): Promise<SmsSendResult> {
    return this.provider.sendMessage(to, message);
  }

  async sendOtp(
    to: string,
    otp: string,
    context: string,
  ): Promise<SmsSendResult> {
    return this.sendMessage(
      to,
      `Your WorkPhelo ${context} code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
    );
  }

  private resolveProviderName(): SmsProviderName {
    const provider = (process.env.SMS_PROVIDER ?? 'termii')
      .trim()
      .toLowerCase();

    if (provider === 'termii' || provider === 'pilosms') {
      return provider;
    }

    throw new Error(
      `Unsupported SMS_PROVIDER "${process.env.SMS_PROVIDER}". Expected "termii" or "pilosms".`,
    );
  }
}
