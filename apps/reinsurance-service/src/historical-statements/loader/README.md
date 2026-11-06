# Offline historical statements loader (Milestone 2A)

This is separate from `legacy-import`. It writes only the five archive tables.
No operational importer, notification, accounting, HTTP row API or frontend is
called. No environment file is loaded implicitly; **DATABASE_URL is not used**.
The canonical command is `npm run historical:statements --workspace=apps/reinsurance-service --`
(`archive:statements` is an alias).
All paths below are placeholders, not authorization to load any environment.

## Source contract and validation

`--manifest-file` is private JSON with:

```json
{
  "contractVersion": "historical-statements/2021-2025/v1",
  "datasetKey": "historical-statements-2021-2025",
  "datasetVersion": "reviewed-v1",
  "tenantId": "<exact tenant>",
  "allUnlinked": true,
  "files": [
    {
      "path": "<relative original filename>",
      "kind": "INSURER",
      "year": 2021,
      "sha256": "<64 lowercase hex characters>"
    }
  ]
}
```

Supply **ten** distinct files: INSURER and REINSURER for each year 2021–2025.
`--dataset-key` and `--dataset-version`, if supplied, must exactly match the manifest/load.
Paths resolve inside `--source-root`; realpath confinement rejects escaping
symlinks. Optional per-file `rawStorageProvider`/`rawStorageKey` record the approved
immutable storage locator; otherwise the original local source path is retained.
The files are never rewritten, moved, deleted, recalculated or deduplicated.

```sh
npm run archive:statements --workspace=apps/reinsurance-service -- \
  --mode validate --source-root '<original workbook directory>' \
  --manifest-file '<private source manifest>' \
  --output-file '<private directory outside Git>/validation.json'
```

This mode cannot connect to a database and rejects database/actor/write flags.
It records observed per-file counts, source/header/physical-row hashes and source
profile discrepancies; a discrepancy remains visible and blocks apply. It does
not force observations to match the accepted 16,521-row profile. Physical duplicate
rows remain distinct. The report year is the manifest year, not the Offer Date.

The ZIP reader rejects traversal, symlink/encrypted entries, duplicate entries,
external relationships, DTD/entity declarations, active embedded content and
excessive compressed/inflated/XML resources. Limits per file: 64 MiB compressed,
256 MiB inflated, 10,000 entries, 100,000 rows, 64 XML levels, 2 million XML nodes,
1 MiB text token. It preserves 29 physical cell objects, headers, addresses, styles,
formula text/cached values (never recalculated), lexical values and blank/missing/
zero distinctions. RE V/W are two independent `Paid WHT` fields. Source errors are
flagged; unparseable dates retain raw text with null typed dates. No rounding is
allowed for Decimal(30,12); amounts never pass through JavaScript Number. Date
text DD-MM-YYYY becomes YYYY-MM-DD via calendar validation, without local timezone
parsing; 1970, distant years and reversed ranges remain with quality flags.

## Optional, explicitly approved links

Use `allUnlinked: false`, `matchManifestSha256` (SHA-256 of the exact match file
bytes), and `--match-manifest-file` together. The manifest contract is
`historical-statement-links/v1` and binds `tenantId`, `datasetKey`, `datasetVersion`
and `groups`. Each group requires `matchId`, one `insurer` reference, nonempty
`reinsurers`, `basis` (SUPPLIED_AUTHORITATIVE or APPROVED_CANDIDATE), `approvalRef`,
`approvedByUserId`, UTC `approvedAt`, and nonempty JSON `evidence`. Each reference
contains `fileSha256`, `sheet: Brokerage Statement`, physical `sourceRow` and
`rowSha256`. References must resolve exactly to the original kind and row.
Each insurer has one group; each reinsurer occurrence has one owner. Duplicate,
ambiguous, unapproved or cross-tenant/dataset references fail closed. This loader
never generates approvals or discovers matches heuristically. `allUnlinked: true`
requires no match file or approval records.

## Read-only database plan and status

A reviewed private `--identity-file` contains:

```json
{
  "environment": "local",
  "host": "127.0.0.1",
  "port": 55481,
  "database": "<explicit database>",
  "schema": "reinsurance",
  "readRole": "<dedicated archive reader>",
  "role": "<separate archive loader>",
  "purpose": "ARCHIVE"
}
```

`ARCHIVE_READ_DATABASE_URL` must match its host/port/database/readRole exactly.
`--environment local|dev` must match too. Local requires loopback; dev uses verified
TLS. Only optional `?schema=reinsurance` is accepted; URL options cannot redirect
the connection. Reader and writer credentials are never written into plans.

```sh
npm run archive:statements --workspace=apps/reinsurance-service -- \
  --mode dry-run --environment local --identity-file '<identity.json>' \
  --tenant-id '<tenant>' --tenant-slug '<slug>' --import-user-id '<admin>' \
  --manifest-file '<manifest.json>' --source-root '<original directory>' \
  --stage-only --output-file '<private directory>/plan.json'
```

Database reads run in SERIALIZABLE READ ONLY transactions. Plans bind exact actor,
environment, source content, version, current publication, existing load/status,
counts, blockers and whether to stop at READY. Counts describe desired archive
content, not newly created rows; action SKIP means zero writes. `planSha256` is
SHA-256 of canonical sorted JSON **plan**, not the enclosing report bytes. The
reviewed plan expires after 24 hours. Status uses the same identity/actor flags,
`--mode status --load-id '<exact load>'`, and an output file; no source is required.

