import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { PlacementsModule } from '../placements/placements.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailMailboxesController } from './email-mailboxes.controller';
import { EmailMailboxService } from './email-mailbox.service';
import { EmailThreadsController } from './email-threads.controller';
import { EmailThreadsService } from './email-threads.service';
import { EmailTokenEncryptionService } from './email-token-encryption.service';
import { PlacementEmailThreadsController } from './placement-email-threads.controller';
import { EmailProviderRegistry } from './providers/email-provider.registry';
import { MicrosoftGraphEmailProvider } from './providers/microsoft-graph-email.provider';

@Module({
  imports: [PrismaModule, RabbitMQModule, PlacementsModule],
  controllers: [
    EmailMailboxesController,
    EmailThreadsController,
    PlacementEmailThreadsController,
  ],
  providers: [
    EmailMailboxService,
    EmailProviderRegistry,
    EmailThreadsService,
    EmailTokenEncryptionService,
    MicrosoftGraphEmailProvider,
  ],
})
export class EmailModule {}
