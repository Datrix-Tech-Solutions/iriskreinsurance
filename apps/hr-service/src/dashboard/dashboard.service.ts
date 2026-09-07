import { Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { AnnouncementsService } from '../announcements/announcements.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcementsService: AnnouncementsService,
  ) {}

  async getSummary(
    tenantId: string,
    tenantSlug: string,
    firstName: string,
    tenantName: string,
  ) {
    const [
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests,
      assignedAssetsCount,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.employee.count({
        where: { tenantId, employmentStatus: 'ACTIVE' },
      }),
      this.prisma.leaveRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.asset.count({
        where: {
          tenantId,
          isActive: true,
          status: 'ASSIGNED',
        },
      }),
    ]);

    return {
      adminFirstName: firstName,
      companyName: tenantName,
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests,
      assignedAssetsCount,
      hasEmployees: totalEmployees > 0,
      modules: {
        hr: { enabled: true, locked: false },
        payroll: { enabled: true, locked: false },
        assets: { enabled: true, locked: false },
        recruitment: { enabled: false, locked: true },
      },
    };
  }

  async getEmployeeDashboard(tenantId: string, actor: RequestUser) {
    // Get employee profile
    const employee = await this.prisma.employee.findFirst({
      where: { userId: actor.id, tenantId },
      include: { department: true },
    });

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = employee
      ? await this.prisma.clockRecord.findFirst({
          where: {
            employeeId: employee.id,
            date: { gte: today, lt: tomorrow },
          },
        })
      : null;

    // Get leave balances
    const leaveBalances = employee
      ? await this.prisma.leaveBalance.findMany({
          where: { employeeId: employee.id, tenantId },
          include: { leaveType: true },
        })
      : [];

    // Get upcoming approved leave
    const upcomingLeave = employee
      ? await this.prisma.leaveRequest.findFirst({
          where: {
            employeeId: employee.id,
            tenantId,
            status: 'APPROVED',
            startDate: { gte: new Date() },
          },
          include: { leaveType: true },
          orderBy: { startDate: 'asc' },
        })
      : null;

    // Get pending leave count
    const pendingLeaveCount = employee
      ? await this.prisma.leaveRequest.count({
          where: {
            employeeId: employee.id,
            tenantId,
            status: 'PENDING',
          },
        })
      : 0;

    // Get last 3 announcements
    const announcements =
      await this.announcementsService.findVisibleForDashboard(tenantId, actor);

    const isProfileIncomplete =
      employee && (!employee.jobTitle || !employee.departmentId);

    return {
      profile: {
        fullName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : 'Name not set',
        jobTitle: employee?.jobTitle ?? 'No title assigned',
        department: employee?.department?.name ?? 'No department assigned',
        avatarUrl: employee?.avatarUrl ?? null,
        isProfileIncomplete: !!isProfileIncomplete,
      },
      attendance: {
        clockedInAt: todayAttendance?.clockIn ?? null,
        clockedOutAt: todayAttendance?.clockOut ?? null,
        totalHours: todayAttendance?.hoursWorked ?? null,
        status: !todayAttendance
          ? 'NOT_CLOCKED_IN'
          : todayAttendance.clockOut
            ? 'CLOCKED_OUT'
            : 'CLOCKED_IN',
      },
      leave: {
        balances: leaveBalances.map((b) => ({
          leaveType: b.leaveType.name,
          remaining: b.remainingDays,
          total: b.leaveType.daysAllowed,
        })),
        upcomingLeave: upcomingLeave
          ? {
              startDate: upcomingLeave.startDate,
              endDate: upcomingLeave.endDate,
              leaveType: upcomingLeave.leaveType.name,
            }
          : null,
        pendingCount: pendingLeaveCount,
      },
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        preview: a.body.substring(0, 100),
        body: a.body,
        publishedAt: a.publishedAt,
        isRead: a.isRead,
        readAt: a.readAt,
      })),
    };
  }

  async getDepartmentDistribution(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });

    return {
      distribution: departments.map((d) => ({
        department: d.name,
        count: d._count.employees,
      })),
      hasData: departments.some((d) => d._count.employees > 0),
    };
  }

  async getRecentActivity(tenantId: string) {
    const recent = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employmentStatus: true,
        createdAt: true,
        updatedAt: true,
        statusChangedAt: true,
        statusChangedByEmail: true,
        offboardedAt: true,
      },
    });

    return {
      activity: recent.map((e) => {
        let action = 'New hire added';
        if (e.offboardedAt) action = 'Offboarding initiated';
        else if (e.statusChangedAt && e.statusChangedAt > e.createdAt)
          action = 'Status changed';

        return {
          employeeId: e.id,
          employeeName: `${e.firstName} ${e.lastName}`,
          action,
          status: e.employmentStatus,
          timestamp: e.statusChangedAt ?? e.createdAt,
          changedBy: e.statusChangedByEmail ?? null,
        };
      }),
    };
  }

  async getUpcomingBirthdays(tenantId: string) {
    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        dateOfBirth: { not: null },
        employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        department: { select: { name: true } },
        avatarUrl: true,
      },
    });

    const upcoming = employees
      .filter((e) => {
        if (!e.dateOfBirth) return false;
        const bday = new Date(e.dateOfBirth);
        const bdayThisYear = new Date(
          today.getFullYear(),
          bday.getMonth(),
          bday.getDate(),
        );
        if (bdayThisYear < today) {
          bdayThisYear.setFullYear(today.getFullYear() + 1);
        }
        return bdayThisYear <= in30Days;
      })
      .map((e) => {
        const bday = new Date(e.dateOfBirth!);
        const bdayThisYear = new Date(
          today.getFullYear(),
          bday.getMonth(),
          bday.getDate(),
        );
        if (bdayThisYear < today) {
          bdayThisYear.setFullYear(today.getFullYear() + 1);
        }
        return {
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          department: e.department?.name ?? 'No department',
          dateOfBirth: e.dateOfBirth,
          upcomingBirthday: bdayThisYear,
          avatarUrl: e.avatarUrl,
        };
      })
      .sort(
        (a, b) => a.upcomingBirthday.getTime() - b.upcomingBirthday.getTime(),
      )
      .slice(0, 5);

    return { birthdays: upcoming };
  }

  async getRecentlyAdded(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        createdAt: true,
        avatarUrl: true,
        department: { select: { name: true } },
      },
    });

    return {
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        jobTitle: e.jobTitle,
        department: e.department?.name ?? 'No department',
        dateAdded: e.createdAt,
        avatarUrl: e.avatarUrl,
      })),
    };
  }
}
