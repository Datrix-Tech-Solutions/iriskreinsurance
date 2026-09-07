# WorkPhelo Accounting Frontend Integration Handbook

This handbook is the practical integration guide for frontend developers wiring
WorkPhelo Accounting screens to the current backend. It documents current source
routes only. If a capability is internal-only, missing in the frontend, or not
implemented, it is labelled explicitly.

## 1. Architecture Overview

Standalone Accounting flow:

```text
Setup -> Master Data/Subledger -> Cashbook/AR/AP/Journals -> Reports
```

Source-module automation flow:

```text
Operational Module -> Financial Confirmation -> Source Event -> Cashbook if cash-impact -> Journal -> Reports
```

Frontend rule of thumb: Accounting UI collects user intent and displays backend
truth. It must not duplicate posting, AR/AP balance, cashbook, subledger, or
financial-report calculations in the browser.

## 2. Base URLs / Routing

The web app uses the shared Axios client:

```ts
// apps/web/work-phelo-web/src/lib/api.ts
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});
```

Frontend hook paths therefore start with `/accounting/...`:

```ts
const res = await api.get('/accounting/currencies');
```

Direct local Accounting service routes use the service prefix:

```text
http://localhost:4008/api/*
```

API Gateway routes use:

```text
/api/v1/accounting/*
```

Internal signed routes intentionally do not belong in normal frontend code:

```text
INTERNAL: POST /internal/source-events
INTERNAL: POST /internal/subledgers/ensure
INTERNAL: POST /internal/reinsurance/accounting-readiness
```

## 3. Authentication / Tenant Context

All normal Accounting routes require:

- an authenticated tenant user
- Accounting module access
- the route-specific Accounting permission
- cookie/JWT context supplied by the shared web client

Do not pass `tenantId` from frontend forms. The backend derives tenant scope from
the authenticated user.

Example hook shape:

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAccountingCurrencies() {
  return useQuery({
    queryKey: ['accounting', 'currencies'],
    queryFn: async () => {
      const res = await api.get<AccountingCurrency[]>('/accounting/currencies');
      return res.data;
    },
  });
}
```

## 4. Setup APIs

Recommended setup order for a standalone Accounting tenant:

1. `GET/PATCH /accounting/config`
2. `GET/POST/PATCH /accounting/currencies`
3. `GET/POST/PATCH /accounting/exchange-rates`
4. `GET/POST /accounting/fiscal-periods`
5. `POST /accounting/account-hierarchy/seed-standard` if using defaults
6. `GET/POST/PATCH /accounting/account-classifications`
7. `GET/POST/PATCH /accounting/account-groups`
8. `GET/POST/PATCH /accounting/accounts`
9. `GET/POST/PATCH /accounting/cost-centres`
10. `GET/POST/PATCH /accounting/cash-accounts`
11. `GET/POST/PATCH /accounting/posting-rules` if using source integrations

Example: create currency.

```ts
await api.post('/accounting/currencies', {
  code: 'GHS',
  name: 'Ghanaian Cedi',
  symbol: 'GH₵',
  decimalPlaces: 2,
  isBaseCurrency: true,
  isActive: true,
});
```

Example: create fiscal period.

```ts
await api.post('/accounting/fiscal-periods', {
  name: 'FY 2026',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T23:59:59.999Z',
});
```

Example: create postable GL account.

```ts
await api.post('/accounting/accounts', {
  code: '1100-001',
  name: 'Main Bank Account',
  category: 'ASSET',
  normalBalance: 'DEBIT',
  accountGroupId: 'account-group-id',
  allowPosting: true,
});
```

## 5. Master Data

Current master-data routes:

- `GET/POST/PATCH /accounting/customers`
- `POST /accounting/customers/:customerId/deactivate`
- `POST /accounting/customers/:customerId/activate`
- `GET/POST/PATCH /accounting/vendors`
- `POST /accounting/vendors/:vendorId/deactivate`
- `POST /accounting/vendors/:vendorId/activate`
- `GET/POST/PATCH /accounting/subledger-accounts`
- `POST /accounting/subledger-accounts/:subledgerId/deactivate`

Frontend examples:

```ts
await api.post('/accounting/customers', {
  name: 'Acme Insurance',
  code: 'CUS-ACME',
  currency: 'GHS',
  defaultReceivableAccountId: 'ar-control-account-id',
});

