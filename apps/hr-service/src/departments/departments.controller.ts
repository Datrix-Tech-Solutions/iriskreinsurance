import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

@ApiTags('Departments')
@Controller('departments')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_DEPARTMENT)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiBody({
    schema: {
      example: {
        name: 'Human Resources',
        description: 'HR and people management',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  @ApiResponse({ status: 409, description: 'Department name already exists' })
  create(
    @Body() dto: CreateDepartmentDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.departmentsService.create(req.user.tenantId, dto);
  }

  @Get()
  @RequirePermissions(Permission.READ_DEPARTMENTS)
  @ApiOperation({ summary: 'List all departments for the current tenant' })
  @ApiResponse({
    status: 200,
    description: 'Departments retrieved successfully',
  })
  findAll(@Req() req: Request & { user: RequestUser }) {
    return this.departmentsService.findAll(req.user.tenantId);
  }

  @Get('options')
  @ApiOperation({
    summary:
      'List lightweight department options for forms and selectors in the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Department options retrieved successfully',
  })
  findOptions(@Req() req: Request & { user: RequestUser }) {
    const user = req.user;

    assertHrAccess(
      isCompanyAdminUser(user) ||
        hasPermissionRule(user, 'departments:VIEW') ||
        hasPermissionRule(user, 'employees:VIEW') ||
        hasPermissionRule(user, 'employees:CREATE') ||
        hasPermissionRule(user, 'employees:EDIT'),
    );

    return this.departmentsService.findOptions(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_DEPARTMENTS)
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({
    status: 200,
    description: 'Department retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.departmentsService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_DEPARTMENT)
  @ApiOperation({ summary: 'Update a department' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiBody({ type: UpdateDepartmentDto })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.departmentsService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_DEPARTMENT)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({
    status: 409,
    description: 'Department has employees assigned',
  })
  remove(@Param('id') id: string, @Req() req: Request & { user: RequestUser }) {
    return this.departmentsService.remove(req.user.tenantId, id);
  }
}
