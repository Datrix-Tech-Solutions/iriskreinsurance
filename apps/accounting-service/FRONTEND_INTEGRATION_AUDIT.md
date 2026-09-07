# Accounting API and Frontend Integration Audit

Branch: `audit/accounting-api-and-frontend-integration`

Base inspected: latest `origin/dev` at `b6670bf5`.

This audit covers current source only. It does not start the P0/P1 backlog and
does not modify production behavior.

## 1. Complete Accounting Endpoint Inventory

All normal Accounting endpoints are exposed through the API Gateway as
`/api/v1/accounting/*` and directly on the service as `/api/*`, unless noted.
All normal Accounting endpoints use `JwtAuthGuard`, `ModuleGuard` and
`PermissionsGuard`, require the `accounting` module, and are tenant scoped
through `request.user.tenantId`.

Legend:

- Caller: `UI`, `Support`, `Source module`, or `Service`.
- Surface: `Frontend`, `Internal`, or `Support`.
- Consumer: current frontend hook/page if present.

### Setup

| Method | Route                             | Controller                     | Purpose                              | Caller   | Permission                 | Consumer                                       | Classification   |
| ------ | --------------------------------- | ------------------------------ | ------------------------------------ | -------- | -------------------------- | ---------------------------------------------- | ---------------- |
| GET    | `/config`                         | `AccountingSettingsController` | Read tenant Accounting config        | UI       | `accounting.settings:VIEW` | `useAccountingConfig`, currency/settings pages | KEEP             |
| PATCH  | `/config`                         | `AccountingSettingsController` | Update base currency/fiscal settings | UI/Admin | `accounting.settings:EDIT` | Hook exists; no full config page               | MISSING_FRONTEND |
| GET    | `/currencies`                     | `AccountingSettingsController` | List tenant currencies               | UI       | `accounting.settings:VIEW` | `AccountingCurrenciesTable`                    | KEEP             |
| POST   | `/currencies`                     | `AccountingSettingsController` | Create currency                      | UI/Admin | `accounting.settings:EDIT` | `AddCurrencyPanel`                             | KEEP             |
| PATCH  | `/currencies/:currencyId`         | `AccountingSettingsController` | Update/deactivate currency           | UI/Admin | `accounting.settings:EDIT` | `EditCurrencyPanel`, deactivate action         | KEEP             |
| GET    | `/exchange-rates`                 | `AccountingSettingsController` | List exchange rates                  | UI/Admin | `accounting.settings:VIEW` | Currency table reads latest rate               | PARTIAL          |
| POST   | `/exchange-rates`                 | `AccountingSettingsController` | Create exchange rate                 | UI/Admin | `accounting.settings:EDIT` | Add currency panel seeds rate                  | PARTIAL          |
| PATCH  | `/exchange-rates/:rateId`         | `AccountingSettingsController` | Update/deactivate exchange rate      | UI/Admin | `accounting.settings:EDIT` | Edit currency panel                            | PARTIAL          |
| GET    | `/fiscal-periods`                 | `AccountingSettingsController` | List fiscal periods                  | UI/Admin | `accounting.settings:VIEW` | `FiscalPeriodsTable`                           | KEEP             |
| POST   | `/fiscal-periods`                 | `AccountingSettingsController` | Create fiscal period                 | UI/Admin | `accounting.settings:EDIT` | `AddFiscalPeriodPanel`                         | KEEP             |
| POST   | `/fiscal-periods/:periodId/open`  | `AccountingSettingsController` | Reopen fiscal period                 | UI/Admin | `accounting.settings:EDIT` | Hook exists                                    | MISSING_FRONTEND |
| POST   | `/fiscal-periods/:periodId/close` | `AccountingSettingsController` | Close fiscal period                  | UI/Admin | `accounting.settings:EDIT` | Hook exists                                    | MISSING_FRONTEND |
| POST   | `/fiscal-periods/:periodId/lock`  | `AccountingSettingsController` | Lock fiscal period                   | UI/Admin | `accounting.settings:EDIT` | Hook exists                                    | MISSING_FRONTEND |

### Master Data

