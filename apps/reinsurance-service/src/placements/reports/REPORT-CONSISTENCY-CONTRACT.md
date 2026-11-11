# Report population, pagination, exports and frontend cache

## Premiums scopes

`GET /reports/premiums` retains placement-group `items` and pagination in both
scopes. `scope=cedant` is the default. Each group carries its settlement breakdown;
multiple displayed settlement rows belong to that one placement group and share
its row number. This is documented here without adding onscreen explanatory text.

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
never prorated to a selected reinsurer. Existing card titles are preserved; their
financial definitions are documented here. Report dates keep the existing
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

Premiums preserves the existing 25 CSV column names and their original order.
No identity or settlement-status columns are appended. Placement/closing IDs,
settlement state and provenance remain available in API data. Placement-context
figures (100% values and cedant totals) repeat on participant export rows and
must not be summed across those rows; use API group identities or authoritative
server summaries when aggregating. Participant money is specific to that row.

Expanded exports and filtered result sets remain limited to 50,000 rows. An
oversized export fails with `REPORT_EXPORT_LIMIT_EXCEEDED`; narrow the filters
rather than accepting a silently truncated file. The limit is documented here
and enforced server-side, without adding explanatory UI text. Existing endpoint
URLs and response envelopes remain.

## Draft, applied and response state

Draft controls never change columns, row numbering, query parameters or export
parameters until Run Filter commits the full filter set and page 1. Pagination
commits its page independently of draft controls. Rendering uses the applied
scope and response metadata. Query keys include all applied scopes, IDs and
settlement filters; obsolete requests receive the query cancellation signal.
A late response is cached only under its own parameters, never under a newer
scope. Run Filter with identical normalized parameters explicitly invalidates
and refetches that exact query, including a previously cached target page. Initial
loads and new requests without data show the existing loading state. Background
refetches keep successfully loaded rows/cards visible without replacing them
with skeletons. Query keys still separate scopes and pages; no previous-scope
placeholder data is introduced. Patch 1 errors remain explicit and distinct from
successful empty data.

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
A denied settings request cannot hide a report currency. Existing metadata order
is preserved where available; otherwise missing report codes are appended in
code order. No visual redesign is needed to preserve complete currency data.

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

| Surface                                    | dev baseline                            | Original Patch 3 presentation              | Accepted presentation                                            |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Premiums reinsurer-scope headings          | Original iRisk Re headings              | Changed to Reinsurer wording               | Restored exact dev headings/order                                |
| Reinsurer Name display column              | Absent in reinsurer scope               | Added                                      | Removed from reinsurer scope; cedant-scope column preserved      |
| Reinsurer Settlement Status display column | Absent                                  | Added                                      | Removed; API state and filters retained                          |
| Placement/settlement explanatory copy      | Absent                                  | Added near pagination                      | Removed                                                          |
| Premiums Pending KPI                       | Absent                                  | Added                                      | Removed; pending API classification retained                     |
| Currency-card title suffix                 | None                                    | Placement Groups suffix                    | Removed; titles restored                                         |
| Pagination export-limit copy               | Absent                                  | Added as second line                       | Removed; original counter component restored                     |
| Premiums CSV header/order                  | 25 original columns                     | 29 columns, renamed context headers        | 25 original headers/order restored                               |
| CSV identity/status additions              | None                                    | Four appended columns                      | Removed; API identity/status fields remain                       |
| Known currency ordering                    | Metadata display order                  | Alphabetical                               | Metadata display order restored; missing report codes appended   |
| Background refresh                         | Loaded rows retained                    | Skeletons during isFetching                | Loaded rows/cards retained; initial loading and errors unchanged |
| Report data/counts/group numbers           | Known filtering/count defects           | Correct server population                  | Retained for correctness                                         |
| Applied/draft filter behavior              | Could relabel old rows                  | Applied-only rendering                     | Retained for correctness                                         |
| Reinsurer/settlement controls              | Existing controls                       | Server-backed, Pending selectable          | Controls and functionality retained, unchanged design            |
| Currency completeness                      | Could hide missing metadata/zero values | All report codes and genuine zeros/credits | Retained, with known ordering restored                           |
| Unsupported NIC/WHT                        | Could look empty/zero                   | Unavailable message within existing cards  | Retained to avoid fabricated zero totals                         |
| Export from empty requested page           | Unavailable despite matches elsewhere   | Available for full matching population     | Retained; same menu/buttons                                      |
| Navigation/cards/fonts/spacing             | Existing design                         | No intentional redesign except copy above  | Unchanged; static component class audit matches dev              |

## Transaction and pool review

This UI revision changes no SQL population, aggregation, attribution, isolation,
transaction options or pool settings. Premiums, Reinsurers and Facultative retain
Patch 2 repeatable-read reads. Cedants, Brokerage and Claims retain Patch 3's
repeatable-read list/summary/count snapshots. Each call holds one connection
until those reads finish; it does not hold a transaction across browser actions.
Queries within an interactive transaction use that one connection.

Nonempty pages use their existing window count; empty pages add one unpaginated,
unsorted filtered count. Bounded exports may retain a connection during their
existing CSV serialization callback. PrismaService supplies no global timeout
or pool override; report calls set isolation only and retain Prisma 5.22's
existing transaction defaults (verified in the generated client: 2,000 ms max
wait and 5,000 ms timeout). This revision does not increase those limits.

Synthetic local timing/query-count evidence (51 groups: approximately 8–70 ms
per call) verifies the additional empty-page count and unchanged read structure;
it is not a production-scale benchmark.
Large filtered aggregates or exports can still exceed existing timeout/pool
capacity under load. Capacity measurement remains an operational follow-up;
changing credentials, pool sizes or transaction timeouts is outside this change.
Active-only report invalidation and normal pagination cache reuse are preserved;
background UI stability does not introduce polling or extra requests.
