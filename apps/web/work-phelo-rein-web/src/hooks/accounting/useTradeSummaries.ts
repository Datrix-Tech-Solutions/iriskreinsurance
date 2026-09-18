import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AccountsPayableSummary, AccountsReceivableSummary } from '@/types/accounting';

export function useAccountsReceivableSummary() {
  return useQuery({
    queryKey: ['accounting', 'receivables', 'summary'],
    queryFn: async () =>
      (await api.get<AccountsReceivableSummary>('/accounting/receivables/summary')).data,
  });
}

export function useAccountsPayableSummary() {
  return useQuery({
    queryKey: ['accounting', 'payables', 'summary'],
    queryFn: async () =>
      (await api.get<AccountsPayableSummary>('/accounting/payables/summary')).data,
  });
}
