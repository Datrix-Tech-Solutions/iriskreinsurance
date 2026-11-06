# Historical statements archive — Milestone 1

The HTTP module is additive and reference-only. It does not import workbooks, expose
archive row mutations, or call the operational legacy importer. There are no
relations to placements, participants, closings, notes, payments or counterparties.

## Proposed migrations

- Reinsurance: `20261105130000_add_historical_statement_archive` adds five archive
  models, three enums, composite tenant/load/file/year foreign keys, physical-row
  uniqueness and tenant-scoped Match IDs. All source numeric fields are
  `DECIMAL(30,12)`. Raw cells retain the 29-column contract including duplicate
  headers, source addresses, lexical values, styles, formula text and cached values.
- Auth: `20261105120000_add_historical_statements_entitlement` adds
  `Tenant.historicalStatementsEnabled`, default `false`, including existing tenants.

Neither migration enables a tenant or grants user permissions. Do not execute them
against DEV/PROD without a separate migration/deployment approval.

### Database lifecycle

New loads start `STAGING`. Identity, version, manifest hashes and source manifest
are immutable. Source files, insurer/reinsurer rows and approved links cannot be
updated, even while staging; staged correction requires an explicit delete/insert.

`STAGING -> READY -> PUBLISHED -> SUPERSEDED` is the normal publication path.
STAGING/READY can fail; an audited FAILED load may resume STAGING. Audited rollback
is permitted from nonterminal states; ROLLED_BACK is terminal. Superseded data can
be republished only through a new audited publication transition. Load provenance
cannot be deleted. TRUNCATE is rejected on every archive table.

Transitions require append-only actor/time/status events. READY/PUBLISHED verify
actual counts against `validationSummary` (`validated`, `fileCount`,
`insurerRowCount`, `reinsurerRowCount`, `linkCount`), file-level row counts and source
manifest descriptors (`kind`, `year`, `sha256`, `sheetName`, `headerSha256`). Only one
version per tenant/dataset key can be PUBLISHED. Published source content is frozen.

Content writers lock the parent load, serializing with publication. A future
loader must acquire the tenant/dataset advisory lock **before** locking/updating
loads in a multiversion publication transaction, then use a consistent load-lock
order. The advisory key is `hashtextextended(tenantId || ':' || datasetKey, 0)`.
This avoids opposite-order deadlocks; a database deadlock/serialization failure
must abort the entire publication, never partially publish.

Rollback must transition the load and delete links, source rows and files in one
transaction; the deferred constraint rejects commit with retained file content.
The load, manifest and lifecycle evidence remain. The M1 foundation itself exposes no rollback HTTP endpoint.
SQL validates declared provenance and relationships; it cannot prove external file
bytes or business approval. A later loader must independently verify hashes,
lexical numeric precision, source identity and approved Match ID evidence.

SQL triggers enforce normal write invariants, not protection against a database
owner/superuser that can drop triggers. Runtime SELECT-only archive grants and a
separate loader role need approved environment-specific provisioning before load;
this migration does not create global roles or revoke existing live-table grants.
No automatic tenant filtering/RLS is assumed. Future reads must require the
verified tenant context and scope every lookup, count, export and link traversal.

## Authorization

Public gateway namespace: `/api/v1/operations/reinsurance/historical-statements`.
M1 exposes only `GET /access` (downstream `/api/historical-statements/access`),
returning `{ "authorized": true }` after all guards. No source rows are returned.

