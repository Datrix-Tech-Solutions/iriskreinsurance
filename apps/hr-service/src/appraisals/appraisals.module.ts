import { Module, forwardRef } from '@nestjs/common';
import { AppraisalsService } from './appraisals.service';
import { AppraisalsController } from './appraisals.controller';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppraisalsCronService } from './appraisals.cron';

@Module({
  imports: [forwardRef(() => RabbitMQModule), NotificationsModule],
  controllers: [AppraisalsController],
  providers: [AppraisalsService, AppraisalsCronService],
  exports: [AppraisalsService],
})
export class AppraisalsModule {}
