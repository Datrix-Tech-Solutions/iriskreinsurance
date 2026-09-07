import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  EmploymentStatus,
  Prisma,
  ProjectActivityType,
  ProjectMemberRole,
  ProjectStatus,
  ProjectTask,
  ProjectTaskStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  HR_PERMISSION_DENY_MESSAGE,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateProjectTaskDto } from './dto/create-project-task.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateProjectTaskDto } from './dto/update-project-task.dto';

const PROJECT_INCLUDE = {
  manager: {
    select: { id: true, firstName: true, lastName: true },
  },
  members: {
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  },
  tasks: {
    include: {
      assignedEmployee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_INCLUDE;
}>;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private hasAnyPermission(user: RequestUser, rules: string[]) {
    return rules.some((rule) => hasPermissionRule(user, rule));
  }

  private canViewAllProjects(user: RequestUser) {
    return (
      isCompanyAdminUser(user) ||
      this.hasAnyPermission(user, [
        'projects:VIEW',
        'projects:CREATE',
        'projects:EDIT',
        'projects:DELETE',
        'projects:ASSIGN',
        'project-tasks:VIEW',
        'project-tasks:CREATE',
        'project-tasks:EDIT',
        'project-tasks:DELETE',
        'project-tasks:ASSIGN',
      ])
    );
  }

  private canCreateProject(user: RequestUser) {
    return (
      isCompanyAdminUser(user) || hasPermissionRule(user, 'projects:CREATE')
    );
  }

  private canEditProject(user: RequestUser) {
    return isCompanyAdminUser(user) || hasPermissionRule(user, 'projects:EDIT');
  }

  private canDeleteProject(user: RequestUser) {
    return (
      isCompanyAdminUser(user) || hasPermissionRule(user, 'projects:DELETE')
    );
  }

  private canAssignProject(user: RequestUser) {
    return (
      isCompanyAdminUser(user) || hasPermissionRule(user, 'projects:ASSIGN')
    );
  }

  private canCreateTask(user: RequestUser) {
    return (
      isCompanyAdminUser(user) ||
      hasPermissionRule(user, 'project-tasks:CREATE')
    );
  }

  private canEditTask(user: RequestUser) {
    return (
      isCompanyAdminUser(user) || hasPermissionRule(user, 'project-tasks:EDIT')
    );
  }

  private canDeleteTask(user: RequestUser) {
    return (
      isCompanyAdminUser(user) ||
      hasPermissionRule(user, 'project-tasks:DELETE')
    );
  }

  private canAssignTask(user: RequestUser) {
    return (
      isCompanyAdminUser(user) ||
      hasPermissionRule(user, 'project-tasks:ASSIGN')
    );
  }

  private assertAccess(condition: unknown): asserts condition {
    if (!condition) throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
  }

  private async getActorEmployeeId(tenantId: string, user: RequestUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: user.id },
      select: { id: true },
    });

    return employee?.id ?? null;
  }

  private async ensureEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId,
        employmentStatus: { not: EmploymentStatus.OFFBOARDED },
      },
      select: { id: true, firstName: true, lastName: true, userId: true },
    });

    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  /** Notify an employee (fire-and-forget, in-app only) that a task was assigned to them. */
  private async notifyTaskAssigned(
    tenantId: string,
    actor: RequestUser,
    assignee: { userId: string | null },
    projectId: string,
    projectName: string,
    taskId: string,
    taskName: string,
  ) {
    if (!assignee.userId || assignee.userId === actor.id) return;

    await this.notificationsService.create({
      tenantId,
      userId: assignee.userId,
      type: 'TASK_ASSIGNED',
      title: 'Task Assigned',
      message: `You were assigned "${taskName}" in ${projectName}.`,
      link: `/hr/projects/${projectId}/tasks`,
      entityType: 'projectTask',
      entityId: taskId,
    });
  }

  private validateProjectDates(startDate: Date, endDate?: Date | null) {
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'Project end date cannot be before start date',
      );
    }
  }

  private serializeProject(project: ProjectWithDetails) {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (task) => task.status === ProjectTaskStatus.DONE,
    ).length;
    const progress =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return {
      ...project,
      budget:
        project.budget instanceof Prisma.Decimal
          ? project.budget.toNumber()
          : project.budget,
      managerName: project.manager
        ? `${project.manager.firstName} ${project.manager.lastName}`
        : undefined,
      assignedCount: project.members.length,
      progress,
      tasks: project.tasks.map((task) => this.serializeTask(task)),
      members: project.members.map((member) => ({
        id: member.id,
        employeeId: member.employeeId,
        role: member.role,
        joinedAt: member.joinedAt,
        name: `${member.employee.firstName} ${member.employee.lastName}`,
        email: member.employee.email,
        jobTitle: member.employee.jobTitle,
        department: member.employee.department?.name ?? null,
      })),
    };
  }

  private serializeTask(
    task: ProjectTask & {
      assignedEmployee?: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
    },
  ) {
    return {
      ...task,
      assignedEmployeeName: task.assignedEmployee
        ? `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`
        : undefined,
    };
  }

  private async getProjectOrThrow(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, isArchived: false },
      include: PROJECT_INCLUDE,
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async getProjectMembership(
    tenantId: string,
    projectId: string,
    employeeId: string | null,
  ) {
    if (!employeeId) return null;

    return this.prisma.projectMember.findFirst({
      where: { tenantId, projectId, employeeId },
      select: { id: true, role: true },
    });
  }

  private isProjectLead(role?: ProjectMemberRole | null) {
    return (
      role === ProjectMemberRole.OWNER || role === ProjectMemberRole.MANAGER
    );
  }

  private async canAccessProject(
    tenantId: string,
    projectId: string,
    user: RequestUser,
  ) {
    if (this.canViewAllProjects(user)) return true;

    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    if (!actorEmployeeId) return false;

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
        isArchived: false,
        OR: [
          { managerId: actorEmployeeId },
          { members: { some: { employeeId: actorEmployeeId } } },
          { tasks: { some: { assignedEmployeeId: actorEmployeeId } } },
        ],
      },
      select: { id: true },
    });

    return Boolean(project);
  }

  private async logActivity(
    tx: Prisma.TransactionClient,
    tenantId: string,
    projectId: string,
    user: RequestUser,
    type: ProjectActivityType,
    message: string,
    options?: { taskId?: string; metadata?: Prisma.InputJsonValue },
  ) {
    const actorEmployee = await tx.employee.findFirst({
      where: { tenantId, userId: user.id },
      select: { id: true },
    });

    await tx.projectActivity.create({
      data: {
        tenantId,
        projectId,
        taskId: options?.taskId,
        actorUserId: user.id,
        actorEmployeeId: actorEmployee?.id ?? null,
        type,
        message,
        metadata: options?.metadata,
      },
    });
  }

  async findAll(tenantId: string, user: RequestUser) {
    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    const where: Prisma.ProjectWhereInput = {
      tenantId,
      isArchived: false,
      ...(this.canViewAllProjects(user)
        ? {}
        : {
            OR: [
              { managerId: actorEmployeeId ?? '' },
              { members: { some: { employeeId: actorEmployeeId ?? '' } } },
              {
                tasks: { some: { assignedEmployeeId: actorEmployeeId ?? '' } },
              },
            ],
          }),
    };

    const projects = await this.prisma.project.findMany({
      where,
      include: PROJECT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });

    return projects.map((project) => this.serializeProject(project));
  }

  async findMyProjects(tenantId: string, user: RequestUser) {
    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    this.assertAccess(actorEmployeeId);

    const projects = await this.prisma.project.findMany({
      where: {
        tenantId,
        isArchived: false,
        OR: [
          { managerId: actorEmployeeId },
          { members: { some: { employeeId: actorEmployeeId } } },
          { tasks: { some: { assignedEmployeeId: actorEmployeeId } } },
        ],
      },
      include: PROJECT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });

    return projects.map((project) => this.serializeProject(project));
  }

  async findOne(tenantId: string, projectId: string, user: RequestUser) {
    this.assertAccess(await this.canAccessProject(tenantId, projectId, user));
    return this.serializeProject(
      await this.getProjectOrThrow(tenantId, projectId),
    );
  }

  async create(tenantId: string, user: RequestUser, dto: CreateProjectDto) {
    this.assertAccess(this.canCreateProject(user));

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    this.validateProjectDates(startDate, endDate);

    if (dto.managerId) {
      await this.ensureEmployee(tenantId, dto.managerId);
    }

    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          startDate,
          endDate,
          budget: dto.budget,
          managerId: dto.managerId ?? null,
          createdByUserId: user.id,
        },
      });

      const memberSeeds = new Map<string, ProjectMemberRole>();
      // Designated owner (selected in the form) takes OWNER role.
      if (dto.managerId) {
        memberSeeds.set(dto.managerId, ProjectMemberRole.OWNER);
      }
      // Creator gets OWNER if no one was designated, otherwise MEMBER.
      if (actorEmployeeId && !memberSeeds.has(actorEmployeeId)) {
        memberSeeds.set(
          actorEmployeeId,
          dto.managerId ? ProjectMemberRole.MEMBER : ProjectMemberRole.OWNER,
        );
      }

      for (const [employeeId, role] of memberSeeds) {
        await tx.projectMember.create({
          data: { tenantId, projectId: project.id, employeeId, role },
        });
      }

      await this.logActivity(
        tx,
        tenantId,
        project.id,
        user,
        ProjectActivityType.PROJECT_CREATED,
        `Project "${project.name}" was created.`,
      );

      const created = await tx.project.findUniqueOrThrow({
        where: { id: project.id },
        include: PROJECT_INCLUDE,
      });

      return this.serializeProject(created);
    });
  }

  async update(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: UpdateProjectDto,
  ) {
    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    const membership = await this.getProjectMembership(
      tenantId,
      projectId,
      actorEmployeeId,
    );
    this.assertAccess(
      this.canEditProject(user) || this.isProjectLead(membership?.role),
    );

    const project = await this.getProjectOrThrow(tenantId, projectId);
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : project.startDate;
    const endDate =
      dto.endDate !== undefined
        ? dto.endDate
          ? new Date(dto.endDate)
          : null
        : project.endDate;
    this.validateProjectDates(startDate, endDate);

    if (dto.managerId) {
      await this.ensureEmployee(tenantId, dto.managerId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.startDate !== undefined ? { startDate } : {}),
          ...(dto.endDate !== undefined ? { endDate } : {}),
          ...(dto.budget !== undefined ? { budget: dto.budget } : {}),
          ...(dto.managerId !== undefined
            ? { managerId: dto.managerId || null }
            : {}),
        },
        include: PROJECT_INCLUDE,
      });

      if (dto.managerId) {
        await tx.projectMember.upsert({
          where: {
            projectId_employeeId: { projectId, employeeId: dto.managerId },
          },
          update: { role: ProjectMemberRole.OWNER },
          create: {
            tenantId,
            projectId,
            employeeId: dto.managerId,
            role: ProjectMemberRole.OWNER,
          },
        });
      }

      await this.logActivity(
        tx,
        tenantId,
        projectId,
        user,
        ProjectActivityType.PROJECT_UPDATED,
        `Project "${updated.name}" was updated.`,
      );

      return this.serializeProject(updated);
    });
  }

  async remove(tenantId: string, projectId: string, user: RequestUser) {
    this.assertAccess(this.canDeleteProject(user));
    const project = await this.getProjectOrThrow(tenantId, projectId);

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.CANCELLED, isArchived: true },
      });
      await this.logActivity(
        tx,
        tenantId,
        projectId,
        user,
        ProjectActivityType.PROJECT_CANCELLED,
        `Project "${project.name}" was archived.`,
      );
    });

    return { message: 'Project archived successfully' };
  }

  async listMembers(tenantId: string, projectId: string, user: RequestUser) {
    this.assertAccess(await this.canAccessProject(tenantId, projectId, user));

    const members = await this.prisma.projectMember.findMany({
      where: { tenantId, projectId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((member) => ({
      id: member.id,
      employeeId: member.employeeId,
      role: member.role,
      joinedAt: member.joinedAt,
      name: `${member.employee.firstName} ${member.employee.lastName}`,
      email: member.employee.email,
      jobTitle: member.employee.jobTitle,
      department: member.employee.department?.name ?? null,
    }));
  }

  async addMember(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: AddProjectMemberDto,
  ) {
    await this.getProjectOrThrow(tenantId, projectId);
    await this.ensureEmployee(tenantId, dto.employeeId);

    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    const membership = await this.getProjectMembership(
      tenantId,
      projectId,
      actorEmployeeId,
    );
    this.assertAccess(
      this.canAssignProject(user) || this.isProjectLead(membership?.role),
    );

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.upsert({
        where: {
          projectId_employeeId: { projectId, employeeId: dto.employeeId },
        },
        update: { role: dto.role ?? ProjectMemberRole.MEMBER },
        create: {
          tenantId,
          projectId,
          employeeId: dto.employeeId,
          role: dto.role ?? ProjectMemberRole.MEMBER,
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              jobTitle: true,
              department: { select: { name: true } },
            },
          },
        },
      });

      await this.logActivity(
        tx,
        tenantId,
        projectId,
        user,
        ProjectActivityType.MEMBER_ADDED,
        `${member.employee.firstName} ${member.employee.lastName} was added to the project.`,
      );

      return {
        id: member.id,
        employeeId: member.employeeId,
        role: member.role,
        joinedAt: member.joinedAt,
        name: `${member.employee.firstName} ${member.employee.lastName}`,
        email: member.employee.email,
        jobTitle: member.employee.jobTitle,
        department: member.employee.department?.name ?? null,
      };
    });
  }

  async removeMember(
    tenantId: string,
    projectId: string,
    employeeId: string,
    user: RequestUser,
  ) {
    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    const membership = await this.getProjectMembership(
      tenantId,
      projectId,
      actorEmployeeId,
    );
    this.assertAccess(
      this.canAssignProject(user) || this.isProjectLead(membership?.role),
    );

    const member = await this.prisma.projectMember.findFirst({
      where: { tenantId, projectId, employeeId },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!member) throw new NotFoundException('Project member not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.delete({ where: { id: member.id } });
      await tx.project.updateMany({
        where: { id: projectId, tenantId, managerId: employeeId },
        data: { managerId: null },
      });
      await this.logActivity(
        tx,
        tenantId,
        projectId,
        user,
        ProjectActivityType.MEMBER_REMOVED,
        `${member.employee.firstName} ${member.employee.lastName} was removed from the project.`,
      );
    });

    return { message: 'Project member removed successfully' };
  }

  async listTasks(tenantId: string, projectId: string, user: RequestUser) {
    this.assertAccess(await this.canAccessProject(tenantId, projectId, user));

    const tasks = await this.prisma.projectTask.findMany({
      where: { tenantId, projectId },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return tasks.map((task) => this.serializeTask(task));
  }

  async findMyTasks(tenantId: string, user: RequestUser) {
    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    this.assertAccess(actorEmployeeId);

    const tasks = await this.prisma.projectTask.findMany({
      where: {
        tenantId,
        assignedEmployeeId: actorEmployeeId,
        project: { isArchived: false },
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return tasks.map((task) => ({
      ...this.serializeTask(task),
      project: task.project,
    }));
  }

  async createTask(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: CreateProjectTaskDto,
  ) {
    const project = await this.getProjectOrThrow(tenantId, projectId);

    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    const membership = await this.getProjectMembership(
      tenantId,
      projectId,
      actorEmployeeId,
    );
    this.assertAccess(
      this.canCreateTask(user) || this.isProjectLead(membership?.role),
    );

    const assignedEmployee = dto.assignedEmployeeId
      ? await this.ensureEmployee(tenantId, dto.assignedEmployeeId)
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.projectTask.create({
        data: {
          tenantId,
          projectId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          priority: dto.priority,
          assignedEmployeeId: dto.assignedEmployeeId ?? null,
          createdByUserId: user.id,
          completedAt: null,
        },
        include: {
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (dto.assignedEmployeeId) {
        await tx.projectMember.upsert({
          where: {
            projectId_employeeId: {
              projectId,
              employeeId: dto.assignedEmployeeId,
            },
          },
          update: {},
          create: {
            tenantId,
            projectId,
            employeeId: dto.assignedEmployeeId,
            role: ProjectMemberRole.MEMBER,
          },
        });
      }

      await this.logActivity(
        tx,
        tenantId,
        projectId,
        user,
        ProjectActivityType.TASK_CREATED,
        `Task "${task.name}" was created.`,
        { taskId: task.id },
      );

      return this.serializeTask(task);
    });

    if (assignedEmployee) {
      await this.notifyTaskAssigned(
        tenantId,
        user,
        assignedEmployee,
        projectId,
        project.name,
        result.id,
        result.name,
      );
    }

    return result;
  }

  async updateTask(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
    dto: UpdateProjectTaskDto,
  ) {
    const project = await this.getProjectOrThrow(tenantId, projectId);

    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    const membership = await this.getProjectMembership(
      tenantId,
      projectId,
      actorEmployeeId,
    );
    this.assertAccess(
      this.canEditTask(user) || this.isProjectLead(membership?.role),
    );

    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, tenantId, projectId },
      select: { id: true, name: true, assignedEmployeeId: true },
    });
    if (!task) throw new NotFoundException('Project task not found');

    let newlyAssignedEmployee: { userId: string | null } | null = null;
    if (dto.assignedEmployeeId) {
      this.assertAccess(
        this.canAssignTask(user) || this.isProjectLead(membership?.role),
      );
      const employee = await this.ensureEmployee(
        tenantId,
        dto.assignedEmployeeId,
      );
      // Only notify when the assignee actually changes — not on every edit.
      if (dto.assignedEmployeeId !== task.assignedEmployeeId) {
        newlyAssignedEmployee = employee;
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const status = dto.status;
      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.status !== undefined ? { status } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.dueDate !== undefined
            ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
            : {}),
          ...(dto.assignedEmployeeId !== undefined
            ? { assignedEmployeeId: dto.assignedEmployeeId || null }
            : {}),
          ...(dto.status !== undefined
            ? {
                completedAt:
                  dto.status === ProjectTaskStatus.DONE ? new Date() : null,
              }
            : {}),
        },
        include: {
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (dto.assignedEmployeeId) {
        await tx.projectMember.upsert({
          where: {
            projectId_employeeId: {
              projectId,
              employeeId: dto.assignedEmployeeId,
            },
          },
          update: {},
          create: {
            tenantId,
            projectId,
            employeeId: dto.assignedEmployeeId,
            role: ProjectMemberRole.MEMBER,
          },
        });
      }

      if (dto.status === ProjectTaskStatus.IN_PROGRESS) {
        await tx.project.updateMany({
          where: { id: projectId, tenantId, status: ProjectStatus.PLANNING },
          data: { status: ProjectStatus.ACTIVE },
        });
      }

      if (dto.status === ProjectTaskStatus.DONE) {
        const remaining = await tx.projectTask.count({
          where: {
            projectId,
            tenantId,
            status: { not: ProjectTaskStatus.DONE },
          },
        });
        if (remaining === 0) {
          await tx.project.updateMany({
            where: {
              id: projectId,
              tenantId,
              status: { not: ProjectStatus.CANCELLED },
            },
            data: { status: ProjectStatus.COMPLETED },
          });
        }
      }

      await this.logActivity(
        tx,
        tenantId,
        projectId,
        user,
        ProjectActivityType.TASK_UPDATED,
        `Task "${updated.name}" was updated.`,
        { taskId },
      );

      return this.serializeTask(updated);
    });

    if (newlyAssignedEmployee) {
      await this.notifyTaskAssigned(
        tenantId,
        user,
        newlyAssignedEmployee,
        projectId,
        project.name,
        result.id,
        result.name,
      );
    }

    return result;
  }

  async updateTaskStatus(
    tenantId: string,
    taskId: string,
    user: RequestUser,
    status: ProjectTaskStatus,
  ) {
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, tenantId, project: { isArchived: false } },
      include: {
        project: {
          select: {
            id: true,
            members: {
              where: {
                employee: { userId: user.id },
                role: {
                  in: [ProjectMemberRole.OWNER, ProjectMemberRole.MANAGER],
                },
              },
              select: { id: true },
            },
          },
        },
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, userId: true },
        },
      },
    });

    if (!task) throw new NotFoundException('Project task not found');

    const isAssignedEmployee = task.assignedEmployee?.userId === user.id;
    const isLead = task.project.members.length > 0;
    this.assertAccess(isAssignedEmployee || isLead || this.canEditTask(user));

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.projectTask.update({
        where: { id: task.id },
        data: {
          status,
          completedAt: status === ProjectTaskStatus.DONE ? new Date() : null,
        },
        include: {
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (status === ProjectTaskStatus.IN_PROGRESS) {
        await tx.project.updateMany({
          where: {
            id: task.projectId,
            tenantId,
            status: ProjectStatus.PLANNING,
          },
          data: { status: ProjectStatus.ACTIVE },
        });
      }

      if (status === ProjectTaskStatus.DONE) {
        const remaining = await tx.projectTask.count({
          where: {
            projectId: task.projectId,
            tenantId,
            status: { not: ProjectTaskStatus.DONE },
          },
        });
        if (remaining === 0) {
          await tx.project.updateMany({
            where: {
              id: task.projectId,
              tenantId,
              status: { not: ProjectStatus.CANCELLED },
            },
            data: { status: ProjectStatus.COMPLETED },
          });
        }
      }

      await this.logActivity(
        tx,
        tenantId,
        task.projectId,
        user,
        ProjectActivityType.TASK_STATUS_CHANGED,
        `Task "${task.name}" moved to ${status}.`,
        { taskId: task.id, metadata: { status } },
      );

      return result;
    });

    return this.serializeTask(updated);
  }

  async removeTask(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
  ) {
    const actorEmployeeId = await this.getActorEmployeeId(tenantId, user);
    const membership = await this.getProjectMembership(
      tenantId,
      projectId,
      actorEmployeeId,
    );
    this.assertAccess(
      this.canDeleteTask(user) || this.isProjectLead(membership?.role),
    );

    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, tenantId, projectId },
      select: { id: true, name: true },
    });
    if (!task) throw new NotFoundException('Project task not found');

    await this.prisma.$transaction(async (tx) => {
      await this.logActivity(
        tx,
        tenantId,
        projectId,
        user,
        ProjectActivityType.TASK_DELETED,
        `Task "${task.name}" was deleted.`,
        { taskId },
      );
      await tx.projectTask.delete({ where: { id: taskId } });
    });

    return { message: 'Project task deleted successfully' };
  }

  async listActivities(tenantId: string, projectId: string, user: RequestUser) {
    this.assertAccess(await this.canAccessProject(tenantId, projectId, user));

    return this.prisma.projectActivity.findMany({
      where: { tenantId, projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
