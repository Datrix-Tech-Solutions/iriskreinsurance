# Historical Statements API — Frontend Handoff

Milestone 2B. This is a read-only archive, separate from operational placements,
participants, notes and payments. No legacy amounts, dates or statuses are repaired
or reconciled by these endpoints. Examples below use **synthetic integration-test
data**, not client statements. All ten requested endpoints are implemented.

## Base URL and authentication

Public gateway base:
`/api/v1/operations/reinsurance/historical-statements`

Local gateway example: `http://localhost:4000/api/v1/operations/reinsurance/historical-statements`.
Direct service base: `http://localhost:4007/api/historical-statements`.
Existing gateway routing already forwards this namespace; no new gateway is needed.
Swagger (when enabled): gateway `/api/v1/operations/reinsurance/docs` and
`/api/v1/operations/reinsurance/docs-json` (direct service `/api/docs`).

Authenticate with the existing `access_token` cookie or `Authorization: Bearer <token>`.
Cookie takes precedence when both are supplied. Never supply tenant/user IDs as
query parameters. JWT authentication provides context; **fresh Auth decisions**
enforce current user/tenant identity, active access, entitlement and permissions.
VIEW is `operations.reinsurance.historical-statements:VIEW`.
Exports require both VIEW and `operations.reinsurance.historical-statements:EXPORT`.
Tenant admins cannot bypass the platform-controlled archive entitlement.
Responses use `Cache-Control: private,no-store` and `Vary: Cookie,Authorization`.

## Endpoints

All paths below are relative to the base. Every data endpoint requires VIEW.

| GET                        | Query                                              | Response                                      |
| -------------------------- | -------------------------------------------------- | --------------------------------------------- |
| `/datasets`                | `page`, `limit`                                    | Published own-tenant datasets, paginated      |
| `/insurers`                | Common filters, pagination, sorting                | Insurer rows and full filtered total          |
| `/reinsurers`              | Common filters, pagination, sorting                | Reinsurer rows and full filtered total        |
| `/insurers/:id`            | `datasetId`                                        | Insurer detail with all 29 original columns   |
| `/reinsurers/:id`          | `datasetId`                                        | Reinsurer detail with all 29 original columns |
| `/insurers/:id/reinsurers` | `datasetId`, `page`, `limit`                       | Approved associated RE rows or UNLINKED       |
| `/reinsurers/:id/insurer`  | `datasetId`                                        | Approved CE row or UNLINKED/null              |
| `/facets`                  | Common filters, optional `kind=INSURER\|REINSURER` | Distinct full-filter values; default INSURER  |
| `/insurers/export.xlsx`    | Common filters and sorting; no pagination          | XLSX attachment; VIEW + EXPORT                |
| `/reinsurers/export.xlsx`  | Common filters and sorting; no pagination          | XLSX attachment; VIEW + EXPORT                |

Existing `/access` returns `{ "authorized": true }` after fresh VIEW authorization.
All other paths above require `datasetId` **except `/datasets`**. Get the ID from
`/datasets`; it is an archive load ID, never a Placement ID. IDs are opaque strings:
row IDs can be 32-character deterministic hashes, not only hyphenated UUIDs.

## Queries and filtering

| Parameter                                  | Rule                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `datasetId`                                | Exact published dataset/load ID; tenant scope comes only from authentication  |
| `page`                                     | Integer, default 1, minimum 1, maximum 1,000,000                              |
| `limit`                                    | Integer, default 50, range 1–200                                              |
| `year`                                     | Source **report year**, integer 2021–2025; not the Offer Date year            |
| `policyNumber`                             | Literal case-insensitive substring                                            |
| `search`                                   | Literal substring of normalized source search text                            |
| `insurer`                                  | CE: source Insurer; RE: source Reinsured (cedant); case-insensitive substring |
| `reinsurer`                                | RE: source Reinsurer; CE: only reinsurer names reached through approved links |
| `insured`, `businessName`                  | Literal case-insensitive substring                                            |
| `currency`, `offerStatus`, `paymentStatus` | Case-insensitive exact source value; no live-status reinterpretation          |
| `offerDateFrom`, `offerDateTo`             | Inclusive source Offer Date, valid `YYYY-MM-DD`                               |
| `closedDateFrom`, `closedDateTo`           | Inclusive source Date Closed, valid `YYYY-MM-DD`                              |
| `sortBy`                                   | `year`, `sourceRow`, or a source JSON field listed below for that kind        |
| `sortOrder`                                | `asc` or `desc`; default `desc`                                               |

