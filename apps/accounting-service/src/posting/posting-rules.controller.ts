import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingPermission } from '../ledger/accounting.permissions';
import {
  CreatePostingRuleDto,
  CreatePostingRuleLineDto,
  QueryPostingRulesDto,
  UpdatePostingRuleDto,
  UpdatePostingRuleLineDto,
} from './dto/posting.dto';
import { PostingRulesService } from './posting-rules.service';

@Controller('posting-rules')
@ApiTags('Accounting - Posting Rules')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class PostingRulesController {
  constructor(private readonly service: PostingRulesService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant posting rule versions' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  list(
    @Query() query: QueryPostingRulesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a versioned posting rule' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  create(
    @Body() dto: CreatePostingRuleDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Get(':ruleId')
  @ApiOperation({ summary: 'Get a posting rule and its ordered lines' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  findOne(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user.tenantId, ruleId);
  }

  @Patch(':ruleId')
  @ApiOperation({
    summary: 'Update or activate an unused posting rule version',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  update(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdatePostingRuleDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, ruleId, dto);
  }

  @Delete(':ruleId')
  @ApiOperation({
    summary: 'Deactivate a posting rule while preserving its audit history',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  deactivate(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deactivate(request.user, ruleId);
  }

  @Post(':ruleId/lines')
  @ApiOperation({ summary: 'Add a line to an inactive unused posting rule' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createLine(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: CreatePostingRuleLineDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createLine(request.user, ruleId, dto);
  }

  @Patch(':ruleId/lines/:lineId')
  @ApiOperation({
    summary: 'Update a line on an inactive unused posting rule',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateLine(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdatePostingRuleLineDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateLine(request.user, ruleId, lineId, dto);
  }

  @Delete(':ruleId/lines/:lineId')
  @ApiOperation({
    summary: 'Delete a line from an inactive unused posting rule',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  deleteLine(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteLine(request.user, ruleId, lineId);
  }
}
