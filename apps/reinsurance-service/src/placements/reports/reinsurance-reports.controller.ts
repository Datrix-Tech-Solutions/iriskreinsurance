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
import { BrokerageReportResponseDto } from './dto/brokerage-report-response.dto';
import { CedantsReportResponseDto } from './dto/cedants-report-response.dto';
import { ClaimsReportResponseDto } from './dto/claims-report-response.dto';
import { FacultativeReportResponseDto } from './dto/facultative-report-response.dto';
import { PremiumsReportResponseDto } from './dto/premiums-report-response.dto';
import { PremiumsStatsResponseDto } from './dto/premiums-stats-response.dto';
import { QueryBrokerageReportDto } from './dto/query-brokerage-report.dto';
import { QueryCedantsReportDto } from './dto/query-cedants-report.dto';
import { QueryClaimsReportDto } from './dto/query-claims-report.dto';
import { QueryFacultativeReportDto } from './dto/query-facultative-report.dto';
import { QueryPremiumsReportDto } from './dto/query-premiums-report.dto';
import { QueryPremiumsStatsDto } from './dto/query-premiums-stats.dto';
import { QueryReinsurersReportDto } from './dto/query-reinsurers-report.dto';
import { ReinsurersReportResponseDto } from './dto/reinsurers-report-response.dto';
import { BrokerageReportService } from './brokerage-report.service';
import { CedantsReportService } from './cedants-report.service';
import { ClaimsReportService } from './claims-report.service';
import { FacultativeReportService } from './facultative-report.service';
import { PremiumsReportService } from './premiums-report.service';
import { ReinsurersReportService } from './reinsurers-report.service';

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
  constructor(
    private readonly premiumsReport: PremiumsReportService,
    private readonly cedantsReport: CedantsReportService,
    private readonly reinsurersReport: ReinsurersReportService,
    private readonly facultativeReport: FacultativeReportService,
    private readonly brokerageReport: BrokerageReportService,
    private readonly claimsReport: ClaimsReportService,
  ) {}

  @Get('premiums/stats')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Summarize Reinsurance premium statistics',
    description:
      'Returns tenant-wide Payments page premium summary cards and top paid cedants in one bounded request. ' +
      'Balances are grouped by currency and period activity uses paymentDate windows.',
  })
  @ApiOkResponse({ type: PremiumsStatsResponseDto })
  findPremiumStats(
    @Query() query: QueryPremiumsStatsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.premiumsReport.findPremiumStats(request.user.tenantId, query);
  }

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

  @Get('cedants')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance cedants report rows',
    description:
      'Returns server-paginated cedant rows with full-filtered currency totals. ' +
      'Confirmed closings define cedant obligations, BANK_CONFIRMED premium receipts reduce settled balances, and RECORDED receipts remain pending.',
  })
  @ApiOkResponse({ type: CedantsReportResponseDto })
  findCedants(
    @Query() query: QueryCedantsReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.cedantsReport.findCedants(request.user.tenantId, query);
  }

  @Get('cedants/export.csv')
  @RequirePermissions(PlacementPermission.VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="cedants-report.csv"')
  @ApiOperation({
    summary: 'Export Reinsurance cedants report CSV',
    description:
      'Exports the full filtered Cedants report result, not just the current browser page.',
  })
  exportCedantsCsv(
    @Query() query: QueryCedantsReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.cedantsReport.exportCedantsCsv(request.user.tenantId, query);
  }

  @Get('reinsurers')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance reinsurers report rows',
    description:
      'Returns server-paginated reinsurer rows with full-filtered currency totals. ' +
      'Effective confirmed closings define reinsurer obligations, BANK_CONFIRMED disbursements reduce settled balances, and RECORDED disbursements remain pending.',
  })
  @ApiOkResponse({ type: ReinsurersReportResponseDto })
  findReinsurers(
    @Query() query: QueryReinsurersReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.reinsurersReport.findReinsurers(request.user.tenantId, query);
  }

  @Get('reinsurers/export.csv')
  @RequirePermissions(PlacementPermission.VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="reinsurers-report.csv"')
  @ApiOperation({
    summary: 'Export Reinsurance reinsurers report CSV',
    description:
      'Exports the full filtered Reinsurers report result, not just the current browser page.',
  })
  exportReinsurersCsv(
    @Query() query: QueryReinsurersReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.reinsurersReport.exportReinsurersCsv(
      request.user.tenantId,
      query,
    );
  }

  @Get('facultative')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance facultative report rows',
    description:
      'Returns server-paginated Facultative report rows with full-filtered summaries. ' +
      'Effective confirmed closings define financial snapshots, BANK_CONFIRMED payments reduce settled balances, and RECORDED payments remain pending.',
  })
  @ApiOkResponse({ type: FacultativeReportResponseDto })
  findFacultative(
    @Query() query: QueryFacultativeReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.facultativeReport.findFacultative(request.user.tenantId, query);
  }

  @Get('facultative/export.csv')
  @RequirePermissions(PlacementPermission.VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="facultative-report.csv"',
  )
  @ApiOperation({
    summary: 'Export Reinsurance facultative report CSV',
    description:
      'Exports the full filtered Facultative report result, not just the current browser page.',
  })
  exportFacultativeCsv(
    @Query() query: QueryFacultativeReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.facultativeReport.exportFacultativeCsv(
      request.user.tenantId,
      query,
    );
  }

  @Get('brokerage')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance brokerage report rows',
    description:
      'Returns server-paginated Brokerage report rows with full-filtered currency totals. ' +
      'Effective confirmed closings and credit notes define brokerage and tax amounts; BANK_CONFIRMED premium receipts determine brokerage and tax amounts realized against cedant collections.',
  })
  @ApiOkResponse({ type: BrokerageReportResponseDto })
  findBrokerage(
    @Query() query: QueryBrokerageReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.brokerageReport.findBrokerage(request.user.tenantId, query);
  }

  @Get('brokerage/export.csv')
  @RequirePermissions(PlacementPermission.VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="brokerage-report.csv"')
  @ApiOperation({
    summary: 'Export Reinsurance brokerage report CSV',
    description:
      'Exports the full filtered Brokerage report result, not just the current browser page.',
  })
  exportBrokerageCsv(
    @Query() query: QueryBrokerageReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.brokerageReport.exportBrokerageCsv(
      request.user.tenantId,
      query,
    );
  }

  @Get('claims')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance claims report rows',
    description:
      'Returns server-paginated Claims report rows with full-filtered currency totals. ' +
      'Date filters use date of loss. Claim recovery is based on BANK_CONFIRMED recovery receipts net of reversals; RECORDED recoveries remain pending.',
  })
  @ApiOkResponse({ type: ClaimsReportResponseDto })
  findClaims(
    @Query() query: QueryClaimsReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsReport.findClaims(request.user.tenantId, query);
  }

  @Get('claims/export.csv')
  @RequirePermissions(PlacementPermission.VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="claims-report.csv"')
  @ApiOperation({
    summary: 'Export Reinsurance claims report CSV',
    description:
      'Exports the full filtered Claims report result, not just the current browser page.',
  })
  exportClaimsCsv(
    @Query() query: QueryClaimsReportDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsReport.exportClaimsCsv(request.user.tenantId, query);
  }
}
