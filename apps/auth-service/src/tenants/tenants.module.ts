import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantAdminService } from './tenant-admin.service';
import { TenantBrandingService } from './tenant-branding.service';
import { TenantAssetStorageService } from './tenant-asset-storage.service';
import { TenantDocumentProfileController } from './tenant-document-profile.controller';
import { TenantDocumentProfileInternalController } from './tenant-document-profile-internal.controller';
import { TenantIntegrationInternalController } from './tenant-integration-internal.controller';
import { TenantDocumentProfileService } from './tenant-document-profile.service';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';
import { HistoricalStatementsEntitlementController } from './historical-statements-entitlement.controller';
import { HistoricalStatementsEntitlementService } from './historical-statements-entitlement.service';
import { HistoricalStatementsJwtGuard } from './historical-statements-jwt.guard';
import { PermissionsModule } from '../permissions/permissions.module';
import { HistoricalStatementsJwtStrategy } from '../auth/strategies/historical-statements-jwt.strategy';

@Module({
  imports: [RabbitMQModule, AuditModule, PermissionsModule],
  controllers: [
    HistoricalStatementsEntitlementController,
    TenantsController,
    TenantDocumentProfileController,
    TenantDocumentProfileInternalController,
    TenantIntegrationInternalController,
  ],
  providers: [
    HistoricalStatementsEntitlementService,
    HistoricalStatementsJwtGuard,
    HistoricalStatementsJwtStrategy,
    TenantLifecycleService,
    TenantConfigService,
    TenantAdminService,
    TenantBrandingService,
    TenantAssetStorageService,
    TenantDocumentProfileService,
  ],
  exports: [TenantAssetStorageService, TenantLifecycleService],
})
export class TenantsModule {}
