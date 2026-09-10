import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AuditService } from '../audit/audit.service';
import { TenantAssetStorageService } from '../tenants/tenant-asset-storage.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

type MockFn = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

function makePrisma() {
  return {
    user: {
      findFirst: jest.fn() as MockFn,
      findUnique: jest.fn() as MockFn,
      update: jest.fn().mockResolvedValue({}) as MockFn,
    },
    tenant: {
      update: jest.fn().mockResolvedValue({}) as MockFn,
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}) as MockFn,
    },
  };
}

function makeRabbit() {
  return {
    notificationInviteUser: jest.fn().mockResolvedValue(undefined) as MockFn,
    hrProvisionTenantWorkspace: jest
      .fn()
      .mockResolvedValue(undefined) as MockFn,
    hrLinkEmployeeIdentity: jest.fn().mockResolvedValue(undefined) as MockFn,
  };
}

function makeAudit() {
  return {
    log: jest.fn().mockResolvedValue(undefined) as MockFn,
  };
}

function makeService(
  prisma = makePrisma(),
  rabbit = makeRabbit(),
  audit = makeAudit(),
  jwtService = {
    sign: jest
      .fn()
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token'),
  },
  storage = {
    storeUserAvatar: jest.fn().mockResolvedValue({
      objectKey:
        'tenant-assets/tenants/tenant-1/user-avatar/users/user-1/avatar/avatar.webp',
      mimeType: 'image/webp',
      fileName: 'avatar.webp',
      sizeBytes: 16,
    }),
    delete: jest.fn().mockResolvedValue(undefined),
    isUserAvatarObjectKey: jest.fn().mockReturnValue(true),
  },
) {
  return new UsersService(
    prisma as unknown as PrismaService,
    rabbit as unknown as RabbitMQPublisher,
    jwtService as never,
    audit as unknown as AuditService,
    storage as unknown as TenantAssetStorageService,
  );
}

