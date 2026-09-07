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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateProjectTaskDto } from './dto/create-project-task.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateProjectTaskDto } from './dto/update-project-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects visible to the current user' })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully' })
  findAll(@Req() req: Request & { user: RequestUser }) {
    return this.projectsService.findAll(req.user.tenantId, req.user);
  }

  @Get('my-projects')
  @ApiOperation({ summary: 'List projects the current employee belongs to' })
  findMyProjects(@Req() req: Request & { user: RequestUser }) {
    return this.projectsService.findMyProjects(req.user.tenantId, req.user);
  }

  @Get('my-tasks')
  @ApiOperation({ summary: 'List tasks assigned to the current employee' })
  findMyTasks(@Req() req: Request & { user: RequestUser }) {
    return this.projectsService.findMyTasks(req.user.tenantId, req.user);
  }

  @Patch('tasks/:taskId/status')
  @ApiOperation({ summary: 'Update status for an assigned project task' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiBody({ type: UpdateTaskStatusDto })
  updateTaskStatus(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.updateTaskStatus(
      req.user.tenantId,
      taskId,
      req.user,
      dto.status,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  create(
    @Body() dto: CreateProjectDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.create(req.user.tenantId, req.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.findOne(req.user.tenantId, id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiBody({ type: UpdateProjectDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.update(req.user.tenantId, id, req.user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  remove(@Param('id') id: string, @Req() req: Request & { user: RequestUser }) {
    return this.projectsService.remove(req.user.tenantId, id, req.user);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List project members' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  listMembers(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.listMembers(req.user.tenantId, id, req.user);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add or update a project member' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiBody({ type: AddProjectMemberDto })
  addMember(
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.addMember(req.user.tenantId, id, req.user, dto);
  }

  @Delete(':id/members/:employeeId')
  @ApiOperation({ summary: 'Remove a project member' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  removeMember(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.removeMember(
      req.user.tenantId,
      id,
      employeeId,
      req.user,
    );
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'List project tasks' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  listTasks(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.listTasks(req.user.tenantId, id, req.user);
  }

  @Post(':id/tasks')
  @ApiOperation({ summary: 'Create a project task' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiBody({ type: CreateProjectTaskDto })
  createTask(
    @Param('id') id: string,
    @Body() dto: CreateProjectTaskDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.createTask(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Update a project task' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiBody({ type: UpdateProjectTaskDto })
  updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateProjectTaskDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.updateTask(
      req.user.tenantId,
      id,
      taskId,
      req.user,
      dto,
    );
  }

  @Delete(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Delete a project task' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  removeTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.removeTask(
      req.user.tenantId,
      id,
      taskId,
      req.user,
    );
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'List recent project activity' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  listActivities(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.listActivities(req.user.tenantId, id, req.user);
  }
}