Default order: `year DESC`, then source file ID, physical row, row ID ascending.
Null sort values are always last. Financial sorting uses database Decimal values,
not lexical strings. Ordering has deterministic tie-breakers. Date ranges reject
reversed or impossible dates; null dates are excluded when a range is supplied.
Coverage dates remain detail fields and may be sorted, but have no separate range
filters in this release. Source oddities (1970, distant years, reversed coverage)
remain untouched and carry quality warnings.

Only row lists accept page/limit. Associated CE→RE lists accept page/limit but not
the common search filters. Exports accept common filters and sorting **without
page/limit**; strip pagination before building the export URL. Facets accept
common filters and kind, not pagination/sort. All supplied filters constrain all
facet arrays. Request unfiltered dataset facets if the UI needs all choices.
Unknown parameters, including `tenantId`, `userId`, arbitrary paths and invalid
kind-specific sort fields, return 400. `%`/`_` search characters are literal, not
user-controlled SQL wildcard instructions. Maximum text filter length is 512.

## Pagination and dataset contracts

Row lists return `{ dataset, items, meta }`; `/datasets` returns `{ items, meta }`.
`meta.total` covers **all filtered rows**, independently of page/limit.
`totalPages = ceil(total / limit)`, including 0 for an empty result. An out-of-range
page is an empty items array with the unchanged total.

Dataset fields: `id`, `datasetKey`, `datasetVersion`, `status: "PUBLISHED"`,
`contractVersion`, `publishedAt: string|null` (UTC timestamp), `fileCount`,
`insurerRowCount`, `reinsurerRowCount`, `linkCount` (integer dataset-wide counts).
Dataset counts are not filtered-list totals; use `meta.total` for filtered results.
Only PUBLISHED versions are available. If a version is replaced, refresh `/datasets`
after a 404. Each request pins a repeatable-read snapshot so its rows/counts/links
cannot mix versions or tenants during a publication change.

Actual list response captured by the PostgreSQL/HTTP integration test:

```json
{
  "dataset": {
    "id": "b2e5f11e-d479-475a-b49b-e7796f28d650",
    "datasetKey": "b2e5f11e-d479-475a-b49b-e7796f28d650",
    "datasetVersion": "v1",
    "status": "PUBLISHED",
    "contractVersion": "historical-statements/2021-2025/v1",
    "publishedAt": "2026-11-05T00:00:00.000Z",
    "fileCount": 10,
    "insurerRowCount": 10,
    "reinsurerRowCount": 10,
    "linkCount": 2
  },
  "items": [
    {
      "kind": "INSURER",
      "id": "2fce2894cf8cb1a9525b6e0c376714bd",
      "datasetId": "b2e5f11e-d479-475a-b49b-e7796f28d650",
      "year": 2021,
      "sourceFileName": "2021-INSURER.xlsx",
      "sourceSheetName": "Brokerage Statement",
      "sourceRow": 2,
      "rowSha256": "0fd88baf38a9f923ad9eae2d74780bc4d82fced573edb1aed823ac1a655ef133",
      "qualityWarnings": [
        {
          "code": "EPOCH_SENTINEL",
          "columnIndex": 5,
          "sourceValue": "01-01-1970"
        },
        {
          "code": "EXTREME_SOURCE_YEAR",
          "columnIndex": 7,
          "sourceValue": "01-03-2925"
        },
        {
          "code": "EXTREME_SOURCE_YEAR",
          "columnIndex": 8,
          "sourceValue": "01-02-0021"
        },
        {
          "code": "REVERSED_COVERAGE"
        }
      ],
      "policyNumber": "POLICY%_2021",
      "insurerName": "Cedant",
      "insuredName": "=HYPERLINK(\"https://invalid.example\",\"x\")",
      "businessName": "Motor",
      "offerDate": "1970-01-01",
      "closedDate": "2025-02-01",
      "startDate": "2925-03-01",
      "endDate": "0021-02-01",
      "currency": "GHS",
      "sumInsured100": "-123456789012345.123456789012",
      "premium100": "1.000000000000",
      "facShare": "1.000000000000",
      "facSumInsured": "1.000000000000",
      "facPremium": "2.000000000000",
      "paidFacPremium": "1.000000000000",
      "insurerCommissionPercent": "1.000000000000",
      "paidCommission": "1.000000000000",
      "netPremiumDueBroker": "1.000000000000",
      "netPremiumDueBrokerPaid": "1.000000000000",
      "brokerage": "1.000000000000",
      "brokeragePaid": "1.000000000000",
      "wht": "1.000000000000",
      "paidWht": "1.000000000000",
      "nicLevy": "1.000000000000",
      "paidNic": "1.000000000000",
      "netPremiumDueReinsurer": "1.000000000000",
      "netPremiumPaid": "1.000000000000",
      "offerStatus": "OPEN",
      "paymentStatus": "PAID"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 1,
    "total": 2,
    "totalPages": 2
  }
}
```

