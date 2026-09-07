import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  async getRecent(userId: string, tenantId: string) {
    return this.prisma.notification.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string, tenantId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, tenantId, isRead: false },
    });
    return { count };
  }

  async getAll(
    userId: string,
    tenantId: string,
    filter?: string,
    page = 1,
    limit = 25,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where: Prisma.NotificationWhereInput = {
      userId,
      tenantId,
      ...(filter === 'read' ? { isRead: true } : {}),
      ...(filter === 'unread' ? { isRead: false } : {}),
    };

    const skip = (safePage - 1) * safeLimit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip,
      }),
      this.prisma.notification.count({ where }),
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

  async markRead(userId: string, tenantId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string, tenantId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  async delete(userId: string, tenantId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted successfully' };
  }

  async create(data: {
    tenantId: string;
    userId: string;
    type: string;
    title?: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
    entityType?: string;
    entityId?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  }) {
    try {
      await this.rabbitmq.notificationInAppCreate({
        tenantId: data.tenantId,
        recipientUserId: data.userId,
        type: data.type,
        title: data.title ?? this.titleFromType(data.type),
        message: data.message,
        link: data.link,
        metadata: data.metadata,
        entityType: data.entityType,
        entityId: data.entityId,
        sourceService: 'hr-service',
        priority: data.priority,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish in-app notification ${data.type} for user ${data.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async createMany(
    notifications: {
      tenantId: string;
      userId: string;
      type: string;
      title?: string;
      message: string;
      link?: string;
      metadata?: Record<string, unknown>;
      entityType?: string;
      entityId?: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    }[],
  ) {
    try {
      await this.rabbitmq.notificationInAppCreateMany(
        notifications.map((notification) => ({
          tenantId: notification.tenantId,
          recipientUserId: notification.userId,
          type: notification.type,
          title: notification.title ?? this.titleFromType(notification.type),
          message: notification.message,
          link: notification.link,
          metadata: notification.metadata,
          entityType: notification.entityType,
          entityId: notification.entityId,
          sourceService: 'hr-service',
          priority: notification.priority,
        })),
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish ${notifications.length} in-app notification(s)`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return { count: notifications.length };
  }

  private titleFromType(type: string) {
    return type
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
