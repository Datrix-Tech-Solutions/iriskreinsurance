import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useQuery } from '@tanstack/react-query';
import { useBrokerageReport } from './useBrokerageReport';
import { useCedantsReport } from './useCedantsReport';
import { useClaimsReport } from './useClaimsReport';
import { useFacultativeReport } from './useFacultativeReport';
import { usePremiumsReport } from './usePremiumsReport';
import { useReinsurersReport } from './useReinsurersReport';
import { ReportQueryError } from '@/components/molecules/reinsurance/reports/ReportQueryError';
import { DataTable } from '@/components/organisms/shared/DataTable';
import { BrokerageReportTable } from '@/components/organisms/reinsurance/tables/BrokerageReportTable';
import { CedantsReportTable } from '@/components/organisms/reinsurance/tables/CedantsReportTable';
import { ClaimsReportTable } from '@/components/organisms/reinsurance/tables/ClaimsReportTable';
import { FacultativeReportTable } from '@/components/organisms/reinsurance/tables/FacultativeReportTable';
import { PremiumsReportTable } from '@/components/organisms/reinsurance/tables/PremiumsReportTable';
import { ReinsurersReportTable } from '@/components/organisms/reinsurance/tables/ReinsurersReportTable';

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('next/navigation', () => ({ useParams: () => ({ tenantSlug: 'test' }) }));
jest.mock('@/hooks/useLoadingRouter', () => ({ useLoadingRouter: () => ({ push: jest.fn() }) }));
// Keep unrelated option queries out of this report regression suite. Re-export
// real report hooks so the tables must consume their actual error contracts.
jest.mock('@/hooks', () => ({
  ...jest.requireActual('./useBrokerageReport'),
  ...jest.requireActual('./useCedantsReport'),
  ...jest.requireActual('./useClaimsReport'),
  ...jest.requireActual('./useFacultativeReport'),
  ...jest.requireActual('./usePremiumsReport'),
  ...jest.requireActual('./useReinsurersReport'),
  ...jest.requireActual('../useDropdownPosition'),
  useCedantOptions: () => ({ options: [] }),
  useReinsurerOptions: () => ({ options: [] }),
  useCurrencyOptions: () => ({ data: [] }),
  useCurrencies: () => ({ data: [] }),
  useRiskTypeOptions: () => ({ data: [] }),
  useRiskClassOptions: () => ({ data: [] }),
}));

const reports = [
  ['brokerage', useBrokerageReport],
  ['cedants', useCedantsReport],
  ['claims', useClaimsReport],
  ['facultative', useFacultativeReport],
  ['premiums', usePremiumsReport],
  ['reinsurers', useReinsurersReport],
] as const;

const refetch = jest.fn();
function queryState(overrides: Record<string, unknown> = {}) {
  jest.mocked(useQuery).mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: overrides.isLoading ?? false,
    isError: false,
    error: null,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useQuery>);
}

