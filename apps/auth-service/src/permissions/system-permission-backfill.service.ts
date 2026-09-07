import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { backfillSystemPermissionState } from './system-permission-sets';

@Injectable()
export class SystemPermissionBackfillService implements OnModuleInit {
  private readonly logger = new Logger(SystemPermissionBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log(
      'Ensuring legacy tenants and users have the required system permission sets...',
    );

    try {
      await backfillSystemPermissionState(this.prisma, this.logger);
      this.logger.log('System permission set backfill completed.');
    } catch (error) {
      this.logger.error(
        'System permission set backfill failed during auth-service startup.',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
