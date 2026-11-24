import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  QueryClient,
  QueryObserver,
  type QueryObserverOptions,
  type QueryObserverResult,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { shouldRetryQuery } from '@/lib/queryRetry';
import { FacultativeReportTable } from '@/components/organisms/reinsurance/tables/FacultativeReportTable';
import type { FacultativeReportParams, FacultativeReportRow } from './useFacultativeReport';
import { facultativeReportKey } from './useFacultativeReport';
import { usePlacementEndorsements } from './useFacultatives';

const mockQueryHook = jest.fn<QueryObserverResult, [QueryObserverOptions]>();
const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockParams: FacultativeReportParams;
let mockTableProps: Parameters<
  typeof import('@/components/organisms/shared/DataTable').DataTable
>[0];
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: (options: QueryObserverOptions) => mockQueryHook(options),
}));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('next/navigation', () => ({ useParams: () => ({ tenantSlug: 'synthetic' }) }));
jest.mock('@/hooks/useLoadingRouter', () => ({ useLoadingRouter: () => ({ push: mockPush }) }));
jest.mock('./useAppliedReportParams', () => ({
  useAppliedReportParams: () => [mockParams, mockSetParams],
}));
jest.mock('@/hooks', () => ({
  ...jest.requireActual('./useFacultativeReport'),
  ...jest.requireActual('./useFacultatives'),
  ...jest.requireActual('../useDropdownPosition'),
  useCedantOptions: () => ({ options: [] }),
  useReinsurerOptions: () => ({ options: [] }),
  useRiskClassOptions: () => ({ data: [] }),
  useCurrencyOptions: () => ({ data: [] }),
  useCurrencies: () => ({ data: [] }),
}));
jest.mock('@/components/organisms/shared/DataTable', () => {
  const actual = jest.requireActual<typeof import('@/components/organisms/shared/DataTable')>(
    '@/components/organisms/shared/DataTable',
  );
  return {
    ...actual,
    DataTable: (props: Parameters<typeof actual.DataTable>[0]) => {
      mockTableProps = props;
      return React.createElement(actual.DataTable, props);
    },
  };
});

let client: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 300_000, retry: shouldRetryQuery, retryDelay: 0, gcTime: Infinity },
    },
  });
  mockQueryHook.mockImplementation((options) => {
    const defaults = client.defaultQueryOptions(options);
    return new QueryObserver(client, defaults).getOptimisticResult(defaults);
  });
  jest.mocked(api.get).mockResolvedValue({ data: { items: [] } });
  mockParams = {
    page: 1,
    limit: 50,
    scope: 'cedant',
    startDate: '2021-01-01',
    endDate: '2026-11-23',
  };
});
afterEach(() => client.clear());

