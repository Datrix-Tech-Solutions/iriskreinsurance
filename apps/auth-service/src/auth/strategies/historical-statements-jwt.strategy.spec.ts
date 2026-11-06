import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '@work-phelo/types';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';
import { HistoricalStatementsJwtStrategy } from './historical-statements-jwt.strategy';

describe('HistoricalStatementsJwtStrategy current database identity', () => {
  const payload = {
    email: 'actor@example.test',
    tenantSlug: 'tenant',
    sub: 'user',
    tenantId: 'tenant',
    role: 'SUPER_ADMIN',
  } satisfies JwtPayload;
  function userFixture() {
    return {
      id: 'user',
      tenantId: 'tenant',
      status: 'ACTIVE',
      role: 'EMPLOYEE',
      tenant: {
        id: 'tenant',
        status: 'ACTIVE',
        moduleConfig: {},
        featureConfig: {},
      },
    };
  }

  function databaseFixture() {
    return {
      user: {
        findUnique: jest.fn(
          async (): Promise<ReturnType<typeof userFixture> | null> => user,
        ),
      },
      userPermission: { findMany: jest.fn().mockResolvedValue([]) },
      userPermissionSet: { findMany: jest.fn().mockResolvedValue([]) },
    };
  }

  let user: ReturnType<typeof userFixture>;
  let db: ReturnType<typeof databaseFixture>;
  let generic: JwtStrategy;
  let strategy: HistoricalStatementsJwtStrategy;

  beforeEach(async () => {
    user = userFixture();
    db = databaseFixture();
    const module = await Test.createTestingModule({
      providers: [
        HistoricalStatementsJwtStrategy,
        JwtStrategy,
        { provide: PrismaService, useValue: db },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'test-secret' },
        },
      ],
    }).compile();
    strategy = module.get(HistoricalStatementsJwtStrategy);
    generic = module.get(JwtStrategy);
  });

  it('uses current database role rather than stale admin claim', async () => {
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: 'user',
      tenantId: 'tenant',
      role: 'EMPLOYEE',
      permissions: [],
    });
  });

  it('preserves generic JWT tenant semantics for unrelated auth flows', async () => {
    user.tenantId = 'new-tenant';
    user.tenant.id = 'new-tenant';
    await expect(generic.validate(payload)).resolves.toMatchObject({
      tenantId: 'new-tenant',
    });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    'missing-user',
    'inactive-user',
    'inactive-tenant',
    'moved-tenant',
    'wrong-subject',
  ])('rejects %s', async (state) => {
    if (state === 'missing-user')
      db.user.findUnique.mockResolvedValueOnce(null);
    if (state === 'inactive-user') user.status = 'INACTIVE';
    if (state === 'inactive-tenant') user.tenant.status = 'SUSPENDED';
    if (state === 'moved-tenant') user.tenantId = 'other';
    if (state === 'wrong-subject') user.id = 'other';
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.userPermission.findMany).not.toHaveBeenCalled();
  });

  it.each([
    { ...payload, tenantId: '' },
    { ...payload, sub: '' },
  ])('rejects incomplete token identity', async (invalid) => {
    await expect(strategy.validate(invalid)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