await api.post('/accounting/vendors', {
  name: 'Reliable Re',
  code: 'VEN-RELIABLE',
  currency: 'USD',
  defaultPayableAccountId: 'ap-control-account-id',
});
```

CEDANT and REINSURER subledgers are normally created by signed internal source
module integration. The frontend may display `/accounting/subledger-accounts`,
but must not call `INTERNAL: /internal/subledgers/ensure`.

## 6. Cash & Bank

Cash account routes:

- `GET /accounting/cash-accounts`
- `POST /accounting/cash-accounts`
- `GET /accounting/cash-accounts/:cashAccountId`
- `PATCH /accounting/cash-accounts/:cashAccountId`

Cashbook routes:

- `GET /accounting/cashbook`
- `GET /accounting/cashbook/:transactionId`
- `POST /accounting/cashbook/receipts`
- `POST /accounting/cashbook/payments`
- `POST /accounting/cashbook/transfers`
- `POST /accounting/cashbook/charges`
- `POST /accounting/cashbook/adjustments`
- `POST /accounting/cashbook/:transactionId/post`
- `POST /accounting/cashbook/:transactionId/reverse`

Example: create cash account. Store masked public identifiers only.

```ts
await api.post('/accounting/cash-accounts', {
  name: 'GCB Main Operating Account',
  accountKind: 'BANK',
  currency: 'GHS',
  glAccountId: 'bank-gl-account-id',
  bankName: 'GCB Bank',
  accountNumber: '****1234',
  branch: 'Accra',
  isActive: true,
});
```

Example: create and post a manual cashbook receipt.

```ts
const receipt = await api.post('/accounting/cashbook/receipts', {
  cashAccountId: 'cash-account-id',
  amount: 2500,
  currency: 'GHS',
  transactionDate: '2026-08-12T10:00:00.000Z',
  settlementMethod: 'BANK_TRANSFER',
  reference: 'BANK-REF-001',
  description: 'Manual receipt',
  offsetGlAccountId: 'income-or-clearing-account-id',
});

await api.post(`/accounting/cashbook/${receipt.data.id}/post`);
```

Example: reverse a posted cashbook transaction.

```ts
await api.post(`/accounting/cashbook/${transactionId}/reverse`, {
  reversalDate: '2026-08-12T12:00:00.000Z',
  reason: 'Duplicate bank import line',
});
```

Source-module Cashbook rows may appear in `/accounting/cashbook`. They should be
displayed with source reference and journal linkage, not edited as manual rows.

## 7. Accounts Receivable

Lifecycle:

```text
Invoice -> Post -> Receipt -> Post via Cashbook -> Allocation -> Balance
```

Routes:

- `POST/GET /accounting/receivables/invoices`
- `GET /accounting/receivables/invoices/:invoiceId`
- `POST /accounting/receivables/invoices/:invoiceId/post`
- `POST /accounting/receivables/invoices/:invoiceId/reverse`
- `GET /accounting/receivables/invoices/:invoiceId/balance`
- `POST/GET /accounting/receivables/credit-notes`
- `POST /accounting/receivables/credit-notes/:creditNoteId/post`
- `POST /accounting/receivables/credit-notes/:creditNoteId/reverse`
- `POST /accounting/receivables/credit-notes/:creditNoteId/allocations`
- `POST/GET /accounting/receivables/receipts`
- `POST /accounting/receivables/receipts/:receiptId/post`
- `POST /accounting/receivables/receipts/:receiptId/reverse`
- `POST /accounting/receivables/receipts/:receiptId/allocations`
- `GET /accounting/receivables/receipts/:receiptId/allocations`
- `POST /accounting/receivables/allocations/:allocationId/reverse`
- `GET /accounting/receivables/customers/:customerId/balance`

Example: create and post customer invoice.

```ts
const invoice = await api.post('/accounting/receivables/invoices', {
  customerId: 'customer-id',
  documentNumber: 'INV-2026-001',
  documentDate: '2026-08-12T00:00:00.000Z',
  currency: 'GHS',
  subtotalAmount: 1000,
  taxAmount: 0,
  totalAmount: 1000,
  offsetGlAccountId: 'revenue-account-id',
  description: 'Consulting invoice',
});

