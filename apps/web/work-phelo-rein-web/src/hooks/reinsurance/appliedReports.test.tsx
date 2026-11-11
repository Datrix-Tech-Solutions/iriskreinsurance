import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useQueryClient, QueryClient, QueryObserver } from '@tanstack/react-query';
import { useAppliedReportParams, sameAppliedReport } from './useAppliedReportParams';
import {
  premiumsReportKey,
  downloadPremiumsReportCsv,
  downloadPremiumsReportExcel,
} from './usePremiumsReport';
import { api } from '@/lib/api';
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: jest.fn(),
}));
type Params = { scope: 'cedant' | 'reinsurer'; page: number; reinsurerIds?: string[] };
const invalidate = jest.fn().mockResolvedValue(undefined);
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useQueryClient)
    .mockReturnValue({ invalidateQueries: invalidate } as unknown as QueryClient);
});
it('applies scope/page atomically and refreshes identical normalized filters', () => {
  const setter = jest.fn();
  jest.spyOn(React, 'useState').mockImplementation((() => [null, setter]) as typeof React.useState);
  const capture = jest.fn<void, [React.Dispatch<React.SetStateAction<Params | null>>]>();
  function Probe() {
    const [, apply] = useAppliedReportParams<Params>(premiumsReportKey);
    capture(apply);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  const apply = capture.mock.calls[0][0];
  apply({ scope: 'cedant', page: 2 });
  const draft: Params = { scope: 'reinsurer', page: 1, reinsurerIds: ['r2'] };
  expect(setter).toHaveBeenCalledTimes(1);
  apply(draft);
  expect(setter).toHaveBeenLastCalledWith(draft);
  expect(invalidate).toHaveBeenCalledTimes(2);
  apply({ ...draft });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: premiumsReportKey(draft), exact: true });
  apply((prev) => (prev ? { ...prev, page: 2 } : null));
  expect(setter).toHaveBeenLastCalledWith({ ...draft, page: 2 });
  jest.restoreAllMocks();
});
it('keys every applied scope and settlement selection', () => {
  expect(sameAppliedReport({}, { page: 1, limit: 50, scope: 'cedant' }, premiumsReportKey)).toBe(
    true,
  );
  expect(
    premiumsReportKey({ scope: 'reinsurer', reinsurerIds: ['r1'], settlementStatuses: ['paid'] }),
  ).not.toEqual(
    premiumsReportKey({ scope: 'reinsurer', reinsurerIds: ['r1'], settlementStatuses: ['part'] }),
  );
});
it('exports both formats with identical applied parameters independently of page', async () => {
  jest.mocked(api.get).mockResolvedValue({ data: 'blob' });
  const params = {
    scope: 'reinsurer' as const,
    reinsurerIds: ['r2'],
    settlementStatuses: ['part' as const],
    page: 3,
    limit: 10,
  };
  await downloadPremiumsReportCsv(params);
  await downloadPremiumsReportExcel(params);
  const calls = jest.mocked(api.get).mock.calls;
  expect(calls[0][1]?.params).toEqual(calls[1][1]?.params);
  expect(calls[0][1]?.params).toMatchObject({
    scope: 'reinsurer',
    reinsurerId: 'r2',
    settlementStatus: 'part',
    page: 1,
  });
  expect(calls[0][0]).toMatch(/export\.csv$/);
  expect(calls[1][0]).toMatch(/export\.xls$/);
});
it('never replaces the applied scope with a delayed previous response', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let complete!: (value: string) => void;
  const oldKey = premiumsReportKey({ scope: 'cedant', page: 2 });
  const newKey = premiumsReportKey({ scope: 'reinsurer', page: 1 });
  const old = client.fetchQuery({
    queryKey: oldKey,
    queryFn: () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  });
  const observer = new QueryObserver(client, { queryKey: newKey, queryFn: async () => 'new' });
  const stop = observer.subscribe(() => undefined);
  await observer.refetch();
  complete('old');
  await old;
  expect(observer.getCurrentResult().data).toBe('new');
  expect(client.getQueryData(oldKey)).toBe('old');
  stop();
  client.clear();
});

it('uses one cache identity for reordered or repeated filter selections', () => {
  expect(premiumsReportKey({ scope: 'reinsurer', reinsurerIds: ['b', 'a', 'a'] })).toEqual(
    premiumsReportKey({ scope: 'reinsurer', reinsurerIds: ['a', 'b'] }),
  );
});

it('Run Filter invalidates a previously cached page while pagination can reuse valid cached data', async () => {
  const client = new QueryClient();
  const first = { scope: 'cedant' as const, page: 1 };
  const second = { scope: 'cedant' as const, page: 2 };
  client.setQueryData(premiumsReportKey(first), ['old first page']);
  client.setQueryData(premiumsReportKey(second), ['valid second page']);
  jest.mocked(useQueryClient).mockReturnValue(client);
  jest
    .spyOn(React, 'useState')
    .mockImplementation((() => [null, jest.fn()]) as typeof React.useState);
  const capture = jest.fn<void, [React.Dispatch<React.SetStateAction<Params | null>>]>();
  function Probe() {
    const [, apply] = useAppliedReportParams<Params>(premiumsReportKey);
    capture(apply);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  const apply = capture.mock.calls[0][0];
  apply((previous) => ({ ...previous, ...second }));
  expect(client.getQueryState(premiumsReportKey(second))?.isInvalidated).toBe(false);
  apply(first);
  expect(client.getQueryState(premiumsReportKey(first))?.isInvalidated).toBe(true);
  jest.restoreAllMocks();
  client.clear();
});
