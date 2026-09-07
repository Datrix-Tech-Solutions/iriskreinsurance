import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingReadinessService } from './accounting-readiness.service';
import { InternalReinsuranceAccountingReadinessController } from './internal-reinsurance-accounting-readiness.controller';
import { InternalSourceEventsController } from './internal-source-events.controller';
import { PostingRulesController } from './posting-rules.controller';
import { PostingRulesService } from './posting-rules.service';
import { SourceEventsController } from './source-events.controller';
import { SourceEventsService } from './source-events.service';

@Module({
  imports: [PrismaModule, AuthModule, LedgerModule],
  controllers: [
    InternalReinsuranceAccountingReadinessController,
    InternalSourceEventsController,
    PostingRulesController,
    SourceEventsController,
  ],
  providers: [
    AccountingReadinessService,
    PostingRulesService,
    SourceEventsService,
  ],
  exports: [
    AccountingReadinessService,
    PostingRulesService,
    SourceEventsService,
  ],
})
export class PostingModule {}
