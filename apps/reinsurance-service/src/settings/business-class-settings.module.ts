import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RiskClassSettingsController } from './risk-class-settings.controller';
import { RiskClassSettingsService } from './risk-class-settings.service';
import { RiskTypeSettingsController } from './risk-type-settings.controller';
import { RiskTypeSettingsService } from './risk-type-settings.service';

/**
 * Registers explicit RiskClass and RiskType settings routes.
 * Deprecated BusinessClass compatibility routing has been removed now that
 * frontend integrations use the RiskClass/RiskType contracts.
 */
@Module({
  imports: [PrismaModule],
  controllers: [RiskClassSettingsController, RiskTypeSettingsController],
  providers: [RiskClassSettingsService, RiskTypeSettingsService],
  exports: [RiskClassSettingsService, RiskTypeSettingsService],
})
export class BusinessClassSettingsModule {}
