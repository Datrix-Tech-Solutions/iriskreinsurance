import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationHandler } from './notification.handler';
import { EmailService } from '../channels/email.service';
import { PiloSmsProvider } from '../channels/pilosms.provider';
import { SmsService } from '../channels/sms.service';
import { TermiiSmsProvider } from '../channels/termii-sms.provider';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Module({
  imports: [InAppNotificationsModule],
  controllers: [NotificationHandler],
  providers: [
    NotificationService,
    EmailService,
    SmsService,
    TermiiSmsProvider,
    PiloSmsProvider,
  ],
})
export class NotificationModule {}