## Guarded apply and resume

Apply repeats source validation and creates a fresh read-only plan before opening
a write connection. `ARCHIVE_WRITE_DATABASE_URL` must match the loader role and
reviewed database identity. In addition to dry-run identity/source/actor flags:

```sh
# Append to the same reviewed dry-run arguments, replacing --mode and output:
--mode apply --allow-archive-write \
--reviewed-plan-file '<plan.json>' --approved-plan-sha256 '<planSha256>' \
--expected-manifest-sha256 '<contentManifestSha256>' \
--confirm-tenant-id '<tenant>' --confirm-dataset '<datasetKey>@<datasetVersion>' \
--approval-ref '<explicit approval reference>' \
--expected-current-load-id NONE --output-file '<private directory>/result.json'
```

Use the exact published load UUID instead of NONE when replacing a dataset, and
also provide `--replace-load-id` with that same UUID. `--match-file` and
`--expected-database-identity-file` are accepted aliases for the longer match option
and identity option. The plan binds the loader/parser contract and a SHA-256
fingerprint of the executing reader/loader/CLI files. Resume requires the same
loader build, not merely the same workbook content.
Resume additionally requires `--resume-load-id` matching the reviewed unfinished
load. `--batch-size` defaults 250 and is limited to 1–500. Apply reserves its private
result file before connecting the writer. Output directories must be owned, mode
0700, outside Git; files are created exclusively mode0600 and never overwritten.
Errors never print connection details or raw cell values. A failed/interrupted
write result requires status inspection; it is not evidence of complete rollback.

All actor checks are fresh database reads: exact active tenant/slug, active admin
user, Operations/Reinsurance availability and platform entitlement. No tenant is
enabled. Only explicitly marked `purpose: DISPOSABLE_TEST` on loopback database
names `irisk_archive_m2a_*` can use `--allow-unentitled-local-test`; it cannot bypass
checks on a local application or DEV database. Real test corpus remains unlinked
and unpublished; publication testing uses synthetic approved fixtures only.

A dedicated session advisory lock serializes a tenant/dataset across bounded
transactions. Each chunk and its progress commit together. Crash/interruption
leaves STAGING or audited FAILED, never visible published data. Resume verifies
stored files, exact raw/typed fields, search metadata, row lineage and approved
link evidence before inserting missing rows. Final complete verification precedes
READY. Source bytes are checked again before publication. READY publication
atomically supersedes the old version and publishes the replacement in one
transaction; stale plans/current-load changes abort. Published/superseded identical
content is a verified no-op. Renaming identical bytes does not duplicate content.
Changing bytes requires a new reviewed version. Rolled-back content is terminal;
restoration is intentionally not automated.

## Archive-only rollback

Read-only planning:

```sh
# Same identity/actor flags as above; no workbook flags required:
--mode rollback --load-id '<exact load>' --output-file '<private directory>/rollback-plan.json'
```

To execute, a separate reviewed authorization uses the write flags above plus
`--confirm-load-id '<same load>'`. Recheck tenant, status, manifest, publication and
exact table counts under the dataset lock. One transaction transitions ROLLED_BACK,
deletes only that tenant/load's links, insurer rows, reinsurer rows and file rows,
and retains the load, source manifest and append-only events. Original workbooks
and other loads/tenants are untouched. It does not restore a superseded publication
automatically. A new reviewed rollback plan returns ALREADY_ROLLED_BACK safely.

## Database roles and deployment gates

Provision roles separately under environment-specific approval; no global role or
grant migration runs automatically. Runtime/reader: SELECT on five archive tables,
USAGE on reinsurance/w_auth, and limited SELECT on the Auth Tenant/User columns
used by actor verification. Loader: SELECT on all archive tables, INSERT/UPDATE on
Load, INSERT/DELETE on the other four (no content UPDATE, no Load DELETE).
Neither may own tables/schemas or have CREATE, TRUNCATE, superuser, createdb,
createrole, bypassrls, inherited operational DML or column-level operational writes.
Existing broad application Prisma credentials are deliberately rejected. Separate
role provisioning, entitlement approval and source/match review remain DEV gates.
No row-level security is assumed; every repository query is tenant/load scoped.

## Disposable tests

`lifecycle.database.spec.ts` requires a **fresh** loopback
`ARCHIVE_LOADER_TEST_DATABASE_URL` named `irisk_archive_m2a_*`; it never resets an
existing database or uses DATABASE_URL. It applies repository migrations only to
that fresh database, provisions synthetic roles and a disabled synthetic tenant,
and tests real grants/constraints. Supply `ARCHIVE_SOURCE_MANIFEST_FILE` and
`ARCHIVE_SOURCE_ROOT` for the optional full-corpus test: it exercises the actual
CLI read-only plan, stage-only apply and archive rollback, verifies all rows and
never publishes client data. `ARCHIVE_TEST_EVIDENCE_FILE` saves restricted evidence.
Publication/replacement/link/resume/concurrency tests use only synthetic data.
The original M1 database suite independently covers SQL-trigger negative paths.
