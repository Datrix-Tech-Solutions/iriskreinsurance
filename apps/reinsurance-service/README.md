# WorkPhelo Reinsurance Service

`reinsurance-service` owns broker-focused Reinsurance Operations. It is
separate from Auth, HR and Accounting, and it owns the PostgreSQL `reinsurance`
schema.

## Responsibilities

- Counterparties for cedants, reinsurers and brokers.
- Risk classes, risk types, risk fields, currencies, taxes and levies.
- Facultative placements, participants, lifecycle transitions and archive/restore.
- Placement force close and automatic close from confirmed closing snapshots.
- Endorsements, endorsement participants, reinvite, force close and close readiness.
- Effective business view/position based on original placements plus closed,
  effective endorsements.
- Original and endorsement closings, debit notes, credit notes and current
  effective debit-note statements.
- Placement attachments and backend-rendered document registry/PDF downloads.
- Cedant premium receipts, reinsurer disbursements and operational payment history.
- Claims, allocations, cash calls, recoveries, cedant settlements and claim
  payable approval.
- Optional Reinsurance-to-Accounting source-event capture, outbox dispatch and
  reconciliation.

## Gateway Prefix

```text
/api/v1/operations/reinsurance/*
```

Direct local service routes use:

```text
/api/*
```

## Local Development

```bash
npm run dev --workspace=apps/reinsurance-service
```

Default local port: `4007`

Local Swagger: `http://localhost:4007/api/docs`

## Database

```bash
npm run db:generate --workspace=apps/reinsurance-service
npm run db:migrate --workspace=apps/reinsurance-service
npm run db:validate --workspace=apps/reinsurance-service
```

Only this service should apply Reinsurance migrations.

## Authentication and Permissions

Requests are tenant-scoped through JWT/cookie authentication and gateway
forwarded tenant/user context. Most APIs require the tenant to have the
`operations` module, `operations.reinsurance` feature and an endpoint-specific
permission such as:

- `operations.reinsurance.placements:*`
- `operations.reinsurance.counterparties:*`
- `operations.reinsurance.settings:*`
- `operations.reinsurance.email:*`
- `operations.reinsurance.email-settings:*`

The service does not accept tenant ownership from request bodies.

## Current Business Behavior

### Placements

Placements are the original business record. Direct edits are allowed only when
the placement is not locked by downstream business history. Safe edits reopen
eligible placements to market using backend rules. Participants are preserved;
official historical notes/documents are voided or superseded rather than
deleted where the lifecycle requires it.

Capacity and lifecycle truth is based on confirmed placement closing snapshots,
not draft closings or frontend calculations. Force close is explicit and does
not replace normal automatic close behavior.

### Endorsements

Endorsements are versioned adjustment records. They never mutate original
placements, original participants or original closings. Closed and effective
endorsements are replayed chronologically into the effective business view.
Future-dated closed endorsements are scheduled, not applied to current state.

Endorsement force close uses confirmed endorsement closing snapshots as the
effective capacity. Proposed target capacity remains historical only. Declined
endorsement participants may be reinvited without overwriting prior invitation
history.

### Effective View and Claims

The effective view and effective position services are the canonical backend
projection for current business state. Claims allocation uses the effective
position as of the loss date and preserves original closing and endorsement
closing history.

### Notes and Documents

Debit notes, credit notes, endorsement notes and current effective debit-note
statements are generated from backend snapshots. Current effective debit notes
are consolidated, non-posting statements to avoid duplicating receivables that
were already recognized by original and endorsement notes.

Supported official documents use backend-rendered PDFs, document registry rows,
immutable source snapshots and signed private download URLs. Browser previews
must not be treated as official documents.

### Payments

Cedant premium receipts and reinsurer disbursements are immutable operational
records. Reinsurer disbursement financial recognition occurs only after
Accounting bank confirmation moves the payment to `BANK_CONFIRMED`.

### Claims Accounting Scope

Phase 1 claim payable approval is one claim-level broker confirmation after
required reinsurer approvals have been obtained externally:

```text
Claim -> Claim Payable Approval -> Accounting Event
```

It does not store one approval per participating reinsurer. Allocation-level
recovery approval is implemented separately for Reinsurer receivable recognition:

```text
Claim Allocation -> Claim Recovery Approval -> Accounting Event
```

Claim recovery approvals are per participating reinsurer/allocation and may be
recorded cumulatively up to the allocation liability. They do not represent cash
receipt. Recovery receipts, cedant settlements, their financial confirmations and
their reversal flows are managed entirely within Reinsurance and do not require
Accounting readiness or publish Accounting source events.

## Accounting Integration

Reinsurance-to-Accounting is an explicit tenant module relationship
(`operations.reinsurance->accounting`). Both modules can be enabled while this
relationship remains disconnected. Only when Reinsurance, Accounting and the
explicit relationship are all enabled does Reinsurance capture supported
financial events in a transactional outbox and dispatch them over signed
internal transport. Disconnected tenants retain their modules independently;
pending outbox history is retained but is not delivered.

Active Reinsurance event families include:

- `DEBIT_NOTE_ISSUED`
- `CREDIT_NOTE_ISSUED`
- `ENDORSEMENT_DEBIT_NOTE_ISSUED`
- `ENDORSEMENT_CREDIT_NOTE_ISSUED`
- `PREMIUM_PAYMENT_RECEIVED`
- `PAYMENT_REVERSED`
- `REINSURER_DISBURSEMENT_RECORDED`
- `REINSURER_DISBURSEMENT_REVERSED`

