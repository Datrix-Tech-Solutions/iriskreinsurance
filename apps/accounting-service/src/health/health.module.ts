import { Module } from '@nestjs/common';
import { DatabaseReadinessService } from './database-readiness.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [DatabaseReadinessService],
})
export class HealthModule {}
