import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { HistoricalStatementsRepository } from './historical-statements.repository';
import { HistoricalStatementsService } from './historical-statements.service';
import { AuthModule } from '../auth/auth.module';
import { HistoricalStatementsAccessClient } from './historical-statements-access.client';
import { HistoricalStatementsAccessGuard } from './historical-statements-access.guard';
import { HistoricalStatementsController } from './historical-statements.controller';

@Module({
  imports: [AuthModule, ConfigModule, PrismaModule],
  controllers: [HistoricalStatementsController],
  providers: [
    HistoricalStatementsRepository,
    HistoricalStatementsService,
    HistoricalStatementsAccessClient,
    HistoricalStatementsAccessGuard,
  ],
})
export class HistoricalStatementsModule {}