await api.post(`/accounting/receivables/invoices/${invoice.data.id}/post`);
```

Example: create receipt, post it through Cashbook, allocate it.

```ts
const receipt = await api.post('/accounting/receivables/receipts', {
  customerId: 'customer-id',
  cashAccountId: 'cash-account-id',
  receiptNumber: 'RCT-2026-001',
  receiptDate: '2026-08-12T00:00:00.000Z',
  settlementMethod: 'BANK_TRANSFER',
  currency: 'GHS',
  amount: 600,
  reference: 'BANK-600',
});

await api.post(`/accounting/receivables/receipts/${receipt.data.id}/post`);

await api.post(
  `/accounting/receivables/receipts/${receipt.data.id}/allocations`,
  {
    invoiceId: 'posted-invoice-id',
    amount: 600,
  },
);
```

Always fetch balances from backend:

```ts
const invoiceBalance = await api.get(
  `/accounting/receivables/invoices/${invoiceId}/balance`,
);
const customerBalance = await api.get(
  `/accounting/receivables/customers/${customerId}/balance`,
);
```

Do not calculate outstanding AR locally from table rows.

## 8. Accounts Payable

Lifecycle:

```text
Bill -> Post -> Payment -> Post via Cashbook -> Allocation -> Balance
```

Routes:

- `POST/GET /accounting/payables/bills`
- `GET /accounting/payables/bills/:billId`
- `POST /accounting/payables/bills/:billId/post`
- `POST /accounting/payables/bills/:billId/reverse`
- `GET /accounting/payables/bills/:billId/balance`
- `POST/GET /accounting/payables/credit-notes`
- `POST /accounting/payables/credit-notes/:creditNoteId/post`
- `POST /accounting/payables/credit-notes/:creditNoteId/reverse`
- `POST /accounting/payables/credit-notes/:creditNoteId/allocations`
- `POST/GET /accounting/payables/payments`
- `POST /accounting/payables/payments/:paymentId/post`
- `POST /accounting/payables/payments/:paymentId/reverse`
- `POST /accounting/payables/payments/:paymentId/allocations`
- `GET /accounting/payables/payments/:paymentId/allocations`
- `POST /accounting/payables/allocations/:allocationId/reverse`
- `GET /accounting/payables/vendors/:vendorId/balance`

Example: create and post vendor bill.

```ts
const bill = await api.post('/accounting/payables/bills', {
  vendorId: 'vendor-id',
  documentNumber: 'BILL-2026-001',
  documentDate: '2026-08-12T00:00:00.000Z',
  currency: 'GHS',
  subtotalAmount: 1200,
  taxAmount: 0,
  totalAmount: 1200,
  offsetGlAccountId: 'expense-account-id',
  description: 'Supplier bill',
});

await api.post(`/accounting/payables/bills/${bill.data.id}/post`);
```

Example: create AP payment, post it through Cashbook, allocate it.

```ts
const payment = await api.post('/accounting/payables/payments', {
  vendorId: 'vendor-id',
  cashAccountId: 'cash-account-id',
  paymentNumber: 'PAY-2026-001',
  paymentDate: '2026-08-12T00:00:00.000Z',
  settlementMethod: 'BANK_TRANSFER',
  currency: 'GHS',
  amount: 500,
  reference: 'BANK-PAY-500',
});

await api.post(`/accounting/payables/payments/${payment.data.id}/post`);

