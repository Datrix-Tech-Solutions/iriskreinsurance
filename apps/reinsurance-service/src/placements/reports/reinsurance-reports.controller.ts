import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
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
import { PlacementPermission } from '../placement.permissions';
import { PremiumsReportResponseDto } from './dto/premiums-report-response.dto';
import { QueryPremiumsReportDto } from './dto/query-premiums-report.dto';
import { PremiumsReportService } from './premiums-report.service';

@Controller('reports')
@ApiTags('Reinsurance - Reports')
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
export class ReinsuranceReportsController {
  constructor(private readonly premiumsReport: PremiumsReportService) {}

  @Get('premiums')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance premiums report rows',
    description:
      'Returns server-paginated Premiums report rows with full-filtered currency totals. ' +
      'Confirmed closings define obligations and only BANK_CONFIRMED payments reduce settled balances.',
  })
  @ApiOkResponse({ type: PremiumsReportResponseDto })
  findPremiums(
    @Query() query: QueryPremiumsReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.premiumsReport.findPremiums(request.user.tenantId, query);
  }

  @Get('premiums/export.csv')
  @RequirePermissions(PlacementPermission.VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="premiums-report.csv"')
  @ApiOperation({
    summary: 'Export Reinsurance premiums report CSV',
    description:
      'Exports the full filtered Premiums report result, not just the current browser page.',
  })
  exportPremiumsCsv(
    @Query() query: QueryPremiumsReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.premiumsReport.exportPremiumsCsv(request.user.tenantId, query);
  }
}
