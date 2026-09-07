import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@work-phelo/config';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';

@ApiTags('Assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  private assertAssetReadAccess(user: RequestUser) {
    assertHrAccess(
      isCompanyAdminUser(user) ||
        hasPermissionRule(user, 'assets:VIEW') ||
        hasPermissionRule(user, 'assets:CREATE') ||
        hasPermissionRule(user, 'assets:EDIT') ||
        hasPermissionRule(user, 'assets:ASSIGN'),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List tenant assets' })
  @ApiResponse({ status: 200, description: 'Assets retrieved successfully' })
  findAll(@Req() req: Request & { user: RequestUser }) {
    this.assertAssetReadAccess(req.user);
    return this.assetsService.findAll(req.user.tenantId);
  }

  @Get('available')
  @ApiOperation({ summary: 'List assets that can be assigned' })
  @ApiResponse({
    status: 200,
    description: 'Available assets retrieved successfully',
  })
  findAvailable(@Req() req: Request & { user: RequestUser }) {
    this.assertAssetReadAccess(req.user);
    return this.assetsService.findAvailable(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single asset by ID' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Asset retrieved successfully' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    this.assertAssetReadAccess(req.user);
    return this.assetsService.findById(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_ASSETS)
  @ApiOperation({ summary: 'Register a new asset' })
  @ApiBody({ type: CreateAssetDto })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  create(
    @Body() dto: CreateAssetDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.assetsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_ASSETS)
  @ApiOperation({ summary: 'Update an asset' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiBody({ type: UpdateAssetDto })
  @ApiResponse({ status: 200, description: 'Asset updated successfully' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.assetsService.update(req.user.tenantId, id, dto);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.ASSIGN_ASSET)
  @ApiOperation({ summary: 'Assign or transfer an asset to an employee' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiBody({ type: AssignAssetDto })
  @ApiResponse({ status: 200, description: 'Asset assigned successfully' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.assetsService.assign(req.user.tenantId, id, dto.employeeId);
  }

  @Post(':id/unassign')
  @RequirePermissions(Permission.ASSIGN_ASSET)
  @ApiOperation({ summary: 'Unassign an asset from its current employee' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Asset unassigned successfully' })
  unassign(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.assetsService.unassign(req.user.tenantId, id);
  }

  @Post(':id/retire')
  @RequirePermissions(Permission.MANAGE_ASSETS)
  @ApiOperation({ summary: 'Retire an asset from active use' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Asset retired successfully' })
  retire(@Param('id') id: string, @Req() req: Request & { user: RequestUser }) {
    return this.assetsService.retire(req.user.tenantId, id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_ASSETS)
  @ApiOperation({ summary: 'Delete an unassigned asset' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Asset deleted successfully' })
  remove(@Param('id') id: string, @Req() req: Request & { user: RequestUser }) {
    return this.assetsService.remove(req.user.tenantId, id);
  }
}