describe.each(reports)('%s report error contract', (_name, useReport) => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryState();
  });

  // Render the actual hook with React so these tests remain valid if it gains
  // useMemo/useState. Only the query transport is mocked.
  function readReport() {
    const capture = jest.fn<void, [ReturnType<typeof useReport>]>();
    function Probe() {
      capture(useReport({}));
      return null;
    }
    renderToStaticMarkup(<Probe />);
    return capture.mock.calls[0][0];
  }

  function renderBody() {
    function Report() {
      const result = useReport({});
      return (
        <DataTable
          columns={[]}
          data={[]}
          isLoading={result.isLoading}
          errorContent={
            result.isError ? (
              <ReportQueryError error={result.error} onRetry={() => void result.refetch()} />
            ) : undefined
          }
          emptyMessage="No activity for the selected filters"
          currentPage={1}
          totalPages={0}
          onPageChange={() => {}}
        />
      );
    }
    return renderToStaticMarkup(<Report />);
  }

  it.each([403, 500])('exposes HTTP %s errors and renders failure instead of empty', (status) => {
    const error = Object.assign(new Error('Internal details must not appear'), {
      isAxiosError: true,
      response: { status },
    });
    queryState({ isError: true, error });
    const result = readReport();
    expect(result.isError).toBe(true);
    expect(result.error).toBe(error);
    expect(result.refetch).toBe(refetch);
    const html = renderBody();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Unable to load report');
    expect(html).toContain('Try again');
    expect(html).not.toContain('No activity');
    expect(html).not.toContain('Internal details');
    expect(html).toContain(status === 403 ? 'do not have permission' : 'could not be loaded');
  });

  it('keeps a genuine successful empty response distinct from failure', () => {
    const summary = readReport().summary;
    const data = { items: [], summary, meta: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    queryState({ data });
    const result = readReport();
    expect(result.rows).toEqual([]);
    expect(result.summary).toEqual(summary);
    expect(result.meta).toBe(data.meta);
    expect(result.isError).toBe(false);
    expect(result.error).toBeNull();
    expect(renderBody()).toContain('No activity for the selected filters');
    expect(renderBody()).not.toContain('role="alert"');
  });

  it('preserves loading state', () => {
    queryState({ isLoading: true });
    expect(readReport().isLoading).toBe(true);
    expect(renderBody()).toContain('Loading...');
    expect(renderBody()).not.toContain('No activity');
  });

  it('keeps loaded rows and summaries visible during a background refresh', () => {
    const summary = readReport().summary;
    const data = {
      items: [{ id: 'cached' }],
      summary,
      meta: { page: 2, limit: 50, total: 51, totalPages: 2 },
    };
    queryState({ data, isLoading: false, isFetching: true });
    const result = readReport();
    expect(result.isLoading).toBe(false);
    expect(result.rows).toBe(data.items);
    expect(result.summary).toEqual(summary);
    expect(result.meta).toBe(data.meta);
    expect(result.refetch).toBe(refetch);
  });

  it('exposes a failed refetch even when cached data remains', () => {
    const summary = readReport().summary;
    const data = {
      items: [{ id: 'cached' }],
      summary,
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    };
    queryState({ data, isError: true, error: new Error('Failed refetch') });
    expect(readReport().rows).toBe(data.items);
    expect(renderBody()).toContain('Unable to load report');
  });
});

it('wires the retry button to the supplied retry handler', () => {
  const onRetry = jest.fn();
  const element = ReportQueryError({ error: new Error('Failed'), onRetry });
  const button = element.props.children.find(
    (child: React.ReactElement<{ onClick?: () => void }>) => child.type === 'button',
  );
  button.props.onClick();
  expect(onRetry).toHaveBeenCalledTimes(1);
});

const tables = [
  ['brokerage', BrokerageReportTable, useBrokerageReport],
  ['cedant', CedantsReportTable, useCedantsReport],
  ['claims', ClaimsReportTable, useClaimsReport],
  ['facultative', FacultativeReportTable, useFacultativeReport],
  ['premium', PremiumsReportTable, usePremiumsReport],
  ['reinsurer', ReinsurersReportTable, useReinsurersReport],
] as const;

describe.each(tables)('%s report table', (name, Table, useReport) => {
  beforeEach(() => {
    queryState();
    // SSR has no clicks. Seed the nullable reportParams state to represent a
    // submitted filter, leaving other initial state and all render logic real.
    const useState = React.useState;
    jest
      .spyOn(React, 'useState')
      .mockImplementation(((initial: unknown) =>
        useState(
          initial === null ? { startDate: '2026-01-01', endDate: '2026-12-31' } : initial,
        )) as typeof React.useState);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([403, 500])('shows HTTP %s failure and keeps filters available', (status) => {
    queryState({ isError: true, error: { isAxiosError: true, response: { status } } });
    const html = renderToStaticMarkup(<Table />);
    expect(html).toContain('Unable to load report');
    expect(html).toContain('Try again');
    expect(html).toContain('Run Filter');
    expect(html).not.toContain('No data for the selected filters');
    expect(html).not.toContain(`No ${name} activity`);
    expect(html).not.toContain('Total Placements');
    expect(html).not.toContain('Total Offers');
    expect(html).not.toContain('Open Claims');
  });

  it('keeps the normal empty response and summary cards', () => {
    const capture = jest.fn<void, [ReturnType<typeof useReport>['summary']]>();
    function Probe() {
      capture(useReport({}).summary);
      return null;
    }
    renderToStaticMarkup(<Probe />);
    const summary = capture.mock.calls[0][0];
    queryState({
      data: { items: [], summary, meta: { page: 1, limit: 50, total: 0, totalPages: 0 } },
    });
    const html = renderToStaticMarkup(<Table />);
    expect(html).toContain(`No ${name} activity for the selected filters`);
    expect(html).toContain('No data for the selected filters');
    expect(html).not.toContain('Unable to load report');
  });

  it('keeps the loading UI', () => {
    queryState({ isLoading: true });
    const html = renderToStaticMarkup(<Table />);
    expect(html).toContain('Loading...');
    expect(html).not.toContain(`No ${name} activity`);
    expect(html).not.toContain('Unable to load report');
  });
});
