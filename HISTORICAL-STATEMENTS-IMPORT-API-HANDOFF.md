# Historical Statements Upload API

Implementation only. No tenant activation, original workbook load, deployment or
DEV/PROD migration is performed by this change.

## Authorization

Public gateway base: `/api/v1/operations/reinsurance/historical-statements`.
Use the application's existing authenticated cookie/Bearer session.

All three import endpoints require
`operations.reinsurance.historical-statements:IMPORT`, an administrator session,
and the **fresh** Auth decision `enabled=true, canImport=true` for that exact
session user/tenant. The platform-controlled entitlement and Operations/Reinsurance
feature must be enabled. Tenant admins inherit archive administrative access only
while entitled, following existing Auth administrator conventions; no grants are
seeded automatically. A non-administrator cannot import even with an IMPORT grant.

Auth's `GET /api/v1/auth/tenants/me/historical-statements-access` now includes
`canImport`; use it to hide upload controls when unavailable. Backend checks remain
authoritative. VIEW and EXPORT remain separately enforced by the existing read API.

Tenant/user IDs, source manifests, paths, hashes and match approvals are **not**
accepted from the browser. Forged tenant headers do not select another tenant.

## 1. Upload

`POST /imports` — multipart/form-data; returns **202**.

```ts
const data = new FormData();
const metadata: { index: number; kind: 'INSURER' | 'REINSURER'; year: number }[] = [];
for (let year = 2021; year <= 2025; year++) {
  for (const kind of ['INSURER', 'REINSURER'] as const) {
    const index = metadata.length;
    data.append('files', selectedWorkbooks[year][kind]);
    metadata.push({ index, kind, year });
  }
}
data.append('metadata', JSON.stringify(metadata));
await fetch(`${base}/imports`, { method: 'POST', credentials: 'include', body: data });
// Do not manually set Content-Type: the browser supplies the multipart boundary.
```

Exactly ten files are required: one of each kind for every year 2021–2025.
`index` refers to multipart `files` order. Metadata objects have exactly
`index`, `kind`, `year`. Only XLSX is accepted. The endpoint permits at most
16 MiB/file, ten files, one metadata field (8 KiB). Gateway/reverse-proxy upload
limits must support the chosen request limit; the app does not change deployment
configuration. Do not increase limits without reviewing reader memory/resource
bounds. Per process there is one worker, at most four queued/running jobs, and at
most two receiving upload requests (one receiving request per tenant).

The server generates hashes, a tenant-bound manifest, the fixed dataset key
`historical-statements-2021-2025`, and an immutable deterministic version
`sha256-<64 hex characters>` derived from kind/year/workbook hashes. If identical content already exists from a prior CLI/API load, its existing immutable version is reused instead (for example `v1`); always use the final READY response version. Initial state
is VALIDATING; counts are unvalidated zeroes until validation finishes.

```json
{
  "importId": "11111111-1111-4111-8111-111111111111",
  "datasetKey": "historical-statements-2021-2025",
  "datasetVersion": "sha256-<64 hex characters>",
  "datasetId": null,
  "currentPublishedDatasetId": null,
  "status": "VALIDATING",
  "insurerRowCount": 0,
  "reinsurerRowCount": 0,
  "totalRowCount": 0,
  "duplicateUpload": false,
  "publicationPermitted": false,
  "reportingYears": [2021, 2022, 2023, 2024, 2025],
  "files": [],
  "warnings": [],
  "errors": []
}
```

Actual `files` contains each original filename, kind, year, SHA-256 and nullable
`rowCount`. It never returns local storage paths, credentials or session tokens.

## 2. Poll

`GET /imports/:importId` — **200**, private/no-store.

Poll with backoff (for example 2–5 seconds), stopping at READY, FAILED, PUBLISHED or SUPERSEDED.
Only imports in the authenticated tenant are addressable; another tenant receives
404 even when the UUID exists. At READY, `datasetId` is the canonical archive load
UUID, counts are verified and `publicationPermitted=true`. READY is not published
and is not visible through the statement list/detail/export endpoints.

States map to the existing archive lifecycle, without new database states:

| API status | Meaning                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- |
| VALIDATING | Private durable upload receipt; parsing queued/in progress, before a Load exists                |
| STAGING    | Existing archive STAGING/chunk verification                                                     |
| READY      | Existing verified READY load, unpublished                                                       |
| PUBLISHING | Explicit publication queued/in progress; database remains READY until atomic commit             |
| PUBLISHED  | Existing PUBLISHED dataset, available through the read API                                      |
| FAILED     | Fatal validation/execution error; partial database staging, if any, stays unpublished/resumable |