## Row types and original field mappings

All source text fields are `string | null`. All source financial fields, including
percentages, are **decimal strings or null**, never JSON numbers. Keep them as
strings; do not pass large values through JavaScript Number. Negative and extreme
values remain unchanged. Typed source dates are calendar strings (`YYYY-MM-DD`)
or null; the raw original date text remains in detail `originalColumns`. Rare BCE
values, if present, retain an explicit ` BC` suffix. Report year is independent.

Both list kinds also include:

| Field                               | Type / meaning                                                   |
| ----------------------------------- | ---------------------------------------------------------------- |
| `id`, `datasetId`                   | Opaque string IDs                                                |
| `kind`                              | `INSURER` or `REINSURER`                                         |
| `year`                              | Integer source report year                                       |
| `sourceFileName`, `sourceSheetName` | Original filename and sheet, no storage paths                    |
| `sourceRow`                         | Original physical Excel row number, including header offset      |
| `rowSha256`                         | Original physical-cell content SHA-256                           |
| `qualityWarnings`                   | `{ code: string, columnIndex?: number, sourceValue?: string }[]` |

Detail adds `dataset` and `originalColumns` (exactly 29 elements), each containing:
`columnIndex`, `columnLetter`, `header`, `sourceAddress`, `state` (VALUE/BLANK/MISSING),
`cellType`, `value` (original resolved text), `xmlValue`, `styleIndex`, `formula`,
`formulaAttributes`, `cachedValue`. Nullable original values remain null. Formulas
are provenance text, not executable instructions. Render source values as text.

Warnings include EPOCH_SENTINEL, EXTREME_SOURCE_YEAR, REVERSED_COVERAGE,
INVALID_SOURCE_DATE, SOURCE_CELL_ERROR and SOURCE_FORMULA_NOT_RECALCULATED.
Future warning codes should render generically. They do not authorize client-side
historical corrections.

### Insurer source columns

| Column                     | Original header     | JSON field       | Type                |
| -------------------------- | ------------------- | ---------------- | ------------------- |
| A                          | Policy #            | `policyNumber`   | text/null           |
| B                          | Insurer             | `insurerName`    | text/null           |
| C                          | Insured             | `insuredName`    | text/null           |
| D                          | Business Name       | `businessName`   | text/null           |
| E                          | Offer Date          | `offerDate`      | date string/null    |
| F                          | Date Closed         | `closedDate`     | date string/null    |
| G                          | Start Date          | `startDate`      | date string/null    |
| H                          | End Date            | `endDate`        | date string/null    |
| I                          | Currency            | `currency`       | text/null           |
| J                          | 100% Sum Insured    | `sumInsured100`  | decimal string/null |
| K                          | 100% Premium        | `premium100`     | decimal string/null |
| L                          | Fac. Share          | `facShare`       | decimal string/null |
| M                          | Fac. Sum Insured    | `facSumInsured`  | decimal string/null |
| N                          | Fac. Premium        | `facPremium`     | decimal string/null |
| O                          | Paid fac premium    | `paidFacPremium` | decimal string/null |
| P                          | s Commission (%)",  |
| `insurerCommissionPercent` | decimal string/null |
| Q                          | ,                   |
| `paidCommission`           | decimal string/null |
| R                          | ,                   |
| `netPremiumDueBroker`      | decimal string/null |
| S                          | ,                   |
| `netPremiumDueBrokerPaid`  | decimal string/null |
| T                          | ,                   |
| `brokerage`                | decimal string/null |
| U                          | ,                   |
| `brokeragePaid`            | decimal string/null |
| V                          | ,                   |
| `wht`                      | decimal string/null |
| W                          | ,                   |
| `paidWht`                  | decimal string/null |
| X                          | ,                   |
| `nicLevy`                  | decimal string/null |
| Y                          | ,                   |
| `paidNic`                  | decimal string/null |
| Z                          | ,                   |
| `netPremiumDueReinsurer`   | decimal string/null |
| AA                         | ,                   |
| `netPremiumPaid`           | decimal string/null |
| AB                         | ,                   |
| `offerStatus`              | text/null           |

### Reinsurer source columns

