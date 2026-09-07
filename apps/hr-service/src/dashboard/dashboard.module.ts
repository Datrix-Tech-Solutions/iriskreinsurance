import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AnnouncementsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
