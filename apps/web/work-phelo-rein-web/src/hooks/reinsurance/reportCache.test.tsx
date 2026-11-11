import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryObserver, MutationObserver, useMutation } from '@tanstack/react-query';
import { invalidateReinsuranceReports } from '@/lib/reinsurance/reportCache';
import { useReportMutation } from './useReportMutation';
let mockClient: QueryClient;
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => mockClient,
  useMutation: jest.fn(),
}));
beforeEach(() => {
  mockClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
});
afterEach(() => mockClient.clear());
it('invalidates all report families while preserving other modules and settings', async () => {
  for (const family of ['premiums', 'cedants', 'reinsurers', 'facultative', 'brokerage', 'claims'])
    mockClient.setQueryData(['reinsurance', 'reports', family], [1]);
  mockClient.setQueryData(['auth', 'profile'], [1]);
  mockClient.setQueryData(['reinsurance', 'currencies'], [1]);
  await invalidateReinsuranceReports(mockClient);
  for (const query of mockClient.getQueryCache().findAll({ queryKey: ['reinsurance', 'reports'] }))
    expect(query.state.isInvalidated).toBe(true);
  expect(mockClient.getQueryState(['auth', 'profile'])?.isInvalidated).toBe(false);
  expect(mockClient.getQueryState(['reinsurance', 'currencies'])?.isInvalidated).toBe(false);
});
it('refetches mounted reports once, leaving unopened reports stale until opened', async () => {
  const active = ['reinsurance', 'reports', 'premiums'];
  const idle = ['reinsurance', 'reports', 'claims'];
  mockClient.setQueryData(active, 1);
  mockClient.setQueryData(idle, 1);
  const fetch = jest.fn(async () => 2);
  const observer = new QueryObserver(mockClient, {
    queryKey: active,
    queryFn: fetch,
    staleTime: Infinity,
  });
  const stop = observer.subscribe(() => undefined);
  await invalidateReinsuranceReports(mockClient);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(mockClient.getQueryData(active)).toBe(2);
  expect(mockClient.getQueryState(idle)?.isInvalidated).toBe(true);
  stop();
});
it.each([true, false])('invalidates only after mutation success (%s)', async (success) => {
  const key = ['reinsurance', 'reports', 'premiums'];
  mockClient.setQueryData(key, 1);
  const callback = jest.fn();
  function Probe() {
    useReportMutation({
      mutationFn: async () => {
        if (!success) throw new Error('Denied');
        return 2;
      },
      onSuccess: callback,
    });
    return null;
  }
  renderToStaticMarkup(<Probe />);
  const options = jest.mocked(useMutation).mock.calls.at(-1)![0];
  const mutation = new MutationObserver(mockClient, options);
  if (success) await mutation.mutate(undefined);
  else await expect(mutation.mutate(undefined)).rejects.toThrow('Denied');
  expect(callback).toHaveBeenCalledTimes(success ? 1 : 0);
  expect(mockClient.getQueryState(key)?.isInvalidated).toBe(success);
});

// Exercise the actual mutation entry points, not only the shared invalidation helper.
import * as payments from './usePayments';
import * as claims from './useClaims';
import * as placements from './useFacultatives';
import { useConfirmReinsurerDisbursementBankPayment } from '../accounting/useReinsuranceBankConfirmations';
import * as reportingMutation from './useReportMutation';
const financialHooks = [
  ['record receipt/disbursement', () => payments.useCreatePlacementPayment()],
  ['confirm premium cash', () => payments.useConfirmPlacementPaymentBank()],
  ['reverse payment', () => payments.useReversePayment()],
  ['cancel payment', () => payments.useCancelPlacementPayment()],
  ['accounting disbursement confirmation', () => useConfirmReinsurerDisbursementBankPayment()],
  ['record recovery', () => claims.useCreateClaimRecoveryReceipt()],
  ['confirm recovery', () => claims.useConfirmClaimRecoveryReceiptBank()],
  ['reverse recovery', () => claims.useReverseClaimRecoveryReceipt()],
  ['record claim settlement', () => claims.useCreateClaimCedantSettlement('p', 'c')],
  ['confirm claim settlement', () => claims.useConfirmClaimCedantSettlementBank('p', 'c')],
  ['reverse claim settlement', () => claims.useReverseClaimCedantSettlement('p', 'c')],
  ['change placement lifecycle', () => placements.useUpdateFacultativeStatus('p')],
  ['force close placement', () => placements.useForceCloseFacultative('p')],
  ['change endorsement closing', () => placements.useUpdateEndorsementClosingStatus('p', 'e')],
  ['force close endorsement', () => placements.useForceCloseEndorsement('p')],
] as const;
it.each(financialHooks)(
  '%s uses the shared success-only report invalidation path',
  (_name, hook) => {
    const spy = jest.spyOn(reportingMutation, 'useReportMutation');
    function Probe() {
      hook();
      return null;
    }
    renderToStaticMarkup(<Probe />);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  },
);