| Method | Route                                                   | Controller           | Purpose                      | Caller   | Permission                                      | Consumer                                | Classification   |
| ------ | ------------------------------------------------------- | -------------------- | ---------------------------- | -------- | ----------------------------------------------- | --------------------------------------- | ---------------- |
| GET    | `/account-categories`                                   | `AccountsController` | List fixed GL categories     | UI       | `accounting.accounts:VIEW`                      | Not used; frontend hardcodes categories | UNUSED           |
| GET    | `/account-classifications`                              | `AccountsController` | List classifications         | UI       | `accounting.account-classifications:VIEW`       | `ClassificationsTable`, COA tree        | KEEP             |
| POST   | `/account-classifications`                              | `AccountsController` | Create classification        | UI/Admin | `accounting.account-classifications:CREATE`     | `AddClassificationPanel`                | KEEP             |
| GET    | `/account-classifications/:classificationId`            | `AccountsController` | Read classification          | UI       | `accounting.account-classifications:VIEW`       | Detail route                            | KEEP             |
| PATCH  | `/account-classifications/:classificationId`            | `AccountsController` | Update classification        | UI/Admin | `accounting.account-classifications:EDIT`       | Hook exists                             | PARTIAL          |
| POST   | `/account-classifications/:classificationId/activate`   | `AccountsController` | Activate classification      | UI/Admin | `accounting.account-classifications:EDIT`       | `ClassificationsTable`                  | KEEP             |
| POST   | `/account-classifications/:classificationId/deactivate` | `AccountsController` | Deactivate classification    | UI/Admin | `accounting.account-classifications:DEACTIVATE` | `ClassificationsTable`                  | KEEP             |
| GET    | `/account-groups`                                       | `AccountsController` | List account groups          | UI       | `accounting.account-groups:VIEW`                | COA tree                                | KEEP             |
| POST   | `/account-groups`                                       | `AccountsController` | Create account group         | UI/Admin | `accounting.account-groups:CREATE`              | `AddParentAccountPanel`                 | KEEP             |
| GET    | `/account-groups/:groupId`                              | `AccountsController` | Read account group           | UI       | `accounting.account-groups:VIEW`                | Hook exists                             | MISSING_FRONTEND |
| PATCH  | `/account-groups/:groupId`                              | `AccountsController` | Update account group         | UI/Admin | `accounting.account-groups:EDIT`                | Hook exists                             | MISSING_FRONTEND |
| POST   | `/account-groups/:groupId/activate`                     | `AccountsController` | Activate group               | UI/Admin | `accounting.account-groups:EDIT`                | Hook exists                             | MISSING_FRONTEND |
| POST   | `/account-groups/:groupId/deactivate`                   | `AccountsController` | Deactivate group             | UI/Admin | `accounting.account-groups:DEACTIVATE`          | Hook exists                             | MISSING_FRONTEND |
| POST   | `/account-hierarchy/seed-standard`                      | `AccountsController` | Seed standard COA hierarchy  | UI/Admin | multiple create permissions                     | No UI                                   | MISSING_FRONTEND |
| GET    | `/accounts`                                             | `AccountsController` | List GL accounts             | UI       | `accounting.accounts:VIEW`                      | COA tree, journal line selector         | KEEP             |
| POST   | `/accounts`                                             | `AccountsController` | Create GL account            | UI/Admin | `accounting.accounts:CREATE`                    | parent/leaf panels                      | KEEP             |
| PATCH  | `/accounts/:accountId`                                  | `AccountsController` | Update GL account            | UI/Admin | `accounting.accounts:EDIT`                      | Hook exists; no edit UI                 | MISSING_FRONTEND |
| POST   | `/accounts/:accountId/deactivate`                       | `AccountsController` | Deactivate GL account        | UI/Admin | `accounting.accounts:EDIT`                      | Hook exists; no UI                      | MISSING_FRONTEND |
| GET    | `/cost-centres`                                         | `AccountsController` | List cost centres            | UI       | `accounting.accounts:VIEW`                      | No UI                                   | MISSING_FRONTEND |
| POST   | `/cost-centres`                                         | `AccountsController` | Create cost centre           | UI/Admin | `accounting.accounts:CREATE`                    | No UI                                   | MISSING_FRONTEND |
| PATCH  | `/cost-centres/:costCentreId`                           | `AccountsController` | Update cost centre           | UI/Admin | `accounting.accounts:EDIT`                      | No UI                                   | MISSING_FRONTEND |
| POST   | `/cost-centres/:costCentreId/deactivate`                | `AccountsController` | Deactivate cost centre       | UI/Admin | `accounting.accounts:EDIT`                      | No UI                                   | MISSING_FRONTEND |
| GET    | `/customers`                                            | `AccountsController` | List Accounting customers    | UI       | `accounting.customers:VIEW`                     | `CustomerTable`                         | KEEP             |
| POST   | `/customers`                                            | `AccountsController` | Create customer              | UI/Admin | `accounting.customers:CREATE`                   | `AddCustomerPanel`                      | KEEP             |
| GET    | `/customers/:customerId`                                | `AccountsController` | Customer detail with balance | UI       | `accounting.customers:VIEW`                     | Customer detail page                    | KEEP             |
| PATCH  | `/customers/:customerId`                                | `AccountsController` | Update customer              | UI/Admin | `accounting.customers:EDIT`                     | Hook exists                             | PARTIAL          |
| POST   | `/customers/:customerId/deactivate`                     | `AccountsController` | Deactivate customer          | UI/Admin | `accounting.customers:DEACTIVATE`               | `CustomerTable`                         | KEEP             |
| POST   | `/customers/:customerId/activate`                       | `AccountsController` | Activate customer            | UI/Admin | `accounting.customers:EDIT`                     | `CustomerTable`                         | KEEP             |
| GET    | `/vendors`                                              | `AccountsController` | List Accounting vendors      | UI       | `accounting.vendors:VIEW`                       | `VendorsTable`                          | KEEP             |
| POST   | `/vendors`                                              | `AccountsController` | Create vendor                | UI/Admin | `accounting.vendors:CREATE`                     | `AddVendorPanel`                        | KEEP             |
| GET    | `/vendors/:vendorId`                                    | `AccountsController` | Vendor detail with balance   | UI       | `accounting.vendors:VIEW`                       | Vendor detail page                      | KEEP             |
| PATCH  | `/vendors/:vendorId`                                    | `AccountsController` | Update vendor                | UI/Admin | `accounting.vendors:EDIT`                       | Hook exists                             | PARTIAL          |
| POST   | `/vendors/:vendorId/deactivate`                         | `AccountsController` | Deactivate vendor            | UI/Admin | `accounting.vendors:DEACTIVATE`                 | `VendorsTable`                          | KEEP             |
| POST   | `/vendors/:vendorId/activate`                           | `AccountsController` | Activate vendor              | UI/Admin | `accounting.vendors:EDIT`                       | `VendorsTable`                          | KEEP             |

### Subledger

| Method | Route                                         | Controller                     | Purpose                                         | Caller     | Permission                   | Consumer                   | Classification   |
| ------ | --------------------------------------------- | ------------------------------ | ----------------------------------------------- | ---------- | ---------------------------- | -------------------------- | ---------------- |
| GET    | `/subledger-accounts`                         | `AccountsController`           | List subledger accounts by type/control account | UI/Support | `accounting.accounts:VIEW`   | No UI                      | MISSING_FRONTEND |
| POST   | `/subledger-accounts`                         | `AccountsController`           | Create subledger manually                       | UI/Admin   | `accounting.accounts:CREATE` | No UI                      | MISSING_FRONTEND |
| PATCH  | `/subledger-accounts/:subledgerId`            | `AccountsController`           | Update subledger                                | UI/Admin   | `accounting.accounts:EDIT`   | No UI                      | MISSING_FRONTEND |
| POST   | `/subledger-accounts/:subledgerId/deactivate` | `AccountsController`           | Deactivate subledger                            | UI/Admin   | `accounting.accounts:EDIT`   | No UI                      | MISSING_FRONTEND |
| POST   | `/internal/subledgers/ensure` direct-service  | `InternalSubledgersController` | Idempotently ensure CEDANT/REINSURER subledger  | Service    | HMAC internal service auth   | Reinsurance service client | INTERNAL_ONLY    |

### Cash/Bank

| Method | Route                           | Controller           | Purpose                                 | Caller   | Permission                      | Consumer             | Classification   |
| ------ | ------------------------------- | -------------------- | --------------------------------------- | -------- | ------------------------------- | -------------------- | ---------------- |
| GET    | `/cash-accounts`                | `CashbookController` | List cash/bank/wallet accounts          | UI       | `accounting.cash-accounts:VIEW` | No current hook/page | MISSING_FRONTEND |
| POST   | `/cash-accounts`                | `CashbookController` | Create cash account linked to GL asset  | UI/Admin | `accounting.cash-accounts:EDIT` | No UI                | MISSING_FRONTEND |
| GET    | `/cash-accounts/:cashAccountId` | `CashbookController` | Get cash account detail                 | UI       | `accounting.cash-accounts:VIEW` | No UI                | MISSING_FRONTEND |
| PATCH  | `/cash-accounts/:cashAccountId` | `CashbookController` | Update/activate/deactivate cash account | UI/Admin | `accounting.cash-accounts:EDIT` | No UI                | MISSING_FRONTEND |

