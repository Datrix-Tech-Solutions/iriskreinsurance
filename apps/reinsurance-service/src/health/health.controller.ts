import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseReadinessService } from './database-readiness.service';

@Controller('health')
@ApiTags('Reinsurance - Health')
export class HealthController {
  constructor(private readonly database: DatabaseReadinessService) {}

  @Get()
  @ApiOperation({ summary: 'Check Reinsurance database readiness' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'reinsurance-service',
        timestamp: '2026-05-27T17:51:03.000Z',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    schema: {
      example: {
        status: 'error',
        service: 'reinsurance-service',
        message: 'Reinsurance database is unavailable',
      },
    },
  })
  async check() {
    try {
      await this.database.check();

      return {
        status: 'ok',
        service: 'reinsurance-service',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'reinsurance-service',
        message: 'Reinsurance database is unavailable',
      });
    }
  }
}
