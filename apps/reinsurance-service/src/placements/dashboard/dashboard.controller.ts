import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
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
import { RequireFeature } from '../../auth/decorators/feature.decorator';
import { RequireModule } from '../../auth/decorators/module.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../../auth/guards/feature.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  ReinsuranceDashboardClaimsResponseDto,
  ReinsuranceDashboardFinancialsResponseDto,
  ReinsuranceDashboardOverviewResponseDto,
  ReinsuranceDashboardPlacementsResponseDto,
} from './dashboard-response.dto';
import { ReinsuranceDashboardService } from './dashboard.service';
import { QueryDashboardClaimsDto } from './query-dashboard-claims.dto';

@Controller('dashboard')
@ApiTags('Reinsurance - Dashboard')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid session/token.' })
@ApiForbiddenResponse({
  description:
    'Operations/Reinsurance entitlement or dashboard permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
@RequirePermissions('operations.reinsurance.dashboard:VIEW')
export class ReinsuranceDashboardController {
  constructor(private readonly dashboardService: ReinsuranceDashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get Reinsurance dashboard overview',
    description:
      'Returns tenant-scoped placement, lock, endorsement and claim counts for the Reinsurance dashboard.',
  })
  @ApiOkResponse({ type: ReinsuranceDashboardOverviewResponseDto })
  getOverview(@Req() request: Request & { user: RequestUser }) {
    return this.dashboardService.getOverview(request.user.tenantId);
  }

  @Get('placements')
  @ApiOperation({
    summary: 'Get Reinsurance placement capacity summary',
    description:
      'Uses confirmed placement and endorsement closing snapshots for accepted/confirmed capacity figures.',
  })
  @ApiOkResponse({ type: ReinsuranceDashboardPlacementsResponseDto })
  getPlacements(@Req() request: Request & { user: RequestUser }) {
    return this.dashboardService.getPlacements(request.user.tenantId);
  }

  @Get('financials')
  @ApiOperation({
    summary: 'Get Reinsurance financial dashboard summary',
    description:
      'Uses confirmed closing snapshots for premium/commission/brokerage and recorded payment rows for paid/outstanding amounts.',
  })
  @ApiOkResponse({ type: ReinsuranceDashboardFinancialsResponseDto })
  getFinancials(@Req() request: Request & { user: RequestUser }) {
    return this.dashboardService.getFinancials(request.user.tenantId);
  }

  @Get('claims')
  @ApiOperation({
    summary: 'Get Reinsurance claims dashboard summary',
    description:
      'Uses claim records, claim allocation snapshots and claim cash call snapshots for loss and liability figures.',
  })
  @ApiOkResponse({ type: ReinsuranceDashboardClaimsResponseDto })
  getClaims(
    @Query() query: QueryDashboardClaimsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.dashboardService.getClaims(request.user.tenantId, query);
  }
}
