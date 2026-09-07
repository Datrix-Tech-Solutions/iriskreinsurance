import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceChargeSettingsController } from './reinsurance-charge-settings.controller';
import { ReinsuranceChargeSettingsService } from './reinsurance-charge-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReinsuranceChargeSettingsController],
  providers: [ReinsuranceChargeSettingsService],
  exports: [ReinsuranceChargeSettingsService],
})
export class ReinsuranceChargeSettingsModule {}