The unmodified 29-column reader preserves raw/blank/missing cells, formulas and
cached values, physical rows/duplicates, original statuses, exact Decimal(30,12),
negative values, unusual dates, and independent RE Paid WHT columns. Historical
anomalies are nonfatal warning counts (`identicalGroups`, `identicalRows`,
`negativeNumericCells`, `epochDateCells`, `extremeYearCells`,
`reversedCoverageRows`). Raw quality flags remain on the archive rows. Warnings do
not rewrite or discard records. The offline CLI's original corpus certification
profile remains its default; the API explicitly selects the uploaded profile,
which does not demand the original client's exact row/anomaly counts.

Unsafe ZIP/XML, bad headers, precision/structural failures, tampering and hash
mismatches are fatal. Error codes identify AUTHORIZATION, VALIDATION,
DATABASE_PLAN or EXECUTION failure without exposing raw cells/SQL/credentials.
An administrator can reupload the same ten workbooks with a fresh session to
resume/reverify their identical dataset; it does not create duplicate source rows.
Original approval or rollback rules cannot be bypassed by retries.

## 3. Publish explicitly

`POST /imports/:importId/publish` — **202**, then poll the same import.

```json
{
  "datasetVersion": "sha256-<exact version returned by READY>",
  "approvalRef": "<real operator publication reason/change reference>"
}
```

This explicitly approves **all-unlinked** publication. No relationships are guessed.
This initial HTTP contract does not accept matching manifests; existing separately
approved physical-row matching remains outside this upload screen.

If `currentPublishedDatasetId` refers to a different dataset, require an explicit
replacement confirmation in the UI and submit `replaceDatasetId` with that exact
UUID. Never infer or silently populate this confirmation. A changed current
publication or version causes conflict/failure and requires renewed review.

The worker validates original bytes again, obtains a fresh read-only plan, rechecks
Auth and active DB actor/entitlement, and invokes the existing archive lifecycle.
It atomically supersedes/publishes under the existing tenant/dataset advisory
lock. Staging a replacement never supersedes the current published dataset.
Duplicate publication is idempotent. Concurrent requests are serialized by an
exclusive private-file claim and the database advisory lock/CAS.

After PUBLISHED, navigate using `datasetId` through the existing Historical
Statements pages. The import receipt UUID and canonical dataset UUID are distinct.

## Errors and recovery

Standard Nest error responses: 400 metadata/type/DTO errors; 401 invalid session;
403 disabled/revoked access or non-admin; 404 tenant-scoped import missing;
409 busy/not-ready/version/current-publication conflict; 413 file limits;
429 receiving/worker capacity; 503 missing secure storage/database prerequisites.
A worker failure is reported by GET status, not as a late HTTP upload error.

Tokens are held in worker memory only and are never stored in receipts/manifests.
Expired/revoked sessions fail closed before staging/publication. After process
interruption, reupload with a fresh authorized session to resume through the
existing verified lifecycle. A stale old receipt can remain in its last in-progress
state; the reupload produces a new receipt for the same immutable dataset.
Do not remove possibly active lock files automatically. An abandoned receipt lock
must be inspected by operations; reupload uses a separate receipt directory while
the database lock protects the canonical dataset. No automatic rollback is added.

## Required runtime provisioning (not performed by this implementation)

- Additive Auth migration `20261106160000_add_historical_statement_import_permission`
  adds IMPORT to `w_auth.PermissionAction`. No archive/operational table changes.
- `HISTORICAL_STATEMENTS_UPLOAD_ROOT`: pre-provisioned, canonical absolute path,
  service-owned mode0700, outside Git, on an approved durable encrypted private
  volume. All replicas serving these routes must share it. Stored files and job
  metadata are mode0600; files are kept tenant/receipt isolated with original names
  and hashes. Private incoming files are removed after move or rejected requests.
- Original accepted/staged/failed sources are retained on that approved volume,
  including idempotent retry receipts. No unreviewed deletion policy is invented;
  use approved retention/failure cleanup and storage quotas/backups. Do not use an
  ephemeral container filesystem or public web/static directory.
- `ARCHIVE_DATABASE_IDENTITY_FILE`: reviewed private JSON matching the loader's
  existing local/dev identity contract, with `purpose=ARCHIVE`. Disposable test
  entitlement bypass is deliberately rejected in the HTTP execution component.
