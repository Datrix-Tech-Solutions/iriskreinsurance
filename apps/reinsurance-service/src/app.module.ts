import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { ReinsuranceAccountingIntegrationModule } from './accounting-integration/reinsurance-accounting-integration.module';
import { CounterpartiesModule } from './counterparties/counterparties.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { PlacementsModule } from './placements/placements.module';
import { PrismaModule } from './prisma/prisma.module';
import { BusinessClassSettingsModule } from './settings/business-class-settings.module';
import { CurrencySettingsModule } from './settings/currency-settings.module';
import { ReinsuranceChargeSettingsModule } from './settings/reinsurance-charge-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ReinsuranceAccountingIntegrationModule,
    HealthModule,
    AccessModule,
    CounterpartiesModule,
    PlacementsModule,
    BusinessClassSettingsModule,
    CurrencySettingsModule,
    ReinsuranceChargeSettingsModule,
    EmailModule,
  ],
})
export class AppModule {}
