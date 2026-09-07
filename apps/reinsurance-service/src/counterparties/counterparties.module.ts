import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { CounterpartiesController } from './counterparties.controller';
import { CounterpartiesService } from './counterparties.service';

@Module({
  imports: [RabbitMQModule],
  controllers: [CounterpartiesController],
  providers: [CounterpartiesService],
})
export class CounterpartiesModule {}
