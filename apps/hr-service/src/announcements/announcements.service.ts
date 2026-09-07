import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementDeliveryChannel,
  EmploymentStatus,
  Prisma,
} from '../../prisma/generated/client';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { hasPermissionRule, isCompanyAdminUser } from '../auth/access-scope';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { QueryAnnouncementsDto } from './dto/query-announcements.dto';

type AnnouncementActorContext = {
  employeeId: string | null;
  departmentId: string | null;
  branchId: string | null;
};

type AnnouncementNotificationRecipient = {
  employeeId: string;
  userId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
};

type AnnouncementRecipientResolution = {
  recipients: AnnouncementNotificationRecipient[];
  skippedSms: {
    missingPhone: number;
    invalidPhone: number;
  };
};

type AnnouncementAudienceSelection = {
  audienceType: AnnouncementAudienceType;
  targetDepartmentIds: string[];
  targetBranchIds: string[];
  targetEmployeeIds: string[];
};

type AnnouncementReadState = {
  isRead: boolean;
  readAt: Date | null;
};

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly encryption: FieldEncryptionService,
  ) {}

  private canManageAnnouncements(actor: RequestUser): boolean {
    return (
      isCompanyAdminUser(actor) ||
      hasPermissionRule(actor, 'announcements:CREATE') ||
      hasPermissionRule(actor, 'announcements:EDIT') ||
      hasPermissionRule(actor, 'announcements:DELETE')
    );
  }

  private canReadAnnouncements(actor: RequestUser): boolean {
    return (
      this.canManageAnnouncements(actor) ||
      hasPermissionRule(actor, 'announcements:VIEW')
    );
  }

  private buildTenantWorkspaceLink(tenantSlug: string): string {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/login`;
  }

  private normalizeIdList(values?: string[]): string[] {
    return [...new Set((values ?? []).map((value) => value.trim()))].filter(
      (value) => value.length > 0,
    );
  }

  private normalizeDeliveryChannels(
    dto: CreateAnnouncementDto,
  ): AnnouncementDeliveryChannel[] {
    const requestedChannels =
      dto.deliveryChannels && dto.deliveryChannels.length > 0
        ? dto.deliveryChannels
        : dto.sendEmail
          ? [
              AnnouncementDeliveryChannel.IN_APP,
              AnnouncementDeliveryChannel.EMAIL,
            ]
          : [AnnouncementDeliveryChannel.IN_APP];

    return [
      ...new Set([AnnouncementDeliveryChannel.IN_APP, ...requestedChannels]),
    ];
  }

  private shouldPublishExternalAnnouncementDelivery(
    deliveryChannels: AnnouncementDeliveryChannel[],
  ): boolean {
    return (
      deliveryChannels.includes(AnnouncementDeliveryChannel.EMAIL) ||
      deliveryChannels.includes(AnnouncementDeliveryChannel.SMS)
    );
  }

  private normalizeSmsPhone(phone: string | null | undefined): string | null {
    if (!phone) {
      return null;
    }

    const normalized = phone.replace(/[\s\-()]/g, '');
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null;
  }

  private async getActorContext(
    tenantId: string,
    actor: RequestUser,
  ): Promise<AnnouncementActorContext> {
    if (isCompanyAdminUser(actor)) {
      return { employeeId: null, departmentId: null, branchId: null };
    }

    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: actor.id },
      select: { id: true, departmentId: true, branchId: true },
    });

    if (!employee) {
      return { employeeId: null, departmentId: null, branchId: null };
    }

    return {
      employeeId: employee.id,
      departmentId: employee.departmentId ?? null,
      branchId: employee.branchId ?? null,
    };
  }

  private async normalizeAudienceSelection(
    tenantId: string,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementAudienceSelection> {
    const audienceType = dto.audienceType ?? AnnouncementAudienceType.ALL;
    const targetDepartmentIds = this.normalizeIdList(dto.departmentIds);
    const targetBranchIds = this.normalizeIdList(dto.branchIds);
    const targetEmployeeIds = this.normalizeIdList(dto.employeeIds);

    if (audienceType === AnnouncementAudienceType.ALL) {
      return {
        audienceType,
        targetDepartmentIds: [],
        targetBranchIds: [],
        targetEmployeeIds: [],
      };
    }

    if (audienceType === AnnouncementAudienceType.DEPARTMENTS) {
      if (targetDepartmentIds.length === 0) {
        throw new BadRequestException(
          'departmentIds is required when targeting departments.',
        );
      }

      const departments = await this.prisma.department.findMany({
        where: { tenantId, id: { in: targetDepartmentIds }, isActive: true },
        select: { id: true },
      });

      if (departments.length !== targetDepartmentIds.length) {
        throw new BadRequestException(
          'One or more departmentIds are invalid for this tenant.',
        );
      }

      return {
        audienceType,
        targetDepartmentIds,
        targetBranchIds: [],
        targetEmployeeIds: [],
      };
    }

    if (audienceType === AnnouncementAudienceType.BRANCHES) {
      if (targetBranchIds.length === 0) {
        throw new BadRequestException(
          'branchIds is required when targeting branches.',
        );
      }

      const branches = await this.prisma.branch.findMany({
        where: { tenantId, id: { in: targetBranchIds }, isActive: true },
        select: { id: true },
      });

      if (branches.length !== targetBranchIds.length) {
        throw new BadRequestException(
          'One or more branchIds are invalid for this tenant.',
        );
      }

      return {
        audienceType,
        targetDepartmentIds: [],
        targetBranchIds,
        targetEmployeeIds: [],
      };
    }

    if (targetEmployeeIds.length === 0) {
      throw new BadRequestException(
        'employeeIds is required when targeting employees.',
      );
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        id: { in: targetEmployeeIds },
        employmentStatus: { not: EmploymentStatus.OFFBOARDED },
      },
      select: { id: true },
    });

    if (employees.length !== targetEmployeeIds.length) {
      throw new BadRequestException(
        'One or more employeeIds are invalid for this tenant.',
      );
    }

    return {
      audienceType,
      targetDepartmentIds: [],
      targetBranchIds: [],
      targetEmployeeIds,
    };
  }

  private buildVisibilityWhere(
    tenantId: string,
    actorContext: AnnouncementActorContext,
    query: QueryAnnouncementsDto,
    canManage: boolean,
  ): Prisma.AnnouncementWhereInput {
    const where: Prisma.AnnouncementWhereInput = { tenantId };
    const andClauses: Prisma.AnnouncementWhereInput[] = [];

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.audienceType) {
      where.audienceType = query.audienceType;
    }

    if (query.sendEmail !== undefined) {
      where.sendEmail = query.sendEmail;
    }

    if (!query.includeExpired) {
      andClauses.push({
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      });
    }

    const wantsAll =
      query.view === 'all' || (canManage && query.view !== 'visible');
    if (wantsAll && !canManage) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }

    if (canManage && wantsAll) {
      if (andClauses.length > 0) {
        where.AND = andClauses;
      }
      return where;
    }

    const audienceClauses: Prisma.AnnouncementWhereInput[] = [
      { audienceType: AnnouncementAudienceType.ALL },
    ];

    if (actorContext.departmentId) {
      audienceClauses.push({
        audienceType: AnnouncementAudienceType.DEPARTMENTS,
        targetDepartmentIds: { has: actorContext.departmentId },
      });
    }

    if (actorContext.branchId) {
      audienceClauses.push({
        audienceType: AnnouncementAudienceType.BRANCHES,
        targetBranchIds: { has: actorContext.branchId },
      });
    }

    if (actorContext.employeeId) {
      audienceClauses.push({
        audienceType: AnnouncementAudienceType.EMPLOYEES,
        targetEmployeeIds: { has: actorContext.employeeId },
      });
    }

    andClauses.push({ OR: audienceClauses });
    if (andClauses.length > 0) {
      where.AND = andClauses;
    }
    return where;
  }

  private applyReadFilter(
    where: Prisma.AnnouncementWhereInput,
    tenantId: string,
    userId: string,
    read?: QueryAnnouncementsDto['read'],
  ) {
    if (read === 'read') {
      where.readReceipts = { some: { tenantId, userId } };
    }

    if (read === 'unread') {
      where.readReceipts = { none: { tenantId, userId } };
    }
  }

  private async buildVisibleWhereForActor(
    tenantId: string,
    actor: RequestUser,
    query: QueryAnnouncementsDto = {},
  ): Promise<Prisma.AnnouncementWhereInput> {
    const canManage = this.canManageAnnouncements(actor);
    if (!this.canReadAnnouncements(actor)) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }

    const actorContext = await this.getActorContext(tenantId, actor);
    return this.buildVisibilityWhere(tenantId, actorContext, query, canManage);
  }

  private async attachReadState<T extends Announcement>(
    tenantId: string,
    userId: string,
    announcements: T[],
  ): Promise<Array<T & AnnouncementReadState>> {
    if (announcements.length === 0) {
      return [];
    }

    const receipts = await this.prisma.announcementReadReceipt.findMany({
      where: {
        tenantId,
        userId,
        announcementId: { in: announcements.map((item) => item.id) },
      },
      select: { announcementId: true, readAt: true },
    });
    const readAtByAnnouncementId = new Map(
      receipts.map((receipt) => [receipt.announcementId, receipt.readAt]),
    );

    return announcements.map((announcement) => {
      const readAt = readAtByAnnouncementId.get(announcement.id) ?? null;
      return {
        ...announcement,
        isRead: readAt !== null,
        readAt,
      };
    });
  }

  private async resolveAnnouncementRecipients(
    tenantId: string,
    announcement: Pick<
      Announcement,
      | 'audienceType'
      | 'targetDepartmentIds'
      | 'targetBranchIds'
      | 'targetEmployeeIds'
    >,
    options: {
      includeEmail: boolean;
      includeSms: boolean;
    },
  ): Promise<AnnouncementRecipientResolution> {
    const employeeWhere: Prisma.EmployeeWhereInput = {
      tenantId,
      employmentStatus: {
        in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
      },
      userId: { not: null },
      email: { not: '' },
    };

    if (announcement.audienceType === AnnouncementAudienceType.DEPARTMENTS) {
      employeeWhere.departmentId = { in: announcement.targetDepartmentIds };
    } else if (
      announcement.audienceType === AnnouncementAudienceType.BRANCHES
    ) {
      employeeWhere.branchId = { in: announcement.targetBranchIds };
    } else if (
      announcement.audienceType === AnnouncementAudienceType.EMPLOYEES
    ) {
      employeeWhere.id = { in: announcement.targetEmployeeIds };
    }

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        userId: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
      },
    });

    if (employees.length === 0) {
      return {
        recipients: [],
        skippedSms: { missingPhone: 0, invalidPhone: 0 },
      };
    }

    const statuses = await this.rabbitmq.authGetUserStatuses({
      tenantId,
      userIds: employees
        .map((employee) => employee.userId)
        .filter((userId): userId is string => !!userId),
    });
    const activeUserIds = new Set(
      statuses
        .filter((status) => status.status === 'ACTIVE')
        .map((status) => status.userId),
    );

    const skippedSms = { missingPhone: 0, invalidPhone: 0 };
    const recipients = employees
      .filter(
        (employee): employee is typeof employee & { userId: string } =>
          !!employee.userId && activeUserIds.has(employee.userId),
      )
      .flatMap((employee) => {
        const recipient: AnnouncementNotificationRecipient = {
          employeeId: employee.id,
          userId: employee.userId,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
        };

        if (options.includeSms) {
          let decryptedPhone: string | null | undefined;
          let decryptionFailed = false;

          try {
            decryptedPhone = this.encryption.decrypt(employee.phone);
          } catch {
            skippedSms.invalidPhone += 1;
            decryptionFailed = true;
          }

          if (!decryptionFailed && decryptedPhone == null) {
            skippedSms.missingPhone += 1;
          } else if (!decryptionFailed) {
            const phone = this.normalizeSmsPhone(decryptedPhone);

            if (phone) {
              recipient.phone = phone;
            } else {
              skippedSms.invalidPhone += 1;
            }
          }
        }

        if (options.includeEmail || recipient.phone) {
          return [recipient];
        }

        return [];
      });

    return { recipients, skippedSms };
  }

  async create(
    tenantId: string,
    actor: RequestUser,
    dto: CreateAnnouncementDto,
  ) {
    const audience = await this.normalizeAudienceSelection(tenantId, dto);
    const deliveryChannels = this.normalizeDeliveryChannels(dto);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future.');
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        sendEmail: deliveryChannels.includes(AnnouncementDeliveryChannel.EMAIL),
        deliveryChannels,
        expiresAt,
        createdById: actor.id,
        ...audience,
      },
    });

    if (
      this.shouldPublishExternalAnnouncementDelivery(
        announcement.deliveryChannels,
      )
    ) {
      void this.publishAnnouncementExternalDelivery(
        tenantId,
        actor,
        announcement,
      );
    }

    return announcement;
  }

  async findAll(
    tenantId: string,
    actor: RequestUser,
    query: QueryAnnouncementsDto,
  ) {
    const where = await this.buildVisibleWhereForActor(tenantId, actor, query);
    this.applyReadFilter(where, tenantId, actor.id, query.read);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      items: await this.attachReadState(tenantId, actor.id, items),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findVisibleForDashboard(
    tenantId: string,
    actor: RequestUser,
    limit = 3,
  ) {
    if (!this.canReadAnnouncements(actor)) {
      return [];
    }

    const where = await this.buildVisibleWhereForActor(tenantId, actor);

    const announcements = await this.prisma.announcement.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        publishedAt: true,
      },
    });

    const receipts = await this.prisma.announcementReadReceipt.findMany({
      where: {
        tenantId,
        userId: actor.id,
        announcementId: { in: announcements.map((item) => item.id) },
      },
      select: { announcementId: true, readAt: true },
    });
    const readAtByAnnouncementId = new Map(
      receipts.map((receipt) => [receipt.announcementId, receipt.readAt]),
    );

    return announcements.map((announcement) => {
      const readAt = readAtByAnnouncementId.get(announcement.id) ?? null;
      return {
        ...announcement,
        isRead: readAt !== null,
        readAt,
      };
    });
  }

  async getUnreadCount(tenantId: string, actor: RequestUser) {
    const visibleWhere = await this.buildVisibleWhereForActor(tenantId, actor);
    const count = await this.prisma.announcement.count({
      where: {
        AND: [
          visibleWhere,
          {
            readReceipts: {
              none: { tenantId, userId: actor.id },
            },
          },
        ],
      },
    });

    return { count };
  }

  async markRead(tenantId: string, actor: RequestUser, id: string) {
    const visibleWhere = await this.buildVisibleWhereForActor(tenantId, actor);
    const announcement = await this.prisma.announcement.findFirst({
      where: { AND: [visibleWhere, { id, tenantId }] },
      select: { id: true },
    });

    if (!announcement) throw new NotFoundException('Announcement not found');

    const receipt = await this.prisma.announcementReadReceipt.upsert({
      where: {
        tenantId_announcementId_userId: {
          tenantId,
          announcementId: id,
          userId: actor.id,
        },
      },
      update: { readAt: new Date() },
      create: { tenantId, announcementId: id, userId: actor.id },
    });

    return { message: 'Announcement marked as read', readAt: receipt.readAt };
  }

  async markAllRead(tenantId: string, actor: RequestUser) {
    const visibleWhere = await this.buildVisibleWhereForActor(tenantId, actor);
    const announcements = await this.prisma.announcement.findMany({
      where: {
        AND: [
          visibleWhere,
          {
            readReceipts: {
              none: { tenantId, userId: actor.id },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (announcements.length === 0) {
      return { message: 'All announcements marked as read', count: 0 };
    }

    const now = new Date();
    const result = await this.prisma.announcementReadReceipt.createMany({
      data: announcements.map((announcement) => ({
        id: randomUUID(),
        tenantId,
        announcementId: announcement.id,
        userId: actor.id,
        readAt: now,
      })),
      skipDuplicates: true,
    });

    return {
      message: 'All announcements marked as read',
      count: result.count,
    };
  }

  async remove(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { message: 'Announcement deleted successfully' };
  }

  private async publishAnnouncementExternalDelivery(
    tenantId: string,
    actor: RequestUser,
    announcement: Announcement,
  ) {
    try {
      const shouldSendEmail = announcement.deliveryChannels.includes(
        AnnouncementDeliveryChannel.EMAIL,
      );
      const shouldSendSms = announcement.deliveryChannels.includes(
        AnnouncementDeliveryChannel.SMS,
      );
      const { recipients, skippedSms } =
        await this.resolveAnnouncementRecipients(tenantId, announcement, {
          includeEmail: shouldSendEmail,
          includeSms: shouldSendSms,
        });

      if (recipients.length === 0) {
        this.logger.warn(
          `Announcement ${announcement.id} requested external delivery but no active recipients were resolved.`,
        );
        if (!shouldSendSms) {
          return;
        }
      }

      if (shouldSendSms) {
        this.logger.log(
          `Announcement ${announcement.id} SMS recipient resolution skipped ${skippedSms.missingPhone} missing phone(s) and ${skippedSms.invalidPhone} invalid phone(s).`,
        );
      }

      await this.rabbitmq.notificationAnnouncementPublished({
        tenantId,
        announcementId: announcement.id,
        tenantName: actor.tenantName,
        title: announcement.title,
        body: announcement.body,
        publishedAt: announcement.publishedAt.toISOString(),
        deliveryChannels: announcement.deliveryChannels,
        platformLink: this.buildTenantWorkspaceLink(actor.tenantSlug),
        recipients,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish announcement external delivery fanout for ${announcement.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
