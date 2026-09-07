import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '../auth/guards/internal-service-auth.guard';
import { InternalTenantDocumentProfileDto } from './dto/internal-tenant-document-profile.dto';
import { TenantDocumentProfileService } from './tenant-document-profile.service';

@ApiTags('Internal Tenant Document Profile')
@Controller('internal/tenants/:tenantId/document-profile')
@UseGuards(InternalServiceAuthGuard)
export class TenantDocumentProfileInternalController {
  constructor(private readonly profiles: TenantDocumentProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'Resolve tenant document profile for an internal service',
    description:
      'Service-authenticated contract for document generation. Returns tenant defaults when no profile exists, active default bank accounts, and short-lived signed asset URLs. Raw private object keys are never returned.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.service,
    required: true,
    description: 'Calling service name from the configured allow list.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp,
    required: true,
    description: 'Current Unix timestamp in seconds.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.signature,
    required: true,
    description:
      'Hex HMAC-SHA256 of service:timestamp:method:path using the shared internal service secret.',
  })
  @ApiOkResponse({ type: InternalTenantDocumentProfileDto })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  get(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.profiles.getInternalResolved(tenantId);
  }
}
