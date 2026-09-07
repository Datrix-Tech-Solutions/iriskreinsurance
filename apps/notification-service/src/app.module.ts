import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationModule } from './notification/notification.module';
import { RabbitMQSetupService } from './messaging/rabbitmq-setup.service';
import { HealthModule } from './health/health.module';
import { InAppNotificationsModule } from './in-app-notifications/in-app-notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificationModule,
    InAppNotificationsModule,
    HealthModule,
  ],
  providers: [RabbitMQSetupService],
})
export class AppModule {}
