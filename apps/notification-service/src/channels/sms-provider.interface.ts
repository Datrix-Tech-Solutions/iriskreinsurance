export type SmsProviderName = 'termii' | 'pilosms';

export type SmsDeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export type SmsSendResult = {
  success: boolean;
  status: SmsDeliveryStatus;
  provider: SmsProviderName;
  providerStatus?: string;
  providerDetail?: string;
  error?: string;
};

export interface SmsProvider {
  readonly provider: SmsProviderName;
  sendMessage(to: string, message: string): Promise<SmsSendResult>;
}
