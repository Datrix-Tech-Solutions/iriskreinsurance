# Reporting performance and transaction contract (Patch 4)

Base: `04c7e4d1340c66a355818ff9881cc17866628b4d` (24 November 2026).
This includes Patch 1 (`007e7b2d`), Patch 2 (`1945a98c` / `3bcbc392`)
and Patch 3 (`f0cb9632`, including the UI-preservation revision).
No frontend, schema, financial formula, report DTO, export header, route,
permission or tenant filter change is part of this patch.

## Query execution

The former payment-part LATERAL aggregates repeatedly scanned materialized
historical sources and current snapshots. The frozen original implementation
is retained in `testing/payment-attribution-baseline.fixture.ts` as a test-only
oracle. The PostgreSQL financial tests compare complete resolved parts,
attribution errors, current settlement groups and retired credits against it.

The replacement groups source/current matches by payment ID and physical part ID
using equijoins. The original three mutually exclusive source identity shapes
remain: original closing, endorsement closing, or original participant fallback.
No first-match rule was introduced. MIN projects identities; the same exact
source uniqueness and current ambiguity checks remain mandatory before any
report or export can emit data. Missing counts are explicitly zero, not NULL.

Participant/endorsement placement ownership is retained as a source-validity
proof and required at matching and currency-validation boundaries. It is not
discarded. Materializing that proof avoids the old planner error in which
redundant FK equalities estimated approximately four sources for about 32,000
actual rows. The identity CASE has the same mutually exclusive truth conditions
as the original OR predicate, with more stable candidate estimates.

The correlated current-currency existence check is a set-based existence join.
Payment/obligation/placement currencies, FX refusal, explicit payee ownership,
allocation/header reconciliation, pending cash, reversals and retired credits
are unchanged. Narrow payment projections reduce intermediate tuple width.

The guard intentionally validates the full selected base placement population,
including failures outside a page. It remains in the same repeatable-read
snapshot as rows/counts/summaries. Unreferenced report projections are pruned
from guard plans; a separate copied guard population builder was not needed.
The materialized error boundary avoids a LIMIT-driven startup plan repeatedly
rescanning the population merely to prove that there are no errors.

Facultative participant JSON is grouped by placement once rather than scanning
the same materialized sources per returned placement. Its field expressions,
ordering, optional selected-reinsurer restriction and settlement-only rows are
unchanged. KPI queries omit that wide JSON projection and count current
reinsurer identities relationally, excluding settlement-only credits as before.
Facultative's three KPI statements and Premiums' two become one each. Financial
and count definitions do not change. Empty-page fallback counts remain intact.

## Transaction deadlines and pooling

Premiums, Facultative and Reinsurers list/CSV reads use `reportTransaction`:

- RepeatableRead, unchanged.
- Pool acquisition maxWait: 2,000 ms, unchanged from Prisma's former default.
- Interactive transaction timeout: 18,000 ms, scoped to these reports only.
- Shared monotonic SQL budget: 15,000 ms from callback entry, not 15 seconds per
  statement. Each read sets its remaining PostgreSQL `statement_timeout`.
- Transaction-local `plan_cache_mode=force_custom_plan`. A prepared generic plan
  reproduced a 12-second guard timeout on a skewed synthetic tenant; the same
  custom plan completed in about 0.58 seconds. Parameter-specific planning avoids
  the generic-plan regression after repeated prepared executions. Planning cost
  is included in end-to-end measurements.
- Transaction-local `jit=off`. PostgreSQL 16's real guard plan spent about
  2.5 seconds compiling 406 JIT functions before the useful work. Disabling JIT
  is restricted to these measured report transactions, not the server or app.
- PostgreSQL settings use `set_config(..., true)` and reset at transaction end.
  No application-wide timeout, pool size, server setting or role setting changes.
- SQL timeout/cancellation (57014), pool timeout or transaction expiration returns
  sanitized HTTP 503 `REPORT_EXECUTION_DEADLINE_EXCEEDED`; conflicts remain 409.
  No partial rows/summaries/exports are returned on timeout.

One transaction uses one database connection. Promise.all does not parallelize
its statements; redundant KPI statements were removed rather than adding
connections. Transaction-local settings work with session or transaction pooling;
the pool must support ordinary interactive transactions and these settings.

The SQL budget leaves three seconds for rollback before Prisma expires; pool
acquisition plus the Prisma limit leaves headroom below the gateway's nominal
30-second downstream timeout. Network failures and synchronous serialization
are not independently interruptible by this helper. Existing bounded CSV
serialization still runs in the callback and may hold its connection.

HTTP disconnects are not claimed to cancel Prisma queries immediately. The
gateway destroys its downstream socket on timeout/abort, but this does not
propagate a database cancellation through these Nest services. The server-side
statement deadline bounds outstanding SQL independently of browser/gateway
disconnects. No unsafe Promise.race or detached background database work is used.

