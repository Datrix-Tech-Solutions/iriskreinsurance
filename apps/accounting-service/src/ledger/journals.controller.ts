import {
  Body,
  Controller,
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
import { AccountingPermission } from './accounting.permissions';
import {
  CreateJournalDto,
  QueryJournalsDto,
  ReverseJournalDto,
  UpdateDraftJournalDto,
} from './dto/accounting.dto';
import { JournalsService } from './journals.service';

@Controller('journals')
@ApiTags('Accounting - Journals')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class JournalsController {
  constructor(private readonly service: JournalsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant journal entries' })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  list(
    @Query() query: QueryJournalsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a balanced draft journal entry' })
  @RequirePermissions(AccountingPermission.JOURNALS_CREATE)
  create(
    @Body() dto: CreateJournalDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Get(':journalId')
  @ApiOperation({ summary: 'Get a tenant journal entry and its lines' })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  findOne(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user.tenantId, journalId);
  }

  @Patch(':journalId')
  @ApiOperation({ summary: 'Update a draft journal entry' })
  @RequirePermissions(AccountingPermission.JOURNALS_EDIT)
  updateDraft(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: UpdateDraftJournalDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateDraft(request.user, journalId, dto);
  }

  @Post(':journalId/post')
  @ApiOperation({
    summary: 'Post a balanced draft journal into an open fiscal period',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_POST)
  post(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.post(request.user, journalId);
  }

  @Post(':journalId/reverse')
  @ApiOperation({
    summary: 'Create an exact linked reversal for a posted journal',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_POST)
  reverse(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: ReverseJournalDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverse(request.user, journalId, dto);
  }
}
