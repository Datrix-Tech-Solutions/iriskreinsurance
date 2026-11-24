# Facultative report endorsement request audit

Base: `423a7334` (merged Patch 4), 24 November 2026.

## Request initiator

`src/app/[tenantSlug]/operations/reinsurance/reports/facultative/page.tsx`
renders `FacultativeReportTable`. Its shared policy-number column renders
`EndorsedReferencePill` once per display row, passing the canonical placement UUID
but no endorsement count.

Previously, `EndorsedReferencePill` immediately enabled
`usePlacementEndorsements(id)` whenever the optional count was absent. The hook
requests `/operations/reinsurance/placements/:id/endorsements` through the normal
API client and gateway prefix. Fetching occurred when query observers mounted,
not on hover, expansion or navigation. CSS hover revealed text already fetched.

The query key is `['reinsurance', 'placements', id, 'endorsements']`. The existing
QueryProvider has a stable QueryClient and five-minute staleTime. Repeated
reinsurer display rows share their placement key and in-flight/cached results.
No new effect, unstable-key loop or missing cache was found. An ordinary cold
page can still create one request per distinct placement. Strict Mode did not
double requests in the browser reproduction. Stale remounts, focus, invalidation
and the existing bounded retry policy can cause later requests; these should not
be confused with distinct initial placement lookups.

## Correctness and permitted deferral

The endorsement lookup supplies only the pill's green badge and supplementary
non-VOID endorsement count. It does not supply financial report values, row
actions or authorization decisions. The report API already chooses applicable
confirmed original/endorsement closing snapshots using lifecycle/effective-date
rules. The report response does **not** contain the count of all non-VOID
endorsements: drafts also count in the pill. Neither participant count nor
effective closing identity can safely substitute for this metadata.

The existing list endpoint requires placement VIEW, applies JWT/module/feature
guards and resolves the placement and endorsement rows using the authenticated
tenant ID. None of those routes, guards, queries or permissions changed.

## Focused correction

`EndorsedReferencePill` adds an opt-in `deferFetchUntilInteraction` prop. Only the
Facultative report opts in. Existing eager users and explicit supplied-count
users retain their behavior; an explicit zero suppresses fetching, as before.

- Initial report rows keep endorsement observers disabled.
- Pointer inspection (including touch) or keyboard focus enables the existing
  placement-keyed query. Financial rows do not wait for it.
- The interaction state is bound to the placement ID, so recycled row components
  do not eagerly request a new ID or display a late previous-ID response.
- Repeated interaction, duplicate display rows and detail navigation reuse the
  existing cache. There is no new cache duration, endpoint or batch contract.
- Existing endorsement mutation invalidation continues to refresh active queries;
  unopened report cells remain disabled. Existing authorization/retry behavior stays.
- Unknown/loading/unavailable metadata is not assigned a fabricated zero. Empty
  successful results provide a genuine zero. Lookup failures preserve the policy
  and financial row and provide a sanitized inspection tooltip.
- Keyboard focus reveals the same count as hover. Headers, table columns, financial
  values, filters, pagination, routes, exports and row-click actions are unchanged.

The intentional presentation difference is timing: an uncached endorsement badge
is populated on inspection rather than eagerly for every page row. Cached known
counts can display immediately. This optional badge is not an endorsement-history
or financial-completeness assertion. Placement detail and endorsement operations
still load their required data through the existing eager hooks.

## Request-count evidence

An isolated headless Chrome fixture mounted the actual pill and actual endorsement
hook with React Query and its real retry/freshness policy. Only the HTTP transport
and endpoint responses were synthetic, served on loopback; no DEV or database was
accessed. These counts refer specifically to endorsement-list requests, not all
application/bootstrap/option/report requests in a full authenticated session.

| Cold page population                                | Before | After |
| --------------------------------------------------- | -----: | ----: |
| 50 distinct placements / 50 policy cells            |     50 |     0 |
| 50 distinct placements / 150 reinsurer policy cells |     50 |     0 |
| Either population with React Strict Mode            |     50 |     0 |

Additional browser checks verified one first-inspection call, no extra call on
repeat/duplicate-row inspection, focus/touch access, cached detail handoff, an eager
uncached detail lookup, known zero/count suppression, a late response after row-ID
replacement, and nonblocking 403/500 responses. The existing retry policy makes
one attempt for 403 and two for 500. Empty responses were retained and tested;
their emptiness was not the reason for deferral.

The reported approximately 60 total DEV requests cannot be partitioned exactly
without the original HAR/initiator trace. The reproduced 50 unique endorsement
lookups explain the placement-dependent fan-out; fixed report/options/auth traffic
and any retries are additional. No claim of a newly captured authenticated DEV
HAR or full application browser smoke test is made.

## Automated coverage and release verification

- `EndorsedReferencePill.test.tsx`: opt-in gating, pointer/focus event wiring,
  placement-ID-bound state, explicit counts, eager compatibility, non-VOID count,
  and optional lookup loading/error behavior.
- `facultativeReport.endorsements.test.tsx`: actual table/pill/hook wiring for
  50-row pagination and both scopes; applied date/payment keys; canonical detail
  navigation; real QueryObserver request counts, cache sharing, invalidation,
  authorization/server error retries and uncached detail behavior.
- Existing report tests retain failed/empty/loading/refetch distinctions and
  filter/export contracts. No backend financial or SQL changes are included.

After an independently authorized DEV deployment, compare cold-cache endorsement
request counts in DevTools before moving the pointer over policy cells. Inspect
one cell, revisit it, paginate, apply date/payment filters and switch scopes. Open
the corresponding placement/endorsement detail and confirm canonical navigation
and current records. Do not expect zero total network requests: report and option
queries remain necessary. No merge or deployment is automatic.
