import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitMQPublisher } from './rabbitmq.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('RABBITMQ_URL')],
            queue: 'notification_queue',
            queueOptions: {
              durable: true,
              arguments: {
                'x-message-ttl': 3600000,
              },
            },
          },
        }),
      },
      {
        name: 'HR_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('RABBITMQ_URL')],
            queue: 'hr_queue',
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
  providers: [RabbitMQPublisher],
  exports: [RabbitMQPublisher],
})
export class RabbitMQModule {}
