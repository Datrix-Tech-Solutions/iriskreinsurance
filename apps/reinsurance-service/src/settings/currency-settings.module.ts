import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurrencySettingsController } from './currency-settings.controller';
import { CurrencySettingsService } from './currency-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurrencySettingsController],
  providers: [CurrencySettingsService],
  exports: [CurrencySettingsService],
})
export class CurrencySettingsModule {}