### Cashbook

| Method | Route                              | Controller           | Purpose                              | Caller      | Permission                    | Consumer                        | Classification   |
| ------ | ---------------------------------- | -------------------- | ------------------------------------ | ----------- | ----------------------------- | ------------------------------- | ---------------- |
| GET    | `/cashbook`                        | `CashbookController` | List cashbook transactions           | UI          | `accounting.cashbook:VIEW`    | Cash/Bank page does not consume | MISSING_FRONTEND |
| GET    | `/cashbook/:transactionId`         | `CashbookController` | Cashbook detail with journal linkage | UI          | `accounting.cashbook:VIEW`    | No UI                           | MISSING_FRONTEND |
| POST   | `/cashbook/receipts`               | `CashbookController` | Draft direct receipt                 | UI          | `accounting.cashbook:CREATE`  | No UI                           | MISSING_FRONTEND |
| POST   | `/cashbook/payments`               | `CashbookController` | Draft direct payment                 | UI          | `accounting.cashbook:CREATE`  | No UI                           | MISSING_FRONTEND |
| POST   | `/cashbook/transfers`              | `CashbookController` | Draft inter-account transfer         | UI          | `accounting.cashbook:CREATE`  | No UI                           | MISSING_FRONTEND |
| POST   | `/cashbook/charges`                | `CashbookController` | Draft bank charge                    | UI          | `accounting.cashbook:CREATE`  | No UI                           | MISSING_FRONTEND |
| POST   | `/cashbook/adjustments`            | `CashbookController` | Draft cashbook adjustment            | UI          | `accounting.cashbook:CREATE`  | No UI                           | MISSING_FRONTEND |
| POST   | `/cashbook/:transactionId/post`    | `CashbookController` | Post cashbook transaction/journal    | UI/Approver | `accounting.cashbook:APPROVE` | No UI                           | MISSING_FRONTEND |
| POST   | `/cashbook/:transactionId/reverse` | `CashbookController` | Reverse posted cashbook transaction  | UI/Approver | `accounting.cashbook:DELETE`  | No UI                           | MISSING_FRONTEND |

### AR

| Method | Route                                                 | Controller              | Purpose                                   | Caller      | Permission                       | Consumer                                     | Classification   |
| ------ | ----------------------------------------------------- | ----------------------- | ----------------------------------------- | ----------- | -------------------------------- | -------------------------------------------- | ---------------- |
| POST   | `/receivables/invoices`                               | `ReceivablesController` | Draft standalone customer invoice         | UI          | `accounting.receivables:CREATE`  | Form is TODO/mock                            | MISSING_FRONTEND |
| GET    | `/receivables/invoices`                               | `ReceivablesController` | List invoices                             | UI          | `accounting.receivables:VIEW`    | Table mock                                   | MISSING_FRONTEND |
| GET    | `/receivables/invoices/:invoiceId`                    | `ReceivablesController` | Get invoice                               | UI          | `accounting.receivables:VIEW`    | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/invoices/:invoiceId/post`               | `ReceivablesController` | Post invoice                              | UI/Approver | `accounting.receivables:APPROVE` | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/invoices/:invoiceId/reverse`            | `ReceivablesController` | Reverse posted invoice                    | UI/Approver | `accounting.receivables:DELETE`  | No UI                                        | MISSING_FRONTEND |
| GET    | `/receivables/invoices/:invoiceId/balance`            | `ReceivablesController` | Backend invoice balance                   | UI          | `accounting.receivables:VIEW`    | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/credit-notes`                           | `ReceivablesController` | Draft customer credit note                | UI          | `accounting.receivables:CREATE`  | No UI                                        | MISSING_FRONTEND |
| GET    | `/receivables/credit-notes`                           | `ReceivablesController` | List credit notes                         | UI          | `accounting.receivables:VIEW`    | No UI                                        | MISSING_FRONTEND |
| GET    | `/receivables/credit-notes/:creditNoteId`             | `ReceivablesController` | Get credit note                           | UI          | `accounting.receivables:VIEW`    | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/credit-notes/:creditNoteId/post`        | `ReceivablesController` | Post credit note                          | UI/Approver | `accounting.receivables:APPROVE` | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/credit-notes/:creditNoteId/reverse`     | `ReceivablesController` | Reverse credit note                       | UI/Approver | `accounting.receivables:DELETE`  | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/credit-notes/:creditNoteId/allocations` | `ReceivablesController` | Apply credit to invoice                   | UI          | `accounting.receivables:EDIT`    | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/receipts`                               | `ReceivablesController` | Draft customer receipt linked to Cashbook | UI          | `accounting.receivables:CREATE`  | No UI                                        | MISSING_FRONTEND |
| GET    | `/receivables/receipts`                               | `ReceivablesController` | List receipts                             | UI          | `accounting.receivables:VIEW`    | No UI                                        | MISSING_FRONTEND |
| GET    | `/receivables/receipts/:receiptId`                    | `ReceivablesController` | Get receipt                               | UI          | `accounting.receivables:VIEW`    | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/receipts/:receiptId/post`               | `ReceivablesController` | Post receipt via Cashbook                 | UI/Approver | `accounting.receivables:APPROVE` | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/receipts/:receiptId/reverse`            | `ReceivablesController` | Reverse receipt                           | UI/Approver | `accounting.receivables:DELETE`  | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/receipts/:receiptId/allocations`        | `ReceivablesController` | Allocate receipt to invoice               | UI          | `accounting.receivables:EDIT`    | No UI                                        | MISSING_FRONTEND |
| GET    | `/receivables/receipts/:receiptId/allocations`        | `ReceivablesController` | List receipt allocations                  | UI          | `accounting.receivables:VIEW`    | No UI                                        | MISSING_FRONTEND |
| POST   | `/receivables/allocations/:allocationId/reverse`      | `ReceivablesController` | Reverse AR allocation                     | UI          | `accounting.receivables:EDIT`    | No UI                                        | MISSING_FRONTEND |
| GET    | `/receivables/customers/:customerId/balance`          | `ReceivablesController` | Backend customer AR balance               | UI          | `accounting.receivables:VIEW`    | Customer table uses master balance, not this | PARTIAL          |

### AP

