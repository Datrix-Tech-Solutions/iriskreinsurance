import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseReadinessService } from './database-readiness.service';

@Controller('health')
@ApiTags('Accounting - Health')
export class HealthController {
  constructor(private readonly database: DatabaseReadinessService) {}

  @Get()
  @ApiOperation({ summary: 'Check Accounting database readiness' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'accounting-service',
        timestamp: '2026-07-03T12:00:00.000Z',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    schema: {
      example: {
        status: 'error',
        service: 'accounting-service',
        message: 'Accounting database is unavailable',
      },
    },
  })
  async check() {
    try {
      await this.database.check();
      return {
        status: 'ok',
        service: 'accounting-service',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'accounting-service',
        message: 'Accounting database is unavailable',
      });
    }
  }
}
