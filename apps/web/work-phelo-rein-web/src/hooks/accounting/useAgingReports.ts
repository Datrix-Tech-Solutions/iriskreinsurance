import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AccountingAgingReport, AccountingPartyStatement } from '@/types/accounting';

type Side = 'receivables' | 'payables';

export function useAgingReport(side: Side, asOfDate: string, enabled = true) {
  return useQuery({
    queryKey: ['accounting', side, 'aging', asOfDate],
    queryFn: async () =>
      (await api.get<AccountingAgingReport>(`/accounting/${side}/aging`, { params: { asOfDate } }))
        .data,
    enabled,
  });
}

export function usePartyStatement(side: Side, partyId: string) {
  const segment = side === 'receivables' ? 'customers' : 'vendors';
  return useQuery({
    queryKey: ['accounting', side, 'statement', partyId],
    queryFn: async () =>
      (
        await api.get<AccountingPartyStatement>(
          `/accounting/${side}/${segment}/${partyId}/statement`,
        )
      ).data,
    enabled: Boolean(partyId),
  });
}