| Method | Route                                              | Controller           | Purpose                                 | Caller      | Permission                    | Consumer                                   | Classification   |
| ------ | -------------------------------------------------- | -------------------- | --------------------------------------- | ----------- | ----------------------------- | ------------------------------------------ | ---------------- |
| POST   | `/payables/bills`                                  | `PayablesController` | Draft standalone vendor bill            | UI          | `accounting.payables:CREATE`  | Form is TODO/mock                          | MISSING_FRONTEND |
| GET    | `/payables/bills`                                  | `PayablesController` | List bills                              | UI          | `accounting.payables:VIEW`    | Table mock                                 | MISSING_FRONTEND |
| GET    | `/payables/bills/:billId`                          | `PayablesController` | Get bill                                | UI          | `accounting.payables:VIEW`    | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/bills/:billId/post`                     | `PayablesController` | Post bill                               | UI/Approver | `accounting.payables:APPROVE` | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/bills/:billId/reverse`                  | `PayablesController` | Reverse bill                            | UI/Approver | `accounting.payables:DELETE`  | No UI                                      | MISSING_FRONTEND |
| GET    | `/payables/bills/:billId/balance`                  | `PayablesController` | Backend bill balance                    | UI          | `accounting.payables:VIEW`    | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/credit-notes`                           | `PayablesController` | Draft vendor credit note                | UI          | `accounting.payables:CREATE`  | No UI                                      | MISSING_FRONTEND |
| GET    | `/payables/credit-notes`                           | `PayablesController` | List vendor credits                     | UI          | `accounting.payables:VIEW`    | No UI                                      | MISSING_FRONTEND |
| GET    | `/payables/credit-notes/:creditNoteId`             | `PayablesController` | Get vendor credit                       | UI          | `accounting.payables:VIEW`    | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/credit-notes/:creditNoteId/post`        | `PayablesController` | Post vendor credit                      | UI/Approver | `accounting.payables:APPROVE` | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/credit-notes/:creditNoteId/reverse`     | `PayablesController` | Reverse vendor credit                   | UI/Approver | `accounting.payables:DELETE`  | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/credit-notes/:creditNoteId/allocations` | `PayablesController` | Apply vendor credit to bill             | UI          | `accounting.payables:EDIT`    | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/payments`                               | `PayablesController` | Draft vendor payment linked to Cashbook | UI          | `accounting.payables:CREATE`  | No UI                                      | MISSING_FRONTEND |
| GET    | `/payables/payments`                               | `PayablesController` | List payments                           | UI          | `accounting.payables:VIEW`    | No UI                                      | MISSING_FRONTEND |
| GET    | `/payables/payments/:paymentId`                    | `PayablesController` | Get payment                             | UI          | `accounting.payables:VIEW`    | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/payments/:paymentId/post`               | `PayablesController` | Post payment via Cashbook               | UI/Approver | `accounting.payables:APPROVE` | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/payments/:paymentId/reverse`            | `PayablesController` | Reverse payment                         | UI/Approver | `accounting.payables:DELETE`  | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/payments/:paymentId/allocations`        | `PayablesController` | Allocate payment to bill                | UI          | `accounting.payables:EDIT`    | No UI                                      | MISSING_FRONTEND |
| GET    | `/payables/payments/:paymentId/allocations`        | `PayablesController` | List payment allocations                | UI          | `accounting.payables:VIEW`    | No UI                                      | MISSING_FRONTEND |
| POST   | `/payables/allocations/:allocationId/reverse`      | `PayablesController` | Reverse AP allocation                   | UI          | `accounting.payables:EDIT`    | No UI                                      | MISSING_FRONTEND |
| GET    | `/payables/vendors/:vendorId/balance`              | `PayablesController` | Backend vendor AP balance               | UI          | `accounting.payables:VIEW`    | Vendor table uses master balance, not this | PARTIAL          |

### Journals

| Method | Route                          | Controller           | Purpose                         | Caller      | Permission                    | Consumer                        | Classification   |
| ------ | ------------------------------ | -------------------- | ------------------------------- | ----------- | ----------------------------- | ------------------------------- | ---------------- |
| GET    | `/journals`                    | `JournalsController` | List journals                   | UI          | `accounting.journals:VIEW`    | Hook exists; table still mock   | PARTIAL          |
| POST   | `/journals`                    | `JournalsController` | Create balanced draft journal   | UI          | `accounting.journals:CREATE`  | `NewJournalEntryForm`           | KEEP             |
| GET    | `/journals/:journalId`         | `JournalsController` | Get journal with lines          | UI          | `accounting.journals:VIEW`    | Hook exists; no detail UI       | MISSING_FRONTEND |
| PATCH  | `/journals/:journalId`         | `JournalsController` | Update draft journal            | UI          | `accounting.journals:EDIT`    | Hook exists; no edit UI         | MISSING_FRONTEND |
| POST   | `/journals/:journalId/post`    | `JournalsController` | Post draft journal              | UI/Approver | `accounting.journals:APPROVE` | Hook exists; no UI              | MISSING_FRONTEND |
| POST   | `/journals/:journalId/reverse` | `JournalsController` | Reverse posted journal          | UI/Approver | `accounting.journals:APPROVE` | Hook exists; no UI              | MISSING_FRONTEND |
| GET    | `/accounts/:accountId/ledger`  | `AccountsController` | Posted lines for one GL account | UI          | `accounting.ledger:VIEW`      | Account transactions table mock | MISSING_FRONTEND |

### Posting Rules

| Method | Route                                  | Controller               | Purpose                     | Caller   | Permission                 | Consumer | Classification   |
| ------ | -------------------------------------- | ------------------------ | --------------------------- | -------- | -------------------------- | -------- | ---------------- |
| GET    | `/posting-rules`                       | `PostingRulesController` | List posting rules          | UI/Admin | `accounting.settings:VIEW` | No UI    | MISSING_FRONTEND |
| POST   | `/posting-rules`                       | `PostingRulesController` | Create posting rule version | UI/Admin | `accounting.settings:EDIT` | No UI    | MISSING_FRONTEND |
| GET    | `/posting-rules/:ruleId`               | `PostingRulesController` | Read rule with lines        | UI/Admin | `accounting.settings:VIEW` | No UI    | MISSING_FRONTEND |
| PATCH  | `/posting-rules/:ruleId`               | `PostingRulesController` | Update inactive/unused rule | UI/Admin | `accounting.settings:EDIT` | No UI    | MISSING_FRONTEND |
| DELETE | `/posting-rules/:ruleId`               | `PostingRulesController` | Delete inactive/unused rule | UI/Admin | `accounting.settings:EDIT` | No UI    | MISSING_FRONTEND |
| POST   | `/posting-rules/:ruleId/lines`         | `PostingRulesController` | Add rule line               | UI/Admin | `accounting.settings:EDIT` | No UI    | MISSING_FRONTEND |
| PATCH  | `/posting-rules/:ruleId/lines/:lineId` | `PostingRulesController` | Update rule line            | UI/Admin | `accounting.settings:EDIT` | No UI    | MISSING_FRONTEND |
| DELETE | `/posting-rules/:ruleId/lines/:lineId` | `PostingRulesController` | Delete rule line            | UI/Admin | `accounting.settings:EDIT` | No UI    | MISSING_FRONTEND |

