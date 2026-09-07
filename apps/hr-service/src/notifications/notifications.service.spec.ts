import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  };
  const rabbitmq = {
    notificationInAppCreate: jest.fn(),
    notificationInAppCreateMany: jest.fn(),
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prisma as any, rabbitmq as any);
    jest.spyOn((service as any).logger, 'error').mockImplementation(jest.fn());
  });

  it('publishes legacy create calls to notification-service in-app events', async () => {
    rabbitmq.notificationInAppCreate.mockResolvedValue(undefined);

    await service.create({
      tenantId: 'tenant-1',
      userId: 'user-1',
      type: 'LEAVE_REQUESTED',
      message: 'A leave request needs review.',
      link: '/hr/leave/requests/leave-1',
    });

    expect(rabbitmq.notificationInAppCreate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recipientUserId: 'user-1',
      type: 'LEAVE_REQUESTED',
      title: 'Leave Requested',
      message: 'A leave request needs review.',
      link: '/hr/leave/requests/leave-1',
      metadata: undefined,
      entityType: undefined,
      entityId: undefined,
      sourceService: 'hr-service',
      priority: undefined,
    });
  });

  it('does not fail business callers when event publishing fails', async () => {
    rabbitmq.notificationInAppCreateMany.mockRejectedValue(
      new Error('RabbitMQ unavailable'),
    );

    await expect(
      service.createMany([
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: 'PAYROLL_DECISION',
          message: 'Payroll approved.',
        },
      ]),
    ).resolves.toEqual({ count: 1 });
  });

  it('marks only the current user tenant notification as read', async () => {
    const notification = {
      id: 'notification-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      isRead: false,
    };
    prisma.notification.findFirst.mockResolvedValueOnce(notification);
    prisma.notification.update.mockResolvedValueOnce({
      ...notification,
      isRead: true,
      readAt: new Date('2026-05-28T10:00:00Z'),
    });

    await service.markRead('user-1', 'tenant-1', 'notification-1');

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'notification-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
      },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('marks all unread notifications for only the current tenant/user', async () => {
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await service.markAllRead('user-1', 'tenant-1');

    expect(result).toEqual({ message: 'All notifications marked as read' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', tenantId: 'tenant-1', isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});
