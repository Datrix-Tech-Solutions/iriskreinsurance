# Report population, pagination, exports and frontend cache

## Premiums scopes

`GET /reports/premiums` retains placement-group `items` and pagination in both
scopes. `scope=cedant` is the default. Each group carries its settlement breakdown;
multiple displayed settlement rows belong to that one placement group. The UI
labels placement-group counts separately from displayed settlement rows.

`scope=reinsurer` accepts validated comma-separated `reinsurerId` UUIDs and
`settlementStatus` values `paid`, `part`, `pending`, `outstanding`. These are
separate from the cedant `paymentStatus`. Reinsurer/settlement filters require
reinsurer scope. The database filters actual attributed settlement rows before
JSON aggregation and placement pagination. Groups without a matching line are
excluded. Counterparty/lineage proof, replacement rules and fail-closed FX guards
from Patch 2 remain in place.

Current participant counts, gross premium, commission, brokerage, payable and
sum-insured summaries use the selected current closing rows. Proven retired-payee
credits retain their cash and signed outstanding but do not create a current
participant or obligation. Recorded disbursements are pending, not paid. Selected
settlement state and optional `pendingAmount` are exposed on nested rows.

Cedant obligation, premium receipt, deductions and cedant outstanding remain
placement-level context, counted once per matching placement group. They are
never prorated to a selected reinsurer. In reinsurer scope the relevant summary
cards explicitly say `Placement Groups`. Report dates keep the existing
placement-cohort/date-basis semantics; this patch adds no new financial or FX
formula.

## Count and summary consistency

All six list services read rows, summaries and counts in a repeatable-read
transaction. Nonempty pages reuse their existing filtered window count. Empty
pages issue one count-only query over the same filtered CTE, without page limit,
offset or sort. A request for page 3 of 51 rows at limit 50 returns no items,
`total=51`, `totalPages=2`. A genuinely empty population reports zero.

Cedants/Reinsurers count counterparty groups. Claims retains its existing
claim-versus-allocation grain selected by scope. Facultative and Premiums page
placement groups. Brokerage retains placement grain for cedant scope and
participant grain for reinsurer scope. Summaries cover every filtered record,
independently of the page.

## CSV and Excel-compatible XLS

Every format is served by the backend. Premiums no longer serializes its current
browser page to CSV. Applied list scope and filters are sent identically to both
exports, and pagination is ignored by export queries. XLS remains the existing
HTML-table `.xls` format, not XLSX; it is generated from the same CSV logical rows.

Premiums export headers mark repeated placement monetary values as `Placement
Context`; they must not be summed across participant rows. Participant money is
specific to that settlement row. Expanded exports and filtered result sets are
limited to 50,000 rows. An oversized export fails with
`REPORT_EXPORT_LIMIT_EXCEEDED`; narrow the filters rather than accepting a
silently truncated file. Existing endpoint URLs and response envelopes remain.

## Draft, applied and response state

Draft controls never change columns, row numbering, query parameters or export
parameters until Run Filter commits the full filter set and page 1. Pagination
commits its page independently of draft controls. Rendering uses the applied
scope and response metadata. Query keys include all applied scopes, IDs and
settlement filters; obsolete requests receive the query cancellation signal.
A late response is cached only under its own parameters, never under a newer
scope. Run Filter with identical normalized parameters explicitly invalidates
and refetches that exact query. Background refetches show a loading state; Patch
1 errors remain distinct from successful empty data.

## Financial mutation freshness

All report keys use `reinsuranceReportsKey`. Opt-in placement/participant/
closing/endorsement/payment/claim/recovery/settlement mutations and Accounting's
Reinsurance bank-confirmation action use a shared success-only invalidation
wrapper. Existing mutation callbacks and narrow detail/worklist invalidations
are preserved. Mounted reports refetch; unopened report entries become stale.
Unrelated modules/settings are not invalidated. Document generation/rendering
retains its original mutation behavior.

Direct database imports are not observable by frontend mutation hooks. Run
Filter or explicitly refresh after an out-of-band import.

## Currency fidelity and unsupported totals

Displayed financial currency codes come from report maps, not currency settings.
Zero and negative values are retained; missing values remain unavailable.
Settings metadata is optional. Currency settings/options share a paginated
metadata query and filter options union in the applied report's currency codes.
A denied settings request cannot hide a report currency.

NIC/WHT totals are explicitly unavailable on report adapters that do not provide
an authoritative summary. In particular the Cedants API's existing compatibility
zero placeholders are not interpreted by the UI as verified tax totals. This
patch does not reconstruct or change tax calculations. Native currencies are
never added together.

## Performance and remaining boundaries

The extra filtered count runs only on empty pages. Transaction snapshots prevent
count/summary races but hold a connection during the report reads; this patch
changes no connection-pool settings or transaction limits. Full filtered
summaries still require their existing aggregate CTE work. Exports materialize
bounded results; no unbounded browser-side placement scan is introduced.

The regression tests use synthetic tenants and real disposable PostgreSQL with
the checked-in Prisma migration chain. Query timing on those small fixtures is
not a production-scale load benchmark. Unsupported FX and genuinely ambiguous
payment attribution continue to fail closed. No live data, archive, tax or
migration behavior changes are included.
