import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CounterpartyEventPublisher } from './counterparty-event.publisher';
import { EmailEventPublisher } from './email-event.publisher';
import { PlacementEventPublisher } from './placement-event.publisher';
import { ReinsuranceAccountingOperationAuditPublisher } from '../accounting-integration/audit/operation-audit.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('RABBITMQ_URL')],
            queue: 'auth_queue',
            queueOptions: {
              durable: true,
              arguments: {
                'x-message-ttl': 3600000,
              },
            },
          },
        }),
      },
    ]),
  ],
  providers: [
    CounterpartyEventPublisher,
    EmailEventPublisher,
    PlacementEventPublisher,
    ReinsuranceAccountingOperationAuditPublisher,
  ],
  exports: [
    CounterpartyEventPublisher,
    EmailEventPublisher,
    PlacementEventPublisher,
    ReinsuranceAccountingOperationAuditPublisher,
  ],
})
export class RabbitMQModule {}