| Column | Original header           | JSON field                | Type                |
| ------ | ------------------------- | ------------------------- | ------------------- |
| A      | Policy #                  | `policyNumber`            | text/null           |
| B      | Reinsurer                 | `reinsurerName`           | text/null           |
| C      | Insured                   | `insuredName`             | text/null           |
| D      | Business Name             | `businessName`            | text/null           |
| E      | Reinsured                 | `reinsuredName`           | text/null           |
| F      | Offer Date                | `offerDate`               | date string/null    |
| G      | Date Closed               | `closedDate`              | date string/null    |
| H      | Start Date                | `startDate`               | date string/null    |
| I      | End Date                  | `endDate`                 | date string/null    |
| J      | Currency                  | `currency`                | text/null           |
| K      | 100% Sum Insured          | `sumInsured100`           | decimal string/null |
| L      | 100% Premium              | `premium100`              | decimal string/null |
| M      | Fac. Share                | `facShare`                | decimal string/null |
| N      | Fac. Sum Insured          | `facSumInsured`           | decimal string/null |
| O      | Fac. Premium              | `facPremium`              | decimal string/null |
| P      | Paid fac premium          | `paidFacPremium`          | decimal string/null |
| Q      | Insurer Commission        | `insurerCommissionAmount` | decimal string/null |
| R      | Paid Commission           | `paidCommission`          | decimal string/null |
| S      | Brokerage                 | `brokerage`               | decimal string/null |
| T      | Brokerage Paid            | `brokeragePaid`           | decimal string/null |
| U      | WHT                       | `wht`                     | decimal string/null |
| V      | Paid WHT                  | `paidWhtFirst`            | decimal string/null |
| W      | Paid WHT                  | `paidWhtSecond`           | decimal string/null |
| X      | NIC Levy                  | `nicLevy`                 | decimal string/null |
| Y      | Paid NIC                  | `paidNic`                 | decimal string/null |
| Z      | Net Premium Due Reinsurer | `netPremiumDueReinsurer`  | decimal string/null |
| AA     | Net Premium Paid          | `netPremiumPaid`          | decimal string/null |
| AB     | Offer Status              | `offerStatus`             | text/null           |
| AC     | Payment Status            | `paymentStatus`           | text/null           |

CE `insurerCommissionPercent` and RE `insurerCommissionAmount` intentionally have
different names/meanings from their original columns. Do not reinterpret them.
The two RE `Paid WHT` headers at V/W map independently to `paidWhtFirst` and
`paidWhtSecond`; neither is dropped or merged.

## Approved links and unlinked states

CE→RE response: `{ state, dataset, insurerId, items, meta }`, with
`items: [{ link: { matchId, basis }, statement: <RE list item> }]`.
RE→CE response: `{ state, dataset, reinsurerId, item }`, where item is
`{ link: { matchId, basis }, statement: <CE list item> }` or null.
`basis` is SUPPLIED_AUTHORITATIVE or APPROVED_CANDIDATE. Only stored approved
archive links are used. Names, policy numbers, amounts and row ordering never
create an association. Linked statements stay inside the same tenant/dataset.

When no link exists, state is `UNLINKED`, CE items is `[]` with total/totalPages 0,
and RE item is null. A valid link set yields `LINKED`; this does **not** claim that
all possible historical participant evidence has been supplied. On an out-of-range
CE→RE page, state can remain LINKED with empty items and positive total.
A missing/foreign source row is 404, not UNLINKED. Unlinked rows remain independently
searchable in both statement lists.

## Facets

Response: `{ dataset, kind, years, insurers, reinsurers, insureds, businessNames,
currencies, offerStatuses, paymentStatuses }`. Values are distinct, sorted arrays
across the full filtered result, with nulls excluded. Empty results return empty
arrays. CE reinsurer facets only include approved associated names; an all-unlinked
dataset can correctly have no CE reinsurer choices.

## XLSX exports

The response is genuine zipped XLSX (not CSV or HTML), MIME
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, with attachment
filename `historical-insurer-statements.xlsx` or
`historical-reinsurer-statements.xlsx`. It includes all filtered rows and the same
sort order, independent of the displayed table page. Worksheet: Brokerage Statement.
Original 29 ordered headers and resolved source values are retained. Both RE WHT
columns remain. Dates and monetary lexemes are explicitly **text cells**, preserving
raw date text, large values and decimal precision. Text beginning `=`, `+`, `-` or
`@` is never emitted as a formula or hyperlink object. This is a value export, not
a forensic copy of original styles/formulas/blank-cell XML; use originalColumns for
that provenance. No operational settlement calculations occur.

