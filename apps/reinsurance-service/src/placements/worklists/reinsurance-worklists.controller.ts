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
  ClaimsSummaryResponseDto,
  ClaimsWorklistResponseDto,
} from '../dto/claims-worklist-response.dto';
import { ClaimRowStateResponseDto } from '../dto/claim-row-state-response.dto';
import { PaymentWorklistResponseDto } from '../dto/payment-worklist-response.dto';
import { FacultativeRowStateResponseDto } from '../dto/facultative-row-state-response.dto';
import { QueryClaimRowStateDto } from '../dto/query-claim-row-state.dto';
import { QueryClaimsSummaryDto } from '../dto/query-claims-summary.dto';
import { QueryClaimsWorklistDto } from '../dto/query-claims-worklist.dto';
import { QueryFacultativeRowStateDto } from '../dto/query-facultative-row-state.dto';
import { QueryPaymentWorklistDto } from '../dto/query-payment-worklist.dto';
import { PlacementPermission } from '../placement.permissions';
import { ReinsuranceClaimRowStateService } from './claim-row-state.service';
import { ReinsuranceClaimsWorklistService } from './claims-worklist.service';
import { ReinsuranceFacultativeRowStateService } from './facultative-row-state.service';
import { ReinsurancePaymentsWorklistService } from './payments-worklist.service';

@Controller('worklists')
@ApiTags('Reinsurance - Worklists')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid session/token.' })
@ApiForbiddenResponse({
  description:
    'Operations/Reinsurance entitlement or placement view permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class ReinsuranceWorklistsController {
  constructor(
    private readonly paymentsWorklist: ReinsurancePaymentsWorklistService,
    private readonly facultativeRowState: ReinsuranceFacultativeRowStateService,
    private readonly claimRowState: ReinsuranceClaimRowStateService,
    private readonly claimsWorklist: ReinsuranceClaimsWorklistService,
  ) {}

  @Get('payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance payment worklist rows',
    description:
      'Returns row-ready premium payment placement data in one bounded tenant-scoped request. ' +
      'The list replaces frontend placement preload plus per-placement financial-position/payment fan-out.',
  })
  @ApiOkResponse({ type: PaymentWorklistResponseDto })
  findPayments(
    @Query() query: QueryPaymentWorklistDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsWorklist.findPayments(request.user.tenantId, query);
  }

  @Get('facultative-row-state')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get Facultative placement row state',
    description:
      'Returns bounded tenant-scoped row state for visible Facultative placement rows. ' +
      'This avoids frontend per-placement payments, financial-position and endorsement fan-out.',
  })
  @ApiOkResponse({ type: FacultativeRowStateResponseDto })
  findFacultativeRowState(
    @Query() query: QueryFacultativeRowStateDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.facultativeRowState.findRowState(request.user.tenantId, query);
  }

  @Get('claim-row-state')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get Claims row state',
    description:
      'Returns bounded tenant-scoped row state for discovered Claims list rows. ' +
      'This avoids frontend per-claim recovery-position, allocations and endorsement fan-out.',
  })
  @ApiOkResponse({ type: ClaimRowStateResponseDto })
  findClaimRowState(
    @Query() query: QueryClaimRowStateDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimRowState.findRowState(request.user.tenantId, query);
  }

  @Get('claims')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance Claims worklist rows',
    description:
      'Returns true server-paginated Claims table rows with backend-derived Notification/Open/Closed bucket state. ' +
      'This replaces frontend placement preload, per-placement claims discovery and client-side pagination.',
  })
  @ApiOkResponse({ type: ClaimsWorklistResponseDto })
  findClaims(
    @Query() query: QueryClaimsWorklistDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsWorklist.findClaims(request.user.tenantId, query);
  }

  @Get('claims-summary')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Summarize Reinsurance Claims worklist state',
    description:
      'Returns global Claims KPI counts and currency totals using the same backend bucket classification as the Claims worklist. Optional since/until window every figure by claim entry date (createdAt).',
  })
  @ApiOkResponse({ type: ClaimsSummaryResponseDto })
  summarizeClaims(
    @Query() query: QueryClaimsSummaryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsWorklist.summarizeClaims(request.user.tenantId, query);
  }
}
