import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingSettingsController } from './accounting-settings.controller';
import { AccountsController } from './accounts.controller';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';
import { BankReconciliationsController } from './bank-reconciliations.controller';
import { BankReconciliationsService } from './bank-reconciliations.service';
import { InternalSubledgersController } from './internal-subledgers.controller';
import { JournalPolicy } from './journal.policy';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { PayablesController } from './payables.controller';
import { PayablesService } from './payables.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AccountingSettingsController,
    AccountsController,
    CashbookController,
    BankReconciliationsController,
    InternalSubledgersController,
    JournalsController,
    PayablesController,
    ReceivablesController,
    ReportsController,
  ],
  providers: [
    AccountingMasterDataService,
    CashbookService,
    BankReconciliationsService,
    JournalPolicy,
    JournalsService,
    PayablesService,
    ReceivablesService,
    ReportsService,
  ],
  exports: [
    AccountingMasterDataService,
    CashbookService,
    JournalsService,
    PayablesService,
    ReceivablesService,
    ReportsService,
  ],
})
export class LedgerModule {}