The server queries PostgreSQL in batches of 250 and streams worksheet rows to an
owner-only temporary file, then streams it to the response and removes it on close.
It does not read original workbooks. Export uses the same filters and published
snapshot as lists. No asynchronous export job or extra infrastructure is required.
Empty exports contain the original 29 headers. Incompatible/corrupt source headers
fail explicitly; no invented hybrid workbook is returned.

## cURL examples

```sh
BASE='http://localhost:4000/api/v1/operations/reinsurance/historical-statements'
TOKEN='<access-token>'
DATASET='<id-from-datasets>'
INSURER_ROW='<archive-insurer-row-id>'
REINSURER_ROW='<archive-reinsurer-row-id>'

curl --fail-with-body -H "Authorization: Bearer $TOKEN" "$BASE/datasets"
curl --fail-with-body --get -H "Authorization: Bearer $TOKEN" "$BASE/insurers" \
  --data-urlencode "datasetId=$DATASET" --data-urlencode 'year=2025' \
  --data-urlencode 'currency=GHS' --data-urlencode 'page=1' --data-urlencode 'limit=50'
curl --fail-with-body --get -H "Authorization: Bearer $TOKEN" "$BASE/reinsurers" \
  --data-urlencode "datasetId=$DATASET" --data-urlencode 'reinsurer=Example Re' \
  --data-urlencode 'closedDateFrom=2025-01-01' --data-urlencode 'closedDateTo=2025-12-31'
curl --fail-with-body -H "Authorization: Bearer $TOKEN" \
  "$BASE/insurers/$INSURER_ROW?datasetId=$DATASET"
curl --fail-with-body -H "Authorization: Bearer $TOKEN" \
  "$BASE/reinsurers/$REINSURER_ROW?datasetId=$DATASET"
curl --fail-with-body -H "Authorization: Bearer $TOKEN" \
  "$BASE/insurers/$INSURER_ROW/reinsurers?datasetId=$DATASET&page=1&limit=50"
curl --fail-with-body -H "Authorization: Bearer $TOKEN" \
  "$BASE/reinsurers/$REINSURER_ROW/insurer?datasetId=$DATASET"
curl --fail-with-body -H "Authorization: Bearer $TOKEN" \
  "$BASE/facets?datasetId=$DATASET&kind=REINSURER&year=2025"
curl --fail-with-body --get -H "Authorization: Bearer $TOKEN" \
  "$BASE/insurers/export.xlsx" --data-urlencode "datasetId=$DATASET" \
  --data-urlencode 'year=2025' -o historical-insurers.xlsx
curl --fail-with-body --get -H "Authorization: Bearer $TOKEN" \
  "$BASE/reinsurers/export.xlsx" --data-urlencode "datasetId=$DATASET" \
  --data-urlencode 'year=2025' -o historical-reinsurers.xlsx
```

## Errors and empty states

Errors use the existing Nest shape `{ statusCode, message, error }`.
Validation message may be an array; other messages are strings. Handle:

- 400: missing datasetId, unknown query fields, invalid dates/range/page/sort.
- 401: invalid session or tenant/user identity mismatch.
- 403: archive not enabled or fresh VIEW/EXPORT denied. Do not offer self-enablement.
- 404: no published dataset/row in this tenant (including stale, unpublished,
  superseded, rolled-back, wrong-dataset and foreign-tenant IDs).
- 409: invalid archive source-cell/header contract; contact support.
- 503: fresh Auth decision unavailable; do not display cached protected data.
- 500: unexpected database/export failure or link integrity error.

No published datasets: `/datasets` returns items `[]`, total/totalPages 0.
No matching rows: successful list with empty items and filtered total 0.
Neither state grants permission to inspect staging data or infer relationships.
No endpoint in this handoff is incomplete. Deployment, M1 migration approval,
platform entitlement, role provisioning and separately approved archive publication
are operational prerequisites; this milestone did not perform them.

## Dependency review / limits

Exports use pinned ExcelJS 4.4.0, CommonJS-compatible with the service's Node 20+
container, following its streaming writer API:
https://github.com/exceljs/exceljs#streaming-xlsx-writer

Its current dependency chain includes the UUID buffer-bounds advisory
https://github.com/advisories/GHSA-w5hq-g745-h8pq (v3/v5/v6 with caller-supplied
buffers). This exporter calls none of those APIs, creates no caller-controlled UUID
buffers, does not parse uploaded workbooks with ExcelJS, and adds no conditional
formatting. Existing unrelated monorepo advisories were not broadly upgraded.
Synchronous export uses a 60-second request-local read transaction and private temp
disk; unusually slow storage or much larger future datasets may require a separately
reviewed export limit/job design. No global Prisma transaction settings changed.
