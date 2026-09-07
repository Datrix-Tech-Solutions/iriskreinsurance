import { NotificationService } from './notification.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import { PrismaService } from '../prisma/prisma.service';

type NotificationLogCreateArgs = {
  data: Record<string, unknown>;
};

describe('NotificationService announcement delivery channels', () => {
  const notificationLogCreate = jest.fn<
    Promise<unknown>,
    [NotificationLogCreateArgs]
  >();
  const prisma = {
    notificationLog: {
      findFirst: jest.fn(),
      create: notificationLogCreate,
    },
  };
  const email = {
    sendAnnouncementPublishedNotification: jest.fn(),
    sendEmployeeInviteEmail: jest.fn(),
    sendTenantAdminWelcomeEmail: jest.fn(),
  };
  const sms = {
    sendMessage: jest.fn(),
    sendOtp: jest.fn(),
  };

  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationLogCreate.mockResolvedValue({});
    email.sendAnnouncementPublishedNotification.mockResolvedValue(true);
    email.sendEmployeeInviteEmail.mockResolvedValue(true);
    email.sendTenantAdminWelcomeEmail.mockResolvedValue(true);
    sms.sendMessage.mockResolvedValue({
      success: true,
      status: 'SENT',
      provider: 'termii',
      providerStatus: 'ok',
    });
    sms.sendOtp.mockResolvedValue({
      success: true,
      status: 'SENT',
      provider: 'termii',
      providerStatus: 'ok',
    });
    service = new NotificationService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      sms as unknown as SmsService,
    );
  });

  const baseAnnouncement = {
    tenantId: 'tenant-1',
    tenantName: 'Acme',
    announcementId: 'ann-1',
    title: 'Office closure',
    body: 'The office will be closed on Friday for maintenance.',
    publishedAt: '2026-06-02T10:00:00.000Z',
    platformLink: 'https://app.workphelo.test/acme/login',
  };

  const recipient = {
    employeeId: 'emp-1',
    userId: 'user-1',
    email: 'ama@acme.test',
    phone: '+233244000001',
    firstName: 'Ama',
    lastName: 'Mensah',
  };

  const notificationLogEntries = () =>
    notificationLogCreate.mock.calls.map(([entry]) => entry.data);

  it('keeps legacy email announcement delivery when deliveryChannels is omitted', async () => {
    await service.sendAnnouncementPublishedNotification({
      ...baseAnnouncement,
      recipients: [recipient],
    });

    expect(email.sendAnnouncementPublishedNotification).toHaveBeenCalledWith(
      recipient.email,
      recipient.firstName,
      baseAnnouncement.title,
      baseAnnouncement.body,
      baseAnnouncement.publishedAt,
      baseAnnouncement.platformLink,
    );
    expect(sms.sendMessage).not.toHaveBeenCalled();
    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        userId: recipient.userId,
        tenantId: baseAnnouncement.tenantId,
        type: 'ANNOUNCEMENT_PUBLISHED',
        channel: 'EMAIL',
        recipient: recipient.email,
        status: 'SENT',
      }),
    );
  });

  it('suppresses duplicate new invite emails but allows explicit invite resends', async () => {
    prisma.notificationLog.findFirst.mockResolvedValueOnce({ id: 'log-1' });

    await service.sendInvite({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'ama@acme.test',
      firstName: 'Ama',
      tenantName: 'Acme',
      acceptInviteUrl:
        'https://app.workphelo.test/acme/accept-invite?token=old',
      inviteKind: 'EMPLOYEE',
    });

    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();

    await service.sendInvite({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'ama@acme.test',
      firstName: 'Ama',
      tenantName: 'Acme',
      acceptInviteUrl:
        'https://app.workphelo.test/acme/accept-invite?token=new',
      inviteKind: 'EMPLOYEE',
      isResend: true,
    });

    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledWith(
      'ama@acme.test',
      'Ama',
      'Acme',
      'https://app.workphelo.test/acme/accept-invite?token=new',
    );
    expect(prisma.notificationLog.findFirst).toHaveBeenCalledTimes(1);
  });

  it('detects SMS-only announcements and logs SMS delivery', async () => {
    await service.sendAnnouncementPublishedNotification({
      ...baseAnnouncement,
      deliveryChannels: ['IN_APP', 'SMS'],
      recipients: [recipient],
    });

    expect(email.sendAnnouncementPublishedNotification).not.toHaveBeenCalled();
    expect(sms.sendMessage).toHaveBeenCalledWith(
      recipient.phone,
      'Acme: Office closure - The office will be closed on Friday for maintenance.',
    );
    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        userId: recipient.userId,
        tenantId: baseAnnouncement.tenantId,
        type: 'ANNOUNCEMENT_PUBLISHED',
        channel: 'SMS',
        recipient: recipient.phone,
        status: 'SENT',
        metadata: {
          announcementId: baseAnnouncement.announcementId,
          employeeId: recipient.employeeId,
          provider: 'termii',
          providerStatus: 'ok',
        },
      }),
    );
  });

  it('supports combined email and SMS announcement delivery', async () => {
    await service.sendAnnouncementPublishedNotification({
      ...baseAnnouncement,
      deliveryChannels: ['IN_APP', 'EMAIL', 'SMS'],
      recipients: [recipient],
    });

    expect(email.sendAnnouncementPublishedNotification).toHaveBeenCalledTimes(
      1,
    );
    expect(sms.sendMessage).toHaveBeenCalledTimes(1);
    expect(notificationLogCreate).toHaveBeenCalledTimes(2);
    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        channel: 'EMAIL',
        recipient: recipient.email,
        status: 'SENT',
      }),
    );
    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        channel: 'SMS',
        recipient: recipient.phone,
        status: 'SENT',
      }),
    );
  });

  it('safely skips SMS recipients without phone numbers', async () => {
    await service.sendAnnouncementPublishedNotification({
      ...baseAnnouncement,
      deliveryChannels: ['IN_APP', 'SMS'],
      recipients: [{ ...recipient, phone: undefined }],
    });

    expect(sms.sendMessage).not.toHaveBeenCalled();
    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        channel: 'SMS',
        recipient: recipient.email,
        status: 'SKIPPED',
        metadata: {
          announcementId: baseAnnouncement.announcementId,
          employeeId: recipient.employeeId,
          reason: 'MISSING_PHONE',
        },
      }),
    );
  });

  it('logs and skips when an SMS announcement has no recipients', async () => {
    await service.sendAnnouncementPublishedNotification({
      ...baseAnnouncement,
      deliveryChannels: ['IN_APP', 'SMS'],
      recipients: [],
    });

    expect(email.sendAnnouncementPublishedNotification).not.toHaveBeenCalled();
    expect(sms.sendMessage).not.toHaveBeenCalled();
    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        channel: 'SMS',
        recipient: `announcement:${baseAnnouncement.announcementId}`,
        status: 'SKIPPED',
        metadata: {
          announcementId: baseAnnouncement.announcementId,
          reason: 'NO_RECIPIENTS',
        },
      }),
    );
  });

  it('logs failed SMS sends without failing processing', async () => {
    sms.sendMessage.mockResolvedValueOnce({
      success: false,
      status: 'FAILED',
      provider: 'pilosms',
      providerStatus: '1005',
      providerDetail: 'Insufficient balance',
      error: 'Insufficient balance',
    });

    await service.sendAnnouncementPublishedNotification({
      ...baseAnnouncement,
      deliveryChannels: ['IN_APP', 'SMS'],
      recipients: [recipient],
    });

    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        channel: 'SMS',
        recipient: recipient.phone,
        status: 'FAILED',
        error: 'Insufficient balance',
        metadata: {
          announcementId: baseAnnouncement.announcementId,
          employeeId: recipient.employeeId,
          provider: 'pilosms',
          providerStatus: '1005',
          providerDetail: 'Insufficient balance',
        },
      }),
    );
  });

  it('uses generic SmsService for SMS OTP delivery logs', async () => {
    sms.sendOtp.mockResolvedValueOnce({
      success: true,
      status: 'SENT',
      provider: 'pilosms',
      providerStatus: '1001',
      providerDetail: 'Message(s) processed successfully',
    });

    await service.sendSmsOtp({
      userId: recipient.userId,
      tenantId: baseAnnouncement.tenantId,
      phone: recipient.phone,
      otp: '123456',
      context: 'login',
    });

    expect(sms.sendOtp).toHaveBeenCalledWith(
      recipient.phone,
      '123456',
      'login',
    );
    expect(notificationLogEntries()).toContainEqual(
      expect.objectContaining({
        userId: recipient.userId,
        tenantId: baseAnnouncement.tenantId,
        type: 'SMS_OTP',
        channel: 'SMS',
        recipient: recipient.phone,
        status: 'SENT',
        metadata: {
          provider: 'pilosms',
          providerStatus: '1001',
          providerDetail: 'Message(s) processed successfully',
        },
      }),
    );
  });
});
