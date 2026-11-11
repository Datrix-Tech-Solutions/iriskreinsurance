# Operational financial reporting contract

## Current recovery versus activity

Claims current recovered cash is the sum of original, unreversed
`BANK_CONFIRMED` recovery receipts. Reversing a receipt changes its original
status to `REVERSED` and creates a positive linked reversal. Current balances
exclude both; they do not subtract the reversal a second time. Reversed amounts
remain available as separate operational information.

The Claims dashboard with `since`/`until` reports recovery activity by each
receipt's `bankConfirmedAt`: a confirmed original contributes positively in its
confirmation period even after reversal, and its confirmed reversal contributes
negatively in the reversal period. Without dates, it reports current recovered
cash. Reversing a merely `RECORDED` receipt creates no bank cash activity.
Premium-payment reversals have a different sign/status lifecycle and are not
processed using the claims-recovery convention.

## Disbursement attribution

Premiums, Facultative and Reinsurers reports resolve disbursements to confirmed
original/endorsement closing sources through existing closing identifiers,
participant lineage or explicit credit-note allocations. Both lineage and
counterparty must match the current snapshot. Allocation amounts must reconcile
to the payment header; allocations and the header are never counted twice.

Source components are aggregated before joining snapshots. Original and
endorsement installments for the same continuing reinsurer therefore settle
one effective obligation. Confirmed closing sources remain provable even when
their parent endorsement is future-effective, unclosed or void: their actual
cash is retained as settlement-only credit, without adding an ineligible
obligation. Payments to a replaced reinsurer remain with that
reinsurer, not its replacement. Negative reinsurer outstanding amounts represent
credits/overpayments, consistent with financial position.

For proven historical sources that no longer have a current obligation, nested
Premiums/Facultative results may contain additive `rowKind: SETTLEMENT_ONLY` rows.
These retain real historical identities and have zero current premium/payable;
they carry historical cash without inflating current participant or premium
totals. Existing fields/types are retained; Facultative also supplies an optional real
`closingId` so client row keys distinguish multiple snapshots for one payee.
Readers must not interpret such a
row as a new current participant. Reinsurers aggregates include the corresponding
zero-obligation counterparty credit.

Unresolved identities, conflicting sources, ambiguous attribution and malformed
allocations fail closed with HTTP 409, including exports. No proportional split
is invented. Cross-currency settlement is also rejected in these reports until
an explicit cash-versus-obligation currency contract is implemented; persisted
FX facts are not silently applied or money relabeled. Premium receipt currency
is checked where that receipt contributes to report totals.

Guard, rows, summaries and KPIs execute in one repeatable-read snapshot so a
concurrent change cannot bypass attribution validation between reads.

## Dashboard current financial position

Financial dashboard periods continue to select the placement-created cohort.
Financial amounts use currently effective confirmed closings: CLOSED
endorsements effective now replace their original participant snapshots in
canonical effective-date/creation/number/ID order. Unaffected originals remain;
additive participants enter once. Future, void and unclosed endorsements do not
change current financial balances. These are current positions, not cumulative
closing issuance activity. Native currency breakdowns remain separate.

## Disposable PostgreSQL regression checks

Patch 2 tests require `FINANCIAL_REPORTS_TEST_DATABASE_URL`, explicitly targeting
localhost and an `irisk_financial_test_` database. They never fall back to the
application database URL. Provision the checked-in Prisma migrations into a new
local database with `prisma migrate deploy`, then run:

```sh
npm run test:unit --workspace=apps/reinsurance-service -- --runInBand --runTestsByPath \
  src/placements/reports/claims-financial-correctness.database.spec.ts \
  src/placements/reports/dashboard-financial-correctness.database.spec.ts \
  src/placements/reports/financial-reports-attribution.database.spec.ts
```

Fixtures are synthetic and tenant-isolated. No shared-environment migrations or
financial writes are part of these checks. Patch 1's separate query-schema suite
continues to use its own fresh `REPORTS_TEST_DATABASE_URL` database.
