import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { Permission } from '@work-phelo/config';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

@ApiTags('Branches')
@Controller('branches')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_BRANCH)
  @ApiOperation({ summary: 'Create a new branch' })
  @ApiResponse({ status: 201, description: 'Branch created successfully' })
  @ApiResponse({ status: 409, description: 'Branch name already exists' })
  create(
    @Body() dto: CreateBranchDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.branchesService.create(req.user.tenantId, dto);
  }

  @Get()
  @RequirePermissions(Permission.READ_BRANCHES)
  @ApiOperation({ summary: 'List all branches for the current tenant' })
  @ApiResponse({ status: 200, description: 'Branches retrieved successfully' })
  findAll(@Req() req: Request & { user: RequestUser }) {
    return this.branchesService.findAll(req.user.tenantId);
  }

  @Get('options')
  @ApiOperation({
    summary:
      'List lightweight branch options for forms and selectors in the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Branch options retrieved successfully',
  })
  findOptions(@Req() req: Request & { user: RequestUser }) {
    const user = req.user;

    assertHrAccess(
      isCompanyAdminUser(user) ||
        hasPermissionRule(user, 'branches:VIEW') ||
        hasPermissionRule(user, 'employees:CREATE') ||
        hasPermissionRule(user, 'employees:EDIT'),
    );

    return this.branchesService.findOptions(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_BRANCHES)
  @ApiOperation({ summary: 'Get a branch by ID' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.branchesService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_BRANCH)
  @ApiOperation({ summary: 'Update a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.branchesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_BRANCH)
  @ApiOperation({ summary: 'Delete a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch deleted successfully' })
  @ApiResponse({ status: 409, description: 'Branch has employees assigned' })
  remove(@Param('id') id: string, @Req() req: Request & { user: RequestUser }) {
    return this.branchesService.remove(req.user.tenantId, id);
  }
}
