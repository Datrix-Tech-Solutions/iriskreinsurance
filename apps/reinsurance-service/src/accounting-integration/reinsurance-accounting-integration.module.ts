import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { ReinsuranceAccountingOperationAuditInterceptor } from './audit/operation-audit.interceptor';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceAccountingClient } from './client/accounting.client';
import { ReinsuranceAccountingIntegrationConfigClient } from './client/integration-config.client';
import { ReinsuranceAccountingIntegrationActiveGuard } from './guards/integration-active.guard';
import { ReinsuranceAccountingEventBuilder } from './events/accounting-event.builder';
import { ReinsuranceAccountingIntegrationController } from './reinsurance-accounting-integration.controller';
import { ReinsuranceAccountingOutboxDispatcher } from './outbox/outbox-dispatcher.service';
import { ReinsuranceAccountingOutboxService } from './outbox/outbox.service';
import { ReinsuranceAccountingReadinessService } from './readiness/readiness.service';
import { ReinsuranceFinancialEventPublisher } from './events/financial-event.publisher';

@Module({
  imports: [PrismaModule, AuthModule, RabbitMQModule],
  controllers: [ReinsuranceAccountingIntegrationController],
  providers: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingIntegrationConfigClient,
    ReinsuranceAccountingIntegrationActiveGuard,
    ReinsuranceAccountingOperationAuditInterceptor,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxDispatcher,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
    ReinsuranceFinancialEventPublisher,
  ],
  exports: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingIntegrationConfigClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxDispatcher,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
    ReinsuranceFinancialEventPublisher,
  ],
})
export class ReinsuranceAccountingIntegrationModule {}