PostgreSQL tests exercise real pg_sleep cancellation, rollback, connection reuse,
setting reset and stable rows/counts while another connection writes synthetic
fixtures. No DEV/PROD database writes or settings changes are involved.

## Measurement interpretation

Private evidence is stored outside Git under the Patch 4 execution directory.
All measured data is generated synthetic data: 10,500 selected placements,
31,498 participants, 31,998 original/endorsement closings, 30,000 payments,
16,000 allocations and 16,000 notes, plus a separate synthetic tenant.
Both GHS and USD and 500 historical endorsement snapshots are represented.
Amounts never cross currencies. The dataset has deliberately simple counterparties
and is not a copy of client data or a comprehensive production distribution.

Bounded EXPLAIN ANALYZE runs use 4 MiB work_mem. Several original broad guard,
row and KPI queries exceeded the 12-second diagnostic limit. Those are lower
bounds, not fabricated completed-query times or temporary-I/O measurements.
Completed same-date-range comparisons show, for example, the Premiums guard
falling from about 5.83 seconds to 0.13 seconds and the Facultative KPI from
9.69 seconds to 0.08 seconds on a narrower historical population.

An additional deliberately low-memory (64 KiB) same-population spill stress test
reduced guard temporary reads from 102,759 to 1,577 blocks (approximately 98.5%).
Temporary writes rose from 881 to 1,547 blocks; this trades one-time grouped
materialization for repeated reads. This is a stress diagnostic, not the server's
production work_mem. Broad optimized guards still perform bounded temporary I/O;
the rewrite is not a promise of zero spill.

Final serial/concurrent distributions, both PostgreSQL versions, EXPLAIN plans,
query timings and connection sampling accompany the execution evidence and PR.
On the measured PostgreSQL 16 container (JIT disabled only inside the report
transaction), full broad-range Prisma calls produced:

| Report / workload                     | Samples |    p50 | p95 / max |
| ------------------------------------- | ------: | -----: | --------: |
| Premiums, serial                      |      10 | 3.97 s |    4.09 s |
| Facultative, serial                   |      10 | 3.00 s |    3.12 s |
| Premiums, four concurrent requests    |       6 | 4.47 s |    4.86 s |
| Facultative, four concurrent requests |       6 | 3.46 s |    3.88 s |

All 35 measured PostgreSQL 16 calls succeeded, including narrower payment filters
and reinsurer settlement filtering. The four-connection pool peaked at four
active connections and four backends; no transaction expiration was observed.
On native PostgreSQL 18 the same final SQL/report structure completed broad
serial Premiums/Facultative calls in approximately 2.74/2.20 seconds (p50).
The deliberate pg_sleep timeout regression is separate from these successful
workload measurements and returns a controlled 503 after about 15 seconds.

Small sample p95 values are descriptive, not production service-level guarantees.
Local SSD/cache, pool latency, tenant skew, workload concurrency and remote
session-pooler behavior may differ from DEV. Actual deployed DEV execution must
be smoke-tested following an independently authorized deployment.

## Regressions and release smoke test

The existing PostgreSQL workflow also runs `report-transaction.database.spec.ts`.
Use explicit localhost-only `FINANCIAL_REPORTS_TEST_DATABASE_URL` databases named
`irisk_financial_test_*`, provisioned with existing migrations in disposable
PostgreSQL. Never fall back to application DATABASE*URL. Patch 1's query-only
database suite uses its own `REPORTS_TEST_DATABASE_URL` / `irisk_reports_test*\*`.

After an authorized DEV deployment, without importing or altering any financial
record:

1. Verify deployed commit and health; retain least-privilege, TLS-verified DB access.
2. Use authenticated tenant-scoped Premiums and Facultative requests with
   page=1, limit=50 and the broad 2021-01-01 through 2026-11-23 created-date range.
   Record elapsed time, status, request ID and sanitized stage diagnostics.
3. Repeat enough times to cross prepared-statement reuse thresholds. Test both
   scopes, reinsurer/settlement/payment filters, an empty page and narrow dates.
4. Compare totals, identities, currencies and CSV/XLS rows against approved
   Patch 1–3 evidence. Existing headers and frontend presentation must be unchanged.
5. Start with low concurrency; observe pool wait, active connections, temp I/O,
   statement cancellation and transaction expiry. Do not reset shared statistics.
6. Confirm no 504/P2028 on representative requests. A bounded 503 is a deliberate
   failure, not successful performance. Investigate rather than raising limits
   globally if legitimate workloads repeatedly exceed the budget.

No index or migration was added. The separate NGINX running-binary/log follow-ups
remain administrator work and do not alter this reporting release.
