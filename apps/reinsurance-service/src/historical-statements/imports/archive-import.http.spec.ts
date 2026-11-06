import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, realpath, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { Server } from 'node:http';
import { HistoricalStatementsModule } from '../historical-statements.module';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoricalStatementsAccessClient } from '../historical-statements-access.client';
import { ArchiveImportService, ImportIdentity } from './archive-import.service';
import { workbook } from '../loader/test-fixtures';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const path = '/historical-statements/imports';
describe('Historical upload HTTP contracts and fresh authorization', () => {
  let app: INestApplication<Server>, root: string;
  const oldSecret = process.env.JWT_SECRET;
  const access = { getAccess: jest.fn() };
  const imports = { submit: jest.fn(), status: jest.fn(), publish: jest.fn() };
  const token = (role = 'TENANT_ADMIN') =>
    jwt.sign(
      { sub: userId, tenantId, tenantSlug: 'synthetic', role },
      'synthetic-upload-secret',
      { expiresIn: '5m' },
    );
  beforeAll(async () => {
    root = await realpath(
      await mkdtemp(join(tmpdir(), 'archive-upload-http-')),
    );
    process.env.HISTORICAL_STATEMENTS_UPLOAD_ROOT = root;
    process.env.JWT_SECRET = 'synthetic-upload-secret';
    const module = await Test.createTestingModule({
      imports: [HistoricalStatementsModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: () => undefined })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(HistoricalStatementsAccessClient)
      .useValue(access)
      .overrideProvider(ArchiveImportService)
      .useValue(imports)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    access.getAccess.mockResolvedValue({
      tenantId,
      userId,
      enabled: true,
      canView: true,
      canExport: true,
      canImport: true,
    });
    imports.submit.mockImplementation(
      (
        _identity: ImportIdentity,
        _metadata: string,
        files: Express.Multer.File[],
      ) =>
        Promise.resolve({
          importId: id,
          status: 'VALIDATING',
          fileCount: files.length,
        }),
    );
    imports.status.mockResolvedValue({ importId: id, status: 'READY' });
    imports.publish.mockResolvedValue({ importId: id, status: 'PUBLISHING' });
  });
  afterAll(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
    delete process.env.HISTORICAL_STATEMENTS_UPLOAD_ROOT;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  it('accepts multipart XLSX and derives identity exclusively from authenticated session', async () => {
    const result = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token()}`)
      .set('x-tenant-id', 'forged-tenant')
      .field('metadata', '[]')
      .attach('files', workbook('INSURER'), 'synthetic.xlsx')
      .expect(202);
    expect(result.body as unknown).toMatchObject({
      importId: id,
      status: 'VALIDATING',
      fileCount: 1,
    });
    expect(imports.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { tenantId, userId, tenantSlug: 'synthetic' },
      }),
      '[]',
      expect.any(Array),
    );
  });
  it('rejects tenant selectors and unknown multipart fields', async () => {
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token()}`)
      .field('metadata', '[]')
      .field('tenantId', 'other')
      .expect(400);
    expect(imports.submit).not.toHaveBeenCalled();
  });
  it('rejects invalid file extension before orchestration', async () => {
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token()}`)
      .field('metadata', '[]')
      .attach('files', Buffer.from('synthetic'), 'not-a-workbook.txt')
      .expect(400);
    expect(imports.submit).not.toHaveBeenCalled();
  });
  it('requires authentication, current entitlement, current import access and administrator role', async () => {
    await request(app.getHttpServer()).get(`${path}/${id}`).expect(401);
    for (const override of [
      { enabled: false },
      { canImport: false },
      { tenantId: 'other' },
    ]) {
      access.getAccess.mockResolvedValue({
        tenantId,
        userId,
        enabled: true,
        canView: true,
        canImport: true,
        ...override,
      });
      const result = await request(app.getHttpServer())
        .get(`${path}/${id}`)
        .set('Authorization', `Bearer ${token()}`);
      expect([401, 403]).toContain(result.status);
    }
    access.getAccess.mockResolvedValue({
      tenantId,
      userId,
      enabled: true,
      canView: true,
      canImport: true,
    });
    await request(app.getHttpServer())
      .get(`${path}/${id}`)
      .set('Authorization', `Bearer ${token('EMPLOYEE')}`)
      .expect(403);
    expect(imports.status).not.toHaveBeenCalled();
  });
  it('validates publish UUID, version, approval and rejects forged tenant payloads', async () => {
    await request(app.getHttpServer())
      .post(`${path}/not-a-uuid/publish`)
      .set('Authorization', `Bearer ${token()}`)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post(`${path}/${id}/publish`)
      .set('Authorization', `Bearer ${token()}`)
      .send({
        datasetVersion: 'sha256-' + 'a'.repeat(64),
        approvalRef: ' ',
        tenantId,
      })
      .expect(400);
    expect(imports.publish).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post(`${path}/${id}/publish`)
      .set('Authorization', `Bearer ${token()}`)
      .send({
        datasetVersion: 'sha256-' + 'a'.repeat(64),
        approvalRef: 'Synthetic explicit approval',
      })
      .expect(202);
    expect(imports.publish).toHaveBeenCalledTimes(1);
  });
  it('returns private status and validates import ID', async () => {
    const result = await request(app.getHttpServer())
      .get(`${path}/${id}`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);
    expect(result.headers['cache-control'] as unknown).toBe('private,no-store');
    await request(app.getHttpServer())
      .get(`${path}/not-a-uuid`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(400);
    // The interceptor never leaves uploaded temporary files as public artifacts.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await readdir(join(root, 'incoming'))).toEqual([]);
  });
});
