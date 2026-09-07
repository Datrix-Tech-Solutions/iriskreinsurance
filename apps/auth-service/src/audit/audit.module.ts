import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditEventsHandler } from './audit-events.handler';

@Global()
@Module({
  controllers: [AuditController, AuditEventsHandler],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
