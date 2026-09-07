import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  gatewayOptionalServices,
  gatewayRequiredServices,
  gatewayServiceConfig,
  getConfiguredGatewayServices,
} from '../config/runtime-env';

@ApiTags('Gateway')
@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const configuredServices = getConfiguredGatewayServices();
    const statuses = await Promise.all(
      Object.entries(configuredServices).map(
        async ([serviceName, serviceUrl]) => {
          const healthUrl = new URL(
            gatewayServiceConfig[
              serviceName as keyof typeof gatewayServiceConfig
            ].healthPath,
            serviceUrl,
          ).toString();

          try {
            const response = await fetch(healthUrl, {
              signal: AbortSignal.timeout(3000),
            });

            return {
              service: serviceName,
              url: serviceUrl,
              required: gatewayRequiredServices.includes(
                serviceName as (typeof gatewayRequiredServices)[number],
              ),
              status: response.ok ? 'ok' : 'error',
              statusCode: response.status,
            };
          } catch (error) {
            return {
              service: serviceName,
              url: serviceUrl,
              required: gatewayRequiredServices.includes(
                serviceName as (typeof gatewayRequiredServices)[number],
              ),
              status: 'error',
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown health check failure',
            };
          }
        },
      ),
    );

    const unavailableRequiredServices = statuses.filter(
      (status) => status.required && status.status !== 'ok',
    );

    if (unavailableRequiredServices.length > 0) {
      throw new ServiceUnavailableException({
        status: 'error',
        message: 'Gateway dependencies are not healthy',
        services: statuses,
        optionalServices: gatewayOptionalServices,
      });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: statuses,
      optionalServices: gatewayOptionalServices,
    };
  }
}
