import { ConfigService } from '@nestjs/config';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArchiveImportExecutor } from './archive-import.executor';

describe('Archive importer role separation', () => {
  it('never falls back to the application DATABASE_URL', async () => {
    const executor = new ArchiveImportExecutor(
      new ConfigService({
        DATABASE_URL: 'postgresql://broad:synthetic@127.0.0.1:1/not-used',
      }),
    );
    await expect(
      executor.preflight({
        tenantId: 'synthetic',
        tenantSlug: 'synthetic',
        userId: 'synthetic',
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('rejects disposable entitlement bypass identities before opening a connection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'archive-role-test-'));
    try {
      const path = join(root, 'identity.json');
      await writeFile(
        path,
        JSON.stringify({
          environment: 'local',
          host: '127.0.0.1',
          port: 1,
          database: 'irisk_archive_m2a_synthetic',
          schema: 'reinsurance',
          role: 'writer',
          readRole: 'reader',
          purpose: 'DISPOSABLE_TEST',
        }),
      );
      const executor = new ArchiveImportExecutor(
        new ConfigService({
          ARCHIVE_DATABASE_IDENTITY_FILE: path,
          ARCHIVE_READ_DATABASE_URL:
            'postgresql://reader:synthetic@127.0.0.1:1/irisk_archive_m2a_synthetic',
        }),
      );
      await expect(
        executor.preflight({
          tenantId: 'synthetic',
          tenantSlug: 'synthetic',
          userId: 'synthetic',
        }),
      ).rejects.toMatchObject({ status: 503 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
