import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class TermiiSmsProvider implements SmsProvider {
  readonly provider = 'termii' as const;
  private readonly logger = new Logger(TermiiSmsProvider.name);
  private readonly apiKey = process.env.TERMII_API_KEY;
  private readonly senderId = process.env.TERMII_SENDER_ID || 'WorkPhelo';
  private readonly baseUrl = 'https://api.ng.termii.com/api';

  async sendMessage(to: string, message: string): Promise<SmsSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        status: 'FAILED',
        provider: this.provider,
        error: 'TERMII_API_KEY is required',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          from: this.senderId,
          sms: message,
          type: 'plain',
          api_key: this.apiKey,
          channel: 'generic',
        }),
      });

      const data = await this.safeJson(response);
      const providerStatus =
        data && typeof data === 'object' && 'code' in data
          ? String(data.code)
          : undefined;
      const providerDetail =
        data && typeof data === 'object' && 'message' in data
          ? String(data.message)
          : undefined;

      if (!response.ok || providerStatus !== 'ok') {
        this.logger.error(
          `Termii SMS failed for ${to}: ${JSON.stringify(data)}`,
        );
        return {
          success: false,
          status: 'FAILED',
          provider: this.provider,
          providerStatus,
          providerDetail,
          error: providerDetail ?? 'Termii SMS failed',
        };
      }

      return {
        success: true,
        status: 'SENT',
        provider: this.provider,
        providerStatus,
        providerDetail,
      };
    } catch (error) {
      this.logger.error(`Failed to send Termii SMS to ${to}`, error);
      return {
        success: false,
        status: 'FAILED',
        provider: this.provider,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async safeJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}
