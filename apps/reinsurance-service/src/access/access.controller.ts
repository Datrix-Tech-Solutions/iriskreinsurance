import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('access')
@ApiTags('Reinsurance - Access')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
@RequirePermissions('operations.reinsurance.dashboard:VIEW')
export class AccessController {
  @Get('verify')
  @ApiOperation({ summary: 'Verify authenticated Reinsurance access' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'reinsurance-service',
        tenantId: 'bda1cb0d-ebf9-4683-b993-b6d350c8c6b2',
        authorized: true,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/token.' })
  @ApiForbiddenResponse({
    description:
      'Operations/Reinsurance entitlement or dashboard permission is unavailable.',
  })
  verify(@Req() request: Request & { user: RequestUser }) {
    return {
      status: 'ok',
      service: 'reinsurance-service',
      tenantId: request.user.tenantId,
      authorized: true,
    };
  }
}