await api.post(`/accounting/payables/payments/${payment.data.id}/allocations`, {
  billId: 'posted-bill-id',
  amount: 500,
});
```

Always fetch backend balances:

```ts
await api.get(`/accounting/payables/bills/${billId}/balance`);
await api.get(`/accounting/payables/vendors/${vendorId}/balance`);
```

## 9. Journals

Manual journal routes:

- `GET/POST /accounting/journals`
- `GET/PATCH /accounting/journals/:journalId`
- `POST /accounting/journals/:journalId/post`
- `POST /accounting/journals/:journalId/reverse`

Manual journals are for Accounting-owned adjustments and corrections. Domain
posting endpoints such as AR invoice post, AP payment post and Cashbook post
create their own journals. Frontend must not create a duplicate manual journal
for those domain actions.

Example: post manual journal.

```ts
const journal = await api.post('/accounting/journals', {
  journalDate: '2026-08-12T00:00:00.000Z',
  description: 'Approved correction',
  currency: 'GHS',
  lines: [
    {
      lineNumber: 1,
      glAccountId: 'expense-account-id',
      debit: 100,
      credit: 0,
      description: 'Debit correction',
    },
    {
      lineNumber: 2,
      glAccountId: 'cash-account-gl-id',
      debit: 0,
      credit: 100,
      description: 'Credit correction',
    },
  ],
});