### Source Events

| Method | Route                             | Controller               | Purpose                                        | Caller       | Permission                    | Consumer | Classification   |
| ------ | --------------------------------- | ------------------------ | ---------------------------------------------- | ------------ | ----------------------------- | -------- | ---------------- |
| POST   | `/source-events`                  | `SourceEventsController` | Receive/process source event through user auth | Support/demo | `accounting.journals:APPROVE` | No UI    | ADMIN_ONLY       |
| POST   | `/source-events/process-pending`  | `SourceEventsController` | Batch-process received events                  | Support/ops  | `accounting.journals:APPROVE` | No UI    | ADMIN_ONLY       |
| GET    | `/source-events`                  | `SourceEventsController` | List source-event inbox                        | Support/ops  | `accounting.journals:VIEW`    | No UI    | MISSING_FRONTEND |
| GET    | `/source-events/:eventId`         | `SourceEventsController` | Source-event detail/status                     | Support/ops  | `accounting.journals:VIEW`    | No UI    | MISSING_FRONTEND |
| POST   | `/source-events/:eventId/process` | `SourceEventsController` | Process one received/failed event              | Support/ops  | `accounting.journals:APPROVE` | No UI    | ADMIN_ONLY       |
| POST   | `/source-events/:eventId/retry`   | `SourceEventsController` | Retry failed event                             | Support/ops  | `accounting.journals:APPROVE` | No UI    | ADMIN_ONLY       |

### Integration/Internal

| Method | Route                                                           | Controller                                         | Purpose                          | Caller        | Permission         | Consumer           | Classification |
| ------ | --------------------------------------------------------------- | -------------------------------------------------- | -------------------------------- | ------------- | ------------------ | ------------------ | -------------- |
| POST   | `/internal/source-events` direct-service                        | `InternalSourceEventsController`                   | HMAC source-module event ingress | Source module | HMAC internal auth | Reinsurance client | INTERNAL_ONLY  |
| POST   | `/api/internal/reinsurance/accounting-readiness` direct-service | `InternalReinsuranceAccountingReadinessController` | HMAC readiness preflight         | Source module | HMAC internal auth | Reinsurance client | INTERNAL_ONLY  |
| GET    | `/health`                                                       | `HealthController`                                 | DB readiness                     | Service/ops   | none               | Deployment health  | KEEP           |

### Reports

| Method | Route                       | Controller          | Purpose               | Caller | Permission               | Consumer                    | Classification   |
| ------ | --------------------------- | ------------------- | --------------------- | ------ | ------------------------ | --------------------------- | ---------------- |
| GET    | `/reports/general-ledger`   | `ReportsController` | General ledger report | UI     | `accounting.ledger:VIEW` | No hook/page                | MISSING_FRONTEND |
| GET    | `/reports/trial-balance`    | `ReportsController` | Trial balance         | UI     | `accounting.ledger:VIEW` | Static placeholder page     | MISSING_FRONTEND |
| GET    | `/reports/income-statement` | `ReportsController` | Income statement      | UI     | `accounting.ledger:VIEW` | Static P&L placeholder page | MISSING_FRONTEND |
| GET    | `/reports/balance-sheet`    | `ReportsController` | Balance sheet         | UI     | `accounting.ledger:VIEW` | Static placeholder page     | MISSING_FRONTEND |

## 2. Duplicate / Overlap Verdict