Accounting owns posting rules, journal creation, fiscal period validation and
financial confirmation queues for these non-claim financial events.
Reinsurance Claims are financially controlled inside Reinsurance and do not
publish claim source events to Accounting. Historical claim source events that
were already delivered remain Accounting history; pending, processing and failed
claim outbox rows are retired by migration and are not dispatched.

When the explicit integration is active, Reinsurance performs an Accounting
readiness preflight before irreversible financial boundaries such as note
issuance, premium bank confirmations and reinsurer disbursement confirmations or
reversals. The preflight calls Accounting over the signed internal API and
blocks the operation with a controlled conflict if PostingRules,
control-account shape, currency, fiscal period or cash-account setup is not
ready.

If the integration is disconnected, Reinsurance preserves the established
operational behavior and does not block business actions merely because
Accounting automation is unavailable. The readiness endpoint reports the
intentional disconnected state without calling Accounting. Manual dispatcher,
reconciliation and subledger-sync operations refuse to bypass that setting.

Operational integration endpoints use
`operations.reinsurance.accounting-operations:VIEW` for dispatcher diagnostics
and `:EDIT` for manual dispatch, reconciliation and subledger synchronization.
The existing `TENANT_ADMIN`/`SUPER_ADMIN` bypass remains intentionally unchanged
for compatibility; maker-checker and broader SoD policy are deferred. Ordinary
placement bank-confirmation permissions are unchanged.

Reinsurance Accounting integration endpoints are retained only as compatibility
surfaces and return `410 Gone`. Reinsurance financial workflows are controlled
inside Reinsurance and no longer publish, dispatch, or reconcile live Accounting
events.

## Key Environment Variables

| Variable                                       | Required                       | Secret | Purpose                               |
| ---------------------------------------------- | ------------------------------ | ------ | ------------------------------------- |
| `DATABASE_URL`                                 | Yes                            | Yes    | Reinsurance PostgreSQL schema         |
| `JWT_SECRET`                                   | Yes                            | Yes    | User JWT verification                 |
| `RABBITMQ_URL`                                 | Yes                            | Yes    | Messaging publisher configuration     |
| `RABBITMQ_PUBLISH_TIMEOUT_MS`                  | Optional                       | No     | Publisher timeout override            |
| `ACCOUNTING_SERVICE_URL`                       | Historical compatibility only  | No     | Retired Accounting integration target |
| `ACCOUNTING_SERVICE_TIMEOUT_MS`                | Historical compatibility only  | No     | Retired Accounting HTTP timeout       |
| `INTERNAL_SERVICE_AUTH_SECRET`                 | For Auth/document integrations | Yes    | Signed internal-service requests      |
| `AUTH_SERVICE_URL`                             | For document profile lookups   | No     | Auth tenant profile endpoint base     |
| `REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS` | Optional                       | No     | Tenant profile cache TTL              |
| `REINSURANCE_TENANT_PROFILE_TIMEOUT_MS`        | Optional                       | No     | Tenant profile request timeout        |
| `REINSURANCE_DOCUMENT_STORAGE_PROVIDER`        | For persisted documents        | No     | `cloudinary` or `s3` storage provider |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`          | Optional                       | No     | PDF renderer Chromium path            |
| `REINSURANCE_ATTACHMENT_ALLOWED_MIME_TYPES`    | Optional                       | No     | Upload MIME allow-list                |
| `REINSURANCE_ATTACHMENT_MAX_BYTES`             | Optional                       | No     | Upload size limit                     |
| `REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY`     | For mailbox connections        | Yes    | Encrypt provider tokens               |

Production Reinsurance document storage uses private Cloudinary authenticated
raw assets for new PDFs and attachments. Production sets
`REINSURANCE_DOCUMENT_STORAGE_PROVIDER=cloudinary` and requires
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
`REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER` controls the Cloudinary namespace
and `REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS` controls signed-read lifetime.

Stored references are provider-qualified for Cloudinary
(`cloudinary:raw:authenticated:<public_id>`). Historical plain object keys remain
treated as S3 references for backward-compatible reads when the corresponding S3
configuration is available.

Production RabbitMQ is expected to be supplied through `PROD_RABBITMQ_URL` as an
external broker connection. The production compose file intentionally does not
start a RabbitMQ container.

For tenant document profiles, Auth must receive the same
`INTERNAL_SERVICE_AUTH_SECRET`, and `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`
must include `reinsurance-service`.

Retired Accounting outbox dispatcher compatibility configuration. The dispatcher
is disabled by default after decoupling:

- `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED`
- `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS`
- `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_BATCH_SIZE`
- `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_PROCESSING_TIMEOUT_MS`
- `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_RETRY_DELAY_MS`
- `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_MAX_ATTEMPTS`

## Validation

```bash
npm run test --workspace=apps/reinsurance-service
npm run lint --workspace=apps/reinsurance-service
npm run check-types --workspace=apps/reinsurance-service
npm run build --workspace=apps/reinsurance-service
npm run db:validate --workspace=apps/reinsurance-service
```

## Operational Limitations

- Treaty workflows are UI/navigation-present but not equivalent to the
  facultative backend workflow yet.
- Allocation-level claim approvals are future work.
- Policy-gated Claims events should remain documented as inactive until they are
  implemented and validated.
- Accounting posting depends on tenant posting-rule configuration.
