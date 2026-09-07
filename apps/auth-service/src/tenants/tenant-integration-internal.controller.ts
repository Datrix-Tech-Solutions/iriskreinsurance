import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalServiceAuthGuard } from '../auth/guards/internal-service-auth.guard';
import { TenantConfigService } from './tenant-config.service';

@ApiTags('Internal Tenant Integration')
@Controller('internal/tenants/:tenantId/integrations/reinsurance-accounting')
@UseGuards(InternalServiceAuthGuard)
export class TenantIntegrationInternalController {
  constructor(private readonly config: TenantConfigService) {}

  @Get()
  get(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.config.getReinsuranceAccountingIntegration(tenantId);
  }
}
