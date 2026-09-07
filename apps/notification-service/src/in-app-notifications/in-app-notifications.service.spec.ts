/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
import {
  InAppNotificationPriority,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { InAppNotificationsService } from './in-app-notifications.service';

type PrismaCall<TData extends object = Record<string, unknown>> = {
  data: TData;
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
};

describe('InAppNotificationsService', () => {
  const prisma = {
    inAppNotification: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  let service: InAppNotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InAppNotificationsService(prisma as unknown as PrismaService);
  });

  it('creates an in-app notification with tenant and recipient scope', async () => {
    prisma.inAppNotification.create.mockResolvedValue({ id: 'notif-1' });

    await service.create({
      eventId: 'evt-1',
      tenantId: 'tenant-1',
      recipientUserId: 'user-1',
      type: 'LEAVE_REQUESTED',
      title: 'Leave Request Submitted',
      message: 'A leave request needs review.',
      link: '/hr/leave/requests/leave-1',
      entityType: 'leaveRequest',
      entityId: 'leave-1',
      sourceService: 'hr-service',
    });

    const createArg = prisma.inAppNotification.create.mock
      .calls[0][0] as PrismaCall;
    expect(createArg.data).toMatchObject({
      eventId: 'evt-1',
      tenantId: 'tenant-1',
      recipientUserId: 'user-1',
      priority: InAppNotificationPriority.NORMAL,
    });
  });

  it('handles duplicate event ids idempotently', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    prisma.inAppNotification.create.mockRejectedValue(duplicate);
    prisma.inAppNotification.findUniqueOrThrow.mockResolvedValue({
      id: 'existing-notif',
    });

    const result = await service.create({
      eventId: 'evt-1',
      tenantId: 'tenant-1',
      recipientUserId: 'user-1',
      type: 'LEAVE_REQUESTED',
      title: 'Leave Request Submitted',
      message: 'A leave request needs review.',
    });

    expect(result).toEqual({ id: 'existing-notif' });
    expect(prisma.inAppNotification.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { eventId: 'evt-1' },
    });
  });

  it('lists only current tenant and current user unarchived notifications', async () => {
    prisma.inAppNotification.findMany.mockResolvedValue([]);
    prisma.inAppNotification.count.mockResolvedValue(0);

    await service.getAll('user-1', 'tenant-1', 'unread', 2, 10);

    const findManyArg = prisma.inAppNotification.findMany.mock
      .calls[0][0] as PrismaCall;
    expect(findManyArg.where).toEqual({
      recipientUserId: 'user-1',
      tenantId: 'tenant-1',
      archivedAt: null,
      isRead: false,
    });
    expect(findManyArg.skip).toBe(10);
    expect(findManyArg.take).toBe(10);
  });

  it('counts unread notifications for only the current tenant and user', async () => {
    prisma.inAppNotification.count.mockResolvedValue(3);

    await expect(service.getUnreadCount('user-1', 'tenant-1')).resolves.toEqual(
      { count: 3 },
    );

    expect(prisma.inAppNotification.count).toHaveBeenCalledWith({
      where: {
        recipientUserId: 'user-1',
        tenantId: 'tenant-1',
        isRead: false,
        archivedAt: null,
      },
    });
  });

  it('marks only an owned notification as read', async () => {
    prisma.inAppNotification.findFirst.mockResolvedValue({
      id: 'notif-1',
      isRead: false,
    });
    prisma.inAppNotification.update.mockResolvedValue({ id: 'notif-1' });

    await service.markRead('user-1', 'tenant-1', 'notif-1');

    expect(prisma.inAppNotification.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'notif-1',
        recipientUserId: 'user-1',
        tenantId: 'tenant-1',
        archivedAt: null,
      },
    });
    const updateArg = prisma.inAppNotification.update.mock
      .calls[0][0] as PrismaCall<{ isRead: boolean; readAt: Date }>;
    expect(updateArg.where).toEqual({ id: 'notif-1' });
    expect(updateArg.data.isRead).toBe(true);
    expect(updateArg.data.readAt).toBeInstanceOf(Date);
  });

  it('rejects cross-user or cross-tenant mark read attempts', async () => {
    prisma.inAppNotification.findFirst.mockResolvedValue(null);

    await expect(
      service.markRead('user-1', 'tenant-1', 'notif-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks all unread notifications for only the current tenant and user', async () => {
    prisma.inAppNotification.updateMany.mockResolvedValue({ count: 2 });

    await service.markAllRead('user-1', 'tenant-1');

    const updateManyArg = prisma.inAppNotification.updateMany.mock
      .calls[0][0] as PrismaCall<{ isRead: boolean; readAt: Date }>;
    expect(updateManyArg.where).toEqual({
      recipientUserId: 'user-1',
      tenantId: 'tenant-1',
      isRead: false,
      archivedAt: null,
    });
    expect(updateManyArg.data.isRead).toBe(true);
    expect(updateManyArg.data.readAt).toBeInstanceOf(Date);
  });

  it('archives instead of hard deleting', async () => {
    prisma.inAppNotification.findFirst.mockResolvedValue({
      id: 'notif-1',
      isRead: false,
    });
    prisma.inAppNotification.update.mockResolvedValue({ id: 'notif-1' });

    await service.archive('user-1', 'tenant-1', 'notif-1');

    const updateArg = prisma.inAppNotification.update.mock
      .calls[0][0] as PrismaCall<{ archivedAt: Date }>;
    expect(updateArg.where).toEqual({ id: 'notif-1' });
    expect(updateArg.data.archivedAt).toBeInstanceOf(Date);
  });
});