await api.post(`/accounting/journals/${journal.data.id}/post`);
```

## 10. Posting Rules

PostingRule routes:

- `GET/POST /accounting/posting-rules`
- `GET/PATCH/DELETE /accounting/posting-rules/:ruleId`
- `POST /accounting/posting-rules/:ruleId/lines`
- `PATCH/DELETE /accounting/posting-rules/:ruleId/lines/:lineId`

PostingRules map source-module events to GL/subledger lines. Frontend setup
screens should let Accounting configure:

- source module, e.g. `REINSURANCE`
- source event type, e.g. `CLAIM_PAYABLE_APPROVED`
- active/effective dates
- debit/credit lines
- GL account per line
- amount and currency source paths
- optional subledger type and external reference source

Example: create PostingRule for claim payable approval.

```ts
await api.post('/accounting/posting-rules', {
  name: 'Reinsurance claim payable approved',
  sourceModule: 'REINSURANCE',
  sourceEventType: 'CLAIM_PAYABLE_APPROVED',
  version: 1,
  active: true,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  lines: [
    {
      sequence: 1,
      direction: 'DR',
      glAccountId: 'claims-expense-account-id',
      amountSource: 'amounts.approvedPayableAmount',
      currencySource: 'currency',
      descriptionTemplate:
        'Claim payable {{payload.references.approvalReference}} expense',
    },
    {
      sequence: 2,
      direction: 'CR',
      glAccountId: 'cedant-claims-ap-control-account-id',
      subledgerType: 'CEDANT',
      subledgerExternalRefSource: 'counterparty.id',
      amountSource: 'amounts.approvedPayableAmount',
      currencySource: 'currency',
      descriptionTemplate:
        'Claim payable {{payload.references.approvalReference}}',
    },
  ],
});
```

Do not hardcode GL IDs in source-module UI. PostingRules are Accounting-owned
configuration.

## 11. Reinsurance Integration

Active Reinsurance source-event families:

- Premium AR: `DEBIT_NOTE_ISSUED`, `ENDORSEMENT_DEBIT_NOTE_ISSUED`,
  `PREMIUM_PAYMENT_RECEIVED`, `PAYMENT_REVERSED`
- Premium AP: `CREDIT_NOTE_ISSUED`, `ENDORSEMENT_CREDIT_NOTE_ISSUED`,
  `REINSURER_DISBURSEMENT_RECORDED`, `REINSURER_DISBURSEMENT_REVERSED`
- Claims AP: `CLAIM_PAYABLE_APPROVED`, `CLAIM_CEDANT_SETTLEMENT_PAID`,
  `CLAIM_CEDANT_SETTLEMENT_REVERSED`
- Claims AR: `CLAIM_RECOVERY_APPROVED`, `CLAIM_RECOVERY_RECEIVED`,
  `CLAIM_RECOVERY_RECEIPT_REVERSED`

Reinsurance-owned frontend calls source-module confirmation endpoints for
bank-confirmed operations. Current frontend hooks include:

```text
GET  /operations/reinsurance/placements/payments/pending-bank-confirmation
POST /operations/reinsurance/placements/:placementId/payments/:paymentId/bank-confirmation
```

Use the work-item adapter pattern from
`apps/web/work-phelo-web/src/hooks/accounting/useReinsuranceBankConfirmations.ts`.

Example confirmation payload:

```ts
await api.post(
  `/operations/reinsurance/placements/${placementId}/payments/${paymentId}/bank-confirmation`,
  {
    bankConfirmedAt: '2026-08-12T11:00:00.000Z',
    bankReference: 'BANK-CONF-001',
    accountingCashAccountId: 'cash-account-id',
    confirmedExchangeRate: '12.50000000',
    bankChargeAmount: 15,
    notes: 'Confirmed from bank statement',
  },
);
```

Cash account selection is required for real cash/bank movement methods such as
`BANK_TRANSFER`, `CHEQUE`, `CASH` and `MOBILE_MONEY`. Do not require cash
account selection for `INTERNAL_OFFSET` or `JOURNAL`.

Current backend confirmation DTOs accept `accountingCashAccountId`; the frontend
generic confirmation payload type must include that field before the UI can send
it reliably.

## 12. Control Account + Subledger Dimensions

The same legal counterparty can have separate balances under different control
accounts. Frontend must preserve and display the control-account dimension.

Example:

```text
Reliable Re
Premium AP = 100 Cr
Claims AR  = 100 Dr
```

Do not display this as net zero. Premium payable and claims recovery receivable
are different obligations.

Required display fields where available:

- `controlAccountId`
- `controlAccount.code`
- `controlAccount.name`
- `subledgerAccountId`
- `subledger.type`
- source module/event/reference
- obligation category or report grouping

## 13. Financial Confirmation Queue

Current architecture is Phase 1 composition:

- Accounting UI can show generic work items.
- Source-module adapters fetch source-owned records.
- Confirmation mutations call source-module endpoints.
- Accounting does not directly mutate Reinsurance tables.

Example work item shape for UI:

```ts
type AccountingBankConfirmationWorkItem = {
  id: string;
  sourceModule: 'REINSURANCE';
  sourceRecordId: string;
  sourceReference: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  counterpartyName: string;
  amount: string | number;
  currency: string;
  settlementMethod: string | null;
  availableConfirmationActions: string[];
};
```

Example invalidation after successful confirmation:

```ts
queryClient.invalidateQueries({
  queryKey: ['accounting', 'reinsurance-bank-confirmations'],
});
queryClient.invalidateQueries({
  queryKey: ['accounting', 'cashbook'],
});
queryClient.invalidateQueries({
  queryKey: ['accounting', 'reports'],
});
queryClient.invalidateQueries({
  queryKey: ['reinsurance', 'facultatives', placementId, 'financial-position'],
});
```

## 14. Readiness / Preflight

Backend readiness has two levels:

- Module readiness: Accounting integration, PostingRules, open fiscal period,
  currencies and cash-account setup are generally present.
- Transaction readiness: a specific financial event has its business date,
  currency, settlement method and selected cash account validated.

Frontend-facing Reinsurance status route:

```text
GET /operations/reinsurance/accounting-integration/status
```

It returns grouped readiness for:

- `premiumAccounting`
- `claimsAccounting`
- `cashConfirmation`

Readiness blocker codes:

- `ACCOUNTING_INTEGRATION_DISABLED`
- `POSTING_RULE_MISSING`
- `POSTING_RULE_INACTIVE`
- `POSTING_RULE_INVALID`
- `CONTROL_ACCOUNT_MISSING`
- `CONTROL_ACCOUNT_INACTIVE`
- `CONTROL_ACCOUNT_NOT_POSTABLE`
- `CURRENCY_MISSING`
- `CURRENCY_INACTIVE`
- `FISCAL_PERIOD_MISSING`
- `FISCAL_PERIOD_CLOSED`
- `CASH_ACCOUNT_REQUIRED`
- `CASH_ACCOUNT_INVALID`

Example blocker renderer:

```ts
function readinessMessage(code: string) {
  const labels: Record<string, string> = {
    POSTING_RULE_MISSING: 'Posting rule is missing',
    FISCAL_PERIOD_CLOSED: 'Fiscal period is closed',
    CASH_ACCOUNT_REQUIRED: 'Accounting cash account is required',
  };
  return labels[code] ?? code.replaceAll('_', ' ');
}
```

If preflight returns `409 ACCOUNTING_NOT_READY`, show the backend message and
blocker list. Do not retry automatically as if it were a transient network
failure.

## 15. Reports

Backend-supported reports:

- `GET /accounting/reports/general-ledger`
- `GET /accounting/reports/trial-balance`
- `GET /accounting/reports/income-statement`
- `GET /accounting/reports/balance-sheet`

Example:

```ts
const res = await api.get('/accounting/reports/general-ledger', {
  params: {
    fromDate: '2026-01-01',
    toDate: '2026-08-12',
    accountId: 'gl-account-id',
    currency: 'GHS',
  },
});
```

Current frontend has report pages, but some pages may still be placeholder-like
or mapped to old labels such as Profit and Loss. Use backend report responses as
the only source of truth.

## 16. Error Handling

Recommended frontend behavior:

- `400`: validation issue; show field-level or form-level backend message.
- `401`: shared Axios client refreshes token; if refresh fails, redirect.
- `403`: permission/module issue; show access-denied state.
- `404`: missing tenant-scoped record; show not-found state.
- `409`: business conflict; show actionable blocker or lifecycle reason.
- `422`: semantic validation; show backend details if present.
- `429`: throttle/rate limit; disable duplicate actions and allow retry.
- `500`: generic failure; do not assume mutation succeeded.

Example conflict handler:

```ts
function extractApiMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string | string[];
          blockers?: Array<{ code: string; message: string }>;
        }
      | undefined;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    return data?.message ?? 'Request failed';
  }
  return 'Request failed';
}
```

## 17. Query Invalidation Guidance

After setup/config changes:

- invalidate `['accounting', 'config']`
- invalidate `['accounting', 'currencies']`
- invalidate `['accounting', 'exchange-rates']`
- invalidate `['accounting', 'fiscal-periods']`
- invalidate `['accounting', 'gl-accounts']`
- invalidate related selector queries

After posting or reversal:

- invalidate the document list/detail
- invalidate `['accounting', 'journals']`
- invalidate `['accounting', 'cashbook']` if cash-impact
- invalidate `['accounting', 'reports']`
- invalidate relevant balance queries

After receipt/payment allocation:

- invalidate receipt/payment detail
- invalidate invoice/bill balance
- invalidate customer/vendor balance
- invalidate AR/AP list pages

After Reinsurance bank confirmation:

- invalidate financial confirmation queue
- invalidate Accounting cashbook/reports
- invalidate Reinsurance payment history
- invalidate Reinsurance financial position
- invalidate Reinsurance claim financial readiness if claim-related

## 18. Do Not Do These Things

Frontend must not:

- calculate AR/AP balances locally
- calculate accounting journals
- net different control-account obligations
- hardcode GL IDs
- hardcode `cashAccountId` values
- recalculate historical taxes/levies from current config
- bypass PostingRules
- create duplicate Cashbook transactions for AR/AP receipt/payment posting
- expose internal HMAC APIs to normal users
- call `/internal/source-events`
- call `/internal/subledgers/ensure`
- call `/internal/reinsurance/accounting-readiness`
- silently treat `409 ACCOUNTING_NOT_READY` as a successful operation

## 19. Current Backend-Ready / Frontend-Missing Matrix

| Capability                | Backend status | Current frontend status     | Guidance                                           |
| ------------------------- | -------------- | --------------------------- | -------------------------------------------------- |
| Accounting config         | Backend ready  | Partial hooks/pages         | Finish setup journey before advanced flows         |
| Currencies/exchange rates | Backend ready  | Partial UI                  | Use backend active/base flags                      |
| Fiscal periods            | Backend ready  | Partial UI                  | Add open/close/lock actions if missing             |
| Chart of Accounts         | Backend ready  | Partial UI                  | Preserve hierarchy and `allowPosting`              |
| Cost centres              | Backend ready  | Frontend missing/partial    | Add setup screen if needed                         |
| Cash accounts             | Backend ready  | Frontend missing/partial    | Required for confirmations                         |
| Cashbook                  | Backend ready  | Partial UI                  | Add post/reverse and source visibility             |
| Standalone AR             | Backend ready  | Partial/stale UI            | Replace mock invoice flows with backend routes     |
| Standalone AP             | Backend ready  | Partial/stale UI            | Wire bills/payments/allocations to backend         |
| Journals                  | Backend ready  | Partial UI                  | Do not duplicate domain postings                   |
| Posting Rules             | Backend ready  | Frontend missing            | P0 for source-module readiness                     |
| Source events             | Backend ready  | Frontend missing/admin only | Support/Ops UI only                                |
| Financial reports         | Backend ready  | Partial/placeholder UI      | Use backend report endpoints                       |
| Reinsurance confirmation  | Backend ready  | Partial UI                  | Needs cash-account selectors and readiness display |
| Readiness blockers        | Backend ready  | Frontend missing            | Add setup/readiness panel                          |

## 20. Recommended Frontend Implementation Order

P0:

- Accounting cash-account selectors and management UI.
- PostingRule setup UI for Reinsurance event families.
- Reinsurance Accounting readiness panel showing blocker codes.
- Financial Confirmation Queue cash-account selection for cash methods.
- Replace AR/AP placeholder tables with backend lists and balance endpoints.

P1:

- Cashbook list/detail/post/reverse UI.
- AR invoice/receipt/credit-note lifecycle.
- AP bill/payment/vendor-credit lifecycle.
- Source-event support console for Accounting admins/support.
- Report pages wired to backend filters and response shapes.

P2:

- Better onboarding wizard for standalone Accounting setup.
- Advanced subledger/control-account drilldowns.
- Export/download for reports.
- Aging/statement UI only after backend endpoints exist.
- Cross-module queue aggregator if Product wants one generic backend API.

## Example React Query Hook Patterns

List with filters:

```ts
export function useCashbook(params: QueryCashbookParams) {
  return useQuery({
    queryKey: ['accounting', 'cashbook', params],
    queryFn: async () => {
      const res = await api.get('/accounting/cashbook', { params });
      return res.data;
    },
  });
}
```

Mutation with scoped invalidation:

```ts
export function usePostCashbookTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await api.post(`/accounting/cashbook/${transactionId}/post`);
      return res.data;
    },
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'cashbook'] });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'journals'] });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'reports'] });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'cashbook', transaction.id],
      });
    },
  });
}
```

Disable duplicate submit:

```tsx
<Button disabled={mutation.isPending} onClick={() => mutation.mutate(id)}>
  {mutation.isPending ? 'Posting...' : 'Post'}
</Button>
```

Backend truth balance display:

```ts
const { data: balance } = useQuery({
  queryKey: ['accounting', 'receivables', 'invoices', invoiceId, 'balance'],
  queryFn: async () => {
    const res = await api.get(
      `/accounting/receivables/invoices/${invoiceId}/balance`,
    );
    return res.data;
  },
  enabled: Boolean(invoiceId),
});
```

The browser should display `balance.outstandingAmount` or equivalent backend
fields. It should not reconstruct balances from invoice, receipt, and credit
note tables.