describe('UsersService.uploadAvatar', () => {
  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    avatarUrl: null,
    tenant: { slug: 'acme-ghana' },
  };
  const updated = {
    id: 'user-1',
    email: 'ama@acmeghana.com',
    firstName: 'Ama',
    lastName: 'Mensah',
    phone: null,
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    avatarUrl:
      'tenant-assets/tenants/tenant-1/user-avatar/users/user-1/avatar/avatar.webp',
    tenantId: 'tenant-1',
    updatedAt: new Date(),
  };

  const file = (mimetype: string, buffer: Buffer): Express.Multer.File =>
    ({
      buffer,
      mimetype,
      originalname: 'avatar.webp',
      size: buffer.length,
    }) as Express.Multer.File;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['image/webp', Buffer.from('RIFFxxxxWEBP')],
  ])(
    'accepts %s and updates only the authenticated user',
    async (mimetype, buffer) => {
      const prisma = makePrisma();
      prisma.user.findFirst.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updated);
      const storage = {
        storeUserAvatar: jest.fn().mockResolvedValue({
          objectKey: updated.avatarUrl,
          mimeType: mimetype,
          fileName: 'avatar.webp',
          sizeBytes: buffer.length,
        }),
        delete: jest.fn().mockResolvedValue(undefined),
        isUserAvatarObjectKey: jest.fn().mockReturnValue(true),
      };
      const service = makeService(
        prisma,
        makeRabbit(),
        makeAudit(),
        { sign: jest.fn() },
        storage,
      );

      const result = await service.uploadAvatar(
        'tenant-1',
        'user-1',
        file(mimetype, buffer),
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', tenantId: 'tenant-1' },
        select: expect.objectContaining({ tenant: { select: { slug: true } } }),
      });
      expect(storage.storeUserAvatar).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { avatarUrl: updated.avatarUrl },
        }),
      );
      expect(result.avatarUrl).toBe(updated.avatarUrl);
    },
  );

  it('rejects missing, unsupported, oversized, and malformed files', async () => {
    const service = makeService();

    await expect(
      service.uploadAvatar('tenant-1', 'user-1', undefined),
    ).rejects.toThrow('An image file is required');
    await expect(
      service.uploadAvatar(
        'tenant-1',
        'user-1',
        file('image/gif', Buffer.from('GIF89a')),
      ),
    ).rejects.toThrow('Only JPEG');
    await expect(
      service.uploadAvatar(
        'tenant-1',
        'user-1',
        file('image/png', Buffer.alloc(5 * 1024 * 1024 + 1)),
      ),
    ).rejects.toThrow('must not exceed 5 MB');
    await expect(
      service.uploadAvatar(
        'tenant-1',
        'user-1',
        file('image/png', Buffer.from('not-png')),
      ),
    ).rejects.toThrow('valid image');
  });

  it('deletes the previous avatar only after a successful replacement', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({
      ...user,
      avatarUrl:
        'tenant-assets/tenants/tenant-1/user-avatar/users/user-1/avatar/old.png',
    });
    prisma.user.update.mockResolvedValue(updated);
    const storage = {
      storeUserAvatar: jest.fn().mockResolvedValue({
        objectKey: updated.avatarUrl,
        mimeType: 'image/png',
        fileName: 'avatar.png',
        sizeBytes: 16,
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      isUserAvatarObjectKey: jest.fn().mockReturnValue(true),
    };
    const service = makeService(
      prisma,
      makeRabbit(),
      makeAudit(),
      { sign: jest.fn() },
      storage,
    );

    await service.uploadAvatar(
      'tenant-1',
      'user-1',
      file('image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    );

    expect(storage.delete).toHaveBeenCalledWith(
      'tenant-assets/tenants/tenant-1/user-avatar/users/user-1/avatar/old.png',
    );
  });

  it('cleans up the new object and leaves the old pointer when the database update fails', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({
      ...user,
      avatarUrl:
        'tenant-assets/tenants/tenant-1/user-avatar/users/user-1/avatar/old.png',
    });
    const databaseError = new Error('database unavailable');
    prisma.user.update.mockRejectedValue(databaseError);
    const storage = {
      storeUserAvatar: jest.fn().mockResolvedValue({
        objectKey: updated.avatarUrl,
        mimeType: 'image/jpeg',
        fileName: 'avatar.jpg',
        sizeBytes: 4,
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      isUserAvatarObjectKey: jest.fn().mockReturnValue(true),
    };
    const service = makeService(
      prisma,
      makeRabbit(),
      makeAudit(),
      { sign: jest.fn() },
      storage,
    );

    await expect(
      service.uploadAvatar(
        'tenant-1',
        'user-1',
        file('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])),
      ),
    ).rejects.toBe(databaseError);
    expect(storage.delete).toHaveBeenCalledWith(updated.avatarUrl);
    expect(storage.delete).not.toHaveBeenCalledWith(
      expect.stringContaining('/old.png'),
    );
  });

  it('does not update the database when object storage fails', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(user);
    const storage = {
      storeUserAvatar: jest
        .fn()
        .mockRejectedValue(new Error('storage unavailable')),
      delete: jest.fn(),
      isUserAvatarObjectKey: jest.fn().mockReturnValue(true),
    };
    const service = makeService(
      prisma,
      makeRabbit(),
      makeAudit(),
      { sign: jest.fn() },
      storage,
    );

    await expect(
      service.uploadAvatar(
        'tenant-1',
        'user-1',
        file('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])),
      ),
    ).rejects.toThrow('storage unavailable');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('cannot change another user or tenant because both identities come from the principal lookup', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(
      service.uploadAvatar(
        'tenant-2',
        'user-2',
        file('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])),
      ),
    ).rejects.toThrow('User not found');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.resendInvite', () => {
  const pendingUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'ama@acmeghana.com',
    firstName: 'Ama',
    lastName: 'Mensah',
    role: 'EMPLOYEE',
    status: 'PENDING_VERIFICATION',
    inviteToken: 'old-token',
    inviteExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
    tenant: {
      id: 'tenant-1',
      slug: 'acme-ghana',
      name: 'Acme Ghana',
    },
  };

  it('regenerates pending invite token, emits resend metadata, audits, and does not return token', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(pendingUser);
    const rabbit = makeRabbit();
    const audit = makeAudit();
    const service = makeService(prisma, rabbit, audit);

    const result = await service.resendInvite('tenant-1', 'user-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', tenantId: 'tenant-1' },
      include: { tenant: true },
    });
    const updateArgs = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { inviteToken: string; inviteExpiresAt: Date };
    };
    expect(updateArgs.where).toEqual({ id: 'user-1' });
    expect(updateArgs.data.inviteToken).toEqual(expect.any(String));
    expect(updateArgs.data.inviteToken).not.toBe(pendingUser.inviteToken);
    expect(updateArgs.data.inviteExpiresAt).toBeInstanceOf(Date);

    expect(rabbit.notificationInviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: pendingUser.id,
        tenantId: 'tenant-1',
        email: pendingUser.email,
        firstName: pendingUser.firstName,
        inviteToken: updateArgs.data.inviteToken,
        tenantName: pendingUser.tenant.name,
        acceptInviteUrl: expect.stringContaining(
          '/acme-ghana/accept-invite?token=',
        ),
        inviteKind: 'EMPLOYEE',
        isResend: true,
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: pendingUser.id,
        action: 'UPDATE',
        resource: 'users',
        resourceId: pendingUser.id,
        changes: expect.objectContaining({
          after: expect.objectContaining({ resendInvite: true }),
        }),
        status: 'SUCCESS',
      }),
    );
    expect(result).toEqual({ message: 'Invitation resent successfully' });
    expect(result).not.toHaveProperty('inviteToken');
  });

  it('rejects non-pending users', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({
      ...pendingUser,
      status: 'ACTIVE',
      inviteToken: null,
    });
    const rabbit = makeRabbit();
    const service = makeService(prisma, rabbit);

    await expect(service.resendInvite('tenant-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(rabbit.notificationInviteUser).not.toHaveBeenCalled();
  });

  it('rejects wrong-tenant or missing users', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.resendInvite('tenant-2', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('UsersService.acceptInvite after resend token rotation', () => {
  const tenant = {
    id: 'tenant-1',
    slug: 'acme-ghana',
    name: 'Acme Ghana',
    email: 'admin@acmeghana.com',
    country: 'GH',
    currency: 'GHS',
  };

  const pendingAdmin = {
    id: 'admin-1',
    tenantId: tenant.id,
    email: 'admin@acmeghana.com',
    firstName: 'Ama',
    lastName: 'Admin',
    role: 'TENANT_ADMIN',
    status: 'PENDING_VERIFICATION',
    inviteToken: 'new-token',
    inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    tenant,
  };

  it('rejects the old expired token after resend and activates with the new token', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingAdmin);
    prisma.user.update.mockResolvedValue({
      ...pendingAdmin,
      status: 'ACTIVE',
      inviteToken: null,
      inviteExpiresAt: null,
    });

    const rabbit = makeRabbit();
    const service = makeService(prisma, rabbit);

    await expect(
      service.acceptInvite({
        inviteToken: 'old-expired-token',
        password: 'Password123!',
      }),
    ).rejects.toThrow(ForbiddenException);

    const result = await service.acceptInvite({
      inviteToken: 'new-token',
      password: 'Password123!',
    });

    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { inviteToken: 'old-expired-token' },
      include: { tenant: true },
    });
    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { inviteToken: 'new-token' },
      include: { tenant: true },
    });
    expect(rabbit.hrProvisionTenantWorkspace).toHaveBeenCalledWith({
      tenantId: tenant.id,
      adminEmail: tenant.email,
      adminUserId: pendingAdmin.id,
      country: tenant.country,
      currency: tenant.currency,
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pendingAdmin.id },
        data: expect.objectContaining({
          status: 'ACTIVE',
          inviteToken: null,
          inviteExpiresAt: null,
        }),
      }),
    );
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenant.id },
      data: { status: 'ACTIVE' },
    });
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
  });
});
