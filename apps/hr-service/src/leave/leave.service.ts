import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PermissionRecipient, RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { UpdateLeaveRequestSupportingDocumentDto } from './dto/update-leave-request-supporting-document.dto';
import {
  Gender,
  LeaveRequestStatus,
  LeaveType,
  Prisma,
} from '../../prisma/generated/client';
import {
  assertHrAccess,
  getActorEmployee,
  hasPermissionRule,
  isCompanyAdminUser,
  isEmployeeSelfServiceUser,
} from '../auth/access-scope';
import {
  getSeededPublicHolidaysForLocation,
  SeededPublicHoliday,
} from './public-holiday.catalog';

type DefaultLeaveTypeDefinition = {
  name: string;
  daysAllowed: number;
  isPaid: boolean;
  requiresApproval: boolean;
  requiresSupportingDocument?: boolean;
  isDefault: boolean;
  applicableGenders?: Gender[];
};

const DEFAULT_LEAVE_TYPES: DefaultLeaveTypeDefinition[] = [
  {
    name: 'Annual Leave',
    daysAllowed: 21,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
  },
  {
    name: 'Sick Leave',
    daysAllowed: 14,
    isPaid: true,
    requiresApproval: true,
    requiresSupportingDocument: true,
    isDefault: true,
  },
  {
    name: 'Maternity Leave',
    daysAllowed: 84,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
    applicableGenders: ['FEMALE'],
  },
  {
    name: 'Paternity Leave',
    daysAllowed: 5,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
    applicableGenders: ['MALE'],
  },
  {
    name: 'Compassionate Leave',
    daysAllowed: 3,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
  },
];

type LeaveNotificationRecipient = {
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: 'MANAGER' | 'APPROVER';
};

type LeaveNotificationRecipients = {
  manager: LeaveNotificationRecipient | null;
  approvers: LeaveNotificationRecipient[];
  all: LeaveNotificationRecipient[];
};

type HolidayLocation = {
  countryScope: string;
  regionScope: string;
};

