import { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { HistoricalStatementsJwtStrategy } from '../auth/strategies/historical-statements-jwt.strategy';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { HistoricalStatementsEntitlementController } from './historical-statements-entitlement.controller';
import { HistoricalStatementsEntitlementService } from './historical-statements-entitlement.service';
import { HistoricalStatementsJwtGuard } from './historical-statements-jwt.guard';
import { TenantConfigService } from './tenant-config.service';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantAdminService } from './tenant-admin.service';
import { TenantBrandingService } from './tenant-branding.service';
import { TenantsController } from './tenants.controller';

describe('Historical statements entitlement HTTP contract', () => {
  const tenantId = '22ebcddb-27c2-4d3c-96b0-b647028e99a3';
  const base = '/api/v1/auth/tenants';
  const access = `${base}/me/historical-statements-access`;
  const patch = `${base}/${tenantId}/historical-statements-entitlement`;
  const secret = 'historical-statements-test-secret';
  let app: INestApplication<Server>;
  function userFixture() {
    return {
      id: 'user',
      tenantId,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      tenant: {
        id: tenantId,
        status: 'ACTIVE',
        historicalStatementsEnabled: false,
        moduleConfig: { operations: true },
        featureConfig: { operations: { reinsurance: true } },
      },
    };
  }

  function databaseFixture() {
    const tx = {
      user: {
        findUnique: jest.fn(async () => user),
      },
      userPermission: { findMany: jest.fn().mockResolvedValue([]) },
      userPermissionSet: { findMany: jest.fn().mockResolvedValue([]) },
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ historicalStatementsEnabled: false }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    return {
      ...tx,
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
  }

  let user: ReturnType<typeof userFixture>;
  let db: ReturnType<typeof databaseFixture>;
  let token: string;
  const lifecycle = { findById: jest.fn() };

  beforeAll(async () => {
    db = databaseFixture();
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [
        HistoricalStatementsEntitlementController,
        TenantsController,
      ],
      providers: [
        JwtStrategy,
        HistoricalStatementsJwtStrategy,
        HistoricalStatementsJwtGuard,
        HistoricalStatementsEntitlementService,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: db },
        {
          provide: PermissionsService,
          useValue: {
            getHistoricalStatementsPermissions: jest
              .fn()
              .mockResolvedValue({ effectivePermissions: [] }),
          },
        },
        { provide: TenantLifecycleService, useValue: lifecycle },
        { provide: TenantConfigService, useValue: {} },
        { provide: TenantAdminService, useValue: {} },
        { provide: TenantBrandingService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api/v1/auth');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    user = userFixture();
    token = sign({ sub: 'user', tenantId, role: 'SUPER_ADMIN' }, secret, {
      expiresIn: '5m',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the literal /me access route with private no-store headers', async () => {
    const result = await request(app.getHttpServer())
      .get(access)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body: unknown = result.body;
    expect(body).toEqual({
      tenantId,
      userId: 'user',
      enabled: false,
      canView: false,
      canExport: false,
    });
    expect(result.headers['cache-control']).toBe('private,no-store');
    expect(result.headers.vary).toBe('Cookie,Authorization');
    expect(lifecycle.findById).not.toHaveBeenCalled();
  });

  it('accepts a cookie JWT using the existing strategy', async () => {
    await request(app.getHttpServer())
      .get(access)
      .set('Cookie', `access_token=${token}`)
      .expect(200);
  });

  it('returns 401 for missing, invalid and expired tokens', async () => {
    await request(app.getHttpServer()).get(access).expect(401);
    await request(app.getHttpServer())
      .get(access)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const expired = sign({ sub: 'user', tenantId }, secret, { expiresIn: -1 });
    await request(app.getHttpServer())
      .get(access)
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('rejects a token from the previous tenant and ignores tenant header overrides', async () => {
    user.tenantId = 'new-tenant';
    await request(app.getHttpServer())
      .get(access)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', 'new-tenant')
      .expect(401);
  });

  it.each(['moved-user', 'forged-tenant'])(
    'keeps %s rejection local to archive routes',
    async (state) => {
      if (state === 'moved-user') {
        user.tenantId = 'new-tenant';
        user.tenant.id = 'new-tenant';
      } else {
        token = sign(
          { sub: 'user', tenantId: 'foreign-tenant', role: 'SUPER_ADMIN' },
          secret,
          { expiresIn: '5m' },
        );
      }
      await request(app.getHttpServer())
        .get(access)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      lifecycle.findById.mockResolvedValueOnce({ id: tenantId });
      await request(app.getHttpServer())
        .get(`${base}/${tenantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200, { id: tenantId });
    },
  );

  it.each(['TENANT_ADMIN', 'EMPLOYEE'])(
    'denies %s PATCH despite stale super-admin token',
    async (role) => {
      user.role = role;
      await request(app.getHttpServer())
        .patch(patch)
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true, reason: 'approved' })
        .expect(403);
      expect(db.tenant.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { enabled: true },
    { enabled: 'true', reason: 'approved' },
    { enabled: 1, reason: 'approved' },
    { enabled: null, reason: 'approved' },
    { enabled: true, reason: '' },
    { enabled: true, reason: '  ' },
    { enabled: true, reason: 42 },
    { enabled: true, reason: 'x'.repeat(1001) },
    { enabled: true, reason: 'approved', tenantId: 'foreign' },
    { enabled: true, reason: 'approved', historicalStatementsEnabled: true },
  ])('rejects non-strict body %j', async (body) => {
    await request(app.getHttpServer())
      .patch(patch)
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(400);
    expect(db.tenant.update).not.toHaveBeenCalled();
  });

  it('validates target UUID and accepts an explicitly authorized platform change', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/invalid/historical-statements-entitlement`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, reason: 'approved' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(patch)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, reason: 'approved' })
      .expect(200, { tenantId, enabled: true });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects identity query overrides', async () => {
    await request(app.getHttpServer())
      .get(access)
      .query({ tenantId: 'foreign' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('maps JWT database outage to sanitized 503', async () => {
    db.user.findUnique.mockRejectedValueOnce(
      new Error('secret connection detail'),
    );
    const result = await request(app.getHttpServer())
      .get(access)
      .set('Authorization', `Bearer ${token}`)
      .expect(503);
    const body: unknown = result.body;
    expect(body).toEqual(
      expect.objectContaining({ message: 'Access decision unavailable' }),
    );
  });
});
