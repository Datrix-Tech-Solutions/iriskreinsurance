import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InAppNotificationPriority,
  Prisma,
} from '../../prisma/generated/client';
import { InAppNotificationCreateEvent } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';

type CreateInAppNotificationInput = InAppNotificationCreateEvent & {
  eventId?: string;
};

@Injectable()
export class InAppNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInAppNotificationInput) {
    const createData = {
      eventId: data.eventId,
      tenantId: data.tenantId,
      recipientUserId: data.recipientUserId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
      entityType: data.entityType,
      entityId: data.entityId,
      sourceService: data.sourceService,
      priority: data.priority ?? InAppNotificationPriority.NORMAL,
    };

    try {
      return await this.prisma.inAppNotification.create({ data: createData });
    } catch (error) {
      if (this.isUniqueEventConflict(error) && data.eventId) {
        return this.prisma.inAppNotification.findUniqueOrThrow({
          where: { eventId: data.eventId },
        });
      }

      throw error;
    }
  }

  async getRecent(recipientUserId: string, tenantId: string) {
    return this.prisma.inAppNotification.findMany({
      where: { recipientUserId, tenantId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(recipientUserId: string, tenantId: string) {
    const count = await this.prisma.inAppNotification.count({
      where: { recipientUserId, tenantId, isRead: false, archivedAt: null },
    });

    return { count };
  }

  async getAll(
    recipientUserId: string,
    tenantId: string,
    filter?: 'read' | 'unread',
    page = 1,
    limit = 25,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where: Prisma.InAppNotificationWhereInput = {
      recipientUserId,
      tenantId,
      archivedAt: null,
      ...(filter === 'read' ? { isRead: true } : {}),
      ...(filter === 'unread' ? { isRead: false } : {}),
    };
    const skip = (safePage - 1) * safeLimit;

    const [notifications, total] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip,
      }),
      this.prisma.inAppNotification.count({ where }),
    ]);

    return {
      notifications,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async markRead(recipientUserId: string, tenantId: string, id: string) {
    const notification = await this.findOwnedNotification(
      recipientUserId,
      tenantId,
      id,
    );

    if (notification.isRead) return notification;

    return this.prisma.inAppNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(recipientUserId: string, tenantId: string) {
    await this.prisma.inAppNotification.updateMany({
      where: { recipientUserId, tenantId, isRead: false, archivedAt: null },
      data: { isRead: true, readAt: new Date() },
    });

    return { message: 'All notifications marked as read' };
  }

  async archive(recipientUserId: string, tenantId: string, id: string) {
    await this.findOwnedNotification(recipientUserId, tenantId, id);

    await this.prisma.inAppNotification.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return { message: 'Notification archived successfully' };
  }

  private async findOwnedNotification(
    recipientUserId: string,
    tenantId: string,
    id: string,
  ) {
    const notification = await this.prisma.inAppNotification.findFirst({
      where: { id, recipientUserId, tenantId, archivedAt: null },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    return notification;
  }

  private isUniqueEventConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