type NagerDateHoliday = {
  date?: string;
  localName?: string;
  name?: string;
  countryCode?: string;
  global?: boolean;
  counties?: string[] | null;
  types?: string[];
};

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RabbitMQPublisher))
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  private genderLabel(gender: Gender): string {
    return gender.replace(/_/g, ' ').toLowerCase();
  }

  private isLeaveTypeApplicableToEmployee(
    leaveType: Pick<LeaveType, 'applicableTo' | 'applicableGenders'>,
    employee: {
      employmentType: (typeof leaveType.applicableTo)[number];
      gender: Gender | null;
    },
  ): boolean {
    const employmentTypeMatches =
      leaveType.applicableTo.length === 0 ||
      leaveType.applicableTo.includes(employee.employmentType);

    if (!employmentTypeMatches) {
      return false;
    }

    if (leaveType.applicableGenders.length === 0) {
      return true;
    }

    return (
      employee.gender !== null &&
      leaveType.applicableGenders.includes(employee.gender)
    );
  }

  private parseDateOnly(value: string, label: string): Date {
    const parts = value.split('-').map((part) => Number(part));
    if (
      parts.length !== 3 ||
      parts.some((part) => Number.isNaN(part)) ||
      parts[1] < 1 ||
      parts[1] > 12 ||
      parts[2] < 1 ||
      parts[2] > 31
    ) {
      throw new BadRequestException(`${label} is invalid.`);
    }

    const [year, month, day] = parts;
    const parsed = new Date(year, month - 1, day);
    parsed.setHours(0, 0, 0, 0);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw new BadRequestException(`${label} is invalid.`);
    }

    return parsed;
  }

  private formatDateOnly(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeLocationValue(value: string | null | undefined): string {
    return value?.trim().toLowerCase() ?? '';
  }

  private normalizeCountryValue(value: string | null | undefined): string {
    const normalized = this.normalizeLocationValue(value);
    if (['gh', 'gha', 'ghana', 'republic of ghana'].includes(normalized)) {
      return 'ghana';
    }
    return normalized;
  }

  private toNagerCountryCode(value: string | null | undefined): string {
    const normalized = this.normalizeLocationValue(value);
    if (!normalized) return '';
    if (['gh', 'gha', 'ghana', 'republic of ghana'].includes(normalized)) {
      return 'GH';
    }
    if (/^[a-z]{2}$/.test(normalized)) {
      return normalized.toUpperCase();
    }
    return '';
  }

  private addMonths(date: Date, months: number) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    value.setMonth(value.getMonth() + months);
    return value;
  }

  private rangesOverlap(
    leftStart: Date,
    leftEnd: Date,
    rightStart: Date,
    rightEnd: Date,
  ) {
    return leftStart <= rightEnd && leftEnd >= rightStart;
  }

  private matchesHolidayLocation(
    holiday: { countryScope: string; regionScope: string },
    location: HolidayLocation,
  ) {
    const countryScope = this.normalizeCountryValue(holiday.countryScope);
    const regionScope = this.normalizeLocationValue(holiday.regionScope);

    if (countryScope && countryScope !== location.countryScope) {
      return false;
    }

    if (regionScope && regionScope !== location.regionScope) {
      return false;
    }

    return true;
  }

  private deriveObservedDate(
    date: Date,
    occupiedObservedDates: Set<string>,
  ): { observedDate: Date; isObservedShifted: boolean } {
    const observedDate = new Date(date);
    observedDate.setHours(0, 0, 0, 0);

    if (observedDate.getDay() !== 0 && observedDate.getDay() !== 6) {
      occupiedObservedDates.add(this.formatDateOnly(observedDate));
      return {
        observedDate,
        isObservedShifted: false,
      };
    }

    while (
      observedDate.getDay() === 0 ||
      observedDate.getDay() === 6 ||
      occupiedObservedDates.has(this.formatDateOnly(observedDate))
    ) {
      observedDate.setDate(observedDate.getDate() + 1);
    }

    occupiedObservedDates.add(this.formatDateOnly(observedDate));
    return {
      observedDate,
      isObservedShifted: true,
    };
  }

  private async resolveEmployeeHolidayLocation(
    tenantId: string,
    employeeId: string,
  ): Promise<HolidayLocation> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: {
        nationality: true,
        region: true,
        branch: {
          select: {
            country: true,
            region: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return {
      countryScope: this.normalizeCountryValue(
        employee.branch?.country ?? employee.nationality,
      ),
      regionScope: this.normalizeLocationValue(
        employee.branch?.region ?? employee.region,
      ),
    };
  }

  private async ensurePublicHolidaysSeededForLocation(
    tenantId: string,
    location: HolidayLocation,
    years: number[],
  ) {
    const countryScope = this.normalizeCountryValue(location.countryScope);
    if (!countryScope) {
      return;
    }

    const uniqueYears = Array.from(new Set(years));

    for (const year of uniqueYears) {
      const holidays = await this.resolveSeededPublicHolidaysForCountry(
        countryScope,
        year,
      );

      for (const holiday of holidays) {
        const existingHolidayByNameAndDate =
          await this.prisma.publicHoliday.findFirst({
            where: {
              tenantId,
              name: { equals: holiday.name, mode: 'insensitive' },
              date: holiday.date,
            },
            select: { id: true },
          });

        const existingHolidayByDate = existingHolidayByNameAndDate
          ? null
          : await this.prisma.publicHoliday.findFirst({
              where: {
                tenantId,
                date: holiday.date,
              },
              select: { id: true },
            });

        const existingHoliday =
          existingHolidayByNameAndDate ?? existingHolidayByDate;

        if (existingHoliday) {
          await this.prisma.publicHoliday.update({
            where: { id: existingHoliday.id },
            data: {
              name: holiday.name,
              observedDate: holiday.observedDate,
              countryScope: holiday.countryScope,
              regionScope: holiday.regionScope,
              isObservedShifted: holiday.isObservedShifted,
              source: holiday.source,
            },
          });
          continue;
        }

        await this.prisma.publicHoliday.upsert({
          where: {
            tenantId_name_date_countryScope_regionScope: {
              tenantId,
              name: holiday.name,
              date: holiday.date,
              countryScope: holiday.countryScope,
              regionScope: holiday.regionScope,
            },
          },
          update: {
            observedDate: holiday.observedDate,
            isObservedShifted: holiday.isObservedShifted,
            source: holiday.source,
          },
          create: {
            tenantId,
            name: holiday.name,
            date: holiday.date,
            observedDate: holiday.observedDate,
            countryScope: holiday.countryScope,
            regionScope: holiday.regionScope,
            isObservedShifted: holiday.isObservedShifted,
            source: holiday.source,
          },
        });
      }
    }
  }

  async ensurePublicHolidaysSeededForEmployee(
    tenantId: string,
    employeeId: string,
    years: number[],
  ) {
    const location = await this.resolveEmployeeHolidayLocation(
      tenantId,
      employeeId,
    );
    await this.ensurePublicHolidaysSeededForLocation(tenantId, location, years);
  }

  async seedPublicHolidaysForTenant(
    tenantId: string,
    country: string | null | undefined,
    years?: number[],
  ) {
    const currentYear = new Date().getFullYear();
    await this.ensurePublicHolidaysSeededForLocation(
      tenantId,
      {
        countryScope: this.normalizeCountryValue(country ?? 'GH'),
        regionScope: '',
      },
      years ?? [currentYear],
    );
  }

  private async resolveSeededPublicHolidaysForCountry(
    country: string,
    year: number,
  ): Promise<SeededPublicHoliday[]> {
    const fromApi = await this.fetchNagerPublicHolidays(country, year);
    if (fromApi.length > 0) {
      return fromApi;
    }

    return getSeededPublicHolidaysForLocation(country, '', year, (value) =>
      this.formatDateOnly(value),
    );
  }

  private async fetchNagerPublicHolidays(
    country: string,
    year: number,
  ): Promise<SeededPublicHoliday[]> {
    const countryCode = this.toNagerCountryCode(country);
    if (!countryCode) {
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
        {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Nager.Date holiday fetch failed for ${countryCode}/${year}: ${response.status}`,
        );
        return [];
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        return [];
      }

      const occupiedObservedDates = new Set<string>();
      return payload
        .filter((holiday): holiday is NagerDateHoliday => {
          if (!holiday || typeof holiday !== 'object') return false;
          const item = holiday as NagerDateHoliday;
          return (
            typeof item.date === 'string' &&
            Boolean(item.name || item.localName) &&
            item.global === true &&
            (item.types?.includes('Public') ?? true)
          );
        })
        .map((holiday) => {
          const date = this.parseDateOnly(
            holiday.date!,
            'Nager.Date public holiday date',
          );
          const { observedDate, isObservedShifted } = this.deriveObservedDate(
            date,
            occupiedObservedDates,
          );

          return {
            name: holiday.name || holiday.localName || 'Public Holiday',
            date,
            observedDate,
            countryScope: this.normalizeCountryValue(
              holiday.countryCode ?? countryCode,
            ),
            regionScope: '',
            isObservedShifted,
            source: 'NAGER_DATE',
          };
        });
    } catch (error) {
      this.logger.warn(
        `Nager.Date holiday fetch failed for ${countryCode}/${year}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getApplicableHolidayDates(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    location: HolidayLocation,
  ) {
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        tenantId,
        OR: [
          {
            date: { gte: startDate, lte: endDate },
          },
          {
            observedDate: { gte: startDate, lte: endDate },
          },
        ],
      },
      select: {
        date: true,
        observedDate: true,
        countryScope: true,
        regionScope: true,
      },
    });

    return new Set(
      holidays
        .filter((holiday) => this.matchesHolidayLocation(holiday, location))
        .map((holiday) => this.formatDateOnly(holiday.observedDate)),
    );
  }

  private async calculateWorkingDayBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    location: HolidayLocation,
  ) {
    const holidayDates = await this.getApplicableHolidayDates(
      tenantId,
      startDate,
      endDate,
      location,
    );

    const breakdown = new Map<number, number>();
    let totalDays = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const dateStr = this.formatDateOnly(current);

      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
        const year = current.getFullYear();
        breakdown.set(year, (breakdown.get(year) ?? 0) + 1);
        totalDays += 1;
      }

      current.setDate(current.getDate() + 1);
    }

    return {
      totalDays,
      yearlyBreakdown: breakdown,
    };
  }

  private validateSupportingDocumentFields(
    supportingDocumentName?: string,
    supportingDocumentUrl?: string,
  ) {
    const hasName = Boolean(supportingDocumentName);
    const hasUrl = Boolean(supportingDocumentUrl);

    if (hasName !== hasUrl) {
      throw new BadRequestException(
        'Supporting document name and URL must be provided together.',
      );
    }
  }

  // ── Seed default leave types for new tenant ───────────────────────────────
  async seedDefaultLeaveTypes(tenantId: string) {
    for (const lt of DEFAULT_LEAVE_TYPES) {
      await this.prisma.leaveType.upsert({
        where: { tenantId_name: { tenantId, name: lt.name } },
        // Preserve tenant-specific edits and archives after initial seeding.
        update: { isDefault: true },
        create: { tenantId, ...lt },
      });
    }
  }

  // ── Leave Types ───────────────────────────────────────────────────────────
  async createLeaveType(tenantId: string, dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A leave type with this name already exists');
    }
    const leaveType = await this.prisma.leaveType.create({
      data: {
        tenantId,
        ...dto,
        requiresApproval: true,
      },
    });

    // Backfill leave balances for all existing active employees so they
    // immediately get an entitlement for this new leave type. Uses upsert
    // internally — safe to call on employees who already have balances.
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: { not: 'OFFBOARDED' } },
      select: { id: true },
    });
    await Promise.all(
      employees.map((emp) => this.initializeLeaveBalances(tenantId, emp.id)),
    );

    return leaveType;
  }

  async updateLeaveType(
    tenantId: string,
    id: string,
    dto: Partial<CreateLeaveTypeDto>,
  ) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id, tenantId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    // Check for existing requests
    const hasRequests = await this.prisma.leaveRequest.count({
      where: { leaveTypeId: id, tenantId },
    });

    const updated = await this.prisma.leaveType.update({
      where: { id },
      data: {
        ...dto,
        requiresApproval: true,
      },
    });

    // When daysAllowed changes, update all existing balance records for the
    // current year so employees see the correct entitlement immediately.
    if (
      dto.daysAllowed !== undefined &&
      dto.daysAllowed !== leaveType.daysAllowed
    ) {
      const diff = dto.daysAllowed - leaveType.daysAllowed;
      const year = new Date().getFullYear();
      const balances = await this.prisma.leaveBalance.findMany({
        where: { leaveTypeId: id, year },
      });
      for (const balance of balances) {
        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            totalDays: dto.daysAllowed,
            remainingDays: Math.max(0, balance.remainingDays + diff),
          },
        });
      }
    }

    return {
      ...updated,
      warning:
        hasRequests > 0
          ? 'Editing this leave type will not affect requests already submitted or approved.'
          : null,
    };
  }

  async deleteLeaveType(tenantId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id, tenantId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const [requestCount, balanceCount] = await Promise.all([
      this.prisma.leaveRequest.count({
        where: { leaveTypeId: id, tenantId },
      }),
      this.prisma.leaveBalance.count({
        where: { leaveTypeId: id, tenantId },
      }),
    ]);

    const archived = await this.prisma.leaveType.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      ...archived,
      message: 'Leave type archived successfully',
      warning:
        requestCount > 0 || balanceCount > 0
          ? 'This leave type is referenced by existing leave records, so it was archived instead of destructively deleted.'
          : null,
    };
  }

  // ── Public Holidays ───────────────────────────────────────────────────────
  async createPublicHoliday(tenantId: string, dto: CreatePublicHolidayDto) {
    const name = dto.name.trim();
    const date = this.parseDateOnly(dto.date, 'Public holiday date');
    const countryScope = this.normalizeCountryValue(dto.countryScope);
    const regionScope = '';

    const duplicate = await this.prisma.publicHoliday.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        date,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        'A public holiday with this name and date already exists.',
      );
    }

    const existingObservedDates = new Set<string>();
    const siblingHolidays = await this.prisma.publicHoliday.findMany({
      where: {
        tenantId,
        countryScope,
        regionScope,
        OR: [
          {
            date: {
              gte: new Date(date.getFullYear(), 0, 1),
              lte: new Date(date.getFullYear(), 11, 31),
            },
          },
          {
            observedDate: {
              gte: new Date(date.getFullYear(), 0, 1),
              lte: new Date(date.getFullYear(), 11, 31),
            },
          },
        ],
      },
      select: {
        observedDate: true,
      },
    });

    for (const holiday of siblingHolidays) {
      existingObservedDates.add(this.formatDateOnly(holiday.observedDate));
    }

    const { observedDate, isObservedShifted } = this.deriveObservedDate(
      date,
      existingObservedDates,
    );

    return this.prisma.publicHoliday.create({
      data: {
        tenantId,
        name,
        date,
        observedDate,
        countryScope,
        regionScope,
        isObservedShifted,
        source: 'MANUAL',
      },
    });
  }

  async getPublicHolidays(tenantId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    return this.prisma.publicHoliday.findMany({
      where: {
        tenantId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        date: true,
        observedDate: true,
        countryScope: true,
        regionScope: true,
        isObservedShifted: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ observedDate: 'asc' }, { name: 'asc' }],
    });
  }

  async updatePublicHoliday(
    tenantId: string,
    id: string,
    dto: UpdatePublicHolidayDto,
  ) {
    const holiday = await this.prisma.publicHoliday.findFirst({
      where: { id, tenantId },
    });
    if (!holiday) throw new NotFoundException('Public holiday not found');

    const name = dto.name?.trim() ?? holiday.name;
    const date = dto.date
      ? this.parseDateOnly(dto.date, 'Public holiday date')
      : holiday.date;
    const countryScope =
      dto.countryScope !== undefined
        ? this.normalizeCountryValue(dto.countryScope)
        : holiday.countryScope;
    const regionScope = '';

    const duplicate = await this.prisma.publicHoliday.findFirst({
      where: {
        tenantId,
        id: { not: id },
        name: { equals: name, mode: 'insensitive' },
        date,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        'A public holiday with this name and date already exists.',
      );
    }

    const existingObservedDates = new Set<string>();
    const siblingHolidays = await this.prisma.publicHoliday.findMany({
      where: {
        tenantId,
        countryScope,
        regionScope,
        id: { not: id },
        OR: [
          {
            date: {
              gte: new Date(date.getFullYear(), 0, 1),
              lte: new Date(date.getFullYear(), 11, 31),
            },
          },
          {
            observedDate: {
              gte: new Date(date.getFullYear(), 0, 1),
              lte: new Date(date.getFullYear(), 11, 31),
            },
          },
        ],
      },
      select: {
        observedDate: true,
      },
    });

    for (const sibling of siblingHolidays) {
      existingObservedDates.add(this.formatDateOnly(sibling.observedDate));
    }

    const { observedDate, isObservedShifted } = this.deriveObservedDate(
      date,
      existingObservedDates,
    );

    return this.prisma.publicHoliday.update({
      where: { id },
      data: {
        name,
        date,
        observedDate,
        countryScope,
        regionScope,
        isObservedShifted,
        source: holiday.source ?? 'MANUAL',
      },
    });
  }

  async deletePublicHoliday(tenantId: string, id: string) {
    const holiday = await this.prisma.publicHoliday.findFirst({
      where: { id, tenantId },
    });
    if (!holiday) throw new NotFoundException('Public holiday not found');
    await this.prisma.publicHoliday.delete({ where: { id } });
    return { message: 'Public holiday deleted successfully' };
  }

  async getPendingCount(tenantId: string, actor: RequestUser) {
    const baseWhere: Prisma.LeaveRequestWhereInput = {
      tenantId,
      status: 'PENDING',
    };

    if (isCompanyAdminUser(actor)) {
      const count = await this.prisma.leaveRequest.count({ where: baseWhere });
      return { count };
    }

    if (hasPermissionRule(actor, 'leave:APPROVE')) {
      const count = await this.prisma.leaveRequest.count({ where: baseWhere });
      return { count };
    }

    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const count = await this.prisma.leaveRequest.count({
      where: { ...baseWhere, employeeId: actorEmployee.id },
    });
    return { count };
  }
  async getLeaveTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Leave Balances ────────────────────────────────────────────────────────
  async initializeLeaveBalances(
    tenantId: string,
    employeeId: string,
    year = new Date().getFullYear(),
  ) {
    let leaveTypes = await this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
    });

    // If the tenant has no leave types yet (tenant pre-dates the approval event,
    // or the event was missed), seed defaults now so the employee always gets
    // balances regardless of event delivery.
    if (leaveTypes.length === 0) {
      await this.seedDefaultLeaveTypes(tenantId);
      leaveTypes = await this.prisma.leaveType.findMany({
        where: { tenantId, isActive: true },
      });
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employmentType: true, gender: true },
    });

    for (const lt of leaveTypes) {
      if (
        employee &&
        !this.isLeaveTypeApplicableToEmployee(lt, {
          employmentType: employee.employmentType,
          gender: employee.gender,
        })
      ) {
        continue;
      }

      await this.prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: { employeeId, leaveTypeId: lt.id, year },
        },
        update: {},
        create: {
          tenantId,
          employeeId,
          leaveTypeId: lt.id,
          year,
          totalDays: lt.daysAllowed,
          usedDays: 0,
          pendingDays: 0,
          remainingDays: lt.daysAllowed,
        },
      });
    }
  }

  async getLeaveBalances(
    tenantId: string,
    employeeId: string,
    actor?: RequestUser,
  ) {
    if (actor && !isCompanyAdminUser(actor)) {
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );

      if (isEmployeeSelfServiceUser(actor)) {
        assertHrAccess(employeeId === actorEmployee.id);
      } else {
        assertHrAccess(hasPermissionRule(actor, 'leave:VIEW'));
      }
    }

    const year = new Date().getFullYear();
    let balances = await this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId, year },
      include: { leaveType: true },
    });

    // Self-heal: if this employee has no balances for the current year
    // (e.g. first access after a year rollover, or created before the
    // balance-init flow existed), initialise them now and re-fetch.
    if (balances.length === 0) {
      await this.initializeLeaveBalances(tenantId, employeeId, year);
      balances = await this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId, year },
        include: { leaveType: true },
      });
    }

    return balances;
  }

  async getEmployeeByUserId(tenantId: string, userId: string) {
    return this.prisma.employee.findFirst({ where: { userId, tenantId } });
  }

  async getMyLeaveBalances(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) return [];
    return this.getLeaveBalances(tenantId, employee.id);
  }

  async backfillLeaveBalances(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
    });
    for (const emp of employees) {
      await this.initializeLeaveBalances(tenantId, emp.id);
    }
    return {
      message: `Leave balances backfilled for ${employees.length} employees`,
    };
  }

  // ── Leave Requests ────────────────────────────────────────────────────────
  async createRequest(
    tenantId: string,
    actor: RequestUser,
    dto: CreateLeaveRequestDto,
  ) {
    const empRecord = await this.prisma.employee.findFirst({
      where: { userId: actor.id, tenantId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        employmentType: true,
        employmentStatus: true,
        gender: true,
        hireDate: true,
        managerId: true,
        departmentId: true,
      },
    });
    if (!empRecord) throw new NotFoundException('Employee profile not found');
    if (
      empRecord.employmentStatus !== 'ACTIVE' &&
      empRecord.employmentStatus !== 'PROBATION'
    ) {
      throw new ForbiddenException(
        'Only active or probationary employees can submit leave requests.',
      );
    }
    const employeeId = empRecord.id;

    // Check leave type eligibility based on employment type and gender
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, tenantId, isActive: true },
    });
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }
    if (
      leaveType.applicableTo.length > 0 &&
      !leaveType.applicableTo.includes(empRecord.employmentType)
    ) {
      throw new ForbiddenException(
        `This leave type is not available for your employment type (${empRecord.employmentType.replace('_', ' ').toLowerCase()})`,
      );
    }
    if (leaveType.applicableGenders.length > 0 && empRecord.gender === null) {
      throw new ForbiddenException(
        'This leave type is only available to employees with a recorded gender. Please update your profile or contact HR.',
      );
    }
    if (
      leaveType.applicableGenders.length > 0 &&
      empRecord.gender !== null &&
      !leaveType.applicableGenders.includes(empRecord.gender)
    ) {
      throw new ForbiddenException(
        `This leave type is not available for your gender (${this.genderLabel(empRecord.gender)}).`,
      );
    }
    const supportingDocumentName = dto.supportingDocumentName?.trim();
    const supportingDocumentUrl = dto.supportingDocumentUrl?.trim();
    this.validateSupportingDocumentFields(
      supportingDocumentName,
      supportingDocumentUrl,
    );
    const start = this.parseDateOnly(dto.startDate, 'Start date');
    const end = this.parseDateOnly(dto.endDate, 'End date');
    const coverageNote = dto.coverageNote?.trim();

    if (end < start)
      throw new BadRequestException('End date must be after start date');
    if (start < empRecord.hireDate) {
      throw new BadRequestException(
        'Leave cannot start before the employee hire date.',
      );
    }

    let coverageEmployeeId: string | undefined;
    if (dto.coverageEmployeeId) {
      if (dto.coverageEmployeeId === employeeId) {
        throw new BadRequestException(
          'You cannot assign yourself as your own leave cover.',
        );
      }

      const coverageEmployee = await this.prisma.employee.findFirst({
        where: {
          id: dto.coverageEmployeeId,
          tenantId,
          employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
        },
        select: { id: true },
      });

      if (!coverageEmployee) {
        throw new NotFoundException('Selected coverage employee was not found');
      }

      coverageEmployeeId = coverageEmployee.id;
    }

    const overlappingRequest = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (overlappingRequest) {
      throw new ConflictException(
        `You already have a ${overlappingRequest.status.toLowerCase()} leave request overlapping ${this.formatDateOnly(overlappingRequest.startDate)} to ${this.formatDateOnly(overlappingRequest.endDate)}.`,
      );
    }

    const location = await this.resolveEmployeeHolidayLocation(
      tenantId,
      employeeId,
    );
    const years = [];
    for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
      years.push(year);
    }
    await this.ensurePublicHolidaysSeededForLocation(tenantId, location, years);

    const { totalDays, yearlyBreakdown } =
      await this.calculateWorkingDayBreakdown(tenantId, start, end, location);

    if (totalDays <= 0) {
      throw new BadRequestException(
        'The selected leave period does not contain any working days.',
      );
    }

    const balancesByYear = new Map<
      number,
      { id: string; remainingDays: number }
    >();

    for (const year of years) {
      if (!yearlyBreakdown.has(year)) {
        continue;
      }

      let balance = await this.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: dto.leaveTypeId,
            year,
          },
        },
      });

      if (!balance) {
        await this.initializeLeaveBalances(tenantId, employeeId, year);
        balance = await this.prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId,
              leaveTypeId: dto.leaveTypeId,
              year,
            },
          },
        });
      }

      if (!balance) {
        throw new BadRequestException(
          `No leave balance found for this leave type in ${year}.`,
        );
      }

      const requestedDays = yearlyBreakdown.get(year) ?? 0;
      if (balance.remainingDays < requestedDays) {
        throw new BadRequestException(
          `Insufficient leave balance for ${year}. Available: ${balance.remainingDays} days, Requested: ${requestedDays} days.`,
        );
      }

      balancesByYear.set(year, {
        id: balance.id,
        remainingDays: balance.remainingDays,
      });
    }

    const request = await this.prisma.$transaction(async (tx) => {
      for (const [year, balance] of balancesByYear.entries()) {
        const requestedDays = yearlyBreakdown.get(year) ?? 0;
        const balanceUpdate = await tx.leaveBalance.updateMany({
          where: {
            id: balance.id,
            remainingDays: { gte: requestedDays },
          },
          data: {
            pendingDays: { increment: requestedDays },
            remainingDays: { decrement: requestedDays },
          },
        });

        if (balanceUpdate.count !== 1) {
          throw new BadRequestException(
            'Leave balance changed while processing your request. Please try again.',
          );
        }
      }

      return tx.leaveRequest.create({
        data: {
          tenantId,
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          coverageEmployeeId,
          startDate: start,
          endDate: end,
          totalDays,
          reason: dto.reason,
          coverageNote,
          supportingDocumentName,
          supportingDocumentUrl,
          status: 'PENDING',
        },
        include: {
          leaveType: true,
          employee: { select: { firstName: true, lastName: true } },
          coverageEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    const detailLink = this.buildLeaveRequestDetailLink(
      actor.tenantSlug,
      request.id,
    );
    const platformLink = this.buildTenantWorkspaceLink(actor.tenantSlug);
    const notificationRecipients =
      await this.resolveLeaveNotificationRecipients(tenantId, empRecord);

    // Notify the employee's manager and active leave approvers (fire-and-forget)
    void this.notifyStakeholdersOfLeaveRequest(
      tenantId,
      request.id,
      empRecord,
      leaveType.name,
      dto.startDate,
      dto.endDate,
      totalDays,
      dto.reason,
      detailLink,
      platformLink,
      notificationRecipients,
      false,
    );

    return {
      request,
      message:
        notificationRecipients.manager &&
        notificationRecipients.approvers.length
          ? 'Leave request submitted. Your manager and the relevant leave approvers will be notified.'
          : notificationRecipients.manager
            ? 'Leave request submitted. Your manager will be notified.'
            : notificationRecipients.approvers.length
              ? 'Leave request submitted. The relevant leave approvers will be notified.'
              : 'Leave request submitted, but no manager or leave approver recipients are currently configured.',
      notificationSummary: {
        managerNotified: !!notificationRecipients.manager,
        approverCount: notificationRecipients.approvers.length,
        employeeNotified: false,
        autoApproved: false,
      },
    };
  }

  async getRequests(
    tenantId: string,
    actor: RequestUser,
    filters: {
      employeeId?: string;
      status?: string;
      scope?: 'all';
    },
  ) {
    const where: Prisma.LeaveRequestWhereInput = {
      tenantId,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.status
        ? { status: filters.status as LeaveRequestStatus }
        : {}),
    };

    if (filters.scope === 'all') {
      assertHrAccess(
        isCompanyAdminUser(actor) ||
          hasPermissionRule(actor, 'leave:VIEW') ||
          hasPermissionRule(actor, 'leave:APPROVE'),
      );
    } else if (isCompanyAdminUser(actor)) {
      // company-wide access
    } else if (hasPermissionRule(actor, 'leave:APPROVE')) {
      // company-wide access — can approve means can see all requests
    } else if (isEmployeeSelfServiceUser(actor)) {
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      where.employeeId = actorEmployee.id;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: { select: { name: true, isPaid: true } },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            avatarUrl: true,
          },
        },
        coverageEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Company-wide, read-only list of employees currently on approved leave.
   * Intentionally unrestricted (any authenticated tenant user) — it exposes
   * nothing beyond a boolean "on leave today" fact per employee, which the
   * employee directory surfaces to everyone regardless of role.
   */
  async getEmployeesOnLeaveToday(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { employeeId: true },
    });

    return {
      employeeIds: Array.from(new Set(requests.map((r) => r.employeeId))),
    };
  }

  async reviewRequest(
    tenantId: string,
    requestId: string,
    reviewer: RequestUser,
    dto: ReviewLeaveRequestDto,
  ) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId },
      include: {
        employee: { select: { id: true } },
        leaveType: {
          select: { requiresSupportingDocument: true },
        },
      },
    });

    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been reviewed');
    }

    assertHrAccess(
      isCompanyAdminUser(reviewer) ||
        hasPermissionRule(reviewer, 'leave:APPROVE'),
    );

    if (
      dto.action === 'APPROVED' &&
      request.leaveType.requiresSupportingDocument &&
      (!request.supportingDocumentName || !request.supportingDocumentUrl)
    ) {
      throw new BadRequestException(
        'A supporting document is required before this leave request can be approved.',
      );
    }

    const location = await this.resolveEmployeeHolidayLocation(
      tenantId,
      request.employeeId,
    );
    const years = [];
    for (
      let year = request.startDate.getFullYear();
      year <= request.endDate.getFullYear();
      year += 1
    ) {
      years.push(year);
    }
    await this.ensurePublicHolidaysSeededForLocation(tenantId, location, years);
    const { yearlyBreakdown } = await this.calculateWorkingDayBreakdown(
      tenantId,
      request.startDate,
      request.endDate,
      location,
    );

    const { updated, balanceMissing } = await this.prisma.$transaction(
      async (tx) => {
        const reviewed = await tx.leaveRequest.updateMany({
          where: { id: requestId, tenantId, status: 'PENDING' },
          data: {
            status: dto.action,
            ...(dto.action === 'APPROVED'
              ? { approvedBy: reviewer.id, approvedAt: new Date() }
              : {
                  rejectedBy: reviewer.id,
                  rejectedAt: new Date(),
                  rejectionNote: dto.note,
                }),
          },
        });

        if (reviewed.count !== 1) {
          throw new BadRequestException(
            'This request has already been reviewed',
          );
        }

        let anyBalanceMissing = false;

        for (const [year, affectedDays] of yearlyBreakdown.entries()) {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: request.employeeId,
                leaveTypeId: request.leaveTypeId,
                year,
              },
            },
          });

          if (!balance) {
            anyBalanceMissing = true;
            continue;
          }

          if (dto.action === 'APPROVED') {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                usedDays: { increment: affectedDays },
                pendingDays: { decrement: affectedDays },
              },
            });
          } else {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                pendingDays: { decrement: affectedDays },
                remainingDays: { increment: affectedDays },
              },
            });
          }
        }

        const updatedRequest = await tx.leaveRequest.findUnique({
          where: { id: requestId },
        });

        if (!updatedRequest) {
          throw new NotFoundException('Leave request not found');
        }

        return {
          updated: updatedRequest,
          balanceMissing: anyBalanceMissing,
        };
      },
    );

    if (balanceMissing) {
      this.logger.warn(
        `Leave balance not found for employee=${request.employeeId} leaveType=${request.leaveTypeId} on one or more leave years — balance counters not fully updated for request ${requestId}`,
      );
    }

    // Notify the employee of the decision (fire-and-forget)
    void this.notifyEmployeeOfLeaveDecision(
      tenantId,
      requestId,
      request.employeeId,
      request.leaveTypeId,
      reviewer.tenantSlug,
      dto.action,
      request.startDate,
      request.endDate,
      request.totalDays,
      dto.note,
    );

    return updated;
  }

  async updateRequestSupportingDocument(
    tenantId: string,
    requestId: string,
    actor: RequestUser,
    dto: UpdateLeaveRequestSupportingDocumentDto,
  ) {
    const empRecord = await this.prisma.employee.findFirst({
      where: { userId: actor.id, tenantId },
    });
    if (!empRecord) throw new NotFoundException('Employee profile not found');

    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId, employeeId: empRecord.id },
      include: {
        leaveType: { select: { requiresSupportingDocument: true } },
      },
    });

    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending leave requests can have supporting documents updated',
      );
    }

    const supportingDocumentName = dto.supportingDocumentName.trim();
    const supportingDocumentUrl = dto.supportingDocumentUrl.trim();

    if (!supportingDocumentName || !supportingDocumentUrl) {
      throw new BadRequestException(
        'Supporting document name and URL are required.',
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        supportingDocumentName,
        supportingDocumentUrl,
      },
    });

    return {
      message: request.leaveType.requiresSupportingDocument
        ? 'Supporting document attached. The request can now be reviewed for approval.'
        : 'Supporting document attached to the leave request.',
      request: updated,
    };
  }

  // ── Private notification helpers ─────────────────────────────────────────

  private buildLeaveRequestDetailLink(tenantSlug: string, requestId: string) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/leave?tab=requests&requestId=${encodeURIComponent(requestId)}`;
  }

  private buildTenantWorkspaceLink(tenantSlug: string) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/login`;
  }

  private buildLeaveRequestAppLink(requestId: string) {
    return `/hr/leave?tab=requests&requestId=${encodeURIComponent(requestId)}`;
  }

  private toLeaveNotificationRecipient(
    recipient: PermissionRecipient,
    source: LeaveNotificationRecipient['source'],
  ): LeaveNotificationRecipient {
    return {
      userId: recipient.userId,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      source,
    };
  }

  private dedupeLeaveRecipients(
    recipients: LeaveNotificationRecipient[],
  ): LeaveNotificationRecipient[] {
    const unique = new Map<string, LeaveNotificationRecipient>();

    for (const recipient of recipients) {
      const key = recipient.userId || recipient.email.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, recipient);
      }
    }

    return [...unique.values()];
  }

  private async resolveLeaveManagerRecipient(
    tenantId: string,
    employee: {
      managerId: string | null;
      departmentId: string | null;
    },
  ): Promise<LeaveNotificationRecipient | null> {
    let manager: {
      userId: string | null;
      email: string;
      firstName: string;
      lastName: string;
    } | null = null;

    if (employee.managerId) {
      manager = await this.prisma.employee.findFirst({
        where: { id: employee.managerId, tenantId },
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    if (!manager && employee.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: employee.departmentId, tenantId },
        select: { managerId: true },
      });
      if (dept?.managerId) {
        manager = await this.prisma.employee.findFirst({
          where: { id: dept.managerId, tenantId },
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });
      }
    }

    if (!manager?.email) {
      return null;
    }

    return {
      userId: manager.userId,
      email: manager.email,
      firstName: manager.firstName,
      lastName: manager.lastName,
      source: 'MANAGER',
    };
  }

  private async resolveLeaveNotificationRecipients(
    tenantId: string,
    employee: {
      id: string;
      userId?: string | null;
      firstName: string;
      lastName: string;
      managerId: string | null;
      departmentId: string | null;
    },
  ): Promise<LeaveNotificationRecipients> {
    const [manager, permissionRecipients] = await Promise.all([
      this.resolveLeaveManagerRecipient(tenantId, employee),
      this.rabbitmq.authResolvePermissionRecipients({
        tenantId,
        resource: 'leave',
        action: 'APPROVE',
        activeOnly: true,
      }),
    ]);

    const rawApprovers = this.dedupeLeaveRecipients(
      permissionRecipients
        .filter((recipient) => recipient.email)
        .filter((recipient) => recipient.userId !== employee.userId)
        .map((recipient) =>
          this.toLeaveNotificationRecipient(recipient, 'APPROVER'),
        ),
    );

    const managerIsApprover = rawApprovers.some((recipient) =>
      manager
        ? recipient.userId && manager.userId
          ? recipient.userId === manager.userId
          : recipient.email.toLowerCase() === manager.email.toLowerCase()
        : false,
    );

    const effectiveManager =
      manager && managerIsApprover
        ? { ...manager, source: 'APPROVER' as const }
        : manager;

    const approvers = rawApprovers.filter(
      (recipient) =>
        !effectiveManager ||
        (recipient.userId && effectiveManager.userId
          ? recipient.userId !== effectiveManager.userId
          : recipient.email.toLowerCase() !==
            effectiveManager.email.toLowerCase()),
    );

    const all = this.dedupeLeaveRecipients(
      [effectiveManager, ...approvers].filter(
        (recipient): recipient is LeaveNotificationRecipient =>
          recipient !== null,
      ),
    );

    return { manager: effectiveManager, approvers, all };
  }

  private async notifyStakeholdersOfLeaveRequest(
    tenantId: string,
    requestId: string,
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      managerId: string | null;
      departmentId: string | null;
    },
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    reason?: string,
    detailLink?: string,
    platformLink?: string,
    recipientsInput?: LeaveNotificationRecipients,
    autoApproved = false,
  ) {
    try {
      const recipients =
        recipientsInput ??
        (await this.resolveLeaveNotificationRecipients(tenantId, employee));
      if (recipients.all.length === 0) {
        this.logger.warn(
          `No manager or leave approver recipients found for tenant ${tenantId} — leave request notification skipped`,
        );
        return;
      }

      await Promise.all(
        recipients.all.map((recipient) =>
          this.rabbitmq.notificationLeaveRequested({
            tenantId,
            employeeId: employee.id,
            employeeFirstName: employee.firstName,
            employeeLastName: employee.lastName,
            managerEmail: recipient.email,
            leaveTypeName,
            startDate,
            endDate,
            totalDays,
            reason,
            detailLink:
              recipient.source === 'APPROVER' ? detailLink : undefined,
            platformLink:
              recipient.source === 'APPROVER' ? undefined : platformLink,
            autoApproved,
          }),
        ),
      );

      const inAppRecipients = recipients.all.filter(
        (recipient) => recipient.userId,
      );
      if (inAppRecipients.length > 0) {
        await this.rabbitmq.notificationInAppCreateMany(
          inAppRecipients.map((recipient) => ({
            tenantId,
            recipientUserId: recipient.userId!,
            type: 'LEAVE_REQUESTED',
            title: autoApproved
              ? 'Leave Automatically Approved'
              : 'Leave Request Submitted',
            message: autoApproved
              ? `${employee.firstName} ${employee.lastName}'s ${leaveTypeName} request from ${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')} was automatically approved.`
              : `${employee.firstName} ${employee.lastName} submitted a ${leaveTypeName} request from ${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')}.`,
            link: this.buildLeaveRequestAppLink(requestId),
            entityType: 'leaveRequest',
            entityId: requestId,
            sourceService: 'hr-service',
          })),
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to emit leave requested notification for employee ${employee.id}`,
        err,
      );
    }
  }

  private async notifyEmployeeOfLeaveDecision(
    tenantId: string,
    requestId: string,
    employeeId: string,
    leaveTypeId: string,
    tenantSlug: string,
    status: 'APPROVED' | 'REJECTED',
    startDate: Date,
    endDate: Date,
    totalDays: number,
    note?: string,
  ) {
    try {
      const [employee, leaveType] = await Promise.all([
        this.prisma.employee.findUnique({
          where: { id: employeeId },
          select: { email: true, firstName: true, userId: true },
        }),
        this.prisma.leaveType.findUnique({
          where: { id: leaveTypeId },
          select: { name: true },
        }),
      ]);

      if (!employee) {
        this.logger.warn(
          `Employee ${employeeId} not found — leave reviewed notification skipped`,
        );
        return;
      }

      const leaveTypeName = leaveType?.name ?? 'Leave';

      await this.rabbitmq.notificationLeaveReviewed({
        tenantId,
        employeeId,
        employeeEmail: employee.email,
        employeeFirstName: employee.firstName,
        status,
        leaveTypeName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
        note,
        platformLink: this.buildTenantWorkspaceLink(tenantSlug),
      });

      if (employee.userId) {
        await this.rabbitmq.notificationInAppCreate({
          tenantId,
          recipientUserId: employee.userId,
          type: 'LEAVE_REVIEWED',
          title:
            status === 'APPROVED'
              ? 'Leave Request Approved'
              : 'Leave Request Rejected',
          message:
            status === 'APPROVED'
              ? `Your ${leaveTypeName} request from ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')} was approved.`
              : `Your ${leaveTypeName} request from ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')} was rejected.`,
          link: this.buildLeaveRequestAppLink(requestId),
          entityType: 'leaveRequest',
          entityId: requestId,
          sourceService: 'hr-service',
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to emit leave reviewed notification for employee ${employeeId}`,
        err,
      );
    }
  }

  async cancelRequest(tenantId: string, requestId: string, actor: RequestUser) {
    const empRecord = await this.prisma.employee.findFirst({
      where: { userId: actor.id, tenantId },
    });
    if (!empRecord) throw new NotFoundException('Employee profile not found');

    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId, employeeId: empRecord.id },
      include: { leaveType: { select: { name: true } } },
    });

    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    const location = await this.resolveEmployeeHolidayLocation(
      tenantId,
      request.employeeId,
    );
    const years = [];
    for (
      let year = request.startDate.getFullYear();
      year <= request.endDate.getFullYear();
      year += 1
    ) {
      years.push(year);
    }
    await this.ensurePublicHolidaysSeededForLocation(tenantId, location, years);
    const { yearlyBreakdown } = await this.calculateWorkingDayBreakdown(
      tenantId,
      request.startDate,
      request.endDate,
      location,
    );

    for (const [year, affectedDays] of yearlyBreakdown.entries()) {
      await this.prisma.leaveBalance.updateMany({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
        data: {
          pendingDays: { decrement: affectedDays },
          remainingDays: { increment: affectedDays },
        },
      });
    }

    const notificationRecipients =
      await this.resolveLeaveNotificationRecipients(tenantId, empRecord);

    // Notify the manager and active leave approvers that the request was withdrawn.
    void this.notifyStakeholdersOfLeaveCancellation(
      tenantId,
      request.id,
      {
        id: empRecord.id,
        userId: empRecord.userId,
        firstName: empRecord.firstName,
        lastName: empRecord.lastName,
        managerId: empRecord.managerId,
        departmentId: empRecord.departmentId,
      },
      request.leaveType.name,
      request.startDate.toISOString(),
      request.endDate.toISOString(),
      request.totalDays,
      this.buildTenantWorkspaceLink(actor.tenantSlug),
      notificationRecipients,
    );

    return { message: 'Leave request cancelled' };
  }

  private async notifyStakeholdersOfLeaveCancellation(
    tenantId: string,
    requestId: string,
    employee: {
      id: string;
      userId?: string | null;
      firstName: string;
      lastName: string;
      managerId: string | null;
      departmentId: string | null;
    },
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    platformLink?: string,
    recipientsInput?: LeaveNotificationRecipients,
  ) {
    try {
      const recipients =
        recipientsInput ??
        (await this.resolveLeaveNotificationRecipients(tenantId, employee));

      if (recipients.all.length === 0) {
        this.logger.warn(
          `No manager or leave approver recipients found for tenant ${tenantId} — leave cancellation notification skipped`,
        );
        return;
      }

      await Promise.all(
        recipients.all.map((recipient) =>
          this.rabbitmq.notificationLeaveCancelled({
            tenantId,
            employeeId: employee.id,
            employeeFirstName: employee.firstName,
            employeeLastName: employee.lastName,
            managerEmail: recipient.email,
            leaveTypeName,
            startDate,
            endDate,
            totalDays,
            platformLink,
          }),
        ),
      );

      const inAppRecipients = recipients.all.filter(
        (recipient) => recipient.userId,
      );
      if (inAppRecipients.length > 0) {
        await this.rabbitmq.notificationInAppCreateMany(
          inAppRecipients.map((recipient) => ({
            tenantId,
            recipientUserId: recipient.userId!,
            type: 'LEAVE_CANCELLED',
            title: 'Leave Request Cancelled',
            message: `${employee.firstName} ${employee.lastName} cancelled a ${leaveTypeName} request from ${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')}.`,
            link: this.buildLeaveRequestAppLink(requestId),
            entityType: 'leaveRequest',
            entityId: requestId,
            sourceService: 'hr-service',
          })),
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to emit leave cancelled notification for employee ${employee.id}`,
        err,
      );
    }
  }
}
