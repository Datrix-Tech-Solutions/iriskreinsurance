import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GLAccountLedger } from '@/types/accounting';

export function useGLAccountLedger(accountId: string) {
  return useQuery({
    queryKey: ['accounting', 'gl-accounts', accountId, 'ledger'],
    queryFn: async () =>
      (await api.get<GLAccountLedger>(`/accounting/accounts/${accountId}/ledger`)).data,
    enabled: Boolean(accountId),
  });
}