| Surfaces                                                  | Verdict                     | Why both exist                                                                                                                                                                              |
| --------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/cashbook/receipts` vs `/receivables/receipts`           | LEGITIMATE_LAYER_SEPARATION | Cashbook receipt is generic bank/cash inflow. AR receipt is customer/subledger application and creates/links a cashbook receipt for the cash leg.                                           |
| `/cashbook/payments` vs `/payables/payments`              | LEGITIMATE_LAYER_SEPARATION | Cashbook payment is generic outflow. AP payment belongs to vendor payable settlement and links to cashbook for cash movement.                                                               |
| `/accounts/:id/ledger` vs `/reports/general-ledger`       | LEGITIMATE_LAYER_SEPARATION | Account ledger is one GL account drilldown. General ledger report is cross-account report with date/filter semantics.                                                                       |
| `/subledger-accounts` vs `/internal/subledgers/ensure`    | LEGITIMATE_LAYER_SEPARATION | Public subledger CRUD/inspection is Accounting-owned. Internal ensure is idempotent service-to-service provisioning for Reinsurance counterparties.                                         |
| `/source-events` vs `/internal/source-events`             | FUTURE_CONSOLIDATION        | Internal source-events is the real WFIS ingress. User-auth `/source-events` is useful for support/demo/manual recovery but should remain ops/admin only.                                    |
| Manual journals vs AR/AP/Cashbook-generated journals      | LEGITIMATE_LAYER_SEPARATION | Manual journals are Accounting-owned adjustments. AR/AP/Cashbook create journals from operational subledgers/workflows to preserve traceability.                                            |
| Accounting Customer/Vendor vs CEDANT/REINSURER subledgers | LEGITIMATE_LAYER_SEPARATION | Customer/Vendor are standalone Accounting counterparties. CEDANT/REINSURER subledgers are control-account-scoped operational dimensions and must not net across premium/claims obligations. |

No actual duplicate backend API was found. The concern is frontend discoverability:
the UI currently makes Cash/Bank look like only a confirmation queue and AR/AP
look like mock invoice tables, so the layered model is not visible.

## 3. AP Swagger Check

All currently implemented `PayablesController` methods are registered under
`@ApiTags('Accounting - Payables')` and every route has `@ApiOperation` plus
permission decorators. Implemented AP endpoints are exposed/documented in
current source.

No Swagger source fix was required.

## 4. Financial Confirmation Architecture

Current location:

| Flow                                | Current backend location                                                                                                                                                                                 | Current frontend location                                                          | Verdict |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| Premium receipt confirmation        | Reinsurance `POST /placements/:id/payments/:paymentId/bank-confirmation`; queue `GET /placements/payments/pending-bank-confirmation`                                                                     | Accounting Cash/Bank queue adapter maps Reinsurance payments                       | PARTIAL |
| Reinsurer disbursement confirmation | Same payment confirmation endpoint and pending queue                                                                                                                                                     | Accounting Cash/Bank queue adapter maps Reinsurance payments                       | PARTIAL |
| Claim recovery receipt confirmation | Reinsurance `POST /placements/:id/claims/:claimId/recovery-receipts/:receiptId/bank-confirm`; queue adapter exists at `GET /accounting-integration/financial-confirmations/claim-recovery-receipts`      | Reinsurance claim UI has direct confirm; Accounting queue does not consume adapter | PARTIAL |
| Cedant settlement confirmation      | Reinsurance `POST /placements/:id/claims/:claimId/cedant-settlements/:settlementId/bank-confirm`; queue adapter exists at `GET /accounting-integration/financial-confirmations/claim-cedant-settlements` | Reinsurance claim UI has direct confirm; Accounting queue does not consume adapter | PARTIAL |

There is no Accounting backend aggregation endpoint today. Architecture is:

`Accounting UI -> frontend work-item adapters -> Reinsurance APIs`

Verdict: `GOOD_PHASE1` as an adapter approach, but
`NEEDS_BACKEND_AGGREGATOR_LATER` if Product wants one module-neutral Accounting
confirmation queue API.

## 5. Source Event API Audit

| Route                                  | Audience               | Current visibility                         | Audit verdict                                          |
| -------------------------------------- | ---------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `POST /internal/source-events`         | Source modules only    | HMAC internal auth, global-prefix excluded | Correct internal ingress                               |
| `POST /source-events`                  | Support/demo only      | User-auth with `JOURNALS_POST`             | Should not be ordinary user UI                         |
| `POST /source-events/process-pending`  | Ops/support            | User-auth with `JOURNALS_POST`             | Admin/support only                                     |
| `GET /source-events`                   | Ops/support inspection | User-auth with `JOURNALS_VIEW`             | Useful support console, not normal accounting workflow |
| `GET /source-events/:eventId`          | Ops/support inspection | User-auth with `JOURNALS_VIEW`             | Useful support console                                 |
| `POST /source-events/:eventId/process` | Ops/support recovery   | User-auth with `JOURNALS_POST`             | Admin/support only                                     |
| `POST /source-events/:eventId/retry`   | Ops/support recovery   | User-auth with `JOURNALS_POST`             | Admin/support only                                     |

Recommendation: expose source-event list/detail/retry in a support/admin UI,
not ordinary Accounting clerk screens.

## 6. Internal API Security

- `POST /internal/source-events`: protected by `InternalServiceAuthGuard`; HMAC
  payload is `service:timestamp:POST:/internal/source-events`; tenant exists
  before enqueue; duplicate idempotency is tenant scoped.
- `POST /internal/subledgers/ensure`: protected by `InternalServiceAuthGuard`;
  HMAC payload is `service:timestamp:POST:/internal/subledgers/ensure`;
  creates/refreshes tenant-scoped subledger dimensions.
- `POST /internal/reinsurance/accounting-readiness`: protected by
  `InternalServiceAuthGuard`; HMAC payload is
  `service:timestamp:POST:/internal/reinsurance/accounting-readiness`.

Gateway exposure needs route review: `main.ts` excludes `internal/source-events`
and `internal/subledgers/ensure` from the `/api` prefix, but not
`internal/reinsurance/accounting-readiness`; therefore the direct service route
is `/api/internal/reinsurance/accounting-readiness`. Security is still HMAC, but
the prefix behavior is inconsistent.

## 7. Frontend Page Audit

| Page                         | Status                 | Reachable from nav?                                               | Evidence                                                                                     |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Dashboard                    | PLACEHOLDER            | Yes                                                               | Header only.                                                                                 |
| Configuration                | PARTIAL                | Settings nav exists, config hook exists, no complete config page. |
| Currencies                   | COMPLETE/PARTIAL       | Yes via Settings                                                  | Real hooks for currencies/exchange rates; rate management is embedded but not full FX admin. |
| Exchange Rates               | PARTIAL                | Via Currencies only                                               | Hook exists; no dedicated exchange-rate page.                                                |
| Fiscal Periods               | PARTIAL                | Yes via Settings                                                  | List/create hooks; open/close/lock hooks exist but UI coverage needs verification.           |
| Chart of Accounts            | PARTIAL                | Yes                                                               | Real backend tree/list/create; selected account detail is placeholder.                       |
| Account hierarchy            | PARTIAL                | Yes                                                               | Classifications/groups/accounts are wired; seed-standard and edit/deactivate are incomplete. |
| Cost Centres                 | MISSING                | No                                                                | Backend exists; no nav/page/hooks.                                                           |
| Subledgers                   | MISSING                | No                                                                | Backend exists; no page/hooks.                                                               |
| Customers                    | PARTIAL                | Yes via Settings                                                  | Real list/create/activate/deactivate/detail; edit coverage partial.                          |
| Vendors                      | PARTIAL                | Yes via Settings                                                  | Real list/create/activate/deactivate/detail; edit coverage partial.                          |
| Cash/Bank Accounts           | MISSING                | No dedicated page                                                 | Backend exists; UI only shows confirmation queue.                                            |
| Cashbook                     | MISSING                | Cash/Bank nav goes to queue                                       | No cashbook list/create/post/reverse UI.                                                     |
| AR                           | PLACEHOLDER            | Yes                                                               | Table and form are mock/TODO; backend ready.                                                 |
| AP                           | PLACEHOLDER            | Yes                                                               | Table and form are mock/TODO; backend ready.                                                 |
| Journals                     | PARTIAL                | Yes                                                               | New journal form posts backend; list table still mock; post/reverse missing.                 |
| Posting Rules                | MISSING                | No                                                                | Backend exists; no UI.                                                                       |
| Source Events                | MISSING                | No                                                                | Backend exists; no support UI.                                                               |
| Financial Confirmation Queue | PARTIAL                | Through Cash/Bank                                                 | Premium/reinsurer payment adapter only; missing cash account selector.                       |
| General Ledger               | MISSING/STALE_CONTRACT | Nav item points to root and inactive                              | No report consumer.                                                                          |
| Trial Balance                | PLACEHOLDER            | Yes via Reports                                                   | Static filter shell, no API.                                                                 |
| Income Statement             | PLACEHOLDER            | Yes via Reports as P&L                                            | Static filter shell, no API.                                                                 |
| Balance Sheet                | PLACEHOLDER            | Yes via Reports                                                   | Static filter shell, no API.                                                                 |

## 8. Standalone Accounting Setup Test

A brand-new tenant cannot configure Accounting entirely from the UI today.

| Setup step              | UI status   | Blocker                                                                               |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------- |
| Accounting config       | PARTIAL     | Hook exists but no full page for base settings/control defaults.                      |
| Currency                | YES         | Currency table/panels exist.                                                          |
| Fiscal period           | PARTIAL     | Create/list exists; open/close/lock coverage incomplete.                              |
| COA hierarchy           | PARTIAL     | Create classification/group/account exists; standard seed/edit/deactivate incomplete. |
| Posting GLs             | PARTIAL     | GL create exists; selected detail/edit incomplete.                                    |
| AR control              | BLOCKED     | Must be configured via config/backend; no clear UI.                                   |
| AP control              | BLOCKED     | Must be configured via config/backend; no clear UI.                                   |
| Claims control accounts | BLOCKED     | Readiness backend groups exist; no UI.                                                |
| Cost centres            | BLOCKED     | Backend exists; no UI.                                                                |
| Cash/Bank accounts      | BLOCKED     | Backend exists; no UI.                                                                |
| Customers               | YES/PARTIAL | Create/list works; edit details partial.                                              |
| Vendors                 | YES/PARTIAL | Create/list works; edit details partial.                                              |
| Posting Rules           | BLOCKED     | Backend exists; no UI.                                                                |

## 9. Cashbook Frontend Audit

| Capability                           | Status  |
| ------------------------------------ | ------- |
| Cash account list                    | MISSING |
| Create cash account                  | MISSING |
| Edit cash account                    | MISSING |
| Activate/deactivate                  | MISSING |
| Linked GL display                    | MISSING |
| Cashbook list                        | MISSING |
| Receipt                              | MISSING |
| Payment                              | MISSING |
| Transfer                             | MISSING |
| Charge                               | MISSING |
| Adjustment                           | MISSING |
| Post                                 | MISSING |
| Reverse                              | MISSING |
| Source-generated transaction display | MISSING |
| Journal link                         | MISSING |

The current Cash/Bank page is a Reinsurance financial-confirmation queue plus
static stats, not a cashbook UI.

## 10. AR Frontend Audit

| Capability          | Status                            |
| ------------------- | --------------------------------- |
| Invoice list        | MOCK                              |
| Invoice create      | TODO form only                    |
| Post invoice        | MISSING                           |
| Reverse invoice     | MISSING                           |
| Credit note         | MISSING                           |
| Receipt             | MISSING                           |
| Receipt post        | MISSING                           |
| Receipt reverse     | MISSING                           |
| Allocation          | MISSING                           |
| Allocation reversal | MISSING                           |
| Invoice balance     | MISSING                           |
| Customer balance    | PARTIAL via customer master table |

Mock data remains in `AccountsReceivableTable`; `NewInvoiceForm` has a TODO
instead of a mutation.

## 11. AP Frontend Audit

| Capability          | Status                          |
| ------------------- | ------------------------------- |
| Bill list           | MOCK                            |
| Bill create         | TODO form only                  |
| Post bill           | MISSING                         |
| Reverse bill        | MISSING                         |
| Vendor credit       | MISSING                         |
| Payment             | MISSING                         |
| Payment post        | MISSING                         |
| Payment reverse     | MISSING                         |
| Allocation          | MISSING                         |
| Allocation reversal | MISSING                         |
| Bill balance        | MISSING                         |
| Vendor balance      | PARTIAL via vendor master table |

Mock data remains in `AccountsPayableTable`; it still labels AP bills as
invoices in several UI strings.

## 12. Journal Frontend Audit

Backend hooks exist for list/detail/create/update/post/reverse. The new journal
form creates a backend draft journal. The journal table is still mock and does
not consume `useJournals`; detail/post/reverse UI is missing.

## 13. Report Frontend Audit

Backend report endpoints exist for General Ledger, Trial Balance, Income
Statement and Balance Sheet. Frontend financial-report cards show static
`GHS 0.00` values. Individual report pages render filter shells and comments
like `report content goes here`; no report API hooks exist.

## 14. Subledger Display Audit

Frontend cannot currently display a full subledger matrix with:

- Counterparty
- Control Account
- Control Account Code
- Obligation type
- Debit
- Credit
- Balance

Customer/vendor tables show a single balance from the master record. There is
no UI that separates Reinsurer Premium AP from Reinsurer Claims AR, or Cedant
Premium AR from Cedant Claims AP. Backend supports control-account-scoped
subledger balances; frontend does not yet surface them.

## 15. Readiness Frontend Audit

Backend has grouped readiness through internal Reinsurance accounting readiness
and Reinsurance integration status surfaces. Frontend does not consume grouped
readiness (`premiumAccounting`, `claimsAccounting`, `cashConfirmation`).

Best existing place to surface it: Accounting Settings for configuration
readiness, plus Cash/Bank confirmation queue for cash-confirmation blockers.

## 16. Reinsurance Accounting Frontend Status

| Flow                                | Status                       | Notes                                                                                |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Debit Note accounting               | COMPLETE backend, PARTIAL UI | Events active; UI not a support/reconciliation console.                              |
| Credit Note accounting              | COMPLETE backend, PARTIAL UI | Same.                                                                                |
| Premium receipt confirmation        | PARTIAL                      | Queue exists; missing cash-account selector/type.                                    |
| Reinsurer disbursement confirmation | PARTIAL                      | Queue exists; missing cash-account selector/type.                                    |
| Claim payable approval              | COMPLETE/PARTIAL             | Reinsurance claim UI exists; Accounting support visibility limited.                  |
| Claim recovery approval             | COMPLETE/PARTIAL             | Reinsurance UI exists; Accounting support visibility limited.                        |
| Claim recovery receipt              | COMPLETE/PARTIAL             | Reinsurance records receipts; Accounting queue adapter not consumed.                 |
| Claim recovery bank confirmation    | PARTIAL                      | Backend and Reinsurance UI exist; Accounting queue missing adapter.                  |
| Cedant settlement                   | COMPLETE/PARTIAL             | Reinsurance settlement UI exists.                                                    |
| Cedant settlement bank confirmation | PARTIAL                      | Backend and Reinsurance UI exist; Accounting queue missing adapter.                  |
| Reversals                           | PARTIAL                      | Backend events/reconciliation exist; frontend coverage is source-flow-specific.      |
| Claim financial-close readiness     | PARTIAL                      | Backend exists; frontend visible mainly in claim workflow, not Accounting readiness. |

## 17. Throttle Audit

High-risk query fan-out found:

- `FacultativeTable`: per-row financial-position, payments and endorsement
  queries for closing/open tabs.
- `Paymentstable`: per-row financial-position and payments queries.
- `Claimstable`: per-row claims queries.
- Reinsurance dashboard/report hooks: per-placement claims/payments queries.
- `useAllPlacementParticipants`: one participant query per endorsement.
- `AddPaymentFormFields` and `AddClaimPaymentFormFields`: `useQueries`
  across selected placements.

Workflow mutation invalidations are intentionally broad in several places,
especially endorsement workflow invalidation and claim invalidation. Under a
short 10 requests/sec gateway throttle, large tables and immediate refetches can
exceed limits.

Verdict: `BOTH`.

- Frontend should reduce fan-out with backend aggregate endpoints or lazy row
  expansion.
- Backend/gateway may need route-specific higher limits for dashboard/table
  aggregate reads, but only after frontend obvious fan-out is reduced.

## 18. Dead / Unused Surfaces

| Surface                                                 | Classification                                | Reason                                                                             |
| ------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `AccountTypeDefinitionsTable` and `AddAccountTypePanel` | DEPRECATE_LATER                               | Backend has fixed account categories, not tenant CRUD for account types.           |
| `BudgetForecastTable`, `NewBudgetPanel`                 | KEEP/UNKNOWN                                  | Future feature shell; no backend today.                                            |
| `AccountsReceivableTable` mock                          | REMOVE_NOW when wiring backend                | Backend exists; mock table is stale.                                               |
| `AccountsPayableTable` mock                             | REMOVE_NOW when wiring backend                | Backend exists; mock table is stale.                                               |
| `JournalEntriesTable` mock                              | REMOVE_NOW when wiring backend                | Hooks exist; table stale.                                                          |
| `AccountTransactionsTable` mock                         | REMOVE_NOW when wiring `/accounts/:id/ledger` | Backend exists.                                                                    |
| Financial report placeholders                           | REMOVE_NOW when wiring report APIs            | Backend exists for core reports.                                                   |
| `/source-events` user-auth receive endpoint             | DEPRECATE_LATER                               | Useful demo/support route, but internal HMAC should be canonical source ingestion. |
| Cashbook backend with no UI                             | KEEP                                          | Needed for source cash posting and standalone cash operations.                     |

## 19. Handbook Review

The handbook was cross-checked against current route source. One documentation
mistake was fixed: the confirmation payload example no longer includes
`withholdingTaxAmount`, because the current confirmation DTOs do not accept it.

The handbook now explicitly states that backend confirmation DTOs accept
`accountingCashAccountId`, but the current frontend generic confirmation payload
type must be extended before the UI can send it reliably.

No invented APIs remain in the handbook examples.

## 20. Architecture Explanation

### A. Accounting manually creates an invoice

Accounting creates a draft AR invoice or AP bill. It has no financial effect
until posted. Posting creates immutable journals using the relevant control
account, customer/vendor subledger and selected offset GL.

### B. Accounting manually receives money

For standalone AR, Accounting creates a customer receipt. The receipt links to a
Cashbook receipt. Cashbook owns the cash movement and creates the cash journal
when posted. Receipt allocation applies cash to invoices without creating
duplicate cash journals.

### C. Reinsurance issues a Debit Note

Reinsurance owns the business document and enqueues a deterministic outbox
event. The Accounting source-event pipeline ingests the business fact, resolves
PostingRules, and posts the AR journal.

### D. Reinsurance confirms premium receipt

The payment is operationally recorded first. Accounting confirmation transitions
it to `BANK_CONFIRMED`, captures bank/cash facts, and only then emits the
premium receipt source event for posting.

### E. Claim recovery approved and later received

Recovery approval recognizes the receivable through PostingRules. Later recovery
receipt is recorded operationally as `RECORDED`; bank confirmation transitions
it to `BANK_CONFIRMED` and publishes the receipt event.

### F. Cedant claim payable approved and later paid

Claim payable approval recognizes the payable. Later Cedant settlement is
recorded operationally as `RECORDED`; bank confirmation transitions it to
`BANK_CONFIRMED` and publishes the settlement-paid event.

### G. Where Cashbook fits

Cashbook is the authoritative cash/bank ledger path. Source-module cash events
with cash impact create/link cashbook transactions so cash movement is not
posted twice.

### H. Where Journals fit

Journals are the immutable accounting record. Manual journals are direct
Accounting adjustments; generated journals come from AR/AP/Cashbook/source
events.

### I. Where Posting Rules fit

PostingRules map source business facts into balanced journal lines. Operational
modules do not choose GL accounts.

### J. Where subledgers/control accounts fit

Subledgers provide party-level detail under a specific control account. The same
legal counterparty can have separate balances for premium receivable, claims
payable, premium payable and claims receivable without netting.

### K. Why AR/AP/Cashbook/Journals are not duplicate systems

AR/AP model obligations and allocations. Cashbook models bank/cash movement.
Journals model posted accounting entries. They overlap in business narratives,
but each owns a different accounting layer.

## 21. Final Verdict

| Area                              | Verdict                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend architecture              | Strong layered foundation; source-event, posting-rule, cashbook bridge and subledger dimensions are coherent.                                                    |
| Duplicate endpoints               | No actual duplicate requiring removal; overlaps are mostly legitimate layer separation.                                                                          |
| Frontend readiness                | Approximately 35-45% for standalone Accounting; 60-70% for Reinsurance accounting workflows from source screens; lower for Accounting-owned support/admin views. |
| Standalone Accounting usability   | Not complete. A tenant cannot fully self-configure from UI yet.                                                                                                  |
| Reinsurance integration usability | Operationally usable in Reinsurance screens; Accounting queue is partial and lacks cash-account selection plus claims adapters.                                  |

P0 blockers:

- Cash account selector/type missing from Accounting financial confirmation UI
  despite backend requiring `accountingCashAccountId` for cash-impact methods.
- Claims recovery and Cedant settlement confirmation adapters are not wired into
  Accounting financial confirmation queue.
- Standalone Accounting cannot configure control accounts/posting rules/cash
  accounts purely from UI.

P1 gaps:

- Cashbook UI.
- AR/AP backend integration.
- Journal list/detail/post/reverse UI.
- Source Event support console.
- Report API consumers.
- Subledger/control-account balance drilldown.
- Grouped readiness UI.

P2 gaps:

- Generic backend confirmation aggregator.
- Aging/statement reports once backend exists.
- Budgeting/forecasting backend or removal of shell.
- Advanced setup wizard.
- Throttle optimization through aggregate endpoints.

Recommended next implementation:

1. Add Accounting cash-account hooks/type and wire `accountingCashAccountId` into
   the Financial Confirmation Queue.
2. Add claim recovery receipt and Cedant settlement adapters to the same queue.
3. Add Cash/Bank account management and cashbook list/detail.
4. Wire Posting Rules/readiness setup UI so tenants can self-configure.
5. Replace AR/AP mock tables with backend consumers.

## 22. Validation

Run during audit:

- `git status --short --branch`
- `git diff --check`
- direct whitespace check for the new handbook file

No build was required before the audit report because only Markdown files were
changed.
