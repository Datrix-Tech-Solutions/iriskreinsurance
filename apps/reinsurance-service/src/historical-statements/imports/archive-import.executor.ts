import {
  Injectable,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import {
  Actor,
  ArchiveDatabase,
  DatabaseIdentity,
  parseIdentity,
} from '../loader/database';
import {
  applyDataset,
  loadStatus,
  planApply,
  Plan,
  WriteApproval,
} from '../loader/lifecycle';
import { sha, ValidatedDataset } from '../loader/source-contract';

@Injectable()
export class ArchiveImportExecutor {
  constructor(private readonly config: ConfigService) {}
  private async database(write: boolean): Promise<ArchiveDatabase> {
    try {
      const path = this.config.get<string>('ARCHIVE_DATABASE_IDENTITY_FILE');
      if (!path) throw new Error();
      const identity: DatabaseIdentity = parseIdentity(
        JSON.parse(await readFile(path, 'utf8')) as unknown,
      );
      if (identity.purpose !== 'ARCHIVE') throw new Error();
      const url = this.config.get<string>(
        write ? 'ARCHIVE_WRITE_DATABASE_URL' : 'ARCHIVE_READ_DATABASE_URL',
      );
      if (!url) throw new Error();
      return new ArchiveDatabase(url, identity, write ? 'write' : 'read');
    } catch {
      throw new ServiceUnavailableException(
        'ARCHIVE_IMPORT_DATABASE_CONFIGURATION_REQUIRED',
      );
    }
  }
  private async using<T>(
    write: boolean,
    fn: (db: ArchiveDatabase) => Promise<T>,
  ): Promise<T> {
    const db = await this.database(write);
    try {
      await db.connect();
      return await fn(db);
    } finally {
      await db.close();
    }
  }
  async preflight(actor: Actor) {
    try {
      for (const write of [false, true])
        await this.using(write, async (db) => {
          await db.transaction(true, async () => {
            await db.verifyPrivileges(write);
            await db.verifyActor(actor);
          });
        });
    } catch {
      throw new ServiceUnavailableException(
        'ARCHIVE_IMPORT_DATABASE_PREREQUISITES_REQUIRED',
      );
    }
  }

  plan(dataset: ValidatedDataset, actor: Actor, stageOnly: boolean) {
    return this.using(false, (db) => planApply(db, dataset, actor, stageOnly));
  }
  status(actor: Actor, loadId: string) {
    return this.using(false, (db) => loadStatus(db, actor, loadId));
  }
  existingVersion(dataset: ValidatedDataset, actor: Actor) {
    return this.using(false, (db) =>
      db.transaction(true, async () => {
        await db.verifyPrivileges(false);
        await db.verifyActor(actor);
        const rows = await db.query<{ datasetVersion: string }>(
          'SELECT "datasetVersion" FROM reinsurance.historical_statement_load WHERE "tenantId"=$1 AND "datasetKey"=$2 AND "contentManifestSha256"=$3',
          [
            actor.tenantId,
            dataset.manifest.datasetKey,
            dataset.contentManifestSha256,
          ],
        );
        return rows[0]?.datasetVersion ?? null;
      }),
    );
  }
  currentPublication(actor: Actor) {
    return this.using(false, (db) =>
      db.transaction(true, async () => {
        await db.verifyPrivileges(false);
        await db.verifyActor(actor);
        const rows = await db.query<{ id: string }>(
          'SELECT id FROM reinsurance.historical_statement_load WHERE "tenantId"=$1 AND "datasetKey"=$2 AND status=\'PUBLISHED\'',
          [actor.tenantId, 'historical-statements-2021-2025'],
        );
        return rows[0]?.id ?? null;
      }),
    );
  }
  async execute(
    dataset: ValidatedDataset,
    plan: Plan,
    approvalRef: string,
    replaceDatasetId?: string,
  ) {
    if (plan.blockers.length || plan.action === 'CONFLICT')
      throw new ConflictException('ARCHIVE_VALIDATION_BLOCKED');
    if (
      !plan.stageOnly &&
      plan.currentLoadId &&
      plan.currentLoadId !== plan.existingLoadId &&
      replaceDatasetId !== plan.currentLoadId
    ) {
      throw new ConflictException('ARCHIVE_EXPLICIT_REPLACEMENT_REQUIRED');
    }
    const approval: WriteApproval = {
      reviewedPlan: plan,
      approvedPlanSha256: sha(plan),
      expectedManifestSha256: dataset.contentManifestSha256,
      confirmTenantId: plan.actor.tenantId,
      confirmDataset: `${plan.datasetKey}@${plan.datasetVersion}`,
      approvalRef,
      expectedCurrentLoadId: plan.currentLoadId,
      allowArchiveWrite: true,
      ...(plan.existingLoadId && plan.action === 'RESUME'
        ? { resumeLoadId: plan.existingLoadId }
        : {}),
      // Staging cannot supersede a publication. Only final publication requires the caller confirmation.
      ...(plan.stageOnly && plan.currentLoadId
        ? { replaceLoadId: plan.currentLoadId }
        : {}),
      ...(replaceDatasetId ? { replaceLoadId: replaceDatasetId } : {}),
    };
    return this.using(true, (db) => applyDataset(db, dataset, plan, approval));
  }
}
