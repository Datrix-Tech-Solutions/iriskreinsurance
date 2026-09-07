import { BadRequestException, Injectable } from '@nestjs/common';
import { MailboxProvider } from '../../../prisma/generated/client';
import { EmailProvider } from './email-provider.interface';
import { MicrosoftGraphEmailProvider } from './microsoft-graph-email.provider';

@Injectable()
export class EmailProviderRegistry {
  constructor(private readonly microsoftGraph: MicrosoftGraphEmailProvider) {}

  get(provider: MailboxProvider): EmailProvider {
    if (provider === MailboxProvider.MICROSOFT_GRAPH) {
      return this.microsoftGraph;
    }

    throw new BadRequestException(
      `${provider} mailbox integration is not enabled yet`,
    );
  }
}
