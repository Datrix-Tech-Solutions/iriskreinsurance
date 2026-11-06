import {
  applyDecorators,
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
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
import { HistoricalStatementsAccessGuard } from './historical-statements-access.guard';
import { HistoricalStatementsPermission as Permission } from './historical-statements.permissions';
import { HistoricalStatementsService } from './historical-statements.service';
import {
  ArchiveDatasetQueryDto,
  ArchiveExportQueryDto,
  ArchiveFacetsQueryDto,
  ArchiveLinkedListQueryDto,
  ArchiveListQueryDto,
  ArchivePageQueryDto,
  ArchiveRowParamsDto,
  StatementKind,
} from './dto/historical-statements-query.dto';
import {
  ArchiveDatasetsResponseDto,
  ArchiveErrorDto,
  ArchiveFacetsResponseDto,
  ArchiveInsurerDetailDto,
  ArchiveInsurerLinkDto,
  ArchiveInsurerListDto,
  ArchiveReinsurerDetailDto,
  ArchiveReinsurerLinksDto,
  ArchiveReinsurerListDto,
} from './dto/historical-statements-response.dto';

// No caller-supplied tenant or user selectors, including the access probe.
export class HistoricalStatementsAccessQuery {}
type ArchiveRequest = Request & { user: RequestUser };
const privateResponse = () =>
  applyDecorators(
    Header('Cache-Control', 'private,no-store'),
    Header('Vary', 'Cookie,Authorization'),
  );
@Controller('historical-statements')
@ApiTags('Reinsurance - Historical Statements')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@ApiBadRequestResponse({
  type: ArchiveErrorDto,
  description: 'Invalid/unknown query parameter, date range or sort field.',
})
@ApiUnauthorizedResponse({
  type: ArchiveErrorDto,
  description: 'Invalid authentication or missing/mismatched tenant identity.',
})
@ApiForbiddenResponse({
  type: ArchiveErrorDto,
  description: 'Archive disabled or current VIEW/EXPORT permission denied.',
})
@ApiNotFoundResponse({
  type: ArchiveErrorDto,
  description:
    'Published dataset or statement not found in the authenticated tenant.',
})
@ApiConflictResponse({
  type: ArchiveErrorDto,
  description:
    'Invalid archive cell contract or incompatible physical export headers.',
})
@ApiInternalServerErrorResponse({
  type: ArchiveErrorDto,
  description:
    'Unexpected database/export failure or archive link integrity error.',
})
@ApiServiceUnavailableResponse({
  type: ArchiveErrorDto,
  description: 'Fresh Auth access decision unavailable; access fails closed.',
})
@UseGuards(
  JwtAuthGuard,
  ModuleGuard,
  FeatureGuard,
  HistoricalStatementsAccessGuard,
)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
@RequirePermissions(Permission.VIEW)
export class HistoricalStatementsController {
  constructor(private readonly archive: HistoricalStatementsService) {}
  @Get('access')
  @privateResponse()
  @ApiOperation({ summary: 'Check fresh historical archive VIEW access' })
  access(@Query() _query: HistoricalStatementsAccessQuery) {
    void _query;
    return { authorized: true };
  }
  @Get('datasets')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveDatasetsResponseDto })
  @ApiOperation({
    summary: 'List only published datasets for the authenticated tenant',
  })
  datasets(@Req() req: ArchiveRequest, @Query() q: ArchivePageQueryDto) {
    return this.archive.datasets(req.user.tenantId, q);
  }
  @Get('insurers')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveInsurerListDto })
  @ApiOperation({
    summary: 'Search insurer statements',
    description:
      'Published-dataset snapshot; full filtered total, source dates, exact decimal strings. Insurer means cedant; reinsurer filtering traverses approved links only.',
  })
  insurers(@Req() req: ArchiveRequest, @Query() q: ArchiveListQueryDto) {
    return this.archive.list(req.user.tenantId, StatementKind.INSURER, q);
  }
  @Get('reinsurers')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveReinsurerListDto })
  @ApiOperation({
    summary: 'Search reinsurer statements',
    description:
      'Published-dataset snapshot; insurer filter searches the source Reinsured column. No relationship is inferred from names.',
  })
  reinsurers(@Req() req: ArchiveRequest, @Query() q: ArchiveListQueryDto) {
    return this.archive.list(req.user.tenantId, StatementKind.REINSURER, q);
  }
  // Static exports precede opaque :id routes.
  @Get('insurers/export.xlsx')
  @privateResponse()
  @RequirePermissions(Permission.VIEW, Permission.EXPORT)
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiOperation({
    summary: 'Export all filtered insurer statements as genuine XLSX',
    description:
      'Original 29 headers/order; original resolved cell values are explicit Excel text, including dates and money. No pagination parameters.',
  })
  exportInsurers(
    @Req() req: ArchiveRequest,
    @Query() q: ArchiveExportQueryDto,
  ) {
    return this.archive.export(req.user.tenantId, StatementKind.INSURER, q);
  }
  @Get('reinsurers/export.xlsx')
  @privateResponse()
  @RequirePermissions(Permission.VIEW, Permission.EXPORT)
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiOperation({
    summary: 'Export all filtered reinsurer statements as genuine XLSX',
    description:
      'Both physical Paid WHT columns retained independently. Financial precision is preserved through text cells; no source formulas are executed.',
  })
  exportReinsurers(
    @Req() req: ArchiveRequest,
    @Query() q: ArchiveExportQueryDto,
  ) {
    return this.archive.export(req.user.tenantId, StatementKind.REINSURER, q);
  }
  @Get('facets')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveFacetsResponseDto })
  @ApiOperation({
    summary: 'Return distinct values across the full filtered source kind',
    description:
      'kind defaults INSURER. All supplied filters also constrain facets; reinsurer names on insurer rows come only from approved links.',
  })
  facets(@Req() req: ArchiveRequest, @Query() q: ArchiveFacetsQueryDto) {
    return this.archive.facets(req.user.tenantId, q);
  }
  @Get('insurers/:id/reinsurers')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveReinsurerLinksDto })
  @ApiOperation({
    summary:
      'List only approved reinsurer associations; explicit UNLINKED when none',
  })
  linkedReinsurers(
    @Req() req: ArchiveRequest,
    @Param() p: ArchiveRowParamsDto,
    @Query() q: ArchiveLinkedListQueryDto,
  ) {
    return this.archive.linkedReinsurers(req.user.tenantId, p.id, q, q);
  }
  @Get('reinsurers/:id/insurer')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveInsurerLinkDto })
  @ApiOperation({
    summary: 'Read the approved insurer association or explicit UNLINKED/null',
  })
  linkedInsurer(
    @Req() req: ArchiveRequest,
    @Param() p: ArchiveRowParamsDto,
    @Query() q: ArchiveDatasetQueryDto,
  ) {
    return this.archive.linkedInsurer(req.user.tenantId, p.id, q);
  }
  @Get('insurers/:id')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveInsurerDetailDto })
  @ApiOperation({
    summary:
      'Read insurer statement, all 29 source fields and physical-cell lineage',
  })
  insurer(
    @Req() req: ArchiveRequest,
    @Param() p: ArchiveRowParamsDto,
    @Query() q: ArchiveDatasetQueryDto,
  ) {
    return this.archive.detail(
      req.user.tenantId,
      StatementKind.INSURER,
      p.id,
      q,
    );
  }
  @Get('reinsurers/:id')
  @privateResponse()
  @ApiOkResponse({ type: ArchiveReinsurerDetailDto })
  @ApiOperation({
    summary:
      'Read reinsurer statement, both Paid WHT fields and original cells',
  })
  reinsurer(
    @Req() req: ArchiveRequest,
    @Param() p: ArchiveRowParamsDto,
    @Query() q: ArchiveDatasetQueryDto,
  ) {
    return this.archive.detail(
      req.user.tenantId,
      StatementKind.REINSURER,
      p.id,
      q,
    );
  }
}
