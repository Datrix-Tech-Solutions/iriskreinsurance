import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [RabbitMQModule, CryptoModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