The module requires Operations/Reinsurance availability and the dedicated archive
VIEW permission. It retains JwtAuthGuard, ModuleGuard and FeatureGuard. For archive
routes, HistoricalStatementsAccessGuard replaces the generic PermissionsGuard:
Auth-issued JWTs omit permissions, and embedded claims or gateway permission
headers may be stale. The dedicated guard reads RequirePermissions metadata and
enforces VIEW/EXPORT using Auth's fresh decision; direct-service employee requests
need no embedded permissions or gateway headers. Generic guards on live routes
remain unchanged. The archive guard forwards the original verified JWT to Auth
`GET /tenants/me/historical-statements-access` through server-configured
`AUTH_SERVICE_URL` (e.g. a trusted internal service origin, with no path/query).
It requires exact tenant/user identity, current entitlement, VIEW and, where
`HistoricalStatementsPermission.EXPORT` is required, EXPORT too. It has a total
two-second deadline, bounded response, no redirects, no positive cache and no
request-controlled destination. Missing Auth configuration fails archive requests
closed with 503 without preventing unrelated application startup.

Auth re-reads active DB user/tenant, current role, module/feature availability and
archive-specific direct/set permissions. Stale JWT roles cannot enable access.
TENANT_ADMIN/SUPER_ADMIN bypass resource grants only inside an enabled tenant;
they do not bypass platform entitlement or active-user/tenant checks.

Only a current SUPER_ADMIN can PATCH
`/tenants/:id/historical-statements-entitlement` with strict `{enabled, reason}`.
The toggle and audit entry commit together using Serializable isolation. Generic
feature/module edits cannot change this separate field. No tenant is enabled by
this code change. Generic live JWT/permission resolution remains unchanged; the
stricter strategy/resolver are archive-specific.

Resources are registered in both Auth definition lists and the frontend permission
map. No default permission set or Operations base-grant list receives the archive.
Future row/export endpoints must retain these guards and tenant-safe repositories;
export handlers must explicitly require VIEW plus EXPORT.

## Disposable integration tests

`historical-statements.database.spec.ts` is opt-in. It accepts only an explicit
`ARCHIVE_TEST_DATABASE_URL` using localhost/127.0.0.1 and a database name prefixed
`irisk_archive_m1_`; no DATABASE_URL fallback exists. It verifies the connected
server/database and requires a fresh database with no application schemas/objects.
It applies existing Reinsurance migrations, creates a synthetic operational
sentinel, then applies the new archive migration. Catalog/data snapshots verify
that operational schema/data remain unchanged. All fixture values are synthetic;
no client workbook or migration dataset is read. The Auth default-false migration
is also exercised against a synthetic Tenant table in this disposable database.

```sh
ARCHIVE_TEST_DATABASE_URL='<explicit fresh local test URL>' \
  npm run test:unit --workspace=apps/reinsurance-service -- \
  --runInBand historical-statements.database.spec.ts
```

Provision a **new** disposable database for each integration run. The test does not
reset or drop an existing database. Ordinary unit runs skip these database cases.
Loopback HTTP authorization tests use mock Auth/Prisma implementations and require
no external database. All test servers/connections are closed after completion.

## Milestone 2

Milestone 2A implements the separate offline reader, reviewed-plan loader, staging/
publication and archive rollback. See [loader/README.md](loader/README.md). These
commands are not exposed by HTTP and do not run during application startup.

Milestone 2B adds tenant-scoped, published-only dataset/list/detail/link/facet APIs
and genuine XLSX exports. The module remains registered in AppModule and reuses
the existing fresh authorization guards. See
[HISTORICAL-STATEMENTS-API-HANDOFF.md](HISTORICAL-STATEMENTS-API-HANDOFF.md) for the
complete frontend contract, source-field definitions, examples and error behavior.

Frontend browsing/gated navigation and strict export-audit integration remain
separate work. Original-file storage, retention/tenant-deletion checks,
backup/restore verification and role provisioning require the approved operations
plan.
Existing operational historical imports must remain untouched.

### Existing migration-history drift

A disposable rebuild of the existing Reinsurance migration history has operational
model/index/constraint drift predating M1. Comparing the pre-task Prisma schema to
that baseline and the new schema to the post-archive database produced identical
drift SQL. None of it concerns archive objects. Do not apply that diagnostic SQL
or fold its operational index/type/claim-uniqueness changes into this additive
migration. Reconcile existing drift separately before relying on an automatic
`migrate dev` diff against an existing development database.