function row(i: number): FacultativeReportRow {
  const line = {
    reinsurerId: 'r1',
    reinsurerName: 'Synthetic reinsurer',
    sharePercent: 50,
    closedAt: null,
    facSumInsured: 100,
    facPremium: 10,
    paidFacPremium: 0,
    brokerage: 1,
    brokeragePaid: 0,
    withholdingTax: 0,
    withholdingTaxPaid: 0,
    nicLevy: 0,
    nicLevyPaid: 0,
    netPremiumDueReinsurer: 8,
    netPremiumPaid: 0,
  };
  return {
    id: `p${i}`,
    reference: `FAC-${i}`,
    policyNumber: `POL-${i}`,
    title: 'Synthetic insured',
    cedantId: 'c1',
    cedantName: 'Synthetic cedant',
    classOfBusiness: null,
    riskClassId: null,
    riskClassName: null,
    offerDate: null,
    closedAt: null,
    sumInsured: 100,
    premium: 10,
    currency: 'GHS',
    commission: 10,
    facultativeOfferPercent: 50,
    totalOfferedPercent: 50,
    totalAcceptedPercent: 50,
    reinsurerCount: 2,
    status: 'CLOSED',
    inceptionDate: null,
    expiryDate: null,
    paymentStatus: 'Outstanding',
    cedantFinancials: {
      facSumInsured: 100,
      facPremium: 10,
      paidFacPremium: 0,
      cedantCommissionPercent: 10,
      cedantCommissionAmount: 1,
      netPremiumDueIrisk: 9,
      netPremiumDueIriskPaid: 0,
      brokerage: 1,
      brokeragePaid: 0,
      netPremiumDueReinsurer: 8,
      netPremiumDueReinsurerPaid: 0,
    },
    reinsurers: [
      { ...line, closingId: `closing-${i}-a` },
      { ...line, closingId: `closing-${i}-b` },
    ],
  };
}
function renderReport() {
  client.setQueryData(facultativeReportKey(mockParams), {
    items: Array.from({ length: 50 }, (_, i) => row(i + (mockParams.page === 2 ? 50 : 0))),
    meta: { page: mockParams.page, limit: 50, total: 100, totalPages: 2 },
    summary: {
      totalOffers: 100,
      openOffers: 0,
      acceptanceRate: 100,
      cedantCount: 1,
      reinsurerCount: 1,
      activeCount: 0,
      expiredCount: 0,
      statusCounts: [],
      paymentStatusCounts: [],
      totalsByCurrency: [],
    },
  });
  return renderToStaticMarkup(<FacultativeReportTable />);
}
function endorsementOptions() {
  return mockQueryHook.mock.calls
    .map(([options]) => options)
    .filter((o) => o.queryKey.at(-1) === 'endorsements');
}
function detailOptions(id: string) {
  mockQueryHook.mockClear();
  function Probe() {
    usePlacementEndorsements(id);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return endorsementOptions()[0];
}

it.each(['cedant', 'reinsurer'] as const)(
  'has zero eager endorsement requests for 50 placements in %s scope',
  async (scope) => {
    mockParams.scope = scope;
    const html = renderReport();
    expect(html).toContain('POL-0');
    const options = endorsementOptions();
    expect(options).toHaveLength(scope === 'cedant' ? 50 : 100);
    expect(new Set(options.map((o) => JSON.stringify(o.queryKey))).size).toBe(50);
    expect(options.every((o) => o.enabled === false)).toBe(true);
    const observers = options.map((o) => new QueryObserver(client, o));
    const stops = observers.map((o) => o.subscribe(() => undefined));
    await Promise.resolve();
    expect(api.get).not.toHaveBeenCalled();
    stops.forEach((stop) => stop());
    // Both scopes navigate with the canonical placement ID, never the expanded row key.
    mockTableProps.onRowClick?.(mockTableProps.data[0]);
    expect(mockPush).toHaveBeenCalledWith('/synthetic/operations/reinsurance/facultative/p0');
  },
);

it('keeps pagination and applied date/payment filters free of per-row requests', async () => {
  for (const page of [1, 2]) {
    mockQueryHook.mockClear();
    mockParams = {
      ...mockParams,
      page,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      paymentStatuses: ['Paid'],
    };
    renderReport();
    expect(endorsementOptions().every((o) => o.enabled === false)).toBe(true);
    const report = mockQueryHook.mock.calls
      .map(([o]) => o)
      .find((o) => o.queryKey.includes('reports'));
    expect(report?.queryKey).toEqual(facultativeReportKey(mockParams));
    if (!report) throw new Error('Missing report query');
    jest.mocked(api.get).mockResolvedValueOnce({ data: client.getQueryData(report.queryKey) });
    await new QueryObserver(client, { ...report, enabled: false }).refetch();
    expect(api.get).toHaveBeenLastCalledWith(
      '/operations/reinsurance/reports/facultative',
      expect.objectContaining({
        params: expect.objectContaining({
          page,
          limit: 50,
          dateFrom: '2025-01-01',
          dateTo: '2025-12-31',
          paymentStatus: 'Paid',
        }),
      }),
    );
  }
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(
    jest
      .mocked(api.get)
      .mock.calls.every(([path]) => path === '/operations/reinsurance/reports/facultative'),
  ).toBe(true);
});

it('shares one inspected request across repeated rows and detail navigation, then invalidates normally', async () => {
  mockParams.scope = 'reinsurer';
  renderReport();
  const repeated = endorsementOptions().filter((o) => o.queryKey.includes('p0'));
  const observers = repeated.map((o) => new QueryObserver(client, o));
  const stops = observers.map((o) => o.subscribe(() => undefined));
  observers[0].setOptions({ ...repeated[0], enabled: true });
  await observers[0].refetch({ cancelRefetch: false });
  observers[1].setOptions({ ...repeated[1], enabled: true });
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/operations/reinsurance/placements/p0/endorsements');
  const detail = new QueryObserver(client, detailOptions('p0'));
  const stopDetail = detail.subscribe(() => undefined);
  expect(api.get).toHaveBeenCalledTimes(1);
  await client.invalidateQueries({ queryKey: repeated[0].queryKey });
  expect(api.get).toHaveBeenCalledTimes(2);
  stops.forEach((stop) => stop());
  stopDetail();
});

it.each([403, 500])(
  'preserves existing retry policy and failure for HTTP %s in the lazy lookup',
  async (status) => {
    renderReport();
    const options = endorsementOptions()[0];
    jest.mocked(api.get).mockRejectedValue({ response: { status } });
    const observer = new QueryObserver(client, { ...options, enabled: false });
    const stop = observer.subscribe(() => undefined);
    await observer.refetch();
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(observer.getCurrentResult().data).toBeUndefined();
    expect(api.get).toHaveBeenCalledTimes(status === 403 ? 1 : 2);
    stop();
  },
);

it('keeps an uncached placement detail lookup eager', async () => {
  const options = detailOptions('uncached');
  expect(options.enabled).toBe(true);
  const observer = new QueryObserver(client, options);
  const stop = observer.subscribe(() => undefined);
  await observer.refetch({ cancelRefetch: false });
  expect(api.get).toHaveBeenCalledTimes(1);
  stop();
});
