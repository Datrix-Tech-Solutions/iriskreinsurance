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

@Module({
  imports: [RabbitMQModule, AuditModule],
  controllers: [
    TenantsController,
    TenantDocumentProfileController,
    TenantDocumentProfileInternalController,
    TenantIntegrationInternalController,
  ],
  providers: [
    TenantLifecycleService,
    TenantConfigService,
    TenantAdminService,
    TenantBrandingService,
    TenantAssetStorageService,
    TenantDocumentProfileService,
  ],
  exports: [TenantLifecycleService],
})
export class TenantsModule {}
