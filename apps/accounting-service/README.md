# WorkPhelo Accounting Service

The Accounting Service owns tenant-scoped ledgers, posting policy and financial
recognition. It must remain independently usable even when operational modules
such as Reinsurance are unavailable or disabled.

## Responsibilities

- Chart of Accounts, account hierarchy and account status.
- Fiscal periods, currencies, cost centres and accounting settings.
- Manual journals, posting, reversal and General Ledger reads.
- Customers/vendors and subledger references.
- Cash, bank and wallet account masters.
- Standalone cashbook receipts, payments, transfers, bank charges and adjustments.
- Standalone Accounts Receivable invoices, customer credit notes, cashbook-backed
  receipts, allocations and balances.
- Standalone Accounts Payable bills, vendor credit notes, cashbook-backed
  payments, allocations and balances.
- Posting rules for source-module events.
- Source Event Inbox, idempotency, reconciliation and retry state.
- Financial Confirmation Queue adapters for optional source modules.

Accounting chooses GL accounts through tenant posting rules. Source modules
publish business facts only.

### Control Account + Subledger Dimensions

Accounting tracks legal counterparties through subledger accounts, but the
financial obligation is the combination of:

```text
GL control account + counterparty subledger
```

The same legal Cedant or Reinsurer may therefore have multiple active
subledger dimensions when the obligations are economically different. For
example, a Reinsurer can have a premium payable balance and a claims recovery
receivable balance at the same time. Those positions must not net together
unless Accounting posts an explicit approved settlement or journal.

Posting rules are responsible for selecting the correct control account for
each source-event line. Source-event posting resolves or creates the
corresponding CEDANT/REINSURER subledger dimension using the posting-rule GL
control account, while customer/vendor master sync continues to maintain the
tenant default AR/AP dimensions.

## Gateway Prefix

```text
/api/v1/accounting/*
```

Direct local service routes use the global prefix:

```text
/api/*
```

Internal source-event and subledger ensure endpoints intentionally bypass the
global `/api` prefix and require signed internal-service authentication.

Internal Reinsurance readiness checks use:

```text
POST /internal/reinsurance/accounting-readiness
```

The endpoint is HMAC-protected and validates tenant Accounting setup before
Reinsurance accepts financially recognizable business facts.

## Local Development

```bash
npm run dev --workspace=apps/accounting-service
```

Default local port: `4008`

Local Swagger: `http://localhost:4008/api/docs`

## Database

```bash
npm run db:generate --workspace=apps/accounting-service
npm run db:migrate --workspace=apps/accounting-service
npm run db:validate --workspace=apps/accounting-service
```

The service owns the Accounting Prisma schema and migrations. Do not apply
Reinsurance migrations through Accounting.

## Key Environment Variables

| Variable                                       | Required                | Secret | Purpose                                                     |
| ---------------------------------------------- | ----------------------- | ------ | ----------------------------------------------------------- |
| `DATABASE_URL`                                 | Yes                     | Yes    | Accounting PostgreSQL schema                                |
| `JWT_SECRET`                                   | Yes                     | Yes    | User JWT verification                                       |
| `INTERNAL_SERVICE_AUTH_SECRET`                 | For source integrations | Yes    | HMAC verification for internal source-event/subledger calls |
| `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`       | Optional                | No     | Comma-separated allowed internal service names              |
| `INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS` | Optional                | No     | Internal request timestamp skew window                      |
| `ENABLE_SWAGGER`                               | Optional                | No     | Explicit Swagger enable/disable                             |
| `DEPLOY_ENV`                                   | Optional                | No     | Dev/prod Swagger default behavior                           |

## Integrations

Reinsurance is currently the first operational source-module integration. Active
source-event families include issued debit/credit notes, endorsement notes,
premium receipts and reversals, and bank-confirmed reinsurer disbursements and
reversals.

Reinsurance Claims are currently financially controlled inside Reinsurance and
do not publish new claim source events to Accounting. Historical claim source
events that were already delivered remain immutable Accounting history and may
still be readable through source-event/journal history, but they are not part of
the active Reinsurance readiness matrix.

### Active Reinsurance AR/AP Matrix

| Event                              | Recognition boundary                             | Business meaning                                  |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| `DEBIT_NOTE_ISSUED`                | Official placement debit note issue time         | Cedant owes premium to broker                     |
| `CREDIT_NOTE_ISSUED`               | Official placement credit note issue time        | Broker owes premium share to Reinsurer            |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`    | Official endorsement debit note issue time       | Additional premium due from Cedant                |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`   | Official endorsement credit note issue time      | Return premium or payable adjustment to Reinsurer |
| `PREMIUM_PAYMENT_RECEIVED`         | Accounting confirmation time (`bankConfirmedAt`) | Cedant payment clears receivable                  |
| `PAYMENT_REVERSED`                 | Reversal row creation time                       | Premium receipt reversal                          |
| `REINSURER_DISBURSEMENT_RECORDED`  | Accounting confirmation time (`bankConfirmedAt`) | Confirmed Reinsurer settlement                    |
| `REINSURER_DISBURSEMENT_REVERSED`  | Reversal row creation time                       | Reinsurer disbursement reversal                   |

The active control-account dimensions are intentionally separate:

