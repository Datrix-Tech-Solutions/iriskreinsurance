import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeaveModule } from '../leave/leave.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CryptoModule } from '../crypto/crypto.module';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeSyncRecoveryCronService } from './employee-sync-recovery.cron';
import {
  RESIGNATION_QUEUE,
  ResignationNotificationProcessor,
} from './resignation-notification.processor';

@Module({
  imports: [
    LeaveModule,
    RabbitMQModule,
    NotificationsModule,
    CryptoModule,
    BullModule.registerQueue({ name: RESIGNATION_QUEUE }),
  ],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    EmployeeSyncRecoveryCronService,
    ResignationNotificationProcessor,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}
