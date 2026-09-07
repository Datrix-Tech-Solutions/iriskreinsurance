import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { LedgerModule } from './ledger/ledger.module';
import { PostingModule } from './posting/posting.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    LedgerModule,
    PostingModule,
  ],
})
export class AppModule {}