| Obligation dimension | Counterparty type | Typical source events                                  |
| -------------------- | ----------------- | ------------------------------------------------------ |
| Cedant Premium AR    | `CEDANT`          | Debit notes, endorsement debit notes, premium receipts |
| Reinsurer Premium AP | `REINSURER`       | Credit notes, endorsement credit notes, disbursements  |

Reports and subledger listings should present balances by control-account
dimension. Reinsurance claim settlement and recovery balances are currently
managed in Reinsurance rather than posted into Accounting control-account
dimensions.

Operational Reinsurance payments can be recorded before Accounting recognition.
No Accounting outbox event is created at that point for bank-confirmed
workflows; recognition starts at the Accounting-owned confirmation boundary.

### Reinsurance Posting Readiness

Accounting is authoritative for posting readiness. A tenant can have Accounting
enabled while still being transaction-not-ready for a specific Reinsurance event
because required tenant configuration is missing or inactive.

Readiness has two levels:

- Module readiness confirms the tenant has Accounting configuration and
  high-level setup.
- Transaction readiness confirms a specific event can be posted for its business
  date, currency, settlement method and selected cash account.

The readiness preflight checks:

- active tenant Accounting configuration
- active/effective tenant PostingRule for each event type
- PostingRule debit/credit shape and subledger-control dimensions
- active, postable GL accounts referenced by PostingRule lines
- open fiscal period for the event business date
- active Accounting currency for the event currency
- selected or configured Accounting cash account for cash-impact methods

Stable blocker codes include
`ACCOUNTING_INTEGRATION_DISABLED`, `POSTING_RULE_MISSING`,
`POSTING_RULE_INACTIVE`, `POSTING_RULE_INVALID`, `CONTROL_ACCOUNT_MISSING`,
`CONTROL_ACCOUNT_INACTIVE`, `CONTROL_ACCOUNT_NOT_POSTABLE`,
`CURRENCY_MISSING`, `CURRENCY_INACTIVE`, `FISCAL_PERIOD_MISSING`,
`FISCAL_PERIOD_CLOSED`, `CASH_ACCOUNT_REQUIRED` and
`CASH_ACCOUNT_INVALID`.

PostingRules remain tenant-configured. This service does not auto-provision GL
policy for Reinsurance. Readiness is preventative; SourceEventInbox,
transactional outbox, dispatcher retry and reconciliation remain the recovery
path for unexpected runtime failures.

### Source Cashbook Bridge

Cash-impact source events now use Cashbook as the authoritative bank/cash
posting path:

```text
Source module -> SourceEventInbox -> CashbookTransaction -> JournalEntry
```

For cash-impact events, Accounting validates the selected `cashAccountId`, uses
the cash account GL mapping for the cash leg, preserves the posting-rule
counter leg, creates one posted Cashbook transaction, and links the source event
to the same posted journal. Non-cash recognition events still post directly
through Posting Rules into Journals.

Cashbook bridging applies to bank/cash/cheque/mobile-money confirmations for:

- `PREMIUM_PAYMENT_RECEIVED`
- `PAYMENT_REVERSED`
- `REINSURER_DISBURSEMENT_RECORDED`
- `REINSURER_DISBURSEMENT_REVERSED`

`INTERNAL_OFFSET` and `JOURNAL` source settlements do not create Cashbook cash
movements. Historical source events that already posted journals before this
bridge are not automatically backfilled; use an explicit reconciliation/backfill
procedure before relying on Bank Reconciliation for those historical periods.

Historical Reinsurance claim source events that were already delivered before
claim Accounting was retired remain immutable history. New claim confirmations
do not enter the Accounting Cashbook bridge.

## Validation

```bash
npm run test --workspace=apps/accounting-service
npm run lint --workspace=apps/accounting-service
npm run check-types --workspace=apps/accounting-service
npm run build --workspace=apps/accounting-service
```

## Operational Notes

- Posted journals are immutable; corrections use linked reversals.
- Posted cashbook transactions are immutable; corrections use linked reversal
  cashbook rows and reversal journals.
- Cash/bank accounts store only masked public identifiers. Do not store raw
  credentials, secrets or provider tokens.
- Cross-currency cashbook transfers require an explicit agreed exchange rate;
  Accounting never fetches live FX during posting.
- Standalone AR uses the tenant Accounts Receivable control account configured in
  Accounting settings and posts customer subledger lines through that control
  account.
- Customer receipts use Cashbook as the single authoritative cash movement and
  journal path: receipt posting debits Cash/Bank and credits AR control. Receipt
  allocation changes only AR application state and never creates a duplicate GL
  journal.
- Phase 1 AR rejects unsupported cross-currency allocations; agreed FX facts must
  be captured on the originating document or receipt where required.
- Standalone AP uses the tenant Accounts Payable control account configured in
  Accounting settings and posts vendor subledger lines through that control
  account.
- Vendor payments use Cashbook as the single authoritative cash movement and
  journal path: payment posting debits AP control and credits Cash/Bank. Payment
  allocation changes only AP application state and never creates a duplicate GL
  journal.
- Phase 1 AP rejects unsupported cross-currency allocations; agreed FX facts must
  be captured on the originating document or payment where required.
- Source-event idempotency keys are tenant-scoped and deterministic.
- Manual Accounting remains supported independently of automation.
- Posting rules are tenant-owned and determine final debit/credit accounts.