- `ARCHIVE_READ_DATABASE_URL` and `ARCHIVE_WRITE_DATABASE_URL`: distinct dedicated
  credentials, loaded through the approved secret mechanism. No DATABASE_URL
  fallback, owner credential, shell/CLI subprocess or operational importer call.
- Existing `AUTH_SERVICE_URL`: fresh access decisions; no positive authorization cache.
- Verified TLS for DEV, using the approved provider CA (for example process-scoped
  `NODE_EXTRA_CA_CERTS`). Never disable verification. Exact login-role identity must
  match PostgreSQL current_user; resolve the existing pooler/direct-endpoint issue
  during provisioning rather than weakening loader checks.

Minimum grants remain those documented in `loader/README.md`: reader SELECT on
five archive tables; writer SELECT all five, INSERT/UPDATE on Load, INSERT/DELETE
on the other four. Both need USAGE on reinsurance/w_auth and only the Auth
Tenant/User columns used by actor verification (Tenant id/slug/status/moduleConfig/
featureConfig/historicalStatementsEnabled; User id/tenantId/role/status).
Neither role may own/create schemas, TRUNCATE, inherit privileged roles, or modify
operational tables. Every stage/publish uses the existing privilege checks.
The ordinary API read Prisma client is not substituted for the dedicated writer.

No tenant entitlement, permission grants, database roles, production settings or
client source records are automatically created by this feature.

## Implementation file manifest

These 29 paths are the upload-extension scope. Existing unrelated dirty
files and the pre-existing M1/M2/legacy-import changes are preserved.

- `apps/auth-service/prisma/schema.prisma`
- `apps/auth-service/prisma/migrations/20261106160000_add_historical_statement_import_permission/migration.sql`
- `apps/auth-service/prisma/seed-resources.ts`
- `apps/auth-service/src/permissions/dto/grant-permission.dto.ts`
- `apps/auth-service/src/permissions/permissions.service.ts`
- `apps/auth-service/src/permissions/resource-definitions.ts`
- `apps/auth-service/src/tenants/historical-statements-entitlement.service.ts`
- `apps/auth-service/src/tenants/historical-statements-entitlement.service.spec.ts`
- `apps/auth-service/src/tenants/historical-statements-entitlement.controller.spec.ts`
- `apps/reinsurance-service/package.json`
- `apps/reinsurance-service/src/historical-statements/historical-statements.module.ts`
- `apps/reinsurance-service/src/historical-statements/historical-statements.permissions.ts`
- `apps/reinsurance-service/src/historical-statements/historical-statements-access.client.ts`
- `apps/reinsurance-service/src/historical-statements/historical-statements-access.guard.ts`
- `apps/reinsurance-service/src/historical-statements/historical-statements-access.guard.spec.ts`
- `apps/reinsurance-service/src/historical-statements/loader/dataset.ts`
- `apps/reinsurance-service/src/historical-statements/loader/lifecycle.database.spec.ts`
- `apps/web/work-phelo-rein-web/src/lib/permissionMap.ts`
- `apps/web/work-phelo-rein-web/src/types/roles.ts`
- `package-lock.json`
- `HISTORICAL-STATEMENTS-IMPORT-API-HANDOFF.md`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.controller.ts`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.dto.ts`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.executor.spec.ts`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.executor.ts`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.http.spec.ts`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.service.spec.ts`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.service.ts`
- `apps/reinsurance-service/src/historical-statements/imports/archive-import.storage.ts`

## Validation evidence

- Complete Auth unit suite: 27 suites / 289 tests passed.
- Complete Reinsurance unit suite: 93 suites / 1,395 tests passed; 102 opt-in tests
  skipped in the normal invocation. Archive database suites were enabled separately.
- Complete archive suite with fresh disposable PostgreSQL databases: 11 suites /
  236 tests passed; one full-client-corpus test deliberately skipped. No original
  client workbooks were uploaded in testing.
- Real PostgreSQL checks exercised archive constraints, source precision, reader/
  writer privileges, unpublished staging, explicit/atomic publication, unchanged
  operational data, replacement protection, idempotency and tenant isolation.
- Proposed Auth enum migration applied only to a disposable synthetic database.
- Auth and Reinsurance Prisma validate/generate, lint, typecheck and builds passed.
  Auth lint retains existing warnings; Reinsurance lint has no errors/warnings.
- Frontend permission files lint and frontend TypeScript check passed.
- RBAC alignment and git diff whitespace checks passed.
- No DEV/PROD access, original-source load, tenant enablement, deployment, staging,
  commit or push was performed by this implementation task. Synthetic rows exist
  only in disposable local test databases.
