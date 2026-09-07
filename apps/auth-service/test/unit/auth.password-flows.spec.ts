/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../src/audit/audit.service';
import { AuthService } from '../../src/auth/auth.service';
import { RabbitMQPublisher } from '../../src/messaging/rabbitmq.publisher';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService password flows', () => {
  const tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme Ghana',
    status: 'ACTIVE',
  };

  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'ama@acme.com',
    firstName: 'Ama',
    password: '$2b$12$hash',
  };

  const prisma = {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    otpCode: {
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: { updateMany: jest.fn() },
    userPermission: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
    userPermissionSet: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
  } as any;

  const rabbitmq = {
    notificationPasswordResetLink: jest.fn(async () => undefined),
    notificationPasswordResetOtp: jest.fn(async () => undefined),
  } as any;

  let service: AuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('token') },
        },
        { provide: RabbitMQPublisher, useValue: rabbitmq },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jest.clearAllMocks();
    const hashMock = bcrypt.hash as unknown as {
      mockResolvedValue(value: string): void;
    };
    hashMock.mockResolvedValue('hashed-password');
  });

  it('forgotPassword is tenant-safe: unknown tenant slug returns safe message and does not create OTP', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({
      tenantSlug: 'unknown-tenant',
      email: 'someone@acme.com',
    } as any);

    expect(result.message).toMatch(/you'll receive a code shortly/i);
    expect(prisma.otpCode.create).not.toHaveBeenCalled();
    expect(rabbitmq.notificationPasswordResetLink).not.toHaveBeenCalled();
  });

  it('forgotPassword routes via SMS channel when method=sms and phone exists', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    prisma.user.findFirst.mockResolvedValue({
      ...user,
      phone: '+233240000000',
    });
    prisma.otpCode.count.mockResolvedValue(0);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });

    await service.forgotPassword({
      tenantSlug: tenant.slug,
      email: user.email,
      method: 'sms',
    } as any);

    expect(rabbitmq.notificationPasswordResetOtp).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+233240000000' }),
    );
  });

  it('resetPassword revokes all refresh tokens after successful password reset', async () => {
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1',
      code: '123456',
      attempts: 0,
      lockedUntil: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      user: { id: user.id },
    });
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.resetPassword({
      token: '123456',
      tenantSlug: tenant.slug,
      newPassword: 'NewPassword123!',
    } as any);

    expect(result.message).toMatch(/password reset successfully/i);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id },
      data: { isRevoked: true },
    });
  });

  it('resetPassword fails when reset token is missing', async () => {
    await expect(
      service.resetPassword({ newPassword: 'NewPassword123!' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
