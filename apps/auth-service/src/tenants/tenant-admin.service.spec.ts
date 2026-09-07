import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { TenantAdminService } from './tenant-admin.service';

jest.mock('../permissions/system-permission-sets', () => ({
  syncUserSystemPermissionSet: jest.fn().mockResolvedValue(undefined),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = {
  id: 'tenant-1',
  name: 'Acme Ghana Ltd',
  slug: 'acme-ghana',
  email: 'admin@acmeghana.com',
  status: 'ACTIVE',
};

const ACTIVE_ADMIN = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@acmeghana.com',
  firstName: 'Abena',
  lastName: 'Mensah',
  role: 'TENANT_ADMIN',
  status: 'ACTIVE',
};

const PENDING_ADMIN = {
  ...ACTIVE_ADMIN,
  id: 'user-2',
  status: 'PENDING_VERIFICATION',
  inviteToken: 'old-token',
  inviteExpiresAt: new Date(),
};

// ─── Mock factories ────────────────────────────────────────────────────────────

type MockFn = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

function makePrisma() {
  const txFns = {
    user: {
      update: jest.fn() as MockFn,
      create: jest.fn() as MockFn,
    },
    tenant: {
      update: jest.fn() as MockFn,
    },
  };

  return {
    tenant: {
      findUnique: jest.fn() as MockFn,
      findFirst: jest.fn() as MockFn,
      update: jest.fn() as MockFn,
    },
    user: {
      findFirst: jest.fn() as MockFn,
      update: jest.fn() as MockFn,
      create: jest.fn() as MockFn,
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (fn: (tx: typeof txFns) => Promise<unknown>) =>
        fn(txFns),
      ) as MockFn,
    _txFns: txFns,
  };
}

function makeRabbit() {
  return {
    notificationInviteUser: jest.fn().mockResolvedValue(undefined) as MockFn,
  };
}

function makeAudit() {
  return {
    log: jest.fn().mockResolvedValue(undefined) as MockFn,
  };
}

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  rabbit = makeRabbit(),
  audit = makeAudit(),
) {
  return new TenantAdminService(
    prisma as unknown as PrismaService,
    rabbit as unknown as RabbitMQPublisher,
    audit as unknown as AuditService,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TenantAdminService.updateTenantAdmin', () => {
  it('throws NotFoundException when tenant does not exist', async () => {
    const prisma = makePrisma();
    prisma.tenant.findUnique.mockResolvedValue(null);

    const svc = makeService(prisma);
    await expect(
      svc.updateTenantAdmin('bad-id', {
        firstName: 'X',
        lastName: 'Y',
        email: 'x@y.com',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when new email is already registered to another company', async () => {
    const prisma = makePrisma();
    prisma.tenant.findUnique.mockResolvedValue(TENANT);
    prisma.tenant.findFirst.mockResolvedValue({ id: 'other-tenant' });

    const svc = makeService(prisma);
    await expect(
      svc.updateTenantAdmin('tenant-1', {
        firstName: 'Abena',
        lastName: 'Mensah',
        email: 'taken@othercorp.com',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  describe('accepted admin (status ACTIVE)', () => {
    it('syncs both User.email and Tenant.email inside a transaction', async () => {
      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.findFirst.mockResolvedValue(null); // no conflict on new email
      prisma.user.findFirst.mockResolvedValue(ACTIVE_ADMIN);

      const updatedUser = {
        ...ACTIVE_ADMIN,
        email: 'newemail@acmeghana.com',
        firstName: 'Abena',
        lastName: 'Mensah',
      };
      prisma._txFns.user.update.mockResolvedValue(updatedUser);
      prisma._txFns.tenant.update.mockResolvedValue({
        ...TENANT,
        email: 'newemail@acmeghana.com',
      });

      const audit = makeAudit();
      const svc = makeService(prisma, makeRabbit(), audit);

      const result = await svc.updateTenantAdmin('tenant-1', {
        firstName: 'Abena',
        lastName: 'Mensah',
        email: 'newemail@acmeghana.com',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(prisma._txFns.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ACTIVE_ADMIN.id },
          data: expect.objectContaining({ email: 'newemail@acmeghana.com' }),
        }),
      );

      expect(prisma._txFns.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { email: 'newemail@acmeghana.com' },
      });

      expect(result.message).toBe('Admin updated successfully');
      expect(result.user.email).toBe('newemail@acmeghana.com');
    });

    it('does NOT update Tenant.email when email is unchanged', async () => {
      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      // findFirst for conflict check is NOT called when email is same
      prisma.user.findFirst.mockResolvedValue(ACTIVE_ADMIN);
      prisma._txFns.user.update.mockResolvedValue({
        ...ACTIVE_ADMIN,
        firstName: 'NewFirst',
      });

      const svc = makeService(prisma);

      await svc.updateTenantAdmin('tenant-1', {
        firstName: 'NewFirst',
        lastName: 'Mensah',
        email: 'admin@acmeghana.com', // same as TENANT.email
      });

      expect(prisma._txFns.tenant.update).not.toHaveBeenCalled();
    });

    it('does not resend invite for an ACTIVE admin', async () => {
      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(ACTIVE_ADMIN);
      prisma._txFns.user.update.mockResolvedValue(ACTIVE_ADMIN);
      prisma._txFns.tenant.update.mockResolvedValue(TENANT);

      const rabbit = makeRabbit();
      const svc = makeService(prisma, rabbit);

      await svc.updateTenantAdmin('tenant-1', {
        firstName: 'Abena',
        lastName: 'Mensah',
        email: 'newemail@acmeghana.com',
      });

      expect(rabbit.notificationInviteUser).not.toHaveBeenCalled();
    });
  });

  describe('pending admin (status PENDING_VERIFICATION)', () => {
    it('syncs Tenant.email AND resends invite when email changes', async () => {
      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(PENDING_ADMIN);

      const updatedUser = {
        ...PENDING_ADMIN,
        email: 'new@acmeghana.com',
      };
      prisma._txFns.user.update.mockResolvedValue(updatedUser);
      prisma._txFns.tenant.update.mockResolvedValue({
        ...TENANT,
        email: 'new@acmeghana.com',
      });

      const rabbit = makeRabbit();
      const svc = makeService(prisma, rabbit);

      const result = await svc.updateTenantAdmin('tenant-1', {
        firstName: 'Abena',
        lastName: 'Mensah',
        email: 'new@acmeghana.com',
      });

      expect(prisma._txFns.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { email: 'new@acmeghana.com' },
      });

      expect(rabbit.notificationInviteUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@acmeghana.com' }),
      );

      expect(result.message).toBe(
        'Admin updated successfully. New invite sent.',
      );
    });
  });

  describe('audit logging', () => {
    it('logs an UPDATE audit record with before/after email when email changes', async () => {
      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(ACTIVE_ADMIN);
      const updatedUser = { ...ACTIVE_ADMIN, email: 'new@acmeghana.com' };
      prisma._txFns.user.update.mockResolvedValue(updatedUser);
      prisma._txFns.tenant.update.mockResolvedValue(TENANT);

      const audit = makeAudit();
      const svc = makeService(prisma, makeRabbit(), audit);

      await svc.updateTenantAdmin('tenant-1', {
        firstName: 'Abena',
        lastName: 'Mensah',
        email: 'new@acmeghana.com',
      });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'UPDATE',
          resource: 'tenant_admin',
          changes: expect.objectContaining({
            before: expect.objectContaining({ email: 'admin@acmeghana.com' }),
            after: expect.objectContaining({ email: 'new@acmeghana.com' }),
          }),
          status: 'SUCCESS',
        }),
      );
    });
  });

  describe('transaction safety', () => {
    it('throws ConflictException when User email violates per-tenant unique constraint (P2002)', async () => {
      const { Prisma } = await import('../../prisma/generated/client');
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        { code: 'P2002', clientVersion: '5.x' },
      );

      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(ACTIVE_ADMIN);
      prisma.$transaction.mockRejectedValue(p2002);

      const svc = makeService(prisma);

      await expect(
        svc.updateTenantAdmin('tenant-1', {
          firstName: 'Abena',
          lastName: 'Mensah',
          email: 'dupe@acmeghana.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates unexpected errors from the transaction', async () => {
      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(ACTIVE_ADMIN);
      prisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

      const svc = makeService(prisma);

      await expect(
        svc.updateTenantAdmin('tenant-1', {
          firstName: 'Abena',
          lastName: 'Mensah',
          email: 'new@acmeghana.com',
        }),
      ).rejects.toThrow('DB connection lost');
    });
  });

  describe('no existing admin (create path)', () => {
    it('creates User and syncs Tenant.email in a transaction when email differs', async () => {
      const prisma = makePrisma();
      prisma.tenant.findUnique.mockResolvedValue({
        ...TENANT,
        email: 'old@acmeghana.com',
      });
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      const createdUser = {
        id: 'user-new',
        email: 'new@acmeghana.com',
        firstName: 'Kwame',
        lastName: 'Asante',
        role: 'TENANT_ADMIN',
        status: 'PENDING_VERIFICATION',
      };
      prisma._txFns.user.create.mockResolvedValue(createdUser);
      prisma._txFns.tenant.update.mockResolvedValue({
        ...TENANT,
        email: 'new@acmeghana.com',
      });

      const rabbit = makeRabbit();
      const audit = makeAudit();
      const svc = makeService(prisma, rabbit, audit);

      const result = await svc.updateTenantAdmin('tenant-1', {
        firstName: 'Kwame',
        lastName: 'Asante',
        email: 'new@acmeghana.com',
      });

      expect(prisma._txFns.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { email: 'new@acmeghana.com' },
      });

      expect(rabbit.notificationInviteUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@acmeghana.com' }),
      );

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', resource: 'tenant_admin' }),
      );

      expect(result.message).toBe('Admin assigned. Invite email sent.');
    });
  });
});

describe('TenantAdminService.resendAdminInvite', () => {
  it('regenerates the pending admin token, extends expiry, emits resend invite, and audits', async () => {
    const prisma = makePrisma();
    const pendingAdmin = {
      ...PENDING_ADMIN,
      tenant: TENANT,
      inviteExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    prisma.user.findFirst.mockResolvedValue(pendingAdmin);
    prisma.user.update.mockResolvedValue({
      ...pendingAdmin,
      inviteToken: 'new-token',
    });

    const rabbit = makeRabbit();
    const audit = makeAudit();
    const svc = makeService(prisma, rabbit, audit);

    const result = await svc.resendAdminInvite('tenant-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        role: 'TENANT_ADMIN',
        status: 'PENDING_VERIFICATION',
      },
      include: { tenant: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: pendingAdmin.id },
      data: {
        inviteToken: expect.any(String),
        inviteExpiresAt: expect.any(Date),
      },
    });
    const updateArgs = prisma.user.update.mock.calls[0][0] as {
      data: { inviteToken: string; inviteExpiresAt: Date };
    };
    expect(updateArgs.data.inviteToken).not.toBe(pendingAdmin.inviteToken);
    expect(rabbit.notificationInviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: pendingAdmin.id,
        tenantId: 'tenant-1',
        email: pendingAdmin.email,
        inviteToken: updateArgs.data.inviteToken,
        acceptInviteUrl: expect.stringContaining(
          '/acme-ghana/accept-invite?token=',
        ),
        inviteKind: 'TENANT_ADMIN',
        isResend: true,
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: pendingAdmin.id,
        action: 'UPDATE',
        resource: 'tenant_admin',
        resourceId: pendingAdmin.id,
        changes: expect.objectContaining({
          after: expect.objectContaining({ resendInvite: true }),
        }),
        status: 'SUCCESS',
      }),
    );
    expect(result).toEqual({ message: 'Invitation resent successfully' });
    expect(result).not.toHaveProperty('inviteToken');
  });

  it('allows multiple expired invite resends and rotates the token each time', async () => {
    const prisma = makePrisma();
    const pendingAdmin = {
      ...PENDING_ADMIN,
      tenant: TENANT,
      inviteExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    prisma.user.findFirst.mockResolvedValueOnce(pendingAdmin);
    prisma.user.update.mockResolvedValueOnce({
      ...pendingAdmin,
      inviteToken: 'first-new-token',
    });

    const rabbit = makeRabbit();
    const svc = makeService(prisma, rabbit);

    await svc.resendAdminInvite('tenant-1');

    const firstUpdate = prisma.user.update.mock.calls[0][0] as {
      data: { inviteToken: string; inviteExpiresAt: Date };
    };

    prisma.user.findFirst.mockResolvedValueOnce({
      ...pendingAdmin,
      inviteToken: firstUpdate.data.inviteToken,
      inviteExpiresAt: new Date('2026-06-02T00:00:00.000Z'),
    });
    prisma.user.update.mockResolvedValueOnce({
      ...pendingAdmin,
      inviteToken: 'second-new-token',
    });

    await svc.resendAdminInvite('tenant-1');

    const secondUpdate = prisma.user.update.mock.calls[1][0] as {
      data: { inviteToken: string; inviteExpiresAt: Date };
    };

    expect(firstUpdate.data.inviteToken).not.toBe(PENDING_ADMIN.inviteToken);
    expect(secondUpdate.data.inviteToken).not.toBe(PENDING_ADMIN.inviteToken);
    expect(secondUpdate.data.inviteToken).not.toBe(
      firstUpdate.data.inviteToken,
    );
    expect(firstUpdate.data.inviteExpiresAt).toBeInstanceOf(Date);
    expect(secondUpdate.data.inviteExpiresAt).toBeInstanceOf(Date);
    expect(rabbit.notificationInviteUser).toHaveBeenCalledTimes(2);
    expect(rabbit.notificationInviteUser).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        inviteToken: secondUpdate.data.inviteToken,
        isResend: true,
      }),
    );
  });

  it('rejects accepted admins because only pending admins can be resent', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);

    const rabbit = makeRabbit();
    const svc = makeService(prisma, rabbit);

    await expect(svc.resendAdminInvite('tenant-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(rabbit.notificationInviteUser).not.toHaveBeenCalled();
  });
});
