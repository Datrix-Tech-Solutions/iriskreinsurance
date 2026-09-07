import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseReadinessService } from './database-readiness.service';

@Module({
  controllers: [HealthController],
  providers: [DatabaseReadinessService],
})
export class HealthModule {}
